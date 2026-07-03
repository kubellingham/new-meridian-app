import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { MealInput } from '@/src/components/diet/meal-input';
import { MessageBubble } from '@/src/components/diet/message-bubble';
import { AppText, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import {
  describeClaudeError,
  getCharacterReply,
  isClaudeConfigured,
} from '@/src/services/claude';
import { makeMessageId, useChatStore, type ChatMessage } from '@/src/store/chat-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/** Sera's stable character id in the roster. */
const SERA_ID = 'sera' as const;

/**
 * Sera's conversation surface — the behavioral consultant (brief §2).
 * Mirrors the Diet Corner chat architecture: persisted thread, scripted
 * greeting seed (no API call), live replies via the Claude service, and
 * the same offline/error states. Reached from Home; pushed over the tabs,
 * so it carries its own back header.
 */
export default function SeraScreen() {
  const name = useUserStore((s) => s.name);
  const threads = useChatStore((s) => s.threads);
  const append = useChatStore((s) => s.append);
  const remove = useChatStore((s) => s.remove);

  const [waiting, setWaiting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const sera = getCharacter(SERA_ID);
  const thread = threads[SERA_ID] ?? [];
  const configured = isClaudeConfigured();

  // Seed the thread with Sera's scripted greeting — static content, no API
  // call, per the "predesigned scripts wherever possible" principle.
  useEffect(() => {
    if (thread.length === 0) {
      append(SERA_ID, {
        id: makeMessageId(),
        role: 'assistant',
        text: "I'm Sera. Whatever today's actually been like — that's what I'm here for. What's on your mind?",
        at: Date.now(),
      });
    }
    // Seeding depends only on the empty-thread state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length]);

  /** Sends a message and appends Sera's live reply (or an error bubble). */
  async function handleSend(text: string) {
    if (waiting) return;

    const userMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'user',
      text,
      at: Date.now(),
    };
    append(SERA_ID, userMessage);
    setWaiting(true);

    try {
      // Send the persisted history plus the new message; the store update
      // above may not be reflected in `thread` yet within this closure.
      const reply = await getCharacterReply(SERA_ID, [...thread, userMessage], name);
      append(SERA_ID, { id: makeMessageId(), role: 'assistant', text: reply, at: Date.now() });
    } catch (error) {
      console.error('Sera conversation request failed:', error);
      append(SERA_ID, {
        id: makeMessageId(),
        role: 'assistant',
        text: describeClaudeError(error),
        at: Date.now(),
        error: true,
      });
    } finally {
      setWaiting(false);
    }
  }

  /** Clears error bubbles so the thread stays clean after a retry. */
  function dismissErrors() {
    thread.filter((m) => m.error).forEach((m) => remove(SERA_ID, m.id));
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with back control — this screen sits above the tabs. */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            testID="sera-back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <AppText variant="subtitle">{sera.name}</AppText>
            <AppText variant="caption">Behavioral Consultant · Meridian</AppText>
          </View>
        </View>

        {/* Offline notice when no API key is configured. */}
        {!configured && (
          <Card style={styles.offline}>
            <AppText variant="label" color={colors.warning}>
              {sera.name} is offline
            </AppText>
            <AppText variant="caption" style={styles.offlineText}>
              Add EXPO_PUBLIC_ANTHROPIC_API_KEY to a .env file and restart to bring the
              conversation to life. See README for details.
            </AppText>
          </Card>
        )}

        <FlatList
          ref={listRef}
          data={thread}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} speakerName={sera.name} />}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onTouchStart={dismissErrors}
        />

        {/* Typing indicator while Sera "thinks". */}
        {waiting && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.muted} />
            <AppText variant="caption">{sera.name} is typing…</AppText>
          </View>
        )}

        <View style={styles.inputWrap}>
          <MealInput
            onSend={handleSend}
            disabled={waiting || !configured}
            placeholder="What's on your mind?"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  offline: {
    margin: spacing.md,
    borderColor: colors.warning,
  },
  offlineText: {
    marginTop: spacing.xs,
  },
  thread: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
