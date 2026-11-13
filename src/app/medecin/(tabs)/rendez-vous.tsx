import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Badge, Card, Header } from '@/components/ui/primitives';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui/states';
import { SelectField } from '@/components/ui/form-fields';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { appointmentsApi } from '@/services/appointments';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import type { AppointmentStatus, DoctorAppointment } from '@/types/domain';
import {
  APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES, parseDoctorAppointments,
  backendPermittedStatuses, doctorAgendaError,
} from '@/features/doctor/doctor-agenda';

type State={status:'loading'|'error'}|{status:'success';items:DoctorAppointment[]};
export default function DoctorAppointmentsScreen(){
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<State>({status:'loading'});
  const [filter,setFilter]=useState<AppointmentStatus|'all'>('all');
  const [target,setTarget]=useState<DoctorAppointment|null>(null);
  const [desired,setDesired]=useState<AppointmentStatus>('confirmed');
  const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<AbortController|null>(null),seq=useRef(0),lock=useRef(false);
  const load=useCallback((pull=false)=>{
    request.current?.abort();const ac=new AbortController();request.current=ac;const token=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    void appointmentsApi.doctor(ac.signal).then(raw=>{
      const items=parseDoctorAppointments(raw);
      if(!ac.signal.aborted&&seq.current===token)setState({status:'success',items});
    }).catch(()=>{
      if(!ac.signal.aborted&&seq.current===token)setState({status:'error'});
    }).finally(()=>{
      if(!ac.signal.aborted&&seq.current===token)setRefreshing(false);
    });
  },[]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='doctor')load();
    return()=>{seq.current++;request.current?.abort();setState({status:'loading'});setTarget(null);
      setError('');setNotice('');};
  },[load,session.status,session.role]));
  function openStatus(item:DoctorAppointment){
    setTarget(item);setDesired(item.status==='pending_confirmation'?'confirmed':item.status);
    setError('');setNotice('');
  }
  async function saveStatus(){
    if(!target||desired===target.status||lock.current||session.status!=='authenticated'||session.role!=='doctor')return;
    if(!backendPermittedStatuses().includes(desired))return;
    const appointmentId=target.id,chosen=desired;
    lock.current=true;setBusy(true);setError('');
    try{
      const response=await appointmentsApi.updateStatus(appointmentId,chosen);
      if(response.id!==appointmentId||response.status!==chosen)
        throw new Error('Réponse de statut non confirmée.');
      setNotice('Statut enregistré et synchronisé.');
      setTarget(null);load(true);
    }catch(e){
      setError(doctorAgendaError(e));setTarget(null);load(true);
    }finally{lock.current=false;setBusy(false);}
  }
  if(session.status!=='authenticated'||session.role!=='doctor')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification des droits médecin…" /></SafeAreaView>;
  const items=state.status==='success'?state.items:[];
  const visible=filter==='all'?items:items.filter(x=>x.status===filter);
  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
    <FlatList data={visible} keyExtractor={x=>x.id} contentContainerStyle={styles.content}
      initialNumToRender={8} maxToRenderPerBatch={8}
      ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
        tintColor={theme.primary} colors={[theme.primary]}/>}
      ListHeaderComponent={<View style={styles.header}>
        <Header title="Mes rendez-vous" subtitle="Consultez vos rendez-vous et leurs statuts réels."/>
        <Link href="/medecin/disponibilites" asChild>
          <Pressable accessibilityRole="link" style={[styles.link,{backgroundColor:theme.infoSurface}]}>
            <ThemedText type="smallBold" themeColor="primary">Gérer mes disponibilités ›</ThemedText>
          </Pressable>
        </Link>
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            L'API renvoie les dates et heures en format YYYY-MM-DD / HH:mm, sans fuseau associé.
            Elles sont affichées telles que fournies par le serveur, sans conversion arbitraire.
          </ThemedText>
        </Card>
        {notice?<ThemedText themeColor="success" accessibilityRole="alert">{notice}</ThemedText>:null}
        {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
        <View style={styles.filters}>
          {(['all',...APPOINTMENT_STATUSES] as const).map(status=>
            <Pressable key={status} accessibilityRole="radio"
              accessibilityState={{selected:filter===status}}
              accessibilityLabel={status==='all'?'Tous':APPOINTMENT_STATUS_LABELS[status]}
              style={[styles.chip,{borderColor:filter===status?theme.primary:theme.border,
                backgroundColor:filter===status?theme.infoSurface:theme.backgroundElement}]}
              onPress={()=>setFilter(status)}>
              <ThemedText type="smallBold">{status==='all'?'Tous':APPOINTMENT_STATUS_LABELS[status]}
                {state.status==='success'?` (${status==='all'?items.length:items.filter(x=>x.status===status).length})`:''}
              </ThemedText>
            </Pressable>)}
        </View>
      </View>}
      renderItem={({item})=><Card>
        <View style={styles.head}>
          <ThemedText type="subtitle" style={{flex:1}}>{item.patient}</ThemedText>
          <Badge label={APPOINTMENT_STATUS_LABELS[item.status]}
            tone={item.status==='confirmed'?'success':item.status==='pending_confirmation'?'info':
              item.status==='rejected'?'danger':'neutral'}/>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {item.date} · {item.time} · {item.mode}
        </ThemedText>
        {item.district?<ThemedText themeColor="textSecondary" type="small">
          Quartier : {item.district}
        </ThemedText>:null}
        <Button variant="outline" label="Mettre à jour le statut" disabled={busy}
          onPress={()=>openStatus(item)}/>
      </Card>}
      ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement de l'agenda…" />:
        state.status==='error'?<ErrorState title="Agenda indisponible" onRetry={()=>load()}/>:
          <EmptyState title="Aucun rendez-vous"
            description="Aucun rendez-vous pour ce filtre. Actualisez pour consulter les derniers changements."/>}
    />
    <Modal visible={!!target} title="Confirmer un changement de statut"
      description={target?`Rendez-vous du ${target.date} à ${target.time} — ${target.patient}. Statut actuel : ${APPOINTMENT_STATUS_LABELS[target.status]}. Le serveur ne limite pas actuellement les transitions : vérifiez soigneusement votre choix, qui sera communiqué au patient.`:undefined}
      onClose={()=>{if(!busy)setTarget(null);}} busy={busy}
      onConfirm={()=>{void saveStatus();}} confirmLabel="Enregistrer le nouveau statut">
      <SelectField label="Nouveau statut" value={desired} onChange={x=>setDesired(x as AppointmentStatus)}
        options={backendPermittedStatuses().map(x=>({value:x,label:APPOINTMENT_STATUS_LABELS[x]}))}/>
      {target&&desired===target.status?<ThemedText type="small" themeColor="textSecondary">
        Choisissez un statut différent avant de valider.
      </ThemedText>:null}
    </Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{maxWidth:800,width:'100%',alignSelf:'center',padding:Spacing.three,paddingBottom:120},
  header:{gap:Spacing.three,marginBottom:Spacing.three},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  chip:{borderWidth:1,borderRadius:Radius.pill,minHeight:MinimumTouchTarget,justifyContent:'center',padding:Spacing.two},
  head:{flexDirection:'row',alignItems:'center',gap:Spacing.two},
  link:{minHeight:MinimumTouchTarget,justifyContent:'center',alignItems:'center',borderRadius:Radius.large},
});
