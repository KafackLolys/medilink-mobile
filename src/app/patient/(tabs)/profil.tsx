import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input, SelectField } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { LogoutButton } from '@/components/auth/logout-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { authApi } from '@/services/auth';
import { integrationApi } from '@/services/integration';
import { patientsApi } from '@/services/patients';
import type { NativeUploadFile } from '@/services/http';
import type { PatientCondition, PatientDocument } from '@/types/domain';
import {
  BLOOD_TYPE_LABELS, CONDITION_LABELS, DOCUMENT_TYPES, DOCUMENT_MIMES,
  editingPatientProfile, mapPatientConditions, mapPatientDocuments,
  parsePatientProfile, patientProfileError, validatePatientEdit, validatePatientFile,
  viewPatientProfile, type PatientProfileData, type PatientProfileEdit, type PatientDocumentType,
} from '@/features/patient/patient-medical-profile';

type Resource<T> = { status: 'loading' } | { status: 'error' } | { status: 'success'; value: T };
type Resources = {
  profile: Resource<PatientProfileData>;
  health: Resource<PatientCondition[]>;
  documents: Resource<PatientDocument[]>;
};
function initial(): Resources {
  return {profile:{status:'loading'},health:{status:'loading'},documents:{status:'loading'}};
}
type PickedDocument = {uri:string;name:string;mimeType:string;size:number};

export default function PatientProfileScreen() {
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [resources,setResources]=useState<Resources>(initial);
  const [refreshing,setRefreshing]=useState(false);
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState<PatientProfileEdit|null>(null);
  const [formErrors,setFormErrors]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  const [privateVisible,setPrivateVisible]=useState(false);
  const [selectedFile,setSelectedFile]=useState<PickedDocument|null>(null);
  const [documentType,setDocumentType]=useState<PatientDocumentType>('other');
  const [documentTitle,setDocumentTitle]=useState('');
  const [documentBusy,setDocumentBusy]=useState(false);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [actionError,setActionError]=useState('');
  const seq=useRef(0),controller=useRef<AbortController|null>(null),mutationLock=useRef(false);

  const load=useCallback((pull=false)=>{
    controller.current?.abort();
    const ac=new AbortController();controller.current=ac;const version=++seq.current;
    if(pull)setRefreshing(true);else setResources(initial());
    const update=<K extends keyof Resources>(key:K,result:Resources[K])=>{
      if(!ac.signal.aborted&&seq.current===version)
        setResources(prev=>({...prev,[key]:result}));
    };
    const run=async<K extends keyof Resources,T>(key:K,fn:()=>Promise<T>)=>{
      try {update(key,{status:'success',value:await fn()} as Resources[K]);}
      catch {if(!ac.signal.aborted)update(key,{status:'error'});}
    };
    void Promise.all([
      run('profile',async()=>parsePatientProfile(await authApi.profile(ac.signal))),
      run('health',async()=>mapPatientConditions(await patientsApi.conditions(ac.signal))),
      run('documents',async()=>mapPatientDocuments(await patientsApi.documents(ac.signal))),
    ]).finally(()=>{
      if(!ac.signal.aborted&&seq.current===version)setRefreshing(false);
    });
  },[]);

  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='patient')load();
    return()=>{
      seq.current++;controller.current?.abort();
      // Profile and medical data must not survive navigation or account switching.
      setResources(initial());setDraft(null);setEditing(false);
      setSelectedFile(null);setDocumentTitle('');setPrivateVisible(false);
    };
  },[load,session.status,session.role]));

  const profile=resources.profile.status==='success'?resources.profile.value:null;
  const view=profile?viewPatientProfile(profile):null;
  const visibleHealth=resources.health.status==='success'?resources.health.value:null;
  const documents=resources.documents.status==='success'?resources.documents.value:null;

  function beginEdit(){
    if(!profile)return;
    setDraft(editingPatientProfile(profile));setFormErrors({});setNotice('');setEditing(true);
  }
  function change<K extends keyof PatientProfileEdit>(field:K,value:PatientProfileEdit[K]){
    setDraft(old=>old?{...old,[field]:value}:old);
    setFormErrors(old=>({...old,[field]:'',location:'',form:''}));
  }
  async function save(){
    if(mutationLock.current||!profile||!draft||session.status!=='authenticated'||session.role!=='patient')return;
    const problems=validatePatientEdit(draft,profile);
    setFormErrors(problems);
    if(Object.keys(problems).length)return;
    mutationLock.current=true;setSaving(true);setNotice('');
    try{
      const response=await integrationApi.savePatientProfile({
        name:draft.name.trim(),phone:draft.phone.trim(),bloodType:draft.bloodType,
        city:draft.city.trim(),district:draft.district.trim(),
      });
      if(response.saved!==true)throw new Error('Enregistrement non confirmé.');
      setDraft(null);setEditing(false);setNotice('Vos informations ont été enregistrées.');
      load(true);
    }catch(e){setFormErrors({form:patientProfileError(e)});}
    finally{mutationLock.current=false;setSaving(false);}
  }

  async function chooseDocument(){
    if(documentBusy||mutationLock.current)return;
    try{
      const picked=await DocumentPicker.getDocumentAsync({
        type:[...DOCUMENT_MIMES],multiple:false,copyToCacheDirectory:true,
      });
      if(picked.canceled||!picked.assets.length)return;
      const file=picked.assets[0];
      const problem=validatePatientFile(file);
      if(problem){setActionError(problem);setSelectedFile(null);return;}
      setSelectedFile({uri:file.uri,name:file.name,mimeType:file.mimeType!,size:file.size!});
      setDocumentTitle('');setActionError('');
    }catch{setActionError('Impossible de sélectionner ce document. Réessayez.');}
  }
  async function uploadDocument(){
    if(mutationLock.current||!selectedFile||session.status!=='authenticated'||session.role!=='patient')return;
    const issue=validatePatientFile(selectedFile);
    if(issue){setActionError(issue);return;}
    mutationLock.current=true;setDocumentBusy(true);setActionError('');
    try{
      const file:NativeUploadFile={uri:selectedFile.uri,name:selectedFile.name,type:selectedFile.mimeType};
      await patientsApi.uploadDocument(file,documentType,documentTitle.trim()||undefined);
      setSelectedFile(null);setDocumentTitle('');setNotice('Document ajouté.');
      load(true);
    }catch(e){setActionError(patientProfileError(e));}
    finally{mutationLock.current=false;setDocumentBusy(false);}
  }
  async function deleteDocument(){
    if(mutationLock.current||!deleteId||session.status!=='authenticated'||session.role!=='patient')return;
    mutationLock.current=true;setDocumentBusy(true);setActionError('');
    try{
      await patientsApi.deleteDocument(deleteId);
      setDeleteId(null);setNotice('Document supprimé.');load(true);
    }catch(e){setActionError(patientProfileError(e));setDeleteId(null);}
    finally{mutationLock.current=false;setDocumentBusy(false);}
  }
  async function openDocument(document:PatientDocument){
    try{
      if(!document.downloadUrl)throw new Error('Missing signed URL');
      const url=new URL(document.downloadUrl);
      if(url.protocol!=='https:')throw new Error('Unsafe link');
      await Linking.openURL(document.downloadUrl);
    }catch{setActionError('Lien indisponible ou expiré. Actualisez les documents pour renouveler son accès.');}
  }

  if(session.status!=='authenticated'||session.role!=='patient')return <SafeAreaView
    style={{flex:1,backgroundColor:theme.background}}><LoadingState label="Vérification de votre accès…" /></SafeAreaView>;

  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}>
      <Header title="Mon profil et mon dossier médical"
        subtitle="Ces informations personnelles restent réservées à votre compte."/>
      <Card>
        <View style={styles.identity}>
          <Avatar name={view?.name==='Non renseigné'?'Patient':view?.name??'Patient'} size={64}/>
          <View style={{flex:1}}>
            <ThemedText type="subtitle">{view?.name??'Profil patient'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Données personnelles</ThemedText>
          </View>
        </View>
        <Button label={privateVisible?'Masquer les informations médicales':'Afficher les informations médicales'}
          variant="outline" onPress={()=>setPrivateVisible(old=>!old)} />
        <ThemedText type="small" themeColor="textSecondary">
          Affichage réservé au patient authentifié. Évitez de consulter votre dossier sur un écran partagé.
        </ThemedText>
      </Card>
      {notice?<Card><ThemedText accessibilityRole="alert" themeColor="success">{notice}</ThemedText></Card>:null}
      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">Identité et coordonnées</ThemedText>
        {resources.profile.status==='loading'?<LoadingState label="Chargement de votre profil…" />:
          resources.profile.status==='error'?<ErrorState title="Profil indisponible" onRetry={()=>load()}/>:
          profile&&view?editing&&draft?<View style={{gap:Spacing.three}}>
            <Input label="Nom complet" value={draft.name} editable={!saving}
              onChangeText={x=>change('name',x)} maxLength={150} error={formErrors.name}/>
            <Input label="Téléphone" value={draft.phone} editable={!saving}
              keyboardType="phone-pad" onChangeText={x=>change('phone',x)} maxLength={30} error={formErrors.phone}/>
            <SelectField label="Groupe sanguin" value={draft.bloodType} onChange={x=>change('bloodType',x as PatientProfileEdit['bloodType'])}
              options={Object.entries(BLOOD_TYPE_LABELS).map(([value,label])=>({value,label}))}/>
            <Input label="Ville" value={draft.city} editable={!saving&&!!profile.patient.address}
              hint={!profile.patient.address?'Aucune adresse n’est retournée par le profil : création impossible ici.':undefined}
              maxLength={100} onChangeText={x=>change('city',x)}/>
            <Input label="Quartier" value={draft.district} editable={!saving&&!!profile.patient.address}
              maxLength={100} onChangeText={x=>change('district',x)} error={formErrors.location}/>
            <ThemedText themeColor="textSecondary" type="small">
              L’e-mail, la date de naissance et le genre sont en lecture seule : aucun endpoint patient de modification n’est disponible.
            </ThemedText>
            {formErrors.form?<ThemedText themeColor="danger" accessibilityRole="alert">{formErrors.form}</ThemedText>:null}
            <Button label="Enregistrer les modifications" loading={saving} onPress={()=>{void save();}}/>
            <Button label="Annuler" variant="outline" disabled={saving}
              onPress={()=>{setDraft(null);setEditing(false);setFormErrors({});}}/>
          </View>:<View style={{gap:Spacing.two}}>
            <ThemedText>Nom : {view.name}</ThemedText>
            <ThemedText>Adresse e-mail : {view.email}</ThemedText>
            <ThemedText>Téléphone : {view.phone}</ThemedText>
            <ThemedText>Ville : {view.city} · Quartier : {view.district}</ThemedText>
            <ThemedText>Genre : {view.gender}</ThemedText>
            <ThemedText>Date de naissance : {view.dateOfBirth}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              État de vérification patient : {view.verified?'Vérifié':'Non confirmé par l’API'}
            </ThemedText>
            <Button variant="outline" label="Modifier les champs autorisés" onPress={beginEdit}/>
          </View>:null}
      </Card>

      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">Mes informations médicales</ThemedText>
        {!privateVisible?<ThemedText themeColor="textSecondary">
          Ces informations sont masquées. Utilisez « Afficher les informations médicales » pour les consulter.
        </ThemedText>:<>
          <ThemedText type="smallBold">Groupe sanguin : {view?.bloodType??'Non renseigné'}</ThemedText>
          {resources.health.status==='loading'?<LoadingState label="Chargement des données de santé…" />:
            resources.health.status==='error'?<ErrorState title="Données de santé indisponibles" onRetry={()=>load()}/>:
            visibleHealth?.length?visibleHealth.map(condition=><View key={condition.id} style={[styles.entry,{borderColor:theme.border}]}>
              <ThemedText type="smallBold">{condition.name}</ThemedText>
              <Badge label={CONDITION_LABELS[condition.status]} tone="info"/>
              {condition.description?<ThemedText themeColor="textSecondary">{condition.description}</ThemedText>:null}
              {condition.diagnosedAt?<ThemedText type="small" themeColor="textSecondary">
                Date du diagnostic : {new Date(condition.diagnosedAt).toLocaleDateString('fr-FR')}
              </ThemedText>:null}
              {condition.notes?<ThemedText type="small">{condition.notes}</ThemedText>:null}
            </View>):<ThemedText themeColor="textSecondary">Aucune condition médicale enregistrée.</ThemedText>}
          <ThemedText type="small" themeColor="textSecondary">
            Consultation uniquement : aucune route de création ou modification d’une condition médicale n’est disponible.
          </ThemedText>
        </>}
      </Card>

      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">Mes documents médicaux</ThemedText>
        {!privateVisible?<ThemedText themeColor="textSecondary">
          La liste est masquée pour préserver la confidentialité.
        </ThemedText>:<>
          {resources.documents.status==='loading'?<LoadingState label="Chargement de vos documents…" />:
            resources.documents.status==='error'?<ErrorState title="Documents indisponibles" onRetry={()=>load()}/>:
            documents?.length?documents.map(item=><View key={item.id} style={[styles.entry,{borderColor:theme.border}]}>
              <ThemedText type="smallBold">{item.title||item.filename}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {DOCUMENT_TYPES[item.type as PatientDocumentType]??'Document médical'} · {Math.ceil(item.sizeBytes/1024)} Ko
              </ThemedText>
              {item.downloadUrl?<Button label="Consulter le document" variant="outline"
                disabled={documentBusy} onPress={()=>{void openDocument(item);}}/>:
                <ThemedText type="small" themeColor="textSecondary">Lien temporaire non disponible.</ThemedText>}
              <Button label="Supprimer ce document" variant="danger" disabled={documentBusy}
                onPress={()=>setDeleteId(item.id)}/>
            </View>):<ThemedText themeColor="textSecondary">Aucun document médical enregistré.</ThemedText>}
          <ThemedText type="smallBold">Ajouter un document</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            PDF, JPEG, PNG ou WebP, 10 Mo maximum. Ne sélectionnez que des documents que vous souhaitez envoyer.
          </ThemedText>
          <Button label="Choisir un fichier" variant="outline" disabled={documentBusy}
            onPress={()=>{void chooseDocument();}}/>
          {selectedFile?<View style={{gap:Spacing.two}}>
            <ThemedText type="smallBold">{selectedFile.name}</ThemedText>
            <SelectField label="Type de document" value={documentType}
              onChange={x=>setDocumentType(x as PatientDocumentType)}
              options={Object.entries(DOCUMENT_TYPES).map(([value,label])=>({label,value}))}/>
            <Input label="Titre (facultatif)" value={documentTitle} maxLength={255}
              editable={!documentBusy} onChangeText={setDocumentTitle}/>
            <Button label="Envoyer le document" loading={documentBusy} onPress={()=>{void uploadDocument();}}/>
            <Button label="Annuler le choix" variant="outline" disabled={documentBusy}
              onPress={()=>{setSelectedFile(null);setDocumentTitle('');}}/>
          </View>:null}
          {actionError?<ThemedText themeColor="danger" accessibilityRole="alert">{actionError}</ThemedText>:null}
        </>}
      </Card>
      <Card>
        <ThemedText type="subtitle">Mon activité</ThemedText>
        <Link href="/patient/demandes"><ThemedText type="linkPrimary">Mes demandes médicales</ThemedText></Link>
        <Link href="/patient/rendez-vous"><ThemedText type="linkPrimary">Mes rendez-vous</ThemedText></Link>
        <Link href="/patient/messages"><ThemedText type="linkPrimary">Mes messages</ThemedText></Link>
      </Card>
      <LogoutButton />
    </ScrollView>
    <Modal visible={!!deleteId} title="Supprimer ce document médical ?"
      description="Cette action est définitive. Le document sera supprimé de votre dossier."
      onClose={()=>{if(!documentBusy)setDeleteId(null);}}
      onConfirm={()=>{void deleteDocument();}} confirmLabel="Supprimer définitivement" busy={documentBusy}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{alignSelf:'center',width:'100%',maxWidth:800,padding:Spacing.three,paddingBottom:110,gap:Spacing.three},
  identity:{flexDirection:'row',alignItems:'center',gap:Spacing.three},
  entry:{borderWidth:1,padding:Spacing.three,borderRadius:Radius.large,gap:Spacing.two},
});
