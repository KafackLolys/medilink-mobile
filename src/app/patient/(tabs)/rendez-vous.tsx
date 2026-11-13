import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Header, Badge, Button } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { appointmentsApi } from '@/services/appointments';
import type { AppointmentStatus, PatientAppointment } from '@/types/domain';
import { APPOINTMENT_LABELS, filterAppointments, formatAppointmentDate, getDeviceTimeZone } from '@/features/patient/appointment-booking';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';

type Status = AppointmentStatus|'all';
const statuses: Status[]=['all','pending_confirmation','confirmed','completed','cancelled','rejected','no_show'];
type State={status:'loading'|'error'}|{status:'success';appointments:PatientAppointment[]};
export default function PatientAppointments() {
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<State>({status:'loading'}),[tab,setTab]=useState<Status>('all');
  const [refreshing,setRefreshing]=useState(false);
  const seq=useRef(0),controller=useRef<AbortController|null>(null);
  const load=useCallback((pull=false)=>{
    controller.current?.abort();const ac=new AbortController();controller.current=ac;const version=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    void appointmentsApi.list(ac.signal).then(appointments=>{
      if(!ac.signal.aborted&&seq.current===version)setState({status:'success',appointments});
    }).catch(()=>{
      if(!ac.signal.aborted&&seq.current===version)setState({status:'error'});
    }).finally(()=>{if(!ac.signal.aborted&&seq.current===version)setRefreshing(false);});
  },[]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')load();
    return()=>{seq.current++;controller.current?.abort();};
  },[load,session.status,session.role]));
  if(session.status!=='authenticated'||session.role!=='patient')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification de votre accès…" /></SafeAreaView>;
  const all=state.status==='success'?state.appointments:[];
  const shown=filterAppointments(all,tab);
  let zone='Africa/Douala';
  try{zone=getDeviceTimeZone();}catch{}
  return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
    <FlatList data={shown} keyExtractor={item=>item.id} initialNumToRender={8} maxToRenderPerBatch={8}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}
      ListHeaderComponent={<View style={{gap:Spacing.three,marginBottom:Spacing.three}}>
        <Header title="Mes rendez-vous" subtitle="Suivez vos demandes de consultation et leurs confirmations."/>
        <Link href="/patient/medecins" asChild><Pressable accessibilityRole="link"
          style={[styles.link,{backgroundColor:theme.infoSurface}]}>
          <ThemedText type="smallBold" themeColor="primary">Trouver un médecin</ThemedText>
        </Pressable></Link>
        <ThemedText type="small" themeColor="textSecondary">Dates affichées selon votre fuseau : {zone}</ThemedText>
        <View style={styles.filters}>
          {statuses.map(item=><Pressable key={item} accessibilityRole="radio"
            accessibilityState={{selected:tab===item}} accessibilityLabel={item==='all'?'Tous':APPOINTMENT_LABELS[item]}
            onPress={()=>setTab(item)}
            style={[styles.chip,{borderColor:tab===item?theme.primary:theme.border,
              backgroundColor:tab===item?theme.infoSurface:theme.backgroundElement}]}>
            <ThemedText type="smallBold">{item==='all'?'Tous':APPOINTMENT_LABELS[item]}
              {state.status==='success'?` (${filterAppointments(all,item).length})`:''}</ThemedText>
          </Pressable>)}
        </View>
      </View>}
      renderItem={({item})=><Card>
        <Badge tone="info" label={APPOINTMENT_LABELS[item.status]}/>
        <ThemedText type="subtitle">{item.doctor.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{item.doctor.specialty}</ThemedText>
        <ThemedText>{formatAppointmentDate(item.scheduledAt,zone)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.consultationMode==='home'?'À domicile':'Téléconsultation'} · {item.durationMinutes} min
        </ThemedText>
        <Link href={{pathname:'/patient/rendez-vous/[id]',params:{id:item.id}}} asChild>
          <Pressable accessibilityRole="link" style={[styles.link,{backgroundColor:theme.infoSurface}]}>
            <ThemedText themeColor="primary" type="smallBold">Voir le détail</ThemedText>
          </Pressable>
        </Link>
      </Card>}
      ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
      ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des rendez-vous…" />:
        state.status==='error'?<ErrorState title="Rendez-vous indisponibles"
          description="Impossible d’accéder à votre agenda." onRetry={()=>load()}/>:
        <EmptyState title="Aucun rendez-vous" description="Vos rendez-vous dans cette catégorie apparaîtront ici."/>}
    />
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:100},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  chip:{minHeight:MinimumTouchTarget,padding:Spacing.two,borderWidth:1,borderRadius:Radius.pill,justifyContent:'center'},
  link:{minHeight:MinimumTouchTarget,alignItems:'center',justifyContent:'center',borderRadius:Radius.large},
});
