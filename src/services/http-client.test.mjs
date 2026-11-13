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
    onUnauthorized: () => { count++; }, fetchImpl: async () => response(401, { message: 'Expired' }) });
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
  const form = makeMultipart({ type: 'prescription' }, [{ field: 'file', file: { uri: 'file:///tmp/test.pdf', name: 'test.pdf', type: 'application/pdf' } }]);
  await client.request('/patients/me/documents', { method: 'POST', formData: form, headers: { 'Content-Type': 'multipart/form-data' } });
  assert.equal(init.headers['Content-Type'], undefined);
  assert.equal(init.body, form);
  assert.equal(form.get('type'), 'prescription');
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
