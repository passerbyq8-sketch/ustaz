// tools/build-translations.mjs -- refreshes the published translation snapshots the language layer serves.
//   node tools/build-translations.mjs <lang> [outDir]      (lang: en, fa, fr)
// Sources and their PUBLISHED conditions (kept in each file's `meta`, and shown on every card the reader sees):
//   quranenc.com  -- no modification/addition/deletion; publisher + source + version number shown; latest version.
//   hadeethenc.com, terminologyenc.com -- free reference; publisher, source and fetch date are kept in the same way.
// The files are SNAPSHOTS: re-run this tool to bring them to the latest published release (the version is read from the API).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const lang = process.argv[2] || 'en'; const out = process.argv[3] || 'lib/data/translations';
const QKEY = { en: 'english_saheeh', fa: 'persian_ih', fr: 'french_rashid' }[lang]; if (!QKEY) throw new Error('no Quran translation chosen for ' + lang);
const J = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'user-agent': 'ezik-translation-snapshot/1' } }); if (r.ok) return await r.json(); } catch {} await new Promise(r => setTimeout(r, 500 * (i + 1))); } throw new Error('fetch failed ' + u); };
const pool = async (items, n, fn) => { const res = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } })); return res; };
const gz = (o) => zlib.gzipSync(JSON.stringify(o), { level: 9 });
fs.mkdirSync(out, { recursive: true });
// --- Quran
const list = (await J(`https://quranenc.com/api/v1/translations/list/${lang}`)).translations.find(t => t.key === QKEY);
const suras = await pool(Array.from({ length: 114 }, (_, i) => i + 1), 6, async (n) => (await J(`https://quranenc.com/api/v1/translation/sura/${QKEY}/${n}`)).result);
const quran = { meta: { key: QKEY, title: list.title, version: list.version, lastUpdate: list.last_update, description: list.description, source: 'QuranEnc.com', sourceUrl: 'https://quranenc.com/en/browse/' + QKEY, fetchedAt: new Date().toISOString().slice(0, 10) }, suras: suras.map(rows => rows.map(r => [r.translation, r.footnotes || ''])) };
fs.writeFileSync(path.join(out, `quran-${lang}.json.gz`), gz(quran)); console.log('quran', suras.reduce((a, s) => a + s.length, 0));
// --- Hadith
const cats = (await J('https://hadeethenc.com/api/v1/categories/list/?language=ar')).filter(c => !c.parent_id);
const ids = new Map(); for (const c of cats) { let p = 1, last = 1; do { const j = await J(`https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=${c.id}&page=${p}&per_page=500`); last = +j.meta.last_page; for (const d of j.data) if (d.translations.includes(lang)) ids.set(d.id, 1); p++; } while (p <= last); }
const hs = await pool([...ids.keys()], 8, async (id) => { const [a, e] = await Promise.all([J(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${id}`), J(`https://hadeethenc.com/api/v1/hadeeths/one/?language=${lang}&id=${id}`)]); return [id, a.hadeeth_ar || a.hadeeth || '', e.hadeeth || '', e.attribution || '', e.grade || '']; });
fs.writeFileSync(path.join(out, `hadith-${lang}.json.gz`), gz({ meta: { title: 'Encyclopedia of Translated Prophetic Hadiths', source: 'HadeethEnc.com', sourceUrl: 'https://hadeethenc.com', fetchedAt: new Date().toISOString().slice(0, 10), fields: ['id', 'ar', 'text', 'attribution', 'grade'] }, rows: hs })); console.log('hadith', hs.length);
// --- Terms
const tcats = (await J(`https://terminologyenc.com/api/v1/categories/list?language=${lang}`)).filter(c => !c.parent_id);
const tids = new Map(); for (const c of tcats) { let p = 1, last = 1; do { const j = await J(`https://terminologyenc.com/api/v1/terms/list/?language=${lang}&category_id=${c.id}&page=${p}&per_page=500`); last = +j.meta.last_page; for (const d of j.data) tids.set(d.id, d.term); p++; } while (p <= last); }
const ts = await pool([...tids.keys()], 8, async (id) => { const e = await J(`https://terminologyenc.com/api/v1/terms/one/?language=${lang}&id=${id}`); const raw = tids.get(id); const k = raw.lastIndexOf(' - '); return [id, k > 0 ? raw.slice(0, k) : raw, k > 0 ? raw.slice(k + 3) : '', e.idio_def && e.idio_def !== '-' ? e.idio_def : (e.brief_ling_def || '')]; });
fs.writeFileSync(path.join(out, `terms-${lang}.json.gz`), gz({ meta: { title: 'Encyclopedia of Translated Islamic Terms', source: 'TerminologyEnc.com', sourceUrl: 'https://terminologyenc.com', fetchedAt: new Date().toISOString().slice(0, 10), fields: ['id', 'term', 'ar', 'definition'] }, rows: ts })); console.log('terms', ts.length);
