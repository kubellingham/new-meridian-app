# MERIDIAN — ONBOARDING SCRIPT
## Version 3.0 — Target design
### Weight loss path, splash to Home

---

**Document status:** IMPLEMENTED — this describes the flow as built (Sera at the close, hold-to-continue live). It supersedes v2.0. Code wins on any drift.

**What changed from v2.0:** Sera moves out of the middle of the flow and into the close. She loses two of her three questions. A new hold-to-continue beat is added as her moment. Kael's beats are otherwise unchanged.

**Source of truth once built:** the beats live as data in `src/content/onboarding/flows.ts`, rendered by `app/onboarding.tsx`. This document is the design record — once implemented, code wins on any drift and this document gets updated.

**Companion documents:** Master Brief v2.0, Specialist Collaboration Model v1.0, Weight Loss Trainer Roster v1.0.

---

## WHY SERA MOVED

In v2.0 Sera sat at beats 8–13, in the middle, asking three questions: why now, how are you feeling, what do you need from a coach.

That made her a **data-collection step with a warm voice**. She took three things and left. That's wrong for the person who holds the emotional layer — she shouldn't introduce herself with a questionnaire.

There's a structural argument too. Kael → trainer → NS is **assembly**. You're building a team. Sera isn't assembled — she's not picked from a roster, she has no alternatives, she's simply there. Putting her outside the assembly sequence says that without anyone having to explain it.

And practically: it front-loads the interesting part. The user reaches the trainer roster — Meridian's actual differentiator — six beats sooner.

**What this costs, and it's accepted:** *why now* and *coaching preference* were real signal. Why-now Sera can ask in her first real conversation, which is arguably a better moment for it than a card in onboarding. Coaching preference primed the roster read — someone who's just said "push me" reads Noa differently — but nothing in the app currently uses that answer, and a weak nudge isn't worth six beats of delay before the thing that makes Meridian Meridian.

---

## THE SHAPE

One linear walk. No branches except the trainer/NS meet-and-choose loops.

Progress persists beat-by-beat. Backgrounding, screen-off, and process death resume in place. Back-navigation supported, answers retained.

Every card-select answer gets a short in-voice reaction before advancing. Those reactions are not decoration — they're how the user learns who these people are before choosing between them.

**Onboarding does not:** collect training context (trainer's job, asked in Training Hub), collect dietary context (NS's job), or make a single Claude API call. Every line is predesigned.

---

## THE BEATS

### 1 — Welcome
**Kael. Scripted.**

> *"I'm Kael. Welcome to Meridian."*
>
> *"Meridian's a team of specialists — the best at what they do — who came together to make their expertise personal. That team, starting now, is yours."*

The positioning line. Everything downstream depends on the user reading "team of people," not "app with features."

---

### 2 — Name
**Kael. Text input.** → `name` (user-store)

Appears in subtitle text throughout the app. **Never spoken in voice** — permanent architectural rule, not an MVP compromise.

---

### 3 — Birthday
**Kael. Date fields.** → `birthday` (userProfile)

Birthday, not age. Age is derivable; birthday isn't. Enables recognition later and long-horizon comparisons.

---

### 4 — Gender
**Kael. Card select.** → `gender` (userProfile)

Feeds BMR/TDEE.

---

### 5 — Goal
**Kael. Card select — one enabled, two disabled.**

> *"Okay, {NAME}. This one shapes everything we set up for you. Fair warning — right now Meridian does one thing properly: weight loss. The other paths are parked, not gone."*

Disabled cards: *"Paused — Meridian is all-in on weight loss right now."*

**Reaction on weight loss:**

> *"Okay. That's a real one."*
>
> *"We'll set you up properly. How it gets done — that's between you and the coach you pick."*

**Why this line.** The earlier version read *"Not fast — properly. There's a difference, and it matters"* — which silently took Cassidy's side of the roster's sharpest disagreement, two minutes before offering Noa. **Kael has no favourite.** This acknowledges the goal, prescribes nothing, sits equally well in front of any of the five, and quietly plants that a choice is coming.

→ `primaryGoal` (userProfile)

---

### 6 — Activity level
**Kael. Card select.** → `activityLevel` (userProfile). Feeds TDEE.

---

### 7 — Numbers
**Kael. Form — height, current weight, goal weight.**

→ `height`, `startingWeight`, `goalWeight` (userProfile). Starting weight also writes through `logWeight()` as weigh-in #1, so weight history has a real origin rather than starting empty.

---

### 8 — Kael frames the trainer choice
**Kael. Scripted.**

**The most important beat in onboarding.** Where Meridian's differentiator gets stated out loud.

> *"Alright. Now we put the rest of your team together. First — your trainer."*
>
> *"Five of my people do weight loss, and they don't agree with each other about how. I want to be upfront about that, because it's not a flaw in the roster."*
>
> *"The shapes are genuinely different. Cassidy works at about half a kilo a week, open-ended — a long project, and she'd tell you that's the point. Noa works in twelve-week blocks at a real pace, and then stops. On purpose."*
>
> *"Renata, Marcus, and Priya don't run on the scale at all — for them it's whether your strength holds, what your body can do, whether you're still training next year."*
>
> *"They all get people to the same place. They just don't agree on the road — that's why you get to choose. Meet whoever you like; the right one is whoever feels right to you, not whoever I think is best on paper."*

**Rules encoded here:**

Rate numbers attach to **methods**, never to the user's body. Kael never says "you'd reach X by Y." No outcome data exists; inventing a projection would be fabrication, and the whole thesis is that these people are trustworthy.

**No implied ranking.** The three who don't run on the scale get their positions stated *as positions*, each recognizably their own. An earlier draft ended this line with *"the weight follows"* — **cut**, because none of those three makes that claim. It was Kael softening them into something more palatable than they are, and smuggling an outcome promise in through the back door. Their position is the position. They make their own case when the user meets them.

Sourced from each trainer's `projectionProfile.ratePhilosophyNote`, but written as Kael talking, not a list read aloud.

---

### 9 — Trainer roster
**Kael hosts. Selection — meet, then choose.**

Grid of five: full name, origin, personality words, philosophy quote.

- **Cassidy Wren** — Chicago — slow & sustainable
- **Renata Alves** — Coimbra — strength minimalist
- **Marcus Adeyemi-Boateng** — Manchester — conditioning
- **Priya Raghunathan** — Birmingham — adherence-first
- **Noa Bar-Lev** — Tel Aviv — aggressive transformer

**Mechanic:** tapping a card opens that trainer's scripted intro, where they state their actual prescription and let it argue. Renata's *"Three sessions a week… then you go home."* Noa's *"Twelve weeks, then we stop."* Then "Choose {name}" or "Back to options." Free carousel — meet everyone, meet nobody, back out at will. Commit shows their commit lines.

**No recommendation.** Kael doesn't pre-pick. The routing questions (Roster doc §4) are deferred and nothing collects the fit data a recommendation would need. Kael describing shapes is the honest substitute: informative without being a prediction.

The six dormant muscle-gain and general-fitness trainers never appear.

→ `trainerId` (user-store)

---

### 10 — Kael frames the NS choice
**Kael. Scripted.**

> *"…Unlike trainers, who specialize by goal, nutrition specialists specialize by culture. Because food isn't just fuel. It's where you come from. It's what your grandmother made you… I'm not going to pre-pick — too personal."*

Previously read *"I'm not going to pre-pick this time"* — the "this time" implied he'd pre-picked the trainer, which he didn't and can't. Removed.

---

### 11 — NS roster
**Kael hosts. Selection — meet, then choose.**

Eight: Nneka (West African), Kavya (South Asian), Haruki (Japanese), Sofía (Mexican), Yasmin (Middle Eastern), Elena (Mediterranean), Jordan (American), Mei Lin (Chinese).

Same meet-and-choose mechanic.

**The lens principle** — each NS specializes by culture but works with whatever the user actually eats. Elena will log jollof rice and coach it. Her lens is Mediterranean; her menu isn't. The user picks whose voice they connect with, not whose cuisine matches their fridge.

→ `nsId` (user-store), seeds `culturalBackground` (userProfile) via `NS_TRADITION`

---

### 12 — Sera arrives
**Sera. Scripted + one card select.**

**NEW POSITION.** She arrives once the team exists — not before. She isn't part of the assembly; she's the one who's simply there.

She asks **one question**. That's it.

> *"How are you feeling about all this?"*

Card select with free-text escape. Reuse the previous feeling options if they still fit.

**Why one question, why here.** This is the honest moment for it — the user has just been handed a team and told this is happening. Something lands. And practically: that answer is Sera's opening thread. Without it, her first real conversation starts from nothing. With it, she has somewhere to begin — *"You said you were nervous when we set this up. Still?"*

Short in-voice reaction to whichever option is picked.

→ `sessionFeedback.emotionalCheckIns`

---

### 13 — Sera's promise
**Sera. Scripted + hold-to-continue.**

**NEW BEAT.** Her moment, and the only point in onboarding that asks anything of the user.

> *"Right. Before I let you go."*
>
> *"I'm not going to tell you how this'll go. Nobody can, and you'd know I was guessing."*
>
> *"But I'll be here. The whole way. The good weeks and the ones where you don't want to open this app. That part I can promise."*
>
> *"Hold this for a second."*

**The interaction:** hold-to-continue. Press and hold, fills over ~2–3 seconds with haptic feedback. On completion:

> *"Okay. Go on."*

Then advances to Kael's wrap.

**Why hold and not tap.** A tap is nothing — people tap fifty things a day. Holding for a few seconds is a small physical commitment and the body registers it differently.

**Critical constraints:**

**Sera does not promise an outcome.** She explicitly refuses to. *"I'm not going to tell you how this'll go"* is the load-bearing line — the refusal to predict is what makes her credible. This must never be softened into anything reassuring about results.

**The user is not promising anything.** The commitment is hers, not theirs. The hold is **acceptance**, not an oath. This distinction matters — asking someone on their fourth attempt to swear this time is different would be quietly humiliating. The person who most needs this moment is exactly the one who'd feel the falseness of being made to affirm something.

*"The ones where you don't want to open this app"* is the line doing the real work. That's the week that matters and everyone knows it.

**Appears exactly once, ever.** Never recurs, never referenced again, nobody is ever held to it. The moment it becomes a recurring feature it's a gimmick.

**Haptics:** escalating or continuous during the hold, completion tick at the end. If haptics are unavailable, the visual fill alone must still work — never gate progression on hardware.

**Accessibility:** hold-to-continue needs an escape. If the fill can't be completed — motor difficulty, device issue — there must be a way through.

---

### 14 — Team wrap + expectation setting
**Kael, with one Sera line. Scripted.**

Kael names the team out loud. The moment it becomes real — not a list of selections, a group of people who are now yours.

**Then:**

> *"One more thing. I've got what I needed — {TRAINER} will want more. How your week actually looks, what you've got to train with, what hurts."*
>
> *"That's theirs to ask, not mine."*

**Why this earns its place.** Two jobs. It explains why onboarding was short — the user isn't wondering why nobody asked about their gym. And it frames the trainer as a person with their own agenda, not a different skin on the same questionnaire. *"That's theirs to ask, not mine"* is territorial in exactly the way Kael is.

This points at something real: the trainer intake exists and runs on first Training Hub entry.

---

### 15 — Close
**Kael, with one Sera line. Scripted.**

> *"That's it for setup. No sign-ups, no card — everything you build here stays on your device for now."*

Honest about current state. No account exists. No trial runs. The app doesn't pretend otherwise.

**Kael lands the plane.** He's the host; the last voice before Home should be his.

---

### 16 — Finish
**Kael. Button → Home.**

> *"Here's your Home."*

Disclaimer:

> *"Your Meridian team is AI — sharp, but not infallible, and not a doctor. Coaching guidance, never medical advice."*

`finish()` writes: user-store gets name, trainerId, nsId, `setupComplete: true`. user-data-store gets the profile, the check-in, and `computeTargets()` writes calorie and macro targets into `nutritionState`. Onboarding store clears.

---

## WHAT HAPPENS NEXT

**First Training Hub entry** → the chosen trainer runs their own intake, in their voice, with their own weighting. Priya pushes back on four days. Noa gates below four. Renata doesn't much care. Same facts, five meanings. Gated on `programmeState.intakeCompletedBy` — re-picking a trainer means the new trainer runs *their* intake. The intake is a relationship, not a form the app filled out.

**First Diet Corner entry** → NS intake. Not built. Same pattern.

**Sera's first conversation** → she has the check-in from beat 12 as an opening thread. *Why now* and *coaching preference*, cut from onboarding, are hers to ask here — in conversation, where they belong.

---

## RULES ENCODED

**Names in subtitle text only, never in voice.** Voice is pre-recorded; interpolating a name into audio isn't viable.

**No Claude API call anywhere in onboarding.** Every line predesigned. Consistency, cost control, no unpredictable behaviour at the most critical moment.

**Kael has no favourite.** Describes shapes, never ranks, never editorializes about method. Every recommendation Meridian makes is fit-based, never quality-based.

**No outcome promises.** No numbers on the user's body. No dates. No "you'd reach X by Y." No evidence base exists; inventing one is disqualifying for a product built on trust.

**Sera promises presence, never results.** Her refusal to predict is what makes her credible.

**Deep questions belong to the specialist who needs them,** asked in their space, after the relationship exists.

**The disagreement is the feature.** Five coaches who genuinely contradict each other is what no other fitness app has. Kael's job is making it legible without taking a side.

---

## KNOWN GAPS

**No sign-up, no account.** Local-only. A phone wipe loses everything. Fine for testers, blocking for Play Store.

**No trial mechanics.** Nothing charged, nothing enforced. Any trial narration would be a lie; there is none, correctly.

**No Phase 0 gates.** Splash, language selection, ToS/Privacy scroll-gates all cut. Play Store blockers, not tester blockers.

**No routing recommendation.** Kael describes shapes but can't recommend — nothing collects fit data. Routing questions (Roster §4) deferred.

**`coachingPreference` no longer collected at onboarding.** Sera asks it in conversation now. Anything reading that field must handle absence gracefully.

**Muscle gain and general fitness parked** — disabled cards, honest copy, dormant rosters built under the old personality-first logic.

---

*End of Meridian Onboarding Script v3.0*

*Target design. Update to reflect implementation once built.*
