import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialDoctorDashboard, doctorAppointmentSummary, doctorDashboardMetrics,
  doctorCanAccessPatientNeeds, doctorGateMessage, parseDoctorProfile,
  parsePage, enabledDoctorWeek, doctorErrorReason, cameroonClock,
} from './doctor-dashboard.ts';

const success = value => ({ status: 'success', value });
const doctor = status => ({
  id: 'doctor-1', name: 'Dr. Ngono', specialty: 'Cardiologie',
  verificationStatus: status, documents: [],
  professionalAddress: null,
});

test('only professionally verified doctors may query patient needs and proposals', () => {
  assert.equal(doctorCanAccessPatientNeeds('verified'), true);
  for (const status of ['pending','rejected','suspended',undefined]) {
    assert.equal(doctorCanAccessPatientNeeds(status), false, status);
  }
  assert.match(doctorGateMessage('pending'), /validation/i);
  assert.match(doctorGateMessage('rejected'), /refusée/i);
  assert.match(doctorGateMessage('suspended'), /suspendu/i);
});

test('doctor profile requires a valid verification status, no silent fallback to verified', () => {
  assert.equal(parseDoctorProfile(doctor('pending')).verificationStatus,'pending');
  assert.equal(parseDoctorProfile(doctor('verified')).verificationStatus,'verified');
  assert.throws(() => parseDoctorProfile({ ...doctor('verified'), verificationStatus: null }),/invalide/i);
  assert.throws(() => parseDoctorProfile({ ...doctor('verified'), documents: null }),/invalide/i);
  assert.throws(() => parseDoctorProfile(null),/invalide/i);
});

test('failed sources remain unknown rather than falsely zero', () => {
  const data = initialDoctorDashboard();
  assert.equal(data.profile.status,'loading');
  const metrics = doctorDashboardMetrics(data,new Date('2026-11-13T08:00:00Z'));
  assert.equal(metrics.availableNeeds,null);
  assert.equal(metrics.sentProposals,null);
  assert.equal(metrics.upcomingAppointments,null);
  assert.equal(metrics.unreadConversations,null);
  assert.equal(metrics.configuredDays,null);
  assert.equal(metrics.blockedDays,null);
});

test('successful empty backend results produce grounded zeros', () => {
  const data = initialDoctorDashboard();
  data.needs = success({ items:[],page:1,pageSize:5,total:0,totalPages:0 });
  data.proposals = success({items:[],page:1,pageSize:10,total:0,totalPages:0,counts:{}});
  data.appointments = success([]);
  data.conversations = success([]);
  data.weekly = success([]);
  data.blocked = success([]);
  const metrics=doctorDashboardMetrics(data,new Date('2026-11-13T08:00:00Z'));
  assert.equal(metrics.availableNeeds,0);
  assert.equal(metrics.sentProposals,0);
  assert.equal(metrics.upcomingAppointments,0);
  assert.equal(metrics.unreadConversations,0);
  assert.equal(metrics.configuredDays,0);
  assert.equal(metrics.blockedDays,0);
});

test('paginated needs and proposals use server total, never displayed page length',()=>{
  const data=initialDoctorDashboard();
  data.needs=success({items:[{id:'n1'}],total:24,page:1,pageSize:5,totalPages:5});
  data.proposals=success({items:[{id:'p1'}],total:18,page:1,pageSize:10,totalPages:2,counts:{sent:12}});
  const metrics=doctorDashboardMetrics(data);
  assert.equal(metrics.availableNeeds,24);
  assert.equal(metrics.sentProposals,18);
  assert.equal(parsePage(data.needs.value).total,24);
  assert.throws(()=>parsePage({items:[],total:'8',page:1,pageSize:5,totalPages:1}),/invalide/i);
});

test('Cameroon appointments include pending and confirmed in future, never completed or past',()=>{
  const now=new Date('2026-11-13T09:00:00Z'); // 10:00 Douala
  assert.deepEqual(cameroonClock(now),{date:'2026-11-13',time:'10:00'});
  const items=[
    {id:'future',date:'2026-11-14',time:'09:00',status:'confirmed'},
    {id:'today',date:'2026-11-13',time:'10:30',status:'pending_confirmation'},
    {id:'old',date:'2026-11-13',time:'08:00',status:'confirmed'},
    {id:'completed',date:'2026-11-14',time:'12:00',status:'completed'},
    {id:'rejected',date:'2026-11-14',time:'13:00',status:'rejected'},
  ];
  const result=doctorAppointmentSummary(items,now);
  assert.deepEqual(result.upcoming.map(x=>x.id),['today','future']);
  assert.equal(result.today.length,1);
  assert.equal(result.pending,1);
  assert.equal(result.next.id,'today');
});

test('weekly hours include only enabled rows, no generated availability',()=>{
  assert.deepEqual(enabledDoctorWeek([
    {id:'1',weekday:'monday',isAvailable:true,startTime:'09:00',endTime:'13:00'},
    {id:'2',weekday:'tuesday',isAvailable:false,startTime:'09:00',endTime:'18:00'},
  ]),[{weekday:'Lundi',hours:'09:00–13:00'}]);
});

test('message count comes only from authorized returned conversations',()=>{
  const data=initialDoctorDashboard();
  data.conversations=success([{id:'a',unreadCount:2},{id:'b',unreadCount:0},{id:'c',unreadCount:4}]);
  assert.equal(doctorDashboardMetrics(data).unreadConversations,6);
});

test('HTTP permission errors remain distinct from network errors',()=>{
  assert.equal(doctorErrorReason({status:403}),'restricted');
  assert.equal(doctorErrorReason({status:401}),'restricted');
  assert.equal(doctorErrorReason({kind:'timeout'}),'network');
  assert.equal(doctorErrorReason({kind:'network'}),'network');
  assert.equal(doctorErrorReason({status:500}),'unknown');
});
