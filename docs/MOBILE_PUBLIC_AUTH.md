# Prompt 06 — Authentification publique Android

## Références et contrats vérifiés (2026-11-13)

- Web : `app/(puclic)/login/page.tsx`, `app/(puclic)/register/page.tsx`, `components/custum/{auth-shell,field,button}.tsx`, `services/auth-service.ts`.
- Backend : `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`.
- Site responsive prévu avant les pages : https://medilink-nu-ten.vercel.app/ ; tentative d'ouverture refusée par l'outil web (DisabledError). La parité visuelle réelle à 360/390/430 px **n'a pas été vérifiée** ; les écrans sont basés sur le code web, à valider visuellement.

### POST /auth/register

Corps : `{firstName,lastName,email,password,phone,role,specialty?,registrationNumber?}`.

- `role` admis côté NestJS : **patient** ou **doctor** uniquement. Aucun choix `admin` dans le formulaire public.
- `firstName`, `lastName`, `phone`, `email` sont des chaînes non vides après trim; e-mail converti en minuscules.
- Mot de passe : au moins **8 caractères** côté API. Le formulaire reproduit également le contrôle de robustesse plus strict du web (longueur, mélange de casse, chiffre ou symbole).
- `specialty` et `registrationNumber` sont facultatifs côté backend en tant que types, mais **obligatoires dans le formulaire médecin web et mobile**.
- Inscription médecin : compte initialement `pending`, profil professionnel non vérifié.
- Inscription patient : compte initialement `active`.
- Le backend crée le compte Firebase/Firestore et demande l'envoi d'un e-mail de confirmation, puis renvoie une session (utilisateur + tokens). L'app **n'utilise pas ces tokens après inscription** et affiche la confirmation e-mail, comme le web. Ne jamais exposer les tokens dans une URL ou un log.

### POST /auth/login

Corps : `{email,password}`. Le backend vérifie des champs présents, contacte Firebase Identity, **refuse une adresse e-mail non vérifiée (403)**, refuse un compte suspendu ou supprimé et renvoie une session `{user,idToken,refreshToken,expiresIn,tokenType}`.

Le mobile contrôle la syntaxe e-mail, l'absence de mot de passe, affiche les erreurs 401/403/409/422, réseau, délai et serveur. Après réponse de login, le token reste **uniquement en mémoire** et une requête authentifiée `GET /auth/profile` vérifie l'identité/le rôle retourné avant que la navigation ouvre `/patient`, `/medecin` ou `/admin`. L'administration ne s'inscrit jamais par le formulaire public mais peut se connecter via `/auth/login`.

## Fichiers implémentés

- `src/features/auth/validation.ts` : validation et messages d'erreur.
- `src/features/auth/session.ts` : session éphémère, revalidation du profil par API et activation de la navigation, sans persistance.
- `src/components/auth/auth-shell.tsx` : présentation native réutilisant Screen, Card, typographie, couleurs Medilink.
- `src/app/(auth)/login.tsx` : formulaire e-mail/mot de passe, visiblité, chargement, annulation à la fermeture et verrou anti-double soumission.
- `src/app/(auth)/choose-role.tsx` : choix patient/médecin.
- `src/app/(auth)/register.tsx` : formulaire complet, spécialité et matricule médecin, acceptation des conditions, messages d'erreur, confirmation e-mail.
- `src/services/auth.ts` : type de la réponse d'inscription aligné sur `AuthSession`.
- `src/features/auth/validation.test.mjs` : cas de validation et erreurs.

## Limites explicites et suite (prompt 07)

- Pas de persistance de token, de rafraîchissement automatique ni de restauration de session au lancement : **le prochain prompt doit utiliser un stockage sécurisé et un refresh single-flight**.
- Aucun contournement de `FirebaseAuthGuard` ou de l'API.
- Le rôle est déterminé par le serveur et revalidé avec `GET /auth/profile`, pas par une query string.
- En cas de redémarrage de l'application, l'utilisateur est invité à se reconnecter pour l'instant.
- Les écrans métiers restent des placeholders ; l'authentification seule n'implémente pas les parcours.
- La visualisation responsive du Vercel, les scénarios connectés avec vrais comptes, les builds Android et les commandes npm n'ont pas pu être exécutés dans l'environnement disponible.
- Les identifiants de test reçus par conversation **ne sont inscrits ni dans le code, ni dans les tests, ni dans cette documentation**.

## Recette à exécuter sur un runner / émulateur connecté

```sh
npm ci
npm run test:auth
npm run test:http
npm run typecheck
npm run lint
```

- [ ] Compte patient avec e-mail vérifié : connexion réussie et navigation vers `/patient`.
- [ ] Compte médecin vérifié : connexion réussie et navigation vers `/medecin`.
- [ ] Compte admin : connexion existante vers `/admin`, **sans possibilité d'inscription publique admin**.
- [ ] Identifiants incorrects : message 401, aucun accès privé.
- [ ] E-mail non vérifié : message 403 et demande de confirmation.
- [ ] Compte inactif : refus et aucune session active.
- [ ] Inscription patient : formulaire puis confirmation e-mail.
- [ ] Inscription médecin : spécialité, matricule, compte en attente et confirmation e-mail.
- [ ] E-mail déjà utilisé : réponse 409 compréhensible.
- [ ] Validation : e-mail, téléphone, mot de passe, confirmation, consentement.
- [ ] Double appui : une seule requête envoyée.
- [ ] Annulation : requête interrompue à la fermeture de l'écran.
- [ ] Accessibilité, grands caractères, clavier et responsive Android.
