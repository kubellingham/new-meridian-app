/**
 * Request-shape and config tests for the ElevenLabs service. The network
 * is mocked; playback (native modules) is not exercised here.
 */

import { isVoiceConfigured, synthesizeSpeech, VoiceError } from '../eleven-labs';
import { getVoiceId, hasTunedVoice } from '../voices';

describe('voice mapping', () => {
  it('gives the three shipped characters explicitly tuned voices', () => {
    for (const id of ['kael', 'sera', 'nneka'] as const) {
      expect(hasTunedVoice(id)).toBe(true);
      expect(getVoiceId(id)).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it('falls back to a default voice for unmapped characters', () => {
    expect(hasTunedVoice('tobias')).toBe(false);
    expect(getVoiceId('tobias')).toBeTruthy();
  });
});

describe('isVoiceConfigured', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  });

  it('is true only when the key is present', () => {
    delete process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
    expect(isVoiceConfigured()).toBe(false);
    process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-key';
    expect(isVoiceConfigured()).toBe(true);
  });
});

describe('synthesizeSpeech', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  });

  it('throws without a key rather than calling the network', async () => {
    delete process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(synthesizeSpeech('kael', 'hello')).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the character voice endpoint with key, model, and text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const bytes = await synthesizeSpeech('sera', 'How are you doing?');

    expect(bytes).toBeInstanceOf(Uint8Array);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(getVoiceId('sera'));
    expect(init.method).toBe('POST');
    expect(init.headers['xi-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.text).toBe('How are you doing?');
    expect(body.model_id).toBe('eleven_turbo_v2_5');
  });

  it('raises a VoiceError carrying the HTTP status on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(synthesizeSpeech('kael', 'hi')).rejects.toBeInstanceOf(VoiceError);
  });
});
