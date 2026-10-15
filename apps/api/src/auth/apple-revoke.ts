import { importPKCS8, SignJWT } from 'jose';

type AppleKeyConfig = { teamId: string; keyId: string; privateKey: string };

/**
 * Apple's client_secret is a short-lived ES256 JWT signed with our .p8 key
 * (iss = Team ID, sub = client id, aud = https://appleid.apple.com, max 6 months).
 */
export async function createAppleClientSecret(cfg: AppleKeyConfig, clientId: string) {
  const key = await importPKCS8(cfg.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/**
 * Account deletion with Sign in with Apple: exchange a fresh authorization code for a refresh
 * token (POST /auth/token), then revoke it (POST /auth/revoke). This removes PlantPal from the
 * user's "Apps using Apple ID" list. Returns false instead of throwing: the account is deleted
 * on our side either way.
 */
export async function revokeAppleGrant(
  authorizationCode: string,
  opts: { cfg: AppleKeyConfig; clientId: string; fetchFn?: typeof fetch },
): Promise<boolean> {
  const fetchFn = opts.fetchFn ?? fetch;
  try {
    const clientSecret = await createAppleClientSecret(opts.cfg, opts.clientId);
    const form = (fields: Record<string, string>) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });

    const tokenRes = await fetchFn(
      'https://appleid.apple.com/auth/token',
      form({
        client_id: opts.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    );
    if (!tokenRes.ok) return false;
    const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return false;

    const revokeRes = await fetchFn(
      'https://appleid.apple.com/auth/revoke',
      form({
        client_id: opts.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
      }),
    );
    return revokeRes.ok;
  } catch (error) {
    console.error('Apple revoke failed', error);
    return false;
  }
}
