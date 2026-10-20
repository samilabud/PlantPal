# End-to-end tests (Maestro)

Five flows against the **development build** on an Android emulator (API 33):

| Flow | Proves |
|---|---|
| `1-sign-in.yaml` | sign in (test sign-in), empty state, Settings shows the account, sign out |
| `2-offline-add-then-sync.yaml` | airplane mode → add a plant (outbox) → online → **Synced** → wipe the app, sign in again → the plant comes back **from the server** |
| `3-paywall.yaml` | free plan stops at 3 plants → paywall → Test Store purchase → 4th plant allowed |
| `4-add-plant-with-ai.yaml` | photo from the gallery → crop → **Identify with AI** → one-time notice → suggestion labeled "Suggested by AI" → form pre-filled → saved. Calls the real Claude API through the local API (~$0.006 a run; needs `ANTHROPIC_API_KEY` in `apps/api/.env.local`) |
| `5-switch-language.yaml` | add a plant in English → Settings > Language > Español → the list already on screen is in Spanish at once → restart → still Spanish → back to System default |

Each flow wipes the app's data first and signs in as a new test user (`<flow>-<timestamp>`),
so flows don't depend on each other or on old data.

## Run
```sh
# 1. local API + DB, and Metro (both from the repo root)
docker compose up -d --wait && pnpm --filter @plantpal/api dev
pnpm --filter @plantpal/mobile start          # NOT with CI=1 (that disables file watching)
# 2. the dev build installed on the emulator (pnpm --filter @plantpal/mobile android)
# 3. the flows
cd apps/mobile && ~/.maestro/bin/maestro test e2e/
```
Why the development build (not a release build): it has the test sign-in and can make RevenueCat
Test Store purchases; release builds can do neither, by design. Real Apple/Google sign-in is
covered by manual checks.

`tools/screens-tour.yaml` (not part of the suite) visits every screen in one language for
screenshots: `maestro test -e LANG=es e2e/tools/screens-tour.yaml`. `tools/toggle-check.yaml`
checks the sign-in language switch.
