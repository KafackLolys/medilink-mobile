import { useState } from 'react';
import { Link } from 'expo-router';
import { ChevronDown, ShieldAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Screen, Card, Header } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const FAQ = [
  { title: 'Compte', items: [
    { q: 'Comment créer un compte ?', a: 'Choisissez votre profil (patient ou médecin), renseignez vos informations puis validez le formulaire d’inscription. Les médecins indiquent aussi leur spécialité et leur numéro d’enregistrement.' },
    { q: 'Je n’ai pas reçu l’e-mail de vérification.', a: 'Vérifiez votre dossier de courriers indésirables. Si rien n’arrive au bout de quelques minutes, contactez-nous en précisant l’adresse e-mail utilisée.' },
    { q: 'J’ai oublié mon mot de passe.', a: 'Sur la page de connexion, utilisez « Mot de passe oublié » et saisissez votre e-mail. Vous recevrez un lien pour en choisir un nouveau.' },
    { q: 'Puis-je utiliser Google ?', a: 'Oui, sur une version Android compatible. Si vous utilisez Google pour la première fois, sélectionnez votre profil Patient ou Médecin après l’authentification.' },
  ] },
  { title: 'Besoins médicaux', items: [
    { q: 'Comment publier un besoin médical ?', a: 'Depuis votre espace patient, créez un nouveau besoin : donnez-lui un titre, choisissez la spécialité, décrivez votre situation et indiquez le mode de consultation souhaité.' },
    { q: 'Quels fichiers puis-je joindre ?', a: 'Vous pouvez joindre jusqu’à 5 fichiers par besoin, de 10 Mo maximum chacun. Ils ne sont visibles que par les personnes autorisées.' },
    { q: 'Puis-je modifier ou supprimer un besoin ?', a: 'Vous pouvez modifier un besoin tant qu’il est ouvert, le clore quand il n’est plus d’actualité, et supprimer les brouillons.' },
  ] },
  { title: 'Notifications', items: [
    { q: 'Comment activer les notifications ?', a: 'Autorisez les notifications quand Android vous le demande. Vous pouvez ensuite modifier cette autorisation dans les paramètres de votre téléphone.' },
  ] },
] as const;

export default function HelpPage() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <Screen>
    <Header title="Aide" subtitle="Les réponses aux questions les plus fréquentes sur MediLink." />
    <Card style={{ backgroundColor: theme.warningSurface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ShieldAlert color={theme.warning} size={22} />
        <ThemedText type="smallBold" style={{ color: theme.warning }}>Urgence médicale</ThemedText>
      </View>
      <ThemedText type="small">
        MediLink n’est pas un service d’urgence. Contactez immédiatement les services d’urgence de votre pays.
      </ThemedText>
    </Card>
    {FAQ.map(group => <View key={group.title} style={{ gap: Spacing.two }}>
      <ThemedText type="subtitle" accessibilityRole="header">{group.title}</ThemedText>
      {group.items.map(item => {
        const open = expanded === item.q;
        return <View key={item.q} style={{ backgroundColor: theme.backgroundElement,
          borderColor: theme.border, borderWidth: 1, borderRadius: 14, overflow: 'hidden' }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
            onPress={() => setExpanded(open ? null : item.q)}
            style={{ minHeight: 52, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ThemedText type="smallBold" style={{ flex: 1 }}>{item.q}</ThemedText>
            <ChevronDown size={19} color={theme.primary} style={open ? { transform: [{ rotate: '180deg' }] } : undefined} />
          </Pressable>
          {open ? <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.three }}>
            <ThemedText themeColor="textSecondary">{item.a}</ThemedText>
          </View> : null}
        </View>;
      })}
    </View>)}
    <Card style={{ backgroundColor: theme.infoSurface }}>
      <ThemedText type="smallBold">Besoin d’un coup de main ?</ThemedText>
      <Link href="/contact"><ThemedText type="linkPrimary">Contactez-nous</ThemedText></Link>
    </Card>
  </Screen>;
}
