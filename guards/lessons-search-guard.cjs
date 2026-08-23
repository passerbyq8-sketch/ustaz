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
// WIRED THE INTERFACE: app.jsx now calls the function after a settled reply and draws a card
// of three fields under the answer. Sections 1-4, 6 and 7 are unchanged and still hold the
// server side; section 5 changed from proving an absence to proving that one shape, and the
// note there says why. This guard proves the seven assertions the order names, WITHOUT A
// NETWORK CALL and without a real token -- the agent that wrote it has neither. It stubs
// `globalThis.fetch`, which is the single seam every outbound call in this repo passes through,
// and drives the real exported handler against local fixtures shaped after the measured
// contract.
//
//   1. the function returns no `snippet`, EVEN WHEN THE SERVICE SENDS A FILLED ONE
//   2. the card carries the four named fields and no fifth -- keys counted against the list
//   3. the card invents nothing when a field is absent
//   4. a `content_type` outside the eleven is an absence
//   5. THE INTERFACE, AS ITEM 24-A BUILT IT: index.html, quest.html and sw.js still name
//      nothing of this round, and app.jsx draws exactly three fields through one cancellable
//      POST (this assertion PROVED AN ABSENCE until item 24-A -- see the note at section 5)
//   5B. THE LESSONS SECTION (item 24-B): one screen key, one navigation entry, the same
//      three-field whitelist proved by set equality, a cancellable call, and the three
//      states a screen owes a reader that a tail card does not
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

  // == 5. THE INTERFACE, AND EXACTLY THE ONE THE ORDER NAMES =================================
  //
  // WHAT THIS SECTION USED TO PROVE, AND WHY IT NO LONGER CAN. Item 150 shipped the server
  // function with NO INTERFACE ON PURPOSE, and this section proved that absence: five files
  // named nothing of the round. ITEM 24-A BUILT THE INTERFACE, so the absence is now false BY
  // ORDER and a check that still asserted it would be red for the one reason a red must never
  // mean -- the work being done. Nothing here was removed to make room: the absence is proved
  // for every file that still has one (index.html, quest.html, sw.js), and for the two files
  // that now name the round it is replaced by a SHAPE, which is a stronger statement than the
  // absence was. The order's three demands are checks 5c-1, 5c-2 and 5c-4 below.
  console.log('\n=== 5. THE INTERFACE: ONE CALL, THREE FIELDS, ONE ABORT ===');

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
  const DRAW_START = '// ITEM 24-A -- RELATED LESSONS, UNDER A SETTLED REPLY';
  const DRAW_END = 'const MessageBubble = React.memo(';
  const drawFrom = appJsx.indexOf(DRAW_START);
  const drawTo = appJsx.indexOf(DRAW_END);
  check('the draw block is present and bounded, above the bubble that renders it',
    drawFrom !== -1 && drawTo > drawFrom, 'from=' + drawFrom + ' to=' + drawTo);
  const drawCode = stripComments(appJsx.slice(drawFrom, drawTo));
  check('the draw block is a real block of code, not a comment', drawCode.length > 600,
    String(drawCode.length));

  const CALL_START = '  const [lessonRows, setLessonRows] = useState(null);';
  const CALL_MID = '  const startLessonsSearch = (q, seq) => {';
  const callFrom = appJsx.indexOf(CALL_START);
  const callMid = appJsx.indexOf(CALL_MID);
  const callTo = callMid === -1 ? -1 : appJsx.indexOf('\n  };\n', callMid);
  check('the call block is present and bounded, inside the chat screen',
    callFrom !== -1 && callMid > callFrom && callTo > callMid,
    'from=' + callFrom + ' mid=' + callMid + ' to=' + callTo);
  const callCode = stripComments(appJsx.slice(callFrom, callTo));
  check('the call block is a real block of code, not a comment', callCode.length > 400,
    String(callCode.length));

  // -- 5c-1. THE ORDER'S FIRST DEMAND: the route is called, and it is called with POST --------
  check('the draw block names the function route',
    drawCode.indexOf('/api/lessons-search') !== -1);
  check('...and calls it with POST', /method:\s*'POST'/.test(drawCode));
  check('...sending the question as `q` in a JSON body',
    /JSON\.stringify\(\{\s*q:/.test(drawCode));
  check('...and there is exactly one call site in the whole of app.jsx',
    (appJsx.match(/fetch\(EZIK_LESSONS_ENDPOINT/g) || []).length === 1,
    String((appJsx.match(/fetch\(EZIK_LESSONS_ENDPOINT/g) || []).length));

  // -- 5c-2. THE ORDER'S SECOND DEMAND: three fields, no fourth, and no text field ------------
  // Set equality over the properties actually read off a hit -- not a search for three names.
  // A fourth field added to the reader fails here even if the three are still present, and a
  // text field added to the SERVICE cannot reach a screen through a reader that enumerates
  // nothing.
  const readProps = [...new Set([...drawCode.matchAll(/hit\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort();
  check('the reader reads exactly title, scholar_id and url off a hit -- no fourth',
    readProps.join(',') === 'scholar_id,title,url', readProps.join(','));
  check('the three are all drawn: the title, the scholar under it, the url as the href',
    /style=\{s\.lessonsTitle\}>\{row\.title\}/.test(drawCode)
    && /style=\{s\.lessonsScholar\}>\{row\.scholar\}/.test(drawCode)
    && /href=\{row\.url\}/.test(drawCode));
  check('the link leaves the app safely: target _blank with rel noopener noreferrer',
    drawCode.indexOf('target="_blank"') !== -1
    && drawCode.indexOf('rel="noopener noreferrer"') !== -1);
  // `snippet` first, because it is the field the server deletes at its own edge and the one a
  // future service is most likely to send back under another name. Then the six fields the
  // contract DOES send and this screen refuses: score, unit_id, tier, usage, citation_allowed,
  // content_type. citation_allowed=0 and usage=search_only on the measured sample -- the link is
  // the end of it, so none of the six may be read, and no quote or excerpt may be drawn.
  const FORBIDDEN_IN_DRAW = ['snippet', 'excerpt', 'matn', 'score', 'unit_id', 'tier',
    'usage', 'citation_allowed', 'content_type'];
  const leaked = FORBIDDEN_IN_DRAW.filter((word) => drawCode.indexOf(word) !== -1);
  check('no dropped or undrawn field is even named in the draw block', leaked.length === 0,
    leaked.join(','));
  // The whitelist has to be WRITTEN, not derived: an enumerating reader would draw a text field
  // the day the service grows one, without a person ever having typed its name.
  const ENUMERATORS = ['Object.keys', 'Object.entries', 'Object.values', 'for (const k in',
    'for (let k in', 'JSON.stringify(hit'];
  const enumerated = ENUMERATORS.filter((word) => drawCode.indexOf(word) !== -1);
  check('the whitelist is written out, never enumerated', enumerated.length === 0,
    enumerated.join(','));
  // THE PREDICATE BITES. The same two tests, run against a block that DOES leak, so a pass
  // above is a statement about the file rather than about a test that can no longer fail.
  const leakyDraw = drawCode.replace('const scholar =', 'const snippet = hit.snippet; const scholar =');
  check('the leak mutant is a real mutation, not a no-op', leakyDraw !== drawCode);
  const leakyProps = [...new Set([...leakyDraw.matchAll(/hit\.([A-Za-z_][A-Za-z0-9_]*)/g)]
    .map((m) => m[1]))].sort();
  check('THE GUARD BITES: a reader that took the snippet fails both the set and the word list',
    leakyProps.join(',') !== 'scholar_id,title,url'
    && FORBIDDEN_IN_DRAW.some((word) => leakyDraw.indexOf(word) !== -1),
    leakyProps.join(','));
  check('...and the real block, re-read after the mutation, is unchanged',
    stripComments(readRepo('app.jsx').slice(drawFrom, drawTo)) === drawCode);

  // -- 5c-3. the ceiling of three, the floor of three characters, the eight-second cut --------
  check('the display ceiling is three cards of the ten the service returns',
    /const EZIK_LESSONS_MAX = 3;/.test(appJsx) && /rows\.length >= EZIK_LESSONS_MAX/.test(drawCode));
  check('a question shorter than three characters after trimming makes no call at all',
    /const EZIK_LESSONS_MIN_Q = 3;/.test(appJsx)
    && /query\.length < EZIK_LESSONS_MIN_Q\) return \[\];/.test(drawCode)
    && /query\.length < EZIK_LESSONS_MIN_Q\) return;/.test(callCode));
  check('the client gives up at eight seconds',
    /const EZIK_LESSONS_TIMEOUT_MS = 8000;/.test(appJsx)
    && callCode.indexOf('EZIK_LESSONS_TIMEOUT_MS') !== -1);
  // SILENT FAILURE. Every path that is not a 200 with a usable list returns an empty list, and
  // an empty list draws null -- no message, no empty frame, no spinner left standing.
  check('a status other than 200 returns nothing to draw',
    /r\.status !== 200\) return \[\];/.test(drawCode));
  check('a throw on any part of the call returns nothing to draw',
    /catch \(e\) \{\s*return \[\];/.test(drawCode));
  check('an empty list draws null rather than a heading over nothing',
    /rows\.length === 0\) return null;/.test(drawCode));
  check('nothing is drawn unless a row survived the whitelist',
    /if \(rows && rows\.length\) setLessonRows\(rows\);/.test(callCode));

  // -- 5c-4. THE ORDER'S THIRD DEMAND: AbortController on the call path ----------------------
  check('an AbortController is created for the call and its signal is passed to fetch',
    callCode.indexOf('new AbortController()') !== -1
    && callCode.indexOf('controller.signal') !== -1
    && /signal,/.test(drawCode));
  check('a new question aborts the pending call and wipes the card in the same breath',
    /lessonsAbortRef\.current\.abort\(\)/.test(callCode)
    && /setLessonRows\(null\);/.test(callCode));
  check('...and the reset runs at the START of every send, beside the stream abort',
    /if \(abortRef\.current\) abortRef\.current\.abort\(\);[\s\S]{0,400}?resetLessons\(\);/.test(appJsx));
  // A LATE LANDING IS DROPPED, NOT DRAWN. The abort covers the call that is still open; the
  // generation covers the one whose promise already resolved and is a microtask from setState.
  check('a result that lands after a newer question is dropped by generation',
    /lessonsSeqRef\.current \+= 1;/.test(callCode)
    && /lessonsSeqRef\.current !== seq\) return;/.test(callCode));

  // -- 5d. the seam: after the answer, never awaited, and only under the newest reply ---------
  const fireIdx = appJsx.indexOf('startLessonsSearch(text, lessonsSeq);');
  const commitIdx = appJsx.indexOf('    markStreamedOpen(final.length - 1);');
  check('the search is fired only after the reply has been committed to the thread',
    fireIdx !== -1 && commitIdx !== -1 && fireIdx > commitIdx, 'fire=' + fireIdx + ' commit=' + commitIdx);
  check('...and it is never awaited, so it cannot delay a character of the answer',
    appJsx.indexOf('await startLessonsSearch') === -1);
  check('the card is handed to the newest bubble and to no other',
    /lessonRows=\{i === messages\.length - 1 \? lessonRows : null\}/.test(appJsx));
  check('the bubble renders the card at its tail and fetches nothing itself',
    /<EzikLessonCards rows=\{lessonRows\} \/>/.test(appJsx));

  // -- 5e. the built bundle is the one this source builds ------------------------------------
  // Gate `babel` proves app.js === build(app.jsx) byte for byte. This is the cheaper half of
  // the same statement, kept here so a stale bundle cannot pass a guard whose subject is the
  // interface: a reader is served app.js, not app.jsx.
  const appJs = readRepo('app.js');
  check('app.js was actually read', appJs.length > 100000, String(appJs.length));
  for (const marker of ['/api/lessons-search', 'ezikLessonRows', 'EzikLessonCards', 'noopener noreferrer']) {
    check('the built bundle carries ' + marker, appJs.indexOf(marker) !== -1);
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
  // The two blocks must not overlap: every assertion below would otherwise be reading item
  // 24-A's card and calling it the screen.
  check('the section and the tail card are two separate regions of the file',
    screenTo < drawFrom || screenFrom > drawTo,
    'screen=' + screenFrom + '..' + screenTo + ' card=' + drawFrom + '..' + drawTo);

  // -- 5B-1. THE ORDER'S FIRST DEMAND: registered, and ONE way in ---------------------------
  check('the app renders the screen on its own key',
    /if \(screen === 'lessons'\) return <LessonsScreen onBack=\{goEzikBack\} \/>;/.test(appJsx));
  check('...and that key is compared in exactly one place',
    (appJsx.match(/screen === 'lessons'/g) || []).length === 1,
    String((appJsx.match(/screen === 'lessons'/g) || []).length));
  check('the home offers exactly one lessons module row',
    (appJsx.match(/\{ id: 'lessons',/g) || []).length === 1,
    String((appJsx.match(/\{ id: 'lessons',/g) || []).length));
  check('...and exactly one handler sends the reader there',
    (appJsx.match(/setScreen\('lessons'\)/g) || []).length === 1,
    String((appJsx.match(/setScreen\('lessons'\)/g) || []).length));
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

  // -- 5B-6. THE TWO CALLERS OF THE ROUTE, COUNTED TOGETHER ---------------------------------
  // Section 5 counts the CARD's call site through the card's own constant. Since item 24-B
  // there are two callers of the route in the interface, and this is where that whole number
  // is stated -- so a third one cannot appear without a check going red somewhere.
  const routeCallers = (appJsx.match(/fetch\(EZIK_LESSONS_(?:SCREEN_)?ENDPOINT/g) || []);
  check('the interface calls the lessons route from exactly two places: the card and the screen',
    routeCallers.length === 2, routeCallers.join(' '));
  check('...and neither of them names the upstream service directly',
    appJsx.indexOf('lib.ezik.app/lessons') === -1);
  check('the two blocks keep their own ceilings: three for the card, ten for the screen',
    /const EZIK_LESSONS_MAX = 3;/.test(appJsx)
    && /const EZIK_LESSONS_SCREEN_LIMIT = 10;/.test(appJsx));
  check('...and their own patience: eight seconds for the card, twelve for the screen',
    /const EZIK_LESSONS_TIMEOUT_MS = 8000;/.test(appJsx)
    && /const EZIK_LESSONS_SCREEN_TIMEOUT_MS = 12000;/.test(appJsx));
  // The bundle is COMPACTED, so the source's spacing is not in it: the comparison ships as
  // screen==='lessons'. Matched on a pattern rather than on the source line, or this would be
  // a check that passed only by an accident of formatting.
  check('the built bundle carries the section, not just the source',
    appJs.indexOf('LessonsScreen') !== -1 && appJs.indexOf('ezikLessonsScreenRows') !== -1
    && /screen\s*===\s*'lessons'/.test(appJs));
  check('...and the file on disk is unchanged after all of section 5B',
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
