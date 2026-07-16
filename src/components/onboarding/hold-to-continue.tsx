import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

/**
 * Press-and-hold to continue — Sera's promise moment (onboarding script
 * v3, beat 13). A ~2.5s hold fills the bar; releasing early winds it
 * back. The hold is acceptance of HER promise, not an oath from the
 * user, so nothing here scolds or insists.
 *
 * Accessibility/hardware rules (from the script): haptics are garnish —
 * progression never gates on hardware (require + silent-skip, same as
 * the rest timer); and a quiet escape appears after a few seconds or an
 * aborted hold, so motor difficulty or a broken digitizer can't trap
 * anyone.
 */

const HOLD_MS = 2500;
/** The quiet escape appears after this long on screen, or an aborted hold. */
const ESCAPE_AFTER_MS = 5000;

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
  const [showEscape, setShowEscape] = useState(false);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowEscape(true), ESCAPE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

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
    setShowEscape(true); // an aborted hold reveals the escape immediately
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
          <AppText variant="label" style={styles.holdLabel}>
            {holding ? 'Keep holding…' : 'Press and hold'}
          </AppText>
        </View>
      </Pressable>
      {showEscape && (
        <Pressable onPress={complete} accessibilityRole="button" testID="ob-hold-escape">
          <AppText variant="caption" color={colors.muted} style={styles.escape}>
            Continue without holding
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: spacing.lg,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  holdLabel: {
    letterSpacing: 0.5,
  },
  escape: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
