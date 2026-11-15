import { Link, Redirect } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Activity, Baby, Brain, CalendarCheck, FileText, Flower2, HeartPulse,
  LayoutGrid, MessageCircle, Plus, ShieldCheck, Sparkles, Stethoscope,
} from 'lucide-react-native';
import { Card, Button, Screen } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { roleHome, useNavigationSession } from '@/store/navigation-session';
import { logoutSession, restoreSession } from '@/features/auth/session';
import { LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const specialties = [
  { name: 'Médecine générale', Icon: Stethoscope },
  { name: 'Pédiatrie', Icon: Baby },
  { name: 'Cardiologie', Icon: HeartPulse },
  { name: 'Dermatologie', Icon: Sparkles },
  { name: 'Gynécologie', Icon: Flower2 },
  { name: 'Neurologie', Icon: Brain },
  { name: 'Kinésithérapie', Icon: Activity },
  { name: 'Autres', Icon: LayoutGrid },
] as const;

const steps = [
  { title: 'Décrivez votre besoin', description: 'Expliquez simplement votre situation, à votre rythme.', Icon: FileText },
  { title: 'Échangez avec un médecin', description: 'Consultez les propositions reçues et posez vos questions.', Icon: MessageCircle },
  { title: 'Confirmez le rendez-vous', description: 'Choisissez une date adaptée et un mode de consultation.', Icon: CalendarCheck },
] as const;

/** Public native home based on the responsive web, with no invented doctor data. */
export default function Index() {
  const theme = useTheme();
  const session = useNavigationSession(state => state.session);
  if (session.status === 'loading') {
    return <Screen><LoadingState label="Vérification de votre session…" /></Screen>;
  }
  if (session.status === 'authenticated') return <Redirect href={roleHome(session.role)} />;

  if (session.status === 'reconnecting') return <Screen>
    <View style={{ gap: Spacing.three }}>
      <ThemedText type="title" accessibilityRole="header">Votre session est conservée</ThemedText>
      <ThemedText themeColor="textSecondary">
        L’accès à votre espace sera rétabli après une vérification auprès du serveur.
        Votre compte reste enregistré dans le stockage sécurisé de cet appareil.
      </ThemedText>
    </View>
    <Card>
      <Button label="Réessayer la connexion" onPress={() => { void restoreSession(); }} />
      <Button label="Me déconnecter" variant="outline" onPress={() => { void logoutSession(); }} />
    </Card>
  </Screen>;

  return <Screen>
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: Radius.pill, backgroundColor: theme.backgroundElement,
      paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: Spacing.two }}>
        <View style={{ backgroundColor: theme.primary, width: 32, height: 32,
          borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={23} color={theme.onPrimary} strokeWidth={3} />
        </View>
        <ThemedText type="smallBold" style={{ fontWeight: '800', color: theme.night }}>MediLink</ThemedText>
      </View>
      <Link href="/choose-role" asChild>
        <Pressable accessibilityRole="link" style={{
          backgroundColor: theme.primary, borderRadius: Radius.pill,
          paddingHorizontal: Spacing.three, paddingVertical: 11,
        }}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Créer un compte</ThemedText>
        </Pressable>
      </Link>
    </View>

    <Card style={{
      backgroundColor: theme.infoSurface, borderColor: 'transparent',
      borderRadius: 26, padding: Spacing.four, gap: Spacing.three,
    }}>
      <ThemedText type="title" style={{ color: theme.night }}>
        La santé, plus proche de vous
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Trouvez un médecin ou publiez votre besoin médical pour recevoir de l’aide, sans vous déplacer.
      </ThemedText>
      <Card style={{ borderColor: 'transparent', padding: Spacing.three, gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Stethoscope size={21} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">Spécialité médicale</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">Médecine générale, pédiatrie, neurologie…</ThemedText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Activity size={21} color={theme.secondary} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">Localisation</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">Ville ou quartier de votre choix</ThemedText>
          </View>
        </View>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link"
            style={{ backgroundColor: theme.primary, borderRadius: Radius.pill,
              minHeight: 50, alignItems: 'center', justifyContent: 'center', padding: Spacing.two }}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Connexion</ThemedText>
          </Pressable>
        </Link>
      </Card>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="link" style={{ padding: Spacing.three,
          borderRadius: Radius.xlarge, backgroundColor: theme.backgroundSelected, gap: Spacing.two }}>
          <Stethoscope size={24} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">Trouver un médecin</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Consultez les profils et prenez rendez-vous.</ThemedText>
        </Pressable>
      </Link>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="link" style={{ padding: Spacing.three,
          borderRadius: Radius.xlarge, backgroundColor: theme.successSurface, gap: Spacing.two }}>
          <FileText size={24} color={theme.secondary} />
          <ThemedText type="smallBold" themeColor="secondary">Publier un besoin médical</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Décrivez votre situation pour recevoir des propositions.</ThemedText>
        </Pressable>
      </Link>
    </Card>

    <View style={{ gap: Spacing.three, marginTop: Spacing.four }}>
      <ThemedText type="subtitle" style={{ color: theme.night }} accessibilityRole="header">
        Quelle spécialité recherchez-vous ?
      </ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two }}>
        {specialties.map(({ name, Icon }) => <Link href="/login" asChild key={name}>
          <Pressable accessibilityRole="link" accessibilityLabel={name}
            style={{ width: '48%', minHeight: 100, alignItems: 'center', justifyContent: 'center',
              borderRadius: Radius.xlarge, backgroundColor: theme.backgroundElement,
              padding: Spacing.two, gap: Spacing.two }}>
            <View style={{ width: 42, height: 42, borderRadius: Radius.large,
              backgroundColor: theme.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={23} color={theme.primary} />
            </View>
            <ThemedText type="smallBold" style={{ fontSize: 12, textAlign: 'center' }}>{name}</ThemedText>
          </Pressable>
        </Link>)}
      </View>
    </View>

    <View style={{ gap: Spacing.three, marginTop: Spacing.four }}>
      <ThemedText type="subtitle" style={{ color: theme.night }} accessibilityRole="header">Comment ça marche ?</ThemedText>
      {steps.map(({ title, description, Icon }, index) => <Card key={title} style={{ padding: Spacing.four }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ backgroundColor: theme.successSurface, width: 40, height: 40,
            borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={theme.secondary} />
          </View>
          <ThemedText style={{ fontSize: 27, fontWeight: '800', color: theme.border }}>{index + 1}</ThemedText>
        </View>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      </Card>)}
    </View>

    <View style={{ gap: Spacing.two, marginTop: Spacing.four }}>
      <ThemedText type="subtitle" style={{ color: theme.night }} accessibilityRole="header">
        Découvrez nos médecins vérifiés
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Consultez les profils, spécialités et disponibilités après connexion. Les informations sont récupérées auprès de MediLink.
      </ThemedText>
      <Link href="/login"><ThemedText type="linkPrimary">Voir tous les médecins</ThemedText></Link>
    </View>

    <Card style={{ gap: Spacing.three, marginTop: Spacing.four,
      backgroundColor: theme.successSurface, borderColor: 'transparent', padding: Spacing.four }}>
      <ThemedText type="subtitle" style={{ color: theme.night }}>Vous ne savez pas qui contacter ?</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Publiez votre besoin médical. Les médecins vérifiés de votre secteur vous envoient leurs propositions, vous choisissez.
      </ThemedText>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="link"
          style={{ alignSelf: 'flex-start', backgroundColor: theme.secondary,
            borderRadius: Radius.pill, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three }}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Publier un besoin médical</ThemedText>
        </Pressable>
      </Link>
    </Card>

    <View style={{ marginTop: Spacing.four, gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two }}>
        <ShieldCheck size={19} color={theme.secondary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
          MediLink ne remplace pas une consultation. En cas d’urgence médicale, contactez immédiatement les services d’urgence.
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three }}>
        <Link href="/aide"><ThemedText type="small" themeColor="textSecondary">Aide</ThemedText></Link>
        <Link href="/contact"><ThemedText type="small" themeColor="textSecondary">Contact</ThemedText></Link>
        <Link href="/privacy"><ThemedText type="small" themeColor="textSecondary">Confidentialité</ThemedText></Link>
        <Link href="/terms"><ThemedText type="small" themeColor="textSecondary">Conditions</ThemedText></Link>
      </View>
      <ThemedText type="small" themeColor="textSecondary">MediLink · Une mise en relation simple et humaine.</ThemedText>
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
