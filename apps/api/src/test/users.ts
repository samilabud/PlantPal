import { randomUUID } from 'node:crypto';

import { signAccessToken } from '@/auth/access-token';
import { authConfig } from '@/auth/config';
import { users } from '@/db/schema';

import { testDb } from './db';

export async function createUser() {
  const [user] = await testDb().db.insert(users).values({}).returning({ id: users.id });
  const { token } = await signAccessToken(user!.id, authConfig().jwtSecret);
  return { id: user!.id, token, auth: { Authorization: `Bearer ${token}` } };
}

export const uuid = () => randomUUID();
