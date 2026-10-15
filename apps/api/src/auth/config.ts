import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

const AuthEnv = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** iOS bundle ids allowed as the `aud` of Apple identity tokens. */
  APPLE_CLIENT_IDS: list,
  /** Google OAuth Web client id(s): the `aud` of Google ID tokens. */
  GOOGLE_CLIENT_IDS: list,
  ALLOW_DEV_AUTH: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  /** Contents of the .p8 key. Newlines may be written as \n in env files. */
  APPLE_PRIVATE_KEY: z.string().optional(),
});
export type AuthConfig = ReturnType<typeof loadAuthConfig>;

export function loadAuthConfig(env: Record<string, string | undefined> = process.env) {
  const e = AuthEnv.parse(env);
  return {
    jwtSecret: new TextEncoder().encode(e.JWT_SECRET),
    appleClientIds: e.APPLE_CLIENT_IDS,
    googleClientIds: e.GOOGLE_CLIENT_IDS,
    /** Dev sign-in needs an explicit opt-in AND is always off on Vercel production. */
    devAuthEnabled: e.ALLOW_DEV_AUTH === 'true' && e.VERCEL_ENV !== 'production',
    appleRevoke:
      e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY
        ? {
            teamId: e.APPLE_TEAM_ID,
            keyId: e.APPLE_KEY_ID,
            privateKey: e.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }
        : null,
  };
}

let cached: AuthConfig | null = null;
export function authConfig(): AuthConfig {
  cached ??= loadAuthConfig();
  return cached;
}
