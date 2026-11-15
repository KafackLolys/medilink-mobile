import { Link } from 'expo-router';
import { Screen, Card, Header } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { View } from 'react-native';

const sections = [
  { title: '1. Responsabilité du traitement', body: 'MediLink collecte et utilise des données nécessaires à la mise en relation des patients et des professionnels de santé. L’identité complète de l’éditeur et son adresse légale doivent encore être précisées.' },
  { title: '2. Données collectées', body: 'Nous utilisons vos informations de compte (nom, prénom, coordonnées, rôle), les justificatifs professionnels des médecins, les besoins médicaux et pièces jointes que vous fournissez, ainsi que des données techniques utiles à la sécurité. Les mots de passe ne sont pas conservés en clair dans la base applicative.' },
  { title: '3. Finalités', body: 'Création et sécurité des comptes, mise en relation selon les spécialités, échanges et rendez-vous, notifications et prévention des abus. Les informations de santé exigent une protection particulière.' },
  { title: '4. Accès et prestataires', body: 'Les informations médicales ne doivent être accessibles qu’au patient et aux professionnels autorisés. Le service utilise notamment Firebase pour l’authentification et les notifications, ainsi que des solutions techniques de stockage. Des traitements peuvent avoir lieu hors de votre pays.' },
  { title: '5. Sécurité', body: 'Les échanges sont chiffrés lors du transport et l’accès aux ressources sensibles est contrôlé. Les documents médicaux privés utilisent des liens d’accès limités. Aucune protection ne garantit l’absence absolue d’incident.' },
  { title: '6. Conservation', body: 'Les données sont conservées durant l’utilisation du compte, puis selon une durée et les obligations légales que l’éditeur doit encore préciser.' },
  { title: '7. Vos droits', body: 'Vous pouvez demander l’accès, la correction, la suppression ou certaines limitations du traitement de vos données en utilisant le formulaire de contact.' },
  { title: '8. Notifications et stockage mobile', body: 'Les notifications nécessitent votre autorisation. Des jetons de session sont conservés dans le stockage sécurisé de l’appareil, jusqu’à déconnexion ou invalidation de la session. Les permissions peuvent être modifiées dans les réglages Android.' },
  { title: '9. Modifications', body: 'Cette politique peut être mise à jour. Une information adaptée devra être fournie en cas de modification importante.' },
] as const;

export default function PrivacyScreen() {
  return <Screen>
    <Header title="Politique de confidentialité" subtitle="Comment MediLink utilise et protège vos données." />
    <Card>
      <ThemedText type="smallBold">Informations légales en cours de finalisation</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Cette présentation reprend les principes affichés sur le site. Les coordonnées de l’éditeur, la durée de conservation et les mentions réglementaires doivent être validées avant publication.
      </ThemedText>
    </Card>
    {sections.map(section => <View key={section.title} style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold" accessibilityRole="header">{section.title}</ThemedText>
      <ThemedText themeColor="textSecondary">{section.body}</ThemedText>
    </View>)}
    <Link href="/contact"><ThemedText type="linkPrimary">Exercer mes droits ou contacter l’équipe</ThemedText></Link>
  </Screen>;
}
