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

import { ChatInput } from '@/src/components/chat/chat-input';
import { MessageBubble } from '@/src/components/chat/message-bubble';
import { AppText, Card, Screen } from '@/src/components/ui';
import { getCharacter, type CharacterId } from '@/src/content/characters';
import {
  describeClaudeError,
  getCharacterReply,
  isClaudeConfigured,
} from '@/src/services/claude';
import { makeMessageId, useChatStore, type ChatMessage } from '@/src/store/chat-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

type CharacterChatProps = {
  /** Which character this surface belongs to. */
  characterId: CharacterId;
  /** Line under the name, e.g. "Lagos, Nigeria · Nutrition Specialist". */
  subtitle: string;
  /** Scripted greeting that seeds an empty thread — static, no API call. */
  greeting: string;
  /** Input placeholder in the character's register. */
  placeholder: string;
  /** Show a back control — for surfaces pushed over the tabs. */
  showBack?: boolean;
};

/**
 * The one conversation surface every Meridian character uses. Holds the
 * persisted thread, scripted greeting seed, live Claude replies, typing
 * indicator, and the offline/error states. Screens are thin wrappers that
 * pass character identity and surface copy.
 */
export function CharacterChat({
  characterId,
  subtitle,
  greeting,
  placeholder,
  showBack,
}: CharacterChatProps) {
  const name = useUserStore((s) => s.name);
  const threads = useChatStore((s) => s.threads);
  const append = useChatStore((s) => s.append);
  const remove = useChatStore((s) => s.remove);

  const [waiting, setWaiting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const character = getCharacter(characterId);
  const thread = threads[characterId] ?? [];
  const configured = isClaudeConfigured();

  // Seed the thread with the scripted greeting — static content, no API
  // call, per the "predesigned scripts wherever possible" principle.
  useEffect(() => {
    if (thread.length === 0) {
      append(characterId, {
        id: makeMessageId(),
        role: 'assistant',
        text: greeting,
        at: Date.now(),
      });
    }
    // Seeding depends only on the empty-thread state for this character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, thread.length]);

  /** Sends a message and appends the character's live reply (or an error). */
  async function handleSend(text: string) {
    if (waiting) return;

    const userMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'user',
      text,
      at: Date.now(),
    };
    append(characterId, userMessage);
    setWaiting(true);

    try {
      // Send the persisted history plus the new message; the store update
      // above may not be reflected in `thread` yet within this closure.
      const reply = await getCharacterReply(characterId, [...thread, userMessage], name);
      append(characterId, {
        id: makeMessageId(),
        role: 'assistant',
        text: reply,
        at: Date.now(),
      });
    } catch (error) {
      console.error(`${character.name} conversation request failed:`, error);
      append(characterId, {
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
    thread.filter((m) => m.error).forEach((m) => remove(characterId, m.id));
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Character header — persistent presence at the top of the space. */}
        <View style={styles.header}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.back}
              testID="chat-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <View>
            <AppText variant="subtitle">{character.name}</AppText>
            <AppText variant="caption">{subtitle}</AppText>
          </View>
        </View>

        {/* Offline notice when no API key is configured. */}
        {!configured && (
          <Card style={styles.offline}>
            <AppText variant="label" color={colors.warning}>
              {character.name} is offline
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
          renderItem={({ item }) => (
            <MessageBubble message={item} speakerName={character.name} />
          )}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onTouchStart={dismissErrors}
        />

        {/* Typing indicator while the character "thinks". */}
        {waiting && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.muted} />
            <AppText variant="caption">{character.name} is typing…</AppText>
          </View>
        )}

        <View style={styles.inputWrap}>
          <ChatInput
            onSend={handleSend}
            disabled={waiting || !configured}
            placeholder={placeholder}
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
