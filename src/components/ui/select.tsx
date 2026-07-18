import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { colors, radius, spacing } from '@/src/theme/theme';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

type SelectProps<T extends string> = {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessibility name for the field, e.g. "Portion type". */
  label: string;
  testID?: string;
};

/**
 * A small dropdown: a pressable field showing the current choice, and a
 * top-anchored modal list to pick from. For enumerable choices that are
 * too wordy for a chip row.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label }}
        style={styles.field}
        testID={testID}
      >
        <AppText variant="body" style={styles.fieldLabel} numberOfLines={1}>
          {current?.label ?? ''}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.panel}>
            <AppText variant="overline" style={styles.panelTitle}>
              {label}
            </AppText>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  onChange(option.value);
                }}
                accessibilityRole="button"
                style={styles.row}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
              >
                <AppText
                  variant="body"
                  color={option.value === value ? colors.primary : colors.text}
                >
                  {option.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    padding: spacing.lg,
    paddingTop: '22%',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.sm,
  },
  panelTitle: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
});
