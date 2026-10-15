# PlantPal: M0 plan

Status: **approved 2026-10-15** (go). Decisions: PlantPal, Neon, Apple Developer account available (both stores), Play account can take a second app, eas-cli now + Maestro at M6.
Date: 2026-10-15

## 0. Environment check (done on this Mac)

| Tool | Found | Needed | Action |
|---|---|---|---|
| Node | 24.14.0 | ≥ 22.13 (Expo SDK 57) | OK |
| pnpm | 10.32.1 | any recent | OK |
| git | 2.50.1 | any | OK (folder is not a repo yet; `git init` at M1) |
| Xcode | **26.2** | **≥ 26.4** (Expo SDK 57) | **Update Xcode** (free) before local iOS builds, or use EAS cloud builds |
| iOS simulator | iOS 26.2, 18.2 | — | OK after the Xcode update |
| Android SDK, adb, JDK 17 | present | — | OK |
| eas-cli | missing | for builds, submit and update | `npm i -g eas-cli` at M1 |
| Maestro | missing | for E2E (M6) | install at M6 |
| gh | 2.67.0 | only for CI later | OK |

Docs used: [Expo SDK reference (latest = 57.0.0)](https://docs.expo.dev/versions/latest/), [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57).

## 1. The idea

**Keep PlantPal.** The domain is small, so every hour goes into the engineering. It also covers all nine gaps naturally: plants are data you need offline, watering is a timed thing that suits notifications, photos use the camera, and "unlimited plants plus photo history" makes an honest premium plan. Another idea (a habit tracker, a medication reminder) would add no new skills. A medication app would also bring health-data rules, so I don't recommend it.

## 2. Stack (with reasons for each choice)

| Area | Choice | Why |
|---|---|---|
| Repo | **pnpm workspaces monorepo**: `apps/mobile`, `apps/api`, `packages/shared` | Zod schemas for the sync and API contract are written once and used by both sides, so the app and the server can't drift apart. |
| Mobile | Expo SDK 57, **development build**, TypeScript strict, Expo Router | As requested. A dev build is required anyway: Sign in with Google, RevenueCat and push notifications don't run in Expo Go. |
| Server state | React Query | Handles caching, retries and refetching for `/me` and other server-only reads. |
| UI state | **Zustand** (not Context) | Sync status, auth status and the paywall flag are read *outside* React (by the sync engine and the API client). Zustand allows `store.getState()` there; Context does not. It's also easy to reset in tests. |
| Local DB | expo-sqlite (the local source of truth) + **Drizzle** (`drizzle-orm/expo-sqlite`) | The same ORM on the phone and the server means one mental model and typed queries. The exact Drizzle and Expo integration gets checked against the docs at M3. |
| Validation | Zod (in `packages/shared`) | Every request and response is validated on both ends. |
| Backend | Next.js App Router route handlers on Vercel | As requested. Hobby plan is free. |
| Postgres | **Neon** (not Supabase) | We only need Postgres. Supabase also brings auth and storage that would duplicate what we build ourselves, and building auth ourselves is the skill being shown. Neon has a free tier, database branches per environment, and a Vercel integration. |
| Server ORM | Drizzle + drizzle-kit migrations | SQL-like, light, and the same tool as on the phone. |
| Photo storage | **Vercel Blob** (client-upload tokens) | Free tier, no extra account. The phone uploads straight to Blob with a short-lived token from our API, so the server never streams the file. |
| Auth | Native Sign in with Apple (`expo-apple-authentication`) and Google (`@react-native-google-signin/google-signin`). The server verifies the ID token against Apple and Google JWKS (`jose`), then issues **its own** 15-minute access JWT and a 30-day **rotating** refresh token (stored hashed, with reuse detection). | Shows the full OIDC flow and real session handling, without lock-in to a hosted auth vendor. |
| Token storage | expo-secure-store (Keychain / Keystore) | Never AsyncStorage for tokens. |
| Push | expo-notifications + Expo Push Service. FCM (Android) and APNs (iOS) sit underneath; this gets explained at M4. | As requested. |
| Payments | RevenueCat (`react-native-purchases`) sandbox + webhook | Note: RevenueCat webhooks are authenticated with a **shared Authorization header** you set in the dashboard, not an HMAC signature. We'll compare that header in constant time, make processing idempotent by event `id`, and re-fetch the subscriber from the RevenueCat API before trusting the event. To be confirmed against the docs at M5. |
| Analytics and flags | PostHog (`posthog-react-native`), autocapture off, no personal data in events | One real flag: `paywall-variant` (A/B test of the paywall copy), plus events such as `plant_added`, `plant_watered`, `sync_completed`, `paywall_viewed`, `purchase_completed`. |
| Tests | Jest (`jest-expo`), React Native Testing Library, Maestro (3 flows), Vitest for the API | |
| CI | GitHub Actions: lint, typecheck, test (mobile + API) on every push. A manual `workflow_dispatch` job for the EAS build. | |

### One honest catch for testing
Maestro **cannot drive the real Apple or Google sign-in sheets** reliably. So I'll add a `POST /api/auth/dev` endpoint and a "Dev sign-in" button. **Both are compiled out of production builds and the server refuses them in production.** The Maestro flows use them. Real Apple and Google sign-in is proven by a manual test checklist and a screen recording instead. That's the normal way to do it, and it's worth saying in an interview.

## 3. Data model

### Server (Postgres)
```
users            id uuid pk, email null, apple_sub unique null, google_sub unique null,
                 plan enum('free','premium'), plan_expires_at null, created_at
refresh_tokens   id, user_id fk, token_hash, family_id, expires_at, revoked_at null, replaced_by null
plants           id uuid pk (generated on the phone), user_id fk, name, watering_interval_days,
                 last_watered_at, photo_url null, client_updated_at, server_version bigint,
                 deleted_at null (tombstone)
watering_events  id uuid pk, plant_id fk, user_id fk, watered_at, client_updated_at,
                 server_version, deleted_at null
plant_photos     id uuid pk, plant_id fk, user_id fk, url, taken_at, server_version, deleted_at null   (premium)
devices          id, user_id fk, expo_push_token unique, platform, last_seen_at
webhook_events   id (RevenueCat event id) pk, type, received_at, processed_at    (idempotency)
```
`server_version` comes from one global Postgres sequence. Every write gets the next number, so "give me everything after version N" is one indexed query.

Account deletion = hard-delete the user row (cascades to everything), delete the Blob photos, and revoke the tokens.

### Phone (SQLite)
The same `plants`, `watering_events` and `plant_photos` tables, plus:
```
outbox       id, entity, entity_id, op('upsert'|'delete'), payload json, created_at, attempts
sync_state   key, value         (last_server_version cursor, last_sync_at)
```

### Sync and conflict rule
1. Every local write goes to the table **and** to the outbox in one SQLite transaction. The UI reads only from SQLite, so it works offline.
2. `POST /api/sync { cursor, changes[] }`: the server applies each change only if `client_updated_at` is newer than the stored one (**last write wins**). It returns the rows changed since `cursor`, the new cursor, and any rejected changes.
3. Deletes are tombstones (`deleted_at`), so a delete also syncs.
4. Trade-off to teach at M3: last write wins is simple and good enough for a single user on a few devices. It can lose an edit when two devices change the same plant offline, and it trusts the phone clocks. The alternatives are per-field merging and CRDTs.

## 4. API list

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Liveness + DB check (M1) |
| `POST /api/auth/apple` · `POST /api/auth/google` | Verify the ID token, upsert the user, return access + refresh tokens (M2) |
| `POST /api/auth/refresh` | Rotate the refresh token; reuse of an old one revokes the whole family (M2) |
| `POST /api/auth/logout` | Revoke the refresh token and remove the device's push token (M2) |
| `POST /api/auth/dev` | **Non-production only**, for Maestro (M2) |
| `GET /api/me` · `DELETE /api/me` | Profile + plan; account deletion (M2) |
| `POST /api/sync` | Push the outbox, pull changes (M3) |
| `POST /api/uploads/photo` | Issue a Vercel Blob client-upload token (M3) |
| `POST /api/devices` · `DELETE /api/devices/:id` | Register / remove an Expo push token (M4) |
| `GET /api/cron/reminders` | Vercel Cron (daily on Hobby), protected by `CRON_SECRET`; sends "plants due today" pushes (M4) |
| `POST /api/push/test` | Manual push trigger (dev only) (M4) |
| `POST /api/webhooks/revenuecat` | Auth header check, idempotent, updates `users.plan` (M5) |
| Pages `/privacy`, `/support`, `/delete-account` | Required by the stores (M7) |

Reminders: **local** scheduled notifications per plant (these work offline, on this device) **plus** a **remote** daily push from the cron (this proves the server-to-device path). Tapping either opens `plantpal://plants/<id>`.

## 5. Folder structure
```
plantpal/
  apps/
    mobile/                 Expo app
      app/                  Expo Router routes: (auth)/sign-in, (app)/index, plants/[id], plants/new, paywall, settings
      src/
        api/                typed API client (fetch + Zod + auto refresh)
        auth/               Apple/Google sign-in, secure token store
        db/                 SQLite schema, migrations, repositories
        sync/               outbox, sync engine, network listener
        notifications/      permissions, scheduling, deep-link handler
        purchases/          RevenueCat wrapper, entitlement hook
        analytics/          PostHog wrapper + flags
        stores/             Zustand stores
        ui/                 theme + small components
      e2e/                  Maestro flows (YAML)
      app.config.ts  eas.json
    api/                    Next.js app
      app/api/...           route handlers (list above)
      app/(pages)/privacy, support, delete-account
      src/db/               Drizzle schema + migrations
      src/auth/             JWKS verification, JWT, refresh rotation
      src/services/         sync, push, revenuecat
  packages/
    shared/                 Zod schemas + TS types for the API and sync contract
  docs/
    M0_PLAN.md  evidence/   INTERVIEW_NOTES.md  FINAL_REPORT.md
  .github/workflows/ci.yml
  .env.example (per app)    .gitignore
```

## 6. Cost table

| Item | Cost | Needed for | Notes |
|---|---|---|---|
| Expo account + EAS (Free plan) | Free | Builds, Update, Submit | The free tier has a monthly build quota and a slower queue. Enough for this project. |
| Vercel Hobby | Free | API + pages + cron + Blob | Cron is limited to once a day on Hobby. Fine for us. |
| Neon Free | Free | Postgres | |
| RevenueCat | Free | Subscriptions | Free below the revenue threshold. Sandbox only. |
| PostHog Cloud | Free | Analytics + flags | Generous free monthly event quota. |
| Google Cloud (OAuth client IDs) | Free | Google sign-in | |
| GitHub Actions | Free | CI | Free minutes for personal repos. |
| Xcode update | Free | Local iOS builds | |
| **Google Play Console** | **~25 USD once** | Play internal testing, **Android sandbox purchases** | **You likely already paid this for Animal Adventures.** We would add a new app to the same account. |
| **Apple Developer Program** | **~99 USD/year** | TestFlight, App Store, **iOS push (APNs)**, **Sign in with Apple on a device**, iOS sandbox purchases | Without it, the iOS parts of gaps 1, 2, 3 and 6 **can't be proven**. Android and the simulator still cover most of the engineering. |
| Apple Mac / iPhone | Already owned (assumed) | Real-device tests | Push doesn't work on the iOS simulator in a way that proves APNs; use a real iPhone. |

Recommendation: build M1–M6 for free, using Android first plus the iOS simulator. Decide on Apple's 99 USD before M7 (or before M2 if you want to test Sign in with Apple on a real iPhone early).

Policy to re-check at M7: new *personal* Google Play accounts have to run a closed test with a minimum number of testers for a set period before going to **production**. Internal testing is not affected. Your account is older, so this may not apply. We'll verify then.

## 7. Safety and honesty (built in from M1)
- `.env*` files git-ignored, an `.env.example` per app, EAS secrets / Vercel env vars for real values, and a `gitleaks` check in CI.
- No real personal data in tests or fixtures. The app is not aimed at children: no ads, PostHog without personal data, and an analytics opt-out in Settings.
- The README states it was built with Claude Code assistance, sandbox-only subscriptions, and no production users or revenue.

## 8. Decisions I need from you
1. **Go / no-go on PlantPal** (my recommendation: go).
2. **Neon** (recommended) or Supabase?
3. **Apple Developer Program**: pay now, decide at M7, or Android-only for the store parts?
4. **Google Play**: can you confirm the Animal Adventures account is usable for a second app?
5. OK to install `eas-cli` globally now and Maestro at M6? Will you update Xcode to ≥ 26.4?
