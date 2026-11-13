import { RoutePlaceholder } from '@/components/navigation/route-placeholder';
import { LogoutButton } from '@/components/auth/logout-button';
import { View } from 'react-native';

export default function Route() {
  return <View style={{ flex: 1 }}><RoutePlaceholder title="Profil médecin" description="Informations professionnelles" /><LogoutButton /></View>;
}
