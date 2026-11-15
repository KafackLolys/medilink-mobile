import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { describeGoogleError, startGoogleSignIn } from '@/features/auth/google-auth';

function GoogleMark() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityLabel="Google">
    <Path fill="#4285F4" d="M21.35 12.28c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.95 2.95v2.45h3.16c1.85-1.7 2.9-4.2 2.9-7.23Z"/>
    <Path fill="#34A853" d="M12 21.8c2.64 0 4.86-.88 6.48-2.29l-3.16-2.45c-.88.59-2 .95-3.32.95-2.55 0-4.71-1.72-5.49-4.03H3.25v2.53A9.8 9.8 0 0 0 12 21.8Z"/>
    <Path fill="#FBBC05" d="M6.51 13.98A5.89 5.89 0 0 1 6.2 12c0-.68.12-1.34.31-1.98V7.49H3.25A9.8 9.8 0 0 0 2.2 12c0 1.58.38 3.12 1.05 4.51l3.26-2.53Z"/>
    <Path fill="#EA4335" d="M12 5.99c1.44 0 2.72.5 3.73 1.46l2.8-2.8A9.39 9.39 0 0 0 12 2.2a9.8 9.8 0 0 0-8.75 5.29l3.26 2.53C7.29 7.71 9.45 5.99 12 5.99Z"/>
  </Svg>;
}

export function GoogleAuthButton({ label = 'Continuer avec Google', disabled = false }: {
  label?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function begin() {
    if (busy.current || disabled) return;
    busy.current = true;
    const request = new AbortController();
    controller.current = request;
    setError('');
    setLoading(true);
    try {
      const result = await startGoogleSignIn(request.signal);
      if (!request.signal.aborted && result === 'needs-role') {
        router.replace({ pathname: '/choose-role', params: { google: '1' } });
      }
      // An existing account is redirected by the authenticated role guard.
    } catch (cause) {
      if (!request.signal.aborted) setError(describeGoogleError(cause));
    } finally {
      busy.current = false;
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading} onPress={() => { void begin(); }}
      style={({ pressed }) => [styles.button, {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.border,
        opacity: disabled ? .55 : pressed ? .8 : 1,
      }]}>
      {loading ? <ActivityIndicator size="small" color={theme.primary} /> : <GoogleMark />}
      <ThemedText type="smallBold" style={{ color: theme.text }}>{label}</ThemedText>
    </Pressable>
    {error ? <ThemedText themeColor="danger" type="small" accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 12, paddingHorizontal: 16,
  },
});
