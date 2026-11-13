import type { AppointmentStatus, ConsultationMode, DoctorDirectoryItem, PatientAppointment, Weekday } from '../../types/domain';

export const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  pending_confirmation: 'En attente de confirmation',
  confirmed: 'Confirmé', completed: 'Terminé',
  cancelled: 'Annulé', rejected: 'Refusé', no_show: 'Absent',
};
export const WEEKDAYS: readonly Weekday[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export type BookingSelection = { date: string; time: string; consultationMode: ConsultationMode | ''; reason: string };
export type BookingResult = { doctorId: string; scheduledAt: string; timeZone: string; consultationMode: ConsultationMode; reason?: string };

function minutes(time: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h,m] = time.split(':').map(Number); return h*60+m;
}
export function getDeviceTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone || !/^[\w+\/-]+$/.test(zone)) throw new Error('Fuseau horaire local indisponible.');
  return zone;
}
export function matchingOpeningHours(doctor: DoctorDirectoryItem, date: string): Array<{startTime:string;endTime:string}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const day = new Date(date+'T12:00:00');
  if (Number.isNaN(day.getTime()) || [day.getFullYear(),day.getMonth()+1,day.getDate()].join('-') !==
    [Number(date.slice(0,4)),Number(date.slice(5,7)),Number(date.slice(8,10))].join('-')) return [];
  if (doctor.blockedDates?.includes(date)) return [];
  return doctor.availability.filter(s=>s.isAvailable && s.weekday===WEEKDAYS[day.getDay()])
    .map(s=>({startTime:s.startTime,endTime:s.endTime}));
}
export function makeBookingRequest(doctor: DoctorDirectoryItem, selection: BookingSelection,
  now = Date.now(), timeZone = getDeviceTimeZone()): BookingResult {
  if (!doctor.modes.includes(selection.consultationMode as ConsultationMode))
    throw new Error('Choisissez un mode de consultation proposé par le médecin.');
  if (selection.reason.length > 500) throw new Error('Motif : 500 caractères maximum.');
  const requestedMinutes = minutes(selection.time);
  if (requestedMinutes === null) throw new Error('Heure invalide (HH:mm).');
  const duration = doctor.appointmentDurationMinutes ?? 30;
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error('Durée de consultation indisponible.');
  const openings = matchingOpeningHours(doctor, selection.date);
  if (!openings.some(w => {
    const start = minutes(w.startTime), end = minutes(w.endTime);
    return start !== null && end !== null && requestedMinutes >= start && requestedMinutes+duration <= end;
  })) throw new Error('L’heure doit correspondre à une plage hebdomadaire entière non bloquée.');
  const instant = new Date(selection.date+'T'+selection.time+':00');
  if (!Number.isFinite(instant.getTime()) || instant.getTime() <= now)
    throw new Error('Choisissez une date et une heure futures.');
  // Local JS Date and the device IANA zone are intentionally paired.
  const actual = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric',month:'2-digit',
    day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const fields = Object.fromEntries(actual.map(x=>[x.type,x.value]));
  if (`${fields.year}-${fields.month}-${fields.day}` !== selection.date ||
    `${fields.hour}:${fields.minute}` !== selection.time)
    throw new Error('La date locale est ambiguë ou le fuseau horaire a changé.');
  return {doctorId:doctor.id,scheduledAt:instant.toISOString(),timeZone,
    consultationMode:selection.consultationMode as ConsultationMode,
    ...(selection.reason.trim()?{reason:selection.reason.trim()}:{})};
}
export function appointmentError(error: unknown): string {
  const e=error as {status?:number;kind?:string}|null;
  if(e?.status===409) return 'Ce créneau est déjà réservé. Choisissez une autre heure et actualisez les horaires.';
  if(e?.status===400||e?.status===422) return 'Ce créneau ou ces informations ne sont plus acceptés. Vérifiez les horaires et réessayez.';
  if(e?.status===403) return 'Vous n’êtes pas autorisé à demander ce rendez-vous.';
  if(e?.status===404) return 'Ce médecin ou ce rendez-vous est indisponible.';
  if(e?.kind==='network'||e?.kind==='timeout') return 'Connexion indisponible. Vérifiez votre réseau puis réessayez.';
  return 'Impossible de traiter le rendez-vous. Réessayez.';
}
export function filterAppointments(items: PatientAppointment[], status: AppointmentStatus | 'all') {
  return status==='all'?items:items.filter(x=>x.status===status);
}
export function formatAppointmentDate(value:string,timeZone:string):string {
  if(!Number.isFinite(Date.parse(value))) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR',{timeZone,dateStyle:'full',timeStyle:'short'}).format(new Date(value));
}
/** Patient is read-only: only the doctor's own appointment status endpoint can change statuses. */
export function canPatientChangeAppointmentStatus(_status: AppointmentStatus): boolean { return false; }
