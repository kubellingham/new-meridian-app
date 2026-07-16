/**
 * Persistence contract on useOnboardingStore — in-flight onboarding
 * progress must survive process death (the store is written beat by
 * beat) and be wiped when onboarding finishes or is reset.
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

import { useOnboardingStore } from '../onboarding-store';

describe('onboarding progress store', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('persists exactly stepIndex and answers (hasHydrated is runtime-only)', () => {
    const partialize = useOnboardingStore.persist.getOptions().partialize!;
    useOnboardingStore.setState({ stepIndex: 7, answers: { name: 'Ana' }, hasHydrated: true });
    expect(partialize(useOnboardingStore.getState())).toEqual({
      stepIndex: 7,
      answers: { name: 'Ana' },
    });
  });

  it('merges answer patches without dropping earlier keys', () => {
    const { mergeAnswers } = useOnboardingStore.getState();
    mergeAnswers({ name: 'Ana' });
    mergeAnswers({ goal: 'weight-loss' });
    mergeAnswers({ goal: 'build-muscle' }); // re-answering overwrites
    expect(useOnboardingStore.getState().answers).toEqual({
      name: 'Ana',
      goal: 'build-muscle',
    });
  });

  it('tracks the step and resets to a clean slate', () => {
    useOnboardingStore.getState().setStepIndex(12);
    useOnboardingStore.getState().mergeAnswers({ trainer: 'renata' });
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().stepIndex).toBe(0);
    expect(useOnboardingStore.getState().answers).toEqual({});
  });
});
