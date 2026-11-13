# Prompt 17 — Agenda et disponibilités du médecin

## Contrats réellement analysés

Sources web : `app/(private)/medecin/disponibilites/page.tsx`, `app/(private)/medecin/rendez-vous/page.tsx` et hooks/services associés.

Sources NestJS : `src/availabilities/availabilities.controller.ts`, `availabilities.service.ts`, `src/appointments/appointments.controller.ts`, `appointments.service.ts`.

Routes Android :
- `/medecin/disponibilites` : interface React Native avec sélecteur de date calendaire et sélecteur d'heure à précision minute ;
- `/medecin/rendez-vous` : agenda médecin du véritable backend, filtres de statut, actualisation, confirmation des changements.

Les deux écrans sont **protégés par le rôle doctor** fourni par le gestionnaire de session. Les endpoints NestJS vérifient l'identité et le propriétaire du profil professionnel : aucune lecture de rendez-vous du patient ou d'un autre médecin.

## Endpoints de disponibilité

| Endpoint | Contrat et implémentation |
| --- | --- |
| `GET /availabilities/me/modes` | Liste des modes configurés, sans valeur inventée |
| `PUT /availabilities/me/modes` | `{ modes: ['home'] }`, `['teleconsultation']` ou les deux, valeurs distinctes ; **au moins un mode** |
| `GET /availabilities/me/duration` | `{durationMinutes}` |
| `PATCH /availabilities/me/duration` | Entier parmi **15, 20, 30, 45, 60** uniquement |
| `GET /availabilities/me/weekly` | Tableau complet des 7 jours, même si la base ne contient pas encore les lignes (backend retourne des lignes désactivées par défaut) |
| `PUT /availabilities/me/weekly` | **Remplacement de tout le calendrier hebdomadaire**, pas un PATCH par jour. Envoi de 7 objets `{weekday,isAvailable,startTime,endTime}` |
| `GET /availabilities/me/blocked` | Liste réelle des dates bloquées `{id,date,label,reason}` |
| `POST /availabilities/me/blocked` | `{date:'YYYY-MM-DD',reason?}` ; refuse les dates déjà bloquées |
| `DELETE /availabilities/me/blocked/:id` | Suppression avec l'ID réel, vérification du propriétaire médecin |
| `GET /availabilities/me/appointments` | **Seulement les 4 prochains rendez-vous confirmés** ; non utilisé comme liste de tous les rendez-vous |

Pour les horaires hebdomadaires, le backend exige pour chaque jour activé une heure de début strictement antérieure à la fin. Le client vérifie également le format `HH:mm` en 24 h. Les jours désactivés sont conservés dans le `PUT` et permettent de supprimer une plage active, puisque le contrat ne fournit **aucun DELETE individuel des horaires**.

Les réglages (modes, durée, semaine) ont leurs **boutons d'enregistrement séparés** pour éviter un succès partiel des trois endpoints en cas de panne. Chaque modification réussie relit les données du serveur ; aucune sauvegarde optimiste n'est simulée.

### Dates bloquées et conflits

Le backend permet d'ajouter/supprimer une date bloquée mais ne vérifie pas, lors du blocage, les rendez-vous déjà confirmés. L'écran avertit donc de vérifier l'agenda : **bloquer une date n'annule pas automatiquement un rendez-vous existant**.

Le serveur refuse la création d'une date déjà bloquée. Le client effectue une pré-validation et remonte un message neutre en cas d'erreur serveur. Retirer une date exige une confirmation. Il n'existe pas de route PATCH d'une date bloquée : pour changer son motif, il faut la supprimer puis en créer une nouvelle (deux opérations réelles distinctes).

**Les disponibilités hebdomadaires ne constituent pas un inventaire de créneaux libres** : NestJS vérifie les rendez-vous déjà pris et les chevauchements seulement à la réservation. Les horaires affichés sont ceux retournés par le serveur, sans génération de créneaux artificiels.

## Agenda et transitions

`GET /appointments/doctor` retourne la liste du médecin authentifié, y compris ses statuts :
`pending_confirmation`, `confirmed`, `completed`, `cancelled`, `rejected`, `no_show`.

`PATCH /appointments/:id/status` reçoit `{status}` et retourne `{id,status}`. **Le backend vérifie le propriétaire et l'appartenance du statut à l'enum, mais ne possède aucune matrice de transitions entre états.** Le mobile ne prétend donc pas qu'une transition limitée supplémentaire serait imposée côté serveur. L'interface affiche une confirmation explicite et ne déclare le changement réussi qu'après comparaison des identifiants et du statut dans la réponse. Après réussite ou erreur, elle rafraîchit l'agenda.

Point de vigilance : le backend retourne `date: YYYY-MM-DD` et `time: HH:mm` dans `GET /appointments/doctor`, sans l'offset UTC ou la zone IANA. L'application affiche ces chaînes **sans conversion arbitraire**, pour éviter le décalage d'un rendez-vous. Les améliorations futures côté API devraient renvoyer `scheduledAt` en ISO UTC et la zone de référence. Le formateur `consultationClock` permet les conversions explicites des ISO horodatés quand disponibles.

La liste de l'agenda est distincte de `GET /availabilities/me/appointments`, lequel renvoie quatre rendez-vous confirmés uniquement, ce qui serait insuffisant pour le suivi des statuts.

## Implémentation

- `src/features/doctor/doctor-agenda.ts` : modèles/validations hebdomadaires, durées, modes, jours calendaires, dates bloquées, lecture des rendez-vous et statuts autorisés par NestJS.
- `src/components/doctor/date-time-pickers.tsx` : sélecteur natif de date à grille mensuelle (calendrier) et sélecteur d'heure précis à la minute, avec modal Android, sans nouvelle dépendance native.
- `src/app/medecin/disponibilites.tsx` : édition de l'horaire complet, changement de durée/mode, ajout et suppression confirmée des dates bloquées, relecture API.
- `src/app/medecin/(tabs)/rendez-vous.tsx` : agenda réel, statuts, filtre, confirmation de modification, relecture API.
- `src/features/doctor/doctor-agenda.test.mjs` : création/modification/désactivation hebdomadaire (PUT), modes/durées, validation date et doublon bloqué, propriété des données de rendez-vous, statuts et erreurs sûres.
- `npm run test:doctor-agenda`, intégré à `npm run check` et au workflow GitHub Actions.

## Recette à exécuter sur Android

```bash
npm ci
npm run typecheck
npm run test:doctor-agenda
npm run lint
npm run doctor
```

- [ ] Médecin connecté : lecture des modes/durée/horaires/dates bloquées réels.
- [ ] Créer une plage active, l'enregistrer, relire, modifier son heure puis désactiver le jour.
- [ ] Vérifier l'enregistrement complet des sept jours sans écraser un autre champ.
- [ ] Modifier la durée par 15,20,30,45,60 ; rejeter les autres valeurs.
- [ ] Tenter 0 mode ; refuser, puis enregistrer un/tous les modes autorisés.
- [ ] Date bloquée nouvelle : créer et relire, tenter un doublon, supprimer après confirmation.
- [ ] Rendez-vous déjà confirmé au jour bloqué : vérifier que la consultation existante n'est pas annulée implicitement.
- [ ] Lire l'agenda complet du médecin, sélectionner un filtre de statut, actualiser.
- [ ] Modifier un statut sur son rendez-vous, vérifier la réponse et le nouveau GET.
- [ ] Tenter d'accéder au rendez-vous d'un autre médecin : refus backend.
- [ ] Retour d'un écran, changement de compte, panne réseau et double tap.
- [ ] Contrôler la date/heure sur téléphone en zones IANA différentes et sur DST (selon le pays).
- [ ] Vérifier TalkBack, petits écrans, grandes polices et la référence web responsive.

**Limites :** CI TypeScript et tests unitaires ne prouvent pas que l'édition Firestore et les confirmations de rendez-vous fonctionnent de bout en bout. Test Android réel et comparaison authentifiée avec Vercel restent nécessaires. PR non fusionnée.
