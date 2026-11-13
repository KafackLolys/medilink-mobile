/** Shared transport-level types; domain DTOs belong to each feature. */
export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export type AccountRole = 'patient' | 'doctor' | 'admin';
