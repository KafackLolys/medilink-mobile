import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MESSAGE_LENGTH, canUseMessaging, validateMessage,
  parseConversations,parseMessages,requireConversation,
  matchesMessagingScope,mergeMessages,messagingError,messageDate,
} from './messaging-model.ts';

const cA={id:'conv-A',peerUserId:'doctor-1',peerName:'Médecin A',
  requestId:'need-A',requestTitle:'Consultation',preview:'Bonjour',
  lastMessageAt:'2026-11-13T08:00:00Z',unreadCount:2};
const cB={id:'conv-B',peerUserId:'doctor-2',peerName:'Médecin B',
  requestId:'need-B',requestTitle:'Suivi',preview:'Bonsoir',
  lastMessageAt:null,unreadCount:0};
const msg=(id,senderUserId,body,sentAt)=>({id,senderUserId,body,sentAt,readAt:null});

test('only patient and doctor have a messaging role; admins excluded',()=>{
 assert.equal(canUseMessaging('patient'),true);
 assert.equal(canUseMessaging('doctor'),true);
 assert.equal(canUseMessaging('admin'),false);
 assert.equal(canUseMessaging(null),false);
});
test('body trimming and 4000 character hard limit match NestJS',()=>{
 assert.equal(MAX_MESSAGE_LENGTH,4000);
 assert.deepEqual(validateMessage('  Bonjour  '),{text:'Bonjour',error:null});
 assert.ok(validateMessage('   ').error);
 assert.equal(validateMessage('x'.repeat(4000)).error,null);
 assert.ok(validateMessage('x'.repeat(4001)).error);
 assert.ok(validateMessage(' x'.repeat(4000)).error);
});
test('conversation responses are strict lists and omit internal patient/proposal context',()=>{
 const result=parseConversations({items:[{...cA,patientMedicalHistory:'SECRET',phone:'PRIVATE'}]});
 assert.equal(result.length,1);
 assert.equal(result[0].id,'conv-A');
 assert.equal(Object.hasOwn(result[0],'phone'),false);
 assert.equal(Object.hasOwn(result[0],'patientMedicalHistory'),false);
 assert.throws(()=>parseConversations({items:[{...cA,unreadCount:-1}]}),/invalide/);
 assert.throws(()=>parseConversations({items:'bad'}),/invalides/);
});
test('conversation selection accepts only IDs from current authorized server list',()=>{
 const list=parseConversations({items:[cA]});
 assert.equal(requireConversation(list,'conv-A')?.peerName,'Médecin A');
 assert.equal(requireConversation(list,'conv-B'),null);
 assert.equal(requireConversation(list,''),null);
});
test('late responses cannot cross user, role, or login generation',()=>{
 const old={userId:'patient-1',role:'patient',epoch:10};
 assert.equal(matchesMessagingScope(old,{...old}),true);
 assert.equal(matchesMessagingScope(old,{...old,epoch:11}),false);
 assert.equal(matchesMessagingScope(old,{...old,userId:'patient-2'}),false);
 assert.equal(matchesMessagingScope(old,{...old,role:'doctor'}),false);
 assert.equal(matchesMessagingScope(old,null),false);
});
test('different accounts cannot select their previous conversations',()=>{
 const first=parseConversations({items:[cA]});
 const second=parseConversations({items:[cB]});
 assert.ok(requireConversation(first,'conv-A'));
 assert.equal(requireConversation(second,'conv-A'),null);
 const old={userId:'patient-1',role:'patient',epoch:1};
 const next={userId:'patient-2',role:'patient',epoch:2};
 assert.equal(matchesMessagingScope(old,next),false);
});
test('messages are read from API and mapping strips internal receiver/medical fields',()=>{
 const input={...msg('m1','patient-1','Bonjour','2026-11-13T08:01:00Z'),
   receiverUserId:'doctor-1',storageKey:'SECRET'};
 const result=parseMessages({items:[input]});
 assert.equal(result.length,1);
 assert.equal(result[0].body,'Bonjour');
 assert.equal(Object.hasOwn(result[0],'receiverUserId'),false);
 assert.equal(Object.hasOwn(result[0],'storageKey'),false);
 assert.throws(()=>parseMessages({items:[{...input,body:null}]}),/invalide/);
});
test('confirmed sends are de-duplicated by server message ID and ordered by timestamps',()=>{
 const existing=[msg('m2','doctor-1','Salut','2026-11-13T08:02:00Z')];
 const later=[msg('m1','patient-1','Bonjour','2026-11-13T08:01:00Z'),
   msg('m2','doctor-1','Salut','2026-11-13T08:02:00Z')];
 const merged=mergeMessages(existing,later);
 assert.deepEqual(merged.map(x=>x.id),['m1','m2']);
 assert.equal(merged.length,2);
});
test('error messages do not disclose inaccessible conversations or server secrets',()=>{
 assert.match(messagingError({status:403,message:'private patient medical data'}),/autorisé/);
 assert.match(messagingError({status:404}),/inaccessible/);
 assert.match(messagingError({kind:'network'}),/Connexion/);
 assert.doesNotMatch(messagingError({status:500,message:'SECRET'}),/SECRET/);
 assert.match(messageDate('2026-11-13T08:00:00Z'),/13\/11/);
 assert.equal(messageDate(null),'');
});
