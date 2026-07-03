import { StyleSheet } from 'react-native';

import { AppText, Card, Screen } from '@/src/components/ui';
import { spacing } from '@/src/theme/theme';

/**
 * Insights — where training and nutrition data connect (brief §11).
 * Deliberately last in the roadmap: it summarizes sources that don't
 * exist yet, so V1 ships this placeholder until Training Hub and Diet
 * Corner produce real data.
 */
export default function InsightsScreen() {
  return (
    <Screen>
      <AppText variant="title">Insights</AppText>

      <Card style={styles.card}>
        <AppText variant="subtitle">Nothing to connect yet</AppText>
        <AppText variant="caption" style={styles.body}>
          Insights is where Kael and Sera surface patterns across your training and
          nutrition. It switches on once both spaces are producing data.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
  },
  body: {
    marginTop: spacing.xs,
  },
});
