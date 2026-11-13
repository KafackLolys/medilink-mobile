import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Button, Header } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { needsApi } from '@/services/needs';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { NEED_STATUS_LABELS, canEditNeed, canCloseNeed, canDeleteNeed, safeNeedError } from '@/features/patient/need-model';
import type { NeedDetail } from '@/types/domain';

type State={status:'loading'|'error'|'not-found'}|{status:'success';need:NeedDetail};
export default function PatientNeedDetail() {
  const router=useRouter();
  const {id}=useLocalSearchParams<{id?:string}>();
  const needId=typeof id==='string'&&id.trim()?id:null;
  const theme=useTheme();
  const session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<State>({status:'loading'});
  const [confirm,setConfirm]=useState<'close'|'delete'|null>(null);
  const [busy,setBusy]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const seq=useRef(0);
  const controller=useRef<AbortController|null>(null);
  const locked=useRef(false);

  const reload=useCallback((pull=false)=>{
    controller.current?.abort();
    const ac=new AbortController();controller.current=ac;const current=++seq.current;
    if(pull) setRefreshing(true);else setState({status:'loading'});
    if(!needId){setState({status:'not-found'});setRefreshing(false);return;}
    void needsApi.detail(needId,ac.signal).then(need=>{
      if(!ac.signal.aborted&&seq.current===current)setState({status:'success',need});
    }).catch(e=>{
      if(!ac.signal.aborted&&seq.current===current)
        setState({status:(e as {status?:number})?.status===404?'not-found':'error'});
    }).finally(()=>{
      if(!ac.signal.aborted&&seq.current===current)setRefreshing(false);
    });
  },[needId]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')reload();
    return ()=>{seq.current++;controller.current?.abort();};
  },[reload,session.status,session.role]));

  async function act(){
    if(locked.current||!confirm||state.status!=='success'||!needId)return;
    const action=confirm, need=state.need;
    if(!(action==='delete'?canDeleteNeed(need.status):canCloseNeed(need.status))){
      setConfirm(null);setError('Cette demande ne peut plus être modifiée.');reload();return;
    }
    locked.current=true;setBusy(true);setError('');
    try {
      if(action==='delete')await needsApi.delete(needId);
      else await needsApi.close(needId);
      setConfirm(null);
      if(action==='delete')router.replace('/patient/demandes');
      else reload();
    }catch(e){
      setConfirm(null);setError(safeNeedError(e));reload();
    }finally{locked.current=false;setBusy(false);}
  }

  async function openAttachment(url:string){
    try {
      const parsed=new URL(url);
      if(parsed.protocol!=='https:')throw new Error('unsafe URL');
      await Linking.openURL(url);
    }catch{setError('Impossible d’ouvrir ce document. Actualisez la demande pour renouveler son lien.');}
  }

  if(session.status!=='authenticated'||session.role!=='patient')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}><LoadingState label="Vérification de votre accès…" /></SafeAreaView>;
  const need=state.status==='success'?state.need:null;
  return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>reload(true)}
      colors={[theme.primary]} tintColor={theme.primary}/>}
      contentContainerStyle={styles.content}>
      <Link href="/patient/demandes"><ThemedText type="linkPrimary">‹ Mes demandes</ThemedText></Link>
      <Header title="Détail de la demande" subtitle="Statut et informations personnelles"/>
      {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
      {state.status==='loading'?<LoadingState label="Chargement de votre demande…" />:
        state.status==='not-found'?<ErrorState title="Demande introuvable"
          description="Cette demande est inexistante ou ne vous est pas accessible."/>:
        state.status==='error'?<ErrorState title="Demande indisponible" onRetry={()=>reload()}/>:
        need?<>
          <Card>
            <Badge label={NEED_STATUS_LABELS[need.status]} tone="info"/>
            <ThemedText type="subtitle">{need.title}</ThemedText>
            <ThemedText themeColor="textSecondary">{need.specialty}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{need.mode==='domicile'?'À domicile':'Téléconsultation'} · {need.district}, {need.city}</ThemedText>
            <ThemedText type="small">{need.interested} médecin(s) intéressé(s)</ThemedText>
          </Card>
          <Card>
            <ThemedText type="subtitle">Description</ThemedText>
            <ThemedText>{need.description}</ThemedText>
            <ThemedText type="smallBold">Symptômes</ThemedText>
            <ThemedText themeColor="textSecondary">{need.symptoms.length?need.symptoms.join(', '):'Non précisés'}</ThemedText>
            <ThemedText type="smallBold">Durée et priorité</ThemedText>
            <ThemedText themeColor="textSecondary">{need.durationDescription||'Durée non précisée'} · {need.priority==='rapide'?'Prise en charge rapide':'Consultation normale'}</ThemedText>
            {need.privateAddress?<><ThemedText type="smallBold">Votre adresse (confidentielle)</ThemedText>
              <ThemedText>{need.privateAddress}</ThemedText></>:null}
          </Card>
          <Card>
            <ThemedText type="subtitle">Documents joints</ThemedText>
            {need.attachments.length?need.attachments.map(file=>
              <Pressable key={file.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${file.fileName}`}
                style={[styles.document,{borderColor:theme.border}]}
                onPress={()=>{void openAttachment(file.downloadUrl);}}>
                <ThemedText themeColor="primary">{file.fileName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{Math.ceil(file.sizeBytes/1024)} Ko · Lien temporaire</ThemedText>
              </Pressable>
            ):<ThemedText themeColor="textSecondary">Aucun document joint.</ThemedText>}
          </Card>
          {canEditNeed(need.status)?<Link href={{pathname:'/patient/demandes/[id]/modifier',params:{id:need.id}}} asChild>
            <Pressable style={[styles.primary,{backgroundColor:theme.infoSurface}]} accessibilityRole="link">
              <ThemedText type="smallBold" themeColor="primary">Modifier ma demande</ThemedText>
            </Pressable>
          </Link>:null}
          {canCloseNeed(need.status)?<Button label="Clôturer ma demande" variant="outline" disabled={busy} onPress={()=>setConfirm('close')}/>:null}
          {canDeleteNeed(need.status)?<Button label="Supprimer définitivement ce brouillon" variant="danger" disabled={busy}
            onPress={()=>setConfirm('delete')}/>:null}
        </>:null}
    </ScrollView>
    <Modal visible={!!confirm} title={confirm==='delete'?'Supprimer le brouillon ?':'Clôturer la demande ?'}
      description={confirm==='delete'?'Cette action supprimera définitivement le brouillon et ses pièces jointes.'
        :'Les médecins ne pourront plus envoyer de propositions. Cette action est irréversible.'}
      onClose={()=>{if(!busy)setConfirm(null);}} busy={busy}
      confirmLabel={confirm==='delete'?'Supprimer définitivement':'Clôturer'}
      onConfirm={()=>{void act();}}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{padding:Spacing.three,paddingBottom:100,gap:Spacing.three,maxWidth:800,width:'100%',alignSelf:'center'},
  document:{borderWidth:1,borderRadius:Radius.large,padding:Spacing.three,minHeight:MinimumTouchTarget,justifyContent:'center',gap:Spacing.two},
  primary:{minHeight:MinimumTouchTarget,borderRadius:Radius.large,justifyContent:'center',alignItems:'center'},
});
