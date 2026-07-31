#!/usr/bin/env node
/*
 * madina-hafs-guard.cjs -- the two printed Madina page images, and nothing else.
 *
 * The image prototype ships two binary assets that no other guard measures. This one
 * pins them: the exact two filenames, the exact pixel dimensions read out of the WebP
 * header itself, the exact SHA-256 of the bytes, and the provenance record that says
 * where they came from and under what licence status.
 *
 * It reads the images as BYTES and never decodes or prints their content, so no Quran
 * text can pass through it. All output is ASCII.
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
const RECORD = 'data/madina-hafs-prototype.json';
const NOTICE = 'MUSHAF-MADINA-ASSET-NOTICE.md';
const ASSETS = ['assets/madina-hafs/page-001.webp', 'assets/madina-hafs/page-077.webp'];

let P = 0;
let F = 0;
const pass = (m) => { P++; console.log('  [PASS] ' + m); };
const fail = (m) => { F++; console.log('  [FAIL] ' + m); };
const head = (m) => console.log('\n' + m);
const rel = (p) => path.join(ROOT, p);

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

console.log('MADINA HAFS PROTOTYPE ASSET GUARD');
console.log('root: ' + ROOT);

/* ---------------------------------------------------------------- *
 * 1) THE RECORD
 * ---------------------------------------------------------------- */
head('1) PROVENANCE RECORD');
let rec = null;
try {
  const raw = fs.readFileSync(rel(RECORD), 'utf8');
  if (!ascii(raw)) fail(RECORD + ' contains non-ASCII bytes');
  else pass(RECORD + ' is ASCII');
  rec = JSON.parse(raw);
  pass(RECORD + ' parses as JSON');
} catch (e) {
  fail('cannot read ' + RECORD + ': ' + e.message);
}

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
    ['source.fileSha256', src.fileSha256, /^[0-9a-f]{64}$/],
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
}

/* ---------------------------------------------------------------- *
 * 2) THE TWO ASSETS -- filenames, dimensions, hashes
 * ---------------------------------------------------------------- */
head('2) ASSETS');
const pages = (rec && Array.isArray(rec.pages)) ? rec.pages : [];
if (pages.length === 2) pass('the record describes exactly 2 pages');
else fail('the record must describe exactly 2 pages, found ' + pages.length);

// nothing else may live in the asset directory: a stray page would ship unmeasured
try {
  const dir = fs.readdirSync(rel('assets/madina-hafs')).sort();
  const want = ['page-001.webp', 'page-077.webp'];
  if (dir.length === want.length && dir.every((f, i) => f === want[i])) pass('assets/madina-hafs holds exactly: ' + want.join(', '));
  else fail('assets/madina-hafs holds unexpected entries: ' + dir.join(', '));
} catch (e) {
  fail('cannot read assets/madina-hafs: ' + e.message);
}

for (const file of ASSETS) {
  const entry = pages.filter((p) => p && p.file === file)[0];
  if (!entry) { fail('no record entry for ' + file); continue; }
  let buf = null;
  try { buf = fs.readFileSync(rel(file)); } catch (e) { fail('cannot read ' + file + ': ' + e.message); continue; }

  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha === entry.sha256) pass(file + ' sha256 = ' + sha);
  else fail(file + ' sha256 is ' + sha + ', the record says ' + entry.sha256);

  if (buf.length === entry.bytes) pass(file + ' bytes = ' + buf.length);
  else fail(file + ' is ' + buf.length + ' bytes, the record says ' + entry.bytes);

  try {
    const im = readWebp(buf);
    if (im.w === entry.width && im.h === entry.height) pass(file + ' is ' + im.w + 'x' + im.h + ' (chunks ' + im.chunks + ')');
    else fail(file + ' is ' + im.w + 'x' + im.h + ', the record says ' + entry.width + 'x' + entry.height);
  } catch (e) {
    fail(file + ' header: ' + e.message);
  }

  // the crop must be the recorded rectangle of the recorded source page, and it must
  // have thrown away no ink at all
  const c = entry.cropRect || {};
  if (c.w === entry.width && c.h === entry.height) pass(file + ' crop rectangle matches the output size');
  else fail(file + ' crop rectangle ' + c.w + 'x' + c.h + ' does not match the output size');
  if (c.x >= 0 && c.y >= 0 && c.x + c.w <= entry.sourceWidth && c.y + c.h <= entry.sourceHeight)
    pass(file + ' crop rectangle lies inside the ' + entry.sourceWidth + 'x' + entry.sourceHeight + ' source page');
  else fail(file + ' crop rectangle escapes the source page');
  if (entry.width <= entry.sourceWidth && entry.height <= entry.sourceHeight) pass(file + ' was not upscaled');
  else fail(file + ' is larger than its source page');
  if (entry.inkPixelsDiscarded === 0) pass(file + ' discarded 0 printed pixels');
  else fail(file + ' discarded ' + entry.inkPixelsDiscarded + ' printed pixels');
  if (entry.safetyMarginPx > 0) pass(file + ' kept a ' + entry.safetyMarginPx + 'px safety margin');
  else fail(file + ' has no safety margin');
}

/* ---------------------------------------------------------------- *
 * 3) THE NOTICE
 * ---------------------------------------------------------------- */
head('3) RIGHTS NOTICE');
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
    ['page-001 asset by name', /page-001\.webp/],
    ['page-077 asset by name', /page-077\.webp/],
  ];
  for (const [label, re] of musts) {
    if (re.test(txt)) pass(NOTICE + ' states the ' + label);
    else fail(NOTICE + ' does not state the ' + label);
  }
} catch (e) {
  fail('cannot read ' + NOTICE + ': ' + e.message);
}

/* ---------------------------------------------------------------- *
 * 4) THE WIRING -- the flag exists, defaults off, and only these two pages use it
 * ---------------------------------------------------------------- */
head('4) RENDERER WIRING (index.html)');
try {
  const html = fs.readFileSync(rel('index.html'), 'utf8');
  const checks = [
    ['the madinaimg flag name', /madinaimg/],
    ['the page-001 asset path', /assets\/madina-hafs\/page-001\.webp/],
    ['the page-077 asset path', /assets\/madina-hafs\/page-077\.webp/],
    ['the two-page allow list', /MADINA_IMG_PAGES/],
    ['the SVG fallback origin, untouched', /MUSHAF_SVG_ORIGIN/],
    ['the mushafsvg flag, untouched', /mushafsvg/],
  ];
  for (const [label, re] of checks) {
    if (re.test(html)) pass('index.html carries ' + label);
    else fail('index.html is missing ' + label);
  }
  // the flag must be opt-in: the default is read from a key that only '1' turns on
  if (/MADINA_IMG_KEY[\s\S]{0,400}?===\s*'1'/.test(html)) pass('index.html turns the prototype on only for an explicit 1');
  else fail('index.html does not gate the prototype on an explicit 1');
} catch (e) {
  fail('cannot read index.html: ' + e.message);
}

console.log('\nSUMMARY  PASS=' + P + '  FAIL=' + F);
process.exit(F ? 1 : 0);
