import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input, SelectField, ToggleField } from '@/components/ui/form-fields';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { ThemedText } from '@/components/themed-text';
import { LogoutButton } from '@/components/auth/logout-button';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing } from '@/constants/theme';
import { adminApi } from '@/services/admin';
import { authApi } from '@/services/auth';
import type { AdminAccount, AccountStatus, DoctorVerificationStatus, Page } from '@/types/domain';
import {
 ADMIN_PAGE_SIZE, ADMIN_ACCOUNT_STATUSES, ADMIN_VERIFICATION_STATUSES,
 ADMIN_STATUS_LABELS, ADMIN_VERIFICATION_LABELS, adminActionWarning,
 adminError, actionableAdminChange, normalizeAccountStatus, parseAdminPage,
 validAdminSearch, type AdminAction, type ManagedRole,
} from '@/features/admin/admin-model';

type ListState={status:'loading'|'error'|'forbidden';message?:string}
 |{status:'success';value:Page<AdminAccount>};
type EditType='status'|'verification';
type Edit={account:AdminAccount;type:EditType};
export default function AdminHome(){
 const theme=useTheme(),session=useNavigationSession(s=>s.session);
 const authorized=session.status==='authenticated'&&session.role==='admin'&&session.accountStatus==='active';
 const [state,setState]=useState<ListState>({status:'loading'});
 const [role,setRole]=useState<ManagedRole>('patient');
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const [edit,setEdit]=useState<Edit|null>(null);
 const [status,setStatus]=useState<AccountStatus>('pending');
 const [emailVerified,setEmailVerified]=useState(false);
 const [verification,setVerification]=useState<DoctorVerificationStatus>('pending');
 const [pending,setPending]=useState<AdminAction|null>(null);
 const [saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[searchError,setSearchError]=useState('');
 const controller=useRef<AbortController|null>(null),seq=useRef(0),focus=useRef(0),lock=useRef(false);
 const load=useCallback((pull=false)=>{
  if(!authorized){setState({status:'forbidden'});return;}
  controller.current?.abort();
  const ac=new AbortController();controller.current=ac;const serial=++seq.current,scope=focus.current;
  if(pull)setRefreshing(true);else setState({status:'loading'});
  void (async()=>{
   try{
    // Fresh backend auth/role check before every admin listing, in addition to NestJS guards.
    const me=await authApi.profile(ac.signal);
    if(me.user.role!=='admin'||me.user.status!=='active')throw {status:403};
    const raw=await adminApi.accounts(role,page,ADMIN_PAGE_SIZE,query,ac.signal);
    const value=parseAdminPage(raw,role);
    if(ac.signal.aborted||seq.current!==serial||focus.current!==scope)return;
    setState({status:'success',value});
   }catch(e){
    if(ac.signal.aborted||seq.current!==serial||focus.current!==scope)return;
    const forbidden=(e as {status?:number})?.status===401||(e as {status?:number})?.status===403;
    setState({status:forbidden?'forbidden':'error',message:adminError(e)});
   }finally{
    if(!ac.signal.aborted&&seq.current===serial&&focus.current===scope)setRefreshing(false);
   }
  })();
 },[authorized,role,page,query]);
 useFocusEffect(useCallback(()=>{
  focus.current++;
  if(authorized)load();else setState({status:'forbidden'});
  return()=>{
   focus.current++;seq.current++;controller.current?.abort();
   setState({status:'loading'});setEdit(null);setPending(null);setError('');setNotice('');
   setSearchError('');
   setSaving(false);setRefreshing(false);
  };
 },[authorized,load]));
 function chooseRole(value:string){
  if(value!=='patient'&&value!=='doctor')return;
  setRole(value);setPage(1);setEdit(null);setPending(null);setError('');setNotice('');
 }
 function applySearch(){
  if(!validAdminSearch(search)){setSearchError('Recherche limitée à 100 caractères.');return;}
  setSearchError('');setQuery(search.trim());setPage(1);
  if(query===search.trim()&&page===1)load(true);
 }
 function begin(account:AdminAccount,type:EditType){
  if(lock.current||state.status!=='success')return;
  if(account.role!==role||!state.value.items.some(a=>a.id===account.id))return;
  setEdit({account,type});setPending(null);setError('');setNotice('');
  setStatus(normalizeAccountStatus(account));
  setEmailVerified(account.emailVerified);
  setVerification(account.verificationStatus??'pending');
 }
 function proposedAction():AdminAction|null{
  if(!edit)return null;
  if(edit.type==='status')return {type:'status',account:edit.account,value:status};
  return edit.account.role==='patient'
   ?{type:'patient-verification',account:edit.account,value:emailVerified}
   :{type:'doctor-verification',account:edit.account,value:verification};
 }
 function reviewChange(){
  const action=proposedAction();
  if(!action||!actionableAdminChange(action)){setError('Sélectionnez une valeur différente et autorisée.');return;}
  if(state.status!=='success'||!state.value.items.some(a=>a.id===action.account.id)){
   setError('Ce compte n’appartient plus à la page courante. Actualisez.');return;
  }
  setPending(action);setEdit(null);setError('');
 }
 async function confirm(){
  const action=pending;
  if(!action||lock.current||!authorized||state.status!=='success')return;
  if(!actionableAdminChange(action)||!state.value.items.some(a=>a.id===action.account.id))return;
  const lifetime=focus.current;lock.current=true;setSaving(true);setError('');setNotice('');
  try{
   if(action.type==='status'){
    const result=await adminApi.updateStatus(action.account.id,action.value);
    if(result.id!==action.account.id||result.status!==action.value)throw Error('Unexpected status response');
   }else if(action.type==='patient-verification'){
    const result=await adminApi.verification(action.account.id,{emailVerified:action.value});
    if(result.id!==action.account.id||result.emailVerified!==action.value)throw Error('Unexpected verification response');
   }else{
    const result=await adminApi.verification(action.account.id,{verificationStatus:action.value});
    if(result.id!==action.account.id||result.verificationStatus!==action.value)throw Error('Unexpected verification response');
   }
   if(lifetime!==focus.current)return;
   setPending(null);setNotice('Modification confirmée par le serveur. Liste actualisée.');
   load(true);
  }catch(e){
   if(lifetime!==focus.current)return;
   setPending(null);setError(adminError(e));
   // A 503 may mean Firestore was written before Firebase Auth synchronisation failed.
   // Always read again; never retry the sensitive PATCH automatically.
   load(true);
  }finally{lock.current=false;if(lifetime===focus.current)setSaving(false);}
 }
 if(!authorized)return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <ErrorState title="Administration interdite" description="Un compte administrateur actif et vérifié par le serveur est requis."/>
 </SafeAreaView>;
 const result=state.status==='success'?state.value:null;
 return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
  <FlatList data={result?.items??[]} keyExtractor={item=>item.id} initialNumToRender={8} maxToRenderPerBatch={8}
   contentContainerStyle={styles.content}
   ItemSeparatorComponent={()=><View style={{height:Spacing.three}}/>}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
    colors={[theme.primary]} tintColor={theme.primary}/>}
   ListHeaderComponent={<View style={styles.header}>
    <Header title="Administration Medilink" subtitle="Gestion sécurisée des comptes patients et médecins."/>
    <Card>
     <ThemedText type="small" themeColor="textSecondary">
      Les opérations sont contrôlées par FirebaseAuthGuard et AdminGuard côté serveur.
      Les changements sensibles exigent une confirmation individuelle.
     </ThemedText>
     <ThemedText type="smallBold">Création d’administrateurs</ThemedText>
     <ThemedText type="small" themeColor="textSecondary">
      Réservée à l’administration web : manipulation d’un mot de passe provisoire
      et transmission sécurisée des identifiants.
     </ThemedText>
    </Card>
    {notice?<ThemedText themeColor="success" accessibilityRole="alert">{notice}</ThemedText>:null}
    {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
    <SelectField label="Type de comptes" value={role} onChange={chooseRole}
     options={[{value:'patient',label:'Patients'},{value:'doctor',label:'Médecins'}]}/>
    <Input label="Rechercher un compte" placeholder="Nom, e-mail ou téléphone"
     value={search} maxLength={100} onChangeText={setSearch} error={searchError}
     autoCapitalize="none" returnKeyType="search" onSubmitEditing={applySearch}/>
    <Button label="Rechercher" variant="outline" onPress={applySearch}/>
    {result?<ThemedText type="small" themeColor="textSecondary">
      {result.total} compte(s) trouvé(s) · page {result.page}{result.totalPages?' / '+result.totalPages:''}
     </ThemedText>:null}
    {state.status==='forbidden'?<ErrorState title="Accès administrateur révoqué"
      description="Le serveur refuse l’accès à cette opération. Reconnectez-vous avec un compte autorisé."/>:null}
   </View>}
   renderItem={({item})=><Card>
    <View style={styles.profile}>
     <Avatar name={[item.firstName,item.lastName].join(' ')||'Compte'} size={46}/>
     <View style={{flex:1,gap:Spacing.two}}>
      <ThemedText type="smallBold">{[item.firstName,item.lastName].filter(Boolean).join(' ')||'Nom non renseigné'}</ThemedText>
      {item.email?<ThemedText type="small" themeColor="textSecondary">{item.email}</ThemedText>:null}
      {item.phone?<ThemedText type="small" themeColor="textSecondary">{item.phone}</ThemedText>:null}
     </View>
    </View>
    <Badge label={ADMIN_STATUS_LABELS[normalizeAccountStatus(item)]}
     tone={normalizeAccountStatus(item)==='active'?'success':
      normalizeAccountStatus(item)==='pending'?'warning':'danger'}/>
    {item.role==='doctor'?<ThemedText type="small">
      Vérification professionnelle : {item.verificationStatus?ADMIN_VERIFICATION_LABELS[item.verificationStatus]:'Non disponible'}
     </ThemedText>:<ThemedText type="small">
      E-mail : {item.emailVerified?'vérifié':'non vérifié'}
     </ThemedText>}
    {item.createdAt?<ThemedText type="small" themeColor="textSecondary">
      Créé le {Number.isFinite(Date.parse(item.createdAt))?
       new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(item.createdAt)):'date indisponible'}
     </ThemedText>:null}
    <View style={styles.buttons}>
     <View style={{flex:1}}>
      <Button label="Modifier le statut" variant="outline" disabled={saving} onPress={()=>begin(item,'status')}/>
     </View>
     <View style={{flex:1}}>
      <Button label={item.role==='doctor'?'Vérification médecin':'Vérification e-mail'}
       variant="outline" disabled={saving||item.role==='doctor'&&!item.verificationStatus}
       onPress={()=>begin(item,'verification')}/>
     </View>
    </View>
   </Card>}
   ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des comptes administrés…"/>:
    state.status==='error'?<ErrorState title="Comptes indisponibles" description={state.message} onRetry={()=>load()}/>:
    state.status==='forbidden'?undefined:
    <EmptyState title="Aucun compte trouvé" description="Modifiez les filtres ou la recherche."/>}
   ListFooterComponent={result?<View style={styles.footer}>
    <View style={styles.buttons}>
     <Button label="Précédent" variant="outline" disabled={page<=1||saving} onPress={()=>setPage(p=>Math.max(1,p-1))}/>
     <Button label="Suivant" variant="outline" disabled={page>=result.totalPages||saving} onPress={()=>setPage(p=>p+1)}/>
    </View>
    <LogoutButton/>
   </View>:undefined}
  />
  <Modal visible={!!edit} title={edit?.type==='status'?'Modifier le statut du compte':'Modifier la vérification'}
   description="Vous préparez une opération administrative. Une seconde confirmation sera nécessaire."
   onClose={()=>{if(!saving)setEdit(null);}}
   onConfirm={reviewChange} confirmLabel="Examiner la modification" busy={saving}>
   {edit?.type==='status'?<SelectField label="Nouveau statut" value={status}
    onChange={value=>setStatus(value as AccountStatus)}
    options={ADMIN_ACCOUNT_STATUSES.map(value=>({value,label:ADMIN_STATUS_LABELS[value]}))}/>:
    edit?.account.role==='patient'?<ToggleField label="E-mail vérifié"
     description="Synchronise Firebase Auth et la fiche utilisateur."
     value={emailVerified} onValueChange={setEmailVerified}/>:
    <SelectField label="Vérification professionnelle" value={verification}
     onChange={value=>setVerification(value as DoctorVerificationStatus)}
     options={ADMIN_VERIFICATION_STATUSES.map(value=>({value,label:ADMIN_VERIFICATION_LABELS[value]}))}/>}
  </Modal>
  <Modal visible={!!pending} title="Confirmer cette opération sensible"
   description={pending?adminActionWarning(pending):undefined}
   confirmLabel="Confirmer la modification" busy={saving}
   onClose={()=>{if(!saving)setPending(null);}}
   onConfirm={()=>{void confirm();}}/>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:130},
 header:{gap:Spacing.three,marginBottom:Spacing.three},
 profile:{flexDirection:'row',alignItems:'center',gap:Spacing.three},
 buttons:{flexDirection:'row',gap:Spacing.two,flexWrap:'wrap'},
 footer:{gap:Spacing.three,marginTop:Spacing.four},
});
