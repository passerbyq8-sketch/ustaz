// articles-public-guard.cjs -- the articles store and the role seam, proved without a network,
// a browser, or one byte written to a live store.
//
// WHAT THIS MEASURES AND WHY IT CAN. Item 20 is two library modules and four routes: a store that
// holds articles and grants, a role seam that decides who may write, two public doors and two
// writing doors. Not one of them needs a real Redis, a real provider or a socket -- they need a
// store that can GET, SET, DEL, ZADD, ZREM and ZRANGE, a session that names an account, and a
// clock this file can move without waiting. So it builds those as fakes it fully controls, LIFTS
// THE REAL SOURCE of all nine modules out of the tree, and runs it.
//
// IT DOES NOT RE-TYPE THE CODE IT IS CHECKING. Every module below is read from disk, parsed with
// @babel/parser -- the same parser the babel gate and tools/build-app.cjs use -- and its import
// and export statements are the ONLY thing rewritten, so that a file written as an ES module can
// be evaluated in a CommonJS guard. Every other byte is the shipped byte. The key prefixes, the
// section list, the field roster and the role names are read from their own declarations at run
// time, so a renamed constant moves the expectation with the code instead of leaving this guard
// measuring an older idea of it.
//
// AND lib/ratelimit.js IS LIFTED BY NAME, not imported. Importing it would construct a real
// Upstash client at module scope against credentials this machine does not have. So the auth
// window family -- the one whose AUTH_FAIL_OPEN is false, which is the family these four routes
// use -- is extracted by declaration name and evaluated against a Ratelimit whose behaviour this
// file chooses. Same reasoning, same shape, as tools/auth-server-measure.cjs.
//
// THE TWO PROPERTIES THIS GATE EXISTS FOR, and they are the two that would hurt most if they
// ever regressed:
//
//   1. NO DRAFT IS REACHABLE THROUGH A PUBLIC ROUTE. Unpublished writing is writing its author
//      has not decided to show anyone. A list route that leaked one, or a by-slug route that
//      served one to whoever guessed the title, would publish on the author's behalf.
//   2. NO PUBLIC ROUTE RESPONSE CONTAINS AN ACCOUNT KEY. `acct:v1:<provider>:<sub>` is the
//      store key of a person's record. Emitting it beside an article would hand every reader the
//      identifier that names its author in the store, and the provider subject behind it.
//
// Both are asserted against the ROUTES AS THEY RUN -- the real handlers, driven with real
// request and response objects -- and not against a description of them.
//
// AND THE THIRD PROPERTY, ADDED ON 2026-09-07 WITH THE EDITOR ROSTER:
//
//   3. A ROLE IS RESOLVED FROM THE BOARD ON EVERY SINGLE REQUEST AND IS NEVER REMEMBERED. Access
//      now arrives by a second environment row, EZIK_EDITOR_ACCOUNTS, and the only way its owner
//      can take that access away is to remove a digest from it. A role cached anywhere -- in a
//      variable, in a record, across two calls -- would be a privilege that outlived its grant,
//      which is the one failure the whole design exists to prevent. So a case below empties the
//      row IN PLACE, inside one process, with no module reloaded and no session re-minted, and
//      reads the refusal off the very next request.
//
// AND EVERY RUN OF THIS GUARD IS THE SAME RUN. Until 2026-09-07 every id under test came from
// the real crypto.randomBytes, so this board rolled dice. An article id is base64url, about one
// in thirty-two begins with '-' or '_', and until the fix of the same date such an id could not
// be claimed as a slug -- so `npm run gates` went red roughly half the time for a reason that
// had nothing to do with whatever was being tested. A gate that fails at random is worse than no
// gate, because it teaches everyone who sees it to ignore red. So the byte source below is
// SEEDED: every graph draws the same bytes in the same order on every run, session tokens and
// article ids alike, and the two id shapes that used to arrive by luck are now DEMANDED BY NAME
// in the one case that exists for them. Nothing here waits for a coin to land.
//
// AND IT CANNOT PASS BY DOING NOTHING. SEVENTEEN MUTANTS are compiled at the end from the same
// lifted source with one line changed each -- the draft filter removed from the list, the draft
// filter removed from the by-slug read, the account key added to the public view, the default
// role turned into `editor`, the owner check dropped from grantRole, an empty owner row read as
// "everybody", the slug claim made to overwrite, the revoke made to not delete, the root-grant
// refusal removed, the verified-address check dropped, the editor row made to satisfy the OWNER
// check, the resolved role cached across requests, an empty editor row read as "everybody", and
// the roles door made to tell an editor apart from a stranger again, the id fallback stripped
// of the prefix that makes it claimable, slugify made to stop stripping decoration so a vowelled
// Arabic heading shatters into fragments again, and slugify made to keep the TATWEEL so a
// stretched word and its unstretched twin mint two URLs again -- and every one of them must
// be KILLED by a named case above. A guard that cannot go red proves nothing.
//
// R5 OF THE DIRECTIVE: NOTHING HERE CONNECTS TO A STORE. The @upstash/redis module is never
// loaded; the constructor the lifted modules see is this file's own. `git status` is as empty
// after this guard as before it.
//
// Usage:  node guards/articles-public-guard.cjs
// Exit:   0 when every case holds and every mutant dies; 1 with the failures named.
'use strict';

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('node:crypto');

const REPO = path.join(__dirname, '..');
const parser = require(path.join(REPO, 'node_modules', '@babel', 'parser'));

const MODULES = [
  'lib/auth/store.js',
  'lib/auth/account.js',
  'lib/articles/store.js',
  'lib/articles/roles.js',
  'lib/articles/public-view.js',
  'api/articles-list.js',
  'api/articles-get.js',
  'api/articles-admin.js',
  'api/roles-admin.js',
];

const PUBLIC_ROUTES = ['api/articles-list.js', 'api/articles-get.js'];

const SOURCES = {};
for (const rel of MODULES) SOURCES[rel] = fs.readFileSync(path.join(REPO, rel), 'utf8');
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
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') defaultName = spec.local.name;
        else if (spec.type === 'ImportNamespaceSpecifier') {
          throw new Error(rel + ': namespace import is not handled by this guard');
        } else {
          named.push(spec.imported.name === spec.local.name
            ? spec.local.name : spec.imported.name + ': ' + spec.local.name);
        }
      }
      const lines = [];
      if (defaultName) lines.push('const ' + defaultName + ' = __dep(' + from + ').default;');
      if (named.length) lines.push('const { ' + named.join(', ') + ' } = __dep(' + from + ');');
      edits.push({ start: node.start, end: node.end, text: lines.join(' ') });
      continue;
    }

    if (node.type === 'ExportNamedDeclaration') {
      if (!node.declaration) throw new Error(rel + ': `export { ... }` is not handled by this guard');
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

/**
 * The globals a lifted module may see. `process`, `console` and `Date` come from the harness so
 * the environment, the log and the clock are all facts this guard sets. Everything else is real.
 */
const GLOBAL_PREAMBLE = [
  '"use strict";',
  'const process = __env.process;',
  'const console = __env.console;',
  'const Date = __env.Date;',
].join('\n');

function compileModule(rel, source) {
  const { body, exported } = rewriteModule(source, rel);
  const full = GLOBAL_PREAMBLE + '\n' + body + '\n;return { ' + exported.join(', ') + ' };';
  return new Function('__dep', '__env', full);
}

// ---------------------------------------------------------------------------
// LIFTING NAMED DECLARATIONS OUT OF A MODULE WE MUST NOT EVALUATE WHOLE.
// ---------------------------------------------------------------------------

function namedDeclarations(source) {
  const ast = parser.parse(source, { sourceType: 'module' });
  const found = new Map();
  const consider = (node, decl) => {
    if (decl.type === 'FunctionDeclaration' && decl.id) found.set(decl.id.name, node);
    else if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) if (d.id.type === 'Identifier') found.set(d.id.name, node);
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

const RATELIMIT = namedDeclarations(RATELIMIT_SRC);
const ATTEMPTS = namedDeclarations(ATTEMPTS_SRC);
const DAYCAP = namedDeclarations(DAYCAP_SRC);

const RATELIMIT_AUTH_TEXT = liftNames('lib/ratelimit.js', RATELIMIT,
  ['ALLOWED_ORIGINS', 'applyCorsOrigin', 'AUTH_FAIL_OPEN', 'AUTH_PER_IP_MIN', 'AUTH_PER_IP_DAY',
    'AUTH_WINDOWS', 'checkAuthLimit']);
const ATTEMPTS_TEXT = liftNames('lib/attempts.js', ATTEMPTS, ['clientAddress']);
const DAYCAP_TEXT = liftNames('lib/daycap.js', DAYCAP, ['DEVICE_HEADER', 'safeId']);

// ---------------------------------------------------------------------------
// THE FAKES.
// ---------------------------------------------------------------------------

/** A clock this guard drives. Nothing waits, and a timestamp is a fact rather than a hope. */
function fakeClock(startMs) {
  let now = startMs;
  const Real = Date;
  class FakeDate extends Real {
    constructor(...args) { if (args.length === 0) super(now); else super(...args); }
    static now() { return now; }
    static parse(s) { return Real.parse(s); }
    static UTC(...a) { return Real.UTC(...a); }
  }
  return { now: () => now, advance: (ms) => { now += ms; }, Date: FakeDate };
}

/**
 * A BYTE SOURCE THIS GUARD DRIVES, for the same reason fakeClock() exists: a fact the board
 * depends on should be chosen here rather than drawn from the machine.
 *
 * `randomBytes` is the ONLY member replaced. Everything else on node:crypto -- createHash above
 * all, which keys the owner and editor rows -- stays the real implementation, so the digests
 * this guard measures are the digests production computes. The stream itself is real SHA-256
 * over a counter, so it is deterministic without being a run of zeroes that no real id could
 * ever have come out of.
 *
 * `forcedIds` is how a case DEMANDS a particular article id. A twelve-byte draw is the article
 * id mint and nothing else among the modules lifted here -- lib/auth/account.js draws
 * thirty-two for a session -- so the queue is consumed at that width alone, in order, and the
 * seeded stream takes over once it is empty. Ids are written as the sixteen-character base64url
 * strings a case wants to read, not as bytes, and every case that forces one asserts the id it
 * got back, so a mistyped fixture cannot pass quietly.
 */
const ARTICLE_ID_BYTES = 12;

function fakeCrypto(seed, forcedIds) {
  const queue = (forcedIds || []).slice();
  let counter = 0;
  let pool = Buffer.alloc(0);
  const seededBytes = (n) => {
    while (pool.length < n) {
      const block = nodeCrypto.createHash('sha256').update(seed + ':' + counter).digest();
      counter++;
      pool = Buffer.concat([pool, block]);
    }
    const out = Buffer.from(pool.subarray(0, n));
    pool = Buffer.from(pool.subarray(n));
    return out;
  };
  const randomBytes = (n) => {
    if (n === ARTICLE_ID_BYTES && queue.length) {
      const id = queue.shift();
      const buf = Buffer.from(String(id), 'base64url');
      if (buf.length !== ARTICLE_ID_BYTES) {
        throw new Error('a forced article id is not twelve bytes of base64url: ' + id);
      }
      return buf;
    }
    return seededBytes(n);
  };
  // A proxy rather than a copy: a module reaching for any other member of node:crypto gets the
  // real one, and `.default` is the facade itself, because the lifted `import crypto from` form
  // reads it off the namespace this returns.
  const facade = new Proxy(nodeCrypto, {
    get(target, prop, receiver) {
      if (prop === 'randomBytes') return randomBytes;
      if (prop === 'default') return facade;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { facade, remaining: () => queue.length };
}

function fakeConsole() {
  const lines = [];
  const push = (kind) => (...a) => lines.push(kind + ' ' + a.map((x) => String(x)).join(' '));
  return { lines, log: push('log'), warn: push('warn'), error: push('error'), info: push('log') };
}

/**
 * An in-memory Upstash: strings with real NX, sorted sets with real scores and a real reverse
 * range, and a log of every operation so "did anything get an expiry" is a counted fact rather
 * than a reading of the source.
 *
 * `throwOn` makes a named command refuse. That is how "a store error resolves to no access" is
 * measured: the store genuinely fails, and the answer is read off the route.
 */
function fakeStore(clock, opts) {
  const o = opts || {};
  const map = new Map();
  const zsets = new Map();
  const ops = [];
  const refuse = (cmd) => { if (o.throwOn && o.throwOn.has(cmd)) throw new Error('fake store refused ' + cmd.toUpperCase()); };

  const self = {
    ops,
    keys: () => [...map.keys()].sort(),
    zkeys: () => [...zsets.keys()].sort(),
    rawGet: (k) => (map.has(k) ? map.get(k).value : null),
    rawSet: (k, v) => map.set(k, { value: v, expiresAt: null }),
    /** Every key that was ever given an expiry. The articles families must never appear here. */
    expiringKeys: () => ops.filter((op) => op.ex).map((op) => op.key),
    zmembers: (k) => {
      const z = zsets.get(k);
      if (!z) return [];
      return [...z.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    },
  };

  function Redis(cfg) { this.url = cfg && cfg.url; this.token = cfg && cfg.token; }

  Redis.prototype.get = async function (k) {
    ops.push({ cmd: 'get', key: k });
    refuse('get');
    return self.rawGet(k);
  };
  Redis.prototype.set = async function (k, v, options) {
    const nx = !!(options && options.nx);
    const ex = options && options.ex ? options.ex : null;
    ops.push({ cmd: 'set', key: k, nx, ex });
    refuse('set');
    if (nx && map.has(k)) return null;
    map.set(k, { value: v, expiresAt: ex === null ? null : clock.now() + ex * 1000 });
    return 'OK';
  };
  Redis.prototype.del = async function (k) {
    ops.push({ cmd: 'del', key: k });
    refuse('del');
    map.delete(k);
    return 1;
  };
  Redis.prototype.expire = async function (k, seconds) {
    ops.push({ cmd: 'expire', key: k, ex: seconds });
    refuse('expire');
    const rec = map.get(k);
    if (rec) rec.expiresAt = clock.now() + seconds * 1000;
    return 1;
  };
  Redis.prototype.zadd = async function (k, entry) {
    ops.push({ cmd: 'zadd', key: k });
    refuse('zadd');
    if (!zsets.has(k)) zsets.set(k, new Map());
    zsets.get(k).set(String(entry.member), Number(entry.score));
    return 1;
  };
  Redis.prototype.zrem = async function (k, member) {
    ops.push({ cmd: 'zrem', key: k });
    refuse('zrem');
    const z = zsets.get(k);
    if (z) z.delete(String(member));
    return 1;
  };
  Redis.prototype.zrange = async function (k, start, stop, options) {
    ops.push({ cmd: 'zrange', key: k });
    refuse('zrange');
    const rev = !!(options && options.rev);
    const z = zsets.get(k);
    if (!z) return [];
    const rows = [...z.entries()].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1])).map((e) => e[0]);
    if (stop < start) return [];
    return rows.slice(start, stop + 1);
  };
  // The auth store's one-shot consume. Never reached by the articles path, and present so that
  // loading lib/auth/store.js cannot fall over on a method the fake does not have.
  Redis.prototype.eval = async function () { return null; };

  self.Redis = Redis;
  return self;
}

function fakeReq(opts) {
  const o = opts || {};
  const headers = {};
  for (const [k, v] of Object.entries(o.headers || {})) headers[k.toLowerCase()] = v;
  return { method: o.method || 'GET', query: o.query || {}, body: o.body, headers };
}

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = v; return res; };
  res.getHeader = (k) => res.headers[String(k).toLowerCase()];
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.ended = true; return res; };
  res.send = (b) => { res.body = b; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

// ---------------------------------------------------------------------------
// THE FIXTURES.
//
// THE THREE "ADDRESSES" ARE NOT ADDRESSES. emailDigest() lower-cases, trims and hashes whatever
// string it is handed, so a fixture needs no '@' to exercise it -- and this repository is public,
// so the directive's rule is that no address-shaped literal goes into the tree at all. What is
// being measured is that the SAME function keys the board row and the store index; a fixture
// shaped like an address would measure nothing extra.
// ---------------------------------------------------------------------------
const FIXTURE = {
  ownerEmail: 'fixture-owner-one',
  editorEmail: 'fixture-editor-two',
  strangerEmail: 'fixture-stranger-three',
  ownerSub: '700000001',
  editorSub: '700000002',
  strangerSub: '700000003',
  device: 'device-bbbb2222',
};

function digestOf(value) {
  return nodeCrypto.createHash('sha256').update(String(value).trim().toLowerCase(), 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// THE GRAPH -- nine modules wired to the fakes, rebuilt fresh for every scenario.
//
// MUTATION IS A FILE-LEVEL SWITCH RATHER THAN AN ARGUMENT, on purpose: the mutant pass re-runs
// THE WHOLE BOARD, and every case builds its own graph through helpers that take no mutation
// parameter. A switch read inside load() therefore reaches every graph any case builds, and no
// case has to know it is being mutated.
// ---------------------------------------------------------------------------

let MUTATION = null;

function buildGraph(options) {
  const o = options || {};
  const clock = fakeClock(o.startMs || 1757000000000);
  const store = fakeStore(clock, { throwOn: o.storeThrowsOn ? new Set(o.storeThrowsOn) : null });
  const crypto_ = fakeCrypto(o.seed || 'ezik-articles-guard-v1', o.articleIds);
  const console_ = fakeConsole();

  const env = Object.assign({
    KV_REST_API_URL: 'https://store.invalid',
    KV_REST_API_TOKEN: 'kv-tok',
  }, o.env || {});
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];

  const moduleEnv = { process: { env }, console: console_, Date: clock.Date };

  const Ratelimit = (function makeRatelimit() {
    function R(opts2) { this.prefix = opts2.prefix; }
    R.slidingWindow = (n, w) => ({ n, w });
    R.prototype.limit = async function (ip) {
      if (o.throttle) return o.throttle(this.prefix, ip);
      return { success: true };
    };
    return R;
  }());

  const cache = new Map();
  const pending = new Set();
  const shims = {};

  function dep(spec, fromRel) {
    if (spec === 'node:crypto') return crypto_.facade;
    if (spec === '@upstash/redis') return { Redis: store.Redis };
    if (spec.endsWith('/ratelimit.js')) return shims.ratelimit;
    if (spec.endsWith('/attempts.js')) return shims.attempts;
    if (spec.endsWith('/daycap.js')) return shims.daycap;
    const base = path.posix.dirname(fromRel);
    const rel = path.posix.normalize(path.posix.join(base, spec));
    if (!SOURCES[rel]) throw new Error(fromRel + ' imports an unknown module: ' + spec);
    return load(rel);
  }

  function mutated(rel, source) {
    const m = MUTATION || o.mutate;
    if (!m || m.file !== rel) return source;
    const at = source.indexOf(m.from);
    if (at === -1) throw new Error('MUTANT ANCHOR MISSING in ' + rel);
    if (source.indexOf(m.from, at + 1) !== -1) throw new Error('MUTANT ANCHOR NOT UNIQUE in ' + rel);
    return source.slice(0, at) + m.to + source.slice(at + m.from.length);
  }

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    if (pending.has(rel)) throw new Error('import cycle at ' + rel);
    pending.add(rel);
    const factory = compileModule(rel, mutated(rel, SOURCES[rel]));
    const ns = factory((spec) => dep(spec, rel), moduleEnv);
    cache.set(rel, ns);
    pending.delete(rel);
    return ns;
  }

  {
    const text = mutated('lib/ratelimit.js', RATELIMIT_AUTH_TEXT);
    shims.ratelimit = new Function('Ratelimit', 'redis', 'console', text
      + '\n;return { ALLOWED_ORIGINS, applyCorsOrigin, checkAuthLimit, AUTH_FAIL_OPEN,'
      + ' AUTH_PER_IP_MIN, AUTH_PER_IP_DAY, AUTH_WINDOWS };')(Ratelimit, {}, console_);
    shims.attempts = new Function(ATTEMPTS_TEXT + '\n;return { clientAddress };')();
    shims.daycap = new Function(DAYCAP_TEXT + '\n;return { DEVICE_HEADER, safeId };')();
  }

  const g = {
    clock,
    store,
    forcedIdsLeft: crypto_.remaining,
    env,
    console: console_,
    authStore: load('lib/auth/store.js'),
    account: load('lib/auth/account.js'),
    articles: load('lib/articles/store.js'),
    roles: load('lib/articles/roles.js'),
    view: load('lib/articles/public-view.js'),
    list: load('api/articles-list.js'),
    get: load('api/articles-get.js'),
    admin: load('api/articles-admin.js'),
    rolesAdmin: load('api/roles-admin.js'),
  };

  /** Seeds an account record and a live session, exactly as the sign-in path would have. */
  g.signIn = async (provider, sub, email, verified) => {
    const upsert = await g.account.upsertAccount({
      provider, sub, email, emailVerified: verified !== false,
    });
    if (!upsert.ok) throw new Error('the fixture account could not be written: ' + upsert.code);
    const minted = await g.account.mintSession(upsert.key);
    if (!minted.ok) throw new Error('the fixture session could not be minted: ' + minted.code);
    return { accountKey: upsert.key, session: minted.session };
  };

  return g;
}

// ---------------------------------------------------------------------------
// DRIVING THE ROUTES.
// ---------------------------------------------------------------------------

async function callList(g, query) {
  const req = fakeReq({ method: 'GET', query, headers: { 'x-forwarded-for': '198.51.100.7' } });
  const res = fakeRes();
  await g.list.default(req, res);
  return res;
}

async function callGet(g, query) {
  const req = fakeReq({ method: 'GET', query, headers: { 'x-forwarded-for': '198.51.100.7' } });
  const res = fakeRes();
  await g.get.default(req, res);
  return res;
}

async function callAdmin(g, body) {
  const req = fakeReq({ method: 'POST', body, headers: { 'x-forwarded-for': '198.51.100.7' } });
  const res = fakeRes();
  await g.admin.default(req, res);
  return res;
}

async function callRoles(g, body) {
  const req = fakeReq({ method: 'POST', body, headers: { 'x-forwarded-for': '198.51.100.7' } });
  const res = fakeRes();
  await g.rolesAdmin.default(req, res);
  return res;
}

// ---------------------------------------------------------------------------
// THE BOARD.
// ---------------------------------------------------------------------------

const results = [];
const QUEUE = [];
function run(name, fn) { QUEUE.push({ name, fn }); }

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': got ' + a + ', wanted ' + b);
}
function is(cond, what) { if (!cond) throw new Error(what); }

/** The one scenario most cases start from: an owner, an editor granted `articles`, a stranger. */
async function seeded(options) {
  const o = options || {};
  const g = buildGraph(Object.assign({
    env: { EZIK_OWNER_ACCOUNTS: o.ownerRow === undefined ? digestOf(FIXTURE.ownerEmail) : o.ownerRow },
  }, o.graph || {}));

  const owner = await g.signIn('google', FIXTURE.ownerSub, FIXTURE.ownerEmail, true);
  const editor = await g.signIn('google', FIXTURE.editorSub, FIXTURE.editorEmail, true);
  const stranger = await g.signIn('google', FIXTURE.strangerSub, FIXTURE.strangerEmail, true);

  if (o.grantEditor !== false) {
    const granted = await callRoles(g, {
      session: owner.session,
      action: 'grant',
      accountKey: editor.accountKey,
      sections: o.editorSections || ['articles'],
    });
    if (granted.statusCode !== 200) {
      throw new Error('the fixture grant was refused: ' + JSON.stringify(granted.body));
    }
  }
  return { g, owner, editor, stranger };
}

/** Creates an article as the given session and returns the stored record. */
async function createAs(g, session, section, title, body) {
  const res = await callAdmin(g, { session, action: 'create', section, title, body: body || 'body text' });
  if (res.statusCode !== 200) throw new Error('create refused: ' + JSON.stringify(res.body));
  return res.body.article;
}

/**
 * THE SECOND RUNG'S SCENE: an owner on the owner row, and a second person on the EDITOR ROW with
 * NO STORED GRANT AT ALL. That last part is the point of this helper existing beside seeded():
 * every case built on seeded() reaches `editor` through api/roles-admin.js and a store record, so
 * none of them can tell whether the row is doing anything. Here `role:v1:<key>` is never written,
 * and every right the person exercises has to have come off the board.
 *
 *   editorRow    the literal value of EZIK_EDITOR_ACCOUNTS. `null` leaves the row ABSENT --
 *                which is not the same as empty, and both are measured below.
 *   verified     false signs the editor in with an UNPROVED address, same digest, same row.
 */
async function rowEditorScene(options) {
  const o = options || {};
  const env = { EZIK_OWNER_ACCOUNTS: digestOf(FIXTURE.ownerEmail) };
  const row = Object.prototype.hasOwnProperty.call(o, 'editorRow')
    ? o.editorRow : digestOf(FIXTURE.editorEmail);
  if (row !== null) env.EZIK_EDITOR_ACCOUNTS = row;

  const g = buildGraph(Object.assign({ env }, o.graph || {}));
  const owner = await g.signIn('google', FIXTURE.ownerSub, FIXTURE.ownerEmail, true);
  const editor = await g.signIn('google', FIXTURE.editorSub, FIXTURE.editorEmail, o.verified !== false);
  const stranger = await g.signIn('google', FIXTURE.strangerSub, FIXTURE.strangerEmail, true);

  // NOT ONE GRANT IS WRITTEN HERE, and this asserts it rather than trusting the lines above.
  const stored = await g.roles.grantedRole(editor.accountKey);
  if (stored !== null) throw new Error('the row scene wrote a store grant, so it measures nothing');
  return { g, owner, editor, stranger };
}

const ACCOUNT_KEY_SHAPE = /acct:v1:/;

/* -- THE FIRST GATE PROPERTY: NO DRAFT REACHES A PUBLIC ROUTE ---------------- */

run('a draft never appears in listPublished, and the filter is in the store', async () => {
  const { g, editor } = await seeded();
  const draft = await createAs(g, editor.session, 'articles', 'A draft that stays in');
  const shown = await createAs(g, editor.session, 'articles', 'A piece that goes out');
  const pub = await callAdmin(g, { session: editor.session, action: 'publish', id: shown.id });
  is(pub.statusCode === 200, 'the fixture publish was refused');

  const out = await g.articles.listPublished('articles', {});
  is(out.ok, 'listPublished refused');
  eq(out.items.map((a) => a.id), [shown.id], 'the ids listPublished returned');
  is(out.items.every((a) => a.status === 'published'), 'a non-published record came out');
  // ...and the editor's list, which is allowed to see it, does.
  const all = await g.articles.listAllForEditor('articles', {});
  is(all.ok && all.items.length === 2, 'listAllForEditor did not see both');
  return '1 draft + 1 published -> listPublished returned ' + out.items.length
    + ', listAllForEditor returned ' + all.items.length + '  (draft id ' + draft.id + ' withheld)';
});

run('GATE the public LIST route never emits a draft', async () => {
  const { g, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'Draft one');
  const b = await createAs(g, editor.session, 'articles', 'Draft two');
  const c = await createAs(g, editor.session, 'articles', 'The published one');
  await callAdmin(g, { session: editor.session, action: 'publish', id: c.id });

  const res = await callList(g, { section: 'articles' });
  eq(res.statusCode, 200, 'the list route status');
  const text = JSON.stringify(res.body);
  eq(res.body.items.map((x) => x.slug), [c.slug], 'the slugs the route emitted');
  for (const draft of [a, b]) {
    is(text.indexOf(draft.slug) === -1, 'a draft slug reached the public list: ' + draft.slug);
    is(text.indexOf(draft.title) === -1, 'a draft title reached the public list: ' + draft.title);
  }
  is(text.indexOf('"status"') === -1, 'the public list emitted a status field');
  return '3 articles, 1 published -> the route emitted ' + res.body.items.length;
});

run('GATE the public BY-SLUG route never emits a draft, and says 404 exactly as it does for an absent one', async () => {
  const { g, editor } = await seeded();
  const draft = await createAs(g, editor.session, 'articles', 'Not for anyone yet');

  // THE STORE'S OWN LAYER FIRST. The route refuses a draft twice over -- getPublishedBySlug()
  // withholds it and publicArticle() refuses it again on the way out -- so a case that only read
  // the route's status could not tell which of the two was doing the work, and would still pass
  // with the store's filter deleted. Both layers are therefore measured, separately.
  eq(await g.articles.getPublishedBySlug(draft.slug), null, 'the store handed a draft to the public reader');
  is((await g.articles.getArticleBySlug(draft.slug)) !== null, 'the editor read cannot see it either, so this proves nothing');

  const hidden = await callGet(g, { slug: draft.slug });
  eq(hidden.statusCode, 404, 'the by-slug status for a draft');
  const absent = await callGet(g, { slug: 'no-such-piece-at-all' });
  eq(absent.statusCode, 404, 'the by-slug status for an absent slug');
  eq(hidden.body, absent.body, 'a draft and an absent article answer differently');

  // ...and the same slug, once published, is served.
  await callAdmin(g, { session: editor.session, action: 'publish', id: draft.id });
  const shown = await callGet(g, { slug: draft.slug });
  eq(shown.statusCode, 200, 'the by-slug status once published');
  eq(shown.body.article.slug, draft.slug, 'the slug that came back');

  // ...and unpublishing takes it off the internet again, in the same instant.
  await callAdmin(g, { session: editor.session, action: 'unpublish', id: draft.id });
  const gone = await callGet(g, { slug: draft.slug });
  eq(gone.statusCode, 404, 'the by-slug status after an unpublish');
  return 'draft 404 -> published 200 -> unpublished 404, and the draft body is byte-identical to the absent one';
});

run('an unpublished article that still carries publishedAt is still withheld', async () => {
  const { g, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'Published then withdrawn');
  await callAdmin(g, { session: editor.session, action: 'publish', id: a.id });
  const after = await callAdmin(g, { session: editor.session, action: 'unpublish', id: a.id });
  is(after.statusCode === 200, 'the unpublish was refused');
  is(typeof after.body.article.publishedAt === 'string' && after.body.article.publishedAt.length > 0,
    'publishedAt was erased by the unpublish -- the record of when it was public is gone');
  eq(after.body.article.status, 'draft', 'the status after an unpublish');

  const res = await callList(g, { section: 'articles' });
  eq(res.body.items, [], 'a record with a publishedAt but a draft status reached the reader');
  return 'publishedAt=' + after.body.article.publishedAt + ' kept, status=draft, list empty';
});

/* -- THE SECOND GATE PROPERTY: NO ACCOUNT KEY LEAVES A PUBLIC ROUTE ---------- */

run('GATE no public route response contains an account key', async () => {
  const { g, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'One for everybody');
  await callAdmin(g, { session: editor.session, action: 'publish', id: a.id });

  const listRes = await callList(g, { section: 'articles' });
  const getRes = await callGet(g, { slug: a.slug });
  eq([listRes.statusCode, getRes.statusCode], [200, 200], 'the two public statuses');

  for (const [label, res] of [['list', listRes], ['get', getRes]]) {
    const text = JSON.stringify(res.body);
    is(!ACCOUNT_KEY_SHAPE.test(text), 'the ' + label + ' route emitted an account-key prefix');
    is(text.indexOf(editor.accountKey) === -1, 'the ' + label + ' route emitted the author key');
    is(text.indexOf(FIXTURE.editorSub) === -1, 'the ' + label + ' route emitted the provider subject');
    is(text.indexOf('authorKey') === -1, 'the ' + label + ' route emitted an authorKey field');
    // D-7: articles are published UNSIGNED, so there is no author field of any name out here.
    is(text.indexOf('authorName') === -1, 'the ' + label + ' route emitted an authorName field');
    is(text.indexOf('author') === -1, 'the ' + label + ' route emitted a field whose name says author');
    is(text.indexOf(FIXTURE.editorEmail) === -1, 'the ' + label + ' route emitted the address');
  }
  // ...and the article the store holds DOES carry the key, so the check above is not passing
  // merely because there was nothing to leak.
  const stored = await g.articles.getArticleById(a.id);
  eq(stored.authorKey, editor.accountKey, 'the stored record does not carry the author key');
  return 'stored authorKey = ' + stored.authorKey + '; emitted keys = '
    + Object.keys(getRes.body.article).join(',');
});

run('the public projection is a whitelist of five UNSIGNED fields, and a stored name cannot ride out on it', async () => {
  const { g } = await seeded();
  eq(g.view.PUBLIC_FIELDS.slice(), ['slug', 'section', 'title', 'body', 'publishedAt'],
    'the declared public fields');
  const emitted = g.view.publicArticle({
    id: 'x', slug: 's', section: 'articles', title: 't', body: 'b', status: 'published',
    authorKey: 'acct:v1:google:1', createdAt: 'c', updatedAt: 'u', publishedAt: 'p',
    // Two fields the record does not have today, offered anyway:
    authorEmail: 'must-not-appear', internalNote: 'must-not-appear',
    // ...and a display name, offered by a record that has grown one. D-7 says it is not published.
    authorName: 'must-not-appear',
  });
  eq(Object.keys(emitted), g.view.PUBLIC_FIELDS.slice(), 'the keys the projection built');
  is(JSON.stringify(emitted).indexOf('must-not-appear') === -1, 'an offered extra field was emitted');

  // DECISION D-7, AND IT IS ASSERTED ON THE KEYS RATHER THAN ON THEIR VALUES. Until 2026-09-07
  // this projection carried an `authorName` that held null on every article in existence. A key
  // holding null is precisely the shape D-7 rejected -- it promises a client that a name may one
  // day arrive in it -- so "the value is null" is not the property to measure. The property is
  // that the key IS NOT THERE.
  for (const field of ['authorName', 'authorKey', 'author', 'byline']) {
    is(!Object.prototype.hasOwnProperty.call(emitted, field),
      'the projection still carries a ' + field + ' key');
    is(g.view.PUBLIC_FIELDS.indexOf(field) === -1, field + ' is still on the whitelist');
  }
  // ...and the seam that used to resolve the name is gone with the field it fed, rather than left
  // standing as an unused export that the next reader would take for a plan.
  is(typeof g.view.resolveDisplayName === 'undefined', 'the display-name seam is still exported');

  return 'thirteen fields offered, ' + Object.keys(emitted).length + ' emitted ('
    + Object.keys(emitted).join(',') + '), no author field of any name';
});

/**
 * COMMENTS ARE STRIPPED BEFORE THE CODE IS SEARCHED, and that is not a loosening. Both public
 * routes EXPLAIN in prose that they do not consult the role seam and name resolveActor() while
 * doing it -- which is the documentation working. A check that read the prose as a call would
 * make "say what you do not do" indistinguishable from doing it, and the obvious way to satisfy
 * it would be to delete the explanation.
 */
function codeOf(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

run('neither public route imports the role seam', async () => {
  const offenders = [];
  for (const rel of PUBLIC_ROUTES) {
    const src = SOURCES[rel];
    const imports = [...src.matchAll(/^import[\s\S]*?from\s+'([^']+)';/gm)].map((m) => m[1]);
    if (imports.some((spec) => /roles\.js$/.test(spec))) offenders.push(rel + ' imports the role module');
    if (/\bresolveActor\s*\(/.test(codeOf(src))) offenders.push(rel + ' calls resolveActor');
    if (/\bactorMaySection\s*\(/.test(codeOf(src))) offenders.push(rel + ' calls actorMaySection');
    // ...and the prose that says so is still there, so the two checks above cannot be satisfied
    // by deleting the explanation instead of the code.
    if (codeOf(src) === src) offenders.push(rel + ' carries no comment at all');
    if (src.indexOf('roles.js') === -1) offenders.push(rel + ' no longer says why it does not');
  }
  eq(offenders, [], 'a public route reaches the role seam');
  return PUBLIC_ROUTES.join(' and ') + ' import no role module and call no actor resolver';
});

/* -- THE ROLE SEAM ---------------------------------------------------------- */

run('an account with no grant cannot create, update, publish, unpublish or delete', async () => {
  const { g, editor, stranger } = await seeded();
  const mine = await createAs(g, editor.session, 'articles', 'The editor wrote this');

  const attempts = [
    ['create', { session: stranger.session, action: 'create', section: 'articles', title: 'Not allowed', body: 'x' }],
    ['update', { session: stranger.session, action: 'update', id: mine.id, patch: { title: 'Hijacked' } }],
    ['publish', { session: stranger.session, action: 'publish', id: mine.id }],
    ['unpublish', { session: stranger.session, action: 'unpublish', id: mine.id }],
    ['delete', { session: stranger.session, action: 'delete', id: mine.id }],
  ];
  const statuses = [];
  for (const [label, body] of attempts) {
    const res = await callAdmin(g, body);
    statuses.push(label + '=' + res.statusCode);
    is(res.statusCode !== 200, 'the stranger was allowed to ' + label);
    is(res.body && res.body.ok === false, 'the ' + label + ' refusal did not say ok:false');
  }
  // Nothing moved.
  const after = await g.articles.getArticleById(mine.id);
  is(after !== null, 'the stranger deleted the article');
  eq(after.title, mine.title, 'the stranger changed the title');
  eq(after.status, 'draft', 'the stranger published the article');
  const all = await g.articles.listAllForEditor('articles', {});
  eq(all.items.length, 1, 'the stranger created an article');
  return statuses.join(' ');
});

run('an editor granted `articles` cannot reach a piece in `women`, even knowing its id', async () => {
  const { g, owner, editor } = await seeded();
  const theirs = await createAs(g, owner.session, 'women', 'In the other section');

  const reach = await callAdmin(g, { session: editor.session, action: 'publish', id: theirs.id });
  eq(reach.statusCode, 404, 'the cross-section status -- a 403 would confirm the article exists');
  const make = await callAdmin(g, { session: editor.session, action: 'create', section: 'women', title: 'No', body: 'x' });
  eq(make.statusCode, 403, 'the cross-section create status');
  const still = await g.articles.getArticleById(theirs.id);
  eq(still.status, 'draft', 'the cross-section publish went through');
  return 'publish -> 404 (indistinguishable from absent), create -> 403';
});

run('an editor cannot grant a role', async () => {
  const { g, editor, stranger } = await seeded();

  // THE SEAM'S OWN LAYER FIRST, for the reason the by-slug case records: api/roles-admin.js
  // compares the role to `owner` before it calls grantRole, and grantRole compares it again. A
  // case that only read the route's status would still pass with grantRole's own check deleted,
  // which is the check that protects every future caller of it.
  const editorActor = await g.roles.resolveActor({ body: { session: editor.session } });
  is(editorActor !== null && editorActor.role === 'editor', 'the fixture editor is not an editor');
  const direct = await g.roles.grantRole(stranger.accountKey, ['articles'], editorActor);
  eq(direct, { ok: false, code: 'roles-forbidden' }, 'grantRole itself accepted an editor');

  const res = await callRoles(g, {
    session: editor.session, action: 'grant', accountKey: stranger.accountKey, sections: ['articles'],
  });

  // D-5, TAKEN ON 2026-09-07: AN EDITOR GETS THE STRANGER'S OWN REFUSAL AND LEARNS NOTHING. The
  // comparison is made against a REAL STRANGER'S REAL REPLY to the identical request rather than
  // against two literals typed in here, so the day the two answers drift apart this case sees it
  // -- which is the only way "identical" can be measured rather than asserted.
  const strangerRes = await callRoles(g, {
    session: stranger.session, action: 'grant', accountKey: stranger.accountKey, sections: ['articles'],
  });
  eq([res.statusCode, res.body], [strangerRes.statusCode, strangerRes.body],
    'the editor and the stranger got different replies from the roles door');
  eq(res.statusCode, 401, 'the status an editor gets from the roles door');
  eq(res.body, { ok: false, error: 'roles-unauthenticated' }, 'the body an editor gets');
  const grant = await g.roles.grantedRole(stranger.accountKey);
  eq(grant, null, 'a grant was written by an editor');

  // ...and the stranger still cannot write, which is the consequence that matters.
  const write = await callAdmin(g, { session: stranger.session, action: 'create', section: 'articles', title: 'x', body: 'y' });
  is(write.statusCode !== 200, 'the stranger could write after an editor "granted" them');

  // The same call, made by the owner, succeeds -- so the refusal is about the role, not the shape.
  const { g: g2, owner: o2, stranger: s2 } = await seeded();
  const ok = await callRoles(g2, {
    session: o2.session, action: 'grant', accountKey: s2.accountKey, sections: ['articles'],
  });
  eq(ok.statusCode, 200, 'the same grant refused for the owner too -- the case proves nothing');
  return 'editor -> 401 (byte-identical to the stranger), owner -> 200 on the identical request';
});

run('an owner can grant and revoke, and a revoked editor loses write access on the very next request', async () => {
  const { g, owner, editor } = await seeded();
  const before = await callAdmin(g, { session: editor.session, action: 'create', section: 'articles', title: 'While granted', body: 'x' });
  eq(before.statusCode, 200, 'the granted editor could not write');

  const revoked = await callRoles(g, { session: owner.session, action: 'revoke', accountKey: editor.accountKey });
  eq(revoked.statusCode, 200, 'the revoke was refused');
  eq(await g.roles.grantedRole(editor.accountKey), null, 'the grant survived the revoke');

  const after = await callAdmin(g, { session: editor.session, action: 'create', section: 'articles', title: 'After revoke', body: 'x' });
  is(after.statusCode !== 200, 'the revoked editor could still write');
  eq(after.statusCode, 401, 'the revoked editor got something other than the unauthenticated refusal');

  // And nothing was cached: the same session, re-granted, works again immediately.
  await callRoles(g, { session: owner.session, action: 'grant', accountKey: editor.accountKey, sections: ['articles'] });
  const again = await callAdmin(g, { session: editor.session, action: 'create', section: 'articles', title: 'Re-granted', body: 'x' });
  eq(again.statusCode, 200, 'a re-granted editor was still refused');
  return 'grant 200 -> write 200 -> revoke 200 -> write ' + after.statusCode + ' -> re-grant -> write 200';
});

run('an owner may not revoke a root grant -- it does not live in the store', async () => {
  const { g, owner } = await seeded();
  const res = await callRoles(g, { session: owner.session, action: 'revoke', accountKey: owner.accountKey });
  is(res.statusCode !== 200, 'the owner revoked their own root grant');
  eq(res.body.error, 'roles-root-grant', 'the code the refusal carried');

  // ...and the owner still owns everything afterwards.
  const still = await g.roles.roleFor(owner.accountKey);
  eq(still.role, 'owner', 'the owner lost the root role');
  const write = await callRoles(g, { session: owner.session, action: 'grant', accountKey: owner.accountKey, sections: ['women'] });
  eq(write.statusCode, 200, 'the owner could not act after the refused revoke');
  return 'revoke -> ' + res.statusCode + ' ' + res.body.error + ', role still ' + still.role;
});

run('no route can mint an owner: `owner` is not grantable and is not read from the body', async () => {
  const { g, owner, stranger } = await seeded();
  eq(g.roles.GRANTABLE_ROLES.slice(), ['editor'], 'the grantable role list');
  const res = await callRoles(g, {
    session: owner.session, action: 'grant', accountKey: stranger.accountKey,
    sections: ['articles', 'women'], role: 'owner',
  });
  eq(res.statusCode, 200, 'the grant itself was refused');
  eq(res.body.grant.role, 'editor', 'a body field named a role and the store believed it');
  const resolved = await g.roles.roleFor(stranger.accountKey);
  eq(resolved.role, 'editor', 'the resolved role after a grant asking for owner');
  // ...and the stranger cannot then grant anything.
  const escalate = await callRoles(g, {
    session: stranger.session, action: 'grant', accountKey: stranger.accountKey, sections: ['articles'],
  });
  eq(escalate.statusCode, 401, 'the newly granted editor could grant');
  return 'asked for owner, got editor; the editor then got the stranger 401 from the roles door';
});

/* -- FAILING CLOSED --------------------------------------------------------- */

run('an absent EZIK_OWNER_ACCOUNTS means zero owners and a refused panel', async () => {
  const g = buildGraph({ env: { EZIK_OWNER_ACCOUNTS: undefined } });
  is(!('EZIK_OWNER_ACCOUNTS' in g.env), 'the row was not actually absent from the fixture env');
  eq(g.roles.ownerDigests(g.env).size, 0, 'digests parsed out of an absent row');

  const would = await g.signIn('google', FIXTURE.ownerSub, FIXTURE.ownerEmail, true);
  eq(await g.roles.isRootOwner(would.accountKey), false, 'an owner existed with no row');
  eq((await g.roles.roleFor(would.accountKey)).role, 'none', 'the role with no row');
  eq(await g.roles.resolveActor({ body: { session: would.session } }), null, 'an actor resolved with no row');

  const grant = await callRoles(g, {
    session: would.session, action: 'grant', accountKey: would.accountKey, sections: ['articles'],
  });
  eq(grant.statusCode, 401, 'the roles door with no row');
  const write = await callAdmin(g, { session: would.session, action: 'create', section: 'articles', title: 'x', body: 'y' });
  eq(write.statusCode, 401, 'the writing door with no row');

  // ...and a malformed row is the same as an absent one, rather than half a permission.
  for (const bad of ['', '   ', 'not-a-hash', 'ABCDEF', digestOf(FIXTURE.ownerEmail).slice(0, 63)]) {
    const g2 = buildGraph({ env: { EZIK_OWNER_ACCOUNTS: bad } });
    eq(g2.roles.ownerDigests(g2.env).size, 0, 'a malformed row produced digests: ' + JSON.stringify(bad));
  }
  return 'no row -> 0 digests, isRootOwner=false, roleFor=none, both doors 401; 5 malformed rows -> 0 digests';
});

run('an unverified address never becomes an owner, even when its digest is in the row', async () => {
  const g = buildGraph({ env: { EZIK_OWNER_ACCOUNTS: digestOf(FIXTURE.ownerEmail) } });
  const unverified = await g.signIn('apple', FIXTURE.ownerSub, FIXTURE.ownerEmail, false);
  eq(await g.roles.isRootOwner(unverified.accountKey), false, 'an unproved address bought owner');
  eq(await g.roles.resolveActor({ body: { session: unverified.session } }), null, 'an actor resolved on an unproved address');

  // The same address, PROVED, is an owner -- so the refusal is about the proof, not the digest.
  const g2 = buildGraph({ env: { EZIK_OWNER_ACCOUNTS: digestOf(FIXTURE.ownerEmail) } });
  const verified = await g2.signIn('apple', FIXTURE.ownerSub, FIXTURE.ownerEmail, true);
  eq(await g2.roles.isRootOwner(verified.accountKey), true, 'a proved address in the row is not an owner');
  return 'emailVerified=false -> not owner; the identical record with emailVerified=true -> owner';
});

run('a store error resolves to no access, never to access', async () => {
  // First, with a working store, capture what access looks like.
  const { g, editor, owner } = await seeded();
  const okWrite = await callAdmin(g, { session: editor.session, action: 'create', section: 'articles', title: 'Works', body: 'x' });
  eq(okWrite.statusCode, 200, 'the control case did not have access');

  // Now the same sessions against a store that refuses every read.
  for (const cmd of ['get', 'set']) {
    const broken = buildGraph({
      env: { EZIK_OWNER_ACCOUNTS: digestOf(FIXTURE.ownerEmail) },
      storeThrowsOn: [cmd],
    });
    eq(await broken.roles.resolveActor({ body: { session: 'any-session-at-all' } }), null,
      'an actor resolved against a store refusing ' + cmd.toUpperCase());
    eq(await broken.roles.isRootOwner('acct:v1:google:' + FIXTURE.ownerSub), false,
      'an owner resolved against a store refusing ' + cmd.toUpperCase());
    eq((await broken.roles.roleFor('acct:v1:google:' + FIXTURE.ownerSub)).role, 'none',
      'a role resolved against a store refusing ' + cmd.toUpperCase());

    const write = await callAdmin(broken, {
      session: 'any-session-at-all', action: 'create', section: 'articles', title: 'x', body: 'y',
    });
    eq(write.statusCode, 401, 'the writing door against a store refusing ' + cmd.toUpperCase());
    const grant = await callRoles(broken, {
      session: 'any-session-at-all', action: 'grant', accountKey: owner.accountKey, sections: ['articles'],
    });
    eq(grant.statusCode, 401, 'the roles door against a store refusing ' + cmd.toUpperCase());
  }

  // And the reader's door refuses rather than printing an empty section as if it were empty.
  const readBroken = buildGraph({ storeThrowsOn: ['zrange'] });
  const list = await callList(readBroken, { section: 'articles' });
  eq(list.statusCode, 503, 'an unreadable index answered as an empty section');
  return 'GET-refusing and SET-refusing stores -> 401 on both writing doors; ZRANGE-refusing -> 503, not an empty list';
});

/* -- THE EDITOR ROSTER: THE SECOND RUNG ------------------------------------- */
/**
 * WHY THIS ROW EXISTS AT ALL, because a case list is not a reason. A stored grant is written
 * against `acct:v1:<provider>:<sub>`, and NOTHING IN THIS SYSTEM EVER SHOWS THAT STRING TO ANY
 * HUMAN. The owner therefore could not authorise anybody to write beside him: he could not learn
 * their account key, and neither could they. EZIK_EDITOR_ACCOUNTS is the same mechanism as the
 * owner row one rung lower -- a digest he can compute from an address he already knows.
 *
 * Every case below is built on rowEditorScene(), which writes NO store grant, so nothing here can
 * pass on the strength of the grant path that already existed.
 */

run('an ABSENT EZIK_EDITOR_ACCOUNTS means zero editors, and the row is not created by this code', async () => {
  const { g, editor } = await rowEditorScene({ editorRow: null });
  is(!('EZIK_EDITOR_ACCOUNTS' in g.env), 'the row was not actually absent from the fixture env');
  eq(g.roles.editorDigests(g.env).size, 0, 'digests parsed out of an absent row');

  eq(await g.roles.isRootEditor(editor.accountKey), false, 'an editor existed with no row');
  eq((await g.roles.roleFor(editor.accountKey)).role, 'none', 'the role with no row');
  eq(await g.roles.resolveActor({ body: { session: editor.session } }), null, 'an actor resolved with no row');

  const write = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'x', body: 'y',
  });
  eq(write.statusCode, 401, 'the writing door with no editor row');

  // ...and NOTHING IN THE TREE CREATES THE ROW. It is configuration, and the owner adds it by
  // hand on the board; a default written anywhere in the source would be a roster nobody chose.
  const offenders = [];
  for (const rel of MODULES) {
    const src2 = SOURCES[rel];
    if (/EZIK_EDITOR_ACCOUNTS\s*=\s*['"`]/.test(src2)) offenders.push(rel + ' assigns the row a value');
    if (/process\.env\.EZIK_EDITOR_ACCOUNTS\s*=/.test(src2)) offenders.push(rel + ' writes the row');
  }
  eq(offenders, [], 'a module sets the editor row itself');
  return 'no row -> 0 digests, isRootEditor=false, roleFor=none, the writing door 401, and no module writes the row';
});

run('an EMPTY editor row is read as zero editors, never as everybody', async () => {
  // The dangerous reading of an empty row is "no restriction", which is how a fail-open is
  // usually written by accident. Four shapes of empty, and each must be zero people.
  for (const empty of ['', '   ', ',', ',,,', ' , , ']) {
    const { g, editor, stranger } = await rowEditorScene({ editorRow: empty });
    eq(g.roles.editorDigests(g.env).size, 0, 'digests parsed out of ' + JSON.stringify(empty));
    eq(await g.roles.isRootEditor(editor.accountKey), false, 'an empty row made an editor: ' + JSON.stringify(empty));
    eq(await g.roles.isRootEditor(stranger.accountKey), false, 'an empty row made a stranger an editor');
    const write = await callAdmin(g, {
      session: editor.session, action: 'create', section: 'articles', title: 'x', body: 'y',
    });
    eq(write.statusCode, 401, 'the writing door with the empty row ' + JSON.stringify(empty));
  }
  return '5 shapes of empty row -> 0 digests, 0 editors, the writing door 401 on every one';
});

run('a digest in the editor row resolves to role editor, in BOTH sections, with no store grant', async () => {
  const { g, editor } = await rowEditorScene();
  eq(g.roles.editorDigests(g.env).size, 1, 'the digests parsed out of a one-entry row');
  eq(await g.roles.isRootEditor(editor.accountKey), true, 'the digest on the row is not an editor');
  eq(await g.roles.isRootOwner(editor.accountKey), false, 'the editor row bought owner');

  const resolved = await g.roles.roleFor(editor.accountKey);
  eq(resolved.role, 'editor', 'the role a row digest resolves to');
  eq(resolved.sections.slice().sort(), g.articles.SECTIONS.slice().sort(), 'the sections a row editor holds');

  const actor = await g.roles.resolveActor({ body: { session: editor.session } });
  is(actor !== null, 'a row editor did not resolve to an actor');
  eq(actor.role, 'editor', 'the actor role for a row editor');
  eq(actor.accountKey, editor.accountKey, 'the actor account key');

  // The grant path was not used and still holds nothing -- so this is the ROW answering.
  eq(await g.roles.grantedRole(editor.accountKey), null, 'a store grant appeared from nowhere');
  // ...and a person NOT on the row is still nobody, so the row is not simply admitting everyone.
  const { g: g2, stranger } = await rowEditorScene();
  eq((await g2.roles.roleFor(stranger.accountKey)).role, 'none', 'somebody not on the row got a role');
  return 'row digest -> editor over [' + resolved.sections.join(',') + '], store grant still null; off-row -> none';
});

run('a digest in BOTH rows is an OWNER, not an editor -- the environment order is owner first', async () => {
  const { g, owner } = await rowEditorScene({ editorRow: digestOf(FIXTURE.ownerEmail) });
  eq(g.roles.ownerDigests(g.env).size, 1, 'the owner row');
  eq(g.roles.editorDigests(g.env).size, 1, 'the editor row');
  eq(await g.roles.isRootOwner(owner.accountKey), true, 'the shared digest is not an owner');
  eq(await g.roles.isRootEditor(owner.accountKey), true, 'the shared digest is not on the editor row');

  // Both rows say yes. THE RESOLVED ROLE IS OWNER, and it is asserted through the door that can
  // tell the two apart: the roles surface answers an owner and refuses an editor.
  const resolved = await g.roles.roleFor(owner.accountKey);
  eq(resolved.role, 'owner', 'a digest in both rows resolved to something other than owner');
  const { g: g3, owner: o3, stranger: s3 } = await rowEditorScene({ editorRow: digestOf(FIXTURE.ownerEmail) });
  const door = await callRoles(g3, {
    session: o3.session, action: 'grant', accountKey: s3.accountKey, sections: ['articles'],
  });
  eq(door.statusCode, 200, 'the person in both rows was refused by the roles door, so they are not an owner');
  return 'in both rows -> role ' + resolved.role + ', roles door 200 -- owner wins over editor';
});

run('an UNVERIFIED address is nobody, even with its digest sitting in the editor row', async () => {
  const { g, editor } = await rowEditorScene({ verified: false });
  eq(g.roles.editorDigests(g.env).size, 1, 'the row the unproved account is listed in');
  eq(await g.roles.isRootEditor(editor.accountKey), false, 'an unproved address bought editor');
  eq((await g.roles.roleFor(editor.accountKey)).role, 'none', 'the role of an unproved address on the row');
  eq(await g.roles.resolveActor({ body: { session: editor.session } }), null, 'an actor resolved on an unproved address');
  const write = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'x', body: 'y',
  });
  eq(write.statusCode, 401, 'the writing door for an unproved address on the row');

  // THE IDENTICAL RECORD, PROVED, IS AN EDITOR -- so the refusal is about the proof and not the
  // digest, the row, or anything else that happens to differ between two fixtures.
  const { g: g2, editor: e2 } = await rowEditorScene();
  eq(await g2.roles.isRootEditor(e2.accountKey), true, 'a proved address on the row is not an editor');
  return 'emailVerified=false -> none; the identical record with emailVerified=true -> editor';
});

run('an editor is refused by the roles door with the SAME status and the SAME body a stranger gets', async () => {
  const { g, editor, stranger } = await rowEditorScene();

  // Three callers, one request shape, and the two that are not owners must be indistinguishable:
  // a ROW editor, a stranger holding a live session and no role, and a caller with no session at
  // all. If any of the three replies differs from the others, this door has just told somebody
  // which rank they hold -- which is what D-5 forbids.
  const shape = (session) => ({ session, action: 'grant', accountKey: stranger.accountKey, sections: ['articles'] });
  const asEditor = await callRoles(g, shape(editor.session));
  const asStranger = await callRoles(g, shape(stranger.session));
  const asNobody = await callRoles(g, shape('no-such-session-at-all'));

  eq([asEditor.statusCode, asEditor.body], [asStranger.statusCode, asStranger.body],
    'the editor and the stranger got different replies');
  eq([asEditor.statusCode, asEditor.body], [asNobody.statusCode, asNobody.body],
    'the editor and an unauthenticated caller got different replies');
  eq(asEditor.statusCode, 401, 'the status the roles door gives a non-owner');
  eq(asEditor.body, { ok: false, error: 'roles-unauthenticated' }, 'the body the roles door gives a non-owner');

  // AND THE REPLY MUST NOT NAME THE SURFACE. Nothing in it may say editor, owner, role, forbidden
  // or permission -- an error string is a sentence, and a sentence about ranks is a map of them.
  const text = JSON.stringify(asEditor.body).toLowerCase();
  for (const word of ['editor', 'owner', 'forbidden', 'permission', 'grant', 'admin']) {
    is(text.indexOf(word) === -1, 'the refusal named "' + word + '" to a non-owner');
  }

  // ...and it refused for real: nothing was granted and nothing was revoked.
  eq(await g.roles.grantedRole(stranger.accountKey), null, 'an editor granted a role through the door');
  const revoke = await callRoles(g, { session: editor.session, action: 'revoke', accountKey: editor.accountKey });
  eq([revoke.statusCode, revoke.body], [asStranger.statusCode, asStranger.body],
    'the editor got a different reply from revoke than a stranger gets from grant');

  // The SAME door, for the owner, answers 200 -- so the refusal is about the role and not the shape.
  const { g: g2, owner: o2, stranger: s2 } = await rowEditorScene();
  const asOwner = await callRoles(g2, {
    session: o2.session, action: 'grant', accountKey: s2.accountKey, sections: ['articles'],
  });
  eq(asOwner.statusCode, 200, 'the owner was refused too, so the case proves nothing');
  return 'editor / stranger / no-session all -> ' + asEditor.statusCode + ' '
    + JSON.stringify(asEditor.body) + '; owner -> 200';
});

run('a ROW editor can create, update, publish, unpublish and delete, in both sections', async () => {
  const { g, editor } = await rowEditorScene();
  const done = [];

  for (const section of g.articles.SECTIONS) {
    const created = await callAdmin(g, {
      session: editor.session, action: 'create', section, title: 'A row editor wrote this', body: 'b',
    });
    eq(created.statusCode, 200, 'a row editor could not create in ' + section);
    const id = created.body.article.id;

    const updated = await callAdmin(g, {
      session: editor.session, action: 'update', id, patch: { title: 'And then corrected it' },
    });
    eq(updated.statusCode, 200, 'a row editor could not update in ' + section);

    const published = await callAdmin(g, { session: editor.session, action: 'publish', id });
    eq(published.statusCode, 200, 'a row editor could not publish in ' + section);

    // ...and it really is public afterwards, which is the point of publishing.
    const seen = await callGet(g, { slug: created.body.article.slug });
    eq(seen.statusCode, 200, 'the published article was not reachable in ' + section);

    const unpublished = await callAdmin(g, { session: editor.session, action: 'unpublish', id });
    eq(unpublished.statusCode, 200, 'a row editor could not unpublish in ' + section);
    const gone = await callGet(g, { slug: created.body.article.slug });
    eq(gone.statusCode, 404, 'the unpublished article was still reachable in ' + section);

    const deleted = await callAdmin(g, { session: editor.session, action: 'delete', id });
    eq(deleted.statusCode, 200, 'a row editor could not delete in ' + section);
    eq(await g.articles.getArticleById(id), null, 'the deleted article survived in ' + section);
    done.push(section);
  }

  // AND THE FIVE VERBS ARE THE WHOLE VOCABULARY -- a row editor holds no sixth one, and in
  // particular holds nothing on the roles surface. That is asserted in its own case above.
  eq(done, g.articles.SECTIONS.slice(), 'the sections a row editor got through');
  return 'create/update/publish/unpublish/delete all 200 in ' + done.join(' and ')
    + '; published -> 200 public, unpublished -> 404 public';
});

run('taking a digest OFF the editor row ends the access on the very next request, in one process', async () => {
  const { g, editor } = await rowEditorScene();
  const before = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'While on the row', body: 'x',
  });
  eq(before.statusCode, 200, 'the row editor could not write while on the row');

  // THE ROW IS EMPTIED IN PLACE. Same process, same module instances, same session, nothing
  // reloaded and nothing re-minted -- which is the entire claim being measured: the roster is
  // consulted on every request and no resolved role is remembered anywhere between two of them.
  delete g.env.EZIK_EDITOR_ACCOUNTS;

  const after = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'After the row', body: 'x',
  });
  eq(after.statusCode, 401, 'the removed editor still had access on the next request');
  eq(await g.roles.isRootEditor(editor.accountKey), false, 'isRootEditor still true after the row was emptied');
  eq((await g.roles.roleFor(editor.accountKey)).role, 'none', 'the role after the row was emptied');
  eq(await g.roles.resolveActor({ body: { session: editor.session } }), null, 'an actor survived the row edit');

  // ...and the article they wrote while granted is still there and still theirs, because a
  // revocation removes a right and not a person's work.
  const kept = await g.articles.getArticleById(before.body.article.id);
  is(kept !== null, 'the revoked editor\'s article was destroyed with their access');
  eq(kept.authorKey, editor.accountKey, 'the stored record stopped naming its author');

  // Putting the digest back works immediately too, so nothing broke permanently on the first edit.
  g.env.EZIK_EDITOR_ACCOUNTS = digestOf(FIXTURE.editorEmail);
  const again = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'Back on the row', body: 'x',
  });
  eq(again.statusCode, 200, 'a re-added editor was still refused');
  return 'on the row -> 200, row removed -> ' + after.statusCode + ', row restored -> 200, one process throughout';
});

run('a MALFORMED editor row grants nobody anything, and upper case is the same digest rather than a new one', async () => {
  const good = digestOf(FIXTURE.editorEmail);

  // Every element here is junk of one kind or another, INCLUDING a real digest with one character
  // missing and one with a character too many. None of them may become a permission.
  const junk = [
    'not-a-hash',
    'ABCDEF',
    good.slice(0, 63),
    good + 'a',
    good.replace(/^../, 'zz'),
    ' ',
    '',
  ];
  for (const bad of junk) {
    const { g, editor } = await rowEditorScene({ editorRow: bad });
    eq(g.roles.editorDigests(g.env).size, 0, 'a malformed row produced digests: ' + JSON.stringify(bad));
    eq(await g.roles.isRootEditor(editor.accountKey), false, 'a malformed row made an editor: ' + JSON.stringify(bad));
  }

  // A ROW MADE ENTIRELY OF JUNK, with the stray spaces and the empty element between two commas
  // that a hand-typed row actually contains, is still zero people.
  const messy = ' , not-a-hash ,, ABCDEF , ' + good.slice(0, 63) + ' ,';
  const { g: gm, editor: em, stranger: sm } = await rowEditorScene({ editorRow: messy });
  eq(gm.roles.editorDigests(gm.env).size, 0, 'the messy row produced digests');
  eq((await gm.roles.roleFor(em.accountKey)).role, 'none', 'the messy row granted the editor');
  eq((await gm.roles.roleFor(sm.accountKey)).role, 'none', 'the messy row granted a stranger');

  // ...AND ONE GOOD DIGEST SURVIVES ITS NEIGHBOURS. A row is not all-or-nothing: the junk is
  // dropped element by element, so a typo beside a correct entry does not silently cancel it.
  const { g: gs, editor: es, stranger: ss } = await rowEditorScene({ editorRow: messy + ' ' + good + ' ,' });
  eq(gs.roles.editorDigests(gs.env).size, 1, 'the good digest did not survive its junk neighbours');
  eq((await gs.roles.roleFor(es.accountKey)).role, 'editor', 'the good digest in a messy row did not grant');
  eq((await gs.roles.roleFor(ss.accountKey)).role, 'none', 'the messy row granted somebody it does not name');

  // UPPER CASE IS A NORMALISATION, NOT A WIDENING, AND IT IS MEASURED RATHER THAN ASSUMED. A
  // digest pasted in upper case is THE SAME PERSON's digest -- emailDigest() emits lower case, so
  // folding can only ever match the value it already produced. It admits nobody new: the case
  // above proves a stranger is still refused by a row that does not name them.
  const { g: gu, editor: eu, stranger: su } = await rowEditorScene({ editorRow: good.toUpperCase() });
  eq(gu.roles.editorDigests(gu.env).size, 1, 'an upper-case digest was dropped');
  eq([...gu.roles.editorDigests(gu.env)][0], good, 'an upper-case digest parsed to something other than itself');
  eq((await gu.roles.roleFor(eu.accountKey)).role, 'editor', 'an upper-case digest did not grant its own person');
  eq((await gu.roles.roleFor(su.accountKey)).role, 'none', 'an upper-case digest granted somebody else');

  return junk.length + ' junk elements -> 0 digests each; a messy row -> 0; the same row plus one '
    + 'good digest -> exactly 1; upper case -> the identical lower-case digest and nobody new';
});

run('ONE parser and ONE hash serve both rows -- there is no second copy to drift', async () => {
  const g0 = buildGraph({});
  const src2 = SOURCES['lib/articles/roles.js'];
  const code = codeOf(src2);

  // The hash is IMPORTED, never re-typed. A second sha256 that trimmed or case-folded differently
  // would make a grant fail with nothing at all on any screen to say why.
  is(/import\s*\{[\s\S]*?emailDigest[\s\S]*?\}\s*from\s*'\.\.\/auth\/account\.js'/.test(code),
    'roles.js no longer imports emailDigest from the account module');
  is(code.indexOf('createHash') === -1, 'roles.js grew its own hash function');
  is(code.indexOf("require('node:crypto')") === -1 && code.indexOf("from 'node:crypto'") === -1,
    'roles.js reached for crypto directly');

  // The 64-hex test appears exactly ONCE, so both rows are parsed by the same line.
  const hexTests = (code.match(/\[0-9a-f\]\{64\}/g) || []).length;
  eq(hexTests, 1, 'the 64-hex row test is written more than once');

  // And the verified-address rule appears exactly once, for the same reason.
  const verifiedTests = (code.match(/emailVerified\s*!==\s*true/g) || []).length;
  eq(verifiedTests, 1, 'the verified-address rule is written more than once');

  // The two row names are declared, and NEITHER is given a value anywhere in the tree.
  eq(g0.roles.OWNER_ACCOUNTS_ENV, 'EZIK_OWNER_ACCOUNTS', 'the owner row name');
  eq(g0.roles.EDITOR_ACCOUNTS_ENV, 'EZIK_EDITOR_ACCOUNTS', 'the editor row name');
  return '1 hex test, 1 verified test, emailDigest imported, both row names declared and neither set';
});

/* -- THE STORE'S OWN CONTRACTS ---------------------------------------------- */

run('slug uniqueness holds when two articles share a title', async () => {
  const { g, editor } = await seeded();
  const title = 'The very same title';
  const a = await createAs(g, editor.session, 'articles', title);
  const b = await createAs(g, editor.session, 'articles', title);
  const c = await createAs(g, editor.session, 'articles', title);

  is(a.slug !== b.slug && b.slug !== c.slug && a.slug !== c.slug, 'two articles took the same slug');
  eq(new Set([a.slug, b.slug, c.slug]).size, 3, 'three titles produced fewer than three slugs');

  // Each slug still resolves to its OWN article -- the real damage a collision does.
  for (const made of [a, b, c]) {
    await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
    const res = await callGet(g, { slug: made.slug });
    eq(res.statusCode, 200, 'a slug stopped resolving: ' + made.slug);
    eq(res.body.article.slug, made.slug, 'a slug resolved to a different article');
  }
  // And an Arabic title keeps its own letters rather than collapsing to nothing.
  const arabic = await createAs(g, editor.session, 'articles', 'مقالة أولى');
  is(arabic.slug.length > 0 && arabic.slug.indexOf(' ') === -1, 'an Arabic title produced an unusable slug');
  return [a.slug, b.slug, c.slug].join(' / ') + '   arabic -> ' + arabic.slug;
});

run('a title that slugifies to nothing gets a claimable slug FOR EVERY SHAPE OF ID, the two safeSlug refuses first included', async () => {
  // THE IDS ARE NAMED HERE RATHER THAN DRAWN, AND THAT IS THE WHOLE POINT OF THIS CASE.
  //
  // A title made only of punctuation slugifies to nothing and falls back to the article id. That
  // id is base64url, whose alphabet ends in '-' and '_', and safeSlug() takes neither as a FIRST
  // character -- while the retry loop only ever appends '-2', '-3', so it can never change a
  // first character. An id of that shape therefore used to refuse the article outright, fifty
  // attempts deep, with `articles-slug-unavailable`: a refusal caused by the shape of an id THIS
  // CODE minted, which no writer could have typed their way around. Found and fixed 2026-09-07.
  //
  // This case used to wait for that shape to turn up by chance among twenty draws -- a 47% coin
  // flip -- so the gate that owned the defect was red half the time and green the other half, and
  // neither answer meant anything. All three shapes are demanded by name now.
  const SAFE_ID = 'ZmFsbGJhY2sxMjM0';
  const HYPHEN_ID = '-allbackTWO12345';
  const UNDER_ID = '_allbackTHREE123';
  const forced = [SAFE_ID, HYPHEN_ID, UNDER_ID];
  const { g, editor } = await seeded({ graph: { articleIds: forced } });

  const made = [];
  for (const wanted of forced) {
    const article = await createAs(g, editor.session, 'articles', '؟؟؟ ... !!! ---');
    eq(article.id, wanted, 'the forced id did not reach newArticleId');
    is(article.slug.length > 0, 'a punctuation-only title produced an empty slug');
    // The fallback is the id itself when the id may be a slug, and the id behind one ASCII letter
    // when it may not. Both branches are asserted, so neither can quietly become the other.
    eq(article.slug, wanted === SAFE_ID ? wanted : 'a' + wanted, 'the fallback slug for ' + wanted);
    is(article.slug.indexOf(wanted) !== -1, 'the fallback slug no longer carries the id');
    await callAdmin(g, { session: editor.session, action: 'publish', id: article.id });
    const res = await callGet(g, { slug: article.slug });
    eq(res.statusCode, 200, 'a fallback slug did not resolve: ' + article.slug);
    eq(res.body.article.slug, article.slug, 'a fallback slug resolved to a different article');
    made.push(article.slug);
  }
  eq(new Set(made).size, made.length, 'two fallback slugs collided');
  eq(g.forcedIdsLeft(), 0, 'a forced id was never drawn, so one of the shapes above went untested');
  // ...and an id drawn the ordinary way, now the queue is empty, still gets a slug of its own.
  const ordinary = await createAs(g, editor.session, 'articles', '؟؟؟ ... !!! ---');
  is(made.indexOf(ordinary.slug) === -1, 'the fourth article took a slug already claimed');
  return '3 named id shapes + 1 drawn, all claimable: ' + made.join(' / ') + ' / ' + ordinary.slug;
});

/**
 * ARABIC IS WRITTEN HERE AS ESCAPED CODE POINTS, AND THAT IS NOT FUSSINESS.
 *
 * The four cases below turn on characters that are INVISIBLE beside the letter they sit on -- a
 * fatha, a sukun, a tatweel. A raw literal carrying one can lose it to an editor, a paste, a
 * normalising tool or a file round trip, and the case would go on looking exactly right while
 * testing a different string from the one it names. Spelled in hex, what is under test is on the
 * page, and a dropped mark is a syntax-visible change rather than a silent one.
 */
const CP = (hex) => hex.trim().split(/\s+/).map((h) => String.fromCodePoint(parseInt(h, 16))).join('');
const HEX = (s) => [...s].map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

/** The D-4 title -- "patience is beautiful", vowelled the way this app's two writers vowel a heading. */
const VOWELLED = CP('0627 0644 0635 0651 064E 0628 0652 0631 064F 0020 062C 064E 0645 0650 064A 0644 064C');
/** The same two words with no marks at all. */
const BARE = CP('0627 0644 0635 0628 0631 0020 062C 0645 064A 0644');
/** What both must now slug to: two words, one hyphen. */
const TWO_WORDS = CP('0627 0644 0635 0628 0631') + '-' + CP('062C 0645 064A 0644');
/** What the vowelled title used to slug to, until 2026-09-07: six fragments of two words. */
const SIX_FRAGMENTS = CP('0627 0644 0635') + '-' + CP('0628') + '-' + CP('0631') + '-'
  + CP('062C') + '-' + CP('0645') + '-' + CP('064A 0644');

run('a harakah is decoration on a letter, not a boundary between two -- a vowelled title slugs to WHOLE WORDS', async () => {
  // THE DEFECT THIS CASE OWNS. A harakah is Unicode category Mn, which is not a letter, so
  // slugify()'s "anything that is not a letter or a digit becomes a hyphen" rule used to cut a
  // vowelled word apart IN THE MIDDLE OF ITSELF. Two words came out as six fragments, and the
  // URL of every article this app's owner and his wife are about to write would have carried it.
  const { g, editor } = await seeded();

  eq(g.articles.slugify(VOWELLED), TWO_WORDS, 'the vowelled title did not slug to two whole words');
  is(g.articles.slugify(VOWELLED) !== SIX_FRAGMENTS, 'the vowelled title still shatters into six fragments');
  eq(g.articles.slugify(VOWELLED).split('-').length, 2, 'the vowelled slug is not two hyphen-separated pieces');

  // The mark is REMOVED, not separated: the vowelled title and its bare twin reach the same root.
  eq(g.articles.slugify(VOWELLED), g.articles.slugify(BARE), 'the vowelled title and the bare title took different roots');

  // And it survives the whole path, not just the function: create, publish, read back by URL.
  const made = await createAs(g, editor.session, 'articles', VOWELLED);
  eq(made.slug, TWO_WORDS, 'the stored slug is not the two-word slug');
  eq(made.title, VOWELLED, 'the stored TITLE lost its marks -- only the slug may drop them');
  await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
  const res = await callGet(g, { slug: made.slug });
  eq(res.statusCode, 200, 'the two-word slug did not resolve');
  eq(res.body.article.slug, TWO_WORDS, 'the slug resolved to a different article');
  eq(res.body.article.title, VOWELLED, 'the served title lost its marks');
  return 'U+' + HEX(VOWELLED) + '  ->  U+' + HEX(made.slug) + '  (was U+' + HEX(SIX_FRAGMENTS) + ')';
});

/** A stretched word: three tatweels inside "sabr". */
const STRETCHED = CP('0627 0644 0635 0640 0640 0640 0628 0631');
/** The same word as anyone would type it, and what BOTH must now slug to. */
const UNSTRETCHED = CP('0627 0644 0635 0628 0631');

run('U+0640 tatweel is DECORATION and is stripped -- a stretched word and its bare twin mint ONE root', async () => {
  // THIS CASE ASSERTED THE OPPOSITE UNTIL 2026-09-07, AND THAT IS THE POINT OF IT.
  //
  // The harakat fix removed combining marks and deliberately LEFT the tatweel, because the rule
  // it was applying was "remove what SHATTERS a word" and a tatweel shatters nothing: it is
  // category Lm, the letter class has always accepted it, and it has never produced a hyphen.
  // That measurement still holds and is re-asserted below -- the tatweel is not being removed
  // because it broke anything.
  //
  // It is removed because the RULE CHANGED, by the owner's decision, to "remove what is
  // DECORATION". A writer stretches a word to fill a line; the reader sees one word either way.
  // Left in, the two spellings below minted two different permanent URLs for one word.
  const { g, editor } = await seeded();

  // The measurement that decided the old behaviour, still true -- so this is a decision that was
  // taken, not a category that moved under it.
  is(/\p{L}/u.test(CP('0640')), 'U+0640 stopped being a letter');
  is(/\p{Lm}/u.test(CP('0640')), 'U+0640 stopped being a modifier letter');
  is(!/\p{Mn}/u.test(CP('0640')), 'U+0640 became Mn, so the harakat stripper would have taken it anyway');

  eq(g.articles.slugify(STRETCHED), UNSTRETCHED, 'the tatweel survived into the slug');
  eq(g.articles.slugify(STRETCHED).indexOf(CP('0640')), -1, 'a tatweel is still in the slug');
  eq(g.articles.slugify(STRETCHED).indexOf('-'), -1, 'the tatweel produced a hyphen -- it must be DELETED, not separated');
  eq(g.articles.slugify(STRETCHED).split('-').length, 1, 'the stretched word is no longer one piece');
  eq(g.articles.slugify(STRETCHED), g.articles.slugify(UNSTRETCHED),
    'the stretched title and the bare title still take different roots -- two URLs for one word');

  // A tatweel at the edges of a word, and a run of them, reach the same root.
  for (const shape of [CP('0640') + UNSTRETCHED, UNSTRETCHED + CP('0640'),
                       CP('0640 0640') + UNSTRETCHED + CP('0640 0640')]) {
    eq(g.articles.slugify(shape), UNSTRETCHED, 'a tatweel at a word edge did not vanish: U+' + HEX(shape));
  }

  // And it survives the whole path: create, publish, read back by URL -- with the TITLE intact.
  const made = await createAs(g, editor.session, 'articles', STRETCHED);
  eq(made.slug, UNSTRETCHED, 'the stored slug kept the tatweel');
  eq(made.title, STRETCHED, 'the stored TITLE lost its tatweels -- only the slug may drop them');
  await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
  const res = await callGet(g, { slug: made.slug });
  eq(res.statusCode, 200, 'the unstretched slug did not resolve');
  eq(res.body.article.slug, UNSTRETCHED, 'the slug resolved to a different article');
  eq(res.body.article.title, STRETCHED, 'the served title lost its tatweels');
  return 'U+' + HEX(STRETCHED) + '  ->  U+' + HEX(made.slug) + '  (tatweel deleted, one piece)';
});

run('a stretched title and its unstretched twin collide, and the collision is absorbed by the -2 path', async () => {
  // THE COST OF THE TATWEEL FIX, PAID DELIBERATELY, AND THE SAME COST THE HARAKAT FIX PAID: two
  // spellings that used to want two URLs now want one. That is not a new failure mode -- it is
  // the ordinary same-title collision claimSlug() has always handled NX -- and this case proves
  // the second article reaches the -2 sibling rather than an error, and that each of the two
  // opens ITS OWN writing.
  const { g, editor } = await seeded();

  const a = await createAs(g, editor.session, 'articles', STRETCHED, 'stretched');
  const b = await createAs(g, editor.session, 'articles', UNSTRETCHED, 'bare');

  eq(a.slug, UNSTRETCHED, 'the stretched title did not take the bare root');
  eq(b.slug, UNSTRETCHED + '-2', 'the bare twin did not take the -2 sibling');
  eq(new Set([a.slug, b.slug]).size, 2, 'two titles produced fewer than two slugs');
  eq(new Set([a.id, b.id]).size, 2, 'two creates produced fewer than two articles');

  for (const made of [a, b]) {
    await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
    const res = await callGet(g, { slug: made.slug });
    eq(res.statusCode, 200, 'a sibling slug did not resolve: ' + HEX(made.slug));
    eq(res.body.article.slug, made.slug, 'a sibling slug resolved to a different slug');
    eq(res.body.article.body, made.body, 'a sibling slug resolved to a different article');
    eq(res.body.article.title, made.title, 'a sibling slug resolved to a different title');
  }
  eq([a.body, b.body], ['stretched', 'bare'], 'the two articles are not two distinct pieces of writing');
  return 'U+' + HEX(a.slug) + ' / +"-2", each resolving to its own article';
});

run('a tatweel BETWEEN two words still yields two words -- the hyphen comes from the SPACE', async () => {
  // The harakat report measured that the hyphen in a two-word title comes from the SPACE and
  // never from the tatweel. Deleting the tatweel must not change that, in either direction: the
  // two words must stay two, and a tatweel with no space beside it must still fuse nothing.
  const { g, editor } = await seeded();
  const JAMIL = CP('062C 0645 064A 0644');
  const BOTH_WORDS = UNSTRETCHED + '-' + JAMIL;

  const shapes = [
    ['a tatweel then the space', UNSTRETCHED + CP('0640') + ' ' + JAMIL],
    ['the space then a tatweel', UNSTRETCHED + ' ' + CP('0640') + JAMIL],
    ['a tatweel on both sides',  UNSTRETCHED + CP('0640') + ' ' + CP('0640') + JAMIL],
    ['a tatweel ALONE between',  UNSTRETCHED + ' ' + CP('0640') + ' ' + JAMIL],
    ['a run of five between',    UNSTRETCHED + ' ' + CP('0640 0640 0640 0640 0640') + ' ' + JAMIL],
  ];
  for (const [label, title] of shapes) {
    eq(g.articles.slugify(title), BOTH_WORDS, 'not two words: ' + label);
    eq(g.articles.slugify(title).split('-').length, 2, 'not two hyphen-separated pieces: ' + label);
  }

  // THE CONTROL THAT PROVES IT IS THE SPACE. Take the space away and leave the tatweel: the two
  // words fuse into ONE piece. A tatweel has never been a boundary and is not one now -- it is
  // simply gone.
  const NO_SPACE = UNSTRETCHED + CP('0640') + JAMIL;
  eq(g.articles.slugify(NO_SPACE), UNSTRETCHED + JAMIL, 'the tatweel between two words acted as a boundary');
  eq(g.articles.slugify(NO_SPACE).split('-').length, 1, 'a tatweel with no space beside it produced a hyphen');
  // ...and the plain two-word title, with no tatweel anywhere, is the same two words.
  eq(g.articles.slugify(UNSTRETCHED + ' ' + JAMIL), BOTH_WORDS, 'the plain two-word title moved');

  const made = await createAs(g, editor.session, 'articles', shapes[0][1]);
  eq(made.slug, BOTH_WORDS, 'the stored slug for a tatweelled two-word title');
  await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
  eq((await callGet(g, { slug: made.slug })).statusCode, 200, 'the two-word slug did not resolve');
  return 'U+' + HEX(shapes[3][1]) + '  ->  U+' + HEX(made.slug) + '  (2 pieces; without the space, 1)';
});

run('a title made ENTIRELY of tatweels empties, falls back to the id, and still creates', async () => {
  // THE ONE SHAPE THIS FIX CAN NEWLY EMPTY. Before it, a row of tatweels was a row of letters and
  // slugged to itself; after it there is nothing left, and slugify() returns ''. That path is
  // exactly the one the 2026-09-07 fallback fix built for punctuation-only titles, so this case
  // drives it with the SAME three id shapes that case names -- one safeSlug() takes as given, one
  // beginning '-', one beginning '_' -- because an all-tatweel title must not be refused for the
  // shape of an id it was handed.
  const SAFE_ID = 'VGF0d2VlbDEyMzQ1';
  const HYPHEN_ID = '-atweelTWO123456';
  const UNDER_ID = '_atweelTHREE1234';
  const forced = [SAFE_ID, HYPHEN_ID, UNDER_ID];
  const { g, editor } = await seeded({ graph: { articleIds: forced } });

  const ALL_TATWEEL = CP('0640 0640 0640 0640 0640');
  eq(g.articles.slugify(ALL_TATWEEL), '', 'an all-tatweel title still slugifies to something');
  eq(g.articles.slugify(CP('0640')), '', 'a single tatweel still slugifies to something');
  eq(g.articles.slugify(CP('0640') + ' ' + CP('0640')), '', 'two spaced tatweels still slugify to something');

  const made = [];
  for (const wanted of forced) {
    const article = await createAs(g, editor.session, 'articles', ALL_TATWEEL);
    eq(article.id, wanted, 'the forced id did not reach newArticleId');
    is(article.slug.length > 0, 'an all-tatweel title produced an empty slug');
    eq(article.slug, wanted === SAFE_ID ? wanted : 'a' + wanted, 'the fallback slug for ' + wanted);
    eq(article.title, ALL_TATWEEL, 'the stored TITLE was emptied -- only the slug may be');
    await callAdmin(g, { session: editor.session, action: 'publish', id: article.id });
    const res = await callGet(g, { slug: article.slug });
    eq(res.statusCode, 200, 'an all-tatweel fallback slug did not resolve: ' + article.slug);
    eq(res.body.article.title, ALL_TATWEEL, 'the served title is not the all-tatweel title');
    made.push(article.slug);
  }
  eq(new Set(made).size, made.length, 'two all-tatweel articles collided on one slug');
  eq(g.forcedIdsLeft(), 0, 'a forced id was never drawn, so one of the shapes above went untested');
  return '3 id shapes, all claimable from an empty slug: ' + made.join(' / ');
});

run('two titles differing ONLY by diacritics collide, and the collision is absorbed by the -2 path rather than raised', async () => {
  // THE COST OF THE FIX, PAID DELIBERATELY AND PINNED HERE. Removing the marks means a vowelled
  // heading and its bare twin now want the SAME slug. That is not a new failure mode -- it is
  // the ordinary same-title collision claimSlug() has always handled NX -- and this case proves
  // it is reached rather than an error: three spellings of one phrase get a slug, a -2 and a -3,
  // and each one still opens ITS OWN article.
  const { g, editor } = await seeded();
  const THIRD = CP('0627 0644 0635 0651 0628 0631 0020 062C 0645 0650 064A 0644');

  const a = await createAs(g, editor.session, 'articles', VOWELLED, 'first');
  const b = await createAs(g, editor.session, 'articles', BARE, 'second');
  const c = await createAs(g, editor.session, 'articles', THIRD, 'third');

  eq(a.slug, TWO_WORDS, 'the first article did not take the two-word root');
  eq(b.slug, TWO_WORDS + '-2', 'the bare twin did not take the -2 sibling');
  eq(c.slug, TWO_WORDS + '-3', 'the third vowelling did not take the -3 sibling');
  eq(new Set([a.slug, b.slug, c.slug]).size, 3, 'three titles produced fewer than three slugs');
  eq(new Set([a.id, b.id, c.id]).size, 3, 'three creates produced fewer than three articles');

  // The public projection is a five-field whitelist with no id in it -- see the case above --
  // so each sibling is identified by the writing it carries, which is what a reader would see.
  for (const made of [a, b, c]) {
    await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
    const res = await callGet(g, { slug: made.slug });
    eq(res.statusCode, 200, 'a sibling slug did not resolve: ' + HEX(made.slug));
    eq(res.body.article.slug, made.slug, 'a sibling slug resolved to a different slug');
    eq(res.body.article.body, made.body, 'a sibling slug resolved to a different article');
    eq(res.body.article.title, made.title, 'a sibling slug resolved to a different title');
  }
  eq([a, b, c].map((made) => made.body), ['first', 'second', 'third'],
    'the three articles are not three distinct pieces of writing');
  return '3 vowellings of one phrase -> U+' + HEX(a.slug) + ' / +"-2" / +"-3", each resolving to its own article';
});

run('a plain Arabic title is byte-identical after the harakat fix, alef-hamza included', async () => {
  // THE PROMISE THE FIX MAKES TO EVERY TITLE THAT HAS NO MARKS IN IT: nothing moves. The title
  // here opens with U+0623, alef with hamza above -- a LETTER an Arabic writer chose, not a mark
  // they added. NFD decomposes it to U+0627 + U+0654 and U+0654 is itself Mn, so a fix that
  // normalised before stripping would quietly rewrite it to a bare alef and change the URL of
  // ordinary unvowelled titles. slugify() takes the string as given, so this case pins that
  // U+0623 is still U+0623 in the slug and would go red the day someone adds a .normalize().
  const { g, editor } = await seeded();
  const PLAIN = CP('0623 062E 0644 0627 0642 0020 062A 0631 0628 064A 0629');
  const EXPECTED = CP('0623 062E 0644 0627 0642') + '-' + CP('062A 0631 0628 064A 0629');

  eq(g.articles.slugify(PLAIN), EXPECTED, 'a plain Arabic title moved');
  is(g.articles.slugify(PLAIN).indexOf(CP('0623')) !== -1, 'the alef-hamza was decomposed away');
  is(!/\p{Mn}/u.test(PLAIN), 'the fixture stopped being a mark-free title, so it proves nothing');
  eq(PLAIN.indexOf(CP('0640')), -1, 'the fixture grew a tatweel, so it proves nothing');

  const made = await createAs(g, editor.session, 'articles', PLAIN);
  eq(made.slug, EXPECTED, 'the stored slug for a plain Arabic title moved');
  await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
  const res = await callGet(g, { slug: made.slug });
  eq(res.statusCode, 200, 'a plain Arabic slug did not resolve');
  eq(res.body.article.slug, EXPECTED, 'a plain Arabic slug resolved to a different article');
  return 'U+' + HEX(PLAIN) + '  ->  U+' + HEX(made.slug) + '  (unchanged by this fix)';
});

run('the slug is stable across edits -- a corrected title does not break a published link', async () => {
  const { g, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'Teh first title');
  await callAdmin(g, { session: editor.session, action: 'publish', id: a.id });
  g.clock.advance(60000);
  const edited = await callAdmin(g, { session: editor.session, action: 'update', id: a.id, patch: { title: 'The first title' } });
  eq(edited.statusCode, 200, 'the update was refused');
  eq(edited.body.article.slug, a.slug, 'the slug moved when the title was corrected');
  eq(edited.body.article.title, 'The first title', 'the title did not change');
  is(edited.body.article.updatedAt !== a.updatedAt, 'updatedAt did not move');
  eq(edited.body.article.createdAt, a.createdAt, 'createdAt moved');
  const res = await callGet(g, { slug: a.slug });
  eq(res.statusCode, 200, 'the published link stopped working after an edit');
  return 'slug ' + a.slug + ' unchanged; updatedAt ' + a.updatedAt + ' -> ' + edited.body.article.updatedAt;
});

run('the record has exactly the nine declared fields, and a patch cannot add a tenth', async () => {
  const { g, editor } = await seeded();
  const a = await callAdmin(g, {
    session: editor.session, action: 'create', section: 'articles', title: 'Nine fields', body: 'x',
    // Six fields offered that the record must not take:
    id: 'forged-id', slug: 'forged-slug', status: 'published', authorKey: 'acct:v1:google:999',
    publishedAt: '1999-01-01T00:00:00.000Z', extra: 'nope',
  });
  eq(a.statusCode, 200, 'the create was refused');
  eq(Object.keys(a.body.article), g.articles.ARTICLE_FIELDS.slice(), 'the record keys, in order');
  is(a.body.article.id !== 'forged-id', 'a caller chose the id');
  is(a.body.article.slug !== 'forged-slug', 'a caller chose the slug');
  eq(a.body.article.status, 'draft', 'a caller published on creation');
  eq(a.body.article.publishedAt, null, 'a caller set publishedAt');
  eq(a.body.article.authorKey, (await g.roles.resolveActor({ body: { session: editor.session } })).accountKey,
    'the author key is not the acting account');

  // A patch naming anything but title/body is refused rather than filtered.
  for (const bad of ['section', 'status', 'authorKey', 'slug', 'id', 'publishedAt']) {
    const patch = {};
    patch[bad] = 'women';
    const res = await callAdmin(g, { session: editor.session, action: 'update', id: a.body.article.id, patch });
    eq(res.statusCode, 400, 'a patch naming ' + bad + ' was not refused');
    eq(res.body.error, 'articles-patch-field', 'the code for a patch naming ' + bad);
  }
  return 'six forged fields ignored on create; six patch fields refused by name';
});

run('nothing the articles path writes carries a TTL', async () => {
  const { g, owner, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'No clock ends this');
  await callAdmin(g, { session: editor.session, action: 'publish', id: a.id });
  await callRoles(g, { session: owner.session, action: 'grant', accountKey: editor.accountKey, sections: ['articles', 'women'] });

  const prefixes = [g.articles.ARTICLE_PREFIX, g.articles.ARTICLE_INDEX,
    g.articles.ARTICLE_SLUG_INDEX, g.articles.ROLE_PREFIX];
  const expiring = g.store.expiringKeys().filter((k) => prefixes.some((p) => k.startsWith(p)));
  eq(expiring, [], 'an articles key was written with an expiry');

  // The session, which SHOULD expire, did -- so the check above is not passing because the fake
  // store never records an expiry at all.
  const sessionExpiring = g.store.expiringKeys().filter((k) => k.startsWith(g.authStore.SESSION_PREFIX));
  is(sessionExpiring.length > 0, 'the fake store recorded no expiry for anything, so this proves nothing');
  return prefixes.join(' ') + ' -> 0 expiries; sessions -> ' + sessionExpiring.length;
});

run('the four key families are versioned and the two sections are frozen', async () => {
  const { g } = await seeded();
  eq([g.articles.ARTICLE_PREFIX, g.articles.ARTICLE_INDEX, g.articles.ARTICLE_SLUG_INDEX, g.articles.ROLE_PREFIX],
    ['art:v1:', 'artidx:v1:', 'artslug:v1:', 'role:v1:'], 'the declared prefixes');
  eq(g.articles.SECTIONS.slice(), ['articles', 'women'], 'the declared sections');
  is(Object.isFrozen(g.articles.SECTIONS), 'the section list is not frozen');
  eq(g.roles.ROLES.slice(), ['owner', 'editor', 'none'], 'the declared roles');
  const bad = await g.articles.createArticle({ section: 'fiqh', title: 'x', body: 'y' }, 'acct:v1:google:1');
  eq(bad, { ok: false, code: 'articles-section' }, 'a third section was accepted');
  return 'four prefixes, two sections, three roles';
});

run('deleting an article frees its slug, empties the index, and removes the record', async () => {
  const { g, editor } = await seeded();
  const a = await createAs(g, editor.session, 'articles', 'Written then removed');
  await callAdmin(g, { session: editor.session, action: 'publish', id: a.id });
  eq((await callGet(g, { slug: a.slug })).statusCode, 200, 'the article was not reachable before the delete');

  const res = await callAdmin(g, { session: editor.session, action: 'delete', id: a.id });
  eq(res.statusCode, 200, 'the delete was refused');
  eq(await g.articles.getArticleById(a.id), null, 'the record survived the delete');
  eq((await callGet(g, { slug: a.slug })).statusCode, 404, 'the slug still serves the deleted article');
  eq((await g.articles.listPublished('articles', {})).items, [], 'the index still lists the deleted article');

  // ...and the freed slug can be taken by a new article with the same title.
  const b = await createAs(g, editor.session, 'articles', 'Written then removed');
  eq(b.slug, a.slug, 'the freed slug was not reusable');
  return 'record, slug and index entry all gone; the slug ' + a.slug + ' was taken again';
});

run('the public routes refuse a method, answer OPTIONS, and never open CORS to a stranger', async () => {
  const { g } = await seeded();
  for (const [label, mod] of [['list', g.list], ['get', g.get], ['admin', g.admin], ['roles', g.rolesAdmin]]) {
    const opt = fakeRes();
    await mod.default(fakeReq({ method: 'OPTIONS' }), opt);
    eq(opt.statusCode, 204, 'the OPTIONS status on ' + label);

    const wrong = fakeRes();
    await mod.default(fakeReq({ method: 'PUT' }), wrong);
    eq(wrong.statusCode, 405, 'the wrong-method status on ' + label);

    const hostile = fakeRes();
    await mod.default(fakeReq({ method: 'OPTIONS', headers: { origin: 'https://not-ours.invalid' } }), hostile);
    eq(hostile.getHeader('access-control-allow-origin'), undefined,
      'the ' + label + ' route echoed a non-listed origin');
    eq(hostile.getHeader('vary'), 'Origin', 'the ' + label + ' route did not vary on Origin');
  }
  return 'four routes: OPTIONS 204, PUT 405, no ACAO for a non-listed origin';
});

run('all four routes use the throttle family that FAILS CLOSED', async () => {
  // The lifted declaration, read rather than described.
  is(/const AUTH_FAIL_OPEN\s*=\s*false/.test(RATELIMIT_AUTH_TEXT),
    'AUTH_FAIL_OPEN is no longer false -- these four routes chose it because it refuses');
  for (const rel of MODULES.filter((m) => m.startsWith('api/'))) {
    is(/checkAuthLimit/.test(SOURCES[rel]), rel + ' does not use the auth-family throttle');
  }
  // And a throttle that refuses actually stops each of them.
  const g = buildGraph({
    env: { EZIK_OWNER_ACCOUNTS: digestOf(FIXTURE.ownerEmail) },
    throttle: () => ({ success: false }),
  });
  const codes = [];
  codes.push((await callList(g, { section: 'articles' })).statusCode);
  codes.push((await callGet(g, { slug: 'anything' })).statusCode);
  codes.push((await callAdmin(g, { session: 's', action: 'create', section: 'articles', title: 'x', body: 'y' })).statusCode);
  codes.push((await callRoles(g, { session: 's', action: 'grant', accountKey: 'acct:v1:google:1', sections: ['articles'] })).statusCode);
  eq(codes, [429, 429, 429, 429], 'a throttled request got through');
  return 'AUTH_FAIL_OPEN=false; four routes -> 429 when the window refuses';
});

run('paging returns every published article exactly once and never a draft', async () => {
  const { g, editor } = await seeded();
  const published = [];
  for (let i = 0; i < 7; i++) {
    const made = await createAs(g, editor.session, 'articles', 'Piece number ' + (i + 1));
    g.clock.advance(1000);
    if (i % 2 === 0) {
      await callAdmin(g, { session: editor.session, action: 'publish', id: made.id });
      published.push(made.slug);
    }
  }
  const seen = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const res = await callList(g, { section: 'articles', limit: '2', cursor });
    eq(res.statusCode, 200, 'a page was refused');
    for (const item of res.body.items) seen.push(item.slug);
    cursor = res.body.nextCursor;
    if (cursor === null) break;
  }
  eq(seen.slice().sort(), published.slice().sort(), 'the slugs paging returned');
  eq(new Set(seen).size, seen.length, 'paging returned a duplicate');
  return '7 articles, 4 published, limit 2 -> ' + seen.length + ' distinct slugs across pages';
});

// ---------------------------------------------------------------------------
// THE MUTANTS -- the same lifted source with one line changed, each of which must be KILLED.
// ---------------------------------------------------------------------------

const MUTANTS = [
  {
    name: 'M1 the draft filter is removed from listSection',
    file: 'lib/articles/store.js',
    from: '      if (publishedOnly && record.status !== STATUS_PUBLISHED) continue;',
    to: '      if (false && record.status !== STATUS_PUBLISHED) continue;',
  },
  {
    name: 'M2 the draft filter is removed from getPublishedBySlug',
    file: 'lib/articles/store.js',
    from: '  if (!record || record.status !== STATUS_PUBLISHED) return null;',
    to: '  if (!record) return null;',
  },
  {
    // RE-ANCHORED ON 2026-09-07. This mutant used to hang off the `authorName` line, and D-7
    // deleted that line. The mutant it performs is unchanged -- the account key is appended to
    // the projection -- and it now hangs off the last field the whitelist actually has.
    name: 'M3 the account key joins the public view',
    file: 'lib/articles/public-view.js',
    from: "    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : null,\n  };",
    to: "    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : null,\n    authorKey: record.authorKey,\n  };",
  },
  {
    name: 'M4 an account with no grant defaults to editor',
    file: 'lib/articles/roles.js',
    from: '  if (grant) return { role: grant.role, sections: grant.sections };\n  return { role: ROLE_NONE, sections: [] };',
    to: '  if (grant) return { role: grant.role, sections: grant.sections };\n  return { role: ROLE_EDITOR, sections: SECTIONS.slice() };',
  },
  {
    name: 'M5 grantRole stops checking for owner',
    file: 'lib/articles/roles.js',
    from: 'export async function grantRole(targetAccountKey, sections, actor) {\n  if (!actor || actor.role !== ROLE_OWNER) return { ok: false, code: \'roles-forbidden\' };',
    to: 'export async function grantRole(targetAccountKey, sections, actor) {\n  if (!actor) return { ok: false, code: \'roles-forbidden\' };',
  },
  {
    name: 'M6 an empty owner row is read as "everybody"',
    file: 'lib/articles/roles.js',
    from: '  if (digests.size === 0) return false;',
    to: '  if (digests.size === 0) return true;',
  },
  {
    name: 'M7 the slug claim overwrites instead of claiming NX',
    file: 'lib/articles/store.js',
    from: '    if (await writeIfAbsent(slugKey(safe), { id })) return safe;',
    to: '    if (await writeJson(slugKey(safe), { id })) return safe;',
  },
  {
    name: 'M8 revokeRole reports a success without deleting',
    file: 'lib/articles/roles.js',
    from: '  if (!(await deleteKey(roleKey(key)))) return { ok: false, code: \'roles-unwritable\' };\n  return { ok: true, accountKey: key, removed: true };',
    to: '  return { ok: true, accountKey: key, removed: true };',
  },
  {
    name: 'M9 the root-grant refusal is removed from revokeRole',
    file: 'lib/articles/roles.js',
    from: '  if (await isRootOwner(key)) return { ok: false, code: \'roles-root-grant\' };',
    to: '  if (false) return { ok: false, code: \'roles-root-grant\' };',
  },

  // ------------------------------------------------------------------------------------------
  // THE EDITOR ROSTER'S OWN FIVE. Each is a way the second rung could be built wrong that would
  // still pass every case that existed before 2026-09-07.
  // ------------------------------------------------------------------------------------------
  {
    // The rule that separates a PROVED address from a CLAIMED one. Without it, any provider that
    // asserts an address it never verified mints an editor -- or an owner.
    name: 'M10 the verified-address check is dropped from provedDigest',
    file: 'lib/articles/roles.js',
    from: '  if (record.emailVerified !== true) return null;',
    to: '  if (false) return null;',
  },
  {
    // The precedence, inverted at its most dangerous point: the editor row starts satisfying the
    // OWNER check, so everybody the owner let in to WRITE can also grant and revoke.
    name: 'M11 the editor row also satisfies the owner check',
    file: 'lib/articles/roles.js',
    from: '  if (digests.size === 0) return false;\n  const digest = await provedDigest(key);\n'
      + '  if (!digest) return false;\n  return digests.has(digest);',
    to: '  if (digests.size === 0 && editorDigests().size === 0) return false;\n'
      + '  const digest = await provedDigest(key);\n  if (!digest) return false;\n'
      + '  return digests.has(digest) || editorDigests().has(digest);',
  },
  {
    // A privilege that outlives its grant. The role is resolved once and remembered, so taking a
    // digest off the row changes nothing until the process is replaced.
    name: 'M12 the resolved role is cached across requests',
    file: 'lib/articles/roles.js',
    from: 'export async function roleFor(accountKeyString) {\n'
      + '  const key = safeAccountKey(accountKeyString);\n'
      + '  if (!key) return { role: ROLE_NONE, sections: [] };',
    to: 'const __ROLE_CACHE = new Map();\n'
      + 'export async function roleFor(accountKeyString) {\n'
      + '  if (__ROLE_CACHE.has(accountKeyString)) return __ROLE_CACHE.get(accountKeyString);\n'
      + '  const __answer = await __roleForUncached(accountKeyString);\n'
      + '  __ROLE_CACHE.set(accountKeyString, __answer);\n'
      + '  return __answer;\n'
      + '}\n'
      + 'async function __roleForUncached(accountKeyString) {\n'
      + '  const key = safeAccountKey(accountKeyString);\n'
      + '  if (!key) return { role: ROLE_NONE, sections: [] };',
  },
  {
    // The fail-open. An unconfigured deployment -- which is this one, today -- would hand every
    // signed-in reader in the world the right to write and delete articles.
    name: 'M13 an empty editor row is read as "everybody"',
    file: 'lib/articles/roles.js',
    from: '  if (editors.size === 0) return false;',
    to: '  if (editors.size === 0) return true;',
  },
  {
    // The 2026-09-07 fix undone. Without the prefix an id beginning with '-' or '_' is handed to
    // safeSlug() as a slug root, refused, and refused again by all fifty retries, so an article is
    // turned away for the shape of an id it was given rather than for anything its writer did.
    // This is the mutant that was ALIVE in the tree until 2026-09-07.
    name: 'M15 the id fallback loses the prefix that makes it claimable',
    file: 'lib/articles/store.js',
    from: 'function fallbackSlug(id) { return safeSlug(id) ? id : SLUG_FALLBACK_PREFIX + id; }',
    to: 'function fallbackSlug(id) { return id; }',
  },
  {
    // THE HARAKAT FIX UNDONE, 2026-09-07. Without the stripper every diacritic is a non-letter
    // again, so slugify() cuts a vowelled Arabic word into pieces in the middle of itself and
    // the D-4 title goes back to being six fragments of two words. This is the mutant that was
    // ALIVE in the tree until this date, and it is killed by the harakat case, the collision
    // case, and the tatweel cases above.
    name: 'M16 slugify stops stripping decoration altogether',
    file: 'lib/articles/store.js',
    from: "    .trim().toLowerCase().replace(DECORATION, '');",
    to: '    .trim().toLowerCase();',
  },
  {
    // THE TATWEEL FIX UNDONE, 2026-09-07, AND ONLY THE TATWEEL HALF OF IT. The marks still go, so
    // every harakat case above stays green and cannot be what kills this; what comes back is the
    // stretched word minting a URL of its own, which is the defect this day's change exists for.
    // The narrowest possible undo, so the cases that bite it have to be the tatweel cases.
    name: 'M17 slugify keeps the tatweel again',
    file: 'lib/articles/store.js',
    from: 'const DECORATION = /[\\p{Mn}\\u0640]+/gu;',
    to: 'const DECORATION = /[\\p{Mn}]+/gu;',
  },
  {
    // D-5 undone: the roles door goes back to answering an editor differently from a stranger,
    // which turns any session into an oracle for which rank it holds.
    name: 'M14 the roles door tells an editor apart from a stranger again',
    file: 'api/roles-admin.js',
    from: '  if (!actor || actor.role !== ROLE_OWNER) {\n'
      + "    return res.status(401).json({ ok: false, error: 'roles-unauthenticated' });\n  }",
    to: "  if (!actor) return res.status(401).json({ ok: false, error: 'roles-unauthenticated' });\n"
      + "  if (actor.role !== ROLE_OWNER) return res.status(403).json({ ok: false, error: 'roles-forbidden' });",
  },
];

// ---------------------------------------------------------------------------
// RUN.
// ---------------------------------------------------------------------------

(async function main() {
  for (const t of QUEUE) {
    try {
      const detail = await t.fn();
      results.push({ name: t.name, ok: true, detail: detail || '' });
    } catch (e) {
      results.push({ name: t.name, ok: false, detail: e && e.message ? e.message : String(e) });
    }
  }

  // Every mutant is applied by re-running THE WHOLE BOARD against the mutated source. A mutant is
  // KILLED when at least one case that passed on the real source fails on the mutated one -- which
  // is the only definition that cannot be satisfied by a case that was already failing.
  const mutants = [];
  const greenNames = new Set(results.filter((r) => r.ok).map((r) => r.name));
  for (const m of MUTANTS) {
    const source = SOURCES[m.file];
    const at = source.indexOf(m.from);
    if (at === -1) { mutants.push({ name: m.name, applied: false, killed: false, note: 'the line to mutate is gone from ' + m.file }); continue; }
    if (source.indexOf(m.from, at + 1) !== -1) { mutants.push({ name: m.name, applied: false, killed: false, note: 'the line to mutate is not unique in ' + m.file }); continue; }

    const killers = [];
    MUTATION = { file: m.file, from: m.from, to: m.to };
    for (const t of QUEUE) {
      if (!greenNames.has(t.name)) continue;
      try { await t.fn(); } catch (e) { killers.push(t.name); }
      if (killers.length) break;
    }
    MUTATION = null;
    mutants.push({
      name: m.name,
      applied: true,
      killed: killers.length > 0,
      note: killers.length ? 'killed by: ' + killers[0] : 'SURVIVED -- no case above bites it',
    });
  }

  results.push((function () {
    try {
      is(mutants.length === MUTANTS.length, MUTANTS.length + ' mutants were named and ' + mutants.length + ' ran');
      eq(mutants.filter((m) => !m.applied).map((m) => m.name + ': ' + m.note), [], 'mutants that could not be applied');
      eq(mutants.filter((m) => !m.killed).map((m) => m.name + ': ' + m.note), [], 'mutants that survived');
      return { name: 'every mutant was applied and every one of them was killed', ok: true,
        detail: mutants.length + '/' + mutants.length + ' applied and killed' };
    } catch (e) {
      return { name: 'every mutant was applied and every one of them was killed', ok: false, detail: e.message };
    }
  }()));

  console.log('=== articles-public-guard -- the articles store, the role seam and the four routes ===');
  let bytes = 0;
  let lines = 0;
  for (const rel of MODULES) { bytes += Buffer.byteLength(SOURCES[rel], 'utf8'); lines += SOURCES[rel].split('\n').length; }
  console.log('lifted:  ' + MODULES.length + ' modules  ' + bytes + ' bytes, ' + lines + ' lines'
    + '  +  lib/ratelimit.js auth family by name');
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
    for (const r of results) if (!r.ok) console.log('   * ' + r.name + ': ' + r.detail);
  }
  process.exit(failed ? 1 : 0);
}());
