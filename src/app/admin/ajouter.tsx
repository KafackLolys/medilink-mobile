import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, Header, Button } from '@/components/ui/primitives';
import { Input, PasswordField } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authApi } from '@/services/auth';
import { adminApi } from '@/services/admin';
import { useNavigationSession } from '@/store/navigation-session';

type CreateAdminForm = {
  firstName: string; lastName: string; email: string; phone: string; password: string;
};
const blank: CreateAdminForm = { firstName: '', lastName: '', email: '', phone: '', password: '' };

export default function CreateAdminScreen() {
  const router = useRouter();
  const session = useNavigationSession(state => state.session);
  const authorized = session.status === 'authenticated' && session.role === 'admin' && session.accountStatus === 'active';
  const [form, setForm] = useState<CreateAdminForm>(blank);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    // Password is never saved in AsyncStorage, SecureStore or a navigation param.
  }, []);

  function update(field: keyof CreateAdminForm, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
  }

  async function create() {
    if (!authorized || lock.current) return;
    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };
    if (!body.firstName || !body.lastName || !/^\S+@\S+\.\S+$/.test(body.email) || body.password.length < 8) {
      setError('Renseignez le prénom, le nom, une adresse e-mail valide et un mot de passe de 8 caractères minimum.');
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const me = await authApi.profile(controller.signal);
      if (me.user.role !== 'admin' || me.user.status !== 'active') {
        throw new Error('Votre accès administrateur n’est plus autorisé.');
      }
      const created = await adminApi.createAdmin(body, controller.signal);
      if (controller.signal.aborted) return;
      if (created.status !== 'active' || created.email?.toLowerCase() !== body.email) {
        throw new Error('La création a été reçue, mais la confirmation du compte est incohérente. Vérifiez les comptes avant de réessayer.');
      }
      setForm(blank);
      Alert.alert('Administrateur créé',
        'Le compte est actif. Transmettez le mot de passe provisoire par un canal sécurisé et demandez son changement à la première connexion.',
        [{ text: 'Terminer', onPress: () => router.back() }]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'La création du compte a échoué.');
      // A timed-out POST may have succeeded. Never automatically retry creation.
    } finally {
      lock.current = false;
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function confirmCreation() {
    if (!authorized || pending) return;
    Alert.alert('Créer un administrateur actif ?',
      'Ce compte bénéficiera des droits d’administration dès sa création. Vérifiez attentivement son adresse e-mail.',
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Créer le compte', onPress: () => { void create(); } }]);
  }

  if (!authorized) return <Screen>
    <Header title="Accès non autorisé" subtitle="Seul un administrateur actif peut créer un compte administrateur." />
    <Button label="Retour" variant="outline" onPress={() => router.back()} />
  </Screen>;

  return <Screen>
    <Header title="Ajouter un administrateur"
      subtitle="Créez un compte avec les droits d’administration. L’opération exige une confirmation." onBack={() => router.back()} />
    <Card style={{ gap: Spacing.three }}>
      <ThemedText themeColor="textSecondary" type="small">
        Le compte sera actif dès sa création. Le mot de passe provisoire devra être transmis par un canal sécurisé.
      </ThemedText>
      {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
      <Input label="Prénom" value={form.firstName} onChangeText={value => update('firstName', value)}
        editable={!pending} autoComplete="given-name" maxLength={80} />
      <Input label="Nom" value={form.lastName} onChangeText={value => update('lastName', value)}
        editable={!pending} autoComplete="family-name" maxLength={80} />
      <Input label="Adresse e-mail" value={form.email} onChangeText={value => update('email', value)}
        editable={!pending} autoComplete="email" keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false} maxLength={254} />
      <Input label="Téléphone (facultatif)" value={form.phone} onChangeText={value => update('phone', value)}
        editable={!pending} autoComplete="tel" keyboardType="phone-pad" maxLength={30} />
      <PasswordField label="Mot de passe provisoire" value={form.password}
        onChangeText={value => update('password', value)} editable={!pending}
        autoComplete="new-password" textContentType="newPassword" />
      <Button label="Créer le compte administrateur" loading={pending} disabled={pending}
        onPress={confirmCreation} />
    </Card>
    <View style={{ paddingHorizontal: Spacing.two }}>
      <ThemedText type="small" themeColor="textSecondary">
        Le serveur contrôle à nouveau vos autorisations. Aucune création ne sera répétée automatiquement après une erreur réseau.
      </ThemedText>
    </View>
  </Screen>;
}
