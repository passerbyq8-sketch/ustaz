// guards/telemetry-text-guard.cjs — the reader's question is not an operational field.
//
// THE OWNER DECISION THIS ENFORCES. The text of a user's question is never recorded: not raw,
// not normalised, and not as a fingerprint. A digest is not a compromise here — a question is a
// short string from a small space, and a hash of one is the question to anybody holding a
// wordlist. lib/ledger/seam.js already says it in words over its own counts line («COUNTS AND
// CODES ONLY. No question, no answer, no page text, no reader identity»); this gate is what
// makes the same sentence true of the handler's stdout, where it was NOT true until today.
//
// WHAT WAS ACTUALLY LEAKING, and what this gate would have caught:
//
//   * [free-brain/turn]        `queries`      — every search string the planner derived from the
//                                              question, i.e. the question reworded, once per turn.
//   * [hybrid-deen]/[stored-deen] `resolvedTopic`, `query`, `queries` — its subject and the same
//                                              rewording, on the religious path.
//   * [claim]                  `subject`      — up to twelve words lifted VERBATIM out of the
//                                              question by claim-gate. Found by sweeping, not by
//                                              being pointed at; no guard read it, so nothing but
//                                              a sweep was ever going to find it.
//
// THE ONE EXCEPTION (owner ruling 2026-09-25, order د-١): the diagnostic trace in lib/diag-trace.js writes the
// question with DIAG_TRACE_V1 on, off production, on the side/program-20260924 preview alone. Section E fences it:
// the trace is the only other writer, and it can never emit in production.
//
// HOW IT DECIDES, AND WHY IT IS TWO RULES AND NOT ONE. Neither half is sufficient alone:
//
//   RULE A — DENIED SOURCES. No console call on a delivery path may mention an expression that
//   carries reader text. This is matched on the EXPRESSION, so renaming the field defeats
//   nothing: `q2: storedOut.searchQuery` fails exactly as `query: storedOut.searchQuery` did,
//   and so does `[storedOut.searchQuery]` inside an array, because the sweep reads the whole
//   argument subtree rather than a list of top-level keys.
//
//   RULE B — AN EXPLICIT ALLOW-LIST OF FIELD NAMES. Every object key printed on a delivery path
//   must be named below. Rule A can only deny expressions somebody already thought of; Rule B
//   fails on a field nobody has reviewed yet, whatever it is built from. It is deliberately
//   inconvenient: adding a telemetry field costs a line here, and that line is the review.
//
// WHAT THIS GATE DOES NOT PROVE. It is a SOURCE sweep, not a live capture: it proves no delivery
// handler WRITES a denied expression into a log call, not that some value reached stdout in a
// production request. A runtime capture would need the whole api/ask.js harness (a stub key, a
// founder token, a stubbed day-cap store) and would then only observe the fixtures it was given.
// The one runtime tooth here is section D, which drives the real payload builder that a static
// reader cannot see into.
'use strict';

const fs = require('fs');
const path = require('path');
const { harness } = require('./output-reviewer-mutant-lib.cjs');
const scan = require('./telemetry-scan-lib.cjs');

const { ok, finish } = harness('telemetry-text');
const REPO = path.resolve(__dirname, '..');
const API_DIR = path.join(REPO, 'api');

// The delivery paths: every request handler the platform can route to.
const DELIVERY_FILES = fs.readdirSync(API_DIR).filter((f) => f.endsWith('.js')).sort();

// ── RULE A ────────────────────────────────────────────────────────────────────
//
// Expressions that carry the reader's own words. Each is anchored on the producing identifier
// rather than on a field name, because the field name is the part a refactor changes.
const DENIED_SOURCES = [
  { re: /\bsearchQuery\b/, why: 'the query the planner derived from the question' },
  { re: /\bsearchQueries\b/, why: 'the same, as a list' },
  { re: /\bresolvedTopic\b/, why: 'the subject of the question, in the reader words' },
  { re: /\bcurrentQuestion\b/, why: 'the question itself' },
  { re: /\bquestionText\b/, why: 'the question itself' },
  { re: /\bclaimSubject\s*\.\s*subject\b/, why: 'twelve words lifted verbatim from the question' },
  { re: /\bclaimSubject\s*\.\s*phrase\b/, why: 'the quoted span of the question' },
  { re: /\.\s*query\b/, why: 'a per-tool search string, i.e. the question reworded' },
  { re: /(^|[^A-Za-z_$.])queries\b/, why: 'the question reworded, once per variant' },
  { re: /\bbody\s*\.\s*messages\b/, why: 'the raw turn array' },
  { re: /\bplan\s*\.\s*topic\b/, why: 'the question with only its frame stripped' },
  { re: /\bnormalizeArabic\s*\(/, why: 'a normalised form of reader text is still reader text' },
];

// ── RULE B ────────────────────────────────────────────────────────────────────
//
// Every field name a delivery path may print. Opaque identifiers, counts, flags, and fixed
// vocabularies only. A name arriving here without a reason is the failure this list exists for.
const ALLOWED_FIELDS = [
  // ع-٤٩ — 'books' is a COUNT: `bookCards.length` on [free-brain/cited-delivery], the number of
  // library attribution chips one reply drew. An integer beside the existing 'cards'; there is no
  // string in it, and nothing about it is derived from anything the reader typed.
  'action', 'adapters', 'ageFloorOutcome', 'band', 'books', 'braveSearch', 'budgetEnvironment',
  'budgetReason', 'candidates', 'card', 'cards', 'carried', 'citationRetries', 'cited',
  'contentModes', 'corpusCalls', 'count', 'degraded', 'deliveredStop', 'destructive', 'domain',
  'dropWhole', 'dropped', 'droppedSentences', 'duplicate', 'elapsedMs', 'emitted', 'enabled',
  // ١١١/٣ — 'examined' is a COUNT: `targets.length` on [takhrij], how many of the answer’s
  // quoted matns were actually looked up after the cap. An integer beside 'found' and 'dropped',
  // which are already here; there is no string in it, and nothing about it is derived from
  // anything the reader typed. The other three names that line prints — found, dropped, emitted
  // — were already reviewed onto this list and are not re-approved here.
  'entity', 'evidence', 'examined', 'fatwaScholars', 'fatwaSearch', 'fatwaStatus', 'fatwaTotal',
  'flag',
  'flips', 'footer', 'found', 'hasDescriptor', 'host', 'hosts', 'ibnBazTotal', 'id',
  'injectionMarkers', 'intent', 'judged', 'kept', 'khilafFromOpinions', 'kind', 'lexicalRoute',
  'liveFetch', 'markers', 'matched', 'minuteMissing', 'mode', 'model', 'modelCalls', 'noUrl',
  'officialDomain', 'open', 'opinionCount', 'outcome', 'overCap', 'pages', 'path', 'persons',
  'pointerCards', 'policyEnabled', 'policyVersion', 'probed', 'problems', 'providerCalls',
  'publicFetch', 'publicSearch', 'publishers', 'purpose', 'reason', 'relation', 'removed',
  'repaired', 'requested', 'requestedDepth', 'resolvedScholar', 'retrievalOutcome',
  'retrieved', 'rounds', 'route', 'rows', 'scholar', 'score', 'searchCompleted', 'searched',
  'source', 'sourceIds', 'sourcePolicy', 'sources', 'supporting', 'tools', 'topic', 'transfer',
  'truncated', 'turn', 'used', 'verdict',
];
// ── RULE B, CONTINUED: THE STREAMING TURN'S OWN COUNTERS ──────────────────────
//
// The streaming work gave [free-brain/turn] seven new keys. Each is reviewed here on its own
// line, because a block approval of «the streaming fields» is exactly the thing Rule B exists to
// prevent. Every one is built in lib/free-brain/loop.js out of the loop's OWN control state —
// which branch ran, how long a write took, what the provider billed — and not one is derived
// from, shortened from, or normalised out of anything the reader typed. The TYPE is named first
// in each line because the type is half the argument: a boolean and a count cannot carry prose
// whatever they are called, and that is a stronger claim than «this one looks harmless».
const STREAM_FIELDS = [
  // boolean — the loop pinned the head of the delivered answer to the round the reader already
  // read. Set from `roundAccepted`, a decision about the loop's own rounds. Not round text.
  'readerOwnsHead',
  // boolean — the delivered text still begins with the bytes already sent. It is the RESULT of a
  // startsWith between two strings; neither string is printed, only whether one prefixes the other.
  'streamPrefixValid',
  // boolean — this round was permitted to stream (flag on, round shape eligible). A statement
  // about configuration, decided before any model output exists to be derived from.
  'streamRoundEligible',
  // count — `streamViolations.length`, never the array. Its elements are fixed `kind` codes
  // ('unit-records-do-not-match-chunks', 'notice-behind-emitted'); api/ask.js prints the length
  // alone, so not even that closed vocabulary reaches stdout.
  'streamViolations',
  // boolean — whether anything at all went on the wire this turn. One bit about the turn, and
  // nothing about what the turn said.
  'streamedThisTurn',
  // number of milliseconds — wall time of the terminal write, `Date.now() - writeStartedAt`.
  // A duration; there is no string in it to be reader text.
  'terminalWriteMs',
  // token counts — `{outTokens, inTokens, cacheWriteTokens, cacheReadTokens}` taken off the
  // terminal write's ledger row. Provider billing integers. The four inner names are assembled in
  // loop.js rather than in the log call, so what this key admits to the sweep is a name, not a
  // payload, and the payload it names is four numbers.
  'terminalWriteUsage',
];

// THE THREE NAMES THAT ARE DELIBERATELY NOT HERE. `terminalWriteAdded`, `terminalStreamEligible`
// and `terminalStreamViolations` were printed by an earlier revision of the streaming work and
// deleted by the current one. An allow-list carrying a dead name is an allow-list that would let
// that name come back unreviewed, and Rule B's entire value is that a field nobody has read
// fails. `queries` is absent in the other direction and for the same reason: its deletion is the
// leak this gate was written for, and admitting it here would quietly undo the fix.
// ── RULE B, CONTINUED: THE LIVE-WORLD ROUND'S FOUR (2026-09-19) ───────────────
//
// Reviewed one line at a time, for the reason the streaming block above states: a block
// approval of «the LIVE_WORLD_V2 fields» is the thing Rule B exists to prevent. Two of them
// are printed by the world search's crash trace and two by the print contract.
//
// WHAT THIS GATE ALREADY REFUSED, AND IT WAS RIGHT TO. The first version of the crash trace
// printed `name: e.name` and `message: e.message`. `message` is a genuine leak: lib/retrieve.js
// builds the open-search URL with the reader's question in its query string, so a transport
// error's message can contain the question verbatim. It was deleted rather than reviewed, and
// `name` was renamed so that the generic key never enters this list at all.
const LIVE_WORLD_V2_FIELDS = [
  // fixed two-word vocabulary — 'after-vetted-pass' or 'before-any-result', both string
  // literals in api/ask.js. It says WHERE in the world block the throw happened. Nothing is
  // derived from the turn; the value is chosen by a boolean test on `worldPass`.
  'stage',
  // error class name — `e.name`, i.e. 'TypeError', 'Error', 'AbortError'. A closed vocabulary
  // owned by the runtime. Deliberately NOT `e.message`; see above.
  'errorName',
  // fixed vocabulary, as a list — `removed.map((r) => r.why)`, and every `why` is one of six
  // literals defined in lib/live-number-source.js ('live-number-without-source',
  // '...-without-date', '...-without-source-or-date', 'relative-date-without-absolute', and, since
  // 2026-09-20, 'external-service-referral' and 'lead-in-to-a-removed-sentence'). Reviewed one at
  // a time like the rest: each names a RULE this repository owns and nothing the reader typed. The
  // SENTENCES that were removed are never printed: they are the reader's own answer text, and
  // the whole point of the count beside this is to say how many went without saying what they said.
  'why',
  // boolean — whether the print contract removed everything, so the server's disclosure line
  // spoke instead. One bit about an outcome.
  'emptied',
];
// ── RULE B, CONTINUED: THE SILENT-COLLAPSE TRACE (§١ · 2026-09-20) ───────────
//
// ONE new name, reviewed on its own line like the rest. `[free-brain/empty]` in api/ask.js is
// the line that was missing when the reader was handed «تعذَّر توليدُ الجوابِ الآن…» twice with
// twenty `info` entries and no `warn` behind it. Every OTHER field on that call is already
// above — `kind`, `stage`, `streamedThisTurn`, `deliveredStop`, `truncated`, `rounds`,
// `modelCalls`, `degraded`, `elapsedMs` — and each carries the same value it carries elsewhere.
const COLLAPSE_FIELDS = [
  // integer — `askInFlight()`, the number of requests lib/empty-answer.js has open in THIS
  // container at the moment of the collapse, itself included. It is counted by that module out
  // of its own install and `res.end` hooks; nothing about it is derived from a request body, a
  // header or a question, and it cannot carry a character of prose. It is here because the
  // owner's fourth question about a collapse — «هل سبقَه طلبٌ لم يُغلَقْ» — has no other answer.
  'inFlight',
];

// ── RULE B, CONTINUED: THE SWALLOWED LIBRARY CALL (EZIK-111 FOURTH ORDER, [111-log]) ──────
//
// FOUR new names, all on `[takhrij/call-fail]` in api/ask.js, reviewed one line at a time. The
// line exists because lib/takhrij.js returned [] for every failed library call, so «the library
// did not answer» and «nobody narrated this» were one record. The other two new lines of that
// order print only names already above: `[finalize/drop]` {stage, kind, removed} and
// `[takhrij/degraded]` {source, degraded}. `removed` there is ANSWER prose, capped at 200
// characters in lib/finalize-reader-text.js, exactly the class of the reviewer's `rows` minute
// named at THE BOUNDARY below — never the question.
const CALL_FAIL_FIELDS = [
  // integer — 1, 2 or 3: which of the takhrij pass's three library calls failed (the ladder,
  // one Ṣaḥīḥ at a time, the grade books). A literal passed at each call site in lib/takhrij.js.
  'call',
  // short code — an HTTP status parsed out of the runner's reason ('401', '502'), or one of
  // 'threw' / 'not-a-list' / the runner's own reason word. Built from the library's reply,
  // never from a request body.
  'status',
  // the runner's own `degraded` codes for that call ('library:http_401'), joined and capped at
  // 120 characters. The same codes `degraded` already prints on [free-brain/empty]. The library
  // is reached by POST to a fixed URL, so no transport error can carry the reader's words in it.
  'error',
  // the MATN the pass asked the library for — a quotation the ANSWER wrote, lifted by
  // lib/takhrij.js out of the model's text, cut at 80 characters. Answer prose, not the question,
  // for the reason given for `rows` at THE BOUNDARY below; without it a failed call cannot be
  // told from a silent one, which is the defect the line exists for.
  'q',
];

const ALLOWED = new Set([...ALLOWED_FIELDS, ...STREAM_FIELDS, ...LIVE_WORLD_V2_FIELDS,
  ...COLLAPSE_FIELDS, ...CALL_FAIL_FIELDS]);
const NEWLINE = String.fromCharCode(10);

// ── THE BOUNDARY, WRITTEN DOWN RATHER THAN LEFT TO BE REDISCOVERED ────────────
//
// Three fields survive the sweep and are NOT accidents. They are named here so that the next
// reader argues with a decision instead of finding a hole:
//
//   `entity` / `scholar` / `resolvedScholar` — a scholar's name. It is the SUBJECT the reader
//   asked about, not what he asked, and it is the witness fifteen assertions in
//   guards/name-presence-guard.cjs use to prove which branch of the router ran. The owner's own
//   list named `resolvedTopic` for deletion out of a log line that also prints `resolvedScholar`,
//   and left the second one standing: question content goes, scholar identity stays.
//
//   `verdict` on [free-brain/turn], and `rows` on [free-brain/redactions] — the reviewer's
//   `before`/`after` minute. That is ANSWER prose, not the question, and it is pinned BY NAME in
//   guards/no-empty-answer-guard.cjs as a deliberate 2026-08-16 order (XC-03). Deleting it means
//   reversing that order and rewriting the guard that holds it, which is the owner's call and not
//   a side effect of this one.

const sweep = (source, file) => {
  const findings = [];
  for (const call of scan.consoleCalls(source)) {
    if (!call.balanced) {
      findings.push({ file, line: call.line, rule: 'SCAN', detail: 'unterminated console call' });
      continue;
    }
    const expr = scan.expressionText(call.text);
    for (const denied of DENIED_SOURCES) {
      if (denied.re.test(expr)) {
        findings.push({ file, line: call.line, rule: 'A', detail: denied.why });
      }
    }
    for (const key of scan.objectKeys(call.text)) {
      if (!ALLOWED.has(key)) {
        findings.push({ file, line: call.line, rule: 'B', detail: 'unreviewed field `' + key + '`' });
      }
    }
  }
  return findings;
};

(async () => {
  try {
    // ── A. THE SWEEP READ SOMETHING ───────────────────────────────────────────
    const askPath = path.join(API_DIR, 'ask.js');
    const askSource = fs.readFileSync(askPath, 'utf8');
    const askCalls = scan.consoleCalls(askSource);
    ok('the delivery-path roster is non-empty', DELIVERY_FILES.length >= 8, DELIVERY_FILES.join(','));
    ok('api/ask.js yields console calls to sweep', askCalls.length >= 40, String(askCalls.length));
    ok('every console call on every delivery path terminates',
      DELIVERY_FILES.every((f) => scan.consoleCalls(fs.readFileSync(path.join(API_DIR, f), 'utf8'))
        .every((c) => c.balanced)));

    // ── B. THE TREE IS CLEAN UNDER BOTH RULES ─────────────────────────────────
    const findings = DELIVERY_FILES.flatMap((f) => sweep(fs.readFileSync(path.join(API_DIR, f), 'utf8'), 'api/' + f));
    ok('no delivery path prints a field derived from the reader question',
      findings.filter((x) => x.rule === 'A').length === 0,
      JSON.stringify(findings.filter((x) => x.rule === 'A')));
    ok('every printed field name has been reviewed onto the allow-list',
      findings.filter((x) => x.rule === 'B').length === 0,
      JSON.stringify(findings.filter((x) => x.rule === 'B')));

    // ── C. THE FIELDS THAT WERE DELETED ARE GONE, BY NAME ─────────────────────
    //
    // Rule A would catch them coming back, but naming them makes the regression legible: a
    // failure here says WHICH field returned instead of «a denied expression appeared».
    for (const gone of ['queries: out.spend', 'resolvedTopic: storedContext.resolvedTopic',
      'query: storedOut.searchQuery', 'subject: claimSubject.subject']) {
      ok('deleted and still deleted — `' + gone + '`', !askSource.includes(gone));
    }
    ok('and the counts an autopsy reads were not deleted with them',
      ['domain:', 'rounds:', 'modelCalls:', 'retrieved:', 'cited:', 'cards:', 'tools:',
        'elapsedMs:', 'degraded:', 'corpusCalls:', 'evidence:', 'used:', 'adapters:',
        'publicSearch:', 'publicFetch:'].every((field) => askSource.includes(field)));

    // ── D. THE ONE RUNTIME TOOTH ──────────────────────────────────────────────
    //
    // citedDeliveryLedger is the only logged payload built by an exported function rather than
    // inline, so it is the only one a guard can drive rather than read. Feed it rows whose every
    // text field is a marker and assert the marker never reaches the serialised line — this is
    // the array case (§ «a text field inside an array») proven, not argued.
    const MARKER = 'READER-TEXT-MARKER-9F2A';
    const loop = await import('file://' + path.join(REPO, 'lib', 'free-brain', 'loop.js').replace(/\\/g, '/'));
    const rows = [
      { ref: 1, kind: 'page', url: 'https://binbaz.org.sa/fatwas/1', title: MARKER, text: MARKER },
      { ref: 2, kind: 'page', url: '', title: MARKER, text: MARKER },
      { ref: 3, kind: 'page', url: 'https://binbaz.org.sa/fatwas/1', title: MARKER, text: MARKER },
    ];
    const ledger = loop.citedDeliveryLedger(rows, 2, (row) => ({ tag: 'TAG:' + row.url }));
    ok('the cited-delivery payload carries no reader text out of the rows it summarises',
      !JSON.stringify(ledger).includes(MARKER), JSON.stringify(ledger));
    ok('...and it still reports one outcome per cited row',
      ledger.length === rows.length && ledger.every((r) => typeof r.outcome === 'string'),
      JSON.stringify(ledger));

    // ── E. MUTANTS ────────────────────────────────────────────────────────────
    //
    // Every mutant is applied to api/ask.js IN MEMORY and asserted to have changed the source
    // before its kill is claimed. A transform whose anchor drifted is a no-op that reports a
    // green kill, which is worse than no mutant at all — so an unbuilt mutant prints BROKEN and
    // fails the gate rather than counting as caught.
    const anchor = "console.log('[claim]', {";
    const mutants = [
      {
        name: '1 — a deleted field is put back',
        // BOTH rules, and that is the correct answer rather than a loose one: deleting the field
        // also took `query` off the allow-list, so a restoration is simultaneously a denied
        // expression and an unreviewed name. Asserting the exact pair is what stops this test
        // passing later for a reason nobody checked.
        rules: ['A', 'B'],
        why: 'a restored `query: storedOut.searchQuery` is both a denied source and an unreviewed name',
        transform: (s) => s.replace('        candidates: storedOut.candidateRecordIds,',
          '        query: storedOut.searchQuery,\n        candidates: storedOut.candidateRecordIds,'),
      },
      {
        name: '2 — a new text field under another name',
        rules: ['A', 'B'],
        why: 'renaming defeats neither rule: the expression is still denied and the name is new',
        transform: (s) => s.replace(anchor, anchor + NEWLINE + "        askedAbout: claimSubject.subject,"),
      },
      {
        name: '3 — a text field hidden inside an array, under an allowed name',
        rules: ['A'],
        why: 'the sweep reads the whole argument, so nesting under a reviewed name hides nothing',
        transform: (s) => s.replace(anchor, anchor + NEWLINE + "        source: [claimSubject.subject],"),
      },
      {
        name: '4 — an unreviewed field built from an expression nobody denied',
        rules: ['B'],
        why: 'RULE B alone must have teeth, or the allow-list is decoration on top of RULE A',
        transform: (s) => s.replace(anchor, anchor + NEWLINE + "        phrasing: claimSubject.source,"),
      },
    ];
    for (const mutant of mutants) {
      const mutated = mutant.transform(askSource);
      if (mutated === askSource) {
        ok('BROKEN: mutant ' + mutant.name + ' did not apply — its anchor drifted', false, mutant.why);
        continue;
      }
      ok('mutant seam applied — ' + mutant.name, true);
      const caught = sweep(mutated, 'api/ask.js');
      const rules = [...new Set(caught.map((x) => x.rule))].sort();
      ok('MUTANT KILLED by exactly the rule that owns it — ' + mutant.name,
        caught.length > 0 && JSON.stringify(rules) === JSON.stringify(mutant.rules),
        mutant.why + ' | fired=' + JSON.stringify(rules) + ' expected=' + JSON.stringify(mutant.rules));
    }

    // A mutant that proves the sweep is not merely always-red: a harmless numeric field on an
    // allowed name must NOT trip either rule.
    const benign = askSource.replace(anchor, anchor + "\n        pages: 0,");
    ok('control: the sweep is not simply failing everything',
      benign !== askSource && sweep(benign, 'api/ask.js').length === 0);
  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }

  // ── SECTION E — THE DIAGNOSTIC TRACE (DIAG_TRACE_V1, order د-١, owner ruling 2026-09-25) ─────
  //
  // THE ONE EXCEPTION, AND ITS FENCE. The owner authorised the trace in lib/diag-trace.js to write the
  // question and the texts derived from it (planner queries, drafts, claim sentences) -- ONLY with
  // DIAG_TRACE_V1 on, ONLY on a deployment that is not production, and only as the side/program-20260924
  // preview's row. The rule above stays whole for everything else. So this section proves three things:
  //   E1  the trace is the only other road to stdout: its writer lives in lib/diag-trace.js alone (two
  //       console.log seats, the turn's writer and the probe's), only the reviewed files call diagTrace,
  //       and api/ask.js opens a traced turn only behind `diagTraceDecision().enabled`;
  //   E2  production can never emit: with VERCEL_ENV=production and DIAG_TRACE_V1 (any spelling) and every
  //       other switch on, the decision is off, a traced turn writes nothing, and the probe is not answered;
  //   E3  E2 has teeth: a mutant of lib/diag-trace.js without its production line is caught by E2's checks.
  try {
    const { pathToFileURL } = require('url');
    const os = require('os');
    const DT_FILE = path.join(REPO, 'lib', 'diag-trace.js');
    const dtSource = fs.readFileSync(DT_FILE, 'utf8');
    const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    // E1 — one writer, reviewed callers, a guarded entry.
    const writers = (code(dtSource).match(/console\.(log|warn|info|error|debug)\(/g) || []).length;
    ok('E1a lib/diag-trace.js writes to stdout at exactly two seats (the turn and the probe), and not through process.stdout',
      writers === 2 && !/process\.stdout|process\.stderr/.test(code(dtSource)), 'console seats=' + writers);
    const REVIEWED = ['api/ask.js', 'lib/before-writing.js', 'lib/diag-trace.js', 'lib/encyclopedia.js', 'lib/free-brain/loop.js',
      'lib/issue-match.js', 'lib/ruling-review.js'];
    const callers = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'data') walk(p); continue; }
        if (!/\.(m?js|cjs)$/.test(e.name)) continue;
        if (/\bdiagTrace(Watch)?\s*\(/.test(code(fs.readFileSync(p, 'utf8')))) callers.push(path.relative(REPO, p).split(path.sep).join('/'));
      }
    };
    walk(path.join(REPO, 'api'));
    walk(path.join(REPO, 'lib'));
    ok('E1b only the reviewed files call diagTrace (a new caller is a new review, written here)',
      callers.every((c) => REVIEWED.includes(c)) && callers.includes('api/ask.js'), JSON.stringify(callers));
    const apiCallers = fs.readdirSync(API_DIR).filter((f) => f.endsWith('.js'))
      .filter((f) => /runDiagTraced|diagTraceProbe/.test(code(fs.readFileSync(path.join(API_DIR, f), 'utf8'))));
    const askCode = code(fs.readFileSync(path.join(API_DIR, 'ask.js'), 'utf8'));
    const entry = /if \(diagTraceDecision\(\)\.enabled && !diagTraceActive\(\)\) \{\s*if \(await diagTraceProbe\(req, res\)\) return;\s*return runDiagTraced\(req, res, \(\) => handler\(req, res\)\);\s*\}/;
    ok('E1c a traced turn is opened in api/ask.js alone, and only behind diagTraceDecision().enabled',
      JSON.stringify(apiCallers) === JSON.stringify(['ask.js']) && entry.test(askCode)
      && (askCode.match(/runDiagTraced\(/g) || []).length === 1 && (askCode.match(/diagTraceProbe\(/g) || []).length === 1,
      JSON.stringify(apiCallers));

    // E2 — production never emits, whatever the other switches say.
    const prodChecks = async (DT) => {
      const results = [];
      const ALL_ON = { FREE_BRAIN_V1: 'on', STREAM_V1: 'on', BEFORE_WRITING_V1: 'on', FULL_ANSWER_V1: 'on', ENCYC_V1: 'on', LIB_NAV_V1: 'on',
        LIB_QUOTE_V1: 'on', LIB_MUJAZ_V1: 'on', TAKHRIJ_V1: 'on', DEPTH_FREE_TRIAL: 'on', VERCEL_URL: 'ustaz.example.vercel.app' };
      for (const v of ['on', 'ON', 'true', '1', ' on ']) {
        const env = { ...ALL_ON, VERCEL_ENV: 'production', DIAG_TRACE_V1: v };
        results.push(DT.diagTraceDecision(env).enabled === false);
        const lines = [];
        let ran = false;
        await DT.runDiagTraced({ method: 'POST', url: '/api/ask' }, null, async () => {
          ran = true;
          DT.diagTrace('route', { question: 'سؤال القارئ' });
          results.push(DT.diagTraceActive() === false);
        }, { env, write: (l) => lines.push(l) });
        results.push(ran && lines.length === 0);
        const probeLines = [];
        const res = { setHeader() {}, end() {} };
        results.push(await DT.diagTraceProbe({ method: 'GET', url: '/api/ask?diag_trace_probe=sizes' }, res, { env, write: (l) => probeLines.push(l) }) === false && probeLines.length === 0);
      }
      // and the preview, as a control: the same call writes there.
      const lines = [];
      await DT.runDiagTraced({ method: 'POST', url: '/api/ask' }, null, async () => { DT.diagTrace('route', { question: 'q' }); },
        { env: { VERCEL_ENV: 'preview', DIAG_TRACE_V1: 'on' }, write: (l) => lines.push(l) });
      return { prodSilent: results.every(Boolean), previewWrites: lines.length > 0 };
    };
    const real = await prodChecks(await import(pathToFileURL(DT_FILE).href));
    ok('E2  production: the decision is off for every spelling of on, a traced turn writes nothing, the probe is not answered',
      real.prodSilent, JSON.stringify(real));
    ok('E2c control: on a preview the same traced turn writes', real.previewWrites, JSON.stringify(real));

    // E3 — the production line is load-bearing.
    const prodLine = /^\s*if \(String\(env\.VERCEL_ENV \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'production'\) return \{ enabled: false, reason: 'production' \};\n/m;
    const mutated = dtSource.replace(prodLine, '');
    ok('E3a mutant seam applied — the production line removed from diagTraceDecision', mutated !== dtSource);
    if (mutated !== dtSource) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-e3-'));
      try {
        const file = path.join(dir, 'diag-trace-mutant.mjs');
        fs.writeFileSync(file, mutated);
        const mutant = await prodChecks(await import(pathToFileURL(file).href));
        ok('E3b MUTANT KILLED — without its production line the trace would emit in production, and E2 sees it',
          mutant.prodSilent === false, JSON.stringify(mutant));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    ok('section E completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
