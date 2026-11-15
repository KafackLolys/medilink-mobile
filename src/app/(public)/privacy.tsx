import { Screen, Header } from '@/components/ui/primitives';
import { LegalContact, LegalDraftNotice, LegalSection } from '@/components/legal/legal-sections';

const sections = [
  [
    "1. Qui est responsable de vos données ?",
    [
      "MediLink est exploité par [nom de la structure / de l’éditeur], [adresse]. L’identité et l’adresse de l’éditeur doivent être complétées. Pour toute question sur vos données, utilisez le formulaire de contact."
    ]
  ],
  [
    "2. Données que nous collectons",
    [
      "Compte : prénom, nom, téléphone, adresse e-mail, rôle (patient ou médecin). Pour les médecins : spécialité et numéro d’enregistrement.",
      "Besoins médicaux : titre, spécialité, description, mode de consultation et pièces jointes que vous choisissez de publier.",
      "Notifications : identifiant technique de votre appareil si vous activez les notifications.",
      "Données techniques : journaux de connexion et d’erreurs nécessaires au fonctionnement et à la sécurité du service.",
      "Votre mot de passe n’est jamais stocké en clair ni dans notre base de données applicative."
    ]
  ],
  [
    "3. Pourquoi nous les utilisons",
    [
      "Créer et sécuriser votre compte.",
      "Mettre en relation patients et médecins selon la spécialité.",
      "Vous envoyer les e-mails et notifications liés à votre activité.",
      "Assurer la sécurité, prévenir les abus et améliorer le service.",
      "Les données de santé que vous publiez sont traitées sur la base de votre consentement, que vous pouvez retirer à tout moment."
    ]
  ],
  [
    "4. Qui peut voir vos informations",
    [
      "Vos besoins médicaux et leurs pièces jointes ne sont accessibles qu’à vous et aux professionnels autorisés sur la plateforme. Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.",
      "Nous faisons appel à des prestataires techniques qui traitent des données pour notre compte : Google Firebase (authentification, base de données, notifications) et Supabase (stockage des fichiers). Ils sont tenus de protéger vos données. Vos données peuvent être traitées en dehors de votre pays de résidence."
    ]
  ],
  [
    "5. Sécurité",
    [
      "Les fichiers médicaux sont stockés dans un espace privé et ne sont consultables qu’au moyen de liens temporaires. Les échanges avec l’application sont chiffrés et l’accès aux données est contrôlé par authentification. Aucune mesure n’offre une sécurité absolue : en cas d’incident touchant vos données, nous vous informerons dans les conditions prévues par la loi."
    ]
  ],
  [
    "6. Durée de conservation",
    [
      "Nous conservons vos données tant que votre compte est actif, puis pendant [durée à définir] après sa suppression, sauf obligation légale de les conserver plus longtemps."
    ]
  ],
  [
    "7. Vos droits",
    [
      "Vous pouvez demander l’accès à vos données, leur rectification, leur suppression, ou vous opposer à certains traitements. Pour exercer ces droits, contactez-nous via le formulaire ci-dessous. Vous pouvez aussi saisir l’autorité de protection des données compétente dans votre pays."
    ]
  ],
  [
    "8. Notifications et stockages techniques",
    [
      "Les notifications sont envoyées uniquement après votre autorisation sur l’appareil, et vous pouvez retirer celle-ci dans les paramètres Android. Le stockage local sécurisé nécessaire à la connexion permet de retrouver votre session après la fermeture de l’application."
    ]
  ],
  [
    "9. Modifications",
    [
      "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de la page et, en cas de changement important, nous vous en informerons."
    ]
  ]
] as const;

/** Mobile adaptation of the public web privacy policy, not yet a final legal approval. */
export default function PrivacyPage() {
  return <Screen>
    <Header title="Politique de confidentialité"
      subtitle="Dernière mise à jour du texte web : 12 novembre 2026. Quelles données MediLink collecte, pourquoi et comment vous pouvez les contrôler." />
    <LegalDraftNotice />
    {sections.map(([title, paragraphs]) =>
      <LegalSection key={title} title={title} paragraphs={paragraphs} />,
    )}
    <LegalContact />
  </Screen>;
}
