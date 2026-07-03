import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

/**
 * Diet Corner — the chosen NS's territory, and Meridian's first live AI
 * surface (brief §10). The user logs meals in plain conversational text;
 * the NS replies in character with macros in flowing sentences.
 *
 * The full Diet Corner architecture (tabs, intake, recipe library) comes
 * in later sessions; this session ships the meal-logging conversation.
 */
export default function DietScreen() {
  const name = useUserStore((s) => s.name);
  const nsId = useUserStore((s) => s.nsId);
  const threads = useChatStore((s) => s.threads);
  const append = useChatStore((s) => s.append);
  const remove = useChatStore((s) => s.remove);

  const [waiting, setWaiting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const ns = nsId ? getCharacter(nsId) : null;
  const thread = nsId ? (threads[nsId] ?? []) : [];
  const configured = isClaudeConfigured();

  // Seed the thread with a scripted greeting from the NS — static content,
  // no API call, per the "predesigned scripts wherever possible" principle.
  useEffect(() => {
    if (ns && nsId && thread.length === 0) {
      append(nsId, {
        id: makeMessageId(),
        role: 'assistant',
        text: `I'm ${ns.name}. When you eat something, just tell me about it the way you'd tell a friend — I'll take it from there.`,
        at: Date.now(),
      });
    }
    // Seeding depends only on the empty-thread state for this NS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nsId, thread.length]);

  /** Sends a meal message and appends the NS's live reply (or an error). */
  async function handleSend(text: string) {
    if (!nsId || waiting) return;

    const userMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'user',
      text,
      at: Date.now(),
    };
    append(nsId, userMessage);
    setWaiting(true);

    try {
      // Send the persisted history plus the new message; the store update
      // above may not be reflected in `thread` yet within this closure.
      const reply = await getCharacterReply(nsId, [...thread, userMessage], name);
      append(nsId, { id: makeMessageId(), role: 'assistant', text: reply, at: Date.now() });
    } catch (error) {
      console.error('Meal logging request failed:', error);
      append(nsId, {
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
    if (!nsId) return;
    thread.filter((m) => m.error).forEach((m) => remove(nsId, m.id));
  }

  if (!ns || !nsId) {
    // The setup gate should make this unreachable; render a safe fallback.
    return (
      <Screen>
        <AppText variant="body">Pick a nutrition specialist in setup first.</AppText>
      </Screen>
    );
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* NS header — persistent presence at the top of their space. */}
        <View style={styles.header}>
          <AppText variant="subtitle">{ns.name}</AppText>
          <AppText variant="caption">
            {ns.origin} · Nutrition Specialist
          </AppText>
        </View>

        {/* Offline notice when no API key is configured. */}
        {!configured && (
          <Card style={styles.offline}>
            <AppText variant="label" color={colors.warning}>
              {ns.name} is offline
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
          renderItem={({ item }) => <MessageBubble message={item} speakerName={ns.name} />}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onTouchStart={dismissErrors}
        />

        {/* Typing indicator while the NS "thinks". */}
        {waiting && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.muted} />
            <AppText variant="caption">{ns.name} is typing…</AppText>
          </View>
        )}

        <View style={styles.inputWrap}>
          <MealInput onSend={handleSend} disabled={waiting || !configured} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
