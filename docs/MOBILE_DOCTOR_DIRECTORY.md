# Prompt 10 — Annuaire natif des médecins

## Sources analysées

- Web : `app/(private)/patient/medecins/page.tsx`, `app/(private)/components/doctor-card.tsx`, `hooks/use-doctors.ts`, `services/doctor-service.ts`, `routes/doctor-routes.ts`.
- Backend NestJS : `src/doctors/doctors.controller.ts`, `doctors.service.ts`, `doctor-search.ts` et ses tests.
- Mobile : `src/services/doctors.ts`, `src/types/domain.ts`, design system Medilink et routes Expo Router.
- Référence responsive : https://medilink-nu-ten.vercel.app/ — **non consultable dans cet environnement** (réponse DisabledError). Le style est donc dérivé du code source du web, sans prétendre reproduire une capture authentifiée sur 360/390/430 dp.

## Contrat exact de GET /doctors

`GET /doctors` est protégé par `FirebaseAuthGuard`. Les seuls filtres de requête sont :

| Paramètre | Sémantique serveur |
| --- | --- |
| `q` | Nom du médecin, spécialité ou localisation (adresse, ville, secteur) |
| `city` | Ville / quartier / secteur d'intervention, y compris l'adresse professionnelle |
| `specialty` | Spécialité principale |

- Valeurs facultatives, après `trim`, limite de **100 caractères par champ**. `doctor-search.ts` réalise la normalisation Unicode, ignore les accents et la casse, et effectue des correspondances partielles. L'application **n'imite pas** ces règles métier côté téléphone : elle transmet les paramètres au serveur.
- Format : `{ doctors: DoctorDirectoryItem[], specialties: string[] }`, **sans pagination**, pageSize, total ni nextCursor. Une pagination client artificielle cacherait des résultats et n'est pas installée.
- La liste est déjà limitée côté serveur aux profils de médecins **vérifiés** dont le compte est actif ; elle est triée par nom.
- La réponse n'expose **aucune URL d'avatar/photo** ni coordonnées géographiques. Le composant mobile utilise les initiales de `doctor.name` (avatar accessible), sans image fictive ni demande d'autorisation galerie. Une image réelle pourra être chargée avec Expo Image si un endpoint officiel le permet ultérieurement.
- Aucune recherche par prix, note, mode de consultation, disponibilité, distance ou rayon : ces critères ne sont pas autorisés par `GET /doctors` actuellement. Les informations de note, modes et lieu peuvent cependant être affichées car elles existent dans `DoctorDirectoryItem`.
- L'URL de la fiche du médecin est `/patient/medecins/:id`. Les rendez-vous ne sont pas proposés comme automatiquement disponibles : aucune réservation n'est effectuée depuis l'annuaire.

## Implantation Android

`src/app/patient/(tabs)/medecins.tsx` remplace le placeholder :

- `FlatList` virtualisée avec clés stables, découpage en lots, en-tête de filtres et pied d'accès aux besoins.
- Recherche explicite via le bouton « Rechercher » ou retour clavier, sans requête à chaque frappe.
- Spécialités issues **exclusivement** de `specialties` dans la réponse de l'API ; saisie de la ville/secteur avec filtres normaux.
- Bouton « Effacer », pull-to-refresh, chargement, état vide, réessai en cas d'erreur, nombre de médecins uniquement après résultat réussi.
- Annulation `AbortController` au changement de filtres / départ de l'écran, génération empêchant une ancienne réponse de remplacer un résultat récent.
- Cartes natives Medilink avec nom, spécialité, badge « médecin vérifié » (garanti par la sélection serveur), note seulement si évaluations disponibles, expérience, secteur et modes proposés.
- Route `/patient` uniquement pour les sessions avec rôle patient, avec contrôle réel par le backend Firebase.

`src/features/patient/doctor-directory.ts` centralise le mapping de réponse et la validation des filtres. Aucun filtre ou spécialité inventé.

## Tests

`src/features/patient/doctor-directory.test.mjs`, lancé par `npm run test:doctors` et dans GitHub Actions, vérifie :

- Paramètres `q`, `city`, `specialty` et nettoyage des espaces.
- Limite serveur de 100 caractères.
- Mapping de la réponse `{ doctors, specialties }`, y compris réponse vide.
- Rejet de réponses invalides ou de formats de pagination inexistants.
- Priorité des champs de localisation et absence de valeurs inventées.
- Notes et modes de consultation.

## Scénarios de recette Android restants

- [ ] Connexion du compte patient autorisé, visite de `/patient/medecins`, succès de `GET /doctors`.
- [ ] Recherche Yaoundé / Yaounde et Bastos : même comportement de normalisation qu'au web.
- [ ] Recherche par nom / spécialité et combinaison de filtres.
- [ ] Effacer les filtres et actualiser sans affichage de résultats obsolètes.
- [ ] Réseau coupé/erreur 403 : affichage d'erreur sans fausse liste vide.
- [ ] Aucune fiche disponible : état vide explicite.
- [ ] Navigation vers le détail du médecin sélectionné, sans fuite d'autres informations.
- [ ] Grand texte, TalkBack, clavier Android et responsive 360/390/430 dp.

**Limite** : aucun navigateur interactif ni émulateur Android authentifié n'était disponible ici. Les tests unitaires/TypeScript CI ne remplacent pas l'E2E avec le compte patient réel. Le site Vercel ne pouvait pas être ouvert pour valider visuellement la mise en page.
