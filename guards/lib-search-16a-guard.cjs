// guards/lib-search-16a-guard.cjs — item 16-A: the library search function and the source card.
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
  check('every top-level key is one of the eleven',
    Object.keys(shaped).every((key) => RESPONSE_FIELDS.includes(key)), Object.keys(shaped).join(','));
  check('an unknown top-level field is dropped in silence', !('shard_host' in shaped));
  check('every hit key is one of the seventeen',
    Object.keys(shaped.hits[0]).every((key) => HIT_FIELDS.includes(key)), Object.keys(shaped.hits[0]).join(','));
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

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' - FAIL ===' : ' - PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
