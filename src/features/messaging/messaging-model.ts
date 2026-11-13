import type { Conversation, ConversationMessage } from '../../types/domain';

export const MAX_MESSAGE_LENGTH = 4000;
export type MessagingRole = 'patient'|'doctor';
export type ConversationScope={userId:string;role:MessagingRole;epoch:number};
export const canUseMessaging=(role:string|null):role is MessagingRole=>role==='doctor'||role==='patient';
export function validateMessage(body:string):{text:string;error:string|null}{
  const text=body.trim();
  return {text,error:text.length===0?'Écrivez un message avant de l’envoyer.':
    text.length>MAX_MESSAGE_LENGTH?'Le message est limité à 4 000 caractères.':null};
}
export function parseConversations(raw:unknown):Conversation[]{
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {items?:unknown}).items))
    throw new Error('Conversations invalides.');
  return (raw as {items:unknown[]}).items.map(item=>{
    if(!item||typeof item!=='object')throw new Error('Conversation invalide.');
    const c=item as Record<string,unknown>;
    if(typeof c.id!=='string'||!c.id||typeof c.peerUserId!=='string'||
      typeof c.peerName!=='string'||typeof c.requestId!=='string'||
      typeof c.requestTitle!=='string'||typeof c.preview!=='string'||
      !Number.isSafeInteger(c.unreadCount)||(c.unreadCount as number)<0||
      !(c.lastMessageAt===null||typeof c.lastMessageAt==='string'))throw new Error('Conversation invalide.');
    return {id:c.id,peerUserId:c.peerUserId,peerName:c.peerName,
      requestId:c.requestId,requestTitle:c.requestTitle,preview:c.preview,
      lastMessageAt:c.lastMessageAt,unreadCount:c.unreadCount} as Conversation;
  });
}
export function parseMessages(raw:unknown):ConversationMessage[]{
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {items?:unknown}).items))
    throw new Error('Fil de discussion invalide.');
  return (raw as {items:unknown[]}).items.map(item=>{
    if(!item||typeof item!=='object')throw new Error('Message invalide.');
    const m=item as Record<string,unknown>;
    if(typeof m.id!=='string'||!m.id||typeof m.senderUserId!=='string'||
      typeof m.body!=='string'||typeof m.sentAt!=='string'||
      !(m.readAt===null||typeof m.readAt==='string'))throw new Error('Message invalide.');
    return {id:m.id,senderUserId:m.senderUserId,body:m.body,
      sentAt:m.sentAt,readAt:m.readAt} as ConversationMessage;
  });
}
export function requireConversation(conversations:Conversation[],id:string):Conversation|null{
  return conversations.find(c=>c.id===id)??null;
}
export function matchesMessagingScope(expected:ConversationScope,current:ConversationScope|null){
  return !!current&&current.userId===expected.userId&&current.role===expected.role&&current.epoch===expected.epoch;
}
export function mergeMessages(existing:ConversationMessage[],next:ConversationMessage[]):ConversationMessage[]{
  const map=new Map(existing.map(x=>[x.id,x]));
  for(const m of next)map.set(m.id,m);
  return [...map.values()].sort((a,b)=>{
    const d=Date.parse(a.sentAt)-Date.parse(b.sentAt);
    return Number.isNaN(d)?a.id.localeCompare(b.id):d||a.id.localeCompare(b.id);
  });
}
export function messagingError(error:unknown){
  const e=error as {status?:number;kind?:string}|null;
  if(e?.status===403||e?.status===401)return 'Votre compte n’est pas autorisé à consulter cette conversation.';
  if(e?.status===404)return 'Conversation introuvable ou devenue inaccessible.';
  if(e?.status===400||e?.status===422)return 'Message refusé. Vérifiez sa longueur et réessayez.';
  if(e?.kind==='network'||e?.kind==='timeout')return 'Connexion indisponible. Vérifiez votre réseau.';
  return 'Impossible de charger ou envoyer les messages. Réessayez.';
}
export function messageDate(iso:string|null){
  if(!iso||!Number.isFinite(Date.parse(iso)))return '';
  return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
}
