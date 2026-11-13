# Prompt 21 — Gestion des documents médicaux Android

## Sources vérifiées

- Site web : `app/(private)/components/patient-documents-manager.tsx`, `doctor-documents-manager.tsx`, `services/patient-document-service.ts`, `doctor-service.ts`.
- NestJS : `src/patients/patients.controller.ts` et `patients.service.ts` ; `src/doctors/doctors.controller.ts` et `doctors.service.ts`.
- Expo Android : `expo-document-picker ~58.0.4`, `expo-web-browser ~58.0.8`, client HTTP `makeMultipart` et écrans de profil existants.

## Endpoints réels et séparation des droits

| Rôle | Liste | Upload multipart | Suppression |
| --- | --- | --- | --- |
| Patient | `GET /patients/me/documents` | `POST /patients/me/documents` : `file`, `type`, `title?` | `DELETE /patients/me/documents/:id` (204) |
| Médecin | `GET /doctors/me` : champ `documents` | `POST /doctors/me/documents` : `file`, `type` | `DELETE /doctors/me/documents/:id` |

Toutes les opérations sont authentifiées Firebase côté NestJS. Les documents sont filtrés par `ownerUserId` (patient), ou par l'identité du médecin, `doctorProfileId`, `medicalDocument.ownerUserId` (médecin). La consultation s'effectue via des **liens HTTPS signés, temporaires**, retournés exclusivement par ces routes. **Ne jamais remplacer par une URL de stockage publique ni enregistrer une URL signée dans les logs.**

Patients : catégories `prescription`, `lab_result`, `medical_report`, `imaging`, `other`. Le client valide uniquement ces catégories. Le backend patient, contrairement au backend médecin, ne valide pas explicitement la signature du fichier ni l'appartenance de `type` à l'enum : **point de durcissement backend restant**. Les 10 Mo sont vérifiés par l'intercepteur NestJS et le service. Aucune limite de 50 documents n'est spécifiée pour le patient : ne pas inventer cette contrainte.

Médecins : catégories `medical_license`, `medical_degree`, `identity_document`, `other`. Le backend limite à **50 documents**, vérifie les octets, le MIME et la signature réelle ; tous les nouveaux documents sont `pending`. Supprimer un justificatif déjà approuvé peut repasser le professionnel de `verified` à `pending`, donc le texte de confirmation conserve cet avertissement explicite.

## Fonctionnalités Android implémentées

- `src/features/documents/document-rules.ts` : règles mutualisées PDF/JPEG/PNG/WebP, taille **de 1 octet à 10 Mo**, nom ≤255 caractères, limite médecin de 50, titre patient ≤255 caractères, catégories propres à chaque rôle, URL de consultation HTTPS, erreurs neutres.
- `src/features/documents/document-actions.ts` : sélection par **Android Storage Access Framework** via `expo-document-picker`, sans `READ_EXTERNAL_STORAGE`, `READ_MEDIA_*` ni permission caméra. `multiple:false`, `copyToCacheDirectory:false` : l'application réutilise l'URI explicitement autorisée par Android et **n'en crée pas une copie systématique** dans son cache. Un refus ou une annulation du sélecteur est géré sans fuite du chemin local.
- Prévisualisation avant envoi des **métadonnées** du fichier sélectionné (nom, MIME, taille, catégorie/titre). Pour les documents déjà enregistrés, clic sur **Consulter** : ouverture explicite du lien HTTPS signé dans une session navigateur temporaire `expo-web-browser`. Aucun téléchargement permanent ou base64 dans l'application, et aucune URL signée dans l'état persistant. Un navigateur externe peut disposer de ses propres règles de cache : ne pas prétendre maîtriser ses caches.
- Les profils patient et médecin conservent le transfert **multipart réel** via `patientsApi.uploadDocument` / `doctorsApi.uploadDocument`, les erreurs de type/taille, les loaders et le verrou de double envoi. Aucun pourcentage de progression fictif : le transport actuel est un `fetch` natif sans callback d'avancement ; seul l'état de transfert est affiché.
- Le patient retrouve la **recherche sur titre/nom/catégorie**, les filtres par type et une pagination locale de **6 documents** (le serveur patient renvoie l'ensemble de son archive, sans pagination).
- La suppression dans les deux profils exige une confirmation, puis un nouveau GET du serveur. L'état local d'un compte antérieur est purgé à la sortie, et le patient ignore les résultats tardifs du sélecteur/transfert après déconnexion ou changement de profil.
- Aucune prise de photo ajoutée : les deux gestionnaires web sont construits autour du choix de fichiers, et la caméra ajouterait une permission/donnée sensible et un format HEIC/JPEG supplémentaire sans nécessité démontrée.

## Tests

`src/features/documents/document-rules.test.mjs` / `npm run test:documents`, intégrés à `npm run check` et à la CI GitHub Actions, couvrent :
- MIME acceptés/refusés, bornes de **1 octet / 10 Mo**, nom, titre, catégories patient vs médecin et plafond médecin **50** ;
- annulation silencieuse du sélecteur, **refus de permission simulé** (erreur sans chemins privés) ;
- prévisualisation HTTPS signée, refus de `file://`, `http://`, `javascript:`, localhost et fragments ;
- filtres, recherche et pagination réelle de la liste locale patient ;
- erreurs 403/404/413/400/422 et absence de divulgation d'informations médicales dans le message.

```bash
npm ci
npm run typecheck
npm run test:documents
npm run lint
npm run doctor
```

La CI teste TypeScript et les fonctions pures, **pas le picker natif instrumenté**.

## Recette sur build Android avant fusion

- [ ] Connecter un vrai patient, vérifier qu'un autre compte patient ne peut lire, visualiser ni supprimer ses documents.
- [ ] Choisir PDF/JPEG/PNG/WebP par Android SAF, vérifier la persistance de l'autorisation `content://` durant le multipart `fetch` : **ce point nécessite un test physique**. Sur certains fournisseurs Android, `copyToCacheDirectory:false` peut exiger un traitement spécifique ; ne pas réintroduire une copie durable sans stratégie de purge contrôlée.
- [ ] Refuser fichier vide, HEIC, ZIP, >10 Mo, MIME incohérent ; confirmer validation réelle côté serveur médecin.
- [ ] Vérifier qu'une annulation ou un refus du picker ne dévoile aucun chemin.
- [ ] Prévisualiser par lien signé, expirer le lien, recharger depuis l'API ; vérifier une absence de téléchargement conservé par l'application.
- [ ] Vérifier transfert multipart, progression **indéterminée**, succès uniquement après réponse serveur, puis relecture des documents.
- [ ] Supprimer après confirmation, vérifier 204 patient ou suppression médecin, puis actualisation du GET.
- [ ] Vérifier la conséquence de suppression d'un document médecin approuvé sur la vérification.
- [ ] Déconnecter/changer de compte pendant sélection/upload/suppression et confirmer absence de réapparition de documents de l'ancien compte.
- [ ] Contrôler lecteur d'écran, clavier, mini-écrans et comparaison au web authentifié.

**Limites connues** : pas d'appareil Android connecté pour tests de multipart `content://` / lecteur externe ; pas de mesure de progression possible via le transport actuel. Le backend patient devra être durci pour vérifier les catégories et signatures comme le backend médecin.
