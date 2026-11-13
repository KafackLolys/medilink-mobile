import { Card, Badge } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useNavigationSession } from '@/store/navigation-session';

/**
 * The API allows pending doctor login but does not make the account verified.
 * This is informational: server-side guards remain responsible for restrictions.
 */
export function PendingAccountNotice() {
  const session = useNavigationSession(state => state.session);
  if (session.status !== 'authenticated' || session.role !== 'doctor'
    || session.accountStatus !== 'pending') return null;
  return (
    <Card>
      <Badge tone="warning" label="Vérification en attente" />
      <ThemedText type="smallBold">Votre compte médecin est en cours de validation.</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Vous pourrez fournir vos justificatifs dans votre profil.
        Certaines fonctionnalités restent soumises à la vérification du backend.
      </ThemedText>
    </Card>
  );
}
