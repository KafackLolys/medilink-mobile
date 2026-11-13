# Prompt 11 — Profil public du médecin (Android)

## Contrats étudiés

- Web : `app/(private)/patient/medecins/[id]/page.tsx`, `doctor-profile-client.tsx`, `doctor-rating-section.tsx`, `lib/doctor-bookability.ts`.
- Backend : `src/doctors/doctors.controller.ts` et `doctors.service.ts`, notamment `get(id)` qui récupère uniquement un médecin présent dans la liste des profils **vérifiés** et **actifs**.
- Mobile : `src/services/doctors.ts` (`GET /doctors/:id`), `appointments.ts` (`GET /appointments`, rendez-vous personnels seulement).
- La référence visuelle interactive https://medilink-nu-ten.vercel.app/ reste inaccessible depuis cet environnement ; l'implémentation est dérivée du code web, à comparer ensuite sur 360/390/430 dp.

## Champs permis

Le schéma `DoctorDirectoryItem` inclut uniquement : id, name, specialty, bio, yearsOfExperience, consultationFee, currency, professionalAddress, serviceCity, serviceDistricts, blockedDates (dates sans motif privé), appointmentDurationMinutes, modes, availability, rating agrégée, reviewsCount.

**Exclus de la fiche patient** : téléphone personnel, e-mail, numéro d'inscription, diplômes, pièces d'identité, licences et documents vérificateurs. Ces données relèvent de `GET /doctors/me` réservé au médecin et ne sont pas exposées par `GET /doctors/:id`. La mention « Médecin vérifié » découle du filtrage côté API ; le mobile n'invente aucun statut.

Il n'existe pas d'endpoint public de lecture des avis individuels sur ce médecin. Seuls `rating` et `reviewsCount` sont affichés. Le nombre d'avis n'est pas inventé et `rating: null` devient « Pas encore d'avis ».

## Fonctionnalités

- Route protégée patient `/patient/medecins/:id`, paramètre id encodé par le service.
- Profil complet : initiales (pas de photo dans le contrat), identité, badge vérifié, spécialité, expérience, présentation, lieu, tarif indicatif, modes de consultation et horaires hebdomadaires réellement retournés.
- Dates bloquées présentées sans aucune raison privée ; ne déduit **pas** la disponibilité exacte d'un créneau, qui est confirmée au moment de la réservation par NestJS.
- CTA « Consulter les rendez-vous » toujours accessible comme sur le web, avec un avertissement si aucun mode/horaire n'est renseigné ; la destination `/patient/medecins/:id/rendez-vous` reste le placeholder technique du prompt 12, pas un formulaire de réservation opérationnel.
- Vérification indépendante des rendez-vous personnels terminés via `GET /appointments`, comme `doctor-rating-section` du web. Chaque rendez-vous appartient au patient authentifié ; possibilité d'ouvrir sa fiche. Aucun formulaire d'avis non raccordé n'a été ajouté ; la règle de **un seul avis par rendez-vous** demeure appliquée côté backend.
- Chargement progressif et indépendant, rechargement par glissement, annulation et génération anti-réponses tardives, erreurs et 404 sans fuite de données.

## Implémentation

- `src/features/patient/doctor-profile.ts` : whitelist des champs publics, synthèse d'affichage, consultations terminées.
- `src/app/patient/medecins/[id]/index.tsx` : écran React Native natif utilisant les composants du design system, `useFocusEffect`, SafeAreaView et ScrollView.
- `src/features/patient/doctor-profile.test.mjs` : tests du filtrage de champs privés, 404/JSON mal formé, modes, avis, tarif, horaires et éligibilité des consultations terminées.

## Vérification

```bash
npm ci
npm run typecheck
npm run test:doctor-profile
npm run test:doctors
npm run test:patient
npm run lint
npm run doctor
```

Le workflow Github Actions de la PR vérifie TypeScript et tests ; lint et Expo Doctor doivent être exécutés séparément. Pour terminer la recette : connexion du vrai compte patient, navigation depuis l'annuaire, profils existants/inexistants, consultation des horaires et essais Android avec TalkBack et grandes polices.

**Limite actuelle :** les scénarios authentifiés et la comparaison responsive du site Vercel n'ont pas été exécutés depuis cet environnement, et un succès des tests unitaires ne les remplace pas.

## Continuité GitHub

La PR #1, puis la PR #2, ont été fusionnées par un autre intervenant. La branche unique `docs/mobile-audit-parity-2026-11-13` demeure inchangée ; la PR #3 en brouillon suit les changements du prompt 11, jusqu'à la validation finale.
