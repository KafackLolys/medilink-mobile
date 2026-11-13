import type { AppointmentStatus, BlockedDate, ConsultationMode, DoctorAppointment, Weekday, WeeklyAvailability } from '../../types/domain';

export const DAYS: ReadonlyArray<{id:Weekday;label:string}>=[
  {id:'monday',label:'Lundi'},{id:'tuesday',label:'Mardi'},{id:'wednesday',label:'Mercredi'},
  {id:'thursday',label:'Jeudi'},{id:'friday',label:'Vendredi'},
  {id:'saturday',label:'Samedi'},{id:'sunday',label:'Dimanche'},
];
export const DURATIONS=[15,20,30,45,60] as const;
export const APPOINTMENT_STATUS_LABELS:Record<AppointmentStatus,string>={
  pending_confirmation:'À confirmer',confirmed:'Confirmé',completed:'Terminé',
  cancelled:'Annulé',rejected:'Refusé',no_show:'Absent',
};
export const APPOINTMENT_STATUSES=Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[];

const hm=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3,5));
export function parseWeekly(rows:unknown):WeeklyAvailability[]{
  if(!Array.isArray(rows))throw new Error('Horaires indisponibles.');
  const map=new Map<Weekday,WeeklyAvailability>();
  for(const r of rows){
    if(!r||typeof r!=='object'||!DAYS.some(d=>d.id===r.weekday)||
      typeof r.isAvailable!=='boolean'||typeof r.startTime!=='string'||typeof r.endTime!=='string'||
      !hm.test(r.startTime)||!hm.test(r.endTime)||map.has(r.weekday))throw new Error('Horaires invalides.');
    map.set(r.weekday,{weekday:r.weekday,isAvailable:r.isAvailable,startTime:r.startTime,endTime:r.endTime});
  }
  return DAYS.map(d=>map.get(d.id)??{weekday:d.id,isAvailable:false,startTime:'09:00',endTime:'17:00'});
}
export function validateWeekly(rows:WeeklyAvailability[]):Record<string,string>{
  const errors:Record<string,string>={};
  if(rows.length!==7||new Set(rows.map(r=>r.weekday)).size!==7){
    errors.global='Les sept jours de la semaine doivent être définis.';return errors;
  }
  for(const row of rows){
    if(!DAYS.some(d=>d.id===row.weekday)||typeof row.isAvailable!=='boolean'
      ||!hm.test(row.startTime)||!hm.test(row.endTime)){
      errors[row.weekday]='Heure invalide : utilisez HH:mm (24 h).';continue;
    }
    if(row.isAvailable&&minutes(row.startTime)>=minutes(row.endTime))
      errors[row.weekday]='La fin doit être postérieure au début.';
  }
  return errors;
}
export function validateDuration(v:number):boolean{return Number.isInteger(v)&&DURATIONS.includes(v as typeof DURATIONS[number]);}
export function validateModes(modes:ConsultationMode[]):boolean{
  return modes.length>=1&&modes.length<=2&&new Set(modes).size===modes.length
    &&modes.every(x=>x==='home'||x==='teleconsultation');
}
export function validDay(s:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const date=new Date(s+'T12:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s;
}
export function validateNewBlock(date:string,existing:BlockedDate[]):string|null{
  if(!validDay(date))return 'Choisissez une date valide.';
  if(existing.some(b=>b.date===date))return 'Cette date est déjà bloquée.';
  return null;
}
export function consultationClock(iso:string){
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Douala'}).format(d);
}
export function parseDoctorAppointments(data:unknown):DoctorAppointment[]{
  if(!Array.isArray(data))throw new Error('Agenda invalide.');
  return data.map(a=>{
    if(!a||typeof a.id!=='string'||typeof a.patient!=='string'
      ||!validDay(a.date)||!hm.test(a.time)
      ||!Object.hasOwn(APPOINTMENT_STATUS_LABELS,a.status))throw new Error('Rendez-vous invalide.');
    return {id:a.id,date:a.date,time:a.time,patient:a.patient,
      district:typeof a.district==='string'?a.district:null,
      mode:a.mode==='Téléconsultation'?'Téléconsultation':'À domicile',status:a.status};
  });
}
/** Backend accepts every AppointmentStatus for owned records; no server transition matrix. */
export function backendPermittedStatuses():AppointmentStatus[]{return [...APPOINTMENT_STATUSES];}
export function doctorAgendaError(e:unknown):string{
  const x=e as {status?:number;kind?:string}|null;
  if(x?.status===401||x?.status===403)return 'Cette opération est réservée au médecin autorisé.';
  if(x?.status===404)return 'Cet élément est introuvable ou ne vous appartient plus.';
  if(x?.status===400||x?.status===409||x?.status===422)return 'Modification refusée : vérifiez les valeurs et actualisez.';
  if(x?.kind==='network'||x?.kind==='timeout')return 'Connexion indisponible. Vérifiez le réseau.';
  return 'Impossible d’effectuer cette opération. Réessayez.';
}
