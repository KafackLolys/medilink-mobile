import { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { Screen, Header, Card, Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { integrationApi } from '@/services/integration';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Fields = { name: string; email: string; subject: string; message: string };
const empty: Fields = { name: '', email: '', subject: '', message: '' };

export default function ContactScreen() {
  const theme = useTheme();
  const [form, setForm] = useState<Fields>(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => { active.current?.abort(); }, []);

  function update(key: keyof Fields, value: string) {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
    setSuccess(false);
  }

  async function submit() {
    if (locked.current) return;
    const values = {
      name: form.name.trim(), email: form.email.trim().toLowerCase(),
      subject: form.subject.trim(), message: form.message.trim(),
    };
    if (values.name.length < 2 || values.name.length > 120 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254 ||
        values.subject.length < 3 || values.subject.length > 150 ||
        values.message.length < 10 || values.message.length > 5000) {
      setError('Vérifiez les champs : nom (2 à 120 caractères), e-mail valide, sujet (3 à 150 caractères) et message (10 à 5 000 caractères).');
      return;
    }
    locked.current = true;
    setPending(true);
    setError('');
    const controller = new AbortController();
    active.current = controller;
    try {
      await integrationApi.contact(values, controller.signal);
      if (!controller.signal.aborted) {
        setSuccess(true);
        setForm(current => ({ ...current, subject: '', message: '' }));
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'L’envoi du message a échoué.');
    } finally {
      locked.current = false;
      if (!controller.signal.aborted) setPending(false);
      active.current = null;
    }
  }

  return <Screen>
    <Header title="Contact" subtitle="Une question, un problème ou une demande concernant vos données ? Écrivez-nous." />
    <Card style={{ gap: Spacing.three }}>
      {success ? <View style={{ padding: Spacing.three, borderRadius: 12, backgroundColor: theme.successSurface }}>
        <ThemedText themeColor="success" type="smallBold" accessibilityRole="alert">
          Votre message a été enregistré. Notre équipe pourra le consulter.
        </ThemedText>
      </View> : null}
      {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
      <Input label="Nom" value={form.name} onChangeText={value => update('name', value)}
        maxLength={120} autoComplete="name" editable={!pending} />
      <Input label="E-mail" value={form.email} onChangeText={value => update('email', value)}
        maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoComplete="email" editable={!pending} />
      <Input label="Sujet" value={form.subject} onChangeText={value => update('subject', value)}
        maxLength={150} editable={!pending} />
      <Input label="Message" value={form.message} onChangeText={value => update('message', value)}
        maxLength={5000} multiline numberOfLines={6} editable={!pending} />
      <Button label="Envoyer le message" loading={pending} disabled={pending} onPress={() => { void submit(); }} />
    </Card>
    <Card style={{ backgroundColor: theme.infoSurface }}>
      <ThemedText type="smallBold">Urgence médicale</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        MediLink n’est pas un service d’urgence. Contactez directement les services d’urgence de votre pays.
      </ThemedText>
    </Card>
    <View style={{ flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' }}>
      <Link href="/aide"><ThemedText type="linkPrimary">Aide</ThemedText></Link>
      <Link href="/privacy"><ThemedText type="linkPrimary">Confidentialité</ThemedText></Link>
    </View>
  </Screen>;
}
