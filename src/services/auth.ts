import { apiRequest } from './http';
import type { AuthenticatedUser, LoginResponse, RegisterRequest } from '@/types/domain';
import type { PatientProfileData } from '@/features/patient/patient-medical-profile';

export const authApi = {
  login: (email: string, password: string, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', authenticated: false, body: { email, password }, signal }),
  register: (data: RegisterRequest, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/register', { method: 'POST', authenticated: false, body: data, signal }),
  refresh: (refreshToken: string, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/auth/refresh', { method: 'POST', authenticated: false, body: { refreshToken }, signal }),
  profile: (signal?: AbortSignal) => apiRequest<PatientProfileData>('/auth/profile', { signal }),
  updateAdminProfile: (data: { firstName: string; lastName: string; phone: string }, signal?: AbortSignal) =>
    apiRequest<{ user: AuthenticatedUser }>('/auth/admin/profile', { method: 'PATCH', body: data, signal }),
  logout: (signal?: AbortSignal) => apiRequest<void>('/auth/logout', { method: 'POST', signal }),
  resetPassword: (data: { email: string }, signal?: AbortSignal) =>
    apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', authenticated: false, body: data, signal }),
};
