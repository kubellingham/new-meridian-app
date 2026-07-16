import type { TrainerIntakeScript } from './types';

/**
 * Priya's intake — days-per-week comes first because it's her actual
 * position, and four-or-more triggers her signature pushback (from her
 * character file, near verbatim). Calm, amused, unbothered; the answers
 * she wants are the November ones, not the impressive ones.
 */
export const priyaIntake: TrainerIntakeScript = {
  trainerId: 'priya',
  intro: [
    "Right. A few questions — and I'm mostly checking how much life you have around the training.",
    "Be honest rather than impressive. I've heard everything, and none of it shocked me.",
  ],
  steps: [
    {
      kind: 'choice',
      field: 'days',
      prompt:
        "How many days a week — and I want the number you'll still be doing in November, not the one that sounds good today.",
      options: [
        { value: 2, label: '2 days', reaction: ['Two. Honest. We can do a great deal with two.'] },
        { value: 3, label: '3 days', reaction: ["Three. Lovely. That's the whole plan, by the way — three."] },
        { value: 4, label: '4 days', reaction: [] },
        { value: 5, label: '5 or more', reaction: [] },
      ],
    },
    {
      kind: 'choice',
      field: 'sessionLength',
      prompt:
        'How long per session, being realistic? Mine cap at twenty-five minutes, and I will cut a session before letting it grow.',
      options: [
        { value: 20, label: '~20 minutes', reaction: ['Twenty. Perfect — under the cap. No negotiation needed.'] },
        { value: 30, label: '~30 minutes', reaction: ["Thirty. We'll use twenty-five of it and you can spend the change."] },
        { value: 45, label: '~45 minutes', reaction: ["Forty-five available, twenty-five used. The maths favours you."] },
        { value: 60, label: 'An hour or more', reaction: ["You can have an hour? Lovely. We'll use twenty-five of it — consistently, which is the point."] },
      ],
    },
    {
      kind: 'choice',
      field: 'place',
      prompt: "Where will this actually happen? And 'wherever the kids aren't' is a valid answer.",
      options: [
        { value: 'home', label: 'At home', reaction: ['Home. Sensible — no commute between you and Tuesday.'] },
        { value: 'gym', label: 'A gym', reaction: ["A gym. Fine — the plan will still have a home version, because Tuesdays happen."] },
        { value: 'outdoors', label: 'Outdoors', reaction: ['Outdoors. Weather-proofing the plan now.'] },
        { value: 'mix', label: 'A mix', reaction: ['A mix. Good — the plan follows you, not the other way round.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'equipment',
      when: (a) => a.place === 'home' || a.place === 'mix',
      prompt: "What's at home? Don't buy anything — the plan needs to work with what's already there.",
      options: [
        { value: 'home-basics', label: 'Dumbbells, bands, maybe a bench', reaction: ['More than enough. The movements barely change anyway — that is a feature.'] },
        { value: 'bodyweight', label: 'Just me', reaction: ['Just you. Perfect. Nothing to set up means nothing to skip.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'timeOfDay',
      prompt: 'When does it actually fit — not when would be ideal?',
      options: [
        { value: 'morning', label: 'Morning', reaction: ['Morning. Done before life notices.'] },
        { value: 'midday', label: 'Midday', reaction: ['Midday. Works.'] },
        { value: 'evening', label: 'Evening', reaction: ["Evening. Fine — we keep those sessions short enough to survive tiredness."] },
        { value: 'varies', label: 'It varies', reaction: ["Varies. That's most people's truth. The plan is built for it."] },
      ],
    },
    {
      kind: 'choice',
      field: 'experience',
      prompt: 'How much training have you done before? Any honest answer works here.',
      options: [
        { value: 'none', label: 'Complete beginner', reaction: ['A beginner. Good — you get the gentle version of everything, on purpose.'] },
        { value: 'returning', label: 'Coming back after a break', reaction: ["Coming back. Then you already know the hard part isn't the exercises — it's the showing up. We plan for that."] },
        { value: 'some', label: 'On and off', reaction: ['On and off usually means the plans were too big. Mine will annoy you by being small. Trust the small.'] },
        { value: 'experienced', label: 'I train seriously', reaction: ["Seriously trained, excellent. You'll find my plan insultingly easy for about three weeks. Then you'll notice you haven't missed a session."] },
      ],
    },
    {
      kind: 'freeText',
      field: 'limitations',
      prompt:
        'Anything that hurts, or that a physio has ever frowned about? Eleven years in the NHS — nothing you write here will be new to me.',
      placeholder: 'Injuries, pain, movements to avoid…',
      fallbackAck: ['Noted, all of it. The plan bends around bodies. That is what plans are for.'],
      skipLabel: 'Nothing to flag',
    },
    {
      kind: 'freeText',
      field: 'notes',
      prompt:
        'Anything else I should know? Shift work, small humans, a dog that eats routine — the plan has to survive your actual life.',
      placeholder: 'In your own words…',
      fallbackAck: ['Good to know. It goes in the plan — the boring, doable plan.'],
      skipLabel: 'Nothing else',
    },
  ],
  challenges: [
    {
      id: 'priya-four-days',
      afterField: 'days',
      when: (a) => (a.days ?? 0) >= 4,
      lines: [
        'You want to give me four or more. I believe you — this month.',
        "Don't. Do three weeks of three before you talk to me about four. Optimal, you'd quit. Three, you'll still be doing next year.",
      ],
      options: [
        {
          label: 'Start with three',
          apply: { days: 3 },
          reaction: ["Sensible. And it'll still be there on Wednesday if Tuesday goes sideways."],
          outcome: 'accepted her three-days start',
        },
        {
          label: 'Keep my number',
          reaction: ["Alright. Your number it is — and if week three gets loud, we drop to three and absolutely nothing is lost."],
          outcome: 'kept four-plus days over her three-day position',
        },
      ],
    },
  ],
  outro: [
    "That's everything.",
    "Twenty-five minutes, the same movements every time, and nothing to make up for when life happens. I'll have your first week ready — it won't be impressive, and that's the design.",
  ],
};
