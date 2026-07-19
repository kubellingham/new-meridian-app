# Meridian — Complete Project State & History

*Compiled 2026-07-15, at v0.3.0, the day after the first tester round went live.*

## 1. How to read this

This document is the full, authoritative record of the Meridian build — written by Claude Code (the builder) for Claude Chat (the product brain) after a stretch where the developer worked directly with Code and the Chat side fell behind. **Everything here supersedes whatever picture you currently hold.** It covers: what the product is, what exists in code today, every decision made and why, everything deliberately cut, everything planned but not yet built, and how the system runs in production. Read it, then help the developer plan the next chapter; building returns to Claude Code with your plans.

## 2. The product

**Meridian** is an AI fitness & nutrition app where the user is coached by a *team of named specialists* — not a chatbot, not a tool. The concept (from Master Brief v2.0 and the Collaboration Model v1.0, both authored in Claude Chat):

- **Two consultants on every team**: Kael (operations — data, schedule, streaks, routing, pattern recognition) and Sera (behavioral — emotions, habits, motivation).
- **One trainer**, chosen from a roster of three matched to the user's goal.
- **One nutrition specialist (NS)**, chosen from eight, each specializing by *food culture* — culture is their lens, never their menu; they coach whatever the user actually eats.
- Characters feel like real people: distinct voices, humor profiles, cultural seasoning used sparingly, real memory of the user.

**Locked principles (enforced in code and content):**
- **The Golden Test**: if another character could have said a line, it isn't written yet.
- **Voice-safe memory**: characters reference what they know as colleagues would ("I know you've been…"), never as data access ("your records show").
- **Present-moment chat**: the UI shows only the current visit's exchange (older messages fade upward); full history persists invisibly and feeds the API — the gap between what's shown and what's known is the point.
- **Predesigned vs generated**: onboarding dialogue is fully scripted and static; the Claude API only takes over once the user is inside the product.
- **Team coherence**: every character knows what the user told teammates (shared context), receives teammates' domain-changing decisions (events), and cross-references naturally, never formulaically.
- **No shame, no fake enthusiasm, no markdown in conversation, never break character.**
- **Restrained dark UI**: near-black base, one electric-cyan accent used sparingly, DM Sans + Playfair Display for hero numbers. Function over form until a designer joins.

## 3. Current status snapshot

- **v0.3.0 is live on ~20 friend testers' Android phones** (installed via EAS internal-distribution APK link, shared in a WhatsApp group with a kickoff message).
- All Claude traffic flows through a **token-gated proxy** the developer owns — no vendor API keys exist in any distributed build.
- The tester round's goal: find gaps, confusion, bugs, and **catch characters hallucinating** ("does the trainer or Kael lie"). Each tester owes at least one specific observation; reports arrive via an in-app WhatsApp feedback button or the group.
- The app sustains a full user day: scripted onboarding → personalized targets → daily workout generation → food logging four ways → water/weight tracking → morning brief → live conversations with all four team members.

## 4. Architecture & stack

- **Client**: Expo SDK 54 / React Native 0.81, Expo Router (typed routes), TypeScript, New Architecture + React Compiler enabled. Android-first; web export exists for testing/preview.
- **State**: Zustand + AsyncStorage, four persisted stores — `meridian-user` (name, chosen trainer/NS, setup gate), `meridian-user-data` (the six-category shared schema below), `meridian-chats` (all threads + last-visit times), `meridian-settings` (voice toggle). **All four carry `version: 1` + migrate** so schema changes never wipe user data.
- **Shared user schema** (Collaboration Model §2): userProfile / programmeState / nutritionState / dailySignals / sessionFeedback / patternFlags, plus an append-only **team events log** and a rolling 30-day **food log**.
- **AI**: `claude-sonnet-4-6` for everything. Request patterns:
  - Chat replies: plain messages + `suggest_replies` tool (auto) → quick-reply chips.
  - NS chat: + `log_food` tool (auto) — replies in voice AND logs food in one turn. Photo logging sends base64 image blocks.
  - Workout generation: **forced tool** `submit_workout_plan`, with the exercise-name enum **built per request** from the curated database filtered to the user's equipment — plans can only contain movements the user can actually do.
  - System prompt assembly: shared rules block → team roster block → role block (NS) → character voice → dynamic user context (real goal read from store) → team context (facts block + pending events + cross-thread digest with consultant/specialist visibility lanes).
- **Proxy** (`api/claude.js`, Vercel serverless, deployed with the repo): validates a shared app token, swaps in the real Anthropic key (server-side env only), enforces guardrails (single model, max_tokens ≤ 4096, ≤ 1.5 MB body, no streaming), logs one usage line per call, passes upstream status through so SDK error mapping works. `vercel.json` rewrites `/v1/messages` → the function so the client SDK just points its baseURL at the deployment. A dev-only direct-key fallback remains for local work.
- **Voice**: ElevenLabs TTS (`eleven_turbo_v2_5`, stock voices mapped per character) — **dev-only**; tester builds omit the key and run text-only. All voice UI self-gates.
- **Nutrition math**: Mifflin–St Jeor BMR → activity multiplier → TDEE → goal adjustment (−20% / +10% / maintenance) with per-goal protein (1.8 / 2.0 / 1.6 g/kg), fats 27% of calories, 1300 kcal floor. `computeEnergy` exports BMR/TDEE/BMI for the Insights tab.
- **Food data**: Open Food Facts (no key) for barcode + search, with serving-aware mapping (label serving preferred over per-100g) and **unit-aware measures** — the mapping reads OFF's serving/package quantities and units (g/kg, ml/cl/l normalized) and, when unit fields are missing, **infers the unit** from serving_size / package-quantity text (same-unit tokens summed: "1 l + 250 ml" → 1250 ml) or a beverage category tag → ml; grams only as the last resort. The portion UI offers label servings, a g/ml amount, or the whole pack (`src/services/food-quantity.ts` does the honest-conversion math; drinks are ml, never "grams eaten"). The review editor can also **fix the measure itself** (measured-in g/ml/servings + serving and pack sizes, nutrition prefills rescaled to the new basis via `rescaleNutrition`). User fixes to a scanned product are **remembered per barcode** (`foodCorrections`, capped 200): the next scan shows their values, and a product OFF doesn't know can be added manually once (the failed scan hands its barcode over) and is found forever.
- **CI/CD**: GitHub Actions — manual dev-client build, manual **preview (tester APK) build**, and on-push OTA updates to **both** channels (`development` + `preview`). EAS runtimeVersion = appVersion policy, so JS ships OTA; native changes need a rebuild + version bump.
- **Design**: "The Practice" (Claude Design system, project d0756814) — warm ink + brass, serif-forward (Playfair for hero numbers, speaker names, stat values; DM Sans UI), per-character accent hues on speaker labels/card hairlines only, uppercase overline card labels. Tokens in `src/theme/theme.ts` + `src/theme/character-hues.ts`. Splash/native background still old navy until the next APK build (native-side).
- **Testing discipline**: 226 Jest tests (services, stores, content integrity, proxy handler), plus a library of Playwright drive scripts that run the real web build against seeded localStorage — including a stub-proxy drive that renders live replies and quick-reply chips end-to-end.

## 5. Complete feature inventory (all shipped and verified)

**Onboarding** (`app/onboarding.tsx` + `src/content/onboarding/flows.ts`)
- The full weight-loss script (Meridian_Weight_Loss_Onboarding_Script_v1) as a text-forward flow: Kael collects name/birthday/gender/goal/activity, Sera collects why-now/feeling/coaching-style, trainer + NS roster meets with scripted intros and commits, team wrap, honest local-only close.
- **Weight-loss-first (the pivot)**: every new user starts on weight loss — the goal beat keeps all three cards but only "Lose weight" is selectable (the others render disabled with an honest "paused" note). The muscle/general branches are **dormant, not deleted**: per-goal beats, rosters, targets, and trainer content all remain and keep working for existing users on those goals. Onboarding progress persists beat-by-beat (`meridian-onboarding` store), so backgrounding/process death resumes mid-flow.
- Added beyond the script: a numbers beat (height/current/goal weight — the script never collected them), per-goal plausibility nudges, optional goal weight for general fitness, a "Something else" free-text feeling with a Sera ack, progress bar + back navigation, an AI-fallibility/medical disclaimer on the finish screen.
- Emotional answers persist into `sessionFeedback.emotionalCheckIns` so Sera genuinely carries the "why" forward. Targets compute at finish; the user lands on a real Home.

**Home** (`app/(tabs)/index.tsx`)
- Two-column widget grid: calories (real intake vs target, full-width), weigh-in with **weekly trend** ("−0.6 kg this week · 4.2 to go" once the log supports a rate), streak (real: any day with a food log or completed workout; today/yesterday grace; honest 30+ cap), today's-training live state (carrying the trainer's philosophy line), water, sleep&steps honest placeholder, NS note (last logged meal as fact, or a per-NS in-voice quiet-day nudge after midday), consultants row.
- **Kael's morning brief**: generated once per local day from full team context, delivered as a tap-to-open note that becomes his chat opener; marked delivered once seen.

**Training** (`app/(tabs)/training.tsx`, `app/trainer.tsx`, `app/workout/[sessionId].tsx`, `app/history.tsx`)
- First-visit **trainer mini-intake** (equipment / days-per-week / experience), trainer-voiced, tappable — gates generation and filters the exercise database.
- Daily plan generation in the trainer's voice (intent line + per-exercise cues), rest days as first-class. **Curated exercise database** (~90 movements: strength/conditioning/mobility/warm-up/cool-down, tagged by equipment/muscles/level, each with a fallback cue); generation is constrained to it.
- Workout runner: set-by-set logging with natural inputs, un-log, swipe-delete, non-mandatory sets, rest timer, session feeling + note. History browsing screen. A per-exercise progression digest feeds the next generation. Plan-created and workout-completed events flow to Kael.

**Diet** (`app/(tabs)/diet.tsx`, `app/diet-chat.tsx`, `app/food/*`)
- Dashboard: calorie summary vs target, macro bars, water tracking, weight quick-log (appends to the weigh-in history and recomputes targets), four meal sections, edit/delete any entry.
- Five logging paths: NS chat (logs mid-conversation via tool), photo (NS looks at the plate), barcode (auto-capture feedback, not-found → photograph-it fork, label-true servings), database search (with recents strip carrying last-time portions), manual (optional serving-size text; accepts a barcode from a failed scan and remembers the product).
- **Review step** (`FoodConfirmList`, shared by photo/barcode/search): name/calories/amount editable; the amount field carries a **measure dropdown** (servings · g/ml · whole pack) built from the item's real unit data — items without unit data just get servings, per-100 items default to a g/ml amount. A "Something's not right?" panel opens protein/carbs/fat (+ serving size on unit-less items); edited barcode items save as corrections. Post-log editing stays servings/meal/delete only (deliberate — logged history keeps its identity).
- **Photo follow-ups**: after analyzing a plate the NS asks up to three optional questions about what the photo can't show (cooking method, oil, hidden cheese/fillings) plus an "Anything I missed?" catch-all; answers feed a refinement turn (the whole exchange is rebuilt as plain text around the original image) and the NS re-logs the complete corrected list. Questions never gate "Log the plate"; rounds can repeat.

**Insights** (`app/(tabs)/insights.tsx`)
- **Weight leads**: current vs starting, 7/30-day change, average weekly rate (least-squares over trailing 28 days; refuses to exist under 2 entries / 3 days span, so the migration seed can't fabricate a trend), an honest at-this-rate projection (declines flat / wrong-direction / >2-years cases), and the trainer's own words on pace with a numeric band comparison only where the coach prescribes one (Cassidy, Noa).
- "Your numbers" below: BMR, TDEE (multiplier explained), goal-adjusted daily target (adjustment explained per goal), BMI (framed as the blunt tool it is), macro targets with per-goal protein logic.

**Profile** (`app/(tabs)/profile.tsx`)
- Identity + real goal + team roster, service status, About Meridian card (app version + AI/medical disclaimer + data-stays-on-phone), **Send feedback** → WhatsApp prefilled with version/platform, dev reset.

**Chat system** (`src/components/chat/character-chat.tsx`)
- One shared surface for all characters: present-moment view, full-history overlay, per-visit greetings (scripted first meeting → static quick-return → API-generated contextual return after 3h), typing indicator, error bubbles, voice autoplay + mute (when configured), **starter chips** per surface ("What's my workout today?"…), **AI quick-reply chips** whenever a character asks a question with natural short answers (tap to answer or type).

**Team intelligence** (`src/services/team-context.ts`, `events.ts`, `morning-brief.ts`)
- Facts block (everything known, voice-safe), today's intake/plan/recent-training lines, water, cross-thread conversation digest with visibility lanes (consultants see all; specialists see consultants only), pending-events block with seen-tracking after each reply.

**Infrastructure**
- Token-gated Claude proxy + client cutover; store versioning (meridian-user v2: trainer retirement; meridian-user-data v2: weightLog seeded from last known weight; onboarding progress store v1); tester-copy scrub (no env-var names anywhere user-visible); preview build profile + workflows; dual-channel OTA; README launch checklist; bundle audit (zero vendor keys in any build).

## 6. The cast (23 characters, `src/content/characters/`)

- **Consultants**: Kael (operations; clipped, precise, almost no humor) · Sera (behavioral; warm, perceptive, asks the unasked question).
- **Weight-loss trainers (Roster v1, philosophy-first — the frontline)**: Cassidy Wren (Chicago; slow & sustainable; lost it twice) · Renata Alves (Coimbra; strength minimalist) · Marcus Adeyemi-Boateng (Manchester; conditioning, no mirrors) · Priya Raghunathan (Birmingham; adherence-first, openly under-prescribes) · Noa Bar-Lev (Tel Aviv; 12 weeks then maintenance). **Retired**: Tobias, Marco — registered forever (history resolves), on no roster; a store migration routes their users to re-pick.
- **Muscle trainers** (dormant goal — live for existing users): Ananya (Mumbai; physique science, myth-retiring warmth) · Dmitri (Prague; barbell purist of few words) · Kofi (Accra; sprinter turned S&C; celebratory and demanding).
- **General-fitness trainers** (dormant goal — live for existing users): Amara (Nairobi; ex-physiotherapist; train for the life in ten years) · Ingrid (Oslo; friluftsliv endurance; "mostly outside, mostly easy, never zero") · Sam (Vancouver; workouts that fit your actual Tuesday).
- **Nutrition specialists**: Nneka (West African) · Kavya (South Asian) · Haruki (Japanese) · Sofía (Mexican) · Yasmin (Lebanese) · Elena (Greek) · Jordan (American) · Mei Lin (Chinese).
- Every character: full voicePrompt with example lines, humor profile, cultural seasoning notes, handoff rules, never-dos — plus onboarding intro/commit lines and (trainers) intake lead-ins and chat greetings.

## 7. Every decision made, with rationale

**Product forks the developer answered explicitly:**
| Decision | Choice | Why |
|---|---|---|
| Onboarding presentation | Text-forward, no voice-over/portraits | No audio/visual assets exist; the script's beats survive as on-screen text |
| Height/weight collection | New "numbers beat" in Kael's Phase 1 | The script never collected them but targets require them |
| Build order | Daily-use polish before tester infrastructure | The developer uses it daily; sharing came once the loop proved itself |
| Trainers for new goals | **New trainers per goal** (6 written), not re-scoping the existing 3 | Honors the brief's "trainers specialize by goal" |
| Trainer setup questions | Yes — first-visit mini-intake in the Hub | Exercise DB filtering needs equipment; also the first quick-reply showcase |
| Calculators' home | Insights tab | It was empty; room to grow into charts |
| Voice for testers | Text-only | ElevenLabs bills per character; 20 testers would drain it |
| Tester feedback | WhatsApp button | Zero infrastructure; friends live on WhatsApp (number: in `app.json` extra) |
| Platforms | Android APK only | iOS needs $99 Apple account + TestFlight; friends are Android |
| Crash reporting | Sentry added → **removed** | See the crash saga below; reintroduction documented |

**Engineering decisions:**
- **Client-side API key was an explicit MVP-only decision**, replaced by the proxy before distribution. The app token in tester builds only opens the capped proxy; rotating it in Vercel is the kill switch.
- Two stores stay separate (user vs user-data) — refactor risk wasn't worth it; team-context merges them.
- Exercise constraint via **per-request tool-schema enum** (not prompt-begging) — guarantees DB-only exercises.
- Quick replies as an **auto tool riding every chat call** — prose stays prose; chips appear only when the model chooses.
- Onboarding flow is **data, not JSX**: typed beats walked by one controller; goals share an identical prefix so the flow can rebuild mid-walk.
- NS afternoon nudges are static per-character lines (no API on Home; no fake generated voice).
- Store versioning contract: every breaking schema change bumps version + extends migrate.

**The crash saga (instructive):** The first tester APK crashed at boot. First diagnosis blamed Sentry (new native module) — **wrong**; removing it didn't fix the second build. The tester's adb crash log revealed the truth: `expo-audio` declares `expo-asset: *`, and npm satisfied the wildcard with `expo-asset@57.0.3` (a canary from a newer line) instead of SDK 54's `~12.0.13` — its native code referenced a class SDK 54's core doesn't have. Debug/dev-client builds tolerated it; the first-ever release build didn't. Fix: pin `expo-asset@~12.0.13` at the root; a full lockfile scan against Expo's official versions is now clean. Lessons encoded: release builds are a different animal; wildcard transitive deps are a real hazard; tester crash logs beat guesses.

**Security incidents:** an Anthropic key and an Expo token were pasted into chat early on; both treated as burned. All keys rotated at tester launch; a hard Anthropic spend cap is set. Standing rule: secrets never in chat, never committed.

## 8. Deliberately cut / stubbed (exists in concept, not in code)

From the onboarding script: Phase 0 (splash, language selection, ToS/Privacy scroll-gates), voice-over + character portraits/animations, Phase 5 widget picker (default layout ships; "your space" framing kept), Phase 6 sign-up (Google/Apple/email — app is local-only, framed honestly) and the 7-day trial mechanics (trial narration kept as text), the "Honestly, I'm not sure" goal branch (needs an unscripted Sera conversation), female-specific dialogue variances, returning-user contextual welcome-back lines. Elsewhere: i18n (English-only), iOS, any backend beyond the proxy (no accounts, no sync — data lives on-device), Home widget customization.

## 9. Planned but never built (the backlog — likely the biggest gap in your picture)

**Near-term / carried from prior roadmaps:**
1. **Sentry reintroduction** — removal was a misdiagnosis; crash reporting is still wanted. Documented method: `npx expo install` (Expo-pinned version, not npm latest), init inside a `useEffect`, no auto-wrap; needs `SENTRY_AUTH_TOKEN` in the preview env (already created) and org `kubellingham` / project `meridian-app` (already in place).
2. **The one big native rebuild** — batch ALL foreseeable native modules into a single build: `expo-notifications` (local: morning-brief ping, evening not-logged nudge, workout-day reminder — all opt-in), `react-native-svg` (the YAZIO-style calorie ring + charting primitive), Health Connect module (installed/permissioned now, wired later so the wiring ships OTA).
3. **Insights v2** — weight trend line chart (needs a `weightHistory` array appended on every weigh-in — schema addition), week view (calories vs target per day, workouts, water, streak), **Sera's weekly note** (Sunday reflection reusing the morning-brief plumbing keyed by ISO week).
4. **Health Connect wiring** — sleep/steps/resting HR into dailySignals; Home placeholder becomes real; Kael's brief gets its sleep line; trainer reads recovery.
5. **Specialist deep intakes** (script §7.2) — longer first-visit conversations: trainer (injuries, history, schedule) and NS (dietary pattern, allergies, cooking, hydration) writing into the reserved profile fields (injuries, allergies, dietaryPattern, culturalFoodContext, trainingHistory). The trainer mini-intake built is the seed of this.
6. **Pattern flags** — rule-based detection (symptom repetition, abandonment streaks, sleep slippage) feeding Kael/Sera via the existing patternFlags store + events; the schema and prompt plumbing already exist.

**Later:**
7. Meal history browsing (yesterday+), portion presets, favorites.
8. Data export/backup (JSON of the stores) before any real backend; Firebase/multi-device only when it matters.
9. **Voice for real users** — requires proxying ElevenLabs (usage-billed; never client-side) + budget; then tuned/cloned per-character voices.
10. iOS + TestFlight (Apple dev account).
11. Prompt caching (deferred from the brief; worth revisiting — system prompts are large and repeated).
12. Trial/monetization mechanics (the script's Phase 6 narration is the placeholder).
13. Web as a product surface (currently a protected preview only).

## 10. Operations runbook (how the live system runs)

- **Shipping**: every push to the branch OTA-updates BOTH channels; testers get JS fixes on next app open. A rebuild (GitHub Actions → "EAS preview build") is needed only for native modules or a version bump; new APK = new install link.
- **Safety model**: real keys live only in Vercel env; Anthropic hard spend cap is the money ceiling; the proxy clamps model/size/streaming; **rotating `MERIDIAN_APP_TOKEN` in Vercel instantly bricks every distributed build** (then rebuild with the new token).
- **Monitoring**: Vercel Logs (one line per Claude call with token counts), Anthropic console (spend), WhatsApp (feedback button + group). No crash reporting until Sentry returns.
- **Install links**: EAS internal distribution — unlisted URLs, expire ~13 days; reshare or rebuild for late joiners.
- **Dev vs tester**: developer's dev-client + direct key setup still works locally, untouched.

## 11. Standing constraints

- Secrets never in chat or commits (two were burned early and rotated — the rule is absolute now).
- Development on branch `claude/meridian-app-kjn60m`; no PRs unless asked.
- Verification discipline per feature: tsc + eslint + Jest + Playwright drives against the real web build, committed per coherent change.
- All copy user-visible must survive the "tester reads this" test — no env vars, no dev concepts; disclaimers stay.
- Sandbox constraints: Claude Code's environment can't reach api.expo.dev or the user's Vercel/Expo/Sentry dashboards — builds go through GitHub Actions; dashboard steps are user actions.

## 12. Open questions for the product brain (suggested agenda)

1. **Tester-feedback triage** — reports are about to arrive. What's the process: severity buckets? A living FEEDBACK.md? Weekly OTA fix batches?
2. **Next milestone: deepen or widen?** Deepen = intakes, pattern flags, Insights charts, notifications (the relationship promise). Widen = more surfaces/polish. The prior roadmap leaned deepen; tester data should decide.
3. **The native rebuild timing** — one batched rebuild is cheap to plan, expensive to repeat; when do we spend it, and does Sentry ride along?
4. **Retention mechanics** — streaks exist; notifications don't. How aggressive should Meridian be about pulling people back?
5. **Voice strategy** — is spoken character voice core to the vision (worth a proxied budget) or a delighter for later?
6. **Monetization reality** — the script narrates a 7-day trial; nothing enforces it. What's the actual model, and when does it need to exist?
7. **When does iOS matter?**

---

*Maintained in-repo at `docs/PROJECT_STATE.md`. When the plan changes in Claude Chat, bring the conclusions back to Claude Code and this file gets updated with them — it's the shared memory between the two sides.*
