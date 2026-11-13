import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Header } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing } from '@/constants/theme';
import { integrationApi } from '@/services/integration';
import { parseDoctorZone,editableDoctorZone,validateDoctorZone,
  appendDistrict,doctorZoneError, type ZoneDraft } from '@/features/geo/doctor-zone-model';

type ZoneState={status:'loading'|'error'}|{status:'success';value:ZoneDraft};
const DEFAULT_DRAFT:ZoneDraft={city:'',districts:[],radiusKm:'10',maxDistanceKm:'25'};
export default function DoctorInterventionZone(){
 const theme=useTheme(),session=useNavigationSession(s=>s.session);
 const [state,setState]=useState<ZoneState>({status:'loading'});
 const [draft,setDraft]=useState<ZoneDraft>({...DEFAULT_DRAFT});
 const [district,setDistrict]=useState('');
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);
 const controller=useRef<AbortController|null>(null),version=useRef(0);
 const focusGeneration=useRef(0),saveLock=useRef(false);
 const allowed=session.status==='authenticated'&&session.role==='doctor';
 const load=useCallback((pull=false)=>{
  controller.current?.abort();const ac=new AbortController();controller.current=ac;const serial=++version.current;
  if(pull)setRefreshing(true);else setState({status:'loading'});
  void integrationApi.doctorZone(ac.signal).then(raw=>{
   const zone=editableDoctorZone(parseDoctorZone(raw));
   if(ac.signal.aborted||serial!==version.current)return;
   setDraft(zone);setState({status:'success',value:zone});
  }).catch(cause=>{
   if(ac.signal.aborted||serial!==version.current)return;
   setState({status:'error'});setError(doctorZoneError(cause));
  }).finally(()=>{if(!ac.signal.aborted&&serial===version.current)setRefreshing(false);});
 },[]);
 useFocusEffect(useCallback(()=>{
  focusGeneration.current++;
  if(allowed)load();
  return()=>{focusGeneration.current++;controller.current?.abort();version.current++;
   setState({status:'loading'});setDraft({...DEFAULT_DRAFT});setDistrict('');
   setNotice('');setError('');setErrors({});setSaving(false);setRefreshing(false);};
 },[allowed,load]));
 function update(field:'city'|'radiusKm'|'maxDistanceKm',value:string){
  setDraft(old=>({...old,[field]:value}));setErrors(old=>({...old,[field]:''}));setNotice('');
 }
 function addDistrict(){
  const next=appendDistrict(draft,district);
  if(next.error){setErrors(old=>({...old,districts:next.error!}));return;}
  setDraft(next.form);setDistrict('');setErrors(old=>({...old,districts:''}));setNotice('');
 }
 async function save(){
  if(!allowed||saveLock.current||state.status!=='success')return;
  const checked=validateDoctorZone(draft);
  setErrors(checked.errors);if(!checked.payload)return;
  const generation=focusGeneration.current;
  saveLock.current=true;setSaving(true);setError('');setNotice('');
  try{
   const response=await integrationApi.saveDoctorZone(checked.payload);
   if(generation!==focusGeneration.current)return;
   const verified=parseDoctorZone(response);
   if(JSON.stringify(verified)!==JSON.stringify(checked.payload))
    throw Error('Réponse inattendue');
   setNotice('Votre zone d’intervention a été enregistrée sur le serveur.');
   load(true);
  }catch(cause){
   if(generation===focusGeneration.current){setError(doctorZoneError(cause));load(true);}
  }finally{saveLock.current=false;if(generation===focusGeneration.current)setSaving(false);}
 }
 if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
  <ErrorState title="Accès médecin requis" description="Cette fonctionnalité est réservée aux médecins authentifiés."/>
 </SafeAreaView>;
 return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
    tintColor={theme.primary} colors={[theme.primary]}/>}>
   <Header title="Zone d’intervention" subtitle="Définissez votre ville, vos quartiers et vos distances d’intervention."/>
   <Link href="/medecin/profil"><ThemedText themeColor="primary" type="linkPrimary">‹ Retour au profil</ThemedText></Link>
   <Card>
    <ThemedText type="small" themeColor="textSecondary">
     Le serveur enregistre des secteurs déclarés manuellement, pas des coordonnées GPS.
     Aucun accès à votre position ou suivi en arrière-plan n'est nécessaire.
    </ThemedText>
   </Card>
   {error?<ThemedText accessibilityRole="alert" themeColor="danger">{error}</ThemedText>:null}
   {notice?<ThemedText accessibilityRole="alert" themeColor="success">{notice}</ThemedText>:null}
   {state.status==='loading'?<LoadingState label="Chargement des zones…" />:
    state.status==='error'?<ErrorState title="Zones indisponibles" description={error}
     onRetry={()=>load()}/>:
    <Card>
     <Input label="Ville d’intervention" value={draft.city}
      onChangeText={text=>update('city',text)} maxLength={100} editable={!saving}
      placeholder="Ex. Yaoundé" error={errors.city}/>
     <ThemedText type="smallBold">Quartiers couverts ({draft.districts.length}/40)</ThemedText>
     <Input label="Ajouter un quartier" value={district}
      onChangeText={setDistrict} maxLength={100} editable={!saving}
      placeholder="Ex. Bastos" onSubmitEditing={addDistrict} returnKeyType="done"
      error={errors.districts}/>
     <Button label="Ajouter le quartier" variant="outline" onPress={addDistrict}
      disabled={saving||!district.trim()||draft.districts.length>=40}/>
     {draft.districts.length?draft.districts.map((value,index)=>
      <View key={value+'-'+index} style={[styles.district,{borderColor:theme.border}]}>
       <ThemedText style={{flex:1}}>{value}</ThemedText>
       <Button label={'Retirer '+value} variant="outline" disabled={saving} onPress={()=>{
        setDraft(previous=>({...previous,districts:previous.districts.filter((_,i)=>i!==index)}));setNotice('');
       }}/>
      </View>):
      <ThemedText type="small" themeColor="textSecondary">Aucun quartier renseigné. La ville peut suffire.</ThemedText>}
     <Input label="Rayon d’intervention (km)" keyboardType="number-pad" value={draft.radiusKm}
      onChangeText={text=>update('radiusKm',text)} editable={!saving} error={errors.radiusKm}/>
     <Input label="Distance maximale (km)" keyboardType="number-pad" value={draft.maxDistanceKm}
      onChangeText={text=>update('maxDistanceKm',text)} editable={!saving} error={errors.maxDistanceKm}/>
     <ThemedText type="small" themeColor="textSecondary">
      Rayon : 1–250 km. Distance maximale : 1–500 km et au moins égale au rayon.
      Ces distances définissent une préférence, pas une mesure GPS de patients.
     </ThemedText>
     <Button label="Enregistrer ma zone" loading={saving}
      disabled={saving} onPress={()=>{void save();}}/>
    </Card>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:120,gap:Spacing.three},
 district:{flexDirection:'row',alignItems:'center',paddingVertical:Spacing.two,borderBottomWidth:1,gap:Spacing.two},
});
