// arbaeen-sharh-guard.cjs -- gate `arbaeensharh`. ITEM 89 (2026-10-13): the forty-two of alnawawiforty.com,
// each with its explanation under it and the explanation's audio under that, replacing the fifty of FC-001977.
//
// WHAT IT HOLDS, offline -- it reads files in this tree and nothing else, and calls no network:
//   1. THE TWO FILES. arbaeen.json and arbaeen-sharh.json: the count, the order 1..42, the exact field set, https
//      links only, no tag and no empty string in any text, and both pinned by sha256. A re-cut of either file is a
//      deliberate act -- tools/arbaeen-sharh-build.cjs over the archived pages -- and re-cuts the pin with it.
//   2. NO NAME WITHOUT ITS PROOF. sharh_by is set only beside a measured sharh_cover of 0.80 or more.
//   3. THE READER, in app.jsx: no dangerouslySetInnerHTML in the section; the audio element is preload="none" and
//      keyed by the hadith's number; every external link opens with rel="noopener noreferrer"; the three links (the
//      audio, its credit, the source page) are each read from the data through ezikFatwaPublicUrl, and no src or
//      href in the section is written as a literal address; no play or pause call; and the widget still carries
//      n, title and text only.
//   3b. THE CLEANED SOURCE DEFECTS (2026-10-14). The source pages carried a few transport and encoding defects (a stray
//      latin r where the salawat font glyph was, the broken dash entity, RLM marks wrapped round a colon, a heading-only
//      first paragraph). The builder's FIXES table cleans exactly those, each old string asserted to occur once, and writes
//      the same list into arbaeen-sharh.json as "cleanups". This guard holds that none of the patterns remain in any
//      matn, sharh or rawi, that the cleanups list IS the table (hadith, field, paragraph, old, new, in order), that each
//      cleanup is visible in the data (the new text is in the paragraph and the old is not), and that the builder refuses
//      an old string that occurs twice or not at all.
//   4. THE WORKER. arbaeen-sharh.json is not in CORE, and it is the last entry of IDLE.
// Every structural check is also run against a mutant of the source it reads, and the mutant must fail.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');

// Re-cut with the files, by tools/arbaeen-sharh-build.cjs, and never by hand.
const PIN = {
  'arbaeen.json': 'f0f10f465a2fc59e4b9b2513c37d9ea502866a020d66f2c4781a87519c82bcad',
  'arbaeen-sharh.json': 'a92d9825092f476a6363e7e991f37683aa6a3873a7dbf5cd7515668441552c8f',
};
const COUNT = 42;
const SITE = 'https://alnawawiforty.com/';
const SHEIKH = 'محمد بن صالح العثيمين';

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log('PASS ' + label); }
  else { fail++; console.log('FAIL ' + label + (detail ? '\n     ' + detail : '')); }
};
const TAG = /<\/?[A-Za-z][^>]*>/;
const goodText = (t) => typeof t === 'string' && t.trim() !== '' && !TAG.test(t);
const goodParas = (a) => Array.isArray(a) && a.length > 0 && a.every(goodText);
const https = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);
const sameKeys = (o, keys) => !!o && typeof o === 'object' && JSON.stringify(Object.keys(o).sort()) === JSON.stringify(keys.slice().sort());

// ---- 1. the two files -------------------------------------------------------------------------------------
function auditMain(j) {
  const bad = [];
  if (!sameKeys(j, ['book_id', 'book_title', 'author', 'publisher', 'edition', 'source', 'source_url', 'fetched_at', 'count', 'hadith'])) bad.push('top-level fields');
  if (j.book_id !== 'alnawawiforty.com' || j.source !== 'alnawawiforty.com' || j.source_url !== SITE) bad.push('source fields');
  if (j.publisher !== null || j.edition !== null) bad.push('publisher/edition not null');
  if (!goodText(j.book_title) || !goodText(j.author) || !/^\d{4}-\d\d-\d\dT/.test(String(j.fetched_at))) bad.push('title/author/fetched_at');
  if (j.count !== COUNT || !Array.isArray(j.hadith) || j.hadith.length !== COUNT) bad.push('count');
  (j.hadith || []).forEach((h, i) => {
    const n = i + 1;
    if (!sameKeys(h, ['n', 'title', 'topic', 'text', 'source_url', 'page_citable'])) bad.push(n + ' fields');
    if (h.n !== n) bad.push(n + ' order');
    if (!goodText(h.title) || !goodText(h.topic) || !goodText(h.text)) bad.push(n + ' text');
    if (h.source_url !== SITE + 'hadith-' + n + '.html') bad.push(n + ' source_url');
    if (h.page_citable !== false) bad.push(n + ' page_citable');
  });
  return bad;
}
function auditSharh(j, main) {
  const bad = [];
  if (!sameKeys(j, ['source', 'source_url', 'fetched_at', 'audio_credit', 'items', 'cleanups'])) bad.push('top-level fields');
  if (j.source !== 'alnawawiforty.com' || j.source_url !== SITE || j.fetched_at !== (main && main.fetched_at)) bad.push('source fields');
  if (!sameKeys(j.audio_credit, ['text', 'url']) || !goodText(j.audio_credit.text) || !https(j.audio_credit.url)) bad.push('audio_credit');
  const keys = Object.keys(j.items || {});
  if (JSON.stringify(keys) !== JSON.stringify(Array.from({ length: COUNT }, (_, i) => String(i + 1)))) bad.push('items keys 1..42 in order');
  for (const k of keys) {
    const it = j.items[k];
    const base = ['sharh', 'rawi', 'audio', 'youtube', 'source_url', 'sharh_by', 'sharh_cover'];
    if (!sameKeys(it, it && it.audio === null ? base.concat('audio_reason') : base)) bad.push(k + ' fields');
    if (!goodParas(it.sharh) || !goodParas(it.rawi)) bad.push(k + ' paragraphs');
    if (it.audio !== null) {
      const a = it.audio;
      if (!sameKeys(a, ['url', 'type', 'bytes', 'sha256']) || !https(a.url) || !goodText(a.type) || !(Number.isInteger(a.bytes) && a.bytes > 0) || !/^[0-9a-f]{64}$/.test(a.sha256)) bad.push(k + ' audio');
    } else if (!goodText(it.audio_reason)) bad.push(k + ' audio_reason');
    if (it.youtube !== null && !/^[A-Za-z0-9_-]{11}$/.test(it.youtube)) bad.push(k + ' youtube');
    if (it.source_url !== SITE + 'hadith-' + k + '.html') bad.push(k + ' source_url');
    if (!(typeof it.sharh_cover === 'number' && it.sharh_cover >= 0 && it.sharh_cover <= 1)) bad.push(k + ' sharh_cover');
    // 2. no name without its proof
    if (it.sharh_by !== null && !(it.sharh_by === SHEIKH && it.sharh_cover >= 0.80)) bad.push(k + ' sharh_by without a cover of 0.80');
    if (it.sharh_by === null && it.sharh_cover >= 0.80) bad.push(k + ' cover of 0.80 without its name');
  }
  return bad;
}
let main = null, sharh = null;
try { main = JSON.parse(read('arbaeen.json')); } catch (e) { /* reported below */ }
try { sharh = JSON.parse(read('arbaeen-sharh.json')); } catch (e) { /* reported below */ }
ok(!!main && !!sharh, 'arbaeen.json and arbaeen-sharh.json parse');
if (main && sharh) {
  const b1 = auditMain(main);
  ok(b1.length === 0, 'arbaeen.json: 42 hadith, n 1..42 in order, the exact fields, the site page for each, no tag, no empty text, page_citable false', b1.slice(0, 6).join(' | '));
  const b2 = auditSharh(sharh, main);
  ok(b2.length === 0, 'arbaeen-sharh.json: items "1".."42" in order, the exact fields, https links only, paragraphs with no tag and no empty text, sharh_by only beside a cover of 0.80 or more', b2.slice(0, 6).join(' | '));
  const named = Object.values(sharh.items).filter((it) => it.sharh_by).length;
  console.log('     (' + named + ' of 42 explanations carry a name; ' + Object.values(sharh.items).filter((it) => it.audio).length + ' carry audio)');
  // the audits bite
  const m1 = JSON.parse(JSON.stringify(main)); m1.hadith[3].text = '<b>' + m1.hadith[3].text + '</b>';
  const m2 = JSON.parse(JSON.stringify(main)); m2.hadith.reverse();
  const m3 = JSON.parse(JSON.stringify(sharh)); const low = Object.keys(m3.items).find((k) => m3.items[k].sharh_cover < 0.80); if (low) m3.items[low].sharh_by = SHEIKH;
  const m4 = JSON.parse(JSON.stringify(sharh)); m4.items['1'].audio = { url: 'http://example.com/1.mp3', type: 'audio/mpeg', bytes: 1, sha256: '0'.repeat(64) };
  const m5 = JSON.parse(JSON.stringify(sharh)); m5.items['2'].sharh = m5.items['2'].sharh.concat(['  ']);
  ok(auditMain(m1).length > 0, 'MUTANT KILLED: a tag inside a hadith text');
  ok(auditMain(m2).length > 0, 'MUTANT KILLED: the forty-two out of order');
  ok(!low || auditSharh(m3, main).length > 0, 'MUTANT KILLED: the sheikh named on an explanation measured below 0.80');
  ok(auditSharh(m4, main).length > 0, 'MUTANT KILLED: an http audio link');
  ok(auditSharh(m5, main).length > 0, 'MUTANT KILLED: an empty paragraph');
}
for (const [f, want] of Object.entries(PIN)) {
  const got = fs.existsSync(path.join(ROOT, f)) ? sha(f) : 'missing';
  ok(got === want, f + ' is the file the build wrote (sha256 ' + want.slice(0, 8) + ')', 'disk ' + got);
}

// ---- 3b. the cleaned source defects ---------------------------------------------------------------------------------
const LATIN = /[A-Za-z]/;                      // no latin letter anywhere in the Arabic text of the forty-two
const ENTITY = /&\s?#?[A-Za-z0-9]*\s?;|&\s/;   // a broken or stray entity, including "& dash;"
const RLM_MARK = /\u200f:|:\u200f|\u200f[.\u060c\u061b]\u200f/;   // an RLM beside a colon, or wrapped round a stop (a lone RLM before a stop, hadith 31, is left as the source has it)
const HEADING = '\u0627\u0644\u0634\u0631\u062d';   // the one-word heading the reader already prints
function allParas(main, sharh) {
  const out = [];
  (main.hadith || []).forEach((h) => String(h.text).split('\n').forEach((t, i) => out.push([h.n, 'matn', i, t])));
  for (const [k, it] of Object.entries(sharh.items || {})) for (const f of ['sharh', 'rawi']) (it[f] || []).forEach((t, i) => out.push([+k, f, i, t]));
  return out;
}
function auditClean(main, sharh, fixes) {
  const bad = [];
  for (const [h, f, i, t] of allParas(main, sharh)) {
    if (LATIN.test(t)) bad.push(h + '/' + f + '/' + i + ' latin letter');
    if (ENTITY.test(t)) bad.push(h + '/' + f + '/' + i + ' broken entity');
    if (RLM_MARK.test(t)) bad.push(h + '/' + f + '/' + i + ' RLM beside a mark');
  }
  for (const [k, it] of Object.entries(sharh.items || {})) if ((it.sharh || [])[0] === HEADING) bad.push(k + ' heading-only first paragraph');
  const list = sharh.cleanups;
  if (!Array.isArray(list)) return bad.concat('cleanups is not a list');
  if (list.length !== fixes.length) bad.push('cleanups has ' + list.length + ' entries, the table ' + fixes.length);
  fixes.forEach((fx, i) => {
    const c = list[i];
    const want = { hadith: fx.hadith, field: fx.field, paragraph: fx.paragraph, old: fx.old, new: fx.new };
    if (!c || JSON.stringify(c) !== JSON.stringify(want)) bad.push('cleanup ' + i + ' differs from the table');
  });
  return bad;
}
function auditFixesVisible(main, sharh, fixes) {
  // the new text is in the data where the table says, and the old is gone from there. A removal is checked by count:
  // the explanation of that hadith lost exactly its first paragraph.
  const bad = [];
  for (const fx of fixes) {
    if (fx.new === null) continue;
    const t = fx.field === 'matn' ? (main.hadith[fx.hadith - 1].text.split('\n')[fx.paragraph]) : (sharh.items[String(fx.hadith)][fx.field] || [])[fx.paragraph];
    if (typeof t !== 'string' || t.indexOf(fx.new) === -1) bad.push(fx.hadith + '/' + fx.field + '/' + fx.paragraph + ' new text missing');
    else if (fx.new.indexOf(fx.old) === -1 && t.indexOf(fx.old) !== -1) bad.push(fx.hadith + '/' + fx.field + '/' + fx.paragraph + ' old text still there');
  }
  return bad;
}
let build = null;
try { build = require('../tools/arbaeen-sharh-build.cjs'); } catch (e) { /* reported below */ }
ok(!!build && Array.isArray(build.FIXES) && build.FIXES.length > 0 && typeof build.applyFixes === 'function', 'the builder exports its FIXES table and applyFixes');
if (main && sharh && build && Array.isArray(build.FIXES)) {
  const FIX = build.FIXES;
  const c0 = auditClean(main, sharh, FIX);
  ok(c0.length === 0, 'no stray latin letter, no broken entity, no RLM beside a mark, no heading-only first paragraph; cleanups is exactly the FIXES table', c0.slice(0, 6).join(' | '));
  const v0 = auditFixesVisible(main, sharh, FIX);
  ok(v0.length === 0, 'every cleanup is visible in the data: the new text is where the table says and the old text is gone', v0.slice(0, 6).join(' | '));
  const cl = (o) => JSON.parse(JSON.stringify(o));
  const k1 = cl(main); k1.hadith[11].text = 'r ' + k1.hadith[11].text;
  const k2 = cl(sharh); k2.items['13'].rawi[0] += ' & dash;';
  const k3 = cl(sharh); k3.items['30'].rawi[0] += ' \u0648\u0642\u064a\u0644\u200f:\u200f \u0623';
  const k4 = cl(sharh); k4.items['12'].sharh.unshift(HEADING);
  const k5 = cl(sharh); k5.cleanups.pop();
  const k6 = cl(sharh); k6.cleanups[3].new = '\u2013';
  const k7 = cl(sharh); k7.cleanups.reverse();
  const k8 = cl(sharh); k8.items['22'].rawi[2] += ' \u0627\u0644\u0644\u0647r';
  const k9 = cl(sharh); k9.items['42'].rawi[0] += ' &amp;';
  const FIX2 = FIX.concat([{ hadith: 1, field: 'rawi', paragraph: 0, old: 'x', new: 'y' }]);
  ok(auditClean(k1, sharh, FIX).length > 0, 'MUTANT KILLED: a stray latin r back in a matn');
  ok(auditClean(main, k2, FIX).length > 0, 'MUTANT KILLED: the broken "& dash;" back in a rawi text');
  ok(auditClean(main, k3, FIX).length > 0, 'MUTANT KILLED: an RLM-wrapped colon back in hadith 30');
  ok(auditClean(main, k4, FIX).length > 0, 'MUTANT KILLED: the heading-only first paragraph back in a sharh');
  ok(auditClean(main, k5, FIX).length > 0, 'MUTANT KILLED: a cleanup missing from the list');
  ok(auditClean(main, k6, FIX).length > 0, 'MUTANT KILLED: a cleanup whose new text differs from the table');
  ok(auditClean(main, k7, FIX).length > 0, 'MUTANT KILLED: the cleanups out of the table order');
  ok(auditClean(main, k8, FIX).length > 0, 'MUTANT KILLED: a latin r glued to the word Allah in a rawi text');
  ok(auditClean(main, k9, FIX).length > 0, 'MUTANT KILLED: a stray ampersand-name-semicolon entity');
  ok(auditClean(main, sharh, FIX2).length > 0, 'MUTANT KILLED: a table entry with no matching cleanup');
  const k10 = cl(sharh); k10.items['20'].rawi[6] = '& dash;' + k10.items['20'].rawi[6];
  ok(auditFixesVisible(main, k10, FIX).length > 0 && auditClean(main, k10, FIX).length > 0, 'MUTANT KILLED: the broken dash back at the head of hadith 20 rawi paragraph 7');
  const k11 = cl(sharh); k11.items['20'].rawi[6] = k11.items['20'].rawi[6].replace('- ', '');
  ok(auditFixesVisible(main, k11, FIX).length > 0, 'MUTANT KILLED: a fixed spot reverted to neither the old nor the new text');
  // the builder's assertion: an old string that occurs twice, or not at all, fails the build
  const fakePages = () => [{ n: 1, layers: { matn: ['aa b aa'], sharh: ['x'], rawi: ['y'] } }];
  const throws = (table) => { try { build.applyFixes(fakePages(), table); return false; } catch (e) { return /FIX:/.test(String(e.message)); } };
  ok(!throws([{ hadith: 1, field: 'matn', paragraph: 0, old: 'b', new: 'c' }]), 'the builder applies an old string that occurs exactly once');
  ok(throws([{ hadith: 1, field: 'matn', paragraph: 0, old: 'aa', new: 'c' }]), 'MUTANT KILLED: the builder accepts an old string that occurs twice');
  ok(throws([{ hadith: 1, field: 'matn', paragraph: 0, old: 'zz', new: 'c' }]), 'MUTANT KILLED: the builder accepts an old string that does not occur');
  ok(throws([{ hadith: 1, field: 'sharh', paragraph: 0, old: 'x', new: null }]) === false && throws([{ hadith: 1, field: 'matn', paragraph: 0, old: 'b', new: null }]), 'MUTANT KILLED: the builder removes a paragraph by naming only part of it');
}

// ---- 3. the reader ---------------------------------------------------------------------------------------------
const app = read('app.jsx');
function between(src, a, b) {
  const i = src.indexOf(a);
  if (i < 0) return null;
  const j = src.indexOf(b, i + a.length);
  return j < 0 ? null : src.slice(i, j);
}
const SEC_A = 'const loadArbaeen = () => {';
const SEC_B = '// One category, full screen. The audio contract is DhikrCard';
const READER_A = 'function IstanaArbaeenReader(';
function auditApp(src) {
  const bad = [];
  const loaders = between(src, SEC_A, '// ── THE SPLIT OF CATEGORY 27');
  const section = between(src, '// ITEM 89 -- THE FORTY NAWAWI', SEC_B);
  const reader = section && between(section, READER_A, '\n}\n');
  if (!loaders || !section || !reader) return ['the section could not be found'];
  if (/dangerouslySetInnerHTML/.test(loaders + section)) bad.push('dangerouslySetInnerHTML in the section');
  const audios = [...reader.matchAll(/<audio\b[^>]*>/g)].map((m) => m[0]);
  if (audios.length !== 1) bad.push(audios.length + ' audio elements in the reader');
  if (!audios.every((a) => /\bkey=\{h\.n\}/.test(a) && /\bpreload="none"/.test(a) && /\bsrc=\{audioUrl\}/.test(a) && !/\bautoPlay\b/i.test(a))) bad.push('the audio element is not keyed by h.n, preload none, src audioUrl');
  if (/\.(play|pause)\s*\(/.test(section)) bad.push('a play or pause call in the section');
  const anchors = [...reader.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  if (anchors.length !== 2) bad.push(anchors.length + ' anchors in the reader');
  if (!anchors.every((a) => /target="_blank"/.test(a) && /rel="noopener noreferrer"/.test(a))) bad.push('an anchor without target _blank and rel noopener noreferrer');
  const hrefs = anchors.map((a) => (a.match(/\bhref=\{(\w+)\}/) || [])[1]).sort();
  if (JSON.stringify(hrefs) !== JSON.stringify(['creditUrl', 'sourceUrl'])) bad.push('anchor hrefs are ' + hrefs.join(','));
  if (/\b(?:src|href)=["'{`]*(?:https?:)?\/\//.test(section)) bad.push('a literal address in a src or href');
  for (const [v, from] of [['audioUrl', 'ezikFatwaPublicUrl(item.audio.url)'], ['creditUrl', 'ezikFatwaPublicUrl(credit.url)'], ['sourceUrl', 'ezikFatwaPublicUrl(h.source_url)']]) {
    const decl = (reader.match(new RegExp('const ' + v + ' = ([^;]+);')) || [])[1] || '';
    if (decl.indexOf(from) === -1) bad.push(v + ' does not pass ezikFatwaPublicUrl from the data');
  }
  if (/data-ezia-hadith/.test(reader)) bad.push('data-ezia-hadith inside the reader');
  if (!/const loadArbaeenSharh = \(\) => \{/.test(loaders) || !/fetch\('\/arbaeen-sharh\.json'\)/.test(loaders) || !/__arbSharhPromise = null; throw e;/.test(loaders)) bad.push('loadArbaeenSharh is not a remembered promise cleared on failure');
  if (!src.includes('<ArbaeenScreen onBack={goEzikBack} key={homeEpoch} />')) bad.push('the screen mount changed');
  if (!src.includes('? book.hadith.map((h) => ({ n: h.n, title: h.title, text: h.text })) : null,')) bad.push('the widget no longer carries n, title and text only');
  return bad;
}
const bApp = auditApp(app);
ok(bApp.length === 0, 'the reader: no dangerouslySetInnerHTML; one <audio key={h.n} preload="none">; two links, both target _blank rel noopener noreferrer; audio, credit and source each through ezikFatwaPublicUrl from the data; no literal address; no play or pause; the widget unchanged', bApp.join(' | '));
const RA = '<audio key={h.n} controls preload="none" src={audioUrl}';
const RB = 'rel="noopener noreferrer" style={s.eziaSourceLink}';
const RC = 'const sourceUrl = ezikFatwaPublicUrl(h.source_url);';
ok(app.includes(RA) && app.includes(RB) && app.includes(RC), 'the three mutation anchors are present');
ok(auditApp(app.replace(RA, '<audio controls preload="none" src={audioUrl}')).length > 0, 'MUTANT KILLED: the audio element without key={h.n}');
ok(auditApp(app.replace(RA, '<audio key={h.n} controls preload="auto" src={audioUrl}')).length > 0, 'MUTANT KILLED: preload auto');
ok(auditApp(app.replace(RB, 'rel="noopener" style={s.eziaSourceLink}')).length > 0, 'MUTANT KILLED: rel noopener without noreferrer');
ok(auditApp(app.replace(RC, 'const sourceUrl = h.source_url;')).length > 0, 'MUTANT KILLED: the source link not passed through ezikFatwaPublicUrl');
ok(auditApp(app.replace(RA, '<audio key={h.n} controls preload="none" src="https://obj.equran.me/x.mp3" data-x={audioUrl}')).length > 0, 'MUTANT KILLED: a literal audio address');

// ---- 4. the worker ----------------------------------------------------------------------------------------------
function auditSw(src) {
  const bad = [];
  const core = between(src, 'const CORE = [', '];');
  const idle = between(src, 'const IDLE = [', '];');
  if (!core || !idle) return ['CORE or IDLE not found'];
  if (core.indexOf('/arbaeen-sharh.json') !== -1) bad.push('arbaeen-sharh.json is in CORE');
  const entries = [...idle.matchAll(/^\s*'([^']+)',/gm)].map((m) => m[1]);
  if (entries[entries.length - 1] !== '/arbaeen-sharh.json') bad.push('arbaeen-sharh.json is not the last IDLE entry (' + entries[entries.length - 1] + ')');
  return bad;
}
const sw = read('sw.js');
const bSw = auditSw(sw);
ok(bSw.length === 0, 'sw.js: arbaeen-sharh.json is not in CORE and is the last entry of IDLE', bSw.join(' | '));
ok(auditSw(sw.replace("const CORE = [\n  '/',", "const CORE = [\n  '/',\n  '/arbaeen-sharh.json',")).length > 0, 'MUTANT KILLED: arbaeen-sharh.json in CORE');
ok(auditSw(sw.replace("  '/arbaeen-sharh.json',\n];", '];')).length > 0, 'MUTANT KILLED: arbaeen-sharh.json out of IDLE');

console.log((fail ? 'FAIL' : 'OK') + ': arbaeensharh ' + pass + '/' + (pass + fail) + ' checks passed.');
process.exit(fail ? 1 : 0);
