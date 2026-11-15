import { Link } from 'expo-router';
import { Bell, HeartPulse } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

type NotificationRoute = '/patient/notifications' | '/medecin/notifications';

export function MedihomeHeader({ name, notificationsHref }: {
  name?: string;
  notificationsHref?: NotificationRoute;
}) {
  const theme = useTheme();
  const initials = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join('') || 'ML';
  return <View style={[styles.shell, {
    backgroundColor: theme.backgroundElement, borderColor: theme.border,
  }]}>
    <View style={styles.brand}>
      <View style={[styles.logo, { backgroundColor: theme.primary }]}>
        <HeartPulse color="#FFFFFF" size={22} />
      </View>
      <ThemedText type="smallBold" style={{ color: theme.night, fontSize: 19, fontWeight: '800' }}>
        Medihome
      </ThemedText>
    </View>
    <View style={styles.actions}>
      {notificationsHref ? <Link href={notificationsHref} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Ouvrir les notifications" style={styles.icon}>
          <Bell color={theme.text} size={23} />
        </Pressable>
      </Link> : null}
      <View accessible accessibilityLabel={'Profil : ' + (name || 'MediLink')} style={[styles.avatar, {
        backgroundColor: theme.infoSurface,
      }]}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>{initials}</ThemedText>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 66, borderRadius: Radius.pill, borderWidth: 1,
    padding: Spacing.two, paddingHorizontal: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center' },
});
