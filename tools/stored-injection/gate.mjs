// tools/stored-injection/gate.mjs — S1/§٢. THE PROOF, AND EVERY ITEM IN IT IS AN ACCEPTANCE
// CONDITION RATHER THAN A REPORT.
//
// WHAT IS UNDER TEST. lib/free-brain/loop.js now offers rows from the fatwa corpus to a turn the
// deterministic key calls religious, BEFORE the first provider call, whether or not the model ever
// asks for a tool. That widens what the model is shown on fifty-five turns that previously saw
// nothing — so it widens, by definition, the surface on which a wrong page can be credited to the
// right shaykh. This file exists to hold that surface to the same size it had before.
//
// THE SIX CONDITIONS, IN THE ORDER §٢ STATES THEM:
//
//   NEIGHBOUR  A row in a NEIGHBOURING mas-ala — same shaykh, same official host, same stance —
//              must not support the sentence beside it. The fixture is the phase-4 one verbatim
//              (fixtures/growing-evidence.json, case `fiqh-late-row`): `binbaz:2` is about
//              الدعاء بعد الأذان and the sentence is about صيام يوم عرفة, and authority, host and
//              stance ALL pass, so the only thing standing between them is the topic. ABSOLUTE,
//              not differential.
//   LIVENESS   A row that genuinely matches must actually be kept. A gate that refuses everything
//              satisfies NEIGHBOUR perfectly and deletes the feature.
//   GENERAL    Byte-identity, before and after, on worldly turns. `before` is not a description of
//              the old behaviour, it is the old FILE: origin/main's lib/free-brain/loop.js is
//              written out and run beside the new one against the same stubs.
//   CACHE      The one cache breakpoint has not moved, and the evidence is printed.
//   CEILING    An offer may not hand the model more rows than a request does.
//   COUNTER    `stored_injection` moves only on an event that happened.
//
// AND --selftest BUILDS MUTANTS. A gate that cannot fail proves nothing, so each mutant disarms
// one property and must be CAUGHT. A mutant whose text does not apply, or whose tree will not
// import, is BROKEN — reported as its own verdict and failing the selftest, never counted as
// caught. One INNOCENT mutant is built too, and it must break nothing.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { installWire, serviceRecord, say, askFor, baseOptions, sha256 } from './harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
// Written for the run and removed after it. It sits beside loop.js because its relative imports
// («./tools.js», «./review.js») must resolve to the same modules the live loop resolves to —
// anywhere else and the comparison would be against a different tree, not a different loop.
const BASELINE = path.join(ROOT, 'lib', 'free-brain', 'loop.baseline.generated.js');

const FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'fixtures', 'growing-evidence.json'), 'utf8'));
const FIQH = FIXTURE.cases.find((entry) => entry.id === 'fiqh-late-row');
if (!FIQH) throw new Error('fixture case fiqh-late-row missing');

const rowOf = (id) => {
  const found = FIQH.evidence.find((entry) => entry.row.id === id);
  if (!found) throw new Error(`fixture row ${id} missing`);
  return found.row;
};
const NEIGHBOUR_ROW = rowOf('binbaz:2');      // الدعاء بعد الأذان
const MATCHING_ROW = rowOf('binbaz:1');       // صيام يوم عرفة لغير الحاج
const OTHER_ROW = rowOf('alkhathlan:1');      // زكاة الأسهم — a stranger, not a neighbour
const NEIGHBOUR_MUST_NOT_SUPPORT = FIQH.expect.mustNotSupport[0];
// The unit the fixture names, 1-based, and the shaykh whose name must not survive on it.
const TARGET_UNIT = FIQH.units[NEIGHBOUR_MUST_NOT_SUPPORT.unit - 1];
const SHAYKH = 'ابن باز';

// ── the wire records, built from the fixture rows ────────────────────────────
const asService = (row, question) => serviceRecord({
  scholarId: row.id.split(':')[0] === 'binbaz' ? 'binbaz' : 'alkhathlan',
  id: row.id.split(':')[1],
  title: row.title,
  question,
  answer: row.snippet,
  path: new URL(row.url).pathname,
});

const NEIGHBOUR_SERVICE = asService(NEIGHBOUR_ROW, 'ما حكم الدعاء بعد الأذان؟');
const MATCHING_SERVICE = asService(MATCHING_ROW, 'ما حكم صيام يوم عرفة لغير الحاج؟');
const OTHER_SERVICE = asService(OTHER_ROW, 'ما حكم زكاة الأسهم؟');

// The question that makes the NEIGHBOUR row admissible, so that it genuinely reaches the model.
// This is the harder half of the condition: a row the admission gate never returns cannot be
// credited to anything, and proving that alone would be proving the gate below it.
const NEIGHBOUR_QUESTION = 'ما حكم الدعاء بعد الأذان؟';
const MATCHING_QUESTION = 'ما حكم صيام يوم عرفة لغير الحاج؟';

// ── the platform log is the code's, not this file's ─────────────────────────
// lib/free-brain/loop.js prints a round ledger and a `[stored-injection]` line per turn, and this
// gate runs ninety-odd turns. Left alone they bury the report, and under --json they are
// interleaved with it on the same stream, so the selftest's child cannot parse its own result and
// EVERY mutant is reported BROKEN — a gate that fails for a reason that has nothing to do with any
// mutant. Silenced by default, restored by --verbose, and never touched during the report itself.
const REAL_LOG = console.log;
const REAL_WARN = console.warn;
if (!process.argv.includes('--verbose')) {
  console.log = () => {};
  console.warn = () => {};
}
const report = (...args) => REAL_LOG(...args);

// ── the report ───────────────────────────────────────────────────────────────
const results = [];
let failures = 0;
function check(group, name, ok, detail) {
  results.push({ group, name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  if (!ok) failures += 1;
}

const JSONS = (value) => JSON.stringify(value);

// ── running one turn ─────────────────────────────────────────────────────────
async function runTurn(loop, { question, storedRuntime, lexicalRoute, mode = 'standard', records, script }) {
  const wire = installWire({ records, script });
  try {
    const options = baseOptions({ question, storedRuntime, lexicalRoute, mode, fetchImpl: wire.fetchImpl });
    const messagesBefore = JSONS(options.messages);
    const out = await loop.runFreeBrainTurn(options);
    return { out, providerBodies: [...wire.providerBodies], messagesBefore, messagesAfter: JSONS(options.messages) };
  } finally {
    wire.restore();
  }
}

/** The first provider body, parsed. The turn always makes at least one call. */
const firstBody = (run) => JSON.parse(run.providerBodies[0]);

/** Every text block the model was shown on the reader's own turn. */
function userBlocks(body) {
  const last = body.messages[body.messages.length - 1];
  const content = last && last.content;
  if (typeof content === 'string') return [content];
  return (Array.isArray(content) ? content : []).filter((b) => b.type === 'text').map((b) => b.text);
}

/** The rendered rows as a tool_result carries them, from a provider body the model asked for. */
function toolResultText(body) {
  if (!body) return '';
  const parsed = JSON.parse(body);
  for (const message of parsed.messages || []) {
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block && block.type === 'tool_result') return String(block.content || '');
    }
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// NEIGHBOUR — 24 checks
// ═══════════════════════════════════════════════════════════════════════════
let neighbourCards = 0;
let neighbourCardTrials = 0;

async function neighbour(loop) {
  // Three injected sets, none of which contains the row that WOULD legitimately support the
  // sentence. Two of them carry a second row so that the neighbour is not always ref 1: a rule
  // that only holds for the first marker is not a rule.
  const sets = [
    { name: 'neighbour-alone', records: [NEIGHBOUR_SERVICE] },
    { name: 'neighbour-then-stranger', records: [NEIGHBOUR_SERVICE, OTHER_SERVICE] },
    { name: 'stranger-then-neighbour', records: [OTHER_SERVICE, NEIGHBOUR_SERVICE] },
  ];
  // Four citation shapes the model may write, including the one that points straight at the
  // neighbour and the one that points at nothing.
  const shapes = [
    { name: 'cites-first', text: `${TARGET_UNIT} [[1]]` },
    { name: 'cites-second', text: `${TARGET_UNIT} [[2]]` },
    { name: 'cites-all', text: `${TARGET_UNIT} [[1، 2]]` },
    { name: 'cites-none', text: TARGET_UNIT },
  ];
  const modes = ['standard', 'voice'];

  for (const set of sets) {
    for (const shape of shapes) {
      for (const mode of modes) {
        const run = await runTurn(loop, {
          question: NEIGHBOUR_QUESTION,
          storedRuntime: 'STORED_FIQH',
          lexicalRoute: 'DEEN',
          mode,
          records: set.records,
          script: [say(shape.text)],
        });
        const text = run.out.text;
        // ABSOLUTE, AND IT IS ABOUT SUPPORT. «يُسنِد» is the reviewer's decision: does this row
        // back the attribution in this sentence? The shaykh's name surviving IS that decision made
        // visible, and it is the same quantity the phase-4 gate measured on `verdict.sentences`.
        // The row may not earn the name — in any citation shape, in any mode, beside any other row.
        const nameGone = !text.includes(SHAYKH);
        check('NEIGHBOUR', `${set.name}/${shape.name}/${mode}`, nameGone,
          `name=${nameGone ? 'stripped' : 'KEPT'} text=${JSONS(text.slice(0, 60))}`);
        // MEASURED BESIDE IT, AND DELIBERATELY NOT ASSERTED ON IT. A card is built from every CITED
        // row that has a URL and the reviewer is never consulted, so a sentence it has just marked
        // «فهمٌ لا نصٌّ منقول» can still leave carrying a page about the neighbouring mas-ala. That
        // belongs to the card path, which §١/٤ freezes, and PARITY below proves it is identical
        // when the model requested the very same row. It is counted here and named in the report
        // rather than folded into a check that would then be passing for the wrong reason.
        if (run.out.cited.some((row) => row.url === NEIGHBOUR_ROW.url)) neighbourCards += 1;
        neighbourCardTrials += 1;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVENESS — 8 checks
// ═══════════════════════════════════════════════════════════════════════════
async function liveness(loop) {
  const modes = ['standard', 'voice'];
  const shapes = [
    { name: 'cites-first', text: `${TARGET_UNIT} [[1]]` },
    { name: 'cites-all', text: `${TARGET_UNIT} [[1، 2]]` },
  ];
  for (const shape of shapes) {
    for (const mode of modes) {
      const run = await runTurn(loop, {
        question: MATCHING_QUESTION,
        storedRuntime: 'STORED_FIQH',
        lexicalRoute: 'DEEN',
        mode,
        records: [MATCHING_SERVICE],
        script: [say(shape.text)],
      });
      check('LIVENESS', `kept/${shape.name}/${mode}`, run.out.text.includes(SHAYKH),
        `text=${run.out.text.slice(0, 90)}`);
    }
  }

  // The rows have to arrive at all, or every condition above is satisfied by an empty offer.
  const run = await runTurn(loop, {
    question: MATCHING_QUESTION,
    storedRuntime: 'STORED_FIQH',
    lexicalRoute: 'DEEN',
    records: [MATCHING_SERVICE],
    script: [say(`${TARGET_UNIT} [[1]]`)],
  });
  const blocks = userBlocks(firstBody(run));
  check('LIVENESS', 'offer-reaches-the-model', blocks.length === 2, `text blocks on the reader turn = ${blocks.length}`);
  check('LIVENESS', 'offer-carries-the-row', blocks.some((b) => b.includes(MATCHING_ROW.title)),
    `titles seen = ${JSONS(blocks.map((b) => b.slice(0, 40)))}`);
  check('LIVENESS', 'offer-is-not-an-order', blocks.some((b) => b.includes('ليست أمرًا بالاستشهاد')),
    'the candidate-evidence note must ride with the rows');
  check('LIVENESS', 'readers-own-bytes-first', blocks[0] === MATCHING_QUESTION,
    `first block = ${JSONS(blocks[0])}`);
  check('LIVENESS', 'fired-and-cited', run.out.storedInjection.fired && run.out.storedInjection.cited === 1,
    JSONS(run.out.storedInjection));
}

// ═══════════════════════════════════════════════════════════════════════════
// PARITY — an offered row is treated exactly as a requested row is
// ═══════════════════════════════════════════════════════════════════════════
//
// THE WHOLE CLAIM OF THIS ITEM IS THAT IT ADDS NO LATITUDE. S1 changes WHEN the corpus is searched
// and never HOW its rows are judged, so one identical row reaching the model through the two doors
// must produce the identical answer, the identical cards and the identical verdict. Anything the
// offered path does that the requested path does not is a new behaviour nobody asked for — and it
// is also what turns the card measurement above from «S1 broke this» into «S1 reaches this», which
// are different claims and only one of them is true.
async function parity(loop) {
  const cases = [
    { name: 'neighbour', records: [NEIGHBOUR_SERVICE], question: NEIGHBOUR_QUESTION },
    { name: 'match', records: [MATCHING_SERVICE], question: MATCHING_QUESTION },
  ];
  for (const item of cases) {
    for (const mode of ['standard', 'voice']) {
      // OFFERED: the key says religious, the model asks for nothing and writes at once.
      const offered = await runTurn(loop, {
        question: item.question, storedRuntime: 'STORED_FIQH', lexicalRoute: 'DEEN', mode,
        records: item.records, script: [say(`${TARGET_UNIT} [[1]]`)],
      });
      // REQUESTED: nothing is offered, and the model calls the tool itself with the same query,
      // then writes the same sentence with the same marker.
      const requested = await runTurn(loop, {
        question: item.question, storedRuntime: 'GENERAL', lexicalRoute: 'DEEN', mode,
        records: item.records,
        script: [askFor(item.question), say(`${TARGET_UNIT} [[1]]`)],
      });
      check('PARITY', `${item.name}/answer/${mode}`, offered.out.text === requested.out.text,
        `offered=${JSONS(offered.out.text.slice(0, 50))} requested=${JSONS(requested.out.text.slice(0, 50))}`);
      check('PARITY', `${item.name}/cards/${mode}`,
        JSONS(offered.out.cited.map((r) => r.url)) === JSONS(requested.out.cited.map((r) => r.url)),
        `offered=${JSONS(offered.out.cited.map((r) => r.url))} requested=${JSONS(requested.out.cited.map((r) => r.url))}`);
      check('PARITY', `${item.name}/verdict/${mode}`,
        JSONS(offered.out.verdict?.sentences) === JSONS(requested.out.verdict?.sentences),
        `offered=${JSONS(offered.out.verdict?.sentences)}`);
      // AND THE ROWS THEMSELVES, AS THE MODEL SEES THEM. The three checks above are blind to the
      // rendering: the evidence table is filled by ./tools.js and a scripted model cites `[[1]]`
      // whatever it was actually shown, so a mutant that mangles only the offered block leaves all
      // of them green. This is the check that reads what was on the wire. The offered block is the
      // candidate-evidence note followed by the SAME bytes the tool_result carries — nothing more,
      // and no second format.
      const offeredBlock = userBlocks(firstBody(offered))[1] || '';
      const toolText = toolResultText(requested.providerBodies[1]);
      check('PARITY', `${item.name}/rendering/${mode}`,
        !!toolText && offeredBlock.endsWith(toolText),
        `tool=${JSONS(toolText.slice(0, 40))} offered-tail=${JSONS(offeredBlock.slice(-40))}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERAL — byte-identity against origin/main's own loop.js
// ═══════════════════════════════════════════════════════════════════════════
const GENERAL_TURNS = [
  'كم عدد سكان اليابان؟',
  'ما هو أطول نهر في العالم؟',
  'اشرح لي كيف يعمل المحرك النفاث.',
  'ما الفرق بين الذاكرة العشوائية والقرص الصلب؟',
  'متى تأسست مدينة الكويت؟',
];

async function general(loop, baseline) {
  for (const question of GENERAL_TURNS) {
    const script = [say('جوابٌ دنيويٌّ قصير.')];
    const records = [MATCHING_SERVICE, NEIGHBOUR_SERVICE, OTHER_SERVICE];
    const now = await runTurn(loop, { question, storedRuntime: 'GENERAL', lexicalRoute: 'GEN', records, script });
    const then = await runTurn(baseline, { question, storedRuntime: 'GENERAL', lexicalRoute: 'GEN', records, script });
    check('GENERAL', `request-bytes/${question.slice(0, 14)}`,
      JSONS(now.providerBodies) === JSONS(then.providerBodies),
      `sha now=${sha256(JSONS(now.providerBodies)).slice(0, 12)} then=${sha256(JSONS(then.providerBodies)).slice(0, 12)}`);
    check('GENERAL', `answer-bytes/${question.slice(0, 14)}`, now.out.text === then.out.text,
      `now=${JSONS(now.out.text.slice(0, 40))}`);
    check('GENERAL', `cards/${question.slice(0, 14)}`,
      JSONS(now.out.cited.map((r) => r.url)) === JSONS(then.out.cited.map((r) => r.url)), '');
  }
  // And the counter must say, in its own words, that nothing happened.
  const idle = await runTurn(loop, {
    question: GENERAL_TURNS[0], storedRuntime: 'GENERAL', lexicalRoute: 'GEN',
    records: [MATCHING_SERVICE], script: [say('جوابٌ دنيويٌّ قصير.')],
  });
  check('GENERAL', 'counter-silent', idle.out.storedInjection.fired === false
    && idle.out.storedInjection.rows === 0 && idle.out.storedInjection.cited === 0,
    JSONS(idle.out.storedInjection));
  // Half a key is not a key: a DEEN route with a worldly runtime, and the reverse, both stay off.
  for (const [runtime, route] of [['GENERAL', 'DEEN'], ['STORED_FIQH', 'GEN']]) {
    const run = await runTurn(loop, {
      question: GENERAL_TURNS[1], storedRuntime: runtime, lexicalRoute: route,
      records: [MATCHING_SERVICE], script: [say('جوابٌ دنيويٌّ قصير.')],
    });
    check('GENERAL', `half-key-off/${runtime}+${route}`, run.out.storedInjection.fired === false,
      JSONS(run.out.storedInjection));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE — the breakpoint has not moved, and the evidence is printed
// ═══════════════════════════════════════════════════════════════════════════
function cacheControlPaths(value, at = '$') {
  const out = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => out.push(...cacheControlPaths(item, `${at}[${index}]`)));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'cache_control') out.push(at);
      else out.push(...cacheControlPaths(item, `${at}.${key}`));
    }
  }
  return out;
}

async function cache(loop) {
  // api/ask.js owns wrapSystem, so the gate reproduces exactly what it hands the loop: one text
  // block carrying the single ephemeral breakpoint.
  const system = [{ type: 'text', text: 'SYSTEM PROMPT UNDER TEST', cache_control: { type: 'ephemeral' } }];
  const script = [say(`${TARGET_UNIT} [[1]]`)];

  const wire = installWire({ records: [MATCHING_SERVICE], script });
  let injected;
  try {
    const options = baseOptions({
      question: MATCHING_QUESTION, storedRuntime: 'STORED_FIQH', lexicalRoute: 'DEEN',
      mode: 'standard', fetchImpl: wire.fetchImpl,
    });
    options.system = system;
    await loop.runFreeBrainTurn(options);
    injected = JSON.parse(wire.providerBodies[0]);
  } finally { wire.restore(); }

  const wire2 = installWire({ records: [MATCHING_SERVICE], script });
  let plain;
  try {
    const options = baseOptions({
      question: MATCHING_QUESTION, storedRuntime: 'GENERAL', lexicalRoute: 'GEN',
      mode: 'standard', fetchImpl: wire2.fetchImpl,
    });
    options.system = system;
    await loop.runFreeBrainTurn(options);
    plain = JSON.parse(wire2.providerBodies[0]);
  } finally { wire2.restore(); }

  const paths = cacheControlPaths(injected);
  check('CACHE', 'exactly-one-breakpoint', paths.length === 1, `paths = ${JSONS(paths)}`);
  check('CACHE', 'breakpoint-on-last-system-block', paths[0] === `$.system[${injected.system.length - 1}]`,
    `at ${JSONS(paths[0])}, system length ${injected.system.length}`);
  check('CACHE', 'system-bytes-unmoved', JSONS(injected.system) === JSONS(plain.system),
    `injected=${sha256(JSONS(injected.system)).slice(0, 16)} plain=${sha256(JSONS(plain.system)).slice(0, 16)}`);
  check('CACHE', 'no-breakpoint-in-messages', cacheControlPaths(injected.messages).length === 0,
    JSONS(cacheControlPaths(injected.messages)));
  return {
    paths,
    systemSha: sha256(JSONS(injected.system)),
    plainSystemSha: sha256(JSONS(plain.system)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CEILING and COUNTER
// ═══════════════════════════════════════════════════════════════════════════
async function ceilingAndCounter(loop) {
  // Nine admissible rows on the wire. The fatwa service itself returns at most four, and
  // ./tools.js cuts to MAX_RESULTS_PER_CALL after that; the point of asking for nine is that no
  // number above the ceiling may ever reach the model, whatever the layer below returns.
  const many = Array.from({ length: 9 }, (_, i) => serviceRecord({
    scholarId: 'binbaz',
    id: `9${i}`,
    title: `صيام يوم عرفة لغير الحاج ${i}`,
    question: 'ما حكم صيام يوم عرفة لغير الحاج؟',
    answer: 'صيام يوم عرفة لغير الحاج مستحب وهو من السنة المؤكدة.',
    path: `/fatwas/9${i}`,
  }));
  const run = await runTurn(loop, {
    question: MATCHING_QUESTION, storedRuntime: 'STORED_FIQH', lexicalRoute: 'DEEN',
    records: many, script: [say('جوابٌ بلا استشهاد.')],
  });
  check('CEILING', 'rows-at-or-under-the-ceiling', run.out.storedInjection.rows <= loop.STORED_INJECTION_MAX_ROWS,
    `rows=${run.out.storedInjection.rows} ceiling=${loop.STORED_INJECTION_MAX_ROWS}`);
  const offered = userBlocks(firstBody(run))[1] || '';
  const markers = (offered.match(/\[\[\d+\]\]/gu) || []).length;
  check('CEILING', 'markers-match-the-count', markers === run.out.storedInjection.rows,
    `markers=${markers} rows=${run.out.storedInjection.rows}`);
  check('CEILING', 'markers-at-or-under-the-ceiling', markers <= loop.STORED_INJECTION_MAX_ROWS,
    `markers=${markers}`);

  // COUNTER — one line per event, and each must be reachable and each must stay put.
  check('COUNTER', 'fired-with-rows', run.out.storedInjection.fired === true && run.out.storedInjection.rows > 0,
    JSONS(run.out.storedInjection));
  check('COUNTER', 'cited-zero-when-nothing-cited', run.out.storedInjection.cited === 0,
    JSONS(run.out.storedInjection));

  // Fired, but the corpus held nothing: the call happened, so `fired` moves; no row arrived, so
  // `rows` does not. This is the pair that makes «offered nothing» and «never offered» different
  // events in the log.
  const empty = await runTurn(loop, {
    question: MATCHING_QUESTION, storedRuntime: 'STORED_FIQH', lexicalRoute: 'DEEN',
    records: [], script: [say('جوابٌ بلا استشهاد.')],
  });
  check('COUNTER', 'fired-without-rows', empty.out.storedInjection.fired === true
    && empty.out.storedInjection.rows === 0 && empty.out.storedInjection.reason === 'no_rows',
    JSONS(empty.out.storedInjection));

  // And the spend row is labelled, so a call the model never asked for is never read as one it did.
  const spend = run.out.spend.filter((s) => s.tool === 'search_fatawa');
  check('COUNTER', 'spend-row-labelled', spend.length === 1 && spend[0].injected === true, JSONS(spend));
}

// ═══════════════════════════════════════════════════════════════════════════
// the run
// ═══════════════════════════════════════════════════════════════════════════
function writeBaseline() {
  if (existsSync(BASELINE)) throw new Error(`refusing to overwrite ${BASELINE}`);
  const source = execFileSync('git', ['--no-pager', 'show', 'origin/main:lib/free-brain/loop.js'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(BASELINE, source);
  return source;
}

async function main() {
  const json = process.argv.includes('--json');
  let cacheEvidence = null;
  const baselineSource = writeBaseline();
  try {
    const loop = await import(`file://${LOOP.replace(/\\/gu, '/')}`);
    const baseline = await import(`file://${BASELINE.replace(/\\/gu, '/')}`);
    await neighbour(loop);
    await liveness(loop);
    await parity(loop);
    await general(loop, baseline);
    cacheEvidence = await cache(loop);
    await ceilingAndCounter(loop);
  } finally {
    rmSync(BASELINE, { force: true });
  }

  if (json) {
    process.stdout.write(JSON.stringify({ failures, results }));
    process.exit(failures ? 1 : 0);
  }

  const groups = [...new Set(results.map((r) => r.group))];
  for (const group of groups) {
    const rows = results.filter((r) => r.group === group);
    const bad = rows.filter((r) => !r.ok);
    report(`${group.padEnd(10)} ${String(rows.length).padStart(3)} checks  ${bad.length ? `FAIL ${bad.length}` : 'PASS'}`);
    for (const row of bad) report(`   ✗ ${row.name} — ${row.detail}`);
  }
  report('');
  report('MEASURED, NOT ASSERTED — the card path, which §١/٤ freezes');
  report(`  the neighbouring row became a reader card in ${neighbourCards}/${neighbourCardTrials} neighbour trials,`);
  report('  on sentences the reviewer had already stripped the attribution from.');
  report('  IDENTICAL when the model requested that row itself — see PARITY/neighbour/cards.');
  report('');
  report('CACHE EVIDENCE');
  report(`  breakpoint path      ${JSONS(cacheEvidence.paths)}`);
  report(`  system sha (offered) ${cacheEvidence.systemSha}`);
  report(`  system sha (plain)   ${cacheEvidence.plainSystemSha}`);
  report(`  baseline loop.js     origin/main, ${Buffer.byteLength(baselineSource)} bytes`);
  report('');
  report(`=== STORED-INJECTION GATE: ${results.length - failures}/${results.length} ${failures ? 'FAIL' : 'PASS'} ===`);
  process.exit(failures ? 1 : 0);
}

// ── mutants ─────────────────────────────────────────────────────────────────
const MUTANTS = [
  {
    name: 'always-inject',
    why: 'the deterministic key stops deciding — every turn is offered the corpus',
    file: LOOP,
    from: "  return lexicalRoute === 'DEEN' && STORED_INJECTION_RUNTIMES.includes(String(storedRuntime || ''));",
    to: '  return true;',
    expect: 'GENERAL',
  },
  {
    // MEASURED AND SAID PLAINLY: the ceiling cannot be caught by RAISING it. lib/fatwa-service.js
    // returns at most FOUR records and ./tools.js cuts to five, so five is above the supply and a
    // mutant that moves it to ninety-nine changes not one byte on the wire. What IS provable is
    // that the constant is READ and that the cut is on the live path — so the mutant lowers it,
    // and the offer disappears. The upper direction is honestly unmeasured, and the report says so.
    name: 'ceiling-closed',
    why: 'the cut is not on the live path at all — the constant is decoration',
    file: LOOP,
    from: 'export const STORED_INJECTION_MAX_ROWS = MAX_RESULTS_PER_CALL;',
    to: 'export const STORED_INJECTION_MAX_ROWS = 0;',
    expect: 'LIVENESS',
  },
  {
    name: 'counter-fires-blind',
    why: 'the counter moves for a call that was never made',
    file: LOOP,
    from: "    storedInjection.reason = 'not_stored_fiqh';",
    to: "    storedInjection.reason = 'not_stored_fiqh'; storedInjection.fired = true;",
    expect: 'GENERAL',
  },
  {
    name: 'cache-on-message',
    why: 'the breakpoint moves onto the injected block',
    file: LOOP,
    from: "  return { ...message, content: [...content, { type: 'text', text: note }] };",
    to: "  return { ...message, content: [...content, { type: 'text', text: note, cache_control: { type: 'ephemeral' } }] };",
    expect: 'CACHE',
  },
  {
    name: 'note-dropped',
    why: 'the rows arrive with no word that they are candidates rather than an order',
    file: LOOP,
    from: '  const note = `${STORED_INJECTION_NOTE}\\n\\n${rendered}`;',
    to: '  const note = `${rendered}`;',
    expect: 'LIVENESS',
  },
  {
    name: 'offer-without-markers',
    why: 'the offered rows arrive in a shape the requested ones never take, so the model cannot cite what it was shown',
    file: LOOP,
    from: '        conversation[last] = withCandidateEvidence(conversation[last], renderEvidenceRows(rows));',
    to: '        conversation[last] = withCandidateEvidence(conversation[last], renderEvidenceRows(rows).split(String.fromCharCode(10)).slice(1).join(String.fromCharCode(10)));',
    expect: 'PARITY',
  },
  {
    name: 'cross-mas-ala-support',
    why: 'the composite gate loosens and a neighbouring page starts backing its neighbour',
    file: REVIEWER,
    from: '  if (overlap < Math.min(2, claimTokens.length)) return false;',
    to: '  if (overlap < 1) return false;',
    expect: 'NEIGHBOUR',
  },
  {
    name: 'hold-everything',
    why: 'nothing is ever supported — NEIGHBOUR passes perfectly and the feature is deleted',
    file: REVIEWER,
    from: '  return evidence.find((item) => sameAuthority(attribution.claimed, item.scholar)',
    to: '  return null && evidence.find((item) => sameAuthority(attribution.claimed, item.scholar)',
    expect: 'LIVENESS',
  },
];

const INNOCENT = {
  name: 'innocent-comment',
  why: 'a change that alters no behaviour must break nothing — the reverse witness',
  file: LOOP,
  from: 'export const STORED_INJECTION_MAX_ROWS = MAX_RESULTS_PER_CALL;',
  to: '// a comment that says nothing\nexport const STORED_INJECTION_MAX_ROWS = MAX_RESULTS_PER_CALL;',
  expect: null,
};

function runChild() {
  try {
    const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, report: JSON.parse(out) };
  } catch (error) {
    const stdout = String(error.stdout || '');
    try { return { ok: true, report: JSON.parse(stdout) }; } catch { /* not a report */ }
    return { ok: false, detail: String(error.stderr || error.message).split('\n').slice(0, 4).join(' | ') };
  }
}

function selftest() {
  const all = [...MUTANTS, INNOCENT];
  let broken = 0;
  let missed = 0;
  report('=== SELFTEST: each mutant must be caught, and the innocent one must not be ===\n');
  for (const mutant of all) {
    const original = readFileSync(mutant.file, 'utf8');
    let verdict;
    let detail = '';
    if (!original.includes(mutant.from)) {
      verdict = 'BROKEN';
      detail = 'anchor text not present — the mutant did not build';
    } else {
      const mutated = original.replace(mutant.from, mutant.to);
      if (mutated === original) {
        verdict = 'BROKEN';
        detail = 'replacement changed nothing';
      } else {
        writeFileSync(mutant.file, mutated);
        try {
          const onDisk = readFileSync(mutant.file, 'utf8');
          if (onDisk === original) {
            verdict = 'BROKEN';
            detail = 'file on disk is unchanged after the write';
          } else {
            const run = runChild();
            if (!run.ok) {
              verdict = 'BROKEN';
              detail = `the mutated tree would not run: ${run.detail}`;
            } else if (mutant.expect === null) {
              verdict = run.report.failures === 0 ? 'CLEAN' : 'FALSE-ALARM';
              detail = run.report.failures === 0 ? 'nothing failed, as required'
                : run.report.results.filter((r) => !r.ok).map((r) => `${r.group}/${r.name}`).join(', ');
            } else {
              const failed = run.report.results.filter((r) => !r.ok);
              const hit = failed.filter((r) => r.group === mutant.expect);
              verdict = hit.length ? 'CAUGHT' : 'MISSED';
              detail = failed.length
                ? `${failed.length} checks failed (${[...new Set(failed.map((r) => r.group))].join('+')})`
                : 'nothing failed';
            }
          }
        } finally {
          writeFileSync(mutant.file, original);
        }
      }
    }
    if (verdict === 'BROKEN') broken += 1;
    if (verdict === 'MISSED' || verdict === 'FALSE-ALARM') missed += 1;
    report(`${verdict.padEnd(12)} ${mutant.name.padEnd(24)} ${detail}`);
    report(`             ${mutant.why}`);
  }
  report('');
  const ok = broken === 0 && missed === 0;
  report(`=== SELFTEST: ${all.length - broken - missed}/${all.length} ${ok ? 'PASS' : `FAIL (broken=${broken} missed=${missed})`} ===`);
  process.exit(ok ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest();
else await main();
