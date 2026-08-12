// guards/adapted-corpus-guard.cjs — the richest corpus in the project is consulted, not just owned.
//
// THE MEASURED HOLE (batch 2, incident 5). «حكم السفر للسياحة لدول غير مسلمة» has a documented
// answer by Shaykh Ibn Uthaymeen on binothaimeen.net. That host is the highest-rated
// primary-opinion source in lib/ledger/source-policy.js (98) and has a working adapter — and it
// carries `searchable: false`, so it was consulted ONLY when a reader named him. Every ordinary
// fiqh question the app has ever answered went past it. A reader who did not know to ask for the
// Shaykh by name could not reach his answer.
//
// WHAT THIS GUARD PINS.
//   1. `searchable: false` STAYS. The corpus is READ, never searched. No `site:` filter and no
//      band list gains a domain — the invariant the registry guard already owns, re-asserted here
//      because this change is the one most likely to break it.
//   2. A fiqh question naming NOBODY consults it, alongside the ordinary search.
//   3. A question naming SOMEBODY ELSE does not — that is a different path about a different man.
//   4. Its pages face the SAME gates: post-fetch admission, and the question-match check.
//   5. It is never a default answer: an empty or refused corpus changes the reply by nothing, and
//      does not narrate the outcome as an absence of direct evidence.
//   6. The budgets are not raised to pay for it.
//
// Usage: node guards/adapted-corpus-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const binothaimeenSourceArg = process.argv.indexOf('--binothaimeen-source');
const binothaimeenSourceFile = binothaimeenSourceArg >= 0 && process.argv[binothaimeenSourceArg + 1]
  ? path.resolve(process.argv[binothaimeenSourceArg + 1])
  : path.join(REPO, 'lib/binothaimeen.js');
const esmBinothaimeen = () => {
  if (binothaimeenSourceArg < 0) return esm('lib/binothaimeen.js');
  const external = fs.readFileSync(binothaimeenSourceFile, 'utf8').replace(
    /from\s+(['"])([^'"]+)\1/g,
    (whole, quote, specifier) => {
      if (specifier.startsWith('node:')) return whole;
      const target = specifier.startsWith('.')
        ? path.resolve(REPO, 'lib', specifier)
        : require.resolve(specifier, { paths: [REPO] });
      return 'from ' + quote + 'file:///' + target.replace(/\\/g, '/') + quote;
    },
  );
  return import('data:text/javascript;base64,' + Buffer.from(external, 'utf8').toString('base64'));
};

const Q_TRAVEL = 'ما حكم السفر للسياحة إلى دول غير مسلمة؟';
const LESSON_URL = 'https://binothaimeen.net/content/12345';
const LESSON_TITLE = 'حكم السفر للسياحة إلى بلاد الكفار';
const LESSON_TEXT = 'السفر إلى بلاد الكفار للسياحة لا يجوز إلا بشروط ثلاثة ذكرها أهل العلم: '
  + 'أن يكون عند المسافر علم يدفع به الشبهات، وأن يكون عنده دين يمنعه من الشهوات، وأن يكون محتاجا '
  + 'إلى هذا السفر. فإذا انتفت الحاجة وكان السفر للسياحة المجردة فإنه لا يجوز، لأن الإقامة بين '
  + 'المشركين من غير حاجة منهي عنها، والسياحة ليست حاجة معتبرة في هذا الباب. وهذا هو الذي عليه '
  + 'المحققون من أهل العلم في حكم السفر إلى دول غير مسلمة للسياحة.';

(async function main() {
  console.log('=== adapted-corpus-guard — the richest corpus in the project is consulted ===');
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'stub-for-gate';

  const DC = await esm('lib/ledger/direct-corpus.js');
  const SP = await esm('lib/ledger/source-policy.js');
  const EN = await esm('lib/ledger/engine.js');
  const RT = await esm('lib/retrieve.js');

  // ── 1. THE INVARIANT THAT MUST NOT MOVE ────────────────────────────────────
  const row = SP.policyFor('https://binothaimeen.net/content/1');
  ok('binothaimeen.net is still searchable:false', row && row.searchable === false,
    JSON.stringify(row && row.searchable));
  ok('...and is on NO searchable domain list', !SP.searchableDomains().includes('binothaimeen.net'),
    'a consulted corpus is not a searched one');
  for (const [name, list] of [['SITES_ADULT', RT.SITES_ADULT], ['SITES_MINOR', RT.SITES_MINOR],
    ['SITES_MINOR_FALLBACK', RT.SITES_MINOR_FALLBACK], ['SITES_GENERAL', RT.SITES_GENERAL]]) {
    ok('...and is absent from ' + name, !list.includes('binothaimeen.net'));
  }

  // ── 2. THE DECISION ────────────────────────────────────────────────────────
  const iss = (o) => Object.assign({
    issueId: 'iss_1', intent: 'fatwa', requestedAuthorityId: null,
    protectedEntities: [], coreTerms: [], contextVars: [], exactUserPhrases: [],
    requiredSlots: ['ruling'], temporalScope: 'unknown',
  }, o);

  const c1 = DC.adaptedCorpusConsultFor(iss({ intent: 'fatwa' }));
  ok('a fiqh question naming nobody consults the adapted corpus',
    c1 && c1.authorityId === 'ibn-uthaymeen' && c1.domain === 'binothaimeen.net', JSON.stringify(c1));
  ok('a question that NAMES a scholar does not',
    DC.adaptedCorpusConsultFor(iss({ intent: 'scholar_opinion', requestedAuthorityId: 'ibn-baz' })) === null);
  ok('...not even when the named scholar IS the corpus owner (that is the other path)',
    DC.adaptedCorpusConsultFor(iss({ requestedAuthorityId: 'ibn-uthaymeen' })) === null);
  // The capability gate is part of the DECISION, so no unit is spent on a page that would be
  // refused on arrival. binothaimeen.net declares no tafsir capability, and relaxing that would
  // mean loosening lib/ledger/source-policy.js, which that file forbids.
  ok('an intent the corpus has no capability for is not consulted at all',
    DC.adaptedCorpusConsultFor(iss({ intent: 'tafsir' })) === null,
    'spending I/O on a page admitPostFetch must refuse is a call for nothing');

  // ── 3. DRIVEN: THE LESSON ENTERS THE CANDIDATE POOL ────────────────────────
  const plannerOverride = {
    issues: [{
      issue_id: 'iss_1', intent: 'fatwa', requested_authority_id: null,
      protected_entities: ['السفر للسياحة'], core_terms: ['دول غير مسلمة', 'حكم'],
      context_vars: [], exact_user_phrases: [], required_slots: [], dependencies: [],
      temporal_scope: 'unknown',
    }],
    missing_qualifiers: [], confidence: 'high',
  };

  const modelReply = (body) => {
    const user = body.messages[0].content;
    if (user.includes('المقاطعُ المرقَّمةُ من صفحةٍ واحدة')) {
      // Extraction. The span-id shape is the one lib/ledger/segment.js actually renders —
      // `[{sourceId}#u{N}s{N}] text` — so the claim cites a span the ledger can resolve, and the
      // component text is cut from that span's OWN words so the real Gate 2 can entail it.
      const slotLine = (user.match(/- الخاناتُ المطلوبة: (.+)/) || [])[1] || '';
      const wantedSlots = slotLine.split('،').map((x) => x.trim()).filter(Boolean);
      const spans = Array.from(user.matchAll(/\[([^\]\s]+#u\d+s\d+)\]\s*([^\n]*)/g))
        .map((m) => ({ id: m[1], text: (m[2] || '').trim() }))
        .filter((s) => s.text);
      const claims = spans.slice(0, 1).map((s, i) => ({
        claim_id: 'c' + (i + 1), text: s.text.slice(0, 160),
        slot: wantedSlots[0] || '', span_ids: [s.id],
        components: [{ component_id: 'c' + (i + 1) + 'k1', kind: 'ruling', text: s.text.slice(0, 60), span_ids: [s.id] }],
      }));
      return { content: [{ type: 'text', text: JSON.stringify({ claims }) }], usage: { output_tokens: 100 } };
    }
    if (user.includes('تحقَّقْ من كلِّ ادّعاءٍ')) {
      const ids = Array.from(user.matchAll(/### ادّعاء (\S+)/g)).map((m) => m[1]);
      return { content: [{ type: 'text', text: JSON.stringify({
        verdicts: ids.map((id) => ({ claim_id: id, verdict: 'PASS', unsupported_components: [] })),
      }) }], usage: { output_tokens: 40 } };
    }
    if (user.includes('اكتبِ الجوابَ جملةً جملة')) {
      const ids = Array.from(user.matchAll(/^- \((\S+)\)/gm)).map((m) => m[1]);
      return { content: [{ type: 'text', text: JSON.stringify({
        sentences: ids.map((id, i) => ({
          sentence_id: 's' + (i + 1),
          text: 'السفر للسياحة إلى بلاد غير المسلمين لا يجوز إلا بشروط ذكرها أهل العلم.',
          claim_ids: [id],
        })),
      }) }], usage: { output_tokens: 60 } };
    }
    if (user.includes('افحصْ كلَّ جملةٍ على حِدَة')) {
      const ids = Array.from(user.matchAll(/### جملة (\S+)/g)).map((m) => m[1]);
      return { content: [{ type: 'text', text: JSON.stringify({
        verdicts: ids.map((id) => ({ sentence_id: id, verdict: 'PASS', added: [] })),
      }) }], usage: { output_tokens: 30 } };
    }
    // Anything else (including the page-match layer) — answer YES so this guard measures the
    // corpus wiring and not the match model.
    const ids = Array.from(user.matchAll(/### مُرشَّح (\S+)/g)).map((m) => m[1]);
    if (ids.length) {
      return { content: [{ type: 'text', text: JSON.stringify({
        verdicts: ids.map((id) => ({ id, answers: true })),
      }) }], usage: { output_tokens: 20 } };
    }
    return { content: [{ type: 'text', text: '{}' }], usage: {} };
  };

  const jsonResponse = (obj) => ({
    ok: true, status: 200, headers: { get: () => 'application/json' },
    json: async () => obj, text: async () => JSON.stringify(obj),
  });

  let readerCalls = 0;
  const directReader = async () => {
    readerCalls++;
    return [{
      canonicalUrl: LESSON_URL, url: LESSON_URL, title: LESSON_TITLE,
      exactText: LESSON_TEXT, scholar: 'محمد بن صالح العثيمين',
    }];
  };

  const runOnce = async (over) => {
    readerCalls = 0;
    const out = await EN.runEngine(Q_TRAVEL, Object.assign({
      plannerOverride, dailyBudgetMode: 'fixture',
      band: 'adult', bandSites: SP.searchableDomains(),
      search: async () => [],                       // the ordinary search finds nothing
      directReader,
      fetchImpl: async (u, init) => {
        if (String(u).includes('api.anthropic.com')) return jsonResponse(modelReply(JSON.parse(init.body)));
        return { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '' };
      },
    }, over || {}));
    return out;
  };

  const r = await runOnce();
  ok('the adapted corpus was actually READ on a question naming nobody', readerCalls === 1,
    'readerCalls=' + readerCalls);
  const urls = (r.cards || []).map((c) => c.url || c.canonicalUrl || '').join(' ');
  ok('...and the Shaykh\'s lesson entered the candidate pool and became the source',
    urls.includes('binothaimeen.net'),
    'outcome=' + r.outcome + ' cards=' + JSON.stringify(r.cards));
  // The consultation itself buys no provider call — the corpus is READ. The one Brave call spent
  // here belongs to the ORDINARY search for the same issue, which still runs and still found
  // nothing; the whole point is that the corpus is consulted ALONGSIDE it, not instead of it.
  ok('...having spent no provider call of its own (only the ordinary search\'s one)',
    r.budget.snapshot().spent.braveCalls <= 1, JSON.stringify(r.budget.snapshot().spent));

  // ── 4. NEVER A DEFAULT ANSWER ──────────────────────────────────────────────
  const rEmpty = await runOnce({ directReader: async () => { readerCalls++; return []; } });
  ok('an EMPTY corpus produces no card', (rEmpty.cards || []).length === 0,
    JSON.stringify(rEmpty.cards));
  ok('...and does not report itself as an absence of DIRECT evidence',
    !(rEmpty.ledger.rejections || []).some((x) => String(x.detail || '').includes('direct-corpus-empty')),
    JSON.stringify((rEmpty.ledger.rejections || []).map((x) => x.code + ':' + x.detail)));

  // A corpus page that does NOT answer the question is refused by the step-1 check, exactly like
  // any other page. Being ours earns it nothing.
  const rOffTopic = await runOnce({
    directReader: async () => {
      readerCalls++;
      return [{
        canonicalUrl: LESSON_URL, url: LESSON_URL, title: 'أحكام زكاة عروض التجارة',
        exactText: 'عروض التجارة هي كل ما أعد للبيع والشراء بقصد الربح وتجب فيها الزكاة إذا بلغت '
          + 'النصاب وحال عليها الحول ويقومها صاحبها بسعر السوق يوم وجوب الزكاة وهذا قول جمهور أهل العلم '
          + 'في زكاة عروض التجارة وما يتصل بها من مسائل النصاب والحول.',
        scholar: 'محمد بن صالح العثيمين',
      }];
    },
  });
  ok('a corpus page that does not answer the question is refused like any other',
    !((rOffTopic.cards || []).map((c) => c.url || '').join(' ').includes('binothaimeen.net')),
    JSON.stringify(rOffTopic.cards));

  // ── 5. THE BUDGETS ─────────────────────────────────────────────────────────
  const B = await esm('lib/ledger/budgets.js');
  ok('MAX_PAGES_FETCHED is still 5', B.MAX_PAGES_FETCHED === 5, String(B.MAX_PAGES_FETCHED));
  ok('MAX_BRAVE_CALLS is still 4', B.MAX_BRAVE_CALLS === 4, String(B.MAX_BRAVE_CALLS));
  ok('MAX_MODEL_CALLS is still 8 — 7 + the query-IR repair call', B.MAX_MODEL_CALLS === 8, String(B.MAX_MODEL_CALLS));
  ok('no run breached a budget', (r.budget.snapshot().breaches || []).length === 0,
    JSON.stringify(r.budget.snapshot().breaches));

  // F-163. The legacy attributed caller does not supply Ledger `io`, but it still has to obey the
  // same governing per-request outbound cap. Drive the real search -> httpJson -> lesson path;
  // every transport below is local and every retry is visible in the counter.
  {
    const BINO = await esmBinothaimeen();
    const realFetch = globalThis.fetch;
    const cap = B.MAX_PAGES_FETCHED;
    const json = (value) => ({
      ok: true, status: 200,
      async text() { return JSON.stringify(value); },
    });
    try {
      BINO.__clearCacheForTest();
      let permanentCalls = 0;
      globalThis.fetch = async () => { permanentCalls++; throw new Error('permanent-local-failure'); };
      const permanent = await BINO.retrieveIbnUthaymeen(
        'حكم معاملة مستقلة كثيرة التفاصيل والقيود النادرة الأولى',
      );
      ok('F-163 permanent failure never exceeds the governing per-request cap',
        permanent.length === 0 && permanentCalls <= cap,
        JSON.stringify({ permanentCalls, cap }));

      BINO.__clearCacheForTest();
      let retryCalls = 0;
      globalThis.fetch = async () => {
        retryCalls++;
        if (retryCalls === 1) throw new Error('first-attempt-local-failure');
        return json({ data: [] });
      };
      await BINO.retrieveIbnUthaymeen('حكم معاملة ثانية ذات شروط متعددة متباينة ومفصلة');
      ok('F-163 retries are charged as outbound attempts under the same cap',
        retryCalls >= 2 && retryCalls <= cap,
        JSON.stringify({ retryCalls, cap }));

      BINO.__clearCacheForTest();
      let successCalls = 0;
      const successId = 'a6-success-id';
      globalThis.fetch = async (url) => {
        successCalls++;
        if (String(url).includes('/api/search-data')) {
          return json({ data: [{
            id: successId, title: { ar: LESSON_TITLE }, content: { ar: LESSON_TEXT }, relevance: 1,
          }] });
        }
        if (String(url).includes('/lessons/audios/show/')) {
          return json({ data: {
            title: { ar: LESSON_TITLE },
            objective: { content: { ar: '<p>' + LESSON_TEXT + '</p>' } },
          } });
        }
        throw new Error('unexpected local URL ' + url);
      };
      const success = await BINO.retrieveIbnUthaymeen(Q_TRAVEL);
      ok('F-163 normal success keeps search and lesson fetch inside the governing cap',
        success.length === 1 && success[0].sourceId === successId
          && successCalls >= 2 && successCalls <= cap,
        JSON.stringify({ successCalls, cap, sources: success.map((s) => s.sourceId) }));

      BINO.__clearCacheForTest();
      let concurrentCalls = 0;
      globalThis.fetch = async () => { concurrentCalls++; throw new Error('concurrent-local-failure'); };
      const concurrent = await Promise.all([
        BINO.retrieveIbnUthaymeen('حكم نازلة مستقلة أولى بقيود كثيرة وتفاصيل نادرة'),
        BINO.retrieveIbnUthaymeen('حكم نازلة مستقلة ثانية بشروط كثيرة وملابسات مختلفة'),
      ]);
      ok('F-163 concurrent requests own independent counters, each bounded by the same cap',
        concurrent.every((items) => items.length === 0)
          && concurrentCalls > cap && concurrentCalls <= cap * 2,
        JSON.stringify({ concurrentCalls, perRequestCap: cap }));

      ok('F-163 exhaustion prevented every outbound attempt beyond the governing cap',
        permanentCalls === cap && retryCalls === cap && concurrentCalls === cap * 2,
        JSON.stringify({ permanentCalls, retryCalls, concurrentCalls, cap }));
    } finally {
      globalThis.fetch = realFetch;
      BINO.__clearCacheForTest();
    }
  }

  // ── 6. WIRING ──────────────────────────────────────────────────────────────
  const eng = read('lib/ledger/engine.js');
  ok('the engine queues the consultation', /adaptedCorpusConsultFor\s*\(/.test(eng));
  ok('...as an extra batch, AFTER the search batches',
    /batches\.push\(\{[\s\S]{0,200}consult: true/.test(eng),
    'queued first, it would spend the page budget before the ordinary search');

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL' : ' — PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
