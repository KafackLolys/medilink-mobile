# Medilink Android — Architecture de référence et plan de portage

Établi le 2026-11-13 lors du prompt 01. Voir [MOBILE_PARITY_MATRIX.md](./MOBILE_PARITY_MATRIX.md) pour les routes, pages et critères d'acceptation.

## Périmètre et contraintes vérifiées

- Web : Next.js 16, React 19, TypeScript, Firebase, Zustand; pages publiques, patient, médecin, admin; couche client `routes/*`, `services/*`, `hooks/*`.
- Backend : NestJS 12, Firebase Admin/Firestore via `FirebaseService`, `FirebaseAuthGuard`, `AdminGuard`, modules auth, doctors, patients, needs, appointments, availabilities, messages, notifications, admin, integration; `src/interfaces/database.ts` est le référentiel modèle initial.
- Mobile actuel : Expo SDK 58, React Native 0.88.1, React 19.3.0, Expo Router sous `src/app`, Zustand, `lucide-react-native`, composants génériques de starter. Pas de parcours métiers implémentés.
- Le site de référence responsive avant **chaque** écran est https://medilink-nu-ten.vercel.app/ . Les accès de test sont communiqués séparément et **ne doivent jamais entrer dans Git, docs ou logs**.
- Le nom « Medihome / MedLink » est présent dans le contexte d'un onglet local : vérifier la marque finale au lieu d'inférer un redesign.

## Architecture logique

```text
React Native / Expo Android
  Expo Router: (public), (auth), (patient), (doctor), (admin)
       |
  UI et features: écrans + composants natifs / hooks de domaine
       |
  State: session sécurisée, caches de requêtes et préférences non sensibles
       |
  Services typés: auth, doctors, patients, needs, appointments,
                  availability, messaging, notifications, admin, integration
       |
  Transport HTTP: base URL configurable, bearer, refresh unique,
                  JSON/multipart, erreurs et invalidation
       |
  API NestJS existante → gardes et services → Firebase
```

Une seule source de vérité métier : **l'API NestJS**, pas des mocks de production ni des calculs autonomes divergents du web. Garder les règles d'autorisation, collisions de rendez-vous, indisponibilités et transitions de statut côté serveur.

## Organisation proposée, à appliquer au prompt 02 uniquement

```text
src/
  app/
    _layout.tsx
    (public)/...
    (auth)/...
    (patient)/...
    (doctor)/...
    (admin)/...
  components/ui/...
  features/
    auth/ doctors/ patients/ needs/ appointments/
    availability/ messages/ notifications/ admin/
  services/
    api-client.ts
    auth.ts
    doctors.ts
    patients.ts
    needs.ts
    appointments.ts
    availabilities.ts
    messages.ts
    notifications.ts
    admin.ts
  store/
    session.ts
  hooks/
  types/
  constants/
  utils/
assets/
docs/
```

Les dossiers et routes ci-dessus sont **proposés**, pas créés par le prompt 01. Les fichiers autres que ces deux documents restent inchangés.

## Contrats client à respecter

1. **Configuration :** `EXPO_PUBLIC_API_BASE_URL` contient une URL HTTPS de backend pour preview/production. La valeur web `http://localhost:3000` ne fonctionne pas sur téléphone et ne doit pas être la valeur par défaut en build de distribution. Isoler les environnements et valider la présence de la variable au démarrage.
2. **Auth :** se baser sur `POST /auth/login` renvoyant `user`, `idToken`, `refreshToken`, `expiresIn`, `tokenType`; `POST /auth/refresh`; `GET /auth/profile`; `POST /auth/logout`. Examiner `src/auth/auth.service.ts` pour la forme exacte et les effets de révocation.
3. **Stockage :** tokens dans une solution sécurisée compatible Expo SDK 58 (vérifier la doc versionnée avant installation), jamais en AsyncStorage non chiffré, ni en log. Nettoyage complet à la déconnexion et au changement de compte. Gestion des 401 par un refresh single-flight et une seule relance idempotente.
4. **Rôles :** `patient`, `doctor`, `admin`; redirection seulement après validation du profil. Les protections UI ne remplacent jamais `FirebaseAuthGuard` et `AdminGuard`.
5. **Transport :** `fetch` typé ou client équivalent compatible React Native, erreurs normalisées, `AbortController`, délai raisonnable, `FormData` sans écrasement manuel de son boundary; traiter 204 avec corps vide.
6. **Modèles :** ne pas recopier aveuglément `lib/database.ts` côté web. Dériver les interfaces de requête/réponse des contrôleurs et services NestJS, puis documenter les différences. Aucun DTO OpenAPI automatique n'est établi par le code inspecté.
7. **Rendez-vous :** `CreateAppointmentRequest` = `doctorId: string`, `scheduledAt: string`, `timeZone: string`, `consultationMode: ConsultationMode`, `reason?: string`. Le service refuse les dates passées, modes non offerts, médecins non vérifiés/inactifs, hors semaine, jours bloqués, créneaux ne pouvant contenir toute la durée; vérifier collisions et restrictions supplémentaires dans le reste du service. Le client ne peut prédire définitivement l'acceptation serveur.
8. **Docs :** upload médecin/patient en champ `file`, max contrôleur 10 Mo; demande médicale en `data` + `files`, max 5 fichiers de 10 Mo. Ne pas exposer de fichiers médicaux dans des caches persistants non sécurisés.
9. **Push :** confirmer la compatibilité du token mobile avec `notifications.service.ts` et Expo/Firebase avant toute intégration. Un token Expo ne se substitue pas automatiquement à un token FCM.
10. **Temps :** afficher les heures dans le fuseau local, convertir explicitement vers les instants et fuseaux IANA exigés par le backend. Construire les créneaux à partir des règles vérifiées ou d'un endpoint dédié s'il est ajouté après audit, jamais par fiction UI.

## Portail de revue responsive AVANT toute page

Pour chaque écran mobile **avant d'écrire le JSX** :
1. Ouvrir https://medilink-nu-ten.vercel.app/ et naviguer avec le rôle de test approprié (patient, doctor, admin); les secrets restent hors code et documentation.
2. Tester les largeurs **360, 390, 430 px** en portrait (puis contrôles clavier et grands textes), photographier/capturer la référence **sans informations privées** si l'outil le permet.
3. Inventorier hiérarchie visuelle, actions principales, onglets, modales, états vides/chargement/erreur, validations et droits visibles.
4. Comparer à la page Next.js + aux hooks/services/contrôleurs. Documenter les écarts avant de concevoir un composant Android tactile et accessible.
5. Si la navigation ou le viewport réel sont indisponibles, marquer « revue responsive non exécutée », ne jamais prétendre avoir testé; continuer avec la source du web, mais exiger le test avant l'approbation UX de l'écran.

**Audit actuel :** l'outil web n'a pas pu charger le déploiement Vercel. Un onglet navigateur local affichait la page de disponibilités médecin (jours de semaine, durée, blocages, prochains rendez-vous); cela ne constitue pas une validation du responsive du site déployé.

## Stratégie de tests et sécurité

- Unitaire : sérialisation des contrats, parse erreurs/204, auth et refresh concurrent, timezone/validations UI, mapping des statuts.
- Intégration : scénarios patient/doctor/admin sur environnement **de test**, en protégeant les comptes et documents; ne pas déclencher de mutations contre des données réelles sans nécessité explicite.
- E2E Android : comptes de test séparés, connexion, recherche médecin, besoin, rendez-vous, disponibilité/blocage, messages, documents, push, isolation des rôles.
- Qualité à chaque lot : `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` si pertinent, tests, et build de développement sur émulateur/téléphone lorsque possible. Ne pas déclarer « vert » sans exécution prouvée.
- Sécurité : HTTPS, stockage sécurisé, contrôles backend, permission minimale, pas de données médicales dans le journal, pas de secrets committés, évitement du cache persistant des documents de santé.
- Aucune nouvelle fonctionnalité médicale, recommandation clinique ou téléconsultation en direct non étayée par le backend ne doit être inventée.

## Risques classés

| Priorité | Risque | Action avant portage |
| --- | --- | --- |
| Critique | Absence de preuve d'un endpoint de créneaux consultables par le patient; validation stricte côté création | Audit de la fiche et du formulaire de réservation web, règles d'intervention et disponibilités; définir l'écart exact |
| Élevée | Site distant et vue responsive non testés dans ce contexte | Accès navigateur interactif/Playwright ou capture de test sûre avant toute approbation de page |
| Élevée | Auth/session fondées sur navigateur dans le web | Adapter token sécurisé et refresh atomique à React Native |
| Élevée | Données de santé et uploads | Tests d'autorisation et stratégie de cache éphémère |
| Élevée | Contrats non normalisés/DTO dispersés | Inspecter chaque service avant de coder le feature correspondant |
| Moyenne | Ambiguïté de marque Medilink / Medihome / MedLink | Valider les assets, textes et thème de référence |
| Moyenne | Modules natifs Expo incompatibles avec SDK 58 | Vérifier la documentation versionnée et installer via `npx expo install` |
| Moyenne | Erreurs de déploiement API NestJS ESM signalées | Vérifier la route réelle du backend et le runtime de production avant les tests mobiles |
| Moyenne | Évolutions serveur parallèles | Synchroniser la matrice et les types au début de chaque lot |

## Plan d'implémentation incrémental

1. **Prompt 01** : audit de code, matrice et architecture (ce lot documentaire).
2. **02–05** : hygiene Expo, design system, navigation rôle, transport HTTP et contrats.
3. **06–08** : auth/login/register, stockage sécurisé, récupération mot de passe et onboarding.
4. **09–14** : accueil patient, médecins, profil, besoins, rendez-vous, dossier.
5. **15–18** : accueil médecin, besoins/propositions, disponibilités, profil professionnel.
6. **19–25** : messagerie, notifications/push, documents, cartes, avis, admin, résilience.
7. **26–30** : UX, tests, confidentialité, APK/AAB et recette finale.

## Définition de terminé

Une étape est terminée si : les références web et API ont été revérifiées; la revue responsive a été réellement effectuée ou notée bloquée; le code natif et ses tests sont cohérents; les données affichées sont réelles; les rôles restent contrôlés côté serveur; un compte rendu indique commandes exécutées, résultats, limitations, fichiers touchés et lien de commit/PR.

## État de cet audit

- **Réalisé** : inventaire des arbres de trois repos, examen des principaux contrôleurs NestJS et des fichiers de routes HTTP web, aperçu du template mobile, contrôle partiel du service de création de rendez-vous, lecture textuelle d'une page médecin locale.
- **Non réalisé** : navigation interactive vers le site Vercel, connexion avec comptes fournis, test viewport responsive, exécution locale de builds/tests ou audit ligne par ligne des 73+153+54 fichiers.
- **Modifications** : documentation uniquement dans une branche mobile dédiée; aucune modification de code ou de données.
