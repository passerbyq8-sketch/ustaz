#!/usr/bin/env node
/**
 * STREAM-P5 §٤ — TIME TO FIRST CHARACTER, MEASURED AND NOT MODELLED.
 *
 * Phases two and three modelled arrival at a uniform rate derived from each answer's own
 * recorded total. This does not model anything: it opens a real streaming call to the real
 * provider and timestamps what actually arrives.
 *
 * ── THE TWO NUMBERS, AND WHY BOTH ARE NEEDED ────────────────────────────────────────
 *   READY    when the first reviewed unit was AVAILABLE to send — the moment the sentence
 *            stream released it, measured from the first byte of the request.
 *   SHIPPED  when the reader could actually have seen a character. On the delivery built in
 *            §٣ that is the close, because the finalized writer holds every frame until
 *            flush() (no `earlyRelease` is supplied — see the note at api/ask.js:emitUnits).
 *
 * The gap between them is what §٣ deliberately left on the table, stated as a number instead
 * of as a promise. It is what a later phase can earn by writing the frames during generation.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────────
 * NOT the full production path. The HTTP shell is not in the loop: `guardDayCap` fails CLOSED
 * without a reachable Upstash and would 429 the harness before a single token, and
 * BRAVE_API_KEY is empty in this tree so no retrieval runs. What IS real: the provider, the
 * network, the model, the arrival times, the reviewer, the takhrij lock and the unit
 * boundaries. So these are the delivery path's numbers, not the whole request's, and the
 * request's own overhead sits on top of them.
 *
 * Usage: first-byte-measure.cjs <questions.json> [out.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..', '..');

function readEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const at = line.indexOf('=');
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    if (!key || key.startsWith('#')) continue;
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function askOnce({ apiKey, model, question, system, createSentenceStream, cut }) {
  const t0 = Date.now();
  const stream = createSentenceStream({
    evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [],
  });
  let firstTokenMs = null;
  let readyMs = null;
  let chars = 0;
  let units = 0;
  let cutAt = null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system,
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `${res.status}`, detail: body.slice(0, 160) };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let at;
    // eslint-disable-next-line no-cond-assign
    while ((at = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (!line.startsWith('data:')) continue;
      let evt;
      try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (evt.type === 'content_block_delta' && evt.delta && typeof evt.delta.text === 'string') {
        if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
        chars += evt.delta.text.length;
        const out = stream.push(evt.delta.text);
        if (out.length) {
          units += out.length;
          if (readyMs === null) readyMs = Date.now() - t0;
        }
        // A CUT, INDUCED WHERE THE DIRECTIVE ASKS FOR ONE: the connection is abandoned
        // mid-answer so the close runs on a partial stream, on the WIRED path.
        if (cut && cutAt === null && chars >= cut) {
          cutAt = chars;
          try { await reader.cancel(); } catch { /* the point is that it ended */ }
          done = true;
          break;
        }
      }
      if (evt.type === 'message_stop') done = true;
    }
  }

  let closed = null;
  let closeError = null;
  try { closed = stream.end(); } catch (e) { closeError = String(e.message || e); }
  const totalMs = Date.now() - t0;
  return {
    firstTokenMs,
    readyMs,
    // The reader sees nothing until the close, by construction: the writer holds every
    // frame until flush(). This is that number, and it is the one a reader experiences.
    shippedMs: totalMs,
    totalMs,
    chars,
    units,
    cutAt,
    violations: closed ? closed.violations.length : null,
    heldUnits: closed ? closed.heldUnits : null,
    streamedUnits: closed ? closed.streamedUnits : null,
    closeError,
  };
}

async function main() {
  const questionsPath = process.argv[2];
  const outPath = process.argv[3];
  if (!questionsPath) {
    console.error('usage: first-byte-measure.cjs <questions.json> [out.json]');
    process.exit(2);
  }
  const env = readEnvLocal();
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) { console.error('no ANTHROPIC_API_KEY'); process.exit(2); }
  const model = env.MODEL_STANDARD || env.MODEL || 'claude-sonnet-5';
  const spec = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  const { createSentenceStream } = await import(
    url.pathToFileURL(path.join(ROOT, 'lib', 'sentence-stream.js')).href);

  console.log('');
  console.log(`MEASURED TIME TO FIRST CHARACTER   model=${model}   questions=${spec.questions.length}`);
  console.log('  kind          firstToken   unitReady     shipped     chars  units  held');
  const rows = [];
  for (const q of spec.questions) {
    const row = await askOnce({ apiKey, model, question: q.text, system: spec.system, createSentenceStream });
    rows.push({ kind: q.kind, ...row });
    if (row.error) { console.log(`  ${q.kind.padEnd(12)} ERROR ${row.error} ${row.detail || ''}`); continue; }
    console.log(`  ${q.kind.padEnd(12)}${String(row.firstTokenMs).padStart(9)} ms${String(row.readyMs).padStart(9)} ms${String(row.shippedMs).padStart(9)} ms${String(row.chars).padStart(9)}${String(row.streamedUnits).padStart(7)}${String(row.heldUnits).padStart(6)}`);
  }

  const ok = rows.filter((r) => !r.error && r.readyMs !== null);
  if (ok.length) {
    console.log('');
    console.log(`  median first token   ${Math.round(median(ok.map((r) => r.firstTokenMs)))} ms`);
    console.log(`  median unit ready    ${Math.round(median(ok.map((r) => r.readyMs)))} ms`);
    console.log(`  median shipped       ${Math.round(median(ok.map((r) => r.shippedMs)))} ms`);
    console.log(`  the gap §٣ left      ${Math.round(median(ok.map((r) => r.shippedMs - r.readyMs)))} ms at the median`);
  }

  // ── THE THREE CUTS, ON THE WIRED PATH ──────────────────────────────────────
  console.log('');
  console.log('CUT MID-ANSWER   (the connection abandoned while the answer is being written)');
  console.log('  cutAfter   chars  unitsOut  held  violations  close');
  const cuts = [];
  for (const at of spec.cuts || []) {
    const row = await askOnce({
      apiKey, model, question: spec.questions[0].text, system: spec.system,
      createSentenceStream, cut: at,
    });
    cuts.push({ cut: at, ...row });
    if (row.error) { console.log(`  ${String(at).padStart(8)} ERROR ${row.error}`); continue; }
    console.log(`  ${String(at).padStart(8)}${String(row.chars).padStart(8)}${String(row.streamedUnits).padStart(10)}${String(row.heldUnits).padStart(6)}${String(row.violations).padStart(12)}   ${row.closeError ? 'THREW: ' + row.closeError : 'clean'}`);
  }

  const violations = [...rows, ...cuts].reduce((n, r) => n + (r.violations || 0), 0);
  console.log('');
  console.log(`  §٥/١ violations across every run above: ${violations}`);

  if (outPath) fs.writeFileSync(outPath, JSON.stringify({ model, rows, cuts }, null, 2), 'utf8');
  process.exit(violations === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
