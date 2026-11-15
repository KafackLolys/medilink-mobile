import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Mobile auth follows the web's clean unboxed form, blue brand mark and quiet footer. */
export function AuthShell({ title, subtitle, children }: {
  title: string; subtitle: string; children: ReactNode;
}) {
  const theme = useTheme();
  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: theme.primary }]}>
          <HeartPulse size={25} color={theme.onPrimary} strokeWidth={2} />
        </View>
        <ThemedText style={[styles.brandName, { color: theme.night }]}>MediLink</ThemedText>
      </View>
      <View style={styles.heading}>
        <ThemedText type="title" accessibilityRole="header" style={{ color: theme.night }}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </View>
      <View style={styles.content}>{children}</View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        MediLink ne remplace pas une consultation. En cas d’urgence médicale, contactez immédiatement les services d’urgence.
      </ThemedText>
      <View style={styles.links}>
        <Link href="/aide"><ThemedText type="linkPrimary">Aide</ThemedText></Link>
        <Link href="/privacy"><ThemedText type="linkPrimary">Confidentialité</ThemedText></Link>
        <Link href="/terms"><ThemedText type="linkPrimary">Conditions d’utilisation</ThemedText></Link>
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}
const styles = StyleSheet.create({
  wrap: {
    width: '100%', maxWidth: 480, alignSelf: 'center',
    gap: Spacing.four, paddingTop: Spacing.three,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  brandIcon: {
    width: 48, height: 48, borderRadius: Radius.large,
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 23, fontWeight: '800' },
  heading: { gap: Spacing.two, paddingTop: Spacing.four },
  content: { gap: Spacing.three },
  notice: { textAlign: 'center', marginTop: Spacing.four },
  links: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap',
    gap: Spacing.three, paddingBottom: Spacing.three,
  },
});
