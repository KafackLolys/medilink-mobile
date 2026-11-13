# Medilink Android — Notes de version candidate source (non distribuable)

**Étiquette de préparation :** `1.0.0-rc-source-20261113` (identifiant de documentation, **pas** un build Expo ni un tag Git). La version native déclarée est `1.0.0` avec `versionCode: 1` comme point de départ, sous réserve de vérification dans Google Play Console.

**Statut au 13 novembre 2026 : NON PRÊT À PUBLIER. Aucune release APK/AAB construite ou signée.**

## Fonctionnalités comprises dans le code candidat

- Authentification patient/médecin, session Firebase avec stockage sécurisé, protections de rôle, statut du compte, récupération de mot de passe.
- Patient : accueil avec données réelles, annuaire et profils médecins, recherche par ville et spécialité, publication et gestion des besoins médicaux, réservation soumise à validation du backend, rendez-vous et historique, avis après consultation, profil médical et documents.
- Médecin : tableau de bord, besoins accessibles, propositions, agenda et états de rendez-vous, disponibilités semaine, plages bloquées et durée de consultation, profil et justificatifs professionnels, zones d'intervention, historique et avis reçus.
- Services communs : messagerie HTTP, notifications et enregistrement des tokens FCM natifs, gestion des permissions Android nécessaires, documents multipart, gestion des réseaux instables et cache RAM limité au seul annuaire public.
- Administration : liste et recherche des comptes, statut et vérification avec confirmation renforcée ; création d'administrateurs réservée au web pour les raisons de sécurité documentées.
- Accessibilité et UI : design system clair/sombre, composants adaptés aux lecteurs d'écran, cibles tactiles 48 pt, navigation Expo Router avec contrôle du rôle, tests de contraste WCAG AA sur les principales paires de couleurs.
- Distribution **préparée**, non exécutée : profils EAS `development` (APK dev-client), `preview` (APK interne) et `production` (AAB pour Google Play).

## Progrès de qualité vérifiables

Les workflows GitHub Actions du dépôt mobile exécutent `npm ci`, `npm run typecheck` et les suites unitaires des prompts 1–26 ; le nouveau workflow `Medilink release quality gates` exécute également `npm run release:validate`, `npm run doctor`, `npm run lint` et les tests de contrat release. La réussite d'un workflow concerne **le commit qu'il a effectivement construit**, pas forcément la version la plus récente. Voir [actions/runs](https://github.com/KafackLolys/medilink-mobile/actions) et vérifier le SHA du HEAD avant toute signature.

Il n'existe dans ce travail **aucun certificat de test sur smartphone**, **aucune preuve de traitement d'un vrai dossier médical**, **aucune simulation d'une notification FCM sur appareil** et **aucune URL d'APK ou d'AAB vérifiée**. Les dépôts web et API ont été étudiés statiquement ; leurs historiques GitHub Actions consultés ne contenaient aucun run.

## Limitations connues (bloquantes ou différées)

1. **Distribution bloquée :** identité de package Android définitive, UUID projet EAS, credentials de signature et fichier Firebase Android manquants/non confirmés.
2. **Branding bloquant :** icônes/splash natifs comportant encore les éléments initiaux Expo ; identité Medilink officielle à intégrer et vérifier.
3. **Pages publiques bloquantes :** aide, contact, confidentialité, conditions d'utilisation sur Android encore provisoires ; revue juridique indispensable avant tout déploiement médical public.
4. **Backend document patient :** vérification du véritable contenu des fichiers et de la catégorie plus faible que pour les documents médecin ; durcir le serveur.
5. **Réservation :** pas d'endpoint public renvoyant les créneaux en temps réel ; les conflits sont finalement vérifiés côté NestJS, ne pas présenter la proposition horaire comme confirmée avant POST accepté.
6. **Carte des médecins :** pas de coordonnées GPS fiables publiées ; la liste par ville/secteur est utilisée sans suivi de position.
7. **Fonctionnalités réservées web :** création d'administrateur et certaines vues administratives avancées ; les routes mobiles détaillées encore provisoires ne valent pas parité complète.
8. **Non testé E2E :** appels API réels, session Firebase, documents Android `content://`, permissions, réseau mobile, TalkBack, performance, FCM background, conflit de créneaux, refus des rôles, révocation des comptes.
9. **Notifications après logout hors ligne :** le serveur peut conserver temporairement une inscription appareil lorsque la désinscription échoue hors ligne. Une mitigation backend demeure souhaitable.

## Conditions pour déclarer un vrai candidat installable

- Obtenir une identité Medilink et un backend final validés, configurer EAS/Firebase, corriger les pages publiques et les risques backend.
- Produire un **APK preview** signé depuis un commit Git approuvé ; relever son **build ID EAS**, son `artifactUrl` réel, sa signature, sa somme SHA-256 et les résultats des tests d'installation.
- Exécuter toutes les lignes critiques de `docs/ANDROID_FINAL_ACCEPTANCE.md` sur un **appareil Android réel**, avec trois rôles de test distincts, et vérifier les données du serveur.
- Après acceptation, produire un **AAB production** lié au même code approuvé, avec `versionCode` > version de Google Play, et contrôler Play App Signing.
- Modifier cette note et la matrice seulement après les tests factuellement réalisés, sans convertir les cases « à faire » en réussites supposées.

**Installation** : voir `docs/ANDROID_RELEASE_BUILD.md`. Ne pas fournir d'instruction d'installation faisant croire qu'un fichier APK existe déjà.
