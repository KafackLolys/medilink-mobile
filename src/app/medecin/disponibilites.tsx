import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input, SelectField, ToggleField } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { NativeDayPicker, NativeTimePicker } from '@/components/doctor/date-time-pickers';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { availabilitiesApi } from '@/services/availabilities';
import { Spacing } from '@/constants/theme';
import type { BlockedDate, ConsultationMode, WeeklyAvailability } from '@/types/domain';
import {
  DAYS, DURATIONS, parseWeekly, validateWeekly, validateModes,
  validateDuration, validateNewBlock, doctorAgendaError,
} from '@/features/doctor/doctor-agenda';

type Data={status:'loading'|'error'}|{status:'success';weekly:WeeklyAvailability[];modes:ConsultationMode[];
  duration:number;blocked:BlockedDate[]};
type SaveSection='weekly'|'modes'|'duration'|'create-block'|'delete-block';
export default function DoctorAvailabilityScreen(){
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [data,setData]=useState<Data>({status:'loading'});
  const [weekly,setWeekly]=useState<WeeklyAvailability[]>([]);
  const [modes,setModes]=useState<ConsultationMode[]>([]);
  const [duration,setDuration]=useState(30);
  const [date,setDate]=useState(''),[reason,setReason]=useState('');
  const [deleteTarget,setDeleteTarget]=useState<BlockedDate|null>(null);
  const [saving,setSaving]=useState<SaveSection|null>(null);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const controller=useRef<AbortController|null>(null),seq=useRef(0),lock=useRef(false);
  const load=useCallback((pull=false)=>{
    controller.current?.abort();
    const ac=new AbortController();controller.current=ac;const v=++seq.current;
    if(pull)setRefreshing(true);else setData({status:'loading'});
    void Promise.all([
      availabilitiesApi.weekly(ac.signal),availabilitiesApi.modes(ac.signal),
      availabilitiesApi.duration(ac.signal),availabilitiesApi.blocked(ac.signal),
    ]).then(([slots,configured,minutes,blocked])=>{
      if(ac.signal.aborted||v!==seq.current)return;
      const checked=parseWeekly(slots);
      if(!Array.isArray(configured)||!configured.every(mode=>mode==='home'||mode==='teleconsultation')
        ||!Array.isArray(blocked)||!validateDuration(minutes.durationMinutes))
        throw new Error('Réponse invalide.');
      setData({status:'success',weekly:checked,modes:configured,duration:minutes.durationMinutes,blocked});
      setWeekly(checked);setModes(configured);setDuration(minutes.durationMinutes);
    }).catch(()=>{if(!ac.signal.aborted&&v===seq.current)setData({status:'error'});})
    .finally(()=>{if(!ac.signal.aborted&&v===seq.current)setRefreshing(false);});
  },[]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='doctor')load();
    return()=>{seq.current++;controller.current?.abort();setData({status:'loading'});
      setWeekly([]);setModes([]);setDate('');setReason('');setDeleteTarget(null);
      setError('');setNotice('');};
  },[load,session.status,session.role]));
  async function save(key:SaveSection,id?:string){
    if(lock.current||data.status!=='success'||session.status!=='authenticated'||session.role!=='doctor')return;
    const issue=key==='weekly'?Object.values(validateWeekly(weekly)).join(' '):
      key==='modes'?!validateModes(modes)?'Sélectionnez un ou deux modes.':'':key==='duration'?
      !validateDuration(duration)?'Durée de consultation invalide.':'':key==='create-block'?
      validateNewBlock(date,data.blocked)||'':'';
    if(issue){setError(issue);return;}
    if(key==='delete-block'&&!id)return;
    lock.current=true;setSaving(key);setError('');setNotice('');
    try{
      if(key==='weekly')await availabilitiesApi.setWeekly(weekly);
      if(key==='modes')await availabilitiesApi.setModes(modes);
      if(key==='duration')await availabilitiesApi.setDuration(duration);
      if(key==='create-block')await availabilitiesApi.createBlocked({date,reason:reason.trim()||undefined});
      if(key==='delete-block')await availabilitiesApi.deleteBlocked(id!);
      setDeleteTarget(null);
      if(key==='create-block'){setDate('');setReason('');}
      setNotice('Modification enregistrée sur le serveur.');
      load(true);
    }catch(e){setError(doctorAgendaError(e));load(true);}
    finally{lock.current=false;setSaving(null);}
  }
  function updateWeek(day:WeeklyAvailability){
    setWeekly(old=>old.map(item=>item.weekday===day.weekday?day:item));setNotice('');setError('');
  }
  if(session.status!=='authenticated'||session.role!=='doctor')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification des droits médecin…" /></SafeAreaView>;
  const blocked=data.status==='success'?data.blocked:[];
  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
        tintColor={theme.primary} colors={[theme.primary]}/>}>
      <Header title="Mes disponibilités"
        subtitle="Configurez les plages hebdomadaires, les modes et les dates bloquées."/>
      <Link href="/medecin/rendez-vous"><ThemedText type="linkPrimary">Voir mes rendez-vous ›</ThemedText></Link>
      <Card><ThemedText type="small" themeColor="textSecondary">
        Les heures sont saisies en format 24 h. Les plages sont enregistrées pour votre profil médecin.
        Les horaires ne garantissent pas qu'un rendez-vous est libre : les conflits sont vérifiés à la réservation.
      </ThemedText></Card>
      {error?<Card><ThemedText accessibilityRole="alert" themeColor="danger">{error}</ThemedText></Card>:null}
      {notice?<Card><ThemedText accessibilityRole="alert" themeColor="success">{notice}</ThemedText></Card>:null}
      {data.status==='loading'?<LoadingState label="Chargement des disponibilités…" />:
        data.status==='error'?<ErrorState title="Disponibilités indisponibles"
          description="Impossible de récupérer les réglages du médecin." onRetry={()=>load()}/>:
        <>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Modes de consultation</ThemedText>
            <ToggleField label="À domicile" description="Proposer des consultations à domicile"
              value={modes.includes('home')} disabled={!!saving}
              onValueChange={yes=>setModes(old=>yes?[...new Set([...old,'home' as ConsultationMode])]:old.filter(m=>m!=='home'))}/>
            <ToggleField label="Téléconsultation" description="Proposer des consultations à distance"
              value={modes.includes('teleconsultation')} disabled={!!saving}
              onValueChange={yes=>setModes(old=>yes?[...new Set([...old,'teleconsultation' as ConsultationMode])]:old.filter(m=>m!=='teleconsultation'))}/>
            <Button label="Enregistrer les modes" loading={saving==='modes'} disabled={!!saving}
              onPress={()=>{void save('modes');}}/>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Durée des consultations</ThemedText>
            <SelectField label="Durée par défaut" value={String(duration)}
              onChange={x=>{setDuration(Number(x));setNotice('');}}
              options={DURATIONS.map(n=>({label:n+' minutes',value:String(n)}))}/>
            <Button label="Enregistrer la durée" loading={saving==='duration'} disabled={!!saving}
              onPress={()=>{void save('duration');}}/>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Horaires hebdomadaires</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              Enregistrer remplace les horaires des sept jours. Désactivez un jour pour retirer sa plage.
            </ThemedText>
            {weekly.map(day=><View key={day.weekday} style={[styles.day,{borderColor:theme.border}]}>
              <ToggleField label={DAYS.find(d=>d.id===day.weekday)?.label??day.weekday}
                description={day.isAvailable?'Consultations activées':'Aucune disponibilité ce jour'}
                disabled={!!saving}
                value={day.isAvailable} onValueChange={yes=>updateWeek({...day,isAvailable:yes})}/>
              {day.isAvailable?<View style={styles.timeRow}>
                <View style={{flex:1}}><NativeTimePicker label="Début" value={day.startTime}
                  disabled={!!saving} onChange={x=>updateWeek({...day,startTime:x})}/></View>
                <View style={{flex:1}}><NativeTimePicker label="Fin" value={day.endTime}
                  disabled={!!saving} onChange={x=>updateWeek({...day,endTime:x})}/></View>
              </View>:null}
            </View>)}
            <Button label="Enregistrer les horaires de la semaine" loading={saving==='weekly'}
              disabled={!!saving} onPress={()=>{void save('weekly');}}/>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Bloquer une date</ThemedText>
            <NativeDayPicker label="Date à rendre indisponible" value={date} onChange={setDate} disabled={!!saving}/>
            <Input label="Raison (facultative)" value={reason} onChangeText={setReason}
              editable={!saving} placeholder="Absence, congé…" maxLength={200}/>
            <ThemedText type="small" themeColor="textSecondary">
              Vérifiez les rendez-vous déjà confirmés avant de bloquer une date :
              cette action ne les annule pas automatiquement.
            </ThemedText>
            <Button label="Bloquer cette date" loading={saving==='create-block'} disabled={!!saving}
              onPress={()=>{void save('create-block');}}/>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Dates bloquées</ThemedText>
            {blocked.length?blocked.map(item=><View key={item.id} style={[styles.blockRow,{borderColor:theme.border}]}>
              <View style={{flex:1}}>
                <ThemedText type="smallBold">{item.label||item.date}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{item.reason||'Aucune raison précisée'}</ThemedText>
              </View>
              <Button label="Retirer" variant="outline" disabled={!!saving}
                onPress={()=>setDeleteTarget(item)}/>
            </View>):<ThemedText themeColor="textSecondary">Aucune date bloquée.</ThemedText>}
          </Card>
        </>}
    </ScrollView>
    <Modal visible={!!deleteTarget} title="Retirer cette date bloquée ?"
      description="La date redeviendra éligible aux horaires déclarés. Cette action ne crée aucun rendez-vous."
      onClose={()=>{if(!saving)setDeleteTarget(null);}}
      onConfirm={()=>{if(deleteTarget)void save('delete-block',deleteTarget.id);}}
      confirmLabel="Retirer le blocage" busy={saving==='delete-block'}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{alignSelf:'center',width:'100%',maxWidth:800,padding:Spacing.three,paddingBottom:120,gap:Spacing.three},
  day:{borderBottomWidth:1,paddingVertical:Spacing.two,gap:Spacing.two},
  timeRow:{flexDirection:'row',gap:Spacing.three},
  blockRow:{flexDirection:'row',alignItems:'center',gap:Spacing.two,borderBottomWidth:1,paddingVertical:Spacing.two},
});
