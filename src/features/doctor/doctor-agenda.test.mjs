import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,DURATIONS,parseWeekly,validateWeekly,validateModes,validateDuration,
  validDay,validateNewBlock,parseDoctorAppointments,backendPermittedStatuses,
  consultationClock,doctorAgendaError,APPOINTMENT_STATUSES,
} from './doctor-agenda.ts';

const rows=DAYS.map(({id})=>({weekday:id,isAvailable:false,startTime:'09:00',endTime:'17:00'}));
test('new weekly schedule reflects seven canonical inactive days',()=>{
  const parsed=parseWeekly([]);
  assert.equal(parsed.length,7);
  assert.deepEqual(parsed.map(x=>x.weekday),DAYS.map(d=>d.id));
  assert.deepEqual(validateWeekly(parsed),{});
  assert.ok(parsed.every(d=>!d.isAvailable));
});
test('create/modify/remove weekly time windows via a complete PUT replacement',()=>{
  const initial=parseWeekly(rows);
  const created=initial.map(row=>row.weekday==='monday'?{...row,isAvailable:true,startTime:'08:30',endTime:'12:45'}:row);
  assert.deepEqual(validateWeekly(created),{});
  assert.equal(created.find(x=>x.weekday==='monday').startTime,'08:30');
  const modified=created.map(row=>row.weekday==='monday'?{...row,startTime:'10:00'}:row);
  assert.deepEqual(validateWeekly(modified),{});
  const removed=modified.map(row=>row.weekday==='monday'?{...row,isAvailable:false}:row);
  assert.deepEqual(validateWeekly(removed),{});
  assert.equal(removed.find(x=>x.weekday==='monday').isAvailable,false);
});
test('reject malformed time, duplicates and reversed hours',()=>{
  assert.ok(validateWeekly(rows.map(x=>x.weekday==='friday'?{...x,isAvailable:true,startTime:'20:00',endTime:'09:00'}:x)).friday);
  assert.ok(validateWeekly(rows.map(x=>x.weekday==='friday'?{...x,isAvailable:true,startTime:'25:00'}:x)).friday);
  assert.ok(validateWeekly(rows.slice(1)).global);
  assert.throws(()=>parseWeekly([{weekday:'monday',isAvailable:true,startTime:'09:00',endTime:'17:00'},
    {weekday:'monday',isAvailable:true,startTime:'09:00',endTime:'17:00'}]),/invalide/);
});
test('duration PATCH only permits 15,20,30,45,60',()=>{
  assert.deepEqual(DURATIONS,[15,20,30,45,60]);
  for(const v of DURATIONS)assert.equal(validateDuration(v),true);
  for(const v of [0,10,25,90,30.5,NaN])assert.equal(validateDuration(v),false);
});
test('modes PUT requires one or two distinct supported consultation modes',()=>{
  assert.equal(validateModes(['home']),true);
  assert.equal(validateModes(['home','teleconsultation']),true);
  assert.equal(validateModes([]),false);
  assert.equal(validateModes(['home','home']),false);
  assert.equal(validateModes(['other']),false);
});
test('create/delete blocked date validates ISO day and duplicate',()=>{
  const existing=[{id:'blocked-1',date:'2026-11-20',label:'20 novembre',reason:null}];
  assert.equal(validateNewBlock('2026-11-21',existing),null);
  assert.match(validateNewBlock('2026-11-20',existing),/déjà bloquée/);
  assert.match(validateNewBlock('2026-02-30',existing),/date valide/);
  assert.equal(validDay('2028-02-29'),true);
  assert.equal(validDay('2027-02-29'),false);
  assert.equal(validateNewBlock('2026-11-20',[]),null);
  // DELETE uses the server-owned id, not a date string.
  assert.equal(existing[0].id,'blocked-1');
});
test('doctor appointment GET reflects server statuses and patient-safe fields only',()=>{
  const appointment={id:'appt-1',date:'2026-11-20',time:'14:15',
    patient:'Patient',district:'Centre',mode:'Téléconsultation',status:'pending_confirmation',
    patientProfileId:'PRIVATE',addressId:'PRIVATE'};
  const mapped=parseDoctorAppointments([appointment])[0];
  assert.equal(mapped.time,'14:15');
  assert.equal(mapped.mode,'Téléconsultation');
  assert.equal(Object.hasOwn(mapped,'patientProfileId'),false);
  assert.equal(Object.hasOwn(mapped,'addressId'),false);
  assert.throws(()=>parseDoctorAppointments([{...appointment,status:'unsupported'}]),/invalide/);
});
test('status PATCH matches backend enum without invented transition matrix',()=>{
  assert.deepEqual(backendPermittedStatuses(),APPOINTMENT_STATUSES);
  assert.ok(APPOINTMENT_STATUSES.includes('cancelled'));
  assert.ok(APPOINTMENT_STATUSES.includes('completed'));
  assert.ok(APPOINTMENT_STATUSES.includes('confirmed'));
});
test('explicit timezone formatter and safe errors',()=>{
  assert.match(consultationClock('2026-11-13T08:30:00Z'),/09:30/);
  assert.match(doctorAgendaError({status:403,message:'secret'}),/réservée/);
  assert.match(doctorAgendaError({status:404}),/introuvable/);
  assert.doesNotMatch(doctorAgendaError({status:500,message:'secret'}),/secret/);
});
