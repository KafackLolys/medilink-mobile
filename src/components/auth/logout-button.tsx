import { useRef, useState } from 'react';
import { Button } from '@/components/ui/primitives';
import { logoutSession } from '@/features/auth/session';
import { ThemedText } from '@/components/themed-text';
import { View } from 'react-native';

/** No credentials or user data are exposed to the screen. */
export function LogoutButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function onLogout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try { await logoutSession(); }
    catch { setError("Impossible d'effacer la session sur cet appareil. Réessayez."); }
    finally { busy.current = false; setPending(false); }
  }
  return <View style={{ gap: 8 }}>
    <Button label="Se déconnecter" variant="outline" loading={pending} onPress={() => { void onLogout(); }} />
    {error ? <ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText> : null}
  </View>;
}
