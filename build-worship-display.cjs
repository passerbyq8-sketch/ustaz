#!/usr/bin/env node
/*
 * build-worship-display.cjs  --  GATE 7
 *
 * Generates worship-display.json from worship-golden.json.
 * The display file is what the CLIENT renders. The golden is what the PROMPT holds.
 * They are NOT the same: every golden block opens with a governing paragraph
 * addressed to the MODEL, which a child must never see.
 *
 * This file is deliberately PURE ASCII. Every Arabic payload is a base64 constant
 * with a sha256 round-trip assertion (rule Q5). Nothing here is hand-typed Arabic.
 *
 *   node build-worship-display.cjs --build    writes worship-display.json
 *   node build-worship-display.cjs --verify   regenerates in memory, byte-compares,
 *                                             exits 1 on ANY drift.   <-- gate 7
 *
 * FAIL-CLOSED BY DESIGN: the golden's sha256 is pinned below. If the golden moves,
 * this script REFUSES to run. That is correct -- the line ranges are only valid for
 * the exact golden they were read from. A human must re-read the blocks and re-pin.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GOLDEN = path.join(__dirname, 'worship-golden.json');
const OUT = path.join(__dirname, 'worship-display.json');

// --- pinned: the golden this script was written against -----------------------
const GOLDEN_SHA = 'A13C34BA4BA52A11D8EA632BF624D0B2665818B8AB6456CF2F2E4A6CA62ACBED';

// --- the ghusl:young display text. Authored by the user, 13 July 2026. --------
// Every sentence is drawn from his own golden block; only the pronoun moved.
// Q32: Claude does not author religious text.
const GHUSL_YOUNG_B64 =
  '2YfYsNinINi62Y/Ys9mE2Ywg2YTZhNmD2KjYp9ix2Iwg2YrZgdi52YTZj9mHINin2YTYpdmG' +
  '2LPYp9mG2Y8g2K3ZitmGINmK2YPYqNmO2LHZjyDZiNmK2KjZhNmP2Log4oCUINmB2YTYpyDZ' +
  'itmE2LLZhdmP2YMg2KPZhtiq2Y4g2KfZhNii2YYuCgrZiNmH2Ygg2KjYqNiz2KfYt9ipOiDY' +
  't9mH2KfYsdip2Ywg2YrYudmP2YXZj9mRINmB2YrZh9inINin2YTYpdmG2LPYp9mG2Y8g2KjY' +
  'r9mG2Y7ZhyDZg9mE2Y7ZkdmHINio2KfZhNmF2KfYodmQINio2YbZitmR2KnZkCDYp9mE2LfZ' +
  'h9in2LHYqdiMINmF2YYg2LHYo9iz2ZDZhyDYpdmE2Ykg2YLYr9mF2ZDZhy4KCtmI2KrZgdin' +
  '2LXZitmE2Y/ZhyDYqtiq2LnZhNmR2YXZj9mH2Kcg2YXZhiDYo9io2YrZgyDYo9mIINij2YXZ' +
  'kdmDINit2YrZhiDYqtmD2KjZjtixLgoK2YjYp9mE2LDZiiDZiti52YbZitmDINin2YTYotmG' +
  'OiDYp9mE2YjYttmI2KHZjyDZiNin2YTYtdmE2KfYqSDigJQg2YjYo9mG2Kcg2KPZj9i52YTZ' +
  'kdmF2Y/ZgyDYpdmK2ZHYp9mH2YXYpyDZhdiq2Ykg2LTYptiqLg==';
const GHUSL_YOUNG_SHA16 = '67c7605e965cb068';   // sha256(utf8 bytes).slice(0,16)

// --- the eight cells. Selection is by rawHash + band: ASCII, never Arabic (Q60).
// `lines` = [first, last] inclusive, 0-indexed, into the golden block's rawText.
// Everything before `first` is the banner + the governing paragraph + the model's
// warning line -- instructions to the MODEL, never shown to a human.
const CELLS = [
  { id: 'salah',    band: 'young', rawHash: '58a124157da52bf0', lines: [6, 23] },
  { id: 'salah',    band: 'adult', rawHash: 'dccc30bb7fc9584f', lines: [6, 23] },
  { id: 'wudu',     band: 'young', rawHash: 'decd0881a0dfa01f', lines: [6, 17] },
  { id: 'wudu',     band: 'adult', rawHash: '02492dcf115aea87', lines: [6, 18] },
  { id: 'ghusl',    band: 'young', rawHash: '6c347163199b02e1', lines: null   },  // authored
  { id: 'ghusl',    band: 'adult', rawHash: '26660fca572bd7b9', lines: [4, 16] },
  { id: 'tayammum', band: 'young', rawHash: 'd9512af1670c69ba', lines: [4, 13] },
  { id: 'tayammum', band: 'adult', rawHash: 'd9512af1670c69ba', lines: [4, 13] },
];

function die(msg) { console.error('[worship-display] FAIL: ' + msg); process.exit(1); }

function generate() {
  if (!fs.existsSync(GOLDEN)) die('worship-golden.json not found');
  const raw = fs.readFileSync(GOLDEN);
  const sha = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  if (sha !== GOLDEN_SHA) {
    die('the golden has MOVED.\n' +
        '        expected sha256 ' + GOLDEN_SHA + '\n' +
        '        actual   sha256 ' + sha + '\n' +
        '        The line ranges in this script were read from the pinned golden and\n' +
        '        are NOT valid for any other. Re-read the blocks, re-pin, then rebuild.');
  }

  const golden = JSON.parse(raw.toString('utf8'));
  const blocks = Object.values(golden.blocks);

  // ghusl:young -- authored text, base64, round-trip asserted (Q5)
  const ghuslYoung = Buffer.from(GHUSL_YOUNG_B64, 'base64');
  const gSha = crypto.createHash('sha256').update(ghuslYoung).digest('hex').slice(0, 16);
  if (gSha !== GHUSL_YOUNG_SHA16) {
    die('ghusl:young base64 round-trip FAILED. expected ' + GHUSL_YOUNG_SHA16 + ' got ' + gSha);
  }

  const cells = {};
  for (const c of CELLS) {
    const key = c.id + ':' + c.band;
    const b = blocks.find(x => x.rawHash === c.rawHash && x.band === c.band);
    if (!b) die('no golden block with rawHash=' + c.rawHash + ' band=' + c.band + ' (cell ' + key + ')');

    let text;
    if (c.lines === null) {
      text = ghuslYoung.toString('utf8');
    } else {
      const ls = b.rawText.split('\n');
      if (c.lines[1] >= ls.length) die('cell ' + key + ': line range exceeds block length');
      text = ls.slice(c.lines[0], c.lines[1] + 1).join('\n').trim();
    }
    if (!text || text.length < 20) die('cell ' + key + ': empty or absurdly short display text');
    cells[key] = { rawHash: c.rawHash, band: c.band, chars: text.length, text };
  }

  if (Object.keys(cells).length !== 8) die('expected 8 cells, got ' + Object.keys(cells).length);
  if (cells['tayammum:young'].text !== cells['tayammum:adult'].text) {
    die('tayammum arms diverged -- they are byte-identical in the golden by design');
  }

  return {
    note: 'GENERATED by build-worship-display.cjs. Do not edit by hand -- gate 7 will fail.',
    generatedFrom: 'worship-golden.json',
    goldenSha256: GOLDEN_SHA,
    cells,
  };
}

const mode = process.argv[2];
if (mode === '--build') {
  const doc = generate();
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const bytes = fs.statSync(OUT).size;
  console.log('[worship-display] BUILT   cells=8  bytes=' + bytes);
  for (const [k, v] of Object.entries(doc.cells)) {
    console.log('   ' + k.padEnd(16) + ' rawHash=' + v.rawHash + '  chars=' + v.chars);
  }
  process.exit(0);
} else if (mode === '--verify') {
  if (!fs.existsSync(OUT)) die('worship-display.json is MISSING. run --build');
  const want = JSON.stringify(generate(), null, 2) + '\n';
  const have = fs.readFileSync(OUT, 'utf8');
  if (want !== have) {
    die('worship-display.json has DRIFTED from the golden.\n' +
        '        Someone edited the display file by hand, or the golden changed.\n' +
        '        It is GENERATED. Re-run --build; never patch it.');
  }
  console.log('[worship-display] OK      8 cells, byte-identical to the golden');
  process.exit(0);
} else {
  console.error('usage: node build-worship-display.cjs --build | --verify');
  process.exit(2);   // Q50: a guard never exits 0 on a path where it compared nothing
}
