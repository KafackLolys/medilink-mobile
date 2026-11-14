import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Header, Button, Avatar, Badge } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { doctorsApi } from '@/services/doctors';
import { appointmentsApi } from '@/services/appointments';
import type { ConsultationMode, DoctorDirectoryItem } from '@/types/domain';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { mapPublicDoctor } from '@/features/patient/doctor-profile';
import { appointmentError, getDeviceTimeZone, matchingOpeningHours, makeBookingRequest, appointmentDetailRoute, APPOINTMENT_LIST_ROUTE } from '@/features/patient/appointment-booking';

type DoctorState = {status:'loading'|'error'|'not-found'} | {status:'success'; doctor:DoctorDirectoryItem};
export default function PatientBooking() {
  const {id}=useLocalSearchParams<{id?:string}>();
  const doctorId=typeof id==='string'&&id.trim()?id:null;
  const session=useNavigationSession(s=>s.session), theme=useTheme(),router=useRouter();
  const [data,setData]=useState<DoctorState>({status:'loading'});
  const [date,setDate]=useState(''),[time,setTime]=useState('');
  const [mode,setMode]=useState<ConsultationMode|''>(''),[reason,setReason]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [created,setCreated]=useState<string|null>(null);
  const seq=useRef(0), request=useRef<AbortController|null>(null),locked=useRef(false);
  const reload=useCallback((pull=false)=>{
    request.current?.abort();const ac=new AbortController();request.current=ac;const version=++seq.current;
    if(pull)setRefreshing(true);else setData({status:'loading'});
    if(!doctorId){setData({status:'not-found'});setRefreshing(false);return;}
    void doctorsApi.detail(doctorId,ac.signal).then(item=>{
      const doctor=mapPublicDoctor(item);
      if(!ac.signal.aborted&&version===seq.current){
        setData({status:'success',doctor});
        setMode(old=>doctor.modes.includes(old as ConsultationMode)?old:'');
      }
    }).catch(e=>{
      if(!ac.signal.aborted&&version===seq.current)
        setData({status:(e as {status?:number})?.status===404?'not-found':'error'});
    }).finally(()=>{if(!ac.signal.aborted&&version===seq.current)setRefreshing(false);});
  },[doctorId]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')reload();
    return()=>{seq.current++;request.current?.abort();};
  },[reload,session.status,session.role]));

  async function submit(){
    if(locked.current||data.status!=='success'||!doctorId)return;
    let payload;
    try{payload=makeBookingRequest(data.doctor,{date,time,consultationMode:mode,reason});}
    catch(e){setError(e instanceof Error?e.message:'Veuillez vérifier vos horaires.');return;}
    locked.current=true;setBusy(true);setError('');
    // Do not cancel a submitted POST on blur: result may have been committed remotely.
    // Keep a single in-flight POST and show a clear outcome before navigating.
    try{
      const result=await appointmentsApi.create(payload);
      setCreated(result.id);
    }catch(e){
      setError(appointmentError(e));
      // A failed create may reflect updated opening hours or a blocked date.
      reload(true);
    }finally{locked.current=false;setBusy(false);}
  }
  if(session.status!=='authenticated'||session.role!=='patient')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification de votre accès…" /></SafeAreaView>;
  if(created)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Badge tone="success" label="Demande envoyée"/>
        <Header title="Votre demande de rendez-vous a été transmise"
          subtitle="Le médecin doit confirmer. Vous pouvez suivre son statut dans vos rendez-vous."/>
        <Link href={appointmentDetailRoute(created)} asChild>
          <Pressable accessibilityRole="link" style={[styles.cta,{backgroundColor:theme.primary}]}>
            <ThemedText style={{color:theme.onPrimary,fontWeight:'700'}}>Voir le rendez-vous</ThemedText>
          </Pressable>
        </Link>
        <Button variant="outline" label="Mes rendez-vous" onPress={()=>router.replace(APPOINTMENT_LIST_ROUTE)}/>
      </Card>
    </ScrollView>
  </SafeAreaView>;

  const doctor=data.status==='success'?data.doctor:null;
  const openings=doctor?matchingOpeningHours(doctor,date):[];
  let zone='Fuseau horaire non détecté';
  try{zone=getDeviceTimeZone();}catch{}
  return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>reload(true)}
      colors={[theme.primary]} tintColor={theme.primary}/>}
      contentContainerStyle={styles.content}>
      <Link href={doctorId?{pathname:'/patient/medecins/[id]',params:{id:doctorId}}:'/patient/medecins'}>
        <ThemedText type="linkPrimary">‹ Profil du médecin</ThemedText>
      </Link>
      <Header title="Demander un rendez-vous"
        subtitle="Sélectionnez une date et une heure au sein des plages déclarées."/>
      {data.status==='loading'?<LoadingState label="Chargement des horaires…" />:
        data.status==='not-found'?<ErrorState title="Médecin indisponible"/>:
        data.status==='error'?<ErrorState title="Horaires indisponibles"
          description="Actualisez les informations du médecin avant de réserver." onRetry={()=>reload()}/>:
        doctor?<>
          <Card>
            <View style={styles.identity}>
              <Avatar name={doctor.name} size={54}/>
              <View style={{flex:1}}>
                <ThemedText type="smallBold">{doctor.name}</ThemedText>
                <ThemedText themeColor="textSecondary">{doctor.specialty}</ThemedText>
              </View>
              <Badge label="Vérifié" tone="success"/>
            </View>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Date souhaitée</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Les plages hebdomadaires sont indicatives : les créneaux déjà pris ne sont pas publiés.
            </ThemedText>
            <Input label="Date (AAAA-MM-JJ)" value={date} onChangeText={v=>{setDate(v);setError('');}}
              placeholder="2026-11-20" maxLength={10} keyboardType="numbers-and-punctuation" editable={!busy}/>
            <Input label="Heure (HH:mm, format 24 h)" value={time} onChangeText={v=>{setTime(v);setError('');}}
              placeholder="09:30" maxLength={5} keyboardType="numbers-and-punctuation" editable={!busy}/>
            <ThemedText type="small" themeColor="textSecondary">Fuseau local de votre appareil : {zone}</ThemedText>
            {date && doctor.blockedDates?.includes(date)?<ThemedText themeColor="danger">
              Ce jour est bloqué par le médecin.
            </ThemedText>:null}
            {date?<View style={{gap:Spacing.two}}>
              <ThemedText type="smallBold">Plages déclarées pour cette date</ThemedText>
              {openings.length?openings.map((s,i)=><ThemedText key={i} themeColor="textSecondary">
                {s.startTime}–{s.endTime} (durée {doctor.appointmentDurationMinutes??30} min)
              </ThemedText>):<ThemedText themeColor="textSecondary">
                Aucune plage déclarée sur ce jour.
              </ThemedText>}
            </View>:null}
            <ThemedText type="small" themeColor="textSecondary">
              L'heure que vous saisissez est une demande, pas une réservation garantie.
            </ThemedText>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Mode de consultation</ThemedText>
            {doctor.modes.length?doctor.modes.map(item=><Pressable key={item}
              accessibilityRole="radio" accessibilityLabel={item==='home'?'À domicile':'Téléconsultation'}
              accessibilityState={{selected:mode===item,disabled:busy}} disabled={busy} onPress={()=>{setMode(item);setError('');}}
              style={[styles.choice,{borderColor:mode===item?theme.primary:theme.border,
                backgroundColor:mode===item?theme.infoSurface:theme.backgroundElement}]}>
              <ThemedText type="smallBold">{item==='home'?'À domicile':'Téléconsultation'}</ThemedText>
            </Pressable>):<ThemedText themeColor="textSecondary">Aucun mode de consultation renseigné.</ThemedText>}
            {mode==='home'?<ThemedText type="small" themeColor="textSecondary">
              Pour une consultation à domicile, le serveur exige une adresse principale dans votre profil.
            </ThemedText>:null}
            <Input label="Motif (facultatif)" value={reason} onChangeText={setReason}
              multiline numberOfLines={4} maxLength={500} editable={!busy}/>
          </Card>
          {error?<Card><ThemedText accessibilityRole="alert" themeColor="danger">{error}</ThemedText>
            <Button variant="outline" label="Actualiser les horaires" onPress={()=>reload(true)}/></Card>:null}
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              En cas d’urgence médicale, contactez immédiatement les services d’urgence.
            </ThemedText>
            <Button label="Envoyer la demande de rendez-vous" loading={busy}
              disabled={busy||!doctor.modes.length||!doctor.availability.some(a=>a.isAvailable)}
              onPress={()=>{void submit();}}/>
          </Card>
        </>:null}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:100,gap:Spacing.three},
  identity:{flexDirection:'row',alignItems:'center',gap:Spacing.two},
  choice:{minHeight:MinimumTouchTarget,borderWidth:1,borderRadius:Radius.large,
    padding:Spacing.three,justifyContent:'center',marginBottom:Spacing.two},
  cta:{minHeight:MinimumTouchTarget,borderRadius:Radius.large,alignItems:'center',
    justifyContent:'center',padding:Spacing.three},
});
