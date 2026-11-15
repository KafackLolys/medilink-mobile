import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card } from '@/components/ui/primitives';
import { Input, PasswordField } from '@/components/ui/form-fields';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { adminApi } from '@/services/admin';
import { HttpError } from '@/services/http';

type Fields = { firstName: string; lastName: string; email: string; phone: string; password: string };
const blank: Fields = { firstName: '', lastName: '', email: '', phone: '', password: '' };

/**
 * Creates admins only through POST /admin/admins (server-side AdminGuard).
 * Temporary passwords remain in component memory, never logs or durable caches.
 */
export function CreateAdminForm({ enabled, onCreated }: { enabled: boolean; onCreated: () => void }) {
  const [fields, setFields] = useState<Fields>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => { abort.current?.abort(); }, []);

  function change(name: keyof Fields, value: string) {
    setFields(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: '', form: '' }));
    setSuccess('');
  }

  function validate(): boolean {
    const issues: Record<string, string> = {};
    if (!fields.firstName.trim() || fields.firstName.trim().length > 80) issues.firstName = 'Prénom requis (80 caractères maximum).';
    if (!fields.lastName.trim() || fields.lastName.trim().length > 80) issues.lastName = 'Nom requis (80 caractères maximum).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) issues.email = 'Adresse e-mail invalide.';
    if (fields.phone.trim() && !/^[+0-9() .-]{6,30}$/.test(fields.phone.trim())) issues.phone = 'Numéro de téléphone invalide.';
    if (fields.password.length < 12) issues.password = 'Choisissez un mot de passe provisoire d’au moins 12 caractères.';
    setErrors(issues);
    return Object.keys(issues).length === 0;
  }

  function openReview() {
    if (!enabled || saving || !validate()) return;
    setReview(true);
  }

  async function confirm() {
    if (!enabled || busy.current || !validate()) return;
    busy.current = true;
    const request = new AbortController();
    abort.current = request;
    setSaving(true);
    setErrors({});
    try {
      await adminApi.createAdmin({
        firstName: fields.firstName.trim(), lastName: fields.lastName.trim(),
        email: fields.email.trim().toLowerCase(), password: fields.password,
        ...(fields.phone.trim() ? { phone: fields.phone.trim() } : {}),
      }, request.signal);
      if (request.signal.aborted) return;
      // Erase the temporary password before displaying success or refreshing the list.
      setFields(blank);
      setReview(false);
      setSuccess('Administrateur créé. Transmettez son accès par un canal sécurisé.');
      onCreated();
    } catch (cause) {
      if (request.signal.aborted) return;
      const err = cause as HttpError;
      setReview(false);
      setErrors({ form: err.status === 409 ? 'Un compte utilise déjà cette adresse e-mail.' :
        err.status === 403 ? 'Votre compte ne dispose plus du droit de créer un administrateur.' :
        err.kind === 'network' || err.kind === 'timeout' ?
          'Connexion interrompue. Vérifiez le compte dans la liste avant de réessayer pour éviter un doublon.' :
          'La création a échoué. Vérifiez les informations et réessayez.' });
    } finally {
      busy.current = false;
      abort.current = null;
      if (!request.signal.aborted) setSaving(false);
    }
  }

  if (!enabled) return null;
  return <Card style={{ marginTop: Spacing.four, padding: Spacing.four }}>
    <ThemedText type="subtitle" accessibilityRole="header">Ajouter un administrateur</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">
      Le compte sera actif dès sa création. Conservez le mot de passe provisoire avant de confirmer,
      puis transmettez-le par un canal sécurisé.
    </ThemedText>
    <View style={{ gap: Spacing.three, paddingTop: Spacing.two }}>
      <Input label="Prénom" value={fields.firstName} onChangeText={value => change('firstName', value)}
        error={errors.firstName} autoComplete="given-name" editable={!saving} maxLength={80} />
      <Input label="Nom" value={fields.lastName} onChangeText={value => change('lastName', value)}
        error={errors.lastName} autoComplete="family-name" editable={!saving} maxLength={80} />
      <Input label="Adresse e-mail" value={fields.email} onChangeText={value => change('email', value)}
        error={errors.email} keyboardType="email-address" autoCapitalize="none"
        autoComplete="email" autoCorrect={false} editable={!saving} />
      <Input label="Téléphone (facultatif)" value={fields.phone} onChangeText={value => change('phone', value)}
        error={errors.phone} keyboardType="phone-pad" autoComplete="tel" editable={!saving} maxLength={30} />
      <PasswordField label="Mot de passe provisoire" value={fields.password}
        onChangeText={value => change('password', value)} error={errors.password}
        autoComplete="new-password" editable={!saving}
        hint="12 caractères minimum. Ne partagez jamais ce mot de passe par message non sécurisé." />
      {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
      {success ? <ThemedText themeColor="success" accessibilityRole="alert">{success}</ThemedText> : null}
      <Button label="Créer le compte administrateur" loading={saving}
        disabled={saving} onPress={openReview} />
    </View>
    <Modal visible={review} title="Confirmer la création d’administrateur"
      description={'Vous êtes sur le point de créer un compte administrateur actif pour ' +
        fields.email.trim().toLowerCase() + '. Il disposera des permissions de gestion des utilisateurs.'}
      confirmLabel="Créer cet administrateur" busy={saving}
      onClose={() => { if (!saving) setReview(false); }}
      onConfirm={() => { void confirm(); }}>
      <ThemedText type="small" themeColor="textSecondary">
        Vérifiez l’identité et l’adresse e-mail du destinataire avant de confirmer.
        Le mot de passe provisoire ne sera plus visible après la création.
      </ThemedText>
    </Modal>
  </Card>;
}
