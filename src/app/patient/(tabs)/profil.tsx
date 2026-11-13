import { RoutePlaceholder } from '@/components/navigation/route-placeholder';
import { LogoutButton } from '@/components/auth/logout-button';
import { View } from 'react-native';

export default function Route() {
  return <View style={{ flex: 1 }}><RoutePlaceholder title="Mon profil" description="Profil et dossier médical" /><LogoutButton /></View>;
}
