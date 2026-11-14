# Medilink Android — Procès-verbal de recette finale (Prompt 30)

**Date :** 13 novembre 2026. **Statut : NON ACCEPTÉ / PRE-BUILD**, PR #4 en brouillon, version source candidate `1.0.0-rc-source-20261113`.

## Système de preuve

Les éléments vérifiables sont enregistrés sous leur nature réelle :
- **SOURCE** : présence de route, composant, contrôle API, validation ou protection dans les dépôts `KafackLolys/medilink`, `medilink-api`, `medilink-mobile`.
- **UNIT/CI** : tests Node/TypeScript et contrôle Expo Doctor/ESLint exécutés dans le workflow mobile, identifier commit et run.
- **MANUEL/E2E** : test de bout en bout avec identifiants réels, device Android et observations réseau : **non exécuté ici**.
- **BINAIRE** : fichier APK/AAB signé réellement téléchargé et identifiant EAS : **non disponible**.
- **PASS** signifie preuve récupérée ; **NON TESTÉ** n'est pas un succès.

## Vérifications de sources et qualité

| Vérification | État | Preuve ou reste à faire |
| --- | --- | --- |
| Lecture des 3 dépôts | SOURCE examinée | Next.js `main`, NestJS `main`, Expo Android branche historique ; [MOBILE_PARITY_MATRIX.md](MOBILE_PARITY_MATRIX.md) |
| Contrats Firebase/Auth/roles | SOURCE/UNIT | Session SecureStore et gardes côté API ; vrai refresh/révocation encore NON TESTÉ |
| HTTP, demandes, propositions | SOURCE/UNIT | Fonctions, parsers et tests ; aucune opération médicale en production |
| Tests unitaires des prompts 1–26 | CI du dépôt Android | Workflow `android-validation.yml` ; vérifier run SHA et résultat avant merge |
| Précontrôle des profils EAS et permissions | SOURCE/CI | `npm run release:validate` et `scripts/release-config.test.mjs` |
| TypeScript | CI du dépôt Android | `npm run typecheck` sur le commit du pipeline |
| Lint et Expo Doctor | CI du dépôt Android | `release-quality.yml` ; vérifier qu'ils sont verts sur le SHA de la release |
| Build Android `development` | NON TESTÉ | Aucun APK/dev-client signé |
| Build Android `preview` | NON TESTÉ | Aucun APK preview ni artifactURL |
| Build Android `production` | NON TESTÉ | Aucun AAB ni artifactURL |
| Tests web/API dans GitHub Actions | NON TESTÉ | Aucun run Actions observé dans les deux dépôts au moment de l'audit |
| Tests E2E tripartites avec comptes | NON TESTÉ | Comptes de test et backend HTTPS de recette à fournir |
| Contrôle Android 360/390/430 et TalkBack | NON TESTÉ | Matériel Android et comparaison visuelle réelle requis |
| Identité Medilink/icône/splash/legal | BLOQUÉ | Starter Expo et pages publiques encore provisoires |

## Checklist de recette exécutable — patient

- [ ] Installer le **véritable APK preview signé**, relever version, package, permissions et SHA-256 binaire.
- [ ] S'inscrire patient, vérifier e-mail, se connecter, actualiser puis déconnecter ; valider rôle et sécurité en changeant de compte.
- [ ] Afficher accueil et annuaire, filtres `q`/`city`/`specialty`, fiche médecin vérifiée, statut réel, écran vide et erreur réseau.
- [ ] Créer une demande avec/sans fichier PDF/PNG/JPEG/WebP, refuser >10 Mo et MIME invalide, vérifier le document effectivement reçu côté API.
- [ ] Consulter, éditer, clore et supprimer les demandes dans les états autorisés, vérifier réponses refusées.
- [ ] Réserver une consultation en heure locale/fuseau IANA, tester collision et plage bloquée, s'assurer qu'aucun POST n'est rejoué après coupure réseau.
- [ ] Consulter rendez-vous et historique, tenter statut non autorisé et vérifier refus serveur.
- [ ] Déposer un avis après rendez-vous `completed` ; tenter doublon et vérifier l'unicité côté backend.
- [ ] Profil/antécédents et documents : lecture, upload, aperçu URL signée, suppression confirmée, refus intercomptes.
- [ ] Liste et fil messages, envoi sans doublon, séparation conversations A/B, notifications marquées lues.

## Checklist de recette exécutable — médecin

- [ ] Connexion médecin `pending` puis `verified`, accès différencié aux demandes et états de vérification.
- [ ] Tableau de bord : métriques exactes de l'API, aucun chiffre inventé.
- [ ] Lister besoins accessibles, consulter détail autorisé, envoyer proposition, suivre et annuler uniquement selon règle backend.
- [ ] Modifier horaires semaine, durée de consultation et plages bloquées ; vérifier conflit avec rendez-vous existants.
- [ ] Recevoir/valider/refuser rendez-vous via transitions de statut réellement permises ; vérifier historique terminé.
- [ ] Éditer uniquement champs du profil autorisés ; spécialité/matricule non modifiables, justificatifs PDF/images uploadés et supprimés ; vérifier impact sur statut.
- [ ] Modifier ville/quartiers/rayon d'intervention et vérifier enregistrement API.
- [ ] Consulter avis du médecin, vérifier moyenne, total et distribution de la réponse serveur.
- [ ] Messages et notifications propres au médecin, sans divulgation patient non autorisée.

## Checklist de recette exécutable — administrateur

- [ ] Patient/médecin/admin non actif tente `GET/PATCH /admin/*` : rejet FirebaseAuthGuard/AdminGuard et aucune donnée affichée.
- [ ] Admin actif : recherche/pagination des comptes, statuts patient/médecin, vérification e-mail ou professionnelle.
- [ ] Changement de statut suspendu/supprimé avec **deux confirmations** ; valider effet Firebase et révocation refresh tokens.
- [ ] Simuler erreur de synchronisation Firebase/Firestore HTTP 503 : pas de PATCH répété, relecture serveur.
- [ ] Tenter de changer le statut d'un admin par les routes patient/médecin : refus.
- [ ] Ne pas créer d'administrateur depuis Android : workflow web et transfert sûr des secrets requis.

## Checklist transverse sur matériel Android

- [ ] Mode avion, bascule Wi-Fi/4G, connexion lente, timeout, annulation et reprise, cache RAM limité aux médecins publics.
- [ ] FCM natif `getDevicePushTokenAsync`, permission Android 13+, réception au premier plan/arrière-plan et ouverture du bon lien après vérification de session.
- [ ] Déconnexion hors ligne : risque de token FCM non révoqué côté serveur à analyser.
- [ ] Android Back, modales sensibles, clavier ouvert et contenu défilable.
- [ ] TalkBack, grandes polices 150/200 %, contrastes réels, thèmes clair/sombre, écrans 360/390/430 px.
- [ ] URLs d'API HTTPS réelles ; absence de tokens/dossiers médicaux dans logs, captures, caches persistants, Crashlytics et analytics.
- [ ] Conditions d'utilisation, politique de confidentialité, consentement médical approprié et fiche Data Safety Google Play.
- [ ] Contrôle des permissions du manifeste final `aapt dump permissions`/Android Studio : aucune localisation/caméra/stockage étendu injustifié.
- [ ] Vérifier package/signature/keystore, `versionCode` unique croissant, APK/AAB effectivement générés et téléchargés, sommes SHA-256 réelles.

## Identifiants de preuves à renseigner après recette

| Élément | Preuve | Statut |
| --- | --- | --- |
| Git SHA exact de candidate | À associer au commit HEAD de PR #4 après revue | À renseigner |
| CI mobile (tests, lint, Doctor) | URL de run GitHub Actions du **même SHA** | Contrôle requis après dernier commit |
| URL backend HTTPS et version déployée | Ne pas révéler URL privée si non autorisée | Non vérifiée |
| Device Android / version OS | Modèle, Android API, testeur, date | Non fourni |
| APK preview : build ID/artifactURL/SHA256 | `eas build:view`, téléchargement, SHA-256 | **Aucun binaire créé** |
| AAB prod : build ID/artifactURL/SHA256 | `eas build:view`, téléchargement, SHA-256 | **Aucun binaire créé** |
| Signature et Google Play | EAS Credentials + Play App Signing (sans clé privée) | Non configurés ici |
| Résultats patient/médecin/admin | Captures anonymisées / rapport QA privé | **Non exécutés** |
| Verdict final autorisé | Toutes les cases bloquantes, revues sécurité et conformité closes | **REFUS DE PUBLICATION** |

**Conclusion :** Le code est un candidat à la recette, pas une application Android livrée. Tant que la vraie API/Firebase, le branding, les pages légales, les tests sur appareil et les APK/AAB vérifiables manquent, **ne pas fusionner PR #4, ne pas annoncer une disponibilité Google Play, et ne pas dire que Medilink est prêt.**
