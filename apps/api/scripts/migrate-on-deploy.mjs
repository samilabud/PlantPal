// Runs database migrations as part of the Vercel *production* build.
// Preview deployments share the production database (Neon via the Vercel integration),
// so an unmerged branch must never change the schema: previews skip this step.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`);
  process.exit(0);
}

// Migrations use the direct (unpooled) connection: DDL and advisory locks don't belong behind PgBouncer.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] no DATABASE_URL_UNPOOLED or DATABASE_URL');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle({ client: sql }), { migrationsFolder: './drizzle' });
  console.log('[migrate] migrations applied');
} finally {
  await sql.end();
}
