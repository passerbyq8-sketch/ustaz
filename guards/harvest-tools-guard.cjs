// guards/harvest-tools-guard.cjs -- م٦: the harvest tools (tools/harvest/*), offline.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٦): «أدواتٌ فقط، بلا جلب: محوِّلُ دفعةٍ إلى سجلِّ فتوى (الموقع،
// المفتي، السؤال، الجواب، الرابط، التاريخ، البصمة)، وفاحصُ روابط، وأداةُ جلبٍ دوريّ. لا جدولة، ولا نشر، ولا
// يدخلُ عزك شيءٌ من المخزون المحجوز، ولا تُمَسُّ خدمةُ الفتاوى الحيّة.» MEASURED before they were built
// (06-harvest/measure/A-record.md, B-harvest.md): no such tool existed, the repository had no robots.txt
// reader, and its only pacing constants (800 ms, 250 ms) sit below the owner's 2.5 s.
//
// WHAT THIS PINS -- every request below goes to a FAKE fetch; nothing here touches a network:
//   H1  robots: our named group beats «*», the longest rule decides, Allow wins a tie, «*» and «$»,
//       an empty Disallow, Crawl-delay;
//   H2  the converter: the seven fields; the fingerprint IS lib/full-fatwa.js fullTextHash; a null
//       publish date stays null beside the fetch time; the key is <scholar>:<id>; a duplicate key is
//       refused and a shared fingerprint REPORTED, not merged; off-domain and http links refused; the
//       labels flagged, the text verbatim; a held source keeps its held block; nothing publish_allowed;
//       a METHOD-V1 page is refused for having no question/answer split;
//   H3  dry runs make no request: the link checker and the fetch tool return plans, robots first;
//   H4  the link checker, live against the fake: every status of its closed list that the fake can
//       provoke, our one name on every request, robots read before anything else, a forbidden host or a
//       host with no verdict refused before any request, a redirect to a private address refused;
//   H5  pacing on a virtual clock: ≥ 2.5 s per host, a Crawl-delay floor above it, five blocks → a 45 s
//       rest → 5 s spacing;
//   H6  the fetch tool: robots saved first, raw bytes saved before their record, an already-saved file
//       not fetched again, every record held, the closure's difference 0;
//   H7  the sources: no timer, no cron, no scheduler; one name, imported; C:/EZIK-LIB refused.
// Red on the tree before this item: `node guards/harvest-tools-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; } };
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 700) : ''));
  return false;
}
const done = () => { console.log(`\n=== harvest-tools: ${checks - failures}/${checks} PASS ===`); process.exit(failures ? 1 : 0); };

// A virtual clock: sleep advances it, and records what was slept.
function clock() {
  let t = 1_000_000;
  const slept = [];
  return { now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; }, slept, advance: (ms) => { t += ms; } };
}
// The fake web: a map url → { status, body, location }. Every call is recorded with its headers and time.
function web(routes, c) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), ua: init && init.headers && init.headers['user-agent'], redirect: init && init.redirect, at: c ? c.now() : 0 });
    const r = typeof routes === 'function' ? routes(String(url), calls.length) : routes[String(url)];
    if (!r) return { status: 404, headers: { get: () => null }, arrayBuffer: async () => new TextEncoder().encode('<title>404</title>').buffer };
    const bytes = new TextEncoder().encode(r.body == null ? '' : r.body);
    return { status: r.status || 200, headers: { get: (h) => (String(h).toLowerCase() === 'location' ? r.location || null : 'text/html') }, arrayBuffer: async () => bytes.buffer };
  };
  return { fetchImpl, calls };
}
const PUBLIC = async () => ['93.184.216.34'];
const page = (title, text) => `<html><head><title>${title}</title></head><body><article>${text}</article></body></html>`;
const LONG = 'نصُّ الفتوى كاملًا '.repeat(20);

async function main() {
  console.log('harvest-tools guard — root ' + REPO);
  let R = null, P = null, C = null, L = null, F = null, UA = null, FF = null;
  try {
    R = await esm('tools/harvest/robots.mjs'); P = await esm('tools/harvest/policy.mjs');
    C = await esm('tools/harvest/fatwa-convert.mjs'); L = await esm('tools/harvest/link-check.mjs');
    F = await esm('tools/harvest/periodic-fetch.mjs'); UA = await esm('lib/user-agent.js'); FF = await esm('lib/full-fatwa.js');
  } catch (e) { ok('H0  the tools load', false, e.message); }
  if (!R || !P || !C || !L || !F) { ok('H0  tools/harvest/{robots,policy,fatwa-convert,link-check,periodic-fetch}.mjs exist', false); return done(); }

  // ── H1 ────────────────────────────────────────────────────────────────────
  const robots = R.parseRobots([
    'User-agent: *', 'Disallow: /private', 'Allow: /private/open', 'Crawl-delay: 1',
    '', 'User-agent: EzikBot', 'User-agent: other', 'Disallow: /fatwas/*.pdf$', 'Disallow: /admin', 'Allow: /admin/public', 'Disallow:', 'Crawl-delay: 4',
  ].join('\n'));
  const d = (p, token = 'EzikBot') => R.robotsDecision(robots, token, p);
  const star = R.parseRobots('User-agent: *\nDisallow: /a\nAllow: /a\n');
  ok('H1  robots: our group over «*»; longest rule; Allow on a tie; «*» and «$»; empty Disallow; Crawl-delay',
    d('/private').allowed === true && d('/admin/x').allowed === false && d('/admin/public/x').allowed === true
    && d('/fatwas/1.pdf').allowed === false && d('/fatwas/1.pdf?x').allowed === true && d('/').allowed === true
    && d('/admin').crawlDelay === 4
    && R.robotsDecision(robots, 'SomeBot', '/private/x').allowed === false && R.robotsDecision(robots, 'SomeBot', '/private/open/x').allowed === true
    && R.robotsDecision(robots, 'SomeBot', '/').crawlDelay === 1
    && R.robotsDecision(star, 'EzikBot', '/a').allowed === true && R.robotsDecision(R.parseRobots(''), 'EzikBot', '/x').allowed === true,
    JSON.stringify([d('/private'), d('/admin/x'), d('/fatwas/1.pdf')]));

  // ── H2 ────────────────────────────────────────────────────────────────────
  const row = (n, extra = {}) => ({
    rowid: n, id: 'x' + n, scholar_id: 'binbaz', attribution_name: 'عبدالعزيز بن باز', attribution_kind: 'person',
    rights_basis: 'site_footer_permissive_with_attribution', rights_text_verbatim: 'النقل متاح بشرط ذكر المصدر', attribution_required: 1,
    fatwa_kind: '3', title: 'عنوان ' + n, question_text: 'السؤال:\n\nسؤال رقم ' + n, answer_text: 'الجواب:\n\nجواب رقم ' + n,
    source_url: `https://binbaz.org.sa/fatwas/${n}/slug`, source_item_id: String(n), date_published: null,
    content_mode: 'text', raw_html_sha256: 'ab'.repeat(32), fetched_at: '2026-08-25T13:00:33.329Z', ...extra,
  });
  const batch = [row(1), row(2), row(1), row(3, { question_text: 'السؤال:\n\nسؤال رقم 2', answer_text: 'الجواب:\n\nجواب رقم 2' }),
    row(4, { source_url: 'https://example.com/fatwas/4' }), row(5, { source_url: 'http://binbaz.org.sa/fatwas/5' }),
    row(6, { answer_text: '  ' }), row(7, { date_published: '1420-01-01' })];
  const out = C.convertBatch(batch, { inputName: 'fixture.jsonl', inputSha256: 'f'.repeat(64) });
  const r1 = out.records[0];
  const held = C.convertBatch([row(8, { inventory_destination: 'held_inventory_pending_permission' })]).records[0];
  const pageRow = C.convertBatch([{ id: 'J1', unit: 'page', url: 'https://x/1', title: 't' }], { adapter: 'method_v1' });
  ok('H2  the converter: seven fields, fullTextHash, the null date kept, keyed by id, duplicates refused, collisions reported, off-domain/http refused, labels flagged, held kept, nothing publishable, pages refused',
    r1 && r1.key === 'binbaz:1' && r1.site === 'binbaz.org.sa' && r1.mufti.id === 'binbaz' && r1.mufti.registry_name
    && r1.question === 'السؤال:\n\nسؤال رقم 1' && r1.answer === 'الجواب:\n\nجواب رقم 1' && r1.labels.question && r1.labels.answer
    && r1.link.url === 'https://binbaz.org.sa/fatwas/1/slug' && r1.link.source_item_id === '1' && r1.link.id_in_url === true
    && r1.date.published === null && r1.date.fetched_at === '2026-08-25T13:00:33.329Z'
    && r1.fingerprint.full_text_sha256 === FF.fullTextHash(r1.question, r1.answer) && r1.fingerprint.raw_html_sha256 === 'ab'.repeat(32)
    && r1.rights.publish_allowed === false && r1.rights.product_use_allowed === false && r1.rights.text_verbatim === 'النقل متاح بشرط ذكر المصدر'
    && out.records.length === 4 && out.records.map((r) => r.key).join(',') === 'binbaz:1,binbaz:2,binbaz:3,binbaz:7'
    && out.records[3].date.published === '1420-01-01'
    && JSON.stringify(out.rejected.map((x) => x.reason)) === JSON.stringify(['duplicate_key', 'link_off_domain', 'link_not_https', 'answer_empty'])
    && out.collisions.length === 1 && JSON.stringify(out.collisions[0].keys) === JSON.stringify(['binbaz:2', 'binbaz:3'])
    && held.rights.destination === 'held_inventory_pending_permission' && held.rights.permission_status === 'pending'
    && out.records.every((r) => r.rights.publish_allowed === false)
    && pageRow.records.length === 0 && pageRow.rejected[0].reason === 'no_question_answer_split',
    JSON.stringify({ keys: out.records.map((r) => r.key), rejected: out.rejected, collisions: out.collisions }));

  // ── H3 ────────────────────────────────────────────────────────────────────
  const verdicts = { 'binbaz.org.sa': 'harvested', 'example.org': 'harvested', 'af.org.sa': 'permission_required' };
  const items = [{ id: 'a', url: 'https://binbaz.org.sa/fatwas/1/x' }, { id: 'b', url: 'https://dorar.net/h/1' }, { id: 'c', url: 'https://unknown.example/x' }];
  const dry1 = await L.checkLinks(items, { verdicts, control: 'https://example.org/' });
  const w0 = web({}, null);
  const dry2 = await F.runFetch({ items }, { verdicts, fetchImpl: w0.fetchImpl, store: { size: () => -1, write() {} } });
  ok('H3  dry runs make no request: plans only, robots first, the forbidden and the unruled refused',
    dry1.dry === true && dry2.dry === true && w0.calls.length === 0
    && dry1.plan[0].action === 'robots' && dry1.plan[1].action === 'check'
    && dry1.plan.some((p) => p.id === 'b' && p.reason === 'forbidden_host:written_prohibition')
    && dry1.plan.some((p) => p.id === 'c' && p.reason === 'no_verdict')
    && dry2.plan[0].action === 'robots_then_save',
    JSON.stringify({ dry1: dry1.plan, dry2: dry2.plan }));

  // ── H4 ────────────────────────────────────────────────────────────────────
  const H = 'https://binbaz.org.sa';
  const c4 = clock();
  const routes = {
    [H + '/robots.txt']: { body: 'User-agent: *\nDisallow: /secret\n' },
    [H + '/fatwas/1/a']: { body: page('حكم الصلاة | ابن باز', LONG) },
    [H + '/fatwas/2/b']: { status: 404, body: '' },
    [H + '/fatwas/3/c']: { status: 301, location: '/' },
    [H + '/']: { body: page('الرئيسية', LONG) },
    [H + '/fatwas/4/d']: { body: '' },
    [H + '/fatwas/5/e']: { body: page('عنوان آخر تمامًا', LONG) },
    [H + '/fatwas/6/f']: { status: 403, body: 'forbidden' },
    [H + '/fatwas/7/g']: { status: 302, location: 'https://evil.example/x' },
    [H + '/fatwas/8/h']: { status: 301, location: H + '/fatwas/8/h2' },
    [H + '/fatwas/8/h2']: { body: page('حكم الزكاة', LONG) },
    [H + '/fatwas/9/i']: { body: page('404 الصفحة غير موجودة', LONG) },
    'https://example.org/': { body: page('control', LONG) },
  };
  const w4 = web(routes, c4);
  const run4 = await L.checkLinks([
    { id: '1', url: H + '/fatwas/1/a', title: 'حكم الصلاة', scholarId: 'binbaz' },
    { id: '2', url: H + '/fatwas/2/b' }, { id: '3', url: H + '/fatwas/3/c' }, { id: '4', url: H + '/fatwas/4/d' },
    { id: '5', url: H + '/fatwas/5/e', title: 'حكم الصيام' }, { id: '6', url: H + '/fatwas/6/f' },
    { id: '7', url: H + '/fatwas/7/g' }, { id: '8', url: H + '/fatwas/8/h', title: 'حكم الزكاة' },
    { id: '9', url: H + '/fatwas/9/i' }, { id: '10', url: H + '/secret/x' },
    { id: '11', url: 'https://islamweb.net/x' }, { id: '12', url: 'https://sh-albarrak.com/f/1', scholarId: 'binbaz' },
  ], { live: true, fetchImpl: w4.fetchImpl, now: c4.now, sleep: c4.sleep, lookup: PUBLIC, verdicts: { ...verdicts, 'sh-albarrak.com': 'harvested' }, control: 'https://example.org/' });
  const st = Object.fromEntries(run4.results.map((r) => [r.id, r.status]));
  const priv = await L.checkLinks([{ id: 'p', url: H + '/fatwas/1/a' }], { live: true, fetchImpl: web(routes, clock()).fetchImpl, now: c4.now, sleep: c4.sleep, lookup: async () => ['10.0.0.7'], verdicts });
  ok('H4  the link checker: its statuses, robots first, one name on every request, refusals before any request, a private address refused',
    st['1'] === 'live' && st['2'] === 'dead_404' && st['3'] === 'soft_404_home' && st['4'] === 'empty_body'
    && st['5'] === 'identity_mismatch' && st['6'] === 'blocked_site' && st['7'] === 'off_host_redirect' && st['8'] === 'redirected_ok'
    && st['9'] === 'soft_404' && st['10'] === 'robots_disallowed' && st['11'] === 'refused' && st['12'] === 'off_domain'
    && run4.results.every((r) => L.LINK_STATUSES.includes(r.status))
    && w4.calls[0].url === H + '/robots.txt' && w4.calls.every((c) => c.ua === UA.EZIK_USER_AGENT && c.redirect === 'manual')
    && !w4.calls.some((c) => /secret|islamweb|albarrak|evil/.test(c.url))
    && priv.results[0].status === 'off_host_redirect' && priv.results[0].detail === 'private_address',
    JSON.stringify({ st, calls: w4.calls.map((c) => c.url), priv: priv.results }));

  // ── H5 ────────────────────────────────────────────────────────────────────
  const gaps = (calls, host) => {
    const at = calls.filter((c) => c.url.includes(host)).map((c) => c.at);
    return at.slice(1).map((t, i) => t - at[i]);
  };
  const g4 = gaps(w4.calls, 'binbaz.org.sa');
  const c5 = clock();
  const blocker = web((url) => (url.endsWith('/robots.txt') ? { body: 'User-agent: *\nCrawl-delay: 3\n' } : { status: 429, body: '' }), c5);
  await L.checkLinks(Array.from({ length: 7 }, (_, i) => ({ id: 'z' + i, url: `${H}/fatwas/${100 + i}/z` })),
    { live: true, fetchImpl: blocker.fetchImpl, now: c5.now, sleep: c5.sleep, lookup: PUBLIC, verdicts });
  const g5 = gaps(blocker.calls, 'binbaz.org.sa');
  ok('H5  pacing: ≥ 2.5 s per host; a Crawl-delay floor above it; five blocks → a 45 s rest → 5 s spacing',
    g4.length > 5 && g4.every((g) => g >= 2500)
    && g5.length === 7 && g5.slice(0, 5).every((g) => g >= 3000 && g < 45000) && c5.slept.includes(45000)
    && g5[5] >= 45000 && g5[6] >= 5000 && g5[6] < 45000,
    JSON.stringify({ g4, g5, slept: c5.slept }));

  // ── H6 ────────────────────────────────────────────────────────────────────
  const c6 = clock();
  const files = new Map([['raw/k2.html', Buffer.from('old')]]);
  const order = [];
  const store = { size: (rel) => (files.has(rel) ? files.get(rel).length : -1), write: (rel, b) => { files.set(rel, b); order.push(rel); } };
  const w6 = web({
    [H + '/robots.txt']: { body: 'User-agent: *\nDisallow: /no\n' },
    [H + '/fatwas/1/a']: { body: page('حكم', LONG) }, [H + '/fatwas/3/c']: { status: 404, body: '' },
  }, c6);
  const run6 = await F.runFetch({ items: [
    { id: 'k1', url: H + '/fatwas/1/a' }, { id: 'k2', url: H + '/fatwas/2/b' }, { id: 'k3', url: H + '/fatwas/3/c' },
    { id: 'k4', url: H + '/no/x' }, { id: 'k5', url: 'https://dorar.net/x' },
  ] }, { live: true, fetchImpl: w6.fetchImpl, now: c6.now, sleep: c6.sleep, lookup: PUBLIC, verdicts, store });
  const byId = Object.fromEntries(run6.records.map((r) => [r.id, r]));
  ok('H6  the fetch tool: robots saved first, raw before its record, the saved not fetched again, every record held, closure 0',
    order[0] === 'round-evidence/ROUND.robots.txt' && order[1] === 'raw/k1.html'
    && byId.k1.status === 'saved' && byId.k1.raw_sha256 && byId.k1.gaps.includes('extraction_not_run') && byId.k1.text_path === null
    && byId.k2.status === 'saved' && byId.k2.gaps.includes('already_saved_not_refetched') && !w6.calls.some((c) => c.url.includes('/fatwas/2/'))
    && byId.k3.status === 'dead' && byId.k4.status === 'prohibited' && byId.k5.status === 'prohibited'
    && !w6.calls.some((c) => c.url.includes('/no/') || c.url.includes('dorar'))
    && run6.records.every((r) => r.rights.destination === 'held_inventory_pending_permission' && r.rights.publish_allowed === false)
    && run6.closure.index === 5 && run6.closure.difference === 0,
    JSON.stringify({ order, records: run6.records.map((r) => [r.id, r.status, r.gaps]), closure: run6.closure }));

  // ── H7 ────────────────────────────────────────────────────────────────────
  const srcs = ['robots', 'policy', 'fatwa-convert', 'link-check', 'periodic-fetch'].map((n) => read(`tools/harvest/${n}.mjs`));
  const code = srcs.map((s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')).join('\n');
  ok('H7  the sources: no timer, cron or scheduler; the one name imported and no other; C:/EZIK-LIB refused',
    srcs.every((s) => s.length > 0)
    && !/setInterval|node-cron|CronCreate|schedule\(|crontab|"crons"/.test(code)
    && /import \{ EZIK_USER_AGENT \} from '\.\.\/\.\.\/lib\/user-agent\.js'/.test(srcs[1])
    && !/Mozilla|Chrome\/|Safari\//.test(code) && (code.match(/user-agent/gi) || []).length >= 1
    && P.refusePath('C:/EZIK-LIB/harvest/x.jsonl') === true && P.refusePath('C:\\EZIK-LIB') === true && P.refusePath('C:/Users/x/y.jsonl') === false,
    'sources');

  done();
}
main().catch((e) => { console.log('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
