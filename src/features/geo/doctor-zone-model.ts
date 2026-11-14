import type { DoctorZoneSettings, DoctorDirectoryItem } from '../../types/domain';

export type ZoneDraft={city:string;districts:string[];radiusKm:string;maxDistanceKm:string};
export const EMPTY_ZONE:DoctorZoneSettings={city:'',districts:[],radiusKm:10,maxDistanceKm:25};
export function parseDoctorZone(raw:unknown):DoctorZoneSettings{
 if(!raw||typeof raw!=='object')throw new Error('Zone d’intervention indisponible.');
 const z=raw as Record<string,unknown>;
 if(typeof z.city!=='string'||!Array.isArray(z.districts)||
  !z.districts.every(v=>typeof v==='string')||
  !Number.isInteger(z.radiusKm)||!Number.isInteger(z.maxDistanceKm))
  throw new Error('Zone d’intervention invalide.');
 return {city:z.city,districts:z.districts as string[],radiusKm:z.radiusKm as number,maxDistanceKm:z.maxDistanceKm as number};
}
export function editableDoctorZone(zone:DoctorZoneSettings):ZoneDraft{
 return {city:zone.city,districts:[...zone.districts],radiusKm:String(zone.radiusKm),maxDistanceKm:String(zone.maxDistanceKm)};
}
export function validateDoctorZone(form:ZoneDraft):{errors:Record<string,string>;payload:DoctorZoneSettings|null}{
 const errors:Record<string,string>={};
 const city=form.city.trim(),districts=form.districts.map(d=>d.trim());
 const radius=Number(form.radiusKm.trim()),max=Number(form.maxDistanceKm.trim());
 if(!city||form.city.length>100)errors.city='La ville est obligatoire (100 caractères maximum).';
 if(districts.length>40||districts.some(x=>!x||x.length>100))
  errors.districts='40 quartiers maximum, chacun entre 1 et 100 caractères.';
 if(new Set(districts.map(d=>d.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr'))).size!==districts.length)
  errors.districts='Un quartier ne peut pas apparaître deux fois.';
 if(!form.radiusKm.trim()||!Number.isInteger(radius)||radius<1||radius>250)
  errors.radiusKm='Rayon : entier compris entre 1 et 250 km.';
 if(!form.maxDistanceKm.trim()||!Number.isInteger(max)||max<1||max>500||max<radius)
  errors.maxDistanceKm='Distance maximale : entier de 1 à 500 km, supérieur ou égal au rayon.';
 return {errors,payload:Object.keys(errors).length?null:{city,districts,radiusKm:radius,maxDistanceKm:max}};
}
export function appendDistrict(form:ZoneDraft,value:string):{form:ZoneDraft;error:string|null}{
 const district=value.trim();
 if(!district||district.length>100)return {form,error:'Entrez un quartier valide (100 caractères maximum).'};
 if(form.districts.length>=40)return {form,error:'Vous pouvez renseigner au maximum 40 quartiers.'};
 const normalize=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 if(form.districts.some(x=>normalize(x)===normalize(district)))
  return {form,error:'Ce quartier figure déjà dans votre liste.'};
 return {form:{...form,districts:[...form.districts,district]},error:null};
}
export type GeoCoordinate={latitude:number;longitude:number};
export function validCoordinates(value:unknown):value is GeoCoordinate{
 if(!value||typeof value!=='object')return false;
 const p=value as Partial<GeoCoordinate>;
 return typeof p.latitude==='number'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90
  &&typeof p.longitude==='number'&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180;
}
/** Only API-returned coordinates may produce map markers. Never geocode a patient's street. */
export function doctorMapMarkers(doctors:DoctorDirectoryItem[]){
 return doctors.flatMap(d=>{
  const p=(d as DoctorDirectoryItem&{coordinates?:unknown}).coordinates;
  return validCoordinates(p)?[{id:d.id,name:d.name,latitude:p.latitude,longitude:p.longitude}]:[];
 });
}
export function doctorZoneError(error:unknown):string{
 const e=error as {status?:number;kind?:string}|null;
 if(e?.status===401||e?.status===403)return 'Votre compte ne peut pas accéder à ces zones.';
 if(e?.status===400||e?.status===422)return 'Zone refusée : vérifiez les quartiers et les distances.';
 if(e?.kind==='network'||e?.kind==='timeout')return 'Connexion indisponible. Réessayez.';
 return 'Impossible de charger ou enregistrer cette zone. Réessayez.';
}
