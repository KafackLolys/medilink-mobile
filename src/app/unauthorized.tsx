import { Link } from 'expo-router';
import { Screen, Header } from '@/components/ui/primitives';
import { ErrorState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';

export default function Unauthorized() {
  return <Screen><Header title="Accès refusé" />
    <ErrorState title="Accès non autorisé" description="Votre compte ne dispose pas des droits requis." />
    <Link href="/"><ThemedText themeColor="primary" type="linkPrimary">Retour à l'accueil</ThemedText></Link>
  </Screen>;
}
