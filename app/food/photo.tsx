import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { FoodConfirmList } from '@/src/components/diet';
import { AppText, Button, Card, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { makeFoodLogId, MEAL_SLOTS, todayLocalISODate } from '@/src/services/food-log';
import {
  getFoodFromPhoto,
  refineFoodFromPhoto,
  type ParsedFood,
  type PhotoExchange,
} from '@/src/services/food-logging';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { hueFor } from '@/src/theme/character-hues';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { MealSlot } from '@/src/types/user-data';

function asMealSlot(value: string | undefined): MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value ?? '')
    ? (value as MealSlot)
    : 'snack';
}

/** Shared picker options — small + base64 so the API call stays lean. */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  base64: true,
  quality: 0.4,
  exif: false,
};

/** The always-present catch-all — the NS can't ask what it didn't spot. */
const CATCH_ALL_QUESTION = 'Anything I missed on the plate?';

type PhotoMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Photo logging — the NS looks at the plate. Take or pick a photo, the
 * NS identifies what's on it and estimates the numbers, then asks
 * (optionally answerable) follow-up questions about what the photo
 * can't show — cooking method, hidden ingredients, oil. Answers refine
 * the estimate; the user always keeps the last word in the confirm
 * list, which never waits on the questions.
 */
export default function FoodPhotoScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const nsId = useUserStore((s) => s.nsId);
  const name = useUserStore((s) => s.name);
  const logFood = useUserDataStore((s) => s.logFood);

  const ns = nsId ? getCharacter(nsId) : null;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<{ base64: string; mediaType: PhotoMediaType } | null>(
    null,
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [foods, setFoods] = useState<ParsedFood[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  /** Draft answers, keyed by question index; last slot is the catch-all. */
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  /** Completed analysis rounds, so refinement rebuilds the whole thread. */
  const [exchanges, setExchanges] = useState<PhotoExchange[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function pick(from: 'camera' | 'library') {
    setNotice(null);
    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setNotice("Couldn't read that image. Try another one.");
      return;
    }
    setPhotoUri(asset.uri);
    await analyze(asset.base64, asset.mimeType);
  }

  async function analyze(base64: string, mimeType: string | undefined) {
    if (!nsId) return;
    setAnalyzing(true);
    setReply(null);
    setFoods([]);
    setFollowUps([]);
    setAnswerDrafts({});
    setExchanges([]);
    try {
      const mediaType: PhotoMediaType =
        mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
      setPhotoData({ base64, mediaType });
      const result = await getFoodFromPhoto(nsId, name, base64, mediaType);
      setReply(result.reply || null);
      setFoods(result.foods);
      setFollowUps(result.followUps);
      if (result.foods.length === 0 && !result.reply) {
        setNotice("Couldn't make out any food in that photo.");
      }
    } catch (e) {
      console.error('Photo analysis failed:', e);
      setNotice('Something went wrong reading the photo. Try again in a moment.');
    } finally {
      setAnalyzing(false);
    }
  }

  /** The question list shown for answering — NS's own + the catch-all. */
  const questions = foods.length > 0 && !analyzing ? [...followUps, CATCH_ALL_QUESTION] : [];
  const answeredPairs = questions
    .map((question, i) => ({ question, answer: (answerDrafts[i] ?? '').trim() }))
    .filter((p) => p.answer.length > 0);

  async function refine() {
    if (!nsId || !photoData || answeredPairs.length === 0) return;
    setRefining(true);
    setNotice(null);
    const round: PhotoExchange = { reply: reply ?? '', foods, answers: answeredPairs };
    try {
      const result = await refineFoodFromPhoto(
        nsId,
        name,
        photoData.base64,
        photoData.mediaType,
        [...exchanges, round],
      );
      setExchanges((prev) => [...prev, round]);
      setReply(result.reply || null);
      // The refined list replaces the old one — but never silently
      // downgrade to nothing if the model came back foodless.
      if (result.foods.length > 0) setFoods(result.foods);
      setFollowUps(result.followUps);
      setAnswerDrafts({});
    } catch (e) {
      console.error('Photo refinement failed:', e);
      setNotice("Couldn't update the estimate just now — the current one still stands.");
    } finally {
      setRefining(false);
    }
  }

  function handleConfirm(reviewed: ParsedFood[]) {
    for (const parsed of reviewed) {
      logFood({
        id: makeFoodLogId(),
        loggedAt: Date.now(),
        forDate: todayLocalISODate(),
        meal: parsed.meal ?? asMealSlot(mealParam),
        source: 'photo',
        servings: parsed.servings,
        item: parsed.item,
        photoUri: photoUri ?? undefined,
      });
    }
    router.back();
  }

  if (!ns || !nsId) {
    return (
      <Screen>
        <AppText variant="body">Meet your nutrition specialist in onboarding first.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="photo-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <AppText variant="title">Photo log</AppText>
          </View>

          {!isClaudeConfigured() && (
            <Card style={styles.noticeCard}>
              <AppText variant="caption" color={colors.warning}>
                {ns.name} is offline — photo logging needs the conversation service.
              </AppText>
            </Card>
          )}

          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
          )}

          {analyzing ? (
            <Card style={styles.analyzingCard}>
              <AppText variant="body">{ns.name} is looking at the plate…</AppText>
            </Card>
          ) : (
            <View style={styles.pickRow}>
              <Button
                label="Take a photo"
                onPress={() => void pick('camera')}
                style={styles.pickButton}
                disabled={!isClaudeConfigured()}
                testID="photo-camera"
              />
              <Button
                label="Choose one"
                variant="secondary"
                onPress={() => void pick('library')}
                style={styles.pickButton}
                disabled={!isClaudeConfigured()}
                testID="photo-library"
              />
            </View>
          )}

          {reply && (
            <Card tone="panel" hairline={hueFor(nsId)} style={styles.replyCard}>
              <AppText variant="speaker" color={hueFor(nsId)}>
                {ns.name}
              </AppText>
              <AppText variant="body" style={styles.replyText}>
                {reply}
              </AppText>
            </Card>
          )}

          {foods.length > 0 && (
            <FoodConfirmList
              foods={foods}
              defaultMeal={asMealSlot(mealParam)}
              onConfirm={handleConfirm}
              confirmLabel="Log the plate"
            />
          )}

          {refining ? (
            <Card style={styles.analyzingCard} testID="photo-refining">
              <AppText variant="body">{ns.name} is thinking it over…</AppText>
            </Card>
          ) : (
            questions.length > 0 && (
              <Card style={styles.questionsCard} testID="photo-questions">
                <AppText variant="overline">Help {ns.name} get it right</AppText>
                <AppText variant="caption" color={colors.muted}>
                  Answer any, skip any — or just log the plate as it stands.
                </AppText>
                {questions.map((question, i) => (
                  <View key={`${question}-${i}`} style={styles.questionField}>
                    <AppText variant="body">{question}</AppText>
                    <TextInput
                      value={answerDrafts[i] ?? ''}
                      onChangeText={(v) =>
                        setAnswerDrafts((prev) => ({ ...prev, [i]: v }))
                      }
                      placeholder="Optional"
                      placeholderTextColor={colors.muted}
                      style={styles.answerInput}
                      testID={`photo-answer-${i}`}
                    />
                  </View>
                ))}
                <Button
                  label="Update the estimate"
                  variant="secondary"
                  onPress={() => void refine()}
                  disabled={answeredPairs.length === 0}
                  testID="photo-refine"
                />
              </Card>
            )
          )}

          {notice && (
            <Card style={styles.noticeCard}>
              <AppText variant="caption" color={colors.warning}>
                {notice}
              </AppText>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButton: {
    padding: spacing.xs,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  pickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickButton: {
    flex: 1,
  },
  analyzingCard: {
    alignItems: 'center',
  },
  replyCard: {
    gap: spacing.xs,
  },
  replyText: {
    fontStyle: 'italic',
  },
  questionsCard: {
    gap: spacing.sm,
  },
  questionField: {
    gap: spacing.xs,
  },
  answerInput: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeCard: {
    borderColor: colors.warning,
  },
});
