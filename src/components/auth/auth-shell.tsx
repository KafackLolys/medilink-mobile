import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function AuthShell({ title, subtitle, children }: {
  title: string; subtitle: string; children: ReactNode;
}) {
  return <Screen>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" themeColor="primary">Medilink</ThemedText>
        <ThemedText type="title" accessibilityRole="header">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </View>
      <Card>{children}</Card>
      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        Medilink ne remplace pas une consultation. En cas d’urgence médicale, contactez immédiatement les services d’urgence.
      </ThemedText>
      <View style={styles.links}>
        <Link href="/privacy"><ThemedText type="linkPrimary">Confidentialité</ThemedText></Link>
        <Link href="/terms"><ThemedText type="linkPrimary">Conditions d’utilisation</ThemedText></Link>
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}
const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.three },
  heading: { gap: Spacing.two, paddingTop: Spacing.four },
  notice: { textAlign: 'center', marginTop: Spacing.two },
  links: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.two, paddingBottom: Spacing.three },
});
