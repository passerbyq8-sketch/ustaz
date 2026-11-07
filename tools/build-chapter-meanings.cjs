// tools/build-chapter-meanings.cjs -- ITEM O-2 (brain35, 2026-11-06; DIAG ZINA; the owner's answer: yes)
//
// Builds lib/data/chapter-meanings.json: for a question that asks for the hadiths of a CHAPTER («أحاديث في باب الزينة»),
// the senses that chapter is actually written under, so each one is searched and answered on its own.
//
// MEASURED (Q34-Q36): «أبي منك تعطيني كل الأحاديث الصحاح في باب الزينة» went to the library as ONE query, and «الزينة»
// is not a chapter the stores hold under that name at all (the Kuwaiti encyclopedia has «تَزَيُّنٌ», «لِبَاسُ الْمَرْأَةِ»,
// «فِطْرَة», «تَطَيُّبٌ» ...), so the turn answered on whatever the one query brought.
//
// WHERE THE SENSES COME FROM. The store (lib/data/fiqh-search.json.gz, 3,045 articles) holds each article as one
// flattened folded string with no newlines: its sub-sections survive only as «<heading>: N -» inside that text
// (measured: 1,762 articles carry three or more). This builder recovers those headings, drops the structural ones the
// encyclopedia gives every article (التعريف, الالفاظ ذات الصله, الحكم الاجمالي, مواطن البحث, الحكم التكليفي), drops the
// echo of the article's own name, and keeps the first six topical ones as that chapter's meanings.
//
// The owner's own seed is written FIRST and is never overwritten by the store: «الزينة» is not an article, and its six
// senses are the owner's (source: owner).
//
// ITEM 35-D2 R9 (brain35-2 F3, 2026-11-07): ALIASES. MEASURED: «… في باب السواك» (P24) found no chapter, because the article is
// «اسْتِيَاك» (key «استياك») and «اللباس» missed «أَلْبِسَةٌ» (key «البسه») the same way: the reader types the plain noun, the key
// is the article's own term. The file now carries "aliases" (folded form -> key), written from the article's own words:
//   (a) the definition head of a plural title names its singular («الألبسة: جمع لباس» -> لباس);
//   (b) the definition head says «ولفظ الX …» («ولفظ السواك يطلق …» -> سواك);
//   (c) a single-word related term («الألفاظ ذات الصلة») the article calls a synonym (مرادف) («المسامتة … مرادفة للاستقبال»);
//   plus ALIAS_SEED, the owner's hand-written block, written first and never overwritten by the store.
// MEASURED and REJECTED (BRAIN35-FIX2-evidence/F3-rules-probe.out.txt): the bare form of a «ت…» title found as a word of the
// definition (24 pairs, «علي -> تعلي», «قوم -> تقوم») and multi-word synonyms (fragments) -- both wrong more often than right.
// An alias never shadows a key (the key wins in the reader; such a pair is dropped here), and a form claimed by two articles
// keeps the first. The structural filter (meaningsOf) also drops a heading opening on «حكمه» / «حكمها» (the store's «الحكم
// التكليفي» welded to the next words, or a «حكمة» the reader cannot search as a chapter sense), on «حكم / الحكم» + a structural
// word, and a heading that is the article's own name with or without the article.
//
// OFFLINE. No network, no model. Run: node tools/build-chapter-meanings.cjs [--check]
//   --check  writes nothing; exits 1 when the file on disk is not what this builder would write.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = path.resolve(__dirname, '..');
const STORE = path.join(REPO, 'lib', 'data', 'fiqh-search.json.gz');
const OUT = path.join(REPO, 'lib', 'data', 'chapter-meanings.json');
const MEANINGS_MAX = 6;
const SUBSECTIONS_MIN = 3;

// the folding the question is read with (lib/arabic.js normalizeArabic, as much of it as a chapter key needs)
const fold = (value) => String(value || '')
  .replace(/[ً-ْٰـ]/gu, '')
  .replace(/[آأإ]/gu, 'ا')
  .replace(/ى/gu, 'ي')
  .replace(/ة/gu, 'ه')
  .replace(/\s+/gu, ' ')
  .trim();

// a sub-section heading, as the flattened article keeps it: the words before «: N -»
const HEADING_RE = /([ء-ي][ء-يـ ]{2,38}?)\s*:\s*(\d{1,3})\s*-/gu;
// the headings the encyclopedia gives EVERY article: they are its shape, not a sense of the chapter
const STRUCTURAL = new Set([
  'التعريف', 'الالفاظ ذات الصله', 'الحكم الاجمالي', 'مواطن البحث', 'الحكم الاجمالي ومواطن البحث',
  'الحكم التكليفي', 'التعريف الالفاظ ذات الصله', 'الالفاظ ذات الصله التعريف', 'ما يتعلق بالموضوع من احكام',
].map(fold));
// a heading that opens on one of these opens in the middle of a sentence
const PARTICLES = new Set(['في', 'من', 'علي', 'الي', 'ثم', 'او', 'عند', 'بعد', 'قبل', 'مع', 'بين', 'عن', 'الا', 'لا', 'ان'].map(fold));

// THE OWNER'S SEED (source: owner). Written first, never overwritten by the store.
const SEED = {
  'الزينة': ['اللباس', 'الترجل والشعر', 'خصال الفطرة', 'الخاتم والطيب', 'زينة المرأة', 'الذهب والحرير'],
};
// THE OWNER'S ALIASES (source: owner): the plain noun a reader types -> the article's key. Written first, never overwritten.
const ALIAS_SEED = {
  'سواك': 'استياك', 'السواك': 'استياك',
  'لباس': 'البسه', 'اللباس': 'البسه', 'ثياب': 'البسه', 'الثياب': 'البسه',
  'طيب': 'تطيب',
};
// the words «جمع X» names when X is not the singular itself («جمع مفرده كذا»)
const NOT_A_SINGULAR = new Set(['مفرده', 'مفردها', 'مفرد', 'واحده', 'واحدها', 'واحد'].map(fold));
// a heading opening on one of these is the store's «الحكم التكليفي» welded to the next words, or a wisdom, not a sense
const RULING_HEAD = new Set(['حكمه', 'حكمها'].map(fold));
const RULING_WORD = new Set(['حكم', 'الحكم'].map(fold));
const STRUCTURAL_WORD = new Set(['التكليفي', 'الاجمالي', 'الشرعي'].map(fold));

function meaningsOf(record) {
  const text = String((record && (record.search || record.snippet || record.text)) || '');
  const term = fold(record && record.term);
  if (!text || !term) return [];
  const seen = new Set();
  const out = [];
  for (const match of text.matchAll(HEADING_RE)) {
    let head = fold(match[1]);
    // the flattened article opens on its own name twice, welded to the first heading
    while (head.startsWith(term + ' ')) head = head.slice(term.length + 1).trim();
    if (!head || head === term || head.length < 4) continue;
    if (STRUCTURAL.has(head)) continue;
    // ITEM 35-D2 R9 (brain35-2 F3): the article's own name with or without the article, a «حكمه …» head, «حكم + التكليفي …»
    if (head === 'ال' + term || 'ال' + head === term) continue;
    {
      const w = head.split(' ');
      if (RULING_HEAD.has(w[0])) continue;
      if (RULING_WORD.has(w[0]) && w.length > 1 && STRUCTURAL_WORD.has(w[1])) continue;
    }
    // MEASURED: the flattened article also yields FRAGMENTS of a heading -- «والتحلي», «في الاحداد», «وبعده» -- because the
    // text keeps no newline to open it. A sense begins with its own noun: a leading particle, or a single word welded to a
    // conjunction, is a piece of the sentence before it, not a sense of the chapter.
    const words = head.split(' ');
    if (PARTICLES.has(words[0])) continue;
    if (words.length === 1 && /^[وف]/u.test(head)) continue;
    if (seen.has(head)) continue;
    seen.add(head);
    out.push(head);
  }
  return out;
}

// ITEM 35-D2 R9 (brain35-2 F3): the plain forms an article's own words give for its key (see the header: rules a, b, c).
function aliasesOf(record) {
  const key = fold(record && record.term);
  const text = String((record && (record.search || record.snippet || record.text)) || '');
  if (!key || !text) return [];
  const out = [];
  const bare = (w) => { const x = fold(w).replace(/[،.:؛)(]+$/gu, '').replace(/^[وف]/u, ''); return x.replace(/^ال(?=\S{3,})/u, ''); };
  const at = text.indexOf('التعريف');
  const head = at >= 0 ? text.slice(at, at + 400) : text.slice(0, 400);
  // (a) a plural title: «ال<key>: جمع X»
  const plural = /(?:^|\s)(?:ال)?(\S+)\s*:\s*جمع\s+(\S+)/u.exec(head);
  if (plural && fold(plural[1]).replace(/^ال/u, '') === key.replace(/^ال/u, '')) {
    const x = bare(plural[2]);
    if (x.length >= 3 && !NOT_A_SINGULAR.has(x)) out.push(x);
  }
  // (b) «ولفظ الX»
  const lafz = /ولفظ\s+ال(\S+)/u.exec(head);
  if (lafz) { const x = bare(lafz[1]); if (x.length >= 3) out.push(x); }
  // (c) a single-word related term the article calls a synonym
  const rel = text.indexOf('الالفاظ ذات الصله');
  if (rel >= 0) {
    const section = text.slice(rel, rel + 1200);
    for (const m of section.matchAll(/(?:^|\s)(?:[ابجد]\s*-\s*)?(?:ال)?([ء-ي]+)\s*:\s*\d{1,3}\s*-\s*([^.]{0,200})/gu)) {
      const x = bare(m[1]);
      if (x.length >= 3 && /مرادف|مترادف|بمعني واحد/u.test(m[2])) out.push(x);
    }
  }
  return out.filter((x) => x !== key);
}

function build() {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(STORE)).toString('utf8'));
  const chapters = {};
  for (const [chapter, meanings] of Object.entries(SEED)) {
    chapters[fold(chapter)] = { source: 'owner', written: chapter, meanings: meanings.slice(0, MEANINGS_MAX) };
  }
  let added = 0;
  for (const record of Array.isArray(rows) ? rows : []) {
    const key = fold(record && record.term);
    if (!key || chapters[key]) continue;
    const meanings = meaningsOf(record);
    if (meanings.length < SUBSECTIONS_MIN) continue;
    chapters[key] = { source: 'encyclopedia', written: String(record.term || '').trim(), meanings: meanings.slice(0, MEANINGS_MAX) };
    added += 1;
  }
  // ITEM 35-D2 R9 (brain35-2 F3): the aliases -- the owner's first, then the store's; never a key, never a second claim
  const aliases = {};
  let aliasesOwner = 0;
  let aliasesStore = 0;
  let aliasesShadowed = 0;
  for (const [form, key] of Object.entries(ALIAS_SEED)) {
    const f = fold(form);
    if (!chapters[key]) throw new Error('ALIAS_SEED points at an unknown chapter: ' + key);
    if (chapters[f]) { aliasesShadowed += 1; continue; }
    aliases[f] = key;
    aliasesOwner += 1;
  }
  for (const record of Array.isArray(rows) ? rows : []) {
    const key = fold(record && record.term);
    if (!key || !chapters[key]) continue;
    for (const form of aliasesOf(record)) {
      if (chapters[form]) { aliasesShadowed += 1; continue; }
      if (aliases[form]) continue;
      aliases[form] = key;
      aliasesStore += 1;
    }
  }
  const aliasesSorted = Object.fromEntries(Object.keys(aliases).sort().map((k) => [k, aliases[k]]));
  return {
    schema: 'ezik.chapter-meanings.v1',
    built: 'tools/build-chapter-meanings.cjs',
    // the rule, written where the data is, so the next reader need not measure the store again
    rule: 'A chapter is an article of the Kuwaiti encyclopedia; its meanings are the first six topical sub-sections the stored article keeps («<heading>: N -»), with the structural headings and the article\'s own name dropped. Keys are folded (normalizeArabic). source=owner entries are written by hand and are never overwritten.',
    counts: { chapters: Object.keys(chapters).length, owner: Object.keys(SEED).length, encyclopedia: added,
      aliases: Object.keys(aliasesSorted).length, aliasesOwner, aliasesStore, aliasesShadowed },
    aliasRule: 'An alias is a folded form the reader may type for a chapter whose key is the article\'s own term: the owner\'s block first (never overwritten), then from each article\'s definition head (a plural title\'s singular «جمع X», «ولفظ الX») and its related-terms head (a single-word term the article calls مرادف). An alias never shadows a key; the reader tries the key forms, then the aliases.',
    aliases: aliasesSorted,
    chapters,
  };
}

const built = build();
const text = JSON.stringify(built, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have === text) { console.log('chapter-meanings: up to date (' + built.counts.chapters + ' chapters)'); process.exit(0); }
  console.error('chapter-meanings: lib/data/chapter-meanings.json is NOT what this builder writes');
  process.exit(1);
}
fs.writeFileSync(OUT, text);
console.log('chapter-meanings: wrote ' + built.counts.chapters + ' chapters ('
  + built.counts.owner + ' owner, ' + built.counts.encyclopedia + ' from the encyclopedia store), ' + text.length + ' bytes');
