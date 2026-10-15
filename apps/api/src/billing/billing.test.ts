import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { effectivePlan } from './plan';
import { affectedUserIds, verifyWebhook } from './webhook';

const cfg = { secretKey: null, webhookAuth: 'Bearer abc', webhookSigningSecret: 'shh' };
const sign = (t: number, body: string, secret = 'shh') =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const headers = (h: Record<string, string>) => new Headers(h);
const now = 1_800_000_000_000;
const t = now / 1000;

describe('verifyWebhook', () => {
  const body = '{"event":{"id":"1","type":"TEST"}}';

  it('accepts a correct header and signature', () => {
    expect(() =>
      verifyWebhook(
        body,
        headers({ authorization: 'Bearer abc', 'x-revenuecat-webhook-signature': sign(t, body) }),
        cfg,
        now,
      ),
    ).not.toThrow();
  });

  it('rejects a changed body (signature covers the raw bytes)', () => {
    const h = headers({
      authorization: 'Bearer abc',
      'x-revenuecat-webhook-signature': sign(t, body),
    });
    expect(() => verifyWebhook(body.replace('TEST', 'RENEWAL'), h, cfg, now)).toThrow(
      /Bad signature/,
    );
  });

  it('rejects a replay of a captured request after 5 minutes', () => {
    const old = t - 6 * 60;
    const h = headers({
      authorization: 'Bearer abc',
      'x-revenuecat-webhook-signature': sign(old, body),
    });
    expect(() => verifyWebhook(body, h, cfg, now)).toThrow(/outside the allowed window/);
  });

  it('rejects a wrong secret, a wrong auth header and a missing signature', () => {
    expect(() =>
      verifyWebhook(
        body,
        headers({
          authorization: 'Bearer abc',
          'x-revenuecat-webhook-signature': sign(t, body, 'other'),
        }),
        cfg,
        now,
      ),
    ).toThrow(/Bad signature/);
    expect(() =>
      verifyWebhook(
        body,
        headers({ authorization: 'Bearer nope', 'x-revenuecat-webhook-signature': sign(t, body) }),
        cfg,
        now,
      ),
    ).toThrow(/authorization/);
    expect(() => verifyWebhook(body, headers({ authorization: 'Bearer abc' }), cfg, now)).toThrow(
      /Missing signature/,
    );
  });

  it('fails closed when no verification is configured', () => {
    expect(() =>
      verifyWebhook(
        body,
        headers({}),
        { secretKey: null, webhookAuth: null, webhookSigningSecret: null },
        now,
      ),
    ).toThrow(/not configured/);
  });
});

describe('affectedUserIds', () => {
  it('keeps only our user ids (UUIDs), deduplicated, including transfers', () => {
    const a = '6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b7e';
    const b = 'b6a8f6d2-2c3e-4bf7-9a49-0c2f4f1e9e11';
    expect(
      affectedUserIds({
        id: 'e',
        type: 'TRANSFER',
        app_user_id: a,
        original_app_user_id: '$RCAnonymousID:123',
        aliases: [a],
        transferred_from: ['$RCAnonymousID:123'],
        transferred_to: [b],
      }),
    ).toEqual([a, b]);
  });
});

describe('effectivePlan', () => {
  const at = new Date('2026-10-15T12:00:00Z');
  it('an expired premium is free; lifetime (no expiry) stays premium', () => {
    expect(
      effectivePlan({ plan: 'premium', planExpiresAt: new Date('2026-10-14T00:00:00Z') }, at),
    ).toBe('free');
    expect(
      effectivePlan({ plan: 'premium', planExpiresAt: new Date('2026-11-14T00:00:00Z') }, at),
    ).toBe('premium');
    expect(effectivePlan({ plan: 'premium', planExpiresAt: null }, at)).toBe('premium');
    expect(effectivePlan({ plan: 'free', planExpiresAt: null }, at)).toBe('free');
  });
});
