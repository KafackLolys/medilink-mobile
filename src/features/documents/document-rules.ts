/** Shared medical document rules for patient and doctor flows.
 * Never store file names, signed links or private document content in logs.
 */
export const DOCUMENT_MIME_TYPES=['application/pdf','image/jpeg','image/png','image/webp'] as const;
export const MAX_MEDICAL_FILE_BYTES=10*1024*1024;
export type MedicalFile={name:string;uri:string;mimeType?:string|null;size?:number|null};
export type DocumentRole='patient'|'doctor';
export const PATIENT_DOCUMENT_CATEGORIES=['prescription','lab_result','medical_report','imaging','other'] as const;
export const DOCTOR_DOCUMENT_CATEGORIES=['medical_license','medical_degree','identity_document','other'] as const;

export function documentCategoryAllowed(role:DocumentRole,type:string):boolean{
 return role==='patient'?(PATIENT_DOCUMENT_CATEGORIES as readonly string[]).includes(type)
  :(DOCTOR_DOCUMENT_CATEGORIES as readonly string[]).includes(type);
}
export function validateMedicalFile(file:MedicalFile,role:DocumentRole,count=0):string|null{
 if(role==='doctor'&&count>=50)return 'Limite atteinte : 50 justificatifs maximum.';
 if(!file.uri||!file.name||file.name.length>255)return 'Nom de document invalide (255 caractères maximum).';
 if(!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimeType??''))return 'Types acceptés : PDF, JPEG, PNG ou WebP.';
 if(typeof file.size!=='number'||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_MEDICAL_FILE_BYTES)
  return 'Fichier invalide : taille connue de 1 octet à 10 Mo requise.';
 return null;
}
export function validateDocumentTitle(title:string,role:DocumentRole){
 if(role==='doctor')return null; // Professional document type is the only editable metadata.
 if(title.trim().length>255)return 'Le titre ne peut pas dépasser 255 caractères.';
 return null;
}
export function signedPreviewUrl(url:string|null|undefined):string|null{
 if(typeof url!=='string'||url.length>8192||!url.startsWith('https://'))return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!!parsed.username||!!parsed.password||!parsed.hostname
    ||parsed.hash||parsed.hostname==='localhost'||parsed.hostname.endsWith('.localhost'))return null;
  return parsed.href;
 }catch{return null;}
}
export function documentTransferError(error:unknown):string{
 const e=error as {status?:number;kind?:string}|null;
 if(e?.status===401||e?.status===403)return 'Accès refusé à ce document pour votre compte.';
 if(e?.status===404)return 'Document introuvable ou non accessible.';
 if(e?.status===413)return 'Le document dépasse la limite serveur de 10 Mo.';
 if(e?.status===400||e?.status===422)return 'Document refusé : vérifiez son format, son type ou sa taille.';
 if(e?.kind==='network'||e?.kind==='timeout')return 'Transfert interrompu ou indisponible. Vérifiez vos documents avant de réessayer.';
 return 'Opération sur le document indisponible. Actualisez avant de réessayer.';
}
export function pickerOutcome<T>(response:{canceled:boolean;assets?:T[]|null}):T|null{
 return response.canceled?null:response.assets?.[0]??null;
}

export type PatientDocumentSummary={id:string;type:string;title:string;filename:string};
export function filterPatientDocuments<T extends PatientDocumentSummary>(
 docs:T[],query:string,category:string,labels:Record<string,string>):T[]{
 const q=query.trim().toLocaleLowerCase('fr');
 return docs.filter(doc=>(category==='all'||doc.type===category)
  &&(!q||[doc.title,doc.filename,labels[doc.type]??''].some(value=>value.toLocaleLowerCase('fr').includes(q))));
}
export function pagePatientDocuments<T>(docs:T[],page:number,pageSize=6){
 const totalPages=Math.max(1,Math.ceil(docs.length/pageSize));
 const currentPage=Math.min(Math.max(Number.isInteger(page)?page:1,1),totalPages);
 return {items:docs.slice((currentPage-1)*pageSize,currentPage*pageSize),page:currentPage,totalPages,total:docs.length};
}

/** Pure injectable adapter to test denied file permissions without invoking Expo native APIs. */
export async function resolveMedicalSelection(
 choose:()=>Promise<{canceled:boolean;assets?:MedicalFile[]|null}>,
 role:DocumentRole,count=0,
):Promise<{file:MedicalFile|null;error:string|null}>{
 try{
  const response=await choose();
  const file=pickerOutcome(response);
  if(!file)return {file:null,error:null};
  const problem=validateMedicalFile(file,role,count);
  return problem?{file:null,error:problem}:{file,error:null};
 }catch{
  // Do not expose operating system paths or private file identifiers in logs/errors.
  return {file:null,error:'Sélection impossible ou accès au fichier refusé par Android. Réessayez.'};
 }
}
