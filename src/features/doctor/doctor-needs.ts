import type { ConsultationMode, DoctorNeed, DoctorProposal, NeedStatus, Page } from '../../types/domain';
import type { DoctorProposalRequest } from '../../services/needs';

export type DoctorNeedPriority = DoctorNeed['priority'];
export type DoctorNeedDetail = {
  id: string; title: string; specialty: string; status: NeedStatus;
  createdAt: string; description: string; symptoms: string[]; durationDescription: string | null;
  city: string; district: string; priority: DoctorNeedPriority; mode: 'domicile' | 'teleconsultation';
  availableFrom: string | null; documentsCount?: number; attachmentsCount: number;
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number; downloadUrl: string }[];
};
export const PRIORITY_LABELS: Record<DoctorNeedPriority, string> = {
  routine: 'Normale', urgent: 'Rapide', emergency: 'Urgence',
};
export const PROPOSAL_STATUS_LABELS: Record<DoctorProposal['status'], string> = {
  sent: 'Envoyée', pending: 'En attente', accepted: 'Acceptée',
  rejected: 'Refusée', expired: 'Expirée', cancelled: 'Annulée',
};
export const PROPOSAL_STATUSES = [
  'sent','pending','accepted','rejected','expired','cancelled',
] as const;
export type ProposalFilter = DoctorProposal['status'] | '';
export type NeedFilters = {
  q?: string; specialty?: string; priority?: DoctorNeedPriority; mode?: ConsultationMode;
};
export type ProposalForm = {
  message: string; date: string; time: string; consultationMode: ConsultationMode;
  fee: string; details: string;
};
export const EMPTY_PROPOSAL_FORM: ProposalForm = {
  message: '',date:'',time:'',consultationMode:'home',fee:'',details:'',
};
export const PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export function doctorNeedsAllowed(role: string|null, verification: string|null|undefined): boolean {
  return role === 'doctor' && verification === 'verified';
}
export function parseDoctorNeedFilters(filters: NeedFilters): NeedFilters {
  const result: NeedFilters = {};
  for (const key of ['q','specialty'] as const) {
    const raw=filters[key]?.trim();
    if (raw) {
      if (raw.length>100) throw new Error('La recherche et la spécialité sont limitées à 100 caractères.');
      result[key]=raw;
    }
  }
  if (filters.priority) {
    if (!Object.hasOwn(PRIORITY_LABELS,filters.priority)) throw new Error('Priorité invalide.');
    result.priority=filters.priority;
  }
  if (filters.mode) {
    if (!['home','teleconsultation'].includes(filters.mode)) throw new Error('Mode invalide.');
    result.mode=filters.mode;
  }
  return result;
}
export function parseDoctorPage<T>(value: unknown): Page<T> {
  if (!value || typeof value !== 'object') throw new Error('Réponse invalide.');
  const r=value as Partial<Page<T>>;
  if (!Array.isArray(r.items) || !Number.isSafeInteger(r.page) || (r.page??0)<1
    || !Number.isSafeInteger(r.pageSize) || (r.pageSize??0)<1 || (r.pageSize??0)>MAX_PAGE_SIZE
    || !Number.isSafeInteger(r.total) || (r.total??-1)<0
    || !Number.isSafeInteger(r.totalPages) || (r.totalPages??-1)<0) {
    throw new Error('Réponse paginée invalide.');
  }
  return r as Page<T>;
}
export function parseDoctorNeedsPage(value: unknown): Page<DoctorNeed> & { specialties: string[] } {
  const page=parseDoctorPage<DoctorNeed>(value);
  const r=value as {specialties?:unknown};
  if (!Array.isArray(r.specialties) || !r.specialties.every(v=>typeof v==='string')) {
    throw new Error('Liste des spécialités invalide.');
  }
  const items=page.items.map(item=>{
    if (!item || typeof item.id!=='string'||!item.id || typeof item.title!=='string'
      ||typeof item.summary!=='string'||typeof item.specialty!=='string'
      ||typeof item.city!=='string'||typeof item.district!=='string'
      ||!Object.hasOwn(PRIORITY_LABELS,item.priority)
      ||!['home','teleconsultation'].includes(item.mode)) throw new Error('Demande invalide.');
    // Public fields only, especially no patient ID/address/phone.
    return {
      id:item.id,title:item.title,summary:item.summary,specialty:item.specialty,
      city:item.city,district:item.district,mode:item.mode,priority:item.priority,
      publishedAt:typeof item.publishedAt==='string'?item.publishedAt:'',
      availableFrom:typeof item.availableFrom==='string'?item.availableFrom:null,
      documentsCount:typeof item.documentsCount==='number'?item.documentsCount:0,
    };
  });
  return {...page,items,specialties:r.specialties as string[]};
}
export function parseDoctorNeedDetail(raw: unknown): DoctorNeedDetail {
  if (!raw || typeof raw!=='object') throw new Error('Demande invalide.');
  const need=raw as Partial<DoctorNeedDetail>;
  if (typeof need.id!=='string'||!need.id ||typeof need.title!=='string'
    ||typeof need.description!=='string'||typeof need.specialty!=='string'
    ||typeof need.city!=='string'||typeof need.district!=='string'
    ||!Object.hasOwn(PRIORITY_LABELS,need.priority??'')
    ||!['domicile','teleconsultation'].includes(need.mode??'')
    ||!['published','awaiting_proposals','proposals_received'].includes(need.status??'')
    ||!Array.isArray(need.symptoms)||!need.symptoms.every(v=>typeof v==='string')
    ||!Array.isArray(need.attachments)) throw new Error('Demande invalide.');
  const attachments=need.attachments.map(file=>{
    if (!file || typeof file.id!=='string' || typeof file.fileName!=='string'
      ||typeof file.downloadUrl!=='string' || typeof file.mimeType!=='string'
      ||typeof file.sizeBytes!=='number') throw new Error('Document invalide.');
    return {id:file.id,fileName:file.fileName,mimeType:file.mimeType,
      sizeBytes:file.sizeBytes,downloadUrl:file.downloadUrl};
  });
  return {
    id:need.id,title:need.title,description:need.description,specialty:need.specialty,
    city:need.city,district:need.district,priority:need.priority as DoctorNeedPriority,
    status:need.status as NeedStatus,mode:need.mode as DoctorNeedDetail['mode'],
    createdAt:typeof need.createdAt==='string'?need.createdAt:'',
    symptoms:need.symptoms,durationDescription:typeof need.durationDescription==='string'?need.durationDescription:null,
    availableFrom:typeof need.availableFrom==='string'?need.availableFrom:null,
    attachments,attachmentsCount:attachments.length,
  };
}
export function parseProposalsPage(raw: unknown): Page<DoctorProposal> & {counts:Record<string,number>} {
  const page=parseDoctorPage<DoctorProposal>(raw);
  const counts=(raw as {counts?:unknown}).counts;
  if (!counts || typeof counts!=='object') throw new Error('Statuts des propositions indisponibles.');
  for (const status of PROPOSAL_STATUSES) {
    if (!Number.isSafeInteger((counts as Record<string,unknown>)[status])
      || (counts as Record<string,number>)[status]<0) throw new Error('Compteur invalide.');
  }
  const items=page.items.map(p=>{
    if (!p || typeof p.id!=='string'||typeof p.needId!=='string'
      ||typeof p.needTitle!=='string'||!Object.hasOwn(PROPOSAL_STATUS_LABELS,p.status)
      ||typeof p.message!=='string'||typeof p.fee!=='number') throw new Error('Proposition invalide.');
    return {
      id:p.id,needId:p.needId,needTitle:p.needTitle,specialty:p.specialty,
      city:p.city,district:p.district,status:p.status,message:p.message,
      proposedAt:p.proposedAt,proposedAppointmentAt:p.proposedAppointmentAt,
      consultationMode:p.consultationMode,fee:p.fee,currency:p.currency,
      patientResponse:p.patientResponse,respondedAt:p.respondedAt,
    };
  });
  return {...page,items,counts:counts as Record<string,number>};
}
export function canCancelDoctorProposal(status: DoctorProposal['status']): boolean {
  return status==='pending'||status==='sent';
}
export function dateTimeDisplay(iso:string|null):string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'Non précisée';
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',
    timeZone:'Africa/Douala'}).format(new Date(iso));
}
export function validateProposal(form: ProposalForm, now=Date.now()): {
  errors: Record<string,string>; payload: DoctorProposalRequest|null;
} {
  const errors:Record<string,string>={};
  if (form.message.trim().length<10) errors.message='Message : 10 caractères minimum.';
  if (form.details.length>2000) errors.details='Complément : 2 000 caractères maximum.';
  if (!['home','teleconsultation'].includes(form.consultationMode)) errors.mode='Mode non autorisé.';
  const feeValue=form.fee.trim();
  const fee=Number(feeValue.replace(',','.'));
  if (!feeValue || !Number.isFinite(fee) || fee<0) errors.fee='Montant positif ou nul requis.';
  if (!/^\d{4}-\d\d-\d\d$/.test(form.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
    errors.date='Indiquez une date (AAAA-MM-JJ) et une heure (HH:mm) valides.';
  }
  const iso=!errors.date?new Date(`${form.date}T${form.time}:00`):null;
  if (!errors.date && (!iso || !Number.isFinite(iso.getTime()) || iso.getTime()<=now
    || [iso.getFullYear(),String(iso.getMonth()+1).padStart(2,'0'),String(iso.getDate()).padStart(2,'0')].join('-')!==form.date
    || [String(iso.getHours()).padStart(2,'0'),String(iso.getMinutes()).padStart(2,'0')].join(':')!==form.time)) {
    errors.date='Choisissez une date et une heure futures et valides.';
  }
  return {errors,payload:Object.keys(errors).length?null:{
    message:form.message.trim(),proposedAppointmentAt:iso!.toISOString(),
    consultationMode:form.consultationMode,fee,
    ...(form.details.trim()?{details:form.details.trim()}:{})
  }};
}
export function doctorNeedsError(error:unknown):string {
  const e=error as {status?:number;kind?:string}|null;
  if (e?.status===403||e?.status===401) return 'Accès refusé : seul un médecin vérifié peut consulter ces données.';
  if (e?.status===404) return 'Cette demande n’est plus disponible ou ne vous est pas accessible.';
  if (e?.status===409) return 'Vous avez déjà envoyé une proposition pour cette demande. Consultez vos propositions.';
  if (e?.status===400||e?.status===422) return 'Cette action n’est plus autorisée ou les informations sont invalides. Actualisez.';
  if (e?.kind==='network'||e?.kind==='timeout') return 'Connexion indisponible. Vérifiez votre réseau.';
  return 'Impossible de charger ou de modifier ces informations. Réessayez.';
}
