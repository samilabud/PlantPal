# End-to-end tests (Maestro)

Three flows against the **development build** on an Android emulator (API 33):

| Flow | Proves |
|---|---|
| `1-sign-in.yaml` | sign in (test sign-in), empty state, Settings shows the account, sign out |
| `2-offline-add-then-sync.yaml` | airplane mode → add a plant (outbox) → online → **Synced** → wipe the app, sign in again → the plant comes back **from the server** |
| `3-paywall.yaml` | free plan stops at 3 plants → paywall → Test Store purchase → 4th plant allowed |

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
