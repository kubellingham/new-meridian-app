# Meridian

*Meridian got you covered.*

Meridian is a collective of elite specialists — named coaches with real
backgrounds and philosophies — who make their expertise personally
accessible to one user at a time. This repo is the React Native (Expo)
client. The product source of truth is the **Master Brief v2.0**.

## Status

Early V1 development. Scope is locked to the **weight-loss journey**,
Android-first via Expo Go, functionality before visual polish.

Built so far:

- Project foundation — Expo SDK 54, Expo Router, TypeScript, dark brand theme
- Five-space navigation: Home | Training | Diet | Insights | Profile
- Character roster in `src/content/characters/` — 2 consultants (Kael, Sera),
  3 trainers (Cassidy, Tobias, Marco), 8 nutrition specialists. These files
  are the source of truth for character voice; concept changes belong in
  the brief.
- First live AI surface: conversational meal logging in the Diet tab —
  tell your NS what you ate in plain text, get an in-character reply with
  macros in flowing sentences.
- Consultant chat surfaces: Kael (operations) and Sera (behavioral),
  reachable from Home, on a shared `CharacterChat` component.
- Shared team context (`src/services/team-context.ts`): characters see
  what the user told their teammates, so the team behaves as one.
- Voice (ElevenLabs): character replies are spoken aloud when a voice key
  is set, with a per-conversation mute toggle. Stock voices for now,
  mapped per character in `src/services/voice/voices.ts` — swap the IDs
  there for tuned/cloned voices later.
- Temporary setup screen (name + NS pick). Replaced by the scripted
  onboarding in a later session.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in (see below)
npx expo start         # scan the QR code with Expo Go on Android
```

### How the app reaches Claude

Distribution builds call Meridian's own proxy — `api/claude.js`, deployed
with the Vercel project. The client carries only the proxy URL and a
shared app token (`EXPO_PUBLIC_MERIDIAN_PROXY_URL` /
`EXPO_PUBLIC_MERIDIAN_APP_TOKEN`); the real `ANTHROPIC_API_KEY` lives in
Vercel server env and never enters any bundle. Rotating the app token in
Vercel instantly cuts off old builds.

For **local development only**, a direct `EXPO_PUBLIC_ANTHROPIC_API_KEY`
still works as a fallback. Never set it in a build handed to anyone else,
and never commit `.env`. `EXPO_PUBLIC_ELEVENLABS_API_KEY` (spoken
replies) is likewise dev-only — tester builds run text-only.

## Deployment

Two pipelines let changes reach a phone and the web without running Metro
locally. Both execute on GitHub / EAS / Vercel infrastructure — not a
laptop, and not the Claude sandbox (whose network policy blocks
`api.expo.dev`).

### EAS Update — over-the-air JS to Android

- `eas.json` defines two build profiles: `development` (dev-client APK,
  `development` channel) and `preview` (the standalone tester APK,
  `preview` channel).
- `.github/workflows/eas-dev-build.yml` (manual) builds the dev client;
  `.github/workflows/eas-preview-build.yml` (manual) builds the tester
  APK. Rebuild only when native code/deps or the app version change.
- `.github/workflows/eas-update.yml` (on push) publishes an OTA JS update
  to **both** channels, so testers get fixes on next app open.
- Requires repo secret `EXPO_TOKEN`. Each channel reads its EAS
  environment: `development` may carry the dev-only direct key;
  `preview` carries ONLY the proxy URL, app token, and Sentry DSN.

### Vercel — proxy + shareable web build

- `vercel.json` builds the static web export AND deploys `api/claude.js`
  (the Claude proxy); `/v1/messages` rewrites to it so the client SDK
  works unchanged.
- Vercel project env needs `ANTHROPIC_API_KEY` (server-side, the real
  key) and `MERIDIAN_APP_TOKEN` (matches the client token).
- The web bundle no longer embeds vendor keys; keep Deployment
  Protection on anyway so the web preview stays private.

## Tester round — launch checklist

One-time setup, in order (nothing here can run from the Claude sandbox):

1. **Rotate keys.** Create a fresh Anthropic API key and delete the old
   one (it shipped in earlier dev bundles). Same for ElevenLabs and the
   Expo token if they ever left your machine.
2. **Anthropic spend cap.** Console → Billing → set a hard monthly limit
   you're comfortable losing. This is the real cost ceiling.
3. **Vercel env.** Project → Settings → Environment Variables: add
   `ANTHROPIC_API_KEY` (the fresh key) and `MERIDIAN_APP_TOKEN` (invent a
   long random string). Redeploy. Sanity-check with:
   `curl -s -X POST https://<your-app>.vercel.app/v1/messages -H 'x-api-key: wrong' -d '{}'`
   → should return the 401 JSON.
4. **Expo preview environment.** Expo dashboard → project → Environment
   variables → environment `preview`: `EXPO_PUBLIC_MERIDIAN_PROXY_URL`
   (the Vercel URL), `EXPO_PUBLIC_MERIDIAN_APP_TOKEN` (same string as
   Vercel), and `EXPO_PUBLIC_SENTRY_DSN` (from step 5). Do NOT add vendor
   keys here.
5. **Sentry.** Create a free project (React Native), copy the DSN into
   the Expo `preview` environment. Update the org/project names under the
   `@sentry/react-native/expo` plugin in `app.json` if you want sourcemap
   uploads later.
6. **Your WhatsApp number.** In `app.json` → `extra.feedbackWhatsApp`,
   replace the placeholder with your number in international digits-only
   form (e.g. `2557XXXXXXXX`). The Send feedback button stays politely
   disabled until you do.
7. **Build.** GitHub → Actions → "EAS preview build (tester APK)" → Run
   workflow. When EAS finishes, share the build's install link (or the
   APK) with your friends.
8. **Watch the first days.** Vercel → Logs shows one line per Claude call
   with token counts; Anthropic Console shows spend; Sentry shows
   crashes. If anything runs away, rotating `MERIDIAN_APP_TOKEN` in
   Vercel kills all builds instantly.

What testers get: the full app over the proxy, text-only (no voice),
with the feedback button and crash reporting. What they never get:
vendor API keys.

## Tests

```bash
npm test
```

Jest (via `jest-expo`) currently guards the character registry: roster
completeness, prompt assembly, and the mechanical content rules from the
brief (no markdown in conversation, no AI self-references).

## Project layout

```
app/                    # Expo Router routes (tabs + temporary setup)
src/theme/              # design tokens — brief §13 colours, type, spacing
src/components/         # UI kit + Diet Corner conversation pieces
src/content/characters/ # character voice source of truth (brief Appendix A)
src/store/              # zustand stores persisted to AsyncStorage
src/services/claude.ts  # Claude API conversation layer (claude-sonnet-4-6)
```
