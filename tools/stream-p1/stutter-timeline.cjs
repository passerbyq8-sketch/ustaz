#!/usr/bin/env node
/**
 * STREAM STUTTER TIMELINE — deterministic, offline, no model call, no key.
 *
 * The owner's report (١٧ سبتمبر ٢٠٢٦): the answer prints about two lines, goes quiet for a
 * noticeable while, then the rest of the answer lands at once. This tool reproduces the SERVER
 * side of that on the shipped code, with a synthetic provider stream at a fixed character rate,
 * and prints the emission timeline so the gap can be measured and placed rather than described.
 *
 * WHAT IT DRIVES (nothing here is a copy of the delivery path):
 *   --seam=turn   the real `runFreeBrainTurn` (lib/free-brain/loop.js) with STREAM_V1 on, fed by
 *                 a stub provider whose SSE deltas arrive at --rate chars/s. Every unit the loop
 *                 offers through `onWriteUnit` is pushed through the real finalized SSE writer
 *                 (lib/finalized-sse-writer.js) exactly as api/ask.js `liveFreeBrainUnits` does,
 *                 over a fake socket that timestamps every write. The timeline is the socket's.
 *   --seam=units  the loop's `createTerminalUnitStream` alone, fed at the same rate, so one stage
 *                 (reviewer units + the item-36 candidate hold) can be measured in isolation and
 *                 under a chosen --domain (general | fiqh).
 *
 * WHAT IT PRINTS (ASCII only — Arabic never reaches the terminal): one row per wire delta with
 * its time (ms since the first provider character), size, cumulative size and lag behind the
 * arrival of the last character it carries; then first-delta time, delta count, the largest gap
 * in ms and where it sits, and the loop's own degraded notes. `--json=path` also writes it all.
 *
 * Usage:
 *   node tools/stream-p1/stutter-timeline.cjs [--rate=85] [--chunk=3] [--seam=turn|units]
 *        [--text=all|clean|witness|longmatn|scholar] [--hold=on|off] [--domain=general|fiqh]
 *        [--json=path]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const PROVIDER = 'https://stub.invalid/v1/messages';

const ARG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/u.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? 'true' : m[2];
}
const RATE = Number(ARG.rate || 85);
const CHUNK = Math.max(1, Number(ARG.chunk || 3));
const SEAM = ARG.seam === 'units' ? 'units' : 'turn';
const HOLD = ARG.hold === 'off' ? 'off' : 'on';
const DOMAIN = ARG.domain === 'fiqh' ? 'fiqh' : 'general';
const WANT = ARG.text || 'all';

const clock = () => Number(process.hrtime.bigint()) / 1e6;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── THE TEXTS. Shapes taken from guards/prophet-ascription-wiring-guard.cjs (the d4 witness) and
// widened to answer-length, so a held sentence has text after it to be late against. ─────────────
const WITNESS_PROSE = 'وكان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const DAWUD_MATN = 'أحب الصلاة إلى الله صلاة داود عليه السلام، كان ينام نصف الليل، ويقوم ثلثه، وينام سدسه';
const BLOCK = '<hadith narrator="عبد الله بن عمرو رضي الله عنهما" ruling="متفق عليه">' + DAWUD_MATN + '</hadith>';
const SEVEN_MATN = 'سبعة يظلهم الله في ظله يوم لا ظل إلا ظله: الإمام العادل، وشاب نشأ في عبادة ربه، ورجل قلبه معلق في المساجد، ورجلان تحابا في الله اجتمعا عليه وتفرقا عليه، ورجل طلبته امرأة ذات منصب وجمال فقال إني أخاف الله، ورجل تصدق أخفى حتى لا تعلم شماله ما تنفق يمينه، ورجل ذكر الله خاليا ففاضت عيناه';
const LONG_BLOCK = '<hadith narrator="أبو هريرة رضي الله عنه" ruling="متفق عليه">' + SEVEN_MATN + '</hadith>';

const TEXTS = {
  // No prophet frame, no attribution, no card: every sentence should leave as soon as it settles.
  clean: [
    'الوتر سنة مؤكدة عند جمهور أهل العلم، وقد واظب عليها السلف في الحضر والسفر.',
    'ووقته من بعد صلاة العشاء إلى طلوع الفجر الثاني، فمن أوتر في أول الليل أو آخره فقد أصاب السنة.',
    'وأقله ركعة واحدة، وأدنى الكمال ثلاث ركعات، ويجوز الزيادة إلى إحدى عشرة أو ثلاث عشرة.',
    'ومن خشي ألا يقوم آخر الليل فليوتر أوله، ومن طمع أن يقوم آخره فليوتر آخره فإن صلاة آخر الليل مشهودة.',
    'ويستحب أن يقرأ في الركعات الثلاث بسبح والكافرون والإخلاص، وأن يقنت بعد الركوع أو قبله.',
    'ومن نام عن وتره أو نسيه فليصله إذا ذكره أو استيقظ، ولا حرج عليه في ذلك.',
    'وإذا فاتته بعد طلوع الفجر قضاها في النهار شفعا، فيصلي بدل الثلاث أربعا.',
    'والله أعلم.',
  ].join('\n'),
  // The d4 witness shape: frame sentence, the candidate, a colon line, the matn, then prose.
  witness: [
    'هدي النبي صلى الله عليه وسلم في ليله هدي معتدل، لا إفراط فيه ولا تفريط.',
    WITNESS_PROSE + '.',
    'وكان يقول:',
    BLOCK,
    'وفي هذا تعليم للأمة أن تأخذ من ليلها بنصيب، فلا تحيي الليل كله ولا تنام عنه كله.',
    'ومن أراد الاقتداء به فليجعل لنفسه وردا من الليل يحافظ عليه ولو قل.',
    'وكان يقرأ في قيامه بترتيل وتدبر، ويطيل الركوع والسجود.',
    'والله أعلم.',
  ].join('\n'),
  // A candidate followed by a LONG tagged matn: the hold has to wait for the close or the ceiling.
  longmatn: [
    'من هدي النبي صلى الله عليه وسلم في يومه أنه كان يفتتح نهاره بذكر الله ويختمه به.',
    'وكان يوصي أصحابه بالمحافظة على الصلوات والأذكار وحسن الخلق في كل أحوالهم.',
    'وقال صلى الله عليه وسلم:',
    LONG_BLOCK,
    'وفي هذا الحديث بيان لجملة من أصول الخير التي تجمع بين حق الله وحق العباد.',
    'فينبغي للمسلم أن يجعل هذه الوصايا منهجا في يومه وليلته.',
    'والله أعلم.',
  ].join('\n'),
  // A scholar attribution with no evidence row behind it: the reviewer's own settledness hold.
  scholar: [
    'الوتر سنة مؤكدة عند جمهور أهل العلم.',
    'وقال الشيخ ابن باز رحمه الله: الوتر سنة مؤكدة لا ينبغي للمسلم تركها، وأقله ركعة.',
    'ووقته من بعد صلاة العشاء إلى طلوع الفجر.',
    'ومن خشي ألا يقوم آخر الليل فليوتر أوله.',
    'ومن نام عنه أو نسيه فليصله إذا ذكره.',
    'ويستحب القنوت فيه بعد الركوع.',
    'والله أعلم.',
  ].join('\n'),
};
const QUESTION = 'ما هدي النبي صلى الله عليه وسلم في يومه وليلته؟';

// ── A socket that timestamps every write. ──────────────────────────────────────────────────────
function fakeSocket() {
  const writes = [];
  return {
    writes,
    headersSent: false,
    setHeader() {},
    status() { return this; },
    flushHeaders() {},
    write(chunk, encoding, callback) {
      writes.push({ t: clock(), raw: String(chunk) });
      if (typeof encoding === 'function') encoding(); else if (typeof callback === 'function') callback();
      return true;
    },
    end(chunk, encoding, callback) {
      if (typeof chunk === 'function') callback = chunk;
      else if (typeof encoding === 'function') callback = encoding;
      if (chunk != null && typeof chunk !== 'function' && chunk !== '') this.write(chunk);
      this.endedAt = clock();
      if (typeof callback === 'function') callback();
      return this;
    },
    on() {}, once() {}, removeListener() {},
  };
}

// ── The live-unit emitter, in the shape api/ask.js:1179 `liveFreeBrainUnits` has (seal = identity,
// no reader prefix). It is what stands between the loop's `onWriteUnit` and the writer. ─────────
function liveUnitsAdapter(res) {
  let opened = false;
  let sent = '';
  let approved = '';
  const frame = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const push = ({ piece, text }) => {
    if (typeof res.armEarlyRelease !== 'function') return false;
    if (text !== sent + piece) return false;
    if (!opened) {
      const armed = res.armEarlyRelease(() => approved);
      if (!armed) return false;
      if (!frame({ type: 'message_start', message: { id: 'server-finalized', type: 'message', role: 'assistant', content: [] } })) return false;
      if (!frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })) return false;
      opened = true;
    }
    approved = text;
    if (!frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })) return false;
    sent = text;
    return true;
  };
  const finish = (text) => {
    if (!opened) {
      // api/ask.js would take `emitUnits`/`emitOnce` here: the whole answer, at the end.
      frame({ type: 'message_start', message: { id: 'server-finalized', type: 'message', role: 'assistant', content: [] } });
      frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
      frame({ type: 'content_block_stop', index: 0 });
      frame({ type: 'message_stop' });
      return res.end();
    }
    if (text.startsWith(sent)) {
      const remainder = text.slice(sent.length);
      if (remainder) frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: remainder } });
    }
    frame({ type: 'content_block_stop', index: 0 });
    frame({ type: 'message_stop' });
    return res.end();
  };
  return { push, finish, get opened() { return opened; }, get sent() { return sent; } };
}

// ── The provider stub: SSE deltas of CHUNK chars, the i-th readable at start + chars_i / RATE. ──
function stubFetch(answer, onStart) {
  return async (input, init) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (body.stream !== true) {
      return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: answer }] }) };
    }
    const frames = [
      { type: 'message_start', message: { content: [] } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ];
    for (let i = 0; i < answer.length; i += CHUNK) {
      frames.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer.slice(i, i + CHUNK) } });
    }
    frames.push({ type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' });
    let at = 0;
    let cum = 0;
    let start = null;
    const reader = {
      read: async () => {
        if (at >= frames.length) return { done: true };
        const f = frames[at++];
        if (f.type === 'content_block_delta') {
          if (start === null) { start = clock(); onStart(start); }
          cum += f.delta.text.length;
          const due = start + (cum / RATE) * 1000;
          const wait = due - clock();
          if (wait > 0) await sleep(wait);
        }
        return { done: false, value: new TextEncoder().encode('data: ' + JSON.stringify(f) + '\n\n') };
      },
    };
    return { ok: true, status: 200, body: { getReader: () => reader }, text: async () => '' };
  };
}

function deltasOf(writes) {
  const out = [];
  for (const w of writes) {
    for (const line of w.raw.split('\n')) {
      if (!line.startsWith('data:')) continue;
      let evt;
      try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (evt && evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
        out.push({ t: w.t, text: String(evt.delta.text || '') });
      }
    }
  }
  return out;
}

/** When the last character of `piece` arrived, by its position in the raw answer. */
function arrivalOf(answer, piece, cursor) {
  const needle = piece.replace(/^\n/u, '');
  const at = needle ? answer.indexOf(needle, cursor.at) : -1;
  if (at < 0) return { known: false, end: cursor.at };
  cursor.at = at + needle.length;
  return { known: true, end: cursor.at };
}

function report(label, answer, start, deltas, endedAt, notes, extra) {
  const rows = [];
  const cursor = { at: 0 };
  let cum = 0;
  let prevT = start;
  let largest = { ms: 0, from: 0, to: 1, atCum: 0 };
  deltas.forEach((d, i) => {
    cum += d.text.length;
    const arrived = arrivalOf(answer, d.text, cursor);
    const arrivedAt = start + (arrived.end / RATE) * 1000;
    const gap = d.t - prevT;
    if (gap > largest.ms) largest = { ms: gap, from: i, to: i + 1, atCum: cum - d.text.length };
    rows.push({
      n: i + 1, t: d.t - start, chars: d.text.length, cum,
      lag: arrived.known ? d.t - arrivedAt : null,
    });
    prevT = d.t;
  });
  const total = answer.length;
  const providerDone = start + (total / RATE) * 1000;
  const lines = [];
  lines.push(`== text=${label} seam=${SEAM} hold=${HOLD} domain=${DOMAIN} rate=${RATE}c/s chunk=${CHUNK} answer_chars=${total}${extra ? ' ' + extra : ''}`);
  lines.push('   #    t_ms  +chars    cum   lag_ms');
  for (const r of rows) {
    lines.push(`  ${String(r.n).padStart(2)}  ${r.t.toFixed(0).padStart(6)}  ${String(r.chars).padStart(6)}  ${String(r.cum).padStart(5)}  ${r.lag === null ? '     ?' : r.lag.toFixed(0).padStart(6)}`);
  }
  const last = rows.length ? rows[rows.length - 1] : null;
  const first = rows.length ? rows[0] : null;
  const earlyChars = rows.length > 1 ? rows[rows.length - 2].cum : 0;
  lines.push(`  provider_done_ms=${(providerDone - start).toFixed(0)}  ended_ms=${(endedAt - start).toFixed(0)}`);
  lines.push(`  first_delta_ms=${first ? first.t.toFixed(0) : 'none'}  deltas=${rows.length}  chars_before_last_delta=${earlyChars}/${last ? last.cum : 0}`);
  lines.push(`  LARGEST_GAP_ms=${largest.ms.toFixed(0)}  between_delta#${largest.from}_and_#${largest.to}  after_cum_chars=${largest.atCum}`);
  if (notes.length) lines.push(`  notes=${notes.filter((n) => /^[\x20-\x7e]*$/u.test(n)).join(' | ') || '(non-ascii notes omitted)'}`);
  return { lines, json: { label, seam: SEAM, hold: HOLD, domain: DOMAIN, rate: RATE, chunk: CHUNK, answerChars: total, rows, firstDeltaMs: first ? first.t : null, deltas: rows.length, largestGapMs: largest.ms, largestGapAfterCum: largest.atCum, providerDoneMs: providerDone - start, endedMs: endedAt - start, notes } };
}

async function runTurn(loop, writer, label, answer) {
  const socket = fakeSocket();
  const rejects = [];
  // `finalize` is the seal's slot; api/ask.js hands it finalizeReaderText. Here it is the identity,
  // so the flush is valid and the remainder written at finish() shows on the timeline.
  const res = writer.createFinalizedSseResponse(socket, {
    finalize: (input) => ({ ok: true, text: String(input.text || '') }),
    onReject: (r) => rejects.push(r),
  });
  const adapter = liveUnitsAdapter(res);
  let start = null;
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  const realWarn = console.warn;
  const realErr = console.error;
  const hadEnv = process.env.PROPHET_ASCRIPTION_BLOCK;
  if (HOLD === 'off') process.env.PROPHET_ASCRIPTION_BLOCK = 'off';
  globalThis.fetch = stubFetch(answer, (t) => { start = t; });
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  let out;
  try {
    out = await loop.runFreeBrainTurn({
      messages: [{ role: 'user', content: QUESTION }],
      system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
      mode: 'عادي', lexicalRoute: DOMAIN === 'fiqh' ? 'DEEN' : 'GENERAL', providerUrl: PROVIDER, headers: {},
      env: { STREAM_V1: 'on' },
      onWriteUnit: (d) => adapter.push(d),
    });
    adapter.finish(String(out.text || ''));
  } finally {
    globalThis.fetch = realFetch;
    console.log = realLog; console.warn = realWarn; console.error = realErr;
    if (hadEnv === undefined) delete process.env.PROPHET_ASCRIPTION_BLOCK; else process.env.PROPHET_ASCRIPTION_BLOCK = hadEnv;
  }
  const notes = Array.isArray(out.degraded) ? out.degraded.slice() : [];
  if (rejects.length) notes.push(...rejects.map((r) => `writer_reject:${r.stage}:${r.reason}`));
  if (start === null) { start = clock(); notes.push('probe:no_provider_delta_was_read'); }
  return report(label, answer, start, deltasOf(socket.writes), socket.endedAt || clock(), notes,
    `streamed=${out.streamedThisTurn === true} opened=${adapter.opened}`);
}

async function runUnits(loop, reviewer, label, answer) {
  const notes = [];
  const deltas = [];
  const stream = loop.createTerminalUnitStream({
    domain: DOMAIN, mode: 'عادي', degraded: notes,
    ascription: HOLD === 'on' ? { frame: reviewer.prophetFrame, namesTheProphet: reviewer.frameNamesProphet } : null,
    onUnit: (d) => { deltas.push({ t: clock(), text: d.piece }); return true; },
  });
  const start = clock();
  let cum = 0;
  for (let i = 0; i < answer.length; i += CHUNK) {
    const piece = answer.slice(i, i + CHUNK);
    cum += piece.length;
    const due = start + (cum / RATE) * 1000;
    const wait = due - clock();
    if (wait > 0) await sleep(wait);
    stream.push(piece);
  }
  const result = stream.end();
  const endedAt = clock();
  const remainder = String(result.finalText || '').startsWith(result.acceptedPrefix)
    ? String(result.finalText).slice(result.acceptedPrefix.length) : String(result.finalText || '');
  if (remainder) deltas.push({ t: endedAt, text: remainder });
  return report(label, answer, start, deltas, endedAt, notes, `violations=${(result.violations || []).length}`);
}

async function main() {
  const loop = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'loop.js')).href);
  const writer = await import(pathToFileURL(path.join(ROOT, 'lib', 'finalized-sse-writer.js')).href);
  const reviewer = await import(pathToFileURL(path.join(ROOT, 'lib', 'output-reviewer.js')).href);
  const names = WANT === 'all' ? Object.keys(TEXTS) : WANT.split(',');
  const all = [];
  for (const name of names) {
    if (!TEXTS[name]) { console.log(`unknown text: ${name}`); process.exitCode = 2; continue; }
    const r = SEAM === 'units'
      ? await runUnits(loop, reviewer, name, TEXTS[name])
      : await runTurn(loop, writer, name, TEXTS[name]);
    console.log(r.lines.join('\n'));
    all.push(r.json);
  }
  if (ARG.json) fs.writeFileSync(ARG.json, JSON.stringify(all, null, 2));
}

main().catch((error) => { console.error('stutter-timeline failed:', error && error.stack || error); process.exit(1); });
