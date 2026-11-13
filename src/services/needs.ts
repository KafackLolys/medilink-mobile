import { apiRequest, makeMultipart, type NativeUploadFile } from './http';
import type { DoctorNeed, DoctorProposal, NeedDetail, PatientNeed, Page } from '@/types/domain';
export type CreateNeedRequest = {
  title: string; specialty: string; description: string; symptoms: string[]; since?: string;
  city: string; district: string; address?: string; priority: 'normal' | 'rapide' | 'urgence';
  mode: 'domicile' | 'tele'; consent: boolean;
};
export type DoctorProposalRequest = {
  message: string; proposedAppointmentAt: string; consultationMode: 'home' | 'teleconsultation'; fee: number; details?: string;
};
export const needsApi = {
  list: (signal?: AbortSignal) => apiRequest<PatientNeed[]>('/needs', { signal }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<NeedDetail>('/needs/' + encodeURIComponent(id), { signal }),
  create: (data: CreateNeedRequest, files: NativeUploadFile[] = [], signal?: AbortSignal) =>
    apiRequest<PatientNeed>('/needs', { method: 'POST',
      formData: makeMultipart({ data: JSON.stringify(data) }, files.map(file => ({ field: 'files', file }))), signal }),
  update: (id: string, data: { title: string; specialty: string; description: string; mode: 'domicile' | 'tele' }, signal?: AbortSignal) =>
    apiRequest<NeedDetail>('/needs/' + encodeURIComponent(id), { method: 'PATCH', body: data, signal }),
  close: (id: string, signal?: AbortSignal) => apiRequest<{ message: string }>('/needs/' + encodeURIComponent(id) + '/close', { method: 'PATCH', signal }),
  delete: (id: string, signal?: AbortSignal) => apiRequest<{ message: string }>('/needs/' + encodeURIComponent(id), { method: 'DELETE', signal }),
  doctor: (query: { q?: string; specialty?: string; priority?: string; mode?: string; page?: number; pageSize?: number } = {}, signal?: AbortSignal) =>
    apiRequest<Page<DoctorNeed> & { specialties: string[] }>('/needs/doctor', { query, signal }),
  doctorDetail: (id: string, signal?: AbortSignal) => apiRequest<NeedDetail>('/needs/doctor/' + encodeURIComponent(id), { signal }),
  proposals: (query: { status?: string; page?: number; pageSize?: number } = {}, signal?: AbortSignal) =>
    apiRequest<Page<DoctorProposal> & { counts: Record<string, number> }>('/needs/doctor/proposals', { query, signal }),
  propose: (id: string, data: DoctorProposalRequest, signal?: AbortSignal) =>
    apiRequest<{ id: string }>('/needs/doctor/' + encodeURIComponent(id) + '/proposals', { method: 'POST', body: data, signal }),
  cancelProposal: (id: string, signal?: AbortSignal) =>
    apiRequest<unknown>('/needs/doctor/proposals/' + encodeURIComponent(id) + '/cancel', { method: 'PATCH', signal }),
};
