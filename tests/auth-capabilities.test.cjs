'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

async function setup(flag) {
  const env = flag === undefined ? {} : { AUTH_PROOF_VERSION: flag };
  const context = vm.createContext({ process: { env } });
  let corsCalls = 0;
  const fake = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const proof = new vm.SourceTextModule(fs.readFileSync(root + '/lib/auth/proof.js', 'utf8'), { context });
  await proof.link(spec => spec === 'node:crypto' ? fake({ default: crypto }) : fake({
    writeIfAbsent() { throw Error('discovery must not write the store'); },
    takeOnceStrict() { throw Error('discovery must not read/consume the store'); },
  }));
  const route = new vm.SourceTextModule(fs.readFileSync(root + '/api/auth-capabilities.js', 'utf8'), { context });
  await route.link(spec => spec.endsWith('/proof.js') ? proof : fake({
    applyCorsOrigin() { corsCalls++; },
    checkAuthLimit() { throw Error('discovery must not consume auth quota'); },
  }));
  await route.evaluate();
  async function call(method = 'GET', query = {}) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = JSON.parse(JSON.stringify(v)); return this; }, end() { return this; } };
    await route.namespace.default({ method, query, body: query, headers: {} }, res);
    return res;
  }
  return { call, env, corsCalls: () => corsCalls };
}
function cache(res) {
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.headers['cdn-cache-control'], 'no-store');
  assert.equal(res.headers['vercel-cdn-cache-control'], 'no-store');
  assert.equal(res.headers.etag, undefined);
  assert.equal(res.headers['last-modified'], undefined);
}
test('SEC-008 discovery advertises OFF for absent and every unsupported switch without auth/store access', async () => {
  for (const flag of [undefined, '', '0', 'true', '2', ' 1', '1 ']) {
    const h = await setup(flag), res = await h.call();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, proofVersion: 0 });
    cache(res);
    assert.equal(h.corsCalls(), 1);
  }
});
test('SEC-008 discovery advertises exact ON and reads current policy without dependency availability or stale caching', async () => {
  const h = await setup('1');
  assert.deepEqual((await h.call()).body, { ok: true, proofVersion: 1 });
  h.env.AUTH_PROOF_VERSION = '0';
  assert.deepEqual((await h.call()).body, { ok: true, proofVersion: 0 });
  h.env.AUTH_PROOF_VERSION = '1';
  const res = await h.call();
  assert.deepEqual(res.body, { ok: true, proofVersion: 1 });
  cache(res);
});
test('SEC-008 discovery has explicit no-store OPTIONS and rejects every mutating HTTP method', async () => {
  const h = await setup('1'), preflight = await h.call('OPTIONS');
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.body, undefined);
  assert.equal(preflight.headers['access-control-allow-methods'], 'GET, OPTIONS');
  cache(preflight);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const res = await h.call(method);
    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { ok: false, error: 'method-not-allowed' });
    cache(res);
  }
});
test('SEC-008 discovery is public policy only and request fields cannot select activation or expose configuration', async () => {
  const h = await setup('1');
  const res = await h.call('GET', { proofVersion: 0, AUTH_PROOF_VERSION: '0', provider: 'apple', session: 'untrusted', callback: 'https://untrusted.invalid' });
  assert.deepEqual(res.body, { ok: true, proofVersion: 1 });
  assert.equal(Object.keys(res.body).length, 2);
  assert.equal(res.headers.location, undefined);
});
