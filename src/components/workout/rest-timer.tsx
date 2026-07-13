import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

type RestTimerProps = {
  /** Seconds to count down from. */
  seconds: number;
  /** Called when the countdown reaches zero or the user dismisses it. */
  onDone: () => void;
};

/** Formats a second-count as m:ss (or s when under a minute). */
function formatRemaining(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A non-blocking rest countdown shown after logging a set. It never
 * gets in the way — the user can log the next set at any time (the
 * runner unmounts it) or skip it here. On native it buzzes once when
 * time's up; web just resolves silently.
 */
export function RestTimer({ seconds, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  // Keep the latest onDone without resetting the interval each render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          buzz();
          onDoneRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = seconds > 0 ? remaining / seconds : 0;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Ionicons name="timer-outline" size={18} color={colors.primary} />
        <AppText variant="label" color={colors.primary} style={styles.label}>
          Rest · {formatRemaining(remaining)}
        </AppText>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Skip rest"
          style={styles.skip}
          testID="rest-skip"
        >
          <AppText variant="label" color={colors.muted}>
            Skip
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/** One light buzz when the rest ends. Native only; a no-op on web. */
function buzz() {
  if (Platform.OS === 'web') return;
  // Lazy-require so the web bundle never pulls the native module.
  try {
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics unavailable — silently skip.
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  track: {
    height: 3,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  skip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
