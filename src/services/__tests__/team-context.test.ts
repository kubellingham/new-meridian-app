/**
 * Visibility and formatting rules for the shared team-context digest
 * (brief §4). Pure function — no store, no network.
 */

import { buildTeamContext } from '../team-context';
import type { ChatMessage } from '@/src/store/chat-store';
import type { CharacterId } from '@/src/content/characters';
import { EMPTY_SHARED_USER_DATA, type SharedUserData } from '@/src/types/user-data';

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

describe('buildTeamContext shared-data block', () => {
  /** A SharedUserData seed with only the fields the About-you form covers. */
  function withProfile(patch: SharedUserData['userProfile']): SharedUserData {
    return {
      ...EMPTY_SHARED_USER_DATA,
      userProfile: patch,
    };
  }

  it('surfaces goal weight and physical baselines when set', () => {
    const data = withProfile({
      primaryGoal: 'weight-loss',
      height: 178,
      birthday: '1993-04-14',
      activityLevel: 'moderate',
      goalWeight: 78,
      startingWeight: 92,
    });
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    expect(block).toContain('178 cm tall');
    expect(block).toContain('born 1993-04-14');
    expect(block).toContain('activity level moderate');
    expect(block).toContain('goal is weight loss');
    expect(block).toContain('78 kg');
    expect(block).toContain('starting weight was around 92 kg');
  });

  it("frames the block as team memory, never as a data lookup", () => {
    const data = withProfile({ height: 178 });
    const block = buildTeamContext('kael', {}, 'Innocent', data);
    // Voice-safe framing — mirrors the conversation-block register.
    expect(block).toMatch(/come to know/i);
    expect(block).toContain('from working with them');
    // The block explicitly forbids record/chart lookup phrasing.
    expect(block).toMatch(/never as if you were reading a chart/i);
  });

  it('omits fields with no value', () => {
    const data = withProfile({ height: 178 });
    const block = buildTeamContext('kael', {}, 'Innocent', data);
    // Height is present, but goal weight isn't set → not in the block.
    expect(block).toContain('178 cm tall');
    expect(block).not.toContain('goal is weight loss');
    expect(block).not.toContain('activity level');
  });

  it('returns empty string when no facts and no conversations exist', () => {
    expect(buildTeamContext('kael', {}, 'Innocent', EMPTY_SHARED_USER_DATA)).toBe('');
  });

  it('combines the facts block with the conversation digest when both exist', () => {
    const data = withProfile({ height: 178, primaryGoal: 'weight-loss' });
    const threads: Threads = { sera: activeThread('feeling stuck') };
    const block = buildTeamContext('nneka', threads, 'Innocent', data);
    expect(block).toContain('178 cm tall');
    expect(block).toContain('With Sera');
    expect(block).toContain('Innocent: feeling stuck');
  });
});
