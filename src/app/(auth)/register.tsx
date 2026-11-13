import { useEffect, useRef, useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button, Card } from '@/components/ui/primitives';
import { Input, PasswordField, SelectField } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { authApi } from '@/services/auth';
import { authErrorMessage, validateRegistration, type RegisterForm } from '@/features/auth/validation';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const specialties = [
  'Médecine générale', 'Pédiatrie', 'Cardiologie', 'Dermatologie',
  'Gynécologie', 'Neurologie', 'Kinésithérapie', 'Autre',
];
const emptyForm = (role: 'patient' | 'doctor'): RegisterForm => ({
  role, firstName: '', lastName: '', email: '', phone: '', password: '',
  specialty: '', registrationNumber: '', confirmPassword: '', acceptedTerms: false,
});

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  // Do not trust route params as an API role. Reject anything other than two public roles.
  const initialRole = params.role === 'doctor' ? 'doctor' : 'patient';
  const [form, setForm] = useState<RegisterForm>(() => emptyForm(initialRole));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const locked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const theme = useTheme();

  useEffect(() => () => { request.current?.abort(); }, []);

  function update<K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '', form: '' }));
  }

  async function submit() {
    if (locked.current) return;
    const next = validateRegistration(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    locked.current = true;
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const { firstName, lastName, email, phone, password, role, specialty, registrationNumber } = form;
      await authApi.register({
        firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim().toLowerCase(), phone: phone.trim(), password, role,
        ...(role === 'doctor' ? {
          specialty: specialty?.trim(), registrationNumber: registrationNumber?.trim(),
        } : {}),
      }, controller.signal);
      // API sends verification email. Do not activate the returned tokens here.
      if (!controller.signal.aborted) setDone(true);
    } catch (error) {
      if (!controller.signal.aborted) setErrors({ form: authErrorMessage(error, 'register') });
    } finally {
      locked.current = false;
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  if (done) return <AuthShell title="E-mail de confirmation envoyé" subtitle="Votre compte a été créé.">
    <View style={{ gap: Spacing.three }}>
      <ThemedText>
        Un e-mail de vérification a été envoyé à {form.email.trim()}.
        Consultez votre boîte de réception et les courriers indésirables,
        puis confirmez votre adresse avant de vous connecter.
      </ThemedText>
      {form.role === 'doctor' ? <ThemedText themeColor="textSecondary">
        Votre compte médecin sera ensuite soumis à la vérification professionnelle.
      </ThemedText> : null}
      <Link href="/login"><ThemedText type="linkPrimary">Retour à la connexion</ThemedText></Link>
    </View>
  </AuthShell>;

  return <AuthShell title={form.role === 'doctor' ? 'Votre compte médecin' : 'Votre compte patient'}
    subtitle="Renseignez vos informations pour créer votre compte.">
    <View style={{ gap: Spacing.three }}>
      <ThemedText type="smallBold">Type de compte</ThemedText>
      <SelectField label="Choisissez votre profil" value={form.role}
        onChange={value => update('role', value === 'doctor' ? 'doctor' : 'patient')}
        options={[{ value: 'patient', label: 'Patient' }, { value: 'doctor', label: 'Médecin' }]} />
      <Input label="Prénom" value={form.firstName} onChangeText={value => update('firstName', value)}
        error={errors.firstName} editable={!pending} autoComplete="given-name" textContentType="givenName" />
      <Input label="Nom" value={form.lastName} onChangeText={value => update('lastName', value)}
        error={errors.lastName} editable={!pending} autoComplete="family-name" textContentType="familyName" />
      <Input label="Adresse e-mail" value={form.email} onChangeText={value => update('email', value)}
        error={errors.email} editable={!pending} keyboardType="email-address" autoCapitalize="none"
        autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <Input label="Téléphone" value={form.phone} onChangeText={value => update('phone', value)}
        error={errors.phone} editable={!pending} keyboardType="phone-pad" autoComplete="tel"
        textContentType="telephoneNumber" hint="Avec l'indicatif du pays." />
      <PasswordField label="Mot de passe" value={form.password}
        onChangeText={value => update('password', value)} error={errors.password} editable={!pending}
        autoComplete="new-password" textContentType="newPassword"
        hint="8 caractères minimum, avec majuscule, chiffre ou symbole." />
      <PasswordField label="Confirmer le mot de passe" value={form.confirmPassword}
        onChangeText={value => update('confirmPassword', value)}
        error={errors.confirmPassword} editable={!pending} autoComplete="new-password" />
      {form.role === 'doctor' ? <View style={{ gap: Spacing.three }}>
        <SelectField label="Spécialité" value={form.specialty ?? ''}
          options={specialties.map(value => ({ label: value, value }))}
          onChange={value => update('specialty', value)} error={errors.specialty} />
        <Input label="Numéro d'inscription professionnelle" value={form.registrationNumber ?? ''}
          onChangeText={value => update('registrationNumber', value)}
          error={errors.registrationNumber} editable={!pending} />
        <Card><ThemedText themeColor="textSecondary" type="small">
          Votre compte sera vérifié avant l'accès aux besoins des patients.
          Vous pourrez transmettre vos justificatifs après confirmation de votre e-mail.
        </ThemedText></Card>
      </View> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.acceptedTerms }}
        disabled={pending} onPress={() => update('acceptedTerms', !form.acceptedTerms)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48 }}>
        <View style={{ width: 24, height: 24, borderWidth: 2, borderRadius: 5,
          borderColor: errors.acceptedTerms ? theme.danger : theme.primary,
          backgroundColor: form.acceptedTerms ? theme.primary : 'transparent',
          alignItems: 'center', justifyContent: 'center' }}>
          {form.acceptedTerms ? <ThemedText style={{ color: theme.onPrimary }}>✓</ThemedText> : null}
        </View>
        <ThemedText type="small">J'accepte les conditions d'utilisation et la politique de confidentialité.</ThemedText>
      </Pressable>
      {errors.acceptedTerms ? <ThemedText themeColor="danger" type="small">{errors.acceptedTerms}</ThemedText> : null}
      <View style={{ flexDirection: 'row', gap: Spacing.three }}>
        <Link href="/terms"><ThemedText type="linkPrimary">Conditions</ThemedText></Link>
        <Link href="/privacy"><ThemedText type="linkPrimary">Confidentialité</ThemedText></Link>
      </View>
      {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
      <Button label="Créer mon compte" loading={pending} disabled={pending} onPress={() => { void submit(); }} />
      <Link href="/login"><ThemedText type="linkPrimary" style={{ textAlign: 'center' }}>Déjà inscrit ? Se connecter</ThemedText></Link>
    </View>
  </AuthShell>;
}
