import { useNetworkState } from 'expo-network';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { normalizeConnectivity } from './network-policy.ts';

/** Device connectivity is indicative, not a proof the Medilink API is reachable.
 * No IP address, WiFi SSID, GPS or background tracking is ever collected.
 */
export function ConnectivityBanner(){
 const state=useNetworkState();
 const quality=normalizeConnectivity(state);
 const theme=useTheme();
 const insets=useSafeAreaInsets();
 if(quality==='online'||quality==='unknown')return null;
 return <View accessibilityRole="alert" accessibilityLiveRegion="polite"
   style={[styles.banner,{paddingTop:insets.top+7,backgroundColor:quality==='offline'?theme.dangerSurface:theme.warningSurface}]}>
  <ThemedText type="smallBold" style={{color:quality==='offline'?theme.danger:theme.warning}}>
    {quality==='offline'?
      'Hors connexion — les actions nécessitant le serveur sont indisponibles.':
      'Connexion limitée — vérifiez votre accès à Internet et actualisez vos écrans.'}
  </ThemedText>
 </View>;
}
const styles=StyleSheet.create({banner:{paddingHorizontal:12,paddingVertical:7}});
