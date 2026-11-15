import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');

test('login renders one and only one Google button', () => {
  const screen = read('src/app/(auth)/login.tsx');
  assert.equal((screen.match(/<GoogleAuthButton\b/g) ?? []).length, 1);
  assert.equal((screen.match(/ou avec votre e-mail/g) ?? []).length, 1);
});
test('bell is bound to a server-validated unread count, not page length', () => {
  const header = read('src/components/ui/medihome-header.tsx');
  const store = read('src/features/notifications/unread-store.ts');
  assert.match(header, /useUnreadNotifications/);
  assert.match(header, /unread > 99 \? '99\+' : String\(unread\)/);
  assert.match(store, /parseNotificationPage\(raw\)/);
  assert.match(store, /page\.unreadCount/);
  assert.doesNotMatch(store, /items\.length/);
});
test('FCM registration and updates are automatic after authenticated startup', () => {
  const lifecycle = read('src/features/notifications/push-lifecycle.tsx');
  assert.match(lifecycle, /registerPushDevice\(true\)/);
  assert.match(lifecycle, /addNotificationReceivedListener/);
  assert.match(lifecycle, /AppState\.addEventListener/);
  assert.match(lifecycle, /refreshUnreadNotifications\(\)/);
});
test('temporary push presentation buttons and fake test API are removed', () => {
  const screen = read('src/features/notifications/notification-center.tsx');
  const service = read('src/services/notifications.ts');
  const push = read('src/features/notifications/push-device.ts');
  assert.doesNotMatch(screen, /Tester l’affichage|push de test depuis le serveur|testLocalAlert|testServerPush/);
  assert.doesNotMatch(service, /testPush/);
  assert.doesNotMatch(push, /testLocalPushPresentation/);
});
test('Firebase Android config matches package and Web ID; missing native OAuth registration is explicit', () => {
  const config = JSON.parse(read('google-services.json'));
  const client = config.client.find(c => c.client_info?.android_client_info?.package_name === 'com.lolys.medilink');
  assert.ok(client);
  assert.ok(client.oauth_client.some(c => c.client_type === 3 && c.client_id.endsWith('.apps.googleusercontent.com')));
  // A client_type=1 entry cannot be fabricated without the real Android SHA-1
  // registered in Firebase. Keep this check informational until authorized.
  const native = client.oauth_client.filter(c => c.client_type === 1);
  if (!native.length) {
    process.stdout.write('OAuth Android: SHA-1/SHA-256 must be registered in Firebase and google-services.json downloaded again.\n');
  }
});
