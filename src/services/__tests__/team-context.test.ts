/**
 * Visibility and formatting rules for the shared team-context digest
 * (brief §4). Pure function — no store, no network.
 */

import { buildTeamContext } from '../team-context';
import type { ChatMessage } from '@/src/store/chat-store';
import type { CharacterId } from '@/src/content/characters';
import {
  EMPTY_SHARED_USER_DATA,
  type SharedUserData,
  type TeamEvent,
  type WorkoutPlan,
  type WorkoutSession,
} from '@/src/types/user-data';

/** Today's local date, matching team-context's own todayISO(). */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

describe('buildTeamContext events block', () => {
  /** Compact event helper for these tests. */
  function evt(overrides: Partial<TeamEvent> = {}): TeamEvent {
    return {
      id: overrides.id ?? 'e1',
      at: overrides.at ?? 1,
      from: overrides.from ?? 'cassidy',
      to: overrides.to ?? ['nneka'],
      kind: overrides.kind ?? 'programme-block-shift',
      summary: overrides.summary ?? 'pulled volume back this week',
      reasoning: overrides.reasoning,
      seenBy: overrides.seenBy ?? [],
    };
  }

  /** SharedUserData wrapper with events populated. */
  function withEvents(events: TeamEvent[]): SharedUserData {
    return { ...EMPTY_SHARED_USER_DATA, events };
  }

  it('surfaces a pending event to the affected specialist', () => {
    const data = withEvents([
      evt({ from: 'cassidy', to: ['nneka'], summary: 'pulled volume back this week' }),
    ]);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    expect(block).toContain('Cassidy');
    expect(block).toContain('pulled volume back this week');
  });

  it('names the deciding specialist by name and includes reasoning when present', () => {
    const data = withEvents([
      evt({
        from: 'cassidy',
        to: ['nneka'],
        summary: 'pulled volume back this week',
        reasoning: 'user slept badly two nights running',
      }),
    ]);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    expect(block).toContain('Cassidy: pulled volume back this week');
    expect(block).toContain('user slept badly two nights running');
  });

  it('hides events not addressed to the current character', () => {
    const data = withEvents([
      evt({ from: 'cassidy', to: ['sera'], summary: 'flagged mood dip' }),
    ]);
    expect(buildTeamContext('nneka', {}, 'Innocent', data)).toBe('');
  });

  it('hides events the current character has already seen', () => {
    const data = withEvents([
      evt({ id: '1', from: 'cassidy', to: ['nneka'], seenBy: ['nneka'] }),
    ]);
    expect(buildTeamContext('nneka', {}, 'Innocent', data)).toBe('');
  });

  it('frames the events block as team memory, not a record lookup', () => {
    const data = withEvents([
      evt({ from: 'cassidy', to: ['nneka'], summary: 'pulled volume back' }),
    ]);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    // The block warns off "record"/"log"/"file shows" phrasing.
    expect(block).toMatch(/never say "your file shows"/i);
    expect(block).toMatch(/heard these through the team/i);
  });

  it('sits between the facts block and the conversation digest when all three exist', () => {
    const data: SharedUserData = {
      ...EMPTY_SHARED_USER_DATA,
      userProfile: { height: 178 },
      events: [evt({ from: 'cassidy', to: ['nneka'], summary: 'lightened week' })],
    };
    const threads: Threads = { sera: activeThread('feeling stuck') };
    const block = buildTeamContext('nneka', threads, 'Innocent', data);

    const factsIndex = block.indexOf('178 cm tall');
    const eventsIndex = block.indexOf('lightened week');
    const conversationIndex = block.indexOf('With Sera');
    expect(factsIndex).toBeGreaterThan(-1);
    expect(eventsIndex).toBeGreaterThan(factsIndex);
    expect(conversationIndex).toBeGreaterThan(eventsIndex);
  });
});

describe('buildTeamContext recent-training line', () => {
  /** Compact session builder for these tests. */
  function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
    const startedAt = overrides.startedAt ?? Date.now() - 2 * 24 * 60 * 60 * 1000;
    return {
      id: overrides.id ?? 'sess-a',
      planId: overrides.planId ?? 'plan-a',
      startedAt,
      completedAt: overrides.completedAt ?? startedAt + 30 * 60 * 1000,
      status: overrides.status ?? 'completed',
      logs: overrides.logs ?? [
        { plannedExerciseId: 'ex-1', name: 'Back squat', status: 'completed', sets: [] },
      ],
      sessionFeeling: overrides.sessionFeeling,
      sessionNote: overrides.sessionNote,
    };
  }

  function withSessions(sessions: WorkoutSession[]): SharedUserData {
    return {
      ...EMPTY_SHARED_USER_DATA,
      programmeState: { recentSessions: sessions },
    };
  }

  it('surfaces recent sessions as a compact prose line', () => {
    const data = withSessions([
      session({ sessionFeeling: 'okay', logs: [{ plannedExerciseId: 'ex-1', name: 'Back squat', status: 'completed', sets: [] }] }),
    ]);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    expect(block).toContain('recent training');
    expect(block).toContain('back squat');
    expect(block).toContain('felt okay');
  });

  it('marks abandoned sessions as cut short instead of felt-rating', () => {
    const data = withSessions([session({ status: 'abandoned', abandonedAt: Date.now() })]);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    expect(block).toContain('cut short');
    expect(block).not.toContain('felt undefined');
  });

  it('caps the digest at three sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      session({ id: `sess-${i}`, logs: [{ plannedExerciseId: `ex-${i}`, name: `Move ${i}`, status: 'completed', sets: [] }] }),
    );
    const data = withSessions(sessions);
    const block = buildTeamContext('nneka', {}, 'Innocent', data);
    // The 4th and 5th sessions' focus names should not appear.
    expect(block).toContain('move 0');
    expect(block).not.toContain('move 3');
    expect(block).not.toContain('move 4');
  });

  it('omits the training line when there are no sessions', () => {
    const block = buildTeamContext(
      'nneka',
      {},
      'Innocent',
      { ...EMPTY_SHARED_USER_DATA, userProfile: { height: 178 } },
    );
    expect(block).toContain('178 cm tall');
    expect(block).not.toContain('recent training');
  });
});

describe('buildTeamContext today plan line', () => {
  function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
    return {
      id: overrides.id ?? 'plan-x',
      createdAt: overrides.createdAt ?? Date.now(),
      forDate: overrides.forDate ?? todayISO(),
      createdBy: overrides.createdBy ?? 'marco',
      focusArea: overrides.focusArea ?? 'Full body conditioning',
      estimatedMinutes: overrides.estimatedMinutes ?? 35,
      intent: overrides.intent ?? 'Building the habit before the programme.',
      exercises:
        overrides.exercises ??
        [
          { id: 'e1', name: 'March in Place', category: 'warm-up', targetSets: 1, targetReps: '3 min' },
          { id: 'e2', name: 'Bodyweight Squat', category: 'conditioning', targetSets: 3, targetReps: '10-12' },
        ],
    };
  }

  function withPlan(p: WorkoutPlan, session?: SharedUserData['programmeState']['currentSession']): SharedUserData {
    return {
      ...EMPTY_SHARED_USER_DATA,
      programmeState: { currentPlan: p, currentSession: session },
    };
  }

  it("surfaces today's plan attributed to the trainer, before it's done", () => {
    const block = buildTeamContext('marco', {}, 'Innocent', withPlan(plan()));
    expect(block).toContain("today's session, built by Marco");
    expect(block).toContain('Full body conditioning');
    expect(block).toContain('March in Place');
    expect(block).toContain('not started yet');
  });

  it('lets the NS and consultants see the plan too', () => {
    const block = buildTeamContext('nneka', {}, 'Innocent', withPlan(plan()));
    expect(block).toContain('Full body conditioning');
    const kaelBlock = buildTeamContext('kael', {}, 'Innocent', withPlan(plan()));
    expect(kaelBlock).toContain('built by Marco');
  });

  it('reflects an in-progress session status', () => {
    const p = plan();
    const session: NonNullable<SharedUserData['programmeState']['currentSession']> = {
      id: 'sess-x',
      planId: p.id,
      startedAt: Date.now(),
      status: 'in-progress',
      logs: [
        { plannedExerciseId: 'e1', name: 'March in Place', status: 'completed', sets: [] },
        { plannedExerciseId: 'e2', name: 'Bodyweight Squat', status: 'pending', sets: [] },
      ],
    };
    const block = buildTeamContext('marco', {}, 'Innocent', withPlan(p, session));
    expect(block).toContain('underway, 1 of 2 done');
  });

  it('describes a rest day in the trainer voice', () => {
    const block = buildTeamContext(
      'marco',
      {},
      'Innocent',
      withPlan(plan({ exercises: [], intent: 'You earned a day off — take it.' })),
    );
    expect(block).toContain('Marco set today as a rest day');
    expect(block).toContain('take it');
  });

  it('ignores a stale plan from a previous day', () => {
    const block = buildTeamContext(
      'marco',
      {},
      'Innocent',
      withPlan(plan({ forDate: '2000-01-01' })),
    );
    expect(block).not.toContain("today's session");
  });

  it('caps the named exercises and counts the rest', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      name: `Move ${i}`,
      category: 'conditioning' as const,
      targetSets: 1,
      targetReps: '10',
    }));
    const block = buildTeamContext('marco', {}, 'Innocent', withPlan(plan({ exercises: many })));
    expect(block).toContain('Move 0');
    expect(block).toContain('+4 more');
    expect(block).toContain('12 exercises');
  });
});
