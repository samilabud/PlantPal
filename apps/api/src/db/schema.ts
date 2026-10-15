import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const planEnum = pgEnum('plan', ['free', 'premium']);
export const providerEnum = pgEnum('auth_provider', ['apple', 'google', 'dev']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  plan: planEnum('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  ...timestamps,
});

/**
 * One row per (provider, subject). A separate table instead of apple_sub/google_sub columns,
 * so one user can link several providers and adding a provider needs no schema change.
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: providerEnum('provider').notNull(),
    /** The provider's stable user id (the `sub` claim). Never the email: emails change. */
    subject: text('subject').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('auth_identities_provider_subject').on(t.provider, t.subject),
    index().on(t.userId),
  ],
);

/**
 * Refresh tokens are random strings. Only their SHA-256 hash is stored, so a database leak
 * does not leak usable tokens. Tokens from one sign-in share a family_id: when an old token is
 * reused (a sign of theft), the whole family is revoked.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    ...timestamps,
  },
  (t) => [index().on(t.familyId), index().on(t.userId)],
);
