import { HealthResponse } from '@plantpal/shared';
import { describe, expect, it } from 'vitest';

import { buildHealth } from './health';

const fixedNow = () => new Date('2026-10-15T12:00:00.000Z');

describe('buildHealth', () => {
  it('is ok when the database answers', async () => {
    const body = await buildHealth(async () => 'ok', fixedNow);
    expect(body).toMatchObject({ status: 'ok', db: 'ok', time: '2026-10-15T12:00:00.000Z' });
    // The body must match the contract the mobile app validates against.
    expect(HealthResponse.safeParse(body).success).toBe(true);
  });

  it('is degraded when the database is down', async () => {
    const body = await buildHealth(async () => 'down', fixedNow);
    expect(body.status).toBe('degraded');
  });

  it('stays ok when no database is configured yet', async () => {
    const body = await buildHealth(async () => 'not_configured', fixedNow);
    expect(body).toMatchObject({ status: 'ok', db: 'not_configured' });
  });
});
