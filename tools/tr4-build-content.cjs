'use strict';
// TRANSLATE4: builds the runtime content files from the translation agents' branches.
// Usage: node tools/tr4-build-content.cjs
// Sections are taken as delivered. Packs keep only what the overlay reads, because the delivered
// files repeat the Arabic three times. The core bank becomes one file per language; every record
// that has no usable translation is left out, so the client hides it in solo play. room-text.json
// maps the Arabic of the core bank to its translation for the room screens, whose text comes from
// the worker in Arabic. Nothing here edits an Arabic original.
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, 'tr4-sources.json'), 'utf8'));
function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30 }); }
function ls(branch, dir) { try { return git(['ls-tree', '--name-only', branch + ':' + dir]).toString().trim().split('\n').filter(Boolean); } catch (_) { return []; } }
function show(branch, file) { return JSON.parse(git(['show', branch + ':' + file]).toString()); }
function norm(s) {
  return s.normalize('NFC').replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ​-‏﻿]/g, '').replace(/\s+/g, ' ').trim();
}
function hid(s) { return 'h:' + crypto.createHash('sha1').update(norm(s), 'utf8').digest('hex').slice(0, 12); }
function write(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data) + '\n');
  return fs.statSync(file).size;
}
const box = {}; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'quest-data/kunuz-bank-3147.js'), 'utf8').replace('var DATA', 'this.DATA'), box);
const bank = box.DATA.qs, sha8 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'quest-data/kunuz-bank-3147.js'))).digest('hex').slice(0, 8);
const rows = new Map(bank.map((q) => [q[8], q]));
const manifest = fs.readFileSync(path.join(ROOT, 'quest-data/kunuz-packs-manifest.js'), 'utf8');
const report = {};
for (const lang of Object.keys(SOURCES)) {
  const out = report[lang] = { sections: 0, packs: 0, packBytes: 0, coreRecords: 0, coreBytes: 0, roomKeys: 0, roomBytes: 0 };
  const src = SOURCES[lang];
  if (src.sections) {
    const dir = 'lang/content/' + lang + '/sections';
    for (const name of ls(src.sections, dir)) {
      if (!name.endsWith('.json')) continue;
      const data = show(src.sections, dir + '/' + name);
      if (!data.items || !data.items.length) continue;
      fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
      fs.writeFileSync(path.join(ROOT, dir, name), git(['show', src.sections + ':' + dir + '/' + name]));
      out.sections++;
    }
  }
  if (src.packs) {
    const dir = 'lang/content/' + lang + '/packs';
    for (const name of ls(src.packs, dir)) {
      if (!/^kunuz-pack-.*\.json$/.test(name) || !manifest.includes('quest-data/' + name.replace(/\.json$/, '.js'))) continue;
      const p = show(src.packs, dir + '/' + name);
      const slim = { schema: p.schema, lang: p.lang, pack: p.pack, slug: p.slug, stamp: p.stamp, source_sha8: p.source_sha8,
        cats: p.cats.map((c) => ({ id: c.id, name: c.name })),
        qs: p.qs.filter((q) => q.tag !== 'arabic-only').map((q) => ({ id: q.id, q: q.q, choices: q.choices, why: q.why, tag: q.tag })) };
      out.packBytes += write(dir + '/' + name, slim); out.packs++;
    }
  }
  const items = {}, cats = {}, keys = {};
  for (const branch of src.core || []) {
    const dir = 'lang/content/' + lang + '/core';
    for (const name of ls(branch, dir)) {
      if (name === 'categories.json') { Object.entries(show(branch, dir + '/' + name).cats).forEach(([k, v]) => { if (v.tr) cats[k] = v.tr; }); continue; }
      if (!/^core-p\d-\d+\.json$/.test(name)) continue;
      const part = show(branch, dir + '/' + name);
      if (part.source_sha8 !== sha8) throw new Error(name + ' is for another bank');
      for (const [id, t] of Object.entries(part.items)) {
        const q = rows.get(id);
        if (!q || q[2] === 0 || t.tag === 'arabic-only') continue;
        if (!Array.isArray(t.choices) || t.choices.length !== q[4].length || !t.q || t.choices.some((c) => !c) || new Set(t.choices).size !== t.choices.length) continue;
        // Bank explanations reach innerHTML in the Kunuz renderer.
        const why = String(t.why || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        items[id] = [t.q, t.choices, why];
        keys[hid(q[3])] = t.q;
        q[4].forEach((c, i) => { keys[hid(String(c))] = t.choices[i]; });
        if (why && q[6]) keys[hid(q[6])] = t.why;
      }
    }
  }
  box.DATA.cats.forEach((c) => { if (cats[c[0]]) keys[hid(c[1])] = cats[c[0]]; });
  if (Object.keys(items).length) {
    out.coreRecords = Object.keys(items).length;
    out.coreBytes = write('lang/content/' + lang + '/core.json', { schema: 'ezik-tr4/1', lang, bank: 'core', source_sha8: sha8, cats, items });
    out.roomKeys = Object.keys(keys).length;
    out.roomBytes = write('lang/content/' + lang + '/room-text.json', { schema: 'ezik-tr4/1', lang, keys });
  }
}
console.log(JSON.stringify(report, null, 1));
