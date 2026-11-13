# Medilink Android

Application Android Medilink développée avec **Expo SDK 58**, **React Native 0.88**, **React 19**, **Expo Router** et TypeScript.

## Références

- Site web et référence responsive : https://medilink-nu-ten.vercel.app/
- Frontend : https://github.com/KafackLolys/medilink
- Backend : https://github.com/KafackLolys/medilink-api
- [Matrice de parité](docs/MOBILE_PARITY_MATRIX.md) et [architecture](docs/MOBILE_ARCHITECTURE.md)

## Installation

```sh
npm ci
cp .env.example .env.local
# Renseigner l'URL HTTPS effective de l'API NestJS dans .env.local.
npm run start
```

Sous PowerShell : `Copy-Item .env.example .env.local`.

La variable `EXPO_PUBLIC_API_BASE_URL` est **publique** : jamais de mot de passe, secret ou jeton dedans. L'URL du frontend Next.js n'est pas nécessairement l'URL du backend. Le téléphone Android doit pouvoir joindre cette URL.

## Contrôles de qualité

```sh
npm run typecheck
npm run lint
npm run doctor
npm run check
```

Les modules Expo doivent être installés par `npx expo install <package>`, après lecture de la [documentation SDK 58](https://docs.expo.dev/versions/v58.0.0/). Voir `AGENTS.md`.

## État de développement

**État actuel (prompts 1–26 et 29–30) :** les parcours métier patient, médecin, administration et les services transversaux sont présents dans le code et testés en CI. Les profils EAS sont configurés. **Aucun APK/AAB n'a été généré ; la publication Android reste bloquée** par les identifiants EAS/Firebase, le branding officiel, les pages légales, le durcissement de certains contrôles backend et la recette E2E sur téléphone. Voir [matrice finale](docs/MOBILE_PARITY_MATRIX.md), [build Android](docs/ANDROID_RELEASE_BUILD.md) et [PV de recette](docs/ANDROID_FINAL_ACCEPTANCE.md).

**Avant la création de chaque écran** : examiner la vue responsive sur https://medilink-nu-ten.vercel.app/ (360 / 390 / 430 px) avec le rôle approprié, puis comparer avec la page Next.js et les contrôleurs backend. Ne pas prétendre avoir réalisé cette inspection si l'accès navigateur était impossible. Les identifiants des trois comptes de test sont transmis séparément, jamais dans Git.

## Branche commune

Poursuivre les corrections sur la branche **`docs/mobile-audit-parity-2026-11-13`** et la [Pull Request #4](https://github.com/KafackLolys/medilink-mobile/pull/4), toujours ouverte en brouillon. **Ne pas fusionner avant clôture de la recette Android et de la revue sécurité.**

## Vérification lors du prompt 02

Contrôle statique des fichiers via GitHub et documentation Expo SDK 58 / Expo Router. La session d'exécution ne disposait pas d'une copie locale npm du dépôt ni d'accès au registre npm. `npm ci`, lint, typecheck, Expo Doctor et Android n'ont pas été exécutés, et ne sont donc pas déclarés réussis.

## Prompt 03 — Design system natif

Les tokens Medilink de `src/constants/theme.ts` reprennent la palette de marque du web (`#2563EB` primaire, `#0D9488` secondaire, `#F8FAFC` surface, `#1E293B` texte) avec mode sombre contrasté et tailles Android accessibles.

Composants réutilisables : `src/components/ui/primitives.tsx` (Button, Card, Badge, Avatar, Screen, Header), `form-fields.tsx` (Input, PasswordField, SelectField, ToggleField), `states.tsx` (EmptyState, ErrorState, LoadingState), `overlays.tsx` (Modal, ToastProvider, useToast). Le fournisseur des toasts est installé dans `src/app/_layout.tsx`.

Galerie interactive **locale** : route `/dev/design-system`, indisponible en production (redirection). Elle n'effectue aucun appel API et ne contient aucune donnée médicale réelle. Consulter [MOBILE_DESIGN_SYSTEM.md](docs/MOBILE_DESIGN_SYSTEM.md) pour les tokens et limites.

Les contrôles de type/lint/build sur appareil nécessitent une installation effective de `node_modules` et restent à exécuter dans un environnement connecté. Le site responsive Vercel demeure une condition préalable à la validation des vrais écrans métier.

## Prompt 05 — Client HTTP et services typés

Le transport `src/services/http-client.ts` prend en charge timeouts, annulations, 401/403/404/409/422/500, erreurs réseau, JSON et multipart React Native. `src/services/http.ts` expose `apiRequest` et un futur point d'intégration aux tokens sécurisés.

Les types partagés sont dans `src/types/domain.ts` et les services API dans `src/services/{auth,doctors,patients,needs,appointments,availabilities,messages,notifications,admin,integration}.ts`. Aucun faux endpoint ni réponse simulée en production.

```sh
npm run test:http
npm run check
```

Voir [MOBILE_API_CLIENT.md](docs/MOBILE_API_CLIENT.md) pour l'usage, le réseau émulateur/téléphone/production et les contraintes de confidentialité. Les tests ont été **rédigés mais non exécutés** dans l'environnement de modification : la validation sur un checkout connecté reste obligatoire.

## Prompt 06 — Connexion et inscription publiques

- `/login` : authentification par e-mail/mot de passe, messages d'erreur et anti-double envoi.
- `/choose-role` : choix patient ou médecin exclusivement.
- `/register` : coordonnées, mot de passe confirmé, consentement ; spécialité et numéro professionnel pour les médecins ; confirmation de l'e-mail exigée par l'API.
- Les requêtes utilisent `POST /auth/login`, `POST /auth/register` et `GET /auth/profile` sans mock de données.
- Un profil NestJS revalidé détermine le rôle effectif avant la navigation. Les identifiants ne sont jamais inclus dans le code ou dans les tests.
- **Session temporaire en mémoire** : à remplacer au prompt 07 par un stockage sécurisé et un rafraîchissement des tokens, après vérification des contrats.
- Tests locaux : `npm run test:auth` (validateurs et erreurs) ; pipeline PR : `.github/workflows/android-validation.yml`.
- [Documentation et plan de recette](docs/MOBILE_PUBLIC_AUTH.md). La vérification responsive authentifiée sur le site Vercel et les tests sur véritable appareil restent à exécuter.

## Prompt 07 — Session mobile sécurisée

- Tokens `idToken` et `refreshToken` conservés dans **Expo SecureStore** (Android Keystore), jamais dans AsyncStorage, l'URL ou Zustand.
- `src/features/auth/session-manager.ts` : restauration au démarrage, validation auprès de `/auth/refresh` et `/auth/profile`, expiration proactive, refresh single-flight, verrou de génération contre l'écrasement d'une nouvelle session, déconnexion et purge des données locales.
- `src/services/http-client.ts` : retry unique sur 401, abandon des réponses tardives d'un ancien compte et invalidation du token si le retry échoue encore.
- `src/components/auth/logout-button.tsx` : déconnexion depuis les profils patient et médecin et depuis l'espace administrateur.
- Documentation : [MOBILE_SECURE_SESSION.md](docs/MOBILE_SECURE_SESSION.md).
- Tests : `npm run test:session`, `npm run test:http`, puis `npm run check`.
- Dépendance : `expo-secure-store@~58.0.3` et configuration de l'exclusion Android Auto Backup. Installer via `npm ci` dans un environnement connecté.

**Attention :** les tests Node, les vérifications TypeScript/lint et la compilation Android restent à exécuter sur un runner disposant de npm et du SDK. Les tests dans le dépôt n'impliquent pas qu'ils ont réussi.

## Prompt 08 — Récupération et introduction

- `/forgot-password` utilise le contrat réel `POST /auth/reset-password` (e-mail Firebase uniquement), sans OTP ni SMS.
- La confirmation reste neutre, que l'adresse soit enregistrée ou non. Aucun détail backend de compte n'est affiché.
- L'écran d'accueil public présente les trois étapes du service, sans données médicales de démonstration, puis propose connexion et inscription.
- `/account-status` distingue seulement une vérification e-mail explicitement indiquée par le backend d'un refus générique; un compte suspendu/supprimé reste non identifiable dans les erreurs.
- Le rôle et le statut d'un médecin `pending` restent issus du backend. La notice de validation en attente ne modifie aucune permission serveur.
- Tests : `npm run test:onboarding`, inclus dans `npm run check` et la CI de la PR.
- [Contrats, scénarios et limites](docs/MOBILE_RECOVERY_ONBOARDING.md).

La revue responsive de la version Vercel et les tests sur émulateur Android restent à confirmer ; **aucun scénario E2E n'est déclaré réussi** dans ce lot.

## Pull Request de continuité

La PR #1 a été fusionnée le **13 novembre 2026**. Pour préserver la règle de **branche unique**, les commits non fusionnés et les prompts suivants sont suivis par la [PR #2](https://github.com/KafackLolys/medilink-mobile/pull/2), **sur la même branche** `docs/mobile-audit-parity-2026-11-13`. Ne pas créer une nouvelle branche par prompt. La PR #2 reste en brouillon jusqu'à validation technique et fonctionnelle.

## Prompt 09 — Tableau de bord patient

- `src/app/patient/(tabs)/index.tsx` : dashboard React Native relié aux vrais endpoints authentifiés `/auth/profile`, `/needs`, `/appointments`, `/notifications`, `/messages/conversations`.
- Actions rapides, synthèses calculées uniquement à partir des réponses, demandes et prochain rendez-vous, aperçu des messages et notifications, chargement indépendant, pull-to-refresh, états vides et erreurs.
- `src/features/patient/dashboard-model.ts` : agrégation pure et sans données fictives, testée avec `npm run test:patient`.
- [Correspondance Web/API/mobile et recette Android](docs/MOBILE_PATIENT_DASHBOARD.md).

Le site Vercel reste la référence pour la parité responsive ; aucune consultation visuelle authentifiée n'a pu être réalisée depuis ce runtime. Un test réel avec le compte patient autorisé reste indispensable avant validation E2E.

## Prompt 10 — Annuaire de médecins

- `/patient/medecins` : annuaire natif `FlatList`, filtres réellement pris en charge par l'API `GET /doctors` : `q`, `city`, `specialty` (100 caractères maximum).
- Les spécialités sont issues de l'API. Aucune pagination côté serveur, donc pas de pseudo-pagination sur l'app.
- Cartes avec nom, spécialité, statut vérifié, secteur, modes, expérience, note si disponible, avatars par initiales : aucune photo n'est exposée par le contrat courant.
- Requêtes annulables, protection contre réponses périmées, actualisation native, états vides et erreurs.
- Mapping/test : `src/features/patient/doctor-directory.ts` et `npm run test:doctors`.
- [Contrats et scénarios de recette](docs/MOBILE_DOCTOR_DIRECTORY.md).

La validation visuelle responsive authentifiée sur Vercel et les tests sur téléphone Android avec le compte patient restent à effectuer.

## Prompt 11 — Profil public du médecin

- `/patient/medecins/[id]` charge le profil vérifié depuis `GET /doctors/:id`.
- Données professionnelles uniquement : identité, présentation, localisation, prix indicatif, notes agrégées, modes de consultation, calendrier hebdomadaire et dates bloquées publiques.
- Aucun document de validation, téléphone, e-mail, matricule ou avis individuel n'est exposé à partir de la fiche publique.
- Les consultations terminées sont identifiées depuis les seuls rendez-vous du patient ; l'avis reste soumis à l'autorisation serveur et sera intégré avec la fonctionnalité rendez-vous.
- `src/features/patient/doctor-profile.ts` : liste autorisée des champs et logique d'affichage, validée par `npm run test:doctor-profile`.
- [Contrat, limites, tests et recette](docs/MOBILE_DOCTOR_PUBLIC_PROFILE.md).

La PR #2 a été fusionnée pendant le développement ; la **PR #3** reprend les changements ultérieurs sur la même branche unique, sans nouvelle branche. La comparaison responsive Vercel et le parcours authentifié Android restent à exécuter.

## Prompt 12 — Besoins médicaux patient

- Création guidée `/patient/besoins/nouveau` avec validation du contrat, aperçu, consentement, priorité non urgente et jusqu'à 5 pièces jointes PDF/images de 10 Mo.
- Liste `/patient/demandes`, filtres par statuts réels, détail privé et modification des seuls champs acceptés par `PATCH /needs/:id`.
- Clôture des demandes actives et suppression **uniquement des brouillons serveur**, chacune après confirmation et actualisation.
- Aucune persistance locale de symptômes, adresse ou documents médicaux ; formulaire temporaire en mémoire.
- Tests des transitions, champs et fichiers : `npm run test:needs`, inclus dans la CI.
- Voir [MOBILE_PATIENT_NEEDS.md](docs/MOBILE_PATIENT_NEEDS.md) pour contrats, confidentialité et recette.

## Prompt 13 — Réservation et suivi des rendez-vous patient

- `/patient/medecins/[id]/rendez-vous` : formulaire de date/heure souhaitées, mode réel du médecin, motif facultatif et confirmation via `POST /appointments`.
- Les plages hebdomadaires et dates bloquées viennent uniquement de `GET /doctors/:id`. L'API n'expose **aucun endpoint public de créneaux libres garantis**. Les conflits sont décidés par le serveur et affichés sans fuite de détails.
- Fuseau IANA du téléphone, ISO UTC à l'envoi, contrôle des heures futures et d'une consultation entière dans la plage réelle.
- `/patient/rendez-vous` : liste authentifiée `GET /appointments`, filtres de statuts, retour depuis un détail et pull-to-refresh.
- `/patient/rendez-vous/[id]` : lecture protégée du rendez-vous, suivi et accès aux messages.
- **Pas de bouton d'annulation patient** : `PATCH /appointments/:id/status` est réservé au médecin par l'API actuelle.
- Tests : `npm run test:appointments`, inclus dans `npm run check` et la CI.
- [Contrats, conflits et recette Android](docs/MOBILE_PATIENT_APPOINTMENTS.md).

La création E2E avec un vrai compte, les essais sur Android et la comparaison responsive avec Vercel restent obligatoires avant fusion.

## Prompt 14 — Profil patient et dossier médical

- `/patient/profil` : véritable interface React Native, identité et coordonnées issues de `GET /auth/profile`, données de santé via `GET /patients/me/conditions`, documents via `GET /patients/me/documents`.
- `PATCH /integration/patient/profile` permet de modifier le nom, le téléphone, le groupe sanguin et, lorsqu'une adresse existante est réellement exposée, ville/quartier. L'e-mail, le genre, la date de naissance et les conditions médicales sont en lecture seule.
- `POST /patients/me/documents` et `DELETE /patients/me/documents/:id` : ajout/suppression de documents du patient, confirmation destructrice, fichiers PDF/JPEG/PNG/WebP ≤10 Mo, liens signés temporaires.
- Dossier médical masqué par défaut, sources chargées indépendamment, états vides et erreurs par section, relecture après mutation. Aucune donnée médicale enregistrée dans AsyncStorage.
- `src/features/patient/patient-medical-profile.ts` : mapping strict des réponses, validation des champs et fichiers ; tests `npm run test:patient-profile` en CI.
- [Contrat, restrictions de modification et recette médicale Android](docs/MOBILE_PATIENT_MEDICAL_PROFILE.md).

Le backend `GET /auth/profile` retourne actuellement `address:null` et `verified:false` pour le patient : le mobile ne fabrique ni adresse ni statut. Le parcours E2E réel et la comparaison responsive Vercel restent à valider.

## Prompt 15 — Accueil médecin Android

- `/medecin` : tableau de bord natif alimenté par les endpoints réels `GET /doctors/me`, `/needs/doctor`, `/needs/doctor/proposals`, `/appointments/doctor`, `/availabilities/me/weekly`, `/availabilities/me/blocked` et `/messages/conversations`.
- Le profil professionnel **verified** est impératif avant toute interrogation des besoins et propositions patients. Les statuts `pending`, `rejected`, `suspended` affichent un panneau d'accès limité, sans compteur trompeur.
- Cartes d'actions prioritaires, résumés tirés des totaux paginés du serveur, prochains rendez-vous et consultations du jour en heure Africa/Douala, plages actives et conversations. Les données factices des modules web `doctor-dashboard-data` / `doctor-portal-data` ne sont pas utilisées.
- Chargement progressif par source, erreurs partielles, états vides, pull-to-refresh et purge de l'état de l'écran à la navigation.
- Modèles testables dans `src/features/doctor/doctor-dashboard.ts` et tests `npm run test:doctor-dashboard` intégrés à GitHub Actions.
- [Contrats, droits et recette Android](docs/MOBILE_DOCTOR_DASHBOARD.md).

La PR #3 ayant été fusionnée entre-temps, les prompts de la phase médecin continuent sur **la branche historique identique** dans la [PR #4](https://github.com/KafackLolys/medilink-mobile/pull/4) en brouillon.

## Prompt 16 — Besoins et propositions médecin

- `/medecin/besoins` : annuaire patient accessible uniquement aux **médecins professionnellement vérifiés**, filtres `q`, `specialty`, `priority`, `mode` et pagination réelle `GET /needs/doctor`.
- `/medecin/besoins/[id]` : détail depuis `GET /needs/doctor/:id`, ville/quartier et pièces jointes volontairement partagées ; **jamais** les coordonnées, adresses précises ou dossiers privés du patient.
- Formulaire de proposition, date/heure futures, mode et tarif XAF validés, aperçu puis `POST /needs/doctor/:id/proposals`, gestion du conflit 409 et sans double envoi.
- `/medecin/propositions` : liste paginée, six statuts et compteurs réels du backend ; annulation via `PATCH /needs/doctor/proposals/:id/cancel` **seulement** pour `pending` et `sent`, confirmation et relecture après action.
- Aucun stockage local persistant d'informations médicales ; écrans purgés à leur sortie, contrôles serveur de rôle/ownership toujours appliqués.
- Tests `npm run test:doctor-needs` et CI ; [contrats, règles et recette Android](docs/MOBILE_DOCTOR_NEEDS_PROPOSALS.md).

L'intégration avec un véritable compte médecin, l'ouverture de documents signés sur téléphone et la comparaison responsive Vercel restent à valider avant fusion.

## Prompt 17 — Agenda et disponibilités médecin

- `/medecin/disponibilites` : paramètres natifs de consultations à domicile/téléconsultation (`PUT /availabilities/me/modes`), durée de 15/20/30/45/60 min (`PATCH /availabilities/me/duration`), calendrier complet des sept jours (`PUT /availabilities/me/weekly`) avec heure à la minute, ajout/suppression de dates bloquées (`POST/DELETE /availabilities/me/blocked`) et confirmation avant retrait.
- Les horaires sont remplacés **ensemble** par le contrat backend ; création, modification et désactivation d'une plage se font sur l'ensemble des sept jours, pas via une route PATCH/DELETE individuelle inexistante.
- `/medecin/rendez-vous` : agenda `GET /appointments/doctor`, filtres et mise à jour de statut `PATCH /appointments/:id/status` après confirmation et relecture. Le serveur vérifie le médecin propriétaire et l'enum, mais **n'impose pas de matrice de transition** supplémentaire.
- Calendrier et sélecteur horaire React Native natifs sans nouvelle dépendance ; prévention des dates bloquées dupliquées, heures invalides, modes/durées refusés ; aucune disponibilité inventée.
- Tests `npm run test:doctor-agenda` et CI pour le cycle création/modification/désactivation des plages, dates bloquées, droits et dates.
- [Contrats exacts, cas limites de fuseau et recette Android](docs/MOBILE_DOCTOR_AGENDA_AVAILABILITY.md).

L'essai sur un véritable appareil, l'écriture réelle des disponibilités, les conflits de rendez-vous et la comparaison responsive restent à faire avant fusion.

## Prompt 18 — Profil professionnel médecin et justificatifs

- `/medecin/profil` : écran natif réel de profil médecin, vérification professionnelle, identité, spécialité principale/secondaires, numéro d'inscription, qualifications, réputation, modes de consultation et documents.
- `PATCH /doctors/me` : modification **uniquement** de `bio` (600 caractères max), `yearsOfExperience` (0–80), `consultationFee` (0–100 000 000) et `professionalAddress` (≤255 caractères). Les autres informations restent en lecture seule tant qu'aucun endpoint ne permet leur modification.
- `POST /doctors/me/documents` : envoi multipart d'un justificatif sélectionné via `expo-document-picker` au format PDF/JPEG/PNG/WebP, taille entre 1 octet et 10 Mo, maximum 50 documents par profil ; vérification réelle des signatures MIME côté serveur. Les nouveaux documents sont `pending`, jamais approuvés automatiquement.
- `DELETE /doctors/me/documents/:id` : suppression après confirmation. **Attention : la suppression d'un justificatif approuvé remet le médecin au statut professionnel `pending` dans l'API actuelle.** L'écran avertit et recharge le profil.
- Sélecteur système sans permission Android globale de stockage, liens de consultation HTTPS signés temporaires, contrôle du rôle `doctor`, prévention des doubles opérations, purge de l'écran à la déconnexion et protection contre les réponses obsolètes.
- Tests `npm run test:doctor-profile-edit` en GitHub Actions.
- [Contrats exacts, restrictions de sécurité et recette Android](docs/MOBILE_DOCTOR_PROFESSIONAL_PROFILE.md).

Les tests avec un compte médecin sur appareil physique, l'upload et la suppression E2E, l'analyse du rendu responsive du site et Expo Doctor restent à valider avant fusion.

## Prompt 19 — Messagerie patient et médecin

- `/patient/messages` et `/medecin/messages` : écrans React Native natifs utilisant `GET /messages/conversations`, `GET /messages/conversations/:id` et `POST /messages/conversations/:id`.
- Liste des conversations avec non-lus, fil de discussion avec identification de l'expéditeur, saisie 1–4000 caractères, clavier Android, autoscroll, actualisation, erreurs et envoi confirmé par le serveur.
- Poll HTTP uniquement à l'écran toutes les 15 s, sans inventer de WebSocket, pièce jointe, création arbitraire de conversation ni pagination du fil. Les messages restent bornés aux **100 derniers** disponibles sur l'API.
- L'accès est limité aux comptes `patient` et `doctor` (médecin professionnellement vérifié) disposant d'une proposition active ; `admin` exclu. Validation de l'appartenance à la liste autorisée, revalidation backend, purge à la navigation et garde d'epoch par compte/conversation.
- Aucun message sauvegardé dans AsyncStorage ni stockage médical persistant. Un POST ambigu ne déclenche jamais de réessai automatique pouvant créer un doublon.
- Tests `npm run test:messaging` dans `npm run check` et GitHub Actions ; [contrat, confidentialité et recette Android](docs/MOBILE_MESSAGING.md).

Les échanges E2E entre vrais comptes, le clavier sur appareil Android, le lint, Expo Doctor et la comparaison responsive Vercel restent à vérifier avant fusion.

## Prompt 20 — Notifications Android FCM

- `/patient/notifications`, `/medecin/notifications` : centre natif des notifications, pagination et non lus réels, marquage unitaire `PATCH /notifications/:id/read` et global `PATCH /notifications/read-all`, actualisation et navigation limitée aux destinations autorisées.
- `expo-notifications ~58.1.9` pour SDK 58 Android, canal `medilink-updates`, permission utilisateur et `getDevicePushTokenAsync()` : **token FCM natif** conforme au backend NestJS Firebase Admin, **pas** de token Expo Push Service.
- `POST /notifications/devices` : inscription du terminal lié au Firebase UID authentifié, `deviceId` enregistré dans Expo SecureStore ; `POST /notifications/devices/:deviceId/unregister` tenté **avant le logout**. Aucun token dans les logs/URLs.
- Réception et rafraîchissement au premier plan ; notification Android standard en arrière-plan/fermeture, ouverture après authentification et validation du propriétaire de la notification côté API. Pas de tâche background « headless » fictive.
- Config Firebase de build via `app.config.js` (`MEDILINK_ANDROID_PACKAGE`, `MEDILINK_GOOGLE_SERVICES_FILE`) ; fichier Firebase réel et identifiant Android Firebase **obligatoires pour tester FCM sur une build Android**. Expo Go Android ne suffit pas depuis SDK 53.
- Tests `npm run test:notifications` dans GitHub Actions. [Contrat, permissions, contraintes de sécurité et recette sur appareil](docs/MOBILE_ANDROID_NOTIFICATIONS.md).

**Limites :** aucun envoi/réception FCM sur appareil n'a été testé faute de configuration Firebase Android réelle ; la déconnexion hors ligne ne peut garantir une désinscription serveur immédiate. La recette sur build Android, le lint et Expo Doctor restent à exécuter.

## Prompt 21 — Gestion des documents médicaux patient/médecin

- Parcours commun de sélection par Android SAF (`expo-document-picker`) avec `copyToCacheDirectory:false` : **pas de copie locale systématique**, pas de permission globale de stockage ni de permission caméra.
- Validation avant transfert : PDF, JPEG, PNG, WebP, **1 octet à 10 Mo**, titres et noms limités, catégories propres au patient ou au médecin, **50 justificatifs maximum seulement côté médecin**.
- Métadonnées consultables avant envoi, consultation d'un document enregistré via **URL HTTPS signée et temporaire** dans `expo-web-browser`, sans téléchargement volontaire vers un cache permanent de l'app.
- Upload multipart du vrai backend `POST /patients/me/documents` / `POST /doctors/me/documents`, attente avec indicateur **non chiffré** (aucun progrès mesurable exposé), suppression confirmée via les endpoints DELETE réels, relecture après mutation.
- Documents patient : recherche, catégories et pagination locale par 6 comme sur le site web. Changement de compte et retours tardifs neutralisés.
- Suppression d'un justificatif médecin approuvé : avertissement de possible retour du profil à `pending`.
- Tests `npm run test:documents` dans GitHub Actions : MIME/taille, catégories, refus de permissions, erreurs confidentielles, URL signées, filtre et pagination.
- [Contrat complet, confidentialité, limitations backend et recette Android](docs/MOBILE_MEDICAL_DOCUMENTS.md).

À vérifier sur **vrai téléphone Android** : permission d'accès aux documents, transfert multipart direct depuis les URI `content://`, consultation des liens signés, écrans et rotation. Le backend patient doit encore valider les signatures réelles de fichiers et les catégories de documents comme le backend médecin.

## Prompt 22 — Recherche géographique et zones d'intervention

- Annuaire patient : filtres manuels réellement supportés par `GET /doctors` (`q`, `specialty`, `city`), sans permission de localisation et sans géocodage artificiel. Les profils retournent ville et quartiers déclarés, **pas de coordonnées GPS** ; seule la liste est disponible aujourd'hui, aucune carte positionnée fictivement.
- `/medecin/zone-intervention` : formulaire Android de gestion des zones `GET/PUT /integration/doctor/zone`, ville obligatoire (≤100 caractères), jusqu'à 40 quartiers (≤100 chacun), rayon entier 1–250 km, distance maximale entière 1–500 km au moins égale au rayon. Relecture du serveur après sauvegarde.
- Aucun `expo-location`, aucune permission fine/coarse/background et **aucun suivi permanent** : le backend ne possède ni endpoint de distance GPS ni coordonnées validées pour les médecins. Refuser la localisation ne bloque aucune fonctionnalité prise en charge.
- Contrôles du rôle médecin, suppression d'état au changement de compte, validation stricte des coordonnées futures éventuelles, erreurs privées non divulguées.
- Tests `npm run test:geo` ajoutés au projet et à la CI ; [audit, contraintes exactes et recette Android](docs/MOBILE_GEO_INTERVENTION_ZONES.md).

La vraie carte GPS n'est pas réalisable sans coordonnées professionnelles validées renvoyées par l'API ; les tests réels Android et la comparaison visuelle responsive restent à compléter avant fusion.

## Prompt 23 — Avis et historiques de consultations

- Patient : avis sur le **rendez-vous** via `GET/POST /appointments/:id/review` ; un seul avis par consultation `completed`, note entière 1–5, commentaire optionnel ≤2 000 caractères. Consultation de l'avis avant envoi, verrou anti-double-soumission, relecture après résultat réseau incertain et **aucune tentative POST automatique**.
- `/patient/historique` : historique natif des consultations terminées du compte authentifié, filtres Toutes/Ce mois/Cette année et accès aux détails pour consulter ou déposer un avis. Depuis la fiche du médecin, les rendez-vous terminés avec celui-ci permettent de retrouver le formulaire d'évaluation.
- Médecin : `/medecin/avis` récupère `GET /doctors/me/reviews`, affiche **uniquement** les notes, la distribution et les totaux renvoyés par le serveur, et filtre les avis par étoiles. Identité patient minimisée par l'API.
- `/medecin/historique` : rendez-vous du médecin `GET /appointments/doctor`, historique limité aux statuts `completed`, filtres par période, note et nombre d'avis du vrai profil professionnel. Aucun indicateur de performance ou avis fictif.
- Contrôles par rôle et propriétaire côté API, données purgées au changement de vue/compte, erreurs neutres et accès par les agendas natifs.
- Tests `npm run test:reviews` dans la CI ; [contrat exact, permissions, limites et recette Android](docs/MOBILE_REVIEWS_HISTORY.md).

À valider sur téléphone : création de vrais avis, double POST sur deux appareils, isolement intercomptes, lectures des évaluations et historiques, lint, Expo Doctor et comparaison au web.

## Prompt 24 — Administration native sécurisée

- `/admin` : écran Android de consultation des comptes **patients/médecins uniquement**, recherche nom/e-mail/téléphone (`q` ≤100), pagination serveur par 10 (API max 50), statuts, vérification patient et vérification professionnelle médecin.
- `GET /admin/accounts` et `PATCH /admin/accounts/:id/status`, `PATCH /admin/accounts/:id/verification` : uniquement les endpoints réellement autorisés et protégés par les **deux gardes** `FirebaseAuthGuard` et `AdminGuard`. L'écran exige également la session admin active et vérifie `GET /auth/profile` avant les lectures.
- Les modifications sensibles passent par **deux confirmations**, ne visent qu'un compte par action, ne sont jamais affichées de façon optimiste et rechargent la liste après succès ou erreur. Suspension/suppression : le serveur désactive Firebase Auth et révoque les refresh tokens ; en cas de réponse 503, le statut Firestore peut avoir été changé avant l'échec de synchronisation.
- Aucune vue de dossier médical ou modification d'administrateur, aucune persistance d'informations administratives sur le téléphone, aucune journalisation de secrets.
- `POST /admin/admins` existe mais la **création d'administrateur reste sur le web** : l'opération nécessite la gestion/transmission d'un mot de passe provisoire et une compensation en cas d'échec.
- Tests `npm run test:admin` intégrés à `npm run check` et GitHub Actions ; [contrats, décisions de sécurité et recette Android](docs/MOBILE_ADMINISTRATION.md).

Une recette avec un véritable admin actif et un compte refusé reste nécessaire avant fusion, ainsi que lint, Expo Doctor et vérification du rendu Android.

## Prompt 25 — Résilience des réseaux mobiles instables

- Détection du statut du réseau via `expo-network ~58.0.5` (Expo SDK 58), bannière globale hors connexion/connexion limitée, **sans GPS ni collecte d'IP/SSID**.
- Le client HTTP conserve les timeouts, `AbortController`, authentification Firebase et garde de génération de session. Un retry `safe-get` est **explicitement opt-in** et limité à trois tentatives avec 300/900 ms de backoff ; seuls `GET /doctors` et `GET /doctors/:id` l'utilisent pour les erreurs réseau/timeout ou HTTP 429/502–504.
- **Aucun retry implicite d'une écriture** `POST`, `PATCH`, `PUT`, `DELETE`, même après une réponse 401. Les réservations et créations de besoins ne sont jamais rejouées automatiquement, faute de garantie d'idempotence.
- Cache de secours **strictement RAM**, 12 recherches publiques de médecins au maximum, expiration après 5 minutes, champs explicitement publics uniquement et purge au changement de session. Aucune donnée patient, dossier, rendez-vous, message, document, URL de stockage, compte admin ou token n'est persisté. La copie d'annuaire est clairement signalée comme potentiellement ancienne.
- En mode explicitement hors ligne : annuaire public disponible immédiatement via cache valide, sinon état d'erreur. Rechargement automatique de la **lecture sûre** après rétablissement de la connexion ; autres écrans avec actualisation manuelle.
- Tests de coupure/reprise, 401/403, absence de double POST, délais bornés, annulation pendant backoff, changement de compte et expiration du cache avec `npm run test:network` et les tests HTTP précédents.
- [Audit technique et recette réseau Android](docs/MOBILE_NETWORK_RESILIENCE.md).

Reste à effectuer avant fusion : tests instrumentés en mode avion/données mobiles lentes, vérification sur un vrai Android, lint, Expo Doctor et contrôle visuel.

## Prompt 26 — UX, accessibilité et finitions Android

- Revue de l’inventaire des routes d’authentification, publiques, patient, médecin et admin, ainsi que des composants transversaux. **Audit statique du code**, pas encore une certification visuelle ou TalkBack sur téléphone.
- Composants communs : boutons et badges compatibles avec l’agrandissement des caractères, labels flexibles, en-têtes adaptables, avatars annoncés sans doublon, contrôles tactiles de **48 points**.
- Champs : erreurs associées aux saisies, labels et hints accessibles, bouton d’affichage du mot de passe de 48 points, sélections radio et interrupteurs annoncés.
- Modales : contenu défilable et clavier géré, safe areas respectées, confirmation sensible non fermable par retour Android pendant une mutation. Toasts et bannière hors connexion décalés sous la barre de statut Android.
- Messagerie : retour matériel Android d’un fil vers sa liste de conversations, libellés explicites et compositeur adaptable. `Screen` évite que les derniers champs soient masqués par les onglets et autorise l’effacement du clavier au scroll.
- Nouveau `npm run test:ux` dans `npm run check` et GitHub Actions : tests structurels de l’inventaire, protections par rôle, états, navigation, safe areas et accessibilité.
- [**Checklist par écran, correctifs vérifiés dans le code, limites et recette Android**](docs/MOBILE_UX_ACCESSIBILITY_AUDIT.md).

**Reste obligatoire avant fusion** : TalkBack, polices 150/200 %, navigation au bouton retour et clavier Android réel, petits écrans, contrastes visuels, lint, Expo Doctor et comparaison avec le site.

## Prompts 29–30 — Distribution Android et recette finale

- `eas.json` : development APK avec Expo Dev Client, preview APK interne, production AAB Google Play ; signature EAS et versionCode remote increment. `app.config.js` exige les paramètres Android/Firebase/EAS réels et une URL d'API valide. **Aucun package ni project ID factice n'a été ajouté.**
- `app.json` : nom Medilink, version `1.0.0`, versionCode initial `1` à confirmer au Play Console, scheme `medilinkmobile` maintenu, permissions réduites (aucun GPS/caméra/stockage global).
- `expo-dev-client` SDK 58, `eslint-config-expo`, `eslint.config.js` ajoutés ; patches Expo conformes à Expo Doctor, qualité vérifiée par `.github/workflows/release-quality.yml` (npm ci, précontrôle, TypeScript, Expo Doctor, lint, tests).
- `scripts/validate-android-release.cjs` : contrôle structurel `npm run release:validate`, et contrôle strict de la configuration Firebase/package/branding `npm run release:validate:strict`, avec refus si les prérequis sont absents.
- [Procédure EAS Build et installation](docs/ANDROID_RELEASE_BUILD.md) · [Matrice complète de parité](docs/MOBILE_PARITY_MATRIX.md) · [Recette Android à signer](docs/ANDROID_FINAL_ACCEPTANCE.md) · [Notes version candidate **source**](docs/ANDROID_RELEASE_NOTES.md).

**Verdict 13/11/2026 : NON PRÊT À PUBLIER.** Aucun APK/AAB signé ni `artifactUrl` vérifié. Les fichiers image de lancement contiennent encore des éléments Expo et des pages publiques légales sont provisoires ; aucune recette médicale Android réelle ou certification de conformité n'a été réalisée.
