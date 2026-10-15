# @plantpal/api

Next.js 16 route handlers + Drizzle ORM + Postgres. See the root [README](../../README.md) for setup.

- `GET /api/health`: liveness + database check.
- Local DB: `docker compose up -d` at the repo root. Production: Neon (pooled URL).
- Tests: `pnpm test` (Vitest). Integration tests run when `DATABASE_URL` is set (`.env.test.local`).
