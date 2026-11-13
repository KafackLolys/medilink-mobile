import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Header, Badge } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { appointmentsApi } from '@/services/appointments';
import { APPOINTMENT_LABELS, formatAppointmentDate, getDeviceTimeZone, canPatientChangeAppointmentStatus, APPOINTMENT_LIST_ROUTE } from '@/features/patient/appointment-booking';
import { Spacing } from '@/constants/theme';
import type { PatientAppointment } from '@/types/domain';

type DetailState={status:'loading'|'error'|'not-found'}|{status:'success';appointment:PatientAppointment};
export default function PatientAppointmentDetail(){
  const {id}=useLocalSearchParams<{id?:string}>(),appointmentId=typeof id==='string'&&id.trim()?id:null;
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<DetailState>({status:'loading'}),[refreshing,setRefreshing]=useState(false);
  const seq=useRef(0),request=useRef<AbortController|null>(null);
  const load=useCallback((pull=false)=>{
    request.current?.abort();const ac=new AbortController();request.current=ac;const version=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    if(!appointmentId){setState({status:'not-found'});setRefreshing(false);return;}
    void appointmentsApi.detail(appointmentId,ac.signal).then(appointment=>{
      if(!ac.signal.aborted&&version===seq.current)setState({status:'success',appointment});
    }).catch(e=>{
      if(!ac.signal.aborted&&version===seq.current)
        setState({status:(e as {status?:number})?.status===404?'not-found':'error'});
    }).finally(()=>{if(!ac.signal.aborted&&version===seq.current)setRefreshing(false);});
  },[appointmentId]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')load();
    return()=>{seq.current++;request.current?.abort();};
  },[load,session.status,session.role]));
  if(session.status!=='authenticated'||session.role!=='patient')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification de votre accès…" /></SafeAreaView>;
  let zone='Africa/Douala';try{zone=getDeviceTimeZone();}catch{}
  const appt=state.status==='success'?state.appointment:null;
  return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
    <ScrollView contentContainerStyle={{width:'100%',maxWidth:800,alignSelf:'center',
      padding:Spacing.three,paddingBottom:100,gap:Spacing.three}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}>
      <Link href={APPOINTMENT_LIST_ROUTE}><ThemedText type="linkPrimary">‹ Mes rendez-vous</ThemedText></Link>
      <Header title="Détail du rendez-vous" subtitle="Informations retournées par Medilink."/>
      {state.status==='loading'?<LoadingState label="Chargement du rendez-vous…" />:
        state.status==='not-found'?<ErrorState title="Rendez-vous introuvable"
          description="Ce rendez-vous n'existe pas ou ne vous est pas accessible."/>:
        state.status==='error'?<ErrorState title="Rendez-vous indisponible" onRetry={()=>load()}/>:
        appt?<><Card>
          <Badge tone="info" label={APPOINTMENT_LABELS[appt.status]}/>
          <ThemedText type="subtitle">{appt.doctor.name}</ThemedText>
          <ThemedText themeColor="textSecondary">{appt.doctor.specialty}</ThemedText>
          <ThemedText type="smallBold">Date et heure</ThemedText>
          <ThemedText>{formatAppointmentDate(appt.scheduledAt,zone)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Fuseau : {zone} · Durée : {appt.durationMinutes} min</ThemedText>
          <ThemedText type="smallBold">Type de consultation</ThemedText>
          <ThemedText>{appt.consultationMode==='home'?'À domicile':'Téléconsultation'}</ThemedText>
          <ThemedText type="smallBold">Tarif proposé</ThemedText>
          <ThemedText>{new Intl.NumberFormat('fr-FR').format(appt.fee)} {appt.currency}</ThemedText>
          {appt.reason?<><ThemedText type="smallBold">Motif communiqué</ThemedText>
            <ThemedText>{appt.reason}</ThemedText></>:null}
        </Card>
        <Card>
          <ThemedText type="subtitle">Suivi du rendez-vous</ThemedText>
          <ThemedText themeColor="textSecondary">
            Le médecin confirme ou met à jour le statut du rendez-vous. Actualisez cet écran pour consulter sa réponse.
          </ThemedText>
          {!canPatientChangeAppointmentStatus(appt.status)?<ThemedText type="small" themeColor="textSecondary">
            L’annulation et les changements de statut ne sont pas autorisés au patient par l’API actuelle.
          </ThemedText>:null}
          {appt.status==='completed'?<Link href="/patient/profil">
            <ThemedText type="linkPrimary">Retrouver mes consultations et évaluations</ThemedText>
          </Link>:null}
          <Link href="/patient/messages"><ThemedText type="linkPrimary">Accéder à mes messages</ThemedText></Link>
        </Card></>:null}
    </ScrollView>
  </SafeAreaView>;
}
