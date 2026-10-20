import Anthropic from '@anthropic-ai/sdk';
import { IdentifyResponse, type IdentifyResult } from '@plantpal/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identifyPlant, setAnthropicClientForTests } from '@/ai/identify';
import { aiIdentifications, aiReports, users } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser } from '@/test/users';

import { POST as report } from './report/route';
import { POST as identify } from './route';

const IMAGE = '/9j/' + 'A'.repeat(400); // looks like a base64 JPEG
const MONSTERA: IdentifyResult = {
  isPlant: true,
  commonName: 'Monstera',
  scientificName: 'Monstera deliciosa',
  confidence: 'high',
  wateringIntervalDays: 7,
  careTip: 'Let the top few centimeters of soil dry out between waterings.',
};

/** A Messages API response the way Anthropic sends it. */
function message(text: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: text === null ? [] : [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1900, output_tokens: 200 },
    ...extra,
  };
}

/** The real SDK client over a fake network: each call takes the next queued reply. */
let replies: Array<() => Response | Promise<Response>>;
let sent: Array<{ headers: Headers; body: Record<string, unknown> }>;
const reply =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeClient() {
  return new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      const next = replies.shift();
      if (!next) throw new Error('unexpected Claude call');
      return next();
    },
  });
}

const post = (body: unknown, auth: Record<string, string>) =>
  new Request('http://test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
const ask = (auth: Record<string, string>, language: 'en' | 'es' = 'en') =>
  identify(post({ image: IMAGE, language }, auth));

const rows = () => testDb().db.select().from(aiIdentifications);

describe('identify helper (no database)', () => {
  beforeEach(() => {
    replies = [];
    sent = [];
  });

  it('gives up with "timeout" when Claude does not answer before the deadline', async () => {
    const hang = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
      );
    const client = new Anthropic({ apiKey: 'k', maxRetries: 0, fetch: hang as typeof fetch });
    const outcome = await identifyPlant(client, IMAGE, 'en', {
      model: 'claude-sonnet-5-5',
      thinking: 'adaptive',
      effort: 'low',
      deadline: Date.now() + 100,
    });
    expect(outcome.status).toBe('timeout');
    expect(outcome.usage.costMicroUsd).toBe(0);
  });

  it('does not send the fallback option to Haiku', async () => {
    replies.push(reply(message(JSON.stringify(MONSTERA), { model: 'claude-haiku-5-5' })));
    const outcome = await identifyPlant(fakeClient(), IMAGE, 'en', {
      model: 'claude-haiku-5-5',
      thinking: 'adaptive',
      effort: 'low',
      deadline: Date.now() + 5000,
    });
    expect(outcome.status).toBe('ok');
    expect(sent[0]!.body.fallbacks).toBeUndefined();
    // Haiku 5.5: 1900 × $0.10 + 200 × $0.50 per million = 290 micro-dollars
    expect(outcome.usage.costMicroUsd).toBe(290);
  });
});

describe.skipIf(!hasDb)('POST /api/plants/identify (integration)', () => {
  beforeEach(async () => {
    await resetDb();
    replies = [];
    sent = [];
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    vi.stubEnv('AI_DAILY_LIMIT', '1');
    setAnthropicClientForTests(fakeClient());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setAnthropicClientForTests(null);
  });

  it('returns the suggestion, records usage and cost, and stores nothing about the photo', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify(MONSTERA))));

    const res = await ask(u.auth, 'es');
    expect(res.status).toBe(200);
    const body = IdentifyResponse.parse(await res.json());
    expect(body.suggestion).toEqual(MONSTERA);
    expect(body.remaining).toEqual({ today: 2, month: null });

    const [row] = await rows();
    expect(row).toMatchObject({
      id: body.id,
      userId: u.id,
      status: 'ok',
      model: 'claude-sonnet-5-5',
      inputTokens: 1900,
      outputTokens: 200,
      costMicroUsd: 1900 * 2 + 200 * 10, // $0.0058
    });
    expect(JSON.stringify(row)).not.toContain(IMAGE.slice(0, 50));
  });

  it('sends the image first, the language, the JSON schema and the fallback option', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify(MONSTERA))));
    await ask(u.auth, 'es');

    const { headers, body } = sent[0]!;
    const content = (body.messages as Array<{ content: Array<Record<string, unknown>> }>)[0]!
      .content;
    expect(content[0]).toMatchObject({ type: 'image', source: { media_type: 'image/jpeg' } });
    expect(content[1]!.text).toContain('Spanish');
    const outputConfig = body.output_config as { format: Record<string, unknown>; effort: string };
    expect(outputConfig.effort).toBe('low');
    expect(outputConfig.format.type).toBe('json_schema');
    // The API can't enforce numeric ranges, so the SDK leaves them out (we check them ourselves).
    expect(JSON.stringify(outputConfig.format.schema)).not.toContain('"maximum"');
    expect(body.fallbacks).toBe('default');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('removes a stray closing brace left at the end of a text field', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify({ ...MONSTERA, careTip: 'Water weekly.}' }))));
    const body = await (await ask(u.auth)).json();
    expect(body.suggestion.careTip).toBe('Water weekly.');
  });

  it('passes a low-confidence answer through (the app will not pre-fill it)', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify({ ...MONSTERA, confidence: 'low' }))));
    const res = await ask(u.auth);
    expect(res.status).toBe(200);
    expect((await res.json()).suggestion.confidence).toBe('low');
    expect((await rows())[0]!.status).toBe('low_confidence');
  });

  it('blanks every field when the photo is not a plant, even if the model filled some', async () => {
    const u = await createUser();
    replies.push(
      reply(message(JSON.stringify({ ...MONSTERA, isPlant: false, confidence: 'medium' }))),
    );
    const res = await ask(u.auth);
    const body = await res.json();
    expect(body.suggestion).toEqual({
      isPlant: false,
      commonName: null,
      scientificName: null,
      confidence: 'low',
      wateringIntervalDays: null,
      careTip: null,
    });
    expect((await rows())[0]!.status).toBe('not_plant');
  });

  it('retries once on an invalid answer, and records both calls', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify({ ...MONSTERA, wateringIntervalDays: 90 }))));
    replies.push(reply(message(JSON.stringify(MONSTERA))));
    const res = await ask(u.auth);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(2);
    expect((await rows())[0]).toMatchObject({ status: 'ok', inputTokens: 3800, outputTokens: 400 });
  });

  it('answers 502 after two invalid answers', async () => {
    const u = await createUser();
    replies.push(reply(message('not json')));
    replies.push(reply(message(JSON.stringify({ isPlant: true }))));
    const res = await ask(u.auth);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('ai_invalid_output');
    expect((await rows())[0]!.status).toBe('invalid_output');
  });

  it('treats a refusal as "not sure" without retrying', async () => {
    const u = await createUser();
    replies.push(reply(message(null, { stop_reason: 'refusal' })));
    const res = await ask(u.auth);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion).toMatchObject({ isPlant: false, confidence: 'low' });
    expect(sent).toHaveLength(1);
    expect((await rows())[0]!.status).toBe('refused');
  });

  it('answers 502 when Anthropic is down, and does not count it against the user', async () => {
    const u = await createUser();
    replies.push(reply({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }, 529));
    const res = await ask(u.auth);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('ai_unavailable');
    expect((await rows())[0]!.status).toBe('error');

    replies.push(reply(message(JSON.stringify(MONSTERA))));
    const next = await (await ask(u.auth)).json();
    expect(next.remaining.today).toBe(2); // the failed call didn't use one up
  });

  it('enforces 3 a day on Free, with when it resets', async () => {
    const u = await createUser();
    for (let i = 0; i < 3; i++) {
      replies.push(reply(message(JSON.stringify(MONSTERA))));
      expect((await ask(u.auth)).status).toBe(200);
    }
    const res = await ask(u.auth);
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error.code).toBe('identify_limit');
    expect(error.details).toMatchObject({ plan: 'free', limit: 3, period: 'day' });
    expect(new Date(error.details.resetsAt).getUTCHours()).toBe(0);
    expect(sent).toHaveLength(3); // the 4th never reached Claude
  });

  it('lets only 3 of 5 simultaneous requests through on Free', async () => {
    const u = await createUser();
    for (let i = 0; i < 5; i++) replies.push(reply(message(JSON.stringify(MONSTERA))));
    const statuses = (await Promise.all(Array.from({ length: 5 }, () => ask(u.auth)))).map(
      (r) => r.status,
    );
    expect(statuses.filter((s) => s === 200)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });

  it('caps Premium at 100 a month', async () => {
    const u = await createUser();
    await testDb().db.update(users).set({ plan: 'premium' }).where(eq(users.id, u.id));
    // 100 earlier this month, on a day that isn't today, so only the monthly cap applies.
    const now = new Date();
    const earlier =
      now.getUTCDate() > 1
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12))
        : null;
    if (!earlier) return; // on the 1st of the month every earlier row is "today"; nothing to test
    await testDb()
      .db.insert(aiIdentifications)
      .values(
        Array.from({ length: 100 }, () => ({
          userId: u.id,
          model: 'claude-sonnet-5-5',
          status: 'ok' as const,
          createdAt: earlier,
        })),
      );
    const res = await ask(u.auth);
    expect(res.status).toBe(429);
    expect((await res.json()).error.details).toMatchObject({
      plan: 'premium',
      limit: 100,
      period: 'month',
    });
  });

  it('shows Premium its remaining day and month allowance', async () => {
    const u = await createUser();
    await testDb().db.update(users).set({ plan: 'premium' }).where(eq(users.id, u.id));
    replies.push(reply(message(JSON.stringify(MONSTERA))));
    const body = await (await ask(u.auth)).json();
    expect(body.remaining).toEqual({ today: 29, month: 99 });
  });

  it('stops calling Claude for everyone once the daily budget is spent', async () => {
    const someone = await createUser();
    await testDb().db.insert(aiIdentifications).values({
      userId: someone.id,
      model: 'claude-sonnet-5-5',
      status: 'ok',
      costMicroUsd: 1_000_000, // $1.00 = AI_DAILY_LIMIT
    });
    const u = await createUser();
    const res = await ask(u.auth);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('ai_resting');
    expect(sent).toHaveLength(0);
  });

  it('rejects a photo that is not a JPEG, before calling Claude', async () => {
    const u = await createUser();
    const res = await identify(
      post({ image: 'iVBORw0KGgo' + 'A'.repeat(200), language: 'en' }, u.auth),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_image');
    expect(sent).toHaveLength(0);
  });

  it('requires sign-in, and a configured key', async () => {
    expect((await ask({})).status).toBe(401);
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const u = await createUser();
    expect((await (await ask(u.auth)).json()).error.code).toBe('ai_not_configured');
  });

  it('records a report of the user’s own suggestion, and refuses someone else’s', async () => {
    const alice = await createUser();
    const bob = await createUser();
    replies.push(reply(message(JSON.stringify(MONSTERA))));
    const { id } = await (await ask(alice.auth)).json();

    const body = {
      identificationId: id,
      reason: 'wrong',
      note: 'It is a pothos',
      suggestion: MONSTERA,
    };
    expect((await report(post(body, bob.auth))).status).toBe(404);
    expect((await report(post(body, alice.auth))).status).toBe(200);

    const [saved] = await testDb().db.select().from(aiReports);
    expect(saved).toMatchObject({ userId: alice.id, reason: 'wrong', note: 'It is a pothos' });
    expect(saved!.suggestion).toEqual(MONSTERA);
  });

  it('deletes identifications and reports with the account', async () => {
    const u = await createUser();
    replies.push(reply(message(JSON.stringify(MONSTERA))));
    const { id } = await (await ask(u.auth)).json();
    await report(post({ identificationId: id, reason: 'offensive', suggestion: MONSTERA }, u.auth));
    await testDb().db.delete(users).where(eq(users.id, u.id));
    expect(await rows()).toHaveLength(0);
    expect(await testDb().db.select().from(aiReports)).toHaveLength(0);
  });
});
