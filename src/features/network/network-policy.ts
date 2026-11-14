/** Side-effect-free network rules. No credential or medical payload is retained here. */
export type RetryPolicy = 'none' | 'safe-get';
export type RetryDecision = { retry: boolean; delayMs: number };
export const SAFE_GET_MAX_ATTEMPTS = 3;
export const SAFE_GET_DELAYS_MS = [300, 900] as const;
export function retryDecision(input: {
  method: string; policy: RetryPolicy; attempt: number;
  kind?: string; status?: number | null; cancelled?: boolean;
}):RetryDecision {
  if(input.policy!=='safe-get'||input.method!=='GET'||input.cancelled||input.attempt>=SAFE_GET_MAX_ATTEMPTS-1)
    return {retry:false,delayMs:0};
  const transient=input.kind==='network'||input.kind==='timeout'||
    (input.kind==='server'&&[502,503,504].includes(input.status??0))||
    (input.status===429);
  return transient?{retry:true,delayMs:SAFE_GET_DELAYS_MS[input.attempt]??900}:{retry:false,delayMs:0};
}
export async function abortableDelay(ms:number,signal:AbortSignal):Promise<void>{
  if(signal.aborted)throw new Error('cancelled');
  await new Promise<void>((resolve,reject)=>{
    const done=()=>{
      clearTimeout(timer);signal.removeEventListener('abort',cancel);resolve();
    };
    const cancel=()=>{
      clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new Error('cancelled'));
    };
    const timer=setTimeout(done,ms);
    signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted)cancel();
  });
}
export type NetworkQuality='unknown'|'online'|'offline'|'limited';
export function normalizeConnectivity(input:{isConnected?:boolean|null;isInternetReachable?:boolean|null}):NetworkQuality{
  if(input.isConnected===false||input.isInternetReachable===false)return 'offline';
  if(input.isConnected===true&&input.isInternetReachable===true)return 'online';
  if(input.isConnected===true)return 'limited';
  return 'unknown';
}
export function canUseStalePublicDirectory(input:{
  ageMs:number; entryCount:number; endpoint:string; accountRole:string; networkErrorKind:string;
}){
  return input.endpoint==='/doctors'&&input.accountRole==='patient'&&input.ageMs>=0&&input.ageMs<=300000&&
    input.entryCount<=20&&['network','timeout'].includes(input.networkErrorKind);
}
