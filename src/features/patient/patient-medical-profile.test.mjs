import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parsePatientProfile,viewPatientProfile,editingPatientProfile,validatePatientEdit,
 mapPatientConditions,mapPatientDocuments,validatePatientFile,patientProfileError,
} from './patient-medical-profile.ts';

const user={id:'p1',role:'patient',firstName:'Marie',lastName:'N.',phone:'670123456',email:'marie@example.org',status:'active'};
const sample={user,patient:{id:'p1',fullName:'Marie N.',dateOfBirth:null,gender:'undisclosed',
 bloodType:'unknown',verified:false,address:null}};

test('profile maps actual API placeholders without inventing address or verification',()=>{
 const p=parsePatientProfile(sample);const v=viewPatientProfile(p);
 assert.equal(v.name,'Marie N.');
 assert.equal(v.city,'Non renseignée');
 assert.equal(v.district,'Non renseigné');
 assert.equal(v.gender,'Non renseigné');
 assert.equal(v.bloodType,'Non renseigné');
 assert.equal(v.verified,false);
 assert.equal(v.dateOfBirth,'Non renseignée');
});
test('non-patient profile cannot be interpreted as patient data',()=>{
 assert.throws(()=>parsePatientProfile({...sample,user:{...user,role:'doctor'}}),/invalide/);
 assert.throws(()=>parsePatientProfile(sample,'someone-else'),/invalide/);
 assert.throws(()=>parsePatientProfile({user}),/indisponible/);
});
test('patient edit submits only existing writable contract fields',()=>{
 const p=parsePatientProfile({...sample,patient:{...sample.patient,address:{city:'Yaoundé',district:'Bastos'}}});
 const edit=editingPatientProfile(p);edit.name='Marie N. K.';edit.bloodType='o_positive';
 assert.deepEqual(validatePatientEdit(edit,p),{});
 assert.equal(Object.keys(edit).sort().join(','),'bloodType,city,district,name,phone');
 assert.equal(viewPatientProfile({...p,patient:{...p.patient,bloodType:'o_positive'}}).bloodType,'O+');
});
test('cannot invent an address for a profile with address null',()=>{
 const p=parsePatientProfile(sample);
 assert.match(validatePatientEdit({...editingPatientProfile(p),city:'Yaoundé'},p).location,/adresse/i);
 assert.deepEqual(validatePatientEdit(editingPatientProfile(p),p),{});
});
test('name and phone validate true PATCH contract',()=>{
 const p=parsePatientProfile(sample);
 const edit=editingPatientProfile(p);
 assert.ok(validatePatientEdit({...edit,name:'x',phone:'123'},p).name);
 assert.ok(validatePatientEdit({...edit,name:'Marie',phone:'123'},p).phone);
 assert.ok(validatePatientEdit({...edit,bloodType:'invalid'},p).bloodType);
});
test('medical conditions are read-only and must have valid backend status',()=>{
 assert.deepEqual(mapPatientConditions([]),[]);
 assert.deepEqual(mapPatientConditions([{id:'c1',name:'Hypertension',description:null,status:'controlled',diagnosedAt:null,notes:'Suivi'}]),[
  {id:'c1',name:'Hypertension',description:null,status:'controlled',diagnosedAt:null,notes:'Suivi'},
 ]);
 assert.throws(()=>mapPatientConditions([{id:'c1',name:'Condition',status:'unknown'}]),/invalide/);
});
test('patient documents map signed links only, never storage keys',()=>{
 const item={id:'d1',type:'lab_result',title:'Analyses',filename:'result.pdf',
  mimeType:'application/pdf',sizeBytes:1234,uploadedAt:'2026-11-13T00:00:00Z',
  downloadUrl:'https://example.org/signed?token=secret',storageKey:'private/bucket/key',ownerUserId:'p1'};
 const doc=mapPatientDocuments([item])[0];
 assert.equal(doc.downloadUrl,item.downloadUrl);
 assert.equal(Object.hasOwn(doc,'storageKey'),false);
 assert.equal(Object.hasOwn(doc,'ownerUserId'),false);
 assert.deepEqual(mapPatientDocuments([]),[]);
 assert.throws(()=>mapPatientDocuments({items:[item]}),/invalide/);
});
test('medical document picker respects exact server formats and 10MB',()=>{
 const valid={name:'result.pdf',uri:'file:///tmp/result.pdf',mimeType:'application/pdf',size:1024};
 assert.equal(validatePatientFile(valid),null);
 assert.equal(validatePatientFile({...valid,mimeType:'image/webp',size:10*1024*1024}),null);
 assert.match(validatePatientFile({...valid,mimeType:'image/heic'}),/Format/);
 assert.match(validatePatientFile({...valid,size:10*1024*1024+1}),/10 Mo/);
 assert.match(validatePatientFile({...valid,size:undefined}),/10 Mo/);
});
test('errors do not reveal medical or server internals',()=>{
 assert.match(patientProfileError({status:403,message:'private patient data'}),/accéder/);
 assert.match(patientProfileError({status:400,message:'storage secret'}),/refusées/);
 assert.doesNotMatch(patientProfileError({status:500,message:'storage secret'}),/secret/);
});
