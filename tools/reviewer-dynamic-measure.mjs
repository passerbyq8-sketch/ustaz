// tools/reviewer-dynamic-measure.mjs — WHAT THE VARIABLE-CLAIM RULE ACTUALLY FIRES ON.
//
// WHY THIS EXISTS. §١ of the reviewer-repair directive forbids narrowing the variable-claim
// detector by guessing at a word list: «والتضييقُ يُبنى على ما يقيسُه النصُّ فعلًا، لا على قائمةِ
// كلماتٍ تُخمَّن». So the narrowing was built from a measurement, and the measurement has to be
// re-runnable by anyone who doubts it.
//
// WHAT IT MEASURES. It walks a corpus of real answers with the reviewer's OWN structural split and
// sentence split — so card bodies and headings are excluded exactly as the reviewer excludes them
// — and reports, for every prose sentence, which alternative of the pre-repair alternation matched
// it. The pre-repair alternation is written out here verbatim, once, as the thing being measured.
//
// USAGE
//   node tools/reviewer-dynamic-measure.mjs <answers-file> [--fixture <out.json>]
//
// The corpus this repository's guards use is the owner's twenty-question battery — all eighty
// answers, preview and production, at ustaz-archive/sessions/EZIK-BATTERY-ANSWERS-2026-08-16.txt.
// Its verdict, on 2026-08-16: FOURTEEN sentences match, and none of the fourteen is a claim about
// a changing world. `fixtures/reviewer-variable-claim-corpus.json` is that output, frozen.

import { readFileSync, writeFileSync } from 'node:fs';

// The rule as it stood before the repair. Kept whole and kept here, because a measurement of a
// rule has to hold the rule it measured.
const PRE_REPAIR_ALTERNATIVES = [
  ['اليوم', /اليوم/u],
  ['الآن', /الآن/u],
  ['حاليا', /حالي[ًاا]?/u],
  ['أحدث', /أحدث/u],
  ['آخر+خبر', /آخر\s+(?:خبر|الأخبار|سعر|نتيجة)/u],
  ['طقس', /طقس/u],
  ['درجة الحرارة', /درجة\s+الحرارة/u],
  ['سعر', /سعر/u],
  ['أسعار', /أسعار/u],
  ['نتيجة', /نتيجة/u],
  ['أخبار', /أخبار/u],
  ['خبر عاجل', /خبر\s+عاجل/u],
  ['بورصة', /بورصة/u],
  ['سهم', /سهم/u],
  ['سعر الصرف', /سعر\s+الصرف/u],
  ['عدد الإصابات', /عدد\s+الإصابات/u],
  ['هذا الأسبوع', /هذا\s+(?:الأسبوع|الشهر|العام)/u],
];

// The reviewer's own splits. Copied rather than imported for the same reason the guards copy the
// registry derivation: a measurement that shares its splitter with the thing it measures proves
// only that one copy equals itself.
const CARD_TAG_NAMES = 'verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship';
const CARD_TAG_RE = new RegExp('<(/?)(?:' + CARD_TAG_NAMES + ')\\b[^>]*>', 'iu');
const CARD_NAME_RE = /^<\/?\s*([a-z]+)/iu;

function splitStructure(text) {
  let rest = String(text ?? '').replace(/\r\n?/gu, '\n');
  const runs = [];
  while (rest) {
    const opener = CARD_TAG_RE.exec(rest);
    if (!opener) { runs.push({ kind: 'prose', text: rest }); break; }
    if (opener.index > 0) runs.push({ kind: 'prose', text: rest.slice(0, opener.index) });
    if (opener[1] === '/') {
      runs.push({ kind: 'card', text: opener[0] });
      rest = rest.slice(opener.index + opener[0].length);
      continue;
    }
    const name = (CARD_NAME_RE.exec(opener[0]) || [, ''])[1];
    const after = rest.slice(opener.index + opener[0].length);
    const closer = name ? new RegExp('</' + name + '\\s*>', 'iu').exec(after) : null;
    if (closer) {
      runs.push({ kind: 'card', text: opener[0] + after.slice(0, closer.index + closer[0].length) });
      rest = after.slice(closer.index + closer[0].length);
    } else {
      runs.push({ kind: 'card', text: rest.slice(opener.index) });
      break;
    }
  }
  return runs;
}

const sentenceParts = (text) => String(text ?? '').split(/(?<=[.!؟])\s+|\n+/u)
  .map((part) => part.trim()).filter(Boolean);

/** The battery transcript's shape: `====` / `Qn [class]` / `====`, then `--- <run> ---` blocks. */
export function parseBattery(raw) {
  const lines = String(raw).replace(/\r\n?/gu, '\n').split('\n');
  const answers = [];
  let question = null;
  let run = null;
  let buffer = [];
  const flush = () => {
    if (question && run) answers.push({ question, run, text: buffer.join('\n').trim() });
    buffer = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    if (/^={10,}$/u.test(lines[i]) && /^={10,}$/u.test(lines[i + 2] || '')) {
      const numbered = /(?:^|\s)Q?\s*(\d+)/u.exec(lines[i + 1] || '');
      if (numbered) { flush(); run = null; question = Number(numbered[1]); i += 2; continue; }
    }
    const header = /^---\s*([a-z]+-\d)\s*---/u.exec(lines[i]);
    if (header) { flush(); run = header[1]; continue; }
    if (run) buffer.push(lines[i]);
  }
  flush();
  return answers;
}

export function measure(answers) {
  const rows = [];
  for (const answer of answers) {
    for (const run of splitStructure(answer.text)) {
      if (run.kind === 'card') continue;
      for (const part of sentenceParts(run.text)) {
        const markers = PRE_REPAIR_ALTERNATIVES.filter(([, re]) => re.test(part)).map(([name]) => name);
        if (markers.length) rows.push({ id: `q${answer.question}-${answer.run}`, markers, text: part });
      }
    }
  }
  return rows;
}

// Only when this file IS the program. Imported by a measurement script, it must export and be
// silent — a module that reads argv on import turns somebody else's output path into its input.
const invokedDirectly = String(process.argv[1] || '').replace(/\\/gu, '/').endsWith('reviewer-dynamic-measure.mjs');
const [, , file, ...rest] = process.argv;
if (invokedDirectly && file) {
  const rows = measure(parseBattery(readFileSync(file, 'utf8')));
  const counts = {};
  for (const row of rows) for (const marker of row.markers) counts[marker] = (counts[marker] || 0) + 1;
  console.log('sentences matched: ' + rows.length);
  console.log(JSON.stringify(counts));
  const at = rest.indexOf('--fixture');
  if (at >= 0 && rest[at + 1]) {
    writeFileSync(rest[at + 1], JSON.stringify({ rows }, null, 2) + '\n', 'utf8');
    console.log('written: ' + rest[at + 1]);
  }
}
