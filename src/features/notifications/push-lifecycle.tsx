import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useNavigationSession } from '@/store/navigation-session';
import { authApi } from '@/services/auth';
import { notificationsApi } from '@/services/notifications';
import { announceNotification, configurePushPresentation, registerPushDevice } from './push-device';
import { canUseNotifications, destinationForNotification } from './notification-model';

/**
 * Android notification lifecycle. OS displays standard FCM notification
 * in background / terminated states; JS handles opening after app launch.
 * No headless background data job is registered: the API does not use that format.
 */
export function PushNotificationLifecycle(){
 const router=useRouter();
 const session=useNavigationSession(s=>s.session);
 const generation=useRef(0);
 useEffect(()=>{
  if(Platform.OS!=='android'||session.status!=='authenticated'||!canUseNotifications(session.role))return;
  const epoch=++generation.current,role=session.role;
  let mounted=true;
  const valid=()=>mounted&&generation.current===epoch;
  // Request permission only on user action. Restore an already granted registration.
  void registerPushDevice(false).catch(()=>{/* Push is optional; in-app notifications still work. */});
  try{configurePushPresentation();}catch{/* App may be running in Expo Go. */}
  const received=Notifications.addNotificationReceivedListener(()=>{if(valid())announceNotification();});
  const tokenChanged=Notifications.addPushTokenListener(()=>{if(valid())void registerPushDevice(false).catch(()=>{});});
  let handled:string|null=null;
  const handleResponse=async(response:Notifications.NotificationResponse)=>{
    if(!valid())return;
    const data=response.notification.request.content.data ?? {};
    const target=typeof data.url==='string'?data.url:null;
    const notificationId=typeof data.notificationId==='string'?data.notificationId:null;
    if(!target||!notificationId)return;
    const destination=destinationForNotification(target,role);
    if(!destination)return;
    // Never trust the push payload alone. PATCH /notifications/:id/read verifies
    // the authenticated Firebase UID owns this notification, even if it is old.
    try{
      const profile=await authApi.profile();
      if(!valid()||profile.user.role!==role)return;
      const acknowledgement=await notificationsApi.read(notificationId);
      if(!valid()||acknowledgement.id!==notificationId||!acknowledgement.readAt)return;
      if(handled===notificationId)return;
      handled=notificationId;
      router.push(destination as never);
    }catch{/* Silent refusal: never navigate from an unverified notification. */}
  };
  const tapped=Notifications.addNotificationResponseReceivedListener(response=>{void handleResponse(response);});
  void Notifications.getLastNotificationResponseAsync().then(response=>{
   if(response&&valid())void handleResponse(response);
  }).catch(()=>{});
  return()=>{mounted=false;generation.current++;received.remove();tapped.remove();tokenChanged.remove();};
 },[session.status,session.role,router]);
 return null;
}
