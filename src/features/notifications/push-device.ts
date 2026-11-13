import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { authApi } from '@/services/auth';
import { notificationsApi } from '@/services/notifications';
import { useNavigationSession } from '@/store/navigation-session';
import { canUseNotifications, NOTIFICATION_DEVICE_ID_KEY, validateDeviceRegistration } from './notification-model';

const PUSH_CHANNEL='medilink-updates';
let activeUser:string|null=null;
let registrationFlight:Promise<boolean>|null=null;
const listenerCallbacks=new Set<()=>void>();
export function subscribeNotifications(callback:()=>void){
 listenerCallbacks.add(callback);
 return ()=>{listenerCallbacks.delete(callback);};
}
export function announceNotification(){for(const callback of listenerCallbacks)callback();}
/** FCM device token: the NestJS server calls Firebase Admin sendEachForMulticast directly. */
async function deviceIdentifier(){
 let id=await SecureStore.getItemAsync(NOTIFICATION_DEVICE_ID_KEY);
 if(!id){
  id='medilink_'+Array.from({length:4},()=>Math.random().toString(36).slice(2,12)).join('').slice(0,36);
  await SecureStore.setItemAsync(NOTIFICATION_DEVICE_ID_KEY,id);
 }
 return id;
}
async function ensurePermission(request:boolean):Promise<boolean>{
 if(Platform.OS!=='android'||!Device.isDevice)return false;
 await Notifications.setNotificationChannelAsync(PUSH_CHANNEL,{
  name:'Actualités Medilink',
  importance:Notifications.AndroidImportance.DEFAULT,
  vibrationPattern:[0,220,110,220],
  enableVibrate:true,
 });
 let permission=await Notifications.getPermissionsAsync();
 if(!permission.granted && request)permission=await Notifications.requestPermissionsAsync();
 return permission.granted;
}
export async function registerPushDevice(requestPermission:boolean):Promise<boolean>{
 if(registrationFlight)return registrationFlight;
 const flight=(async()=>{
  const session=useNavigationSession.getState().session;
  if(session.status!=='authenticated'||!canUseNotifications(session.role))return false;
  const initialRole=session.role;
  if(!await ensurePermission(requestPermission))return false;
  // Do not request the Expo Push Service token: backend only understands FCM.
  const native=await Notifications.getDevicePushTokenAsync();
  if(native.type!=='fcm' || typeof native.data!=='string')return false;
  const deviceId=await deviceIdentifier();
  const profile=await authApi.profile();
  if(profile.user.role!==initialRole||!profile.user.id)return false;
  const latest=useNavigationSession.getState().session;
  if(latest.status!=='authenticated'||latest.role!==initialRole)return false;
  const body={deviceId,token:native.data,platform:'mobile' as const,userAgent:'Medilink Android'};
  if(!validateDeviceRegistration(body))return false;
  const saved=await notificationsApi.register(body);
  if(saved.deviceId!==deviceId||saved.platform!=='mobile')return false;
  activeUser=profile.user.id;
  return true;
 })().finally(()=>{if(registrationFlight===flight)registrationFlight=null;});
 registrationFlight=flight;
 return flight;
}
/** Must run while the old Firebase session is still usable, before logout clears it. */
export async function unregisterPushDevice():Promise<boolean>{
 if(Platform.OS!=='android')return true;
 const session=useNavigationSession.getState().session;
 if(session.status!=='authenticated'||!canUseNotifications(session.role)){activeUser=null;return true;}
 const id=await SecureStore.getItemAsync(NOTIFICATION_DEVICE_ID_KEY);
 if(!id){activeUser=null;return true;}
 try{
  await notificationsApi.unregister(id);
  activeUser=null;
  return true;
 }catch{return false;}
}
export function configurePushPresentation(){
 Notifications.setNotificationHandler({
  handleNotification:async()=>({
   shouldShowBanner:false,
   shouldShowList:true,
   shouldPlaySound:false,
   shouldSetBadge:false,
  }),
 });
}
export function notificationBackendUser(){return activeUser;}
