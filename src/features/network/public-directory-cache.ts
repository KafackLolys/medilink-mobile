import type { DoctorDirectoryItem } from '../../types/domain';
import { canUseStalePublicDirectory } from './network-policy.ts';

export type PublicDoctorDirectory={doctors:DoctorDirectoryItem[];specialties:string[]};
type Entry={createdAt:number;value:PublicDoctorDirectory};
const MAX_ENTRIES=12;
const data=new Map<string,Entry>();
function key(filters:{q?:string;specialty?:string;city?:string}){
  return JSON.stringify([filters.q??'',filters.specialty??'',filters.city??'']);
}
/** Copy only the fields already exposed in the verified public directory.
 * No patient account IDs, health records, conversations, private files or tokens.
 * The cache is strictly IN MEMORY and is purged at every session transition.
 */
export function putPublicDoctorDirectory(filters:{q?:string;specialty?:string;city?:string},input:PublicDoctorDirectory,now=Date.now()){
  const sanitized:PublicDoctorDirectory={
    specialties:input.specialties.filter(x=>typeof x==='string').slice(0,100),
    doctors:input.doctors.map(d=>({
      id:d.id,name:d.name,specialty:d.specialty,bio:d.bio,
      yearsOfExperience:d.yearsOfExperience,consultationFee:d.consultationFee,
      currency:d.currency,professionalAddress:d.professionalAddress,
      serviceCity:d.serviceCity??null,serviceDistricts:[...(d.serviceDistricts??[])],
      modes:[...d.modes],availability:d.availability.map(a=>({...a})),
      rating:d.rating,reviewsCount:d.reviewsCount,
      appointmentDurationMinutes:d.appointmentDurationMinutes,
    })),
  };
  const k=key(filters);data.delete(k);
  data.set(k,{createdAt:now,value:sanitized});
  while(data.size>MAX_ENTRIES)data.delete(data.keys().next().value!);
}
export function getStalePublicDoctorDirectory(
 filters:{q?:string;specialty?:string;city?:string},error:{kind?:string},
 role:string,now=Date.now(),
):PublicDoctorDirectory|null{
 const entry=data.get(key(filters));
 if(!entry||!canUseStalePublicDirectory({
  ageMs:now-entry.createdAt,entryCount:data.size,endpoint:'/doctors',
  accountRole:role,networkErrorKind:error.kind??'',
 }))return null;
 return {
  specialties:[...entry.value.specialties],
  doctors:entry.value.doctors.map(d=>({...d,serviceDistricts:[...(d.serviceDistricts??[])],
    modes:[...d.modes],availability:d.availability.map(a=>({...a}))})),
 };
}
export function clearPublicDoctorDirectoryCache(){data.clear();}
export function publicDirectoryCacheSize(){return data.size;}
