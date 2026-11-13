import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpClient, HttpError, makeMultipart } from './http-client.ts';

const response = (status, body, contentType = 'application/json') =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': contentType } });

test('GET: typed JSON, query parameters and Authorization', async () => {
  let called;
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => 'private-token',
    fetchImpl: async (url, init) => { called = { url, init }; return response(200, { items: [1] }); },
  });
  assert.deepEqual(await client.request('/doctors', { query: { q: 'médecin', page: 2, unused: null } }), { items: [1] });
  assert.equal(new URL(called.url).searchParams.get('q'), 'médecin');
  assert.equal(new URL(called.url).searchParams.get('page'), '2');
  assert.equal(new URL(called.url).searchParams.has('unused'), false);
  assert.equal(called.init.headers.Authorization, 'Bearer private-token');
});

test('public request omits token and JSON body is serialized', async () => {
  let init;
  const client = createHttpClient({ baseUrl: 'https://api.example.com',
    getAccessToken: () => 'secret', fetchImpl: async (_url, options) => { init = options; return response(200, { ok: true }); } });
  await client.request('/auth/login', { method: 'POST', authenticated: false, body: { email: 'a@b.com' } });
  assert.equal(init.headers.Authorization, undefined);
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { email: 'a@b.com' });
});

for (const [status, kind] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'not_found'],
  [409, 'conflict'], [422, 'validation'], [500, 'server']]) {
  test('maps HTTP ' + status + ' to ' + kind, async () => {
    const client = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl: async () => response(status, { message: ['Erreur', 'champ'] }) });
    await assert.rejects(client.request('/test'), err => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, status);
      assert.equal(err.kind, kind);
      assert.equal(err.message, 'Erreur, champ');
      return true;
    });
  });
}

test('onUnauthorized callback invoked on protected 401 only', async () => {
  let count = 0;
  const client = createHttpClient({ baseUrl: 'https://api.example.com',
    getAccessToken: () => 'expired-token', onUnauthorized: () => { count++; return false; }, fetchImpl: async () => response(401, { message: 'Expired' }) });
  await assert.rejects(client.request('/private'), { kind: 'unauthorized' });
  await assert.rejects(client.request('/public', { authenticated: false }), { kind: 'unauthorized' });
  assert.equal(count, 1);
});

test('204 and empty body return undefined', async () => {
  const client = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.equal(await client.request('/patients/me/documents/1', { method: 'DELETE' }), undefined);
});

test('invalid JSON success is an invalid_response error', async () => {
  const client = createHttpClient({ baseUrl: 'https://api.example.com',
    fetchImpl: async () => new Response('not-json', { status: 200 }) });
  await assert.rejects(client.request('/test'), { kind: 'invalid_response' });
});

test('React Native multipart file descriptors use uri, and no Content-Type boundary override', async () => {
  let init;
  const client = createHttpClient({ baseUrl: 'https://api.example.com',
    fetchImpl: async (_url, options) => { init = options; return response(200, { ok: true }); } });
  // Node's standard FormData rejects React Native's { uri, name, type } file
  // descriptor; substitute the native-compatible FormData contract for this test.
  const OriginalFormData = globalThis.FormData;
  class NativeFormData {
    fields = [];
    append(name, value) { this.fields.push({ name, value }); }
    get(name) { return this.fields.find(item => item.name === name)?.value ?? null; }
  }
  globalThis.FormData = NativeFormData;
  try {
    const file = { uri: 'file:///tmp/test.pdf', name: 'test.pdf', type: 'application/pdf' };
    const form = makeMultipart({ type: 'prescription' }, [{ field: 'file', file }]);
    await client.request('/patients/me/documents', { method: 'POST', formData: form, headers: { 'Content-Type': 'multipart/form-data' } });
    assert.equal(init.headers['Content-Type'], undefined);
    assert.equal(init.body, form);
    assert.equal(form.get('type'), 'prescription');
    assert.equal(form.get('file'), file);
  } finally {
    globalThis.FormData = OriginalFormData;
  }
});

test('already aborted signal never calls fetch', async () => {
  const controller = new AbortController();
  controller.abort();
  const client = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl: () => { throw new Error('should not send'); } });
  await assert.rejects(client.request('/test', { signal: controller.signal }), { kind: 'cancelled' });
});

test('in-flight abort classifies cancellation', async () => {
  const controller = new AbortController();
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  const work = client.request('/test', { signal: controller.signal });
  controller.abort();
  await assert.rejects(work, { kind: 'cancelled' });
});

test('timeout aborts request and reports timeout', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com', timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  await assert.rejects(client.request('/slow'), { kind: 'timeout' });
});

test('network failures are structured', async () => {
  const client = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(client.request('/any'), { kind: 'network' });
});

test('rejects external URLs and fragments', async () => {
  const client = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl: async () => response(200, {}) });
  await assert.rejects(client.request('https://evil.example.com'), /relatif/);
  await assert.rejects(client.request('//evil.example.com'), /relatif/);
  await assert.rejects(client.request('/any#fragment'), /relatif/);
});

test('401 refresh retries exactly once using the new token', async () => {
  let token = 'before';
  let count = 0;
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => token,
    getSessionKey: () => 'generation-1',
    onUnauthorized: previous => {
      assert.equal(previous, 'before');
      token = 'after';
      return true;
    },
    fetchImpl: async (_url, init) => {
      count++;
      if (count === 1) {
        assert.equal(init.headers.Authorization, 'Bearer before');
        return response(401, { message: 'expired' });
      }
      assert.equal(init.headers.Authorization, 'Bearer after');
      return response(200, { ok: true });
    },
  });
  assert.deepEqual(await client.request('/private'), { ok: true });
  assert.equal(count, 2);
});

test('persistent 401 retries only once, not recursively', async () => {
  let token = 'before';
  let count = 0;
  let refreshes = 0;
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => token,
    getSessionKey: () => 'gen',
    onUnauthorized: () => { refreshes++; token = 'after'; return true; },
    fetchImpl: async () => { count++; return response(401, { message: 'expired' }); },
  });
  await assert.rejects(client.request('/private'), { kind: 'unauthorized' });
  assert.equal(refreshes, 1);
  assert.equal(count, 2);
});

test('a new account invalidates retry of the old account request', async () => {
  let token = 'old';
  let generation = 'one';
  let count = 0;
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => token,
    getSessionKey: () => generation,
    onUnauthorized: () => { token = 'new-account'; generation = 'two'; return true; },
    fetchImpl: async () => { count++; return response(401, { message: 'expired' }); },
  });
  await assert.rejects(client.request('/private'), { kind: 'unauthorized' });
  assert.equal(count, 1);
});

test('401 again after retry revokes the rejected access token', async () => {
  let token = 'expired';
  let invalidated = null;
  let attempts = 0;
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => token,
    getSessionKey: () => 'same-account',
    onUnauthorized: () => { token = 'refreshed'; return true; },
    onRetryUnauthorized: rejected => { invalidated = rejected; },
    fetchImpl: async () => { attempts++; return response(401, { message: 'Forbidden' }); },
  });
  await assert.rejects(client.request('/private'), { kind: 'unauthorized' });
  assert.equal(invalidated, 'refreshed');
  assert.equal(attempts, 2);
});

test('old successful response is discarded after an account switch', async () => {
  const gate = (() => {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
  })();
  let generation = 'A';
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => 'token-A',
    getSessionKey: () => generation,
    fetchImpl: async () => { await gate.promise; return response(200, { secret: 'old account' }); },
  });
  const pending = client.request('/private');
  await Promise.resolve();
  generation = 'B';
  gate.resolve();
  await assert.rejects(pending, { kind: 'cancelled' });
});
