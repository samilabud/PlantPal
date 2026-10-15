# PlantPal

A plant-care app (Expo / React Native + a Next.js API) built as a portfolio project to prove
mobile engineering skills end to end: both stores, auth, offline sync, push, subscriptions,
release engineering, testing and analytics.

> **Built with AI assistance.** This project was built with Claude Code as a pair programmer.
> I (Samil Abud) reviewed every change and can explain every file.
> Subscriptions run in **sandbox mode only**. There are no production users and no revenue.

**Status:** M3 (core features + offline sync) done. See [docs/M0_PLAN.md](docs/M0_PLAN.md) for the full plan and
[docs/evidence/](docs/evidence/) for proof of each capability.

## Repo layout

```
apps/mobile     Expo SDK 57 app (Expo Router, TypeScript strict, development build)
apps/api        Next.js 16 route handlers + Drizzle + Postgres (Neon in production)
packages/shared Zod schemas shared by the app and the API (the API contract)
docs/           plan, evidence, interview notes, final report
```

## Quick start

Requirements: Node ≥ 22.13, pnpm 10, Docker, Android Studio (emulator) and/or Xcode ≥ 26.4.

```sh
pnpm install
docker compose up -d --wait            # local Postgres on :5433
cp apps/api/.env.example apps/api/.env.local
cp apps/api/.env.test.example apps/api/.env.test.local
pnpm --filter @plantpal/api env:pull   # Blob credentials (needs `vercel login`); the OIDC token expires, re-run when uploads fail with 401/403
pnpm --filter @plantpal/api db:migrate
pnpm --filter @plantpal/api dev        # API on http://localhost:4000

# in another terminal
pnpm --filter @plantpal/mobile android # builds + installs the dev client (first run is slow)
pnpm --filter @plantpal/mobile start   # Metro; the app finds the API on the same host
```

Checks (the same ones CI runs):

```sh
pnpm lint && pnpm typecheck && pnpm test
```
