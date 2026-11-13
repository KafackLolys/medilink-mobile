import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, Header } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, Radius } from '@/constants/theme';
import { doctorsApi } from '@/services/doctors';
import { appointmentsApi } from '@/services/appointments';
import { completedDoctorAppointments, doctorPublicSummary, mapPublicDoctor } from '@/features/patient/doctor-profile';
import { useNavigationSession } from '@/store/navigation-session';
import type { DoctorDirectoryItem, PatientAppointment } from '@/types/domain';

type DoctorState = { status: 'loading' } | { status: 'not-found' } | { status: 'error' }
  | { status: 'success'; doctor: DoctorDirectoryItem };
type ReviewState = { status: 'loading' } | { status: 'error' }
  | { status: 'success'; appointments: PatientAppointment[] };

export default function PublicDoctorProfile() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const session = useNavigationSession(state => state.session);
  const [doctorState, setDoctorState] = useState<DoctorState>({ status: 'loading' });
  const [reviewState, setReviewState] = useState<ReviewState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const currentRequest = useRef<AbortController | null>(null);
  const doctorId = typeof id === 'string' && id.trim() ? id : null;

  const reload = useCallback((refresh = false) => {
    currentRequest.current?.abort();
    const request = new AbortController();
    currentRequest.current = request;
    const seq = ++generation.current;
    if (refresh) setRefreshing(true);
    else {
      setDoctorState({ status: 'loading' });
      setReviewState({ status: 'loading' });
    }

    if (!doctorId) {
      setDoctorState({ status: 'not-found' });
      setReviewState({ status: 'success', appointments: [] });
      setRefreshing(false);
      return;
    }
    const commit = (operation: () => void) => {
      if (!request.signal.aborted && generation.current === seq) operation();
    };

    void Promise.all([
      doctorsApi.detail(doctorId, request.signal).then(payload => {
        const doctor = mapPublicDoctor(payload);
        commit(() => setDoctorState({ status: 'success', doctor }));
      }).catch((error: unknown) => {
        if (request.signal.aborted) return;
        const status = (error as { status?: number })?.status;
        commit(() => setDoctorState({ status: status === 404 ? 'not-found' : 'error' }));
      }),
      appointmentsApi.list(request.signal).then(items => {
        commit(() => setReviewState({
          status: 'success',
          appointments: completedDoctorAppointments(items, doctorId),
        }));
      }).catch(() => {
        commit(() => setReviewState({ status: 'error' }));
      }),
    ]).finally(() => commit(() => setRefreshing(false)));
  }, [doctorId]);

  useFocusEffect(useCallback(() => {
    if (session.status === 'authenticated' && session.role === 'patient') reload();
    return () => {
      generation.current++;
      currentRequest.current?.abort();
    };
  }, [reload, session.status, session.role]));
  useEffect(() => () => currentRequest.current?.abort(), []);

  if (session.status !== 'authenticated' || session.role !== 'patient') {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <LoadingState label="Vérification de votre accès…" />
    </SafeAreaView>;
  }

  const doctor = doctorState.status === 'success' ? doctorState.doctor : null;
  const summary = doctor ? doctorPublicSummary(doctor) : null;
  const detailsHref = { pathname: '/patient/medecins/[id]/rendez-vous' as const, params: { id: doctorId ?? '' } };

  return <SafeAreaView edges={['top','left','right']} style={[styles.root, { backgroundColor: theme.background }]}>
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)}
        colors={[theme.primary]} tintColor={theme.primary} />}
      contentContainerStyle={styles.content}>
      <Link href="/patient/medecins">
        <ThemedText type="linkPrimary">‹ Retour à la recherche</ThemedText>
      </Link>
      {doctorState.status === 'loading' ? <LoadingState label="Chargement du profil du médecin…" /> :
        doctorState.status === 'not-found' ? <ErrorState
          title="Ce médecin est introuvable"
          description="Ce profil n’est pas disponible dans l’annuaire vérifié." /> :
        doctorState.status === 'error' ? <ErrorState
          title="Profil indisponible" description="Le chargement du profil a échoué."
          onRetry={() => reload()} /> : doctor && summary ? <>
          <Card>
            <View style={[styles.identity, { backgroundColor: theme.infoSurface }]}>
              <Avatar name={doctor.name.replace(/^Dr\.?\s*/i, '')} size={82} />
              <View style={styles.identityContent}>
                <Badge label="Médecin vérifié" tone="success" />
                <ThemedText type="subtitle" accessibilityRole="header">{doctor.name}</ThemedText>
                <ThemedText themeColor="textSecondary">{doctor.specialty}</ThemedText>
              </View>
            </View>
          </Card>
          <Card>
            <Header title="Informations professionnelles" />
            <View style={styles.statRow}>
              <View style={[styles.stat, { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold">Avis des patients</ThemedText>
                <ThemedText>{summary.rating}</ThemedText>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold">Expérience</ThemedText>
                <ThemedText>{doctor.yearsOfExperience} ans de pratique</ThemedText>
              </View>
            </View>
            <ThemedText type="smallBold">Secteur professionnel</ThemedText>
            <ThemedText themeColor="textSecondary">{summary.location}</ThemedText>
            <ThemedText type="smallBold">Tarif indicatif</ThemedText>
            <ThemedText>{summary.price}</ThemedText>
          </Card>
          {doctor.bio.trim() ? <Card>
            <ThemedText type="subtitle" accessibilityRole="header">À propos</ThemedText>
            <ThemedText themeColor="textSecondary">{doctor.bio}</ThemedText>
          </Card> : null}
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Types de consultation</ThemedText>
            {summary.modes.length ? <View style={styles.badges}>
              {summary.modes.map(mode => <Badge key={mode} label={mode} tone="info" />)}
            </View> : <ThemedText themeColor="textSecondary">Aucun mode de consultation renseigné.</ThemedText>}
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Disponibilités hebdomadaires</ThemedText>
            {summary.weekly.length ? summary.weekly.map((window, index) =>
              <ThemedText themeColor="textSecondary" key={index}>{window}</ThemedText>
            ) : <ThemedText themeColor="textSecondary">Aucune plage horaire renseignée.</ThemedText>}
            <ThemedText type="small" themeColor="textSecondary">
              Les dates bloquées, les autres rendez-vous et les créneaux exacts doivent être vérifiés au moment de la réservation.
            </ThemedText>
            {doctor.blockedDates?.length ? <ThemedText type="small" themeColor="textSecondary">
              Dates exceptionnellement bloquées : {[...doctor.blockedDates].sort().join(', ')}.
            </ThemedText> : null}
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Rendez-vous</ThemedText>
            {summary.canOpenBooking ? <>
              <ThemedText themeColor="textSecondary" type="small">
                Les horaires affichés sont indicatifs : aucune disponibilité de réservation n’est garantie avant confirmation serveur.
              </ThemedText>
              <Link href={detailsHref} style={[styles.cta, { backgroundColor: theme.primary }]}>
                <ThemedText style={{ color: theme.onPrimary, textAlign: 'center', fontWeight: '700' }}>
                  Consulter les rendez-vous
                </ThemedText>
              </Link>
            </> : <ThemedText themeColor="textSecondary">
              Le médecin doit renseigner un mode et des plages horaires avant de proposer des rendez-vous.
            </ThemedText>}
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Évaluer ce médecin</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Un avis n’est autorisé qu’après une consultation terminée avec ce professionnel.
              Le serveur vérifie les droits liés à chaque rendez-vous.
            </ThemedText>
            {reviewState.status === 'loading' ? <LoadingState label="Vérification de vos consultations…" /> :
              reviewState.status === 'error' ? <View style={{ gap: Spacing.two }}>
                <ThemedText themeColor="danger" accessibilityRole="alert">
                  Impossible de vérifier vos consultations.
                </ThemedText>
                <Link href={{ pathname: '/patient/rendez-vous' }}>
                  <ThemedText type="linkPrimary">Voir mes rendez-vous</ThemedText>
                </Link>
              </View> : reviewState.appointments.length === 0 ?
                <ThemedText themeColor="textSecondary">
                  Vous pourrez donner une note après votre première consultation terminée avec ce médecin.
                </ThemedText> : <>
                  <ThemedText themeColor="textSecondary">
                    {reviewState.appointments.length} consultation(s) terminée(s) avec ce médecin.
                  </ThemedText>
                  {reviewState.appointments.map(appointment => (
                    <Link key={appointment.id} href={{
                      pathname: '/patient/rendez-vous/[id]',
                      params: { id: appointment.id },
                    }}>
                      <ThemedText type="linkPrimary">
                        Consulter le rendez-vous du {new Date(appointment.scheduledAt).toLocaleDateString('fr-FR')}
                      </ThemedText>
                    </Link>
                  ))}
                </>}
          </Card>
        </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: Spacing.three,
    paddingBottom: Spacing.six + 60, gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    padding: Spacing.three, borderRadius: Radius.large, gap: Spacing.three },
  identityContent: { flex: 1, minWidth: 180, gap: Spacing.two, alignItems: 'flex-start' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: { flexBasis: 140, flexGrow: 1, padding: Spacing.three, borderRadius: Radius.large, gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cta: { minHeight: 48, borderRadius: Radius.large, padding: Spacing.three,
    alignItems: 'center', justifyContent: 'center' },
});
