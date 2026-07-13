import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FoodConfirmList } from '@/src/components/diet';
import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { lookupBarcode } from '@/src/services/food-database';
import { makeFoodLogId, MEAL_SLOTS, todayLocalISODate } from '@/src/services/food-log';
import type { ParsedFood } from '@/src/services/food-logging';
import { useUserDataStore } from '@/src/store/user-data-store';
import { colors, radius, spacing } from '@/src/theme/theme';
import type { FoodItem, MealSlot } from '@/src/types/user-data';

function asMealSlot(value: string | undefined): MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value ?? '')
    ? (value as MealSlot)
    : 'snack';
}

/**
 * Barcode scanning → Open Food Facts lookup → confirm → log. The camera
 * pauses after each hit so one product isn't logged five times while
 * the user reads the result.
 */
export default function FoodScanScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const logFood = useUserDataStore((s) => s.logFood);
  const [permission, requestPermission] = useCameraPermissions();

  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<FoodItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Ref (not state) so the scanner callback throttles synchronously.
  const busyRef = useRef(false);

  async function handleScanned(barcode: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setLooking(true);
    setNotice(null);
    try {
      const item = await lookupBarcode(barcode);
      if (item) {
        setFound(item);
      } else {
        setNotice("That product isn't in the database. You can add it manually.");
        busyRef.current = false; // allow another scan
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Lookup failed.');
      busyRef.current = false;
    } finally {
      setLooking(false);
    }
  }

  function handleConfirm(foods: ParsedFood[]) {
    for (const parsed of foods) {
      logFood({
        id: makeFoodLogId(),
        loggedAt: Date.now(),
        forDate: todayLocalISODate(),
        meal: parsed.meal ?? asMealSlot(mealParam),
        source: 'barcode',
        servings: parsed.servings,
        item: parsed.item,
      });
    }
    router.back();
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
            testID="scan-back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <AppText variant="title">Scan a barcode</AppText>
        </View>

        {found ? (
          <FoodConfirmList
            foods={[{ item: found, servings: 1 }]}
            defaultMeal={asMealSlot(mealParam)}
            onConfirm={handleConfirm}
          />
        ) : !permission?.granted ? (
          <Card style={styles.permissionCard}>
            <AppText variant="body">
              Meridian needs the camera to read barcodes.
            </AppText>
            <Button
              label="Allow camera"
              onPress={() => void requestPermission()}
              style={styles.permissionButton}
              testID="scan-allow-camera"
            />
          </Card>
        ) : (
          <>
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
                }}
                onBarcodeScanned={({ data }) => void handleScanned(data)}
              />
            </View>
            <AppText variant="caption" color={colors.muted} style={styles.hint}>
              {looking ? 'Looking it up…' : 'Point the camera at the product barcode.'}
            </AppText>
          </>
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
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  camera: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  hint: {
    textAlign: 'center',
  },
  permissionCard: {
    gap: spacing.md,
  },
  permissionButton: {
    marginTop: spacing.xs,
  },
  noticeCard: {
    borderColor: colors.warning,
  },
});
