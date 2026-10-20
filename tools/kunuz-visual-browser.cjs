// Real Chromium measurement and a local-only fixture preview.
'use strict';
const fs=require('fs'),http=require('http'),path=require('path'),cp=require('child_process');
const {fixture,kinds}=require('../guards/fixtures/kunuz-visual.cjs');
const ROOT=path.join(__dirname,'..');
const EVIDENCE=process.env.KUNUZ_VISUAL_EVIDENCE||path.resolve(ROOT,'../quest-review/sessions/kunuz-visual-evidence-20261019');
const GAMES=['quest-ghaws.html','quest-harb.html','quest-test.html','quest-board.html'];
function playwright(){for(const p of [process.env.EZIK_PLAYWRIGHT,'playwright','C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright'].filter(Boolean))try{return require(p)}catch{}throw Error('Playwright is required for Chromium measurements')}
function server({baseline=false,demo=true,packs=false}={}){
  const requests=[];const s=http.createServer((req,res)=>{
    let url=new URL(req.url,'http://localhost').pathname.slice(1);if(!url)url='quest-test.html';requests.push(url);
    try{
      let bytes;
      if(demo&&url==='quest-visual.js')bytes=Buffer.from(fs.readFileSync(path.join(ROOT,url),'utf8').replace(/var PACKS_ENABLED=(?:true|false);/,'var PACKS_ENABLED=true;'));
      else if(demo&&!packs&&url==='quest-data/kunuz-packs-manifest.js')bytes=Buffer.from('var KUNUZ_PACKS=[{slug:"visual-demo",src:"quest-data/kunuz-pack-visual-demo.js"}];');
      else if(demo&&!packs&&url==='quest-data/kunuz-pack-visual-demo.js')bytes=Buffer.from('KZV.register('+JSON.stringify(fixture())+');');
      else if(demo&&!packs&&url==='quest-data/signs/calibration.webp')bytes=fs.readFileSync(path.join(ROOT,'guards/fixtures/kunuz-visual-calibration.webp'));
      else if(baseline&&(GAMES.includes(url)||url==='quest-levels.js'))bytes=cp.execFileSync('git',['show',(process.env.KUNUZ_BASELINE_REF||'77afb7df')+':'+url],{cwd:ROOT,maxBuffer:1<<24});
      else{const file=path.resolve(ROOT,url);if(!file.startsWith(ROOT+path.sep))throw Error('path');bytes=fs.readFileSync(file)}
      res.setHeader('Content-Type',url.endsWith('.html')?'text/html; charset=utf-8':url.endsWith('.js')?'text/javascript; charset=utf-8':url.endsWith('.css')?'text/css; charset=utf-8':url.endsWith('.webp')?'image/webp':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes);
    }catch(e){res.statusCode=404;res.end('missing')}
  });return {s,requests};
}
async function launch(){return playwright().chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio','--disable-dev-shm-usage']})}
async function render(page,game,kind){
  await page.evaluate(({game,kind})=>{
    const k=DATA.qs.findIndex(q=>q.kzPack&&q.kzPack.vis.kind===kind),q=DATA.qs[k],cats=DATA.cats.map((c,i)=>i).filter(i=>i>=53);
    // Each adapter calls the page's real question function, preserving its answer handlers.
    if(game==='quest-ghaws.html'){
      S.cats=cats;S.cap=18;S.breath=0;S.noOpts=false;startDive();S.pool=[k];S.shells=[q[0]];S.used={};openShell(q[0]);
    }else if(game==='quest-harb.html'){
      openCfg();G.cats=cats;G.fuse=0;G.shots=1;newWar();G.base=0;G.tgt=1;G.turn=0;G.busy=true;G.used={};DATA.qs.forEach((r,i)=>{if(i!==k)G.used[i]=1});startFight();askQ(G.players[0],0,q[0],'',false,function(){});
    }else if(game==='quest-test.html'){
      S.cats=[q[0]];S.total=18;S.timer=0;S.opts='shown';drawCats();document.getElementById('startBtn').onclick();G.used={};DATA.qs.forEach((r,i)=>{if(i!==k)G.used[i]=1});ask();
    }else{
      S.cats=[0,1,2,...cats];drawCats();document.getElementById('startBtn').onclick();G.used={};DATA.qs.forEach((r,i)=>{if(i!==k&&r[0]===q[0])G.used[i]=1});openQ(18+cats.indexOf(q[0])*6);
    }
    const qr=document.getElementById('qtext').getBoundingClientRect();window.__kvReserved={top:qr.top,height:document.getElementById('qvis').getBoundingClientRect().height};
  },{game,kind});
  if(kind==='map')await page.waitForSelector('#qvis svg');
  if(kind==='photo')await page.waitForFunction(()=>{const i=document.querySelector('#qvis img');return i&&i.complete&&i.naturalWidth>0});
}
async function answer(page,game){
  await page.evaluate(game=>{
    if(game==='quest-ghaws.html')reveal(S.cur);
    else if(game==='quest-harb.html'){const q=KZR.q;document.querySelector('#ops .opt[data-k="'+q[5]+'"]').onclick()}
    else if(game==='quest-test.html'){P.picked=cur()[5];confirmA()}
    else reveal();
  },game);
}
async function layout(page){return page.evaluate(()=>{
  const h=document.getElementById('qvis'),r=h.getBoundingClientRect(),qt=document.getElementById('qtext').getBoundingClientRect();
  const options=[...document.querySelectorAll('#opts .opt,#ops .opt')].filter(e=>e.getBoundingClientRect().width>0);
  const drawn=options.filter(e=>e.classList.contains('kzv-choice')).map(e=>{let r=e.getBoundingClientRect();return [r.width,r.height]});
  const label=h.getAttribute('aria-label'),all=[...h.querySelectorAll('*'),h].flatMap(e=>[...e.attributes].filter(a=>/^(aria-|title|alt)/.test(a.name)).map(a=>a.value));
  const action=[...document.querySelectorAll('#act button,#bankBtn')].filter(e=>!e.disabled&&e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect().bottom);
  const sampled=options.filter(e=>e.classList.contains('kzv-choice')).map(e=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor}});
  return {overflow:document.documentElement.scrollWidth>innerWidth,above:qt.top>=r.bottom-1,stage:[r.width,r.height],optionBottom:Math.max(...options.map(e=>e.getBoundingClientRect().bottom)),actionBottom:action.length?Math.max(...action):0,viewport:innerHeight,drawn,label,readable:all,sampled,reservedShift:window.__kvReserved?Math.abs(window.__kvReserved.top-qt.top):0};
})}
async function main(){
  fs.mkdirSync(EVIDENCE,{recursive:true});const baseline=process.argv.includes('--baseline'),demo=process.argv.includes('--demo');
  const {s,requests}=server({baseline,demo:!baseline,packs:demo});await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
  if(demo){console.log('Local NEW20 packs (preview only): '+url+'/quest-test.html');console.log('Also: /quest-ghaws.html, /quest-harb.html, /quest-board.html. Ctrl+C stops.');return}
  let browser;const results=[],errors=[];
  try{
    browser=await launch();
    // A synthetic calibration bitmap tests overlay placement; no sign content ships.
    if(!fs.existsSync(path.join(ROOT,'guards/fixtures/kunuz-visual-calibration.webp'))){const p=await browser.newPage();const data=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=480;c.height=200;let x=c.getContext('2d');x.fillStyle='#17497a';x.fillRect(0,0,480,200);x.strokeStyle='#fff';x.lineWidth=3;x.strokeRect(8,8,464,184);x.font='24px sans-serif';x.fillStyle='#fff';x.fillText('CALIBRATION',290,100);x.strokeRect(25,30,110,130);x.strokeRect(135,30,110,130);return c.toDataURL('image/webp')});fs.writeFileSync(path.join(ROOT,'guards/fixtures/kunuz-visual-calibration.webp'),Buffer.from(data.split(',')[1],'base64'));await p.close()}
    const sizes=[{width:360,height:640},{width:390,height:844},{width:1280,height:800}];
    for(const game of GAMES.filter(g=>!process.argv.includes('--landscape-only')||g==='quest-harb.html'))for(const size of [...(process.argv.includes('--landscape-only')?[]:sizes),...(!baseline&&game==='quest-harb.html'?[{width:640,height:360},{width:844,height:390}]:[])])for(const lang of ['ar','en'])for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:size,colorScheme:theme,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(game+': '+e.message));
      await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
      await page.addInitScript(lang=>{localStorage.setItem(['ezik','ui','lang','v1'].join('_'),lang);let state=19;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}},lang);
      await page.goto(url+'/'+game,{waitUntil:'load'});if(!baseline)await page.evaluate(()=>KZV.ready);
      await page.evaluate(({lang,theme})=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.dataset.theme=theme},{lang,theme});
      if(baseline){if(game.includes('ghaws')||game.includes('harb'))await page.evaluate(()=>openCfg());if(size.width===360&&lang==='ar'&&theme==='light')await page.screenshot({path:path.join(EVIDENCE,'before-'+game+'.png'),fullPage:true});results.push({game,...size,lang,theme,baseline:true});await context.close();continue}
      if(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/kunuz-geo.js'))))throw Error('Geography loaded before first map');
      for(const kind of kinds){
        // Reload for each kind to preserve the real no-repeat record and clean answer state.
        if(kind!==kinds[0]){await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'load'});await page.evaluate(()=>KZV.ready);await page.evaluate(({lang,theme})=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.dataset.theme=theme},{lang,theme})}
        const start=Date.now();await render(page,game,kind);const before=await layout(page);await answer(page,game);const after=await page.evaluate(()=>({revealed:document.getElementById('qvis').classList.contains('kzv-revealed'),maskHidden:!document.querySelector('.kzv-mask')||getComputedStyle(document.querySelector('.kzv-mask')).visibility==='hidden'}));
        results.push({game,...size,lang,theme,kind,...before,...after,ms:Date.now()-start});
        if(before.overflow||!before.above||before.drawn.some(([w,h])=>w<44||h<44)||before.optionBottom>before.viewport+1||before.reservedShift>1||!after.revealed)throw Error('Layout/reveal failure '+JSON.stringify(results.at(-1)));
        if(size.width===360&&lang==='ar'&&theme==='light')await page.screenshot({path:path.join(EVIDENCE,'after-'+game+'-'+kind+'.png'),fullPage:false});
      }
      await context.close();console.log(game+' '+size.width+'x'+size.height+' '+lang+' '+theme+' OK');
    }
    fs.writeFileSync(path.join(EVIDENCE,baseline?'browser-before.json':process.argv.includes('--landscape-only')?'browser-landscape.json':'browser-after.json'),JSON.stringify({results,errors,requests},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('BROWSER PASS states='+results.length+' errors='+errors.length);
  }finally{if(browser)await browser.close();s.close()}
}
module.exports={server,launch,render,answer,layout,GAMES,EVIDENCE};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
