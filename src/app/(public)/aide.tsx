import { useState } from 'react';
import { Link } from 'expo-router';
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Screen, Card, Header } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const faq = [
  { group: 'Compte', items: [
    { question: 'Comment créer un compte ?', answer: 'Choisissez votre profil (patient ou médecin), renseignez vos informations puis validez le formulaire d’inscription. Les médecins indiquent aussi leur spécialité et leur numéro d’enregistrement.' },
    { question: 'Je n’ai pas reçu l’e-mail de vérification.', answer: 'Vérifiez vos courriers indésirables. Si aucun message ne vous parvient, contactez-nous en précisant l’adresse e-mail utilisée.' },
    { question: 'J’ai oublié mon mot de passe.', answer: 'Sur la page de connexion, utilisez « Mot de passe oublié » et saisissez votre adresse e-mail. Vous recevrez un lien pour choisir un nouveau mot de passe.' },
    { question: 'Dois-je me reconnecter après avoir fermé l’application ?', answer: 'Non. Votre session est conservée sur cet appareil et renouvelée de manière sécurisée. Vous restez connecté jusqu’à votre déconnexion ou jusqu’à ce que la session soit invalidée pour des raisons de sécurité.' },
  ] },
  { group: 'Besoins médicaux', items: [
    { question: 'Comment publier un besoin médical ?', answer: 'Depuis votre espace patient, créez un besoin : indiquez un titre, une spécialité, la description de votre situation et votre mode de consultation souhaité.' },
    { question: 'Quels fichiers puis-je joindre ?', answer: 'Vous pouvez joindre jusqu’à 5 fichiers par besoin, de 10 Mo maximum chacun. Les fichiers médicaux sont privés et réservés aux personnes autorisées.' },
    { question: 'Puis-je modifier ou supprimer un besoin ?', answer: 'Vous pouvez modifier un besoin tant qu’il est ouvert, le clore lorsqu’il n’est plus d’actualité et supprimer les brouillons, selon son statut.' },
  ] },
  { group: 'Notifications', items: [
    { question: 'Comment recevoir les notifications sur Android ?', answer: 'Autorisez les notifications lors de la demande de l’application. Vous pourrez les ajuster dans les paramètres de votre téléphone.' },
  ] },
] as const;

export default function HelpScreen() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <Screen>
    <Header title="Aide" subtitle="Les réponses aux questions les plus fréquentes." />
    <Card style={{ backgroundColor: theme.warningSurface, borderColor: theme.warning }}>
      <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
        <ShieldAlert size={22} color={theme.warning} />
        <ThemedText type="small" style={{ flex: 1, color: theme.warning }}>
          MediLink n’est pas un service d’urgence. En cas d’urgence médicale, contactez directement les services d’urgence de votre pays.
        </ThemedText>
      </View>
    </Card>
    {faq.map(group => <View key={group.group} style={{ gap: Spacing.two }}>
      <ThemedText type="subtitle" accessibilityRole="header">{group.group}</ThemedText>
      {group.items.map(item => {
        const key = group.group + ':' + item.question;
        const open = expanded === key;
        return <Card key={key}>
          <Pressable accessibilityRole="button" accessibilityLabel={item.question}
            accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : key)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 }}>
            <ThemedText type="smallBold" style={{ flex: 1 }}>{item.question}</ThemedText>
            {open ? <ChevronUp size={20} color={theme.primary} /> : <ChevronDown size={20} color={theme.primary} />}
          </Pressable>
          {open ? <ThemedText themeColor="textSecondary">{item.answer}</ThemedText> : null}
        </Card>;
      })}
    </View>)}
    <Card>
      <ThemedText>Vous ne trouvez pas votre réponse ?</ThemedText>
      <Link href="/contact"><ThemedText type="linkPrimary">Écrivez-nous</ThemedText></Link>
    </Card>
  </Screen>;
}
