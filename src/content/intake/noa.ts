import type { TrainerIntakeScript } from './types';

/**
 * Noa's intake — the gates come first, because her method has real
 * requirements and pretending otherwise would make her position a lie.
 * She is the only trainer with extra questions (sleep, where life is),
 * and the only one whose challenges carry the full flag-and-proceed:
 * she says it plainly, the user decides, Kael hears either way. Never a
 * block, never a silent softening.
 */
export const noaIntake: TrainerIntakeScript = {
  trainerId: 'noa',
  intro: [
    'Before we start, I ask questions. Answer them straight — the plan is built on them, and the plan has a date.',
  ],
  steps: [
    {
      kind: 'choice',
      field: 'days',
      prompt: 'Training days per week. I need four. How many do you actually have?',
      options: [
        { value: 2, label: '2 days', reaction: [] },
        { value: 3, label: '3 days', reaction: [] },
        { value: 4, label: '4 days', reaction: ["Four. Correct. That's the floor, and you're on it."] },
        { value: 5, label: '5 or more', reaction: ['Five. We use four — the fifth is recovery, and recovery is part of the programme, not time off from it.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'sleep',
      prompt: 'How many hours do you actually sleep? Not aspirationally. Actually.',
      options: [
        { value: 'short', label: 'Under 6', reaction: [] },
        { value: 'okay', label: '6 to 7', reaction: ["Six to seven. Workable. We won't waste any of it."] },
        { value: 'good', label: '7 or more', reaction: ['Good. Sleep is where the twelve weeks actually happens — keep it.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'lifeLoad',
      prompt: "Last gate. Where's life right now — steady, full, or genuinely rough?",
      options: [
        { value: 'steady', label: 'Steady', reaction: ['Steady is what this method wants. Good.'] },
        { value: 'full', label: 'Full, but managing', reaction: ['Full is normal. The plan is built to fit inside a full life, not on top of one.'] },
        { value: 'rough', label: 'Honestly — rough', reaction: [] },
      ],
    },
    {
      kind: 'choice',
      field: 'experience',
      prompt: 'Have you trained before? Lifting specifically — it decides where the bar starts.',
      options: [
        { value: 'none', label: 'Never lifted', reaction: ['Never. Fine — the first two weeks teach the movements, then we load. No shortcuts there.'] },
        { value: 'returning', label: 'Long ago', reaction: ['It returns quickly. The body keeps the patterns; we re-earn the weight.'] },
        { value: 'some', label: 'Some', reaction: ["Some. We'll confirm with the bar, not the memory."] },
        { value: 'experienced', label: 'Yes, seriously', reaction: ['Good. Then you know what heavy for a purpose feels like. This is that.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'place',
      prompt: 'Where do you train? The lifting is heavy — I need to know what carries it.',
      options: [
        { value: 'gym', label: 'A gym', reaction: ['A gym. Barbell, rack. Everything the twelve weeks needs.'] },
        { value: 'home', label: 'At home', reaction: ['Home. Then the next answer matters a lot.'] },
        { value: 'outdoors', label: 'Outdoors', reaction: ["Outdoors. The conditioning loves it; the lifting needs a plan. We'll make one."] },
        { value: 'mix', label: 'A mix', reaction: ['A mix. The heavy sessions go wherever the load lives.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'equipment',
      when: (a) => a.place === 'home' || a.place === 'mix',
      prompt: "What's at home to lift?",
      options: [
        { value: 'home-basics', label: 'Dumbbells, bands, maybe a bench', reaction: ["Dumbbells carry the first block. We'll talk about heavier later — the plan will tell us when."] },
        { value: 'bodyweight', label: 'Just me', reaction: ["Bodyweight only. Then we get strict and creative, and protein does extra duty. It's workable — barely, and I'll say so again at week six."] },
      ],
    },
    {
      kind: 'choice',
      field: 'sessionLength',
      prompt: 'Sessions run forty-five to sixty with the heavy work. Can your day hold that?',
      options: [
        { value: 20, label: '~20 minutes', reaction: ['Twenty. Then we split the work differently across the week. Doable — noted, not ideal.'] },
        { value: 30, label: '~30 minutes', reaction: ['Thirty. Tight for the heavy days. We make the rest days carry more.'] },
        { value: 45, label: '~45 minutes', reaction: ['Forty-five. That works.'] },
        { value: 60, label: 'An hour or more', reaction: ['An hour. Good. The bar gets what it needs.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'timeOfDay',
      prompt: 'When? Pick the hour you are strongest, not the one that looks disciplined.',
      options: [
        { value: 'morning', label: 'Morning', reaction: ['Morning. Fine — breakfast becomes part of the programme then.'] },
        { value: 'midday', label: 'Midday', reaction: ['Midday. Works.'] },
        { value: 'evening', label: 'Evening', reaction: ['Evening — most people are strongest there. Sensible.'] },
        { value: 'varies', label: 'It varies', reaction: ['Varies. The weigh-ins stay fixed; the sessions can float.'] },
      ],
    },
    {
      kind: 'freeText',
      field: 'limitations',
      prompt: 'Injuries, pain, movements you have been told to avoid. All of it — the bar and I both need to know.',
      placeholder: 'Injuries, pain, movements to avoid…',
      fallbackAck: ['Noted. The programme loads around it, never through it.'],
      skipLabel: 'Nothing to report',
    },
    {
      kind: 'freeText',
      field: 'notes',
      prompt: 'Anything else that affects twelve weeks — travel, exams, a date that matters. The calendar is part of the plan.',
      placeholder: 'In your own words…',
      fallbackAck: ['Good. It goes on the calendar, then.'],
      skipLabel: 'Nothing else',
    },
  ],
  challenges: [
    {
      id: 'noa-four-day-floor',
      afterField: 'days',
      when: (a) => (a.days ?? 0) < 4,
      lines: [
        "I'll be honest: below four days, my twelve weeks doesn't work as designed — the lifting is what keeps your muscle while the deficit runs, and fewer days won't cover it.",
        "If you want to do this anyway, we adjust and go slower than my usual. But I'd understand if you wanted a coach whose method fits your week — Kael can help you swap.",
      ],
      options: [
        {
          label: 'I can make four work',
          apply: { days: 4 },
          reaction: ['Good. Four it is. Protect them like appointments — because they are.'],
          outcome: 'committed to her four-day floor',
        },
        {
          label: 'Keep my number anyway',
          reaction: ["Understood. We run it adjusted — slower than my usual, same discipline. I'd rather tell you that now than surprise you at week six."],
          outcome: 'proceeding below her four-day floor, adjusted plan',
        },
        {
          label: "I'll think about talking to Kael",
          reaction: ['Fair. Talk to him — no hard feelings. The method mattering is the whole point of having five of us. Until you decide, we train at your number.'],
          outcome: 'may ask Kael about a swap (days below her floor)',
        },
      ],
    },
    {
      id: 'noa-short-sleep',
      afterField: 'sleep',
      when: (a) => a.sleep === 'short',
      lines: [
        "I'll be honest — you're sleeping five hours or less, and that's going to make this harder than it needs to be. A real deficit on no sleep is how people burn out at week four.",
        "If you want to do this anyway, we do it — carefully. But I'd understand if you wanted someone else. Kael can help you swap.",
      ],
      options: [
        {
          label: 'Do it anyway',
          reaction: ["Alright. Then sleep becomes part of the programme — I'll be watching it like protein."],
          outcome: 'proceeding despite short sleep; she is watching it',
        },
        {
          label: 'I might talk to Kael',
          reaction: ["Understood — that's a sound instinct, not a failure. Until you decide, we train. Carefully."],
          outcome: 'may ask Kael about a swap (short sleep)',
        },
      ],
    },
    {
      id: 'noa-rough-stretch',
      afterField: 'lifeLoad',
      when: (a) => a.lifeLoad === 'rough',
      lines: [
        "Then I'll say it plainly: a hard cut during a rough stretch is the wrong tool. It works on the body and costs the person.",
        "If you want to start anyway, we start gentler than my usual and tighten later. But I'd understand if you'd rather wait, or work with someone whose road is softer. Kael can set either up.",
      ],
      options: [
        {
          label: 'Start gentler, now',
          reaction: ['Alright. Gentler start, same honesty. We reassess at week four — out loud, both of us.'],
          outcome: 'proceeding gently through a rough stretch',
        },
        {
          label: "I'll talk to Kael",
          reaction: ['Good decision to consider it. Talk to him. The plan will be here — and so will I.'],
          outcome: 'may ask Kael about a swap (rough stretch of life)',
        },
      ],
    },
  ],
  outro: [
    "Done. That's everything I need.",
    "Twelve weeks. You know the shape: heavy four times a week, protein every day, weigh-ins with numbers you'll know in advance. Mark the end date — it matters more than the start.",
  ],
};
