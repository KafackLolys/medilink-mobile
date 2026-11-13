import { create } from 'zustand';
import type { AccountRole } from '@/types/api';

/**
 * Navigation-only state published exclusively by SessionManager after API
 * verification. No development bypass or user-controlled role setter.
 */
export type NavigationSession =
  | { status: 'loading'; role: null }
  | { status: 'unauthenticated'; role: null }
  | { status: 'authenticated'; role: AccountRole };

type SessionState = {
  session: NavigationSession;
};

/** Never set an authenticated role from a URL, input, or local flag. */
export const useNavigationSession = create<SessionState>(() => ({
  session: { status: 'loading', role: null },
}));

export function roleHome(role: AccountRole): '/patient' | '/medecin' | '/admin' {
  switch (role) {
    case 'patient': return '/patient';
    case 'doctor': return '/medecin';
    case 'admin': return '/admin';
  }
}
