import { jwtVerify, SignJWT } from 'jose';

import { unauthorized } from '@/lib/errors';

const ISSUER = 'plantpal-api';
const AUDIENCE = 'plantpal-app';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Short-lived access token (15 min), signed with HS256. Only this server issues and verifies
 * it, so a shared secret is enough; no public key needs to be published.
 */
export async function signAccessToken(userId: string, secret: Uint8Array, now = new Date()) {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret);
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyAccessToken(token: string, secret: Uint8Array): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub) throw new Error('missing sub');
    return payload.sub;
  } catch {
    throw unauthorized('Access token is invalid or expired');
  }
}
