import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from '@/db/client';
import { refreshTokens } from '@/db/schema';
import { unauthorized } from '@/lib/errors';

export const REFRESH_TOKEN_TTL_DAYS = 30;

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function issueRefreshToken(
  db: Db | Tx,
  userId: string,
  familyId: string = randomUUID(),
  now = new Date(),
) {
  const raw = randomBytes(32).toString('base64url');
  const [row] = await db
    .insert(refreshTokens)
    .values({
      userId,
      familyId,
      tokenHash: hash(raw),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: refreshTokens.id });
  return { raw, id: row!.id };
}

/**
 * Rotation: every refresh swaps the old token for a new one.
 * Reuse detection: if a token that was already swapped comes back, someone else holds a copy,
 * so the whole family is revoked and the user must sign in again.
 * `FOR UPDATE` locks the row, so two parallel refreshes can't both succeed.
 */
export async function rotateRefreshToken(db: Db, raw: string, now = new Date()) {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash(raw)))
      .for('update');

    if (!current) return { error: 'Refresh token not recognised' } as const;

    if (current.revokedAt) {
      if (current.replacedById) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(eq(refreshTokens.familyId, current.familyId), isNull(refreshTokens.revokedAt)),
          );
        return { error: 'Refresh token was reused; session revoked' } as const;
      }
      return { error: 'Refresh token was revoked' } as const;
    }
    if (current.expiresAt <= now) return { error: 'Refresh token expired' } as const;

    const next = await issueRefreshToken(tx, current.userId, current.familyId, now);
    await tx
      .update(refreshTokens)
      .set({ revokedAt: now, replacedById: next.id })
      .where(eq(refreshTokens.id, current.id));

    return { userId: current.userId, refreshToken: next.raw } as const;
  });

  // Thrown outside the transaction, so the family revocation above is committed, not rolled back.
  if ('error' in result) throw unauthorized(result.error);
  return result;
}

/** Logout: revoke only this device's session (its token family). */
export async function revokeRefreshTokenFamily(db: Db, raw: string, now = new Date()) {
  const [current] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hash(raw)));
  if (!current) return;
  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(refreshTokens.familyId, current.familyId), isNull(refreshTokens.revokedAt)));
}
