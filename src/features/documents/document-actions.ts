import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { DOCUMENT_MIME_TYPES, signedPreviewUrl, resolveMedicalSelection,
 type MedicalFile, type DocumentRole } from './document-rules';

/** SAF/Android picker grants access to the selected content URI.
 * Avoid copyToCacheDirectory to prevent an unmanaged private-file copy.
 * Only the picked file is passed to native multipart FormData.
 */
export async function chooseMedicalDocument(role:DocumentRole,count=0):Promise<{file:MedicalFile|null;error:string|null}>{
 return resolveMedicalSelection(()=>DocumentPicker.getDocumentAsync({
  type:[...DOCUMENT_MIME_TYPES],multiple:false,copyToCacheDirectory:false,
 }),role,count);
}
/** Signed links are temporary and scoped by backend role checks.
 * Uses a temporary Chrome Custom Tab rather than persisting private bytes in an app cache.
 */
export async function previewMedicalDocument(url:string|null|undefined):Promise<boolean>{
 const safe=signedPreviewUrl(url);
 if(!safe)return false;
 try{
  const result=await WebBrowser.openBrowserAsync(safe,{showTitle:false});
  return result.type==='opened'||result.type==='dismiss'||result.type==='cancel';
 }catch{return false;}
}
