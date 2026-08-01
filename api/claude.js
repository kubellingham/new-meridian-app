/**
 * Meridian's Claude proxy — the one server piece of the app.
 *
 * The mobile/web client points the Anthropic SDK at this deployment
 * (baseURL), sending the shared app token as its API key. This function
 * checks that token, swaps in the real provider key (server-side env,
 * never in any client bundle), applies cheap guardrails, and forwards
 * the request body to the Messages API. The upstream status code and
 * JSON pass straight back so the client SDK's error mapping keeps
 * working.
 *
 * Providers — both speak the Anthropic Messages format, so the client
 * never knows which is behind the proxy:
 *   - Anthropic direct (default): api.anthropic.com
 *   - OpenRouter (when OPENROUTER_API_KEY is set, it wins): their
 *     Anthropic-compatible endpoint; the app's model id is rewritten to
 *     OpenRouter's slug on the way through.
 *
 * Env (set in Vercel project settings):
 *   MERIDIAN_APP_TOKEN  — shared token baked into tester builds. It only
 *                         grants access to this capped proxy; rotate to
 *                         cut off old builds.
 *   ANTHROPIC_API_KEY   — Anthropic key. Rotate if ever exposed.
 *   OPENROUTER_API_KEY  — OpenRouter key; presence switches the upstream.
 *   OPENROUTER_MODEL    — optional OpenRouter model slug override
 *                         (default anthropic/claude-sonnet-4.6).
 *
 * Spend safety lives at the provider: set a hard spend limit in the
 * Anthropic console / OpenRouter credit balance. This function adds
 * request-shape guardrails and usage logging (visible in Vercel logs),
 * not billing enforcement.
 */

/* global Buffer */

const ANTHROPIC_UPSTREAM = 'https://api.anthropic.com/v1/messages';
const OPENROUTER_UPSTREAM = 'https://openrouter.ai/api/v1/messages';
const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';
const ANTHROPIC_VERSION = '2023-06-01';

/** The only model the app uses — anything else is rejected. */
const ALLOWED_MODEL = 'claude-sonnet-4-6';
/** Largest max_tokens any call site asks for is 2048; cap with headroom. */
const MAX_TOKENS_CAP = 4096;
/** Photo logs run ~1 MB of base64; anything past this is not our app. */
const MAX_BODY_BYTES = 1.5 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { type: 'invalid_request_error', message: 'POST only' } });
    return;
  }

  const appToken = process.env.MERIDIAN_APP_TOKEN;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const upstreamKey = openRouterKey || anthropicKey;
  if (!appToken || !upstreamKey) {
    res.status(500).json({
      error: { type: 'api_error', message: 'Proxy is not configured' },
    });
    return;
  }

  if (req.headers['x-api-key'] !== appToken) {
    res.status(401).json({
      error: { type: 'authentication_error', message: 'Invalid token' },
    });
    return;
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({
      error: { type: 'invalid_request_error', message: 'JSON body required' },
    });
    return;
  }
  if (body.stream) {
    res.status(400).json({
      error: { type: 'invalid_request_error', message: 'Streaming is not supported' },
    });
    return;
  }
  if (body.model !== ALLOWED_MODEL) {
    res.status(400).json({
      error: { type: 'invalid_request_error', message: 'Unsupported model' },
    });
    return;
  }
  if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP) {
    res.status(400).json({
      error: { type: 'invalid_request_error', message: 'max_tokens out of range' },
    });
    return;
  }
  const size = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (size > MAX_BODY_BYTES) {
    res.status(413).json({
      error: { type: 'invalid_request_error', message: 'Request too large' },
    });
    return;
  }

  // OpenRouter wins when both keys are set — it's only ever set on
  // purpose (e.g. Anthropic credits ran dry).
  const viaOpenRouter = Boolean(openRouterKey);
  const url = viaOpenRouter ? OPENROUTER_UPSTREAM : ANTHROPIC_UPSTREAM;
  // Same request either way, except OpenRouter names models by slug.
  const outBody = viaOpenRouter
    ? { ...body, model: process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL }
    : body;
  const headers = {
    'content-type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
    ...(viaOpenRouter
      ? { authorization: `Bearer ${openRouterKey}`, 'x-title': 'Meridian' }
      : { 'x-api-key': anthropicKey }),
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(outBody),
    });

    const json = await upstream.json();
    // One log line per call — Vercel logs become the usage monitor.
    const usage = json && json.usage ? json.usage : {};
    console.log(
      `claude[${viaOpenRouter ? 'openrouter' : 'anthropic'}] ${upstream.status} in=${usage.input_tokens ?? '?'} out=${usage.output_tokens ?? '?'} bytes=${size}`,
    );
    res.status(upstream.status).json(json);
  } catch (error) {
    console.error('upstream failure:', error && error.message);
    res.status(502).json({
      error: { type: 'api_error', message: 'Upstream unreachable' },
    });
  }
};
