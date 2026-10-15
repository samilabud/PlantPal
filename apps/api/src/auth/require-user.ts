import { unauthorized } from '@/lib/errors';

import { verifyAccessToken } from './access-token';
import { authConfig } from './config';

/** Reads `Authorization: Bearer <token>` and returns the user id, or throws 401. */
export async function requireUserId(request: Request): Promise<string> {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();
  return verifyAccessToken(token, authConfig().jwtSecret);
}
