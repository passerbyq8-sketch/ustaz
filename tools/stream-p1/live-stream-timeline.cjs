#!/usr/bin/env node
/**
 * LIVE STREAM TIMELINE — the first live measurement of the stutter, against production.
 *
 * Sends the order's request shape (EZIK-AGENT-STREAM-FIX-ORDER-2026-09-18 §0) to /api/ask and
 * records, for every chunk the socket delivers: its time since the request began (ms), its size
 * in bytes and the SSE event types it carries. Per call it writes a file with the whole answer and
 * its timeline; all calls are gathered in live-timings.json.
 *
 * It prints ASCII only (Arabic never reaches the terminal): first byte, first text, largest gap
 * between text-bearing chunks and where it sits (char index), chunk count, total time, answer
 * length, and the size of the final text burst.
 *
 * Every call is counted in <out>/live-calls.json and the tool refuses to exceed --cap (24).
 *
 * Usage:
 *   node tools/stream-p1/live-stream-timeline.cjs --out=<dir> [--only=1,2] [--cap=24]
 *        [--url=https://ezik.app/api/ask] [--matrix]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ARG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/u.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? 'true' : m[2];
}
const URL_ASK = ARG.url || 'https://ezik.app/api/ask';
const OUT = ARG.out;
const CAP = Number(ARG.cap || 24);
const DEVICE = 'agent-stream-20260918';
if (!OUT) { console.log('--out=<dir> is required'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const Q = {
  q1: 'ما هدي النبي صلى الله عليه وسلم في قيام الليل؟ اذكر لي حديثًا في ذلك.',
  q2: 'هل تجب الزكاة في مال الصبي الصغير؟',
  q3: 'ما حكم مسح الرأس في الوضوء مرة أو ثلاثًا؟',
  q4: 'كيف أتعامل مع زميل يسخر مني في المدرسة؟ أجبني بكلامك مباشرة دون أن تذكر آية ولا حديثًا ولا قائمة.',
};
// depth: 'brief' = field omitted, 'deep' = مفصّل, 'scholar' = طالب العلم
const MATRIX = [
  ['q1', 'brief'], ['q1', 'deep'], ['q1', 'scholar'],
  ['q2', 'brief'], ['q2', 'deep'], ['q2', 'scholar'],
  ['q3', 'deep'], ['q3', 'scholar'],
  ['q4', 'brief'],
  ['q1', 'deep'], ['q1', 'deep'],
  ['q2', 'deep'], ['q2', 'deep'],
];
// The order's table is 3+3+2+1 = 9 calls and its repeats 2+2 = 4, which is 13, not the 16 it
// states. The matrix is kept literal; the report records the difference.

const COUNTER = path.join(OUT, 'live-calls.json');
const readCount = () => { try { return JSON.parse(fs.readFileSync(COUNTER, 'utf8')).count || 0; } catch { return 0; } };
const bump = () => { const c = readCount() + 1; fs.writeFileSync(COUNTER, JSON.stringify({ count: c, cap: CAP, device: DEVICE }, null, 2)); return c; };

const now = () => Number(process.hrtime.bigint()) / 1e6;

async function one(idx, qid, depth) {
  const used = readCount();
  if (used >= CAP) { console.log(`CAP_REACHED used=${used} cap=${CAP} skip row=${idx}`); return null; }
  const body = { max_tokens: 4096, stream: true, name: 'عبد الله', age: 30, gender: 'male', mode: 'chat', band: 'adult', messages: [{ role: 'user', content: Q[qid] }] };
  if (depth !== 'brief') body.depth = depth;
  const n = bump();
  const t0 = now();
  const res = await fetch(URL_ASK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-murabbi-device': DEVICE, 'x-ezik-ai-consent': '2026-08-06-1' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });
  const tHeaders = now() - t0;
  const remaining = res.headers.get('x-murabbi-remaining');
  const chunks = [];
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = now() - t0;
    const s = decoder.decode(value, { stream: true });
    buf += s;
    const types = [];
    let added = '';
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) { types.push('comment'); continue; }
        if (line.startsWith('event:')) { types.push('event:' + line.slice(6).trim()); continue; }
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        let evt;
        try { evt = JSON.parse(raw); } catch { types.push('nonjson'); continue; }
        types.push(evt && evt.type ? String(evt.type) : 'untyped');
        if (evt && evt.type === 'content_block_delta' && evt.delta && typeof evt.delta.text === 'string') added += evt.delta.text;
      }
    }
    chunks.push({ t, bytes: value.byteLength, types, charStart: text.length, chars: added.length });
    text += added;
  }
  const tEnd = now() - t0;
  // Gaps between consecutive TEXT-bearing chunks; the head is first text time.
  const textChunks = chunks.filter((c) => c.chars > 0);
  let largest = { ms: 0, atChar: 0, afterChunk: -1 };
  for (let i = 1; i < textChunks.length; i++) {
    const g = textChunks[i].t - textChunks[i - 1].t;
    if (g > largest.ms) largest = { ms: g, atChar: textChunks[i].charStart, afterChunk: i - 1 };
  }
  const firstText = textChunks.length ? textChunks[0].t : null;
  const lastText = textChunks.length ? textChunks[textChunks.length - 1] : null;
  const tailBurst = lastText ? lastText.chars : 0;
  const rec = {
    call: n, row: idx, qid, depth, status: res.status, remaining,
    headersMs: tHeaders, firstByteMs: chunks.length ? chunks[0].t : null, firstTextMs: firstText,
    largestGapMs: largest.ms, largestGapAtChar: largest.atChar,
    largestGapBefore: text.slice(Math.max(0, largest.atChar - 80), largest.atChar),
    largestGapAfter: text.slice(largest.atChar, largest.atChar + 80),
    chunks: chunks.length, textChunks: textChunks.length, totalMs: tEnd, answerChars: text.length,
    tailBurstChars: tailBurst, tailBurstStartsAt: lastText ? lastText.charStart : null,
    headSilenceMs: firstText, footerFahm: /فهم[ٌ]? لا فتوى/u.test(text),
    question: Q[qid], text, timeline: chunks,
  };
  const file = path.join(OUT, `call-${String(n).padStart(2, '0')}-${qid}-${depth}.json`);
  fs.writeFileSync(file, JSON.stringify(rec, null, 2));
  console.log(`call=${n}/${CAP} row=${idx} ${qid} ${depth} status=${res.status} remaining=${remaining} first_byte_ms=${rec.firstByteMs && rec.firstByteMs.toFixed(0)} first_text_ms=${firstText && firstText.toFixed(0)} largest_gap_ms=${largest.ms.toFixed(0)} at_char=${largest.atChar}/${text.length} chunks=${chunks.length} text_chunks=${textChunks.length} total_ms=${tEnd.toFixed(0)} tail_burst=${tailBurst} footer=${rec.footerFahm}`);
  return rec;
}

async function main() {
  const only = ARG.only ? new Set(ARG.only.split(',').map(Number)) : null;
  const agg = path.join(OUT, 'live-timings.json');
  let all = [];
  try { all = JSON.parse(fs.readFileSync(agg, 'utf8')); } catch {}
  for (let i = 0; i < MATRIX.length; i++) {
    const row = i + 1;
    if (only && !only.has(row)) continue;
    const [qid, depth] = MATRIX[i];
    let rec;
    try { rec = await one(row, qid, depth); } catch (e) { console.log(`row=${row} error=${String(e && e.name)}:${String(e && e.message).replace(/[^\x20-\x7e]/gu, '?')}`); continue; }
    if (!rec) break;
    const { text, timeline, largestGapBefore, largestGapAfter, question, ...summary } = rec;
    all.push(summary);
    fs.writeFileSync(agg, JSON.stringify(all, null, 2));
  }
  console.log(`live_calls_used=${readCount()}/${CAP}`);
}
main().catch((e) => { console.log('live-stream-timeline failed: ' + String(e && e.stack).replace(/[^\x20-\x7e\n]/gu, '?')); process.exit(1); });
