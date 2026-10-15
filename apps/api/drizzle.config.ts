import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

// Load .env.local the same way `next dev` does, so the CLI and the app use one DATABASE_URL.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
