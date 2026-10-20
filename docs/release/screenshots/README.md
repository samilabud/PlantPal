# Store screenshots

Google Play phone screenshots, 1440 × 2560 (9:16), no alpha, from the Android emulator.

| File | Screen |
|---|---|
| `android-1-list.png` · `es/android-1-list.png` | Plant list with every watering state |
| `android-2-ai.png` · `es/android-2-ai.png` | Identify with AI: the suggestion labeled as AI, form pre-filled |
| `android-3-guide.png` · `es/android-3-guide.png` | Guide |
| `android-4-detail.png` · `es/android-4-detail.png` | Plant detail with its watering history |

## How they're made
1. Local API and database running; seed a demo account per language:
   `node apps/api/scripts/seed-store-demo.mjs store-en-1 en` (and `store-es-1 es`).
2. Android demo status bar (clean 9:41 clock, full battery, no notification icons):
   ```sh
   adb shell settings put global sysui_demo_allowed 1
   adb shell am broadcast -a com.android.systemui.demo -e command enter
   adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
   adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
   adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
   adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e level 4 -e datatype none
   adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
   ```
3. `maestro test -e LANG=en -e USER=store-en-1 apps/mobile/e2e/tools/store-shots.yaml`
   (one Claude call, ~$0.006). Then the same with `LANG=es -e USER=store-es-1`.
4. Frame each capture: `docs/release/screenshots/frame.sh raw.png android-1-list.png`.

Play asks per image whether it's AI-generated: these are real captures of the app. The AI
screenshot shows a suggestion produced by the app's AI feature; see `docs/release/data-safety.md`.
