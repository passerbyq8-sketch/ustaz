#!/usr/bin/env node
/* ==========================================================================================
 * tools/arbaeen-footnotes-build.cjs -- ITEM 4. THE MARKS IN THE FORTY, JOINED TO THEIR NOTES.
 *
 * THE DEFECT. arbaeen.json carries the print edition's footnote markers inside the hadith text
 * -- 55 of them, "(1)" fifty times and "(2)" five times -- and the application answers none of
 * them. A reader meets a number that points at nothing. The footnote TEXT exists, in the source
 * atoms this corpus was built from, and this tool joins the two.
 *
 * arbaeen.json IS NOT WRITTEN. It is opened read-only, and the join is emitted as a SECOND file
 * beside it. The corpus is the corpus; a derivation that edits its source is not a derivation.
 *
 * THE TRAP THIS TOOL EXISTS TO REFUSE. A footnote blob in the atoms file is PAGE-level, not
 * hadith-level: the page's notes are stored on every atom cut out of that page, byte for byte,
 * so atoms FC-001977:0004:001 .. :004 all carry the same 903-char blob and :0058:001 .. :005 all
 * carry the same 167-char one. A page's footnotes may belong to a paragraph that is NOT the
 * hadith in hand. So a blob reached by two or more of the fifty entries is refused for ALL of
 * them rather than handed to whichever one asked first.
 *
 * THE DEAD PROBE, WRITTEN DOWN SO IT IS NOT RE-INVENTED. Counting /\(\d+\)/ inside a blob
 * OVER-counts, badly and silently: footnote prose cites hadith and volume numbers in parentheses
 * too -- "البخاري (4552) , ومسلم (1711)" is ONE footnote carrying two of them, and one blob here
 * carries eleven. There are 98 such mid-prose parentheses across the fifty blobs against 55 real
 * markers. The split below is POSITIONAL and never numeric: a footnote begins only at a "(N)"
 * that sits at the very start of the blob, or immediately after a newline.
 *
 * THE CERTAINTY RULES, in the order they are applied. A mark is joined ONLY when all hold, and
 * anything else drops the mark from the display rather than guessing at it:
 *   1. positional split, never a count                       (splitBlob below)
 *   2. the numbers must run 1, 2, 3 ... with no gap, no repeat   -> sequence_broken
 *   3. every mark in the hadith text must exist in the split     -> mark_absent
 *   4. a blob reached by two or more entries is refused for all  -> shared_blob
 *   5. nothing is inferred from position, order, length or plausibility. There is no closest
 *      match and no fallback pairing. Uncertain means dropped.
 * A high drop count is a correct outcome. Nothing here is tuned to lower it.
 *
 * ARABIC NEVER REACHES THE TERMINAL. Only ASCII statistics are printed. The Arabic goes to two
 * files: the shipped JSON, and -- with --proof -- the owner's proof sheet, which is the thing
 * that is actually read. The statistics are a description of that sheet, not a verdict on it.
 *
 * THE PROOF PASS DOES NOT TRUST THE MATCHER. --proof re-reads the corpus and re-reads the JSON
 * THIS RUN JUST WROTE, off disk, and re-locates all 55 marks itself. It shares no data structure
 * with the join above. A prover that reads the matcher's own variables proves only that the
 * matcher agrees with itself.
 *
 * THE OUTPUT SHAPE is exactly what the order asks for and nothing around it: the file IS the
 * map, keyed by the hadith number, then by the footnote number, holding the footnote text.
 *
 *     { "1": { "1": "...", "2": "..." }, "2": { "1": "..." }, ... }
 *
 * The "(N)" marker itself is the KEY, so it is not repeated in the value; nothing else is
 * removed. Whitespace at the two edges is stripped and the interior -- newlines included -- is a
 * byte copy of the source. Entries that were disqualified simply do not appear.
 *
 * USAGE
 *   node tools/arbaeen-footnotes-build.cjs                 build the file, print ASCII stats
 *   node tools/arbaeen-footnotes-build.cjs --proof         the same, and write the proof sheet
 *   node tools/arbaeen-footnotes-build.cjs --dry           measure and print, write nothing
 *   node tools/arbaeen-footnotes-build.cjs --atoms <path>  read the atoms from somewhere else
 *
 * It is deterministic: the same two inputs give the same bytes out, every run.
 * ========================================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'arbaeen.json');
const OUT = path.join(ROOT, 'arbaeen-footnotes.json');
const PROOF = 'C:/Users/passe/projects/_orders/arbaeen-footnotes-2026-09-13.txt';
// The atoms the corpus was cut from. Overridable, because the library moved once already and a
// hard-coded absolute path that is wrong is worse than an argument that is missing.
const DEFAULT_ATOMS = 'C:/EZIK-LIB/atoms-v4/13-147/FC-001977.jsonl';

const argv = process.argv.slice(2);
const WANT_PROOF = argv.indexOf('--proof') !== -1;
const DRY = argv.indexOf('--dry') !== -1;
const atomsFlag = argv.indexOf('--atoms');
const ATOMS = atomsFlag !== -1 && argv[atomsFlag + 1] ? argv[atomsFlag + 1] : DEFAULT_ATOMS;

function die(msg) { console.log('ERROR ' + msg); process.exit(1); }
function sha8(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8).toUpperCase(); }

/* ---- 1. THE TWO INPUTS, BOTH READ-ONLY ------------------------------------------------- */
if (!fs.existsSync(CORPUS)) die('arbaeen.json is not at the repository root');
if (!fs.existsSync(ATOMS)) die('the atoms file is not at ' + ATOMS);
const corpusBuf = fs.readFileSync(CORPUS);
const corpus = JSON.parse(corpusBuf.toString('utf8'));
const hadith = (corpus && corpus.hadith) || [];
if (!hadith.length) die('arbaeen.json carries no hadith array');

const atoms = Object.create(null);
let atomLines = 0;
for (const line of fs.readFileSync(ATOMS, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  atomLines += 1;
  let o;
  try { o = JSON.parse(line); } catch (e) { die('atoms line ' + atomLines + ' will not parse'); }
  if (o && o.atom_id) atoms[o.atom_id] = o;
}

/* ---- 2. THE MARKS IN THE CORPUS -------------------------------------------------------- */
// The shape the edition uses, and the ONLY shape treated as a marker: an ASCII "(", digits, ")".
// The square-bracketed numbers in the text -- «[البقرة: 172]» and three like it -- are surah and
// ayah references, not markers, and this does not match them.
const MARK_RE = /\((\d+)\)/g;
function marksIn(text) {
  const out = [];
  const re = new RegExp(MARK_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) out.push({ num: Number(m[1]), idx: m.index, raw: m[0] });
  return out;
}

/* ---- 3. THE POSITIONAL SPLIT (rule 1) -------------------------------------------------- */
// A footnote begins at a "(N)" that sits at index 0 of the blob, or immediately after a newline.
// Everything from there to the next such marker -- newlines included -- is that footnote's body.
// A "(N)" anywhere else is prose the author wrote and belongs to the footnote it sits inside.
function splitBlob(blob) {
  const heads = [];
  const re = new RegExp(MARK_RE.source, 'g');
  let m;
  while ((m = re.exec(blob)) !== null) {
    if (m.index === 0 || blob.charAt(m.index - 1) === '\n') {
      heads.push({ num: Number(m[1]), start: m.index, bodyAt: m.index + m[0].length });
    }
  }
  return heads.map((h, i) => ({
    num: h.num,
    // Only the two edges are touched. The marker is the key and is not repeated in the value;
    // the body between the markers is a byte copy.
    text: blob.slice(h.bodyAt, i + 1 < heads.length ? heads[i + 1].start : blob.length).trim(),
  }));
}

/* ---- 4. THE BLOB-TO-HADITH MAP (rule 4), BUILT BEFORE ANY JOIN ------------------------- */
// Built first and over the whole of the fifty, because the question "is this blob shared" cannot
// be answered while walking one entry. The key is the blob's own text: two atoms cut from the
// same page carry the same string, and that string identity IS the sharing.
const blobUsers = new Map();
for (const h of hadith) {
  const id = (h.atom_ids && h.atom_ids[0]) || null;
  const atom = id ? atoms[id] : null;
  const blob = (atom && Array.isArray(atom.footnotes) && atom.footnotes.length) ? atom.footnotes[0] : null;
  if (blob === null) continue;
  if (!blobUsers.has(blob)) blobUsers.set(blob, []);
  blobUsers.get(blob).push(h.n);
}

/* ---- 5. THE JOIN ----------------------------------------------------------------------- */
const REASONS = { no_blob: 0, shared_blob: 0, sequence_broken: 0, mark_absent: 0 };
const out = Object.create(null);
const perEntry = [];            // ASCII bookkeeping only; the proof pass does not read this
let marksTotal = 0;
let marksMatched = 0;

for (const h of hadith) {
  const marks = marksIn(h.text || '');
  marksTotal += marks.length;
  const id = (h.atom_ids && h.atom_ids[0]) || null;
  const atom = id ? atoms[id] : null;
  const blob = (atom && Array.isArray(atom.footnotes) && atom.footnotes.length) ? atom.footnotes[0] : null;

  let reason = null;
  let parts = [];
  if (blob === null) {
    reason = 'no_blob';
  } else if ((blobUsers.get(blob) || []).length > 1) {
    // Rule 4. Not "the first one wins" and not "the nearest page wins": none of them wins.
    reason = 'shared_blob';
  } else {
    parts = splitBlob(blob);
    // Rule 2. Starts at 1, rises by exactly 1, no gap and no repeat. A blob whose numbering this
    // cannot follow is a blob whose boundaries this cannot trust, so the whole entry goes.
    const clean = parts.length > 0 && parts.every((p, i) => p.num === i + 1);
    if (!clean) reason = 'sequence_broken';
    // Rule 3. The disqualification is of the ENTRY, not of the one mark: a blob that is missing
    // the note a mark asks for is a blob whose other notes are not established either.
    else if (!marks.every((mk) => parts.some((p) => p.num === mk.num))) reason = 'mark_absent';
  }

  if (reason) {
    REASONS[reason] += marks.length;
    perEntry.push({ n: h.n, marks: marks.length, reason: reason, written: 0 });
    continue;
  }
  // Only the notes a mark in this entry's text actually asks for are written. A blob may carry a
  // note for a paragraph on the page that is not this hadith; nothing unreferenced is shipped.
  const wanted = [];
  for (const p of parts) if (marks.some((mk) => mk.num === p.num)) wanted.push(p);
  if (wanted.length) {
    const bag = Object.create(null);
    for (const p of wanted) bag[String(p.num)] = p.text;
    out[String(h.n)] = bag;
  }
  marksMatched += marks.length;
  perEntry.push({ n: h.n, marks: marks.length, reason: null, written: wanted.length });
}

/* ---- 6. THE FILE ----------------------------------------------------------------------- */
// One-space indent and a trailing newline, which is what arbaeen.json and adhkar-split-27.json
// are already written in. LF only: a CRLF here would make the byte seals read every line as
// changed on the next tree that checks out differently.
const json = JSON.stringify(out, null, 1).replace(/\r\n/g, '\n') + '\n';
const jsonBuf = Buffer.from(json, 'utf8');
if (!DRY) fs.writeFileSync(OUT, jsonBuf);

let hadithWithNotes = 0;
let notesWritten = 0;
for (const k of Object.keys(out)) { hadithWithNotes += 1; notesWritten += Object.keys(out[k]).length; }

console.log('ATOMS_LINES=' + atomLines + '  HADITH=' + hadith.length);
console.log('MARKS=' + marksTotal + '   MATCHED=' + marksMatched + '   DROPPED=' + (marksTotal - marksMatched));
console.log('DROPPED_BY_REASON=  shared_blob=' + REASONS.shared_blob
  + '  sequence_broken=' + REASONS.sequence_broken
  + '  mark_absent=' + REASONS.mark_absent
  + '  no_blob=' + REASONS.no_blob);
console.log('HADITH_WITH_FOOTNOTES=' + hadithWithNotes + '      FOOTNOTES_WRITTEN=' + notesWritten);
console.log('CORPUS  arbaeen.json  ' + corpusBuf.length + ' bytes  ' + sha8(corpusBuf) + '  (read only)');
console.log((DRY ? 'DRY, not written  ' : 'WROTE  ') + 'arbaeen-footnotes.json  ' + jsonBuf.length
  + ' bytes  ' + sha8(jsonBuf));
const dropped = perEntry.filter((e) => e.reason);
console.log('DISQUALIFIED_ENTRIES=' + dropped.length
  + (dropped.length ? '  ' + dropped.map((e) => e.n + ':' + e.reason).join(' ') : ''));

/* ---- 7. THE PROOF SHEET ---------------------------------------------------------------- */
// Independent of everything above. It re-reads the corpus off disk, re-reads the JSON that was
// just written off disk, and re-locates all 55 marks with its own scan. Whether a block says
// FOOTNOTE or DROPPED is decided by what is on disk and by nothing the matcher remembers; the
// REASON word after DROPPED is the only thing carried over from the join, because it is a label
// for a decision the file itself cannot state. One block per mark, all of them, in hadith order
// -- it is not a summary, and the owner reads it rather than the statistics. The last ~60
// characters before the mark are quoted so the owner can see WHERE in the hadith the mark sits
// without opening the corpus beside it.
if (WANT_PROOF) {
  if (DRY) die('--proof needs the file on disk; do not pass --dry with it');
  const freshCorpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const shipped = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const L = [];
  L.push('ARBAEEN FOOTNOTES -- PROOF SHEET -- 2026-09-13');
  L.push('one block per footnote MARK in arbaeen.json, in hadith order, none omitted.');
  L.push('BEFORE is the last 60 characters of the hadith text in front of the mark.');
  L.push('A block says either the footnote text that will be drawn under it, or DROPPED and why.');
  L.push('This sheet was written by re-reading arbaeen.json and arbaeen-footnotes.json off disk.');
  L.push('');
  let seen = 0;
  let shown = 0;
  for (const h of freshCorpus.hadith) {
    const text = h.text || '';
    const bag = Object.prototype.hasOwnProperty.call(shipped, String(h.n)) ? shipped[String(h.n)] : null;
    const why = (perEntry.find((e) => e.n === h.n) || {}).reason || null;
    const re = new RegExp(MARK_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      seen += 1;
      const before = text.slice(Math.max(0, m.index - 60), m.index).replace(/\s+/g, ' ').trim();
      L.push('--------------------------------------------------------------------------');
      L.push('HADITH ' + h.n + '   MARK ' + m[0]);
      L.push('BEFORE: ' + before);
      const note = (bag && Object.prototype.hasOwnProperty.call(bag, String(Number(m[1])))) ? bag[String(Number(m[1]))] : null;
      if (note === null) {
        L.push('DROPPED: ' + (why || 'the shipped file carries no note under this number'));
      } else {
        shown += 1;
        L.push('FOOTNOTE: ' + note);
      }
      L.push('');
    }
  }
  L.push('--------------------------------------------------------------------------');
  L.push('MARKS ' + seen + '   WITH A FOOTNOTE ' + shown + '   DROPPED ' + (seen - shown));
  const sheet = Buffer.from(L.join('\n') + '\n', 'utf8');
  fs.writeFileSync(PROOF, sheet);
  console.log('PROOF  ' + PROOF + '  ' + sheet.length + ' bytes  ' + sha8(sheet)
    + '  blocks=' + seen + '  with_footnote=' + shown);
  if (seen !== marksTotal) die('the proof pass counted ' + seen + ' marks and the join counted ' + marksTotal);
  if (shown !== marksMatched) die('the proof pass read ' + shown + ' notes off disk and the join wrote ' + marksMatched);
}
