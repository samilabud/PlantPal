# M9: AI plant identification and Spanish, evidence

Plan and decisions: [`M9_PLAN.md`](../M9_PLAN.md). This file grows with each sub-milestone.

## M9.1: API (2026-10-19)

### What was built
| Piece | Where |
|---|---|
| Shared contract: `IdentifyResult` (the answer schema), request/response, limits, report | `packages/shared/src/identify.ts` |
| The Claude call: structured output, image first, one retry, refusal and timeout handling | `apps/api/src/ai/identify.ts` |
| The prompt, with the reasoning behind each rule | `apps/api/src/ai/prompt.ts` |
| Cost per call (fallbacks priced per model) | `apps/api/src/ai/pricing.ts` |
| Per-user limits and the daily spending guard, race-safe | `apps/api/src/ai/limits.ts` |
| `POST /api/plants/identify`, `POST /api/plants/identify/report` | `apps/api/src/app/api/plants/identify/` |
| Tables `ai_identifications`, `ai_reports` | `apps/api/drizzle/0004_ai.sql` |
| Evaluation photos, script and results | `apps/api/scripts/eval*` |

Docs used: Anthropic [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
(image tokens = ⌈w/28⌉ × ⌈h/28⌉), the Claude API reference bundled with Claude Code (structured
outputs, Sonnet 5.5 thinking rules, server-side fallback), the SDK's own source for
`messages.parse` behavior, and Next.js 16's bundled docs for `maxDuration`.

### Decisions made while building (not in the plan)
- **`messages.create` + our own validation instead of `messages.parse`.** Reading the SDK
  (0.131.0) showed `parse()` throws when the answer fails validation, and the token usage of that
  call is lost. A failed answer is still billed, so we validate the JSON ourselves and always
  record usage.
- **Schema field order matters.** In the first evaluation, Sonnet 5.5 left a stray `}` at the end
  of `careTip`, the last field, in 16 of 125 answers (Haiku: 0). Moving `confidence` (a
  fixed-choice field) to the end brought it to **0 of 125**. A server-side cleanup stays as a
  safety net, counted as `textRepairs` in every log line.
- **One TypeScript for the workspace.** Adding the SDK made pnpm re-resolve Expo's TypeScript
  peer to the API's 5.9 instead of the app's 6.0, which created a second copy of the Expo graph
  and broke a mobile test suite. The API now uses TypeScript ~6.0.3 like the app and
  `packages/shared`; the lockfile got smaller and every check passes. Same class of bug as the
  two-React problem found in M8.
- **SDK pinned to 0.131.0** (released 2026-09-30), not the 4-day-old 0.135.0.
- **The evaluation script is TypeScript** (`eval-identify.ts`, run with `tsx`), not `.mjs` as the
  brief said, so it imports the exact prompt and request code the route uses instead of a copy.
- **`devices.language` moves to M9.3,** where it's used (server push texts). Adding the column
  now would be dead code.

### Tests (mocked Anthropic: the real SDK over a fake network)
`apps/api/src/app/api/plants/identify/identify.test.ts` and `src/ai/pricing.test.ts`, 25 tests:

| Brief case | Test |
|---|---|
| Success | Suggestion returned; status, tokens and cost recorded; nothing about the photo stored |
| Request shape | Image first, language line, JSON schema without numeric ranges, `fallbacks: "default"` + beta header; no fallback sent to Haiku |
| Low confidence | Passed through with status `low_confidence` (the app won't pre-fill it) |
| Not a plant | Every field blanked even if the model filled some |
| Invalid model output | Retried once (both calls' usage recorded); 502 `ai_invalid_output` after two |
| Refusal | Treated as "not sure", no retry |
| Timeout | Gives up at the deadline with status `timeout` |
| Anthropic down | 502 `ai_unavailable`, not counted against the user |
| Limit reached | Free 3/day with `resetsAt`; Premium 100/month; Premium shows day and month remaining |
| Race | 5 simultaneous requests on Free: exactly 3 pass |
| Spending guard | At `AI_DAILY_LIMIT` nobody reaches Claude (503 `ai_resting`) |
| Validation | Non-JPEG rejected before Claude; sign-in and a configured key required |
| Report | Own suggestion recorded; someone else's is a 404 |
| Account deletion | Identifications and reports are deleted with the account |

Whole repo: lint ✅, typecheck ✅, tests ✅ shared 2 · API 108 · mobile 105 = **215**. The same passes from a
fresh clone (`pnpm install --frozen-lockfile`, lint, typecheck, test).

### Evaluation
25 openly licensed photos from Wikimedia Commons (20 houseplants of 14 kinds, 3 non-plants, 2
deliberately blurred), cropped square and resized to 1024 px like the app. Authors and licenses:
[`sources.json`](../../apps/api/scripts/eval/sources.json). Watering ranges: the category from
[WVU Extension's houseplant care table](https://extension.wvu.edu/lawn-gardening-pests/indoor-plants/common-houseplant-care),
turned into days by our own judgment (listed in
[`cases.json`](../../apps/api/scripts/eval/cases.json) for review).

Scoring: **right** = correct species (or genus where only a genus is expected); **partly** =
right genus only; **unsure** = the app wouldn't pre-fill (honest "not sure"); **wrong** =
confidently wrong, the harmful case. For blurry photos, saying "not sure" counts as right.

**English** (final prompt, [full results](../../apps/api/scripts/eval/results/2026-10-20T01-39-55-en.md)):

| Config | Plants right | Partly | Unsure | Wrong | Not-plant | Blurry | Interval in range | p50 | p95 | Cost / photo |
|---|---|---|---|---|---|---|---|---|---|---|
| A: Sonnet 5.5, low effort | **19/20** | 1 | 0 | **0** | 3/3 | 2/2 | 21/21 | 2.3 s | 8.9 s* | $0.0058 |
| B: Sonnet 5.5, no thinking | **19/20** | 1 | 0 | **0** | 3/3 | 2/2 | 21/21 | 2.3 s | 3.0 s | $0.0058 |
| C: Haiku 5.5, low effort | 16/20 | 2 | 2 | 0 | 3/3 | 2/2 | 20/20 | 1.5 s | 3.4 s | $0.0003 |

**Spanish** ([full results](../../apps/api/scripts/eval/results/2026-10-20T01-41-48-es.md)):

| Config | Plants right | Partly | Unsure | Wrong | Not-plant | Blurry | Interval in range | p50 | p95 | Cost / photo |
|---|---|---|---|---|---|---|---|---|---|---|
| A: Sonnet 5.5, low effort | **18/20** | 1 | 1 | **0** | 3/3 | 2/2 | 20/20 | 2.1 s | 2.9 s | $0.0059 |
| C: Haiku 5.5, low effort | 15/20 | 3 | 1 | 1 | 3/3 | 2/2 | 20/20 | 2.1 s | 4.0 s | $0.0004 |

\* One 11 s call (monstera-1, 92 output tokens: API-side latency, not thinking). Still inside the
15 s server budget. 25 photos is too few for a stable p95.

What the misses were:
- **Sonnet:** the *Mammillaria* was called *M. elongata* (genus right, species wrong) in every
  run; one variegated *Echeveria* got "low" confidence in Spanish.
- **Haiku:** a climbing pothos photographed in the wild called *Philodendron*, the African violet
  unsure in English and **confidently wrong in Spanish** (*Episcia*), and several genus-only
  answers (*Philodendron sp.*, *Aloe sp.*).
- Spanish names were natural (*Costilla de Adán*, *Lengua de suegra*, *Cuna de Moisés*,
  *Árbol de jade*) and tips used "tú". The first runs (before the field-order fix)
  are in the same folder for comparison.

Tokens per identification: ~2,400 in (image 1,369, prompt + schema ~1,030), ~100 out. Thinking at
low effort was barely used: A and B cost the same.

**Spent on the evaluation:** $0.92 of the $2 approved (4 full runs + 1 smoke test).

### Recommendation
**Sonnet 5.5, low effort (config A, the default).** It was right on 37 of 40 plant photos across
both languages and never confidently wrong. Haiku is 19× cheaper but was right on 31 of 40, with a
confidently wrong answer in Spanish, which is the outcome that hurts a user (a wrong watering
plan). A and B were equal; A keeps the documented default (adaptive thinking), and B stays one
env var away (`ANTHROPIC_THINKING=between_tools`).

**Measured cost: $0.0058 per identification** (plan estimate: $0.005–0.010).

What that means for the limits (decision for the owner):

| Who | Maximum use | Maximum cost / month |
|---|---|---|
| Free user | 3/day ≈ 90/month | $0.52 |
| Premium user | 100/month | $0.58 (Premium monthly nets ~$0.43 after Google's 15%) |
| Everyone together | `AI_DAILY_LIMIT` $1/day ≈ 170 identifications/day | $30 |

### Not proven yet
- The route has not run on Vercel or from the app (M9.2).
- Accuracy on real users' photos; 25 photos is a small, clean set, and only 14 kinds of plant.
- The Spanish quality was checked by me, not a native speaker.
- Server-side fallback has never fired, so its billing path is tested only with a fake response.
