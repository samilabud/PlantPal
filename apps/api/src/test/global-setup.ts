import { loadEnvConfig } from '@next/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Creates the *_test database if needed and applies all migrations, once per test run. */
export default async function setup() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) return; // DB tests skip themselves
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${name}": the database name must end in _test`);
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const adminSql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  const [exists] = await adminSql`select 1 from pg_database where datname = ${name}`;
  if (!exists) await adminSql.unsafe(`create database "${name}"`);
  await adminSql.end();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle({ client: sql }), { migrationsFolder: './drizzle' });
  await sql.end();
}
