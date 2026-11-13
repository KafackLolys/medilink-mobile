import { apiRequest } from './http';
import type { BlockedDate, ConsultationMode, DoctorAppointment, WeeklyAvailability } from '@/types/domain';
const base = '/availabilities/me';
export const availabilitiesApi = {
  modes: (signal?: AbortSignal) => apiRequest<ConsultationMode[]>(base + '/modes', { signal }),
  setModes: (modes: ConsultationMode[], signal?: AbortSignal) =>
    apiRequest<ConsultationMode[]>(base + '/modes', { method: 'PUT', body: { modes }, signal }),
  duration: (signal?: AbortSignal) => apiRequest<{ durationMinutes: number }>(base + '/duration', { signal }),
  setDuration: (durationMinutes: number, signal?: AbortSignal) =>
    apiRequest<{ durationMinutes: number }>(base + '/duration', { method: 'PATCH', body: { durationMinutes }, signal }),
  weekly: (signal?: AbortSignal) => apiRequest<Array<WeeklyAvailability & { id: string }>>(base + '/weekly', { signal }),
  setWeekly: (data: WeeklyAvailability[], signal?: AbortSignal) =>
    apiRequest<Array<WeeklyAvailability & { id: string }>>(base + '/weekly', { method: 'PUT', body: data, signal }),
  blocked: (signal?: AbortSignal) => apiRequest<BlockedDate[]>(base + '/blocked', { signal }),
  createBlocked: (data: { date: string; reason?: string }, signal?: AbortSignal) =>
    apiRequest<BlockedDate>(base + '/blocked', { method: 'POST', body: data, signal }),
  deleteBlocked: (id: string, signal?: AbortSignal) =>
    apiRequest<void>(base + '/blocked/' + encodeURIComponent(id), { method: 'DELETE', signal }),
  appointments: (signal?: AbortSignal) => apiRequest<DoctorAppointment[]>(base + '/appointments', { signal }),
};
