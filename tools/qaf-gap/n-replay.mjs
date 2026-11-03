// N: original M captures, with frozen model/lookup output; no network or model.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as currentUnits from '../../lib/bw2-units.js';
import { createBw2Diagnostic } from '../../lib/bw2-diagnostic.js';
import { BW2_NOT_COVERED } from '../../lib/before-writing-v2.js';

const root = new URL('../../', import.meta.url);
export const fixture = JSON.parse(gunzipSync(await readFile(new URL('tests/fixtures/qaf-gap-n-captures.json.gz', root))));
export const captures = fixture.captures;
const hash = (s) => createHash('sha256').update(s).digest('hex');
for (const [path, source] of Object.entries(fixture.sources)) assert.equal(hash(source), fixture.provenance.sourceSha256[path]);
// Relocate imports only. Baseline implementation bytes and their hashes are from git.
const baselineSource = fixture.sources['lib/bw2-units.js'].replace(/((?:from\s*|import\s*\(\s*)['"])([^'"]+)(['"])/gu,
  (all, before, spec, after) => spec.startsWith('.') ? before + new URL(spec, new URL('lib/bw2-units.js', root)).href + after : all);
const baselineUnits = await import('data:text/javascript;base64,' + Buffer.from(baselineSource).toString('base64'));
const currentTurn = await readFile(new URL('lib/before-writing-v2.js', root), 'utf8');
function continuationOf(source) {
  // Execute the actual turn's post-release branches, without reproducing their
  // decisions in the test. Retrieval, model requests and legacy writing are outside
  // this boundary; M did not capture all discarded candidate text or judge bodies.
  const body = source.slice(source.indexOf('  if (summary.dead ||'), source.indexOf('  // WHOLE-ANSWER CHECKS MAY ONLY APPEND'));
  assert.ok(body.includes("'none_released'"));
  return new Function('summary', 'payload', 'wire', 'telemetry', 'signal', 'BW2_NOT_COVERED', 'finish', 'finishAnswered', 'notCoveredOrContinue', 'lessonsUnder', 'emit', body + '\nreturn finish();');
}
export function projection(c) {
  return { units: c.units.map((u) => ({ id: u.id, text: u.text, separator: u.separator, status: u.status, statusReason: u.statusReason,
    dependencyId: u.dependencyId, dependencyReason: u.dependencyReason, mergedFrom: u.mergedFrom,
    checks: u.checks.map((x) => ({ rule: x.rule, result: x.result, reason: x.reason })) })), continued: c.ending.value.continued };
}
export async function replay(c, { baseline = process.env.QAF_GAP_N_SOURCE === 'baseline', rows = c.pinned.value.releaserRows } = {}) {
  const U = baseline ? baselineUnits : currentUnits;
  const ending = continuationOf(baseline ? fixture.sources['lib/before-writing-v2.js'] : currentTurn);
  const oldEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'preview';
  const d = createBw2Diagnostic({ headers: { 'x-ezik-diag': '1', 'x-vercel-id': c.requestId } }, { question: c.question, consent: c.consent, requestStartedAt: 0 });
  if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
  const releaseOrder = [], pendingLookups = [], unrecorded = [];
  let sent = '', raw = '', active = null;
  const enter = d.enter, release = d.release, merge = d.merge;
  d.enter = (u) => { enter(u); active = d.capture.units.find((r) => r.text === u.body); };
  d.merge = (u, parents) => { merge(u, parents); active = d.capture.units.find((r) => r.text === u.body); };
  d.release = (u) => { release(u); releaseOrder.push(d.capture.units.find((r) => r.text === u.body).id); };
  const lookup = async (text) => {
    const record = c.takhrij.find((t) => t.phase === 'unit' && t.query === text && t.unitId === active?.id);
    if (!record) { unrecorded.push(c.tag + ': unrecorded lookup for ' + active?.id); throw new Error(unrecorded.at(-1)); }
    // Captured marker/activeUnit establishes this order, without fabricated delay.
    if (c.markers.some((m) => m.route === 'raw-stream-marker' && m.activeUnit === active?.id) && !raw.includes(U.BW2_NOT_COVERED_MARKER)) {
      await new Promise((resolve) => pendingLookups.push(resolve));
    }
    return structuredClone(record.result);
  };
  const rel = U.createBw2Releaser({ rows: structuredClone(rows), mode: 'brief', emit: (s) => { sent += s; return true; }, diagnostic: d,
    question: c.question, holdUncitedRulings: true, notCoveredSentence: BW2_NOT_COVERED,
    askedMatn: U.askedHadithOf(c.question), sourceQuestion: U.asksHadithSource(c.question), askedNarrator: U.askedNarratorOf(c.question), takhrij: lookup, now: () => 0 });
  for (const w of c.writers) for (const chunk of w.chunks) {
    raw += chunk; rel.push(chunk);
    if (raw.includes(U.BW2_NOT_COVERED_MARKER)) pendingLookups.splice(0).forEach((resolve) => resolve());
    await new Promise((resolve) => setImmediate(resolve));
  }
  const summary = await rel.end();
  assert.deepEqual(unrecorded, [], 'every lookup uses a captured result');
  const telemetry = { readerSourceCount: summary.cited.length + summary.proofs.length, directFatwa: false };
  const wire = { get sent() { return sent; }, replace: (t) => { sent = t; }, liveOffer() {} };
  const continued = ending(summary, { stop_reason: c.writers.at(-1)?.stop }, wire, telemetry, null, BW2_NOT_COVERED,
    () => '', () => '', (reason) => reason, () => {}, (t) => { sent += t; });
  d.finishTurn({ continued, unitsReleased: summary.released, unitsHeld: summary.held }, sent, 'offline-release-boundary'); d.frames([]);
  return { capture: d.capture, summary, releaseOrder };
}
export function assertSafety(before, after) {
  const released = after.capture.units.filter((u) => u.status === 'released');
  for (const unit of released) {
    const original = before.units.find((u) => u.id === unit.id);
    assert.ok(original, before.tag + '/' + unit.id + ': captured unit identity');
    if (original.status === 'released') continue;
    const failures = original.checks.filter((c) => c.result === 'hold' && c.rule !== 'final-hold');
    assert.ok(failures.length > 0 && failures.every((c) => c.rule === 'awaiting-asked-hadith'), before.tag + '/' + unit.id + ': non-gate hold must remain held');
    assert.ok(original.checks.some((c) => c.rule === 'repeat-direct-fatwa' && c.result === 'pass'), before.tag + '/' + unit.id + ': captured non-gate check chain complete');
    assert.ok(unit.checks.some((c) => c.rule === 'speech-speaker' && c.result === 'pass'), before.tag + '/' + unit.id + ': final checks passed');
  }
  const positions = after.releaseOrder.map((id) => before.units.findIndex((u) => u.id === id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), before.tag + ': writer release order');
  assert.equal(new Set(after.releaseOrder).size, after.releaseOrder.length, before.tag + ': release once');
  if (!before.tag.startsWith('Q04')) assert.deepEqual(projection(after.capture), projection(before), before.tag + ': Q01/Q11 unchanged');
}
