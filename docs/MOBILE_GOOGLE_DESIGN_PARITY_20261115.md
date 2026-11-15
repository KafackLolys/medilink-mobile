# MediLink Android — Google Sign-In et parité visuelle (15 novembre 2026)

Cette implémentation est portée par la branche `feat/mobile-parity-google-session-20261115`.
Elle ne constitue **pas** une preuve de fonctionnement sur un appareil ni une release signée.

## Fonctionnement

1. Sur l'accueil, la connexion et le choix de profil, les actions sont natives (React Native).
2. « Continuer avec Google » ouvre le sélecteur de comptes Android via `@react-native-google-signin/google-signin`.
3. Le Google ID token est échangé contre une **session Firebase Authentication** avec `accounts:signInWithIdp`. Le token Firebase est vérifié côté serveur :
   - `POST /auth/google/status` retrouve le compte MediLink existant ;
   - un compte inconnu choisit une fois `patient` ou `doctor`, puis `POST /auth/google/complete` crée le compte ;
   - `admin` ne peut jamais être créé par l'authentification publique.
4. La session Firebase est convertie au contrat de l'API existante `LoginResponse` et transmise à `SessionManager.login()`. L'application vérifie `GET /auth/profile` et le rôle serveur avant toute route protégée.
5. ID token et refresh token sont enregistrés **uniquement dans Expo SecureStore**, jamais dans Zustand, des URL, des logs ou AsyncStorage. Au redémarrage, la session est revalidée. Un renouvellement est exécuté avant expiration.
6. La déconnexion efface la session locale immédiatement et appelle les opérations de révocation du serveur. Un compte suspendu, supprimé, un refresh token explicitement révoqué ou un profil incohérent invalide la session.
7. **Panne réseau ≠ déconnexion** : une erreur transitoire laisse les jetons protégés, présente un écran « session conservée », et permet une nouvelle tentative de vérification. Elle ne permet **pas** d'accéder hors ligne aux dossiers médicaux.

Le champ « Rester connecté » de l'écran web correspond sur mobile au **comportement permanent par défaut**, pas à un paramètre susceptible de réduire la sécurité.

## Configuration Android obligatoire

- Utiliser le **même projet Firebase** que la version web/API.
- Activer le fournisseur Google dans Firebase Authentication.
- Configurer un client OAuth Android correspondant à l'identifiant Android définitivement approuvé.
- Ajouter les empreintes **SHA-1 et SHA-256** pertinentes : certificat EAS preview/development, certificat de signature de publication, certificat Google Play App Signing.
- Associer un client OAuth de type **Web** à `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (identifiant public, **pas** un secret OAuth).
- Renseigner `EXPO_PUBLIC_FIREBASE_API_KEY` (clé Firebase **publique du client**, pas la clé Admin).
- Utiliser `MEDILINK_GOOGLE_SERVICES_FILE` vers un `google-services.json` Android du projet Firebase approprié. `app.config.js` gère le chemin lors de la compilation EAS.
- Conserver les variables déjà exigées pour EAS : `MEDILINK_ANDROID_PACKAGE`, `MEDILINK_EAS_PROJECT_ID`, `EXPO_PUBLIC_API_BASE_URL`. Ne jamais committer une clé de compte de service ou un secret EAS.
- Exécuter `npx expo install @react-native-google-signin/google-signin` dans un environnement réseau autorisé pour garantir la compatibilité et régénérer les métadonnées du lockfile si nécessaire.
- **Expo Go ne suffit pas.** Tester avec `npx eas-cli@latest build --profile development --platform android` ou `npx expo run:android`.

Référence de configuration : https://docs.expo.dev/guides/google-authentication/ et https://react-native-google-signin.github.io/docs/setting-up/expo.

## Écrans repris du responsive web

- Accueil public : présentation, spécialités, fonctionnement, renvoi vers les parcours d'inscription.
- Connexion : compte Google, e-mail/mot de passe, récupération et conservation permanente des sessions.
- Choix de profil : patient ou médecin, y compris après authentification Google initiale.
- Annuaire médecin patient : fiche vérifiée, filtres, accès direct au rendez-vous.
- Administration : ajout de compte administrateur depuis un écran natif protégé, confirmation explicite, API existante `POST /admin/admins`.
- Aide, contact public (API réelle), politique de confidentialité, conditions d'utilisation.

Les pages légales web comportent encore des placeholders d'éditeur, de juridiction et de durée de conservation. L'application les signale : **leur approbation juridique est bloquante avant la release**.

## À vérifier avant fusion / release

- [ ] `npm ci` (lockfile et dépôt npm), `npm run typecheck`, `npm run lint`, `npm run check`.
- [ ] Validation Android réelle avec configuration Firebase/EAS et certificats OAuth.
- [ ] Inscription Google nouvelle patient/médecin, connexion d'un compte existant, admin existant, refus de profil admin par inscription.
- [ ] Session conservée après fermeture forcée et redémarrage; refresh rotatif; panne réseau et rétablissement; 401/403 et suspension.
- [ ] Déconnexion et impossibilité de restaurer une session explicitement révoquée; contrôle de fuite de données.
- [ ] Validation des écrans aux largeurs Android 360, 390 et 430 dp, grande police, TalkBack, clavier, mode sombre.
- [ ] Envoi de contact et création d'administrateur avec données de test dans un environnement isolé.
- [ ] Pas d'APK/AAB ou de parcours bout en bout affirmé sans artefact ou preuve.

En cas de code `DEVELOPER_ERROR` sur Google natif, vérifier d'abord identifiant d'application, empreinte SHA du certificat installé, client OAuth et fichier `google-services.json`.
