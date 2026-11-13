import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  BackHandler, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet,
  TextInput, View, type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { authApi } from '@/services/auth';
import { messagesApi } from '@/services/messages';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import type { Conversation, ConversationMessage } from '@/types/domain';
import {
  canUseMessaging, matchesMessagingScope, mergeMessages, messageDate,
  messagingError, parseConversations, parseMessages, requireConversation, validateMessage,
  type ConversationScope, type MessagingRole,
} from '@/features/messaging/messaging-model';

type ListState={status:'loading'|'error';error?:string}|{status:'success';items:Conversation[]};
type ThreadState={status:'idle'|'loading'|'error';error?:string}|{status:'success';items:ConversationMessage[]};
type SendState='idle'|'sending';

export function MessagingScreen({role}:{role:MessagingRole}){
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const params=useLocalSearchParams<{conversation?:string}>();
  const requested=typeof params.conversation==='string'?params.conversation:'';
  const [list,setList]=useState<ListState>({status:'loading'});
  const [thread,setThread]=useState<ThreadState>({status:'idle'});
  const [selected,setSelected]=useState('');
  const [currentUserId,setCurrentUserId]=useState<string|null>(null);
  const [draft,setDraft]=useState(''),[sendState,setSendState]=useState<SendState>('idle');
  const [sendError,setSendError]=useState(''),[refreshing,setRefreshing]=useState(false);
  const lifecycle=useRef(0),listSeq=useRef(0),threadSeq=useRef(0);
  const scope=useRef<ConversationScope|null>(null),conversationRef=useRef('');
  const listAbort=useRef<AbortController|null>(null),threadAbort=useRef<AbortController|null>(null);
  const sending=useRef<{epoch:number;id:string}|null>(null),listRef=useRef<FlatList<ConversationMessage>|null>(null);
  const allowed=session.status==='authenticated'&&session.role===role&&canUseMessaging(session.role);

  function purge(){
    lifecycle.current++;
    scope.current=null;conversationRef.current='';sending.current=null;
    listAbort.current?.abort();threadAbort.current?.abort();
    listSeq.current++;threadSeq.current++;
    setList({status:'loading'});setThread({status:'idle'});
    setSelected('');setCurrentUserId(null);setDraft('');setSendError('');
    setSendState('idle');setRefreshing(false);
  }

  const loadList=useCallback(async(pull=false)=>{
    if(!scope.current)return;
    listAbort.current?.abort();
    const ac=new AbortController();listAbort.current=ac;
    const epoch=listSeq.current+1;listSeq.current=epoch;
    const expected={...scope.current};
    if(pull)setRefreshing(true);
    else setList(old=>old.status==='success'?old:{status:'loading'});
    try{
      const response=await messagesApi.list(ac.signal);
      const conversations=parseConversations(response);
      if(ac.signal.aborted||listSeq.current!==epoch||!matchesMessagingScope(expected,scope.current))return;
      setList({status:'success',items:conversations});
      const old=conversationRef.current;
      const desired=requireConversation(conversations,old)?old:
        requireConversation(conversations,requested)?requested:'';
      if(desired!==old){
        conversationRef.current=desired;
        setSelected(desired);setThread({status:'idle'});
        setDraft('');setSendError('');
        threadAbort.current?.abort();threadSeq.current++;
      }
    }catch(e){
      if(ac.signal.aborted||listSeq.current!==epoch||!matchesMessagingScope(expected,scope.current))return;
      setList({status:'error',error:messagingError(e)});
      conversationRef.current='';setSelected('');setThread({status:'idle'});
      setDraft('');setSendError('');threadAbort.current?.abort();threadSeq.current++;
    }finally{
      if(!ac.signal.aborted&&listSeq.current===epoch&&matchesMessagingScope(expected,scope.current))setRefreshing(false);
    }
  },[requested]);

  const loadThread=useCallback(async(id:string,showLoading=true)=>{
    if(!scope.current||!id)return;
    if(listRef.current===undefined)return;
    threadAbort.current?.abort();
    const ac=new AbortController();threadAbort.current=ac;
    const epoch=++threadSeq.current,expected={...scope.current};
    if(showLoading)setThread({status:'loading'});
    try{
      // The server repeats this access check on GET and marks received messages as read.
      const response=await messagesApi.messages(id,ac.signal);
      const items=parseMessages(response);
      if(ac.signal.aborted||epoch!==threadSeq.current||conversationRef.current!==id||
         !matchesMessagingScope(expected,scope.current))return;
      setThread(old=>({status:'success',items:old.status==='success'?mergeMessages(old.items,items):items}));
      // Update server-authored unread counts. No local fabricated read state.
      void loadList(true);
    }catch(e){
      if(ac.signal.aborted||epoch!==threadSeq.current||conversationRef.current!==id||
        !matchesMessagingScope(expected,scope.current))return;
      setThread({status:'error',error:messagingError(e)});
      if((e as {status?:number})?.status===403||(e as {status?:number})?.status===404){
        conversationRef.current='';setSelected('');setDraft('');void loadList(true);
      }
    }
  },[loadList]);

  useFocusEffect(useCallback(()=>{
    purge();
    if(!allowed)return()=>purge();
    const focusEpoch=lifecycle.current;
    const ac=new AbortController();
    void (async()=>{
      try{
        const response=await authApi.profile(ac.signal);
        const user=response.user;
        if(ac.signal.aborted||lifecycle.current!==focusEpoch)return;
        if(user.role!==role||!user.id)throw new Error('Accès refusé');
        const current={userId:user.id,role,epoch:focusEpoch} as ConversationScope;
        scope.current=current;
        setCurrentUserId(user.id);
        await loadList();
      }catch(e){
        if(ac.signal.aborted||lifecycle.current!==focusEpoch)return;
        setList({status:'error',error:messagingError(e)});
      }
    })();
    return()=>{ac.abort();purge();};
  },[allowed,role,loadList]));

  useEffect(()=>{
    if(!allowed||!selected||!scope.current)return;
    // The message list is reloaded after the conversation is selected.
    void loadThread(selected);
  },[allowed,selected,loadThread]);

  useEffect(()=>{
    if(!allowed||!scope.current)return;
    // HTTP polling only: no websocket, push subscription or fictitious realtime.
    const poll=setInterval(()=>{
      if(!scope.current||sending.current)return;
      if(conversationRef.current)void loadThread(conversationRef.current,false);
      else void loadList(true);
    },15000);
    return()=>clearInterval(poll);
  },[allowed,selected,loadList,loadThread]);

  function choose(id:string){
    const available=list.status==='success'&&requireConversation(list.items,id);
    if(!available||!scope.current)return;
    conversationRef.current=id;setSelected(id);setDraft('');setSendError('');setThread({status:'loading'});
  }
  function back(){
    conversationRef.current='';setSelected('');setDraft('');setSendError('');
    threadAbort.current?.abort();threadSeq.current++;setThread({status:'idle'});
  }

  useFocusEffect(useCallback(()=>{
    if(Platform.OS!=='android'||!selected)return;
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(!conversationRef.current)return false;
      back(); // Return to authorized conversation list, not out of the whole messaging section.
      return true;
    });
    return()=>subscription.remove();
  },[selected]));

  async function send(){
    if(sending.current||!selected||!scope.current||list.status!=='success'||
      !requireConversation(list.items,selected))return;
    const checked=validateMessage(draft);
    if(checked.error){setSendError(checked.error);return;}
    const expected={...scope.current},id=selected;
    sending.current={epoch:expected.epoch,id};setSendState('sending');setSendError('');
    try{
      // Never optimistically insert or retry a POST with uncertain network outcome.
      const result=await messagesApi.send(id,checked.text);
      const valid=parseMessages({items:[result]})[0];
      if(!matchesMessagingScope(expected,scope.current)||conversationRef.current!==id)return;
      if(valid.senderUserId!==expected.userId)throw new Error('Incohérence identité envoi.');
      setThread(old=>old.status==='success'
        ?{status:'success',items:mergeMessages(old.items,[valid])}:old);
      setDraft('');void loadList(true);
      // Do not fetch while a pending send is being committed; refresh on next poll or pull.
    }catch(e){
      if(matchesMessagingScope(expected,scope.current)&&conversationRef.current===id)
        setSendError(messagingError(e)+' Vérifiez le fil avant un nouvel envoi.');
    }finally{
      if(sending.current?.epoch===expected.epoch&&sending.current.id===id)sending.current=null;
      if(matchesMessagingScope(expected,scope.current))setSendState('idle');
    }
  }

  if(!allowed)return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
    <ErrorState title="Accès à la messagerie refusé" description="Seuls les comptes patients et médecins autorisés peuvent utiliser ce service."/>
  </SafeAreaView>;

  const conversations=list.status==='success'?list.items:[];
  const active=list.status==='success'?requireConversation(list.items,selected):null;
  const messageItems=thread.status==='success'?thread.items:[];
  const sendingNow=sendState==='sending';

  return <SafeAreaView edges={['top','left','right','bottom']} style={{flex:1,backgroundColor:theme.background}}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
      {!active?<FlatList data={conversations} keyExtractor={x=>x.id}
        contentContainerStyle={styles.content} initialNumToRender={12}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void loadList(true);}}
          colors={[theme.primary]} tintColor={theme.primary}/>}
        ListHeaderComponent={<View style={styles.section}>
          <Header title="Mes conversations" subtitle="Échanges avec les personnes autorisées par Medilink."/>
          <ThemedText type="small" themeColor="textSecondary">
            Les conversations sont disponibles seulement lorsque le serveur autorise un échange lié à une proposition active.
          </ThemedText>
        </View>}
        ItemSeparatorComponent={()=><View style={{height:Spacing.two}}/>}
        renderItem={({item})=><Pressable accessibilityRole="button"
          accessibilityLabel={'Ouvrir la conversation avec '+item.peerName}
          onPress={()=>choose(item.id)}
          style={[styles.conversation,{backgroundColor:theme.backgroundElement,borderColor:theme.border}]}>
          <Avatar name={item.peerName||'Contact'} size={48}/>
          <View style={{flex:1,gap:Spacing.one}}>
            <View style={styles.line}>
              <ThemedText type="smallBold" numberOfLines={1} style={{flex:1}}>{item.peerName}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">{messageDate(item.lastMessageAt)}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{item.requestTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {item.preview||'Aucun message pour le moment'}
            </ThemedText>
          </View>
          {item.unreadCount>0?<Badge tone="info" label={String(item.unreadCount)+' non lu(s)'}/>:null}
        </Pressable>}
        ListEmptyComponent={list.status==='loading'?<LoadingState label="Chargement des conversations…" />:
          list.status==='error'?<ErrorState title="Conversations indisponibles" description={list.error}
            onRetry={()=>{void loadList();}}/>:
          <EmptyState title="Aucune conversation" description="Vos échanges autorisés apparaîtront après une proposition active."/>}
      />:<View style={{flex:1}}>
        <View style={[styles.threadHeader,{borderBottomColor:theme.border}]}>
          <Button label="Retour aux conversations" variant="ghost" onPress={back}/>
          <Avatar name={active.peerName||'Contact'} size={40}/>
          <View style={{flex:1}}>
            <ThemedText type="smallBold" numberOfLines={1}>{active.peerName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{active.requestTitle}</ThemedText>
          </View>
          <Button label="Actualiser" variant="outline" onPress={()=>{void loadThread(active.id);}}/>
        </View>
        <FlatList ref={listRef} style={{flex:1}} contentContainerStyle={styles.thread}
          data={messageItems} keyExtractor={x=>x.id}
          initialNumToRender={20} maxToRenderPerBatch={20}
          onContentSizeChange={()=>{if(messageItems.length)listRef.current?.scrollToEnd({animated:true});}}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={()=>{void loadThread(active.id);}} colors={[theme.primary]} tintColor={theme.primary}/>}
          renderItem={({item})=><View style={[styles.messageLine,
            {justifyContent:item.senderUserId===currentUserId?'flex-end':'flex-start'}]}>
            <View style={[styles.bubble,{backgroundColor:item.senderUserId===currentUserId?theme.primary:theme.backgroundElement,
              borderColor:item.senderUserId===currentUserId?theme.primary:theme.border}]}>
              <ThemedText style={{color:item.senderUserId===currentUserId?theme.onPrimary:theme.text}}>{item.body}</ThemedText>
              <ThemedText type="small" style={{color:item.senderUserId===currentUserId?theme.onPrimary:theme.textSecondary}}>
                {messageDate(item.sentAt)}
              </ThemedText>
            </View>
          </View>}
          ListEmptyComponent={thread.status==='loading'?<LoadingState label="Chargement du fil…" />:
            thread.status==='error'?<ErrorState title="Messages indisponibles" description={thread.error}
              onRetry={()=>{void loadThread(active.id);}}/>:
            <EmptyState title="Aucun message" description="Vous pouvez envoyer le premier message de cet échange."/>}
        />
        {sendError?<ThemedText themeColor="danger" accessibilityRole="alert"
          style={{paddingHorizontal:Spacing.three}}>{sendError}</ThemedText>:null}
        <View style={[styles.composer,{borderTopColor:theme.border,backgroundColor:theme.backgroundElement}]}>
          <TextInput accessibilityLabel="Votre message" accessibilityHint="Maximum 4 000 caractères. Aucun envoi automatique."
            allowFontScaling multiline maxLength={4000}
            value={draft} onChangeText={setDraft} editable={!sendingNow}
            placeholder="Écrire un message…" placeholderTextColor={theme.textSecondary}
            style={[styles.textInput,{borderColor:theme.border,color:theme.text,backgroundColor:theme.input}]}/>
          <Button label={sendingNow?'Envoi…':'Envoyer'} loading={sendingNow}
            disabled={!draft.trim()||sendingNow} onPress={()=>{void send();}}/>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{paddingHorizontal:Spacing.three,paddingBottom:Spacing.two}}>
          Évitez les informations de santé sensibles hors du dossier sécurisé. Le fil montre au maximum les 100 derniers messages du serveur.
        </ThemedText>
      </View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{width:'100%',maxWidth:800,alignSelf:'center',padding:Spacing.three,paddingBottom:100,gap:Spacing.two},
  section:{gap:Spacing.two,marginBottom:Spacing.three},
  conversation:{borderRadius:Radius.large,borderWidth:1,padding:Spacing.three,
    minHeight:MinimumTouchTarget+34,flexDirection:'row',alignItems:'center',gap:Spacing.three},
  line:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:Spacing.two},
  threadHeader:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',borderBottomWidth:1,
    gap:Spacing.two,paddingHorizontal:Spacing.two,paddingVertical:Spacing.two},
  thread:{padding:Spacing.three,gap:Spacing.two,paddingBottom:Spacing.four},
  messageLine:{flexDirection:'row',width:'100%'},
  bubble:{maxWidth:'85%',borderRadius:Radius.large,padding:Spacing.three,borderWidth:1,gap:Spacing.one},
  composer:{flexDirection:'row',alignItems:'flex-end',flexWrap:'wrap',borderTopWidth:1,padding:Spacing.two,gap:Spacing.two},
  textInput:{flex:1,minHeight:MinimumTouchTarget,maxHeight:140,borderWidth:1,borderRadius:Radius.large,
    paddingHorizontal:Spacing.three,paddingVertical:Spacing.two,fontSize:16},
});
