import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, Link } from 'expo-router';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Header, Avatar, Badge, Button } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { LoadingState, EmptyState } from '@/components/ui/states';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { authApi } from '@/services/auth';
import { needsApi } from '@/services/needs';
import { appointmentsApi } from '@/services/appointments';
import { notificationsApi } from '@/services/notifications';
import { messagesApi } from '@/services/messages';
import { patientOverview, formatPatientDate, NEED_LABELS, consultationLabel } from '@/features/patient/dashboard-model';
import type {
  AuthenticatedUser, PatientAppointment, PatientNeed, UserNotification, Conversation,
} from '@/types/domain';

type Resource<T> = { status: 'loading' } | { status: 'success'; value: T } | { status: 'error' };
type DashboardData = {
  profile: Resource<AuthenticatedUser>;
  needs: Resource<PatientNeed[]>;
  appointments: Resource<PatientAppointment[]>;
  notifications: Resource<UserNotification[]>;
  conversations: Resource<Conversation[]>;
};
type DashboardKey = keyof DashboardData;
const loading = (): DashboardData => ({
  profile: { status: 'loading' }, needs: { status: 'loading' },
  appointments: { status: 'loading' }, notifications: { status: 'loading' },
  conversations: { status: 'loading' },
});
const RESOURCE_NAMES: Record<DashboardKey, string> = {
  profile: 'profil',
  needs: 'demandes médicales',
  appointments: 'rendez-vous',
  notifications: 'notifications',
  conversations: 'messages',
};

function LinkCard({ href, title, description, color }: {
  href: '/patient/medecins' | '/patient/besoins/nouveau' | '/patient/messages' | '/patient/profil';
  title: string; description: string; color: string;
}) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={title}
        accessibilityHint={description}
        style={({ pressed }) => [styles.action, { backgroundColor: color, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.text }}>{title}  ›</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      </Pressable>
    </Link>
  );
}

function SectionTitle({ title, href, linkLabel = 'Tout voir' }: {
  title: string; href?: '/patient/demandes' | '/patient/rendez-vous' | '/patient/messages' | '/patient/profil';
  linkLabel?: string;
}) {
  return <View style={styles.sectionHeader}>
    <ThemedText type="subtitle" accessibilityRole="header" style={styles.sectionTitle}>{title}</ThemedText>
    {href ? <Link href={href}><ThemedText type="smallBold" themeColor="primary">{linkLabel}</ThemedText></Link> : null}
  </View>;
}

function MissingSection({ name, onRetry }: { name: string; onRetry: () => void }) {
  return <Card>
    <ThemedText themeColor="danger" accessibilityRole="alert">Impossible de charger {name}.</ThemedText>
    <Button variant="outline" label="Réessayer" onPress={onRetry} />
  </Card>;
}

function DataCard({ children, href, label }: {
  children: React.ReactNode;
  href: '/patient/demandes' | '/patient/rendez-vous' | '/patient/demandes/[id]' | '/patient/rendez-vous/[id]';
  label: string;
}) {
  return <Link href={href} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
      <Card>{children}</Card>
    </Pressable>
  </Link>;
}

export default function PatientDashboard() {
  const theme = useTheme();
  const session = useNavigationSession(state => state.session);
  const [data, setData] = useState<DashboardData>(loading);
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const load = useCallback((isRefresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const seq = ++generation.current;
    if (isRefresh) setRefreshing(true);
    else setData(loading());

    const update = <K extends DashboardKey>(key: K, resource: DashboardData[K]) => {
      if (!controller.signal.aborted && seq === generation.current) {
        setData(prev => ({ ...prev, [key]: resource }));
      }
    };
    const run = async <K extends DashboardKey, T>(key: K, work: () => Promise<T>) => {
      try {
        const value = await work();
        update(key, { status: 'success', value } as DashboardData[K]);
      } catch {
        if (!controller.signal.aborted) update(key, { status: 'error' });
      }
    };

    void Promise.all([
      run('profile', async () => (await authApi.profile(controller.signal)).user),
      run('needs', () => needsApi.list(controller.signal)),
      run('appointments', () => appointmentsApi.list(controller.signal)),
      run('notifications', async () => (await notificationsApi.list(1, 5, controller.signal)).items),
      run('conversations', async () => (await messagesApi.list(controller.signal)).items),
    ]).finally(() => {
      if (seq === generation.current && !controller.signal.aborted) setRefreshing(false);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    if (session.status === 'authenticated' && session.role === 'patient') load();
    return () => {
      generation.current++;
      requestRef.current?.abort();
    };
  }, [load, session.status, session.role]));

  useEffect(() => () => requestRef.current?.abort(), []);

  if (session.status !== 'authenticated' || session.role !== 'patient') {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <LoadingState label="Vérification de votre accès…" />
    </SafeAreaView>;
  }

  const needs = data.needs.status === 'success' ? data.needs.value : null;
  const appointments = data.appointments.status === 'success' ? data.appointments.value : null;
  const notifications = data.notifications.status === 'success' ? data.notifications.value : null;
  const conversations = data.conversations.status === 'success' ? data.conversations.value : null;
  const summary = patientOverview(needs, appointments);
  const firstName = data.profile.status === 'success' ? data.profile.value.firstName?.trim() : undefined;
  const errorKeys = (Object.keys(data) as DashboardKey[]).filter(key => data[key].status === 'error');

  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top','left','right']}>
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)}
        colors={[theme.primary]} tintColor={theme.primary} accessibilityLabel="Actualiser le tableau de bord" />}
      keyboardShouldPersistTaps="handled">
      <Header action={<Link href="/patient/notifications"><ThemedText type="smallBold" themeColor="primary">Notifications</ThemedText></Link>} title={firstName ? `Bonjour ${firstName} 👋` : 'Bonjour, bienvenue 👋'}
        subtitle="Vos démarches médicales et vos rendez-vous." />
      {data.profile.status === 'success' ? (
        <LinkCard href="/patient/profil" title="Mon profil" description="Consulter mes informations" color={theme.backgroundElement} />
      ) : data.profile.status === 'loading' ? (
        <ThemedText type="small" themeColor="textSecondary">Chargement de votre profil…</ThemedText>
      ) : null}

      <View style={styles.actions}>
        <LinkCard href="/patient/medecins" title="Trouver un médecin"
          description="Rechercher un professionnel" color={theme.infoSurface} />
        <LinkCard href="/patient/besoins/nouveau" title="Publier un besoin"
          description="Créer une demande médicale" color={theme.backgroundSelected} />
      </View>

      {errorKeys.length ? <Card>
        <ThemedText accessibilityRole="alert" themeColor="danger">
          Certaines informations sont indisponibles : {errorKeys.map(key => RESOURCE_NAMES[key]).join(', ')}.
        </ThemedText>
        <Button label="Réessayer le chargement" variant="outline" onPress={() => load(true)} />
      </Card> : null}

      <View style={styles.section}>
        <SectionTitle title="Votre prochain rendez-vous" href="/patient/rendez-vous" />
        {data.appointments.status === 'loading' ? <LoadingState label="Chargement des rendez-vous…" />
          : data.appointments.status === 'error' ? <MissingSection name="vos rendez-vous" onRetry={() => load(true)} />
          : summary.nextAppointment ? (
            <DataCard href={`/patient/rendez-vous/${encodeURIComponent(summary.nextAppointment.id)}` as '/patient/rendez-vous/[id]'}
              label={`Rendez-vous avec ${summary.nextAppointment.doctor.name}`}>
              <ThemedText type="smallBold">{summary.nextAppointment.doctor.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {summary.nextAppointment.doctor.specialty} · {formatPatientDate(summary.nextAppointment.scheduledAt)}
              </ThemedText>
              <Badge tone="info" label={consultationLabel(summary.nextAppointment.consultationMode)} />
            </DataCard>
          ) : <EmptyState title="Aucun rendez-vous à venir" description="Vos prochains rendez-vous apparaîtront ici." />}
      </View>

      <View style={styles.section}>
        <SectionTitle title="Votre activité" />
        <View style={styles.metrics}>
          {([
            ['Demandes actives', summary.activeNeedsCount, '/patient/demandes'],
            ['Propositions reçues', summary.proposalsCount, '/patient/demandes'],
            ['Rendez-vous à venir', summary.upcomingCount, '/patient/rendez-vous'],
          ] as const).map(([label, count, href]) => (
            <Link href={href} asChild key={label}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${label} : ${count === null ? 'indisponible' : count}`}
                style={({ pressed }) => [styles.metric, { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? .75 : 1 }]}>
                <ThemedText type="smallBold">{label}</ThemedText>
                {count === null
                  ? <ThemedText themeColor="textSecondary">—</ThemedText>
                  : <ThemedText type="title" themeColor="primary">{count}</ThemedText>}
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Demandes en cours" href="/patient/demandes" />
        {data.needs.status === 'loading' ? <LoadingState label="Chargement des demandes…" /> :
          data.needs.status === 'error' ? <MissingSection name="vos demandes" onRetry={() => load(true)} /> :
          summary.active?.length ? summary.active.slice(0, 4).map(need => (
            <DataCard key={need.id} href={`/patient/demandes/${encodeURIComponent(need.id)}` as '/patient/demandes/[id]'} label={need.title}>
              <ThemedText type="smallBold">{need.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{need.specialty}</ThemedText>
              <Badge label={NEED_LABELS[need.status]} tone="info" />
            </DataCard>
          )) : <EmptyState title="Aucune demande active" description="Vos demandes médicales en cours apparaîtront ici." />}
      </View>

      <View style={styles.section}>
        <SectionTitle title="Messages" href="/patient/messages" />
        {data.conversations.status === 'loading' ? <LoadingState label="Chargement des messages…" />
          : data.conversations.status === 'error' ? <MissingSection name="vos messages" onRetry={() => load(true)} />
          : conversations?.length ? conversations.slice(0, 2).map(conversation => (
            <Card key={conversation.id}>
              <View style={styles.inline}>
                <Avatar name={conversation.peerName || 'Contact'} size={42} />
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="smallBold">{conversation.peerName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{conversation.preview}</ThemedText>
                </View>
                {conversation.unreadCount > 0 ? <Badge label={String(conversation.unreadCount)} tone="info" /> : null}
              </View>
            </Card>
          )) : <EmptyState title="Aucune conversation" description="Vos messages apparaîtront ici lorsqu'une conversation sera disponible." />}
      </View>

      <View style={styles.section}>
        <SectionTitle title="Notifications" />
        {data.notifications.status === 'loading' ? <LoadingState label="Chargement des notifications…" />
          : data.notifications.status === 'error' ? <MissingSection name="vos notifications" onRetry={() => load(true)} />
          : notifications?.length ? notifications.map(notification => (
            <Card key={notification.id}>
              <View style={styles.inline}>
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="smallBold">{notification.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{notification.body}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatPatientDate(notification.createdAt)}</ThemedText>
                </View>
                {!notification.readAt ? <Badge label="Nouveau" tone="info" /> : null}
              </View>
            </Card>
          )) : <EmptyState title="Aucune notification" description="Les actualités de votre compte apparaîtront ici." />}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Faites glisser vers le bas pour actualiser les informations.
      </ThemedText>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 800, padding: Spacing.three,
    paddingBottom: Spacing.six + 48, gap: Spacing.four },
  actions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 145, minHeight: MinimumTouchTarget + 42, padding: Spacing.three,
    borderRadius: Radius.xlarge, borderWidth: 1, justifyContent: 'center', gap: Spacing.two },
  section: { gap: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  sectionTitle: { flexShrink: 1 },
  metrics: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  metric: { minWidth: 136, flexBasis: 140, flexGrow: 1, borderWidth: 1, borderRadius: Radius.xlarge,
    padding: Spacing.three, minHeight: 100, justifyContent: 'space-between', gap: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footer: { textAlign: 'center' },
});
