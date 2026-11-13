import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const root=join(import.meta.dirname,'..');
const app=JSON.parse(readFileSync(join(root,'app.json'),'utf8')).expo;
const eas=JSON.parse(readFileSync(join(root,'eas.json'),'utf8'));
const source=readFileSync(join(root,'app.config.js'),'utf8');
test('Expo 58 Android release has three explicit EAS profiles and native dev client',()=>{
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
 assert.match(pkg.dependencies.expo,/58/);
 assert.match(pkg.dependencies['expo-dev-client'],/58/);
 assert.equal(eas.build.development.developmentClient,true);
 assert.equal(eas.build.development.android.buildType,'apk');
 assert.equal(eas.build.preview.android.buildType,'apk');
 assert.equal(eas.build.production.android.buildType,'app-bundle');
 assert.equal(eas.cli.appVersionSource,'remote');
 assert.equal(eas.build.production.autoIncrement,true);
 assert.equal(app.version,pkg.version);
 assert.equal(app.android.versionCode,1);
});
test('no fixed fabricated package, Firebase secrets or Expo EAS projectId in repo',()=>{
 assert.equal(app.android.package,undefined);
 assert.equal(app.extra?.eas?.projectId,undefined);
 assert.match(source,/MEDILINK_ANDROID_PACKAGE/);
 assert.match(source,/MEDILINK_GOOGLE_SERVICES_FILE/);
 assert.match(source,/MEDILINK_EAS_PROJECT_ID/);
 const config=readFileSync(join(root,'app.config.js'),'utf8');
 assert.doesNotMatch(config,/BEGIN PRIVATE KEY|AIzaSy[\da-zA-Z_-]{20}/);
});
test('Android permissions intentionally exclude GPS camera and broad storage',()=>{
 const android=app.android;
 for(const permission of ['android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.CAMERA','android.permission.READ_MEDIA_IMAGES']){
  assert.ok(android.blockedPermissions.includes(permission));
 }
 assert.ok(android.permissions.includes('android.permission.POST_NOTIFICATIONS'));
 assert.equal(app.scheme,'medilinkmobile');
});
test('non-secret structural release check passes with sample-safe config',()=>{
 const run=spawnSync(process.execPath,['scripts/validate-android-release.cjs'],{
  cwd:root,encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/structure valide/);
});
test('strict build gate fails closed without real approved credentials and brand',()=>{
 const run=spawnSync(process.execPath,['scripts/validate-android-release.cjs','--strict'],{
  cwd:root,encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(run.status,1);
 assert.match(run.stderr,/Identifiant Android définitif/);
 assert.match(run.stderr,/Projet EAS non configuré/);
 assert.match(run.stderr,/Fichier Android Firebase absent/);
 assert.match(run.stderr,/marque non approuvés/);
 assert.doesNotMatch(run.stderr,/token|firebase.privateKey/i);
});

test('production build cannot bypass branding and versionCode approval',()=>{
 const require=createRequire(import.meta.url);
 const previous=Object.fromEntries(['EAS_BUILD_PROFILE','MEDILINK_ANDROID_PACKAGE','MEDILINK_GOOGLE_SERVICES_FILE','MEDILINK_EAS_PROJECT_ID','EXPO_PUBLIC_API_BASE_URL','MEDILINK_BRANDING_APPROVED','MEDILINK_VERSION_CODE_APPROVED']
   .map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{
   EAS_BUILD_PROFILE:'production',MEDILINK_ANDROID_PACKAGE:'cm.medilink.test',
   MEDILINK_GOOGLE_SERVICES_FILE:'/secure/example.json',
   MEDILINK_EAS_PROJECT_ID:'12345678-1234-4123-8123-123456789abc',
   EXPO_PUBLIC_API_BASE_URL:'https://api.medilink.test',
  });
  delete process.env.MEDILINK_BRANDING_APPROVED;
  delete process.env.MEDILINK_VERSION_CODE_APPROVED;
  const setup=require('../app.config.js');
  assert.throws(()=>setup({config:app}),/production bloqué/);
  process.env.MEDILINK_BRANDING_APPROVED='true';
  assert.throws(()=>setup({config:app}),/production bloqué/);
 }finally{
  for(const [key,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
