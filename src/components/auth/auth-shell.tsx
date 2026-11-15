import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { HeartPulse } from 'lucide-react-native';
import { Screen } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export function AuthShell({ title, subtitle, children, step }: {
  title: string; subtitle: string; children: ReactNode; step?: 1 | 2;
}) {
  const theme = useTheme();
  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <HeartPulse color="#FFFFFF" size={25} strokeWidth={2.2} />
        </View>
        <ThemedText type="subtitle" style={{ color: theme.night, fontWeight: '800' }}>Medihome</ThemedText>
      </View>
      {step ? <View style={{ gap: Spacing.two }}>
        <ThemedText type="smallBold" themeColor="textSecondary">Étape {step} sur 2</ThemedText>
        <View style={styles.progress}>
          {[1, 2].map(index => <View key={index} style={[styles.progressPart, {
            backgroundColor: index <= step ? theme.primary : theme.border,
          }]} />)}
        </View>
      </View> : null}
      <View style={styles.heading}>
        <ThemedText type="title" accessibilityRole="header" style={{ color: theme.night }}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </View>
      <View style={styles.body}>{children}</View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        Medihome ne remplace pas une consultation. En cas d’urgence médicale,
        contactez immédiatement les services d’urgence.
      </ThemedText>
      <View style={styles.links}>
        <Link href="/privacy"><ThemedText type="linkPrimary">Confidentialité</ThemedText></Link>
        <Link href="/terms"><ThemedText type="linkPrimary">Conditions d’utilisation</ThemedText></Link>
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}
const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.four, paddingBottom: Spacing.four },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: Spacing.three, marginBottom: Spacing.four },
  mark: { width: 48, height: 48, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 8, height: 7 },
  progressPart: { flex: 1, borderRadius: Radius.pill },
  heading: { gap: Spacing.two, marginBottom: Spacing.one },
  body: { gap: Spacing.three },
  notice: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.two },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.four },
});
