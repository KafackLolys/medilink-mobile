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

Prompt 02 : le starter « Home / Explore » a été retiré de la navigation et un écran technique temporaire a remplacé « Welcome to Expo ». Un Stack Expo Router est configuré. Les assets et composants techniques existants restent préservés. Aucune page métier, authentification ou communication avec l'API n'est encore implémentée.

**Avant la création de chaque écran** : examiner la vue responsive sur https://medilink-nu-ten.vercel.app/ (360 / 390 / 430 px) avec le rôle approprié, puis comparer avec la page Next.js et les contrôleurs backend. Ne pas prétendre avoir réalisé cette inspection si l'accès navigateur était impossible. Les identifiants des trois comptes de test sont transmis séparément, jamais dans Git.

## Branche commune

Continuer **tous les prompts** dans `docs/mobile-audit-parity-2026-11-13` et conserver la [Pull Request #2](https://github.com/KafackLolys/medilink-mobile/pull/2) pour les travaux restants (la PR #1 ayant déjà été fusionnée). Ne pas fusionner prématurément.

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
