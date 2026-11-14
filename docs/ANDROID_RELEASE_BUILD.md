# Medilink Android — Build, signature et distribution (Prompt 29)

**Référence :** 13 novembre 2026 — Expo SDK 58, React Native 0.88, Expo Router, version applicative `1.0.0`. **État : configuration EAS préparée, aucun APK/AAB émis ou testé dans cette session.** Ne pas publier avant levée des blocages de marque, Firebase, EAS, API et recette sécurité.

## Identité et configuration

- `app.json` : nom affiché **Medilink**, `slug=medilink-mobile`, version `1.0.0`, `android.versionCode=1` initial **provisoire** (à confronter au Play Console), `scheme=medilinkmobile` conservé pour ne pas casser les deep links existants.
- `app.config.js` **ne contient aucun faux package Android**. Le package canonique doit être choisi, réservé et validé dans Firebase/Google Play, puis fourni dans **`MEDILINK_ANDROID_PACKAGE`** avec syntaxe reverse-DNS. Ne pas substituer un exemple.
- Configurer `MEDILINK_EAS_PROJECT_ID` (UUID réel) et `MEDILINK_GOOGLE_SERVICES_FILE` (variable EAS de type **file** contenant le vrai `google-services.json`). Le package figurant dans ce fichier Firebase doit correspondre strictement au package Android. Une clé privée **Firebase Admin SDK** n'a rien à faire dans l'application.
- `EXPO_PUBLIC_API_BASE_URL` : vraie URL HTTPS du **backend NestJS**, jamais celle du frontend web ni un domaine d'exemple. C'est une variable publique incluse dans l'APK/AAB : n'y mettre **aucun secret**.
- `MEDILINK_BRANDING_APPROVED=true` et `MEDILINK_VERSION_CODE_APPROVED=true` sont des attestations humaines explicites requises par le précontrôle strict **et directement par `app.config.js` pour tout build EAS `production`**. Elles **ne remplacent pas** la revue d'image de marque ni la vérification Google Play.
- `app.json` référence encore les ressources graphiques provenant du starter Expo. **Icône adaptative, splash et icône monochrome : bloquants pour publication** tant que des ressources officielles Medilink (formats Android, transparence et contrastes) n'ont pas été approuvées et intégrées. Les chemins existent, ce qui n'est pas une preuve de branding conforme.
- Permissions : Internet et `POST_NOTIFICATIONS` pour Android 13+. Accès GPS fin/coarse/background, caméra et accès élargi au stockage bloqués explicitement. Le sélecteur de documents utilise Storage Access Framework et n'a pas besoin d'accès global aux médias. `expo-notifications` ajoute les permissions Android nécessaires via son manifeste ; contrôler le **manifeste fusionné** avant publication.
- Aucune configuration EAS `extra.eas.projectId` définitive n'a été inventée. `app.config.js` la construit depuis `MEDILINK_EAS_PROJECT_ID`. Les profils EAS refusent un build si l'identité et les ressources Firebase ne sont pas fournies.

## Profils EAS (fichier eas.json)

| Profil | Format | Usage | Signature |
| --- | --- | --- | --- |
| `development` | **APK** avec `expo-dev-client@~58.0.20` | tests natifs et connexion à Metro, FCM/dev client | clé de signature de développement gérée par EAS/Android selon le type de build |
| `preview` | **APK** release, distribution `internal` | recette sur téléphone réel, partage contrôlé | keystore Android de release géré dans EAS Credentials, ne jamais le committer |
| `production` | **AAB** release `app-bundle` | Google Play (piste interne, puis publication après approbation) | upload key EAS + Play App Signing, appVersionSource `remote`, `autoIncrement:true` |

Le `versionCode=1` est une valeur locale de départ, **pas un numéro définitif**. Si Medilink existe déjà dans Google Play, initialiser la source distante EAS à une valeur supérieure au dernier code attribué dans Play Console avant le premier build.

## Procédure reproductible : sur un poste autorisé avec accès Expo/Firebase

1. Récupérer la branche de recette, inspecter les différences et ne pas publier un commit non revu :
```sh
git clone https://github.com/KafackLolys/medilink-mobile.git
cd medilink-mobile
git checkout docs/mobile-audit-parity-2026-11-13
npm ci
npm run typecheck
npm run lint
npm run doctor
npm run release:validate
node --test scripts/release-config.test.mjs
npm run check
```
2. Installer une version EAS CLI compatible (`eas --version`, exigence `>=24.12.1`), puis `eas login` ou un `EXPO_TOKEN` de CI conservé **en secret**, jamais dans `.env` committé.
3. Choisir **un package définitif** après vérification de son unicité, créer l'application Android dans le **projet Firebase utilisé par NestJS**, récupérer `google-services.json` Android et configurer les variables de chaque environnement EAS (`development`, `preview`, `production`) :
   - `MEDILINK_ANDROID_PACKAGE` : texte (valeur approuvée, identique entre Firebase et Google Play),
   - `MEDILINK_EAS_PROJECT_ID` : UUID du projet EAS réel,
   - `MEDILINK_GOOGLE_SERVICES_FILE` : variable EAS **file**,
   - `EXPO_PUBLIC_API_BASE_URL` : URL HTTPS réelle du backend,
   - `MEDILINK_BRANDING_APPROVED=true` **uniquement après intégration des assets officiels**,
   - `MEDILINK_VERSION_CODE_APPROVED=true` après vérification du Play Console.
   Utiliser `eas env:create` / la console Expo pour les trois environnements ; ne jamais imprimer ou exporter les données Firebase dans des logs publics. Le `google-services.json` Android est un fichier de configuration Firebase côté client, **pas une clé de service Admin**, mais il doit rester hors Git conformément au dispositif de distribution.
4. Confirmer le projet EAS (`eas project:info`), créer et **protéger** une clé de signature Android dans `eas credentials -p android`. Ne jamais intégrer un keystore, ses mots de passe, ni un certificat privé au dépôt. Enregistrer les empreintes SHA-1 et SHA-256 dans Firebase si des fournisseurs de connexion les exigent, sans exposer la clé privée.
5. Dans l'environnement préparé, exécuter `npm run release:validate:strict` (le script vérifie aussi que `google-services.json` contient le package attendu ; n'affiche ni contenu ni identifiants).
6. Lancer les builds EAS :
```sh
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production
```
Pour la CI non interactive, préconfigurer projet/keystore/EAS_TOKEN ; utiliser `--non-interactive` uniquement après la première configuration des credentials. Pour établir une version candidate à installer : **l'APK `preview`**. Pour la distribution Google Play : **l'AAB `production`**, qui **ne s'installe pas directement** sur Android.
7. Vérifier les builds :
```sh
eas build:list --platform android --limit 10
eas build:view --id <ID_REEL_DU_BUILD>
eas build:download --id <ID_REEL_DU_BUILD>
```
Ne fournir un lien d'APK/AAB que si le build EAS est marqué **finished/success**, possède un `artifactUrl` réel et que le fichier téléchargé existe. Conserver build ID, commit SHA, profile, versionCode, signature de fichier SHA-256 et résultat d'installation dans le dossier de recette.

## Installation APK de test

- Depuis l'URL de **l'APK preview effectivement généré** : téléchargement sur téléphone Android, installation via le mécanisme Android autorisé par l'utilisateur (source de confiance, sans désactiver Play Protect), lancer Medilink, vérifier l'URL API et login avec **compte de test**, puis tester flux.
- Sur poste disposant du SDK Android : `adb install -r chemin/vers/medilink-preview.apk` seulement si le fichier existe vraiment ; si la signature diffère d'une version installée, désinstaller l'ancienne version de test après sauvegarde de données appropriée.
- Les notifications FCM exigent une build Android réelle dotée du bon `google-services.json` et d'une permission utilisateur ; Expo Go ne permet pas de les valider.

## Blocages constatés dans l'environnement de cette session

- **Aucun accès Expo/EAS Build/keystore Firebase/GCP validé** ; l'existence du projet EAS, sa propriété, ses quotas et ses credentials de signature n'ont pas été vérifiés.
- Identifiant Android définitivement approuvé et `google-services.json` Android réel **non fournis**.
- Ressources d'icône, splash, logo Android encore partiellement des assets starter Expo ; validation de marque non effectuée.
- Pages légales mobiles provisoires ; recette médicale et revue du backend nécessaires.
- **Aucun APK signé ou AAB créé ou téléchargé** ; aucun `artifactUrl` et aucun hash binaire à communiquer.
- Aucun build natif `prebuild` / Gradle ni test instrumenté sur un appareil Android dans cette session.

Conclusion : **les profils et le précontrôle sont prêts, la release n'est pas autorisée**. Confirmer d'abord les paramètres, le branding et les comptes EAS, puis produire et vérifier l'APK de recette.
