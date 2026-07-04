/**
 * Visibility and formatting rules for the shared team-context digest
 * (brief §4). Pure function — no store, no network.
 */

import { buildTeamContext } from '../team-context';
import type { ChatMessage } from '@/src/store/chat-store';
import type { CharacterId } from '@/src/content/characters';

/** Builds a chat message quickly. */
function msg(role: 'user' | 'assistant', text: string, error?: boolean): ChatMessage {
  return { id: text, role, text, at: 0, error };
}

/** A thread that opened with a greeting and then had one user exchange. */
function activeThread(userText: string): ChatMessage[] {
  return [
    msg('assistant', 'scripted greeting'),
    msg('user', userText),
    msg('assistant', 'a reply'),
  ];
}

type Threads = Partial<Record<CharacterId, ChatMessage[]>>;

describe('buildTeamContext visibility', () => {
  it('lets a consultant see another consultant thread', () => {
    const threads: Threads = { kael: activeThread('I drink daily plus cigars') };
    const block = buildTeamContext('sera', threads, 'Innocent');
    expect(block).toContain('With Kael');
    expect(block).toContain('Innocent: I drink daily plus cigars');
  });

  it('lets a consultant see a specialist thread', () => {
    const threads: Threads = { nneka: activeThread('I had jollof rice') };
    const block = buildTeamContext('kael', threads, 'Innocent');
    expect(block).toContain('With Nneka');
  });

  it('lets a specialist see a consultant thread', () => {
    const threads: Threads = { kael: activeThread('I keep skipping breakfast') };
    const block = buildTeamContext('nneka', threads, 'Innocent');
    expect(block).toContain('With Kael');
  });

  it('hides a peer specialist thread from a specialist', () => {
    // Cassidy (trainer) should not read Nneka's (NS) private thread.
    const threads: Threads = { nneka: activeThread('I had jollof rice') };
    const block = buildTeamContext('cassidy', threads, 'Innocent');
    expect(block).toBe('');
  });

  it('never includes the current character own thread', () => {
    const threads: Threads = { sera: activeThread('I feel unmotivated') };
    const block = buildTeamContext('sera', threads, 'Innocent');
    expect(block).toBe('');
  });
});

describe('buildTeamContext content rules', () => {
  it('excludes threads that only hold the scripted greeting', () => {
    const threads: Threads = { kael: [msg('assistant', 'Kael. What do you need?')] };
    const block = buildTeamContext('sera', threads, 'Innocent');
    expect(block).toBe('');
  });

  it('excludes error bubbles from the digest', () => {
    const threads: Threads = {
      kael: [msg('user', 'real message'), msg('assistant', 'network failed', true)],
    };
    const block = buildTeamContext('sera', threads, 'Innocent');
    expect(block).toContain('real message');
    expect(block).not.toContain('network failed');
  });

  it('returns empty string when nothing is shareable yet', () => {
    expect(buildTeamContext('kael', {}, 'Innocent')).toBe('');
  });

  it('caps each thread to the most recent messages', () => {
    const many: ChatMessage[] = [];
    for (let i = 0; i < 10; i++) {
      many.push(msg('user', `line ${i}`));
    }
    const block = buildTeamContext('sera', { kael: many }, 'Innocent');
    // Oldest lines drop out of the window; the newest survive.
    expect(block).not.toContain('line 0');
    expect(block).toContain('line 9');
  });
});
