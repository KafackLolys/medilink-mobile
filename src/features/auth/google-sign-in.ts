import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { authApi } from '@/services/auth';
import { activateLogin } from '@/features/auth/session';
import type { LoginResponse } from '@/types/domain';

/**
 * MediLink uses Google's native Android account chooser, then exchanges its
 * Google ID token for Firebase Authentication credentials via the documented
 * identitytoolkit signInWithIdp endpoint.
 *
 * The backend verifies the resulting FIREBASE ID token and owns all role
 * decisions. No Google token is ever passed through a route or persisted before
 * the account's role is confirmed by the API.
 */
type FirebaseIdentity = {
  idToken: string;
  refreshToken: string;
  localId: string;
  expiresIn: number;
};

let pendingIdentity: FirebaseIdentity | null = null;

function publicGoogleConfig() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!apiKey || !webClientId) {
    throw new Error('Connexion Google non configurée : vérifiez la configuration Firebase Android.');
  }
  return { apiKey, webClientId };
}

function validIdentity(value: unknown): FirebaseIdentity {
  if (!value || typeof value !== 'object') throw Error('Réponse Firebase invalide.');
  const data = value as Record<string, unknown>;
  const expiresIn = Number(data.expiresIn);
  if (typeof data.idToken !== 'string' || !data.idToken ||
      typeof data.refreshToken !== 'string' || !data.refreshToken ||
      typeof data.localId !== 'string' || !data.localId ||
      !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw Error('Session Firebase incomplète.');
  }
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    expiresIn,
  };
}

async function firebaseFromGoogle(googleIdToken: string, apiKey: string): Promise<FirebaseIdentity> {
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' +
    encodeURIComponent(apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      postBody: new URLSearchParams({ id_token: googleIdToken, providerId: 'google.com' }).toString(),
      requestUri: 'http://localhost',
      returnSecureToken: true,
      returnIdpCredential: false,
    }),
  });
  if (!response.ok) {
    // Google/Firebase error codes can be diagnostic, but never leak credentials.
    if (response.status === 400 || response.status === 409) {
      throw new Error('Ce compte Google ne peut pas être associé automatiquement. Vérifiez la configuration ou contactez le support.');
    }
    throw new Error('Service de connexion Google temporairement indisponible.');
  }
  return validIdentity(await response.json());
}

function toLoginResponse(identity: FirebaseIdentity, user: LoginResponse['user']): LoginResponse {
  if (identity.localId !== user.id) throw new Error('Identité Google et profil MediLink incohérents.');
  return {
    user,
    idToken: identity.idToken,
    refreshToken: identity.refreshToken,
    expiresIn: identity.expiresIn,
    tokenType: 'Bearer',
  };
}

export function hasPendingGoogleRegistration() {
  return pendingIdentity !== null;
}

export async function discardPendingGoogleRegistration() {
  pendingIdentity = null;
  try { await GoogleSignin.signOut(); }
  catch { /* The Firebase session is not activated yet. */ }
}

export type GoogleSignInOutcome = 'cancelled' | 'needs_role' | 'authenticated';

/** Start only on a direct button press in an installed Android/iOS dev build. */
export async function beginGoogleSignIn(): Promise<GoogleSignInOutcome> {
  pendingIdentity = null;
  const { apiKey, webClientId } = publicGoogleConfig();
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const choice = await GoogleSignin.signIn();
  if (!isSuccessResponse(choice)) return 'cancelled';
  const googleIdToken = choice.data.idToken;
  if (!googleIdToken) throw new Error('Jeton Google manquant. Vérifiez le client OAuth Android et les empreintes SHA.');
  const identity = await firebaseFromGoogle(googleIdToken, apiKey);
  const status = await authApi.googleStatus(identity.idToken);
  if (!status.registered) {
    pendingIdentity = identity;
    return 'needs_role';
  }
  await activateLogin(toLoginResponse(identity, status.user));
  return 'authenticated';
}

/** Complete only with a server-allowed public role. Admin is never selectable. */
export async function finishGoogleRegistration(role: 'patient' | 'doctor'): Promise<void> {
  if (role !== 'patient' && role !== 'doctor') throw Error('Profil Google invalide.');
  const identity = pendingIdentity;
  if (!identity) throw Error('La connexion Google doit être relancée.');
  try {
    const result = await authApi.googleComplete(identity.idToken, role);
    await activateLogin(toLoginResponse(identity, result.user));
    pendingIdentity = null;
  } catch (error) {
    // In case registration succeeded but the response was lost, sign in through
    // the authoritative status endpoint; never create a duplicate profile.
    const statusCode = (error as { status?: number } | null)?.status;
    if (statusCode === 409) {
      const current = await authApi.googleStatus(identity.idToken);
      if (current.registered) {
        await activateLogin(toLoginResponse(identity, current.user));
        pendingIdentity = null;
        return;
      }
    }
    throw error;
  }
}
