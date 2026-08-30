// guards/lessons-search-guard.cjs -- the lessons search function and the lesson source card.
//
// == THREE TRAPS IN THE MEASURED CONTRACT, WRITTEN AT THE HEAD BY ORDER =========
//
//   1. `scholar_id` IS NOT AN IDENTIFIER. It is the scholar's Arabic display name; the service
//      names the field that way for historical reasons inside its own contract. Anyone who
//      treats it as a key -- joins on it, slugs it, looks it up in a table -- has built on
//      something that was never there.
//
//   2. `snippet` IS NEVER READ, NEVER PASSED, NEVER STORED. The service sends it empty in 97.6%
//      of hits and filled in 2.4%, and the owner's ruling is that lesson text is not displayed
//      at all. api/lessons-search.js is the edge of the tree and the field is deleted THERE. The
//      first assertion of this guard exists to prove that deletion against a service that sends
//      a FILLED one.
//
//   3. `content_type` IS ONE OF ELEVEN MEASURED KINDS. A value outside the eleven is treated as
//      an ABSENCE, not as a twelfth kind, and it is never translated here: wording a kind for a
//      screen is the interface's business, and this round has no interface.
//
// == WHAT THIS GUARD IS FOR ====================================================
// Item 150 added one server function (api/lessons-search.js) and one pure builder
// (lib/lessons-source-card.js), and deliberately wired neither into any answer path. ITEM 24-A
// LATER WIRED A TAIL CARD INTO app.jsx, AND THE OWNER ORDERED THAT CARD REMOVED ON 2026-08-30:
// it is gone from app.jsx and from the bundle, and section 5 no longer asserts it. Sections
// 1-4, 6 and 7 are unchanged and still hold the server side; the reader surfaces of items 24-B
// and 24-C are untouched, and 5B and 5C below still prove them. This guard proves, WITHOUT A
// NETWORK CALL and without a real token -- the agent that wrote it has neither. It stubs
// `globalThis.fetch`, which is the single seam every outbound call in this repo passes through,
// and drives the real exported handler against local fixtures shaped after the measured
// contract.
//
//   1. the function returns no `snippet`, EVEN WHEN THE SERVICE SENDS A FILLED ONE
//   2. the card carries the four named fields and no fifth -- keys counted against the list
//   3. the card invents nothing when a field is absent
//   4. a `content_type` outside the eleven is an absence
//   5. THE INTERFACE FILES: index.html, quest.html and sw.js still name nothing of this round,
//      and app.jsx no longer carries the tail card at all -- item 24-A was removed by owner
//      order on 2026-08-30, so what is proved here is its ABSENCE (see the note at section 5)
//   5B. THE LESSONS SECTION (item 24-B): one screen key, one navigation entry, the same
//      three-field whitelist proved by set equality, a cancellable call, and the three
//      states a screen owes a reader that a tail card does not
//   5C. THE BROWSE PANE (item 24-C): the same section grown a second tab -- scholar, then
//      series, then lessons -- with a written whitelist per LEVEL proved by set equality
//      against fixtures that carry the body fields, the loose-lessons bucket proved last, a
//      cancellable call with a generation behind it, a one-rung ladder and a pager whose ends
//      are disabled rather than hidden
//   6. ZERO change to the four library-search files -- fingerprints taken before and after
//   7. the token appears in no output on any error path
//
// Each of 1, 3 and 4 carries a MUTANT: the real source is mutated in memory, the mutation is
// proved to have changed the source (a no-op mutant reports a false PASS), the mutated module is
// driven, and the assertion is shown to bite. The file on disk is re-read afterwards and proved
// unchanged.
//
// The fixture token is `tk-lsn-7`: deliberately under sixteen characters, because the repo's
// recon secret scanner treats a 16+ character token-shaped literal as a real leaked credential
// and would red a gate over a test fixture.
//
// Output is ASCII only, by order.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const scan = require('./telemetry-scan-lib.cjs');

const REPO = path.resolve(__dirname, '..');
const fileUrl = (rel) => 'file://' + path.join(REPO, rel).replace(/\\/g, '/');
const esm = (rel) => import(fileUrl(rel));
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaOf = (rel) => sha256(fs.readFileSync(path.join(REPO, rel)));

const FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lessons-search.json'), 'utf8'));

// A token that is not a token: short enough that the secret scanner reads it as the fixture it
// is, distinctive enough that a substring search for it is meaningful.
const FIXTURE_TOKEN = 'tk-lsn-7';

// The marker planted in every fixture snippet. Latin, shouted, and impossible to mistake for
// lesson text -- which is the point: no lesson text appears in this round at all.
const SNIPPET_MARKER = 'SNIPPET-FIXTURE-FILLED-DO-NOT-DISPLAY';

// The four files of the library-search round. This round reads them as a model and changes not
// one byte of any of them.
const COMPREHENSIVE = Object.freeze([
  'api/lib-search.js',
  'lib/lib-source-card.js',
  'guards/lib-search-16a-guard.cjs',
  'guards/fixtures-lib-search-16a.json'
]);

// The names this round introduces. None of them may appear in the interface.
const NEW_NAMES = Object.freeze(['lessons/search', 'lessons-search', 'lessons-source-card']);

let checks = 0;
let failures = 0;
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '?');
function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log('  PASS  ' + name);
    return true;
  }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + ascii(detail) : ''));
  return false;
}

// -- a response object shaped like the one Vercel hands a function ---------------
function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.end = () => res;
  return res;
}

// -- drive the real handler with a stubbed fetch and a captured console ----------
// Returns everything an assertion could want: the response, every outbound call with its
// headers and body, and every line the function logged.
async function drive(handler, { body, method = 'POST', token = FIXTURE_TOKEN, upstream }) {
  const calls = [];
  const logs = [];
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  const realError = console.error;
  const hadToken = Object.prototype.hasOwnProperty.call(process.env, 'SEARCH_API_TOKEN');
  const priorToken = process.env.SEARCH_API_TOKEN;

  if (token === null) delete process.env.SEARCH_API_TOKEN;
  else process.env.SEARCH_API_TOKEN = token;

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const reply = typeof upstream === 'function' ? upstream(calls.length) : upstream;
    if (reply instanceof Error) throw reply;
    const payload = reply?.payload;
    return {
      status: reply?.status ?? 200,
      ok: (reply?.status ?? 200) >= 200 && (reply?.status ?? 200) < 300,
      headers: { get: () => null },
      json: async () => {
        if (reply && reply.unreadable) throw new Error('Unexpected token in JSON');
        return payload;
      }
    };
  };
  console.warn = (...args) => { logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
  console.error = console.warn;

  const res = makeRes();
  try {
    await handler({ method, body, query: {}, headers: {} }, res);
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    console.error = realError;
    if (hadToken) process.env.SEARCH_API_TOKEN = priorToken;
    else delete process.env.SEARCH_API_TOKEN;
  }
  return { res, calls, logs };
}

// Load a mutated copy of a repo module without writing it to disk. The import specifier is
// rewritten to an absolute file:// URL because a data: module has no base to resolve '../' from.
async function loadMutant(source, specifierMap) {
  let resolved = source;
  const SQ = String.fromCharCode(39);
  for (const [from, rel] of Object.entries(specifierMap)) {
    resolved = resolved.split(from).join(SQ + fileUrl(rel) + SQ);
  }
  return import('data:text/javascript;base64,' + Buffer.from(resolved, 'utf8').toString('base64'));
}

const serialize = (value) => JSON.stringify(value ?? null);
const mentionsToken = (value) => serialize(value).includes(FIXTURE_TOKEN);

(async function main() {
  console.log('=== lessons-search-guard -- the lessons call, and the card it draws ===');

  // == ASSERTION 6, FIRST HALF. The four library-search files, before anything runs. ==========
  const beforeShas = COMPREHENSIVE.map((rel) => ({ rel, sha: shaOf(rel), bytes: fs.statSync(path.join(REPO, rel)).size }));

  const cardMod = await esm('lib/lessons-source-card.js');
  const api = await esm('api/lessons-search.js');
  const handler = api.default;
  const { buildLessonCard, isKnownContentType, HIT_FIELDS, CARD_FIELDS, CARD_FORBIDDEN_FIELDS,
    CONTENT_TYPES, DROPPED_HIT_FIELD } = cardMod;

  const apiSrc = readRepo('api/lessons-search.js');
  const cardSrc = readRepo('lib/lessons-source-card.js');

  // == A. THE CONTRACT IS THE MEASURED ONE, NOT A REMEMBERED ONE =============================
  console.log('\n=== A. THE MEASURED CONTRACT ===');
  check('a lessons hit carries exactly 10 fields', HIT_FIELDS.length === 10, 'got ' + HIT_FIELDS.length);
  check('...and they are the ten measured names, in the measured order',
    HIT_FIELDS.join(',') === 'unit_id,scholar_id,title,url,tier,usage,citation_allowed,content_type,snippet,score',
    HIT_FIELDS.join(','));
  check('content_type has exactly 11 measured kinds', CONTENT_TYPES.length === 11, 'got ' + CONTENT_TYPES.length);
  check('...and they are the eleven measured kinds',
    CONTENT_TYPES.slice().sort().join(',')
      === 'audio,benefit,clip,discussion,explanation,fatwa,lecture,lesson,live,sermon,video',
    CONTENT_TYPES.join(','));
  check('the field deleted at the edge of the tree is named snippet', DROPPED_HIT_FIELD === 'snippet',
    String(DROPPED_HIT_FIELD));
  check('the nine returned names are the ten less snippet',
    api.RETURNED_HIT_FIELDS.length === 9 && !api.RETURNED_HIT_FIELDS.includes('snippet')
      && HIT_FIELDS.filter((f) => f !== 'snippet').join(',') === api.RETURNED_HIT_FIELDS.join(','),
    api.RETURNED_HIT_FIELDS.join(','));
  check('the function adds nothing of its own to the hit',
    api.RETURNED_HIT_FIELDS.every((f) => HIT_FIELDS.includes(f)), api.RETURNED_HIT_FIELDS.join(','));
  check('scholar_id is documented as a display name, not an identifier',
    apiSrc.includes('NOT AN IDENTIFIER') && apiSrc.includes('display name')
      && cardSrc.includes('NOT AN IDENTIFIER') && cardSrc.includes('display name'));

  // == 1. THE SNIPPET IS NEVER RETURNED, EVEN WHEN THE SERVICE SENDS A FILLED ONE =============
  console.log('\n=== 1. NO SNIPPET REACHES THE CLIENT, EVEN FILLED ===');
  const filledPayload = { hits: [FIXTURES.hit_snippet_filled, FIXTURES.hit_snippet_empty, FIXTURES.hit_missing_fields] };
  check('the fixture really does carry a FILLED snippet - the strip is not measuring nothing',
    FIXTURES.hit_snippet_filled.snippet === SNIPPET_MARKER && SNIPPET_MARKER.length > 0);
  check('...and a second fixture carries an EMPTY one, which is the 97.6% case',
    FIXTURES.hit_snippet_empty.snippet === '');
  const filled = await drive(handler, { body: { q: 'q-fixture', limit: 5 }, upstream: { status: 200, payload: filledPayload } });
  check('status is 200', filled.res.statusCode === 200, 'got ' + filled.res.statusCode);
  check('three hits came back', Array.isArray(filled.res.body.hits) && filled.res.body.hits.length === 3,
    String((filled.res.body.hits || []).length));
  check('NO hit carries a key named snippet',
    filled.res.body.hits.length === 3 && filled.res.body.hits.every((hit) => !('snippet' in hit)),
    filled.res.body.hits.map((h) => Object.keys(h).join('+')).join(' | '));
  check('the filled snippet text appears nowhere in the response body',
    !serialize(filled.res.body).includes(SNIPPET_MARKER));
  check('...nor anywhere in the logs', !filled.logs.join(' ').includes(SNIPPET_MARKER));
  check('every other measured field DID survive - this is a strip, not a truncation',
    api.RETURNED_HIT_FIELDS.every((f) => (FIXTURES.hit_snippet_filled[f] !== undefined)
      ? (f in filled.res.body.hits[0]) : true),
    Object.keys(filled.res.body.hits[0]).join(','));
  check('an unmeasured hit field is dropped in silence', !('internal_offset' in filled.res.body.hits[0]));

  // THE MUTANT: let snippet through the whitelist.
  const SMUT_FROM = "HIT_FIELDS.filter((f) => f !== DROPPED_HIT_FIELD)";
  const SMUT_TO = "HIT_FIELDS.filter((f) => true)";
  const snippetMutantSrc = apiSrc.split(SMUT_FROM).join(SMUT_TO);
  check('the snippet mutant is a real mutation, not a no-op',
    snippetMutantSrc !== apiSrc && snippetMutantSrc.includes(SMUT_TO),
    'the anchor ' + SMUT_FROM + ' matched nothing');
  const snippetMutant = await loadMutant(snippetMutantSrc, { "'../lib/lessons-source-card.js'": 'lib/lessons-source-card.js' });
  const mutantBody = snippetMutant.shapeSearchResponse(filledPayload);
  check('THE GUARD BITES: the mutated function returns the filled snippet',
    ('snippet' in mutantBody.hits[0]) && serialize(mutantBody).includes(SNIPPET_MARKER),
    'the mutant returned ' + Object.keys(mutantBody.hits[0]).join(',') + ' and the assertion still passed');
  check('...and the real function, re-read after the mutation, is unchanged',
    readRepo('api/lessons-search.js') === apiSrc);

  // == 2. THE CARD CARRIES THE FOUR NAMED FIELDS AND NO FIFTH ================================
  console.log('\n=== 2. THE CARD IS FOUR FIELDS, COUNTED AGAINST THE LIST ===');
  check('the declared card list is exactly the four named fields',
    CARD_FIELDS.join(',') === 'title,scholar_id,url,content_type', CARD_FIELDS.join(','));
  check('the declared forbidden list is exactly the six named fields',
    CARD_FORBIDDEN_FIELDS.slice().sort().join(',') === 'citation_allowed,score,snippet,tier,unit_id,usage',
    CARD_FORBIDDEN_FIELDS.join(','));
  const fullCard = buildLessonCard(FIXTURES.hit_snippet_filled);
  check('the card was built', fullCard !== null && typeof fullCard === 'object');
  check('the card keys, counted and compared to the list letter for letter',
    Object.keys(fullCard).sort().join(',') === CARD_FIELDS.slice().sort().join(','),
    Object.keys(fullCard).join(','));
  check('the card key COUNT is four', Object.keys(fullCard).length === 4, String(Object.keys(fullCard).length));
  for (const forbidden of CARD_FORBIDDEN_FIELDS) {
    check('the card carries no ' + forbidden,
      !(forbidden in fullCard) && FIXTURES.hit_snippet_filled[forbidden] !== undefined,
      'the hit did carry it: ' + serialize(FIXTURES.hit_snippet_filled[forbidden]));
  }
  check('the snippet text is nowhere in the card', !serialize(fullCard).includes(SNIPPET_MARKER));
  check('the score is nowhere in the card', !serialize(fullCard).includes('5507'));
  check('scholar_id on the card is the display name the hit carried, unaltered',
    fullCard.scholar_id === FIXTURES.hit_snippet_filled.scholar_id
      && typeof fullCard.scholar_id === 'string' && fullCard.scholar_id.length > 0);
  check('the card is built from the hit and never from a snippet the card cannot see',
    !cardSrc.includes("carry(card, hit, 'snippet')") && cardSrc.includes("carry(card, hit, 'title')"));

  // == 3. AN ABSENT FIELD STAYS ABSENT -- THE CARD INVENTS NOTHING ============================
  console.log('\n=== 3. ABSENCE IS CARRIED ACROSS AS ABSENCE ===');
  const gaps = FIXTURES.hit_missing_fields;
  check('the fixture really is missing scholar_id, url and content_type',
    !('scholar_id' in gaps) && !('url' in gaps) && !('content_type' in gaps));
  check('...and really does carry a title, so the builder is not simply failing',
    typeof gaps.title === 'string' && gaps.title.length > 0);
  const gapCard = buildLessonCard(gaps);
  check('the card carries the title it was given', gapCard.title === gaps.title);
  check('the card has NO scholar_id key at all', !('scholar_id' in gapCard), Object.keys(gapCard).join(','));
  check('the card has NO url key at all', !('url' in gapCard), Object.keys(gapCard).join(','));
  check('the card has NO content_type key at all', !('content_type' in gapCard), Object.keys(gapCard).join(','));
  check('nothing was substituted for the missing values - no empty string, no null, no placeholder',
    Object.values(gapCard).every((v) => v !== '' && v !== null && v !== undefined),
    serialize(gapCard));
  check('a null value is an absence too, not a value',
    !('url' in buildLessonCard({ title: 'T', url: null })));
  check('a hit that is not an object yields no card at all',
    buildLessonCard(null) === null && buildLessonCard('x') === null && buildLessonCard(undefined) === null);

  // THE MUTANT: fill the gap with an empty string instead of leaving it absent.
  const IMUT_FROM = "  carry(card, hit, 'url');";
  const IMUT_TO = "  card.url = has(hit, 'url') ? hit.url : '';";
  const inventMutantSrc = cardSrc.split(IMUT_FROM).join(IMUT_TO);
  check('the invention mutant is a real mutation, not a no-op',
    inventMutantSrc !== cardSrc && inventMutantSrc.includes(IMUT_TO),
    'the anchor matched nothing');
  const inventMutant = await loadMutant(inventMutantSrc, {});
  const inventedCard = inventMutant.buildLessonCard(gaps);
  check('THE GUARD BITES: the mutated builder invents a url the hit never carried',
    ('url' in inventedCard) && inventedCard.url === '',
    'the mutant produced ' + serialize(inventedCard) + ' and the assertion still passed');
  check('...and the real builder, re-read after the mutation, is unchanged',
    readRepo('lib/lessons-source-card.js') === cardSrc);

  // == 4. A CONTENT_TYPE OUTSIDE THE ELEVEN IS AN ABSENCE ====================================
  console.log('\n=== 4. AN UNMEASURED CONTENT_TYPE IS AN ABSENCE, NOT A TWELFTH KIND ===');
  for (const kind of CONTENT_TYPES) {
    check('a measured kind is recognised: ' + kind, isKnownContentType(kind) === true);
  }
  const strange = FIXTURES.hit_unknown_content_type;
  check('the fixture kind is genuinely outside the eleven',
    typeof strange.content_type === 'string' && strange.content_type.length > 0
      && !CONTENT_TYPES.includes(strange.content_type), String(strange.content_type));
  const strangeCard = buildLessonCard(strange);
  check('the unmeasured kind produces NO content_type key on the card',
    !('content_type' in strangeCard), Object.keys(strangeCard).join(','));
  check('...and the unmeasured kind name is nowhere in the card',
    !serialize(strangeCard).includes(strange.content_type));
  check('...while the rest of the card is still built', strangeCard.title === strange.title
    && strangeCard.url === strange.url && strangeCard.scholar_id === strange.scholar_id);
  const nonString = buildLessonCard(FIXTURES.hit_nonstring_content_type);
  check('a non-string content_type is an absence too',
    !('content_type' in nonString) && FIXTURES.hit_nonstring_content_type.content_type === 11,
    Object.keys(nonString).join(','));
  check('a measured kind DOES reach the card - the rule is a filter, not a deletion',
    buildLessonCard(FIXTURES.hit_snippet_filled).content_type === 'lesson');
  check('no Arabic wording is attached to any kind in either new module',
    CONTENT_TYPES.every((k) => !new RegExp(k + "\\s*:\\s*['\"]").test(cardSrc))
      && !/CONTENT_TYPE_LABELS|KIND_LABELS/.test(cardSrc + apiSrc));

  // THE MUTANT: carry content_type through without checking it against the eleven.
  const CMUT_FROM = "  if (isKnownContentType(hit && hit.content_type)) card.content_type = hit.content_type;";
  const CMUT_TO = "  carry(card, hit, 'content_type');";
  const kindMutantSrc = cardSrc.split(CMUT_FROM).join(CMUT_TO);
  check('the content_type mutant is a real mutation, not a no-op',
    kindMutantSrc !== cardSrc && kindMutantSrc.includes(CMUT_TO), 'the anchor matched nothing');
  const kindMutant = await loadMutant(kindMutantSrc, {});
  const kindMutantCard = kindMutant.buildLessonCard(strange);
  check('THE GUARD BITES: the mutated builder repeats a kind this repo cannot vouch for',
    kindMutantCard.content_type === strange.content_type,
    'the mutant produced ' + serialize(kindMutantCard) + ' and the assertion still passed');
  check('...and the real builder, re-read after the second mutation, is still unchanged',
    readRepo('lib/lessons-source-card.js') === cardSrc);

  // == 5. THE INTERFACE FILES, AND THE CARD THAT IS NO LONGER THERE =========================
  //
  // Item 150 shipped the server function with NO INTERFACE ON PURPOSE and this section proved
  // that absence. Item 24-A then built a tail card and this section was rewritten to prove its
  // shape. On 2026-08-30 THE OWNER ORDERED THE TAIL CARD REMOVED, and every assertion about it
  // was cut with it -- a check that outlives its subject goes red for the one reason a red must
  // never mean. What stays is what is still true: the files that name nothing, the two shared
  // whitelists that 5B and 5C read, the bundle handle, and the ABSENCE of the removed names
  // from the built bundle. The reader surfaces of 24-B and 24-C are untouched below.
  console.log('\n=== 5. THE INTERFACE FILES: NOTHING NAMED, AND NO TAIL CARD ===');

  // -- 5a. the three files that still name nothing ------------------------------------------
  // index.html carries no application source since round 28 -- the page loads app.js -- so a
  // mention here would mean a second, hand-written path to the same service.
  const indexHtml = readRepo('index.html');
  check('index.html was actually read', indexHtml.length > 100000, String(indexHtml.length));
  for (const name of NEW_NAMES) {
    check('index.html does not mention ' + name, indexHtml.indexOf(name) === -1 && indexHtml.length > 0);
  }
  check('index.html does not mention the lessons service address',
    indexHtml.indexOf('lib.ezik.app/lessons') === -1 && indexHtml.length > 0);
  const questHtml = readRepo('quest.html');
  check('quest.html was actually read', questHtml.length > 1000, String(questHtml.length));
  check('quest.html mentions none of the new names',
    NEW_NAMES.every((name) => questHtml.indexOf(name) === -1),
    NEW_NAMES.filter((name) => questHtml.indexOf(name) !== -1).join(','));
  check('no interface file was added to the service worker CORE either',
    readRepo('sw.js').indexOf('lessons') === -1);
  // The client never speaks to the service directly: the token is the whole gate and it lives in
  // api/lessons-search.js. The interface calls the FUNCTION, never the upstream address.
  const appJsx = readRepo('app.jsx');
  check('app.jsx was actually read', appJsx.length > 100000, String(appJsx.length));
  check('app.jsx never names the lessons service address itself',
    appJsx.indexOf('lib.ezik.app/lessons') === -1);

  // -- 5b. the two blocks the wiring lives in, cut out by their own markers -------------------
  // Comments are stripped before any absence is asserted: this round's prose NAMES the seven
  // fields it refuses to draw, and a check that read the prose would call that a violation.
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
  // -- 5b. THE TWO WHITELISTS, KEPT BECAUSE 5B AND 5C READ THEM -----------------------------
  // They were written for the tail card and outlived it. snippet comes first, because it is the
  // field the server deletes at its own edge and the one a future service is most likely to
  // send back under another name; then the six the contract DOES send and no reader surface may
  // draw -- score, unit_id, tier, usage, citation_allowed, content_type. The link is the end of
  // it, so no quote and no excerpt is drawn on any surface.
  const FORBIDDEN_IN_DRAW = ['snippet', 'excerpt', 'matn', 'score', 'unit_id', 'tier',
    'usage', 'citation_allowed', 'content_type'];
  // The whitelist has to be WRITTEN, not derived: an enumerating reader would draw a text field
  // the day the service grows one, without a person ever having typed its name.
  const ENUMERATORS = ['Object.keys', 'Object.entries', 'Object.values', 'for (const k in',
    'for (let k in', 'JSON.stringify(hit'];
  // -- 5e. the built bundle is the one this source builds -----------------------------------
  // Gate babel proves app.js === build(app.jsx) byte for byte. This is the cheaper half of the
  // same statement, kept here so a stale bundle cannot pass a guard whose subject is the
  // interface: a reader is served app.js, not app.jsx.
  const appJs = readRepo('app.js');
  check('app.js was actually read', appJs.length > 100000, String(appJs.length));
  // The two names the removed card owned are gone from the source, so they must be gone from
  // the bundle too -- the stronger half of the removal, asserted on the file a reader is served.
  for (const marker of ['ezikLessonRows', 'EzikLessonCards']) {
    check('the built bundle no longer carries ' + marker, appJs.indexOf(marker) === -1);
  }

  // == 5B. THE LESSONS SECTION, AS ITEM 24-B BUILT IT ========================================
  //
  // Item 24-A wired the tail CARD. Item 24-B adds the SECTION -- a screen the reader chooses,
  // with a search box, a list of links and nothing else. The two share a route and a ruling
  // («بحثٌ فقط») and share no code: the card's block is capped at three rows and eight
  // seconds, the screen's at ten and twelve, and each carries its own whitelist written out by
  // hand. Section 5 above is untouched by this one, and this one never reads the card's block.
  console.log('\n=== 5B. THE LESSONS SECTION: ONE SCREEN, THREE FIELDS, THREE STATES ===');

  // -- the screen's block, cut out by its own sentinels ------------------------------------
  const SCREEN_START = '// ITEM 24-B -- THE LESSONS SECTION';
  const SCREEN_END = '// ITEM 24-B -- END OF THE LESSONS SECTION';
  const screenFrom = appJsx.indexOf(SCREEN_START);
  const screenTo = appJsx.indexOf(SCREEN_END);
  check('the lessons section is present and bounded by its own sentinels',
    screenFrom !== -1 && screenTo > screenFrom, 'from=' + screenFrom + ' to=' + screenTo);
  const screenCode = stripComments(appJsx.slice(screenFrom, screenTo));
  check('the section is a real block of code, not a comment', screenCode.length > 2000,
    String(screenCode.length));
  // The tail card is gone, so there is no second region left to overlap with: what is asserted
  // now is that nothing of item 24-A survived in the file this section is cut out of.
  check('no trace of the removed tail card is left in app.jsx',
    appJsx.indexOf('ITEM 24-A') === -1 && appJsx.indexOf('EzikLessonCards') === -1
    && appJsx.indexOf('EZIK_LESSONS_ENDPOINT') === -1);

  // -- 5B-1. THE ORDER'S FIRST DEMAND: registered, and ONE way in ---------------------------
  check('the app renders the screen on its own key',
    /if \(screen === 'lessons'\) return <LessonsScreen onBack=\{goEzikBack\} \/>;/.test(appJsx));
  check('...and that key is compared in exactly one place',
    (appJsx.match(/screen === 'lessons'/g) || []).length === 1,
    String((appJsx.match(/screen === 'lessons'/g) || []).length));
  // -- THE SLICES THE LESSONS ROUTES ARE ALLOWED TO LIVE IN --------------------------------
  // Measured 2026-08-23 by READING the code, not by matching a pattern across the file: the
  // home module array is the literal ezHomeModules(v) returns (app.jsx L3361-L3369); the
  // section suggestions are the `sectionSuggestions` literal (L9089-L9093); and the home CARD
  // does not call setScreen itself -- its row carries `onClick: v.onOpenLessons` and the one
  // <Home> element wires that prop, so the card's route lives in the `screen === 'home'` return
  // block (L9855-L9860). Each opening token below occurs EXACTLY once in the file and
  // sliceBetween returns null if that stops being true; the closer is the first terminator
  // after it. A boundary that stops matching fails the next check rather than silently cutting
  // the wrong region and calling it clean.
  const sliceBetween = (openTok, closeTok) => {
    const a = appJsx.indexOf(openTok);
    if (a === -1 || appJsx.indexOf(openTok, a + 1) !== -1) return null;
    const b = appJsx.indexOf(closeTok, a + openTok.length);
    if (b === -1) return null;
    return appJsx.slice(a, b + closeTok.length);
  };
  const homeModulesSlice = sliceBetween('function ezHomeModules(v) {', '\n  ];');
  const sectionSuggestSlice = sliceBetween('const sectionSuggestions = [', '\n  ];');
  const homeRenderSlice = sliceBetween("if (screen === 'home') return (", '\n  );');
  check('the three slices that account for the lessons routes were each cut from a unique boundary',
    Boolean(homeModulesSlice && sectionSuggestSlice && homeRenderSlice),
    'modules=' + (homeModulesSlice || 'NULL').length + ' suggestions='
    + (sectionSuggestSlice || 'NULL').length + ' homeRender=' + (homeRenderSlice || 'NULL').length);
  // (1) THE ROW, counted INSIDE the home module array and nowhere else. A lessons row added to
  // some other array is no longer counted as this one, and no longer hides this one's absence.
  check('the home module array holds exactly one lessons row, counted inside that array alone',
    (String(homeModulesSlice).match(/\{ id: 'lessons',/g) || []).length === 1,
    String((String(homeModulesSlice).match(/\{ id: 'lessons',/g) || []).length));
  // (2) THE ROUTES, BY NAME. Until item B there was one way into the screen and a bare `=== 1`
  // said so. The owner has since ordered a second, deliberate entry point, and a count cannot
  // express two legitimate routes without also blessing a third. The count is therefore
  // replaced by an ACCOUNTING: every route is named here with the slice it must live in, and
  // no call may exist that this list does not account for. The invariant is not "one call
  // exists" -- it is that NO ROUTE INTO THE LESSONS SCREEN EXISTS THAT IS NOT ACCOUNTED FOR BY
  // NAME. The second route is `required: false` because the guard ships one commit ahead of the
  // entry: it must pass both before the entry lands and after, and fail on anything else.
  const LESSONS_ROUTES = [
    { name: 'the home module card handler, wired on the one <Home> element',
      slice: homeRenderSlice, required: true },
    { name: 'the section-suggestions entry',
      slice: sectionSuggestSlice, required: false },
  ];
  const routeCounts = LESSONS_ROUTES.map(
    (r) => (String(r.slice).match(/setScreen\('lessons'\)/g) || []).length);
  const routeReport = LESSONS_ROUTES.map((r, i) => r.name + '=' + routeCounts[i]).join('; ');
  const accountedCalls = routeCounts.reduce((a, b) => a + b, 0);
  const totalCalls = (appJsx.match(/setScreen\('lessons'\)/g) || []).length;
  check('each named lessons route holds at most one call, and the required route holds its own',
    routeCounts.every((n, i) => n <= 1 && (!LESSONS_ROUTES[i].required || n === 1)),
    routeReport);
  check('...and NO call into the lessons screen exists that the named routes do not account for',
    totalCalls === accountedCalls,
    'in file=' + totalCalls + ' accounted by name=' + accountedCalls + ' (' + routeReport + ')');
  check('the row is built in the ONE module array, beside the fatwa row it is modelled on',
    /\{ id: 'fatwa',[^\n]*\n\s*\{ id: 'lessons',/.test(appJsx));
  // THE REGISTERS. 'lessons' belongs to NEITHER, and that is the same answer 'fatwa' gets:
  // ezikBackTarget is an exception table, not a directory, and its final fall-through («Every
  // feature section: home, never the chat») is what routes both. A third register, or either
  // screen appearing in one of these two, is what this catches.
  const registerOf = (name) => {
    const m = appJsx.match(new RegExp('const ' + name + ' = \\[([^\\]]*)\\]'));
    return m ? m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean) : null;
  };
  const roots = registerOf('EZIK_ROOT_SCREENS');
  const sheets = registerOf('EZIK_SHEET_SCREENS');
  check('both screen registers were read', Array.isArray(roots) && Array.isArray(sheets),
    JSON.stringify(roots) + ' / ' + JSON.stringify(sheets));
  check('lessons is in neither register -- exactly as fatwa is in neither',
    roots.indexOf('lessons') === -1 && sheets.indexOf('lessons') === -1
    && roots.indexOf('fatwa') === -1 && sheets.indexOf('fatwa') === -1,
    'roots=' + roots.join(',') + ' sheets=' + sheets.join(','));
  check('...and the fall-through that routes them both is still there',
    /\/\/ Every feature section: home, never the chat\.\s*\n\s*return 'home';/.test(appJsx));
  // The interface words are in the dictionary, on BOTH sides, not written into the screen.
  const LESSON_KEYS = ['module.lessons', 'module.lessons.sub', 'lessons.searchPlaceholder',
    'lessons.searchAria', 'lessons.searchButton', 'lessons.minChars', 'lessons.loading',
    'lessons.empty', 'lessons.error', 'lessons.retry', 'lessons.resultsAria'];
  const missingKeys = LESSON_KEYS.filter((k) =>
    (appJsx.match(new RegExp("'" + k.replace(/\./g, '\\.') + "':", 'g')) || []).length !== 2);
  check('every one of the ' + LESSON_KEYS.length + ' interface strings is declared in BOTH dictionaries',
    missingKeys.length === 0, missingKeys.join(','));
  check('the screen reads its words through ezT and carries no bare sentence',
    screenCode.indexOf("ezT('module.lessons')") !== -1
    && screenCode.indexOf("ezT('lessons.empty')") !== -1);

  // -- 5B-2. THE ORDER'S SECOND DEMAND: three fields, by SET EQUALITY -----------------------
  const screenProps = [...new Set([...screenCode.matchAll(/hit\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort();
  check('the screen reads exactly title, scholar_id and url off a hit -- no fourth',
    screenProps.join(',') === 'scholar_id,title,url', screenProps.join(','));
  check('the three are all drawn: the title, the scholar under it, the url as the href',
    /style=\{s\.lsnItemTitle\}>\{row\.title\}/.test(screenCode)
    && /style=\{s\.lsnItemScholar\}>\{row\.scholar\}/.test(screenCode)
    && /href=\{row\.url\}/.test(screenCode));
  check('the link leaves the app safely: target _blank with rel noopener noreferrer',
    screenCode.indexOf('target="_blank"') !== -1
    && screenCode.indexOf('rel="noopener noreferrer"') !== -1);
  const screenLeaked = FORBIDDEN_IN_DRAW.filter((word) => screenCode.indexOf(word) !== -1);
  check('no dropped or undrawn field is even named in the section', screenLeaked.length === 0,
    screenLeaked.join(','));
  const screenEnumerated = ENUMERATORS.filter((word) => screenCode.indexOf(word) !== -1);
  check('the whitelist is written out, never enumerated', screenEnumerated.length === 0,
    screenEnumerated.join(','));
  // MUTANT 1. A reader that takes the snippet.
  const leakMutant = screenCode.replace('const scholar =', 'const snippet = hit.snippet; const scholar =');
  check('MUTANT 1 is a real mutation, not a no-op', leakMutant !== screenCode);
  const leakMutantProps = [...new Set([...leakMutant.matchAll(/hit\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort();
  check('THE GUARD BITES: a section that took the snippet fails the set AND the word list',
    leakMutantProps.join(',') !== 'scholar_id,title,url'
    && FORBIDDEN_IN_DRAW.some((word) => leakMutant.indexOf(word) !== -1),
    leakMutantProps.join(','));

  // -- 5B-3. THE ORDER'S THIRD DEMAND: AbortController on the screen's call path ------------
  check('an AbortController is created and its signal is handed to fetch',
    screenCode.indexOf('new AbortController()') !== -1
    && screenCode.indexOf('controller.signal') !== -1
    && /signal,/.test(screenCode));
  check('...and a second search aborts the first before it starts',
    /if \(lessonsAbortRef\.current\) \{ try \{ lessonsAbortRef\.current\.abort\(\); \}/.test(screenCode));
  check('...and a result that lands after a newer search is dropped, not drawn',
    /if \(lessonsAbortRef\.current !== controller\) return;/.test(screenCode));
  check('...and leaving the screen mid-request cuts it',
    /useEffect\(\(\) => \(\) => \{[\s\S]{0,160}?lessonsAbortRef\.current\.abort\(\)/.test(screenCode));
  check('the screen gives up at twelve seconds, and says so in one named constant',
    /const EZIK_LESSONS_SCREEN_TIMEOUT_MS = 12000;/.test(appJsx)
    && screenCode.indexOf('EZIK_LESSONS_SCREEN_TIMEOUT_MS') !== -1);
  // MUTANT 2. The abort taken out of the call path.
  const abortMutant = screenCode.split('const controller = new AbortController();').join('const controller = { signal: null, abort: function () {} };');
  check('MUTANT 2 is a real mutation, not a no-op', abortMutant !== screenCode);
  check('THE GUARD BITES: a section with no AbortController fails the first abort check',
    abortMutant.indexOf('new AbortController()') === -1);

  // -- 5B-4. THE THREE STATES. A SCREEN DOES NOT GO SILENT THE WAY A CARD DOES --------------
  // The tail card of item 24-A draws NOTHING on every failure, and that is right for a bonus
  // under an answer already read. A reader who pressed a search button is owed a sentence, so
  // this screen distinguishes the empty shelf from the failed request -- which is why the call
  // returns a discriminated outcome rather than a bare list.
  check('the outcome tells an empty shelf from a failed request',
    /return \{ ok: false, rows: \[\] \};/.test(screenCode)
    && /return \{ ok: true, rows: ezikLessonsScreenRows/.test(screenCode));
  check('STATE 1 of 3 -- running: a loading indicator in the file\'s own dots',
    /state === EZIK_LESSONS_LOADING \?/.test(screenCode)
    && screenCode.indexOf("ezT('lessons.loading')") !== -1
    && /style=\{s\.dot\}/.test(screenCode));
  check('STATE 2 of 3 -- no results: one line from the dictionary',
    /state === EZIK_LESSONS_DONE && rows\.length === 0 \?/.test(screenCode)
    && screenCode.indexOf("ezT('lessons.empty')") !== -1);
  check('STATE 3 of 3 -- failure: one short line AND a way to try again',
    /state === EZIK_LESSONS_FAILED \?/.test(screenCode)
    && screenCode.indexOf("ezT('lessons.error')") !== -1
    && screenCode.indexOf("ezT('lessons.retry')") !== -1);
  check('...and the retry re-runs the query that failed, not whatever is in the box now',
    /onClick=\{\(\) => runLessonsSearch\(lastQueryRef\.current\)\}/.test(screenCode));
  // The screen never receives the function's error BODY -- it reads the status code and
  // nothing else -- so the only 'error' token in the whole section must be its own dictionary
  // key. COUNTED, not merely searched for: a second occurrence would mean an error path grew
  // somewhere in here, which is the thing this demand exists to forbid.
  check('...and no upstream message can reach the reader: the one error it names is its own key',
    screenCode.indexOf('statusText') === -1
    && !/payload\.error|error\.message|error\.code/.test(screenCode)
    && !/\{\s*(?:e|err)\s*\}/.test(screenCode)
    && (screenCode.match(/\.error/g) || []).length === 1
    && screenCode.indexOf("ezT('lessons.error')") !== -1,
    (screenCode.match(/\.error/g) || []).join(','));
  // ONE state value drives every branch, and the shape is pinned PER NAME rather than by a
  // total: LOADING twice (the indicator, and the button that must not be pressed while it
  // runs), DONE twice (the empty shelf and the list), FAILED once. IDLE is tested NOWHERE --
  // before the first search the result area draws nothing at all, which is the opening state
  // expressed as an absence rather than as a branch.
  const stateTests = (name) => (screenCode.match(new RegExp('state === ' + name, 'g')) || []).length;
  check('one state value drives every branch: 2 loading, 2 done, 1 failed, and idle draws nothing',
    stateTests('EZIK_LESSONS_LOADING') === 2 && stateTests('EZIK_LESSONS_DONE') === 2
    && stateTests('EZIK_LESSONS_FAILED') === 1 && stateTests('EZIK_LESSONS_IDLE') === 0,
    'loading=' + stateTests('EZIK_LESSONS_LOADING') + ' done=' + stateTests('EZIK_LESSONS_DONE')
    + ' failed=' + stateTests('EZIK_LESSONS_FAILED') + ' idle=' + stateTests('EZIK_LESSONS_IDLE'));
  // MUTANT 3. The empty state deleted -- the shape where a reader gets a blank screen and no
  // word at all, which is exactly the failure this demand exists to prevent.
  const stateMutant = screenCode.split("ezT('lessons.empty')").join("''");
  check('MUTANT 3 is a real mutation, not a no-op', stateMutant !== screenCode);
  check('THE GUARD BITES: a section with no empty-result line fails STATE 2',
    stateMutant.indexOf("ezT('lessons.empty')") === -1);

  // -- 5B-5. THE FLOOR, THE CEILING, AND WHAT THE SERVER WILL NOT ACCEPT --------------------
  check('below three characters after trimming, no request leaves the screen',
    /const EZIK_LESSONS_SCREEN_MIN_Q = 3;/.test(appJsx)
    && (screenCode.match(/< EZIK_LESSONS_SCREEN_MIN_Q\) return/g) || []).length === 2,
    String((screenCode.match(/< EZIK_LESSONS_SCREEN_MIN_Q\) return/g) || []).length));
  check('...and the button cannot be pressed below the floor either',
    /disabled=\{state === EZIK_LESSONS_LOADING \|\| trimmed\.length < EZIK_LESSONS_SCREEN_MIN_Q\}/.test(screenCode));
  check('the screen asks for the service ceiling of ten and no more',
    /const EZIK_LESSONS_SCREEN_LIMIT = 10;/.test(appJsx)
    && /limit: EZIK_LESSONS_SCREEN_LIMIT/.test(screenCode));
  // NO PAGER, NO FILTER -- and it is the SERVER that says so. api/lessons-search.js reads two
  // body fields and no third, so a control bound to any other name would send something the
  // function drops on the floor. This is asserted against the function's own source.
  const apiBodyReads = [...new Set([...apiSrc.matchAll(/body\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort();
  check('the function accepts exactly q and limit -- no offset, page, scholar or kind',
    apiBodyReads.join(',') === 'limit,q', apiBodyReads.join(','));
  check('...so the screen sends exactly those two and invents no third',
    /JSON\.stringify\(\{ q: query, limit: EZIK_LESSONS_SCREEN_LIMIT \}\)/.test(screenCode));
  const PAGER_WORDS = ['offset', 'page', 'pageSize', 'nextPage', 'loadMore', 'hasMore'];
  const invented = PAGER_WORDS.filter((w) => new RegExp('\\b' + w + '\\b').test(screenCode));
  check('no pager and no filter was invented for a parameter the server cannot read',
    invented.length === 0, invented.join(','));

  // -- 5B-6. THE ONE CALLER OF THE ROUTE ----------------------------------------------------
  // Since the tail card was removed on 2026-08-30 there is exactly ONE caller of the search
  // route in the interface -- the screen -- and this is where that whole number is stated, so a
  // second one cannot appear without a check going red somewhere.
  const routeCallers = (appJsx.match(/fetch\(EZIK_LESSONS_(?:SCREEN_)?ENDPOINT/g) || []);
  check('the interface calls the lessons route from exactly one place: the screen',
    routeCallers.length === 1, routeCallers.join(' '));
  check('...and neither of them names the upstream service directly',
    appJsx.indexOf('lib.ezik.app/lessons') === -1);
  check('the screen keeps its own ceiling of ten rows',
    /const EZIK_LESSONS_SCREEN_LIMIT = 10;/.test(appJsx));
  check('...and its own patience of twelve seconds',
    /const EZIK_LESSONS_SCREEN_TIMEOUT_MS = 12000;/.test(appJsx));
  // The bundle is COMPACTED, so the source's spacing is not in it: the comparison ships as
  // screen==='lessons'. Matched on a pattern rather than on the source line, or this would be
  // a check that passed only by an accident of formatting.
  check('the built bundle carries the section, not just the source',
    appJs.indexOf('LessonsScreen') !== -1 && appJs.indexOf('ezikLessonsScreenRows') !== -1
    && /screen\s*===\s*'lessons'/.test(appJs));
  check('...and the file on disk is unchanged after all of section 5B',
    readRepo('app.jsx').length === appJsx.length);

  // == 5C. THE BROWSE PANE, AS ITEM 24-C BUILT IT ============================================
  //
  // Item 24-B shipped ONE pane: a box, a button, ten links. Item 24-C puts a second beside it
  // -- scholar, then series, then lessons -- and the two share a screen, a shell and a ruling
  // and share no code at all. That separation is not decoration: the search route reads two
  // body fields and has no page, so the words a pager is built from are FORBIDDEN inside item
  // 24-B's sentinels, and section 5B above enforces exactly that. The browse pane therefore
  // lives in its own bounded region of the same file, and this section reads that region.
  //
  // WHAT IS PROVED HERE AND WHAT IS NOT. The three whitelists, the request bodies and the
  // ordering of the loose-lessons bucket are proved BEHAVIOURALLY: the functions are cut out of
  // app.jsx -- none of them contains a scrap of JSX, so they are plain JavaScript -- evaluated,
  // and driven against local fixtures shaped after the contract in the order. NOTHING HERE
  // TOUCHES A NETWORK: /api/lessons-browse is another agent's file and was not in this tree
  // when this was written, so no claim is made about it. The interface's side of the contract
  // is what this section can measure, and it is all it claims.
  console.log('\n=== 5C. THE BROWSE PANE: THREE LEVELS, THREE WHITELISTS, ONE LADDER ===');

  const BROWSE_START = '// ITEM 24-C -- THE LESSONS BROWSE PANE';
  const BROWSE_END = '// ITEM 24-C -- END OF THE LESSONS BROWSE PANE';
  const browseFrom = appJsx.indexOf(BROWSE_START);
  const browseTo = appJsx.indexOf(BROWSE_END);
  check('the browse pane is present and bounded by its own sentinels',
    browseFrom !== -1 && browseTo > browseFrom, 'from=' + browseFrom + ' to=' + browseTo);
  const browseCode = stripComments(appJsx.slice(browseFrom, browseTo));
  check('the pane is a real block of code, not a comment', browseCode.length > 3000,
    String(browseCode.length));
  // TWO REGIONS, NOT THREE. The tail card was removed on 2026-08-30; the search section and the
  // browse pane are two separate stretches of one file, and if they overlapped every assertion
  // in 5B or 5C would be reading a neighbour and calling it its subject.
  check('the pane and the search section are two separate regions',
    browseTo < screenFrom,
    'browse=' + browseFrom + '..' + browseTo + ' screen=' + screenFrom + '..' + screenTo);

  // -- 5C-1. THE THREE LEVELS GO DOWN ONE ROUTE, AND IT IS THE BROWSE ROUTE ------------------
  check('the browse route is named once, as a constant, and it is the contract path',
    /const EZIK_LESSONS_BROWSE_ROUTE = '\/api\/lessons-browse';/.test(appJsx)
    && (appJsx.match(/const EZIK_LESSONS_BROWSE_ROUTE =/g) || []).length === 1);
  check('...and the pane calls fetch exactly once, on that constant',
    (browseCode.match(/fetch\(/g) || []).length === 1
    && /fetch\(EZIK_LESSONS_BROWSE_ROUTE, \{/.test(browseCode),
    String((browseCode.match(/fetch\(/g) || []).length));
  check('...and it is a POST carrying a JSON body, as the contract states',
    /method: 'POST'/.test(browseCode) && /'Content-Type': 'application\/json'/.test(browseCode)
    && /body: JSON\.stringify\(request\)/.test(browseCode));
  check('the browse pane never reaches for the SEARCH route of item 24-A or 24-B',
    browseCode.indexOf('EZIK_LESSONS_SCREEN_ENDPOINT') === -1
    && browseCode.indexOf('EZIK_LESSONS_ENDPOINT') === -1);
  check('the three level words are the contract\'s own three, each named once as a constant',
    /const EZIK_BROWSE_SCHOLARS = 'scholars';/.test(appJsx)
    && /const EZIK_BROWSE_SERIES = 'series';/.test(appJsx)
    && /const EZIK_BROWSE_LESSONS = 'lessons';/.test(appJsx));

  // THE FUNCTIONS, CUT OUT AND RUN. A top-level `function name(` down to the closing brace in
  // column zero -- the file's own shape, and it throws by name rather than returning something
  // short if the shape ever changes.
  const cutFn = (src, name) => {
    const at = src.indexOf('\nfunction ' + name + '(');
    if (at === -1) throw new Error('5C: no top-level function named ' + name + ' in app.jsx');
    const end = src.indexOf('\n}\n', at);
    if (end === -1) throw new Error('5C: unterminated function ' + name + ' in app.jsx');
    return src.slice(at + 1, end + 3);
  };
  const cutConst = (src, name) => {
    const m = src.match(new RegExp('^const ' + name + " = '[^']*';$", 'm'));
    if (!m) throw new Error('5C: no top-level constant named ' + name + ' in app.jsx');
    return m[0] + '\n';
  };
  const BROWSE_FNS = ['ezikBrowseCount', 'ezikBrowsePageNo', 'ezikBrowseScholarRows',
    'ezikBrowseSeriesRows', 'ezikBrowseLessonRows', 'ezikBrowseRequest'];
  const browseUnitSrc = ['EZIK_BROWSE_SCHOLARS', 'EZIK_BROWSE_SERIES', 'EZIK_BROWSE_LESSONS']
    .map((n) => cutConst(appJsx, n)).join('')
    + BROWSE_FNS.map((n) => cutFn(appJsx, n)).join('\n');
  const loadBrowse = (src) => new Function(src + '\nreturn {'
    + BROWSE_FNS.map((n) => n + ': ' + n).join(', ') + '};')();
  const B = loadBrowse(browseUnitSrc);
  check('all six browse functions were cut out of app.jsx and evaluated',
    BROWSE_FNS.every((n) => typeof B[n] === 'function'),
    BROWSE_FNS.map((n) => n + '=' + typeof B[n]).join(' '));

  // -- 5C-2. THE REQUEST BODY, WRITTEN OUT PER LEVEL, PROVED BY SET EQUALITY -----------------
  // A level that sent a field the server does not read would be sending it into a void; a level
  // that omitted one the server needs would ask the wrong question. Both are set equality.
  const keysOf = (o) => Object.keys(o).sort().join(',');
  const reqScholars = B.ezikBrowseRequest('scholars', 'SHAYKH', 'SILSILA', 4);
  const reqSeries = B.ezikBrowseRequest('series', 'SHAYKH', 'SILSILA', 4);
  const reqLessons = B.ezikBrowseRequest('lessons', 'SHAYKH', 'SILSILA', 4);
  check('LEVEL 1 asks for the scholars with the level and NOTHING else -- no page at all',
    keysOf(reqScholars) === 'level' && reqScholars.level === 'scholars', keysOf(reqScholars));
  check('LEVEL 2 asks for a scholar\'s series with the level, the scholar and the page',
    keysOf(reqSeries) === 'level,page,scholar_id' && reqSeries.level === 'series'
    && reqSeries.scholar_id === 'SHAYKH' && reqSeries.page === 4, keysOf(reqSeries));
  check('LEVEL 3 asks for a series\' lessons with the level, the scholar, the series and the page',
    keysOf(reqLessons) === 'level,page,scholar_id,series' && reqLessons.level === 'lessons'
    && reqLessons.series === 'SILSILA' && reqLessons.page === 4, keysOf(reqLessons));
  check('no level invents a field of its own -- limit, q, offset, kind or sort',
    [reqScholars, reqSeries, reqLessons].every((r) =>
      ['limit', 'q', 'offset', 'kind', 'sort', 'content_type'].every((k) =>
        !Object.prototype.hasOwnProperty.call(r, k))));

  // -- 5C-3. THE THREE WHITELISTS, BY SET EQUALITY, WITH THE BODY FIELDS PRESENT ON THE WIRE --
  // Every fixture row below carries the fields the interface must never take: the snippet the
  // service fills in one hit of forty, and the classification, scoring and usage fields beside
  // it. If a whitelist enumerated its row instead of naming its fields, they would come out the
  // other side. THE MARKER IS THE SAME ONE SECTION 1 PLANTS, so a leak anywhere in this file
  // looks the same and is impossible to mistake for lesson text.
  const BODY_FIELDS = {
    snippet: SNIPPET_MARKER,
    excerpt: SNIPPET_MARKER,
    matn: SNIPPET_MARKER,
    content_type: 'lecture',
    score: 0.91,
    tier: 'a',
    usage: 'full',
    citation_allowed: true,
  };
  const withBody = (row) => Object.assign({}, BODY_FIELDS, row);
  const FIX_SCHOLARS = [
    withBody({ scholar_id: 'ابن عثيمين', count: 4210 }),
    withBody({ scholar_id: 'ابن باز', count: 3117 }),
    withBody({ scholar_id: '   ', count: 9 }),
    withBody({ count: 5 }),
    null,
    'not an object',
  ];
  const FIX_SERIES = [
    withBody({ series: '', count: 88 }),
    withBody({ series: 'شرح الأربعين النووية', count: 42 }),
    withBody({ series: 'شرح بلوغ المرام', count: 17 }),
    null,
  ];
  const FIX_LESSONS = [
    withBody({ unit_id: 'u-1', title: 'الدرس الأول', url: 'https://example.org/a' }),
    withBody({ unit_id: 'u-2', title: 'الدرس الثاني', url: 'https://example.org/b' }),
    withBody({ unit_id: 'u-3', title: '', url: 'https://example.org/c' }),
    withBody({ unit_id: 'u-4', title: 'بلا رابط', url: 'javascript:alert(1)' }),
    withBody({ unit_id: 'u-5', title: 'بلا رابط أصلا' }),
    null,
  ];
  const shapeOf = (rows) => [...new Set(rows.reduce((acc, r) => acc.concat(Object.keys(r)), []))]
    .sort().join(',');
  const outScholars = B.ezikBrowseScholarRows(FIX_SCHOLARS);
  const outSeries = B.ezikBrowseSeriesRows(FIX_SERIES);
  const outLessons = B.ezikBrowseLessonRows(FIX_LESSONS);
  check('LEVEL 1 keeps exactly a name and a count -- no third property',
    shapeOf(outScholars) === 'count,scholar', shapeOf(outScholars));
  check('...and drops the nameless and the blank-named rather than drawing an empty control',
    outScholars.length === 2 && outScholars[0].scholar === 'ابن عثيمين'
    && outScholars[0].count === 4210, String(outScholars.length));
  check('LEVEL 2 keeps exactly a series, a count and the bucket flag -- no fourth property',
    shapeOf(outSeries) === 'count,misc,series', shapeOf(outSeries));
  check('LEVEL 3 keeps exactly an identity, a title and a url -- no fourth property',
    shapeOf(outLessons) === 'title,unit,url', shapeOf(outLessons));
  check('...and drops a titleless row, a non-http url and a missing url alike',
    outLessons.length === 2 && outLessons[0].url === 'https://example.org/a',
    String(outLessons.length) + ' ' + JSON.stringify(outLessons.map((r) => r.unit)));
  const drained = JSON.stringify([outScholars, outSeries, outLessons]);
  check('NOT ONE BODY FIELD SURVIVES ANY OF THE THREE LEVELS',
    Object.keys(BODY_FIELDS).every((k) => drained.indexOf(k) === -1)
    && drained.indexOf(SNIPPET_MARKER) === -1,
    Object.keys(BODY_FIELDS).filter((k) => drained.indexOf(k) !== -1).join(','));
  // AND THE WHITELISTS ARE WRITTEN, NOT DERIVED. An enumerating reader would pass the test above
  // today and fail it the day the service grows a field nobody here has heard of.
  const browseEnumerated = ENUMERATORS.concat(['Object.assign', 'JSON.parse(JSON.stringify'])
    .filter((word) => browseCode.indexOf(word) !== -1);
  check('every one of the three whitelists is written out, never enumerated',
    browseEnumerated.length === 0, browseEnumerated.join(','));
  const browseReads = [...new Set([...browseCode.matchAll(/row\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort().join(',');
  check('the pane reads exactly the six named fields of the three contract rows off a row',
    browseReads === 'count,misc,scholar,scholar_id,series,title,unit,unit_id,url', browseReads);
  const browseLeaked = FORBIDDEN_IN_DRAW.filter((word) =>
    word !== 'unit_id' && browseCode.indexOf(word) !== -1);
  check('no body field is even NAMED in the pane -- unit_id excepted, and it is never drawn',
    browseLeaked.length === 0, browseLeaked.join(','));
  check('...and unit_id is read for identity alone: it reaches a key and no drawn element',
    /key=\{row\.unit \|\| i\}/.test(browseCode)
    && (browseCode.match(/row\.unit\b/g) || []).length === 1,
    String((browseCode.match(/row\.unit\b/g) || []).length));

  // -- 5C-4. THE LOOSE-LESSONS BUCKET IS LAST, ALWAYS ---------------------------------------
  // The fixture puts it FIRST on the wire on purpose: an implementation that simply drew what
  // the server sent would pass a test whose fixture already had it at the end.
  check('the bucket is the EMPTY series and is recognised as a shelf, not as a broken row',
    outSeries.length === 3 && outSeries.filter((r) => r.misc).length === 1,
    JSON.stringify(outSeries.map((r) => r.series)));
  check('THE BUCKET IS DRAWN LAST even when the server sends it first',
    outSeries[outSeries.length - 1].misc === true && outSeries[0].misc === false
    && outSeries[outSeries.length - 1].count === 88,
    outSeries.map((r) => (r.misc ? 'MISC' : 'named')).join(' '));
  check('...and it is given a word at the draw, because the wire has none for it',
    /row\.misc \? ezT\('lessons\.miscSeries'\) : row\.series/.test(browseCode));

  // -- 5C-5. AbortController ON THE BROWSE PATH ---------------------------------------------
  // Two mechanisms, and neither is enough alone: the abort cuts the WIRE, and the generation
  // drops the answer that was already on its way back when the reader moved, which no abort can
  // recall. The cleanup of the one effect is what stepping between levels and leaving the
  // screen both run, so one line covers both demands the order makes.
  check('an AbortController is created and its signal is handed to fetch',
    browseCode.indexOf('new AbortController()') !== -1
    && browseCode.indexOf('controller.signal') !== -1
    && /ezikBrowseFetch\(ezikBrowseRequest\([^)]*\), controller\.signal\)/.test(browseCode));
  check('...and the effect that asks is cleaned up, which is what cuts a pending request',
    /return \(\) => \{\s*clearTimeout\(timer\);\s*try \{ controller\.abort\(\); \} catch \(e\) \{\}\s*\};/
      .test(browseCode));
  check('...and every move between levels is a dependency of that effect, so every move cuts it',
    /\}, \[level, scholar, series, pageNo, attempt\]\);/.test(browseCode));
  check('...and a landing from an older generation is dropped, not drawn',
    /browseGenRef\.current \+= 1;/.test(browseCode)
    && /const generation = browseGenRef\.current;/.test(browseCode)
    && /if \(browseGenRef\.current !== generation\) return;/.test(browseCode));
  check('the pane gives up at twelve seconds, and says so in one named constant',
    /const EZIK_BROWSE_TIMEOUT_MS = 12000;/.test(appJsx)
    && /setTimeout\(\(\) => \{ try \{ controller\.abort\(\); \} catch \(e\) \{\} \}, EZIK_BROWSE_TIMEOUT_MS\);/
      .test(browseCode));

  // -- 5C-6. THE THREE STATES, ON EVERY LEVEL ------------------------------------------------
  // One state value drives all three levels, so a reader gets the same three answers whether
  // they are looking at scholars, at series or at lessons. There is no idle: the pane asks the
  // moment it mounts, so nobody is shown a browse screen that has not tried.
  check('the outcome tells an empty shelf from a failed request',
    /return \{ ok: false, payload: null \};/.test(browseCode)
    && /return \{ ok: true, payload:/.test(browseCode));
  check('STATE 1 of 3 -- loading: the file\'s own dots and one line from the dictionary',
    /state === EZIK_BROWSE_LOADING \?/.test(browseCode)
    && browseCode.indexOf("ezT('lessons.browseLoading')") !== -1
    && /style=\{s\.dot\}/.test(browseCode));
  check('STATE 2 of 3 -- no results: one line from the dictionary',
    /state === EZIK_BROWSE_READY && rows\.length === 0 \?/.test(browseCode)
    && browseCode.indexOf("ezT('lessons.browseEmpty')") !== -1);
  check('STATE 3 of 3 -- failure: one short line AND a way to try again',
    /state === EZIK_BROWSE_FAILED \?/.test(browseCode)
    && browseCode.indexOf("ezT('lessons.browseError')") !== -1
    && browseCode.indexOf("ezT('lessons.browseRetry')") !== -1);
  check('...and the retry re-runs the level the reader is on, through the one effect',
    /onClick=\{\(\) => setAttempt\(attempt \+ 1\)\}/.test(browseCode));
  check('...and no upstream message can reach the reader: the pane keeps no error text at all',
    browseCode.indexOf('statusText') === -1
    && !/payload\.error|error\.message|error\.code/.test(browseCode)
    && (browseCode.match(/\.error/g) || []).length === 0);
  const browseStateTests = (name) =>
    (browseCode.match(new RegExp('state === ' + name, 'g')) || []).length;
  check('one state value drives every level: loading once, failed once, ready on six branches',
    browseStateTests('EZIK_BROWSE_LOADING') === 1 && browseStateTests('EZIK_BROWSE_FAILED') === 1
    && browseStateTests('EZIK_BROWSE_READY') === 6,
    'loading=' + browseStateTests('EZIK_BROWSE_LOADING')
    + ' ready=' + browseStateTests('EZIK_BROWSE_READY')
    + ' failed=' + browseStateTests('EZIK_BROWSE_FAILED'));

  // -- 5C-7. THE LADDER IS ONE RUNG, AND THE PAGER'S ENDS ARE DISABLED, NOT HIDDEN -----------
  check('the section offers the back press to the pane BEFORE it goes home',
    /const step = browseBackRef\.current;/.test(screenCode)
    && /if \(tab === EZIK_LESSONS_TAB_BROWSE && step && step\(\) === true\) return;/.test(screenCode)
    && /onHome\(\);/.test(screenCode));
  check('...and the pane parks its rung on every render and clears it when it goes',
    /backRef\.current = ezikBrowseStepBack;/.test(browseCode)
    && /return \(\) => \{ backRef\.current = null; \};/.test(browseCode));
  check('LESSONS falls back to SERIES -- one rung, never two',
    /if \(level === EZIK_BROWSE_LESSONS\) \{[\s\S]{0,160}?setLevel\(EZIK_BROWSE_SERIES\);[\s\S]{0,40}?return true;/
      .test(browseCode));
  check('SERIES falls back to SCHOLARS -- one rung, never two',
    /if \(level === EZIK_BROWSE_SERIES\) \{[\s\S]{0,160}?setLevel\(EZIK_BROWSE_SCHOLARS\);[\s\S]{0,40}?return true;/
      .test(browseCode));
  check('...and SCHOLARS is the floor: the press is declined and the section takes it home',
    /return false;\s*\};/.test(browseCode)
    && browseCode.indexOf('setLevel(EZIK_BROWSE_LESSONS)') !== -1
    && (browseCode.match(/return true;/g) || []).length === 2,
    String((browseCode.match(/return true;/g) || []).length));
  check('the pager names the page and the total, from the dictionary, with no free text',
    browseCode.indexOf("ezT('lessons.pageOf', { n: ezikBrowseNum(pageNo), of: ezikBrowseNum(pages) })") !== -1
    && browseCode.indexOf("ezT('lessons.pagePrev')") !== -1
    && browseCode.indexOf("ezT('lessons.pageNext')") !== -1);
  check('BOTH ENDS ARE DISABLED, NOT HIDDEN: the two controls are drawn together, then disabled',
    /disabled=\{pageNo <= 1\}/.test(browseCode) && /disabled=\{pageNo >= pages\}/.test(browseCode)
    && (browseCode.match(/<nav style=\{s\.lsbPager\}/g) || []).length === 1
    && !/pages > 1 \?/.test(browseCode));
  check('...and the scholars level has no pager at all, because the contract sends it whole',
    /level !== EZIK_BROWSE_SCHOLARS \?/.test(browseCode)
    && /setPages\(level === EZIK_BROWSE_SCHOLARS \? 1 : ezikBrowsePageNo\(body\.pages\)\);/
      .test(browseCode));

  // -- 5C-8. THE WORDS ARE IN THE DICTIONARY, IN BOTH HALVES ---------------------------------
  const BROWSE_KEYS = ['lessons.tabBrowse', 'lessons.tabSearch', 'lessons.tabsAria',
    'lessons.scholarsTitle', 'lessons.scholarsAria', 'lessons.seriesAria', 'lessons.lessonsAria',
    'lessons.miscSeries', 'lessons.countLessons', 'lessons.browseLoading', 'lessons.browseEmpty',
    'lessons.browseError', 'lessons.browseRetry', 'lessons.pagerAria', 'lessons.pagePrev',
    'lessons.pageNext', 'lessons.pageOf'];
  const browseMissing = BROWSE_KEYS.filter((k) =>
    (appJsx.match(new RegExp("'" + k.replace(/\./g, '\\.') + "':", 'g')) || []).length !== 2);
  check('every one of the ' + BROWSE_KEYS.length + ' browse strings is declared in BOTH dictionaries',
    browseMissing.length === 0, browseMissing.join(','));
  // ZERO FREE TEXT, PROVED TWICE. First: after the comments come off, NOT ONE ARABIC CHARACTER
  // is left in the pane. Every Arabic word it draws is a key looked up at render, so a sentence
  // typed into the JSX would survive stripping and show up here. Second: every quoted literal
  // that IS left is either a dictionary key or one of the technical words named below -- so a
  // sentence typed in English, which the first test cannot see, fails the second.
  check('not one Arabic character survives in the pane: every word it draws is a lookup',
    !/[؀-ۿ]/.test(browseCode),
    (browseCode.match(/[؀-ۿ]+/g) || []).length + ' run(s)');
  const BROWSE_TECHNICAL = ['', '/api/lessons-browse', 'scholars', 'series', 'lessons',
    'loading', 'ready', 'failed', 'ar', 'string', 'object', 'number', 'POST', 'Content-Type',
    'application/json', '0.2s', '0.4s'];
  const BROWSE_ATTRS = ['button', 'status', 'polite', 'alert', 'ezhome-focus', '_blank',
    'noopener noreferrer'];
  const literalsIn = (code, quote) => [...new Set(
    [...code.matchAll(new RegExp(quote + '([^' + quote + '\\n]*)' + quote, 'g'))].map((m) => m[1]))];
  const strayQuoted = literalsIn(browseCode, "'")
    .filter((v) => v.indexOf('lessons.') !== 0 && BROWSE_TECHNICAL.indexOf(v) === -1);
  check('every quoted word in the pane is a dictionary key or a named technical value',
    strayQuoted.length === 0, strayQuoted.join(' | '));
  const strayAttrs = literalsIn(browseCode, '"').filter((v) => BROWSE_ATTRS.indexOf(v) === -1);
  check('...and every attribute value in it is one of the seven the markup needs',
    strayAttrs.length === 0, strayAttrs.join(' | '));
  check('the tab bar itself is two dictionary words, and the search pane is unchanged beside it',
    screenCode.indexOf("ezT('lessons.tabBrowse')") !== -1
    && screenCode.indexOf("ezT('lessons.tabSearch')") !== -1
    && /const EZIK_LESSONS_TAB_BROWSE = 'browse';/.test(appJsx)
    && /const EZIK_LESSONS_TAB_SEARCH = 'search';/.test(appJsx));
  check('the built bundle carries the pane, not just the source',
    appJs.indexOf('LessonsBrowsePane') !== -1 && appJs.indexOf('ezikBrowseSeriesRows') !== -1
    && appJs.indexOf('/api/lessons-browse') !== -1);

  // -- 5C-9. FOUR MUTANTS. EVERY ONE IS PROVED A REAL MUTATION FIRST -------------------------
  // A no-op mutant reports a false PASS: the assertion below it bites the ORIGINAL and the run
  // reads green. So each mutation is shown to have changed the source before it is driven.
  //
  // MUTANT 4. A lessons reader that passes the row through instead of naming its fields --
  // exactly what an enumerating whitelist looks like from the outside.
  const enumMutantSrc = browseUnitSrc.replace(
    'out.push({ unit: unit, title: title, url: url });', 'out.push(row);');
  check('MUTANT 4 is a real mutation, not a no-op', enumMutantSrc !== browseUnitSrc);
  const enumOut = JSON.stringify(loadBrowse(enumMutantSrc).ezikBrowseLessonRows(FIX_LESSONS));
  check('THE GUARD BITES: a pane that passed the row through leaks every body field',
    enumOut.indexOf(SNIPPET_MARKER) !== -1
    && Object.keys(BODY_FIELDS).every((k) => enumOut.indexOf(k) !== -1));
  //
  // MUTANT 5. The bucket concatenated at the FRONT. The fixture already sends it first, so a
  // pane that merely drew what it was given would look identical -- which is why the check that
  // bites is about position and not about presence.
  const orderMutantSrc = browseUnitSrc.replace(
    'return named.concat(loose);', 'return loose.concat(named);');
  check('MUTANT 5 is a real mutation, not a no-op', orderMutantSrc !== browseUnitSrc);
  const orderOut = loadBrowse(orderMutantSrc).ezikBrowseSeriesRows(FIX_SERIES);
  check('THE GUARD BITES: a pane that drew the bucket first fails the last-place check',
    orderOut.length === 3 && orderOut[orderOut.length - 1].misc === false
    && orderOut[0].misc === true,
    orderOut.map((r) => (r.misc ? 'MISC' : 'named')).join(' '));
  //
  // MUTANT 6. The abort taken out of the browse path.
  const browseAbortMutant = browseCode
    .split('const controller = new AbortController();')
    .join('const controller = { signal: null, abort: function () {} };');
  check('MUTANT 6 is a real mutation, not a no-op', browseAbortMutant !== browseCode);
  check('THE GUARD BITES: a pane with no AbortController fails the first abort check',
    browseAbortMutant.indexOf('new AbortController()') === -1);
  //
  // MUTANT 7. A ladder that jumps two rungs: the lessons level falling straight back to the
  // scholars, which is the shape the order forbids by name.
  const ladderMutant = browseCode.replace(
    'if (level === EZIK_BROWSE_LESSONS) {\n      setSeries(\'\');\n      setPageNo(1);\n      setLevel(EZIK_BROWSE_SERIES);',
    'if (level === EZIK_BROWSE_LESSONS) {\n      setSeries(\'\');\n      setPageNo(1);\n      setLevel(EZIK_BROWSE_SCHOLARS);');
  check('MUTANT 7 is a real mutation, not a no-op', ladderMutant !== browseCode);
  check('THE GUARD BITES: a ladder that skipped the series level fails the one-rung check',
    !/if \(level === EZIK_BROWSE_LESSONS\) \{[\s\S]{0,160}?setLevel\(EZIK_BROWSE_SERIES\);[\s\S]{0,40}?return true;/
      .test(ladderMutant));
  check('...and app.jsx on disk is unchanged after all of section 5C',
    readRepo('app.jsx').length === appJsx.length);

  // == 6. THE FOUR LIBRARY-SEARCH FILES ARE UNTOUCHED ========================================
  console.log('\n=== 6. THE FOUR LIBRARY-SEARCH FILES, BEFORE AND AFTER ===');
  const afterShas = COMPREHENSIVE.map((rel) => ({ rel, sha: shaOf(rel), bytes: fs.statSync(path.join(REPO, rel)).size }));
  check('four files were measured', beforeShas.length === 4 && afterShas.length === 4);
  for (let i = 0; i < COMPREHENSIVE.length; i += 1) {
    const b = beforeShas[i];
    const a = afterShas[i];
    console.log('        ' + b.rel + '  before ' + b.sha.slice(0, 16) + ' (' + b.bytes + ')'
      + '  after ' + a.sha.slice(0, 16) + ' (' + a.bytes + ')');
    check(b.rel + ' is byte-identical before and after this guard run',
      b.sha === a.sha && b.bytes === a.bytes, b.sha + ' -> ' + a.sha);
  }
  check('none of the four was amended to know about this round',
    COMPREHENSIVE.every((rel) => {
      const src = readRepo(rel);
      return src.length > 0 && NEW_NAMES.every((name) => src.indexOf(name) === -1);
    }));
  // The four are NAMED in this round's prose -- they are the model it was written from, and a
  // reader has to be able to find them. What must not exist is a dependency: an import, a
  // require, or a read. So the check is over the import graph, not over the words.
  const importsOf = (src) => Array.from(src.matchAll(/(?:^|\n)\s*import[^\n]*from\s*['"]([^'"]+)['"]/g)).map((m) => m[1]);
  check('this round imports exactly one module, and it is its own card builder',
    importsOf(apiSrc).join(',') === '../lib/lessons-source-card.js', importsOf(apiSrc).join(','));
  check('the card builder imports nothing at all', importsOf(cardSrc).length === 0,
    importsOf(cardSrc).join(','));
  check('neither new module requires or reads any of the four',
    COMPREHENSIVE.every((rel) => {
      const base = rel.split('/').pop();
      return !new RegExp("require\\([^)]*" + base.replace('.', '\\.') + "|readFileSync\\([^)]*" + base.replace('.', '\\.'))
        .test(apiSrc + cardSrc);
    }));

  // == 7. THE TOKEN APPEARS IN NO OUTPUT, ON ANY PATH ========================================
  console.log('\n=== 7. THE TOKEN IS IN NO OUTPUT ON ANY ERROR PATH ===');
  const okRun = await drive(handler, { body: { q: 'q-fixture', limit: 3 },
    upstream: { status: 200, payload: FIXTURES.response_with_unknown_fields } });
  const noToken = await drive(handler, { body: { q: 'q-fixture' }, token: null,
    upstream: { status: 200, payload: FIXTURES.response_empty } });
  const rejected = await drive(handler, { body: { q: 'q-fixture' },
    upstream: { status: 401, payload: { error: 'unauthorized' } } });
  const errored = await drive(handler, { body: { q: 'q-fixture' },
    upstream: { status: 500, payload: { error: 'boom' } } });
  const unreachable = await drive(handler, { body: { q: 'q-fixture' },
    upstream: new Error('connect ECONNREFUSED lib.ezik.app') });
  const unreadable = await drive(handler, { body: { q: 'q-fixture' }, upstream: { status: 200, unreadable: true } });
  const notPost = await drive(handler, { method: 'GET', body: { q: 'q-fixture' },
    upstream: { status: 200, payload: FIXTURES.response_empty } });
  const noQ = await drive(handler, { body: { limit: 5 }, upstream: { status: 200, payload: FIXTURES.response_empty } });
  const runs = { okRun, noToken, rejected, errored, unreachable, unreadable, notPost, noQ };

  check('every error path answered', Object.values(runs).every((r) => typeof r.res.statusCode === 'number'),
    Object.entries(runs).map(([k, r]) => k + '=' + r.res.statusCode).join(' '));
  check('the token is in no response body',
    Object.values(runs).every((r) => !mentionsToken(r.res.body)));
  check('the token is in no response header',
    Object.values(runs).every((r) => !mentionsToken(r.res.headers)));
  check('the token is in no log line',
    Object.values(runs).every((r) => !r.logs.join(' ').includes(FIXTURE_TOKEN)),
    Object.entries(runs).filter(([, r]) => r.logs.join(' ').includes(FIXTURE_TOKEN)).map(([k]) => k).join(','));
  check('an unreachable service is 502 and the transport error text does not reach the client',
    unreachable.res.statusCode === 502 && !serialize(unreachable.res.body).includes('ECONNREFUSED'),
    serialize(unreachable.res.body));
  // The run-time checks above prove the token was in no line these paths actually printed. This
  // one proves it STRUCTURALLY, for every path including ones no fixture reaches: the token
  // binding, the header name and the scheme word are not read by any console call in the file.
  // The sweep is the repo's own (guards/telemetry-scan-lib.cjs), and the positive precondition
  // on the same binding is what stops this passing because it read nothing.
  const apiConsoleCalls = scan.consoleCalls(apiSrc);
  check('the console sweep found the function log lines',
    apiConsoleCalls.length >= 5 && apiConsoleCalls.every((c) => c.balanced), String(apiConsoleCalls.length));
  check('no console call in the function reads the token, the auth header or the scheme word',
    apiConsoleCalls.length >= 5
      && apiConsoleCalls.every((c) => !/\btoken\b|\bauthorization\b|\bBearer\b|AUTH_/i.test(scan.expressionText(c.text))),
    apiConsoleCalls.filter((c) => /\btoken\b|\bauthorization\b|\bBearer\b|AUTH_/i.test(scan.expressionText(c.text)))
      .map((c) => 'L' + c.line).join(','));
  check('the card builder prints nothing at all', scan.consoleCalls(cardSrc).length === 0,
    String(scan.consoleCalls(cardSrc).length));
  check('the token planted in an extra service field is dropped, not forwarded',
    FIXTURES.response_with_unknown_fields.server_token_hint === FIXTURE_TOKEN
      && !mentionsToken(okRun.res.body));
  check('no response body names the environment variable',
    Object.values(runs).every((r) => !serialize(r.res.body).includes('SEARCH_API_TOKEN')));
  check('no response body names the service host',
    Object.values(runs).every((r) => !serialize(r.res.body).includes('lib.ezik.app')));
  check('neither new source file contains a token literal',
    !apiSrc.includes(FIXTURE_TOKEN) && !cardSrc.includes(FIXTURE_TOKEN));
  check('the missing-token reason is in the server log instead of the client body',
    noToken.res.statusCode === 503 && noToken.calls.length === 0
      && noToken.logs.some((line) => line.includes('search_api_token_missing')),
    noToken.logs.join(' | '));

  // == B. THE WIRE: METHOD, HEADER, BODY, CEILING ============================================
  console.log('\n=== B. THE CALL ON THE WIRE ===');
  const sent = okRun.calls[0];
  check('the call goes to the measured lessons endpoint',
    sent.url === 'https://lib.ezik.app/lessons/search', sent.url);
  check('the method is POST', sent.init.method === 'POST');
  check('the header name is authorization',
    Object.keys(sent.init.headers).some((k) => k.toLowerCase() === 'authorization'),
    Object.keys(sent.init.headers).join(','));
  check('the value is the token behind the exact prefix "Bearer "',
    sent.init.headers.authorization === 'Bearer ' + FIXTURE_TOKEN,
    ascii(String(sent.init.headers.authorization)));
  const sentBody = JSON.parse(sent.init.body);
  check('the request body carries q and limit only',
    Object.keys(sentBody).sort().join(',') === 'limit,q', Object.keys(sentBody).join(','));
  check('limit is honoured', sentBody.limit === 3);
  check('the service ceiling of ten is never exceeded',
    api.normalizeLimit(500) === 10 && api.normalizeLimit(11) === 10 && api.normalizeLimit(10) === 10);
  check('limit defaults to 10', api.normalizeLimit(undefined) === 10 && api.normalizeLimit('nonsense') === 10);
  check('limit is an integer', api.normalizeLimit(4.9) === 4);
  check('a non-POST method is 405 and never reaches the service',
    notPost.res.statusCode === 405 && notPost.calls.length === 0, 'got ' + notPost.res.statusCode);
  check('a request with no q is 400 and never reaches the service',
    noQ.res.statusCode === 400 && noQ.calls.length === 0, 'got ' + noQ.res.statusCode);
  check('a 401 earns exactly ONE outbound call - no retry without the token',
    rejected.res.statusCode === 502 && rejected.calls.length === 1, 'calls=' + rejected.calls.length);
  check('a 500 is 502 to the client', errored.res.statusCode === 502, 'got ' + errored.res.statusCode);
  check('an unreadable body is 502 to the client', unreadable.res.statusCode === 502,
    'got ' + unreadable.res.statusCode);

  // == C. THE SHAPE THAT REACHES THE CLIENT ==================================================
  console.log('\n=== C. NINE FIELDS PER HIT, NOTHING ADDED ===');
  const shaped = okRun.res.body;
  check('every top-level key is a measured one',
    Object.keys(shaped).every((key) => api.RESPONSE_FIELDS.includes(key)), Object.keys(shaped).join(','));
  check('an unmeasured top-level field is dropped in silence', !('shard_host' in shaped));
  check('every hit key is one of the nine returned names',
    shaped.hits[0] && Object.keys(shaped.hits[0]).every((key) => api.RETURNED_HIT_FIELDS.includes(key)),
    Object.keys(shaped.hits[0] || {}).join(','));
  check('the function adds no field of its own - no card, no sentence',
    shaped.hits[0] && !('source_card' in shaped.hits[0]) && !('refused_text' in shaped)
      && !('degraded_text' in shaped) && !('empty_text' in shaped),
    Object.keys(shaped.hits[0] || {}).join(','));
  check('an invented body field is dropped', shaped.hits[0] && !('lesson_body' in shaped.hits[0]));
  check('a hits key that is not a list is dropped rather than passed on',
    !('hits' in api.shapeSearchResponse({ hits: 'not-a-list' })));
  check('an empty result is an empty list, not an invented sentence',
    Array.isArray(api.shapeSearchResponse(FIXTURES.response_empty).hits)
      && api.shapeSearchResponse(FIXTURES.response_empty).hits.length === 0
      && Object.keys(api.shapeSearchResponse(FIXTURES.response_empty)).join(',') === 'hits');
  check('the response carries a no-store cache header',
    String(okRun.res.headers['Cache-Control'] || '').includes('no-store'),
    serialize(okRun.res.headers));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' - FAIL ===' : ' - PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
