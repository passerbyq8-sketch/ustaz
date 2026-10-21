/* Real Chromium acceptance for the active themed screens, including complete games. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.KUNUZ_PLAYWRIGHT_MODULE || '../.vercel/theme-tools/node_modules/playwright');
const base = process.env.KUNUZ_PREVIEW_URL || 'http://127.0.0.1:43817';
const out = process.env.KUNUZ_SHOTS || 'C:/Users/passe/projects/quest-review/sessions/kunuz-theme-shots-2026-10-20';
const onlyWidth = Number(process.argv.find(a => /^--width=/.test(a))?.split('=')[1]);
const reduced = process.argv.includes('--reduced');
const onlyGame = process.argv.find(a=>a.startsWith('--game='))?.split('=')[1];
const variants = onlyWidth ? [[onlyWidth, ({360:800,390:844,430:932})[onlyWidth]]] : [[390,844],[360,800],[430,932]];
const routes = { board:'quest-board.html', test:'quest-test.html', hanna:'hanna-laha/', ghaws:'quest-ghaws.html', harb:'quest-harb.html' };
fs.mkdirSync(out,{recursive:true});
const record={base,reduced,startedAt:new Date().toISOString(),runs:[],errors:[],failedRequests:[],badResponses:[],screenshots:[]};
const evidenceFile=()=>path.join(out,'browser-'+(onlyWidth||'all')+(reduced?'-reduced':'')+(onlyGame?'-'+onlyGame:'')+'.json');
let page, width, label;
async function state(){return page.evaluate(()=>{const m=KunuzJourney.state;return {stage:m.stage,step:m.step,error:m.error,turn:m.g?.turn,question:m.question?{index:m.question.index,actor:m.question.actor,activeTeam:m.question.activeTeam,shown:m.settings.options==='shown'||m.question.showTeams.has(m.question.activeTeam),answerRevealed:m.question.answerRevealed,settled:m.question.settled,confidence:m.question.confidence,beat:m.question.beat,submissions:Object.keys(m.question.submissions).length}:null,teams:m.teams.map(t=>({n:t.n,score:t.score,shows:t.shows})),played:m.slots.filter(s=>s.used).length,slots:m.slots.length,pool:m.pool.length,used:[...m.used]}})}
async function click(selector,options={}){
 const target=typeof selector==='string'?page.locator(selector).first():selector;
 await target.scrollIntoViewIfNeeded();
 await page.waitForTimeout(235);
 await target.click(options);
}
async function shot(step){await page.waitForTimeout(reduced?10:700);const name=label+'-'+step+'-'+width+(reduced?'-reduced':'')+'.png';await page.screenshot({path:path.join(out,name),fullPage:true});record.screenshots.push(name)}
async function layout(){
 const x=await page.evaluate(()=>{const modal=document.querySelector('.j-modal:not(.j-dialog)'),rect=modal?.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,modal:rect?{top:rect.top,left:rect.left,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight}:null,clipped:[...document.querySelectorAll('.journey-app h1,.journey-app h2,.j-category-middle h3,.j-cat-pick b')].filter(el=>el.getBoundingClientRect().width>0&&el.scrollWidth>el.clientWidth+2).map(el=>el.textContent)}});
 assert.equal(x.overflow,false,label+' horizontal overflow');assert.deepEqual(x.clipped,[],label+' clipped names');
 if(x.modal){assert.ok(Math.abs(x.modal.top)<2&&Math.abs(x.modal.left)<2,label+' question modal escaped the viewport');assert.equal(Math.round(x.modal.width),x.modal.viewportWidth);assert.equal(Math.round(x.modal.height),x.modal.viewportHeight)}
}
async function setup(game,context){
 label=game;
 await page.goto(base+'/quest.html');await page.waitForFunction(()=>window.KunuzJourney?.state.ready);await layout();if(game==='board')await shot('hub');
 await click(page.locator('a[href="/'+routes[game]+'"]').filter({visible:true}).first());
 await page.waitForFunction(()=>window.KunuzJourney?.state.ready,null,{timeout:60000});
 if(await page.locator('[data-action="single-device"]').count())await click('[data-action="single-device"]');
 await page.waitForFunction(()=>window.KunuzJourney?.state.ready&&KunuzJourney.state.stage==='categories',{timeout:60000});
 assert.equal(await page.locator('.j-cat-pick').count(),70);assert.equal(await page.locator('[data-action="next-setup"]').isDisabled(),true);
 for(let i=0;i<3;i++)await click(page.locator('.j-cat-pick').nth(i));
 assert.equal(await page.locator('[data-action="next-setup"]').isDisabled(),false);await shot('categories-three');
 for(let i=3;i<6;i++)await click(page.locator('.j-cat-pick').nth(i));
 assert.equal(await page.locator('.j-cat-pick').nth(6).isDisabled(),true);
 // A real seventh tap is blocked by the disabled control and cannot change selection.
 const box=await page.locator('.j-cat-pick').nth(6).boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 assert.equal(await page.evaluate(()=>KunuzJourney.state.cats.length),6);await shot('categories-six');
 await click('[data-action="next-setup"]');
 await click('[data-field="options"][data-value="hidden"]');
 await page.locator('[data-input="reveals"]').fill('2');
 await click('[data-field="time"][data-value="custom"]');
 await page.locator('[data-input="customTime"]').fill('25');
 await layout();await shot('settings');
 await click('[data-action="start"]');await page.waitForFunction(()=>KunuzJourney.state.running);
 const config=await page.evaluate(()=>({options:KunuzJourney.state.settings.options,reveals:KunuzJourney.state.settings.reveals,time:KunuzJourney.state.settings.customTime,slots:KunuzJourney.state.slots.length,perCategory:KunuzJourney.state.cats.map(c=>KunuzJourney.state.slots.filter(s=>s.cat===c).length),fallback:KunuzJourney.state.fallback}));
 assert.equal(config.options,'hidden');assert.equal(config.reveals,2);assert.equal(config.time,25);assert.deepEqual(config.perCategory,[6,6,6,6,6,6]);
 await shot('play');return config;
}
async function correctIndex(){return page.evaluate(()=>DATA.qs[KunuzJourney.state.question.index][5])}
async function revealOptions(){const s=await state();const team=s.question.activeTeam??s.question.actor;const credit=s.teams[team].shows;if(credit>0){await click('[data-action="show-options"]');const after=await state();assert.equal(after.teams[team].shows,credit-1);after.teams.forEach((t,i)=>{if(i!==team)assert.equal(t.shows,s.teams[i].shows)});return true}return false}
async function answerSelf(right,kind){
 const s=await state();if(await revealOptions()){
  const correct=await correctIndex(),answer=right?correct:(correct+1)%4;
  if(kind==='test'&&s.played===0){const before=await state();await click('[data-answer="'+((correct+1)%4)+'"]');assert.deepEqual((await state()).teams,before.teams);await click('[data-answer="'+answer+'"]');}
  else await click('[data-answer="'+answer+'"]');
  if(kind==='test')await click('[data-action="confirm-answer"]');
 } else {await click('[data-action="reveal-answer"]');await click('[data-action="'+(right?'judge-yes':'judge-no')+'"]')}
}
async function playBoard(game){
 const seen=new Set();let count=0;
 while((await state()).stage!=='results'){
  assert.ok(count<40,'board did not terminate');
  await click(page.locator('.j-point:not(:disabled)').first());
  await layout();
  const before=await state(),index=before.question.index;assert.equal(seen.has(index),false);seen.add(index);
  assert.equal(await page.evaluate(()=>seenHas(KunuzJourney.state.question.index)),true);
  if(count===0)await shot('question');
  if(game==='board'){
   await revealOptions();await click('[data-action="reveal-answer"]');if(count===0)await shot('reveal');
   const winner=count%5===0?-1:(before.turn+1)%before.teams.length;
   const value=await page.evaluate(()=>KunuzJourney.state.slots[KunuzJourney.state.question.slotIndex].pts);
   await click('[data-action="award"][data-team="'+winner+'"]');
   const after=await state();after.teams.forEach((t,i)=>assert.equal(t.score,before.teams[i].score+(i===winner?value:0)));
  }else{
   const value=await page.evaluate(()=>KunuzJourney.state.slots[KunuzJourney.state.question.slotIndex].pts),right=count%5!==2;
   await answerSelf(right,'test');const locked=await state();assert.equal(locked.question.settled,true);
   assert.equal(locked.teams[before.turn].score,before.teams[before.turn].score+(right?value:0));
   await page.waitForTimeout(400);assert.equal((await state()).question.index,index,'quiz auto-advanced');
   if(count===0)await shot('reveal');await click('[data-action="question-next"]');
  }
  count++;await layout();
 }
 assert.equal(count,36);await shot('results');return{tiles:count,distinct:seen.size,final:await state()};
}
async function playHanna(){
 const seen=new Set();let count=0;
 while((await state()).stage!=='results'){
  assert.ok(count<40);await click(page.locator('.j-point:not(:disabled)').first());
  const before=await state(),index=before.question.index;assert.equal(seen.has(index),false);seen.add(index);
  const value=await page.evaluate(()=>KunuzJourney.state.slots[KunuzJourney.state.question.slotIndex].pts);
  if(count===0)await shot('question');
  const expected=before.teams.map(()=>0);
  for(let response=0;response<before.teams.length;response++){
   const s=await state(),team=s.question.activeTeam,mode=team===0?'bold':'safe',right=team===0?count%7!==2:count%2===0;
   expected[team]=right?value*(mode==='bold'?1:.5):mode==='bold'?-value/2:0;
   await click('[data-action="confidence"][data-mode="'+mode+'"]');
   if(await revealOptions()){
    const correct=await correctIndex();await click('[data-answer="'+(right?correct:(correct+1)%4)+'"]');await click('[data-action="confirm-answer"]');
   }else await click('[data-action="hanna-manual"]');
  }
  assert.equal((await state()).question.beat,'confidence');assert.equal((await state()).question.submissions,before.teams.length);
  await click('[data-action="hanna-reveal"]');
  for(let team=0;team<before.teams.length;team++){
   const pending=page.locator('[data-action="hanna-judge"][data-team="'+team+'"]');
   if(await pending.count())await click('[data-action="hanna-judge"][data-team="'+team+'"][data-right="'+(expected[team]>0)+'"]');
  }
  const after=await state();after.teams.forEach((t,i)=>assert.equal(t.score,before.teams[i].score+expected[i]));
  if(count===0)await shot('reveal');await click('[data-action="question-next"]');count++;
 }
 assert.equal(count,36);await shot('results');return{tiles:count,distinct:seen.size,final:await state()};
}
async function playDive(){
 let questions=0;const seen=new Set();
 while((await state()).stage!=='results'){
  const s=await state();if(s.stage==='handover'){await click('[data-action="dive-begin"]');continue}
  if(!s.question){await click('[data-action="shell"]');questions++;const q=(await state()).question;assert.equal(seen.has(q.index),false);seen.add(q.index);if(questions===1)await shot('question')}
  await answerSelf(true,'ghaws');if(questions===1)await shot('reveal');await click('[data-action="dive-next"]');assert.ok(questions<=30);
 }
 assert.equal(questions,10);await shot('results');
 await click('[data-action="again"]');await click('[data-action="next-setup"]');await click('[data-action="start"]');await click('[data-action="shell"]');await answerSelf(true,'ghaws');await click('[data-action="dive-bank"]');
 assert.equal((await state()).stage,'results');assert.equal(await page.evaluate(()=>KunuzJourney.state.result.rows[0].score),1);await shot('exit-results');
 return{fullDiveQuestions:questions,distinct:seen.size,bankedExit:true,final:await state()};
}
async function warState(){return page.evaluate(()=>{const g=KunuzJourney.state.g;return {phase:g.phase,turn:g.turn,turnNo:g.turnNo,pool:g.pool,own:{...g.own},ban:{...g.ban},base:g.base,moveTgt:g.moveTgt,moveLeft:g.moveLeft,busy:g.busy,links:WarEngine.LINKS,dead:SLOTS.map((_,i)=>WarEngine.isDead(g,i)),flags:WarEngine.totalFlags(g)}})}
async function playWar(){
 let questions=0,captures=0,turns=0,cycles=0,shownQuestion=false,flags,initialHandoffs=0;
 while((await state()).stage!=='results'){
  assert.ok(cycles++<240,'war did not terminate');const s=await state();let w=await warState();turns=Math.max(turns,w.turnNo);
  if(flags===undefined&&w.phase!=='deploy')flags=w.flags;
  if(w.phase==='deploy'){
   // Plan both legal deployments together: fortify the opening attack's source,
   // and leave its enemy target at the native single-guard strength. Fortifying
   // both ends can exhaust a category before a capture is possible.
   const opening=w.links.flatMap(([a,b])=>[[a,b],[b,a]]).find(([a,b])=>w.own[a]===0&&w.own[b]!==0);
   const k=w.turn===0?opening[0]:Object.keys(w.own).map(Number).find(i=>w.own[i]===w.turn&&i!==opening[1]);
   while((await warState()).pool>0)await click('[data-island="'+k+'"]');await click('[data-action="war-next"]');continue;
  }
  if(s.stage==='war-pass'){await click('[data-action="war-defend"]');continue}
  if(s.question){
   const beforeOwn=JSON.stringify(w.own);if(!shownQuestion){await shot('question');shownQuestion=true}
   const defend=await page.evaluate(()=>KunuzJourney.state.question.defend);questions++;
   await answerSelf(!defend,'harb');const after=await warState();
   if(JSON.stringify(after.own)!==beforeOwn)captures++;
   if(questions===1)await shot('reveal');await click('[data-action="war-answer-next"]');continue;
  }
  if(s.stage==='war-result'){await shot(captures?'capture':'battle');await click('[data-action="war-result-next"]');continue}
  w=await warState();if(w.phase==='move'){
   const n=w.moveLeft;for(let i=0;i<n;i++)await click('[data-island="'+w.moveTgt+'"]');await click('[data-action="war-next"]');continue;
  }
  if(w.phase==='attack'){
   // Exercise the legal End Turn handoff twice before combat. Exhausting a small
   // category can legitimately satisfy the native two-seas rule on an early turn.
   if(initialHandoffs<2){initialHandoffs++;await click('[data-action="war-next"]');continue}
   const attack=w.links.flatMap(([a,b])=>[[a,b],[b,a]]).filter(([a,b])=>w.own[a]===w.turn&&w.ban[a]>=2&&w.own[b]!==w.turn&&!w.dead[a]&&!w.dead[b]).sort((a,b)=>w.ban[a[1]]-w.ban[b[1]])[0];
   if(attack){await click('[data-island="'+attack[0]+'"]');const ownBefore=JSON.stringify((await warState()).own);await click('[data-island="'+attack[1]+'"]');assert.equal(JSON.stringify((await warState()).own),ownBefore,'ownership changed without an answer')}
   else await click('[data-action="war-next"]');
  }
 }
 assert.ok(turns>=3,'fewer than three war turns');assert.ok(captures>=1,'no capture');assert.equal((await warState()).flags,flags);
 const outcome=await page.evaluate(()=>({reason:KunuzJourney.state.result.reason,winners:KunuzJourney.state.result.winnerIndices,nativeWinner:WarEngine.whoWon(KunuzJourney.state.g),rankLeader:WarEngine.leader(KunuzJourney.state.g)}));
 if(outcome.reason==='victory')assert.deepEqual(outcome.winners,[outcome.nativeWinner],'the native victory winner must override stop ranking');else assert.ok(outcome.winners.includes(outcome.rankLeader));
 await shot('results');return{questions,captures,turns,flags,outcome,final:await state()};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [w,h]of variants){width=w;const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference',...(process.env.KUNUZ_ACCESS_STATE?{storageState:process.env.KUNUZ_ACCESS_STATE}:{})});page=await context.newPage();
   await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
   await context.routeWebSocket('**/*',socket=>socket.close());
   page.on('pageerror',e=>record.errors.push({game:label,width,message:e.message}));page.on('console',m=>{if(m.type()==='error')record.errors.push({game:label,width,message:m.text()})});page.on('requestfailed',r=>record.failedRequests.push({game:label,width,url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)record.badResponses.push({game:label,width,url:r.url(),status:r.status()})});
   for(const game of (onlyGame?[onlyGame]:['board','test','hanna','ghaws','harb'])){
    if(game==='test'||game==='hanna'){
     const evidence=path.join(out,'own-identity-'+game+'-'+width);
     const own=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'games-own-identity-browser.cjs'),'--games','--game='+game,'--width='+width],{env:{...process.env,KUNUZ_IDENTITY_SHOTS:evidence},encoding:'utf8',maxBuffer:1<<20});
     assert.equal(own.status,0,own.stderr||own.stdout);process.stdout.write(own.stdout);
     record.runs.push({game,width,height:h,evidence});continue;
    }
    const config=await setup(game,context);const result=game==='board'||game==='test'?await playBoard(game):game==='hanna'?await playHanna():game==='ghaws'?await playDive():await playWar();
    const run={game,width,height:h,config,...result};record.runs.push(run);console.log('PASS '+game+' '+w+' '+JSON.stringify({tiles:result.tiles,questions:result.fullDiveQuestions||result.questions,turns:result.turns,captures:result.captures}));
    fs.writeFileSync(evidenceFile(),JSON.stringify(record,null,2));
   }
   await context.close();
  }
  assert.deepEqual(record.errors,[]);assert.deepEqual(record.failedRequests,[]);assert.deepEqual(record.badResponses,[]);record.finishedAt=new Date().toISOString();console.log('PASS zero console errors, failed requests and bad responses');
 }catch(error){record.failure=error.stack;console.error(error);if(page)await page.screenshot({path:path.join(out,'failure-'+label+'-'+width+'.png'),fullPage:true}).catch(()=>{});process.exitCode=1}
 finally{fs.writeFileSync(evidenceFile(),JSON.stringify(record,null,2));await browser.close()}
})();
