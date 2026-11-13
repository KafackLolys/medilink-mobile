import { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button, Card } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { authApi } from '@/services/auth';
import { Spacing } from '@/constants/theme';
import {
  RESET_CONFIRMATION, recoveryErrorMessage, validateRecoveryEmail,
} from '@/features/auth/account-states';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function submit() {
    if (locked.current) return;
    const validationError = validateRecoveryEmail(email);
    setError(validationError ?? '');
    setNotice('');
    if (validationError) return;

    locked.current = true;
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      await authApi.resetPassword({ email: email.trim().toLowerCase() }, controller.signal);
      if (!controller.signal.aborted) setNotice(RESET_CONFIRMATION);
    } catch (cause) {
      if (!controller.signal.aborted) {
        // Do not show any raw server error that could enumerate accounts.
        const safeMessage = recoveryErrorMessage(cause);
        if (safeMessage === RESET_CONFIRMATION) setNotice(safeMessage);
        else setError(safeMessage);
      }
    } finally {
      locked.current = false;
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <AuthShell title="Mot de passe oublié ?" subtitle="Réinitialisez votre mot de passe à l’aide de votre adresse e-mail.">
      <View style={{ gap: Spacing.three }}>
        {notice ? (
          <Card accessibilityLabel="Instructions de récupération">
            <ThemedText accessibilityRole="alert">{notice}</ThemedText>
          </Card>
        ) : (
          <>
            <ThemedText themeColor="textSecondary">
              Saisissez l’adresse utilisée pour votre compte Medilink.
              Nous ne confirmerons pas ici si cette adresse est enregistrée.
            </ThemedText>
            <Input label="Adresse e-mail" value={email}
              onChangeText={value => { setEmail(value); setError(''); }}
              keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
              autoCapitalize="none" autoCorrect={false} editable={!pending}
              placeholder="vous@exemple.com" error={validateRecoveryEmail(email) && error ? error : undefined}
              returnKeyType="send" onSubmitEditing={() => { void submit(); }} />
            {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
            <Button label="Envoyer le lien de réinitialisation" loading={pending} disabled={pending}
              onPress={() => { void submit(); }} />
          </>
        )}
        <Link href="/login">
          <ThemedText type="linkPrimary" style={{ textAlign: 'center' }}>Retour à la connexion</ThemedText>
        </Link>
      </View>
    </AuthShell>
  );
}
