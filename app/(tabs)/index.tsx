import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CalorieSummary } from '@/src/components/diet';
import { TeamNoteCard } from '@/src/components/home/team-note-card';
import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { NS_QUIET_DAY_NUDGES } from '@/src/content/ns-nudges';
import { isClaudeConfigured } from '@/src/services/claude';
import { dailyTotals, entriesForDate, todayLocalISODate } from '@/src/services/food-log';
import {
  generateMorningBrief,
  makeMorningBriefEvent,
  todaysBrief,
  undeliveredBrief,
} from '@/src/services/morning-brief';
import { currentStreak, formatStreak } from '@/src/services/streak';
import { deriveWorkoutState, type WorkoutCardState } from '@/src/services/workout-state';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/**
 * Home — Kael's territory (brief §8). A curated summary, not a dashboard
 * of everything and not a chat surface.
 *
 * Layout: greeting + date, Kael's brief when one is waiting, then the
 * widget grid — calories full-width, weigh-in ▸ streak, today's training
 * ▸ water, the honest Health Connect placeholder, the NS's grounded
 * note, and the consultants' door at the bottom. Everything reads real
 * store data except sleep/steps (device signals arrive with Health
 * Connect).
 */
export default function HomeScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const ns = nsId ? getCharacter(nsId) : null;

  const events = useUserDataStore((s) => s.events);
  const foodLog = useUserDataStore((s) => s.foodLog);
  const nutritionState = useUserDataStore((s) => s.nutritionState);
  const programmeState = useUserDataStore((s) => s.programmeState);
  const currentWeight = useUserDataStore((s) => s.dailySignals.currentWeight);
  const waterMl = useUserDataStore((s) => s.dailySignals.waterMl);
  const goalWeight = useUserDataStore((s) => s.userProfile.goalWeight);
  const hasDataHydrated = useUserDataStore((s) => s.hasHydrated);
  const emitEvent = useUserDataStore((s) => s.emitEvent);
  // Guards against firing a second generation while the first is in flight.
  const generatingBrief = useRef(false);

  // Once per local day, after hydration, Kael prepares a morning brief.
  // It's generated quietly in the background; the Home card appears when
  // it's ready. No brief on a fresh account without an API key.
  useEffect(() => {
    if (!hasDataHydrated || generatingBrief.current) return;
    if (!isClaudeConfigured()) return;
    if (todaysBrief(events)) return; // already have today's

    generatingBrief.current = true;
    generateMorningBrief(name)
      .then((text) => emitEvent(makeMorningBriefEvent(text)))
      .catch((error) => console.warn('Morning brief generation failed:', error))
      .finally(() => {
        generatingBrief.current = false;
      });
    // Intentionally keyed on hydration; events/name read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDataHydrated]);

  const pendingBrief = undeliveredBrief(events);

  const today = todayLocalISODate();
  const todaysEntries = entriesForDate(foodLog ?? [], today);
  const caloriesToday = dailyTotals(todaysEntries).calories;
  const streak = currentStreak(foodLog ?? [], programmeState.recentSessions ?? [], today);
  const workoutState = deriveWorkoutState(programmeState);
  const toGoal =
    currentWeight !== undefined && goalWeight !== undefined
      ? Math.round((currentWeight - goalWeight) * 10) / 10
      : null;
  const waterL = Math.round(((waterMl ?? 0) / 1000) * 10) / 10;

  // The NS note, computed locally (no API on Home): a quiet-day nudge in
  // their voice after midday, the last logged food as plain fact, or
  // their philosophy on a fresh morning.
  const lastEntry = todaysEntries[todaysEntries.length - 1];
  const afternoon = new Date().getHours() >= 12;
  const nsNote = lastEntry
    ? `Last on the board: ${lastEntry.item.name}, ~${Math.round(
        lastEntry.item.caloriesPerServing * lastEntry.servings,
      )} kcal. Tap to talk it through.`
    : afternoon && nsId
      ? NS_QUIET_DAY_NUDGES[nsId]
      : ns
        ? `“${ns.philosophy}”`
        : undefined;

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Quiet greeting — no exclamation, per the brief. */}
        <AppText variant="title">Good day, {name}.</AppText>
        <AppText variant="label" style={styles.subheading}>
          {dateLabel}
        </AppText>

        {/* Kael's morning brief — a passive note, tap to open his chat. */}
        {pendingBrief && (
          <TeamNoteCard
            from="Kael"
            preview={pendingBrief.summary}
            onOpen={() => router.push('/kael')}
          />
        )}

        {/* Calories — real intake vs. target, full width. Tap → Diet. */}
        <Pressable
          onPress={() => router.push('/(tabs)/diet')}
          accessibilityRole="button"
          testID="home-calories"
        >
          <CalorieSummary consumed={caloriesToday} target={nutritionState.calorieTarget} />
        </Pressable>

        {/* Weigh-in ▸ Streak */}
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push('/(tabs)/diet')}
            accessibilityRole="button"
            testID="home-weighin"
            style={styles.half}
          >
            <Card style={styles.widget}>
              <AppText variant="label">Weigh-in</AppText>
              {currentWeight !== undefined ? (
                <>
                  <AppText variant="subtitle" style={styles.widgetValue} testID="home-weight-value">
                    {currentWeight} kg
                  </AppText>
                  <AppText variant="caption">
                    {toGoal === null
                      ? 'No goal weight set.'
                      : toGoal > 0
                        ? `${toGoal} kg to go.`
                        : toGoal < 0
                          ? `${Math.abs(toGoal)} kg past goal.`
                          : 'At your goal.'}
                  </AppText>
                </>
              ) : (
                <>
                  <AppText variant="subtitle" style={styles.widgetValue}>
                    —
                  </AppText>
                  <AppText variant="caption">Tap to log your first weight.</AppText>
                </>
              )}
            </Card>
          </Pressable>

          <View style={styles.half}>
            <Card style={styles.widget}>
              <AppText variant="label">Streak</AppText>
              <AppText
                variant="subtitle"
                style={styles.widgetValue}
                color={streak > 0 ? colors.success : colors.text}
                testID="home-streak-value"
              >
                {formatStreak(streak)}
              </AppText>
              <AppText variant="caption">
                {streak > 0 ? 'Showing up counts.' : 'Log a meal or train to start.'}
              </AppText>
            </Card>
          </View>
        </View>

        {/* Today's training ▸ Water */}
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push('/(tabs)/training')}
            accessibilityRole="button"
            testID="home-training"
            style={styles.half}
          >
            <Card style={styles.widget}>
              <AppText variant="label">Training</AppText>
              <AppText
                variant="subtitle"
                style={styles.widgetValue}
                color={workoutState.kind === 'completed' ? colors.success : colors.text}
                testID="home-training-value"
              >
                {trainingHeadline(workoutState)}
              </AppText>
              <AppText variant="caption">{trainingCaption(workoutState)}</AppText>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/diet')}
            accessibilityRole="button"
            testID="home-water"
            style={styles.half}
          >
            <Card style={styles.widget}>
              <AppText variant="label">Water</AppText>
              <AppText variant="subtitle" style={styles.widgetValue} testID="home-water-value">
                {waterL} L
              </AppText>
              <AppText variant="caption">Tap to add a glass.</AppText>
            </Card>
          </Pressable>
        </View>

        {/* Sleep & steps — honest placeholder until Health Connect lands. */}
        <Card style={[styles.widget, styles.slim]}>
          <View style={styles.slimRow}>
            <AppText variant="label">Sleep & steps</AppText>
            <AppText variant="caption" color={colors.muted}>
              awaiting Health Connect
            </AppText>
          </View>
        </Card>

        {/* The NS's note — locally computed, tap → their space. */}
        {ns && nsNote && (
          <Pressable
            onPress={() => router.push('/diet-chat')}
            accessibilityRole="button"
            testID="home-ns-note"
          >
            <Card tone="panel" style={styles.widget}>
              <AppText variant="label" color={colors.primary}>
                {ns.name}
              </AppText>
              <AppText variant="body" style={styles.widgetValue}>
                {nsNote}
              </AppText>
            </Card>
          </Pressable>
        )}

        {/* Consultants — the standing door to Kael and Sera. */}
        <View style={styles.consultantButtons}>
          <Button
            label="Talk to Kael"
            variant="secondary"
            onPress={() => router.push('/kael')}
            style={styles.consultantButton}
            testID="home-talk-to-kael"
          />
          <Button
            label="Talk to Sera"
            variant="secondary"
            onPress={() => router.push('/sera')}
            style={styles.consultantButton}
            testID="home-talk-to-sera"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Short headline for the compact training widget. */
function trainingHeadline(state: WorkoutCardState): string {
  switch (state.kind) {
    case 'completed':
      return 'Done';
    case 'in-progress':
      return 'In progress';
    case 'rest-day':
      return 'Rest day';
    case 'ready':
      return state.plan.focusArea;
    case 'generating':
      return 'Building…';
    case 'no-plan':
      return 'No session yet';
  }
}

/** Second line for the compact training widget. */
function trainingCaption(state: WorkoutCardState): string {
  switch (state.kind) {
    case 'completed':
      return 'Session finished — good work.';
    case 'in-progress': {
      const done = state.session.logs.filter((l) => l.status === 'completed').length;
      return `${done} of ${state.plan.exercises.length} done — tap to resume.`;
    }
    case 'rest-day':
      return 'Recovery is part of the plan.';
    case 'ready':
      return `~${state.plan.estimatedMinutes} min — tap to start.`;
    case 'generating':
      return 'Your trainer is choosing.';
    case 'no-plan':
      return 'Tap to get one from your trainer.';
  }
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  subheading: {
    marginTop: -spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  widget: {
    flexGrow: 1,
  },
  widgetValue: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  slim: {
    paddingVertical: spacing.sm,
  },
  slimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consultantButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  consultantButton: {
    flex: 1,
  },
});
