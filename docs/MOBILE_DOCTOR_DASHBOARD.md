# Prompt 15 — Tableau de bord médecin Android

## Sources vérifiées

- Web : `app/(private)/medecin/page.tsx`, `lib/doctor-dashboard-data.ts`,
  `lib/doctor-portal-data.ts` et les services `doctor-service`,
  `need-service`, `appointment-service`, `availability-service`,
  `message-service`.
- NestJS : `src/doctors/doctors.controller.ts`,
  `src/needs/needs.controller.ts` et `needs.service.ts#getVerifiedDoctor`,
  `src/appointments/appointments.controller.ts`,
  `src/availabilities/availabilities.controller.ts`,
  `src/messages/messages.controller.ts`.
- Mobile : `src/services/{doctors,needs,appointments,availabilities,messages}.ts`,
  `src/store/navigation-session.ts`, le design system et les protections Expo Router.

Les modules web `doctor-dashboard-data.ts` et `doctor-portal-data.ts` contiennent
des **exemples statiques**, notamment un taux de réponse de 92 %, des noms de
patients et de rendez-vous fictifs. **Aucune de ces données n'est reprise
dans le tableau de bord Android.** Le véritable écran web `medecin/page.tsx`
charge déjà indépendamment plusieurs services ; le mobile conserve cette
architecture, avec contrôle d'accès plus explicite.

## Contrats et droits d'accès

| Ressource | Endpoint | Restriction/affichage |
| --- | --- | --- |
| Profil professionnel | `GET /doctors/me` | Compte médecin, vérification professionnelle réelle |
| Demandes pertinentes | `GET /needs/doctor?page=1&pageSize=5` | **Profil médecin vérifié obligatoire**, total renvoyé par le serveur |
| Propositions envoyées | `GET /needs/doctor/proposals?page=1&pageSize=10` | **Profil vérifié obligatoire**, total renvoyé par le serveur |
| Agenda personnel | `GET /appointments/doctor` | Rendez-vous attachés au médecin authentifié |
| Horaires hebdomadaires | `GET /availabilities/me/weekly` | Plages du médecin authentifié ; **ne prouve pas qu'un créneau est libre** |
| Dates bloquées | `GET /availabilities/me/blocked` | Nombre de dates réellement exposées |
| Messages | `GET /messages/conversations` | Conversations autorisées par le serveur, pas toutes les conversations |

Le tableau de bord est une route `/medecin` protégée par le rôle `doctor`
dans Expo Router. Le client attend `GET /doctors/me` pour décider s'il est
autorisé à interroger `/needs/doctor` et `/needs/doctor/proposals`.
`needs.service.ts#getVerifiedDoctor` refuse les profils professionnels
`pending`, `rejected` ou `suspended` avec HTTP 403 ; l'interface
**n'envoie pas** ces requêtes et présente une explication claire.

Le statut `session.accountStatus` de l'utilisateur et
`doctor.verificationStatus` du professionnel sont distincts :
un compte en attente n'est **jamais affiché comme médecin vérifié par défaut**.
Les autres endpoints conservent leurs propres contrôles serveur ;
leurs éventuels HTTP 401/403 sont signalés comme accès restreint, et non
comme absence de données.

## Interface Android

`src/app/medecin/(tabs)/index.tsx` contient :

- En-tête bleu Medilink, identité du médecin et badge de vérification
  **uniquement depuis le backend**.
- Pour un profil pending/rejected/suspended : panneau d'état explicite,
  accès au profil et aux justificatifs ; les sections sensibles demandes/
  propositions sont masquées et leurs compteurs non disponibles.
- Statistiques réelles : total de besoins disponibles et propositions,
  rendez-vous futurs, messages non lus. Un compteur échoué est **« — »**,
  jamais un zéro inventé. Aucun taux de réponse non exposé n'est calculé.
- Actions prioritaires adaptées aux petits écrans : demandes et propositions
  seulement pour un profil vérifié, agenda, disponibilités, profil et messages.
- Aperçu de demandes (première page), rendez-vous du jour, plages horaires
  réellement activées et aperçu des deux conversations récentes.
- Pull-to-refresh, `useFocusEffect` à chaque retour, chargements et erreurs
  **séparés**, relecture après navigation, `AbortController` et génération
  anti-réponse obsolète.
- Purge de l'état local de cet écran à sa sortie, sans persistance
  des noms/messages de patients en AsyncStorage ou Zustand.
- Navigation vers les modules médecin déjà déclarés ; certains modules
  des prompts 16–18 restent provisoirement des placeholders. Un lien
  d'action ne prétend pas que son parcours est déjà implémenté.

### Rendez-vous du jour et fuseau

Le backend `GET /appointments/doctor` fournit `date: YYYY-MM-DD`
et `time: HH:mm`. Le mobile reprend le fuseau métier **Africa/Douala**
du dashboard web pour filtrer les dates du jour et les rendez-vous à venir.
Statuts actifs : `pending_confirmation` et `confirmed`, uniquement ;
`completed`, `cancelled`, `rejected`, `no_show` sont exclus des
compteurs futurs. Aucun nombre par semaine ou taux de réponse n'est deviné.

## Tests

`src/features/doctor/doctor-dashboard.ts` centralise les modèles purs :
protection de statut, validation de profil/page, filtre temporel, agrégations,
tri des rendez-vous, horaires actifs, comptage des messages non lus.

`src/features/doctor/doctor-dashboard.test.mjs` couvre :
- refuser les demandes/propositions avant vérification professionnelle ;
- doctor pending/rejected/suspended/verified et profil API incomplet ;
- distinguer erreur, accès restreint et absence de résultats ;
- ne pas afficher 0 en cas de source échouée ;
- utiliser les `total` paginés du backend, pas `items.length` ;
- rendez-vous futurs et du jour en Africa/Douala ;
- disponibilité hebdomadaire seulement si activée ;
- comptage des messages effectivement retournés.

```bash
npm ci
npm run typecheck
npm run test:doctor-dashboard
npm run test:session
npm run lint
npm run doctor
```

Les tests Node et TypeScript s'exécutent dans la CI de la PR.
Le lint, Expo Doctor et les tests Android instrumentés doivent être
vérifiés séparément.

## Recette avec comptes réels (à effectuer avant fusion)

- [ ] Connexion médecin **verified** : résumé et sections récupérés,
      chiffres identiques aux endpoints directs et à la version web.
- [ ] Connexion médecin **pending**, **rejected**, **suspended** :
      demandes/propositions invisibles ; aucun succès ou valeur 0 fictifs.
- [ ] Utilisateur patient/admin : route /medecin inaccessible même par deep link.
- [ ] 403 du backend : affichage accès restreint sans divulgation des demandes.
- [ ] Une source réseau échoue : les autres sections restent exploitables.
- [ ] Actualisation, changement de compte et retour à un onglet :
      rechargement et absence d'informations de l'ancien compte.
- [ ] Horaire sans plage active ou sans rendez-vous : véritables états vides.
- [ ] Affichage sur petit téléphone, grandes polices, TalkBack et retour Android.
- [ ] Comparaison responsive avec https://medilink-nu-ten.vercel.app/.

**Limite de preuve :** la lecture interactive authentifiée du site Vercel
et l'exécution sur téléphone/émulateur avec les comptes autorisés n'ont
pas été possibles dans cette session. La réussite CI ne constitue pas
une validation de bout en bout.

## Suivi GitHub

La branche initiale `docs/mobile-audit-parity-2026-11-13` reste unique.
Les PR #1, #2 et #3 ont déjà été fusionnées par ailleurs ; les prompts
de la phase médecin sont suivis dans la **PR #4 en brouillon**.
