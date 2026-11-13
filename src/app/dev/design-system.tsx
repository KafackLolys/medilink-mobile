import { useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Badge, Avatar, Screen, Header } from '@/components/ui/primitives';
import { Input, PasswordField, SelectField, ToggleField } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Modal, useToast } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Interactive component gallery, opt-in via /dev/design-system.
 * Local demo data only; never linked to production health records or API.
 */
export default function DesignSystemGallery() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState('domicile');
  const [enabled, setEnabled] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen>
      <Header title="Galerie UI" subtitle="Composants de référence — données de démonstration" />
      <Card>
        <ThemedText type="subtitle">Boutons</ThemedText>
        <Button label="Action principale" onPress={() => showToast('Action de démonstration', 'success')} />
        <Button label="Action secondaire" variant="secondary" onPress={() => showToast('Action secondaire')} />
        <Button label="Contour" variant="outline" onPress={() => setDialogVisible(true)} />
        <Button label="Action destructive" variant="danger" onPress={() => setDialogVisible(true)} />
        <Button label="Chargement" loading={loading} onPress={() => {}} />
        <Button label={loading ? 'Arrêter le chargement' : 'Tester le chargement'} variant="ghost"
          onPress={() => setLoading(value => !value)} />
        <Button label="Désactivé" disabled onPress={() => {}} />
      </Card>
      <Card>
        <ThemedText type="subtitle">Identité et statuts</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' }}>
          <Avatar name="Exemple Utilisateur" />
          <Badge label="Confirmé" tone="success" />
          <Badge label="En attente" tone="warning" />
          <Badge label="Annulé" tone="danger" />
          <Badge label="Information" tone="info" />
          <Badge label="Proposition reçue" tone="teal" />
        </View>
      </Card>
      <Card>
        <ThemedText type="subtitle">Formulaires</ThemedText>
        <Input label="Adresse e-mail" placeholder="exemple@domaine.com" value={email}
          onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" hint="Exemple uniquement" />
        <PasswordField value={password} onChangeText={setPassword} placeholder="••••••••" />
        <Input label="Champ invalide" value="" onChangeText={() => {}} error="Ce champ est obligatoire." />
        <Input label="Description" multiline numberOfLines={4} placeholder="Décrivez votre demande" />
        <SelectField label="Mode de consultation" value={selected} onChange={setSelected}
          options={[{ label: 'À domicile', value: 'domicile' }, { label: 'À distance', value: 'tele' }]} />
        <ToggleField label="Option activée" description="Exemple de sélection" value={enabled} onValueChange={setEnabled} />
      </Card>
      <EmptyState title="Aucune donnée" description="État vide de démonstration" actionLabel="Afficher un toast"
        onAction={() => showToast('État vide', 'info')} />
      <ErrorState title="Connexion indisponible" description="Exemple d'erreur, aucun appel réseau réalisé"
        onRetry={() => showToast('Nouvelle tentative (simulation locale)', 'error')} />
      <LoadingState label="Chargement de démonstration" />
      <Modal visible={dialogVisible} title="Confirmer l'action" description="Ceci est une démonstration de la modale."
        onClose={() => setDialogVisible(false)} confirmLabel="Confirmer"
        onConfirm={() => { setDialogVisible(false); showToast('Confirmation locale effectuée', 'success'); }} />
    </Screen>
  );
}
