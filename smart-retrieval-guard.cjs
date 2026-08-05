// smart-retrieval-guard.cjs — a scholar's name starts a search; it does not end one.
//
// THE DEFECT THIS GATE EXISTS TO MAKE IMPOSSIBLE. The request path used to ask a single
// question — "did a scholar's name appear?" — and treat the answer as final. One adapter was
// consulted; everything else emitted a fixed sentence, with no search performed at all:
//
//     «لم أتمكن من توثيق هذا القول عن الشيخ من مصدره المعتمد، لذلك لا أنسبه إليه.»
//
// So «ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟» got that sentence although the
// general ruling was documented and citable; «حديث من موقع الشيخ عبدالمحسن العباد» got it
// although it asks for MATERIAL and never for an opinion; and a transient failure of the Ibn
// Uthaymeen adapter got it too, hiding a ruling that was there to be found.
//
// WHAT IS NOT RELAXED. No position may be credited to a man without a page of his that says
// it. That is enforced on the retrieved text by lib/attribution.js's verifier and is asserted
// here and in attribution-guard.cjs. What changed is only what happens when the search fails:
// the reader gets the documented general ruling plus one line saying it is not his, instead
// of a sentence that answers nothing.
//
// Offline and deterministic: the model and the network are stubbed, so this measures the
// ROUTING — which path a question takes and why — not anybody's prose.
//
// Usage: node smart-retrieval-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = __dirname;
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const user = (t) => [{ role: 'user', content: t }];

(async function main() {
  console.log('=== smart-retrieval-guard — a name starts a search, it does not end one ===');

  const AP = await esm('lib/ask-plan.js');
  const { planAsk, REASON, unattributedNote, NEEDS_MATERIAL } = AP;
  const A = await esm('lib/attribution.js');
  const R = await esm('lib/source-registry.js');
  const B = await esm('lib/brave-query.js');
  const ask = read('api/ask.js');

  // =========================================================================
  console.log('\n=== A. detectAttribution DESCRIBES; IT DOES NOT ANSWER ===');
  {
    const src = read('lib/attribution.js');
    ok('it returns a mode, not a verdict', /mode: 'namedScholarOpinion'/.test(src) && /ATTRIBUTION_MODES/.test(src));
    ok('it emits no reply text of its own',
      !/res\.write|content_block_delta/.test(src), 'a classifier must not write to the wire');
    eq('the four modes are the declared set', A.ATTRIBUTION_MODES.slice(),
      ['none', 'namedScholarOpinion', 'materialFromScholarSite', 'unnamedScholarClaim']);
    // THE CANNED SENTENCE IS DELETED, NOT MERELY UNUSED. A ready-made fallback string is an
    // invitation: the next person to hit an awkward branch reaches for the one already there.
    ok('the constant no longer exists in lib/attribution.js',
      !/ATTRIBUTION_REFUSAL\s*=/.test(src) && !/export const ATTRIBUTION_REFUSAL/.test(src));
    ok('...and the sentence itself is gone from that module',
      !/لم أتمكن من توثيق هذا القول عن الشيخ من مصدره المعتمد/.test(src));
    ok('the old sentence is NOT a fallback anywhere in the request path',
      !/ATTRIBUTION_REFUSAL/.test(ask), 'it was the answer to every unmatched attribution');
    ok('...and appears in NO shipped runtime module',
      ['lib/attribution.js', 'lib/ask-plan.js', 'lib/retrieve.js', 'lib/claim-gate.js', 'api/ask.js']
        .every((f) => !/لم أتمكن من توثيق هذا القول عن الشيخ/.test(read(f))));
    ok('...and the note that replaced it is only ever appended to a sourced answer',
      /attributionNote \? '\\n\\n' \+ attributionNote/.test(ask));
    ok('the note names the scholar and asserts no ruling',
      /لم أقف على نصٍّ مباشرٍ/.test(unattributedNote('فلان'))
      && !/يجوز|لا يجوز|حرام|واجب/.test(unattributedNote('فلان')));
  }

  // =========================================================================
  console.log('\n=== B. THE EIGHT CASES, PLANNED ON THE REAL PATH ===');
  const CASES = [
    // `domain` WAS '' HERE, and that was the drift: the one scholar with a purpose-built adapter
    // was the one scholar the registry could not name. binothaimeen.net is his corpus; it is still
    // on no band's search list (guards/scholar-registry-drift-guard.cjs asserts that separately),
    // and `adapter: true` below is still what decides how it is read.
    { n: 1, q: 'ما رأي الشيخ ابن عثيمين فيمن أسقطت دون 80 يوم؟',
      purpose: 'fatwa', mode: 'namedScholarOpinion', entity: 'ابن عثيمين', adapter: true, domain: 'binothaimeen.net' },
    { n: 2, q: 'ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟',
      purpose: 'fatwa', mode: 'namedScholarOpinion', entity: 'عبدالمحسن العباد', adapter: false, domain: 'al-abbaad.com' },
    { n: 3, q: 'حديث من موقع الشيخ عبدالمحسن العباد',
      purpose: 'hadith', mode: 'materialFromScholarSite', entity: 'عبدالمحسن العباد', adapter: false, domain: 'al-abbaad.com' },
    { n: 4, q: 'ما حكم بيع الذهب بالتقسيط؟',
      purpose: 'fatwa', mode: 'none', entity: '', adapter: false, domain: '' },
    { n: 5, q: 'حكم قول يا معطي لا تبطي',
      purpose: 'fatwa', mode: 'none', entity: '', adapter: false, domain: '' },
    { n: 6, q: 'اشرح حديث إنما الأعمال بالنيات',
      purpose: 'hadith', mode: 'none', entity: '', adapter: false, domain: '' },
    { n: 7, q: 'قال الشيخ إن بيع الذهب بالتقسيط جائز',
      purpose: 'fatwa', mode: 'unnamedScholarClaim', entity: '', adapter: false, domain: '' },
    { n: 8, q: 'ما حكم ما قاله الشيخ في المقطع؟',
      purpose: 'fatwa', mode: 'unnamedScholarClaim', entity: '', adapter: false, domain: '' },
  ];
  for (const c of CASES) {
    const p = planAsk(user(c.q));
    eq('case ' + c.n + ' purpose', p.purpose, c.purpose);
    eq('case ' + c.n + ' attributionMode', p.attributionMode, c.mode);
    eq('case ' + c.n + ' namedEntity', p.namedEntity, c.entity);
    eq('case ' + c.n + ' hasDirectAdapter', p.hasDirectAdapter, c.adapter);
    eq('case ' + c.n + ' officialDomain', p.officialDomain, c.domain);
    eq('case ' + c.n + ' sourceRole', p.sourceRole,
      { fatwa: 'fatwa-authority', tafsir: 'quran-scholarship', hadith: 'hadith-scholarship', general: 'general-scholarship' }[c.purpose]);
    ok('case ' + c.n + ' has a topic distinct from the framing', !!p.topic);
  }

  // Case 3 vs case 2: the SAME scholar, two different requests. They must not be the same mode.
  {
    const p2 = planAsk(user(CASES[1].q));
    const p3 = planAsk(user(CASES[2].q));
    ok('materialFromScholarSite is NOT namedScholarOpinion', p2.attributionMode !== p3.attributionMode);
    ok('...and the material request never enters the attributed branch',
      p3.attributionMode === 'materialFromScholarSite' && p3.needsClarification === false);
  }
  // Cases 7 and 8: nobody is named, so nothing may be attributed and nothing guessed.
  for (const c of [CASES[6], CASES[7]]) {
    const p = planAsk(user(c.q));
    ok('case ' + c.n + ' asks for clarification instead of guessing a scholar', p.needsClarification);
    eq('case ' + c.n + ' names nobody', p.namedEntity, '');
  }
  ok('neither surviving clarification line makes a religious claim',
    !/يجوز|لا يجوز|حرام|حلال|واجب|بدعة/.test(AP.AMBIGUOUS_SCHOLAR + ' ' + NEEDS_MATERIAL));

  // =========================================================================
  console.log('\n=== B2. WHO IS THIS? — resolved / ambiguous / unresolved ===');
  {
    // Whole names and their known spellings reach the right domain.
    const RESOLVES = [
      ['ابن باز', 'binbaz.org.sa'], ['عبدالعزيز بن باز', 'binbaz.org.sa'],
      ['عبدالمحسن العباد', 'al-abbaad.com'], ['عبد المحسن العباد', 'al-abbaad.com'],
      ['العباد', 'al-abbaad.com'], ['فركوس', 'ferkous.com'],
      ['محمد صالح المنجد', 'almunajjid.com'], ['مصطفى العدوي', 'mostafaaladwy.com'],
    ];
    for (const [n, d] of RESOLVES) {
      const r = R.resolveScholar(n);
      eq('resolves «' + n + '»', [r.status, r.domain || ''], ['resolved', d]);
    }

    // A PASSING FRAGMENT IS NOT AN IDENTIFICATION. The first version accepted
    // `n.includes(f) || f.includes(n)` in either direction and returned the FIRST row that
    // matched — so «عبدالله» silently became one specific scholar.
    for (const n of ['عبدالله', 'عبد', 'محمد', 'صالح', 'الشيخ', 'ابن', 'خالد', 'عثمان']) {
      eq('a bare fragment «' + n + '» resolves nobody', R.resolveScholar(n).status, 'unresolved');
    }
    // An unregistered scholar is never attached to an arbitrary domain.
    for (const n of ['فلان الفلاني', 'أحمد بن محمد الأحمدي', 'سعيد بن سعيد']) {
      eq('an unregistered name «' + n + '» resolves nobody', R.resolveScholar(n).status, 'unresolved');
      eq('...and findScholarDomain returns null', R.findScholarDomain(n), null);
    }
    // Two matches must NOT collapse to the first one.
    for (const n of ['خالد المصلح خالد السبت', 'عبدالرزاق البدر عثمان الخميس', 'ابن باز ابن جبرين']) {
      const r = R.resolveScholar(n);
      eq('«' + n + '» is ambiguous', r.status, 'ambiguous');
      ok('...and reports every candidate rather than choosing', (r.candidates || []).length >= 2);
      eq('...and findScholarDomain refuses to pick', R.findScholarDomain(n), null);
    }
    // Whole-word matching: an alias inside a longer word is not a match.
    eq('«العبادات» is not «العباد»', R.resolveScholar('العبادات').status, 'unresolved');
    eq('«السبتية» is not «السبت»', R.resolveScholar('السبتية').status, 'unresolved');
    // Generated sweep: no single word from the table resolves unless it IS a whole alias.
    {
      let leaked = 0;
      for (const w of ['عبد', 'بن', 'ال', 'محمد', 'الشيخ', 'الدين', 'أبو', 'سالم']) {
        if (R.resolveScholar(w).status === 'resolved') leaked++;
      }
      eq('no common name-particle resolves a scholar', leaked, 0);
    }
  }

  // =========================================================================
  console.log('\n=== B3. TWO FAILURES THAT MUST NOT SOUND THE SAME ===');
  {
    // A — identified, corpus searched, nothing found: the general ruling may stand in.
    const a = planAsk(user('ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟'));
    eq('A: identity resolved', a.scholarStatus, 'resolved');
    eq('A: a real domain to search', a.officialDomain, 'al-abbaad.com');
    eq('A: does NOT ask for identity', a.needsScholarIdentity, false);

    // B — not identified: no search was run, so nothing may be claimed about one.
    for (const q of ['ما رأي الشيخ عبدالله في هذه المسألة؟', 'ما رأي الشيخ فلان الفلاني في هذه المسألة؟']) {
      const b = planAsk(user(q));
      eq('B: «' + q.slice(0, 30) + '…» is not resolved', b.scholarStatus !== 'resolved', true);
      eq('B: asks for identity', b.needsScholarIdentity, true);
      eq('B: has no domain to search', b.officialDomain, '');
    }
    // ── RE-PINNED: THE ORDER CHANGED, THE DISTINCTION DID NOT ──────────────
    //
    // These three checks used to guarantee that an unidentified name produced a template which
    // carefully did NOT claim a search, and that it started no search either. Both halves were
    // faithfully implemented and together they were the defect: the reader was told «لم أبحثْ في
    // مصدرٍ رسميٍّ له بعدُ» and then nothing was ever searched, so the request ended with the
    // ruling unanswered and a request for the man's website. Honest about doing nothing is still
    // doing nothing.
    //
    // The invariant that MATTERS survives unchanged and is asserted harder below: a sentence
    // claiming we looked may only be written after we looked. What is inverted is the order — the
    // search now runs first, so the sentence becomes sayable instead of being avoided.
    ok('the post-search note states that a direct search found nothing',
      /لم أقف على نصٍّ مباشرٍ/.test(unattributedNote('فلان')));
    ok('an unidentified scholar now STARTS a search rather than ending the request',
      /if \(attributionUnverified && plan\.namedEntity && !attributionSearched && !nonScholar\)[\s\S]{0,1800}?await retrieve\(/.test(ask));
    ok('...and the note claiming a search is written only where the search happened',
      /attributionSearched = true;\s*\n\s*attributionNote = unattributedNote\(plan\.namedEntity\);/.test(ask));
    ok('no identity template can end a request any more',
      !/NEEDS_SCHOLAR_IDENTITY/.test(ask) && !/NEEDS_SCHOLAR_NAME/.test(ask));
    // THE ONE CLARIFICATION THAT SURVIVES, and the reason it is honest: we can name the choices.
    ok('genuine ambiguity between REGISTERED men still asks, and names them',
      /plan\.scholarStatus === 'ambiguous'/.test(ask)
      && /ambiguousScholarPrompt\(plan\.scholarCandidates\)/.test(ask));
    {
      const amb = planAsk(user('ما رأي خالد المصلح خالد السبت في الطلاق؟'));
      eq('...and such a question really is ambiguous', amb.scholarStatus, 'ambiguous');
      const prompt = AP.ambiguousScholarPrompt(amb.scholarCandidates);
      ok('...and the prompt lists the candidates rather than demanding a website',
        /خالد المصلح/.test(prompt) && /خالد السبت/.test(prompt) && !/رابطَ موقعِه/.test(prompt), prompt);
      ok('...and it claims no search', !/لم أقف|لم أبحث/.test(prompt), prompt);
    }
    ok('the five new reason codes exist and are logged only',
      ['SCHOLAR_RESOLVED', 'SCHOLAR_IDENTITY_AMBIGUOUS', 'SCHOLAR_IDENTITY_UNRESOLVED',
        'DIRECT_CORPUS_SEARCHED_NO_EVIDENCE', 'GENERAL_RULING_SUBSTITUTED']
        .every((c) => !!REASON[c]));
    ok('...and none of them is ever written to the reader',
      !/text: REASON\.|text_delta[^}]*REASON\./.test(ask));
  }

  // =========================================================================
  console.log('\n=== C. SCOPE AND ROLE STILL DECIDE WHAT MAY ANSWER ===');
  {
    const ADULT = R.domainsForBand('adult');
    // Case 6: a hadith question must not reach the sources whose scope excludes hadith.
    const keptH = R.filterSitesForPurpose(ADULT, 'hadith');
    eq('hadith drops the sources whose role forbids it',
      ['tafsir.net', 'khutabaa.com', 'salafcenter.org', 'almunajjid.com', 'saleh.af.org.sa', 'khaledalsabt.com']
        .filter((d) => keptH.includes(d)), []);
    ok('...and al-abbaad.com remains searchable for hadith', keptH.includes('al-abbaad.com'));
    // Case 3: the scholar's own site must be allowed for the purpose, or the scoped search
    // would be a role mismatch rather than a shortcut.
    const p3 = planAsk(user(CASES[2].q));
    ok('the site named in a material request is allowed for that purpose',
      R.sourceAllowsPurpose(p3.officialDomain, p3.purpose), REASON.SOURCE_ROLE_MISMATCH);
    // Case 2: al-abbaad's scope EXCLUDES fatwa, so a scoped fatwa search of his site finds
    // nothing — which is exactly why the general-ruling fallback has to exist.
    ok('a scholar whose site is not a fatwa source yields no scoped fatwa result',
      !R.sourceAllowsPurpose('al-abbaad.com', 'fatwa'),
      'and the reader must still get the general ruling, not a canned refusal');
  }

  // =========================================================================
  console.log('\n=== D. THE REQUEST PATH (model + network stubbed) ===');
  {
    const realFetch = globalThis.fetch;
    const at = (r, u) => { Object.defineProperty(r, 'url', { value: u }); return r; };
    const state = { brave: 0, pages: 0, anthropic: 0 };
    const PAGE = 'نصٌّ علميٌّ كافٍ في المسألة وفيه بيان الحكم بالدليل والتفصيل الوافي. '.repeat(30);
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('api.search.brave.com')) {
        state.brave++;
        return at(new Response(JSON.stringify({ web: { results: [
          { title: 'الطلاق في الغضب', url: 'https://islamweb.net/ar/fatwa/1001/x', description: '' },
        ] } }), { status: 200, headers: { 'content-type': 'application/json' } }), u);
      }
      state.pages++;
      return at(new Response('<html><head><title>t</title></head><body><article><p>' + PAGE + '</p></article></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }), u);
    };
    process.env.BRAVE_API_KEY = process.env.BRAVE_API_KEY || 'stub-for-gate';
    const { retrieve } = await esm('lib/retrieve.js');

    // A scoped search restricted to a domain that is NOT on the band list must return
    // nothing rather than silently widening.
    state.brave = 0;
    let out = await retrieve('الطلاق في الغضب', { band: 'adult', onlySites: ['not-on-any-list.example'] });
    eq('a scoped search off the band list returns no source', out.sources.length, 0);
    eq('...and costs no request at all', state.brave, 0);

    // A scoped search restricted to an approved domain searches ONLY that domain.
    state.brave = 0;
    out = await retrieve('الطلاق في الغضب', { band: 'adult', onlySites: ['islamweb.net'] });
    ok('a scoped search of an approved domain runs', state.brave >= 1);
    eq('...as exactly one request', state.brave, 1);

    // Every query the scoped path builds is still inside the provider's ceiling.
    ok('a scoped query is trivially inside the limits',
      B.withinSafe(B.buildQuery('الطلاق في الغضب', ['al-abbaad.com'])));

    globalThis.fetch = realFetch;
  }

  // =========================================================================
  console.log('\n=== E. THE WIRING (api/ask.js) ===');
  ok('the request is planned, not merely flagged', /const plan = planAsk\(body\.messages/.test(ask));
  // RE-PINNED ON THE STRONGER CONDITION. This used to assert that the planner was told whether the
  // rollout flag was live — which, with the flag default-OFF and off on every failure to read it,
  // meant fresh production planned every request with the entity veto inert: a mosque was asked
  // which shaykh it meant. The veto is a REPAIR, and a repair does not get staged. So the check is
  // not weakened and not dropped — it is tightened to the thing that must now be true.
  ok('...and the planner is told the policy is live UNCONDITIONALLY',
    /planAsk\(body\.messages, \{ policyEnabled: true \}\)/.test(ask));
  ok('...so no rollout flag can make the entity veto inert',
    !/planAsk\(body\.messages, \{ policyEnabled: legacyPolicy\.enabled \}\)/.test(ask));
  // EVALUATED, NOT MATCHED. The shipped routing expression is lifted out of api/ask.js and run
  // against real plans, so this asserts the GUARANTEE (an attributed question never reaches the
  // unsourced path) rather than one spelling of it. A rewrite that kept the wording and broke the
  // guarantee used to pass this check; it no longer can.
  {
    // Same correction as attribution-guard: the `new Function` extraction is gone. It broke as
    // soon as the expression referenced a variable outside its synthetic scope, and it never
    // measured the branch a reader actually takes. The route is driven through the real handler
    // in guards/rfc-v05r2-wiring-guard.cjs; what is asserted here is the planner input.
    eq('a name is still classified as an opinion request',
      planAsk(user('ما رأي الشيخ عبدالمحسن العباد في الطلاق في الغضب؟')).attributionMode, 'namedScholarOpinion');
    eq('...and an ordinary question is not',
      planAsk(user('احك لي نكتة')).attributionMode, 'none');
    ok('the handler routes anything attributed to DEEN',
      /plan\.attributionMode !== 'none'[\s\S]{0,200}\? 'DEEN'/.test(ask));
  }
  ok('the adapter is tried FIRST for the scholar who has one', /if \(plan\.hasDirectAdapter\)/.test(ask));
  ok('a scholar without an adapter still gets his own site searched',
    /else if \(plan\.officialDomain\)/.test(ask) && /onlySites: \[plan\.officialDomain\]/.test(ask));
  ok('finding nothing sets a NOTE and falls through — it does not end the request',
    /attributionNote = unattributedNote\(plan\.namedEntity\);/.test(ask));
  ok('the general answer is instructed not to credit him',
    /لا تنسبْ إليه شيئًا البتّةَ/.test(ask));
  ok('...and not to make the absence of his text the answer',
    /لا تجعلْ عدمَ وجودِ نصِّه هو الجواب/.test(ask));
  // RE-PINNED. Material we were never given is still a dead end — nothing can be fetched from a
  // description of a clip. A missing NAME is not: «قال لي صاحبي إن الصلاة على وقتها» is a question
  // about the ruling wearing a frame, and ending the request to ask whose opinion was meant
  // refused the question the reader actually asked.
  ok('a claim about material we were never given still asks for it',
    /plan\.needsClarification/.test(ask) && /NEEDS_MATERIAL/.test(ask));
  ok('...but a nameless claim is answered from the sources instead of interrogated',
    /answering the question instead/.test(ask) && !/NEEDS_SCHOLAR_NAME/.test(ask));
  ok('the reason codes are logged, never written to the reader',
    /REASON\.DIRECT_CORPUS_SEARCHED_NO_EVIDENCE/.test(ask)
    && /console\.warn\('\[attribution\]', REASON\./.test(ask)
    && !/text: REASON|delta.*REASON/.test(ask));
  ok('a verified attribution still emits its own card from the canonical URL',
    /REASON\.DIRECT_ATTRIBUTION_CONFIRMED/.test(ask) && /buildSourceTag\(\{ url: src\.canonicalUrl/.test(ask));
  ok('no verified source anywhere still refuses rather than answering unsourced',
    /NO_VERIFIED_SOURCE_MESSAGE/.test(ask));
  ok('the age bands are untouched by this change',
    /opts\.band === 'adult' \? \[SITES_ADULT\] : \[SITES_MINOR, SITES_MINOR_FALLBACK\]/.test(read('lib/retrieve.js')));
  ok('gates.json lists this guard', /smart-retrieval-guard\.cjs/.test(read('gates.json')));

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('smart-retrieval-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
