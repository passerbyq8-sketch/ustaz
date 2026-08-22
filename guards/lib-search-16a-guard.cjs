// guards/lib-search-16a-guard.cjs — item 16-A: the library search function and the source card.
// EXTENDED BY ITEM 16-ب (sections F and G), which measures the VIEW here rather than in a
// guard of its own: what item 16-ب exists to protect is that the view and the card agree, and
// a second file could only ever compare a copy of one of them.
//
// Section F reads app.jsx and the bundle built from it, cuts the view's own pure state function
// out of the source and evaluates it as written, and drives it against real responses this
// guard produced from the real handler. Section G boots that bundle in linkedom, mounts the
// sheet, and drives the same states through the component's own handlers.
//
// NOTE THE CORRECTION THE SECTIONS NOW ENCODE. The first cut of the view imported
// lib/lib-source-card.js into the BROWSER so the card could be built from the module that owns
// the page rule. That was withdrawn: lib/ is the server half and is not in sw.js's CORE, so a
// page reaching for it at runtime dies offline. The card is shaped in api/lib-search.js now and
// travels as the hit field source_card; F0 asserts the browser holds no runtime module load.
//
// Still no network, still no token, and still not registered in gates.json.
//
// ══ WHAT THIS GUARD IS FOR ═══════════════════════════════════════════════════
// Item 16-A adds one server function (api/lib-search.js) and one pure builder
// (lib/lib-source-card.js). Neither is wired into the answer path yet. This guard
// proves the seven cases the order names, WITHOUT A NETWORK CALL and without a real
// token — the agent that wrote it has neither. It stubs `globalThis.fetch`, which is
// the single seam every outbound call in this repo passes through, and drives the
// real exported handler against local fixtures shaped after the measured contract.
//
//   1. a hit WITH a page          -> book, author, volume, page
//   2. a hit WITHOUT a page       -> book, author, chapter path, and NO page at all
//   3. truncated                  -> a visible shortfall mark
//   4. refused                    -> a normal outcome, its own sentence, 200 not 5xx
//   5. degraded_reason            -> results shown, shortfall said out loud
//   6. SEARCH_API_TOKEN missing   -> 503, and the variable is not named to the client
//   7. 401 from the service       -> 502, ONE call, never a retry without the token
//
// Plus the assertion the whole round exists for: the token value appears in ZERO
// output of either module — no response body, no header the client can read, no log
// line. The fixture even plants the token's own value in an extra field the service
// might one day send (`server_token_hint`), so a whitelist that leaked it would fail
// here rather than in production.
//
// The fixture token is `tk-fix-9`: deliberately under sixteen characters, because the
// repo's recon secret scanner treats a 16+ character token-shaped literal as a real
// leaked credential and would red a gate over a test fixture.
//
// This guard is NOT registered in gates.json. Item 16-A adds no gate: the run-gates
// count stays 90/90 and this file is run on its own by name.
//
// Output is ASCII only, by order.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const BB = require('../tools/babel-block.cjs');

const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-lib-search-16a.json'), 'utf8'));

// A token that is not a token: short enough that the secret scanner reads it as the
// fixture it is, distinctive enough that a substring search for it is meaningful.
const FIXTURE_TOKEN = 'tk-fix-9';

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

// ── a response object shaped like the one Vercel hands a function ──────────────
function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.end = () => res;
  return res;
}

// ── drive the real handler with a stubbed fetch and a captured console ─────────
// Returns everything an assertion could want: the response, every outbound call with
// its headers and body, and every line the function logged.
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
      headers: { get: (key) => (String(key).toLowerCase() === 'content-length' ? null : null) },
      json: async () => payload
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

const serialize = (value) => JSON.stringify(value ?? null);
const mentionsToken = (value) => serialize(value).includes(FIXTURE_TOKEN);

(async function main() {
  const card = await esm('lib/lib-source-card.js');
  const api = await esm('api/lib-search.js');
  const handler = api.default;
  const { buildSourceCard, renderSourceCard, HIT_FIELDS, RESPONSE_FIELDS, REFUSED_TEXT, DEGRADED_TEXT } = card;

  // ── A. THE CONTRACT LISTS ARE THE MEASURED ONES ─────────────────────────────
  console.log('\n=== A. THE FIELD LISTS ARE THE MEASURED CONTRACT ===');
  check('response contract carries exactly 11 fields', RESPONSE_FIELDS.length === 11, 'got ' + RESPONSE_FIELDS.length);
  check('hit contract carries exactly 17 fields', HIT_FIELDS.length === 17, 'got ' + HIT_FIELDS.length);
  check('no field named book_id in either list',
    !RESPONSE_FIELDS.includes('book_id') && !HIT_FIELDS.includes('book_id'));
  check('the book name comes from book_title', HIT_FIELDS.includes('book_title'));

  // ── CASE 1. A HIT WITH A PAGE ───────────────────────────────────────────────
  console.log('\n=== CASE 1. A HIT WITH A PAGE ===');
  const citable = buildSourceCard(FIXTURES.hit_page_citable);
  const citableLine = renderSourceCard(citable);
  check('card names the book', citable.book_title === FIXTURES.hit_page_citable.book_title);
  check('card names the author', citable.author === FIXTURES.hit_page_citable.author);
  check('card carries the volume', citable.volume === 9407);
  check('card carries page_start and page_end', citable.page_start === 7301 && citable.page_end === 7302);
  check('rendered line shows the page', citableLine.includes('7301') && citableLine.includes('7302'));
  check('a null hadith_no is not carried', !('hadith_no' in citable));
  check('every card key is a measured hit field',
    Object.keys(citable).every((key) => HIT_FIELDS.includes(key)),
    Object.keys(citable).join(','));

  // ── CASE 2. A HIT WITHOUT A PAGE ────────────────────────────────────────────
  console.log('\n=== CASE 2. A HIT WITHOUT A PAGE (THE SHARP EDGE) ===');
  const uncitable = buildSourceCard(FIXTURES.hit_not_citable);
  const uncitableLine = renderSourceCard(uncitable);
  check('card names the book', uncitable.book_title === FIXTURES.hit_not_citable.book_title);
  check('card names the author', uncitable.author === FIXTURES.hit_not_citable.author);
  check('card carries the chapter path', Array.isArray(uncitable.heading_path) && uncitable.heading_path.length === 2);
  check('card carries NO page_start', !('page_start' in uncitable));
  check('card carries NO page_end', !('page_end' in uncitable));
  check('card carries NO volume', !('volume' in uncitable));
  check('the stripped page never reaches the rendered line',
    !uncitableLine.includes('7301') && !uncitableLine.includes('7302') && !uncitableLine.includes('9407'),
    uncitableLine);
  check('the hit DID carry a page, so the strip is real',
    FIXTURES.hit_not_citable.page_start === 7301 && FIXTURES.hit_not_citable.volume === 9407);

  // ── CASE 3. TRUNCATED ───────────────────────────────────────────────────────
  console.log('\n=== CASE 3. TRUNCATED ===');
  const cut = buildSourceCard(FIXTURES.hit_truncated);
  const cutLine = renderSourceCard(cut);
  check('card marks truncated', cut.truncated === true);
  check('rendered line carries a visible shortfall mark', cutLine.includes(card.TRUNCATED_TAG) && card.TRUNCATED_TAG.length > 0);
  check('a present hadith_no is shown', cut.hadith_no === '2947' && cutLine.includes('2947'));
  check('an untruncated hit carries no mark', !('truncated' in citable) && !citableLine.includes(card.TRUNCATED_TAG));

  // ── CASE 4. REFUSED ─────────────────────────────────────────────────────────
  console.log('\n=== CASE 4. REFUSED IS A NORMAL OUTCOME, NOT A FAULT ===');
  const refused = await drive(handler, { body: { q: 'الطهارة', limit: 10 }, upstream: { status: 200, payload: FIXTURES.response_refused } });
  check('status is 200, not an error status', refused.res.statusCode === 200, 'got ' + refused.res.statusCode);
  check('refused is passed through', refused.res.body.refused === true);
  check('refused_reason is the measured ceiling reason',
    refused.res.body.refused_reason === 'estimated_postings_exceed_ceiling');
  check('no fault was logged for a refusal', refused.logs.length === 0, refused.logs.join(' | '));
  check('an alternative sentence exists for the view', typeof REFUSED_TEXT === 'string' && REFUSED_TEXT.length > 0);

  // ── CASE 5. DEGRADED ────────────────────────────────────────────────────────
  console.log('\n=== CASE 5. DEGRADED RESULTS ARE SHOWN AND THE SHORTFALL IS SAID ===');
  const degradedPayload = JSON.parse(JSON.stringify(FIXTURES.response_degraded));
  degradedPayload.hits = [FIXTURES.hit_page_citable, FIXTURES.hit_not_citable];
  const degraded = await drive(handler, { body: { q: 'الصلاة' }, upstream: { status: 200, payload: degradedPayload } });
  check('status is 200', degraded.res.statusCode === 200, 'got ' + degraded.res.statusCode);
  check('degraded_reason is passed through', degraded.res.body.degraded_reason === 'over_budget');
  check('the truncated-at-budget results are still delivered', degraded.res.body.hits.length === 2);
  check('hits_dropped is passed through', degraded.res.body.hits_dropped === 37);
  check('a shortfall sentence exists for the view', typeof DEGRADED_TEXT === 'string' && DEGRADED_TEXT.length > 0);

  // ── CASE 6. THE TOKEN IS NOT CONFIGURED ─────────────────────────────────────
  console.log('\n=== CASE 6. SEARCH_API_TOKEN MISSING ===');
  const noToken = await drive(handler, { body: { q: 'الزكاة' }, token: null, upstream: { status: 200, payload: FIXTURES.response_ok } });
  check('status is 503', noToken.res.statusCode === 503, 'got ' + noToken.res.statusCode);
  check('the service was never called', noToken.calls.length === 0, 'calls=' + noToken.calls.length);
  check('the client body does not name the variable', !serialize(noToken.res.body).includes('SEARCH_API_TOKEN'));
  check('the client body does not name the service host', !serialize(noToken.res.body).includes('lib.ezik.app'));
  check('the reason is in the server log instead',
    noToken.logs.some((line) => line.includes('search_api_token_missing')), noToken.logs.join(' | '));

  // ── CASE 7. THE SERVICE ANSWERS 401 ─────────────────────────────────────────
  console.log('\n=== CASE 7. 401 FROM THE SERVICE ===');
  const rejected = await drive(handler, { body: { q: 'الصيام' }, upstream: { status: 401, payload: { error: 'unauthorized' } } });
  check('status to the client is 502', rejected.res.statusCode === 502, 'got ' + rejected.res.statusCode);
  check('exactly ONE outbound call - no retry without the token', rejected.calls.length === 1, 'calls=' + rejected.calls.length);
  check('the sole call carried the token', String(rejected.calls[0].init.headers.authorization || '').includes(FIXTURE_TOKEN));
  check('the client body does not carry the upstream status word',
    !serialize(rejected.res.body).includes('unauthorized') && !serialize(rejected.res.body).includes('401'));
  check('the client body does not name the service host', !serialize(rejected.res.body).includes('lib.ezik.app'));

  // ── B. THE MEASURED AUTH HEADER IS THE ONE ON THE WIRE ───────────────────────
  console.log('\n=== B. THE AUTH HEADER IS THE ONE MEASURED IN server.mjs ===');
  const ok = await drive(handler, { body: { q: 'النية', limit: 3 }, upstream: { status: 200, payload: FIXTURES.response_with_unknown_fields } });
  const sent = ok.calls[0];
  check('the call goes to the measured search endpoint', sent.url === 'https://lib.ezik.app/search', sent.url);
  check('the method is POST', sent.init.method === 'POST');
  check('the header name is authorization', Object.keys(sent.init.headers).some((k) => k.toLowerCase() === 'authorization'));
  check('the value is the token behind the exact prefix "Bearer "',
    sent.init.headers.authorization === 'Bearer ' + FIXTURE_TOKEN, ascii(String(sent.init.headers.authorization)));
  check('content-type is application/json', String(sent.init.headers['content-type']).includes('application/json'));
  const sentBody = JSON.parse(sent.init.body);
  check('the request body carries q and limit only',
    Object.keys(sentBody).sort().join(',') === 'limit,q', Object.keys(sentBody).join(','));
  check('limit is honoured', sentBody.limit === 3);

  // ── C. THE WHITELIST ────────────────────────────────────────────────────────
  console.log('\n=== C. ELEVEN FIELDS OUT, SEVENTEEN PER HIT, NOTHING INVENTED ===');
  const shaped = ok.res.body;
  check('every top-level key is one of the eleven, or one of the two this repo adds by name',
    Object.keys(shaped).every((key) => RESPONSE_FIELDS.includes(key)
      || api.ADDED_RESPONSE_FIELDS.includes(key)), Object.keys(shaped).join(','));
  check('...and the two it may add are exactly refused_text and degraded_text',
    api.ADDED_RESPONSE_FIELDS.slice().sort().join(',') === 'degraded_text,refused_text',
    api.ADDED_RESPONSE_FIELDS.join(','));
  check('an unknown top-level field is dropped in silence', !('shard_host' in shaped));
  check('every hit key is one of the seventeen, or the one field this repo adds by name',
    Object.keys(shaped.hits[0]).every((key) => HIT_FIELDS.includes(key)
      || key === api.ADDED_HIT_FIELD), Object.keys(shaped.hits[0]).join(','));
  check('...and the one it may add is exactly source_card',
    api.ADDED_HIT_FIELD === 'source_card', String(api.ADDED_HIT_FIELD));
  check('...and it is an ADDITION: every field the service sent is still on the hit',
    HIT_FIELDS.every((f) => (FIXTURES.response_with_unknown_fields.hits[0][f] != null)
      ? (f in shaped.hits[0]) : true));
  check('book_id is dropped from the hit', !('book_id' in shaped.hits[0]));
  check('an unknown hit field is dropped', !('internal_offset' in shaped.hits[0]));
  check('a field the service omitted stays omitted - not invented',
    !('hadith_no' in shaped.hits[0]) && !('hadith_no' in FIXTURES.response_with_unknown_fields.hits[0]));
  check('no field named book_id anywhere in the output', !serialize(shaped).includes('book_id'));

  // ── D. THE ROUND EXISTS FOR THIS ONE ASSERTION ──────────────────────────────
  console.log('\n=== D. ZERO APPEARANCE OF THE TOKEN IN ANY OUTPUT ===');
  const everyBody = [refused.res.body, degraded.res.body, noToken.res.body, rejected.res.body, ok.res.body];
  check('the token is in no response body', everyBody.every((body) => !mentionsToken(body)));
  check('the token is in no response header',
    [refused.res.headers, degraded.res.headers, noToken.res.headers, rejected.res.headers, ok.res.headers]
      .every((headers) => !mentionsToken(headers)));
  check('the token is in no log line',
    [refused.logs, degraded.logs, noToken.logs, rejected.logs, ok.logs].every((lines) => !lines.join(' ').includes(FIXTURE_TOKEN)));
  check('the token planted in an extra service field is dropped, not forwarded',
    FIXTURES.response_with_unknown_fields.server_token_hint === FIXTURE_TOKEN && !mentionsToken(ok.res.body));
  check('the card builder never sees or emits a token',
    !mentionsToken(citable) && !mentionsToken(uncitable) && !mentionsToken(cut) &&
    !citableLine.includes(FIXTURE_TOKEN) && !uncitableLine.includes(FIXTURE_TOKEN) && !cutLine.includes(FIXTURE_TOKEN));
  check('no source file in this round contains a token literal',
    !fs.readFileSync(path.join(REPO, 'api/lib-search.js'), 'utf8').includes(FIXTURE_TOKEN) &&
    !fs.readFileSync(path.join(REPO, 'lib/lib-source-card.js'), 'utf8').includes(FIXTURE_TOKEN));

  // ── E. THE REQUEST GATE ─────────────────────────────────────────────────────
  console.log('\n=== E. METHOD, q AND limit ===');
  const notPost = await drive(handler, { method: 'GET', body: { q: 'x' }, upstream: { status: 200, payload: FIXTURES.response_ok } });
  check('a non-POST method is 405', notPost.res.statusCode === 405, 'got ' + notPost.res.statusCode);
  check('a non-POST method never reaches the service', notPost.calls.length === 0);
  const noQ = await drive(handler, { body: { limit: 5 }, upstream: { status: 200, payload: FIXTURES.response_ok } });
  check('a request with no q is 400', noQ.res.statusCode === 400, 'got ' + noQ.res.statusCode);
  const blankQ = await drive(handler, { body: { q: '   ' }, upstream: { status: 200, payload: FIXTURES.response_ok } });
  check('q that is blank after trimming is 400', blankQ.res.statusCode === 400, 'got ' + blankQ.res.statusCode);
  check('a rejected request never reaches the service', noQ.calls.length === 0 && blankQ.calls.length === 0);
  check('limit ceiling is 10', api.normalizeLimit(500) === 10 && api.normalizeLimit(11) === 10);
  check('limit defaults to 10', api.normalizeLimit(undefined) === 10 && api.normalizeLimit('nonsense') === 10);
  check('limit is an integer', api.normalizeLimit(4.9) === 4);
  const unreachable = await drive(handler, { body: { q: 'الحج' }, upstream: new Error('connect ECONNREFUSED lib.ezik.app') });
  check('an unreachable service is 502 to the client', unreachable.res.statusCode === 502, 'got ' + unreachable.res.statusCode);
  check('the unreachable error text does not reach the client',
    !serialize(unreachable.res.body).includes('ECONNREFUSED') && !serialize(unreachable.res.body).includes('lib.ezik.app'));


  // ── F. ITEM 16-ب: THE VIEW THAT WAS WIRED ONTO THIS FUNCTION ────────────────
  // Item 16-ب adds one sheet to app.jsx. Its FIRST cut built the card in the browser by
  // importing lib/lib-source-card.js at runtime; that was withdrawn, because lib/ is the
  // server half and is not in the service worker's CORE, so the page broke offline. The
  // card is shaped HERE, on the server, and the browser draws it. Everything below is
  // measured against the SHIPPED SOURCE -- app.jsx and the bundle built from it -- and
  // against a real shaped response. No browser, no network, no token.
  console.log('\n=== F. 16-B: THE VIEW ===');

  const APPJSX = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
  const APPJS = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');

  // The library block, cut out of app.jsx by its own two ends. Every assertion about
  // "the view" below is scoped to THESE bytes, so a page number legitimately printed by
  // the mushaf on the other side of the file cannot make this section pass or fail.
  const BLOCK_OPEN = "const EZLIB_ROUTE = '/api/lib-search';";
  const BLOCK_SHUT = 'function LibrarySheet({ onClose }) {';
  const blockFrom = APPJSX.indexOf(BLOCK_OPEN);
  const sheetFrom = APPJSX.indexOf(BLOCK_SHUT);
  const sheetTo = APPJSX.indexOf('\n}\n', sheetFrom);
  check('the library block is in app.jsx exactly once',
    blockFrom !== -1 && sheetFrom !== -1 && sheetTo !== -1 &&
    APPJSX.indexOf(BLOCK_OPEN, blockFrom + 1) === -1 &&
    APPJSX.indexOf(BLOCK_SHUT, sheetFrom + 1) === -1);
  const VIEW = APPJSX.slice(blockFrom, sheetTo + 3);

  // ── F0. NOTHING IN THE BROWSER REACHES FOR A MODULE AT RUNTIME ──────────────
  // This is the assertion the correction exists for. lib/ is the server half: it is not
  // in sw.js's CORE, so a page that fetches it at runtime is a page that dies offline.
  // The count is measured over the WHOLE of app.jsx, not just the library block.
  const importSites = (APPJSX.match(/(^|[^.\w])import\s*\(/g) || []).length;
  check('DYNAMIC_IMPORT_SITES_AFTER = 0 in app.jsx', importSites === 0, 'found ' + importSites);
  check('...and 0 in the bundle the browser actually loads',
    (APPJS.match(/(^|[^.\w])import\s*\(/g) || []).length === 0);
  check('...and the browser names no path under lib/ at all',
    !/['"]\/?lib\//.test(APPJSX) && !/['"]\/?lib\//.test(APPJS));
  check('...so nothing the page needs sits outside the service worker CORE',
    !fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8').includes("'/lib/"));

  // ── F1. the token's host is not in the client, at all ───────────────────────
  const LIB_HOST = ['lib', 'ezik', 'app'].join('.');
  const hostInJsx = (APPJSX.match(new RegExp(LIB_HOST.replace(/\./g, '\\.'), 'g')) || []).length;
  const hostInJs = (APPJS.match(new RegExp(LIB_HOST.replace(/\./g, '\\.'), 'g')) || []).length;
  check('LIB_HOST_IN_APPJSX = 0', hostInJsx === 0, 'found ' + hostInJsx);
  check('...and 0 in the bundle the browser actually loads', hostInJs === 0, 'found ' + hostInJs);
  check('the client speaks to this repo\'s own function and to nothing else',
    (APPJSX.match(/'\/api\/lib-search'/g) || []).length === 1);
  check('...and no token literal reached the client',
    !APPJSX.includes('SEARCH_API_TOKEN') && !APPJS.includes('SEARCH_API_TOKEN'));

  // ── F2. CARD_TEXT_IN_APPJSX = 0 ─────────────────────────────────────────────
  // Two sets of words may never be written in the view: the sentences the card module
  // owns, and the sentences the server function sends on a failure. Either one copied
  // into app.jsx is a second source of truth, and the copy that drifts is always the
  // view's. The view carries FIELD NAMES instead, checked against a real payload below.
  const cardMod = await esm('lib/lib-source-card.js');
  const OWNED = [cardMod.REFUSED_TEXT, cardMod.DEGRADED_TEXT, cardMod.TRUNCATED_TAG];
  let cardTextInAppJsx = 0;
  for (const owned of OWNED) {
    if (APPJSX.includes(owned)) cardTextInAppJsx += 1;
    check('the module sentence ' + JSON.stringify(ascii(owned)) + ' is NOT written in app.jsx',
      !APPJSX.includes(owned));
  }
  // The sentences api/lib-search.js sends, read off the function's own source rather than
  // retyped here -- a retyped copy would rot the moment the function changed.
  const apiSrc = fs.readFileSync(path.join(REPO, 'api/lib-search.js'), 'utf8');
  const apiMessages = (apiSrc.match(/message:\s*'([^']+)'/g) || [])
    .map((m) => m.replace(/^message:\s*'/, '').replace(/'$/, ''));
  check('the function\'s failure sentences were located in its source', apiMessages.length >= 4,
    'found ' + apiMessages.length);
  for (const msg of apiMessages) {
    if (APPJSX.includes(msg)) cardTextInAppJsx += 1;
  }
  check('none of the function\'s own sentences is written in app.jsx either',
    apiMessages.every((msg) => !APPJSX.includes(msg)));
  check('CARD_TEXT_IN_APPJSX = 0', cardTextInAppJsx === 0, 'found ' + cardTextInAppJsx);
  check('the view names the response fields rather than quoting them',
    VIEW.includes("'refused_text'") && VIEW.includes("'degraded_text'"));
  check('...and it draws the card line off the hit rather than assembling one',
    VIEW.includes('card.line') && !/\+\s*' · '/.test(VIEW));

  // ── F3. the states the order names, driven through the shipped code ─────────
  // ezLibViewState and ezLibSentence are cut out of app.jsx and evaluated as they are
  // written -- not reimplemented here. A change to either in the view changes what this
  // section measures. They are driven against REAL shaped responses from the function.
  const pureFrom = APPJSX.indexOf(BLOCK_OPEN);
  const pureTo = APPJSX.indexOf('// The one call, and it is made on submit');
  check('the pure half of the view carries no JSX', pureTo > pureFrom &&
    !/<[A-Za-z]/.test(APPJSX.slice(pureFrom, pureTo)));
  const view = vm.runInNewContext(
    APPJSX.slice(pureFrom, pureTo)
    + '\n;({ ezLibViewState: ezLibViewState, ezLibSentence: ezLibSentence, ezLibCardLine: ezLibCardLine });',
    {}, { filename: 'app.jsx#library' });

  // WHAT THE BROWSER REALLY RECEIVES, produced by the real shapeSearchResponse and by the
  // real handler -- not hand-written here.
  const okBody = api.shapeSearchResponse(Object.assign({}, FIXTURES.response_ok,
    { hits: [FIXTURES.hit_page_citable, FIXTURES.hit_not_citable] }));
  const degradedBody = api.shapeSearchResponse(Object.assign({}, FIXTURES.response_degraded,
    { hits: [FIXTURES.hit_page_citable] }));
  const refusedBody = api.shapeSearchResponse(FIXTURES.response_refused);
  const emptyBody = api.shapeSearchResponse(FIXTURES.response_ok);
  const unavailableBody = noToken.res.body;
  const upstreamBody = unreachable.res.body;

  const states = {
    refused: view.ezLibViewState({ status: 200, payload: refusedBody }),
    degraded: view.ezLibViewState({ status: 200, payload: degradedBody }),
    unavailable: view.ezLibViewState({ status: 503, payload: unavailableBody }),
    upstream: view.ezLibViewState({ status: 502, payload: upstreamBody }),
    offline: view.ezLibViewState({ status: 0, payload: null }),
    ok: view.ezLibViewState({ status: 200, payload: okBody }),
    empty: view.ezLibViewState({ status: 200, payload: emptyBody }),
  };

  // 1. refused -- a calm sentence, the MODULE's sentence, carried by the server.
  check('refused: true is its own state', states.refused.kind === 'refused', states.refused.kind);
  check('...the server put the module\'s REFUSED_TEXT on the body',
    refusedBody.refused_text === cardMod.REFUSED_TEXT);
  check('...and the view draws exactly that, byte for byte',
    view.ezLibSentence(states.refused, refusedBody) === cardMod.REFUSED_TEXT);
  check('...and it offers no retry, because the ceiling is not a fault', states.refused.retry === false);
  check('...and degraded_text was NOT put on a refused body', !('degraded_text' in refusedBody));

  // 2. degraded -- results ARE shown, and the shortfall is said out loud.
  check('degraded_reason is its own state', states.degraded.kind === 'degraded', states.degraded.kind);
  check('...and the results are still shown', states.degraded.showHits === true);
  check('...the server put the module\'s DEGRADED_TEXT on the body',
    degradedBody.degraded_text === cardMod.DEGRADED_TEXT);
  check('...and the view draws exactly that, byte for byte',
    view.ezLibSentence(states.degraded, degradedBody) === cardMod.DEGRADED_TEXT);
  check('...and refused_text was NOT put on a degraded body', !('refused_text' in degradedBody));
  check('...and neither sentence rides on an ordinary 200',
    !('refused_text' in okBody) && !('degraded_text' in okBody));

  // 3. 503 -- no token. Neutral, and it names no environment variable.
  check('503 is a neutral state, not an error state', states.unavailable.kind === 'unavailable');
  const unavailableText = view.ezLibSentence(states.unavailable, unavailableBody);
  check('...and its sentence is the server\'s, not the view\'s',
    unavailableText === unavailableBody.error.message && unavailableText.length > 0);
  check('...and it names no environment variable',
    !/[A-Z][A-Z0-9_]{6,}/.test(unavailableText) && !unavailableText.includes('TOKEN'),
    unavailableText);
  check('...and it offers no retry, because retrying cannot add a token',
    states.unavailable.retry === false);

  // 4. 502 / a dead network -- neutral, and retryable.
  check('502 is neutral and retryable', states.upstream.kind === 'upstream' && states.upstream.retry === true);
  check('...and its sentence is the server\'s, not the view\'s',
    view.ezLibSentence(states.upstream, upstreamBody) === upstreamBody.error.message);
  check('a network that never answered lands in the same state',
    states.offline.kind === 'upstream' && states.offline.retry === true);
  check('...and with no body there is NO sentence, not an invented one',
    view.ezLibSentence(states.offline, null) === '');
  check('...and neither names a host',
    !view.ezLibSentence(states.upstream, upstreamBody).includes(LIB_HOST));
  check('a malformed 200 is treated as a dead answer, not as zero results',
    view.ezLibViewState({ status: 200, payload: null }).kind === 'upstream');

  // and the ordinary cases
  check('a plain 200 with hits shows them', states.ok.kind === 'ok' && states.ok.showHits === true);
  check('a plain 200 with no hits is not an error', states.empty.kind === 'empty');
  check('...and it names no field, so no sentence is invented for it',
    states.empty.textFrom === null && view.ezLibSentence(states.empty, emptyBody) === '');

  // ── F4. ZERO PAGE CLAIM, SHAPED ON THE SERVER ───────────────────────────────
  // The not-citable fixture CARRIES a page: volume 9407, pages 7301-7302. Those three
  // numbers are what a leak would look like, so they are what is searched for -- in the
  // card the SERVER built and in the line the SERVER rendered.
  const LEAK = [FIXTURES.hit_not_citable.volume, FIXTURES.hit_not_citable.page_start,
    FIXTURES.hit_not_citable.page_end].map(String);
  const leaks = (value) => LEAK.filter((n) => serialize(value).includes(n));

  const citableHit = okBody.hits[0];
  const notCitableHit = okBody.hits[1];
  check('the not-citable fixture really does carry a page to leak',
    FIXTURES.hit_not_citable.page_citable === false && FIXTURES.hit_not_citable.page_start != null);
  check('the server attached a card to every hit',
    !!citableHit.source_card && !!notCitableHit.source_card);
  check('PAGE_SHOWN_WHEN_NOT_CITABLE = 0 in the card the server built',
    leaks(notCitableHit.source_card).length === 0,
    'leaked ' + leaks(notCitableHit.source_card).join(','));
  check('...and 0 in the line the server rendered',
    leaks(notCitableHit.source_card.line).length === 0,
    'leaked ' + leaks(notCitableHit.source_card.line).join(','));
  check('...and the card carries no page KEY at all, not merely no value',
    !('volume' in notCitableHit.source_card) && !('page_start' in notCitableHit.source_card)
    && !('page_end' in notCitableHit.source_card));
  check('...and the chapter path is named instead, so the card is not merely emptied',
    notCitableHit.source_card.line.includes(FIXTURES.hit_not_citable.heading_path[1]));
  check('...while a citable hit still gets its page',
    citableHit.source_card.line.includes(String(FIXTURES.hit_page_citable.page_start)));
  check('THE SEVENTEEN SURVIVE: the hit still carries its own page fields untouched',
    notCitableHit.page_start === FIXTURES.hit_not_citable.page_start &&
    notCitableHit.page_end === FIXTURES.hit_not_citable.page_end &&
    notCitableHit.volume === FIXTURES.hit_not_citable.volume);
  check('...so source_card is an ADDITION, not a replacement',
    HIT_FIELDS.every((f) => (FIXTURES.hit_not_citable[f] != null) ? (f in notCitableHit) : true));
  check('the card names no token and no host',
    !serialize(okBody).includes(LIB_HOST) && !serialize(okBody).includes(FIXTURE_TOKEN));

  // The view is not allowed to reach for a page field on its own, either.
  for (const field of ['page_start', 'page_end', 'volume', 'page_citable']) {
    check('the view never reads hit.' + field, !new RegExp('\\.' + field + '\\b').test(VIEW));
  }
  check('the view drops a hit whose card did not arrive rather than drawing it bare',
    view.ezLibCardLine({ text: 'x' }) === '' && VIEW.includes('.filter((row) => row.card)'));

  // ── F5. THE MUTANT: MAKE THE SERVER PASS THE PAGE, AND THE GUARD MUST BITE ──
  // api/lib-search.js is mutated IN MEMORY so its shaping keeps the page on a hit that is
  // not page-citable, and the same assertions are run against it. If the mutant passes,
  // the assertions above were measuring nothing.
  const apiLf = apiSrc.replace(/\r\n/g, '\n');
  const MUT_FROM = 'const card = buildSourceCard(shaped);';
  const MUT_TO = 'const card = Object.assign({}, buildSourceCard(shaped), '
    + '{ page_citable: true, volume: shaped.volume, page_start: shaped.page_start, '
    + 'page_end: shaped.page_end });';
  const mutantSrc = apiLf.replace(MUT_FROM, MUT_TO);
  check('the server mutant is a real mutation, not a no-op',
    mutantSrc !== apiLf && mutantSrc.includes('page_citable: true'),
    'mutation did not change the source');
  // A data: URL has no directory, so the module's relative dependency is made absolute.
  const mutantResolved = mutantSrc.replace("} from '../lib/lib-source-card.js';",
    "} from '" + ('file://' + path.join(REPO, 'lib/lib-source-card.js').replace(/\\/g, '/')) + "';");
  const mutantApi = await import('data:text/javascript;base64,'
    + Buffer.from(mutantResolved, 'utf8').toString('base64'));
  const mutantBody = mutantApi.shapeSearchResponse(Object.assign({}, FIXTURES.response_ok,
    { hits: [FIXTURES.hit_not_citable] }));
  const mutantCard = mutantBody.hits[0].source_card;
  check('THE GUARD BITES: the mutated server leaks the page into the card',
    !!mutantCard && leaks(mutantCard).length > 0,
    'the mutant produced ' + ascii(serialize(mutantCard)) + ' and the page assertion still passed');
  check('...and into the rendered line, which is what a reader would have seen',
    !!mutantCard && leaks(mutantCard.line).length > 0,
    'the mutant line was ' + ascii(String(mutantCard && mutantCard.line)));
  check('...and the real function, re-read after the mutation, is unchanged',
    fs.readFileSync(path.join(REPO, 'api/lib-search.js'), 'utf8') === apiSrc);

  // A second mutant, on the OTHER side of the seam: a view that composes its own line.
  const viewMutant = VIEW.replace('<div style={s.ezlibCard}',
    '<div>{hit.page_start}</div><div style={s.ezlibCard}');
  check('the view mutant is a real mutation, not a no-op', viewMutant !== VIEW);
  check('THE GUARD BITES: a view that reaches for a page field is caught',
    /\.page_start\b/.test(viewMutant));

  // ── F6. ZERO CALLS ON BOOT ──────────────────────────────────────────────────
  // Measured on the syntax tree of the shipped source, not by reading it. The route is
  // reached through exactly one function, that function is called from exactly one
  // place, and that place is inside the sheet -- which does not exist until a reader
  // opens it.
  const ast = BB.parseBabelBlock({ raw: APPJSX, runtime: 'classic' });
  const callSites = [];
  (function walk(node, stack) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n, stack); return; }
    if (!node.type) return;
    const named = (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression')
      && node.id && node.id.name;
    const varFn = node.type === 'VariableDeclarator' && node.id && node.id.name
      && node.init && /Function/.test(node.init.type) && node.id.name;
    const here = named || varFn ? stack.concat([named || varFn]) : stack;
    if (node.type === 'CallExpression' && node.callee && node.callee.name === 'ezLibSearchCall') {
      callSites.push(here.slice());
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      walk(node[key], here);
    }
  })(ast.program, []);
  check('the route is reached through exactly one call site', callSites.length === 1,
    'found ' + callSites.length);
  const chain = callSites[0] || [];
  check('CALLS_ON_BOOT = 0: that call site is inside the sheet, not at module scope',
    chain.includes('LibrarySheet') && chain.includes('run'), chain.join(' > '));
  check('...and the sheet is only rendered behind a reader\'s tap',
    /if \(libraryOpen\) return <LibrarySheet/.test(APPJSX) &&
    APPJSX.includes('onOpenLibrary: () => setLibraryOpen(true)'));
  // What must not exist outside the block is a REFERENCE: no other code may hold the
  // address or the call.
  const OUTSIDE = APPJSX.slice(0, blockFrom) + APPJSX.slice(sheetTo + 3);
  check('...and no code outside the library block reaches the route',
    !OUTSIDE.includes('EZLIB_ROUTE') && !OUTSIDE.includes('ezLibSearchCall') &&
    !OUTSIDE.includes("'/api/lib-search'"));

  // ── F7. the bundle on disk is what this source builds ───────────────────────
  const built = require(path.join(REPO, 'tools/build-app.cjs')).check();
  check('app.js is exactly what app.jsx builds', built.ok, built.reason);
  check('...and the sheet really is in it', APPJS.includes('LibrarySheet'));

  // ── G. THE SHEET, RENDERED ──────────────────────────────────────────────────
  // Section F proves the DECISION is right. This one proves there is a screen: the
  // shipped bundle is booted in a linkedom document with the vendored React, the sheet is
  // mounted on its own, and each state is driven through the component's own handlers
  // with /api/lib-search answering exactly what the real function would answer. Nothing
  // is stubbed inside the sheet any more -- the correction removed the one seam that
  // needed stubbing -- so what runs here is the shipped component end to end.
  console.log('\n=== G. THE SHEET, RENDERED ===');

  const { parseHTML } = require(path.join(REPO, 'node_modules', 'linkedom'));
  const gNet = [];
  let gNext = { status: 200, payload: null };

  const { window: gWin } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  gWin.self = gWin; gWin.window = gWin; gWin.globalThis = gWin;
  gWin.matchMedia = (q) => ({ matches: false, media: String(q), addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} });
  gWin.scrollTo = () => {};
  const gEP = gWin.Element && gWin.Element.prototype;
  if (gEP && !gEP.scrollIntoView) gEP.scrollIntoView = function () {};
  const gData = {};
  gWin.localStorage = { getItem: (k) => (k in gData ? gData[k] : null), setItem: (k, v) => { gData[k] = String(v); },
    removeItem: (k) => { delete gData[k]; }, clear: () => { for (const k in gData) delete gData[k]; } };
  gWin.AbortController = AbortController;
  // The ONE seam, and it is the network itself. Every answer below is a body the real
  // function produced earlier in this run.
  gWin.fetch = function (u, init) {
    gNet.push({ url: String(u), method: (init && init.method) || 'GET', body: init && init.body });
    if (gNext instanceof Error) return Promise.reject(gNext);
    return Promise.resolve({
      ok: gNext.status >= 200 && gNext.status < 300,
      status: gNext.status,
      headers: { get: () => null },
      json: () => Promise.resolve(gNext.payload),
    });
  };
  global.window = gWin; global.document = gWin.document;
  try { Object.defineProperty(global, 'navigator', { value: gWin.navigator, configurable: true }); } catch (e) {}

  const gCtx = vm.createContext(gWin);
  for (const umd of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(REPO, 'vendor', umd), 'utf8'), gCtx, { filename: umd });
  }
  // The bundle mounts the whole app on load. The real createRoot is kept aside and replaced
  // with a stub so that boot mounts nothing; the sheet is then mounted on its own, below.
  vm.runInContext('__realCreateRoot = ReactDOM.createRoot; ReactDOM.createRoot = function () '
    + '{ return { render: function () {}, unmount: function () {} }; };', gCtx);
  gWin.console.error = () => {};

  const gBlock = BB.readBabelBlock();
  const gCode = BB.transformBabelBlock(
    { raw: gBlock.raw.replace(/\r\n/g, '\n'), runtime: gBlock.runtime },
    { retainLines: false, configFile: false, babelrc: false });
  let gBooted = true;
  try { vm.runInContext(gCode, gCtx, { filename: 'app.jsx' }); }
  catch (e) { gBooted = false; console.log('        ' + ascii(String(e && e.message || e))); }
  check('the shipped bundle boots', gBooted);

  const gTick = (ms) => new Promise((r) => setTimeout(r, ms || 30));
  const gHost = gWin.document.getElementById('root');
  const Sheet = vm.runInContext('LibrarySheet', gCtx);
  check('the sheet component is in the shipped bundle', typeof Sheet === 'function');

  const gRoot = gWin.__realCreateRoot(gHost);
  gRoot.render(gWin.React.createElement(Sheet, { onClose: () => {} }));
  await gTick(80);
  const gInput = gHost.querySelector('input[type="search"]');
  const gForm = gHost.querySelector('form');
  check('the sheet renders a search field and a form', !!gInput && !!gForm,
    gHost.innerHTML.slice(0, 160));
  // THE SHEET IS OPEN AND NOTHING HAS BEEN TYPED. It must not have fetched anything at
  // all -- not the route, and not a module: opening it is no longer a network event.
  check('CALLS_ON_BOOT = 0, measured on a rendered sheet with nothing typed',
    gNet.length === 0, JSON.stringify(gNet));

  // linkedom delivers a dispatched click through React's delegation, but not a dispatched
  // 'input' or 'submit'. So the component's OWN handlers are taken off the props React
  // attached to the real nodes and invoked directly: what runs is the shipped onChange and
  // the shipped onSubmit, not a reimplementation of either.
  const propsOf = (el) => el[Object.keys(el).filter((k) => k.indexOf('__reactProps$') === 0)[0]];
  check('the shipped handlers are reachable on the rendered nodes',
    !!(propsOf(gInput) && propsOf(gInput).onChange && propsOf(gForm) && propsOf(gForm).onSubmit));
  const ask = async (term, next) => {
    gNext = next;
    propsOf(gInput).onChange({ target: { value: term } });
    await gTick(25);
    propsOf(gForm).onSubmit({ preventDefault: () => {} });
    for (let i = 0; i < 60; i++) { await gTick(15); if (!gHost.textContent.includes('يجري')) break; }
    await gTick(40);
    return gHost.textContent;
  };

  let screen = await ask('السهو', { status: 200, payload: refusedBody });
  check('SCREEN refused: the module\'s own sentence is on it, carried by the server',
    screen.includes(cardMod.REFUSED_TEXT), ascii(screen.slice(0, 240)));

  screen = await ask('الصلاة', { status: 200, payload: degradedBody });
  check('SCREEN degraded: the shortfall is on it', screen.includes(cardMod.DEGRADED_TEXT));
  check('...and the results are on it too, not withheld',
    screen.includes(FIXTURES.hit_page_citable.book_title));

  screen = await ask('الزكاة', { status: 503, payload: unavailableBody });
  check('SCREEN 503: the server\'s neutral sentence is on it',
    screen.includes(unavailableBody.error.message), ascii(screen.slice(0, 240)));
  check('...and no environment variable is named', !/[A-Z][A-Z0-9_]{6,}/.test(screen));

  screen = await ask('الحج', { status: 502, payload: upstreamBody });
  check('SCREEN 502: the server\'s neutral sentence, and a retry is offered',
    screen.includes(upstreamBody.error.message) && screen.includes('أعد المحاولة'));

  screen = await ask('الصوم', new Error('network down'));
  check('SCREEN offline: no body came, so NO sentence is drawn and none is invented',
    !screen.includes(upstreamBody.error.message) && !screen.includes(cardMod.REFUSED_TEXT));
  check('...but the retry is still there, so the reader is not stranded',
    screen.includes('أعد المحاولة'));

  screen = await ask('السهو', { status: 200, payload: okBody });
  check('SCREEN ok: both hits are drawn',
    screen.includes(FIXTURES.hit_page_citable.book_title) && screen.includes(FIXTURES.hit_not_citable.book_title));
  check('...and each carries the line the SERVER rendered, byte for byte',
    screen.includes(okBody.hits[0].source_card.line) && screen.includes(okBody.hits[1].source_card.line));
  check('...and the citable hit shows its page',
    screen.includes('ص ' + FIXTURES.hit_page_citable.page_start));

  // THE TWO FIXTURES CARRY THE SAME VOLUME AND THE SAME PAGES (9407, 7301-7302), so a screen
  // holding both cannot tell a legitimate page from a leaked one. The not-citable hit is drawn
  // ALONE: on THIS screen, every one of those three numbers would be a leak.
  const aloneBody = api.shapeSearchResponse(Object.assign({}, FIXTURES.response_ok,
    { hits: [FIXTURES.hit_not_citable] }));
  const alone = await ask('السهو', { status: 200, payload: aloneBody });
  check('PAGE_SHOWN_WHEN_NOT_CITABLE = 0, ON THE RENDERED SCREEN',
    LEAK.every((n) => !alone.includes(n)), 'leaked ' + LEAK.filter((n) => alone.includes(n)).join(','));
  check('...and the chapter path is on the screen instead',
    alone.includes(FIXTURES.hit_not_citable.heading_path[1]));
  check('...and the matn is on it, so the card was not simply dropped',
    alone.includes(FIXTURES.hit_not_citable.text));

  // AND THE SCREEN IS NOT ALLOWED TO INVENT A CARD when the server sent none.
  const cardlessBody = JSON.parse(serialize(aloneBody));
  delete cardlessBody.hits[0].source_card;
  const cardless = await ask('السهو', { status: 200, payload: cardlessBody });
  check('a hit whose card did not arrive is NOT drawn bare',
    !cardless.includes(FIXTURES.hit_not_citable.text),
    ascii(cardless.slice(0, 240)));

  check('every call the screen made went to this repo\'s own route, by POST',
    gNet.length > 0 && gNet.every((c) => c.url === '/api/lib-search' && c.method === 'POST'),
    JSON.stringify(gNet.map((c) => c.url + ' ' + c.method)));
  check('...carrying q and limit 10, and nothing else',
    gNet.every((c) => {
      try {
        const b = JSON.parse(c.body);
        return typeof b.q === 'string' && b.limit === 10 && Object.keys(b).sort().join(',') === 'limit,q';
      } catch (e) { return false; }
    }));
  check('...and no token, and no service host, ever left the browser',
    !gNet.some((c) => String(c.body || '').includes(LIB_HOST) || String(c.url).includes(LIB_HOST)));
  check('...and not one request went anywhere under lib/',
    !gNet.some((c) => /\/lib\//.test(String(c.url))));

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' - FAIL ===' : ' - PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
