import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, RefreshControl, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Badge, Header } from '@/components/ui/primitives';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing } from '@/constants/theme';
import { notificationsApi } from '@/services/notifications';
import { destinationForNotification, parseNotificationPage, notificationError, canUseNotifications, NOTIFICATION_PAGE_SIZE } from '@/features/notifications/notification-model';
import type { NotificationPage, UserNotification } from '@/types/domain';

type State={status:'loading'|'error';message?:string}|{status:'success';value:NotificationPage};
export function NotificationCenter({role}:{role:'patient'|'doctor'}){
 const theme=useTheme(),router=useRouter(),session=useNavigationSession(s=>s.session);
 const [state,setState]=useState<State>({status:'loading'}),[page,setPage]=useState(1);
 const [refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),sequence=useRef(0),mutation=useRef(false),lifecycle=useRef(0);
 const allowed=session.status==='authenticated'&&session.role===role&&canUseNotifications(session.role);
 const load=useCallback((pull=false)=>{
   controller.current?.abort();const ac=new AbortController();controller.current=ac;const version=++sequence.current;
   if(pull)setRefreshing(true);else setState({status:'loading'});
   void notificationsApi.list(page,NOTIFICATION_PAGE_SIZE,ac.signal).then(raw=>{
     const value=parseNotificationPage(raw);
     if(!ac.signal.aborted&&version===sequence.current)setState({status:'success',value});
   }).catch(cause=>{
     if(!ac.signal.aborted&&version===sequence.current)setState({status:'error',message:notificationError(cause)});
   }).finally(()=>{if(!ac.signal.aborted&&version===sequence.current)setRefreshing(false);});
 },[page]);
 useFocusEffect(useCallback(()=>{
   lifecycle.current++;
   if(allowed)load();else setState({status:'loading'});
   return()=>{lifecycle.current++;sequence.current++;controller.current?.abort();setState({status:'loading'});setError('');setBusy(null);setRefreshing(false);};
 },[allowed,load]));
 async function markRead(item:UserNotification,open=false){
   if(mutation.current||!allowed)return;
   const epoch=lifecycle.current;
   mutation.current=true;setBusy(item.id);setError('');
   try{
     if(!item.readAt){
       const response=await notificationsApi.read(item.id);
       if(response.id!==item.id||!response.readAt)throw Error('Réponse invalide');
     }
     if(epoch!==lifecycle.current)return;
     // Read-after-write, no optimistic change or locally invented unread count.
     load(true);
     const destination=destinationForNotification(item.targetUrl,role);
     if(open&&destination)router.push(destination as never);
     else if(open&&!destination)setError('Cette notification ne contient pas de destination autorisée.');
   }catch(e){if(epoch===lifecycle.current)setError(notificationError(e));}
   finally{mutation.current=false;if(epoch===lifecycle.current)setBusy(null);}
 }
 async function markAll(){
   if(mutation.current||!allowed)return;
   mutation.current=true;const epoch=lifecycle.current;setBusy('all');setError('');
   try{await notificationsApi.readAll();if(epoch===lifecycle.current)load(true);}
   catch(e){if(epoch===lifecycle.current)setError(notificationError(e));}
   finally{mutation.current=false;if(epoch===lifecycle.current)setBusy(null);}
 }
 if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}><ErrorState title="Accès aux notifications refusé" /></SafeAreaView>;
 const value=state.status==='success'?state.value:null;
 return <SafeAreaView style={{flex:1,backgroundColor:theme.background}} edges={['top','left','right']}>
   <FlatList data={value?.items??[]} keyExtractor={x=>x.id} initialNumToRender={10}
     contentContainerStyle={styles.content} ItemSeparatorComponent={()=><View style={{height:Spacing.two}}/>}
     refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} colors={[theme.primary]} tintColor={theme.primary}/>}
     ListHeaderComponent={<View style={styles.header}>
       <Header title="Notifications" subtitle="Événements et mises à jour associés à votre compte Medilink."/>
       {value?<View style={styles.summary}>
         <Badge label={value.unreadCount+' non lue(s)'} tone={value.unreadCount?'info':'neutral'}/>
         <Button variant="outline" label="Tout marquer comme lu" loading={busy==='all'} disabled={value.unreadCount===0||busy!==null} onPress={()=>{void markAll();}}/>
       </View>:null}
       {error?<ThemedText themeColor="danger" accessibilityRole="alert">{error}</ThemedText>:null}
     </View>}
     renderItem={({item})=><Card>
       <View style={styles.summary}>
         <ThemedText type="smallBold" style={{flex:1}}>{item.title}</ThemedText>
         {!item.readAt?<Badge tone="info" label="Non lue"/>:null}
       </View>
       <ThemedText>{item.body}</ThemedText>
       <ThemedText type="small" themeColor="textSecondary">
         {Number.isFinite(Date.parse(item.createdAt))?new Date(item.createdAt).toLocaleString('fr-FR'):'Date indisponible'}
       </ThemedText>
       {destinationForNotification(item.targetUrl,role)?
         <Button label="Ouvrir" variant="outline" disabled={busy!==null} onPress={()=>{void markRead(item,true);}}/>:null}
       {!item.readAt?<Button label="Marquer comme lu" variant="ghost" disabled={busy!==null}
         onPress={()=>{void markRead(item);}}/>:null}
     </Card>}
     ListEmptyComponent={state.status==='loading'?<LoadingState label="Chargement des notifications…"/>:
       state.status==='error'?<ErrorState title="Notifications indisponibles" description={state.message} onRetry={()=>load()}/>:
       <EmptyState title="Aucune notification" description="Vous retrouverez ici vos nouvelles notifications."/>}
     ListFooterComponent={value&&value.totalPages>1?<View style={styles.pager}>
       <Button label="Précédent" variant="outline" disabled={page<=1} onPress={()=>setPage(x=>Math.max(1,x-1))}/>
       <ThemedText type="small">Page {value.page} / {value.totalPages}</ThemedText>
       <Button label="Suivant" variant="outline" disabled={page>=value.totalPages} onPress={()=>setPage(x=>x+1)}/>
     </View>:null}
   />
 </SafeAreaView>;
}
const styles=StyleSheet.create({content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:110},
 header:{gap:Spacing.three,marginBottom:Spacing.three},summary:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.two,flexWrap:'wrap'},
 pager:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.two,marginTop:Spacing.four}});
