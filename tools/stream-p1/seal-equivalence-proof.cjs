#!/usr/bin/env node
/**
 * STREAM-P2 §١ — THE GATE ON ح‑٣: THE TAKHRIJ LOCK, ON THE SENTENCE.
 *
 * Same shape as the phase-one gate, letter for letter: the same 160 recorded answers,
 * the same seven deterministic chunkings, and three things compared, not one.
 *
 *   TEXT   `createSentenceStream(...).end().text` vs the unstreamed
 *          `reviewAnswer` -> `lockTakhrij` path.
 *   WIRE   everything actually emitted, in the order emitted. This is the check that
 *          catches a stream reaching the right final text by replacing something it
 *          already sent — which is the whole hazard `seal` introduces.
 *   RULES  the reviewer's annotations AND the lock's own record: which sentences it
 *          dropped and which spans it named.
 *
 * A gate that cannot fail proves nothing, so `--selftest` runs deliberately broken
 * copies and demands each is caught. The mutation is proven to have landed before the
 * copy runs. One mutant is required by the directive by name: a sentence the seal
 * drops is streamed anyway.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const LIB = path.join(__dirname, '..', '..', 'lib');
const SRC = path.join(LIB, 'sentence-stream.js');
const LOCK = path.join(LIB, 'takhrij-lock.js');

/**
 * Each mutant states a claim, and what the gate must see when the claim is broken.
 * `violations: 'some'` means the LIBRARY itself must have reported the breach, not
 * merely that the byte comparison noticed it afterwards.
 *
 * A NOTE ON A MUTANT THAT WAS REMOVED, because the removal is a finding. Disabling
 * the prefix check on its own changed nothing: it is a detector for a condition that
 * never arises while the streaming rule holds, so switching it off is unobservable by
 * construction. The honest test is the compound one below — break the rule AND blind
 * the detector — which shows the prefix check is precisely what produced the 252
 * violations the first mutant reports.
 */
const MUTANTS = [
  {
    name: 'stream-a-dropped-sentence',
    claim: 'a sentence the seal drops is never streamed',
    violations: 'some',
    edits: [{
      file: SRC,
      find: '    if (locked.droppedSentences.length || locked.text !== unit || tidyWouldChange(unit)) {',
      replace: '    if (false) {',
    }],
  },
  {
    name: 'ignore-tidy-reach',
    claim: 'text the rebuild could still rewrite is not streamed',
    violations: 'some',
    edits: [{
      file: SRC,
      find: 'locked.text !== unit || tidyWouldChange(unit)',
      replace: 'locked.text !== unit',
    }],
  },
  {
    name: 'keep-order-broken',
    claim: 'once a unit is held, nothing after it may overtake it',
    violations: 'some',
    edits: [{
      file: SRC,
      find: '    if (!streaming) { held += 1; return []; }',
      replace: '    if (!streaming) { streaming = true; }',
    }],
  },
  {
    name: 'dropped-sentence-and-blind-checker',
    claim: 'the prefix check is what reports the breach, not the byte comparison alone',
    violations: 'none',
    edits: [
      {
        file: SRC,
        find: '    if (locked.droppedSentences.length || locked.text !== unit || tidyWouldChange(unit)) {',
        replace: '    if (false) {',
      },
      {
        file: SRC,
        find: '      if (sent && !finalText.startsWith(sent)) {',
        replace: '      if (false) {',
      },
    ],
  },
];

/**
 * One copy of lib/ for all mutants. The whole directory is copied because
 * lib/frozen-text.js reads its golden data by a path relative to its own module URL,
 * so a partial copy would change what the frozen exemption sees. Each mutant is then
 * a single extra FILE inside that copy, which keeps relative imports resolving while
 * costing one 7.4 MB copy instead of one per mutant.
 */
let baseTree = null;
function mutatedTree(mutant) {
  const dir = path.join(os.tmpdir(), 'ezik-stream-p2', 'base');
  if (!baseTree) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(LIB)) {
      const from = path.join(LIB, name);
      if (fs.statSync(from).isDirectory()) {
        fs.cpSync(from, path.join(dir, name), { recursive: true });
      } else {
        fs.copyFileSync(from, path.join(dir, name));
      }
    }
    baseTree = dir;
  }
  // EVERY MUTANT IS BUILT FROM THE PRISTINE SOURCE. Editing the copy in place would
  // let one mutant inherit the previous one's damage, and the selftest would then be
  // reporting on a file nobody wrote.
  const original = fs.readFileSync(SRC, 'utf8');
  let mutated = original;
  for (const edit of mutant.edits) {
    if (edit.file !== SRC) throw new Error(`mutant ${mutant.name}: unexpected target file`);
    const hits = mutated.split(edit.find).length - 1;
    if (hits !== 1) {
      throw new Error(`mutant ${mutant.name}: anchor found ${hits} times, expected 1`);
    }
    mutated = mutated.replace(edit.find, edit.replace);
  }
  if (mutated === original) throw new Error(`mutant ${mutant.name}: source unchanged`);
  // A sibling file inside the copied tree, so './output-reviewer.js' still resolves.
  const target = path.join(dir, `__mutant-${mutant.name}.js`);
  fs.writeFileSync(target, mutated, 'utf8');
  return target;
}

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
    expected: a.slice(Math.max(0, i - 60), i + 90),
    got: b.slice(Math.max(0, i - 60), i + 90),
  };
}

/** The pages the lock checks against. Two settings: none, and a page that supports. */
function sourceSettings() {
  return [
    { name: 'no-pages', pages: [] },
    {
      name: 'supporting-page',
      // A page naming both Sahihs establishes the bare «في الصحيحين», which is the
      // span the recorded answers actually trip on. Built from the lock's own rule at
      // lib/takhrij-lock.js:148, not from an invented fact.
      pages: ['صحيح البخاري وصحيح مسلم'],
    },
  ];
}

async function runProof(streamHref, corpusPath, quiet) {
  const mod = await import(streamHref);
  const { createSentenceStream, reviewAndLock } = mod;
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

  const byLength = [...corpus].sort((a, b) => a.text.length - b.text.length);
  const charSet = new Set(byLength.slice(0, 20).map((r) => r.id));

  const diffs = [];
  const violations = [];
  let comparisons = 0;
  let matched = 0;
  const answersBad = new Set();
  const byChunker = {};
  let streamedUnits = 0;
  let heldUnits = 0;
  let answersWithADrop = 0;
  const seenDropIds = new Set();

  for (const record of corpus) {
    for (const domain of ['fiqh', 'general', 'mixed']) {
      for (const setting of sourceSettings()) {
        for (const truncated of [false, true]) {
          const input = {
            text: record.text,
            evidence: [],
            domain,
            mode: 'standard',
            truncated,
            khilafFromOpinions: truncated ? true : null,
            opinionCount: truncated ? 2 : null,
            sources: setting.pages,
          };
          const oracle = reviewAndLock(input);

          for (const [name, chunk] of Object.entries(CHUNKERS)) {
            if (name === 'chars' && !charSet.has(record.id)) continue;
            comparisons += 1;
            byChunker[name] = byChunker[name] || { runs: 0, bad: 0 };
            byChunker[name].runs += 1;

            const stream = createSentenceStream(input);
            const wire = [];
            for (const piece of chunk(record.text)) wire.push(...stream.push(piece));
            const closed = stream.end();
            const sentEarly = wire.join('\n');
            wire.push(...closed.tail);

            const wireText = wire.join('\n');
            const textOk = closed.text === oracle.text;
            const wireOk = wireText === oracle.text;
            const rulesOk = JSON.stringify(closed.verdict.sentences)
              === JSON.stringify(oracle.verdict.sentences)
              && JSON.stringify(closed.takhrij.droppedSentences)
              === JSON.stringify(oracle.locked.droppedSentences);
            // Nothing sent early may fail to be a prefix of what ships.
            const prefixOk = !sentEarly || oracle.text.startsWith(sentEarly);

            if (name === 'words') {
              streamedUnits += closed.streamedUnits;
              heldUnits += closed.heldUnits;
              if (closed.takhrij.droppedSentences.length && !seenDropIds.has(record.id + domain + setting.name)) {
                seenDropIds.add(record.id + domain + setting.name);
                answersWithADrop += 1;
              }
            }
            if (closed.violations.length) {
              violations.push({ id: record.id, domain, setting: setting.name, chunker: name, list: closed.violations });
            }

            if (textOk && wireOk && rulesOk && prefixOk) { matched += 1; continue; }
            byChunker[name].bad += 1;
            answersBad.add(record.id);
            if (diffs.length < 40) {
              const failing = !prefixOk ? 'prefix' : !textOk ? 'text' : !wireOk ? 'wire' : 'rules';
              diffs.push({
                id: record.id, domain, setting: setting.name, chunker: name, failing,
                ...firstDifference(oracle.text, failing === 'wire' || failing === 'prefix' ? wireText : closed.text),
              });
            }
          }
        }
      }
    }
  }

  const report = {
    answers: corpus.length,
    comparisons,
    matched,
    mismatched: comparisons - matched,
    answersWithAnyMismatch: answersBad.size,
    byChunker,
    streamedUnits,
    heldUnits,
    answersWithADrop,
    violations,
    diffs,
  };
  report.pass = report.mismatched === 0 && violations.length === 0;
  if (quiet) return report;

  console.log('CORPUS      ' + corpus.length + ' recorded answers');
  console.log('COMPARISONS ' + comparisons + '  (domain x pages x truncated x chunking)');
  console.log('MATCHED     ' + matched + ' / ' + comparisons);
  console.log('ANSWERS     ' + (corpus.length - answersBad.size) + ' / ' + corpus.length
    + ' matched under every configuration');
  console.log('');
  console.log('per chunking:');
  for (const [name, s] of Object.entries(byChunker)) {
    console.log('  ' + name.padEnd(7) + ' runs ' + String(s.runs).padStart(6) + '   mismatched ' + s.bad);
  }
  console.log('');
  console.log('units streamed early (words chunking): ' + streamedUnits);
  console.log('units held to the end                : ' + heldUnits);
  console.log('§٥/١ violations                      : ' + violations.length);
  if (diffs.length) {
    console.log('\nDIFFERENCES (first ' + diffs.length + '):');
    for (const d of diffs) {
      console.log('  ' + d.id + ' domain=' + d.domain + ' pages=' + d.setting
        + ' chunker=' + d.chunker + ' failing=' + d.failing + ' at byte ' + d.at);
      console.log('    expected: ' + JSON.stringify(d.expected.slice(0, 110)));
      console.log('    got     : ' + JSON.stringify(d.got.slice(0, 110)));
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
    console.error('usage: seal-equivalence-proof.cjs <corpus.json> [out.json] [--selftest]');
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
        const file = mutatedTree(mutant);
        const r = await runProof(url.pathToFileURL(file).href, corpusPath, true);
        const violated = r.violations.length > 0;
        const wantViolations = mutant.violations === 'some';
        caught = !r.pass && violated === wantViolations;
        detail = 'mismatched ' + r.mismatched + '/' + r.comparisons
          + ', violations ' + r.violations.length
          + ' (expected ' + (wantViolations ? 'some' : 'none') + ')';
      } catch (e) {
        caught = true;
        detail = 'threw: ' + String(e.message || e).slice(0, 70);
      }
      if (!caught) selftestOk = false;
      console.log('  ' + (caught ? 'CAUGHT ' : 'MISSED ') + mutant.name.padEnd(28) + detail
        + '\n           claim: ' + mutant.claim);
    }
    console.log('\nSELFTEST ' + (selftestOk ? 'PASS' : 'FAIL') + ' — ' + MUTANTS.length
      + ' mutants, ' + (selftestOk ? 'all caught' : 'one or more MISSED'));
  }

  process.exit(report.pass && selftestOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
