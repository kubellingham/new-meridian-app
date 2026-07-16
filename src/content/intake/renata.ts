import type { TrainerIntakeScript } from './types';

/**
 * Renata's intake — the shortest script on the roster, which is itself
 * her voice. Days-per-week genuinely doesn't move her (three is three;
 * the rest is your business), so it carries flat reactions and no
 * challenge. What she's precise about: rest, load, and injuries.
 */
export const renataIntake: TrainerIntakeScript = {
  trainerId: 'renata',
  intro: [
    "A few questions. Three would do, but people are complicated. The programme won't be.",
  ],
  steps: [
    {
      kind: 'choice',
      field: 'days',
      prompt: 'How many days a week. Be accurate, not ambitious.',
      options: [
        { value: 2, label: '2 days', reaction: ['Two. Then two it is — full body, nothing wasted.'] },
        { value: 3, label: '3 days', reaction: ['Three. Correct. It was also the only number I needed.'] },
        {
          value: 4,
          label: '4 days',
          reaction: ["Four. Fine. You'll train three; the fourth is yours — walk, swim, sit down. I don't mind."],
        },
        {
          value: 5,
          label: '5 or more',
          reaction: ['Five. Ambitious. The programme is three. What you do with the other two is your business.'],
        },
      ],
    },
    {
      kind: 'choice',
      field: 'sessionLength',
      prompt: 'How long can a session be? Honest number — the rests are long, and they are not optional.',
      options: [
        { value: 20, label: '~20 minutes', reaction: ["Twenty is tight for full rests. We'll cut sets before we ever cut rest."] },
        { value: 30, label: '~30 minutes', reaction: ['Thirty. Workable.'] },
        { value: 45, label: '~45 minutes', reaction: ['Forty-five. Comfortable. The rests thank you.'] },
        { value: 60, label: 'An hour or more', reaction: ["An hour. We won't need all of it. That's the design."] },
      ],
    },
    {
      kind: 'choice',
      field: 'place',
      prompt: 'Where will you lift?',
      options: [
        { value: 'gym', label: 'A gym', reaction: ["A barbell. Good. That's most of what I need to know."] },
        { value: 'home', label: 'At home', reaction: ['Home. Then the next question matters.'] },
        { value: 'outdoors', label: 'Outdoors', reaction: ["Outdoors. Unusual for lifting — we'll be inventive, and strict about it."] },
        { value: 'mix', label: 'A mix', reaction: ['A mix. The heavy day goes wherever the load is.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'equipment',
      when: (a) => a.place === 'home' || a.place === 'mix',
      prompt: 'What is there to lift at home?',
      options: [
        { value: 'home-basics', label: 'Dumbbells, bands, maybe a bench', reaction: ['Dumbbells work. Heavy enough, eventually.'] },
        { value: 'bodyweight', label: 'Just me', reaction: ["Bodyweight, then. We load what we can and buy nothing yet."] },
      ],
    },
    {
      kind: 'choice',
      field: 'experience',
      prompt: 'Have you lifted before — actual lifting, bar or dumbbells in hand?',
      options: [
        { value: 'none', label: 'Never', reaction: ["Never. Good — you'll learn it correctly the first time."] },
        { value: 'returning', label: 'Long ago', reaction: ['It comes back. Faster than you think — the body keeps notes.'] },
        { value: 'some', label: 'A little', reaction: ["A little is enough to build on. We'll re-check the form anyway."] },
        { value: 'experienced', label: 'Yes, properly', reaction: ["Properly. Then you already know the sets will look small. They're supposed to."] },
      ],
    },
    {
      kind: 'choice',
      field: 'timeOfDay',
      prompt: "Morning or evening? The bar doesn't care. Your consistency might.",
      options: [
        { value: 'morning', label: 'Morning', reaction: ['Morning. Noted.'] },
        { value: 'midday', label: 'Midday', reaction: ['Midday. Noted.'] },
        { value: 'evening', label: 'Evening', reaction: ['Evening. Noted.'] },
        { value: 'varies', label: 'It varies', reaction: ['Varies. The programme is patient.'] },
      ],
    },
    {
      kind: 'freeText',
      field: 'limitations',
      prompt: 'Anything injured, painful, or forbidden by someone with a medical degree? Precision helps.',
      placeholder: 'Injuries, pain, movements to avoid…',
      fallbackAck: ['Noted. The programme will respect it — every session.'],
      skipLabel: 'Nothing to report',
    },
    {
      kind: 'freeText',
      field: 'notes',
      prompt: 'Anything else. One sentence is fine; I read short.',
      placeholder: 'In your own words…',
      fallbackAck: ['Understood.'],
      skipLabel: 'Nothing else',
    },
  ],
  challenges: [],
  outro: [
    "Done. The programme will look small. It's supposed to.",
    "Three sets, six reps, full rest — and if your squat holds while the scale drops, you're doing it perfectly. I'll have your first week ready.",
  ],
};
