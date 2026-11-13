'use strict';

// Rebuild all room-bank artifacts from the same live manifest loader as the website.
// npm ci is required in both repositories. No deployment or upload occurs.
// Usage: node tools/hanna-room-bank-sync.cjs --hanna-root ../hanna-laha-kfx --version 20261113-kfx-1
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const BANK = 'quest-data/kunuz-bank-3147.js';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const parseBank = bytes => {
  const text = bytes.toString('utf8').trimEnd();
  assert.ok(text.startsWith('var DATA=') && text.endsWith(';'), 'Unexpected bank wrapper');
  const data = JSON.parse(text.slice(9, -1));
  assert.ok(Array.isArray(data.cats) && Array.isArray(data.qs), 'Missing cats/qs');
  return data;
};
// The quality merge preserves held text; match Journey's review flag as well as old tombstones.
const isHeld = row => row[2] === 0 || (row[3] === '' && Array.isArray(row[4]) && row[4].length === 0 && row[5] === -1);
const roomId = (cat, prompt) => cat + '-' + sha(cat + '\0mcq\0' + prompt.trim()).slice(0, 8);
function liveBank(data) {
  const ids = new Set();
  for (const row of data.qs) {
    assert.ok(Array.isArray(row) && typeof row[8] === 'string' && !ids.has(row[8]), 'Missing/duplicate app id');
    ids.add(row[8]);
    assert.ok(Number.isInteger(row[0]) && data.cats[row[0]], 'Unknown base category');
    if (isHeld(row)) continue;
    assert.ok(typeof row[3] === 'string' && row[3].trim(), 'Unexpected empty live prompt');
    assert.ok(Array.isArray(row[4]) && row[4].length >= 2 && row[4].every(x => typeof x === 'string' && x.trim()), 'Invalid live choices');
    assert.ok(Number.isInteger(row[5]) && row[5] >= 0 && row[5] < row[4].length, 'Invalid live answer');
  }
  return {cats: data.cats, qs: data.qs.filter(row => !isHeld(row))};
}
function git(...args) {
  return cp.execFileSync('git', ['--no-pager', ...args], {cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
}
function recoverHeld(data, ref) {
  const missing = new Set(data.qs.filter(isHeld).map(r => r[8]));
  const found = new Map();
  for (const commit of git('log', '--format=%H', ref, '--', BANK).toString().trim().split(/\s+/)) {
    if (!missing.size) break;
    const previous = parseBank(git('show', commit + ':' + BANK));
    for (const row of previous.qs) {
      if (!missing.has(row[8]) || isHeld(row) || !row[3]) continue;
      found.set(row[8], {appId: row[8], roomId: roomId(previous.cats[row[0]][0], row[3]), promptSha256: sha(row[3].trim())});
      missing.delete(row[8]);
    }
  }
  assert.equal(missing.size, 0, 'Could not recover original held rows from git history');
  return data.qs.filter(isHeld).map(r => found.get(r[8]));
}
async function sync(hanna, version = '20261113-kfx-1') {
  assert.match(version, /^\d{8}-[a-z0-9]+-\d+$/, 'Use a new dated questions version');
  const { loadKunuzBank } = require('./kunuz-bank.cjs');
  const source = await loadKunuzBank(ROOT);
  const save = (file, value) => fs.writeFileSync(path.join(hanna, file), value);
  const esbuild = require(path.join(hanna, 'node_modules/esbuild'));
  const built = esbuild.buildSync({entryPoints:[path.join(hanna,'packages/bank/src/build.ts')],bundle:true,platform:'node',format:'cjs',write:false});
  const mod={exports:{}}; new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
  const snapshot = {schema:'kunuz-' + version,categories:source.cats.map(c=>({id:c.slug,name:c.name,group:c.group})),questions:source.questions.map(q=>({id:q.row.kzPack?q.id:roomId(source.cats.find(c=>c.index===q.cat).slug,q.row[3]),cat:source.cats.find(c=>c.index===q.cat).slug,type:'mcq',q:q.row[3],choices:q.row[4],answer:q.row[5],why:q.row[6],src:q.row[7],level:q.level,visual:q.visual}))};
  const referenceFile='data/reference/kunuz-' + version + '.json',referenceBytes=JSON.stringify(snapshot);
  const referencePath = path.join(hanna, referenceFile);
  if (fs.existsSync(referencePath)) assert.equal(fs.readFileSync(referencePath,'utf8'), referenceBytes, 'Never rewrite an existing questions version; choose --version');
  fs.mkdirSync(path.join(hanna,'data/reference'),{recursive:true}); save(referenceFile,referenceBytes);
  const result=mod.exports.buildGameBank(snapshot,{ids:'source'});
  assert.equal(result.rejections.length,0,'shared bank fails room structural validation');
  const bank={...result.bank,qs:result.bank.qs.map((q,i)=>({...q,level:snapshot.questions[i].level,...(snapshot.questions[i].visual?{visual:snapshot.questions[i].visual}:{})}))};
  const bytes = JSON.stringify(bank), stamp = sha(bytes);
  save('apps/worker/src/generated/bank.txt', bytes);
  save('apps/worker/src/generated/bank-meta.ts', '// Generated from the shared Kunuz bank.\nexport const BANK_SHA256 = ' + JSON.stringify(stamp) + ';\nexport const BANK_SHA8 = ' + JSON.stringify(stamp.slice(0, 8)) + ';\n');
  save('apps/worker/src/generated/categories.ts', '// Generated from the shared Kunuz bank.\nexport const CATEGORIES = ' + JSON.stringify(bank.cats) + ' as const;\n');
  const boardFile = 'apps/worker/src/generated/points-board-bank.json';

  // Publish a fresh stamp: the current live website already has corrected rows.
  const board = { stamp: version + ':' + stamp.slice(0, 16), version, cats: source.cats.map(c => ({ index: c.index, slug: c.slug, name: c.name })), qs: source.questions.map(q => [q.index, q.id, q.cat, q.level, q.row[4].length, q.row[5]]) };
  save(boardFile, JSON.stringify(board, null, 2) + '\n');
  const held=recoverHeld(parseBank(fs.readFileSync(path.join(ROOT,BANK))), 'origin/main');
  const referenceSha=sha(referenceBytes);
  const lock={generatorVersion:'kunuz-shared/1',rule:'all live base and manifest rows',idMode:'source',sourcePath:referenceFile,sourceSha256:referenceSha,reference:{path:referenceFile,sha256:referenceSha},generatedSha256:stamp,generatedSize:Buffer.byteLength(bytes),counts:{accepted:bank.qs.length,byType:result.stats.byType,byCategory:result.stats.byCategory},rejectedCount:0};
  save('data/bank.lock.json',JSON.stringify(lock,null,2)+'\n');
  const categories=bank.cats.map(c=>({id:c.id,group:c.group,count:bank.qs.filter(q=>q.cat===c.id).length}));
  const reference={path:referenceFile,sha256:referenceSha,extractSha256:referenceSha,records:bank.qs.length,categories,recordHashes:bank.qs.map(q=>[q.id,sha(JSON.stringify([q.cat,q.prompt,q.options,q.answer,q.why||'',q.src||''])).slice(0,16)])};
  const classes={'broken':0,'in-game':bank.qs.length,'excluded':0,'removed':0,'superseded':0,'duplicate':0,'not-in-reference':0};
  const inventory={schema:'hl-bank-inventory/1',reference,stores:[{name:'versioned-shared-live-source',path:referenceFile,format:snapshot.schema,records:bank.qs.length,sha256:referenceSha,categories:categories.map(c=>({id:c.id,count:c.count})),classes,byCategory:Object.fromEntries(categories.map(c=>[c.id,{'in-game':c.count}])),notInReferenceIds:[]}],otherKinds:[]};
  save('data/bank-inventory.json',JSON.stringify(inventory,null,2)+'\n');
  const fixtures=[];
  for(const cats of [[0,1,2],[53,54,55],[0,53,69],source.cats.slice().sort((a,b)=>a.count-b.count).slice(0,3).map(c=>c.index)])for(const seenMode of [0,1,2])for(const difficulty of ['points','mixed']){
    const seed=123+fixtures.length;let state=seed;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const pool=source.model.pool(cats,{has:i=>seenMode===2||(seenMode===1&&i%2===0),last:i=>i+1},rnd);
    if(difficulty==='mixed')for(const cat of cats){const slots=pool.slots.filter(s=>s.cat===cat),indices=source.model.shuffle(slots.map(s=>s.index),rnd);slots.forEach((s,i)=>{s.index=indices[i];});}
    fixtures.push({cats,seed,seenMode,difficulty,slots:pool.slots.map(({index,cat,pts,desired})=>({index,cat,pts,desired})),restartCats:pool.restarts});
  }
  save('apps/worker/test-core/fixtures/points-board-parity.json',JSON.stringify({source:version,fixtures},null,2)+'\n');
  const record = { sourceSha256: sha(fs.readFileSync(path.join(ROOT,BANK))), referenceSha256: referenceSha, heldRows:held.length, held, version, source: 'tools/kunuz-bank.cjs (base + live manifest)', categories: bank.cats.length, liveRows: bank.qs.length, bankSha256: stamp };
  save('data/room-bank-sync.json', JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({version,categories:record.categories,liveRows:record.liveRows,bankSha256:stamp}));
  return record;
}
module.exports = {parseBank, isHeld, roomId, liveBank, recoverHeld, sync};
if (require.main === module) {
  const arg = (flag, fallback) => {const i = process.argv.indexOf(flag); return i < 0 ? fallback : process.argv[i + 1];};
  sync(path.resolve(arg('--hanna-root', path.join(ROOT, '../hanna-laha'))),arg('--version','20261113-kfx-1')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
