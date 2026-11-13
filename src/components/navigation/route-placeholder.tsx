import type { ReactNode } from 'react';
import { Screen, Header, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';

/** Structure only. It never displays pretend medical data or actions. */
export function RoutePlaceholder({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <Screen>
      <Header title={title} subtitle={description} />
      <Card>
        <ThemedText type="smallBold">Navigation préparée</ThemedText>
        <ThemedText themeColor="textSecondary">
          Cet écran sera développé lors de son lot fonctionnel, après la revue responsive
          du site et la vérification de son API. Aucune donnée médicale simulée.
        </ThemedText>
      </Card>
      {children}
    </Screen>
  );
}
