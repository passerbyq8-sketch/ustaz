#!/usr/bin/env node
/**
 * STREAM-P5 §٢ — THE GATE: A UNIT CARRYING AN INVENTED REFERENCE NUMBER IS NOT STREAMED.
 *
 * `dropOrphanRefNumbers` (lib/free-brain/loop.js:195) runs at loop.js:1435 on the whole
 * reviewed text, after the reviewer. It deletes every `[1]`-style group and folds the
 * whitespace the deletion leaves. A unit already on the wire carrying one would be edited
 * after the reader read it, which §٥/١ forbids. `refDropWouldChange` in lib/sentence-stream.js
 * makes such a unit wait.
 *
 * ── THE ORACLE IS THE REAL FUNCTION, NOT THE MIRROR ──────────────────────────────────
 * Every emitted unit is judged by `dropOrphanRefNumbers` ITSELF, imported from the loop.
 * If the judge were the streaming module's own predicate, a mutant that blinds the
 * predicate would blind the judge with it and the gate would report PASS on a broken
 * tree. The mirror is checked SEPARATELY, against the same authority.
 *
 * ── THREE CLAIMS, AND ONE OF THEM EXISTS TO STOP THE CHEAP ANSWER ────────────────────
 *   SAFETY     no emitted unit may be one the reference pass would still change.
 *   LIVENESS   units carrying no reference number must STILL go out early. Without this,
 *              «hold everything» satisfies SAFETY perfectly and deletes the feature.
 *   MIRROR     `refDropWouldChange` answers exactly what `dropOrphanRefNumbers` does.
 *
 * ── AND A FOURTH, NAMED BY THE DIRECTIVE ─────────────────────────────────────────────
 *   THE NAMED CASE   an answer whose first sentence is clean and whose second carries a
 *                    reference number: the first must go out, the second must not. This
 *                    is the case that separates «holds it» from «holds everything».
 *
 * Usage: orphan-ref-gate.cjs [--mutants] [corpus.json]
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');

const LIB = path.join(__dirname, '..', '..', 'lib');
const SRC = path.join(LIB, 'sentence-stream.js');
const LOOP = path.join(LIB, 'free-brain', 'loop.js');

const CHUNKERS = {
  whole: (t) => [t],
  chars: (t) => [...t],
  size3: (t) => t.match(/[\s\S]{1,3}/gu) || [],
  size17: (t) => t.match(/[\s\S]{1,17}/gu) || [],
  size64: (t) => t.match(/[\s\S]{1,64}/gu) || [],
  words: (t) => t.match(/\S+\s*/gu) || [],
  lines: (t) => t.split(/(?<=\n)/u),
};

/**
 * The fixtures. `clean` answers must keep streaming; `ref` answers carry the numbers the
 * model invents, in both digit sets, singly and in groups, and once inside a fenced code
 * block where `arr[0]` is an index and not a footnote.
 */
const FIXTURES = [
  {
    id: 'clean-three',
    kind: 'clean',
    text: 'الصلاة واجبة على كل مسلم بالغ عاقل. ووقتها معلوم بالشمس والظل. ومن نسيها صلاها متى ذكرها.',
  },
  {
    id: 'clean-two',
    kind: 'clean',
    text: 'الوضوء شرط لصحة الصلاة. وينتقض بالخارج من السبيلين.',
  },
  {
    id: 'ref-second-sentence',
    kind: 'ref',
    // The named case: sentence one is clean, sentence two carries the number.
    text: 'الزكاة ركن من أركان الإسلام. ومقدارها ربع العشر في الذهب والفضة [1]. وتجب في مال بلغ النصاب.',
  },
  {
    id: 'ref-arabic-digits',
    kind: 'ref',
    text: 'الصيام واجب في رمضان. ويفطر المريض والمسافر [٢]. ويقضيان بعد ذلك.',
  },
  {
    id: 'ref-group',
    kind: 'ref',
    text: 'الحج واجب مرة في العمر. وشرطه الاستطاعة [1, 2] والأمن في الطريق [3][4]. ومن عجز أناب عنه.',
  },
  {
    id: 'fold-without-brackets',
    kind: 'fold',
    // The reference pass is TWO things: it removes the number, and it folds the whitespace
    // the removal leaves. This unit exercises the second half alone — a space before «؛»,
    // which `dropOrphanRefNumbers` closes and `tidyWouldChange` does not, because the tidy
    // pass's punctuation class is only «؟,.». Without this fixture a mirror that dropped
    // the folding entirely would still pass every other check.
    text: 'الطهارة نصف الإيمان ؛ وهي شرط الصلاة. ومن توضأ فأحسن الوضوء غفر له.',
  },
  {
    id: 'code-index-not-a-reference',
    kind: 'clean',
    // `arr[0]` inside a fence is an index. The reference pass leaves it, so this unit
    // must keep streaming — a mirror that ignores the fence would hold it.
    text: 'هذا مثال برمجي. `arr[0]` يعني أول عنصر في المصفوفة. وهذا لا علاقة له بالإحالات.',
  },
];

function loadModule(file) {
  return import(url.pathToFileURL(file).href);
}

/** An anchor that does not match is NOT a caught mutant. It is a broken gate, and it is
 *  reported as one — a no-op mutation that «throws» would otherwise read as PASS forever. */
class AnchorError extends Error {}

/** Write a mutated copy and PROVE the mutation landed. Relative imports are rewritten so
 *  the copy can live outside lib/ and the working tree is never touched.
 *
 *  The tree is CRLF here and LF on other machines, and an anchor spanning two lines would
 *  match on one and silently miss on the other. Both sides are normalised to LF before
 *  matching, so the anchors say what they mean everywhere. */
function mutatedCopy(mutant) {
  const source = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
  const hits = source.split(mutant.find).length - 1;
  if (hits !== 1) {
    throw new AnchorError(`mutant ${mutant.name}: anchor found ${hits} times, expected 1`);
  }
  const mutated = source.replace(mutant.find, mutant.replace)
    .replace(/from '\.\/([A-Za-z0-9._-]+)'/g,
      (whole, name) => `from '${url.pathToFileURL(path.join(LIB, name)).href}'`);
  if (mutated === source) throw new AnchorError(`mutant ${mutant.name}: source unchanged`);
  const dir = path.join(os.tmpdir(), 'ezik-stream-p5');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mutant-${mutant.name}.mjs`);
  fs.writeFileSync(file, mutated, 'utf8');
  return file;
}

const MUTANTS = [
  {
    name: 'no-ref-test',
    claim: 'the reference test actually gates the unit, it is not decoration',
    find: '    if (holdRefDrop && refDropWouldChange(unit)) {',
    replace: '    if (false && refDropWouldChange(unit)) {',
  },
  {
    name: 'hold-off-by-default',
    claim: 'the hold is ON by default, so the delivery path gets it without asking',
    find: '  holdUnsettled = true, holdRefDrop = true,',
    replace: '  holdUnsettled = true, holdRefDrop = false,',
  },
  {
    name: 'mirror-blind',
    claim: 'the predicate reports the change instead of always denying one',
    find: "    .replace(/[ \\t]+\\n/gu, '\\n')\n    .trim();\n  return out !== s;",
    replace: "    .replace(/[ \\t]+\\n/gu, '\\n')\n    .trim();\n  return false;",
  },
  {
    name: 'mirror-holds-everything',
    claim: 'the predicate discriminates; holding every unit is not an answer',
    find: "    .replace(/[ \\t]+\\n/gu, '\\n')\n    .trim();\n  return out !== s;\n}",
    replace: "    .replace(/[ \\t]+\\n/gu, '\\n')\n    .trim();\n  return true;\n}",
  },
  {
    name: 'brackets-only',
    claim: 'the whitespace the deletion leaves behind is part of the change',
    find: "    .replace(/[ \\t]+([.،؟!:؛])/gu, '$1')\n    .replace(INNER_RUN_RE, foldInnerRun)\n    .replace(/[ \\t]+\\n/gu, '\\n')\n    .trim();\n  return out !== s;",
    replace: '    .trim();\n  return out !== s;',
  },
  {
    name: 'no-code-fence-split',
    claim: 'an index inside a fenced block is not a reference number',
    find: "    .split(/(```[\\s\\S]*?```|`[^`\\n]*`)/u)\n    .map((chunk, index) => (index % 2 === 1 ? chunk : chunk.replace(ORPHAN_REF_RE, '')))\n    .join('')",
    replace: "    .replace(ORPHAN_REF_RE, '')",
  },
];

/** Run one fixture through one chunking and report what left early. */
function runOne(mod, fixture, chunk) {
  const stream = mod.createSentenceStream({
    evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [],
  });
  const early = [];
  for (const piece of chunk(fixture.text)) early.push(...stream.push(piece));
  const closed = stream.end();
  return { early, closed };
}

/**
 * The three claims plus the named case, against one module. `dropOrphanRefNumbers` is
 * the judge throughout and is never taken from the module under test.
 */
function judge(mod, dropOrphanRefNumbers, corpus) {
  const res = {
    safety: { checks: 0, failures: [] },
    liveness: { checks: 0, failures: [] },
    mirror: { checks: 0, failures: [] },
    named: { checks: 0, failures: [] },
  };

  const bodies = [...FIXTURES];
  for (const record of corpus) bodies.push({ id: record.id, kind: 'corpus', text: record.text });

  for (const fixture of bodies) {
    for (const [chunkName, chunk] of Object.entries(CHUNKERS)) {
      // The corpus is large; run it under two chunkings, the fixtures under all seven.
      if (fixture.kind === 'corpus' && chunkName !== 'words' && chunkName !== 'chars') continue;
      let out;
      try {
        out = runOne(mod, fixture, chunk);
      } catch (err) {
        res.safety.failures.push(`${fixture.id}/${chunkName}: threw ${err.message}`);
        continue;
      }

      // SAFETY — nothing that the reference pass would still edit may have gone out.
      for (const unit of out.early) {
        res.safety.checks += 1;
        if (dropOrphanRefNumbers(unit) !== unit) {
          res.safety.failures.push(`${fixture.id}/${chunkName}: emitted a unit the reference pass would change (${unit.length} chars)`);
        }
      }

      // LIVENESS — a clean answer must still put something on the wire.
      if (fixture.kind === 'clean') {
        res.liveness.checks += 1;
        if (!out.early.length) {
          res.liveness.failures.push(`${fixture.id}/${chunkName}: nothing streamed from a clean answer`);
        }
      }

      // THE NAMED CASE — first sentence out, the one carrying the number not.
      if (fixture.id === 'ref-second-sentence') {
        res.named.checks += 2;
        if (!out.early.length) {
          res.named.failures.push(`${fixture.id}/${chunkName}: the clean first sentence did not go out`);
        }
        if (out.early.some((u) => /\[\s*[0-9٠-٩]/u.test(u))) {
          res.named.failures.push(`${fixture.id}/${chunkName}: a reference number reached the wire`);
        }
      }
    }
  }

  // MIRROR — the predicate answers exactly what the real function does.
  if (typeof mod.refDropWouldChange === 'function') {
    for (const fixture of bodies) {
      const pieces = [fixture.text, ...fixture.text.split(/(?<=[.؟!\n])/u)];
      for (const piece of pieces) {
        if (!piece) continue;
        res.mirror.checks += 1;
        const mirror = mod.refDropWouldChange(piece);
        const real = dropOrphanRefNumbers(piece) !== piece;
        if (mirror !== real && res.mirror.failures.length < 10) {
          res.mirror.failures.push(`${fixture.id}: mirror=${mirror} real=${real}`);
        } else if (mirror !== real) {
          res.mirror.failures.push(fixture.id);
        }
      }
    }
  } else {
    res.mirror.failures.push('refDropWouldChange is not exported');
  }

  return res;
}

const ok = (part) => part.failures.length === 0;

async function main() {
  const wantMutants = process.argv.includes('--mutants');
  const corpusPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const corpus = corpusPath ? JSON.parse(fs.readFileSync(corpusPath, 'utf8')) : [];

  const { dropOrphanRefNumbers } = await loadModule(LOOP);
  const real = await loadModule(SRC);

  console.log('');
  console.log(`ORPHAN-REF GATE   fixtures ${FIXTURES.length} · corpus ${corpus.length} · chunkings ${Object.keys(CHUNKERS).length}`);
  const res = judge(real, dropOrphanRefNumbers, corpus);
  for (const [name, part] of Object.entries(res)) {
    console.log(`  ${name.padEnd(9)} ${String(part.checks).padStart(6)} checks   ${ok(part) ? 'PASS' : 'FAIL'}`);
    for (const f of part.failures.slice(0, 5)) console.log(`      ${f}`);
  }
  const gateOk = Object.values(res).every(ok);
  console.log(`  GATE ${gateOk ? 'PASS' : 'FAIL'}`);

  let selftestOk = true;
  if (wantMutants) {
    console.log('');
    console.log('SELFTEST — each mutant must be caught:');
    for (const mutant of MUTANTS) {
      let caught = false;
      let detail = '';
      let label = 'MISSED ';
      try {
        const file = mutatedCopy(mutant);
        const mod = await loadModule(file);
        const out = judge(mod, dropOrphanRefNumbers, corpus);
        const broken = Object.entries(out).filter(([, part]) => !ok(part)).map(([n]) => n);
        caught = broken.length > 0;
        detail = caught ? `(${broken.join(', ')})` : '(nothing failed)';
      } catch (err) {
        if (err instanceof AnchorError) {
          // The mutation never landed, so nothing was tested. This is a broken gate and
          // must never read as a caught mutant.
          caught = false;
          label = 'NO-OP  ';
          detail = `(${String(err.message).slice(0, 70)})`;
        } else {
          caught = true;
          detail = `(module threw: ${String(err.message).slice(0, 60)})`;
        }
      }
      if (caught) label = 'CAUGHT ';
      if (!caught) selftestOk = false;
      console.log(`  ${label}${mutant.name.padEnd(24)}${detail}`);
      console.log(`           claim: ${mutant.claim}`);
    }
    console.log(`  SELFTEST ${selftestOk ? 'PASS' : 'FAIL'} — ${MUTANTS.length} mutants, ${selftestOk ? 'all caught' : 'one or more MISSED'}`);
  }

  process.exit(gateOk && selftestOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
