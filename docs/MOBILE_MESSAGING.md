# Prompt 19 — Messagerie Medilink Android

## Audit du contrat réel

Sources : web `app/(private)/medecin/messages/page.tsx`, `app/(private)/patient/messages/page.tsx`, `hooks/use-messaging.ts`, `services/message-service.ts`; NestJS `src/messages/messages.controller.ts`, `src/messages/messages.service.ts`, dont `findConversationContexts`, `getConversationContext`, `listMessages`, `sendMessage`.

| Endpoint | Réponse | Usage Android |
| --- | --- | --- |
| `GET /messages/conversations` | `{items:Conversation[]}` | Liste des interlocuteurs autorisés, aperçu et nombre de non lus |
| `GET /messages/conversations/:id` | `{items:ConversationMessage[]}` | **100 derniers messages** classés chronologiquement ; marque comme lus les messages reçus |
| `POST /messages/conversations/:id` | `ConversationMessage` | Envoi JSON `{body}` de 1–4000 caractères après trim |

**Aucune route WebSocket, d'upload de fichier, de création arbitraire de conversation, de suppression de message ou de pagination de l'historique n'existe dans ce module.** L'implémentation ne fabrique aucune de ces fonctionnalités. L'état mémoire du fil est limité aux 100 derniers messages.

### Permissions backend

- Gardes Firebase sur **toutes** les routes.
- Seuls `patient` et `doctor` peuvent utiliser la messagerie ; `admin` reçoit HTTP 403.
- Le médecin doit avoir un profil professionnel `verified`.
- Les conversations sont créées/résolues à partir des propositions liées aux besoins médicaux, avec un statut parmi `sent`, `pending` ou `accepted`. Les propositions `rejected`, `expired`, `cancelled` ne donnent pas automatiquement accès à une conversation.
- Le backend ne permet d'ouvrir ou d'envoyer dans `:id` que si `getConversationContext(uid,id)` retrouve ce contexte parmi les conversations accessibles du Firebase UID courant ; sinon HTTP 404.
- Le client vérifie également l'appartenance de l'ID à **la liste autorisée reçue sous la session actuelle** avant d'ouvrir la conversation ou d'envoyer.
- Les données de conversation et messages n'exposent que les champs prévus par le service ; les champs internes inattendus (identifiants propriétaires, dossier médical, chemins de stockage) sont retirés par les mappers.

### UX mobile

- `src/features/messaging/messaging-screen.tsx` : écran React Native partagé pour patients et médecins, avec liste `FlatList`, avatar, interlocuteur, motif de demande, aperçu, date, non lus, ouverture d'un fil et retour.
- `src/app/patient/messages.tsx` et `src/app/medecin/messages.tsx` : wrappers natifs propres aux rôles ; Expo Router protège aussi les sections.
- Fil `FlatList`, bulles distinguant expéditeur et destinataire à partir de l'identifiant retourné par `GET /auth/profile`, date, autoscroll vers les nouveaux messages.
- Clavier Android : `KeyboardAvoidingView`, saisie multiligne ajustable, maximum de 4 000 caractères, indicateur d'envoi et protection contre les doubles clics.
- État du formulaire conservé si le POST échoue. L'envoi est confirmé **seulement** après réception d'un message serveur valide et correspondant au compte courant. Pas de message optimiste ni de nouvelle tentative automatique sur une erreur réseau ambiguë (pour éviter un doublon).
- Actualisation manuelle du fil et de la liste ; interrogation HTTP toutes les 15 secondes lorsque l'écran est focalisé. **Aucun WebSocket inventé.**
- Chargements, erreurs réseau, 401/403/404, refus de message invalide et état vide explicités sans reprendre les messages internes du serveur. Les messages reçus sont marqués lus par le serveur lors du GET du fil, et les compteurs sont rechargés depuis l'API.

### Isolation stricte entre comptes et conversations

- Le `GET /auth/profile` identifie d'abord le Firebase UID réel, avant de charger les conversations.
- Une conversation demandée via un paramètre de navigation est retenue seulement si l'ID apparaît dans `GET /messages/conversations`.
- `AbortController` et génération de requête sur la liste/le fil, plus un epoch de session `{userId,role,epoch}`, empêchent l'affichage de résultats tardifs d'un autre compte ou d'un fil précédemment consulté.
- Purge immédiate du profil, des conversations, des messages, du brouillon, des erreurs et des références de requête au changement d'onglet ou de compte. Aucun historique médical ni message n'est sauvegardé dans AsyncStorage, SecureStore, les paramètres de navigation ou Zustand.
- Les verrous d'envoi sont associés à l'epoch et à l'ID de conversation ; un envoi du compte précédent ne doit pas bloquer le compte suivant.
- La protection client **complète** les règles NestJS mais ne les remplace jamais.

### Tests automatisés

`src/features/messaging/messaging-model.ts` : validation du message, parseurs stricts, vérification de l'appartenance, contexte de session, déduplication, borne à 100, erreurs génériques.

`src/features/messaging/messaging-model.test.mjs` : rôles, limites 1–4000, filtrage des champs privés, isolation des conversations A/B entre comptes, rejet d'une réponse d'epoch antérieur, messages confirmés et ordonnés, plafond de 100, erreurs non divulguantes.

```bash
npm ci
npm run typecheck
npm run test:messaging
npm run check
npm run lint
npm run doctor
```

La CI exécute TypeScript et `test:messaging` avec les suites antérieures. Elle n'est **pas** un test E2E.

## Recette Android à faire avec deux comptes autorisés

- [ ] Connecter un patient avec une proposition active `sent` ou `pending`, consulter les conversations et ouvrir un fil.
- [ ] Connecter le médecin professionnellement **verified** correspondant ; vérifier que seuls ses échanges apparaissent.
- [ ] Envoyer un message patient → médecin, actualiser, confirmer la réception et les non lus ; répondre médecin → patient.
- [ ] Tester conversation inaccessible par ID manuellement et vérifier un 404 sans divulgation.
- [ ] Vérifier que le compte médecin `pending` et un compte `admin` sont refusés.
- [ ] Changer de compte pendant GET et POST ; garantir l'absence de fuite entre l'ancien et le nouveau.
- [ ] Tester texte vide, >4000 caractères, double tap et coupure réseau pendant un POST.
- [ ] Vérifier que le fil ne dépasse pas 100 messages ; absence de chargement fictif des messages plus anciens.
- [ ] Vérifier le clavier Android, autoscroll, rotation, police agrandie, TalkBack et retour.
- [ ] Vérifier la correspondance de style avec le web responsive authentifié.

**Reste non exécuté** : connexion réelle avec les comptes patient/médecin, échange de vrais messages, Android instrumenté, lint, Expo Doctor et comparaison visuelle Vercel. Ne pas fusionner la PR avant recette.
