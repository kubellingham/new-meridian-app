import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import type { CharacterId } from '@/src/content/characters';
import { hueFor } from '@/src/theme/character-hues';
import { colors, spacing } from '@/src/theme/theme';

type TeamNoteCardProps = {
  /** Who the note is from, e.g. "Kael". */
  from: string;
  /** Sender id for the character-hue accent; falls back to muted. */
  fromId?: CharacterId;
  /** Optional one-line preview of the note. */
  preview?: string;
  /** Opens the note (navigates to the sender's chat). */
  onOpen: () => void;
};

/**
 * A quiet, passive notification on Home — "Kael has a note for you."
 * Deliberately undemanding: it sits until the user is ready. Generic on
 * purpose so any team member's proactive note (morning brief now; Sera's
 * check-ins, event alerts later) reuses the same surface.
 */
export function TeamNoteCard({ from, fromId, preview, onOpen }: TeamNoteCardProps) {
  const hue = hueFor(fromId);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" testID="team-note-card">
      <Card tone="panel" hairline={hue} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-outline" size={18} color={hue} />
          </View>
          <View style={styles.text}>
            <AppText variant="speaker" color={hue}>
              {from} has a note for you
            </AppText>
            {preview ? (
              <AppText variant="caption" color={colors.muted} style={styles.preview} numberOfLines={2}>
                {preview}
              </AppText>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  preview: {
    marginTop: 2,
  },
});
