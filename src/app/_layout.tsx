import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui/overlays';
import { useNavigationSession } from '@/store/navigation-session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const session = useNavigationSession(state => state.session);
  const verified = session.status === 'authenticated';

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="unauthorized" />
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
