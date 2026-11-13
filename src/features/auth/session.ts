import { SessionManager } from './session-manager';
import { secureSessionStorage } from './secure-storage';
import { authApi } from '@/services/auth';
import { apiRequest, configureHttpAuth, resetHttpAuth } from '@/services/http';
import { useNavigationSession } from '@/store/navigation-session';
import type { AuthenticatedUser, LoginResponse } from '@/types/domain';
import { unregisterPushDevice } from '@/features/notifications/push-device';

/**
 * Authenticated HTTP profile/logout requests use explicit credentials so the
 * refresh route never recursively triggers its own 401 interceptor.
 */
export const sessionManager = new SessionManager({
  storage: secureSessionStorage,
  endpoints: {
    refresh: refreshToken => authApi.refresh(refreshToken),
    profile: idToken => apiRequest<{ user: AuthenticatedUser }>('/auth/profile', {
      authenticated: false,
      headers: { Authorization: 'Bearer ' + idToken },
    }),
    logout: idToken => apiRequest('/auth/logout', {
      method: 'POST', authenticated: false,
      headers: { Authorization: 'Bearer ' + idToken },
    }),
  },
  hooks: {
    publish: session => useNavigationSession.setState({ session }),
    purge: () => {
      // No persisted medical cache exists yet. Future caches must register
      // a purge handler here rather than survive a change of patient.
    },
  },
});

configureHttpAuth({
  getAccessToken: () => sessionManager.validAccessToken(),
  getSessionKey: () => sessionManager.sessionKey,
  onUnauthorized: token => sessionManager.onUnauthorized(token),
  onRetryUnauthorized: token => sessionManager.invalidateRejectedToken(token),
});

export function activateLogin(response: LoginResponse, signal?: AbortSignal) {
  return sessionManager.login(response, signal);
}

export function restoreSession() {
  return sessionManager.bootstrap();
}

export async function logoutSession() {
  // Attempt server-side device revocation BEFORE SecureStore credentials are erased.
  // If offline, local logout still wins; see the documented backend revocation gap.
  try { await unregisterPushDevice(); } catch { /* Do not block local logout. */ }
  await sessionManager.logout();
}

export async function clearEphemeralSession() {
  await sessionManager.clear();
}

/** Used only if auth runtime is ever completely torn down. */
export function teardownAuthBindings() {
  resetHttpAuth();
}
