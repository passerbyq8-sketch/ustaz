import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone: node lang/content/tools/check-K10.js [--partial] [am om en fa]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partial = process.argv.includes('--partial');
const requested = process.argv.slice(2).filter(x => x !== '--partial');
const langs = requested.length ? requested : ['am', 'om', 'en', 'fa'];
let errors = 0;
function fail(message) { console.error(message); errors++; }
function read(file) {
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail(`${file}: BOM`);
  const text = bytes.toString('utf8');
  if (text.includes('\r')) fail(`${file}: CR line endings`);
  if (text.includes('\ufffd')) fail(`${file}: invalid UTF-8`);
  const result = JSON.parse(text);
  if (text !== JSON.stringify(result, null, 2) + '\n') fail(`${file}: expected two-space JSON and final LF`);
  return result;
}
const manifest = read(path.join(root, 'quest-ui-keys-ar.json'));
for (const [key, item] of Object.entries(manifest.keys)) {
  if (!/^quest\.[a-z0-9_.]+$/.test(key) || !item.ar || !item.where.length) fail(`Invalid manifest: ${key}`);
}
for (const lang of langs) {
  if (!['am', 'om', 'en', 'fa'].includes(lang)) { fail(`Unsupported language: ${lang}`); continue; }
  const file = path.join(root, lang, 'quest-ui.json');
  if (!fs.existsSync(file)) { fail(`${lang}: file missing`); continue; }
  const data = read(file);
  if (data.schema !== 'ezik-tr4/1' || data.lang !== lang || data.tag !== 'machine') fail(`${lang}: metadata`);
  const expected = Object.keys(manifest.keys).filter(k => manifest.keys[k].required.includes(lang));
  const actual = Object.keys(data.keys);
  if (!partial && actual.length !== expected.length) fail(`${lang}: ${actual.length}/${expected.length} keys`);
  for (const key of actual) {
    if (!expected.includes(key)) { fail(`${lang}: extra key ${key}`); continue; }
    const value = data.keys[key];
    if (typeof value !== 'string' || !value.trim()) { fail(`${lang}: empty ${key}`); continue; }
    if (lang === 'am' && (!/[\u1200-\u137f]/u.test(value) || /[a-z\u0621-\u064a]/iu.test(value))) fail(`${lang}: script ${key}`);
    if (['om', 'en'].includes(lang) && (!/[a-z]/iu.test(value) || /[\u0621-\u064a\u1200-\u137f]/u.test(value))) fail(`${lang}: script ${key}`);
    if (lang === 'fa' && (!/[\u0600-\u06ff]/u.test(value) || /[يك]/u.test(value))) fail(`${lang}: script ${key}`);
    const tokens = s => (s.match(/\{[A-Za-z0-9_]+\}/g) || []).sort().join('|');
    if (tokens(value) !== tokens(manifest.keys[key].ar)) fail(`${lang}: placeholders ${key}`);
  }
  if (!partial) for (const key of expected) if (!Object.hasOwn(data.keys, key)) fail(`${lang}: missing ${key}`);
  console.log(`${lang}: ${actual.length}/${expected.length} machine keys; ${partial ? 'PARTIAL batch' : 'complete'}`);
}
if (errors) { console.error(`FAIL: ${errors} errors`); process.exitCode = 1; }
else console.log(`PASS: encoding, key membership, nonempty values, scripts, placeholders${partial ? ' (partial mode; completion not asserted)' : ''}`);
