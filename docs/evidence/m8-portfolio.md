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
**Design** (`apps/mobile/src/analytics/analytics.ts`):
- a fixed, typed event list: `plant_added`, `plant_watered`, `photo_added`, `reminders_enabled`, `paywall_viewed`, `purchase_completed`
- never plant names, photos or emails
- autocapture, session replay and lifecycle events off
- identified only by our random account id; `reset()` on sign-out and account deletion
- an opt-out switch in Settings (PostHog persists it)
- no key → the client is disabled (local dev, tests, forks)
- PostHog project setting **Discard client IP data** on

**The flag:** `paywall-variant`, multivariate (`control` 50% / `plants-first` 50%), released to 100%
of users. The paywall shows different copy per variant (same plans and prices). `paywall_viewed`
and `purchase_completed` carry the variant shown, so conversion can be compared per variant.

| Check | Result |
|---|---|
| Key | verified against PostHog's `/flags` endpoint (a fake key gets `authentication_failed`) |
| Flag served | 8 test ids → 4 `control`, 4 `plants-first` |
| Dev build (emulator) | user `579f23b7…` got `plants-first`: "Room for every plant" ([screenshot](m8/paywall-plants-first.png)); Settings switch ([screenshot](m8/settings-analytics.png)) |
| Events in PostHog (emulator) | `Identify`, `Feature flag called`, `Experiment exposure`, `paywall_viewed` ×2, `plant_watered`; person = our account UUID; no screen/URL |
| Store build from Google Play (version code 4) | from person `b76fef3a…` (the same id RevenueCat uses), library `posthog-react-native`: `Identify`, `Feature flag called`, `Experiment exposure`, `paywall_viewed`, `purchase_completed` (a license-tester purchase), `reminders_enabled` |
| Tests | 6: allowed properties only, both variants' copy, view recorded once with the variant, purchase recorded with the variant, opt-out / opt-in, previously opted-out state |

Privacy policy, Google Play Data safety and App Store App Privacy answers were updated to list the
analytics and PostHog as a processor.

## EAS Submit, gap 7
- `eas.json` submit profile: Android `track: internal`, `releaseStatus: draft`. The service account key is stored on EAS, never in the repo.
- `eas-submit@plantpal-bd84c` was given only **Release apps to testing tracks** for PlantPal.
- `eas build --profile production --platform android --auto-submit` → build `1a21e36c…` (versionCode 4) → submission `0e8e8e1d…` → the bundle appeared as a **draft** in Play's internal testing (a manual re-upload of the same file was then refused with "Version code 4 has already been used", which confirms EAS's upload).
- Rolled out by a person in Play Console, and installed **as an update over version 3** on the phone (data and sign-in kept).

## Other fixes during M8
- **The FCM key for the production app id was missing** on EAS (only `.dev` had it), so remote push couldn't reach the Play build. The M7 claim was corrected. After adding the Firebase key, a push sent through Expo got receipt `ok`, arrived on the phone, and its deep link opened Settings.
