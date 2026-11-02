'use strict';
// TRANSLATE4: quest-i18n.js stays the one source of the games' language tables and of the localizer.
// The pages never load it whole: an Arabic reader loads no table at all and any other reader loads
// quest-i18n/<code>.js, which is the same file cut down to one language. This tool:
//   1. folds lang/content/<lang>/hanna-ui.json (keys and patterns) into quest-i18n.js
//   2. writes quest-i18n/<code>.js for every language of ROWS but Arabic
// Usage: node tools/tr4-quest-i18n.cjs        (kunuzqa checks that the files on disk equal split())
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OVERLAY = ['am', 'om', 'en', 'fa'];
const line = (src, re) => src.split('\n').findIndex((l) => re.test(l));
const prefix = (l) => /^\s*(var STRINGS = |var LOC = |STRINGS\.[a-z]{2} = |LOC\.[a-z]{2} = )/.exec(l);

function languages(src) {
  const m = /var ROWS = \{(.*)\};/.exec(src);
  return (m[1].match(/\b([a-z]{2}): \{ dir/g) || []).map((x) => x.slice(0, 2)).filter((c) => c !== 'ar').concat('om');
}
// one language: the two big tables keep only its row, the added tables of the others go
function split(src, code) {
  return src.split('\n').map((l) => {
    const p = prefix(l);
    if (!p) {
      const pat = /^(\s*var PATTERNS = )(\{.*\})(;.*)$/.exec(l);
      if (!pat) return l;
      const all = JSON.parse(pat[2]);
      return pat[1] + JSON.stringify(all[code] ? { [code]: all[code] } : {}) + pat[3];
    }
    if (/^\s*var (STRINGS|LOC) = /.test(l)) {
      const m = /^(\s*var (?:STRINGS|LOC) = )(\{.*\})(;.*)$/.exec(l);
      const all = JSON.parse(m[2]);
      return m[1] + JSON.stringify(all[code] ? { [code]: all[code] } : {}) + m[3];
    }
    return new RegExp('^\\s*(STRINGS|LOC)\\.' + code + ' = ').test(l) ? l : null;
  }).filter((l) => l !== null).join('\n');
}
function fold(src) {
  const patterns = {};
  for (const lang of OVERLAY) {
    const file = path.join(ROOT, 'lang/content', lang, 'hanna-ui.json');
    if (!fs.existsSync(file)) continue;
    const h = JSON.parse(fs.readFileSync(file, 'utf8'));
    const lines = src.split('\n'), i = line(src, new RegExp('^\\s*STRINGS\\.' + lang + ' = Object\\.assign\\('));
    const m = /^(\s*STRINGS\.[a-z]{2} = Object\.assign\(STRINGS\.[a-z]{2} \|\| \{\}, )(\{.*\})(\);.*)$/.exec(lines[i]);
    lines[i] = m[1] + JSON.stringify(Object.assign(JSON.parse(m[2]), h.keys)) + m[3];
    src = lines.join('\n');
    patterns[lang] = h.patterns || [];
  }
  const lines = src.split('\n'), i = line(src, /^\s*var PATTERNS = /);
  if (i >= 0) lines[i] = '  var PATTERNS = ' + JSON.stringify(patterns) + ';';
  return lines.join('\n');
}
function run() {
  const file = path.join(ROOT, 'quest-i18n.js');
  const src = fold(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, src);
  fs.mkdirSync(path.join(ROOT, 'quest-i18n'), { recursive: true });
  const sizes = {};
  for (const code of languages(src)) {
    const out = split(src, code);
    fs.writeFileSync(path.join(ROOT, 'quest-i18n', code + '.js'), out);
    sizes[code] = Buffer.byteLength(out);
  }
  console.log(JSON.stringify(sizes));
}
if (require.main === module) run();
module.exports = { split, languages };
