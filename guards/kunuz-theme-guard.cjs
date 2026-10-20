/* Active Treasure Journey adapters: real bank pools, engine turns and scoped assets. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const context = { Math, Object, Array, Set, Map }; context.window = context; vm.createContext(context);
vm.runInContext(read('quest-data/kunuz-bank-3147.js'), context);
vm.runInContext(read('quest-data/kunuz-levels-3147.js'), context);
const baseRows = context.DATA.qs.length;
const manifest = new Function(read('quest-data/kunuz-packs-manifest.js') + ';return KUNUZ_PACKS;')();
for (const entry of manifest) {
  const body = read(entry.src), match = /^\s*KZV\.register\(\s*([\s\S]*)\s*\);?\s*$/.exec(body);
  assert.ok(match); const pack = JSON.parse(match[1]);
  const cats = new Map(context.DATA.cats.map((c, i) => [c[0], i]));
  for (const c of pack.cats) { cats.set(c.id, context.DATA.cats.length); context.DATA.cats.push([c.id, c.name, c.kind]); }
  for (const q of pack.qs) if (q.status === 'approved') {
    const row = [cats.get(q.cat), 0, 1, q.q, q.choices, q.answer, q.why, q.src.join(' · '), q.id]; row.kzPack = { level: q.level, vis: q.vis }; context.DATA.qs.push(row);
  }
}
vm.runInContext(read('quest-theme/model.js'), context);
vm.runInContext(read('quest-theme/icons.js'), context);
const model = context.KunuzModel;
let tests = 0;
function check(name, fn) { fn(); tests++; console.log('PASS J' + tests + ' ' + name); }
check('every playable bank/pack category gets its own card and fixed balanced reservation', () => {
  const eligible = model.categories().filter(c => c.count >= 6);
  assert.equal(eligible.length, 72);
  const all = new Set();
  for (const cat of eligible) {
    const pool = model.pool([cat.index], () => false, () => .33);
    assert.equal(pool.indices.length, 6); assert.equal(pool.slots.length, 6); assert.equal(pool.shortage.length, 0);
    pool.indices.forEach(i => { assert.equal(context.DATA.qs[i][0], cat.index); assert.notEqual(context.DATA.qs[i][2], 0); assert.equal(all.has(i), false); all.add(i); });
    for (let level = 1; level <= 3; level++) {
      const available = context.DATA.qs.filter((q, i) => q[0] === cat.index && q[2] !== 0 && model.level(i) === level).length;
      if (available >= 2) assert.equal(pool.slots.filter(s => s.actual === level).length >= 2, true);
    }
  }
  assert.equal(all.size, 72 * 6);
});
check('seen questions and held rows cannot be reserved; shortage refuses replay', () => {
  const first = model.pool([0, 1, 2], () => false, () => .4), seen = new Set(first.indices);
  const second = model.pool([0, 1, 2], i => seen.has(i), () => .4);
  second.indices.forEach(i => assert.equal(seen.has(i), false));
  assert.equal(model.pool([0], () => true).shortage[0], 0);
  assert.equal(context.DATA.qs.slice(0, baseRows).filter(q => q[2] === 0).length, 217);
});
check('nearest available level fills an exact pool without duplicates; the switch is removable', () => {
  const saved = context.DATA, classification = context.KUNUZ_LEVELS;
  try {
    context.DATA = { cats: [['fixture','fixture','general']], qs: Array.from({ length: 6 }, (_, i) => { const q = [0,0,1,'Q',['A','B','C','D'],0,'','',String(i)]; q.kzPack = { level: i < 4 ? 1 : 2 }; return q; }) };
    const pool = model.pool([0], () => false, () => .5);
    assert.equal(new Set(pool.indices).size, 6); assert.equal(pool.fallback[0].missing, 2);
    assert.ok(pool.slots.filter(s => s.desired === 2).every(s => s.actual === 2));
    assert.equal(pool.slots.find(s => s.desired === 3).actual, 1);
    context.LEVELS_EXPERIMENT = false; context.KUNUZ_LEVELS = undefined;
    context.DATA.qs.forEach(q => { delete q.kzPack; });
    assert.equal(model.pool([0], () => false).indices.length, 6);
  } finally { context.DATA = saved; context.KUNUZ_LEVELS = classification; context.LEVELS_EXPERIMENT = true; }
});
check('the native host board keeps award/turn/rank behavior with three through six categories', () => {
  const source = read('quest-board.html').match(/var BE=\(function\(\)\{[\s\S]*?\}\)\(\);/)[0]; vm.runInContext(source, context);
  for (let n = 3; n <= 6; n++) {
    const cats = Array.from({ length: n }, (_, i) => i), slots = model.pool(cats, () => false).slots;
    const g = model.board([{ n:'A', c:'#2482a4' }, { n:'B', c:'#cb785e' }], cats, slots);
    assert.equal(g.slots.length, n * 6); assert.equal(g.cats.length, n); assert.ok(g.slots.every(s => cats.includes(s.cat)));
    g.cur = { s:0, k:slots[0].index }; assert.equal(context.BE.award(g, 1), true); assert.equal(g.teams[1].score, 200); assert.equal(g.turn, 1);
    assert.equal(context.BE.award(g, 1), false); assert.equal(g.teams[1].score, 200);
    g.cur = { s:1, k:slots[1].index }; context.BE.award(g, -1); assert.equal(g.turn, 0); assert.equal(g.slots[1].by, -1);
  }
});
check('Hanna provisional point table has exactly the authorized values', () => {
  for (const value of [200,400,600]) {
    assert.equal(model.hannaDelta('bold', true, value), value); assert.equal(model.hannaDelta('bold', false, value), -value / 2);
    assert.equal(model.hannaDelta('safe', true, value), value / 2); assert.equal(model.hannaDelta('safe', false, value), 0);
  }
  assert.ok(Object.isFrozen(model.HANNA_POINTS.bold));
});
check('every category has a unique inanimate SVG, with no shared gradient identifiers', () => {
  const icons = model.categories().map(c => context.KunuzIcons.category(c.slug,c.index));
  const ids = icons.flatMap(s => [...s.matchAll(/id="([^"]*)"/g)].map(m => m[1])); assert.equal(new Set(ids).size, ids.length);
  const normalized = icons.map(s => s.replace(/(?:g|p)\d+/g,'gradient'));
  assert.equal(new Set(normalized).size, icons.length);
  icons.forEach(s => assert.doesNotMatch(s, /<image|<foreignObject|<text|https?:|<use|<script/));
});
check('the theme is scoped, locally hosted and uses the clean ocean only', () => {
  const css = read('quest-theme/theme.css'), js = read('quest-theme/journey.js');
  css.split('\n').filter(s => s.trim() && !s.startsWith('@')).forEach(line => assert.ok(line.startsWith('.ezik-treasure-theme'), line.slice(0,80)));
  assert.match(css, /font-family:KunuzPlex/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css + js, /fonts\.googleapis|fonts\.gstatic|assets\/ocean\.png|sfx\.wav/);
  assert.match(js, /global\.TE\.settle/); assert.match(js, /global\.BE\.award/); assert.match(js, /global\.WarEngine\.fightAnswer/); assert.match(js, /M\.diveNative\.answer/);
  assert.doesNotMatch(js, /renderAt\(/);
  for (const file of ['regular.ttf','bold.ttf','ocean-clean.png','islands.png']) assert.ok(fs.existsSync(path.join(root,'quest-theme/assets',file)));
  assert.ok(!fs.existsSync(path.join(root,'quest-theme/assets/ocean.png')));
});
check('hub and all five pages load the one scoped theme; worker/build metadata is intact', () => {
  for (const file of ['quest.html','quest-board.html','quest-test.html','quest-ghaws.html','quest-harb.html','hanna-laha/index.html']) {
    const html = read(file); assert.match(html,/quest-theme\/theme\.css/); assert.match(html,/quest-theme\/journey\.js/); assert.doesNotMatch(html,/fonts\.googleapis/);
  }
  assert.equal(JSON.parse(read('hanna-laha/build-info.json')).protocolVersion,4);
  assert.match(read('hanna-laha/index.html'),/wss:\/\/hanna-laha\.hl-worker\.workers\.dev/);
});
console.log('SUMMARY '+tests+'/'+tests+' pass');
