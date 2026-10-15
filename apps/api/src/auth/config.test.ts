import { describe, expect, it } from 'vitest';

import { loadAuthConfig } from './config';

const base = { JWT_SECRET: 'x'.repeat(32) };

describe('loadAuthConfig', () => {
  it('requires a long JWT secret', () => {
    expect(() => loadAuthConfig({ JWT_SECRET: 'short' })).toThrow(/32 characters/);
  });

  it('parses comma-separated client ids', () => {
    const cfg = loadAuthConfig({ ...base, APPLE_CLIENT_IDS: 'a.b, c.d ,' });
    expect(cfg.appleClientIds).toEqual(['a.b', 'c.d']);
  });

  it('enables dev auth only when asked and never on Vercel production', () => {
    expect(loadAuthConfig(base).devAuthEnabled).toBe(false);
    expect(loadAuthConfig({ ...base, ALLOW_DEV_AUTH: 'true' }).devAuthEnabled).toBe(true);
    expect(
      loadAuthConfig({ ...base, ALLOW_DEV_AUTH: 'true', VERCEL_ENV: 'production' }).devAuthEnabled,
    ).toBe(false);
  });

  it('turns escaped newlines in the Apple key back into real ones', () => {
    const cfg = loadAuthConfig({
      ...base,
      APPLE_TEAM_ID: 'T',
      APPLE_KEY_ID: 'K',
      APPLE_PRIVATE_KEY: 'line1\\nline2',
    });
    expect(cfg.appleRevoke?.privateKey).toBe('line1\nline2');
  });
});
