# Privacy answers for the stores

Google Play "Data safety" and App Store "App Privacy" answers, derived from what the code actually
stores (`apps/api/src/db/schema.ts`) and from the SDKs in the app. The public policy at
`/privacy` (apps/api/src/app/privacy/page.tsx) says the same thing in plain words; change all three
together.

**SDKs that send data off the phone:** our own API, Expo push token registration, RevenueCat
(purchases), Apple / Google sign-in, PostHog (optional usage analytics: a fixed event list, no
autocapture, no session replay, opt-out in Settings). No crash-reporting or ad SDKs.

## Google Play: Data safety

| Question | Answer |
|---|---|
| Does the app collect or share any of the required user data types? | Yes |
| Is all user data encrypted in transit? | Yes (HTTPS only: Vercel, Expo, RevenueCat, Google) |
| Can users request that their data be deleted? | Yes: in the app (Settings > Delete account) and on the web (`/delete-account`) |
| Is any data shared with third parties? | No. Vercel, Neon, Expo, RevenueCat and PostHog act as service providers on our behalf, which Google says is not "sharing" |

| Data type | Collected | Optional? | Purpose | Notes |
|---|---|---|---|---|
| Personal info > Email address | Yes | Optional (Apple lets users hide it) | Account management | From Apple/Google at sign-in |
| Personal info > User IDs | Yes | Required | App functionality, Account management | Our account id; the Apple/Google subject id |
| Photos and videos > Photos | Yes | Optional | App functionality | Plant photos the user adds; no metadata |
| App activity > Other user-generated content | Yes | Required | App functionality | Plant names, watering intervals, watering times |
| Financial info > Purchase history | Yes | Optional (only if they buy) | App functionality | Plan and expiry; RevenueCat checks the store |
| Device or other IDs | Yes | Optional (only with reminders on) | App functionality | Expo push token |
| App activity > App interactions | Yes | Optional (opt-out in Settings) | Analytics | Fixed PostHog events (plant added/watered, photo added, reminders on, paywall viewed, purchase completed), linked to the random account id |

Not collected: location, name, contacts, messages, health, files, calendar, web history, crash logs, diagnostics, advertising ID. (PostHog adds the app version and phone model to events; that is part of the App interactions entry, not diagnostics.)

## App Store: App Privacy

**Tracking:** No. Nothing is linked with third-party data for advertising, and there is no ad SDK.

| Data type | Linked to the user | Used for tracking | Purposes |
|---|---|---|---|
| Contact Info > Email Address | Yes | No | App Functionality |
| User Content > Photos or Videos | Yes | No | App Functionality |
| User Content > Other User Content | Yes | No | App Functionality |
| Identifiers > User ID | Yes | No | App Functionality |
| Identifiers > Device ID | Yes | No | App Functionality (push token) |
| Purchases > Purchase History | Yes | No | App Functionality, Analytics (RevenueCat's own guidance says to select both) |
| Usage Data > Product Interaction | Yes | No | Analytics (PostHog events; optional, opt-out in Settings) |

Not collected: Diagnostics (RevenueCat states it doesn't collect them; we ship no crash reporter), Location, Health, Financial Info, Contacts, Browsing/Search History, Sensitive Info.

**Push token classification:** neither store's page names push tokens. They are declared as a device-level identifier (the closest definition on both pages) to err on the side of disclosure.

## Other declarations
| | Answer |
|---|---|
| Google Play: Ads | No ads |
| Google Play: Target audience | 18+ (not designed for children; avoids the Families policy) |
| Google Play: Content rating questionnaire | No violence, no user-to-user communication, no sharing of location, digital purchases: yes |
| Google Play: Government app / financial features / health | No |
| App Store: Age rating | 4+ (no objectionable content) |
| App Store: Export compliance | Uses only standard HTTPS encryption: exempt (`ITSAppUsesNonExemptEncryption = false`) |
| App Store: Sign in with Apple | Offered next to Google sign-in (guideline 4.8) |
| Account deletion | In app (both stores require it), plus Apple token revocation |

## Sources
- Google Play Console Help, "Provide information for Google Play's Data safety section" (support.google.com/googleplay/android-developer/answer/10787469)
- Apple, "App privacy details on the App Store" (developer.apple.com/app-store/app-privacy-details)
- RevenueCat, "Apple App Privacy" (revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
