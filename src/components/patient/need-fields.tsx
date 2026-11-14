import { View, Pressable, StyleSheet } from 'react-native';
import { Input, SelectField } from '@/components/ui/form-fields';
import { Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, Radius, MinimumTouchTarget } from '@/constants/theme';
import { SPECIALTY_OPTIONS, type NeedModeInput } from '@/features/patient/need-model';

export type EditableNeedFields = { title: string; specialty: string; description: string; mode: NeedModeInput };
export function NeedFields<T extends EditableNeedFields>({ value, set, errors, disabled = false }: {
  value: T; set: <K extends keyof T>(field: K, next: T[K]) => void;
  errors: Record<string,string>; disabled?: boolean;
}) {
  const theme = useTheme();
  return <Card>
    <ThemedText type="subtitle" accessibilityRole="header">Votre besoin médical</ThemedText>
    <Input label="Titre du besoin" placeholder="Ex. Maux de tête depuis plusieurs jours"
      value={value.title} onChangeText={text => set('title', text as T['title'])} error={errors.title}
      editable={!disabled} maxLength={200} />
    <SelectField label="Spécialité concernée" value={value.specialty}
      options={SPECIALTY_OPTIONS.map(x => ({ label: x, value: x }))}
      onChange={item => set('specialty', item as T['specialty'])} error={errors.specialty} />
    <Input label="Décrivez votre situation" multiline numberOfLines={5} maxLength={800}
      placeholder="Que ressentez-vous ? Depuis quand ?"
      value={value.description} onChangeText={text => set('description', text as T['description'])}
      editable={!disabled} error={errors.description}
      hint={`${value.description.length} / 800 caractères`} />
    <ThemedText type="smallBold">Type de consultation</ThemedText>
    <View style={styles.choices}>
      {([
        ['domicile', 'À domicile'],
        ['tele', 'Téléconsultation'],
      ] as const).map(([mode,label]) => <Pressable
        key={mode} accessibilityRole="radio" accessibilityLabel={label}
        accessibilityState={{ selected: value.mode === mode, disabled }}
        disabled={disabled} onPress={() => set('mode', mode as T['mode'])}
        style={[styles.choice, { backgroundColor: value.mode === mode ? theme.infoSurface : theme.backgroundElement,
          borderColor: value.mode === mode ? theme.primary : theme.border }]}>
        <ThemedText type="smallBold" style={{ color: value.mode === mode ? theme.primary : theme.text }}>{label}</ThemedText>
      </Pressable>)}
    </View>
    {errors.mode ? <ThemedText themeColor="danger" accessibilityRole="alert">{errors.mode}</ThemedText> : null}
  </Card>;
}
const styles = StyleSheet.create({
  choices: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  choice: { borderWidth: 1, padding: Spacing.three, borderRadius: Radius.large, minHeight: MinimumTouchTarget,
    justifyContent: 'center', flexGrow: 1 },
});
