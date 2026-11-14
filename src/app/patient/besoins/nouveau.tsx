import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Screen, Card, Header, Button, Badge } from '@/components/ui/primitives';
import { Input, SelectField, ToggleField } from '@/components/ui/form-fields';
import { ThemedText } from '@/components/themed-text';
import { NeedFields } from '@/components/patient/need-fields';
import { needsApi } from '@/services/needs';
import type { NativeUploadFile } from '@/services/http';
import { useTheme } from '@/hooks/use-theme';
import { useNavigationSession } from '@/store/navigation-session';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { EMPTY_NEED_FORM, SINCE_OPTIONS, SYMPTOM_OPTIONS, MAX_NEED_FILES,
  validateNeedCreation, validateNeedAttachments, safeNeedError,
  type CandidateFile, type NeedCreationValues } from '@/features/patient/need-model';

const safeFile = (asset: DocumentPicker.DocumentPickerAsset): CandidateFile => ({
  uri: asset.uri, name: asset.name, size: asset.size, mimeType: asset.mimeType,
});

export default function CreateNeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const session = useNavigationSession(state => state.session);
  const [values, setValues] = useState<NeedCreationValues>({ ...EMPTY_NEED_FORM });
  const [files, setFiles] = useState<CandidateFile[]>([]);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [stage, setStage] = useState<'form'|'preview'>('form');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);

  useEffect(() => () => { request.current?.abort(); }, []);
  function set<K extends keyof NeedCreationValues>(key: K, value: NeedCreationValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '', form: '' }));
  }
  async function pickDocuments() {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'],
        multiple: true, copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const incoming = result.assets.map(safeFile);
      const next = [...files, ...incoming];
      const error = validateNeedAttachments(next);
      if (error) { setErrors(prev => ({ ...prev, file: error })); return; }
      setFiles(next);
      setErrors(prev => ({ ...prev, file: '' }));
    } catch {
      setErrors(prev => ({ ...prev, file: 'Impossible de sélectionner les fichiers. Réessayez.' }));
    }
  }

  function preview() {
    const found = validateNeedCreation(values);
    const fileError = validateNeedAttachments(files);
    if (fileError) found.file = fileError;
    setErrors(found);
    if (Object.keys(found).length === 0) setStage('preview');
  }

  async function publish() {
    if (locked.current || values.priority === 'urgence') return;
    const checked = validateNeedCreation(values);
    const fileError = validateNeedAttachments(files);
    if (fileError) checked.file = fileError;
    if (Object.keys(checked).length) { setStage('form'); setErrors(checked); return; }
    locked.current = true;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const documents: NativeUploadFile[] = files.map(file =>
        ({ uri: file.uri, name: file.name, type: file.mimeType! }));
      const created = await needsApi.create({
        title: values.title.trim(), specialty: values.specialty.trim(),
        description: values.description.trim(), symptoms: values.symptoms,
        since: values.since || undefined, city: values.city.trim(),
        district: values.district.trim(), address: values.address.trim() || undefined,
        priority: values.priority, mode: values.mode, consent: values.consent,
      }, documents, controller.signal);
      if (!controller.signal.aborted) {
        setFiles([]);
        setValues({ ...EMPTY_NEED_FORM });
        router.replace({ pathname: '/patient/demandes/[id]', params: { id: created.id } });
      }
    } catch (error) {
      if (!controller.signal.aborted) setErrors({ form: safeNeedError(error, 'Publication impossible. Vérifiez vos documents et réessayez.') });
    } finally {
      locked.current = false;
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (session.status !== 'authenticated' || session.role !== 'patient') {
    return <Screen><ThemedText>Vérification de votre accès…</ThemedText></Screen>;
  }

  if (stage === 'preview') return <Screen>
    <Header title="Aperçu de la demande" subtitle="Relisez votre demande avant sa publication." />
    <Card>
      <Badge label={values.specialty} tone="info" />
      <ThemedText type="subtitle">{values.title}</ThemedText>
      <ThemedText>{values.description}</ThemedText>
      <ThemedText themeColor="textSecondary">Lieu : {values.district}, {values.city}</ThemedText>
      <ThemedText themeColor="textSecondary">Adresse exacte : masquée aux médecins</ThemedText>
      <ThemedText themeColor="textSecondary">Mode : {values.mode === 'domicile' ? 'À domicile' : 'Téléconsultation'}</ThemedText>
      <ThemedText themeColor="textSecondary">Fichiers : {files.length} (transmis avec la demande)</ThemedText>
    </Card>
    {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
    <Button label="Modifier" variant="outline" disabled={busy} onPress={() => setStage('form')} />
    <Button label="Publier ma demande" loading={busy} onPress={() => { void publish(); }} />
    <ThemedText themeColor="textSecondary" type="small">
      En cas de symptômes graves ou d’aggravation, contactez les services d’urgence.
    </ThemedText>
  </Screen>;

  return <Screen>
    <Header title="Publier un besoin médical"
      subtitle="Décrivez votre situation. Les médecins vérifiés pourront proposer leur aide." />
    <Card>
      <ThemedText type="smallBold" themeColor="danger">Attention aux urgences</ThemedText>
      <ThemedText type="small">
        Une demande Medilink ne remplace pas les services d’urgence et ne garantit aucun délai de réponse.
      </ThemedText>
    </Card>
    <NeedFields value={values} set={set} errors={errors} disabled={busy} />
    <Card>
      <ThemedText type="subtitle" accessibilityRole="header">Symptômes et durée</ThemedText>
      <View style={styles.choices}>
        {SYMPTOM_OPTIONS.map(option => {
          const chosen = values.symptoms.includes(option);
          return <Pressable key={option} accessibilityRole="checkbox" accessibilityLabel={option}
            accessibilityState={{ checked: chosen }} disabled={busy}
            onPress={() => set('symptoms', chosen
              ? values.symptoms.filter(x => x !== option) : [...values.symptoms, option])}
            style={[styles.chip, { borderColor: chosen ? theme.primary : theme.border,
              backgroundColor: chosen ? theme.infoSurface : theme.backgroundElement }]}>
            <ThemedText type="smallBold">{option}</ThemedText>
          </Pressable>;
        })}
      </View>
      <SelectField label="Depuis quand ?" value={values.since}
        options={[{label:'Non précisé',value:''}, ...SINCE_OPTIONS.map(x=>({label:x,value:x}))]}
        onChange={v => set('since', v)} />
    </Card>
    <Card>
      <ThemedText type="subtitle" accessibilityRole="header">Niveau de priorité</ThemedText>
      <SelectField label="Priorité de la demande" value={values.priority} onChange={v => set('priority',v as NeedCreationValues['priority'])}
        options={[{label:'Consultation normale',value:'normal'},
          {label:'Prise en charge rapide',value:'rapide'}, {label:'Urgence médicale',value:'urgence'}]} />
      {values.priority === 'urgence' ? <ThemedText themeColor="danger" accessibilityRole="alert">
        Ne publiez pas une urgence médicale. Contactez immédiatement les services d’urgence ou rendez-vous dans un service d’urgence.
      </ThemedText> : null}
    </Card>
    <Card>
      <ThemedText type="subtitle" accessibilityRole="header">Localisation</ThemedText>
      <Input label="Ville" value={values.city} error={errors.city} onChangeText={v=>set('city',v)} editable={!busy} />
      <Input label="Quartier" value={values.district} error={errors.district} onChangeText={v=>set('district',v)} editable={!busy} />
      <Input label="Adresse exacte (confidentielle)" value={values.address}
        hint="Non affichée publiquement aux médecins."
        onChangeText={v=>set('address',v)} editable={!busy} />
    </Card>
    <Card>
      <ThemedText type="subtitle" accessibilityRole="header">Documents et images</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        PDF, JPEG, PNG, WebP, HEIC ou HEIF · {MAX_NEED_FILES} fichiers maximum · 10 Mo chacun.
      </ThemedText>
      <Button variant="outline" label="Ajouter des fichiers" onPress={() => { void pickDocuments(); }} disabled={busy} />
      {files.map((file,index) => <View key={file.uri+'-'+index} style={styles.fileRow}>
        <ThemedText style={{flex:1}} numberOfLines={2}>{file.name}</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${file.name}`}
          disabled={busy} onPress={() => setFiles(current=>current.filter((_,i)=>i!==index))}
          style={styles.remove}><ThemedText themeColor="danger">Retirer</ThemedText></Pressable>
      </View>)}
      {errors.file ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.file}</ThemedText> : null}
    </Card>
    <Card>
      <ToggleField label="J’autorise le partage de cette demande"
        description="Les médecins vérifiés de mon secteur peuvent consulter la demande, sans mon adresse exacte."
        value={values.consent} onValueChange={v=>set('consent',v)} disabled={busy} />
      {errors.consent ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.consent}</ThemedText> : null}
      {errors.priority ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.priority}</ThemedText> : null}
      {errors.form ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.form}</ThemedText> : null}
      <Button label="Vérifier avant publication" disabled={busy || values.priority === 'urgence'} onPress={preview} />
      <Link href="/patient/demandes"><ThemedText type="linkPrimary">Annuler</ThemedText></Link>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  choices: {flexDirection:'row',flexWrap:'wrap',gap:Spacing.two},
  chip:{minHeight:MinimumTouchTarget,borderWidth:1,borderRadius:Radius.pill,
    padding:Spacing.two,justifyContent:'center'},
  fileRow:{flexDirection:'row',alignItems:'center',gap:Spacing.two},
  remove:{minHeight:MinimumTouchTarget,justifyContent:'center',paddingHorizontal:Spacing.two},
});
