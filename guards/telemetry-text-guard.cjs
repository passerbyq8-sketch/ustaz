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
  'action', 'adapters', 'ageFloorOutcome', 'band', 'braveSearch', 'budgetEnvironment',
  'budgetReason', 'candidates', 'card', 'cards', 'carried', 'citationRetries', 'cited',
  'contentModes', 'corpusCalls', 'count', 'degraded', 'deliveredStop', 'destructive', 'domain',
  'dropWhole', 'dropped', 'droppedSentences', 'duplicate', 'elapsedMs', 'emitted', 'enabled',
  'entity', 'evidence', 'fatwaScholars', 'fatwaSearch', 'fatwaStatus', 'fatwaTotal', 'flag',
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
const ALLOWED = new Set(ALLOWED_FIELDS);
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
  process.exit(finish());
})();
