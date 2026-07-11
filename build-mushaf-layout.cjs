#!/usr/bin/env node
/* ============================================================================
 * tools/build-mushaf-layout.cjs
 *
 * Emits  mushaf-layout.json  from  zonetecde/mushaf-layout  (604 page files).
 *
 * THIS FILE IS TRACKED ON PURPOSE.
 *   lib/data/fiqh-search.json.gz (5.4MB) is a live runtime input whose BUILDER
 *   is not in the repo. That artifact cannot be reproduced if it is ever lost or
 *   needs a refresh -- its source is 101MB sitting on one laptop. That is a debt,
 *   and it is written down as one. We are not creating a second debt of the same
 *   shape. If mushaf-layout.json is ever lost, this file rebuilds it, byte for
 *   byte, and layout-guard.cjs re-proves it.
 *
 * NETWORK: YES. This is the ONLY file in the mushaf pipeline that touches the
 * network. Run it when the layout needs re-emitting, never in CI, never at boot.
 *
 * WHAT IT KEEPS
 *   page number, line number, line type (h/b/t), word LOCATIONS ("S:A:W").
 *
 * WHAT IT THROWS AWAY, AND WHY
 *   .word    the source's own word string. It is a DISPLAY string, not text: it
 *            glues the waqf mark onto the word ("...HU  <waqf>") and glues the
 *            ayah NUMBER onto the last word of an ayah ("...LEEMUN 181"). It also
 *            carries a real defect at 11:13 (a true alif where the mushaf has
 *            alif maqsura). We take none of it. Every letter the reader sees comes
 *            from quran-uthmani.json, which quran-guard.cjs holds frozen.
 *   .qpcV1   KFQPC font codepoints. The fonts have an EMPTY GSUB table, so a glyph
 *   .qpcV2   is a closed drawing with no text inside it -- epistemically a picture.
 *            And they are unlicensed. Not ours to ship.
 *   header   the source's surah name and number on header lines are BOTH off by
 *   labels   one for 18 of the 114 surahs (they name the surah that just ENDED,
 *            not the one the header announces), 5 headers are absent, and page 207
 *            carries a spurious one. We keep the header's POSITION -- which is
 *            correct -- and synthesise its name from SURAH_NAMES in index.html.
 *
 * SO: the asset is boundary facts. No scripture, no glyph, no name, no number.
 * layout-guard.cjs enforces exactly that, and refuses to pass if one Arabic
 * codepoint appears in the output.
 *
 * USAGE
 *   node tools/build-mushaf-layout.cjs            # fetch, build, verify, write
 *   node tools/build-mushaf-layout.cjs --cache p  # reuse pages already in ./p
 *
 * After a rebuild the shas CHANGE. Re-pin LAYOUT_SHA in layout-guard.cjs, then
 * run the guard. The guard is what certifies the artifact -- not this builder.
 * ==========================================================================*/

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAW = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf/page-';
const N_PAGES = 604;
const OUT = 'mushaf-layout.json';

const cacheArg = process.argv.indexOf('--cache');
const CACHE = cacheArg > -1 ? process.argv[cacheArg + 1] : '.mushaf-cache';

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
      const file = path.join(CACHE, 'page-' + num + '.json');
      if (fs.existsSync(file)) {
        got++;
        continue;
      }
      try {
        const r = await fetch(RAW + num + '.json');
        if (!r.ok) {
          failed.push(p + ' HTTP ' + r.status);
          continue;
        }
        const t = await r.text();
        JSON.parse(t); // must parse before it lands on disk
        fs.writeFileSync(file, t);
        got++;
      } catch (e) {
        failed.push(p + ' ' + String(e && e.message).slice(0, 40));
      }
      if (got % 100 === 0) process.stdout.write('  fetched ' + got + '/' + N_PAGES + '\r');
    }
  }
  await Promise.all(Array.from({ length: 24 }, worker));
  process.stdout.write('  fetched ' + got + '/' + N_PAGES + '   \n');
  if (failed.length) {
    console.log('FATAL  ' + failed.length + ' page(s) failed:');
    failed.slice(0, 10).forEach((f) => console.log('   ' + f));
    process.exit(1);
  }
}

function build() {
  const out = { pages: N_PAGES, words: 0, p: [] };
  for (let p = 1; p <= N_PAGES; p++) {
    const j = JSON.parse(
      fs.readFileSync(path.join(CACHE, 'page-' + String(p).padStart(3, '0') + '.json'), 'utf8')
    );
    if (j.page !== p) {
      console.log('FATAL  file page-' + p + ' declares page ' + j.page);
      process.exit(1);
    }
    const lines = [];
    for (const ln of j.lines) {
      const t = ln.type === 'surah-header' ? 'h' : ln.type === 'basmala' ? 'b' : 't';
      const o = { n: ln.line, t };
      if (t === 't') {
        o.w = ln.words.map((w) => w.location); // <-- the ONLY thing we take
        out.words += o.w.length;
      }
      lines.push(o);
    }
    out.p.push({ n: j.page, l: lines });
  }
  return out;
}

(async () => {
  console.log('build-mushaf-layout  --  emitting ' + OUT);
  await fetchPages();

  const out = build();
  const json = JSON.stringify(out);

  // Refuse to write scripture into an unguarded file. Non-negotiable.
  for (let i = 0; i < json.length; i++) {
    const cp = json.codePointAt(i);
    if ((cp >= 0x0600 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfeff)) {
      console.log(
        'FATAL  an Arabic codepoint (U+' +
          cp.toString(16).toUpperCase().padStart(4, '0') +
          ') reached the output. Refusing to write.'
      );
      process.exit(1);
    }
  }

  fs.writeFileSync(OUT, json);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex');
  const lines = out.p.reduce((a, x) => a + x.l.length, 0);

  console.log('');
  console.log('  bytes      ' + json.length);
  console.log('  pages      ' + out.pages);
  console.log('  lines      ' + lines);
  console.log('  word slots ' + out.words);
  console.log('  sha256     ' + sha);
  console.log('');
  console.log('NEXT: pin LAYOUT_SHA = ' + sha);
  console.log('      in layout-guard.cjs, then:  node layout-guard.cjs');
  console.log('      The GUARD certifies the artifact. This builder does not.');
})();
