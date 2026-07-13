import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import {
  TrainerIntakeCard,
  WorkoutStateCard,
  type TrainerIntakeResult,
} from '@/src/components/workout';
import { getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { makeEventId } from '@/src/services/events';
import {
  generateWorkoutPlan,
  todayLocalISODate,
} from '@/src/services/workout-generation';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';
import type { WorkoutPlan, WorkoutSession } from '@/src/types/user-data';

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
  const name = useUserStore((s) => s.name);
  const currentPlan = useUserDataStore((s) => s.programmeState.currentPlan);
  const currentSession = useUserDataStore((s) => s.programmeState.currentSession);
  const recentSessions = useUserDataStore((s) => s.programmeState.recentSessions);
  const equipmentAccess = useUserDataStore((s) => s.userProfile.equipmentAccess);
  const setCurrentPlan = useUserDataStore((s) => s.setCurrentPlan);
  const updateUserProfile = useUserDataStore((s) => s.updateUserProfile);
  const startSession = useUserDataStore((s) => s.startSession);
  const emitEvent = useUserDataStore((s) => s.emitEvent);

  const [generating, setGenerating] = useState(false);

  const trainer = trainerId ? getCharacter(trainerId) : null;

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
  // First visit: the trainer asks their three setup questions before any
  // plan can be generated — the answers filter the exercise database.
  const needsIntake = equipmentAccess === undefined;
  const today = todayLocalISODate();
  const planIsForToday = currentPlan?.forDate === today;
  const completedToday = recentSessions?.find(
    (s) => s.status === 'completed' && s.planId === currentPlan?.id,
  );
  // Also check recentSessions for one that started today, in case the plan
  // was already cleared after completion.
  const todaysCompletedFallback = recentSessions?.find((s) => {
    if (s.status !== 'completed' || !s.completedAt) return false;
    const d = new Date(s.completedAt);
    return isoDate(d) === today;
  });
  const doneToday = completedToday ?? todaysCompletedFallback;

  const cardState = pickState({
    planIsForToday,
    plan: planIsForToday ? currentPlan : undefined,
    session: currentSession,
    generating,
    doneToday,
  });

  /**
   * Fires the trainer's plan-generation call, persists the plan, and
   * emits the workout-plan-created event so Kael sees it in his next
   * pass.
   */
  async function handleGenerate() {
    if (!trainerId || !isClaudeConfigured()) {
      Alert.alert(
        `${trainerName} offline`,
        'The conversation service needs an API key. See README.',
      );
      return;
    }
    setGenerating(true);
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
      Alert.alert(
        `${trainerName} couldn't put a plan together`,
        'Something went wrong reaching the trainer. Try again in a moment.',
      );
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="title">Training Hub</AppText>
        <AppText variant="label" style={styles.subheading}>
          Training with {trainerName}
        </AppText>

        {needsIntake ? (
          <TrainerIntakeCard
            trainerId={trainerId}
            trainerName={trainerName}
            onComplete={(result: TrainerIntakeResult) => updateUserProfile(result)}
          />
        ) : (
          <WorkoutStateCard
            state={cardState}
            trainerName={trainerName}
            onGenerate={handleGenerate}
            onStart={handleStart}
            onResume={handleResume}
          />
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
              Add EXPO_PUBLIC_ANTHROPIC_API_KEY to bring the trainer to life.
            </AppText>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Determines which face the WorkoutStateCard should render given the
 * store's current shape. Pure function; parent passes the pieces in.
 */
function pickState(args: {
  planIsForToday: boolean;
  plan: WorkoutPlan | undefined;
  session: WorkoutSession | undefined;
  generating: boolean;
  doneToday: WorkoutSession | undefined;
}): Parameters<typeof WorkoutStateCard>[0]['state'] {
  const { planIsForToday, plan, session, generating, doneToday } = args;
  if (doneToday) return { kind: 'completed', session: doneToday };
  if (generating) return { kind: 'generating' };
  if (planIsForToday && plan && session && session.status === 'in-progress') {
    return { kind: 'in-progress', plan, session };
  }
  if (planIsForToday && plan && plan.exercises.length === 0) {
    return { kind: 'rest-day', plan };
  }
  if (planIsForToday && plan) return { kind: 'ready', plan };
  return { kind: 'no-plan' };
}

/** Local YYYY-MM-DD from a Date. Kept private to this file. */
function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
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
