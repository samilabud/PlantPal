# @plantpal/mobile

Expo SDK 57 app. See the root [README](../../README.md) for setup.

- Routes: `src/app/` (Expo Router). Non-route code lives in `src/`.
- Config: `app.config.ts` builds three variants (development, preview, production), each with its own bundle id and URL scheme.
- Env: `src/config/env.ts` validates config at startup. `EXPO_PUBLIC_*` values are public.
- Tests: `pnpm test` (Jest + React Native Testing Library), files in `__tests__/`.
