'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = process.env.KFX_BASE || path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const journey = read('quest-theme/journey.js');
assert.ok(!journey.includes("roomBank && game !== 'board' ? ''"), 'room expansion categories must not be suppressed');
assert.ok(!journey.includes('c.count >= Model.PER_CATEGORY'), 'every nonempty category must be offered');
assert.ok(!read('quest-theme/model.js').includes('const FALLBACK_CATEGORIES = Object.freeze(['), 'no duplicate hardcoded catalog');
assert.ok(read('tools/hanna-room-bank-sync.cjs').includes('loadKunuzBank'), 'room sync must consume all manifest packs');
(async()=>{
 const {open}=require('./kunuz-visual-world.cjs');
 const body=read('quest-data/kunuz-pack-emoji-quiz.js');
 const pack=JSON.parse(body.match(/KZV\.register\(([\s\S]*)\);?\s*$/)[1]);
 const w=await open('quest-harb.html',{moduleText:read('quest-visual.js'),pack});
 w.ctx.KunuzRoomCategorySupported=()=>true;w.ctx.G.roomCfg=true;w.ctx.G.cats=[0,1,53];w.ctx.drawCats();
 assert.ok(w.ctx.G.cats.includes(53),'native Harb handoff must preserve supported expansion selection');
 assert.ok(w.ctx.kzcGroups().some(g=>g.c.includes(53)),'native room picker must preserve supported expansion');
 console.log('PASS KFX category sources, picker and native room handoff');
})().catch(e=>{console.error(e);process.exitCode=1;});
