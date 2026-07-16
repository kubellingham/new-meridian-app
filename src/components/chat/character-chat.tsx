import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ChatInput } from '@/src/components/chat/chat-input';
import { MessageBubble } from '@/src/components/chat/message-bubble';
import { AppText, Card, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
import { getCharacter, type CharacterId } from '@/src/content/characters';
import {
  describeClaudeError,
  getCharacterReply,
  getReturnGreeting,
  isClaudeConfigured,
  type CharacterReply,
} from '@/src/services/claude';
import { speak, stopSpeaking, voiceConfigured } from '@/src/services/voice';
import { makeMessageId, useChatStore, type ChatMessage } from '@/src/store/chat-store';
import { useSettingsStore } from '@/src/store/settings-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, radius, spacing } from '@/src/theme/theme';

type CharacterChatProps = {
  /** Which character this surface belongs to. */
  characterId: CharacterId;
  /** Line under the name, e.g. "Lagos, Nigeria · Nutrition Specialist". */
  subtitle: string;
  /** Scripted first-meeting greeting — used the very first visit, no API. */
  greeting: string;
  /** Short in-voice opener for a quick return (recent visit), no API. */
  returnGreeting: string;
  /** Input placeholder in the character's register. */
  placeholder: string;
  /** Show a back control — for surfaces pushed over the tabs. */
  showBack?: boolean;
  /**
   * A proactive opening message (e.g. Kael's morning brief) to seed this
   * visit with instead of the scripted greeting. Appended once on visit
   * init; onOpeningDelivered fires so the caller can mark it delivered.
   */
  pendingOpening?: { id: string; text: string };
  /** Called with the opening's id after it's been shown. */
  onOpeningDelivered?: (id: string) => void;
  /**
   * Replaces the default reply call — surfaces with side channels (e.g.
   * the NS chat, whose replies can also log food via a tool) fetch their
   * own reply and handle the extras, returning the text to show plus any
   * quick-reply suggestions.
   */
  fetchReply?: (history: ChatMessage[]) => Promise<CharacterReply>;
  /**
   * Conversation starters shown as tappable chips while this visit has
   * no user message yet — so nobody stares at an empty input wondering
   * what a trainer can even be asked.
   */
  starterPrompts?: string[];
};

/** How recently the user must have visited to skip the API return greeting. */
const RECENT_VISIT_MS = 3 * 60 * 60 * 1000; // 3 hours
/** Most present-moment messages shown at once before older ones fall away. */
const MAX_VISIBLE = 5;
/** Opacity by recency — index 0 is the newest (current) message. */
const OPACITY_RAMP = [1, 0.5, 0.28, 0.16, 0.09];

/** Builds an assistant message for the given text. */
function assistantMessage(text: string): ChatMessage {
  return { id: makeMessageId(), role: 'assistant', text, at: Date.now() };
}

/**
 * Fades a message to its target opacity — in on mount, and down as newer
 * messages push it further back. Core RN Animated for cross-platform
 * reliability; deliberately no motion beyond the fade (function over form).
 */
function FadingMessage({ target, children }: { target: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: target,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [target, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/**
 * The one conversation surface every Meridian character uses — the
 * present-moment model (locked design). The user sees the current exchange
 * prominently, with the last few messages of THIS visit fading above; no
 * long scrollable thread. Each visit opens fresh with the specialist
 * speaking. But the full history persists and is sent on every API call,
 * so the specialist genuinely remembers — the gap between what's shown
 * (a fresh visit) and what's known (everything) is the whole point.
 */
export function CharacterChat({
  characterId,
  subtitle,
  greeting,
  returnGreeting,
  placeholder,
  showBack,
  pendingOpening,
  onOpeningDelivered,
  fetchReply,
  starterPrompts,
}: CharacterChatProps) {
  const name = useUserStore((s) => s.name);
  const threads = useChatStore((s) => s.threads);
  const append = useChatStore((s) => s.append);
  const remove = useChatStore((s) => s.remove);
  const setLastVisit = useChatStore((s) => s.setLastVisit);
  const hasHydrated = useChatStore((s) => s.hasHydrated);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const toggleVoice = useSettingsStore((s) => s.toggleVoice);

  const [waiting, setWaiting] = useState(false);
  const [greetingLoading, setGreetingLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Quick replies from the character's last message — cleared on send.
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  // Index in the full thread where this visit began; messages from here on
  // are the visible present-moment view. Null until the visit initializes.
  const [visitStart, setVisitStart] = useState<number | null>(null);
  const initialized = useRef(false);

  const character = getCharacter(characterId);
  const thread = threads[characterId] ?? [];
  const configured = isClaudeConfigured();
  const voiceAvailable = voiceConfigured();

  // Stop playback when leaving the screen.
  useEffect(() => stopSpeaking, []);

  // Fresh-visit greeting: runs once, after the store has rehydrated so a
  // returning user's history (and last-visit time) is actually available.
  useEffect(() => {
    if (!hasHydrated || initialized.current) return;
    initialized.current = true;

    const state = useChatStore.getState();
    const existing = state.threads[characterId] ?? [];
    const boundary = existing.length;
    const last = state.lastVisitAt[characterId];
    const now = Date.now();

    setVisitStart(boundary);
    setLastVisit(characterId, now);

    // A proactive opening (e.g. a morning brief) takes precedence over any
    // scripted greeting — it IS Kael's opening line for this visit.
    if (pendingOpening) {
      append(characterId, assistantMessage(pendingOpening.text));
      onOpeningDelivered?.(pendingOpening.id);
      return;
    }

    if (boundary === 0) {
      // First-ever visit — scripted first-meeting greeting, no API.
      append(characterId, assistantMessage(greeting));
      return;
    }

    const recentlyHere = last !== undefined && now - last < RECENT_VISIT_MS;
    if (recentlyHere || !configured) {
      // Quick return (or no API available) — short static opener.
      append(characterId, assistantMessage(returnGreeting));
      return;
    }

    // Returning after a gap — a contextual greeting that can reference
    // prior conversations, generated from the full history.
    setGreetingLoading(true);
    getReturnGreeting(characterId, existing, name)
      .then((text) => append(characterId, assistantMessage(text)))
      .catch((error) => {
        console.warn('Return greeting failed, using static opener:', error);
        append(characterId, assistantMessage(returnGreeting));
      })
      .finally(() => setGreetingLoading(false));
    // Intentionally runs on hydration only; other deps are read via getState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  /** Sends a message and appends the character's live reply (or an error). */
  async function handleSend(text: string) {
    if (waiting || greetingLoading) return;

    const userMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'user',
      text,
      at: Date.now(),
    };
    append(characterId, userMessage);
    setWaiting(true);
    setSuggestedReplies([]); // chips answer the previous question only
    stopSpeaking(); // a new message supersedes any reply still being spoken

    try {
      // Full persisted history goes to the API — the specialist's memory —
      // even though the UI only shows this visit.
      const fullHistory = [...(useChatStore.getState().threads[characterId] ?? [])];
      const reply = fetchReply
        ? await fetchReply(fullHistory)
        : await getCharacterReply(characterId, fullHistory, name);
      append(characterId, assistantMessage(reply.text));
      setSuggestedReplies(reply.suggestedReplies);
      if (voiceEnabled && voiceAvailable) {
        void speak(characterId, reply.text);
      }
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

  /** Clears error bubbles so the view stays clean after a retry. */
  function dismissErrors() {
    thread.filter((m) => m.error).forEach((m) => remove(characterId, m.id));
  }

  // The present-moment slice: this visit's messages, capped, newest last.
  const visitMessages = visitStart == null ? [] : thread.slice(visitStart);
  const visible = visitMessages.slice(-MAX_VISIBLE);
  const busy = waiting || greetingLoading;

  // Chips above the input: the character's quick replies win; otherwise
  // starter prompts carry a fresh visit until the first message is sent.
  const visitHasUserMessage = visitMessages.some((m) => m.role === 'user');
  const chips =
    suggestedReplies.length > 0
      ? { kind: 'reply' as const, items: suggestedReplies }
      : !visitHasUserMessage && configured && (starterPrompts?.length ?? 0) > 0
        ? { kind: 'starter' as const, items: starterPrompts! }
        : null;

  // Full history for the overlay — every persisted turn, errors omitted.
  const fullHistory = thread.filter((m) => !m.error);

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
        {/* Character header — persistent presence at the top of the space. */}
        <View style={styles.header}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.iconButton}
              testID="chat-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.headerText}>
            <AppText variant="subtitle">{character.name}</AppText>
            <AppText variant="caption">{subtitle}</AppText>
          </View>

          {/* Discrete history access — subtle, not a prominent button. */}
          <Pressable
            onPress={() => setHistoryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Conversation history"
            style={styles.iconButton}
            testID="chat-history"
          >
            <Ionicons name="time-outline" size={22} color={colors.muted} />
          </Pressable>

          {/* Mute toggle — only when a voice key is configured. */}
          {voiceAvailable && (
            <Pressable
              onPress={() => {
                if (voiceEnabled) stopSpeaking();
                toggleVoice();
              }}
              accessibilityRole="button"
              accessibilityLabel={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
              style={styles.iconButton}
              testID="chat-voice-toggle"
            >
              <Ionicons
                name={voiceEnabled ? 'volume-high' : 'volume-mute'}
                size={22}
                color={voiceEnabled ? colors.primary : colors.muted}
              />
            </Pressable>
          )}
        </View>

        {/* Offline notice when no API key is configured. */}
        {!configured && (
          <Card style={styles.offline}>
            <AppText variant="label" color={colors.warning}>
              {character.name} is offline
            </AppText>
            <AppText variant="caption" style={styles.offlineText}>
              Meridian&apos;s service is unreachable right now. Check your connection —
              or update the app if this keeps happening.
            </AppText>
          </Card>
        )}

        {/* Present-moment view: current message at the bottom (full opacity),
            this visit's prior messages fading upward. No scrolling. */}
        <View style={styles.presentView} onTouchStart={dismissErrors}>
          {visible.map((message, i) => {
            const fromEnd = visible.length - 1 - i;
            const target = OPACITY_RAMP[Math.min(fromEnd, OPACITY_RAMP.length - 1)];
            return (
              <FadingMessage key={message.id} target={target}>
                <MessageBubble message={message} speakerName={character.name} />
              </FadingMessage>
            );
          })}
        </View>

        {/* Typing indicator while the character composes a greeting or reply. */}
        {busy && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.muted} />
            <AppText variant="caption">{character.name} is typing…</AppText>
          </View>
        )}

        {/* Tappable chips: quick replies to the character's question, or
            conversation starters on a fresh visit. Tapping sends as text —
            typing stays available either way. */}
        {chips && !busy && (
          <View style={styles.chipRow}>
            {chips.items.map((chip, i) => (
              <Pressable
                key={`${chips.kind}-${chip}`}
                onPress={() => handleSend(chip)}
                accessibilityRole="button"
                testID={`chip-${chips.kind}-${i}`}
              >
                <View style={styles.chip}>
                  <AppText variant="caption" color={colors.text}>
                    {chip}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.inputWrap}>
          <ChatInput
            onSend={handleSend}
            disabled={busy || !configured}
            placeholder={placeholder}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Discrete full-history overlay — available, not pushed. */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setHistoryOpen(false)}
      >
        <Screen noPadding>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="subtitle">Full conversation</AppText>
              <AppText variant="caption">with {character.name}</AppText>
            </View>
            <Pressable
              onPress={() => setHistoryOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close history"
              style={styles.iconButton}
              testID="chat-history-close"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {fullHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <AppText variant="caption">No conversation yet.</AppText>
            </View>
          ) : (
            <FlatList
              data={fullHistory}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <MessageBubble message={item} speakerName={character.name} />
              )}
              contentContainerStyle={styles.historyList}
            />
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
  },
  iconButton: {
    padding: spacing.xs,
  },
  offline: {
    margin: spacing.md,
    borderColor: colors.warning,
  },
  offlineText: {
    marginTop: spacing.xs,
  },
  presentView: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  historyList: {
    padding: spacing.md,
  },
  emptyHistory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
