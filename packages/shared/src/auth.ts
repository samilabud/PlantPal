import { z } from 'zod';

export const AuthProvider = z.enum(['apple', 'google', 'dev']);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const Me = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  plan: z.enum(['free', 'premium']),
  providers: z.array(AuthProvider),
});
export type Me = z.infer<typeof Me>;

export const AuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** ISO time the access token expires. The client refreshes a little before it. */
  accessTokenExpiresAt: z.iso.datetime(),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const SessionResponse = z.object({ tokens: AuthTokens, user: Me });
export type SessionResponse = z.infer<typeof SessionResponse>;

export const AppleSignInRequest = z.object({
  identityToken: z.string().min(1),
  /** The random nonce before hashing. Apple put sha256(rawNonce) inside the token. */
  rawNonce: z.string().min(16),
  /** Apple only sends the email on the first sign-in, so the app forwards it. */
  email: z.email().nullish(),
});
export type AppleSignInRequest = z.infer<typeof AppleSignInRequest>;

export const GoogleSignInRequest = z.object({ idToken: z.string().min(1) });
export type GoogleSignInRequest = z.infer<typeof GoogleSignInRequest>;

export const DevSignInRequest = z.object({
  /** Any label, e.g. "maestro". The same label always signs into the same test user. */
  name: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .default('dev'),
});
export type DevSignInRequest = z.infer<typeof DevSignInRequest>;

export const RefreshRequest = z.object({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.infer<typeof RefreshRequest>;

export const RefreshResponse = z.object({ tokens: AuthTokens });
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const LogoutRequest = z.object({ refreshToken: z.string().min(1) });
export type LogoutRequest = z.infer<typeof LogoutRequest>;

export const DeleteAccountRequest = z.object({
  /** Fresh Apple authorization code, so the server can revoke the Apple grant. */
  appleAuthorizationCode: z.string().min(1).optional(),
  /** The app's bundle id: Apple requires the same client_id that the code was issued to. */
  appleClientId: z.string().min(1).optional(),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequest>;

export const DeleteAccountResponse = z.object({
  deleted: z.literal(true),
  appleRevoked: z.boolean(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponse>;

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;
