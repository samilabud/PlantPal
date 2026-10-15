import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export const isAppleSignInAvailable = async () =>
  Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());

/**
 * Native Sign in with Apple. We give Apple sha256(rawNonce); Apple signs it into the identity
 * token; we send rawNonce to our server, which hashes it and compares. A token stolen in
 * transit is useless without the raw nonce, and each nonce is used once.
 * Returns null when the user cancels.
 */
export async function appleCredential() {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    {
      encoding: Crypto.CryptoEncoding.HEX,
    },
  );
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple returned no identity token');
    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      email: credential.email,
      rawNonce,
    };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}
