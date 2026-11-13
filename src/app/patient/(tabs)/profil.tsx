import { RoutePlaceholder } from '@/components/navigation/route-placeholder';
import { LogoutButton } from '@/components/auth/logout-button';

export default function Route() {
  return <RoutePlaceholder title="Mon profil" description="Profil et dossier médical" ><LogoutButton /></RoutePlaceholder>;
}
