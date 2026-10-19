# PlantPal: final report

Date: 2026-10-17. Built with Claude Code as a pair programmer; I reviewed every change.
Evidence for every line below is in [`docs/evidence/`](evidence/).

## Checks and results

| # | Gap from the brief | Result | Evidence |
|---|---|---|---|
| 1 | App on both stores | 🟡 **Android: live on Google Play** (production release reviewed and approved by Google on 2026-10-19, 178 countries). **iOS:** not built or distributed (Apple developer account pending). | [M7](evidence/m7-release.md) |
| 2 | Push notifications end to end | ✅ Android: permission flow, local reminders, token registration, server send (batching, receipts, cron), deep link on tap, all on the Play build. ❌ iOS device. | [M4](evidence/m4-notifications.md), [M7](evidence/m7-release.md) |
| 3 | Mobile authentication | ✅ Google sign-in (Play build, production API), own sessions with rotating refresh tokens, SecureStore, logout, account deletion. 🟡 Apple sign-in implemented and server-tested, not run on an iPhone. | [M2](evidence/m2-auth.md) |
| 4 | Native features via Expo modules | ✅ Camera / photo library with compression, notifications, SecureStore, SQLite, development build, config plugins. Biometrics: not built (optional). | [M1](evidence/m1-foundation.md), [M3](evidence/m3-offline-sync.md) |
| 5 | Offline-first with sync and conflicts | ✅ SQLite source of truth, outbox, `/api/sync` with cursor and paging, last write wins with clock clamp, tombstones, append-only waterings; airplane-mode test. | [M3](evidence/m3-offline-sync.md) |
| 6 | Subscriptions (RevenueCat, sandbox) | ✅ Paywall, entitlement on device and server, signed idempotent webhook (replay and out-of-order tests), restore. A real Google Play test purchase → 6 renewals → expiry back to Free. | [M5](evidence/m5-subscriptions.md), [M7](evidence/m7-release.md) |
| 7 | Release engineering | ✅ EAS Build (3 variants, remote version codes, Play App Signing), EAS Update on `staging` received by an installed build, EAS Submit to Play internal testing, EAS environment variables, CI. Android only. | [M7](evidence/m7-release.md), [M8](evidence/m8-portfolio.md) |
| 8 | Testing and quality | ✅ 190 tests (Jest, React Native Testing Library, Vitest + real Postgres), also passing from a fresh clone; accessibility and large text. 🟡 3 Maestro flows each pass alone but are flaky back to back on the dev build; list performance measured as a query (1.4 ms / 1,000 plants), scroll smoothness not measured on a device. | [M6](evidence/m6-quality.md), [M8](evidence/m8-portfolio.md) |
| 9 | Analytics and feature flags (PostHog) | ✅ Privacy-first events and the `paywall-variant` A/B flag, received from the Play build; opt-out in Settings. The A/B test has one tester, so it has no meaningful result. | [M8](evidence/m8-portfolio.md) |

Definition of done: a fresh clone installs, migrates, runs the development build on an Android
emulator and passes all tests ✅. An iOS simulator run wasn't possible (this Mac's Xcode 26.2 is
older than the 26.4 that Expo SDK 57 requires).

## What I can claim
- I built and **published a React Native (Expo) app on Google Play** (passed Google's review): EAS Build, Submit and Update, signing and Play App Signing, store listing and policy declarations.
- Google sign-in with server-side token verification, refresh-token rotation and account deletion.
- Offline-first sync with SQLite, an outbox and explicit conflict rules.
- Push notifications through Expo and FCM, with deep links, verified on a real Android phone.
- In-app subscriptions with RevenueCat, including a signed, idempotent webhook, tested with real Google Play test purchases.
- Product analytics and feature flags with PostHog, designed for privacy.
- Tests at three levels plus Maestro end-to-end flows, and CI with secret scanning.

## What I must NOT claim
- That the app is **on the App Store**. It's on Google Play only.
- **iOS** experience from this project: no TestFlight build, no Apple sign-in or push on a device.
- **User numbers or revenue** you don't have. Real purchases are possible now, but as of this report every purchase was a test purchase.
- A/B test **results**. The flag works; no experiment has run with real users.
- That I wrote it alone. It was built with AI assistance, and I can explain every part.
- Device-measured scroll performance, or a reliable CI run of the Maestro suite.

## Suggested profile wording (honest)
> React Native (Expo) developer. Most recently I built PlantPal end to end with an AI pair
> programmer: Google sign-in verified on a Next.js API, offline-first sync with SQLite, push
> notifications with deep links, RevenueCat subscriptions with a signed webhook, PostHog analytics,
> and EAS Build/Update/Submit, published on Google Play, with 190 automated tests.

## Upwork portfolio entry
**Title:** PlantPal: offline-first React Native app with sync, push and subscriptions

**Description** (363 / 600 characters):
> PlantPal is a React Native (Expo) app I built end to end to prove mobile skills: Google sign-in verified on a Next.js API, offline-first sync (SQLite + outbox, conflict rules), push notifications with deep links, RevenueCat subscriptions with a signed webhook, PostHog analytics and an A/B flag, EAS Build/Update/Submit and CI with 190 tests. Live on Google Play.

**Captions** (each under 140 characters):
1. Plant list that works offline; changes sync when the phone is back online.
2. Store build from Google Play: Google sign-in, sync, push and a test purchase on a real phone.
3. Paywall copy chosen by a PostHog feature flag (A/B test), purchases in Google Play test mode.
4. Architecture: Expo app, Next.js API on Vercel, Neon Postgres, RevenueCat, Expo push to FCM.

Screenshots: [`release/screenshots/`](release/screenshots/) (list, guide, detail) and
[`evidence/m8/paywall-plants-first.png`](evidence/m8/paywall-plants-first.png); diagram: the
Mermaid chart in the [README](../README.md#architecture).

**Skills:** React Native, Expo, TypeScript, Expo Router, SQLite, Offline-First, Next.js, PostgreSQL,
Drizzle ORM, OAuth / OpenID Connect, Push Notifications, Firebase Cloud Messaging, RevenueCat,
In-App Purchases, PostHog, EAS Build, CI/CD, GitHub Actions, Jest, React Native Testing Library,
Maestro, Vercel.

## samilabud.com card
> **PlantPal.** An offline-first plant care app in React Native (Expo) with a Next.js backend. Google
> sign-in, sync, push, subscriptions and analytics, live on Google Play.
> Built with AI assistance.
> *Links:* GitHub repo · [Privacy](https://plantpal-api.vercel.app/privacy) · case study (this report)

## The three things only I can do
1. **Apple:** get the developer account approved, then do the steps that need my Apple login: App ID, Sign in with Apple key, App Store Connect record, subscription products, TestFlight testers.
2. **Store decisions and clicks:** complete the Play store listing and policy forms, and say **"submit"** before anything goes to Google's or Apple's review.
3. **Real-device testing:** on my phones, for things a simulator can't prove (iOS push and Apple sign-in, scroll smoothness on a release build, purchases with my tester accounts).

## Loose ends
- **iOS:** the whole iOS half of M7 (build, TestFlight, Apple sign-in and push on a device, App Store screenshots); a local Xcode upgrade to 26.4 for simulator runs.
- **Security (owner's decision):** the Firebase service-account key `cc8cb68d13…` was once pasted in a chat and was kept by decision. Rotate it before real users. Also restrict the Firebase Android API key to the app ids and SHA-1s.
- **Google consent screen** is in Testing mode (only listed test users can sign in). Publish it before a public release, which may need a verified domain instead of `vercel.app`.
- **Play:** the store listing and policy forms aren't complete, so testers see "com.samilabud.plantpal (unreviewed)". No review submitted.
- **Quality:**
  - Maestro on a release-style build, or a hosted emulator, to remove the dev-client flakiness
  - scroll smoothness measured on a physical phone
  - R8 minification and a deobfuscation file (smaller app, readable crash reports)
- **Small product items:**
  - show the time, not just the date, when Premium ends within a day
  - rate limiting on the auth routes
  - the Settings screen is long
  - deleted photos stay in storage until account deletion (documented in the privacy policy)
- **Preview environment** on Vercel has no RevenueCat secret key (no preview deployment uses it yet).

## When a client asks
**"Have you shipped this to the App Store?"**
> "Not to the App Store yet: the iOS build is waiting on my Apple developer account. On Android,
> PlantPal is live on Google Play. I took it through Google's review myself: store listing, data
> safety, content rating, a reviewer account, and EAS builds submitted to the store."

**"Have you done this in production?"**
> "Yes, at small scale: PlantPal is live on Google Play against a production backend (Vercel and
> Neon). I verified sign-in, sync, push and the full subscription cycle there on a real phone. I
> won't claim large user numbers or revenue, but I can walk you through how each part was verified
> and monitored."
