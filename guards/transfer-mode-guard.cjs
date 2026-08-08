// guards/transfer-mode-guard.cjs — MOVING A PUBLISHED ANSWER, OR REFUSING TO.
//
// ── WHAT TRANSFER MODE RISKS (قرار ١ + ٢) ────────────────────────────────────
// When the reader's question IS a question a vetted source already published, handing over the
// published answer beats generating a paraphrase of it. The entire risk is ONE failure: two
// questions that look alike and are not the same question. «قصر الصلاة للمسافر» and «قصر الصلاة
// للمقيم» differ by one word, score above 0.9 on any word measure, and have opposite answers.
//
// So this gate is mostly about REFUSALS. A transfer that does not happen costs the reader nothing
// — the ordinary sourced answer runs. A transfer that happens wrongly puts a scholar's name on an
// answer to a question he was never asked.
//
// ── NO NETWORK AND NO MODEL ──────────────────────────────────────────────────
// Every page is a saved fixture and the judge is a mock, both injected. `globalThis.fetch` is a
// throwing stub for the whole run: reaching for the network is a failure here, not a slow pass.
//
// Usage: node guards/transfer-mode-guard.cjs
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
const eq = (name, actual, expected) =>
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── FIXTURES: saved pages, never fetched ─────────────────────────────────────
const HAMDALA = 'الحمد لله والصلاة والسلام على رسول الله وعلى آله وصحبه، أما بعد:';
const BODY = 'العقيقة سنة مؤكدة عن المولود، وهي شاة عن الأنثى وشاتان عن الذكر، تُذبح في اليوم السابع. ';
const labelPage = (q, a) => '<html><body><article>'
  + '<p>السؤال: ' + q + '</p>'
  + '<p>الإجابــة: ' + a + '</p>'      // tatweel ON PURPOSE: islamweb prints it this way
  + '</article></body></html>';

(async function main() {
  console.log('=== transfer-mode-guard — the published answer moves, or nothing does ===');

  const realFetch = globalThis.fetch;
  let reached = 0;
  globalThis.fetch = async (u) => { reached++; throw new Error('network reached: ' + u); };

  try {
    const M = await esm('lib/transfer/match.js');
    const X = await esm('lib/transfer/extract.js');
    const T = await esm('lib/transfer/trim.js');
    const I = await esm('lib/transfer/index.js');

    // =========================================================================
    console.log('\n=== A. THE NAMED CONSTANTS ARE WHAT THE DECISION SAYS ===');
    eq('TRANSFER_MATCH', M.TRANSFER_MATCH, 0.97);
    eq('JUDGE_BAND low', M.JUDGE_BAND[0], 0.85);
    eq('JUDGE_BAND high', M.JUDGE_BAND[1], 0.97);
    ok('the judge band ends where the match begins — no gap and no overlap',
      M.JUDGE_BAND[1] === M.TRANSFER_MATCH);
    // PRINTED IN FULL, because قرار ٢ requires the list to be auditable rather than described.
    console.log('        FLIP_TOKENS (' + M.FLIP_TOKENS.length + '):');
    console.log('        ' + M.FLIP_TOKENS.join(' '));
    ok('FLIP_TOKENS is non-trivial', M.FLIP_TOKENS.length >= 80, String(M.FLIP_TOKENS.length));
    // THE ḤĀL FAMILIES ARE SHARED, NOT COPIED. A second list is a list that can disagree.
    const PM = await esm('lib/page-match.js');
    const halMembers = Object.values(PM.QUALIFIER_GROUPS).flat();
    ok('every ḥāl family member from lib/page-match.js is a flip token',
      halMembers.every((h) => M.FLIP_TOKENS.includes(h)),
      halMembers.filter((h) => !M.FLIP_TOKENS.includes(h)).join(' '));
    ok('...and match.js imports them rather than restating them',
      /import \{ QUALIFIER_GROUPS \} from '\.\.\/page-match\.js'/.test(read('lib/transfer/match.js')));
    // The framing words that are DELIBERATELY not flip tokens.
    for (const w of ['ما', 'يجوز', 'يجب', 'سنه']) {
      ok('«' + w + '» is deliberately NOT a flip token', !M.FLIP_TOKENS.includes(w),
        'a framing word in this list makes «هل يجوز…» and «ما حكم…» different questions');
    }

    // =========================================================================
    console.log('\n=== B. THE EIGHTH DOMAIN IS THE ONE THAT IS ABSENT ===');
    {
      const doms = X.transferableDomains();
      console.log('        readable: ' + doms.join(' '));
      ok('mostafaaladwy.com has NO extractor', !doms.includes('mostafaaladwy.com'),
        'قرار ١٠ says its answer is a video — there is no published text to transfer');
      // ...and enforced at the entry point too, not only by omission from the table.
      eq('a video-answer page is unreadable even if asked directly',
        X.extractPair('https://mostafaaladwy.com/fatwa/1', labelPage('س', BODY.repeat(3))), null);
      ok('the readable domains are all on the registry', doms.length >= 6, String(doms.length));
    }

    // =========================================================================
    console.log('\n=== C. FIXTURE: A CLEAN HIT IS TRANSFERRED ===');
    {
      const Q = 'ما حكم العقيقة عن المولود';
      const r = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/fatwa/1001/x', html: labelPage(Q, HAMDALA + ' ' + BODY.repeat(3)),
      });
      ok('a verbatim question transfers', r.transfer === true, r.reason);
      ok('...at or above TRANSFER_MATCH', r.score >= M.TRANSFER_MATCH, String(r.score));
      ok('...carrying the PUBLISHED text', /العقيقة سنة مؤكدة/.test(r.text || ''));
      ok('...with the ḥamdala removed', r.openingStripped === true && !/الحمد لله/.test(r.text || ''));
      ok('...and the card is the page itself', r.url === 'https://islamweb.net/ar/fatwa/1001/x');
      // NO MODEL WAS ASKED. The clean hit is the common case and it must cost nothing.
      eq('...and no judge was consulted', r.judged, false);
    }

    // =========================================================================
    console.log('\n=== D. FIXTURE: A FLIPPED QUALIFIER AT HIGH SIMILARITY IS REFUSED ===');
    {
      // THE CASE THIS WHOLE GATE EXISTS FOR. One word apart, opposite answers.
      const READER = 'ما حكم قصر الصلاة للمسافر في السفر الطويل عند أهل العلم';
      const PAGE = 'ما حكم قصر الصلاة للمقيم في السفر الطويل عند أهل العلم';
      const r = await I.considerTransfer(READER, {
        url: 'https://islamweb.net/ar/fatwa/1002/x', html: labelPage(PAGE, BODY.repeat(3)),
      }, { judge: async () => 'لا' });   // even a PERMISSIVE judge must not rescue it
      ok('the مسافر/مقيم pair does NOT transfer', r.transfer === false, r.reason);
      ok('...and the reason names the flip', /flip-token/.test(r.reason), r.reason);
      ok('...having scored high enough that similarity alone would have allowed it',
        r.score >= 0.8, String(r.score));
      ok('...and the flip tokens are reported', (r.flips || []).length >= 1, JSON.stringify(r.flips));
      // ── THE VETO ABOVE THE THRESHOLD, WHICH IS THE ONLY PLACE IT DECIDES ANYTHING ──
      //
      // MEASURED WHILE WRITING THIS GATE, and it changed the fixture: the pair above scores 0.833,
      // which is BELOW the judge band, so it refuses on the arithmetic alone. Disabling the veto
      // entirely left it refusing — the assertion was passing for a reason that had nothing to do
      // with the rule under test.
      //
      // A one-word difference cannot reach 0.97 in a short question: with n words each side and
      // one differing, Jaccard is (n-1)/(n+1), which needs n ≥ 66. The realistic shape that DOES
      // reach it is an extra QUALIFIER on a long question — the page answers «…للمسافر» and the
      // reader asked the same thing without it — where Jaccard is n/(n+1).
      //
      // قرار ٢ says the check is «حتميٌّ دائمًا — حتى فوقَ العتبة», and this is that case.
      const LONG = 'ما حكم قصر الصلاة الرباعية في السفر الطويل الذي تبلغ مسافته ثمانين كيلا عند '
        + 'جمهور أهل العلم من الفقهاء المتقدمين والمتأخرين مع بيان الدليل من الكتاب والسنة وقول '
        + 'الصحابة رضوان الله عليهم اجمعين في هذه المسالة المهمة';
      const cmp = M.compareQuestions(LONG, LONG + ' للمسافر');
      ok('the above-threshold pair really is above the threshold',
        cmp.score >= M.TRANSFER_MATCH, String(cmp.score));
      ok('...and the flip veto downgrades it anyway', cmp.verdict !== 'transfer', JSON.stringify(cmp.verdict));
      ok('...naming the qualifier that did it', cmp.flips.includes('للمسافر'), JSON.stringify(cmp.flips));
    }

    // =========================================================================
    console.log('\n=== E. THE JUDGE IS DECISIVE, AND EVERY DOUBT REFUSES ===');
    {
      const A = 'ما حكم العقيقة عن المولود الذكر في اليوم السابع من ولادته';
      const B = 'ما حكم العقيقة عن المولود في اليوم السابع من ولادته';
      const page = { url: 'https://islamweb.net/ar/fatwa/1003/x', html: labelPage(B, BODY.repeat(3)) };
      const cmp = M.compareQuestions(A, B);
      ok('the pair really is inside the judge band',
        cmp.score >= M.JUDGE_BAND[0] && cmp.score < M.JUDGE_BAND[1], String(cmp.score));

      const yes = await I.considerTransfer(A, page, { judge: async () => 'نعم' });
      ok('«نعم» refuses', yes.transfer === false && yes.reason === 'judge-refused');
      const no = await I.considerTransfer(A, page, { judge: async () => 'لا' });
      ok('«لا» allows', no.transfer === true && no.reason === 'judge-allowed');
      // AMBIGUITY IS A REFUSAL. None of these is an unambiguous «لا».
      for (const reply of ['لا، لأن الأول مقيد بالذكر', 'ربما', 'no', '', 'نعم في الجملة']) {
        const r = await I.considerTransfer(A, page, { judge: async () => reply });
        ok('an ambiguous reply refuses: ' + JSON.stringify(reply), r.transfer === false, r.reason);
      }
      // A JUDGE THAT THREW HAS NOT SAID NO.
      const threw = await I.considerTransfer(A, page, { judge: async () => { throw new Error('upstream 500'); } });
      ok('a judge that threw refuses', threw.transfer === false && threw.reason === 'judge-unavailable');
      // NO JUDGE AT ALL — a caller without one has not established anything.
      const none = await I.considerTransfer(A, page);
      ok('no judge means no transfer', none.transfer === false && none.reason === 'judge-band-with-no-judge');
      // ...and the judge asks the SPECIFIC question, not «are these the same?»
      ok('the judge is asked about a fiqh qualifier, not about similarity',
        M.JUDGE_QUESTION.includes('قيدٌ فقهيٌّ'), M.JUDGE_QUESTION);
    }

    // =========================================================================
    console.log('\n=== F. FIXTURE: THE ḤAMDALA IS CUT, BY A CLOSED LIST ===');
    {
      eq('a bare ḥamdala opening is removed',
        T.stripOpening(HAMDALA + ' ' + BODY).startsWith('العقيقة'), true);
      // FULLY VOCALISED is the same formula. The pages write it both ways.
      const voc = 'الحَمْدُ للهِ وَالصَّلاةُ وَالسَّلامُ عَلَى رَسُولِ اللهِ وَعَلَى آلِهِ وَصَحْبِهِ، أَمَّا بَعْدُ:';
      ok('...and so is the vocalised spelling', T.stripOpening(voc + ' ' + BODY).startsWith('العقيقة'),
        T.stripOpening(voc + ' ' + BODY).slice(0, 40));
      // A CLOSED LIST, NOT A HEURISTIC: a first sentence that merely praises God is NOT an opening.
      const real = 'الحمد لله الذي جعل العقيقة سنة، وهي شاة عن الأنثى.';
      eq('a first sentence that is part of the ANSWER is not cut', T.stripOpening(real), real);
      // NEVER RETURNS EMPTY.
      ok('a page whose whole body is the formula keeps its text',
        T.stripOpening(HAMDALA).length > 0);
    }

    // =========================================================================
    console.log('\n=== G. FIXTURE: A QUOTATION AT THE TRIM BOUNDARY ENTERS WHOLE ===');
    {
      // An āyah cut in half is a misquotation. A hadith cut in half can invert its meaning.
      //
      // THE FIXTURE IS THE MUSHAF'S OWN BYTES (2:43), read from quran-uthmani.json rather than
      // typed. MEASURED while writing this gate: a hand-typed «وَأَقِيمُوا الصَّلَاةَ …» in modern
      // orthography matched NOTHING — the Uthmani text writes «ٱلصَّلَوٰةَ» with a wāw, and
      // normalizeArabic folds diacritics and hamza forms but cannot turn a wāw into an alif. So
      // the check looked like it had failed when it was the fixture that was not Qur'an.
      const AYAH = require(path.join(REPO, 'quran-uthmani.json'))['2:43'];
      ok('the āyah fixture really is the mushaf text', typeof AYAH === 'string' && AYAH.length > 40);
      // The quotation SPANS the cut: it begins in the first paragraph and ends in the second.
      // SPLIT AT A WORD BOUNDARY. Cutting mid-word leaves two broken tokens that rejoin into
      // nothing, so lib/frozen-text.js would correctly report no run and the case would prove the
      // opposite of what it claims. The realistic shape is a quotation continuing across a break.
      const at = AYAH.indexOf(' ', Math.floor(AYAH.length / 2));
      const head = 'قال تعالى: ' + AYAH.slice(0, at);
      const tail = AYAH.slice(at + 1) + ' وهذا يدل على وجوب الصلاة.';
      const spanning = [head, tail, 'وسط. '.repeat(80), 'والله أعلم.'].join('\n\n');
      const t = T.trimToLength(spanning, 150);
      ok('an answer whose quotation spans the cut is carried WHOLE',
        t.truncated === false, JSON.stringify(t).slice(0, 200));
      // Derived from the fixture, never typed: the mushaf writes «ٱلرَّٰكِعِينَ», and a
      // hand-typed «الرَّاكِعِينَ» is a different string — the same trap as the fixture itself.
      ok('...so both halves of the āyah survive intact',
        t.text.includes(head) && t.text.includes(tail));

      // ...while an answer with no quotation at the boundary IS trimmed.
      const plain = ['الفقرة الأولى فيها الجواب.', 'وسط طويل. '.repeat(60), 'وبهذا يتبين الحكم.'].join('\n\n');
      const p = T.trimToLength(plain, 300);
      ok('an ordinary long answer IS trimmed', p.truncated === true);
      ok('...keeping the first and the last paragraph', p.keptParagraphs === 2 && p.totalParagraphs === 3);
      ok('...with the elision mark between them', p.text.includes(T.ELISION_MARK));
      // ...and the reader is TOLD.
      const prep = T.prepareTransfer(plain, { maxChars: 300 });
      ok('a trimmed transfer is tailed with «التتمة في المصدر»', prep.text.endsWith(T.TRUNCATION_TAIL));
      const short = T.prepareTransfer('جواب قصير جدا لا يحتاج قصا.', { maxChars: 300 });
      ok('...and an untrimmed one is not', !short.text.includes(T.TRUNCATION_TAIL));
    }

    // =========================================================================
    console.log('\n=== H. THE NEGATIVE WITNESS ===');
    // A gate that only proved transfers happen would pass while everything transferred.
    {
      const Q = 'ما حكم العقيقة عن المولود';
      // A different question entirely.
      const other = await I.considerTransfer('ما حكم صلاة الاستخارة', {
        url: 'https://islamweb.net/ar/fatwa/1004/x', html: labelPage(Q, BODY.repeat(3)),
      }, { judge: async () => 'لا' });
      ok('an unrelated question does not transfer', other.transfer === false, other.reason);
      // A page that is not a Q&A page at all.
      const article = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/article/1/x',
        html: '<html><body><article><p>' + BODY.repeat(3) + '</p></article></body></html>',
      });
      ok('a page with no published question does not transfer', article.transfer === false, article.reason);
      // A page whose "answer" is a stub.
      const stub = await I.considerTransfer(Q, {
        url: 'https://islamweb.net/ar/fatwa/1005/x', html: labelPage(Q, 'قريبا.'),
      });
      ok('a page with a stub answer does not transfer', stub.transfer === false, stub.reason);
      // A host with no extractor.
      const off = await I.considerTransfer(Q, {
        url: 'https://example.org/x', html: labelPage(Q, BODY.repeat(3)),
      });
      ok('a host with no extractor does not transfer', off.transfer === false, off.reason);
      // alukah OUTSIDE its Q&A tree.
      const alukahArticle = await I.considerTransfer(Q, {
        url: 'https://alukah.net/sharia/0/1234/', html: labelPage(Q, BODY.repeat(3)),
      });
      ok('alukah outside /fatawa_counsels/ does not transfer', alukahArticle.transfer === false, alukahArticle.reason);
      const alukahFatwa = await I.considerTransfer(Q, {
        url: 'https://alukah.net/fatawa_counsels/0/1234/', html: labelPage(Q, BODY.repeat(3)),
      });
      ok('...and inside it does', alukahFatwa.transfer === true, alukahFatwa.reason);
    }

    // =========================================================================
    console.log('\n=== I. THE MODEL IS OFF THE TRANSFER PATH ===');
    {
      const src = read('lib/transfer/trim.js') + read('lib/transfer/extract.js') + read('lib/transfer/match.js');
      ok('nothing on the transfer path calls a model', !/anthropic|max_tokens|messages\.create/i.test(src));
      ok('...and nothing fetches', !/globalThis\.fetch/.test(src));
      // The judge must arrive as a PARAMETER. Asserted on where it comes from, not on the absence
      // of the word: index.js legitimately imports buildJudgePrompt and judgeAllowsTransfer from
      // its own matcher, and a substring test on «judge» calls that a violation.
      const idx = read('lib/transfer/index.js');
      ok('the judge is destructured from deps, not imported',
        /const \{ judge = null[^}]*\} = deps;/.test(idx));
      ok('...and nothing on this path imports a vendor client',
        !/from '[^']*anthropic[^']*'/i.test(idx) && !/api\.anthropic\.com/.test(idx + src));
      ok('NOTHING in this gate reached the network', reached === 0, String(reached));
    }

    // =========================================================================
    console.log('\n=== K. DRIVEN: THE TRANSFER ACTUALLY REACHES THE READER ===');
    // Sections A–I prove the decision is correct. This proves it is CALLED, and that a transfer
    // REPLACES the generated answer rather than sitting beside it — which is the only way it
    // saves anything. Measured on the vendor-call count, because "the reply looks published" and
    // "no answer was generated" are different claims and only the second one is the feature.
    {
      const saved = {};
      for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'RFC_V05_MODE', 'LEDGER_RAG'])
        saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-transfer-guard-fake';
      process.env.BRAVE_API_KEY = 'brave-transfer-guard-fake';
      process.env.RFC_V05_MODE = 'off';
      process.env.LEDGER_RAG = 'off';
      process.env.FOUNDER_SECRET = 'transfer-guard-driven-secret';
      const throwingFetch = globalThis.fetch;
      try {
        const DC = await esm('lib/daycap.js');
        const CONSENT = await esm('lib/ai-consent.js');
        const DEVICE = 'transfer-guard-device';
        const FOUNDER = DC.founderTokenFor(DEVICE);
        const PUBLISHED_Q = 'ما حكم العقيقة عن المولود';
        const PAGE = labelPage(PUBLISHED_Q, HAMDALA + ' ' + BODY.repeat(4));

        let vendor = 0;
        const install = () => {
          vendor = 0;
          globalThis.fetch = async (url, opts) => {
            const u = String(url);
            if (u.includes('api.anthropic.com')) {
              vendor++;
              const b = JSON.parse(opts.body);
              return {
                ok: true, status: 200,
                json: async () => (vendor === 1
                  ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_islamic_sources', input: { query: 'حكم العقيقة' } }] }
                  : { content: [{ type: 'text', text: (b.max_tokens === 8 ? 'لا' : 'مسوّدة مولَّدة.') }] }),
                body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '',
              };
            }
            if (u.includes('api.search.brave.com')) {
              return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results: [
                { title: 'العقيقة', url: 'https://islamweb.net/ar/fatwa/1001/x', description: '' },
              ] } }) };
            }
            return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => PAGE, url: u };
          };
        };
        const mkRes = () => {
          const r = { writes: [], statusCode: 0, headers: {} };
          r.status = (c) => { r.statusCode = c; return r; };
          r.setHeader = (k, v) => { r.headers[k] = v; return r; };
          r.getHeader = (k) => r.headers[k];
          r.flushHeaders = () => {}; r.json = () => r;
          r.write = (s) => { r.writes.push(typeof s === 'string' ? s
            : Buffer.from(s.buffer || s, s.byteOffset || 0, s.byteLength || s.length).toString('utf8')); return true; };
          r.end = (s) => { if (s) r.writes.push(String(s)); return r; };
          r.on = () => r; r.once = () => r; r.emit = () => r;
          return r;
        };
        const mkReq = (q) => ({
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
            'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER },
          body: { name: 'خالد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
            messages: [{ role: 'user', content: q }] },
          socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/',
        });
        const readerText = (r) => r.writes.join('').split('\n').filter((l) => l.startsWith('data:'))
          .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
          .filter((f) => f && f.delta && typeof f.delta.text === 'string').map((f) => f.delta.text).join('');

        const handler = (await esm('api/ask.js')).default;

        // ── the reader types the published question verbatim ──────────────
        install();
        const res = mkRes();
        try { await handler(mkReq(PUBLISHED_Q), res); } catch (e) { /* a refusal is not a silence */ }
        const t = readerText(res);
        ok('the reader is given the PUBLISHED text', /العقيقة سنة مؤكدة/.test(t), JSON.stringify(t).slice(0, 200));
        // THE FEATURE IS THE CALL THAT DID NOT HAPPEN. Round 1 decides to search; a transfer
        // means round 2 never runs, so exactly ONE vendor call is the whole saving.
        eq('...and NO answer was generated (round 2 never ran)', vendor, 1);
        ok('...with the ḥamdala stripped', !/الحمد لله/.test(t));
        ok('...carrying its OWN page as the card', /islamweb\.net/.test(t));

        // ── the same question with a flip word ────────────────────────────
        install();
        const res2 = mkRes();
        try { await handler(mkReq('ما حكم العقيقة عن المولود المتوفى'), res2); } catch (e) { /* ditto */ }
        const t2 = readerText(res2);
        ok('a flipped question does NOT get the published text', !/العقيقة سنة مؤكدة/.test(t2));
        ok('...and is generated instead', vendor >= 2, String(vendor));
      } finally {
        globalThis.fetch = throwingFetch;
        for (const k of Object.keys(saved)) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
      }
    }

    // =========================================================================
    console.log('\n=== J. THE ROSTER ===');
    {
      const gates = JSON.parse(read('gates.json'));
      ok('gates.json lists this guard',
        gates.some((g) => g && g.script === 'guards/transfer-mode-guard.cjs'));
      ok('.gitattributes pins it to LF',
        /guards\/transfer-mode-guard\.cjs text eol=lf/.test(read('.gitattributes')));
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
