'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
function ok(name, condition, detail = '') {
  checks++;
  if (condition) console.log('PASS ' + name);
  else {
    failures++;
    console.log('FAIL ' + name + (detail ? ': ' + detail : ''));
  }
}

// Real turn and SSE response, with deterministic local adapters, judge, and writer.
async function replayKeptLesson(BW2, SSE, cited = false) {
  const target = { writes: [], headers: {}, headersSent: false, statusCode: 200,
    write(chunk) { this.headersSent = true; this.writes.push(String(chunk)); return true; },
    end() { return this; }, setHeader(k, v) { this.headers[k] = v; return this; },
    getHeader(k) { return this.headers[k]; }, flushHeaders() { this.headersSent = true; },
    once() { return this; }, on() { return this; }, removeListener() { return this; } };
  const context = {};
  const facade = SSE.createFinalizedSseResponse(target, {
    finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [] }),
    context: () => context,
  });
  const wire = BW2.createBw2Wire(facade);
  const sentence = '\u0627\u0644\u0635\u0628\u0631 \u062e\u0644\u0642 \u062d\u0633\u0646';
  const lesson = { kind: 'lesson', title: sentence, text: sentence,
    url: 'https://lessons.example/kept', publisher: 'fixture-scholar' };
  const out = await BW2.runBw2Turn({
    question: '\u0645\u0627 \u0641\u0636\u0644 \u0627\u0644\u0635\u0628\u0631\u061f', messages: [],
    wire, lessonsToken: 'fixture-token',
    onLessonRows: (rows) => { context.lessonRows = rows; },
    env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' },
    deps: {
      runTool: async (name, input, ctx) => {
        if (name === 'search_lessons') ctx.table.add({ ...lesson });
        return { text: '', added: [], calls: 1 };
      },
      searchStoredCorpus: async () => ({ records: [] }),
      encyclopediaReady: () => true, warmEncyclopedia: () => true,
      ask: async ({ user }) => {
        const d = {};
        for (const match of user.matchAll(/^\[(\d+)\] /gmu)) d[match[1]] = 1;
        return JSON.stringify({ d });
      },
      callWriter: async ({ onText }) => {
        onText(sentence + (cited ? ' [[1]].' : '.'));
        return { stop_reason: 'end_turn', usage: {} };
      },
    },
  });
  const frames = target.writes.join('').split('\n\n').filter((f) => f.startsWith('data: '))
    .map((f) => JSON.parse(f.slice(6)));
  return { out, frames, sent: wire.sent };
}

async function main() {
  const modulePath = path.join(ROOT, 'lib', 'reader-sources.js');
  if (!fs.existsSync(modulePath)) {
    ok('reader source gate exists inside the repository', false);
    console.log('RESULT 0/' + checks + ' failures=' + failures);
    process.exitCode = 1;
    return;
  }
  const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href + '?reader-sources-' + Date.now());
  const [RS, LOG] = await Promise.all([load('lib/reader-sources.js'), load('lib/answer-log.js')]);
  const gates = RS.READER_SOURCE_GATES;
  const routes = LOG.ANSWER_LOG_PATHS;
  const kinds = ['card', 'fatwa', 'hadith', 'row', 'lesson', 'encyclopedia'];
  ok('every answer-log path has an explicit accepted source gate', routes.every((route) => Array.isArray(gates[route])));
  for (const route of routes) {
    const empty = RS.readerSources(route, []);
    ok(route + ' accepts no source as zero', empty.count === 0 && empty.kinds.length === 0);
    const mixed = kinds.map((kind) => ({ kind, id: 'mixed-' + kind }));
    const expectedKinds = kinds.filter((kind) => gates[route].includes(kind));
    const summary = RS.readerSources(route, mixed);
    ok(route + ' counts exactly its accepted kinds in a mixed set',
      summary.count === expectedKinds.length && JSON.stringify(summary.kinds) === JSON.stringify(expectedKinds));
    for (const kind of kinds) {
      const one = RS.readerSources(route, [{ kind, id: 'one-' + kind }]);
      const accepted = gates[route].includes(kind);
      ok(route + ' ' + kind + ' source follows its route gate',
        one.count === (accepted ? 1 : 0) && JSON.stringify(one.kinds) === JSON.stringify(accepted ? [kind] : []));
    }
  }
  const duplicate = RS.readerSources('free-brain', [
    { kind: 'fatwa_service', id: 'same-record' },
    { kind: 'fatwa', id: 'same-record' },
    { kind: 'fatwa', id: 'blocked', accepted: false },
  ]);
  ok('aliases normalize and duplicate or rejected evidence does not inflate the count',
    duplicate.count === 1 && JSON.stringify(duplicate.kinds) === JSON.stringify(['fatwa']));
  ok('unknown route fails closed', RS.readerSources('unknown', [{ kind: 'card', url: 'https://example.org/' }]).count === 0);

  const shouldBlock = (summary) => summary.count === 0;
  const decisionCases = [
    { name: 'no source', rows: [], blocked: true },
    ...kinds.map((kind) => ({ name: 'one ' + kind, rows: [{ kind, id: 'one-' + kind }], blocked: false })),
    { name: 'multiple kinds', rows: [
      { kind: 'card', id: 'page-1' }, { kind: 'hadith', id: 'proof-1' }, { kind: 'row', id: 'row-1' },
    ], blocked: false },
  ];
  for (const route of ['bw2', 'free-brain']) {
    for (const item of decisionCases) {
      const summary = RS.readerSources(route, item.rows);
      const blocked = shouldBlock(summary);
      const expectedCount = item.rows.filter((row) => gates[route].includes(row.kind)).length;
      ok(route + ' ' + item.name + ' cites the accepted count and blocks iff zero',
        summary.count === expectedCount && blocked === (expectedCount === 0) && blocked === item.blocked);
    }
  }
  const lateProof = [{ kind: 'hadith', id: 'late-proven-hadith' }];
  const withLateProof = RS.readerSources('free-brain', lateProof);
  const droppedHadithMutant = RS.readerSources('free-brain', lateProof.filter((row) => row.kind !== 'hadith'));
  ok('late proven hadith prevents the no-source block; dropping it is caught by the matrix',
    !shouldBlock(withLateProof) && shouldBlock(droppedHadithMutant));
  const allKinds = [...kinds];
  ok('source-kind telemetry mask round-trips the canonical kind matrix',
    JSON.stringify(RS.readerSourceKindsFromMask(RS.readerSourceMask(allKinds))) === JSON.stringify(allKinds));
  const invertedRule = (summary) => summary.count > 0;
  ok('mutant inverted block rule is killed by the zero/one/multiple matrix',
    decisionCases.every((item) => {
      const summary = RS.readerSources('free-brain', item.rows);
      return shouldBlock(summary) === item.blocked && invertedRule(summary) !== item.blocked;
    }));

  const sourceMarkup = '<source>A</source><book>B</book>';
  const nl = String.fromCharCode(10);
  const encyclopediaLabel = String.fromCodePoint(0x627, 0x644, 0x645, 0x635, 0x62f, 0x631, 0x3a);
  const tail = nl + nl + encyclopediaLabel + ' Fixture.';
  ok('visible source count is exported', typeof RS.visibleSourceCount === 'function');
  if (typeof RS.visibleSourceCount === 'function') {
    ok('visible source count counts reader-facing source and book tags', RS.visibleSourceCount(sourceMarkup) === 2);
    ok('visible source count counts the encyclopedia tail once', RS.visibleSourceCount(tail + tail) === 1);
    ok('visible source count includes retrieved takhrij evidence', RS.visibleSourceCount('', 2) === 2);
    ok('visible source count reads finalizer card tags, suffix, and takhrij count',
      RS.visibleSourceCount({ readerCards: [{ tag: '<source>A</source>' }, { tag: '<book>B</book>' }], readerSuffix: tail, takhrijEvidence: 2 }) === 5);
  }
  const makeRecord = (events, units, evidence) => {
    const log = LOG.createAnswerLog({ question: 'fixture', key: 'fixture-key', now: () => 1000, trace: 'visiblefixture' });
    const target = { write() { return true; }, end() { return true; } };
    log.tap(target);
    for (const event of events) target.write('data: ' + JSON.stringify(event) + nl + nl);
    log.note({ cited: units, takhrijEvidence: evidence });
    return log.record();
  };
  const delta = (text) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
  const measured = makeRecord([delta(sourceMarkup + tail)], 7, 2);
  ok('answer log cited is the visible tag/tail/evidence count and preserves differing units',
    measured.cited === 5 && measured.flags.includes('units:7') && !Object.prototype.hasOwnProperty.call(measured, 'takhrijEvidence'));
  const replaced = makeRecord([delta('<source>A</source><source>B</source>'), { type: 'ezik_replace', text: '<book>B</book>' }], 0, 0);
  ok('answer log resets final visible text on ezik_replace', replaced.cited === 1 && replaced.flags.includes('units:0'));
  const [BW2, SSE] = await Promise.all([load('lib/before-writing-v2.js'), load('lib/finalized-sse-writer.js')]);
  const uncitedLesson = await replayKeptLesson(BW2, SSE);
  ok('BW2 fixture keeps one lesson and releases uncited text',
    uncitedLesson.out.telemetry.judgeKept === 1 && uncitedLesson.out.telemetry.unitsReleased > 0);
  ok('BW2 uncited text with a judge-kept lesson is replaced by the unsourced hold',
    uncitedLesson.out.telemetry.unsourcedWithheld === true && uncitedLesson.sent === BW2.BW2_NOT_COVERED
      && uncitedLesson.frames.some((frame) => frame.type === 'ezik_replace' && frame.text === BW2.BW2_NOT_COVERED));
  ok('BW2 a kept but uncited lesson adds no reader source and no lessons frame',
    uncitedLesson.out.telemetry.readerSourceCount === 0
      && uncitedLesson.frames.every((frame) => frame.type !== 'ezik_lessons'));
  const citedLesson = await replayKeptLesson(BW2, SSE, true);
  ok('BW2 a cited lesson counts once and keeps the answered lesson block',
    citedLesson.out.telemetry.readerSourceCount === 1 && !citedLesson.out.telemetry.unsourcedWithheld
      && citedLesson.frames.some((frame) => frame.type === 'ezik_lessons' && frame.rows.length === 1));

  const answerLog = fs.readFileSync(path.join(ROOT, 'lib', 'answer-log.js'), 'utf8');
  const ask = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  const bw2 = fs.readFileSync(path.join(ROOT, 'lib', 'before-writing-v2.js'), 'utf8');
  const shariaHold = ask.indexOf('const holdUnsourced = currentRuntime !== \'GENERAL\' && !generalSystem;');
  const shariaTurn = ask.indexOf('out = await runFreeBrainTurn({', shariaHold);
  const zeroSourceHold = ask.indexOf('freeBrainVisibleSourceCount === 0');
  ok('non-general free-brain turns enable the zero-source hold before generation',
    shariaHold >= 0 && shariaTurn > shariaHold
      && ask.includes('onWriteUnit: (detail) => ((holdUnsourced || !!removedPersonQuestion) ? false : liveFreeBrainUnits.push(detail))'));
  ok('zero accepted free-brain sources replace held output with the server-owned not-covered response',
    zeroSourceHold > shariaTurn && ask.includes('answerLog.note({ flags: [\'unsourced_withheld\'] });')
      && ask.includes('liveFreeBrainUnits.finish(BW2_NOT_COVERED, { replace: true })')
      && ask.includes('emitOnce(BW2_NOT_COVERED)'));
  ok('source delivery and cited counts use the accepted source summary at the release boundary',
    ask.includes("readerSources('free-brain', freeBrainSourceRows)")
      && ask.includes('cited: summary.count') && ask.includes('freeBrainVisibleSourceCount === 0'));
  const sourceStart = bw2.indexOf("const readerSourceSummary = readerSources('bw2', [");
  const sourceEnd = bw2.indexOf('  telemetry.readerSourceCount =', sourceStart);
  ok('BW2 source-count expression is available for the release-boundary fixture', sourceStart >= 0 && sourceEnd > sourceStart);
  if (sourceStart < 0 || sourceEnd <= sourceStart) throw new Error('missing BW2 source-count expression');
  const countReleased = new Function('readerSources', 'lessonFrameRows', 'summary', 'lessonsFrom', 'directRow',
    bw2.slice(sourceStart, sourceEnd) + '\nreturn readerSourceSummary;');
  const kept = [{ kind: 'lesson', title: 'kept lesson', url: 'https://lessons.example/kept', publisher: 'fixture-scholar' }];
  const boundary = countReleased(RS.readerSources, SSE.lessonFrameRows,
    { cited: [], proofs: [], readerCards: [], substantive: 1 }, kept, null);
  ok('BW2 uncited kept lesson cannot clear the zero-source hold at the release boundary',
    boundary.count === 0 && boundary.kinds.length === 0);
  const units = fs.readFileSync(path.join(ROOT, 'lib', 'bw2-units.js'), 'utf8');
  const ledger = fs.readFileSync(path.join(ROOT, 'lib', 'ledger', 'seam.js'), 'utf8');
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'gates.json'), 'utf8'));
  ok('answer log defaults cited to zero when the source gate accepted nothing', /cited:\s*0/.test(answerLog));
  ok('free-brain visible hold counts final card markup, encyclopedia tail, and takhrij evidence',
    ask.includes('visibleSourceCount({') && ask.includes("readerCards: String(readerText || '').trim() ? finalizerContext.readerCards : [],")
      && ask.includes('readerSuffix: finalizerContext.readerSuffix')
      && ask.includes('takhrijEvidence: takhrijProvenRows.length')
      && ask.includes('freeBrainVisibleSourceCount === 0'));
  ok('free-brain source-unit telemetry remains separate from visible cited count',
    ask.includes("path: 'free-brain', ...sourceNoteFields(freeBrainSourceSummary)")
      && ask.includes('cited: summary.count') && ask.includes('src:')
      && answerLog.includes('visibleSourceCount(tapper.finalText, takhrijEvidence)')
      && answerLog.includes("finalText = typeof e.text === 'string' ? e.text : '';")
      && answerLog.includes("'units:' + units"));
  ok('BW2 counts delivered cards and uses the same zero-count blocking rule',
    bw2.includes("readerSources('bw2', [") && bw2.includes('summary.readerCards')
      && bw2.includes('telemetry.readerSourceCount === 0') && units.includes('readerCards: [...readerCards]'));
  ok('BW2 source-kind mask reaches answer-log flags', ask.includes('readerSourceKindsFromMask(t.readerSourceMask).map((kind) => `src:${kind}`)'));
  ok('source-log paths use the central source summary',
    ask.includes("readerSources('closed', closedOut.finalizerSources)")
      && ask.includes("readerSources('world', worldPass.sources)")
      && ask.includes("readerSources('ledger', sources)")
      && ask.includes("readerSources(toLedger ? 'hybrid' : 'stored'")
      && !/readerSources\(['"]free-brain['"]\s*,\s*out\.cited/.test(ask));
  ok('BW2 and ledger publish accepted sources to the shared counter', bw2.includes("readerSources('bw2'") && ledger.includes('onReaderSources'));
  ok('no answer-log cited assignment uses raw array lengths or card-send counters',
    !ask.includes('cited: cards.length') && !ask.includes('cited: out.cited.length')
      && !ask.includes('cited: t.cardsSent'));
  ok('BW2 released-card telemetry stays separate from the accepted source-unit count',
    units.includes('cardsSent += 1;') && units.includes('cardsSent, readerCards: [...readerCards]')
      && bw2.includes('telemetry.cardsSent = summary.cardsSent;')
      && ask.includes('cardsSent: t.cardsSent') && ask.includes('cited: summary.count'));
  ok('the route-by-source matrix guard is registered',
    registry.some((entry) => entry.script === 'guards/reader-sources-guard.cjs'));
  console.log('RESULT ' + (checks - failures) + '/' + checks + ' failures=' + failures);
  if (failures) process.exitCode = 1;
}

module.exports = { replayKeptLesson };

if (require.main === module) main().catch((error) => {
  console.log('FATAL ' + String(error && error.message || error));
  process.exitCode = 1;
});
