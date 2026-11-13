# Prompt 14 — Profil patient et dossier médical natif

## Audit du web et de NestJS

Sources inspectées : `app/(private)/patient/profil/page.tsx`,
`components/live-medical-sections.tsx`,
`services/patient-health-service.ts`, `patient-document-service.ts`,
`hooks/use-patient-profile.ts`, et les contrôleurs/services NestJS
`auth`, `patients`, `integration`.

| Besoin | Source réelle | Modification autorisée |
| --- | --- | --- |
| Identité, téléphone, e-mail, genre, date de naissance, groupe sanguin | `GET /auth/profile` | `PATCH /integration/patient/profile` uniquement pour `name`, `phone`, `bloodType`, `city`, `district` |
| Conditions médicales | `GET /patients/me/conditions` | **Aucun endpoint patient confirmé** pour créer/modifier/supprimer des conditions |
| Documents médicaux | `GET /patients/me/documents` | `POST /patients/me/documents` et `DELETE /patients/me/documents/:id` |
| Rendez-vous et demandes | `GET /appointments`, `GET /needs` | Écrans propres des prompts 12–13 |
| Mot de passe | `POST /auth/reset-password` | Réinitialisation par e-mail du prompt 08 |

### Particularité du contrat /auth/profile

À la date de l'audit, `auth.service.ts#getProfile` renvoie la partie
`patient` avec `address: null` et `verified: false` pour toutes les réponses,
même si une adresse associée existe dans une autre collection. **Ne jamais
inventer une adresse, une vérification ou un âge** pour compenser.

Les champs date de naissance, genre et e-mail sont en lecture seule car aucun
endpoint patient dédié à leur modification n'a été confirmé. Une date de
naissance `null` est affichée « Non renseignée ».

### Validation PATCH /integration/patient/profile

Corps exact : `{ name, phone, bloodType, city, district }`. Le serveur accepte :
- nom 2–150 caractères ;
- téléphone 6–30 caractères ;
- groupe sanguin parmi a/b/ab/o positif/négatif, ou `unknown` ;
- ville et quartier chacun ≤100 caractères.

Il met à jour `users` (prénom, nom, téléphone) et `patients` (nom, groupe
sanguin), et les champs ville/quartier **uniquement si une adresse complète
est déjà associée**. Sans adresse existante, l'API refuse une ville/quartier
non vides. Son `GET /auth/profile` ne permet pas actuellement de déterminer
si une adresse existe réellement. Pour éviter la fausse promesse d'édition,
l'écran rend ces champs non éditables quand le profil ne retourne pas
d'adresse. Ce n'est **pas** une interface de création d'adresse.

L'application n'annonce la réussite **qu'après `{saved:true}`**, puis recharge
le profil du serveur. Aucune sauvegarde optimiste simulée.

## Dossier médical

`GET /patients/me/conditions` renvoie `id`, `name`, `description`,
`status` (`active` / `controlled` / `inactive`), `diagnosedAt` et
`notes`. La liste est **strictement en lecture seule**.

`GET /patients/me/documents` renvoie seulement les documents dont
`ownerUserId` est l'utilisateur connecté. Le backend produit des URLs
signées expirant après 3600 secondes, parfois `null`. Un nouveau chargement
doit être demandé si le lien est expiré. Le client ne conserve ni
`storageKey`, ni secret Supabase, ni URL signée dans un stockage permanent.

`POST /patients/me/documents` : multipart avec `file`, `type`, `title?` ;
formats PDF, JPEG, PNG, WebP exclusivement, taille ≤10 Mo, **un fichier par
requête**. Après ajout, les documents sont rechargés depuis l'API.
`DELETE /patients/me/documents/:id` : suppression définitive uniquement pour
le propriétaire, confirmée dans une boîte native, puis rechargement.
Le sélecteur `expo-document-picker` utilise une copie temporaire pour le
transfert, sans persistance du contenu dans AsyncStorage.

## Confidentialité, chargement et états

- Écran protégé par Expo Router et le rôle `patient` issu de la session
  vérifiée. Auth Firebase obligatoire à tous les endpoints.
- Affichage explicite des conditions et documents médicaux masqué par défaut.
  L'utilisateur doit activer l'affichage. L'état est réinitialisé à la sortie
  de l'écran et en cas de déconnexion.
- Requêtes indépendantes (profil, conditions, documents) avec erreurs
  distinctes : **source en erreur ≠ liste vide**. Actualisation par
  pull-to-refresh ; annulation et génération contre les réponses obsolètes.
- Aucune donnée santé sauvegardée en local, en URL de navigation ou dans un
  état persistant Zustand ; la mémoire de l'écran est purgée sur sortie.
- Les liens signés sont ouverts uniquement sur action explicite, en HTTPS.
  Une application externe peut ensuite traiter le document selon ses propres
  politiques : vérifier ce comportement sur appareil.
- Les messages d'erreur affichés sont génériques et ne recopient pas les
  détails techniques du backend.

## Fichiers implémentés

- `src/app/patient/(tabs)/profil.tsx` : écran natif de profil et dossier,
  formulaire contrôlé, documents, états et déconnexion.
- `src/features/patient/patient-medical-profile.ts` : modèle de profil,
  validation, mapping des conditions/documents et types de documents.
- `src/services/auth.ts` : typage de `GET /auth/profile`.
- Services existants `patientsApi`, `integrationApi` reliés aux vrais
  endpoints, sans nouveau contrat artificiel.
- `src/features/patient/patient-medical-profile.test.mjs` et
  `npm run test:patient-profile`, intégrés à GitHub Actions.

## Recette E2E à terminer

```sh
npm ci
npm run typecheck
npm run test:patient-profile
npm run test:http
npm run test:session
npm run lint
npm run doctor
```

- [ ] Connexion réelle avec le compte patient, vérification de la réponse de
  `/auth/profile` et des valeurs absentes sans fausses données.
- [ ] Modification nom/téléphone/groupe sanguin et relecture après `saved:true`.
- [ ] Tentative ville/quartier sans adresse : pas de faux succès ni création simulée.
- [ ] Refus de l'édition de l'e-mail, du genre, de la date de naissance et
  des conditions médicales.
- [ ] Chargement avec conditions vides, documents vides et erreurs partielles.
- [ ] Upload PDF/JPEG/PNG/WebP valide ; rejet HEIC et fichier >10 Mo.
- [ ] Suppression de son document après confirmation ; échec et réessai.
- [ ] URL signée expirée/absente ; rechargement, refus HTTP.
- [ ] Déconnexion/changement de compte : aucune donnée du patient précédent.
- [ ] Tests TalkBack, grands caractères, protection de l'écran partagé,
  retour Android, comparaison responsive 360/390/430 dp.

**Limites de validation** : les suites automatisées ne prouvent pas que
l'upload fonctionne avec un compte réel. Aucun test Android instrumenté ni
comparaison visuelle authentifiée du site Vercel n'a pu être réalisé dans cet
environnement. Ne pas fusionner avant recette.
