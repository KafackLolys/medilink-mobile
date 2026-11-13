import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <NativeTabs backgroundColor={theme.backgroundElement} tintColor={theme.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="besoins">
        <NativeTabs.Trigger.Label>Besoins</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="assignment" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="propositions">
        <NativeTabs.Trigger.Label>Propositions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="send" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rendez-vous">
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
