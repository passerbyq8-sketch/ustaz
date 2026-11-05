'use strict';
// Real route/account/OIDC code; only storage, network and unrelated services are synthetic.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');

async function harness({ clockStep = 0 } = {}) {
  const data = new Map(), operations = [];
  const faults = { get: false, set: false, down: false };
  let now = Date.now();
  const env = { KV_REST_API_URL: 'https://synthetic.invalid', KV_REST_API_TOKEN: 'synthetic-only' };
  const redis = {
    async get(key) {
      if (faults.down || faults.get) throw Error('synthetic store outage');
      const held = data.get(key);
      if (held && held.until && held.until <= now) { data.delete(key); return null; }
      return held ? structuredClone(held.value) : null;
    },
    async set(key, value, opts = {}) {
      if (faults.down || faults.set) throw Error('synthetic store outage');
      operations.push({ key, opts });
      const held = data.get(key);
      if (held && held.until && held.until <= now) data.delete(key);
      if (opts.nx && data.has(key)) return null;
      data.set(key, { value: typeof value === 'string' ? JSON.parse(value) : structuredClone(value), until: opts.ex ? now + opts.ex * 1000 : 0 });
      return 'OK';
    },
    async del(key) { if (faults.down) throw Error('synthetic outage'); return data.delete(key) ? 1 : 0; },
    async expire(key, ttl) { if (faults.down) throw Error('synthetic outage'); const held = data.get(key); if (held) held.until = now + ttl * 1000; return held ? 1 : 0; },
  };
  redis.eval = async (script, keys, args) => {
    if (faults.down || faults.eval) throw Error('synthetic store outage');
    if (redis.beforeEval) await redis.beforeEval(script, keys, args);
    return require('./auth-lua-fixture.cjs').runAuthLua(script, keys, args, {
      get(key) {
        if (faults.get) throw Error('synthetic read outage');
        const held = data.get(key);
        if (held && held.until && held.until <= now) { data.delete(key); return null; }
        return held ? JSON.stringify(held.value) : null;
      },
      set(key, value, ttl) {
        if (faults.set) throw Error('synthetic write outage');
        operations.push({ key, opts: { ex: ttl } });
        data.set(key, { value: JSON.parse(value), until: ttl ? now + ttl * 1000 : 0 }); return 'OK';
      },
      del(key) { if (faults.del) throw Error('synthetic delete outage'); return data.delete(key) ? 1 : 0; },
    });
  };
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'synthetic-key', alg: 'RS256', use: 'sig' };
  const nonce = 'synthetic-native-nonce-for-security-test';
  const logs = [];
  const http = { idToken: null, calls: [], responses: new Map() };
  const effects = { weld: 0, erase: 0 };
  const context = vm.createContext({
    Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    Date: class extends Date { static now() { const value = now; now += clockStep; return value; } },
    process: { env }, console: { log: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
    fetch: async (url) => {
      http.calls.push(url);
      if (http.responses.has(url)) {
        const response = http.responses.get(url);
        if (response instanceof Error) throw response;
        return response;
      }
      if (['https://appleid.apple.com/auth/keys', 'https://www.googleapis.com/oauth2/v3/certs'].includes(url)) {
        return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
      }
      if (['https://appleid.apple.com/auth/token', 'https://oauth2.googleapis.com/token'].includes(url)) {
        return { ok: true, status: 200, json: async () => ({ id_token: http.idToken }) };
      }
      throw Error('unexpected outbound request');
    },
  });
  const cache = new Map();
  function synthetic(id, values) {
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context, identifier: id });
  }
  function moduleFor(id) {
    if (cache.has(id)) return cache.get(id);
    let mod;
    if (id === 'node:crypto') mod = synthetic(id, { default: crypto });
    else if (id === '@upstash/redis') mod = synthetic(id, { Redis: class { constructor() { return redis; } } });
    else if (id.endsWith('/lib/ratelimit.js')) mod = synthetic(id, { applyCorsOrigin() {}, checkAuthLimit: async () => ({ ok: !faults.rate }) });
    else if (id.endsWith('/lib/sync/service.js')) mod = synthetic(id, { weldByVerifiedEmail: async () => { effects.weld++; return { welded: false }; }, eraseForAccountDelete: async () => { effects.erase++; if (faults.erase) throw Error('synthetic erase outage'); } });
    else if (id.endsWith('/lib/daycap.js')) mod = synthetic(id, { DEVICE_HEADER: 'x-murabbi-device', FOUNDER_HEADER: 'x-founder', hasUnrevokedFounderToken: async () => false, safeId: value => value || null, kuwaitDayStamp: () => 'synthetic-day', DAY_CAP_TTL_SECONDS: 172800 });
    else if (id.endsWith('/lib/answer-log.js')) mod = synthetic(id, { readAnswerLog: async () => [], ANSWER_LOG_PATHS: [] });
    else if (id.endsWith('/lib/usage.js')) mod = synthetic(id, { readUsage() {}, readUsageChat() {}, usageAnswerOutcome() {}, usageWindow() {} });
    else if (id.endsWith('.json')) mod = synthetic(id, { default: JSON.parse(fs.readFileSync(id, 'utf8')) });
    else mod = new vm.SourceTextModule(fs.readFileSync(id, 'utf8'), { context, identifier: id });
    cache.set(id, mod);
    return mod;
  }
  async function load(rel) {
    const mod = moduleFor(path.resolve(ROOT, rel).replaceAll('\\', '/'));
    if (mod.status === 'unlinked') await mod.link((spec, parent) => moduleFor(spec.startsWith('.') ? path.resolve(path.dirname(parent.identifier), spec).replaceAll('\\', '/') : spec));
    if (mod.status === 'linked') await mod.evaluate();
    return mod.namespace;
  }
  function sign(overrides = {}, privateKey = pair.privateKey) {
    const claims = { iss: 'https://appleid.apple.com', aud: 'app.ezik.tutor', sub: 'synthetic-subject', exp: Math.floor(now / 1000) + 600, iat: Math.floor(now / 1000), nonce, ...overrides };
    const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid })).toString('base64url');
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const unsigned = head + '.' + body;
    return unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  }
  async function post(file, body) {
    const handler = (await load(file)).default;
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
    await handler({ method: 'POST', headers: { 'x-murabbi-device': 'synthetic-device' }, body }, res);
    return res;
  }
  return { data, operations, faults, redis, env, logs, http, effects, load, sign, nonce, post, now: () => now, advance(ms) { now += ms; } };
}
module.exports = { harness };
