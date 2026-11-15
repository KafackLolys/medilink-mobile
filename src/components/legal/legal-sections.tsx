import { Link } from 'expo-router';
import { View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export function LegalDraftNotice() {
  const theme = useTheme();
  return <Card style={{ backgroundColor: theme.warningSurface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      <ShieldAlert color={theme.warning} size={22} />
      <ThemedText type="smallBold" style={{ color: theme.warning }}>Mentions légales à finaliser</ThemedText>
    </View>
    <ThemedText type="small">
      Le texte de référence web du 12 novembre 2026 comporte encore des mentions
      non renseignées (éditeur, pays, durée de conservation ou juridiction).
      Ces éléments doivent être validés et complétés avant diffusion officielle.
    </ThemedText>
  </Card>;
}

export function LegalSection({ title, paragraphs }: { title: string; paragraphs: readonly string[] }) {
  return <View style={{ gap: Spacing.two }}>
    <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
    {paragraphs.map((value, index) =>
      <ThemedText key={index} themeColor="textSecondary">{value}</ThemedText>,
    )}
  </View>;
}

export function LegalContact() {
  return <Card>
    <ThemedText type="smallBold">Une question ou une demande concernant vos données ?</ThemedText>
    <Link href="/contact"><ThemedText type="linkPrimary">Ouvrir le formulaire de contact</ThemedText></Link>
  </Card>;
}
