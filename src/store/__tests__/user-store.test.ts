/**
 * Persistence contract on useUserStore — the version-2 migration that
 * retires Tobias and Marco (Trainer Roster v1): a persisted pick of a
 * retired trainer becomes null plus a retiredTrainerId flag, which
 * drives Kael's staffing note and the Training Hub re-pick.
 */

// AsyncStorage's native module isn't linked in jest-expo — mock it so
// zustand's persist middleware can construct without exploding.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { useUserStore } from '../user-store';

/** A version-1 persisted shape, as it lives on tester phones. */
function v1State(trainerId: string | null) {
  return {
    name: 'Ana',
    nsId: 'elena',
    trainerId,
    setupComplete: true,
  };
}

const migrate = useUserStore.persist.getOptions().migrate!;

describe('user-store version 2 migration (trainer retirement)', () => {
  it.each(['tobias', 'marco'] as const)(
    'moves a persisted %s pick to null + retiredTrainerId',
    (retired) => {
      const migrated = migrate(v1State(retired), 1) as Record<string, unknown>;
      expect(migrated.trainerId).toBeNull();
      expect(migrated.retiredTrainerId).toBe(retired);
      // Nothing else is touched — setup stays complete, team stays intact.
      expect(migrated.setupComplete).toBe(true);
      expect(migrated.name).toBe('Ana');
      expect(migrated.nsId).toBe('elena');
    },
  );

  it('leaves an active trainer pick untouched', () => {
    const migrated = migrate(v1State('cassidy'), 1) as Record<string, unknown>;
    expect(migrated.trainerId).toBe('cassidy');
    expect(migrated.retiredTrainerId).toBeUndefined();
  });

  it('leaves a null trainer (pre-required-trainer accounts) untouched', () => {
    const migrated = migrate(v1State(null), 1) as Record<string, unknown>;
    expect(migrated.trainerId).toBeNull();
    expect(migrated.retiredTrainerId).toBeUndefined();
  });
});

describe('setTrainer (the re-pick commit)', () => {
  it('sets the new trainer and clears the retirement flag', () => {
    useUserStore.setState({ trainerId: null, retiredTrainerId: 'marco' });
    useUserStore.getState().setTrainer('renata');
    expect(useUserStore.getState().trainerId).toBe('renata');
    expect(useUserStore.getState().retiredTrainerId).toBeNull();
  });
});
