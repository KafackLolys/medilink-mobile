# Prompt 22 — Géolocalisation et zones d’intervention

## Audit des sources réellement disponibles

Sources web : `app/(private)/components/doctors-map.tsx`, `geo-map.tsx`, `app/(private)/medecin/zone-intervention/page.tsx`, `services/integration-service.ts`.

Sources NestJS : `src/doctors/doctors.service.ts`, `src/doctors/doctor-search.ts`, `src/integration/integration.controller.ts`, `src/integration/integration.service.ts`.

### Périmètre fonctionnel constaté

- `GET /doctors?q&specialty&city` recherche des profils médecins **vérifiés et actifs** ; filtre `city` sur les valeurs publiques `serviceCity`, `serviceDistricts` et `professionalAddress`, avec normalisation de la casse et des accents. `q`, `specialty` et `city` acceptent chacun 100 caractères maximum. **Pas de paramètres latitude/longitude, distance GPS ni de pagination**.
- `GET /integration/doctor/zone` charge pour le médecin authentifié sa ville, la liste des quartiers, un rayon d'intervention et une distance maximale. Valeurs par défaut backend : ville vide, quartiers vides, 10 et 25 km.
- `PUT /integration/doctor/zone` sauvegarde **seulement** `{city,districts,radiusKm,maxDistanceKm}` :
  - ville obligatoire, de 1 à 100 caractères ;
  - `districts` tableau d'au plus 40 éléments, chacun non vide et de 100 caractères maximum ;
  - `radiusKm` entier de 1 à 250 ;
  - `maxDistanceKm` entier de 1 à 500, supérieur ou égal au rayon.
- Le backend `IntegrationService.assertRole` refuse les utilisateurs autres que `doctor` ou suspendus/supprimés, et stocke la zone sous **l'UID Firebase du médecin**. L'application vérifie également le rôle.
- La carte web Leaflet ne place de marqueur **que pour des coordonnées déjà retournées par l'API**, validées entre −90/+90 latitude et −180/+180 longitude. **Les objets actuels de `GET /doctors` n'incluent aucun champ `coordinates`** : les cartes ne possèdent donc pas de marqueurs positionnables. Aucun géocodage de nom de ville, aucun positionnement inventé.

## Implémentation Android

- `src/app/medecin/zone-intervention.tsx` remplace l'ancien placeholder par une vraie page React Native : ville, ajout et retrait de quartiers, rayon et distance maximale, sauvegarde via `PUT /integration/doctor/zone`, réponse confirmée et relecture serveur. Chargement, erreurs, rafraîchissement et protection contre les retours de requêtes après sortie de page ou changement de compte.
- `src/features/geo/doctor-zone-model.ts` : parseur strict de la réponse backend, validations exactes, contrôle des 40 quartiers, détection de doublons insensible aux accents et à la casse, fonctions de vérification des coordonnées.
- `src/app/patient/(tabs)/medecins.tsx` : l'annuaire natif existant reste la **solution de repli principale**. Les filtres manuels `q`, `specialty`, `city` continuent d'utiliser le serveur ; un texte explique que ni GPS ni carte précise ne sont actuellement nécessaires ou possibles.
- **Aucune permission Android GPS demandée** (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`), pas de `expo-location` ajouté, aucun suivi permanent, aucune donnée de localisation d'un patient conservée. Même avec la permission accordée, le backend ne propose aucun endpoint permettant d'exploiter utilement un point GPS personnel pour la recherche.
- Le rayon en kilomètres est **une préférence métier déclarée**, pas une distance mesurée entre le téléphone et les médecins. On ne calcule aucun classement de proximité ni de distance tant que les coordonnées géographiques validées et le contrat de calcul ne sont pas disponibles.
- La carte native avec marqueurs géolocalisés reste **non activée**, plutôt que d'utiliser des coordonnées de ville approximatives présentées comme celles d'un professionnel. La liste des médecins permet toujours de consulter une fiche et de poursuivre la réservation.

## Confidentialité

- `GET /doctors` ne renvoie que les champs publics de profils validés ; pas de coordonnées des patients, d'adresses médicales privées ou d'historique de trajets.
- Le `PUT` n'envoie jamais les coordonnées du téléphone : uniquement les quatre champs attendus par NestJS. L'identifiant du propriétaire est dérivé par l'API de l'authentification, pas du formulaire.
- Aucune permission n'est demandée à l'ouverture de l'annuaire ; refus ou indisponibilité du GPS **n'ont aucun impact sur le filtrage manuel**.
- Les coordonnées éventuellement disponibles lors d'une future évolution API doivent satisfaire `Number.isFinite(latitude/longitude)`, les bornes terrestres et une autorisation d'exposition publique. Les tests vérifient que des valeurs manquantes, hors plage ou non numériques ne génèrent pas de marqueurs.

## Tests automatisés

`npm run test:geo` exécute `src/features/geo/doctor-zone-model.test.mjs`, ajouté à `npm run check` et à GitHub Actions. Couverture : mapping du GET, format exact du PUT, limites de ville/quartiers, rayons et distances, dédoublonnage, rejet de coordonnées invalides, absence de faux marqueurs et erreurs non divulguantes.

```sh
npm ci
npm run typecheck
npm run test:geo
npm run lint
npm run doctor
```

## Recette manuelle sur Android restant à effectuer

- [ ] Médecin authentifié : charger, modifier, enregistrer puis recharger la zone réelle.
- [ ] Refuser villes vides et >100 caractères, plus de 40 quartiers, doublons, distances fractionnaires, rayon >250 ou maximum inférieur au rayon.
- [ ] Vérifier que patient/admin ne peuvent lire ni modifier les zones d'un médecin.
- [ ] Annuaire patient : rechercher une ville avec et sans accent, puis un quartier, puis spécialité + ville ; vérifier que les résultats proviennent de `GET /doctors`.
- [ ] Refuser/retirer toute permission GPS Android : l'annuaire et la gestion de zone doivent continuer de fonctionner.
- [ ] Aucun marqueur précis, aucune géolocalisation implicite ni distance fictive.
- [ ] Tester retour écran/changement de compte lors de la sauvegarde pour prévenir toute fuite intercomptes.
- [ ] Vérifier petites polices, TalkBack, petits écrans et l'identité visuelle du web authentifié.

**Limites :** pas de test instrumenté sur appareil Android dans cette session ; le backend actuel ne fournit pas les coordonnées professionnelles vérifiées permettant une véritable carte géographique. Ne pas annoncer un support GPS inexistant.
