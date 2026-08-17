// tools/latin-line-measure.mjs — WHERE THE SCRIPT THRESHOLD COMES FROM.
//
// §١ of the C order says the majority bound «يُقاسُ ويُعلَن، لا يُخترَع» — measured and declared,
// never invented. This file is the measurement. It prints, for two corpora, the Latin share of
// every line and the gap between them; the constants in lib/free-brain/loop.js are read out of
// that gap and this file is what a future reader re-runs to check they still sit inside it.
//
// THE TWO CORPORA ARE NOT SAMPLES OF THE SAME THING.
//   DROP — machine prose that reached the owner on production on 17 August, in English.
//   KEEP — Arabic answers of the kind this app writes, each carrying the thing a naive rule
//          would trip on: an English term, a bare link, a Latin digit, a code fence, a formula.
//
// Run: node tools/latin-line-measure.mjs
'use strict';

import { latinScriptShare } from '../lib/free-brain/loop.js';

// ── THE DROP CORPUS ─────────────────────────────────────────────────────────
// The first two are the owner's own witnesses, verbatim from the live production experience of
// 17 August 2026 (the C order, §١). The rest are the same shape from the same class.
const DROP = Object.freeze([
  "I'll research each of these five questions in the authoritative sources.",
  'Let me search for the most authoritative fatwa on this specific question.',
  'I will now look this up in the fatwa corpus and get back to you.',
  'Based on the search results above, here is what the scholars say:',
  'Searching for: ruling on combining prayers while travelling',
]);

// ── THE KEEP CORPUS ─────────────────────────────────────────────────────────
// Every one of these is an answer, and every one of them carries Latin characters. If any single
// line here scores above the threshold, the threshold is wrong — a rule that eats these is the
// third mutant §١ names, shipped rather than killed.
const KEEP = Object.freeze([
  'الجمعُ للمسافرِ جائزٌ عندَ الحاجة.',
  'وهذا ما يسمّى في الدراساتِ المعاصرةِ Fiqh of Minorities، وله ضوابطُه.',
  'راجعْ نصَّ الفتوى على https://binbaz.org.sa/fatwas/12345 ففيه التفصيل.',
  'ومدّةُ المسحِ للمقيمِ يومٌ وليلة، وللمسافرِ 3 أيّامٍ بلياليها.',
  'نصابُ الزكاةِ في الذهبِ 85 gram، وفي الفضّةِ 595 gram.',
  'وقد نقلَ ابنُ قدامةَ في المغني (ج2 ص120) الإجماعَ على ذلك.',
  'والنسبةُ هي 2.5% من المالِ الذي حالَ عليه الحول.',
  'هذا رابطُ المادّة: www.islamweb.net/ar/fatwa/1234',
  'https://binbaz.org.sa/fatwas/12345',
  'ويكتبُ في الطرفيّة: npm run gates',
  'cos(x) + sin(x) = 1',
]);

const row = (line) => {
  const m = latinScriptShare(line);
  return { share: m.share, letters: m.letters, latin: m.latin, arabic: m.arabic, line };
};

const drop = DROP.map(row);
const keep = KEEP.map(row);

const fmt = (r) => `${r.share.toFixed(3)}  letters=${String(r.letters).padStart(3)} `
  + `latin=${String(r.latin).padStart(3)} arabic=${String(r.arabic).padStart(3)}  `
  + `${r.line.slice(0, 62)}`;

console.log('== DROP corpus (machine prose, must score HIGH) ==');
for (const r of drop) console.log('  ' + fmt(r));
console.log('== KEEP corpus (answers, must score LOW or be un-judgeable) ==');
for (const r of keep) console.log('  ' + fmt(r));

// A KEEP line with fewer letters than the floor is not scored at all, so it is excluded from the
// gap: the floor, not the share, is what protects it, and folding the two together would hide
// which of the two rules is doing the work.
const FLOOR = 12;
const judgedKeep = keep.filter((r) => r.letters >= FLOOR);
const unjudgedKeep = keep.filter((r) => r.letters < FLOOR);

const dropMin = Math.min(...drop.map((r) => r.share));
const keepMax = judgedKeep.length ? Math.max(...judgedKeep.map((r) => r.share)) : 0;

console.log('');
console.log(`floor (letters below which a line is not judged): ${FLOOR}`);
console.log(`KEEP lines below the floor, protected by it alone: ${unjudgedKeep.length}`);
for (const r of unjudgedKeep) console.log(`  letters=${r.letters}  ${r.line.slice(0, 62)}`);
console.log('');
console.log(`lowest  DROP share: ${dropMin.toFixed(3)}`);
console.log(`highest KEEP share: ${keepMax.toFixed(3)}   (of the ${judgedKeep.length} judged)`);
console.log(`GAP: [${keepMax.toFixed(3)} .. ${dropMin.toFixed(3)}]  width ${(dropMin - keepMax).toFixed(3)}`);
console.log('');
console.log('The threshold shipped in lib/free-brain/loop.js must sit strictly inside that gap.');
if (!(dropMin > keepMax)) {
  console.log('NO GAP — the two corpora overlap and no threshold separates them.');
  process.exit(1);
}
