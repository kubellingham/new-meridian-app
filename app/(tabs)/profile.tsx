import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, Platform, ScrollView, StyleSheet } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { CONSULTANTS, getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { useChatStore } from '@/src/store/chat-store';
import { useOnboardingStore } from '@/src/store/onboarding-store';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/** App version as built (from app.json via expo-constants). */
const APP_VERSION = Constants.expoConfig?.version ?? 'dev';

/** Tester feedback lands on WhatsApp — number set in app.json extra. */
const FEEDBACK_WHATSAPP: string | undefined = (
  Constants.expoConfig?.extra as { feedbackWhatsApp?: string } | undefined
)?.feedbackWhatsApp;

/**
 * Profile — the control panel. Identity, active team, service status, and
 * a reset action so testing can restart cleanly. The profile facts
 * (height, weight, activity, coaching style) are now collected during
 * onboarding; the NS refines them in their own intake.
 */
/** Display labels for the three goal paths. */
const GOAL_LABELS: Record<string, string> = {
  'weight-loss': 'weight loss',
  'build-muscle': 'building muscle',
  'general-fitness': 'general fitness',
};

export default function ProfileScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const trainerId = useUserStore((s) => s.trainerId);
  const primaryGoal = useUserDataStore((s) => s.userProfile.primaryGoal);
  const resetUser = useUserStore((s) => s.reset);
  const clearChats = useChatStore((s) => s.clearAll);
  const resetUserData = useUserDataStore((s) => s.reset);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const ns = nsId ? getCharacter(nsId) : null;
  const trainer = trainerId ? getCharacter(trainerId) : null;

  /** Wipes profile, shared data, and conversations, then restarts onboarding. */
  function handleReset() {
    clearChats();
    resetUser();
    resetUserData();
    resetOnboarding();
    router.replace('/onboarding');
  }

  /** Opens WhatsApp with a prefilled report — the tester feedback channel. */
  async function handleFeedback() {
    // Digits-only international format (e.g. 2557XXXXXXXX) — the app.json
    // placeholder deliberately fails this check until it's filled in.
    if (!FEEDBACK_WHATSAPP || !/^\d{6,15}$/.test(FEEDBACK_WHATSAPP)) {
      Alert.alert('Feedback', 'No feedback contact is configured in this build.');
      return;
    }
    const prefill = encodeURIComponent(
      `Meridian feedback\nVersion ${APP_VERSION} · ${Platform.OS} ${Platform.Version}\n\nWhat happened:\n`,
    );
    const url = `https://wa.me/${FEEDBACK_WHATSAPP}?text=${prefill}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Feedback', 'Could not open WhatsApp on this device.');
    }
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
          Goal: {(primaryGoal && GOAL_LABELS[primaryGoal]) || 'not set yet'}
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
            {isClaudeConfigured() ? 'Connected' : 'Offline — check your connection or update the app'}
          </AppText>
        </Card>

        <Card style={styles.card} testID="profile-about">
          <AppText variant="label">About Meridian</AppText>
          <AppText variant="caption" style={styles.teamRow}>
            Version {APP_VERSION} · early tester build
          </AppText>
          <AppText variant="caption" style={styles.aboutNote}>
            Your Meridian team is AI. They know their craft and they know you, but they can
            be wrong — treat everything here as coaching guidance, never medical advice.
            Everything you log stays on this phone; conversations are processed by the AI
            service to generate replies.
          </AppText>
        </Card>

        <Button
          label="Send feedback"
          variant="secondary"
          onPress={handleFeedback}
          style={styles.feedback}
          testID="profile-feedback"
        />

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
  aboutNote: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  feedback: {
    marginTop: spacing.lg,
  },
  reset: {
    marginTop: spacing.md,
  },
});
