# Correctifs Android — Google OAuth et notifications (15/11/2026)

## État du code
- L'écran **Connexion** n'affiche désormais qu'un bouton Google.
- L'application demande l'autorisation Android des notifications au premier démarrage connecté, enregistre le token FCM auprès de l'API, et relance la synchronisation au retour en premier plan.
- La cloche affiche le **nombre de notifications non lues fourni par l'API**. Le compteur est réactualisé à l'ouverture du tableau de bord, lors de la réception d'un push, après lecture et au retour au premier plan. Il est vidé en cas de déconnexion/changement de compte.
- Les boutons temporaires de test local et serveur ont été retirés. La permission reste facultative et contrôlée par Android.

## Blocage de configuration Google (action Firebase requise)
Le fichier `google-services.json` contient le package Android `com.lolys.medilink` et le **client Web OAuth (type 3)**, mais **aucun client OAuth Android (type 1)**. L'erreur `DEVELOPER_ERROR` de Google Sign-In est compatible avec une absence/mauvaise configuration de certificat SHA-1 pour cet identifiant Android. Le code ne peut pas créer un client OAuth Android reconnu par Google à partir d'une chaîne inventée.

1. Ouvrir **Firebase > Paramètres du projet > Général** : https://console.firebase.google.com/project/medilink-2027/settings/general
2. Dans **Vos applications**, sélectionner l'application Android `com.lolys.medilink`.
3. Ajouter les **SHA-1 et SHA-256 du certificat qui a réellement signé l'APK installé**. Les fingerprints du fichier obtenu depuis notre build GitHub Actions sont archivés avec son APK dans `medilink-android-signature-sha.txt`.
4. Vérifier que **Authentication > Sign-in method > Google** est activé.
5. Télécharger le `google-services.json` actualisé et remplacer le fichier dans le dépôt. Vérifier la présence d'un `oauth_client` avec `client_type: 1`, `android_info.package_name=com.lolys.medilink` et la signature correspondante; recompiler l'APK.
6. **Attention :** un APK EAS et un APK GitHub Actions peuvent avoir **des certificats différents**. Les builds CI locaux utilisent une clé de test produite par le runner, pas nécessairement la clé EAS. Pour la distribution durable et les mises à jour sans désinstallation, utiliser le même keystore EAS géré et enregistrer son SHA dans Firebase. Une signature différente peut obliger à désinstaller l'ancienne version de test avant installation.

**Ne pas committer de clé privée Firebase Admin, de keystore ou de secrets.** Les empreintes SHA publiques peuvent être partagées. Le seul client Web OAuth n'est pas suffisant pour valider un APK Android natif si sa signature n'est pas déclarée.

## Vérifications de recette requises sur téléphone
1. Page Connexion : un seul bouton Google.
2. Connexion Google existante et premier compte (choix patient/médecin) sur APK signé avec SHA enregistré.
3. Premier lancement connecté : permission Android accordée, enregistrement FCM automatique.
4. Nouvelle notification métier créée par le serveur : réception Android sans bouton de test; le nombre sur la cloche augmente.
5. Ouvrir/mettre en lecture : nombre non lu diminue; après déconnexion, aucune notification du compte précédent sur la cloche.
6. Fermer/relancer l'application et vérifier à nouveau. Les permissions/optimisations batterie du téléphone peuvent influencer l'affichage.

**Tests automatisés ≠ validation de livraison FCM sur un appareil réel**. Le backend doit émettre la notification métier via Firebase Admin dans le même projet `medilink-2027`. L'activation de l'autorisation ne fabrique pas elle-même des événements ou des notifications côté serveur.
