# M6: Quality, evidence

Date: 2026-10-16 · Commits `45fbb2a..HEAD`

## Test report (unit, component, integration)
Produced by `pnpm test:ci` (the same command CI runs; CI also writes this table to the job summary and uploads the raw reports as the `test-reports` artifact).

| Package | Tests | Failures | Line coverage | Branch coverage | Runner |
|---|---|---|---|---|---|
| packages/shared | 2 | 0 | n/a | n/a | Vitest |
| apps/api | 82 | 0 | 87.3% | 75.7% | Vitest + real Postgres |
| apps/mobile | 91 | 0 | 52.5% | 47.8% | Jest + React Native Testing Library + real SQLite |
| **Total** | **175** | **0** | | | |

Mobile line coverage is lower because screens are covered end-to-end by Maestro (below), and native-module wrappers (camera, notifications, purchases) are exercised on the device.

**New in M6:**
- `useLiveQuery` re-reads on change and reports errors
- the sync scheduler: debounce, single flight, offline
- `Button`: busy and disabled accessibility state
- `PlantPhoto`: local file, remote signed URL, placeholder
- the first-run guide
- the limit notice, and the premium-expiry timeline seen on a real phone
- the list performance check

## End-to-end (Maestro, Android emulator API 33, development build)
| Flow | What it proves | Result |
|---|---|---|
| `1-sign-in.yaml` | clean install → test sign-in → first-run guide → empty state → Settings shows the account → sign out | ✅ passed (3 m 40 s) |
| `2-offline-add-then-sync.yaml` | airplane mode → add a plant → "Offline · 1 to sync" → online → "Synced" → wipe the app, sign in again → the plant is pulled **back from the server** | ✅ passed end to end earlier the same day (the plant came back from the server); ⚠️ in the final run the dev client stalled on a blank screen at the first launch, before any app step |
| `3-paywall.yaml` | 3 plants → the 4th opens the paywall ("The free plan includes 3 plants.") → Test Store "TEST VALID PURCHASE" → "Welcome to Premium" → 4th plant allowed | ✅ passed (4 m 40 s) |

Each flow wipes app data (`clearState`) and signs in as a new test user, so flows are independent. Run: `cd apps/mobile && pnpm e2e` (writes `reports/maestro-junit.xml`).

**Honest status:** each flow passes on its own. Running all three back to back on this machine is flaky: the emulator's device server sometimes dies during text input, and the development client sometimes stalls while loading the bundle from Metro. Both happen before or outside the app's code, and they got worse as host load rose (load average ~16 during the last runs). The app logic each flow checks has passed. Expo recommends running E2E against release-style builds (no Metro, no dev launcher); that build and a hosted emulator run are planned for M7.

## Performance check: the plant list
**What was measured:** the main list's SQL query, the work that grows with data. It computes "last watered" per plant through a correlated subquery. Measured on real SQLite with **1,000 plants and 30,000 waterings**, averaged over 5 runs (`__tests__/list-performance-test.ts`):

| Query | Time |
|---|---|
| `listPlants` with the `(plant_id, watered_at)` index | **1.4 ms** |
| the same query **without** the index | **1,177 ms** |

The test also asserts that `EXPLAIN QUERY PLAN` uses the index, so a schema change that drops it fails CI. With the index, the list stays instant far past any realistic collection. Without it, every refresh (each watering, each sync) would freeze the UI for over a second.

## Scroll smoothness (on device): not yet a valid measurement
Measured with `adb shell dumpsys gfxinfo` while flinging the 300-plant list on the emulator (development build):
- **Run 1:** 82 frames; p50 19 ms, p90 32 ms, 26% janky.
- **Run 2:** 100% janky, 700 ms+ frames.

The host was overloaded at the time (load average ~16; the emulator, the Docker VM and a system malware scan competing for CPU), and Android itself showed "System isn't responding". These numbers measure the machine, not the app, so **no smoothness claim is made from them**. A real measurement needs a release build on a physical phone (the dev build also runs JS in debug mode); this moves to M7.

What *is* measured is the data side: the list query at 1.4 ms for 1,000 plants (above). Rows are lightweight, and FlatList virtualizes them (only the rows on screen plus a buffer around them are mounted, not all 300).

## Accessibility
- **Roles and labels:** every button has an accessibility role and label (`Button`, header Settings, Water buttons "Mark Fern as watered", sync badge "Sync status: … Tap to sync now.").
- **Images:** they have labels ("Photo of Fern"). Decorative emoji in the guide are hidden from screen readers. Each guide card is read as one item.
- **Alerts:** errors and notices use `accessibilityRole="alert"` (sign-in error, form validation, limit notice).
- **Busy and disabled states** are exposed (tested).
- **Touch targets:** buttons ≥ 48 pt; the header Settings link became a button with `hitSlop` (≥ 44 pt).
- **Font scaling:** text uses the system font scale (no `allowFontScaling={false}` anywhere). Buttons and inputs use `minHeight`, never a fixed height, so they grow with the text.
- **Large-text check (Android font scale 2.0, the maximum stress setting):** plant list (300 plants), Settings and the paywall were checked by eye on the emulator. Text wraps, nothing is clipped or overlaps, and every button stays reachable. Plant names are kept to one line on purpose (truncated, full name in the accessibility label). Not captured at 2.0: the plant detail screen (the emulator froze). The one overlap seen, the header "Settings" under the floating gear, is the development client's tools button, which isn't in store builds.

## Loading, empty and error states
| Screen | Loading | Empty | Error |
|---|---|---|---|
| Plant list | spinner ("Loading your plants") | logo + "No plants yet" + "See what PlantPal can do" | message with the reason |
| Plant detail | (instant from SQLite) | "Not watered yet" / no photos | "This plant was deleted." |
| Photo | placeholder | placeholder (brand mark) | placeholder when the image fails to load (offline, expired URL) |
| Paywall | spinner | "Purchases aren't set up in this build yet." | "Plans couldn't be loaded. Check your connection." |
| Sync | "Syncing…" | "Synced" | "Offline · N to sync" / "Sync failed · retry" |
| Settings diagnostics | "Checking…" | — | "API unreachable" |

## CI
`.github/workflows/ci.yml` runs on every push and PR:
- secret scan (gitleaks, full history)
- lint and typecheck
- tests with coverage
- a Markdown test report in the job summary
- `test-reports` artifact (JUnit, Jest JSON, coverage summaries)

Maestro runs on an emulator outside CI. A hosted emulator job is a possible M7+ addition (EAS Workflows supports Maestro).

## Bugs found during M6 (and fixed)
- **Premium after expiry:** a Premium subscription that had ended still unlocked the UI (cached profile and cached CustomerInfo ignored the expiry). Found on a real phone; fixed and tested with the exact timeline.
- **Limit notice:** the limit notice was misleading ("on another device") and sticky; replaced by an honest, dismissible one with Upgrade.
- **Edits that never applied:** two scripted edits had silently not applied (the webhook test fix and the empty-state guide button), and their commit messages claimed them. Both corrected in follow-up commits that say so; an audit of 40 such edits found no other misses.
- **Dependency clash:** `jest-junit` pulled in `uuid@14`, which got hoisted and broke Expo's Jest mocks (28 failures); replaced by Jest's built-in JSON report.
- **Maestro on a dev build:** fixes for the dev-client intro, developer menu and "isn't responding" dialog (loop), the floating tools button covering the header (deep link), and keyboard-driven device-server deaths (no `eraseText`, soft keyboard off).

## Docs used
- Maestro: [installing (macOS CLI)](https://docs.maestro.dev/getting-started/installing-maestro/macos), [commands](https://docs.maestro.dev/api-reference/commands), [setAirplaneMode](https://docs.maestro.dev/reference/commands-available/setairplanemode.md), [launchApp](https://docs.maestro.dev/reference/commands-available/launchapp.md), [tapOn (`retryTapIfNoChange`)](https://docs.maestro.dev/reference/commands-available/tapon.md), [repeat](https://docs.maestro.dev/reference/commands-available/repeat.md), [runFlow (`when`)](https://docs.maestro.dev/reference/commands-available/runflow.md), [parameters](https://docs.maestro.dev/advanced/parameters-and-constants); supported Android API levels 29–34
- Expo: [E2E tests with EAS Workflows](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) (why release-style builds are recommended, and why we use the dev build here)
- React Native Testing Library v14 matchers (`toBeBusy`, `toBeDisabled`); Vitest v8 coverage
