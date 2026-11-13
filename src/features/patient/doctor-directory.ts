import type { DoctorDirectoryItem } from '../../types/domain';

export type DoctorFilters = { q?: string; specialty?: string; city?: string };
export type DoctorDirectoryResult = { doctors: DoctorDirectoryItem[]; specialties: string[] };
export const MAX_FILTER_LENGTH = 100;

export function normalizeDoctorFilters(filters: DoctorFilters): DoctorFilters {
  const cleaned: DoctorFilters = {};
  for (const key of ['q', 'specialty', 'city'] as const) {
    const value = filters[key]?.trim();
    if (value) {
      if (value.length > MAX_FILTER_LENGTH) throw new Error('Chaque filtre doit comporter 100 caractères maximum.');
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Contract shape: GET /doctors -> { doctors, specialties }; there is NO pagination. */
export function mapDoctorDirectory(payload: unknown): DoctorDirectoryResult {
  if (!payload || typeof payload !== 'object') throw new Error('Annuaire indisponible : réponse invalide.');
  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.doctors) || !Array.isArray(data.specialties)) {
    throw new Error('Annuaire indisponible : réponse invalide.');
  }
  const doctors: DoctorDirectoryItem[] = data.doctors.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Profil médical invalide.');
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()
      || typeof record.name !== 'string' || typeof record.specialty !== 'string'
      || !Array.isArray(record.modes) || !Array.isArray(record.availability)
      || typeof record.yearsOfExperience !== 'number'
      || typeof record.consultationFee !== 'number') {
      throw new Error('Profil médical invalide.');
    }
    return item as DoctorDirectoryItem;
  });
  if (!data.specialties.every(v => typeof v === 'string')) throw new Error('Spécialités invalides.');
  return { doctors, specialties: data.specialties as string[] };
}

export function doctorLocation(doctor: DoctorDirectoryItem): string {
  return doctor.professionalAddress?.trim() || doctor.serviceCity?.trim()
    || doctor.serviceDistricts?.join(', ') || 'Secteur non renseigné';
}

export function doctorRating(doctor: DoctorDirectoryItem): string {
  if (doctor.rating === null || !Number.isFinite(doctor.rating)) return 'Nouveau profil';
  return doctor.rating.toFixed(1).replace('.', ',') + ' (' + doctor.reviewsCount + ' avis)';
}

export function doctorModes(doctor: DoctorDirectoryItem): string[] {
  return doctor.modes.map(mode => mode === 'home' ? 'À domicile' : 'Téléconsultation');
}
