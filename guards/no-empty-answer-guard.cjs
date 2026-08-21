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
const INSTRUCTIONS = path.join(ROOT, 'lib', 'free-brain', 'instructions.js');
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
    const instructions = await fresh(INSTRUCTIONS, 'instructions-base');
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

    // ── D. §٢: PROSE WRITTEN IN A TOOL ROUND IS THE READER'S, NOT SCRATCH ────
    //
    // THE LAW THIS INVERTS. Until this round the loop kept the prose of the LAST call only. A
    // round whose `stop_reason` was `tool_use` could carry text blocks beside its tool calls, and
    // those blocks went into the conversation history and reached nobody.
    //
    // MEASURED, on the preview, on the owner's twenty-question message (round ledger, 2026-08-16):
    // rounds 1–3 carried 82, 81 and 883 characters of prose and round 4 carried 3,707. The 1,046
    // that were dropped were not narration filler — the surviving answer OPENED AT «٦.», because
    // questions one through five had already been answered inside the block round 3 discarded.
    //
    // The order matters as much as the presence: an answer assembled out of order is a different
    // defect wearing the same green tick, so it is asserted separately.
    async function driveScript(loopModule, script) {
      const realFetch = globalThis.fetch;
      let n = 0;
      globalThis.fetch = async (input) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        return { ok: true, status: 200, json: async () => script(n++) };
      };
      try { return await loopModule.runFreeBrainTurn({ ...BASE }); }
      finally { globalThis.fetch = realFetch; }
    }

    const withTool = (text, id) => ({
      stop_reason: 'tool_use',
      content: [
        ...(text ? [{ type: 'text', text }] : []),
        { type: 'tool_use', id, name: 'search_fatawa', input: { query: 'الجمع للمسافر' } },
      ],
    });

    const EARLY = 'الجمع للمسافر جائز عند الحاجة.';
    const LATE = 'ومدة المسح للمسافر ثلاثة أيام بلياليها.';
    const carriesBothRounds = async (loopModule) => {
      const turn = await driveScript(loopModule,
        (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(LATE)));
      return typeof turn?.text === 'string'
        && turn.text.includes(EARLY)
        && turn.text.includes(LATE)
        && turn.text.indexOf(EARLY) < turn.text.indexOf(LATE);
    };

    ok('a tool round\'s prose reaches the reader, in the order it was written',
      await carriesBothRounds(loop));

    const ledgerTurn = await driveScript(loop,
      (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(LATE)));
    ok('...and the round ledger records the shape of every call',
      Array.isArray(ledgerTurn.roundLedger) && ledgerTurn.roundLedger.length === 2
        && ledgerTurn.roundLedger[0].textChars === EARLY.length
        && ledgerTurn.roundLedger[0].toolUse === 1
        && ledgerTurn.roundLedger[1].textChars === LATE.length,
      JSON.stringify(ledgerTurn.roundLedger));

    // THE TRAP §٢ NAMES. A last call that REWRITES what an earlier one already said must not be
    // delivered twice — and the longer, complete version is the one that survives.
    const repeatTurn = await driveScript(loop,
      (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(EARLY + ' ' + LATE)));
    ok('a repeated earlier draft is delivered once, not twice',
      repeatTurn.text.split(EARLY).length - 1 === 1, repeatTurn.text);
    ok('...and it is the COMPLETE version that survives the deduplication',
      repeatTurn.text.includes(LATE), repeatTurn.text);

    // A tool round with no prose at all still behaves exactly as it did: nothing to carry, and
    // the write call is what answers.
    const silentTurn = await driveScript(loop,
      (i) => (i < 2 ? withTool('', 't' + i) : textPayload(LATE)));
    ok('a silent tool round adds nothing and changes nothing',
      silentTurn.text.includes(LATE) && !silentTurn.text.includes(EARLY), silentTurn.text);
    // ...and THAT is what an opening like «فالمقدارُ صاعٌ…» is made of. The join emits round 2
    // alone when round 1 said nothing, so a truncated opening after a silent tool round is the
    // model's own first word and not a deletion. Asserted here because §٣'s verdict rests on it.
    ok('...so a silent first round leaves the second round\'s opening untouched, whole',
      silentTurn.text.startsWith(LATE), silentTurn.text);

    // ── E. §٣: THE REMINDER RIDES ON EVERY BATCH, NOT ONLY THE FIRST ─────────
    //
    // WHAT IT IS FOR. Between rounds the model cannot see which of its own prose has already been
    // delivered. Told only «write this round's answer complete», it either writes the whole answer
    // again — question ١٨ of the owner's battery, the same content restated in different words —
    // or carries on from a thought the reader never saw — question ١٦, opening «فالمقدارُ صاعٌ…».
    // Both are answered by two clauses in ROUND_TEXT_REMINDER, and a clause the model does not see
    // on the round it is about is a clause that is not there. It is the LAST thing in the message
    // before it writes, and it must be in every such message.
    async function batchesSeenBy(loopModule, script) {
      const realFetch = globalThis.fetch;
      const bodies = [];
      let n = 0;
      globalThis.fetch = async (input, init) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        bodies.push(JSON.parse(String(init?.body || '{}')));
        return { ok: true, status: 200, json: async () => script(n++) };
      };
      try { await loopModule.runFreeBrainTurn({ ...BASE }); } finally { globalThis.fetch = realFetch; }
      // Every user message that carries tool results, across every request this turn.
      const seen = [];
      for (const body of bodies) {
        for (const message of body.messages || []) {
          if (message.role !== 'user' || !Array.isArray(message.content)) continue;
          if (!message.content.some((block) => block?.type === 'tool_result')) continue;
          const key = JSON.stringify(message.content.map((b) => b.tool_use_id || b.text || b.type));
          if (seen.some((entry) => entry.key === key)) continue;
          seen.push({
            key,
            reminded: message.content.some((block) => block?.type === 'text'
              && String(block.text || '').includes(instructions.ROUND_TEXT_REMINDER)),
          });
        }
      }
      return seen;
    }
    const THREE = (i) => (i < 3 ? withTool('', 't' + i) : textPayload(LATE));
    const everyBatchReminded = async (loopModule) => {
      const seen = await batchesSeenBy(loopModule, THREE);
      return seen.length >= 3 && seen.every((entry) => entry.reminded);
    };
    const batches = await batchesSeenBy(loop, THREE);
    ok('three tool rounds produce three batches of results',
      batches.length >= 3, JSON.stringify(batches.map((b) => b.reminded)));
    ok('and the round-text reminder rides on every one of them',
      batches.every((entry) => entry.reminded), JSON.stringify(batches.map((b) => b.reminded)));
    for (const clause of [
      'وما كتبتَه في جولةٍ سابقةٍ قد وصلَ القارئَ فعلًا',
      'لم يرَ نداءاتِ أدواتِك ولا نتائجَها',
    ]) {
      ok('the reminder carries the clause: ' + clause.slice(0, 28),
        instructions.ROUND_TEXT_REMINDER.includes(clause), instructions.ROUND_TEXT_REMINDER);
    }

    // M5 — the reminder is attached once and then forgotten, which is the placement the previous
    // round MEASURED to be only partly binding when it lived in the system block.
    const reminderMutant = await loopMutant('reminder-only-on-the-first-batch',
      (source) => source.replace(
        '        { type: \'text\', text: ROUND_TEXT_REMINDER },',
        '        ...(rounds === 1 ? [{ type: \'text\', text: ROUND_TEXT_REMINDER }] : []),'),
      everyBatchReminded);
    ok('reminder mutant seam applied', reminderMutant.changed, reminderMutant.error);
    ok('reminder mutant module loaded successfully', reminderMutant.loaded, reminderMutant.error);
    ok('MUTANT KILLED: the round-text reminder cannot be dropped after the first batch',
      reminderMutant.loaded && reminderMutant.survived === false, JSON.stringify(reminderMutant));

    // ── D. the two mutants that restore the pre-merge behaviour ─────────────
    // `probe` names the property THIS mutant is measured against. Without it the property is the
    // one section C asserts — every exit reaches the reviewer with a non-empty string.
    async function loopMutant(name, transform, probe) {
      const original = fs.readFileSync(LOOP, 'utf8');
      const changed = transform(original);
      if (changed === original) return { changed: false, loaded: false, survived: null, error: 'seam moved' };
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-freebrain-exit-mutant-'));
      const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
      fs.writeFileSync(twin, importsFromTree(changed, LOOP), 'utf8');
      try {
        const twinModule = await fresh(twin, name);
        const survived = probe
          ? Boolean(await probe(twinModule))
          : everyExitReviewed(await driveExits(twinModule, module.REVIEW_LAST_RESORT));
        return { changed: true, loaded: true, survived, error: null };
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
    // §٣ MOVED THIS SEAM AND THE MUTANT MOVED WITH IT. The turn now returns `deliveredText` —
    // the reviewer's text with the model's invented footnote numbers taken out of it — so the
    // mutant that puts the unreviewed draft back on the wire names that binding instead.
    const shownMutant = await loopMutant('reviewed-text-discarded',
      (source) => source.replace(/^ {4}text: deliveredText,$/mu, '    text: readerText,'));
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

    // M3 — §٢'s law inverted: the tool round's prose goes back on the floor. This is the exact
    // pre-repair loop, and it is the one that cost the owner questions one through five.
    const dropMutant = await loopMutant('tool-round-prose-discarded',
      (source) => source.replace('    if (roundText) written.push(roundText);',
        '    // mutant: the pre-repair loop threw this away'),
      carriesBothRounds);
    ok('dropped-prose mutant seam applied', dropMutant.changed, dropMutant.error);
    ok('dropped-prose mutant module loaded successfully', dropMutant.loaded, dropMutant.error);
    ok('MUTANT KILLED: prose written in a tool round cannot go back on the floor',
      dropMutant.loaded && dropMutant.survived === false, JSON.stringify(dropMutant));

    // M4 — the write keyed back on the accumulated text instead of on `finished`. With an early
    // round having already written something, E4's tools-removed write never runs at all, so a
    // turn whose last round said nothing usable delivers a stale fragment instead of an answer.
    const keyMutant = await loopMutant('write-keyed-on-text-again',
      (source) => source.replace('  if (!finished) {', '  if (!written.length) {'),
      async (twinModule) => {
        const turn = await driveScript(twinModule,
          (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(i === 1 ? '' : LATE)));
        return typeof turn?.text === 'string' && turn.text.includes(LATE);
      });
    ok('write-key mutant seam applied', keyMutant.changed, keyMutant.error);
    ok('write-key mutant module loaded successfully', keyMutant.loaded, keyMutant.error);
    ok('MUTANT KILLED: E4 cannot be deleted by keying the write on the accumulated text',
      keyMutant.loaded && keyMutant.survived === false, JSON.stringify(keyMutant));

    // ── F. §٢: COLLECTED, YES. DELIVERED, ONLY IF IT IS AN ANSWER ────────────
    //
    // WHAT THIS SECTION REPLACES, AND WHY THE OLD ASSERTION WAS TOO WIDE. Section D above proves
    // that prose written in a tool round is not thrown on the floor, and that is still true and
    // still asserted. But until this round `carriesBothRounds` was the WHOLE law, and it says
    // «every tool-round prose reaches the reader» — an assertion that also blesses the case
    // XC-13 named: an announcement of a move to a tool, delivered as an answer. The X-ray
    // measured six of them on twenty fiqh answers, five as the FIRST line the reader saw
    // (EZIK-XRAY-CC-REPORT-2026-08-17.md, XI-03). The guard was proving a mechanism wider than
    // the safe property.
    //
    // THE LAW IS NOW TWO CLAUSES AND BOTH ARE PINNED HERE:
    //   collection  — every round's prose is still gathered, whatever it says   (D above, and the
    //                 ledger assertion below, which counts the announcement's characters)
    //   delivery    — an announcement of a move to a tool is not handed over    (F1)
    //   and the negative witness that keeps this a REPAIR and not a REMOVAL:
    //   a real answer written in a tool round is delivered WHOLE, including one that answers and
    //   announces in the same sentence (F2). A mutant that drops it dies (M7).
    const ANNOUNCE = 'سأبحث لك في فتاوى العلماء عن هذه المسألة تحديداً.';   // XI-03, answer 15/1
    const MIXED = 'سأتحقق من المدة، والجمع للمسافر جائز عند الحاجة.';       // announces AND answers

    // F1 — the announcement is collected and not delivered.
    const announceTurn = await driveScript(loop,
      (i) => (i === 0 ? withTool(ANNOUNCE, 't0') : textPayload(LATE)));
    ok('an announcement of a move to a tool does not reach the reader',
      !announceTurn.text.includes('سأبحث'), announceTurn.text);
    ok('...and the answer that followed it still does',
      announceTurn.text.includes(LATE), announceTurn.text);
    // COLLECTION IS UNTOUCHED, AND THIS IS WHERE THAT IS PROVED RATHER THAN ASSERTED. The ledger
    // counts the characters the ROUND CARRIED; the text above is what was DELIVERED. The two
    // disagreeing by exactly the announcement is the whole of the new law in one pair of numbers.
    ok('...while the round ledger still records that the round CARRIED that prose',
      announceTurn.roundLedger[0].textChars === ANNOUNCE.length,
      JSON.stringify(announceTurn.roundLedger));
    ok('...and the drop is named in degraded with the size it removed',
      (announceTurn.degraded || []).some((d) => /^tool_announcement_dropped:\d+$/u.test(d)),
      JSON.stringify(announceTurn.degraded));

    // F2 — THE NEGATIVE WITNESS. Without this the filter could be «drop every tool-round line»
    // and every assertion above would still be green.
    const keepsRealAnswer = async (loopModule) => {
      const plain = await driveScript(loopModule,
        (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(LATE)));
      const mixed = await driveScript(loopModule,
        (i) => (i === 0 ? withTool(MIXED, 't0') : textPayload(LATE)));
      return typeof plain?.text === 'string' && plain.text.includes(EARLY)
        && typeof mixed?.text === 'string' && mixed.text.includes(MIXED);
    };
    ok('a real answer written in a tool round is delivered, whole — including one that announces '
      + 'and answers in the same sentence', await keepsRealAnswer(loop));

    // M6 — the delivery filter removed. This is the shipped behaviour of 17 August: everything
    // collected is handed over, announcements included.
    const deliverMutant = await loopMutant('delivery-filter-removed',
      // §٢ made `answer` a `let` — the citation retry can replace it — and the seam moved with it.
      // §١/٣ (D) moved this seam again: the call now carries the array the losses are named into.
      (source) => source.replace('  let answer = deliverableText(collected, deliveryNotes);',
        '  let answer = collected; // mutant: deliver everything that was collected'),
      async (twinModule) => {
        const turn = await driveScript(twinModule,
          (i) => (i === 0 ? withTool(ANNOUNCE, 't0') : textPayload(LATE)));
        return typeof turn?.text === 'string' && !turn.text.includes('سأبحث');
      });
    ok('delivery-filter mutant seam applied', deliverMutant.changed, deliverMutant.error);
    ok('delivery-filter mutant module loaded successfully', deliverMutant.loaded, deliverMutant.error);
    ok('MUTANT KILLED: the announcement cannot be delivered by dropping the filter',
      deliverMutant.loaded && deliverMutant.survived === false, JSON.stringify(deliverMutant));

    // M7 — the filter widened to «anything that announces», the exact over-reach §٢/٢ forbids.
    // It kills the sentence that announces AND answers, and F2's property is what catches it.
    const wideMutant = await loopMutant('filter-ignores-answer-content',
      (source) => source.replace('  if (ANSWER_CONTENT_RE.test(folded)) return false;',
        '  // mutant: drop anything that announces, answer content or not'),
      keepsRealAnswer);
    ok('wide-filter mutant seam applied', wideMutant.changed, wideMutant.error);
    ok('wide-filter mutant module loaded successfully', wideMutant.loaded, wideMutant.error);
    ok('MUTANT KILLED: a filter that also drops answers is a removal, not a repair',
      wideMutant.loaded && wideMutant.survived === false, JSON.stringify(wideMutant));

    // ── F3. THE FOURTH CLASS: PROSE THAT REPORTS ON THE TOOL RUN ─────────────
    //
    // F1/F2 above pin the THIRD class — «سأبحث», a promise to go and look. The fourth class is its
    // past tense: prose describing what the tool was queried with, what came back, and that what
    // came back was general or useless. `PROMISE_RE` does not match it and MUST NOT, so it shipped
    // on 17 August and reached the reader on preview and on production alike.
    //
    // THE LAW HERE IS A BOUNDARY, NOT A DROP, and both sides of it are pinned:
    //   dropped   — the description of what the TOOL did                       (the two witnesses)
    //   delivered — the sentence telling the READER the information did not hold up, which is the
    //               reviewer's own substitute line, AND a disclosure that mentions the search
    // Without that second negative witness this section would bless «drop every mention of البحث»,
    // and M8 below is the mutant that proves it does not.
    const TOOL_REPORT_WITNESSES = Object.freeze([
      // preview — the arithmetic and gold answers, EZIK-FIX-A-MERGE-REPORT-2026-08-17.md:249
      'تلك النتائج التي وصلتني كانت بحثًا عن كلمة "تجربة" لا عن مسألتك.',
      // production — the reviewer's own `before`, EZIK-FIX-A-PUBLISH-REPORT-2026-08-17.md §٤
      'نتيجة البحث لم تُعطِني سعراً حقيقيّاً لجرام الذهب اليوم؛ ما ظهر مجرد معلومات عامة عن عنصر الذهب الكيميائيّ، لا سعرَ سوقٍ.',
    ]);
    // The line the reviewer PUTS THERE when it destroys an unsupported dynamic claim. If this one
    // ever starts being dropped, the reader is told nothing at all instead of being told the truth.
    const REVIEWER_SUBSTITUTE = 'لم يصلني مصدرٌ مؤرّخ يمكن أن يثبت هذه المعلومة المتغيّرة في هذه الدورة.';
    // Mentions the search AND must survive — this is the whole boundary in one sentence.
    const READER_DISCLOSURE = 'لم أجد في بحثي عن هذه المسألة نصًّا لعالمٍ بعينِه.';
    const FINDING_FROM_SEARCH = 'نتيجة البحث أن جمهور أهل العلم على أن المسح جائز.';

    const dropsReports = (mod) => TOOL_REPORT_WITNESSES.every((s) => mod.deliverableText(s).trim() === '');
    // The property M8 is measured against, and the reason it is a REPAIR and not a removal.
    const keepsDisclosures = (mod) => mod.deliverableText(REVIEWER_SUBSTITUTE).includes('لم يصلني')
      && mod.deliverableText(READER_DISCLOSURE).includes('لم أجد')
      && mod.deliverableText(FINDING_FROM_SEARCH).includes('جمهور');

    ok('prose that reports on the tool run does not reach the reader', dropsReports(loop),
      JSON.stringify(TOOL_REPORT_WITNESSES.map((s) => loop.deliverableText(s))));
    ok('...while the reviewer\'s own substitute line still does',
      loop.deliverableText(REVIEWER_SUBSTITUTE).includes('لم يصلني'));
    ok('...and a disclosure to the reader survives even though it mentions the search',
      loop.deliverableText(READER_DISCLOSURE).includes('لم أجد'));
    ok('...and a FINDING reported from the search is content, and survives',
      loop.deliverableText(FINDING_FROM_SEARCH).includes('جمهور'));
    // THE SAFETY PROPERTY, AS A PROPERTY AND NOT AS A SAMPLE. The class is new, so ordinary prose
    // about searching — the kind an answer legitimately contains — must be untouched by it. Each
    // of these mentions the search or its results and none of them describes the tool run.
    const ORDINARY_SEARCH_PROSE = Object.freeze([
      'وقد بحثت في هذه المسألة فوجدت كلام أهل العلم متفقًا عليها.',
      'ونتيجة البحث أن المسألة خلافية بين الفقهاء.',
      'والبحث عن الحق في هذه المسألة مطلوب من المستفتي.',
      'ولم يصلني في هذه الدورة نص لعالم بعينه في هذه المسألة.',
      'ومصادر هذه المسألة مبسوطة في كتب الفقه.',
    ]);
    ok('ordinary prose that merely mentions the search is untouched by the new class',
      ORDINARY_SEARCH_PROSE.every((s) => !loop.isToolResultReport(s)
        && loop.deliverableText(s).trim().length > 0),
      JSON.stringify(ORDINARY_SEARCH_PROSE.filter((s) => loop.isToolResultReport(s))));

    // M8 — the over-reach §٣ names: the drop widened to every mention of the search. It is one
    // seam because the fast path deliberately OVER-admits, so the decision lives in one line.
    const reportMutant = await loopMutant('report-filter-ignores-predicate',
      (source) => source.replace(
        '  return TOOL_TOPIC_RE.test(folded) && TOOL_REPORT_RE.test(folded);',
        '  return TOOL_MENTION_RE.test(folded); // mutant: drop every mention of the search'),
      // §٢ (D) RE-AIMED THIS PROBE. `NOT_ESTABLISHED_RE` now keeps both disclosures whatever
      // these two tests say, so the widening no longer reaches them — it reaches the ordinary
      // prose above instead, and that is what this mutant is now measured against.
      async (twinModule) => keepsDisclosures(twinModule)
        && ORDINARY_SEARCH_PROSE.every((s) => twinModule.deliverableText(s).trim() !== ''));
    ok('report-filter mutant seam applied', reportMutant.changed, reportMutant.error);
    ok('report-filter mutant module loaded successfully', reportMutant.loaded, reportMutant.error);
    ok('MUTANT KILLED: widening the drop to every mention of the search kills the disclosure the '
      + 'reader is owed', reportMutant.loaded && reportMutant.survived === false,
    JSON.stringify(reportMutant));

    // ── G. §٣: THE CARD IS DECIDED AFTER THE REVIEWER, NOT BEFORE ────────────
    //
    // THE DEFECT. `collectCited` ran on the PROPOSAL and the card list was built from its answer,
    // while `reviewAnswer` ran afterwards on the same text and was free to destroy the very
    // sentence that had cited. The card outlived its sentence. XI-05 is what that looks like on a
    // screen: a full ayah card under «ما حكم صيام يوم عرفة لغير الحاج؟», mostly about the
    // forbidden meats, beneath prose that refers to no verse at all.
    //
    // HOW IT IS DRIVEN WITHOUT A NETWORK, and why the second tool call is here. The reviewer only
    // DESTROYS a sentence on its dynamic-claim arm, and `sentenceDomain` only reaches that arm
    // per-sentence when the turn's domain is `mixed`. `domainOf` reads `ctx.spend`, and `runTool`
    // records spend for a call that returned NOTHING — so a `search_live` call that finds zero
    // pages offline still makes the turn mixed, while `search_sources` fills the evidence table
    // from the in-process encyclopedia. Both are offline: the stub throws on any host but its own,
    // which is this file's standing guarantee that no egress happens.
    const twoTools = (id) => ({
      stop_reason: 'tool_use',
      content: [
        { type: 'tool_use', id: id + 'a', name: 'search_sources', input: { query: 'الجمع بين الصلاتين للمسافر' } },
        { type: 'tool_use', id: id + 'b', name: 'search_live', input: { query: 'طقس الكويت' } },
      ],
    });
    const RULING = 'الجمع للمسافر جائز عند الحاجة [[1]].';
    const DOOMED = 'درجة الحرارة اليوم في الكويت ثمان وثلاثون مئوية [[2]].';
    const citeTurn = (loopModule, final) => driveScript(loopModule,
      (i) => (i === 0 ? twoTools('t0') : textPayload(final)));

    const survivorTurn = await citeTurn(loop, RULING + '\n' + DOOMED);
    ok('the turn is mixed, so the reviewer judges each sentence in its own domain',
      survivorTurn.domain === 'mixed', String(survivorTurn.domain));
    ok('the reviewer destroyed the dynamic claim that cited [[2]]',
      !survivorTurn.text.includes('ثمان وثلاثون'), survivorTurn.text);
    // THE PROPERTY. Two refs were cited by the PROPOSAL; one sentence survived; one card is
    // returned, and it is the surviving sentence's.
    const cardsAfterReview = (turn) => Array.isArray(turn?.cited) && turn.cited.length === 1
      && turn.cited[0].ref === 1;
    ok('...so one card is returned, not two — the card follows the sentence that was delivered',
      cardsAfterReview(survivorTurn), JSON.stringify((survivorTurn.cited || []).map((r) => r.ref)));
    ok('...and the recount is named in degraded',
      (survivorTurn.degraded || []).includes('cards_after_review:2->1'),
      JSON.stringify(survivorTurn.degraded));

    // A turn whose ONLY citing sentence is destroyed keeps no card at all.
    const orphanedTurn = await citeTurn(loop, DOOMED);
    ok('a card whose only sentence the reviewer replaced is not shown',
      (orphanedTurn.cited || []).length === 0, JSON.stringify(orphanedTurn.cited));
    // ...and the standing safety property §٣ says must not be broken: a row that never entered the
    // model's context cannot be shown. `byRef` resolves nothing outside the table, so a ref the
    // model invented buys no card.
    const inventedTurn = await citeTurn(loop, 'الجمع للمسافر جائز عند الحاجة [[97]].');
    ok('a ref the model invented resolves to no card at all',
      (inventedTurn.cited || []).length === 0, JSON.stringify(inventedTurn.cited));

    // M8 — the pre-repair ORDER restored: the cards are read off the proposal again.
    const orderMutant = await loopMutant('cards-collected-before-the-reviewer',
      // `\r?\n`, for the reason M1's note gives: this tree checks out CRLF, and a seam written
      // with a bare `\n` reports «seam moved» and kills nothing at all.
      (source) => source.replace(
        / {2}const surviving = citedRefs\r?\n/u,
        '  const surviving = citedRefs.map((ref) => ({ ref, anchor: \'\', at: 0 })); const _ignored = citedRefs\n'),
      async (twinModule) => cardsAfterReview(await citeTurn(twinModule, RULING + '\n' + DOOMED)));
    ok('card-order mutant seam applied', orderMutant.changed, orderMutant.error);
    ok('card-order mutant module loaded successfully', orderMutant.loaded, orderMutant.error);
    ok('MUTANT KILLED: a card list read off the proposal cannot pass',
      orderMutant.loaded && orderMutant.survived === false, JSON.stringify(orderMutant));

    // ── H. §٣/٢: A REFERENCE NUMBER WITH NO CARD BEHIND IT DOES NOT GO OUT ───
    //
    // `[1]`, `[2][4]`, `[7]` are not the tool layer's `[[n]]` — they are the model's own footnotes
    // into a numbered reference list this application has never rendered. Nothing saw them, so
    // nothing removed them: question 14 delivered five of them over two passes with ZERO cards
    // under the answer (XI-15). The reader is promised a reference and given no way to reach one.
    const FOOTNOTED = 'الجمع للمسافر جائز عند الحاجة [[1]]. وقال أهل العلم بذلك [7] وكذلك [1][2].';
    const noOrphanNumbers = async (loopModule) => {
      const turn = await citeTurn(loopModule, FOOTNOTED);
      return typeof turn?.text === 'string'
        && !/\[\s*[0-9٠-٩]/u.test(turn.text)
        && turn.text.includes('وقال أهل العلم بذلك');
    };
    ok('an invented reference number does not reach the reader, and its prose does',
      await noOrphanNumbers(loop));

    // M9 — the removal dropped. The numbers ride out again exactly as they did on 17 August.
    const numberMutant = await loopMutant('orphan-reference-numbers-delivered',
      (source) => source.replace(
        '  const deliveredText = dropOrphanRefNumbers(reviewed.text) || reviewed.text;',
        '  const deliveredText = reviewed.text; // mutant: deliver the invented footnotes'),
      noOrphanNumbers);
    ok('orphan-number mutant seam applied', numberMutant.changed, numberMutant.error);
    ok('orphan-number mutant module loaded successfully', numberMutant.loaded, numberMutant.error);
    ok('MUTANT KILLED: an invented reference number cannot be delivered again',
      numberMutant.loaded && numberMutant.survived === false, JSON.stringify(numberMutant));

    // ── I. §١: THE CARD CEILING APPLIES TO THIS BRANCH TOO (XC-07) ───────────
    //
    // `MAX_SOURCES = 3` sat in api/ask.js unread by this path: the card list was built with no
    // slice and no limit, and `registerOwnedCards` only removes duplicates. Four cards came out in
    // three answers of the second set and five on question 17 of the 17 August battery.
    //
    // The rule is driven as the pure function it is. `max` and `buildTag` are the handler's — the
    // constant and the URL safety stay where they were — so what is asserted here is the SELECTION
    // and nothing else.
    const rows = (n) => Array.from({ length: n }, (_, i) => ({
      ref: i + 1, url: 'https://binbaz.org.sa/fatwas/' + (i + 1), title: 'فتوى ' + (i + 1),
    }));
    const tagOf = (row) => ({ tag: '<source url="' + row.url + '">' + row.title + '</source>' });
    const capped = (loopModule, cited) => loopModule.pickReaderCards(cited, 3, tagOf);

    ok('five cited pages yield three cards', capped(loop, rows(5)).length === 3,
      JSON.stringify(capped(loop, rows(5)).length));
    ok('four cited pages yield three cards', capped(loop, rows(4)).length === 3);
    ok('two cited pages still yield two — the ceiling is not a quota',
      capped(loop, rows(2)).length === 2);
    ok('the three kept are the FIRST three in delivered-text order, not any other three',
      capped(loop, rows(5)).map((c) => c.tag).join('|')
        === rows(3).map((r) => tagOf(r).tag).join('|'),
      JSON.stringify(capped(loop, rows(5)).map((c) => c.tag)));
    // DEDUPLICATION BEFORE THE CUT. Four citations of which two are the same page must deliver
    // THREE distinct cards, not two — capping first would let the repeat evict a distinct source.
    const withRepeat = [rows(1)[0], rows(1)[0], ...rows(4).slice(1)];
    ok('a page cited twice costs one slot, not two',
      capped(loop, withRepeat).length === 3
        && new Set(capped(loop, withRepeat).map((c) => c.tag)).size === 3,
      JSON.stringify(capped(loop, withRepeat).map((c) => c.tag)));
    ok('a cited row with no page yields no card and consumes no slot',
      capped(loop, [{ ref: 1, url: '', title: 'الموسوعة' }, ...rows(3)]).length === 3);

    // M10 — the limit dropped, which is the shipped behaviour of 17 August.
    const capMutant = await loopMutant('card-ceiling-removed',
      (source) => source.replace('    if (out.length >= max) break;',
        '    // mutant: no ceiling on this branch, exactly as it shipped'),
      async (twinModule) => capped(twinModule, rows(5)).length === 3);
    ok('card-ceiling mutant seam applied', capMutant.changed, capMutant.error);
    ok('card-ceiling mutant module loaded successfully', capMutant.loaded, capMutant.error);
    ok('MUTANT KILLED: the free branch cannot go back to an unlimited card list',
      capMutant.loaded && capMutant.survived === false, JSON.stringify(capMutant));

    // M11 — the cut moved ahead of the deduplication. It passes every count above and still hands
    // the reader two cards where three distinct pages were cited.
    const orderCapMutant = await loopMutant('cap-before-dedup',
      (source) => source.replace(
        '    if (card && card.tag && !out.some((item) => item.tag === card.tag)) out.push(card);',
        '    if (card && card.tag) out.push(card);'),
      async (twinModule) => {
        const got = capped(twinModule, withRepeat);
        return got.length === 3 && new Set(got.map((c) => c.tag)).size === 3;
      });
    ok('cap-before-dedup mutant seam applied', orderCapMutant.changed, orderCapMutant.error);
    ok('cap-before-dedup mutant module loaded successfully', orderCapMutant.loaded, orderCapMutant.error);
    ok('MUTANT KILLED: a repeated page cannot evict a distinct one',
      orderCapMutant.loaded && orderCapMutant.survived === false, JSON.stringify(orderCapMutant));

    // AND THE HANDLER MUST ACTUALLY CALL IT. A pure rule nothing invokes is a green gate over the
    // defect itself, which is exactly the shape XC-13 was.
    const askSource = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
    ok('api/ask.js builds the free branch\'s cards through the capped rule',
      /registerOwnedCards\(pickReaderCards\(out\.cited, MAX_SOURCES,/u.test(askSource));
    // §٣ (C) ADDED TWO NAMES TO THIS IMPORT and the pin moved with them rather than being loosened.
    // Written as «every one of these four names is in the destructuring, and the specifier is the
    // loop» instead of as one literal line: the literal broke the moment the list wrapped onto
    // three lines, and a pin that has to be re-typed whenever a name is added is a pin that gets
    // deleted. What it still forbids is the thing it was written for — a second copy of the card
    // rule, or of the footer rule, living in the handler.
    const freeBrainImport = /const \{([^}]*)\} = await import\('\.\.\/lib\/free-brain\/loop\.js'\);/u
      .exec(askSource)?.[1] || '';
    ok('...and imports it from the loop rather than keeping a second copy',
      ['runFreeBrainTurn', 'pickReaderCards', 'encyclopediaTail', 'citedDeliveryLedger']
        .every((name) => new RegExp('(?:^|[\\s,])' + name + '(?:[\\s,]|$)', 'u').test(freeBrainImport)),
      freeBrainImport);
    ok('...and MAX_SOURCES is still the one constant, still three',
      /^const MAX_SOURCES = 3;$/mu.test(askSource));

    // ── J. §٤: THE MINUTE OF WHAT WAS REMOVED (XC-03) ────────────────────────
    //
    // THE JOINT WITH BRANCH ب. It produces `before` and `after` on `verdict.sentences`; this side
    // prints them. The two names are pinned by TEXT because that is what the joint IS — a field
    // name written into both halves of the order — and because the producing half lands in another
    // worktree, so the only thing this gate can hold today is that the consumer reads exactly the
    // agreed names and invents neither.
    ok('the redaction minute is emitted as its own serialised line',
      /console\.log\('\[free-brain\/redactions\]', JSON\.stringify\(\{/u.test(askSource));
    for (const field of ['before', 'after']) {
      ok('...and it reads the agreed field name `' + field + '` and no synonym',
        new RegExp("typeof row\\." + field + " === 'string'").test(askSource)
          && new RegExp("\\b" + field + ": row\\." + field).test(askSource), field);
    }
    ok('...and it reports a cut whose minute did not arrive rather than printing an empty array',
      /minuteMissing: destructive\.length > 0 && redactions\.length === 0,/u.test(askSource));
    // The minute is READ, never produced here: the handler reaches the reviewer through the loop's
    // one call site and holds no import of its own, so this side cannot start writing the fields
    // it is supposed to be reporting.
    ok('...and the handler does not import the reviewer to manufacture the minute itself',
      !/(?:import|from)\s*\(?\s*'[^']*output-reviewer\.js'/u.test(askSource));

    // ── K. §١: THE KHILAF SIGNAL — PRODUCED HERE, AND `null` IS NOT `false` ───
    //
    // THE JOINT, AND WHY IT IS SHAPED LIKE SECTION J. Branch ب consumes the signal; this half
    // produces it. The two names are literal — `khilafFromOpinions` and `opinionCount` — and the
    // one clause that cannot be traded away is that `null` means «I do not know» and NEVER means
    // `false`: a `false` sent out of ignorance suppresses the khilaf tail on a matter that really
    // is disputed, which is a lie told inside the reader's own reply.
    //
    // WHAT WAS MEASURED, AND WHY THE ANSWER IS `null` (tools/khilaf-signal-measure.mjs):
    //   * a field in the fatwa store — 0 of 20 deposited records. The contract has no such field.
    //   * a tag in the data — 0 of 20. `categories`/`collection.name` name an archive series
    //     («فتاوى نور على الدرب», «الشريط رقم [304]»), never a disagreement.
    //   * multiplicity of distinct sources — the deposited set holds exactly ONE multi-source
    //     evidence set, the ribā pair, and the proxy fires on it and is WRONG: one doctrine applied
    //     to two different questions, not two opinions on one. 0 correct, 1 false.
    //   * and the other branch is worse — reading `opinionCount === 1` as `false` contradicts the
    //     material in hand on 1 of the 18 single-source records (al-Athary on divorce in anger,
    //     whose own text declares the matter disputed).
    // So the probe answers `null`, always, and says so in its own comment.

    // ── K1. THE COUNT IS THE PAIR «domain + fatwa id», AND NEITHER HALF ALONE ─
    const fatwaRow = (n, host, id) => ({ ref: n, url: `https://${host}/fatwas/${id}`, recordId: `${host}:${id}`, publisher: 'x' });
    const countOf = (loopModule, rowsIn) => loopModule.khilafSignal(rowsIn).opinionCount;
    ok('no evidence at all counts zero sources', countOf(loop, []) === 0, String(countOf(loop, [])));
    ok('one source counts one', countOf(loop, [fatwaRow(1, 'binbaz.org.sa', 1)]) === 1);
    // The reason the domain alone will not do: two rulings by one scholar on one host are two
    // published rulings, and they are exactly the pair that can differ.
    ok('TWO fatwas on ONE host count as two sources, not one',
      countOf(loop, [fatwaRow(1, 'binbaz.org.sa', 1), fatwaRow(2, 'binbaz.org.sa', 2)]) === 2,
      JSON.stringify([...loop.distinctSourceKeys([fatwaRow(1, 'binbaz.org.sa', 1), fatwaRow(2, 'binbaz.org.sa', 2)])]));
    // And the reason the id alone will not do: ids are unique per site, never across sites.
    ok('the SAME id on two different hosts counts as two sources',
      countOf(loop, [
        { ref: 1, url: 'https://binbaz.org.sa/fatwas/7', recordId: '7' },
        { ref: 2, url: 'https://islamqa.info/ar/answers/7', recordId: '7' },
      ]) === 2);
    ok('one page cited twice is one source',
      countOf(loop, [fatwaRow(1, 'binbaz.org.sa', 9), fatwaRow(2, 'binbaz.org.sa', 9)]) === 1);
    ok('www. is not a second domain',
      countOf(loop, [
        { ref: 1, url: 'https://www.almosleh.com/ar/1', recordId: 'a' },
        { ref: 2, url: 'https://almosleh.com/ar/1', recordId: 'a' },
      ]) === 1);
    // A ROW WITH NO PAGE IS STILL A SOURCE. The Kuwaiti encyclopedia has no URL, and folding two of
    // its entries into one would under-report the very multiplicity this number exists to measure.
    ok('two encyclopedia rows with no URL are still two distinct sources',
      countOf(loop, [
        { ref: 1, url: '', publisher: 'الموسوعة الفقهية الكويتية', recordId: 'e1' },
        { ref: 2, url: '', publisher: 'الموسوعة الفقهية الكويتية', recordId: 'e2' },
      ]) === 2);
    // ...and with neither a URL nor a record id, the table `ref` is unique by construction, so two
    // anonymous rows still count as two rather than collapsing into one.
    ok('two rows with neither URL nor record id still count as two',
      countOf(loop, [{ ref: 1 }, { ref: 2 }]) === 2);
    ok('a malformed URL does not throw, and the row still counts',
      countOf(loop, [{ ref: 1, url: 'not a url', publisher: 'p', recordId: 'r' }]) === 1);

    // ── K2. THE CONTRACT: null, NEVER false — AND NEVER true ON ONE SOURCE ────
    const SIGNAL_ROW_SETS = Object.freeze([
      [],
      [fatwaRow(1, 'binbaz.org.sa', 1)],
      [fatwaRow(1, 'binbaz.org.sa', 1), fatwaRow(2, 'islamqa.info', 2)],
      [fatwaRow(1, 'binbaz.org.sa', 1), fatwaRow(2, 'islamqa.info', 2), fatwaRow(3, 'salmajed.com', 3)],
    ]);
    // The property every mutant below is measured against, stated once.
    const neverLies = (loopModule) => SIGNAL_ROW_SETS.every((rowsIn) => {
      const signal = loopModule.khilafSignal(rowsIn);
      if (signal.khilafFromOpinions === false) return false;                  // never `false`
      if (signal.khilafFromOpinions === true && signal.opinionCount <= 1) return false; // never `true` on one
      return Number.isInteger(signal.opinionCount) && signal.opinionCount === rowsIn.length;
    });
    ok('the signal never reports `false`, and never reports `true` from a single source',
      neverLies(loop), JSON.stringify(SIGNAL_ROW_SETS.map((r) => loop.khilafSignal(r))));
    // THE NEGATIVE WITNESS §١ REQUIRES, BY NAME.
    const singleSource = loop.khilafSignal([fatwaRow(1, 'binbaz.org.sa', 1)]);
    ok('THE NEGATIVE WITNESS: one source -> opinionCount 1, and khilafFromOpinions is not `true`',
      singleSource.opinionCount === 1 && singleSource.khilafFromOpinions !== true,
      JSON.stringify(singleSource));
    ok('...and today it is `null` — «I do not know» — because nothing measured distinguishes it',
      singleSource.khilafFromOpinions === null, JSON.stringify(singleSource));
    ok('the probe answers null for every row set, which is what the measurement licensed',
      SIGNAL_ROW_SETS.every((r) => loop.khilafFromOpinionsProbe(r) === null),
      JSON.stringify(SIGNAL_ROW_SETS.map((r) => loop.khilafFromOpinionsProbe(r))));

    // ── K2b. THE ONE MEASURED COUNTER-EXAMPLE, HELD AS A PROPERTY ─────────────
    //
    // `neverLies` above cannot catch a `true` reported on a TWO-source set: nothing in the shape of
    // an evidence set says whether its sources actually differ. Only ground truth can, and the tree
    // holds exactly one evidence set with ground truth attached — the ribā pair, whose own fixture
    // note records that the two records answer two DIFFERENT questions («الأوّل في صميم المسألة
    // والثاني عن القمح»). Two distinct sources, and NOT two opinions. So this is the case that says
    // «more than one source» is not «more than one opinion», and it is read from the fixture rather
    // than retyped, so a change to the corpus changes the test with it.
    const RIBA = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'riba-family-two-records.json'), 'utf8'));
    const ribaRows = RIBA.records.map((record, i) => ({
      ref: i + 1,
      url: record.source?.url || '',
      publisher: record.scholar?.shortName || '',
      recordId: record.uid,
    }));
    const honoursMeasuredNegative = (loopModule) => {
      const signal = loopModule.khilafSignal(ribaRows);
      // Two distinct sources, and neither `true` (a lie about them) nor `false` (a lie about the
      // matter, which really is a matter on which fiqh has more than one position elsewhere).
      return signal.opinionCount === 2 && signal.khilafFromOpinions === null;
    };
    ok('the measured two-source set counts two, and is reported as «I do not know», not as khilaf',
      honoursMeasuredNegative(loop), JSON.stringify(loop.khilafSignal(ribaRows)));

    // ── K3. IT REALLY CROSSES THE SEAM, OBSERVED AND NOT ASSUMED ──────────────
    //
    // The pure reviewer is branch ب's and today ignores fields it has no rule for, so a text
    // assertion alone could not tell «forwarded» from «dropped». The seam is therefore executed
    // against a RECORDER standing in for the reviewer: a copy of lib/free-brain/review.js in
    // os.tmpdir() with its one import repointed. The recorder publishes on `globalThis` because
    // `fresh()` cache-busts every import, so a module imported twice is two instances and a plain
    // export could not be read back.
    async function seamSaw(input) {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-khilaf-seam-'));
      try {
        fs.writeFileSync(path.join(temp, 'recorder.mjs'),
          'export function reviewAnswer(input) {\n'
          + '  (globalThis.__ezikSeamSaw ||= []).push(input);\n'
          + "  return { text: String(input.text || ''), annotations: [], verdict: { version: 'recorder' } };\n"
          + '}\n', 'utf8');
        const rewired = importsFromTree(fs.readFileSync(SEAM, 'utf8'), SEAM)
          .replace(/from '[^']*output-reviewer\.js'/u, "from './recorder.mjs'");
        const seamFile = path.join(temp, 'seam.mjs');
        fs.writeFileSync(seamFile, rewired, 'utf8');
        globalThis.__ezikSeamSaw = [];
        const seam = await fresh(seamFile, 'khilaf-seam');
        await seam.reviewAnswer(input);
        return (globalThis.__ezikSeamSaw || [])[0] || null;
      } finally {
        delete globalThis.__ezikSeamSaw;
        fs.rmSync(temp, { recursive: true, force: true });
      }
    }
    const base = { text: 'الجمع للمسافر جائز.', evidence: [], domain: 'fiqh', mode: 'عادي' };
    const sawTrue = await seamSaw({ ...base, khilafFromOpinions: true, opinionCount: 3 });
    ok('the seam forwards `khilafFromOpinions` under exactly that name',
      sawTrue && sawTrue.khilafFromOpinions === true, JSON.stringify(sawTrue && Object.keys(sawTrue)));
    ok('...and `opinionCount` under exactly that name',
      sawTrue && sawTrue.opinionCount === 3, JSON.stringify(sawTrue && sawTrue.opinionCount));
    // THE NORMALISATION IS THE POINT. Anything that is not literally true or false is «I do not
    // know», so an absent signal, an undefined, or a truthy string can never become a `false`.
    for (const [label, value] of [
      ['absent', undefined], ['null', null], ['a truthy string', 'yes'],
      ['zero', 0], ['an empty string', ''],
    ]) {
      const saw = await seamSaw({ ...base, khilafFromOpinions: value });
      ok(`...and ${label} crosses the seam as null, not as false`,
        saw && saw.khilafFromOpinions === null, JSON.stringify(saw && saw.khilafFromOpinions));
    }
    ok('...while a genuine `false` is carried through as `false`',
      (await seamSaw({ ...base, khilafFromOpinions: false }))?.khilafFromOpinions === false);
    for (const [label, value] of [['absent', undefined], ['negative', -1], ['a fraction', 1.5], ['NaN', NaN], ['a string', '2']]) {
      const saw = await seamSaw({ ...base, opinionCount: value });
      ok(`a count that is ${label} crosses the seam as null, not as a number`,
        saw && saw.opinionCount === null, JSON.stringify(saw && saw.opinionCount));
    }
    ok('...and zero is a real count, not an absence', (await seamSaw({ ...base, opinionCount: 0 }))?.opinionCount === 0);

    // ── K4. AND THE LOOP PRODUCES IT ON A REAL TURN ──────────────────────────
    // Driven offline through the same in-process encyclopedia Section G uses. `khilafSignal` is
    // computed on the rows the PROPOSAL rested on, so a turn whose second sentence the reviewer
    // later destroys still reports the two sources its draft leaned on — the signal is about the
    // evidence, not about the surviving cards.
    const oneCiteTurn = await citeTurn(loop, RULING);
    ok('a turn that cited one row reports opinionCount 1',
      oneCiteTurn.opinionCount === 1, JSON.stringify([oneCiteTurn.opinionCount, (oneCiteTurn.cited || []).length]));
    ok('...and reports khilafFromOpinions as null, not false',
      oneCiteTurn.khilafFromOpinions === null, JSON.stringify(oneCiteTurn.khilafFromOpinions));
    ok('a turn whose draft rested on two rows reports two, even after the reviewer cut one sentence',
      survivorTurn.opinionCount === 2 && (survivorTurn.cited || []).length === 1,
      JSON.stringify([survivorTurn.opinionCount, (survivorTurn.cited || []).length]));
    // A ref the model invented resolves to no row, so it buys no count either.
    ok('an invented ref adds nothing to the count', inventedTurn.opinionCount === 0,
      JSON.stringify(inventedTurn.opinionCount));
    // The loop hands both names to the seam. Pinned as text for the reason Section J gives about
    // its own joint: the field name written into both halves of the order IS the contract.
    const loopSource = fs.readFileSync(LOOP, 'utf8');
    for (const field of ['khilafFromOpinions', 'opinionCount']) {
      ok('the loop passes `' + field + '` into the one call to branch ب',
        new RegExp('^ {4}' + field + ': khilaf\\.' + field + ',$', 'mu').test(loopSource), field);
    }
    // ...and the platform log reports them, `null` included. A field that vanishes when it is null
    // cannot be told apart from a field that was never wired.
    for (const field of ['khilafFromOpinions', 'opinionCount']) {
      ok('...and api/ask.js logs `' + field + '`, null and all',
        new RegExp('^ {8}' + field + ': out\\.' + field + ' \\?\\? null,$', 'mu').test(askSource), field);
    }

    // ── K5. THE MUTANTS ──────────────────────────────────────────────────────
    // M12 — the exact lie the contract forbids: silence read as denial.
    const falseMutant = await loopMutant('probe-reports-false-when-it-does-not-know',
      (source) => source.replace('export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return KHILAF_UNKNOWN;',
        'export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return false; // mutant: «I do not know» reported as «no»')
        .replace('export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return KHILAF_UNKNOWN;',
          'export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return false; // mutant: «I do not know» reported as «no»'),
      neverLies);
    ok('false-signal mutant seam applied', falseMutant.changed, falseMutant.error);
    ok('false-signal mutant module loaded successfully', falseMutant.loaded, falseMutant.error);
    ok('MUTANT KILLED: `null` cannot be turned into `false` — that suppresses the khilaf tail',
      falseMutant.loaded && falseMutant.survived === false, JSON.stringify(falseMutant));

    // M13 — the opposite lie: a hunch reported as knowledge. `neverLies` cannot catch this one —
    // the negative-witness clause already stops it on a single source — so it is measured against
    // the ONE evidence set in this tree whose ground truth is recorded: two distinct sources that
    // are not two opinions. That is what makes «more than one source» an unsafe proxy, and it is
    // the whole reason §١'s answer is `null`.
    const trueMutant = await loopMutant('probe-reports-true-on-a-hunch',
      (source) => source.replace('export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return KHILAF_UNKNOWN;',
        'export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return true; // mutant: a hunch reported as knowledge')
        .replace('export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return KHILAF_UNKNOWN;',
          'export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return true; // mutant: a hunch reported as knowledge'),
      honoursMeasuredNegative);
    ok('true-signal mutant seam applied', trueMutant.changed, trueMutant.error);
    ok('true-signal mutant module loaded successfully', trueMutant.loaded, trueMutant.error);
    ok('MUTANT KILLED: multiplicity of SOURCES cannot be reported as multiplicity of OPINIONS',
      trueMutant.loaded && trueMutant.survived === false, JSON.stringify(trueMutant));

    // M14 — the invariant deleted rather than the probe changed. This is the mutant that proves the
    // negative witness is enforced in `khilafSignal` and not merely implied by the probe's answer.
    const guardMutant = await loopMutant('negative-witness-clause-removed',
      (source) => source
        .replace(/ {2}const khilafFromOpinions = \(probed === true && opinionCount <= 1\) \? null\r?\n {4}: known \? probed\r?\n {6}: null;/u,
          '  const khilafFromOpinions = known ? probed : null; // mutant: the negative witness deleted')
        .replace('export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return KHILAF_UNKNOWN;',
          'export function khilafFromOpinionsProbe(rows) {\r\n  void rows;\r\n  return true;')
        .replace('export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return KHILAF_UNKNOWN;',
          'export function khilafFromOpinionsProbe(rows) {\n  void rows;\n  return true;'),
      neverLies);
    ok('negative-witness mutant seam applied', guardMutant.changed, guardMutant.error);
    ok('negative-witness mutant module loaded successfully', guardMutant.loaded, guardMutant.error);
    ok('MUTANT KILLED: removing the single-source clause lets a hunch through',
      guardMutant.loaded && guardMutant.survived === false, JSON.stringify(guardMutant));

    // M15 — the count keyed on the domain alone, which folds two rulings by one scholar into one
    // and under-reports exactly the multiplicity the number exists to measure.
    const keyMutantK = await loopMutant('count-keyed-on-domain-alone',
      (source) => source.replace('    keys.add(`${domain}|${id}`);',
        '    keys.add(domain); // mutant: the domain alone, so two fatwas on one host count as one'),
      async (twinModule) => countOf(twinModule, [fatwaRow(1, 'binbaz.org.sa', 1), fatwaRow(2, 'binbaz.org.sa', 2)]) === 2);
    ok('domain-only mutant seam applied', keyMutantK.changed, keyMutantK.error);
    ok('domain-only mutant module loaded successfully', keyMutantK.loaded, keyMutantK.error);
    ok('MUTANT KILLED: two rulings on one host cannot be counted as one source',
      keyMutantK.loaded && keyMutantK.survived === false, JSON.stringify(keyMutantK));

    // M16 — the seam turns an absent signal into a denial. Same lie as M12, told one file later,
    // which is why it needs its own mutant: the loop could be perfect and this would still ship it.
    const seamMutant = await (async () => {
      const original = fs.readFileSync(SEAM, 'utf8');
      const changed = original.replace(
        /khilafFromOpinions: input\.khilafFromOpinions === true \|\| input\.khilafFromOpinions === false\r?\n {8}\? input\.khilafFromOpinions : null,/u,
        'khilafFromOpinions: input.khilafFromOpinions === true, // mutant: absence becomes denial');
      if (changed === original) return { changed: false, loaded: false, survived: null, error: 'seam moved' };
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-khilaf-seamfile-'));
      try {
        fs.writeFileSync(path.join(temp, 'recorder.mjs'),
          'export function reviewAnswer(input) {\n'
          + '  (globalThis.__ezikSeamSaw ||= []).push(input);\n'
          + "  return { text: String(input.text || ''), annotations: [], verdict: { version: 'recorder' } };\n"
          + '}\n', 'utf8');
        const twin = path.join(temp, 'seam-mutant.mjs');
        fs.writeFileSync(twin, importsFromTree(changed, SEAM)
          .replace(/from '[^']*output-reviewer\.js'/u, "from './recorder.mjs'"), 'utf8');
        globalThis.__ezikSeamSaw = [];
        const twinModule = await fresh(twin, 'seam-mutant');
        await twinModule.reviewAnswer({ ...base });
        const saw = (globalThis.__ezikSeamSaw || [])[0] || null;
        return { changed: true, loaded: true, survived: Boolean(saw && saw.khilafFromOpinions === null), error: null };
      } catch (error) {
        return { changed: true, loaded: false, survived: null, error: error?.stack || String(error) };
      } finally {
        delete globalThis.__ezikSeamSaw;
        fs.rmSync(temp, { recursive: true, force: true });
      }
    })();
    ok('seam-normalisation mutant seam applied', seamMutant.changed, seamMutant.error);
    ok('seam-normalisation mutant module loaded successfully', seamMutant.loaded, seamMutant.error);
    ok('MUTANT KILLED: the seam cannot turn an absent signal into a `false`',
      seamMutant.loaded && seamMutant.survived === false, JSON.stringify(seamMutant));

    // AND THE MEASUREMENT THAT LICENSED `null` IS IN THE TREE AND RUNNABLE. A verdict of «no
    // reliable signal exists» rests on numbers, and numbers nobody can re-run are an assertion.
    ok('the measurement behind §١\'s verdict is committed and names its corpora',
      fs.existsSync(path.join(ROOT, 'tools', 'khilaf-signal-measure.mjs'))
        && /fatwa-authority-eighteen\.json/u.test(fs.readFileSync(path.join(ROOT, 'tools', 'khilaf-signal-measure.mjs'), 'utf8'))
        && /riba-family-two-records\.json/u.test(fs.readFileSync(path.join(ROOT, 'tools', 'khilaf-signal-measure.mjs'), 'utf8')));

    // ── L. §٢: ONE WRITING ROUND WHEN A RULING ARRIVES CITING NOTHING ─────────
    //
    // WHAT MEASURED IT. Question 19, four passes on ezik.app: three came back with `cited: []` and
    // all four with `retrieved: 4`. The evidence arrived; the model did not cite it. So this is a
    // WRITING round and not a search — and every one of §٢'s five constraints is a property here,
    // because a repair whose limits are not pinned is a repair that grows.
    //
    // HOW IT IS DRIVEN. `search_sources` fills the table from the in-process Kuwaiti encyclopedia,
    // which needs no network; the stub throws on any host but its own, so the offline guarantee this
    // file makes elsewhere is unchanged. A first write that cites nothing is the trigger, and the
    // script's THIRD payload is the retry's.
    const UNCITED = 'الجمع للمسافر جائز عند الحاجة، ولا حرج عليه في ذلك.';
    const RECITED = 'الجمع للمسافر جائز عند الحاجة [[1]]، ولا حرج عليه في ذلك.';
    const oneTool = (id) => ({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id, name: 'search_sources', input: { query: 'الجمع بين الصلاتين للمسافر' } }],
    });
    // i=0 the tool round · i=1 the first write · i=2 the §٢ retry.
    const retryScript = (third) => (i) => (i === 0 ? oneTool('t0') : i === 1 ? textPayload(UNCITED) : third(i));

    const retried = await driveScript(loop, retryScript(() => textPayload(RECITED)));
    ok('a fiqh ruling that cited nothing while evidence sat unused triggers one extra round',
      retried.citationRetries === 1, JSON.stringify(retried.citationRetries));
    ok('...and it is named in degraded under its OWN name, with the outcome',
      (retried.degraded || []).some((d) => /^citation_retry:cited:\d+$/u.test(d)),
      JSON.stringify(retried.degraded));
    ok('...and the extra time is recorded as a raw number',
      (retried.degraded || []).some((d) => /^citation_retry_ms:\d+$/u.test(d)),
      JSON.stringify(retried.degraded));
    // §٢/٥ — the name is its own. The counter that already counts two classes does not become three.
    ok('...and NOTHING was injected into tool_announcement_dropped',
      !(retried.degraded || []).some((d) => /^tool_announcement_dropped:/u.test(d)),
      JSON.stringify(retried.degraded));
    ok('...and the citation it produced becomes a real card, from a row that was in the table',
      (retried.cited || []).length === 1 && retried.cited[0].ref === 1,
      JSON.stringify((retried.cited || []).map((r) => r.ref)));
    ok('...and the retry is one MODEL call, on top of the two the turn already made',
      retried.modelCalls === 3, JSON.stringify(retried.modelCalls));
    ok('...and it is recorded in the round ledger under its own phase',
      (retried.roundLedger || []).some((row) => row.phase === 'cite-retry'),
      JSON.stringify((retried.roundLedger || []).map((r) => [r.n, r.phase])));
    // ...and no two ledger rows share an ordinal, which is what `rounds + 2` is for.
    ok('...and no two ledger rows share an ordinal',
      new Set((retried.roundLedger || []).map((r) => r.n)).size === (retried.roundLedger || []).length,
      JSON.stringify((retried.roundLedger || []).map((r) => r.n)));

    // §٢: THE LEDGER THAT IS PRINTED IS THE LEDGER THAT IS RETURNED.
    //
    // WHAT MEASURED IT. The `mnjgt` call reported `modelCalls: 4` and printed a ledger of THREE
    // rows. The print sat ABOVE the retry block, so it serialised the array before
    // `ledgerRow(rounds + 2, …, 'cite-retry')` had put the retry's row in it: the row existed in
    // `out.roundLedger`, which nothing in production reads, and was absent from the one line the
    // platform log carries. A retry that costs a model call and leaves no trace in the log is a
    // cost nobody can audit, so the PRINTED line is asserted here and not the returned array alone.
    async function printedLedgerFor(loopModule, script) {
      const realLog = console.log;
      const printed = [];
      console.log = (...args) => {
        if (args[0] === '[free-brain/round-ledger]') { printed.push(args[1]); return; }
        realLog(...args);
      };
      let turn;
      try { turn = await driveScript(loopModule, script); } finally { console.log = realLog; }
      const rows = printed.map((json) => { try { return JSON.parse(json); } catch { return null; } });
      return { turn, printed, rows };
    }
    const printedRetry = await printedLedgerFor(loop, retryScript(() => textPayload(RECITED)));
    ok('the round ledger is printed exactly once for the turn',
      printedRetry.printed.length === 1, JSON.stringify(printedRetry.printed.length));
    ok('...and the PRINTED ledger carries the cite-retry row, not the returned one alone',
      Array.isArray(printedRetry.rows[0])
        && printedRetry.rows[0].some((row) => row.phase === 'cite-retry'),
      JSON.stringify(printedRetry.rows[0]));
    ok('...and the printed ledger is row-for-row the ledger the turn returns',
      JSON.stringify(printedRetry.rows[0]) === JSON.stringify(printedRetry.turn.roundLedger),
      JSON.stringify([printedRetry.rows[0], printedRetry.turn.roundLedger]));
    ok('...and it carries one row per model call the turn actually made',
      Array.isArray(printedRetry.rows[0])
        && printedRetry.rows[0].length === printedRetry.turn.modelCalls,
      JSON.stringify([printedRetry.rows[0]?.length, printedRetry.turn.modelCalls]));
    // Moving the statement must not cost the ORDINARY turn its line: a turn that never retried
    // still prints, and prints both of its rows.
    const printedPlain = await printedLedgerFor(loop,
      (i) => (i === 0 ? withTool(EARLY, 't0') : textPayload(LATE)));
    ok('a turn that never retried still prints its ledger, whole',
      printedPlain.printed.length === 1
        && Array.isArray(printedPlain.rows[0])
        && printedPlain.rows[0].length === 2
        && JSON.stringify(printedPlain.rows[0]) === JSON.stringify(printedPlain.turn.roundLedger),
      JSON.stringify(printedPlain.rows[0]));


    // §٢/٤ — STILL EMPTY THE SECOND TIME: THE FIRST ANSWER GOES OUT AS IT WAS.
    const stillUncited = await driveScript(loop, retryScript(() => textPayload(UNCITED)));
    const firstAnswerSurvives = (turn) => typeof turn?.text === 'string'
      && turn.text.includes('الجمع للمسافر جائز عند الحاجة')
      && turn.text.includes('ولا حرج عليه في ذلك');
    ok('a retry that still cites nothing delivers the FIRST answer, whole',
      firstAnswerSurvives(stillUncited), stillUncited.text);
    ok('...and no card is invented for it', (stillUncited.cited || []).length === 0,
      JSON.stringify(stillUncited.cited));
    ok('...and the outcome is named rather than left silent',
      (stillUncited.degraded || []).includes('citation_retry:still_uncited'),
      JSON.stringify(stillUncited.degraded));
    // §٢/١ — ONE ONLY. A second empty retry must not buy a third call.
    ok('...and it does not buy a second retry — one only',
      stillUncited.citationRetries === 1 && stillUncited.modelCalls === 3,
      JSON.stringify([stillUncited.citationRetries, stillUncited.modelCalls]));

    // A retry whose own provider call fails is not a failed turn. The first answer is already in
    // hand, and `failure` stays null so an optional extra call cannot masquerade as a broken answer.
    // `driveScript` above resolves every payload; a THROWING round needs a driver that throws, so
    // this one honours an Error returned by the script the way `driveExits` does.
    async function driveThrowable(loopModule, script) {
      const realFetch = globalThis.fetch;
      let n = 0;
      globalThis.fetch = async (input) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        const step = script(n++);
        if (step instanceof Error) throw step;
        return { ok: true, status: 200, json: async () => step };
      };
      try { return await loopModule.runFreeBrainTurn({ ...BASE }); }
      finally { globalThis.fetch = realFetch; }
    }
    const retryFailed = await driveThrowable(loop,
      retryScript(() => Object.assign(new Error('upstream 529'), { status: 529 })));
    ok('a retry whose provider call throws still delivers the first answer',
      firstAnswerSurvives(retryFailed), retryFailed.text);
    ok('...and the turn does not report itself as failed',
      retryFailed.failure === null, String(retryFailed.failure));
    ok('...and the error is named in degraded, not swallowed',
      (retryFailed.degraded || []).some((d) => /^citation_retry:error:529:/u.test(d)),
      JSON.stringify(retryFailed.degraded));

    // ── L2. THE THREE CASES THAT MUST NOT TRIGGER IT ──────────────────────────
    // An answer that already cited. Nothing is missing, so nothing is spent.
    const alreadyCited = await driveScript(loop, (i) => (i === 0 ? oneTool('t0') : textPayload(RECITED)));
    ok('an answer that already cited buys no extra round',
      alreadyCited.citationRetries === 0
        && !(alreadyCited.degraded || []).some((d) => /^citation_retry/u.test(d)),
      JSON.stringify([alreadyCited.citationRetries, alreadyCited.degraded]));
    // Nothing retrieved: there is nothing to be asked to cite, and asking would only buy a call to
    // be told so. `lexicalRoute: 'DEEN'` keeps the domain fiqh, so this isolates `retrieved > 0`.
    const nothingRetrieved = await driveScript(loop, () => textPayload(UNCITED));
    ok('a fiqh answer with NOTHING retrieved buys no extra round — there is nothing to cite',
      nothingRetrieved.domain === 'fiqh' && nothingRetrieved.citationRetries === 0,
      JSON.stringify([nothingRetrieved.domain, nothingRetrieved.citationRetries]));
    // AN EMPTY ANSWER IS NOT A RULING MISSING AN ATTRIBUTION. E6/E7 reach the tail with no text at
    // all, which satisfies «cited is empty» trivially — and the retry would then post an assistant
    // turn with empty content, which the provider refuses. So the one turn already in trouble would
    // spend a call to earn a 400. The reviewer's last rung is what serves those exits.
    const emptyAnswerTurn = await driveScript(loop,
      (i) => (i === 0 ? oneTool('t0') : textPayload('')));
    ok('a turn with NO answer at all buys no extra round — an empty answer is not a ruling',
      emptyAnswerTurn.citationRetries === 0
        && (emptyAnswerTurn.evidence || []).length > 0
        && !(emptyAnswerTurn.degraded || []).some((d) => /^citation_retry/u.test(d)),
      JSON.stringify([emptyAnswerTurn.citationRetries, (emptyAnswerTurn.evidence || []).length,
        emptyAnswerTurn.degraded]));
    ok('...and it still reaches the reviewer\'s explicit last rung, which is what serves that exit',
      emptyAnswerTurn.text === module.REVIEW_LAST_RESORT, JSON.stringify(emptyAnswerTurn.text));

    // And a general-scope turn is outside the item. Driven with `search_live` alone, which
    // `domainOf` reads as general, and which finds nothing offline.
    const liveOnly = (id) => ({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id, name: 'search_live', input: { query: 'طقس الكويت' } }],
    });
    const generalTurn = await driveScript(loop,
      (i) => (i === 0 ? liveOnly('t0') : textPayload('طقس الكويت اليوم حار.')));
    ok('a general-scope turn is outside the item and buys no extra round',
      generalTurn.domain === 'general' && generalTurn.citationRetries === 0,
      JSON.stringify([generalTurn.domain, generalTurn.citationRetries]));

    // ── L3. IT IS A WRITING ROUND, AND THAT IS OBSERVED ON THE WIRE ───────────
    // §٢/٢ and §٢/٣ are one fact about the request body: the retry call offers NO tools, so there is
    // no search for the model to ask for and no paid call for it to spend. Read off the bodies the
    // stub was handed rather than inferred from the code.
    async function bodiesFor(loopModule, script) {
      const realFetch = globalThis.fetch;
      const bodies = [];
      let n = 0;
      globalThis.fetch = async (input, init) => {
        const url = String(input?.url || input);
        if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
        bodies.push(JSON.parse(String(init?.body || '{}')));
        const step = script(n++);
        if (step instanceof Error) throw step;
        return { ok: true, status: 200, json: async () => step };
      };
      try { await loopModule.runFreeBrainTurn({ ...BASE }); } finally { globalThis.fetch = realFetch; }
      return bodies;
    }
    const retryBodies = await bodiesFor(loop, retryScript(() => textPayload(RECITED)));
    ok('the retry is the third provider call of the turn', retryBodies.length === 3,
      JSON.stringify(retryBodies.length));
    ok('...and it offers NO tools at all, so no search can be made in it',
      retryBodies.length === 3 && !('tools' in retryBodies[2]),
      JSON.stringify(Object.keys(retryBodies[2] || {})));
    ok('...and it carries the §٢ note as the last thing the model reads',
      retryBodies.length === 3
        && retryBodies[2].messages[retryBodies[2].messages.length - 1].content === instructions.CITATION_RETRY_NOTE,
      JSON.stringify(String(retryBodies[2]?.messages?.slice(-1)[0]?.content || '').slice(0, 80)));
    ok('...and it replays the model\'s own prose as the assistant turn it is rewriting',
      retryBodies.length === 3
        && retryBodies[2].messages[retryBodies[2].messages.length - 2].role === 'assistant'
        && String(retryBodies[2].messages[retryBodies[2].messages.length - 2].content).includes('الجمع للمسافر جائز'),
      JSON.stringify(retryBodies[2]?.messages?.slice(-2)[0]?.role));
    ok('...and the tool results are still above it, so «الأدلّة أعلاه» is true of that message',
      retryBodies.length === 3 && retryBodies[2].messages.some((m) => m.role === 'user'
        && Array.isArray(m.content) && m.content.some((b) => b?.type === 'tool_result')));
    // The note itself forbids the two things a rewrite could otherwise do: invent a ref, or soften
    // the ruling to make the citation fit. Pinned because they are the note's whole safety margin.
    for (const clause of ['ولا تُنشئْ رقمًا لم يردْ في نتائجِ الأدوات', 'ولا تُغيّرِ الحكمَ ولا تُضعِفْه']) {
      ok('the §٢ note carries the clause: ' + clause.slice(0, 24),
        instructions.CITATION_RETRY_NOTE.includes(clause), instructions.CITATION_RETRY_NOTE);
    }
    // §٢/٢ — MAX_TOOL_ROUNDS IS NOT RAISED. Read from the module the loop imports it from.
    const tools = await fresh(path.join(ROOT, 'lib', 'free-brain', 'tools.js'), 'tools-base');
    ok('MAX_TOOL_ROUNDS is still six — the tool loop was not widened',
      tools.MAX_TOOL_ROUNDS === 6, String(tools.MAX_TOOL_ROUNDS));
    ok('...and the ceiling on retries is one, written as a constant',
      /^const MAX_CITATION_RETRIES = 1;$/mu.test(loopSource));
    // ...and api/ask.js reports the cost.
    ok('api/ask.js logs the retry count beside the model-call count',
      /^ {8}citationRetries: out\.citationRetries \?\? 0,$/mu.test(askSource));

    // ── L4. THE MUTANTS ──────────────────────────────────────────────────────
    // The property all four are measured against: the retry happens exactly once, spends no search,
    // and never replaces a delivered answer with a weaker one.
    const retryIsBounded = async (loopModule) => {
      const good = await driveScript(loopModule, retryScript(() => textPayload(RECITED)));
      const bad = await driveScript(loopModule, retryScript(() => textPayload(UNCITED)));
      const bodies = await bodiesFor(loopModule, retryScript(() => textPayload(RECITED)));
      return good.citationRetries === 1 && good.modelCalls === 3
        && bad.citationRetries === 1 && bad.modelCalls === 3 && firstAnswerSurvives(bad)
        && bodies.length === 3 && !('tools' in bodies[2]);
    };
    ok('the retry is bounded: once, toolless, and never a substitution for the first answer',
      await retryIsBounded(loop));

    // M17 — the ceiling raised. This is the item turning into a loop, which is the one thing §٢/١
    // names by number.
    const loopyMutant = await loopMutant('retry-ceiling-raised',
      (source) => source.replace('const MAX_CITATION_RETRIES = 1;',
        'const MAX_CITATION_RETRIES = 3; // mutant: the item becomes a loop')
        .replace(/ {2}if \(citationRetries < MAX_CITATION_RETRIES\r?\n/u,
          '  while (citationRetries < MAX_CITATION_RETRIES\n'),
      retryIsBounded);
    ok('retry-ceiling mutant seam applied', loopyMutant.changed, loopyMutant.error);
    ok('retry-ceiling mutant module loaded successfully', loopyMutant.loaded, loopyMutant.error);
    ok('MUTANT KILLED: the one extra round cannot become two',
      loopyMutant.loaded && loopyMutant.survived === false, JSON.stringify(loopyMutant));

    // M18 — the tools put back on the retry call. This is §٢/٢ and §٢/٣ broken in one line: a
    // retrieval round wearing a writing round's name, free to spend a paid search.
    const toolsBackMutant = await loopMutant('retry-offers-tools-again',
      (source) => source.replace(
        '          // NO `tools` KEY. Constraint (2) and (3) are this absence and not a check somewhere else.',
        '          tools: FREE_BRAIN_TOOLS, // mutant: a retrieval round in a writing round\'s clothes'),
      retryIsBounded);
    ok('tools-back mutant seam applied', toolsBackMutant.changed, toolsBackMutant.error);
    ok('tools-back mutant module loaded successfully', toolsBackMutant.loaded, toolsBackMutant.error);
    ok('MUTANT KILLED: the retry cannot be given tools to spend',
      toolsBackMutant.loaded && toolsBackMutant.survived === false, JSON.stringify(toolsBackMutant));

    // M19 — the retry's text adopted unconditionally. §٢/٤ forbids exactly this: a second answer
    // that still cites nothing REPLACING the first, which is a substitution by a weaker answer.
    const adoptMutant = await loopMutant('retry-text-adopted-even-when-uncited',
      (source) => source.replace(/ {6}if \(retryRefs\.length\) \{\r?\n/u,
        '      if (true) { // mutant: adopt the retry whatever it cited\n'),
      async (twinModule) => {
        // The mutant is caught by what the reader receives: a retry that dropped half the answer
        // must not be the answer, and this one drops «ولا حرج عليه في ذلك».
        const bad = await driveScript(twinModule,
          retryScript(() => textPayload('الجمع للمسافر جائز عند الحاجة.')));
        return firstAnswerSurvives(bad);
      });
    ok('adopt-anyway mutant seam applied', adoptMutant.changed, adoptMutant.error);
    ok('adopt-anyway mutant module loaded successfully', adoptMutant.loaded, adoptMutant.error);
    ok('MUTANT KILLED: a retry that still cites nothing cannot replace the delivered answer',
      adoptMutant.loaded && adoptMutant.survived === false, JSON.stringify(adoptMutant));

    // M20 — the outcome folded into `tool_announcement_dropped`, which §٢/٥ forbids by name: that
    // counter already counts two classes, and a third makes the number unreadable in a new way.
    const nameMutant = await loopMutant('retry-injected-into-the-announcement-counter',
      (source) => source.replace(
        '    ctx.degraded.push(`citation_retry:${retryOutcome}`);',
        '    ctx.degraded.push(`tool_announcement_dropped:${retryOutcome}`); // mutant: hidden in another counter'),
      async (twinModule) => {
        const turn = await driveScript(twinModule, retryScript(() => textPayload(RECITED)));
        return (turn.degraded || []).some((d) => /^citation_retry:/u.test(d));
      });
    ok('own-name mutant seam applied', nameMutant.changed, nameMutant.error);
    ok('own-name mutant module loaded successfully', nameMutant.loaded, nameMutant.error);
    ok('MUTANT KILLED: the retry cannot be hidden inside the announcement counter',
      nameMutant.loaded && nameMutant.survived === false, JSON.stringify(nameMutant));

    // M21 — the print put back above the retry block. This is the defect itself and not a variation
    // on it: `out.roundLedger` still carries the retry row, and the platform log still does not.
    const printOrderMutant = await loopMutant('round-ledger-printed-before-the-retry',
      (source) => {
        const stripped = source.replace(
          /\r?\n {2}console\.log\('\[free-brain\/round-ledger\]', JSON\.stringify\(roundLedger\)\);/u, '');
        if (stripped === source) return source; // seam moved — reported as «seam applied» FAIL
        // P6-V3 re-pin: the join at the delivery boundary now CHOOSES between the standing join
        // and the head-pinned one, so the seam this mutant moves the print above is that choice
        // line. The mutant is unchanged in what it does — it still prints the ledger before the
        // citation retry can add its row — and only the line it anchors on has moved.
        const moved = stripped.replace(/ {2}const collected = readerOwnsHead \? joinRoundTextsHeadPinned\(written\) : joinRoundTexts\(written\);/u,
          "  console.log('[free-brain/round-ledger]', JSON.stringify(roundLedger)); // mutant: printed before the retry\n  const collected = readerOwnsHead ? joinRoundTextsHeadPinned(written) : joinRoundTexts(written);");
        return moved === stripped ? source : moved;
      },
      async (twinModule) => {
        const mutated = await printedLedgerFor(twinModule, retryScript(() => textPayload(RECITED)));
        return mutated.printed.length === 1
          && Array.isArray(mutated.rows[0])
          && mutated.rows[0].some((row) => row.phase === 'cite-retry');
      });
    ok('print-order mutant seam applied', printOrderMutant.changed, printOrderMutant.error);
    ok('print-order mutant module loaded successfully', printOrderMutant.loaded, printOrderMutant.error);
    ok('MUTANT KILLED: the ledger cannot be printed before the retry row is in it',
      printOrderMutant.loaded && printOrderMutant.survived === false, JSON.stringify(printOrderMutant));

    // ══════════════════════════════════════════════════════════════════════════
    // R. §١ (C) — MACHINE PROSE DOES NOT REACH THE READER IN ANY LANGUAGE
    // ══════════════════════════════════════════════════════════════════════════
    //
    // WHAT SECTIONS F AND F3 ABOVE PROVE, AND WHAT THEY CANNOT. Both are lists of ARABIC phrases,
    // so both were blind to the two shapes the owner met on production on 17 August: an English
    // sentence opening the answer, and the provider's own tool protocol delivered as text. «عايرْنا
    // على سطحٍ وطبّقنا على سطحٍ آخر» — we calibrated on one surface and enforced on another.
    //
    // A SIXTH LIST OF ENGLISH PHRASES WOULD REPEAT THE MISTAKE ONE LANGUAGE LATER. So the two rules
    // asserted here carry no vocabulary at all: one is about the SCRIPT of a line and one is about
    // MARKUP. Everything below is therefore a property, and the negative witnesses are what stop a
    // property from becoming a licence to delete.
    const ENGLISH_ANNOUNCE = "I'll research each of these five questions in the authoritative sources.";
    const PROTOCOL_HEAD = '<function_results>\n<result>\n<name>search_islamic_sources</name>\n'
      + '<output>gold price today 82 usd per gram</output>\n</result>\n</function_results>';
    // The shape a cut stream leaves: the container opened and no close ever arrived.
    const PROTOCOL_CUT = '<function_results>\n<result>\n<name>search</name>\n<output>gold price today';

    // R1 — THE POSITIVE PROPERTY, driven through a real turn rather than asserted on a string, so
    // the rule is proved where it actually runs.
    const englishTurn = await driveScript(loop,
      (i) => (i === 0 ? withTool(ENGLISH_ANNOUNCE, 't0') : textPayload(LATE)));
    ok('an English announcement of a move to a tool does not reach the reader',
      !englishTurn.text.includes('research each of these'), englishTurn.text);
    ok('...and the Arabic answer that followed it still does',
      englishTurn.text.includes(LATE), englishTurn.text);
    ok('...while the round ledger still records that the round CARRIED that prose',
      englishTurn.roundLedger[0].textChars === ENGLISH_ANNOUNCE.length,
      JSON.stringify(englishTurn.roundLedger));

    // R2 — THE PROTOCOL, AT THE HEAD AND NOT AT THE HEAD, CLOSED AND CUT. «في أيِّ موضع».
    const protocolGone = (mod, text) => {
      const out = mod.deliverableText(text);
      return !/<\/?(?:function_results|result|name|output)\b/u.test(out) && !out.includes('gold price today');
    };
    ok('a tool-protocol block that OPENS the answer is removed, payload and all',
      protocolGone(loop, PROTOCOL_HEAD + '\nالجمع للمسافر جائز عند الحاجة.'),
      loop.deliverableText(PROTOCOL_HEAD + '\nالجمع للمسافر جائز عند الحاجة.'));
    ok('...and so is one in the MIDDLE of it — the ban is not about the head',
      protocolGone(loop, 'الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.'),
      loop.deliverableText('الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.'));
    ok('...and one the stream cut mid-block, which has no close to match',
      protocolGone(loop, 'الجمع للمسافر جائز.\n' + PROTOCOL_CUT),
      loop.deliverableText('الجمع للمسافر جائز.\n' + PROTOCOL_CUT));
    ok('...and the prose on both sides of a closed block survives it',
      loop.deliverableText('الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.')
        .includes('الجمع للمسافر جائز.')
      && loop.deliverableText('الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.')
        .includes('وهذا هو الراجح'),
      loop.deliverableText('الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.'));

    // R3 — THE NEGATIVE WITNESSES §١ NAMES BY NAME. Without these the whole section blesses «drop
    // every line with a Latin character in it», which is the third mutant it forbids.
    const SCRIPT_KEEPERS = Object.freeze([
      // an English TERM inside an Arabic sentence
      'وهذا ما يسمّى في الدراساتِ المعاصرةِ Fiqh of Minorities، وله ضوابطُه.',
      // a LINK inside an Arabic sentence
      'راجعْ نصَّ الفتوى على https://binbaz.org.sa/fatwas/12345 ففيه التفصيل.',
      // LATIN DIGITS inside an Arabic sentence
      'ومدّةُ المسحِ للمقيمِ يومٌ وليلة، وللمسافرِ 3 أيّامٍ بلياليها.',
      // an English UNIT twice over — the case a bare-majority threshold would have eaten
      'نصابُ الزكاةِ في الذهبِ 85 gram، وفي الفضّةِ 595 gram.',
      // a bare link on its own line: no letters at all, so it is never judged
      'https://binbaz.org.sa/fatwas/12345',
      // an Arabic line ending in a shell command — 11 Latin letters against 14 Arabic, and the
      // highest-scoring line in the measured KEEP corpus at 0.440
      'ويكتبُ في الطرفيّة: npm run gates',
    ]);
    const keepsScriptWitnesses = (mod) => SCRIPT_KEEPERS.every((line) => {
      const out = mod.deliverableText(line);
      return out.trim() !== '' && out.includes(line.slice(0, 12));
    });
    ok('an Arabic sentence carrying an English term, a link or a Latin number is delivered whole',
      keepsScriptWitnesses(loop),
      JSON.stringify(SCRIPT_KEEPERS.filter((l) => loop.deliverableText(l).trim() === '')));

    // R4 — THE CODE FENCE. §١'s second negative witness is a code block the reader explicitly asked
    // for. The distinction is made STRUCTURALLY — a fence is markdown's own mark for «this is not
    // prose» — so no guess about the reader's intent is needed anywhere.
    const FENCED = 'الشرحُ كما يلي:\n```js\nfunction add(a, b) { return a + b; }\nconst total = add(2, 3);\n```\nوهذا هو المطلوب.';
    const keepsFence = (mod) => {
      const out = mod.deliverableText(FENCED);
      return out.includes('function add(a, b)') && out.includes('const total = add(2, 3);')
        && out.includes('```js') && out.includes('وهذا هو المطلوب');
    };
    ok('a fenced code block the reader asked for survives the script rule, line for line',
      keepsFence(loop), loop.deliverableText(FENCED));

    // R5 — THE STANDING PROPERTY: nothing above unmade anything below. The six Arabic witnesses of
    // the 17 August X-ray are still dropped, and a real answer written in a tool round is still
    // delivered whole. §١'s third and fourth negative witnesses, re-asserted after the new rules.
    ok('THE SIX ARABIC WITNESSES: still dropped after the two new rules',
      loop.deliverableText(ANNOUNCE).trim() === '', loop.deliverableText(ANNOUNCE));
    ok('...and a real answer written in a tool round is still delivered, whole',
      await keepsRealAnswer(loop));
    ok('...and the fourth class — prose reporting on the tool run — is still dropped',
      dropsReports(loop));
    ok('...and the disclosure the reader is owed still survives', keepsDisclosures(loop));

    // R6 — THE BOUND IS DECLARED AND SITS INSIDE THE MEASURED GAP. §١: «حدُّ الغلبةِ يُقاسُ
    // ويُعلَن». Recomputed here from the two corpora rather than read off the comment, so a
    // constant edited without re-measuring fails instead of passing with a stale note beside it.
    const shareOf = (line) => loop.latinScriptShare(line).share;
    const MACHINE_CORPUS = Object.freeze([
      ENGLISH_ANNOUNCE,
      'Let me search for the most authoritative fatwa on this specific question.',
      'Based on the search results above, here is what the scholars say:',
    ]);
    const judged = SCRIPT_KEEPERS.filter((l) => loop.latinScriptShare(l).letters >= 12);
    const keepMax = Math.max(...judged.map(shareOf));
    const dropMin = Math.min(...MACHINE_CORPUS.map(shareOf));
    ok('the two corpora are separable at all — machine prose scores above every answer line',
      dropMin > keepMax, JSON.stringify({ keepMax, dropMin }));
    const declaredShare = Number(/^const LATIN_LINE_SHARE = ([0-9.]+);$/mu.exec(loopSource)?.[1]);
    const declaredFloor = Number(/^const LATIN_LINE_FLOOR = ([0-9]+);$/mu.exec(loopSource)?.[1]);
    ok('the threshold is a declared constant, not a literal buried in the test',
      Number.isFinite(declaredShare) && Number.isFinite(declaredFloor),
      JSON.stringify({ declaredShare, declaredFloor }));
    ok('...and it sits strictly inside the measured gap, with room on both sides',
      declaredShare > keepMax && declaredShare < dropMin,
      JSON.stringify({ keepMax, declaredShare, dropMin }));
    ok('...and the measurement that produced it is in the tree and runnable',
      fs.existsSync(path.join(ROOT, 'tools', 'latin-line-measure.mjs')));

    // R7 — M22: THE SCRIPT RULE CANCELLED. §١'s first named mutant.
    const scriptMutant = await loopMutant('script-rule-cancelled',
      (source) => source.replace("    if (isForeignScriptLine(line)) return '';",
        '    // mutant: the script rule is gone — an English line is delivered as an answer'),
      async (twinModule) => {
        const turn = await driveScript(twinModule,
          (i) => (i === 0 ? withTool(ENGLISH_ANNOUNCE, 't0') : textPayload(LATE)));
        return typeof turn?.text === 'string' && !turn.text.includes('research each of these');
      });
    ok('script-rule mutant seam applied', scriptMutant.changed, scriptMutant.error);
    ok('script-rule mutant module loaded successfully', scriptMutant.loaded, scriptMutant.error);
    ok('MUTANT KILLED: an English announcement cannot be delivered by dropping the script rule',
      scriptMutant.loaded && scriptMutant.survived === false, JSON.stringify(scriptMutant));

    // R8 — M23: THE PROTOCOL BAN NARROWED TO THE HEAD OF THE ANSWER. §١'s second named mutant, and
    // the reason the section above drives the block from three positions instead of one.
    const headOnlyMutant = await loopMutant('protocol-ban-head-only',
      (source) => source.replace("  let out = String(text ?? '');",
        "  let out = String(text ?? '');\n"
        + "  if (out.indexOf('<') > 0) return out; // mutant: only a block that OPENS the text is removed"),
      async (twinModule) => protocolGone(twinModule, 'الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.'));
    ok('head-only mutant seam applied', headOnlyMutant.changed, headOnlyMutant.error);
    ok('head-only mutant module loaded successfully', headOnlyMutant.loaded, headOnlyMutant.error);
    ok('MUTANT KILLED: a protocol block below the first line cannot be delivered',
      headOnlyMutant.loaded && headOnlyMutant.survived === false, JSON.stringify(headOnlyMutant));

    // R9 — M24: THE DROP WIDENED TO EVERY LINE CARRYING A LATIN CHARACTER. §١'s third named
    // mutant, and the one the negative witnesses exist for.
    const wideScriptMutant = await loopMutant('script-rule-by-presence',
      (source) => source.replace('  if (measured.letters < LATIN_LINE_FLOOR) return false;',
        '  return measured.latin > 0; // mutant: presence, not majority — and no floor either'),
      keepsScriptWitnesses);
    ok('wide-script mutant seam applied', wideScriptMutant.changed, wideScriptMutant.error);
    ok('wide-script mutant module loaded successfully', wideScriptMutant.loaded, wideScriptMutant.error);
    ok('MUTANT KILLED: a rule keyed on the PRESENCE of Latin deletes the answers it was meant to keep',
      wideScriptMutant.loaded && wideScriptMutant.survived === false, JSON.stringify(wideScriptMutant));

    // ══════════════════════════════════════════════════════════════════════════
    // S. §٢ (C) — THE READER IS TOLD THE ANSWER STOPPED SHORT
    // ══════════════════════════════════════════════════════════════════════════
    //
    // MEASURED LIVE: an answer cut IN THE MIDDLE OF A WORD arrived carrying the closing review mark,
    // so it read as finished. The finish state existed on every provider payload and nothing on the
    // path had ever read it.
    //
    // S1 — THE DERIVATION, AS A TABLE. The contract is «true إن انتهتْ آخرُ جولةِ نموذجٍ بغيرِ
    // end_turn · false إن تمّت · null إن لم يُعرَفْ», so the test is the COMPLEMENT of end_turn and
    // not a list of the two stop reasons anyone happens to remember.
    for (const [stop, expected] of [
      ['end_turn', false], ['max_tokens', true], ['tool_use', true],
      ['refusal', true], ['pause_turn', true],
      [null, null], [undefined, null], ['', null], [0, null], [{}, null],
    ]) {
      ok(`truncatedFrom(${JSON.stringify(stop)}) is ${JSON.stringify(expected)}`,
        loop.truncatedFrom(stop) === expected, JSON.stringify(loop.truncatedFrom(stop)));
    }

    // S2 — AND IT IS READ OFF A REAL TURN. Three shapes, three answers, and none of them is a
    // property of the text: the two `truncated` turns below deliver the SAME string.
    const stopPayload = (text, stop) => ({ stop_reason: stop, content: [{ type: 'text', text }] });
    const SHORT = 'نعم.';
    const finishedTurn = await driveScript(loop, () => stopPayload(EARLY, 'end_turn'));
    const cutTurn = await driveScript(loop, () => stopPayload(SHORT, 'max_tokens'));
    const cutLongTurn = await driveScript(loop, () => stopPayload(EARLY, 'max_tokens'));
    ok('a turn that ended on end_turn reports truncated:false',
      finishedTurn.truncated === false && finishedTurn.deliveredStop === 'end_turn',
      JSON.stringify([finishedTurn.truncated, finishedTurn.deliveredStop]));
    ok('a turn that ended on max_tokens reports truncated:true — however SHORT its text',
      cutTurn.truncated === true && cutTurn.deliveredStop === 'max_tokens',
      JSON.stringify([cutTurn.truncated, cutTurn.deliveredStop, cutTurn.text.length]));
    ok('...and however LONG it is, the same reason gives the same answer',
      cutLongTurn.truncated === true, JSON.stringify([cutLongTurn.truncated, cutLongTurn.text.length]));
    // THE PAIR THAT KILLS A LENGTH RULE, STATED AS ONE FACT: the SHORT cut turn and the LONG
    // finished turn disagree in exactly the direction a length rule would get backwards.
    ok('a short CUT answer and a long FINISHED answer are reported oppositely, which no length rule can do',
      cutTurn.truncated === true && finishedTurn.truncated === false
      && cutTurn.text.length < finishedTurn.text.length,
      JSON.stringify([cutTurn.text.length, finishedTurn.text.length]));

    // S3 — «null MEANS I DO NOT KNOW». Every provider call throws, so no round ever came back and
    // there is no finish state to report. Reporting `false` here would tell the reader that an
    // answer that does not exist is complete.
    const noRoundTurn = await driveScript(loop,
      () => Object.assign(new Error('upstream 529'), { status: 529 }));
    ok('a turn in which no round came back reports truncated:null, not false',
      noRoundTurn.truncated === null && noRoundTurn.deliveredStop === null,
      JSON.stringify([noRoundTurn.truncated, noRoundTurn.deliveredStop]));

    // S4 — IT CROSSES THE SEAM UNDER EXACTLY THAT NAME, and under the same normalisation the khilaf
    // signal gets. Same recorder, same discipline: anything that is not literally true or false is
    // `null`, because a truthy string quietly becoming `false` would tell the reviewer that a
    // half-written answer is whole.
    ok('the seam forwards `truncated` under exactly that name',
      (await seamSaw({ ...base, truncated: true }))?.truncated === true);
    ok('...and a genuine `false` is carried through as `false`',
      (await seamSaw({ ...base, truncated: false }))?.truncated === false);
    for (const [label, value] of [
      ['absent', undefined], ['null', null], ['a truthy string', 'yes'], ['zero', 0], ['an empty string', ''],
    ]) {
      const saw = await seamSaw({ ...base, truncated: value });
      ok(`...and ${label} crosses the seam as null, not as false`,
        saw && saw.truncated === null, JSON.stringify(saw && saw.truncated));
    }
    // The loop hands it to the seam at the SAME call site as the khilaf signal — §٢/١'s «في الموضع
    // نفسِه الذي تُمرَّرُ فيه إشارةُ الخلاف» — pinned as text, like every other field of that joint.
    ok('the loop passes `truncated` into the one call to branch ب',
      /^ {4}truncated,$/mu.test(loopSource));
    ok('...and api/ask.js logs it beside the stop_reason it was derived from',
      /^ {8}truncated: out\.truncated \?\? null,$/mu.test(askSource)
      && /^ {8}deliveredStop: out\.deliveredStop \?\? null,$/mu.test(askSource));

    // S5 — THE CLIENT SAYS IT, AND SAYS IT FROM THE SERVER'S SIGNAL. §٢/٢ gives the LINE to the
    // client, beside the «كمّل» button that already exists. Held as source assertions because this
    // guard runs no browser: what it can prove is that the marker is emitted only on `true`, that
    // the client has a rendered line keyed on it, and that nothing anywhere derives it from the
    // text. The last of those is the one that matters, and it is the reason for the `!` tests.
    // ITEM 32: the client is index.html + app.jsx since the JSX left the page.
    const indexSource = require('../tools/babel-block.cjs').readShippedClient(path.join(ROOT, 'index.html'));
    ok('api/ask.js appends the marker only when truncated is literally true',
      /out\.truncated === true \? TRUNCATED_MARK : ''/u.test(askSource));
    ok("...and the marker itself carries no prose — the wording is the client's",
      /^const TRUNCATED_MARK = '\\n<incomplete\/>';$/mu.test(askSource));
    ok('the client draws a line when, and only when, that marker is present',
      /ezikAnswerIncomplete\(lastMsg\.content\)/u.test(indexSource)
      && /const ezikAnswerIncomplete = \(t\) => typeof t === 'string' && EZIK_INCOMPLETE_TEST\.test\(t\);/u
        .test(indexSource));
    ok('...and the line has wording in BOTH interface languages, so neither reader is left guessing',
      /'chat\.qa\.incomplete': '[^']+'/u.test(indexSource)
      && (indexSource.match(/'chat\.qa\.incomplete':/gu) || []).length === 2);
    ok('...and it is drawn beside the «كمّل» strip, under the same visibility rule',
      /\{quickActionsVisible && ezikAnswerIncomplete\(lastMsg\.content\) && \(/u.test(indexSource));
    ok('...and the marker never rides back up to the model as its own prose',
      /content: ezikStripIncomplete\(m\.content\) \}/u.test(indexSource));
    ok('...and it is stripped from every reader that is not the badge: screen, voice and the log',
      /text = ezikStripIncomplete\(text\);/u.test(indexSource)
      && (indexSource.match(/stripIncompleteTags\(ezikStripIncomplete\(text\), \{ rescue: true \}\)/gu) || [])
        .length === 2);
    // NO SURFACE DERIVES IT FROM THE TEXT. A client that guesses is the same lie told by us.
    ok('no client rule keys the notice on the length or the last character of the answer',
      !/ezikAnswerIncomplete[^\n]*\.length/u.test(indexSource));

    // S6 — M25: `truncated` DERIVED FROM THE LENGTH. §٢/٣'s named mutant, and S2's short/long pair
    // is what kills it: a four-character answer that really was cut must still report `true`.
    const lengthMutant = await loopMutant('truncated-derived-from-length',
      (source) => source.replace('  const truncated = truncatedFrom(deliveredStop);',
        '  const truncated = answer.length >= 4000; // mutant: guessed from the size of the text'),
      async (twinModule) => {
        const cut = await driveScript(twinModule, () => stopPayload(SHORT, 'max_tokens'));
        const done = await driveScript(twinModule, () => stopPayload(EARLY, 'end_turn'));
        return cut.truncated === true && done.truncated === false;
      });
    ok('length-derived mutant seam applied', lengthMutant.changed, lengthMutant.error);
    ok('length-derived mutant module loaded successfully', lengthMutant.loaded, lengthMutant.error);
    ok('MUTANT KILLED: truncation cannot be guessed from the length of the answer',
      lengthMutant.loaded && lengthMutant.survived === false, JSON.stringify(lengthMutant));

    // ══════════════════════════════════════════════════════════════════════════
    // T. §٣ (C) — THE KUWAITI ENCYCLOPEDIA IS ATTRIBUTED, AND THE LOSS IS NAMED
    // ══════════════════════════════════════════════════════════════════════════
    //
    // THE DEFECT, AND IT IS VISIBLE IN THIS GUARD'S OWN FIXTURES. `citeTurn` above drives
    // `search_sources`, which fills the evidence table from the in-process encyclopedia; those rows
    // carry `url: ''` because the corpus is a local file with no page. `pickReaderCards` builds a
    // card only `if (row && row.url)`. So a row could be retrieved, cited, survive the reviewer —
    // and reach the reader as nothing whatever, with no line anywhere saying so.
    const encTurn = await citeTurn(loop, RULING);
    const encRows = (encTurn.cited || []).filter((r) => r && r.kind === 'encyclopedia');
    ok('the driven turn really does rest on an encyclopedia row, so this section tests the real case',
      encRows.length > 0, JSON.stringify((encTurn.cited || []).map((r) => [r.ref, r.kind, r.url])));
    ok('...and that row has no page behind it, which is why it was never a card',
      encRows.every((r) => !r.url), JSON.stringify(encRows.map((r) => r.url)));

    // T1 — THE FOOTER. It names the encyclopedia, and the article when the row carries one.
    const encTail = loop.encyclopediaTail(encTurn.cited);
    ok('an answer that rests on the encyclopedia earns an attribution tail',
      encTail.trim() !== '', JSON.stringify(encTail));
    ok('...naming the encyclopedia by the publisher the row itself declares',
      encTail.includes(encRows[0].publisher), JSON.stringify([encTail, encRows[0].publisher]));
    // THE NEGATIVE WITNESS §٣ NAMES: an answer that did not rest on it gets NOTHING.
    const noEncTail = (mod) => mod.encyclopediaTail(rows(3)) === ''
      && mod.encyclopediaTail([]) === ''
      && mod.encyclopediaTail(null) === '';
    ok('THE NEGATIVE WITNESS: an answer that did not rest on the encyclopedia gets zero tail',
      noEncTail(loop), JSON.stringify(loop.encyclopediaTail(rows(3))));

    // T2 — IT IS A FOOTER AND NOT A CARD, so it costs no slot. Five pages and one encyclopedia row:
    // three cards, and the tail beside them. §٣/٢, as a pair of numbers rather than a promise.
    const mixedCited = [encRows[0], ...rows(5)];
    ok('the tail does not consume a card slot — three pages still become three cards',
      capped(loop, mixedCited).length === 3, JSON.stringify(capped(loop, mixedCited).length));
    ok('...and the tail is still produced beside them',
      loop.encyclopediaTail(mixedCited).trim() !== '');
    ok('...and api/ask.js carries it as the writer\'s own reader suffix, not concatenated onto the text',
      /finalizerContext\.readerSuffix = encyclopediaTail\(out\.cited\);/u.test(askSource));

    // T3 — §٣/٣: EVERY CITED ROW THAT GAVE THE READER NOTHING IS NAMED WITH ITS REASON.
    // «لا صمتَ بعدَ اليوم». One row per cited row, in order, and the three reasons the order names.
    const dupPage = rows(1)[0];
    const ledgerCited = [encRows[0], ...rows(4), dupPage];
    const ledger = loop.citedDeliveryLedger(ledgerCited, 3, tagOf);
    ok('the ledger reports one row per cited row and loses none of them',
      ledger.length === ledgerCited.length, JSON.stringify(ledger));
    ok('...the encyclopedia row is `footer`, which is a delivery and no longer a loss',
      ledger[0].outcome === 'footer', JSON.stringify(ledger[0]));
    ok('...a page past the ceiling is named `over_cap` and not merely absent',
      ledger.some((r) => r.outcome === 'over_cap'), JSON.stringify(ledger));
    ok('...a repeated page is named `duplicate`',
      loop.citedDeliveryLedger([rows(1)[0], rows(1)[0]], 3, tagOf)[1].outcome === 'duplicate',
      JSON.stringify(loop.citedDeliveryLedger([rows(1)[0], rows(1)[0]], 3, tagOf)));
    ok('...a row with no page and no footer is named `no_url` rather than vanishing',
      loop.citedDeliveryLedger([{ ref: 9, kind: 'fatwa', url: '' }], 3, tagOf)[0].outcome === 'no_url');
    // AND THE SELECTION AND THE LEDGER AGREE. Two loops that can disagree are one loop and one lie.
    ok('the ledger counts exactly as many cards as the selection returns',
      ledger.filter((r) => r.outcome === 'card').length === capped(loop, ledgerCited).length,
      JSON.stringify([ledger.filter((r) => r.outcome === 'card').length, capped(loop, ledgerCited).length]));
    ok('...and the handler actually prints it, serialised, on its own line',
      /console\.log\('\[free-brain\/cited-delivery\]', JSON\.stringify\(\{/u.test(askSource)
      && /const delivery = citedDeliveryLedger\(out\.cited, MAX_SOURCES, buildFreeCard\);/u.test(askSource));

    // T4 — M26: THE TAIL ATTACHED WITHOUT SUPPORT. §٣'s named mutant: «ومسخةٌ تُلحِقُ التذييلَ بلا
    // استنادٍ تموت». An attribution that appears under an answer that never touched the source is
    // an invented citation, which is the worst thing this application can do.
    const tailMutant = await loopMutant('tail-without-support',
      (source) => source.replace("  if (!rows.length) return '';",
        "  if (!rows.length) rows.push({ publisher: 'X', title: 'X' }); // mutant: the tail rides on every answer"),
      noEncTail);
    ok('tail-without-support mutant seam applied', tailMutant.changed, tailMutant.error);
    ok('tail-without-support mutant module loaded successfully', tailMutant.loaded, tailMutant.error);
    ok('MUTANT KILLED: an attribution tail cannot be attached to an answer that did not rest on it',
      tailMutant.loaded && tailMutant.survived === false, JSON.stringify(tailMutant));

    // T5 — M27: THE SILENCE RESTORED. The ledger copies the selection's own `break`, and the rows
    // past the ceiling disappear from the record exactly as they did before this item.
    const silenceMutant = await loopMutant('cited-ledger-goes-silent-past-the-cap',
      (source) => source.replace(
        "    if (tags.length >= max) { out.push({ ...base, outcome: 'over_cap' }); continue; }",
        '    if (tags.length >= max) break; // mutant: the rows past the ceiling are not recorded'),
      async (twinModule) => twinModule.citedDeliveryLedger(ledgerCited, 3, tagOf).length === ledgerCited.length);
    ok('cited-ledger silence mutant seam applied', silenceMutant.changed, silenceMutant.error);
    ok('cited-ledger silence mutant module loaded successfully', silenceMutant.loaded, silenceMutant.error);
    ok('MUTANT KILLED: a row dropped at the ceiling cannot go unrecorded',
      silenceMutant.loaded && silenceMutant.survived === false, JSON.stringify(silenceMutant));


    // ══════════════════════════════════════════════════════════════════════════
    // U. §١ (D) — CODE IS KNOWN BY ITS SHAPE, NOT BY ITS SHARE OF LATIN
    // ══════════════════════════════════════════════════════════════════════════
    //
    // MEASURED ON PREVIEW, 17 August. A reader who asked for a zakat function received JavaScript
    // that does not parse: no `function` line, cut in the middle of the body, and with nothing
    // anywhere saying a line had been taken out. EZIK-FIX-C-MERGE-PUBLISH-REPORT-2026-08-17.md
    // §٣/٤ prints all eleven input lines with their Latin counts and shares beside the four the
    // share rule deleted. The array below is that input, line for line.
    //
    // THE THRESHOLD DOES NOT MOVE, AND THAT IS ASSERTED RATHER THAN INTENDED. §١: «استبدالٌ لا
    // معايرة». Raising the bound would keep `return 0;` and still delete
    // `function calculateZakat(amount) {`; lowering it would start eating the answer lines R6
    // measured the constant to protect. Both directions trade one defect for another, because
    // the share is the wrong question to ask about a line of code.
    ok('§١ THE THRESHOLD DID NOT MOVE — the repair is a replacement, not a calibration',
      declaredShare === 0.75 && declaredFloor === 12,
      JSON.stringify({ declaredShare, declaredFloor }));

    // The fence markers, once: three backticks are markdown's own mark for «this is not prose».
    const FENCE_TICKS = '```';

    const ZAKAT_LINES = Object.freeze([
      'function calculateZakat(amount) {',
      '  const nisab = 85 * 20; // مثال تقريبي بوحدات الذهب، يُحدَّد فعليًا بسعر السوق',
      '  if (amount < nisab) {',
      '    return 0;',
      '  }',
      '  const zakat = amount * 0.025;',
      '}',
      '// مثال على الاستخدام',
      'const money = 10000;',
      'const zakat = calculateZakat(money);',
      'console.log("زكاة المال المستحقة: " + zakat);',
    ]);
    const UNFENCED_ZAKAT = ZAKAT_LINES.join('\n');
    // BYTE FOR BYTE, INDENTATION INCLUDED. §٣/١: «تُسلَّمُ كاملةً سطرًا سطرًا». A comparison that
    // trimmed would pass on the second defect — the folded indent — while the first was repaired.
    const deliversZakatWhole = (mod) => {
      const out = mod.deliverableText(UNFENCED_ZAKAT).split('\n');
      return out.length === ZAKAT_LINES.length && ZAKAT_LINES.every((line, i) => out[i] === line);
    };
    const parsesAsJs = (text) => { try { new Function(text); return true; } catch { return false; } };
    ok('§٣/١ THE UNFENCED ZAKAT FUNCTION: all eleven lines are delivered, byte for byte',
      deliversZakatWhole(loop),
      JSON.stringify(loop.deliverableText(UNFENCED_ZAKAT).split('\n')
        .map((line, i) => (line === ZAKAT_LINES[i] ? '.' : i))));
    // ...and the property that makes the count mean something: it is a program, not a fragment.
    ok('...and the input was valid JavaScript to begin with', parsesAsJs(UNFENCED_ZAKAT));
    ok('...so what the reader receives is valid JavaScript too',
      parsesAsJs(loop.deliverableText(UNFENCED_ZAKAT)), loop.deliverableText(UNFENCED_ZAKAT));

    // §٣/٢ — THE SECOND DEFECT THE SAME REPORT MEASURED. Inside the fence the leading whitespace
    // was folded to a single space, by a pass that ran over the whole text before anything knew
    // where the fence was. The base tree preserved it, and this is the assertion that says so.
    const INDENTED_FENCE = FENCE_TICKS + 'js\nfunction f() {\n  const a = 1;\n    return a;\n}\n' + FENCE_TICKS;
    const keepsIndent = (mod) => {
      const out = mod.deliverableText(INDENTED_FENCE);
      return out.includes('\n  const a = 1;') && out.includes('\n    return a;');
    };
    ok('§٣/٢ fenced code keeps the leading whitespace the model wrote', keepsIndent(loop),
      JSON.stringify(loop.deliverableText(INDENTED_FENCE)));

    // A BLOCK IS JUDGED AS A BLOCK. §١: «سطرٌ واحدٌ يُعرَفُ كودًا يجعلُ جيرانَه المتّصلينَ به كودًا».
    // A Python body carries no terminator on any line but its first, so a per-line rule alone
    // delivers it with holes in it — which is the same defect one size smaller.
    const PY_LINES = Object.freeze([
      'def zakat(amount):',
      '    nisab = 85 * 20',
      '    if amount < nisab:',
      '        return 0',
      '    return amount * 0.025',
    ]);
    const PY_BODY = PY_LINES.join('\n');
    const deliversPythonWhole = (mod) => {
      const out = mod.deliverableText(PY_BODY).split('\n');
      return out.length === PY_LINES.length && PY_LINES.every((line, i) => out[i] === line);
    };
    ok('a body with no statement terminators is delivered whole, line for line',
      deliversPythonWhole(loop), JSON.stringify(loop.deliverableText(PY_BODY).split('\n')));
    ok('...and exactly ONE of its lines is code on its own evidence — the rest is the spreading',
      PY_LINES.filter(loop.isCodeShapedLine).length === 1
        && loop.codeShapedLines(PY_LINES).every(Boolean),
      JSON.stringify(PY_LINES.map(loop.isCodeShapedLine)));

    // AND THE SPREADING DOES NOT WALK OUT OF THE BLOCK, which is the whole risk it carries: a
    // rule that calls prose «code» exempts that prose from every filter above it.
    const INTRO_BLOCK = Object.freeze([
      'الشرحُ كما يلي:', 'function f() {', '  return 1;', '}', 'وهذا هو المطلوب.',
    ]);
    const introFlags = loop.codeShapedLines(INTRO_BLOCK);
    ok('the spreading stops at the Arabic prose on both sides of the block',
      introFlags[0] === false && introFlags[4] === false
        && introFlags[1] && introFlags[2] && introFlags[3], JSON.stringify(introFlags));
    // THE PROPERTY AND NOT A SAMPLE: neither measured corpus can be joined to a block. The KEEP
    // corpus must not be swallowed by the exemption and the MACHINE corpus must not escape
    // through it, and both are put directly under a block to find out.
    const joinable = (line) => loop.codeShapedLines(['function f() {', line])[1];
    ok('no line of the machine corpus can be joined to a block above it',
      MACHINE_CORPUS.every((l) => joinable(l) === false),
      JSON.stringify(MACHINE_CORPUS.filter(joinable)));
    ok('...and no declared keeper can be either', SCRIPT_KEEPERS.every((l) => joinable(l) === false),
      JSON.stringify(SCRIPT_KEEPERS.filter(joinable)));

    // §١/٣ — AND IF A LINE OF A PROGRAMMATIC OUTPUT IS REMOVED ANYWAY, IT IS NAMED. The protocol
    // ban still runs inside a fence and is still meant to (R2's declared cost), so a code line
    // carrying the provider's markup is still removed. What changes is that it is no longer
    // removed in silence — the third thing §٣/٤ of the report found missing.
    const CODE_WITH_PROTOCOL = FENCE_TICKS + 'js\nconst url = "x";\n'
      + 'const tag = "<function_results>y</function_results>";\nconst z = 2;\n' + FENCE_TICKS;
    const namesWhatItLost = (mod) => {
      const notes = [];
      mod.deliverableText(CODE_WITH_PROTOCOL, notes);
      return notes.some((n) => n.startsWith('code_line_dropped:'));
    };
    ok('§١/٣ a code line the protocol ban removes is NAMED, not dropped in silence',
      namesWhatItLost(loop));
    // ...and the negative half, without which «name everything» would pass by naming everything.
    ok('...while a text that loses no code line names none', (() => {
      const quiet = [];
      loop.deliverableText(UNFENCED_ZAKAT, quiet);
      return quiet.length === 0;
    })());
    ok('...and the loop forwards those names into `degraded`',
      /for \(const note of deliveryNotes\) ctx\.degraded\.push\(note\);/u.test(loopSource));

    // §٣/٣–٨ — THE STANDING NEGATIVES, RE-ASSERTED AFTER THE EXEMPTION. Every one of them was
    // measured green before this item, and a rule that exempts «code» could undo any of them by
    // calling prose code. Asserting them here is what makes this a repair and not a trade.
    ok('§٣/٣ an Arabic sentence carrying an English term, a link or a Latin number still survives',
      keepsScriptWitnesses(loop),
      JSON.stringify(SCRIPT_KEEPERS.filter((l) => loop.deliverableText(l).trim() === '')));
    const SIX_ARABIC = Object.freeze([
      'سأبحث لك في فتاوى العلماء عن هذه المسألة تحديداً.',
      'سأبحث لك في الفتاوى المتخصصة في هذه المسألة تحديداً.',
      'سأتحقق من هذه المسألة الدقيقة.',
      'هذه المسألة من دقائق أحكام الزكاة، وفيها تفصيل يستحق أن أستوثق منه لك.',
      'سأتحقق لك من المسألة في فتاوى العلماء لأزيدك اطمئنانًا بالدليل.',
    ]);
    const dropsSixArabic = (mod) => SIX_ARABIC.every((l) => mod.deliverableText(l).trim() === '');
    ok('§٣/٤ THE SIX ARABIC WITNESSES — five distinct lines over six answers — are still dropped',
      dropsSixArabic(loop),
      JSON.stringify(SIX_ARABIC.filter((l) => loop.deliverableText(l).trim() !== '')));
    ok('§٣/٥ the English planning line is still dropped',
      loop.deliverableText(ENGLISH_ANNOUNCE).trim() === '', loop.deliverableText(ENGLISH_ANNOUNCE));
    ok('§٣/٦ tool-protocol blocks are still banned at the head, in the middle, and mid-cut',
      protocolGone(loop, PROTOCOL_HEAD + '\nالجمع للمسافر جائز عند الحاجة.')
        && protocolGone(loop, 'الجمع للمسافر جائز.\n' + PROTOCOL_HEAD + '\nوهذا هو الراجح.')
        && protocolGone(loop, 'الجمع للمسافر جائز.\n' + PROTOCOL_CUT));
    ok('...and inside a code fence, which is a position and not an exemption',
      protocolGone(loop, FENCE_TICKS + 'js\n' + PROTOCOL_HEAD + '\n' + FENCE_TICKS));
    ok('§٣/٧ the disclosure the reader is owed still survives', keepsDisclosures(loop));
    ok('§٣/٨ a real answer written in a tool round is still delivered, whole',
      await keepsRealAnswer(loop));

    // ── U-M28: THE EXEMPTION CANCELLED. §٣'s first two named mutants at one seam — the share
    // rule decides for code again, so the unfenced block is torn exactly as it was on 17 August.
    const shapeMutant = await loopMutant('code-shape-exemption-removed',
      (source) => source.replace('    if (isCode[index]) return line;',
        '    // mutant: the share rule decides for code too, exactly as it did on 17 August'),
      deliversZakatWhole);
    ok('code-shape mutant seam applied', shapeMutant.changed, shapeMutant.error);
    ok('code-shape mutant module loaded successfully', shapeMutant.loaded, shapeMutant.error);
    ok('MUTANT KILLED: an unfenced code line cannot be dropped by the share rule again',
      shapeMutant.loaded && shapeMutant.survived === false, JSON.stringify(shapeMutant));

    // ── U-M29: THE BLOCK SPREADING REMOVED. Every line answers for itself again, and a body
    // whose only self-evident line is its first is delivered with holes in it.
    const blockMutant = await loopMutant('code-block-spread-removed',
      (source) => source.replace(
        '    for (let up = index - 1; up >= 0 && joins(up); up -= 1) code[up] = true;\n'
        + '    for (let down = index + 1; down < rows.length && joins(down); down += 1) code[down] = true;',
        '    // mutant: every line answers for itself — a block with no terminators is torn again'),
      deliversPythonWhole);
    ok('block-spread mutant seam applied', blockMutant.changed, blockMutant.error);
    ok('block-spread mutant module loaded successfully', blockMutant.loaded, blockMutant.error);
    ok('MUTANT KILLED: a code block cannot be judged one line at a time',
      blockMutant.loaded && blockMutant.survived === false, JSON.stringify(blockMutant));

    // ── U-M30: THE SPREADING WIDENED TO EVERY NEIGHBOUR. The opposite over-reach, and the one
    // that would quietly exempt the prose introducing the block — and a machine line with it.
    const wideBlockMutant = await loopMutant('code-block-spread-unconditional',
      (source) => source.replace(
        '    && CODE_JOIN_RE.test(rows[index]);',
        ';  // mutant: any non-blank neighbour joins, prose included'),
      async (twinModule) => {
        const flags = twinModule.codeShapedLines(INTRO_BLOCK);
        return flags[0] === false && flags[4] === false;
      });
    ok('wide-spread mutant seam applied', wideBlockMutant.changed, wideBlockMutant.error);
    ok('wide-spread mutant module loaded successfully', wideBlockMutant.loaded, wideBlockMutant.error);
    ok('MUTANT KILLED: a block cannot spread into the prose that introduced it',
      wideBlockMutant.loaded && wideBlockMutant.survived === false, JSON.stringify(wideBlockMutant));

    // ── U-M31: THE FOLD PUT BACK OVER THE HEAD OF THE LINE. §٣'s third named mutant. One seam,
    // because §١/٢ gave the fold one name and one definition for its three callers.
    const foldMutant = await loopMutant('leading-indent-folded-again',
      (source) => source.replace(
        "const foldInnerRun = (whole, lead, rest) => lead + rest.replace(/[ \\t]{2,}/gu, ' ');",
        "const foldInnerRun = (whole, lead, rest) => (lead + rest).replace(/[ \\t]{2,}/gu, ' ');"),
      keepsIndent);
    ok('indent-fold mutant seam applied', foldMutant.changed, foldMutant.error);
    ok('indent-fold mutant module loaded successfully', foldMutant.loaded, foldMutant.error);
    ok('MUTANT KILLED: the indentation inside a fence cannot be folded away again',
      foldMutant.loaded && foldMutant.survived === false, JSON.stringify(foldMutant));

    // ── U-M32: THE LOSS GOES SILENT AGAIN. §١/٣ as a mutant: the notes are collected and the
    // caller is handed nothing, which is exactly what «فلا يُنزَعُ صامتًا» forbids.
    const silentCodeMutant = await loopMutant('code-loss-unnamed',
      (source) => source.replace('  if (Array.isArray(notes)) {',
        '  if (!Array.isArray(notes) && false) { // mutant: the removal is silent again'),
      namesWhatItLost);
    ok('code-loss mutant seam applied', silentCodeMutant.changed, silentCodeMutant.error);
    ok('code-loss mutant module loaded successfully', silentCodeMutant.loaded, silentCodeMutant.error);
    ok('MUTANT KILLED: a line taken out of a programmatic output cannot go unnamed',
      silentCodeMutant.loaded && silentCodeMutant.survived === false, JSON.stringify(silentCodeMutant));


    // ══════════════════════════════════════════════════════════════════════════
    // V. §٢ (D) — PROSE IS KNOWN BY ITS SUBJECT, NOT BY ITS VOCABULARY
    // ══════════════════════════════════════════════════════════════════════════
    //
    // STILL REACHING THE READER ON PRODUCTION AFTER F3 SHIPPED, verbatim from the owner's order:
    //
    //   «النتيجةُ التي وردتْ تتحدّث عن… ولا تُجيبُ عن حالتِك بعينِها. فلنبحثِ المسألةَ بلفظٍ أدقّ.»
    //
    // TWO SENTENCES AND TWO SEPARATE FAILURES, and both are the same failure underneath.
    //   the report half    — the topic list knew «النتائج التي وصلتني» and not «النتيجة التي
    //                        وردت»: the SAME noun in the singular with the SAME relative clause
    //   the announce half  — the verb list was spelled with أ, and «نبحث» is the same verb in the
    //                        first person plural
    //
    // FOUR TIMES A LIST OF SPELLINGS HAS FAILED HERE — narrow Arabic, then English, then another
    // Arabic form, then Codex's إضافة form — so §٢ forbids a fifth list. What is asserted below is
    // therefore never «this phrase is now covered» but «this SHAPE is now covered»: the number,
    // the definiteness and the person are generated, and the topic is a POSITION in the sentence.
    const PROD_REPORT = 'النَّتيجةُ التي وردتْ تتحدّث عن حكم المسح عمومًا ولا تُجيبُ عن حالتِك بعينِها.';
    const PROD_ANNOUNCE = 'فلنبحثِ المسألةَ بلفظٍ أدقّ.';
    // The order elides the middle of the first sentence with «…». The filler above is declared and
    // carries no ruling word, no digit and no citation, so nothing in it can rescue the sentence
    // by accident — it is judged on its subject and its predicate alone.
    ok('§٢ the production report sentence is judged a report on the tool run',
      loop.isToolResultReport(PROD_REPORT));
    ok('§٢ the cohortative «فلنبحث» is judged an announcement',
      loop.isToolAnnouncement(PROD_ANNOUNCE));
    const dropsProductionLine = (mod) => mod.deliverableText(PROD_REPORT + ' ' + PROD_ANNOUNCE).trim() === '';
    ok('§٢ neither half of the production line reaches the reader', dropsProductionLine(loop),
      loop.deliverableText(PROD_REPORT + ' ' + PROD_ANNOUNCE));

    // THE SHAPE, AND NOT THE PHRASE. Each of these differs from a covered witness by exactly one
    // grammatical feature — number, definiteness, the possessive, or the person of the verb — and
    // every one of them is the kind of variation the four previous lists were blind to.
    const SHAPE_VARIANTS = Object.freeze([
      'النتيجة التي رجعت لم تعطني ما يخص مسألتك.',   // singular + definite, where the list had the plural
      'نتيجة بحثي لا تفيد في هذه الحالة.',            // the possessive, where the list had the إضافة
      'سنبحث لك في فتاوى العلماء عن هذه المسألة.',   // first person PLURAL future
      'لنبحث المسألة بلفظ أدق.',                      // the cohortative without the فـ
    ]);
    const dropsShapeVariants = (mod) => SHAPE_VARIANTS.every((s) => mod.deliverableText(s).trim() === '');
    ok('§٢ one grammatical feature away from a covered witness is still covered',
      dropsShapeVariants(loop),
      JSON.stringify(SHAPE_VARIANTS.filter((s) => loop.deliverableText(s).trim() !== '')));

    // §٢'s «حدٌّ لا يُخرَق» — A SENTENCE SAYING THE INFORMATION DID NOT HOLD IS TRUE NEWS AND STAYS.
    // The hard case is the one where the sentence would otherwise be dropped on both clauses: the
    // subject IS the run and the predicate IS negated. Without the limit as its own first test,
    // this one goes out with the class.
    const LIMIT_WITNESS = 'نتيجة البحث لم تثبت هذه المعلومة، فلا يصح البناء عليها.';
    const keepsTheLimit = (mod) => mod.deliverableText(LIMIT_WITNESS).includes('لم تثبت')
      && mod.deliverableText(REVIEWER_SUBSTITUTE).includes('لم يصلني')
      && mod.deliverableText(READER_DISCLOSURE).includes('لم أجد');
    ok('§٢ THE LIMIT: a sentence whose subject IS the run still survives if it reports that the '
      + 'information did not hold', keepsTheLimit(loop), loop.deliverableText(LIMIT_WITNESS));

    // THE OVER-REACH THIS ITEM COULD HAVE BOUGHT, AS A PROPERTY. Every one of these is a sentence
    // an answer legitimately contains, and each is one the widened rules pass close to: a ruling
    // in the negative, a first-person-plural verb that is not a search, and a finding whose
    // subject really is the result.
    const NEAR_MISSES = Object.freeze([
      'لا يجب على المسافر أن يصوم في السفر.',              // a RULING shaped like a negated predicate
      'لا ينقض الوضوءَ مسُّ المرأةِ عند الجمهور.',           // …and another
      'ولنعد إلى المسألة التي سألت عنها.',                 // «لن» + first person plural, and not a search
      'ولنكمل الكلام على شروط المسح.',                     // …and another
      'نتيجة البحث تتحدث عن حكم المسح على الخفين، وهو جائز بالسنة.', // a FINDING the result is about
    ]);
    const keepsNearMisses = (mod) => NEAR_MISSES.every((s) => mod.deliverableText(s).trim() !== '');
    ok('§٢ the rulings, the non-search plurals and the findings next door are untouched',
      keepsNearMisses(loop),
      JSON.stringify(NEAR_MISSES.filter((s) => loop.deliverableText(s).trim() === '')));
    // THE WITNESS ONLY THE SUBJECT-POSITION RULE SAVES. Its search noun sits behind «على», so it
    // is an adjunct; its predicate is negated and reports; and it carries no ruling word, no digit
    // and no citation. Nothing but the position keeps it, which is what makes it the measure of
    // V-M36 — both disclosures are held by the limit above and cannot move whatever that rule says.
    const ADJUNCT_WITNESS = 'الجواب مبني على نتائج البحث، وهو لا يكفي وحده دليلًا.';
    const keepsTheAdjunct = (mod) => mod.deliverableText(ADJUNCT_WITNESS).trim() !== '';
    ok('§٢ a search noun behind a preposition is an adjunct, and its sentence survives',
      keepsTheAdjunct(loop), loop.deliverableText(ADJUNCT_WITNESS));
    // ...and the standing safety list of F3, re-asserted after the widening.
    const keepsOrdinarySearchProse = (mod) => ORDINARY_SEARCH_PROSE
      .every((s) => mod.deliverableText(s).trim() !== '');
    ok('§٢ ordinary prose that merely mentions the search is still untouched',
      keepsOrdinarySearchProse(loop),
      JSON.stringify(ORDINARY_SEARCH_PROSE.filter((s) => loop.deliverableText(s).trim() === '')));
    ok('§٢ ...and the two measured fourth-class witnesses are still dropped', dropsReports(loop));

    // ── V-M33: THE CLASS PUT BACK INSIDE A NAMED VOCABULARY. §٣'s fourth named mutant. The noun
    // is pinned to the one spelling the previous list carried, so the singular walks through again.
    const vocabMutant = await loopMutant('fourth-class-back-to-a-word-list',
      (source) => source.replace(
        "'(?:(?:ال)?(?:نتيجة|نتيجه|نتائج|حصيلة|مخرجات|بحث|بحوث)(?:ي|نا|ه|ها)?'",
        "'(?:(?:ال)?(?:نتائج)(?:ي|نا|ه|ها)?' // mutant: the plural only, as the list had it"),
      dropsProductionLine);
    ok('vocabulary mutant seam applied', vocabMutant.changed, vocabMutant.error);
    ok('vocabulary mutant module loaded successfully', vocabMutant.loaded, vocabMutant.error);
    ok('MUTANT KILLED: pinning the topic to one spelling lets the singular through again',
      vocabMutant.loaded && vocabMutant.survived === false, JSON.stringify(vocabMutant));

    // ── V-M34: THE PERSON TAKEN BACK OUT OF THE VERB. The same mutant on the announcement half:
    // first person singular only, which is exactly the state that shipped «فلنبحث» to production.
    const personMutant = await loopMutant('promise-verb-singular-only',
      // BOTH definitions, or the cohortative arm keeps the plural and the mutant survives on a
      // technicality rather than on the property.
      (source) => source.replace(
        "const PROMISE_VERB = '[أن](?:' + PROMISE_ROOT + ')';",
        "const PROMISE_VERB = 'أ(?:' + PROMISE_ROOT + ')'; // mutant: first person singular only")
        .replace("const SEARCH_MOVE_VERB = '[أن](?:", "const SEARCH_MOVE_VERB = 'أ(?:"),
      async (twinModule) => twinModule.deliverableText(PROD_ANNOUNCE).trim() === '');
    ok('person mutant seam applied', personMutant.changed, personMutant.error);
    ok('person mutant module loaded successfully', personMutant.loaded, personMutant.error);
    ok('MUTANT KILLED: a verb list without the plural cannot see «فلنبحث»',
      personMutant.loaded && personMutant.survived === false, JSON.stringify(personMutant));

    // ── V-M35: THE «لم يثبتْ» SENTENCE DROPPED. §٣'s fifth named mutant, written as an inversion
    // of the limit rather than as its removal — removing it changes nothing today, because the
    // disclosures also fail the topic test, and a mutant that changes nothing proves nothing.
    const limitMutant = await loopMutant('not-established-dropped',
      (source) => source.replace(
        '  if (NOT_ESTABLISHED_RE.test(folded)) return false;',
        '  if (NOT_ESTABLISHED_RE.test(folded)) return true; // mutant: the true news goes out with the class'),
      keepsTheLimit);
    ok('limit mutant seam applied', limitMutant.changed, limitMutant.error);
    ok('limit mutant module loaded successfully', limitMutant.loaded, limitMutant.error);
    ok('MUTANT KILLED: the sentence telling the reader the information did not hold cannot be dropped',
      limitMutant.loaded && limitMutant.survived === false, JSON.stringify(limitMutant));

    // ── V-M36: THE PREPOSITION IGNORED, so an adjunct counts as a topic. This is the mutant the
    // subject-position rule exists for: «في بحثي» would become «the search is what this is about»
    // and the disclosure the reader is owed would go out with the class.
    const adjunctMutant = await loopMutant('topic-ignores-subject-position',
      (source) => source.replace("'(?:^|؛)[\\\\s«\"(\\\\[]*'", "'(?:^|[\\\\s؛])[\\\\s«\"(\\\\[]*'"),
      keepsTheAdjunct);
    ok('adjunct mutant seam applied', adjunctMutant.changed, adjunctMutant.error);
    ok('adjunct mutant module loaded successfully', adjunctMutant.loaded, adjunctMutant.error);
    ok('MUTANT KILLED: a search noun behind a preposition is an adjunct and not a topic',
      adjunctMutant.loaded && adjunctMutant.survived === false, JSON.stringify(adjunctMutant));

  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
