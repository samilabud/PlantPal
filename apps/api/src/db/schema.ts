import {
  bigint,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

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

/**
 * One global counter for every synced write. Each insert/update takes the next number, so
 * "everything after version N" is one indexed query per table, and a device only needs to
 * remember a single number (its cursor).
 */
export const syncVersionSeq = pgSequence('sync_version_seq');

const syncColumns = {
  /** The phone's clock at the edit. Used for last-write-wins. */
  clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
  /** Server-assigned, increasing. Used as the pull cursor. */
  serverVersion: bigint('server_version', { mode: 'number' }).notNull(),
  /** Tombstone: deletes sync like any other change. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
};

/** Ids come from the phone (UUIDs), so rows can be created offline. No defaultRandom(). */
export const plants = pgTable(
  'plants',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    wateringIntervalDays: integer('watering_interval_days').notNull(),
    coverPhotoId: uuid('cover_photo_id'),
    ...syncColumns,
  },
  (t) => [index().on(t.userId, t.serverVersion)],
);

/** Append-only: two phones watering offline never conflict, both events are kept. */
export const wateringEvents = pgTable(
  'watering_events',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    wateredAt: timestamp('watered_at', { withTimezone: true }).notNull(),
    ...syncColumns,
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.plantId)],
);

/** The file lives in Blob storage at users/<userId>/photos/<id>.jpg (derived, never sent). */
export const plantPhotos = pgTable(
  'plant_photos',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plantId: uuid('plant_id')
      .notNull()
      .references(() => plants.id, { onDelete: 'cascade' }),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull(),
    ...syncColumns,
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.plantId)],
);
