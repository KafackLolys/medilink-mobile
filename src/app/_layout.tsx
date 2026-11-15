import { useEffect, useState, type ComponentType } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { restoreSession } from '@/features/auth/session';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui/overlays';
import { useNavigationSession } from '@/store/navigation-session';
import { ConnectivityBanner } from '@/features/network/connectivity-banner';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const session = useNavigationSession(state => state.session);
  const verified = session.status === 'authenticated';
  const [PushLifecycle, setPushLifecycle] = useState<ComponentType | null>(null);
  useEffect(() => {
    // A broken SecureStore / network bootstrap must not become an unhandled
    // promise rejection at the root of the navigation tree.
    void restoreSession().catch(() => {
      // SessionManager publishes a safe reconnecting or guest state.
      // Never log credentials or expose a medical session on this path.
    });
  }, []);
  useEffect(() => {
    if (!verified || (session.role !== 'patient' && session.role !== 'doctor')) {
      setPushLifecycle(null);
      return;
    }
    let active = true;
    // Expo Go and older APKs can lack native FCM functionality. Optional push
    // must never be imported during the initial app navigation bootstrap.
    void import('@/features/notifications/push-lifecycle')
      .then(module => {
        if (active) setPushLifecycle(() => module.PushNotificationLifecycle);
      })
      .catch(() => {
        if (active) setPushLifecycle(null);
      });
    return () => { active = false; };
  }, [verified, session.role]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ToastProvider>
          {PushLifecycle ? <PushLifecycle /> : null}
          <ConnectivityBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="unauthorized" />
            <Stack.Screen name="account-status" />
            <Stack.Screen name="dev/design-system" />
            <Stack.Protected guard={session.status === 'unauthenticated'}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={verified && session.role === 'patient'}>
              <Stack.Screen name="patient" />
            </Stack.Protected>
            <Stack.Protected guard={verified && session.role === 'doctor'}>
              <Stack.Screen name="medecin" />
            </Stack.Protected>
            <Stack.Protected guard={verified && session.role === 'admin'}>
              <Stack.Screen name="admin" />
            </Stack.Protected>
          </Stack>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
