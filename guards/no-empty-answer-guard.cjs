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
      (source) => source.replace('  const answer = deliverableText(collected);',
        '  const answer = collected; // mutant: deliver everything that was collected'),
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
    ok('...and imports it from the loop rather than keeping a second copy',
      /const \{ runFreeBrainTurn, pickReaderCards \} = await import\('\.\.\/lib\/free-brain\/loop\.js'\);/u
        .test(askSource));
    ok('...and MAX_SOURCES is still the one constant, still three',
      /^const MAX_SOURCES = 3;$/mu.test(askSource));
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
