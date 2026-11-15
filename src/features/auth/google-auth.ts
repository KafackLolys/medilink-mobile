import { Platform } from 'react-native';
import { authApi } from '@/services/auth';
import { activateLogin } from '@/features/auth/session';
import type { AuthenticatedUser, LoginResponse } from '@/types/domain';

/**
 * Native Google OAuth -> Firebase Identity Toolkit -> MediLink API.
 * The OAuth credential and the temporary account do not enter storage, URLs,
 * logging, or navigation params. Only a verified MediLink session is persisted.
 */
type FirebaseIdentity = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
};
type PendingGoogle = { identity: FirebaseIdentity; expiresAt: number };
let pending: PendingGoogle | null = null;
let configured = false;

function firebaseApiKey(): string {
  const value = process.env.EXPO_PUBLIC_FIREBASE_WEB_API_KEY?.trim();
  if (!value) throw new Error('Google est indisponible : clé publique Firebase non configurée.');
  return value;
}

async function nativeGoogle() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('La connexion Google native nécessite Android ou iOS.');
  }
  // Lazy loading prevents an unconfigured Expo Go environment from crashing at startup.
  const module = await import('@react-native-google-signin/google-signin');
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) throw new Error('Google est indisponible : identifiant OAuth Web non configuré.');
  if (!configured) {
    module.GoogleSignin.configure({ webClientId });
    configured = true;
  }
  return module;
}

function checkedIdentity(value: unknown): FirebaseIdentity {
  const data = value as Partial<FirebaseIdentity> | null;
  if (!data || typeof data.idToken !== 'string' || !data.idToken ||
    typeof data.refreshToken !== 'string' || !data.refreshToken ||
    typeof data.localId !== 'string' || !data.localId ||
    !Number.isFinite(Number(data.expiresIn)) || Number(data.expiresIn) <= 0) {
    throw new Error('Firebase a retourné une session Google incomplète.');
  }
  return data as FirebaseIdentity;
}

async function exchangeGoogleToken(googleIdToken: string, signal?: AbortSignal): Promise<FirebaseIdentity> {
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' +
    encodeURIComponent(firebaseApiKey());
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestUri: 'http://localhost',
      postBody: 'id_token=' + encodeURIComponent(googleIdToken) + '&providerId=google.com',
      returnSecureToken: true,
    }),
    signal,
  });
  if (!response.ok) {
    // Firebase details can include identifiers. Do not print or display raw payloads.
    throw new Error('Impossible de vérifier le compte Google avec Firebase. Vérifiez la configuration.');
  }
  return checkedIdentity(await response.json());
}

function loginResponse(identity: FirebaseIdentity, user: AuthenticatedUser): LoginResponse {
  if (user.id !== identity.localId) throw new Error('Identité Google et profil MediLink incohérents.');
  return {
    idToken: identity.idToken,
    refreshToken: identity.refreshToken,
    expiresIn: Number(identity.expiresIn),
    tokenType: 'Bearer',
    user,
  };
}

export function hasPendingGoogleRegistration(): boolean {
  if (pending && pending.expiresAt <= Date.now()) pending = null;
  return pending !== null;
}

export async function startGoogleSignIn(signal?: AbortSignal): Promise<'authenticated' | 'needs-role' | 'cancelled'> {
  pending = null;
  const { GoogleSignin } = await nativeGoogle();
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') return 'cancelled';
  const googleToken = result.data.idToken;
  if (!googleToken) throw new Error('Google n’a pas fourni de jeton d’identité. Vérifiez le client OAuth Web.');
  if (signal?.aborted) return 'cancelled';
  const identity = await exchangeGoogleToken(googleToken, signal);
  const status = await authApi.googleStatus(identity.idToken, signal);
  if (signal?.aborted) return 'cancelled';
  if (status.registered) {
    await activateLogin(loginResponse(identity, status.user), signal);
    return 'authenticated';
  }
  pending = {
    identity,
    expiresAt: Date.now() + Math.min(5 * 60_000, Math.max(10_000, Number(identity.expiresIn) * 1000 - 60_000)),
  };
  return 'needs-role';
}

export async function finishGoogleRegistration(role: 'patient' | 'doctor', signal?: AbortSignal): Promise<void> {
  if (!hasPendingGoogleRegistration() || !pending) {
    throw new Error('La session Google a expiré. Recommencez la connexion.');
  }
  if (role !== 'patient' && role !== 'doctor') throw new Error('Choisissez Patient ou Médecin.');
  const identity = pending.identity;
  const result = await authApi.googleComplete(identity.idToken, role, signal);
  pending = null;
  await activateLogin(loginResponse(identity, result.user), signal);
}

export async function cancelPendingGoogleRegistration() {
  pending = null;
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const { GoogleSignin } = await nativeGoogle();
      await GoogleSignin.signOut();
    }
  } catch {
    // App logout remains authoritative even if the provider is unavailable.
  }
}

export function describeGoogleError(error: unknown): string {
  const value = error as { code?: string; kind?: string; message?: string } | null;
  if (value?.kind === 'network' || value?.kind === 'timeout') {
    return 'Vérifiez votre connexion Internet et réessayez.';
  }
  if (value?.code === '12501' || value?.code === 'SIGN_IN_CANCELLED') return '';
  if (value?.message && /Google est indisponible|session Google a expiré|Impossible de vérifier le compte Google|jeton d’identité/i.test(value.message)) {
    return value.message;
  }
  return 'Connexion Google impossible pour le moment. Réessayez ou utilisez votre e-mail.';
}
