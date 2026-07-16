/**
 * The onboarding script, as data — a linear walk of beats Kael and Sera
 * narrate to assemble the user's team and collect exactly what the app
 * needs to run. Text-forward (no voice-over, no portraits). Kael/Sera
 * lines originate from Meridian_Weight_Loss_Onboarding_Script_v1.md;
 * the weight-loss trainer content follows Trainer Roster v1
 * (docs/Meridian_Weight_Loss_Trainer_Roster_v1.md); the dormant
 * build-muscle and general-fitness branches were drafted here with the
 * same conventions. All copy is pre-written and static — the Claude API
 * only takes over once the user is in the product (script principle
 * #6). {NAME}, {TRAINER}, {NS} tokens are interpolated by the
 * controller.
 *
 * One parameterized flow: `buildOnboardingFlow(goal)`. Every goal shares
 * the same beat sequence; only Kael's goal reactions, the numbers beat,
 * and his trainer-roster framing differ. The prefix up to and including
 * the goal question is identical across goals, so the controller can
 * rebuild the flow when the goal answer lands without invalidating the
 * current step index.
 *
 * MVP scoping vs. the source script: Phase 0 (language + ToS) skipped,
 * Phase 5 widget-picker replaced by the default Home layout, Phase 6
 * auth/trial reduced to honest local-only framing. The weight-loss
 * trainer intros/commits and Elena's are transcribed from the script;
 * every other specialist's are drafted to their locked voice.
 */

import type { CharacterId } from '@/src/content/characters';
import type { PrimaryGoal } from '@/src/types/user-data';

/** Where a collected answer is destined — mapped to stores at finish. */
export type OnboardingField =
  | 'name'
  | 'birthday'
  | 'gender'
  | 'goal'
  | 'activity'
  | 'whyNow'
  | 'feeling'
  | 'coaching';

/** One numeric field in the Phase 1 numbers beat. */
export interface NumberField {
  key: 'height' | 'startingWeight' | 'goalWeight';
  label: string;
  unit: string;
  placeholder: string;
  /** Optional fields may be left blank (general fitness's goal weight). */
  optional?: boolean;
}

/** A tappable card in a choice beat, with the speaker's reaction to it. */
export interface CardOption {
  value: string;
  label: string;
  hint?: string;
  /** What the speaker says once this card is chosen. */
  reaction: string[];
  /** Shown but not selectable — out of V1 scope. */
  disabled?: boolean;
  disabledNote?: string;
}

/** The free-text escape hatch on the "feeling" beat ("Something else"). */
export interface FreeTextOption {
  label: string;
  placeholder: string;
  reaction: string[];
}

/** One step of the onboarding flow. */
export type OnboardingBeat =
  | { kind: 'say'; speaker: CharacterId; lines: string[]; skippable?: boolean }
  | {
      kind: 'text';
      speaker: CharacterId;
      field: 'name';
      prompt: string;
      placeholder: string;
      ack: string[];
    }
  | { kind: 'date'; speaker: CharacterId; field: 'birthday'; prompt: string; ack: string[] }
  | { kind: 'numbers'; speaker: CharacterId; prompt: string; fields: NumberField[]; ack: string[] }
  | {
      kind: 'cards';
      speaker: CharacterId;
      field: OnboardingField;
      prompt: string;
      options: CardOption[];
      freeText?: FreeTextOption;
    }
  | {
      kind: 'roster';
      speaker: CharacterId;
      role: 'trainer' | 'nutrition-specialist';
      field: 'trainer' | 'ns';
      prompt: string;
    }
  | { kind: 'finish'; speaker: CharacterId; lines: string[]; buttonLabel: string };

/** A specialist's onboarding intro and commit line, in their voice. */
export interface SpecialistOnboarding {
  intro: string[];
  commit: string[];
}

/**
 * Intro + commit lines shown when a trainer or NS card is opened in the
 * roster. Weight-loss trainers follow Trainer Roster v1 (the philosophy
 * is in the prescription — each intro states the actual plan); other
 * trainers and Elena are transcribed from the locked script; the
 * remaining seven NS are drafted to each character's voice (Golden Test:
 * culture is the lens, not the menu).
 */
export const SPECIALIST_ONBOARDING: Record<CharacterId, SpecialistOnboarding> = {
  // Consultants never appear in a roster — present for type completeness.
  kael: { intro: [], commit: [] },
  sera: { intro: [], commit: [] },

  // — Weight-loss trainers (Trainer Roster v1: philosophy is in the
  //   prescription — each intro states the actual plan and lets it argue) —
  cassidy: {
    intro: [
      'Hi, {NAME}.',
      "I'm Cassidy. I lost forty kilos, and I've kept it off six years. The way I did that is the only way I coach: half a kilo a week. I know. I know how that sounds.",
      "Here's the plan you'd get from me. A deficit small enough you can live in it — three, four hundred calories, never more. Diet breaks scheduled in advance, not handed out as rewards. Training three or four days a week — balanced, a little boring, on purpose.",
      "You'll want to go faster around week three. Everyone does. Come talk to me when it happens instead of just doing it.",
      'Take your time choosing. Meet the others. The right fit is the one you trust when the scale is quiet.',
    ],
    commit: [
      'Alright, {NAME}. We do this once, and we do it right.',
      "I'll see you in the Training Hub. First job: your rate — in kilos, out loud.",
    ],
  },
  // Retired (Roster v1) — never offered on a roster; entries kept empty
  // because the record is exhaustive over CharacterId.
  tobias: { intro: [], commit: [] },
  marco: { intro: [], commit: [] },
  renata: {
    intro: [
      'Hello, {NAME}. Renata.',
      "Here's my whole programme, so you can decide quickly. Three sessions a week, full body. Squat, hinge, press, pull, carry. Four to six reps, two or three sets, full rest in between. Protein at two grams per kilo. Then you go home.",
      "It will look small. It's supposed to. Your diet does the losing; the training keeps your muscle while it happens. If your squat holds while the scale drops, you did it perfectly.",
      "I rowed twice a day for nine years and stayed exactly the same weight. So I've tested the alternative more thoroughly than most.",
      "Meet the others — take your time. I'll say this once: small and consistent beats impressive and abandoned.",
    ],
    commit: [
      "Good. A sensible decision, efficiently made — we'll get along.",
      "Training Hub when you're ready. Bring nothing. The programme is already short.",
    ],
  },
  marcus: {
    intro: [
      'Alright, {NAME}! Marcus.',
      "Manchester, boxing gyms, and these days a warehouse with no mirrors in it — that last part's deliberate. The mirror tells you what you look like. I'd rather you found out what you can do.",
      "With me it's four or five sessions a week, thirty to forty minutes. Kettlebells, sleds, rounds on the bag, rowing intervals. You do twelve minutes of work, and next week you beat it. That's the whole progression. Don't overthink it.",
      "Fair warning — I'm not selling you calorie burn. The diet handles the weight. I'm building you an engine: stairs, football with the kids, a body that can work.",
      "Go meet the rest — they're brilliant. Pick whoever gets you moving.",
    ],
    commit: [
      'Yes! Come find me in the Training Hub.',
      "First session's twelve minutes. You'll be fine. Probably.",
    ],
  },
  priya: {
    intro: [
      'Hello, {NAME}.',
      "I'm Priya. Twenty-five minutes, three times a week. That's the plan. I know it doesn't feel like enough. It isn't enough — it's just enough that you'll actually do it, which is a completely different thing.",
      'Four or five movements that never change, a do-it-at-home version of everything, and progression so boring you barely notice it happening. I spent eleven years as a physiotherapist writing perfect programmes for people who did none of them. I stopped.',
      "And I'll say this plainly, because it isn't a secret: this is less than optimal, on purpose. Optimal, you'd quit. This, you'll still be doing next year.",
      'Meet the others — genuinely. If a bigger plan fits your life, one of them is the better pick.',
    ],
    commit: [
      "Lovely. Three sessions, twenty-five minutes, and you never have to be impressive.",
      "Training Hub whenever suits. It'll still be there Wednesday if Tuesday goes sideways.",
    ],
  },
  noa: {
    intro: [
      'Hello, {NAME}. Noa.',
      "Here's my offer, complete. Twelve weeks. Not twelve weeks and we'll see — twelve weeks, and then we stop, and then I teach you the harder part, which is keeping it.",
      "The deficit is real and you will be hungry. I won't pretend otherwise and I won't apologize for it. You'll lift heavy four times a week and hit your protein every day — that's what decides whether you keep your muscle or just get smaller. Weigh-ins weekly, against numbers I've given you in advance.",
      "One thing before you choose me: I don't take everyone. If you're barely sleeping, or life is rough right now, I'll say so and walk you to a colleague myself. This method needs a stable base.",
      "Meet the others. If you want the long road, they're excellent at it. If you want an edge you can see — that's me.",
    ],
    commit: [
      'Good. Twelve weeks. Mark the end date now — it matters more than the start.',
      'Training Hub. We begin with your numbers, not a pep talk.',
    ],
  },
  ananya: {
    intro: [
      'Hello, {NAME}.',
      "I'm Ananya. I competed in physique sport for eight years, and I spent all of them collecting the questions nobody would answer properly — why this rep range, why this rest, why does everyone promise six weeks when the truth is seasons. So I studied the science and answered them myself. That's what you get with me: hypertrophy the way it actually works.",
      "How I work — muscle is built in the quiet weeks. The unglamorous middle where the numbers creep up and the mirror says nothing yet. My job is keeping you loading the bar through that silence, and explaining the why in one clean line whenever you want it.",
      "And one promise up front: no myths survive here. Accha? Take your time. Meet the others. The right coach is the one whose pace you trust.",
    ],
    commit: [
      "Good choice, {NAME}. We'll build this properly.",
      "I'll see you in the Training Hub. Bring your patience — I'll bring everything else.",
    ],
  },
  dmitri: {
    intro: [
      'Hello, {NAME}.',
      "Dmitri. Thirty years under the bar — a basement gym in Prague, concrete floor, plates that didn't match. I've coached first-timers and national lifters, and the method never changed. Squat, press, pull, hinge. Heavy enough to matter. Light enough to repeat. For years.",
      "How I work: few words, exact ones. I will remember every number you ever lift. When I say a thing is good, it is good. The bar teaches patience, and muscle is what patience looks like on a body.",
      'Meet the others. Choose with your gut. It usually knows.',
    ],
    commit: ['Dobře. We start simple, and we do not stop.', 'The Training Hub. I will be there.'],
  },
  kofi: {
    intro: [
      'Hey, {NAME}!',
      "I'm Kofi, from Accra. I was a sprinter — 200 metres, national programme, honest about my ceiling — and what I kept from that life is the athlete's secret: strong is a skill. You practice it. You don't suffer it.",
      "So with me, building muscle looks like sport. Move well first, then move heavy, then move heavy fast. I will ask for one more set and mean it — because I respect you enough to believe you have it. And when a lift moves well? We celebrate. Loudly. That part is not optional.",
      'Go meet the others, chale. Pick whoever makes you want to start today.',
    ],
    commit: [
      "YES. Good decision, {NAME}. We're going to build something strong.",
      'Training Hub — come find me. Bring intent.',
    ],
  },
  amara: {
    intro: [
      'Hello, {NAME}. Come, sit.',
      "I'm Amara. Before coaching, I was a physiotherapist in Nairobi — I met people on the worst day of their bodies. The put-out back. The knee that gave. And almost all of it, almost every time, was preventable. So I left the clinic and started building people who never need one.",
      "How I work: I train you for the life outside the gym. The stairs, the shopping, the floor you can get up from at seventy without a plan. Strength, a heart that climbs hills without drama, and a body that keeps its promises. Pole pole — slowly, properly.",
      'Meet the others if you like. Choose the one whose ten-year picture looks like yours.',
    ],
    commit: [
      'Sawa, {NAME}. This is going to be good.',
      "Find me in the Training Hub. We start where you are, with what you have.",
    ],
  },
  ingrid: {
    intro: [
      'Hello, {NAME}.',
      "Ingrid. I skied to school in winter, raced cross-country through my twenties, and kept the life when the racing ended. What that sport teaches you is the truth about fitness: the engine is built slowly, mostly at easy pace, in all weather.",
      "How I work: mostly outside, mostly easy, never zero. Walks that count more than they feel like they count. Simple strength twice a week. No drama in either direction — a storm is just weather, a missed week is just a missed week. The plan waits for you.",
      'Meet the others. Take your time. Deciding well is also training.',
    ],
    commit: ['Greit. Settled, {NAME}.', 'The Training Hub, whenever you are ready. Dress for the weather.'],
  },
  sam: {
    intro: [
      'Hey, {NAME}. Good to meet you.',
      "I'm Sam — Vancouver, kinesiology degree, decade of coaching people with jobs, kids, commutes, and seventeen browser tabs of guilt about not exercising. Also rec-league everything. My knees sound like a stapler. I still squat.",
      "Here's my whole thing: nobody fails at fitness because the workout was wrong. They fail because it didn't fit the week. So I build training that fits YOUR week — the real one, not the fantasy one. Ten honest minutes beats sixty imaginary ones, every time.",
      "Meet the others, no pressure. Pick whoever you'd actually text back.",
    ],
    commit: [
      "Nice. Okay, {NAME} — let's make this easy to keep.",
      "Training Hub when you're ready. First job: figuring out your Tuesday.",
    ],
  },

  // — Nutrition specialists —
  nneka: {
    intro: [
      '{NAME}. Hello — good to meet you.',
      "I'm Nneka. I grew up in Lagos, in a house where the food never stopped and nobody ate alone — jollof, egusi, beans, plantain, yam. Then I studied nutrition and spent years watching people be told that same food was the problem. So I built my practice to prove what my grandmother already knew: the food isn't the enemy. Portions, timing — those we can talk about. The food itself carries good sense.",
      "Here's how I work. I'm not going to take your own food away and hand you some foreign plan — that's the opposite of the point. I work with whatever you actually eat. I just bring a West African eye to it: honest portions, real fuel, no shame. We get where you're going with your food, not in spite of it.",
      'Meet the others if you like, my dear. No wahala. The right one is whoever you keep wanting to talk to.',
    ],
    commit: [
      "Ah, good. We're going to do this well together.",
      "Come find me in the Diet Corner — anything you eat, anything you're wondering about, bring it. Small small, every day. I'll be there.",
    ],
  },
  kavya: {
    intro: [
      'Haan — hello, {NAME}. Good to meet you.',
      "I'm Kavya, from Delhi. I grew up between my mother's kitchen and one stubborn question: why does everyone treat roti like the enemy and a protein bar like medicine? I studied nutrition to answer it properly — and the answer made me sharper. Dal and rice make a complete protein. Curd was probiotic before anyone put the word on a label. Everyday Indian food, balanced the way households have balanced it for centuries, already works.",
      "So here's how I work. I'm not taking your food away to give you sad diet plates — bas, no. I work with whatever you actually eat. I bring the why to it: what's already good on your plate, what's quietly costing you, where the small fix is. We get you there through your food, not around it.",
      'Meet the others if you want, beta. The right one is whoever you keep coming back to.',
    ],
    commit: [
      "Haan. Good — let's do this properly, together.",
      "Come find me in the Diet Corner. Anything you eat, anything you've been told and never believed — bring it to me.",
    ],
  },
  haruki: {
    intro: [
      'Hello, {NAME}.',
      "I'm Haruki. Kyoto. I grew up with small meals — fish, rice, miso, something green. Nothing extra, nothing missing. I studied nutrition and found the science mostly agreed with my grandmother's table. So that is how I work. Simply.",
      'I will not replace your food with mine. I work with whatever you eat. I bring one thing to it — balance you can feel, not count. A good plate needs no defending. We build those, quietly, and the goal follows.',
      'Meet the others if you wish. The right one is the one you keep returning to. No rush.',
    ],
    commit: [
      'Good. We will work well together.',
      "I'll be in the Diet Corner. Bring me what you eat — one plate at a time. That is enough.",
    ],
  },
  sofia: {
    intro: [
      '¡Hola, {NAME}! Qué gusto — so good to meet you.',
      "I'm Sofía, from Guadalajara. My family's kitchen never stopped — beans on the stove, tortillas by hand, salsa from whatever the market had. I studied nutrition and came home a little angry: the world had turned my food into a diet villain and sold sad bowls of nothing as 'health.' So my practice is the correction. Beans and corn are one of the oldest complete proteins on earth. Real Mexican food, built the way it's always been built, is on your side.",
      "So this is how I work, cariño. I'm not going to take your food away — never. I work with whatever you actually eat. I bring my eye to it: what's already beautiful on your plate, and the one or two things we gently adjust. We reach your goal and we enjoy the food. Both. Always both.",
      'Ándale — meet the others if you like. The right one is whoever you keep wanting to hear from.',
    ],
    commit: [
      '¡Sí! Qué bueno. We are going to enjoy this together, cariño.',
      "Come find me in the Diet Corner — anything you eat, anything you love, bring it. I'll be right there.",
    ],
  },
  yasmin: {
    intro: [
      'Hello, {NAME}. A pleasure.',
      "I'm Yasmin, from Beirut. I grew up at a table that never seemed to end — hummus, tabbouleh, labneh, olive oil over everything, food meant to be shared and lingered over. I studied nutrition abroad and watched the industry slowly 'discover' what my grandmother's table always knew: legumes, herbs, olive oil, vegetables at the center. I came home with credentials and a little amusement. My cuisine never needed rescuing. Only recognizing.",
      "So, how I work. I won't hand you a plan of only Lebanese food and take your own away — that would miss the point entirely. I work with whatever you eat. I bring my eye to it: elegance and health were never opposites, and most of what you enjoy is already working in your favor. We find the one thing that isn't, and adjust it gently.",
      "Meet the others if you'd like, habibti. The right one is whoever you keep wanting to return to.",
    ],
    commit: [
      "Lovely. Yalla — we'll do this beautifully, together.",
      "I'll be in the Diet Corner. Bring me anything you eat, anything you're curious about. I'll be there, habibti.",
    ],
  },
  elena: {
    intro: [
      'Yia sou, {NAME}. Hello.',
      "I'm Elena. I grew up on my family's olive farm in Greece — every meal of my childhood was built around what was growing that season. Tomatoes in summer, oranges in winter, olives always. I studied nutrition because I wanted to understand why the food I grew up with was so good for you. Turns out the science agrees with the grandmothers. Usually does.",
      "Here's how I work. I'm not going to make you eat only Greek food. I work with whatever you actually eat — that's the whole point of meeting you where you are. But the way I think about food comes from my tradition: seasonal, simple, joyful, shared. I'll bring that lens to whatever you put in front of me.",
      "And one more thing — I won't make food a chore. The Mediterranean way is that eating is one of life's actual pleasures. We can reach your goal, build a body you love, and enjoy what's on your plate. Anyone telling you those three can't happen together hasn't been to Greece.",
      "Meet the others if you'd like. The right one for you is whoever you keep wanting to hear from.",
    ],
    commit: [
      'Yes. Good, {NAME}. We are going to enjoy this together.',
      "I'll see you in the Diet Corner. Come find me when you want to talk about food — anything you eat, anything you're curious about, anything you've been told and never quite believed. I'll be there.",
    ],
  },
  jordan: {
    intro: [
      'Hey, {NAME}. Good to meet you.',
      "I'm Jordan. Austin, Texas. I grew up on BBQ, Tex-Mex, drive-thrus, and church potlucks — the actual American food landscape, not the wellness-magazine version. Then I studied nutrition and spent years coaching regular people: folks who eat out constantly, snack at their desks, and have been made to feel guilty about all of it. I don't do the guilt. I work with reality — your schedule, your budget, your actual taste buds.",
      "So here's the deal. I'm not here to change what you eat. I'm here to change how you think about it. I work with whatever's already on your plate, and we make it a little better than last month, most of the time. That's the whole trick, and it's the one that lasts.",
      "Go meet the others if you want — no pressure. The right fit's the one you keep wanting to talk to.",
    ],
    commit: [
      "Alright — cool. Let's do this.",
      "Come find me in the Diet Corner. Whatever you eat, log it, bring it — no confession booth. I've got you.",
    ],
  },
  'mei-lin': {
    intro: [
      "Hello, {NAME}. Good — let's meet properly.",
      "I'm Mei Lin, from Chengdu, a city that takes food as seriously as anywhere on earth. I grew up between my grandmother's medicinal soups and the roar of Sichuan peppercorns, and I learned early that Chinese cooking is a whole philosophy: balance of flavors, balance of temperaments, food as daily medicine. I studied nutrition formally and found it half catching up to what my tradition systematized centuries ago.",
      "So this is how I work. I won't replace your food with mine — that's not the point. I work with whatever you eat. But I bring one conviction to it: if the food has no soul, the plan has no future. People abandon joyless eating every time. So we keep the flavor and reach the goal. That isn't a contradiction — it's the strategy.",
      'Hm — meet the others if you like. The right one is whoever you keep wanting to hear from.',
    ],
    commit: [
      "Good. We're going to do this properly — with flavor.",
      "Find me in the Diet Corner. Bring me what you eat, and we'll balance it together. I'll be there.",
    ],
  },
};

/**
 * Cuisine tradition per nutrition specialist — seeds
 * `userProfile.culturalBackground` from the NS choice so the team has a
 * cultural read from day one (the NS refines it during their own intake).
 */
export const NS_TRADITION: Partial<Record<CharacterId, string>> = {
  nneka: 'West African',
  kavya: 'South Asian',
  haruki: 'Japanese',
  sofia: 'Mexican',
  yasmin: 'Middle Eastern (Lebanese)',
  elena: 'Mediterranean (Greek)',
  jordan: 'American',
  'mei-lin': 'Chinese',
};

/**
 * Weight-loss-first pivot: the muscle and general-fitness goals are
 * dormant — shown on the goal card so the product's shape is honest,
 * but not selectable. Existing users who picked them keep working;
 * new users all start on weight loss.
 */
const DORMANT_GOAL_NOTE = 'Paused — Meridian is all-in on weight loss right now.';

/**
 * Beats shared by every goal, up through the activity question. The goal
 * card beat lives here (its reactions differ per card, not per flow), so
 * the prefix is identical whichever goal the user ends up picking.
 */
const OPENING_BEATS: OnboardingBeat[] = [
  // — PHASE 1: Kael, welcome + core data —
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      'Hey.',
      "I'm Kael. Welcome to Meridian.",
      "Meridian's a team of specialists — the best at what they do — who came together to make their expertise personal. That team, starting now, is yours.",
      "I just need a few basics before I bring everyone in. Won't take long.",
    ],
  },
  {
    kind: 'text',
    speaker: 'kael',
    field: 'name',
    prompt: 'What should I call you?',
    placeholder: 'Your name',
    ack: ['{NAME}. Good to meet you.'],
  },
  {
    kind: 'date',
    speaker: 'kael',
    field: 'birthday',
    prompt: "When's your birthday?",
    ack: ['Got it. Noted.'],
  },
  {
    kind: 'cards',
    speaker: 'kael',
    field: 'gender',
    prompt: 'How do you identify?',
    options: [
      { value: 'male', label: 'Male', reaction: ['Got it.'] },
      { value: 'female', label: 'Female', reaction: ['Got it.'] },
      { value: 'non-binary', label: 'Non-binary', reaction: ['Got it.'] },
      { value: 'prefer-not', label: 'Prefer not to say', reaction: ['Got it.'] },
    ],
  },
  {
    kind: 'cards',
    speaker: 'kael',
    field: 'goal',
    prompt:
      'Okay, {NAME}. This one shapes everything we set up for you. Fair warning — right now Meridian does one thing properly: weight loss. The other paths are parked, not gone.',
    options: [
      {
        value: 'weight-loss',
        label: 'Lose weight',
        // Kael has no favorite method (roster doc: recommendations are
        // fit-based, never quality-based) — this line must sit equally
        // in front of all five coaches, Noa included.
        reaction: [
          "Okay. That's a real one.",
          "We'll set you up properly. How it gets done — that's between you and the coach you pick.",
        ],
      },
      // Dormant goals (weight-loss-first pivot): visible so the product's
      // shape is honest, not selectable. Reactions kept for the day they
      // reopen; existing users on these goals are untouched elsewhere.
      {
        value: 'build-muscle',
        label: 'Build muscle',
        disabled: true,
        disabledNote: DORMANT_GOAL_NOTE,
        reaction: [
          'Building muscle. Good.',
          "That's a patient game — the kind that rewards structure. Structure is what I do.",
        ],
      },
      {
        value: 'general-fitness',
        label: 'General fitness',
        disabled: true,
        disabledNote: DORMANT_GOAL_NOTE,
        reaction: [
          'General fitness. Honestly — underrated answer.',
          'Strong, mobile, durable. Everything else in life gets easier from there. We build the base properly.',
        ],
      },
    ],
  },
  {
    kind: 'cards',
    speaker: 'kael',
    field: 'activity',
    prompt: 'Quick one — how active is your day-to-day, outside of any workouts?',
    options: [
      {
        value: 'sedentary',
        label: 'Sedentary',
        hint: 'Mostly sitting through the day',
        reaction: ["Okay. Then we make the movement we do add count."],
      },
      {
        value: 'light',
        label: 'Lightly active',
        hint: 'Some walking, light movement',
        reaction: ['Right. That helps.'],
      },
      {
        value: 'moderate',
        label: 'Moderately active',
        hint: 'On my feet, regular movement',
        reaction: ["Good. That gives us something to build on."],
      },
      {
        value: 'active',
        label: 'Very active',
        hint: 'Physical job or hard daily training',
        reaction: ["Strong. I'll account for that so we don't overcook the week."],
      },
    ],
  },
];

/**
 * Kael's numbers beat, shaped per goal: weight loss aims below the
 * current weight, muscle building targets at or above it, and general
 * fitness treats a weight target as optional — consistency is the goal.
 */
function numbersBeat(goal: PrimaryGoal): OnboardingBeat {
  const height: NumberField = { key: 'height', label: 'Height', unit: 'cm', placeholder: 'e.g. 175' };
  const current: NumberField = {
    key: 'startingWeight',
    label: 'Current weight',
    unit: 'kg',
    placeholder: 'e.g. 82',
  };
  const goalWeight: NumberField = {
    key: 'goalWeight',
    label: goal === 'build-muscle' ? 'Target weight' : 'Goal weight',
    unit: 'kg',
    placeholder: goal === 'build-muscle' ? 'e.g. 86' : 'e.g. 74',
    optional: goal === 'general-fitness',
  };
  return {
    kind: 'numbers',
    speaker: 'kael',
    prompt:
      goal === 'general-fitness'
        ? "A couple of numbers and I've got what I need to set your targets. A goal weight is optional here — skip it if you don't have one."
        : "A couple of numbers and I've got what I need to set your targets.",
    fields: [height, current, goalWeight],
    ack: ["Good. That's everything I need."],
  };
}

/** Sera's section plus the hand-back — identical for every goal. */
const SERA_BEATS: OnboardingBeat[] = [
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      "Before I bring your team in, there's one more person I want you to meet first. She covers the part I don't.",
      'Sera.',
    ],
  },

  // — PHASE 2: Sera, emotional + behavioral —
  {
    kind: 'say',
    speaker: 'sera',
    skippable: true,
    lines: [
      'Hey, {NAME}.',
      'Kael handles your schedule, your data, all the structure of this. I handle the other side — how you’re actually feeling, what’s underneath the goal, the habits that quietly run everything. That part.',
    ],
  },
  {
    kind: 'cards',
    speaker: 'sera',
    field: 'whyNow',
    prompt: 'Quick question, {NAME} — honest answer, not the polished one. Why now?',
    options: [
      {
        value: "It's been building for a while",
        label: "It's been building for a while",
        reaction: [
          "Mm. Yeah. That's how it usually is, honestly. Months of small thoughts, then one day you're just ready. Or ready enough. That's a real place to start from.",
        ],
      },
      {
        value: 'Something specific happened',
        label: 'Something specific happened',
        reaction: [
          "Okay. Sometimes it takes that. Not always, but sometimes. We'll work with where it brought you, not where it came from.",
        ],
      },
      {
        value: "I'm ready and that's enough",
        label: "I'm ready and that's enough",
        reaction: [
          "Good. That's actually... yeah, that's enough. Not everyone walks in with that. We'll use it.",
        ],
      },
      {
        value: "Honestly, I'm not sure",
        label: "Honestly, I'm not sure",
        reaction: [
          "That's a fair answer. We'll figure it out as we go — sometimes the reason becomes clearer once you start moving. Don't worry about naming it today.",
        ],
      },
    ],
  },
  {
    kind: 'cards',
    speaker: 'sera',
    field: 'feeling',
    prompt: 'How are you feeling, right now, about where you’re starting from?',
    options: [
      {
        value: 'Frustrated',
        label: 'Frustrated',
        reaction: [
          "Okay. That's worth naming. Frustration usually means you've tried before and something didn't stick. We'll figure out what.",
        ],
      },
      {
        value: 'Hopeful',
        label: 'Hopeful',
        reaction: [
          "Good. Hopeful is one of the best ways to walk in here. Means you haven't been broken by previous attempts — or you have, and you put yourself back together enough to try again. That matters.",
        ],
      },
      {
        value: 'Tired of trying',
        label: 'Tired of trying',
        reaction: [
          "Mm. Yeah. I hear that a lot, and I take it seriously. We're going to do this differently than whatever you tried before. That's a promise.",
        ],
      },
      {
        value: 'Honestly, just ready',
        label: 'Honestly, just ready',
        reaction: ["Then let's go. That's the right energy."],
      },
    ],
    freeText: {
      label: 'Something else',
      placeholder: 'In your own words…',
      reaction: [
        "Okay. Thank you for putting it in your own words — that tells me more than any of the tidy options would. I'll hold onto it.",
      ],
    },
  },
  {
    kind: 'cards',
    speaker: 'sera',
    field: 'coaching',
    prompt: 'Last one, {NAME}. When things get hard — and they will — what do you need from us?',
    options: [
      {
        value: 'push',
        label: "Push me. Don't let me off easy.",
        reaction: ["Got it. Direct it is. I'll match that — and so will your trainer."],
      },
      {
        value: 'support',
        label: 'Support me. I respond better to encouragement.',
        reaction: ["Okay. Encouragement-led. That's a real style and a valid one — we'll lean that way."],
      },
      {
        value: 'both',
        label: 'A bit of both, depending on the moment.',
        reaction: ["That's most people, honestly. I'll read the room."],
      },
      {
        value: 'read-as-we-go',
        label: "I'm not sure yet — read me as we go.",
        reaction: [
          "Honestly, that's the most self-aware answer you could give me. Most people pick one and they're wrong about themselves. Letting me read you means I'll get it right — because I'll be paying attention.",
        ],
      },
    ],
  },
  {
    kind: 'say',
    speaker: 'sera',
    skippable: true,
    lines: [
      "Alright. That's what I needed for now. I'll be around — quieter than Kael usually, but always there when you need me. And sometimes when you don't realize you do.",
      'Kael — back to you.',
    ],
  },

];

/** What Kael says the user told him, per goal — his roster framing. */
const GOAL_FRAMING: Record<PrimaryGoal, string> = {
  'weight-loss': 'losing weight, building this into a lifestyle',
  'build-muscle': 'building muscle, doing it properly',
  'general-fitness': 'building all-round fitness you keep',
};

/**
 * Kael frames the trainer choice — the one goal-dependent beat of
 * Phase 3. Weight loss gets the Roster v1 framing: five coaches who
 * genuinely disagree about the road, which is why the user chooses.
 */
function trainerFramingBeat(goal: PrimaryGoal): OnboardingBeat {
  if (goal === 'weight-loss') {
    // The shape lines draw on each trainer's projectionProfile
    // ratePhilosophyNote (src/content/characters/*.ts) — Kael describes
    // how each coach works, in his own voice. Rules: rate numbers attach
    // only to a coach's method, never to the user (no outcome data, no
    // fabricated projections); no ranking; the non-rate positions
    // (Renata/Marcus/Priya) read as positions, never as evasions.
    return {
      kind: 'say',
      speaker: 'kael',
      skippable: true,
      lines: [
        'Alright. Now we put the rest of your team together. First — your trainer.',
        "Five of my people do weight loss, and they don't agree with each other about how. I want to be upfront about that, because it's not a flaw in the roster.",
        "The shapes are genuinely different. Cassidy works at about half a kilo a week, open-ended — a long project, and she'd tell you that's the point. Noa works in twelve-week blocks at a real pace, and then stops. On purpose.",
        "Renata, Marcus, and Priya don't run on the scale at all — for them it's whether your strength holds, what your body can do, whether you're still training next year. The weight follows.",
        "They all get people to the same place. They just don't agree on the road — that's why you get to choose. Meet whoever you like; the right one is whoever feels right to you, not whoever I think is best on paper.",
      ],
    };
  }
  return {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      'Alright. Now we put the rest of your team together. First — your trainer.',
      `Based on what you've told us — ${GOAL_FRAMING[goal]} — I've got three people I think you should meet. Each of them could work with you. The right one is whoever feels right to you, not whoever I think is best on paper.`,
    ],
  };
}

/** Trainer roster through the finish — identical for every goal. */
const CLOSING_BEATS: OnboardingBeat[] = [
  // — PHASE 3: Trainer selection —
  {
    kind: 'roster',
    speaker: 'kael',
    role: 'trainer',
    field: 'trainer',
    prompt: "Tap whoever you'd like to meet. They'll introduce themselves.",
  },

  // — PHASE 4: NS selection —
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      'Good pick.',
      'Now — onto the next part. This one might be the most interesting, because food is where most people quietly sabotage themselves without realizing it. The Diet Corner is where your nutrition specialist lives. They handle everything you eat — what, when, how much, and why.',
      "Unlike trainers, who specialize by goal, nutrition specialists specialize by culture. Because food isn't just fuel. It's where you come from. It's what your grandmother made you. It's what you actually enjoy.",
      "You've got eight specialists, each from a different food tradition. I'm not going to pre-pick — too personal. Take a look. When you find the right one, choose them.",
    ],
  },
  {
    kind: 'roster',
    speaker: 'kael',
    role: 'nutrition-specialist',
    field: 'ns',
    prompt: "Tap whoever you'd like to meet.",
  },

  // — PHASE 5: Team wrap + Home —
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      'Alright, {NAME}. So we’ve got it.',
      'Me — your consultant, your operations. Sera, alongside me, for the mental side. {TRAINER} as your trainer, building you a body you keep. {NS} in the Diet Corner, working with whatever you eat. That’s your team.',
      // Expectation-setting: onboarding collects the basics; the trainer
      // has their own questions — their agenda, not a longer form.
      "One more thing. I've got what I needed — {TRAINER} will want more. How your week actually looks, what you've got to train with, what hurts.",
      "That's theirs to ask, not mine.",
    ],
  },
  {
    kind: 'say',
    speaker: 'sera',
    lines: ['Good team for what you said you wanted, {NAME}. Honestly.'],
  },
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      "One last thing before we set you loose. I've set up your Home — that's where you'll land every time you open Meridian. Your calories, your weigh-in, your streak, a daily note from {NS}. You can change any of it later. It's your space.",
    ],
  },

  // — PHASE 6: Close (local-only, no auth/paywall) —
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      'Alright. Take a breath. Look at this.',
      'This is your team. You and me on operations. Sera on the human side. {TRAINER} in your corner for training. {NS} working with what you eat. And me, watching the whole picture, making sure nothing falls through the cracks.',
    ],
  },
  {
    kind: 'say',
    speaker: 'sera',
    lines: ["You showed up today, {NAME}. That part's done. Tomorrow we start."],
  },
  {
    kind: 'say',
    speaker: 'kael',
    skippable: true,
    lines: [
      "That's it for setup. No sign-ups, no card — everything you build here stays on your device for now.",
      'Welcome to Meridian, {NAME}. Your team’s ready when you are.',
    ],
  },
  {
    kind: 'finish',
    speaker: 'kael',
    lines: ["Here's your Home."],
    buttonLabel: 'Enter Meridian',
  },
];

/**
 * Assembles the full onboarding walk for a goal. Until the user answers
 * the goal question the controller passes the default ('weight-loss');
 * because the opening segment is goal-independent, rebuilding the flow
 * after the answer lands keeps every earlier step index valid.
 */
export function buildOnboardingFlow(goal: PrimaryGoal): OnboardingBeat[] {
  return [
    ...OPENING_BEATS,
    numbersBeat(goal),
    ...SERA_BEATS,
    trainerFramingBeat(goal),
    ...CLOSING_BEATS,
  ];
}
