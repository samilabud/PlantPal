# Privacy answers for the stores

Google Play "Data safety" and App Store "App Privacy" answers, derived from what the code actually
stores (`apps/api/src/db/schema.ts`) and from the SDKs in the app. The public policy at
`/privacy` (apps/api/src/app/privacy/page.tsx) says the same thing in plain words; change all three
together.

**SDKs that send data off the phone:** our own API, Expo push token registration, RevenueCat
(purchases), Apple / Google sign-in, PostHog (optional usage analytics: a fixed event list, no
autocapture, no session replay, opt-out in Settings). No crash-reporting or ad SDKs.

**Identify with AI (M9):** the app sends a photo to our API only when the user taps "Identify with
AI"; the API forwards it to Anthropic (Claude) and stores neither the photo nor the answer.
Anthropic is a **service provider** processing it on our behalf (it deletes API inputs and outputs
within 30 days and may not train on them: privacy policy, "Identify with AI"). We store one row per
identification (time, model, result type, tokens, cost) for the daily limits, and a report's
content when a user reports a suggestion.

## Google Play: Data safety

| Question | Answer |
|---|---|
| Does the app collect or share any of the required user data types? | Yes |
| Is all user data encrypted in transit? | Yes (HTTPS only: Vercel, Expo, RevenueCat, Google) |
| Can users request that their data be deleted? | Yes: in the app (Settings > Delete account) and on the web (`/delete-account`) |
| Is any data shared with third parties? | No. Vercel, Neon, Expo, RevenueCat, PostHog and Anthropic act as service providers on our behalf, which Google says is not "sharing" ("Transferring user data to a 'service provider' that processes it on behalf of the developer") |

| Data type | Collected | Optional? | Purpose | Notes |
|---|---|---|---|---|
| Personal info > Email address | Yes | Optional (Apple lets users hide it) | Account management | From Apple/Google at sign-in |
| Personal info > User IDs | Yes | Required | App functionality, Account management | Our account id; the Apple/Google subject id |
| Photos and videos > Photos | Yes | Optional | App functionality | Plant photos the user adds; no metadata. **M9:** also sent to Anthropic (service provider) for "Identify with AI", only when tapped; not stored by us |
| App activity > Other user-generated content | Yes | Required | App functionality | Plant names, watering intervals, watering times. **M9:** reports of AI suggestions (reason, optional note) |
| Financial info > Purchase history | Yes | Optional (only if they buy) | App functionality | Plan and expiry; RevenueCat checks the store |
| Device or other IDs | Yes | Optional (only with reminders on) | App functionality | Expo push token |
| App activity > App interactions | Yes | Optional | Analytics, **App functionality (M9)** | Fixed PostHog events (plant added/watered, photo added, reminders on, paywall viewed, purchase completed), linked to the random account id, opt-out in Settings. **M9:** a record of each "Identify with AI" use (time, result type, cost) to enforce the daily limits |

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
| Usage Data > Product Interaction | Yes | No | Analytics (PostHog events; optional, opt-out in Settings), App Functionality (M9: AI identification records for the limits) |

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

## M9 changes to make in Play Console (2026-10-20)
Data safety > edit, then:
1. **App activity > App interactions:** add the purpose **App functionality** (AI identification
   records enforce the daily limits). It was Analytics only.
2. **Photos:** no change (already collected, optional, App functionality). Anthropic is a service
   provider, so nothing becomes "shared".
3. **Other user-generated content:** no change (reports of AI suggestions fit the existing entry).
4. The app's language stored with the push token is a device setting, not one of Play's data types.

Store listing assets: Play asks per image whether it is AI-generated ("Regulations require that
AI-generated content be labeled under certain circumstances"). The screenshots are real captures
of the app; one shows an AI suggestion inside the app. Your call whether to tick it for that one
([Play Console Help](https://support.google.com/googleplay/android-developer/answer/17262077)).
