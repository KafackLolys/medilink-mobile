import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { LoadingState, EmptyState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { doctorsApi } from '@/services/doctors';
import { needsApi } from '@/services/needs';
import { appointmentsApi } from '@/services/appointments';
import { availabilitiesApi } from '@/services/availabilities';
import { messagesApi } from '@/services/messages';
import type { DoctorDashboardData, Resource } from '@/features/doctor/doctor-dashboard';
import {
  initialDoctorDashboard, parseDoctorProfile, parsePage,
  doctorCanAccessPatientNeeds, doctorGateMessage, DOCTOR_VERIFICATION_LABELS,
  doctorErrorReason, doctorDashboardMetrics, enabledDoctorWeek,
} from '@/features/doctor/doctor-dashboard';
import type { DoctorNeed, DoctorProposal, Page, Conversation } from '@/types/domain';

const DOCTOR_ROUTE = {
  needs: '/medecin/besoins',
  proposals: '/medecin/propositions',
  appointments: '/medecin/rendez-vous',
  availability: '/medecin/disponibilites',
  profile: '/medecin/profil',
  zone: '/medecin/zone-intervention',
  messages: '/medecin/messages',
} as const;

function QuickLink({ title, description, href }: {
  title: string; description: string; href: typeof DOCTOR_ROUTE[keyof typeof DOCTOR_ROUTE];
}) {
  const theme = useTheme();
  return <Link href={href} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={title} accessibilityHint={description}
      style={({ pressed }) => [styles.quickLink, {
        backgroundColor: theme.backgroundElement, borderColor: theme.border,
        opacity: pressed ? 0.75 : 1,
      }]}>
      <ThemedText type="smallBold">{title}  ›</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
    </Pressable>
  </Link>;
}

function SectionHeading({ title, href }: { title: string; href?: typeof DOCTOR_ROUTE[keyof typeof DOCTOR_ROUTE] }) {
  return <View style={styles.sectionHead}>
    <ThemedText type="subtitle" accessibilityRole="header" style={{ flex: 1 }}>{title}</ThemedText>
    {href ? <Link href={href}><ThemedText themeColor="primary" type="smallBold">Tout voir</ThemedText></Link> : null}
  </View>;
}

function FailedSection({ label, onRetry, restricted = false }: {
  label: string; onRetry: () => void; restricted?: boolean;
}) {
  return <Card>
    <ThemedText accessibilityRole="alert" themeColor="danger">
      {restricted ? `Accès à ${label} non autorisé pour ce profil.` : `Impossible de charger ${label}.`}
    </ThemedText>
    {!restricted ? <Button label="Réessayer" variant="outline" onPress={onRetry} /> : null}
  </Card>;
}

function formatAppointment(appointment: { date: string; time: string }) {
  return `${appointment.date} · ${appointment.time}`;
}

export default function DoctorDashboardScreen() {
  const theme = useTheme();
  const session = useNavigationSession(s => s.session);
  const [data, setData] = useState<DoctorDashboardData>(initialDoctorDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);

  const load = useCallback((pull = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const epoch = ++sequence.current;
    if (pull) setRefreshing(true);
    else setData(initialDoctorDashboard());

    const active = () => !controller.signal.aborted && epoch === sequence.current;
    const set = <K extends keyof DoctorDashboardData>(key: K, result: DoctorDashboardData[K]) => {
      if (active()) setData(prev => ({ ...prev, [key]: result }));
    };
    const run = async <K extends keyof DoctorDashboardData, T>(
      key: K, loadSource: () => Promise<T>, normalize: (payload: T) => unknown = payload => payload,
    ) => {
      try {
        const payload = await loadSource();
        set(key, { status: 'success', value: normalize(payload) } as DoctorDashboardData[K]);
      } catch (error) {
        if (active()) set(key, { status: 'error', reason: doctorErrorReason(error) });
      }
    };

    // The professional profile is the gate for patient needs/proposals. Never
    // request those private datasets until the backend confirms "verified".
    const task = (async () => {
      let profile;
      try {
        profile = parseDoctorProfile(await doctorsApi.me(controller.signal));
        if (!active()) return;
        set('profile', { status: 'success', value: profile });
      } catch (error) {
        set('profile', { status: 'error', reason: doctorErrorReason(error) });
        // Do not ask for any sensitive datasets if identity cannot be verified.
        if (active()) {
          set('needs', { status: 'restricted' });
          set('proposals', { status: 'restricted' });
          set('appointments', { status: 'restricted' });
          set('weekly', { status: 'restricted' });
          set('blocked', { status: 'restricted' });
          set('conversations', { status: 'restricted' });
        }
        return;
      }

      if (!active()) return;
      if (!doctorCanAccessPatientNeeds(profile.verificationStatus)) {
        set('needs', { status: 'restricted' });
        set('proposals', { status: 'restricted' });
      }

      const jobs: Promise<void>[] = [
        run('appointments', () => appointmentsApi.doctor(controller.signal)),
        run('weekly', () => availabilitiesApi.weekly(controller.signal)),
        run('blocked', () => availabilitiesApi.blocked(controller.signal)),
        run('conversations', async () => (await messagesApi.list(controller.signal)).items),
      ];
      if (doctorCanAccessPatientNeeds(profile.verificationStatus)) {
        jobs.push(run('needs', () => needsApi.doctor({ page: 1, pageSize: 5 }, controller.signal),
          value => parsePage<DoctorNeed>(value)));
        jobs.push(run('proposals', () => needsApi.proposals({ page: 1, pageSize: 10 }, controller.signal),
          value => ({ ...parsePage<DoctorProposal>(value), counts: value.counts })));
      }
      await Promise.all(jobs);
    })();
    void task.finally(() => { if (active()) setRefreshing(false); });
  }, []);

  useFocusEffect(useCallback(() => {
    if (session.status === 'authenticated' && session.role === 'doctor') load();
    return () => {
      sequence.current++;
      request.current?.abort();
      // Do not retain patient messages or requests across tab changes/accounts.
      setData(initialDoctorDashboard());
      setRefreshing(false);
    };
  }, [session.status, session.role, load]));

  if (session.status !== 'authenticated' || session.role !== 'doctor') {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <LoadingState label="Vérification des droits médecin…" />
    </SafeAreaView>;
  }

  const profile = data.profile.status === 'success' ? data.profile.value : null;
  const isVerified = doctorCanAccessPatientNeeds(profile?.verificationStatus);
  const metrics = doctorDashboardMetrics(data);
  const needs = data.needs.status === 'success' ? data.needs.value.items : null;
  const proposals = data.proposals.status === 'success' ? data.proposals.value.items : null;
  const messages = data.conversations.status === 'success' ? data.conversations.value : null;
  const week = data.weekly.status === 'success' ? enabledDoctorWeek(data.weekly.value) : null;
  const failed = (Object.keys(data) as Array<keyof DoctorDashboardData>)
    .filter(key => data[key].status === 'error');
  const labels: Record<keyof DoctorDashboardData, string> = {
    profile: 'profil', needs: 'demandes', proposals: 'propositions',
    appointments: 'rendez-vous', weekly: 'disponibilités',
    blocked: 'dates bloquées', conversations: 'messages',
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}
    edges={['top', 'left', 'right']}>
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)}
        colors={[theme.primary]} tintColor={theme.primary}
        accessibilityLabel="Actualiser le tableau de bord médecin" />}>
      <View style={[styles.hero, { backgroundColor: theme.infoSurface }]}>
        <ThemedText type="smallBold" themeColor="primary">ESPACE PROFESSIONNEL</ThemedText>
        <Header title="Bonjour Docteur 👋"
          subtitle="Votre activité et vos consultations, à partir des données Medilink." />
        {profile ? <View style={styles.identity}>
          <Avatar name={profile.name} size={52} />
          <View style={{ flex: 1, gap: Spacing.one }}>
            <ThemedText type="smallBold">{profile.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{profile.specialty || 'Spécialité non renseignée'}</ThemedText>
            <Badge label={DOCTOR_VERIFICATION_LABELS[profile.verificationStatus]}
              tone={profile.verificationStatus === 'verified' ? 'success' :
                profile.verificationStatus === 'pending' ? 'warning' : 'danger'} />
          </View>
        </View> : data.profile.status === 'loading' ?
          <LoadingState label="Chargement du profil professionnel…" /> : null}
      </View>

      {data.profile.status === 'error' ? <FailedSection label="votre profil professionnel"
        restricted={data.profile.reason === 'restricted'} onRetry={() => load(true)} /> : null}

      {profile && !isVerified ? <Card>
        <Badge label="Accès professionnel limité"
          tone={profile.verificationStatus === 'pending' ? 'warning' : 'danger'} />
        <ThemedText type="subtitle" accessibilityRole="header">Vérification du compte</ThemedText>
        <ThemedText>{doctorGateMessage(profile.verificationStatus)}</ThemedText>
        <QuickLink href={DOCTOR_ROUTE.profile} title="Consulter mon profil"
          description="Informations professionnelles et documents de vérification" />
      </Card> : null}

      {session.accountStatus === 'pending' ? <Card>
        <ThemedText themeColor="textSecondary" type="small">
          Votre compte utilisateur est encore en attente de validation. Le statut professionnel est vérifié séparément.
        </ThemedText>
      </Card> : null}

      {failed.length > 0 && profile ? <Card>
        <ThemedText accessibilityRole="alert" themeColor="danger">
          Certaines informations sont indisponibles : {failed.map(key => labels[key]).join(', ')}.
        </ThemedText>
        <Button variant="outline" label="Actualiser les données" onPress={() => load(true)} />
      </Card> : null}

      {profile ? <>
        <View style={styles.section}>
          <SectionHeading title="Mon activité" />
          <View style={styles.metrics}>
            {([
              ['Demandes disponibles', metrics.availableNeeds, DOCTOR_ROUTE.needs],
              ['Propositions envoyées', metrics.sentProposals, DOCTOR_ROUTE.proposals],
              ['Rendez-vous à venir', metrics.upcomingAppointments, DOCTOR_ROUTE.appointments],
              ['Messages non lus', metrics.unreadConversations, DOCTOR_ROUTE.messages],
            ] as const).map(([label,value,href]) => {
              const locked = !isVerified &&
                (href === DOCTOR_ROUTE.needs || href === DOCTOR_ROUTE.proposals);
              return <View key={label} style={[styles.metric, {
                backgroundColor: theme.backgroundElement, borderColor: theme.border,
              }]}>
                <ThemedText type="smallBold">{label}</ThemedText>
                <ThemedText type="title" themeColor="primary" accessibilityLiveRegion="polite">
                  {locked ? '—' : value === null ? '—' : String(value)}
                </ThemedText>
                {locked ? <ThemedText themeColor="textSecondary" type="small">Profil à vérifier</ThemedText> :
                  value === null ? <ThemedText type="small" themeColor="textSecondary">Indisponible</ThemedText> :
                  <Link href={href}><ThemedText type="smallBold" themeColor="primary">Consulter ›</ThemedText></Link>}
              </View>;
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Actions prioritaires" />
          <View style={styles.quickGrid}>
            {isVerified ? <>
              <QuickLink href={DOCTOR_ROUTE.needs} title="Besoins des patients" description="Voir les demandes pertinentes" />
              <QuickLink href={DOCTOR_ROUTE.proposals} title="Mes propositions" description="Suivre les réponses envoyées" />
            </> : null}
            <QuickLink href={DOCTOR_ROUTE.appointments} title="Mon agenda" description="Consulter mes rendez-vous" />
            <QuickLink href={DOCTOR_ROUTE.availability} title="Mes disponibilités" description="Plages et dates bloquées" />
            <QuickLink href={DOCTOR_ROUTE.profile} title="Mon profil" description="Informations et justificatifs" />
            <QuickLink href={DOCTOR_ROUTE.messages} title="Messages" description="Mes conversations autorisées" />
          </View>
        </View>

        {isVerified ? <View style={styles.section}>
          <SectionHeading title="Demandes récentes" href={DOCTOR_ROUTE.needs} />
          {data.needs.status === 'loading' ? <LoadingState label="Chargement des demandes…" /> :
            data.needs.status === 'error' ? <FailedSection label="les demandes" onRetry={() => load(true)}
              restricted={data.needs.reason === 'restricted'} /> :
            needs?.length ? needs.map(need =>
              <Card key={need.id}>
                <ThemedText type="smallBold">{need.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{need.summary}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {need.specialty} · {need.city}, {need.district}
                </ThemedText>
                <Link href={{ pathname: '/medecin/besoins/[id]', params: { id: need.id } }}>
                  <ThemedText type="smallBold" themeColor="primary">Consulter la demande ›</ThemedText>
                </Link>
              </Card>
            ) : <EmptyState title="Aucune demande pertinente"
              description="Aucune demande accessible actuellement. Actualisez pour vérifier les nouveautés." />}
        </View> : null}

        {isVerified ? <View style={styles.section}>
          <SectionHeading title="Propositions récentes" href={DOCTOR_ROUTE.proposals} />
          {data.proposals.status === 'loading' ? <LoadingState label="Chargement de mes propositions…" /> :
            data.proposals.status === 'error' ? <FailedSection label="vos propositions" onRetry={() => load(true)}
              restricted={data.proposals.reason === 'restricted'} /> :
            proposals?.length ? proposals.slice(0, 3).map(proposal =>
              <Card key={proposal.id}>
                <ThemedText type="smallBold">{proposal.needTitle}</ThemedText>
                <View style={styles.sectionHead}>
                  <Badge label={proposal.status === 'accepted' ? 'Acceptée'
                    : proposal.status === 'rejected' ? 'Refusée'
                    : proposal.status === 'cancelled' ? 'Annulée'
                    : proposal.status === 'expired' ? 'Expirée'
                    : 'En cours'} tone={proposal.status === 'accepted' ? 'success' :
                      proposal.status === 'rejected' || proposal.status === 'cancelled' ? 'danger' : 'info'} />
                  <ThemedText themeColor="textSecondary" type="small">
                    {proposal.city} · {proposal.district}
                  </ThemedText>
                </View>
                <ThemedText numberOfLines={2} themeColor="textSecondary" type="small">{proposal.message}</ThemedText>
              </Card>
            ) : <EmptyState title="Aucune proposition envoyée"
              description="Les propositions que vous aurez réellement envoyées apparaîtront ici." />}
        </View> : null}

        <View style={styles.section}>
          <SectionHeading title="Rendez-vous du jour" href={DOCTOR_ROUTE.appointments} />
          {data.appointments.status === 'loading' ? <LoadingState label="Chargement de l’agenda…" /> :
            data.appointments.status === 'error' ? <FailedSection label="votre agenda" onRetry={() => load(true)}
              restricted={data.appointments.reason === 'restricted'} /> :
            metrics.todayAppointments?.length ? metrics.todayAppointments.map(item =>
              <Card key={item.id}>
                <View style={styles.sectionHead}>
                  <ThemedText type="smallBold" style={{ flex: 1 }}>{item.time} · {item.patient}</ThemedText>
                  <Badge tone={item.status === 'confirmed' ? 'success' : 'warning'}
                    label={item.status === 'confirmed' ? 'Confirmé' : 'À confirmer'} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">{item.mode}
                  {item.district ? ' · ' + item.district : ''}</ThemedText>
              </Card>
            ) : <EmptyState title="Aucun rendez-vous à venir aujourd’hui"
              description="Vos consultations du jour apparaîtront ici." />}
        </View>

        <View style={styles.section}>
          <SectionHeading title="Mes disponibilités" href={DOCTOR_ROUTE.availability} />
          {data.weekly.status === 'loading' ? <LoadingState label="Chargement des plages horaires…" /> :
            data.weekly.status === 'error' ? <FailedSection label="vos plages horaires" onRetry={() => load(true)}
              restricted={data.weekly.reason === 'restricted'} /> :
            <Card>
              {week?.length ? week.slice(0, 4).map(item =>
                <View key={item.weekday} style={styles.sectionHead}>
                  <ThemedText type="smallBold">{item.weekday}</ThemedText>
                  <ThemedText themeColor="textSecondary">{item.hours}</ThemedText>
                </View>
              ) : <ThemedText themeColor="textSecondary">Aucune plage horaire activée.</ThemedText>}
              {data.blocked.status === 'success' ?
                <ThemedText type="small" themeColor="textSecondary">
                  Dates bloquées : {metrics.blockedDays}
                </ThemedText> : data.blocked.status === 'error' ?
                <ThemedText type="small" themeColor="textSecondary">Dates bloquées indisponibles.</ThemedText> : null}
            </Card>}
        </View>

        <View style={styles.section}>
          <SectionHeading title="Messages récents" href={DOCTOR_ROUTE.messages} />
          {data.conversations.status === 'loading' ? <LoadingState label="Chargement des conversations…" /> :
            data.conversations.status === 'error' ? <FailedSection label="vos conversations" onRetry={() => load(true)}
              restricted={data.conversations.reason === 'restricted'} /> :
            messages?.length ? messages.slice(0, 2).map(message =>
              <Card key={message.id}>
                <ThemedText type="smallBold">{message.peerName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{message.preview || 'Aucun message'}</ThemedText>
                {message.unreadCount > 0 ? <Badge tone="info"
                  label={message.unreadCount + ' non lu(s)'} /> : null}
              </Card>
            ) : <EmptyState title="Aucune conversation"
              description="Vos échanges autorisés apparaîtront ici." />}
        </View>

        <Card>
          <ThemedText type="subtitle" accessibilityRole="header">Informations professionnelles</ThemedText>
          <ThemedText>{profile.name} · {profile.specialty || 'Spécialité non renseignée'}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {profile.professionalAddress || 'Adresse professionnelle non renseignée'}
          </ThemedText>
          <QuickLink title="Mettre à jour mon profil" description="Compléter les données du médecin"
            href={DOCTOR_ROUTE.profile} />
        </Card>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%', maxWidth: 800,
    padding: Spacing.three, paddingBottom: 110, gap: Spacing.four },
  hero: { borderRadius: Radius.xlarge, padding: Spacing.three, gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  section: { gap: Spacing.three },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metric: { flexBasis: 138, flexGrow: 1, minHeight: 130, padding: Spacing.three,
    borderWidth: 1, borderRadius: Radius.xlarge, gap: Spacing.two },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quickLink: { flexGrow: 1, flexBasis: 150, borderRadius: Radius.large,
    borderWidth: 1, padding: Spacing.three, minHeight: MinimumTouchTarget + 34,
    gap: Spacing.two, justifyContent: 'center' },
});
