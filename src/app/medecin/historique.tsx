import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, Header } from '@/components/ui/primitives';
import { SelectField } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { appointmentsApi } from '@/services/appointments';
import { doctorsApi } from '@/services/doctors';
import { Spacing } from '@/constants/theme';
import { doctorCompletedHistory,reviewError,type HistoryPeriod } from '@/features/reviews/reviews-model';
import { parseDoctorAppointments } from '@/features/doctor/doctor-agenda';
import { parseDoctorOwnProfile } from '@/features/doctor/doctor-professional-profile';
import type { DoctorAppointment } from '@/types/domain';

type State={status:'loading'|'error';message?:string}|{
 status:'success';items:DoctorAppointment[];rating:number|null;reviewsCount:number;
};
export default function DoctorHistoryScreen(){
 const theme=useTheme(),session=useNavigationSession(s=>s.session);
 const allowed=session.status==='authenticated'&&session.role==='doctor';
 const [state,setState]=useState<State>({status:'loading'});
 const [period,setPeriod]=useState<HistoryPeriod>('all'),[refreshing,setRefreshing]=useState(false);
 const request=useRef<AbortController|null>(null),sequence=useRef(0);
 const load=useCallback((pull=false)=>{
  request.current?.abort();const ac=new AbortController();request.current=ac;const epoch=++sequence.current;
  if(pull)setRefreshing(true);else setState({status:'loading'});
  void Promise.all([appointmentsApi.doctor(ac.signal),doctorsApi.me(ac.signal)]).then(([raw,profile])=>{
   const items=parseDoctorAppointments(raw),user=parseDoctorOwnProfile(profile);
   if(ac.signal.aborted||sequence.current!==epoch)return;
   setState({status:'success',items,rating:user.rating,reviewsCount:user.reviewsCount});
  }).catch(e=>{
   if(!ac.signal.aborted&&sequence.current===epoch)setState({status:'error',message:reviewError(e)});
  }).finally(()=>{if(!ac.signal.aborted&&sequence.current===epoch)setRefreshing(false);});
 },[]);
 useFocusEffect(useCallback(()=>{
  if(allowed)load();
  return()=>{sequence.current++;request.current?.abort();setState({status:'loading'});setRefreshing(false);setPeriod('all');};
 },[allowed,load]));
 if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
  <ErrorState title="Historique inaccessible" description="Accès réservé au médecin authentifié."/>
 </SafeAreaView>;
 const history=state.status==='success'?doctorCompletedHistory(state.items,period):[];
 return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <FlatList data={history} keyExtractor={item=>item.id}
   initialNumToRender={10} maxToRenderPerBatch={10}
   contentContainerStyle={styles.content} ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
    colors={[theme.primary]} tintColor={theme.primary}/>}
   ListHeaderComponent={<View style={styles.header}>
    <Header title="Historique des consultations" subtitle="Uniquement les rendez-vous terminés pour votre compte médecin."/>
    <SelectField label="Période" value={period} onChange={value=>setPeriod(value as HistoryPeriod)}
     options={[{value:'all',label:'Toutes les dates'},{value:'month',label:'Ce mois-ci'},{value:'year',label:'Cette année'}]}/>
    {state.status==='success'?<Card>
      <ThemedText type="subtitle">{history.length} consultations terminées sur la période</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
       Note professionnelle renvoyée par l’API : {state.rating===null?'Aucune note':state.rating.toFixed(1).replace('.',',')+'/5'}
       {' · '}{state.reviewsCount} avis.
      </ThemedText>
      <Link href="/medecin/avis"><ThemedText type="linkPrimary">Consulter mes avis ›</ThemedText></Link>
      <ThemedText themeColor="textSecondary" type="small">
       Les consultations terminées sont filtrées à partir de GET /appointments/doctor.
       Aucune statistique d’interventions non documentée n’est affichée.
      </ThemedText>
     </Card>:null}
   </View>}
   renderItem={({item})=><Card>
    <Badge label="Terminée" tone="success"/>
    <ThemedText type="subtitle">{item.patient}</ThemedText>
    <ThemedText>{item.date} · {item.time}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">
     {item.mode}{item.district?' · '+item.district:''}
    </ThemedText>
   </Card>}
   ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement de l’historique…"/>:
    state.status==='error'?<ErrorState title="Historique indisponible" description={state.message} onRetry={()=>load()}/>:
    <EmptyState title="Aucune consultation terminée" description="Aucune consultation terminée sur cette période."/>}
  />
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:110},
 header:{gap:Spacing.three,marginBottom:Spacing.three},
});
