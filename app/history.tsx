import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/src/components/ui';
import { useUserDataStore } from '@/src/store/user-data-store';
import { colors, spacing } from '@/src/theme/theme';
import type { ExerciseLog, SetLog, WorkoutSession } from '@/src/types/user-data';

/**
 * Training history — a pushed screen listing completed and abandoned
 * sessions, newest first. Tapping a session expands it inline to show
 * the exercises and the sets that were actually logged. Read-only; the
 * store already caps recentSessions at 10.
 */
export default function HistoryScreen() {
  const recentSessions = useUserDataStore((s) => s.programmeState.recentSessions) ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          testID="history-back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="title">Training history</AppText>
      </View>

      {recentSessions.length === 0 ? (
        <Card style={styles.empty}>
          <AppText variant="subtitle">Nothing here yet</AppText>
          <AppText variant="caption" style={styles.emptyBody}>
            Your completed sessions show up here once you&apos;ve trained.
          </AppText>
        </Card>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {recentSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              expanded={expandedId === session.id}
              onToggle={() =>
                setExpandedId(expandedId === session.id ? null : session.id)
              }
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

/** One session in the list — header always visible, detail on expand. */
function SessionCard({
  session,
  expanded,
  onToggle,
}: {
  session: WorkoutSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const abandoned = session.status === 'abandoned';
  const when = session.completedAt ?? session.abandonedAt ?? session.startedAt;
  const durationMin =
    session.completedAt && session.startedAt
      ? Math.max(1, Math.round((session.completedAt - session.startedAt) / 60000))
      : undefined;
  const loggedExercises = session.logs.filter((l) => l.sets.length > 0).length;

  return (
    <Card tone="panel" style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        testID={`history-session-${session.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <AppText variant="subtitle">{session.focusArea ?? 'Session'}</AppText>
            <AppText variant="caption" color={colors.muted} style={styles.cardMeta}>
              {formatWhen(when)}
              {durationMin ? ` · ${durationMin} min` : ''}
              {abandoned ? ' · cut short' : session.sessionFeeling ? ` · felt ${session.sessionFeeling}` : ''}
            </AppText>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.muted}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          {session.logs.map((log) => (
            <ExerciseDetail key={log.plannedExerciseId} log={log} />
          ))}
          {session.sessionNote ? (
            <View style={styles.noteBlock}>
              <AppText variant="caption" color={colors.muted}>
                Note
              </AppText>
              <AppText variant="body" style={styles.noteText}>
                {session.sessionNote}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" color={colors.muted} style={styles.summaryLine}>
            {loggedExercises} of {session.logs.length} exercise
            {session.logs.length === 1 ? '' : 's'} logged.
          </AppText>
        </View>
      )}
    </Card>
  );
}

/** One exercise's logged sets inside an expanded session. */
function ExerciseDetail({ log }: { log: ExerciseLog }) {
  return (
    <View style={styles.exercise}>
      <View style={styles.exerciseHeader}>
        <AppText variant="label">{log.name}</AppText>
        {log.status === 'skipped' && (
          <AppText variant="caption" color={colors.muted}>
            skipped
          </AppText>
        )}
      </View>
      {log.sets.length > 0 ? (
        log.sets.map((set) => (
          <AppText
            key={set.setNumber}
            variant="caption"
            color={colors.muted}
            style={styles.setLine}
          >
            Set {set.setNumber}: {formatSet(set)}
          </AppText>
        ))
      ) : (
        <AppText variant="caption" color={colors.muted} style={styles.setLine}>
          {log.status === 'skipped' ? '—' : 'no sets logged'}
        </AppText>
      )}
      {log.note ? (
        <AppText variant="caption" color={colors.muted} style={styles.setLine}>
          “{log.note}”
        </AppText>
      ) : null}
    </View>
  );
}

/** Renders a single logged set as a compact line. */
function formatSet(set: SetLog): string {
  if (set.durationSeconds !== undefined) return `${set.durationSeconds}s`;
  const parts: string[] = [];
  if (set.weight !== undefined) parts.push(`${set.weight} kg`);
  if (set.reps !== undefined) parts.push(`${set.reps} reps`);
  return parts.length > 0 ? parts.join(' × ') : 'done';
}

/** Short date label for a session timestamp. */
function formatWhen(at: number): string {
  const then = new Date(at);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(then)) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff <= 6) {
    return then.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  empty: {
    marginTop: spacing.lg,
  },
  emptyBody: {
    marginTop: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardMeta: {
    marginTop: spacing.xs,
  },
  detail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  exercise: {
    gap: spacing.xs,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setLine: {
    marginLeft: spacing.sm,
  },
  noteBlock: {
    gap: spacing.xs,
  },
  noteText: {
    fontStyle: 'italic',
  },
  summaryLine: {
    marginTop: spacing.xs,
  },
});
