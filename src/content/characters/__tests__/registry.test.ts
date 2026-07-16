/**
 * Guardrail tests for the character registry — the content rules from
 * Master Brief v2.0 that can be checked mechanically.
 */

import {
  buildSystemPrompt,
  CHARACTERS,
  CONSULTANTS,
  getCharacter,
  getTrainersForGoal,
  NUTRITION_SPECIALISTS,
  SHARED_INSTRUCTION_BLOCK,
  TEAM_CROSS_REFERENCE_BLOCK,
  TRAINERS,
} from '../index';

describe('character registry completeness', () => {
  it('contains exactly 23 characters (21 active + 2 retired)', () => {
    expect(CHARACTERS).toHaveLength(23);
  });

  it('has 2 consultants, 11 active trainers, and 8 nutrition specialists', () => {
    expect(CONSULTANTS.map((c) => c.id).sort()).toEqual(['kael', 'sera']);
    expect(TRAINERS).toHaveLength(11);
    expect(NUTRITION_SPECIALISTS).toHaveLength(8);
  });

  it('gives every goal its roster of active trainers', () => {
    expect(getTrainersForGoal('weight-loss').map((c) => c.id).sort()).toEqual([
      'cassidy',
      'marcus',
      'noa',
      'priya',
      'renata',
    ]);
    expect(getTrainersForGoal('build-muscle').map((c) => c.id).sort()).toEqual([
      'ananya',
      'dmitri',
      'kofi',
    ]);
    expect(getTrainersForGoal('general-fitness').map((c) => c.id).sort()).toEqual([
      'amara',
      'ingrid',
      'sam',
    ]);
  });

  it('keeps retired trainers resolvable but off every roster', () => {
    for (const id of ['tobias', 'marco'] as const) {
      const retired = getCharacter(id);
      expect(retired.retired).toBe(true);
      expect(TRAINERS.map((t) => t.id)).not.toContain(id);
      expect(getTrainersForGoal('weight-loss').map((t) => t.id)).not.toContain(id);
    }
  });

  it('gives every weight-loss trainer a full name for roster cards', () => {
    for (const trainer of getTrainersForGoal('weight-loss')) {
      expect(trainer.fullName).toBeDefined();
      expect(trainer.fullName).toContain(trainer.name);
    }
  });

  it('gives every weight-loss trainer a coherent projection profile', () => {
    for (const trainer of getTrainersForGoal('weight-loss')) {
      const p = trainer.projectionProfile;
      expect(p).toBeDefined();
      if (!p) continue;
      expect(p.expectedRateMin).toBeGreaterThan(0);
      expect(p.expectedRateMax).toBeGreaterThanOrEqual(p.expectedRateMin);
      // time_boxed ⇔ blockLengthWeeks — the block IS the shape.
      if (p.programShape === 'time_boxed') {
        expect(p.blockLengthWeeks).toBeGreaterThan(0);
      } else {
        expect(p.blockLengthWeeks).toBeUndefined();
      }
      // The note is a short in-voice line, not a stats paragraph.
      expect(p.ratePhilosophyNote.length).toBeGreaterThan(0);
      expect(p.ratePhilosophyNote.length).toBeLessThan(200);
    }
  });

  it('keeps projection profiles off everyone but weight-loss trainers', () => {
    for (const c of CHARACTERS) {
      if (c.goalSpecialty !== 'weight-loss' || c.retired) {
        expect(c.projectionProfile).toBeUndefined();
      }
    }
  });

  it('gives every trainer (and only trainers) a goal specialty', () => {
    for (const c of CHARACTERS) {
      if (c.role === 'trainer') {
        expect(c.goalSpecialty).toBeDefined();
      } else {
        expect(c.goalSpecialty).toBeUndefined();
      }
    }
  });

  it('has unique ids and names', () => {
    const ids = CHARACTERS.map((c) => c.id);
    const names = CHARACTERS.map((c) => c.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('looks up characters by id and throws on unknown ids', () => {
    expect(getCharacter('nneka').name).toBe('Nneka');
    // @ts-expect-error — deliberately passing an invalid id
    expect(() => getCharacter('viktor')).toThrow('Unknown character id');
  });
});

describe('prompt assembly', () => {
  it('prepends the shared instruction block to every prompt', () => {
    for (const character of CHARACTERS) {
      const prompt = buildSystemPrompt(character);
      expect(prompt.startsWith(SHARED_INSTRUCTION_BLOCK)).toBe(true);
      expect(prompt).toContain(character.voicePrompt);
    }
  });

  it('includes the NS role block for nutrition specialists only', () => {
    for (const character of CHARACTERS) {
      const prompt = buildSystemPrompt(character);
      const hasNsBlock = prompt.includes('HOW MEAL LOGGING WORKS');
      expect(hasNsBlock).toBe(character.role === 'nutrition-specialist');
    }
  });

  it('includes the team cross-reference block in every prompt', () => {
    for (const character of CHARACTERS) {
      const prompt = buildSystemPrompt(character);
      expect(prompt).toContain(TEAM_CROSS_REFERENCE_BLOCK);
    }
  });
});

describe('content rules (brief §3)', () => {
  it('never has a character voice prompt admitting to being an AI', () => {
    // The shared block forbids it; character prompts must not reintroduce
    // phrasing like "you are an AI assistant" as a self-description.
    for (const character of CHARACTERS) {
      expect(character.voicePrompt).not.toMatch(/you are an AI/i);
      expect(character.voicePrompt).not.toMatch(/language model/i);
      expect(character.voicePrompt).not.toMatch(/\bClaude\b/);
    }
  });

  it('keeps markdown formatting out of voice prompt example lines', () => {
    // Characters never use markdown in conversation; their example lines
    // must model that (no bold markers or bullet-list asterisks in quotes).
    for (const character of CHARACTERS) {
      expect(character.voicePrompt).not.toContain('**');
    }
  });

  it('gives every character the required content fields', () => {
    for (const character of CHARACTERS) {
      expect(character.name.length).toBeGreaterThan(0);
      expect(character.origin.length).toBeGreaterThan(0);
      expect(character.personalityWords.length).toBeGreaterThan(0);
      expect(character.philosophy.length).toBeGreaterThan(0);
      expect(character.humorProfile.length).toBeGreaterThan(0);
      // Voice prompts should be substantial, not stubs.
      expect(character.voicePrompt.length).toBeGreaterThan(500);
    }
  });
});
