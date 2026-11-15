import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(import.meta.dirname, '..');
const read = file => readFileSync(join(root, file), 'utf8');

test('Google Sign-In native binding is loaded only on user interaction', () => {
  const module = read('src/features/auth/google-sign-in.ts');
  const rootLayout = read('src/app/_layout.tsx');
  assert.match(module, /await import\(['"]@react-native-google-signin\/google-signin['"]\)/);
  assert.doesNotMatch(module, /^import \{.*GoogleSignin.*\} from ['"]@react-native-google-signin/m);
  assert.doesNotMatch(rootLayout, /from ['"]@react-native-google-signin\/google-signin/);
});

test('push is an optional lazy-mounted module, not a bootstrap prerequisite', () => {
  const layout = read('src/app/_layout.tsx');
  const session = read('src/features/auth/session.ts');
  assert.match(layout, /import\(['"]@\/features\/notifications\/push-lifecycle['"]\)/);
  assert.doesNotMatch(layout, /^import .*push-lifecycle/m);
  assert.match(session, /import\(['"]@\/features\/notifications\/push-device['"]\)/);
  assert.match(session, /import\(['"]@\/features\/auth\/google-sign-in['"]\)/);
  assert.doesNotMatch(session, /from ['"]@\/features\/auth\/google-auth['"]/);
});

test('manifest dependency ranges exactly match npm lockfile', () => {
  const packageText = read('package.json');
  const pkg = JSON.parse(packageText);
  const lock = JSON.parse(read('package-lock.json'));
  assert.deepEqual(pkg.dependencies, lock.packages[''].dependencies);
  assert.deepEqual(pkg.devDependencies, lock.packages[''].devDependencies);
  for (const name of ['@react-native-google-signin/google-signin','expo-notifications','expo-secure-store','expo-dev-client']) {
    assert.equal(packageText.split(JSON.stringify(name) + ':').length - 1, 1, name);
  }
});

test('Android development build config reuses canonical EAS project and Google services file', () => {
  const require = createRequire(import.meta.url);
  const configure = require('../app.config.js');
  const config = require('../app.json').expo;
  const vars = ['EAS_BUILD_PROFILE','MEDILINK_EAS_PROJECT_ID','MEDILINK_ANDROID_PACKAGE',
    'MEDILINK_GOOGLE_SERVICES_FILE','EXPO_PUBLIC_API_BASE_URL'];
  const old = Object.fromEntries(vars.map(k => [k,process.env[k]]));
  try {
    process.env.EAS_BUILD_PROFILE = 'development';
    delete process.env.MEDILINK_EAS_PROJECT_ID;
    delete process.env.MEDILINK_ANDROID_PACKAGE;
    delete process.env.MEDILINK_GOOGLE_SERVICES_FILE;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://medilink-api-lilac.vercel.app';
    const result = configure({config});
    assert.equal(result.android.package, 'com.lolys.medilink');
    assert.equal(result.android.googleServicesFile,'./google-services.json');
    assert.equal(result.extra.eas.projectId, config.extra.eas.projectId);
  } finally {
    for (const [key,value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
