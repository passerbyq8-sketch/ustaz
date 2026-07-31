#!/usr/bin/env node
/*
 * madina-hafs-guard.cjs -- the 604 printed Madina page images, and nothing else.
 *
 * The image reader ships 604 binary assets that no other guard measures. This one
 * pins them: the exact 604 filenames with nothing missing, duplicated or extra, the
 * exact pixel dimensions read out of each WebP header itself, the exact SHA-256 of
 * every file's bytes, the crop geometry each one was cut with, and the provenance
 * record that says where they came from and under what licence status.
 *
 * It reads the images as BYTES and never decodes or prints their content, so no Quran
 * text can pass through it. All output is ASCII, and the output is compact on purpose:
 * totals rather than 604 verbose lines, with every failure printed in full.
 *
 * Usage:  node madina-hafs-guard.cjs
 * Exit 0 = every check passed. Exit 1 = at least one failed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// this guard lives in tools/, so the repository root is one level up
const ROOT = path.join(__dirname, '..');
const RECORD = 'data/madina-hafs-pages.json';
const NOTICE = 'MUSHAF-MADINA-ASSET-NOTICE.md';
const ASSET_DIR = 'assets/madina-hafs';

const FIRST_PAGE = 1;
const LAST_PAGE = 604;
const PDF_OFFSET = 3;             // pdfIndex = printedPage + 3
const SOURCE_W = 957;
const SOURCE_H = 1368;

// Page 1 was approved by eye and the session-80 crop correction does not move it: it is
// one of the two ornate opening sheets, it carries no detached side ornament, and its
// frame is the outermost printed thing on the sheet, so the frame-anchored crop lands on
// the same rectangle the old ink-anchored crop did. It must still reproduce byte for byte.
const APPROVED = {
  1: '2d914c1e80eb5bd190b83bb4ab9983d925a0353e884d5df5e4ec8e95c80ce6eb',
};
// Page 77 was approved by eye in session 79 and is REQUIRED to have changed in session 80:
// it is one of the sheets carrying a detached side ornament, and removing that ornament is
// the whole point. So instead of pinning bytes that must not come back, this pins the
// property -- page 77 must be recorded as a page whose side ornament was removed.
const SUPERSEDED = {
  77: 'd1ff9f43378690b2b5710350ba01adabdf25a138b054dd16247a7dc12a59964c',
};

// ---------------------------------------------------------------------------
// THE SIDE-ORNAMENT SPLIT, and why it is 252/352 rather than 254/350.
//
// The session-79 analysis reported 254 "wide" pages, and that number was carried into
// the session-80 brief as the number of sheets carrying a detached side ornament. It is
// not: it was the count of pages whose crop came out wider than the 747px baseline, and
// that set has TWO members that hold no side ornament at all.
//
// Pages 1 and 2 are the ornate opening sheets. Their printed frame is itself 839px wide
// and runs the full height of the sheet, against 735px for every other page, so they were
// always going to be wider -- and the brief carves them out by name, allowing them to
// keep their distinct ornate geometry. Measured directly, each of them has exactly one
// printed component of any size (the frame), nothing detached outside it, and zero ink
// beyond the crop envelope.
//
// So: 252 sheets carry a detached juz/hizb/rub ornament and lose it, and 352 sheets lose
// nothing. 252 + 352 = 604. The 350 in the brief is the count of ornament-free sheets
// among the 602 ordinary ones, which is also exactly right -- it just excludes pages 1
// and 2 from both sides of the split.
// ---------------------------------------------------------------------------
const SIDE_MARKER_PAGES = 252;
const CLEAN_PAGES = 352;
const ORNATE_OPENING = [1, 2];

let P = 0;
let F = 0;
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; console.log('  [FAIL] ' + m); };
const head = (m) => console.log('\n' + m);
const rel = (p) => path.join(ROOT, p);
const name = (n) => 'page-' + String(n).padStart(3, '0') + '.webp';

// Every byte this guard prints must be ASCII: the assets are Quran pages and their
// record is written in ASCII on purpose.
function ascii(s) { return /^[\x09\x0a\x0d\x20-\x7e]*$/.test(s); }

/* ---------------------------------------------------------------- *
 * The WebP header, read by hand.
 *   VP8X : 10-byte payload, canvas width-1 and height-1 as 24-bit LE
 *   VP8L : 0x2f signature, then 14 bits of width-1 and 14 bits of height-1
 * A lossless file carries VP8L and never a lossy VP8 chunk.
 * ---------------------------------------------------------------- */
function readWebp(buf) {
  if (buf.length < 16) throw new Error('file is too short to be a WebP');
  if (buf.slice(0, 4).toString('latin1') !== 'RIFF') throw new Error('not a RIFF container');
  if (buf.slice(8, 12).toString('latin1') !== 'WEBP') throw new Error('not a WEBP file');
  const chunks = [];
  let vp8x = null;
  let vp8l = null;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.slice(p, p + 4).toString('latin1');
    const len = buf.readUInt32LE(p + 4);
    const body = buf.slice(p + 8, p + 8 + len);
    chunks.push(id);
    if (id === 'VP8X' && body.length >= 10) {
      vp8x = {
        w: 1 + (body[4] | (body[5] << 8) | (body[6] << 16)),
        h: 1 + (body[7] | (body[8] << 8) | (body[9] << 16)),
      };
    }
    if (id === 'VP8L' && body.length >= 5 && body[0] === 0x2f) {
      const bits = body[1] | (body[2] << 8) | (body[3] << 16) | (body[4] << 24);
      vp8l = { w: 1 + (bits & 0x3fff), h: 1 + ((bits >>> 14) & 0x3fff) };
    }
    p += 8 + len + (len & 1);
  }
  if (!vp8l) throw new Error('no VP8L chunk: the file is not lossless WebP');
  if (chunks.indexOf('VP8 ') >= 0) throw new Error('a lossy VP8 chunk is present');
  if (vp8x && (vp8x.w !== vp8l.w || vp8x.h !== vp8l.h))
    throw new Error('VP8X canvas ' + vp8x.w + 'x' + vp8x.h + ' disagrees with VP8L ' + vp8l.w + 'x' + vp8l.h);
  return { w: vp8l.w, h: vp8l.h, chunks: chunks.join(',') };
}

console.log('MADINA HAFS PAGE ASSET GUARD  (printed pages ' + FIRST_PAGE + '-' + LAST_PAGE + ')');
console.log('root: ' + ROOT);

/* ---------------------------------------------------------------- *
 * 1) THE RECORD
 * ---------------------------------------------------------------- */
head('1) PROVENANCE RECORD');
let rec = null;
let rawRecord = '';
try {
  rawRecord = fs.readFileSync(rel(RECORD), 'utf8');
  if (!ascii(rawRecord)) fail(RECORD + ' contains non-ASCII bytes');
  else pass(RECORD + ' is ASCII');
  rec = JSON.parse(rawRecord);
  pass(RECORD + ' parses as JSON');
} catch (e) {
  fail('cannot read ' + RECORD + ': ' + e.message);
}

// The superseded two-page record must be gone: two records of the same assets would
// let a stale one keep passing after the real one changed.
if (fs.existsSync(rel('data/madina-hafs-prototype.json')))
  fail('the superseded data/madina-hafs-prototype.json is still present');
else pass('the superseded data/madina-hafs-prototype.json has been removed');

if (rec) {
  const src = rec.source || {};
  const lic = rec.licence || {};
  const need = [
    ['source.publisher', src.publisher, /King Fahd/],
    ['source.edition', src.edition, /1441/],
    ['source.officialRightsPage', src.officialRightsPage, /^https:\/\/dm\.qurancomplex\.gov\.sa\/rights\/$/],
    ['source.itemUrl', src.itemUrl, /^https:\/\/archive\.org\/details\/MushafMadinaHafsGreen1441$/],
    ['source.downloadUrl', src.downloadUrl, /^https:\/\/archive\.org\/download\/MushafMadinaHafsGreen1441\/MushafMadinaHafsGreen1441\.pdf$/],
    ['source.fileName', src.fileName, /^MushafMadinaHafsGreen1441\.pdf$/],
    ['source.fileSha256', src.fileSha256, /^2f0b03925568fca326f47a5ec756df2c3eecc8b29f75471f3a0815a5a3e58d28$/],
    ['source.acquisitionDate', src.acquisitionDate, /^\d{4}-\d{2}-\d{2}$/],
    ['licence.result', lic.result, /^PROVISIONAL_OFFICIAL_PUBLIC_NOTICE$/],
  ];
  for (const [k, v, re] of need) {
    if (typeof v === 'string' && re.test(v)) pass(k + ' = ' + v);
    else fail(k + ' is missing or unexpected: ' + JSON.stringify(v));
  }
  if (src.fileBytes === 65008727) pass('source.fileBytes = 65008727');
  else fail('source.fileBytes is not the approved package size: ' + JSON.stringify(src.fileBytes));
  if (src.officialServerReachable === false) pass('source.officialServerReachable = false (mirror is recorded as a substitute)');
  else fail('source.officialServerReachable must be false while the official server is unreachable');
  if (lic.revalidationRequired === true) pass('licence.revalidationRequired = true');
  else fail('licence.revalidationRequired must be true');
  if (Array.isArray(rec.requiredFollowup) && rec.requiredFollowup.length === 5) pass('requiredFollowup lists 5 items');
  else fail('requiredFollowup must list the 5 deferred reader features');
  if (rec.extraction && rec.extraction.upscaled === false) pass('extraction.upscaled = false');
  else fail('extraction.upscaled must be false');
  if (rec.extraction && rec.extraction.pdfToPrintedOffset === PDF_OFFSET) pass('extraction.pdfToPrintedOffset = ' + PDF_OFFSET);
  else fail('extraction.pdfToPrintedOffset must be ' + PDF_OFFSET);
}

/* ---------------------------------------------------------------- *
 * 2) NO QURAN TEXT IN THE RECORD
 * The manifest describes pages; it must never carry their content. ASCII-only
 * already excludes Arabic script, and this also refuses the \uXXXX escape that
 * would smuggle it past an ASCII test.
 * ---------------------------------------------------------------- */
head('2) THE RECORD CARRIES NO QURAN TEXT');
if (rawRecord) {
  const esc = rawRecord.match(/\\u[0-9a-fA-F]{4}/g) || [];
  const arabic = esc.filter((e) => {
    const cp = parseInt(e.slice(2), 16);
    return (cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f)
      || (cp >= 0x08a0 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfdff)
      || (cp >= 0xfe70 && cp <= 0xfeff);
  });
  if (!arabic.length) pass('no Arabic codepoint, literal or escaped, appears in ' + RECORD);
  else fail(RECORD + ' carries ' + arabic.length + ' Arabic escape(s)');

  const pages0 = (rec && Array.isArray(rec.pages)) ? rec.pages : [];
  // Every per-page entry is geometry, provenance or a hash, and this pins the field
  // list rather than sniffing the values: a future build that started recording an
  // ayah, a verse range or an OCR result would introduce a key that is not here, and
  // would fail on the key alone, whatever it held.
  const allowed = new Set([
    'printedPage', 'pdfIndex', 'file', 'sourceWidth', 'sourceHeight',
    'sourceBitsPerComponent', 'centralFrame', 'retainedBox', 'topMetadataBox',
    'pageNumberBox', 'cropRect', 'cropGroup', 'safetyMarginPx', 'whiteThreshold',
    'sideMarkerPresent', 'sideMarkerShapes', 'sideMarkerBox', 'sideMarkerPixelsRemoved',
    'protectedPixelsDiscarded', 'width', 'height', 'upscaled',
    'bytes', 'sha256', 'chunks', 'differingSamples', 'worstChannelDelta', 'lossless',
  ]);
  const unknown = new Set();
  for (const p of pages0) for (const k of Object.keys(p)) if (!allowed.has(k)) unknown.add(k);
  if (!unknown.size) pass('every page entry holds only the ' + allowed.size + ' allowed geometry/provenance fields');
  else fail('page entries carry unexpected field(s): ' + [...unknown].slice(0, 8).join(', '));
}

/* ---------------------------------------------------------------- *
 * 3) THE 604 ASSETS
 * Compact by design: one line per finding, not one line per page.
 * ---------------------------------------------------------------- */
head('3) ASSETS (' + LAST_PAGE + ' pages)');
const pages = (rec && Array.isArray(rec.pages)) ? rec.pages : [];
if (pages.length === LAST_PAGE) pass('the record describes exactly ' + LAST_PAGE + ' pages');
else fail('the record must describe exactly ' + LAST_PAGE + ' pages, found ' + pages.length);

// The directory must hold those 604 files and nothing else: a stray page would ship
// unmeasured, and a missing one would 404 in the reader.
let onDisk = [];
try {
  onDisk = fs.readdirSync(rel(ASSET_DIR)).sort();
} catch (e) {
  fail('cannot read ' + ASSET_DIR + ': ' + e.message);
}
{
  const want = [];
  for (let n = FIRST_PAGE; n <= LAST_PAGE; n++) want.push(name(n));
  const have = new Set(onDisk);
  const missing = want.filter((f) => !have.has(f));
  const extra = onDisk.filter((f) => want.indexOf(f) < 0);
  if (!missing.length) pass(ASSET_DIR + ' holds all ' + want.length + ' page files');
  else fail(missing.length + ' page file(s) missing, first: ' + missing.slice(0, 8).join(', '));
  if (!extra.length) pass(ASSET_DIR + ' holds no extra entry');
  else fail(extra.length + ' unexpected entry/entries: ' + extra.slice(0, 8).join(', '));
  // readdir cannot return a duplicate name, so duplication can only arrive through
  // the record: two entries claiming the same page, or the same file.
  const byPage = new Set();
  const byFile = new Set();
  const dupes = [];
  for (const p of pages) {
    if (byPage.has(p.printedPage)) dupes.push('printedPage ' + p.printedPage);
    if (byFile.has(p.file)) dupes.push(p.file);
    byPage.add(p.printedPage);
    byFile.add(p.file);
  }
  if (!dupes.length) pass('no page number and no filename is recorded twice');
  else fail('duplicate record entries: ' + dupes.slice(0, 8).join(', '));
}

/* -- the sequence: 604 printed pages, 604 sequential mapped PDF indices -- */
{
  const bad = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.printedPage !== i + FIRST_PAGE) { bad.push('slot ' + i + ' is printedPage ' + p.printedPage); continue; }
    if (p.pdfIndex !== p.printedPage + PDF_OFFSET) bad.push('page ' + p.printedPage + ' maps to pdfIndex ' + p.pdfIndex);
    if (p.file !== ASSET_DIR + '/' + name(p.printedPage)) bad.push('page ' + p.printedPage + ' names ' + p.file);
  }
  if (!bad.length && pages.length === LAST_PAGE)
    pass('printed pages ' + FIRST_PAGE + '-' + LAST_PAGE + ' are sequential, and so are PDF indices '
      + (FIRST_PAGE + PDF_OFFSET) + '-' + (LAST_PAGE + PDF_OFFSET));
  else if (bad.length) fail(bad.length + ' sequence error(s): ' + bad.slice(0, 5).join('; '));
}

/* -- bytes, hashes, headers, geometry: measured on every page, reported in totals -- */
const problems = [];
let totalBytes = 0;
let lossless = 0;
let marked = 0;
let clean = 0;
let removedPx = 0;
const groups = new Map();          // cropGroup -> Set of "WxH"
const framePct = new Map();        // cropGroup -> [minWidthPct, maxWidthPct, minHPct, maxHPct]

// A box is retained only if the crop rectangle contains all four of its edges. This is how
// the guard proves -- from geometry, without decoding a single pixel -- that the floral
// frame, the top surah/juz metadata and the printed page number all survived the crop.
const inside = (box, c) =>
  box && c && box.x0 >= c.x && box.y0 >= c.y && box.x1 <= c.x + c.w - 1 && box.y1 <= c.y + c.h - 1;

for (const entry of pages) {
  const file = entry.file;
  const tag = 'page ' + entry.printedPage;
  let buf = null;
  try { buf = fs.readFileSync(rel(file)); } catch (e) { problems.push(tag + ': cannot read ' + file); continue; }
  totalBytes += buf.length;

  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== entry.sha256) problems.push(tag + ': sha256 is ' + sha + ', the record says ' + entry.sha256);
  if (buf.length !== entry.bytes) problems.push(tag + ': is ' + buf.length + ' bytes, the record says ' + entry.bytes);

  try {
    const im = readWebp(buf);
    if (im.w !== entry.width || im.h !== entry.height)
      problems.push(tag + ': header says ' + im.w + 'x' + im.h + ', the record says ' + entry.width + 'x' + entry.height);
    else lossless++;
  } catch (e) {
    problems.push(tag + ': header: ' + e.message);
  }

  // the crop must be the recorded rectangle of the recorded source page
  const c = entry.cropRect || {};
  if (c.w !== entry.width || c.h !== entry.height) problems.push(tag + ': crop rectangle does not match the output size');
  if (entry.sourceWidth !== SOURCE_W || entry.sourceHeight !== SOURCE_H)
    problems.push(tag + ': source page is ' + entry.sourceWidth + 'x' + entry.sourceHeight);
  if (!(c.x >= 0 && c.y >= 0 && c.x + c.w <= entry.sourceWidth && c.y + c.h <= entry.sourceHeight))
    problems.push(tag + ': crop rectangle escapes the source page');
  if (entry.width > entry.sourceWidth || entry.height > entry.sourceHeight || entry.upscaled !== false)
    problems.push(tag + ': was upscaled');
  if (entry.differingSamples !== 0) problems.push(tag + ': ' + entry.differingSamples + ' differing samples in the round trip');
  if (entry.lossless !== true) problems.push(tag + ': is not recorded as lossless');
  if (!(entry.safetyMarginPx > 0)) problems.push(tag + ': has no safety margin');

  /* -- what the crop kept: the frame, the metadata above it, the number below it -- */
  const f = entry.centralFrame;
  if (!inside(f, c)) problems.push(tag + ': the central floral frame is not wholly inside the crop');
  else if (!(f.x0 - c.x >= entry.safetyMarginPx && c.x + c.w - 1 - f.x1 >= entry.safetyMarginPx))
    problems.push(tag + ': the crop leaves no safety margin beside the floral frame');
  if (!inside(entry.retainedBox, c)) problems.push(tag + ': retained printed content escapes the crop');
  // Every ordinary sheet prints metadata above the frame and a page number below it. The
  // two ornate opening sheets have neither: their frame runs the whole height of the page.
  const ornate = ORNATE_OPENING.indexOf(entry.printedPage) >= 0;
  if (ornate) {
    if (entry.topMetadataBox || entry.pageNumberBox)
      problems.push(tag + ': an ornate opening sheet is not expected to carry a metadata band');
  } else {
    if (!entry.topMetadataBox) problems.push(tag + ': no top surah/juz metadata was retained');
    else if (!inside(entry.topMetadataBox, c)) problems.push(tag + ': the top metadata escapes the crop');
    else if (!(entry.topMetadataBox.y1 < f.y0)) problems.push(tag + ': the top metadata is not above the frame');
    if (!entry.pageNumberBox) problems.push(tag + ': no printed page number was retained');
    else if (!inside(entry.pageNumberBox, c)) problems.push(tag + ': the printed page number escapes the crop');
    else if (!(entry.pageNumberBox.y0 > f.y1)) problems.push(tag + ': the page number is not below the frame');
  }

  /* -- what the crop removed: detached side ornaments, and nothing else -- */
  if (entry.protectedPixelsDiscarded !== 0)
    problems.push(tag + ': discarded ' + entry.protectedPixelsDiscarded + ' protected printed pixel(s)');
  if (typeof entry.sideMarkerPresent !== 'boolean') problems.push(tag + ': sideMarkerPresent is not a boolean');
  else if (entry.sideMarkerPresent) {
    marked++;
    removedPx += entry.sideMarkerPixelsRemoved;
    if (!(entry.sideMarkerPixelsRemoved > 0)) problems.push(tag + ': is marked as carrying a side ornament but removed 0 pixels');
    if (!(entry.sideMarkerShapes > 0)) problems.push(tag + ': is marked as carrying a side ornament but names no detached shape');
    // the ornament must have sat OUTSIDE the crop: if it overlaps, it was not removed
    const b = entry.sideMarkerBox;
    if (!b || !(b.x1 < c.x || b.x0 > c.x + c.w - 1))
      problems.push(tag + ': the recorded side ornament is not wholly outside the crop');
  } else {
    clean++;
    if (entry.sideMarkerPixelsRemoved !== 0) problems.push(tag + ': removed ' + entry.sideMarkerPixelsRemoved + ' pixels but records no side ornament');
    if (entry.sideMarkerShapes !== 0 || entry.sideMarkerBox !== null) problems.push(tag + ': records a side-ornament shape but no side ornament');
  }

  /* -- uniform geometry: same output shape, same frame share, within a crop group -- */
  const g = entry.cropGroup;
  if (typeof g !== 'string' || !g) problems.push(tag + ': has no cropGroup');
  else {
    if (!groups.has(g)) groups.set(g, new Set());
    groups.get(g).add(entry.width + 'x' + entry.height);
    if (f && entry.width > 0 && entry.height > 0) {
      const wp = (f.x1 - f.x0 + 1) * 100 / entry.width;
      const hp = (f.y1 - f.y0 + 1) * 100 / entry.height;
      const cur = framePct.get(g);
      if (!cur) framePct.set(g, [wp, wp, hp, hp]);
      else {
        if (wp < cur[0]) cur[0] = wp;
        if (wp > cur[1]) cur[1] = wp;
        if (hp < cur[2]) cur[2] = hp;
        if (hp > cur[3]) cur[3] = hp;
      }
    }
  }
}

if (pages.length) {
  if (!problems.length) {
    pass(pages.length + ' page(s) verified: filename, byte count, SHA-256, WebP header, dimensions, crop bounds');
    pass(lossless + ' page(s) carry a VP8L chunk and no lossy VP8 chunk');
    pass('every page keeps its floral frame, its top metadata and its printed page number inside the crop');
    pass('0 protected printed pixels discarded, 0 differing round-trip samples, 0 pages upscaled, across all ' + pages.length);
    pass('total ' + totalBytes + ' bytes');
  } else {
    fail(problems.length + ' asset problem(s) across ' + pages.length + ' page(s):');
    for (const p of problems.slice(0, 20)) console.log('         - ' + p);
    if (problems.length > 20) console.log('         - ... and ' + (problems.length - 20) + ' more');
  }
  const recorded = pages.reduce((a, p) => a + (p.bytes || 0), 0);
  const claimed = (rec.totals || {}).totalAssetBytes;
  if (claimed === recorded && claimed === totalBytes) pass('totals.totalAssetBytes = ' + claimed + ' and matches the files on disk');
  else fail('totals.totalAssetBytes is ' + claimed + ', the files are ' + totalBytes);
}

/* ---------------------------------------------------------------- *
 * 3b) THE SIDE-ORNAMENT SPLIT AND THE UNIFORM GEOMETRY
 * ---------------------------------------------------------------- */
head('3b) SIDE ORNAMENTS REMOVED, AND UNIFORM PAGE GEOMETRY');
if (marked === SIDE_MARKER_PAGES) pass('exactly ' + SIDE_MARKER_PAGES + ' page(s) had a detached side ornament removed');
else fail('expected ' + SIDE_MARKER_PAGES + ' page(s) with a side ornament removed, the record has ' + marked);
if (clean === CLEAN_PAGES) pass('exactly ' + CLEAN_PAGES + ' page(s) lost no printed component at all');
else fail('expected ' + CLEAN_PAGES + ' page(s) without a removed ornament, the record has ' + clean);
if (marked + clean === LAST_PAGE) pass(marked + ' + ' + clean + ' = ' + LAST_PAGE + ', every page is accounted for once');
else fail(marked + ' + ' + clean + ' does not account for all ' + LAST_PAGE + ' pages');
if (removedPx > 0) pass(removedPx + ' side-ornament pixel(s) removed in total, and no other printed pixel');
else fail('no side-ornament pixels are recorded as removed');

// The two ornate opening sheets are wide because their own frame is wide, not because they
// carry an ornament. If one of them ever showed up as an ornament page, the detector would
// be cutting into the opening spread.
{
  const bad = ORNATE_OPENING.filter((n) => {
    const e = pages.filter((p) => p.printedPage === n)[0];
    return !e || e.sideMarkerPresent !== false || e.sideMarkerPixelsRemoved !== 0;
  });
  if (!bad.length) pass('the ornate opening pages ' + ORNATE_OPENING.join(' and ') + ' lost nothing');
  else fail('ornate opening page(s) recorded as losing content: ' + bad.join(', '));
}

// The reader stretches every page into the same box, so within a crop group the output
// shape and the frame's share of it must not vary. That is what stops a page that once
// carried a side ornament from rendering smaller than its neighbours.
{
  const bad = [];
  for (const [g, shapes] of groups) {
    const p = framePct.get(g) || [0, 0, 0, 0];
    // odd and even sheets differ by one source pixel of frame width, and nothing else
    const heights = new Set([...shapes].map((s) => s.split('x')[1]));
    if (heights.size !== 1) bad.push('group ' + g + ' has ' + heights.size + ' output heights');
    if (p[1] - p[0] > 0.05) bad.push('group ' + g + ' frame width share varies by ' + (p[1] - p[0]).toFixed(3) + '%');
    if (p[3] - p[2] > 0.05) bad.push('group ' + g + ' frame height share varies by ' + (p[3] - p[2]).toFixed(3) + '%');
  }
  if (!bad.length) {
    for (const [g, shapes] of groups) {
      const p = framePct.get(g);
      pass('crop group ' + g + ': ' + [...shapes].join(', ') + ', frame fills '
        + p[0].toFixed(3) + '-' + p[1].toFixed(3) + '% of width and '
        + p[2].toFixed(3) + '-' + p[3].toFixed(3) + '% of height');
    }
  } else fail('page geometry is not uniform: ' + bad.join('; '));
}

/* -- the page the owner approved by eye, and the page that had to change -- */
{
  const bad = [];
  for (const n of Object.keys(APPROVED)) {
    const entry = pages.filter((p) => p.printedPage === Number(n))[0];
    let sha = null;
    try { sha = crypto.createHash('sha256').update(fs.readFileSync(rel(ASSET_DIR + '/' + name(Number(n))))).digest('hex'); } catch (e) {}
    if (sha !== APPROVED[n]) bad.push('page ' + n + ' is ' + sha);
    else if (!entry || entry.sha256 !== APPROVED[n]) bad.push('page ' + n + ' is not recorded with its approved hash');
  }
  if (!bad.length) pass('the approved page 1 is byte-identical to what was accepted');
  else fail('approved page hash changed: ' + bad.join('; '));

  // and the superseded one must NOT come back
  const back = [];
  for (const n of Object.keys(SUPERSEDED)) {
    const entry = pages.filter((p) => p.printedPage === Number(n))[0];
    if (entry && entry.sha256 === SUPERSEDED[n]) back.push('page ' + n + ' still carries its pre-correction bytes');
    else if (!entry || entry.sideMarkerPresent !== true) back.push('page ' + n + ' is not recorded as a side-ornament removal');
  }
  if (!back.length) pass('page 77 was corrected: its side ornament is recorded as removed and its old bytes are gone');
  else fail(back.join('; '));
}

/* ---------------------------------------------------------------- *
 * 4) THE NOTICE
 * ---------------------------------------------------------------- */
head('4) RIGHTS NOTICE');
try {
  const txt = fs.readFileSync(rel(NOTICE), 'utf8');
  if (!ascii(txt)) fail(NOTICE + ' contains non-ASCII bytes');
  else pass(NOTICE + ' is ASCII');
  const musts = [
    ['publisher', /King Fahd Glorious Quran Printing Complex/],
    ['rights page', /https:\/\/dm\.qurancomplex\.gov\.sa\/rights\//],
    ['official site', /https:\/\/dm\.qurancomplex\.gov\.sa\//],
    ['acquisition date', /2026-07-31/],
    ['source package sha256', /2f0b03925568fca326f47a5ec756df2c3eecc8b29f75471f3a0815a5a3e58d28/],
    ['licence status', /PROVISIONAL_OFFICIAL_PUBLIC_NOTICE/],
    ['attribution', /Attribution/],
    ['the 604-page scope', /page-001\.webp[\s\S]{0,200}page-604\.webp/],
    ['the machine-readable record', /data\/madina-hafs-pages\.json/],
    ['the builder', /tools\/build-madina-hafs-pages\.py/],
  ];
  for (const [label, re] of musts) {
    if (re.test(txt)) pass(NOTICE + ' states the ' + label);
    else fail(NOTICE + ' does not state the ' + label);
  }
} catch (e) {
  fail('cannot read ' + NOTICE + ': ' + e.message);
}

/* ---------------------------------------------------------------- *
 * 5) THE WIRING -- the flag exists, defaults off, and covers 1-604
 * ---------------------------------------------------------------- */
head('5) RENDERER WIRING (index.html)');
try {
  const html = fs.readFileSync(rel('index.html'), 'utf8');
  const checks = [
    ['the madinaimg flag name', /madinaimg/],
    ['the page asset path pattern', /assets\/madina-hafs\/page-/],
    ['the 604-page scope constant', /MADINA_IMG_PAGES\s*=\s*604/],
    ['lazy loading on the page image', /loading="lazy"/],
    ['the neighbour prefetch', /prefetchMushafSvg/],
    ['the SVG fallback origin, untouched', /MUSHAF_SVG_ORIGIN/],
    ['the mushafsvg flag, untouched', /mushafsvg/],
  ];
  for (const [label, re] of checks) {
    if (re.test(html)) pass('index.html carries ' + label);
    else fail('index.html is missing ' + label);
  }

  /* -- 80: the full-height mode, and it is only on the madinaimg path -- */
  const st = (html.match(/const MADINA_IMG_ST = \{[^}]*\}/) || [''])[0];
  if (/width:\s*'100%'/.test(st) && /height:\s*'100%'/.test(st) && /objectFit:\s*'fill'/.test(st))
    pass('the printed page is width:100% height:100% object-fit:fill -- it fills the reading viewport');
  else fail('MADINA_IMG_ST is not the approved full-height fill: ' + JSON.stringify(st.slice(0, 160)));
  // contain is what left the white bands the owner rejected; it must not come back anywhere
  if (!/objectFit:\s*'contain'/.test(html)) pass('no object-fit contain survives on any reader path');
  else fail('index.html still fits a page with object-fit contain');
  // the page must not be cropped in CSS either -- fill scales, it does not clip
  if (!/objectFit:\s*'cover'/.test(html)) pass('no object-fit cover: the printed page is never cropped in CSS');
  else fail('index.html crops a page with object-fit cover');
  // the geometry must not depend on the chrome: both bars are absolute overlays
  if (/const headSt = MADINA_IMG_ON[\s\S]{0,200}?position:\s*'absolute'/.test(html)
    && /const barSt = MADINA_IMG_ON[\s\S]{0,200}?position:\s*'absolute'/.test(html))
    pass('the header and the pager are absolute overlays, so toggling them cannot resize the page');
  else fail('the header or the pager still takes layout height on the image path');
  // the flag must be opt-in: the default is read from a key that only '1' turns on
  if (/MADINA_IMG_KEY[\s\S]{0,400}?===\s*'1'/.test(html)) pass('index.html turns the image reader on only for an explicit 1');
  else fail('index.html does not gate the image reader on an explicit 1');
  // no page list may be materialised: 604 URLs in the bundle would be a table, not a function
  if (!/page-0*2\d\d\.webp/.test(html)) pass('index.html holds no materialised list of page URLs');
  else fail('index.html appears to enumerate page assets');
} catch (e) {
  fail('cannot read index.html: ' + e.message);
}

console.log('\nSUMMARY  PASS=' + P + '  FAIL=' + F);
process.exit(F ? 1 : 0);
