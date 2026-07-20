#!/usr/bin/env node
/* ============================================================================
 * build-mushaf-layout.cjs
 *
 * Emits  mushaf-layout.json  from the KFGQPC QCF v4 page data
 * (MohamadHajjRabee/quran-qcf4, 604 page files) -- i.e. the line and page
 * breaks of the PRINTED Madinah mushaf, 1441H edition.
 *
 * WHY THIS SOURCE AND NOT THE PREVIOUS ONE
 *   This artifact used to be built from zonetecde/mushaf-layout. Measured
 *   page-for-page against the QCF v4 data, 36 of the 604 pages carry different
 *   line/page break boundaries there. Surah start-pages agree everywhere; only
 *   the break positions inside those 36 pages differ. The old source is
 *   defective and the old builder was faithful to it. This one is faithful to
 *   the print.
 *
 * THIS FILE IS TRACKED ON PURPOSE.
 *   lib/data/fiqh-search.json.gz (5.4MB) is a live runtime input whose BUILDER
 *   is not in the repo. That artifact cannot be reproduced if it is ever lost or
 *   needs a refresh -- its source is 101MB sitting on one laptop. That is a debt,
 *   and it is written down as one. We are not creating a second debt of the same
 *   shape. If mushaf-layout.json is ever lost, this file rebuilds it, byte for
 *   byte, and layout-guard.cjs re-proves it.
 *
 *   There is exactly ONE builder for this artifact. Do not add a second. This
 *   project already carries a silent-regression trap from a stale parallel
 *   builder (build-bank.cjs); one is one too many.
 *
 * NETWORK: YES. This is the ONLY file in the mushaf pipeline that touches the
 * network. Run it when the layout needs re-emitting, never in CI, never at boot.
 *
 * WHAT IT KEEPS
 *   page number, line number, line type (h/b/t), word LOCATIONS ("S:A:W").
 *
 * WHAT IT THROWS AWAY, AND WHY
 *   .text    the source's own word string. Every letter the reader sees comes
 *            from quran-uthmani.json, which quran-guard.cjs holds frozen. A
 *            second copy of scripture in an unguarded file is the one thing we
 *            will not have.
 *   .code    KFQPC font codepoints. The fonts have an EMPTY GSUB table, so a
 *   .char    glyph is a closed drawing with no text inside it -- epistemically
 *   .font    a picture. And they are unlicensed. Not ours to ship.
 *   type=end the ayah-number tokens (6236 of them). index.html synthesises the
 *            ayah number at render time from the location itself.
 *   type=quarter  the 199 rub'-el-hizb marks. They are marks, not words, and the
 *            layout gives them no slot of their own.
 *   sajdah   the 15 tokens whose text is the sentinel '#1969'. Same reason.
 *   header   the source's surah name on a header line. We keep the header's
 *   labels   POSITION -- which is what the print fixes -- and synthesise its
 *            name from SURAH_NAMES in index.html.
 *
 * SO: the asset is boundary facts. No scripture, no glyph, no name, no number.
 * layout-guard.cjs enforces exactly that, and refuses to pass if one Arabic
 * codepoint appears in the output. THIS FILE IS ALSO PURE ASCII, including the
 * four ligature assertions below, which are spelled as codepoint arrays rather
 * than as Arabic literals.
 *
 * USAGE
 *   node build-mushaf-layout.cjs                 # fetch, build, verify, write
 *   node build-mushaf-layout.cjs --cache DIR     # reuse pages already in DIR
 *   node build-mushaf-layout.cjs --dry           # build + verify, write nothing
 *
 * After a rebuild the sha CHANGES. Re-pin LAYOUT_SHA in layout-guard.cjs, then
 * run the guard. The guard is what certifies the artifact -- not this builder.
 * ==========================================================================*/

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAW = 'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/';
const N_PAGES = 604;
const OUT = path.join(__dirname, 'mushaf-layout.json');

const cacheArg = process.argv.indexOf('--cache');
const CACHE = cacheArg > -1 ? process.argv[cacheArg + 1] : path.join(__dirname, '.qcf4-cache');
const DRY = process.argv.includes('--dry');
/* --emit PATH writes the candidate somewhere else, so it can be diffed against
 * the live artifact before the live artifact is touched. */
const emitArg = process.argv.indexOf('--emit');
const EMIT = emitArg > -1 ? process.argv[emitArg + 1] : null;

/* --------------------------------------------------------------------------
 * DECLARED ARITHMETIC. Every one of these is asserted below. A mismatch is a
 * refusal to write, not a warning. These numbers are the artifact's identity.
 * ------------------------------------------------------------------------ */
const EXPECT = {
  wordTokens: 77448, // source tokens with type == 'word'
  endTokens: 6236, // ayah-number tokens, all dropped
  quarterTokens: 199, // rub'-el-hizb marks, all dropped
  headerTokens: 114, // one per surah
  sajdahDropped: 15, // tokens whose text is '#1969'
  merges: 4, // typographic ligatures, two tokens -> one slot
  cells: 77429, // 77448 - 15 - 4
  ayat: 6236,
  pages: 604,
  /* 602 * 15 + 2 * 8. The two short pages are 1 and 2 (al-Fatihah and the
   * opening of al-Baqarah), which the print sets at 8 lines.
   *
   * The PREVIOUS artifact had 9040, because the old source dropped three whole
   * lines from each of pages 586 and 590 -- the surah headers for 81 and 85,
   * their bismillahs, and the text line closing the surah before. Those two
   * surahs had no header line at all. That is why layout-guard's N_LINES moves
   * with this rebuild; it is a corrected count, not a loosened one. */
  lines: 9046,
};

const SAJDAH_SENTINEL = '#1969';

/* THE FOUR TYPOGRAPHIC LIGATURES.
 * The printed mushaf sets two words inside a single boxed slot at exactly four
 * places and nowhere else. The source data does NOT mark them -- it emits two
 * tokens -- so the merge is a fact about the PRINT, carried here as four
 * (ayah, our-word-index) coordinates. It is not derivable from the text alone:
 * the same two words occur unmerged elsewhere.
 *
 * What IS derived, and asserted, is that the two tokens sitting at each of
 * those coordinates really are the pair named. If the source ever shifts by one
 * token, the codepoint assertion fires and this builder refuses to write.
 *
 * Spelled as codepoint arrays so this file stays pure ASCII.
 */
const BADA = [0x628, 0x64e, 0x639, 0x652, 0x62f, 0x64e]; // BA'DA
const MAA = [0x645, 0x64e, 0x627]; // MAA
const IL = [0x625, 0x650, 0x644, 0x652]; // IL
const YAASEEN = [0x64a, 0x64e, 0x627, 0x633, 0x650, 0x64a, 0x646, 0x64e]; // YAASEEN

const LIGATURES = [
  { key: '2:181', w: 3, pair: [BADA, MAA] },
  { key: '8:6', w: 4, pair: [BADA, MAA] },
  { key: '13:37', w: 8, pair: [BADA, MAA] },
  { key: '37:130', w: 3, pair: [IL, YAASEEN] },
];

/* 13:37 is the ONLY ligature whose two halves sit on DIFFERENT lines
 * (page 254, line 6 and line 7). POLICY: the merged cell goes on the FIRST
 * line -- line 6. The word is set across the line break in the print; a slot
 * can only live in one place, and the slot follows the word's start. */
const CROSS_LINE_KEY = '13:37';

/* --------------------------------------------------------------------------
 * PLUMBING
 * ------------------------------------------------------------------------ */
const problems = [];
function must(cond, code, detail) {
  if (!cond) problems.push(code + (detail ? '  ' + detail : ''));
  return cond;
}
function eq(actual, expected, code) {
  return must(actual === expected, code, 'expected ' + expected + ', got ' + actual);
}
function cps(s) {
  return [...s].map((c) => c.codePointAt(0));
}
function sameCps(s, arr) {
  const a = cps(s);
  return a.length === arr.length && a.every((c, i) => c === arr[i]);
}
function hex(arr) {
  return arr.map((c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

/* --------------------------------------------------------------------------
 * FETCH
 * ------------------------------------------------------------------------ */
async function fetchPages() {
  fs.mkdirSync(CACHE, { recursive: true });
  const queue = [];
  for (let p = 1; p <= N_PAGES; p++) queue.push(p);
  const failed = [];
  let got = 0;

  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      const num = String(p).padStart(3, '0');
      const file = path.join(CACHE, num + '.json');
      if (fs.existsSync(file)) {
        try {
          JSON.parse(fs.readFileSync(file, 'utf8'));
          got++;
          continue;
        } catch (e) {
          fs.unlinkSync(file); // a corrupt cache entry is not a cache entry
        }
      }
      try {
        const r = await fetch(RAW + num + '.json');
        if (!r.ok) {
          failed.push(num + ' HTTP ' + r.status);
          continue;
        }
        const t = await r.text();
        JSON.parse(t); // must parse before it lands on disk
        fs.writeFileSync(file, t);
        got++;
      } catch (e) {
        failed.push(num + ' ' + String(e && e.message).slice(0, 40));
      }
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker));
  console.log('  fetched ' + got + '/' + N_PAGES);
  if (failed.length) {
    console.log('FATAL  ' + failed.length + ' page(s) failed:');
    failed.slice(0, 10).forEach((f) => console.log('   ' + f));
    process.exit(1);
  }
}

/* --------------------------------------------------------------------------
 * PASS 1  --  read the source into a flat, ordered token stream
 * ------------------------------------------------------------------------ */
function readSource() {
  const stream = []; // every kept word token, in print order
  const shell = []; // page/line skeleton with types
  const counts = { word: 0, end: 0, quarter: 0, surah_header: 0, bismillah: 0 };
  let sajdah = 0;

  for (let p = 1; p <= N_PAGES; p++) {
    const j = JSON.parse(fs.readFileSync(path.join(CACHE, String(p).padStart(3, '0') + '.json'), 'utf8'));
    must(j.page === p, 'PAGE_DECLARES_WRONG_NUMBER', 'file ' + p + ' says ' + j.page);
    const lines = [];
    for (let li = 0; li < j.lines.length; li++) {
      const ln = j.lines[li];
      must(ln.line === li + 1, 'LINE_ORDER', 'page ' + p + ' slot ' + li + ' says line ' + ln.line);
      const types = ln.words.map((w) => w.type);
      for (const t of types) counts[t] = (counts[t] || 0) + 1;

      /* THE MAPPING RULE. A header or a bismillah owns its line alone; if it
       * ever shares one, the rule below would silently mis-type the line, so
       * assert it rather than assume it. */
      let t;
      if (types.length === 1 && types[0] === 'surah_header') t = 'h';
      else if (types.length === 1 && types[0] === 'bismillah') t = 'b';
      else {
        t = 't';
        must(
          !types.includes('surah_header') && !types.includes('bismillah'),
          'CHROME_SHARES_A_TEXT_LINE',
          'page ' + p + ' line ' + ln.line + ' types=' + types.join(',')
        );
      }

      lines.push({ n: ln.line, t, cells: [] });
      if (t !== 't') continue;

      for (const w of ln.words) {
        if (w.type !== 'word') continue; // drops end + quarter
        if (w.text === SAJDAH_SENTINEL) {
          sajdah++;
          continue;
        }
        stream.push({ key: w.verse_key, text: w.text, page: p, lineIdx: lines.length - 1, pageIdx: shell.length });
      }
    }
    shell.push({ n: p, lines });
  }
  return { stream, shell, counts, sajdah };
}

/* --------------------------------------------------------------------------
 * PASS 2  --  apply the four ligatures, then number the cells
 * ------------------------------------------------------------------------ */
function applyLigatures(stream) {
  // group token stream indices by ayah, in order
  const byAyah = new Map();
  for (let i = 0; i < stream.length; i++) {
    const k = stream[i].key;
    if (!byAyah.has(k)) byAyah.set(k, []);
    byAyah.get(k).push(i);
  }

  const drop = new Set(); // stream indices that are the SECOND half of a merge
  let crossLine = 0;

  for (const lig of LIGATURES) {
    const idx = byAyah.get(lig.key);
    if (!must(idx, 'LIGATURE_AYAH_MISSING', lig.key)) continue;
    // No merge precedes another inside the same ayah, so our word index W maps
    // to raw offsets W-1 and W.
    const ia = idx[lig.w - 1];
    const ib = idx[lig.w];
    if (!must(ia !== undefined && ib !== undefined, 'LIGATURE_OUT_OF_RANGE', lig.key + ' w=' + lig.w)) continue;
    const a = stream[ia];
    const b = stream[ib];
    const okA = sameCps(a.text, lig.pair[0]);
    const okB = sameCps(b.text, lig.pair[1]);
    must(okA, 'LIGATURE_TEXT_MISMATCH', lig.key + ' first half: expected ' + hex(lig.pair[0]) + ', got ' + hex(cps(a.text)));
    must(okB, 'LIGATURE_TEXT_MISMATCH', lig.key + ' second half: expected ' + hex(lig.pair[1]) + ', got ' + hex(cps(b.text)));
    if (!okA || !okB) continue;

    const sameLine = a.pageIdx === b.pageIdx && a.lineIdx === b.lineIdx;
    if (!sameLine) {
      crossLine++;
      must(
        lig.key === CROSS_LINE_KEY,
        'UNEXPECTED_CROSS_LINE_LIGATURE',
        lig.key + ' halves are on different lines; only ' + CROSS_LINE_KEY + ' may be'
      );
      // POLICY: the merged cell stays where the word STARTS -- the first line.
      // Nothing to do: we drop the second half and keep a's coordinates.
    }
    drop.add(ib);
  }

  eq(drop.size, EXPECT.merges, 'MERGE_COUNT');
  eq(crossLine, 1, 'CROSS_LINE_LIGATURE_COUNT');
  return drop;
}

function build(stream, shell, drop) {
  const seq = new Map(); // ayah key -> running 1-based word index
  let cells = 0;
  for (let i = 0; i < stream.length; i++) {
    if (drop.has(i)) continue;
    const tok = stream[i];
    const w = (seq.get(tok.key) || 0) + 1;
    seq.set(tok.key, w);
    shell[tok.pageIdx].lines[tok.lineIdx].cells.push(tok.key + ':' + w);
    cells++;
  }

  const out = { pages: N_PAGES, words: cells, p: [] };
  let lineTotal = 0;
  for (const pg of shell) {
    const l = [];
    for (const ln of pg.lines) {
      lineTotal++;
      const o = { n: ln.n, t: ln.t };
      if (ln.t === 't') {
        must(ln.cells.length > 0, 'EMPTY_TEXT_LINE', 'page ' + pg.n + ' line ' + ln.n);
        o.w = ln.cells;
      }
      l.push(o);
    }
    out.p.push({ n: pg.n, l });
  }
  return { out, cells, lineTotal, ayat: seq.size };
}

/* --------------------------------------------------------------------------
 * MAIN
 * ------------------------------------------------------------------------ */
(async () => {
  console.log('build-mushaf-layout  --  KFGQPC QCF v4 / Madinah 1441H  ->  ' + path.basename(OUT));
  await fetchPages();

  const { stream, shell, counts, sajdah } = readSource();
  eq(counts.word || 0, EXPECT.wordTokens, 'SOURCE_WORD_TOKENS');
  eq(counts.end || 0, EXPECT.endTokens, 'SOURCE_END_TOKENS');
  eq(counts.quarter || 0, EXPECT.quarterTokens, 'SOURCE_QUARTER_TOKENS');
  eq(counts.surah_header || 0, EXPECT.headerTokens, 'SOURCE_HEADER_TOKENS');
  eq(sajdah, EXPECT.sajdahDropped, 'SAJDAH_DROPPED');

  const drop = applyLigatures(stream);
  const { out, cells, lineTotal, ayat } = build(stream, shell, drop);

  eq(cells, EXPECT.cells, 'CELL_COUNT');
  eq(ayat, EXPECT.ayat, 'AYAH_COUNT');
  eq(out.p.length, EXPECT.pages, 'PAGE_COUNT');
  eq(lineTotal, EXPECT.lines, 'LINE_COUNT');
  eq(out.words, cells, 'HEADER_SELF_CONSISTENT');

  const per = {};
  for (const pg of out.p) per[pg.l.length] = (per[pg.l.length] || 0) + 1;
  eq(per[15] || 0, 602, 'PAGES_WITH_15_LINES');
  eq(per[8] || 0, 2, 'PAGES_WITH_8_LINES');
  must(out.p[0].l.length === 8 && out.p[1].l.length === 8, 'SHORT_PAGES_ARE_1_AND_2');

  const json = JSON.stringify(out);

  // Refuse to write scripture into an unguarded file. Non-negotiable.
  let leak = 0;
  for (let i = 0; i < json.length; i++) {
    const cp = json.codePointAt(i);
    if ((cp >= 0x0600 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfeff)) leak++;
  }
  eq(leak, 0, 'SCRIPTURE_LEAK');

  if (problems.length) {
    console.log('\nFATAL  ' + problems.length + ' assertion(s) failed. Writing NOTHING.');
    for (const p of problems.slice(0, 20)) console.log('   * ' + p);
    if (problems.length > 20) console.log('   (' + (problems.length - 20) + ' more suppressed)');
    process.exit(1);
  }

  console.log('');
  console.log('  bytes      ' + Buffer.byteLength(json, 'utf8'));
  console.log('  pages      ' + out.pages);
  console.log('  lines      ' + lineTotal);
  console.log('  ayat       ' + ayat);
  console.log('  word slots ' + out.words + '   (' + EXPECT.wordTokens + ' - ' + EXPECT.sajdahDropped + ' sajdah - ' + EXPECT.merges + ' ligature)');

  if (EMIT) {
    fs.writeFileSync(EMIT, json);
    console.log('  sha256     ' + crypto.createHash('sha256').update(Buffer.from(json, 'utf8')).digest('hex'));
    console.log('  (--emit: wrote candidate to ' + EMIT + '; ' + path.basename(OUT) + ' untouched)');
    return;
  }
  if (DRY) {
    const sha = crypto.createHash('sha256').update(Buffer.from(json, 'utf8')).digest('hex');
    console.log('  sha256     ' + sha + '   (--dry: nothing written)');
    return;
  }

  fs.writeFileSync(OUT, json); // single line, UTF-8, no BOM, no trailing newline
  const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex');
  console.log('  sha256     ' + sha);
  console.log('');
  console.log('NEXT: pin LAYOUT_SHA = ' + sha);
  console.log('      in layout-guard.cjs, then:  node layout-guard.cjs');
  console.log('      The GUARD certifies the artifact. This builder does not.');
})();
