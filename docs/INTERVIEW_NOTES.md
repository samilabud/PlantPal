# Interview notes

Short points I can say out loud about PlantPal, each backed by code in this repo and evidence in
[`docs/evidence/`](evidence/). Four sections of 15 points, then a table of terms.

## 1. Authentication

1. **The flow:** the native Apple or Google sheet returns an **ID token** (a signed JWT) to the app. The app sends it to our API, and the API verifies it before creating a session. The app never decides who the user is.
2. **What the server checks:** the signature against the provider's public keys (JWKS, via `jose`), the issuer, the audience (our own client ids) and the expiry.
3. **Apple nonce:** the app makes a random nonce and gives Apple only its SHA-256 hash. Apple puts that hash in the token, and the server hashes the raw nonce again and compares. A stolen token can't be replayed with a different nonce.
4. **Google audience:** the ID token's audience is our **Web** client id; that's what the server checks. The Android clients only tell Google "this package + signing key is allowed". There are four: dev, preview, Play signing and upload.
5. **Our own session:** the server issues its own 15-minute access token (HS256 JWT) and a 30-day refresh token. We never call Google or Apple APIs with their tokens.
6. **Refresh rotation:** every refresh returns a new refresh token and revokes the old one. Reusing a revoked token revokes the whole token family, which is how theft gets detected. Refresh tokens are stored only as SHA-256 hashes.
7. **On the phone:** the refresh token lives in SecureStore (Keychain / Keystore); the access token only in memory. Parallel 401s share a single refresh ("single flight").
8. **One user, many providers:** the `auth_identities(provider, subject)` table links logins to a user. Email is optional, because Apple can hide it and only sends it on the first sign-in.
9. **Route protection:** Expo Router's `Stack.Protected` swaps the screen set when the auth state changes, so a signed-out user can't navigate back into the app.
10. **Logout** revokes the refresh token on the server, then on the phone:
    - wipes the local SQLite copy
    - cancels local reminders
    - unregisters the push token
    - logs out of RevenueCat
    - resets analytics
11. **Account deletion** (App Store guideline 5.1.1(v), Google Play's web requirement):
    - in the app, plus a web page for Play
    - deletes rows by cascade, photo files, webhook log rows, pending push receipts and the RevenueCat customer
    - revokes the Apple grant when the Apple key is configured
12. **Test sign-in** exists for Maestro only. The server refuses it in production: an environment flag, plus a check of `VERCEL_ENV`.
13. **Shared contract:** Zod schemas in `packages/shared` validate requests and responses on both sides. A malformed body is a 400 with a shared error shape, not a 500.
14. **Tested:**
    - a wrong nonce is rejected
    - signing in twice reuses the user
    - a deleted user's still-valid access token gets a 401
    - deletion succeeds even when RevenueCat is down
15. **Proven:** Google sign-in on the dev build, and on the store build installed from Google Play against production. Apple sign-in is implemented but **not yet proven** on a device (Apple account pending).

## 2. Offline-first sync

1. **SQLite is the source of truth on the phone.** Screens read only the local database (`useLiveQuery`). The network never blocks the UI.
2. **The outbox:** every write saves the row and an outbox entry in the **same exclusive transaction**, so a change can't exist without its pending sync.
3. **Coalescing:** several edits to one row collapse into the latest one, so typing three edits sends one change.
4. **One endpoint:** `/api/sync` pushes the outbox and pulls everything newer than the client's cursor in a single request.
5. **Cursor:** each server row gets a version from one global sequence. The client stores the last version it saw. Pulls are paged at 500.
6. **Concurrency:** a per-user Postgres advisory lock serializes syncs from the same user's devices.
7. **Conflict rule: last write wins** on the client's `clientUpdatedAt`, clamped to at most 60 s in the future so a wrong clock can't win forever. If a client's change loses, the server returns the winning row so the client corrects itself.
8. **The trade-off:** LWW can silently drop an older offline edit from another device. That's acceptable for a plant's name or interval. **Waterings are append-only events**, so the important data never conflicts.
9. **Deletes are tombstones** (`deletedAt`), so other devices learn about them. Deleting a plant cascades to its waterings and photos.
10. **IDs are client-made UUIDs**, so a plant can be created offline without asking the server for an id.
11. **When it syncs:** debounced 1.5 s, single flight (one more run if something changed meanwhile), triggered on start, when the network returns (NetInfo) and when the app comes to the foreground.
12. **Photos** are resized to 1280 px JPEG at quality 0.7 on the phone. The re-encode drops EXIF, so there's no location. The file uploads to private Vercel Blob through a signed URL first, then the row syncs, so a synced row never points to a missing file.
13. **Plan limits are enforced on the server during sync** (free: 3 plants, 1 photo each). Refused items come back with a reason, and the app shows an honest notice with Upgrade.
14. **Local schema migrations** use SQLite's `PRAGMA user_version`. Server migrations use Drizzle and run in the production build on Vercel.
15. **Proven:**
    - a two-phone script against the real API
    - a Maestro flow: airplane mode → "Offline · 1 to sync" → online → "Synced" → wipe the app → the plant comes back from the server
    - the list query measured at 1.4 ms for 1,000 plants with the right index, against 1,177 ms without it

## 3. Notifications and deep links

1. **Two kinds:**
   - **local** reminders, scheduled on the phone from SQLite data
   - **remote** push sent by the server
2. **Local reminders** fire at 9:00 on the day a plant is due. They're rebuilt from the data after every change (cancel all, schedule again) and capped at 60, because iOS keeps at most 64 pending.
3. **Permission UX:** a soft ask in context (after adding a plant) comes before the system prompt. Settings shows the state and links to system settings if it was denied.
4. **Android 13+** needs the runtime `POST_NOTIFICATIONS` permission. Reminders use their own `reminders` channel.
5. **Remote setup:** the phone gets an **Expo push token** for our EAS project and registers it with the API (`devices` table, one user per token).
6. **Underneath:** Expo's push service forwards to **FCM** on Android (our Firebase project, with its FCM V1 key stored on EAS) and to **APNs** on iOS (an Apple push key stored on EAS).
7. **Sending:** the server sends in batches of 100. Expo answers with **tickets** right away; delivery is confirmed later through **receipts**. `DeviceNotRegistered` deletes the stale token.
8. **Daily cron:** a Vercel cron job calls a route protected by a `CRON_SECRET` bearer token to send overdue nudges.
9. **Deep link payload:** each notification carries `data.url`, validated with Zod. Tapping it navigates there.
10. **Cold and warm start:** on launch the app reads the last notification response (cold start); while it runs, a listener handles taps (warm start).
11. **Expo Router makes deep links free:** routes are files, so `/plants/[id]` is already a URL. Each build variant has its own scheme (`plantpal-dev`, `plantpal-preview`, `plantpal`), so the variants can sit side by side.
12. **Sign-out** unregisters the token and cancels local reminders, so the next person on the phone gets nobody else's reminders.
13. **Foreground:** a notification handler shows the banner even while the app is open.
14. **A fix found in M7:** the dev-tools link (`exp+plantpal://`) had leaked into store builds through the dev-client plugin. It's now limited to the development build, verified in the store bundle's manifest.
15. **Proven:**
    - local reminders and deep links on the emulator
    - a real remote push to the dev build
    - token registration on the store build (delivery to it needed the FCM key on the production app id, which was missing at first)
    - iOS push not yet proven

## 4. Subscriptions and release engineering

1. **Store billing, not Stripe:** digital goods must use in-app purchase. RevenueCat wraps StoreKit and Google Play Billing.
2. **Catalog:** one entitlement, `premium`. The `default` offering has Monthly, Annual and Lifetime packages, each with a Test Store product and a Play product (lifetime is non-consumable).
3. **Identity:** the SDK is logged in with **our** user id, so webhooks carry an id the server knows, and RevenueCat never gets the email.
4. **The server is the source of truth.** The webhook checks the Authorization header (and an HMAC signature when configured) with constant-time comparison, and fails closed.
5. **Idempotent:** events are recorded in `webhook_events` by id. A replay is acknowledged and ignored, and the replay is tested.
6. **Order-independent:** after any event, the server re-reads the customer from RevenueCat. So a late `EXPIRATION` can't downgrade someone who already renewed (tested).
7. **Expiry-aware client:** a cached "active" isn't trusted past its expiry date. That bug was found on a real phone in M6 and fixed with a timeline test.
8. **Proven in Play's sandbox:** a license-tester purchase, 6 accelerated renewals (every 5 minutes), every webhook delivered, then automatic expiry back to Free on the phone. Test card, no charge.
9. **Three variants from one codebase** (`APP_VARIANT`): dev, preview and production, with their own app ids, names and schemes, installable side by side.
10. **EAS Build:**
    - remote `versionCode` with auto-increment
    - EAS-managed keystores
    - **Play App Signing**: we sign with an upload key, and Google re-signs with the app signing key, so Google sign-in needs both SHA-1 fingerprints
11. **EAS Update:**
    - channels `staging` (preview builds) and `production`
    - runtime version from a **fingerprint** of the native project, so an update can never reach a build whose native code differs
    - proven: the same installed APK went from "built-in bundle" to "update 01a14699"
12. **The lesson from that proof:** `eas update` ignores `env` in `eas.json` build profiles. Our first update was built with the production config and matched no build. Variables now live in EAS environments, shared by builds and updates.
13. **Config and secrets:** `EXPO_PUBLIC_*` values are inlined into the app, so they're public by design (client ids, `goog_` and `phc_` keys). Secrets (`sk_` key, JWT secret, service accounts) live only on Vercel or EAS, never in the repo; gitleaks scans the full history in CI.
14. **CI** (GitHub Actions):
    - secret scan
    - lint and typecheck
    - 185 tests with coverage, a Markdown report in the job summary, raw reports as an artifact
    - a manual "EAS Build" workflow
15. **Before every upload, I checked the `.aab` itself:** the upload certificate SHA-1 against Play's, the manifest's URL schemes, and that the right public config is baked in. A fresh clone of the repo is installed and tested from scratch; that's how a two-React-versions bug was caught before it reached a store build.

## Terms in one sentence

| Term | One sentence |
|---|---|
| OIDC | A layer on OAuth 2.0 that lets an app learn *who* signed in, through a signed ID token. |
| ID token | A JWT from Apple or Google stating the user's id (`sub`), the app it was issued for (`aud`) and when it expires. |
| JWKS | The provider's published public keys, used to verify that an ID token was really signed by them. |
| Nonce | A one-time random value bound into the ID token so it can't be replayed in another sign-in. |
| Refresh token rotation | Each refresh swaps the refresh token for a new one; reuse of an old one signals theft and revokes the family. |
| SecureStore | Expo's wrapper over iOS Keychain and Android Keystore for small secrets like the refresh token. |
| Development build | Our own build of the app with the Expo dev tools, needed once native modules go beyond Expo Go. |
| Config plugin | Code that edits the generated native projects at build time (permissions, schemes, Firebase file) instead of editing them by hand. |
| Outbox | A local table of changes waiting to be sent, written in the same transaction as the change itself. |
| Last write wins (LWW) | A conflict rule where the change with the newest timestamp is kept and the other is discarded. |
| Tombstone | A "deleted" marker kept instead of removing the row, so other devices can learn about the delete. |
| Sync cursor | The last server version a device has seen; the next pull asks only for what's newer. |
| Advisory lock | A Postgres lock on an arbitrary key (here, the user) that serializes work without locking table rows. |
| Expo push token | An address for one app install that Expo's push service translates to FCM or APNs. |
| FCM / APNs | Google's and Apple's push delivery services; every remote notification ends up going through one of them. |
| Push receipt | Expo's later confirmation of whether a sent notification reached FCM/APNs; it's how stale tokens get cleaned. |
| Deep link | A URL that opens a specific screen in the app, here carried inside a notification. |
| Entitlement | What the user has unlocked (`premium`), independent of which product or store they bought it through. |
| Offering | The set of packages (monthly, annual, lifetime) the paywall shows, configurable without an app release. |
| Idempotent webhook | Processing the same event twice has the same effect as once, because each event id is recorded. |
| HMAC signature | A hash of the request body with a shared secret, proving the webhook came from RevenueCat and wasn't altered. |
| License tester | A Google account whose Play purchases use a test card and accelerated renewals instead of real charges. |
| EAS Build / Submit / Update | Expo's cloud services to build signed binaries, upload them to the stores, and ship JavaScript updates over the air. |
| Channel | The update stream a build listens to (`staging`, `production`), set at build time. |
| Runtime version (fingerprint) | A hash of the native project; an update is only delivered to builds with the same hash. |
| Play App Signing | Google keeps the app signing key and re-signs uploads, which we sign with a separate upload key. |
| SHA-1 fingerprint | A short hash of a signing certificate, used to register Android apps with Google sign-in and Firebase. |
| Feature flag | A switch evaluated at runtime (here PostHog's `paywall-variant`) that changes behavior without a release. |
| A/B test | Showing variants to different users and comparing outcomes, here paywall copy against purchases. |
| Opt-out | A user setting that stops analytics; PostHog remembers it on the device. |
