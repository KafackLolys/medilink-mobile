import { authApi } from '@/services/auth';
import { configureHttpAuth, resetHttpAuth } from '@/services/http';
import { useNavigationSession } from '@/store/navigation-session';
import type { LoginResponse } from '@/types/domain';

/**
 * Short-lived in-memory session for prompt 06 only.
 * No persistence, refresh rotation or secure storage until prompt 07.
 * Never expose tokens to URL parameters, console or component state.
 */
let token: string | null = null;
let generation = 0;

export function clearEphemeralSession() {
  generation += 1;
  token = null;
  resetHttpAuth();
  useNavigationSession.setState({ session: { status: 'unauthenticated', role: null } });
}

export async function activateLogin(response: LoginResponse, signal?: AbortSignal) {
  if (!response.idToken || !response.refreshToken || !response.user?.id) {
    throw new Error('Réponse de connexion incomplète.');
  }
  const attempt = ++generation;
  token = response.idToken;
  configureHttpAuth({
    getAccessToken: () => token,
    onUnauthorized: () => clearEphemeralSession(),
  });
  try {
    // Never grant a role from local parameters: revalidate with NestJS.
    const profile = await authApi.profile(signal);
    if (signal?.aborted) {
      if (attempt === generation) clearEphemeralSession();
      return;
    }
    if (attempt !== generation) return;
    if (profile.user.id !== response.user.id ||
      !['patient', 'doctor', 'admin'].includes(profile.user.role) ||
      profile.user.status === 'suspended' || profile.user.status === 'deleted') {
      throw new Error('Profil de connexion non autorisé.');
    }
    useNavigationSession.setState({
      session: { status: 'authenticated', role: profile.user.role },
    });
  } catch (error) {
    if (attempt === generation) clearEphemeralSession();
    throw error;
  }
}
