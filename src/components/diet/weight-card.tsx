import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/src/components/ui';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';

type WeightCardProps = {
  /** Most recent logged weight in kg; undefined = never logged. */
  currentWeight?: number;
  /** Goal weight for context, if set. */
  goalWeight?: number;
  onLog: (weightKg: number) => void;
};

/**
 * Weight quick-log — the number that steers everything (targets, the
 * team's read on progress). Tap the card, type the number, done.
 */
export function WeightCard({ currentWeight, goalWeight, onLog }: WeightCardProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function handleSave() {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 20 && parsed < 400) {
      onLog(Math.round(parsed * 10) / 10);
      setOpen(false);
      setValue('');
    }
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setValue(currentWeight !== undefined ? String(currentWeight) : '');
          setOpen(true);
        }}
        accessibilityRole="button"
        testID="weight-card"
      >
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <AppText variant="label">Weight</AppText>
            <AppText variant="caption" color={colors.muted}>
              tap to log
            </AppText>
          </View>
          <View style={styles.valueRow}>
            <AppText variant="subtitle" testID="weight-value">
              {currentWeight !== undefined ? `${currentWeight} kg` : 'Not logged yet'}
            </AppText>
            {goalWeight !== undefined && (
              <AppText variant="caption" color={colors.muted}>
                goal {goalWeight} kg
              </AppText>
            )}
          </View>
        </Card>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={() => undefined}>
            <AppText variant="subtitle">Log weight</AppText>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="kg"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={styles.input}
              autoFocus
              testID="weight-input"
            />
            <Button label="Save" onPress={handleSave} testID="weight-save" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.subtitle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
});
