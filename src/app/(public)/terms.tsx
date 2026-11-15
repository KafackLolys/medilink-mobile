import { Link } from 'expo-router';
import { Screen, Header, Card } from '@/components/ui/primitives';
import { LegalContact, LegalDraftNotice, LegalSection } from '@/components/legal/legal-sections';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const sections = [
  [
    "1. Objet du service",
    [
      "MediLink est une plateforme qui met en relation des patients et des professionnels de santé. Les patients y publient des besoins médicaux ; les médecins peuvent les consulter et y répondre selon leur spécialité.",
      "La plateforme est un outil de mise en relation. Elle ne remplace ni un diagnostic, ni une consultation, ni un traitement médical."
    ]
  ],
  [
    "2. Compte utilisateur",
    [
      "Vous devez fournir des informations exactes et les tenir à jour.",
      "Pour l’inscription par e-mail, vous devez vérifier votre adresse e-mail pour finaliser votre inscription. Pour une inscription Google, l’adresse est vérifiée par Google et Firebase.",
      "Vous êtes responsable de la confidentialité de votre mot de passe et de l’activité réalisée depuis votre compte.",
      "Si vous pensez que votre compte a été utilisé par quelqu’un d’autre, prévenez-nous sans délai."
    ]
  ],
  [
    "3. Obligations des patients",
    [
      "Décrire votre situation de bonne foi et le plus fidèlement possible.",
      "Ne joindre que des documents qui vous concernent ou dont vous avez le droit de disposer.",
      "Ne pas utiliser la plateforme pour une urgence vitale."
    ]
  ],
  [
    "4. Obligations des médecins",
    [
      "Exercer légalement et fournir un numéro d’enregistrement valide. Nous pouvons demander des justificatifs.",
      "Respecter le secret médical et la déontologie applicable à votre profession.",
      "Rester seul responsable des avis et soins que vous prodiguez."
    ]
  ],
  [
    "5. Usages interdits",
    [
      "Usurper l’identité d’une autre personne ou d’un professionnel.",
      "Publier des contenus illicites, trompeurs ou injurieux.",
      "Chercher à accéder aux données d’autres utilisateurs ou à perturber le fonctionnement du service.",
      "Collecter des données de la plateforme de manière automatisée sans autorisation."
    ]
  ],
  [
    "6. Données personnelles",
    [
      "Le traitement de vos données est décrit dans notre politique de confidentialité, accessible depuis cette application."
    ]
  ],
  [
    "7. Responsabilité",
    [
      "Nous mettons tout en œuvre pour assurer la disponibilité et la sécurité du service, sans garantir qu’il soit exempt d’interruptions ou d’erreurs. Dans les limites autorisées par la loi, MediLink n’est pas responsable du contenu des échanges entre utilisateurs ni des conséquences médicales des décisions prises à partir des informations échangées."
    ]
  ],
  [
    "8. Suspension et suppression de compte",
    [
      "Nous pouvons suspendre ou supprimer un compte qui ne respecte pas ces conditions. Vous pouvez demander la suppression de votre compte à tout moment via le formulaire de contact."
    ]
  ],
  [
    "9. Propriété intellectuelle",
    [
      "La marque, le logo, le design et le code de MediLink appartiennent à leur éditeur. Vous conservez vos droits sur les contenus que vous publiez et nous accordez le droit de les afficher aux seules fins du service."
    ]
  ],
  [
    "10. Modification des conditions",
    [
      "Nous pouvons modifier ces conditions. En cas de changement important, nous vous en informerons ; continuer à utiliser le service après modification vaut acceptation."
    ]
  ],
  [
    "11. Droit applicable",
    [
      "Ces conditions sont régies par le droit de [pays à compléter]. Tout litige relève des tribunaux compétents de [ville / juridiction à compléter]."
    ]
  ]
] as const;

/** Mobile adaptation of the public web terms, subject to legal/brand approval. */
export default function TermsPage() {
  const theme = useTheme();
  return <Screen>
    <Header title="Conditions d’utilisation"
      subtitle="Dernière mise à jour du texte web : 12 novembre 2026. En créant un compte ou en utilisant MediLink, vous acceptez les conditions ci-dessous." />
    <LegalDraftNotice />
    <Card style={{ backgroundColor: theme.warningSurface }}>
      <ThemedText type="smallBold" style={{ color: theme.warning }}>
        MediLink n’est pas un service d’urgence. En cas d’urgence médicale,
        contactez immédiatement les services d’urgence de votre pays.
      </ThemedText>
    </Card>
    {sections.map(([title, paragraphs]) =>
      <LegalSection key={title} title={title} paragraphs={paragraphs} />,
    )}
    <Link href="/privacy"><ThemedText type="linkPrimary">Voir la politique de confidentialité</ThemedText></Link>
    <LegalContact />
  </Screen>;
}
