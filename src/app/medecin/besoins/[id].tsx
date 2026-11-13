import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input, SelectField } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { needsApi } from '@/services/needs';
import { useVerifiedDoctorAccess } from '@/features/doctor/use-verified-doctor-access';
import { PRIORITY_LABELS, parseDoctorNeedDetail, validateProposal,
  doctorNeedsError, dateTimeDisplay, EMPTY_PROPOSAL_FORM,
  type DoctorNeedDetail, type ProposalForm } from '@/features/doctor/doctor-needs';

type State={status:'loading'|'error'|'not-found';message?:string}|
  {status:'success';value:DoctorNeedDetail};
export default function DoctorNeedDetailScreen(){
  const {id}=useLocalSearchParams<{id?:string}>();
  const needId=typeof id==='string'&&id.trim()?id:null;
  const {access,refresh:refreshAccess}=useVerifiedDoctorAccess();
  const theme=useTheme();
  const [state,setState]=useState<State>({status:'loading'});
  const [form,setForm]=useState<ProposalForm>({...EMPTY_PROPOSAL_FORM});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [step,setStep]=useState<'edit'|'review'|'sent'>('edit');
  const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [notice,setNotice]=useState('');
  const request=useRef<AbortController|null>(null),sequence=useRef(0),lock=useRef(false);

  const load=useCallback((pull=false)=>{
    request.current?.abort();const ac=new AbortController();request.current=ac;const token=++sequence.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    if(!needId){setState({status:'not-found'});setRefreshing(false);return;}
    void needsApi.doctorDetail(needId,ac.signal).then(value=>{
      const detail=parseDoctorNeedDetail(value);
      if(!ac.signal.aborted&&token===sequence.current)setState({status:'success',value:detail});
    }).catch(error=>{
      if(ac.signal.aborted||token!==sequence.current)return;
      const code=(error as {status?:number}|null)?.status;
      setState({status:code===404?'not-found':'error',message:doctorNeedsError(error)});
    }).finally(()=>{if(!ac.signal.aborted&&token===sequence.current)setRefreshing(false);});
  },[needId]);
  useFocusEffect(useCallback(()=>{
    if(access.status==='allowed')load();
    else{request.current?.abort();sequence.current++;setState({status:'loading'});}
    return()=>{request.current?.abort();sequence.current++;setState({status:'loading'});
      setForm({...EMPTY_PROPOSAL_FORM});setStep('edit');setNotice('');setErrors({});};
  },[access.status,load]));

  function change<K extends keyof ProposalForm>(key:K,value:ProposalForm[K]){
    setForm(old=>({...old,[key]:value}));setErrors(old=>({...old,[key]:'',date:'',form:''}));
  }
  function review(){
    if(state.status!=='success')return;
    const checked=validateProposal(form);
    setErrors(checked.errors);
    if(checked.payload)setStep('review');
  }
  async function send(){
    if(lock.current||!needId||state.status!=='success')return;
    const checked=validateProposal(form);
    if(!checked.payload){setErrors(checked.errors);setStep('edit');return;}
    lock.current=true;setBusy(true);setNotice('');
    try{
      await needsApi.propose(needId,checked.payload);
      setStep('sent');setForm({...EMPTY_PROPOSAL_FORM});
    }catch(error){
      const message=doctorNeedsError(error);
      setErrors({form:message});
      setStep('edit');
      // The request may have been closed while the form was open.
      if((error as {status?:number})?.status===404||(error as {status?:number})?.status===400){
        load(true);
      }
    }finally{lock.current=false;setBusy(false);}
  }
  async function openAttachment(downloadUrl:string){
    try{
      const url=new URL(downloadUrl);
      if(url.protocol!=='https:')throw new Error('unsafe');
      await Linking.openURL(url.toString());
    }catch{setNotice('Lien indisponible ou expiré. Actualisez la demande avant de réessayer.');}
  }
  const active=access.status==='allowed';
  const need=state.status==='success'?state.value:null;
  return <SafeAreaView edges={['top','left','right']}
    style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>active&&load(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}>
      <Link href="/medecin/besoins"><ThemedText type="linkPrimary">‹ Retour aux besoins</ThemedText></Link>
      <Header title="Détail de la demande"
        subtitle="Uniquement les données que le patient a autorisées à partager."/>
      {access.status==='loading'?<LoadingState label="Vérification des autorisations…" />:
        !active?<View style={{gap:Spacing.three}}>
          <ErrorState title="Accès professionnel limité" description={access.message} onRetry={refreshAccess}/>
          <Link href="/medecin/profil"><ThemedText type="linkPrimary">Consulter mon profil</ThemedText></Link>
        </View>:
        state.status==='loading'?<LoadingState label="Chargement du besoin…" />:
        state.status==='not-found'?<ErrorState title="Demande indisponible"
          description="Cette demande n’existe plus ou ne peut pas être consultée par votre profil."/>:
        state.status==='error'?<ErrorState title="Impossible de consulter la demande"
          description={state.message} onRetry={()=>load()}/>:
        need?<>
          <Card>
            <Badge label={'Priorité '+PRIORITY_LABELS[need.priority]}
              tone={need.priority==='emergency'?'danger':need.priority==='urgent'?'warning':'info'}/>
            <ThemedText type="subtitle">{need.title}</ThemedText>
            <ThemedText themeColor="textSecondary">{need.specialty} · {need.city}, {need.district}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {need.mode==='domicile'?'À domicile':'Téléconsultation'}
              {' · '}Publié le {dateTimeDisplay(need.createdAt)}
            </ThemedText>
            <ThemedText type="smallBold">Description</ThemedText>
            <ThemedText>{need.description}</ThemedText>
            <ThemedText type="smallBold">Symptômes déclarés</ThemedText>
            <ThemedText themeColor="textSecondary">{need.symptoms.length?need.symptoms.join(', '):'Non renseignés'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Durée : {need.durationDescription||'Non renseignée'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Disponibilité déclarée : {dateTimeDisplay(need.availableFrom)}
            </ThemedText>
          </Card>
          <Card>
            <ThemedText type="subtitle">Documents partagés</ThemedText>
            {need.attachments.length?need.attachments.map(file=>
              <Button key={file.id} label={file.fileName} variant="outline"
                onPress={()=>{void openAttachment(file.downloadUrl);}}/>):
              <ThemedText themeColor="textSecondary">Aucun document partagé.</ThemedText>}
            {notice?<ThemedText themeColor="danger" accessibilityRole="alert">{notice}</ThemedText>:null}
            <ThemedText type="small" themeColor="textSecondary">
              Les documents médicaux ne doivent être ouverts que pour la prise en charge. Les liens signés sont temporaires.
              Aucune adresse exacte, identité ou dossier médical privé du patient n’est exposé ici.
            </ThemedText>
          </Card>
          {step==='sent'?<Card>
            <Badge tone="success" label="Proposition transmise"/>
            <ThemedText type="subtitle">Votre proposition a été envoyée.</ThemedText>
            <ThemedText themeColor="textSecondary">
              La réponse et le statut seront disponibles dans vos propositions.
            </ThemedText>
            <Link href="/medecin/propositions">
              <ThemedText type="linkPrimary">Suivre mes propositions ›</ThemedText>
            </Link>
          </Card>:step==='review'?<Card>
            <ThemedText type="subtitle">Vérifier avant l’envoi</ThemedText>
            <ThemedText>{form.message}</ThemedText>
            <ThemedText themeColor="textSecondary">
              Le {form.date} à {form.time} · {form.consultationMode==='home'?'À domicile':'Téléconsultation'}
            </ThemedText>
            <ThemedText>{form.fee} XAF</ThemedText>
            {form.details?<ThemedText themeColor="textSecondary">{form.details}</ThemedText>:null}
            {errors.form?<ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText>:null}
            <Button label="Modifier" variant="outline" disabled={busy} onPress={()=>setStep('edit')}/>
            <Button label="Confirmer et envoyer" loading={busy} onPress={()=>{void send();}}/>
          </Card>:<Card>
            <ThemedText type="subtitle">Proposer une consultation</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              Votre proposition sera soumise au patient. Aucun rendez-vous n’est créé avant son acceptation.
            </ThemedText>
            <Input label="Message au patient" multiline numberOfLines={4}
              placeholder="Présentez votre réponse au besoin (10 caractères minimum)"
              value={form.message} onChangeText={v=>change('message',v)} error={errors.message} editable={!busy}/>
            <Input label="Date proposée (AAAA-MM-JJ)" placeholder="2026-11-20" value={form.date}
              onChangeText={v=>change('date',v)} maxLength={10}
              keyboardType="numbers-and-punctuation" error={errors.date} editable={!busy}/>
            <Input label="Heure (HH:mm, heure de votre téléphone)" value={form.time} placeholder="10:00"
              onChangeText={v=>change('time',v)} maxLength={5}
              keyboardType="numbers-and-punctuation" editable={!busy}/>
            <SelectField label="Mode de consultation" value={form.consultationMode}
              options={[{label:'À domicile',value:'home'},{label:'Téléconsultation',value:'teleconsultation'}]}
              onChange={v=>change('consultationMode',v as ProposalForm['consultationMode'])} error={errors.mode}/>
            <Input label="Tarif proposé (XAF)" value={form.fee} keyboardType="decimal-pad"
              onChangeText={v=>change('fee',v)} error={errors.fee} editable={!busy}/>
            <Input label="Informations complémentaires (facultatif)" multiline numberOfLines={3}
              value={form.details} onChangeText={v=>change('details',v)}
              maxLength={2000} error={errors.details} editable={!busy}/>
            {errors.form?<ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText>:null}
            <Button label="Vérifier ma proposition" onPress={review} disabled={busy}/>
          </Card>}
        </>:null}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,
    paddingBottom:120,gap:Spacing.three},
});
