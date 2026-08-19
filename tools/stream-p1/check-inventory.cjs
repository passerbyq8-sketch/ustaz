#!/usr/bin/env node
/**
 * STREAM-P1 §2 — the LOCAL / GLOBAL table, measured, not guessed.
 *
 * METHOD. Internal `function` declarations in lib/output-reviewer.js are mutable
 * module bindings, so an instrumented copy reassigns each to a probe and the REAL
 * reviewer is then driven over the owner's recorded answers. Two things are
 * recorded per check:
 *
 *   1. WHICH PHASE it ran in. reviewAnswer has exactly three: the structural split,
 *      the per-sentence loop, and the closing block that builds notices and the
 *      verdict. The phase is stamped at three anchors in the real source, so this
 *      is observation of the actual control flow and not a reading of it.
 *   2. WHETHER IT MOVED AN ANSWER-LEVEL ACCUMULATOR. A check can run per sentence
 *      and still be global in effect, because all it does is raise a flag that only
 *      the closing block reads. That is the third category a two-level design needs.
 *
 * VERDICTS
 *   LOCAL         ran only in the sentence phase; its result lands on that sentence.
 *   LOCAL/GLOBAL  ran per sentence, but feeds only an answer-level accumulator, so
 *                 the sentence may be emitted and the flag settled later.
 *   SHARED        ran in the sentence phase AND in a later phase. It is a primitive,
 *                 not a check with a level: local callers may use it at sentence
 *                 completion, and the global callers appear as their own rows.
 *   GLOBAL        never ran in the sentence phase; needs text it cannot have until
 *                 the answer is complete.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'output-reviewer.js');
const DECL_RE = /^function\s+([A-Za-z_$][\w$]*)\s*\(/;

// The three anchors are exact lines of the real source. If any stops matching the
// measurement is void rather than silently wrong.
const ANCHORS = [
  ['  for (const run of splitStructure(text)) {', 'structure'],
  ['    for (const part of sentenceParts(run.text)) {', 'sentence'],
  ['  const notices = [];', 'final'],
];

// Answer-level accumulators: set inside the sentence loop, read only after it.
const ACCUMULATORS = [
  'sawFiqhUnsourced', 'sawGeneralStable', 'khilafFromSource', 'khilafFromModelProse',
];

function declarations(source) {
  const out = [];
  source.split('\n').forEach((line, i) => {
    const m = DECL_RE.exec(line);
    if (m) out.push({ name: m[1], line: i + 1 });
  });
  return out;
}

function stampPhases(source) {
  let out = source;
  for (const [anchor, phase] of ANCHORS) {
    if (!out.includes(anchor)) {
      throw new Error('anchor drifted, measurement void: ' + anchor.trim());
    }
    const stamp = phase === 'final'
      ? "  globalThis.__PHASE__ = 'final';\n" + anchor
      : anchor + "\n    globalThis.__PHASE__ = '" + phase + "';";
    out = out.replace(anchor, stamp);
  }
  return out;
}

function instrument(source, names) {
  const stamped = stampPhases(source);
  const marker = stamped.indexOf('export function reviewAnswer');
  if (marker < 0) throw new Error('reviewAnswer export not found');
  const shim = names.map((n) => (
    '{ const __o_' + n + ' = ' + n + ';'
    + ' ' + n + ' = function (...a) { globalThis.__PROBE__ && globalThis.__PROBE__("' + n + '");'
    + ' return __o_' + n + '.apply(this, a); }; }'
  )).join('\n');
  return stamped.slice(0, marker) + '\n/* __INSTRUMENTED__ */\n' + shim + '\n\n' + stamped.slice(marker);
}

/** Which checks sit on a statement that raises an answer-level accumulator. */
function accumulatorFeeders(source, names) {
  const lines = source.split('\n');
  const feeders = new Map();
  lines.forEach((line, i) => {
    for (const acc of ACCUMULATORS) {
      if (!new RegExp('\\b' + acc + '\\s*=').test(line)) continue;
      // The condition that raised the flag is on this line or on the one guarding it.
      const window = [lines[i - 1] || '', line].join(' ');
      for (const n of names) {
        if (new RegExp('\\b' + n + '\\s*\\(').test(window)) {
          if (!feeders.has(n)) feeders.set(n, new Set());
          feeders.get(n).add(acc);
        }
      }
    }
  });
  return feeders;
}

function evidencePool() {
  const file = path.join(__dirname, '..', '..', 'fixtures', 'output-reviewer-six-cases.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (Array.isArray(node.evidence)) found.push(...node.evidence);
    for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(json);
  const seen = new Set();
  return found.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The recorded answers contain no claim the reviewer calls variable, so the dated-source
 * route never runs on them. The repo's own measured corpus does contain such claims; each
 * is paired with a DATED source built from that same fixture's provenance, so the route is
 * exercised without inventing a fact.
 */
function variableClaimRuns() {
  const file = path.join(__dirname, '..', '..', 'fixtures', 'reviewer-variable-claim-corpus.json');
  if (!fs.existsSync(file)) return [];
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cases = Array.isArray(json.cases) ? json.cases : [];
  const date = String(json.measuredAt || '').slice(0, 10) || '2026-08-16';
  return cases.filter((c) => c && typeof c.text === 'string' && c.text.trim()).map((c) => ({
    text: c.text,
    evidence: [{
      id: 'variable-claim-' + c.id,
      title: String(json.source || 'measured corpus'),
      url: 'https://example.invalid/' + encodeURIComponent(String(c.id)),
      snippet: c.text,
      date,
    }],
  }));
}

async function main() {
  const corpusPath = process.argv[2];
  const outPath = process.argv[3];
  if (!corpusPath) {
    console.error('usage: check-inventory.cjs <corpus.json> [out.json]');
    process.exit(2);
  }

  const source = fs.readFileSync(SRC, 'utf8');
  const decls = declarations(source);
  const names = decls.map((d) => d.name);
  const feeders = accumulatorFeeders(source, names);

  const tmpDir = path.join(os.tmpdir(), 'ezik-stream-p1');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmp = path.join(tmpDir, 'output-reviewer.instrumented.mjs');
  fs.writeFileSync(tmp, instrument(source, names), 'utf8');
  const probed = await import(url.pathToFileURL(tmp).href);

  const obs = new Map(decls.map((d) => [d.name, {
    name: d.name,
    line: d.line,
    calls: 0,
    phases: { structure: 0, sentence: 0, final: 0, other: 0 },
  }]));

  globalThis.__PROBE__ = (name) => {
    const rec = obs.get(name);
    if (!rec) return;
    rec.calls += 1;
    const phase = globalThis.__PHASE__ || 'other';
    rec.phases[phase] = (rec.phases[phase] || 0) + 1;
  };

  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const pool = evidencePool();
  const evidences = [[], pool];
  const domains = ['fiqh', 'general', 'mixed'];
  let runs = 0;
  for (const record of corpus) {
    for (const domain of domains) {
      for (const evidence of evidences) {
        for (const truncated of [false, true]) {
          globalThis.__PHASE__ = 'other';
          probed.reviewAnswer({
            text: record.text,
            evidence,
            domain,
            mode: 'standard',
            truncated,
            khilafFromOpinions: truncated ? true : null,
            opinionCount: truncated ? 2 : null,
          });
          runs += 1;
        }
      }
    }
  }
  // The dated-source route, exercised from the repo's own variable-claim corpus.
  const extra = variableClaimRuns();
  for (const item of extra) {
    for (const domain of ['general', 'mixed']) {
      globalThis.__PHASE__ = 'other';
      probed.reviewAnswer({
        text: item.text, evidence: item.evidence, domain, mode: 'standard', truncated: false,
      });
      runs += 1;
    }
  }
  globalThis.__PROBE__ = null;

  // `other` is everything before the structural loop is entered: the evidence is
  // normalised there, and §٥/٢ already has it in hand before the first character.
  // That is setup, not a check that must wait for the answer to finish.
  const verdictOf = (r) => {
    const late = r.phases.structure + r.phases.final;
    if (!r.phases.sentence && !late && r.phases.other) return 'SETUP';
    if (!r.phases.sentence) return 'GLOBAL';
    if (late || r.phases.other) return 'SHARED';
    if (feeders.has(r.name)) return 'LOCAL/GLOBAL';
    return 'LOCAL';
  };

  const rows = [...obs.values()].filter((r) => r.calls > 0)
    .map((r) => ({ ...r, verdict: verdictOf(r), feeds: [...(feeders.get(r.name) || [])] }))
    .sort((a, b) => a.line - b.line);
  const unexercised = [...obs.values()].filter((r) => r.calls === 0).sort((a, b) => a.line - b.line);

  console.log('runs: ' + runs + '  (' + corpus.length + ' answers x ' + domains.length
    + ' domains x 2 evidence x 2 truncated)');
  console.log('evidence pool: ' + pool.length + ' items from fixtures/output-reviewer-six-cases.json');
  console.log('declared checks: ' + decls.length + '   exercised: ' + rows.length
    + '   never called: ' + unexercised.length);
  console.log('');
  console.log('line  verdict       calls   setup   struct  sentence   final  name / feeds');
  for (const r of rows) {
    console.log(
      String(r.line).padStart(4),
      r.verdict.padEnd(12),
      String(r.calls).padStart(9),
      String(r.phases.other).padStart(6), String(r.phases.structure).padStart(7),
      String(r.phases.sentence).padStart(9),
      String(r.phases.final).padStart(7),
      ' ' + r.name + (r.feeds.length ? '  -> ' + r.feeds.join(',') : ''),
    );
  }
  const tally = rows.reduce((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] || 0) + 1;
    return acc;
  }, {});
  console.log('\ntally: ' + JSON.stringify(tally));
  console.log('\nNEVER CALLED on this corpus (unmeasured, deliberately left unclassified):');
  for (const r of unexercised) console.log(String(r.line).padStart(4), ' ', r.name);

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify({
      runs, poolSize: pool.length, rows, unexercised,
    }, null, 2), 'utf8');
    console.log('\nwrote ' + outPath);
  }
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
