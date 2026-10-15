import { describe, expect, it } from 'vitest';

import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts a valid body', () => {
    const body = { status: 'ok', db: 'ok', version: '0.1.0', time: new Date().toISOString() };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it('rejects an unknown db state', () => {
    const body = { status: 'ok', db: 'maybe', version: '0.1.0', time: new Date().toISOString() };
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
