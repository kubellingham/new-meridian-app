import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { CONSULTANTS, getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { useChatStore } from '@/src/store/chat-store';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { UserProfile } from '@/src/types/user-data';

type ActivityLevel = NonNullable<UserProfile['activityLevel']>;

const ACTIVITY_OPTIONS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
];

/**
 * Profile — the control panel. Identity, active team, service status,
 * a temporary "About you" form that feeds the shared user data schema,
 * and a reset action so testing can restart cleanly.
 */
export default function ProfileScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const trainerId = useUserStore((s) => s.trainerId);
  const resetUser = useUserStore((s) => s.reset);
  const clearChats = useChatStore((s) => s.clearAll);
  const userProfile = useUserDataStore((s) => s.userProfile);
  const updateUserProfile = useUserDataStore((s) => s.updateUserProfile);
  const resetUserData = useUserDataStore((s) => s.reset);

  const ns = nsId ? getCharacter(nsId) : null;
  const trainer = trainerId ? getCharacter(trainerId) : null;

  /** Wipes profile, shared data, and conversations, then returns to setup. */
  function handleReset() {
    clearChats();
    resetUser();
    resetUserData();
    router.replace('/setup');
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

      <AboutYouSection userProfile={userProfile} onSave={updateUserProfile} />

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
      </ScrollView>
    </Screen>
  );
}

/**
 * Temporary "About you" form — populates the shared user data schema so
 * specialists have real facts to reference. Replaced by the scripted
 * onboarding intakes once that lands.
 */
function AboutYouSection({
  userProfile,
  onSave,
}: {
  userProfile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  // Local buffer so the user can type freely; commit on blur/save button.
  const [birthday, setBirthday] = useState(userProfile.birthday ?? '');
  const [height, setHeight] = useState(userProfile.height?.toString() ?? '');
  const [startingWeight, setStartingWeight] = useState(
    userProfile.startingWeight?.toString() ?? '',
  );
  const [goalWeight, setGoalWeight] = useState(userProfile.goalWeight?.toString() ?? '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    userProfile.activityLevel ?? null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reflect external changes (e.g. reset action) back into the form buffer.
  useEffect(() => {
    setBirthday(userProfile.birthday ?? '');
    setHeight(userProfile.height?.toString() ?? '');
    setStartingWeight(userProfile.startingWeight?.toString() ?? '');
    setGoalWeight(userProfile.goalWeight?.toString() ?? '');
    setActivityLevel(userProfile.activityLevel ?? null);
  }, [userProfile]);

  /** Persists the current buffer into the shared user data store. */
  function handleSave() {
    // Weight-loss is the V1 goal — set it here so downstream references
    // ("your goal weight") land in a coherent user profile.
    const patch: Partial<UserProfile> = { primaryGoal: 'weight-loss' };

    const trimmedBirthday = birthday.trim();
    if (trimmedBirthday.length > 0) patch.birthday = trimmedBirthday;

    const heightNum = Number(height);
    if (Number.isFinite(heightNum) && heightNum > 0) patch.height = heightNum;

    const startWeightNum = Number(startingWeight);
    if (Number.isFinite(startWeightNum) && startWeightNum > 0) {
      patch.startingWeight = startWeightNum;
    }

    const goalWeightNum = Number(goalWeight);
    if (Number.isFinite(goalWeightNum) && goalWeightNum > 0) {
      patch.goalWeight = goalWeightNum;
    }

    if (activityLevel) patch.activityLevel = activityLevel;

    onSave(patch);
    setSavedAt(Date.now());
  }

  return (
    <Card style={styles.card}>
      <AppText variant="label">About you</AppText>
      <AppText variant="caption" style={styles.aboutHint}>
        Temporary form until the scripted onboarding lands. Fill in what you&apos;re
        comfortable sharing — your team uses this to talk to you like a real person.
      </AppText>

      <AppText variant="label" style={styles.fieldLabel}>
        Birthday
      </AppText>
      <TextInput
        value={birthday}
        onChangeText={setBirthday}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        style={styles.input}
        testID="profile-birthday"
        autoCorrect={false}
      />

      <AppText variant="label" style={styles.fieldLabel}>
        Height (cm)
      </AppText>
      <TextInput
        value={height}
        onChangeText={setHeight}
        placeholder="e.g. 178"
        placeholderTextColor={colors.muted}
        style={styles.input}
        keyboardType="numeric"
        testID="profile-height"
      />

      <AppText variant="label" style={styles.fieldLabel}>
        Starting weight (kg)
      </AppText>
      <TextInput
        value={startingWeight}
        onChangeText={setStartingWeight}
        placeholder="e.g. 92"
        placeholderTextColor={colors.muted}
        style={styles.input}
        keyboardType="numeric"
        testID="profile-starting-weight"
      />

      <AppText variant="label" style={styles.fieldLabel}>
        Goal weight (kg)
      </AppText>
      <TextInput
        value={goalWeight}
        onChangeText={setGoalWeight}
        placeholder="e.g. 78"
        placeholderTextColor={colors.muted}
        style={styles.input}
        keyboardType="numeric"
        testID="profile-goal-weight"
      />

      <AppText variant="label" style={styles.fieldLabel}>
        Activity level
      </AppText>
      <View style={styles.activityRow}>
        {ACTIVITY_OPTIONS.map((level) => (
          <Button
            key={level}
            label={level}
            variant={activityLevel === level ? 'primary' : 'secondary'}
            onPress={() => setActivityLevel(level)}
            style={styles.activityButton}
            testID={`profile-activity-${level}`}
          />
        ))}
      </View>

      <Button
        label="Save"
        onPress={handleSave}
        style={styles.saveButton}
        testID="profile-save-about"
      />
      {savedAt !== null && (
        <AppText variant="caption" color={colors.success} style={styles.savedNote}>
          Saved — your team can reference this now.
        </AppText>
      )}
    </Card>
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
  aboutHint: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
  },
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  activityButton: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  savedNote: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  reset: {
    marginTop: spacing.xl,
  },
});
