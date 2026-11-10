'use strict';
// TRANSLATE4: runs after tools/tr4-build-content.cjs. Removes the notes the translation agents left inside
// question, choice and explanation texts, keeps a short credit where the licence asks for one, and applies
// the record fixes of tools/tr4-fixes.json. Running it twice changes nothing. Arabic is never touched.
// Usage: node tools/tr4-clean-content.cjs
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const LANGS = ['en', 'fa', 'am', 'om'];
const Q = '(QuranEnc)', H = '(HadeethEnc)';

function ref(s) { const m = /\d+:\d+(?:-\d+)?/.exec(s); return m ? '(QuranEnc, ' + m[0] + ')' : Q; }
const NOTE_EN = /in-session|snapshot|fetched|QuranEnc|HadeethEnc|english_saheeh|Noor International|published translation/i;
const NOTE_FA = /ماشینی|QuranEnc|HadeethEnc|persian_ih|قرآن‌انک|K19|ترجمهٔ منتشرشدهٔ|نسخهٔ ذخیره‌شده|روایت ذخیره‌شده/;
function en(raw) {
  if (!NOTE_EN.test(raw) || /is a snapshot of financial/.test(raw)) return raw;
  const s = raw.split('...').join('\u0001');
  return s
    .replace(/\(QuranEnc(?:\.com)?\s*[,/][^()]*?v\d[\d.]*[^()]*\)/g, ref)
    .replace(/\(HadeethEnc[^()]*\)/g, H)
    .replace(/\(In-session translation\.?\)/gi, '')
    .replace(/[;,.]?\s*(?:—\s*)?(?:unchanged excerpt,\s*)?(?:QuranEnc(?:\.com)?\s*[,/]\s*)?(?:English Translation - )?Noor International Center\s*[,/]\s*(?:QuranEnc\s+)?english_saheeh v[\d.]+(?:,\s*repository snapshot)?(?:,\s*(?:excerpt from\s*)?\d+:\d+(?:(?:,| and)\s*\d+:\d+)*)?/g, ' ' + Q)
    .replace(/(?:Unchanged |English |Explanation |Matching |Hadith )*(?:excerpts?|quotation|wording|snapshot)?:?\s*(?:—\s*)?HadeethEnc[^\]]*?(?:fetched \d{4}-\d\d-\d\d|snapshot \d{4}-\d\d-\d\d|\/hadith\/\d+(?:,? local (?:English )?snapshot fetched \d{4}-\d\d-\d\d)?)(?:;\s*https:\/\/hadeethenc\.com\S*)?(?:;\s*Encyclopedia of Translated Prophetic Hadiths)?(?:,\s*snapshot \d{4}-\d\d-\d\d)?/g, ' ' + H)
    .replace(/[A-Z][^.\]]*?\b(?:translated in-session|in-session translation|Translation in-session|in-session)\b;\s*(?=(?:supplication )?pronunciations?|Quran|\()/gi, '')
    .replace(/(?:[.;]\s*|\s)[^.\]\[]*\b(?:translated in-session|in-session translation|Translation in-session|in-session)\b[^.\]]*\.?(?:\s*(?:The )?[^.\]]*(?:local )?HadeethEnc[^.\]]*\.)?/gi, '.')
    .replace(/[;.]?\s*(?:the )?local HadeethEnc[^.\]]*\.?/gi, '.')
    .replace(/Complete snapshot verse:/g, 'Full verse:').replace(/The complete snapshot verse is:/g, 'The full verse is:').replace(/Matching snapshot excerpt:/g, 'Verse:')
    .replace(/\s*The bracketed snapshot supplies the full verse\./g, '')
    .replace(/;\s*the (?:complete )?(?:snapshot|published translation)[^.]*\./g, '.')
    .replace(/(?:Quran |Choice |English )?(?:word )?(?:excerpts?|examples?):\s*\(QuranEnc\)/g, Q)
    .replace(/;?\s*(?:local )?(?:English )?snapshot fetched \d{4}-\d\d-\d\d\.?/g, '')
    .replace(/,\s*fetched \d{4}-\d\d-\d\d/g, '')
    .replace(/The snapshot renders/g, 'The translation renders').replace(/Snapshot note \[/g, 'Note [')
    .replace(/Complete snapshot verse and notes:/g, 'Full verse and notes:').replace(/Matching complete snapshot excerpt:/g, 'Verse:').replace(/Matching snapshot ending:/g, 'Verse ending:')
    .replace(/\s*The published snapshot omits[^.]*\./g, '').replace(/\s*No exact English match[^.]*\./g, '')
    .replace(/The fourth option is an unchanged excerpt from the local \(HadeethEnc\)/g, 'Fourth option: (HadeethEnc)')
    .replace(/;\s*the published translation places[^(.]*/g, ' ').replace(/whose full published translation is:/g, 'whose full translation is:')
    .replace(/,?\s*Encyclopedia of Translated Prophetic Hadiths/g, '').replace(/,?\s*unchanged matching excerpt from/g, '')
    .replace(/Unchanged [a-z ]*(?=\((?:Quran|Hadeeth))/g, '').replace(/\(HadeethEnc\)[;.]\s*\]/g, '(HadeethEnc)]')
    .replace(/\.\s*\.+/g, '.').replace(/\s+\./g, '.').replace(/\]\./g, '].').replace(/\.\s*\(Quran/g, ' (Quran').replace(/\.\s*\(Hadeeth/g, ' (Hadeeth')
    .replace(/(\((?:QuranEnc|HadeethEnc)[^)]*\))(?:\s*\.?\s*\1)+/g, '$1').replace(/ {2,}/g, ' ').trim().split('\u0001').join('...');
}
function fa(s) {
  if (!NOTE_FA.test(s) || /رمزگذاری‌شدهٔ ماشینی/.test(s)) return s;
  return s
    .replace(/\(HadeethEnc،[^()]*\)/g, H)
    .replace(/\s*—\s*ترجمهٔ منتشرشدهٔ رواد،\s*(?:\(QuranEnc\)|QuranEnc[^\]]*)/g, ' ' + Q)
    .replace(/[؛.]?\s*ترجمهٔ روایت از K\d\d/g, '')
    .replace(/[؛.]?\s*(?:ترجمهٔ کامل آیه،\s*رواد،\s*)?(?:قرآن \d+:\d+،\s*)?QuranEnc،\s*persian_ih[^\]]*(?=\])/g, ' ' + Q)
    .replace(/[؛.]?\s*(?:ترجمهٔ سخن پیامبر از\s*|روایت هم‌معنا در\s*|بخشی از ترجمهٔ\s*)HadeethEnc[^\]]*(?=\])/g, ' ' + H)
    .replace(/در نسخهٔ ذخیره‌شده/g, '').replace(/روایت ذخیره‌شده/g, 'روایت').replace(/«أجول» بانک/g, '«أجول»')
    .replace(/\s*\[(?:ترجمهٔ [^\[\]]*?:\s*)?QuranEnc[^\[\]]*\]/g, ' ' + Q)
    .replace(/\s*\[(?:منبع:\s*)?HadeethEnc[^\[\]]*\]/g, ' ' + H)
    .replace(/\s*(?:—|؛)\s*(?:ترجمهٔ (?:منتشرشدهٔ رواد|کامل آیه)،\s*|بخشی از ترجمهٔ قرآن[^\[\]]*?،\s*|رواد،\s*)?QuranEnc[^\[\]]*(?=\])/g, ' ' + Q)
    .replace(/\s*(?:—|؛|\.)\s*(?:متن روایت هم‌معنا در\s*|منبع:\s*)?HadeethEnc[^\[\]]*(?=\])/g, ' ' + H)
    .replace(/[؛.،]?\s*مرکز رواد،\s*قرآن‌انک،\s*نسخهٔ [\d.]+/g, ' ' + Q)
    .replace(/\s*\[ترجمهٔ ماشینی[^\[\]]*\]/g, '')
    .replace(/[؛.،]?\s*ترجمهٔ ماشینی[^\[\]؟]*?\.?(?=\])/g, '')
    .replace(/ترجمهٔ منتشرشدهٔ (روایت|همان)/g, '$1')
    .replace(/\s*\.?\s*ترجمهٔ ماشینی(?: K\d\d)?\.?/g, '')
    .replace(/(\((?:QuranEnc|HadeethEnc)\))(?:\s*\.?\s*\1)+/g, '$1').replace(/\.\]/g, '.]').replace(/ {2,}/g, ' ').trim();
}
const CLEAN = { en, fa, am: (s) => s, om: (s) => s };
const clean = (lang, s) => (typeof s === 'string' && s ? CLEAN[lang](s) : s);

function fixes(lang) {
  const f = path.join(__dirname, 'tr4-fixes.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8'))[lang] || [] : [];
}
function run() {
  const report = {};
  for (const lang of LANGS) {
    const r = report[lang] = { fields: 0, fixes: 0, fixMissed: [] };
    const seen = new Map();
    const take = (s) => { const c = clean(lang, s); if (c !== s) { r.fields++; seen.set(s, c); } return c; };
    const dir = path.join(ROOT, 'lang/content', lang);
    const coreFile = path.join(dir, 'core.json'), core = JSON.parse(fs.readFileSync(coreFile, 'utf8'));
    for (const t of Object.values(core.items)) { t[0] = take(t[0]); t[1] = t[1].map(take); t[2] = take(t[2]); }
    for (const x of fixes(lang)) {
      const t = core.items[x.id], i = x.field === 'q' ? 0 : x.field === 'why' ? 2 : 1, c = x.field[0] === 'c' ? +x.field.slice(1) : -1;
      const old = t && (i === 1 ? t[1][c] : t[i]);
      if (typeof old !== 'string' || !old.includes(x.old)) { if (!(t && (i === 1 ? t[1][c] : t[i] || '').includes(x.new))) r.fixMissed.push(x.id + ':' + x.field); continue; }
      if (x.new.includes(x.old) && old.includes(x.new)) continue;
      const now = old.split(x.old).join(x.new);
      if (i === 1) t[1][c] = now; else t[i] = now;
      seen.set(old, now); r.fixes++;
    }
    fs.writeFileSync(coreFile, JSON.stringify(core) + '\n');
    const roomFile = path.join(dir, 'room-text.json'), room = JSON.parse(fs.readFileSync(roomFile, 'utf8'));
    for (const k of Object.keys(room.keys)) { let v = clean(lang, room.keys[k]); if (seen.has(v)) v = seen.get(v); room.keys[k] = v; }
    fs.writeFileSync(roomFile, JSON.stringify(room) + '\n');
    const packs = path.join(dir, 'packs');
    for (const name of fs.readdirSync(packs)) {
      const file = path.join(packs, name), p = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const q of p.qs) { q.q = take(q.q); q.choices = q.choices.map(take); if (q.why) q.why = take(q.why); }
      fs.writeFileSync(file, JSON.stringify(p) + '\n');
    }
  }
  const correction = require('./item33-corrections.cjs');
  for (const file of new Set(require('./item33-corrections.json').patches.map(p => p.file).filter(f => f.startsWith('lang/content/')))) {
    const full = path.join(ROOT, file), raw = fs.readFileSync(full, 'utf8');
    const data = correction.apply(file, JSON.parse(raw));
    fs.writeFileSync(full, JSON.stringify(data, null, raw.startsWith('{\n  ') ? 2 : undefined) + '\n');
  }
  console.log(JSON.stringify(report));
}
if (require.main === module) run();
module.exports = { clean };
