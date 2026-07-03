import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/**
 * Home — Kael's territory (brief §8). A curated summary, not a dashboard
 * of everything and not a chat surface.
 *
 * V1 default widgets for a weight-loss user, in order: calorie ring,
 * weekly weigh-in, streak, sleep score, steps, NS daily suggestion.
 * All values are static placeholders this session; real data (food logs,
 * Health Connect) arrives in later sessions.
 */
export default function HomeScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const ns = nsId ? getCharacter(nsId) : null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Quiet greeting — no exclamation, per the brief. */}
        <AppText variant="title">Good day, {name}.</AppText>
        <AppText variant="label" style={styles.subheading}>
          Here&apos;s where things stand.
        </AppText>

        {/* Sera entry point — temporary placement until Home widgets are
            designed properly; the goal is just that she's reachable. */}
        <Card tone="panel" style={styles.widget}>
          <AppText variant="label" color={colors.primary}>
            Sera · Behavioral Consultant
          </AppText>
          <AppText variant="body" style={styles.seraLine}>
            The person behind the numbers is her whole job.
          </AppText>
          <Button
            label="Talk to Sera"
            variant="secondary"
            onPress={() => router.push('/sera')}
            testID="home-talk-to-sera"
          />
        </Card>

        {/* 1. Daily calorie ring (placeholder numbers). */}
        <Card style={styles.widget}>
          <AppText variant="label">Calories today</AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero">1,420</AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              of 2,100
            </AppText>
          </View>
          <AppText variant="caption">Logging connects this widget in a later session.</AppText>
        </Card>

        {/* 2. Weekly weigh-in. */}
        <Card style={styles.widget}>
          <AppText variant="label">Weekly weigh-in</AppText>
          <AppText variant="subtitle" style={styles.widgetValue}>
            Sunday morning
          </AppText>
          <AppText variant="caption">No entries yet.</AppText>
        </Card>

        {/* 3. Streak counter. */}
        <Card style={styles.widget}>
          <AppText variant="label">Streak</AppText>
          <AppText variant="subtitle" style={styles.widgetValue} color={colors.success}>
            Day 1
          </AppText>
          <AppText variant="caption">Every day you show up counts once.</AppText>
        </Card>

        {/* 4 & 5. Sleep and steps — Health Connect in a later session. */}
        <View style={styles.row}>
          <Card style={[styles.widget, styles.half]}>
            <AppText variant="label">Sleep</AppText>
            <AppText variant="subtitle" style={styles.widgetValue}>
              —
            </AppText>
            <AppText variant="caption">Awaiting Health Connect</AppText>
          </Card>
          <Card style={[styles.widget, styles.half]}>
            <AppText variant="label">Steps</AppText>
            <AppText variant="subtitle" style={styles.widgetValue}>
              —
            </AppText>
            <AppText variant="caption">Awaiting device sensors</AppText>
          </Card>
        </View>

        {/* 6. NS daily suggestion, in the chosen NS's voice (static for now). */}
        {ns && (
          <Card tone="panel" style={styles.widget}>
            <AppText variant="label" color={colors.primary}>
              {ns.name}
            </AppText>
            <AppText variant="body" style={styles.widgetValue}>
              “{ns.philosophy}”
            </AppText>
            <AppText variant="caption">
              Daily suggestions start once meals are being logged in the Diet tab.
            </AppText>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  subheading: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  widget: {
    marginBottom: spacing.md,
  },
  seraLine: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  widgetValue: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  heroSuffix: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
});
