import test from 'node:test';
import assert from 'node:assert/strict';
import {
 reviewEligible,validateReview,parsePatientReview,parseDoctorReviewSummary,
 patientReviewAppointments,doctorCompletedHistory,patientCompletedHistory,reviewError,
} from './reviews-model.ts';

const appointment={id:'a1',doctor:{id:'d1',name:'Docteur',specialty:'Cardiologie',professionalAddress:null},
 scheduledAt:'2026-11-11T10:00:00.000Z',durationMinutes:30,consultationMode:'home',status:'completed',
 fee:12000,currency:'XAF',reason:null};
const review={id:'a1',rating:5,comment:'Très bon accueil'};
const doctorAppointment={id:'a1',date:'2026-11-11',time:'11:00',
 patient:'Patient',district:null,mode:'À domicile',status:'completed'};

test('only completed appointments can receive a review',()=>{
 for(const status of ['pending_confirmation','confirmed','completed','cancelled','rejected','no_show']){
  assert.equal(reviewEligible({status}),status==='completed',status);
 }
});
test('review rating integer 1-5, comment optional and 2000 max',()=>{
 for(const rating of [1,2,3,4,5]){
  const r=validateReview(rating,'  Merci  ');
  assert.deepEqual(r.errors,{});
  assert.deepEqual(r.body,{rating,comment:'Merci'});
 }
 for(const rating of [0,6,3.5,NaN,Infinity]){
  assert.ok(validateReview(rating,'').errors.rating);
 }
 assert.equal(validateReview(5,'   ').body.comment,null);
 assert.equal(validateReview(5,'a'.repeat(2000)).errors.comment,undefined);
 assert.ok(validateReview(5,'a'.repeat(2001)).errors.comment);
});
test('GET review null means no review; response validated and private fields stripped',()=>{
 assert.equal(parsePatientReview(null),null);
 assert.deepEqual(parsePatientReview({...review,patientProfileId:'SECRET',doctorInternal:'SECRET'}),review);
 for(const raw of [{...review,rating:0},{...review,rating:2.1},{...review,comment:4},{id:'',rating:5,comment:null}]){
  assert.throws(()=>parsePatientReview(raw),/invalide/);
 }
});
test('doctor aggregate is entirely backend authoritative including distribution',()=>{
 const item={id:'a1',appointmentId:'a1',rating:5,comment:'Merci',
 createdAt:'2026-11-11T10:00:00.000Z',patientLabel:'Patient'};
 const distribution={1:0,2:0,3:0,4:0,5:1};
 const s=parseDoctorReviewSummary({rating:4.75,total:1,distribution,
  items:[{...item,patientEmail:'PRIVATE',patientMedicalHistory:'SECRET'}]});
 assert.equal(s.rating,4.75); // Not recalculated from review items.
 assert.equal(s.total,1);
 assert.equal(s.distribution[5],1);
 assert.equal(Object.hasOwn(s.items[0],'patientEmail'),false);
 assert.equal(Object.hasOwn(s.items[0],'patientMedicalHistory'),false);
 assert.equal(s.items[0].patientLabel,'Patient');
});
test('doctor review summary rejects malformed distribution, fabricated counts and ratings',()=>{
 const base={rating:null,total:0,distribution:{1:0,2:0,3:0,4:0,5:0},items:[]};
 assert.equal(parseDoctorReviewSummary(base).rating,null);
 assert.throws(()=>parseDoctorReviewSummary({...base,total:1}),/incohérentes/);
 assert.throws(()=>parseDoctorReviewSummary({...base,rating:5}),/incohérentes/);
 assert.throws(()=>parseDoctorReviewSummary({...base,distribution:{1:0}}),/invalide/);
 assert.throws(()=>parseDoctorReviewSummary({...base,rating:6}),/invalides/);
});
test('patient consultations filtered by completed status and doctor',()=>{
 const cancelled={...appointment,id:'a2',status:'cancelled'};
 const completedOther={...appointment,id:'a3',doctor:{...appointment.doctor,id:'d2'},
 scheduledAt:'2026-10-12T11:00:00.000Z'};
 const matched=patientReviewAppointments([cancelled,completedOther,appointment],'d1');
 assert.deepEqual(matched.map(x=>x.id),['a1']);
 assert.deepEqual(patientCompletedHistory([appointment,completedOther,cancelled],'month',
  new Date('2026-11-13T12:00:00.000Z')).map(x=>x.id),['a1']);
 assert.deepEqual(patientCompletedHistory([appointment,completedOther],'year',
  new Date('2026-11-13T12:00:00.000Z')).map(x=>x.id),['a1','a3']);
});
test('doctor history contains only completed interventions and real dates',()=>{
 const history=[doctorAppointment,{...doctorAppointment,id:'a2',status:'no_show'},
  {...doctorAppointment,id:'a3',status:'completed',date:'2026-08-11'}];
 assert.deepEqual(doctorCompletedHistory(history,'all').map(x=>x.id),['a1','a3']);
 assert.deepEqual(doctorCompletedHistory(history,'month',new Date('2026-11-13')).map(x=>x.id),['a1']);
 assert.deepEqual(doctorCompletedHistory(history,'year',new Date('2026-11-13')).map(x=>x.id),['a1','a3']);
});
test('duplicate and permission errors do not leak patient records',()=>{
 assert.match(reviewError({status:400}),/déjà évaluée|non encore évaluée/);
 assert.match(reviewError({status:404}),/introuvable/);
 assert.match(reviewError({status:403}),/pas autorisé/);
 assert.match(reviewError({kind:'network'}),/Vérifiez si votre avis/);
 assert.doesNotMatch(reviewError({status:500,message:'SECRET_PATIENT_RECORD'}),/SECRET/);
});
