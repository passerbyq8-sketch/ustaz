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
// The fatwa store is asked the same words as written (P2): the store does not fold.
const KHAWF_AS_WRITTEN = '\u0635\u0644\u0627\u0629\u0020\u0627\u0644\u062e\u0648\u0641';

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');

  // ---------------------------------------------------------------- P1 the issue's words
  {
    const t1 = BW2.issueTerms(Q1);
    ok('P1a question 1: the one-word interrogative is not an issue word; the library and the fatwa store are asked the issue',
      !t1.includes('\u0645\u0627\u0647\u064a') && BW2.libraryQuery(Q1) === KHAWF && JSON.stringify(BW2.fatwaQueries(Q1)) === JSON.stringify([KHAWF_AS_WRITTEN])
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
      && fat.length === 1 && fat[0].query === KHAWF_AS_WRITTEN, ascii(JSON.stringify(seen)));
  }

  // ---------------------------------------------------------------- P10 (PIPES2 fix 2) round 7, question 5
  {
    const Q7_5 = '\u0645\u0627 \u062d\u0643\u0645 \u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0645\u0634\u0641\u0631\u0629 \u0645\u062b\u0644 \u0627\u0644\u0628\u062a\u0643\u0648\u064a\u0646\u061f';
    const HEAD2 = '\u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a';
    const t5 = BW2.issueTerms(Q7_5);
    ok('P10a "mithl" (such as) is not an issue word: no fatwa query and no library query carries it',
      !t5.includes('\u0645\u062b\u0644') && BW2.fatwaQueries(Q7_5).every((q) => !q.split(' ').includes('\u0645\u062b\u0644')) && !BW2.libraryQuery(Q7_5).split(' ').includes('\u0645\u062b\u0644'),
      ascii(JSON.stringify(BW2.fatwaQueries(Q7_5))));
    const fatwaRun = async (answering) => {
      const asked = [];
      const runTool = async (name, input, ctx) => {
        if (name !== 'search_fatawa') return { text: '', added: [], calls: 0 };
        asked.push(input.query);
        if (answering(input.query)) ctx.table.add({ kind: 'fatwa', title: 'fatwa ' + input.query, url: 'https://binbaz.org.sa/fatwas/' + asked.length, passage: input.query });
        return { text: '', added: [], calls: 1 };
      };
      const g = await BW2.gatherBw2({ question: Q7_5, budgetMs: 800, deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true } });
      return { asked, rows: g.results.fatwa };
    };
    const none = await fatwaRun((q) => q === HEAD2);
    ok('P10b question 5: both fatwa queries return nothing, so the issue\'s first two words are asked once, and their fatwa reaches the judge',
      none.asked.length === 3 && none.asked[2] === HEAD2 && none.rows.length === 1 && BW2.narrowFatwaQuery(Q7_5) === HEAD2, ascii(JSON.stringify(none)));
    const some = await fatwaRun(() => true);
    ok('P10c a fatwa from the first queries: no retry; a two-word issue has no narrower query',
      some.asked.length === 2 && BW2.narrowFatwaQuery('\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641') === '', ascii(JSON.stringify(some.asked)));
  }

  // ---------------------------------------------------------------- P13 (PIPES2 fix 5) round 7, question 6
  {
    let SCH = null;
    try { SCH = await esm('lib/bw2-scholar.js'); } catch { SCH = null; }
    const Q6 = '\u0645\u0627 \u0631\u0623\u064a \u0627\u0644\u0625\u0645\u0627\u0645 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629 \u0641\u064a \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0627\u0639\u0629\u061f';
    const name = (q) => (SCH ? SCH.scholarNameOf(q) : null);
    ok('P13a the scholar named: question 6, round 6\'s question 21 and its siblings name him; "the Hanbalis", "the scholars" and a ruling question name nobody',
      name(Q6) === '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0647' && name('\u0645\u0627 \u0631\u0623\u064a \u0627\u0644\u0625\u0645\u0627\u0645 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0641\u064a \u0637\u0644\u0627\u0642 \u0627\u0644\u062b\u0644\u0627\u062b \u0628\u0644\u0641\u0638 \u0648\u0627\u062d\u062f\u061f') === '\u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0647'
      && name('\u0645\u0627 \u0642\u0648\u0644 \u0634\u064a\u062e \u0627\u0644\u0625\u0633\u0644\u0627\u0645 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0637\u0644\u0627\u0642 \u0627\u0644\u062b\u0644\u0627\u062b \u0641\u064a \u0645\u062c\u0644\u0633 \u0648\u0627\u062d\u062f\u061f') === '\u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0647' && name('\u0645\u0627 \u0631\u0623\u064a \u0627\u0628\u0646 \u0627\u0644\u0642\u064a\u0645 \u0641\u064a \u0627\u0644\u0637\u0644\u0627\u0642 \u0628\u0627\u0644\u062b\u0644\u0627\u062b \u0628\u0643\u0644\u0645\u0629 \u0648\u0627\u062d\u062f\u0629\u061f') === '\u0627\u0628\u0646 \u0627\u0644\u0642\u064a\u0645'
      && name('\u0645\u0627 \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0627\u0639\u0629 \u0639\u0646\u062f \u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629\u061f') === '' && name('\u0645\u0627 \u0631\u0623\u064a \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0641\u064a \u0627\u0644\u062a\u0635\u0648\u064a\u0631\u061f') === '' && name('\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u061f') === '',
      ascii(JSON.stringify([name(Q6)])));
    const CAT = [['FC-B', '\u0643\u062a\u0627\u0628 \u0641\u064a \u0627\u0644\u0631\u062f', '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629', 'turath', 0, 1], ['FC-C', '\u0643\u062a\u0627\u0628 \u062d\u062f\u064a\u062b', '\u0627\u0628\u0646 \u0628\u0627\u0632', 'turath', 0, 0],
      ['FC-003727', '\u0627\u0644\u0645\u063a\u0646\u064a \u0644\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629', '\u0627\u0644\u0645\u0642\u062f\u0633\u064a\u060c \u0645\u0648\u0641\u0642 \u0627\u0644\u062f\u064a\u0646', 'turath', 0, 0], ['FC-003728', '\u0627\u0644\u0645\u0642\u0646\u0639 \u0641\u064a \u0641\u0642\u0647 \u0627\u0644\u0625\u0645\u0627\u0645 \u0623\u062d\u0645\u062f', '\u0645\u0648\u0641\u0642 \u0627\u0644\u062f\u064a\u0646 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629', 'turath', 0, 0]];
    const ids = SCH ? SCH.scholarBookIds('\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0647', CAT) : [];
    ok('P13b his books: by the author field first, then a title that carries him (al-Mughni); another author and a blocked book are not his',
      JSON.stringify(ids) === JSON.stringify(['FC-003728', 'FC-003727']), ascii(JSON.stringify(ids)));
    const libCalls = async (question, found) => {
      const calls = [];
      const runTool = async (tool, input, ctx) => {
        if (tool === 'search_library') {
          calls.push({ query: input.query, books: Array.isArray(ctx.bookIds) ? ctx.bookIds.join(',') : '' });
          if (Array.isArray(ctx.bookIds) && ctx.bookIds.includes('FC-003727')) ctx.table.add({ kind: 'lib_book', title: '\u0627\u0644\u0645\u063a\u0646\u064a', bookTitle: '\u0627\u0644\u0645\u063a\u0646\u064a \u0644\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629', text: '\u0627\u0644\u062c\u0645\u0627\u0639\u0629 \u0648\u0627\u062c\u0628\u0629 \u0644\u0644\u0635\u0644\u0648\u0627\u062a \u0627\u0644\u062e\u0645\u0633' });
        }
        return { text: '', added: [], calls: 1 };
      };
      const g = await BW2.gatherBw2({ question, libFlagValue: 'on', libToken: 't', budgetMs: 800,
        deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, scholarBooksOf: async () => found } });
      return { calls, rows: g.results.library };
    };
    const c = await libCalls(Q6, { name: '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0647', bookIds: ['FC-003727'] });
    ok('P13c question 6: his books are asked the issue without his name ("salat al-jama\'a"), and al-Mughni\'s row reaches the judge',
      c.calls.some((x) => x.books === 'FC-003727' && x.query === '\u0635\u0644\u0627\u0647 \u0627\u0644\u062c\u0645\u0627\u0639\u0647') && c.rows.some((r) => r.bookTitle === '\u0627\u0644\u0645\u063a\u0646\u064a \u0644\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629'),
      ascii(JSON.stringify(c.calls)));
    const d = await libCalls('\u0645\u0627 \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0627\u0639\u0629\u061f', null);
    ok('P13d a question naming nobody asks the same library members as before', d.calls.length === 2 && d.calls.every((x) => x.books !== 'FC-003727'), ascii(JSON.stringify(d.calls)));
    const real = SCH ? await SCH.scholarBooksOf(Q6) : null;
    const tay = SCH ? await SCH.scholarBooksOf('\u0645\u0627 \u0642\u0648\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0641\u064a \u0627\u0644\u0637\u0644\u0627\u0642\u061f') : null;
    ok('P13e the repo\'s catalogue: question 6 reaches al-Mughni; Ibn Taymiyya\'s own Majmu\' al-Fatawa is inside the 100 ids the service takes',
      real && real.bookIds.includes('FC-003727') && tay && tay.bookIds.length <= 100 && tay.bookIds.includes('FC-004491'), ascii(JSON.stringify(real)));
  }

  // ---------------------------------------------------------------- P14 (PIPES2 fix 6) round 7, question 8
  {
    const Q8 = '\u0645\u0627 \u0634\u0631\u0648\u0637 \u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0623\u0631\u0643\u0627\u0646\u0647\u0627 \u0648\u0648\u0627\u062c\u0628\u0627\u062a\u0647\u0627 \u0648\u0633\u0646\u0646\u0647\u0627\u061f';
    const Q28 = '\u0645\u0627 \u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0623\u0636\u062d\u064a\u0629: \u0648\u0642\u062a\u0647\u0627 \u0648\u0634\u0631\u0648\u0637\u0647\u0627 \u0648\u0645\u0627 \u064a\u062c\u0632\u0626 \u0645\u0646\u0647\u0627 \u0648\u062a\u0648\u0632\u064a\u0639 \u0644\u062d\u0645\u0647\u0627\u061f';
    const partsOf = (q) => (typeof BW2.issueParts === 'function' ? BW2.issueParts(q).map((p) => p.surface) : null);
    ok('P14a the parts: question 8 has four, round 6\'s 27 four and 28 two ("its time", "its conditions"); a ruling question, question 7 and question 1 have none',
      JSON.stringify(partsOf(Q8)) === JSON.stringify(['\u0634\u0631\u0648\u0637 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0623\u0631\u0643\u0627\u0646 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0648\u0627\u062c\u0628\u0627\u062a \u0627\u0644\u0635\u0644\u0627\u0629', '\u0633\u0646\u0646 \u0627\u0644\u0635\u0644\u0627\u0629'])
      && JSON.stringify(partsOf('\u0645\u0627 \u0634\u0631\u0648\u0637 \u0627\u0644\u062d\u062c \u0648\u0623\u0631\u0643\u0627\u0646\u0647 \u0648\u0648\u0627\u062c\u0628\u0627\u062a\u0647 \u0648\u0633\u0646\u0646\u0647\u061f')) === JSON.stringify(['\u0634\u0631\u0648\u0637 \u0627\u0644\u062d\u062c', '\u0623\u0631\u0643\u0627\u0646 \u0627\u0644\u062d\u062c', '\u0648\u0627\u062c\u0628\u0627\u062a \u0627\u0644\u062d\u062c', '\u0633\u0646\u0646 \u0627\u0644\u062d\u062c'])
      && JSON.stringify(partsOf(Q28)) === JSON.stringify(['\u0648\u0642\u062a \u0627\u0644\u0623\u0636\u062d\u064a\u0629', '\u0634\u0631\u0648\u0637 \u0627\u0644\u0623\u0636\u062d\u064a\u0629'])
      && [ '\u0645\u0627 \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0627\u0639\u0629\u061f', '\u0645\u0627 \u0627\u0644\u0623\u062f\u0644\u0629 \u0645\u0646 \u0627\u0644\u0642\u0631\u0622\u0646 \u0648\u0627\u0644\u0633\u0646\u0629 \u0639\u0644\u0649 \u0648\u062c\u0648\u0628 \u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645\u061f', '\u0645\u0627\u0647\u064a \u0635\u0641\u0627\u062a \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0627\u0631\u0628\u0639\u0647'].every((q) => JSON.stringify(partsOf(q)) === '[]'),
      ascii(JSON.stringify(partsOf(Q8))));
    const run = async (question, answering) => {
      const lib = [];
      const fat = [];
      const runTool = async (tool, input, ctx) => {
        if (tool === 'search_library') lib.push({ query: input.query, books: Array.isArray(ctx.bookIds) ? ctx.bookIds.join(',') : '' });
        if (tool === 'search_fatawa') {
          fat.push(input.query);
          if (answering(input.query)) ctx.table.add({ kind: 'fatwa', title: 'fatwa ' + input.query, url: 'https://binbaz.org.sa/fatwas/' + fat.length, passage: input.query });
        }
        return { text: '', added: [], calls: 1 };
      };
      const g = await BW2.gatherBw2({ question, libFlagValue: 'on', libToken: 't', budgetMs: 800,
        deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, scholarBooksOf: async () => null } });
      return { lib, fat, rows: g.results.fatwa.map((r) => r.passage) };
    };
    const a = await run(Q8, () => false);
    const parts8 = ['\u0634\u0631\u0648\u0637 \u0627\u0644\u0635\u0644\u0627\u0647', '\u0627\u0631\u0643\u0627\u0646 \u0627\u0644\u0635\u0644\u0627\u0647', '\u0648\u0627\u062c\u0628\u0627\u062a \u0627\u0644\u0635\u0644\u0627\u0647', '\u0633\u0646\u0646 \u0627\u0644\u0635\u0644\u0627\u0647'];
    ok('P14b question 8: each part goes to the comparative books (folded) and to the fatwa store (as written)',
      parts8.every((p) => a.lib.some((c) => c.query === p && c.books === 'FC-003910,FC-003592'))
      && ['\u0634\u0631\u0648\u0637 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0623\u0631\u0643\u0627\u0646 \u0627\u0644\u0635\u0644\u0627\u0629', '\u0648\u0627\u062c\u0628\u0627\u062a \u0627\u0644\u0635\u0644\u0627\u0629', '\u0633\u0646\u0646 \u0627\u0644\u0635\u0644\u0627\u0629'].every((p) => a.fat.includes(p)), ascii(JSON.stringify({ lib: a.lib, fat: a.fat })));
    const b = await run(Q28, (q) => q === '\u0627\u0644\u0623\u0636\u062d\u064a\u0629 \u0648\u0642\u062a\u0647\u0627' || q === '\u0648\u0642\u062a \u0627\u0644\u0623\u0636\u062d\u064a\u0629');
    ok('P14c round 6 question 28: the issue\'s own queries find nothing, so its first two words are still asked although a part answered, and their fatwa comes first',
      b.fat.includes('\u0627\u0644\u0623\u0636\u062d\u064a\u0629 \u0648\u0642\u062a\u0647\u0627') && b.rows[0] === '\u0627\u0644\u0623\u0636\u062d\u064a\u0629 \u0648\u0642\u062a\u0647\u0627' && b.rows.includes('\u0648\u0642\u062a \u0627\u0644\u0623\u0636\u062d\u064a\u0629'), ascii(JSON.stringify(b)));
  }

  // ---------------------------------------------------------------- P15 (PIPES2 fix 7) round 7, question 6: the offer
  {
    const LOOP = await esm('lib/free-brain/loop.js');
    const BODY = '\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0644\u062b: \u0623\u0646\u0647\u0627 \u0633\u0646\u0629 \u0645\u0624\u0643\u062f\u0629. \u0648\u0647\u0648 \u0645\u0630\u0647\u0628 \u0627\u0644\u0645\u0627\u0644\u0643\u064a\u0629.';
    const OFFER = '\u0625\u0646 \u0634\u0626\u062a \u0623\u0646 \u0623\u0641\u0631\u062f \u0628\u062d\u062b\u0627 \u0639\u0646 \u0646\u0635 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629 \u0641\u064a \u00ab\u0627\u0644\u0645\u063a\u0646\u064a\u00bb \u062a\u062d\u062f\u064a\u062f\u0627 \u0628\u0635\u064a\u0627\u063a\u0629 \u0623\u062e\u0631\u0649\u060c \u0641\u0642\u0644 \u0644\u064a \u0648\u0623\u0639\u0627\u0648\u062f \u0627\u0644\u062a\u0646\u0642\u064a\u0628 \u0639\u0646\u0647.';
    const out = LOOP.deliverableText(BODY + '\n' + OFFER);
    ok('P15a question 6\'s closing offer to search al-Mughni again is not delivered; the answer above it is',
      out === BODY, ascii(out));
    ok('P15b an offer that carries a ruling, an offer to explain more, and a plain conditional are delivered',
      !LOOP.isToolAnnouncement('\u0625\u0646 \u0623\u0631\u062f\u062a \u0627\u0644\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0641\u0627\u0644\u0645\u0630\u0647\u0628 \u0623\u0646\u0647 \u064a\u062c\u0648\u0632.') && !LOOP.isToolAnnouncement('\u0625\u0646 \u0634\u0626\u062a \u0641\u0642\u0644 \u0644\u064a \u0648\u0623\u0634\u0631\u062d \u0644\u0643 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0623\u0643\u062b\u0631.')
      && !LOOP.isToolAnnouncement('\u0644\u0648 \u0623\u0631\u062f\u062a \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637 \u0641\u0623\u062e\u0631\u062c \u0627\u0644\u0632\u0643\u0627\u0629.') && LOOP.isToolAnnouncement('\u0625\u0630\u0627 \u0623\u0631\u062f\u062a \u0623\u0646 \u0623\u0628\u062d\u062b \u0644\u0643 \u0639\u0646 \u0642\u0648\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0641\u0642\u0644 \u0644\u064a.'));
  }

  // ---------------------------------------------------------------- P16 (PIPES2 fix 8) round 7, question 6: the orphan \u00ab\u0644\u0643\u0646\u00bb
  {
    const LOOP = await esm('lib/free-brain/loop.js');
    const REST = '\u064a\u0645\u0643\u0646\u0646\u064a \u0623\u0646 \u0623\u0636\u0639 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0628\u064a\u0646 \u064a\u062f\u064a\u0643 \u0643\u0645\u0627 \u062a\u0639\u0631\u0636\u0647\u0627 \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629\u060c \u0648\u0647\u064a \u0645\u0633\u0623\u0644\u0629 \u062e\u0644\u0627\u0641\u064a\u0629 \u0645\u0634\u0647\u0648\u0631\u0629:';
    const out = LOOP.deliverableText('\u0628\u062d\u062b\u062a \u0641\u064a \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0641\u0644\u0645 \u0623\u062c\u062f \u0646\u0635 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629 \u0641\u064a \u0627\u0644\u0645\u063a\u0646\u064a \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u062a\u062d\u062f\u064a\u062f\u0627. \u0644\u0643\u0646 ' + REST);
    ok('P16a the report on the search is dropped and the sentence after it does not open on "lakin"', out === REST, ascii(out));
    const kept = LOOP.deliverableText('\u0627\u0644\u062c\u0648\u0627\u0628 \u0623\u0646\u0647 \u064a\u062c\u0648\u0632. \u0644\u0643\u0646 \u0627\u0644\u0623\u062d\u0648\u0637 \u062a\u0631\u0643\u0647.');
    ok('P16b a "lakin" after a delivered sentence stays', kept === '\u0627\u0644\u062c\u0648\u0627\u0628 \u0623\u0646\u0647 \u064a\u062c\u0648\u0632. \u0644\u0643\u0646 \u0627\u0644\u0623\u062d\u0648\u0637 \u062a\u0631\u0643\u0647.', ascii(kept));
  }

  // ---------------------------------------------------------------- P17 (PIPES2 fix 9) round 7: openings that point back
  {
    const UNITS = await esm('lib/bw2-units.js');
    const K = (t) => UNITS.dependentKind(t);
    ok('P17a the kinds: 10-a "they justified that" and 16 "he preferred the second" have their subject only before them; 16 "he confirmed that" and 7 "qad istadalla bi-hadha" point back; "fa-ajaba:" is speech; "warada hadha al-hadith" and an ordinary opening are nothing',
      K('\u0648\u0639\u0644\u0644\u0648\u0627 \u0630\u0644\u0643 \u0628\u0623\u0646\u0647 \u0639\u0645\u0644 \u0628\u0622\u0644\u0629.') === 'implicit' && K('\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a.') === 'implicit' && K('\u0648\u0642\u0631\u0631 \u0630\u0644\u0643 \u0645\u0646 \u062c\u0647\u062a\u064a\u0646.') === 'backref'
      && K('\u0648\u0642\u062f \u0627\u0633\u062a\u062f\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0646\u0641\u0633\u0647 \u0639\u0644\u0649 \u0648\u062c\u0648\u0628 \u0627\u0644\u0635\u0644\u0629.') === 'backref' && K('\u0641\u0623\u062c\u0627\u0628: \u00ab\u0644\u0627 \u0648\u0627\u0644\u0644\u0647\u00bb.') === 'speech'
      && K('\u0648\u0631\u062f \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0639\u0646\u062f \u0627\u0644\u0625\u0645\u0627\u0645 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647.') === '' && K('\u0648\u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0627\u062c\u0628\u0629 \u0639\u0644\u0649 \u0643\u0644 \u0645\u0633\u0644\u0645.') === '',
      ascii(JSON.stringify(['\u0648\u0639\u0644\u0644\u0648\u0627 \u0630\u0644\u0643', '\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a', '\u0648\u0642\u0631\u0631 \u0630\u0644\u0643', '\u0648\u0642\u062f \u0627\u0633\u062a\u062f\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b', '\u0641\u0623\u062c\u0627\u0628:'].map((t) => K(t + ' x.')))));
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645 \u0648\u0627\u062c\u0628\u0629 \u0644\u0642\u0648\u0644\u0647 \u062a\u0639\u0627\u0644\u0649 \u0648\u0627\u062a\u0642\u0648\u0627 \u0627\u0644\u0644\u0647 \u0627\u0644\u0630\u064a \u062a\u0633\u0627\u0621\u0644\u0648\u0646 \u0628\u0647 \u0648\u0627\u0644\u0623\u0631\u062d\u0627\u0645. \u0648\u0642\u062f \u0627\u0633\u062a\u062f\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0646\u0641\u0633\u0647 \u0639\u0644\u0649 \u0648\u062c\u0648\u0628 \u0627\u0644\u0635\u0644\u0629. \u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a.' },
      { ref: 2, kind: 'encyclopedia', title: 'b', fullText: '\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a. \u0648\u0627\u0644\u062d\u0635\u0631 \u0641\u064a \u0627\u0644\u0622\u064a\u0629 \u0645\u0646 \u0627\u0644\u0637\u0631\u0641\u064a\u0646. \u0648\u0639\u0644\u0644\u0648\u0627 \u0630\u0644\u0643 \u0628\u0623\u0646\u0647 \u0639\u0645\u0644 \u0628\u0622\u0644\u0629. \u0645\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u062f\u0627\u062e\u0644 \u0641\u064a \u0627\u0644\u0622\u064a\u0629\u061f \u0641\u0623\u062c\u0627\u0628: \u0644\u0627 \u0648\u0627\u0644\u0644\u0647\u060c \u0644\u0627 \u064a\u062f\u062e\u0644 \u0641\u064a\u0647 \u0625\u0644\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u0634\u0631\u0639\u064a.' }];
    const rel = async (writer, askedMatn = '') => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; }, askedMatn });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const a = await rel('\u0648\u0639\u0644\u0644\u0648\u0627 \u0630\u0644\u0643 \u0628\u0623\u0646\u0647 \u0639\u0645\u0644 \u0628\u0622\u0644\u0629 [[2]].\n\u0648\u0627\u0644\u062d\u0635\u0631 \u0641\u064a \u0627\u0644\u0622\u064a\u0629 \u0645\u0646 \u0627\u0644\u0637\u0631\u0641\u064a\u0646 [[2]].');
    ok('P17b 10-a: the first unit does not open on "they justified that"; the unit after it goes out', !a.text.includes('\u0648\u0639\u0644\u0644\u0648\u0627') && a.text.includes('\u0627\u0644\u062d\u0635\u0631'), ascii(a.text));
    const b = await rel('\u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645 \u0648\u0627\u062c\u0628\u0629 \u0644\u0642\u0648\u0644\u0647 \u062a\u0639\u0627\u0644\u0649: \u0648\u0627\u062a\u0642\u0648\u0627 \u0627\u0644\u0644\u0647 \u0627\u0644\u0630\u064a \u062a\u0633\u0627\u0621\u0644\u0648\u0646 \u0628\u0647 \u0648\u0627\u0644\u0623\u0631\u062d\u0627\u0645 [[1]].\n\u0648\u0642\u062f \u0627\u0633\u062a\u062f\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0646\u0641\u0633\u0647 \u0639\u0644\u0649 \u0648\u062c\u0648\u0628 \u0627\u0644\u0635\u0644\u0629 [[1]].');
    ok('P17c 7: "this very hadith" with no hadith out and none named by the question is held', b.text.includes('\u0648\u0627\u062c\u0628\u0629') && !b.text.includes('\u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b'), ascii(b.text));
    const c = await rel('\u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645 \u0648\u0627\u062c\u0628\u0629 \u0644\u0642\u0648\u0644\u0647 \u062a\u0639\u0627\u0644\u0649: \u0648\u0627\u062a\u0642\u0648\u0627 \u0627\u0644\u0644\u0647 \u0627\u0644\u0630\u064a \u062a\u0633\u0627\u0621\u0644\u0648\u0646 \u0628\u0647 \u0648\u0627\u0644\u0623\u0631\u062d\u0627\u0645 [[1]].\n\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a [[2]].');
    const c1 = await rel('\u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645 \u0648\u0627\u062c\u0628\u0629 \u0644\u0642\u0648\u0644\u0647 \u062a\u0639\u0627\u0644\u0649: \u0648\u0627\u062a\u0642\u0648\u0627 \u0627\u0644\u0644\u0647 \u0627\u0644\u0630\u064a \u062a\u0633\u0627\u0621\u0644\u0648\u0646 \u0628\u0647 \u0648\u0627\u0644\u0623\u0631\u062d\u0627\u0645 [[1]].\n\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a [[1]].');
    ok('P17d 16: "he preferred the second" citing another book than the unit before is held; citing the same book it goes out',
      c1.text.includes('\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a') && (c.text.match(/\u0648\u0631\u062c\u062d \u0627\u0644\u062b\u0627\u0646\u064a/gu) || []).length === 0 && c.s.holds.dependent_opening === 1, ascii(JSON.stringify({ t: c.text, h: c.s.holds })));
    const d = await rel('\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0631\u062c\u0628: \u0627\u0644\u062d\u0635\u0631 \u0645\u0646 \u0627\u0644\u0637\u0631\u0641\u064a\u0646 [[2]].\n\u0645\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u062f\u0627\u062e\u0644 \u0641\u064a \u0627\u0644\u0622\u064a\u0629\u061f\n\u0641\u0623\u062c\u0627\u0628: \u00ab\u0644\u0627 \u0648\u0627\u0644\u0644\u0647\u060c \u0644\u0627 \u064a\u062f\u062e\u0644 \u0641\u064a\u0647 \u0625\u0644\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u0634\u0631\u0639\u064a\u00bb [[2]].');
    const e = await rel('\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0631\u062c\u0628: \u0627\u0644\u062d\u0635\u0631 \u0645\u0646 \u0627\u0644\u0637\u0631\u0641\u064a\u0646 [[2]].\n\u0633\u0626\u0644 \u0627\u0628\u0646 \u0631\u062c\u0628: \u0645\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u062f\u0627\u062e\u0644 \u0641\u064a \u0627\u0644\u0622\u064a\u0629\u061f\n\u0641\u0623\u062c\u0627\u0628: \u00ab\u0644\u0627 \u0648\u0627\u0644\u0644\u0647\u060c \u0644\u0627 \u064a\u062f\u062e\u0644 \u0641\u064a\u0647 \u0625\u0644\u0627 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u0634\u0631\u0639\u064a\u00bb [[2]].');
    ok('P17e 16: "fa-ajaba:" after a question that names nobody is held; after a question put to a named scholar it goes out',
      !d.text.includes('\u0641\u0623\u062c\u0627\u0628') && e.text.includes('\u0641\u0623\u062c\u0627\u0628'), ascii(JSON.stringify([d.text, e.text])));
  }

  // ---------------------------------------------------------------- P18 (PIPES2 fix 10) round 7, 11-a: "fa-" at the head
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0627\u0644\u062d\u0643\u0645 \u0623\u0646\u0647 \u0644\u0627 \u064a\u062c\u0648\u0632 \u062a\u062e\u0635\u064a\u0635 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0628\u0627\u0644\u0635\u0648\u0645 \u062a\u0637\u0648\u0639\u0627 \u0648\u062d\u062f\u0647. \u0641\u0625\u0646 \u0635\u0627\u0645 \u064a\u0648\u0645\u0627 \u0642\u0628\u0644\u0647 \u0641\u0644\u0627 \u062d\u0631\u062c. \u0641\u0631\u0636 \u0627\u0644\u0635\u0648\u0645 \u062b\u0627\u0628\u062a.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      await r.end();
      return out.join('');
    };
    const a = await rel('\u0641\u0627\u0644\u062d\u0643\u0645 \u0623\u0646\u0647 \u0644\u0627 \u064a\u062c\u0648\u0632 \u062a\u062e\u0635\u064a\u0635 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0628\u0627\u0644\u0635\u0648\u0645 \u062a\u0637\u0648\u0639\u0627 \u0648\u062d\u062f\u0647 [[1]].\n\u0641\u0625\u0646 \u0635\u0627\u0645 \u064a\u0648\u0645\u0627 \u0642\u0628\u0644\u0647 \u0641\u0644\u0627 \u062d\u0631\u062c [[1]].');
    ok('P18a 11-a: the answer opens on "al-hukmu annahu", not "fa-l-hukmu"; a "fa-inna" later in the answer stays',
      a.startsWith('\u0627\u0644\u062d\u0643\u0645 \u0623\u0646\u0647 \u0644\u0627 \u064a\u062c\u0648\u0632') && a.includes('\n\u0641\u0625\u0646 \u0635\u0627\u0645'), ascii(a));
    const b = await rel('\u0641\u0631\u0636 \u0627\u0644\u0635\u0648\u0645 \u062b\u0627\u0628\u062a [[1]].');
    ok('P18b a word whose own first letter is fa ("fard") is not touched', b.startsWith('\u0641\u0631\u0636 \u0627\u0644\u0635\u0648\u0645'), ascii(b));
  }

  // ---------------------------------------------------------------- P19 (PIPES2 fix 11) round 7, 1 and 8: ordinals in sequence
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u062b\u0627\u0628\u062a\u0629 \u0628\u0627\u0644\u0633\u0646\u0629. \u0648\u0647\u064a \u0631\u0643\u0639\u062a\u0627\u0646 \u0641\u064a \u0627\u0644\u0633\u0641\u0631. \u0648\u062a\u0635\u0644\u0649 \u0639\u0644\u0649 \u0635\u0641\u0627\u062a. \u0648\u0627\u0644\u062c\u0645\u0627\u0639\u0629 \u0641\u064a\u0647\u0627 \u0645\u0634\u0631\u0648\u0639\u0629.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      await r.end();
      return out.join('');
    };
    const heads = (t) => t.split('\n').filter((l) => /^(?:\u0623\u0648\u0644\u0627|\u062b\u0627\u0646\u064a\u0627|\u062b\u0627\u0644\u062b\u0627|\u0631\u0627\u0628\u0639\u0627|\u062e\u0627\u0645\u0633\u0627|\u0633\u0627\u062f\u0633\u0627)/u.test(l)).map((l) => l.split(':')[0]);
    const q1 = await rel('\u062b\u0627\u0646\u064a\u0627: \u062a\u0639\u062f\u062f \u0627\u0644\u0635\u0641\u0627\u062a\n\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u062b\u0627\u0628\u062a\u0629 \u0628\u0627\u0644\u0633\u0646\u0629 [[1]].\n\u062b\u0627\u0644\u062b\u0627: \u0645\u0627 \u0644\u0645 \u064a\u0623\u062a\n\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0625\u0646\u0647\u0627 \u0648\u0627\u062c\u0628\u0629.\n\u0631\u0627\u0628\u0639\u0627: \u0635\u0641\u0629 \u0630\u0627\u062a \u0627\u0644\u0631\u0642\u0627\u0639\n\u0648\u0647\u064a \u0631\u0643\u0639\u062a\u0627\u0646 \u0641\u064a \u0627\u0644\u0633\u0641\u0631 [[1]].\n\u0633\u0627\u062f\u0633\u0627: \u0645\u0633\u0627\u0626\u0644 \u0645\u0644\u062d\u0642\u0629\n\u0648\u062a\u0635\u0644\u0649 \u0639\u0644\u0649 \u0635\u0641\u0627\u062a [[1]].');
    ok('P19a question 1\'s shape: "second, fourth, sixth" go out as "first, second, third"; the empty "third" does not',
      JSON.stringify(heads(q1)) === JSON.stringify(['\u0623\u0648\u0644\u0627', '\u062b\u0627\u0646\u064a\u0627', '\u062b\u0627\u0644\u062b\u0627']) && q1.includes('\u062b\u0627\u0644\u062b\u0627: \u0645\u0633\u0627\u0626\u0644 \u0645\u0644\u062d\u0642\u0629'), ascii(JSON.stringify(heads(q1))));
    const q8 = await rel('\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u062b\u0627\u0628\u062a\u0629 \u0628\u0627\u0644\u0633\u0646\u0629\u060c \u0648\u062a\u0641\u0635\u064a\u0644 \u0630\u0644\u0643 [[1]]:\n\u0623\u0648\u0644\u0627: \u0627\u0644\u0641\u0631\u0642 \u0628\u064a\u0646 \u0627\u0644\u0631\u0643\u0646 \u0648\u0627\u0644\u0634\u0631\u0637\n\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u062b\u0627\u0628\u062a\u0629 \u0628\u0627\u0644\u0633\u0646\u0629 [[1]].\n\u062b\u0627\u0646\u064a\u0627: \u0627\u0644\u0623\u0642\u0648\u0627\u0644\n\u0648\u0647\u064a \u0631\u0643\u0639\u062a\u0627\u0646 \u0641\u064a \u0627\u0644\u0633\u0641\u0631 [[1]].\n\u0631\u0627\u0628\u0639\u0627: \u0645\u0646 \u0627\u0644\u0633\u0646\u0646\n\u0648\u0627\u0644\u062c\u0645\u0627\u0639\u0629 \u0641\u064a\u0647\u0627 \u0645\u0634\u0631\u0648\u0639\u0629 [[1]].');
    ok('P19b question 8\'s shape: the first heading inside a lead-in counts, and "fourth" after "second" goes out as "third"',
      JSON.stringify(heads(q8)) === JSON.stringify(['\u0623\u0648\u0644\u0627', '\u062b\u0627\u0646\u064a\u0627', '\u062b\u0627\u0644\u062b\u0627']), ascii(JSON.stringify(heads(q8))));
  }

  // ---------------------------------------------------------------- P20 (PIPES2 fix 12) round 7, 2 and 8: a plain title with nothing under it
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0635\u0644\u0627\u0629 \u0627\u0644\u0627\u0633\u062a\u0633\u0642\u0627\u0621 \u0631\u0643\u0639\u062a\u0627\u0646. \u0648\u0627\u0644\u062e\u0637\u0628\u0629 \u0641\u064a\u0647\u0627 \u0642\u0628\u0644 \u0627\u0644\u0635\u0644\u0627\u0629 \u0623\u0648 \u0628\u0639\u062f\u0647\u0627.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const a = await rel('\u0635\u0644\u0627\u0629 \u0627\u0644\u0627\u0633\u062a\u0633\u0642\u0627\u0621 \u0631\u0643\u0639\u062a\u0627\u0646 [[1]].\n\u0641\u064a \u0645\u0648\u0636\u0639 \u0627\u0644\u062e\u0637\u0628\u0629\n\u0648\u0627\u0644\u062e\u0637\u0628\u0629 \u0641\u064a\u0647\u0627 \u0642\u0628\u0644 \u0627\u0644\u0635\u0644\u0627\u0629 \u0623\u0648 \u0628\u0639\u062f\u0647\u0627 [[1]].\n\u062a\u0646\u0628\u064a\u0647 \u0639\u0644\u0649 \u062d\u062f\u0648\u062f \u0627\u0644\u0646\u0635\u0648\u0635');
    ok('P20a question 2: a title with a unit under it goes out with it; "tanbih \'ala hudud al-nusus" with nothing under it does not',
      a.text.includes('\u0641\u064a \u0645\u0648\u0636\u0639 \u0627\u0644\u062e\u0637\u0628\u0629\n\u0648\u0627\u0644\u062e\u0637\u0628\u0629') && !a.text.includes('\u062a\u0646\u0628\u064a\u0647') && a.s.holds.empty_heading === 1, ascii(JSON.stringify({ t: a.text, h: a.s.holds })));
    const b = await rel('\u0635\u0644\u0627\u0629 \u0627\u0644\u0627\u0633\u062a\u0633\u0642\u0627\u0621 \u0631\u0643\u0639\u062a\u0627\u0646 [[1]].\n\u0645\u0627 \u0644\u0645 \u0623\u0642\u0641 \u0639\u0644\u064a\u0647\n\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0643\u0630\u0627.');
    ok('P20b question 8: "ma lam aqif \'alayh" whose only unit is held does not go out', !b.text.includes('\u0623\u0642\u0641'), ascii(b.text));
    ok('P20c the title test: a ruling without its full stop, a list item, a "wa" line and a cited line are not titles',
      UNITS.isPlainTitleUnit('\u062a\u0646\u0628\u064a\u0647 \u0639\u0644\u0649 \u062d\u062f\u0648\u062f \u0627\u0644\u0646\u0635\u0648\u0635') && !UNITS.isPlainTitleUnit('\u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646 \u0641\u0631\u0636 \u0639\u064a\u0646') && !UNITS.isPlainTitleUnit('- \u0627\u0644\u0637\u0647\u0627\u0631\u0629')
      && !UNITS.isPlainTitleUnit('\u0648\u0627\u0644\u0644\u0647 \u0623\u0639\u0644\u0645') && !UNITS.isPlainTitleUnit('\u0635\u0644\u0627\u0629 \u0627\u0644\u0627\u0633\u062a\u0633\u0642\u0627\u0621 \u0631\u0643\u0639\u062a\u0627\u0646 [[1]]'));
  }

  // ---------------------------------------------------------------- P21 (PIPES2 fix 13) round 7, 7: one card per work
  {
    const UNITS = await esm('lib/bw2-units.js');
    const ASKM = await esm('api/ask.js');
    const TEXT = '\u0630\u0643\u0631 \u062d\u062b \u0627\u0644\u0645\u0635\u0637\u0641\u0649 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0641\u064a \u0645\u0631\u0636\u0647 \u0627\u0644\u0630\u064a \u0642\u0628\u0636 \u0641\u064a\u0647 \u0623\u0645\u062a\u0647 \u0639\u0644\u0649 \u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645.';
    const ed = (id, suffix) => ({ ref: id, kind: 'lib_book', title: '\u0635\u062d\u064a\u062d \u0627\u0628\u0646 \u062d\u0628\u0627\u0646 - ' + suffix, bookTitle: '\u0635\u062d\u064a\u062d \u0627\u0628\u0646 \u062d\u0628\u0627\u0646 - ' + suffix,
      author: '\u0627\u0628\u0646 \u062d\u0628\u0627\u0646', locator: '\u062c2 \u00b7 \u0635179', recordId: 'lib:FC-00070' + (id + 2) + ':0424:001', fullText: TEXT, text: TEXT });
    const rows = [ed(1, '\u0645\u062d\u0642\u0642\u0627'), ed(2, '\u0645\u062e\u0631\u062c\u0627')];
    const out = [];
    const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; },
      cards: { buildSourceTag: ASKM.buildSourceTag, buildBookTag: ASKM.buildBookTag, encyclopediaCards: false, max: 3 } });
    r.push('\u0648\u0642\u062f \u0628\u0648\u0628 \u0639\u0644\u064a\u0647 \u0627\u0628\u0646 \u062d\u0628\u0627\u0646 \u0628\u0642\u0648\u0644\u0647: \u0630\u0643\u0631 \u062d\u062b \u0627\u0644\u0645\u0635\u0637\u0641\u0649 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0641\u064a \u0645\u0631\u0636\u0647 \u0627\u0644\u0630\u064a \u0642\u0628\u0636 \u0641\u064a\u0647 \u0623\u0645\u062a\u0647 \u0639\u0644\u0649 \u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645 [[1]][[2]].\n');
    const s = await r.end();
    ok('P21a question 7: the two editions of Sahih Ibn Hibban at the same page give one card, not two',
      s.cardsSent === 1 && (out.join('').match(/<book /g) || []).length === 1 && UNITS.workOf('\u0635\u062d\u064a\u062d \u0627\u0628\u0646 \u062d\u0628\u0627\u0646 - \u0645\u062e\u0631\u062c\u0627') === '\u0635\u062d\u064a\u062d \u0627\u0628\u0646 \u062d\u0628\u0627\u0646',
      ascii(JSON.stringify({ cards: s.cardsSent, released: s.released })));
  }

  // ---------------------------------------------------------------- P22 (PIPES2 fix 14) round 7, 7: "wa-ma."
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0645\u0646 \u0633\u0631\u0647 \u0623\u0646 \u064a\u0628\u0633\u0637 \u0644\u0647 \u0631\u0632\u0642\u0647 \u0641\u0644\u064a\u0635\u0644 \u0631\u062d\u0645\u0647. \u0644\u0627 \u062a\u0646\u0643\u062d \u0627\u0644\u0645\u0631\u0623\u0629 \u0639\u0644\u0649 \u0639\u0645\u062a\u0647\u0627 \u0648\u0644\u0627 \u0639\u0644\u0649 \u062e\u0627\u0644\u062a\u0647\u0627.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const a = await rel('\u0648\u0645\u0646 \u0627\u0644\u0633\u0646\u0629 \u0642\u0648\u0644\u0647: \u0645\u0646 \u0633\u0631\u0647 \u0623\u0646 \u064a\u0628\u0633\u0637 \u0644\u0647 \u0631\u0632\u0642\u0647 \u0641\u0644\u064a\u0635\u0644 \u0631\u062d\u0645\u0647 [[1]].\n\u0648\u0645\u0627 <source url="https://binbaz.org.sa/fatwas/1">\u0635\u0644\u0629 \u0627\u0644\u0631\u062d\u0645</source> [[1]].\n\u0648\u0642\u0648\u0644\u0647: \u0644\u0627 \u062a\u0646\u0643\u062d \u0627\u0644\u0645\u0631\u0623\u0629 \u0639\u0644\u0649 \u0639\u0645\u062a\u0647\u0627 [[1]].');
    const b = await rel('\u0648\u0645\u0646 \u0627\u0644\u0633\u0646\u0629 \u0642\u0648\u0644\u0647: \u0645\u0646 \u0633\u0631\u0647 \u0623\u0646 \u064a\u0628\u0633\u0637 \u0644\u0647 \u0631\u0632\u0642\u0647 \u0641\u0644\u064a\u0635\u0644 \u0631\u062d\u0645\u0647 [[1]].\n\u0648\u0645\u0627 [[1]].\n\u0648\u0642\u0648\u0644\u0647: \u0644\u0627 \u062a\u0646\u0643\u062d \u0627\u0644\u0645\u0631\u0623\u0629 \u0639\u0644\u0649 \u0639\u0645\u062a\u0647\u0627 [[1]].');
    ok('P22a question 7: a unit left with "wa-ma" alone (its card markup or its bare citation removed) is not sent; the saying after it is',
      !/(?:^|\n)\u0648\u0645\u0627 ?\./u.test(a.text) && !/(?:^|\n)\u0648\u0645\u0627 ?\./u.test(b.text) && a.text.includes('\u0644\u0627 \u062a\u0646\u0643\u062d') && b.text.includes('\u0644\u0627 \u062a\u0646\u0643\u062d')
      && a.s.holds.empty === 1, ascii(JSON.stringify([a.text, b.text])));
    ok('P22b the test: function words only; a short unit with a word of its own is not empty',
      UNITS.onlyFunctionWords('\u0648\u0645\u0627.') && UNITS.onlyFunctionWords('\u0648\u0647\u0630\u0627 [[2]].') && !UNITS.onlyFunctionWords('\u0648\u0645\u0627 \u0635\u062d \u0639\u0646\u0647.') && !UNITS.onlyFunctionWords('\u064a\u062c\u0648\u0632.'));
  }

  // ---------------------------------------------------------------- P23 (PIPES2 fix 15) round 7, 2 (first try): the judge's budget
  {
    ok('P23a the judge waits 4500 ms by default (2 of 78 judged turns were cut at 3000); BW2_JUDGE_MS still overrides it',
      BW2.judgeBudgetMs({}) === 4500 && BW2.BW2_JUDGE_MS_DEFAULT === 4500 && BW2.judgeBudgetMs({ BW2_JUDGE_MS: '3000' }) === 3000,
      String(BW2.judgeBudgetMs({})));
    let asked = 0;
    const slow = await BW2.judgeBw2({ question: 'x', rows: [{ kind: 'fatwa', title: 't', passage: 'p' }], budgetMs: 200,
      ask: () => { asked += 1; return new Promise((resolve) => setTimeout(() => resolve('{"d":{"1":1}}'), 50)); } });
    ok('P23b a judge that answers inside the budget is kept whole (the budget cuts only a slower one)', asked === 1 && slow.outcome === 'complete' && slow.kept.length === 1,
      JSON.stringify(slow));
  }

  // ---------------------------------------------------------------- P24 (PIPES3, A) round 8: openings that need what came before
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0634\u0631\u0639. \u0648\u0627\u0644\u0637\u0647\u0627\u0631\u0629 \u0645\u0646 \u0627\u0644\u062d\u062f\u062b \u0634\u0631\u0637 \u0644\u0635\u062d\u0629 \u0627\u0644\u0635\u0644\u0627\u0629. \u0648\u0642\u062f \u0636\u0639\u0641 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const NEXT = '\u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0634\u0631\u0639 [[1]].';
    const HEADS = [
      ['3', '\u0642\u0627\u0644 \u0628\u0647 \u0627\u0628\u0646 \u0628\u0627\u0632\u060c \u0648\u0635\u0631\u062d \u0628\u0623\u0646\u0647 \u0636\u0639\u064a\u0641 [[1]].', 'backref'],
      ['16', '\u0648\u0630\u0643\u0631 \u0623\u0646 \u0627\u0644\u0641\u0642\u0647\u0627\u0621 \u0625\u0630\u0627 \u062c\u0648\u0632\u0648\u0627 \u0628\u064a\u0639 \u0627\u0644\u062a\u0645\u0631 \u0627\u0644\u0631\u062f\u064a\u0621 \u0644\u064a\u0634\u062a\u0631\u064a \u0628\u0647 \u062c\u064a\u062f\u0627 \u0641\u0643\u0630\u0644\u0643 \u064a\u062c\u0648\u0632 [[1]].', 'backref'],
      ['18', '\u0648\u0642\u0627\u0644 \u0641\u064a \u0645\u0648\u0636\u0639 \u0622\u062e\u0631: \u00ab\u0627\u0644\u0648\u0627\u062c\u0628 \u0625\u062e\u0631\u0627\u062c\u0647\u0627 \u0637\u0639\u0627\u0645\u0627\u00bb [[1]].', 'speech'],
      ['20', '\u0648\u064a\u0648\u0636\u062d\u0647 \u062d\u062f\u064a\u062b \u0628\u0631\u064a\u062f\u0629 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 [[1]].', 'backref'],
    ];
    const got = [];
    for (const [q, unit, kind] of HEADS) {
      const a = await rel(unit + '\n' + NEXT);
      got.push({ q, kind: UNITS.dependentKind(unit), head: a.text.slice(0, 20), held: a.s.holds.dependent_opening || 0 });
    }
    ok('P24a round 8, 3, 16, 18 and 20: an answer does not open on "qala bihi", "wa-dhakara anna", "wa-qala fi mawdi\' akhar:" or "wa-yuwaddihuhu"; the unit after it does',
      got.every((g, i) => g.kind === HEADS[i][2] && g.held === 1 && g.head.startsWith('\u0627\u0644\u0646\u0638\u0627\u0641\u0629')), ascii(JSON.stringify(got)));
    const HELD_BEFORE = '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u062d\u0632\u0645: \u00ab\u0627\u0644\u0635\u0644\u0627\u0629 \u0628\u0627\u0637\u0644\u0629\u00bb [[1]].';
    const b1 = await rel(NEXT + '\n' + HELD_BEFORE + '\n\u0641\u0627\u0644\u0641\u0631\u0642 \u0623\u0646 \u0627\u0644\u0637\u0647\u0627\u0631\u0629 \u0645\u0646 \u0627\u0644\u062d\u062f\u062b \u0634\u0631\u0637 \u0644\u0635\u062d\u0629 \u0627\u0644\u0635\u0644\u0627\u0629 [[1]].');
    const b2 = await rel(NEXT + '\n\u0648\u0627\u0644\u0637\u0647\u0627\u0631\u0629 \u0645\u0646 \u0627\u0644\u062d\u062f\u062b \u0634\u0631\u0637 \u0644\u0635\u062d\u0629 \u0627\u0644\u0635\u0644\u0627\u0629 [[1]].\n\u0641\u0627\u0644\u0641\u0631\u0642 \u0623\u0646 \u0627\u0644\u0637\u0647\u0627\u0631\u0629 \u0645\u0646 \u0627\u0644\u062d\u062f\u062b \u0634\u0631\u0637 \u0644\u0635\u062d\u0629 \u0627\u0644\u0635\u0644\u0627\u0629 [[1]].');
    const b3 = await rel('\u0641\u0627\u0644\u062d\u0643\u0645 \u0623\u0646 \u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0634\u0631\u0639 [[1]].');
    ok('P24b round 8, 22: "fa-l-farqu" after a held unit is held; after a unit that went out it goes out; at the head PIPES2 fix 10 still takes the fa off',
      UNITS.dependentKind('\u0641\u0627\u0644\u0641\u0631\u0642 \u0623\u0646 \u0627\u0644\u0637\u0647\u0627\u0631\u0629') === 'fa_noun' && !b1.text.includes('\u0641\u0627\u0644\u0641\u0631\u0642') && b1.s.holds.dependent_on_held >= 1
      && b2.text.includes('\n\u0641\u0627\u0644\u0641\u0631\u0642 \u0623\u0646 \u0627\u0644\u0637\u0647\u0627\u0631\u0629') && b3.text.startsWith('\u0627\u0644\u062d\u0643\u0645 \u0623\u0646 \u0627\u0644\u0646\u0638\u0627\u0641\u0629'), ascii(JSON.stringify([b1.text, b2.text, b3.text])));
    const NEAR = ['\u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0641\u064a\u0647\u0627 \u0642\u0648\u0644 \u0645\u0633\u062a\u0642\u0631 \u0639\u0646\u062f \u0627\u0644\u062c\u0645\u0647\u0648\u0631', '\u0627\u0644\u0630\u064a \u0639\u0644\u064a\u0647 \u0623\u0643\u062b\u0631 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0623\u0646\u0647\u0627 \u062a\u0628\u062f\u0623', '\u0645\u0633\u0623\u0644\u062a\u0627\u0646 \u0641\u064a\u0647\u0645\u0627 \u062e\u0644\u0627\u0641 \u062f\u0627\u062e\u0644 \u0627\u0644\u0645\u0630\u0647\u0628:', '\u0644\u064a\u0633 \u0641\u064a\u0647\u0627 \u0625\u062c\u0645\u0627\u0639',
      '\u0648\u064a\u0646\u0628\u063a\u064a \u0623\u0646 \u064a\u0639\u0644\u0645 \u0623\u0646 \u0647\u0630\u0627 \u0627\u0644\u0639\u0641\u0648 \u0645\u0642\u064a\u062f', '\u0648\u0623\u0645\u0627 \u0625\u0646 \u0627\u062d\u062a\u0645\u0644 \u0623\u0646 \u0627\u0644\u0646\u062c\u0627\u0633\u0629 \u0648\u0642\u0639\u062a', '\u0642\u0627\u0644 \u0639\u0644\u064a\u0647 \u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0627\u0644\u0633\u0644\u0627\u0645: \u00ab\u0644\u0627 \u0635\u0644\u0627\u0629\u00bb', '\u0648\u0642\u064a\u0644 \u0625\u0646 \u0627\u0644\u0645\u0631\u0627\u062f \u0628\u0647 \u0627\u0644\u0635\u0644\u0627\u0629',
      '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0641\u064a \u0645\u0648\u0636\u0639 \u0622\u062e\u0631: \u00ab\u0643\u0630\u0627\u00bb', '\u0648\u062a\u0646\u0628\u064a\u0647 \u0639\u0644\u0649 \u0630\u0644\u0643 \u0645\u0647\u0645', '\u0648\u0627\u0644\u0635\u062d\u064a\u062d \u0623\u0646 \u0627\u0644\u0635\u0644\u0627\u0629 \u0635\u062d\u064a\u062d\u0629'];
    ok('P24c the edge of the rule, measured over rounds 2-8: the five openings point back, and the near misses do not: an article noun, a relative, "laysa", a dual, an impersonal verb, a particle, the Prophet\'s formula, a named speaker',
      HEADS.every(([, unit, kind]) => UNITS.dependentKind(unit) === kind) && NEAR.every((t) => UNITS.dependentKind(t) === ''), ascii(JSON.stringify(NEAR.map((t) => UNITS.dependentKind(t)))));
  }

  // ---------------------------------------------------------------- P25 (PIPES3, B) round 8, 3 and 18: "al-qawl al-thani" with no first
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0625\u062e\u0631\u0627\u062c \u0627\u0644\u0642\u064a\u0645\u0629 \u0641\u064a \u0632\u0643\u0627\u0629 \u0627\u0644\u0641\u0637\u0631 \u064a\u062c\u0648\u0632 \u0639\u0646\u062f \u0627\u0644\u062d\u0646\u0641\u064a\u0629. \u0648\u0627\u0644\u0648\u0627\u062c\u0628 \u0625\u062e\u0631\u0627\u062c\u0647\u0627 \u0637\u0639\u0627\u0645\u0627 \u0639\u0646\u062f \u0627\u0644\u062c\u0645\u0647\u0648\u0631.' }];
    const rel = async (writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const a = await rel('\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644: \u0642\u0627\u0644 \u0627\u0628\u0646 \u062d\u0632\u0645: \u00ab\u0644\u0627 \u064a\u062c\u0632\u0626 \u0625\u0644\u0627 \u0627\u0644\u0637\u0639\u0627\u0645\u00bb.\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0646\u064a: \u064a\u062c\u0648\u0632 \u0625\u062e\u0631\u0627\u062c \u0627\u0644\u0642\u064a\u0645\u0629 \u0639\u0646\u062f \u0627\u0644\u062d\u0646\u0641\u064a\u0629 [[1]].\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0644\u062b: \u0627\u0644\u0648\u0627\u062c\u0628 \u0625\u062e\u0631\u0627\u062c\u0647\u0627 \u0637\u0639\u0627\u0645\u0627 \u0639\u0646\u062f \u0627\u0644\u062c\u0645\u0647\u0648\u0631 [[1]].');
    ok('P25a questions 3 and 18: the first view held, the second goes out as "al-qawl al-awwal:" and the third as "al-qawl al-thani:"',
      a.text.startsWith('\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644: \u064a\u062c\u0648\u0632 \u0625\u062e\u0631\u0627\u062c \u0627\u0644\u0642\u064a\u0645\u0629') && a.text.includes('\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0646\u064a: \u0627\u0644\u0648\u0627\u062c\u0628 \u0625\u062e\u0631\u0627\u062c\u0647\u0627') && a.s.holds.unsupported_attribution === 1, ascii(a.text));
    const c = {};
    const seq = ['\u0627\u0644\u0623\u0648\u0644 \u2014 \u062d\u062f\u064a\u062b \u0627\u0644\u063a\u0631 \u0627\u0644\u0645\u062d\u062c\u0644\u064a\u0646', '\u0627\u0644\u062b\u0627\u0644\u062b \u2014 \u0625\u062d\u0633\u0627\u0646 \u0627\u0644\u0648\u0636\u0648\u0621', '\u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u062b\u0627\u0646\u064a\u0629: \u0627\u0644\u063a\u0636\u0628 \u0627\u0644\u0634\u062f\u064a\u062f', '\u0648\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644 \u0623\u0631\u062c\u062d', '\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644 \u0623\u0631\u062c\u062d \u0639\u0646\u062f\u064a'].map((t) => (UNITS.renumberKindOrdinal ? UNITS.renumberKindOrdinal(t, c).value : t));
    ok('P25b the list form only: a bare "al-thalith --" after "al-awwal --" is "al-thani --", a feminine keeps its gender, and prose ("al-qawl al-awwal arjah") is not touched',
      seq[1].startsWith('\u0627\u0644\u062b\u0627\u0646\u064a \u2014 ') && seq[2].startsWith('\u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649: ') && seq[3] === '\u0648\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644 \u0623\u0631\u062c\u062d' && seq[4] === '\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644 \u0623\u0631\u062c\u062d \u0639\u0646\u062f\u064a', ascii(JSON.stringify(seq)));
  }

  // ---------------------------------------------------------------- P26 (PIPES3, C) round 8, 5: lines that are only "."
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u062a\u0627\u0631\u0643 \u0627\u0644\u0635\u0644\u0627\u0629 \u064a\u0642\u062a\u0644 \u062d\u062f\u0627 \u0644\u0627 \u0643\u0641\u0631\u0627 \u0639\u0646\u062f \u0627\u0644\u0645\u0627\u0644\u0643\u064a\u0629 \u0648\u0627\u0644\u0634\u0627\u0641\u0639\u064a\u0629. \u0648\u0647\u0648 \u0641\u0627\u0633\u0642 \u0644\u0627 \u064a\u0642\u062a\u0644 \u0639\u0646\u062f \u0627\u0644\u062d\u0646\u0641\u064a\u0629.' }];
    const out = [];
    const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
    r.push('\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0644\u062b: \u064a\u0642\u062a\u0644 \u062d\u062f\u0627 \u0644\u0627 \u0643\u0641\u0631\u0627 \u0639\u0646\u062f \u0627\u0644\u0645\u0627\u0644\u0643\u064a\u0629 \u0648\u0627\u0644\u0634\u0627\u0641\u0639\u064a\u0629 [[1]].\n. [[1]]\n\u0648\u0644\u0623\u0646\u0647 \u062a\u0639\u0627\u0644\u0649 \u0623\u0645\u0631 \u0628\u0642\u062a\u0644 \u0627\u0644\u0645\u0634\u0631\u0643\u064a\u0646 \u062b\u0645 \u0642\u0627\u0644:\n<verse surah_num="9" ayah="5"></verse>.\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0631\u0627\u0628\u0639: \u0647\u0648 \u0641\u0627\u0633\u0642 \u0644\u0627 \u064a\u0642\u062a\u0644 \u0639\u0646\u062f \u0627\u0644\u062d\u0646\u0641\u064a\u0629 [[1]].\n');
    const s = await r.end();
    const text = out.join('');
    ok('P26a question 5: no line of the answer is "." alone -- a unit of punctuation is empty, and the stop after a verse card is taken off, the card kept',
      !/(?:^|\n)\s*[.\u060c]\s*(?:\n|$)/u.test(text) && text.includes('<verse surah_num="9" ayah="5"></verse>\n') && !text.includes('</verse>.') && text.includes('\u0647\u0648 \u0641\u0627\u0633\u0642 \u0644\u0627 \u064a\u0642\u062a\u0644') && s.holds.empty === 1,
      ascii(JSON.stringify({ text, holds: s.holds })));
    ok('P26b the tests: "." and ". [[1]]" are empty, "wa-ma." still is; a stop after a closing card tag at the end goes, a card mid-unit keeps what follows it',
      UNITS.onlyFunctionWords('.') && UNITS.onlyFunctionWords('. [[1]]') && UNITS.onlyFunctionWords('\u0648\u0645\u0627.') && !UNITS.onlyFunctionWords('\u064a\u062c\u0648\u0632.')
      && typeof UNITS.withoutCardTail === 'function' && UNITS.withoutCardTail('\u0642\u0627\u0644: <verse surah_num="9" ayah="5"></verse>.') === '\u0642\u0627\u0644: <verse surah_num="9" ayah="5"></verse>'
      && UNITS.withoutCardTail('<verse surah_num="9" ayah="5"></verse> \u062b\u0645 \u0643\u0644\u0627\u0645.') === '<verse surah_num="9" ayah="5"></verse> \u062b\u0645 \u0643\u0644\u0627\u0645.');
  }

  // ---------------------------------------------------------------- P27 (PIPES3, F) round 8, 11: "al-hadith al-warid fi ..." names no hadith
  {
    const UNITS = await esm('lib/bw2-units.js');
    const Q11 = '\u0645\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0648\u0627\u0631\u062f \u0641\u064a \u0641\u0636\u0644 \u0627\u0644\u0633\u0648\u0627\u0643\u061f \u0648\u0645\u0646 \u0631\u0648\u0627\u0647\u061f';
    const Q14 = '\u0645\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645 \u0641\u064a \u0641\u0636\u0644 \u0627\u0644\u0648\u0636\u0648\u0621\u061f';
    ok('P27a questions 11 and 14: "al-hadith" + a description is not an asked matn (so no source question waits on one); "hadith: X", "al-hadith: X" and "hadith X" still are',
      UNITS.askedHadithOf(Q11) === '' && !UNITS.asksHadithSource(Q11) && UNITS.askedHadithOf(Q14) === ''
      && UNITS.askedHadithOf('\u0645\u0627 \u0635\u062d\u0629 \u0627\u0644\u062d\u062f\u064a\u062b: \u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627\u061f') === '\u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627'
      && UNITS.askedHadithOf('\u0645\u0627 \u0635\u062d\u0629 \u062d\u062f\u064a\u062b: \u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a\u061f \u0648\u0645\u0646 \u0623\u062e\u0631\u062c\u0647\u061f') === '\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a'
      && UNITS.askedHadithOf('\u0645\u0627 \u0635\u062d\u0629 \u062d\u062f\u064a\u062b \u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0645\u0646 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u061f') === '\u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0645\u0646 \u0627\u0644\u0625\u064a\u0645\u0627\u0646',
      ascii(JSON.stringify([UNITS.askedHadithOf(Q11), UNITS.askedHadithOf(Q14)])));
    const rows = [{ ref: 1, kind: 'encyclopedia', title: 'a', fullText: '\u0627\u0644\u0633\u0648\u0627\u0643 \u0645\u0637\u0647\u0631\u0629 \u0644\u0644\u0641\u0645 \u0645\u0631\u0636\u0627\u0629 \u0644\u0644\u0631\u0628. \u0648\u0647\u0648 \u0633\u0646\u0629 \u0645\u0624\u0643\u062f\u0629 \u0639\u0646\u062f \u0643\u0644 \u0635\u0644\u0627\u0629.' }];
    const out = [];
    const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; }, askedMatn: UNITS.askedHadithOf(Q11), sourceQuestion: UNITS.asksHadithSource(Q11) });
    r.push('\u0627\u0644\u0633\u0648\u0627\u0643 \u0633\u0646\u0629 \u0645\u0624\u0643\u062f\u0629 \u0639\u0646\u062f \u0643\u0644 \u0635\u0644\u0627\u0629 [[1]].\n');
    const s = await r.end();
    ok('P27b question 11 through the releaser: its first unit goes out, instead of waiting for a proof of "al-warid fi fadl al-siwak" that no unit can give',
      out.join('').startsWith('\u0627\u0644\u0633\u0648\u0627\u0643 \u0633\u0646\u0629 \u0645\u0624\u0643\u062f\u0629') && s.released === 1, ascii(JSON.stringify({ text: out.join(''), holds: s.holds })));
  }

  // ---------------------------------------------------------------- P28 (PIPES3, F) round 8, 9: the named hadith asked in its own words
  {
    const Q9 = '\u0645\u0627 \u062f\u0631\u062c\u0629 \u062d\u062f\u064a\u062b: \u0623\u0646\u0627 \u0645\u062f\u064a\u0646\u0629 \u0627\u0644\u0639\u0644\u0645 \u0648\u0639\u0644\u064a \u0628\u0627\u0628\u0647\u0627\u061f';
    const MATN = '\u0627\u0646\u0627 \u0645\u062f\u064a\u0646\u0647 \u0627\u0644\u0639\u0644\u0645 \u0648\u0639\u0644\u064a \u0628\u0627\u0628\u0647\u0627';
    ok('P28a question 9: the issue query lost the hadith\'s words (frame words); the hadith query is the matn itself, a trailing grade word taken off, and none for a question that names no hadith',
      BW2.libraryQuery(Q9) !== MATN && typeof BW2.hadithLibraryQuery === 'function' && BW2.hadithLibraryQuery(Q9) === MATN
      && BW2.hadithLibraryQuery('\u0647\u0644 \u062d\u062f\u064a\u062b: \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0637\u064a\u0628\u0629 \u0635\u062f\u0642\u0629 \u062b\u0627\u0628\u062a\u061f') === '\u0627\u0644\u0643\u0644\u0645\u0647 \u0627\u0644\u0637\u064a\u0628\u0647 \u0635\u062f\u0642\u0647'
      && BW2.hadithLibraryQuery('\u0645\u0627 \u062d\u0643\u0645 \u0635\u0644\u0627\u0629 \u0627\u0644\u062c\u0645\u0627\u0639\u0629\u061f') === '' && BW2.hadithLibraryQuery('\u0645\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0648\u0627\u0631\u062f \u0641\u064a \u0641\u0636\u0644 \u0627\u0644\u0633\u0648\u0627\u0643\u061f \u0648\u0645\u0646 \u0631\u0648\u0627\u0647\u061f') === '',
      ascii(BW2.libraryQuery(Q9)));
    const seen = [];
    const runTool = async (name, input, ctx) => {
      if (name !== 'search_library') return { text: '', added: [], calls: 0 };
      seen.push(input.query);
      for (let i = 0; i < 4; i += 1) ctx.table.add({ kind: 'lib_book', title: 'b ' + input.query + ' ' + i, recordId: 'lib:' + input.query + ':' + i, text: input.query + ' ' + i });
      return { text: '', added: [], calls: 1 };
    };
    const g = await BW2.gatherBw2({ question: Q9, libFlagValue: 'on', libToken: 't', budgetMs: 800,
      deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true, scholarBooksOf: () => null } });
    const lib = g.results.library;
    const mine = lib.filter((row) => String(row.recordId).startsWith('lib:' + MATN + ':'));
    ok('P28b question 9 end to end: the library is also asked the matn, its three rows come after every other member\'s',
      seen.includes(MATN) && mine.length === 3 && lib.indexOf(mine[0]) === lib.length - 3, ascii(JSON.stringify(seen)));
  }

  // ---------------------------------------------------------------- P29 (PIPES3) round 8, 17: "the texts carry one view" is not the marker
  {
    const UNITS = await esm('lib/bw2-units.js');
    const H17 = '\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u062a\u064a \u0628\u064a\u0646 \u064a\u062f\u064a \u062a\u0639\u0631\u0636 \u0642\u0648\u0644\u0627 \u0648\u0627\u062d\u062f\u0627 \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629\u060c \u0648\u0647\u0648 \u0627\u0644\u0645\u0646\u0639\u060c \u0648\u0644\u0645 \u0623\u0642\u0641 \u0641\u064a\u0647\u0627 \u0639\u0644\u0649 \u0646\u0635 \u064a\u062d\u0643\u064a \u0642\u0648\u0644 \u0627\u0644\u0645\u062c\u064a\u0632\u064a\u0646 \u0623\u0648 \u0623\u062f\u0644\u062a\u0647\u0645\u060c \u0641\u0644\u0627 \u0623\u0633\u062a\u0637\u064a\u0639 \u0639\u0631\u0636 \u0627\u0644\u062e\u0644\u0627\u0641 \u0639\u0644\u0649 \u0648\u062c\u0647\u0647.';
    const H7_5 = '\u0627\u0644\u0628\u062a\u0643\u0648\u064a\u0646 \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u0644\u0645 \u064a\u0631\u062f \u0641\u064a\u0647\u0627 \u0646\u0635 \u0645\u0628\u0627\u0634\u0631 \u0641\u064a\u0645\u0627 \u0628\u064a\u0646 \u064a\u062f\u064a \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0645\u0635\u0627\u062f\u0631\u060c \u0644\u0643\u0646 \u0627\u0644\u0646\u0635\u0648\u0635 \u0639\u0627\u0644\u062c\u062a \u0645\u0627 \u064a\u0642\u0627\u0631\u0628\u0647\u0627.';
    const H6_17 = '\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0646\u0642\u0644\u062a \u0627\u0644\u062d\u062f\u064a\u062b \u0648\u0627\u0639\u062a\u0645\u062f\u062a\u0647 \u0623\u0635\u0644\u0627 \u0644\u0642\u0627\u0639\u062f\u0629 \u0641\u0642\u0647\u064a\u0629\u060c \u0644\u0643\u0646\u0647\u0627 \u0644\u0645 \u062a\u0630\u0643\u0631 \u062a\u062e\u0631\u064a\u062c\u0647 \u0648\u0644\u0627 \u0627\u0644\u062d\u0643\u0645 \u0639\u0644\u0649 \u0625\u0633\u0646\u0627\u062f\u0647\u060c \u0641\u0644\u0645 \u0623\u0642\u0641 \u0639\u0644\u0649 \u0646\u0635 \u0647\u0646\u0627 \u064a\u0628\u064a\u0646 \u062f\u0631\u062c\u0629 \u0635\u062d\u062a\u0647 \u0635\u0631\u0627\u062d\u0629.';
    ok('P29a question 17\'s opening (one view carried, the other side not) is partial coverage; round 7\'s 5 and round 6\'s 17 still read as the marker (PIPES2 fix 3)',
      !UNITS.admitsNotCovered(H17) && UNITS.admitsNotCovered(H7_5) && UNITS.admitsNotCovered(H6_17));
    const rows = [{ ref: 1, kind: 'fatwa', title: 'a', passage: '\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0644 \u0628\u0627\u0644\u0645\u0648\u0644\u062f \u0627\u0644\u0646\u0628\u0648\u064a \u0628\u062f\u0639\u0629 \u063a\u064a\u0631 \u0645\u0634\u0631\u0648\u0639\u0629.', fullText: '\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0644 \u0628\u0627\u0644\u0645\u0648\u0644\u062f \u0627\u0644\u0646\u0628\u0648\u064a \u0628\u062f\u0639\u0629 \u063a\u064a\u0631 \u0645\u0634\u0631\u0648\u0639\u0629.' }];
    const out = [];
    const r = UNITS.createBw2Releaser({ rows, emit: (p) => { out.push(p); return true; } });
    r.push(H17 + '\n\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0644 \u0628\u0627\u0644\u0645\u0648\u0644\u062f \u0627\u0644\u0646\u0628\u0648\u064a \u0628\u062f\u0639\u0629 \u063a\u064a\u0631 \u0645\u0634\u0631\u0648\u0639\u0629 [[1]].\n');
    const s = await r.end();
    ok('P29b question 17 through the releaser: the answer goes on after its opening instead of being handed to the old path',
      !s.notCovered && out.join('').includes('\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0644 \u0628\u0627\u0644\u0645\u0648\u0644\u062f \u0627\u0644\u0646\u0628\u0648\u064a \u0628\u062f\u0639\u0629'), ascii(JSON.stringify({ text: out.join(''), holds: s.holds })));
  }

  // ---------------------------------------------------------------- P30 (PIPES4, B) round 9, 3 and 16: "al-qawl" numbering after PIPES3 fix 2
  {
    const UNITS = await esm('lib/bw2-units.js');
    const rel = async (fullText, writer) => {
      const out = [];
      const r = UNITS.createBw2Releaser({ rows: [{ ref: 1, kind: 'lib_book', title: 'a', fullText }], emit: (p) => { out.push(p); return true; } });
      r.push(writer + '\n');
      const s = await r.end();
      return { text: out.join(''), s };
    };
    const a = await rel('\u0627\u062e\u062a\u0644\u0641 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0635\u0631\u0648\u0646 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0639\u0642\u0648\u062f \u0639\u0644\u0649 \u0623\u0642\u0648\u0627\u0644: \u062a\u062d\u0631\u064a\u0645 \u062c\u0645\u064a\u0639 \u0623\u0646\u0648\u0627\u0639 \u0639\u0642\u0648\u062f \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a. \u0625\u0628\u0627\u062d\u0629 \u062c\u0645\u064a\u0639 \u0623\u0646\u0648\u0627\u0639 \u0639\u0642\u0648\u062f \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a. \u0625\u0628\u0627\u062d\u0629 \u062e\u064a\u0627\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u062a\u062d\u0631\u064a\u0645 \u062e\u064a\u0627\u0631 \u0627\u0644\u0628\u064a\u0639.', '\u0648\u0642\u062f \u0627\u062e\u062a\u0644\u0641 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0635\u0631\u0648\u0646 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0639\u0642\u0648\u062f \u0639\u0644\u0649 \u0623\u0642\u0648\u0627\u0644: \u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644: \u062a\u062d\u0631\u064a\u0645 \u062c\u0645\u064a\u0639 \u0623\u0646\u0648\u0627\u0639 \u0639\u0642\u0648\u062f \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a [[1]].\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0646\u064a: \u0625\u0628\u0627\u062d\u0629 \u062c\u0645\u064a\u0639 \u0623\u0646\u0648\u0627\u0639 \u0639\u0642\u0648\u062f \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a [[1]].\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0644\u062b: \u0625\u0628\u0627\u062d\u0629 \u062e\u064a\u0627\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u062a\u062d\u0631\u064a\u0645 \u062e\u064a\u0627\u0631 \u0627\u0644\u0628\u064a\u0639 [[1]].');
    ok('P30a question 3: "... ala aqwal: al-qawl al-awwal: ..." inside a line counts, so the next list lines stay "al-thani" and "al-thalith"',
      a.text.includes('\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0646\u064a: \u0625\u0628\u0627\u062d\u0629 \u062c\u0645\u064a\u0639') && a.text.includes('\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u062b\u0627\u0644\u062b: \u0625\u0628\u0627\u062d\u0629 \u062e\u064a\u0627\u0631') && !a.text.includes('\n\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0623\u0648\u0644:'), ascii(a.text));
  }

  // ---------------------------------------------------------------- P24d (PIPES3, A, from the rounds 2-8 list) a passive has no subject
  {
    const UNITS = await esm('lib/bw2-units.js');
    ok('P24d round 6, 21: "wa-dhukira anna" written with its damma is the passive and points at nobody; "wa-dhakara anna" (16) still points back',
      UNITS.dependentKind('\u0648\u0630\u064f\u0643\u0631 \u0623\u0646 \u062c\u0645\u0647\u0648\u0631 \u0641\u0642\u0647\u0627\u0621 \u0627\u0644\u0623\u0645\u0635\u0627\u0631 \u0639\u0644\u0649 \u0623\u0646 \u0627\u0644\u0637\u0644\u0627\u0642 \u0628\u0644\u0641\u0638 \u0627\u0644\u062b\u0644\u0627\u062b \u062d\u0643\u0645\u0647 \u062d\u0643\u0645 \u0627\u0644\u0637\u0644\u0642\u0629 \u0627\u0644\u062b\u0627\u0644\u062b\u0629') === ''
      && UNITS.dependentKind('\u0648\u0630\u0643\u0631 \u0623\u0646 \u0627\u0644\u0641\u0642\u0647\u0627\u0621 \u0625\u0630\u0627 \u062c\u0648\u0632\u0648\u0627 \u0628\u064a\u0639 \u0627\u0644\u062a\u0645\u0631') === 'backref' && UNITS.dependentKind('\u0648\u0630\u064e\u0643\u064e\u0631\u064e \u0623\u0646 \u0627\u0644\u0641\u0642\u0647\u0627\u0621') === 'backref');
  }

  // ---------------------------------------------------------------- P2 the fatwa store in the reader's letters
  {
    const Q5 = '\u0645\u0627 \u062d\u0643\u0645 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0641\u0627\u062a\u062d\u0629 \u0644\u0644\u0645\u0623\u0645\u0648\u0645 \u0639\u0646\u062f \u0627\u0644\u0645\u0630\u0627\u0647\u0628 \u0627\u0644\u0623\u0631\u0628\u0639\u0629';
    const Q13 = '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0641\u064a \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629\u061f';
    const Q_MARKED = '\u0645\u0627 \u062d\u064f\u0643\u0652\u0645\u064f \u0635\u064e\u0644\u0627\u0629\u0650 \u0627\u0644\u062e\u064e\u0648\u0652\u0641\u0650\u061f';
    ok('P2a question 5: the words are chosen folded and sent as written (the store does not fold: 74 fatwas against 0)',
      JSON.stringify(BW2.fatwaQueries(Q5)) === JSON.stringify(['\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0641\u0627\u062a\u062d\u0629 \u0644\u0644\u0645\u0623\u0645\u0648\u0645'])
      && JSON.stringify(BW2.issueTerms(Q5)) === JSON.stringify(['\u0642\u0631\u0627\u0621\u0647', '\u0627\u0644\u0641\u0627\u062a\u062d\u0647', '\u0644\u0644\u0645\u0627\u0645\u0648\u0645']), ascii(JSON.stringify(BW2.fatwaQueries(Q5))));
    ok('P2b question 13 as written, and diacritics and punctuation are taken off without folding a letter',
      JSON.stringify(BW2.fatwaQueries(Q13)) === JSON.stringify(['\u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629'])
      && JSON.stringify(BW2.fatwaQueries(Q_MARKED)) === JSON.stringify(['\u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641']), ascii(JSON.stringify(BW2.fatwaQueries(Q_MARKED))));
    ok('P2c question 22: the honorific formulas stay out of the written words too',
      BW2.fatwaQueries(Q22).every((q) => !/\u0631\u0636\u064a|\u0648\u0633\u0644\u0645/u.test(q)) && BW2.fatwaQueries(Q22).join(' ').includes('\u0623\u0646\u0633'),
      ascii(JSON.stringify(BW2.fatwaQueries(Q22))));
    const byQuery = {};
    const runTool = async (name, input, ctx) => {
      if (name !== 'search_fatawa') return { text: '', added: [], calls: 0 };
      const tag = Object.keys(byQuery).length;
      byQuery[input.query] = tag;
      for (let i = 0; i < 4; i += 1) ctx.table.add({ kind: 'fatwa', title: 't' + tag + i, url: 'https://binbaz.org.sa/fatwas/' + tag + i, text: 'x' });
      return { text: '', added: [], calls: 1 };
    };
    const g = await BW2.gatherBw2({
      question: '\u0645\u0627 \u062d\u0643\u0645 \u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0648\u062d\u062f\u0647\u061f', budgetMs: 800,
      deps: { runTool, searchStoredCorpus: async () => ({ records: [] }), encyclopediaReady: () => true },
    });
    const order = g.results.fatwa.map((r) => r.url.slice(-2)).join(',');
    ok('P2d two answering queries take turns in the six places (question 10 kept its three carrying rows)',
      Object.keys(byQuery).length === 2 && order === '00,10,01,11,02,12', order);
  }

  // ---------------------------------------------------------------- P3 no coverage goes on by itself
  {
    const SSE = await esm('lib/finalized-sse-writer.js');
    const ASK = await esm('api/ask.js');
    const makeTarget = () => ({
      writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
      write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
      end() { this.ended += 1; return this; },
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
      getHeader(k) { return this.headers[String(k).toLowerCase()]; },
      flushHeaders() { this.headersSent = true; },
      json(o) { this.jsonBody = o; this.ended += 1; return this; },
      once() { return this; }, on() { return this; }, removeListener() { return this; },
    });
    const framesOf = (writes) => writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
      .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
    const NOT_COVERED = BW2.BW2_NOT_COVERED;

    // P3a/P3b: the unit, over the real facade and the real wire.
    const unit = async (continueWhenNotCovered) => {
      const target = makeTarget();
      const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question: Q1, messages: [{ role: 'user', content: Q1 }], wire: BW2.createBw2Wire(facade),
        libFlagValue: 'on', libToken: 't', continueWhenNotCovered,
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true,
          callWriter: async () => { throw new Error('the writer must not be called'); },
        },
      });
      return { out, target, frames: framesOf(target.writes) };
    };
    const on = await unit(true);
    ok('P3a no row in any of our sources, continuation on: handed back unfinished -- status frames only, no text, no offer, the response still open',
      on.out.continued === true && on.out.telemetry.continued === 'no_rows' && on.target.ended === 0
      && on.frames.length > 0 && on.frames.every((f) => f.type === 'ezik_status'), ascii(JSON.stringify(on.frames.map((f) => f.type))));
    const off = await unit(false);
    ok('P3b ...and with it off (the default) the turn ends as before: the not-covered sentence and the offer',
      !off.out.continued && off.target.ended === 1 && framesOf(off.target.writes).some((f) => f.type === 'ezik_live_offer')
      && off.frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') === NOT_COVERED);

    // P3e: a kept row, and the writer answers with its not-covered marker alone -- handed back as 'marker'.
    {
      const target = makeTarget();
      const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const UNITS = await esm('lib/bw2-units.js');
      const rec = { id: 'F9', term: 'x', part: 1, snippet: 'text about the issue', text: 'text about the issue' };
      const out = await BW2.runBw2Turn({
        question: Q1, messages: [{ role: 'user', content: Q1 }], wire: BW2.createBw2Wire(facade), continueWhenNotCovered: true,
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true,
          ask: async () => '{"d":{"1":1}}',
          callWriter: async ({ onText }) => { onText(UNITS.BW2_NOT_COVERED_MARKER); return { stop_reason: 'end_turn', usage: {} }; },
        },
      });
      ok('P3e a kept row and the writer\'s marker alone: handed back as "marker", nothing written',
        out.continued === true && out.telemetry.continued === 'marker' && target.ended === 0
        && framesOf(target.writes).every((f) => f.type === 'ezik_status'), JSON.stringify(out.telemetry.continued));
    }

    // P3f: the switch. On in code; only the words that plainly mean off take it down.
    {
      const FLAGS = await esm('lib/free-brain/flag.js');
      const d = (v) => FLAGS.bw2ContinueDecision(v === undefined ? {} : { BW2_CONTINUE: v }).enabled;
      ok('P3f BW2_CONTINUE: default on; off/false/0 (any case) turn it off; anything else stays on',
        d() && d('on') && d('typo') && !d('off') && !d('FALSE') && !d('0') && FLAGS.BW2_CONTINUE_DEFAULT === true);
    }

    // P4: question 13's shape -- units that went out with their card, then the writer's marker.
    {
      const UNITS = await esm('lib/bw2-units.js');
      const S1 = '\u064a\u062c\u0648\u0632 \u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0628\u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0625\u0630\u0627 \u0643\u0627\u0646 \u064a\u062f\u0627 \u0628\u064a\u062f';
      const S2 = '\u0648\u064a\u062d\u0631\u0645 \u062a\u0623\u062e\u064a\u0631 \u0627\u0644\u0642\u0628\u0636 \u0641\u064a \u0627\u0644\u0635\u0631\u0641';
      const rec = { id: 'F13', term: '\u0635\u0631\u0641', part: 26, snippet: S1 + '. ' + S2 + '.', text: S1 + '. ' + S2 + '.' };
      const p4 = async (continueWhenNotCovered) => {
        const target = makeTarget();
        const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
        const out = await BW2.runBw2Turn({
          question: '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0641\u064a \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629\u061f', messages: [{ role: 'user', content: 'x' }], wire: BW2.createBw2Wire(facade),
          continueWhenNotCovered,
          deps: {
            runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
            encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
            callWriter: async ({ onText }) => {
              onText(S1 + ' [[1]]. ' + S2 + ' [[1]].\n');
              // As on the preview: the units stream and are checked before the marker comes.
              await new Promise((resolve) => setTimeout(resolve, 200));
              onText(UNITS.BW2_NOT_COVERED_MARKER);
              return { stop_reason: 'end_turn', usage: {} };
            },
          },
        });
        const frames = framesOf(target.writes);
        return { out, frames, text: frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
      };
      const a = await p4(true);
      const b = await p4(false);
      ok('P4a units went out with their card, then the marker: the answer ends there -- no not-covered sentence, no offer, not handed on',
        a.text.includes(S1) && a.text.includes(S2) && !a.text.includes(NOT_COVERED) && !a.frames.some((f) => f.type === 'ezik_live_offer')
        && !a.out.continued && a.out.telemetry.markerSeen === true && a.out.telemetry.unitsReleased >= 2,
        ascii(JSON.stringify({ t: a.out.telemetry.unitsReleased, text: a.text.slice(0, 60) })));
      ok('P4b ...and the same with the continuation switched off',
        b.text.includes(S1) && !b.text.includes(NOT_COVERED) && !b.frames.some((f) => f.type === 'ezik_live_offer'), ascii(b.text.slice(-80)));
    }

    // P5: question 21 -- the requested man, named in the answer, is the requested man.
    {
      const PLAN = await esm('lib/ask-plan.js');
      const ORV = await esm('lib/output-reviewer.js');
      const Q21 = '\u0645\u0627 \u0631\u0623\u064a \u0627\u0644\u0625\u0645\u0627\u0645 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0641\u064a \u0637\u0644\u0627\u0642 \u0627\u0644\u062b\u0644\u0627\u062b \u0628\u0644\u0641\u0638 \u0648\u0627\u062d\u062f\u061f';
      const p = PLAN.planAsk([{ role: 'user', content: Q21 }], { policyEnabled: true });
      const identity = { id: String(p.requestedAuthorityId || ''), name: String(p.namedEntity || ''),
        status: p.requestedAuthorityId ? 'resolved' : (p.scholarCandidates.length > 1 ? 'ambiguous' : 'unresolved'), candidates: [] };
      const view = ORV.identityView(identity);
      const HIS = '\u0648\u0630\u0647\u0628 \u0634\u064a\u062e \u0627\u0644\u0625\u0633\u0644\u0627\u0645 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0625\u0644\u0649 \u0623\u0646 \u0637\u0644\u0627\u0642 \u0627\u0644\u062b\u0644\u0627\u062b \u0628\u0644\u0641\u0638 \u0648\u0627\u062d\u062f \u064a\u0642\u0639 \u0637\u0644\u0642\u0629 \u0648\u0627\u062d\u062f\u0629\u060c \u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0628\u0645\u062b\u0644 \u0642\u0648\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629.';
      const OTHER = '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0625\u0646 \u0637\u0644\u0627\u0642 \u0627\u0644\u062b\u0644\u0627\u062b \u0628\u0644\u0641\u0638 \u0648\u0627\u062d\u062f \u064a\u0642\u0639 \u0637\u0644\u0642\u0629 \u0648\u0627\u062d\u062f\u0629.';
      const r1 = ORV.requestedIdentityRespected(HIS, view);
      const r2 = ORV.requestedIdentityRespected(OTHER, view);
      ok('P5a question 21: the plan asks for Ibn Taymiyya, folded; an answer naming him (and another scholar) is respected -- no notice',
        p.attributionMode === 'namedScholarOpinion' && identity.status === 'resolved' && r1.respected === true && !r1.notice,
        ascii(JSON.stringify({ mode: p.attributionMode, status: identity.status, r1 })));
      ok('P5b ...an answer about another man only is still caught, with its notice',
        r2.respected === false && r2.reason === 'mismatch-another-authority' && !!r2.notice, ascii(JSON.stringify(r2)));
    }

    // P6: question 15's shape -- a hadith no row carries is held; the line crediting it goes with it.
    {
      const ROWTEXT = '\u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646 \u0641\u0631\u0636 \u0639\u064a\u0646\u060c \u0648\u062e\u0644\u0627\u0641\u0647 \u062d\u0631\u0627\u0645\u060c \u0645\u0627 \u0644\u0645 \u064a\u0623\u0645\u0631\u0627 \u0628\u0634\u0631\u0643 \u0623\u0648 \u0645\u0639\u0635\u064a\u0629.';
      const rec = { id: 'F15', term: '\u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646', part: 8, snippet: ROWTEXT, text: ROWTEXT };
      const U0 = '\u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646 \u0641\u0631\u0636 \u0639\u064a\u0646\u060c \u0648\u062e\u0644\u0627\u0641\u0647 \u062d\u0631\u0627\u0645 [[1]].';
      const UH = '\u0648\u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab\u0631\u0636\u0627 \u0627\u0644\u0631\u0628 \u0641\u064a \u0631\u0636\u0627 \u0627\u0644\u0648\u0627\u0644\u062f\u060c \u0648\u0633\u062e\u0637 \u0627\u0644\u0631\u0628 \u0641\u064a \u0633\u062e\u0637 \u0627\u0644\u0648\u0627\u0644\u062f\u00bb.';
      const UC = '\u0645\u0646 \u062d\u062f\u064a\u062b \u0639\u0628\u062f \u0627\u0644\u0644\u0647 \u0628\u0646 \u0639\u0645\u0631\u0648 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647\u0645\u0627.';
      const UW = '\u0648\u0648\u062c\u0647 \u0627\u0644\u062f\u0644\u0627\u0644\u0629 \u0623\u0646\u0647 \u062c\u0639\u0644 \u0631\u0636\u0627 \u0627\u0644\u0644\u0647 \u0641\u064a \u0631\u0636\u0627 \u0627\u0644\u0648\u0627\u0644\u062f.';
      const p6 = async (writer) => {
        const target = makeTarget();
        const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
        const out = await BW2.runBw2Turn({
          question: '\u0645\u0627 \u0627\u0644\u0623\u062f\u0644\u0629 \u0645\u0646 \u0627\u0644\u0642\u0631\u0622\u0646 \u0648\u0627\u0644\u0633\u0646\u0629 \u0639\u0644\u0649 \u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646\u061f', messages: [{ role: 'user', content: 'x' }], wire: BW2.createBw2Wire(facade),
          deps: {
            runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
            encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
            callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
          },
        });
        return { out, text: framesOf(target.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
      };
      const a = await p6([U0, UH, UC, UW].join('\n'));
      ok('P6a a held hadith takes its credit line ("from the hadith of ...") and "the point of evidence" with it; the released unit stays',
        a.text.includes('\u0641\u0631\u0636 \u0639\u064a\u0646') && !a.text.includes('\u0645\u0646 \u062d\u062f\u064a\u062b') && !a.text.includes('\u0648\u062c\u0647 \u0627\u0644\u062f\u0644\u0627\u0644\u0629') && !a.text.includes('\u0631\u0636\u0627 \u0627\u0644\u0631\u0628'),
        ascii(JSON.stringify({ held: a.out.telemetry.unitsHeld, dep: a.out.telemetry.heldDependentOnHeld, text: a.text.slice(-60) })));
      const b = await p6([U0, UC].join('\n'));
      ok('P6b a credit line after a released unit is checked as today (not held for leaning)',
        b.out.telemetry.heldDependentOnHeld === 0 && b.out.telemetry.heldDependentOpening === 0, JSON.stringify(b.out.telemetry));
      ok('P6c "rawahu X" is not a credit line: it may open a source answer by itself (FIX5, C7)',
        (await esm('lib/bw2-units.js')).dependentKind('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0646\u0633 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.') === ''
        && (await esm('lib/bw2-units.js')).dependentKind('\u0648\u0645\u0646 \u062d\u062f\u064a\u062b \u0623\u0628\u064a \u0647\u0631\u064a\u0631\u0629 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.') === 'credit');
    }

    // P7: question 27's shape -- a heading nothing released came under is not sent.
    {
      const UNITS = await esm('lib/bw2-units.js');
      const ROWTEXT = '\u0645\u0646 \u062a\u0631\u0643 \u0631\u0643\u0646\u0627 \u0645\u0646 \u0623\u0631\u0643\u0627\u0646 \u0627\u0644\u062d\u062c \u0644\u0645 \u064a\u062a\u0645 \u062d\u062c\u0647 \u0625\u0644\u0627 \u0628\u0647\u060c \u0648\u0645\u0646 \u062a\u0631\u0643 \u0648\u0627\u062c\u0628\u0627 \u0641\u0639\u0644\u064a\u0647 \u062f\u0645. \u0648\u0648\u0642\u062a \u0627\u0644\u062d\u062c \u0634\u0648\u0627\u0644 \u0648\u0630\u0648 \u0627\u0644\u0642\u0639\u062f\u0629 \u0648\u0639\u0634\u0631 \u0630\u064a \u0627\u0644\u062d\u062c\u0629.';
      const rec = { id: 'F27', term: '\u062d\u062c', part: 17, snippet: ROWTEXT, text: ROWTEXT };
      const writer = [
        '\u0623\u0648\u0644\u0627: \u0627\u0644\u062a\u0641\u0631\u064a\u0642 \u0628\u064a\u0646 \u0627\u0644\u0631\u0643\u0646 \u0648\u0627\u0644\u0648\u0627\u062c\u0628 \u0641\u064a \u0627\u0644\u062d\u062c',
        '\u0645\u0646 \u062a\u0631\u0643 \u0631\u0643\u0646\u0627 \u0645\u0646 \u0623\u0631\u0643\u0627\u0646 \u0627\u0644\u062d\u062c \u0644\u0645 \u064a\u062a\u0645 \u062d\u062c\u0647 \u0625\u0644\u0627 \u0628\u0647 [[1]].',
        '\u062b\u0627\u0646\u064a\u0627: \u0645\u0627 \u0646\u0635\u062a \u0639\u0644\u064a\u0647 \u0627\u0644\u0646\u0635\u0648\u0635 \u0645\u0646 \u0634\u0631\u0648\u0637 \u0627\u0644\u062d\u062c \u0648\u0623\u0631\u0643\u0627\u0646\u0647 \u0648\u0648\u0627\u062c\u0628\u0627\u062a\u0647 \u0648\u0633\u0646\u0646\u0647',
        '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0625\u0646 \u0627\u0644\u062d\u062c \u064a\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0631.',
        '\u062b\u0627\u0644\u062b\u0627: \u0645\u0633\u0627\u0626\u0644 \u0645\u062a\u0635\u0644\u0629 \u0648\u0631\u062f\u062a \u0641\u064a \u0627\u0644\u0646\u0635\u0648\u0635',
        '\u0648\u0648\u0642\u062a \u0627\u0644\u062d\u062c \u0634\u0648\u0627\u0644 \u0648\u0630\u0648 \u0627\u0644\u0642\u0639\u062f\u0629 \u0648\u0639\u0634\u0631 \u0630\u064a \u0627\u0644\u062d\u062c\u0629 [[1]].',
        '\u0631\u0627\u0628\u0639\u0627: \u0645\u0627 \u0644\u0645 \u0623\u0642\u0641 \u0639\u0644\u064a\u0647',
      ].join('\n');
      const target = makeTarget();
      const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
      const out = await BW2.runBw2Turn({
        question: '\u0645\u0627 \u0634\u0631\u0648\u0637 \u0627\u0644\u062d\u062c \u0648\u0623\u0631\u0643\u0627\u0646\u0647 \u0648\u0648\u0627\u062c\u0628\u0627\u062a\u0647 \u0648\u0633\u0646\u0646\u0647\u061f', messages: [{ role: 'user', content: 'x' }], wire: BW2.createBw2Wire(facade),
        deps: {
          runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
          encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
          callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
        },
      });
      const t = framesOf(target.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('');
      ok('P7a "first" and "third" go out with the units under them, "third" renumbered "second" (PIPES2 fix 11); the empty "second" and "fourth" do not',
        t.includes('\u0623\u0648\u0644\u0627') && t.includes('\u062b\u0627\u0646\u064a\u0627: \u0645\u0633\u0627\u0626\u0644 \u0645\u062a\u0635\u0644\u0629') && !t.includes('\u062b\u0627\u0644\u062b\u0627') && !t.includes('\u0631\u0627\u0628\u0639\u0627') && !t.includes('\u0645\u0627 \u0646\u0635\u062a \u0639\u0644\u064a\u0647')
        && t.indexOf('\u0623\u0648\u0644\u0627') < t.indexOf('\u0645\u0646 \u062a\u0631\u0643 \u0631\u0643\u0646\u0627') && t.indexOf('\u062b\u0627\u0646\u064a\u0627') < t.indexOf('\u0648\u0648\u0642\u062a \u0627\u0644\u062d\u062c')
        && out.telemetry.heldEmptyHeading === 2, ascii(JSON.stringify({ t: t.slice(0, 120), h: out.telemetry.heldEmptyHeading })));
      ok('P7b the heading test: an ordinal or markdown line with no sentence end is a heading; a sentence opening on an ordinal is not',
        UNITS.isHeadingUnit('\u062b\u0627\u0646\u064a\u0627: \u0623\u062f\u0644\u0629 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0646\u0628\u0648\u064a\u0629') && UNITS.isHeadingUnit('## \u0623\u062f\u0644\u0629 \u0627\u0644\u0633\u0646\u0629') && UNITS.isHeadingUnit('**\u062e\u0644\u0627\u0635\u0629**')
        && !UNITS.isHeadingUnit('\u0623\u0648\u0644\u0627 \u064a\u062c\u0628 \u0639\u0644\u064a\u0647 \u0623\u0646 \u064a\u062a\u0648\u0636\u0623.') && !UNITS.isHeadingUnit('\u0628\u0631 \u0627\u0644\u0648\u0627\u0644\u062f\u064a\u0646 \u0641\u0631\u0636 \u0639\u064a\u0646'));
    }

    // P11 (PIPES2 fix 3): round 7, question 5 -- an opening that says the gathered texts do not treat the question.
    {
      const UNITS = await esm('lib/bw2-units.js');
      const adm = (t) => typeof UNITS.admitsNotCovered === 'function' && UNITS.admitsNotCovered(t);
      const OPEN5 = '\u0627\u0644\u0628\u062a\u0643\u0648\u064a\u0646 \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629 \u0644\u0645 \u064a\u0631\u062f \u0641\u064a\u0647\u0627 \u0646\u0635 \u0645\u0628\u0627\u0634\u0631 \u0641\u064a\u0645\u0627 \u0628\u064a\u0646 \u064a\u062f\u064a \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0645\u0635\u0627\u062f\u0631\u060c \u0644\u0643\u0646 \u0627\u0644\u0646\u0635\u0648\u0635 \u0639\u0627\u0644\u062c\u062a \u0645\u0627 \u064a\u0642\u0627\u0631\u0628\u0647\u0627 \u0645\u0646 \u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0641\u064a \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u062f\u0648\u0644\u064a\u0629\u060c \u0648\u0636\u0648\u0627\u0628\u0637\u0647\u0627 \u0627\u0644\u0634\u0631\u0639\u064a\u0629. [[1]]';
      const OPEN8 = '\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0644\u0627 \u062a\u0633\u062a\u0648\u0641\u064a \u062c\u0648\u0627\u0628 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0643\u0627\u0645\u0644\u0629\u061b \u0641\u0644\u064a\u0633 \u0641\u064a\u0647\u0627 \u0628\u064a\u0627\u0646 \u0634\u0631\u0648\u0637 \u0627\u0644\u0635\u0644\u0627\u0629\u060c \u0648\u0644\u0627 \u0627\u0633\u062a\u064a\u0641\u0627\u0621 \u0644\u0648\u0627\u062c\u0628\u0627\u062a\u0647\u0627 \u0648\u0633\u0646\u0646\u0647\u0627 \u0639\u0644\u0649 \u0627\u0644\u062a\u0641\u0635\u064a\u0644.';
      const OPEN28 = '\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0647\u0646\u0627 \u0644\u0627 \u062a\u063a\u0637\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0628\u0623\u0631\u0643\u0627\u0646\u0647\u0627 \u0627\u0644\u0623\u0631\u0628\u0639\u0629\u060c \u0648\u0625\u0646\u0645\u0627 \u062a\u0645\u0633 \u0623\u0637\u0631\u0627\u0641\u0627 \u0645\u062a\u0641\u0631\u0642\u0629 \u0645\u0646\u0647\u0627.';
      const GRADE6 = '\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0646\u0642\u0644\u062a \u0627\u0644\u062d\u062f\u064a\u062b \u0648\u0627\u0639\u062a\u0645\u062f\u062a\u0647 \u0623\u0635\u0644\u0627 \u0644\u0642\u0627\u0639\u062f\u0629 \u0641\u0642\u0647\u064a\u0629\u060c \u0644\u0643\u0646\u0647\u0627 \u0644\u0645 \u062a\u0630\u0643\u0631 \u062a\u062e\u0631\u064a\u062c\u0647 \u0648\u0644\u0627 \u0627\u0644\u062d\u0643\u0645 \u0639\u0644\u0649 \u0625\u0633\u0646\u0627\u062f\u0647\u060c \u0641\u0644\u0645 \u0623\u0642\u0641 \u0639\u0644\u0649 \u0646\u0635 \u0647\u0646\u0627 \u064a\u0628\u064a\u0646 \u062f\u0631\u062c\u0629 \u0635\u062d\u062a\u0647 \u0635\u0631\u0627\u062d\u0629.';
      const SCHOLARS = '\u0644\u0645 \u064a\u0631\u062f \u0641\u064a \u0627\u0644\u0643\u062a\u0627\u0628 \u0648\u0627\u0644\u0633\u0646\u0629 \u0646\u0635 \u0635\u0631\u064a\u062d \u0641\u064a \u062d\u0643\u0645 \u0627\u0644\u062a\u062f\u062e\u064a\u0646\u060c \u0648\u0644\u0630\u0644\u0643 \u0627\u062c\u062a\u0647\u062f \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0641\u064a\u0647.';
      ok('P11a whole, not partial: question 5\'s opening and round 6\'s grading opening say our texts do not treat the question; question 8\'s, round 6 question 28\'s and a scholars\' "no explicit text in the Book" do not',
        adm(OPEN5) && adm(GRADE6) && !adm(OPEN8) && !adm(OPEN28) && !adm(SCHOLARS));
      const ROW = '\u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u064a\u062e\u0636\u0639 \u0644\u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0635\u0631\u0641\u060c \u0641\u0628\u064a\u0639 \u0639\u0645\u0644\u0629 \u0628\u0639\u0645\u0644\u0629 \u0623\u062e\u0631\u0649 \u064a\u0634\u062a\u0631\u0637 \u0641\u064a\u0647 \u0623\u0646 \u064a\u0643\u0648\u0646 \u064a\u062f\u0627 \u0628\u064a\u062f.';
      const rec = { id: 'F5', term: '\u0635\u0631\u0641', part: 26, snippet: ROW, text: ROW };
      const writer = [OPEN5, '\u0641\u0628\u064a\u0639 \u0639\u0645\u0644\u0629 \u0628\u0639\u0645\u0644\u0629 \u0623\u062e\u0631\u0649 \u064a\u0634\u062a\u0631\u0637 \u0641\u064a\u0647 \u0623\u0646 \u064a\u0643\u0648\u0646 \u064a\u062f\u0627 \u0628\u064a\u062f [[1]].'].join('\n');
      const run11 = async (continueWhenNotCovered) => {
        const target = makeTarget();
        const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
        const out = await BW2.runBw2Turn({
          question: '\u0645\u0627 \u062d\u0643\u0645 \u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u062a \u0627\u0644\u0645\u0634\u0641\u0631\u0629 \u0645\u062b\u0644 \u0627\u0644\u0628\u062a\u0643\u0648\u064a\u0646\u061f', messages: [{ role: 'user', content: 'x' }], wire: BW2.createBw2Wire(facade), continueWhenNotCovered,
          deps: {
            runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
            encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
            callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
          },
        });
        return { out, text: framesOf(target.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
      };
      const c = await run11(true);
      ok('P11b question 5\'s shape: nothing is released after that opening and the turn goes on by itself to the next sources',
        c.out.continued === true && c.text === '' && c.out.telemetry.continued === 'marker' && c.out.telemetry.heldNotCoveredSentence === 1,
        ascii(JSON.stringify({ c: c.out.continued, t: c.out.telemetry.continued, text: c.text.slice(0, 60) })));
      const d = await run11(false);
      ok('P11c with the owner\'s stop switch the same turn ends in the not-covered sentence and the offer, and the exchange rule is not sent',
        d.text.includes(NOT_COVERED) && d.out.telemetry.liveOffer === true && !d.text.includes('\u064a\u062f\u0627 \u0628\u064a\u062f'), ascii(d.text.slice(0, 80)));
    }

    // P12 (PIPES2 fix 4): round 7, question 9 -- "what did X narrate?" is answered with X's narration first, or not at all.
    {
      const UNITS = await esm('lib/bw2-units.js');
      const Q9 = '\u0645\u0627 \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0623\u0628\u0648 \u0647\u0631\u064a\u0631\u0629 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0639\u0646 \u0645\u0644\u0627\u0632\u0645\u062a\u0647 \u0644\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u061f';
      const Q22 = '\u0645\u0627 \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0639\u0646 \u062e\u062f\u0645\u062a\u0647 \u0644\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u061f';
      const nar = (q) => (typeof UNITS.askedNarratorOf === 'function' ? UNITS.askedNarratorOf(q) : null);
      ok('P12a the narrator asked about: question 9 and round 6\'s question 22 name him; "who narrated hadith ...", "the hadith al-Bukhari narrated" and a ruling question do not',
        nar(Q9) === '\u0627\u0628\u0648 \u0647\u0631\u064a\u0631\u0647' && nar(Q22) === '\u0627\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643' && nar('\u0645\u0646 \u0631\u0648\u0649 \u062d\u062f\u064a\u062b: \u0627\u0644\u0637\u0647\u0648\u0631 \u0634\u0637\u0631 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u061f') === ''
        && nar('\u0645\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0641\u064a \u0641\u0636\u0644 \u0627\u0644\u0639\u0644\u0645\u061f') === '' && nar('\u0645\u0627 \u062d\u0643\u0645 \u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0648\u062d\u062f\u0647\u061f') === '', ascii(JSON.stringify([nar(Q9), nar(Q22)])));
      const ROW = '\u0639\u0646 \u0623\u0628\u064a \u0647\u0631\u064a\u0631\u0629 \u0642\u0627\u0644: \u0625\u0646 \u0627\u0644\u0646\u0627\u0633 \u064a\u0642\u0648\u0644\u0648\u0646 \u0623\u0643\u062b\u0631 \u0623\u0628\u0648 \u0647\u0631\u064a\u0631\u0629\u060c \u0648\u0625\u0646 \u0623\u0628\u0627 \u0647\u0631\u064a\u0631\u0629 \u0643\u0627\u0646 \u064a\u0644\u0632\u0645 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0628\u0634\u0628\u0639 \u0628\u0637\u0646\u0647. \u0648\u0637\u0648\u0644 \u0627\u0644\u0635\u062d\u0628\u0629 \u0643\u0627\u0646 \u0633\u0628\u0628\u0627 \u0641\u064a \u0643\u062b\u0631\u0629 \u0631\u0648\u0627\u064a\u062a\u0647.';
      const rec = { id: 'F9', term: '\u0645\u0644\u0627\u0632\u0645\u0629', part: 38, snippet: ROW, text: ROW };
      const REASON = '\u0648\u0637\u0648\u0644 \u0627\u0644\u0635\u062d\u0628\u0629 \u0643\u0627\u0646 \u0633\u0628\u0628\u0627 \u0641\u064a \u0643\u062b\u0631\u0629 \u0631\u0648\u0627\u064a\u062a\u0647 [[1]].';
      const NARRATION = '\u0631\u0648\u0649 \u0623\u0628\u0648 \u0647\u0631\u064a\u0631\u0629 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647: \u00ab\u0625\u0646 \u0627\u0644\u0646\u0627\u0633 \u064a\u0642\u0648\u0644\u0648\u0646 \u0623\u0643\u062b\u0631 \u0623\u0628\u0648 \u0647\u0631\u064a\u0631\u0629\u060c \u0648\u0625\u0646 \u0623\u0628\u0627 \u0647\u0631\u064a\u0631\u0629 \u0643\u0627\u0646 \u064a\u0644\u0632\u0645 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0628\u0634\u0628\u0639 \u0628\u0637\u0646\u0647\u00bb [[1]].';
      const run12 = async (writer) => {
        const target = makeTarget();
        const facade = SSE.createFinalizedSseResponse(target, { finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }) });
        const out = await BW2.runBw2Turn({
          question: Q9, messages: [{ role: 'user', content: 'x' }], wire: BW2.createBw2Wire(facade), continueWhenNotCovered: true,
          deps: {
            runTool: async () => ({ text: '', added: [], calls: 0 }), searchStoredCorpus: async () => ({ records: [rec] }),
            encyclopediaReady: () => true, warmEncyclopedia: () => true, ask: async () => '{"d":{"1":1}}',
            callWriter: async ({ onText }) => { onText(writer); return { stop_reason: 'end_turn', usage: {} }; },
          },
        });
        return { out, text: framesOf(target.writes).filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
      };
      const r = await run12(REASON);
      ok('P12b question 9\'s shape: the reasons without his narration are not sent, and the turn goes on by itself',
        r.out.continued === true && r.text === '', ascii(JSON.stringify({ c: r.out.continued, text: r.text.slice(0, 60), held: r.out.telemetry.unitsHeld })));
      const n = await run12([NARRATION, REASON].join('\n'));
      ok('P12c his narration, carried by the row, goes out first; the reasons after it go out as today',
        !n.out.continued && n.text.includes('\u0628\u0634\u0628\u0639 \u0628\u0637\u0646\u0647') && n.text.includes('\u0643\u062b\u0631\u0629 \u0631\u0648\u0627\u064a\u062a\u0647') && n.text.indexOf('\u0628\u0634\u0628\u0639 \u0628\u0637\u0646\u0647') < n.text.indexOf('\u0643\u062b\u0631\u0629 \u0631\u0648\u0627\u064a\u062a\u0647'),
        ascii(JSON.stringify({ c: n.out.continued, text: n.text.slice(0, 80), holds: n.out.telemetry })));
    }

    // P3c/P3d: the real handler. Every source is empty or refused and the judge keeps nothing, so the
    // before-writing path finds no text; today's path must then run by itself, first round forced to search.
    const LEDGER_REDIS = await esm('lib/ledger/redis.js');
    const DAYCAP = await esm('lib/daycap.js');
    const FLAG = await esm('lib/ledger/flag.js');
    const LEGACY = await esm('lib/legacy-policy-flag.js');
    const CONSENT = await esm('lib/ai-consent.js');
    const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
      'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
      'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
      'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE'];
    const saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    const realFetch = globalThis.fetch;
    const capCounts = new Map();
    const ANSWER = '\u062a\u0635\u0644\u0649 \u0635\u0644\u0627\u0629 \u0627\u0644\u062e\u0648\u0641 \u0639\u0644\u0649 \u0635\u0641\u0627\u062a \u0648\u0631\u062f\u062a \u0628\u0647\u0627 \u0627\u0644\u0633\u0646\u0629.';
    const jsonResponse = (url, o, status = 200) => ({
      ok: status >= 200 && status < 300, status, url: String(url),
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => o, text: async () => JSON.stringify(o),
    });
    let ip = 0;
    const drive = async (question) => {
      for (const k of ENV_KEYS) delete process.env[k];
      Object.assign(process.env, { ANTHROPIC_API_KEY: 'guard-not-a-real-key', BRAVE_API_KEY: 'guard-not-a-real-key', LEDGER_RAG: 'off', FREE_BRAIN_V1: 'on' });
      LEDGER_REDIS.__setRedisForTest(null);
      FLAG.__resetFlagCacheForTest();
      LEGACY.__resetLegacyFlagCacheForTest();
      capCounts.clear();
      DAYCAP.__setRedisForTest({
        async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
        async sismember() { return 0; },
        pipeline() {
          const ops = [];
          return { incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
            expire() { ops.push(() => 1); }, async exec() { return ops.map((f) => f()); } };
        },
      });
      const model = [];
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.includes('api.anthropic.com')) {
          const b = JSON.parse(init.body);
          model.push(b);
          if (b.system === BW2.BW2_JUDGE_SYSTEM) return jsonResponse(u, { content: [{ type: 'text', text: '{"d":{}}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
          return jsonResponse(u, { content: [{ type: 'text', text: ANSWER }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
        return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
      };
      const res = makeTarget();
      ip += 1;
      const req = { method: 'POST',
        headers: { 'x-murabbi-device': 'speed-pipes-guard-' + String(ip).padStart(4, '0'), 'x-real-ip': '10.18.0.' + ip,
          [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
        body: { messages: Array.isArray(question) ? question : [{ role: 'user', content: question }], band: 'adult', age: 35 } };
      const logs = [];
      const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
      console.log = (...a) => { logs.push(a); };
      console.warn = () => {}; console.error = () => {}; console.info = () => {};
      let crashed = null;
      try { await ASK.default(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
      globalThis.fetch = realFetch;
      const frames = framesOf(res.writes);
      const logOf = (tag) => (logs.find((a) => a[0] === tag) || [])[1] || null;
      return { res, frames, model, logOf, crashed, text: frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text).join('') };
    };
    try {
      const d = await drive(Q2);
      const t = d.logOf('[bw2]');
      const worked = d.model.filter((b) => b.system !== BW2.BW2_JUDGE_SYSTEM);
      ok('P3c question 2 through the real handler: no source row (or the judge keeps none), the turn goes on by itself -- no not-covered sentence, no offer',
        !d.crashed && t && ['no_rows', 'judge_none'].includes(t.continued) && !d.frames.some((f) => f.type === 'ezik_live_offer')
        && !d.text.includes(NOT_COVERED) && d.res.ended === 1,
        ascii(JSON.stringify({ t: t && t.continued, frames: d.frames.map((f) => f.type + (f.stage ? ':' + f.stage : '')), crashed: d.crashed && String(d.crashed.stack) })));
      const stages = d.frames.filter((f) => f.type === 'ezik_status').map((f) => f.stage);
      ok('P3d ...today\'s path answers it, its first round forced to search_sources, and the reader\'s line reads "searching" again before its text',
        worked[0] && worked[0].tool_choice && worked[0].tool_choice.name === 'search_sources' && stages[stages.length - 1] === 'retrieve'
        && stages.lastIndexOf('retrieve') > stages.indexOf('fatwa') && stages.indexOf('fatwa') > 0 && d.text.includes(ANSWER),
        ascii(JSON.stringify({ stages, first: worked[0] && worked[0].tool_choice, text: d.text.slice(0, 80) })));

      // P8: question 29-b -- the source of the previous answer, from that answer's own cards.
      const SF = await esm('lib/source-followup.js');
      const Q29A = '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u061f';
      const Q29B = '\u0645\u0627 \u0645\u0635\u062f\u0631\u0643 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628\u061f';
      const PREV = '\u0641\u0630\u0647\u0628 \u0628\u0639\u0636\u0647\u0645 \u0625\u0644\u0649 \u0623\u0646\u0647 \u063a\u064a\u0631 \u062c\u0627\u0626\u0632 \u0625\u0644\u0627 \u0644\u0644\u062d\u0627\u062c\u0629\u060c \u0641\u0642\u062f \u0642\u0627\u0644 \u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a: \u0625\u0630\u0627 \u0643\u0627\u0646 \u062a\u0635\u0648\u064a\u0631\u0627 \u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u0627 \u062d\u064a\u062b \u0644\u0627 \u0641\u0627\u0626\u062f\u0629 \u0644\u0627 \u064a\u062c\u0648\u0632.\n'
        + '<source site="mostafaaladwy.com" url="https://mostafaaladwy.com/fatwa/4455">\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u061f</source>\n'
        + '\u0648\u0642\u0627\u0644\u062a \u0627\u0644\u0644\u062c\u0646\u0629 \u0627\u0644\u062f\u0627\u0626\u0645\u0629: \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a \u0627\u0644\u0634\u0645\u0633\u064a \u0645\u0646 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u0645\u062d\u0631\u0645.\n'
        + '<book author="\u0627\u0644\u0644\u062c\u0646\u0629 \u0627\u0644\u062f\u0627\u0626\u0645\u0629 \u0644\u0644\u0628\u062d\u0648\u062b \u0627\u0644\u0639\u0644\u0645\u064a\u0629 \u0648\u0627\u0644\u0625\u0641\u062a\u0627\u0621" ref="\u062c1 \u00b7 \u0635668-669">\u0641\u062a\u0627\u0648\u0649 \u0627\u0644\u0644\u062c\u0646\u0629 \u0627\u0644\u062f\u0627\u0626\u0645\u0629 - 1</book>\n'
        + '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0639\u062b\u064a\u0645\u064a\u0646: \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0627\u0644\u062d\u062f\u064a\u062b \u0644\u064a\u0633 \u062a\u0635\u0648\u064a\u0631\u0627 \u0641\u064a \u0627\u0644\u062d\u0642\u064a\u0642\u0629.\n'
        + '<book author="\u0627\u0628\u0646 \u0639\u062b\u064a\u0645\u064a\u0646" ref="\u062c2 \u00b7 \u0635262">\u0645\u062c\u0645\u0648\u0639 \u0641\u062a\u0627\u0648\u0649 \u0648\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0639\u062b\u064a\u0645\u064a\u0646</book>\n'
        + '<source site="bad.test" url="javascript:alert(1)">x</source>';
      ok('P8a the source follow-up is a closed, short grammar: 29-b and its siblings in, a question about "sources of legislation" and "the evidence" out',
        [Q29B, '\u0645\u0627 \u0645\u0635\u062f\u0631\u0643\u061f', '\u0645\u0646 \u0623\u064a\u0646 \u0623\u062e\u0630\u062a \u0647\u0630\u0627 \u0627\u0644\u0643\u0644\u0627\u0645\u061f', '\u0648\u0634 \u0645\u0635\u062f\u0631\u0643 \u064a\u0627 \u0634\u064a\u062e'].every((q) => SF.asksPreviousSource(q))
        && !SF.asksPreviousSource('\u0645\u0627 \u0645\u0635\u062f\u0631 \u0627\u0644\u062a\u0634\u0631\u064a\u0639 \u0641\u064a \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u061f') && !SF.asksPreviousSource('\u0645\u0627 \u0627\u0644\u062f\u0644\u064a\u0644\u061f') && !SF.asksPreviousSource(Q29A));
      const s = await drive([{ role: 'user', content: Q29A }, { role: 'assistant', content: PREV }, { role: 'user', content: Q29B }]);
      ok('P8b through the real handler: answered at once from the previous answer\'s three cards, each under the name that answer gave -- no model call',
        !s.crashed && s.model.length === 0 && s.text.startsWith(SF.SOURCE_FOLLOWUP_LEAD)
        && ['\u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a', '\u0627\u0644\u0644\u062c\u0646\u0629 \u0627\u0644\u062f\u0627\u0626\u0645\u0629', '\u0627\u0628\u0646 \u0639\u062b\u064a\u0645\u064a\u0646'].every((n) => s.text.includes(n + '\n<'))
        && (s.text.match(/<source |<book /g) || []).length === 3 && !s.text.includes('\u0628\u0639\u0636 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645') && !s.text.includes('javascript:')
        && s.res.ended === 1, ascii(JSON.stringify({ model: s.model.length, text: s.text.slice(0, 160), crashed: s.crashed && String(s.crashed.stack) })));
      const n = await drive([{ role: 'user', content: Q29A }, { role: 'assistant', content: '\u062c\u0648\u0627\u0628 \u0628\u0644\u0627 \u0628\u0637\u0627\u0642\u0629.' }, { role: 'user', content: Q29B }]);
      ok('P8c a previous answer with no card leaves the question on the ordinary path (the model is called)',
        !n.crashed && n.model.length > 0 && !n.text.startsWith(SF.SOURCE_FOLLOWUP_LEAD));

      // P9 (PIPES2 fix 1): round 7, question 11-b -- the source follow-up in any wording, not a list of wordings.
      const Q11B = '\u0645\u0627 \u0627\u0644\u0645\u0631\u0627\u062c\u0639 \u0627\u0644\u062a\u064a \u0627\u0639\u062a\u0645\u062f\u062a \u0639\u0644\u064a\u0647\u0627 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628\u061f';
      const SIBS = ['\u0645\u0627 \u0647\u064a \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u064a \u0627\u0633\u062a\u0646\u062f\u062a \u0625\u0644\u064a\u0647\u0627\u061f', '\u0627\u0630\u0643\u0631 \u0644\u064a \u0645\u0635\u0627\u062f\u0631\u0643',
        '\u0639\u0644\u0649 \u0645\u0627\u0630\u0627 \u0627\u0639\u062a\u0645\u062f\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062c\u0648\u0627\u0628\u061f', '\u0648\u0634 \u0627\u0644\u0645\u0631\u0627\u062c\u0639 \u0627\u0644\u0644\u064a \u0631\u062c\u0639\u062a \u0644\u0647\u0627\u061f', '\u0645\u0645\u0643\u0646 \u062a\u0639\u0637\u064a\u0646\u064a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u061f'];
      const NOT = ['\u0645\u0627 \u0645\u0635\u062f\u0631 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b\u061f', '\u0645\u0627 \u0627\u0644\u0645\u0631\u0627\u062c\u0639 \u0641\u064a \u0627\u0644\u0641\u0642\u0647 \u0627\u0644\u062d\u0646\u0628\u0644\u064a\u061f',
        '\u0645\u0627 \u0645\u0635\u062f\u0631 \u0627\u0644\u062d\u0643\u0645 \u0628\u062a\u062d\u0631\u064a\u0645 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649\u061f', '\u0647\u0644 \u0631\u062c\u0639\u062a\u061f'];
      ok('P9a 11-b and its siblings are follow-ups about the answer; a hadith\'s source, a subject\'s references and "did you return?" are not',
        SF.asksPreviousSource(Q11B) && SIBS.every((q) => SF.asksPreviousSource(q)) && NOT.every((q) => !SF.asksPreviousSource(q)),
        ascii(JSON.stringify([Q11B, ...SIBS, ...NOT].map((q) => SF.asksPreviousSource(q)))));
      const Q11A = '\u0645\u0627 \u062d\u0643\u0645 \u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0648\u062d\u062f\u0647\u061f';
      const PREV11 = '\u0644\u0627 \u064a\u062c\u0648\u0632 \u062a\u062e\u0635\u064a\u0635 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0628\u0627\u0644\u0635\u0648\u0645 \u062a\u0637\u0648\u0639\u0627 \u0648\u062d\u062f\u0647.\n'
        + '<source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/5710">\u062d\u0643\u0645 \u062a\u062e\u0635\u064a\u0635 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0628\u0627\u0644\u0635\u0648\u0645</source>\n'
        + '\u0623\u0645\u0627 \u0625\u0630\u0627 \u0635\u0627\u0645 \u0645\u0639\u0647 \u064a\u0648\u0645\u0627 \u0642\u0628\u0644\u0647 \u0641\u0644\u0627 \u062d\u0631\u062c.\n'
        + '<source site="sh-albarrak.com" url="https://sh-albarrak.com/article/1">\u062d\u0643\u0645 \u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629</source>\n'
        + '<source site="salmajed.com" url="https://salmajed.com/fatwa/2">\u0635\u064a\u0627\u0645 \u064a\u0648\u0645 \u0627\u0644\u062c\u0645\u0639\u0629 \u0648\u062d\u062f\u0647 \u0625\u0630\u0627 \u0648\u0627\u0641\u0642 \u064a\u0648\u0645 \u0639\u0631\u0641\u0629</source>\n'
        + '<book author="\u0646\u0627\u0635\u0631 \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0623\u0644\u0628\u0627\u0646\u064a" ref="">\u062c\u0627\u0645\u0639 \u062a\u0631\u0627\u062b \u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0623\u0644\u0628\u0627\u0646\u064a \u0641\u064a \u0627\u0644\u0641\u0642\u0647</book>';
      const e = await drive([{ role: 'user', content: Q11A }, { role: 'assistant', content: PREV11 }, { role: 'user', content: Q11B }]);
      ok('P9b 11-b through the real handler: no model call; every card of the previous answer, binbaz.org.sa first, and no name the answer did not give',
        !e.crashed && e.model.length === 0 && e.text.startsWith(SF.SOURCE_FOLLOWUP_LEAD) && (e.text.match(/<source |<book /g) || []).length === 4
        && e.text.indexOf('binbaz.org.sa') > 0 && e.text.indexOf('binbaz.org.sa') < e.text.indexOf('salmajed.com') && !e.text.includes('\u0633\u0639\u062f')
        && e.res.ended === 1, ascii(JSON.stringify({ model: e.model.length, text: e.text.slice(0, 160), crashed: e.crashed && String(e.crashed.stack) })));
    } finally {
      globalThis.fetch = realFetch;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
  }
  process.exit(finish());
})().catch((error) => {
  ok('guard completed without exception', false, error && error.stack ? error.stack : String(error));
  process.exit(finish());
});
