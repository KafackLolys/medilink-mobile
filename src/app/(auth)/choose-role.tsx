import { useRef, useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Circle, Stethoscope, UserRound } from 'lucide-react-native';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { Button } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import {
  describeGoogleError, finishGoogleRegistration, hasPendingGoogleRegistration,
} from '@/features/auth/google-auth';

type RegisterRole = 'patient' | 'doctor';
const roles = [
  { role: 'patient' as const, title: 'Je suis patient', description: 'Trouver un médecin ou publier un besoin médical.' },
  { role: 'doctor' as const, title: 'Je suis médecin', description: 'Consulter les besoins des patients et proposer mes services.' },
];

export default function ChooseRole() {
  const router = useRouter();
  const { google } = useLocalSearchParams<{ google?: string }>();
  const theme = useTheme();
  const googleFlow = google === '1';
  const pendingGoogle = googleFlow && hasPendingGoogleRegistration();
  const [selected, setSelected] = useState<RegisterRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  async function continueRegistration() {
    if (!selected || locked.current) return;
    if (!googleFlow) {
      router.push({ pathname: '/register', params: { role: selected } });
      return;
    }
    if (!pendingGoogle) {
      setError('La session Google a expiré. Recommencez la connexion.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await finishGoogleRegistration(selected);
      // SessionManager routes to patient or doctor only after server verification.
    } catch (cause) {
      setError(describeGoogleError(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <AuthShell title="Créer votre compte"
    subtitle={googleFlow ? 'Votre compte Google est prêt. Choisissez votre espace MediLink.' :
      'Qui êtes-vous ? Votre espace s’adapte à votre profil.'} step={1}>
    <View style={{ gap: Spacing.three }}>
      {googleFlow && !pendingGoogle ? <ThemedText themeColor="danger" accessibilityRole="alert">
        La validation Google a expiré. Recommencez avec le bouton ci-dessous.
      </ThemedText> : null}
      {roles.map(item => {
        const checked = selected === item.role;
        return <Pressable key={item.role} accessibilityRole="radio" accessibilityLabel={item.title}
          accessibilityState={{ checked }} disabled={busy}
          onPress={() => { setSelected(item.role); setError(''); }}
          style={[styles.option, {
            borderColor: checked ? theme.primary : theme.border,
            backgroundColor: theme.backgroundElement,
          }]}>
          <View style={[styles.icon, { backgroundColor: theme.infoSurface }]}>
            {item.role === 'patient'
              ? <UserRound size={26} color={theme.textSecondary} />
              : <Stethoscope size={26} color={theme.textSecondary} />}
          </View>
          <View style={{ flex: 1, gap: Spacing.one }}>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>{item.title}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">{item.description}</ThemedText>
          </View>
          <Circle size={23} color={checked ? theme.primary : theme.border}
            fill={checked ? theme.primary : 'transparent'} />
        </Pressable>;
      })}
      {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
      <Button label={googleFlow ? 'Terminer mon inscription' : 'Continuer'}
        disabled={!selected || busy || (googleFlow && !pendingGoogle)}
        loading={busy} onPress={() => { void continueRegistration(); }} />
      {googleFlow ? <GoogleAuthButton label="Recommencer avec Google" disabled={busy} /> :
        <View style={{ gap: Spacing.three }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <ThemedText type="small" themeColor="textSecondary">ou</ThemedText>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>
          <GoogleAuthButton label="S’inscrire avec Google" disabled={busy} />
        </View>}
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5, marginTop: Spacing.two }}>
        <ThemedText themeColor="textSecondary">Déjà inscrit ?</ThemedText>
        <Link href="/login"><ThemedText type="linkPrimary">Se connecter</ThemedText></Link>
      </View>
    </View>
  </AuthShell>;
}
const styles = StyleSheet.create({
  option: {
    minHeight: 124, borderWidth: 1.5, borderRadius: Radius.xlarge,
    flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.three,
  },
  icon: {
    width: 58, height: 58, borderRadius: Radius.xlarge,
    alignItems: 'center', justifyContent: 'center',
  },
});
