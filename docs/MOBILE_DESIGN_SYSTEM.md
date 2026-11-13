# Design system mobile — Medilink

## Références vérifiées

Sources web : `app/globals.css`, `components/custum/{button,field,status-badge,auth-shell,page-shell,confirm-dialog}.tsx` et `app/(puclic)/login/page.tsx`. Source mobile : Expo 58, React Native, Expo Router. La maquette responsive du déploiement Vercel n'a pas pu être parcourue automatiquement au cours du prompt 03 : **validation visuelle à effectuer avant les pages métier**.

## Identité et traduction native

| Token | Web | Mobile clair |
| --- | --- | --- |
| Couleur primaire | `#2563EB` | `#2563EB` |
| Secondaire | `#0D9488` | `#0D9488` |
| Surface | `#F8FAFC` | `#F8FAFC` |
| Texte principal | `#1E293B` | `#1E293B` |
| Texte atténué | `#64748B` | `#64748B` |
| Bleu nuit | `#0F1F4A` | `#0F1F4A` |
| Succès | `#16A34A` | `#15803D` (meilleur contraste sur fond clair) |
| Avertissement | `#F59E0B` | `#92400E` (contraste) |
| Danger | `#DC2626` | `#B91C1C` (contraste) |

Le web a une palette de marque explicite dans `@theme inline` et, parallèlement, des variables de composants shadcn par défaut dans `:root` et `.dark`. Le design system mobile privilégie **les tokens de marque** et leur version sombre contrastée. Il ne recopie pas les variables grayscale des composants shadcn pour la couleur des CTA.

Typographie : Geist Sans sur le web ; police système Android pour le mobile, avec tailles adaptables à l'échelle système. Corps 16/24, légende 12/18, petit 14/21, sous-titre 22/30 et titre 30/38. Les hauteurs tactiles sont au moins 48 dp. Champs de 48 dp, angles 12–18 dp, espacements 4/8/16/24/32/64 dp.

## Inventaire des composants natifs

- `src/components/ui/primitives.tsx` : Button (5 variantes, chargement, disabled), Card, Badge (6 tons), Avatar, Screen (safe areas et ScrollView), Header.
- `src/components/ui/form-fields.tsx` : Input (erreur, hint, focus et multiline), PasswordField (visibilité), SelectField (choix sous forme de chips tactiles), ToggleField.
- `src/components/ui/states.tsx` : EmptyState, ErrorState et LoadingState.
- `src/components/ui/overlays.tsx` : Modal de confirmation et ToastProvider/useToast.
- `src/components/themed-text.tsx`, `src/constants/theme.ts` : typographie et thèmes clair/sombre.

## Galerie interne

Ouvrir `/dev/design-system` depuis le runtime de développement. La galerie utilise uniquement des données locales de démonstration, aucune API médicale. Ne pas exposer cette galerie dans les parcours utilisateurs en production. Vérifier les variantes, états, grands caractères, contraste, orientation et clavier Android. La galerie n'est pas une page métier et ne remplace pas la revue responsive préalable du site web.

## Limites

- Les captures authentifiées du déploiement et comparaisons 360 / 390 / 430 px ne sont pas encore réalisées.
- Les composants sont enregistrés sur GitHub mais aucun test Android/typecheck/lint n'a été exécuté dans un environnement contenant `node_modules`.
- Les composants des prochains lots pourront être enrichis après leur usage réel ; éviter les dépendances natives non validées.
