import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Badge } from '@/components/ui/primitives';
import { Input, SelectField } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { appointmentsApi } from '@/services/appointments';
import { useNavigationSession } from '@/store/navigation-session';
import { reviewEligible,validateReview,parsePatientReview,reviewError,REVIEW_RATINGS,type PatientReview } from './reviews-model';
import type { PatientAppointment } from '@/types/domain';
import { Spacing } from '@/constants/theme';

type State={status:'loading'|'error';message?:string}|{status:'success';review:PatientReview|null};
export function PatientAppointmentReview({appointment}:{appointment:PatientAppointment}){
 const session=useNavigationSession(s=>s.session);
 const [state,setState]=useState<State>({status:'loading'});
 const [rating,setRating]=useState('5'),[comment,setComment]=useState('');
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),sequence=useRef(0),focus=useRef(0),lock=useRef(false);
 const allowed=session.status==='authenticated'&&session.role==='patient';
 const load=useCallback(()=>{
  controller.current?.abort();const ac=new AbortController();controller.current=ac;const v=++sequence.current;
  setState({status:'loading'});
  void appointmentsApi.review(appointment.id,ac.signal).then(raw=>{
   const review=parsePatientReview(raw);
   if(!ac.signal.aborted&&v===sequence.current)setState({status:'success',review});
  }).catch(cause=>{
   if(!ac.signal.aborted&&v===sequence.current)setState({status:'error',message:reviewError(cause)});
  });
 },[appointment.id]);
 useFocusEffect(useCallback(()=>{
  focus.current++;
  if(allowed)load();
  return()=>{focus.current++;sequence.current++;controller.current?.abort();
   setState({status:'loading'});setComment('');setRating('5');setError('');setSaving(false);};
 },[allowed,load]));
 async function send(){
  if(lock.current||!allowed||!reviewEligible(appointment)||state.status!=='success'||state.review)return;
  const checked=validateReview(Number(rating),comment);
  if(!checked.body){setError(Object.values(checked.errors).join(' '));return;}
  const epoch=focus.current;lock.current=true;setSaving(true);setError('');
  try{
   // Server uses appointmentId as review document ID in an atomic transaction.
   const response=await appointmentsApi.submitReview(appointment.id,checked.body);
   const created=parsePatientReview(response);
   if(!created||created.id!==appointment.id||created.rating!==checked.body.rating)throw Error('Unconfirmed review');
   if(epoch!==focus.current)return;
   setState({status:'success',review:created});setComment('');
  }catch(e){
   if(epoch!==focus.current)return;
   setError(reviewError(e));
   // GET again before offering another POST: an uncertain network outcome can still have succeeded.
   load();
  }finally{lock.current=false;if(epoch===focus.current)setSaving(false);}
 }
 if(!allowed)return null;
 return <Card>
  <ThemedText type="subtitle">Mon avis après consultation</ThemedText>
  <ThemedText type="small" themeColor="textSecondary">
   Un seul avis est autorisé par rendez-vous terminé. Ne partagez pas de renseignements médicaux sensibles dans un commentaire.
  </ThemedText>
  {state.status==='loading'?<LoadingState label="Vérification d’un avis existant…"/>:
   state.status==='error'?<ErrorState title="Avis indisponible" description={state.message} onRetry={load}/>:
   state.review?<View style={{gap:Spacing.two}}>
     <Badge label={'Avis publié · '+state.review.rating+'/5'} tone="success"/>
     {state.review.comment?<ThemedText>{state.review.comment}</ThemedText>:null}
     <ThemedText type="small" themeColor="textSecondary">Un deuxième avis sur cette consultation n’est pas autorisé.</ThemedText>
    </View>:
   !reviewEligible(appointment)?<ThemedText themeColor="textSecondary">Vous pourrez évaluer cette consultation après son passage au statut « Terminée ».</ThemedText>:
   <View style={{gap:Spacing.three}}>
    <SelectField label="Votre note" value={rating} onChange={setRating}
     options={REVIEW_RATINGS.map(v=>({value:String(v),label:v+'/5'}))}/>
    <Input label="Commentaire (facultatif)" value={comment} onChangeText={setComment}
     multiline numberOfLines={4} maxLength={2000} editable={!saving}
     placeholder="Partagez votre expérience sans information médicale privée."/>
    {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
    <Button label={saving?'Publication…':'Publier mon avis'} loading={saving} disabled={saving} onPress={()=>{void send();}}/>
   </View>}
 </Card>;
}
