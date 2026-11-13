import type { DoctorDocument, DoctorOwnProfile, DoctorVerificationStatus } from '../../types/domain';

export type DoctorProfileEdit = {
  bio: string; yearsOfExperience: string; consultationFee: string; professionalAddress: string;
};
export type DoctorProfilePatch = {
  bio: string; yearsOfExperience: number; consultationFee: number; professionalAddress: string | null;
};
export type DoctorDocumentType = DoctorDocument['name'];
export const DOCTOR_DOCUMENT_TYPES: Record<DoctorDocumentType, string> = {
  medical_license: 'Inscription à l’Ordre des médecins',
  medical_degree: 'Diplôme médical',
  identity_document: 'Pièce d’identité',
  other: 'Autre justificatif',
};
export const DOCTOR_DOCUMENT_STATUSES: Record<DoctorDocument['status'],string> = {
  pending: 'En attente de vérification', approved: 'Document approuvé', rejected: 'Document refusé',
};
export const DOCTOR_VERIFICATION_STATUSES: Record<DoctorVerificationStatus,string> = {
  pending: 'Vérification en attente', verified: 'Médecin vérifié',
  rejected: 'Vérification refusée', suspended: 'Profil professionnel suspendu',
};
export const DOCTOR_ALLOWED_MIME_TYPES = [
  'application/pdf','image/jpeg','image/png','image/webp',
] as const;
export const DOCTOR_MAX_DOCUMENT_BYTES = 10*1024*1024;
export const DOCTOR_MAX_DOCUMENTS = 50;
export type DoctorCandidateFile = {
  uri: string; name: string; size?: number | null; mimeType?: string | null;
};

export function editableDoctorProfile(profile: DoctorOwnProfile):DoctorProfileEdit {
  return {
    bio: profile.bio ?? '',
    yearsOfExperience: String(profile.yearsOfExperience),
    consultationFee: String(profile.consultationFee),
    professionalAddress: profile.professionalAddress ?? '',
  };
}
export function validateDoctorProfileEdit(form: DoctorProfileEdit): {
  errors: Record<string,string>; payload: DoctorProfilePatch | null;
} {
  const errors:Record<string,string> = {};
  if (form.bio.length>600) errors.bio='Présentation : 600 caractères maximum.';
  const years=Number(form.yearsOfExperience.trim());
  if (!form.yearsOfExperience.trim() || !Number.isInteger(years) || years<0 || years>80)
    errors.yearsOfExperience='Expérience : nombre entier entre 0 et 80.';
  const fee=Number(form.consultationFee.trim());
  if (!form.consultationFee.trim() || !Number.isSafeInteger(fee) || fee<0 || fee>100000000)
    errors.consultationFee='Tarif : entier compris entre 0 et 100 000 000.';
  if (form.professionalAddress.length>255)
    errors.professionalAddress='Adresse professionnelle : 255 caractères maximum.';
  return {errors,payload:Object.keys(errors).length?null:{
    bio:form.bio.trim(),yearsOfExperience:years,consultationFee:fee,
    professionalAddress:form.professionalAddress.trim()||null,
  }};
}

export function validateDoctorDocument(file: DoctorCandidateFile, existingCount: number):string|null {
  if(existingCount>=DOCTOR_MAX_DOCUMENTS)
    return 'Le dossier contient déjà 50 justificatifs. Supprimez un document avant un nouvel envoi.';
  if(!file.uri || !file.name || file.name.length>255)
    return 'Sélectionnez un document valide (nom limité à 255 caractères).';
  if(!(DOCTOR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType??''))
    return 'Formats acceptés : PDF, JPEG, PNG ou WebP.';
  if(typeof file.size!=='number' || !Number.isFinite(file.size) || file.size<=0 || file.size>DOCTOR_MAX_DOCUMENT_BYTES)
    return 'Le fichier doit avoir une taille connue, entre 1 octet et 10 Mo.';
  return null;
}
export function parseDoctorOwnProfile(raw:unknown):DoctorOwnProfile {
  if(!raw||typeof raw!=='object')throw new Error('Profil médecin invalide.');
  const p=raw as Partial<DoctorOwnProfile>;
  if(!p.id || typeof p.id!=='string'||typeof p.name!=='string'
    ||typeof p.specialty!=='string'
    ||!Object.hasOwn(DOCTOR_VERIFICATION_STATUSES,p.verificationStatus??'')
    ||!Array.isArray(p.documents)||!Array.isArray(p.degrees)||!Array.isArray(p.secondarySpecialties)
    ||!Number.isSafeInteger(p.yearsOfExperience)||!Number.isSafeInteger(p.consultationFee)){
    throw new Error('Profil médecin invalide.');
  }
  const documents=p.documents.map(doc=>{
    if(!doc||typeof doc.id!=='string'||typeof doc.filename!=='string'
      ||!Object.hasOwn(DOCTOR_DOCUMENT_TYPES,doc.name??'')
      ||!Object.hasOwn(DOCTOR_DOCUMENT_STATUSES,doc.status??'')
      ||typeof doc.sizeBytes!=='number'
      ||(doc.downloadUrl!==null&&typeof doc.downloadUrl!=='string')){
      throw new Error('Justificatif invalide.');
    }
    // Do not propagate internal keys, reviewer identities or storage paths.
    return {id:doc.id,medicalDocumentId:doc.medicalDocumentId,
      name:doc.name,filename:doc.filename,status:doc.status,
      sizeBytes:doc.sizeBytes,downloadUrl:doc.downloadUrl};
  });
  return {
    id:p.id,name:p.name,specialty:p.specialty,bio:p.bio??'',
    yearsOfExperience:p.yearsOfExperience!,consultationFee:p.consultationFee!,
    currency:p.currency||'XAF',
    professionalAddress:p.professionalAddress??null,
    modes:p.modes??[],availability:p.availability??[],
    rating:p.rating??null,reviewsCount:p.reviewsCount??0,
    phone:p.phone??'',email:p.email??'',registrationNumber:p.registrationNumber??'',
    secondarySpecialties:p.secondarySpecialties,degrees:p.degrees,
    verificationStatus:p.verificationStatus!,documents,
    completedConsultations:p.completedConsultations??0,
  };
}
export function confirmedDoctorProfileUpdate(previous:DoctorOwnProfile,returned:unknown):DoctorOwnProfile {
  const profile=parseDoctorOwnProfile(returned);
  if(profile.id!==previous.id)throw new Error('Réponse de compte incohérente.');
  return profile;
}
export function doctorProfileError(error:unknown):string {
  const e=error as {status?:number;kind?:string}|null;
  if(e?.status===401||e?.status===403)return 'Votre compte n’est pas autorisé à effectuer cette opération.';
  if(e?.status===404)return 'Profil ou document introuvable. Actualisez le dossier.';
  if(e?.status===413)return 'Fichier trop volumineux : 10 Mo maximum.';
  if(e?.status===400||e?.status===422)return 'Modification refusée. Vérifiez le format, la taille du fichier ou les valeurs saisies.';
  if(e?.kind==='network'||e?.kind==='timeout')return 'Connexion indisponible. Vérifiez votre réseau.';
  return 'Opération indisponible. Réessayez.';
}
export function approvedDocumentDeletionWarning(doc:DoctorDocument):string {
  return doc.status==='approved'
    ? 'ATTENTION : ce justificatif est approuvé. Sa suppression peut remettre votre profil professionnel au statut « En attente de vérification » et suspendre l’accès aux demandes et propositions. La suppression est définitive.'
    : 'Ce justificatif sera supprimé définitivement de votre dossier professionnel. Son statut de vérification sera perdu.';
}
