import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPOINTMENT_LABELS, matchingOpeningHours, makeBookingRequest,
  appointmentError, filterAppointments, canPatientChangeAppointmentStatus,
  formatAppointmentDate, APPOINTMENT_LIST_ROUTE, appointmentDetailRoute,
} from './appointment-booking.ts';

const doctor = {
  id:'doctor-1', name:'Dr Medilink', specialty:'Généraliste',
  appointmentDurationMinutes:30,
  blockedDates:['2026-11-16'],
  modes:['home','teleconsultation'],
  availability:[
    {weekday:'monday',startTime:'09:00',endTime:'12:00',isAvailable:true},
    {weekday:'friday',startTime:'08:00',endTime:'12:00',isAvailable:true},
  ],
};
const now=Date.parse('2026-11-12T00:00:00Z');

test('creates an API contract payload using a real declared weekly window',()=>{
  const result=makeBookingRequest(doctor,{
    date:'2026-11-13',time:'09:30',consultationMode:'teleconsultation',reason:'Consultation de contrôle',
  },now,Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(result.doctorId,'doctor-1');
  assert.equal(result.timeZone,Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(result.consultationMode,'teleconsultation');
  assert.equal(result.scheduledAt,new Date('2026-11-13T09:30:00').toISOString());
  assert.equal(result.reason,'Consultation de contrôle');
});

test('only exposes declared weekday windows, not generated slots',()=>{
  assert.deepEqual(matchingOpeningHours(doctor,'2026-11-13'),[{startTime:'08:00',endTime:'12:00'}]);
  assert.deepEqual(matchingOpeningHours(doctor,'2026-11-14'),[]);
  assert.deepEqual(matchingOpeningHours(doctor,'2026-11-16'),[]);
  assert.deepEqual(matchingOpeningHours(doctor,'2026-02-30'),[]);
});

test('booking refuses blocked day, unavailable hour, truncated duration and unknown mode',()=>{
  const base={date:'2026-11-13',time:'09:00',consultationMode:'home',reason:''};
  assert.throws(()=>makeBookingRequest(doctor,{...base,date:'2026-11-16'},now,Intl.DateTimeFormat().resolvedOptions().timeZone),/plage/i);
  assert.throws(()=>makeBookingRequest(doctor,{...base,time:'12:00'},now,'Africa/Douala'),/plage/i);
  assert.throws(()=>makeBookingRequest(doctor,{...base,time:'11:45'},now,'Africa/Douala'),/plage/i);
  assert.throws(()=>makeBookingRequest(doctor,{...base,consultationMode:'invalid'},now,'Africa/Douala'),/mode/i);
});
test('booking requires future time, real clock and short optional reason',()=>{
  const base={date:'2026-11-13',time:'09:00',consultationMode:'home',reason:''};
  assert.throws(()=>makeBookingRequest(doctor,base,Date.parse('2026-11-13T12:00:00Z'),Intl.DateTimeFormat().resolvedOptions().timeZone),/futures/i);
  assert.throws(()=>makeBookingRequest(doctor,{...base,time:'99:00'},now,'Africa/Douala'),/Heure invalide/i);
  assert.throws(()=>makeBookingRequest(doctor,{...base,reason:'x'.repeat(501)},now,'Africa/Douala'),/500/);
});
test('conflict HTTP 400 and 409 and invalid mode errors are comprehensible',()=>{
  assert.match(appointmentError({status:400,message:'This appointment time is no longer available'}),/déjà réservé/);
  assert.match(appointmentError({status:409}),/déjà réservé/);
  assert.match(appointmentError({status:400,message:'The doctor is not available'}),/créneau/);
  assert.match(appointmentError({status:403,message:'private details'}),/autorisé/);
  assert.doesNotMatch(appointmentError({status:500,message:'internal secret'}),/secret/);
});
test('patient only sees own read-only appointment statuses',()=>{
  const items=[
    {id:'a',status:'pending_confirmation'},
    {id:'b',status:'confirmed'},
    {id:'c',status:'cancelled'},
  ];
  assert.deepEqual(filterAppointments(items,'confirmed').map(x=>x.id),['b']);
  assert.deepEqual(filterAppointments(items,'all').map(x=>x.id),['a','b','c']);
  for(const status of Object.keys(APPOINTMENT_LABELS)){
    assert.equal(canPatientChangeAppointmentStatus(status),false);
  }
});
test('appointment follow-up displays dates in a chosen IANA zone',()=>{
  assert.match(formatAppointmentDate('2026-11-13T08:30:00.000Z','Africa/Douala'),/09:30/);
  assert.equal(formatAppointmentDate('invalid','Africa/Douala'),'Date indisponible');
});

test('navigation goes from an appointment detail back to the patient list',()=>{
  assert.equal(APPOINTMENT_LIST_ROUTE,'/patient/rendez-vous');
  assert.deepEqual(appointmentDetailRoute('appointment-123'),{
    pathname:'/patient/rendez-vous/[id]',params:{id:'appointment-123'},
  });
  // The details screen uses the same list route as the booking success screen.
  assert.notEqual(appointmentDetailRoute('appointment-123').pathname,APPOINTMENT_LIST_ROUTE);
});
