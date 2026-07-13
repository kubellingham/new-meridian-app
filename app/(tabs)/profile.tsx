import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { CONSULTANTS, getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { useChatStore } from '@/src/store/chat-store';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/**
 * Profile — the control panel. Identity, active team, service status, and
 * a reset action so testing can restart cleanly. The profile facts
 * (height, weight, activity, coaching style) are now collected during
 * onboarding; the NS refines them in their own intake.
 */
export default function ProfileScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const trainerId = useUserStore((s) => s.trainerId);
  const resetUser = useUserStore((s) => s.reset);
  const clearChats = useChatStore((s) => s.clearAll);
  const resetUserData = useUserDataStore((s) => s.reset);

  const ns = nsId ? getCharacter(nsId) : null;
  const trainer = trainerId ? getCharacter(trainerId) : null;

  /** Wipes profile, shared data, and conversations, then restarts onboarding. */
  function handleReset() {
    clearChats();
    resetUser();
    resetUserData();
    router.replace('/onboarding');
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
          label="Reset & restart onboarding (dev)"
          variant="secondary"
          onPress={handleReset}
          style={styles.reset}
          testID="profile-reset"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
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
