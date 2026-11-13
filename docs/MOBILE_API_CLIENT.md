# Client API mobile — Prompt 05

## Sources vérifiées le 13 novembre 2026

Frontend : `routes/*.ts`, `services/*.ts`, particulièrement `services/http.ts`, `services/auth-service.ts`, `doctor-service.ts`, `appointment-service.ts`, `availability-service.ts`, `need-service.ts`, `message-service.ts`, `notification-service.ts`, `admin-service.ts`, `integration-service.ts`, `patient-document-service.ts`. Backend : contrôleurs NestJS de `auth`, `appointments`, `availabilities`, `doctors`, `needs`, `patients`, `messages`, `notifications`, `admin`, `integration`. Les types sont fondés sur les formes existantes du web et les signatures des contrôleurs. Les signatures de services NestJS constituent le contrat à confirmer pour les cas limites de chaque parcours.

## Structure

- `src/services/http-client.ts` : transport HTTP pur, injectable/testable, `createHttpClient`, `HttpError`, `makeMultipart`.
- `src/services/http.ts` : instance d'application initialisée à la première requête, crochet `configureHttpAuth` à brancher à l'auth réelle aux prompts 06–07, `resetHttpAuth`.
- `src/services/config.ts` : `EXPO_PUBLIC_API_BASE_URL` requise, URL HTTPS en production, HTTP toléré seulement en mode développement.
- `src/types/domain.ts` : types métier centraux réutilisés.
- `src/services/{auth,doctors,patients,needs,appointments,availabilities,messages,notifications,admin,integration}.ts` : méthodes typées par domaine; aucune donnée factice.
- `src/services/http-client.test.mjs` : suite unitaire Node `node:test` sur transport pur (sans API réelle).
- `package.json` : `npm run test:http`, également intégré à `npm run check`.

## Contrats transport

```ts
import { appointmentsApi } from '@/services/appointments';
import { HttpError } from '@/services/http';

try {
  const appointments = await appointmentsApi.list(abortController.signal);
} catch (error) {
  if (error instanceof HttpError) {
    // error.kind, error.status, error.message, error.details
  }
}
```

Le client utilise un délai par défaut de 15 s, modifiable par requête, et un `AbortController` fusionnant timeout et signal d'appel. Les erreurs 401, 403, 404, 409, 422, 500 ont un `kind` distinct. `network`, `timeout`, `cancelled` et `invalid_response` sont séparés. Les réponses 204 renvoient `undefined`. Les erreurs NestJS `message` (string ou array), `error` et `statusCode` sont conservées dans `details`. Ne jamais logger directement `details` en production : cela peut contenir des informations sensibles.

Envoi JSON seulement si `body` est présent ; `multipart/form-data` sans ajouter manuellement `Content-Type` ou boundary ; `NativeUploadFile = {uri, name, type}` (React Native). Les limites fichiers sont imposées par l'API, et **pas** uniquement côté UI.

### Authentification : intégration différée

`configureHttpAuth({ getAccessToken, onUnauthorized })` est prévu pour le stockage sécurisé et la stratégie de rafraîchissement des tokens des prompts 06–07. Il n'existe **pas** de session simulée, pas de token en dur, pas de redirection navigateur. Une erreur 401 est structurée et le callback peut réagir ; le refresh single-flight/replay contrôlé reste à intégrer au prompt 07. Les gardes NestJS demeurent l'unique source d'autorisation.

### Réseau par environnement

| Environnement | Exemple de `.env.local` **en développement uniquement** |
| --- | --- |
| Émulateur Android standard | `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000` |
| Téléphone Android sur même Wi-Fi | `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000` (remplacer par l'IPv4 réelle du PC) |
| Développement sur API publique | `EXPO_PUBLIC_API_BASE_URL=https://api.example.com` (remplacer par l'URL réelle du backend) |
| Production / distribution | `EXPO_PUBLIC_API_BASE_URL=https://<domaine-api-réel>` |

L'URL du **site web** https://medilink-nu-ten.vercel.app/ est une référence **responsive UI**, pas nécessairement l'URL du backend. Ne jamais l'utiliser comme API sans confirmation. L'émulateur Android utilise `10.0.2.2` pour joindre le serveur de la machine hôte; le serveur NestJS doit écouter une interface accessible et le pare-feu doit permettre la connexion. Sur un appareil physique, utiliser le LAN ou une API HTTPS accessible, jamais `localhost`. L'URL Expo publique est intégrée au binaire : aucun secret, mot de passe ni token. La navigation WebView, la gestion des cookies navigateur et le stockage web ne sont pas copiés.

Android peut refuser HTTP non chiffré suivant le manifeste/configuration réseau. Préférer HTTPS même en développement, ou configurer explicitement un build de développement; **ne jamais** désactiver globalement la sécurité HTTP en production. Recompiler/redémarrer Expo après modification des variables.

## Écarts vérifiés et décisions

1. `/auth/admin/profile` PATCH existe dans le backend actuel : client inclus.
2. `/availabilities/me/modes` GET/PUT et `/availabilities/me/duration` GET/PATCH sont présents dans le contrôleur actuel : inclus.
3. `GET /doctors` est couvert par `FirebaseAuthGuard`, même pour les pages web qui peuvent paraître publiques : les appels mobiles devront avoir un jeton validé.
4. `/appointments` POST exige `doctorId, scheduledAt, timeZone, consultationMode`; ne calculer aucune règle de réservation localement à la place du backend.
5. `/needs` POST utilise un champ multipart `data` JSON et des champs `files` ; documents patients/médecins utilisent `file` + `type`.
6. Les notifications exigent la confirmation du format de token push avant une intégration native (Expo push != FCM automatiquement).
7. Les résultats JSON sont **typés statiquement**, non validés par schéma runtime. Ajouter des gardes/parsers si le backend change ou si des données externes non fiables entrent dans une vue sensible.
8. L'API a été inspectée statiquement : aucune requête authentifiée de test ni mutation de données médicales n'a été faite.

## Tests

```sh
npm ci
npm run test:http
npm run typecheck
npm run lint
npm run doctor
```

La suite couvre sérialisation JSON, query encodée, bearer/public, codes 401/403/404/409/422/500, erreurs NestJS structurées, callback 401, 204, JSON invalide, upload multipart React Native simulé, annulation précoce/en vol, timeout, erreurs réseau, chemins non relatifs.

**Statut : tests écrits et publiés, mais non exécutés dans cette session.** Le conteneur local n'a pas accès à GitHub/npm; l'installation des dépendances et l'exécution sur le checkout de la branche doivent être faites sur un runner connecté. Aucun succès de test, typecheck, lint ou Android n'est revendiqué.

## Revue UX et branche unique

Avant toute page métier, étudier https://medilink-nu-ten.vercel.app/ en responsive 360/390/430px avec le compte de rôle approprié; cela n'a pas été possible dans l'environnement actuel. Garder tous les prompts sur `docs/mobile-audit-parity-2026-11-13` dans la **PR #1** jusqu'à la fin du projet.
