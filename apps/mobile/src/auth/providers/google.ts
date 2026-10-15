import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

let configured = false;

/** Configured only when the client ids exist, so the app still runs before Google is set up. */
export function isGoogleSignInConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    // The *Web* client id: Google issues the ID token for this audience, and our server checks it.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

/** Returns the Google ID token, or null when the user cancels. */
export async function googleIdToken(): Promise<string | null> {
  configure();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    if (!response.data.idToken) throw new Error('Google returned no ID token');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) return null;
    throw error;
  }
}

export async function googleSignOut(options: { revoke: boolean }) {
  if (!isGoogleSignInConfigured()) return;
  configure();
  try {
    if (options.revoke) await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google on this device: nothing to undo.
  }
}
