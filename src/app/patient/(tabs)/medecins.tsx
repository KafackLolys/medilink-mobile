import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MinimumTouchTarget, Radius, Spacing } from '@/constants/theme';
import { doctorsApi } from '@/services/doctors';
import { doctorLocation, doctorModes, doctorRating, mapDoctorDirectory, normalizeDoctorFilters, type DoctorFilters } from '@/features/patient/doctor-directory';
import type { DoctorDirectoryItem } from '@/types/domain';
import { useNavigationSession } from '@/store/navigation-session';
import { useNetworkState } from 'expo-network';
import { normalizeConnectivity } from '@/features/network/network-policy.ts';
import { getStalePublicDoctorDirectory, putPublicDoctorDirectory } from '@/features/network/public-directory-cache';

type DirectoryState =
  | { status: 'loading'; doctors: DoctorDirectoryItem[] }
  | { status: 'error'; doctors: DoctorDirectoryItem[] }
  | { status: 'success'; doctors: DoctorDirectoryItem[]; stale: boolean };

function DoctorCard({ doctor }: { doctor: DoctorDirectoryItem }) {
  const theme = useTheme();
  const detail = { pathname: '/patient/medecins/[id]' as const, params: { id: doctor.id } };
  return (
    <Card style={styles.doctorCard}>
      <View style={styles.identity}>
        <Avatar name={doctor.name.replace(/^Dr\.?\s*/i, '')} size={60} />
        <View style={styles.identityContent}>
          <ThemedText type="smallBold" style={styles.doctorName}>{doctor.name}</ThemedText>
          <ThemedText themeColor="textSecondary">{doctor.specialty}</ThemedText>
          <Badge label="Médecin vérifié" tone="success" />
        </View>
      </View>
      <ThemedText type="small">{doctorRating(doctor)} · {doctor.yearsOfExperience} ans d’expérience</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">{doctorLocation(doctor)}</ThemedText>
      <View style={styles.badges}>
        {doctorModes(doctor).map(mode => <Badge key={mode} label={mode} tone="neutral" />)}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Les créneaux disponibles sont confirmés lors de la réservation.
      </ThemedText>
      <Link href={detail} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={`Voir le profil de ${doctor.name}`}
          style={({ pressed }) => [styles.detailButton, { backgroundColor: theme.infoSurface, opacity: pressed ? .7 : 1 }]}>
          <ThemedText type="smallBold" themeColor="primary">Voir le profil  ›</ThemedText>
        </Pressable>
      </Link>
    </Card>
  );
}

export default function DoctorDirectoryScreen() {
  const theme = useTheme();
  const session = useNavigationSession(s => s.session);
  const connectivity = normalizeConnectivity(useNetworkState());
  const previousConnectivity = useRef(connectivity);
  const networkQualityRef = useRef(connectivity);
  networkQualityRef.current = connectivity;
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [applied, setApplied] = useState<DoctorFilters>({});
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [state, setState] = useState<DirectoryState>({ status: 'loading', doctors: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback((filters: DoctorFilters, pull = false) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const id = ++sequence.current;
    if(networkQualityRef.current==='offline'){
      const cached=getStalePublicDoctorDirectory(filters,{kind:'network'},'patient');
      if(cached){
        setSpecialties(cached.specialties);
        setState({status:'success',doctors:cached.doctors,stale:true});
      }else setState({status:'error',doctors:[]});
      setRefreshing(false);
      return;
    }
    if (pull) setRefreshing(true);
    else setState({ status: 'loading', doctors: [] });
    void doctorsApi.list(filters, request.signal).then(payload => {
      const mapped = mapDoctorDirectory(payload);
      if (request.signal.aborted || sequence.current !== id) return;
      putPublicDoctorDirectory(filters,mapped);
      setSpecialties(mapped.specialties);
      setState({ status: 'success', doctors: mapped.doctors, stale: false });
    }).catch(error => {
      if (request.signal.aborted || sequence.current !== id) return;
      const cached = getStalePublicDoctorDirectory(filters,error,'patient');
      if (cached) {
        setSpecialties(cached.specialties);
        setState({ status: 'success', doctors: cached.doctors, stale: true });
      } else setState({ status: 'error', doctors: [] });
    }).finally(() => {
      if (!request.signal.aborted && sequence.current === id) setRefreshing(false);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    if (session.status === 'authenticated' && session.role === 'patient') load(applied);
    return () => { sequence.current++; controller.current?.abort(); };
  }, [session.status, session.role, applied, load]));
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(()=>{
    const wasOffline=previousConnectivity.current==='offline';
    previousConnectivity.current=connectivity;
    // Only refresh a safe read on recovery; no appointment or medical mutation.
    if(wasOffline && connectivity==='online' &&
      session.status==='authenticated' && session.role==='patient')load(applied,true);
  },[connectivity,session.status,session.role,applied,load]);

  const search = () => {
    try {
      const next = normalizeDoctorFilters({ q: query, city, specialty });
      setValidationError('');
      if (JSON.stringify(next) === JSON.stringify(applied)) load(next);
      else setApplied(next);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Filtres invalides.');
    }
  };

  const reset = () => {
    setQuery('');
    setCity('');
    setSpecialty('');
    setValidationError('');
    if (Object.keys(applied).length === 0) load({});
    else setApplied({});
  };

  if (session.status !== 'authenticated' || session.role !== 'patient') {
    return <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <LoadingState label="Vérification de votre accès…" />
    </SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={state.doctors}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DoctorCard doctor={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(applied, true)}
          colors={[theme.primary]} tintColor={theme.primary} />}
        ListHeaderComponent={<View style={styles.header}>
          <Header title="Trouver un médecin"
            subtitle="Profils vérifiés et secteur d’intervention des professionnels." />
          <Card>
            <ThemedText type="smallBold">Recherche géographique sans GPS</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Indiquez une ville ou un quartier pour filtrer les profils. L’API ne fournit
              actuellement aucune coordonnée vérifiée : la liste reste disponible sans permission
              de localisation, sans estimation de distance ni marqueurs placés arbitrairement.
            </ThemedText>
          </Card>
          <Card>
            <Input label="Rechercher" value={query} onChangeText={setQuery} editable={!refreshing}
              placeholder="Nom ou spécialité" returnKeyType="search" onSubmitEditing={search}
              hint="La recherche peut également retrouver une localisation." />
            <Input label="Ville ou secteur" value={city} onChangeText={setCity} editable={!refreshing}
              placeholder="Ex. Yaoundé, Bastos" returnKeyType="search" onSubmitEditing={search} />
            <ThemedText type="smallBold">Spécialité</ThemedText>
            {specialties.length === 0 ? <ThemedText type="small" themeColor="textSecondary">
              Les spécialités seront proposées après chargement.
            </ThemedText> : null}
            <View style={styles.specialties}>
              {[{ label: 'Toutes les spécialités', value: '' }, ...specialties.map(value => ({ label: value, value }))].map(option => (
                <Pressable key={option.value} accessibilityRole="radio"
                  accessibilityLabel={option.label} accessibilityState={{ selected: specialty === option.value }}
                  onPress={() => setSpecialty(option.value)}
                  style={[styles.chip, { backgroundColor: specialty === option.value ? theme.infoSurface : theme.backgroundElement,
                    borderColor: specialty === option.value ? theme.primary : theme.border }]}>
                  <ThemedText type="smallBold" style={{ color: specialty === option.value ? theme.primary : theme.text }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {validationError ? <ThemedText themeColor="danger" accessibilityRole="alert">{validationError}</ThemedText> : null}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}><Button label="Rechercher" onPress={search} /></View>
              <View style={{ flex: 1 }}><Button label="Effacer" variant="outline" onPress={reset} /></View>
            </View>
          </Card>
          {state.status === 'success' && state.stale ? <Card>
            <ThemedText themeColor="warning" type="smallBold">Annuaire enregistré temporairement — données potentiellement anciennes.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Disponibilités, tarifs et statuts doivent être confirmés en ligne avant une réservation.</ThemedText>
            <Button label="Actualiser les médecins" variant="outline" onPress={() => load(applied,true)}/>
          </Card>:null}
          {state.status === 'success' ? <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
            {state.doctors.length} {state.doctors.length === 1 ? 'médecin trouvé' : 'médecins trouvés'}
          </ThemedText> : null}
        </View>}
        ListEmptyComponent={state.status === 'loading'
          ? <LoadingState label="Chargement des médecins vérifiés…" />
          : state.status === 'error'
            ? <ErrorState title="Annuaire indisponible"
                description="Impossible de charger les profils pour le moment."
                onRetry={() => load(applied)} />
            : <EmptyState title="Aucun médecin trouvé"
                description="Aucun profil vérifié ne correspond à ces critères."
                actionLabel="Effacer les filtres" onAction={reset} />}
        ListFooterComponent={state.status === 'success' ? <View style={styles.footer}>
          <Card style={{ backgroundColor: theme.infoSurface }}>
            <ThemedText type="subtitle">Vous ne savez pas qui choisir ?</ThemedText>
            <ThemedText themeColor="textSecondary">Décrivez votre situation pour recevoir des propositions de médecins.</ThemedText>
            <Link href="/patient/besoins/nouveau" asChild>
              <Pressable accessibilityRole="link" style={[styles.detailButton, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText themeColor="primary" type="smallBold">Publier un besoin  ›</ThemedText>
              </Pressable>
            </Link>
          </Card>
        </View> : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: Spacing.three, paddingBottom: 110 },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  doctorCard: { gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  identityContent: { flex: 1, alignItems: 'flex-start', gap: Spacing.two },
  doctorName: { fontSize: 18, lineHeight: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: MinimumTouchTarget, paddingHorizontal: Spacing.three, justifyContent: 'center',
    borderRadius: Radius.pill, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  detailButton: { minHeight: MinimumTouchTarget, padding: Spacing.three, borderRadius: Radius.large,
    alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: Spacing.four },
});
