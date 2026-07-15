import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/src/components/ui';
import {
  getCharacter,
  getTrainersForGoal,
  type CharacterId,
} from '@/src/content/characters';
import { SPECIALIST_ONBOARDING } from '@/src/content/onboarding/flows';
import { colors, spacing } from '@/src/theme/theme';

interface Props {
  /** Who left — drives Kael's explanation and which roster to offer. */
  retiredTrainerId: CharacterId;
  /** The user's name, for {NAME} tokens in the intros. */
  userName: string;
  /** Called when the user commits to a new trainer. */
  onCommit: (trainerId: CharacterId) => void;
}

/**
 * The trainer re-pick surface, shown by the Training Hub when a roster
 * change retired the user's trainer (trainerId null + retiredTrainerId
 * set). Kael explains honestly, then the current roster is offered with
 * the same meet → intro → commit mechanic as onboarding, reusing
 * SPECIALIST_ONBOARDING content.
 */
export function TrainerRepickCard({ retiredTrainerId, userName, onCommit }: Props) {
  const [meeting, setMeeting] = useState<CharacterId | null>(null);
  const [committed, setCommitted] = useState(false);

  const retired = getCharacter(retiredTrainerId);
  const roster = getTrainersForGoal(retired.goalSpecialty ?? 'weight-loss');

  const fill = (line: string) => line.replace(/\{NAME\}/g, userName.trim() || 'there');

  // Committed: the new trainer's commit lines, then hand back to the Hub.
  if (committed && meeting) {
    return (
      <Card style={styles.card}>
        <AppText variant="label" color={colors.primary}>
          {getCharacter(meeting).name}
        </AppText>
        {SPECIALIST_ONBOARDING[meeting].commit.map((line, i) => (
          <AppText key={i} variant="body" style={styles.line}>
            {fill(line)}
          </AppText>
        ))}
        <Button
          label="To the Training Hub"
          onPress={() => onCommit(meeting)}
          style={styles.cta}
          testID="repick-done"
        />
      </Card>
    );
  }

  // Meeting one: their intro + choose / back.
  if (meeting) {
    const met = getCharacter(meeting);
    return (
      <Card style={styles.card}>
        <AppText variant="label" color={colors.primary}>
          {met.name}
        </AppText>
        {SPECIALIST_ONBOARDING[meeting].intro.map((line, i) => (
          <AppText key={i} variant="body" style={styles.line}>
            {fill(line)}
          </AppText>
        ))}
        <Button
          label={`Choose ${met.name}`}
          onPress={() => setCommitted(true)}
          style={styles.cta}
          testID="repick-choose"
        />
        <Button
          label="Back to the roster"
          variant="secondary"
          onPress={() => setMeeting(null)}
          style={styles.ctaSecondary}
          testID="repick-back"
        />
      </Card>
    );
  }

  // Kael's honest explanation above the roster.
  return (
    <View>
      <Card style={styles.card} testID="repick-note">
        <AppText variant="label" color={colors.primary}>
          Kael
        </AppText>
        <AppText variant="body" style={styles.line}>
          A staffing note, and I&apos;ll be straight with you: {retired.name} has moved on from
          Meridian. Your history is safe — nothing you logged goes anywhere.
        </AppText>
        <AppText variant="body" style={styles.line}>
          The weight-loss bench looks different now. Five coaches, and they genuinely don&apos;t
          agree with each other about the method. They all get people to the same place — they
          just don&apos;t agree on the road. That&apos;s not a problem. It&apos;s why you get to
          choose.
        </AppText>
        <AppText variant="body" style={styles.line}>
          Meet whoever you like. The right one is whoever feels right to you.
        </AppText>
      </Card>
      {roster.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => setMeeting(c.id)}
          accessibilityRole="button"
          testID={`repick-roster-${c.id}`}
        >
          <Card style={styles.rosterCard}>
            <AppText variant="subtitle">{c.fullName ?? c.name}</AppText>
            <AppText variant="caption">
              {c.origin} · {c.personalityWords}
            </AppText>
            <AppText variant="body" color={colors.muted} style={styles.philosophy}>
              “{c.philosophy}”
            </AppText>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
  },
  line: {
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  cta: {
    marginTop: spacing.lg,
  },
  ctaSecondary: {
    marginTop: spacing.xs,
  },
  rosterCard: {
    marginTop: spacing.md,
  },
  philosophy: {
    marginTop: spacing.xs,
  },
});
