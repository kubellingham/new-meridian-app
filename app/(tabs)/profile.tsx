import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { CONSULTANTS, getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { useChatStore } from '@/src/store/chat-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/**
 * Profile — the control panel. Identity, active team, service status,
 * and (for now) a reset action so testing can restart cleanly. Goals,
 * subscription, and settings arrive in later sessions.
 */
export default function ProfileScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const trainerId = useUserStore((s) => s.trainerId);
  const resetUser = useUserStore((s) => s.reset);
  const clearChats = useChatStore((s) => s.clearAll);

  const ns = nsId ? getCharacter(nsId) : null;
  const trainer = trainerId ? getCharacter(trainerId) : null;

  /** Wipes profile and conversations, then returns to setup. */
  function handleReset() {
    clearChats();
    resetUser();
    router.replace('/setup');
  }

  return (
    <Screen>
      <AppText variant="title">{name}</AppText>
      <AppText variant="label" style={styles.goal}>
        Goal: weight loss
      </AppText>

      <Card style={styles.card}>
        <AppText variant="label">Your team</AppText>
        {/* Both consultants are on every user's team (brief §2). */}
        {CONSULTANTS.map((c) => (
          <AppText key={c.id} variant="body" style={styles.teamRow}>
            {c.name} — {c.id === 'kael' ? 'operations consultant' : 'behavioral consultant'}
          </AppText>
        ))}
        <AppText variant="body" style={styles.teamRow}>
          {ns ? `${ns.name} — nutrition specialist` : 'No nutrition specialist chosen'}
        </AppText>
        <AppText variant="body" style={styles.teamRow}>
          {trainer ? `${trainer.name} — trainer` : 'No trainer chosen yet'}
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="label">Conversation service</AppText>
        <AppText
          variant="body"
          style={styles.teamRow}
          color={isClaudeConfigured() ? colors.success : colors.warning}
        >
          {isClaudeConfigured() ? 'Connected' : 'Offline — no API key configured'}
        </AppText>
      </Card>

      <Button
        label="Reset setup (dev)"
        variant="secondary"
        onPress={handleReset}
        style={styles.reset}
        testID="profile-reset"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  goal: {
    marginTop: spacing.xs,
  },
  card: {
    marginTop: spacing.lg,
  },
  teamRow: {
    marginTop: spacing.sm,
  },
  reset: {
    marginTop: spacing.xl,
  },
});
