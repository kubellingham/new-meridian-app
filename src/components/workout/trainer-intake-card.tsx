import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import type { CharacterId } from '@/src/content/characters';
import { colors, spacing } from '@/src/theme/theme';
import type { EquipmentAccess, UserProfile } from '@/src/types/user-data';

/**
 * The trainer's first-visit mini-intake — three scripted questions
 * (equipment, weekly cadence, experience) answered by tapping, asked
 * before the first plan is generated so the exercise database can be
 * filtered to what the user actually has. Deterministic and API-free,
 * per the locked principle that intake questions are pre-written; the
 * live AI takes over in conversation and generation.
 */

/** What the intake collects — written to the shared profile on finish. */
export interface TrainerIntakeResult {
  equipmentAccess: EquipmentAccess;
  trainingDaysPerWeek: number;
  fitnessExperience: NonNullable<UserProfile['fitnessExperience']>;
}

/** One line, per trainer, opening the intake in their voice. */
const INTAKE_LEAD_INS: Partial<Record<CharacterId, string>> = {
  cassidy: "Before I build anything, real talk — I need three answers. Then we work.",
  tobias: 'Before the first plan: three questions. The answers shape everything, so be honest.',
  marco: "Quick one before we play — three questions, then I build you something good.",
  ananya: 'Before your first plan, three quick questions. Accha — precision starts here.',
  dmitri: 'Three questions. Then the work begins.',
  kofi: 'Before we build, chale — three questions. Answer straight, then we move.',
  amara: 'Before anything else, three small questions — so the plan fits your real life.',
  ingrid: 'Three questions first. Then the plan knows the terrain.',
  sam: "Okay, three quick questions so I can build around your actual week — not the imaginary one.",
};

interface Question {
  key: keyof TrainerIntakeResult;
  prompt: string;
  options: { value: string | number; label: string; hint?: string }[];
}

const QUESTIONS: Question[] = [
  {
    key: 'equipmentAccess',
    prompt: 'What do you have to train with?',
    options: [
      { value: 'full-gym', label: 'A full gym', hint: 'Barbells, machines, the lot' },
      { value: 'home-basics', label: 'Home basics', hint: 'Dumbbells, bands, maybe a bench' },
      { value: 'bodyweight', label: 'Just my body', hint: 'No equipment right now' },
    ],
  },
  {
    key: 'trainingDaysPerWeek',
    prompt: 'How many days a week do you want to train?',
    options: [
      { value: 2, label: '2 days' },
      { value: 3, label: '3 days' },
      { value: 4, label: '4 days' },
      { value: 5, label: '5 or more' },
    ],
  },
  {
    key: 'fitnessExperience',
    prompt: 'How much training have you done before?',
    options: [
      { value: 'none', label: "I'm new to this", hint: 'Starting fresh' },
      { value: 'some', label: 'Some experience', hint: 'On and off, know the basics' },
      { value: 'experienced', label: 'Experienced', hint: 'Trained consistently before' },
    ],
  },
];

type TrainerIntakeCardProps = {
  trainerId: CharacterId;
  trainerName: string;
  /** Called once with all three answers after the last tap. */
  onComplete: (result: TrainerIntakeResult) => void;
};

export function TrainerIntakeCard({ trainerId, trainerName, onComplete }: TrainerIntakeCardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<TrainerIntakeResult>>({});

  const question = QUESTIONS[step];

  function handlePick(value: string | number) {
    const next = { ...answers, [question.key]: value };
    if (step < QUESTIONS.length - 1) {
      setAnswers(next);
      setStep(step + 1);
      return;
    }
    onComplete(next as TrainerIntakeResult);
  }

  return (
    <Card tone="panel" style={styles.card} testID="trainer-intake">
      <AppText variant="label" color={colors.primary}>
        {trainerName}
      </AppText>
      {step === 0 && (
        <AppText variant="body" style={styles.leadIn}>
          {INTAKE_LEAD_INS[trainerId] ?? 'Three quick questions before your first plan.'}
        </AppText>
      )}
      <AppText variant="subtitle" style={styles.prompt}>
        {question.prompt}
      </AppText>
      {question.options.map((opt) => (
        <Pressable
          key={String(opt.value)}
          onPress={() => handlePick(opt.value)}
          accessibilityRole="button"
          testID={`intake-${question.key}-${opt.value}`}
        >
          <Card style={styles.option}>
            <AppText variant="body">{opt.label}</AppText>
            {opt.hint && (
              <AppText variant="caption" color={colors.muted}>
                {opt.hint}
              </AppText>
            )}
          </Card>
        </Pressable>
      ))}
      <View style={styles.dots}>
        {QUESTIONS.map((q, i) => (
          <View key={q.key} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  leadIn: {
    lineHeight: 22,
  },
  prompt: {
    marginTop: spacing.xs,
  },
  option: {
    gap: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
});
