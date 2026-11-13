import { Link } from 'expo-router';
import { Screen, Header } from '@/components/ui/primitives';
import { ErrorState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';

export default function NotFound() {
  return <Screen><Header title="Page introuvable" />
    <ErrorState title="Cette page n'existe pas" description="Vérifiez le lien utilisé." />
    <Link href="/"><ThemedText themeColor="primary" type="linkPrimary">Retour à l'accueil</ThemedText></Link>
  </Screen>;
}
