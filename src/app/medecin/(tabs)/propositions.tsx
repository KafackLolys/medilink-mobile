import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Header, Button, Badge } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { needsApi } from '@/services/needs';
import { useVerifiedDoctorAccess } from '@/features/doctor/use-verified-doctor-access';
import { parseProposalsPage, canCancelDoctorProposal,
  PROPOSAL_STATUS_LABELS, PROPOSAL_STATUSES, doctorNeedsError,
  dateTimeDisplay, type ProposalFilter } from '@/features/doctor/doctor-needs';
import type { DoctorProposal } from '@/types/domain';

type State={status:'loading'|'error';message?:string}|
  {status:'success';items:DoctorProposal[];counts:Record<string,number>;
    page:number;totalPages:number;total:number};
const PAGE_SIZE=10;
export default function DoctorProposalsScreen(){
  const {access,refresh:refreshAccess}=useVerifiedDoctorAccess(),theme=useTheme();
  const [filter,setFilter]=useState<ProposalFilter>(''),[page,setPage]=useState(1);
  const [state,setState]=useState<State>({status:'loading'});
  const [confirm,setConfirm]=useState<DoctorProposal|null>(null);
  const [refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState(''),[notice,setNotice]=useState('');
  const seq=useRef(0),controller=useRef<AbortController|null>(null),lock=useRef(false);

  const load=useCallback((pull=false)=>{
    controller.current?.abort();const ac=new AbortController();controller.current=ac;
    const version=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    void needsApi.proposals({status:filter||undefined,page,pageSize:PAGE_SIZE},ac.signal)
      .then(raw=>{
        const result=parseProposalsPage(raw);
        if(ac.signal.aborted||version!==seq.current)return;
        setState({status:'success',items:result.items,counts:result.counts,
          total:result.total,page:result.page,totalPages:result.totalPages});
      }).catch(e=>{
        if(ac.signal.aborted||version!==seq.current)return;
        setState({status:'error',message:doctorNeedsError(e)});
      }).finally(()=>{
        if(!ac.signal.aborted&&version===seq.current)setRefreshing(false);
      });
  },[filter,page]);
  useFocusEffect(useCallback(()=>{
    if(access.status==='allowed')load();
    else{seq.current++;controller.current?.abort();setState({status:'loading'});}
    return()=>{seq.current++;controller.current?.abort();setState({status:'loading'});
      setConfirm(null);setActionError('');setNotice('');};
  },[access.status,load]));

  async function cancel(){
    if(lock.current||!confirm||access.status!=='allowed')return;
    const item=confirm;
    if(!canCancelDoctorProposal(item.status)){
      setConfirm(null);setActionError('Cette proposition ne peut plus être annulée. Actualisez son statut.');
      load(true);return;
    }
    lock.current=true;setBusy(true);setActionError('');setNotice('');
    try{
      const result=await needsApi.cancelProposal(item.id);
      if(!result||typeof result!=='object'||(result as {status?:string}).status!=='cancelled'){
        throw new Error('Réponse d’annulation non confirmée.');
      }
      setConfirm(null);setNotice('Proposition annulée.');
      // Page may become empty if this was the final filtered result.
      if(page>1&&state.status==='success'&&state.items.length===1)setPage(v=>v-1);
      else load(true);
    }catch(e){
      setConfirm(null);setActionError(doctorNeedsError(e));load(true);
    }finally{lock.current=false;setBusy(false);}
  }
  const allowed=access.status==='allowed';
  const items=state.status==='success'?state.items:[];
  return <SafeAreaView edges={['top','left','right']}
    style={{flex:1,backgroundColor:theme.background}}>
    {access.status==='loading'?<LoadingState label="Vérification du profil…" />:
      !allowed?<View style={styles.guard}>
        <ErrorState title="Accès aux propositions restreint" description={access.message}
          onRetry={refreshAccess}/>
        <Link href="/medecin/profil">
          <ThemedText type="linkPrimary">Consulter mon profil professionnel</ThemedText>
        </Link>
      </View>:<FlatList data={items} keyExtractor={item=>item.id}
        initialNumToRender={8} maxToRenderPerBatch={8}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
          colors={[theme.primary]} tintColor={theme.primary}/>}
        ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
        ListHeaderComponent={<View style={styles.header}>
          <Header title="Mes propositions"
            subtitle="Réponses envoyées aux patients et statuts retournés par Medilink."/>
          {notice?<ThemedText themeColor="success" accessibilityRole="alert">{notice}</ThemedText>:null}
          {actionError?<ThemedText themeColor="danger" accessibilityRole="alert">{actionError}</ThemedText>:null}
          <View style={styles.filters}>
            {[{value:'',label:'Toutes'},...PROPOSAL_STATUSES.map(value=>({
              value,label:PROPOSAL_STATUS_LABELS[value],
            }))].map(opt=><Pressable key={opt.value||'all'}
              accessibilityRole="radio" accessibilityLabel={opt.label}
              accessibilityState={{selected:filter===opt.value}}
              onPress={()=>{setFilter(opt.value as ProposalFilter);setPage(1);
                setNotice('');setActionError('');}}
              style={[styles.chip,{borderColor:filter===opt.value?theme.primary:theme.border,
                backgroundColor:filter===opt.value?theme.infoSurface:theme.backgroundElement}]}>
              <ThemedText type="smallBold">{opt.label}{
                state.status==='success'&&opt.value
                  ?` (${state.counts[opt.value]??0})`:''}</ThemedText>
            </Pressable>)}
          </View>
          {state.status==='success'?<ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
            {state.total} {state.total===1?'proposition':'propositions'} dans cette catégorie
          </ThemedText>:null}
        </View>}
        renderItem={({item})=><Card>
          <Badge label={PROPOSAL_STATUS_LABELS[item.status]}
            tone={item.status==='accepted'?'success':
              item.status==='rejected'||item.status==='cancelled'?'danger':'info'}/>
          <ThemedText type="subtitle">{item.needTitle}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {item.specialty} · {item.city}{item.district?' · '+item.district:''}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Envoyée le {dateTimeDisplay(item.proposedAt)}
          </ThemedText>
          <ThemedText type="smallBold">
            {dateTimeDisplay(item.proposedAppointmentAt)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.consultationMode==='home'?'À domicile':'Téléconsultation'}
            {' · '}{new Intl.NumberFormat('fr-FR').format(item.fee)} {item.currency}
          </ThemedText>
          <ThemedText>{item.message}</ThemedText>
          {item.patientResponse?<ThemedText themeColor="textSecondary">
            Réponse du patient : {item.patientResponse}
          </ThemedText>:null}
          <Link href={{pathname:'/medecin/besoins/[id]',params:{id:item.needId}}} asChild>
            <Pressable accessibilityRole="link" style={[styles.detail,{backgroundColor:theme.infoSurface}]}>
              <ThemedText themeColor="primary" type="smallBold">Voir le besoin ›</ThemedText>
            </Pressable>
          </Link>
          {item.status==='accepted'?<Link href="/medecin/messages">
            <ThemedText themeColor="primary" type="smallBold">Accéder aux messages ›</ThemedText>
          </Link>:null}
          {canCancelDoctorProposal(item.status)?<Button variant="outline" label="Annuler cette proposition"
            disabled={busy} onPress={()=>setConfirm(item)}/>:null}
        </Card>}
        ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des propositions…" />:
          state.status==='error'?<ErrorState title="Propositions indisponibles"
            description={state.message} onRetry={()=>load()}/>:
          <EmptyState title="Aucune proposition"
            description="Aucune proposition envoyée ne correspond au statut sélectionné."/>}
        ListFooterComponent={state.status==='success'&&state.totalPages>1?<View style={styles.pager}>
          <Button label="Précédent" variant="outline" disabled={page<=1}
            onPress={()=>setPage(v=>Math.max(1,v-1))}/>
          <ThemedText themeColor="textSecondary" type="small">
            Page {state.page} / {state.totalPages}
          </ThemedText>
          <Button label="Suivant" variant="outline" disabled={page>=state.totalPages}
            onPress={()=>setPage(v=>v+1)}/>
        </View>:undefined}/>}
    <Modal visible={!!confirm} title="Annuler cette proposition ?"
      description="Une proposition annulée ne pourra plus être acceptée. Cette action est définitive."
      onClose={()=>{if(!busy)setConfirm(null);}}
      onConfirm={()=>{void cancel();}} confirmLabel="Confirmer l’annulation" busy={busy}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:110},
  header:{gap:Spacing.three,marginBottom:Spacing.three},filters:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  chip:{minHeight:MinimumTouchTarget,paddingHorizontal:Spacing.three,
    borderRadius:Radius.pill,borderWidth:1,justifyContent:'center'},
  detail:{minHeight:MinimumTouchTarget,alignItems:'center',
    justifyContent:'center',borderRadius:Radius.large},
  pager:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.two,marginTop:Spacing.four},
  guard:{padding:Spacing.three,gap:Spacing.three},
});
