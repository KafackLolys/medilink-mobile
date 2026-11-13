import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AuthShell } from '@/components/auth/auth-shell';
import { Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function ChooseRole() {
  return <AuthShell title="Créer votre compte" subtitle="Qui êtes-vous ? Votre espace s’adapte à votre profil.">
    <View style={{ gap: Spacing.three }}>
      <Link href={{ pathname: '/register', params: { role: 'patient' } }} asChild>
        <Pressable accessibilityRole="link">
          <Card><ThemedText type="subtitle">Je suis patient</ThemedText>
            <ThemedText themeColor="textSecondary">Trouver un médecin ou publier un besoin médical.</ThemedText></Card>
        </Pressable>
      </Link>
      <Link href={{ pathname: '/register', params: { role: 'doctor' } }} asChild>
        <View accessible accessibilityRole="link">
          <Card><ThemedText type="subtitle">Je suis médecin</ThemedText>
            <ThemedText themeColor="textSecondary">Consulter les besoins des patients et proposer mes services.</ThemedText></Card>
        </View>
      </Link>
      <Link href="/login"><ThemedText type="linkPrimary">Déjà inscrit ? Se connecter</ThemedText></Link>
    </View>
  </AuthShell>;
}
