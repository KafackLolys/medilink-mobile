import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const source=path=>readFileSync(join(root,path),'utf8');

test('all completed patient, doctor and admin screens remain available to Expo Router',()=>{
 const screens=[
  'src/app/(auth)/login.tsx','src/app/(auth)/register.tsx',
  'src/app/(auth)/forgot-password.tsx','src/app/(auth)/choose-role.tsx',
  'src/app/patient/(tabs)/index.tsx','src/app/patient/(tabs)/medecins.tsx',
  'src/app/patient/medecins/[id]/index.tsx','src/app/patient/medecins/[id]/rendez-vous.tsx',
  'src/app/patient/(tabs)/demandes.tsx','src/app/patient/besoins/nouveau.tsx',
  'src/app/patient/demandes/[id]/index.tsx','src/app/patient/demandes/[id]/modifier.tsx',
  'src/app/patient/(tabs)/rendez-vous.tsx','src/app/patient/rendez-vous/[id].tsx',
  'src/app/patient/(tabs)/profil.tsx','src/app/patient/historique.tsx',
  'src/app/patient/messages.tsx','src/app/patient/notifications.tsx',
  'src/app/medecin/(tabs)/index.tsx','src/app/medecin/(tabs)/besoins.tsx',
  'src/app/medecin/besoins/[id].tsx','src/app/medecin/(tabs)/propositions.tsx',
  'src/app/medecin/(tabs)/rendez-vous.tsx','src/app/medecin/disponibilites.tsx',
  'src/app/medecin/(tabs)/profil.tsx','src/app/medecin/zone-intervention.tsx',
  'src/app/medecin/messages.tsx','src/app/medecin/notifications.tsx',
  'src/app/medecin/avis.tsx','src/app/medecin/historique.tsx',
  'src/app/admin/index.tsx',
 ];
 for(const path of screens)assert.equal(existsSync(join(root,path)),true,path);
});
test('authorization remains role-scoped in the root navigator',()=>{
 const rootLayout=source('src/app/_layout.tsx');
 for(const role of ["'patient'","'doctor'","'admin'"])
  assert.match(rootLayout,new RegExp('session\\.role === '+role));
 assert.match(rootLayout,/Stack\.Protected/);
});
test('shared components ensure 48-point targets and screen-reader labels',()=>{
 const tokens=source('src/constants/theme.ts');
 assert.match(tokens,/MinimumTouchTarget = 48/);
 const primitives=source('src/components/ui/primitives.tsx');
 assert.match(primitives,/minHeight: MinimumTouchTarget/);
 assert.match(primitives,/accessibilityRole="button"/);
 assert.match(primitives,/accessibilityState=\{\{ disabled: !active, busy: loading \}\}/);
 assert.match(primitives,/accessibilityRole="header"/);
 const forms=source('src/components/ui/form-fields.tsx');
 assert.match(forms,/allowFontScaling/);
 assert.match(forms,/aria-invalid=/);
 assert.match(forms,/aria-describedby=/);
 assert.match(forms,/accessibilityRole="radio"/);
 assert.match(forms,/minHeight: MinimumTouchTarget/);
});
test('confirmation dialogs survive Android back, long content and keyboard',()=>{
 const modal=source('src/components/ui/overlays.tsx');
 assert.match(modal,/onRequestClose=\{safeClose\}/);
 assert.match(modal,/if \(!busy\) onClose\(\)/);
 assert.match(modal,/KeyboardAvoidingView/);
 assert.match(modal,/ScrollView/);
 assert.match(modal,/useSafeAreaInsets/);
 assert.match(modal,/accessibilityViewIsModal/);
});
test('messaging Android back returns to list without losing protected role navigation',()=>{
 const sourceCode=source('src/features/messaging/messaging-screen.tsx');
 assert.match(sourceCode,/BackHandler\.addEventListener\('hardwareBackPress'/);
 assert.match(sourceCode,/if\(!conversationRef\.current\)return false/);
 assert.match(sourceCode,/back\(\);/);
 assert.match(sourceCode,/subscription\.remove\(\)/);
 assert.match(sourceCode,/KeyboardAvoidingView/);
});
test('every common loading/error/empty state includes readable text and recovery',()=>{
 const states=source('src/components/ui/states.tsx');
 assert.match(states,/accessibilityRole="progressbar"/);
 assert.match(states,/accessibilityRole="alert"/);
 assert.match(states,/onRetry/);
 assert.match(states,/Aucun|Aucune|EmptyState/);
});
test('global offline banner respects status bar and protects local data',()=>{
 const banner=source('src/features/network/connectivity-banner.tsx');
 assert.match(banner,/useSafeAreaInsets/);
 assert.match(banner,/paddingTop:insets\.top/);
 assert.match(banner,/accessibilityLiveRegion="polite"/);
 const auth=source('src/features/auth/session.ts');
 assert.match(auth,/clearPublicDoctorDirectoryCache\(\)/);
});

test('key light and dark theme text combinations meet WCAG AA 4.5:1',()=>{
 const text=source('src/constants/theme.ts');
 const match=text.match(/light:\s*\{([\s\S]*?)\},\s*dark:\s*\{([\s\S]*?)\}/);
 assert.ok(match,'light and dark palette blocks exist');
 const colors=block=>Object.fromEntries([...block.matchAll(/(\w+):\s*'(#[\da-fA-F]{6})'/g)].map(x=>[x[1],x[2]]));
 const linear=x=>x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);
 const luminance=hex=>{
  const rgb=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)/255));
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
 };
 const ratio=(a,b)=>{
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
 };
 const pairs=[['text','background'],['textSecondary','background'],
  ['textSecondary','backgroundElement'],['primary','backgroundElement'],
  ['onPrimary','primary'],['warning','warningSurface'],['danger','dangerSurface'],
  ['success','successSurface'],['primary','infoSurface']];
 for(const [name,block]of [['light',match[1]],['dark',match[2]]]){
  const palette=colors(block);
  for(const [foreground,background]of pairs){
   assert.ok(palette[foreground]&&palette[background],name+' '+foreground+'/'+background);
   const measured=ratio(palette[foreground],palette[background]);
   assert.ok(measured>=4.5,name+' '+foreground+'/'+background+' contrast '+measured.toFixed(2)+':1');
  }
 }
});
