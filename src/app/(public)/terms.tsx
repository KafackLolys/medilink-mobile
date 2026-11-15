import { Link } from 'expo-router';
import { View } from 'react-native';
import { Screen, Card, Header } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sections = [
  { title: '1. Objet du service', body: 'MediLink met en relation des patients et des professionnels de santé. Il ne remplace pas une consultation, un diagnostic ou un traitement médical.' },
  { title: '2. Compte utilisateur', body: 'Chaque utilisateur fournit des informations exactes, vérifie son adresse e-mail lorsqu’elle est requise et protège son compte. En cas d’utilisation suspecte, il doit prévenir l’équipe.' },
  { title: '3. Obligations des patients', body: 'Décrivez votre besoin de bonne foi et ne joignez que les documents que vous avez le droit de communiquer. Ne sollicitez pas la plateforme pour une urgence vitale.' },
  { title: '4. Obligations des médecins', body: 'Les professionnels doivent être autorisés à exercer, fournir des informations professionnelles exactes et respecter la déontologie et le secret médical.' },
  { title: '5. Usages interdits', body: 'L’usurpation d’identité, la publication de contenus illicites, l’accès non autorisé aux comptes ou données d’autrui et toute perturbation du service sont interdits.' },
  { title: '6. Données personnelles', body: 'Le traitement des données personnelles et de santé est présenté dans la politique de confidentialité.' },
  { title: '7. Responsabilité', body: 'La plateforme facilite la mise en relation et ne peut garantir l’absence d’interruption. Les décisions de santé doivent être prises avec des professionnels compétents.' },
  { title: '8. Suspension et suppression', body: 'Un compte ne respectant pas les règles peut être suspendu ou supprimé. Les demandes concernant la suppression d’un compte peuvent être adressées au support.' },
  { title: '9. Propriété intellectuelle', body: 'Les contenus, éléments graphiques et logiciels MediLink restent soumis aux droits de leurs propriétaires. Chaque utilisateur conserve ses droits sur les contenus qu’il fournit.' },
  { title: '10. Évolutions et droit applicable', body: 'Les conditions peuvent évoluer. Le pays, la juridiction compétente et les mentions légales définitives doivent être précisés par l’éditeur avant publication.' },
] as const;

export default function TermsScreen() {
  const theme = useTheme();
  return <Screen>
    <Header title="Conditions d’utilisation" subtitle="Les règles d’utilisation de MediLink." />
    <Card style={{ backgroundColor: theme.warningSurface, borderColor: theme.warning }}>
      <ThemedText type="smallBold" style={{ color: theme.warning }}>MediLink n’est pas un service d’urgence.</ThemedText>
      <ThemedText type="small" style={{ color: theme.warning }}>En cas d’urgence médicale, contactez les services d’urgence de votre pays.</ThemedText>
    </Card>
    <Card>
      <ThemedText type="smallBold">Texte à valider avant publication</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">Les informations relatives à l’éditeur et au droit applicable ne sont pas encore renseignées dans la référence web.</ThemedText>
    </Card>
    {sections.map(section => <View key={section.title} style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold" accessibilityRole="header">{section.title}</ThemedText>
      <ThemedText themeColor="textSecondary">{section.body}</ThemedText>
    </View>)}
    <Link href="/privacy"><ThemedText type="linkPrimary">Voir la politique de confidentialité</ThemedText></Link>
    <Link href="/contact"><ThemedText type="linkPrimary">Contacter l’équipe</ThemedText></Link>
  </Screen>;
}
