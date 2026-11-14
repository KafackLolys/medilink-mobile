import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Card, Header, Button } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { NeedFields, type EditableNeedFields } from '@/components/patient/need-fields';
import { needsApi } from '@/services/needs';
import { useNavigationSession } from '@/store/navigation-session';
import { canEditNeed, safeNeedError, validateNeedEdit } from '@/features/patient/need-model';
import { Spacing } from '@/constants/theme';
import type { NeedDetail } from '@/types/domain';

type DetailState = {status:'loading'|'error'|'not-found'}|{status:'success'; need:NeedDetail};
const initialFields = (need: NeedDetail): EditableNeedFields => ({
  title:need.title, specialty:need.specialty,description:need.description,
  mode:need.mode==='domicile'?'domicile':'tele',
});
export default function EditNeedScreen(){
  const router=useRouter();
  const {id}=useLocalSearchParams<{id?:string}>();
  const needId=typeof id==='string'&&id.trim()?id:null;
  const session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<DetailState>({status:'loading'});
  const [fields,setFields]=useState<EditableNeedFields|null>(null);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const seq=useRef(0);
  const controller=useRef<AbortController|null>(null);
  const lock=useRef(false);
  const load=useCallback(()=>{
    controller.current?.abort();const ac=new AbortController();controller.current=ac;const version=++seq.current;
    setState({status:'loading'});
    if(!needId){setState({status:'not-found'});return;}
    void needsApi.detail(needId,ac.signal).then(need=>{
      if(ac.signal.aborted||version!==seq.current)return;
      setState({status:'success',need});setFields(initialFields(need));
    }).catch(e=>{
      if(!ac.signal.aborted&&version===seq.current)
        setState({status:(e as {status?:number})?.status===404?'not-found':'error'});
    });
  },[needId]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')load();
    return()=>{seq.current++;controller.current?.abort();};
  },[load,session.status,session.role]));

  function set<K extends keyof EditableNeedFields>(key:K, value:EditableNeedFields[K]){
    setFields(current=>current?{...current,[key]:value}:current);
    setErrors(current=>({...current,[key]:'',form:''}));
  }
  async function submit(){
    if(lock.current||!needId||state.status!=='success'||!fields)return;
    if(!canEditNeed(state.need.status)){setErrors({form:'Cette demande ne peut plus être modifiée.'});return;}
    const found=validateNeedEdit(fields);setErrors(found);
    if(Object.keys(found).length)return;
    lock.current=true;setBusy(true);
    const ac=new AbortController();controller.current=ac;
    try{
      await needsApi.update(needId,{
        title:fields.title.trim(),specialty:fields.specialty.trim(),
        description:fields.description.trim(),mode:fields.mode,
      },ac.signal);
      if(!ac.signal.aborted)router.replace({pathname:'/patient/demandes/[id]',params:{id:needId}});
    }catch(e){
      if(!ac.signal.aborted)setErrors({form:safeNeedError(e)});
    }finally{lock.current=false;setBusy(false);}
  }
  if(session.status!=='authenticated'||session.role!=='patient')return <Screen><LoadingState label="Vérification de votre accès…" /></Screen>;
  return <Screen>
    <Header title="Modifier ma demande" subtitle="Actualisez uniquement les champs modifiables."/>
    <Link href={needId?{pathname:'/patient/demandes/[id]',params:{id:needId}}:'/patient/demandes'}>
      <ThemedText type="linkPrimary">‹ Retour à la demande</ThemedText>
    </Link>
    {state.status==='loading'?<LoadingState label="Chargement du formulaire…" />:
      state.status==='not-found'?<ErrorState title="Demande introuvable"/>:
      state.status==='error'?<ErrorState title="Impossible de charger la demande" onRetry={load}/>:
      state.status==='success' && !canEditNeed(state.need.status)?<Card>
        <ThemedText themeColor="textSecondary">Cette demande ne peut plus être modifiée dans son état actuel.</ThemedText>
      </Card>:fields?<View style={{gap:Spacing.three}}>
        <NeedFields value={fields} set={set} errors={errors} disabled={busy}/>
        {errors.form?<ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText>:null}
        <Button label="Enregistrer les modifications" loading={busy} onPress={()=>{void submit();}}/>
        <ThemedText type="small" themeColor="textSecondary">
          Seuls le titre, la spécialité, la description et le mode sont modifiables. Les pièces jointes ne peuvent pas être remplacées ici.
        </ThemedText>
      </View>:null}
  </Screen>;
}
