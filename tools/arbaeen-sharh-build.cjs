#!/usr/bin/env node
/* ==========================================================================================
 * tools/arbaeen-sharh-build.cjs -- ITEM 89. THE FORTY-TWO OF alnawawiforty.com, WITH THEIR
 * EXPLANATION AND AUDIO, REPLACING THE FIFTY OF FC-001977.
 *
 * INPUT IS THE HARVEST FOLDER AND NOTHING ELSE. No network, no clock. It reads
 *   <harvest>/pages/index.html, <harvest>/pages/hadith-<n>.html   (raw, as the site served them)
 *   <harvest>/_PROBE.json   (fetched_at, and the audio host's answers)
 *   <harvest>/_PROOF.json   (the attribution measurement of the explanation)
 * and writes arbaeen.json and arbaeen-sharh.json at the repo root: UTF-8, no BOM, LF. A re-run
 * writes the same bytes.
 *
 * WHERE THE FOUR LAYERS LIVE. All four are in the served HTML; the page script only toggles
 * tabs (and fetches a search index nobody here reads). Each is a hidden tab panel:
 *   #panel-matn  > .matn   -> <p> paragraphs, then <span class="isnad">
 *   #panel-sharh > .prose  -> <p> paragraphs
 *   #panel-rawi  > .prose  -> <p> paragraphs
 *   #panel-media audio[src]
 * One paragraph per block child; the paragraph's text is its textContent with whitespace folded
 * the way a browser folds it on display ([ \t\n\r\f]+ -> one space, trimmed at the block edge).
 * HTML entities are decoded by the parser. Nothing else is touched: no diacritic, no punctuation,
 * no spelling. A paragraph whose ONLY content is U+200B (one, in hadith 20's narrator panel)
 * displays as an empty line and is dropped; the fidelity proof below accounts for it by name.
 *
 * THE FIDELITY PROOF, which fails the build. For every panel: the panel's own text with all
 * whitespace removed must EQUAL our paragraphs joined with all whitespace removed, except the
 * named dropped code points, counted. And no string may carry a tag, and none may be empty.
 *
 * THEN THE FIXES. The proof runs on the page as served; applyFixes() then cleans the named defects of the
 * source (see FIXES) and records each one as "cleanups" in arbaeen-sharh.json.
 *
 * Usage: node tools/arbaeen-sharh-build.cjs [--harvest C:/EZIK-LIB/harvest/alnawawiforty] [--check]
 *   --check  build in memory and compare to the files on disk; exit 1 on any difference.
 * ========================================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const HARVEST = argv.includes('--harvest') ? argv[argv.indexOf('--harvest') + 1] : 'C:/EZIK-LIB/harvest/alnawawiforty';
const COUNT = 42;
const SITE = 'https://alnawawiforty.com/';
const AUTHOR = 'النووي';   // as the FC-001977 file carried it; read from no file, so a re-run cannot drift
const DROPPABLE = ['\u200b'];   // a paragraph made only of these is an empty line, not text

const fold = (s) => String(s).replace(/[ \t\n\r\f]+/g, ' ').trim();
const squeeze = (s) => String(s).replace(/\s+/g, '');

function paragraphs(container) {
  const out = [];
  const dropped = [];
  for (const node of container.childNodes) {
    const t = fold(node.textContent || '');
    if (!t) continue;
    if (node.nodeType === 3) throw new Error('stray text outside a block: ' + JSON.stringify(t.slice(0, 20)));
    if ([...t].every((c) => DROPPABLE.includes(c))) { dropped.push(...t); continue; }
    out.push(t);
  }
  return { out, dropped };
}

function readPage(n) {
  const html = fs.readFileSync(path.join(HARVEST, 'pages', `hadith-${n}.html`), 'utf8');
  const { document } = parseHTML(html);
  const panel = (id) => {
    const p = document.getElementById(id);
    if (!p) throw new Error(`hadith-${n}: no #${id}`);
    return p;
  };
  const crumbs = [...document.querySelectorAll('nav.page-nav span')];
  const title = fold(crumbs[crumbs.length - 1].textContent);
  const topic = fold(document.querySelector('.hadith-head h1').textContent);
  const og = document.querySelector('meta[property="og:image"]').getAttribute('content');
  const yt = (og.match(/^https:\/\/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\/hqdefault\.jpg$/) || [])[1] || null;
  const audioEl = panel('panel-media').querySelector('audio');
  const audioUrl = audioEl ? audioEl.getAttribute('src') : null;
  const layers = {};
  const proof = {};
  for (const [key, id, sel] of [['matn', 'panel-matn', '.matn'], ['sharh', 'panel-sharh', '.prose'], ['rawi', 'panel-rawi', '.prose']]) {
    const p = panel(id);
    const kids = p.children;
    if (kids.length !== 1 || !kids[0].matches(sel)) throw new Error(`hadith-${n}: #${id} is not one ${sel}`);
    const { out, dropped } = paragraphs(kids[0]);
    layers[key] = out;
    // the proof: rendered panel text, whitespace removed == ours joined, whitespace removed,
    // after removing exactly the dropped code points, each counted.
    let rendered = squeeze(p.textContent);
    for (const c of dropped) {
      const i = rendered.indexOf(c);
      if (i < 0) throw new Error(`hadith-${n} ${key}: dropped U+${c.codePointAt(0).toString(16)} not in panel`);
      rendered = rendered.slice(0, i) + rendered.slice(i + 1);
    }
    const ours = squeeze(out.join(''));
    proof[key] = { equal: rendered === ours, chars: [...ours].length, dropped: dropped.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()) };
    if (rendered !== ours) throw new Error(`FIDELITY FAIL hadith-${n} ${key}`);
  }
  const brand = fold(document.querySelector('.brand .name > span').textContent);
  const foot = document.querySelector('.site-footer p a');
  return { n, title, topic, yt, audioUrl, layers, proof, brand, foot, document };
}

/* ------------------------------------------------------------------------------------------
 * FIXES -- the known transport and encoding defects of the SOURCE, cleaned here and nowhere else.
 * The archived pages are never touched; the fidelity proof above still runs on them as served.
 * Each entry names the hadith, the field (matn | sharh | rawi), the paragraph (0-based, in the
 * order the page gives them), the exact old string and the exact new string. The builder asserts
 * that the old string occurs EXACTLY ONCE in that paragraph and fails the build otherwise. new:
 * null removes the paragraph, and only when old is the whole paragraph. Every entry is written
 * into arbaeen-sharh.json as "cleanups" so a reader of the data can audit each change.
 * Only a transport or encoding defect belongs here: a stray latin letter, a broken entity, a
 * direction mark wrapped round a punctuation mark, a heading the reader already prints. No
 * wording is ever rewritten. (Strings are \u-escaped so the table survives any editor.)
 * ---------------------------------------------------------------------------------------- */
const FIXES = [
  { hadith: 12, field: 'matn', paragraph: 0, old: 'r ', new: '' },  // stray latin r at the head of the matn
  { hadith: 20, field: 'rawi', paragraph: 2, old: '\u0627\u0644\u0644\u0647r\u062e\u0645\u0633', new: '\u0627\u0644\u0644\u0647 \u062e\u0645\u0633' },  // stray latin r glued between two words
  { hadith: 22, field: 'rawi', paragraph: 2, old: '\u0627\u0644\u0644\u0647r\u060c', new: '\u0627\u0644\u0644\u0647\u060c' },  // stray latin r before the comma
  { hadith: 13, field: 'rawi', paragraph: 0, old: '& dash;', new: '- ' },  // broken dash entity; the pair of the opening " - " before the salawat
  { hadith: 20, field: 'rawi', paragraph: 6, old: '& dash;', new: '- ' },  // broken dash entity at the head of the paragraph
  { hadith: 42, field: 'rawi', paragraph: 0, old: '& dash;', new: '-' },  // broken dash entity; the pair of the opening " - " before the salawat
  { hadith: 30, field: 'rawi', paragraph: 0, old: '\u064a\u0644\u200f:\u200f \u062c', new: '\u064a\u0644: \u062c' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 0, old: '\u060c \u0648\u0642\u064a\u0644\u200f:\u200f \u0627\u0628\u0646 \u0646', new: '\u060c \u0648\u0642\u064a\u0644: \u0627\u0628\u0646 \u0646' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 0, old: '\u060c \u0648\u0642\u064a\u0644\u200f:\u200f \u0627\u0628\u0646 \u0644', new: '\u060c \u0648\u0642\u064a\u0644: \u0627\u0628\u0646 \u0644' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 0, old: '\u060c \u0648\u0642\u064a\u0644\u200f:\u200f \u0627\u0628\u0646 \u0639', new: '\u060c \u0648\u0642\u064a\u0644: \u0627\u0628\u0646 \u0639' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 0, old: '\u0629\u200f.\u200f', new: '\u0629.' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 1, old: '\u064a\u0644\u200f:\u200f \u0645', new: '\u064a\u0644: \u0645' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 30, field: 'rawi', paragraph: 1, old: '\u064a\u0644\u200f:\u200f \u062a', new: '\u064a\u0644: \u062a' },  // RLM-wrapped mark; the RLMs removed, the mark and the words kept
  { hadith: 12, field: 'sharh', paragraph: 0, old: '\u0627\u0644\u0634\u0631\u062d', new: null },  // heading-only first paragraph; the reader already prints this heading
];

function applyFixes(pages, table = FIXES) {
  const byN = new Map(pages.map((p) => [p.n, p]));
  const cleanups = [];
  const removals = [];
  for (const fx of table) {
    const page = byN.get(fx.hadith);
    const layer = page && page.layers[fx.field];
    if (!layer || typeof layer[fx.paragraph] !== 'string') throw new Error(`FIX: no paragraph ${fx.hadith}/${fx.field}/${fx.paragraph}`);
    const cur = layer[fx.paragraph];
    const count = cur.split(fx.old).length - 1;
    if (!fx.old || count !== 1) throw new Error(`FIX: old string occurs ${count} times (need exactly 1) in ${fx.hadith}/${fx.field}/${fx.paragraph}: ${JSON.stringify(fx.old)}`);
    if (fx.new === null) {
      if (cur !== fx.old) throw new Error(`FIX: a removal must name the whole paragraph ${fx.hadith}/${fx.field}/${fx.paragraph}`);
      removals.push(fx);
    } else {
      layer[fx.paragraph] = cur.replace(fx.old, () => fx.new);
    }
    cleanups.push({ hadith: fx.hadith, field: fx.field, paragraph: fx.paragraph, old: fx.old, new: fx.new });
  }
  for (const fx of removals) byN.get(fx.hadith).layers[fx.field][fx.paragraph] = null;
  for (const p of pages) for (const k of ['matn', 'sharh', 'rawi']) p.layers[k] = p.layers[k].filter((t) => t !== null);
  return cleanups;
}

function readIndex() {
  const { document } = parseHTML(fs.readFileSync(path.join(HARVEST, 'pages', 'index.html'), 'utf8'));
  const h1 = fold(document.querySelector('h1').textContent);
  const links = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /hadith-\d+\.html$/.test(h)).map((h) => +h.match(/hadith-(\d+)/)[1]))];
  return { h1, links };
}

function auditStrings(obj, where) {
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (!v.trim()) throw new Error(`empty string at ${where}${p}`);
      if (/<\/?[a-z][^>]*>/i.test(v)) throw new Error(`tag at ${where}${p}`);
      return;
    }
    if (Array.isArray(v)) { if (!v.length) throw new Error(`empty array at ${where}${p}`); v.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
  };
  walk(obj, '');
}

function build() {
  const probe = JSON.parse(fs.readFileSync(path.join(HARVEST, '_PROBE.json'), 'utf8'));
  const proofFile = JSON.parse(fs.readFileSync(path.join(HARVEST, '_PROOF.json'), 'utf8'));
  const index = readIndex();
  if (index.links.length !== COUNT) throw new Error(`index lists ${index.links.length} pages, expected ${COUNT}`);

  const pages = [];
  for (let n = 1; n <= COUNT; n++) pages.push(readPage(n));

  const cleanups = applyFixes(pages);

  const credit = pages[0].foot;
  const creditP = fold(credit.parentNode.textContent);
  const creditText = fold(creditP.slice(creditP.indexOf('·') + 1));
  const audio_credit = { text: creditText, url: credit.getAttribute('href') };
  for (const p of pages) {
    const f = p.foot;
    if (f.getAttribute('href') !== audio_credit.url || fold(f.parentNode.textContent) !== creditP) throw new Error(`hadith-${p.n}: footer credit differs`);
  }

  const main = {
    book_id: 'alnawawiforty.com',
    book_title: index.h1,
    author: AUTHOR,
    publisher: null,
    edition: null,
    source: 'alnawawiforty.com',
    source_url: SITE,
    fetched_at: probe.fetched_at,
    count: COUNT,
    hadith: pages.map((p) => ({
      n: p.n,
      title: p.title,
      topic: p.topic,
      text: p.layers.matn.join('\n'),
      source_url: `${SITE}hadith-${p.n}.html`,
      page_citable: false,
    })),
  };

  const items = {};
  for (const p of pages) {
    const pr = probe.audio[String(p.n)];
    const attr = proofFile.attribution.per_hadith[String(p.n)];
    let audio = null;
    let audio_reason = null;
    if (!p.audioUrl) audio_reason = 'no_audio_on_page';
    else if (!pr || !pr.downloaded) audio_reason = 'download_failed';
    else if (!pr.range_ezik || pr.range_ezik.status !== 206) audio_reason = 'no_206_with_ezik_referer';
    else if (!/^https:\/\//.test(p.audioUrl)) audio_reason = 'not_https';
    else audio = { url: p.audioUrl, type: pr.file.type, bytes: pr.file.bytes, sha256: pr.file.sha256 };
    const cover = attr ? attr.cover : null;
    const item = {
      sharh: p.layers.sharh,
      rawi: p.layers.rawi,
      audio,
      youtube: p.yt,
      source_url: `${SITE}hadith-${p.n}.html`,
      sharh_by: cover !== null && cover >= 0.80 ? 'محمد بن صالح العثيمين' : null,
      sharh_cover: cover,
    };
    if (!audio) item.audio_reason = audio_reason;
    items[String(p.n)] = item;
  }
  const sharh = { source: 'alnawawiforty.com', source_url: SITE, fetched_at: probe.fetched_at, audio_credit, items, cleanups };

  auditStrings(main, 'arbaeen');
  auditStrings({ ...sharh, cleanups: undefined }, 'arbaeen-sharh');   // cleanups carry '' and null by design (a deletion)

  const proofs = pages.map((p) => ({ n: p.n, ...p.proof }));
  return { main, sharh, proofs, pages, index };
}

const ser = (o) => JSON.stringify(o, null, 2) + '\n';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

if (require.main === module) {
  const { main, sharh, proofs } = build();
  const outs = [['arbaeen.json', ser(main)], ['arbaeen-sharh.json', ser(sharh)]];
  const fails = proofs.filter((p) => !(p.matn.equal && p.sharh.equal && p.rawi.equal));
  const dropped = proofs.flatMap((p) => ['matn', 'sharh', 'rawi'].flatMap((k) => p[k].dropped.map((c) => `${p.n}:${k}:${c}`)));
  console.log(`FIDELITY panels=${proofs.length * 3} equal=${proofs.length * 3 - fails.length} dropped=${dropped.length} [${dropped.join(' ')}]`);
  if (fails.length) process.exit(1);
  let diff = 0;
  for (const [name, body] of outs) {
    const file = path.join(ROOT, name);
    const buf = Buffer.from(body, 'utf8');
    if (argv.includes('--check')) {
      const same = fs.existsSync(file) && fs.readFileSync(file).equals(buf);
      if (!same) diff++;
      console.log(`${same ? 'SAME' : 'DIFF'} ${name} ${buf.length} ${sha(buf)}`);
    } else {
      fs.writeFileSync(file, buf);
      console.log(`WROTE ${name} ${buf.length} ${sha(buf)}`);
    }
  }
  process.exit(diff ? 1 : 0);
}

module.exports = { build, readPage, readIndex, fold, COUNT, FIXES, applyFixes };
