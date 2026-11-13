# Prompt 07 — Session Android sécurisée

## Contrats vérifiés

Sources : `medilink-api/src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `medilink/services/http.ts` et `medilink-mobile/src/services/auth.ts`.

- **POST /auth/refresh** : `{refreshToken: string}` ; réponse **AuthSession complète** : `{ user, idToken, refreshToken, expiresIn, tokenType: 'Bearer' }`. Le refresh valide le token Firebase et le statut utilisateur, et peut faire tourner le refresh token.
- **GET /auth/profile** : bearer idToken ; réponse `{user, patient}` ; la session vérifie que l'identité correspond au titulaire des tokens et que le rôle est permis.
- **POST /auth/logout** : bearer idToken ; renvoie `{message: 'Firebase sessions revoked'}`. Le serveur appelle `revokeRefreshTokens(uid)`. La suppression locale doit se produire même lorsque le réseau est indisponible.

## Stockage sécurisé

- Bibliothèque : `expo-secure-store@~58.0.3`, recommandée dans la [documentation Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/).
- Stockage natif chiffré via Android Keystore / iOS Keychain, clé `medilink.session.v1`, service `medilink-auth`. Pas de stockage en clair, AsyncStorage, URL, journal ni état Zustand pour les tokens.
- Valeurs enregistrées : `idToken`, `refreshToken`, `userId`, expiration absolue `expiresAt`. L'objet n'est jamais exposé à l'interface.
- Le plugin `expo-secure-store` est ajouté à `app.json` avec configuration Android Auto Backup, afin d'exclure les clés chiffrées des sauvegardes restaurées sans clé.
- Aucun fallback non sécurisé : une erreur SecureStore empêche l'authentification. Sur le web, le stockage natif n'est pas disponible ; cible de ce lot : Android.

## Cycle de vie et sécurité des conflits

1. **Démarrage** : navigation initialisée en `loading`, lecture de SecureStore, refresh serveur systématique et contrôle de profil avant d'ouvrir une route protégée. Absence ou refus de session → écran invité.
2. **Connexion** : vérification via `GET /auth/profile` avec le bearer issu du login. Écriture dans SecureStore **avant** activation de la navigation. Aucune restauration d'ancien rôle depuis un paramètre ou une donnée non vérifiée.
3. **Expiration** : avant une requête authentifiée, si expiration dans 60 secondes ou moins, renouvellement des identifiants. Un 401 inattendu déclenche un refresh et **une unique relance** avec le nouveau token.
4. **Single-flight** : toutes les requêtes concurrentes rejoignent la même promesse de refresh. Les refresh tokens tournants sont persistés avant d'être utilisés.
5. **Generation fence** : chaque connexion, déconnexion et invalidation change la génération du compte. Une ancienne requête ne peut plus remplacer un token nouvellement établi ni relancer une demande sous une nouvelle identité.
6. **Déconnexion** : purge locale immédiate, retour aux routes invité, demande de révocation côté serveur best-effort et sans bloquer la suppression locale. Il n'existe pas encore de cache persistant de documents médicaux. Les prochains modules doivent se brancher sur le hook `purge` lors d'un changement de compte.
7. **Erreurs de refresh** : en cas d'échec, invalider les identifiants et exiger une reconnexion plutôt que de conserver une session non fiable. Les services backend restent responsables de l'autorisation.

## Fichiers

- `src/features/auth/secure-storage.ts` : adaptateur Expo SecureStore.
- `src/features/auth/session-manager.ts` : gestionnaire testable, transactions de stockage ordonnées, générations et single-flight.
- `src/features/auth/session.ts` : intégration HTTP et navigation.
- `src/services/http-client.ts` et `src/services/http.ts` : refresh sur 401 + rejeu limité, contrôle de génération.
- `src/app/_layout.tsx`, `src/store/navigation-session.ts` : attente et restauration au démarrage.
- `src/components/auth/logout-button.tsx` : déconnexion accessible depuis patient, médecin et admin.

## Vérifications à exécuter

```sh
npm ci
npm run test:session
npm run test:http
npm run test:auth
npm run typecheck
npm run lint
npx expo-doctor
```

La suite `src/features/auth/session-manager.test.mjs` couvre : login validé, profil incohérent, restauration, token révoqué, 401 simultanés, refresh tardif après changement de compte, déconnexion et déconnexion hors ligne, échec SecureStore, expiration et purge. `http-client.test.mjs` couvre un seul rejeu 401 et refus de rejouer après changement de session.

**État actuel** : code et tests publiés, mais aucune installation npm ni exécution sur appareil possible dans l'environnement de cette conversation (DNS npm inaccessible). La PR doit être validée par un runner GitHub Actions ou un émulateur Android connecté avant fusion. Le verrou npm a été synchronisé avec la dépendance SecureStore ; vérifier sa résolution réelle avec `npm ci`.

La revue visuelle du site https://medilink-nu-ten.vercel.app/ reste obligatoire **avant toute nouvelle page métier**, mais ce prompt concerne le moteur de session et non un nouvel écran médical.
