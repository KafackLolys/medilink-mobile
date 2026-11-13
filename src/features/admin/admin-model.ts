import type { AdminAccount, AccountStatus, DoctorVerificationStatus, Page } from '../../types/domain';

export const ADMIN_PAGE_SIZE=10;
export const ADMIN_ACCOUNT_STATUSES=['active','pending','suspended','deleted'] as const satisfies readonly AccountStatus[];
export const ADMIN_VERIFICATION_STATUSES=['pending','verified','rejected','suspended'] as const satisfies readonly DoctorVerificationStatus[];
export const ADMIN_STATUS_LABELS:Record<AccountStatus,string>={
 active:'Actif',pending:'En attente',suspended:'Suspendu',deleted:'Supprimé',
};
export const ADMIN_VERIFICATION_LABELS:Record<DoctorVerificationStatus,string>={
 pending:'En attente',verified:'Vérifié',rejected:'Refusé',suspended:'Suspendu',
};
export type ManagedRole='patient'|'doctor';
export type AdminAction =
 |{type:'status';account:AdminAccount;value:AccountStatus}
 |{type:'patient-verification';account:AdminAccount;value:boolean}
 |{type:'doctor-verification';account:AdminAccount;value:DoctorVerificationStatus};

const validStatus=(value:unknown):value is AccountStatus=>
 typeof value==='string'&&(ADMIN_ACCOUNT_STATUSES as readonly string[]).includes(value);
const validVerification=(value:unknown):value is DoctorVerificationStatus=>
 typeof value==='string'&&(ADMIN_VERIFICATION_STATUSES as readonly string[]).includes(value);
export function normalizeAccountStatus(account:AdminAccount):AccountStatus{
 // Historical backend records may have invalid users.status='verified'; web handles the same exception.
 return (account.status as string)==='verified'?
  account.verificationStatus==='verified'?'active':'pending':account.status;
}
export function parseAdminPage(raw:unknown,role:ManagedRole):Page<AdminAccount>{
 if(!raw||typeof raw!=='object')throw Error('Réponse admin invalide');
 const page=raw as Record<string,unknown>;
 if(!Array.isArray(page.items)||!Number.isSafeInteger(page.page)||(page.page as number)<1
   ||!Number.isSafeInteger(page.pageSize)||(page.pageSize as number)<1||(page.pageSize as number)>50
   ||!Number.isSafeInteger(page.total)||(page.total as number)<0
   ||!Number.isSafeInteger(page.totalPages)||(page.totalPages as number)<0)throw Error('Pagination admin invalide');
 const items=page.items.map((item):AdminAccount=>{
  if(!item||typeof item!=='object')throw Error('Compte invalide');
  const user=item as Record<string,unknown>;
  if(typeof user.id!=='string'||!user.id||user.role!==role||
   typeof user.firstName!=='string'||typeof user.lastName!=='string'||
   !(user.email===null||typeof user.email==='string')||
   !(user.phone===null||typeof user.phone==='string')||
   !(validStatus(user.status)||user.status==='verified')||
   typeof user.emailVerified!=='boolean'||
   !(user.verificationStatus===null||validVerification(user.verificationStatus))||
   !(user.createdAt===null||typeof user.createdAt==='string'))throw Error('Compte invalide');
  return {id:user.id,role,firstName:user.firstName,lastName:user.lastName,
    email:user.email as string|null,phone:user.phone as string|null,
    status:user.status as AccountStatus,emailVerified:user.emailVerified,
    verificationStatus:user.verificationStatus as DoctorVerificationStatus|null,
    createdAt:user.createdAt as string|null};
 });
 return {items,page:page.page as number,pageSize:page.pageSize as number,total:page.total as number,totalPages:page.totalPages as number};
}
export function validAdminSearch(q:string){return q.trim().length<=100;}
export function actionableAdminChange(action:AdminAction):boolean{
 const account=action.account;
 if(account.role!=='patient'&&account.role!=='doctor')return false;
 if(action.type==='status')return validStatus(action.value)&&normalizeAccountStatus(account)!==action.value;
 if(action.type==='patient-verification')return account.role==='patient'&&account.emailVerified!==action.value;
 return account.role==='doctor'&&validVerification(action.value)&&account.verificationStatus!==action.value;
}
export function adminActionWarning(action:AdminAction):string{
 const name=[action.account.firstName,action.account.lastName].filter(Boolean).join(' ')||'Ce compte';
 if(action.type==='status'){
  const severe=action.value==='suspended'||action.value==='deleted';
  return name+' — statut '+ADMIN_STATUS_LABELS[action.value]+'. '+
   (severe?'Le backend désactive l’accès Firebase et révoque les jetons de renouvellement. Cette action peut interrompre des consultations en cours.':
    'Ce changement affecte les droits de connexion à Medilink.')+
   ' Vous confirmez cette opération pour ce compte uniquement ?';
 }
 if(action.type==='patient-verification')
  return name+' — e-mail '+(action.value?'vérifié':'non vérifié')+
   '. Cette action modifie l’état Firebase Auth et le dossier utilisateur. Confirmer ?';
 return name+' — vérification professionnelle '+ADMIN_VERIFICATION_LABELS[action.value]+
  '. Le backend peut activer un médecin en attente après approbation, mais ne réactive pas un compte suspendu ou supprimé. Confirmer ?';
}
export function adminError(error:unknown):string{
 const e=error as {status?:number;kind?:string}|null;
 if(e?.status===401||e?.status===403)return 'Accès administration interdit : compte administrateur actif requis.';
 if(e?.status===404)return 'Compte ou profil introuvable. Rechargez la liste.';
 if(e?.status===409)return 'Opération refusée : ce compte ne peut pas être modifié.';
 if(e?.status===400||e?.status===422)return 'Modification refusée : vérifiez les valeurs demandées.';
 if(e?.status===503)return 'La synchronisation Firebase peut être incomplète. Rechargez le compte et vérifiez son accès avant toute nouvelle action.';
 if(e?.kind==='network'||e?.kind==='timeout')return 'Connexion indisponible. Rechargez le compte avant de retenter cette modification.';
 return 'Opération administrative indisponible. Rechargez les données et réessayez.';
}
