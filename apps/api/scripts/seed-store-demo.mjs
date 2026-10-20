// Demo account for store screenshots, against the LOCAL API and database only:
//   node apps/api/scripts/seed-store-demo.mjs store-en en
//   node apps/api/scripts/seed-store-demo.mjs store-es es
// Signs in with the dev sign-in as <name>, makes the account Premium (so 6 plants are allowed),
// and syncs six plants with backdated waterings, so the list shows every watering state.
import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
nextEnv.loadEnvConfig(path.join(here, '..'));
const API = process.env.API_URL ?? 'http://localhost:4000';
const [name = 'store-en', language = 'en'] = process.argv.slice(2);

const dbUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname)) {
  throw new Error('Refusing to seed a non-local database');
}

// [English name, Spanish name, water every N days, last watered N days ago]
const PLANTS = [
  ['Basil', 'Albahaca', 2, 1], // water tomorrow
  ['Fiddle-leaf fig', 'Ficus lira', 7, 10], // overdue by 3 days
  ['Monstera', 'Monstera', 7, 7], // water today
  ['Peace lily', 'Cuna de Moisés', 5, 3], // in 2 days
  ['Pothos', 'Pothos', 7, 6], // tomorrow
  ['Snake plant', 'Lengua de suegra', 14, 4], // in 10 days
];

async function call(route, body, token) {
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${route} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

const session = await call('/api/auth/dev', { name });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
await sql`update users set plan = 'premium', plan_expires_at = null where id = ${session.user.id}`;
await sql.end();

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 86_400_000).toISOString();
const changes = [];
for (const [en, es, every, last] of PLANTS) {
  const id = randomUUID();
  changes.push({
    kind: 'plant.upsert',
    id,
    clientUpdatedAt: daysAgo(30),
    data: { name: language === 'es' ? es : en, wateringIntervalDays: every, coverPhotoId: null },
  });
  changes.push({
    kind: 'wateringEvent.upsert',
    id: randomUUID(),
    clientUpdatedAt: daysAgo(last),
    data: { plantId: id, wateredAt: daysAgo(last) },
  });
}
const result = await call('/api/sync', { cursor: 0, changes }, session.tokens.accessToken);
console.log(`${name}: premium, ${PLANTS.length} plants, ${result.rejected?.length ?? 0} rejected`);
