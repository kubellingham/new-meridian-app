import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FoodConfirmList } from '@/src/components/diet';
import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { isClaudeConfigured } from '@/src/services/claude';
import { makeFoodLogId, MEAL_SLOTS, todayLocalISODate } from '@/src/services/food-log';
import { getFoodFromPhoto, type ParsedFood } from '@/src/services/food-logging';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, radius, spacing } from '@/src/theme/theme';
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

/**
 * Photo logging — the NS looks at the plate. Take or pick a photo, the
 * NS identifies what's on it and estimates the numbers, the user gets
 * the last word in the confirm list before anything is logged.
 */
export default function FoodPhotoScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const nsId = useUserStore((s) => s.nsId);
  const name = useUserStore((s) => s.name);
  const logFood = useUserDataStore((s) => s.logFood);

  const ns = nsId ? getCharacter(nsId) : null;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [foods, setFoods] = useState<ParsedFood[]>([]);
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
    try {
      const mediaType =
        mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
      const result = await getFoodFromPhoto(nsId, name, base64, mediaType);
      setReply(result.reply || null);
      setFoods(result.foods);
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
          <Card tone="panel" style={styles.replyCard}>
            <AppText variant="label" color={colors.primary}>
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

        {notice && (
          <Card style={styles.noticeCard}>
            <AppText variant="caption" color={colors.warning}>
              {notice}
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
  noticeCard: {
    borderColor: colors.warning,
  },
});
