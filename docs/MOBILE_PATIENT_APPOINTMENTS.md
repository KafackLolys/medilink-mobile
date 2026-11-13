# Prompt 13 — Réservation médicale Android

## Références examinées (13 novembre 2026)

- Web : `patient/medecins/[id]/rendez-vous/appointment-booking-form.tsx`, `patient/rendez-vous/page.tsx`, `patient/rendez-vous/[id]/appointment-detail-client.tsx`.
- API : `src/appointments/appointments.controller.ts`, `appointments.service.ts`, `src/availabilities/availabilities.controller.ts`.
- Mobile : `src/services/appointments.ts`, `src/services/doctors.ts`, `src/types/domain.ts`, navigation/HTTP sécurisés.
- Le site responsive https://medilink-nu-ten.vercel.app/ n'a pas pu être inspecté visuellement en session authentifiée, malgré la référence définie avant la phase patient.

## Disponibilités réellement exposées

Le backend **ne fournit aucun endpoint public d'inventaire de créneaux libres**.
`GET /doctors/:id` renvoie les données publiques du médecin vérifié : `modes`, `availability` (plages hebdomadaires, avec `weekday`, `startTime`, `endTime`, `isAvailable`), `blockedDates` et `appointmentDurationMinutes`.
Les routes `GET /availabilities/me/weekly`, `/blocked`, `/appointments` sont réservées au **médecin connecté** et ne doivent pas être appelées avec un token patient.

Sur Android, l'utilisateur choisit **une date et une heure souhaitées** à l'intérieur de ces plages publiées ; il n'y a pas d'autocomplétion de créneaux garantis, pas de déduction de l'occupation de l'agenda et pas de pseudo-statut libre/occupé. La date peut être bloquée, un horaire peut être devenu indisponible, et le serveur tranche à la création.

## Création

`POST /appointments` reçoit `{doctorId,scheduledAt,timeZone,consultationMode,reason?}` :
- `scheduledAt` : instant ISO UTC issu de la date et de l'heure saisies **dans le fuseau de l'appareil**, avec contrôle de round-trip IANA ;
- `timeZone` : fuseau IANA du téléphone, p. ex. `Africa/Douala`, **non imposé à tous les utilisateurs** ;
- `consultationMode` : `home` ou `teleconsultation`, seulement les modes déclarés du médecin ;
- `reason` : facultatif, 500 caractères maximum.
La validation client vérifie format, temps futur, modes, dates bloquées, jour hebdomadaire, plage assez longue pour la durée, motif. **NestJS répète tous les contrôles autoritaires** : patient actif, médecin actif et vérifié, mode, horaires, dates bloquées, adresse principale pour les consultations à domicile, et chevauchement transactionnel avec les rendez-vous `pending_confirmation` ou `confirmed`.

Le serveur renvoie `{id,status:'pending_confirmation'}` après création. Android affiche la confirmation puis permet d'ouvrir le détail ou de revenir à la liste. Anti-double soumission : verrou de requête ; aucune double réservation en cas de doubles tap. Une erreur réseau pendant un POST peut laisser l'issue distante incertaine : vérifier l'agenda personnel avant de resoumettre.

**Conflits** : le backend actuel déclenche `BadRequestException` **HTTP 400** avec le message `This appointment time is no longer available`. Le mapping gère ce cas ainsi que les éventuels HTTP 409, par un message client demandant de sélectionner une autre heure et de rafraîchir. Les erreurs réseau / 403 / 404 restent neutres sans exposer de détails de compte.

## Suivi patient

- `GET /appointments` : liste des rendez-vous du patient uniquement, catégories `pending_confirmation`, `confirmed`, `completed`, `cancelled`, `rejected`, `no_show`, filtres et pull-to-refresh.
- `GET /appointments/:id` : détail accessible uniquement au patient propriétaire, nom et spécialité du médecin, date/fuseau, mode, durée, tarif, motif et statut.
- `PATCH /appointments/:id/status` : **réservé au médecin** (le service backend charge le profil médecin et vérifie la propriété doctorale). Le patient ne dispose **pas d'une action d'annulation fonctionnelle** ni de changement de statut. Ne pas envoyer cette requête depuis l'écran patient.
- Sur retour depuis le détail, `useFocusEffect` recharge la liste depuis l'API, pour refléter les confirmations/rejets. Le même comportement existe sur les autres écrans réactivés.
- Aucun rendez-vous fictif, aucune disponibilité calculée à partir de l'agenda privé du médecin.

## Fichiers

- `src/features/patient/appointment-booking.ts` : validation, conversion de date avec fuseau, correspondance aux horaires publics et messages d'erreur.
- `src/app/patient/medecins/[id]/rendez-vous.tsx` : demande guidée, validation, mode, motif, création et confirmation.
- `src/app/patient/(tabs)/rendez-vous.tsx` : liste et filtres, chargement, erreurs, actualisation.
- `src/app/patient/rendez-vous/[id].tsx` : détail privé et suivi.
- `src/features/patient/appointment-booking.test.mjs` : contrat création, conversions, absence de plages générées, jour bloqué, créneau hors plage, conflits HTTP 400/409, suivi et interdiction des changements de statut côté patient.
- `npm run test:appointments` : script ajouté à `package.json`, lancé par la CI.

## Recette à effectuer sur appareil

```sh
npm ci
npm run typecheck
npm run test:appointments
npm run test:http
npm run test:session
npm run lint
npm run doctor
```

- [ ] Connexion avec un patient actif et un médecin actif vérifié.
- [ ] Jour activé : saisie d'un créneau au sein des horaires réels.
- [ ] Jour bloqué, rendez-vous passé, mode non proposé : refus local et serveur.
- [ ] Conflit transactionnel réel sur un créneau occupé : message HTTP 400 et rechargement de la fiche.
- [ ] Consultation à domicile sans adresse principale : erreur backend correctement présentée.
- [ ] Création réussie : statut `pending_confirmation`, navigation vers détail puis **retour à la liste avec nouveau GET**.
- [ ] Déconnexion/changement de compte, refus 403/404 sur les rendez-vous d'autrui.
- [ ] Changement de statut par le médecin, actualisation et affichage du nouveau statut côté patient.
- [ ] Annonce par TalkBack, grandes polices, Android retour physique, responsive.
- [ ] Confirmation visuelle avec site web responsive.

**Non exécutés en session** : tests d'intégration avec les vrais comptes patient/médecin, création d'un vrai rendez-vous, simulateur Android et comparaison responsive. Les tests unitaires n'établissent pas la disponibilité ou la réussite de l'E2E.
