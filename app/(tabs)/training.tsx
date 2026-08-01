import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { AppText, Button, Card, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
import {
  TrainerIntakeFlow,
  TrainerRepickCard,
  WorkoutStateCard,
} from '@/src/components/workout';
import { getCharacter } from '@/src/content/characters';
import { getIntakeScript } from '@/src/content/intake';
import { isClaudeConfigured } from '@/src/services/claude';
import { makeEventId } from '@/src/services/events';
import { generateWorkoutPlan } from '@/src/services/workout-generation';
import { deriveWorkoutState } from '@/src/services/workout-state';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';
import type { WorkoutSession } from '@/src/types/user-data';

/**
 * Training Hub — the trainer's territory (brief §9). Workout-first: the
 * top card reflects today's session state (no plan yet / generating /
 * ready to start / in progress / rest day / completed). Everything else
 * — history browsing, rest timer, alternate exercises — is Phase B.
 * The trainer chat lives as a pushed screen (app/trainer.tsx) reachable
 * via the "Talk to {trainerName}" button below.
 */
export default function TrainingScreen() {
  const trainerId = useUserStore((s) => s.trainerId);
  const retiredTrainerId = useUserStore((s) => s.retiredTrainerId);
  const setTrainer = useUserStore((s) => s.setTrainer);
  const name = useUserStore((s) => s.name);
  const currentPlan = useUserDataStore((s) => s.programmeState.currentPlan);
  const currentSession = useUserDataStore((s) => s.programmeState.currentSession);
  const recentSessions = useUserDataStore((s) => s.programmeState.recentSessions);
  const intakeCompletedBy = useUserDataStore((s) => s.programmeState.intakeCompletedBy);
  const setCurrentPlan = useUserDataStore((s) => s.setCurrentPlan);
  const startSession = useUserDataStore((s) => s.startSession);
  const emitEvent = useUserDataStore((s) => s.emitEvent);

  const [generating, setGenerating] = useState(false);
  // When an auto-kicked generation fails we say so inline — an Alert
  // popping the moment you open the tab would be rude.
  const [autoFailNote, setAutoFailNote] = useState<string | null>(null);

  // Walking into the hub should show today's session — or at least show
  // it being built — without a tap. One automatic attempt per mount;
  // after a failure the manual button is the retry.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current || generating) return;
    if (!trainerId || !isClaudeConfigured()) return;
    const script = getIntakeScript(trainerId);
    if (script !== undefined && intakeCompletedBy !== trainerId) return; // intake first
    const state = deriveWorkoutState({ currentPlan, currentSession, recentSessions }, false);
    if (state.kind !== 'no-plan') return;
    autoTried.current = true;
    void handleGenerate(true);
  });

  const trainer = trainerId ? getCharacter(trainerId) : null;

  // A roster change retired this user's trainer: Kael explains, then the
  // current roster is offered with the onboarding meet → commit mechanic.
  if (!trainerId && retiredTrainerId) {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <AppText variant="title">Training Hub</AppText>
          <TrainerRepickCard
            retiredTrainerId={retiredTrainerId}
            userName={name}
            onCommit={setTrainer}
          />
        </ScrollView>
      </Screen>
    );
  }

  if (!trainer || !trainerId) {
    return (
      <Screen>
        <AppText variant="title">Training Hub</AppText>
        <Card style={styles.card}>
          <AppText variant="subtitle">No trainer yet</AppText>
          <AppText variant="caption">
            Pick a trainer from Profile when you&apos;re ready.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const trainerName = trainer.name;
  // First time with THIS trainer: they run their own intake before any
  // plan exists. Relationship-scoped — a newly picked trainer asks their
  // own questions even when facts are already on file.
  const intakeScript = getIntakeScript(trainerId);
  const needsIntake = intakeScript !== undefined && intakeCompletedBy !== trainerId;
  const cardState = deriveWorkoutState(
    { currentPlan, currentSession, recentSessions },
    generating,
  );

  /**
   * Fires the trainer's plan-generation call, persists the plan, and
   * emits the workout-plan-created event so Kael sees it in his next
   * pass.
   */
  async function handleGenerate(auto = false) {
    if (!trainerId || !isClaudeConfigured()) {
      if (!auto) {
        Alert.alert(
          `${trainerName} offline`,
          "Meridian's service is unreachable right now. Check your connection and try again.",
        );
      }
      return;
    }
    setGenerating(true);
    setAutoFailNote(null);
    try {
      const plan = await generateWorkoutPlan(trainerId, name);
      setCurrentPlan(plan);
      emitEvent({
        id: makeEventId(),
        at: Date.now(),
        from: trainerId,
        to: ['kael'],
        kind: plan.exercises.length === 0 ? 'workout-plan-created' : 'workout-plan-created',
        summary:
          plan.exercises.length === 0
            ? `Rest day today — ${plan.intent.slice(0, 120)}`
            : `${plan.focusArea} planned for today — ${plan.intent.slice(0, 120)}`,
        seenBy: [],
      });
    } catch (error) {
      console.error('Plan generation failed:', error);
      if (auto) {
        setAutoFailNote(
          `${trainerName} couldn't put today together just now — tap to try again.`,
        );
      } else {
        Alert.alert(
          `${trainerName} couldn't put a plan together`,
          'Something went wrong reaching the trainer. Try again in a moment.',
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  /** Starts a fresh session against today's plan and pushes to the runner. */
  function handleStart() {
    if (!currentPlan) return;
    const session: WorkoutSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      planId: currentPlan.id,
      focusArea: currentPlan.focusArea,
      startedAt: Date.now(),
      status: 'in-progress',
      logs: currentPlan.exercises.map((ex) => ({
        plannedExerciseId: ex.id,
        name: ex.name,
        status: 'pending',
        sets: [],
      })),
    };
    startSession(session);
    router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
  }

  /** Resumes an in-progress session by pushing to the same runner. */
  function handleResume() {
    if (!currentSession) return;
    router.push({
      pathname: '/workout/[sessionId]',
      params: { sessionId: currentSession.id },
    });
  }

  // First-time intake takes the whole surface — it's the trainer's
  // opening conversation, not a card among widgets. KAV covers the two
  // free-text questions.
  if (needsIntake && intakeScript) {
    return (
      <Screen>
        <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <AppText variant="title">Training Hub</AppText>
            <AppText variant="label" style={styles.subheading}>
              First session prep with {trainerName}
            </AppText>
            <TrainerIntakeFlow script={intakeScript} onDone={() => {}} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="title">Training Hub</AppText>
        <AppText variant="label" style={styles.subheading}>
          Training with {trainerName}
        </AppText>

        <WorkoutStateCard
          state={cardState}
          trainerName={trainerName}
          onGenerate={() => void handleGenerate()}
          onStart={handleStart}
          onResume={handleResume}
        />
        {autoFailNote && cardState.kind === 'no-plan' && (
          <AppText variant="caption" color={colors.warning} style={styles.autoFail} testID="training-autofail">
            {autoFailNote}
          </AppText>
        )}

        <Button
          label={`Talk to ${trainerName}`}
          variant="secondary"
          onPress={() => router.push('/trainer')}
          style={styles.talkButton}
          testID="training-talk"
        />

        {(recentSessions?.length ?? 0) > 0 && (
          <Button
            label="Training history"
            variant="ghost"
            onPress={() => router.push('/history')}
            style={styles.historyButton}
            testID="training-history"
          />
        )}

        {!isClaudeConfigured() && (
          <Card style={styles.offline}>
            <AppText variant="label" color={colors.warning}>
              Trainer offline
            </AppText>
            <AppText variant="caption" style={styles.offlineBody}>
              Meridian&apos;s service is unreachable — check your connection, or update the app.
            </AppText>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  subheading: {
    marginTop: spacing.xs,
  },
  card: {
    marginTop: spacing.lg,
  },
  talkButton: {
    marginTop: spacing.md,
  },
  autoFail: {
    marginTop: spacing.xs,
  },
  historyButton: {
    marginTop: spacing.xs,
  },
  offline: {
    marginTop: spacing.lg,
    borderColor: colors.warning,
  },
  offlineBody: {
    marginTop: spacing.xs,
  },
});
