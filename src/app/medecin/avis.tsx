import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, Header } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { doctorsApi } from '@/services/doctors';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { parseDoctorReviewSummary, reviewError, REVIEW_RATINGS, type DoctorReviewSummary } from '@/features/reviews/reviews-model';

type State={status:'loading'|'error';message?:string}|{status:'success';value:DoctorReviewSummary};
export default function DoctorReviewsScreen(){
 const theme=useTheme(),session=useNavigationSession(s=>s.session);
 const allowed=session.status==='authenticated'&&session.role==='doctor';
 const [state,setState]=useState<State>({status:'loading'});
 const [filter,setFilter]=useState<number|null>(null),[refreshing,setRefreshing]=useState(false);
 const request=useRef<AbortController|null>(null),sequence=useRef(0);
 const load=useCallback((pull=false)=>{
  request.current?.abort();const ac=new AbortController();request.current=ac;const token=++sequence.current;
  if(pull)setRefreshing(true);else setState({status:'loading'});
  void doctorsApi.reviews(ac.signal).then(raw=>{
   const value=parseDoctorReviewSummary(raw);
   if(!ac.signal.aborted&&sequence.current===token)setState({status:'success',value});
  }).catch(e=>{
   if(!ac.signal.aborted&&sequence.current===token)setState({status:'error',message:reviewError(e)});
  }).finally(()=>{if(!ac.signal.aborted&&sequence.current===token)setRefreshing(false);});
 },[]);
 useFocusEffect(useCallback(()=>{
  if(allowed)load();
  return()=>{sequence.current++;request.current?.abort();setState({status:'loading'});setRefreshing(false);setFilter(null);};
 },[allowed,load]));
 if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
  <ErrorState title="Accès aux avis refusé" description="Connectez-vous avec un compte médecin autorisé."/>
 </SafeAreaView>;
 const summary=state.status==='success'?state.value:null;
 const shown=summary?.items.filter(item=>filter===null||item.rating===filter)??[];
 return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <FlatList data={shown} keyExtractor={x=>x.id} initialNumToRender={10} maxToRenderPerBatch={10}
   contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} colors={[theme.primary]} tintColor={theme.primary}/>}
   ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
   ListHeaderComponent={<View style={styles.header}>
    <Header title="Avis des patients" subtitle="Évaluations publiées après des consultations réellement terminées."/>
    {summary?<Card>
      <ThemedText type="subtitle">{summary.rating===null?'Pas encore de note':summary.rating.toFixed(1).replace('.',',')+'/5'}</ThemedText>
      <ThemedText themeColor="textSecondary">{summary.total} {summary.total===1?'avis':'avis'} reçus</ThemedText>
      {REVIEW_RATINGS.map(value=><View key={value} style={styles.distribution}>
       <ThemedText type="small">{value}/5</ThemedText>
       <View style={[styles.track,{backgroundColor:theme.border}]}>
        <View style={[styles.fill,{backgroundColor:theme.primary,width:(summary.total?summary.distribution[value]/summary.total*100:0)+'%'}]}/>
       </View>
       <ThemedText type="small">{summary.distribution[value]}</ThemedText>
      </View>)}
      <ThemedText type="small" themeColor="textSecondary">
       Les scores et la répartition proviennent uniquement de GET /doctors/me/reviews.
       Le nom complet des patients n’est pas exposé.
      </ThemedText>
     </Card>:null}
    <ThemedText type="smallBold">Filtrer par note</ThemedText>
    <View style={styles.filters}>
     {[null,...REVIEW_RATINGS].map(value=><Pressable key={value??'all'}
       accessibilityRole="radio" accessibilityState={{selected:filter===value}}
       onPress={()=>setFilter(value)}
       style={[styles.chip,{borderColor:filter===value?theme.primary:theme.border,
        backgroundColor:filter===value?theme.infoSurface:theme.backgroundElement}]}>
       <ThemedText type="smallBold">{value===null?'Toutes':value+'/5'}</ThemedText>
      </Pressable>)}
    </View>
   </View>}
   renderItem={({item})=><Card>
    <View style={styles.distribution}>
     <ThemedText type="smallBold" style={{flex:1}}>{item.patientLabel}</ThemedText>
     <Badge tone="info" label={item.rating+'/5'}/>
    </View>
    <ThemedText type="small" themeColor="textSecondary">
     {new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(item.createdAt))}
    </ThemedText>
    {item.comment?<ThemedText>{item.comment}</ThemedText>:
     <ThemedText type="small" themeColor="textSecondary">Aucun commentaire.</ThemedText>}
   </Card>}
   ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des évaluations…"/>:
    state.status==='error'?<ErrorState title="Avis indisponibles" description={state.message} onRetry={()=>load()}/>:
    <EmptyState title="Aucun avis correspondant" description="Aucun avis réel ne correspond à la note sélectionnée."/>}
  />
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:120},
 header:{gap:Spacing.three,marginBottom:Spacing.three},
 distribution:{flexDirection:'row',alignItems:'center',gap:Spacing.two},
 track:{height:9,flex:1,borderRadius:Radius.pill,overflow:'hidden'},
 fill:{height:'100%',borderRadius:Radius.pill},
 filters:{flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
 chip:{minHeight:MinimumTouchTarget,paddingHorizontal:Spacing.three,borderRadius:Radius.large,borderWidth:1,justifyContent:'center'},
});
