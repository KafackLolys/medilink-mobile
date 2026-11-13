import { apiRequest } from './http';
import type { AppointmentStatus, CreateAppointmentRequest, DoctorAppointment, PatientAppointment } from '@/types/domain';
export const appointmentsApi = {
  list: (signal?: AbortSignal) => apiRequest<PatientAppointment[]>('/appointments', { signal }),
  doctor: (signal?: AbortSignal) => apiRequest<DoctorAppointment[]>('/appointments/doctor', { signal }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<PatientAppointment>('/appointments/' + encodeURIComponent(id), { signal }),
  create: (data: CreateAppointmentRequest, signal?: AbortSignal) =>
    apiRequest<{ id: string; status: AppointmentStatus }>('/appointments', { method: 'POST', body: data, signal }),
  updateStatus: (id: string, status: AppointmentStatus, signal?: AbortSignal) =>
    apiRequest<{ id: string; status: AppointmentStatus }>('/appointments/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: { status }, signal }),
  review: (id: string, signal?: AbortSignal) => apiRequest<unknown>('/appointments/' + encodeURIComponent(id) + '/review', { signal }),
  submitReview: (id: string, data: { rating: number; comment?: string | null }, signal?: AbortSignal) =>
    apiRequest<unknown>('/appointments/' + encodeURIComponent(id) + '/review', { method: 'POST', body: data, signal }),
};
