import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCTOR_ALLOWED_MIME_TYPES, DOCTOR_MAX_DOCUMENT_BYTES,DOCTOR_MAX_DOCUMENTS,
  editableDoctorProfile,validateDoctorProfileEdit,validateDoctorDocument,
  parseDoctorOwnProfile,confirmedDoctorProfileUpdate,doctorProfileError,
  approvedDocumentDeletionWarning,DOCTOR_DOCUMENT_STATUSES,
} from './doctor-professional-profile.ts';

const doctor={
 id:'doctor-01',name:'Dr Exemple',specialty:'Pédiatrie',bio:'Médecin pédiatre',
 yearsOfExperience:7,consultationFee:18000,currency:'XAF',professionalAddress:null,
 modes:[],availability:[],rating:null,reviewsCount:0,phone:'670000000',
 email:'medecin@example.org',registrationNumber:'ONMC-77',
 secondarySpecialties:['Médecine générale'],degrees:['Doctorat en médecine'],
 verificationStatus:'pending',documents:[],completedConsultations:0,
};

test('profile edits consist of the four actual PATCH /doctors/me keys',()=>{
 const current=parseDoctorOwnProfile(doctor);
 const edit=editableDoctorProfile(current);
 const {errors,payload}=validateDoctorProfileEdit(edit);
 assert.deepEqual(errors,{});
 assert.deepEqual(Object.keys(payload).sort(),[
  'bio','consultationFee','professionalAddress','yearsOfExperience',
 ]);
 assert.equal(payload.consultationFee,18000);
 assert.equal(payload.professionalAddress,null);
});
test('backend constraints: bio <=600, experience integer 0-80, integer fee 0-100m, address <=255',()=>{
 const base=editableDoctorProfile(doctor);
 assert.deepEqual(validateDoctorProfileEdit({...base,bio:'x'.repeat(600),yearsOfExperience:'80',
   consultationFee:'100000000',professionalAddress:'x'.repeat(255)}).errors,{});
 assert.ok(validateDoctorProfileEdit({...base,bio:'x'.repeat(601)}).errors.bio);
 for(const years of ['-1','81','2.5','','x'])
  assert.ok(validateDoctorProfileEdit({...base,yearsOfExperience:years}).errors.yearsOfExperience);
 for(const fee of ['-1','100000001','10.5','NaN',''])
  assert.ok(validateDoctorProfileEdit({...base,consultationFee:fee}).errors.consultationFee);
 assert.ok(validateDoctorProfileEdit({...base,professionalAddress:'x'.repeat(256)}).errors.professionalAddress);
 assert.equal(validateDoctorProfileEdit({...base,professionalAddress:'   '}).payload.professionalAddress,null);
});
test('profile retains read-only specialty, registration, degree and verification values returned by API',()=>{
 const parsed=parseDoctorOwnProfile(doctor);
 assert.equal(parsed.specialty,'Pédiatrie');
 assert.equal(parsed.registrationNumber,'ONMC-77');
 assert.deepEqual(parsed.degrees,['Doctorat en médecine']);
 assert.equal(parsed.verificationStatus,'pending');
 assert.throws(()=>parseDoctorOwnProfile({...doctor,verificationStatus:'unknown'}),/invalide/);
 assert.throws(()=>confirmedDoctorProfileUpdate(parsed,{...doctor,id:'a-different-account'}),/incohérente/);
 assert.equal(confirmedDoctorProfileUpdate(parsed,{...doctor,bio:'Mise à jour'}).bio,'Mise à jour');
});
test('documents expose only user-facing fields; no storage paths or reviewer IDs',()=>{
 const doc={id:'d1',medicalDocumentId:'d1',name:'medical_license',
   filename:'ordre.pdf',status:'approved',sizeBytes:555,downloadUrl:'https://signed.example/file',
   storageKey:'doctor-verification/PRIVATE',reviewerUserId:'PRIVATE',rejectionReason:'PRIVATE'};
 const parsed=parseDoctorOwnProfile({...doctor,verificationStatus:'verified',documents:[doc]});
 const returned=parsed.documents[0];
 assert.deepEqual(Object.keys(returned).sort(),[
  'downloadUrl','filename','id','medicalDocumentId','name','sizeBytes','status',
 ]);
 assert.equal(returned.status,'approved');
 assert.equal(Object.hasOwn(returned,'storageKey'),false);
 assert.match(approvedDocumentDeletionWarning(returned),/en attente de vérification/i);
 assert.match(approvedDocumentDeletionWarning({...returned,status:'pending'}),/définitivement/i);
 assert.deepEqual(Object.keys(DOCTOR_DOCUMENT_STATUSES).sort(),['approved','pending','rejected']);
});
test('upload is limited to one of four MIME types, 1 byte to 10MB, max 50 documents',()=>{
 const file={name:'justificatif.pdf',uri:'file:///cache/test.pdf',mimeType:'application/pdf',size:1000};
 assert.equal(validateDoctorDocument(file,0),null);
 for(const mimeType of DOCTOR_ALLOWED_MIME_TYPES)
   assert.equal(validateDoctorDocument({...file,mimeType,size:DOCTOR_MAX_DOCUMENT_BYTES},49),null);
 assert.equal(DOCTOR_MAX_DOCUMENTS,50);
 assert.match(validateDoctorDocument(file,50),/50 justificatifs/);
 assert.match(validateDoctorDocument({...file,mimeType:'image/heic'},0),/Formats acceptés/);
 assert.match(validateDoctorDocument({...file,mimeType:'application/zip'},0),/Formats acceptés/);
 assert.match(validateDoctorDocument({...file,size:0},0),/10 Mo/);
 assert.match(validateDoctorDocument({...file,size:10*1024*1024+1},0),/10 Mo/);
 assert.match(validateDoctorDocument({...file,size:undefined},0),/10 Mo/);
});
test('document payload mapping rejects forged types and statuses',()=>{
 const good={id:'d2',medicalDocumentId:'d2',name:'medical_degree',
   filename:'degree.png',status:'pending',sizeBytes:42,downloadUrl:null};
 assert.equal(parseDoctorOwnProfile({...doctor,documents:[good]}).documents.length,1);
 assert.throws(()=>parseDoctorOwnProfile({...doctor,documents:[{...good,name:'unknown'}]}),/invalide/);
 assert.throws(()=>parseDoctorOwnProfile({...doctor,documents:[{...good,status:'verified'}]}),/invalide/);
});
test('generic HTTP errors cannot reveal storage credentials or internal responses',()=>{
 assert.match(doctorProfileError({status:403,message:'secret storage key'}),/autorisé/);
 assert.match(doctorProfileError({status:413}),/10 Mo/);
 assert.match(doctorProfileError({kind:'network'}),/Connexion/);
 assert.doesNotMatch(doctorProfileError({status:500,message:'secret storage key'}),/secret/);
});
