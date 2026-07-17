import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { HoldToContinue } from '@/src/components/onboarding/hold-to-continue';
import { AppText, Button, Card, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
import {
  getCharacter,
  getCharactersByRole,
  getTrainersForGoal,
  type CharacterId,
} from '@/src/content/characters';
import {
  buildOnboardingFlow,
  NS_TRADITION,
  SPECIALIST_ONBOARDING,
  type CardOption,
  type OnboardingBeat,
} from '@/src/content/onboarding/flows';
import { computeTargets } from '@/src/services/nutrition-targets';
import { useOnboardingStore } from '@/src/store/onboarding-store';
import { hueFor } from '@/src/theme/character-hues';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { PrimaryGoal, UserProfile } from '@/src/types/user-data';

type Answers = Record<string, string>;
type Ctx = { name?: string; trainer?: string; ns?: string };

/** Fills {NAME}/{TRAINER}/{NS} tokens from what's been collected so far. */
function interpolate(text: string, ctx: Ctx): string {
  return text
    .replace(/\{NAME\}/g, ctx.name?.trim() || 'there')
    .replace(/\{TRAINER\}/g, ctx.trainer ?? 'your trainer')
    .replace(/\{NS\}/g, ctx.ns ?? 'your specialist');
}

/** Speaker header + spoken lines, styled like a quiet chat bubble. */
function SpokenLines({
  speaker,
  lines,
  ctx,
}: {
  speaker: CharacterId;
  lines: string[];
  ctx: Ctx;
}) {
  return (
    <Card tone="panel" hairline={hueFor(speaker)} style={styles.speech}>
      <AppText variant="speaker" color={hueFor(speaker)} style={styles.speaker}>
        {getCharacter(speaker).name}
      </AppText>
      {lines.map((line, i) => (
        <AppText key={i} variant="body" style={styles.line}>
          {interpolate(line, ctx)}
        </AppText>
      ))}
    </Card>
  );
}

/**
 * Scripted first-run — a text-forward walk of Kael and Sera's beats
 * (content in src/content/onboarding/flows.ts). Collects name, birthday,
 * gender, goal, activity, height/weight/goal-weight, the emotional read,
 * coaching style, trainer, and NS; writes them into the real stores at
 * the end, computes targets, and lands on Home. No Claude API calls —
 * every line is pre-written per the locked script.
 */
export default function OnboardingScreen() {
  // Progress is persisted (see onboarding-store); don't render — and
  // never flash step one — until rehydration says where the user was.
  const hasHydrated = useOnboardingStore((s) => s.hasHydrated);
  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.base }} />;
  }
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const completeSetup = useUserStore((s) => s.completeSetup);
  const updateUserProfile = useUserDataStore((s) => s.updateUserProfile);
  const updateNutritionState = useUserDataStore((s) => s.updateNutritionState);
  const logWeight = useUserDataStore((s) => s.logWeight);
  const updateSessionFeedback = useUserDataStore((s) => s.updateSessionFeedback);
  const emotionalCheckIns = useUserDataStore((s) => s.sessionFeedback.emotionalCheckIns);

  // Progress lives in the persisted onboarding store so backgrounding or
  // process death mid-flow resumes at the same beat with answers intact.
  const storedStepIndex = useOnboardingStore((s) => s.stepIndex);
  const answers = useOnboardingStore((s) => s.answers);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const mergeAnswers = useOnboardingStore((s) => s.mergeAnswers);
  const resetProgress = useOnboardingStore((s) => s.reset);
  // 'prompt' collects input; 'reacted' shows the speaker's response, then advances.
  const [subPhase, setSubPhase] = useState<'prompt' | 'reacted'>('prompt');
  const [reactionLines, setReactionLines] = useState<string[]>([]);

  // Per-beat input state — reset on every advance/back.
  const [textValue, setTextValue] = useState('');
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  // Bumped per field when input is rejected — drives the shake animation.
  const [dateShakes, setDateShakes] = useState({ day: 0, month: 0, year: 0 });
  const [numberValues, setNumberValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [showFreeText, setShowFreeText] = useState(false);
  const [metCharacter, setMetCharacter] = useState<CharacterId | null>(null);
  const [committed, setCommitted] = useState(false);

  // The chosen goal shapes the beats after the goal question; the shared
  // prefix is identical, so rebuilding mid-walk keeps stepIndex valid.
  const goal = (answers.goal as PrimaryGoal | undefined) ?? 'weight-loss';
  const flow = useMemo(() => buildOnboardingFlow(goal), [goal]);
  // Clamp a restored index in case a future update ever shortens the flow.
  const stepIndex = Math.min(storedStepIndex, flow.length - 1);
  const beat = flow[stepIndex];
  const total = flow.length;

  const ctx: Ctx = useMemo(
    () => ({
      name: answers.name,
      trainer: answers.trainer ? getCharacter(answers.trainer as CharacterId).name : undefined,
      ns: answers.ns ? getCharacter(answers.ns as CharacterId).name : undefined,
    }),
    [answers],
  );

  /**
   * Applies a birthday field edit with shake-and-clear: digits that can
   * never become a valid day/month/year (74, 56, 3000) are rejected the
   * moment they're typed — the field shakes and empties. When all three
   * parts complete an impossible date, the culprit gets the shake: the
   * day for a calendar overflow (31/02), the year for a future date.
   */
  function updateDatePart(part: 'day' | 'month' | 'year', value: string) {
    function reject(field: 'day' | 'month' | 'year', next: typeof dateParts) {
      setDateParts({ ...next, [field]: '' });
      setDateShakes((s) => ({ ...s, [field]: s[field] + 1 }));
    }
    if (value !== '' && !isPlausibleDatePart(part, value)) {
      return reject(part, dateParts);
    }
    const next = { ...dateParts, [part]: value };
    const complete =
      Number(next.day) >= 1 && Number(next.month) >= 1 && next.year.length === 4;
    if (value !== '' && complete && !isValidDate(next)) {
      const y = Number(next.year);
      const date = new Date(y, Number(next.month) - 1, Number(next.day));
      const realButFuture = date.getDate() === Number(next.day) && date.getFullYear() === y;
      return reject(realButFuture ? 'year' : 'day', next);
    }
    setDateParts(next);
  }

  function resetInputs() {
    setSubPhase('prompt');
    setReactionLines([]);
    setTextValue('');
    setDateParts({ day: '', month: '', year: '' });
    setDateShakes({ day: 0, month: 0, year: 0 });
    setNumberValues({});
    setFreeText('');
    setShowFreeText(false);
    setMetCharacter(null);
    setCommitted(false);
  }

  function advance() {
    if (stepIndex < total - 1) {
      setStepIndex(stepIndex + 1);
      resetInputs();
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      resetInputs();
    }
  }

  /** Store answers and show the speaker's reaction, or advance if none. */
  function commitAnswers(patch: Answers, reaction: string[]) {
    mergeAnswers(patch);
    if (reaction.length === 0) {
      advance();
      return;
    }
    setReactionLines(reaction);
    setSubPhase('reacted');
  }

  /** Writes every collected answer into the stores, computes targets, exits. */
  function finish() {
    const name = (answers.name ?? '').trim();
    const trainerId = answers.trainer as CharacterId;
    const nsId = answers.ns as CharacterId;
    const startingWeight = Number(answers.startingWeight);

    // Script v3: why-now and coaching preference are no longer asked at
    // onboarding — they're Sera's to raise in conversation. Nothing here
    // fakes a default for them.
    const profile: Partial<UserProfile> = {
      birthday: answers.birthday || undefined,
      gender: answers.gender,
      primaryGoal: goal,
      activityLevel: answers.activity as UserProfile['activityLevel'],
      height: Number(answers.height) || undefined,
      startingWeight: startingWeight || undefined,
      goalWeight: Number(answers.goalWeight) || undefined,
      culturalBackground: NS_TRADITION[nsId],
    };

    updateUserProfile(profile);
    // Starting weight is weigh-in #1 — the trend on Home/Insights builds on it.
    if (startingWeight) logWeight(startingWeight);

    // Sera's one question — her opening thread for the first conversation.
    if (answers.feeling) {
      updateSessionFeedback({
        emotionalCheckIns: [
          ...(emotionalCheckIns ?? []),
          { at: Date.now(), from: 'user', text: `Starting out, feeling: ${answers.feeling}` },
        ],
      });
    }

    const targets = computeTargets(profile, startingWeight || undefined);
    if (targets) updateNutritionState(targets);

    completeSetup({ name, nsId, trainerId });
    // Onboarding is done — clear the in-flight progress record.
    resetProgress();
    router.replace('/(tabs)');
  }

  /** A gentle plausibility nudge on the weight fields, per goal. Null = fine. */
  function weightNudge(): string | null {
    const current = Number(numberValues.startingWeight);
    const target = Number(numberValues.goalWeight);
    const bothSet =
      Number.isFinite(current) && current > 0 && Number.isFinite(target) && target > 0;
    if (!bothSet) return null;
    if (goal === 'weight-loss' && target >= current) {
      return 'For weight loss your goal is usually below your current weight — worth a double-check.';
    }
    if (goal === 'build-muscle' && target < current) {
      return 'For building muscle your target is usually at or above your current weight — worth a double-check.';
    }
    return null;
  }

  const continueButton = (onPress: () => void, label = 'Continue', disabled = false) => (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={styles.cta}
      testID="ob-continue"
    />
  );

  function renderBeat() {
    // Reaction/ack display is shared across every collecting beat.
    if (subPhase === 'reacted') {
      return (
        <>
          <SpokenLines speaker={beat.speaker} lines={reactionLines} ctx={ctx} />
          {continueButton(advance)}
        </>
      );
    }

    switch (beat.kind) {
      case 'say':
        return (
          <>
            <SpokenLines speaker={beat.speaker} lines={beat.lines} ctx={ctx} />
            {continueButton(advance)}
          </>
        );

      // Sera's promise (script v3 beat 13): her lines, then the hold.
      // Completing it surfaces her completion line via the shared
      // reaction mechanic, then Kael wraps.
      case 'hold': {
        const b = beat;
        return (
          <>
            <SpokenLines speaker={b.speaker} lines={b.lines} ctx={ctx} />
            <HoldToContinue
              onComplete={() => {
                setReactionLines([b.completionLine]);
                setSubPhase('reacted');
              }}
            />
          </>
        );
      }

      case 'finish':
        return (
          <>
            <SpokenLines speaker={beat.speaker} lines={beat.lines} ctx={ctx} />
            <Button label={beat.buttonLabel} onPress={finish} style={styles.cta} testID="ob-finish" />
            <AppText variant="caption" color={colors.muted} style={styles.disclaimer}>
              Your Meridian team is AI — sharp, but not infallible, and not a doctor.
              Coaching guidance, never medical advice.
            </AppText>
          </>
        );

      case 'text': {
        const b = beat;
        return (
          <>
            <SpokenLines speaker={b.speaker} lines={[b.prompt]} ctx={ctx} />
            <TextInput
              value={textValue}
              onChangeText={setTextValue}
              placeholder={b.placeholder}
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              autoFocus
              testID="ob-text-input"
            />
            {continueButton(() => {
              const value = textValue.trim();
              commitAnswers(
                { [b.field]: value },
                b.ack.map((l) => interpolate(l, { ...ctx, name: value })),
              );
            }, 'Continue', textValue.trim().length === 0)}
          </>
        );
      }

      case 'date': {
        const b = beat;
        return (
          <>
            <SpokenLines speaker={b.speaker} lines={[b.prompt]} ctx={ctx} />
            <View style={styles.dateRow}>
              <DateField label="Day" value={dateParts.day} max={2} onChange={(v) => updateDatePart('day', v)} shakeToken={dateShakes.day} testID="ob-date-day" />
              <DateField label="Month" value={dateParts.month} max={2} onChange={(v) => updateDatePart('month', v)} shakeToken={dateShakes.month} testID="ob-date-month" />
              <DateField label="Year" value={dateParts.year} max={4} onChange={(v) => updateDatePart('year', v)} shakeToken={dateShakes.year} testID="ob-date-year" />
            </View>
            {continueButton(
              () =>
                commitAnswers(
                  { [b.field]: toISODate(dateParts) },
                  b.ack.map((l) => interpolate(l, ctx)),
                ),
              'Continue',
              !isValidDate(dateParts),
            )}
          </>
        );
      }

      case 'numbers': {
        const b = beat;
        const allFilled = b.fields.every((f) => {
          const raw = (numberValues[f.key] ?? '').trim();
          if (f.optional && raw === '') return true;
          const n = Number(raw);
          return Number.isFinite(n) && n > 0;
        });
        const nudge = weightNudge();
        return (
          <>
            <SpokenLines speaker={b.speaker} lines={[b.prompt]} ctx={ctx} />
            {b.fields.map((f) => (
              <View key={f.key} style={styles.numberRow}>
                <AppText variant="label" style={styles.numberLabel}>
                  {f.label}
                </AppText>
                <View style={styles.numberInputWrap}>
                  <TextInput
                    value={numberValues[f.key] ?? ''}
                    onChangeText={(v) => setNumberValues((n) => ({ ...n, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={styles.numberInput}
                    testID={`ob-num-${f.key}`}
                  />
                  <AppText variant="caption" color={colors.muted}>
                    {f.unit}
                  </AppText>
                </View>
              </View>
            ))}
            {nudge && (
              <AppText variant="caption" color={colors.warning} style={styles.hint}>
                {nudge}
              </AppText>
            )}
            {continueButton(
              () => commitAnswers({ ...numberValues }, b.ack.map((l) => interpolate(l, ctx))),
              'Continue',
              !allFilled,
            )}
          </>
        );
      }

      case 'cards': {
        const b = beat;
        return (
          <>
            <SpokenLines speaker={b.speaker} lines={[b.prompt]} ctx={ctx} />
            {b.options.map((opt) => (
              <OptionCard
                key={opt.value}
                option={opt}
                onPick={() =>
                  commitAnswers({ [b.field]: opt.value }, opt.reaction.map((l) => interpolate(l, ctx)))
                }
              />
            ))}
            {b.freeText &&
              (showFreeText ? (
                <View style={styles.freeTextWrap}>
                  <TextInput
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={b.freeText.placeholder}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    autoFocus
                    testID="ob-freetext-input"
                  />
                  {continueButton(
                    () =>
                      commitAnswers(
                        { [b.field]: freeText.trim() },
                        (b.freeText?.reaction ?? []).map((l) => interpolate(l, ctx)),
                      ),
                    'Continue',
                    freeText.trim().length === 0,
                  )}
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowFreeText(true)}
                  accessibilityRole="button"
                  testID="ob-card-something-else"
                >
                  <AppText variant="label" color={colors.secondary} style={styles.somethingElse}>
                    {b.freeText.label}
                  </AppText>
                </Pressable>
              ))}
          </>
        );
      }

      case 'roster':
        return renderRoster(beat);
    }
  }

  function renderRoster(b: Extract<OnboardingBeat, { kind: 'roster' }>) {
    // Committed: show the chosen specialist's commit line, then advance.
    if (committed && metCharacter) {
      return (
        <>
          <SpokenLines speaker={metCharacter} lines={SPECIALIST_ONBOARDING[metCharacter].commit} ctx={ctx} />
          {continueButton(advance)}
        </>
      );
    }

    // Meeting one: their intro + choose / back.
    if (metCharacter) {
      const met = getCharacter(metCharacter);
      return (
        <>
          <SpokenLines speaker={metCharacter} lines={SPECIALIST_ONBOARDING[metCharacter].intro} ctx={ctx} />
          <Button
            label={`Choose ${met.name}`}
            onPress={() => {
              mergeAnswers({ [b.field]: metCharacter });
              setCommitted(true);
            }}
            style={styles.cta}
            testID="ob-choose"
          />
          <Button
            label="Back to options"
            variant="secondary"
            onPress={() => setMetCharacter(null)}
            style={styles.ctaSecondary}
            testID="ob-roster-back"
          />
        </>
      );
    }

    // Roster grid — trainers are filtered to the chosen goal's roster.
    const roster = b.role === 'trainer' ? getTrainersForGoal(goal) : getCharactersByRole(b.role);
    return (
      <>
        <SpokenLines speaker={b.speaker} lines={[b.prompt]} ctx={ctx} />
        {roster.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setMetCharacter(c.id)}
            accessibilityRole="button"
            testID={`ob-roster-${c.id}`}
          >
            <Card style={styles.rosterCard}>
              <AppText variant="subtitle">{c.fullName ?? c.name}</AppText>
              <AppText variant="caption">
                {c.origin} · {c.personalityWords}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.rosterPhilosophy}>
                “{c.philosophy}”
              </AppText>
            </Card>
          </Pressable>
        ))}
      </>
    );
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
        {/* Progress + back-within-flow (reduces "how long is this" anxiety). */}
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            disabled={stepIndex === 0}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backButton}
            testID="ob-back"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={stepIndex === 0 ? colors.muted : colors.text}
            />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((stepIndex + 1) / total) * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderBeat()}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** One selectable (or disabled) choice card. */
function OptionCard({ option, onPick }: { option: CardOption; onPick: () => void }) {
  if (option.disabled) {
    return (
      <Card style={[styles.optionCard, styles.optionDisabled]}>
        <AppText variant="body" color={colors.muted}>
          {option.label}
        </AppText>
        {option.disabledNote && (
          <AppText variant="caption" color={colors.muted}>
            {option.disabledNote}
          </AppText>
        )}
      </Card>
    );
  }
  return (
    <Pressable onPress={onPick} accessibilityRole="button" testID={`ob-card-${option.value}`}>
      <Card style={styles.optionCard}>
        <AppText variant="body">{option.label}</AppText>
        {option.hint && (
          <AppText variant="caption" color={colors.muted}>
            {option.hint}
          </AppText>
        )}
      </Card>
    </Pressable>
  );
}

/** A single day/month/year cell in the birthday row. */
function DateField({
  label,
  value,
  max,
  onChange,
  shakeToken,
  testID,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  /** Increments whenever the field's last input was rejected — shakes. */
  shakeToken: number;
  testID: string;
}) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeToken === 0) return;
    Animated.sequence(
      [-8, 8, -5, 5, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true }),
      ),
    ).start();
  }, [shakeToken, shake]);

  return (
    <Animated.View style={[styles.dateField, { transform: [{ translateX: shake }] }]}>
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, max))}
        placeholder={'0'.repeat(max)}
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={styles.dateInput}
        testID={testID}
      />
    </Animated.View>
  );
}

const BIRTH_YEAR_MIN = 1900;

/**
 * Whether a partly-typed date part could still become valid — the gate
 * behind shake-and-clear. '0' passes as a prefix of 01–09; '74' as a
 * day or '56' as a month can never become valid and gets rejected the
 * moment it's typed. Year prefixes are checked against 1900..current.
 */
function isPlausibleDatePart(part: 'day' | 'month' | 'year', value: string): boolean {
  const n = Number(value);
  if (part === 'day') return value === '0' || (n >= 1 && n <= 31);
  if (part === 'month') return value === '0' || (n >= 1 && n <= 12);
  // Year: some year in [min, max] must start with these digits.
  const max = new Date().getFullYear();
  const scale = 10 ** (4 - value.length);
  return n * scale <= max && (n + 1) * scale - 1 >= BIRTH_YEAR_MIN;
}

/** Calendar-true and not in the future — 31/02 and next month both fail. */
function isValidDate({ day, month, year }: { day: string; month: string; year: string }): boolean {
  if (year.length !== 4) return false;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < BIRTH_YEAR_MIN || d < 1 || m < 1) return false;
  const date = new Date(y, m - 1, d);
  const real =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return real && date.getTime() <= Date.now();
}

function toISODate({ day, month, year }: { day: string; month: string; year: string }): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  speech: {
    gap: spacing.sm,
  },
  speaker: {
    marginBottom: spacing.xs,
  },
  line: {
    lineHeight: 24,
  },
  cta: {
    marginTop: spacing.md,
  },
  ctaSecondary: {
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    marginTop: spacing.sm,
  },
  optionCard: {
    marginTop: spacing.sm,
    gap: 2,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  somethingElse: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  freeTextWrap: {
    marginTop: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dateField: {
    flex: 1,
    gap: spacing.xs,
  },
  dateInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    textAlign: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  numberLabel: {
    flex: 1,
  },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 130,
  },
  numberInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.sm,
  },
  disclaimer: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  rosterCard: {
    marginTop: spacing.sm,
    gap: 2,
  },
  rosterPhilosophy: {
    marginTop: spacing.xs,
  },
});
