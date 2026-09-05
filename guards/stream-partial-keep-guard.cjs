// guards/stream-partial-keep-guard.cjs
// A TURN THAT ALREADY SPOKE MAY NOT BE ERASED BY ITS OWN FAILURE.
//
// -- THE DEFECT THIS CLOSES, WITNESSED TWICE ON THE LIVE SITE ---------------------------------
// The reader pressed the continue button. The assistant began streaming and about five lines of
// Arabic prose stood on the screen. The stream then stopped -- and the client did not keep what
// had arrived. It ERASED every visible line and replaced the whole turn with its friendly
// connection sentence. A later attempt of the same action succeeded, so the failure is
// intermittent and the loss was total: the reader kept nothing of what he had watched being
// written.
//
// The cause was one variable's scope and two early returns. Everything that had arrived lived in
// a local `full` declared BESIDE the SSE reader, inside the try block whose catch is the network
// exit; and both failure exits -- the mid-stream `error` event and the thrown read -- returned a
// sentence from FRIENDLY_ERRORS INSTEAD of it. Nothing anywhere else held a copy: the live
// preview is React state that the same turn sets to null, and the only durable write before the
// reply is the one that files the QUESTION.
//
// -- WHAT IS REQUIRED NOW ---------------------------------------------------------------------
//   1. Text that reached the reader is the reader's. A turn that fails after one character has
//      been delivered returns every character it delivered.
//   2. It is marked unfinished through the mechanism that already exists for a truncated answer:
//      the `<incomplete>` marker. That is what draws the red notice and the continue button, so
//      the reader is offered the same way out of a broken stream as out of a stopped model.
//   3. The failure is still said out loud, as its own line, in the wording that already existed.
//   4. AND WITH NOTHING DELIVERED, NOTHING CHANGES. An empty turn still answers with the
//      sentence alone, from the same bucket, byte for byte.
//
// -- HOW THIS GUARD PROVES IT, AND WHY IT DOES NOT MERELY READ THE SOURCE ----------------------
// A guard that greps for `if (full) return ...` proves that a string is present. It cannot tell
// whether the bytes come back. So this file EXTRACTS THE SHIPPED EXIT CODE ITSELF -- the region
// of the client from the request body builder down to the last line of the catch -- and RUNS it,
// against a stubbed fetch whose stream delivers real deltas and then breaks in each of the ways
// production breaks. What is asserted is what the reader is handed.
//
// The marker helpers are extracted and run too, so the questions "is this reported unfinished?",
// "which failure was it?" and "does the marker ever reach a reader?" are answered by the shipped
// implementations rather than by this file's opinion of them.
//
// Section A is the both-ways proof. Six named MUTANTS restore the old behaviour, one aspect at a
// time, and each must make the named check FAIL. A guard nobody has watched fail is a guard that
// passes on everything. Section B is the shipped tree, which must pass all of them.
//
// Usage: node guards/stream-partial-keep-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const BB = require(path.join(REPO, 'tools', 'babel-block.cjs'));

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

// -- THE SLICES --------------------------------------------------------------------------------
// Anchored on source TEXT, never on line numbers, and every one of them is required: a missing
// anchor raises rather than yielding an empty string, because a harness that silently measured
// nothing would report a clean tree forever.
const EXIT_START = "if (FAST_CHANNEL_ENABLED && mode === 'call' && (await __classifyFast()) === 'GEN') {";
const EXIT_END = "return getFriendlyError('network', p.gender);\n    }";

function sliceExit(source) {
  const a = source.indexOf(EXIT_START);
  if (a < 0) throw new Error('cannot locate the route anchor: ' + EXIT_START);
  const b = source.indexOf(EXIT_END);
  if (b < 0) throw new Error('cannot locate the network-exit anchor');
  return source.slice(a, b + EXIT_END.length);
}

function sliceDecl(source, startAnchor, endAnchor) {
  const a = source.indexOf(startAnchor);
  if (a < 0) throw new Error('cannot locate ' + startAnchor);
  const b = source.indexOf(endAnchor, a);
  if (b < 0) throw new Error('cannot locate the close of ' + startAnchor);
  return source.slice(a, b + endAnchor.length);
}

// The four declarations the reader side needs, taken out of the same source under test so a
// mutant that narrows one of them is measured rather than assumed away.
// A TREE WITHOUT THE REPAIR MUST STILL BE MEASURABLE. Run against the shipped-before client the
// two cut helpers simply do not exist, and a harness that threw on that would report the defect
// as a crash -- true, but it would name nothing. Stand-ins are supplied instead, so every
// behavioural check below runs and goes red for the reason it is actually about, and the absence
// itself is reported as its own named check.
function buildHelpers(source) {
  const hasCutFamily = source.indexOf('const ezikCutMark = ') !== -1
    && source.indexOf('const ezikAnswerCutReason = ') !== -1;
  const stand = hasCutFamily ? [] : [
    'var ezikCutMark = function () { return \'\'; };',
    'var ezikAnswerCutReason = function () { return null; };',
  ];
  const src = [
    sliceDecl(source, 'const FRIENDLY_ERRORS = {', '\n};'),
    sliceDecl(source, 'const getFriendlyError = (type, gender) => {', '\n};'),
    // ONE slice, and it reaches to the close of `ezikAnswerCutReason`: every declaration between
    // the strip regexp and that function is a one-liner, so the first `\n};` below the anchor is
    // that function's own close and the whole marker family comes across together.
    sliceDecl(source, 'const EZIK_INCOMPLETE_STRIP =', '\n};'),
    stand.join('\n'),
    'return { FRIENDLY_ERRORS, getFriendlyError, ezikStripIncomplete, ezikAnswerIncomplete,',
    '  ezikCutMark, ezikAnswerCutReason };',
  ].join('\n');
  const h = new Function(src)();
  h.hasCutFamily = hasCutFamily;
  return h;
}

// The shipped exit code, wrapped so it can be called. The slice runs from the declaration that
// holds what has arrived, through the whole try/catch, to the last line of the catch -- so the
// SCOPE of that declaration is inside what is measured rather than assumed by the wrapper. That
// matters more than it looks: `let` is block-scoped, a catch is its own block, and a version of
// this repair that declared it one line lower inside the try read as done and discarded
// everything. This harness is what caught that, before the tree was committed.
function buildExit(source) {
  const body = [
    '"use strict";',
    'return (async function (deps) {',
    '  const { mode, endpoint, aiFetch, capHeaders, signal, p, onDelta, depthMode, deriveCaps,',
    '    FAST_CHANNEL_ENABLED, __classifyFast,',
    '    getFriendlyError, ezikCutMark, fitMessagesToBudget, history } = deps;',
    sliceExit(source),
    '});',
  ].join('\n');
  return new Function(body)();
}

// -- THE STUBBED STREAM ------------------------------------------------------------------------
// `steps` is played in order. A string is an SSE frame; the literal END closes the stream cleanly;
// the literal BREAK rejects the read the way a dropped socket, a TLS reset or a closed edge
// response does.
const ENC = new TextEncoder();
function stubFetch(steps, status) {
  return async function () {
    if (status && status !== 200) {
      return { ok: false, status: status, text: async () => '{}' };
    }
    let i = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            read() {
              if (i >= steps.length) return Promise.resolve({ done: true, value: undefined });
              const step = steps[i]; i += 1;
              if (step === 'BREAK') return Promise.reject(new TypeError('network error'));
              if (step === 'END') return Promise.resolve({ done: true, value: undefined });
              return Promise.resolve({ done: false, value: ENC.encode(step) });
            },
          };
        },
      },
    };
  };
}

const frame = (obj) => 'data: ' + JSON.stringify(obj) + '\n\n';
const delta = (text) => frame({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
const errorFrame = (message) => frame({ type: 'error', error: { message } });

// The five lines the owner watched, in the language they were written in.
const LINE_1 = 'الحمدلله رب العالمين، ';
const LINE_2 = 'وبعد: فإنّ الصلاة عمود الدين، ';
const LINE_3 = 'وهي أول ما يُحاسب عليه العبد';
const DELIVERED = LINE_1 + LINE_2 + LINE_3;

async function runScenario(exit, helpers, steps, status) {
  const seen = [];
  const deps = {
    mode: 'chat',
    depthMode: 'brief',
    FAST_CHANNEL_ENABLED: false,
    __classifyFast: async () => 'DEEN',
    deriveCaps: () => ({ band: 'adult' }),
    endpoint: '/api/ask',
    aiFetch: stubFetch(steps, status),
    capHeaders: () => ({}),
    signal: undefined,
    p: { name: 'x', age: 30, gender: 'male' },
    onDelta: (partial) => seen.push(partial),
    getFriendlyError: helpers.getFriendlyError,
    ezikCutMark: helpers.ezikCutMark,
    fitMessagesToBudget: (mk, msgs) => msgs,
    history: [{ role: 'user', content: 'q' }],
  };
  // The shipped code logs every failure for a parent reading devtools, and that is right there
  // and wrong here: thirty scenarios would bury the gate's own output in stack traces. The
  // writes are captured rather than discarded, so a scenario that logged nothing at all is still
  // visible to anyone who looks.
  const realError = console.error;
  const logged = [];
  console.error = (...a) => { logged.push(a.map(String).join(' ')); };
  try {
    return { reply: await exit(deps), seen, logged, threw: null };
  } catch (e) {
    return { reply: null, seen, logged, threw: String(e && e.message || e) };
  } finally {
    console.error = realError;
  }
}

// -- THE CHECKS --------------------------------------------------------------------------------
// One list, run against the shipped source and against every mutant, so section A and section B
// are literally the same questions asked of different trees.
async function measure(source) {
  const helpers = buildHelpers(source);
  const exit = buildExit(source);
  const partial = [delta(LINE_1), delta(LINE_2), delta(LINE_3)];
  const out = {};
  out.cutNetwork = await runScenario(exit, helpers, partial.concat(['BREAK']));
  out.cutServer = await runScenario(exit, helpers, partial.concat([errorFrame('server error'), 'END']));
  out.cutRate = await runScenario(exit, helpers, partial.concat([errorFrame('overloaded_error'), 'END']));
  out.emptyNetwork = await runScenario(exit, helpers, ['BREAK']);
  out.emptyServer = await runScenario(exit, helpers, [errorFrame('server error'), 'END']);
  out.clean = await runScenario(exit, helpers, partial.concat(['END']));
  out.refused = await runScenario(exit, helpers, [], 500);
  return { helpers, out };
}

const MALE_NETWORK = 'network';
function results(m) {
  const h = m.helpers;
  const o = m.out;
  const G = (bucket) => h.getFriendlyError(bucket, 'male');
  const r = [];
  const add = (id, name, cond, detail) => r.push({ id, name, ok: !!cond, detail: detail || '' });

  // 0 -- THE CLIENT HAS A MARK FOR A TURN ITS OWN TRANSPORT CUT. Named on its own because a tree
  //      that lacks it lacks everything below, and a reader of this output deserves to be told
  //      that once rather than to infer it from twelve consequences.
  add('cut-family-exists', 'the client has a mark for a turn its own transport cut',
    h.hasCutFamily === true);

  // 1 -- THE WHOLE OF WHAT ARRIVED COMES BACK. Not a prefix of it, not a summary of it.
  add('keeps-network', 'a broken read returns every character that had been delivered',
    typeof o.cutNetwork.reply === 'string' && o.cutNetwork.reply.indexOf(DELIVERED) === 0,
    'threw=' + o.cutNetwork.threw + ' reply=' + JSON.stringify(String(o.cutNetwork.reply).slice(0, 120)));
  add('keeps-stream-error', 'a mid-stream error event returns every character that had been delivered',
    typeof o.cutServer.reply === 'string' && o.cutServer.reply.indexOf(DELIVERED) === 0,
    'threw=' + o.cutServer.threw + ' reply=' + JSON.stringify(String(o.cutServer.reply).slice(0, 120)));

  // 2 -- AND IT IS MARKED THROUGH THE MECHANISM THAT ALREADY DRAWS THE NOTICE AND THE BUTTON.
  add('marked-incomplete', 'the kept answer is reported unfinished by the shipped reader',
    h.ezikAnswerIncomplete(o.cutNetwork.reply) === true
    && h.ezikAnswerIncomplete(o.cutServer.reply) === true,
    JSON.stringify([h.ezikAnswerIncomplete(o.cutNetwork.reply), h.ezikAnswerIncomplete(o.cutServer.reply)]));

  // 3 -- THE FAILURE IS NAMED, AND NAMED IN THE WORDING THAT ALREADY EXISTED.
  add('names-network', 'the kept answer carries the network failure, in the unchanged wording',
    h.ezikAnswerCutReason(o.cutNetwork.reply) === MALE_NETWORK
    && G(h.ezikAnswerCutReason(o.cutNetwork.reply)) === G('network'),
    String(h.ezikAnswerCutReason(o.cutNetwork.reply)));
  add('names-server', 'a mid-stream error is carried as the server failure',
    h.ezikAnswerCutReason(o.cutServer.reply) === 'server',
    String(h.ezikAnswerCutReason(o.cutServer.reply)));
  add('names-rate', 'an overloaded upstream is carried as the rate failure, not as the server one',
    h.ezikAnswerCutReason(o.cutRate.reply) === 'rateLimit',
    String(h.ezikAnswerCutReason(o.cutRate.reply)));

  // 4 -- THE MARKER IS BOOKKEEPING AND NEVER PROSE. Both readers strip it, so no reader ever
  //      sees it and it never rides back up to the model as the model's own words.
  const stripped = h.ezikStripIncomplete(o.cutNetwork.reply);
  // `trimEnd` and not `trim`: the mark is written on its own line, exactly as the server writes
  // its own, so removing it leaves the newline that separated it from the prose -- and every
  // reader trims. What must be identical is the ANSWER, to the last character of it.
  add('marker-never-read', 'the marker is stripped out of the text every reader is given',
    stripped.trimEnd() === DELIVERED,
    JSON.stringify(stripped.slice(-80)));
  add('marker-not-prose', 'and no fragment of it survives anywhere in that text',
    stripped.indexOf('incomplete') === -1 && stripped.indexOf('<') === -1,
    JSON.stringify(stripped.slice(-80)));

  // 5 -- NOTHING DELIVERED, NOTHING CHANGED. This is the half that must NOT move, and it is
  //      asserted byte for byte against the same table the shipped client reads.
  add('empty-network-unchanged', 'a turn that delivered nothing still answers with the network sentence alone',
    o.emptyNetwork.reply === G('network'),
    JSON.stringify(String(o.emptyNetwork.reply).slice(0, 120)));
  add('empty-server-unchanged', 'a turn that delivered nothing still answers with the server sentence alone',
    o.emptyServer.reply === G('server'),
    JSON.stringify(String(o.emptyServer.reply).slice(0, 120)));
  add('empty-not-marked', 'and neither of those is marked unfinished or carries a failure name',
    h.ezikAnswerIncomplete(o.emptyNetwork.reply) === false
    && h.ezikAnswerCutReason(o.emptyServer.reply) === null,
    JSON.stringify([h.ezikAnswerIncomplete(o.emptyNetwork.reply), h.ezikAnswerCutReason(o.emptyServer.reply)]));

  // 6 -- AND A TURN THAT SUCCEEDED IS UNTOUCHED.
  add('clean-untouched', 'a stream that completes returns exactly what it delivered, unmarked',
    o.clean.reply === DELIVERED && h.ezikAnswerIncomplete(o.clean.reply) === false,
    JSON.stringify(String(o.clean.reply).slice(-80)));
  add('refused-untouched', 'a non-2xx answer, which streamed nothing, still answers from its own bucket',
    o.refused.reply === G('server'),
    JSON.stringify(String(o.refused.reply).slice(0, 120)));

  // 7 -- THE PREVIEW REALLY RAN. Without this the scenarios above could be passing on a stream
  //      that never delivered a byte, which is the one shape that would make them meaningless.
  add('deltas-were-seen', 'the reader had actually been shown the text before the failure',
    o.cutNetwork.seen.length === 3 && o.cutNetwork.seen[2] === DELIVERED,
    JSON.stringify(o.cutNetwork.seen.length));

  // ...and the failure really was reported to the console the parents read, which is the other
  // half of "do not swallow it" and the half no screen assertion can reach from here.
  add('failure-was-logged', 'the failure is still written to the console a parent can read',
    o.cutNetwork.logged.some((l) => l.indexOf('Network error') !== -1)
    && o.cutServer.logged.some((l) => l.indexOf('Stream error') !== -1),
    JSON.stringify(o.cutNetwork.logged.slice(0, 1)));

  return r;
}

// -- THE MUTANTS -------------------------------------------------------------------------------
// Each restores one aspect of the shipped-before behaviour. `expect` names the checks that MUST
// go red; a mutant that changes nothing is a mutant that was never applied, so the edit itself is
// verified before it is run.
const MUTANTS = [
  {
    name: 'network-exit-discards-what-arrived',
    from: "      if (full) return full + ezikCutMark('network');\n",
    to: '',
    expect: ['keeps-network', 'marked-incomplete', 'names-network'],
  },
  {
    name: 'stream-error-exit-discards-what-arrived',
    from: '        if (full) return full + ezikCutMark(bucket);\n',
    to: '',
    expect: ['keeps-stream-error', 'marked-incomplete', 'names-server', 'names-rate'],
  },
  {
    name: 'full-is-scoped-back-inside-the-try',
    edits: [
      { from: "    let full = '';\n", to: '' },
      { from: "      let buffer = '';", to: "      let buffer = '';\n      let full = '';" },
    ],
    expect: ['keeps-network'],
  },
  {
    name: 'the-mark-is-not-the-incomplete-mark',
    from: 'const ezikCutMark = (bucket) =>',
    to: 'const ezikCutMark = (bucket) => \'\\n<streamcut cut="\' + bucket + \'"/>\'; const ezikCutMarkOld = (bucket) =>',
    expect: ['marked-incomplete'],
  },
  {
    name: 'the-strip-is-narrowed-back-to-the-bare-mark',
    from: 'const EZIK_INCOMPLETE_STRIP = /<incomplete\\b[^>]*>/gi;',
    to: 'const EZIK_INCOMPLETE_STRIP = /<incomplete\\s*\\/?>/gi;',
    expect: ['marker-never-read', 'marker-not-prose'],
  },
  {
    name: 'an-empty-turn-is-marked-too',
    from: "      if (full) return full + ezikCutMark('network');",
    to: "      return full + ezikCutMark('network');",
    expect: ['empty-network-unchanged', 'empty-not-marked'],
  },
];

(async function main() {
  const source = BB.readBabelBlock({ file: path.join(REPO, 'index.html') }).raw;
  console.log('shipped client source: ' + source.length + ' chars');

  console.log('\n=== SECTION A -- THE GUARD IS WATCHED FAILING ===');
  for (const m of MUTANTS) {
    const edits = m.edits || [{ from: m.from, to: m.to }];
    let mutated = source;
    let anchored = true;
    for (const e of edits) {
      if (mutated.indexOf(e.from) === -1) { anchored = false; break; }
      mutated = mutated.replace(e.from, e.to);
    }
    // A mutant that did not apply is a mutant nobody tested, and it would report a clean tree.
    ok('mutant «' + m.name + '» actually changed the source', anchored && mutated !== source);
    if (!anchored) continue;
    let red = [];
    try {
      const r = results(await measure(mutated));
      red = r.filter((x) => !x.ok).map((x) => x.id);
    } catch (e) {
      red = ['<threw: ' + (e && e.message) + '>'];
    }
    const missed = m.expect.filter((id) => red.indexOf(id) === -1);
    ok('  ...and it is caught: ' + m.expect.join(', '), missed.length === 0,
      'red on this mutant: ' + (red.join(', ') || '(nothing)') + '\n        not caught: ' + missed.join(', '));
  }

  console.log('\n=== SECTION B -- THE SHIPPED TREE ===');
  const r = results(await measure(source));
  for (const c of r) ok(c.name, c.ok, c.detail);

  // The line the reader is shown is drawn from the marker and under the same visibility rule as
  // the notice beside it, so neither can appear without the other. Held as a source assertion
  // because this guard runs no browser.
  ok('the failure line is drawn under the same rule as the unfinished notice',
    source.indexOf('{quickActionsVisible && ezikAnswerCutReason(lastMsg.content) && (') !== -1
    && source.indexOf('{quickActionsVisible && ezikAnswerIncomplete(lastMsg.content) && (') !== -1);
  ok('...and its wording comes from getFriendlyError, so not one sentence is new',
    source.indexOf('getFriendlyError(ezikAnswerCutReason(lastMsg.content), profile?.gender)') !== -1);
  ok('...and nothing in this repair retries anything on the reader\'s behalf',
    source.indexOf('ezikCutMark') !== -1
    && /ezikCutMark\(/.test(source)
    && !/setTimeout\([^)]*sendMessage/.test(source));

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('GUARD ERROR: ' + (e && e.stack || e));
  process.exit(2);
});
