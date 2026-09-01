// guards/lib-book-contract-guard.cjs -- piece 5: the library/book contract.
//
// ZERO NETWORK, ZERO SERVER, ZERO REAL TOKEN. Every outbound call in this repository passes
// through one of two seams -- `globalThis.fetch` for the provider and the injected `fetchImpl`
// for the tools -- and this guard owns both for the length of a drive. A drive that reached a
// real host would be a defect in this file, so section A counts the injected fetch rather than
// assuming a zero.
//
// WHY IT DRIVES RATHER THAN READS. The four claims below are claims about behaviour: what the
// provider is OFFERED, what the selection RETURNS, what survives a failure, and what a textless
// atom is allowed to become. Three of the four are invisible in the source -- `pickBookCards`
// looks correct on the page whether or not the row it needs ever reaches it -- so the material
// is driven through the real exported functions and observed on the wire.
//
// == THE MIRROR TEST, AND HOW THE INPUT WAS CHOSEN ===========================
// The order forbids building the input out of the same assumption as the code under test. So the
// input here is NOT a hand-written row shaped like what `pickBookCards` wants. It is the recorded
// SERVICE wire shape -- guards/fixtures-lib-search-16a.json, written against the measured
// /search contract for item 16-A -- fed in at the outermost seam this process can reach, and
// everything downstream (record, row, ref, marker, card, chip) is whatever the real code makes of
// it. Section D's textless atom is that same recorded hit with ONE field deleted, so the two runs
// differ by the single field whose absence is the whole question.
//
// Output is ASCII only, by order. Arabic values are transliterated to '?' before printing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// The recorded service contract. Shared with guards/lib-search-16a-guard.cjs on purpose: one
// measured shape for the library, not two drifting copies of it.
const FIXTURES = JSON.parse(read('guards/fixtures-lib-search-16a.json'));

// Deliberately under sixteen characters: recon's secret scanner reads a 16+ character
// token-shaped literal as a leaked credential and would red a gate over a fixture.
const FIXTURE_TOKEN = 'tk-fix-9';

let checks = 0;
let failures = 0;
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '?');

function ok(name, condition, detail) {
  checks += 1;
  if (condition) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail === undefined ? '' : '\n        ' + ascii(detail)));
  return false;
}

function section(title) {
  console.log('\n-- ' + title + ' ' + '-'.repeat(Math.max(2, 70 - title.length)));
}

// -- the two seams, owned for the length of a drive --------------------------
const json = (payload, status) => new Response(JSON.stringify(payload), {
  status: status || 200, headers: { 'content-type': 'application/json' },
});

// The loop and api/ask.js write operational minutes on every turn. They are not this guard's
// output and they are not ASCII by contract, so they are held for the length of a drive.
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

// A provider stub that answers a scripted sequence of rounds and records, for every round, the
// tool names the loop actually put on the wire. Nothing here reads the loop's source.
function providerStub(rounds) {
  const offered = [];
  let n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    offered.push((body.tools || []).map((tool) => tool.name));
    const step = rounds[Math.min(n, rounds.length - 1)];
    n += 1;
    return json(Object.assign({}, step, { usage: { input_tokens: 1, output_tokens: 1 } }));
  };
  return { offered, restore() { globalThis.fetch = real; } };
}

const TEXT_ROUND = (text) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });
const TOOL_ROUND = (name, input) => ({
  content: [{ type: 'tool_use', id: 'tu1', name, input }], stop_reason: 'tool_use',
});

// The one sentence the scripted model "quotes". It is the fixture hit's own `text`, so in
// section D -- where that text never arrives -- the prose is a claim about material the turn
// does not hold, which is exactly the shape of the defect being measured.
const HIT = FIXTURES.hit_page_citable;
const QUOTED = 'قال ابنُ قدامةَ في المغني: ' + HIT.text + ' [[1]].';

const TURN_BASE = {
  messages: [{ role: 'user', content: 'ما الماءُ الطهور' }],
  system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult',
  providerUrl: 'https://provider.invalid/v1/messages', headers: {},
  env: {},   // injected, so the real environment cannot decide the shape of a drive
};

const OFF = { libEligible: false, libFlagValue: '', libToken: '' };
const ON = { libEligible: true, libFlagValue: 'on', libToken: FIXTURE_TOKEN };

async function runTurn(loop, spec) {
  const stub = providerStub(spec.rounds);
  try {
    const out = await quiet(() => loop.runFreeBrainTurn(Object.assign(
      {}, TURN_BASE, spec.lib, { fetchImpl: spec.libFetch },
    )));
    return { out, offered: stub.offered };
  } finally { stub.restore(); }
}

// -- a mutant of one module, in a scratch directory, never in the tree -------
//
// TWO THINGS THIS HAS TO SURVIVE, BOTH MEASURED IN THIS TREE.
//
//   * LINE ENDINGS ARE NOT UNIFORM. lib/lib-service.js is CRLF end to end while
//     lib/free-brain/loop.js is LF, so a seam written with '\n' matches one file and silently
//     misses the other. The source is normalised to LF before the seam is applied, and the
//     scratch copy is written that way -- it is a temp module, not the tree.
//   * THE MUTANT MUST STILL RESOLVE ITS NEIGHBOURS. Rather than copy a transitive closure of
//     imports into the scratch directory, every relative specifier is rewritten to an absolute
//     file URL pointing at the REAL module beside the original. The mutant is therefore exactly
//     one file different from the tree, which is the whole point of a mutant.
//
// And it refuses to report anything at all unless the mutation actually reached the disk. Two
// separate refusals, because they fail for different reasons: the seam no longer being present
// in the source, and the mutated bytes not arriving on disk. Either one, silently tolerated,
// turns a mutant into a false PASS.
async function mutantModule(temp, rel, name, mutate, probe) {
  const lf = read(rel).replace(/\r\n/g, '\n');
  const changed = mutate(lf);
  if (changed === lf) throw new Error('mutation seam moved: ' + name + ' in ' + rel);
  const sourceDir = path.dirname(path.join(REPO, rel));
  const resolved = changed.replace(/(\bfrom\s*')(\.\.?\/[^']+)(')/g,
    (all, head, spec, tail) => head + pathToFileURL(path.resolve(sourceDir, spec)).href + tail);
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(rel));
  fs.writeFileSync(file, resolved, 'utf8');
  const written = fs.readFileSync(file, 'utf8');
  if (written.indexOf(probe) === -1 || lf.indexOf(probe) !== -1) {
    throw new Error('mutant not on disk (or its probe is not distinctive): ' + name);
  }
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

// ── THE CLIENT, BOOTED ONCE, OVER THE SERVER'S OWN STRINGS ──────────────────
//
// WHY A REAL DOM AND NOT A REGEX. B6/B7 above compile the client's own expressions out of app.jsx
// and parse a tag with them. That is enough to prove the tag is PARSEABLE and it is not enough for
// anything section E claims: «the reader sees the passage that arrived», «a textless atom draws no
// control», «the cut is said out loud» are claims about rendered output, and the only honest way to
// read rendered output is to render it. So the shipped JSX is transformed the way index.html's own
// bundle is, evaluated in a vm over a linkedom document with the vendored React, and the three
// pieces this piece touched -- `parseRichMessage`, `ezikRenderSegments`, `BookCard` -- are taken
// from that context by name. A mutant in ANY of the three fails here; none of them is re-typed.
//
// `ReactDOM.createRoot` is stubbed FIRST and the real one kept aside, because app.jsx self-mounts
// on evaluation and a mounted application is a second thing rendering into this document.
function bootClient() {
  const { parseHTML } = require('linkedom');
  const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));
  const vm = require('vm');
  const INDEX = path.join(REPO, 'index.html');
  const block = BB.readBabelBlock({
    file: INDEX, html: fs.readFileSync(INDEX, 'utf8'), jsx: read('app.jsx'),
  });
  const transformed = BB.transformBabelBlock(block, {
    retainLines: false, configFile: false, babelrc: false,
  });

  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  // Five globals linkedom does not ship that the bundle reaches for on evaluation. `atob` is the
  // one this piece added: without it `ezikDecodeMatn` takes its catch and every passage becomes
  // the empty string -- which would make E2 pass for the wrong reason and E1 fail for a reason
  // that is not in the tree.
  for (const pair of [['TextDecoder', TextDecoder], ['TextEncoder', TextEncoder],
    ['AbortController', AbortController], ['atob', atob]]) {
    try { if (!window[pair[0]]) window[pair[0]] = pair[1]; } catch (error) { /* getter-only */ }
  }
  try { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } catch (error) {}
  try { window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch (error) {}
  try { window.self = window; } catch (error) {}
  try { window.globalThis = window; } catch (error) {}
  global.window = window; global.document = window.document; global.navigator = window.navigator;

  const ctx = vm.createContext(window);
  for (const file of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', file), 'utf8'), ctx, { filename: file });
  }
  vm.runInContext('var __realCreateRoot = ReactDOM.createRoot;'
    + ' ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {};
  window.addEventListener('error', () => {});
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });

  const grab = (expr) => {
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'lib-book-guard-api' }); }
    catch (error) { return undefined; }
  };

  // The reply is parsed and rendered by the client's OWN two functions, in the order the bubble
  // uses them. flushSync is what makes a press observable in the same tick.
  vm.runInContext(`
    function __ezikShow(replyText) {
      var host = document.createElement('div');
      document.body.appendChild(host);
      var parsed = parseRichMessage(replyText, 30);
      var kids = ezikRenderSegments(parsed.segments, { tashkeel: false, age: 30 });
      var root = __realCreateRoot(host);
      ReactDOM.flushSync(function () {
        root.render(React.createElement(React.Fragment, null, kids));
      });
      return host;
    }
    function __ezikPress(el) {
      ReactDOM.flushSync(function () {
        el.dispatchEvent(new window.Event('click', { bubbles: true }));
      });
    }
  `, ctx);
  const showRaw = grab('__ezikShow');
  const press = grab('__ezikPress');

  const show = (replyText) => {
    const host = showRaw(replyText);
    const all = () => Array.prototype.slice.call(host.querySelectorAll('*'));
    const buttonsOf = () => Array.prototype.slice.call(host.querySelectorAll('button'));
    const expandedOf = () => all().filter((el) => el.getAttribute('aria-expanded') === 'true');
    // The panel is the button's own sibling and its second child is the passage. Read positionally
    // rather than by style, so a re-skin does not turn into a false failure and a re-ORDER does.
    const matnEl = () => {
      const open = expandedOf()[0];
      if (!open || !open.nextElementSibling) return null;
      return open.nextElementSibling.children[1] || null;
    };
    const probe = {
      buttons: buttonsOf().length,
      chips: parseSegmentsOf(replyText).filter((seg) => seg.type === 'book').length,
      wasFoldedBeforeFirstTouch: expandedOf().length === 0,
      get panels() { return expandedOf().length; },
      allText: () => String(host.textContent || ''),
      hasText: (needle) => String(host.textContent || '').indexOf(needle) !== -1,
      matn: () => { const el = matnEl(); return el ? String(el.textContent || '') : ''; },
      exact: (expected) => {
        const el = matnEl();
        return !!el && el.childElementCount === 0 && String(el.textContent) === expected;
      },
      open: () => { const b = buttonsOf()[0]; if (b) press(b); },
      close: () => { const b = buttonsOf()[0]; if (b) press(b); },
    };
    return probe;
  };
  const parseSegmentsOf = (replyText) => {
    const parsed = grab('parseRichMessage')(replyText, 30);
    return JSON.parse(JSON.stringify(parsed.segments || []));
  };

  return { grab, show };
}

async function main() {
  console.log('=== lib-book-contract -- piece 5: the library and the book card ===');

  // ع-٤٩/د١ — THE GLOBAL FETCH IS POISONED FOR THE WHOLE RUN, NOT COUNTED AFTERWARDS.
  // The header of this file says a drive that reached a real host would be a defect in it.
  // That was asserted of the INJECTED seam (A5) and merely assumed of the global one. It is
  // now the same kind of fact: every provider stub below saves and restores whatever it finds
  // here, so this is what is installed between drives, under the client boot and under every
  // render. E6 reads the counter at the end; E6b shows the counter can move.
  const poisoned = { calls: 0 };
  globalThis.fetch = async (target) => {
    poisoned.calls += 1;
    throw new Error('lib-book-guard: a real network call was attempted to ' + String(target));
  };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-libbook-'));

  const ask = await quiet(() => esm('api/ask.js'));
  const loop = await esm('lib/free-brain/loop.js');
  const tools = await esm('lib/free-brain/tools.js');
  const service = await esm('lib/lib-service.js');

  const askSource = read('api/ask.js');
  const appSource = read('app.jsx');

  // A counting library fetch: every library call this guard makes is counted here, so "no
  // network" is asserted rather than assumed, and a zero is never a zero by accident.
  let libCalls = 0;
  const libServing = (hit) => async () => { libCalls += 1; return json({ hits: [hit], total: 1 }); };
  const libThrowing = async () => { libCalls += 1; throw new Error('boom'); };

  const ctx = (over) => Object.assign({
    table: tools.createEvidenceTable(), degraded: [], spend: [], injectionMarkers: [],
    band: 'adult', fetchImpl: libServing(HIT),
  }, over);

  // ==========================================================================
  section('A. A BRIEF TURN DOES NOT REACH THE LIBRARY, BY ANY BRANCH');
  // ==========================================================================
  // A1-A3 observe the OFFER on the provider wire. A4-A6 observe the RUNNER independently, so
  // both halves have to fail before a brief turn could touch the library.

  const brief = await runTurn(loop, { rounds: [TEXT_ROUND('جواب.')], lib: OFF });
  ok('A1  a brief turn is offered no search_library on any provider round',
    brief.offered.length > 0 && brief.offered.every((names) => !names.includes('search_library')),
    JSON.stringify(brief.offered));

  const deep = await runTurn(loop, { rounds: [TEXT_ROUND('جواب.')], lib: ON });
  ok('A2  ...and an eligible turn IS, so A1 is not vacuous',
    deep.offered.length > 0 && deep.offered.every((names) => names.includes('search_library')),
    JSON.stringify(deep.offered));

  ok('A3  the other three tools are offered on both, so A1 removed one tool and not the list',
    ['search_fatawa', 'search_sources', 'search_live']
      .every((name) => brief.offered[0].includes(name) && deep.offered[0].includes(name)),
    JSON.stringify(brief.offered[0]));

  // The runner, driven directly -- the case where a model asks for a tool it was not offered.
  const netBefore = libCalls;
  const noFlag = await quiet(() => tools.runTool('search_library', { query: 'q' },
    ctx({ libFlagValue: '', libToken: FIXTURE_TOKEN })));
  const noToken = await quiet(() => tools.runTool('search_library', { query: 'q' },
    ctx({ libFlagValue: 'on', libToken: '' })));
  ok('A4  the runner refuses with no flag and with no token, and adds no row',
    noFlag.calls === 0 && noFlag.added.length === 0
      && noToken.calls === 0 && noToken.added.length === 0,
    JSON.stringify({ noFlag: noFlag.calls, noToken: noToken.calls }));
  ok('A5  ...and neither refusal touched the network seam at all',
    libCalls === netBefore, 'lib fetch invoked ' + (libCalls - netBefore) + ' time(s)');

  const allowed = await quiet(() => tools.runTool('search_library', { query: 'q' },
    ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN })));
  ok('A6  ...and an allowed call DOES reach it, so A5 is not vacuous',
    allowed.calls === 1 && allowed.added.length === 1 && libCalls === netBefore + 1,
    JSON.stringify({ calls: allowed.calls, added: allowed.added.length, net: libCalls - netBefore }));

  // The structural half: there is exactly one way into the network for the library.
  const callSites = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'guards') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(js|jsx|cjs|mjs)$/.test(entry.name)) continue;
      const body = fs.readFileSync(full, 'utf8');
      if (/\bsearchLibrary\s*\(/.test(body) && !/export async function searchLibrary/.test(body)) {
        callSites.push(path.relative(REPO, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(REPO);
  ok('A7  searchLibrary has exactly ONE call site in the tree, and it is the gated runner',
    callSites.length === 1 && callSites[0] === 'lib/free-brain/tools.js', JSON.stringify(callSites));

  // The band half lives in api/ask.js and nowhere else, so it is read where it is written.
  ok('A8  depth eligibility is deep|scholar and is built on the REQUESTED depth',
    /const libDepthEligible = libRequestedDepth === 'deep' \|\| libRequestedDepth === 'scholar';/
      .test(askSource));
  const handed = ['libEligible', 'libFlagValue', 'libToken'].filter((field) => new RegExp(
    field + ':[^\\n]*libDepthEligible && band === \'adult\'').test(askSource));
  ok('A9  all THREE handed-down library fields carry the same depth-and-adult conjunction',
    handed.length === 3, JSON.stringify(handed));

  // ── THE SECOND DOOR, NAMED RATHER THAN GLOSSED ─────────────────────────────
  // A7 says `searchLibrary` has one call site. It does -- and that is NOT the same sentence as
  // «there is one way to the library service». MEASURED, 1 September 2026: api/lib-search.js
  // holds a `fetch` of its own to the same service, and its only condition is that
  // SEARCH_API_TOKEN is set: no depth, no band, no SHAMELA_BRAIN flag. It is item 16-A's
  // reader-facing endpoint and it is UNWIRED -- the answer path never reaches it and no client
  // file names it -- so a brief turn cannot arrive there today. Those two reachability facts are
  // what this asserts, and nothing about the endpoint's own gating: wiring it up should be a
  // decision the owner takes with this gate red, not a drift nobody notices.
  const readerDoor = read('api/lib-search.js');
  const clientFiles = ['app.jsx', 'app.js', 'sw.js']
    .filter((rel) => fs.existsSync(path.join(REPO, rel)));
  ok('A10 the reader endpoint is a second door to the same service, and the answer path is not it',
    /fetch\(SEARCH_URL/.test(readerDoor)
      && askSource.indexOf('lib-search') === -1
      && clientFiles.length >= 2
      && clientFiles.every((rel) => read(rel).indexOf('/api/lib-search') === -1),
    JSON.stringify({ clientFiles }));

  // ==========================================================================
  section('B. A BOOK ROW CARRIES NO URL AND IS NOT DROPPED FOR IT');
  // ==========================================================================

  const cite = await runTurn(loop, {
    rounds: [TOOL_ROUND('search_library', { query: 'الماء' }), TEXT_ROUND(QUOTED)],
    lib: ON, libFetch: libServing(HIT),
  });
  const cited = cite.out.cited;
  ok('B1  the turn cites the library row, and that row has no url at all',
    cited.length === 1 && cited[0].kind === 'lib_book' && cited[0].url === '',
    JSON.stringify(cited.map((row) => ({ kind: row.kind, url: row.url }))));

  const bookCards = loop.pickBookCards(cited, 3, ask.buildBookTag);
  ok('B2  pickBookCards turns that url-less row into a card',
    bookCards.length === 1 && typeof bookCards[0].tag === 'string', JSON.stringify(bookCards));
  // NOT `bookCards.length ? bookCards[0].tag : ''`, and guards/vacuous-assertion-guard.cjs is
  // right about why: B4 below is three NEGATIVE checks, and every one of them passes on the empty
  // string. A `tag` that went empty because B2 had already failed would report B4 green over
  // nothing. The sentinel is non-empty, so a missing card fails B3 and B4 rather than satisfying
  // them, which is the behaviour a negative assertion has to have to mean anything.
  const tag = bookCards.length === 1 ? String(bookCards[0].tag) : 'NO-BOOK-CARD-WAS-BUILT';
  const builtACard = tag !== 'NO-BOOK-CARD-WAS-BUILT';
  ok('B3  ...naming the book, its author and the page the service called citable',
    builtACard && tag.indexOf(HIT.book_title) !== -1 && tag.indexOf(HIT.author) !== -1
      && tag.indexOf(String(HIT.page_start)) !== -1 && tag.indexOf(String(HIT.volume)) !== -1,
    ascii(tag));
  ok('B4  ...and NOT a link, a host, or the corpus the atom sits in',
    builtACard && !/https?:/.test(tag) && !/url=/.test(tag) && !/site=/.test(tag), ascii(tag));

  const pageCards = loop.pickReaderCards(cited, 3, ask.buildSourceTag);
  ok('B5  pickReaderCards keeps none of them -- the silent drop ع-٤٩ answered, still there',
    pageCards.length === 0, JSON.stringify(pageCards));

  // The client half: the chip the server built is parsed back by the client's OWN expressions,
  // cut out of app.jsx and compiled here rather than re-typed.
  const knownTags = /const KNOWN_TAG_NAMES = Object\.freeze\(\[([\s\S]*?)\]\);/.exec(appSource);
  const tagNames = knownTags ? (knownTags[1].match(/'([a-z]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
  ok('B6  the client knows the tag: KNOWN_TAG_NAMES contains "book"',
    tagNames.indexOf('book') !== -1, JSON.stringify(tagNames));
  const clientPattern = new RegExp('<(' + tagNames.join('|') + ')([^>]*)>([\\s\\S]*?)</\\1>', 'g');
  const parsed = clientPattern.exec(tag);
  const authorMatch = parsed ? /author=["']([^"']+)["']/.exec(parsed[2]) : null;
  const refMatch = parsed ? /ref=["']([^"']+)["']/.exec(parsed[2]) : null;
  ok('B7  the client pattern parses the server chip into name, author and locator',
    !!parsed && parsed[1] === 'book' && parsed[3] === HIT.book_title
      && !!authorMatch && authorMatch[1] === HIT.author
      && !!refMatch && /^ج\d+/.test(refMatch[1]),
    parsed ? ascii(JSON.stringify(parsed.slice(1))) : 'no match');

  // MUTANT: reinstate the url filter that lost every book. The card must vanish.
  const m1 = await mutantModule(temp, 'lib/free-brain/loop.js', 'book-url-filter', (src) => src.replace(
    '    if (!row || row.kind !== LIB_BOOK_KIND) continue;\n    const card = buildCard(row);',
    '    if (!row || row.kind !== LIB_BOOK_KIND) continue;\n    const card = row.url ? buildCard(row) : null;',
  ), 'const card = row.url ? buildCard(row) : null;').then((mod) => ({ mod }), (error) => ({ error }));
  if (m1.error) {
    ok('B8  MUTANT KILLED: a url filter over book rows loses every chip', false, m1.error.message);
  } else {
    const mutated = m1.mod.pickBookCards(cited, 3, ask.buildBookTag);
    ok('B8  MUTANT KILLED: a url filter over book rows loses every chip',
      mutated.length === 0 && bookCards.length === 1, JSON.stringify(mutated));
  }

  // ==========================================================================
  section('C. A LIBRARY FAILURE COSTS THE CHIP, NEVER THE TURN');
  // ==========================================================================

  const breakages = [
    ['throws        ', libThrowing],
    ['5xx           ', async () => { libCalls += 1; return json({ error: 'nope' }, 503); }],
    ['malformed body', async () => {
      libCalls += 1;
      return new Response('<html>not json', { status: 200, headers: { 'content-type': 'application/json' } });
    }],
  ];
  for (const pair of breakages) {
    const local = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: pair[1] });
    let threw = null;
    const result = await quiet(() => tools.runTool('search_library', { query: 'q' }, local))
      .catch((error) => { threw = error; return null; });
    ok('C1 ' + pair[0] + ' : returns instead of throwing, with no row and a spoken degradation',
      !threw && !!result && Array.isArray(result.added) && result.added.length === 0
        && typeof result.text === 'string' && result.text.length > 0 && local.degraded.length === 1,
      threw ? String(threw.message) : ascii(JSON.stringify({ text: result && result.text, degraded: local.degraded })));
  }

  const broken = await runTurn(loop, {
    rounds: [TOOL_ROUND('search_library', { query: 'الماء' }),
      TEXT_ROUND('لم يصلْني نصٌّ من المكتبة، وهذا ما أعرفه.')],
    lib: ON, libFetch: libThrowing,
  });
  ok('C2  the whole turn survives a dead library: text delivered, no failure, no cited book',
    typeof broken.out.text === 'string' && broken.out.text.trim().length > 0
      && !broken.out.failure && broken.out.cited.length === 0
      && broken.out.degraded.some((line) => String(line).indexOf('library:') === 0),
    ascii(JSON.stringify({
      chars: broken.out.text.length, failure: broken.out.failure, degraded: broken.out.degraded,
    })));

  // ==========================================================================
  section('D. AN ATOM WITH A PAGE AND NO MATN CLAIMS NOTHING');
  // ==========================================================================
  // THE DISCRIMINATING FIELD EXISTS AND IT IS `text` ON THE SERVICE HIT. Nothing is invented
  // here: the two runs below are the SAME recorded hit, differing only in that field.

  const textless = Object.assign({}, HIT);
  delete textless.text;

  const withText = await service.searchLibrary('q', {
    flagValue: 'on', token: FIXTURE_TOKEN, fetchImpl: libServing(HIT),
  });
  const without = await service.searchLibrary('q', {
    flagValue: 'on', token: FIXTURE_TOKEN, fetchImpl: libServing(textless),
  });
  ok('D1  the same hit minus `text` yields NO record -- title, author, volume and page all present',
    withText.ok === true && withText.records.length === 1
      && without.ok === true && without.records.length === 0
      && !!textless.book_title && !!textless.page_start && !!textless.volume,
    JSON.stringify({ withMatn: withText.records.length, withoutMatn: without.records.length }));

  const bare = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: libServing(textless) });
  const bareOut = await quiet(() => tools.runTool('search_library', { query: 'q' }, bare));
  ok('D2  so the model is handed no row, no [[ref]] marker, no book name and no page to quote',
    bareOut.added.length === 0 && bare.table.rows.length === 0
      && !/\[\[\d+\]\]/.test(bareOut.text)
      && bareOut.text.indexOf(String(HIT.page_start)) === -1
      && bareOut.text.indexOf(HIT.book_title) === -1,
    ascii(bareOut.text));

  const bareTurn = await runTurn(loop, {
    rounds: [TOOL_ROUND('search_library', { query: 'الماء' }), TEXT_ROUND(QUOTED)],
    lib: ON, libFetch: libServing(textless),
  });
  ok('D3  a turn on that atom cites nothing, so no book chip can be built for it',
    bareTurn.out.cited.length === 0
      && loop.pickBookCards(bareTurn.out.cited, 3, ask.buildBookTag).length === 0,
    JSON.stringify(bareTurn.out.cited));

  // The reviewer's own words about the reply. The tag is read out of lib/output-reviewer.js
  // rather than typed here, so the two cannot drift.
  const reviewerSource = read('lib/output-reviewer.js');
  const stableTag = (/GENERAL_STABLE: '([^']+)'/.exec(reviewerSource) || [])[1] || '';
  ok('D4  ...and the reader is TOLD nothing was transmitted, in the reviewer\'s own tag',
    stableTag.length > 0 && bareTurn.out.text.indexOf(stableTag) !== -1, ascii(bareTurn.out.text));
  ok('D5  ...while the run that DID hold the matn carries no such denial',
    stableTag.length > 0 && cite.out.text.indexOf(stableTag) === -1, ascii(cite.out.text));

  // The only producer of a `lib:` evidence identity -- the id the reviewer keys the book
  // footer suppression on -- is the same function that refuses a textless hit.
  const serviceSource = read('lib/lib-service.js');
  const producers = (serviceSource.match(/'lib:'\s*\+/g) || []).length;
  const dropLine = /const text = typeof hit\.text === 'string' \? hit\.text\.trim\(\) : '';\s*\n\s*if \(!text\) return null;/;
  ok('D6  the ONE producer of a `lib:` identity is the function that drops a textless hit',
    producers === 1 && dropLine.test(serviceSource), 'producers=' + producers);

  // MUTANT: let a textless hit through. The claim must become possible.
  const m2 = await mutantModule(temp, 'lib/lib-service.js', 'keep-textless',
    (src) => src.replace('  if (!text) return null;\n', '  if (false) return null;  // mutant-textless\n'),
    'if (false) return null;  // mutant-textless',
  ).then((mod) => ({ mod }), (error) => ({ error }));
  if (m2.error) {
    ok('D7  MUTANT KILLED: dropping the textless refusal lets a page-only atom become evidence',
      false, m2.error.message);
  } else {
    const leaked = await m2.mod.searchLibrary('q', {
      flagValue: 'on', token: FIXTURE_TOKEN, fetchImpl: libServing(textless),
    });
    const row = leaked.records && leaked.records[0];
    ok('D7  MUTANT KILLED: dropping the textless refusal lets a page-only atom become evidence',
      leaked.records.length === 1 && !!row && row.text === ''
        && String(row.id).indexOf('lib:') === 0
        && row.provenance.page_start === HIT.page_start
        && without.records.length === 0,
      JSON.stringify({ mutant: leaked.records.length, real: without.records.length }));
  }

  // ==========================================================================
  section('E. THE MATN THE ANSWER RESTED ON REACHES THE READER, AND ONLY IT');
  // ==========================================================================
  // WHAT THIS SECTION MEASURES THAT THE FOUR ABOVE DO NOT. B proves a book row becomes a chip. It
  // says nothing about the PASSAGE the answer actually leaned on, which as of piece 5 reached the
  // row (lib/free-brain/tools.js writes `text`) and died at the tag (api/ask.js buildBookTag read
  // three fields and not that one). So every claim here is a claim about rendered output, and it
  // is observed by rendering: the server's own tag, through the client's own parser, into the
  // client's own component, in a real DOM. Nothing below reads a source file for a verdict.
  //
  // THE TAGS ARE BUILT FIRST AND THE CLIENT IS BOOTED AFTER, deliberately. Booting the client
  // assigns global.window/document, and every ESM mutant this section needs is a SERVER module
  // that has no business being imported into a process that looks like a browser. So all six
  // server drives happen first, each one reduced to the one string that crosses the wire, and the
  // DOM is opened once, at the end, over strings.

  const contract = await esm('lib/lib-contract.js');
  const CEILING = contract.LIB_MAX_CHARS_PER_HIT_DEFAULT;

  // ── the measured ceiling, asserted rather than assumed ─────────────────────
  // lib/lib-service.js sends no `max_chars_per_hit`, so the service answers at its DEFAULT, and
  // lib/free-brain/tools.js clips a row at the same number under the name SNIPPET_CHARS. That
  // agreement is what makes 1200 the number that binds; LIB_MAX_CHARS_PER_HIT_CEILING caps a
  // request parameter this tree never sends, so it is not the ceiling anything actually meets.
  const toolsSource = read('lib/free-brain/tools.js');
  const snippet = Number((/const SNIPPET_CHARS = (\d+);/.exec(toolsSource) || [])[1]);
  ok('E0  the carried ceiling is the measured one: the row clip and the service default agree',
    Number.isFinite(CEILING) && snippet === CEILING
      && read('lib/lib-service.js').indexOf('max_chars_per_hit') !== -1
      && askSource.indexOf('LIB_MAX_CHARS_PER_HIT_DEFAULT') !== -1,
    JSON.stringify({ ceiling: CEILING, snippetChars: snippet }));

  // ── the six strings, each the whole of what its drive puts on the wire ─────
  const citedRow = cited[0];
  const realTag = tag;

  // E1's mutant: buildBookTag stops carrying the passage. This is the tree as it stood at
  // 768305f, so the mutant is not a hypothetical -- it is the defect this piece closes.
  const askNoMatn = await mutantModule(temp, 'api/ask.js', 'book-drops-matn', (src) => src.replace(
    '  const matnAttrs = carried ? ` matn="${carried}"` + (cut ? \' cut="1"\' : \'\') : \'\';',
    '  const matnAttrs = \'\';  // mutant-drops-matn',
  ), 'const matnAttrs = \'\';  // mutant-drops-matn').then((mod) => ({ mod }), (error) => ({ error }));

  // E2's mutant: the emptiness test goes, so a passage that is nothing at all still earns an
  // attribute -- and therefore a control the reader can press onto nothing.
  const askEmptyMatn = await mutantModule(temp, 'api/ask.js', 'book-carries-empty', (src) => src.replace(
    '  const carried = kept.trim() ? Buffer.from(kept, \'utf8\').toString(\'base64\') : \'\';',
    '  const carried = Buffer.from(kept || \' \', \'utf8\').toString(\'base64\');  // mutant-empty-matn',
  ), 'mutant-empty-matn').then((mod) => ({ mod }), (error) => ({ error }));

  // E3's mutant: the ceiling goes. A caller handing in more than the service can send would then
  // have all of it carried, and -- because the cut is measured by the slice -- carried in silence.
  const askNoCeiling = await mutantModule(temp, 'api/ask.js', 'book-no-ceiling', (src) => src.replace(
    '  const kept = matn.slice(0, LIB_MAX_CHARS_PER_HIT_DEFAULT);',
    '  const kept = matn;  // mutant-no-ceiling',
  ), 'const kept = matn;  // mutant-no-ceiling').then((mod) => ({ mod }), (error) => ({ error }));

  // E5's mutant: the second half of the locator gate goes, so an automatically numbered atom
  // gets a printed page again -- and the panel would head a passage with a page nobody can open.
  const toolsAutoPage = await mutantModule(temp, 'lib/free-brain/tools.js', 'auto-gets-a-page', (src) => src.replace(
    "    const citable = prov.page_citable === true && prov.numbering !== 'auto';",
    "    const citable = prov.page_citable === true;  // mutant-auto-page",
  ), 'mutant-auto-page').then((mod) => ({ mod }), (error) => ({ error }));

  const mutantsBuilt = [askNoMatn, askEmptyMatn, askNoCeiling, toolsAutoPage];
  ok('E-pre all four section-E mutants reached disk and imported',
    mutantsBuilt.every((m) => !m.error),
    mutantsBuilt.map((m) => (m.error ? m.error.message : 'ok')).join(' | '));

  const noMatnTag = askNoMatn.mod ? String(askNoMatn.mod.buildBookTag(citedRow).tag) : 'NO-TAG';

  // A row whose passage is EMPTY -- the shape E2 is about, handed straight to the builder.
  const emptyRow = Object.assign({}, citedRow, { text: '' });
  const emptyRealTag = String(ask.buildBookTag(emptyRow).tag);
  const emptyMutantTag = askEmptyMatn.mod ? String(askEmptyMatn.mod.buildBookTag(emptyRow).tag) : 'NO-TAG';

  // A passage LONGER than the measured ceiling. Built from one repeated letter so that a count of
  // characters is a count of the passage and not of anything the fixture happens to contain.
  const LONG = 'ح'.repeat(CEILING + 250);
  const longRow = Object.assign({}, citedRow, { text: LONG });
  const longTag = String(ask.buildBookTag(longRow).tag);
  const longNoCeilingTag = askNoCeiling.mod ? String(askNoCeiling.mod.buildBookTag(longRow).tag) : 'NO-TAG';

  // A THIRD RECORDED HIT, AND THE ONE THAT MAKES «no silent cut» MEAN SOMETHING WIDER. The
  // service can cut a passage before we ever see it and says so in `truncated`; that is a
  // different cut from ours and the SAME fact to a reader. lib/lib-service.js records it,
  // lib/free-brain/tools.js now carries it onto the row as `matnCut`, and the card must wear
  // the mark even though nothing on this side removed a character.
  const truncHit = FIXTURES.hit_truncated;
  const truncCtx = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: libServing(truncHit) });
  const truncOut = await quiet(() => tools.runTool('search_library', { query: 'q' }, truncCtx));
  const truncRow = truncOut.added[0];
  const truncTag = truncRow ? String(ask.buildBookTag(truncRow).tag) : 'NO-TAG';

  // The same recorded hit with ONE field changed: the numbering becomes automatic, which is the
  // condition under which the chip already refuses to print a place.
  const autoHit = Object.assign({}, HIT, { numbering: 'auto' });
  const autoCtx = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: libServing(autoHit) });
  const autoOut = await quiet(() => tools.runTool('search_library', { query: 'q' }, autoCtx));
  const autoRow = autoOut.added[0];
  const autoTag = autoRow ? String(ask.buildBookTag(autoRow).tag) : 'NO-TAG';

  let autoMutantTag = 'NO-TAG';
  if (toolsAutoPage.mod) {
    const mutCtx = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: libServing(autoHit) });
    mutCtx.table = toolsAutoPage.mod.createEvidenceTable();
    const mutOut = await quiet(() => toolsAutoPage.mod.runTool('search_library', { query: 'q' }, mutCtx));
    if (mutOut.added[0]) autoMutantTag = String(ask.buildBookTag(mutOut.added[0]).tag);
  }

  // E4: the brief turn, and the same turn with the offer forced open.
  const briefBook = loop.pickBookCards(brief.out ? brief.out.cited : [], 3, ask.buildBookTag);
  const loopAlwaysOffers = await mutantModule(temp, 'lib/free-brain/loop.js', 'always-offers-library',
    (src) => src.replace(
      "  const libOffered = libEligible === true && libFlagValue === 'on' && libToken !== '';",
      '  const libOffered = true;  // mutant-always-offers',
    ), 'const libOffered = true;  // mutant-always-offers').then((mod) => ({ mod }), (error) => ({ error }));

  let briefMutantOffered = [];
  if (loopAlwaysOffers.mod) {
    const stub = providerStub([TEXT_ROUND('جواب.')]);
    try {
      await quiet(() => loopAlwaysOffers.mod.runFreeBrainTurn(Object.assign(
        {}, TURN_BASE, OFF, { fetchImpl: libServing(HIT) },
      )));
    } finally { briefMutantOffered = stub.offered; stub.restore(); }
  }

  // ── the client, booted once, over those strings ────────────────────────────
  const client = await quiet(() => bootClient());

  const showFor = (serverTag) => client.show(
    'جوابٌ قصير.\n\n' + serverTag,
  );

  // ---- E1 --------------------------------------------------------------------
  const shownReal = showFor(realTag);
  shownReal.open();
  ok('E1  a cited atom WITH a matn: the touch opens, and what it opens is the passage that arrived',
    shownReal.buttons === 1
      && shownReal.exact(citedRow.text)
      && citedRow.text === HIT.text,
    ascii(JSON.stringify({ buttons: shownReal.buttons, shown: shownReal.matn(), arrived: citedRow.text })));

  ok('E1b ...and it was FOLDED until it was touched, and folds again when it is touched twice',
    shownReal.wasFoldedBeforeFirstTouch && (shownReal.close(), !shownReal.hasText(citedRow.text)),
    ascii(JSON.stringify({ folded: shownReal.wasFoldedBeforeFirstTouch })));

  const shownNoMatn = showFor(noMatnTag);
  ok('E1c MUTANT KILLED: buildBookTag stops carrying the passage and the reader loses the touch',
    shownNoMatn.buttons === 0 && !shownNoMatn.hasText(citedRow.text) && shownReal.buttons === 1,
    ascii(JSON.stringify({ mutantButtons: shownNoMatn.buttons, realButtons: shownReal.buttons })));

  // ---- E2 --------------------------------------------------------------------
  // The recorded hit minus one field, carried all the way to a screen.
  const shownTextless = showFor(bareTurn.out.text);
  const shownEmptyReal = showFor(emptyRealTag);
  ok('E2  an atom with NO `text` reaches the reader as no chip, no touch and no empty space',
    bareTurn.out.cited.length === 0
      && shownTextless.buttons === 0 && shownTextless.chips === 0
      && shownEmptyReal.buttons === 0 && shownEmptyReal.panels === 0,
    ascii(JSON.stringify({
      textlessButtons: shownTextless.buttons, textlessChips: shownTextless.chips,
      emptyRowButtons: shownEmptyReal.buttons, emptyRowPanels: shownEmptyReal.panels,
    })));

  const shownEmptyMutant = showFor(emptyMutantTag);
  ok('E2b MUTANT KILLED: carrying an empty passage anyway puts a control over nothing',
    shownEmptyMutant.buttons === 1 && shownEmptyReal.buttons === 0,
    ascii(JSON.stringify({ mutantButtons: shownEmptyMutant.buttons, realButtons: shownEmptyReal.buttons })));

  // ---- E3 --------------------------------------------------------------------
  const shownLong = showFor(longTag);
  shownLong.open();
  const cutNote = client.grab('BOOK_MATN_CUT_NOTE');
  ok('E3  a passage past the measured ceiling is cut AT it, and the cut is said out loud',
    shownLong.matn().length === CEILING
      && shownLong.matn() === LONG.slice(0, CEILING)
      && typeof cutNote === 'string' && cutNote.length > 0
      && shownLong.hasText(cutNote)
      && shownLong.matn().indexOf(cutNote) === -1,
    ascii(JSON.stringify({ shown: shownLong.matn().length, ceiling: CEILING, sent: LONG.length })));

  const shownLongNoCeiling = showFor(longNoCeilingTag);
  shownLongNoCeiling.open();
  ok('E3b MUTANT KILLED: without the ceiling the whole passage rides, and rides in silence',
    shownLongNoCeiling.matn().length === LONG.length
      && !shownLongNoCeiling.hasText(cutNote)
      && shownLong.matn().length === CEILING,
    ascii(JSON.stringify({ mutant: shownLongNoCeiling.matn().length, real: shownLong.matn().length })));

  const shownTrunc = showFor(truncTag);
  shownTrunc.open();
  ok('E3c a passage the SERVICE cut wears the mark too, though nothing on this side cut it',
    !!truncRow && truncHit.truncated === true
      && truncRow.text.length < CEILING
      && shownTrunc.exact(truncRow.text)
      && shownTrunc.hasText(cutNote),
    ascii(JSON.stringify({
      serviceSaidTruncated: truncHit.truncated, weCut: truncRow && truncRow.text.length >= CEILING,
      markShown: shownTrunc.hasText(cutNote),
    })));

  // ---- E4 --------------------------------------------------------------------
  const shownBrief = showFor(brief.out.text);
  ok('E4  a brief turn shows zero book chips and zero passage, exactly as it did before this piece',
    briefBook.length === 0 && shownBrief.chips === 0 && shownBrief.buttons === 0
      && shownBrief.panels === 0 && brief.out.text.indexOf('<book') === -1,
    ascii(JSON.stringify({ cards: briefBook.length, chips: shownBrief.chips })));

  ok('E4b MUTANT KILLED: forcing the offer open puts search_library on a brief turn\'s wire',
    !loopAlwaysOffers.error
      && briefMutantOffered.length > 0
      && briefMutantOffered.every((names) => names.includes('search_library'))
      && brief.offered.every((names) => !names.includes('search_library')),
    JSON.stringify({ mutant: briefMutantOffered[0] || [], real: brief.offered[0] || [] }));

  // ---- E5 --------------------------------------------------------------------
  const shownAuto = showFor(autoTag);
  shownAuto.open();
  const DIGITS = [String(HIT.volume), String(HIT.page_start), String(HIT.page_end)];
  ok('E5  an automatically numbered atom shows its passage under NO page it refused to print',
    !!autoRow && shownAuto.buttons === 1
      && shownAuto.exact(autoRow.text)
      && DIGITS.every((d) => !shownAuto.allText().includes(d))
      && !/ref=/.test(autoTag),
    ascii(JSON.stringify({ tag: autoTag, shown: shownAuto.allText().slice(0, 120) })));

  const shownAutoMutant = showFor(autoMutantTag);
  shownAutoMutant.open();
  ok('E5b MUTANT KILLED: dropping the automatic-numbering half heads the passage with a page',
    autoMutantTag !== 'NO-TAG'
      && DIGITS.some((d) => shownAutoMutant.allText().includes(d))
      && DIGITS.every((d) => !shownAuto.allText().includes(d)),
    ascii(JSON.stringify({ mutantTag: autoMutantTag })));

  // ---- E6 --------------------------------------------------------------------
  // The poison was installed before section A and has been under every drive since, the client
  // boot and every render included. A guard that reached a real host would have thrown by now.
  ok('E6  the whole guard ran with globalThis.fetch poisoned and never once touched it',
    poisoned.calls === 0, 'poisoned fetch invoked ' + poisoned.calls + ' time(s)');

  const toolsGlobalFetch = await mutantModule(temp, 'lib/free-brain/tools.js', 'library-uses-global-fetch',
    (src) => src.replace(
      '      fetchImpl: ctx.fetchImpl,\n      signal: ctx.signal,',
      '      fetchImpl: undefined,  // mutant-global-fetch\n      signal: ctx.signal,',
    ), 'mutant-global-fetch').then((mod) => ({ mod }), (error) => ({ error }));
  let poisonReached = -1;
  if (toolsGlobalFetch.mod) {
    const before = poisoned.calls;
    const leakCtx = ctx({ libFlagValue: 'on', libToken: FIXTURE_TOKEN, fetchImpl: libServing(HIT) });
    leakCtx.table = toolsGlobalFetch.mod.createEvidenceTable();
    await quiet(() => toolsGlobalFetch.mod.runTool('search_library', { query: 'q' }, leakCtx));
    poisonReached = poisoned.calls - before;
    poisoned.calls = before;   // the mutant's reach is measured, not carried into E6's own claim
  }
  ok('E6b MUTANT KILLED: bypassing the injected seam sends the library at the real global fetch',
    poisonReached === 1, 'poisoned fetch reached ' + poisonReached + ' time(s) by the mutant');


  try { fs.rmSync(temp, { recursive: true, force: true }); } catch (error) { /* scratch only */ }

  console.log('\n=== lib-book-contract: ' + (checks - failures) + '/' + checks
    + ' checks, ' + failures + ' failure(s) ===');
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.log('  FAIL  guard aborted: ' + ascii(error && error.stack ? error.stack : error));
  process.exitCode = 1;
});
