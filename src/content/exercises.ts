/**
 * The curated exercise database — the vocabulary trainers compose
 * workouts from. Generation constrains exercise names to this list
 * (filtered by the user's equipment access), so every plan is buildable
 * with what the user actually has and every name maps to a known
 * movement with a sensible fallback cue.
 *
 * Kept deliberately compact (~85 entries): broad enough that nine
 * trainers with different philosophies can express themselves, small
 * enough to audit by reading.
 */

import type { EquipmentAccess, ExerciseCategory } from '@/src/types/user-data';

/** The single piece of equipment that gates an exercise. */
export type Equipment =
  | 'none'
  | 'dumbbell'
  | 'kettlebell'
  | 'band'
  | 'bench'
  | 'barbell'
  | 'machine'
  | 'pull-up bar';

export interface ExerciseDef {
  name: string;
  category: ExerciseCategory;
  /** Primary muscles / focus, lowercase. */
  muscles: string[];
  equipment: Equipment;
  level: 'beginner' | 'intermediate' | 'advanced';
  /** One neutral coaching cue — the fallback when the trainer doesn't write one. */
  cue: string;
}

export const EXERCISES: readonly ExerciseDef[] = [
  // ——— STRENGTH · bodyweight ———
  { name: 'Bodyweight squat', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'none', level: 'beginner', cue: 'Sit back and down, chest proud, heels planted.' },
  { name: 'Reverse lunge', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'none', level: 'beginner', cue: 'Step back long, drop the back knee straight down.' },
  { name: 'Walking lunge', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'none', level: 'intermediate', cue: 'Short pause at the bottom, drive through the front heel.' },
  { name: 'Step-up', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'none', level: 'beginner', cue: 'Whole foot on the step, push through it, control the way down.' },
  { name: 'Glute bridge', category: 'strength', muscles: ['glutes', 'hamstrings'], equipment: 'none', level: 'beginner', cue: 'Squeeze at the top, ribs down, no arching.' },
  { name: 'Single-leg glute bridge', category: 'strength', muscles: ['glutes', 'hamstrings'], equipment: 'none', level: 'intermediate', cue: 'Hips level — the free leg is along for the ride.' },
  { name: 'Wall sit', category: 'strength', muscles: ['quads'], equipment: 'none', level: 'beginner', cue: 'Thighs parallel, back flat on the wall, breathe.' },
  { name: 'Calf raise', category: 'strength', muscles: ['calves'], equipment: 'none', level: 'beginner', cue: 'Full stretch at the bottom, pause tall at the top.' },
  { name: 'Push-up', category: 'strength', muscles: ['chest', 'triceps', 'core'], equipment: 'none', level: 'beginner', cue: 'One straight line from head to heels — no sagging hips.' },
  { name: 'Incline push-up', category: 'strength', muscles: ['chest', 'triceps'], equipment: 'none', level: 'beginner', cue: 'Hands on a stable surface, body straight, full range.' },
  { name: 'Decline push-up', category: 'strength', muscles: ['chest', 'shoulders'], equipment: 'none', level: 'intermediate', cue: 'Feet up, hands under shoulders, control the descent.' },
  { name: 'Diamond push-up', category: 'strength', muscles: ['triceps', 'chest'], equipment: 'none', level: 'intermediate', cue: 'Hands close, elbows tracking back, not flared.' },
  { name: 'Pike push-up', category: 'strength', muscles: ['shoulders', 'triceps'], equipment: 'none', level: 'intermediate', cue: 'Hips high, head travels toward the floor between your hands.' },
  { name: 'Plank', category: 'strength', muscles: ['core'], equipment: 'none', level: 'beginner', cue: 'Squeeze glutes, tuck ribs, breathe — don\'t hold your breath.' },
  { name: 'Side plank', category: 'strength', muscles: ['core', 'obliques'], equipment: 'none', level: 'beginner', cue: 'Stack shoulders and hips, push the floor away.' },
  { name: 'Plank shoulder tap', category: 'strength', muscles: ['core', 'shoulders'], equipment: 'none', level: 'beginner', cue: 'Feet wide, hips quiet — the only thing moving is the hand.' },
  { name: 'Dead bug', category: 'strength', muscles: ['core'], equipment: 'none', level: 'beginner', cue: 'Lower back glued to the floor the whole time.' },
  { name: 'Bird dog', category: 'strength', muscles: ['core', 'lower back'], equipment: 'none', level: 'beginner', cue: 'Reach long, not high — a glass of water on your back shouldn\'t spill.' },
  { name: 'Hollow body hold', category: 'strength', muscles: ['core'], equipment: 'none', level: 'intermediate', cue: 'Lower back pressed down, arms and legs long.' },
  { name: 'Superman hold', category: 'strength', muscles: ['lower back', 'glutes'], equipment: 'none', level: 'beginner', cue: 'Lift chest and thighs together, squeeze, lower with control.' },
  { name: 'Sit-up', category: 'strength', muscles: ['core'], equipment: 'none', level: 'beginner', cue: 'Curl up one vertebra at a time — no yanking the neck.' },
  { name: 'Bicycle crunch', category: 'strength', muscles: ['core', 'obliques'], equipment: 'none', level: 'beginner', cue: 'Slow and deliberate beats fast and sloppy.' },

  // ——— STRENGTH · dumbbell ———
  { name: 'Goblet squat', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'dumbbell', level: 'beginner', cue: 'Hug the weight to your chest, elbows inside the knees at the bottom.' },
  { name: 'Dumbbell Romanian deadlift', category: 'strength', muscles: ['hamstrings', 'glutes'], equipment: 'dumbbell', level: 'beginner', cue: 'Push the hips back, soft knees, weights sliding down the thighs.' },
  { name: 'Dumbbell row', category: 'strength', muscles: ['back', 'biceps'], equipment: 'dumbbell', level: 'beginner', cue: 'Pull the elbow to the hip, not the hand to the chest.' },
  { name: 'Dumbbell floor press', category: 'strength', muscles: ['chest', 'triceps'], equipment: 'dumbbell', level: 'beginner', cue: 'Elbows about 45 degrees from the body, press smooth.' },
  { name: 'Dumbbell shoulder press', category: 'strength', muscles: ['shoulders', 'triceps'], equipment: 'dumbbell', level: 'beginner', cue: 'Ribs down, press straight up, biceps finish by the ears.' },
  { name: 'Lateral raise', category: 'strength', muscles: ['shoulders'], equipment: 'dumbbell', level: 'beginner', cue: 'Lead with the elbows, stop at shoulder height, no swinging.' },
  { name: 'Biceps curl', category: 'strength', muscles: ['biceps'], equipment: 'dumbbell', level: 'beginner', cue: 'Elbows pinned to your sides, control the lowering.' },
  { name: 'Hammer curl', category: 'strength', muscles: ['biceps', 'forearms'], equipment: 'dumbbell', level: 'beginner', cue: 'Palms facing in, no body English.' },
  { name: 'Overhead triceps extension', category: 'strength', muscles: ['triceps'], equipment: 'dumbbell', level: 'beginner', cue: 'Elbows point forward and stay narrow.' },
  { name: 'Dumbbell lunge', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'dumbbell', level: 'intermediate', cue: 'Weights hang quiet at your sides — torso tall.' },
  { name: 'Renegade row', category: 'strength', muscles: ['back', 'core'], equipment: 'dumbbell', level: 'intermediate', cue: 'Feet wide, hips square to the floor, row without twisting.' },
  { name: "Farmer's carry", category: 'strength', muscles: ['grip', 'core', 'traps'], equipment: 'dumbbell', level: 'beginner', cue: 'Walk tall like both pockets are full of something expensive.' },
  { name: 'Dumbbell thruster', category: 'strength', muscles: ['quads', 'shoulders'], equipment: 'dumbbell', level: 'intermediate', cue: 'One motion — the squat drive becomes the press.' },

  // ——— STRENGTH · kettlebell ———
  { name: 'Kettlebell goblet squat', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'kettlebell', level: 'beginner', cue: 'Bell tight to the chest, sit between the heels.' },
  { name: 'Kettlebell single-arm press', category: 'strength', muscles: ['shoulders', 'core'], equipment: 'kettlebell', level: 'intermediate', cue: 'Brace like a plank, press without leaning away.' },
  { name: 'Turkish get-up', category: 'strength', muscles: ['full body', 'core'], equipment: 'kettlebell', level: 'advanced', cue: 'Eyes on the bell, one slow position at a time.' },

  // ——— STRENGTH · band ———
  { name: 'Band pull-apart', category: 'strength', muscles: ['rear delts', 'upper back'], equipment: 'band', level: 'beginner', cue: 'Arms straight, squeeze the shoulder blades together.' },
  { name: 'Band row', category: 'strength', muscles: ['back', 'biceps'], equipment: 'band', level: 'beginner', cue: 'Anchor at chest height, pull elbows past the ribs.' },
  { name: 'Band chest press', category: 'strength', muscles: ['chest', 'triceps'], equipment: 'band', level: 'beginner', cue: 'Band behind the back, press to full lockout.' },
  { name: 'Band overhead press', category: 'strength', muscles: ['shoulders'], equipment: 'band', level: 'beginner', cue: 'Stand on the band, press tall, ribs down.' },
  { name: 'Band lateral walk', category: 'strength', muscles: ['glutes', 'hips'], equipment: 'band', level: 'beginner', cue: 'Quarter squat, steps wide, knees pushed out against the band.' },
  { name: 'Band face pull', category: 'strength', muscles: ['rear delts', 'upper back'], equipment: 'band', level: 'beginner', cue: 'Pull toward the eyes, thumbs pointing back.' },

  // ——— STRENGTH · bench ———
  { name: 'Bulgarian split squat', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'bench', level: 'intermediate', cue: 'Back foot is a kickstand — the front leg does the work.' },
  { name: 'Bench dip', category: 'strength', muscles: ['triceps', 'chest'], equipment: 'bench', level: 'beginner', cue: 'Shoulders down away from the ears, elbows point straight back.' },
  { name: 'Dumbbell bench press', category: 'strength', muscles: ['chest', 'triceps'], equipment: 'bench', level: 'intermediate', cue: 'Feet planted, slight arch, press the bells together at the top.' },
  { name: 'Incline dumbbell press', category: 'strength', muscles: ['upper chest', 'shoulders'], equipment: 'bench', level: 'intermediate', cue: 'Low incline, elbows under the wrists the whole way.' },
  { name: 'Chest-supported dumbbell row', category: 'strength', muscles: ['back', 'rear delts'], equipment: 'bench', level: 'intermediate', cue: 'Chest glued to the pad — no cheating with the torso.' },

  // ——— STRENGTH · barbell ———
  { name: 'Back squat', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'barbell', level: 'intermediate', cue: 'Brace before you descend — big air, tight middle.' },
  { name: 'Front squat', category: 'strength', muscles: ['quads', 'core'], equipment: 'barbell', level: 'advanced', cue: 'Elbows high, bar resting on the shoulders, torso vertical.' },
  { name: 'Conventional deadlift', category: 'strength', muscles: ['hamstrings', 'glutes', 'back'], equipment: 'barbell', level: 'intermediate', cue: 'Bar against the shins, push the floor away, finish tall.' },
  { name: 'Romanian deadlift', category: 'strength', muscles: ['hamstrings', 'glutes'], equipment: 'barbell', level: 'intermediate', cue: 'Hips back until the hamstrings speak, then stand.' },
  { name: 'Barbell bench press', category: 'strength', muscles: ['chest', 'triceps'], equipment: 'barbell', level: 'intermediate', cue: 'Bar to mid-chest, feet quiet, press back toward the rack.' },
  { name: 'Overhead press', category: 'strength', muscles: ['shoulders', 'triceps'], equipment: 'barbell', level: 'intermediate', cue: 'Squeeze glutes, head through the window at the top.' },
  { name: 'Barbell row', category: 'strength', muscles: ['back', 'biceps'], equipment: 'barbell', level: 'intermediate', cue: 'Hinge and hold — pull to the lower ribs, no bouncing.' },
  { name: 'Barbell hip thrust', category: 'strength', muscles: ['glutes'], equipment: 'barbell', level: 'intermediate', cue: 'Chin tucked, full lockout, one-second squeeze at the top.' },
  { name: 'Barbell lunge', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'barbell', level: 'advanced', cue: 'Bar tight on the back, shorter steps than you think.' },

  // ——— STRENGTH · machine ———
  { name: 'Lat pulldown', category: 'strength', muscles: ['back', 'biceps'], equipment: 'machine', level: 'beginner', cue: 'Pull the bar to the collarbone, elbows down and back.' },
  { name: 'Seated cable row', category: 'strength', muscles: ['back', 'biceps'], equipment: 'machine', level: 'beginner', cue: 'Chest tall — pull to the belly, pause, control the return.' },
  { name: 'Leg press', category: 'strength', muscles: ['quads', 'glutes'], equipment: 'machine', level: 'beginner', cue: 'Lower until the knees near 90, never bounce at the bottom.' },
  { name: 'Leg extension', category: 'strength', muscles: ['quads'], equipment: 'machine', level: 'beginner', cue: 'Pause at the top, lower slow — the way down is half the work.' },
  { name: 'Leg curl', category: 'strength', muscles: ['hamstrings'], equipment: 'machine', level: 'beginner', cue: 'Hips stay pinned to the pad.' },
  { name: 'Cable chest fly', category: 'strength', muscles: ['chest'], equipment: 'machine', level: 'intermediate', cue: 'Slight elbow bend held constant — hug a barrel.' },
  { name: 'Cable triceps pushdown', category: 'strength', muscles: ['triceps'], equipment: 'machine', level: 'beginner', cue: 'Elbows pinned, full lockout, no shoulders creeping up.' },
  { name: 'Cable face pull', category: 'strength', muscles: ['rear delts', 'upper back'], equipment: 'machine', level: 'beginner', cue: 'Rope to the forehead, elbows high, thumbs back.' },

  // ——— STRENGTH · pull-up bar ———
  { name: 'Pull-up', category: 'strength', muscles: ['back', 'biceps'], equipment: 'pull-up bar', level: 'intermediate', cue: 'Start from a dead hang, chin over — no kicking.' },
  { name: 'Chin-up', category: 'strength', muscles: ['biceps', 'back'], equipment: 'pull-up bar', level: 'intermediate', cue: 'Palms toward you, chest to the bar, slow negative.' },
  { name: 'Negative pull-up', category: 'strength', muscles: ['back', 'biceps'], equipment: 'pull-up bar', level: 'beginner', cue: 'Jump to the top, lower yourself on a five count.' },
  { name: 'Hanging knee raise', category: 'strength', muscles: ['core', 'hip flexors'], equipment: 'pull-up bar', level: 'intermediate', cue: 'Knees to the chest without swinging — slower is stronger.' },
  { name: 'Dead hang', category: 'strength', muscles: ['grip', 'shoulders'], equipment: 'pull-up bar', level: 'beginner', cue: 'Shoulders active, breathe, let the spine lengthen.' },

  // ——— CONDITIONING ———
  { name: 'Brisk walk', category: 'conditioning', muscles: ['full body'], equipment: 'none', level: 'beginner', cue: 'A pace where talking is possible but singing is not.' },
  { name: 'Easy run', category: 'conditioning', muscles: ['full body'], equipment: 'none', level: 'beginner', cue: 'Conversational pace — if you can\'t chat, slow down.' },
  { name: 'Interval run', category: 'conditioning', muscles: ['full body'], equipment: 'none', level: 'intermediate', cue: 'Hard efforts honest, easy efforts truly easy.' },
  { name: 'Stair climbs', category: 'conditioning', muscles: ['quads', 'glutes'], equipment: 'none', level: 'beginner', cue: 'Drive through the whole foot, use the rail only for balance.' },
  { name: 'Jumping jacks', category: 'conditioning', muscles: ['full body'], equipment: 'none', level: 'beginner', cue: 'Land soft, keep a rhythm you could hold for a song.' },
  { name: 'High knees', category: 'conditioning', muscles: ['hip flexors', 'calves'], equipment: 'none', level: 'beginner', cue: 'Quick ground contact, arms driving like a sprint.' },
  { name: 'Mountain climbers', category: 'conditioning', muscles: ['core', 'shoulders'], equipment: 'none', level: 'beginner', cue: 'Hips low and level — speed only as fast as form allows.' },
  { name: 'Burpee', category: 'conditioning', muscles: ['full body'], equipment: 'none', level: 'intermediate', cue: 'Chest to the floor, jump tall, find a sustainable rhythm.' },
  { name: 'Squat jump', category: 'conditioning', muscles: ['quads', 'glutes'], equipment: 'none', level: 'intermediate', cue: 'Land quiet, absorb into the next rep.' },
  { name: 'Skater hops', category: 'conditioning', muscles: ['glutes', 'quads'], equipment: 'none', level: 'intermediate', cue: 'Push sideways, stick each landing for a beat.' },
  { name: 'Bear crawl', category: 'conditioning', muscles: ['core', 'shoulders'], equipment: 'none', level: 'intermediate', cue: 'Knees an inch off the floor, opposite hand and foot together.' },
  { name: 'Shadow boxing', category: 'conditioning', muscles: ['shoulders', 'core'], equipment: 'none', level: 'beginner', cue: 'Stay on the balls of your feet, exhale with each punch.' },
  { name: 'Kettlebell swing', category: 'conditioning', muscles: ['glutes', 'hamstrings', 'core'], equipment: 'kettlebell', level: 'intermediate', cue: 'A hip snap, not a squat — the arms are just rope.' },
  { name: 'Rowing machine', category: 'conditioning', muscles: ['full body'], equipment: 'machine', level: 'beginner', cue: 'Legs, then body, then arms — reverse it on the way back.' },
  { name: 'Stationary bike', category: 'conditioning', muscles: ['quads', 'full body'], equipment: 'machine', level: 'beginner', cue: 'Smooth circles, steady breathing, pick a gear you can hold.' },
  { name: 'Treadmill incline walk', category: 'conditioning', muscles: ['glutes', 'calves'], equipment: 'machine', level: 'beginner', cue: 'Hands off the rails — that\'s where the work is.' },

  // ——— MOBILITY ———
  { name: "World's greatest stretch", category: 'mobility', muscles: ['hips', 'thoracic spine'], equipment: 'none', level: 'beginner', cue: 'Long lunge, elbow to instep, then open to the sky.' },
  { name: 'Hip flexor stretch', category: 'mobility', muscles: ['hip flexors'], equipment: 'none', level: 'beginner', cue: 'Tuck the tail, squeeze the back glute — the stretch finds you.' },
  { name: 'Hamstring stretch', category: 'mobility', muscles: ['hamstrings'], equipment: 'none', level: 'beginner', cue: 'Hinge from the hips with a long spine — no rounding to reach.' },
  { name: 'Cat-cow', category: 'mobility', muscles: ['spine'], equipment: 'none', level: 'beginner', cue: 'Move one vertebra at a time, match the breath.' },
  { name: 'Thread the needle', category: 'mobility', muscles: ['thoracic spine', 'shoulders'], equipment: 'none', level: 'beginner', cue: 'Reach under and through, let the upper back rotate.' },
  { name: 'Deep squat hold', category: 'mobility', muscles: ['hips', 'ankles'], equipment: 'none', level: 'beginner', cue: 'Heels down, elbows pry the knees apart, hang out and breathe.' },
  { name: 'Couch stretch', category: 'mobility', muscles: ['quads', 'hip flexors'], equipment: 'none', level: 'intermediate', cue: 'Back foot up the wall, squeeze the glute, stay tall.' },
  { name: 'Ankle circles', category: 'mobility', muscles: ['ankles'], equipment: 'none', level: 'beginner', cue: 'Slow full circles, both directions, both sides.' },
  { name: 'Band shoulder dislocates', category: 'mobility', muscles: ['shoulders'], equipment: 'band', level: 'beginner', cue: 'Wide grip, straight arms, over and back only as far as smooth.' },

  // ——— WARM-UP ———
  { name: 'Arm circles', category: 'warm-up', muscles: ['shoulders'], equipment: 'none', level: 'beginner', cue: 'Small circles growing bigger, both directions.' },
  { name: 'Leg swings', category: 'warm-up', muscles: ['hips'], equipment: 'none', level: 'beginner', cue: 'Hold something steady, swing loose front-to-back then side-to-side.' },
  { name: 'Torso twists', category: 'warm-up', muscles: ['spine', 'core'], equipment: 'none', level: 'beginner', cue: 'Feet planted, rotate easy, let the arms follow.' },
  { name: 'Hip circles', category: 'warm-up', muscles: ['hips'], equipment: 'none', level: 'beginner', cue: 'Hands on hips, big slow circles like stirring a pot.' },
  { name: 'Jog in place', category: 'warm-up', muscles: ['full body'], equipment: 'none', level: 'beginner', cue: 'Easy bounce, shoulders loose, just raising the temperature.' },
  { name: 'Inchworm', category: 'warm-up', muscles: ['hamstrings', 'core', 'shoulders'], equipment: 'none', level: 'beginner', cue: 'Walk the hands out to a plank, walk the feet to the hands.' },
  { name: 'Air squat warm-up', category: 'warm-up', muscles: ['quads', 'hips'], equipment: 'none', level: 'beginner', cue: 'Half depth, easy tempo — greasing the pattern, not training it.' },

  // ——— COOL-DOWN ———
  { name: "Child's pose", category: 'cool-down', muscles: ['back', 'hips'], equipment: 'none', level: 'beginner', cue: 'Knees wide, arms long, slow breaths into the back.' },
  { name: 'Standing forward fold', category: 'cool-down', muscles: ['hamstrings', 'back'], equipment: 'none', level: 'beginner', cue: 'Soft knees, hang heavy, let gravity do it.' },
  { name: 'Quad stretch', category: 'cool-down', muscles: ['quads'], equipment: 'none', level: 'beginner', cue: 'Knees together, tail tucked, hold something if you wobble.' },
  { name: 'Figure-four stretch', category: 'cool-down', muscles: ['glutes', 'hips'], equipment: 'none', level: 'beginner', cue: 'Ankle over knee, pull the standing leg in gently.' },
  { name: 'Chest doorway stretch', category: 'cool-down', muscles: ['chest', 'shoulders'], equipment: 'none', level: 'beginner', cue: 'Forearm on the frame, step through until the chest opens.' },
  { name: 'Neck rolls', category: 'cool-down', muscles: ['neck'], equipment: 'none', level: 'beginner', cue: 'Half circles only — ear to shoulder, chin to chest, ear to shoulder.' },
  { name: 'Slow walk and breathe', category: 'cool-down', muscles: ['full body'], equipment: 'none', level: 'beginner', cue: 'Two minutes easy, in through the nose, long exhales.' },
];

/** Which equipment each access tier unlocks. */
const ACCESS_EQUIPMENT: Record<EquipmentAccess, readonly Equipment[]> = {
  bodyweight: ['none'],
  'home-basics': ['none', 'dumbbell', 'kettlebell', 'band', 'bench', 'pull-up bar'],
  'full-gym': ['none', 'dumbbell', 'kettlebell', 'band', 'bench', 'barbell', 'machine', 'pull-up bar'],
};

/**
 * Exercises available at an access tier. Defaults to full gym when the
 * intake hasn't run yet — the pre-intake behavior the app always had.
 */
export function filterByAccess(access: EquipmentAccess = 'full-gym'): ExerciseDef[] {
  const allowed = ACCESS_EQUIPMENT[access];
  return EXERCISES.filter((e) => allowed.includes(e.equipment));
}

/** Case-insensitive lookup by exercise name. */
export function exerciseByName(name: string): ExerciseDef | undefined {
  const key = name.trim().toLowerCase();
  return EXERCISES.find((e) => e.name.toLowerCase() === key);
}
