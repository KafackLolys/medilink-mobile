import type { NeedStatus, PatientNeed } from '../../types/domain';

export type NeedFilter = 'all' | 'active' | 'confirmed' | 'draft' | 'closed';
export type NeedPriorityInput = 'normal' | 'rapide' | 'urgence';
export type NeedModeInput = 'domicile' | 'tele';

export const SPECIALTY_OPTIONS = ['Médecine générale', 'Pédiatrie', 'Cardiologie', 'Dermatologie',
  'Gynécologie', 'Neurologie', 'Kinésithérapie', 'Je ne sais pas'] as const;
export const SYMPTOM_OPTIONS = ['Fièvre', 'Douleur', 'Fatigue', 'Toux', 'Maux de tête',
  'Vertiges', 'Nausées', 'Éruption cutanée', 'Difficulté à marcher', 'Autre'] as const;
export const SINCE_OPTIONS = ['Aujourd’hui', '2 à 3 jours', 'Environ une semaine',
  'Plus d’une semaine', 'Plus d’un mois'] as const;

export const NEED_STATUS_LABELS: Record<NeedStatus, string> = {
  draft: 'Brouillon', published: 'Publiée',
  awaiting_proposals: 'En attente de propositions',
  proposals_received: 'Propositions reçues',
  appointment_confirmed: 'Rendez-vous confirmé',
  closed: 'Clôturée', cancelled: 'Annulée',
};
const ACTIVE: NeedStatus[] = ['published', 'awaiting_proposals', 'proposals_received'];
export const EDITABLE: NeedStatus[] = ['draft', ...ACTIVE];
export function canEditNeed(status: NeedStatus) { return EDITABLE.includes(status); }
export function canCloseNeed(status: NeedStatus) { return ACTIVE.includes(status); }
export function canDeleteNeed(status: NeedStatus) { return status === 'draft'; }
export function filterPatientNeeds(items: PatientNeed[], filter: NeedFilter): PatientNeed[] {
  return items.filter(need => filter === 'all'
    || (filter === 'active' && canCloseNeed(need.status))
    || (filter === 'confirmed' && need.status === 'appointment_confirmed')
    || (filter === 'draft' && need.status === 'draft')
    || (filter === 'closed' && ['closed', 'cancelled'].includes(need.status)));
}
export type NeedCreationValues = {
  title: string; specialty: string; description: string; symptoms: string[];
  since: string; city: string; district: string; address: string;
  priority: NeedPriorityInput; mode: NeedModeInput; consent: boolean;
};
export const EMPTY_NEED_FORM: NeedCreationValues = {
  title: '', specialty: '', description: '', symptoms: [], since: '',
  city: '', district: '', address: '', priority: 'normal', mode: 'domicile', consent: false,
};

export function validateNeedCreation(v: NeedCreationValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (v.title.trim().length < 5) errors.title = 'Titre : au moins 5 caractères.';
  if (!v.specialty.trim()) errors.specialty = 'Choisissez une spécialité.';
  if (v.description.trim().length < 20 || v.description.length > 800)
    errors.description = 'Description : entre 20 et 800 caractères.';
  if (!v.city.trim()) errors.city = 'Indiquez votre ville.';
  if (!v.district.trim()) errors.district = 'Indiquez votre quartier.';
  if (v.priority === 'urgence') errors.priority = 'En cas d’urgence, contactez immédiatement les services d’urgence.';
  if (!['normal','rapide','urgence'].includes(v.priority)) errors.priority = 'Priorité invalide.';
  if (!['domicile','tele'].includes(v.mode)) errors.mode = 'Type de consultation invalide.';
  if (!v.consent) errors.consent = 'Votre accord est nécessaire pour publier.';
  return errors;
}
export function validateNeedEdit(data: { title: string; specialty: string; description: string; mode: NeedModeInput }): Record<string,string> {
  const errors: Record<string,string> = {};
  if (data.title.trim().length < 5) errors.title = 'Titre : au moins 5 caractères.';
  if (!data.specialty.trim()) errors.specialty = 'Choisissez une spécialité.';
  if (data.description.trim().length < 20 || data.description.length > 800)
    errors.description = 'Description : entre 20 et 800 caractères.';
  if (!['domicile','tele'].includes(data.mode)) errors.mode = 'Mode de consultation invalide.';
  return errors;
}
export const MAX_NEED_FILES = 5;
export const MAX_NEED_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_NEED_MIMES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
] as const;
export type CandidateFile = { name: string; uri: string; mimeType?: string | null; size?: number | null };
export function validateNeedAttachments(files: CandidateFile[]): string | null {
  if (files.length > MAX_NEED_FILES) return 'Maximum 5 fichiers.';
  for (const file of files) {
    if (!file.uri || !file.name || !file.mimeType || !(ALLOWED_NEED_MIMES as readonly string[]).includes(file.mimeType))
      return 'Formats acceptés : PDF, JPEG, PNG, WebP, HEIC, HEIF.';
    if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0)
      return 'Taille du fichier indisponible. Sélectionnez un autre fichier.';
    if (file.size > MAX_NEED_FILE_SIZE) return 'Chaque fichier doit faire 10 Mo maximum.';
  }
  return null;
}
export function safeNeedError(error: unknown, fallback = 'Impossible de traiter la demande.'): string {
  const e = error as { kind?: string; status?: number } | null;
  if (e?.kind === 'timeout') return 'La requête a expiré. Réessayez.';
  if (e?.kind === 'network') return 'Connexion impossible. Vérifiez votre réseau.';
  if (e?.status === 403) return 'Vous n’êtes pas autorisé à effectuer cette action.';
  if (e?.status === 404) return 'Cette demande est introuvable.';
  if (e?.status === 400 || e?.status === 409 || e?.status === 422)
    return 'La demande ne peut pas être modifiée dans son état actuel. Actualisez puis réessayez.';
  if (e?.status && e.status >= 500) return 'Le serveur est momentanément indisponible.';
  return fallback;
}
