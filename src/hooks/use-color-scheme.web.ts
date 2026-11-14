import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
const subscribe=()=>()=>{};
const getClientSnapshot=()=>true;
const getServerSnapshot=()=>false;
/** Hydration-safe without synchronously setting state inside an effect. */
export function useColorScheme(){
 const hydrated=useSyncExternalStore(subscribe,getClientSnapshot,getServerSnapshot);
 const scheme=useRNColorScheme();
 return hydrated?scheme:'light';
}
