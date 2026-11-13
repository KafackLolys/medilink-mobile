import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditNeed, canCloseNeed, canDeleteNeed, filterPatientNeeds, validateNeedCreation,
  validateNeedEdit, validateNeedAttachments, EMPTY_NEED_FORM, safeNeedError,
} from './need-model.ts';

const statuses=['draft','published','awaiting_proposals','proposals_received',
  'appointment_confirmed','closed','cancelled'];
test('status transitions match NestJS service guards',()=>{
  assert.deepEqual(statuses.filter(canEditNeed),['draft','published','awaiting_proposals','proposals_received']);
  assert.deepEqual(statuses.filter(canCloseNeed),['published','awaiting_proposals','proposals_received']);
  assert.deepEqual(statuses.filter(canDeleteNeed),['draft']);
});
test('tab filtering excludes completed requests from active set',()=>{
  const items=statuses.map((status,index)=>({id:String(index),status,interested:0}));
  assert.equal(filterPatientNeeds(items,'all').length,7);
  assert.deepEqual(filterPatientNeeds(items,'active').map(x=>x.status),['published','awaiting_proposals','proposals_received']);
  assert.deepEqual(filterPatientNeeds(items,'confirmed').map(x=>x.status),['appointment_confirmed']);
  assert.deepEqual(filterPatientNeeds(items,'draft').map(x=>x.status),['draft']);
  assert.deepEqual(filterPatientNeeds(items,'closed').map(x=>x.status),['closed','cancelled']);
});
const valid={...EMPTY_NEED_FORM,title:'Demande médicale',specialty:'Pédiatrie',description:'Douleurs présentes depuis plusieurs jours.',city:'Yaoundé',
  district:'Bastos',consent:true};
test('valid create request matches multipart body requirements',()=>{
  assert.deepEqual(validateNeedCreation(valid),{});
});
test('backend rejects emergency priority and missing consent and details',()=>{
  const errors=validateNeedCreation({...EMPTY_NEED_FORM,priority:'urgence'});
  for(const field of ['title','specialty','description','city','district','priority','consent'])assert.ok(errors[field],field);
  assert.ok(validateNeedCreation({...valid,description:'short'}).description);
  assert.ok(validateNeedCreation({...valid,description:'x'.repeat(801)}).description);
});
test('update accepts exactly the editable fields',()=>{
  assert.deepEqual(validateNeedEdit({title:'Demande modifiée',specialty:'Cardiologie',
    description:'Description modifiée plus longue que vingt caractères.',mode:'tele'}),{});
  assert.ok(validateNeedEdit({title:'a',specialty:'',description:'court',mode:'domicile'}).title);
});
const f=(mimeType='application/pdf',size=1024)=>({uri:'file:///data/a.pdf',name:'a.pdf',mimeType,size});
test('upload accepts five allowed files and rejects six',()=>{
  assert.equal(validateNeedAttachments([f(),f(),f(),f(),f()]),null);
  assert.match(validateNeedAttachments(Array(6).fill(f())),/5/);
});
test('upload rejects oversized, missing size and disallowed file MIME',()=>{
  assert.match(validateNeedAttachments([f('application/pdf',10*1024*1024+1)]),/10 Mo/);
  assert.match(validateNeedAttachments([f('application/zip')]),/Formats/);
  assert.match(validateNeedAttachments([{...f(),size:undefined}]),/Taille/);
  assert.equal(validateNeedAttachments([f('image/jpeg',10*1024*1024)]),null);
  assert.equal(validateNeedAttachments([f('image/heic')]),null);
});
test('failed uploads and backend rejection do not disclose raw infrastructure errors',()=>{
  assert.match(safeNeedError({status:413}),/traiter/);
  assert.match(safeNeedError({status:403,message:'internal secret'}),/autorisé/);
  assert.match(safeNeedError({status:422,message:'DB secret'}),/état actuel/);
  assert.match(safeNeedError({kind:'network',message:'token xyz'}),/réseau/);
});
