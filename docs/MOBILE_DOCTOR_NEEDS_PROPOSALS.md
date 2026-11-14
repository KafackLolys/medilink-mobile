# Prompt 16 — Besoins et propositions médecin Android

## Sources réelles analysées

Web : `app/(private)/medecin/besoins/page.tsx`, `app/(private)/medecin/besoins/[id]/detail-client.tsx`, `app/(private)/medecin/propositions/page.tsx`, `hooks/use-doctor-needs`, `services/need-service.ts`.

NestJS : `src/needs/needs.controller.ts`, `src/needs/needs.service.ts` (`listForDoctor`, `getForDoctor`, `createProposal`, `listProposalsForDoctor`, `cancelProposal`, `getVerifiedDoctor`). Le serveur revalide **l'identité du médecin** et **`verificationStatus === verified`** avant toute lecture de demande ou proposition. Le mobile charge `GET /doctors/me` et applique le même verrou avant ces quatre routes, avec contrôle supplémentaire côté Expo Router.

## Routes et comportement

| Route Android | API | Fonctionnalité |
| --- | --- | --- |
| `/medecin/besoins` | `GET /needs/doctor` | Annuaire de besoins accessibles, filtres réellement exposés, pagination réelle et pull-to-refresh |
| `/medecin/besoins/:id` | `GET /needs/doctor/:id` | Détail vérifié de la demande, symptômes, ville/quartier et documents autorisés |
| Détail, formulaire de proposition | `POST /needs/doctor/:id/proposals` | Message, date/heure proposées, mode, tarif XAF, complément, aperçu et confirmation |
| `/medecin/propositions` | `GET /needs/doctor/proposals` | Historique, états, réponse du patient, pagination et filtre de statut |
| Mes propositions | `PATCH /needs/doctor/proposals/:id/cancel` | Annulation confirmée et relecture si le serveur l'autorise |

### Filtres et pagination backend

`GET /needs/doctor` accepte uniquement :
- `q` : recherche libre (100 caractères maximum) ;
- `specialty` : spécialité connue depuis `specialties` de la réponse, 100 caractères max ;
- `priority` : `routine`, `urgent`, `emergency` ;
- `mode` : `home` ou `teleconsultation` ;
- `page` et `pageSize`, entiers positifs, avec `pageSize <= 50`.

La pagination se fait à **10 entrées par page**. Le nombre affiché vient de `total` et non de `items.length` : cela évite les faux comptages.

`GET /needs/doctor/proposals` accepte **uniquement** `status` (six statuts), `page`, `pageSize`. `counts` est renvoyé par NestJS et représente le nombre réel de propositions par statut.

### Règles de visibilité

`getForDoctor` répond 404 si la demande n'existe pas, si elle appartient au médecin, si le propriétaire n'est pas un patient, ou si le statut n'est pas `published`, `awaiting_proposals` ou `proposals_received`. Le frontend ne contourne pas cette vérification et ne propose pas les routes personnelles patient.

La réponse médecin utilise `privateAddress: null`. Le modèle mobile filtre explicitement l'identité du patient, son e-mail, son numéro, son adresse et les clés de stockage, même si des champs imprévus apparaissaient dans une réponse. Seules la ville, le quartier et les pièces jointes **expressément partagées par l'API du médecin** sont affichés.

Les documents ne sont ouverts qu'au clic de l'utilisateur, avec URL HTTPS signée temporaire ; une URL expirée exige un rechargement. Aucune pièce jointe n'est conservée dans AsyncStorage.

### Création de proposition

Body exact : `{message, proposedAppointmentAt, consultationMode, fee, details?}`.

- `message.trim().length >= 10`.
- `proposedAppointmentAt` : date ISO future. Le formulaire demande une date locale `AAAA-MM-JJ` et une heure locale `HH:mm`, validées avant conversion ISO.
- `consultationMode` : `home` ou `teleconsultation`.
- `fee` : nombre XAF fini, positif ou nul.
- `details?` : maximum 2000 caractères.

Étape d'aperçu avant envoi, verrou de double soumission, aucun enregistrement optimiste ni faux rendez-vous. Le backend crée une proposition au statut `pending`. Une proposition existante pour ce médecin et cette demande provoque HTTP **409**, y compris si l'ancienne proposition a été annulée : la création d'une nouvelle proposition ne doit pas être suggérée automatiquement après annulation.

### Annulation

Autorisation exacte de NestJS : **`pending` ou `sent` seulement** et propriétaire du médecin connecté. Les autres statuts (`accepted`, `rejected`, `expired`, `cancelled`) restent en lecture seule. Le dialogue natif exige une confirmation. Le résultat attendu est `{id,status:'cancelled'}`. L'interface recharge la liste et ses compteurs à partir de l'API après mutation ou erreur, sans inventer le statut.

### États, confidentialité et robustesse

- Loading, vide, réseau, 403, 404, 409, validation 400/422, relance et actualisation native.
- `AbortController`, génération de requêtes et nettoyage des données médicales à chaque sortie de l'écran.
- Le hook `useVerifiedDoctorAccess` vérifie le rôle local issu du serveur et le vrai statut professionnel avant de charger les besoins et les propositions. `pending`, `rejected`, `suspended` ne voient pas les listes.
- Aucun message brut NestJS/Firestore/Supabase contenant des informations sensibles n'est affiché.
- Les données de l'annuaire correspondent aux demandes réellement exposées par NestJS ; pas de distance, adresse exacte, nom ou dossier médical patient fictifs.

## Tests et recette

`src/features/doctor/doctor-needs.test.mjs`, commande `npm run test:doctor-needs`, couvre la matrice d'accès, limites des filtres, pagination, absence de champs privés, détail autorisé, validation des propositions, autorisations d'annulation, compteurs réels et messages d'erreur sûrs.

```bash
npm ci
npm run typecheck
npm run test:doctor-needs
npm run test:doctor-dashboard
npm run lint
npm run doctor
```

Scénarios manuels à exécuter avec des comptes **réels** :

- [ ] Médecin **verified** : besoins filtrés, pagination et détail autorisé.
- [ ] Médecin **pending / rejected / suspended** : pas d'accès aux demandes/propositions.
- [ ] Patient/admin : routes médecin interdites, y compris par lien profond.
- [ ] Champ privé injecté dans une réponse : jamais rendu à l'écran.
- [ ] Pièce jointe autorisée : lien signé, expiration, rechargement sans fuite.
- [ ] Envoi valide : statut `pending`, puis actualisation des propositions.
- [ ] Deuxième proposition pour le même besoin : HTTP 409, aucune nouvelle création.
- [ ] Annulation de `pending`/`sent` : demande de confirmation, changement confirmé et rafraîchissement.
- [ ] Annulation de `accepted` : bouton absent, refus serveur si appelé autrement.
- [ ] 404 après clôture du besoin : message neutre, aucune donnée obsolète.
- [ ] Réseau interrompu, retour arrière, changement de compte et grands textes TalkBack.
- [ ] Contrôle visuel Android vs site Medilink en responsive.

Les tests unitaires/TypeScript CI ne remplacent **pas** la recette sur téléphone authentifié. Le site Vercel n'a pas pu être inspecté dans une session interactive authentifiée. Les prochaines phases doivent continuer sur la branche existante sans fusionner la PR avant validation.
