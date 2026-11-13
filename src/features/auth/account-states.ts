/** Password recovery is deliberately non-enumerating. No OTP or SMS is available in the API. */
export const RESET_CONFIRMATION =
  "Si un compte correspond à cette adresse, un e-mail de réinitialisation vous sera envoyé. Vérifiez également vos courriers indésirables.";

export function validateRecoveryEmail(value: string): string | null {
  const normalized = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Saisissez une adresse e-mail valide.";
  }
  return null;
}

/**
 * Error messages must not disclose whether an account exists or has a given status.
 * HTTP 400/401/403/404/409 are intentionally indistinguishable in this flow.
 */
export function recoveryErrorMessage(error: unknown): string {
  const info = error as { kind?: string; status?: number } | null;
  if (info?.kind === 'cancelled') return '';
  if (info?.kind === 'network') return 'Impossible de contacter le service. Vérifiez votre connexion puis réessayez.';
  if (info?.kind === 'timeout') return 'La demande a expiré. Vérifiez votre connexion puis réessayez.';
  if (info?.status && info.status >= 500) return 'Service momentanément indisponible. Réessayez plus tard.';
  return RESET_CONFIRMATION;
}

export type PublicAccountIssue = 'verification' | 'restricted' | 'unauthorized';
export function accountIssueMessage(issue: PublicAccountIssue): { title: string; description: string } {
  switch (issue) {
    case 'verification':
      return {
        title: 'Vérification de l’adresse e-mail',
        description: "Pour accéder à Medilink, consultez l'e-mail de vérification envoyé lors de l'inscription. Après confirmation, reconnectez-vous.",
      };
    case 'restricted':
      return {
        title: 'Connexion indisponible',
        description: "Ce compte ne peut pas accéder au service actuellement. Si vous pensez qu'il s'agit d'une erreur, contactez l'assistance Medilink.",
      };
    default:
      return {
        title: 'Accès non autorisé',
        description: 'Vous ne disposez pas des autorisations nécessaires pour ouvrir cet espace.',
      };
  }
}

/** Only 403 with the backend's explicit verified-email message supports this distinction. */
export function loginAccountIssue(error: unknown): PublicAccountIssue | null {
  const e = error as { status?: number; message?: string } | null;
  if (e?.status !== 403) return null;
  return typeof e.message === 'string' && /adresse e-mail.{0,80}vérifi|email.{0,80}verif|e-mail.{0,80}verif/i.test(e.message)
    ? 'verification'
    : 'restricted';
}
