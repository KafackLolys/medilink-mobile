# Prompt 18 — Profil professionnel médecin Android

## Sources étudiées

Web : `app/(private)/medecin/profil/page.tsx`,
`medecin/profil/doctor-profile-edit-form.tsx`,
`app/(private)/components/doctor-documents-manager.tsx`,
`services/doctor-service.ts`, hook `use-my-doctor-profile`.

NestJS : `src/doctors/doctors.controller.ts`,
`src/doctors/doctors.service.ts` (`getMine`, `updateMyProfile`,
`uploadMyDocument`, `deleteMyDocument`) et garde Firebase.

## Contrat des champs

| Champ visible dans GET /doctors/me | Édition Android | Contrat backend |
| --- | --- | --- |
| Nom, e-mail, téléphone | Lecture seule | Aucun champ accepté dans PATCH /doctors/me |
| Spécialité principale, secondaires | Lecture seule | Aucun endpoint médecin confirmé pour ces valeurs |
| Numéro d’inscription | Lecture seule | Aucun PATCH confirmé |
| Diplômes et qualifications | Lecture seule | Les documents justificatifs suivent une route distincte |
| Statut de vérification | Lecture seule | Décidé par les opérations de contrôle du backend |
| Présentation professionnelle | Oui | `bio` string ≤ 600, vide accepté |
| Années d’expérience | Oui | Entier de 0 à 80 |
| Tarif de consultation | Oui | Entier sûr de 0 à 100 000 000, devise retournée par le profil |
| Adresse professionnelle | Oui | `string | null`, longueur ≤ 255 |

`PATCH /doctors/me` **rejette tout champ non reconnu**. Le client
n'envoie exactement que `bio`, `yearsOfExperience`,
`consultationFee`, `professionalAddress`. Après une réponse
`DoctorOwnProfile` validée avec le même identifiant professionnel,
le client recharge `GET /doctors/me` ; aucun succès simulé.

Le profil peut être `pending`, `verified`, `rejected` ou `suspended`.
Le statut n'est jamais modifiable localement. Un médecin non vérifié peut
consulter son profil et téléverser des justificatifs, sous réserve des
contrôles de son compte par le backend.

## Justificatifs professionnels

`POST /doctors/me/documents` :
- Multipart `file` et `type`, un seul fichier par opération.
- Types : `medical_license`, `medical_degree`,
  `identity_document`, `other`.
- MIME : PDF, JPEG, PNG, WebP ; entre 1 octet et **10 Mo**.
- Au maximum **50 justificatifs par médecin**.
- NestJS valide **les octets, la signature des fichiers et le MIME réel**,
  pas uniquement le nom, l'extension ou le MIME annoncé par Android.
- Le serveur renvoie le justificatif au statut `pending` ; **l'upload
  n'équivaudra jamais à une approbation automatique**.

`DELETE /doctors/me/documents/:id` : suppression du document du
médecin propriétaire uniquement, avec confirmation explicite.

**Conséquence vérifiée :** supprimer un justificatif au statut
`approved` peut faire repasser `doctorProfiles.verificationStatus`
de `verified` à **`pending`** et retirer l'accès aux demandes et aux
propositions. Le texte de confirmation Android avertit de cet impact.
La liste et le statut sont rechargés immédiatement après la suppression.

L'application ouvre les URLs signées HTTPS seulement sur action explicite ;
les URLs peuvent expirer et être indisponibles. Aucun chemin privé de
stockage, ID de relecteur ou secret serveur n'est conservé en état
persistant. Un fichier choisi est temporairement copié dans le cache
applicatif par `expo-document-picker`. Le sélecteur système donne accès
uniquement au fichier explicitement choisi : **aucune autorisation Android
globale de lecture/écriture du stockage n'est demandée**. Les copies
temporaires appartiennent au cycle de vie du cache Expo et doivent être
vérifiées sur un véritable appareil.

## Contrôles d'accès et erreurs

- Expo Router et écran exigent `session.role === 'doctor'`, issu d'une
  session vérifiée par le backend.
- `GET /doctors/me` est la seule source du profil ; en cas d'échec,
  la page ne présente pas de profil fictif.
- Blocage des doubles soumissions et relecture API après chaque mutation.
- Chargement, erreur, vide, fichier refusé, maximum atteint, lien
  signé expiré et refus 401/403/404/413/422 sont gérés par des messages
  neutres sans détails internes.
- Nettoyage du formulaire, des références de justificatifs et du
  profil à la sortie de l'onglet, pour prévenir l'affichage d'un compte
  précédent. Les anciennes réponses de mutation sont ignorées après
  changement de vue/compte (epoch de cycle de vie indépendant).
- L'écran ne stocke aucun justificatif dans AsyncStorage ni dans l'état
  de navigation Zustand.

## Fichiers développés

- `src/app/medecin/(tabs)/profil.tsx` : écran complet.
- `src/features/doctor/doctor-professional-profile.ts` :
  modèle et validation du PATCH, normalisation de documents, types MIME,
  tailles, permissions, avertissement de perte de vérification.
- `src/features/doctor/doctor-professional-profile.test.mjs` :
  tests de bornes, champs modifiables, statut `pending`, suppression
  `approved`, limitation de volume et absence de données privées.
- Services `src/services/doctors.ts` déjà existants : GET, PATCH, POST
  multipart et DELETE, réutilisés sans route inventée.
- Tests exécutés par `npm run test:doctor-profile-edit` et la CI.

## Recette à terminer sur appareil Android

```sh
npm ci
npm run typecheck
npm run test:doctor-profile-edit
npm run lint
npm run doctor
```

- [ ] Compte médecin `pending`, `verified`, `rejected` :
  badges et documents réels retournés.
- [ ] Modifier les quatre champs autorisés, enregistrer et rafraîchir.
- [ ] S'assurer que spécialité, numéro d'inscription, nom, diplômes et
  vérification sont strictement en lecture seule.
- [ ] Sélectionner un PDF, un JPEG, un PNG et un WebP jusqu'à 10 Mo.
- [ ] Rejeter un HEIC, un fichier vide, de type interdit ou supérieur à 10 Mo.
- [ ] Vérifier limite 50 documents et contrôle d'identité du backend.
- [ ] Téléverser un document : statut `pending` confirmé par GET.
- [ ] Ouvrir un lien signé autorisé, puis renouveler après expiration.
- [ ] Supprimer un document `pending` après confirmation.
- [ ] Supprimer un justificatif `approved` et vérifier le passage
  éventuel à `pending` ; contrôler la restriction immédiate du dashboard.
- [ ] Déconnexion pendant un upload et changement de compte, sans
  affichage des données professionnelles précédentes.
- [ ] Tests TalkBack, grands caractères, petits écrans et conformité
  visuelle avec https://medilink-nu-ten.vercel.app/.

**Validation limitée** : tests TypeScript/Node ne prouvent pas la
compatibilité du multipart avec un compte de test ni la présence
d'une vraie URL signée. La recette Android E2E doit être exécutée
avant fusion. Ne pas considérer l'upload réel ni Expo Doctor comme
validés sans leur résultat.
