# Prompt 25 — Résilience réseau mobile, annulation et cache restreint

## Audit initial

Sources auditées : `src/services/http-client.ts`, `http.ts`, `src/features/auth/session-manager.ts`, `src/features/auth/session.ts`, services de rendez-vous, besoins, documents, messagerie, notifications et annuaire, ainsi que les écrans utilisant `AbortController` et `RefreshControl`.

### Protections existantes conservées

- Session Firebase avec tokens dans **Expo SecureStore uniquement**, jamais dans AsyncStorage, Zustand, URL ni logs.
- Client HTTP : timeout configurable (15 secondes par tentative), `AbortController`, erreur typée `network/timeout/cancelled`, validation des chemins et contrôle de génération de session.
- Renouvellement **single-flight** du token Firebase en cas de 401 ; les requêtes GET peuvent être reprises une fois avec un nouveau token lorsque le compte n'a pas changé.
- Pull-to-refresh, états vides/erreurs et annulation à la sortie déjà présents sur la plupart des écrans médicaux.
- Absence de stockage durable des dossiers médicaux, conversations, rendez-vous ou documents.

## Fonctionnalités ajoutées

### 1. État de connectivité sans permission supplémentaire intrusive

`expo-network@~58.0.5` est compatible avec **Expo SDK 58**. `src/features/network/connectivity-banner.tsx` exploite `useNetworkState()` et affiche une bannière globale pour :
- **offline** : connexion appareil absente ou Internet explicitement non accessible ;
- **limited** : appareil connecté, mais accessibilité Internet non confirmée ;
- **online/unknown** : pas de bannière intrusive.

Cette information porte sur le réseau du téléphone et **ne garantit pas** que l'API Medilink répond. Aucun SSID WiFi, GPS, adresse IP, permission de localisation ni suivi permanent n'est recueilli. Les permissions Android de statut du réseau sont gérées par Expo.

### 2. Retry HTTP strictement opt-in pour des lectures sûres

Le client `createHttpClient` accepte `retryPolicy:'safe-get'`, **désactivé par défaut**.

- Maximum **3 tentatives** (initiale + deux retries), délais d'attente **300 ms** et **900 ms**, en plus du timeout par requête.
- Éligible : GET explicitement opt-in et erreurs `network`, `timeout`, HTTP **429/502/503/504**.
- Non éligible : 400, 401, 403, 404, 409, 422, 500, réponse JSON invalide, annulation, mutation ou changement de session.
- Seuls `GET /doctors` et `GET /doctors/:id` l'activent aujourd'hui. `GET /messages/conversations/:id`, par exemple, marque les messages comme lus : **il ne bénéficie d'aucun retry automatique**.
- Le délai de backoff est interrompu immédiatement en cas d'abort ; contrôle du `sessionKey` **avant chaque tentative**, pour ne jamais rejouer un ancien GET sous un nouveau compte.
- Un retry `safe-get` sur POST/PUT/PATCH/DELETE est refusé **avant l'envoi**.
- Sur toute mutation, **même après HTTP 401**, le client ne répète pas la requête ; l'utilisateur doit confirmer son état via une lecture serveur et relancer explicitement l'action si elle n'a pas été exécutée. Les réponses réseau incertaines ne déclenchent aucune relecture automatique suivie d'un nouveau POST.

**Aucun retry automatique** de création de besoin, réservation de créneau, avis, envoi de message, paiement, transfert multipart, suppression ou mutation admin. Une clé d'idempotence garantie par le backend serait nécessaire pour envisager certaines de ces répétitions.

### 3. Cache très limité aux données publiques de l'annuaire

`src/features/network/public-directory-cache.ts` :
- cache **en mémoire RAM uniquement**, jamais en stockage persistant ;
- maximum **12 recherches distinctes**, durée de vie **5 minutes**, keyed uniquement par les filtres publics `q/specialty/city` ;
- stockage d'un **sous-ensemble explicite** de champs publics vérifiés des médecins et des spécialités — pas de propriété serveur arbitraire ;
- exclut les dossiers patients, adresses privées de patients, identité de session, images médicales, documents, chat, réservations, tokens Firebase/FCM et comptes admin ;
- cache consulté seulement pour un **patient actuellement autorisé**, après un échec `network` ou `timeout` de `GET /doctors`, **jamais en cas de 401/403 ou erreur serveur** ;
- affiche la liste comme **« enregistrée temporairement — potentiellement ancienne »**, sans prétendre que les créneaux, tarifs ou statuts sont toujours à jour ;
- cache invalidé à chaque remplacement de session, login/logout par `SessionManager.hooks.purge`.

Ce mode dégradé sert uniquement à explorer les fiches professionnelles publiques. Les réservations et données médicales exigent la confirmation **en ligne par le backend**.

### 4. Reprise de connexion et rafraîchissement

Lorsque le réseau passe explicitement de `offline` à `online`, l'annuaire recharge automatiquement **sa lecture sans effet de bord**. Les autres écrans conservent le pull-to-refresh et les actions de relance explicites. Aucune mutation en attente n'est mise en queue ou rejouée automatiquement.

Le dernier état du répertoire est nettoyé à la navigation conformément à la logique de session existante. Les requêtes réseau ne se poursuivent pas après `AbortController.abort()` ou un changement de compte.

## Fichiers principaux

- `src/services/http-client.ts` : retry optionnel, borné, annulable et conscient de la génération de session ; aucune réexécution automatique des écritures en cas de 401.
- `src/services/doctors.ts` : opt-in explicite pour les deux lectures de répertoire.
- `src/features/network/network-policy.ts` : politique pure de tentatives, délais, connectivité et confidentialité.
- `src/features/network/connectivity-banner.tsx` : indicateur global.
- `src/features/network/public-directory-cache.ts` : cache mémoire restreint.
- `src/app/patient/(tabs)/medecins.tsx` : mode de repli hors connexion étiqueté, rafraîchissement au retour du réseau.
- `src/features/auth/session.ts` : purge du cache à tout changement d'identité.
- `src/features/network/network-policy.test.mjs` et `src/services/http-client.test.mjs` : cas d'échec/reprise, non-répétition de mutations, annulation, confidentialité du cache.

## Tests

Exécuter :

```sh
npm ci
npm run typecheck
npm run test:http
npm run test:network
npm run check
npm run lint
npm run doctor
```

GitHub Actions vérifie `npm ci`, TypeScript et les tests des prompts 1–25 dont `test:network` ; `npm run check` inclut lint en plus, mais le workflow actuel ne lance pas `npm run lint`.

Scénarios automatisés :
- coupures réseau répétées sur un GET explicitement autorisé, suivi d'une reprise réussie ;
- 429/502–504 transitoires, puis succès ou épuisement de 3 tentatives ;
- HTTP 400/401/403/404/409/422/500 sans retry ;
- aucun retry POST, PATCH, PUT, DELETE, en particulier réservations et demandes médicales, y compris après 401 ;
- interruption pendant backoff et changement de génération de session ;
- état offline / limited / online / unknown ;
- cache public en RAM uniquement, TTL 5 min, changement de filtre/compte, exclusion de champs privés, purge ;
- aucune lecture médicale privée depuis le cache.

## Recette sur téléphone Android indispensable avant fusion

- [ ] Installer une build Android compatible SDK 58 avec `expo-network`.
- [ ] Couper WiFi et données mobiles : vérifier l'affichage hors connexion.
- [ ] Simuler un réseau connecté sans accès Internet : vérifier l'état limité/hors connexion.
- [ ] Ouvrir l'annuaire, couper les données après un succès, actualiser : vérifier affichage cache explicitement ancien (pendant moins de 5 minutes), puis erreur après expiration.
- [ ] Reconnecter : l'annuaire se recharge depuis le serveur, sans relancer de réservation ni de publication.
- [ ] Vérifier l'annulation des requêtes à la sortie d'écran et les délais cumulés sur une connexion lente.
- [ ] Lancer une réservation / création de besoin et couper le réseau : confirmer **aucun double POST** et vérifier l'état réel au rechargement.
- [ ] Changer de compte pendant un retry ou un cache affiché : aucune réapparition de données du compte précédent.
- [ ] Tester perte de session Firebase, 401/403 et refus d'accès sans cache, ni retry interdit.
- [ ] Tester les différentes politiques d'économie de batterie Android, grands caractères et TalkBack.
- [ ] Exécuter lint, Expo Doctor et comparaison visuelle web/Android.

**Limites :** les tests GitHub Actions sont des tests unitaires et de contrats réseau simulés ; aucun test instrumenté de coupure radio sur téléphone n'a été réalisé dans cette session. `expo-network` donne une connectivité indicative et ne constitue pas un contrôle de disponibilité de l'API.
