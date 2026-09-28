// guards/speed-pipes-guard.cjs -- SPEED ITEM 17, THE PIPES ROUND (order EZIK-SPEED-PIPES-ORDER-2026-09-28).
//
// Each case is built from the owner tool's round-6 questions, verbatim (EZIK-SPEED-PREVIEW6-ORDER-2026-09-28),
// and from what the pipes harness measured on them over the local library twin (EZIK-SPEED-PIPES-REPORT-2026-09-28).
// No network and no model: sources, the judge and the writer are fakes handed in through `deps`.
//
//   P1  the issue's words: the interrogative written as one word, the name joiner and the honorific formulas are
//       not query words; the verb and the noun they resemble stay issue words; every library member and the
//       fatwa store are asked the issue itself (questions 1-3 and 22)
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { harness } = require('./output-reviewer-mutant-lib.cjs');

const { ok, finish } = harness('speed-pipes');
const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const ascii = (s) => String(s).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300);

// -- the round-6 questions, verbatim -----------------------------------------------------------
const Q1 = '\u0645\u0627\u0647\u064a \u0635\u0641\u0627\u062a \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0627\u0631\u0628\u0639\u0647';
const Q2 = '\u0645\u0627\u0647\u064a \u0635\u0641\u0627\u062a \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629';
const Q22 = '\u0645\u0627 \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0639\u0646 \u062e\u062f\u0645\u062a\u0647 \u0644\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u061f';
const Q18 = '\u0647\u0644 \u062d\u062f\u064a\u062b: \u0627\u062e\u062a\u0644\u0627\u0641 \u0623\u0645\u062a\u064a \u0631\u062d\u0645\u0629 \u0635\u062d\u064a\u062d\u061f';
const Q_PRAYED = '\u0647\u0644 \u0635\u0644\u0649 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u0636\u062d\u0649\u061f';
const KHAWF = '\u0635\u0644\u0627\u0647 \u0627\u0644\u062e\u0648\u0641';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');

  // ---------------------------------------------------------------- P1 the issue's words
  {
    const t1 = BW2.issueTerms(Q1);
    ok('P1a question 1: the one-word interrogative is not an issue word; the library and the fatwa store are asked the issue',
      !t1.includes('\u0645\u0627\u0647\u064a') && BW2.libraryQuery(Q1) === KHAWF && JSON.stringify(BW2.fatwaQueries(Q1)) === JSON.stringify([KHAWF])
      && BW2.libraryQuery(Q2) === KHAWF, ascii(JSON.stringify(t1)));
    const t22 = BW2.issueTerms(Q22);
    const gone = ['\u0631\u0636\u064a', '\u0639\u0646\u0647', '\u0635\u0644\u064a', '\u0639\u0644\u064a\u0647', '\u0648\u0633\u0644\u0645', '\u0628\u0646'];
    ok('P1b question 22: the honorific formulas and the name joiner are not issue words; the narrator and the issue stay',
      gone.every((w) => !t22.includes(w)) && ['\u0627\u0646\u0633', '\u0645\u0627\u0644\u0643', '\u062e\u062f\u0645\u062a\u0647'].every((w) => t22.includes(w)), ascii(JSON.stringify(t22)));
    const tp = BW2.issueTerms(Q_PRAYED);
    ok('P1c the formula is removed as a phrase: "salla" as the verb asked about stays, and so does "rahma" in question 18',
      tp.includes('\u0635\u0644\u064a') && tp.includes('\u0627\u0644\u0636\u062d\u064a') && BW2.issueTerms(Q18).includes('\u0631\u062d\u0645\u0647'), ascii(JSON.stringify(tp)));

    const seen = [];
    const runTool = async (name, input, ctx) => {
      seen.push({ name, query: input.query, books: Array.isArray(ctx.bookIds) ? ctx.bookIds.join(',') : '' });
      return { text: '', added: [], calls: 1 };
    };
    await BW2.gatherBw2({
      question: Q1, libFlagValue: 'on', libToken: 't', budgetMs: 800,
      deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true },
    });
    const lib = seen.filter((s) => s.name === 'search_library');
    const fat = seen.filter((s) => s.name === 'search_fatawa');
    ok('P1d question 1 end to end: the general, the two comparative and the four madhhab members all ask the issue, and so does the fatwa store',
      lib.length >= 6 && lib.every((s) => s.query === KHAWF) && lib.filter((s) => s.books).length === 5
      && fat.length === 1 && fat[0].query === KHAWF, ascii(JSON.stringify(seen)));
  }
  process.exit(finish());
})().catch((error) => {
  ok('guard completed without exception', false, error && error.stack ? error.stack : String(error));
  process.exit(finish());
});
