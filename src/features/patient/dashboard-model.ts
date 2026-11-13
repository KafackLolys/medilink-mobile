import type { PatientAppointment, PatientNeed } from '../../types/domain';

const ACTIVE_NEEDS = new Set<PatientNeed['status']>(['published', 'awaiting_proposals', 'proposals_received']);
const UPCOMING_APPOINTMENTS = new Set<PatientAppointment['status']>(['pending_confirmation', 'confirmed']);

export const NEED_LABELS: Record<PatientNeed['status'], string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  awaiting_proposals: 'En attente de propositions',
  proposals_received: 'Propositions reçues',
  appointment_confirmed: 'Rendez-vous confirmé',
  closed: 'Clôturée',
  cancelled: 'Annulée',
};

export function patientOverview(
  needs: PatientNeed[] | null,
  appointments: PatientAppointment[] | null,
  now = Date.now(),
) {
  const active = needs?.filter(need => ACTIVE_NEEDS.has(need.status)) ?? null;
  const upcoming = appointments?.filter(appointment => {
    if (!UPCOMING_APPOINTMENTS.has(appointment.status)) return false;
    const scheduled = Date.parse(appointment.scheduledAt);
    return Number.isFinite(scheduled) && scheduled >= now;
  }).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)) ?? null;

  return {
    active,
    upcoming,
    nextAppointment: upcoming?.[0] ?? null,
    activeNeedsCount: active?.length ?? null,
    proposalsCount: active?.reduce((sum, need) => sum + (Number.isFinite(need.interested) ? need.interested : 0), 0) ?? null,
    upcomingCount: upcoming?.length ?? null,
  };
}

/** Only dates returned by the backend are displayed, without computing bookable slots. */
export function formatPatientDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Douala',
  }).format(new Date(parsed));
}

export function consultationLabel(mode: PatientAppointment['consultationMode']): string {
  return mode === 'home' ? 'À domicile' : 'Téléconsultation';
}
