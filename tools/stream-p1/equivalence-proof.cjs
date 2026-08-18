#!/usr/bin/env node
/**
 * STREAM-P1 §٣ — THE GATE BEFORE ANY CHARACTER GOES ON THE WIRE.
 *
 * The sentence-by-sentence reviewer is replayed over the owner's RECORDED answers
 * and its result is compared with the whole-text reviewer's. The condition is a
 * BYTE match, and two things are compared, not one:
 *
 *   TEXT   `createReviewStream(...).end().text` vs `reviewAnswer(...).text`
 *   WIRE   everything actually emitted, in the order it was emitted, joined the way
 *          the answer is joined. This is the check that catches a stream which
 *          reaches the right final text by rewriting something it already sent.
 *
 * The verdict also carries the annotations, so a difference in WHICH rule fired is
 * caught even when the two texts happen to agree.
 *
 * Every difference is named with its text and with the line of the check that
 * produced it — the action recorded against the sentence is mapped back to the
 * line in lib/output-reviewer.js that records it.
 *
 * A GATE THAT CANNOT FAIL PROVES NOTHING. `--selftest` runs the same comparison
 * against deliberately broken copies of the stream, one per claim the gate is
 * supposed to be making, and demands that every one of them FAILS. The mutation is
 * verified to have actually changed the source before the copy is run, so a mutant
 * that quietly did not apply cannot report a pass.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const SRC = path.join(__dirname, '..', '..', 'lib', 'output-reviewer.js');

/**
 * One mutant per claim. `find` must occur exactly once inside createReviewStream.
 */
const MUTANTS = [
  {
    name: 'eager-last-unit',
    claim: 'an incomplete sentence is never streamed',
    find: 'return advance(reviewUnits(buffer).length - 1);',
    replace: 'return advance(reviewUnits(buffer).length);',
  },
  {
    name: 'notice-at-front',
    claim: 'the global level only appends, never gets in front of sent text',
    find: '        output.splice(at, 0, ...notices);',
    replace: '        output.splice(0, 0, ...notices);',
  },
  {
    name: 'drop-general-accumulator',
    claim: 'a per-sentence flag still reaches the answer-level notice',
    find: '    sawGeneralStable = true;',
    replace: '    sawGeneralStable = false;',
  },
  {
    name: 'local-khilaf-tail',
    claim: 'the disagreement tail is decided once, at the end, not per sentence',
    find: '      if (!khilafFromModelProse && modelProseDeclaresKhilaf(part)) khilafFromModelProse = true;',
    replace: '      if (modelProseDeclaresKhilaf(part)) khilafFromModelProse = false;',
  },
];

/** Write a mutated copy and PROVE the mutation landed. */
function mutatedCopy(mutant) {
  const source = fs.readFileSync(SRC, 'utf8');
  const at = source.indexOf('export function createReviewStream');
  if (at < 0) throw new Error('createReviewStream not found');
  const head = source.slice(0, at);
  const tail = source.slice(at);
  const hits = tail.split(mutant.find).length - 1;
  if (hits !== 1) {
    throw new Error(`mutant ${mutant.name}: anchor found ${hits} times in createReviewStream, expected 1`);
  }
  const mutatedTail = tail.replace(mutant.find, mutant.replace);
  const mutated = head + mutatedTail;
  if (mutated === source) throw new Error(`mutant ${mutant.name}: source unchanged`);
  const dir = path.join(os.tmpdir(), 'ezik-stream-p1');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mutant-${mutant.name}.mjs`);
  fs.writeFileSync(file, mutated, 'utf8');
  return file;
}

/** action name -> the line in the reviewer that records it. */
function actionLines() {
  const lines = fs.readFileSync(SRC, 'utf8').split('\n');
  const map = new Map();
  lines.forEach((line, i) => {
    const m = /actionRecord\([^,]+,\s*[^,]+,\s*'([a-z-]+)'/.exec(line);
    if (m && !map.has(m[1])) map.set(m[1], i + 1);
  });
  return map;
}

/** Deterministic chunkings. No randomness: a proof that cannot be replayed is not one. */
const CHUNKERS = {
  whole: (t) => [t],
  chars: (t) => [...t],
  size3: (t) => t.match(/[\s\S]{1,3}/gu) || [],
  size17: (t) => t.match(/[\s\S]{1,17}/gu) || [],
  size64: (t) => t.match(/[\s\S]{1,64}/gu) || [],
  words: (t) => t.match(/\S+\s*/gu) || [],
  lines: (t) => t.split(/(?<=\n)/u),
};

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return {
    at: i,
    oracle: a.slice(Math.max(0, i - 60), i + 120),
    stream: b.slice(Math.max(0, i - 60), i + 120),
  };
}

async function runProof(moduleHref, corpusPath, quiet) {
  const mod = await import(moduleHref);
  const { reviewAnswer, createReviewStream } = mod;
  const lineOf = actionLines();
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

  // Per-character replay is quadratic in the answer's length, so it runs over the
  // twenty shortest answers rather than all of them. That is stated, not hidden.
  const byLength = [...corpus].sort((a, b) => a.text.length - b.text.length);
  const charSet = new Set(byLength.slice(0, 20).map((r) => r.id));

  const domains = ['fiqh', 'general', 'mixed'];
  const evidences = [[], null];
  const pool = (() => {
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
    return found;
  })();
  evidences[1] = pool;

  const diffs = [];
  const violations = [];
  let comparisons = 0;
  let matched = 0;
  const answersOk = new Set();
  const answersBad = new Set();
  const byChunker = {};

  for (const record of corpus) {
    for (const domain of domains) {
      for (const evidence of evidences) {
        for (const truncated of [false, true]) {
          const input = {
            text: record.text,
            evidence,
            domain,
            mode: 'standard',
            truncated,
            khilafFromOpinions: truncated ? true : null,
            opinionCount: truncated ? 2 : null,
          };
          const oracle = reviewAnswer(input);

          for (const [name, chunk] of Object.entries(CHUNKERS)) {
            if (name === 'chars' && !charSet.has(record.id)) continue;
            comparisons += 1;
            byChunker[name] = byChunker[name] || { runs: 0, bad: 0 };
            byChunker[name].runs += 1;

            const stream = createReviewStream(input);
            const wire = [];
            for (const piece of chunk(record.text)) wire.push(...stream.push(piece));
            const closed = stream.end();
            wire.push(...closed.tail, ...closed.notices);

            const wireText = wire.join('\n').trim();
            const textOk = closed.text === oracle.text;
            const wireOk = wireText === oracle.text;
            const annOk = JSON.stringify(closed.verdict.sentences)
              === JSON.stringify(oracle.verdict.sentences);
            const verdictOk = JSON.stringify(closed.verdict) === JSON.stringify(oracle.verdict);

            if (closed.violations.length) {
              violations.push({ id: record.id, domain, truncated, chunker: name, list: closed.violations });
            }

            if (textOk && wireOk && annOk && verdictOk) {
              matched += 1;
              answersOk.add(record.id);
              continue;
            }
            byChunker[name].bad += 1;
            answersBad.add(record.id);
            if (diffs.length < 40) {
              const failing = !textOk ? 'text' : !wireOk ? 'wire' : !annOk ? 'annotations' : 'verdict';
              const d = firstDifference(oracle.text, failing === 'wire' ? wireText : closed.text);
              // Name the check: the first action the two runs disagree on.
              let culprit = null;
              const os = oracle.verdict.sentences;
              const ss = closed.verdict.sentences;
              for (let i = 0; i < Math.max(os.length, ss.length); i += 1) {
                const a = os[i];
                const b = ss[i];
                if (JSON.stringify(a) !== JSON.stringify(b)) {
                  culprit = {
                    ordinal: i,
                    oracleAction: a ? a.action : null,
                    streamAction: b ? b.action : null,
                    oracleLine: a ? (lineOf.get(a.action) || null) : null,
                    streamLine: b ? (lineOf.get(b.action) || null) : null,
                    oracleSentence: a ? a.sentence : null,
                    streamSentence: b ? b.sentence : null,
                  };
                  break;
                }
              }
              diffs.push({
                id: record.id, domain, truncated, chunker: name, failing, ...d, culprit,
              });
            }
          }
        }
      }
    }
  }

  const report = {
    corpus: corpusPath,
    answers: corpus.length,
    comparisons,
    matched,
    mismatched: comparisons - matched,
    answersFullyMatched: [...answersOk].filter((id) => !answersBad.has(id)).length,
    answersWithAnyMismatch: answersBad.size,
    byChunker,
    charReplayLimitedTo: [...charSet],
    violations,
    diffs,
  };

  report.pass = report.mismatched === 0 && violations.length === 0;
  if (quiet) return report;

  console.log('CORPUS      ' + corpus.length + ' recorded answers');
  console.log('COMPARISONS ' + comparisons + '  (domain x evidence x truncated x chunking)');
  console.log('MATCHED     ' + matched + ' / ' + comparisons);
  console.log('ANSWERS     ' + report.answersFullyMatched + ' / ' + corpus.length
    + ' matched under every configuration');
  console.log('');
  console.log('per chunking:');
  for (const [name, s] of Object.entries(byChunker)) {
    console.log('  ' + name.padEnd(7) + ' runs ' + String(s.runs).padStart(6)
      + '   mismatched ' + s.bad);
  }
  console.log('\nper-character replay limited to the ' + charSet.size + ' shortest answers'
    + ' (quadratic replay cost); every other chunking ran on all ' + corpus.length + '.');
  console.log('§٥/١ violations reported by the stream: ' + violations.length);

  if (diffs.length) {
    console.log('\nDIFFERENCES (first ' + diffs.length + '):');
    for (const d of diffs) {
      console.log('  ' + d.id + '  domain=' + d.domain + ' truncated=' + d.truncated
        + ' chunker=' + d.chunker + ' failing=' + d.failing + ' at byte ' + d.at);
      if (d.culprit) {
        console.log('    check: oracle ' + d.culprit.oracleAction + ' (line '
          + d.culprit.oracleLine + ')  vs stream ' + d.culprit.streamAction
          + ' (line ' + d.culprit.streamLine + ')');
      }
    }
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const selftest = args.includes('--selftest');
  const positional = args.filter((a) => !a.startsWith('--'));
  const corpusPath = positional[0];
  const outPath = positional[1];
  if (!corpusPath) {
    console.error('usage: equivalence-proof.cjs <corpus.json> [out.json] [--selftest]');
    process.exit(2);
  }

  const report = await runProof(url.pathToFileURL(SRC).href, corpusPath, false);
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('\nwrote ' + outPath);
  }
  console.log('\n' + (report.pass ? 'GATE PASS' : 'GATE FAIL'));

  let selftestOk = true;
  if (selftest) {
    console.log('\nSELFTEST — each mutant must be caught:');
    for (const mutant of MUTANTS) {
      let caught;
      let detail;
      try {
        const file = mutatedCopy(mutant);
        const r = await runProof(url.pathToFileURL(file).href, corpusPath, true);
        caught = !r.pass;
        detail = 'mismatched ' + r.mismatched + '/' + r.comparisons
          + ', violations ' + r.violations.length;
      } catch (e) {
        // A mutant that makes the module throw is also caught, but say so plainly.
        caught = true;
        detail = 'threw: ' + String(e.message || e).slice(0, 80);
      }
      if (!caught) selftestOk = false;
      console.log('  ' + (caught ? 'CAUGHT ' : 'MISSED ') + mutant.name.padEnd(26)
        + detail + '\n           claim: ' + mutant.claim);
    }
    console.log('\nSELFTEST ' + (selftestOk ? 'PASS' : 'FAIL')
      + ' — ' + MUTANTS.length + ' mutants, ' + (selftestOk ? 'all caught' : 'one or more MISSED'));
  }

  process.exit(report.pass && selftestOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
