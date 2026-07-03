import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme/theme';

type ScreenProps = ViewProps & {
  /** Skip horizontal padding, e.g. for full-bleed lists. */
  noPadding?: boolean;
};

/**
 * Base wrapper for every screen: near-black background plus safe-area
 * top inset. Bottom inset is handled by the tab bar.
 */
export function Screen({ noPadding, style, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.base,
        { paddingTop: insets.top + spacing.sm },
        !noPadding && styles.padded,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.base,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
