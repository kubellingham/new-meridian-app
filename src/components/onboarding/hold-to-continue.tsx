import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

/**
 * Press-and-hold to continue — Sera's promise moment (onboarding script
 * v3, beat 13), styled per The Practice design system: a brass fill
 * sweeps the track and the label flips to ink past the halfway point.
 * A ~2.5s hold completes; releasing early winds it back. The hold is
 * acceptance of HER promise, not an oath from the user, so nothing here
 * scolds or insists.
 *
 * Accessibility/hardware rules (from the script + design): haptics are
 * garnish — progression never gates on hardware (require + silent-skip,
 * same as the rest timer); the quiet escape is always visible, so motor
 * difficulty or a broken digitizer can't trap anyone.
 */

const HOLD_MS = 2500;
/** Where the label flips from paper to ink as the brass sweeps under it. */
const LABEL_FLIP_AT = 0.45;

function haptic(kind: 'start' | 'done') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    if (kind === 'start') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics unavailable — the visual fill carries the moment alone.
  }
}

export function HoldToContinue({ onComplete }: { onComplete: () => void }) {
  const fill = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const [holding, setHolding] = useState(false);
  const [pastFlip, setPastFlip] = useState(false);

  // Track the flip point so the label color can switch to ink.
  useEffect(() => {
    const id = fill.addListener(({ value }) => setPastFlip(value >= LABEL_FLIP_AT));
    return () => fill.removeListener(id);
  }, [fill]);

  function complete() {
    if (done.current) return;
    done.current = true;
    haptic('done');
    onComplete();
  }

  function handlePressIn() {
    if (done.current) return;
    setHolding(true);
    haptic('start');
    Animated.timing(fill, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false, // animating width
    }).start(({ finished }) => {
      if (finished) complete();
    });
  }

  function handlePressOut() {
    if (done.current) return;
    setHolding(false);
    Animated.timing(fill, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }

  return (
    <View>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Press and hold to continue"
        accessibilityHint="Hold for a few seconds until the bar fills"
        testID="ob-hold"
      >
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fillBar,
              {
                width: fill.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <AppText
            variant="label"
            color={pastFlip ? colors.onPrimary : colors.text}
            style={styles.holdLabel}
          >
            {holding ? 'Keep holding…' : 'Press and hold'}
          </AppText>
        </View>
      </Pressable>
      <Pressable onPress={complete} accessibilityRole="button" testID="ob-hold-escape">
        <AppText variant="caption" color={colors.muted} style={styles.escape}>
          Continue without holding
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: spacing.lg,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
  },
  holdLabel: {
    letterSpacing: 0.5,
  },
  escape: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
