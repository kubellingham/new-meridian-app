/**
 * Verifies the request shape the Claude service builds — model, system
 * prompt assembly, and history filtering — without hitting the network.
 */

import { getCharacterReply, isClaudeConfigured } from '../claude';
import { useUserStore } from '@/src/store/user-store';
import { useChatStore, type ChatMessage } from '@/src/store/chat-store';

// Capture create() calls made through the mocked SDK. (jest.mock calls are
// hoisted above imports; the mock-prefixed variable is allowed inside.)
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return class MockAnthropic {
    messages = { create: mockCreate };
  };
});

// The user store persists to AsyncStorage, which needs its jest mock here.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must require lazily
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** Helper to build a chat message quickly. */
function msg(role: 'user' | 'assistant', text: string, error?: boolean): ChatMessage {
  return { id: text, role, text, at: 0, error };
}

describe('claude service', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Ah, that sounds like a solid plate.' }],
    });
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = 'test-key';
    // Reset cross-thread state so tests don't leak team context into each other.
    useChatStore.setState({ threads: {} });
  });

  it('reports configured only when the env key is present', () => {
    expect(isClaudeConfigured()).toBe(true);
    delete process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    expect(isClaudeConfigured()).toBe(false);
  });

  it('sends the locked model with the assembled character system prompt', async () => {
    const reply = await getCharacterReply('nneka', [msg('user', 'I had jollof rice')], 'Innocent');

    expect(reply).toBe('Ah, that sounds like a solid plate.');
    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-4-6');
    expect(request.max_tokens).toBe(1024);
    // No sampling params — steering is prompt-only.
    expect(request.temperature).toBeUndefined();
    // Shared rules first, then character voice, then user context.
    expect(request.system).toContain('THE RULES EVERY MERIDIAN CHARACTER FOLLOWS');
    expect(request.system).toContain('You are Nneka');
    expect(request.system).toContain('Their name is Innocent');
  });

  it('includes the team roster in the context so characters route by name', async () => {
    useUserStore.setState({ nsId: 'nneka', trainerId: 'cassidy' });

    await getCharacterReply('sera', [msg('user', 'I had jollof rice today')], 'Innocent');

    const request = mockCreate.mock.calls[0][0];
    expect(request.system).toContain('You are Sera');
    expect(request.system).toContain('Their nutrition specialist is Nneka.');
    expect(request.system).toContain('Their trainer is Cassidy.');
    expect(request.system).toContain('route to them by name');
    // Grounding: characters must not invent device data or programmes.
    expect(request.system).toContain('never invent numbers');
  });

  it('injects the shared team context so a character knows what teammates were told', async () => {
    // The user told Kael something; now they open Sera. She should see it.
    useChatStore.setState({
      threads: {
        kael: [msg('user', 'I drink daily plus cigars'), msg('assistant', 'Noted.')],
      },
    });

    await getCharacterReply('sera', [msg('user', "Let's talk")], 'Innocent');

    const request = mockCreate.mock.calls[0][0];
    expect(request.system).toContain('HAS ALREADY SHARED WITH THE TEAM');
    expect(request.system).toContain('With Kael');
    expect(request.system).toContain('I drink daily plus cigars');
  });

  it('omits the team context section when nothing has been shared yet', async () => {
    await getCharacterReply('sera', [msg('user', 'first message')], 'Innocent');
    const request = mockCreate.mock.calls[0][0];
    expect(request.system).not.toContain('HAS ALREADY SHARED WITH THE TEAM');
  });

  it('drops error bubbles and leading assistant messages from history', async () => {
    await getCharacterReply(
      'nneka',
      [
        msg('assistant', 'scripted greeting'), // seeded greeting — before first user turn
        msg('user', 'I had eggs'),
        msg('assistant', 'network failed', true), // error bubble — UI state only
        msg('assistant', 'Good start.'),
        msg('user', 'and toast'),
      ],
      'Innocent',
    );

    const request = mockCreate.mock.calls[0][0];
    expect(request.messages).toEqual([
      { role: 'user', content: 'I had eggs' },
      { role: 'assistant', content: 'Good start.' },
      { role: 'user', content: 'and toast' },
    ]);
  });
});
