import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({ title, description, actionLabel, onAction, icon }: {
  title: string; description?: string; actionLabel?: string; onAction?: () => void; icon?: ReactNode;
}) {
  return (
    <Card style={styles.state}>
      {icon}
      <ThemedText type="subtitle" style={{ textAlign: 'center' }}>{title}</ThemedText>
      {description ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{description}</ThemedText> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="outline" /> : null}
    </Card>
  );
}

export function ErrorState({ title = 'Une erreur est survenue', description, onRetry }: {
  title?: string; description?: string; onRetry?: () => void;
}) {
  return (
    <Card style={styles.state}>
      <ThemedText type="subtitle" themeColor="danger" style={styles.center} accessibilityRole="alert">{title}</ThemedText>
      {description ? <ThemedText themeColor="textSecondary" style={styles.center}>{description}</ThemedText> : null}
      {onRetry ? <Button label="Réessayer" onPress={onRetry} /> : null}
    </Card>
  );
}

export function LoadingState({ label = 'Chargement en cours…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.state}>
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  center: { textAlign: 'center' },
});
