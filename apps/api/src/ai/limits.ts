import { IDENTIFY_LIMITS } from '@plantpal/shared';
import { and, count, eq, gte, notInArray, sql, sum } from 'drizzle-orm';

import { effectivePlan } from '@/billing/plan';
import type { Db } from '@/db';
import { aiIdentifications, users } from '@/db/schema';
import { HttpError } from '@/lib/errors';

import type { IdentifyUsage } from './identify';

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const nextUtcDay = (d: Date) => new Date(startOfUtcDay(d).getTime() + 86_400_000);
const nextUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

/** Calls that failed on our side or Anthropic's don't use up the user's allowance. */
const NOT_COUNTED = ['timeout', 'error'] as const;

/**
 * Checks the spending guard and the user's limits, then records a `pending` row, all under a
 * per-user lock. Three taps at once can't all pass a "2 used of 3" check: the second waits for
 * the first's row. (Seed 1 so this lock never blocks the same user's sync, which uses seed 0.)
 */
export async function reserveIdentification(
  db: Db,
  userId: string,
  opts: { model: string; dailyLimitMicroUsd: number; now?: Date },
) {
  const now = opts.now ?? new Date();
  const day = startOfUtcDay(now);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 1))`);

    // Global guard first: when the day's budget is spent, nobody calls Claude.
    const [spent] = await tx
      .select({ total: sum(aiIdentifications.costMicroUsd) })
      .from(aiIdentifications)
      .where(gte(aiIdentifications.createdAt, day));
    if (Number(spent?.total ?? 0) >= opts.dailyLimitMicroUsd) {
      throw new HttpError(503, 'ai_resting', 'AI is resting. Try again tomorrow.');
    }

    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new HttpError(401, 'unauthorized', 'Not signed in');
    const plan = effectivePlan(user, now);
    const limits = IDENTIFY_LIMITS[plan];

    const used = (since: Date) =>
      tx
        .select({ n: count() })
        .from(aiIdentifications)
        .where(
          and(
            eq(aiIdentifications.userId, userId),
            gte(aiIdentifications.createdAt, since),
            notInArray(aiIdentifications.status, [...NOT_COUNTED]),
          ),
        )
        .then(([r]) => r?.n ?? 0);

    const today = await used(day);
    if (today >= limits.perDay) {
      throw new HttpError(429, 'identify_limit', 'Daily identification limit reached', {
        plan,
        limit: limits.perDay,
        period: 'day',
        resetsAt: nextUtcDay(now).toISOString(),
      });
    }
    let month: number | null = null;
    if (limits.perMonth !== null) {
      month = await used(startOfUtcMonth(now));
      if (month >= limits.perMonth) {
        throw new HttpError(429, 'identify_limit', 'Monthly identification limit reached', {
          plan,
          limit: limits.perMonth,
          period: 'month',
          resetsAt: nextUtcMonth(now).toISOString(),
        });
      }
    }

    const [row] = await tx
      .insert(aiIdentifications)
      .values({ userId, model: opts.model, createdAt: now })
      .returning({ id: aiIdentifications.id });
    return {
      id: row!.id,
      remaining: {
        today: limits.perDay - today - 1,
        month: limits.perMonth === null ? null : limits.perMonth - month! - 1,
      },
    };
  });
}

/** Records how the call ended: status, the model that answered, tokens, cost and latency. */
export async function finishIdentification(
  db: Db,
  id: string,
  status: (typeof aiIdentifications.$inferSelect)['status'],
  usage: IdentifyUsage,
) {
  await db
    .update(aiIdentifications)
    .set({
      status,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costMicroUsd: usage.costMicroUsd,
      latencyMs: usage.latencyMs,
    })
    .where(eq(aiIdentifications.id, id));
}
