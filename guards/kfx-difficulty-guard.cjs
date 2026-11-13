'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = process.env.KFX_BASE || path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ctx = { DATA: { cats: [['fixture', 'Fixture', 'general']], qs: Array.from({length: 9}, (_, i) => Object.assign([0,0,1,'Q'+i,['a','b','c','d'],0,'','',String(i)], {kzPack:{level: i < 3 ? 1 : i < 6 ? 2 : 3}})) } }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('quest-theme/model.js'), ctx);
assert.equal(typeof ctx.KunuzModel.difficultyPool, 'function', 'one difficulty-aware reservation used by non-board games');
for (const [name, level] of [['easy',1],['medium',2],['hard',3]]) {
 const result = ctx.KunuzModel.difficultyPool([0], {has:()=>false,last:()=>0}, name, 4, ()=>.3);
 assert.equal(result.indices.length,4); assert.equal(new Set(result.indices).size,4);
 assert.ok(result.slots.slice(0,3).every(s=>s.actual===level));
 assert.equal(result.fallback[0].missing,1);
 assert.ok(result.slots.every(s=>s.pts===200));
}
const result = ctx.KunuzModel.difficultyPool([0], {has:i=>i<3,last:i=>i}, 'easy', 4, ()=>.3);
assert.ok(result.indices.every(i=>i>=3), 'unseen nearest must precede seen exact');
const exhausted = ctx.KunuzModel.difficultyPool([0], {has:()=>true,last:i=>i}, 'mixed', 6, ()=>.3);
assert.equal(exhausted.indices.length,6);assert.deepEqual([...exhausted.restarts],[0]);
const openEnded = ctx.KunuzModel.difficultyPool([0], {has:i=>i<3,last:i=>i}, 'hard', Infinity, ()=>.3);
assert.equal(openEnded.indices.length,6);assert.equal(openEnded.restarts.length,0);assert.ok(openEnded.indices.every(i=>i>=3));
const j=read('quest-theme/journey.js');assert.ok(!j.includes('const pointOrder = [600, 600, 400, 400, 200, 200]'));
assert.ok(j.includes("'hanna-category'"));
console.log('PASS KFX difficulty, shortage, history, fixed Hanna value and category flow');
