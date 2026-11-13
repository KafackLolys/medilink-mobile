import { apiRequest } from './http';
import type { AuthenticatedUser, LoginResponse, RegisterRequest } from '@/types/domain';

export const authApi = {
  login: (email: string, password: string, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', authenticated: false, body: { email, password }, signal }),
  register: (data: RegisterRequest, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/register', { method: 'POST', authenticated: false, body: data, signal }),
  refresh: (refreshToken: string, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/refresh', { method: 'POST', authenticated: false, body: { refreshToken }, signal }),
  profile: (signal?: AbortSignal) => apiRequest<{ user: AuthenticatedUser; patient?: unknown }>('/auth/profile', { signal }),
  updateAdminProfile: (data: { firstName: string; lastName: string; phone: string }, signal?: AbortSignal) =>
    apiRequest<{ user: AuthenticatedUser }>('/auth/admin/profile', { method: 'PATCH', body: data, signal }),
  logout: (signal?: AbortSignal) => apiRequest<void>('/auth/logout', { method: 'POST', signal }),
  resetPassword: (data: { email: string }, signal?: AbortSignal) =>
    apiRequest<unknown>('/auth/reset-password', { method: 'POST', authenticated: false, body: data, signal }),
};
