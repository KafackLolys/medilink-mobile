import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType, type PressableProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MinimumTouchTarget, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, accessibilityHint, style }: {
  label: string; onPress: PressableProps['onPress']; variant?: ButtonVariant; loading?: boolean;
  disabled?: boolean; accessibilityHint?: string; style?: ViewStyle;
}) {
  const theme = useTheme();
  const active = !disabled && !loading;
  const filled = variant === 'primary' || variant === 'secondary' || variant === 'danger';
  const backgroundColor = variant === 'primary' ? theme.primary : variant === 'secondary' ? theme.secondary :
    variant === 'danger' ? theme.danger : variant === 'outline' ? theme.backgroundElement : 'transparent';
  const foreground = filled ? (variant === 'primary' ? theme.onPrimary : theme.background) : theme.text;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !active, busy: loading }}
      disabled={!active} onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor, borderColor: variant === 'outline' ? theme.border : 'transparent',
        borderWidth: variant === 'outline' ? 1 : 0, opacity: !active ? 0.55 : pressed ? 0.8 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={foreground} size="small" accessibilityLabel="Chargement" /> : null}
      <ThemedText style={{ color: foreground, fontWeight: '700', textAlign: 'center' }}>{label}</ThemedText>
    </Pressable>
  );
}

export function Card({ children, style, accessibilityLabel }: { children: ReactNode; style?: ViewStyle; accessibilityLabel?: string }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'teal';
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const toneMap = {
    neutral: [theme.backgroundSelected, theme.textSecondary],
    info: [theme.infoSurface, theme.primary],
    success: [theme.successSurface, theme.success],
    warning: [theme.warningSurface, theme.warning],
    danger: [theme.dangerSurface, theme.danger],
    teal: [theme.backgroundSelected, theme.secondary],
  } as const;
  const [backgroundColor, color] = toneMap[tone];
  return (
    <View style={[styles.badge, { backgroundColor }]} accessibilityLabel={label}>
      <ThemedText style={{ color, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{label}</ThemedText>
    </View>
  );
}

export function Avatar({ name, source, size = 48 }: { name: string; source?: ImageSourcePropType; size?: number }) {
  const theme = useTheme();
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || '?';
  return (
    <View accessibilityLabel={name} style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: theme.infoSurface,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {source ? <Image source={source} style={{ width: size, height: size }} accessibilityLabel={name} /> :
        <ThemedText style={{ color: theme.primary, fontWeight: '700', fontSize: Math.max(14, size * 0.34) }}>{initials}</ThemedText>}
    </View>
  );
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }, style]} edges={['top', 'bottom', 'left', 'right']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>{children}</ScrollView> :
        <View style={styles.content}>{children}</View>}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, onBack, action }: {
  title: string; subtitle?: string; onBack?: () => void; action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      {onBack ? <Pressable onPress={onBack} accessibilityLabel="Retour" accessibilityRole="button" style={[styles.back, { borderColor: theme.border }]}>
        <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>‹</ThemedText>
      </Pressable> : null}
      <View style={{ flex: 1 }}>
        <ThemedText style={Typography.subtitle} accessibilityRole="header">{title}</ThemedText>
        {subtitle ? <ThemedText themeColor="textSecondary" type="small">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: MinimumTouchTarget, paddingHorizontal: Spacing.three, paddingVertical: 12, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.two },
  card: { borderWidth: 1, borderRadius: Radius.xlarge, padding: Spacing.three, gap: Spacing.two },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  screen: { flex: 1 },
  scrollContent: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three, width: '100%', maxWidth: 800, alignSelf: 'center' },
  content: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 56 },
  back: { width: MinimumTouchTarget, height: MinimumTouchTarget, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: Radius.large },
});
