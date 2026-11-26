// M: opt-in, preview-only observation. Never part of telemetry or a decision.
import { createHash } from 'node:crypto';

const hash = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const absent = (reason) => ({ value: null, reason });
const textOf = (row) => String(row.writerText || row.fullText || row.text || '');
const refsOf = (text) => [...String(text).matchAll(/\[\[(\d+)\]\]/gu)].map((m) => Number(m[1]));
const heldField = (reason) => 'held' + reason.split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join('');

export function bw2DiagnosticEnabled(req) {
  return process.env.VERCEL_ENV === 'preview' && req?.headers?.['x-ezik-diag'] === '1';
}

// Each data line (including its SSE prefix) is <= 16000 UTF-8 bytes. Split the
// serialized capture at code points, counting JSON's SECOND layer of escaping.
export function diagnosticFrames(capture) {
  const rid = capture.requestId;
  const serialized = JSON.stringify(capture);
  const pieces = [];
  let piece = '', bytes = 0;
  const allowance = 16000 - Buffer.byteLength('data: ' + JSON.stringify({ rid, seq: 999999999, of: 999999999, piece: '' }), 'utf8');
  if (allowance < 8) return [];
  for (const char of serialized) {
    const size = Buffer.byteLength(JSON.stringify(char).slice(1, -1), 'utf8');
    if (bytes + size > allowance) { pieces.push(piece); piece = ''; bytes = 0; }
    piece += char; bytes += size;
  }
  if (piece) pieces.push(piece);
  return pieces.map((part, i) => `event: bw2diag\ndata: ${JSON.stringify({ rid, seq: i + 1, of: pieces.length, piece: part })}\n\n`);
}

export function createBw2Diagnostic(req, { question, consent, requestStartedAt } = {}) {
  // No arrays, maps, hashing, text copies, or observer are constructed off-gate.
  if (!bw2DiagnosticEnabled(req)) return null;
  const vercelId = req.headers?.['x-vercel-id'];
  const requestId = typeof vercelId === 'string' && vercelId ? vercelId.split(':').pop() : null;
  const capture = {
    schema: 'bw2diag/1', requestId, requestIdReason: requestId === null ? 'x-vercel-id absent' : null,
    question: question ?? null, questionReason: question == null ? 'question absent' : null,
    consent: consent || null, consentReason: consent ? null : 'consent header absent',
    rerank_used: null, rerankReason: 'turn not finished', requestStartedAt: requestStartedAt ?? null,
    requestStartedAtReason: requestStartedAt == null ? 'request start not supplied' : null,
    candidates: [], judge: absent('judge not called'), pinned: absent('writer evidence not assembled'),
    writers: [], units: [], takhrij: [], markers: [], errors: [], ending: absent('turn not finished'),
  };
  const unitMap = new WeakMap();
  let active = null, lastHeld = null, lastReleased = null;
  const heldWords = [], heldMatns = [];
  let outputText = '', outputChars = 0, liveOffer = false, emitted = false;
  const writerBodies = new Map();
  const unit = (u) => {
    if (!u) return null;
    if (!unitMap.has(u)) {
      const record = { id: 'u' + (capture.units.length + 1), text: String(u.body || ''), separator: u.sep || '',
        citedRefs: refsOf(u.body), checks: [], status: 'pending', statusReason: 'not yet decided',
        dependencyId: null, dependencyReason: 'not a dependent hold', releasedAt: null, releaseReason: 'not released' };
      unitMap.set(u, record); capture.units.push(record);
    }
    return unitMap.get(u);
  };
  const observe = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/u)) {
      if (!line.startsWith('data:')) continue;
      let event; try { event = JSON.parse(line.slice(5)); } catch { continue; }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        outputText += event.delta.text; outputChars += event.delta.text.length;
      }
      if (event.type === 'ezik_replace') outputText = String(event.text || '');
      if (event.type === 'ezik_live_offer') liveOffer = true;
    }
  };
  const api = {
    capture,
    candidates(rows) {
      capture.candidates = rows.map((row, i) => ({ id: row.id ?? row.recordId ?? null, idReason: row.id || row.recordId ? null : 'source id absent',
        judgeRef: i + 1, kind: row.kind ?? null, url: row.url ?? null, title: row.title ?? row.bookTitle ?? null,
        textLength: textOf(row).length, decision: null, decisionReason: 'judge pending',
        rerankScore: null, rerankScoreReason: 'no returned score for this candidate' }));
    },
    decisions(decided) {
      capture.judge = decided === null ? absent('judge failed or timed out') : { value: decided, reason: null };
    },
    judged(rows, judged, ranked) {
      const scores = new Map(ranked?.ok ? ranked.pools.flatMap((p) => p.rows).map((r) => [r.ref, r.rerankScore]) : []);
      capture.candidates.forEach((c, i) => {
        const missing = capture.judge.value?.missing.includes(i + 1);
        c.decision = judged.unjudged || missing ? null : judged.kept.includes(rows[i]) ? 'kept' : 'dropped';
        c.decisionReason = judged.unjudged ? 'judge failed; fallback selection is separate' : missing ? 'no decision returned' : null;
        c.retained = judged.kept.includes(rows[i]);
        c.rerankScore = Number.isFinite(scores.get(i)) ? scores.get(i) : null;
        if (c.rerankScore !== null) c.rerankScoreReason = null;
      });
    },
    pinned(text, rows) {
      capture.pinned = { value: { text, sha256: null, refs: rows.map((r) => r.ref),
        rows: rows.map((r) => ({ ref: r.ref, id: r.id ?? r.recordId ?? null, kind: r.kind ?? null,
          url: r.url ?? null, title: r.title ?? r.bookTitle ?? null, text: textOf(r) })),
        releaserRows: JSON.parse(JSON.stringify(rows)), releaserRowsSha256: null }, reason: null };
    },
    writerStart(body) {
      const w = { id: capture.writers.length + 1, bodySha256: null, model: body.model ?? null, raw: '', chunks: [],
        stop: null, stopReason: 'writer not completed', usage: null, usageReason: 'writer not completed',
        startedAt: Date.now(), firstTokenAt: null, firstTokenReason: 'no text token', endedAt: null, markers: [] };
      capture.writers.push(w); writerBodies.set(w, body); return w;
    },
    writerText(w, delta) {
      const text = String(delta ?? '');
      if (text && w.firstTokenAt === null) { w.firstTokenAt = Date.now(); w.firstTokenReason = null; }
      w.raw += text; w.chunks.push(text);
    },
    writerEnd(w, payload) {
      w.endedAt = Date.now(); w.stop = payload?.stop_reason ?? null;
      w.stopReason = w.stop === null ? 'writer failed or no stop reason returned' : null;
      w.usage = payload?.usage ?? null; w.usageReason = w.usage === null ? 'no usage returned' : null;
      let at = -1;
      while ((at = w.raw.indexOf('@@EZIK_NOT_COVERED@@', at + 1)) >= 0) w.markers.push({ text: '@@EZIK_NOT_COVERED@@', offset: at, offsetUnit: 'UTF-16' });
    },
    enter(u) { active = unit(u); },
    enqueue(units) { units.forEach(unit); },
    merge(current, parents) {
      const record = unit(current);
      record.mergedFrom = parents.map((u) => unit(u).id);
      for (const u of parents) { const r = unit(u); r.status = 'merged'; r.statusReason = record.id; }
      active = record;
    },
    // The boolean is the predicate's already computed result, returned unchanged.
    test(rule, failed, reason, detail = null) {
      if (detail && ['consensus', 'school-choice', 'school-support', 'unsupported-group'].includes(rule)) {
        detail.found = Array.isArray(detail.phrase) && !detail.phrase.length ? null : !failed;
        if (detail.found === null) detail.foundReason = 'no such claim in this unit';
      }
      active?.checks.push({ rule, result: failed ? 'hold' : 'pass', reason: reason ? heldField(reason) : null,
        detail: detail ?? { phrase: null, phraseReason: 'structural predicate', searched: null, searchReason: 'no evidence search', found: null } });
      return failed;
    },
    note(rule, detail) { active?.checks.push({ rule, result: 'observed', reason: null, detail }); },
    books(missing, rows) {
      api.test('unretrieved-books', missing.length > 0, 'unsupported_attribution', {
        phrase: missing.length ? missing : null, phraseReason: missing.length ? null : 'no unsupported named book',
        searched: rows.map((r) => r.ref), found: missing.length ? false : null,
      });
      return missing;
    },
    orphanWords(words, sets) {
      if (words.length && active) {
        active.dependencyId = api.heldWordId(sets.findIndex((set) => words.some((word) => set.has(word))));
        active.dependencyReason = 'held unit containing the orphaned back-reference words';
      }
      api.note('orphan-word-search', { phrase: words, searched: heldWords, found: words.length > 0 });
      return words;
    },
    holdContext(u, sets, released, orphanWords) {
      // The preceding branch already decided to hold. Locate its witness only;
      // the result here is never returned to the policy. Keep the guard's mutation
      // seam (the original hold statement) intact.
      if (active?.checks.at(-1)?.rule !== 'previous-held' || active.checks.at(-1).result === 'hold') return;
      api.orphanWords(orphanWords(u.body, sets, released), sets);
      api.test('orphan-held-words', true, 'dependent_on_held');
    },
    pending(u, reason) { const r = unit(u); r.statusReason = reason; },
    hold(reason, u, { wordSet = false, matn = false } = {}) {
      const r = unit(u); if (!r) return;
      r.status = 'held'; r.statusReason = heldField(reason);
      const failingRule = r.checks.findLast((c) => c.result === 'hold')?.rule;
      r.checks.push({ rule: 'final-hold', result: 'hold', reason: heldField(reason),
        detail: { phrase: r.text, searched: null, searchReason: 'records the existing hold decision', found: null } });
      if (reason === 'dependent_on_held') {
        r.dependencyId = r.dependencyId || lastHeld;
        r.dependencyReason = r.dependencyReason === 'not a dependent hold' ? 'previous held unit (prevHeld)' : r.dependencyReason;
      } else if (reason === 'dependent_opening') {
        r.dependencyId = ['held-matn-opening', 'hadith-opening'].includes(failingRule) ? heldMatns.at(-1) ?? null
          : ['implicit-speaker', 'speech-speaker'].includes(failingRule) ? lastReleased : null;
        r.dependencyReason = r.dependencyId ? failingRule : 'required antecedent absent: ' + failingRule;
      }
      if (reason !== 'empty') lastHeld = r.id;
      if (wordSet) heldWords.push(r.id);
      if (matn) heldMatns.push(r.id);
    },
    heldWordId(i) { return heldWords[i] ?? null; },
    heldMatnId() { return heldMatns.at(-1) ?? null; },
    releasedId() { return lastReleased; },
    release(u) { const r = unit(u); r.status = 'released'; r.statusReason = null; r.releasedAt = Date.now(); r.releaseReason = null; lastReleased = r.id; lastHeld = null; },
    marker(route) { capture.markers.push({ route, activeUnit: active?.id ?? null }); },
    prewrite(result) { capture.prewriteTakhrij = result ?? absent('prewrite takhrij not requested'); },
    lookupStart(phase, query) { const r = { phase, unitId: active?.id ?? null, query, result: null, resultReason: 'lookup pending' }; capture.takhrij.push(r); return r; },
    lookupEnd(r, result, reason = null) { r.result = result ?? null; r.resultReason = result == null ? reason || 'no result returned' : null; },
    wrapLookup(lookup, phase) {
      return async (...args) => {
        const observation = api.lookupStart(phase, { matns: args[0], options: args[1] ?? null });
        try { const result = await lookup(...args); api.lookupEnd(observation, result); return result; }
        catch (error) { api.lookupEnd(observation, null, 'lookup threw'); throw error; }
      };
    },
    finishTurn(telemetry, text, route) {
      capture.rerank_used = telemetry.rerank_used ?? null;
      capture.rerankReason = capture.rerank_used === null ? 'rerank telemetry absent when flag disabled' : null;
      capture.ending = { value: { continued: telemetry.continued, route, bw2Chars: text.length,
        bw2Units: telemetry.unitsReleased, held: telemetry.unitsHeld, kept: telemetry.judgeKept,
        pinned: telemetry.pinnedRows, telemetry: { ...telemetry }, legacy: absent('turn did not hand over') }, reason: null };
    },
    observeWire(chunk) { if (!emitted) observe(chunk); },
    frames(queued) {
      if (emitted) return [];
      for (const chunk of queued) observe(chunk);
      emitted = true;
      if (capture.pinned.value) {
        capture.pinned.value.sha256 = hash(capture.pinned.value.text);
        capture.pinned.value.releaserRowsSha256 = hash(JSON.stringify(capture.pinned.value.releaserRows));
      }
      for (const [w, body] of writerBodies) w.bodySha256 = hash(JSON.stringify(body));
      for (const u of capture.units) if (u.status === 'pending') u.status = 'not_released';
      for (const lookup of capture.takhrij) if (lookup.resultReason === 'lookup pending') lookup.resultReason = 'lookup did not settle before response completion';
      if (capture.ending.value?.continued) capture.ending.value.legacy = { value: {
        chars: outputText.length, emittedChars: outputChars,
        notFound: /لم\s+(?:أجد|اجد|أقف|اقف)/u.test(outputText.replace(/[\u064b-\u065f\u0670\u0640]/gu, '')),
        liveOffer }, reason: null };
      return diagnosticFrames(capture);
    },
  };
  // Observation failures must never alter a predicate, a model call or delivery.
  // This boundary exists only on the enabled path and never logs source text.
  for (const [name, fn] of Object.entries(api)) {
    if (typeof fn !== 'function') continue;
    api[name] = (...args) => {
      try { return fn(...args); }
      catch {
        capture.errors.push({ method: name, reason: 'observation failed' });
        if (name === 'test') return args[1];
        if (['books', 'orphanWords', 'wrapLookup'].includes(name)) return args[0];
        if (name === 'frames') return [];
        return null;
      }
    };
  }
  return api;
}
