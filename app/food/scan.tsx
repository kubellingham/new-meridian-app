import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRef, useState } from 'react';

import { FoodConfirmList } from '@/src/components/diet';
import { AppText, Button, Card, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
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

/** One light tap the moment a barcode is recognized. Native only. */
function buzz() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics unavailable — skip silently.
  }
}

/** The scanner's visible state — one machine instead of flag sprawl. */
type ScanStatus =
  | { kind: 'scanning' }
  | { kind: 'looking-up'; barcode: string }
  | { kind: 'found'; item: FoodItem; corrected?: boolean }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'error'; message: string };

/**
 * Barcode scanning → Open Food Facts lookup → confirm → log.
 *
 * Capture is automatic — the frame overlay, the haptic at detection, and
 * the status line make that legible. A product missing from the database
 * is a fork, not a dead end: photograph it (the NS identifies it) or add
 * it manually.
 */
export default function FoodScanScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const logFood = useUserDataStore((s) => s.logFood);
  const foodCorrections = useUserDataStore((s) => s.foodCorrections);
  const saveFoodCorrection = useUserDataStore((s) => s.saveFoodCorrection);
  const [permission, requestPermission] = useCameraPermissions();

  const [status, setStatus] = useState<ScanStatus>({ kind: 'scanning' });
  // Ref (not state) so the continuous scanner callback throttles
  // synchronously — state updates land too late to stop the flood.
  const busyRef = useRef(false);

  const meal = asMealSlot(mealParam);

  async function handleScanned(barcode: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    buzz(); // the phone reacts the instant the code is seen
    // The user's own fix for this product outranks the database — and
    // covers products the database doesn't know at all.
    const correction = (foodCorrections ?? {})[barcode];
    if (correction) {
      setStatus({ kind: 'found', item: correction.item, corrected: true });
      return;
    }
    setStatus({ kind: 'looking-up', barcode });
    try {
      const item = await lookupBarcode(barcode);
      if (item) {
        setStatus({ kind: 'found', item });
        // stays busy — confirm list is up; "Scan another" resets
      } else {
        setStatus({ kind: 'not-found', barcode });
        // stays busy — the fork card is up; "Scan again" resets
      }
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Lookup failed.',
      });
    }
  }

  /** Back to live scanning (from not-found / error / found states). */
  function resumeScanning() {
    setStatus({ kind: 'scanning' });
    busyRef.current = false;
  }

  function handleConfirm(foods: ParsedFood[]) {
    for (const parsed of foods) {
      logFood({
        id: makeFoodLogId(),
        loggedAt: Date.now(),
        forDate: todayLocalISODate(),
        meal: parsed.meal ?? meal,
        source: 'barcode',
        servings: parsed.servings,
        item: parsed.item,
      });
    }
    router.back();
  }

  const scanningActive = status.kind === 'scanning' || status.kind === 'looking-up';

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
              testID="scan-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <AppText variant="title">Scan a barcode</AppText>
          </View>

          {status.kind === 'found' ? (
            <>
              {status.corrected && (
                <AppText variant="caption" color={colors.muted} testID="scan-corrected-note">
                  Your saved version of this product — edit below to change it.
                </AppText>
              )}
              <FoodConfirmList
                foods={[{ item: status.item, servings: 1 }]}
                defaultMeal={meal}
                onConfirm={handleConfirm}
                onCorrection={saveFoodCorrection}
              />
              <Button
                label="Scan another instead"
                variant="ghost"
                onPress={resumeScanning}
                testID="scan-again"
              />
            </>
          ) : status.kind === 'not-found' ? (
            <Card tone="panel" style={styles.forkCard}>
              <AppText variant="subtitle">Not in the database</AppText>
              <AppText variant="caption" color={colors.muted} style={styles.forkBody}>
                Barcode {status.barcode} isn&apos;t listed yet — happens a lot with local
                products. Two good ways forward:
              </AppText>
              <Button
                label="Photograph it instead"
                onPress={() =>
                  router.replace({ pathname: '/food/photo', params: { meal } })
                }
                testID="scan-to-photo"
              />
              <Button
                label="Add manually"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/food/manual',
                    // Carrying the barcode lets manual entry remember the
                    // product, so this scan never dead-ends again.
                    params: { meal, barcode: status.barcode },
                  })
                }
                testID="scan-to-manual"
              />
              <Button
                label="Scan again"
                variant="ghost"
                onPress={resumeScanning}
                testID="scan-retry"
              />
            </Card>
          ) : status.kind === 'error' ? (
            <Card style={styles.errorCard}>
              <AppText variant="label" color={colors.warning}>
                Lookup failed
              </AppText>
              <AppText variant="caption" style={styles.forkBody}>
                {status.message}
              </AppText>
              <Button label="Try again" variant="secondary" onPress={resumeScanning} testID="scan-error-retry" />
              <Button
                label="Add manually"
                variant="ghost"
                onPress={() =>
                  router.replace({ pathname: '/food/manual', params: { meal } })
                }
              />
            </Card>
          ) : !permission?.granted ? (
            <Card style={styles.permissionCard}>
              <AppText variant="body">Meridian needs the camera to read barcodes.</AppText>
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
                  onBarcodeScanned={
                    scanningActive ? ({ data }) => void handleScanned(data) : undefined
                  }
                />
                {/* Scan frame — capture is automatic; the frame + status make
                    the camera read as a scanner, not a viewfinder. */}
                <View pointerEvents="none" style={styles.overlay}>
                  <View
                    style={[
                      styles.frame,
                      status.kind === 'looking-up' && styles.frameActive,
                    ]}
                  />
                </View>
              </View>
              <View style={styles.statusRow}>
                {status.kind === 'looking-up' ? (
                  <AppText variant="label" color={colors.primary} style={styles.statusText}>
                    Found it — checking the database…
                  </AppText>
                ) : (
                  <AppText variant="caption" color={colors.muted} style={styles.statusText}>
                    Line the barcode up in the frame — it captures by itself.
                  </AppText>
                )}
              </View>
            </>
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
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  camera: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '78%',
    height: '38%',
    borderWidth: 2,
    borderColor: 'rgba(244,239,230,0.55)',
    borderRadius: radius.md,
  },
  frameActive: {
    borderColor: colors.primary,
  },
  statusRow: {
    alignItems: 'center',
  },
  statusText: {
    textAlign: 'center',
  },
  forkCard: {
    gap: spacing.sm,
  },
  forkBody: {
    marginBottom: spacing.xs,
  },
  errorCard: {
    borderColor: colors.warning,
    gap: spacing.sm,
  },
  permissionCard: {
    gap: spacing.md,
  },
  permissionButton: {
    marginTop: spacing.xs,
  },
});
