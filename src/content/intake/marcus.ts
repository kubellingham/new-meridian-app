import type { TrainerIntakeScript } from './types';

/**
 * Marcus's intake — fast, warm, already moving. His "anything else"
 * slot is deliberately the enjoyment question: his whole method runs on
 * you coming back. One challenge: two days fights his rhythm, and he
 * says so — then respects the answer.
 */
export const marcusIntake: TrainerIntakeScript = {
  trainerId: 'marcus',
  intro: [
    "Right! Before I build you anything — quick questions, no wrong answers. Except one, and I'll tell you which when we get there.",
  ],
  steps: [
    {
      kind: 'choice',
      field: 'experience',
      prompt: "Where are you starting from? And 'the sofa' is a real answer — half my best people started there.",
      options: [
        { value: 'none', label: 'Complete beginner', reaction: ['Perfect. No habits to unlearn, no ego to manage. My favourite kind of project.'] },
        { value: 'returning', label: 'Coming back after a break', reaction: ['Welcome back. The engine remembers more than you think — we just have to knock on the door.'] },
        { value: 'some', label: 'On and off', reaction: ['On and off, eh? Right — my job is making "on" the fun bit.'] },
        { value: 'experienced', label: 'I train seriously', reaction: ['Experienced! Good. Prepare to be humbled by a twelve-minute clock anyway.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'place',
      prompt: 'Where are we doing this? I can build a session anywhere with floor space and gravity.',
      options: [
        { value: 'home', label: 'At home', reaction: ["Home! Brilliant. Furniture becomes equipment, neighbours become audience."] },
        { value: 'gym', label: 'A gym', reaction: ['A gym — rowers and ropes and things to pick up. We will use all of it.'] },
        { value: 'outdoors', label: 'Outdoors', reaction: ["Outdoors. Honestly my favourite — hills are free and they never break."] },
        { value: 'mix', label: 'A mix', reaction: ['A mix. Perfect — variety IS the programme with me.'] },
      ],
    },
    {
      kind: 'choice',
      field: 'equipment',
      when: (a) => a.place === 'home' || a.place === 'mix',
      prompt: "What's knocking about at home?",
      options: [
        { value: 'home-basics', label: 'Dumbbells, bands, maybe a bench', reaction: ["Dumbbells and bands? That's a whole gym if you're honest with the clock."] },
        { value: 'bodyweight', label: 'Just me', reaction: ["Just you and gravity. That's how boxers built engines for a hundred years — we're in good company."] },
      ],
    },
    {
      kind: 'choice',
      field: 'days',
      prompt: 'How many days a week can you actually show up? Dream number, then subtract your real life.',
      options: [
        { value: 2, label: '2 days', reaction: [] },
        { value: 3, label: '3 days', reaction: ['Three short sharp ones. We can build a proper rhythm on three.'] },
        { value: 4, label: '4 days', reaction: ["Four! Now we're talking — short ones, thirty-odd minutes, everything you've got."] },
        { value: 5, label: '5 or more', reaction: ["Five. Love the energy — we'll use four hard and keep one easy, because the engine needs oil too."] },
      ],
    },
    {
      kind: 'choice',
      field: 'sessionLength',
      prompt: "How long have you got, honestly? I'd rather have thirty minutes you'll finish than sixty you'll dread.",
      options: [
        { value: 20, label: '~20 minutes', reaction: ['Twenty minutes is two rounds of trouble. Plenty.'] },
        { value: 30, label: '~30 minutes', reaction: ['Thirty — the sweet spot. In, everything you have, out.'] },
        { value: 45, label: '~45 minutes', reaction: ["Forty-five. We'll fill it — you'll wish we hadn't, then you'll come back."] },
        { value: 60, label: 'An hour or more', reaction: ["An hour? I'll take forty of it. The last twenty is for lying on the floor, which I fully endorse."] },
      ],
    },
    {
      kind: 'choice',
      field: 'timeOfDay',
      prompt: 'When do the sessions actually happen?',
      options: [
        { value: 'morning', label: 'Morning', reaction: ['Morning person! The bag barely gets a warm-up before you.'] },
        { value: 'midday', label: 'Midday', reaction: ['Lunchtime rounds. Efficient. Back at your desk smug by one.'] },
        { value: 'evening', label: 'Evening', reaction: ['Evenings — burn the day off. Works.'] },
        { value: 'varies', label: 'It varies', reaction: ["Varies is fine. The clock doesn't care what time it is."] },
      ],
    },
    {
      kind: 'freeText',
      field: 'limitations',
      prompt:
        "Anything that hurts or complains when you move? Knees, back, shoulders — I've got two dodgy knees myself. I plan around parts.",
      placeholder: 'Injuries, pain, movements to avoid…',
      fallbackAck: ["Got it — we work around it, not through it. My knees made me promise that one personally."],
      skipLabel: 'Nothing to flag',
    },
    {
      kind: 'freeText',
      field: 'notes',
      prompt:
        "Last one — the important one. What do you actually enjoy? Football, dancing, hitting things, being outside — tell me, because you coming back IS the method. (This is the one with a wrong answer. The wrong answer is 'nothing'.)",
      placeholder: 'The moving you already like…',
      fallbackAck: ["Love it. That goes straight in the plan — enjoying it isn't a bonus, it IS the programme."],
      skipLabel: "Honestly — nothing yet",
    },
  ],
  challenges: [
    {
      id: 'marcus-two-days',
      afterField: 'days',
      when: (a) => (a.days ?? 0) <= 2,
      lines: [
        "I'll be straight with you: my whole thing runs on rhythm — four short ones beat two long ones every time.",
        "If two is the truth, we'll make two brilliant. But if there are short ones hiding in your week — twenty minutes counts — I want them.",
      ],
      options: [
        {
          label: 'I can find short ones — make it 3',
          apply: { days: 3 },
          reaction: ['YES. Three short ones. The rhythm section is in business.'],
          outcome: 'found a third day for his rhythm',
        },
        {
          label: 'Two is the truth',
          reaction: ["Two brilliant ones it is. Quality over quantity — and I'll make them count double."],
          outcome: 'staying at two days; he adjusted',
        },
      ],
    },
  ],
  outro: [
    "That's me done asking. Here's the deal: short sessions, a clock, and a number to beat.",
    "First one's twelve minutes. You'll be fine. Probably.",
  ],
};
