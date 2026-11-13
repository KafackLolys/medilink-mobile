import { Link, Redirect } from 'expo-router';
import { View } from 'react-native';
import { Screen, Header, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { roleHome, useNavigationSession } from '@/store/navigation-session';
import { LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';

const INTRO_STEPS = [
  { title: 'Trouvez un médecin', body: 'Consultez les profils et les disponibilités proposées.' },
  { title: 'Décrivez votre besoin', body: 'Présentez votre situation pour recevoir des propositions.' },
  { title: 'Organisez votre rendez-vous', body: 'Choisissez le mode et la date adaptés avec le professionnel.' },
] as const;

/** Public introduction only; it never invents doctor or appointment data. */
export default function Index() {
  const session = useNavigationSession(state => state.session);
  if (session.status === 'loading') return <Screen><LoadingState label="Vérification de votre session…" /></Screen>;
  if (session.status === 'authenticated') return <Redirect href={roleHome(session.role)} />;

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold" themeColor="primary">MEDILINK</ThemedText>
        <Header title="La santé, plus proche de vous"
          subtitle="Trouvez un médecin ou publiez un besoin médical, depuis votre téléphone." />
      </View>
      {INTRO_STEPS.map((step, index) => (
        <Card key={step.title}>
          <ThemedText type="smallBold" themeColor="primary">Étape {index + 1}</ThemedText>
          <ThemedText type="subtitle">{step.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{step.body}</ThemedText>
        </Card>
      ))}
      <Card>
        <Link href="/login" accessibilityRole="link">
          <ThemedText type="linkPrimary">Se connecter</ThemedText>
        </Link>
        <Link href="/choose-role" accessibilityRole="link">
          <ThemedText type="linkPrimary">Créer un compte</ThemedText>
        </Link>
        <Link href="/aide">
          <ThemedText themeColor="textSecondary" type="small">Besoin d’aide ?</ThemedText>
        </Link>
      </Card>
    </Screen>
  );
}
