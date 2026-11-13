import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, Header } from '@/components/ui/primitives';
import { SelectField } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { appointmentsApi } from '@/services/appointments';
import { formatAppointmentDate, getDeviceTimeZone, appointmentDetailRoute } from '@/features/patient/appointment-booking';
import { patientCompletedHistory, type HistoryPeriod } from '@/features/reviews/reviews-model';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import type { PatientAppointment } from '@/types/domain';

type State={status:'loading'|'error'}|{status:'success';items:PatientAppointment[]};
export default function PatientConsultationHistory(){
 const theme=useTheme(),session=useNavigationSession(s=>s.session);
 const allowed=session.status==='authenticated'&&session.role==='patient';
 const [state,setState]=useState<State>({status:'loading'});
 const [period,setPeriod]=useState<HistoryPeriod>('all'),[refreshing,setRefreshing]=useState(false);
 const ac=useRef<AbortController|null>(null),seq=useRef(0);
 const load=useCallback((pull=false)=>{
  ac.current?.abort();const controller=new AbortController();ac.current=controller;const generation=++seq.current;
  if(pull)setRefreshing(true);else setState({status:'loading'});
  void appointmentsApi.list(controller.signal).then(items=>{
   if(!controller.signal.aborted&&generation===seq.current)setState({status:'success',items});
  }).catch(()=>{
   if(!controller.signal.aborted&&generation===seq.current)setState({status:'error'});
  }).finally(()=>{if(!controller.signal.aborted&&generation===seq.current)setRefreshing(false);});
 },[]);
 useFocusEffect(useCallback(()=>{
  if(allowed)load();
  return()=>{seq.current++;ac.current?.abort();setState({status:'loading'});setRefreshing(false);setPeriod('all');};
 },[allowed,load]));
 if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
  <ErrorState title="Historique inaccessible" description="Accès réservé au patient authentifié."/>
 </SafeAreaView>;
 const history=state.status==='success'?patientCompletedHistory(state.items,period):[];
 let timeZone='Africa/Douala';try{timeZone=getDeviceTimeZone();}catch{}
 return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <FlatList data={history} keyExtractor={item=>item.id} initialNumToRender={8}
   contentContainerStyle={styles.content} ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
     tintColor={theme.primary} colors={[theme.primary]}/>}
   ListHeaderComponent={<View style={styles.header}>
    <Link href="/patient/rendez-vous"><ThemedText type="linkPrimary">‹ Tous mes rendez-vous</ThemedText></Link>
    <Header title="Historique de mes consultations" subtitle="Consultations réellement terminées et évaluations associées."/>
    <SelectField label="Période" value={period} onChange={v=>setPeriod(v as HistoryPeriod)}
     options={[{label:'Toutes les dates',value:'all'},{label:'Ce mois-ci',value:'month'},{label:'Cette année',value:'year'}]}/>
    {state.status==='success'?<ThemedText type="small" themeColor="textSecondary">
     {history.length} consultation(s) terminée(s) sur cette période.
    </ThemedText>:null}
   </View>}
   renderItem={({item})=><Card>
    <Badge label="Terminée" tone="success"/>
    <ThemedText type="subtitle">{item.doctor.name}</ThemedText>
    <ThemedText themeColor="textSecondary">{item.doctor.specialty}</ThemedText>
    <ThemedText>{formatAppointmentDate(item.scheduledAt,timeZone)}</ThemedText>
    <ThemedText themeColor="textSecondary" type="small">
     {item.consultationMode==='home'?'À domicile':'Téléconsultation'}
    </ThemedText>
    <Link href={appointmentDetailRoute(item.id)} asChild>
     <Pressable accessibilityRole="link" style={[styles.link,{backgroundColor:theme.infoSurface}]}>
      <ThemedText type="smallBold" themeColor="primary">Voir la consultation et mon avis ›</ThemedText>
     </Pressable>
    </Link>
   </Card>}
   ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des consultations…"/>:
    state.status==='error'?<ErrorState title="Historique indisponible" onRetry={()=>load()}/>:
    <EmptyState title="Aucune consultation terminée" description="Vos consultations terminées apparaîtront ici."/>}
  />
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:120},
 header:{gap:Spacing.three,marginBottom:Spacing.three},
 link:{minHeight:MinimumTouchTarget,alignItems:'center',justifyContent:'center',borderRadius:Radius.large},
});
