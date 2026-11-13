import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Temporary technical entry point. Actual public/authenticated screens will
 * replace it after the required responsive review of the deployed web app.
 */
export default function Index() {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title">Medilink</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            L'application Android est en préparation.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  content: { alignItems: 'center', gap: 16 },
  description: { textAlign: 'center' },
});
