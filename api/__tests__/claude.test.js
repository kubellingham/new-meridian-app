/* global jest, describe, it, expect, beforeEach */
/**
 * Proxy handler guardrails — auth, shape clamps, verbatim forwarding,
 * and upstream status passthrough. Runs the function directly with mock
 * req/res; fetch is stubbed.
 */

const handler = require('../claude');

/** Minimal res double capturing status + json. */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function req(overrides = {}) {
  return {
    method: 'POST',
    headers: { 'x-api-key': 'app-token' },
    body: {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are Nneka.',
      messages: [{ role: 'user', content: 'I had jollof rice' }],
    },
    ...overrides,
  };
}

describe('api/claude proxy', () => {
  beforeEach(() => {
    process.env.MERIDIAN_APP_TOKEN = 'app-token';
    process.env.ANTHROPIC_API_KEY = 'real-key';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'Solid plate.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
  });

  it('rejects non-POST', async () => {
    const res = mockRes();
    await handler(req({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a wrong or missing app token with 401', async () => {
    const res = mockRes();
    await handler(req({ headers: { 'x-api-key': 'nope' } }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.type).toBe('authentication_error');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when server env is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = mockRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(500);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported models and oversized max_tokens', async () => {
    const res1 = mockRes();
    await handler(req({ body: { ...req().body, model: 'claude-opus-4-8' } }), res1);
    expect(res1.statusCode).toBe(400);

    const res2 = mockRes();
    await handler(req({ body: { ...req().body, max_tokens: 9000 } }), res2);
    expect(res2.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects streaming requests', async () => {
    const res = mockRes();
    await handler(req({ body: { ...req().body, stream: true } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects bodies past the size cap with 413', async () => {
    const res = mockRes();
    const huge = 'x'.repeat(1.6 * 1024 * 1024);
    await handler(req({ body: { ...req().body, messages: [{ role: 'user', content: huge }] } }), res);
    expect(res.statusCode).toBe(413);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards the body verbatim with the real key and returns upstream JSON', async () => {
    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'You are Cassidy.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
            { type: 'text', text: 'log this plate' },
          ],
        },
      ],
      tools: [{ name: 'submit_workout_plan', input_schema: { type: 'object' } }],
      tool_choice: { type: 'tool', name: 'submit_workout_plan' },
    };
    const res = mockRes();
    await handler(req({ body }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.content[0].text).toBe('Solid plate.');
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('real-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    // Verbatim: image blocks, tools, and forced tool_choice all survive.
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('passes upstream error statuses straight through', async () => {
    global.fetch.mockResolvedValue({
      status: 429,
      json: async () => ({ error: { type: 'rate_limit_error', message: 'slow down' } }),
    });
    const res = mockRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error.type).toBe('rate_limit_error');
  });

  it('maps upstream network failure to 502', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNRESET'));
    const res = mockRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(502);
  });

  describe('OpenRouter upstream (OPENROUTER_API_KEY set)', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = 'or-key';
    });

    it('routes to the Anthropic-compatible endpoint with a Bearer key and slug model', async () => {
      const res = mockRes();
      await handler(req(), res);
      expect(res.statusCode).toBe(200);
      const [url, init] = global.fetch.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/messages');
      expect(init.headers.authorization).toBe('Bearer or-key');
      expect(init.headers['x-api-key']).toBeUndefined();
      const sent = JSON.parse(init.body);
      // The app's Anthropic model id becomes OpenRouter's slug; the rest
      // of the request rides through untouched.
      expect(sent.model).toBe('anthropic/claude-sonnet-4.6');
      expect(sent.system).toBe('You are Nneka.');
      expect(sent.messages).toEqual([{ role: 'user', content: 'I had jollof rice' }]);
    });

    it('honors an OPENROUTER_MODEL override', async () => {
      process.env.OPENROUTER_MODEL = 'anthropic/claude-sonnet-4';
      const res = mockRes();
      await handler(req(), res);
      const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(sent.model).toBe('anthropic/claude-sonnet-4');
    });

    it('wins over an Anthropic key when both are set', async () => {
      const res = mockRes();
      await handler(req(), res);
      expect(global.fetch.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/messages');
    });

    it('works with only the OpenRouter key configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const res = mockRes();
      await handler(req(), res);
      expect(res.statusCode).toBe(200);
    });

    it('still rejects models the app never sends', async () => {
      const res = mockRes();
      await handler(req({ body: { model: 'gpt-4o', max_tokens: 100, messages: [] } }), res);
      expect(res.statusCode).toBe(400);
    });
  });
});
