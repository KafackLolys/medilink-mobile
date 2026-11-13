import { RoutePlaceholder } from '@/components/navigation/route-placeholder';
import { PendingAccountNotice } from '@/components/auth/pending-account-notice';

export default function Route() {
  return <RoutePlaceholder title="Tableau de bord médecin" description="Accueil professionnel"  ><PendingAccountNotice /></RoutePlaceholder>;
}
