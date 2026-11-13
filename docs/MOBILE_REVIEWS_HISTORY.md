# Prompt 23 — Avis patients et historiques de consultations

## Sources auditées

Web : `app/(private)/patient/rendez-vous/[id]/patient-review-form.tsx`, `app/(private)/patient/medecins/[id]/doctor-rating-section.tsx`, `app/(private)/medecin/avis/page.tsx`, `app/(private)/medecin/historique/page.tsx`, `hooks/use-doctor-history.ts`, `services/doctor-review-service.ts`.

Backend NestJS : `src/appointments/appointments.controller.ts`, `appointments.service.ts`, `src/doctors/doctors.controller.ts` et `doctors.service.ts#listMyReviews`.

## API et conditions de publication

| Route | Permissions et contrat |
| --- | --- |
| `GET /appointments` | Liste des rendez-vous du patient authentifié (Firebase UID, patientProfileId) |
| `GET /appointments/:id` | Détail du rendez-vous du patient authentifié, 404 sinon |
| `GET /appointments/:id/review` | Avis patient `{id,rating,comment}` ou `null` si absent ; 404 si non propriétaire |
| `POST /appointments/:id/review` | `{rating,comment}` ; note **entière 1–5**, commentaire facultatif **2000 caractères max**, statut `completed` obligatoire |
| `GET /appointments/doctor` | Historique réel des rendez-vous appartenant au médecin, avec statuts |
| `GET /doctors/me/reviews` | Résumé **serveur** `{items,total,rating,distribution}` et libellé patient minimisé |

**Un seul avis est autorisé par rendez-vous**. Le serveur utilise une transaction Firestore et la clé du document de l'avis est égale à l'ID du rendez-vous. Le transactionnel refuse toute deuxième publication et les demandes visant le rendez-vous d'un autre patient. Un rendez-vous autre que `completed` ne peut pas être évalué. Aucun endpoint de modification ou de suppression d'avis patient n'est exposé : ces boutons sont absents.

L'interface vérifie d'abord `GET /appointments/:id/review`. Si un avis existe, elle affiche la note et le commentaire sans proposer de nouvel envoi. Si un POST a une issue réseau incertaine, elle recharge le GET avant un nouvel essai, **sans réessayer automatiquement le POST**. Les erreurs HTTP 400 (statut invalide ou doublon), 403, 404, 422 et réseau sont présentées sans message serveur sensible.

## Parcours Android développés

- `src/features/reviews/reviews-model.ts` : éligibilité `completed`, format du POST, parseurs d'avis et de statistiques médicales, filtres d'historique et erreurs sécurisées.
- `src/features/reviews/patient-appointment-review.tsx` : composant de publication/lecture d'un avis, validation et verrou de double soumission, chargement et erreurs, état déjà évalué, nettoyage à la sortie.
- `src/app/patient/rendez-vous/[id].tsx` : intégration directe du composant depuis le détail d'un rendez-vous du patient.
- `src/app/patient/medecins/[id]/index.tsx` : section existante « Évaluer ce médecin » qui ne montre que les rendez-vous `completed` avec le médecin et conduit au détail, donc au nouveau formulaire.
- `src/app/patient/historique.tsx` : nouvel historique des consultations **terminées** du seul patient authentifié, filtres Toutes/Ce mois/Cette année, liens vers le détail et l'avis.
- `src/app/medecin/avis.tsx` : remplacement du placeholder par liste réelle `GET /doctors/me/reviews`, filtres par étoiles et affichage du total, de la note et de la répartition **tels que renvoyés par NestJS**. Le nombre d'avis et la moyenne ne sont pas inventés ni recalculés par une métrique de démo. Le backend anonymise la source avec `patientLabel: 'Patient'`.
- `src/app/medecin/historique.tsx` : remplacement du placeholder par consultations `status === completed` issues de `GET /appointments/doctor`, filtres par période, note et nombre d'avis du profil médecin réel. Aucune intervention fictive ni pourcentage de rendez-vous honorés extrapolé.
- Raccourcis vers les historiques et avis dans les agendas patient et médecin existants.

Les états chargement/vide/erreur, actualisation manuelle, `AbortController`, protection des réponses obsolètes et purge à la sortie sont présents. Aucun avis ni historique médical n'est persisté dans AsyncStorage ou la navigation.

## Validation automatisée

`src/features/reviews/reviews-model.test.mjs`, commande `npm run test:reviews`, intégrée à `npm run check` et GitHub Actions. Cas couverts :
- tous les statuts et éligibilité `completed` exclusivement ;
- notes valides/inexactes/non entières, commentaire vide, 2 000 et 2 001 caractères ;
- avis absent (`null`), format et isolation des champs internes d'une réponse ;
- valeurs de statistiques reprises exactement du backend, distribution, compteurs cohérents et anonymisation ;
- historiques patient/médecin limités aux consultations terminées, filtres de période ;
- conflits de doublons et erreurs de droits/réseau non divulguantes.

```bash
npm ci
npm run typecheck
npm run test:reviews
npm run lint
npm run doctor
```

## Scénarios à vérifier sur un vrai Android

- [ ] Compte patient ayant un rendez-vous `pending_confirmation` ou `confirmed` : aucun formulaire actif.
- [ ] Rendez-vous `completed` non évalué : déposer une note entière 1–5 et un commentaire autorisé.
- [ ] Consulter à nouveau le même rendez-vous : avis enregistré, formulaire absent.
- [ ] Poster deux fois, et tenter un second POST depuis un autre appareil : refus transactionnel du serveur, pas de doublon.
- [ ] Couper le réseau juste après l'envoi : vérifier l'avis existant avant toute nouvelle tentative.
- [ ] Patient A tentant de lire/évaluer un rendez-vous de patient B : HTTP 404, aucun avis exposé.
- [ ] Médecin authentifié : voir uniquement ses avis via `GET /doctors/me/reviews`, comparer distribution/note/total à l'API.
- [ ] Historiques patient/médecin : filtrage `completed`, périodes, retour vers le détail.
- [ ] Changement de compte, retour écran ou fermeture pendant un GET/POST : aucune réapparition de données de l'ancien compte.
- [ ] Grands caractères, TalkBack et mise en page Android sur petit écran.

**Limites :** tests de logique et TypeScript vérifiés en CI ; véritables requêtes Firestore et interactions sur téléphone non testées ici. Pour les filtres temporels, l'API médecin renvoie des dates locales sans fuseau IANA ; le mobile conserve donc ces dates textuelles sans inventer une conversion de fuseau. La recette instrumentée, le lint et Expo Doctor restent nécessaires avant fusion.
