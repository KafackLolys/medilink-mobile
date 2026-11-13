import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Badge, Header } from '@/components/ui/primitives';
import { Input, SelectField } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { needsApi } from '@/services/needs';
import type { DoctorNeed, ConsultationMode } from '@/types/domain';
import { useVerifiedDoctorAccess } from '@/features/doctor/use-verified-doctor-access';
import {
  parseDoctorNeedFilters, parseDoctorNeedsPage, PRIORITY_LABELS, doctorNeedsError,
  type NeedFilters, type DoctorNeedPriority,
} from '@/features/doctor/doctor-needs';

type State = {status:'loading'|'error';message?:string} |
  {status:'success'; items:DoctorNeed[];specialties:string[];total:number;page:number;totalPages:number};
const size=10;
export default function DoctorNeedsScreen() {
  const theme=useTheme(), {access,refresh:refreshAccess}=useVerifiedDoctorAccess();
  const [state,setState]=useState<State>({status:'loading'});
  const [q,setQ]=useState(''),[specialty,setSpecialty]=useState('');
  const [priority,setPriority]=useState(''),[mode,setMode]=useState('');
  const [filters,setFilters]=useState<NeedFilters>({});
  const [page,setPage]=useState(1),[error,setError]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const request=useRef<AbortController|null>(null),seq=useRef(0);

  const load=useCallback((pull=false)=>{
    request.current?.abort();const ac=new AbortController();request.current=ac;const id=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    void needsApi.doctor({...filters,page,pageSize:size},ac.signal).then(raw=>{
      const result=parseDoctorNeedsPage(raw);
      if(ac.signal.aborted||id!==seq.current)return;
      setState({status:'success',items:result.items,specialties:result.specialties,
        total:result.total,page:result.page,totalPages:result.totalPages});
    }).catch(cause=>{
      if(ac.signal.aborted||id!==seq.current)return;
      setState({status:'error',message:doctorNeedsError(cause)});
    }).finally(()=>{if(!ac.signal.aborted&&id===seq.current)setRefreshing(false);});
  },[filters,page]);
  useFocusEffect(useCallback(()=>{
    if(access.status==='allowed')load();
    else {request.current?.abort();seq.current++;setState({status:'loading'});}
    return ()=>{request.current?.abort();seq.current++;setState({status:'loading'});};
  },[access.status,load]));

  function apply(){
    try{
      const next=parseDoctorNeedFilters({q,specialty,
        priority:priority as DoctorNeedPriority|undefined,
        mode:mode as ConsultationMode|undefined});
      setError('');setPage(1);setFilters(next);
      if(page===1&&JSON.stringify(filters)===JSON.stringify(next))load(true);
    }catch(e){setError(e instanceof Error?e.message:'Filtres invalides.');}
  }
  function reset(){
    setQ('');setSpecialty('');setPriority('');setMode('');setError('');
    setPage(1);setFilters({});
    if(page===1&&!Object.keys(filters).length)load(true);
  }
  const allowed=access.status==='allowed';
  const data=state.status==='success'?state.items:[];
  return <SafeAreaView style={[styles.root,{backgroundColor:theme.background}]} edges={['top','left','right']}>
    {access.status==='loading'?<LoadingState label="Vérification du compte médecin…" />:
      access.status!=='allowed'?<View style={styles.guard}>
        <ErrorState title={access.status==='denied'?'Validation professionnelle requise':'Profil indisponible'}
          description={access.message} onRetry={refreshAccess}/>
        <Link href="/medecin/profil"><ThemedText type="linkPrimary">Consulter mon profil professionnel</ThemedText></Link>
      </View>:
      <FlatList data={data} keyExtractor={item=>item.id} initialNumToRender={8} maxToRenderPerBatch={8}
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={()=>load(true)} colors={[theme.primary]} tintColor={theme.primary}/>}
        ListHeaderComponent={<View style={styles.stack}>
          <Header title="Besoins des patients"
            subtitle="Demandes accessibles aux médecins vérifiés. Les adresses personnelles ne sont pas partagées."/>
          <Card>
            <Input label="Recherche (besoin, ville, quartier)" value={q} onChangeText={setQ}
              maxLength={100} onSubmitEditing={apply} returnKeyType="search"/>
            <SelectField label="Spécialité" value={specialty} onChange={setSpecialty}
              options={[{value:'',label:'Toutes'},...
                (state.status==='success'?state.specialties:[]).map(s=>({value:s,label:s}))]}/>
            <SelectField label="Priorité" value={priority} onChange={setPriority}
              options={[{value:'',label:'Toutes'},
                ...Object.entries(PRIORITY_LABELS).map(([value,label])=>({value,label}))]}/>
            <SelectField label="Consultation" value={mode} onChange={setMode}
              options={[{value:'',label:'Tous les modes'},
                {value:'home',label:'À domicile'},{value:'teleconsultation',label:'Téléconsultation'}]}/>
            {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
            <View style={styles.actions}>
              <View style={{flex:1}}><Button label="Rechercher" onPress={apply}/></View>
              <View style={{flex:1}}><Button label="Effacer" variant="outline" onPress={reset}/></View>
            </View>
          </Card>
          {state.status==='success'?<ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">
            {state.total} {state.total===1?'demande accessible':'demandes accessibles'}
          </ThemedText>:null}
        </View>}
        renderItem={({item})=><Card>
          <Badge label={'Priorité '+PRIORITY_LABELS[item.priority].toLowerCase()}
            tone={item.priority==='emergency'?'danger':item.priority==='urgent'?'warning':'success'}/>
          <ThemedText type="subtitle">{item.title}</ThemedText>
          <ThemedText themeColor="textSecondary" numberOfLines={3}>{item.summary}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.specialty} · {item.city}, {item.district}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.mode==='home'?'À domicile':'Téléconsultation'} · Documents : {item.documentsCount}
          </ThemedText>
          <Link href={{pathname:'/medecin/besoins/[id]',params:{id:item.id}}} asChild>
            <Pressable accessibilityRole="link" style={[styles.link,{backgroundColor:theme.infoSurface}]}>
              <ThemedText type="smallBold" themeColor="primary">Consulter la demande ›</ThemedText>
            </Pressable>
          </Link>
        </Card>}
        ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des besoins…" />:
          state.status==='error'?<ErrorState title="Demandes indisponibles"
            description={state.message} onRetry={()=>load()}/>:
          <EmptyState title="Aucune demande disponible"
            description="Aucune demande publiée ne correspond aux critères sélectionnés."/>}
        ListFooterComponent={state.status==='success'&&state.totalPages>1?<View style={styles.pager}>
          <Button label="Précédent" variant="outline" disabled={page<=1}
            onPress={()=>setPage(v=>Math.max(1,v-1))}/>
          <ThemedText type="small" themeColor="textSecondary">
            Page {state.page} / {state.totalPages}
          </ThemedText>
          <Button label="Suivant" variant="outline" disabled={page>=state.totalPages}
            onPress={()=>setPage(v=>v+1)}/>
        </View>:undefined}
      />}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1},content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:120},
  stack:{gap:Spacing.three,marginBottom:Spacing.three},actions:{flexDirection:'row',gap:Spacing.two},
  pager:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.two,marginTop:Spacing.four},
  link:{minHeight:MinimumTouchTarget,borderRadius:Radius.large,justifyContent:'center',alignItems:'center'},
  guard:{padding:Spacing.three,gap:Spacing.three},
});
