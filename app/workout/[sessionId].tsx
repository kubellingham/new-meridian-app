import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  CurrentExercisePanel,
  exerciseInputMode,
  FeelingPicker,
  type LoggedSetValues,
  SetLogRow,
} from '@/src/components/workout';
import { AppText, Button, Card, Screen } from '@/src/components/ui';
import type { CharacterId } from '@/src/content/characters';
import { makeEventId } from '@/src/services/events';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { SetLog, WorkoutSession } from '@/src/types/user-data';

/**
 * The workout runner — one exercise in focus, set-by-set logging,
 * advance to next when done. Pushed screen over the tab bar.
 *
 * State model: the current exercise ordinal is local (parent decides what
 * to render); the actual logs are in the store so leaving mid-session
 * preserves progress via the Resume flow on the Hub.
 */
export default function WorkoutRunnerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const currentPlan = useUserDataStore((s) => s.programmeState.currentPlan);
  const currentSession = useUserDataStore((s) => s.programmeState.currentSession);
  const logSet = useUserDataStore((s) => s.logSet);
  const removeSet = useUserDataStore((s) => s.removeSet);
  const updateExerciseLog = useUserDataStore((s) => s.updateExerciseLog);
  const completeSession = useUserDataStore((s) => s.completeSession);
  const abandonSession = useUserDataStore((s) => s.abandonSession);
  const emitEvent = useUserDataStore((s) => s.emitEvent);
  const trainerId = useUserStore((s) => s.trainerId);
  const nsId = useUserStore((s) => s.nsId);

  const [ordinal, setOrdinal] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [feeling, setFeeling] = useState<WorkoutSession['sessionFeeling']>(undefined);
  const [sessionNote, setSessionNote] = useState('');
  const [exerciseNote, setExerciseNote] = useState('');
  const [exerciseNoteFor, setExerciseNoteFor] = useState<string | null>(null);

  const exercises = currentPlan?.exercises ?? [];
  const logs = currentSession?.logs ?? [];
  const currentExercise = exercises[ordinal];
  const currentLog = useMemo(
    () => logs.find((l) => l.plannedExerciseId === currentExercise?.id),
    [logs, currentExercise],
  );

  // Guard: session/plan gone. Kick back to the Hub.
  if (
    !currentSession ||
    !currentPlan ||
    currentSession.id !== sessionId ||
    exercises.length === 0
  ) {
    return (
      <Screen>
        <BackHeader />
        <Card style={styles.emptyCard}>
          <AppText variant="subtitle">Session not found</AppText>
          <AppText variant="caption" style={styles.emptyBody}>
            The workout you were running isn&apos;t open anymore. Head back to Training and
            start again if you&apos;d like.
          </AppText>
          <Button
            label="Back to Training"
            variant="secondary"
            onPress={() => router.back()}
          />
        </Card>
      </Screen>
    );
  }

  const setsLogged = currentLog?.sets.length ?? 0;
  const targetSets = currentExercise.targetSets;
  const isLastExercise = ordinal >= exercises.length - 1;
  const inputMode = exerciseInputMode(currentExercise);

  /** Toggles the collapsed per-exercise note field. */
  function toggleExerciseNote() {
    if (!currentExercise) return;
    if (exerciseNoteFor === currentExercise.id) {
      // Persist and collapse.
      updateExerciseLog(currentExercise.id, { note: exerciseNote.trim() || undefined });
      setExerciseNoteFor(null);
      setExerciseNote('');
    } else {
      setExerciseNoteFor(currentExercise.id);
      setExerciseNote(currentLog?.note ?? '');
    }
  }

  /** Logs one set for the current exercise. */
  function handleLogSet(values: LoggedSetValues) {
    if (!currentExercise) return;
    const setNumber = setsLogged + 1;
    const set: SetLog = {
      setNumber,
      weight: values.weight,
      reps: values.reps,
      durationSeconds: values.durationSeconds,
    };
    logSet(currentExercise.id, set);
    // Reaching the prescribed count reads as done; below it, in-progress.
    // Sets aren't mandatory, so this is a hint, not a gate.
    if (setNumber >= targetSets) {
      updateExerciseLog(currentExercise.id, { status: 'completed' });
    } else {
      updateExerciseLog(currentExercise.id, { status: 'in-progress' });
    }
  }

  /** Removes one set (un-tick or swipe-delete). */
  function handleRemoveSet(setNumber: number) {
    if (!currentExercise) return;
    removeSet(currentExercise.id, setNumber);
  }

  /** Marks the exercise skipped and advances. */
  function handleSkip() {
    if (!currentExercise) return;
    updateExerciseLog(currentExercise.id, { status: 'skipped' });
    if (isLastExercise) setShowSummary(true);
    else setOrdinal(ordinal + 1);
  }

  /**
   * Advances to the next exercise or opens the summary. Sets are never
   * mandatory: if the user logged anything at all, we call the exercise
   * done; if they logged nothing and move on, it stays as-is.
   */
  function handleNextExercise() {
    if (currentExercise && currentLog && currentLog.sets.length > 0 && currentLog.status !== 'skipped') {
      updateExerciseLog(currentExercise.id, { status: 'completed' });
    }
    if (isLastExercise) {
      setShowSummary(true);
    } else {
      setOrdinal(ordinal + 1);
    }
  }

  /** Wraps up the session — saves + fires the completion event + exits. */
  function handleSaveSession() {
    // Snapshot before completeSession clears currentPlan/currentSession.
    const planSnapshot = currentPlan;
    const sessionSnapshot = currentSession;
    completeSession(feeling, sessionNote.trim() || undefined);
    if (trainerId && sessionSnapshot && planSnapshot) {
      const durationMin =
        Math.max(1, Math.round((Date.now() - sessionSnapshot.startedAt) / 60000));
      const focus = planSnapshot.focusArea;
      const feelBit = feeling ? ` felt ${feeling}` : '';
      const recipients: CharacterId[] = nsId
        ? ['kael', 'sera', nsId]
        : ['kael', 'sera'];
      emitEvent({
        id: makeEventId(),
        at: Date.now(),
        from: trainerId,
        to: recipients,
        kind: 'workout-completed',
        summary: `${focus} done — ${durationMin} min,${feelBit}`.trim(),
        reasoning: sessionNote.trim() || undefined,
        seenBy: [],
      });
    }
    router.back();
  }

  /** Aborts the session (still recorded, marked abandoned). */
  function handleAbandon() {
    Alert.alert(
      'End session early?',
      "The partial log will be saved and your team will see the session was cut short.",
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End early',
          style: 'destructive',
          onPress: () => {
            abandonSession();
            if (trainerId && currentSession) {
              emitEvent({
                id: makeEventId(),
                at: Date.now(),
                from: trainerId,
                to: ['sera', 'kael'],
                kind: 'workout-abandoned',
                summary: `Session cut short — ${logs.filter((l) => l.status === 'completed').length}/${exercises.length} exercises done`,
                seenBy: [],
              });
            }
            router.back();
          },
        },
      ],
    );
  }

  if (showSummary) {
    return (
      <SessionSummary
        planFocus={currentPlan.focusArea}
        feeling={feeling}
        onFeelingChange={setFeeling}
        sessionNote={sessionNote}
        onSessionNoteChange={setSessionNote}
        onSave={handleSaveSession}
      />
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader />
        <ProgressStrip current={ordinal + 1} total={exercises.length} />
        <CurrentExercisePanel
          exercise={currentExercise}
          log={currentLog ?? {
            plannedExerciseId: currentExercise.id,
            name: currentExercise.name,
            status: 'pending',
            sets: [],
          }}
          ordinal={ordinal + 1}
          total={exercises.length}
        />

        {/* Set rows: prescribed count, plus a trailing empty row so extra
            sets can always be added. Logged rows can be un-ticked or
            swiped away. Nothing here is mandatory. */}
        {Array.from({ length: Math.max(targetSets, setsLogged + 1) }).map((_, i) => {
          const setNumber = i + 1;
          const logged = setNumber <= setsLogged;
          const active = setNumber === setsLogged + 1;
          const loggedValues = logged
            ? currentLog?.sets.find((s) => s.setNumber === setNumber)
            : undefined;
          return (
            <SetLogRow
              key={`${currentExercise.id}-${setNumber}`}
              setNumber={setNumber}
              mode={inputMode}
              logged={logged}
              active={active}
              logged_values={loggedValues}
              onLog={handleLogSet}
              onRemove={() => handleRemoveSet(setNumber)}
            />
          );
        })}

        <View style={styles.subActions}>
          <Pressable onPress={toggleExerciseNote} style={styles.subAction} testID="toggle-note">
            <Ionicons name="create-outline" size={18} color={colors.muted} />
            <AppText variant="label" color={colors.muted}>
              {exerciseNoteFor === currentExercise.id ? 'Save note' : 'Add note'}
            </AppText>
          </Pressable>
          <AppText variant="caption" color={colors.muted} style={styles.hint}>
            Swipe a logged set to delete it. Do what feels right today.
          </AppText>
        </View>

        {exerciseNoteFor === currentExercise.id && (
          <TextInput
            value={exerciseNote}
            onChangeText={setExerciseNote}
            placeholder="How did that feel? Any pain, form thoughts, cues that worked?"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.noteInput}
            testID="exercise-note"
          />
        )}

        <Button
          label={isLastExercise ? 'Finish session' : 'Next exercise'}
          onPress={handleNextExercise}
          style={styles.primaryAction}
          testID="next-exercise"
        />

        <View style={styles.footerActions}>
          <Button
            label="Skip this exercise"
            variant="ghost"
            onPress={handleSkip}
            testID="skip-exercise"
          />
          <Button
            label="End session early"
            variant="ghost"
            onPress={handleAbandon}
            testID="abandon-session"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Small back-arrow header — the runner is pushed, so we need this. */
function BackHeader() {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backButton}
        testID="workout-back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Progress strip: linear bar + "n of N" label. */
function ProgressStrip({ current, total }: { current: number; total: number }) {
  const pct = Math.min(1, Math.max(0, current / total));
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
      <AppText variant="caption" color={colors.muted}>
        Exercise {current} of {total}
      </AppText>
    </View>
  );
}

/** Post-session summary — felt-rating + optional note + save. */
function SessionSummary({
  planFocus,
  feeling,
  onFeelingChange,
  sessionNote,
  onSessionNoteChange,
  onSave,
}: {
  planFocus: string;
  feeling: WorkoutSession['sessionFeeling'];
  onFeelingChange: (f: NonNullable<WorkoutSession['sessionFeeling']>) => void;
  sessionNote: string;
  onSessionNoteChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader />
        <AppText variant="title">Session done</AppText>
        <AppText variant="label" color={colors.muted} style={styles.summarySubtitle}>
          {planFocus}
        </AppText>

        <Card style={styles.summaryCard} tone="panel">
          <AppText variant="label">How did it feel?</AppText>
          <View style={styles.feelingWrap}>
            <FeelingPicker value={feeling} onChange={onFeelingChange} />
          </View>

          <AppText variant="label" style={styles.summaryLabel}>
            Anything worth saying? (optional)
          </AppText>
          <TextInput
            value={sessionNote}
            onChangeText={onSessionNoteChange}
            placeholder="Energy, form, pain, whatever's on your mind."
            placeholderTextColor={colors.muted}
            multiline
            style={styles.noteInput}
            testID="session-note"
          />
        </Card>

        <Button
          label="Save session"
          onPress={onSave}
          style={styles.primaryAction}
          testID="save-session"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  emptyCard: {
    marginTop: spacing.lg,
  },
  emptyBody: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  progressContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  subActions: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  subAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  hint: {
    marginTop: spacing.xs,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 80,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  primaryAction: {
    marginTop: spacing.md,
  },
  footerActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  summarySubtitle: {
    marginTop: spacing.xs,
  },
  summaryCard: {
    marginTop: spacing.lg,
  },
  feelingWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    marginBottom: spacing.sm,
  },
});
