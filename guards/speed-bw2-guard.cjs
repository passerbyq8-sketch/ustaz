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
    judge = 'all', writerText = '', seed = 1, takhrij = false, writerThrows = false } = {}) {
    const calls = { writer: 0, ask: 0, askUser: '', writerBody: null, writerAt: null, tools: [] };
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
      searchStoredCorpus: () => (hang.encyclopedia ? new Promise(() => {}) : Promise.resolve({ records: encyclopedia })),
      warmEncyclopedia: () => Promise.resolve(true),
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
      applyTakhrij: takhrij ? async (text) => {
        if (!text.includes(FASTING_MATN)) return { text, entries: [] };
        const at = text.indexOf('\u00bb', text.indexOf(FASTING_MATN)) + 1;
        return {
          text: text.slice(0, at) + TAKHRIJ_PAREN + text.slice(at),
          entries: [{ matn: FASTING_MATN, sourced: true, sealProof: ['\u0635\u062d\u064a\u062d \u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0635\u062d\u064a\u062d \u0645\u0633\u0644\u0645'], proseProof: ['\u0627\u0644\u0628\u062e\u0627\u0631\u064a', '\u0645\u0633\u0644\u0645'] }],
        };
      } : undefined,
      runnerLookup: () => async () => [],
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
      takhrijWired: !!opts.takhrij, cards, wire, requestStartedAt: Date.now(),
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
        && bm.deltas.join('').includes(MASAH_TERM), ascii(bm.deltas.join('|')));
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
      const many = Array.from({ length: 5 }, (_, i) => ({ ...ROW_F1, url: 'https://binbaz.org.sa/fatwas/9' + i, recordId: '9' + i }));
      const m = await run({ fatwa: many, writerText: MASAH_RULING + ' [[1, 2, 3, 4, 5]].' });
      ok('T5e within today\'s MAX_SOURCES rule: at most 3 page cards', m.deltas.filter((d) => d.includes('<source')).length === 3 && cap >= 5,
        String(m.deltas.filter((d) => d.includes('<source')).length));
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
      ok('T8h parseDecisions keeps none of the missing', JSON.stringify(BW2.parseDecisions('{"d":{"1":1,"2":0}}', 3)) === '{"keep":[1],"missing":[3]}');
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
      // R3f: already released cited text, then the writer's sentence: appended once, and never twice.
      const mid = await run({ writerText: U.s1 + ' ' + variant + ' ' + U.s3 });
      const mt = mid.deltas.join('');
      ok('R3f a cited unit, then the writer\'s sentence: the unit stays, the sentence goes out once, the rest does not',
        mt.startsWith(MASAH_RULING) && mt.endsWith(NOT_COVERED) && count(mt, NOT_COVERED) === 1 && !mt.includes(MASAH_TERM)
        && hasOffer(mid), ascii(mt));
      const tat = NOT_COVERED.replace(' ', String.fromCharCode(0x0640) + '  ').replace(/\.$/u, ' !');
      ok('R3g the comparison fold ignores diacritics, tatweel, spaces and punctuation, and nothing else',
        UNITS.carriesNotCovered(tat, NOT_COVERED) && UNITS.carriesNotCovered(variant, NOT_COVERED)
        && !UNITS.carriesNotCovered(MASAH_RULING, NOT_COVERED) && UNITS.foldNotCovered(tat) === UNITS.foldNotCovered(NOT_COVERED));
      ok('R3h the writer is told to write the marker, and is no longer given the sentence to write',
        BW2.BW2_WRITE_RULES.includes(MARKER) && !BW2.BW2_WRITE_RULES.includes(NOT_COVERED) && ![...MARKER].some((c) => c.charCodeAt(0) > 0x7e));
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
      const q11 = await run({ question: F.q11, writerText: F.authHeld11 + ' ' + F.a11[0] + ' ' + U.s1 });
      const t11 = q11.deltas.join('');
      const quote = F.a11[0].slice(F.a11[0].indexOf(String.fromCharCode(0x00ab)), F.a11[0].indexOf(String.fromCharCode(0x00ab)) + 12);
      ok('R5a q11: the quote that leans on a held unit is held with it; the answer does not begin with it',
        !t11.includes(quote) && t11.startsWith(MASAH_RULING) && q11.out.telemetry.unitsHeld === 2, ascii(t11));
      const open = await run({ question: F.q11, writerText: F.a11[0] + ' ' + U.s1 });
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

    // ---------------------------------------------------------------- T10 (unit level)
    const DIGITS = '7391';
    {
      const q = Q_MASAH + ' ' + DIGITS + ' \u0645\u0631\u0629';
      const r = await run({ question: q, writerText: [U.s1, U.bad, U.book].join(' '), libOn: true, library: [ROW_L1] });
      const t = r.out.telemetry;
      const ENUMS = { judgeOutcome: ['none', 'complete', 'incomplete', 'failed'], writerOutcome: ['none', 'ok', 'failed'] };
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
        'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK'];
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
