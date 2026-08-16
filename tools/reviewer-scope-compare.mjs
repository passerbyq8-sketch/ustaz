// tools/reviewer-scope-compare.mjs — §٦: the owner's four questions, before and after.
//
// The model is NOT called again. Each question's payload was captured once, at the reviewer's
// doorstep, by tools/reviewer-scope-capture.mjs; both reviewers are handed the SAME bytes. That is
// the only way §٦'s last row can mean anything: two fresh model calls would differ from each other
// for reasons that have nothing to do with this change, and «answer length unchanged» would be
// unmeasurable noise.
//
//   node tools/reviewer-scope-compare.mjs <captureDir> <oldReviewerPath>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [captureDir, oldPath] = process.argv.slice(2);

const NEW = await import(pathToFileURL(path.resolve('lib/output-reviewer.js')).href);
const OLD = await import(pathToFileURL(path.resolve(oldPath)).href);
const TAG = NEW.REVIEW_TAGS.FIQH_UNSOURCED;
// The client strips the harakat from PROSE only (index.html:9152), so the same constant reaches
// the reader in two spellings. Both are counted, because the reader saw both.
const BARE = TAG.replace(/[ً-ْٰ]/gu, '');
// index.html EZIK_CARD_TAG_RE — what the reader never sees, so what a line's emptiness is judged
// after removing.
const CARD_MARKUP = /<\/?(?:verse|surah|hadith|steps|suggestions|board|document|source|dhikr|worship)\b[^>]*>/giu;
const ANY_TAG = new RegExp(Object.values(NEW.REVIEW_TAGS)
  .flatMap((t) => [t, t.replace(/[ً-ْٰ]/gu, '')])
  .map((t) => t.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|'), 'gu');

const count = (haystack, needle) => haystack.split(needle).length - 1;

const NOTICES = [
  NEW.REVIEW_TAGS.FIQH_UNSOURCED, NEW.REVIEW_TAGS.GENERAL_STABLE,
];

/** The answer with every mark AND every answer-level notice line taken away — the prose itself. */
function proseOnly(text) {
  return text.split('\n')
    .filter((l) => !NOTICES.some((t) => l.startsWith(t)))
    .join('\n').replace(ANY_TAG, '').replace(/[ \t]+/gu, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

// ── WHAT THE READER ACTUALLY SEES (index.html:9152) ─────────────────────────
// The tashkeel toggle strips harakat from `seg.type==='text'` and from nothing else, so card
// bodies keep theirs. Reproducing that split here is the only way to measure the owner's fourth
// witness — two spellings of one constant in one answer — because on the wire there is only ever
// one spelling and the defect is invisible.
const CARD_BLOCK = /<(verse|surah|hadith|steps|suggestions|board|document|source|dhikr|worship)\b[^>]*>[\s\S]*?<\/\1>/giu;
const HARAKAT = /[ً-ْٰ]/gu;
function asRendered(text) {
  let out = '';
  let last = 0;
  CARD_BLOCK.lastIndex = 0;
  let m;
  while ((m = CARD_BLOCK.exec(text)) !== null) {
    out += text.slice(last, m.index).replace(HARAKAT, '');
    out += m[0];
    last = m.index + m[0].length;
  }
  return out + text.slice(last).replace(HARAKAT, '');
}
function renderedSpellings(text) {
  const r = asRendered(text);
  return [count(r, TAG) ? 'tanwin' : null, count(r, BARE) ? 'bare' : null].filter(Boolean);
}

/** Which card block, if any, a line falls inside — the reader's own structure, not a shape guess. */
function insideCard(lines) {
  const inside = new Set();
  let open = null;
  lines.forEach((line, i) => {
    const o = /<(verse|surah|hadith|steps|suggestions|board|document|source|dhikr|worship)\b[^>]*>/iu.exec(line);
    const c = /<\/(verse|surah|hadith|steps|suggestions|board|document|source|dhikr|worship)\s*>/iu.exec(line);
    if (open || o || c) inside.add(i);
    if (o && !new RegExp('</' + o[1] + '\\s*>', 'iu').test(line)) open = o[1];
    if (c) open = null;
  });
  return inside;
}

function measure(out) {
  const text = out.text;
  const lines = text.split('\n');
  const cardLines = insideCard(lines);
  const tagged = lines.map((l, i) => ({ i, l, has: l.includes(TAG) || l.includes(BARE) }));
  return {
    tagOccurrences: count(text, TAG) + count(text, BARE),
    spellings: [...new Set([count(text, TAG) ? 'tanwin' : null, count(text, BARE) ? 'bare' : null].filter(Boolean))],
    inCardOrQuote: tagged.filter((t) => t.has && cardLines.has(t.i)).length,
    inHeading: tagged.filter((t) => t.has && (/^#{1,6}\s/u.test(t.l) || /title="/iu.test(t.l))).length,
    tagOnlyLines: tagged.filter((t) => t.has
      && t.l.replace(CARD_MARKUP, '').replace(ANY_TAG, '').trim() === '').length,
    renderedSpellings: renderedSpellings(text),
    prose: proseOnly(text),
    rawChars: text.length,
    // The answer with every mark removed. THIS is what must not shrink: losing it means a reply
    // was deleted, not a tag.
    answerChars: text.replace(ANY_TAG, '').replace(/[ \t]+/gu, ' ').trim().length,
    lines: lines.length,
    verdictVersion: out.verdict?.version,
    usedLastResort: out.verdict?.usedLastResort,
    counts: out.verdict?.counts,
  };
}

const rows = [];
for (let n = 1; n <= 4; n++) {
  const f = path.join(captureDir, `q${n}.reviewer-input.json`);
  if (!fs.existsSync(f)) { console.log(`q${n}: MISSING CAPTURE`); continue; }
  const input = JSON.parse(fs.readFileSync(f, 'utf8'));
  const before = measure(OLD.reviewAnswer(input));
  const after = measure(NEW.reviewAnswer(input));
  rows.push({ n, evidence: input.evidence.length, cards: input.evidence.filter((e) => e.url).length, before, after });
  console.log('');
  console.log(`######## q${n}  (evidence=${input.evidence.length}, cards=${input.evidence.filter((e) => e.url).length}) ########`);
  console.log('  prose identical before/after: ' + (before.prose === after.prose));
  const keys = ['tagOccurrences', 'spellings', 'renderedSpellings', 'inCardOrQuote', 'inHeading',
    'tagOnlyLines', 'rawChars', 'answerChars', 'lines', 'verdictVersion', 'usedLastResort'];
  for (const k of keys) {
    const b = JSON.stringify(before[k]);
    const a = JSON.stringify(after[k]);
    console.log('  ' + k.padEnd(18) + ' before=' + String(b).padEnd(22) + ' after=' + a + (b === a ? '' : '   <-- changed'));
  }
  console.log('  counts before= ' + JSON.stringify(before.counts));
  console.log('  counts after = ' + JSON.stringify(after.counts));
}
fs.writeFileSync(path.join(captureDir, 'compare.json'), JSON.stringify(rows, null, 2), 'utf8');

console.log('\n======== §٦ CEILINGS ========');
const fail = [];
for (const r of rows) {
  if (r.after.tagOccurrences > 1) fail.push(`q${r.n}: ${r.after.tagOccurrences} tag occurrences (ceiling 1)`);
  if (r.after.inCardOrQuote) fail.push(`q${r.n}: ${r.after.inCardOrQuote} tag(s) inside a card or quotation (ceiling 0)`);
  if (r.after.inHeading) fail.push(`q${r.n}: ${r.after.inHeading} tag(s) on a heading (ceiling 0)`);
  if (r.after.tagOnlyLines) fail.push(`q${r.n}: ${r.after.tagOnlyLines} tag-only line(s) (ceiling 0)`);
  if (r.after.renderedSpellings.length > 1) {
    fail.push(`q${r.n}: ${r.after.renderedSpellings.length} spellings as rendered (ceiling 1)`);
  }
  if (r.after.prose !== r.before.prose) {
    fail.push(`q${r.n}: the prose itself changed — that is a deleted answer, not a deleted tag`);
  }
  if (r.after.verdictVersion !== 'freebrain-b-v1') fail.push(`q${r.n}: verdict ${r.after.verdictVersion}`);
  if (r.after.usedLastResort !== false) fail.push(`q${r.n}: usedLastResort ${r.after.usedLastResort}`);
}
if (fail.length) { fail.forEach((f) => console.log('FAIL  ' + f)); process.exit(1); }
console.log('all four questions inside every §٦ ceiling');
