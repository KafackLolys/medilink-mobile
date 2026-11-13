import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chooseMedicalDocument, previewMedicalDocument } from '@/features/documents/document-actions';
import { documentTransferError } from '@/features/documents/document-rules';
import { Avatar, Badge, Button, Card, Header } from '@/components/ui/primitives';
import { Input, SelectField } from '@/components/ui/form-fields';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/overlays';
import { LogoutButton } from '@/components/auth/logout-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing } from '@/constants/theme';
import { doctorsApi } from '@/services/doctors';
import type { NativeUploadFile } from '@/services/http';
import type { DoctorDocument, DoctorOwnProfile } from '@/types/domain';
import {
  DOCTOR_DOCUMENT_TYPES, DOCTOR_DOCUMENT_STATUSES, DOCTOR_VERIFICATION_STATUSES,
  DOCTOR_ALLOWED_MIME_TYPES, DOCTOR_MAX_DOCUMENTS,
  editableDoctorProfile, validateDoctorProfileEdit, validateDoctorDocument,
  parseDoctorOwnProfile, confirmedDoctorProfileUpdate, doctorProfileError,
  approvedDocumentDeletionWarning, type DoctorProfileEdit, type DoctorCandidateFile,
  type DoctorDocumentType,
} from '@/features/doctor/doctor-professional-profile';

type ProfileState={status:'loading'|'error'}|{status:'success';profile:DoctorOwnProfile};
const EMPTY_FORM:DoctorProfileEdit={bio:'',yearsOfExperience:'0',consultationFee:'0',professionalAddress:''};

export default function DoctorProfessionalProfile() {
  const theme=useTheme(),session=useNavigationSession(s=>s.session);
  const [state,setState]=useState<ProfileState>({status:'loading'});
  const [refreshing,setRefreshing]=useState(false);
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState<DoctorProfileEdit>({...EMPTY_FORM});
  const [formErrors,setFormErrors]=useState<Record<string,string>>({});
  const [picked,setPicked]=useState<DoctorCandidateFile|null>(null);
  const [documentType,setDocumentType]=useState<DoctorDocumentType>('medical_license');
  const [deleteTarget,setDeleteTarget]=useState<DoctorDocument|null>(null);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null),seq=useRef(0),focusEpoch=useRef(0),lock=useRef(false);

  const reload=useCallback((pull=false)=>{
    controller.current?.abort();
    const ac=new AbortController();controller.current=ac;const epoch=++seq.current;
    if(pull)setRefreshing(true);else setState({status:'loading'});
    void doctorsApi.me(ac.signal).then(raw=>{
      const profile=parseDoctorOwnProfile(raw);
      if(!ac.signal.aborted&&epoch===seq.current)setState({status:'success',profile});
    }).catch(()=>{
      if(!ac.signal.aborted&&epoch===seq.current)setState({status:'error'});
    }).finally(()=>{
      if(!ac.signal.aborted&&epoch===seq.current)setRefreshing(false);
    });
  },[]);

  useFocusEffect(useCallback(()=>{
    if(session.status==='authenticated'&&session.role==='doctor')reload();
    return()=>{
      focusEpoch.current++;seq.current++;controller.current?.abort();setState({status:'loading'});
      setEditing(false);setDraft({...EMPTY_FORM});setFormErrors({});
      setPicked(null);setDeleteTarget(null);setDocumentType('medical_license');
      setError('');setNotice('');setRefreshing(false);setBusy(false);
    };
  },[session.status,session.role,reload]));

  const profile=state.status==='success'?state.profile:null;
  function edit(){
    if(!profile)return;
    setDraft(editableDoctorProfile(profile));setFormErrors({});
    setError('');setNotice('');setEditing(true);
  }
  function change(key:keyof DoctorProfileEdit,value:string){
    setDraft(old=>({...old,[key]:value}));setFormErrors(old=>({...old,[key]:'',form:''}));
  }
  async function save(){
    if(!profile||lock.current||session.status!=='authenticated'||session.role!=='doctor')return;
    const checked=validateDoctorProfileEdit(draft);
    setFormErrors(checked.errors);
    if(!checked.payload)return;
    const operationEpoch=focusEpoch.current;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      const returned=await doctorsApi.update(checked.payload);
      if(operationEpoch!==focusEpoch.current)return;
      const updated=confirmedDoctorProfileUpdate(profile,returned);
      // Success is based on a confirmed profile response, not a local draft.
      setState({status:'success',profile:updated});
      setEditing(false);setNotice('Profil professionnel enregistré sur le serveur.');
      reload(true);
    }catch(e){if(operationEpoch===focusEpoch.current)setFormErrors({form:doctorProfileError(e)});}
    finally{lock.current=false;if(operationEpoch===focusEpoch.current)setBusy(false);}
  }
  async function pickDocument(){
    if(lock.current||!profile)return;
    const picked=await chooseMedicalDocument('doctor',profile.documents.length);
    if(picked.error){setPicked(null);setError(picked.error);return;}
    if(!picked.file)return; // The chooser was cancelled.
    setPicked(picked.file);setError('');setNotice('');
  }
  async function upload(){
    if(lock.current||!picked||!profile||session.status!=='authenticated'||session.role!=='doctor')return;
    const issue=validateDoctorDocument(picked,profile.documents.length);
    if(issue){setError(issue);return;}
    const operationEpoch=focusEpoch.current;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      const file:NativeUploadFile={uri:picked.uri,name:picked.name,type:picked.mimeType!};
      const uploaded=await doctorsApi.uploadDocument(file,documentType);
      if(operationEpoch!==focusEpoch.current)return;
      if(!uploaded?.id||uploaded.name!==documentType||uploaded.status!=='pending')
        throw new Error('Réponse de document non confirmée.');
      setPicked(null);
      setNotice('Justificatif envoyé. Il est en attente de vérification.');
      reload(true);
    }catch(e){if(operationEpoch===focusEpoch.current){setError(documentTransferError(e));reload(true);}}
    finally{lock.current=false;if(operationEpoch===focusEpoch.current)setBusy(false);}
  }
  async function remove(){
    if(lock.current||!deleteTarget||session.status!=='authenticated'||session.role!=='doctor')return;
    const operationEpoch=focusEpoch.current;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      await doctorsApi.deleteDocument(deleteTarget.id);
      if(operationEpoch!==focusEpoch.current)return;
      setDeleteTarget(null);
      setPicked(null);
      setNotice('Justificatif supprimé. Le statut professionnel a été rechargé.');
      reload(true);
    }catch(e){if(operationEpoch===focusEpoch.current){setDeleteTarget(null);setError(doctorProfileError(e));reload(true);}}
    finally{lock.current=false;if(operationEpoch===focusEpoch.current)setBusy(false);}
  }
  async function openDocument(document:DoctorDocument){
    const opened=await previewMedicalDocument(document.downloadUrl);
    if(!opened)setError('Impossible d’ouvrir le lien temporaire sécurisé. Actualisez le profil avant de réessayer.');
  }

  if(session.status!=='authenticated'||session.role!=='doctor')
    return <SafeAreaView style={{flex:1,backgroundColor:theme.background}}>
      <LoadingState label="Vérification des droits médecin…" />
    </SafeAreaView>;

  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>reload(true)}
        colors={[theme.primary]} tintColor={theme.primary}/>}>
      <Header title="Mon profil professionnel"
        subtitle="Informations privées de votre compte médecin et justificatifs de vérification."/>
      {error?<Card><ThemedText accessibilityRole="alert" themeColor="danger">{error}</ThemedText></Card>:null}
      {notice?<Card><ThemedText accessibilityRole="alert" themeColor="success">{notice}</ThemedText></Card>:null}
      {state.status==='loading'?<LoadingState label="Chargement du profil médecin…" />:
        state.status==='error'?<ErrorState title="Profil médecin indisponible"
          description="Vérifiez votre connexion et les droits de ce compte." onRetry={()=>reload()}/>:
        profile?<>
          <Card>
            <View style={styles.identity}>
              <Avatar name={profile.name||'Médecin'} size={64}/>
              <View style={{flex:1,gap:Spacing.two}}>
                <ThemedText type="subtitle">{profile.name||'Nom non renseigné'}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">{profile.specialty}</ThemedText>
                <Badge tone={profile.verificationStatus==='verified'?'success':
                  profile.verificationStatus==='pending'?'warning':'danger'}
                  label={DOCTOR_VERIFICATION_STATUSES[profile.verificationStatus]}/>
              </View>
            </View>
            {profile.verificationStatus!=='verified'?<ThemedText type="small" themeColor="textSecondary">
              La validation professionnelle dépend de l’équipe Medilink. La modification du profil
              ou l’import d’un justificatif ne garantit pas son approbation.
            </ThemedText>:null}
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Informations professionnelles</ThemedText>
            {editing?<View style={{gap:Spacing.three}}>
              <Input label="Présentation professionnelle" multiline numberOfLines={5}
                value={draft.bio} onChangeText={x=>change('bio',x)}
                maxLength={600} editable={!busy} error={formErrors.bio}/>
              <Input label="Années d’expérience (0 à 80)" value={draft.yearsOfExperience}
                onChangeText={x=>change('yearsOfExperience',x)} keyboardType="number-pad"
                editable={!busy} error={formErrors.yearsOfExperience}/>
              <Input label={'Tarif de consultation ('+profile.currency+')'} value={draft.consultationFee}
                onChangeText={x=>change('consultationFee',x)} keyboardType="number-pad"
                editable={!busy} error={formErrors.consultationFee}/>
              <Input label="Adresse professionnelle (facultative)" value={draft.professionalAddress}
                maxLength={255} onChangeText={x=>change('professionalAddress',x)}
                editable={!busy} error={formErrors.professionalAddress}/>
              {formErrors.form?<ThemedText themeColor="danger" accessibilityRole="alert">{formErrors.form}</ThemedText>:null}
              <Button label="Enregistrer les modifications" loading={busy} onPress={()=>{void save();}}/>
              <Button label="Annuler les modifications" variant="outline" disabled={busy}
                onPress={()=>{setEditing(false);setDraft({...EMPTY_FORM});setFormErrors({});}}/>
            </View>:<View style={{gap:Spacing.two}}>
              <ThemedText>Présentation : {profile.bio||'Non renseignée'}</ThemedText>
              <ThemedText>Expérience : {profile.yearsOfExperience} an(s)</ThemedText>
              <ThemedText>Tarif : {new Intl.NumberFormat('fr-FR').format(profile.consultationFee)} {profile.currency}</ThemedText>
              <ThemedText>Adresse professionnelle : {profile.professionalAddress||'Non renseignée'}</ThemedText>
              <Button label="Modifier ces informations" variant="outline" onPress={edit} disabled={busy}/>
            </View>}
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Identité et qualifications</ThemedText>
            <ThemedText>Nom : {profile.name||'Non renseigné'}</ThemedText>
            <ThemedText>Téléphone : {profile.phone||'Non renseigné'}</ThemedText>
            <ThemedText>E-mail : {profile.email||'Non renseigné'}</ThemedText>
            <ThemedText>Spécialité principale : {profile.specialty||'Non renseignée'}</ThemedText>
            <ThemedText>Spécialités secondaires : {profile.secondarySpecialties.join(', ')||'Non renseignées'}</ThemedText>
            <ThemedText>Numéro d’inscription : {profile.registrationNumber||'Non renseigné'}</ThemedText>
            <ThemedText>Diplômes : {profile.degrees.join(' ; ')||'Non renseignés'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Ces champs sont en lecture seule : aucun endpoint d’édition médecin ne permet de les modifier.
            </ThemedText>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Consultation et réputation</ThemedText>
            <ThemedText>Modes : {profile.modes.map(m=>m==='home'?'À domicile':'Téléconsultation').join(', ')||'Non configurés'}</ThemedText>
            <ThemedText>Note : {profile.rating===null?'Pas encore évalué':profile.rating.toFixed(1)+'/5'}</ThemedText>
            <ThemedText>{profile.reviewsCount} avis · {profile.completedConsultations} consultation(s) terminée(s)</ThemedText>
            <Link href="/medecin/disponibilites">
              <ThemedText themeColor="primary" type="linkPrimary">Gérer mes disponibilités ›</ThemedText>
            </Link>
            <Link href="/medecin/zone-intervention">
              <ThemedText themeColor="primary" type="linkPrimary">Zone d’intervention ›</ThemedText>
            </Link>
          </Card>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">Justificatifs professionnels</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Les justificatifs sont privés, leurs liens sont temporaires. PDF, JPEG, PNG ou WebP ;
              10 Mo maximum par fichier et {DOCTOR_MAX_DOCUMENTS} documents au maximum.
            </ThemedText>
            <ThemedText type="smallBold">{profile.documents.length} justificatif(s) enregistré(s)</ThemedText>
            {profile.documents.length?profile.documents.map(doc=><View key={doc.id}
              style={[styles.document,{borderColor:theme.border}]}>
              <ThemedText type="smallBold">{DOCTOR_DOCUMENT_TYPES[doc.name]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{doc.filename}</ThemedText>
              <View style={styles.documentMeta}>
                <Badge label={DOCTOR_DOCUMENT_STATUSES[doc.status]}
                  tone={doc.status==='approved'?'success':doc.status==='pending'?'warning':'danger'}/>
                <ThemedText type="small" themeColor="textSecondary">
                  {(doc.sizeBytes/1024/1024).toFixed(2)} Mo
                </ThemedText>
              </View>
              {doc.downloadUrl?<Button label="Consulter le justificatif" variant="outline"
                disabled={busy} onPress={()=>{void openDocument(doc);}}/>:
                <ThemedText type="small" themeColor="textSecondary">Lien temporaire indisponible.</ThemedText>}
              <Button label="Supprimer ce justificatif" variant="danger"
                disabled={busy} onPress={()=>setDeleteTarget(doc)}/>
            </View>):
              <ThemedText themeColor="textSecondary">Aucun justificatif enregistré.</ThemedText>}
            <SelectField label="Type de justificatif" value={documentType}
              onChange={v=>setDocumentType(v as DoctorDocumentType)}
              options={Object.entries(DOCTOR_DOCUMENT_TYPES).map(([value,label])=>({value,label}))}/>
            <Button label="Choisir un fichier Android" variant="outline"
              disabled={busy||profile.documents.length>=DOCTOR_MAX_DOCUMENTS}
              onPress={()=>{void pickDocument();}}/>
            {picked?<View style={{gap:Spacing.two}}>
              <ThemedText type="smallBold">{picked.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {(picked.size!/1024/1024).toFixed(2)} Mo · {picked.mimeType}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Aperçu avant envoi : contrôlez le nom, le type et la taille. Le contenu n'est pas recopié dans un cache permanent.</ThemedText>
              <Button label="Envoyer le justificatif" loading={busy} onPress={()=>{void upload();}}/>
              <Button label="Annuler le fichier sélectionné" variant="outline" disabled={busy}
                onPress={()=>setPicked(null)}/>
            </View>:null}
            {busy?<ThemedText type="small" themeColor="textSecondary">Transfert en cours… aucun pourcentage fiable disponible.</ThemedText>:null}
            <ThemedText type="small" themeColor="textSecondary">
              Le sélecteur système Android n’exige pas d’autorisation globale de stockage.
              L’approbation du document reste exclusivement effectuée par l’équipe Medilink.
            </ThemedText>
          </Card>
          <LogoutButton/>
        </>:null}
    </ScrollView>
    <Modal visible={!!deleteTarget} title="Supprimer définitivement ce justificatif ?"
      description={deleteTarget?approvedDocumentDeletionWarning(deleteTarget):undefined}
      confirmLabel="Supprimer définitivement" busy={busy}
      onClose={()=>{if(!busy)setDeleteTarget(null);}}
      onConfirm={()=>{void remove();}}/>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  content:{alignSelf:'center',width:'100%',maxWidth:800,padding:Spacing.three,paddingBottom:115,gap:Spacing.three},
  identity:{flexDirection:'row',alignItems:'center',gap:Spacing.three},
  document:{borderWidth:1,padding:Spacing.three,gap:Spacing.two,borderRadius:12},
  documentMeta:{flexDirection:'row',alignItems:'center',gap:Spacing.two,flexWrap:'wrap'},
});
