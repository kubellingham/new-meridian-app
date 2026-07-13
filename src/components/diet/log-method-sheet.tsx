import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

export type LogMethod = 'photo' | 'barcode' | 'database' | 'chat' | 'manual';

type MethodRow = {
  method: LogMethod;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
};

const METHODS: MethodRow[] = [
  { method: 'photo', icon: 'camera-outline', label: 'Snap a photo', hint: 'Your NS looks at the plate and logs it' },
  { method: 'barcode', icon: 'barcode-outline', label: 'Scan a barcode', hint: 'Packaged foods, straight off the label' },
  { method: 'database', icon: 'search-outline', label: 'Search foods', hint: 'Find it in the food database' },
  { method: 'chat', icon: 'chatbubble-ellipses-outline', label: 'Tell your NS', hint: 'Describe it in your own words' },
  { method: 'manual', icon: 'create-outline', label: 'Enter manually', hint: 'Type the numbers yourself' },
];

type LogMethodSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (method: LogMethod) => void;
};

/**
 * The "how do you want to log it?" sheet — five ways in, one log out.
 * A plain modal sheet (no native bottom-sheet dependency) that slides
 * over the dashboard.
 */
export function LogMethodSheet({ visible, onClose, onPick }: LogMethodSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="log-sheet-backdrop">
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <AppText variant="subtitle" style={styles.title}>
            Log food
          </AppText>
          {METHODS.map(({ method, icon, label, hint }) => (
            <Pressable
              key={method}
              onPress={() => onPick(method)}
              accessibilityRole="button"
              style={styles.row}
              testID={`log-method-${method}`}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="body">{label}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {hint}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
