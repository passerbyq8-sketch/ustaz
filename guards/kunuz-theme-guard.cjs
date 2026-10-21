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
  assert.equal(eligible.length, 70);
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
  assert.equal(all.size, 70 * 6);
});
check('unseen questions precede oldest-seen replay; exhausted categories restart and held rows stay excluded', () => {
  const first = model.pool([0, 1, 2], () => false, () => .4), seen = new Set(first.indices);
  const second = model.pool([0, 1, 2], i => seen.has(i), () => .4);
  second.indices.forEach(i => assert.equal(seen.has(i), false));
  const exhausted = model.pool([0], () => true);
  assert.equal(exhausted.shortage.length, 0);
  assert.equal(exhausted.indices.length, 6);
  assert.deepEqual([...exhausted.restarts], [0]);
  exhausted.indices.forEach(i => { assert.equal(context.DATA.qs[i][0], 0); assert.notEqual(context.DATA.qs[i][2], 0); });
  const partial = model.pool([0], { has: i => i !== first.indices[0], last: i => -i }, () => .4);
  assert.equal(partial.indices[0], first.indices[0]);
  const oldest = context.DATA.qs.map((_, i) => i).filter(i => model.live(i) && context.DATA.qs[i][0] === 0 && i !== first.indices[0]).sort((a, b) => b - a).slice(0, 5);
  assert.deepEqual([...partial.indices.slice(1)], [...oldest]);
  assert.equal(new Set(partial.indices).size, 6);
  assert.equal(context.DATA.qs.slice(0, baseRows).filter(q => q[2] === 0).length, 603);
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
  const slugs = [...model.categories().map(c => c.slug), 'landmark-draw', 'occasions-calendar'];
  assert.equal(slugs.length, 72); // Includes the defined drawings for main's disabled packs.
  const icons = slugs.map(slug => context.KunuzIcons.category(slug));
  const ids = icons.flatMap(s => [...s.matchAll(/id="([^"]*)"/g)].map(m => m[1])); assert.equal(new Set(ids).size, ids.length);
  const normalized = icons.map(s => s.replace(/<defs>[\s\S]*?<\/defs>/g,'').replace(/(?:g|p)\d+/g,'gradient'));
  assert.equal(new Set(normalized).size, icons.length);
  assert.doesNotMatch(read('quest-theme/icons.js'), /categoryKinds|padStart\(7|const seal/);
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
check('offline caching has only Kunuz scopes and never intercepts Ezik pages or the room server', () => {
  const source = read('quest-sw.js'), page = read('quest-theme/journey.js'), handlers = {};
  assert.match(page, /for \(const scope of \['\/quest', '\/hanna-laha\/'\]\)/);
  assert.doesNotMatch(page, /scope:\s*['"]\/['"]/);
  assert.match(source, /key\.startsWith\('kunuz-treasure-'\)/);
  assert.match(source, /const VERSION = '20261021-room1'/);
  assert.match(source, /const DATABASE = DATABASE_PREFIX \+ VERSION/);
  assert.match(source, /entry\.name\?\.startsWith\(DATABASE_PREFIX\)/);
  assert.doesNotMatch(source, /caches\.open/);
  const worker = {
    URL, Request, Response, Set, Promise,
    self: { location: { origin:'https://preview.example' }, navigator: { onLine:false }, addEventListener:(name,fn)=>{handlers[name]=fn} },
    importScripts:()=>{},
    caches: { open:async()=>({match:async()=>new Response('cached'),put:async()=>{}}) }
  };
  vm.createContext(worker); vm.runInContext(source,worker);
  for (const url of ['https://preview.example/','https://preview.example/index.html','https://preview.example/app.js','https://preview.example/api/report','https://hanna-laha.hl-worker.workers.dev/api/categories']) {
    let intercepted = false; handlers.fetch({request:new Request(url),respondWith:()=>{intercepted=true}}); assert.equal(intercepted,false,url);
  }
  let intercepted = false; handlers.fetch({request:new Request('https://preview.example/quest.html'),respondWith:p=>{intercepted=true;p.catch(()=>{})}}); assert.equal(intercepted,true);
  assert.equal(vm.runInContext('SHELL.includes("/index.html") || SHELL.includes("/")',worker),false);
});
check('all first-paint bootstraps and font preloads are identical; Hanna CSP authorizes exactly that inline script', () => {
  const crypto = require('node:crypto'), pages = ['quest.html','quest-board.html','quest-test.html','quest-ghaws.html','quest-harb.html','hanna-laha/index.html'];
  const scripts = [];
  for (const file of pages) {
    const html = read(file).replace(/\r\n/g,'\n'), code = html.match(/<script>([\s\S]*?)<\/script>/)[1]; scripts.push(code);
    assert.ok(html.indexOf('quest-theme/theme.css?v=20261021-room1') < html.indexOf('<body>'));
    assert.equal((html.match(/as="font" type="font\/ttf" crossorigin/g) || []).length, 2);
    assert.match(code, /setTimeout\(fallback, 4000\)/); assert.match(code,/img\.decode\(\)/);
    assert.match(code, /console\.warn/); assert.match(code, /clearTimeout\(timer\)/);
    assert.match(code, /getPropertyValue\('--journey-gold'\)/);
    const critical = html.match(/<style data-kunuz-first-paint>([\s\S]*?)<\/style>/)[1];
    assert.match(critical, /kunuz-theme-pending body>[^}]*display:none!important/);
    if (file.startsWith('hanna')) {
      assert.ok(html.includes("'sha256-" + crypto.createHash('sha256').update(code).digest('base64') + "'"));
      assert.ok(html.includes("'sha256-" + crypto.createHash('sha256').update(critical).digest('base64') + "'"));
    }
  }
  assert.equal(new Set(scripts).size, 1);
  assert.doesNotMatch(read('quest-theme/journey.js') + read('quest-sw.js'), /createObjectURL|revokeObjectURL/);
});
async function workerProof() {
  const crypto = require('node:crypto'), handlers = {}, stored = new Map(), deleted = [], fetched = [];
  const encode = value => new TextEncoder().encode(value).buffer;
  const db = {
    objectStoreNames: { contains: () => true }, close() {},
    transaction() {
      const tx = { objectStore: () => ({
        get(key) { const req = {}; queueMicrotask(() => { req.result = stored.get(key); req.onsuccess(); }); return req; },
        put(value,key) { stored.set(key,value); queueMicrotask(() => tx.oncomplete()); }
      }) }; return tx;
    }
  };
  let offline = false;
  const worker = { URL, Request, Response, Headers, Set, Promise, Uint8Array, crypto: crypto.webcrypto,
    self: { location:{origin:'https://preview.example'}, navigator:{onLine:false}, addEventListener:(name,fn)=>{handlers[name]=fn}, clients:{claim:async()=>{}} },
    importScripts:()=>{},
    indexedDB: {
      open() { const req = {}; queueMicrotask(() => { req.result = db; req.onsuccess(); }); return req; },
      databases:async()=>[{name:'kunuz-treasure-assets-20261020-v1'},{name:'kunuz-treasure-assets-20261021-room1'},{name:'account-history'}],
      deleteDatabase(name) { deleted.push(name); const req = {}; queueMicrotask(() => req.onsuccess()); return req; }
    },
    caches: { keys:async()=>['kunuz-treasure-old','ezik-main'], delete:async name=>{deleted.push(name)} },
    fetch:async request=>{
      fetched.push({url:request.url,cache:request.cache}); if (offline) throw new Error('offline');
      const filename = new URL(request.url).pathname;
      const body = filename.endsWith('.html') ? '<html>v2</html>' : fs.readFileSync(path.join(root,filename));
      const response = new Response(body, { headers:{'content-type':filename.endsWith('.ttf')?'font/ttf':'text/html'} });
      Object.defineProperty(response,'url',{value:request.url}); return response;
    }
  };
  vm.createContext(worker); vm.runInContext(read('quest-sw.js'),worker);
  const integrity = JSON.parse(vm.runInContext('JSON.stringify(CRITICAL_ASSETS)',worker));
  for (const [file,hash] of Object.entries(integrity)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash);
  async function fetchPage(url) { let result; handlers.fetch({request:new Request(url),respondWith:p=>{result=p}}); return result; }
  stored.set('/quest.html',{body:encode('<html>v1</html>'),status:200,headers:[]});
  assert.equal(await (await fetchPage('https://preview.example/quest.html')).text(),'<html>v2</html>');
  assert.equal(fetched[0].cache,'no-store');
  offline = true;
  assert.equal(await (await fetchPage('https://preview.example/quest.html')).text(),'<html>v2</html>');
  offline = false;
  const key = '/quest-theme/assets/regular.ttf?v=20261021-room1';
  stored.set(key,{body:encode('broken font'),status:200,headers:[['content-type','text/html']]});
  const font = await fetchPage('https://preview.example' + key);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(await font.arrayBuffer())).digest('hex'),integrity['/quest-theme/assets/regular.ttf']);
  const networkCount = fetched.length;
  const cached = await fetchPage('https://preview.example' + key);
  assert.equal(cached.headers.get('content-type'),'font/ttf'); assert.equal(fetched.length,networkCount);
  let activation; handlers.activate({waitUntil:p=>{activation=p}}); await activation;
  assert.deepEqual(deleted,['kunuz-treasure-old','kunuz-treasure-assets-20261020-v1']);
}
workerProof().then(() => { tests++; console.log('PASS J'+tests+' network-first update, offline latest HTML, versioned verified font recovery and Kunuz-only cleanup'); console.log('SUMMARY '+tests+'/'+tests+' pass'); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
