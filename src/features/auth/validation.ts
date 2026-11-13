import type { RegisterRequest } from '@/types/domain';

export type RegisterForm = RegisterRequest & { confirmPassword: string; acceptedTerms: boolean };
export type FieldErrors = Record<string, string>;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!emailPattern.test(email.trim())) errors.email = 'Saisissez une adresse e-mail valide.';
  if (!password) errors.password = 'Saisissez votre mot de passe.';
  return errors;
}

export function validateRegistration(form: RegisterForm): FieldErrors {
  const errors: FieldErrors = validateLogin(form.email, form.password);
  if (!form.firstName.trim()) errors.firstName = 'Saisissez votre prénom.';
  if (!form.lastName.trim()) errors.lastName = 'Saisissez votre nom.';
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Saisissez un numéro avec indicatif du pays.';
  const strongGroups = [form.password.length >= 8, /[a-z]/.test(form.password) && /[A-Z]/.test(form.password), /\d/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].filter(Boolean).length;
  if (strongGroups < 3) errors.password = 'Utilisez 8 caractères minimum, avec majuscule, chiffre ou symbole.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
  if (form.role !== 'patient' && form.role !== 'doctor') errors.role = 'Choisissez patient ou médecin.';
  if (form.role === 'doctor') {
    if (!form.specialty?.trim()) errors.specialty = 'Choisissez votre spécialité.';
    if (!form.registrationNumber?.trim()) errors.registrationNumber = 'Saisissez votre numéro professionnel.';
  }
  if (!form.acceptedTerms) errors.acceptedTerms = 'Vous devez accepter les conditions.';
  return errors;
}

export function authErrorMessage(error: unknown, action: 'login' | 'register'): string {
  const e = error as { kind?: string; status?: number; message?: string };
  if (e.kind === 'cancelled') return '';
  if (e.kind === 'network') return 'Connexion au serveur impossible. Vérifiez votre réseau.';
  if (e.kind === 'timeout') return 'Le serveur met trop de temps à répondre. Réessayez.';
  if (e.status === 401) return 'Adresse e-mail ou mot de passe incorrect.';
  if (e.status === 409) return 'Cette adresse e-mail est déjà utilisée.';
  if (e.status === 403) return typeof e.message === 'string' && /vérifi|confirm/i.test(e.message)
    ? 'Vérifiez votre adresse e-mail à partir du message reçu avant de vous connecter.'
    : 'Votre compte ne peut pas se connecter actuellement.';
  if (e.status === 400 || e.status === 422) return 'Certaines informations sont invalides. Vérifiez le formulaire.';
  if (e.status && e.status >= 500) return 'Le service est temporairement indisponible. Réessayez.';
  return action === 'login' ? 'Connexion impossible. Réessayez.' : 'Inscription impossible. Réessayez.';
}
