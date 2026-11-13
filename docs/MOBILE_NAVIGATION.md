# Medilink Android — Carte de navigation (prompt 04)

## Choix techniques

- Expo Router SDK 58 : `Stack` imbriqués, `Stack.Protected` au niveau racine, `NativeTabs` dans les espaces patient et médecin.
- Chemins explicites **/patient**, **/medecin**, **/admin** (plutôt que trois groupes qui exposeraient les mêmes URL `/profil`).
- `src/store/navigation-session.ts` expose un instantané **non authentifié par défaut**. Aucune connexion ni attribution de rôle inventée : ce module est un adaptateur temporaire à brancher sur un utilisateur validé par `GET /auth/profile` lors des prompts 06–07.
- Les gardes côté Expo concernent la navigation et **ne constituent pas de contrôle d'accès à la donnée**. Tous les services sensibles doivent continuer à appeler l'API NestJS protégée par `FirebaseAuthGuard` et, pour l'administration, `AdminGuard`.
- `Stack.Protected` supprime les chemins devenus interdits lorsque la garde change; le retour Android suit les stacks natifs (pas de BackHandler personnalisé pour l'instant).

## Routes publiques / authentification

| Chemin | Fichier | Accès |
| --- | --- | --- |
| `/` | `app/index.tsx` | Public ; renvoie vers la zone du rôle si session authentifiée |
| `/login` | `app/(auth)/login.tsx` | Non authentifié |
| `/register` | `app/(auth)/register.tsx` | Non authentifié |
| `/forgot-password` | `app/(auth)/forgot-password.tsx` | Non authentifié |
| `/aide`, `/contact`, `/privacy`, `/terms` | `app/(public)/*.tsx` | Public |
| `/unauthorized` | `app/unauthorized.tsx` | Public (page informative) |
| route inconnue | `app/+not-found.tsx` | Public |
| `/dev/design-system` | Galerie du prompt 03 | Redirection hors développement |

## Espace patient (rôle `patient`)

Onglets natifs : `/patient`, `/patient/medecins`, `/patient/demandes`, `/patient/rendez-vous`, `/patient/profil`.

Stacks imbriqués : `/patient/medecins/:id`, `/patient/medecins/:id/rendez-vous`, `/patient/demandes/:id`, `/patient/demandes/:id/modifier`, `/patient/rendez-vous/:id`, `/patient/besoins/nouveau`, `/patient/messages`.

## Espace médecin (rôle `doctor`)

Onglets natifs : `/medecin`, `/medecin/besoins`, `/medecin/propositions`, `/medecin/rendez-vous`, `/medecin/profil`.

Stacks imbriqués : `/medecin/besoins/:id`, `/medecin/disponibilites`, `/medecin/messages`, `/medecin/historique`, `/medecin/avis`, `/medecin/zone-intervention`.

## Administration (rôle `admin`)

`/admin` : tableau de bord administratif. `/admin/comptes/:id` : compte et vérification. Stack sans onglets à ce stade.

## Flux de garde et retour Android

1. Au démarrage, session inconnue ou non vérifiée : **aucun écran protégé**. Lors du prompt 07, le statut `loading` devra afficher un écran transitoire avant de résoudre la session stockée; aucune attribution de rôle basée sur URL ou stockage local non vérifié.
2. Invité → demande `/patient`, `/medecin`, `/admin` : écran protégé inaccessible, repli vers l'ancre du stack (accueil public). Le CTA connexion est à `/login`.
3. Authentification vérifiée et rôle patient → `/patient`, médecin → `/medecin`, admin → `/admin`.
4. Rôle patient → chemin médecin/admin : garde invalide, repli vers accueil public, lui-même redirigé vers `/patient`; le backend refuserait de toute manière un appel non autorisé.
5. Déconnexion : le futur service d'auth doit vider les tokens, invalider les données personnelles en cache, passer l'état à `unauthenticated`, puis revenir à l'accueil/connexion sans garder d'écran privé dans l'historique.
6. Android Back suit le stack natif. Les formulaires et confirmations sensibles des prompts suivants devront définir leurs propres protections contre les pertes de saisie.

## État des écrans

Les routes créées dans ce lot contiennent toutes un `RoutePlaceholder` explicitement intitulé « Navigation préparée » : elles **ne prétendent pas** offrir les fonctionnalités métier. Seuls les onglets, stacks et pages d'erreur sont fonctionnellement structurés. Le site de référence responsive est https://medilink-nu-ten.vercel.app/ ; sa lecture interactive n'a pas pu être réalisée dans cet environnement, donc aucune mise en page métier n'a été inventée.

## Scénarios de recette à exécuter sur simulateur Android

| Scénario | Attendu |
| --- | --- |
| Invité : `/`, `/aide`, `/login` | Routes présentes |
| Invité : deep link `/patient/medecins/123` | Retour vers ancre non protégée, sans contenu médecin |
| Invité : deep link `/medecin/disponibilites` | Refus/navigation de repli |
| Invité : deep link `/admin` | Refus/navigation de repli |
| Session patient validée | Accueil patient et cinq onglets |
| Session patient vers `/admin` | Interdit et repli sans boucle |
| Session médecin validée | Accueil médecin et cinq onglets |
| Session admin validée | Espace administration |
| Changement de rôle / déconnexion | Historique privé inaccessible |
| Retour Android depuis un détail | Revient à l'écran parent |
| URL inconnue | Page introuvable |
| Production `/dev/design-system` | Redirection vers `/` |

**Statut de validation** : structure de fichiers contrôlée dans GitHub, mais **scénarios Android non exécutés**. L'installation npm et l'ouverture du site Vercel ont été bloquées par l'environnement. La vérification runtime de boucles et la compilation TypeScript/lint restent à faire sur un runner réseau; ne pas qualifier ces scénarios de réussis.
