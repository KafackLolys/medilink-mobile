import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useNavigationSession } from '@/store/navigation-session';
import { doctorsApi } from '@/services/doctors';
import { doctorCanAccessPatientNeeds, doctorGateMessage, parseDoctorProfile } from './doctor-dashboard';

export type DoctorAccess =
  | {status:'loading'}
  | {status:'denied';message:string}
  | {status:'error';message:string}
  | {status:'allowed'};

/** Always consult the backend verification status, not local role or user input alone. */
export function useVerifiedDoctorAccess(): {access:DoctorAccess;refresh:()=>void} {
  const session=useNavigationSession(s=>s.session);
  const [version,setVersion]=useState(0);
  const [access,setAccess]=useState<DoctorAccess>({status:'loading'});
  useFocusEffect(useCallback(()=>{
    const controller=new AbortController();
    if(session.status!=='authenticated'||session.role!=='doctor'){
      setAccess({status:'denied',message:'Accès réservé aux médecins authentifiés.'});
      return ()=>controller.abort();
    }
    setAccess({status:'loading'});
    void doctorsApi.me(controller.signal).then(payload=>{
      if(controller.signal.aborted)return;
      const profile=parseDoctorProfile(payload);
      if(doctorCanAccessPatientNeeds(profile.verificationStatus))setAccess({status:'allowed'});
      else setAccess({status:'denied',message:doctorGateMessage(profile.verificationStatus)});
    }).catch(error=>{
      if(controller.signal.aborted)return;
      const status=(error as {status?:number}|null)?.status;
      setAccess(status===401||status===403
        ?{status:'denied',message:'Votre profil professionnel n’est pas autorisé à consulter les demandes.'}
        :{status:'error',message:'Impossible de vérifier votre profil professionnel.'});
    });
    return ()=>{controller.abort();setAccess({status:'loading'});};
  },[session.status,session.role,version]));
  return {access,refresh:()=>setVersion(v=>v+1)};
}
