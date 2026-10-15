// Reproducible offline-sync demo against a running API (default: local dev server).
//   node apps/api/scripts/demo-offline-sync.mjs            # http://localhost:4000
//   API_URL=https://<preview>.vercel.app node apps/api/scripts/demo-offline-sync.mjs
// It plays two phones signed in as the same user. Each "phone" keeps a local outbox while
// offline, exactly like the app, then syncs. Requires the dev sign-in (local or Preview).
import { randomUUID } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:4000';
const user = `demo-${Date.now()}`;

async function call(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function phone(name, token) {
  return {
    name,
    cursor: 0,
    outbox: [],
    plants: new Map(),
    events: new Map(),
    edit(change) {
      this.outbox = this.outbox.filter((c) => c.id !== change.id);
      this.outbox.push(change);
    },
    async sync() {
      const res = await call('/api/sync', { cursor: this.cursor, changes: this.outbox }, token);
      const sent = this.outbox.length;
      this.outbox = [];
      for (const p of res.plants) this.plants.set(p.id, p);
      for (const e of res.wateringEvents) this.events.set(e.id, e);
      this.cursor = res.cursor;
      console.log(
        `  ${this.name} synced: sent ${sent}, rejected ${JSON.stringify(res.rejected.map((r) => r.reason))}, ` +
          `pulled ${res.plants.length} plant(s) + ${res.wateringEvents.length} watering(s), cursor ${res.cursor}`,
      );
      return res;
    },
  };
}

const t = (offsetSec) => new Date(Date.now() + offsetSec * 1000).toISOString();
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) process.exitCode = 1;
};

console.log(`API ${API}, user "${user}"\n`);
const session = await call('/api/auth/dev', { name: user });
const A = phone('Phone A', session.tokens.accessToken);
const B = phone('Phone B', session.tokens.accessToken);

console.log('1. Phone A creates a plant online; Phone B syncs and gets it');
const plantId = randomUUID();
A.edit({
  kind: 'plant.upsert',
  id: plantId,
  clientUpdatedAt: t(-60),
  data: { name: 'Monstera', wateringIntervalDays: 7, coverPhotoId: null },
});
await A.sync();
await B.sync();
check('Phone B has the plant', B.plants.get(plantId)?.name === 'Monstera');

console.log('\n2. Both phones go OFFLINE and edit the same plant (A first, B later)');
A.edit({
  kind: 'plant.upsert',
  id: plantId,
  clientUpdatedAt: t(-30),
  data: { name: 'Monstera (A)', wateringIntervalDays: 7, coverPhotoId: null },
});
B.edit({
  kind: 'plant.upsert',
  id: plantId,
  clientUpdatedAt: t(-20),
  data: { name: 'Monstera (B)', wateringIntervalDays: 5, coverPhotoId: null },
});
console.log('   ...and both water it while offline');
const waterA = randomUUID();
const waterB = randomUUID();
A.edit({
  kind: 'wateringEvent.upsert',
  id: waterA,
  clientUpdatedAt: t(-29),
  data: { plantId, wateredAt: t(-29) },
});
B.edit({
  kind: 'wateringEvent.upsert',
  id: waterB,
  clientUpdatedAt: t(-19),
  data: { plantId, wateredAt: t(-19) },
});
console.log(
  `   outbox: Phone A ${A.outbox.length} change(s), Phone B ${B.outbox.length} change(s)`,
);

console.log('\n3. Back ONLINE: Phone B syncs first, then Phone A (whose edit is older)');
await B.sync();
const resA = await A.sync();
check(
  "Phone A's older rename is rejected as stale",
  resA.rejected.some((r) => r.id === plantId && r.reason === 'stale'),
);
check('Phone A receives the winning version', A.plants.get(plantId)?.name === 'Monstera (B)');

console.log("\n4. Phone B syncs again to pick up Phone A's watering");
await B.sync();
check(
  'Both phones agree on the plant',
  A.plants.get(plantId)?.name === B.plants.get(plantId)?.name,
);
check(
  'Both waterings survived on both phones (append-only, no conflict)',
  [A, B].every((p) => p.events.has(waterA) && p.events.has(waterB)),
);

console.log('\n5. Phone A deletes the plant; Phone B gets the tombstone');
A.edit({ kind: 'plant.delete', id: plantId, clientUpdatedAt: t(0) });
await A.sync();
await B.sync();
check('Phone B sees the plant as deleted', Boolean(B.plants.get(plantId)?.deletedAt));
check(
  'Its waterings were deleted with it',
  [waterA, waterB].every((id) => Boolean(B.events.get(id)?.deletedAt)),
);
