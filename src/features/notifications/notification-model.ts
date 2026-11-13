import type { NotificationPage, UserNotification } from '../../types/domain';
export const NOTIFICATION_PAGE_SIZE=20;
export const NOTIFICATION_DEVICE_ID_KEY='medilink.push.device-id.v1';
export const NOTIFICATION_TYPES=['relevant_need','proposal_received','proposal_accepted','appointment_updated','new_message','system'] as const;
export function parseNotificationPage(value:unknown):NotificationPage {
 if(!value||typeof value!=='object')throw Error('Notifications indisponibles');
 const p=value as Partial<NotificationPage>;
 if(!Array.isArray(p.items)||!Number.isSafeInteger(p.page)||(p.page??0)<1||!Number.isSafeInteger(p.pageSize)||(p.pageSize??0)<1||(p.pageSize??0)>50||!Number.isSafeInteger(p.total)||(p.total??-1)<0||!Number.isSafeInteger(p.totalPages)||(p.totalPages??-1)<0||!Number.isSafeInteger(p.unreadCount)||(p.unreadCount??-1)<0)throw Error('Réponse de notifications invalide');
 const items=p.items.map(n=>{
   if(!n||typeof n.id!=='string'||!n.id||typeof n.title!=='string'||typeof n.body!=='string'||typeof n.createdAt!=='string'||!(n.readAt===null||typeof n.readAt==='string')||!(n.targetUrl===null||typeof n.targetUrl==='string')||!NOTIFICATION_TYPES.includes(n.type as typeof NOTIFICATION_TYPES[number]))throw Error('Notification invalide');
   return {id:n.id,title:n.title,body:n.body,type:n.type,createdAt:n.createdAt,readAt:n.readAt,targetUrl:n.targetUrl} as UserNotification;
 });
 return {items,page:p.page!,pageSize:p.pageSize!,total:p.total!,totalPages:p.totalPages!,unreadCount:p.unreadCount!};
}
export function canUseNotifications(role:string|null):role is 'patient'|'doctor'{return role==='patient'||role==='doctor';}
export function validateDeviceRegistration(input:{deviceId:string;token:string;platform:string}){
 return /^[A-Za-z0-9_-]{16,100}$/.test(input.deviceId)&&input.token.length>=20&&input.token.length<=4096&&input.platform==='mobile';
}
/** Reject absolute URLs, traversal, protocol-relative URLs, and paths not explicitly in this role. */
export function destinationForNotification(url:string|null|undefined,role:string):string|null{
 if(!canUseNotifications(role)||!url||typeof url!=='string'||!url.startsWith('/')||url.startsWith('//')||url.includes('\\')||url.includes('..'))return null;
 let parsed:URL;
 try{parsed=new URL(url,'https://medilink.local');}catch{return null;}
 if(parsed.origin!=='https://medilink.local')return null;
 const path=parsed.pathname.replace(/\/$/,'')||'/';
 const part=(p:string)=>p.split('/').every(x=>x.length<120);
 if(!part(path)||/%2f|%5c|%2e/i.test(path))return null;
 if(role==='patient'){
  if(path==='/patient/profil'||path==='/patient/messages')return parsed.searchParams.get('conversation')?'/patient/messages?conversation='+encodeURIComponent(parsed.searchParams.get('conversation')!):path;
  if(path==='/patient/rendez-vous'||path==='/patient/demandes'||path==='/patient/notifications')return path;
  if(/^\/patient\/rendez-vous\/[A-Za-z0-9_-]+$/.test(path)||/^\/patient\/demandes\/[A-Za-z0-9_-]+$/.test(path))return path;
  return null;
 }
 if(path==='/medecin'||path==='/medecin/messages')return parsed.searchParams.get('conversation')?'/medecin/messages?conversation='+encodeURIComponent(parsed.searchParams.get('conversation')!):path;
 if(['/medecin/rendez-vous','/medecin/besoins','/medecin/propositions','/medecin/notifications'].includes(path))return path;
 if(/^\/medecin\/besoins\/[A-Za-z0-9_-]+$/.test(path))return path;
 return null;
}
export function notificationError(e:unknown){
 const x=e as {status?:number;kind?:string}|null;
 if(x?.status===401||x?.status===403)return 'Accès aux notifications refusé.';
 if(x?.status===404)return 'Notification introuvable.';
 if(x?.kind==='network'||x?.kind==='timeout')return 'Connexion impossible. Réessayez.';
 return 'Impossible de traiter les notifications. Réessayez.';
}
