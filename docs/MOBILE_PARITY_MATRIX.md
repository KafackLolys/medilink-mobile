# MEDILINK — Matrice finale de parité Web / API / Android

**Audit de clôture des prompts 29–30 — 13 novembre 2026.** La matrice initiale du prompt 01 (qui indiquait encore « Mobile absent » partout) est désormais **remplacée** par l'état vérifié des sources. Dépôts : [web](https://github.com/KafackLolys/medilink) (`main`), [API](https://github.com/KafackLolys/medilink-api) (`main`), [Android](https://github.com/KafackLolys/medilink-mobile) (`docs/mobile-audit-parity-2026-11-13`, PR [#4](https://github.com/KafackLolys/medilink-mobile/pull/4) ouverte en brouillon).

## Méthodologie et niveaux de preuve

**Inspecté :** code Next.js et services web, contrôleurs/services NestJS, écrans Expo Router et services HTTP Android. Pour les contrats, voir également les audits détaillés dans `docs/MOBILE_*.md`.

**Statuts :**
- **I** : implémentation mobile présente avec endpoint/API réel et tests unitaires/contrat ; **ne signifie PAS fonctionnellement testé sur téléphone**.
- **P** : portage partiel ou limitations métier/UX non résolues.
- **D** : explicitement différé / réservé au web.
- **B** : bloqué pour qualification de release.
- **E2E : NON** pour **toutes les lignes** : aucun test complet authentifié web↔API↔appareil Android avec patient, médecin et administrateur n'a été exécuté dans cette session. N'utiliser aucune coche « acceptée » sans cette preuve.

Les tests mobiles `node --test` utilisent principalement des modèles/parseurs et faux clients HTTP : ils constituent des **preuves de logique et de compilation**, non des preuves de réponses production ni des appels Firebase réels. Les tests GitHub Actions des dépôts **web et API** n'ont pas été trouvés (historique `actions/runs` vide au moment de la requête). L'absence d'un run ne prouve pas que ces logiciels échouent, mais interdit d'affirmer qu'ils passent un pipeline aujourd'hui.

## Matrice détaillée

| ID | Parcours web / référence | Contrat backend | Android / preuve dans le code | État et réserve |
| --- | --- | --- | --- | --- |
| P01 | Accueil public `app/(puclic)/page` | `GET /doctors` authentifié pour la recherche | `src/app/index.tsx`, CTA de connexion/inscription | **P** : introduction native, pas copie des recommandations publiques dynamiques |
| P02 | Aide, contact, confidentialité, conditions d’utilisation | `POST /integration/contact` si utilisé | `src/app/(public)/aide.tsx`, `contact.tsx`, `privacy.tsx`, `terms.tsx` | **B** : écrans encore `RoutePlaceholder`, contenus légaux et contact non livrés |
| A01 | Connexion et inscription patient/médecin | `POST /auth/login`, `POST /auth/register` | `src/app/(auth)/login.tsx`, `register.tsx`; tests `test:auth`, `test:onboarding` | **I**, E2E login/rôle à faire |
| A02 | Session, rôle, statut du compte, expiration | `GET /auth/profile`, `POST /auth/refresh`, `POST /auth/logout`; gardes Firebase | `src/features/auth/session.ts`, `session-manager.ts`, SecureStore, `Stack.Protected`; `test:session` | **I**, session réelle et révocation à vérifier |
| A03 | Récupération de mot de passe | `POST /auth/reset-password` | `src/app/(auth)/forgot-password.tsx` | **I**, e-mails non vérifiés ici |
| P03 | Tableau de bord patient `patient/page.tsx` | `/auth/profile`, `/needs`, `/appointments`, notifications, messages | `patient/(tabs)/index.tsx`, `test:patient` | **I**, états réels sans KPI fictifs |
| P04 | Recherche et annuaire `patient/medecins` | `GET /doctors?q&city&specialty` | `patient/(tabs)/medecins.tsx`, `test:doctors`, cache public RAM | **I**, pas de pagination/coordonnées géographiques API |
| P05 | Fiche médecin et notes `patient/medecins/[id]` | `GET /doctors/:id` ; notes publiques autorisées | `patient/medecins/[id]/index.tsx`, `test:doctor-profile` | **I**, sans documents professionnels privés |
| P06 | Création d’un besoin médical | `POST /needs` multipart, 5 fichiers au plus de 10 Mo | `patient/besoins/nouveau.tsx`, `test:needs` | **I**, upload Android `content://` à tester sur appareil |
| P07 | Demandes : liste, détail, édition, clôture, suppression | `GET/PATCH/DELETE /needs`, `PATCH /needs/:id/close` | `patient/(tabs)/demandes.tsx`, `patient/demandes/[id]/*`, `test:needs` | **I**, transitions selon statut serveur |
| P08 | Choix de consultation et réservation | `POST /appointments`, validations semaine, blocage, collision | `patient/medecins/[id]/rendez-vous.tsx`, `test:appointments` | **P** : plages déduites des règles hebdomadaires, **aucune disponibilité temps réel publique** ; l'API confirme/rejette en dernier ressort |
| P09 | Rendez-vous patient : liste/détail | `GET /appointments`, `GET /appointments/:id` | `patient/(tabs)/rendez-vous.tsx`, `patient/rendez-vous/[id].tsx` | **I**, statut patient en lecture seule si backend le prescrit |
| P10 | Avis patient après consultation | `GET/POST /appointments/:id/review`, `completed` et un seul avis | `features/reviews/patient-appointment-review.tsx`, `test:reviews` | **I**, doublons concurrents à rejouer en E2E |
| P11 | Profil, conditions et antécédents patient | `GET /auth/profile`, `PATCH /integration/patient/profile`, `GET /patients/me/conditions` | `patient/(tabs)/profil.tsx`, `test:patient-profile` | **I**, antécédents affichés avec contrôle d'accès, champs éditables seulement si backend |
| P12 | Documents patient `patient-documents-manager` | `GET/POST/DELETE /patients/me/documents` | `patient/(tabs)/profil.tsx`, `features/documents`, `test:documents` | **P/B sécurité** : le backend patient ne valide pas les signatures de contenu comme le backend médecin ; recette upload/preview requis |
| P13 | Messages patient | `GET /messages/conversations`, `GET/POST /messages/conversations/:id` | `patient/messages.tsx` et `features/messaging`, `test:messaging` | **I**, polling HTTP, pas de WebSocket ni pièces jointes fictives |
| P14 | Historique consultations patient | `GET /appointments` avec statuts `completed` | `patient/historique.tsx` | **I**, compteur non inventé |
| D01 | Dashboard médecin `medecin/page.tsx` | `/doctors/me`, `/needs/doctor`, `/appointments/doctor`, messages, disponibilités | `medecin/(tabs)/index.tsx`, `test:doctor-dashboard` | **I**, KPI issus de l'API seulement |
| D02 | Besoins accessibles et détail | `GET /needs/doctor`, `GET /needs/doctor/:id` | `medecin/(tabs)/besoins.tsx`, `medecin/besoins/[id].tsx`, `test:doctor-needs` | **I**, médecin vérifié requis pour certaines opérations |
| D03 | Propositions / annulations | `GET /needs/doctor/proposals`, `POST /needs/doctor/:id/proposals`, `PATCH /needs/doctor/proposals/:id/cancel` | `medecin/(tabs)/propositions.tsx`, `test:doctor-needs` | **I**, aucun replay de POST |
| D04 | Rendez-vous et statuts médecin | `GET /appointments/doctor`, `PATCH /appointments/:id/status` | `medecin/(tabs)/rendez-vous.tsx`, `test:doctor-agenda` | **I**, actions exactes selon statut serveur |
| D05 | Horaires et durée | `GET/PUT /availabilities/me/weekly`, `GET/PATCH /availabilities/me/duration` | `medecin/disponibilites.tsx`, `test:doctor-agenda` | **I**, horaires/contraintes serveur |
| D06 | Plages bloquées | `GET/POST /availabilities/me/blocked`, `DELETE /availabilities/me/blocked/:id` | `medecin/disponibilites.tsx`, `test:doctor-agenda` | **I**, création/suppression non E2E |
| D07 | Profil professionnel et justificatifs | `GET/PATCH /doctors/me`, `POST/DELETE /doctors/me/documents` | `medecin/(tabs)/profil.tsx`, `test:doctor-profile-edit`, `test:documents` | **I**, spécialité et matricule **non éditables** sans endpoint |
| D08 | Zones d’intervention | `GET/PUT /integration/doctor/zone` | `medecin/zone-intervention.tsx`, `test:geo` | **I**, ville/quartiers/rayon déclarés sans GPS |
| D09 | Avis reçus | `GET /doctors/me/reviews` | `medecin/avis.tsx`, `test:reviews` | **I**, notes/répartition prises telles quelles du backend |
| D10 | Historique médecin | `GET /appointments/doctor` | `medecin/historique.tsx` | **I**, consultations terminées, pas de revenus fictifs |
| D11 | Messages médecin | API messages partagée | `medecin/messages.tsx` et `features/messaging` | **I**, isolation compte |
| T01 | Centre de notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | `patient/notifications.tsx`, `medecin/notifications.tsx`, `test:notifications` | **I**, compteur serveur |
| T02 | Push natifs Android | `POST /notifications/devices`, `POST /notifications/devices/:id/unregister` ; Firebase Admin FCM | `features/notifications/push-device.ts`, `push-lifecycle.tsx` | **B** : **APK + projet Firebase Android réels requis** avant validation |
| T03 | Carte géographique / GPS | Annuaire sans lat/long publiées ; zones sans géocodage | `patient/(tabs)/medecins.tsx` liste et recherche manuelle | **D** : pas de fausse carte ni permission GPS ; attente coordonnées fiables/API |
| T04 | Résilience réseau et cache | GET public médecins, autres mutations API réelles | `features/network`, `test:network` | **I**, cache **RAM limité** au répertoire public, pas de données médicales |
| X01 | Admin : comptes/statuts | `GET /admin/accounts`, `PATCH /admin/accounts/:id/status`, `FirebaseAuthGuard + AdminGuard` | `admin/index.tsx`, `test:admin` | **I**, pas de tests réels sur admin actif |
| X02 | Admin : vérification | `PATCH /admin/accounts/:id/verification` | `admin/index.tsx`, doubles confirmations | **I**, risque de désynchronisation Firebase 503 consigné |
| X03 | Création d'admin et détail compte individuel | `POST /admin/admins` ; web admin détaillé | `admin/comptes/[id].tsx` demeure placeholder | **D/P** : création admin **web uniquement** (mot de passe provisoire) ; détail séparé non porté, les états essentiels sont consultables dans la liste |
| X04 | Non autorisé / route inexistante | 401/403/404 et AdminGuard | `unauthorized.tsx`, `+not-found.tsx`, `Stack.Protected` | **I**, accès E2E à vérifier |
| Q01 | UX et accessibilité | Sans endpoint | `components/ui`, `features/ux/ux-audit.test.mjs` | **P** : revue statique et contrastes principaux, **TalkBack/appareil non testés** |
| Q02 | Build Android et signature | Firebase Android + EAS + Play Console | `app.json`, `app.config.js`, `eas.json`, `scripts/validate-android-release.cjs` | **B** : profils EAS prêts, identité officielle/FCM/branding/keystore non fournis, **aucun APK/AAB** |
| Q03 | Qualité et régression | Web/API sans runs GitHub Actions observés | Workflow mobile `android-validation.yml` et `release-quality.yml` | **P** : TypeScript & tests mobiles vérifiables ; lint/Doctor à suivre dans CI qualité ; pas d'E2E tripartite |

## Correspondance des lots et éléments différés

Les commits de la branche Android documentent les lots dans le README et dans les fichiers :
`MOBILE_ARCHITECTURE.md`, `MOBILE_AUTH*.md`, `MOBILE_PATIENT*.md`, `MOBILE_DOCTOR*.md`, `MOBILE_MESSAGING.md`, `MOBILE_ANDROID_NOTIFICATIONS.md`, `MOBILE_MEDICAL_DOCUMENTS.md`, `MOBILE_GEO_INTERVENTION_ZONES.md`, `MOBILE_REVIEWS_HISTORY.md`, `MOBILE_ADMINISTRATION.md`, `MOBILE_NETWORK_RESILIENCE.md`, `MOBILE_UX_ACCESSIBILITY_AUDIT.md`, et `ANDROID_RELEASE_BUILD.md`.

**Explicitement différé** : carte GPS avec marqueurs faute de coordonnées professionnelles autorisées, création admin mobile (web uniquement), détail admin individuel non porté, e-mail/mentions légales publiques encore placeholders, disponibilité publique temps réel impossible sans nouvel endpoint, WebSocket/pièces jointes de messagerie non pris en charge par le backend. **Ne pas ajouter de fonctionnalité fictive pour combler ces différences.**

## Preuves de tests et ce qu'elles ne prouvent pas

| Vérification | Preuve disponible | Limite |
| --- | --- | --- |
| Code Android | GitHub Actions `Medilink Android validation` sur PR #4 ; Node 22, `npm ci`, `tsc --noEmit`, suites `test:http`, `test:auth`, `test:session`, `test:onboarding`, `test:patient`, `test:doctors`, `test:doctor-profile`, `test:needs`, `test:appointments`, `test:patient-profile`, `test:doctor-dashboard`, `test:doctor-needs`, `test:doctor-agenda`, `test:doctor-profile-edit`, `test:messaging`, `test:notifications`, `test:documents`, `test:geo`, `test:reviews`, `test:admin`, `test:network`, `test:ux` | Preuve de types et tests unitaires/mocks, **pas** d'un parcours E2E de comptes réels |
| Précontrôle release | `scripts/validate-android-release.cjs` et `scripts/release-config.test.mjs`, workflow `release-quality.yml` | Vérifie configuration et options ; ne signe ni ne compile APK |
| Lint et Expo Doctor | Contrôles ajoutés au workflow `release-quality.yml` | Les résultats doivent être explicitement vérifiés avant sortie ; un échec bloque la release |
| Web et API | Inventaire des sources `main` et des contrats ; aucun run Actions retrouvé sur les deux dépôts | **Aucun succès de CI web/API ne peut être affirmé** |
| Appareils, FCM, E2E | Aucun émulateur ni appareil authentifié accessible ici | **Non testé** : installation, écrans, permissions, Firebase push, appels de production |
| Build et signature | `eas.json` versionné et précontrôle ; **aucun lien artifact EAS vérifié** | **Aucun APK, AAB, build ID ni SHA-256 binaire** |

La campagne d'essais sur appareil est détaillée dans `docs/ANDROID_RELEASE_BUILD.md` et `docs/ANDROID_FINAL_ACCEPTANCE.md`.

## Critères bloquants de recette finale

- [ ] Confirmer le package reverse-DNS Android définitif, identique dans Firebase et Google Play, et l'UUID projet EAS.
- [ ] Fournir `google-services.json` Android réel, activer FCM natif et contrôler les autorisations Android.
- [ ] Remplacer les icônes/splash **starter Expo** par l'identité Medilink officiellement approuvée.
- [ ] Valider la politique de confidentialité, les conditions et le contact public dans le mobile.
- [ ] Corriger/valider côté backend patient la vérification signature réelle des fichiers et types MIME.
- [ ] Vérifier l'API NestJS HTTPS réelle et les contrats authentifiés avec comptes patient, médecin (vérifié/non vérifié) et admin actif.
- [ ] Exécuter des scénarios E2E (inscription, login, refresh/logout, besoins, propositions, rendez-vous et conflits, documents, avis, notifications, statuts admin) avec séparation intercomptes.
- [ ] Sur un **vrai Android** : système de fichiers, caméra non demandée, réseau instable, 401/403, notifications FCM au premier plan/arrière-plan, TalkBack, grandes polices et retour matériel.
- [ ] Lint + Expo Doctor + typecheck + suites de tests **tous verts sur le même commit**.
- [ ] Construire un **APK preview signé**, récupérer son URL et son SHA-256, installer/tester ; construire un **AAB production** signé si la recette est acceptée.
- [ ] Vérifier versionCode supérieur au dernier code Google Play, politique de données médicales, formulaires Data Safety et procédure de publication.
- [ ] Maintenir la PR #4 en brouillon tant que des critères bloquants ne sont pas clos.

## Décision de release

**NON PRÊT À PUBLIER.** L'implémentation mobile et les configurations EAS constituent une **candidate source pré-build**, pas une release Android installable validée. La transition vers « prête » requiert tous les critères bloquants, des preuves Android réelles et la revue de confidentialité/sécurité. La PR #4 n'est pas fusionnée.
