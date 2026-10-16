# Release checklist

Status as of 2026-10-16. ✅ done and verified · 🟡 done in code, waiting on an account step ·
⬜ not done. "Owner" says who can do it: **me** (code, docs, commands in this repo) or **you**
(store accounts, consoles, payments, review clicks).

## 1. Security before any build leaves this machine
| | Step | Owner |
|---|---|---|
| ⚠️ | FCM service-account key `cc8cb68d13…` was pasted in a chat. **Owner's decision (2026-10-16): keep it** for this portfolio app. Accepted risk: anyone with it could send push notifications to PlantPal users. Rotate before real users (Google Cloud > IAM > Service accounts > Keys, then `npx eas-cli@latest credentials`) | you |
| ⬜ | Restrict the Firebase Android API key to the app ids and SHA-1s (Google Cloud > Credentials) | you |
| ⬜ | Swap `REVENUECAT_SECRET_KEY` on Vercel (Production and Preview) from the public `test_` key to a secret `sk_` key. Account deletion and the webhook re-check need it | you |
| ✅ | `CONTACT_EMAIL` set on Vercel (Production); the pages show it after the next deploy | you |
| ✅ | No secrets in the repo: gitleaks scans the full history on every push | me |

## 2. Accounts and console setup
| | Step | Owner |
|---|---|---|
| ✅ | Firebase: preview and production Android apps registered; `google-services.json` now lists all three (verified: project plantpal-bd84c, dev entry unchanged) | you |
| ⬜ | Apple Developer: App IDs for `com.samilabud.plantpal(.preview)` with Sign in with Apple; add them to `APPLE_CLIENT_IDS` on Vercel; create the Sign in with Apple key (.p8) for token revocation on account deletion | you |
| ⬜ | Google Cloud: OAuth clients (Web, Android with the EAS signing SHA-1, iOS); set `EXPO_PUBLIC_GOOGLE_*` on EAS and the web client id on Vercel. Without it, Android store builds have no way to sign in | you |
| ⬜ | App Store Connect: create the app record (bundle id `com.samilabud.plantpal`), the subscription group (monthly, yearly) and the lifetime non-consumable; In-App Purchase key for RevenueCat | you |
| ⬜ | Play Console: create the app, the subscriptions and the lifetime product; service account JSON for RevenueCat | you |
| ⬜ | RevenueCat: add the App Store and Play apps, attach the store products to the `premium` entitlement and the `default` offering; put the `appl_…` / `goog_…` SDK keys on EAS as `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `_GOOGLE_KEY` | you |
| ⬜ | Play Console: answer Data safety, content rating, target audience, ads from `docs/release/data-safety.md` | you |
| ⬜ | App Store Connect: App Privacy answers, age rating, privacy URL, support URL from `docs/release/` | you |

## 3. Builds and updates
| | Step | Owner |
|---|---|---|
| ✅ | EAS Update configured: fingerprint runtime, `staging` channel for preview builds, `production` for store builds (`docs/evidence/m7-release.md`) | me |
| ✅ | Version / channel / update id visible on sign-in and in Settings | me |
| ✅ | Preview and store variants build without Firebase registration (config verified per variant) | me |
| ⬜ | `eas build --profile preview --platform android` (APK, staging channel). Free plan build credit, no charge | me, after your OK |
| ⬜ | `eas update --channel staging --environment preview`, then prove the APK picks it up (the version line changes) | me, after your OK |
| ⬜ | iOS build: a simulator build needs no Apple credentials; a TestFlight build needs `eas credentials` with your Apple login (interactive) | you + me |
| ⬜ | Production builds: `eas build --profile production --platform all` | me, after your OK |
| ⬜ | Google Play internal testing: create the app in Play Console and a service account key (uploaded to EAS); then `eas submit --platform android` creates the first internal-testing release. The app stays a draft until the listing and policy forms are complete (docs.expo.dev/submit/android) | you + me |
| ⬜ | TestFlight internal testing: `eas submit --platform ios` uploads; internal testers need no review | you + me |
| ⬜ | Store review submission: **only after you say "submit"** | you |

## 4. Store listing
| | Step | Owner |
|---|---|---|
| ✅ | Listing text, keywords, categories, subscription disclosure (`store-listing.md`) | me |
| ✅ | Privacy policy, support and web account-deletion pages (served by the API; live after the M7 push) | me |
| 🟡 | Google Play screenshots from the Android emulator (`docs/release/screenshots/`) | me |
| ⬜ | App Store screenshots (6.9" iPhone): needs an iOS build running on a simulator | me, after the iOS build |
| ⬜ | Feature graphic for Google Play (1024 × 500) | me |

## 5. What stays manual (and why)
- **Store accounts, payments, agreements, tax forms:** only the account holder can accept them.
- **Play Console app creation and policy forms:** only the account holder can complete them.
- **Real purchases on a device:** sandbox testers (Apple) and license testers (Google) must be your accounts.
- **Physical-phone checks:** scroll smoothness on a release build, and real push on iOS (needs a device).
- **Review submission:** your explicit "submit".
