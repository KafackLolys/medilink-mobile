import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doctorNeedsAllowed, parseDoctorNeedFilters, parseDoctorNeedsPage, parseDoctorNeedDetail,
  parseProposalsPage, validateProposal, canCancelDoctorProposal, doctorNeedsError,
  PRIORITY_LABELS, PROPOSAL_STATUSES, dateTimeDisplay,
} from './doctor-needs.ts';

const need={id:'need-1',title:'Douleurs',summary:'Douleurs articulaires',
  specialty:'Cardiologie',city:'Yaoundé',district:'Bastos',
  mode:'home',priority:'routine',publishedAt:'2026-11-13T07:00:00.000Z',
  documentsCount:1,availableFrom:null};
const page={items:[need],specialties:['Cardiologie'],page:1,pageSize:10,total:23,totalPages:3};

test('patient needs access requires doctor role AND verified professional status',()=>{
  for(const role of ['patient','admin','doctor',null]){
    for(const status of ['pending','verified','rejected','suspended']){
      assert.equal(doctorNeedsAllowed(role,status),role==='doctor'&&status==='verified');
    }
  }
});
test('backend filtering only accepts q specialty priority mode with 100 char maximum',()=>{
  assert.deepEqual(parseDoctorNeedFilters({q:'  douleurs  ',specialty:'  Pédiatrie  ',
    priority:'urgent',mode:'teleconsultation'}),{
    q:'douleurs',specialty:'Pédiatrie',priority:'urgent',mode:'teleconsultation',
  });
  assert.deepEqual(parseDoctorNeedFilters({}),{});
  assert.throws(()=>parseDoctorNeedFilters({q:'a'.repeat(101)}),/100/);
  assert.throws(()=>parseDoctorNeedFilters({priority:'nonexistent'}),/Priorité/);
  assert.throws(()=>parseDoctorNeedFilters({mode:'other'}),/Mode/);
  assert.deepEqual(Object.keys(PRIORITY_LABELS).sort(),['emergency','routine','urgent']);
});
test('server pagination totals are not page item length',()=>{
  const parsed=parseDoctorNeedsPage(page);
  assert.equal(parsed.total,23);assert.equal(parsed.items.length,1);
  assert.deepEqual(parsed.specialties,['Cardiologie']);
  assert.throws(()=>parseDoctorNeedsPage({...page,items:[need],total:'23'}),/invalide/);
  assert.throws(()=>parseDoctorNeedsPage({...page,specialties:'Cardiologie'}),/spécialités/);
  assert.throws(()=>parseDoctorNeedsPage({...page,pageSize:51}),/invalide/);
});
test('list strips private fields even if server accidentally adds them',()=>{
  const result=parseDoctorNeedsPage({...page,items:[{...need,
    privateAddress:'SECRET',phone:'+237...',ownerUserId:'patient-secret',
    attachments:[{storagePath:'private-key'}]}]}).items[0];
  for(const key of ['privateAddress','phone','ownerUserId','attachments']){
    assert.equal(Object.hasOwn(result,key),false,key);
  }
});
test('need detail requires an open authorized need and strips sensitive identity fields',()=>{
  const value={id:'need-1',title:'Douleur',description:'Douleurs depuis deux jours',
    specialty:'Généraliste',city:'Yaoundé',district:'Bastos',priority:'urgent',
    mode:'domicile',status:'awaiting_proposals',createdAt:'2026-11-13T07:00:00Z',
    symptoms:['Fatigue'],durationDescription:null,availableFrom:null,
    attachments:[{id:'doc-1',fileName:'bilan.pdf',mimeType:'application/pdf',
      sizeBytes:100,downloadUrl:'https://example.org/signed'}],
    ownerUserId:'SECRET',privateAddress:'SECRET',email:'SECRET',
    patient:{id:'SECRET'},storagePath:'SECRET'};
  const mapped=parseDoctorNeedDetail(value);
  assert.equal(mapped.attachments.length,1);
  assert.equal(mapped.privateAddress,undefined);
  for(const key of ['ownerUserId','privateAddress','email','patient','storagePath']){
    assert.equal(Object.hasOwn(mapped,key),false);
  }
  assert.throws(()=>parseDoctorNeedDetail({...value,status:'closed'}),/invalide/);
  assert.throws(()=>parseDoctorNeedDetail({...value,attachments:null}),/invalide/);
});
test('proposal creation validates message, appointment future, modes and fee',()=>{
  const now=Date.parse('2026-11-13T07:00:00Z');
  const form={message:'Je propose une consultation.',date:'2026-11-20',time:'10:00',
    consultationMode:'home',fee:'15000',details:'Merci'};
  const good=validateProposal(form,now);
  assert.deepEqual(good.errors,{});
  assert.equal(good.payload?.fee,15000);
  assert.equal(good.payload?.message,form.message);
  assert.equal(good.payload?.details,'Merci');
  assert.equal(good.payload?.proposedAppointmentAt,new Date('2026-11-20T10:00:00').toISOString());
  assert.ok(validateProposal({...form,message:'court'},now).errors.message);
  assert.ok(validateProposal({...form,fee:'-1'},now).errors.fee);
  assert.ok(validateProposal({...form,fee:''},now).errors.fee);
  assert.ok(validateProposal({...form,date:'2026-02-30'},now).errors.date);
  assert.ok(validateProposal({...form,time:'25:90'},now).errors.date);
  assert.ok(validateProposal({...form,details:'x'.repeat(2001)},now).errors.details);
  assert.ok(validateProposal({...form,consultationMode:'invalid'},now).errors.mode);
});
test('cancel allowed only for sent and pending, always server authorized',()=>{
  for(const status of PROPOSAL_STATUSES)assert.equal(canCancelDoctorProposal(status),
    status==='sent'||status==='pending',status);
});
test('proposals status filter counters and pagination from the real response',()=>{
  const counts=Object.fromEntries(PROPOSAL_STATUSES.map(status=>[status,status==='pending'?7:0]));
  const proposal={id:'proposal-1',needId:'need-1',needTitle:'Douleur',specialty:'Généraliste',
    city:'Yaoundé',district:'Bastos',status:'pending',message:'Je suis disponible.',
    proposedAt:'2026-11-13T08:00:00Z',proposedAppointmentAt:'2026-11-20T09:00:00Z',
    consultationMode:'home',fee:15000,currency:'XAF',patientResponse:null,respondedAt:null};
  const result=parseProposalsPage({items:[{...proposal,ownerUserId:'PRIVATE'}],
    counts,page:1,pageSize:10,total:7,totalPages:1});
  assert.equal(result.total,7);assert.equal(result.items.length,1);
  assert.equal(result.counts.pending,7);
  assert.equal(Object.hasOwn(result.items[0],'ownerUserId'),false);
  assert.throws(()=>parseProposalsPage({items:[],counts:{},page:1,pageSize:10,total:0,totalPages:0}),/Compteur/);
});
test('status errors and conflicts are friendly, no leak of secret backend messages',()=>{
  assert.match(doctorNeedsError({status:403}),/vérifié/);
  assert.match(doctorNeedsError({status:404}),/plus disponible/);
  assert.match(doctorNeedsError({status:409}),/déjà envoyé/);
  assert.match(doctorNeedsError({status:400}),/autorisé/);
  assert.match(doctorNeedsError({kind:'network'}),/Connexion/);
  assert.doesNotMatch(doctorNeedsError({status:500,message:'sensitive_token'}),/sensitive_token/);
  assert.equal(dateTimeDisplay(null),'Non précisée');
});
