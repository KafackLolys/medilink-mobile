import test from 'node:test';
import assert from 'node:assert/strict';
import {
 EMPTY_ZONE,parseDoctorZone,editableDoctorZone,validateDoctorZone,
 appendDistrict,validCoordinates,doctorMapMarkers,doctorZoneError,
} from './doctor-zone-model.ts';

const zone={city:'Yaoundé',districts:['Bastos','Melen'],radiusKm:10,maxDistanceKm:25};
const input=editableDoctorZone(zone);
const doctor={id:'d1',name:'Médecin',specialty:'Pédiatrie',bio:'',yearsOfExperience:2,
 consultationFee:2500,currency:'XAF',professionalAddress:null,serviceCity:'Yaoundé',
 serviceDistricts:['Bastos'],availability:[],modes:['home'],rating:null,reviewsCount:0};

test('GET /integration/doctor/zone maps exact city, districts and distances',()=>{
 assert.deepEqual(parseDoctorZone(zone),zone);
 assert.deepEqual(parseDoctorZone(EMPTY_ZONE),EMPTY_ZONE);
 assert.deepEqual(input,{city:'Yaoundé',districts:['Bastos','Melen'],radiusKm:'10',maxDistanceKm:'25'});
 for(const malformed of [null,{...zone,districts:'Bastos'},{...zone,radiusKm:'10'},{...zone,city:null}])
  assert.throws(()=>parseDoctorZone(malformed),/invalide|indisponible/);
});
test('PUT zone matches real backend boundaries, trims fields and preserves no GPS coordinates',()=>{
 const result=validateDoctorZone({...input,city:' Yaoundé ',districts:[' Bastos '],radiusKm:'1',maxDistanceKm:'500'});
 assert.deepEqual(result.errors,{});
 assert.deepEqual(result.payload,{city:'Yaoundé',districts:['Bastos'],radiusKm:1,maxDistanceKm:500});
 assert.deepEqual(Object.keys(result.payload).sort(),['city','districts','maxDistanceKm','radiusKm']);
});
test('invalid city, wrong distance ranges, reversed radii, decimals are refused',()=>{
 assert.ok(validateDoctorZone({...input,city:''}).errors.city);
 assert.ok(validateDoctorZone({...input,city:'x'.repeat(101)}).errors.city);
 for(const radiusKm of ['0','251','1.5','', 'NaN'])
  assert.ok(validateDoctorZone({...input,radiusKm}).errors.radiusKm,radiusKm);
 for(const maxDistanceKm of ['0','501','3.5','', 'NaN','5'])
  assert.ok(validateDoctorZone({...input,maxDistanceKm}).errors.maxDistanceKm,maxDistanceKm);
});
test('up to 40 districts and 100 chars, reject accented/case duplicates',()=>{
 assert.equal(validateDoctorZone({...input,districts:Array.from({length:40},(_,i)=>'Quartier '+i)}).payload.districts.length,40);
 assert.ok(validateDoctorZone({...input,districts:Array.from({length:41},(_,i)=>String(i))}).errors.districts);
 assert.ok(validateDoctorZone({...input,districts:['x'.repeat(101)]}).errors.districts);
 assert.ok(validateDoctorZone({...input,districts:['Bastos','BÁSTOS']}).errors.districts);
 assert.match(appendDistrict({...input,districts:['Bastos']},' báSTOS ').error,/déjà/);
 assert.match(appendDistrict({...input,districts:Array.from({length:40},(_,i)=>'Q'+i)},'Extra').error,/40/);
 assert.deepEqual(appendDistrict({...input,districts:[]},' Melen ').form.districts,['Melen']);
});
test('map markers only for server-returned coordinates, never city geocodes',()=>{
 assert.deepEqual(doctorMapMarkers([doctor]),[]);
 assert.equal(validCoordinates({latitude:90,longitude:-180}),true);
 assert.equal(validCoordinates({latitude:-91,longitude:0}),false);
 assert.equal(validCoordinates({latitude:0,longitude:181}),false);
 assert.equal(validCoordinates({latitude:NaN,longitude:0}),false);
 assert.equal(validCoordinates({latitude:'3.88',longitude:11.5}),false);
 assert.equal(doctorMapMarkers([{...doctor,coordinates:{latitude:3.866,longitude:11.52}}])[0].id,'d1');
 assert.deepEqual(doctorMapMarkers([{...doctor,coordinates:{latitude:97,longitude:500}}]),[]);
});
test('no private server errors are surfaced to doctor/patient',()=>{
 assert.match(doctorZoneError({status:403,message:'PRIVATE_HOUSE_ADDRESS'}),/compte/);
 assert.match(doctorZoneError({kind:'network'}),/Connexion/);
 assert.doesNotMatch(doctorZoneError({status:500,message:'PRIVATE_HOUSE_ADDRESS'}),/PRIVATE/);
});
