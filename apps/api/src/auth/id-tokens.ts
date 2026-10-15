import { createHash } from 'node:crypto';

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { HttpError } from '@/lib/errors';

export type VerifiedIdentity = { subject: string; email: string | null };

/** Remote key sets are cached by jose and refreshed when Apple/Google rotate keys. */
export const jwks = {
  apple: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')) as JWTVerifyGetKey,
  google: createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
  ) as JWTVerifyGetKey,
};

const invalid = (provider: string) =>
  new HttpError(401, 'invalid_id_token', `${provider} sign-in could not be verified`);

export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Apple's checklist ("Verifying a user"): signature with Apple's public key, nonce,
 * iss = https://appleid.apple.com, aud = our client id (bundle id), not expired.
 * The app passed sha256(rawNonce) to Apple and sends rawNonce to us, so a stolen token
 * can't be replayed without the matching raw nonce.
 */
export async function verifyAppleIdToken(
  token: string,
  opts: { rawNonce: string; audiences: string[]; keys?: JWTVerifyGetKey },
): Promise<VerifiedIdentity> {
  if (opts.audiences.length === 0) throw new HttpError(500, 'misconfigured', 'Apple not set up');
  try {
    const { payload } = await jwtVerify(token, opts.keys ?? jwks.apple, {
      issuer: 'https://appleid.apple.com',
      audience: opts.audiences,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('missing sub');
    if (payload.nonce !== sha256Hex(opts.rawNonce)) throw new Error('nonce mismatch');
    return {
      subject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  } catch {
    throw invalid('Apple');
  }
}

/**
 * Google ID token: signature with Google's keys, iss is accounts.google.com, aud is our Web
 * client id, not expired. The email is only trusted when Google says it is verified.
 */
export async function verifyGoogleIdToken(
  token: string,
  opts: { audiences: string[]; keys?: JWTVerifyGetKey },
): Promise<VerifiedIdentity> {
  if (opts.audiences.length === 0) throw new HttpError(500, 'misconfigured', 'Google not set up');
  try {
    const { payload } = await jwtVerify(token, opts.keys ?? jwks.google, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: opts.audiences,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('missing sub');
    const email =
      typeof payload.email === 'string' && payload.email_verified === true ? payload.email : null;
    return { subject: payload.sub, email };
  } catch {
    throw invalid('Google');
  }
}
