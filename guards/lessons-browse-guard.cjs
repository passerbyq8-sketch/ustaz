// guards/lessons-browse-guard.cjs -- offline proof of the lessons browse edge.
//
// The real handler is driven only with a local fetch stub and artificial fixtures. The guard
// checks the source contract as well as runtime behavior, then loads two in-memory mutants:
// one leaks snippet and one admits a fourth level. Nothing is written during the run.

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const scan = require('./telemetry-scan-lib.cjs');

const REPO = path.resolve(__dirname, '..');
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

const FIXTURE_PATH = 'guards/fixtures-lessons-browse.json';
const FIXTURE_SRC = readRepo(FIXTURE_PATH);
const FIXTURES = JSON.parse(FIXTURE_SRC);
const FIXTURE_TOKEN = 'tk-br-7';
const THROW_MARKER = 'FETCH-EXCEPTION-TEXT-MUST-NOT-PASS';
const FORBIDDEN_TEXT_FIELDS = Object.freeze(['snippet', 'quote_text', 'body']);

let checks = 0;
let failures = 0;
let mutants = 0;
let mutantsKilled = 0;

const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '?');
const serialize = (value) => JSON.stringify(value == null ? null : value);

function check(name, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log('  PASS  ' + name);
    return true;
  }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + ascii(detail) : ''));
  return false;
}

function sameSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && expected.every((name) => actual.includes(name));
}

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.setHeader = (name, value) => { res.headers[name] = value; return res; };
  res.end = () => res;
  return res;
}

async function drive(handler, options = {}) {
  const calls = [];
  const logs = [];
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  const hadToken = Object.prototype.hasOwnProperty.call(process.env, 'SEARCH_API_TOKEN');
  const priorToken = process.env.SEARCH_API_TOKEN;
  const token = Object.prototype.hasOwnProperty.call(options, 'token') ? options.token : FIXTURE_TOKEN;

  if (token === null) delete process.env.SEARCH_API_TOKEN;
  else process.env.SEARCH_API_TOKEN = token;

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const reply = typeof options.upstream === 'function'
      ? options.upstream(calls.length)
      : options.upstream;
    if (reply instanceof Error) throw reply;
    const status = reply?.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (name) => String(name).toLowerCase() === 'content-length'
          ? (reply?.contentLength ?? null)
          : null
      },
      json: async () => {
        if (reply?.unreadable) throw new Error(reply.unreadable);
        return reply?.payload;
      }
    };
  };
  console.warn = (...args) => {
    logs.push(args.map((arg) => typeof arg === 'string' ? arg : serialize(arg)).join(' '));
  };

  const res = makeRes();
  try {
    await handler({
      method: options.method ?? 'POST',
      body: options.body,
      query: {},
      headers: {}
    }, res);
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    if (hadToken) process.env.SEARCH_API_TOKEN = priorToken;
    else delete process.env.SEARCH_API_TOKEN;
  }
  return { res, calls, logs };
}

async function loadMutant(source) {
  return import('data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64'));
}

function noteMutant(name, changed, violationObserved) {
  mutants += 1;
  check(name + ' is a real source mutation', changed);
  const killed = changed && violationObserved;
  if (killed) mutantsKilled += 1;
  check(name + ' is killed by the contract assertion', killed);
}

function envNames(source) {
  return [...new Set([...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)]
    .map((match) => match[1]))].sort();
}

function fixedErrorBody(body, code) {
  return body != null && typeof body === 'object'
    && sameSet(Object.keys(body), ['ok', 'error'])
    && body.ok === false
    && body.error != null && typeof body.error === 'object'
    && sameSet(Object.keys(body.error), ['code', 'message'])
    && body.error.code === code
    && typeof body.error.message === 'string' && body.error.message.length > 0;
}

function exactShapedResponse(api, level, value) {
  const top = api.RESPONSE_FIELDS_BY_LEVEL[level];
  const row = api.ROW_FIELDS_BY_LEVEL[level];
  return value != null && typeof value === 'object'
    && sameSet(Object.keys(value), top)
    && Array.isArray(value.rows)
    && value.rows.length > 0
    && value.rows.every((item) => item != null && typeof item === 'object'
      && sameSet(Object.keys(item), row));
}

(async function main() {
  console.log('=== lessons-browse-guard -- offline contract proof ===');

  const apiSrc = readRepo('api/lessons-browse.js');
  const searchSrc = readRepo('api/lessons-search.js');
  const api = await esm('api/lessons-browse.js');
  const handler = api.default;

  console.log('\n=== A. SOURCE CONTRACT ===');
  check('the API source and reference source were both read', apiSrc.length > 0 && searchSrc.length > 0);
  check('exactly the three contracted levels are declared',
    sameSet(api.LEVELS, ['scholars', 'series', 'lessons']) && api.LEVELS.length === 3,
    api.LEVELS.join(','));
  check('the scholars row whitelist is exact by set equality',
    sameSet(api.ROW_FIELDS_BY_LEVEL.scholars, ['scholar_id', 'count']));
  check('the series row whitelist is exact by set equality',
    sameSet(api.ROW_FIELDS_BY_LEVEL.series, ['series', 'count']));
  check('the lessons row whitelist is exact by set equality',
    sameSet(api.ROW_FIELDS_BY_LEVEL.lessons, ['unit_id', 'title', 'url']));
  check('the scholars response whitelist is exact by set equality',
    sameSet(api.RESPONSE_FIELDS_BY_LEVEL.scholars, ['rows', 'total']));
  check('the series response whitelist is exact by set equality',
    sameSet(api.RESPONSE_FIELDS_BY_LEVEL.series, ['rows', 'total', 'page', 'pages']));
  check('the lessons response whitelist is exact by set equality',
    sameSet(api.RESPONSE_FIELDS_BY_LEVEL.lessons, ['rows', 'total', 'page', 'pages']));

  const everyRowField = api.LEVELS.flatMap((level) => api.ROW_FIELDS_BY_LEVEL[level]);
  check('no forbidden text field occurs in any row whitelist',
    everyRowField.length > 0
      && FORBIDDEN_TEXT_FIELDS.every((field) => !everyRowField.includes(field)),
    everyRowField.join(','));

  const shapeStart = apiSrc.indexOf('const has =');
  const shapeEnd = apiSrc.indexOf('function readBody');
  check('the shaping region has both source anchors',
    shapeStart >= 0 && shapeEnd > shapeStart, shapeStart + ':' + shapeEnd);
  const shapingSrc = shapeStart >= 0 && shapeEnd > shapeStart
    ? apiSrc.slice(shapeStart, shapeEnd)
    : '';
  check('shaping uses no Object.keys, Object.entries, or Object.values',
    shapingSrc.length > 0 && !/Object\.(?:keys|entries|values)\s*\(/.test(shapingSrc));
  check('shaping uses no object or array spread',
    shapingSrc.length > 0 && !/(?:\{|\[|,)\s*\.\.\./.test(shapingSrc));
  check('scholars fields are carried by explicit names',
    shapingSrc.includes("carry(out, row, 'scholar_id');")
      && shapingSrc.includes("carry(out, row, 'count');"));
  check('series fields are carried by explicit names',
    shapingSrc.includes("carry(out, row, 'series');")
      && shapingSrc.includes("carry(out, row, 'count');"));
  check('lesson fields are carried by explicit names',
    shapingSrc.includes("carry(out, row, 'unit_id');")
      && shapingSrc.includes("carry(out, row, 'title');")
      && shapingSrc.includes("carry(out, row, 'url');"));

  const browseEnv = envNames(apiSrc);
  const searchEnv = envNames(searchSrc);
  check('the browse and search functions read the same environment-name set',
    sameSet(browseEnv, searchEnv), browseEnv.join(',') + ' vs ' + searchEnv.join(','));
  check('that shared set contains SEARCH_API_TOKEN and no second name',
    browseEnv.length === 1 && browseEnv[0] === 'SEARCH_API_TOKEN', browseEnv.join(','));
  check('both functions keep the measured local URL binding name SEARCH_URL',
    /const SEARCH_URL\s*=/.test(apiSrc) && /const SEARCH_URL\s*=/.test(searchSrc));
  check('the browse destination is the lessons service browse route',
    /const SEARCH_URL\s*=\s*['"]https:\/\/lib\.ezik\.app\/lessons\/browse['"]/.test(apiSrc));
  check('the timeout is the measured 12000ms', /const TIMEOUT_MS\s*=\s*12000;/.test(apiSrc));

  check('405 is attached to the non-POST branch',
    /req\.method !== 'POST'\) return res\.status\(405\)/.test(apiSrc));
  check('400 is attached to the exact-level rejection',
    /!LEVELS\.includes\(level\)\) return res\.status\(400\)/.test(apiSrc));
  check('503 is attached to the missing-token branch',
    /token\.length === 0[\s\S]{0,240}res\.status\(503\)/.test(apiSrc));
  check('502 appears on upstream failure paths',
    (apiSrc.match(/res\.status\(502\)/g) || []).length >= 4,
    String((apiSrc.match(/res\.status\(502\)/g) || []).length));

  const consoleCalls = scan.consoleCalls(apiSrc);
  check('the source contains the expected coded log calls',
    consoleCalls.length >= 5 && consoleCalls.every((call) => call.balanced), String(consoleCalls.length));
  check('every log call carries a fixed reason code',
    consoleCalls.length >= 5
      && consoleCalls.every((call) => /\breason\s*:/.test(scan.expressionText(call.text))));
  check('no log call reads an exception message or exception binding',
    consoleCalls.length >= 5
      && consoleCalls.every((call) => !/(?:error|exception)(?:\?\.)?\.message|\berror\b|\bexception\b/i
        .test(scan.expressionText(call.text))));
  check('catch blocks bind no exception object that could be logged',
    apiSrc.length > 0 && !/catch\s*\(\s*[A-Za-z_$]/.test(apiSrc));

  console.log('\n=== B. OFFLINE FIXTURE SHAPING ===');
  check('the fixture has an unmistakable forbidden marker',
    typeof FIXTURES.forbidden_marker === 'string' && FIXTURES.forbidden_marker.length > 0);
  check('the fixture carries no Arabic lesson text',
    FIXTURE_SRC.length > 0 && !/[\u0600-\u06ff]/.test(FIXTURE_SRC));

  const shaped = {};
  for (const level of api.LEVELS) {
    shaped[level] = api.shapeBrowseResponse(level, FIXTURES[level]);
    check(level + ' output has exactly its top-level and row whitelists',
      exactShapedResponse(api, level, shaped[level]), serialize(shaped[level]));
    check(level + ' output contains no forbidden marker',
      !serialize(shaped[level]).includes(FIXTURES.forbidden_marker));
    check(level + ' output has none of the named text fields',
      shaped[level].rows.every((row) => FORBIDDEN_TEXT_FIELDS.every((field) => !(field in row))));
    check(level + ' output drops unmeasured top-level fields',
      !('internal_cursor' in shaped[level]) && !('body' in shaped[level]));
  }
  check('the empty series bucket survives shaping as an empty value',
    shaped.series.rows[1].series === '');
  check('scholars do not acquire page or pages',
    !('page' in shaped.scholars) && !('pages' in shaped.scholars));
  check('series pagination is carried without derivation',
    shaped.series.page === FIXTURES.series.page && shaped.series.pages === FIXTURES.series.pages);
  check('lessons pagination is carried without derivation',
    shaped.lessons.page === FIXTURES.lessons.page && shaped.lessons.pages === FIXTURES.lessons.pages);
  check('an unknown shaping level returns no contract at all',
    Object.keys(api.shapeBrowseResponse('archive', FIXTURES.lessons)).length === 0);

  console.log('\n=== C. REQUESTS AND WIRE SHAPE ===');
  const scholars = await drive(handler, {
    body: { level: 'scholars', page: 88, ignored: 'drop-me' },
    upstream: { payload: FIXTURES.scholars }
  });
  const series = await drive(handler, {
    body: JSON.stringify({ level: 'series', scholar_id: 'Scholar Fixture A', page: '2' }),
    upstream: { payload: FIXTURES.series }
  });
  const lessons = await drive(handler, {
    body: { level: 'lessons', scholar_id: 'Scholar Fixture A', series: '', page: 'bad-page' },
    upstream: { payload: FIXTURES.lessons }
  });
  const successRuns = [scholars, series, lessons];

  check('all three levels return 200 through exactly one outbound call',
    successRuns.every((run) => run.res.statusCode === 200 && run.calls.length === 1));
  check('all three calls use POST /lessons/browse',
    successRuns.every((run) => run.calls[0].url === 'https://lib.ezik.app/lessons/browse'
      && run.calls[0].init.method === 'POST'));
  check('all three calls use the same Bearer SEARCH_API_TOKEN value',
    successRuns.every((run) => run.calls[0].init.headers.authorization === 'Bearer ' + FIXTURE_TOKEN));
  check('all three calls ask for and accept JSON',
    successRuns.every((run) => run.calls[0].init.headers['content-type'] === 'application/json'
      && run.calls[0].init.headers.accept === 'application/json'));

  const scholarRequest = JSON.parse(scholars.calls[0].init.body);
  const seriesRequest = JSON.parse(series.calls[0].init.body);
  const lessonRequest = JSON.parse(lessons.calls[0].init.body);
  check('scholars sends exactly level and ignores page',
    sameSet(Object.keys(scholarRequest), ['level']) && scholarRequest.level === 'scholars');
  check('series sends exactly level, scholar_id, and normalized page',
    sameSet(Object.keys(seriesRequest), ['level', 'scholar_id', 'page'])
      && seriesRequest.level === 'series' && seriesRequest.scholar_id === 'Scholar Fixture A'
      && seriesRequest.page === 2);
  check('lessons sends exactly level, scholar_id, series, and normalized page',
    sameSet(Object.keys(lessonRequest), ['level', 'scholar_id', 'series', 'page'])
      && lessonRequest.level === 'lessons' && lessonRequest.scholar_id === 'Scholar Fixture A'
      && lessonRequest.series === '' && lessonRequest.page === 1);
  check('invalid page values normalize to 1',
    api.normalizePage(undefined) === 1 && api.normalizePage(null) === 1
      && api.normalizePage(0) === 1 && api.normalizePage(-2) === 1
      && api.normalizePage(1.5) === 1 && api.normalizePage('bad') === 1);
  check('positive integer page values survive, including numeric strings',
    api.normalizePage(3) === 3 && api.normalizePage('4') === 4);
  check('successful output is the same pure fixture shape proved above',
    serialize(scholars.res.body) === serialize(shaped.scholars)
      && serialize(series.res.body) === serialize(shaped.series)
      && serialize(lessons.res.body) === serialize(shaped.lessons));
  check('successful output carries a private no-store cache header',
    successRuns.every((run) => String(run.res.headers['Cache-Control']).includes('no-store')));

  console.log('\n=== D. FIXED FAILURE CLASSES ===');
  const notPost = await drive(handler, {
    method: 'GET', body: { level: 'scholars' }, upstream: { payload: FIXTURES.scholars }
  });
  const badLevel = await drive(handler, {
    body: { level: 'archive', scholar_id: 'Scholar Fixture A', series: '' },
    upstream: { payload: FIXTURES.lessons }
  });
  const badJson = await drive(handler, {
    body: '{bad-json', upstream: { payload: FIXTURES.scholars }
  });
  const missingScholar = await drive(handler, {
    body: { level: 'series', scholar_id: '' }, upstream: { payload: FIXTURES.series }
  });
  const missingSeries = await drive(handler, {
    body: { level: 'lessons', scholar_id: 'Scholar Fixture A' },
    upstream: { payload: FIXTURES.lessons }
  });
  const noToken = await drive(handler, {
    body: { level: 'scholars' }, token: null, upstream: { payload: FIXTURES.scholars }
  });
  const unreachable = await drive(handler, {
    body: { level: 'scholars' }, upstream: new Error(THROW_MARKER)
  });
  const rejected = await drive(handler, {
    body: { level: 'scholars' }, upstream: { status: 401, payload: { detail: THROW_MARKER } }
  });
  const badStatus = await drive(handler, {
    body: { level: 'scholars' }, upstream: { status: 500, payload: { detail: THROW_MARKER } }
  });
  const unreadable = await drive(handler, {
    body: { level: 'scholars' }, upstream: { unreadable: THROW_MARKER }
  });
  const oversized = await drive(handler, {
    body: { level: 'scholars' },
    upstream: { contentLength: String(4 * 1024 * 1024 + 1), payload: FIXTURES.scholars }
  });

  check('non-POST is 405 and never calls upstream',
    notPost.res.statusCode === 405 && notPost.calls.length === 0);
  check('the fourth level is 400 and never calls upstream',
    badLevel.res.statusCode === 400 && badLevel.calls.length === 0);
  check('bad JSON is 400 and never calls upstream',
    badJson.res.statusCode === 400 && badJson.calls.length === 0);
  check('missing scholar_id is 400 and never calls upstream',
    missingScholar.res.statusCode === 400 && missingScholar.calls.length === 0);
  check('missing series is 400 but empty series was accepted above',
    missingSeries.res.statusCode === 400 && missingSeries.calls.length === 0
      && lessons.res.statusCode === 200);
  check('missing token is 503 and never calls upstream',
    noToken.res.statusCode === 503 && noToken.calls.length === 0);
  check('all upstream failure classes are 502',
    [unreachable, rejected, badStatus, unreadable, oversized]
      .every((run) => run.res.statusCode === 502));
  check('a rejected token earns one call and no unauthenticated retry',
    rejected.calls.length === 1);

  check('the 405 body is one fixed public shape',
    fixedErrorBody(notPost.res.body, 'METHOD_NOT_ALLOWED'));
  const badRequestRuns = [badLevel, badJson, missingScholar, missingSeries];
  check('every 400 body is byte-for-byte the same fixed body',
    badRequestRuns.every((run) => serialize(run.res.body) === serialize(badLevel.res.body))
      && fixedErrorBody(badLevel.res.body, 'LESSONS_BROWSE_BAD_REQUEST'));
  check('the 503 body is one fixed public shape',
    fixedErrorBody(noToken.res.body, 'LESSONS_BROWSE_UNAVAILABLE'));
  const upstreamRuns = [unreachable, rejected, badStatus, unreadable, oversized];
  check('every 502 body is byte-for-byte the same fixed body',
    upstreamRuns.every((run) => serialize(run.res.body) === serialize(unreachable.res.body))
      && fixedErrorBody(unreachable.res.body, 'LESSONS_BROWSE_UPSTREAM_UNAVAILABLE'));

  const allRuns = successRuns.concat([notPost, badLevel, badJson, missingScholar,
    missingSeries, noToken, unreachable, rejected, badStatus, unreadable, oversized]);
  check('the token reaches no response, response header, or log line',
    allRuns.every((run) => !serialize(run.res.body).includes(FIXTURE_TOKEN)
      && !serialize(run.res.headers).includes(FIXTURE_TOKEN)
      && !run.logs.join(' ').includes(FIXTURE_TOKEN)));
  check('the thrown exception text reaches no response or log line',
    !serialize(unreachable.res.body).includes(THROW_MARKER)
      && !unreachable.logs.join(' ').includes(THROW_MARKER));
  check('failure responses expose neither the environment name nor upstream host',
    allRuns.every((run) => !serialize(run.res.body).includes('SEARCH_API_TOKEN')
      && !serialize(run.res.body).includes('lib.ezik.app')));
  check('the missing-token log is a code, not an exception message',
    noToken.logs.length === 1 && noToken.logs[0].includes('SEARCH_API_TOKEN_MISSING'));
  check('every upstream log contains a fixed reason code and no planted exception text',
    upstreamRuns.every((run) => run.logs.length === 1
      && run.logs[0].includes('reason') && !run.logs[0].includes(THROW_MARKER)));

  console.log('\n=== E. MUTATION PROOF ===');
  const snippetAnchor = "  carry(out, row, 'count');\n  return out;";
  const snippetReplacement = "  carry(out, row, 'count');\n  carry(out, row, 'snippet');\n  return out;";
  const snippetMutantSrc = apiSrc.replace(snippetAnchor, snippetReplacement);
  let snippetViolation = false;
  if (snippetMutantSrc !== apiSrc) {
    const snippetMutant = await loadMutant(snippetMutantSrc);
    const mutantOutput = snippetMutant.shapeBrowseResponse('scholars', FIXTURES.scholars);
    snippetViolation = mutantOutput.rows[0].snippet === FIXTURES.forbidden_marker
      && !exactShapedResponse(api, 'scholars', mutantOutput);
  }
  noteMutant('M1 snippet pass-through', snippetMutantSrc !== apiSrc, snippetViolation);

  const levelAnchor = "  if (!LEVELS.includes(level)) return res.status(400).json(BAD_REQUEST_BODY);";
  const levelReplacement = "  if (typeof level !== 'string') return res.status(400).json(BAD_REQUEST_BODY);";
  const levelMutantSrc = apiSrc.replace(levelAnchor, levelReplacement);
  let levelViolation = false;
  if (levelMutantSrc !== apiSrc) {
    const levelMutant = await loadMutant(levelMutantSrc);
    const fourth = await drive(levelMutant.default, {
      body: { level: 'archive', scholar_id: 'Scholar Fixture A', series: '', page: 1 },
      upstream: { payload: FIXTURES.lessons }
    });
    levelViolation = fourth.res.statusCode === 200 && fourth.calls.length === 1;
  }
  noteMutant('M2 fourth accepted level', levelMutantSrc !== apiSrc, levelViolation);

  check('at least two mutants were created and every one was killed',
    mutants >= 2 && mutantsKilled === mutants, mutantsKilled + '/' + mutants);
  check('the API file on disk is unchanged after in-memory mutation',
    readRepo('api/lessons-browse.js') === apiSrc);

  console.log('\nMUTANTS_KILLED=' + mutantsKilled + '/' + mutants);
  console.log('ASSERTIONS=' + (checks - failures) + '/' + checks);
  console.log('=== ' + (failures ? 'FAIL' : 'PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('lessons-browse-guard crashed: ' + ascii(error && error.stack || error));
  process.exit(1);
});
