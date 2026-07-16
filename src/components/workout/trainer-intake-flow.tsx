import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import type { IntakeAnswers, IntakeChallenge, TrainerIntakeScript } from '@/src/content/intake';
import { getDirectedMessage, isClaudeConfigured } from '@/src/services/claude';
import { makeEventId } from '@/src/services/events';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { UserProfile } from '@/src/types/user-data';

/**
 * The trainer intake engine — one machine, five voices. Renders a
 * TrainerIntakeScript (src/content/intake/): the trainer's intro, their
 * ordering of choice steps (scripted reactions, no API), their
 * challenges (the philosophy mechanic: the trainer says their piece,
 * the user decides, the decision is respected and Kael hears about it),
 * two free-text questions answered in character via the proxy, and the
 * outro. On completion the canonical answers land in the shared schema
 * and programmeState.intakeCompletedBy gates the Hub back to normal.
 */

interface Props {
  script: TrainerIntakeScript;
  onDone: () => void;
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'question'; stepIdx: number }
  | { kind: 'reaction'; stepIdx: number; lines: string[] }
  | { kind: 'challenge'; stepIdx: number; challenge: IntakeChallenge }
  | { kind: 'apiPending'; stepIdx: number }
  | { kind: 'apiReply'; stepIdx: number; lines: string[] }
  | { kind: 'outro' };

/** Maps canonical intake answers onto the shared user profile. */
function mapToProfile(a: IntakeAnswers): Partial<UserProfile> {
  return {
    fitnessExperience: a.experience,
    trainingPlace: a.place,
    equipmentAccess:
      a.place === 'gym' ? 'full-gym' : a.place === 'outdoors' ? 'bodyweight' : a.equipment,
    trainingDaysPerWeek: a.days,
    sessionLengthMinutes: a.sessionLength,
    preferredTrainingTime: a.timeOfDay,
    ...(a.limitations?.trim() ? { injuries: [a.limitations.trim()] } : {}),
    ...(a.notes?.trim() ? { trainingHistory: a.notes.trim() } : {}),
  };
}

export function TrainerIntakeFlow({ script, onDone }: Props) {
  const trainer = getCharacter(script.trainerId);
  const userName = useUserStore((s) => s.name);
  const updateUserProfile = useUserDataStore((s) => s.updateUserProfile);
  const updateProgrammeState = useUserDataStore((s) => s.updateProgrammeState);
  const emitEvent = useUserDataStore((s) => s.emitEvent);

  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [freeText, setFreeText] = useState('');
  const [firedChallenges, setFiredChallenges] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<{ challenge: IntakeChallenge; outcome: string }[]>([]);

  /** First renderable step at or after `from`, honoring `when` guards. */
  function nextStepIdx(from: number, current: IntakeAnswers): number {
    for (let i = from; i < script.steps.length; i++) {
      const step = script.steps[i];
      if (step.kind !== 'choice' || !step.when || step.when(current)) return i;
    }
    return script.steps.length;
  }

  function goToStep(from: number, current: IntakeAnswers) {
    const idx = nextStepIdx(from, current);
    setFreeText('');
    setPhase(idx >= script.steps.length ? { kind: 'outro' } : { kind: 'question', stepIdx: idx });
  }

  /** After an answer commits: challenge check, else reaction, else next. */
  function afterAnswer(stepIdx: number, field: keyof IntakeAnswers, next: IntakeAnswers, reaction: string[]) {
    const challenge = script.challenges.find(
      (c) => c.afterField === field && !firedChallenges.includes(c.id) && c.when(next),
    );
    if (challenge) {
      setFiredChallenges((f) => [...f, challenge.id]);
      setPhase({ kind: 'challenge', stepIdx, challenge });
      return;
    }
    if (reaction.length > 0) {
      setPhase({ kind: 'reaction', stepIdx, lines: reaction });
      return;
    }
    goToStep(stepIdx + 1, next);
  }

  function pickOption(stepIdx: number, field: keyof IntakeAnswers, value: string | number, reaction: string[]) {
    const next = { ...answers, [field]: value };
    setAnswers(next);
    afterAnswer(stepIdx, field, next, reaction);
  }

  function pickChallengeOption(
    stepIdx: number,
    challenge: IntakeChallenge,
    option: IntakeChallenge['options'][number],
  ) {
    const next = { ...answers, ...(option.apply ?? {}) };
    setAnswers(next);
    setConcerns((c) => [...c, { challenge, outcome: option.outcome }]);
    if (option.reaction.length > 0) {
      setPhase({ kind: 'reaction', stepIdx, lines: option.reaction });
    } else {
      goToStep(stepIdx + 1, next);
    }
  }

  async function submitFreeText(stepIdx: number) {
    const step = script.steps[stepIdx];
    if (step.kind !== 'freeText') return;
    const text = freeText.trim();
    const next = { ...answers, [step.field]: text };
    setAnswers(next);
    if (text === '') {
      goToStep(stepIdx + 1, next);
      return;
    }
    if (!isClaudeConfigured()) {
      setPhase({ kind: 'apiReply', stepIdx, lines: step.fallbackAck });
      return;
    }
    setPhase({ kind: 'apiPending', stepIdx });
    try {
      const reply = await getDirectedMessage(
        script.trainerId,
        userName,
        `[Intake context — not a message to quote back: during your first-time intake you asked: "${step.prompt}". ` +
          `The user answered: "${text}". Reply in one to three short sentences, in your own voice. ` +
          `React to what they actually said — acknowledge specifics, and if anything they said conflicts with how you train, ` +
          `say so honestly and plainly while keeping the choice theirs. No lists, no markdown.]`,
      );
      setPhase({ kind: 'apiReply', stepIdx, lines: [reply] });
    } catch {
      setPhase({ kind: 'apiReply', stepIdx, lines: step.fallbackAck });
    }
  }

  /** Writes everything to the shared schema and lets the Hub take over. */
  function finish() {
    updateUserProfile(mapToProfile(answers));
    updateProgrammeState({ intakeCompletedBy: script.trainerId });
    const now = Date.now();
    for (const { challenge, outcome } of concerns) {
      emitEvent({
        id: makeEventId(),
        at: now,
        from: script.trainerId,
        to: ['kael'],
        kind: 'intake-concern',
        summary: `Raised during intake (${challenge.id}): ${outcome}.`,
        seenBy: [],
      });
    }
    emitEvent({
      id: makeEventId(),
      at: now,
      from: script.trainerId,
      to: ['kael'],
      kind: 'intake-completed',
      summary: `Intake done: ${answers.days ?? '?'} days/week, ~${answers.sessionLength ?? '?'} min, ${
        answers.place ?? 'anywhere'
      }${answers.limitations?.trim() ? ', limitations noted' : ''}.`,
      seenBy: [],
    });
    onDone();
  }

  function speech(lines: string[], testID?: string) {
    return (
      <Card tone="panel" style={styles.speech} testID={testID}>
        <AppText variant="label" color={colors.primary} style={styles.speaker}>
          {trainer.name}
        </AppText>
        {lines.map((line, i) => (
          <AppText key={i} variant="body" style={styles.line}>
            {line}
          </AppText>
        ))}
      </Card>
    );
  }

  switch (phase.kind) {
    case 'intro':
      return (
        <View>
          {speech(script.intro, 'intake-intro')}
          <Button label="Continue" onPress={() => goToStep(0, answers)} style={styles.cta} testID="intake-continue" />
        </View>
      );

    case 'question': {
      const step = script.steps[phase.stepIdx];
      if (step.kind === 'choice') {
        return (
          <View>
            {speech([step.prompt])}
            {step.options.map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => pickOption(phase.stepIdx, step.field, opt.value, opt.reaction)}
                accessibilityRole="button"
                testID={`intake-${step.field}-${opt.value}`}
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
          </View>
        );
      }
      return (
        <View>
          {speech([step.prompt])}
          <TextInput
            value={freeText}
            onChangeText={setFreeText}
            placeholder={step.placeholder}
            placeholderTextColor={colors.muted}
            multiline
            style={styles.freeText}
            testID="intake-freetext"
          />
          <Button
            label="Send"
            onPress={() => submitFreeText(phase.stepIdx)}
            disabled={freeText.trim().length === 0}
            style={styles.cta}
            testID="intake-send"
          />
          <Button
            label={step.skipLabel}
            variant="secondary"
            onPress={() => {
              setFreeText('');
              const next = { ...answers, [step.field]: '' };
              setAnswers(next);
              goToStep(phase.stepIdx + 1, next);
            }}
            style={styles.ctaSecondary}
            testID="intake-skip"
          />
        </View>
      );
    }

    case 'reaction':
      return (
        <View>
          {speech(phase.lines, 'intake-reaction')}
          <Button
            label="Continue"
            onPress={() => goToStep(phase.stepIdx + 1, answers)}
            style={styles.cta}
            testID="intake-continue"
          />
        </View>
      );

    case 'challenge':
      return (
        <View>
          {speech(phase.challenge.lines, 'intake-challenge')}
          {phase.challenge.options.map((opt, i) => (
            <Pressable
              key={i}
              onPress={() => pickChallengeOption(phase.stepIdx, phase.challenge, opt)}
              accessibilityRole="button"
              testID={`intake-challenge-${i}`}
            >
              <Card style={styles.option}>
                <AppText variant="body">{opt.label}</AppText>
              </Card>
            </Pressable>
          ))}
        </View>
      );

    case 'apiPending':
      return (
        <View>
          <Card tone="panel" style={styles.speech}>
            <AppText variant="label" color={colors.primary} style={styles.speaker}>
              {trainer.name}
            </AppText>
            <ActivityIndicator color={colors.primary} style={styles.line} />
          </Card>
        </View>
      );

    case 'apiReply':
      return (
        <View>
          {speech(phase.lines, 'intake-api-reply')}
          <Button
            label="Continue"
            onPress={() => goToStep(phase.stepIdx + 1, answers)}
            style={styles.cta}
            testID="intake-continue"
          />
        </View>
      );

    case 'outro':
      return (
        <View>
          {speech(script.outro, 'intake-outro')}
          <Button label="To the Training Hub" onPress={finish} style={styles.cta} testID="intake-done" />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  speech: {
    marginTop: spacing.lg,
  },
  speaker: {
    marginBottom: spacing.xs,
  },
  line: {
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  option: {
    marginTop: spacing.md,
  },
  cta: {
    marginTop: spacing.lg,
  },
  ctaSecondary: {
    marginTop: spacing.xs,
  },
  freeText: {
    marginTop: spacing.lg,
    minHeight: 96,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
});
