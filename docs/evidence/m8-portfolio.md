# M8: Portfolio package, evidence

Date: 2026-10-17.

## Fresh clone (definition of done)
A brand-new clone of the repo, following only the README, in an empty folder:

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | ✅ |
| Database | `docker compose up -d --wait` | ✅ healthy |
| Migrate | `pnpm --filter @plantpal/api db:migrate` | ✅ migrations applied |
| Lint / typecheck | `pnpm lint`, `pnpm typecheck` | ✅ |
| Tests | `pnpm test` | ✅ shared 2 · API 83 · mobile 100 = **185** |

Running the app: the development build was compiled and installed on the Android emulator from the
same commit (`expo run:android`), and the store build comes from EAS's own clean install.

**Bug found by this check:** the first fresh-clone run failed 4 paywall tests with "Invalid hook
call", while the existing checkout passed. Cause: the repo had **two React versions**:
- the API's Next.js had pulled `react@19.3`
- Expo SDK 57 pins `19.2.3` for the app

Packages that find React by pnpm's hoisting (`posthog-react-native` among them) got whichever copy
won the install order. A fresh install, like the one EAS runs for store builds, handed PostHog the
wrong React, so **the next store build would have crashed when the paywall opened.**

The fix (`483863a`):
- one React for the whole workspace: the API is on 19.2.3, which Next 16 accepts
- pnpm `overrides` pin `react` and `react-dom`
- `packageExtensions` declare PostHog's React peers

Re-checked with a new fresh clone: all steps pass.

## Analytics and feature flag (PostHog), gap 9
_In progress: see below once the flag exists and events arrive._

## EAS Submit, gap 7
_In progress._
