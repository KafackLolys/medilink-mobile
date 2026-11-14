# Prompt 12 — Besoins médicaux du patient

## Sources du contrat

- Web : `patient/besoins/nouveau/page.tsx`, `patient/demandes/page.tsx`,
  `patient/demandes/[id]/request-detail.tsx`, `request-edit-form.tsx`,
  `services/need-service.ts`, `routes/need-routes.ts`.
- NestJS : `src/needs/needs.controller.ts`, `src/needs/needs.service.ts`.
- Android : `src/services/needs.ts`, modèles `src/types/domain.ts`.

Le contrat du backend demeure la source d'autorité : les routes sont sous
`FirebaseAuthGuard`; la création exige le rôle patient et les modifications
sur des demandes existantes vérifient **le propriétaire** côté serveur.

## Parcours natifs

| Route Android | Endpoint | Fonction |
| --- | --- | --- |
| `/patient/besoins/nouveau` | `POST /needs` | Formulaire guidé, aperçu, multipart |
| `/patient/demandes` | `GET /needs` | Liste et catégories, pull-to-refresh |
| `/patient/demandes/:id` | `GET /needs/:id` | Détail privé, documents signés |
| `/patient/demandes/:id/modifier` | `PATCH /needs/:id` | Titre, spécialité, description, mode |
| Liste et détail | `PATCH /needs/:id/close` | Clôture irréversible avec confirmation |
| Liste et détail | `DELETE /needs/:id` | Suppression définitive d'un **brouillon uniquement** |

### Transitions exactes

| Statut | Modifier | Clôturer | Supprimer |
| --- | --- | --- | --- |
| `draft` | Oui | Non | Oui |
| `published` | Oui | Oui | Non |
| `awaiting_proposals` | Oui | Oui | Non |
| `proposals_received` | Oui | Oui | Non |
| `appointment_confirmed` | Non | Non | Non |
| `closed` | Non | Non | Non |
| `cancelled` | Non | Non | Non |

Une création réussie produit **`awaiting_proposals`** dans l'API actuelle.
L'application ne crée pas de faux brouillon serveur : elle conserve le formulaire
en **mémoire uniquement pendant l'édition**. Aucune description, symptôme, adresse
ou pièce jointe n'est persistée dans AsyncStorage ni dans une préférence.
Le brouillon serveur éventuel, s'il existe, est accessible par les routes liste
et détail et soumis à la matrice de droits ci-dessus.

### Création

Le corps multipart utilise le champ `data` (JSON) et `files` répété.
Les champs sont `title` (5 caractères mini), `specialty`, `description`
(20–800 caractères), `symptoms` (tableau), `since?`, `city`,
`district`, `address?`, `priority`, `mode`, `consent=true`.
Le niveau `urgence` est explicitement **refusé** par NestJS ; l'interface
bloque la publication et oriente vers les urgences. Les options `normal` et
`rapide` n'expriment aucun engagement de délai de réponse.

La création utilise `expo-document-picker@~58.0.4` (compatible SDK 58)
avec copie dans le cache de l'application pour fournir les URI multipart.
Jusqu'à **5 fichiers**, **10 Mo par fichier**, types PDF, JPEG, PNG, WebP,
HEIC ou HEIF. Le contrôle client vérifie MIME et taille connue ; la validation
de la **signature réelle** et du contenu est effectuée par NestJS.
Les images et documents ne sont pas stockés dans l'état global ni journalisés.

### Confidentialité

- `GET /needs/:id` est strictement personnel : l'API vérifie le propriétaire.
- L'adresse privée n'est affichée que sur **la fiche personnelle du patient** ;
  elle est masquée dans l'aperçu destiné aux médecins.
- Les pièces jointes sont représentées par des liens signés temporaires
  uniquement retournés par le backend, ouverts **sur action de l'utilisateur**.
  Liens HTTP non chiffrés et URL inconnues refusés.
- Aucun téléchargement ou mise en cache médicale volontaire dans le mobile.
  Le sélecteur peut conserver les copies temporaires nécessaires au transfert ;
  l'application ne les persiste pas.
- Les erreurs de mutation/upload sont présentées de manière neutre, sans message
  serveur contenant des chemins de stockage ou d'autres informations sensibles.
- Une mutation réussie provoque une redirection/relecture API ; les écrans liste
  et détail relisent les données à chaque retour au premier plan.

## Tests

`src/features/patient/need-model.ts` fournit le mapping des filtres, les gardes
d'actions, les validations et les messages d'erreur sûrs.
`src/features/patient/need-model.test.mjs` vérifie la matrice complète
des statuts, le filtrage, les champs requis, les urgences refusées,
les tailles/types de fichiers et les erreurs d'upload.
La suite est intégrée à `npm run test:needs` et au workflow GitHub Actions.

### Recette Android à terminer

- [ ] Connexion avec un **vrai compte patient** et chargement de ses demandes.
- [ ] Publication normale/rapide, avec et sans fichier signé.
- [ ] Refus d'urgence et vérification de la validation 20–800 caractères.
- [ ] Upload de 5 fichiers valides et rejet du sixième, d'un fichier >10 Mo ou de format interdit.
- [ ] Retour après mutation : liste et détail reflètent le serveur.
- [ ] Clôturer actif, refuser la clôture de brouillon ou de demande déjà clôturée.
- [ ] Supprimer brouillon uniquement, refus serveur d'une demande publiée.
- [ ] Examiner une URL signée expirée et actualiser la fiche.
- [ ] Changement de compte/déconnexion sans exposition des anciennes données.
- [ ] Comparaison visuelle du site responsive Vercel à 360/390/430 px,
  utilisation au clavier, TalkBack et grands caractères.

**État :** les tests unitaires ne remplacent pas le test sur appareil et le
parcours authentifié. La référence responsive Vercel n'a pas été inspectable
dans l'environnement disponible. Ne pas considérer la recette E2E réussie.

## Workflow GitHub

Même branche `docs/mobile-audit-parity-2026-11-13`, PR de continuité #3
si toujours ouverte. La PR #1 et la PR #2 ont été fusionnées avant ce lot,
sans changement de branche.
