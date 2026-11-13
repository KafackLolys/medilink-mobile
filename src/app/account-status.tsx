import { Link, useLocalSearchParams } from 'expo-router';
import { Screen, Header, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { accountIssueMessage, type PublicAccountIssue } from '@/features/auth/account-states';

export default function AccountStatusScreen() {
  const params = useLocalSearchParams<{ issue?: string }>();
  const issue: PublicAccountIssue = params.issue === 'verification' ? 'verification'
    : params.issue === 'restricted' ? 'restricted' : 'unauthorized';
  const text = accountIssueMessage(issue);
  return (
    <Screen>
      <Header title="État d'accès" />
      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">{text.title}</ThemedText>
        <ThemedText themeColor="textSecondary">{text.description}</ThemedText>
      </Card>
      <Link href="/login"><ThemedText type="linkPrimary">Retour à la connexion</ThemedText></Link>
      <Link href="/contact"><ThemedText type="linkPrimary">Contacter l'assistance</ThemedText></Link>
    </Screen>
  );
}
