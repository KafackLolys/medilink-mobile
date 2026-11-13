import { apiRequest, makeMultipart, type NativeUploadFile } from './http';
import type { PatientCondition, PatientDocument } from '@/types/domain';
export type PatientDocumentType = 'prescription' | 'lab_result' | 'medical_report' | 'imaging' | 'other';
export const patientsApi = {
  conditions: (signal?: AbortSignal) => apiRequest<PatientCondition[]>('/patients/me/conditions', { signal }),
  documents: (signal?: AbortSignal) => apiRequest<PatientDocument[]>('/patients/me/documents', { signal }),
  uploadDocument: (file: NativeUploadFile, type: PatientDocumentType, title?: string, signal?: AbortSignal) =>
    apiRequest<PatientDocument>('/patients/me/documents', { method: 'POST',
      formData: makeMultipart({ type, ...(title ? { title } : {}) }, [{ field: 'file', file }]), signal }),
  deleteDocument: (id: string, signal?: AbortSignal) =>
    apiRequest<void>('/patients/me/documents/' + encodeURIComponent(id), { method: 'DELETE', signal }),
};
