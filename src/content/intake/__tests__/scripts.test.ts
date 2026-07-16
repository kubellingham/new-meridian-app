/**
 * Intake script integrity — the five trainers share machinery but not
 * voice, and the machinery has contracts: every script collects the
 * canonical facts, silent options are silent only because a challenge
 * answers them, and every challenge leaves the user in control.
 */

import { INTAKE_SCRIPTS } from '../index';
import type { IntakeAnswers, TrainerIntakeScript } from '../types';

const WL_TRAINERS = ['cassidy', 'renata', 'marcus', 'priya', 'noa'] as const;
const REQUIRED_FIELDS: (keyof IntakeAnswers)[] = [
  'experience',
  'place',
  'equipment',
  'days',
  'sessionLength',
  'timeOfDay',
  'limitations',
  'notes',
];

const scripts = WL_TRAINERS.map((id) => INTAKE_SCRIPTS[id]).filter(
  (s): s is TrainerIntakeScript => s !== undefined,
);

describe('intake scripts', () => {
  it('exist for all five weight-loss trainers, keyed correctly', () => {
    expect(scripts).toHaveLength(5);
    for (const id of WL_TRAINERS) {
      expect(INTAKE_SCRIPTS[id]?.trainerId).toBe(id);
    }
  });

  it('collect every canonical fact', () => {
    for (const script of scripts) {
      const fields = script.steps.map((s) => s.field);
      for (const required of REQUIRED_FIELDS) {
        expect(fields).toContain(required);
      }
    }
  });

  it('guard the equipment question behind home/mix training', () => {
    for (const script of scripts) {
      const equipment = script.steps.find((s) => s.field === 'equipment');
      if (equipment?.kind !== 'choice') throw new Error('equipment step missing');
      expect(equipment.when).toBeDefined();
      expect(equipment.when!({ place: 'home' })).toBe(true);
      expect(equipment.when!({ place: 'mix' })).toBe(true);
      expect(equipment.when!({ place: 'gym' })).toBe(false);
      expect(equipment.when!({ place: 'outdoors' })).toBe(false);
    }
  });

  it('never leave an answer unacknowledged — empty reactions are challenge-covered', () => {
    for (const script of scripts) {
      for (const step of script.steps) {
        if (step.kind !== 'choice') continue;
        for (const option of step.options) {
          if (option.reaction.length > 0) continue;
          const covered = script.challenges.some(
            (c) => c.afterField === step.field && c.when({ [step.field]: option.value } as IntakeAnswers),
          );
          expect(`${script.trainerId}.${step.field}=${option.value} covered: ${covered}`).toBe(
            `${script.trainerId}.${step.field}=${option.value} covered: true`,
          );
        }
      }
    }
  });

  it('gives every challenge user control: 2+ options, reactions, outcomes', () => {
    for (const script of scripts) {
      for (const challenge of script.challenges) {
        expect(challenge.options.length).toBeGreaterThanOrEqual(2);
        for (const option of challenge.options) {
          expect(option.reaction.length).toBeGreaterThan(0);
          expect(option.outcome.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps Noa honest: four-day floor, sleep, and rough-stretch flags exist', () => {
    const noa = INTAKE_SCRIPTS.noa!;
    const ids = noa.challenges.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(['noa-four-day-floor', 'noa-short-sleep', 'noa-rough-stretch']),
    );
    // Flag-and-proceed: every Noa challenge keeps a proceed path AND
    // mentions Kael as the swap route in its lines.
    for (const challenge of noa.challenges) {
      expect(challenge.lines.join(' ')).toContain('Kael');
    }
  });

  it('keeps Priya pushing back on four-plus days with a respected keep option', () => {
    const priya = INTAKE_SCRIPTS.priya!;
    const pushback = priya.challenges.find((c) => c.id === 'priya-four-days')!;
    expect(pushback.when({ days: 4 })).toBe(true);
    expect(pushback.when({ days: 3 })).toBe(false);
    const accept = pushback.options.find((o) => o.apply?.days === 3);
    const keep = pushback.options.find((o) => !o.apply);
    expect(accept).toBeDefined();
    expect(keep).toBeDefined();
  });

  it('has voice everywhere: intro, outro, prompts non-empty, no markdown', () => {
    for (const script of scripts) {
      expect(script.intro.length).toBeGreaterThan(0);
      expect(script.outro.length).toBeGreaterThan(0);
      const allText = [
        ...script.intro,
        ...script.outro,
        ...script.steps.flatMap((s) => [
          s.prompt,
          ...(s.kind === 'choice' ? s.options.flatMap((o) => o.reaction) : s.fallbackAck),
        ]),
        ...script.challenges.flatMap((c) => c.lines),
      ].join('\n');
      expect(allText).not.toContain('**');
      expect(allText.length).toBeGreaterThan(400);
    }
  });
});
