import type { AuthenticatedUser, PatientCondition, PatientDocument } from '../../types/domain';

export type BloodType = 'a_positive'|'a_negative'|'b_positive'|'b_negative'|'ab_positive'|'ab_negative'|'o_positive'|'o_negative'|'unknown';
export type PatientGender = 'female'|'male'|'non_binary'|'undisclosed';
export type PatientProfileData = {
  user: AuthenticatedUser;
  patient: {
    id: string; fullName: string; dateOfBirth: string | null;
    gender: PatientGender; bloodType: BloodType;
    verified: boolean; address: {city:string;district:string} | null;
  };
};
export type PatientProfileEdit = {name:string;phone:string;bloodType:BloodType;city:string;district:string};
export const BLOOD_TYPE_LABELS: Record<BloodType,string> = {
  a_positive:'A+',a_negative:'A−',b_positive:'B+',b_negative:'B−',
  ab_positive:'AB+',ab_negative:'AB−',o_positive:'O+',o_negative:'O−',unknown:'Non renseigné',
};
export const GENDER_LABELS:Record<PatientGender,string> = {
  female:'Femme',male:'Homme',non_binary:'Non binaire',undisclosed:'Non renseigné',
};
export const CONDITION_LABELS:Record<PatientCondition['status'],string> = {
  active:'Active',controlled:'Contrôlée',inactive:'Inactive',
};
export const DOCUMENT_TYPES = {
  prescription:'Ordonnance médicale',lab_result:'Résultats d’analyse',
  medical_report:'Compte-rendu médical',imaging:'Imagerie médicale',other:'Autre document',
} as const;
export type PatientDocumentType = keyof typeof DOCUMENT_TYPES;
export const DOCUMENT_MIMES = ['application/pdf','image/jpeg','image/png','image/webp'] as const;
export const MAX_DOCUMENT_BYTES = 10*1024*1024;

export function parsePatientProfile(payload:unknown,expectedId?:string):PatientProfileData {
  if(!payload||typeof payload!=='object')throw new Error('Profil indisponible.');
  const {user,patient}=payload as Record<string,unknown>;
  if(!user||typeof user!=='object'||!patient||typeof patient!=='object')
    throw new Error('Profil indisponible.');
  const u=user as Record<string,unknown>,p=patient as Record<string,unknown>;
  if(u.role!=='patient'||typeof u.id!=='string'||(expectedId&&u.id!==expectedId)
    ||typeof p.id!=='string'||typeof p.fullName!=='string'
    ||!Object.hasOwn(GENDER_LABELS,String(p.gender))||!Object.hasOwn(BLOOD_TYPE_LABELS,String(p.bloodType)))
    throw new Error('Profil patient invalide.');
  const addr=p.address;
  if(addr!==null&&addr!==undefined && (typeof addr!=='object'||typeof (addr as Record<string,unknown>).city!=='string'
    ||typeof (addr as Record<string,unknown>).district!=='string'))throw new Error('Adresse du profil invalide.');
  return {user:u as unknown as AuthenticatedUser,patient:{
    id:p.id,fullName:p.fullName,dateOfBirth:typeof p.dateOfBirth==='string'?p.dateOfBirth:null,
    gender:p.gender as PatientGender,bloodType:p.bloodType as BloodType,
    verified:p.verified===true,address:addr as PatientProfileData['patient']['address']??null,
  }};
}
export function viewPatientProfile(info:PatientProfileData){
  const name=info.patient.fullName.trim()||[info.user.firstName,info.user.lastName].filter(Boolean).join(' ').trim();
  const date=info.patient.dateOfBirth?new Date(info.patient.dateOfBirth):null;
  const validDate=date&&Number.isFinite(date.getTime())?date:null;
  return {
    name:name||'Non renseigné',
    email:info.user.email?.trim()||'Non renseigné',
    phone:info.user.phone?.trim()||'Non renseigné',
    bloodType:BLOOD_TYPE_LABELS[info.patient.bloodType],
    gender:GENDER_LABELS[info.patient.gender],
    dateOfBirth:validDate?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'}).format(validDate):'Non renseignée',
    city:info.patient.address?.city?.trim()||'Non renseignée',
    district:info.patient.address?.district?.trim()||'Non renseigné',
    verified:info.patient.verified,
  };
}
export function editingPatientProfile(info:PatientProfileData):PatientProfileEdit {
  return {name:info.patient.fullName||[info.user.firstName,info.user.lastName].filter(Boolean).join(' '),
    phone:info.user.phone??'',bloodType:info.patient.bloodType,
    city:info.patient.address?.city??'',district:info.patient.address?.district??''};
}
export function validatePatientEdit(value:PatientProfileEdit,original:PatientProfileData):Record<string,string> {
  const errors:Record<string,string>={};
  if(value.name.trim().length<2||value.name.length>150)errors.name='Le nom doit comporter entre 2 et 150 caractères.';
  if(value.phone.trim().length<6||value.phone.length>30)errors.phone='Le téléphone doit comporter entre 6 et 30 caractères.';
  if(!Object.hasOwn(BLOOD_TYPE_LABELS,value.bloodType))errors.bloodType='Groupe sanguin invalide.';
  if(value.city.length>100||value.district.length>100)errors.location='Ville et quartier : 100 caractères maximum chacun.';
  if(!original.patient.address && (value.city.trim()||value.district.trim()))
    errors.location="L’API ne permet pas de créer une adresse depuis le profil. Configurez d'abord une adresse valide.";
  return errors;
}
export function mapPatientConditions(data:unknown):PatientCondition[]{
  if(!Array.isArray(data))throw new Error('Réponse des informations médicales invalide.');
  return data.map(item=>{
    if(!item||typeof item!=='object'||typeof item.id!=='string'||typeof item.name!=='string'
      ||!Object.hasOwn(CONDITION_LABELS,item.status))throw new Error('État de santé invalide.');
    return {id:item.id,name:item.name,status:item.status,
      description:typeof item.description==='string'?item.description:null,
      diagnosedAt:typeof item.diagnosedAt==='string'?item.diagnosedAt:null,
      notes:typeof item.notes==='string'?item.notes:null};
  });
}
export function mapPatientDocuments(data:unknown):PatientDocument[]{
  if(!Array.isArray(data))throw new Error('Réponse des documents invalide.');
  return data.map(item=>{
    if(!item||typeof item!=='object'||typeof item.id!=='string'
      ||typeof item.filename!=='string'||typeof item.mimeType!=='string'
      ||typeof item.type!=='string'||typeof item.title!=='string'
      ||typeof item.sizeBytes!=='number')throw new Error('Document invalide.');
    return {id:item.id,filename:item.filename,mimeType:item.mimeType,type:item.type,title:item.title,
      sizeBytes:item.sizeBytes,uploadedAt:typeof item.uploadedAt==='string'?item.uploadedAt:'',
      downloadUrl:typeof item.downloadUrl==='string'?item.downloadUrl:null};
  });
}
export function validatePatientFile(file:{name:string;uri:string;mimeType?:string|null;size?:number|null}):string|null {
  if(!file.name||!file.uri||!file.mimeType||!(DOCUMENT_MIMES as readonly string[]).includes(file.mimeType))
    return 'Format accepté : PDF, JPEG, PNG ou WebP.';
  if(typeof file.size!=='number'||!Number.isFinite(file.size)||file.size<=0||file.size>MAX_DOCUMENT_BYTES)
    return 'Le fichier doit avoir une taille connue et ne pas dépasser 10 Mo.';
  return null;
}
export function patientProfileError(error:unknown):string {
  const e=error as {status?:number;kind?:string}|null;
  if(e?.status===403)return 'Vous ne pouvez pas accéder à ces données.';
  if(e?.status===404)return 'Ces informations ne sont pas disponibles pour ce compte.';
  if(e?.status===400||e?.status===422)return 'Informations refusées. Vérifiez les champs ou l’adresse associée.';
  if(e?.kind==='network'||e?.kind==='timeout')return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  return 'Opération impossible. Réessayez.';
}
