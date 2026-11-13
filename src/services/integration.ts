import { apiRequest } from './http';
import type { ContactMessage, DoctorZoneSettings } from '@/types/domain';
export const integrationApi = {
  doctorZone: (signal?: AbortSignal) => apiRequest<DoctorZoneSettings>('/integration/doctor/zone', { signal }),
  saveDoctorZone: (data: DoctorZoneSettings, signal?: AbortSignal) =>
    apiRequest<DoctorZoneSettings>('/integration/doctor/zone', { method: 'PUT', body: data, signal }),
  savePatientProfile: (data: { name: string; phone: string; bloodType: string; city: string; district: string }, signal?: AbortSignal) =>
    apiRequest<{ saved: boolean }>('/integration/patient/profile', { method: 'PATCH', body: data, signal }),
  contact: (data: ContactMessage, signal?: AbortSignal) =>
    apiRequest<{ id: string }>('/integration/contact', { method: 'POST', authenticated: false, body: data, signal }),
};
