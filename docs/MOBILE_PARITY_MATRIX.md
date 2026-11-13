# Medilink Android — Matrice de parité Web → API → Mobile

Date de référence : 2026-11-13. Dépôts : [web](https://github.com/KafackLolys/medilink), [API](https://github.com/KafackLolys/medilink-api), [mobile](https://github.com/KafackLolys/medilink-mobile). Branches examinées : `main`. Arbres Git constatés : web `051b33928d785708e4f9a11d88f1eec2a9c1e803`, API `db6b6c55ffc3e37eaea8a4e3ad28893c766f9849`, mobile `0eac16577d41a2ff780a65157897443148a121dd` (SHA des arbres, non des commits).

## Légende et portée

- **Web : présent** signifie qu'une page, un hook ou un service est détecté, **pas** que son fonctionnement a été testé.
- **API : présent** signifie que le contrôleur et sa route ont été inspectés; vérifier le corps du service, les formes de réponse et le comportement réel avant implémentation.
- **Mobile : absent** signifie qu'aucun écran fonctionnel Medilink n'est détecté dans `src/app/`, en dehors du template Expo (`index.tsx`, `explore.tsx`).
- **À vérifier** : contrôle de l'implémentation, du runtime ou des permissions encore nécessaire. Aucun test E2E ni authentification contre le site déployé n'a été mené.
- Critère commun : UI Android adaptée, vraie API, états chargement/vide/erreur, contrôle d'accès, tests unitaires/flux, aucune donnée de démonstration dans les écrans de production.

## Matrice des parcours

| ID | Rôle / parcours | Référence web | API observée | Mobile | Priorité / dépendances | Critère d'acceptation spécifique |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | Public : accueil / recommandations | `app/(puclic)/page.tsx` | `GET /doctors` pour l'annuaire, règles de recommandation à valider | Absent | P2 / navigation, annuaire | Affiche uniquement des données réelles et un CTA utile |
| P02 | Public : aide/contact/mentions | `app/(puclic)/aide`, `contact`, `privacy`, `terms` | `POST /integration/contact` | Absent | P2 / shell | Documents consultables et contact fonctionnel |
| A01 | Connexion / inscription | `app/(puclic)/login`, `register`; `services/auth-service.ts` | `POST /auth/login`, `POST /auth/register` | Absent | P0 / client API | Comptes patient/médecin authentifiés, erreurs gérées |
| A02 | Session et rôle | `hooks/use-auth*`, `store/auth-store.ts`, `components/role-guard.tsx` | `POST /auth/refresh`, `GET /auth/profile`, `POST /auth/logout`; `FirebaseAuthGuard` | Absent | P0 / A01, secure storage | Refresh sérialisé, rôle vérifié, aucune fuite de tokens |
| A03 | Récupération mot de passe | Écran/route dans `auth-routes.ts` | `POST /auth/reset-password` | Absent | P1 / A01 | Flux identique au contrat serveur |
| P03 | Accueil patient | `app/(private)/patient/page.tsx` | Composition auth, needs, appointments, doctors, notifications | Absent | P1 / A02 | Données du vrai compte et navigation cohérente |
| P04 | Liste/recherche des médecins | `patient/medecins/page.tsx`; `hooks/use-doctors.ts`; `services/doctor-service.ts` | `GET /doctors` (authentifié), `DoctorDirectoryFilters`, `doctor-search.ts` | Absent | P1 / A02 | Filtres conformes aux capacités du backend |
| P05 | Profil médecin et avis | `patient/medecins/[id]/doctor-profile-client.tsx`, `doctor-rating-section.tsx` | `GET /doctors/:id`, avis rattachés aux rendez-vous | Absent | P1 / P04 | Vérification, modes et informations exposés correctement |
| P06 | Nouvelle demande médicale | `patient/besoins/nouveau/page.tsx` | `POST /needs` avec multipart `data` JSON + `files` (max 5, 10 Mo chacun) | Absent | P1 / A02, upload | Demande créée et pièces jointes traitées |
| P07 | Mes demandes : liste/détail/édition/clôture/suppression | `patient/demandes/**` | `GET /needs`, `GET /needs/:id`, `PATCH /needs/:id`, `PATCH /needs/:id/close`, `DELETE /needs/:id` | Absent | P1 / P06 | Transitions de statut validées par serveur |
| P08 | Réservation auprès du médecin | `patient/medecins/[id]/rendez-vous/appointment-booking-form.tsx` | `POST /appointments`; `GET /doctors/:id`; **pas de route publique de lecture des créneaux listée dans `availabilities.controller.ts`** | Absent | P0 / P05, P09 | Seuls les créneaux compatibles sont proposés, rejet propre si collision |
| P09 | Rendez-vous patient : liste et détail | `patient/rendez-vous/**` | `GET /appointments`, `GET /appointments/:id`, `PATCH /appointments/:id/status` | Absent | P1 / A02 | Liste et détail synchronisés avec le serveur |
| P10 | Avis après rendez-vous | `patient/rendez-vous/[id]/patient-review-form.tsx` | `GET /appointments/:id/review`, `POST /appointments/:id/review` | Absent | P2 / P09 | Respect des conditions d'éligibilité et anti-doublon |
| P11 | Profil patient / antécédents | `patient/profil/**`; `services/patient-health-service.ts` | `GET /auth/profile`, `PATCH /integration/patient/profile`, `GET /patients/me/conditions` | Absent | P1 / A02 | Sections autorisées, modification sauvegardée |
| P12 | Documents patient | `patient/profil/components/patient-documents-content.tsx`, `patient-documents-manager.tsx` | `GET/POST /patients/me/documents`, `DELETE /patients/me/documents/:id` | Absent | P1 / upload sécurisé | Contrôles MIME/taille (10 Mo par document) et permissions |
| P13 | Messages patient | `patient/messages/page.tsx`; `use-messaging.ts` | `GET /messages/conversations`, `GET/POST /messages/conversations/:id` | Absent | P1 / A02 | Lecture/envoi dans la conversation autorisée |
| D01 | Accueil médecin | `medecin/page.tsx`, `lib/doctor-dashboard-data.ts` | Composition doctors/needs/appointments/availabilities | Absent | P1 / A02 | Dashboard professionnel réel |
| D02 | Besoins accessibles médecin | `medecin/besoins/**` | `GET /needs/doctor`, `GET /needs/doctor/:id` | Absent | P1 / A02 | Filtres et détails sans fuite de données |
| D03 | Réponses / propositions | `medecin/propositions/page.tsx` | `GET /needs/doctor/proposals`, `POST /needs/doctor/:id/proposals`, `PATCH /needs/doctor/proposals/:id/cancel` | Absent | P1 / D02 | Proposer, suivre, annuler selon règles métier |
| D04 | Agenda médecin / rendez-vous / historique | `medecin/rendez-vous`, `historique` | `GET /appointments/doctor`, `PATCH /appointments/:id/status`, `GET /availabilities/me/appointments` | Absent | P1 / A02 | Actions autorisées et données cohérentes |
| D05 | Disponibilités et durée | `medecin/disponibilites/page.tsx`; `hooks/use-doctor-availability.ts` | `GET/PUT /availabilities/me/weekly`, `GET/PATCH /availabilities/me/duration` | Absent | P0 / A02 | Horaires semaine, durée, recalcul des créneaux |
| D06 | Jours indisponibles | Même page | `GET/POST /availabilities/me/blocked`, `DELETE /availabilities/me/blocked/:id` | Absent | P0 / D05 | Dates bloquées exclues des réservations |
| D07 | Profil et justificatifs | `medecin/profil/**`, `doctor-documents-manager.tsx` | `GET/PATCH /doctors/me`, `POST /doctors/me/documents`, `DELETE /doctors/me/documents/:id` | Absent | P1 / A02 | Droits et vérification respectés |
| D08 | Zone d'intervention | `medecin/zone-intervention/page.tsx` | `GET/PUT /integration/doctor/zone` | Absent | P2 / D07 | Zone sauvegardée, validation de géographie |
| D09 | Avis médecin | `medecin/avis/page.tsx` | `GET /doctors/me/reviews` | Absent | P2 / D07 | Avis visibles sans divulgation abusive |
| D10 | Messages médecin | `medecin/messages/page.tsx` | API messages commune | Absent | P1 / A02 | Même sécurité de conversation |
| T01 | Notifications | `hooks/use-notifications.ts`, `services/notification-service.ts`, `activity-popover.tsx` | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` | Absent | P1 / A02 | Marquage lu, pagination conforme |
| T02 | Push sur appareils | `services/web-push.ts`, service worker | `POST /notifications/devices`, `POST /notifications/devices/:deviceId/unregister` | Absent | P2 / Expo notifications | Token natif compatible avec le fournisseur serveur confirmé |
| T03 | Cartes et géographie | `doctors-map.tsx`, `geo-map.tsx` | Doctor filters + integration zone | Absent | P2 / P04 | Fonctionne aussi sans permission GPS |
| X01 | Admin : liste/comptes | `admin/page.tsx`; `services/admin-service.ts` | `GET /admin/accounts`, `PATCH /admin/accounts/:id/status` | Absent | P2 / A02, AdminGuard | Lecture et mutation admin seulement |
| X02 | Admin : vérification / création admin | Même page | `PATCH /admin/accounts/:id/verification`, `POST /admin/admins` | Absent | P2 / X01 | Confirmation et contrôle serveur |
| X03 | Non autorisé / non trouvé | `unauthorized/page.tsx`, `not-found.tsx`, role guards | 401/403/404 selon API | Absent | P0 / navigation | Pas de boucle ni d'affichage de contenu privé |

## Inventaire des fichiers de référence

### Pages Next.js
- Public : `(puclic)/page`, login, register, aide, contact, privacy, terms. **`(puclic)` est le nom effectif du groupe de routes, ne pas le corriger sans plan de migration.**
- Patient : accueil, besoin nouveau, demandes liste/détail/modification, médecins liste/fiche/réservation, messages, profil, rendez-vous liste/détail/avis.
- Médecin : accueil, besoins liste/détail, propositions, disponibilités, rendez-vous, historique, messages, profil, zone-intervention, avis.
- Admin : `(private)/admin/page.tsx`; pages d'erreur : unauthorized et not-found.
- Les fichiers `*.bak` sont des artefacts historiques : ne pas les compter comme pages actives.

### Hooks web
`use-auth-session`, `use-auth`, `use-doctor-appointments`, `use-doctor-availability`, `use-doctor-history`, `use-doctor-need`, `use-doctor-needs`, `use-doctor-proposals`, `use-doctor`, `use-doctors`, `use-messaging`, `use-my-doctor-profile`, `use-notifications`, `use-patient-appointment`, `use-patient-appointments`, `use-patient-need`, `use-patient-needs`, `use-patient-profile`, `use-require-role`.

### Services et routes web
Services : `admin`, `appointment`, `auth`, `availability`, `doctor-review`, `doctor`, `http`, `integration`, `message`, `need`, `notification`, `patient-document`, `patient-health`, `web-push`. Routes : `admin`, `appointment`, `auth`, `availability`, `doctor`, `message`, `need`, `notification`, `patient`.

### Modèles / sécurité
- Modèles web : `lib/database.ts`, `lib/roles.ts`, `lib/patient-profile-data.ts`, `lib/doctor-dashboard-data.ts`, `store/auth-store.ts`; backend : `src/interfaces/database.ts`, types des services/controller.
- Gardes : `FirebaseAuthGuard` sur la plupart des contrôleurs, `AdminGuard` sur /admin. Les gardes de navigation Next.js ne remplacent pas ces autorisations.
- Mobile : `src/app/index.tsx` affiche « Welcome to Expo » et `src/app/explore.tsx` est une page de starter; pas de module auth/doctor/patient métier détecté.

## Contrats critiques et écarts à résoudre

1. **Disponibilité / réservation : P0.** Le backend `AppointmentsService.create` valide le médecin vérifié et actif, le mode, la plage hebdomadaire, l'heure de fin avec durée, la date bloquée, le fuseau horaire IANA, les droits du patient et les collisions (suite du service à auditer). La route `/availabilities/me/*` appartient au médecin. Ne jamais confondre « médecin vérifié » et « créneau disponible ». Examiner le rendu et le calcul du calendrier patient pour déterminer si un endpoint de créneaux publics est nécessaire.
2. **Création rendez-vous :** `{doctorId, scheduledAt, timeZone, consultationMode, reason?}`. `scheduledAt` doit être dans le futur; `timeZone` doit être un identifiant IANA valide; `reason` max 500 caractères.
3. **Mises à jour du profil médecin :** `PATCH /doctors/me` ne montre que `bio`, `yearsOfExperience`, `consultationFee`, `professionalAddress` dans le contrôleur. Ne pas supposer que spécialité ou matricule sont modifiables.
4. **Disponibilités :** `GET/PATCH /availabilities/me/duration` existe dans le backend, mais n'est pas déclaré dans `routes/availability-routes.ts` (vérifier si le web l'appelle autrement). Les listes semaine sont `GET/PUT`, blocages `GET/POST/DELETE`.
5. **Documents :** uploads `file` pour patient/médecin, limite contrôleur 10 Mo; besoins `data` sérialisé et `files` (max 5, 10 Mo chacun); voir validations complémentaires des services.
6. **Profil patient :** `PATCH /integration/patient/profile` est disponible bien qu'absent de `routes/patient-routes.ts`. Vérifier le mapping côté `integration-service.ts`.
7. **Notifications :** format de token push et fournisseur Firebase/Expo à vérifier dans `notifications.service.ts` avant toute intégration.
8. **Login / token :** le web fait un refresh single-flight et dépend de `authStore`, `clearBrowserSession` et `credentials: 'include'`. Android doit employer le contrat JSON des endpoints avec stockage sécurisé adapté, sans copier la navigation ou les cookies navigateur.
9. **Annuaire :** `GET /doctors` est protégé par `FirebaseAuthGuard` bien que la page d'accueil web puisse proposer des recommandations; confirmer le mécanisme de récupération côté page publique.
10. **Déploiement :** l'API utilise NestJS 12 avec modules ESM potentiels; des problèmes `ERR_REQUIRE_ESM` sur Vercel ont été rapportés antérieurement. Aucune preuve de fonctionnement de la version distante dans cet audit.
11. **Sécurité :** vérifier `AdminGuard`, vérification des statuts de comptes dans chaque service, scoping Firestore, upload, création d'administrateurs et données sensibles avant la sortie.
12. **Nommage :** le site observé sur une page locale affiche « Medihome / MedLink » alors que les dépôts portent « medilink » : valider l'identité du produit avant la conception visuelle.

## Référence UX responsive obligatoire pour chaque écran

Site de référence à inspecter avant **toute création d'écran** : https://medilink-nu-ten.vercel.app/ . Effectuer une revue à 360, 390 et 430 px, avec compte de test du rôle concerné, et noter : structure, informations, interactions, états, CTA, comportement responsive. S'inspirer de la vue mobile réelle sans copier mécaniquement le DOM. Vérifier également la source Next.js correspondant à l'écran.

**État du test en date de l'audit : non validé.** La tentative de lecture du site distant par l'outil web a échoué; le navigateur connecté ne permettait que la lecture des onglets déjà ouverts. Un onglet local `http://localhost:4000/medecin/disponibilites` était lisible : horaires lundi–dimanche, durée de consultation (15/20/30/45/60 minutes), blocages de dates, prochains rendez-vous. Il ne constitue **pas** une preuve de rendu responsive du site Vercel. Aucun identifiant de test ni secret ne doit être commité, inclus dans des captures publiques ou des logs.

## Priorités et lots

- **P0** : audit/contrats, auth/session, rôles, navigation, disponibilité + réservation, sécurité.
- **P1** : annuaire, fiches médecins, demandes, rendez-vous patient/médecin, profil, documents, messagerie, propositions.
- **P2** : notifications push, cartes, aide et pages légales, admin mobile, finitions.
- Dépendances : fondations → connexion → rôle → services métier → scénarios transversaux → tests Android → publication.

## Critères de recette du prompt 01

- [x] Inventaire des chemins de pages, hooks et services des trois arborescences.
- [x] Contrôleurs API de domaines principaux consultés, endpoints explicités.
- [x] Matrice de parité et critères pour chaque domaine.
- [x] Risques et écarts identifiés avec niveau de certitude.
- [ ] Parcours réels connecté et visite responsive 360/390/430 px du site distant (non accessible via outils disponibles).
- [ ] Validation des DTO/types et du corps **de tous** les services backend (à approfondir au démarrage de chaque lot).
- [ ] Tests e2e, build et exécution Android (hors portée de l'audit documentaire).

Aucune fonctionnalité applicative ni donnée du backend n'est modifiée par cette documentation.
