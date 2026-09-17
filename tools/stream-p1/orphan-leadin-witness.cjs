#!/usr/bin/env node
/**
 * ORPHAN LEAD-IN WITNESS — deterministic, offline, no model call, no key.
 *
 * The owner saw, on «هل تجب الزكاة في مال الصبي الصغير؟» in the detailed depth, a line ending in a
 * colon that promises a prophetic text («ويعضد ذلك ما جاء عنه صلى الله عليه وسلم:»), then NO text,
 * then the book cards — and the «فهمٌ لا فتوى» footer gone. This drives that shape through the
 * shipped delivery path and reports what reaches the socket.
 *
 * NOTHING HERE IS A COPY OF THE DELIVERY PATH:
 *   · the turn is the real `runFreeBrainTurn` (lib/free-brain/loop.js) with STREAM_V1 on, fed by a
 *     provider stub that writes the answer as SSE deltas;
 *   · `liveFreeBrainUnits` and `emitFreeBrain` are SLICED OUT OF api/ask.js and compiled with only
 *     the four route-local values they close over (the technique of tools/stream-p6/integration-proof.cjs);
 *   · `seal` is api/ask.js's: the real `lockTakhrij` over the pages the route hands it, which on
 *     the free-brain path is the CITED rows (api/ask.js storedFinalizerSources) — and, where the
 *     tree returns them, the rows the unit stream read (`out.streamTakhrijRows`), exactly as
 *     api/ask.js adds them;
 *   · the socket sits behind the real `createFinalizedSseResponse`, with a book card registered as
 *     a server-owned reader card the way api/ask.js registers `bookCards`.
 *
 * CASES:
 *   unsupported   the card's takhrij («متفق عليه», the live call-03 shape) is on none of the cited
 *                 pages — the seal drops the card and, by `orphanedLeadInCuts`, its colon lead-in.
 *   supported     the same answer with a cited page that names both Sahihs — the seal keeps both.
 *   cited-row     a real `search_sources` round fills the evidence table from the stored
 *                 encyclopedia; the answer then quotes a card whose takhrij IS on one of those rows
 *                 and cites that row by marker right after the card. Measures whether the card
 *                 streams while the provider is still writing, and whether the seal keeps it.
 *
 * Prints ASCII only. It measures; the exit code is 0 unless the harness itself fails.
 *   node tools/stream-p1/orphan-leadin-witness.cjs [--root=<tree>] [--json=path]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ARG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/u.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? 'true' : m[2];
}
const ROOT = ARG.root ? path.resolve(ARG.root) : path.join(__dirname, '..', '..');
const PROVIDER = 'https://provider.witness/messages';

const LEAD_IN = 'ويعضد ذلك ما جاء عنه صلى الله عليه وسلم:';
const MATN = 'ما من صاحب ذهب ولا فضة لا يؤدي منها حقها إلا إذا كان يوم القيامة صفحت له صفائح من نار';
const HEAD = [
  'نعم، تجب الزكاة في مال الصبي الصغير عند جمهور أهل العلم إذا بلغ ماله نصابا وحال عليه الحول.',
  'ويخرجها عنه وليه من ماله، لأن الزكاة حق متعلق بالمال لا بذمة المكلف وحدها.',
  LEAD_IN,
];
const TAIL = [
  'ووجه الدلالة أن الوعيد متعلق بالمال نفسه، والصبي مالك للمال فيدخل في عموم الخبر.',
  'وخالف في ذلك الحنفية فقالوا لا تجب إلا في الزروع والثمار.',
  'والعمل على قول الجمهور، ويخرجها الولي في وقتها إبراء لذمة الصبي.',
];
const TAIL_MARK = 'وخالف في ذلك الحنفية';
const answerWith = (card) => [...HEAD, card, ...TAIL].join('\n') + '\n';
const PAGES = {
  unsupported: [{ url: 'https://book.witness/mughni', title: 'المغني لابن قدامة', passage: 'فأما الحر المسلم إذا ملك نصابا خاليا عن دين فعليه الزكاة عند تمام حوله سواء كان كبيرا أو صغيرا' }],
  supported: [{ url: 'https://book.witness/mughni', title: 'المغني لابن قدامة', passage: 'فأما الحر المسلم إذا ملك نصابا فعليه الزكاة سواء كان كبيرا أو صغيرا، والحديث في صحيح البخاري وصحيح مسلم' }],
};
const BOOK_TAG = '<book author="المقدسي، موفق الدين" ref="ج2 · ص464">المغني لابن قدامة</book>';
const ENC_QUERY = 'الوتر';

function sliceFunction(source, name) {
  const at = [`export function ${name}(`, `const ${name} = `].map((n) => source.indexOf(n)).find((i) => i >= 0);
  if (at === undefined) throw new Error(`${name} not found`);
  let depth = 0; let opened = false;
  for (let i = at; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; } else if (source[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error(`${name} unbalanced`);
}

function compileDelivery(askSource) {
  const emitOnce = sliceFunction(askSource, 'emitOnce');
  const emitUnits = sliceFunction(askSource, 'emitUnits');
  const liveAt = askSource.indexOf('const liveFreeBrainUnits = (() => {');
  const emitAt = askSource.indexOf('const emitFreeBrain = ', liveAt);
  if (liveAt < 0 || emitAt < 0) throw new Error('live delivery statements not found');
  const emitEnd = askSource.indexOf(';', emitAt);
  // eslint-disable-next-line no-new-func
  return new Function('scope', `
    const { res, finalizerContext, clearKeepAlive, seal } = scope;
    ${emitOnce};
    ${emitUnits};
    ${askSource.slice(liveAt, emitAt).trim()}
    ${askSource.slice(emitAt, emitEnd + 1)}
    return { liveFreeBrainUnits, emitFreeBrain };
  `);
}

function socket() {
  return {
    writes: [], headersSent: true,
    setHeader() {}, status() { return this; }, flushHeaders() {},
    write(chunk, enc, cb) { this.writes.push(String(chunk)); if (typeof enc === 'function') enc(); else if (typeof cb === 'function') cb(); return true; },
    end(...args) { this.ended = true; const cb = args.find((a) => typeof a === 'function'); cb?.(); return this; },
    on() {}, once() {}, removeListener() {},
    get text() {
      return this.writes.join('').split(/\r?\n/u).flatMap((line) => {
        if (!line.startsWith('data:')) return [];
        try { return [JSON.parse(line.slice(5).trim())]; } catch { return []; }
      }).filter((e) => e?.type === 'content_block_delta' && e.delta?.type === 'text_delta')
        .map((e) => String(e.delta.text || '')).join('');
    },
  };
}

function sse(text, { chunk = 5, tool = null } = {}) {
  const events = [
    { type: 'message_start', message: { id: 'w', type: 'message', role: 'assistant', content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  ];
  for (let i = 0; i < text.length; i += chunk) events.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(i, i + chunk) } });
  events.push({ type: 'content_block_stop', index: 0 });
  if (tool) {
    events.push(
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'witness-tool-1', name: tool.name, input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify(tool.input) } },
      { type: 'content_block_stop', index: 1 },
    );
  }
  events.push({ type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 9 } }, { type: 'message_stop' });
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

/** The encyclopedia row a card can quote truthfully: its ref, and a takhrij phrase on its text. */
async function citableRow(lock) {
  const enc = await import(pathToFileURL(path.join(ROOT, 'lib', 'encyclopedia.js')).href);
  const r = await enc.searchStoredCorpus(ENC_QUERY, { limit: 3 });
  const records = r.records || [];
  for (let j = 0; j < records.length; j += 1) {
    const snippet = String(records[j].snippet || '');
    const span = lock.takhrijSpans(snippet).find((s) => s.end < 1000);
    if (span) return { ref: j + 1, phrase: snippet.slice(span.start, span.end) };
  }
  return null;
}

async function runCase(name, mods) {
  const { loop, lock, writer, compile } = mods;
  let answer;
  let plan;
  let citable = null;
  if (name === 'cited-row') {
    citable = await citableRow(lock);
    if (!citable) throw new Error('no citable encyclopedia row for the witness query');
    const card = `<hadith ruling="${citable.phrase}">${MATN}</hadith> [[${citable.ref}]]`;
    answer = answerWith(card);
    plan = [
      { text: '', tool: { name: 'search_sources', input: { query: ENC_QUERY } } },
      { text: answer },
    ];
  } else {
    answer = answerWith(`<hadith narrator="متفق عليه">${MATN}</hadith>`);
    plan = [{ text: answer }];
  }
  const sock = socket();
  const rejects = [];
  const bookCard = { tag: BOOK_TAG };
  const finalizerContext = {
    fallbackText: 'رفض آمن', sourceCards: [bookCard], readerPrefix: '', readerSuffix: '',
    readerCards: [bookCard], readerCardPrefix: '\n\n', allowWireOwnedCards: true,
  };
  const res = writer.createFinalizedSseResponse(sock, {
    finalize: ({ text }) => ({ ok: true, text }),
    context: () => finalizerContext,
    failureText: finalizerContext.fallbackText,
    onReject: (d) => rejects.push(`${d.stage}:${d.reason}`),
  });
  let sealPages = PAGES[name] || [];
  const warns = [];
  const seal = (text) => lock.lockTakhrij(String(text == null ? '' : text), sealPages).text;
  const { liveFreeBrainUnits, emitFreeBrain } = compile({ res, finalizerContext, clearKeepAlive: () => {}, seal });
  let sentAtEndOfLoop = '';
  // What the reader held when the provider was still writing: the last text accepted before the
  // final provider chunk was read.
  let sentWhileWriting = '';
  let providerDone = false;
  const saved = { fetch: global.fetch, log: console.log, warn: console.warn, error: console.error };
  global.fetch = async (input) => {
    if (String(input) !== PROVIDER) return new Response('offline', { status: 503 });
    const step = plan.shift();
    if (!step) throw new Error('witness plan exhausted');
    const body = sse(step.text, { tool: step.tool || null });
    if (step.tool) return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    // The writing round: note what had been accepted before its last byte was handed over.
    const bytes = new TextEncoder().encode(body);
    const cut = bytes.length - 40;
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < cut; i += 64) controller.enqueue(bytes.slice(i, Math.min(i + 64, cut)));
      },
      pull(controller) {
        sentWhileWriting = liveFreeBrainUnits.sent;
        providerDone = true;
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  console.log = () => {}; console.error = () => {};
  console.warn = (...a) => warns.push(a.map((x) => (typeof x === 'string' ? x : '')).join(' ').replace(/[^\x20-\x7e]/gu, '?'));
  let out;
  try {
    out = await loop.runFreeBrainTurn({
      messages: [{ role: 'user', content: 'هل تجب الزكاة في مال الصبي الصغير؟' }],
      system: 'شاهد', model: 'witness', maxTokens: 1024, usePremium: false, effort: '',
      band: 'adult', mode: 'standard', lexicalRoute: 'GEN',
      providerUrl: PROVIDER, headers: {}, signal: undefined, dailyBudget: null,
      env: { STREAM_V1: 'on' },
      onWriteUnit: (detail) => liveFreeBrainUnits.push(detail),
    });
    sentAtEndOfLoop = liveFreeBrainUnits.sent;
    if (name === 'cited-row') {
      // api/ask.js: the cited rows, then every row the unit stream read that is not among them.
      const extra = (Array.isArray(out.streamTakhrijRows) ? out.streamTakhrijRows : []).filter((row) => !out.cited.includes(row));
      sealPages = [...out.cited, ...extra].map((row) => ({ url: row.url, title: row.title, passage: row.passage || row.text || '' }));
    }
    emitFreeBrain(out.text, out.readerUnits);
  } finally {
    global.fetch = saved.fetch; console.log = saved.log; console.warn = saved.warn; console.error = saved.error;
  }
  const wire = sock.text;
  const sealed = seal(out.text);
  const leadInOnWire = wire.includes(LEAD_IN);
  const wireHasCard = wire.includes('<hadith');
  const afterLeadIn = leadInOnWire ? wire.slice(wire.indexOf(LEAD_IN) + LEAD_IN.length).replace(/^\s+/u, '') : '';
  const row = {
    case: name,
    streamedChars: sentAtEndOfLoop.length,
    streamedWhileWriting: providerDone ? sentWhileWriting.length : null,
    cardStreamedWhileWriting: providerDone ? sentWhileWriting.includes('<hadith') : null,
    streamedHeadEndsInLeadIn: sentAtEndOfLoop.trimEnd().endsWith(LEAD_IN),
    loopTextChars: out.text.length,
    sealPages: sealPages.length,
    sealKeepsSentPrefix: sealed.startsWith(sentAtEndOfLoop),
    sealKeepsCard: sealed.includes('<hadith'),
    wireChars: wire.length,
    wireHasLeadIn: leadInOnWire,
    wireHasCard,
    wireNextAfterLeadInIsBookCard: afterLeadIn.startsWith('<book'),
    orphanLeadIn: leadInOnWire && !wireHasCard,
    tailProseLost: out.text.includes(TAIL_MARK) && !wire.includes(TAIL_MARK),
    finishWarn: warns.some((w) => /did not retain the emitted prefix/u.test(w)),
    writerRejects: rejects.filter((r) => /^[\x20-\x7e]*$/u.test(r)),
    degraded: (out.degraded || []).filter((d) => /^[\x20-\x7e]*$/u.test(d)),
    wireText: wire,
  };
  console.log(`case=${name} streamed=${row.streamedChars} streamed_while_writing=${row.streamedWhileWriting} card_streamed_while_writing=${row.cardStreamedWhileWriting} head_ends_in_lead_in=${row.streamedHeadEndsInLeadIn} seal_pages=${row.sealPages} seal_keeps_prefix=${row.sealKeepsSentPrefix} seal_keeps_card=${row.sealKeepsCard} wire_has_lead_in=${leadInOnWire} wire_has_card=${wireHasCard} next_after_lead_in_is_book=${row.wireNextAfterLeadInIsBookCard} ORPHAN_LEAD_IN=${row.orphanLeadIn} TAIL_PROSE_LOST=${row.tailProseLost} finish_warn=${row.finishWarn} wire_chars=${wire.length}/${out.text.length}`);
  if (row.degraded.length) console.log(`  degraded=${row.degraded.join(' | ')}`);
  if (row.writerRejects.length) console.log(`  writer_rejects=${row.writerRejects.join(' | ')}`);
  return row;
}

async function main() {
  const loop = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'loop.js')).href);
  const lock = await import(pathToFileURL(path.join(ROOT, 'lib', 'takhrij-lock.js')).href);
  const writer = await import(pathToFileURL(path.join(ROOT, 'lib', 'finalized-sse-writer.js')).href);
  const compile = compileDelivery(fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8'));
  const rows = [];
  for (const name of ['unsupported', 'supported', 'cited-row']) rows.push(await runCase(name, { loop, lock, writer, compile }));
  if (ARG.json) fs.writeFileSync(ARG.json, JSON.stringify(rows, null, 2));
}

main().catch((e) => { console.log('orphan-leadin-witness failed: ' + String(e && e.stack).replace(/[^\x20-\x7e\n]/gu, '?')); process.exit(1); });
