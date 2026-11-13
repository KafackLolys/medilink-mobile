import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from './session-manager.ts';

const user = (id = 'u1', role = 'patient') => ({
  id, role, status: 'active', email: 'test@example.com',
});
const response = (id = 'u1', token = 'id-A', refresh = 'refresh-A', role = 'patient', expiresIn = 3600) => ({
  user: user(id, role), idToken: token, refreshToken: refresh,
  tokenType: 'Bearer', expiresIn,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

function fixture({ stored = null, refresh, profile, logout, now = () => 100000 } = {}) {
  let persisted = stored;
  const writes = [];
  const snapshots = [];
  let purges = 0;
  let refreshCalls = 0;
  let logoutCalls = 0;
  const manager = new SessionManager({
    now,
    storage: {
      read: async () => persisted,
      write: async v => { persisted = v; writes.push(v); },
      clear: async () => { persisted = null; },
    },
    endpoints: {
      refresh: async token => { refreshCalls++; return refresh ? refresh(token) : response(); },
      profile: async token => profile ? profile(token) : { user: user() },
      logout: async token => { logoutCalls++; return logout ? logout(token) : { message: 'revoked' }; },
    },
    hooks: {
      publish: value => snapshots.push(value),
      purge: () => { purges++; },
    },
  });
  return {
    manager, writes, snapshots,
    get persisted() { return persisted; },
    get refreshCalls() { return refreshCalls; },
    get logoutCalls() { return logoutCalls; },
    get purges() { return purges; },
  };
}

test('login verifies the API profile before granting the role and persists tokens', async () => {
  const x = fixture({ profile: async () => ({ user: user('u1', 'doctor') }) });
  await x.manager.login(response('u1'));
  assert.equal(x.manager.snapshot.status, 'authenticated');
  assert.equal(x.manager.snapshot.role, 'doctor');
  assert.equal(x.manager.idToken, 'id-A');
  assert.equal(x.persisted.refreshToken, 'refresh-A');
  assert.equal(x.persisted.expiresAt, 3700000);
});

test('login rejects profile identity mismatch and removes local tokens', async () => {
  const x = fixture({ profile: async () => ({ user: user('other') }) });
  await assert.rejects(x.manager.login(response()), /profil incohérent/i);
  assert.equal(x.manager.snapshot.status, 'unauthenticated');
  assert.equal(x.persisted, null);
});

test('cold start restores and refreshes before routing', async () => {
  const x = fixture({
    stored: { idToken: 'old', refreshToken: 'refresh-old', userId: 'u1', expiresAt: 0 },
    refresh: async () => response('u1', 'new', 'refresh-new', 'patient'),
  });
  await x.manager.bootstrap();
  assert.equal(x.manager.snapshot.status, 'authenticated');
  assert.equal(x.manager.idToken, 'new');
  assert.equal(x.persisted.refreshToken, 'refresh-new');
  assert.equal(x.refreshCalls, 1);
});

test('cold start without session yields unauthenticated without API calls', async () => {
  const x = fixture();
  await x.manager.bootstrap();
  assert.equal(x.manager.snapshot.status, 'unauthenticated');
  assert.equal(x.refreshCalls, 0);
});

test('invalid refresh clears saved credentials and prevents protected routing', async () => {
  const x = fixture({
    stored: { idToken: 'old', refreshToken: 'r', userId: 'u1', expiresAt: 0 },
    refresh: async () => { throw new Error('revoked'); },
  });
  await x.manager.bootstrap();
  assert.equal(x.manager.snapshot.status, 'unauthenticated');
  assert.equal(x.persisted, null);
});

test('401 refresh is single-flight for simultaneous requests', async () => {
  const gate = deferred();
  const x = fixture({ refresh: () => gate.promise });
  await x.manager.login(response());
  const a = x.manager.onUnauthorized('id-A');
  const b = x.manager.onUnauthorized('id-A');
  gate.resolve(response('u1', 'id-B', 'refresh-B'));
  assert.deepEqual(await Promise.all([a,b]), [true, true]);
  assert.equal(x.refreshCalls, 1);
  assert.equal(x.manager.idToken, 'id-B');
  assert.equal(x.persisted.refreshToken, 'refresh-B');
});

test('late refresh cannot overwrite a newer login/account', async () => {
  const gate = deferred();
  const x = fixture({
    refresh: () => gate.promise,
    profile: async token => ({ user: token === 'id-new-user' ? user('u2', 'doctor') : user('u1') }),
  });
  await x.manager.login(response());
  const oldRefresh = x.manager.refresh();
  await x.manager.login(response('u2', 'id-new-user', 'new-user-refresh', 'doctor'));
  gate.resolve(response('u1', 'stale-token', 'stale-refresh'));
  assert.equal(await oldRefresh, false);
  assert.equal(x.manager.idToken, 'id-new-user');
  assert.equal(x.manager.snapshot.role, 'doctor');
  assert.equal(x.persisted.refreshToken, 'new-user-refresh');
});

test('logout locally clears immediately and sends server revocation', async () => {
  const gate = deferred();
  const x = fixture({ logout: () => gate.promise });
  await x.manager.login(response());
  const pending = x.manager.logout();
  // Storage purge runs before the server logout call.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.manager.snapshot.status, 'unauthenticated');
  assert.equal(x.persisted, null);
  assert.equal(x.logoutCalls, 1);
  gate.resolve({ message: 'revoked' });
  await pending;
});

test('offline logout still removes the session and is idempotent', async () => {
  const x = fixture({ logout: async () => { throw new Error('offline'); } });
  await x.manager.login(response());
  await x.manager.logout();
  await x.manager.logout();
  assert.equal(x.persisted, null);
  assert.equal(x.manager.idToken, null);
  assert.equal(x.logoutCalls, 1);
});

test('failed secure storage write never authenticates', async () => {
  const states = [];
  let cleared = false;
  const manager = new SessionManager({
    storage: {
      read: async () => null,
      write: async () => { throw new Error('secure storage unavailable'); },
      clear: async () => { cleared = true; },
    },
    endpoints: {
      profile: async () => ({ user: user() }),
      refresh: async () => response(),
      logout: async () => ({}),
    },
    hooks: { publish: s => states.push(s), purge: () => {} },
  });
  await assert.rejects(manager.login(response()), /secure storage unavailable/);
  assert.equal(manager.snapshot.status, 'unauthenticated');
  assert.equal(cleared, true);
  assert.ok(!states.some(s => s.status === 'authenticated'));
});

test('logout invalidates a pending refresh even if its response eventually succeeds', async () => {
  const gate = deferred();
  const x = fixture({ refresh: () => gate.promise });
  await x.manager.login(response());
  const old = x.manager.refresh();
  await x.manager.logout();
  gate.resolve(response('u1', 'should-not-return', 'rotated'));
  assert.equal(await old, false);
  assert.equal(x.persisted, null);
});

test('expired token refreshes before next protected call', async () => {
  let time = 1000;
  const x = fixture({ now: () => time, refresh: async () => response('u1', 'id-new', 'refresh-new') });
  await x.manager.login(response('u1','old','old-r','patient',1));
  time += 2000;
  assert.equal(await x.manager.validAccessToken(), 'id-new');
  assert.equal(x.refreshCalls, 1);
});
