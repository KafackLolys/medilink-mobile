# MediLink Android — Google Sign-In, session durable et parité visuelle

**Proposition de changement du 15 novembre 2026** — branche `feat/mobile-google-auth-web-parity-20261115`.

## Références fonctionnelles

Cette amélioration se fonde sur les six captures responsive transmises par le propriétaire :
- accueil public, connexion et sélection de profil/inscription ;
- annuaire médecin côté patient ;
- tableau de bord du médecin ;
- gestion des comptes côté administration.

La web app utilise `services/google-auth.ts` et l'API propose déjà les routes
`POST /auth/google/status` et `POST /auth/google/complete`. La logique métier
n'est **pas** dupliquée sur mobile.

## Flux Google natif

1. Une pression sur « Continuer avec Google » ouvre le sélecteur natif Google
   via `@react-native-google-signin/google-signin`. L'utilisateur peut annuler.
2. L'ID token Google est échangé via **Firebase Identity Toolkit**
   `accounts:signInWithIdp` avec le `Web API Key` public du projet Firebase.
   Le résultat est un **Firebase ID token** (`sign_in_provider=google.com`),
   un refresh token Firebase et le même UID Firebase que l'API.
3. `POST /auth/google/status` vérifie l'identité et indique si le compte MediLink existe.
4. Compte existant : `SessionManager.login()` vérifie `GET /auth/profile`,
   chiffre et conserve les jetons via `expo-secure-store`, ouvre le rôle serveur
   `patient`, `doctor` ou `admin`.
5. Nouveau compte : la session de pré-inscription reste temporairement **en mémoire**,
   puis l'utilisateur choisit **Patient** ou **Médecin** et envoie
   `POST /auth/google/complete`. L'API interdit la création d'un admin par ce flux.
   Après validation du profil, la session est persistée par `SessionManager`.
6. Une annulation ou une expiration n'ouvre aucun espace privé. L'ID token,
   le refresh token et l'UID ne circulent jamais dans les routes ou les logs.

Ce flux n'utilise ni `signInWithPopup` (web uniquement), ni un WebView de connexion.
Le Google Sign-In natif **ne fonctionne pas dans Expo Go** : utiliser une version
Android compilée avec le module natif (development build / EAS).

## Configuration Android / Firebase / EAS

Configurer les valeurs publiques suivantes dans le profil EAS de build ciblé :

```env
EXPO_PUBLIC_API_BASE_URL=https://medilink-api-lilac.vercel.app
EXPO_PUBLIC_FIREBASE_WEB_API_KEY=<web-api-key-du-projet-Firebase>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client-oauth-de-type-Web>.apps.googleusercontent.com
```

**Attention :** ne pas mettre d'identifiants secrets, clé Firebase Admin,
clé privée, mot de passe, certificat ou refresh token dans `EXPO_PUBLIC_*`.
La clé Web Firebase et le client ID OAuth sont des identifiants publics de
configuration, **mais restent soumis aux restrictions et quotas du projet**.

Vérifier avant le build :
- le projet Firebase est le même côté API, client Google et configuration Android
  (`google-services.json` de référence : `medilink-2027`) ;
- le package Android correspond bien au client Android Firebase
  (`com.lolys.medilink` pour le fichier de configuration observé) ;
- le client OAuth **Web** est utilisé pour `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  distinct du client OAuth Android ;
- les SHA-1 (et SHA-256 lorsque demandées) de **toutes les signatures APK concernées**
  sont enregistrées dans les empreintes de l'application Android Firebase /
  les identifiants OAuth Google : debug, EAS preview et Play App Signing ;
- Google est activé dans Firebase Authentication → Méthodes de connexion ;
- `MEDILINK_ANDROID_PACKAGE`, `MEDILINK_GOOGLE_SERVICES_FILE`,
  `MEDILINK_EAS_PROJECT_ID` et `EXPO_PUBLIC_API_BASE_URL` satisfont
  `app.config.js` sur le profil EAS utilisé ;
- `@react-native-google-signin/google-signin` est présent dans `package.json`,
  `package-lock.json` et les plugins de `app.json` ;
- reconstruire l'application native après installation de la dépendance ;
  un simple hot reload n'installe pas de code natif.

Le login Google Android **ne dépend pas** de la liste Firebase Authentication
« Domaines autorisés » utilisée par le popup web. En revanche, les identifiants
OAuth et les empreintes de signature doivent correspondre aux applications
réelles. Le web en production conserve sa propre configuration de domaine.

## Session persistante, y compris lors d'une panne réseau

- Le `SessionManager` existant sauvegarde ID token + refresh token
  dans `expo-secure-store`, pas `AsyncStorage` ni Zustand.
- Au démarrage, `bootstrap()` rafraîchit la session et revalide le profil
  côté API avant l'ouverture de tout écran métier.
- En cas de panne transitoire réseau ou HTTP 5xx au démarrage, les identifiants
  enregistrés **ne sont pas supprimés**. L'application reste sur une page
  « Connexion à vérifier » avec bouton de nouvelle tentative.
- Une authentification révoquée, suspendue, supprimée ou invalide nettoie la
  session et redirige vers l'espace public.
- La déconnexion efface l'accès local même hors ligne, puis tente la révocation
  serveur et déconnecte l'état Google natif.
- **Pas d'accès médical hors ligne** ni d'affichage de données personnelles
  non revalidées : la persistance n'implique pas de contourner la sécurité.

## Parité des écrans dans ce lot

| Écran | Modifications | Réserve |
| --- | --- | --- |
| Accueil public | Composition responsive hero, spécialités, trois étapes, CTA, garde de session | L'annuaire réel reste après connexion ; aucune fiche fictive |
| Connexion | Marque Medihome, bouton Google, séparateur, e-mail, mot de passe | Google requiert build natif et config OAuth |
| Inscription | Étape 1 sélection patient/médecin, étape 2 formulaire, pré-inscription Google | Aucun admin public |
| Tableau médecin | En-tête, cartes KPI empilées, actions pleine largeur, contenu API conservé | Vérification professionnelle serveur obligatoire |
| Annuaire patient | En-tête Medihome, recherche réelle, profil et prise de RDV directs | Pas de carte GPS ni de faux créneaux API |
| Espace patient | En-tête et cartes activité empilées, données réelles | Les autres écrans métier restent à comparer en appareil |
| Administration | En-tête, comptes existants, création admin avec double confirmation | Administrateur actif seulement, via AdminGuard serveur |

**Éléments différés** : données GPS géocodées, créneaux publics temps réel si
l'API n'en expose pas, pages d'aide/contact/politique si encore placeholders,
test automatique E2E Android, validation réelle des documents, tests d'écran
TalkBack, branding officiel Medihome/MediLink à confirmer pour l'icône.

## Tests nécessaires avant fusion / publication

```bash
npm ci
npm run typecheck
npm run lint
npm run test:session
npm run check
npm run release:validate
```

**Recette physique Android** :
1. Authentification patient et médecin avec email/mot de passe, redémarrage de
   l'application, restauration, déconnexion et tentative de retour arrière.
2. Google existant patient, médecin et administrateur ; Google inconnu puis
   inscription patient/médecin ; annulation du sélecteur ; compte Google de
   provenance non autorisée ; refus admin public.
3. Rotation du token, expiration et révocation ; compte suspendu ; déconnexion
   hors connexion ; démarrage hors connexion, conservation du refresh token,
   retour en ligne puis réauthentification automatique ou via « Réessayer ».
4. Comparaison avec les captures sur écrans 360/390/430 dp : clavier,
   textes longs, barre d'onglets native, encoche, petits appareils,
   contraste et grands caractères.
5. Administration : recherche comptes, vérification, création admin valide,
   doublon, mot de passe faible, perte de réseau après POST sans double création.
6. Parcours complet besoin → proposition médecin → sélection → rendez-vous →
   messagerie, ainsi que les documents et consentements.

**Statut de preuve** : la revue de code seule ne démontre pas le bon
fonctionnement sur un téléphone. En l'absence de builds EAS signés/configurés,
de comptes de test et de preuves des jobs CI, ce lot doit rester une **PR de
validation** et non une release déclarée prête.
