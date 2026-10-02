// guards/speed-bw2-guard.cjs -- SPEED ITEM 17, STAGE 3: THE BEFORE-WRITING PATH (BEFORE_WRITING_V2).
//
// WHAT THIS PROVES, WITH NO NETWORK AND NO MODEL. Every adapter (fatwa, library, encyclopedia,
// lessons), the judge and the writer are fakes handed in through `deps`; the four T9 cases drive the
// REAL api/ask.js handler with one fake globalThis.fetch. The wire is always the real one: the BW2 wire
// (lib/before-writing-v2.js createBw2Wire) over the real finalizing facade
// (lib/finalized-sse-writer.js), read back from a fake socket frame by frame.
//
//   T1  status frames come before the first text delta, and none after it
//   T2  exactly one writer call and zero retries
//   T3  an unsupported unit in the middle is held; the units before and after it go out, in order
//   T4  the final text equals the concatenation of the released deltas, byte for byte, on 24
//       fixtures that include cards, takhrij units and lead-ins, each streamed in odd-sized chunks
//   T5  a card tag goes out whole, in one delta, right after its unit
//   T6  an empty table gives the not-covered sentence and ezik_live_offer, and no attributed unit
//   T7  a hanging adapter does not delay the writer beyond BW2_RETRIEVAL_MS + 250 ms
//   T8  the judge is shown a decisive passage that starts after character 360; a decision set
//       missing one id keeps none of the missing
//   T9  liveSearch: true takes today's path with a forced first-round search; BEFORE_WRITING_V2=off
//       takes today's path; a minor takes today's path; a closed-deen question stays closed-deen
//   T10 telemetry carries numbers and enums only: a question containing digits leaks into no field
//
// SPEED FIX 1 (order EZIK-SPEED-FIX1-ORDER-2026-09-27), built from the owner tool's exact text of the
// preview's questions 16, 9, 4 and 11 (guards/fixtures-speed-fix1.json):
//   R1  an adhkar question (q16) and three siblings take today's path, through the real handler
//   R2  an estate division (q9) and three siblings take today's path, through the real handler
//   R3  the writer's marker (or its own not-covered sentence) releases exactly the sentence once and
//       the offer; nothing it wrote before or after goes out
//   R4  a group attribution (q4) with no [[n]], or cited to rows that do not name the group, is held;
//       BW2_HOLD_UNCITED_RULINGS (default off) holds an uncited ruling unit in STORED_FIQH only
//   R5  a unit that leans on a held one (q11's orphan quote) is held, and no answer opens on one
//
// SPEED FIX 2 (order EZIK-SPEED-FIX2B-ORDER-2026-09-27), built from the owner tool's question 6 and the
// live-search answer after it (EZIK-SPEED-PREVIEW2-LIVE-2026-09-27):
//   C1  a matn a cited row carries (spacing-free fold, at least 12 letters) is released on that row though
//       the takhrij lookup matched nothing; one no row carries stays held; R5 and the lead-in hold around it
//   C2  a cold encyclopedia costs at most BW2_ENCYC_COLD_MS (300), its build goes on in the background, and
//       the warm path is as before
//   C3  the new telemetry: writer start, first token, holds before the first release and by reason, the
//       marker, the takhrij lookups, the pinned table, the cold encyclopedia
//
// SPEED FIX 3 (order EZIK-SPEED-FIX3-ORDER-2026-09-27), built from the owner tool's round-3 question 1 and the
// live-search answer after it (EZIK-SPEED-PREVIEW3-CHAT-2026-09-27):
//   C4  a unit that attributes a hadith to a collection or a narrator is proved before it is held: released
//       on the kept row that carries the text and every name, or on the takhrij's proof; no not-covered
//       sentence because of it; the wrong collection, a scholar with no row, a failed lookup and the R5 and
//       lead-in rules hold as today
//
// SPEED FIX 4 (order EZIK-SPEED-FIX4-ORDER-2026-09-27), built from the owner tool's round-4 question 2 and its answer 2
// (EZIK-SPEED-PREVIEW4-LIVE-2026-09-27), with the local library index's own rows for that hadith:
//   C5  a unit that opens by pointing back ("and in this meaning also ...") is held at the opening and after a held
//       unit, and goes out after a released one; a demonstrative after the unit's own matn does not make it dependent
//   C6  the answering units go out on the row that carries them (a credit ending on "'an", Anas as the subject, a
//       nisba the row does not write); a narrator the row lacks, another lineage and the wrong collection stay held
//
// SPEED FIX 5 (order EZIK-SPEED-FIX5-ORDER-2026-09-27), built from the owner tool's round-5 questions 3 and 4 and answer 4
// (EZIK-SPEED-PREVIEW5-LIVE-2026-09-27), with the local library index's own rows for question 4 and question 3:
//   C7  a question about a hadith's source is answered first or not at all: the side unit is held at the opening, the
//       proved answering unit goes out first and the side unit may follow; no proof, the not-covered sentence alone;
//       "this hadith" opening a proved unit goes out first; a grading question, a question naming no hadith and a
//       fiqh answer are outside it; FIX3's and FIX4's fixtures release the same bytes. The R5 (q11), C1 (q6) and C5d
//       runs whose questions are source questions ask about the same hadith's meaning, and C7i pins what the source
//       questions themselves now give
//   C8  the readers: a kunya holding a collection's word, a kunya's case, "rawa hadha al-hadith X" / "rawahu huwa X",
//       and the question's own credit ("... fi al-sahihayn") read out of its hadith
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { harness } = require('./output-reviewer-mutant-lib.cjs');

const { ok, finish } = harness('speed-bw2');
const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const ascii = (s) => String(s).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 300);

// -- fixtures (Arabic written as escapes: this file stays ASCII) -------------------------------
const Q_MASAH = '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628\u061f';
const MASAH_RULING = '\u064a\u062c\u0648\u0632 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u0625\u0630\u0627 \u0644\u0628\u0633\u0647\u0627 \u0639\u0644\u0649 \u0637\u0647\u0627\u0631\u0629';
const MASAH_TERM = '\u0648\u0645\u062f\u062a\u0647 \u064a\u0648\u0645 \u0648\u0644\u064a\u0644\u0629 \u0644\u0644\u0645\u0642\u064a\u0645 \u0648\u062b\u0644\u0627\u062b\u0629 \u0623\u064a\u0627\u0645 \u0628\u0644\u064a\u0627\u0644\u064a\u0647\u0627 \u0644\u0644\u0645\u0633\u0627\u0641\u0631';
const FASTING_MATN = '\u0645\u0646 \u0646\u0633\u064a \u0648\u0647\u0648 \u0635\u0627\u0626\u0645 \u0641\u0623\u0643\u0644 \u0623\u0648 \u0634\u0631\u0628 \u0641\u0644\u064a\u062a\u0645 \u0635\u0648\u0645\u0647\u060c \u0641\u0625\u0646\u0645\u0627 \u0623\u0637\u0639\u0645\u0647 \u0627\u0644\u0644\u0647 \u0648\u0633\u0642\u0627\u0647';
const HANABILA = '\u0627\u0644\u062d\u0646\u0627\u0628\u0644\u0629';
const IBN_BAZ = '\u0627\u0628\u0646 \u0628\u0627\u0632';

const ROW_F1 = {
  kind: 'fatwa', title: '\u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628',
  url: 'https://binbaz.org.sa/fatwas/1234', publisher: IBN_BAZ, scholarId: 'binbaz', recordId: '1234',
  text: '\u0627\u0644\u0633\u0624\u0627\u0644: ' + Q_MASAH + ' \u0627\u0644\u062c\u0648\u0627\u0628: ' + MASAH_RULING + '\u060c ' + MASAH_TERM + '.',
  passage: '\u0627\u0644\u0633\u0624\u0627\u0644: ' + Q_MASAH + '\n\u0627\u0644\u062c\u0648\u0627\u0628: ' + MASAH_RULING + '\u060c ' + MASAH_TERM + '.',
};
const ROW_F2 = {
  kind: 'fatwa', title: '\u062d\u0643\u0645 \u0645\u0646 \u0623\u0643\u0644 \u0646\u0627\u0633\u064a\u0627 \u0641\u064a \u0631\u0645\u0636\u0627\u0646',
  url: 'https://binbaz.org.sa/fatwas/5678', publisher: IBN_BAZ, scholarId: 'binbaz', recordId: '5678',
  text: '\u0635\u0648\u0645\u0647 \u0635\u062d\u064a\u062d \u0644\u0642\u0648\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab' + FASTING_MATN + '\u00bb.',
  passage: '\u0635\u0648\u0645\u0647 \u0635\u062d\u064a\u062d \u0644\u0642\u0648\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab' + FASTING_MATN + '\u00bb.',
};
const ROW_L1 = {
  kind: 'lib_book', title: '\u0627\u0644\u0645\u063a\u0646\u064a \u2014 \u062c1 \u2014 \u063513', url: '',
  bookTitle: '\u0627\u0644\u0645\u063a\u0646\u064a', author: '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629',
  publisher: '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629', recordId: 'FC-003727:0001', locator: '\u062c1 \u2014 \u063513',
  text: '\u0648\u0630\u0647\u0628 ' + HANABILA + ' \u0625\u0644\u0649 \u062c\u0648\u0627\u0632 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0631\u0628\u064a\u0646 \u0625\u0630\u0627 \u0643\u0627\u0646\u0627 \u0635\u0641\u064a\u0642\u064a\u0646.',
};

// Writer units. [[1]] = F1, [[2]] = F2, [[3]] = L1 (the pinned table assigns refs in that order).
const U = {
  s1: MASAH_RULING + ' [[1]].',
  s2: '\u0642\u0627\u0644 \u0627\u0644\u0634\u064a\u062e ' + IBN_BAZ + ': ' + MASAH_RULING + ' [[1]].',
  s3: MASAH_TERM + ' [[1]].',
  bad: '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0625\u0646 \u0627\u0644\u0645\u0633\u062d \u0644\u0627 \u064a\u0635\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u0627\u0644\u0631\u0642\u064a\u0642\u0629.',
  plain: '\u0648\u0647\u0630\u0647 \u0631\u062e\u0635\u0629 \u0645\u0646 \u0627\u0644\u062a\u064a\u0633\u064a\u0631.',
  lead: '\u0648\u0642\u062f \u0633\u064f\u0626\u0644 \u0627\u0644\u0634\u064a\u062e ' + IBN_BAZ + ' \u0639\u0646 \u0630\u0644\u0643 \u0641\u0642\u0627\u0644:\n\u00ab' + MASAH_RULING + '\u00bb [[1]].',
  badLead: '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629:\n\u00ab\u0644\u0627 \u064a\u0635\u062d \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u0627\u0644\u0631\u0642\u064a\u0642\u0629\u00bb.',
  matn: '\u0648\u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b: \u00ab' + FASTING_MATN + '\u00bb [[2]].',
  badMatn: '\u0648\u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b: \u00ab\u0645\u0646 \u0645\u0633\u062d \u0639\u0644\u0649 \u062c\u0648\u0631\u0628\u064a\u0647 \u063a\u0641\u0631 \u0644\u0647 \u0645\u0627 \u062a\u0642\u062f\u0645 \u0645\u0646 \u0630\u0646\u0628\u0647\u00bb.',
  book: '\u0648\u0630\u0647\u0628 ' + HANABILA + ' \u0625\u0644\u0649 \u062c\u0648\u0627\u0632 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0631\u0628\u064a\u0646 [[3]].',
  consensus: '\u0648\u0623\u062c\u0645\u0639 \u0627\u0644\u0639\u0644\u0645\u0627\u0621 \u0639\u0644\u0649 \u0630\u0644\u0643 [[1]].',
  list: '1. \u0623\u0646 \u064a\u0644\u0628\u0633\u0647\u0645\u0627 \u0639\u0644\u0649 \u0637\u0647\u0627\u0631\u0629 [[1]].\n2. \u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u062a\u064a\u0645\u064a\u0629 \u0625\u0646 \u0630\u0644\u0643 \u0644\u0627 \u064a\u0635\u062d.\n3. ' + MASAH_TERM + ' [[1]].',
};

// COMPREHENSIVE 3.4h: the unit that OPENS the answer after a held one has lost the «\u0648» it carried (lib/opening-conjunction.js); these rows compare without it.
const noWaw = (t) => String(t).replace(/^\u0648/u, '');

const TAKHRIJ_PAREN = ' (\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645)';

// -- the fake socket, and the real facade + BW2 wire over it -------------------------------------
function makeTarget() {
  return {
    writes: [], ended: 0, statusCode: 0, headers: {},
    write(chunk) { this.writes.push(String(chunk)); return true; },
    end(cb) { this.ended += 1; if (typeof cb === 'function') cb(); return this; },
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    once() { return this; }, on() { return this; }, removeListener() { return this; },
  };
}
function framesOf(target) {
  return target.writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
    .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
}
const deltasOf = (frames) => frames.filter((f) => f.type === 'content_block_delta').map((f) => f.delta.text);

(async () => {
  const BW2 = await esm('lib/before-writing-v2.js');
  const SSE = await esm('lib/finalized-sse-writer.js');
  const TOOLS = await esm('lib/free-brain/tools.js');
  const ASK = await esm('api/ask.js');
  const NOT_COVERED = BW2.BW2_NOT_COVERED;

  function makeWire() {
    const target = makeTarget();
    const facade = SSE.createFinalizedSseResponse(target, {
      // api/ask.js's BW2 finalize: the released text, unchanged.
      finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [], replaced: false, drops: [], degraded: [] }),
      context: () => ({ allowWireOwnedCards: true, sourceCards: [], readerCards: [], readerPrefix: '', readerSuffix: '' }),
      failureText: 'FACADE-FAILURE',
    });
    return { target, wire: BW2.createBw2Wire(facade) };
  }

  // A deterministic chunker: the writer's text arrives in pieces of 1..17 characters.
  const chunk = (text, seed) => {
    const out = [];
    let x = seed * 7919 + 13;
    for (let i = 0; i < text.length;) {
      x = (x * 1103515245 + 12345) % 2147483648;
      const n = 1 + (x % 17);
      out.push(text.slice(i, i + n));
      i += n;
    }
    return out;
  };

  function makeDeps({ fatwa = [ROW_F1, ROW_F2], library = [], encyclopedia = [], lessons = [], hang = {},
    judge = 'all', writerText = '', seed = 1, takhrij = false, writerThrows = false,
    takhrijImpl = null, encyclopediaReady = () => true, warm = null, gradingHead = undefined } = {}) {
    const calls = { writer: 0, ask: 0, askUser: '', writerBody: null, writerAt: null, tools: [], search: 0, warm: 0 };
    const started = Date.now();
    const deps = {
      runTool: (name, input, ctx) => {
        calls.tools.push(name);
        const source = name === 'search_fatawa' ? 'fatwa' : name === 'search_library' ? 'library'
          : name === 'search_lessons' ? 'lessons' : name;
        if (hang[source]) return new Promise(() => {});
        const rows = source === 'fatwa' ? fatwa : source === 'library' ? library : source === 'lessons' ? lessons : [];
        const added = rows.map((row) => ctx.table.add({ ...row }));
        return Promise.resolve({ text: '', added, calls: 1 });
      },
      searchStoredCorpus: () => {
        calls.search += 1;
        return hang.encyclopedia ? new Promise(() => {}) : Promise.resolve({ records: encyclopedia });
      },
      warmEncyclopedia: () => { calls.warm += 1; return warm ? warm() : Promise.resolve(true); },
      encyclopediaReady,
      encyclopediaRow: TOOLS.encyclopediaRow,
      ask: async ({ user, maxTokens }) => {
        calls.ask += 1;
        calls.askUser = user;
        calls.askMaxTokens = maxTokens;
        const count = (user.match(/^\[\d+\] /gmu) || []).length;
        if (typeof judge === 'function') return judge(count, user);
        if (judge === 'none') return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i + 1), 0])) });
        return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i + 1), 1])) });
      },
      callWriter: async ({ body, onText }) => {
        calls.writer += 1;
        calls.writerAt = Date.now() - started;
        calls.writerBody = body;
        if (writerThrows) throw new Error('upstream 529');
        for (const piece of chunk(writerText, seed)) onText(piece);
        return { usage: { input_tokens: 1200, output_tokens: 340 }, stop_reason: 'end_turn', content: [] };
      },
      applyTakhrij: takhrijImpl || (takhrij ? async (text) => {
        if (!text.includes(FASTING_MATN)) return { text, entries: [] };
        const at = text.indexOf('\u00bb', text.indexOf(FASTING_MATN)) + 1;
        return {
          text: text.slice(0, at) + TAKHRIJ_PAREN + text.slice(at),
          entries: [{ matn: FASTING_MATN, sourced: true, sealProof: ['\u0635\u062d\u064a\u062d \u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0635\u062d\u064a\u062d \u0645\u0633\u0644\u0645'], proseProof: ['\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0645\u0633\u0644\u0645'] }],
        };
      } : undefined),
      runnerLookup: () => async () => [],
      // FIX 48 item 6: the head of a grade question, computed beside the retrieval; absent = the real function (never reached by these rows)
      ...(gradingHead ? { gradingHeadForQuestion: gradingHead } : {}),
    };
    return { deps, calls };
  }

  const cards = {
    buildSourceTag: ASK.buildSourceTag, buildBookTag: ASK.buildBookTag, encyclopediaCards: false, max: 3,
  };

  async function run(opts = {}) {
    const { deps, calls } = makeDeps(opts);
    const { target, wire } = makeWire();
    // What the path RELEASED, recorded outside it: every piece it handed the wire, in order.
    const pieces = [];
    const realDelta = wire.delta.bind(wire);
    wire.delta = (piece) => { const sent = realDelta(piece); if (sent && piece) pieces.push(String(piece)); return sent; };
    const out = await BW2.runBw2Turn({
      question: opts.question || Q_MASAH,
      messages: [{ role: 'user', content: opts.question || Q_MASAH }],
      mode: 'brief', band: 'adult', system: 'SYSTEM', model: 'writer-model', maxTokens: 4096,
      providerUrl: 'https://api.anthropic.invalid/v1/messages', headers: {},
      libFlagValue: opts.libOn ? 'on' : '', libToken: opts.libOn ? 'guard-token' : '', lessonsToken: '',
      takhrijWired: !!opts.takhrij || !!opts.takhrijImpl, cards, wire, requestStartedAt: Date.now(),
      env: { BW2_RETRIEVAL_MS: String(opts.budget || 400), BW2_JUDGE_MS: '400', ...(opts.env || {}) },
      runtime: opts.runtime || '',
      deps,
    });
    const frames = framesOf(target);
    return { out, frames, deltas: deltasOf(frames), calls, target, pieces };
  }

  const firstDeltaIndex = (frames) => frames.findIndex((f) => f.type === 'content_block_delta');
  const statusIdx = (frames) => frames.map((f, i) => (f.type === 'ezik_status' ? i : -1)).filter((i) => i >= 0);

  try {
    console.log('\n=== speed-bw2 -- the before-writing path (BEFORE_WRITING_V2) ===');

    // ---------------------------------------------------------------- T1
    {
      const r = await run({ writerText: [U.s1, U.plain, U.s3].join(' ') });
      const fd = firstDeltaIndex(r.frames);
      const st = statusIdx(r.frames);
      const stages = st.map((i) => r.frames[i].stage);
      ok('T1a status frames exist and all come before the first text delta',
        fd > 0 && st.length >= 3 && st.every((i) => i < fd), JSON.stringify({ fd, st, stages }));
      ok('T1b none after it', !r.frames.slice(fd).some((f) => f.type === 'ezik_status'));
      ok('T1c the stages run retrieve -> sources -> judge -> write, write last',
        stages[0] === 'retrieve' && stages[stages.length - 1] === 'write' && stages.includes('judge')
        && stages.indexOf('judge') < stages.indexOf('write'), JSON.stringify(stages));
      const src = r.frames.filter((f) => f.type === 'ezik_status' && BW2.BW2_SOURCES.includes(f.stage));
      ok('T1d one frame per source that returned, each with an integer hit count; none on the other stages',
        src.length === 4 && src.every((f) => Number.isInteger(f.hits))
        && r.frames.filter((f) => f.type === 'ezik_status' && !BW2.BW2_SOURCES.includes(f.stage)).every((f) => !('hits' in f)),
        JSON.stringify(src));
      ok('T1e the wire refuses a status frame once text has started', r.out && (() => {
        const { wire } = makeWire();
        wire.status('retrieve');
        wire.delta('x');
        return wire.status('judge') === false;
      })());
    }

    // ---------------------------------------------------------------- T2
    {
      const r = await run({ writerText: [U.s1, U.bad, U.s3].join(' ') });
      ok('T2a exactly one writer call', r.calls.writer === 1 && r.out.telemetry.writerCalls === 1, JSON.stringify(r.calls.writer));
      ok('T2b exactly one judge call, and no other model call (no citation, rewrite, hollow or ascription retry)',
        r.calls.ask === 1, String(r.calls.ask));
      ok('T2c the one writer call streams, carries no tools and no tool_choice',
        r.calls.writerBody && !('tools' in r.calls.writerBody) && !('tool_choice' in r.calls.writerBody)
        && r.calls.writerBody.model === 'writer-model', JSON.stringify(Object.keys(r.calls.writerBody || {})));
      const w = await run({ writerText: U.s1, writerThrows: true });
      ok('T2d a failed writer is not retried: still one call, and the reader gets the not-covered sentence',
        w.calls.writer === 1 && w.deltas.join('') === NOT_COVERED, ascii(w.deltas.join('|')));
      const src = read('lib/before-writing-v2.js') + read('lib/bw2-units.js');
      ok('T2e the path names no retry: no citation/reject/empty/ascription retry notes are imported',
        !/CITATION_RETRY_NOTE|REJECT_RETRY_NOTE|EMPTY_RETRY_NOTE|ASCRIPTION_RETRY_NOTE|createRewriteBudget/.test(src));
    }

    // ---------------------------------------------------------------- T3
    {
      const r = await run({ writerText: [U.s1, U.bad, U.s3].join(' ') });
      const text = r.deltas.join('');
      const a = text.indexOf(MASAH_RULING);
      const c = text.indexOf(MASAH_TERM);
      ok('T3a the unsupported middle unit is held (never sent)', !text.includes('\u062a\u064a\u0645\u064a\u0629') && r.out.telemetry.unitsHeld === 1,
        ascii(text));
      ok('T3b the unit before it and the unit after it went out, in order', a >= 0 && c > a, JSON.stringify({ a, c }));
      ok('T3c the stream continued past the hold (the unit after it is not at the end by accident)',
        r.out.telemetry.unitsReleased === 2, JSON.stringify(r.out.telemetry));
      const l = await run({ writerText: U.list });
      const lt = l.deltas.join('');
      ok('T3d a held list item: the next item is renumbered before release (1, 2 -- not 1, 3)',
        /^1\. /u.test(lt) && /\n2\. /u.test(lt) && !/\n3\. /u.test(lt) && lt.includes(MASAH_TERM), ascii(lt));
    }

    // ---------------------------------------------------------------- T4
    {
      const pool = [
        [U.s1, U.s3], [U.s1, U.bad, U.s3], [U.lead, U.plain], [U.badLead, U.s1], [U.matn],
        [U.s1, U.matn, U.s3], [U.book, U.s1], [U.s2, U.book], [U.consensus, U.s1], [U.list],
        [U.plain, U.s1, U.bad], [U.badMatn, U.s3], [U.lead, U.matn, U.book], [U.s1, '\n\n' + U.s3],
        [U.s1 + '\n', U.lead], [U.bad, U.bad, U.s1], [U.matn, U.bad], [U.book, U.badLead, U.s3],
        [U.s2, U.lead, U.s3], [U.plain, U.plain], [U.s1, U.book, U.matn, U.lead], [U.list, U.book],
        [U.consensus], [U.s3, U.matn, U.badMatn, U.s1],
      ];
      let exact = 0;
      let wholeCards = 0;
      let takhrijSeen = 0;
      let leadSeen = 0;
      let cardSeen = 0;
      const detail = [];
      for (let i = 0; i < pool.length; i += 1) {
        const r = await run({ writerText: pool[i].join(' '), seed: i + 3, takhrij: true, libOn: true, library: [ROW_L1] });
        const concat = r.deltas.join('');
        // The socket carried exactly the released pieces -- same count, same bytes, same order -- so the
        // finished answer (the accumulated deltas) is the released text and nothing was re-sent.
        const same = concat === r.out.text && concat.length > 0 && r.target.ended === 1
          && r.deltas.length === r.pieces.length && r.deltas.every((d, k) => d === r.pieces[k]);
        if (same) exact += 1; else detail.push(i);
        const partialTag = r.deltas.some((d) => (d.match(/<(source|book)\b/g) || []).length !== (d.match(/<\/(source|book)>/g) || []).length);
        if (!partialTag) wholeCards += 1;
        if (concat.includes(TAKHRIJ_PAREN.trim())) takhrijSeen += 1;
        if (pool[i].includes(U.lead) && concat.includes(IBN_BAZ + ' \u0639\u0646 \u0630\u0644\u0643')) leadSeen += 1;
        if (/<(source|book)\b/.test(concat)) cardSeen += 1;
      }
      ok('T4a on 24 fixtures the final text equals the concatenation of released deltas, byte for byte',
        exact === pool.length, 'failed fixtures: ' + JSON.stringify(detail));
      ok('T4b ...and every card tag sat whole inside one delta on all of them', wholeCards === pool.length, String(wholeCards));
      ok('T4c the fixtures exercised cards, takhrij units and lead-ins',
        cardSeen >= 10 && takhrijSeen >= 4 && leadSeen >= 3, JSON.stringify({ cardSeen, takhrijSeen, leadSeen }));
      const lead = await run({ writerText: [U.lead, U.plain].join(' ') });
      const d0 = lead.deltas[0] || '';
      ok('T4d a lead-in goes out WITH the unit it introduces, in one delta',
        d0.includes('\u0641\u0642\u0627\u0644:') && d0.includes('\u00ab' + MASAH_RULING + '\u00bb'), ascii(d0));
      const badLead = await run({ writerText: [U.badLead, U.s1].join(' ') });
      ok('T4e a held quote holds its lead-in too', !badLead.deltas.join('').includes('\u062a\u064a\u0645\u064a\u0629')
        && badLead.deltas.join('').includes(MASAH_RULING), ascii(badLead.deltas.join('|')));
      const tk = await run({ writerText: [U.matn, U.s3].join(' '), takhrij: true });
      const tkText = tk.deltas.join('');
      ok('T4f a matn unit is looked up BEFORE release: its parenthetical is inside the unit, and the unit after it follows',
        tk.deltas[0].includes(FASTING_MATN) && tk.deltas[0].includes(TAKHRIJ_PAREN.trim())
        && tkText.indexOf(MASAH_TERM) > tkText.indexOf(TAKHRIJ_PAREN.trim()), ascii(tk.deltas.join('|')));
      const bm = await run({ writerText: [U.badMatn, U.s3].join(' ') });
      ok('T4g a matn no cited row carries (and no takhrij proof) is held', !bm.deltas.join('').includes('\u063a\u0641\u0631 \u0644\u0647')
        && bm.deltas.join('').includes(noWaw(MASAH_TERM)), ascii(bm.deltas.join('|')));
    }

    // ---------------------------------------------------------------- T5
    {
      const r = await run({ writerText: [U.s1, U.plain, U.book].join(' '), libOn: true, library: [ROW_L1] });
      const iSrc = r.deltas.findIndex((d) => d.includes('<source'));
      const iBook = r.deltas.findIndex((d) => d.includes('<book'));
      ok('T5a the page card is one delta holding exactly one whole tag', iSrc > 0
        && /^\n<source site="[^"]+" url="[^"]+">[^<]+<\/source>$/u.test(r.deltas[iSrc]), ascii(r.deltas[iSrc] || ''));
      ok('T5b ...right after the unit that cited its row', iSrc > 0 && r.deltas[iSrc - 1].includes(MASAH_RULING));
      ok('T5c the book card likewise, right after its unit', iBook > 0 && /^\n<book\b[^>]*>[^<]+<\/book>$/u.test(r.deltas[iBook])
        && r.deltas[iBook - 1].includes(HANABILA), ascii(r.deltas.join('|')));
      const twice = await run({ writerText: [U.s1, U.s3].join(' ') });
      ok('T5d a row cited twice gets one card', twice.deltas.filter((d) => d.includes('<source')).length === 1
        && twice.out.telemetry.cardsSent === 1);
      const cap = BW2.BW2_CAPS.fatwa;
      const UNITS_E = await esm('lib/bw2-units.js');
      const many = Array.from({ length: 5 }, (_, i) => ({ ...ROW_F1, url: 'https://binbaz.org.sa/fatwas/9' + i, recordId: '9' + i }));
      const m = await run({ fatwa: many, writerText: MASAH_RULING + ' [[1, 2, 3, 4, 5]].' });
      // COMPREHENSIVE 3.4e: it read «at most 3 page cards» (MAX_SOURCES) for one sentence citing five rows; a sentence is now followed by at most
      // BW2_CARDS_PER_UNIT cards (the owner's note 8: every card follows a sentence that relies on it, or it is not shown), so one.
      ok('T5e within the owner\'s rule of 2 Oct: one sentence citing five rows is followed by ONE card (the first row it cites), and cap >= 5 rows are still pinned',
        m.deltas.filter((d) => d.includes('<source')).length === UNITS_E.BW2_CARDS_PER_UNIT && UNITS_E.BW2_CARDS_PER_UNIT === 1 && cap >= 5,
        String(m.deltas.filter((d) => d.includes('<source')).length));
      // ---- 3.4h the answer does not open on the «و» of a unit that was held before it
      const afterHeld = await run({ writerText: [U.bad, U.s3].join(' ') });
      const afterHeldHead = afterHeld.deltas.length ? afterHeld.deltas[0] : '';
      ok('3.4h-9 (holder) a unit held first and the next released as the opening: the opening has lost the «و» it carried, the rest of the unit exactly as written',
        afterHeld.out.telemetry.unitsHeld >= 1 && afterHeldHead.startsWith(noWaw(U.s3).slice(0, 12)) && !afterHeldHead.startsWith('\u0648') && afterHeldHead.includes(noWaw(U.s3).slice(0, 30)),
        ascii(JSON.stringify(afterHeld.deltas)));
      // ---- 3.4e the cards of a sentence that cites several rows: no card follows a card
      const two = await run({ fatwa: [ROW_F1, ROW_F2], writerText: MASAH_RULING + ' [[1, 2]].' });
      const twoCards = two.deltas.filter((d) => d.includes('<source'));
      ok('3.4e-1 a sentence citing two rows is followed by one card, the first row\'s, right after it; the second card does not follow the first',
        twoCards.length === 1 && twoCards[0].includes('/fatwas/1234') && !two.deltas.join('').includes('/fatwas/5678') && two.out.telemetry.cardsSent === 1,
        ascii(JSON.stringify(two.deltas)));
      const later = await run({ fatwa: [ROW_F1, ROW_F2], writerText: MASAH_RULING + ' [[1, 2]]. ' + MASAH_TERM + ' [[2]].' });
      const iA = later.deltas.findIndex((d) => d.includes('/fatwas/1234'));
      const iB = later.deltas.findIndex((d) => d.includes('/fatwas/5678'));
      ok('3.4e-2 the held card goes out after a LATER sentence that cites that row again, and right after it: unit, card, unit, card',
        iA > 0 && iB > iA + 1 && later.deltas[iA - 1].includes(MASAH_RULING) && later.deltas[iB - 1].includes(MASAH_TERM) && !later.deltas[iB - 1].includes('<source')
        && later.out.telemetry.cardsSent === 2, ascii(JSON.stringify(later.deltas)));
      const mixed = await run({ fatwa: [ROW_F1], libOn: true, library: [ROW_L1], writerText: MASAH_RULING + ' [[1, 3]].' });
      ok('3.4e-3 a sentence citing a page and a book: one card after it, the first cited (the page); the book\'s card is not put behind it',
        mixed.deltas.filter((d) => d.includes('<source')).length === 1 && mixed.deltas.filter((d) => d.includes('<book')).length === 0, ascii(JSON.stringify(mixed.deltas)));
      // mutant: the number of cards per sentence raised again (a temp copy beside the module)
      {
        const fsx = require('fs');
        const srcU = fsx.readFileSync(path.join(REPO, 'lib/bw2-units.js'), 'utf8');
        const seam = 'export const BW2_CARDS_PER_UNIT = 1;';
        const tmpMod = path.join(REPO, 'lib', '.mut-bw2-units-34e.mjs');
        try {
          ok('3.4e MUTANT applied (seam found once)', srcU.split(seam).length === 2);
          fsx.writeFileSync(tmpMod, srcU.split(seam).join('export const BW2_CARDS_PER_UNIT = 3;'));
          const MU = await import(require('url').pathToFileURL(tmpMod).href + '?m=34e');
          const out = [];
          const rel = MU.createBw2Releaser({ rows: [{ ...ROW_F1, ref: 1 }, { ...ROW_F2, ref: 2 }], emit: (p) => { out.push(p); return true; },
            cards: { buildSourceTag: (row) => ({ tag: '<source url="' + row.url + '">x</source>', url: row.url }), buildBookTag: () => null, max: 5 } });
          rel.push(MASAH_RULING + ' [[1, 2]].\n');
          await rel.end();
          ok('3.4e MUTANT KILLED: with three cards per sentence the second card follows the first again', out.filter((p) => p.includes('<source')).length === 2);
        } finally { try { fsx.rmSync(tmpMod, { force: true }); } catch { /* nothing to clean */ } }
      }
    }

    // ---------------------------------------------------------------- T6
    {
      const empty = await run({ fatwa: [], writerText: U.s1 });
      const offerAt = empty.frames.findIndex((f) => f.type === 'ezik_live_offer');
      const lastDelta = empty.frames.map((f) => f.type).lastIndexOf('content_block_delta');
      const stopAt = empty.frames.findIndex((f) => f.type === 'content_block_stop');
      ok('T6a an empty table: the answer is exactly the not-covered sentence', empty.deltas.join('') === NOT_COVERED,
        ascii(empty.deltas.join('|')));
      ok('T6b ...followed by ezik_live_offer before the stream ends', offerAt > lastDelta && stopAt > offerAt,
        JSON.stringify({ offerAt, lastDelta, stopAt }));
      ok('T6c ...with no judge and no writer call, so no attributed unit can go out', empty.calls.writer === 0 && empty.calls.ask === 0);
      const dropped = await run({ judge: 'none', writerText: U.s1 });
      ok('T6d a judge that keeps nothing: the same sentence and offer, no writer call',
        dropped.deltas.join('') === NOT_COVERED && dropped.frames.some((f) => f.type === 'ezik_live_offer') && dropped.calls.writer === 0);
      const allHeld = await run({ writerText: [U.plain, U.bad, U.badMatn].join(' ') });
      const ah = allHeld.deltas.join('');
      ok('T6e every attributed unit held: the answer ends in the not-covered sentence plus the offer, and no attributed unit went out',
        ah.endsWith(NOT_COVERED) && !ah.includes('\u062a\u064a\u0645\u064a\u0629') && !ah.includes('\u063a\u0641\u0631 \u0644\u0647')
        && allHeld.frames.some((f) => f.type === 'ezik_live_offer'), ascii(ah));
      const sourced = await run({ writerText: U.s1 });
      ok('T6f a sourced answer carries no live offer', !sourced.frames.some((f) => f.type === 'ezik_live_offer')
        && sourced.out.telemetry.liveOffer === false);
      const own = await run({ writerText: NOT_COVERED });
      ok('T6g the writer writing the sentence itself: sent once, not twice, with the offer',
        own.deltas.join('') === NOT_COVERED && own.frames.some((f) => f.type === 'ezik_live_offer'), ascii(own.deltas.join('|')));
    }

    // ---------------------------------------------------------------- T7
    {
      const TOL = 250;
      const r = await run({ hang: { fatwa: true }, fatwa: [ROW_F1], library: [ROW_L1], libOn: true, budget: 400, writerText: U.book.replace('[[3]]', '[[1]]') });
      ok('T7a a hanging fatwa adapter: the writer starts within BW2_RETRIEVAL_MS + ' + TOL + ' ms',
        r.calls.writerAt !== null && r.calls.writerAt <= 400 + TOL, String(r.calls.writerAt));
      ok('T7b ...the source is recorded timed out, with no status frame (it never returned)',
        r.out.telemetry.fatwaTimedOut === true && !r.frames.some((f) => f.type === 'ezik_status' && f.stage === 'fatwa'),
        JSON.stringify(r.out.telemetry));
      ok('T7c ...and what did return inside the budget was used', r.deltas.join('').includes(HANABILA));
      const all = await run({ hang: { fatwa: true, library: true, encyclopedia: true }, libOn: true, budget: 300, writerText: U.s1 });
      ok('T7d every adapter hanging: the not-covered answer is out within the budget + ' + TOL + ' ms',
        all.deltas.join('') === NOT_COVERED && all.out.telemetry.fatwaTimedOut && all.out.telemetry.libraryTimedOut
        && all.out.telemetry.encyclopediaTimedOut, JSON.stringify(all.out.telemetry));
    }

    // ---------------------------------------------------------------- T8
    {
      const filler = '\u0647\u0630\u0627 \u0643\u0644\u0627\u0645 \u0639\u0627\u0645 \u0639\u0646 \u0623\u062d\u0643\u0627\u0645 \u0627\u0644\u0637\u0647\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u064a\u0627\u0647 \u0648\u0627\u0644\u0622\u0646\u064a\u0629. ';
      const decisive = '\u0648\u0627\u0644\u0635\u062d\u064a\u062d \u0623\u0646 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u062c\u0627\u0626\u0632 \u0648\u0647\u0630\u0627 \u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628 \u0627\u0644\u0645\u0639\u062a\u0645\u062f.';
      const long = filler.repeat(14) + decisive + ' ' + filler.repeat(10);
      const at = long.indexOf(decisive);
      const row = { ...ROW_F1, url: 'https://binbaz.org.sa/fatwas/777', recordId: '777', text: long.slice(0, 1200), passage: long };
      const r = await run({ fatwa: [row], writerText: MASAH_RULING + ' [[1]].' });
      ok('T8a the decisive passage starts after character 360 of its source', at > 360 && !long.slice(0, 360).includes(decisive), String(at));
      ok('T8b ...and the judge was shown it (the issue-aligned window, not the first 360 characters)',
        r.calls.askUser.includes(decisive), ascii(r.calls.askUser.slice(0, 200)));
      ok('T8c the judge output budget covers every candidate: 64 + 12 per candidate',
        r.calls.askMaxTokens === BW2.judgeMaxTokens(1) && BW2.judgeMaxTokens(20) === 304);
      const three = [ROW_F1, ROW_F2, { ...ROW_F1, url: 'https://binbaz.org.sa/fatwas/42', recordId: '42', title: 'ZZ-THIRD' }];
      const miss = await run({ fatwa: three, judge: () => '{"d":{"1":1,"3":1}}', writerText: MASAH_RULING + ' [[1]].' });
      const pinnedBlock = JSON.stringify(miss.calls.writerBody.messages);
      ok('T8d a decision set missing id 2 keeps none of the missing: candidate 2 is not pinned',
        !pinnedBlock.includes(ROW_F2.title) && pinnedBlock.includes('ZZ-THIRD') && pinnedBlock.includes(ROW_F1.title), ascii(pinnedBlock.slice(0, 200)));
      ok('T8e ...and the judgment is recorded incomplete, not unjudged', miss.out.telemetry.judgeComplete === false
        && miss.out.telemetry.judgeKept === 2 && miss.out.telemetry.unjudgedKept === 0 && miss.out.telemetry.judgeOutcome === 'incomplete',
        JSON.stringify(miss.out.telemetry));
      const junk = await run({ fatwa: three, judge: () => 'I think 1 and 3', writerText: MASAH_RULING + ' [[1]].' });
      ok('T8f an unparseable judge is a failure: at most 3 rows whose title and window carry the key terms, marked unjudged',
        junk.out.telemetry.judgeOutcome === 'failed' && junk.out.telemetry.unjudgedKept <= 3 && junk.out.telemetry.judgeKept === 0,
        JSON.stringify(junk.out.telemetry));
      const slow = await run({ fatwa: [ROW_F2], judge: () => new Promise(() => {}), writerText: MASAH_RULING + ' [[1]].' });
      ok('T8g a judge that never answers: failure after BW2_JUDGE_MS, and no row qualifies -> nothing kept -> not covered',
        slow.out.telemetry.judgeOutcome === 'failed' && slow.deltas.join('') === NOT_COVERED, JSON.stringify(slow.out.telemetry));
      // SPEED WASL W3 b): the shape carries `direct` (the candidates the judge marked 2); a 2 is also kept.
      ok('T8h parseDecisions keeps none of the missing', JSON.stringify(BW2.parseDecisions('{"d":{"1":1,"2":0}}', 3)) === '{"keep":[1],"missing":[3],"direct":[]}'
        && JSON.stringify(BW2.parseDecisions('{"d":{"1":2,"2":0,"3":1}}', 3)) === '{"keep":[1,3],"missing":[],"direct":[1]}');
    }

    // ---------------------------------------------------------------- SPEED FIX 1: R3, R4, R5 (unit level)
    const F = JSON.parse(read('guards/fixtures-speed-fix1.json'));
    const UNITS = await esm('lib/bw2-units.js');
    const FLAGS1 = await esm('lib/free-brain/flag.js');
    const MARKER = UNITS.BW2_NOT_COVERED_MARKER;
    const count = (hay, needle) => hay.split(needle).length - 1;
    const hasOffer = (r) => r.frames.some((f) => f.type === 'ezik_live_offer');
    {
      // R3a: the writer's marker, alone.
      const m = await run({ question: F.q16, writerText: MARKER });
      ok('R3a the writer writes the marker alone: the reader gets exactly the not-covered sentence, once, then the offer',
        m.deltas.join('') === NOT_COVERED && hasOffer(m) && m.out.telemetry.unitsReleased === 0, ascii(m.deltas.join('|')));
      // R3b: q16 as it happened -- the writer wrote the sentence (here with tanween and shadda, as a
      // model writes it) and BW2 appended its own: now exactly one, compared on the fold.
      const variant = F.a16[0].replace(NOT_COVERED.split(' ')[5], NOT_COVERED.split(' ')[5] + String.fromCharCode(0x064b, 0x0651));
      const q16 = await run({ question: F.q16, writerText: variant + '\n' + F.a16[1] });
      ok('R3b q16: the writer\'s own not-covered sentence (with diacritics, twice) -> the sentence exactly once, then the offer',
        variant !== F.a16[0] && q16.deltas.join('') === NOT_COVERED && hasOffer(q16), ascii(q16.deltas.join('|')));
      // R3c: q9 with the marker first and the continuation after it (even cited): nothing after it goes out.
      const q9m = await run({ question: F.q9, writerText: MARKER + '\n' + F.a9[1].replace(/\.$/u, ' [[1]].') });
      ok('R3c q9: marker then a continuation -> only the sentence and the offer; the continuation is not released',
        q9m.deltas.join('') === NOT_COVERED && hasOffer(q9m) && q9m.out.telemetry.cardsSent === 0, ascii(q9m.deltas.join('|')));
      // R3d: q9 as it happened: the sentence first, then 305 characters -> only the sentence.
      const q9s = await run({ question: F.q9, writerText: F.a9.join('\n').replace(/\.$/u, ' [[1]].') });
      ok('R3d q9: the writer\'s sentence then the rest -> only the sentence and the offer',
        q9s.deltas.join('') === NOT_COVERED && hasOffer(q9s), ascii(q9s.deltas.join('|')));
      // R3e: text before the marker that has not gone out does not go out, for every chunking.
      let before = 0;
      for (let seed = 1; seed <= 6; seed += 1) {
        const r = await run({ writerText: U.s1 + ' ' + U.s3 + ' ' + MARKER + ' ' + U.s1, seed });
        if (r.deltas.join('') === NOT_COVERED && hasOffer(r)) before += 1;
      }
      ok('R3e the marker split across deltas (6 chunkings): the units written before it are not released, nor after it',
        before === 6, String(before));
      // R3f: already released cited text, then the writer's sentence. Since SPEED PIPES fix 4 (order
      // EZIK-SPEED-PIPES-ORDER-2026-09-28, 6.2: the not-covered sentence never after a written answer, question 13)
      // the unit stays and the answer ends there: no not-covered sentence, no offer, and the rest is not released.
      const mid = await run({ writerText: U.s1 + ' ' + variant + ' ' + U.s3 });
      const mt = mid.deltas.join('');
      ok('R3f a cited unit, then the writer\'s sentence: the unit stays, and neither the sentence, the offer nor the rest follows it',
        mt.startsWith(MASAH_RULING) && count(mt, NOT_COVERED) === 0 && !mt.includes(MASAH_TERM)
        && !hasOffer(mid), ascii(mt));
      const tat = NOT_COVERED.replace(' ', String.fromCharCode(0x0640) + '  ').replace(/\.$/u, ' !');
      ok('R3g the comparison fold ignores diacritics, tatweel, spaces and punctuation, and nothing else',
        UNITS.carriesNotCovered(tat, NOT_COVERED) && UNITS.carriesNotCovered(variant, NOT_COVERED)
        && !UNITS.carriesNotCovered(MASAH_RULING, NOT_COVERED) && UNITS.foldNotCovered(tat) === UNITS.foldNotCovered(NOT_COVERED));
      ok('R3h the writer is told to write the marker, and is no longer given the sentence to write',
        BW2.BW2_WRITE_RULES.includes(MARKER) && !BW2.BW2_WRITE_RULES.includes(NOT_COVERED) && ![...MARKER].some((c) => c.charCodeAt(0) > 0x7e));
    }
    // FIX 48 item 8 (the owner's decision 9, and a technical one): the writer's instructions. MEASURED (the 2 Oct preview, answer 6): the scholars' views were in a pinned row and the writer did
    // not carry them, since no rule asked for them; and it repeated, to the reader, the sentence of bw2DirectRule that told it where the stored fatwa stood.
    // (a) a ninth rule asks for the views, each with its own speaker, before the explanation of the fatwa shown above; (b) bw2DirectRule is worded so that the writer has nothing of it to say back.
    // The two texts are the order's own, pinned by sha256 (taken from the order file, never retyped) and by the shape the writer receives them in.
    {
      const sha8 = (x) => require('crypto').createHash('sha256').update(String(x), 'utf8').digest('hex');
      const RULE9_SHA = '87234515e9481a28c033aa9f0b734cbb2a4d5a3f1c00d3b31f18da827ebf1415';
      const DIRECT7_SHA = 'af9538bcbdac8b0b84495be80bc372483e82d245f8e4c1053e3eb4de06bcd2d7';
      const lines8 = BW2.BW2_WRITE_RULES.split(String.fromCharCode(10));
      const rule9 = lines8[lines8.length - 1];
      ok('FIX48-8a the writer\'s rules end with a ninth: the views of the scholars, from the rows, each with its own speaker, before the explanation (pinned by sha256)',
        lines8.length === 5 && rule9.startsWith('\u0669. ') && sha8(rule9) === RULE9_SHA, sha8(rule9));
      const direct7 = BW2.bw2DirectRule(7);
      ok('FIX48-8b the direct-fatwa rule is the order\'s sentence (pinned by sha256), names the fatwa [7] and cites it [[7]], and carries no phrase for the writer to repeat',
        sha8(direct7) === DIRECT7_SHA && direct7.includes('[7]') && direct7.includes('[[7]]') && !direct7.includes('[[1]]'), sha8(direct7));
      // not one trace of the old phrase in the module, in the rules, or in the direct rule the writer receives: the comparison is on the letters (marks removed)
      const strip8 = (t) => String(t).replace(/[\u064b-\u0652\u0670\u0640]/g, '');
      const OLD_PHRASE = /\u0641\u0648\u0642\s*\u062c\u0648\u0627\u0628/u;
      const srcM = fs.readFileSync(path.join(REPO, 'lib/before-writing-v2.js'), 'utf8');
      ok('FIX48-8c no trace of the old phrase ("above my answer") in the module, in the rules, or in the direct rule the writer receives',
        !OLD_PHRASE.test(strip8(srcM)) && !OLD_PHRASE.test(strip8(BW2.BW2_WRITE_RULES + direct7)));
      const rulesFor = BW2.bw2RulesFor([], 'x', []);
      ok('FIX48-8d the writer\'s message carries the ninth rule last, after the eighth', rulesFor.endsWith(rule9) && rulesFor.indexOf('\u0668. ') < rulesFor.indexOf(rule9));
      // mutants of the module (temp copies beside it): the ninth rule taken out; the direct rule's old sentence put back
      const tmpM = path.join(REPO, 'lib', '.mut-fix48-8.mjs');
      const NL = String.fromCharCode(10), BT = String.fromCharCode(96);
      try {
        const mark9 = "  '\\u0669. ";
        const cut = srcM.indexOf(mark9);
        ok('FIX48-8 MUTANT applied (the ninth rule\'s line found once)', cut > 0 && srcM.indexOf(mark9, cut + 1) < 0);
        const cutEnd = srcM.indexOf(NL, cut);
        fs.writeFileSync(tmpM, srcM.slice(0, cut) + srcM.slice(cutEnd + 1));
        const M8 = await import(require('url').pathToFileURL(tmpM).href + '?m=fix48-8a');
        ok('FIX48-8 MUTANT KILLED: without the ninth rule the writer is not asked for the views and the pin fails', M8.BW2_WRITE_RULES.split(NL).length === 4 && sha8(M8.BW2_WRITE_RULES.split(NL).pop()) !== RULE9_SHA);
        const oldSentence = '\u0646\u064f\u0642\u0650\u0644\u064e\u062a\u0652 \u0644\u0644\u0642\u0627\u0631\u0626 \u0641\u0648\u0642\u064e \u062c\u0648\u0627\u0628\u0650\u0643 \u0627\u0644\u0641\u062a\u0648\u0649 [' + '$' + '{ref}] \u0628\u0646\u0635\u0651\u0650\u0647\u0627 \u0643\u0627\u0645\u0644\u0627\u064b.';
        const dFn = srcM.indexOf('export function bw2DirectRule');
        const dStart = srcM.indexOf('  return ' + BT, dFn);
        const dEnd = srcM.indexOf(NL, dStart);
        ok('FIX48-8 MUTANT 2 applied (the direct rule\'s return line found)', dFn > 0 && dStart > dFn && dEnd > dStart);
        fs.writeFileSync(tmpM, srcM.slice(0, dStart) + '  return ' + BT + oldSentence + BT + ';' + srcM.slice(dEnd));
        const M8b = await import(require('url').pathToFileURL(tmpM).href + '?m=fix48-8b');
        ok('FIX48-8 MUTANT 2 KILLED: with the old sentence back the phrase the writer repeated is in what it receives, and the pin fails', OLD_PHRASE.test(strip8(M8b.bw2DirectRule(7))) && sha8(M8b.bw2DirectRule(7)) !== DIRECT7_SHA);
      } finally { try { fs.rmSync(tmpM, { force: true }); } catch { /* nothing to clean */ } }
    }
    {
      // R4a: q4's released first unit, uncited: its group claim now holds it.
      const q4 = await run({ question: F.q4, writerText: F.a4[0] + ' ' + U.s1 });
      const t4 = q4.deltas.join('');
      ok('R4a q4: a unit naming the scholars as a group with no [[n]] is held; the stream continues',
        !t4.includes(F.q4Clause.slice(0, 20)) && t4.includes(MASAH_RULING), ascii(t4));
      const rowWith = { ...ROW_F1, url: 'https://binbaz.org.sa/fatwas/4001', recordId: '4001', title: 'R4-ROW', text: F.authRowScholars, passage: F.authRowScholars };
      const rowWithout = { ...rowWith, url: 'https://binbaz.org.sa/fatwas/4002', recordId: '4002', text: F.authRowNoGroup, passage: F.authRowNoGroup };
      const cited = F.q4Clause.replace(/\.$/u, ' [[1]].');
      const ok4 = await run({ question: F.q4, fatwa: [rowWith], writerText: cited });
      ok('R4b ...the same claim cited to a row that names the group is released',
        ok4.deltas.join('').startsWith(F.q4Clause.replace(/\.$/u, '')), ascii(ok4.deltas.join('|')));
      const no4 = await run({ question: F.q4, fatwa: [rowWithout], writerText: cited + ' ' + U.s1 });
      ok('R4c ...cited to a row that does not name it: held (unsupported group)',
        !no4.deltas.join('').includes(F.q4Clause.slice(0, 20)), ascii(no4.deltas.join('|')));
      const fam = UNITS.groupFamiliesIn;
      const norm = (await esm('lib/route-classify.js')).normalizeArabic;
      const listed = F.a4[0].length > 0 && [F.q4Clause].every((s) => fam(norm(s)).length === 1);
      ok('R4d the group list: q4\'s "ahl al-ilm" is a group claim, with the conjunction welded on too',
        listed && fam(norm(String.fromCharCode(0x0648) + F.q4Clause)).length === 1 && fam(norm(MASAH_RULING)).length === 0);
      // R4(b): q4's second line states a ruling (it drops the night at Mina) with no [[n]].
      const line2 = F.a4[1].split('. ')[0] + '.';
      const offRun = await run({ question: F.q4, writerText: U.s1 + ' ' + line2, runtime: 'STORED_FIQH' });
      const onRun = await run({ question: F.q4, writerText: U.s1 + ' ' + line2, runtime: 'STORED_FIQH', env: { BW2_HOLD_UNCITED_RULINGS: 'on' } });
      const hadRun = await run({ question: F.q4, writerText: U.s1 + ' ' + line2, runtime: 'HADITH', env: { BW2_HOLD_UNCITED_RULINGS: 'on' } });
      const citedOn = await run({ question: F.q4, writerText: U.s1 + ' ' + line2.replace(/\.$/u, ' [[1]].'), runtime: 'STORED_FIQH', env: { BW2_HOLD_UNCITED_RULINGS: 'on' } });
      const probe = line2.slice(0, 12);
      ok('R4e BW2_HOLD_UNCITED_RULINGS is off by default: q4\'s uncited ruling unit goes out as before',
        offRun.deltas.join('').includes(probe) && FLAGS1.bw2HoldUncitedRulingsDecision({}).enabled === false
        && FLAGS1.BW2_HOLD_UNCITED_RULINGS_DEFAULT === false, ascii(offRun.deltas.join('|')));
      ok('R4f ...on: held in STORED_FIQH; released in HADITH and when it carries a valid [[n]]',
        !onRun.deltas.join('').includes(probe) && hadRun.deltas.join('').includes(probe) && citedOn.deltas.join('').includes(probe)
        && FLAGS1.bw2HoldUncitedRulingsDecision({ BW2_HOLD_UNCITED_RULINGS: 'on' }).enabled === true,
        ascii([onRun, hadRun, citedOn].map((r) => r.deltas.join('')).join(' || ')));
    }
    {
      // R5a: q11 -- the unit naming the hadith, its narrator and the Prophet is held; the quote after it
      // (the tool's exact first line) leans on it and is held too; the stream continues.
      // SPEED FIX 5: C7 answers a question about a hadith's source first or not at all, and this
      // fixture pins R5 / C1 / C5, not the question's class: its runs ask about the same hadith's meaning.
      const Q11_MEANING = '\u0645\u0627 \u0645\u0639\u0646\u0649 \u062d\u062f\u064a\u062b: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u061f';
      const q11 = await run({ question: Q11_MEANING, writerText: F.authHeld11 + ' ' + F.a11[0] + ' ' + U.s1 });
      const t11 = q11.deltas.join('');
      const quote = F.a11[0].slice(F.a11[0].indexOf(String.fromCharCode(0x00ab)), F.a11[0].indexOf(String.fromCharCode(0x00ab)) + 12);
      ok('R5a q11: the quote that leans on a held unit is held with it; the answer does not begin with it',
        !t11.includes(quote) && t11.startsWith(MASAH_RULING) && q11.out.telemetry.unitsHeld === 2, ascii(t11));
      const open = await run({ question: Q11_MEANING, writerText: F.a11[0] + ' ' + U.s1 });
      ok('R5b ...and no answer opens on it even when nothing before it was held',
        !open.deltas.join('').includes(quote) && open.deltas.join('').startsWith(MASAH_RULING), ascii(open.deltas.join('|')));
      const q1 = await run({ question: F.q1, writerText: F.a1[0].replace(/\.$/u, ' [[1]].') + ' ' + U.s1 });
      ok('R5c q1\'s opening "wa-hadha ..." (a connector) does not open an answer',
        q1.deltas.join('').startsWith(MASAH_RULING), ascii(q1.deltas.join('|')));
      const pr = await run({ writerText: [U.s1, U.bad, F.authPronoun, U.s3].join(' ') });
      const tp = pr.deltas.join('');
      ok('R5d a bare demonstrative right after a held unit is held; one after a released unit is not',
        !tp.includes(F.authPronoun.slice(0, 8)) && tp.includes(MASAH_TERM)
        && (await run({ writerText: [U.s1, F.authPronoun].join(' ') })).deltas.join('').includes(F.authPronoun.slice(0, 8)), ascii(tp));
      const k = UNITS.dependentKind;
      ok('R5e the kinds: q11\'s "qala:" is speech, q1 a connector, q10 a bare demonstrative; a named speaker and "qawluhu ta\'ala" are not',
        k(F.a11[0]) === 'speech' && k(F.a1[0]) === 'connector' && k(F.a10[0]) === 'pronoun' && k(U.s2) === '' && k(MASAH_RULING) === ''
        && k(String.fromCharCode(0x00ab) + MASAH_RULING + String.fromCharCode(0x00bb)) === 'quote',
        JSON.stringify([k(F.a11[0]), k(F.a1[0]), k(F.a10[0]), k(U.s2)]));
    }

    // ---------------------------------------------------------------- SPEED FIX 2: C1, C2, C3
    // Built from the owner tool's round 2 (EZIK-SPEED-PREVIEW2-LIVE-2026-09-27): question 6 verbatim, and
    // the lead-in, the matn and the sentences after it exactly as the live-search answer that followed wrote
    // them. The row quotes the same hadith with its own vocalisation, "yarasul" written as one word and
    // semicolons between the four -- the spacing and punctuation today's word test does not fold.
    const TK = await esm('lib/takhrij.js');
    {
      const Q6_SOURCE = '\u0623\u064a\u0646 \u0648\u0631\u062f \u062d\u062f\u064a\u062b: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u061f \u0648\u0645\u0646 \u0631\u0648\u0627\u0647\u061f';
      // SPEED FIX 5: C7 answers a question about a hadith's source first or not at all, and this
      // fixture pins R5 / C1 / C5, not the question's class: its runs ask about the same hadith's meaning.
      const Q6 = '\u0645\u0627 \u0645\u0639\u0646\u0649 \u062d\u062f\u064a\u062b: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u061f';
      const Q6_LEAD = '\u0648\u0646\u0635\u0647 \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644:';
      const Q6_MATN = '\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629. \u0642\u0644\u0646\u0627: \u0644\u0645\u0646 \u064a\u0627 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647\u061f \u0642\u0627\u0644: \u0644\u0644\u0647 \u0648\u0644\u0643\u062a\u0627\u0628\u0647 \u0648\u0644\u0631\u0633\u0648\u0644\u0647 \u0648\u0644\u0623\u0626\u0645\u0629 \u0627\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0648\u0639\u0627\u0645\u062a\u0647\u0645';
      // The frame on the quote's own line: today's matn finder reads a quotation as a matn only then
      // (TOOLREP3's answer put it on the line before, where no matn is found and no matn check runs).
      const Q6_QUOTE = Q6_LEAD + ' \u00ab' + Q6_MATN + '\u00bb [[1]]';
      // A lead-in line ending in a colon, and the frame and matn on the line it introduces.
      const Q6_LEADIN = '\u0648\u0646\u0635\u0647:';
      const Q6_FRAMED = '\u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab' + Q6_MATN + '\u00bb [[1]]';
      const Q6_AFTER = '\u0648\u0647\u0630\u0627 \u064a\u062f\u0644 \u0639\u0644\u0649 \u0639\u0638\u0645 \u0634\u0623\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629.';
      const Q6_MEANING = '\u0648\u0645\u0639\u0646\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0639\u0638\u064a\u0645 \u0623\u0646 \u0627\u0644\u062f\u064a\u0646 \u0643\u0644\u0647 \u064a\u0631\u062c\u0639 \u0625\u0644\u0649 \u0627\u0644\u0646\u0635\u064a\u062d\u0629 [[1]].';
      const Q6_ROW_TEXT = '\u0639\u0646 \u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: \u00ab\u0627\u0644\u062f\u0650\u0651\u064a\u0646\u064f \u0627\u0644\u0646\u064e\u0651\u0635\u0650\u064a\u062d\u064e\u0629\u064f\u00bb \u0642\u064f\u0644\u0652\u0646\u064e\u0627: \u0644\u0650\u0645\u064e\u0646\u0652 \u064a\u064e\u0627\u0631\u064e\u0633\u064f\u0648\u0644\u064e \u0627\u0644\u0644\u064e\u0651\u0647\u0650\u061f \u0642\u064e\u0627\u0644\u064e: \u00ab\u0644\u0650\u0644\u064e\u0651\u0647\u0650\u061b \u0648\u064e\u0644\u0650\u0643\u0650\u062a\u064e\u0627\u0628\u0650\u0647\u0650\u061b \u0648\u064e\u0644\u0650\u0631\u064e\u0633\u064f\u0648\u0644\u0650\u0647\u0650\u061b \u0648\u064e\u0644\u0650\u0623\u064e\u0626\u0650\u0645\u064e\u0651\u0629\u0650 \u0627\u0644\u0652\u0645\u064f\u0633\u0652\u0644\u0650\u0645\u0650\u064a\u0646\u064e \u0648\u064e\u0639\u064e\u0627\u0645\u064e\u0651\u062a\u0650\u0647\u0650\u0645\u0652\u00bb. \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645. \u0648\u0645\u0639\u0646\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0639\u0638\u064a\u0645 \u0623\u0646 \u0627\u0644\u062f\u064a\u0646 \u0643\u0644\u0647 \u064a\u0631\u062c\u0639 \u0625\u0644\u0649 \u0627\u0644\u0646\u0635\u064a\u062d\u0629.';
      const OTHER_ROW_TEXT = '\u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab\u0645\u0646 \u063a\u0634\u0646\u0627 \u0641\u0644\u064a\u0633 \u0645\u0646\u0627\u00bb. \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645. \u0648\u0645\u0639\u0646\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0639\u0638\u064a\u0645 \u0623\u0646 \u0627\u0644\u062f\u064a\u0646 \u0643\u0644\u0647 \u064a\u0631\u062c\u0639 \u0625\u0644\u0649 \u0627\u0644\u0646\u0635\u064a\u062d\u0629.';
      const ROW_Q6 = { ...ROW_F1, title: 'Q6-ROW', url: 'https://binbaz.org.sa/fatwas/6006', recordId: '6006', text: Q6_ROW_TEXT, passage: Q6_ROW_TEXT };
      const ROW_OTHER = { ...ROW_Q6, title: 'Q6-OTHER', url: 'https://binbaz.org.sa/fatwas/6007', recordId: '6007', text: OTHER_ROW_TEXT, passage: OTHER_ROW_TEXT };
      const PAREN_Q6 = ' (\u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645)';
      // The takhrij lookup of question 6 as the preview measured it: examined 1, matched 0 (TAKHRIJ_SILENT).
      const silent = async (text) => ({ text, entries: text.includes(Q6_MATN) ? [{ matn: Q6_MATN, silent: true, sourced: false }] : [] });
      const matched = async (text) => {
        if (!text.includes(Q6_MATN)) return { text, entries: [] };
        const at = text.indexOf('\u00bb', text.indexOf(Q6_MATN)) + 1;
        return { text: text.slice(0, at) + PAREN_Q6 + text.slice(at), entries: [{ matn: Q6_MATN, sourced: true, sealProof: ['\u0635\u062d\u064a\u062d \u0645\u0633\u0644\u0645'], proseProof: ['\u0645\u0633\u0644\u0645'] }] };
      };
      const w = [Q6_QUOTE, Q6_AFTER, Q6_MEANING].join('\n');

      const c1 = await run({ question: Q6, fatwa: [ROW_Q6], writerText: w, takhrijImpl: silent });
      const t1 = c1.deltas.join('');
      const tel1 = c1.out.telemetry;
      ok('C1a q6: a matn the cited row carries is released on that row though the takhrij lookup matched nothing',
        t1.includes('\u00ab' + Q6_MATN + '\u00bb') && tel1.heldUnsupportedMatn === 0 && tel1.takhrijLookups === 1 && tel1.takhrijMatched === 0
        && !t1.includes(PAREN_Q6.trim()) && !hasOffer(c1) && !t1.includes(NOT_COVERED), ascii(t1) + ' ' + JSON.stringify(tel1));
      const q6Matn = TK.findTargets(Q6_QUOTE).targets.map((x) => x.matn)[0] || '';
      ok('C1b ...the fixture measures the change: today\'s word test does not carry it, the spacing-free test does',
        q6Matn.length > 0 && !TK.atomCarriesMatn(Q6_ROW_TEXT, q6Matn) && UNITS.rowCarriesMatn(Q6_ROW_TEXT, q6Matn),
        JSON.stringify([q6Matn.length, TK.atomCarriesMatn(Q6_ROW_TEXT, q6Matn)]));
      ok('C1c ...the connector after it followed it out (R5 around a released matn)',
        (c1.deltas[0] || '').startsWith(Q6_LEAD) && (c1.deltas[0] || '').includes(Q6_MATN) && t1.includes(Q6_AFTER)
        && tel1.unitsHeld === 0 && tel1.unitsReleased === 3, ascii(c1.deltas.join('|')));
      const ld = await run({ question: Q6, fatwa: [ROW_Q6], writerText: [Q6_LEADIN, Q6_FRAMED, Q6_AFTER].join('\n'), takhrijImpl: silent });
      const ldn = await run({ question: Q6, fatwa: [ROW_OTHER], writerText: [Q6_LEADIN, Q6_FRAMED, Q6_MEANING].join('\n'), takhrijImpl: silent });
      ok('C1c2 a lead-in goes out with the carried matn it introduces, in one delta; and is held with it when no row carries it',
        (ld.deltas[0] || '').startsWith(Q6_LEADIN + '\n') && (ld.deltas[0] || '').includes(Q6_MATN) && ld.out.telemetry.heldUnsupportedMatn === 0
        && !ldn.deltas.join('').includes(Q6_LEADIN) && !ldn.deltas.join('').includes(Q6_MATN.slice(0, 12)) && ldn.out.telemetry.heldUnsupportedMatn === 1
        && ldn.deltas.join('').includes('\u0645\u0639\u0646\u0649 \u0647\u0630\u0627'), ascii(ld.deltas.join('|') + ' || ' + ldn.deltas.join('|')));

      const c1n = await run({ question: Q6, fatwa: [ROW_OTHER], writerText: w, takhrijImpl: silent });
      const t1n = c1n.deltas.join('');
      const teln = c1n.out.telemetry;
      ok('C1d a matn no cited row carries, with no takhrij proof, stays held -- its frame with it',
        !t1n.includes(Q6_MATN.slice(0, 12)) && !t1n.includes(Q6_LEAD.slice(0, 8)) && teln.heldUnsupportedMatn === 1, ascii(t1n) + ' ' + JSON.stringify(teln));
      ok('C1e ...and R5 still holds the connector that leans on it; the independent unit after goes out',
        !t1n.includes(Q6_AFTER) && teln.heldDependentOnHeld === 1 && t1n.includes('\u0645\u0639\u0646\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b') && teln.heldBeforeFirst === 2,
        ascii(t1n));
      const op = await run({ question: Q6, fatwa: [ROW_Q6], writerText: [Q6_AFTER, Q6_QUOTE].join('\n'), takhrijImpl: silent });
      ok('C1f ...and no answer opens on a connector: held (dependent_opening), the carried matn after it released',
        op.deltas.join('').startsWith(noWaw(Q6_LEAD)) && !op.deltas.join('').includes(Q6_AFTER) && op.out.telemetry.heldDependentOpening === 1,
        ascii(op.deltas.join('|')));
      const cm = await run({ question: Q6, fatwa: [ROW_Q6], writerText: w, takhrijImpl: matched });
      ok('C1g the lookup still runs first and adds its parenthetical when it matches, inside the unit',
        (cm.deltas[0] || '').includes(Q6_MATN + '\u00bb' + PAREN_Q6) && cm.out.telemetry.takhrijMatched === 1, ascii(cm.deltas.join('|')));
      const SHORT = '\u0627\u0644\u062d\u062c \u0639\u0631\u0641\u0629';
      const SHORT_ROW = '\u0627\u0644\u062d\u062c\u064f\u0651\u2026\u0639\u0631\u0641\u0629\u064f';
      ok('C1h the minimum: MIN_CARRIED_LETTERS is 12, and a shorter matn is never carried by the spacing-free test alone',
        UNITS.MIN_CARRIED_LETTERS === 12 && UNITS.foldCarried(SHORT).length < 12
        && UNITS.foldCarried(SHORT_ROW).includes(UNITS.foldCarried(SHORT)) && !UNITS.rowCarriesMatn(SHORT_ROW, SHORT)
        && UNITS.foldCarried(Q6_MATN).length >= 12, JSON.stringify([UNITS.foldCarried(SHORT).length, UNITS.foldCarried(Q6_MATN).length]));
      ok('C1i the fold removes diacritics, tatweel, punctuation, quote marks and spacing, and nothing else',
        UNITS.foldCarried('\u00ab\u0627\u0644\u062f\u0650\u0651\u064a\u0646\u064f \u0640 \u0627\u0644\u0646\u064e\u0651\u0635\u0650\u064a\u062d\u064e\u0629\u064f\u00bb\u2026 \u061b') === UNITS.foldCarried('\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629')
        && UNITS.foldCarried('\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629') !== UNITS.foldCarried('\u0627\u0644\u062f\u064a\u0646 \u0646\u0635\u064a\u062d\u0629'));
      // FIX 48 item 5: a Prophetic saying written with NO quotation marks. The unit's closing lookup is asked for it as for a quoted matn; a saying the
      // library does not carry is released exactly as written (nothing is written, nothing is held: unsupported_matn is for QUOTED matns); one it carries
      // leaves with what the library proved. The mutant takes the unquoted read out of the unit check: the lookup is never asked.
      {
        const SAY = 'لا ضرر ولا ضرار في الإسلام';
        const UNIT = 'وقال النبي صلى الله عليه وسلم: ' + SAY + ' [[1]].';
        const PAREN5 = ' (لم يوقف على حكم)';
        const rows5 = [{ ...ROW_F1, ref: 1 }];
        const drive5 = async (mod, takhrijFn) => {
          const out = [];
          const rel = mod.createBw2Releaser({ rows: rows5, emit: (p) => { out.push(p); return true; }, takhrij: takhrijFn });
          rel.push(UNIT + '\n');
          const st = await rel.end();
          return { text: out.join(''), st };
        };
        const silent5 = async (text) => ({ text, proofs: [], sourced: [], entries: [] });
        const matched5 = async (text) => {
          const at = text.indexOf(SAY);
          if (at < 0) return { text, proofs: [], sourced: [], entries: [] };
          return { text: text.slice(0, at) + '«' + SAY + '»' + PAREN5 + text.slice(at + SAY.length), proofs: [], sourced: [SAY], entries: [{ matn: SAY, books: [], companion: '' }] };
        };
        const a5 = await drive5(UNITS, silent5);
        ok('FIX48-5a an unquoted saying the library does not carry: released as written, the lookup was asked once, nothing held',
          a5.text.includes(SAY) && !a5.text.includes('«') && a5.st.takhrijLookups === 1 && Object.keys(a5.st.holds).length === 0 && a5.st.released === 1, ascii(a5.text) + ' ' + JSON.stringify(a5.st));
        const b5 = await drive5(UNITS, matched5);
        ok('FIX48-5b an unquoted saying the library carries: the unit leaves with its parentheses, inside it', b5.text.includes('«' + SAY + '»' + PAREN5) && b5.st.released === 1 && Object.keys(b5.st.holds).length === 0, ascii(b5.text) + ' ' + JSON.stringify(b5.st));
        const seam5 = 'findTargets(value, { unquoted: true }).targets.some((target) => target.unquoted === true);';
        const fsx = require('fs');
        const srcU5 = fsx.readFileSync(path.join(REPO, 'lib/bw2-units.js'), 'utf8');
        const tmp5 = path.join(REPO, 'lib', '.mut-bw2-units-fix48-5.mjs');
        try {
          ok('FIX48-5 MUTANT applied (seam found once)', srcU5.split(seam5).length === 2);
          fsx.writeFileSync(tmp5, srcU5.split(seam5).join('false;'));
          const MU5 = await import(require('url').pathToFileURL(tmp5).href + '?m=fix48-5');
          const m5 = await drive5(MU5, matched5);
          ok('FIX48-5 MUTANT KILLED: without the unquoted read the unit check never asks the lookup for the saying', m5.st.takhrijLookups === 0 && !m5.text.includes('«'), JSON.stringify(m5.st));
        } finally { try { fsx.rmSync(tmp5, { force: true }); } catch { /* nothing to clean */ } }
      }
      // FIX 48 item 6 (the owner's decision 7): a grade question that quotes a text has its HEAD written first on the adult path, before the first unit, once.
      // MEASURED (the 2 Oct preview, answer 2, and the measure report): the whole-answer pass that writes the head never runs on this path, so the head did not reach the adult.
      // The head is computed beside the retrieval (deps.gradingHeadForQuestion here; lib/takhrij.js gradingHeadForQuestion in production); it goes out with the first unit and
      // only with a unit; a failure writes nothing; and the units' own closing lookups are made WITHOUT the question, so no second head can be written beside it.
      {
        const HEAD6 = 'THE-HEAD-OF-THE-ASKED-TEXT.';
        const Q_GRADE = 'هل يصح حديث «' + FASTING_MATN + '»؟';
        const Q_GRADE_NOQUOTE = 'هل يصح هذا الحديث؟';
        const seenQuestions = [];
        const closing = async (text, opts) => {
          seenQuestions.push(opts && opts.question);
          return { text: opts && opts.question ? 'CLOSING-HEAD\n\n' + text : text, entries: [] };
        };
        const headCalls = [];
        const headOf = (head) => async (input) => { headCalls.push(input.question); return head === null ? null : { head, callFailures: [] }; };
        const g1 = await run({ question: Q_GRADE, writerText: U.matn, takhrijImpl: closing, gradingHead: headOf(HEAD6) });
        const t1 = g1.deltas.join('');
        ok('FIX48-6a a grade question that quotes a text: the head is the first line, once, before the first unit, then a blank line',
          t1.startsWith(HEAD6 + '\n\n') && t1.split(HEAD6).length === 2 && t1.includes(FASTING_MATN) && headCalls[0] === Q_GRADE, ascii(t1));
        ok('FIX48-6b ...and no second head: the units\' closing lookups were made without the question, so none was written beside it',
          seenQuestions.length >= 1 && seenQuestions.every((q) => q === '') && !t1.includes('CLOSING-HEAD'), JSON.stringify(seenQuestions) + ascii(t1));
        seenQuestions.length = 0; headCalls.length = 0;
        const g2 = await run({ question: Q_MASAH, writerText: U.matn, takhrijImpl: closing, gradingHead: headOf(HEAD6) });
        ok('FIX48-6c a question that asks no grade: no head, the head function is never asked, and the closings keep the question as they had it',
          !g2.deltas.join('').includes(HEAD6) && headCalls.length === 0 && seenQuestions.length >= 1 && seenQuestions.every((q) => q === Q_MASAH), JSON.stringify(seenQuestions));
        seenQuestions.length = 0; headCalls.length = 0;
        const g3 = await run({ question: Q_GRADE_NOQUOTE, writerText: U.matn, takhrijImpl: closing, gradingHead: headOf(HEAD6) });
        ok('FIX48-6d a grade question that quotes nothing has no text to head: no head, and the closings keep the question', !g3.deltas.join('').includes(HEAD6) && headCalls.length === 0 && seenQuestions.every((q) => q === Q_GRADE_NOQUOTE));
        seenQuestions.length = 0; headCalls.length = 0;
        const g4 = await run({ question: Q_GRADE, writerText: U.matn, takhrijImpl: closing, gradingHead: headOf(null) });
        const g4t = g4.deltas.join('');
        ok('FIX48-6e the search failed (no head): nothing is written in its place, and the closings write none either', g4t.includes(FASTING_MATN) && !g4t.includes('CLOSING-HEAD') && !g4t.includes(HEAD6), ascii(g4t));
        const g5 = await run({ question: Q_GRADE, writerText: '', takhrijImpl: closing, gradingHead: headOf(HEAD6) });
        ok('FIX48-6f a turn that releases nothing sends nothing of the head: the not-covered sentence stands alone', g5.deltas.join('') === NOT_COVERED && !g5.deltas.join('').includes(HEAD6), ascii(g5.deltas.join('|')));
        const gm = await run({ question: Q_GRADE, writerText: U.matn, takhrijImpl: closing, gradingHead: async () => { throw new Error('upstream down'); } });
        ok('FIX48-6g a head function that throws changes nothing about the answer', gm.deltas.join('').includes(FASTING_MATN) && !gm.deltas.join('').includes(HEAD6));
        // mutants of lib/before-writing-v2.js and lib/bw2-units.js (temp copies beside the modules)
        const fsx = require('fs');
        const mutateModule = async (rel, seam, to, tag) => {
          const src = fsx.readFileSync(path.join(REPO, rel), 'utf8');
          ok('FIX48-6 MUTANT ' + tag + ' applied (seam found once)', src.split(seam).length === 2);
          const tmp = path.join(REPO, path.dirname(rel), '.mut-fix48-6-' + tag + '.mjs');
          fsx.writeFileSync(tmp, src.split(seam).join(to));
          try { return await import(require('url').pathToFileURL(tmp).href + '?m=' + tag); } finally { try { fsx.rmSync(tmp, { force: true }); } catch { /* nothing to clean */ } }
        };
        const runWith = async (mod, opts) => {
          const { deps } = makeDeps(opts);
          const { target, wire } = makeWire();
          await mod.runBw2Turn({
            question: opts.question, messages: [{ role: 'user', content: opts.question }], mode: 'brief', band: 'adult', system: 'SYSTEM', model: 'writer-model', maxTokens: 4096,
            providerUrl: 'https://api.anthropic.invalid/v1/messages', headers: {}, libFlagValue: '', libToken: '', lessonsToken: '', takhrijWired: true, cards, wire, requestStartedAt: Date.now(),
            env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' }, runtime: '', deps,
          });
          return deltasOf(framesOf(target)).join('');
        };
        seenQuestions.length = 0;
        const mA = await mutateModule('lib/before-writing-v2.js', "question: gradeHeadWanted ? '' : question, env,", 'question, env,', 'closings-keep-question');
        const tA = await runWith(mA, { question: Q_GRADE, writerText: U.matn, takhrijImpl: closing, gradingHead: headOf(HEAD6) });
        ok('FIX48-6 MUTANT KILLED: if the closings keep the question a second head is written beside the first', tA.split('CLOSING-HEAD').length > 1 && tA.includes(HEAD6));
        const mB = await mutateModule('lib/bw2-units.js', "const lead = leadPending;\n    leadPending = '';\n    if (!emit(lead ? lead + '\\n\\n' + piece : piece))", "const lead = '';\n    leadPending = '';\n    if (!emit(lead ? lead + '\\n\\n' + piece : piece))", 'lead-never-sent');
        const outB = [];
        const relB = mB.createBw2Releaser({ rows: [{ ...ROW_F1, ref: 1 }, { ...ROW_F2, ref: 2 }], emit: (p) => { outB.push(p); return true; }, leadLine: HEAD6 });
        relB.push(U.s1 + '\n');
        await relB.end();
        ok('FIX48-6 MUTANT KILLED: a releaser that never sends its lead line shows no head', !outB.join('').includes(HEAD6));
        const relOk = [];
        const relGood = UNITS.createBw2Releaser({ rows: [{ ...ROW_F1, ref: 1 }, { ...ROW_F2, ref: 2 }], emit: (p) => { relOk.push(p); return true; }, leadLine: HEAD6 });
        relGood.push(U.s1 + '\n' + U.s3 + '\n');
        const sumGood = await relGood.end();
        ok('FIX48-6h the releaser sends its lead line once, in front of the first unit, and the first unit is still the opening unit (the lead line is no part of the units\' text)',
          relOk.join('').startsWith(HEAD6 + '\n\n') && relOk.join('').split(HEAD6).length === 2 && !sumGood.text.includes(HEAD6) && sumGood.released === 2, ascii(relOk.join('|')));
      }
      // SPEED FIX 5, C7: the source questions themselves. Their answers here name no source (a matn, its meaning, a
      // masah ruling), so nothing is proved on the asked hadith and nothing goes out but the not-covered sentence; with
      // a unit the row proves ("rawahu Muslim fi sahihihi min hadith Tamim al-Dari"), that unit goes out first and today's checks follow.
      const s6 = await run({ question: Q6_SOURCE, fatwa: [ROW_Q6], writerText: w, takhrijImpl: silent });
      const s11 = await run({ question: F.q11, writerText: F.authHeld11 + ' ' + F.a11[0] + ' ' + U.s1 });
      const PROVED6 = '\u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647 \u0645\u0646 \u062d\u062f\u064a\u062b \u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 [[1]].';
      const p6 = await run({ question: Q6_SOURCE, fatwa: [ROW_Q6], writerText: [PROVED6, w].join('\n'), takhrijImpl: silent });
      ok('C7i the source questions of q6 and q11: no proved unit, the not-covered sentence and the offer alone; a proved unit first, then today\x27s checks',
        UNITS.asksHadithSource(Q6_SOURCE) && UNITS.asksHadithSource(F.q11) && !UNITS.asksHadithSource(Q6)
        && s6.deltas.join('') === NOT_COVERED && hasOffer(s6) && s6.out.telemetry.heldDependentOpening >= 1
        && s11.deltas.join('') === NOT_COVERED && hasOffer(s11)
        && p6.deltas.join('').startsWith(PROVED6.replace(' [[1]]', '')) && p6.deltas.join('').includes(Q6_MATN) && p6.deltas.join('').includes(Q6_AFTER)
        && p6.out.telemetry.unitsProvedHadith >= 1 && !hasOffer(p6),
        ascii(s6.deltas.join('|') + ' || ' + s11.deltas.join('|') + ' || ' + p6.deltas.join('|')) + JSON.stringify([s6, s11, p6].map((r) => r.out.telemetry.heldDependentOpening)));
    }
    {
      const TOL = 250;
      const REC = { id: 'E1', term: '\u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628', part: 1, snippet: MASAH_RULING, text: MASAH_RULING + '\u060c ' + MASAH_TERM };
      const cold = await run({ encyclopediaReady: () => false, warm: () => new Promise(() => {}), hang: { encyclopedia: true }, budget: 1500, writerText: U.s1 });
      const ct = cold.out.telemetry;
      ok('C2a a cold encyclopedia that never finishes building costs at most BW2_ENCYC_COLD_MS (300) + ' + TOL + ' ms, not the budget',
        cold.calls.writerAt !== null && cold.calls.writerAt <= 300 + TOL && ct.encyclopediaCold === true && ct.encyclopediaTimedOut === false
        && ct.encyclopediaHits === 0 && ct.encyclopediaMs <= 300 + TOL && cold.calls.search === 0, JSON.stringify({ at: cold.calls.writerAt, ct }));
      ok('C2b ...its load was started in the background for later requests (and the turn still answered)',
        cold.calls.warm >= 2 && cold.deltas.join('').includes(MASAH_RULING), String(cold.calls.warm));
      const hung = await run({ encyclopediaReady: () => true, hang: { encyclopedia: true }, budget: 1500, writerText: U.s1 });
      ok('C2c control: a WARM encyclopedia whose search hangs still waits the retrieval budget, as before',
        hung.calls.writerAt >= 1500 && hung.out.telemetry.encyclopediaTimedOut === true && hung.out.telemetry.encyclopediaCold === false,
        String(hung.calls.writerAt));
      const envCold = await run({ encyclopediaReady: () => false, warm: () => new Promise(() => {}), budget: 1500, writerText: U.s1, env: { BW2_ENCYC_COLD_MS: '60' } });
      ok('C2d BW2_ENCYC_COLD_MS sets the wait (default 300)', envCold.calls.writerAt <= 60 + TOL && BW2.encyclopediaColdMs({}) === 300
        && BW2.BW2_ENCYC_COLD_MS_DEFAULT === 300 && BW2.encyclopediaColdMs({ BW2_ENCYC_COLD_MS: '60' }) === 60, String(envCold.calls.writerAt));
      let built = false;
      const quick = await run({ encyclopediaReady: () => built, warm: () => new Promise((r) => setTimeout(() => { built = true; r(true); }, 40)), encyclopedia: [REC], budget: 1500, writerText: U.s1 });
      ok('C2e a cold index that finishes inside the wait is searched as usual (not cold, its rows used)',
        quick.out.telemetry.encyclopediaCold === false && quick.out.telemetry.encyclopediaHits === 1 && quick.calls.search === 1,
        JSON.stringify(quick.out.telemetry));
      const warmRun = async () => {
        const { deps, calls } = makeDeps({ encyclopedia: [REC], encyclopediaReady: () => true });
        const g = await BW2.gatherBw2({ question: Q_MASAH, budgetMs: 1500, deps });
        return { g, calls };
      };
      const a = await warmRun();
      const b = await warmRun();
      const expect = [{ ...TOOLS.encyclopediaRow(REC), fullText: String(REC.text).slice(0, BW2.BW2_ENCYC_CHARS) }];
      ok('C2f the warm path: rows exactly as the unchanged mapping builds them, one search, no warm call, never cold',
        JSON.stringify(a.g.results.encyclopedia) === JSON.stringify(expect) && JSON.stringify(a.g.results) === JSON.stringify(b.g.results)
        && a.calls.search === 1 && a.calls.warm === 0 && a.g.encyclopediaCold === false && a.g.report.encyclopedia.timedOut === false
        && a.g.report.encyclopedia.hits === 1, ascii(JSON.stringify(a.g.results.encyclopedia)));
      const ENC = await esm('lib/encyclopedia.js');
      ok('C2g lib/encyclopedia.js reports readiness without building (false before any build in this process)',
        typeof ENC.encyclopediaReady === 'function' && ENC.encyclopediaReady() === false);
    }
    {
      const r = await run({ writerText: [U.bad, U.s1, U.bad, U.s3].join(' ') });
      const t = r.out.telemetry;
      const heldSum = UNITS.BW2_HOLD_REASONS.reduce((n, reason) => n + t[UNITS.heldFieldOf(reason)], 0);
      ok('C3a holds before the first release are counted apart: 1 of the 2 held units came before it',
        t.heldBeforeFirst === 1 && t.unitsHeld === 2 && heldSum === 2 && t.heldUnsupportedAttribution === 2, JSON.stringify(t));
      ok('C3b writerStartMs <= firstTokenMs <= firstReleaseMs, all integers from the request start',
        [t.writerStartMs, t.firstTokenMs, t.firstReleaseMs].every(Number.isInteger)
        && t.writerStartMs <= t.firstTokenMs && t.firstTokenMs <= t.firstReleaseMs, JSON.stringify([t.writerStartMs, t.firstTokenMs, t.firstReleaseMs]));
      const one = await run({ fatwa: [ROW_F1], writerText: U.s1 });
      ok('C3c pinnedRows and pinnedChars measure the pinned table',
        t.pinnedRows === 2 && one.out.telemetry.pinnedRows === 1 && Number.isInteger(t.pinnedChars)
        && t.pinnedChars > one.out.telemetry.pinnedChars && one.out.telemetry.pinnedChars > 0, JSON.stringify([t.pinnedChars, one.out.telemetry.pinnedChars]));
      const mk = await run({ writerText: MARKER });
      ok('C3d markerSeen: true on the writer\'s marker, false otherwise', mk.out.telemetry.markerSeen === true && t.markerSeen === false
        && mk.out.telemetry.heldNotCovered === 0);
      const tk = await run({ writerText: [U.matn, U.s3].join(' '), takhrij: true });
      ok('C3e the takhrij lookups: one lookup, one matched matn, an integer sum of milliseconds; none without a matn',
        tk.out.telemetry.takhrijLookups === 1 && tk.out.telemetry.takhrijMatched === 1 && Number.isInteger(tk.out.telemetry.takhrijMs)
        && t.takhrijLookups === 0 && t.takhrijMs === 0, JSON.stringify(tk.out.telemetry));
      const src = read('lib/bw2-units.js');
      const named = new Set([...src.matchAll(/hold\('([a-z_]+)'/g), ...src.matchAll(/reason: '([a-z_]+)'/g),
        ...src.matchAll(/\? '([a-z_]+)' : '([a-z_]+)', pendingLead/g)].flatMap((m) => m.slice(1).filter(Boolean)));
      ok('C3f every hold reason the code names is in BW2_HOLD_REASONS, and the list names no other',
        named.size === UNITS.BW2_HOLD_REASONS.length && [...named].every((n) => UNITS.BW2_HOLD_REASONS.includes(n)),
        JSON.stringify([...named].filter((n) => !UNITS.BW2_HOLD_REASONS.includes(n))) + ' ' + named.size);
      const askSrc = read('api/ask.js');
      const logAt = askSrc.indexOf("console.log('[bw2]', {");
      const block = askSrc.slice(logAt, askSrc.indexOf('});', logAt));
      const NEW = ['writerStartMs', 'firstTokenMs', 'heldBeforeFirst', 'markerSeen', 'takhrijLookups', 'takhrijMs', 'takhrijMatched',
        'pinnedRows', 'pinnedChars', 'encyclopediaCold', ...UNITS.BW2_HOLD_REASONS.map(UNITS.heldFieldOf)];
      ok('C3g api/ask.js prints every new field from the telemetry object, and the turn builds every one of them',
        NEW.every((n) => block.includes(n + ': t.' + n + ',') && n in t), JSON.stringify(NEW.filter((n) => !block.includes(n + ': t.' + n + ','))));
    }

    // ---------------------------------------------------------------- SPEED FIX 3: C4
    // Built from the owner tool's round 3 (EZIK-SPEED-PREVIEW3-CHAT-2026-09-27): question 1 verbatim, and the
    // live-search answer after it, whose opening names the collection and the narrator. Seven writer units in
    // the shape the preview measured: on c38aa44 they give exactly its record -- 1 released, 6 held
    // (unsupported attribution 3, uncited attribution 2, dependent on a held unit 1) and the not-covered
    // sentence. The kept rows: one carries the hadith's text with the collection and the narrator named, one
    // the text alone, one neither.
    {
      const Q1 = '\u0623\u064a\u0646 \u0648\u0631\u062f \u062d\u062f\u064a\u062b: \u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u061f \u0648\u0645\u0646 \u0631\u0648\u0627\u0647\u061f';
      const MATN = '\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629';
      const R_ALL_TEXT = '\u0639\u0646 \u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: \u00ab\u0627\u0644\u062f\u0650\u0651\u064a\u0646\u064f \u0627\u0644\u0646\u064e\u0651\u0635\u0650\u064a\u062d\u064e\u0629\u064f\u00bb \u0642\u064f\u0644\u0652\u0646\u064e\u0627: \u0644\u0650\u0645\u064e\u0646\u0652 \u064a\u064e\u0627 \u0631\u064e\u0633\u064f\u0648\u0644\u064e \u0627\u0644\u0644\u064e\u0651\u0647\u0650\u061f \u0642\u064e\u0627\u0644\u064e: \u00ab\u0644\u0650\u0644\u064e\u0651\u0647\u0650 \u0648\u064e\u0644\u0650\u0643\u0650\u062a\u064e\u0627\u0628\u0650\u0647\u0650 \u0648\u064e\u0644\u0650\u0631\u064e\u0633\u064f\u0648\u0644\u0650\u0647\u0650 \u0648\u064e\u0644\u0650\u0623\u064e\u0626\u0650\u0645\u064e\u0651\u0629\u0650 \u0627\u0644\u0652\u0645\u064f\u0633\u0652\u0644\u0650\u0645\u0650\u064a\u0646\u064e \u0648\u064e\u0639\u064e\u0627\u0645\u064e\u0651\u062a\u0650\u0647\u0650\u0645\u0652\u00bb. \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647. \u0648\u0647\u0630\u0627 \u062d\u062f\u064a\u062b \u0639\u0638\u064a\u0645 \u062c\u0627\u0645\u0639.';
      const R_TEXT_TEXT = '\u0642\u0627\u0644 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u00bb \u0642\u0644\u0646\u0627 \u0644\u0645\u0646 \u064a\u0627 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647\u061f \u0642\u0627\u0644: \u00ab\u0644\u0644\u0647 \u0648\u0644\u0643\u062a\u0627\u0628\u0647 \u0648\u0644\u0631\u0633\u0648\u0644\u0647 \u0648\u0644\u0623\u0626\u0645\u0629 \u0627\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0648\u0639\u0627\u0645\u062a\u0647\u0645\u00bb. \u0648\u0627\u0644\u0646\u0635\u064a\u062d\u0629 \u0643\u0644\u0645\u0629 \u062c\u0627\u0645\u0639\u0629.';
      const R_NONE_TEXT = '\u0627\u0644\u0646\u0635\u064a\u062d\u0629 \u0644\u0648\u0644\u0627\u0629 \u0627\u0644\u0623\u0645\u0631 \u062a\u0643\u0648\u0646 \u0628\u0627\u0644\u062f\u0639\u0627\u0621 \u0644\u0647\u0645 \u0648\u0628\u064a\u0627\u0646 \u0627\u0644\u062d\u0642 \u0644\u0647\u0645 \u0633\u0631\u0627.';
      const R_ALL = { ...ROW_F1, title: 'Q1-ALL', url: 'https://binbaz.org.sa/audios/101', recordId: '101', text: R_ALL_TEXT, passage: R_ALL_TEXT };
      const R_TEXT = { ...ROW_F1, title: 'Q1-TEXT', url: 'https://binbaz.org.sa/audios/102', recordId: '102', text: R_TEXT_TEXT, passage: R_TEXT_TEXT };
      const R_NONE = { ...ROW_F1, title: 'Q1-NONE', url: 'https://binbaz.org.sa/fatwas/103', recordId: '103', text: R_NONE_TEXT, passage: R_NONE_TEXT };
      const W1 = '\u0648\u0631\u062f \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0639\u0646\u062f \u0627\u0644\u0625\u0645\u0627\u0645 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647\u060c \u0645\u0646 \u062d\u062f\u064a\u062b \u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W2 = (textRef) => '\u0648\u0646\u0635 \u0627\u0644\u062d\u062f\u064a\u062b \u0639\u0646\u062f \u0627\u0644\u0625\u0645\u0627\u0645 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647: \u00ab\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u00bb [[' + textRef + ']].';
      const W3 = '\u0648\u062d\u062f\u064a\u062b \u00ab\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u00bb \u0623\u062e\u0631\u062c\u0647 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647.';
      const W4 = '\u0648\u0647\u0630\u0627 \u064a\u062f\u0644 \u0639\u0644\u0649 \u0639\u0638\u0645 \u0634\u0623\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629.';
      const W5 = (noneRef) => '\u0648\u0642\u0627\u0644 \u0627\u0644\u0646\u0648\u0648\u064a: \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0639\u0644\u064a\u0647 \u0645\u062f\u0627\u0631 \u0627\u0644\u0625\u0633\u0644\u0627\u0645 [[' + noneRef + ']].';
      const W6 = '\u0648\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0623\u064a\u0636\u0627.';
      const W7 = '\u0648\u0627\u0644\u0646\u0635\u064a\u062d\u0629 \u0645\u0646 \u0623\u0639\u0638\u0645 \u0623\u0628\u0648\u0627\u0628 \u0627\u0644\u062f\u064a\u0646.';
      const q1Text = (textRef, noneRef) => [W1, W2(textRef), W3, W4, W5(noneRef), W6, W7].join('\n');
      const silent = async (text) => ({ text, entries: text.includes(MATN) ? [{ matn: MATN, silent: true, sourced: false }] : [] });
      const drop = (s) => String(s).replace(/\s*\[\[\d+\]\]/g, '');

      // Refs follow the candidate order: R_ALL 1, R_TEXT 2, R_NONE 3.
      const c = await run({ question: Q1, fatwa: [R_ALL, R_TEXT, R_NONE], writerText: q1Text(2, 3), takhrijImpl: silent });
      const t = c.deltas.join('');
      const tel = c.out.telemetry;
      ok('C4a q1: the units the carrying row proves are released on it -- the opening that names Muslim and Tamim al-Dari, cited or not',
        t.startsWith(W1) && t.includes(drop(W2(2))) && t.includes(W3) && tel.unitsProvedHadith === 3
        && t.includes('binbaz.org.sa/audios/101'), ascii(c.deltas.join('|')) + ' ' + JSON.stringify(tel));
      ok('C4b ...no not-covered sentence and no offer; the connector after a proved unit follows it out; the rest held as today',
        !t.includes(NOT_COVERED) && !hasOffer(c) && t.includes(W4) && t.includes(W7) && tel.unitsReleased === 5 && tel.unitsHeld === 2
        && tel.heldUnsupportedAttribution === 1 && tel.heldUncitedAttribution === 1 && tel.heldDependentOnHeld === 0, JSON.stringify(tel));
      ok('C4c a unit naming the wrong collection stays held, and a scholar\'s credit with no row for it stays held',
        !t.includes(W6) && !t.includes(drop(W5(3))), ascii(t));

      // The same answer when no kept row names Muslim: the row that carries the text alone proves nothing more.
      const n = await run({ question: Q1, fatwa: [R_TEXT, R_NONE], writerText: q1Text(1, 2), takhrijImpl: silent });
      const nt = n.deltas.join('');
      ok('C4d a row that carries the text without the named collection does not prove it: held, as today, and the not-covered sentence',
        !nt.includes(W1) && !nt.includes(W3) && n.out.telemetry.unitsProvedHadith === 0 && nt.includes(NOT_COVERED) && hasOffer(n)
        && n.out.telemetry.heldUnsupportedAttribution === 3 && n.out.telemetry.heldUncitedAttribution === 2 && n.out.telemetry.heldDependentOnHeld === 1,
        ascii(nt) + ' ' + JSON.stringify(n.out.telemetry));
      // ...unless the takhrij proves it. The local library's own answer for this hadith, measured: sourced, "(Muslim)",
      // no Companion named. So it proves the unit that names Muslim, and not the one that also names Tamim al-Dari.
      const byLibrary = async (text) => {
        if (!text.includes(MATN)) return { text, entries: [] };
        const stated = /\u0623\u062e\u0631\u062c\u0647|\u0645\u0633\u0644\u0645/u.test(text.replace(/\u00ab[^\u00bb]*\u00bb/gu, ''));
        return stated
          ? { text, entries: [{ matn: MATN, sourced: false, withheld: '\u0645\u0633\u0644\u0645', proseProof: ['\u0645\u0633\u0644\u0645', '\u0627\u0644\u0646\u0633\u0627\u0626\u064a'], companion: '', declined: 'prose_states_attribution' }] }
          : { text: text.replace('\u00bb', '\u00bb (\u0645\u0633\u0644\u0645)'), entries: [{ matn: MATN, sourced: true, parenthetical: '\u0645\u0633\u0644\u0645', companion: '' }] };
      };
      const b = await run({ question: Q1, fatwa: [R_TEXT, R_NONE], writerText: [W3, W1].join('\n'), takhrijImpl: byLibrary });
      const bt = b.deltas.join('');
      ok('C4e (b) the takhrij proves the text and Muslim: that unit is released, uncited, and counts as covered; the one naming the narrator it did not name stays held',
        bt.startsWith(W3) && !bt.includes(W1) && b.out.telemetry.unitsProvedHadith === 1 && !bt.includes(NOT_COVERED) && !hasOffer(b)
        && b.out.telemetry.heldUnsupportedAttribution === 1 && b.out.telemetry.takhrijLookups === 2, ascii(bt) + ' ' + JSON.stringify(b.out.telemetry));
      const NARRATED = '\u0639\u0646 \u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: \u00ab\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u00bb.';
      const withCompanion = async (text) => (text.includes(MATN)
        ? { text: text.replace('\u00bb', '\u00bb (\u0645\u0633\u0644\u0645)'), entries: [{ matn: MATN, sourced: true, parenthetical: '\u0645\u0633\u0644\u0645', companion: '\u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a' }] }
        : { text, entries: [] });
      const bc = await run({ question: Q1, fatwa: [R_NONE], writerText: NARRATED, takhrijImpl: withCompanion });
      ok('C4f (b) with the Companion named: released with the takhrij\'s parenthetical, as today, and one lookup',
        bc.deltas.join('').includes('\u00bb (\u0645\u0633\u0644\u0645)') && bc.out.telemetry.unitsProvedHadith === 1 && bc.out.telemetry.takhrijLookups === 1
        && !bc.deltas.join('').includes(NOT_COVERED), ascii(bc.deltas.join('|')) + ' ' + JSON.stringify(bc.out.telemetry));

      // A failed or timed-out lookup proves nothing: the units are held exactly as with a silent one.
      const fails = async () => { throw new Error('library 503'); };
      const late = () => new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 30));
      const f1 = await run({ question: Q1, fatwa: [R_TEXT, R_NONE], writerText: q1Text(1, 2), takhrijImpl: fails });
      const f2 = await run({ question: Q1, fatwa: [R_TEXT, R_NONE], writerText: q1Text(1, 2), takhrijImpl: late });
      const same = (r) => ['unitsReleased', 'unitsHeld', 'heldUnsupportedAttribution', 'heldUncitedAttribution', 'heldDependentOnHeld', 'unitsProvedHadith']
        .every((k) => r.out.telemetry[k] === n.out.telemetry[k]) && r.deltas.join('') === nt;
      ok('C4g a takhrij failure or timeout holds as today (the same text and holds as the silent lookup), and every lookup is counted',
        same(f1) && same(f2) && f1.out.telemetry.takhrijLookups >= 3 && f2.out.telemetry.takhrijLookups >= 3,
        JSON.stringify([f1.out.telemetry.takhrijLookups, f2.out.telemetry.takhrijLookups]));

      // The dependency and lead-in rules around a proved unit.
      const LEAD = '\u0648\u0646\u0635\u0647:';
      const ld = await run({ question: Q1, fatwa: [R_ALL], writerText: [LEAD, NARRATED].join('\n'), takhrijImpl: silent });
      ok('C4h a lead-in goes out with the proved unit it introduces, in one delta',
        (ld.deltas[0] || '').startsWith(LEAD + '\n') && (ld.deltas[0] || '').includes(MATN) && ld.out.telemetry.unitsProvedHadith === 1,
        ascii(ld.deltas.join('|')));
      const OPEN = '\u0648\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645.';
      const op = await run({ question: Q1, fatwa: [R_ALL], writerText: [OPEN, W3].join('\n'), takhrijImpl: silent });
      const dh = await run({ question: Q1, fatwa: [R_ALL, R_NONE], writerText: [W5(2), OPEN, W3].join('\n'), takhrijImpl: silent });
      ok('C4i no answer opens on a connector, proved or not; and a proved unit that leans on a held one is held with it',
        !op.deltas.join('').includes(OPEN) && op.out.telemetry.heldDependentOpening === 1 && op.deltas.join('').startsWith(noWaw(W3))
        && !dh.deltas.join('').includes(OPEN) && dh.out.telemetry.heldDependentOnHeld === 1 && dh.deltas.join('').includes(noWaw(W3)),
        ascii(op.deltas.join('|') + ' || ' + dh.deltas.join('|')));
      const WRONG = '\u0648\u062d\u062f\u064a\u062b \u00ab\u0627\u0644\u062f\u064a\u0646 \u0627\u0644\u0646\u0635\u064a\u062d\u0629\u00bb \u0623\u062e\u0631\u062c\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0641\u064a \u0635\u062d\u064a\u062d\u0647.';
      const SCHOLAR = '\u0648\u0642\u0627\u0644 \u0627\u0644\u0646\u0648\u0648\u064a: \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0639\u0644\u064a\u0647 \u0645\u062f\u0627\u0631 \u0627\u0644\u0625\u0633\u0644\u0627\u0645.';
      const wr = await run({ question: Q1, fatwa: [R_ALL], writerText: [W3, WRONG, SCHOLAR].join('\n'), takhrijImpl: silent });
      ok('C4j with the carrying row kept: the wrong collection and the scholar\'s uncited credit stay held; the right one goes out',
        wr.deltas.join('').startsWith(W3) && !wr.deltas.join('').includes('\u0627\u0644\u0628\u062e\u0627\u0631\u064a') && !wr.deltas.join('').includes('\u0627\u0644\u0646\u0648\u0648\u064a')
        && wr.out.telemetry.unitsProvedHadith === 1 && wr.out.telemetry.unitsHeld === 2, ascii(wr.deltas.join('|')));
      ok('C4k the readers: the question\'s hadith, the collections and the narrator a unit names, and a credit holding an unknown name is not waived',
        UNITS.askedHadithOf(Q1) === MATN && UNITS.askedHadithOf('\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u062d \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0631\u0628\u061f') === ''
        && JSON.stringify(UNITS.collectionsNamed(W1)) === JSON.stringify(['\u0645\u0633\u0644\u0645']) && UNITS.collectionsNamed('\u064a\u062c\u0628 \u0639\u0644\u0649 \u0643\u0644 \u0645\u0633\u0644\u0645').length === 0
        && JSON.stringify(UNITS.collectionsNamed('\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645')) === JSON.stringify(['\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0645\u0633\u0644\u0645'])
        && JSON.stringify(UNITS.narratorsNamed(W1)) === JSON.stringify(['\u062a\u0645\u064a\u0645 \u0627\u0644\u062f\u0627\u0631\u064a'])
        && UNITS.claimOnlyNames('\u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647', { collections: ['\u0645\u0633\u0644\u0645'], narrators: [] })
        && !UNITS.claimOnlyNames('\u0645\u0633\u0644\u0645 \u0648\u0627\u0628\u0646 \u0623\u0628\u064a \u0634\u064a\u0628\u0629', { collections: ['\u0645\u0633\u0644\u0645'], narrators: [] }));
      const askSrc = read('api/ask.js');
      ok('C4l unitsProvedHadith is built by the turn, printed by api/ask.js [bw2] and allow-listed',
        Number.isInteger(tel.unitsProvedHadith) && askSrc.includes('unitsProvedHadith: t.unitsProvedHadith,')
        && read('guards/telemetry-text-guard.cjs').includes("'unitsProvedHadith',"));
      // SPEED FIX 4: the Q1 fixture's released text, byte for byte, as 142a100 released it (SHA-256 measured there).
      ok('C6f FIX3\x27s Q1 fixture releases as before under C5 and C6: the same bytes, 5 released, 2 held, 3 proved',
        require('crypto').createHash('sha256').update(t).digest('hex') === 'cacc99a08ac16ac782b62b29f4276f39c9d1de563952426cc03a0cb7e7dc5398'
        && tel.unitsReleased === 5 && tel.unitsHeld === 2 && tel.unitsProvedHadith === 3, JSON.stringify(tel));
    }

    // ---------------------------------------------------------------- SPEED FIX 4: C5, C6
    // Built from the owner tool's round 4 (EZIK-SPEED-PREVIEW4-LIVE-2026-09-27): question 2 verbatim and its answer 2
    // (the only sentence the preview showed); the kept rows are the local library index's own rows for this hadith
    // (ezik-shamela-20260820): Ibn Rajab's Jami' al-Ulum wal-Hikam at 1:301-302 (the hadith, "rawahu al-Bukhari wa
    // Muslim", Anas ibn Malik) and 1:303-304 (answer 2's source), and the Kuwaiti encyclopedia at 38:233 (the text
    // alone). Refs follow the candidate order: 1:301 = 1, 1:303 = 2, the encyclopedia = 3.
    {
      const Q2 = '\u0645\u0646 \u0631\u0648\u0649 \u062d\u062f\u064a\u062b: \u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647\u061f';
      const MATN = '\u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647';
      const W_ANAS = '\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W_AGREED = '\u0648\u0627\u0644\u062d\u062f\u064a\u062b \u0645\u062a\u0641\u0642 \u0639\u0644\u064a\u0647 \u0645\u0646 \u062d\u062f\u064a\u062b \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 [[1]].';
      const W_NISBA = '\u0631\u0648\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u064a\u0647\u0645\u0627 \u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0646\u0635\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W_SUBJECT = '\u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647\u060c \u0648\u0623\u062e\u0631\u062c\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
      const W_HURAYRA = '\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0628\u064a \u0647\u0631\u064a\u0631\u0629 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W_SIRIN = '\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0633\u064a\u0631\u064a\u0646 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W_DAWUD = '\u0631\u0648\u0627\u0647 \u0623\u0628\u0648 \u062f\u0627\u0648\u062f \u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const W_PLAIN = '\u0648\u0645\u062d\u0628\u0629 \u0627\u0644\u062e\u064a\u0631 \u0644\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0645\u0646 \u0643\u0645\u0627\u0644 \u0627\u0644\u0625\u064a\u0645\u0627\u0646.';
      const W_OWN = '\u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: \u00ab\u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647\u00bb\u060c \u0648\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
      const AGREED = '\u0645\u062a\u0641\u0642 \u0639\u0644\u064a\u0647';
      const F_ANAS = '\u0627\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643';
      const F_NISBA = '\u0627\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0646\u0635\u0627\u0631\u064a';
      const F_SIRIN = '\u0627\u0646\u0633 \u0628\u0646 \u0633\u064a\u0631\u064a\u0646';
      const F_HURAYRA = '\u0627\u0628\u0648 \u0647\u0631\u064a\u0631\u0647';
      const F_ROW_ANAS = '\u0639\u0646 \u0627\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647';
      const F_ROW_BAKR = '\u0639\u0646 \u0627\u0628\u064a \u0628\u0643\u0631 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647';
      const CREDIT_AN = '\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646';
      const NOT_BACK_1 = '\u0641\u064a \u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646 \u0639\u0646 \u0623\u0646\u0633 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const NOT_BACK_2 = '\u0641\u064a \u0631\u0648\u0627\u064a\u0629 \u0645\u0633\u0644\u0645: \u00ab\u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647\u00bb.';
      const NOT_BACK_3 = '\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645.';
      const A2 = '\u0648\u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0646\u0649 \u0623\u064a\u0636\u0627 \u0645\u0627 \u0631\u0648\u064a \u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644 \u0644\u0623\u0628\u064a \u0647\u0631\u064a\u0631\u0629: "\u0623\u062d\u0628 \u0644\u0644\u0646\u0627\u0633 \u0645\u0627 \u062a\u062d\u0628 \u0644\u0646\u0641\u0633\u0643 \u062a\u0643\u0646 \u0645\u0633\u0644\u0645\u0627"\u060c \u062e\u0631\u062c\u0647 \u0627\u0644\u062a\u0631\u0645\u0630\u064a \u0648\u0627\u0628\u0646 \u0645\u0627\u062c\u0647.';
      const R301 = { kind: 'lib_book', title: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637 \u00b7 \u062c1 \u00b7 \u0635301-302', url: '', publisher: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a', recordId: 'lib:FC-001812:0014:001',
        bookTitle: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637', author: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a', locator: '\u062c1 \u00b7 \u0635301-302',
        text: '[\u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u0627\u0644\u062b\u0651\u064e\u0627\u0644\u0650\u062b\u064e \u0639\u064e\u0634\u064e\u0631\u064e \u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650] \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u0627\u0644\u062b\u0651\u064e\u0627\u0644\u0650\u062b\u064e \u0639\u064e\u0634\u064e\u0631\u064e \u0639\u064e\u0646\u0652 \u0623\u064e\u0646\u064e\u0633\u0650 \u0628\u0652\u0646\u0650 \u0645\u064e\u0627\u0644\u0650\u0643\u064d \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0646\u0652\u0647\u064f\u060c \u0639\u064e\u0646\u0650 \u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0642\u064e\u0627\u0644\u064e: \u00ab\u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650.\u00bb \u0631\u064e\u0648\u064e\u0627\u0647\u064f \u0627\u0644\u0652\u0628\u064f\u062e\u064e\u0627\u0631\u0650\u064a\u0651\u064f \u0648\u064e\u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064c. -\u0647\u064e\u0630\u064e\u0627 \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u062e\u064e\u0631\u064e\u062c\u0651\u064e\u0627\u0647\u064f \u0641\u0650\u064a " \u0627\u0644\u0635\u0651\u064e\u062d\u0650\u064a\u062d\u064e\u064a\u0652\u0646\u0650 " \u0645\u0650\u0646\u0652 \u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0642\u064e\u062a\u064e\u0627\u062f\u064e\u0629\u064e\u060c \u0639\u064e\u0646\u0652 \u0623\u064e\u0646\u064e\u0633\u064d\u060c \u0648\u064e\u0644\u064e\u0641\u0652\u0638\u064f \u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064d " \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u062c\u064e\u0627\u0631\u0650\u0647\u0650 \u0623\u064e\u0648\u0652 \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 " \u0628\u0650\u0627\u0644\u0634\u0651\u064e\u0643\u0651\u0650. \u0648\u064e\u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f\u060c \u0648\u064e\u0644\u064e\u0641\u0652\u0638\u064f\u0647\u064f: " \u0644\u064e\u0627 \u064a\u064e\u0628\u0652\u0644\u064f\u063a\u064f \u0639\u064e\u0628\u0652\u062f\u064c \u062d\u064e\u0642\u0650\u064a\u0642\u064e\u0629\u064e \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0652\u062e\u064e\u064a\u0652\u0631\u0650 ". \u0648\u064e\u0647\u064e\u0630\u0650\u0647\u0650 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u064f \u062a\u064f\u0628\u064e\u064a\u0651\u0650\u0646\u064f \u0645\u064e\u0639\u0652\u0646\u064e\u0649 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u0650 \u0627\u0644\u0652\u0645\u064f\u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0629\u0650 \u0641\u0650\u064a " \u0627\u0644\u0635\u0651\u064e\u062d\u0650\u064a\u062d\u064e\u064a\u0652\u0646\u0650 "\u060c \u0648\u064e\u0623\u064e\u0646\u0651\u064e \u0627\u0644\u0652\u0645\u064f\u0631\u064e\u0627\u062f\u064e \u0628\u0650\u0646\u064e\u0641\u0652\u064a\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0646\u064e\u0641\u0652\u064a\u064f \u0628\u064f\u0644\u064f\u0648\u063a\u0650 \u062d\u064e\u0642\u0650\u064a\u0642\u064e\u062a\u0650\u0647\u0650 \u0648\u064e\u0646\u0650\u0647\u064e\u0627\u064a\u064e\u062a\u0650\u0647\u0650\u060c \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064e \u0643\u064e\u062b\u0650\u064a\u0631\u064b\u0627 \u0645\u064e\u0627 \u064a\u064f\u0646\u0652\u0641\u064e\u0649 \u0644\u0650\u0627\u0646\u0652\u062a\u0650\u0641\u064e\u0627\u0621\u0650 \u0628\u064e\u0639\u0652\u0636\u0650 \u0623\u064e\u0631\u0652\u0643\u064e\u0627\u0646\u0650\u0647\u0650 \u0648\u064e\u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0627\u062a\u0650\u0647\u0650\u060c \u0643\u064e\u0642\u064e\u0648\u0652\u0644\u0650\u0647\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e: \u00ab\u0644\u064e\u0627 \u064a\u064e\u0632\u0652\u0646\u0650\u064a \u0627\u0644\u0632\u0651\u064e\u0627\u0646\u0650\u064a \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0632\u0652\u0646\u0650\u064a \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c \u0648\u064e\u0644\u064e\u0627 \u064a\u064e\u0633\u0652\u0631\u0650\u0642\u064f \u0627\u0644\u0633\u0651\u064e\u0627\u0631\u0650\u0642\u064f \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0633\u0652\u0631\u0650\u0642\u064f \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c \u0648\u064e\u0644\u064e\u0627 \u064a\u064e\u0634\u0652\u0631\u064e\u0628\u064f \u0627\u0644\u0652\u062e\u064e\u0645\u0652\u0631\u064e \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0634\u0652\u0631\u064e\u0628\u064f\u0647\u064e\u0627 \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c\u00bb \u0648\u064e\u0642\u064e\u0648\u0652\u0644\u0650\u0647\u0650: \u00ab\u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0645\u064e\u0646\u0652 \u0644\u064e\u0627 \u064a\u064e\u0623\u0652\u0645\u064e\u0646\u064f \u062c\u064e\u0627\u0631\u064f\u0647\u064f \u0628\u064e\u0648\u064e\u0627\u0626\u0650\u0642\u064e\u0647\u064f\u00bb .', fullText: '[\u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u0627\u0644\u062b\u0651\u064e\u0627\u0644\u0650\u062b\u064e \u0639\u064e\u0634\u064e\u0631\u064e \u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650] \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u0627\u0644\u062b\u0651\u064e\u0627\u0644\u0650\u062b\u064e \u0639\u064e\u0634\u064e\u0631\u064e \u0639\u064e\u0646\u0652 \u0623\u064e\u0646\u064e\u0633\u0650 \u0628\u0652\u0646\u0650 \u0645\u064e\u0627\u0644\u0650\u0643\u064d \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0646\u0652\u0647\u064f\u060c \u0639\u064e\u0646\u0650 \u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0642\u064e\u0627\u0644\u064e: \u00ab\u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650.\u00bb \u0631\u064e\u0648\u064e\u0627\u0647\u064f \u0627\u0644\u0652\u0628\u064f\u062e\u064e\u0627\u0631\u0650\u064a\u0651\u064f \u0648\u064e\u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064c. -\u0647\u064e\u0630\u064e\u0627 \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064f \u062e\u064e\u0631\u064e\u062c\u0651\u064e\u0627\u0647\u064f \u0641\u0650\u064a " \u0627\u0644\u0635\u0651\u064e\u062d\u0650\u064a\u062d\u064e\u064a\u0652\u0646\u0650 " \u0645\u0650\u0646\u0652 \u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0642\u064e\u062a\u064e\u0627\u062f\u064e\u0629\u064e\u060c \u0639\u064e\u0646\u0652 \u0623\u064e\u0646\u064e\u0633\u064d\u060c \u0648\u064e\u0644\u064e\u0641\u0652\u0638\u064f \u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064d " \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u062c\u064e\u0627\u0631\u0650\u0647\u0650 \u0623\u064e\u0648\u0652 \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 " \u0628\u0650\u0627\u0644\u0634\u0651\u064e\u0643\u0651\u0650. \u0648\u064e\u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f\u060c \u0648\u064e\u0644\u064e\u0641\u0652\u0638\u064f\u0647\u064f: " \u0644\u064e\u0627 \u064a\u064e\u0628\u0652\u0644\u064f\u063a\u064f \u0639\u064e\u0628\u0652\u062f\u064c \u062d\u064e\u0642\u0650\u064a\u0642\u064e\u0629\u064e \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0652\u062e\u064e\u064a\u0652\u0631\u0650 ". \u0648\u064e\u0647\u064e\u0630\u0650\u0647\u0650 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u064f \u062a\u064f\u0628\u064e\u064a\u0651\u0650\u0646\u064f \u0645\u064e\u0639\u0652\u0646\u064e\u0649 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u0650 \u0627\u0644\u0652\u0645\u064f\u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0629\u0650 \u0641\u0650\u064a " \u0627\u0644\u0635\u0651\u064e\u062d\u0650\u064a\u062d\u064e\u064a\u0652\u0646\u0650 "\u060c \u0648\u064e\u0623\u064e\u0646\u0651\u064e \u0627\u0644\u0652\u0645\u064f\u0631\u064e\u0627\u062f\u064e \u0628\u0650\u0646\u064e\u0641\u0652\u064a\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0646\u064e\u0641\u0652\u064a\u064f \u0628\u064f\u0644\u064f\u0648\u063a\u0650 \u062d\u064e\u0642\u0650\u064a\u0642\u064e\u062a\u0650\u0647\u0650 \u0648\u064e\u0646\u0650\u0647\u064e\u0627\u064a\u064e\u062a\u0650\u0647\u0650\u060c \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064e \u0643\u064e\u062b\u0650\u064a\u0631\u064b\u0627 \u0645\u064e\u0627 \u064a\u064f\u0646\u0652\u0641\u064e\u0649 \u0644\u0650\u0627\u0646\u0652\u062a\u0650\u0641\u064e\u0627\u0621\u0650 \u0628\u064e\u0639\u0652\u0636\u0650 \u0623\u064e\u0631\u0652\u0643\u064e\u0627\u0646\u0650\u0647\u0650 \u0648\u064e\u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0627\u062a\u0650\u0647\u0650\u060c \u0643\u064e\u0642\u064e\u0648\u0652\u0644\u0650\u0647\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e: \u00ab\u0644\u064e\u0627 \u064a\u064e\u0632\u0652\u0646\u0650\u064a \u0627\u0644\u0632\u0651\u064e\u0627\u0646\u0650\u064a \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0632\u0652\u0646\u0650\u064a \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c \u0648\u064e\u0644\u064e\u0627 \u064a\u064e\u0633\u0652\u0631\u0650\u0642\u064f \u0627\u0644\u0633\u0651\u064e\u0627\u0631\u0650\u0642\u064f \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0633\u0652\u0631\u0650\u0642\u064f \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c \u0648\u064e\u0644\u064e\u0627 \u064a\u064e\u0634\u0652\u0631\u064e\u0628\u064f \u0627\u0644\u0652\u062e\u064e\u0645\u0652\u0631\u064e \u062d\u0650\u064a\u0646\u064e \u064a\u064e\u0634\u0652\u0631\u064e\u0628\u064f\u0647\u064e\u0627 \u0648\u064e\u0647\u064f\u0648\u064e \u0645\u064f\u0624\u0652\u0645\u0650\u0646\u064c\u060c\u00bb \u0648\u064e\u0642\u064e\u0648\u0652\u0644\u0650\u0647\u0650: \u00ab\u0644\u064e\u0627 \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0645\u064e\u0646\u0652 \u0644\u064e\u0627 \u064a\u064e\u0623\u0652\u0645\u064e\u0646\u064f \u062c\u064e\u0627\u0631\u064f\u0647\u064f \u0628\u064e\u0648\u064e\u0627\u0626\u0650\u0642\u064e\u0647\u064f\u00bb .' };
      const R303 = { kind: 'lib_book', title: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637 \u00b7 \u062c1 \u00b7 \u0635303-304', url: '', publisher: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a', recordId: 'lib:FC-001812:0014:003',
        bookTitle: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637', author: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a', locator: '\u062c1 \u00b7 \u0635303-304',
        text: '\u0648\u064e\u0642\u064e\u0627\u0644\u064e \u0623\u064e\u0628\u064f\u0648 \u0647\u064f\u0631\u064e\u064a\u0652\u0631\u064e\u0629\u064e: \u064a\u064f\u0646\u0652\u0632\u064e\u0639\u064f \u0645\u0650\u0646\u0652\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f\u060c \u0641\u064e\u064a\u064e\u0643\u064f\u0648\u0646\u064f \u0641\u064e\u0648\u0652\u0642\u064e\u0647\u064f \u0643\u064e\u0627\u0644\u0638\u0651\u064f\u0644\u0651\u064e\u0629\u0650\u060c \u0641\u064e\u0625\u0650\u0646\u0652 \u062a\u064e\u0627\u0628\u064e \u0639\u064e\u0627\u062f\u064e \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650. \u0648\u064e\u0642\u064e\u0627\u0644\u064e \u0639\u064e\u0628\u0652\u062f\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0628\u0652\u0646\u064f \u0631\u064e\u0648\u064e\u0627\u062d\u064e\u0629\u064e \u0648\u064e\u0623\u064e\u0628\u064f\u0648 \u0627\u0644\u062f\u0651\u064e\u0631\u0652\u062f\u064e\u0627\u0621\u0650: \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f \u0643\u064e\u0627\u0644\u0652\u0642\u064e\u0645\u0650\u064a\u0635\u0650\u060c \u064a\u064e\u0644\u0652\u0628\u064e\u0633\u064f\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u0646\u0652\u0633\u064e\u0627\u0646\u064f \u062a\u064e\u0627\u0631\u064e\u0629\u064b\u060c \u0648\u064e\u064a\u064e\u062e\u0652\u0644\u064e\u0639\u064f\u0647\u064f \u062a\u064e\u0627\u0631\u064e\u0629\u064b \u0623\u064f\u062e\u0652\u0631\u064e\u0649\u060c \u0648\u064e\u0643\u064e\u0630\u064e\u0627 \u0642\u064e\u0627\u0644\u064e \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f \u0631\u064e\u062d\u0650\u0645\u064e\u0647\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0648\u064e\u063a\u064e\u064a\u0652\u0631\u064f\u0647\u064f\u060c \u0648\u064e\u0627\u0644\u0652\u0645\u064e\u0639\u0652\u0646\u064e\u0649: \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u0625\u0650\u0630\u064e\u0627 \u0643\u064e\u0645\u064f\u0644\u064e \u062e\u0650\u0635\u064e\u0627\u0644\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650\u060c \u0644\u064e\u0628\u0650\u0633\u064e\u0647\u064f\u060c \u0641\u064e\u0625\u0650\u0630\u064e\u0627 \u0646\u064e\u0642\u064e\u0635\u064e \u0645\u0650\u0646\u0652\u0647\u064e\u0627 \u0634\u064e\u064a\u0652\u0621\u064c \u0646\u064e\u0632\u064e\u0639\u064e\u0647\u064f\u060c \u0648\u064e\u0643\u064f\u0644\u0651\u064f \u0647\u064e\u0630\u064e\u0627 \u0625\u0650\u0634\u064e\u0627\u0631\u064e\u0629\u064c \u0625\u0650\u0644\u064e\u0649 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0627\u0644\u0652\u0643\u064e\u0627\u0645\u0650\u0644\u0650 \u0627\u0644\u062a\u0651\u064e\u0627\u0645\u0651\u0650 \u0627\u0644\u0651\u064e\u0630\u0650\u064a \u0644\u064e\u0627 \u064a\u064e\u0646\u0652\u0642\u064f\u0635\u064f \u0645\u0650\u0646\u0652 \u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0627\u062a\u0650\u0647\u0650 \u0634\u064e\u064a\u0652\u0621\u064c. \u0648\u064e\u0627\u0644\u0652\u0645\u064e\u0642\u0652\u0635\u064f\u0648\u062f\u064f \u0623\u064e\u0646\u0651\u064e \u0645\u0650\u0646\u0652 \u062c\u064f\u0645\u0652\u0644\u064e\u0629\u0650 \u062e\u0650\u0635\u064e\u0627\u0644\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0627\u0644\u0652\u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0629\u0650 \u0623\u064e\u0646\u0652 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0627\u0644\u0652\u0645\u064e\u0631\u0652\u0621\u064f \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0627\u0644\u0652\u0645\u064f\u0624\u0652\u0645\u0650\u0646\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650\u060c \u0648\u064e\u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064e \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650\u060c \u0641\u064e\u0625\u0650\u0630\u064e\u0627 \u0632\u064e\u0627\u0644\u064e \u0630\u064e\u0644\u0650\u0643\u064e \u0639\u064e\u0646\u0652\u0647\u064f\u060c \u0641\u064e\u0642\u064e\u062f\u0652 \u0646\u064e\u0642\u064e\u0635\u064e \u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f\u0647\u064f \u0628\u0650\u0630\u064e\u0644\u0650\u0643\u064e. \u0648\u064e\u0642\u064e\u062f\u0652 \u0631\u064f\u0648\u0650\u064a\u064e \u0623\u064e\u0646\u0651\u064e \u00ab\u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u064e \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0642\u064e\u0627\u0644\u064e \u0644\u0650\u0623\u064e\u0628\u0650\u064a \u0647\u064f\u0631\u064e\u064a\u0652\u0631\u064e\u0629\u064e: \u0623\u064e\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u062a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e \u062a\u064e\u0643\u064f\u0646\u0652 \u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064b\u0627\u00bb \u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0647\u064f \u0627\u0644\u062a\u0651\u0650\u0631\u0652\u0645\u0650\u0630\u0650\u064a\u0651\u064f \u0648\u064e\u0627\u0628\u0652\u0646\u064f \u0645\u064e\u0627\u062c\u064e\u0647\u0652. \u0648\u064e\u062e\u064e\u0631\u0651\u064e\u062c\u064e \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f \u0645\u0650\u0646\u0652 \u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0645\u064f\u0639\u064e\u0627\u0630\u064d \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u00ab\u0633\u064e\u0623\u064e\u0644\u064e \u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u064e \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0639\u064e\u0646\u0652 \u0623\u064e\u0641\u0652\u0636\u064e\u0644\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650\u060c \u0642\u064e\u0627\u0644\u064e: \u0623\u064e\u0641\u0652\u0636\u064e\u0644\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0623\u064e\u0646\u0652 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0651\u064e\u0647\u0650 \u0648\u064e\u062a\u064f\u0628\u0652\u063a\u0650\u0636\u064e \u0644\u0650\u0644\u0651\u064e\u0647\u0650\u060c \u0648\u064e\u062a\u064f\u0639\u0652\u0645\u0650\u0644\u064e \u0644\u0650\u0633\u064e\u0627\u0646\u064e\u0643\u064e \u0641\u0650\u064a \u0630\u0650\u0643\u0652\u0631\u0650 \u0627\u0644\u0644\u0651\u064e\u0647\u0650\u060c \u0642\u064e\u0627\u0644\u064e: \u0648\u064e\u0645\u064e\u0627\u0630\u064e\u0627 \u064a\u064e\u0627 \u0631\u064e\u0633\u064f\u0648\u0644\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u0650\u061f \u0642\u064e\u0627\u0644\u064e: \u0623\u064e\u0646\u0652 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e\u060c \u0648\u064e\u062a\u064e\u0643\u0652\u0631\u064e\u0647\u064e \u0644\u064e\u0647\u064f\u0645\u0652 \u0645\u064e\u0627 \u062a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e\u060c \u0648\u064e\u0623\u064e\u0646\u0652 \u062a\u064e\u0642\u064f\u0648\u0644\u064e \u062e\u064e\u064a\u0652\u0631\u064b\u0627 \u0623\u064e\u0648\u0652 \u062a\u064e\u0635\u0652\u0645\u064f\u062a\u064e\u00bb .', fullText: '\u0648\u064e\u0642\u064e\u0627\u0644\u064e \u0623\u064e\u0628\u064f\u0648 \u0647\u064f\u0631\u064e\u064a\u0652\u0631\u064e\u0629\u064e: \u064a\u064f\u0646\u0652\u0632\u064e\u0639\u064f \u0645\u0650\u0646\u0652\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f\u060c \u0641\u064e\u064a\u064e\u0643\u064f\u0648\u0646\u064f \u0641\u064e\u0648\u0652\u0642\u064e\u0647\u064f \u0643\u064e\u0627\u0644\u0638\u0651\u064f\u0644\u0651\u064e\u0629\u0650\u060c \u0641\u064e\u0625\u0650\u0646\u0652 \u062a\u064e\u0627\u0628\u064e \u0639\u064e\u0627\u062f\u064e \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650. \u0648\u064e\u0642\u064e\u0627\u0644\u064e \u0639\u064e\u0628\u0652\u062f\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0628\u0652\u0646\u064f \u0631\u064e\u0648\u064e\u0627\u062d\u064e\u0629\u064e \u0648\u064e\u0623\u064e\u0628\u064f\u0648 \u0627\u0644\u062f\u0651\u064e\u0631\u0652\u062f\u064e\u0627\u0621\u0650: \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f \u0643\u064e\u0627\u0644\u0652\u0642\u064e\u0645\u0650\u064a\u0635\u0650\u060c \u064a\u064e\u0644\u0652\u0628\u064e\u0633\u064f\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u0646\u0652\u0633\u064e\u0627\u0646\u064f \u062a\u064e\u0627\u0631\u064e\u0629\u064b\u060c \u0648\u064e\u064a\u064e\u062e\u0652\u0644\u064e\u0639\u064f\u0647\u064f \u062a\u064e\u0627\u0631\u064e\u0629\u064b \u0623\u064f\u062e\u0652\u0631\u064e\u0649\u060c \u0648\u064e\u0643\u064e\u0630\u064e\u0627 \u0642\u064e\u0627\u0644\u064e \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f \u0631\u064e\u062d\u0650\u0645\u064e\u0647\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0648\u064e\u063a\u064e\u064a\u0652\u0631\u064f\u0647\u064f\u060c \u0648\u064e\u0627\u0644\u0652\u0645\u064e\u0639\u0652\u0646\u064e\u0649: \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u0625\u0650\u0630\u064e\u0627 \u0643\u064e\u0645\u064f\u0644\u064e \u062e\u0650\u0635\u064e\u0627\u0644\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650\u060c \u0644\u064e\u0628\u0650\u0633\u064e\u0647\u064f\u060c \u0641\u064e\u0625\u0650\u0630\u064e\u0627 \u0646\u064e\u0642\u064e\u0635\u064e \u0645\u0650\u0646\u0652\u0647\u064e\u0627 \u0634\u064e\u064a\u0652\u0621\u064c \u0646\u064e\u0632\u064e\u0639\u064e\u0647\u064f\u060c \u0648\u064e\u0643\u064f\u0644\u0651\u064f \u0647\u064e\u0630\u064e\u0627 \u0625\u0650\u0634\u064e\u0627\u0631\u064e\u0629\u064c \u0625\u0650\u0644\u064e\u0649 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0627\u0644\u0652\u0643\u064e\u0627\u0645\u0650\u0644\u0650 \u0627\u0644\u062a\u0651\u064e\u0627\u0645\u0651\u0650 \u0627\u0644\u0651\u064e\u0630\u0650\u064a \u0644\u064e\u0627 \u064a\u064e\u0646\u0652\u0642\u064f\u0635\u064f \u0645\u0650\u0646\u0652 \u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0627\u062a\u0650\u0647\u0650 \u0634\u064e\u064a\u0652\u0621\u064c. \u0648\u064e\u0627\u0644\u0652\u0645\u064e\u0642\u0652\u0635\u064f\u0648\u062f\u064f \u0623\u064e\u0646\u0651\u064e \u0645\u0650\u0646\u0652 \u062c\u064f\u0645\u0652\u0644\u064e\u0629\u0650 \u062e\u0650\u0635\u064e\u0627\u0644\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0627\u0644\u0652\u0648\u064e\u0627\u062c\u0650\u0628\u064e\u0629\u0650 \u0623\u064e\u0646\u0652 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0627\u0644\u0652\u0645\u064e\u0631\u0652\u0621\u064f \u0644\u0650\u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0627\u0644\u0652\u0645\u064f\u0624\u0652\u0645\u0650\u0646\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650\u060c \u0648\u064e\u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064e \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650\u060c \u0641\u064e\u0625\u0650\u0630\u064e\u0627 \u0632\u064e\u0627\u0644\u064e \u0630\u064e\u0644\u0650\u0643\u064e \u0639\u064e\u0646\u0652\u0647\u064f\u060c \u0641\u064e\u0642\u064e\u062f\u0652 \u0646\u064e\u0642\u064e\u0635\u064e \u0625\u0650\u064a\u0645\u064e\u0627\u0646\u064f\u0647\u064f \u0628\u0650\u0630\u064e\u0644\u0650\u0643\u064e. \u0648\u064e\u0642\u064e\u062f\u0652 \u0631\u064f\u0648\u0650\u064a\u064e \u0623\u064e\u0646\u0651\u064e \u00ab\u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u064e \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0642\u064e\u0627\u0644\u064e \u0644\u0650\u0623\u064e\u0628\u0650\u064a \u0647\u064f\u0631\u064e\u064a\u0652\u0631\u064e\u0629\u064e: \u0623\u064e\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u062a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e \u062a\u064e\u0643\u064f\u0646\u0652 \u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064b\u0627\u00bb \u062e\u064e\u0631\u0651\u064e\u062c\u064e\u0647\u064f \u0627\u0644\u062a\u0651\u0650\u0631\u0652\u0645\u0650\u0630\u0650\u064a\u0651\u064f \u0648\u064e\u0627\u0628\u0652\u0646\u064f \u0645\u064e\u0627\u062c\u064e\u0647\u0652. \u0648\u064e\u062e\u064e\u0631\u0651\u064e\u062c\u064e \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f \u0645\u0650\u0646\u0652 \u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0645\u064f\u0639\u064e\u0627\u0630\u064d \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u00ab\u0633\u064e\u0623\u064e\u0644\u064e \u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u064e \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0639\u064e\u0646\u0652 \u0623\u064e\u0641\u0652\u0636\u064e\u0644\u0650 \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650\u060c \u0642\u064e\u0627\u0644\u064e: \u0623\u064e\u0641\u0652\u0636\u064e\u0644\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650 \u0623\u064e\u0646\u0652 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0651\u064e\u0647\u0650 \u0648\u064e\u062a\u064f\u0628\u0652\u063a\u0650\u0636\u064e \u0644\u0650\u0644\u0651\u064e\u0647\u0650\u060c \u0648\u064e\u062a\u064f\u0639\u0652\u0645\u0650\u0644\u064e \u0644\u0650\u0633\u064e\u0627\u0646\u064e\u0643\u064e \u0641\u0650\u064a \u0630\u0650\u0643\u0652\u0631\u0650 \u0627\u0644\u0644\u0651\u064e\u0647\u0650\u060c \u0642\u064e\u0627\u0644\u064e: \u0648\u064e\u0645\u064e\u0627\u0630\u064e\u0627 \u064a\u064e\u0627 \u0631\u064e\u0633\u064f\u0648\u0644\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u0650\u061f \u0642\u064e\u0627\u0644\u064e: \u0623\u064e\u0646\u0652 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u0645\u064e\u0627 \u062a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e\u060c \u0648\u064e\u062a\u064e\u0643\u0652\u0631\u064e\u0647\u064e \u0644\u064e\u0647\u064f\u0645\u0652 \u0645\u064e\u0627 \u062a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0643\u064e\u060c \u0648\u064e\u0623\u064e\u0646\u0652 \u062a\u064e\u0642\u064f\u0648\u0644\u064e \u062e\u064e\u064a\u0652\u0631\u064b\u0627 \u0623\u064e\u0648\u0652 \u062a\u064e\u0635\u0652\u0645\u064f\u062a\u064e\u00bb .' };
      const RENC = { kind: 'lib_book', title: '\u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629 \u0627\u0644\u0643\u0648\u064a\u062a\u064a\u0629 \u00b7 \u062c38 \u00b7 \u0635233', url: '', publisher: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u0624\u0644\u0641\u064a\u0646', recordId: 'lib:FC-003910:15790:002',
        bookTitle: '\u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629 \u0627\u0644\u0643\u0648\u064a\u062a\u064a\u0629', author: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u0624\u0644\u0641\u064a\u0646', locator: '\u062c38 \u00b7 \u0635233',
        text: '\u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064e\u062d\u0652\u0646\u064f\u0648\u064e \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u064a\u064e\u0639\u0652\u062a\u064e\u0646\u0650\u064a\u064e \u0628\u0650\u0645\u064e\u0635\u064e\u0627\u0644\u0650\u062d\u0650\u0647\u0650 \u0643\u064e\u0627\u0639\u0652\u062a\u0650\u0646\u064e\u0627\u0626\u0650\u0647\u0650 \u0628\u0650\u0645\u064e\u0635\u064e\u0627\u0644\u0650\u062d\u0650 \u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0648\u064e\u0648\u064e\u0644\u064e\u062f\u0650\u0647\u0650\u060c \u0648\u064e\u0623\u064e\u0646\u0652 \u064a\u064e\u0635\u0652\u0628\u0650\u0631\u064e \u0639\u064e\u0644\u064e\u0649 \u062c\u064e\u0641\u064e\u0627\u0626\u0650\u0647\u0650 \u0648\u064e\u0633\u064f\u0648\u0621\u0650 \u0623\u064e\u062f\u064e\u0628\u0650\u0647\u0650\u060c \u0648\u064e\u064a\u064e\u0639\u0652\u0630\u064f\u0631\u064e\u0647\u064f \u0641\u0650\u064a \u0633\u064f\u0648\u0621\u0650 \u0623\u064e\u062f\u064e\u0628\u064d \u0648\u064e\u062c\u064e\u0641\u0652\u0648\u064e\u0629\u064d \u062a\u064e\u0639\u0652\u0631\u0650\u0636\u064f \u0645\u0650\u0646\u0652\u0647\u064f \u0641\u0650\u064a \u0628\u064e\u0639\u0652\u0636\u0650 \u0627\u0644\u0623\u0652\u064e\u062d\u0652\u064a\u064e\u0627\u0646\u0650 \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0627\u0644\u0625\u0652\u0650\u0646\u0652\u0633\u064e\u0627\u0646\u064e \u0645\u064f\u0639\u064e\u0631\u0651\u064e\u0636\u064c \u0644\u0650\u0644\u0646\u0651\u064e\u0642\u064e\u0627\u0626\u0650\u0635\u0650. \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0652\u062e\u064e\u064a\u0652\u0631\u0650 \u0648\u064e\u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0634\u0651\u064e\u0631\u0651\u0650\u060c \u0641\u064e\u0641\u0650\u064a \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u0650: \u0644\u0627\u064e \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0623\u0650\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 (1) ". \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0644\u0627\u0651\u064e \u064a\u064e\u062f\u0651\u064e\u062e\u0650\u0631\u064e \u0639\u064e\u0646\u0650 \u0627\u0644\u0637\u0651\u064e\u0644\u064e\u0628\u064e\u0629\u0650 \u0645\u0650\u0646\u0652 \u0623\u064e\u0646\u0652\u0648\u064e\u0627\u0639\u0650 \u0627\u0644\u0652\u0639\u0650\u0644\u0652\u0645\u0650 \u0634\u064e\u064a\u0652\u0626\u064b\u0627 \u064a\u064e\u062d\u0652\u062a\u064e\u0627\u062c\u064f\u0648\u0646\u064e \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650 \u0625\u0650\u0630\u064e\u0627 \u0643\u064e\u0627\u0646\u064e \u0627\u0644\u0637\u0651\u064e\u0627\u0644\u0650\u0628\u064f \u0623\u064e\u0647\u0652\u0644\u0627\u064b \u0644\u0650\u0630\u064e\u0644\u0650\u0643\u064e \u0648\u064e\u0644\u0627\u064e \u064a\u064f\u0644\u0652\u0642\u0650\u064a \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650 \u0634\u064e\u064a\u0652\u0626\u064b\u0627 \u0644\u064e\u0645\u0652 \u064a\u064e\u062a\u064e\u0623\u064e\u0647\u0651\u064e\u0644 \u0644\u064e\u0647\u064f \u0644\u0650\u0626\u064e\u0644\u0627\u0651\u064e \u064a\u064f\u0641\u0652\u0633\u0650\u062f\u064e \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u062d\u064e\u0627\u0644\u064e\u0647\u064f\u060c \u0641\u064e\u0644\u064e\u0648\u0652 \u0633\u064e\u0623\u064e\u0644\u064e\u0647\u064f \u0627\u0644\u0652\u0645\u064f\u062a\u064e\u0639\u064e\u0644\u0651\u0650\u0645\u064f \u0639\u064e\u0646\u0652 \u0630\u064e\u0644\u0650\u0643\u064e \u0644\u064e\u0645\u0652 \u064a\u064f\u062c\u0650\u0628\u0652\u0647\u064f \u0648\u064e\u064a\u064f\u0639\u064e\u0631\u0651\u0650\u0641\u064f\u0647\u064f \u0623\u064e\u0646\u0651\u064e \u0630\u064e\u0644\u0650\u0643\u064e \u064a\u064e\u0636\u064f\u0631\u0651\u064f\u0647\u064f \u0648\u064e\u0644\u0627\u064e \u064a\u064e\u0646\u0652\u0641\u064e\u0639\u064f\u0647\u064f \u0648\u064e\u0623\u064e\u0646\u0651\u064e\u0647\u064f \u0644\u064e\u0645\u0652 \u064a\u064e\u0645\u0652\u0646\u064e\u0639\u0652\u0647\u064f \u0630\u064e\u0644\u0650\u0643\u064e \u0634\u064f\u062d\u0651\u064b\u0627 \u0628\u064e\u0644 \u0634\u064e\u0641\u064e\u0642\u064e\u0629\u064b \u0648\u064e\u0644\u064f\u0637\u0652\u0641\u064b\u0627 (2) . \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064e\u062a\u064e\u0641\u064e\u0642\u0651\u064e\u062f\u064e\u0647\u064f\u0645\u0652 \u0648\u064e\u064a\u064e\u0633\u0652\u0623\u064e\u0644 \u0639\u064e\u0645\u0651\u064e\u0646\u0652 \u063a\u064e\u0627\u0628\u064e \u0645\u0650\u0646\u0652\u0647\u064f\u0645\u0652.', fullText: '\u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064e\u062d\u0652\u0646\u064f\u0648\u064e \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u064a\u064e\u0639\u0652\u062a\u064e\u0646\u0650\u064a\u064e \u0628\u0650\u0645\u064e\u0635\u064e\u0627\u0644\u0650\u062d\u0650\u0647\u0650 \u0643\u064e\u0627\u0639\u0652\u062a\u0650\u0646\u064e\u0627\u0626\u0650\u0647\u0650 \u0628\u0650\u0645\u064e\u0635\u064e\u0627\u0644\u0650\u062d\u0650 \u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0648\u064e\u0648\u064e\u0644\u064e\u062f\u0650\u0647\u0650\u060c \u0648\u064e\u0623\u064e\u0646\u0652 \u064a\u064e\u0635\u0652\u0628\u0650\u0631\u064e \u0639\u064e\u0644\u064e\u0649 \u062c\u064e\u0641\u064e\u0627\u0626\u0650\u0647\u0650 \u0648\u064e\u0633\u064f\u0648\u0621\u0650 \u0623\u064e\u062f\u064e\u0628\u0650\u0647\u0650\u060c \u0648\u064e\u064a\u064e\u0639\u0652\u0630\u064f\u0631\u064e\u0647\u064f \u0641\u0650\u064a \u0633\u064f\u0648\u0621\u0650 \u0623\u064e\u062f\u064e\u0628\u064d \u0648\u064e\u062c\u064e\u0641\u0652\u0648\u064e\u0629\u064d \u062a\u064e\u0639\u0652\u0631\u0650\u0636\u064f \u0645\u0650\u0646\u0652\u0647\u064f \u0641\u0650\u064a \u0628\u064e\u0639\u0652\u0636\u0650 \u0627\u0644\u0623\u0652\u064e\u062d\u0652\u064a\u064e\u0627\u0646\u0650 \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0627\u0644\u0625\u0652\u0650\u0646\u0652\u0633\u064e\u0627\u0646\u064e \u0645\u064f\u0639\u064e\u0631\u0651\u064e\u0636\u064c \u0644\u0650\u0644\u0646\u0651\u064e\u0642\u064e\u0627\u0626\u0650\u0635\u0650. \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0652\u062e\u064e\u064a\u0652\u0631\u0650 \u0648\u064e\u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u064a\u064e\u0643\u0652\u0631\u064e\u0647\u064f\u0647\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0634\u0651\u064e\u0631\u0651\u0650\u060c \u0641\u064e\u0641\u0650\u064a \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u0650: \u0644\u0627\u064e \u064a\u064f\u0624\u0652\u0645\u0650\u0646\u064f \u0623\u064e\u062d\u064e\u062f\u064f\u0643\u064f\u0645\u0652 \u062d\u064e\u062a\u0651\u064e\u0649 \u064a\u064f\u062d\u0650\u0628\u0651\u064e \u0644\u0623\u0650\u064e\u062e\u0650\u064a\u0647\u0650 \u0645\u064e\u0627 \u064a\u064f\u062d\u0650\u0628\u0651\u064f \u0644\u0650\u0646\u064e\u0641\u0652\u0633\u0650\u0647\u0650 (1) ". \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0644\u0627\u0651\u064e \u064a\u064e\u062f\u0651\u064e\u062e\u0650\u0631\u064e \u0639\u064e\u0646\u0650 \u0627\u0644\u0637\u0651\u064e\u0644\u064e\u0628\u064e\u0629\u0650 \u0645\u0650\u0646\u0652 \u0623\u064e\u0646\u0652\u0648\u064e\u0627\u0639\u0650 \u0627\u0644\u0652\u0639\u0650\u0644\u0652\u0645\u0650 \u0634\u064e\u064a\u0652\u0626\u064b\u0627 \u064a\u064e\u062d\u0652\u062a\u064e\u0627\u062c\u064f\u0648\u0646\u064e \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650 \u0625\u0650\u0630\u064e\u0627 \u0643\u064e\u0627\u0646\u064e \u0627\u0644\u0637\u0651\u064e\u0627\u0644\u0650\u0628\u064f \u0623\u064e\u0647\u0652\u0644\u0627\u064b \u0644\u0650\u0630\u064e\u0644\u0650\u0643\u064e \u0648\u064e\u0644\u0627\u064e \u064a\u064f\u0644\u0652\u0642\u0650\u064a \u0625\u0650\u0644\u064e\u064a\u0652\u0647\u0650 \u0634\u064e\u064a\u0652\u0626\u064b\u0627 \u0644\u064e\u0645\u0652 \u064a\u064e\u062a\u064e\u0623\u064e\u0647\u0651\u064e\u0644 \u0644\u064e\u0647\u064f \u0644\u0650\u0626\u064e\u0644\u0627\u0651\u064e \u064a\u064f\u0641\u0652\u0633\u0650\u062f\u064e \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u062d\u064e\u0627\u0644\u064e\u0647\u064f\u060c \u0641\u064e\u0644\u064e\u0648\u0652 \u0633\u064e\u0623\u064e\u0644\u064e\u0647\u064f \u0627\u0644\u0652\u0645\u064f\u062a\u064e\u0639\u064e\u0644\u0651\u0650\u0645\u064f \u0639\u064e\u0646\u0652 \u0630\u064e\u0644\u0650\u0643\u064e \u0644\u064e\u0645\u0652 \u064a\u064f\u062c\u0650\u0628\u0652\u0647\u064f \u0648\u064e\u064a\u064f\u0639\u064e\u0631\u0651\u0650\u0641\u064f\u0647\u064f \u0623\u064e\u0646\u0651\u064e \u0630\u064e\u0644\u0650\u0643\u064e \u064a\u064e\u0636\u064f\u0631\u0651\u064f\u0647\u064f \u0648\u064e\u0644\u0627\u064e \u064a\u064e\u0646\u0652\u0641\u064e\u0639\u064f\u0647\u064f \u0648\u064e\u0623\u064e\u0646\u0651\u064e\u0647\u064f \u0644\u064e\u0645\u0652 \u064a\u064e\u0645\u0652\u0646\u064e\u0639\u0652\u0647\u064f \u0630\u064e\u0644\u0650\u0643\u064e \u0634\u064f\u062d\u0651\u064b\u0627 \u0628\u064e\u0644 \u0634\u064e\u0641\u064e\u0642\u064e\u0629\u064b \u0648\u064e\u0644\u064f\u0637\u0652\u0641\u064b\u0627 (2) . \u0648\u064e\u064a\u064e\u0646\u0652\u0628\u064e\u063a\u0650\u064a \u0623\u064e\u0646\u0652 \u064a\u064e\u062a\u064e\u0641\u064e\u0642\u0651\u064e\u062f\u064e\u0647\u064f\u0645\u0652 \u0648\u064e\u064a\u064e\u0633\u0652\u0623\u064e\u0644 \u0639\u064e\u0645\u0651\u064e\u0646\u0652 \u063a\u064e\u0627\u0628\u064e \u0645\u0650\u0646\u0652\u0647\u064f\u0645\u0652.' };
      const ANY = '\u0641\u064a \u0647\u0630\u0627|\u0641\u064a \u0647\u0630\u0647|\u0641\u064a \u0630\u0644\u0643|\u0641\u064a \u062a\u0644\u0643|\u0641\u064a \u0645\u0639\u0646\u0627\u0647|\u0641\u064a \u0645\u0639\u0646\u0627\u0647\u0627|\u0628\u0645\u0639\u0646\u0627\u0647|\u0628\u0645\u0639\u0646\u0627\u0647\u0627|\u0628\u0647\u0630\u0627|\u0628\u0647\u0630\u0647|\u0628\u0630\u0644\u0643|\u0645\u062b\u0644\u0647|\u0645\u062b\u0644\u0647\u0627|\u0645\u062b\u0644 \u0630\u0644\u0643|\u0645\u062b\u0644 \u0647\u0630\u0627|\u0646\u062d\u0648\u0647|\u0646\u062d\u0648\u0647\u0627|\u0646\u062d\u0648 \u0630\u0644\u0643|\u0646\u062d\u0648 \u0647\u0630\u0627|\u0639\u0644\u0649 \u0647\u0630\u0627|\u0639\u0644\u0649 \u0630\u0644\u0643|\u0645\u0646 \u0630\u0644\u0643|\u0645\u0646 \u0647\u0630\u0627|\u0643\u0630\u0644\u0643|\u0623\u064a\u0636\u0627'.split('|');
      const JOINED = '\u0641\u064a \u0627\u0644\u0645\u0639\u0646\u0649|\u0641\u064a \u0645\u0639\u0646\u0649|\u0641\u064a \u0627\u0644\u0628\u0627\u0628|\u0641\u064a \u0631\u0648\u0627\u064a\u0629|\u0641\u064a \u0644\u0641\u0638|\u0641\u064a \u062d\u062f\u064a\u062b|\u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b \u0627\u0644\u0622\u062e\u0631|\u0642\u0631\u064a\u0628 \u0645\u0646\u0647|\u0643\u0630\u0627|\u0647\u0643\u0630\u0627'.split('|');
      const TAIL = ' \u0645\u0627 \u0631\u0648\u064a \u0639\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645.';
      const WA = '\u0648';
      const k = UNITS.dependentKind;
      const cite = (s, ref) => s.replace(/\.$/u, ' [[' + ref + ']].');
      const A2C = cite(A2, 2);
      // The local library's measured answer for this hadith: sourced, "(agreed upon)", its seal books, no Companion.
      const byLibrary = async (text) => (text.includes(MATN)
        ? { text, entries: [{ matn: MATN, sourced: true, parenthetical: AGREED, companion: '',
          sealProof: ['\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0645\u0633\u0644\u0645', '\u0627\u0628\u0646 \u0645\u0627\u062c\u0647'] }] }
        : { text, entries: [] });
      const lib = (writerText, library = [R301, R303, RENC], takhrijImpl = byLibrary) => run({ question: Q2, fatwa: [], libOn: true, library, writerText, takhrijImpl });

      ok('C5a the kinds: answer 2 opens by pointing back; so does every listed form, bare where it may be and behind wa',
        k(A2) === 'backref' && ANY.every((f) => k(f + TAIL) === 'backref' && k(WA + f + TAIL) === 'backref')
        && JOINED.every((f) => k(WA + f + TAIL) === 'backref'),
        JSON.stringify([k(A2), ANY.filter((f) => k(f + TAIL) !== 'backref' || k(WA + f + TAIL) !== 'backref').length, JOINED.filter((f) => k(WA + f + TAIL) !== 'backref').length]));
      ok('C5b ...and not: a noun that needs wa to point back, bare; a collection after "fi"; a bare demonstrative; a demonstrative after the unit\'s own matn',
        JOINED.every((f) => k(f + TAIL) === '') && k(NOT_BACK_1) === '' && k(NOT_BACK_2) === '' && k(NOT_BACK_3) === 'pronoun' && k(W_OWN) === '',
        JSON.stringify([JOINED.filter((f) => k(f + TAIL) !== ''), k(NOT_BACK_1), k(NOT_BACK_2), k(NOT_BACK_3), k(W_OWN)]));
      const op = await lib(A2C);
      const oh = await lib([W_HURAYRA, W_DAWUD, A2C].join('\n'));
      ok('C5c answer 2, cited to its row, is held at the opening (dependent_opening) and after held units (dependent_on_held)',
        !op.deltas.join('').includes(A2.slice(0, 20)) && op.out.telemetry.heldDependentOpening === 1
        && !oh.deltas.join('').includes(A2.slice(0, 20)) && oh.out.telemetry.heldDependentOnHeld === 1 && oh.out.telemetry.unitsReleased === 0,
        ascii(op.deltas.join('|') + ' || ' + oh.deltas.join('|')) + JSON.stringify([op.out.telemetry, oh.out.telemetry].map((t) => [t.heldDependentOpening, t.heldDependentOnHeld])));
      const after = await lib([W_ANAS, A2C].join('\n'));
      // SPEED FIX 5: C7 answers a question about a hadith's source first or not at all, and this
      // fixture pins R5 / C1 / C5, not the question's class: its runs ask about the same hadith's meaning.
      const plain = await run({ question: '\u0645\u0627 \u0645\u0639\u0646\u0649 \u062d\u062f\u064a\u062b: ' + MATN + '\u061f', fatwa: [], libOn: true, library: [R301, R303, RENC], writerText: [W_PLAIN, A2C].join('\n'), takhrijImpl: byLibrary });
      ok('C5d ...and goes out after a released unit; after a released sentence that is not substantive it is still held as an opening',
        after.deltas.join('').startsWith(W_ANAS) && after.deltas.join('').includes(A2) && after.out.telemetry.unitsHeld === 0
        && plain.deltas.join('').startsWith(W_PLAIN) && !plain.deltas.join('').includes(A2.slice(0, 20)) && plain.out.telemetry.heldDependentOpening === 1,
        ascii(after.deltas.join('|') + ' || ' + plain.deltas.join('|')));
      const own = await lib(W_OWN);
      const ownAfter = await lib([W_HURAYRA, W_OWN].join('\n'));
      ok('C5e a unit that quotes its own matn and then says "this hadith" is not dependent: out at the opening and after a held unit',
        own.deltas.join('').startsWith(W_OWN.slice(0, 30)) && own.out.telemetry.heldDependentOpening === 0 && own.out.telemetry.unitsProvedHadith === 1
        && ownAfter.deltas.join('').includes(W_OWN.slice(0, 30)) && ownAfter.out.telemetry.heldDependentOnHeld === 0,
        ascii(own.deltas.join('|') + ' || ' + ownAfter.deltas.join('|')) + JSON.stringify(ownAfter.out.telemetry));

      const q2 = await lib([W_ANAS, W_AGREED, W_NISBA, W_SUBJECT, A2C].join('\n'));
      const t2 = q2.deltas.join('');
      const tel2 = q2.out.telemetry;
      ok('C6a q2: the answering units go out on the carrying row (1:301) -- "\x27an Anas ibn Malik", "agreed upon", a nisba the row does not write, Anas as the subject -- and answer 2 follows them',
        t2.startsWith(W_ANAS) && t2.includes(W_AGREED.replace(/\s*\[\[1\]\]/u, '')) && t2.includes(W_NISBA) && t2.includes(W_SUBJECT) && t2.includes(A2)
        // COMPREHENSIVE 3.4c: answer 2's saying stands in STRAIGHT quotes, which findMatns now reads; the cited row (Jami' al-'Ulum, 1:301) carries it, so
        // the unit is now proved on the row too: 5 proved where it was 4 (the bytes released are the same; C7h pins them by sha256).
        && tel2.unitsProvedHadith === 5 && tel2.unitsHeld === 0 && tel2.takhrijLookups === 1, ascii(q2.deltas.join('|')) + ' ' + JSON.stringify(tel2));
      ok('C6b ...no not-covered sentence and no offer; the book\x27s card goes out once for its two rows; answer 2 alone took a lookup, which did not prove it',
        !t2.includes(NOT_COVERED) && !hasOffer(q2) && tel2.cardsSent === 1, JSON.stringify(tel2));
      const wrong = await lib([W_ANAS, W_HURAYRA, W_SIRIN, W_DAWUD].join('\n'));
      ok('C6c with the carrying row kept: a narrator the row lacks (Abu Hurayra), another lineage (Anas ibn Sirin) and the wrong collection (Abu Dawud) stay held',
        wrong.deltas.join('').startsWith(W_ANAS) && wrong.out.telemetry.unitsReleased === 1 && wrong.out.telemetry.unitsHeld === 3
        && wrong.out.telemetry.heldUncitedAttribution === 3, ascii(wrong.deltas.join('|')) + ' ' + JSON.stringify(wrong.out.telemetry));
      const bare = await lib([W_ANAS, W_NISBA].join('\n'), [RENC]);
      ok('C6d a row that carries the text alone proves neither the collections nor Anas, and the library\'s proof names no Companion: held, and the not-covered sentence',
        !bare.deltas.join('').includes(W_ANAS) && !bare.deltas.join('').includes(W_NISBA) && bare.out.telemetry.unitsProvedHadith === 0
        && bare.deltas.join('').includes(NOT_COVERED) && hasOffer(bare) && bare.out.telemetry.takhrijLookups === 2,
        ascii(bare.deltas.join('|')) + ' ' + JSON.stringify(bare.out.telemetry));
      ok('C6e the readers: Anas ibn Malik is a narrator (his lineage is not the Muwatta), so is the subject of "rawahu" with the prayer; a credit ending on "\'an" names only its collections; a title or nisba the row lacks is fine, another lineage or kunya is not',
        JSON.stringify(UNITS.narratorsNamed(W_ANAS)) === JSON.stringify([F_ANAS]) && UNITS.narratorsNamed(W_SUBJECT).includes(F_ANAS)
        && UNITS.claimOnlyNames(CREDIT_AN, { collections: UNITS.collectionsNamed(W_ANAS), narrators: [] })
        && UNITS.textNamesNarrator(F_ROW_ANAS, F_NISBA) && UNITS.textNamesNarrator(F_ROW_ANAS, F_ANAS)
        && !UNITS.textNamesNarrator(F_ROW_ANAS, F_SIRIN) && !UNITS.textNamesNarrator(F_ROW_BAKR, F_HURAYRA),
        JSON.stringify([UNITS.narratorsNamed(W_ANAS), UNITS.narratorsNamed(W_SUBJECT)]));
      // SPEED FIX 5: the Q2 fixture's released text, byte for byte, as 4d353de released it (SHA-256 measured there).
      ok('C7h FIX4\x27s Q2 fixture releases as before under C7 and C8 (a source question whose first unit is proved): the same bytes, 5 released, 5 proved (answer 2 now proved on its row: 3.4c)',
        require('crypto').createHash('sha256').update(t2).digest('hex') === '949ade0807e77a9a1b7fd04834dc8160f4b6575b931e0676fb29b4c87043f008'
        && tel2.unitsReleased === 5 && tel2.unitsHeld === 0 && tel2.unitsProvedHadith === 5 && UNITS.asksHadithSource(Q2), JSON.stringify(tel2));
    }

    // ---------------------------------------------------------------- SPEED FIX 5: C7, C8
    // Built from the owner tool's round 5 (EZIK-SPEED-PREVIEW5-LIVE-2026-09-27): questions 3 and 4 verbatim, and answer 4's
    // first sentence (the side unit about one link of the chain, the only writer sentence the preview showed). The kept
    // rows are the local library index's own rows for question 4 (ezik-shamela-20260820, as gatherBw2 returned them):
    // Ibn Rajab's Jami' al-Ulum wal-Hikam at 2:5-6 (the preview's card: the side unit's source; it names Muslim but does
    // not carry the asked text) = ref 1, and the Kuwaiti encyclopedia at 43:326 (the text, and "rawa Abu Malik
    // al-Ash'ari", no collection) = ref 2. The takhrij fake is the library's measured answer for this hadith: sourced,
    // "(Ahmad, no ruling found)", no Companion; with a credit in the prose, withheld, prose books al-Bayhaqi, Ibn Abi
    // Shayba, Ahmad -- never Muslim.
    {
      const Q4 = '\u0645\u0646 \u0631\u0648\u0649 \u062d\u062f\u064a\u062b: \u0627\u0644\u0637\u0647\u0648\u0631 \u0634\u0637\u0631 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u061f';
      const Q3 = '\u0647\u0644 \u062d\u062f\u064a\u062b: \u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647 \u0641\u064a \u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646\u061f \u0648\u0645\u0646 \u0627\u0644\u0635\u062d\u0627\u0628\u064a \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647\u061f';
      const Q5 = '\u0645\u0627 \u062d\u0643\u0645 \u0645\u0646 \u0623\u0641\u0637\u0631 \u0641\u064a \u0631\u0645\u0636\u0627\u0646 \u0646\u0627\u0633\u064a\u064b\u0627\u061f';
      const M4 = '\u0627\u0644\u0637\u0647\u0648\u0631 \u0634\u0637\u0631 \u0627\u0644\u0625\u064a\u0645\u0627\u0646';
      const M1 = '\u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647';
      const SIDE = '\u0648\u0627\u062e\u062a\u0644\u0641 \u0641\u064a \u0633\u0645\u0627\u0639 \u064a\u062d\u064a\u0649 \u0628\u0646 \u0623\u0628\u064a \u0643\u062b\u064a\u0631 \u0645\u0646 \u0632\u064a\u062f \u0628\u0646 \u0633\u0644\u0627\u0645\u060c \u0641\u0623\u0646\u0643\u0631\u0647 \u064a\u062d\u064a\u0649 \u0628\u0646 \u0645\u0639\u064a\u0646\u060c \u0648\u0623\u062b\u0628\u062a\u0647 \u0627\u0644\u0625\u0645\u0627\u0645 \u0623\u062d\u0645\u062f.';
      const R_IBN = { kind: 'lib_book', title: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637 \u00b7 \u062c2 \u00b7 \u06355-6', url: '', publisher: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a',
        bookTitle: '\u062c\u0627\u0645\u0639 \u0627\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062d\u0643\u0645 \u062a \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637', author: '\u0627\u0628\u0646 \u0631\u062c\u0628 \u0627\u0644\u062d\u0646\u0628\u0644\u064a', locator: '\u062c2 \u00b7 \u06355-6', recordId: 'lib:FC-001812:0024:002',
        text: '\u0648\u064e\u0642\u064e\u062f\u0650 \u0627\u062e\u0652\u062a\u064f\u0644\u0650\u0641\u064e \u0641\u0650\u064a \u0633\u064e\u0645\u064e\u0627\u0639\u0650 \u064a\u064e\u062d\u0652\u064a\u064e\u0649 \u0628\u0652\u0646\u0650 \u0623\u064e\u0628\u0650\u064a \u0643\u064e\u062b\u0650\u064a\u0631\u064d \u0645\u0650\u0646\u0652 \u0632\u064e\u064a\u0652\u062f\u0650 \u0628\u0652\u0646\u0650 \u0633\u064e\u0644\u0651\u064e\u0627\u0645\u064d\u060c \u0641\u064e\u0623\u064e\u0646\u0652\u0643\u064e\u0631\u064e\u0647\u064f \u064a\u064e\u062d\u0652\u064a\u064e\u0649 \u0628\u0652\u0646\u064f \u0645\u064e\u0639\u0650\u064a\u0646\u064d\u060c \u0648\u064e\u0623\u064e\u062b\u0652\u0628\u064e\u062a\u064e\u0647\u064f \u0627\u0644\u0652\u0625\u0650\u0645\u064e\u0627\u0645\u064f \u0623\u064e\u062d\u0652\u0645\u064e\u062f\u064f\u060c \u0648\u064e\u0641\u0650\u064a \u0647\u064e\u0630\u0650\u0647\u0650 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u0650 \u0627\u0644\u062a\u0651\u064e\u0635\u0652\u0631\u0650\u064a\u062d\u064f \u0628\u0650\u0633\u064e\u0645\u064e\u0627\u0639\u0650\u0647\u0650 \u0645\u0650\u0646\u0652\u0647\u064f. \u0648\u064e\u062e\u064e\u0631\u0651\u064e\u062c\u064e \u0647\u064e\u0630\u064e\u0627 \u0627\u0644\u0652\u062d\u064e\u062f\u0650\u064a\u062b\u064e \u0627\u0644\u0646\u0651\u064e\u0633\u064e\u0627\u0626\u0650\u064a\u0651\u064f\u060c \u0648\u064e\u0627\u0628\u0652\u0646\u064f \u0645\u064e\u0627\u062c\u064e\u0647\u0652 \u0645\u0650\u0646\u0652 \u0631\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u0650 \u0645\u064f\u0639\u064e\u0627\u0648\u0650\u064a\u064e\u0629\u064e \u0628\u0652\u0646\u0650 \u0633\u064e\u0644\u0651\u064e\u0627\u0645\u064d\u060c \u0639\u064e\u0646\u0652 \u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0632\u064e\u064a\u0652\u062f\u0650 \u0628\u0652\u0646\u0650 \u0633\u064e\u0644\u0651\u064e\u0627\u0645\u064d\u060c \u0639\u064e\u0646\u0652 \u062c\u064e\u062f\u0651\u0650\u0647\u0650 \u0623\u064e\u0628\u0650\u064a \u0633\u064e\u0644\u0651\u064e\u0627\u0645\u064d\u060c \u0639\u064e\u0646\u0652 \u0639\u064e\u0628\u0652\u062f\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0646\u0650 \u0628\u0652\u0646\u0650 \u063a\u064e\u0646\u0652\u0645\u064d\u060c \u0639\u064e\u0646\u0652 \u0623\u064e\u0628\u0650\u064a \u0645\u064e\u0627\u0644\u0650\u0643\u064d\u060c \u0641\u064e\u0632\u064e\u0627\u062f\u064e \u0641\u0650\u064a \u0625\u0650\u0633\u0652\u0646\u064e\u0627\u062f\u0650\u0647\u0650 \u0639\u064e\u0628\u0652\u062f\u064e \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0646\u0650 \u0628\u0652\u0646\u064e \u063a\u064e\u0646\u0652\u0645\u064d\u060c \u0648\u064e\u0631\u064e\u062c\u0651\u064e\u062d\u064e \u0647\u064e\u0630\u0650\u0647\u0650 \u0627\u0644\u0631\u0651\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u064e \u0628\u064e\u0639\u0652\u0636\u064f \u0627\u0644\u0652\u062d\u064f\u0641\u0651\u064e\u0627\u0638\u0650\u060c \u0648\u064e\u0642\u064e\u0627\u0644\u064e: \u0645\u064f\u0639\u064e\u0627\u0648\u0650\u064a\u064e\u0629\u064f \u0628\u0652\u0646\u064f \u0633\u064e\u0644\u0651\u064e\u0627\u0645\u064d \u0623\u064e\u0639\u0652\u0644\u064e\u0645\u064f \u0628\u0650\u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0623\u064e\u062e\u0650\u064a\u0647\u0650 \u0632\u064e\u064a\u0652\u062f\u064d \u0645\u0650\u0646\u0652 \u064a\u064e\u062d\u0652\u064a\u064e\u0649 \u0628\u0652\u0646\u0650 \u0623\u064e\u0628\u0650\u064a \u0643\u064e\u062b\u0650\u064a\u0631\u064d\u060c \u0648\u064e\u064a\u064f\u0642\u064e\u0648\u0651\u0650\u064a \u0630\u064e\u0644\u0650\u0643\u064e \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u0642\u064e\u062f\u0652 \u0631\u064f\u0648\u0650\u064a\u064e \u0639\u064e\u0646\u0652 \u0639\u064e\u0628\u0652\u062f\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0646\u0650 \u0628\u0652\u0646\u0650 \u063a\u064e\u0646\u0652\u0645\u064d \u0639\u064e\u0646\u0652 \u0623\u064e\u0628\u0650\u064a \u0645\u064e\u0627\u0644\u0650\u0643\u064d \u0645\u0650\u0646\u0652 \u0648\u064e\u062c\u0652\u0647\u064d \u0622\u062e\u064e\u0631\u064e\u060c \u0648\u064e\u062d\u0650\u064a\u0646\u064e\u0626\u0650\u0630\u064d \u0641\u064e\u062a\u064e\u0643\u064f\u0648\u0646\u064f \u0631\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u064f \u0645\u064f\u0633\u0652\u0644\u0650\u0645\u064d \u0645\u064f\u0646\u0652\u0642\u064e\u0637\u0650\u0639\u064e\u0629\u064b. \u0648\u064e\u0641\u0650\u064a \u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u0645\u064f\u0639\u064e\u0627\u0648\u0650\u064a\u064e\u0629\u064e \u0628\u064e\u0639\u0652\u0636\u064f \u0627\u0644\u0652\u0645\u064f\u062e\u064e\u0627\u0644\u064e\u0641\u064e\u0629\u0650 \u0644\u0650\u062d\u064e\u062f\u0650\u064a\u062b\u0650 \u064a\u064e\u062d\u0652\u064a\u064e\u0649 \u0628\u0652\u0646\u0650 \u0623\u064e\u0628\u0650\u064a \u0643\u064e\u062b\u0650\u064a\u0631\u064d\u060c \u0641\u064e\u0625\u0650\u0646\u0651\u064e \u0644\u064e\u0641\u0652\u0638\u064e \u062d\u064e\u062f\u0650\u064a\u062b\u0650\u0647\u0650 \u0639\u0650\u0646\u0652\u062f\u064e \u0627\u0628\u0652\u0646\u0650 \u0645\u064e\u0627\u062c\u064e\u0647\u0652: \u00ab\u0625\u0650\u0633\u0652\u0628\u064e\u0627\u063a\u064f \u0627\u0644\u0652\u0648\u064f\u0636\u064f\u0648\u0621\u0650 \u0634\u064e\u0637\u0652\u0631\u064f \u0627\u0644\u0652\u0625\u0650\u064a\u0645\u064e\u0627\u0646\u0650\u060c \u0648\u064e\u0627\u0644\u0652\u062d\u064e\u0645\u0652\u062f\u064f \u0644\u0650\u0644\u0651\u064e\u0647\u0650 \u0645\u0650\u0644\u0652\u0621\u064f \u0627\u0644\u0652\u0645\u0650\u064a\u0632\u064e\u0627\u0646\u0650\u060c \u0648\u064e\u0627\u0644\u062a\u0651\u064e\u0633\u0652\u0628\u0650\u064a\u062d\u064f \u0648\u064e\u0627\u0644\u062a\u0651\u064e\u0643\u0652\u0628\u0650\u064a\u0631\u064f \u0645\u0650\u0644\u0652\u0621\u064f \u0627\u0644\u0633\u0651\u064e\u0645\u064e\u0627\u0621\u0650 \u0648\u064e\u0627\u0644\u0652\u0623\u064e\u0631\u0652\u0636\u0650\u060c \u0648\u064e\u0627\u0644\u0635\u0651\u064e\u0644\u064e\u0627\u0629\u064f \u0646\u064f\u0648\u0631\u064c\u060c \u0648\u064e\u0627\u0644\u0632\u0651\u064e\u0643\u064e\u0627\u0629\u064f \u0628\u064f\u0631\u0652\u0647\u064e\u0627\u0646\u064c\u060c \u0648\u064e\u0627\u0644\u0635\u0651\u064e\u0628\u0652\u0631\u064f \u0636\u0650\u064a\u064e\u0627\u0621\u064c\u060c \u0648\u064e\u0627\u0644\u0652\u0642\u064f\u0631\u0652\u0622\u0646\u064f \u062d\u064f\u062c\u0651\u064e\u0629\u064c \u0644\u064e\u0643\u064e \u0623\u064e\u0648\u0652 \u0639\u064e\u0644\u064e\u064a\u0652\u0643\u064e\u060c \u0643\u064f\u0644\u0651\u064f \u0627\u0644\u0646\u0651\u064e\u0627\u0633\u0650 \u064a\u064e\u063a\u0652\u062f\u064f\u0648\u060c \u0641\u064e\u0628\u064e\u0627\u0626\u0650\u0639\u064c \u0646\u064e\u0641\u0652\u0633\u064e\u0647\u064f \u0641\u064e\u0645\u064f\u0639\u0652\u062a\u0650\u0642\u064f\u0647\u064e\u0627\u060c \u0623\u064e\u0648\u0652 \u0645\u064f\u0648\u0628\u0650\u0642\u064f\u0647\u064e\u0627\u00bb ".' };
      const R_ENC = { kind: 'lib_book', title: '\u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629 \u0627\u0644\u0643\u0648\u064a\u062a\u064a\u0629 \u00b7 \u062c43 \u00b7 \u0635326', url: '', publisher: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u0624\u0644\u0641\u064a\u0646',
        bookTitle: '\u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629 \u0627\u0644\u0641\u0642\u0647\u064a\u0629 \u0627\u0644\u0643\u0648\u064a\u062a\u064a\u0629', author: '\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u0624\u0644\u0641\u064a\u0646', locator: '\u062c43 \u00b7 \u0635326', recordId: 'lib:FC-003910:18291:002',
        text: '\u0645\u064e\u0627 \u0631\u064e\u0648\u064e\u0649 \u0623\u064e\u0628\u064f\u0648 \u0645\u064e\u0627\u0644\u0650\u0643\u064d \u0627\u0644\u0623\u0652\u064e\u0634\u0652\u0639\u064e\u0631\u0650\u064a\u0651\u064f \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649 \u0639\u064e\u0646\u0652\u0647\u064f \u0642\u064e\u0627\u0644: \u0642\u064e\u0627\u0644 \u0631\u064e\u0633\u064f\u0648\u0644 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e: \u0627\u0644\u0637\u0651\u064e\u0647\u064f\u0648\u0631\u064f \u0634\u064e\u0637\u0652\u0631\u064f \u0627\u0644\u0625\u0652\u0650\u064a\u0645\u064e\u0627\u0646\u0650 (1) . \u0648\u064e\u0631\u064e\u0648\u064e\u0649 \u0639\u064f\u062b\u0652\u0645\u064e\u0627\u0646\u064f \u0628\u0652\u0646\u064f \u0639\u064e\u0641\u0651\u064e\u0627\u0646\u064e \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649 \u0639\u064e\u0646\u0652\u0647\u064f \u0623\u064e\u0646\u0651\u064e\u0647\u064f \u062a\u064e\u0648\u064e\u0636\u0651\u064e\u0623\u064e \u062b\u064f\u0645\u0651\u064e \u0642\u064e\u0627\u0644: \u0625\u0650\u0646\u0651\u0650\u064a \u0631\u064e\u0623\u064e\u064a\u0652\u062a\u064f \u0631\u064e\u0633\u064f\u0648\u0644 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u062a\u064e\u0648\u064e\u0636\u0651\u064e\u0623\u064e \u0645\u0650\u062b\u0652\u0644 \u0648\u064f\u0636\u064f\u0648\u0626\u0650\u064a \u0647\u064e\u0630\u064e\u0627 \u062b\u064f\u0645\u0651\u064e \u0642\u064e\u0627\u0644: " \u0645\u064e\u0646\u0652 \u062a\u064e\u0648\u064e\u0636\u0651\u064e\u0623\u064e \u0647\u064e\u0643\u064e\u0630\u064e\u0627 \u063a\u064f\u0641\u0650\u0631\u064e \u0644\u064e\u0647\u064f \u0645\u064e\u0627 \u062a\u064e\u0642\u064e\u062f\u0651\u064e\u0645\u064e \u0645\u0650\u0646\u0652 \u0630\u064e\u0646\u0652\u0628\u0650\u0647\u0650 (2) . \u0648\u064e\u0639\u064e\u0646\u0652 \u0639\u064f\u062b\u0652\u0645\u064e\u0627\u0646\u064e \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649 \u0639\u064e\u0646\u0652\u0647\u064f \u0642\u064e\u0627\u0644: \u0642\u064e\u0627\u0644 \u0631\u064e\u0633\u064f\u0648\u0644 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e: \u0645\u064e\u0646\u0652 \u062a\u064e\u0648\u064e\u0636\u0651\u064e\u0623\u064e \u0641\u064e\u0623\u064e\u062d\u0652\u0633\u064e\u0646\u064e \u0627\u0644\u0652\u0648\u064f\u0636\u064f\u0648\u0621\u064e \u062e\u064e\u0631\u064e\u062c\u064e\u062a\u0652 \u062e\u064e\u0637\u064e\u0627\u064a\u064e\u0627\u0647\u064f \u062d\u064e\u062a\u0651\u064e\u0649 \u062a\u064e\u062e\u0652\u0631\u064f\u062c\u064e \u0645\u0650\u0646\u0652 \u062a\u064e\u062d\u0652\u062a\u0650 \u0623\u064e\u0638\u0652\u0641\u064e\u0627\u0631\u0650\u0647\u0650 (3) . \u0648\u064e\u0639\u064e\u0646\u0652 \u0639\u064f\u0645\u064e\u0631\u064e \u0628\u0652\u0646\u0650 \u0627\u0644\u0652\u062e\u064e\u0637\u0651\u064e\u0627\u0628\u0650 \u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649 \u0639\u064e\u0646\u0652\u0647\u064f \u0639\u064e\u0646\u0650 \u0627\u0644\u0646\u0651\u064e\u0628\u0650\u064a\u0651\u0650 \u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e \u0642\u064e\u0627\u0644: \u0645\u064e\u0627 \u0645\u0650\u0646\u0652\u0643\u064f\u0645\u0652 \u0645\u0650\u0646\u0652 \u0623\u064e\u062d\u064e\u062f\u064d \u064a\u064e\u062a\u064e\u0648\u064e\u0636\u0651\u064e\u0623\u064f \u0641\u064e\u064a\u064f\u0628\u0652\u0644\u0650\u063a\u064f\u060c \u0623\u064e\u0648\u0652 \u0641\u064e\u064a\u064f\u0633\u0652\u0628\u0650\u063a\u064f \u0627\u0644\u0652\u0648\u064f\u0636\u064f\u0648\u0621\u064e\u060c \u062b\u064f\u0645\u0651\u064e \u064a\u064e\u0642\u064f\u0648\u0644: \u0623\u064e\u0634\u0652\u0647\u064e\u062f\u064f \u0623\u064e\u0646\u0652 \u0644\u0627\u064e \u0625\u0650\u0644\u064e\u0647\u064e \u0625\u0650\u0644\u0627\u0651\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f\u060c \u0648\u064e\u0623\u064e\u0634\u0652\u0647\u064e\u062f\u064f \u0623\u064e\u0646\u0651\u064e \u0645\u064f\u062d\u064e\u0645\u0651\u064e\u062f\u064b\u0627 \u0639\u064e\u0628\u0652\u062f\u064f \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0648\u064e\u0631\u064e\u0633\u064f\u0648\u0644\u064f\u0647\u064f\u060c \u0625\u0650\u0644\u0627\u0651\u064e \u0641\u064f\u062a\u0651\u0650\u062d\u064e\u062a\u0652 \u0644\u064e\u0647\u064f \u0623\u064e\u0628\u0652\u0648\u064e\u0627\u0628\u064f \u0627\u0644\u0652\u062c\u064e\u0646\u0651\u064e\u0629\u0650 \u0627\u0644\u062b\u0651\u064e\u0645\u064e\u0627\u0646\u0650\u064a\u064e\u0629\u064f \u064a\u064e\u062f\u0652\u062e\u064f\u0644 \u0645\u0650\u0646\u0652 \u0623\u064e\u064a\u0651\u0650\u0647\u064e\u0627 \u0634\u064e\u0627\u0621\u064e "\u060c \u0648\u064e\u0641\u0650\u064a \u0631\u0650\u0648\u064e\u0627\u064a\u064e\u0629\u064d: " \u0623\u064e\u0634\u0652\u0647\u064e\u062f\u064f \u0623\u064e\u0646\u0652 \u0644\u0627\u064e \u0625\u0650\u0644\u064e\u0647\u064e \u0625\u0650\u0644\u0627\u0651\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0648\u064e\u062d\u0652\u062f\u064e\u0647\u064f \u0644\u0627\u064e \u0634\u064e\u0631\u0650\u064a\u0643\u064e \u0644\u064e\u0647\u064f\u060c \u0648\u064e\u0623\u064e\u0634\u0652\u0647\u064e\u062f\u064f \u0623\u064e\u0646\u0651\u064e \u0645\u064f\u062d\u064e\u0645\u0651\u064e\u062f\u064b\u0627 \u0639\u064e\u0628\u0652\u062f\u064f\u0647\u064f \u0648\u064e\u0631\u064e\u0633\u064f\u0648\u0644\u064f\u0647\u064f (4) .' };
      const cite = (s, ref) => s.replace(/\.$/u, ' [[' + ref + ']].');
      const drop = (s) => String(s).replace(/\s*\[\[\d+\]\]/gu, '');
      const SIDE_C = cite(SIDE, 1);
      const ANS_MUSLIM = '\u0631\u0648\u0627\u0647 \u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0628\u064a \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const AKHRAJAHU = '\u0623\u062e\u0631\u062c\u0647 \u0645\u0633\u0644\u0645 \u0641\u064a \u0635\u062d\u064a\u062d\u0647.';
      const ANS_ABU_MALIK = '\u0631\u0648\u0627\u0647 \u0623\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const ANS_OWN = '\u0639\u0646 \u0623\u0628\u064a \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647 \u0642\u0627\u0644: \u0642\u0627\u0644 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645: \u00ab' + M4 + '\u00bb.';
      const THIS_HADITH = '\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0623\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const WA_THIS_HADITH = '\u0648\u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0631\u0648\u0627\u0647 \u0623\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const RAWA_THIS = '\u0631\u0648\u0649 \u0647\u0630\u0627 \u0627\u0644\u062d\u062f\u064a\u062b \u0623\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const HUWA = '\u0648\u0627\u0644\u0635\u062d\u0627\u0628\u064a \u0627\u0644\u0630\u064a \u0631\u0648\u0627\u0647 \u0647\u0648 \u0623\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0623\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const LEAD = '\u0648\u0646\u0635\u0647:';
      const PAREN4 = '\u0623\u062d\u0645\u062f \u00b7 \u0644\u0645 \u064a\u0648\u0642\u0641 \u0639\u0644\u0649 \u062d\u0643\u0645';
      const byLibrary4 = async (text) => {
        if (!text.includes(M4)) return { text, entries: [] };
        if (/\u0631\u0648\u0627\u0647|\u0623\u062e\u0631\u062c\u0647|\u0645\u0633\u0644\u0645/u.test(text.replace(/\u00ab[^\u00bb]*\u00bb/gu, ''))) {
          return { text, entries: [{ matn: M4, sourced: false, withheld: PAREN4, proseProof: ['\u0627\u0644\u0628\u064a\u0647\u0642\u064a', '\u0627\u0628\u0646 \u0623\u0628\u064a \u0634\u064a\u0628\u0629', '\u0623\u062d\u0645\u062f'], companion: '', declined: 'prose_states_attribution' }] };
        }
        const at = text.indexOf('\u00bb', text.indexOf(M4)) + 1;
        return { text: text.slice(0, at) + ' (' + PAREN4 + ')' + text.slice(at), entries: [{ matn: M4, sourced: true, parenthetical: PAREN4, companion: '' }] };
      };
      const q4 = (writerText, library = [R_IBN, R_ENC], question = Q4) => run({ question, fatwa: [], libOn: true, library, writerText, takhrijImpl: byLibrary4 });

      const a = await q4([SIDE_C, ANS_MUSLIM, ANS_ABU_MALIK].join('\n'));
      const at = a.deltas.join('');
      const ta = a.out.telemetry;
      ok('C7a q4: the side unit is held at the opening (dependent_opening); the answering unit the carrying row proves goes out first, on that row',
        at.startsWith(ANS_ABU_MALIK) && !at.includes(SIDE.slice(0, 20)) && !at.includes(ANS_MUSLIM.slice(0, 12)) && ta.heldDependentOpening === 1
        && ta.heldUncitedAttribution === 1 && ta.unitsProvedHadith === 1 && ta.unitsReleased === 1 && !at.includes(NOT_COVERED) && !hasOffer(a)
        && at.includes('\u0627\u0644\u0645\u0648\u0633\u0648\u0639\u0629'), ascii(a.deltas.join('|')) + ' ' + JSON.stringify(ta));
      const f = await q4([ANS_ABU_MALIK, SIDE_C, ANS_MUSLIM].join('\n'));
      const ft = f.deltas.join('');
      ok('C7b ...and the side unit may follow it: after the first proved unit, today\x27s checks (the unit naming Muslim, which nothing carries, stays held)',
        ft.startsWith(ANS_ABU_MALIK) && ft.includes(drop(SIDE_C)) && ft.indexOf(drop(SIDE_C)) > ft.indexOf(ANS_ABU_MALIK)
        && f.out.telemetry.unitsReleased === 2 && f.out.telemetry.heldUncitedAttribution === 1 && f.out.telemetry.heldDependentOpening === 0,
        ascii(f.deltas.join('|')) + ' ' + JSON.stringify(f.out.telemetry));
      const n = await q4([SIDE_C, ANS_MUSLIM, cite(AKHRAJAHU, 1), ANS_ABU_MALIK].join('\n'), [R_IBN]);
      ok('C7c with no proving evidence (only the card\x27s row, which lacks the asked text): the not-covered sentence and the offer, and nothing else',
        n.deltas.join('') === NOT_COVERED && hasOffer(n) && n.out.telemetry.unitsReleased === 0 && n.out.telemetry.unitsProvedHadith === 0
        && n.out.telemetry.heldDependentOpening === 1, ascii(n.deltas.join('|')) + ' ' + JSON.stringify(n.out.telemetry));
      const th = await q4([SIDE_C, THIS_HADITH].join('\n'));
      const wa = await q4([SIDE_C, WA_THIS_HADITH, ANS_ABU_MALIK].join('\n'));
      ok('C7d a proved unit opening "this hadith" means the asked hadith and goes out first, after the held side unit too; behind wa it stays R5\x27s connector',
        th.deltas.join('').startsWith(THIS_HADITH) && th.out.telemetry.heldDependentOnHeld === 0 && th.out.telemetry.heldDependentOpening === 1
        && th.out.telemetry.unitsProvedHadith === 1 && !wa.deltas.join('').includes(WA_THIS_HADITH) && wa.out.telemetry.heldDependentOnHeld === 1
        && wa.deltas.join('').startsWith(ANS_ABU_MALIK), ascii(th.deltas.join('|') + ' || ' + wa.deltas.join('|')));
      const ld = await q4([LEAD, ANS_OWN, SIDE_C].join('\n'));
      const ldn = await q4([LEAD, SIDE_C, ANS_ABU_MALIK].join('\n'));
      ok('C7e a lead-in goes out with the proved unit it introduces, in one delta; a lead-in before the side unit is held with it',
        (ld.deltas[0] || '').startsWith(LEAD + '\n') && (ld.deltas[0] || '').includes(M4) && ld.out.telemetry.unitsProvedHadith === 1
        && ld.deltas.join('').includes(drop(SIDE_C)) && !ldn.deltas.join('').includes(LEAD) && ldn.deltas.join('').startsWith(ANS_ABU_MALIK)
        && ldn.out.telemetry.heldDependentOpening === 1, ascii(ld.deltas.join('|') + ' || ' + ldn.deltas.join('|')));
      const GRADE4 = '\u0645\u0627 \u0635\u062d\u0629 \u062d\u062f\u064a\u062b: \u0627\u0644\u0637\u0647\u0648\u0631 \u0634\u0637\u0631 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u061f';
      const MEANING4 = '\u0645\u0627 \u0645\u0639\u0646\u0649 \u062d\u062f\u064a\u062b: \u0627\u0644\u0637\u0647\u0648\u0631 \u0634\u0637\u0631 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u061f';
      const g = await q4([SIDE_C, ANS_ABU_MALIK].join('\n'), [R_IBN, R_ENC], GRADE4);
      const nh = await q4([SIDE_C, ANS_ABU_MALIK].join('\n'), [R_IBN, R_ENC], '\u0645\u0627 \u062d\u0643\u0645 \u0627\u0644\u0648\u0636\u0648\u0621 \u0642\u0628\u0644 \u0627\u0644\u0646\u0648\u0645\u061f');
      const src = UNITS.asksHadithSource;
      ok('C7f outside C7: a grading question and a question with no named hadith release the side unit first, as on 4d353de; the class reader',
        g.deltas.join('').startsWith(drop(SIDE_C)) && nh.deltas.join('').startsWith(drop(SIDE_C))
        && src(Q4) && src(Q3) && src(F.q11) && src('\u0645\u0646 \u0631\u0648\u0649 \u062d\u062f\u064a\u062b: ' + M1 + '\u061f') && src('\u0647\u0644 \u062d\u062f\u064a\u062b: ' + M4 + ' \u0641\u064a \u0635\u062d\u064a\u062d \u0645\u0633\u0644\u0645\u061f')
        && src('\u0645\u0627 \u0645\u0635\u062f\u0631 \u062d\u062f\u064a\u062b: ' + M4 + '\u061f') && src('\u0641\u064a \u0623\u064a \u0643\u062a\u0627\u0628 \u0648\u0631\u062f \u062d\u062f\u064a\u062b: ' + M4 + '\u061f')
        && !src(GRADE4) && !src(F.q10) && !src('\u0647\u0644 \u062d\u062f\u064a\u062b: ' + M4 + ' \u0635\u062d\u064a\u062d\u061f') && !src(MEANING4) && !src(Q5) && !src(F.q1),
        ascii(g.deltas.join('|') + ' || ' + nh.deltas.join('|')));

      // A fiqh answer shaped like question 5 (TOOLREP5 answer 5: the ruling, the Prophet's saying, a school's detail):
      // no hadith is named in the question, so C7 does not apply; the released bytes are 4d353de's (SHA-256 measured there).
      const Q5_RULING = '\u0645\u0646 \u0646\u0633\u064a \u0648\u0623\u0643\u0644 \u0623\u0648 \u0634\u0631\u0628 \u0641\u064a \u0646\u0647\u0627\u0631 \u0631\u0645\u0636\u0627\u0646 \u0641\u0635\u0648\u0645\u0647 \u0635\u062d\u064a\u062d\u060c \u0648\u064a\u062a\u0645 \u0635\u0648\u0645\u0647 \u0648\u0644\u0627 \u0634\u064a\u0621 \u0639\u0644\u064a\u0647 [[2]].';
      const Q5_SAYING = '\u0648\u0647\u0630\u0627 \u062b\u0627\u0628\u062a \u0639\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u062d\u064a\u062b \u0642\u0627\u0644: \u00ab' + FASTING_MATN + '\u00bb [[2]].';
      const Q5_CHEW = '\u0648\u0625\u0646 \u062a\u0630\u0643\u0631 \u0627\u0644\u0635\u0627\u0626\u0645 \u0648\u0647\u0648 \u0644\u0627 \u064a\u0632\u0627\u0644 \u064a\u0645\u0636\u063a \u0627\u0644\u0644\u0642\u0645\u0629 \u0641\u0639\u0644\u064a\u0647 \u0623\u0646 \u064a\u0644\u0641\u0638\u0647\u0627 \u0648\u0644\u0627 \u064a\u0628\u0644\u0639\u0647\u0627.';
      const Q5_MALIKI = '\u0648\u0623\u0645\u0627 \u0645\u0630\u0647\u0628 \u0627\u0644\u0645\u0627\u0644\u0643\u064a\u0629 \u0641\u0641\u064a\u0647 \u062a\u0641\u0635\u064a\u0644 \u0622\u062e\u0631\u060c \u0625\u0630 \u0630\u0647\u0628\u0648\u0627 \u0625\u0644\u0649 \u0623\u0646 \u0639\u0644\u064a\u0647 \u0627\u0644\u0642\u0636\u0627\u0621 \u0641\u0642\u0637 \u062f\u0648\u0646 \u0643\u0641\u0627\u0631\u0629.';
      const fq = await run({ question: Q5, writerText: [Q5_RULING, Q5_SAYING, Q5_CHEW, Q5_MALIKI].join('\n'), takhrij: true });
      const fqt = fq.deltas.join('');
      ok('C7g a fiqh answer shaped like q5 is unchanged: the same bytes as on 4d353de',
        !src(Q5) && require('crypto').createHash('sha256').update(fqt).digest('hex') === '75769309de0ef3c24faaeae206c59971285e4c5acef665f453634f6d182d18b7'
        && fq.out.telemetry.unitsReleased === 3 && fq.out.telemetry.unitsHeld === 1,
        ascii(fqt) + ' ' + require('crypto').createHash('sha256').update(fqt).digest('hex') + ' ' + JSON.stringify(fq.out.telemetry));

      // C8: the readers.
      const own = await q4([SIDE_C, ANS_OWN].join('\n'));
      ok('C8a a kunya whose second word is a collection\x27s names the narrator ("Abu Malik al-Ash\x27ari" is not the Muwatta); a collection at the head is still none',
        JSON.stringify(UNITS.narratorsNamed(ANS_MUSLIM)) === JSON.stringify(['\u0627\u0628\u064a \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a'])
        && UNITS.narratorsNamed(ANS_ABU_MALIK).includes('\u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a')
        && UNITS.narratorsNamed('\u0639\u0646 \u0623\u0628\u064a \u062f\u0627\u0648\u062f \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.').length === 0 && UNITS.narratorsNamed('\u0639\u0646 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.').length === 0
        && JSON.stringify(UNITS.collectionsNamed(ANS_MUSLIM)) === JSON.stringify(['\u0645\u0633\u0644\u0645']),
        JSON.stringify([UNITS.narratorsNamed(ANS_MUSLIM), UNITS.narratorsNamed(ANS_ABU_MALIK)]));
      ok('C8b a kunya\x27s case does not change the name: "an Abi Malik" is carried by the row\x27s "rawa Abu Malik"; another kunya is not',
        own.deltas.join('').startsWith(ANS_OWN.slice(0, 30)) && own.out.telemetry.unitsProvedHadith === 1 && own.out.telemetry.heldDependentOpening === 1
        && UNITS.textNamesNarrator('\u0645\u0627 \u0631\u0648\u0649 \u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647', '\u0627\u0628\u064a \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a')
        && UNITS.textNamesNarrator('\u0645\u0627 \u0631\u0648\u0649 \u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647', '\u0627\u0628\u0627 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a')
        && !UNITS.textNamesNarrator('\u0639\u0646 \u0627\u0628\u064a \u0628\u0643\u0631 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647', '\u0627\u0628\u0648 \u0647\u0631\u064a\u0631\u0647') && !UNITS.textNamesNarrator('\u0645\u0627 \u0631\u0648\u0649 \u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a', '\u0627\u0628\u0648 \u0647\u0631\u064a\u0631\u0647'),
        ascii(own.deltas.join('|')) + ' ' + JSON.stringify(own.out.telemetry));
      const rw = await q4([SIDE_C, RAWA_THIS].join('\n'));
      const hw = await q4([SIDE_C, HUWA].join('\n'));
      ok('C8c "rawa hadha al-hadith X" and "rawahu huwa X" name X: read, carried by the row, and out first',
        rw.deltas.join('').startsWith(RAWA_THIS) && rw.out.telemetry.unitsProvedHadith === 1 && hw.deltas.join('').startsWith(noWaw(HUWA))
        && hw.out.telemetry.unitsProvedHadith === 1 && JSON.stringify(UNITS.narratorsNamed(RAWA_THIS)) === JSON.stringify(['\u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a'])
        && JSON.stringify(UNITS.narratorsNamed(HUWA)) === JSON.stringify(['\u0627\u0628\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0634\u0639\u0631\u064a']),
        ascii(rw.deltas.join('|') + ' || ' + hw.deltas.join('|')));

      // Question 3: the question's own credit ("fi al-sahihayn") was read into the hadith, so the takhrij looked up a text
      // the library credits to al-Bukhari alone. The takhrij fake is the library's measured answer for each text looked up;
      // the kept row is question 3's own (Mustafa al-Adawi's lesson: the text, no collection, no Companion).
      const R_Q3 = { kind: 'lib_book', title: '\u062f\u0631\u0648\u0633 \u0644\u0644\u0634\u064a\u062e \u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a', url: '', publisher: '\u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a', bookTitle: '\u062f\u0631\u0648\u0633 \u0644\u0644\u0634\u064a\u062e \u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a',
        author: '\u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u0639\u062f\u0648\u064a', locator: '', recordId: 'lib:FC-007101:0671:001', text: '\u0648\u062c\u0648\u0628 \u0627\u0644\u0646\u0635\u062d \u0644\u0643\u0644 \u0645\u0633\u0644\u0645 \u0648\u0645\u0646 \u0645\u0633\u062a\u0644\u0632\u0645\u0627\u062a \u0627\u0644\u0623\u062e\u0648\u0629 \u0627\u0644\u0625\u064a\u0645\u0627\u0646\u064a\u0629: \u0627\u0644\u0646\u0635\u062d \u0644\u0644\u0645\u0633\u0644\u0645 \u0648\u062a\u0648\u062c\u064a\u0647\u0647 \u0625\u0644\u0649 \u0627\u0644\u062e\u064a\u0631\u060c \u0648\u0642\u062f \u0623\u062e\u0630 \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0627\u0644\u0628\u064a\u0639\u0629 \u0639\u0644\u0649 \u0628\u0639\u0636 \u0623\u0635\u062d\u0627\u0628\u0647 \u0628\u0630\u0644\u0643. \u0641\u0647\u0630\u0627 \u062c\u0631\u064a\u0631 \u0628\u0646 \u0639\u0628\u062f \u0627\u0644\u0644\u0647 \u0627\u0644\u0628\u062c\u0644\u064a \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647\u060c \u0648\u0643\u0627\u0646 \u0645\u0646 \u0627\u0644\u0635\u062d\u0627\u0628\u0629 \u0627\u0644\u0630\u064a\u0646 \u0622\u062a\u0627\u0647\u0645 \u0627\u0644\u0644\u0647 \u062c\u0645\u0627\u0644\u0627\u064b\u060c \u062d\u062a\u0649 \u0643\u0627\u0646 \u0628\u0639\u0636 \u0627\u0644\u0633\u0644\u0641 \u064a\u0637\u0644\u0642 \u0639\u0644\u064a\u0647 \u064a\u0648\u0633\u0641 \u0623\u0645\u0629 \u0645\u062d\u0645\u062f \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u060c \u0648\u0647\u0648 \u0627\u0644\u0630\u064a \u064a\u0642\u0648\u0644 \u0639\u0646 \u0646\u0641\u0633\u0647: (\u0645\u0627 \u0631\u0622\u0646\u064a \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0625\u0644\u0627 \u062a\u0628\u0633\u0645 \u0641\u064a \u0648\u062c\u0647\u064a) \u0647\u0630\u0627 \u0627\u0644\u0635\u062d\u0627\u0628\u064a \u0627\u0644\u062c\u064a\u0644 \u0642\u0627\u0644: (\u0628\u0627\u064a\u0639\u062a \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0639\u0644\u0649 \u0627\u0644\u0633\u0645\u0639 \u0648\u0627\u0644\u0637\u0627\u0639\u0629 \u0648\u0627\u0644\u0646\u0635\u062d \u0644\u0643\u0644 \u0645\u0633\u0644\u0645). \u0648\u0645\u0646 \u062d\u0642 \u0627\u0644\u0645\u0633\u0644\u0645 \u0639\u0644\u0649 \u0623\u062e\u064a\u0647: \u0625\u0630\u0627 \u0627\u0633\u062a\u0646\u0635\u062d\u0647 \u0623\u0646 \u064a\u0646\u0635\u062d \u0644\u0647\u060c \u0647\u0643\u0630\u0627 \u062c\u0627\u0621 \u0641\u064a \u0634\u0631\u064a\u0639\u0629 \u0645\u062d\u0645\u062f \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u060c \u0641\u0625\u0630\u0627 \u0637\u0644\u0628 \u0645\u0646\u0647 \u0627\u0644\u0639\u0648\u0646 \u0623\u0639\u0627\u0646\u0647\u060c \u0648\u0642\u062f \u0630\u0643\u0631 \u0627\u0644\u0644\u0647 \u0633\u0628\u062d\u0627\u0646\u0647 \u0648\u062a\u0639\u0627\u0644\u0649 \u0627\u0644\u0642\u0648\u0645 \u0627\u0644\u0630\u064a\u0646 \u064a\u0645\u0646\u0639\u0648\u0646 \u0627\u0644\u0645\u0627\u0639\u0648\u0646 \u0639\u0646 \u0625\u062e\u0648\u0627\u0646\u0647\u0645 \u0628\u0627\u0644\u0630\u0645 \u0641\u0642\u0627\u0644 \u0641\u064a \u0633\u0648\u0631\u0629 \u0633\u0645\u0627\u0647\u0627 \u0628\u0633\u0648\u0631\u0629 \u0627\u0644\u0645\u0627\u0639\u0648\u0646: {\u0623\u064e\u0631\u064e\u0623\u064e\u064a\u0652\u062a\u064e \u0627\u0644\u0651\u064e\u0630\u0650\u064a \u064a\u064f\u0643\u064e\u0630\u0651\u0650\u0628\u064f \u0628\u0650\u0627\u0644\u062f\u0651\u0650\u064a\u0646\u0650} [\u0627\u0644\u0645\u0627\u0639\u0648\u0646:1] \u0625\u0644\u0649 \u0642\u0648\u0644\u0647: {\u0627\u0644\u0651\u064e\u0630\u0650\u064a\u0646\u064e \u0647\u064f\u0645\u0652 \u064a\u064f\u0631\u064e\u0627\u0621\u064f\u0648\u0646\u064e * \u0648\u064e\u064a\u064e\u0645\u0652\u0646\u064e\u0639\u064f\u0648\u0646\u064e \u0627\u0644\u0652\u0645\u064e\u0627\u0639\u064f\u0648\u0646\u064e} [\u0627\u0644\u0645\u0627\u0639\u0648\u0646:6 - 7] \u0641\u0627\u0644\u0630\u064a\u0646 \u064a\u0645\u0646\u0639\u0648\u0646 \u0627\u0644\u0645\u0627\u0639\u0648\u0646 \u0639\u0646 \u0625\u062e\u0648\u0627\u0646\u0647\u0645 \u0627\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0630\u0643\u0631\u0648\u0627 \u0628\u0627\u0644\u0630\u0645 \u0641\u064a \u0643\u062a\u0627\u0628 \u0627\u0644\u0644\u0647\u060c \u0648\u0627\u0644\u0645\u0627\u0639\u0648\u0646: \u0627\u0644\u0639\u0627\u0631\u064a\u0629 \u0627\u0644\u062a\u064a \u062a\u0639\u0627\u0631 \u0643\u0627\u0644\u062f\u0644\u0648 \u0648\u0627\u0644\u0642\u062f\u0631 \u0648\u0646\u062d\u0648 \u0630\u0644\u0643. \u0625\u0630\u0627\u064b: \u0644\u0644\u0623\u062e\u0648\u0629 \u0645\u0633\u062a\u0644\u0632\u0645\u0627\u062a: \u0647\u0644 \u062a\u062d\u0628 \u0644\u0633\u0627\u0626\u0631 \u0627\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0645\u0627 \u062a\u062d\u0628\u0647 \u0644\u0623\u062e\u064a\u0647 \u0645\u0646 \u0623\u0645\u0643 \u0648\u0623\u0628\u064a\u0643 \u0628\u0644 \u0645\u0627 \u062a\u062d\u0628\u0647 \u0644\u0646\u0641\u0633\u0643\u061f \u0647\u0630\u0627 \u0645\u0646\u0637\u0648\u0642 \u062d\u062f\u064a\u062b \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0639\u0644\u0649 \u0622\u0644\u0647 \u0648\u0633\u0644\u0645 \u0648\u0644\u064a\u0633 \u0645\u0641\u0647\u0648\u0645\u0647: (\u0644\u0627 \u064a\u0624\u0645\u0646 \u0623\u062d\u062f\u0643\u0645 \u062d\u062a\u0649 \u064a\u062d\u0628 \u0644\u0623\u062e\u064a\u0647 \u0645\u0627 \u064a\u062d\u0628 \u0644\u0646\u0641\u0633\u0647)\u060c (\u0643\u0644 \u0627\u0644\u0645\u0633\u0644\u0645 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u0644\u0645 \u062d\u0631\u0627\u0645 \u062f\u0645\u0647 \u0648\u0645\u0627\u0644\u0647 \u0648\u0639\u0631\u0636\u0647).' };
      const byLibrary3 = async (text) => {
        if (!text.includes(M1)) return { text, entries: [] };
        const polluted = text.includes(M1 + ' \u0641\u064a \u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646');
        const matn = polluted ? M1 + ' \u0641\u064a \u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646' : M1;
        return polluted
          ? { text, entries: [{ matn, sourced: true, parenthetical: '\u0627\u0644\u0628\u062e\u0627\u0631\u064a', companion: '' }] }
          : { text, entries: [{ matn, sourced: true, parenthetical: '\u0645\u062a\u0641\u0642 \u0639\u0644\u064a\u0647', sealProof: ['\u0627\u0644\u062f\u0627\u0631\u0645\u064a', '\u0645\u0633\u0644\u0645', '\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0623\u062d\u0645\u062f', '\u0627\u0628\u0646 \u0645\u0627\u062c\u0647'], companion: '' }] };
      };
      const B1 = '\u0646\u0639\u0645\u060c \u0627\u0644\u062d\u062f\u064a\u062b \u0641\u064a \u0627\u0644\u0635\u062d\u064a\u062d\u064a\u0646.';
      const B2 = '\u0631\u0648\u0627\u0647 \u0627\u0644\u0628\u062e\u0627\u0631\u064a \u0648\u0645\u0633\u0644\u0645 \u0639\u0646 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647.';
      const q3 = await run({ question: Q3, fatwa: [], libOn: true, library: [R_Q3], writerText: [B2, B1].join('\n'), takhrijImpl: byLibrary3 });
      ok('C8d q3: the question\x27s hadith stops before its credit, so the takhrij proves the two Sahihs and that unit goes out first; the Companion no evidence names stays held',
        UNITS.askedHadithOf(Q3) === M1 && UNITS.askedHadithOf('\u0647\u0644 \u062d\u062f\u064a\u062b: ' + M1 + ' \u0639\u0646\u062f \u0645\u0633\u0644\u0645\u061f') === M1
        && UNITS.askedHadithOf(F.q10).length > 0 && UNITS.askedHadithOf(F.q10).endsWith('\u0627\u0644\u0635\u064a\u0646')
        && q3.deltas.join('').startsWith(B1) && !q3.deltas.join('').includes('\u0623\u0646\u0633') && q3.out.telemetry.unitsProvedHadith === 1
        && q3.out.telemetry.heldUncitedAttribution === 1 && !q3.deltas.join('').includes(NOT_COVERED),
        ascii(q3.deltas.join('|')) + ' ' + JSON.stringify(q3.out.telemetry));
    }

    // ---------------------------------------------------------------- T10 (unit level)
    const DIGITS = '7391';
    {
      const q = Q_MASAH + ' ' + DIGITS + ' \u0645\u0631\u0629';
      const r = await run({ question: q, writerText: [U.s1, U.bad, U.book].join(' '), libOn: true, library: [ROW_L1] });
      const t = r.out.telemetry;
      const ENUMS = { judgeOutcome: ['none', 'complete', 'incomplete', 'failed'], writerOutcome: ['none', 'ok', 'failed'],
        // SPEED PIPES fix 3: why the turn went on to today's path ('' when it did not).
        continued: ['', 'no_rows', 'judge_none', 'marker', 'none_released'] };
      const bad = Object.entries(t).filter(([k, v]) => {
        if (typeof v === 'number') return !Number.isFinite(v);
        if (typeof v === 'boolean' || v === null) return false;
        if (k === 'schools') return !Array.isArray(v) || v.some((s) => !BW2.BW2_SCHOOLS.includes(s));
        if (ENUMS[k]) return !ENUMS[k].includes(v);
        return true;
      });
      ok('T10a every telemetry value is a number, a boolean, null or a closed enum', bad.length === 0, JSON.stringify(bad));
      ok('T10b the question\'s digits leak into no field', !JSON.stringify(t).includes(DIGITS), JSON.stringify(t));
      ok('T10c the counters are the turn\'s own: released/held/cards/tokens',
        t.unitsReleased === 2 && t.unitsHeld === 1 && t.cardsSent === 2 && t.inTokens === 1200 && t.outTokens === 340
        && Number.isInteger(t.firstReleaseMs) && t.writerCalls === 1, JSON.stringify(t));
      const askSrc = read('api/ask.js');
      const logAt = askSrc.indexOf("console.log('[bw2]', {");
      const block = askSrc.slice(logAt, askSrc.indexOf('});', logAt));
      const pairs = [...block.matchAll(/(\w+): t\.(\w+)/g)];
      ok('T10d api/ask.js prints each [bw2] field straight from the telemetry object, name for name',
        logAt > 0 && pairs.length >= 28 && pairs.every((p) => p[1] === p[2]) && !/questionText|body\.|normalizeArabic/.test(block),
        String(pairs.length));
    }

    // ---------------------------------------------------------------- T9 (+ T10 at the handler)
    {
      const LEDGER_REDIS = await esm('lib/ledger/redis.js');
      const DAYCAP = await esm('lib/daycap.js');
      const FLAG = await esm('lib/ledger/flag.js');
      const LEGACY = await esm('lib/legacy-policy-flag.js');
      const CONSENT = await esm('lib/ai-consent.js');
      const handler = ASK.default;
      const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
        'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
        'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
        'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE'];
      const saved = {};
      for (const k of ENV_KEYS) saved[k] = process.env[k];
      const realFetch = globalThis.fetch;
      const capCounts = new Map();
      const installDayCapStore = () => {
        capCounts.clear();
        DAYCAP.__setRedisForTest({
          async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
          async sismember() { return 0; },
          pipeline() {
            const ops = [];
            return {
              incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
              expire() { ops.push(() => 1); },
              async exec() { return ops.map((f) => f()); },
            };
          },
        });
      };
      const makeRes = () => ({
        writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
        status(c) { this.statusCode = c; return this; },
        setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
        getHeader(k) { return this.headers[String(k).toLowerCase()]; },
        flushHeaders() { this.headersSent = true; },
        write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
        end() { this.ended += 1; this.headersSent = true; return this; },
        json(o) { this.jsonBody = o; this.ended += 1; return this; },
        once() { return this; }, on() { return this; }, removeListener() { return this; },
      });
      const jsonResponse = (url, o, status = 200) => ({
        ok: status >= 200 && status < 300, status, url: String(url),
        headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => o, text: async () => JSON.stringify(o),
      });
      let ipSeq = 0;
      async function drive(question, { env = {}, band = 'adult', age = 35, body = {} } = {}) {
        for (const k of ENV_KEYS) delete process.env[k];
        process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
        process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
        process.env.LEDGER_RAG = 'off';
        process.env.FREE_BRAIN_V1 = 'on';
        Object.assign(process.env, env);
        LEDGER_REDIS.__setRedisForTest(null);
        FLAG.__resetFlagCacheForTest();
        LEGACY.__resetLegacyFlagCacheForTest();
        installDayCapStore();
        const model = [];
        globalThis.fetch = async (url, init) => {
          const u = String(url);
          if (u.includes('api.anthropic.com')) {
            const b = JSON.parse(init.body);
            model.push(b);
            if (b.stream) {
              let done = false;
              const text = MASAH_RULING + ' [[1]].';
              return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
                body: { getReader: () => ({ read: async () => {
                  if (done) return { done: true, value: undefined };
                  done = true;
                  const frames = 'data: ' + JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 9 } } }) + '\n\n'
                    + 'data: ' + JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + '\n\n'
                    + 'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) + '\n\n'
                    + 'data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } }) + '\n\n'
                    + 'data: {"type":"message_stop"}\n\n';
                  return { done: false, value: new TextEncoder().encode(frames) };
                } }), cancel: async () => {} } };
            }
            if (!b.tools) {
              const n = 40;
              return jsonResponse(u, { content: [{ type: 'text', text: JSON.stringify({ d: Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), 1])) }) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
            }
            return jsonResponse(u, { content: [{ type: 'text', text: MASAH_RULING + '.' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
          }
          if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
          return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
        };
        const res = makeRes();
        ipSeq += 1;
        const req = {
          method: 'POST',
          headers: { 'x-murabbi-device': 'speed-bw2-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.17.0.' + ipSeq,
            [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
          body: { messages: [{ role: 'user', content: question }], band, age, ...body },
        };
        const logs = [];
        const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
        console.log = (...a) => { logs.push(a); };
        console.warn = () => {}; console.error = () => {}; console.info = () => {};
        let crashed = null;
        try { await handler(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
        globalThis.fetch = realFetch;
        const frames = res.writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
          .map((f) => { try { return JSON.parse(f.slice(6)); } catch { return null; } }).filter(Boolean);
        const logOf = (tag) => (logs.find((a) => a[0] === tag) || [])[1] || null;
        return { res, frames, deltas: deltasOf(frames), model, logs, logOf, crashed };
      }
      try {
        const bw2 = await drive(Q_MASAH + ' ' + DIGITS);
        const fb = bw2.logOf('[free-brain]');
        const t = bw2.logOf('[bw2]');
        ok('T9a an adult ruling question on the free-brain seat takes BW2 by default (flag unset = on)',
          !bw2.crashed && fb && fb.bw2 === true && t && t.bw2 === true, ascii(JSON.stringify({ fb, crashed: bw2.crashed && String(bw2.crashed.stack) })));
        ok('T9b ...through the real handler: status frames first, and the final text is the concatenation of the deltas',
          bw2.frames.findIndex((f) => f.type === 'ezik_status') < bw2.frames.findIndex((f) => f.type === 'content_block_delta')
          && bw2.deltas.join('').length > 0 && bw2.res.ended === 1
          && !bw2.frames.slice(bw2.frames.findIndex((f) => f.type === 'content_block_delta')).some((f) => f.type === 'ezik_status'),
          ascii(JSON.stringify(bw2.frames.map((f) => f.type + (f.stage ? ':' + f.stage : '')))));
        ok('T10e the handler\'s [bw2] record carries no digit run of the question', t && !JSON.stringify(t).includes(DIGITS)
          && !JSON.stringify(bw2.logs).includes(DIGITS), ascii(JSON.stringify(t)));

        const live = await drive(Q_MASAH, { body: { liveSearch: true } });
        const liveLog = live.logOf('[free-brain]');
        ok('T9c liveSearch: true skips BW2 and takes today\'s free-brain path',
          !live.crashed && liveLog && liveLog.bw2 === false && liveLog.liveSearch === true && !live.logOf('[bw2]')
          && !live.frames.some((f) => f.type === 'ezik_status'), ascii(JSON.stringify(liveLog)));
        ok('T9d ...with its first provider round forced to call search_sources through tool_choice',
          live.model[0] && live.model[0].tool_choice && live.model[0].tool_choice.type === 'tool'
          && live.model[0].tool_choice.name === 'search_sources' && live.model[0].thinking && live.model[0].thinking.type === 'disabled',
          ascii(JSON.stringify(live.model[0] && live.model[0].tool_choice)));
        const notBool = await drive(Q_MASAH, { body: { liveSearch: 'true' } });
        ok('T9e liveSearch that is not the boolean true is ignored (BW2 takes it)', (notBool.logOf('[free-brain]') || {}).bw2 === true);

        const off = await drive(Q_MASAH, { env: { BEFORE_WRITING_V2: 'off' } });
        const offLog = off.logOf('[free-brain]');
        ok('T9f BEFORE_WRITING_V2=off takes today\'s path: no BW2, no status frame, and no forced tool',
          !off.crashed && offLog && offLog.bw2 === false && !off.logOf('[bw2]') && !off.frames.some((f) => f.type === 'ezik_status')
          && off.model.length >= 1 && !off.model[0].tool_choice, ascii(JSON.stringify(offLog)));

        const minor = await drive(Q_MASAH, { band: 'teen', age: 15 });
        const minorLog = minor.logOf('[free-brain]');
        ok('T9g a minor takes today\'s path', !minor.crashed && (!minorLog || minorLog.bw2 === false) && !minor.logOf('[bw2]')
          && !minor.frames.some((f) => f.type === 'ezik_status'), ascii(JSON.stringify(minorLog)));

        const closedQ = '\u0645\u0627 \u0635\u062d\u0629 \u062d\u062f\u064a\u062b \u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a\u061f';
        const closed = await drive(closedQ);
        ok('T9h a closed-deen question (a HADITH-runtime turn the frozen dispatcher answers) stays closed-deen: no BW2, no model call',
          !closed.crashed && closed.logOf('[closed-deen]') && !closed.logOf('[bw2]') && closed.model.length === 0
          && closed.deltas.join('').includes('<hadith'), ascii(JSON.stringify(closed.logOf('[closed-deen]'))));

        const fbOff = await drive(Q_MASAH, { env: { FREE_BRAIN_V1: 'off' } });
        ok('T9i FREE_BRAIN_V1=off: the before-writing switch is never reached (the pre-free-brain path runs)',
          !fbOff.logOf('[bw2]') && !fbOff.frames.some((f) => f.type === 'ezik_status'));

        // SPEED FIX 1, R1/R2: through the real handler, each question is a DEEN turn on the free-brain
        // seat that BW2 leaves alone -- today's tool loop answers it (its first round carries tools).
        const today = async (q) => {
          const r = await drive(q);
          const seat = r.logOf('[free-brain]');
          const route = r.logOf('[route]');
          return !r.crashed && !!seat && seat.bw2 === false && !!route && route.route === 'DEEN' && !r.logOf('[bw2]')
            && !r.logOf('[closed-deen]') && !r.frames.some((f) => f.type === 'ezik_status')
            && r.model.length >= 1 && Array.isArray(r.model[0].tools);
        };
        const r1 = [];
        for (const q of [F.q16, ...F.sibR1]) r1.push(await today(q));
        ok('R1a q16 (the adhkar after the obligatory prayer) takes today\'s path through the real handler', r1[0] === true);
        ok('R1b ...and so do three sibling phrasings', r1.length === 4 && r1.slice(1).every((v) => v === true), JSON.stringify(r1));
        const r2 = [];
        for (const q of [F.q9, ...F.sibR2]) r2.push(await today(q));
        ok('R2a q9 (an estate division) takes today\'s path through the real handler', r2[0] === true);
        ok('R2b ...and so do three sibling phrasings', r2.length === 4 && r2.slice(1).every((v) => v === true), JSON.stringify(r2));
        const stays = await drive(F.q4);
        ok('R2c a ruling question the fix does not name (q4) still takes BW2', (stays.logOf('[free-brain]') || {}).bw2 === true
          && !!stays.logOf('[bw2]'));
      } finally {
        globalThis.fetch = realFetch;
        for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
      }
    }

    // ---------------------------------------------------------------- the switch
    {
      const FLAGS = await esm('lib/free-brain/flag.js');
      const d = (v) => FLAGS.beforeWritingV2Decision(v === undefined ? {} : { BEFORE_WRITING_V2: v }).enabled;
      ok('S1 the switch: default ON; off/false/0 (any case) turn it off; anything else stays on',
        d() === true && d('off') === false && d('FALSE') === false && d('0') === false && d('on') === true && d('typo') === true
        && FLAGS.BEFORE_WRITING_V2_DEFAULT === true);
      const take = (o) => FLAGS.beforeWritingV2Takes({ enabled: true, band: 'adult', runtime: 'STORED_FIQH', liveSearch: false, ...o }).takes;
      ok('S2 the scope: STORED_FIQH and HADITH for adults; not LOCAL_*, not GENERAL, not a minor, not liveSearch',
        take({}) && take({ runtime: 'HADITH' }) && !take({ runtime: 'GENERAL' }) && !take({ runtime: 'LOCAL_QURAN' })
        && !take({ runtime: 'LOCAL_ADHKAR' }) && !take({ runtime: 'LOCAL_WORSHIP' }) && !take({ band: 'teen' })
        && !take({ liveSearch: true }) && !take({ enabled: false }));
      const SCOPE = await esm('lib/bw2-scope.js');
      const ex = SCOPE.bw2ScopeExclusion;
      ok('R1c the exclusion is deterministic: q16 and its siblings -> canonical_store, q9 and its siblings -> estate_division',
        [F.q16, ...F.sibR1].every((q) => ex(q) === 'canonical_store') && [F.q9, ...F.sibR2].every((q) => ex(q) === 'estate_division'),
        JSON.stringify([F.q16, ...F.sibR1, F.q9, ...F.sibR2].map(ex)));
      ok('R2d ...and names nothing else among the fixture\'s ruling and hadith questions',
        [F.q4, F.q11, F.q1, F.q10, Q_MASAH].every((q) => ex(q) === ''), JSON.stringify([F.q4, F.q11, F.q1, F.q10, Q_MASAH].map(ex)));
      ok('R2e the scope turns an exclusion into its reason, and only the two named ones',
        FLAGS.beforeWritingV2Takes({ enabled: true, band: 'adult', runtime: 'STORED_FIQH', excluded: 'canonical_store' }).reason === 'canonical_store'
        && FLAGS.beforeWritingV2Takes({ enabled: true, band: 'adult', runtime: 'HADITH', excluded: 'estate_division' }).reason === 'estate_division'
        && take({ excluded: 'typo' }) && take({ excluded: '' }));
    }
  } catch (error) {
    ok('guard completed without exception', false, error && error.stack ? error.stack : String(error));
  }
  process.exit(finish());
})();
