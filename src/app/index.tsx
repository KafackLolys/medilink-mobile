import { Redirect, Link } from 'expo-router';
import { Screen, Header, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { roleHome, useNavigationSession } from '@/store/navigation-session';
import { LoadingState } from '@/components/ui/states';

export default function Index() {
  const session = useNavigationSession(state => state.session);
  if (session.status === 'loading') return <Screen><LoadingState label="Vérification de votre session…" /></Screen>;
  if (session.status === 'authenticated') return <Redirect href={roleHome(session.role)} />;
  return (
    <Screen>
      <Header title="Medilink" subtitle="Application Android — navigation en préparation" />
      <Card>
        <ThemedText>
          La connexion et les parcours métier seront reliés à l'API dans les prochaines étapes.
        </ThemedText>
        <Link href="/login"><ThemedText themeColor="primary" type="linkPrimary">Se connecter</ThemedText></Link>
        <Link href="/choose-role"><ThemedText themeColor="primary" type="linkPrimary">Créer un compte</ThemedText></Link>
        <Link href="/aide"><ThemedText themeColor="primary" type="linkPrimary">Aide</ThemedText></Link>
      </Card>
    </Screen>
  );
}
