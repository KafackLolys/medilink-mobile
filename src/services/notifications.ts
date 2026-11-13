import { apiRequest } from './http';
import type { NotificationPage } from '@/types/domain';
export type RegisterDeviceRequest = { deviceId: string; token: string; platform: 'web' | 'mobile'; userAgent?: string };
export const notificationsApi = {
  list: (page: number, pageSize: number, signal?: AbortSignal) =>
    apiRequest<NotificationPage>('/notifications', { query: { page, pageSize }, signal }),
  read: (id: string, signal?: AbortSignal) =>
    apiRequest<{ id: string; readAt: string }>('/notifications/' + encodeURIComponent(id) + '/read', { method: 'PATCH', signal }),
  readAll: (signal?: AbortSignal) => apiRequest<{ updated: number }>('/notifications/read-all', { method: 'PATCH', signal }),
  register: (body: RegisterDeviceRequest, signal?: AbortSignal) =>
    apiRequest<{ deviceId: string; platform: 'web' | 'mobile' }>('/notifications/devices', { method: 'POST', body, signal }),
  unregister: (deviceId: string, signal?: AbortSignal) =>
    apiRequest<{ removed: boolean }>('/notifications/devices/' + encodeURIComponent(deviceId) + '/unregister', { method: 'POST', signal }),
};
