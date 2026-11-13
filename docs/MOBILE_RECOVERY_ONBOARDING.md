# Prompt 08 — Récupération et onboarding Android

## Sources du contrat (13 novembre 2026)

- Backend : `medilink-api/src/auth/auth.service.ts` et `auth.controller.ts`.
- Web : `medilink/app/(puclic)/login/page.tsx`, `register/page.tsx`, `app/(puclic)/page.tsx`, `services/auth-service.ts`.
- Référence responsive obligatoire : https://medilink-nu-ten.vercel.app/. La consultation visuelle interactive en 360, 390 et 430 px n'a pas pu être confirmée dans cet environnement ; la structure découle du code web lu.

## Mot de passe oublié

`POST /auth/reset-password` reçoit uniquement `{ email: string }`, sans bearer et sans code OTP/SMS. Le backend :
1. Vérifie un e-mail non vide et le normalise en minuscules.
2. Demande l'envoi Firebase `accounts:sendOobCode` avec `requestType: PASSWORD_RESET`.
3. Retourne `{ message: 'If this account exists, a password reset email has been sent.' }`.

L'application transmet une adresse valide et affiche toujours une confirmation neutre après réussite. Les statuts 400/401/403/404/409/422 ne permettent pas de distinguer un compte existant d'un compte inconnu. Les erreurs réseau/serveur peuvent être présentées de manière générique, sans copier une erreur brute. L'app ne présente **aucun écran de code SMS/OTP**, ni changement de mot de passe local : l'e-mail Firebase est la seule fonctionnalité implémentée. Le formulaire empêche les doubles soumissions et annule la requête lorsque l'écran est fermé.

## Onboarding et identité

`src/app/index.tsx` affiche une courte introduction :
- Trouver un médecin ;
- Décrire son besoin médical ;
- Organiser son rendez-vous.

Les CTA mènent à `/login` et `/choose-role`, et une aide est accessible. La navigation conserve un écran de chargement pendant `restoreSession()` et redirige ensuite vers `/patient`, `/medecin` ou `/admin` en fonction du rôle **revalidé par l'API**, jamais un rôle indiqué dans l'URL.

## Comptes et accès restreints

D'après `assertAccountCanSignIn` : `suspended` et `deleted` sont refusés par le backend avec HTTP 403, sans indiquer lequel. Un médecin `pending` peut se connecter mais sa vérification professionnelle n'est **pas** acquise.

- Un 403 de connexion qui mentionne explicitement l'e-mail non vérifié conduit à `/account-status?issue=verification` : instructions de consultation de l'e-mail reçu à l'inscription, sans prétendre réexpédier l'e-mail.
- Un autre 403 conduit à `/account-status?issue=restricted` : message neutre et accès à l'assistance, **sans révéler si le compte est suspendu ou supprimé**.
- `/unauthorized` et `/account-status` sont des pages d'information, non des autorisations. Le backend et `Stack.Protected` restent responsables des accès.
- Le statut `pending` issu de la session revalidée est conservé dans l'état de navigation **sans aucun token** et une notice est affichée dans l'espace médecin, sans inventer une validation administrative.
- Une inscription réussie affiche déjà l'écran de confirmation de l'e-mail (prompt 06).
- Les codes 401 pour identifiants incorrects restent génériques. Pas d'identité, de jeton ou de mot de passe dans une URL ou une erreur publique.

## Fichiers

- `src/app/(auth)/forgot-password.tsx` : récupération native.
- `src/features/auth/account-states.ts` : validation et messages sûrs, classification des refus.
- `src/app/account-status.tsx` : page de vérification et accès restreint.
- `src/components/auth/pending-account-notice.tsx` : note médecin en attente.
- `src/app/index.tsx` : introduction publique et redirection de session.
- `src/app/(auth)/login.tsx` : redirection explicite sur les refus 403.
- `src/features/auth/session-manager.ts`, `src/store/navigation-session.ts` : statut backend de la session authentifiée, redirection toujours basée sur le rôle confirmé.
- `src/features/auth/account-states.test.mjs` : confidentialité des réponses et états d'accès.

## Recette

```sh
npm ci
npm run test:onboarding
npm run test:auth
npm run test:session
npm run test:http
npm run typecheck
npm run lint
npm run doctor
```

- [ ] Récupération e-mail valide / inconnu : même message neutre.
- [ ] E-mail mal formé : validation locale, aucune requête.
- [ ] Réseau indisponible : erreur générique sans détails de compte.
- [ ] Double clic / départ de l'écran : pas de doublon.
- [ ] 403 e-mail non vérifié : écran d'explication.
- [ ] 403 compte restreint : message générique, aucun détail sensible.
- [ ] Doctor `pending` authentifié : notice, droits toujours contrôlés par API.
- [ ] Session patient/médecin/admin active : redirection vers l'espace correspondant.
- [ ] Routes réservées à un autre rôle : refus sans boucle.
- [ ] Clavier, lecture vocale, grande police, tailles 360/390/430 px.

**État de preuve :** fichiers et tests publiés dans la PR unique, mais npm/Expo/Android, tests avec comptes réels et inspection interactive du Vercel restent à exécuter. Ne pas confondre livraison du code et validation E2E.
