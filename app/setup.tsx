import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { AppText, Button, Card, Screen } from '@/src/components/ui';
import {
  NUTRITION_SPECIALISTS,
  TRAINERS,
  type CharacterId,
} from '@/src/content/characters';
import { useUserStore } from '@/src/store/user-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';

/**
 * TEMPORARY setup screen — a development stand-in until the scripted
 * onboarding (Meridian_Weight_Loss_Onboarding_Script_v1.md) is built.
 * Collects the bare minimum the app needs to function: a name and a
 * nutrition specialist, plus an optional trainer.
 */
export default function SetupScreen() {
  const completeSetup = useUserStore((s) => s.completeSetup);
  const [name, setName] = useState('');
  const [nsId, setNsId] = useState<CharacterId | null>(null);
  const [trainerId, setTrainerId] = useState<CharacterId | null>(null);

  const canStart = name.trim().length > 0 && nsId !== null;

  /** Persists the choices and enters the app proper. */
  function handleStart() {
    if (!canStart || !nsId) return;
    completeSetup({ name: name.trim(), nsId, trainerId: trainerId ?? undefined });
    router.replace('/(tabs)');
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="title">Meridian</AppText>
          <AppText variant="body" color={colors.muted} style={styles.tagline}>
            Meridian got you covered.
          </AppText>

          <Card style={styles.notice}>
            <AppText variant="caption">
              Temporary setup — the full guided onboarding replaces this screen in a later
              session.
            </AppText>
          </Card>

          <AppText variant="label" style={styles.fieldLabel}>
            What should your team call you?
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="words"
            testID="setup-name"
          />

          <AppText variant="label" style={styles.fieldLabel}>
            Pick your nutrition specialist
          </AppText>
          <AppText variant="caption" style={styles.fieldHint}>
            Choose the voice and food culture that resonates — every specialist handles
            every goal.
          </AppText>
          {NUTRITION_SPECIALISTS.map((ns) => (
            <Pressable key={ns.id} onPress={() => setNsId(ns.id)} testID={`setup-ns-${ns.id}`}>
              <Card
                tone={nsId === ns.id ? 'panel' : 'surface'}
                style={[styles.characterCard, nsId === ns.id && styles.characterCardSelected]}
              >
                <AppText variant="subtitle">{ns.name}</AppText>
                <AppText variant="caption">
                  {ns.origin} · {ns.personalityWords}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.philosophy}>
                  “{ns.philosophy}”
                </AppText>
              </Card>
            </Pressable>
          ))}

          <AppText variant="label" style={styles.fieldLabel}>
            Pick a trainer (optional for now)
          </AppText>
          {TRAINERS.map((trainer) => (
            <Pressable
              key={trainer.id}
              onPress={() => setTrainerId(trainerId === trainer.id ? null : trainer.id)}
              testID={`setup-trainer-${trainer.id}`}
            >
              <Card
                tone={trainerId === trainer.id ? 'panel' : 'surface'}
                style={[
                  styles.characterCard,
                  trainerId === trainer.id && styles.characterCardSelected,
                ]}
              >
                <AppText variant="subtitle">{trainer.name}</AppText>
                <AppText variant="caption">
                  {trainer.origin} · {trainer.personalityWords}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.philosophy}>
                  “{trainer.philosophy}”
                </AppText>
              </Card>
            </Pressable>
          ))}

          <Button
            label="Meet your team"
            onPress={handleStart}
            disabled={!canStart}
            style={styles.startButton}
            testID="setup-start"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  tagline: {
    marginTop: spacing.xs,
  },
  notice: {
    marginTop: spacing.md,
    borderColor: colors.warning,
  },
  fieldLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    marginBottom: spacing.sm,
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
  characterCard: {
    marginBottom: spacing.sm,
  },
  characterCardSelected: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  philosophy: {
    marginTop: spacing.xs,
  },
  startButton: {
    marginTop: spacing.lg,
  },
});
