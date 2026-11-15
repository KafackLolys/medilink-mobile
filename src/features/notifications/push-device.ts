import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '@/services/auth';
import { notificationsApi } from '@/services/notifications';
import { useNavigationSession } from '@/store/navigation-session';
import { canUseNotifications, NOTIFICATION_DEVICE_ID_KEY, validateDeviceRegistration } from './notification-model';

/**
 * Versioned channel: Android does not let an app reliably increase the importance
 * of an existing channel. Previous "medilink-updates" was DEFAULT and silent.
 * This name must match the FCM Android channelId configured in the API.
 */
export const PUSH_CHANNEL = 'medilink-alerts-v2';
let activeUser: string | null = null;
let registrationFlight: Promise<boolean> | null = null;
const listenerCallbacks = new Set<() => void>();
export function subscribeNotifications(callback: () => void) {
  listenerCallbacks.add(callback);
  return () => { listenerCallbacks.delete(callback); };
}
export function announceNotification() {
  for (const callback of listenerCallbacks) callback();
}

export class PushRegistrationError extends Error {
  constructor(readonly reason: 'unsupported' | 'permission' | 'token' | 'backend', message: string) {
    super(message);
    this.name = 'PushRegistrationError';
  }
}

/** Identifies the installation, NOT a user or an authentication credential. */
async function deviceIdentifier() {
  let id = await SecureStore.getItemAsync(NOTIFICATION_DEVICE_ID_KEY);
  if (!id) {
    id = 'medilink_' + Array.from({ length: 4 }, () =>
      Math.random().toString(36).slice(2, 12)).join('').slice(0, 36);
    await SecureStore.setItemAsync(NOTIFICATION_DEVICE_ID_KEY, id);
  }
  return id;
}

/** Create the channel before requesting notification permission or FCM token. */
export async function ensurePushChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: 'Notifications MediLink',
    description: 'Messages, rendez-vous et propositions de santé',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}

async function ensurePermission(request: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') {
    throw new PushRegistrationError('unsupported', 'Les notifications FCM natives sont disponibles sur Android.');
  }
  // Android emulators with Google Play Services can receive FCM.
  // Do not gate on expo-device.isDevice, which rejects those emulators.
  await ensurePushChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && request) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted && request) {
    throw new PushRegistrationError('permission',
      'Autorisation Android refusée. Activez les notifications MediLink dans les paramètres du téléphone.');
  }
  return permission.granted;
}

export async function registerPushDevice(
  requestPermission: boolean,
  updatedToken?: Awaited<ReturnType<typeof Notifications.getDevicePushTokenAsync>>,
): Promise<boolean> {
  if (registrationFlight) return registrationFlight;
  const flight = (async () => {
    const session = useNavigationSession.getState().session;
    if (session.status !== 'authenticated' || !canUseNotifications(session.role)) return false;
    const role = session.role;
    const permissionGranted = await ensurePermission(requestPermission);
    if (!permissionGranted) return false;
    // This backend uses Firebase Admin FCM, NOT Expo Push Service tokens.
    let native: Awaited<ReturnType<typeof Notifications.getDevicePushTokenAsync>>;
    try {
      native = updatedToken ?? await Notifications.getDevicePushTokenAsync();
    } catch {
      throw new PushRegistrationError('token',
        'Impossible d’obtenir le token FCM. Utilisez une application Android compilée avec le fichier Firebase du bon projet et les services Google Play.');
    }
    // Expo returns the operating-system value "android", not "fcm".
    // Checking for "fcm" silently prevented every Android registration.
    if (native.type !== 'android' || typeof native.data !== 'string' || native.data.length < 20) {
      throw new PushRegistrationError('token',
        'Token FCM Android indisponible. Vérifiez Firebase et Google Play Services sur cette installation.');
    }
    const deviceId = await deviceIdentifier();
    const profile = await authApi.profile();
    const latest = useNavigationSession.getState().session;
    if (profile.user.role !== role || !profile.user.id ||
        latest.status !== 'authenticated' || latest.role !== role) return false;
    const body = { deviceId, token: native.data, platform: 'mobile' as const, userAgent: 'MediLink Android' };
    if (!validateDeviceRegistration(body)) {
      throw new PushRegistrationError('token', 'Le token FCM reçu n’est pas valide.');
    }
    try {
      const saved = await notificationsApi.register(body);
      if (saved.deviceId !== deviceId || saved.platform !== 'mobile') {
        throw new PushRegistrationError('backend',
          'Le serveur n’a pas confirmé l’enregistrement de cet appareil.');
      }
      activeUser = profile.user.id;
      return true;
    } catch {
      throw new PushRegistrationError('backend',
        'Token FCM obtenu, mais son enregistrement sur MediLink a échoué. Vérifiez la connexion et le serveur API.');
    }
  })().finally(() => { if (registrationFlight === flight) registrationFlight = null; });
  registrationFlight = flight;
  return flight;
}

export async function unregisterPushDevice(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // Wait for any prior registration, so a delayed network reply cannot register
  // a device AFTER it was removed during logout.
  try { await registrationFlight; } catch { /* Continue local logout. */ }
  const session = useNavigationSession.getState().session;
  if (session.status !== 'authenticated' || !canUseNotifications(session.role)) {
    activeUser = null;
    return true;
  }
  const id = await SecureStore.getItemAsync(NOTIFICATION_DEVICE_ID_KEY);
  if (!id) { activeUser = null; return true; }
  try {
    await notificationsApi.unregister(id);
    activeUser = null;
    return true;
  } catch { return false; }
}

export function configurePushPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Without BOTH a banner and sound, Android can silently suppress heads-up.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function testLocalPushPresentation(): Promise<void> {
  if (!(await ensurePermission(true))) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'MediLink · Test de notification',
      body: 'Les alertes locales fonctionnent sur cet appareil.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: PUSH_CHANNEL,
    },
  });
}

export function notificationBackendUser() { return activeUser; }
