import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Button, Header } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { needsApi } from '@/services/needs';
import { NEED_STATUS_LABELS, canCloseNeed, canDeleteNeed, filterPatientNeeds,
  safeNeedError, type NeedFilter } from '@/features/patient/need-model';
import type { PatientNeed } from '@/types/domain';

type State = { status: 'loading'|'error' } | { status: 'success'; needs: PatientNeed[] };
const FILTERS: {label:string;value:NeedFilter}[] = [
  {label:'Toutes',value:'all'}, {label:'En cours',value:'active'},
  {label:'Confirmées',value:'confirmed'}, {label:'Brouillons',value:'draft'},
  {label:'Clôturées',value:'closed'},
];

export default function PatientNeedsList() {
  const theme = useTheme();
  const session = useNavigationSession(s=>s.session);
  const [state,setState] = useState<State>({status:'loading'});
  const [filter,setFilter] = useState<NeedFilter>('all');
  const [confirm,setConfirm] = useState<{id:string;action:'close'|'delete'}|null>(null);
  const [busy,setBusy] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const [actionError,setActionError] = useState('');
  const controller = useRef<AbortController|null>(null);
  const version = useRef(0);
  const lock = useRef(false);

  const reload = useCallback((pull=false) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    const v = ++version.current;
    if(pull) setRefreshing(true); else setState({status:'loading'});
    void needsApi.list(ac.signal).then(needs=>{
      if(!ac.signal.aborted && v===version.current) setState({status:'success',needs});
    }).catch(()=>{
      if(!ac.signal.aborted && v===version.current) setState({status:'error'});
    }).finally(()=>{
      if(!ac.signal.aborted && v===version.current) setRefreshing(false);
    });
  },[]);
  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated' && session.role==='patient') reload();
    return ()=>{version.current++;controller.current?.abort();};
  },[reload,session.status,session.role]));

  async function act() {
    if(!confirm || lock.current || session.status!=='authenticated' || session.role!=='patient') return;
    const target=confirm;
    const current = state.status==='success' ? state.needs.find(n=>n.id===target.id) : null;
    if(!current || !(target.action==='delete'?canDeleteNeed(current.status):canCloseNeed(current.status))) {
      setConfirm(null);setActionError('Le statut a changé. Actualisez vos demandes.');reload();return;
    }
    lock.current=true;setBusy(true);setActionError('');
    try {
      if(target.action==='delete') await needsApi.delete(target.id);
      else await needsApi.close(target.id);
      setConfirm(null);
      reload();
    } catch(e) {
      setConfirm(null);
      setActionError(safeNeedError(e, 'Impossible de terminer cette action.'));
      reload();
    } finally {lock.current=false;setBusy(false);}
  }

  if(session.status!=='authenticated'||session.role!=='patient')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}><LoadingState label="Vérification de votre accès…" /></SafeAreaView>;
  const all=state.status==='success'?state.needs:[];
  const selected=filterPatientNeeds(all,filter);
  const count=(f:NeedFilter)=>filterPatientNeeds(all,f).length;
  return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
    <FlatList
      data={selected} keyExtractor={n=>n.id}
      initialNumToRender={8} maxToRenderPerBatch={8}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>reload(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={{gap:Spacing.three,marginBottom:Spacing.three}}>
        <Header title="Mes demandes" subtitle="Suivez vos besoins médicaux et les propositions."/>
        <Link href="/patient/besoins/nouveau" asChild>
          <Pressable accessibilityRole="link" style={[styles.create,{backgroundColor:theme.primary}]}>
            <ThemedText style={{color:theme.onPrimary,fontWeight:'700'}}>Publier un besoin médical</ThemedText>
          </Pressable>
        </Link>
        {actionError?<ThemedText themeColor="danger" accessibilityRole="alert">{actionError}</ThemedText>:null}
        {state.status==='success'?<View style={styles.stats}>
          {([['En cours',count('active')],['Propositions',filterPatientNeeds(all,'active').reduce((s,n)=>s+n.interested,0)],
            ['Confirmées',count('confirmed')],['Clôturées',count('closed')]] as const).map(([label,n])=>
            <Card key={label} style={styles.metric}>
              <ThemedText type="subtitle" themeColor="primary">{n}</ThemedText>
              <ThemedText type="small">{label}</ThemedText>
            </Card>
          )}
        </View>:null}
        <ThemedText type="smallBold">Filtrer les demandes</ThemedText>
        <View style={styles.filters}>{FILTERS.map(opt=>
          <Pressable key={opt.value} accessibilityRole="radio" accessibilityLabel={opt.label}
            accessibilityState={{selected:filter===opt.value}} onPress={()=>setFilter(opt.value)}
            style={[styles.chip,{backgroundColor:filter===opt.value?theme.infoSurface:theme.backgroundElement,
              borderColor:filter===opt.value?theme.primary:theme.border}]}>
            <ThemedText type="smallBold">{opt.label}{state.status==='success'?` (${count(opt.value)})`:''}</ThemedText>
          </Pressable>)}</View>
      </View>}
      renderItem={({item})=><Card>
        <Badge tone="info" label={NEED_STATUS_LABELS[item.status]}/>
        <ThemedText type="subtitle">{item.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.specialty} · {item.mode==='domicile'?'À domicile':'Téléconsultation'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{item.interested} médecin(s) intéressé(s)</ThemedText>
        <Link href={{pathname:'/patient/demandes/[id]',params:{id:item.id}}} asChild>
          <Pressable style={[styles.link,{backgroundColor:theme.infoSurface}]} accessibilityRole="link">
            <ThemedText themeColor="primary" type="smallBold">Consulter la demande</ThemedText>
          </Pressable>
        </Link>
        {canCloseNeed(item.status)?<Button label="Clôturer" variant="outline"
          disabled={busy} onPress={()=>setConfirm({id:item.id,action:'close'})}/>:null}
        {canDeleteNeed(item.status)?<Button label="Supprimer le brouillon" variant="danger"
          disabled={busy} onPress={()=>setConfirm({id:item.id,action:'delete'})}/>:null}
      </Card>}
      ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
      ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des demandes…" />
        :state.status==='error'?<ErrorState title="Demandes indisponibles"
          description="Impossible de récupérer vos demandes." onRetry={()=>reload()}/>
        :<EmptyState title="Aucune demande dans cette catégorie"
          description="Vous pourrez retrouver vos demandes ici." />}
    />
    <Modal visible={!!confirm} title={confirm?.action==='delete'?'Supprimer ce brouillon ?':'Clôturer cette demande ?'}
      description={confirm?.action==='delete'?'Suppression définitive : cette action est irréversible.'
        :'Les médecins ne pourront plus proposer leurs services. Cette action est irréversible.'}
      onClose={()=>{if(!busy)setConfirm(null);}} busy={busy}
      confirmLabel={confirm?.action==='delete'?'Supprimer définitivement':'Clôturer'}
      onConfirm={()=>{void act();}}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  list:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:100},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  metric:{flexBasis:125,flexGrow:1},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  chip:{padding:Spacing.two,borderWidth:1,borderRadius:Radius.pill,minHeight:MinimumTouchTarget,justifyContent:'center'},
  create:{minHeight:MinimumTouchTarget,alignItems:'center',justifyContent:'center',borderRadius:Radius.large},
  link:{minHeight:MinimumTouchTarget,alignItems:'center',justifyContent:'center',borderRadius:Radius.large},
});
