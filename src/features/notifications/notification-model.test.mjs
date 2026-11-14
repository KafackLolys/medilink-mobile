import test from 'node:test';
import assert from 'node:assert/strict';
import {
 canUseNotifications,parseNotificationPage,destinationForNotification,
 validateDeviceRegistration,notificationError,NOTIFICATION_PAGE_SIZE,
} from './notification-model.ts';
const example={id:'n1',type:'new_message',title:'Un message',body:'Consultez votre messagerie',
 createdAt:'2026-11-13T11:00:00Z',readAt:null,targetUrl:'/medecin?tab=messages&conversation=abc123'};
test('notifications available to patient or doctor only',()=>{
 assert.equal(canUseNotifications('patient'),true);assert.equal(canUseNotifications('doctor'),true);
 assert.equal(canUseNotifications('admin'),false);assert.equal(canUseNotifications(null),false);
});
test('server pagination and unread counts are authoritative',()=>{
 const p=parseNotificationPage({items:[example],page:2,pageSize:20,total:31,totalPages:2,unreadCount:17});
 assert.equal(NOTIFICATION_PAGE_SIZE,20);assert.equal(p.total,31);assert.equal(p.unreadCount,17);
 assert.equal(Object.hasOwn(p.items[0],'userId'),false);
 assert.throws(()=>parseNotificationPage({items:[],page:1,pageSize:60,total:0,totalPages:0,unreadCount:0}),/invalide/);
 assert.throws(()=>parseNotificationPage({items:[{...example,type:'evil'}],page:1,pageSize:20,total:1,totalPages:1,unreadCount:0}),/invalide/);
});
test('routes are role-scoped and reject external URLs or traversal',()=>{
 assert.equal(destinationForNotification('/patient/profil?activeContent=messages&conversation=abc','patient'),'/patient/messages?conversation=abc');
 assert.equal(destinationForNotification('/medecin?tab=messages&conversation=xyz','doctor'),'/medecin/messages?conversation=xyz');
 assert.equal(destinationForNotification('/medecin?tab=messages','doctor'),'/medecin/messages');
 assert.equal(destinationForNotification('/patient/rendez-vous/abc-1','patient'),'/patient/rendez-vous/abc-1');
 for(const malicious of ['https://evil.test/phish','//evil.test','/admin','/patient/../admin','/patient/%2e%2e/admin','/patient/%2fadmin','javascript:alert(1)','/medecin/messages']){
  assert.equal(destinationForNotification(malicious,'patient'),null,malicious);
 }
 assert.equal(destinationForNotification('/patient/profil','doctor'),null);
 assert.equal(destinationForNotification('/patient/profil','admin'),null);
});
test('FCM device registration matches exact NestJS API constraints',()=>{
 const valid={deviceId:'medilink_1234567890abcdef',token:'fcm-native-token-'.padEnd(30,'x'),platform:'mobile'};
 assert.equal(validateDeviceRegistration(valid),true);
 assert.equal(validateDeviceRegistration({...valid,platform:'expo'}),false);
 assert.equal(validateDeviceRegistration({...valid,deviceId:'short'}),false);
 assert.equal(validateDeviceRegistration({...valid,token:'x'}),false);
 assert.equal(validateDeviceRegistration({...valid,token:'x'.repeat(4097)}),false);
});
test('errors do not show FCM tokens or server internal details',()=>{
 assert.match(notificationError({status:403,message:'secret-token'}),/refusé/);
 assert.match(notificationError({kind:'network'}),/Connexion/);
 assert.doesNotMatch(notificationError({status:500,message:'SECRET_FCM_TOKEN'}),/SECRET/);
});
