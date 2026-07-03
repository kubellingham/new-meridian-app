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
- Temporary setup screen (name + NS pick). Replaced by the scripted
  onboarding in a later session.

## Getting started

```bash
npm install
cp .env.example .env   # then paste your Anthropic API key
npx expo start         # scan the QR code with Expo Go on Android
```

Without a key the app runs fine; the nutrition specialist just shows as
offline in the Diet tab.

### API key — MVP only

`EXPO_PUBLIC_ANTHROPIC_API_KEY` ships inside the client bundle. That is an
explicit MVP decision for **personal testing only** (brief §12). A backend
proxy must replace it before any public build. Never commit `.env`.

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
