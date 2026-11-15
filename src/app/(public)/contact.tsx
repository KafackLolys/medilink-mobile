import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Screen, Card, Header, Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { integrationApi } from '@/services/integration';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ContactPage() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  function validate() {
    const result: Record<string, string> = {};
    if (name.trim().length < 2 || name.length > 120) result.name = 'Nom requis (2 à 120 caractères).';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) result.email = 'Adresse e-mail invalide.';
    if (subject.trim().length < 3 || subject.length > 150) result.subject = 'Sujet requis (3 à 150 caractères).';
    if (message.trim().length < 10 || message.length > 5000) result.message = 'Message requis (10 à 5 000 caractères).';
    setErrors(result);
    return Object.keys(result).length === 0;
  }

  async function send() {
    if (busy.current || !validate()) return;
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setPending(true);
    setSuccess(false);
    try {
      await integrationApi.contact({
        name: name.trim(), email: email.trim().toLowerCase(),
        subject: subject.trim(), message: message.trim(),
      }, controller.signal);
      if (!controller.signal.aborted) {
        setMessage('');
        setSubject('');
        setErrors({});
        setSuccess(true);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        const err = cause as { kind?: string };
        setErrors({ form: err.kind === 'timeout' || err.kind === 'network' ?
          'Connexion interrompue. Vérifiez votre connexion et évitez de renvoyer un message déjà reçu.' :
          'Impossible d’enregistrer votre message. Vérifiez vos informations et réessayez.' });
      }
    } finally {
      busy.current = false;
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <Screen>
    <Header title="Contact" subtitle="Une question, un problème, une demande concernant vos données ? Écrivez-nous." />
    <Card style={{ padding: Spacing.four }}>
      {success ? <ThemedText type="smallBold" themeColor="success" accessibilityRole="alert">
        Votre message a été enregistré. Notre équipe pourra le consulter.
      </ThemedText> : null}
      {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
      <Input label="Nom" value={name} onChangeText={setName} error={errors.name}
        autoComplete="name" editable={!pending} maxLength={120} />
      <Input label="E-mail" value={email} onChangeText={setEmail} error={errors.email}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoComplete="email" editable={!pending} maxLength={254} />
      <Input label="Sujet" value={subject} onChangeText={setSubject} error={errors.subject}
        editable={!pending} maxLength={150} />
      <Input label="Message" value={message} onChangeText={setMessage} error={errors.message}
        editable={!pending} multiline numberOfLines={6} maxLength={5000} />
      <Button label="Envoyer le message" loading={pending} disabled={pending}
        onPress={() => { void send(); }} />
    </Card>
    <View style={{ gap: Spacing.two, paddingVertical: Spacing.three }}>
      <ThemedText type="smallBold">Urgence médicale</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        MediLink n’est pas un service d’urgence. Contactez directement les services d’urgence de votre pays.
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Les messages transmis par ce formulaire ne sont pas destinés à une demande de prise en charge médicale urgente.
      </ThemedText>
    </View>
  </Screen>;
}
