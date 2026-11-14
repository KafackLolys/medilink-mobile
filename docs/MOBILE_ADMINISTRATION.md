# Prompt 24 — Administration Android et périmètre de sécurité

## Audit web/API

Sources :
- `app/(private)/admin/page.tsx`, `services/admin-service.ts` et `routes/admin-routes.ts`.
- Backend `src/admin/admin.controller.ts`, `admin.guard.ts`, `admin.service.ts` et `src/auth/firebase-auth.guard.ts`.

Toutes les routes `/admin/*` exigent **simultanément** `FirebaseAuthGuard` et `AdminGuard`. Le premier vérifie une identité Firebase ID valide non révoquée et refuse les comptes suspendus/supprimés. Le second relit Firestore `users/{firebaseUid}` et impose **`role='admin'` et `status='active'`**. Un rôle client, un lien ou une condition d'affichage ne peut donc pas contourner les protections serveur.

| Opération réelle | Contrat NestJS | Décision Android |
| --- | --- | --- |
| Lister les comptes | `GET /admin/accounts?role=patient\|doctor&page=1&pageSize=10&q=...` ; `q` ≤100 caractères, `pageSize` 1–50, `page` 1–1 000 000 ; tri descendant selon date de création | **Implémentée** : filtre patient/médecin, recherche nom/e-mail/téléphone, pagination 10/page, compteur serveur |
| Changer le statut | `PATCH /admin/accounts/:id/status` `{status:'active'\|'pending'\|'suspended'\|'deleted'}` | **Implémentée**, avec double confirmation et relecture serveur |
| Modifier la vérification d'un patient | `PATCH /admin/accounts/:id/verification` `{emailVerified:boolean}` | **Implémentée**, avec double confirmation |
| Modifier la vérification d'un médecin | même route `{verificationStatus:'pending'\|'verified'\|'rejected'\|'suspended'}` | **Implémentée**, avec double confirmation |
| Créer un admin | `POST /admin/admins` `{firstName,lastName,email,password,phone?}` | **Conservée sur le web** : manipulation d'un mot de passe provisoire et transmission sécurisée, peu adaptée à une action mobile courante |

Le backend ne propose pas de consultation complète d'un dossier médical patient depuis l'administration. L'application **n'affiche aucun dossier médical**, document patient, justificatif médecin ni information privée hors des champs de `AdminAccount`. Les utilisateurs de rôle `admin` ne sont pas inclus dans la liste administrable : ils ne peuvent pas être modifiés au travers de ces endpoints.

## Effets des modifications et précautions

- `updateStatus` interdit la modification de son propre compte admin et de tout compte autre que `patient` ou `doctor`. Pour `suspended` et `deleted`, le backend désactive le compte Firebase Authentication puis révoque ses refresh tokens. La confirmation mobile le signale expressément.
- **Important :** la mise à jour `users.status` Firestore précède la synchronisation Firebase Auth. Si cette deuxième étape échoue, le backend retourne HTTP 503 alors que Firestore **peut déjà avoir été modifié**. L'application ne réessaie jamais le PATCH automatiquement : elle recharge les données et affiche cette possible incohérence.
- `updateVerification` : l'emailVerified patient est synchronisé avec Firebase Auth et Firestore. La vérification médecin met à jour `doctorProfiles.verificationStatus`; la validation `verified` peut automatiquement activer un compte médecin `pending`, mais **ne réactive jamais un compte `suspended` ou `deleted`**.
- Les anciens comptes dont `users.status='verified'` (statut historique non valide) sont normalisés pour l'interface exactement comme sur le web, mais la valeur historique n'est **jamais envoyée** à `PATCH /status`.
- Chaque action envoie une seule mutation, contrôle `id` et la valeur renvoyée par le serveur, puis recharge le listing. Aucune modification optimiste ni traitement multi-compte en lots.
- Les choix de statut et vérification passent par une première fenêtre de préparation puis une **seconde confirmation** explicitant l'identité et les conséquences de l'action.
- Les accès sont limités à `patient` et `doctor`. Un changement de rôle administratif ou la création d'un nouveau rôle ne peut pas être effectué depuis le client.

## Implémentation Android

- `src/app/admin/index.tsx` remplace le placeholder. Liste native `FlatList`, filtres, recherche sur formulaire, pagination, chargement/erreur/états vides, pull-to-refresh et bouton déconnexion.
- `src/services/admin.ts` conserve les endpoints réels (GET / PATCH). L'opération de création d'admin y existe techniquement mais n'a **aucun contrôle de déclenchement depuis l'écran Android**.
- `src/features/admin/admin-model.ts` valide strictement le contenu des pages API et les statuts, retire les champs inattendus, interdit les changements sans variation, refuse un type de vérification non conforme au rôle et affiche des erreurs non divulguantes.
- Le routeur natif `src/app/_layout.tsx` protège déjà `admin` via la session vérifiée. L'écran exige aussi `accountStatus='active'` et relit `GET /auth/profile` avant la requête `GET /admin/accounts`. Les gardes NestJS restent le contrôle d'autorisation de référence.
- `AbortController`, génération de requête et purge de la liste/du formulaire au changement d'écran ou de compte limitent l'exposition de données d'un utilisateur précédent. Aucun état admin sensible n'est persisté.
- `src/features/admin/admin-model.test.mjs` / `npm run test:admin`, intégrés à `npm run check` et GitHub Actions.

## Pourquoi la création d'admins reste sur le web

L'API `POST /admin/admins` est disponible et validée par le même `AdminGuard`, mais le workflow requiert un **mot de passe provisoire** transmis à une autre personne, une création Firebase Auth et une écriture Firestore. En cas de panne de création après l'étape Firebase Auth, le backend tente de supprimer le compte créé et peut renvoyer une erreur de compensation.

Cette opération est rare, risquée et adaptée à un poste de travail avec procédure de transmission sécurisée et contrôle opérationnel. Le portage mobile ne propose pas un formulaire de mot de passe ou la transmission de secrets. Un workflow plus avancé devrait privilégier les invitations et l'activation par l'administrateur désigné, avec journal d'audit serveur.

## Tests et recette

Exécuter :

```sh
npm ci
npm run typecheck
npm run test:admin
npm run check
npm run lint
npm run doctor
```

Cas couverts par les tests unitaires : parsing de compte, filtrage du rôle, pagination 10/max 50, recherche 100 caractères, absence de champs privés, anciens statuts, valeurs de statut/vérification permises, choix par rôle, cas sans changement, avertissements suspension/suppression et erreurs 403/409/503 sécurisées.

**Recette sur Android réelle à faire avant fusion :**

- [ ] Admin **actif** : `GET /auth/profile` puis `GET /admin/accounts`, pagination réelle, filtres, recherche.
- [ ] Patient/médecin/admin **non actif** : vérifier refus de route Android puis HTTP 403 sur toutes les routes administratives, y compris en appelant l'API directement.
- [ ] Essayer de modifier son propre compte et un autre admin avec les endpoints : refus `409` sans altération.
- [ ] Changer statut d'un patient avec les deux confirmations, vérifier Firebase Auth et `users.status` Firestore.
- [ ] Suspendre un compte et tester l'impossibilité de se connecter avec ses refresh tokens révoqués.
- [ ] Vérifier l'e-mail d'un patient et comparer les états Firebase Auth et Firestore.
- [ ] Vérifier un médecin `pending` : contrôler l'activation automatique ; ne jamais réactiver un médecin suspendu.
- [ ] Simuler un 503 de synchronisation Firebase et confirmer qu'aucun PATCH automatique n'est répété et que l'écran recharge les états.
- [ ] Changer de compte ou quitter la page pendant le GET et le PATCH, sans faire apparaître d'identité du compte précédent.
- [ ] Contrôler TalkBack, petits écrans, retour modal, longues listes, lint, Expo Doctor et style web.

**Limites** : pas de compte admin authentifié disponible pour une recette E2E dans cette session ; CI vérifie uniquement TypeScript et les tests du modèle. Aucun changement d'état réel n'a été réalisé par les tests.
