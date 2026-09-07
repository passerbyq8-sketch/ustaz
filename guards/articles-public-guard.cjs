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
// AND IT CANNOT PASS BY DOING NOTHING. NINE MUTANTS are compiled at the end from the same lifted
// source with one line changed each -- the draft filter removed from the list, the draft filter
// removed from the by-slug read, the account key added to the public view, the default role
// turned into `editor`, the owner check dropped from grantRole, an empty owner row read as
// "everybody", the slug claim made to overwrite, the revoke made to not delete, and the
// root-grant refusal removed -- and every one of them must be KILLED by a named case above. A
// guard that cannot go red proves nothing.
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
    is(text.indexOf(FIXTURE.editorEmail) === -1, 'the ' + label + ' route emitted the address');
  }
  // ...and the article the store holds DOES carry the key, so the check above is not passing
  // merely because there was nothing to leak.
  const stored = await g.articles.getArticleById(a.id);
  eq(stored.authorKey, editor.accountKey, 'the stored record does not carry the author key');
  return 'stored authorKey = ' + stored.authorKey + '; emitted keys = '
    + Object.keys(getRes.body.article).join(',');
});

run('the public projection is a whitelist of six fields, and a tenth stored field cannot ride out on it', async () => {
  const { g } = await seeded();
  eq(g.view.PUBLIC_FIELDS.slice(), ['slug', 'section', 'title', 'body', 'publishedAt', 'authorName'],
    'the declared public fields');
  const emitted = g.view.publicArticle({
    id: 'x', slug: 's', section: 'articles', title: 't', body: 'b', status: 'published',
    authorKey: 'acct:v1:google:1', createdAt: 'c', updatedAt: 'u', publishedAt: 'p',
    // Two fields the record does not have today, offered anyway:
    authorEmail: 'must-not-appear', internalNote: 'must-not-appear',
  });
  eq(Object.keys(emitted), g.view.PUBLIC_FIELDS.slice(), 'the keys the projection built');
  is(JSON.stringify(emitted).indexOf('must-not-appear') === -1, 'an offered extra field was emitted');
  eq(emitted.authorName, null, 'the display name resolves to something other than null');
  return 'twelve fields offered, ' + Object.keys(emitted).length + ' emitted';
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
  eq(res.statusCode, 403, 'the status an editor gets from the roles door');
  eq(res.body.ok, false, 'the body an editor gets');
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
  return 'editor -> 403, owner -> 200 on the identical request';
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
  eq(escalate.statusCode, 403, 'the newly granted editor could grant');
  return 'asked for owner, got editor; the editor then got 403 from the roles door';
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

run('a title that slugifies to nothing still gets a claimable slug, every time', async () => {
  const { g, editor } = await seeded();
  // The id fallback is base64url and carries '_' about two in five times, so ONE article proves
  // nothing here -- the case that used to fail was the unlucky id, not the unusual title. Twenty
  // of them make the underscore certain to appear, and every one must still be reachable.
  const made = [];
  for (let i = 0; i < 20; i++) {
    const article = await createAs(g, editor.session, 'articles', '؟؟؟ ... !!! ---');
    is(article.slug.length > 0, 'a punctuation-only title produced an empty slug');
    eq(article.slug, article.id, 'the fallback slug is not the article id');
    await callAdmin(g, { session: editor.session, action: 'publish', id: article.id });
    const res = await callGet(g, { slug: article.slug });
    eq(res.statusCode, 200, 'a fallback slug did not resolve: ' + article.slug);
    made.push(article.slug);
  }
  eq(new Set(made).size, made.length, 'two fallback slugs collided');
  const withUnderscore = made.filter((s) => s.indexOf('_') !== -1).length;
  is(withUnderscore > 0, 'no id in twenty carried an underscore, so this case proved nothing');
  return made.length + ' punctuation-only titles, all reachable; ' + withUnderscore + ' of the ids carried an underscore';
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
    name: 'M3 the account key joins the public view',
    file: 'lib/articles/public-view.js',
    from: '    authorName: resolveDisplayName(record.authorKey),',
    to: '    authorName: resolveDisplayName(record.authorKey),\n    authorKey: record.authorKey,',
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
