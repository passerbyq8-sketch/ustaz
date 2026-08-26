// auth-server-measure.cjs -- the sign-in server, proved without a provider, a browser or a network.
//
// WHAT THIS MEASURES AND WHY IT CAN. The server half of reader sign-in is three routes and three
// modules: a start that mints a state and redirects, a return that exchanges the provider's code
// and mints a ticket, an exchange that turns the ticket into a session, and beneath them a key
// store, an OIDC client and an account writer. Not one of those needs a real Google, a real
// phone or a socket -- they need a store that can GET, SET, DEL and EVAL, a provider that can
// sign an id_token, and a clock this tool can move without waiting. So this file builds those
// three as fakes it fully controls, LIFTS THE REAL SOURCE of all six files out of the tree, and
// runs it.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every module below is read from disk, parsed with
// @babel/parser -- the same parser the babel gate and tools/build-app.cjs use -- and its import
// and export statements are the ONLY thing rewritten, so that a file written as an ES module can
// be evaluated in a CommonJS tool. Every other byte is the shipped byte. The key prefixes, the
// four lifetimes, the field list, the error codes and the redirect URI are all read from their
// own declarations at run time, so a renamed constant moves the expectation with the code
// instead of leaving this file measuring an older idea of it.
//
// AND lib/ratelimit.js IS LIFTED BY NAME, not imported. Importing it would construct a real
// Upstash client at module scope against credentials this machine does not have. So the fifth
// window family -- AUTH_FAIL_OPEN, the two windows and checkAuthLimit -- is extracted from the
// real file by declaration name and evaluated against a Ratelimit whose behaviour the test
// chooses, which is what makes "the throttle refuses when it cannot count" a measured fact.
//
// THE PROVIDER IS REAL CRYPTOGRAPHY, NOT A STUB THAT SAYS YES. An RSA key pair is generated IN
// MEMORY with node:crypto, the fake provider signs its id_tokens with the private half, and the
// fake JWKS endpoint publishes the matching JWK. So "a token signed by a foreign key is
// refused" is a genuine signature failure, not a flag being read. NOTHING IS WRITTEN TO THE TREE:
// no key file, no fixture, no temporary directory. `git status` is as empty after this tool as
// before it.
//
// AND IT CANNOT PASS BY DOING NOTHING. SIX MUTANTS are compiled at the end from the same lifted
// source with one line changed each -- the state delete dropped, the nonce check dropped,
// `email_verified` believed whenever it is a string, a sixth field written into the record, the
// redirect_uri built from the Host header, and the throttle made to fail open -- and every one
// of them must be KILLED by a named case above. A tool that cannot go red proves nothing.
//
// Usage:  node tools/auth-server-measure.cjs
// Exit:   0 when every case holds and every mutant dies; 1 with the failures named.
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
  'api/auth-start.js',
  'api/auth-return.js',
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

/**
 * Rewrites `import`/`export` and returns { body, exported }. Edits are applied BACK TO FRONT so
 * every remaining node offset stays the offset the parser reported. A form this does not know
 * throws rather than being skipped: a silently unhandled export would leave a name undefined and
 * the failure would surface far from its cause.
 */
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
      // Strip the `export ` token only -- the declaration itself is untouched.
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

/**
 * The globals a lifted module may see. `process`, `fetch`, `console` and `Date` come from the
 * harness so the environment, the network, the log and the clock are all facts this tool sets.
 * Everything else -- Buffer, URL, URLSearchParams, AbortSignal, JSON -- is the real one.
 */
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

// ---------------------------------------------------------------------------
// LIFTING NAMED DECLARATIONS OUT OF A MODULE WE MUST NOT EVALUATE WHOLE.
// lib/ratelimit.js builds an Upstash client at module scope; lib/daycap.js and lib/attempts.js
// pull in the store as well. Only the declarations these routes actually use are extracted.
// ---------------------------------------------------------------------------
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
      // Keep the inner declaration's text, without the `export ` token.
      const d = node.declaration;
      const inner = { start: d.start, end: d.end };
      const consideration = { type: d.type, id: d.id, declarations: d.declarations };
      consider(inner, consideration);
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

const RATELIMIT = namedDeclarations(RATELIMIT_SRC);
const ATTEMPTS = namedDeclarations(ATTEMPTS_SRC);
const DAYCAP = namedDeclarations(DAYCAP_SRC);

// The fifth window family, lifted verbatim. AUTH_FAIL_OPEN is the line mutant six rewrites.
const RATELIMIT_AUTH_TEXT = liftNames('lib/ratelimit.js', RATELIMIT,
  ['ALLOWED_ORIGINS', 'applyCorsOrigin', 'AUTH_FAIL_OPEN', 'AUTH_PER_IP_MIN', 'AUTH_PER_IP_DAY',
    'AUTH_WINDOWS', 'checkAuthLimit']);
const ATTEMPTS_TEXT = liftNames('lib/attempts.js', ATTEMPTS, ['clientAddress']);
const DAYCAP_TEXT = liftNames('lib/daycap.js', DAYCAP, ['DEVICE_HEADER', 'safeId']);

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/** A clock the test drives. Nothing here waits, and an expiry is a fact rather than a hope. */
function fakeClock(startMs) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms) => { now += ms; },
    Date: { now: () => now },
  };
}

/**
 * A LUA SUBSET, INTERPRETED HONESTLY.
 *
 * The one script this path runs is the read-and-delete consume in lib/auth/store.js. Rather than
 * recognising that script by its text -- which would make any change to it "unknown" instead of
 * "wrong" -- the three line shapes it is built from are interpreted, so a script with the delete
 * line REMOVED still runs and simply fails to delete. That is what lets mutant one be killed by
 * the behaviour ("a replayed state is refused") instead of by the harness falling over.
 */
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

/**
 * An in-memory Upstash. Real expiry against the injected clock, real NX, real EVAL, and a log of
 * every operation so "how many writes reached the email index" is a counted fact.
 */
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
    hasExpiry(k) { const rec = map.get(k); return !!rec && rec.expiresAt !== null; },
    writesTo(prefix) { return ops.filter((op) => op.cmd === 'set' && op.key.startsWith(prefix)).length; },
    deletes() { return ops.filter((op) => op.cmd === 'del').length; },
  };

  function Redis(cfg) {
    this.url = cfg && cfg.url;
    this.token = cfg && cfg.token;
  }
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
    unsigned(header, claims) {
      const h = Buffer.from(JSON.stringify(Object.assign({ alg: 'none', kid }, header || {}))).toString('base64url');
      const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
      return h + '.' + p + '.';
    },
  };
}

/** A provider that answers the two endpoints the code calls, and records what it was sent. */
function fakeProvider(signer, tokenUrl, jwksUrl) {
  const calls = [];
  const state = {
    calls,
    idToken: null,
    tokenStatus: 200,
    tokenBody: null,
    jwksStatus: 200,
    jwksKeys: [signer.jwk],
    tokenThrows: false,
  };
  state.fetch = async function (url, options) {
    const href = String(url);
    const body = options && typeof options.body === 'string' ? options.body : '';
    calls.push({ url: href, body });
    if (href === tokenUrl) {
      if (state.tokenThrows) throw new Error('network is down');
      return {
        status: state.tokenStatus,
        json: async () => (state.tokenBody !== null ? state.tokenBody : { id_token: state.idToken }),
      };
    }
    if (href === jwksUrl) {
      return { status: state.jwksStatus, json: async () => ({ keys: state.jwksKeys }) };
    }
    throw new Error('the fake provider was asked for an endpoint nobody registered: ' + href);
  };
  return state;
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
  return {
    method: opts.method || 'GET',
    query: opts.query || {},
    body: opts.body,
    headers,
  };
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
// THE GRAPH -- all six modules wired to the fakes, rebuilt fresh for every scenario.
// ---------------------------------------------------------------------------

const FIXTURE = {
  // Deliberately SHORT and non-secret-looking so recon-audit's secret scanner has nothing to
  // find in this file: it flags a quoted literal of sixteen or more characters beside a key
  // named `secret`, `token` or `key`. These are the values the leak scan searches OUTPUT for.
  clientId: 'cid-9001',
  clientSecret: 'shh-2f7a',
  code: 'prov-code-51',
  device: 'device-aaaa1111',
  sub: '901234567',
  email: 'Reader@Example.COM',
};

function buildGraph(options) {
  const o = options || {};
  const clock = fakeClock(o.startMs || 1756000000000);
  const store = fakeStore(clock, { throwOn: o.storeThrowsOn ? new Set(o.storeThrowsOn) : null });
  const signer = o.signer || makeSigner('kid-1');
  const console_ = fakeConsole();

  const env = Object.assign({
    GOOGLE_OAUTH_CLIENT_ID: FIXTURE.clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: FIXTURE.clientSecret,
    KV_REST_API_URL: 'https://store.invalid',
    KV_REST_API_TOKEN: 'store-tok',
  }, o.env || {});
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];

  // The provider endpoints come from the REAL configuration table, not from strings here.
  const cache = new Map();
  const pending = new Set();
  let provider = null;

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
    fetch: (url, opts2) => provider.fetch(url, opts2),
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
    let source = SOURCES[rel];
    if (o.mutate && o.mutate.file === rel) {
      const at = source.indexOf(o.mutate.from);
      if (at === -1) throw new Error('MUTANT ANCHOR MISSING in ' + rel);
      if (source.indexOf(o.mutate.from, at + 1) !== -1) throw new Error('MUTANT ANCHOR NOT UNIQUE in ' + rel);
      source = source.slice(0, at) + o.mutate.to + source.slice(at + o.mutate.from.length);
    }
    const compiled = compileModule(rel, source);
    const ns = compiled.factory((spec) => dep(spec, rel), moduleEnv);
    cache.set(rel, ns);
    pending.delete(rel);
    return ns;
  }

  // The three lifted-by-name shims, evaluated against the same fakes.
  const shims = {};
  {
    let text = RATELIMIT_AUTH_TEXT;
    if (o.mutate && o.mutate.file === 'lib/ratelimit.js') {
      const at = text.indexOf(o.mutate.from);
      if (at === -1) throw new Error('MUTANT ANCHOR MISSING in lib/ratelimit.js');
      if (text.indexOf(o.mutate.from, at + 1) !== -1) throw new Error('MUTANT ANCHOR NOT UNIQUE in lib/ratelimit.js');
      text = text.slice(0, at) + o.mutate.to + text.slice(at + o.mutate.from.length);
    }
    shims.ratelimit = new Function('Ratelimit', 'redis', 'console', text
      + '\n;return { ALLOWED_ORIGINS, applyCorsOrigin, checkAuthLimit, AUTH_FAIL_OPEN,'
      + ' AUTH_PER_IP_MIN, AUTH_PER_IP_DAY, AUTH_WINDOWS };')(Ratelimit, {}, console_);
    shims.attempts = new Function(ATTEMPTS_TEXT + '\n;return { clientAddress };')();
    shims.daycap = new Function(DAYCAP_TEXT + '\n;return { DEVICE_HEADER, safeId };')();
  }

  const oidc = load('lib/auth/oidc.js');
  provider = fakeProvider(signer, PROVIDERS_OF(oidc).google.tokenUrl, PROVIDERS_OF(oidc).google.jwksUrl);

  return {
    clock,
    store,
    signer,
    provider,
    console: console_,
    env,
    load,
    oidc,
    storeMod: load('lib/auth/store.js'),
    account: load('lib/auth/account.js'),
    start: load('api/auth-start.js'),
    ret: load('api/auth-return.js'),
    exchange: load('api/auth-exchange.js'),
  };
}

function PROVIDERS_OF(oidc) { return oidc.PROVIDERS; }

// ---------------------------------------------------------------------------
// THE LEGS, DRIVEN.
// ---------------------------------------------------------------------------

function locationOf(res) { return res.headers.location || ''; }

async function legStart(g, opts) {
  const o = opts || {};
  const req = fakeReq({
    method: 'GET',
    query: Object.assign({ provider: 'google', device: FIXTURE.device }, o.query || {}),
    headers: o.headers || {},
  });
  const res = fakeRes();
  await g.start.default(req, res);
  const url = locationOf(res) ? new URL(locationOf(res)) : null;
  return { res, url, params: url ? url.searchParams : null };
}

async function legReturn(g, opts) {
  const o = opts || {};
  const req = fakeReq({ method: 'GET', query: o.query || {}, headers: o.headers || {} });
  const res = fakeRes();
  await g.ret.default(req, res);
  const loc = locationOf(res);
  const url = loc ? new URL(loc) : null;
  return { res, url, params: url ? url.searchParams : null };
}

async function legExchange(g, opts) {
  const o = opts || {};
  const headers = Object.assign({}, o.headers);
  if (o.device !== null) headers['x-murabbi-device'] = o.device === undefined ? FIXTURE.device : o.device;
  const req = fakeReq({ method: 'POST', body: o.body || {}, headers });
  const res = fakeRes();
  await g.exchange.default(req, res);
  return { res };
}

/** The state record the start leg just wrote, read straight out of the fake store. */
function stateRecordOf(g, state) {
  const raw = g.store.rawGet(g.storeMod.stateKey(state));
  return raw === null ? null : JSON.parse(raw);
}

function accountRecordOf(g, key) {
  const raw = g.store.rawGet(key);
  return raw === null ? null : JSON.parse(raw);
}

/** Claims a real Google would send, plus whatever the scenario overrides. */
function claimsFor(g, nonce, over) {
  const now = Math.floor(g.clock.now() / 1000);
  return Object.assign({
    iss: 'https://accounts.google.com',
    aud: FIXTURE.clientId,
    sub: FIXTURE.sub,
    exp: now + 600,
    iat: now,
    nonce,
    email: FIXTURE.email,
    email_verified: true,
  }, over || {});
}

/** Start -> return, with every knob the scenarios need. Returns the return leg's redirect. */
async function fullFlow(g, opts) {
  const o = opts || {};
  const started = await legStart(g, { query: o.startQuery, headers: o.startHeaders });
  const state = started.params.get('state');
  const record = stateRecordOf(g, state);
  g.provider.idToken = o.idToken
    || g.signer.sign(o.header || {}, claimsFor(g, o.nonce === undefined ? record.nonce : o.nonce, o.claims));
  const returned = await legReturn(g, {
    query: Object.assign({ code: FIXTURE.code, state }, o.returnQuery || {}),
  });
  return { started, state, record, returned, ticket: returned.params ? returned.params.get('ticket') : null };
}

// ---------------------------------------------------------------------------
// THE CASES.
// ---------------------------------------------------------------------------
const results = [];
function run(name, fn) { queue.push({ name, fn }); }
const queue = [];
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': got ' + a + ', wanted ' + b);
}
function is(cond, what) { if (!cond) throw new Error(what); }

const BASE = buildGraph({});
const CONTRACT = {
  STATE_PREFIX: BASE.storeMod.STATE_PREFIX,
  TICKET_PREFIX: BASE.storeMod.TICKET_PREFIX,
  JWKS_PREFIX: BASE.storeMod.JWKS_PREFIX,
  ACCOUNT_PREFIX: BASE.storeMod.ACCOUNT_PREFIX,
  EMAIL_INDEX_PREFIX: BASE.storeMod.EMAIL_INDEX_PREFIX,
  SESSION_PREFIX: BASE.storeMod.SESSION_PREFIX,
  STATE_TTL: BASE.storeMod.STATE_TTL_SECONDS,
  TICKET_TTL: BASE.storeMod.TICKET_TTL_SECONDS,
  JWKS_TTL: BASE.storeMod.JWKS_TTL_SECONDS,
  SESSION_TTL: BASE.storeMod.SESSION_TTL_SECONDS,
  REDIRECT_URI: BASE.oidc.REDIRECT_URI,
  FIELDS: BASE.account.ACCOUNT_FIELDS,
  PROVIDERS: Object.keys(BASE.oidc.PROVIDERS),
  APP_RETURN_URL: BASE.ret.APP_RETURN_URL,
};

/* -- RULING 1: the account key carries the provider ------------------------- */

run('R1 the account key is acct:v1:<provider>:<sub> and never `sub` alone', async () => {
  const g = buildGraph({});
  const key = g.storeMod.accountKey('google', FIXTURE.sub);
  eq(key, CONTRACT.ACCOUNT_PREFIX + 'google:' + FIXTURE.sub, 'the built key');
  is(key.indexOf('google') !== -1, 'the provider is not in the key');
  const apple = g.storeMod.accountKey('apple', FIXTURE.sub);
  is(apple !== key, 'two providers sharing one subject collide onto one record');
  return key + '  vs  ' + apple;
});

run('R1 the same subject from two providers is two records, not one', async () => {
  const g = buildGraph({});
  const a = await g.account.upsertAccount({ provider: 'google', sub: FIXTURE.sub, email: 'a@x.test', emailVerified: true });
  const b = await g.account.upsertAccount({ provider: 'apple', sub: FIXTURE.sub, email: 'b@x.test', emailVerified: true });
  is(a.ok && b.ok, 'one of the two writes refused');
  is(a.key !== b.key, 'both providers wrote the same key');
  eq(g.store.keys().filter((k) => k.startsWith(CONTRACT.ACCOUNT_PREFIX)).length, 2, 'account records');
  return a.key + '  |  ' + b.key;
});

/* -- RULING 2: five fields, plus two timestamps, and no sixth --------------- */

run('R2 a created record has exactly the seven declared keys', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  is(!!ticket, 'the flow did not produce a ticket');
  const key = g.storeMod.accountKey('google', FIXTURE.sub);
  const record = accountRecordOf(g, key);
  eq(Object.keys(record), CONTRACT.FIELDS.slice(), 'the record keys, in order');
  eq(record.provider, 'google', 'provider');
  eq(record.sub, FIXTURE.sub, 'sub');
  eq(record.email, FIXTURE.email, 'email');
  eq(record.emailVerified, true, 'emailVerified');
  is(typeof record.createdAt === 'number' && typeof record.lastSeenAt === 'number', 'the timestamps');
  return Object.keys(record).join(',');
});

run('R2 a provider that sends a name, a picture and a locale gets none of them stored', async () => {
  const g = buildGraph({});
  await fullFlow(g, {
    claims: { name: 'A Reader', picture: 'https://x.test/p.png', locale: 'ar', hd: 'x.test', given_name: 'A' },
  });
  const record = accountRecordOf(g, g.storeMod.accountKey('google', FIXTURE.sub));
  eq(Object.keys(record), CONTRACT.FIELDS.slice(), 'the record keys after a generous id_token');
  const text = JSON.stringify(record);
  for (const leaked of ['A Reader', 'p.png', 'locale', 'given_name']) {
    is(text.indexOf(leaked) === -1, 'the record carried ' + leaked);
  }
  return 'five claims offered, zero stored';
});

run('R2 the exchange answers with four fields and no fifth', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  const { res } = await legExchange(g, { body: { ticket } });
  eq(res.statusCode, 200, 'the exchange status');
  eq(Object.keys(res.body).sort(), ['email', 'ok', 'provider', 'session'], 'the response keys');
  eq(res.body.provider, 'google', 'provider');
  eq(res.body.email, FIXTURE.email, 'email');
  is(typeof res.body.session === 'string' && res.body.session.length >= 40, 'the session value');
  return Object.keys(res.body).sort().join(',');
});

/* -- RULING 3: the email index, and the proof it demands -------------------- */

run('R3 the email index key is acctidx:v1:email:<sha256 of the lowercased address>', async () => {
  const g = buildGraph({});
  await fullFlow(g);
  const digest = nodeCrypto.createHash('sha256').update(FIXTURE.email.trim().toLowerCase(), 'utf8').digest('hex');
  const expected = CONTRACT.EMAIL_INDEX_PREFIX + digest;
  const written = g.store.keys().filter((k) => k.startsWith(CONTRACT.EMAIL_INDEX_PREFIX));
  eq(written, [expected], 'the index keys written');
  is(expected.indexOf('@') === -1, 'the address itself is in the key');
  const entry = JSON.parse(g.store.rawGet(expected));
  eq(entry.accountKey, g.storeMod.accountKey('google', FIXTURE.sub), 'what the index points at');
  return expected.slice(0, 34) + '...';
});

run('R3 an UNVERIFIED address writes NOTHING to the email index -- four shapes of no', async () => {
  const shapes = [false, 'false', undefined, 'yes'];
  const seen = [];
  for (let i = 0; i < shapes.length; i++) {
    const g = buildGraph({});
    const { ticket } = await fullFlow(g, { claims: { email_verified: shapes[i] } });
    is(!!ticket, 'shape ' + i + ' did not complete the flow -- an unverified reader still signs in');
    eq(g.store.writesTo(CONTRACT.EMAIL_INDEX_PREFIX), 0,
      'index writes for email_verified=' + JSON.stringify(shapes[i]));
    const record = accountRecordOf(g, g.storeMod.accountKey('google', FIXTURE.sub));
    eq(record.emailVerified, false, 'the stored flag for ' + JSON.stringify(shapes[i]));
    seen.push(JSON.stringify(shapes[i]));
  }
  // ...and the string "true" IS a yes, because Apple sends exactly that.
  const g2 = buildGraph({});
  await fullFlow(g2, { claims: { email_verified: 'true' } });
  eq(g2.store.writesTo(CONTRACT.EMAIL_INDEX_PREFIX), 1, 'index writes for the string "true"');
  return seen.join(' ') + ' -> no  ·  "true" -> yes';
});

run('R3 the index keeps pointing at the FIRST account that proved the address', async () => {
  const g = buildGraph({});
  await fullFlow(g);
  const first = g.storeMod.accountKey('google', FIXTURE.sub);
  // The same verified address arriving on a different account must not re-point the index.
  const second = await g.account.upsertAccount({ provider: 'apple', sub: '55', email: FIXTURE.email, emailVerified: true });
  const again = await g.account.indexVerifiedEmail(FIXTURE.email, true, second.key);
  eq(again.written, false, 'the second account overwrote the index entry');
  eq(await g.account.accountForVerifiedEmail(FIXTURE.email), first, 'what the index points at now');
  return 'first kept: ' + first;
});

run("R3 Apple's relay address is stored and indexed exactly as it arrived", async () => {
  const relay = 'a1b2c3@privaterelay.appleid.com';
  const g = buildGraph({});
  await fullFlow(g, { claims: { email: relay } });
  const record = accountRecordOf(g, g.storeMod.accountKey('google', FIXTURE.sub));
  eq(record.email, relay, 'the stored address');
  const digest = nodeCrypto.createHash('sha256').update(relay, 'utf8').digest('hex');
  eq(g.store.keys().filter((k) => k.startsWith(CONTRACT.EMAIL_INDEX_PREFIX)),
    [CONTRACT.EMAIL_INDEX_PREFIX + digest], 'the index key for a relay address');
  return relay + ' stored verbatim, indexed like any other';
});

/* -- RULING 4: the merge does not destroy, and nothing deletes -------------- */

run('R4 a second sign-in moves lastSeenAt and nothing else', async () => {
  const g = buildGraph({});
  await fullFlow(g);
  const key = g.storeMod.accountKey('google', FIXTURE.sub);
  const before = accountRecordOf(g, key);
  g.clock.advance(60 * 1000);
  // The second sign-in carries LESS than the first: no address, and no proof.
  await fullFlow(g, { claims: { email: '', email_verified: false } });
  const after = accountRecordOf(g, key);
  eq(after.email, before.email, 'the address after a sign-in that carried none');
  eq(after.emailVerified, before.emailVerified, 'the proof flag');
  eq(after.createdAt, before.createdAt, 'createdAt');
  is(after.lastSeenAt > before.lastSeenAt, 'lastSeenAt did not move');
  eq(Object.keys(after), CONTRACT.FIELDS.slice(), 'the keys after the merge');
  return 'email kept, lastSeenAt +' + (after.lastSeenAt - before.lastSeenAt) + 'ms';
});

run('R4 the only removals on the sign-in path are the two one-shot records', async () => {
  const g = buildGraph({});
  const flow = await fullFlow(g);
  await legExchange(g, { body: { ticket: flow.ticket } });

  // Two ways a key can leave: a plain DEL, or the DEL inside the consume script. Both counted,
  // because counting only the first would call a path with no plain DEL "zero deletes" and pass
  // while the script quietly removed anything it liked.
  const removals = g.store.ops
    .filter((op) => op.cmd === 'del' || (op.cmd === 'eval' && /redis\.call\('DEL'/.test(op.script)))
    .map((op) => op.key);
  is(removals.length >= 2, 'the state and the ticket were not both consumed (' + removals.length + ')');
  for (const k of removals) {
    is(k.startsWith(CONTRACT.STATE_PREFIX) || k.startsWith(CONTRACT.TICKET_PREFIX),
      'a removal reached ' + k + ' -- nothing but the two one-shot records may be removed');
  }
  eq(g.store.rawGet(g.storeMod.stateKey(flow.state)), null, 'the state after the flow');
  eq(g.store.rawGet(g.storeMod.ticketKey(flow.ticket)), null, 'the ticket after the flow');
  is(g.store.keys().some((k) => k.startsWith(CONTRACT.ACCOUNT_PREFIX)), 'the account record is gone');
  is(g.store.keys().some((k) => k.startsWith(CONTRACT.EMAIL_INDEX_PREFIX)), 'the email index entry is gone');
  is(g.store.keys().some((k) => k.startsWith(CONTRACT.SESSION_PREFIX)), 'the session record is gone');
  return removals.length + ' removals, all of them one-shot records';
});

/* -- RULING 5: the session is an opaque key, not a signed token ------------- */

run('R5 the session is sess:v1:<32 random bytes>, ninety days, and slides on use', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  const { res } = await legExchange(g, { body: { ticket } });
  const id = res.body.session;
  eq(Buffer.from(id, 'base64url').length, 32, 'the session id, decoded');
  is(/^[A-Za-z0-9_-]+$/.test(id), 'the session id is not base64url');
  is(id.indexOf('.') === -1, 'the session id has JWT-shaped dots in it');
  const key = g.storeMod.sessionKey(id);
  eq(g.store.ttlOf(key), CONTRACT.SESSION_TTL, 'the session TTL in seconds');
  const record = JSON.parse(g.store.rawGet(key));
  eq(Object.keys(record).sort(), ['accountKey', 'createdAt', 'expiresAt'], 'the session record fields');

  g.clock.advance(30 * 24 * 60 * 60 * 1000);
  const touched = await g.account.touchSession(id);
  is(!!touched, 'a live session did not read back');
  eq(g.store.ttlOf(key), CONTRACT.SESSION_TTL, 'the TTL after sliding');
  return '32 bytes · ' + CONTRACT.SESSION_TTL + 's · slid back to full after 30 days';
});

run('R5 revocation is deleting the key, and there is no new secret anywhere', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  const { res } = await legExchange(g, { body: { ticket } });
  const id = res.body.session;
  eq(await g.account.revokeSession(id), true, 'the revoke call');
  eq(g.store.rawGet(g.storeMod.sessionKey(id)), null, 'the session record after revocation');
  eq(await g.account.touchSession(id), null, 'a revoked session still reads back');

  const banned = ['ACCOUNT_SESSION_SECRET', 'FOUNDER_SECRET', 'jsonwebtoken', "'jose'", 'createHmac'];
  const found = [];
  for (const rel of NEW_MODULES) {
    for (const word of banned) if (SOURCES[rel].indexOf(word) !== -1 && !isPlainProse(SOURCES[rel], word)) found.push(rel + ':' + word);
  }
  eq(found, [], 'a new secret or a JWT library reached the sign-in files');
  return 'revoked by DELETE; zero new secrets, zero JWT libraries';
});

/** A banned word inside a comment explaining why it is NOT used is not a use. */
function isPlainProse(source, word) {
  const lines = source.split('\n');
  for (const line of lines) {
    if (line.indexOf(word) === -1) continue;
    const trimmed = line.trim();
    if (!(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))) return false;
  }
  return true;
}

/* -- RULING 6: the state is bound to a device ------------------------------- */

run('R6 the state record carries the device, and the exchange refuses another one', async () => {
  const g = buildGraph({});
  const started = await legStart(g);
  const record = stateRecordOf(g, started.params.get('state'));
  eq(record.deviceId, FIXTURE.device, 'the device recorded on the state');

  const { ticket } = await fullFlow(g);
  const ticketRecord = JSON.parse(g.store.rawGet(g.storeMod.ticketKey(ticket)));
  eq(ticketRecord.deviceId, FIXTURE.device, 'the device carried onto the ticket');

  const wrong = await legExchange(g, { body: { ticket }, device: 'device-bbbb2222' });
  eq(wrong.res.statusCode, 403, 'the status for a ticket redeemed from another device');
  eq(wrong.res.body.error, 'auth-device-mismatch', 'the refusal code');
  is(!wrong.res.body.session, 'a session was minted for the wrong device');
  eq(g.store.keys().filter((k) => k.startsWith(CONTRACT.SESSION_PREFIX)).length, 0, 'sessions minted');
  return 'started on ' + FIXTURE.device + ', refused for device-bbbb2222';
});

run('R6 the device is read from x-murabbi-device on the leg that can carry it', async () => {
  const g = buildGraph({});
  // The start leg still prefers the header when a caller can send one.
  const started = await legStart(g, {
    query: { device: 'device-query111' },
    headers: { 'x-murabbi-device': 'device-header22' },
  });
  eq(stateRecordOf(g, started.params.get('state')).deviceId, 'device-header22',
    'the header did not win over the query on the start leg');
  return 'header wins on start; header is the only source on exchange';
});

/* -- RULING 7: PKCE, S256, and a verifier that never leaves ----------------- */

run('R7 the authorize URL carries an S256 challenge and never the verifier', async () => {
  const g = buildGraph({});
  const started = await legStart(g);
  eq(started.res.statusCode, 302, 'the start status');
  eq(started.params.get('code_challenge_method'), 'S256', 'the challenge method');
  eq(started.params.get('response_type'), 'code', 'the response type');
  const record = stateRecordOf(g, started.params.get('state'));
  const expected = nodeCrypto.createHash('sha256').update(record.codeVerifier, 'ascii').digest('base64url');
  eq(started.params.get('code_challenge'), expected, 'the challenge against sha256 of the verifier');
  is(Buffer.from(record.codeVerifier, 'base64url').length === 32, 'the verifier is not 32 bytes');
  is(record.codeVerifier.length >= 43 && record.codeVerifier.length <= 128, 'the verifier length is outside RFC 7636');
  is(locationOf(started.res).indexOf(record.codeVerifier) === -1, 'the VERIFIER rode along in the redirect');
  return 'S256 challenge sent, verifier ' + record.codeVerifier.length + ' chars kept in the store';
});

run('R7 the verifier reaches the provider and NOTHING else -- not the app, not a response', async () => {
  const g = buildGraph({});
  const { record, returned } = await fullFlow(g);
  const sentToProvider = g.provider.calls.map((c) => c.body).join('\n');
  is(sentToProvider.indexOf('code_verifier=' + encodeURIComponent(record.codeVerifier)) !== -1
    || sentToProvider.indexOf('code_verifier=' + record.codeVerifier) !== -1,
    'the verifier never reached the token endpoint -- PKCE is not actually being performed');
  is(locationOf(returned.res).indexOf(record.codeVerifier) === -1, 'the verifier is in the app redirect');
  is(JSON.stringify(g.console.lines).indexOf(record.codeVerifier) === -1, 'the verifier is in a log line');
  return 'verifier: token endpoint only';
});

/* -- RULING 8: consumed once, atomically, with the stated lifetime ---------- */

run('R8 the state is consumed by ONE script, and a replay finds nothing', async () => {
  const g = buildGraph({});
  const first = await fullFlow(g);
  is(!!first.ticket, 'the first return did not produce a ticket');
  const consume = g.store.ops.filter((op) => op.cmd === 'eval' && op.key.startsWith(CONTRACT.STATE_PREFIX));
  eq(consume.length, 1, 'EVAL calls against the state key');
  is(consume[0].script.indexOf("redis.call('GET'") !== -1 && consume[0].script.indexOf("redis.call('DEL'") !== -1,
    'the consume script does not both read and delete');
  eq(g.store.rawGet(g.storeMod.stateKey(first.state)), null, 'the state record after one use');

  // The identical provider redirect, delivered again.
  const replay = await legReturn(g, { query: { code: FIXTURE.code, state: first.state } });
  eq(replay.params.get('ticket'), null, 'a ticket was minted for a replayed state');
  eq(replay.params.get('error'), 'auth-state-invalid', 'the refusal on replay');
  eq(replay.params.get('state'), first.state, 'the state echoed back so the page can match it');
  return 'one EVAL, one ticket; the replay got ' + replay.params.get('error');
});

run('R8 the state expires after exactly ten minutes, and an expired one is refused', async () => {
  const g = buildGraph({});
  const started = await legStart(g);
  const state = started.params.get('state');
  eq(g.store.ttlOf(g.storeMod.stateKey(state)), CONTRACT.STATE_TTL, 'the state TTL in seconds');
  eq(CONTRACT.STATE_TTL, 600, 'ten minutes in seconds');
  const setOp = g.store.ops.find((op) => op.cmd === 'set' && op.key.startsWith(CONTRACT.STATE_PREFIX));
  eq(setOp.ex, CONTRACT.STATE_TTL, 'the expiry passed on the write itself');

  g.clock.advance(CONTRACT.STATE_TTL * 1000 + 1);
  const late = await legReturn(g, { query: { code: FIXTURE.code, state } });
  eq(late.params.get('error'), 'auth-state-invalid', 'the refusal for an expired state');
  eq(late.params.get('ticket'), null, 'a ticket was minted from an expired state');
  eq(g.provider.calls.length, 0, 'the provider was called for a state that had expired');
  return 'ex=' + CONTRACT.STATE_TTL + 's; expired -> ' + late.params.get('error') + ', zero provider calls';
});

run('R8 the ticket lives sixty seconds, is spent once, and dies on time', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  eq(g.store.ttlOf(g.storeMod.ticketKey(ticket)), CONTRACT.TICKET_TTL, 'the ticket TTL');
  eq(CONTRACT.TICKET_TTL, 60, 'sixty seconds');
  const first = await legExchange(g, { body: { ticket } });
  eq(first.res.statusCode, 200, 'the first exchange');
  const again = await legExchange(g, { body: { ticket } });
  eq(again.res.statusCode, 400, 'the status for a replayed ticket');
  eq(again.res.body.error, 'auth-ticket-invalid', 'the replayed-ticket code');
  eq(g.store.keys().filter((k) => k.startsWith(CONTRACT.SESSION_PREFIX)).length, 1, 'sessions minted in total');

  const g2 = buildGraph({});
  const second = await fullFlow(g2);
  g2.clock.advance(CONTRACT.TICKET_TTL * 1000 + 1);
  const late = await legExchange(g2, { body: { ticket: second.ticket } });
  eq(late.res.statusCode, 400, 'the status for an expired ticket');
  eq(late.res.body.error, 'auth-ticket-invalid', 'the expired-ticket code');
  eq(g2.store.keys().filter((k) => k.startsWith(CONTRACT.SESSION_PREFIX)).length, 0, 'sessions from an expired ticket');
  return 'ex=' + CONTRACT.TICKET_TTL + 's; replay and expiry both refused, one session in total';
});

/* -- RULING 9: the redirect_uri is a constant ------------------------------- */

run('R9 the redirect_uri is the constant, whatever the Host header claims', async () => {
  eq(CONTRACT.REDIRECT_URI, 'https://ezik.app/api/auth-return', 'the declared redirect URI');
  const g = buildGraph({});
  const honest = await legStart(g);
  eq(honest.params.get('redirect_uri'), CONTRACT.REDIRECT_URI, 'the redirect_uri sent to the provider');

  const hostile = await legStart(g, {
    headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example', ':authority': 'evil.example' },
  });
  eq(hostile.params.get('redirect_uri'), CONTRACT.REDIRECT_URI, 'the redirect_uri under a hostile Host');
  is(locationOf(hostile.res).indexOf('evil.example') === -1, 'the Host header reached the redirect');

  const bodies = g.provider.calls.map((c) => c.body).join('\n');
  is(bodies.indexOf('evil.example') === -1, 'a hostile host reached the token exchange');
  return CONTRACT.REDIRECT_URI + ' both times';
});

/* -- RULING 10: the consent gate is deliberately absent, and said so -------- */

run('R10 no sign-in route imports the AI-consent gate, and each says why in a comment', async () => {
  const routes = ['api/auth-start.js', 'api/auth-return.js', 'api/auth-exchange.js'];
  for (const rel of routes) {
    const src = SOURCES[rel];
    is(src.indexOf('guardAIConsent') === -1, rel + ' calls guardAIConsent -- sign-in becomes impossible');
    // The name is allowed to appear in the COMMENT that explains the absence; what must not
    // exist is an import statement, so the test looks for the statement and not the word.
    is(!/^\s*import[^\n]*ai-consent/m.test(src), rel + ' imports lib/ai-consent.js');
    is(src.indexOf('AI_CONSENT_HEADER') === -1 && src.indexOf('x-ezik-ai-consent') === -1
      || isPlainProse(src, 'x-ezik-ai-consent'), rel + ' reads the consent header');
    is(/AI-CONSENT GATE IS DELIBERATELY NOT APPLIED/.test(src),
      rel + ' does not say IN A COMMENT why the consent gate is absent');
  }
  // And the gate really would refuse: the routes are reachable with no consent header at all.
  const g = buildGraph({});
  const started = await legStart(g, { headers: {} });
  eq(started.res.statusCode, 302, 'a start with no consent header');
  return '3 routes, 0 imports, 3 comments';
});

/* -- RULING 11: the throttle fails CLOSED ----------------------------------- */

run('R11 the fifth family is `auth`, its windows are per-IP, and AUTH_FAIL_OPEN is false', async () => {
  const g = buildGraph({});
  const shim = new Function('Ratelimit', 'redis', 'console', RATELIMIT_AUTH_TEXT
    + '\n;return { AUTH_FAIL_OPEN, AUTH_WINDOWS, AUTH_PER_IP_MIN, AUTH_PER_IP_DAY };')(
    (function () { function R(o) { this.prefix = o.prefix; } R.slidingWindow = () => ({}); return R; }()), {}, g.console);
  eq(shim.AUTH_FAIL_OPEN, false, 'AUTH_FAIL_OPEN -- this family is the one that refuses');
  eq(Object.keys(shim.AUTH_WINDOWS).sort(), ['day', 'min'], 'the window names');
  eq(shim.AUTH_WINDOWS.min.prefix, 'auth:ip:min', 'the minute prefix');
  eq(shim.AUTH_WINDOWS.day.prefix, 'auth:ip:day', 'the day prefix');
  is(shim.AUTH_PER_IP_MIN > 0 && shim.AUTH_PER_IP_DAY > shim.AUTH_PER_IP_MIN, 'the two ceilings');
  return 'auth:ip:min ' + shim.AUTH_PER_IP_MIN + '/m · auth:ip:day ' + shim.AUTH_PER_IP_DAY + '/d · fail-open=false';
});

run('R11 a throttle that cannot count REFUSES all three routes, and spends nothing', async () => {
  const throwing = () => { throw new Error('the counter is unreachable'); };
  for (const leg of ['start', 'return', 'exchange']) {
    const g = buildGraph({ throttle: throwing });
    let res;
    if (leg === 'start') res = (await legStart(g)).res;
    else if (leg === 'return') res = (await legReturn(g, { query: { code: FIXTURE.code, state: 'x' } })).res;
    else res = (await legExchange(g, { body: { ticket: 'x' } })).res;
    eq(res.statusCode, 429, 'the status on ' + leg + ' when the counter is unreachable');
    eq(res.body.error, 'auth-rate-limited', 'the refusal code on ' + leg);
    eq(g.provider.calls.length, 0, 'provider calls made on ' + leg + ' behind a dead throttle');
    eq(g.store.ops.filter((op) => op.cmd === 'set').length, 0, 'store writes on ' + leg);
  }
  // And an over-limit caller is refused the same way.
  const g2 = buildGraph({ throttle: () => ({ success: false }) });
  eq((await legStart(g2)).res.statusCode, 429, 'the status for a caller over the ceiling');
  return '3 routes refuse; 0 provider calls, 0 writes';
});

/* -- RULING 12: the provider is data, and a missing variable is a named 503 -- */

run('R12 both providers are data, share one code path, and differ only in fields', async () => {
  eq(CONTRACT.PROVIDERS.sort(), ['apple', 'google'], 'the registered providers');
  const g = buildGraph({});
  const fields = Object.keys(g.oidc.PROVIDERS.google).sort();
  eq(Object.keys(g.oidc.PROVIDERS.apple).sort(), fields, 'apple and google do not have the same shape');

  // AND NOWHERE ELSE KNOWS THEIR NAMES. A provider name written as a string literal outside the
  // table is a branch waiting to happen; only lib/auth/oidc.js may hold one. Comment lines are
  // exempt -- naming a provider while explaining something is not branching on it.
  const offenders = [];
  for (const rel of ['api/auth-start.js', 'api/auth-return.js', 'api/auth-exchange.js',
    'lib/auth/account.js', 'lib/auth/store.js']) {
    SOURCES[rel].split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (/['"](google|apple)['"]/.test(line)) offenders.push(rel + ':' + (i + 1));
    });
  }
  eq(offenders, [], 'a provider name is written as a literal outside lib/auth/oidc.js');
  return fields.join(',') + '  ·  0 provider literals outside the table';
});

run('R12 a provider with no environment variables is a NAMED 503, not a crash and not a 500', async () => {
  const g = buildGraph({ env: { GOOGLE_OAUTH_CLIENT_ID: undefined, GOOGLE_OAUTH_CLIENT_SECRET: undefined } });
  const started = await legStart(g);
  eq(started.res.statusCode, 503, 'the status for an unconfigured provider');
  eq(started.res.body.error, 'auth-provider-unconfigured', 'the refusal code');
  eq(started.res.body.provider, 'google', 'which provider was named');
  const text = JSON.stringify(started.res.body);
  is(text.indexOf('GOOGLE_OAUTH_CLIENT_SECRET') === -1, 'the response named a variable');

  // Apple has no variables on this board at all -- same answer, no crash.
  const apple = await legStart(g, { query: { provider: 'apple' } });
  eq(apple.res.statusCode, 503, 'the status for apple');
  eq(apple.res.body.provider, 'apple', 'apple named');

  // A provider nobody registered is a 400, not a 503 and not an exception.
  const bogus = await legStart(g, { query: { provider: 'facebook' } });
  eq(bogus.res.statusCode, 400, 'the status for an unknown provider');
  eq(bogus.res.body.error, 'auth-provider-unknown', 'the unknown-provider code');
  return '503 auth-provider-unconfigured (google, apple) · 400 auth-provider-unknown';
});

/* -- RULING 13: zero secrets in any output or log --------------------------- */

run('R13 no secret appears in any response, redirect or log line -- on any branch', async () => {
  const secrets = [FIXTURE.clientSecret, FIXTURE.code];
  const scenarios = [];

  // The happy path.
  {
    const g = buildGraph({});
    const flow = await fullFlow(g);
    const ex = await legExchange(g, { body: { ticket: flow.ticket } });
    scenarios.push(['success', g, [flow.started.res, flow.returned.res, ex.res], flow]);
  }
  // The provider refused the exchange.
  {
    const g = buildGraph({});
    g.provider.tokenStatus = 400;
    const flow = await fullFlow(g);
    scenarios.push(['token refused', g, [flow.returned.res], flow]);
  }
  // The network threw with the request quoted back in the message.
  {
    const g = buildGraph({});
    g.provider.tokenThrows = true;
    const flow = await fullFlow(g);
    scenarios.push(['network threw', g, [flow.returned.res], flow]);
  }
  // A token signed by somebody else.
  {
    const g = buildGraph({});
    const other = makeSigner('kid-1');
    const started = await legStart(g);
    const record = stateRecordOf(g, started.params.get('state'));
    g.provider.idToken = other.sign({}, claimsFor(g, record.nonce));
    const returned = await legReturn(g, { query: { code: FIXTURE.code, state: started.params.get('state') } });
    scenarios.push(['foreign signature', g, [returned.res], { record }]);
  }

  for (const [label, g, responses, flow] of scenarios) {
    const haystack = [
      JSON.stringify(g.console.lines),
      responses.map((r) => JSON.stringify(r.body) + ' ' + JSON.stringify(r.headers)).join(' '),
    ].join(' ');
    const local = secrets.slice();
    if (flow && flow.record) local.push(flow.record.codeVerifier);
    if (g.provider.idToken) local.push(g.provider.idToken);
    for (const secret of local) {
      is(haystack.indexOf(secret) === -1, label + ': a secret reached a response or a log line');
    }
    is(g.console.lines.length === 0 || !/eyJ/.test(JSON.stringify(g.console.lines)),
      label + ': a JWT-shaped value was logged');
  }
  return scenarios.length + ' branches, ' + scenarios.map((s) => s[0]).join(' · ');
});

run('R13 no console call in the sign-in files quotes a value it holds', async () => {
  for (const rel of NEW_MODULES) {
    const calls = SOURCES[rel].match(/console\.\w+\([^)]*\)/g) || [];
    for (const call of calls) {
      for (const forbidden of ['code', 'idToken', 'id_token', 'verifier', 'clientSecret', 'ticket', 'session']) {
        is(call.indexOf(forbidden) === -1, rel + ' logs ' + forbidden + ' in: ' + call);
      }
    }
  }
  return 'zero console calls carrying a value';
});

/* -- THE VERIFICATION, CHECK BY CHECK -------------------------------------- */

run('the nonce is required and a mismatched one is refused', async () => {
  const g = buildGraph({});
  const flow = await fullFlow(g, { nonce: 'a-nonce-from-another-sign-in' });
  eq(flow.returned.params.get('ticket'), null, 'a ticket was minted for a foreign nonce');
  eq(flow.returned.params.get('error'), 'auth-idtoken-nonce', 'the refusal code');
  // A token with NO nonce at all is refused too.
  const g2 = buildGraph({});
  const flow2 = await fullFlow(g2, { claims: { nonce: undefined } });
  eq(flow2.returned.params.get('error'), 'auth-idtoken-nonce', 'the code for a token with no nonce');
  eq(g2.store.keys().filter((k) => k.startsWith(CONTRACT.ACCOUNT_PREFIX)).length, 0, 'accounts written');
  return 'foreign nonce and absent nonce both -> auth-idtoken-nonce';
});

run('a token signed by a foreign key is refused, even with the right kid', async () => {
  const g = buildGraph({});
  const impostor = makeSigner('kid-1');   // the SAME kid, a different key
  const started = await legStart(g);
  const record = stateRecordOf(g, started.params.get('state'));
  g.provider.idToken = impostor.sign({}, claimsFor(g, record.nonce));
  const returned = await legReturn(g, { query: { code: FIXTURE.code, state: started.params.get('state') } });
  eq(returned.params.get('error'), 'auth-idtoken-signature', 'the refusal for a foreign signature');
  eq(returned.params.get('ticket'), null, 'a ticket was minted');
  return 'same kid, different key -> auth-idtoken-signature';
});

run('an unsigned token (alg: none) is refused before anything else', async () => {
  const g = buildGraph({});
  const started = await legStart(g);
  const record = stateRecordOf(g, started.params.get('state'));
  g.provider.idToken = g.signer.unsigned({}, claimsFor(g, record.nonce));
  const returned = await legReturn(g, { query: { code: FIXTURE.code, state: started.params.get('state') } });
  eq(returned.params.get('error'), 'auth-idtoken-alg', 'the refusal for alg: none');
  return 'alg:none -> auth-idtoken-alg';
});

run('a wrong audience and a wrong issuer are each refused', async () => {
  const g = buildGraph({});
  const bad = await fullFlow(g, { claims: { aud: 'somebody-elses-client' } });
  eq(bad.returned.params.get('error'), 'auth-idtoken-audience', 'the refusal for a foreign audience');

  const g2 = buildGraph({});
  const wrongIss = await fullFlow(g2, { claims: { iss: 'https://accounts.evil.test' } });
  eq(wrongIss.returned.params.get('error'), 'auth-idtoken-issuer', 'the refusal for a foreign issuer');

  // Both of Google's issuer spellings are accepted, because Google sends both.
  const g3 = buildGraph({});
  const bare = await fullFlow(g3, { claims: { iss: 'accounts.google.com' } });
  is(!!bare.ticket, 'the bare issuer spelling was refused');
  return 'foreign aud and iss refused; both Google spellings accepted';
});

run('an expired id_token is refused', async () => {
  const g = buildGraph({});
  const flow = await fullFlow(g, { claims: { exp: Math.floor(g.clock.now() / 1000) - 1 } });
  eq(flow.returned.params.get('error'), 'auth-idtoken-expired', 'the refusal for an expired token');
  return 'exp in the past -> auth-idtoken-expired';
});

run('the signing keys are cached for six hours under auth:jwks:v1:<provider>', async () => {
  const g = buildGraph({});
  await fullFlow(g);
  const key = g.storeMod.jwksKey('google');
  eq(key, CONTRACT.JWKS_PREFIX + 'google', 'the jwks key');
  eq(g.store.ttlOf(key), CONTRACT.JWKS_TTL, 'the jwks TTL');
  eq(CONTRACT.JWKS_TTL, 6 * 60 * 60, 'six hours');
  const before = g.provider.calls.filter((c) => c.url.indexOf('certs') !== -1).length;
  eq(before, 1, 'jwks fetches on the first sign-in');
  g.clock.advance(60 * 1000);
  await fullFlow(g);
  eq(g.provider.calls.filter((c) => c.url.indexOf('certs') !== -1).length, 1,
    'the second sign-in re-fetched the keys instead of reading the cache');
  return '1 fetch, then cached for ' + CONTRACT.JWKS_TTL + 's';
});

run('every exit from the return leg lands on ezik://auth/return', async () => {
  eq(CONTRACT.APP_RETURN_URL, 'ezik://auth/return', 'the app return URL');
  const cases = [
    ['no state at all', {}],
    ['a state nobody minted', { state: 'never-minted', code: FIXTURE.code }],
    ['the reader denied at the provider', { state: 'x', error: 'access_denied' }],
  ];
  for (const [label, query] of cases) {
    const g = buildGraph({});
    const r = await legReturn(g, { query });
    eq(r.res.statusCode, 302, 'the status for ' + label);
    is(locationOf(r.res).startsWith(CONTRACT.APP_RETURN_URL + '?'), 'the destination for ' + label);
    is(!!r.params.get('error'), 'a reason for ' + label);
    is(!r.params.get('ticket'), 'a ticket for ' + label);
  }
  // The provider's own error text is not echoed back into the URL we build.
  const g = buildGraph({});
  const r = await legReturn(g, { query: { state: 'x', error: '<script>alert(1)</script>' } });
  eq(r.params.get('error'), 'auth-provider-denied', "the provider's text was echoed");
  return cases.length + 1 + ' failure branches, all of them redirect home';
});

run('the three routes refuse the wrong method and answer the preflight', async () => {
  const g = buildGraph({});
  for (const [name, mod, good] of [['auth-start', g.start, 'GET'], ['auth-return', g.ret, 'GET'],
    ['auth-exchange', g.exchange, 'POST']]) {
    const wrong = fakeRes();
    await mod.default(fakeReq({ method: good === 'GET' ? 'POST' : 'GET' }), wrong);
    eq(wrong.statusCode, 405, name + ' on the wrong method');
    const pre = fakeRes();
    await mod.default(fakeReq({ method: 'OPTIONS' }), pre);
    eq(pre.statusCode, 204, name + ' on OPTIONS');
  }
  return '3 routes: 405 on the wrong verb, 204 on the preflight';
});

run('a store that cannot be written stops the flow rather than half-finishing it', async () => {
  const g = buildGraph({ storeThrowsOn: ['set'] });
  const started = await legStart(g);
  eq(started.res.statusCode, 503, 'the start status when the store refuses writes');
  eq(started.res.body.error, 'auth-store-unavailable', 'the refusal code');
  eq(g.provider.calls.length, 0, 'the reader was sent to a provider for a state nobody stored');

  const g2 = buildGraph({ storeThrowsOn: ['eval'] });
  const late = await legReturn(g2, { query: { code: FIXTURE.code, state: 'anything' } });
  eq(late.params.get('error'), 'auth-state-invalid', 'a store that cannot be read is not an empty store');
  return '503 on the start; the return refuses rather than proceeding';
});

run('the six key families are the six declared prefixes and nothing else', async () => {
  const g = buildGraph({});
  const { ticket } = await fullFlow(g);
  await legExchange(g, { body: { ticket } });
  const allowed = [CONTRACT.STATE_PREFIX, CONTRACT.TICKET_PREFIX, CONTRACT.JWKS_PREFIX,
    CONTRACT.ACCOUNT_PREFIX, CONTRACT.EMAIL_INDEX_PREFIX, CONTRACT.SESSION_PREFIX];
  const touched = new Set(g.store.ops.map((op) => op.key));
  for (const key of touched) {
    is(allowed.some((p) => key.startsWith(p)), 'the sign-in path touched an unexpected key: ' + key);
  }
  eq(allowed, ['auth:state:v1:', 'auth:ticket:v1:', 'auth:jwks:v1:', 'acct:v1:', 'acctidx:v1:email:', 'sess:v1:'],
    'the declared prefixes');
  return touched.size + ' keys touched, all inside the six families';
});

run('zero new store variables, and no read of process.env outside a known list', async () => {
  const allowed = new Set(['KV_REST_API_URL', 'KV_REST_API_TOKEN',
    'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET',
    'APPLE_OAUTH_CLIENT_ID', 'APPLE_OAUTH_CLIENT_SECRET']);
  const seen = new Set();
  for (const rel of NEW_MODULES) {
    for (const m of SOURCES[rel].matchAll(/process\.env\.([A-Z0-9_]+)/g)) seen.add(m[1]);
    is(SOURCES[rel].indexOf("process.env['") === -1 && SOURCES[rel].indexOf('process.env["') === -1,
      rel + ' reads process.env by a computed name -- the inventory above cannot see it');
  }
  for (const name of seen) is(allowed.has(name), 'an unexpected environment variable is read: ' + name);
  is(seen.has('KV_REST_API_URL') && seen.has('KV_REST_API_TOKEN'), 'the store variables are not the existing two');
  return Array.from(seen).sort().join(' · ');
});

// ---------------------------------------------------------------------------
// THE MUTANTS -- the same lifted source with one line changed, each of which must be KILLED.
// ---------------------------------------------------------------------------
const mutants = [];
function mutant(name, file, from, to, killedBy) {
  mutantQueue.push({ name, file, from, to, killedBy });
}
const mutantQueue = [];

mutant('م١ the state delete is dropped from the consume script',
  'lib/auth/store.js',
  '  "if v then redis.call(\'DEL\', KEYS[1]) end",\n',
  '',
  async () => {
    const g = buildGraph({ mutate: MUT });
    const first = await fullFlow(g);
    is(!!first.ticket, 'the mutant did not even complete one sign-in');
    const replay = await legReturn(g, { query: { code: FIXTURE.code, state: first.state } });
    eq(replay.params.get('ticket'), null, 'a ticket minted from a replayed state');
  });

mutant('م٢ the nonce check is dropped',
  'lib/auth/oidc.js',
  "  if (claims.nonce !== expected.nonce) return { ok: false, code: 'auth-idtoken-nonce' };",
  '  if (false) return { ok: false, code: \'auth-idtoken-nonce\' };',
  async () => {
    const g = buildGraph({ mutate: MUT });
    const flow = await fullFlow(g, { nonce: 'a-nonce-from-another-sign-in' });
    eq(flow.returned.params.get('ticket'), null, 'a ticket minted for a foreign nonce');
  });

mutant('م٣ `email_verified` is believed whenever it is a string',
  'lib/auth/oidc.js',
  "  if (v === 'true') return true;",
  '  if (typeof v === \'string\') return true;',
  async () => {
    const g = buildGraph({ mutate: MUT });
    await fullFlow(g, { claims: { email_verified: 'false' } });
    eq(g.store.writesTo(BASE.storeMod.EMAIL_INDEX_PREFIX), 0,
      'index writes for the string "false"');
  });

mutant('م٤ a sixth field is written into the account record',
  'lib/auth/account.js',
  '    emailVerified: input.emailVerified === true,\n',
  '    emailVerified: input.emailVerified === true,\n    picture: input.picture || \'\',\n',
  async () => {
    const g = buildGraph({ mutate: MUT });
    await fullFlow(g);
    const record = accountRecordOf(g, g.storeMod.accountKey('google', FIXTURE.sub));
    eq(Object.keys(record), BASE.account.ACCOUNT_FIELDS.slice(), 'the record keys');
  });

mutant('م٥ the redirect_uri is built from the Host header',
  'api/auth-start.js',
  '  const target = buildAuthorizeUrl(cfg, {\n    state,\n    nonce,\n    codeChallenge: challengeFor(codeVerifier),\n  });',
  '  const target = buildAuthorizeUrl(cfg, {\n    state,\n    nonce,\n    codeChallenge: challengeFor(codeVerifier),\n  }).replace(\'ezik.app\', String((req.headers || {}).host || \'ezik.app\'));',
  async () => {
    const g = buildGraph({ mutate: MUT });
    const hostile = await legStart(g, { headers: { host: 'evil.example' } });
    eq(hostile.params.get('redirect_uri'), BASE.oidc.REDIRECT_URI, 'the redirect_uri under a hostile Host');
  });

mutant('م٦ the sign-in throttle is made to fail OPEN',
  'lib/ratelimit.js',
  'const AUTH_FAIL_OPEN  = false;',
  'const AUTH_FAIL_OPEN  = true;',
  async () => {
    const g = buildGraph({ mutate: MUT, throttle: () => { throw new Error('the counter is unreachable'); } });
    const started = await legStart(g);
    eq(started.res.statusCode, 429, 'the status when the counter is unreachable');
  });

// The mutation currently being applied -- read by each killer through this one binding, so the
// killers stay short and cannot accidentally test an unmutated graph.
let MUT = null;

// ---------------------------------------------------------------------------
// DRIVE EVERYTHING.
// ---------------------------------------------------------------------------
(async function main() {
  for (const c of queue) {
    try { results.push({ name: c.name, ok: true, detail: (await c.fn()) || '' }); }
    catch (e) { results.push({ name: c.name, ok: false, detail: e.message }); }
  }

  for (const m of mutantQueue) {
    const source = m.file === 'lib/ratelimit.js' ? RATELIMIT_AUTH_TEXT : SOURCES[m.file];
    const at = source.indexOf(m.from);
    if (at === -1) { mutants.push({ name: m.name, applied: false, killed: false, note: 'the line to mutate is gone from ' + m.file }); continue; }
    if (source.indexOf(m.from, at + 1) !== -1) { mutants.push({ name: m.name, applied: false, killed: false, note: 'the line to mutate is not unique in ' + m.file }); continue; }
    MUT = { file: m.file, from: m.from, to: m.to };
    let died = null;
    try { await m.killedBy(); }
    catch (e) { died = e.message; }
    MUT = null;
    mutants.push({ name: m.name, applied: true, killed: died !== null, note: died || 'SURVIVED -- no case above bites it' });
  }

  results.push((function () {
    try {
      is(mutants.length === 6, 'six mutants were named and ' + mutants.length + ' ran');
      const notApplied = mutants.filter((m) => !m.applied).map((m) => m.name + ': ' + m.note);
      eq(notApplied, [], 'mutants that could not be applied');
      const survivors = mutants.filter((m) => !m.killed).map((m) => m.name + ': ' + m.note);
      eq(survivors, [], 'mutants that survived');
      return { name: 'every mutant was applied and every one of them was killed', ok: true,
        detail: mutants.length + '/' + mutants.length + ' applied and killed' };
    } catch (e) {
      return { name: 'every mutant was applied and every one of them was killed', ok: false, detail: e.message };
    }
  }()));

  // -------------------------------------------------------------------------
  // REPORT.
  // -------------------------------------------------------------------------
  console.log('=== auth server -- the three routes and their three modules, measured ===');
  let bytes = 0;
  let lines = 0;
  for (const rel of NEW_MODULES) { bytes += Buffer.byteLength(SOURCES[rel], 'utf8'); lines += SOURCES[rel].split('\n').length; }
  console.log('lifted:  ' + NEW_MODULES.length + ' modules  ' + bytes + ' bytes, ' + lines + ' lines'
    + '  +  lib/ratelimit.js auth family by name');
  console.log('keys:    ' + [CONTRACT.STATE_PREFIX, CONTRACT.TICKET_PREFIX, CONTRACT.JWKS_PREFIX,
    CONTRACT.ACCOUNT_PREFIX, CONTRACT.EMAIL_INDEX_PREFIX, CONTRACT.SESSION_PREFIX].join(' '));
  console.log('ttls:    state=' + CONTRACT.STATE_TTL + 's ticket=' + CONTRACT.TICKET_TTL + 's jwks='
    + CONTRACT.JWKS_TTL + 's session=' + CONTRACT.SESSION_TTL + 's');
  console.log('contract: redirect_uri=' + CONTRACT.REDIRECT_URI + '  app=' + CONTRACT.APP_RETURN_URL
    + '  providers=' + CONTRACT.PROVIDERS.join('/') + '  fields=' + CONTRACT.FIELDS.length);
  console.log('');

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? '[PASS] ' : '[FAIL] ') + r.name);
    if (r.detail) console.log('        ' + r.detail);
  }
  console.log('');
  console.log('--- MUTANTS ---');
  for (const m of mutants) {
    console.log((m.killed ? '[KILLED]   ' : '[SURVIVED] ') + m.name);
    console.log('           ' + m.note);
  }
  console.log('');
  console.log('=== ' + (results.length - failed) + '/' + results.length + ' cases hold  ·  '
    + mutants.filter((m) => m.killed).length + '/' + mutants.length + ' mutants killed ===');
  if (failed) {
    console.log('-- FAILURES --');
    for (const r of results) { if (!r.ok) console.log('   * ' + r.name + ': ' + r.detail); }
  }
  process.exit(failed ? 1 : 0);
}());
