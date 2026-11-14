import type {
  DoctorAppointment, DoctorNeed, DoctorOwnProfile, DoctorProposal, DoctorVerificationStatus,
  WeeklyAvailability, BlockedDate, Conversation, Page,
} from '../../types/domain';

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; reason: 'network' | 'restricted' | 'unknown' }
  | { status: 'restricted' }
  | { status: 'success'; value: T };

export type DoctorDashboardData = {
  profile: Resource<DoctorOwnProfile>;
  needs: Resource<Page<DoctorNeed>>;
  proposals: Resource<Page<DoctorProposal> & { counts: Record<string, number> }>;
  appointments: Resource<DoctorAppointment[]>;
  weekly: Resource<Array<WeeklyAvailability & { id: string }>>;
  blocked: Resource<BlockedDate[]>;
  conversations: Resource<Conversation[]>;
};

export function initialDoctorDashboard(): DoctorDashboardData {
  return {
    profile: { status: 'loading' }, needs: { status: 'loading' },
    proposals: { status: 'loading' }, appointments: { status: 'loading' },
    weekly: { status: 'loading' }, blocked: { status: 'loading' },
    conversations: { status: 'loading' },
  };
}

export const DOCTOR_VERIFICATION_LABELS: Record<DoctorVerificationStatus, string> = {
  pending: 'Validation du profil en attente',
  verified: 'Médecin vérifié',
  rejected: 'Vérification refusée',
  suspended: 'Profil professionnel suspendu',
};

export function doctorCanAccessPatientNeeds(status: DoctorVerificationStatus | undefined): boolean {
  return status === 'verified';
}

export function doctorGateMessage(status: DoctorVerificationStatus): string {
  switch (status) {
    case 'pending':
      return 'Votre profil professionnel est en cours de validation. Les demandes et propositions sont accessibles après vérification.';
    case 'rejected':
      return 'La vérification du profil a été refusée. Consultez vos justificatifs et contactez l’assistance.';
    case 'suspended':
      return 'Votre profil professionnel est suspendu. Les demandes et propositions restent indisponibles.';
    case 'verified':
      return 'Votre profil professionnel est vérifié.';
  }
}

export function doctorErrorReason(error: unknown): 'network' | 'restricted' | 'unknown' {
  const e = error as { kind?: string; status?: number } | null;
  if (e?.status === 401 || e?.status === 403) return 'restricted';
  if (e?.kind === 'timeout' || e?.kind === 'network') return 'network';
  return 'unknown';
}

export function parseDoctorProfile(raw: unknown): DoctorOwnProfile {
  if (!raw || typeof raw !== 'object') throw new Error('Profil invalide');
  const value = raw as Partial<DoctorOwnProfile>;
  if (typeof value.id !== 'string' || !value.id
    || typeof value.name !== 'string'
    || typeof value.specialty !== 'string'
    || !['pending','verified','rejected','suspended'].includes(value.verificationStatus ?? '')
    || !Array.isArray(value.documents)) throw new Error('Profil invalide');
  return value as DoctorOwnProfile;
}

export function parsePage<T>(raw: unknown): Page<T> {
  if (!raw || typeof raw !== 'object') throw new Error('Page invalide');
  const value = raw as Partial<Page<T>>;
  if (!Array.isArray(value.items) || !Number.isSafeInteger(value.total)
    || (value.total ?? -1) < 0 || !Number.isSafeInteger(value.page)
    || !Number.isSafeInteger(value.pageSize) || !Number.isSafeInteger(value.totalPages)) {
    throw new Error('Page invalide');
  }
  return value as Page<T>;
}

/** Business appointment fields are returned as YYYY-MM-DD and HH:mm by NestJS. */
export function cameroonClock(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const OPEN_STATUSES = new Set<DoctorAppointment['status']>(['pending_confirmation', 'confirmed']);
export function doctorAppointmentSummary(items: DoctorAppointment[] | null, now = new Date()) {
  if (items === null) return { upcoming: null, today: null, next: null, pending: null };
  const clock = cameroonClock(now);
  const upcoming = items.filter(item =>
    OPEN_STATUSES.has(item.status) && typeof item.date === 'string'
    && typeof item.time === 'string' && /^\d{4}-\d\d-\d\d$/.test(item.date)
    && /^\d\d:\d\d$/.test(item.time)
    && (item.date > clock.date || item.date === clock.date && item.time >= clock.time))
    .sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return {
    upcoming, today: upcoming.filter(item => item.date === clock.date),
    next: upcoming[0] ?? null,
    pending: items.filter(item => item.status === 'pending_confirmation').length,
  };
}

export function doctorDashboardMetrics(data: DoctorDashboardData, now = new Date()) {
  const appointments = data.appointments.status === 'success' ? data.appointments.value : null;
  const appts = doctorAppointmentSummary(appointments, now);
  return {
    availableNeeds: data.needs.status === 'success' ? data.needs.value.total : null,
    sentProposals: data.proposals.status === 'success' ? data.proposals.value.total : null,
    upcomingAppointments: appts.upcoming?.length ?? null,
    pendingAppointments: appts.pending,
    todayAppointments: appts.today,
    nextAppointment: appts.next,
    unreadConversations: data.conversations.status === 'success'
      ? data.conversations.value.reduce((n, c) => n + Math.max(0, c.unreadCount), 0) : null,
    configuredDays: data.weekly.status === 'success'
      ? data.weekly.value.filter(w => w.isAvailable).length : null,
    blockedDays: data.blocked.status === 'success' ? data.blocked.value.length : null,
  };
}

export function enabledDoctorWeek(weekly: Array<WeeklyAvailability & { id: string }>) {
  const labels: Record<string, string> = {
    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
    thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
  };
  return weekly.filter(w => w.isAvailable && w.startTime && w.endTime)
    .map(w => ({ weekday: labels[w.weekday] ?? w.weekday, hours: `${w.startTime}–${w.endTime}` }));
}
