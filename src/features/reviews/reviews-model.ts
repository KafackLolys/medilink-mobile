import type { DoctorAppointment, DoctorOwnProfile, PatientAppointment } from '../../types/domain';

export type PatientReview={id:string;rating:number;comment:string|null};
export type DoctorReview={id:string;appointmentId:string;rating:number;comment:string|null;createdAt:string;patientLabel:string};
export type DoctorReviewSummary={rating:number|null;total:number;distribution:Record<1|2|3|4|5,number>;items:DoctorReview[]};
export type HistoryPeriod='all'|'month'|'year';
export const REVIEW_RATINGS=[5,4,3,2,1] as const;
export function reviewEligible(appointment:Pick<PatientAppointment,'status'>):boolean{return appointment.status==='completed';}
export function validateReview(rating:number,comment:string):{errors:Record<string,string>;body:{rating:number;comment:string|null}|null}{
 const errors:Record<string,string>={};
 if(!Number.isInteger(rating)||rating<1||rating>5)errors.rating='Note entière entre 1 et 5 requise.';
 if(comment.length>2000)errors.comment='Commentaire limité à 2 000 caractères.';
 return {errors,body:Object.keys(errors).length?null:{rating,comment:comment.trim()||null}};
}
export function parsePatientReview(value:unknown):PatientReview|null{
 if(value===null)return null;
 if(!value||typeof value!=='object')throw Error('Avis invalide');
 const x=value as Record<string,unknown>;
 if(typeof x.id!=='string'||!x.id||!Number.isInteger(x.rating)||(x.rating as number)<1||(x.rating as number)>5||
  !(x.comment===null||typeof x.comment==='string'))throw Error('Avis invalide');
 return {id:x.id,rating:x.rating as number,comment:x.comment as string|null};
}
export function parseDoctorReviewSummary(value:unknown):DoctorReviewSummary{
 if(!value||typeof value!=='object')throw Error('Avis médecin invalides');
 const x=value as Record<string,unknown>;
 if(!Array.isArray(x.items)||!Number.isSafeInteger(x.total)||(x.total as number)<0||
  !(x.rating===null||(typeof x.rating==='number'&&Number.isFinite(x.rating)&&x.rating>=1&&x.rating<=5))||
  !x.distribution||typeof x.distribution!=='object')throw Error('Avis médecin invalides');
 const distribution={} as DoctorReviewSummary['distribution'];
 for(const key of [1,2,3,4,5] as const){
  const n=(x.distribution as Record<number,unknown>)[key];
  if(!Number.isSafeInteger(n)||(n as number)<0)throw Error('Répartition des avis invalide');
  distribution[key]=n as number;
 }
 const items=(x.items as unknown[]).map((item):DoctorReview=>{
  if(!item||typeof item!=='object')throw Error('Évaluation invalide');
  const r=item as Record<string,unknown>;
  if(typeof r.id!=='string'||typeof r.appointmentId!=='string'||
    !Number.isInteger(r.rating)||(r.rating as number)<1||(r.rating as number)>5||
    !(r.comment===null||typeof r.comment==='string')||
    typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||
    typeof r.patientLabel!=='string')throw Error('Évaluation invalide');
  return {id:r.id,appointmentId:r.appointmentId,rating:r.rating as number,
   comment:r.comment as string|null,createdAt:r.createdAt,patientLabel:r.patientLabel};
 });
 if(items.length!==x.total||Object.values(distribution).reduce((a,b)=>a+b,0)!==x.total||
  (x.total===0&&x.rating!==null)||(x.total!==0&&x.rating===null))
  throw Error('Statistiques des avis incohérentes');
 // Do not derive a synthetic rating from rendered review items.
 return {items,total:x.total as number,rating:x.rating as number|null,distribution};
}
export function patientReviewAppointments(appointments:PatientAppointment[],doctorId?:string):PatientAppointment[]{
 return appointments.filter(a=>reviewEligible(a)&&(!doctorId||a.doctor.id===doctorId))
  .sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt));
}
export function doctorCompletedHistory(items:DoctorAppointment[],period:HistoryPeriod,now=new Date()):DoctorAppointment[]{
 const year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,'0');
 return items.filter(a=>a.status==='completed'
  &&(period==='all'||(period==='year'&&a.date.slice(0,4)===String(year))||
    (period==='month'&&a.date.slice(0,7)===year+'-'+month)))
  .sort((a,b)=>(b.date+'T'+b.time).localeCompare(a.date+'T'+a.time));
}
export function patientCompletedHistory(items:PatientAppointment[],period:HistoryPeriod,now=new Date()):PatientAppointment[]{
 const year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,'0');
 return patientReviewAppointments(items).filter(a=>
  period==='all'||a.scheduledAt.slice(0,4)===String(year)&&
  (period==='year'||a.scheduledAt.slice(5,7)===month));
}
export function reviewError(error:unknown):string{
 const e=error as {status?:number;kind?:string}|null;
 if(e?.status===404)return 'Rendez-vous ou avis introuvable pour ce compte.';
 if(e?.status===401||e?.status===403)return 'Vous n’êtes pas autorisé à consulter ou noter ce rendez-vous.';
 if(e?.status===400||e?.status===409||e?.status===422)
  return 'Avis refusé : la consultation doit être terminée, non encore évaluée, et la note valide. Actualisez avant de réessayer.';
 if(e?.kind==='network'||e?.kind==='timeout')
  return 'Connexion indisponible. Vérifiez si votre avis a été enregistré avant de réessayer.';
 return 'Impossible de charger ou publier l’avis. Vérifiez votre historique et réessayez.';
}
