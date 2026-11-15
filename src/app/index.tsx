import { Link, Redirect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Activity, ArrowRight, Brain, CalendarCheck, ChevronRight, Flower2,
  HeartPulse, MapPin, MessageCircle, Plus, Search, ShieldCheck,
  Sparkles, Stethoscope, UserRound, Baby, LayoutGrid,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { Screen, Card, Button } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { roleHome, useNavigationSession } from '@/store/navigation-session';
import { LoadingState } from '@/components/ui/states';
import { LogoutButton } from '@/components/auth/logout-button';
import { restoreSession } from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

const SPECIALTIES: Array<{ label: string; Icon: ComponentType<LucideProps> }> = [
  { label: 'Médecine générale', Icon: Stethoscope },
  { label: 'Pédiatrie', Icon: Baby },
  { label: 'Cardiologie', Icon: HeartPulse },
  { label: 'Dermatologie', Icon: Sparkles },
  { label: 'Gynécologie', Icon: Flower2 },
  { label: 'Neurologie', Icon: Brain },
  { label: 'Kinésithérapie', Icon: Activity },
  { label: 'Autres', Icon: LayoutGrid },
];

const HOW_IT_WORKS = [
  { title: 'Décrivez votre besoin', body: 'Expliquez votre situation médicale à votre rythme.', Icon: Search },
  { title: 'Échangez avec un médecin', body: 'Consultez les propositions et posez vos questions.', Icon: MessageCircle },
  { title: 'Confirmez le rendez-vous', body: 'Choisissez une date et un mode de consultation adaptés.', Icon: CalendarCheck },
] as const;

/** Public homepage. No fabricated doctors, ratings, pricing or available slots. */
export default function Index() {
  const theme = useTheme();
  const session = useNavigationSession(state => state.session);
  if (session.status === 'loading') {
    return <Screen><LoadingState label="Vérification de votre session…" /></Screen>;
  }
  if (session.status === 'authenticated') return <Redirect href={roleHome(session.role)} />;
  if (session.status === 'unverified') {
    return <Screen>
      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">Connexion à vérifier</ThemedText>
        <ThemedText themeColor="textSecondary">
          Votre compte reste enregistré sur cet appareil. Le serveur est momentanément inaccessible.
          Vos données privées ne seront accessibles qu’après vérification de votre session.
        </ThemedText>
        <Button label="Réessayer la connexion" onPress={() => { void restoreSession(); }} />
        <LogoutButton />
      </Card>
    </Screen>;
  }

  return <Screen>
    <View style={[styles.topBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <HeartPulse color="#FFFFFF" size={20} />
        </View>
        <ThemedText type="smallBold" style={{ fontSize: 17, color: theme.night }}>MediLink</ThemedText>
      </View>
      <Link href="/choose-role" asChild>
        <Pressable accessibilityRole="link" style={[styles.createButton, { backgroundColor: theme.primary }]}>
          <ThemedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Créer un compte</ThemedText>
        </Pressable>
      </Link>
    </View>

    <View style={[styles.hero, { backgroundColor: theme.infoSurface }]}>
      <ThemedText type="title" style={{ color: theme.night, fontSize: 31, lineHeight: 36 }}>
        La santé, plus proche de vous
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Trouvez un médecin ou publiez votre besoin médical pour recevoir de l’aide, sans vous déplacer.
      </ThemedText>
      <View style={[styles.searchPanel, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.searchRow}>
          <Stethoscope color={theme.primary} size={21} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">Spécialité médicale</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Recherchez un médecin vérifié</ThemedText>
          </View>
        </View>
        <View style={styles.searchRow}>
          <MapPin color={theme.secondary} size={21} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">Localisation</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Par ville ou quartier, sans accès GPS</ThemedText>
          </View>
        </View>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link" style={[styles.primaryLink, { backgroundColor: theme.primary }]}>
            <ArrowRight color="#FFFFFF" size={20} />
            <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Se connecter pour rechercher</ThemedText>
          </Pressable>
        </Link>
      </View>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="link" style={[styles.feature, { backgroundColor: theme.backgroundSelected }]}>
          <Stethoscope color={theme.primary} size={25} />
          <ThemedText type="smallBold" themeColor="primary">Trouver un médecin</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Consultez les profils et demandez un rendez-vous.</ThemedText>
        </Pressable>
      </Link>
      <Link href="/choose-role" asChild>
        <Pressable accessibilityRole="link" style={[styles.feature, { backgroundColor: theme.backgroundElement }]}>
          <Plus color={theme.secondary} size={25} />
          <ThemedText type="smallBold" style={{ color: theme.secondary }}>Publier un besoin médical</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Décrivez votre situation pour recevoir des propositions.</ThemedText>
        </Pressable>
      </Link>
    </View>

    <View style={styles.section}>
      <ThemedText type="subtitle" accessibilityRole="header" style={{ color: theme.night }}>
        Quelle spécialité recherchez-vous ?
      </ThemedText>
      <View style={styles.specialties}>
        {SPECIALTIES.map(({ label, Icon }) =>
          <Link href="/login" asChild key={label}>
            <Pressable accessibilityRole="link" accessibilityLabel={'Se connecter pour rechercher : ' + label}
              style={({ pressed }) => [styles.specialty, {
                backgroundColor: theme.backgroundElement, opacity: pressed ? .7 : 1,
              }]}>
              <View style={[styles.specialtyIcon, { backgroundColor: theme.infoSurface }]}>
                <Icon color={theme.primary} size={21} />
              </View>
              <ThemedText style={styles.specialtyLabel}>{label}</ThemedText>
            </Pressable>
          </Link>,
        )}
      </View>
    </View>

    <View style={styles.section}>
      <ThemedText type="subtitle" accessibilityRole="header" style={{ color: theme.night }}>
        Comment ça marche ?
      </ThemedText>
      {HOW_IT_WORKS.map(({ title, body, Icon }, index) =>
        <Card key={title} style={{ borderWidth: 0, borderRadius: Radius.xlarge, padding: Spacing.four }}>
          <View style={styles.stepHeading}>
            <View style={[styles.stepIcon, { backgroundColor: theme.infoSurface }]}>
              <Icon color={theme.secondary} size={22} />
            </View>
            <ThemedText style={{ color: theme.border, fontWeight: '800', fontSize: 25 }}>{index + 1}</ThemedText>
          </View>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{body}</ThemedText>
        </Card>,
      )}
    </View>

    <Card style={{ backgroundColor: theme.infoSurface, borderWidth: 0, padding: Spacing.four }}>
      <ShieldCheck color={theme.secondary} size={27} />
      <ThemedText type="subtitle" style={{ color: theme.night }}>Découvrez nos médecins vérifiés</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Consultez les spécialités et les informations vérifiées de l’annuaire MediLink.
      </ThemedText>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="link" style={styles.textLink}>
          <ThemedText type="smallBold" themeColor="primary">Voir tous les médecins</ThemedText>
          <ChevronRight color={theme.primary} size={17} />
        </Pressable>
      </Link>
    </Card>

    <Card style={{ backgroundColor: theme.infoSurface, borderWidth: 0, padding: Spacing.four }}>
      <ThemedText type="subtitle" style={{ color: theme.night }}>Vous ne savez pas qui contacter ?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Publiez votre besoin médical. Les médecins vérifiés de votre secteur pourront vous proposer leurs services.
      </ThemedText>
      <Link href="/choose-role" asChild>
        <Pressable accessibilityRole="link" style={[styles.tealLink, { backgroundColor: theme.secondary }]}>
          <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Publier un besoin médical</ThemedText>
        </Pressable>
      </Link>
    </Card>

    <View style={styles.footer}>
      <ThemedText type="small" themeColor="textSecondary">
        MediLink ne remplace pas une consultation. En cas d’urgence médicale,
        contactez immédiatement les services d’urgence.
      </ThemedText>
      <View style={styles.footerLinks}>
        <Link href="/aide"><ThemedText type="small" themeColor="primary">Aide</ThemedText></Link>
        <Link href="/contact"><ThemedText type="small" themeColor="primary">Contact</ThemedText></Link>
        <Link href="/privacy"><ThemedText type="small" themeColor="primary">Confidentialité</ThemedText></Link>
        <Link href="/terms"><ThemedText type="small" themeColor="primary">Conditions</ThemedText></Link>
      </View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.pill, borderWidth: 1, padding: 9, paddingHorizontal: 12, gap: 8,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  createButton: { borderRadius: Radius.pill, minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' },
  hero: { padding: Spacing.four, borderRadius: Radius.xlarge, gap: Spacing.three },
  searchPanel: { borderRadius: Radius.xlarge, padding: Spacing.three, gap: Spacing.three },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryLink: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.pill, paddingHorizontal: 12, gap: 8,
  },
  feature: { borderRadius: Radius.xlarge, padding: Spacing.three, gap: Spacing.two },
  section: { gap: Spacing.three, marginTop: Spacing.two },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  specialty: {
    flexBasis: '47%', flexGrow: 1, minHeight: 110,
    borderRadius: Radius.xlarge, alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: Spacing.two,
  },
  specialtyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  specialtyLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  stepHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 },
  tealLink: { alignSelf: 'flex-start', minHeight: 48, borderRadius: Radius.pill, paddingHorizontal: 20, justifyContent: 'center', marginTop: 6 },
  footer: { gap: Spacing.three, paddingVertical: Spacing.three },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
