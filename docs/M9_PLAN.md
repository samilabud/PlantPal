# PlantPal: M9.0 plan (AI identification and Spanish)

Status: **waiting for "go"**. No code written.
Date: 2026-10-19. Brief: [`prompts/M9_AI_AND_SPANISH.md`](prompts/M9_AI_AND_SPANISH.md).

Docs used (read today):
- Anthropic: [Vision](https://platform.claude.com/docs/en/build-with-claude/vision) (image tokens, limits), structured outputs and model notes from the Claude API reference bundled with Claude Code (cached 2026-10-06), [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) (effective June 17, 2025), [Privacy Center: data retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) (dated July 1, 2026).
- Google Play: [AI-Generated Content policy](https://support.google.com/googleplay/android-developer/answer/13985936), [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469).
- Expo SDK 57: [expo-localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/), [Localization guide](https://docs.expo.dev/guides/localization/).

## 1. Approach: confirmed, with three changes

The brief's architecture stands (app → our API → Claude; key only on the server; the answer only
pre-fills). Three changes, each forced by current docs:

1. **Structured outputs, not a forced tool call.** Forcing a tool (`tool_choice: {type: "tool"}`)
   now returns a 400 on `claude-sonnet-5-5`. The recommended way is `client.messages.parse()` with
   `output_config.format: zodOutputFormat(schema)`. The API can't enforce `minimum`/`maximum`, so
   the SDK removes them from the schema it sends and checks them itself; our shared Zod schema
   then validates again. To check in M9.1: the SDK helper and `packages/shared` must use the same
   Zod major version.
2. **Thinking can't be switched off on Sonnet 5.5** (`{type: "disabled"}` is a 400). The options
   are a low `effort`, or `thinking: {type: "between_tools"}`. Thinking tokens are billed as
   output, so the evaluation measures both settings, not just the two models.
3. **Refusals.** Check `stop_reason === "refusal"` before reading the answer, and map it to the
   same "I'm not sure" message. Anthropic recommends opting into server-side fallback
   (`fallbacks: "default"`) on Sonnet 5.5; I plan to enable it and log when it fires. You can say no.

Also: the photo is already a 1280 px square JPEG. For the AI call the app resizes it to
**1024×1024**, which costs ⌈1024/28⌉² = **1,369 image tokens**.

Time limits: the app cancels after 20 s. The server gives Claude 15 s, with the SDK's automatic
retries turned off. It retries an invalid answer once only if less than 8 s have passed; otherwise
it returns the error right away. Vercel `maxDuration` for the route: 20 s.

## 2. Model choice and cost per identification

**Method:** the evaluation script runs every photo through each configuration below and records
correct (yes/partly/no), interval within the cited range, latency (p50/p95) and real cost from
`usage`. Choose the cheapest configuration whose accuracy is within ~5 points of the best one,
with p95 under 8 s.

| Config | Model | Setting |
|---|---|---|
| A | `claude-sonnet-5-5` | effort `low` |
| B | `claude-sonnet-5-5` | `between_tools` (no thinking) |
| C | `claude-haiku-5-5` | effort `low` |

**Estimate before measuring** (prices: Sonnet 5.5 $2 / $10 per million input/output tokens,
Haiku 5.5 $0.10 / $0.50):

| | Input tokens | Output tokens (JSON + thinking) | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|---|
| Image 1024² | 1,369 | | | |
| System prompt + schema + "Language: es" | ~500 | | | |
| Answer | | 150–600 | | |
| **Per identification** | **~1,900** | **150–600** | **$0.005–0.010** | **$0.0003–0.0005** |

Estimates; the evaluation replaces them with measured numbers.

**This collides with the Premium price.** Premium is USD 0.50/month (Google keeps 15%). A
Premium user at the full 30/day for a month:

| | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|
| 900 identifications | ~$4.50–9.00 | ~$0.27–0.45 |

Typical use is far lower (people add a plant a few times a month), but the limit is what
protects you. **Decision for you** (I recommend the first):
- keep 30/day, and also cap Premium at **100 per month**; or
- lower Premium to 10/day; or
- keep 30/day only if the evaluation picks Haiku.

**Spending guard:** `AI_DAILY_LIMIT` is a dollar amount (suggest `1.00`). The server adds up
today's logged cost; at the limit the route answers "AI is resting" without calling Claude. Plus
a monthly spend limit on the Anthropic workspace as the last backstop (§7).

**Evaluation budget:** 25 photos × 3 configs ≈ 75 calls, plus prompt iterations: under **$2**.
I need your OK before running it.

## 3. i18n library: i18next + react-i18next

| | i18next + react-i18next | Lingui |
|---|---|---|
| Files | Plain `en.json` / `es.json`, exactly what the brief asks | PO catalogs compiled to JS |
| Build setup | None | Babel macro + compile step in Metro and Jest |
| Switch without restart | `i18n.changeLanguage()` re-renders | Yes |
| Plurals | `Intl.PluralRules` (`_one` / `_other` keys) | ICU plurals |
| Server reuse (push texts) | Same JSON readable from Node | Needs its runtime |

Choose **i18next + react-i18next**: no build changes, the key-parity test is a plain JSON
comparison, and the server can read the same push texts. Lingui's advantage (string extraction)
is covered by the lint check. Versions and React 19 support are checked when installing in M9.3.

Details:
- Device language from `expo-localization` `getLocales()`, re-read when the app returns to the
  foreground (Android can change it without a restart, per the docs).
- Declare `supportedLocales: ["en", "es"]` in the `expo-localization` plugin, so Android 13+ lists
  PlantPal under per-app language settings; "System default" follows that.
- Translate the app name and the camera/photo permission texts through `locales` in the app
  config. Native change: it ships in build 7.
- Hard-coded string check: `eslint-plugin-i18next` (`no-literal-string`) on `src/app` and
  `src/components`, plus the key-parity unit test.
- Push texts used by both the app and the server live in `packages/shared/src/i18n/`.
- Web pages: `/es/privacy`, `/es/support`, `/es/delete-account` as separate routes sharing one
  component per page. They stay static, and the English URLs already in Play Console don't
  change. (`?lang=es` would make the pages dynamic.)

## 4. Data model changes (Drizzle migrations)

| Change | Columns | Why |
|---|---|---|
| New table `ai_identifications` | `id`, `user_id` → users (cascade), `created_at`, `model`, `status` (`pending`, `ok`, `low_confidence`, `not_plant`, `invalid_output`, `refused`, `timeout`, `error`), `input_tokens`, `output_tokens`, `cost_micro_usd`, `latency_ms` | Daily and monthly counts, the spending guard and cost per call. No photo, no answer text. |
| New table `ai_reports` | `id`, `identification_id` → ai_identifications, `user_id` → users (cascade), `created_at`, `reason` (`wrong`, `offensive`, `other`), `note` (≤ 500 chars, optional), `suggestion` (jsonb: the AI's answer, sent back by the app) | "Report this suggestion" (Play policy). Stores only what the user chose to report. |
| `devices.language` | `text`, `'en' \| 'es'`, default `'en'` | The server's reminder pushes go per device, and two phones can use different languages. |

The limit check is race-safe: inside a transaction holding the user's advisory lock (the same
pattern as sync), count today's rows, then insert a `pending` row before calling Claude, and
update it afterwards. Days are counted in UTC. Every call that reached Claude counts, including
"not a plant". Deleting an account removes all of these rows.

## 5. API contract (Zod in `packages/shared`)

**`POST /api/plants/identify`** (Bearer auth)
- Request: `{ image: string /* base64 JPEG, at most 1 MB */, language: 'en' | 'es' }`
- 200: `{ id: string, suggestion: IdentifyResult, remaining: { today: number } }`
  (`IdentifyResult` is the brief's schema, unchanged.)
- Errors, in the existing shared error shape:

| Status | `code` | App shows |
|---|---|---|
| 400 | `invalid_image` | Generic "couldn't read the photo" |
| 401 | (existing) | Normal refresh flow |
| 429 | `identify_limit` + `{ plan, limit, resetsAt }` | "You've used today's identifications" + Upgrade when Free |
| 503 | `ai_resting` | "AI is resting, try again tomorrow" |
| 502 | `ai_invalid_output` / `ai_unavailable` | "Couldn't identify it right now" |
| 504 | `ai_timeout` | Same, with "try again" |

**`POST /api/plants/identify/report`**: `{ identificationId, reason, note?, suggestion }` → 204.
Only the owner's own identification id is accepted.

The request body is never logged. The route logs one line per call: id, model, status, tokens,
cost and latency.

## 6. Policy and store changes

| # | Change | Source |
|---|---|---|
| 1 | **Privacy policy (EN + ES):** new "Plant identification with AI" section. The photo goes to Anthropic only when you tap "Identify with AI", and PlantPal doesn't store it. Anthropic deletes API inputs and outputs "within 30 days of receipt or generation" (with exceptions: usage-policy enforcement, legal requirements). "Anthropic may not train models on Customer Content from Services." We keep counts and token usage, and a report's content if you send one. | Privacy Center (July 1, 2026); Commercial Terms §B |
| 2 | **First-use notice**, once per device: one sentence + privacy link + "Continue / Cancel". | Brief |
| 3 | **"Report this suggestion"** on every AI answer, without leaving the app. | Play AI-Generated Content: apps "must contain in-app user reporting or flagging features", letting users "report or flag offensive content to developers without needing to exit the app" |
| 4 | **Data safety:** Photos are already declared (collected, optional, App functionality). Anthropic acts as a service provider, which Google says is not "sharing". Reports fall under the existing "Other user-generated content". I expect **no change to the form answers**, only to `docs/release/data-safety.md`; you confirm in Play Console in M9.4. | Data safety help page |
| 5 | **"Suggested by AI. Please check it"** label on pre-filled fields. | Brief; honest labeling |
| 6 | **Store listing:** one line about the AI feature in English, and the full Spanish (es-419) listing in `docs/release/store-listing.es.md`. | Brief |

Not checked yet and kept open: whether Play Console asks a separate question about AI features
when the release is submitted. I'll look in M9.4 and won't assume an answer.

## 7. The API key: use a new one, not StoryKeep's

Create a **separate key for PlantPal**, ideally in its own **"PlantPal" workspace**:
- **Spend limit:** a workspace can have its own monthly limit, so a bug or abuse in PlantPal can't
  use up StoryKeep's budget, and the other way round.
- **Rotation:** if one key leaks or is rotated, the other app keeps working.
- **Cost evidence:** the evaluation and the evidence file need PlantPal's cost alone.
- **Expiry:** the key in your screenshot expires **Nov 12, 2026**, 24 days from now. For a
  production feature, choose a longer expiry or put the rotation date in a calendar.

Then add it yourself (don't paste it in chat):
`vercel env add ANTHROPIC_API_KEY production` in `apps/api`, and in `apps/api/.env.local` for
the evaluation script (git-ignored).

## 8. What I need from you before M9.1
1. A new PlantPal key (or say if you'd rather reuse StoryKeep's), with a workspace spend limit.
2. OK for an evaluation budget of up to $2.
3. The Premium limit decision (§2).
4. `AI_DAILY_LIMIT` value (I suggest $1.00/day).
5. Keep or drop server-side fallback (§1.3).
6. A few photos of your plants for the evaluation set.
