// guards/brain-line-r2-3-guard.cjs -- ITEM r2-3 (O3a follow-up) -- 2026-10-17 brain-line R2
//
// THE STATUS LINE IN THE READER'S LANGUAGE. Measured on the preview of fa778c0e (sessions/side-brain-fix-2026-10-15/
// EZIK-EXT-PREVIEW-TEST-REPORT-2026-10-17.txt lines 244, 255, 290, 320, 381): the first status line stayed Arabic in every
// language -- «يقرأ في الدروس… وجد 3» (English, line 255), «يقرأ في الموسوعة الفقهية… وجد ۴» (Persian, line 290), «يقرأ في
// كتب الشاملة… وجد 4» (Urdu, line 320) -- while «Choosing the texts…» and «Writing the answer…» were translated: app.jsx's
// ezikReadingStatus() read a fixed Arabic table and glued « وجد N» to it, never through ezT().
//
// What this guard holds (the R2 order, item 3): ezikReadingStatus rebuilt from app.jsx's own source (with its ezT and
// toArabicDigits lines), against the Arabic and English tables of app.jsx and lang/fa.json --
//   (1) en, stage lessons, hits 3: no Arabic letter, and it carries «3»;
//   (2) ar: «يقرأ في الدروس… وجد ٣» exactly as before (report line 71 shows that very line to the Arabic reader);
//   (3) fa: Persian digits, no Arabic «وجد»;
//   (4) the new key x.658 is in the two tables of app.jsx and in all 21 lang/*.json files ({n} kept).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).slice(0, 400);

const app = fs.readFileSync(path.join(REPO, 'app.jsx'), 'utf8');
// the Arabic table is the first, the English the second: split at the English table's own x.250
const firstAt = app.indexOf("'x.250':"); const enAt = app.indexOf("'x.250':", firstAt + 1);
const tableOf = (region) => { const t = {}; for (const m of region.matchAll(/'((?:x|common)\.[0-9a-z]+)':\s*'((?:[^'\\]|\\.)*)'/g)) if (!(m[1] in t)) t[m[1]] = m[2].replace(/\\'/g, "'"); return t; };
const DICT = { ar: tableOf(app.slice(0, enAt)), en: tableOf(app.slice(enAt)) };
for (const code of ['fa', 'ur']) DICT[code] = JSON.parse(fs.readFileSync(path.join(REPO, 'lang', code + '.json'), 'utf8'));
const DIGITS = { ar: 'arab-indic', en: 'latn', fa: 'arab-ext', ur: 'latn' };

// the source of the status: from the stage table (EZIK_READING_STAGE…) to the end of function ezikReadingStatus
const from = app.indexOf('const EZIK_READING_STAGE');
const fnAt = app.indexOf('function ezikReadingStatus(evt)');
const end = app.indexOf('\n}\n', fnAt);
const statusSrc = from >= 0 && fnAt > from && end > fnAt ? app.slice(from, end + 2) : '';
const ezTSrc = (() => { const a = app.indexOf('function ezT(key, vars)'); const b = app.indexOf('\n}\n', a); return a >= 0 ? app.slice(a, b + 2) : ''; })();
const digitsSrc = (/^const toArabicDigits = .*$/m.exec(app) || [''])[0];
function statusIn(lang, evt) {
  const ctx = { EZ_LANG: lang, EZ_LANG_FALLBACK: 'ar', EZ_I18N: DICT, ezLangEntry: (c) => ({ digits: DIGITS[c] || 'latn' }) };
  vm.createContext(ctx);
  vm.runInContext(ezTSrc + '\n' + digitsSrc + '\n' + statusSrc + '\nthis.__s = ezikReadingStatus;', ctx);
  return ctx.__s(evt);
}

console.log('-- 0. the source');
ok('ezikReadingStatus, ezT and toArabicDigits found in app.jsx', !!statusSrc && !!ezTSrc && !!digitsSrc);
console.log('-- 1. English');
const en = statusIn('en', { type: 'ezik_status', stage: 'lessons', hits: 3 });
ok('en lessons hits 3: no Arabic letter, and it carries 3', !!en && !/[؀-ۿ]/u.test(en) && en.includes('3'), ascii(en));
const enAll = ['retrieve', 'fatwa', 'library', 'encyclopedia', 'lessons', 'judge', 'write'].map((stage) => statusIn('en', { stage, hits: 2 }));
ok('en: every stage without an Arabic letter', enAll.every((s) => s && !/[؀-ۿ]/u.test(s)), ascii(enAll.join(' | ')));
console.log('-- 2. Arabic, unchanged');
ok('ar lessons hits 3 -> exactly the line the Arabic reader saw (report line 71)', statusIn('ar', { stage: 'lessons', hits: 3 }) === 'يقرأ في الدروس… وجد ٣',
  ascii(statusIn('ar', { stage: 'lessons', hits: 3 })));
ok('ar judge (no count) unchanged', statusIn('ar', { stage: 'judge' }) === 'يختار النصوص التي تجيب عن المسألة…');
ok('an unknown stage is still nothing', statusIn('ar', { stage: 'nope' }) === null && statusIn('en', null) === null);
console.log('-- 3. Persian and Urdu');
const fa = statusIn('fa', { stage: 'encyclopedia', hits: 4 });
ok('fa encyclopedia hits 4: Persian digit, no Arabic wajada', !!fa && fa.includes('۴') && !fa.includes('وجد') && !fa.includes('يقرأ'), ascii(fa));
const ur = statusIn('ur', { stage: 'library', hits: 4 });
ok('ur library hits 4: no Arabic wajada / yaqra', !!ur && !ur.includes('وجد') && !ur.includes('يقرأ') && ur.includes('4'), ascii(ur));
console.log('-- 4. the key in every table');
const files = fs.readdirSync(path.join(REPO, 'lang')).filter((f) => f.endsWith('.json'));
const missing = files.filter((f) => { const j = JSON.parse(fs.readFileSync(path.join(REPO, 'lang', f), 'utf8')); return typeof j['x.658'] !== 'string' || !j['x.658'].includes('{n}'); });
ok('x.658 with {n} in the 21 lang files', files.length === 21 && missing.length === 0, missing.join(','));
ok('x.658 in the Arabic and English tables of app.jsx', DICT.ar['x.658'] === 'وجد {n}' && DICT.en['x.658'] === 'found {n}');
console.log('');
console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-r2-3: ' + (checks - failures) + '/' + checks);
process.exit(failures ? 1 : 0);
