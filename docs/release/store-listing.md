# Store listing (App Store and Google Play)

Draft text, ready to paste. Character counts were checked by script against each store's limit.
Every claim matches a feature with evidence in `docs/evidence/`.

| Field | Limit | Text |
|---|---|---|
| App name (both stores) | 30 | PlantPal: Plant Water Reminder (30) |
| Subtitle (App Store) | 30 | Water reminders, even offline (29) |
| Short description (Google Play) | 80 | Never forget to water a plant again. Works offline and syncs across your phones. (80) |
| Keywords (App Store) | 100 | plant,water,watering,reminder,houseplant,garden,care,schedule,succulent,offline,tracker,indoor,green (100) |
| Category | | App Store: Lifestyle. Google Play: House & Home |
| Price | | Free, with an optional Premium subscription |
| Contains ads | | No |

## Full description (both stores, under 4,000)

PlantPal remembers which plant needs water, so you don't have to.

Add your plants, say how often each one needs water, and tap Water when you water it. Your list always shows what is due today, what is overdue and what can wait.

• Reminders on the morning a plant is due, plus a daily nudge if one is overdue
• Works without internet: everything is saved on your phone and syncs when you are back online
• The same plants on all your devices: sign in with Apple or Google
• A photo history for each plant
• Undo a watering you tapped by mistake

Free: up to 3 plants, with one photo each.
Premium: unlimited plants and photo history. Monthly, yearly or a one-time lifetime purchase.

No ads. No tracking. Delete your account and all your data from Settings at any time.

Privacy policy: https://plantpal-api.vercel.app/privacy

## Subscription disclosure (App Store review notes and paywall)
Payment is charged to your Apple ID or Google account at confirmation of purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your account settings after purchase. Lifetime is a one-time purchase.

## URLs
| | URL | Live? |
|---|---|---|
| Privacy policy | https://plantpal-api.vercel.app/privacy | after the M7 push (Vercel deploys main) |
| Support | https://plantpal-api.vercel.app/support | after the M7 push |
| Account deletion (Google Play) | https://plantpal-api.vercel.app/delete-account | after the M7 push |

## Review notes (App Store and Google Play)
Store builds only offer Sign in with Apple and Sign in with Google, so reviewers sign in with their own Apple ID or Google account, which is normal for apps with only social sign-in. No demo account is needed. To test Premium, reviewers use the stores' sandbox purchases (no real charge).

## Screenshots
Alt text (≤ 140 characters): "Plant list showing which plants need water today", "Guide listing everything PlantPal can do", "Monstera detail with its watering history".

| Store | Required | Status |
|---|---|---|
| Google Play (phone) | 2–8; max side ≤ 2 × min side; no alpha; 4+ at 9:16 ≥ 1080 px for promotion | **3 ready** in `docs/release/screenshots/` (list, guide, detail): captured on the emulator with a clean demo status bar, fitted onto a 1440 × 2560 (9:16) brand-colored canvas because the raw 1440 × 3120 captures exceed 2:1. One more needed for promotion: the paywall, retaken from a store build (the dev build shows "Test purchases only") |
| App Store (6.9" iPhone, 1320 × 2868) | 1–10 | **Not yet:** needs an iOS build, which needs Xcode ≥ 26.4 (this Mac has 26.2) or an EAS cloud build installed on a simulator |
