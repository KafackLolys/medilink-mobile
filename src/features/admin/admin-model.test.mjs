import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ADMIN_PAGE_SIZE,ADMIN_ACCOUNT_STATUSES,ADMIN_VERIFICATION_STATUSES,
 normalizeAccountStatus,parseAdminPage,validAdminSearch,
 actionableAdminChange,adminActionWarning,adminError,
} from './admin-model.ts';

const patient={id:'patient-1',firstName:'Alice',lastName:'Exemple',email:'alice@example.com',
 phone:null,role:'patient',status:'pending',emailVerified:false,
 verificationStatus:null,createdAt:'2026-11-10T10:00:00Z'};
const doctor={...patient,id:'doctor-1',firstName:'Docteur',role:'doctor',
 status:'pending',verificationStatus:'pending'};
const page=(items)=>({items,page:1,pageSize:10,total:items.length,totalPages:items.length?1:0});

test('admin API list maps only patient/doctor, with real pagination 10 and max 50',()=>{
 assert.equal(ADMIN_PAGE_SIZE,10);
 const parsed=parseAdminPage(page([patient]),'patient');
 assert.equal(parsed.total,1);assert.equal(parsed.pageSize,10);
 assert.deepEqual(parsed.items,[patient]);
 assert.deepEqual(parseAdminPage(page([]),'doctor').items,[]);
 assert.throws(()=>parseAdminPage({...page([patient]),pageSize:51},'patient'),/Pagination/);
 assert.throws(()=>parseAdminPage({...page([patient]),page:0},'patient'),/Pagination/);
 assert.throws(()=>parseAdminPage(page([doctor]),'patient'),/Compte invalide/);
});
test('ignore unexpected private fields returned by an admin query',()=>{
 const raw={...patient,password:'SECRET',firebaseRefreshToken:'SECRET',medicalHistory:'SECRET'};
 const parsed=parseAdminPage(page([raw]),'patient').items[0];
 assert.equal(Object.hasOwn(parsed,'password'),false);
 assert.equal(Object.hasOwn(parsed,'firebaseRefreshToken'),false);
 assert.equal(Object.hasOwn(parsed,'medicalHistory'),false);
});
test('strict backend status and verification options; historical verified normalization',()=>{
 assert.deepEqual(ADMIN_ACCOUNT_STATUSES,['active','pending','suspended','deleted']);
 assert.deepEqual(ADMIN_VERIFICATION_STATUSES,['pending','verified','rejected','suspended']);
 assert.equal(normalizeAccountStatus({...doctor,status:'verified',verificationStatus:'verified'}),'active');
 assert.equal(normalizeAccountStatus({...doctor,status:'verified',verificationStatus:'pending'}),'pending');
 assert.equal(normalizeAccountStatus(patient),'pending');
 assert.throws(()=>parseAdminPage(page([{...doctor,status:'disabled'}]),'doctor'),/Compte invalide/);
 assert.throws(()=>parseAdminPage(page([{...doctor,verificationStatus:'malformed'}]),'doctor'),/Compte invalide/);
});
test('only valid, changed status or verification can be submitted for the right role',()=>{
 assert.equal(actionableAdminChange({type:'status',account:patient,value:'suspended'}),true);
 assert.equal(actionableAdminChange({type:'status',account:patient,value:'pending'}),false);
 assert.equal(actionableAdminChange({type:'status',account:patient,value:'verified'}),false);
 assert.equal(actionableAdminChange({type:'patient-verification',account:patient,value:true}),true);
 assert.equal(actionableAdminChange({type:'patient-verification',account:patient,value:false}),false);
 assert.equal(actionableAdminChange({type:'patient-verification',account:doctor,value:true}),false);
 assert.equal(actionableAdminChange({type:'doctor-verification',account:doctor,value:'verified'}),true);
 assert.equal(actionableAdminChange({type:'doctor-verification',account:doctor,value:'pending'}),false);
 assert.equal(actionableAdminChange({type:'doctor-verification',account:patient,value:'verified'}),false);
});
test('sensitive operations clearly explain Firebase side effects before confirmation',()=>{
 const suspend=adminActionWarning({type:'status',account:doctor,value:'suspended'});
 assert.match(suspend,/révoque/);
 const remove=adminActionWarning({type:'status',account:patient,value:'deleted'});
 assert.match(remove,/désactive/);
 const verifyDoctor=adminActionWarning({type:'doctor-verification',account:doctor,value:'verified'});
 assert.match(verifyDoctor,/ne réactive pas un compte suspendu/);
 const verifyEmail=adminActionWarning({type:'patient-verification',account:patient,value:true});
 assert.match(verifyEmail,/Firebase Auth/);
});
test('server search restricts q to <=100 characters, role admin never user selectable',()=>{
 assert.equal(validAdminSearch('a'.repeat(100)),true);
 assert.equal(validAdminSearch('a'.repeat(101)),false);
 assert.equal(parseAdminPage(page([patient]),'patient').items[0].role,'patient');
});
test('403, 409 and split Firestore/Firebase 503 remain safe; no raw credentials leaked',()=>{
 assert.match(adminError({status:403,message:'PRIVATE_SECRET'}),/interdit/);
 assert.match(adminError({status:409}),/ne peut pas/);
 assert.match(adminError({status:503}),/synchronisation Firebase/);
 assert.match(adminError({kind:'network'}),/Connexion/);
 assert.doesNotMatch(adminError({status:500,message:'SECRET_FIREBASE_ADMIN'}),/SECRET/);
});
