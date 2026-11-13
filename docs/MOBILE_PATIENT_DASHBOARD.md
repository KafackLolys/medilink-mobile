# Prompt 09 — Tableau de bord patient Android

## Sources examinées

- Web : `medilink/app/(private)/patient/page.tsx`, `services/need-service.ts`, `appointment-service.ts`, `notification-service.ts`, `message-service.ts`, `hooks/use-auth.ts`.
- NestJS : `src/needs/needs.controller.ts`, `appointments/appointments.controller.ts`, `notifications/notifications.controller.ts`, contrôles d'identité Firebase.
- Mobile : `src/services/{auth,needs,appointments,notifications,messages}.ts`, `src/types/domain.ts`, design system des prompts 03–04.
- Référence responsive : https://medilink-nu-ten.vercel.app/. La navigation interactive n'a pas été possible depuis l'environnement (outil de lecture des onglets indisponible, URL du site inaccessible via le navigateur web de recherche). Le code mobile est **basé sur les composants web**, sans prétendre reproduire une capture responsive authentifiée.

## Données réelles et affichage

| Section | Contrat API protégé | Comportement |
| --- | --- | --- |
| Accueil et profil | `GET /auth/profile` | Prénom uniquement si renvoyé ; lien profil |
| Demandes | `GET /needs` | Demandes actives `published`, `awaiting_proposals`, `proposals_received` et détail de la demande |
| Rendez-vous | `GET /appointments` | `pending_confirmation`, `confirmed`, dates à venir ; le plus proche est affiché |
| Propositions reçues | `GET /needs` | Somme du champ `interested` sur les demandes actives, comme le web ; **pas** un nouveau compteur inventé |
| Notifications | `GET /notifications?page=1&pageSize=5` | Les cinq premières notifications autorisées à l'utilisateur ; pas de liens non contrôlés depuis le `targetUrl` |
| Messages | `GET /messages/conversations` | Maximum deux aperçus si accessibles ; liens vers la section messages existante |
| Médecins | Via l'annuaire protégé `/patient/medecins` | Action rapide ; aucune liste simulée |

Tous les endpoints sont utilisés avec le Bearer token sécurisé du prompt 07. La protection patient Expo Router et les vérifications serveur restent actives. Un autre rôle ne peut pas faire afficher le dashboard patient par simple changement d'URL.

## Ergonomie et états

- Vue verticale Android, safe areas, zone tactile au moins 48 dp, police ajustable et composants Medilink.
- Cartes d'actions rapides, prochain rendez-vous, synthèse, demandes, messages et notifications.
- Pull-to-refresh via `RefreshControl`, requêtes indépendantes pour chaque source, chargements progressifs.
- Annulation lors du départ de l'écran, jeton de génération contre les réponses tardives.
- **Source en erreur = compteur « — », pas zéro**. Une liste vide ayant répondu avec succès affiche un état vide explicite.
- Les notifications ne déclenchent pas automatiquement une URL fournie par le serveur; la navigation interne sécurisée sera définie avec le module notifications.
- Pas de donnée médicale fictive, pas de calcul de disponibilité ni de rendez-vous réservable côté téléphone.
- Le tableau de bord ne stocke pas de données patient de manière persistante ; l'état en mémoire du composant est détruit quand l'écran est retiré.

## Tests

`src/features/patient/dashboard-model.ts` réalise les agrégations de l'écran.

`src/features/patient/dashboard-model.test.mjs` vérifie :
- les compteurs inconnus pour des sources en erreur ;
- les zéros réels pour des tableaux vides renvoyés ;
- les catégories de demandes actives et la somme `interested` ;
- les rendez-vous futurs, triés du plus proche au plus éloigné, excluant dates invalides et rendez-vous clôturés ;
- le formatage de la date Africa/Douala.

Exécuter `npm ci && npm run typecheck && npm run test:patient`, puis les autres tests et le lint/Expo Doctor. GitHub Actions exécute déjà les tests précédents et intègre désormais le test patient.

## Recette sur le compte patient autorisé

- [ ] Connexion réelle du compte patient fourni en dehors du dépôt.
- [ ] Vérification des cinq réponses authentifiées, comparaison avec le web au même instant.
- [ ] Rendez-vous futur et demandes actives correctement triés/filtrés.
- [ ] Pull-to-refresh après modification de données backend.
- [ ] Réseau coupé : messages d'erreur distincts, aucune statistique fictive.
- [ ] Absence de données : états vides cohérents.
- [ ] Un utilisateur médecin ou admin ne peut pas ouvrir la route patient, y compris via deep link.
- [ ] Déconnexion et changement de compte ne montrent pas les données de l'ancien utilisateur.
- [ ] Comparaison visuelle sur 360/390/430 dp, grands caractères et TalkBack.

**Important** : le test de connexion réelle avec le compte patient n'a pas pu être exécuté depuis la présente session, faute de navigateur Android interactif et d'accès réseau exécutable aux endpoints privés. Aucun identifiant de test n'est inséré dans le dépôt ni dans la CI. La réussite des tests unitaires **ne prouve pas** la réussite de la recette authentifiée.
