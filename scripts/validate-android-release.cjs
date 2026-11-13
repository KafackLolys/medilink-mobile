#!/usr/bin/env node
'use strict';
// This preflight emits only generic errors, never Firebase JSON, private file paths or tokens.
const fs=require('node:fs');
const path=require('node:path');
const config=require('../app.json').expo;
const eas=require('../eas.json');
const strict=process.argv.includes('--strict');
const errors=[];
const ensure=(test,message)=>{if(!test)errors.push(message)};
const isAndroidId=s=>typeof s==='string'&&/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(s);
const isUuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const fileIsPresent=p=>typeof p==='string'&&fs.existsSync(path.resolve(__dirname,'..',p));
ensure(config.version===require('../package.json').version,'Version expo/package.json incohérente.');
ensure(Number.isInteger(config.android.versionCode)&&config.android.versionCode>0,'versionCode Android manquant.');
ensure(config.scheme==='medilinkmobile','Scheme existant modifié sans validation des liens.');
ensure(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-notifications'),'Plugin FCM absent.');
ensure(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-secure-store'),'Plugin SecureStore absent.');
ensure(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-splash-screen'),'Splash Android non configuré.');
for(const p of [config.icon,config.android.adaptiveIcon.foregroundImage,config.android.adaptiveIcon.backgroundImage,config.android.adaptiveIcon.monochromeImage]){
 ensure(fileIsPresent(p),'Ressource icône Android manquante.');
}
const splash=config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')?.[1]?.image;
ensure(fileIsPresent(splash),'Ressource splash Android manquante.');
ensure(config.android.permissions.includes('android.permission.POST_NOTIFICATIONS'),'Permission Android 13+ notifications manquante.');
ensure(config.android.blockedPermissions.includes('android.permission.ACCESS_BACKGROUND_LOCATION'),'Blocage GPS en arrière-plan manquant.');
ensure(eas.build.development.developmentClient===true&&eas.build.development.android.buildType==='apk',
 'Profil development APK invalide.');
ensure(eas.build.preview.android.buildType==='apk','Profil preview APK invalide.');
ensure(eas.build.production.android.buildType==='app-bundle','Profil production AAB invalide.');
ensure(eas.cli.appVersionSource==='remote'&&eas.build.production.autoIncrement===true,
 'Incrémentation versionCode EAS production non activée.');
if(strict){
 const env=process.env,packageId=env.MEDILINK_ANDROID_PACKAGE?.trim();
 ensure(isAndroidId(packageId),'Identifiant Android définitif non fourni.');
 ensure(isUuid(env.MEDILINK_EAS_PROJECT_ID),'Projet EAS non configuré.');
 const googleFile=env.MEDILINK_GOOGLE_SERVICES_FILE?.trim();
 ensure(!!googleFile&&fs.existsSync(googleFile),'Fichier Android Firebase absent.');
 if(googleFile&&fs.existsSync(googleFile)){
  try{
   const doc=JSON.parse(fs.readFileSync(googleFile,'utf8'));
   const packages=(doc.client||[]).map(c=>c.client_info?.android_client_info?.package_name);
   ensure(packages.includes(packageId),'Firebase Android package différent de celui de Medilink.');
   ensure(!!doc.project_info?.project_id,'Projet Firebase invalide.');
  }catch{errors.push('Format de google-services.json invalide.');}
 }
 try{
  const u=new URL(env.EXPO_PUBLIC_API_BASE_URL||'');
  ensure(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
   !/^(localhost|127\.0\.0\.1|10\.0\.2\.2|api\.example\.com)$/i.test(u.hostname),
   'URL API de distribution HTTPS réelle requise.');
 }catch{errors.push('URL API de distribution absente ou invalide.');}
 ensure(env.MEDILINK_BRANDING_APPROVED==='true','Icône et splash de marque non approuvés.');
 ensure(env.MEDILINK_VERSION_CODE_APPROVED==='true','versionCode non confirmé avec Google Play.');
}
if(errors.length){for(const err of errors)process.stderr.write('PRE-FLIGHT: '+err+'\n');process.exit(1)}
process.stdout.write(strict?'Release preflight: configuration Android validée (APK/AAB non construit).\n':
 'Release preflight: structure valide, identité et credentials à fournir pour les builds.\n');
