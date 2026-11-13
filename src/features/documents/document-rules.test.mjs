import test from 'node:test';
import assert from 'node:assert/strict';
import {DOCUMENT_MIME_TYPES,MAX_MEDICAL_FILE_BYTES,validateMedicalFile,
 documentCategoryAllowed,validateDocumentTitle,signedPreviewUrl,
 documentTransferError,pickerOutcome} from './document-rules.ts';

const file={uri:'content://com.android.providers.downloads.documents/document/1',name:'bilan.pdf',
 mimeType:'application/pdf',size:1024};
test('patient categories match backend/form and doctor categories are distinct',()=>{
 for(const c of ['prescription','lab_result','medical_report','imaging','other'])
  assert.equal(documentCategoryAllowed('patient',c),true);
 for(const c of ['medical_license','medical_degree','identity_document','other'])
  assert.equal(documentCategoryAllowed('doctor',c),true);
 assert.equal(documentCategoryAllowed('patient','medical_license'),false);
 assert.equal(documentCategoryAllowed('doctor','prescription'),false);
});
test('boundary sizes and allowed MIME values: PDF JPEG PNG WebP, 1 byte to 10MB',()=>{
 for(const mimeType of DOCUMENT_MIME_TYPES){
  assert.equal(validateMedicalFile({...file,mimeType,size:1},'patient'),null);
  assert.equal(validateMedicalFile({...file,mimeType,size:MAX_MEDICAL_FILE_BYTES},'doctor'),null);
 }
 assert.match(validateMedicalFile({...file,size:0},'patient'),/1 octet/);
 assert.match(validateMedicalFile({...file,size:MAX_MEDICAL_FILE_BYTES+1},'doctor'),/10 Mo/);
 assert.match(validateMedicalFile({...file,size:null},'patient'),/10 Mo/);
 assert.match(validateMedicalFile({...file,mimeType:'image/heic'},'patient'),/Types acceptés/);
 assert.match(validateMedicalFile({...file,mimeType:'application/octet-stream'},'doctor'),/Types acceptés/);
});
test('doctor maximum 50 existing files; patient has no artificial count cap',()=>{
 assert.equal(validateMedicalFile(file,'doctor',49),null);
 assert.match(validateMedicalFile(file,'doctor',50),/50 justificatifs/);
 assert.equal(validateMedicalFile(file,'patient',100),null);
});
test('file name and patient title limits are enforced before multipart',()=>{
 assert.equal(validateMedicalFile({...file,name:'x'.repeat(255)},'patient'),null);
 assert.match(validateMedicalFile({...file,name:'x'.repeat(256)},'patient'),/255/);
 assert.match(validateMedicalFile({...file,uri:''},'doctor'),/invalide/);
 assert.equal(validateDocumentTitle('x'.repeat(255),'patient'),null);
 assert.match(validateDocumentTitle('x'.repeat(256),'patient'),/255/);
 assert.equal(validateDocumentTitle('anything','doctor'),null);
});
test('Android picker cancellation is silent, not misreported as permission denial',()=>{
 assert.equal(pickerOutcome({canceled:true,assets:[file]}),null);
 assert.equal(pickerOutcome({canceled:false,assets:[]}),null);
 assert.deepEqual(pickerOutcome({canceled:false,assets:[file]}),file);
});
test('signed URL preview rejects untrusted protocols, local origins and fragments',()=>{
 assert.equal(signedPreviewUrl('https://storage.example.org/signed?token=abc'),
  'https://storage.example.org/signed?token=abc');
 for(const value of ['http://example.org/file','file:///private/secret','javascript:alert(1)',
  'https://evil.test@localhost/signed','https://localhost/secret','https://example.org/file#fragment',
  'content://private/1','']){
  assert.equal(signedPreviewUrl(value),null,value);
 }
});
test('file transfer errors never include storage URLs or medical data',()=>{
 assert.match(documentTransferError({status:403}),/Accès refusé/);
 assert.match(documentTransferError({status:413}),/10 Mo/);
 assert.match(documentTransferError({kind:'network'}),/Transfert interrompu/);
 assert.doesNotMatch(documentTransferError({status:500,message:'PRIVATE_PATIENT_MEDICAL_DOCUMENT'}),/PRIVATE/);
});
