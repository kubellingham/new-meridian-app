/**
 * Exercise database integrity — the vocabulary workout generation is
 * constrained to. Mechanical guarantees: names unique, every access tier
 * can build a complete session, lookups resolve.
 */

import { EXERCISES, exerciseByName, filterByAccess } from '../exercises';
import type { ExerciseCategory } from '@/src/types/user-data';

const CATEGORIES: ExerciseCategory[] = [
  'strength',
  'conditioning',
  'mobility',
  'warm-up',
  'cool-down',
];

describe('exercise database integrity', () => {
  it('has unique names (case-insensitive)', () => {
    const names = EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every entry muscles and a cue', () => {
    for (const e of EXERCISES) {
      expect(e.muscles.length).toBeGreaterThan(0);
      expect(e.cue.length).toBeGreaterThan(10);
    }
  });

  it('is big enough to be a real vocabulary', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(80);
  });
});

describe('filterByAccess', () => {
  it('lets every tier build a complete session (all five categories)', () => {
    for (const access of ['bodyweight', 'home-basics', 'full-gym'] as const) {
      const pool = filterByAccess(access);
      for (const category of CATEGORIES) {
        const inCategory = pool.filter((e) => e.category === category);
        expect(inCategory.length).toBeGreaterThan(0);
      }
    }
  });

  it('tiers nest: bodyweight ⊆ home-basics ⊆ full-gym', () => {
    const body = new Set(filterByAccess('bodyweight').map((e) => e.name));
    const home = new Set(filterByAccess('home-basics').map((e) => e.name));
    const gym = new Set(filterByAccess('full-gym').map((e) => e.name));
    for (const name of body) expect(home.has(name)).toBe(true);
    for (const name of home) expect(gym.has(name)).toBe(true);
    expect(gym.size).toBe(EXERCISES.length);
  });

  it('bodyweight tier contains no equipment exercises', () => {
    for (const e of filterByAccess('bodyweight')) {
      expect(e.equipment).toBe('none');
    }
  });

  it('defaults to the full gym', () => {
    expect(filterByAccess().length).toBe(EXERCISES.length);
  });
});

describe('exerciseByName', () => {
  it('resolves names case-insensitively', () => {
    expect(exerciseByName('goblet squat')?.name).toBe('Goblet squat');
    expect(exerciseByName('  PULL-UP ')?.name).toBe('Pull-up');
  });

  it('returns undefined for unknown names', () => {
    expect(exerciseByName('Underwater basket press')).toBeUndefined();
  });
});
