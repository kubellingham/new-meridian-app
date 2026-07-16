/**
 * Contracts on the onboarding flow content that code elsewhere relies on:
 * the persisted onboarding progress store saves a bare stepIndex, so the
 * flow's shape must stay stable, and the weight-loss-first pivot pins the
 * goal question to a single selectable answer.
 */

import { buildOnboardingFlow } from '../flows';
import type { PrimaryGoal } from '@/src/types/user-data';

const GOALS: PrimaryGoal[] = ['weight-loss', 'build-muscle', 'general-fitness'];

describe('onboarding flow shape', () => {
  it('has identical length for every goal (persisted stepIndex stays valid)', () => {
    const lengths = GOALS.map((g) => buildOnboardingFlow(g).length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('keeps the prefix up to and including the goal question goal-independent', () => {
    const flows = GOALS.map((g) => buildOnboardingFlow(g));
    const goalIndex = flows[0].findIndex(
      (b) => b.kind === 'cards' && b.field === 'goal',
    );
    expect(goalIndex).toBeGreaterThan(0);
    for (let i = 0; i <= goalIndex; i++) {
      expect(flows[1][i]).toEqual(flows[0][i]);
      expect(flows[2][i]).toEqual(flows[0][i]);
    }
  });
});

describe('weight-loss-first front door', () => {
  it('offers exactly one selectable goal — weight loss', () => {
    const flow = buildOnboardingFlow('weight-loss');
    const goalBeat = flow.find((b) => b.kind === 'cards' && b.field === 'goal');
    if (goalBeat?.kind !== 'cards') throw new Error('goal beat missing');
    const enabled = goalBeat.options.filter((o) => !o.disabled);
    expect(enabled.map((o) => o.value)).toEqual(['weight-loss']);
  });

  it('shows the dormant goals as disabled cards with an honest note', () => {
    const flow = buildOnboardingFlow('weight-loss');
    const goalBeat = flow.find((b) => b.kind === 'cards' && b.field === 'goal');
    if (goalBeat?.kind !== 'cards') throw new Error('goal beat missing');
    for (const value of ['build-muscle', 'general-fitness']) {
      const option = goalBeat.options.find((o) => o.value === value);
      expect(option?.disabled).toBe(true);
      expect(option?.disabledNote).toContain('weight loss');
      // Reactions stay in place for the day the goals reopen.
      expect(option?.reaction.length).toBeGreaterThan(0);
    }
  });
});
