# Prompt: M9, AI plant identification and Spanish (run in Claude Code)

Paste everything below the line into Claude Code at the root of this repo.

---

You are my senior mobile engineer and mentor, continuing **PlantPal**, a React Native (Expo SDK 57)
app with a Next.js API, live on Google Play. Read `README.md`, `docs/FINAL_REPORT.md` and
`docs/INTERVIEW_NOTES.md` first: they describe the architecture, what is proven, and the rules this
project follows. Keep following them.

## Goal
Add two features to the live app, safely:
1. **"Identify with AI":** after the user takes or picks a photo of a plant, the app suggests the
   plant's name and a watering interval using the Claude API. The suggestion pre-fills the form;
   the user always confirms or edits it.
2. **Spanish:** the whole app works in English and Spanish, follows the phone's language by
   default, and has a visible language switch.

## Why (context for your decisions)
- PlantPal's promise is "never forget to water a plant". Most users don't know their plant's name
  or how often to water it; a photo is the easiest input they have.
- The app is public with real users and real purchases. Every change must keep the privacy
  policy, the Google Play Data safety answers and Play's AI policies truthful.
- This is portfolio evidence: build it so I can explain every decision in an interview.

## Hard rules (same as the original brief, plus AI-specific ones)
1. **Teach me.** After each milestone, explain the 5 most important decisions in plain English.
2. **No secrets in the app or the repo.** The Anthropic API key lives only on the server (Vercel
   env `ANTHROPIC_API_KEY`), never in an `EXPO_PUBLIC_*` variable. Never print keys.
3. **Check current docs before writing code** and say which ones you used: the Anthropic Messages
   API (vision / image input, structured outputs or tool use, models, pricing, rate limits),
   Expo SDK 57 (`expo-localization`, image manipulator) and Google Play's AI-Generated Content
   and User Data policies. Don't invent model names, parameters or policy requirements.
4. **Model:** default to `claude-sonnet-5-5`, configurable with an env var (`ANTHROPIC_MODEL`),
   so we can compare it with `claude-haiku-5-5` on cost and accuracy. Measure both on the
   evaluation set (below) and recommend one with numbers.
5. **Ask before anything costs money or publishes:** API usage beyond testing, new store
   releases, and store listing changes. Give me a cost estimate per identification first.
6. **Evidence over claims:** `docs/evidence/m9-ai-and-spanish.md` with test results, the
   evaluation table, screenshots in both languages, and what is not proven.
7. Small commits with clear messages; don't push or release without my explicit word
   ("push", "submit").

## Feature 1: AI identification

### Architecture (follow it, or explain why not before changing it)
- **App:** in the plant form and on the plant detail screen, after a photo is chosen, show an
  **"Identify with AI"** button. The app sends the already-compressed photo (reuse
  `src/photos/capture.ts`; resize further to about 1024 px for the AI call) to our API. While waiting, show
  a busy state on the button (it must be cancellable and time out after ~20 s).
- **API:** new route `POST /api/plants/identify` (authenticated). It validates the request with
  Zod (in `packages/shared`), calls the Claude Messages API with the image, validates Claude's
  answer with the same Zod schema, and returns it. Nothing about the photo is stored.
- **Response schema** (shared Zod schema, used on both sides):
  ```ts
  {
    isPlant: boolean,
    commonName: string | null,        // in the user's language
    scientificName: string | null,
    confidence: 'high' | 'medium' | 'low',
    wateringIntervalDays: number | null, // integer 1–60
    careTip: string | null,           // one sentence, in the user's language
  }
  ```
- **Getting structured output:** use the Messages API's structured output feature or a single
  forced tool call with this JSON schema (check which the current docs recommend). Never parse
  free text with regexes. Reject and retry once if validation fails; then return a friendly error.
- **UX rules:**
  - The suggestion **pre-fills** name and interval, clearly labeled "Suggested by AI. Please
    check it", and the user can edit anything before saving. Never save without the user.
  - `confidence: 'low'` or `isPlant: false` → don't pre-fill; show "I'm not sure what this is.
    Try a closer photo of the leaves" (in the user's language).
  - Errors go through `toUserMessage()` with a new `'identify'` context; the feature is
    optional, so failures never block adding a plant.
  - Offline: the button is disabled with an explanation; the rest of the form works.
- **Limits and cost control (server-side, never trust the app):**
  - Free plan: 3 identifications per day per user; Premium: 30 per day. Store counts in Postgres.
  - Global daily spending guard (env `AI_DAILY_LIMIT`), after which the route answers "AI is
    resting, try again tomorrow" instead of calling Claude.
  - Log token usage per call (no images, no user content) so cost per identification is measurable.

### The Claude prompt (start from this draft, improve it, and keep it in code with comments)
System prompt:
```
You are a careful botanist helping a houseplant owner. You will receive one photo.

Decide whether the photo shows a plant. If it does, identify it as specifically as you can.
Then recommend how many days usually pass between waterings for this plant kept indoors in a pot,
for a typical home (moderate light, room temperature). Give one practical care tip.

Rules:
- If you are not reasonably sure, say so with confidence "low" rather than guessing.
- If the photo does not show a plant, set isPlant to false and leave the other fields null.
- wateringIntervalDays is a whole number from 1 to 60. For plants whose needs vary a lot
  (for example succulents in winter), pick the typical value and mention the variation in the tip.
- Write commonName and careTip in {language}. Keep the tip under 140 characters.
- Never include personal information, even if it appears in the photo.
```
User turn: the image, plus `Language: {language}` (from the app's current language).

Prompt best practices to apply and explain:
- Give context about who the answer is for and why.
- State the rules for uncertainty explicitly; ask for structured output instead of prose.
- Keep the instructions short and the image first.
- Test on real photos and iterate.

### Evaluation (required before release)
- Build a small evaluation set: about 20 photos of common houseplants (I'll provide some; use
  openly licensed images otherwise and record their sources), 3 non-plant photos, 2 blurry ones.
- Record for each model: correct identification (yes/partly/no), interval within a reasonable
  range (per a cited care source), latency and cost. Put the table in the evidence file.
- Script it (`apps/api/scripts/eval-identify.mjs`) so it can be rerun after prompt changes.

### Privacy, policy and store updates (must ship with the feature)
- **Privacy policy** (`apps/api/src/app/privacy/page.tsx`): add the AI feature. The photo is
  sent to Anthropic only when the user taps "Identify with AI", to identify the plant; it isn't
  stored by PlantPal. Describe how Anthropic handles API data **from Anthropic's current
  commercial terms and privacy docs**: quote them, don't assume.
- **First-use notice:** the first time the user taps the button, explain in one sentence that the
  photo is sent to an AI service to identify the plant, with a link to the privacy policy.
- **Google Play:** check the current **AI-Generated Content** policy. It requires apps with
  generative AI to let users report offensive or inappropriate output in the app, so add a "Report
  this suggestion" action that records the report on our server. Update **Data safety** (photos are
  now also processed by a service provider for app functionality) and `docs/release/data-safety.md`.

## Feature 2: Spanish

- **Library:** pick an i18n library compatible with Expo SDK 57 and React 19 (for example
  `i18next` + `react-i18next`, or Lingui; compare briefly and choose). Use `expo-localization`
  (already installed) for the device language.
- **Strings:** move every user-facing string into `src/i18n/en.json` and `src/i18n/es.json`,
  including:
  - errors (`toUserMessage`)
  - the paywall copy for both flag variants
  - the first-run guide
  - Alerts
  - notification texts
  - accessibility labels
- **Plurals and formats:** "1 plant / 2 plants", dates and times through `Intl` with the active
  locale. Prices already come localized from Google Play.
- **Spanish style:** neutral Latin American Spanish (`es-419`), informal "tú", short and friendly
  like the English. List any terms you weren't sure about so I can review them.
- **Language switch (the design change):**
  - In **Settings**, a "Language" row: System default / English / Español.
  - On the **sign-in screen**, a small, unobtrusive "English | Español" toggle at the top, so new
    users can switch before signing in.
  - Persist the choice on the device; "System default" follows the phone.
- **Server texts:** reminder push notifications sent by the cron must use the user's language:
  store the user's language on `devices` (or `users`) when the app registers, and localize the
  notification text on the server. Local reminders use the app's language.
- **Web pages:** Spanish versions of `/privacy`, `/support` and `/delete-account` (e.g. `?lang=es`
  or `/es/...`), linked from the app in the active language.
- **Store:** a Spanish store listing (es-419) with translated text and Spanish screenshots,
  prepared in `docs/release/store-listing.es.md`. I'll paste it into Play Console.
- **Guardrail test:** a unit test that fails if any key exists in one language file but not the
  other, and a lint-style check that no screen contains a hard-coded user-facing string.

## Milestones (show evidence for each, and wait for my "go" before the next)
- **M9.0 Plan (no code):**
  - confirm the approach
  - model choice method and cost estimate per identification
  - i18n library choice
  - the data model changes (identification counts, user language, reports)
  - the API contract
  - the list of policy changes
- **M9.1 API:** the identify route with Zod validation, limits, the spending guard, token
  logging, and tests with a mocked Anthropic client (success, low confidence, not a plant,
  invalid model output, timeout, limit reached). Then the evaluation script and table.
- **M9.2 App:** the button, the pre-fill UX, the first-use notice, "Report this suggestion",
  offline and error states, component tests. Then Maestro: add a plant with AI on the emulator.
- **M9.3 Spanish:** i18n setup, all strings moved, the switch in Settings and on sign-in,
  localized notifications (local and server), Spanish web pages, the guardrail tests, and
  screenshots of every screen in both languages.
- **M9.4 Release prep:**
  - updated privacy policy and Data safety answers, Spanish store listing text
  - a version 7 build (native changes need a new build; JS-only fixes can go over the air)
  - internal testing on my phone in both languages
  - stop and wait for my "submit"

## Definition of done
- All existing tests still pass, plus the new ones. Lint and typecheck are clean. Fresh-clone check passes.
- The evaluation table exists, with a recommended model and the measured cost per identification.
- Every user-visible string exists in English and Spanish, and switching language takes effect
  immediately without restarting the app.
- The privacy policy, Data safety answers and the README claims table are updated, and they are
  true.
- `docs/evidence/m9-ai-and-spanish.md` lists what is proven and what isn't.

Start with **M9.0**. Don't write code until I say "go".
