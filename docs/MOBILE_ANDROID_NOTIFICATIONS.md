# Prompt 20 — Centre de notifications Android et FCM

## Contrats audités

- NestJS `src/notifications/notifications.controller.ts` et `notifications.service.ts`.
- Web `services/notification-service.ts`, `hooks/use-notifications.ts`, Firebase web push.
- Expo SDK **58.0.x**, React Native 0.88.1. Compatibilité vérifiée avec la documentation officielle de `expo-notifications` SDK 58. Version déclarée `~58.1.9`, plugin natif configuré ; résolution npm lock committée.

| Endpoint | Règle |
|---|---|
| `GET /notifications?page=1&pageSize=20` | Serveur filtre **sur le Firebase UID** ; pagination 1..1 000 000, taille 1..50, `unreadCount` global |
| `PATCH /notifications/:id/read` | Vérifie le propriétaire : **403** si autre compte ; retourne `{id,readAt}` |
| `PATCH /notifications/read-all` | Marque comme lues les notifications du seul UID ; retourne `{updated}` |
| `POST /notifications/devices` | `{deviceId,token,platform:'mobile',userAgent?}`, deviceId alphanumérique/underscore/tiret 16–100 caractères, token 20–4096 caractères |
| `POST /notifications/devices/:deviceId/unregister` | Désinscrit le terminal **uniquement pour le Firebase UID courant** ; `{removed}` |

Le backend utilise **Firebase Admin Messaging `sendEachForMulticast`**. Les tokens requis sont des **tokens d'appareil FCM**, pas des tokens `ExpoPushToken`. Sur Android la bonne API est `Notifications.getDevicePushTokenAsync()` (type `fcm`), après permission et canal de notifications.

## Développements

- `src/features/notifications/notification-center.tsx` : listes patient/médecin, décompte non lus réel, marquer une notification ou toutes comme lues, pagination serveur 20/page, pull-to-refresh, accès à l'URL autorisée, chargement, erreurs et états vides.
- `src/app/patient/notifications.tsx` et `src/app/medecin/notifications.tsx` : routes protégées par Expo Router et le rôle de session. Le web exclut les admins de ce centre : Android suit ce périmètre.
- Accès direct au centre de notifications sur les dashboards patient/médecin.
- `src/features/notifications/notification-model.ts` : parseur strict (sans champ interne), validation du token et de l'ID, liste blanche des destinations en fonction du rôle (rejette URL externe, traversée de répertoire et lien d'un autre rôle).
- `src/features/notifications/push-device.ts` : canal `medilink-updates`, permission Android, token **FCM natif** issu d'Expo SDK 58, identifiant de terminal généré une fois et conservé dans Expo SecureStore, `POST /notifications/devices` après vérification du profil courant. Aucun token imprimé, enregistré dans Zustand, logué ou placé en URL.
- Le bouton **Activer les notifications Android** déclenche l'invite de permission ; au démarrage, le client réenregistre silencieusement un terminal **uniquement si la permission est déjà accordée**.
- `src/features/notifications/push-lifecycle.tsx` : gestion des notifications en avant-plan avec signal d'actualisation du centre ; configuration discrète (liste OS sans bannière intrusive en avant-plan), événements de tap pour l'arrière-plan et lancement initial, écoute de renouvellement du token.
- Le tap **n'exécute jamais directement** l'URL du push : avant navigation, le client vérifie la session, le rôle, la destination et `PATCH /notifications/:id/read` du serveur (qui **vérifie le propriétaire**). Une cible non autorisée n'est pas ouverte.
- `src/features/auth/session.ts#logoutSession` tente `unregisterDevice` **avant de supprimer les credentials**. Un échec réseau ne bloque pas la déconnexion locale. Le serveur déduplique également une registration du même token si un autre compte l'utilise à l'avenir.
- **Attention :** si le terminal est hors ligne lors de la déconnexion, la désinscription serveur n'est pas garantie. Le backend aurait besoin d'un mécanisme de révocation différée ou lié à la session pour garantir l'absence totale de push OS après logout. Ne pas affirmer l'inverse.

## Particularités SDK 58, foreground/background

- **Expo Go Android ne prend pas en charge les notifications push distantes** depuis SDK 53 ; il faut un **development build Android** ou une build release.
- La réception standard d'un push de type `notification+data` en arrière-plan ou après fermeture est gérée par **Android/FCM**. L'application suit ensuite la destination au clic via la réponse native.
- Le backend envoie un champ `notification` (titre/corps) et `data:{notificationId,type,url}`, pas un push **headless data-only** : aucune tâche `expo-task-manager` ou promesse d'exécution JS en arrière-plan n'a été inventée.
- Android 13+ requiert l'autorisation système `POST_NOTIFICATIONS`. Le canal est créé **avant la demande de token**. La livraison reste soumise à la permission OS, FCM, l'état du téléphone et la politique d'économie d'énergie.
- Pour éviter les informations sensibles en bannière lorsque l'application est ouverte, le handler choisit `shouldShowBanner:false`, `shouldShowList:true`, `shouldPlaySound:false` ; le centre se recharge à réception. Les notifications en arrière-plan sont affichées par Android à partir du titre/corps **rédigé par le backend** : toute modification de confidentialité de ces textes doit se faire sur le backend.

## Configuration Firebase **requise pour les vrais push**

`app.json` contient le plugin `expo-notifications`, canal `medilink-updates`. `app.config.js` accepte exclusivement deux paramètres de build :

```sh
MEDILINK_ANDROID_PACKAGE=cm.exemple.medilink  # REMPLACER par le vrai applicationId Firebase
MEDILINK_GOOGLE_SERVICES_FILE=/secure/google-services.json  # Fichier Android Firebase réel
```

Ces valeurs sont des **exemples de configuration**, pas des identifiants Medilink réels. L'application Android doit être enregistrée dans le même projet Firebase que celui utilisé par le backend FCM, et la build doit disposer d'un fichier `google-services.json` correspondant. Utiliser des variables de fichiers EAS ou un stockage CI sécurisé ; **ne pas committer de service-account JSON** ni inventer un `google-services.json`. Le fichier de configuration Android est distinct de la **clé d'administration Firebase**, qui doit rester exclusivement côté serveur.

Commandes après configuration :

```sh
npm ci
npm run typecheck
npm run test:notifications
npm run lint
npm run doctor
npx expo run:android
```

`expo run:android` requiert Android SDK et le fichier Firebase approprié. Une build EAS de développement est également possible avec des credentials Android/Firebase configurés. **La compilation TypeScript et les tests du code n'attestent pas la réception de vrais push**.

## Tests automatisés

`src/features/notifications/notification-model.test.mjs` et `npm run test:notifications` :
- types et compteurs réels, pagination backend ;
- refus des rôles non autorisés ;
- destination limitée au rôle, chemins et protocoles dangereux refusés ;
- respect du contrat `deviceId`/token natif FCM ;
- messages d'erreur non divulguants.

## Recette Android physique à effectuer

- [ ] Réaliser une **build de développement Android** avec le véritable package Firebase et le `google-services.json` correspondant.
- [ ] Android 13+ : demander/refuser/autoriser `POST_NOTIFICATIONS`, vérifier le canal système.
- [ ] Activer le push, vérifier `POST /notifications/devices` et le stockage Firestore sous le bon UID **sans jamais logger le token**.
- [ ] Publier une notification de test via le backend existant vers un compte autorisé ; réception et rafraîchissement **au premier plan**.
- [ ] Vérifier réception et clic **en arrière-plan**, puis après fermeture normale de l'application.
- [ ] Vérifier les deep links patient/médecin, rejet d'un chemin interdit ou d'un identifiant d'un autre compte.
- [ ] Ouvrir et marquer une notification comme lue ; vérifier le compteur réel et le marquage de toute la liste.
- [ ] Déconnexion en ligne : vérifier `unregister` de l'UID précédemment connecté avant suppression du token de session.
- [ ] Déconnexion hors ligne : vérifier le risque de token FCM encore enregistré sur le serveur et prévoir une correction backend si révocation garantie requise.
- [ ] Vérifier plusieurs comptes successifs sur le même terminal et absence d'ouverture des notifications de l'ancien compte.
- [ ] Vérifier TalkBack, petits écrans, Android retour et état après rotation/reprise.

**Statut vérifiable :** implémentation et tests CI ; **pas de test de push physique réalisé** dans cette session faute de configuration Firebase Android réelle et d'émulateur/appareil connecté.
