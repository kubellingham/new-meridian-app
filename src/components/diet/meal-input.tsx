import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';

type MealInputProps = {
  /** Called with the trimmed text when the user sends. */
  onSend: (text: string) => void;
  /** Disables sending while a reply is in flight or the service is offline. */
  disabled?: boolean;
};

/**
 * The meal-logging input bar: plain conversational text, the way you'd
 * tell a friend what you ate (brief §10).
 */
export function MealInput({ onSend, disabled }: MealInputProps) {
  const [text, setText] = useState('');
  const canSend = !disabled && text.trim().length > 0;

  /** Sends the current text and clears the field. */
  function handleSend() {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <View style={styles.bar}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Tell me what you ate…"
        placeholderTextColor={colors.muted}
        style={styles.input}
        multiline
        editable={!disabled}
        testID="meal-input"
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={[styles.send, !canSend && styles.sendDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Send"
        testID="meal-send"
      >
        <Ionicons name="arrow-up" size={20} color={canSend ? colors.base : colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxHeight: 120,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: colors.panel,
  },
});
