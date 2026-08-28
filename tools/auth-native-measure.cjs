// auth-native-measure.cjs -- the NATIVE sign-in door, proved without a provider, a device or a network.
//
// WHAT THIS MEASURES. api/auth-native.js accepts an identity token the device obtained from the
// native sheet itself and returns the session the web path returns. There is no redirect, no code
// and no client secret on that path, so the only thing standing between a stranger and an account
// is the verification ladder: signature, issuer, audience, expiry, issued-at, nonce. This tool
// drives the REAL route against a store it controls and a provider whose signing key it holds, and
// asserts the ladder one rung at a time.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every module is read from disk, parsed with
// @babel/parser, and its import and export statements are the ONLY thing rewritten -- the same
// lifting tools/auth-server-measure.cjs does, for the same reason: lib/ratelimit.js builds an
// Upstash client at module scope and would reach for credentials this machine does not have.
//
// 🔴 THE FOUR CONTROLS THE ORDER OF 2026-08-28 REQUIRES ARE CASES C1..C4 BELOW, and this tool
// REFUSES TO PASS IF ALL FOUR ARE ACCEPTED. A probe on which every token is waved through is not a
// probe; the self-check at the end names that outcome and exits 1. One token must be taken and
// three must be refused, each for its own reason, or this file has measured nothing.
//
// THE PROVIDER IS REAL CRYPTOGRAPHY. Two RSA key pairs are generated in memory: the provider's,
// whose public half is published at the fake JWKS endpoint, and a FOREIGN one that is published
// nowhere. So "a token with a broken signature is refused" is a genuine signature failure.
//
// NOTHING IS WRITTEN TO THE TREE: no key file, no fixture, no temporary directory.
//
// Usage:  node tools/auth-native-measure.cjs
// Exit:   0 when every case holds; 1 with the failures named.
'use strict';

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('node:crypto');

const REPO = path.join(__dirname, '..');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));

const NEW_MODULES = [
  'lib/auth/store.js',
  'lib/auth/oidc.js',
  'lib/auth/account.js',
  'api/auth-native.js',
  'api/auth-exchange.js',
];

const SOURCES = {};
for (const rel of NEW_MODULES) SOURCES[rel] = fs.readFileSync(path.join(REPO, rel), 'utf8');
const RATELIMIT_SRC = fs.readFileSync(path.join(REPO, 'lib', 'ratelimit.js'), 'utf8');
const ATTEMPTS_SRC = fs.readFileSync(path.join(REPO, 'lib', 'attempts.js'), 'utf8');
const DAYCAP_SRC = fs.readFileSync(path.join(REPO, 'lib', 'daycap.js'), 'utf8');

// ---------------------------------------------------------------------------
// LIFTING AN ES MODULE INTO THIS PROCESS -- imports and exports rewritten, nothing else.
// ---------------------------------------------------------------------------

function rewriteModule(source, rel) {
  const ast = parser.parse(source, { sourceType: 'module' });
  const edits = [];
  const exported = [];

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const from = JSON.stringify(node.source.value);
      const named = [];
      let defaultName = null;
      let namespaceName = null;
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') defaultName = spec.local.name;
        else if (spec.type === 'ImportNamespaceSpecifier') namespaceName = spec.local.name;
        else named.push(spec.imported.name === spec.local.name
          ? spec.local.name : spec.imported.name + ': ' + spec.local.name);
      }
      const lines = [];
      if (defaultName) lines.push('const ' + defaultName + ' = __dep(' + from + ').default;');
      if (namespaceName) lines.push('const ' + namespaceName + ' = __dep(' + from + ');');
      if (named.length) lines.push('const { ' + named.join(', ') + ' } = __dep(' + from + ');');
      edits.push({ start: node.start, end: node.end, text: lines.join(' ') });
      continue;
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (!node.declaration) throw new Error(rel + ': `export { ... }` is not handled by this tool');
      const d = node.declaration;
      if (d.type === 'VariableDeclaration') {
        for (const decl of d.declarations) {
          if (decl.id.type !== 'Identifier') throw new Error(rel + ': destructured export');
          exported.push(decl.id.name);
        }
      } else if (d.type === 'FunctionDeclaration') {
        exported.push(d.id.name);
      } else {
        throw new Error(rel + ': unhandled export declaration ' + d.type);
      }
      edits.push({ start: node.start, end: d.start, text: '' });
      continue;
    }
    if (node.type === 'ExportDefaultDeclaration') {
      const d = node.declaration;
      if (d.type !== 'FunctionDeclaration' || !d.id) {
        throw new Error(rel + ': default export is not a named function declaration');
      }
      exported.push(d.id.name);
      exported.push('default: ' + d.id.name);
      edits.push({ start: node.start, end: d.start, text: '' });
      continue;
    }
    if (node.type === 'ExportAllDeclaration') throw new Error(rel + ': `export *` is not handled');
  }

  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { body: out, exported };
}

const GLOBAL_PREAMBLE = [
  '"use strict";',
  'const process = __env.process;',
  'const fetch = __env.fetch;',
  'const console = __env.console;',
  'const Date = __env.Date;',
].join('\n');

function compileModule(rel, source) {
  const { body, exported } = rewriteModule(source, rel);
  const full = GLOBAL_PREAMBLE + '\n' + body + '\n;return { ' + exported.join(', ') + ' };';
  return { factory: new Function('__dep', '__env', full), text: full };
}

function namedDeclarations(source) {
  const ast = parser.parse(source, { sourceType: 'module' });
  const found = new Map();
  const consider = (node, decl) => {
    if (decl.type === 'FunctionDeclaration' && decl.id) found.set(decl.id.name, node);
    else if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier') found.set(d.id.name, node);
      }
    }
  };
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const d = node.declaration;
      consider({ start: d.start, end: d.end }, { type: d.type, id: d.id, declarations: d.declarations });
    } else {
      consider(node, node);
    }
  }
  return { source, found };
}

function liftNames(bundleName, bundle, names) {
  const parts = [];
  for (const name of names) {
    const node = bundle.found.get(name);
    if (!node) throw new Error(bundleName + ' no longer declares ' + name + ' at the top level');
    parts.push(bundle.source.slice(node.start, node.end));
  }
  return parts.join('\n');
}

const RATELIMIT_AUTH_TEXT = liftNames('lib/ratelimit.js', namedDeclarations(RATELIMIT_SRC),
  ['ALLOWED_ORIGINS', 'applyCorsOrigin', 'AUTH_FAIL_OPEN', 'AUTH_PER_IP_MIN', 'AUTH_PER_IP_DAY',
    'AUTH_WINDOWS', 'checkAuthLimit']);
const ATTEMPTS_TEXT = liftNames('lib/attempts.js', namedDeclarations(ATTEMPTS_SRC), ['clientAddress']);
const DAYCAP_TEXT = liftNames('lib/daycap.js', namedDeclarations(DAYCAP_SRC), ['DEVICE_HEADER', 'safeId']);

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

function fakeClock(startMs) {
  let now = startMs;
  return { now: () => now, advance: (ms) => { now += ms; }, Date: { now: () => now } };
}

function runLua(script, keys, argv, store) {
  const locals = Object.create(null);
  const lines = String(script).split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    let m;
    if ((m = /^local\s+(\w+)\s*=\s*redis\.call\('GET',\s*KEYS\[(\d+)\]\)$/.exec(line))) {
      locals[m[1]] = store.rawGet(keys[Number(m[2]) - 1]);
      continue;
    }
    if ((m = /^if\s+(\w+)\s+then\s+redis\.call\('DEL',\s*KEYS\[(\d+)\]\)\s+end$/.exec(line))) {
      const v = locals[m[1]];
      if (v !== null && v !== undefined) store.rawDel(keys[Number(m[2]) - 1]);
      continue;
    }
    if ((m = /^return\s+(\w+)$/.exec(line))) {
      const v = locals[m[1]];
      return v === undefined ? null : v;
    }
    throw new Error('the fake store cannot run this Lua line: ' + line);
  }
  return null;
}

function fakeStore(clock, opts) {
  const o = opts || {};
  const map = new Map();
  const ops = [];
  const self = {
    ops,
    keys: () => {
      const live = [];
      for (const k of map.keys()) if (self.rawGet(k) !== null) live.push(k);
      return live.sort();
    },
    rawGet(k) {
      const rec = map.get(k);
      if (!rec) return null;
      if (rec.expiresAt !== null && rec.expiresAt <= clock.now()) { map.delete(k); return null; }
      return rec.value;
    },
    rawDel(k) { map.delete(k); },
    ttlOf(k) {
      const rec = map.get(k);
      if (!rec || rec.expiresAt === null) return null;
      return Math.round((rec.expiresAt - clock.now()) / 1000);
    },
    writesTo(prefix) { return ops.filter((op) => op.cmd === 'set' && op.key.startsWith(prefix)).length; },
  };

  function Redis(cfg) { this.url = cfg && cfg.url; this.token = cfg && cfg.token; }
  Redis.prototype.get = async function (k) {
    ops.push({ cmd: 'get', key: k });
    if (o.throwOn && o.throwOn.has('get')) throw new Error('fake store refused GET');
    return self.rawGet(k);
  };
  Redis.prototype.set = async function (k, v, options) {
    const nx = !!(options && options.nx);
    ops.push({ cmd: 'set', key: k, nx, ex: options && options.ex ? options.ex : null });
    if (o.throwOn && o.throwOn.has('set')) throw new Error('fake store refused SET');
    if (nx && self.rawGet(k) !== null) return null;
    const ex = options && options.ex ? options.ex : null;
    map.set(k, { value: v, expiresAt: ex === null ? null : clock.now() + ex * 1000 });
    return 'OK';
  };
  Redis.prototype.del = async function (k) {
    ops.push({ cmd: 'del', key: k });
    if (o.throwOn && o.throwOn.has('del')) throw new Error('fake store refused DEL');
    map.delete(k);
    return 1;
  };
  Redis.prototype.expire = async function (k, seconds) {
    ops.push({ cmd: 'expire', key: k, ex: seconds });
    const rec = map.get(k);
    if (rec) rec.expiresAt = clock.now() + seconds * 1000;
    return 1;
  };
  Redis.prototype.eval = async function (script, keys, argv) {
    ops.push({ cmd: 'eval', key: (keys && keys[0]) || '', script });
    if (o.throwOn && o.throwOn.has('eval')) throw new Error('fake store refused EVAL');
    return runLua(script, keys || [], argv || [], self);
  };
  self.Redis = Redis;
  return self;
}

/** An RSA key pair and its JWK, generated in memory. Nothing touches the disk. */
function makeSigner(kid) {
  const pair = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return {
    jwk,
    sign(header, claims) {
      const h = Buffer.from(JSON.stringify(Object.assign({ alg: 'RS256', kid, typ: 'JWT' }, header || {})))
        .toString('base64url');
      const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const s = nodeCrypto.sign('RSA-SHA256', Buffer.from(h + '.' + p, 'ascii'), pair.privateKey)
        .toString('base64url');
      return h + '.' + p + '.' + s;
    },
  };
}

function fakeConsole() {
  const lines = [];
  const sink = (level) => (...args) => {
    lines.push(level + ' ' + args.map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' '));
  };
  return { lines, log: sink('log'), warn: sink('warn'), error: sink('error'), info: sink('info'), debug: sink('debug') };
}

function fakeReq(o) {
  const opts = o || {};
  const headers = {};
  for (const [k, v] of Object.entries(opts.headers || {})) headers[k.toLowerCase()] = v;
  return { method: opts.method || 'POST', query: opts.query || {}, body: opts.body, headers };
}

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = v; return res; };
  res.getHeader = (k) => res.headers[String(k).toLowerCase()];
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; res.ended = true; return res; };
  res.send = (b) => { res.body = b; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

// ---------------------------------------------------------------------------
// THE GRAPH.
// ---------------------------------------------------------------------------

const FIXTURE = {
  // Short and non-secret-looking, so recon-audit's scanner has nothing to find here.
  webClientId: 'svc-9001',
  sub: '000123.abcdef.0001',
  email: 'Reader@Example.COM',
  rawNonce: 'nonce-abcdef-0123456789',
};

// The App ID the order pins. Read from the provider table at run time as well, and the two are
// asserted equal -- so a change to the table moves the expectation with it rather than leaving
// this file measuring an older idea of the audience.
const APP_ID = 'app.ezik.tutor';
const WRONG_APP_ID = 'app.WRONG.tutor';

function buildGraph(options) {
  const o = options || {};
  const clock = fakeClock(o.startMs || 1756000000000);
  const store = fakeStore(clock, { throwOn: o.storeThrowsOn ? new Set(o.storeThrowsOn) : null });
  const signer = o.signer || makeSigner('kid-native-1');
  const console_ = fakeConsole();

  const env = Object.assign({
    // THE CLIENT SECRET IS DELIBERATELY ABSENT. The native door must not need it.
    APPLE_OAUTH_CLIENT_ID: FIXTURE.webClientId,
    KV_REST_API_URL: 'https://store.invalid',
    KV_REST_API_TOKEN: 'store-tok',
  }, o.env || {});
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];

  const cache = new Map();
  const pending = new Set();
  const provider = { calls: [], jwksStatus: 200, jwksKeys: null, jwksThrows: false };

  const Ratelimit = (function makeRatelimit() {
    function R(opts) { this.prefix = opts.prefix; }
    R.slidingWindow = (n, w) => ({ n, w });
    R.prototype.limit = async function (ip) {
      if (o.throttle) return o.throttle(this.prefix, ip);
      return { success: true };
    };
    return R;
  }());

  const moduleEnv = {
    process: { env },
    console: console_,
    Date: clock.Date,
    fetch: async (url, opts2) => {
      const href = String(url);
      provider.calls.push({ url: href, method: (opts2 && opts2.method) || 'GET' });
      if (href === jwksUrl) {
        if (provider.jwksThrows) throw new Error('network is down');
        return { status: provider.jwksStatus, json: async () => ({ keys: provider.jwksKeys || [signer.jwk] }) };
      }
      throw new Error('the native path reached an endpoint nobody registered: ' + href);
    },
  };

  function dep(spec, fromRel) {
    if (spec === 'node:crypto') return Object.assign({ default: nodeCrypto }, nodeCrypto);
    if (spec === '@upstash/redis') return { Redis: store.Redis };
    if (spec.endsWith('/ratelimit.js')) return shims.ratelimit;
    if (spec.endsWith('/attempts.js')) return shims.attempts;
    if (spec.endsWith('/daycap.js')) return shims.daycap;
    const base = path.posix.dirname(fromRel);
    const rel = path.posix.normalize(path.posix.join(base, spec));
    if (!SOURCES[rel]) throw new Error(fromRel + ' imports an unknown module: ' + spec);
    return load(rel);
  }

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    if (pending.has(rel)) throw new Error('import cycle at ' + rel);
    pending.add(rel);
    const compiled = compileModule(rel, SOURCES[rel]);
    const ns = compiled.factory((spec) => dep(spec, rel), moduleEnv);
    cache.set(rel, ns);
    pending.delete(rel);
    return ns;
  }

  const shims = {};
  {
    shims.ratelimit = new Function('Ratelimit', 'redis', 'console', RATELIMIT_AUTH_TEXT
      + '\n;return { ALLOWED_ORIGINS, applyCorsOrigin, checkAuthLimit, AUTH_FAIL_OPEN,'
      + ' AUTH_PER_IP_MIN, AUTH_PER_IP_DAY, AUTH_WINDOWS };')(Ratelimit, {}, console_);
    shims.attempts = new Function(ATTEMPTS_TEXT + '\n;return { clientAddress };')();
    shims.daycap = new Function(DAYCAP_TEXT + '\n;return { DEVICE_HEADER, safeId };')();
  }

  const oidc = load('lib/auth/oidc.js');
  const jwksUrl = oidc.PROVIDERS.apple.jwksUrl;

  return {
    clock, store, signer, provider, console: console_, env, load, oidc, jwksUrl,
    storeMod: load('lib/auth/store.js'),
    account: load('lib/auth/account.js'),
    native: load('api/auth-native.js'),
    exchange: load('api/auth-exchange.js'),
  };
}

// ---------------------------------------------------------------------------
// THE ROUTE, DRIVEN.
// ---------------------------------------------------------------------------

const APPLE = 'apple';   // the name the shell sends in the body; never a branch in the route.

function sha256hex(s) { return nodeCrypto.createHash('sha256').update(String(s), 'utf8').digest('hex'); }

/**
 * Claims a real native sheet would carry, plus whatever the case overrides.
 *
 * THE `nonce` CLAIM IS THE RAW VALUE, because that is what the provider returns: it echoes the
 * nonce the app handed the sheet, verbatim, and never hashes it. A fixture that hashed here would
 * be a mirror of a wrong belief in the route rather than a measurement of the provider.
 */
function nativeClaims(g, over) {
  const now = Math.floor(g.clock.now() / 1000);
  return Object.assign({
    iss: 'https://appleid.apple.com',
    aud: APP_ID,
    sub: FIXTURE.sub,
    exp: now + 600,
    iat: now,
    nonce: FIXTURE.rawNonce,
    email: FIXTURE.email,
    email_verified: 'true',
  }, over || {});
}

async function post(g, body, opts) {
  const o = opts || {};
  const req = fakeReq({ method: o.method || 'POST', body, headers: o.headers || {} });
  const res = fakeRes();
  await g.native.default(req, res);
  return res;
}

// ---------------------------------------------------------------------------
// THE CASES.
// ---------------------------------------------------------------------------

const queue = [];
const results = [];
function run(name, fn) { queue.push({ name, fn }); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': got ' + a + ', wanted ' + b);
}
function is(cond, what) { if (!cond) throw new Error(what); }

/* -- THE FOUR CONTROLS THE ORDER REQUIRES -------------------------------------
 *
 * Recorded in VERDICTS as well as asserted, because the last case in this file refuses to pass
 * when all four were accepted: a probe that waves every token through has measured nothing.
 */
const VERDICTS = {};

run('C1 a token minted here for the App ID, correctly signed, with a matching nonce -- IS ACCEPTED', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  VERDICTS.C1 = res.statusCode;
  eq(res.statusCode, 200, 'the status for a good native token');
  eq(res.body.ok, true, 'the ok flag');
  is(typeof res.body.session === 'string' && res.body.session.length > 0, 'no session was returned');
  eq(res.body.email, FIXTURE.email, 'the address returned');
  eq(res.body.provider, APPLE, 'the provider returned');
  return 'HTTP 200 · session ' + res.body.session.length + ' chars · ACCEPTED';
});

run('C2 the same token in every respect EXCEPT the audience (app.WRONG.tutor) -- IS REFUSED', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g, { aud: WRONG_APP_ID }));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  VERDICTS.C2 = res.statusCode;
  eq(res.statusCode, 401, 'the status for a foreign audience');
  eq(res.body.error, 'auth-idtoken-audience', 'the refusal code');
  is(res.body.session === undefined, 'a session was returned to a foreign audience');
  eq(g.store.writesTo(g.storeMod.SESSION_PREFIX), 0, 'sessions written for a foreign audience');
  eq(g.store.writesTo(g.storeMod.ACCOUNT_PREFIX), 0, 'accounts written for a foreign audience');
  return 'HTTP 401 auth-idtoken-audience · REFUSED';
});

run('C3 the right audience, the WRONG SIGNATURE (a key nobody published) -- IS REFUSED', async () => {
  const g = buildGraph({});
  const foreign = makeSigner('kid-native-1');   // same kid, different key: the kid alone proves nothing
  const token = foreign.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  VERDICTS.C3 = res.statusCode;
  eq(res.statusCode, 401, 'the status for a foreign signature');
  eq(res.body.error, 'auth-idtoken-signature', 'the refusal code');
  eq(g.store.writesTo(g.storeMod.SESSION_PREFIX), 0, 'sessions written for a foreign signature');
  return 'HTTP 401 auth-idtoken-signature · REFUSED';
});

run('C4 a valid token whose rawNonce does not match the claim in it -- IS REFUSED', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, {
    provider: APPLE, identityToken: token, rawNonce: 'nonce-SOMETHING-ELSE-0001',
  });
  VERDICTS.C4 = res.statusCode;
  eq(res.statusCode, 401, 'the status for a nonce that does not match');
  eq(res.body.error, 'auth-idtoken-nonce', 'the refusal code');
  eq(g.store.writesTo(g.storeMod.SESSION_PREFIX), 0, 'sessions written for a mismatched nonce');
  return 'HTTP 401 auth-idtoken-nonce · REFUSED';
});

/* -- THE NONCE IS THE RAW VALUE, AND A DIGEST IS NOT IT ----------------------- */

run('N1 a token carrying the DIGEST of the nonce instead of the raw value is refused', async () => {
  // THE CASE THAT KEEPS THE DEFECT FROM COMING BACK IN SILENCE. A route that hashes the body's
  // nonce before comparing would take this token and refuse C1 -- the exact inversion that was
  // shipped, and the exact inversion a mirror-shaped fixture would have gone on certifying.
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g, { nonce: sha256hex(FIXTURE.rawNonce) }));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status for a digest-nonce token');
  eq(res.body.error, 'auth-idtoken-nonce', 'the refusal code');
  return 'a hashed nonce claim is not accepted: 401 auth-idtoken-nonce';
});

run('N2 a token with NO nonce claim at all is refused', async () => {
  const g = buildGraph({});
  const claims = nativeClaims(g);
  delete claims.nonce;
  const token = g.signer.sign({}, claims);
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status for a token with no nonce');
  eq(res.body.error, 'auth-idtoken-nonce', 'the refusal code');
  return 'an absent nonce claim is a refusal, not a skip';
});

run('N3 the kept nonceDigest helper is still sha256(rawNonce) in lower-case hex', async () => {
  const g = buildGraph({});
  const digest = g.native.nonceDigest(FIXTURE.rawNonce);
  eq(digest, sha256hex(FIXTURE.rawNonce), 'the digest');
  is(/^[0-9a-f]{64}$/.test(digest), 'the digest is not 64 lower-case hex characters');
  return digest.slice(0, 16) + '... (64 hex)';
});

/* -- THE REST OF THE LADDER --------------------------------------------------- */

run('L1 a foreign ISSUER is refused', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g, { iss: 'https://appleid.apple.com.evil.test' }));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status');
  eq(res.body.error, 'auth-idtoken-issuer', 'the refusal code');
  return '401 auth-idtoken-issuer';
});

run('L2 an EXPIRED token is refused', async () => {
  const g = buildGraph({});
  const now = Math.floor(g.clock.now() / 1000);
  const token = g.signer.sign({}, nativeClaims(g, { exp: now - 1 }));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status');
  eq(res.body.error, 'auth-idtoken-expired', 'the refusal code');
  return '401 auth-idtoken-expired';
});

run('L3 a token ISSUED IN THE FUTURE is refused, and ordinary drift is not', async () => {
  const g = buildGraph({});
  const now = Math.floor(g.clock.now() / 1000);
  const ahead = g.signer.sign({}, nativeClaims(g, { iat: now + 3600 }));
  const res = await post(g, { provider: APPLE, identityToken: ahead, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status for an hour into the future');
  eq(res.body.error, 'auth-idtoken-issued-ahead', 'the refusal code');

  // Thirty seconds of drift between two correct clocks is not a forgery.
  const g2 = buildGraph({});
  const drift = g2.signer.sign({}, nativeClaims(g2, { iat: now + 30 }));
  const ok = await post(g2, { provider: APPLE, identityToken: drift, rawNonce: FIXTURE.rawNonce });
  eq(ok.statusCode, 200, 'the status for thirty seconds of drift');
  return '+3600s refused · +30s accepted (skew ' + g.oidc.IAT_FUTURE_SKEW_SECONDS + 's)';
});

run('L4 `alg: none` is refused -- the header does not get to turn the verifier off', async () => {
  const g = buildGraph({});
  const claims = nativeClaims(g);
  const h = Buffer.from(JSON.stringify({ alg: 'none', kid: 'kid-native-1' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const res = await post(g, { provider: APPLE, identityToken: h + '.' + p + '.', rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the status');
  eq(res.body.error, 'auth-idtoken-alg', 'the refusal code');
  return '401 auth-idtoken-alg';
});

/* -- THE AUDIENCE SET IS EXACTLY TWO, AND CLOSED ------------------------------ */

run('A1 the App ID in the table is the one the order pins, and the set holds exactly two', async () => {
  const g = buildGraph({});
  eq(g.oidc.PROVIDERS.apple.nativeAudiences.slice(), [APP_ID], 'the native audience list');
  const set = g.oidc.acceptedAudiences(g.oidc.PROVIDERS.apple, g.env);
  eq(set, [FIXTURE.webClientId, APP_ID], 'the accepted set, web first');
  eq(g.oidc.acceptedAudiences(g.oidc.PROVIDERS.google, g.env), [], 'google accepts no native audience');
  return set.join(' + ');
});

run('A2 the WEB audience (the Services ID) is still accepted on the native door', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g, { aud: FIXTURE.webClientId }));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 200, 'the status for the web audience');
  return 'the existing Services ID is untouched: 200';
});

run('A3 an audience array containing ours is accepted; one containing only strangers is not', async () => {
  const g = buildGraph({});
  const good = g.signer.sign({}, nativeClaims(g, { aud: ['app.other.app', APP_ID] }));
  eq((await post(g, { provider: APPLE, identityToken: good, rawNonce: FIXTURE.rawNonce })).statusCode, 200,
    'an array carrying our id');
  const g2 = buildGraph({});
  const bad = g2.signer.sign({}, nativeClaims(g2, { aud: ['app.other.app', WRONG_APP_ID] }));
  const res = await post(g2, { provider: APPLE, identityToken: bad, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'an array carrying none of ours');
  eq(res.body.error, 'auth-idtoken-audience', 'the refusal code');
  return 'array form handled both ways';
});

run('A4 the override REPLACES the constant rather than adding a third door', async () => {
  const g = buildGraph({ env: { APPLE_NATIVE_CLIENT_ID: 'app.ezik.tutor.next' } });
  const set = g.oidc.acceptedAudiences(g.oidc.PROVIDERS.apple, g.env);
  eq(set, [FIXTURE.webClientId, 'app.ezik.tutor.next'], 'the overridden set');
  is(set.indexOf(APP_ID) === -1, 'the constant survived an override');
  const token = g.signer.sign({}, nativeClaims(g));   // still the old App ID
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 401, 'the old App ID after an override');
  return 'two entries, never three';
});

run('A5 the GOOGLE path is untouched: its accepted set is its one client id', async () => {
  const g = buildGraph({ env: { GOOGLE_OAUTH_CLIENT_ID: 'gid-1', GOOGLE_OAUTH_CLIENT_SECRET: 'gsec' } });
  const conf = g.oidc.providerConfig('google', g.env);
  is(conf.ok, 'google is not configured in this scenario');
  eq(conf.cfg.audiences, ['gid-1'], 'the google audience set');
  return 'google: 1 audience, unchanged';
});

/* -- THE DOOR ITSELF ---------------------------------------------------------- */

run('D1 anything but POST is 405', async () => {
  const g = buildGraph({});
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const res = await post(g, {}, { method });
    eq(res.statusCode, 405, 'the status for ' + method);
    eq(res.body.error, 'method-not-allowed', 'the code for ' + method);
  }
  const pre = await post(g, {}, { method: 'OPTIONS' });
  eq(pre.statusCode, 204, 'the preflight status');
  return '4 verbs refused with 405 · OPTIONS 204';
});

run('D2 a body missing a field is a 400, not a 401 -- a caller bug is not a refused reader', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  const bodies = [
    {},
    { provider: APPLE },
    { provider: APPLE, identityToken: token },
    { provider: APPLE, rawNonce: FIXTURE.rawNonce },
    { provider: APPLE, identityToken: token, rawNonce: 'short' },
    { provider: APPLE, identityToken: token, rawNonce: 7 },
    { provider: APPLE, identityToken: 42, rawNonce: FIXTURE.rawNonce },
  ];
  for (const body of bodies) {
    const res = await post(g, body);
    eq(res.statusCode, 400, 'the status for ' + JSON.stringify(Object.keys(body)));
    eq(res.body.error, 'auth-native-body', 'the code');
  }
  eq(g.provider.calls.length, 0, 'a malformed body reached the provider');
  return '7 malformed bodies · 400 auth-native-body · 0 outbound calls';
});

run('D3 a provider with no native door is a 400, and an unknown one is a 400 too', async () => {
  const g = buildGraph({ env: { GOOGLE_OAUTH_CLIENT_ID: 'gid-1', GOOGLE_OAUTH_CLIENT_SECRET: 'gsec' } });
  const token = g.signer.sign({}, nativeClaims(g));
  const google = await post(g, { provider: 'google', identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(google.statusCode, 400, 'the status for a provider with no native sheet');
  eq(google.body.error, 'auth-native-unsupported', 'the code');
  const bogus = await post(g, { provider: 'facebook', identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(bogus.statusCode, 400, 'the status for an unknown provider');
  eq(bogus.body.error, 'auth-provider-unknown', 'the code');
  return '400 auth-native-unsupported · 400 auth-provider-unknown';
});

run('D4 the door needs NO client secret -- the broken web configuration cannot close it', async () => {
  const g = buildGraph({});
  is(g.env.APPLE_OAUTH_CLIENT_SECRET === undefined, 'the scenario leaked a client secret');
  const token = g.signer.sign({}, nativeClaims(g));
  eq((await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce })).statusCode, 200,
    'the status with no client secret on the board');

  // And with NO Services ID either -- the day the web row is emptied entirely.
  const bare = buildGraph({ env: { APPLE_OAUTH_CLIENT_ID: undefined } });
  const token2 = bare.signer.sign({}, nativeClaims(bare));
  eq((await post(bare, { provider: APPLE, identityToken: token2, rawNonce: FIXTURE.rawNonce })).statusCode, 200,
    'the status with no Services ID on the board');

  // The same board still 503s the WEB path, which is the behaviour that must not change.
  const conf = bare.oidc.providerConfig('apple', bare.env);
  is(!conf.ok && conf.status === 503, 'the web path stopped refusing an unconfigured provider');
  return 'native 200 with neither secret nor Services ID · web still 503';
});

run('D5 the throttle refuses, and nothing is spent behind it', async () => {
  const g = buildGraph({ throttle: () => { throw new Error('the counter is unreachable'); } });
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 429, 'the status behind a dead counter');
  eq(res.body.error, 'auth-rate-limited', 'the code');
  eq(g.provider.calls.length, 0, 'provider calls behind a dead counter');
  eq(g.store.ops.filter((op) => op.cmd === 'set').length, 0, 'store writes behind a dead counter');
  const over = buildGraph({ throttle: () => ({ success: false }) });
  eq((await post(over, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce })).statusCode, 429,
    'the status for a caller over the ceiling');
  return '429 auth-rate-limited · 0 calls, 0 writes';
});

run('D6 an unreachable key endpoint is a 503, not a 401', async () => {
  const g = buildGraph({});
  g.provider.jwksThrows = true;
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 503, 'the status when the keys cannot be fetched');
  eq(res.body.error, 'auth-jwks-unreachable', 'the code');
  return '503 auth-jwks-unreachable — a reader holding a good token is not told it was refused';
});

run('D7 a store that cannot be written is a 503, and no session is handed out', async () => {
  const g = buildGraph({ storeThrowsOn: ['set'] });
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 503, 'the status when the account cannot be written');
  is(res.body.session === undefined, 'a session was returned over a dead store');
  return '503 ' + res.body.error;
});

/* -- THE SESSION IS THE WEB PATH'S SESSION ------------------------------------ */

run('S1 the answer has the same four fields api/auth-exchange.js returns, and no fifth', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(Object.keys(res.body).sort(), ['email', 'ok', 'provider', 'session'], 'the response keys');
  eq(res.getHeader('cache-control'), 'private, no-store', 'the cache header');

  // The shape is not asserted from memory: api/auth-exchange.js is lifted in the same process and
  // the field names it returns are read out of its source.
  const exchangeSrc = SOURCES['api/auth-exchange.js'];
  for (const field of ['ok:', 'session:', 'email:', 'provider:']) {
    is(exchangeSrc.indexOf(field) !== -1, 'api/auth-exchange.js no longer returns ' + field);
  }
  return 'ok, session, email, provider — four fields, no fifth';
});

run('S2 the session record is the one the store already knows, ninety days, and it resolves', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  const key = g.storeMod.sessionKey(res.body.session);
  const record = JSON.parse(g.store.rawGet(key));
  eq(record.accountKey, g.storeMod.accountKey(APPLE, FIXTURE.sub), 'the account the session points at');
  eq(g.store.ttlOf(key), g.storeMod.SESSION_TTL_SECONDS, 'the session lifetime');
  const touched = await g.account.touchSession(res.body.session);
  is(touched && touched.accountKey === record.accountKey, 'the minted session does not resolve');
  return 'sess -> ' + record.accountKey + ' · ttl ' + g.storeMod.SESSION_TTL_SECONDS + 's';
});

run('S3 the account record is the SAME seven fields, written by the same writer', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  const record = JSON.parse(g.store.rawGet(g.storeMod.accountKey(APPLE, FIXTURE.sub)));
  eq(Object.keys(record), g.account.ACCOUNT_FIELDS.slice(), 'the record keys, in order');
  eq(record.provider, APPLE, 'provider');
  eq(record.sub, FIXTURE.sub, 'sub');
  eq(record.emailVerified, true, 'the string "true" was read as a yes');
  return Object.keys(record).join(',');
});

run('S4 the email seam is the SAME seam: one index entry, on a proved address only', async () => {
  const g = buildGraph({});
  const token = g.signer.sign({}, nativeClaims(g));
  await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  const idx = g.storeMod.emailIndexKey(g.account.emailDigest(FIXTURE.email));
  const entry = JSON.parse(g.store.rawGet(idx));
  eq(entry.accountKey, g.storeMod.accountKey(APPLE, FIXTURE.sub), 'the account the address points at');

  // An UNPROVED address writes nothing -- and still gets its own account.
  const g2 = buildGraph({});
  const unproved = g2.signer.sign({}, nativeClaims(g2, { email_verified: 'false' }));
  const res = await post(g2, { provider: APPLE, identityToken: unproved, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 200, 'an unverified address was refused a session');
  eq(g2.store.writesTo(g2.storeMod.EMAIL_INDEX_PREFIX), 0, 'the seam opened on an unproved address');
  return '1 index entry proved · 0 written unproved';
});

run('S5 a hidden address is no obstacle: `sub` alone carries the account', async () => {
  const g = buildGraph({});
  const claims = nativeClaims(g);
  delete claims.email;
  delete claims.email_verified;
  const token = g.signer.sign({}, claims);
  const res = await post(g, { provider: APPLE, identityToken: token, rawNonce: FIXTURE.rawNonce });
  eq(res.statusCode, 200, 'the status with no address in the token');
  eq(res.body.email, '', 'the address returned');
  is(typeof res.body.session === 'string' && res.body.session.length > 0, 'no session for a hidden address');
  eq(g.store.writesTo(g.storeMod.EMAIL_INDEX_PREFIX), 0, 'the seam opened with no address');
  return '200 · email "" · account keyed by sub';
});

run('S6 signing in twice is ONE account and two sessions', async () => {
  const g = buildGraph({});
  const first = await post(g, {
    provider: APPLE, identityToken: g.signer.sign({}, nativeClaims(g)), rawNonce: FIXTURE.rawNonce,
  });
  g.clock.advance(5000);
  const second = await post(g, {
    provider: APPLE, identityToken: g.signer.sign({}, nativeClaims(g)), rawNonce: FIXTURE.rawNonce,
  });
  is(first.body.session !== second.body.session, 'the same session came back twice');
  eq(g.store.keys().filter((k) => k.startsWith(g.storeMod.ACCOUNT_PREFIX)).length, 1, 'account records');
  return '1 account · 2 sessions';
});

/* -- NOTHING LEAKS ------------------------------------------------------------ */

run('X1 no token, nonce, address or subject appears in any response or log line, on any branch', async () => {
  const token0 = buildGraph({}).signer.sign({}, { x: 1 });
  const secrets = [FIXTURE.rawNonce, FIXTURE.email, FIXTURE.sub];
  const scenarios = [];
  {
    const g = buildGraph({});
    const t = g.signer.sign({}, nativeClaims(g));
    scenarios.push(['success', g, [await post(g, { provider: APPLE, identityToken: t, rawNonce: FIXTURE.rawNonce })], t]);
  }
  {
    const g = buildGraph({});
    const t = g.signer.sign({}, nativeClaims(g, { aud: WRONG_APP_ID }));
    scenarios.push(['audience', g, [await post(g, { provider: APPLE, identityToken: t, rawNonce: FIXTURE.rawNonce })], t]);
  }
  {
    const g = buildGraph({});
    const t = makeSigner('kid-native-1').sign({}, nativeClaims(g));
    scenarios.push(['signature', g, [await post(g, { provider: APPLE, identityToken: t, rawNonce: FIXTURE.rawNonce })], t]);
  }
  {
    const g = buildGraph({});
    const t = g.signer.sign({}, nativeClaims(g));
    scenarios.push(['nonce', g, [await post(g, { provider: APPLE, identityToken: t, rawNonce: 'nonce-SOMETHING-ELSE' })], t]);
  }
  {
    const g = buildGraph({ storeThrowsOn: ['set'] });
    const t = g.signer.sign({}, nativeClaims(g));
    scenarios.push(['store', g, [await post(g, { provider: APPLE, identityToken: t, rawNonce: FIXTURE.rawNonce })], t]);
  }

  for (const [label, g, responses, token] of scenarios) {
    const text = JSON.stringify(responses.map((r) => r.body)) + '\n' + g.console.lines.join('\n');
    for (const leaked of secrets.concat([token])) {
      // The address IS returned on the success branch by contract -- that is the one exception,
      // and it is named rather than exempted wholesale.
      if (label === 'success' && leaked === FIXTURE.email) continue;
      is(text.indexOf(leaked) === -1, label + ': the output carried a value it must not (' + leaked.slice(0, 12) + ')');
    }
    is(g.console.lines.length === 0, label + ': the route wrote ' + g.console.lines.length + ' log line(s)');
  }
  is(token0.length > 0, 'the fixture token was not built');
  return '5 branches · 0 log lines · 0 leaked values';
});

/* -- THE SELF-CHECK: A PROBE THAT ACCEPTS EVERYTHING HAS MEASURED NOTHING ------ */

run('Z1 the four controls did NOT all pass -- one accepted, three refused', async () => {
  const seen = ['C1', 'C2', 'C3', 'C4'].map((k) => VERDICTS[k]);
  is(seen.every((s) => typeof s === 'number'), 'a control did not record a verdict: ' + JSON.stringify(VERDICTS));
  const accepted = seen.filter((s) => s === 200).length;
  const refused = seen.filter((s) => s === 401).length;
  if (accepted === 4) throw new Error('EVERY CONTROL WAS ACCEPTED -- this probe proves nothing and must be rebuilt');
  eq(accepted, 1, 'controls accepted');
  eq(refused, 3, 'controls refused');
  return 'C1=' + VERDICTS.C1 + ' C2=' + VERDICTS.C2 + ' C3=' + VERDICTS.C3 + ' C4=' + VERDICTS.C4
    + '  ->  1 accepted, 3 refused';
});

// ---------------------------------------------------------------------------
// THE RUN.
// ---------------------------------------------------------------------------

(async () => {
  for (const c of queue) {
    try { results.push({ name: c.name, ok: true, detail: (await c.fn()) || '' }); }
    catch (e) { results.push({ name: c.name, ok: false, detail: e.message }); }
  }

  let failed = 0;
  console.log('');
  console.log('== api/auth-native.js -- the native sign-in door ==');
  console.log('');
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? '  PASS  ' : '  FAIL  ') + r.name);
    if (r.detail) console.log('        ' + r.detail);
  }
  console.log('');
  console.log('  THE FOUR CONTROLS, VERBATIM:');
  console.log('    C1  aud=app.ezik.tutor,  signature good, nonce matching   ->  HTTP ' + VERDICTS.C1 + '  ACCEPTED');
  console.log('    C2  aud=app.WRONG.tutor, everything else identical        ->  HTTP ' + VERDICTS.C2 + '  REFUSED');
  console.log('    C3  aud=app.ezik.tutor,  signature forged                 ->  HTTP ' + VERDICTS.C3 + '  REFUSED');
  console.log('    C4  aud=app.ezik.tutor,  rawNonce does not match claim    ->  HTTP ' + VERDICTS.C4 + '  REFUSED');
  console.log('');
  console.log(failed === 0
    ? 'OK: ' + results.length + '/' + results.length + ' checks passed.'
    : 'FAILED: ' + failed + ' of ' + results.length + ' checks.');
  process.exit(failed === 0 ? 0 : 1);
})();
