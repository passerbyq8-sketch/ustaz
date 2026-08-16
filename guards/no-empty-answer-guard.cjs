// guards/no-empty-answer-guard.cjs — the reviewer may cut, but may never annihilate an answer.
//
// SECTION A is branch ب's original: the pure module never returns an empty string.
//
// SECTION B is the merge round's addition, and it is the one that matters now that the reviewer is
// actually wired. §٢/٢ of the merge order: «كلُّ مخرجٍ يمرُّ به، لا المسارُ السعيدُ وحدَه» — EVERY
// exit from lib/free-brain/loop.js passes the reviewer, not only the happy path. A contract proved
// on the module in isolation says nothing about the seven ways a turn can end.
//
// WHAT SECTION B FOUND WHEN IT WAS FIRST RUN. Two exits left the function without ever reaching
// the reviewer: a provider error in a tool round, and a provider error in the tools-removed write.
// Both propagated out of `runFreeBrainTurn`, so api/ask.js's outer catch wrote an SSE error frame —
// no review, no evidence, no telemetry. They are E5 and E6 below and they now fall through to the
// same tail as everything else.
//
// Offline and deterministic: the provider is a scripted stub keyed on its own URL, and any other
// host throws. That last detail is measured, not decorative — an earlier draft let the fatwa
// service's own fetch consume scripted provider rounds, which silently turned the six-round
// `rounds_exhausted` case into a two-round turn that proved nothing.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const SEAM = path.join(ROOT, 'lib', 'free-brain', 'review.js');
const { ok, finish } = harness('no-empty-answer');

const samples = Object.freeze([
  { text: 'قال ابن باز إن الجمع للمسافر جائز.', evidence: [], domain: 'fiqh', mode: 'عادي' },
  { text: 'الحكم في هذه المسألة واجب بلا خلاف.', evidence: [], domain: 'fiqh', mode: 'مفصّل' },
  { text: 'درجة الحرارة اليوم 38 مئوية.', evidence: [], domain: 'general', mode: 'موجز' },
  { text: 'ناتج اثنين زائد اثنين أربعة.', evidence: [], domain: 'general', mode: 'موجز' },
]);
const neverEmpty = (module) => samples.every((sample) => module.reviewAnswer(sample).text.trim().length > 0);

// ── SECTION B MECHANICS ─────────────────────────────────────────────────────
// A copy of the loop in os.tmpdir() cannot resolve './tools.js', so relative specifiers are
// rewritten to absolute file URLs pointing back at the real tree. Only the file under mutation
// moves; everything it imports stays where it is.
function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

const PROVIDER = 'https://stub.invalid/v1/messages';
const BASE = {
  messages: [{ role: 'user', content: 'ما حكم الجمع للمسافر؟' }],
  system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
  mode: 'عادي', lexicalRoute: 'DEEN', providerUrl: PROVIDER, headers: {},
};
const textPayload = (text) => ({ stop_reason: 'end_turn', content: text ? [{ type: 'text', text }] : [] });
const toolPayload = (id) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'search_fatawa', input: { query: 'الجمع للمسافر' } }],
});

// The seven ways this turn can end. `deadline` runs the tool phase against a 1ms clock.
const EXITS = Object.freeze([
  { id: 'E1', label: 'the model wrote prose', script: () => textPayload('الجمع للمسافر جائز عند الحاجة.') },
  {
    id: 'E2',
    label: 'the rounds ran out',
    script: (i) => (i < 6 ? toolPayload('t' + i) : textPayload('كتبتُ من غير أدوات.')),
    expectDegraded: 'rounds_exhausted',
  },
  {
    id: 'E3',
    label: 'the tool-phase clock ran out',
    deadline: true,
    script: (i) => (i === 0 ? toolPayload('t0') : textPayload('كتبتُ بعد انتهاء المهلة.')),
    expectDegraded: 'deadline_write',
  },
  {
    id: 'E4',
    label: 'the model emitted no text block',
    script: (i) => (i === 0 ? textPayload('') : textPayload('الجواب في المحاولة الثانية.')),
    expectDegraded: 'write_after_empty_first_answer',
  },
  {
    id: 'E5',
    label: "a tool round's provider call threw",
    script: (i) => (i === 0 ? Object.assign(new Error('upstream 529'), { status: 529 })
      : textPayload('كتبتُ رغم فشل جولة الأدوات.')),
    expectDegraded: 'write_after_tool_phase_failure',
    expectFailure: /^provider_error_tool_phase:529:/u,
  },
  {
    id: 'E6',
    label: "the final write's provider call threw too",
    script: () => Object.assign(new Error('upstream 401'), { status: 401 }),
    expectFailure: /^provider_error_write:401:/u,
    expectLastResort: true,
  },
  {
    id: 'E7',
    label: 'no model text survived any call',
    script: () => textPayload(''),
    expectLastResort: true,
  },
]);

async function driveExits(loopModule, lastResort) {
  const realFetch = globalThis.fetch;
  const out = [];
  try {
    for (const exit of EXITS) {
      let n = 0;
      globalThis.fetch = async (input) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        const step = exit.script(n++);
        // THE CLOCK HAS TO ACTUALLY MOVE. `Date.now()` on Windows advances in ~1–16ms ticks, and
        // a fully stubbed round completes inside one of them — so a 1ms deadline measured 0ms
        // elapsed, the loop ran a second round, and E3 quietly stopped testing the deadline at
        // all while still passing every other assertion. Measured, not guessed.
        if (exit.deadline) await new Promise((resolve) => { setTimeout(resolve, 25); });
        if (step instanceof Error) throw step;
        return { ok: true, status: 200, json: async () => step };
      };
      if (exit.deadline) process.env.FREE_BRAIN_TOOL_PHASE_MS = '1';
      else delete process.env.FREE_BRAIN_TOOL_PHASE_MS;
      let turn = null;
      let threw = null;
      try { turn = await loopModule.runFreeBrainTurn({ ...BASE }); } catch (error) { threw = String(error?.message || error); }
      out.push({
        exit,
        threw,
        turn,
        reviewed: Boolean(turn && turn.verdict && turn.verdict !== 'unreviewed'),
        nonEmpty: Boolean(turn && typeof turn.text === 'string' && turn.text.trim().length > 0),
        isLastResort: Boolean(turn && turn.text === lastResort),
      });
    }
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.FREE_BRAIN_TOOL_PHASE_MS;
  }
  return out;
}

// The property both Section B mutants are measured against: every exit reaches the reviewer AND
// hands the reader a non-empty string.
const everyExitReviewed = (results) => results.every((r) => !r.threw && r.reviewed && r.nonEmpty);

(async () => {
  try {
    // ── A. the pure module ──────────────────────────────────────────────────
    const module = await fresh(REVIEWER, 'nonempty-base');
    ok('every non-empty proposal yields non-empty reviewed text', neverEmpty(module));
    const noInput = module.reviewAnswer({ text: '', evidence: [], domain: 'fiqh', mode: 'عادي' });
    ok('even absent input lands on the explicit final rung',
      noInput.text === module.REVIEW_LAST_RESORT && noInput.verdict.usedLastResort === true, noInput.text);

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'reviewer-cuts-everything',
      transform: (source) => source.replace(
        "const reviewedText = output.join('\\n').trim() || LAST_RESORT;",
        "const reviewedText = ''; // mutant: trim every sentence and suppress the last rung"),
      survives: neverEmpty,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: a reviewer that cuts every sentence cannot return success',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));

    // ── B. the seam is wired to a file that exists ──────────────────────────
    const seamSource = fs.readFileSync(SEAM, 'utf8');
    const declared = /REVIEWER_MODULE = '([^']+)'/u.exec(seamSource)?.[1] || '';
    ok('the seam names a reviewer module', Boolean(declared), seamSource.slice(0, 120));
    ok('...and that module exists in this tree',
      declared && fs.existsSync(path.resolve(path.dirname(SEAM), declared)), declared);
    ok('...and it is imported statically, so a wrong path fails loudly instead of passing through',
      /^import \{ reviewAnswer as reviewAnswerPure \} from '\.\.\/output-reviewer\.js';$/mu.test(seamSource),
      'the seam still resolves its reviewer lazily, which is how a mistyped path stayed silent');

    // ── C. every exit from the loop passes the reviewer ─────────────────────
    const loop = await fresh(LOOP, 'loop-base');
    const results = await driveExits(loop, module.REVIEW_LAST_RESORT);
    for (const r of results) {
      ok(`${r.exit.id} ${r.exit.label}: the turn returns rather than throwing`, !r.threw, String(r.threw));
      ok(`${r.exit.id} ${r.exit.label}: the reviewer was reached (verdict is not "unreviewed")`,
        r.reviewed, JSON.stringify(r.turn?.verdict ?? null).slice(0, 160));
      ok(`${r.exit.id} ${r.exit.label}: the reader text is not empty`,
        r.nonEmpty, JSON.stringify(r.turn?.text ?? null));
      if (r.exit.expectDegraded) {
        ok(`${r.exit.id} ${r.exit.label}: the exit is named in degraded as "${r.exit.expectDegraded}"`,
          (r.turn?.degraded || []).includes(r.exit.expectDegraded), JSON.stringify(r.turn?.degraded));
      }
      if (r.exit.expectFailure) {
        ok(`${r.exit.id} ${r.exit.label}: the upstream failure is reported, not swallowed`,
          r.exit.expectFailure.test(String(r.turn?.failure || '')), String(r.turn?.failure));
      }
      if (r.exit.expectLastResort) {
        ok(`${r.exit.id} ${r.exit.label}: with no model text the reader gets the explicit last rung`,
          r.isLastResort, JSON.stringify(r.turn?.text ?? null));
      }
    }
    ok('ALL EXITS: the reviewer is reached from every one of them', everyExitReviewed(results),
      JSON.stringify(results.map((r) => [r.exit.id, r.reviewed, r.nonEmpty, r.threw])));

    // ── D. the two mutants that restore the pre-merge behaviour ─────────────
    async function loopMutant(name, transform) {
      const original = fs.readFileSync(LOOP, 'utf8');
      const changed = transform(original);
      if (changed === original) return { changed: false, loaded: false, survived: null, error: 'seam moved' };
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-freebrain-exit-mutant-'));
      const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
      fs.writeFileSync(twin, importsFromTree(changed, LOOP), 'utf8');
      try {
        const twinModule = await fresh(twin, name);
        const twinResults = await driveExits(twinModule, module.REVIEW_LAST_RESORT);
        return { changed: true, loaded: true, survived: everyExitReviewed(twinResults), error: null };
      } catch (error) {
        return { changed: true, loaded: false, survived: null, error: error?.stack || String(error) };
      } finally {
        fs.rmSync(temp, { recursive: true, force: true });
      }
    }

    // M1 — the reviewer runs and its text is thrown away. This is the pre-merge shape with the
    // path corrected: a checker that looked and whose verdict nobody delivered.
    // NOTE ON LINE ENDINGS: this working tree checks out CRLF, so every seam below matches on
    // `\r?\n` rather than a literal newline. A seam written with `\n` reports «seam moved» on
    // Windows and «MUTANT KILLED» on nothing at all.
    const shownMutant = await loopMutant('reviewed-text-discarded',
      (source) => source.replace(/^ {4}text: reviewed\.text,$/mu, '    text: readerText,'));
    ok('shown-text mutant seam applied', shownMutant.changed, shownMutant.error);
    ok('shown-text mutant module loaded successfully', shownMutant.loaded, shownMutant.error);
    ok('MUTANT KILLED: showing the draft instead of the reviewed text cannot pass',
      shownMutant.loaded && shownMutant.survived === false, JSON.stringify(shownMutant));

    // M2 — the write's provider error escapes again, exactly as it did before the merge round.
    const throwMutant = await loopMutant('write-error-escapes-the-turn',
      (source) => source.replace(
        /^ {6}failure = `provider_error_write:.*`;\r?\n {6}ctx\.degraded\.push\(failure\);$/mu,
        '      throw error; // mutant: the pre-merge behaviour — one exit that never met the reviewer'));
    ok('escaping-error mutant seam applied', throwMutant.changed, throwMutant.error);
    ok('escaping-error mutant module loaded successfully', throwMutant.loaded, throwMutant.error);
    ok('MUTANT KILLED: an exit that throws past the reviewer cannot pass',
      throwMutant.loaded && throwMutant.survived === false, JSON.stringify(throwMutant));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
