import type { DoctorDirectoryItem, PatientAppointment } from '../../types/domain';
import { mapDoctorDirectory, doctorLocation, doctorModes } from './doctor-directory.ts';

export const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

/**
 * Strictly whitelist fields the verified public doctor endpoint actually returns.
 * Never expose profile documents, phone, e-mail, registration numbers or patient information.
 */
export function mapPublicDoctor(payload: unknown): DoctorDirectoryItem {
  const { doctors } = mapDoctorDirectory({ doctors: [payload], specialties: [] });
  const doctor = doctors[0];
  if (!doctor || !doctor.id) throw new Error('Profil du médecin indisponible.');
  const candidate = payload as Record<string, unknown>;
  return {
    id: doctor.id, name: doctor.name, specialty: doctor.specialty,
    bio: typeof candidate.bio === 'string' ? candidate.bio : '',
    yearsOfExperience: doctor.yearsOfExperience,
    consultationFee: doctor.consultationFee,
    currency: typeof candidate.currency === 'string' ? candidate.currency : 'XAF',
    professionalAddress: typeof candidate.professionalAddress === 'string' ? candidate.professionalAddress : null,
    serviceCity: typeof candidate.serviceCity === 'string' ? candidate.serviceCity : null,
    serviceDistricts: Array.isArray(candidate.serviceDistricts)
      ? candidate.serviceDistricts.filter((v): v is string => typeof v === 'string') : [],
    blockedDates: Array.isArray(candidate.blockedDates)
      ? candidate.blockedDates.filter((v): v is string => typeof v === 'string') : [],
    appointmentDurationMinutes: typeof candidate.appointmentDurationMinutes === 'number'
      ? candidate.appointmentDurationMinutes : undefined,
    modes: doctor.modes.filter(m => m === 'home' || m === 'teleconsultation'),
    availability: doctor.availability.filter(slot => slot && typeof slot === 'object'
      && typeof slot.weekday === 'string' && typeof slot.startTime === 'string'
      && typeof slot.endTime === 'string' && slot.isAvailable === true),
    rating: typeof candidate.rating === 'number' && Number.isFinite(candidate.rating)
      ? candidate.rating : null,
    reviewsCount: typeof candidate.reviewsCount === 'number' && Number.isFinite(candidate.reviewsCount)
      ? candidate.reviewsCount : 0,
  };
}

export function doctorPublicSummary(doctor: DoctorDirectoryItem) {
  const weekly = doctor.availability
    .filter(slot => slot.isAvailable)
    .map(slot => `${DAYS[slot.weekday] ?? slot.weekday} · ${slot.startTime}–${slot.endTime}`);
  return {
    location: doctorLocation(doctor),
    modes: doctorModes(doctor),
    weekly,
    price: `${new Intl.NumberFormat('fr-FR').format(doctor.consultationFee)} ${doctor.currency}`,
    rating: doctor.rating === null ? 'Pas encore d’avis'
      : `${doctor.rating.toFixed(1).replace('.', ',')} / 5 · ${doctor.reviewsCount} avis`,
    canOpenBooking: doctor.modes.length > 0 && weekly.length > 0,
  };
}

/** Only own completed appointments may be linked to review. Server verifies eligibility. */
export function completedDoctorAppointments(items: PatientAppointment[], doctorId: string): PatientAppointment[] {
  return items.filter(a => a.doctor.id === doctorId && a.status === 'completed')
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}
