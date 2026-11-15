import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { beginGoogleSignIn } from '@/features/auth/google-sign-in';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

function GoogleMark() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityLabel="Google">
    <Path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/>
    <Path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11 11 0 0 0 12 23z"/>
    <Path fill="#FBBC05" d="M5.6 13.7a6.6 6.6 0 0 1 0-4.2v-3H1.8a11 11 0 0 0 0 10.2l3.8-3z"/>
    <Path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11 11 0 0 0 1.8 6.5l3.8 3C6.5 6.8 9 5.4 12 5.4z"/>
  </Svg>;
}

export function GoogleAuthButton({ label = 'Continuer avec Google', disabled = false }: {
  label?: string; disabled?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function begin() {
    if (disabled || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await beginGoogleSignIn();
      if (result === 'needs_role') {
        router.replace({ pathname: '/choose-role', params: { google: '1' } });
      }
      // Successful sign-in already activates SecureStore + protected routing.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connexion Google impossible. Réessayez.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <View style={{ gap: Spacing.two }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint="Ouvrir le sélecteur natif de comptes Google"
      accessibilityState={{ busy: pending, disabled: pending || disabled }}
      disabled={pending || disabled} onPress={() => { void begin(); }}
      style={({ pressed }) => [styles.button, {
        backgroundColor: theme.backgroundElement, borderColor: theme.border,
        opacity: disabled || pending ? 0.6 : pressed ? 0.8 : 1,
      }]}>
      <GoogleMark />
      <ThemedText type="smallBold">{pending ? 'Connexion Google en cours…' : label}</ThemedText>
    </Pressable>
    {error ? <ThemedText type="small" themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1, borderRadius: Radius.large, minHeight: 54,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    gap: Spacing.three, paddingHorizontal: Spacing.three,
  },
});
