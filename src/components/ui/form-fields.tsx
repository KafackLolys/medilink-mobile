import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { MinimumTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Input({ label, hint, error, multiline, style, ...props }: TextInputProps & {
  label: string; hint?: string; error?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        {...props} multiline={multiline} allowFontScaling
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label} accessibilityHint={error ?? hint}
        accessibilityState={{ disabled: !props.editable }}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }}
        onBlur={event => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, multiline ? styles.multiline : null, {
          backgroundColor: theme.input, color: theme.text,
          borderColor: error ? theme.danger : focused ? theme.primary : theme.border,
          borderWidth: focused ? 2 : 1,
        }, style]}
      />
      {error ? <ThemedText themeColor="danger" type="small" accessibilityRole="alert">{error}</ThemedText> :
        hint ? <ThemedText themeColor="textSecondary" type="small">{hint}</ThemedText> : null}
    </View>
  );
}

export function PasswordField({ label = 'Mot de passe', ...props }: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const { error, hint, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Input {...inputProps} label={label} error={error} hint={hint} secureTextEntry={!visible} autoCapitalize="none" />
      <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onPress={() => setVisible(current => !current)} style={styles.toggle}>
        <ThemedText themeColor="primary" type="smallBold">{visible ? 'Masquer' : 'Afficher'}</ThemedText>
      </Pressable>
    </View>
  );
}

export function ToggleField({ label, description, value, onValueChange, disabled }: {
  label: string; description?: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {description ? <ThemedText themeColor="textSecondary" type="small">{description}</ThemedText> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange}
        disabled={disabled} trackColor={{ true: theme.primary, false: theme.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

export function SelectField({ label, options, value, onChange, error }: {
  label: string; options: ReadonlyArray<{ label: string; value: string }>; value: string;
  onChange: (value: string) => void; error?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.options}>
        {options.map(option => (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: value === option.value }}
            accessibilityLabel={option.label} onPress={() => onChange(option.value)}
            style={[styles.option, { backgroundColor: value === option.value ? theme.infoSurface : theme.backgroundElement,
              borderColor: value === option.value ? theme.primary : theme.border }]}>
            <ThemedText style={{ color: value === option.value ? theme.primary : theme.text }}>{option.label}</ThemedText>
          </Pressable>
        ))}
      </View>
      {error ? <ThemedText themeColor="danger" type="small">{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  input: { minHeight: MinimumTouchTarget, borderRadius: Radius.large, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 108, textAlignVertical: 'top' },
  toggle: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: Spacing.two },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { minHeight: MinimumTouchTarget, paddingHorizontal: Spacing.three, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.large },
});
