import test from 'node:test';
import assert from 'node:assert/strict';
import {
 retryDecision,abortableDelay,normalizeConnectivity,canUseStalePublicDirectory,
} from './network-policy.ts';
import {
 putPublicDoctorDirectory,getStalePublicDoctorDirectory,
 clearPublicDoctorDirectoryCache,publicDirectoryCacheSize,
} from './public-directory-cache.ts';
import { createHttpClient,HttpError } from '../../services/http-client.ts';

const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const publicDoctor={
 id:'doctor-1',name:'Médecin Public',specialty:'Pédiatrie',bio:'Présentation',
 yearsOfExperience:4,consultationFee:15000,currency:'XAF',professionalAddress:null,
 serviceCity:'Yaoundé',serviceDistricts:['Bastos'],modes:['home'],availability:[],
 rating:null,reviewsCount:0,
};

test('only explicitly approved GETs retry transient network, timeout, 429, 502–504',()=>{
 for(const kind of ['network','timeout']){
  assert.deepEqual(retryDecision({method:'GET',policy:'safe-get',attempt:0,kind}),
   {retry:true,delayMs:300});
 }
 for(const status of [429,502,503,504]){
  assert.equal(retryDecision({method:'GET',policy:'safe-get',attempt:1,kind:'server',status}).retry,true);
 }
 for(const status of [400,401,403,404,409,422,500]){
  assert.equal(retryDecision({method:'GET',policy:'safe-get',attempt:0,kind:'server',status}).retry,false);
 }
 assert.equal(retryDecision({method:'GET',policy:'safe-get',attempt:2,kind:'network'}).retry,false);
 assert.equal(retryDecision({method:'GET',policy:'none',attempt:0,kind:'network'}).retry,false);
 for(const method of ['POST','PATCH','PUT','DELETE']){
  assert.equal(retryDecision({method,policy:'safe-get',attempt:0,kind:'network'}).retry,false);
 }
 assert.equal(retryDecision({method:'GET',policy:'safe-get',attempt:0,kind:'network',cancelled:true}).retry,false);
});
test('offline, online, uncertain and limited network readings',()=>{
 assert.equal(normalizeConnectivity({isConnected:false}),'offline');
 assert.equal(normalizeConnectivity({isConnected:true,isInternetReachable:false}),'offline');
 assert.equal(normalizeConnectivity({isConnected:true,isInternetReachable:true}),'online');
 assert.equal(normalizeConnectivity({isConnected:true,isInternetReachable:null}),'limited');
 assert.equal(normalizeConnectivity({isConnected:null,isInternetReachable:null}),'unknown');
});
test('safe GET recovers after temporary network failure, with bounded request count',async()=>{
 let n=0;
 const client=createHttpClient({baseUrl:'https://api.example.com',
  fetchImpl:async()=>{n++;if(n<3)throw new TypeError('network cut');
    return response(200,{doctors:[],specialties:[]});}});
 const result=await client.request('/doctors',{retryPolicy:'safe-get'});
 assert.deepEqual(result,{doctors:[],specialties:[]});
 assert.equal(n,3);
});
test('safe GET does not retry denied access or stale session transitions',async()=>{
 let n=0,session='a';
 const client=createHttpClient({baseUrl:'https://api.example.com',getSessionKey:()=>session,
  fetchImpl:async()=>{n++;session='b';throw new TypeError('connection cut');}});
 await assert.rejects(client.request('/doctors',{retryPolicy:'safe-get'}),{kind:'cancelled'});
 assert.equal(n,1);
 const forbidden=createHttpClient({baseUrl:'https://api.example.com',
  fetchImpl:async()=>{n++;return response(403,{message:'forbidden'});}});
 await assert.rejects(forbidden.request('/doctors',{retryPolicy:'safe-get'}),{kind:'forbidden'});
 assert.equal(n,2);
});
test('POST reservation or medical need never retries, even with network failure',async()=>{
 const paths=['/appointments','/needs','/messages/conversations/a','/admin/accounts/a/status'];
 for(const path of paths){
  let n=0;
  const client=createHttpClient({baseUrl:'https://api.example.com',
   fetchImpl:async()=>{n++;throw new TypeError('connection lost after sending');}});
  await assert.rejects(client.request(path,{method:'POST',body:{title:'secret'}}),{kind:'network'});
  assert.equal(n,1,path);
  await assert.rejects(client.request(path,{method:'POST',body:{title:'secret'},retryPolicy:'safe-get'}),/GET/);
  assert.equal(n,1,path);
 }
});
test('request can be cancelled during retry backoff: no second network request',async()=>{
 const ac=new AbortController();let n=0;
 const client=createHttpClient({baseUrl:'https://api.example.com',
  fetchImpl:async()=>{n++;ac.abort();throw new TypeError('radio dropped');}});
 await assert.rejects(client.request('/doctors',{retryPolicy:'safe-get',signal:ac.signal}),{kind:'cancelled'});
 assert.equal(n,1);
 const controller=new AbortController(),wait=abortableDelay(300,controller.signal);
 controller.abort();
 await assert.rejects(wait,/cancelled/);
});
test('only verified public physician directory is cached, in RAM for up to five minutes',()=>{
 clearPublicDoctorDirectoryCache();
 const payload={doctors:[{...publicDoctor,patientRecord:'PRIVATE',firebaseToken:'SECRET'}],
  specialties:['Pédiatrie']};
 const filters={q:'',city:'Yaoundé'};
 putPublicDoctorDirectory(filters,payload,100000);
 const data=getStalePublicDoctorDirectory(filters,{kind:'network'},'patient',100100);
 assert.equal(data?.doctors[0].name,'Médecin Public');
 assert.equal(Object.hasOwn(data.doctors[0],'patientRecord'),false);
 assert.equal(Object.hasOwn(data.doctors[0],'firebaseToken'),false);
 assert.equal(getStalePublicDoctorDirectory(filters,{kind:'network'},'doctor',100100),null);
 assert.equal(getStalePublicDoctorDirectory(filters,{kind:'forbidden'},'patient',100100),null);
 assert.equal(getStalePublicDoctorDirectory(filters,{kind:'network'},'patient',400001),null);
 assert.equal(getStalePublicDoctorDirectory({city:'Douala'},{kind:'network'},'patient',100100),null);
 clearPublicDoctorDirectoryCache();
 assert.equal(publicDirectoryCacheSize(),0);
});
test('cache never makes patients, medical documents or private service routes readable offline',()=>{
 for(const endpoint of ['/appointments','/needs','/patients/me/documents','/messages/conversations','/admin/accounts']){
  assert.equal(canUseStalePublicDirectory({
   ageMs:100,entryCount:1,endpoint,accountRole:'patient',networkErrorKind:'network',
  }),false);
 }
});
