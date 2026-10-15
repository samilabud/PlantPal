import type { AuthProvider, Me, SessionResponse } from '@plantpal/shared';
import { and, eq } from 'drizzle-orm';

import type { Db } from '@/db';
import { effectivePlan } from '@/billing/plan';
import { authIdentities, users } from '@/db/schema';
import { unauthorized } from '@/lib/errors';

import { signAccessToken } from './access-token';
import { authConfig } from './config';
import { issueRefreshToken } from './refresh-tokens';

/**
 * Finds the user for (provider, subject) or creates one. Runs in a transaction and relies on
 * the unique (provider, subject) constraint, so two parallel first sign-ins can't create two users.
 */
export async function findOrCreateUser(
  db: Db,
  identity: { provider: AuthProvider; subject: string; email: string | null },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, identity.provider),
          eq(authIdentities.subject, identity.subject),
        ),
      );
    if (existing) {
      // Apple sends the email only once; keep it if we learn it later.
      if (identity.email) {
        await tx.update(users).set({ email: identity.email }).where(eq(users.id, existing.userId));
      }
      return existing.userId;
    }

    const [user] = await tx
      .insert(users)
      .values({ email: identity.email })
      .returning({ id: users.id });
    await tx.insert(authIdentities).values({
      userId: user!.id,
      provider: identity.provider,
      subject: identity.subject,
    });
    return user!.id;
  });
}

export async function getMe(db: Db, userId: string): Promise<Me> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw unauthorized('User no longer exists');
  const identities = await db
    .select({ provider: authIdentities.provider })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId));
  return {
    id: user.id,
    email: user.email,
    plan: effectivePlan(user),
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    providers: identities.map((i) => i.provider),
  };
}

/** A new sign-in: a new token family, a fresh access token, and the profile. */
export async function createSession(db: Db, userId: string): Promise<SessionResponse> {
  const { jwtSecret } = authConfig();
  const access = await signAccessToken(userId, jwtSecret);
  const refresh = await issueRefreshToken(db, userId);
  return {
    tokens: {
      accessToken: access.token,
      refreshToken: refresh.raw,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
    },
    user: await getMe(db, userId),
  };
}
