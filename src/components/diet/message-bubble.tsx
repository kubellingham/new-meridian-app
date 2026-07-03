import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import type { ChatMessage } from '@/src/store/chat-store';
import { colors, radius, spacing } from '@/src/theme/theme';

type MessageBubbleProps = {
  message: ChatMessage;
  /** Display name of the specialist, shown above their messages. */
  speakerName: string;
};

/**
 * One message in a specialist conversation. User messages sit right in a
 * panel bubble; specialist messages sit left on the surface tone with the
 * speaker's name above. Error notices render muted with a warning border.
 */
export function MessageBubble({ message, speakerName }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && !message.error && (
        <AppText variant="caption" color={colors.primary} style={styles.speaker}>
          {speakerName}
        </AppText>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          message.error && styles.bubbleError,
        ]}
      >
        <AppText variant="body" color={message.error ? colors.muted : colors.text}>
          {message.text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  rowUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignSelf: 'flex-start',
  },
  speaker: {
    marginBottom: spacing.xs,
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUser: {
    backgroundColor: colors.panel,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleError: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning,
  },
});
