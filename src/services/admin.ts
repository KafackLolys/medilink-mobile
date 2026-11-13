import { apiRequest } from './http';
import type { AccountStatus, AdminAccount, DoctorVerificationStatus, Page } from '@/types/domain';
export const adminApi = {
  accounts: (role: 'patient' | 'doctor', page: number, pageSize: number, q = '', signal?: AbortSignal) =>
    apiRequest<Page<AdminAccount>>('/admin/accounts', { query: { role, page, pageSize, q }, signal }),
  updateStatus: (id: string, status: AccountStatus, signal?: AbortSignal) =>
    apiRequest<{ id: string; status: AccountStatus }>('/admin/accounts/' + encodeURIComponent(id) + '/status',
      { method: 'PATCH', body: { status }, signal }),
  verification: (id: string, data: { emailVerified: boolean } | { verificationStatus: DoctorVerificationStatus }, signal?: AbortSignal) =>
    apiRequest<{ id: string; emailVerified?: boolean; verificationStatus?: DoctorVerificationStatus }>('/admin/accounts/' + encodeURIComponent(id) + '/verification',
      { method: 'PATCH', body: data, signal }),
  createAdmin: (data: { firstName: string; lastName: string; email: string; password: string; phone?: string }, signal?: AbortSignal) =>
    apiRequest<AdminAccount>('/admin/admins', { method: 'POST', body: data, signal }),
};
