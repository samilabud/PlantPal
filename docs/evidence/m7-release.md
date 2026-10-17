# M7: Release, evidence

Date: 2026-10-16. Release checklist (done / waiting on accounts / manual): [`docs/release/RELEASE_CHECKLIST.md`](../release/RELEASE_CHECKLIST.md).

## EAS Build (Android, preview profile)
| | |
|---|---|
| Build | `dd82c614-663a-47ce-8e95-82bb76f0d5b6` (EAS cloud, free plan) |
| Profile / channel | `preview` / `staging` |
| App id | `com.samilabud.plantpal.preview`, versionCode 1 (remote version source, EAS-managed keystore) |
| Runtime version (fingerprint) | `95f81eaecadcc6b76115edefac2394fe288c285f` |
| Commit | `87ff13b` |
| Result | FINISHED; universal APK installed on the Android emulator |

## EAS Update on the staging channel
| Attempt | Runtime version | Reached the build? |
|---|---|---|
| 1. update `01a14697…` | `c21872af…` | **No**, the runtime didn't match |
| 2. update `01a14699-9593-7a3a-b987-1e86bdd40f78` (group `7e2cd937…`) | `95f81eae…` | **Yes**, proven on the emulator (below) |

**What went wrong in attempt 1, and the fix:** `APP_VARIANT=preview` was set only in the `eas.json` build profile, which applies to builds but not to `eas update`. The update was therefore computed with the production config (another app id, name and scheme), so its fingerprint differed and no installed build would ever accept it. `eas fingerprint:compare` showed the exact difference (only the Expo app config: package, appVariant, name, scheme). Fix: `APP_VARIANT` is now an EAS environment variable for each environment, so builds and updates read the same value. Before publishing again, `eas fingerprint:compare --build-id … --environment preview` confirmed a match.

**On-device proof:** the same installed APK, with no reinstall:

| Launch | What the app says (sign-in footer) | Updates log |
|---|---|---|
| 1st | `v0.1.0 · staging · built-in bundle` | `NEW_UPDATE_LOADED`, update `01a14699…` downloaded in about 1.1 s, pending |
| 2nd | `v0.1.0 · staging · update 01a14699 (10/16/2026)` | running the update |

Screenshots: [before](m7/ota-1-built-in-bundle.png) · [after](m7/ota-2-after-update.png). This is the configured behavior (`checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`): startup never waits for the network, so an update runs on the launch after it downloads.

The preview build shows no sign-in button yet. That's expected: Google sign-in needs your OAuth clients, Apple sign-in is iOS only, and dev sign-in is off outside development.

This is the safety the fingerprint policy buys: a mismatched update is ignored rather than loaded into a binary it wasn't built for.

## Google sign-in (Android)
**Google Cloud project `plantpal-bd84c`:**
- consent screen: External, Testing, with test users
- one Web client: its id is the token audience the server checks
- four Android clients:
  - dev (debug key)
  - preview (EAS key)
  - Play signing (Google's app-signing key)
  - upload (EAS production key, cross-checked: Play's upload certificate SHA-1 equals the one read from the `.aab`)

**Where the Web client id lives:** Vercel `GOOGLE_CLIENT_IDS` (Production and Preview, production redeployed), EAS `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (all environments), local env files. It was checked against Google before use: Google recognizes it, and a fake id gets a different answer.

**Result:** in the dev build, against the local API, "Sign in with Google" → Google account → server verified the ID token → Settings shows the Gmail and "Signed in with: google". Also proven later on a Play-installed build against production (see the next section).

## Google Play internal testing: real phone, production server
**Build:** `388e7da5…`, versionCode 3, store profile. Checked before upload:
- upload certificate SHA-1 equals Play's
- `exp+plantpal` absent from the manifest
- RevenueCat Play key, Google web client id and production API URL present in the JS bundle

Rolled out to the internal testing track and installed from Google Play on the owner's Android phone.

| Check (store build, production API) | Result |
|---|---|
| Diagnostics | `https://plantpal-api.vercel.app · production`, "API ok · database ok", `v0.1.0 · production · built-in bundle` |
| Google sign-in | signed in with Google, account shows the Gmail and "Signed in with: google" |
| Sync and photo upload | plant with photo, "Synced", 0 pending |
| Remote push | "Server push: registered" (FCM in the store build) |
| Purchase (license tester) | Play receipt "Test card, always approves", monthly test plan renews every 5 min; app shows "Welcome to Premium"; server profile "Plan: premium" (server re-checked RevenueCat with the `sk_` key) |
| Renewals | 6 renewals (Google's documented test schedule), all in RevenueCat's customer history |
| Webhook to our server | every event in RevenueCat's webhook log shows **Sent** |
| Expiry | RevenueCat entitlement expired at 14:52:58 UTC; Google's "subscription has been canceled" email; the phone switched back to **Plan: free** on its own (the M6 expiry fix, now proven with a real store subscription) |

The server-side check used the secret key to read the subscriber (read-only); the app user id is our internal UUID. RevenueCat holds no email.

## Privacy, support and deletion pages (live)
| Page | URL | Check |
|---|---|---|
| Privacy policy | https://plantpal-api.vercel.app/privacy | 200, contact email shown |
| Support | https://plantpal-api.vercel.app/support | 200 |
| Account deletion (Google Play's web deletion requirement) | https://plantpal-api.vercel.app/delete-account | 200 |

The policy lists exactly what `apps/api/src/db/schema.ts` stores. "No location in photos" was verified in `expo-image-manipulator`'s native save code: `Bitmap.compress` (Android) and `UIImage.jpegData` (iOS) write pixels only.

**Account deletion now removes everything:**
- the user's rows (cascade) and photo files
- webhook log rows and pending push receipts
- the RevenueCat customer: `DELETE /v1/subscribers/{id}`, best effort, so an outage never blocks deletion

Integration-tested, including a "RevenueCat down" case.

**RevenueCat secret key:** an `sk_` key replaced the public `test_` key, in `.env.local` and on Vercel Production. Verified without printing it: a `DELETE` for a non-existent id answered 404 (authenticated), not 401.

## Store paperwork
- [`store-listing.md`](../release/store-listing.md): name, subtitle, short and full description, keywords (lengths checked by script), subscription disclosure, review notes
- [`data-safety.md`](../release/data-safety.md): Google Play Data safety and App Store App Privacy answers, derived from the schema and the SDKs
- [`screenshots/`](../release/screenshots/): 3 Google Play phone screenshots (9:16, no alpha, clean demo status bar)

## Release-readiness fixes
- `google-services.json` now lists all three Android apps. The config applies it only to app ids the file contains, so a variant missing from Firebase still builds.
- Store builds read the per-platform RevenueCat keys from EAS environment variables.
- iOS export compliance: `usesNonExemptEncryption: false`.
- The version, channel and update id are shown on sign-in and in Settings (unit-tested).

## Not done (needs accounts or decisions; see the checklist)
- iOS build and TestFlight (waiting for Apple)
- real Apple and Google sign-in
- store products in RevenueCat
- App Store screenshots
- the FCM key stays unrotated by the owner's decision (accepted risk)

## Docs used
- Expo: [EAS Update getting started](https://docs.expo.dev/eas-update/getting-started/), [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [expo-updates v57 API](https://docs.expo.dev/versions/v57.0.0/sdk/updates/), [submit to Google Play](https://docs.expo.dev/submit/android/), [image manipulator v57](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/), [pricing](https://expo.dev/pricing)
- RevenueCat: [API keys and authentication](https://www.revenuecat.com/docs/projects/authentication), [customers API v1](https://www.revenuecat.com/docs/api-v1/customers), [Apple App Privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- Google Play Console Help: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- Apple: [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Next.js 16 bundled docs (`node_modules/next/dist/docs`): layouts and pages, metadata
