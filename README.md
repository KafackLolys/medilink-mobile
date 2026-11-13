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

Continuer **tous les prompts** dans `docs/mobile-audit-parity-2026-11-13` et conserver la [Pull Request #1](https://github.com/KafackLolys/medilink-mobile/pull/1) comme PR de référence jusqu'à la fin du projet. Ne pas fusionner prématurément.

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
