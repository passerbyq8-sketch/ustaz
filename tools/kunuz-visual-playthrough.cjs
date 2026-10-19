// Complete real Chromium games, with a virtual clock instead of wall-clock waits.
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {server,launch,GAMES,EVIDENCE}=require('./kunuz-visual-browser.cjs');
const {invalidVisuals}=require('../guards/kunuz-visual-guard.cjs');
const {fixture}=require('../guards/fixtures/kunuz-visual.cjs');
(async()=>{
  const prod=process.argv.includes('--production');let srv,browser;const results=[],errors=[];
  try{
    let url='https://ezik.app';if(!prod){srv=server({demo:true}).s;await new Promise(r=>srv.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+srv.address().port}
    browser=await launch();
    for(const game of GAMES){
      const context=await browser.newContext({viewport:{width:360,height:640},reducedMotion:'reduce'}),page=await context.newPage();await page.clock.install();
      page.on('pageerror',e=>errors.push(game+': '+e.message));await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
      await page.goto(url+'/'+game,{waitUntil:'load'});await page.evaluate(()=>KZV.ready);
      // Native XML parser and DOM, independently of the small gate DOM adapter.
      if(!prod&&game==='quest-test.html'){
        const verdict=await page.evaluate(({bad,q})=>bad.every(v=>KZV.validateVisual(v,q)===false),{bad:invalidVisuals(),q:fixture().qs[0]});assert.equal(verdict,true,'native sanitizer');
      }
      await page.evaluate(({game,prod})=>{
        window.__played=[];window.__wars=0;window.__last='';window.__cats=prod?[0,1,2]:[53,54,55];
        if(game==='quest-ghaws.html'){S.cats=__cats;S.cap=prod?6:18;S.breath=0;S.noOpts=false;startDive()}
        else if(game==='quest-test.html'){S.cats=__cats;S.total=prod?6:18;S.timer=0;S.opts='shown';drawCats();document.getElementById('startBtn').onclick()}
        else if(game==='quest-board.html'){S.cats=prod?[0,1,2,3,4,5]:[0,1,2,...__cats];drawCats();document.getElementById('startBtn').onclick()}
        else{openCfg();G.cats=__cats;G.fuse=0;G.shots=1;G.winRule=9;newWar();__wars++}
      },{game,prod});
      let done=false,steps=0;
      while(!done&&++steps<12000){
        const action=await page.evaluate(({game,prod})=>{
          function shown(id){const e=document.getElementById(id);return e&&!e.classList.contains('hidden')}
          function record(q){if(__last===q[8])return;__last=q[8];__played.push({id:q[8],kind:q.kzPack&&q.kzPack.vis&&q.kzPack.vis.kind||'bank'});if(prod&&q.kzPack)throw Error('production drew a supplemental pack')}
          if(game==='quest-ghaws.html'){
            if(shown('end'))return 'done';if(S.cur&&!S.lock){record(S.cur);document.querySelector('#opts .opt[data-k="'+S.cur[5]+'"]').onclick();return 'wait'}if(S.shells&&S.shells.length)openShell(S.shells[0]);return 'step';
          }
          if(game==='quest-test.html'){
            if(shown('end'))return 'done';if(P.phase==='pick'){ask();return 'step'}if(P.phase==='q'&&!P.locked){const q=cur();record(q);document.querySelector('#opts .opt[data-k="'+q[5]+'"]').onclick();document.getElementById('confBtn').onclick();return 'step'}if(P.locked)document.getElementById('nextBtn').onclick();return 'step';
          }
          if(game==='quest-board.html'){
            if(shown('end'))return 'done';if(!P.open){const slot=G.slots.findIndex(s=>!s.used);openQ(slot);return 'step'}if(!P.revealed){record(cur());reveal();return 'step'}give(0);return 'step';
          }
          if(shown('win')){if(prod||__played.filter(q=>q.kind!=='bank').length>=18)return 'done';if(__wars>=12)throw Error('fixture wars did not drain');openCfg();G.cats=__cats;newWar();__wars++;return 'step'}
          if(G.busy){
            if(!document.getElementById('pg').disabled){document.getElementById('pg').onclick();return 'step'}
            if(KZR.q&&!T.lock&&!document.getElementById('slab').classList.contains('flip')){const q=KZR.q,buttons=[...document.querySelectorAll('#ops .opt[data-k]')];if(buttons.length){record(q);const want=__played.length%2?q[5]:(q[5]+1)%4;buttons.find(b=>+b.dataset.k===want).onclick()}}
            return 'wait';
          }
          const isles=Array.from({length:12},(_,i)=>i);
          if(G.phase==='deploy'){if(G.pool>0)tap(isles.find(i=>G.own[i]===G.turn));else document.getElementById('nextBtn').onclick();return 'step'}
          if(G.phase==='move'){document.getElementById('nextBtn').onclick();return 'step'}
          if(G.phase==='attack'){
            if(G.base===null){const b=isles.find(i=>G.own[i]===G.turn&&G.ban[i]>=2&&!isDead(i)&&isles.some(j=>G.own[j]!==G.turn&&adj(i,j)&&!isDead(j)));if(b!==undefined)tap(b);else document.getElementById('nextBtn').onclick()}
            else{const target=isles.find(i=>canHit(i));if(target!==undefined)tap(target);else document.getElementById('nextBtn').onclick()}
          }return 'step';
        },{game,prod});
        done=action==='done';if(!done)await page.clock.fastForward(action==='wait'?4000:400);
      }
      assert.equal(done,true,game+' unfinished');const played=await page.evaluate(()=>__played);assert.equal(new Set(played.map(q=>q.id)).size,played.length,'repeated question');
      if(!prod)for(const kind of ['map','emoji','svg','silhouette','pattern','photo'])assert.equal(played.filter(q=>q.kind===kind).length,3,game+' '+kind);
      results.push({game,complete:true,steps,questions:played.length,kinds:played.reduce((a,q)=>(a[q.kind]=(a[q.kind]||0)+1,a),{}),jsErrors:errors.length});console.log(JSON.stringify(results.at(-1)));await context.close();
    }
    assert.equal(errors.length,0,errors.join('\n'));fs.mkdirSync(EVIDENCE,{recursive:true});fs.writeFileSync(path.join(EVIDENCE,prod?'production-playthrough.json':'chromium-playthrough.json'),JSON.stringify({results,errors},null,2));console.log('COMPLETE GAMES PASS '+results.length+'/4');
  }finally{if(browser)await browser.close();if(srv)srv.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
