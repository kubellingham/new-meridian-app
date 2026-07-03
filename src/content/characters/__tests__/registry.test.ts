/**
 * Guardrail tests for the character registry — the content rules from
 * Master Brief v2.0 that can be checked mechanically.
 */

import {
  buildSystemPrompt,
  CHARACTERS,
  CONSULTANTS,
  getCharacter,
  NUTRITION_SPECIALISTS,
  SHARED_INSTRUCTION_BLOCK,
  TRAINERS,
} from '../index';

describe('character registry completeness', () => {
  it('contains exactly 13 characters', () => {
    expect(CHARACTERS).toHaveLength(13);
  });

  it('has 2 consultants, 3 trainers, and 8 nutrition specialists', () => {
    expect(CONSULTANTS.map((c) => c.id).sort()).toEqual(['kael', 'sera']);
    expect(TRAINERS.map((c) => c.id).sort()).toEqual(['cassidy', 'marco', 'tobias']);
    expect(NUTRITION_SPECIALISTS).toHaveLength(8);
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
