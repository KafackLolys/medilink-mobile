import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { CheckCircle2, Circle, Stethoscope, UserRound } from 'lucide-react-native';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { Button, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { discardPendingGoogleRegistration, finishGoogleRegistration, hasPendingGoogleRegistration } from '@/features/auth/google-sign-in';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Role = 'patient' | 'doctor';
const options = [
  { value: 'patient', title: 'Je suis patient', description: 'Trouver un médecin ou publier un besoin médical.', Icon: UserRound },
  { value: 'doctor', title: 'Je suis médecin', description: 'Consulter les besoins des patients et proposer mes services.', Icon: Stethoscope },
] as const;

export default function ChooseRole() {
  const router = useRouter();
  const { google } = useLocalSearchParams<{ google?: string }>();
  const fromGoogle = google === '1';
  const theme = useTheme();
  const [role, setRole] = useState<Role | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const hasGoogleIdentity = fromGoogle && hasPendingGoogleRegistration();

  async function continueRegistration() {
    if (!role || pending) return;
    setError('');
    if (!fromGoogle) {
      router.push({ pathname: '/register', params: { role } });
      return;
    }
    if (!hasPendingGoogleRegistration()) {
      setError('La session Google a expiré. Sélectionnez de nouveau votre compte Google.');
      return;
    }
    setPending(true);
    try {
      await finishGoogleRegistration(role);
      // On success, the verified backend role controls protected navigation.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création de compte impossible.');
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (pending) return;
    await discardPendingGoogleRegistration();
    router.replace('/login');
  }

  return <AuthShell title={fromGoogle ? 'Bienvenue sur MediLink' : 'Créer votre compte'}
    subtitle={fromGoogle ? 'Votre compte Google est reconnu. Choisissez votre espace.' : 'Qui êtes-vous ? Votre espace s’adapte à votre profil.'}>
    <View style={{ gap: Spacing.three }}>
      <ThemedText type="smallBold" themeColor="textSecondary">Étape 1 sur 2</ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ height: 6, flex: 1, borderRadius: 6, backgroundColor: theme.primary }} />
        <View style={{ height: 6, flex: 1, borderRadius: 6, backgroundColor: theme.border }} />
      </View>
      {options.map(option => {
        const selected = role === option.value;
        const Icon = option.Icon;
        return <Pressable key={option.value}
          accessibilityRole="radio" accessibilityLabel={option.title}
          accessibilityState={{ selected, disabled: pending }}
          disabled={pending} onPress={() => { setRole(option.value); setError(''); }}>
          <Card style={{
            borderWidth: selected ? 2 : 1, borderColor: selected ? theme.primary : theme.border,
            backgroundColor: selected ? theme.infoSurface : theme.backgroundElement,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
              <View style={{
                backgroundColor: theme.background, borderRadius: 12,
                width: 56, height: 56, alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={27} color={selected ? theme.primary : theme.textSecondary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold">{option.title}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">{option.description}</ThemedText>
              </View>
              {selected ? <CheckCircle2 size={24} color={theme.primary} /> : <Circle size={24} color={theme.border} />}
            </View>
          </Card>
        </Pressable>;
      })}
      {role === 'doctor' && fromGoogle ? <ThemedText type="small" themeColor="textSecondary">
        La validation de vos justificatifs professionnels sera nécessaire avant de proposer des consultations.
      </ThemedText> : null}
      {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
      <Button label={fromGoogle ? 'Créer mon espace' : 'Continuer'}
        onPress={() => { void continueRegistration(); }}
        disabled={!role || pending || (fromGoogle && !hasGoogleIdentity)} loading={pending} />
      {fromGoogle ? <>
        {!hasGoogleIdentity ? <GoogleAuthButton label="Recommencer avec Google" /> : null}
        <Button label="Annuler" variant="outline" disabled={pending} onPress={() => { void cancel(); }} />
      </> : <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <View style={{ height: 1, flex: 1, backgroundColor: theme.border }} />
          <ThemedText themeColor="textSecondary" type="small">ou</ThemedText>
          <View style={{ height: 1, flex: 1, backgroundColor: theme.border }} />
        </View>
        <GoogleAuthButton label="S’inscrire avec Google" />
        <View style={{ flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', flexWrap: 'wrap', marginTop: Spacing.two }}>
          <ThemedText themeColor="textSecondary">Déjà inscrit ?</ThemedText>
          <Link href="/login"><ThemedText type="linkPrimary">Se connecter</ThemedText></Link>
        </View>
      </>}
    </View>
  </AuthShell>;
}
