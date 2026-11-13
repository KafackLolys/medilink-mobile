import { apiRequest, makeMultipart, type NativeUploadFile } from './http';
import type { DoctorDirectoryItem, DoctorDocument, DoctorOwnProfile } from '@/types/domain';
export const doctorsApi = {
  list: (filters: { q?: string; specialty?: string; city?: string } = {}, signal?: AbortSignal) =>
    apiRequest<{ doctors: DoctorDirectoryItem[]; specialties: string[] }>('/doctors', { query: filters, signal }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<DoctorDirectoryItem>('/doctors/' + encodeURIComponent(id), { signal }),
  me: (signal?: AbortSignal) => apiRequest<DoctorOwnProfile>('/doctors/me', { signal }),
  reviews: (signal?: AbortSignal) => apiRequest<unknown[]>('/doctors/me/reviews', { signal }),
  update: (data: { bio?: string; yearsOfExperience?: number; consultationFee?: number; professionalAddress?: string | null }, signal?: AbortSignal) =>
    apiRequest<DoctorOwnProfile>('/doctors/me', { method: 'PATCH', body: data, signal }),
  uploadDocument: (file: NativeUploadFile, type: DoctorDocument['name'], signal?: AbortSignal) =>
    apiRequest<DoctorDocument>('/doctors/me/documents', { method: 'POST', formData: makeMultipart({ type }, [{ field: 'file', file }]), signal }),
  deleteDocument: (id: string, signal?: AbortSignal) =>
    apiRequest<void>('/doctors/me/documents/' + encodeURIComponent(id), { method: 'DELETE', signal }),
};
