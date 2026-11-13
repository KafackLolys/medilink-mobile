# Prompt 26 — Revue UX, accessibilité et finitions Android

## Périmètre réel de l'audit

Inventaire des routes Expo Router depuis l'arbre GitHub de `medilink-mobile` sur `docs/mobile-audit-parity-2026-11-13`, vérification des composants communs et navigation native (Expo SDK 58), et inspection des écrans représentatifs des parcours auth, patient, médecin et admin. Les contrôles sont **statiques et TypeScript/CI** ; ils ne constituent **ni une inspection visuelle de chaque écran dans un émulateur**, ni une certification WCAG/TalkBack.

Les modèles médicaux, règles métier et endpoints n'ont pas été modifiés ; aucune fonction hors périmètre n'est ajoutée.

### Correctifs appliqués au code

| Composant | Constat | Correction |
| --- | --- | --- |
| `src/constants/theme.ts` | Bleu primaire sur surface d'information claire : **4,24:1**, inférieur à AA pour du texte normal | Surface d'information claire ajustée de `#DBEAFE` à `#EFF6FF`, ratio mesuré **4,75:1** ; test automatique des principales paires clair/sombre à minimum **4,5:1** |
| `src/components/ui/primitives.tsx` | Libellés longs pouvaient déborder de boutons/badges ; actions de retour insuffisamment annoncées ; scroll gêné par les onglets | `flexShrink` sur texte bouton, badge adaptable sans hauteur figée et taille 14 scalable, avatar annoncé une seule fois, retour avec hint et cible **48 points**, header qui peut renvoyer son action à la ligne ; `Screen` protège la fin du formulaire avec `BottomTabInset` et permet d'écarter le clavier au glissement |
| `src/components/ui/form-fields.tsx` | Les erreurs et labels étaient principalement présentés visuellement | `aria-invalid`, `aria-describedby` vers le message d'erreur, erreur annoncée, descriptions sur switches/sélections, **48 points** pour le bouton de visibilité du mot de passe et les choix radio ; typages vérifiés sur React Native 0.88 |
| `src/components/ui/overlays.tsx` | Confirmation sur petits écrans ou police agrandie pouvait dépasser la hauteur, Android retour pouvait fermer une opération en cours, toasts sur la barre de statut | Modales `KeyboardAvoidingView` et `ScrollView` limitées à l'écran, respect des safe areas, actions flexibles, Android Back autorisé uniquement lorsque `busy=false`, toasts décalés selon l'encoche/status bar |
| `src/features/messaging/messaging-screen.tsx` | Android retour depuis un fil pouvait sortir de la section ; compositeur et barre d'entête peu flexibles | `BackHandler` focalisé : retour au **listing** lorsqu'un fil est actif, abonnement nettoyé au démontage, libellé « Retour aux conversations », champ d'envoi explicitement limité à 4 000 caractères, support de l'agrandissement des caractères, header/compositeur adaptables |
| `src/features/network/connectivity-banner.tsx` | Avertissement hors ligne placé au-dessus de la navigation sans marge de statut Android | `useSafeAreaInsets()` et padding top, conservant le rôle d'alerte/accessibilité existant |
| `src/features/ux/ux-audit.test.mjs` | Manque de garde de régression transversal pour l'accessibilité et la navigation | Tests structurels sur l'inventaire des routes, `Stack.Protected`, cible de 48 points, champs associés aux erreurs, modales clavier/retour, retour message Android, états de chargement/erreur/vide, bannière réseau et purge de session |

**Cohérence des rôles :** thème commun (textes, fond, spacing, badges), mais navigation **patient** avec Médecins/Demandes/Agenda/Profil, **médecin** avec Besoins/Propositions/Agenda/Profil et **admin** avec annuaire de comptes et confirmation renforcée. Les écrans admin ne deviennent pas des clones des écrans médicaux.

### Checklist d'inventaire et de revue (sources / contrats)

- [x] **Accès et authentification :** `(auth)/choose-role`, `login`, `register`, `forgot-password`, écrans `account-status` et `unauthorized`. Formulaires partagés, états d'erreur, clavier, texte extensible et routes de rôle.
- [x] **Public :** accueil public, aide, contact, confidentialité, conditions, route introuvable. Contrôle de la présence et des layouts ; liens et densité visuelle à confirmer sur appareil.
- [x] **Accueil patient et navigation :** `patient/(tabs)/index`, `_layout` ; boutons transversaux et liens protégés.
- [x] **Annuaire et fiche médecins :** `patient/(tabs)/medecins`, `patient/medecins/[id]/index`, `patient/medecins/[id]/rendez-vous`. États liste/vide/erreur, formulaires de filtre, détail et chemin de réservation.
- [x] **Besoins patient :** `patient/(tabs)/demandes`, `patient/besoins/nouveau`, `patient/demandes/[id]/index`, `patient/demandes/[id]/modifier`. Scroll de formulaire, sélecteurs et feedback serveur.
- [x] **Agenda et avis patient :** `patient/(tabs)/rendez-vous`, `patient/rendez-vous/[id]`, `patient/historique`, formulaire d'avis du détail. États de statut et retour à l'historique.
- [x] **Profil et documents patient :** `patient/(tabs)/profil`. Champ sensible, données médicales masquées, sélecteur natif, confirmation de suppression.
- [x] **Messagerie et notifications patient :** `patient/messages`, `patient/notifications` et composants réutilisés ; retour matériel Android du fil, clavier, listes et rafraîchissement.
- [x] **Accueil médecin et navigation :** `medecin/(tabs)/index`, `_layout`. Actions et statuts propres au médecin.
- [x] **Besoins et propositions médecin :** `medecin/(tabs)/besoins`, `medecin/besoins/[id]`, `medecin/(tabs)/propositions`. Actions conditionnelles, confirmées côté API.
- [x] **Agenda médecin :** `medecin/(tabs)/rendez-vous`, `medecin/disponibilites`. Listes, sélecteurs et confirmations des changements de statut.
- [x] **Profil et zones médecin :** `medecin/(tabs)/profil`, `medecin/zone-intervention`. Champs professionnels, validations et documents signés.
- [x] **Avis, historique, messagerie et notifications médecin :** `medecin/avis`, `medecin/historique`, `medecin/messages`, `medecin/notifications`. Feedback, listes, filtres et navigation.
- [x] **Administration :** `admin/index`, `admin/comptes/[id]` dans l'inventaire et layout. Contrôles `admin` du routeur, listes et confirmations. Les opérations admin sensibles restent protégées par NestJS.
- [x] **Système transversal :** safe areas, dark/light mode, toast, connectivité, champs, boutons, modal, states `LoadingState`/`ErrorState`/`EmptyState`, accessibilité de la navigation et options de texte.

**Sens exact des cases cochées :** présence, contrats de navigation/composants partagés et revue statique effectuées, avec corrections ciblées ci-dessus. Elles ne signifient **pas** qu'un contrôle manuel visuel ou TalkBack a été réalisé individuellement sur chacun de ces écrans.

### Contrôle automatisé

```bash
npm ci
npm run typecheck
npm run test:ux
npm run check
npm run lint
npm run doctor
```

GitHub Actions exécute npm ci, `typecheck` et les tests unitaires, y compris `test:ux`. Le test `test:ux` valide la structure du code **et calcule les ratios WCAG AA des principales paires texte/fond du thème**. Il ne valide pas la lisibilité des compositions réelles à l'écran, la précision de TalkBack ni les contrastes après overlays/images/rendu natif. Le workflow GitHub Actions n'inclut pas encore un contrôle lint/Expo Doctor.

### Checklist de recette Android non effectuée

- [ ] **Police agrandie** à 150 % et 200 % : boutons, badges, champs longs, cartes, titres, toasts, boîtes de confirmation, barres de navigation, langue française.
- [ ] **TalkBack** : ordre de focus, annonces de validation, labels de champs, boutons de retour, compteurs non lus, champs médicaux masqués, états de chargement.
- [ ] **Clavier Android** ouvert dans login, inscription, nouveau besoin, proposition, chat, profil, zones d'intervention, édition admin ; vérification du dernier contrôle et du bouton de validation.
- [ ] **Navigation et retour matériel** : fermer une modal non occupée, ne pas interrompre une mutation confirmée, revenir à la liste de conversations puis aux onglets sans double pop.
- [ ] **Safe areas** : encoches, clavier, gestes systèmes, mode sombre, mode clair, barres d'onglets, rotation et petits écrans.
- [ ] **Contrast ratio** WCAG sur rendus effectifs, avec les réglages d'accessibilité Android, sur tous les badges/tokens.
- [ ] **États serveur** : requête longue, vide, erreur 401/403/404/409/503, coupure et reprise du réseau, contenu hors ligne obsolète explicitement marqué.
- [ ] **Personnalisation des rôles** : rendu patient, médecin vérifié/en attente et administrateur, sans exposition de données interdites.
- [ ] **Tests E2E/visuels** sur un véritable APK/dev build Android et comparaison des écrans avec le site web authentifié.
- [ ] **Lint et Expo Doctor** : exécuter et corriger les avertissements avant fusion.

## Décision de livraison

Ce lot améliore la cohérence du code et fait passer des régressions communes dans la CI. Il ne clôt **pas** les contrôles visuels/TalkBack sur matériel, l'audit de contrastes mesurés ou la recette authentifiée E2E. Ne pas fusionner la PR #4 avant leur réalisation.
