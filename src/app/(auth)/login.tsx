import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { loginAccountIssue } from '@/features/auth/account-states';
import { View } from 'react-native';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { useTheme } from '@/hooks/use-theme';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/primitives';
import { Input, PasswordField } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { authApi } from '@/services/auth';
import { activateLogin } from '@/features/auth/session';
import { authErrorMessage, validateLogin } from '@/features/auth/validation';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const locked = useRef(false);

  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  async function submit() {
    if (locked.current) return;
    const next = validateLogin(email, password);
    setErrors(next);
    if (Object.keys(next).length) return;
    locked.current = true;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    try {
      const response = await authApi.login(email.trim().toLowerCase(), password, controller.signal);
      if (!controller.signal.aborted) await activateLogin(response, controller.signal);
      // Protected Expo Router stack moves to the verified role's home.
    } catch (error) {
      if (!controller.signal.aborted) {
        const issue = loginAccountIssue(error);
        if (issue) router.replace({ pathname: '/account-status', params: { issue } });
        else setErrors({ form: authErrorMessage(error, 'login') });
      }
    } finally {
      locked.current = false;
      if (!controller.signal.aborted) setPending(false);
      activeRequest.current = null;
    }
  }

  return <AuthShell title="Bon retour parmi nous" subtitle="Connectez-vous pour retrouver vos rendez-vous et demandes.">
    <View style={{ gap: Spacing.three }}>
      <GoogleAuthButton disabled={pending} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.two }}>
        <View style={{ height: 1, flex: 1, backgroundColor: theme.border }} />
        <ThemedText type="small" themeColor="textSecondary">ou avec votre e-mail</ThemedText>
        <View style={{ height: 1, flex: 1, backgroundColor: theme.border }} />
      </View>
      {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
      <Input label="Adresse e-mail" value={email} onChangeText={setEmail}
        keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
        autoCapitalize="none" autoCorrect={false} error={errors.email}
        editable={!pending} placeholder="vous@exemple.com" />
      <PasswordField label="Mot de passe" value={password} onChangeText={setPassword}
        autoComplete="current-password" textContentType="password" error={errors.password}
        editable={!pending} placeholder="Votre mot de passe" />
      <View style={{ alignItems: 'flex-end' }}>
        <Link href="/forgot-password"><ThemedText type="linkPrimary">Mot de passe oublié ?</ThemedText></Link>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Votre connexion restera active sur cet appareil jusqu’à votre déconnexion,
        sauf expiration ou révocation de session.
      </ThemedText>
      <Button label="Se connecter" loading={pending} disabled={pending} onPress={() => { void submit(); }} />
      <View style={{ alignItems: 'center', gap: Spacing.two }}>
        <ThemedText themeColor="textSecondary">Pas encore de compte ?</ThemedText>
        <Link href="/choose-role"><ThemedText type="linkPrimary">Créer un compte</ThemedText></Link>
      </View>
    </View>
  </AuthShell>;
}
