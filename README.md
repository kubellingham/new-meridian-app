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
cp .env.example .env   # then paste your API keys (see below)
npx expo start         # scan the QR code with Expo Go on Android
```

`.env` takes two keys, both optional:

- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — the conversations. Without it, every
  character shows as offline.
- `EXPO_PUBLIC_ELEVENLABS_API_KEY` — spoken replies. Without it, the app is
  text-only and the mute toggle is hidden.

### API keys — MVP only

Both keys ship inside the client bundle. That is an explicit MVP decision
for **personal testing only** (brief §12). A backend proxy must replace
them before any public build — especially the ElevenLabs key, which bills
by usage and can be drained if leaked. Never commit `.env`.

## Deployment

Two pipelines let changes reach a phone and the web without running Metro
locally. Both execute on GitHub / EAS / Vercel infrastructure — not a
laptop, and not the Claude sandbox (whose network policy blocks
`api.expo.dev`).

### EAS Update — over-the-air JS to Android

- `eas.json` defines one build profile, `development`: an internal-
  distribution APK dev client on the `development` channel and EAS
  environment.
- `.github/workflows/eas-dev-build.yml` (manual, "Run workflow") links the
  Expo project and builds the dev-client APK on EAS. You install that APK
  once. Only needed again when native code/deps change.
- `.github/workflows/eas-update.yml` (on push) publishes an OTA JS update to
  the `development` branch. The dev client picks it up on next open.
- Requires repo secret `EXPO_TOKEN`. The Anthropic key is read at
  build/update time from an EAS environment variable
  `EXPO_PUBLIC_ANTHROPIC_API_KEY` (environment: `development`), so the
  bundle ships with a working key — same client-side-key MVP caveat below.

### Vercel — shareable web build

- `vercel.json` builds with `npx expo export --platform web` (static output
  in `dist/`, `cleanUrls` on so `/kael` serves `kael.html`).
- Vercel auto-deploys on push once the GitHub repo is connected.
- Set `EXPO_PUBLIC_ANTHROPIC_API_KEY` as a Vercel Project environment
  variable so the web bundle can reach Claude. Because a public web URL
  exposes an embedded key to anyone, keep Vercel Deployment Protection on
  until the backend proxy lands.

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
