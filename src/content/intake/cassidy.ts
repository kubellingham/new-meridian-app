import type { TrainerIntakeScript } from './types';

/**
 * Cassidy's intake — she leads with the previous-attempts question
 * because that's her life, not a segment. One challenge: she caps
 * enthusiasm at four days (boring on purpose; the rate is the method).
 */
export const cassidyIntake: TrainerIntakeScript = {
  trainerId: 'cassidy',
  intro: [
    'Alright. A few questions before I build anything — honest answers, they shape everything.',
    "And nothing you say here gets a lecture. I've been on the other side of every answer.",
  ],
  steps: [
    {
      kind: 'choice',
      field: 'experience',
      prompt: "Have you done this before? Not gyms — this. Losing weight on purpose.",
      options: [
        {
          value: 'none',
          label: 'First time',
          reaction: [
            'Good. Then we get to do it right the first time.',
            "No bad habits to unlearn. That's worth more than you'd think.",
          ],
        },
        {
          value: 'returning',
          label: "I've lost it before — it came back",
          reaction: [
            'I lost forty kilos once and watched thirty-four come back. So — no shame here. Just information.',
            "This time we build the version you keep. That's the whole difference.",
          ],
        },
        {
          value: 'some',
          label: 'I train on and off',
          reaction: [
            "On and off is honest. We're going to make the 'on' smaller and steadier — that's how it sticks.",
          ],
        },
        {
          value: 'experienced',
          label: 'I train seriously',
          reaction: ["Good. Then the training isn't the problem we're solving. The pace is."],
        },
      ],
    },
    {
      kind: 'choice',
      field: 'days',
      prompt:
        'How many days a week can you actually give this? Not your best week. A normal one.',
      options: [
        { value: 2, label: '2 days', reaction: ['Two solid days beats four imaginary ones. We start there.'] },
        { value: 3, label: '3 days', reaction: ["Three. That's the plan's home ground."] },
        { value: 4, label: '4 days', reaction: ['Four works — balanced, nothing heroic.'] },
        { value: 5, label: '5 or more', reaction: [] },
      ],
    },
    {
      kind: 'choice',
      field: 'sessionLength',
      prompt: 'How long before a session starts costing you somewhere else — work, kids, sleep?',
      options: [
        { value: 20, label: '~20 minutes', reaction: ['Twenty honest minutes. We can build with that.'] },
        { value: 30, label: '~30 minutes', reaction: ['Thirty. Plenty.'] },
        { value: 45, label: '~45 minutes', reaction: ['Forty-five — room for the whole plan, no rush.'] },
        { value: 60, label: 'An hour or more', reaction: ["An hour. We won't always use it, and that's deliberate."] },
      ],
    },
    {
      kind: 'choice',
      field: 'place',
      prompt: 'Where does training actually happen for you?',
      options: [
        { value: 'home', label: 'At home', reaction: ['Home works. The plan comes to you.'] },
        { value: 'gym', label: 'A gym', reaction: ['A gym. Good — options.'] },
        { value: 'outdoors', label: 'Outdoors', reaction: ['Outdoors. The plan can live there.'] },
        { value: 'mix', label: 'A mix', reaction: ["A mix — then every session gets a home version. No excuses lost to logistics."] },
      ],
    },
    {
      kind: 'choice',
      field: 'equipment',
      when: (a) => a.place === 'home' || a.place === 'mix',
      prompt: "What's at home?",
      options: [
        { value: 'home-basics', label: 'Dumbbells, bands, maybe a bench', reaction: ["That's plenty. More than plenty."] },
        { value: 'bodyweight', label: 'Just me', reaction: ["Just you is enough. It's how I started the second time."] },
      ],
    },
    {
      kind: 'choice',
      field: 'timeOfDay',
      prompt: "When do you actually show up — not when you'd like to?",
      options: [
        { value: 'morning', label: 'Morning', reaction: ['Morning. Before the day gets a vote.'] },
        { value: 'midday', label: 'Midday', reaction: ['Midday works.'] },
        { value: 'evening', label: 'Evening', reaction: ['Evening. Noted — we keep those sessions kind.'] },
        { value: 'varies', label: 'It varies', reaction: ["Varies is fine. The plan flexes; the week doesn't."] },
      ],
    },
    {
      kind: 'freeText',
      field: 'limitations',
      prompt:
        "Anything that hurts, clicks, or has a history? Tell me straight — I'd rather plan around it than find out in week three.",
      placeholder: 'Knees, back, old injuries, movements to avoid…',
      fallbackAck: ['Noted — all of it. We plan around it, not through it.'],
      skipLabel: 'Nothing to flag',
    },
    {
      kind: 'freeText',
      field: 'notes',
      prompt:
        "Last one. Anything else I should know — schedule chaos, a holiday coming, the thing you're quietly worried about?",
      placeholder: 'In your own words…',
      fallbackAck: ['Good to know. It all goes in the plan.'],
      skipLabel: 'Nothing else',
    },
  ],
  challenges: [
    {
      id: 'cassidy-five-days',
      afterField: 'days',
      when: (a) => (a.days ?? 0) >= 5,
      lines: [
        "You can give five. I believe you — and the plan wants three or four. Boring on purpose, remember.",
        'Motivation you don’t spend in the gym is motivation you get to keep. You’ll want it around week three.',
      ],
      options: [
        {
          label: 'Make it four',
          apply: { days: 4 },
          reaction: ['Four. Good call — the kind nobody posts about.'],
          outcome: 'took her advice: four days instead of five',
        },
        {
          label: 'Keep five',
          reaction: ["Alright, five. If it starts feeling like a debt instead of a plan, we talk — before you skip, not after."],
          outcome: 'kept five days against her boring-on-purpose default',
        },
      ],
    },
  ],
  outro: [
    "That's everything I need.",
    "Here's what happens now: I build your first week. Half a kilo a week, training that's almost boring on purpose — and around week three you'll want to go faster. Come talk to me when it happens instead of just doing it.",
    'See you at the first session.',
  ],
};
