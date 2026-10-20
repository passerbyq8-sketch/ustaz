// Kunuz supplemental packs: real game scripts, shared renderer, hostile data,
// stable bank history, local loaders, and mutations. No browser stays open here.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {open,store,read,bank}=require('./kunuz-visual-world.cjs');
const {fixture,stamp,cell,kinds}=require('./fixtures/kunuz-visual.cjs');
const {readable}=require('./kunuz-sim/readable.cjs');
const games=['quest-ghaws.html','quest-harb.html','quest-test.html','quest-board.html'];
const mod=read('quest-visual.js'),clone=x=>JSON.parse(JSON.stringify(x));
const results=[];
async function test(name,fn){try{const info=await fn();results.push(true);console.log('PASS '+name+(info?' :: '+info:''))}catch(e){results.push(false);console.log('FAIL '+name+' :: '+e.stack)}}
function noErrors(w){assert.equal(w.errors.length,0,w.errors.map(e=>e.stack).join('\n'))}
function invalidVisuals(){
  const bad=[];
  for(const tag of ['script','style','foreignObject','image','use','a','animate','text'])bad.push({kind:'svg',svg:'<svg xmlns="http://www.w3.org/2000/svg"><'+tag+'/></svg>'});
  for(const attr of ['onload="alert(1)"','onclick="alert(1)"','onerror="alert(1)"','href="x"','xlink:href="x"','style="color:red"','fill="url(https://example.org)"','stroke="javascript:alert(1)"','data-x="x"'])bad.push({kind:'svg',svg:'<svg xmlns="http://www.w3.org/2000/svg"><path '+attr+'/></svg>'});
  bad.push({kind:'svg',svg:'<svg>'+(' '.repeat(4096))+'</svg>'},{kind:'svg',svg:'<!DOCTYPE svg><svg/>'},{kind:'svg',svg:'<svg>&amp;</svg>'},{kind:'svg',svg:'<svg xmlns="http://example.org"><path/></svg>'});
  for(const svg of [
    '<svg><path d="M0 0H1" clip-path="url(https://example.org/#a)"/></svg>',
    '<svg><path d="M0 0H1" clip-path="url(#missing)"/></svg>',
    '<svg><defs><clipPath id="a"><path d="M0 0H1" clip-path="url(#a)"/></clipPath></defs></svg>',
    '<svg><defs><clipPath id="a"/><clipPath id="a"/></defs></svg>',
    '<svg><clipPath id="a"><path d="M0 0H1"/></clipPath></svg>',
    '<svg><defs><clipPath id="a"><use href="#a"/></clipPath></defs></svg>',
    '<svg><defs><clipPath id="a" onload="alert(1)"/></defs></svg>'
  ])bad.push({kind:'svg',svg});
  for(const shape of ['face','human','<img>'])bad.push({kind:'pattern',seq:Array(4).fill(cell(shape)),opts:Array(4).fill(cell('square'))});
  for(const change of [{rot:360},{rot:1},{size:0},{size:4},{count:5},{fill:'url(x)'},{count:NaN}])bad.push({kind:'pattern',seq:Array(4).fill({...cell('square'),...change}),opts:Array(4).fill(cell('square'))});
  for(const hit of ['missing','Taiwan','Western Sahara','Kosovo','Northern Cyprus','Somaliland','Crimea','Siachen Glacier','__proto__'])bad.push({kind:'map',view:'world',hit:[hit]});
  bad.push({kind:'map',view:'bad',hit:['Egypt']},{kind:'map',view:'mena',hit:['Egypt','Egypt']});
  for(const src of ['https://example.org/x.webp','//x/x.webp','quest-data/signs/../x.webp','quest-data/signs/%2e%2e/x.webp','quest-data/signs/x.webp?q=1','quest-data/signs/x.svg','quest-data/signs/x.webp#x'])bad.push({kind:'photo',src});
  for(const mask of [{x:80,y:0,w:21,h:10},{x:0,y:-1,w:10,h:10},{x:0,y:0,w:0,h:10},{x:0,y:0,w:10,h:Infinity}])bad.push({kind:'photo',src:'quest-data/signs/x.webp',mask});
  for(const seq of ['<img onerror=alert(1)>','<script>alert(1)</script>','🐈','😀','👁️','🧸','🧑‍💻'])bad.push({kind:'emoji',seq,basis:['شيء']});
  bad.push({kind:'silhouette',emoji:'🐎'},{kind:'silhouette',emoji:'🔑🔑'});
  return bad;
}
async function security(source=mod){
  const w=await open('quest-test.html',{moduleText:source}),api=w.ctx.KZV,q=fixture().qs[0];
  for(const v of invalidVisuals())assert.equal(api.validateVisual(v,q),false,JSON.stringify(v));
  for(const q of fixture().qs)assert.equal(api.validateVisual(q.vis,q),true,q.vis.kind);
  const clipped='<svg><defs><clipPath id="c"><circle cx="50" cy="50" r="20"/></clipPath></defs><path d="M0 50H100" clip-path="url(#c)"/></svg>';
  const clean=api.sanitizeSvg(clipped),again=api.sanitizeSvg(clipped);assert.ok(clean&&again);
  const id=clean.querySelector('clipPath').getAttribute('id');
  assert.notEqual(id,'c');assert.notEqual(id,again.querySelector('clipPath').getAttribute('id'));
  assert.equal(clean.querySelector('path').getAttribute('clip-path'),'url(#'+id+')');
  assert.equal(api.validateVisual({kind:'map',view:'world',hit:['Egypt','Palestine','Bahrain','Qatar','Lebanon','Malta','Singapore','Kuwait','France','Germany','Italy','Spain','China','India','Japan','Brazil','Canada','Mexico','Argentina','Australia']},q),true,'multi-country regions');
  const p=fixture();p.qs[0].q='<img src=x onerror="globalThis.PWN=1">';p.qs[0].why='<script>globalThis.PWN=1</script><img onerror="globalThis.PWN=1">';p.qs[0].src=['<img onerror="globalThis.PWN=1">'];
  assert.equal(api.register(p),true);const row=w.ctx.DATA.qs[bank.qs.length];api.explain(w.$('why'),row);assert.ok(!w.$('why').querySelector('img'),'explanation parsed an image');assert.ok(!w.$('why').querySelector('script'),'explanation parsed a script');assert.ok(w.$('why').textContent.includes('<script>'));assert.equal(w.ctx.PWN,undefined);
  noErrors(w);return invalidVisuals().length;
}
async function envelopes(source=mod){
  for(const change of [p=>p.stamp='bad',p=>p.qs[1].id=p.qs[0].id,p=>{p.qs[0].id=bank.qs[0][8]},p=>p.cats.push(p.cats[0])]){
    const w=await open('quest-test.html',{moduleText:source}),p=fixture();change(p);if(p.stamp!=='bad')p.stamp=stamp(p.qs);assert.equal(w.ctx.KZV.register(p),false);assert.equal(w.ctx.DATA.qs.length,bank.qs.length);noErrors(w);
  }
  const w=await open('quest-test.html',{moduleText:source,pack:fixture()});assert.equal(w.ctx.DATA.qs.length,bank.qs.length+18);assert.equal(w.ctx.KZV.register(fixture()),false);assert.equal(w.ctx.seenStamp(),'11036-b2fa74af');assert.equal(w.ctx.SEEN.bits.length,1380);noErrors(w);
  const p=fixture();p.qs[0].vis={kind:'map',view:'world',hit:['missing']};const bad=await open('quest-test.html',{moduleText:source,pack:p});assert.equal(bad.ctx.DATA.qs.length,bank.qs.length+17);noErrors(bad);
  const plain=fixture();delete plain.qs[0].vis;const text=await open('quest-test.html',{moduleText:source,pack:plain});assert.equal(text.ctx.DATA.qs.length,bank.qs.length+18);text.ctx.KZV.show(text.ctx.DATA.qs[bank.qs.length]);assert.equal(text.$('qvis').hidden,true);
  for(const body of ['not valid JavaScript','KZV.register({"broken":});','KZV.register({});globalThis.PWN=1;']){const broken=await open('quest-test.html',{moduleText:source,pack:fixture(),body});assert.equal(broken.ctx.DATA.qs.length,bank.qs.length);assert.equal(broken.ctx.PWN,undefined);noErrors(broken)}
}
async function histories(source=mod){
  const storage=store(),base=await open('quest-ghaws.html',{storage});base.ctx.seenMark(7);const old=storage.getItem('kunuz_seen_v1'),marked=new Set();
  for(const page of games){const w=await open(page,{moduleText:source,pack:fixture(),storage});assert.equal(storage.getItem('kunuz_seen_v1'),old);assert.equal(w.ctx.seenStamp(),'11036-b2fa74af');assert.equal(w.ctx.seenHas(7),true);
    for(const id of marked){const i=w.ctx.DATA.qs.findIndex(q=>q[8]===id);assert.equal(w.ctx.seenHas(i),true,id)}
    const next=w.ctx.DATA.qs.findIndex((q,i)=>i>=bank.qs.length&&!w.ctx.seenHas(i));assert.ok(next>=bank.qs.length);assert.equal(marked.has(w.ctx.DATA.qs[next][8]),false);w.ctx.seenMark(next);assert.equal(w.ctx.seenHas(next),true);marked.add(w.ctx.DATA.qs[next][8]);assert.equal(storage.getItem('kunuz_seen_v1'),old);noErrors(w);
  }
  // Two already-open pages observe each other's marks, even when selected later.
  const a=await open('quest-test.html',{moduleText:source,pack:fixture(),storage}),b=await open('quest-test.html',{moduleText:source,pack:fixture(),storage});a.ctx.seenMark(bank.qs.length+8);b.ctx.seenRead();assert.equal(b.ctx.seenHas(bank.qs.length+8),true);
  return marked.size;
}
async function off(source=mod){
  for(const page of games){
    const a=await open(page,{baseline:true}),b=await open(page,{moduleText:source,pack:fixture(),enabled:false});
    assert.equal(b.requests.some(p=>/kunuz-pack-/.test(p)),false);assert.equal(b.ctx.DATA.qs.length,bank.qs.length);assert.equal(b.ctx.DATA.cats.length,53);assert.equal(b.ctx.KZV.register(fixture()),false);
    // Same seeded draw from each game's real picker with no supplemental hooks active.
    function draw(w){const c=w.ctx;
      if(page==='quest-ghaws.html'){c.S.cats=[0,1,2];c.S.cap=5;c.S.breath=0;c.startDive();c.openShell(c.S.shells[0]);return c.S.cur[8]}
      if(page==='quest-harb.html'){c.G.cats=[0,1,2];return c.pickQ(0)[8]}
      if(page==='quest-test.html'){const g=c.TE.newGame({teams:[{n:'x',c:'#fff'}],cats:[0,1,2],total:5,timer:0,opts:'shown',shows:0});return c.DATA.qs[c.TE.pick(g,-1,c.seenHas)][8]}
      const g=c.BE.newGame({teams:[{n:'a',c:'#fff'},{n:'b',c:'#000'}],cats:[0,1,2,3,4,5]});return c.DATA.qs[c.BE.open(g,0,c.seenHas)][8];
    }
    assert.equal(draw(a),draw(b),page);noErrors(a);noErrors(b);
  }
}
async function levels(){
  for(const page of games){for(const late of [false,true]){
    const w=await open(page,late?{}:{pack:fixture()});if(late)assert.equal(w.ctx.KZV.register(fixture()),true);assert.equal(w.ctx.KZL.on(),true);
    const chips=w.$('lvSlot').querySelectorAll('.kzl-chip');
    if(page==='quest-board.html'){
      chips.find(b=>b.dataset.lv==='-1').onclick();for(const [pts,l] of [[200,1],[400,2],[600,3]]){assert.equal(w.ctx.KZL.forPts(pts),l);for(let i=bank.qs.length;i<w.ctx.DATA.qs.length;i++)assert.equal(w.ctx.KZL.at(i,l),w.ctx.KZV.level(i)===l)}
    }else for(const l of [1,2,3]){w.$('lvSlot').querySelectorAll('.kzl-chip').find(b=>b.dataset.lv===String(l)).onclick();for(let i=bank.qs.length;i<w.ctx.DATA.qs.length;i++)assert.equal(w.ctx.KZL.ok(i),w.ctx.KZV.level(i)===l)}
    noErrors(w);
  }}return 'before and after base classification; all three levels; board by points';
}
async function observers(source=mod){
  const w=await open('quest-test.html',{moduleText:source,pack:fixture()});let attached=0;
  w.ctx.ResizeObserver=class{observe(){attached++}disconnect(){attached--}};
  const photo=w.ctx.DATA.qs.find(q=>q.kzPack&&q.kzPack.vis.kind==='photo');
  for(let i=0;i<40;i++)w.ctx.KZV.show(photo);assert.equal(attached,1,'old photo observers retained');w.ctx.KZV.show(null);assert.equal(attached,0,'last observer retained');noErrors(w);return 'forty photo changes retain only the current observer';
}
function appearance(css=read('quest-visual.css')){
  function luminance(hex){const x=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));return x[0]*.2126+x[1]*.7152+x[2]*.0722}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  const ratios=[];for(const m of css.matchAll(/color:(#[0-9a-f]{6});background:(#[0-9a-f]{6})/gi))ratios.push(contrast(m[1],m[2]));
  for(const block of css.matchAll(/\{([^{}]*--kv-ink:[^{}]*)\}/g)){const s=block[1],val=n=>s.match(new RegExp('--kv-'+n+':(#[0-9a-f]{6})','i'))?.[1];if(val('ink')&&val('bg'))ratios.push(contrast(val('ink'),val('bg')));if(val('hit')&&val('land'))ratios.push(contrast(val('hit'),val('land')))}
  const shadow=/\.kzv-silhouette\{background:var\(--kv-shadow-bg,(#[0-9a-f]{6})\)\}/i.exec(css);assert.ok(shadow,'silhouette needs a separate pale backdrop');ratios.push(contrast('#000000',shadow[1]));
  assert.ok(ratios.length>=8);assert.ok(ratios.every(r=>r>=4.5),'contrast '+ratios.join(','));assert.ok(/\.kzv-question \.kzv-choice\{[^}]*min-width:44px;min-height:48px/.test(css));assert.ok(/\.kzv-choice-button:focus-visible\{outline:3px solid/.test(css));assert.ok(/\.kzv\{[^}]*height:112px/.test(css));return 'minimum contrast='+Math.min(...ratios).toFixed(2)+':1; reserved stage; touch size; focus outline';
}
function scanVisual(w,q){
  const host=w.$('qvis');assert.equal(host.hidden,false);assert.ok(host.classList.contains('kzv-'+q.kzPack.vis.kind));
  const label=host.getAttribute('aria-label');assert.ok(label);if(q.kzPack.vis.kind==='map'){for(const country of q.kzPack.vis.hit)assert.ok(!label.includes(country));assert.equal(label.includes(q[4][q[5]]),false)}
  const strings=[];function walk(el){if(el.nodeType!==1)return;const own=el.childNodes.filter(n=>n.nodeType===3).map(n=>n.textContent).join('');strings.push(...readable(el,own));el.childNodes.forEach(walk)}walk(host);
  assert.equal(strings.some(s=>/(?:سؤال|أسئلة|بنك).*[0-9٠-٩]|[0-9٠-٩].*(?:سؤال|أسئلة|بنك)/.test(s)),false);
  if(q.kzPack.vis.kind==='pattern'){assert.ok(w.doc.querySelectorAll('.kzv-choice').length>=4);for(const e of w.doc.querySelectorAll('.kzv-choice'))assert.ok(e.getAttribute('aria-label')||e.querySelector('button').getAttribute('aria-label'))}
}
async function play(page){
  const w=await open(page,{pack:fixture()}),c=w.ctx,seen=new Set(),counts=Object.fromEntries(kinds.map(k=>[k,0]));const cats=[53,54,55];
  function record(q){if(!q.kzPack)return;assert.equal(seen.has(q[8]),false);seen.add(q[8]);counts[q.kzPack.vis.kind]++;scanVisual(w,q);assert.equal(c.seenHas(c.DATA.qs.indexOf(q)),true)}
  if(page==='quest-ghaws.html'){
    c.S.cats=cats;c.S.cap=18;c.S.breath=0;c.S.noOpts=false;c.startDive();
    for(let i=0;i<18;i++){assert.ok(c.S.shells&&c.S.shells.length);c.openShell(c.S.shells[0]);record(c.S.cur);await Promise.resolve();c.answer(c.S.cur[5],null);w.advance(3000)}assert.equal(w.screen(),'end');
  }else if(page==='quest-test.html'){
    c.S.cats=cats;c.S.total=18;c.S.timer=0;c.S.opts='shown';c.drawCats();w.$('startBtn').onclick();
    for(let i=0;i<18;i++){c.ask();record(c.cur());await Promise.resolve();c.P.picked=c.cur()[5];c.confirmA();w.$('nextBtn').onclick()}assert.equal(w.screen(),'end');
  }else if(page==='quest-board.html'){
    c.S.cats=[0,1,2,...cats];c.drawCats();w.$('startBtn').onclick();
    for(let i=0;i<36;i++){c.openQ(i);const q=c.cur();record(q);await Promise.resolve();c.reveal();c.give(0)}assert.equal(w.screen(),'end');
  }else{
    let wars=0;
    while(seen.size<18&&wars++<12){
    c.openCfg();c.G.cats=cats;c.G.fuse=0;c.G.shots=1;c.G.winRule=9;c.newWar();let steps=0,last='';
    while(w.screen()!=='win'&&++steps<10000){
      if(c.G.busy){
        if(c.KZR.q&&!c.T.lock&&!w.$('slab').classList.contains('flip')){const q=c.KZR.q;if(last!==q[8]){record(q);last=q[8]}const buttons=w.$('ops').querySelectorAll('.opt[data-k]');if(buttons.length){const want=seen.size%2?q[5]:(q[5]+1)%4;buttons.find(b=>+b.dataset.k===want).onclick()}}
        if(!w.$('pg').disabled)w.$('pg').onclick();w.advance(2000);await Promise.resolve();continue;
      }
      if(c.G.phase==='deploy'){if(c.G.pool>0)c.tap(Array.from({length:12},(_,i)=>i).find(i=>c.G.own[i]===c.G.turn));else w.$('nextBtn').onclick();continue}
      if(c.G.phase==='move'){w.$('nextBtn').onclick();continue}
      if(c.G.phase==='attack'){
        if(c.G.base===null){const b=Array.from({length:12},(_,i)=>i).find(i=>c.G.own[i]===c.G.turn&&c.G.ban[i]>=2&&!c.isDead(i)&&Array.from({length:12},(_,j)=>j).some(j=>c.G.own[j]!==c.G.turn&&c.adj(i,j)&&!c.isDead(j)));if(b!==undefined)c.tap(b);else w.$('nextBtn').onclick()}
        else{const target=Array.from({length:12},(_,i)=>i).find(i=>c.canHit(i));if(target!==undefined)c.tap(target);else w.$('nextBtn').onclick()}
      }else w.advance(1000);
    }
    assert.equal(w.screen(),'win','war did not finish, steps='+steps);
    }
  }
  noErrors(w);assert.equal(seen.size,18,page+' coverage '+JSON.stringify(counts));assert.ok(Object.values(counts).every(n=>n===3),JSON.stringify(counts));return counts;
}
async function rooms(source=mod){
  const w=await open('quest-harb.html',{moduleText:source,pack:fixture()});w.ctx.G.cats=[53,54,55];w.ctx.G.roomCfg=true;w.ctx.drawCats();assert.equal(w.ctx.G.cats.some(i=>i>=53),false);assert.equal(w.ctx.kzcGroups().some(g=>g.c.some(i=>i>=53)),false);assert.equal(w.ctx.kzLive(bank.qs.length),false);w.ctx.G.roomCfg=false;w.ctx.RM.on=true;assert.equal(w.ctx.kzLive(bank.qs.length),false);w.ctx.KZV.show(w.ctx.DATA.qs[bank.qs.length]);assert.equal(w.$('qvis').hidden,true);
  assert.equal(/quest-visual|kunuz-pack|qvis/.test(read('hanna-laha/index.html')),false);noErrors(w);
}
function geography(geo=read('quest-data/kunuz-geo.js'),index=read('quest-data/kunuz-geo-index.js')){
  assert.equal(/isra[eë]l|\bISR\b|\bIS1\b|[اأإآ]سرائيل/i.test(geo+index),false);const ctx={};vm.runInNewContext(geo+'\n'+index,ctx);const g=ctx.KUNUZ_GEO,meta=JSON.parse(read('tools/kunuz-geo-build.json'));
  assert.ok(zlib.gzipSync(geo).length<400*1024);assert.equal(meta.sha256,crypto.createHash('sha256').update(geo).digest('hex'));assert.equal(meta.palestine.polygons,1);assert.equal(meta.palestine.sourceArea,meta.palestine.targetArea);assert.ok(g.countries.find(c=>c[0]==='Palestine')[1]);
  for(const name of meta.disputedNames)assert.equal(Object.hasOwn(ctx.KUNUZ_GEO_INDEX.names,name),false);for(const name of ['Bahrain','Qatar','Lebanon','Malta','Singapore'])assert.ok(g.countries.some(c=>c[0]===name));
}
async function new20(){
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const cv=require('../tools/kunuz-new20-convert.cjs');
  const manifest=new Function(read('quest-data/kunuz-packs-manifest.js')+';return KUNUZ_PACKS')();
  assert.deepEqual(manifest.map(p=>p.slug),cv.GROUPS.map(g=>g[0]==='landmark-draw'?'landmark-photo':g[0]).filter(s=>!['fmt-odd-one','occasions-calendar'].includes(s)));
  const packs=manifest.map(entry=>{assert.equal(entry.src,cv.packPath(entry.slug));const body=read(entry.src);const pack=cv.parsePack(body);assert.equal(pack.slug,entry.slug);return {pack,body}});
  const checked=await cv.validatePacks(packs);assert.equal(checked.questions,5487);
  const photos=packs.find(p=>p.pack.slug==='landmark-photo').pack;
  const credits=JSON.parse(read('quest-data/photos/landmarks/credits.json'));
  assert.equal(photos.qs.length,124);assert.equal(photos.stamp,'124-b267605d');assert.equal(credits.length,124);
  assert.deepEqual(fs.readdirSync(path.join(__dirname,'../quest-data/photos')).sort(),['landmarks']);
  assert.deepEqual(fs.readdirSync(path.join(__dirname,'../quest-data/photos/landmarks')).sort(),['credits.json',...photos.qs.map(q=>path.basename(q.vis.src))].sort());
  assert.equal(new Set(credits.map(c=>c.sha256)).size,124);
  for(const q of photos.qs){
    const credit=credits.find(c=>c.id===q.id),bytes=fs.readFileSync(path.join(__dirname,'..',q.vis.src));
    assert.ok(credit,q.id+' credit');assert.equal(q.q,'هذا المعلم في أي دولة؟');assert.equal(q.vis.effect,'plain');
    assert.equal(q.vis.src,credit.file);assert.equal(q.vis.credit.author,credit.author);assert.equal(q.vis.credit.license,credit.license);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),credit.sha256);
    assert.ok(bytes.length<=90000&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217,q.id+' JPEG budget');
    assert.ok(/^https?:\/\/(?:creativecommons\.org|commons\.wikimedia\.org)\//.test(credit.license_url)&&/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(credit.source_url));
    assert.equal(q.choices[q.answer],credit.country);assert.equal(new Set(q.choices).size,4);
  }
  const bodies=Object.fromEntries(packs.map(p=>['/'+cv.packPath(p.pack.slug),p.body]));
  for(const page of games){
    const w=await open(page,{manifest,bodies});
    assert.equal(w.ctx.DATA.qs.length,bank.qs.length+5487,page+' real manifest load');
    assert.equal(w.requests.filter(p=>/kunuz-pack-/.test(p)).length,18);
    assert.ok(w.ctx.KZC_GROUPS.some(g=>g[0]==='بصريات وألغاز'));
    noErrors(w);
  }
  // Selection exercises both flags, a missing photo, a real local bitmap, and
  // byte-stable serialization without depending on the external review folder.
  const q={...clone(fixture().qs[0]),status:'proposed',src:[{title:'Original source',url:'local'}]};
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kunuz-converter-'));
  const signs=path.join(temp,'quest-data','signs'),photo=path.join(signs,'existing.webp');
  fs.mkdirSync(signs,{recursive:true});
  try{
    fs.copyFileSync(path.join(__dirname,'fixtures/kunuz-visual-calibration.webp'),photo);
    const rows=[
      q,{...q,id:'visual-demo-0100',flags:['owner-religious-review']},
      {...q,id:'visual-demo-0101',flags:['overlap-bank-text:bank-0001']},
      {...q,id:'visual-demo-0102',flags:['owner-religious-review','overlap-bank-text']},
      {...q,id:'visual-demo-0103',vis:{kind:'photo',src:'quest-data/signs/missing.webp'}},
      {...q,id:'visual-demo-0104',vis:{kind:'photo',src:'quest-data/signs/existing.webp'}}
    ];
    const before=JSON.stringify(rows),a=cv.selectGroup(rows,temp),b=cv.selectGroup(rows,temp);
    assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(rows),before);
    assert.deepEqual(a.qs.map(q=>q.id),[q.id,'visual-demo-0104']);
    assert.deepEqual(a.held.religious.map(q=>q.id),['visual-demo-0100','visual-demo-0102']);
    assert.deepEqual(a.held.overlap.map(q=>q.id),['visual-demo-0101','visual-demo-0102']);
    assert.deepEqual(a.held.missingAssets.map(q=>q.id),['visual-demo-0103']);
    assert.equal(a.qs[0].src[0],'Original source — local');assert.equal(a.qs[0].status,'approved');
    for(const key of ['id','cat','type','fmt','q','choices','answer','why','level'])assert.deepEqual(a.qs[0][key],q[key],key);
    assert.equal(cv.convertVisual({id:'map-quiz-0013',vis:{kind:'map',view:'africa',hit:['Congo']}}).hit[0],'Republic of the Congo');
    assert.equal(cv.convertVisual({id:'map-quiz-0033',vis:{kind:'map',view:'africa',hit:['Mauritius']}}).view,'world');
  }finally{fs.unlinkSync(photo);fs.rmdirSync(signs);fs.rmdirSync(path.dirname(signs));fs.rmdirSync(temp)}
  return 'all NEW20 packs load in four games; hold rules, local assets and deterministic conversion';
}
module.exports={invalidVisuals};
if(require.main===module)(async()=>{
  await test('V1 six visual kinds, three of each, complete games in all four engines',async()=>{for(const page of games)console.log('  '+page+' '+JSON.stringify(await play(page)));return '72 visual questions'});
  await test('V2 hostile SVG, geometry, emoji, photo paths, plain text',async()=>'rejected='+await security());
  await test('V3 geography union, anonymous disputes, canonical targets, budget',geography);
  await test('V4 pack envelopes, duplicate IDs, malformed rows and stable bank seal',envelopes);
  await test('V5 disabled packs preserve same-seed draws and request no packs',off);
  await test('V6 supplemental IDs survive four game opens without changing old history',async()=>'persistent new IDs='+await histories());
  await test('V7 rooms exclude packs; Hanna remains outside the engine',rooms);
  await test('V8 lazy geography and packs OFF by default',async()=>{assert.match(mod,/^var PACKS_ENABLED=true;$/m);const manifest=new Function(read('quest-data/kunuz-packs-manifest.js')+';return KUNUZ_PACKS')();assert.ok(manifest.length);const off=await open('quest-test.html',{manifest,enabled:false});assert.equal(off.ctx.DATA.qs.length,bank.qs.length);assert.equal(off.requests.some(p=>/kunuz-pack-/.test(p)),false);noErrors(off);const w=await open('quest-test.html',{pack:fixture()});assert.equal(w.requests.includes('/quest-data/kunuz-geo.js'),false);w.ctx.KZV.show(w.ctx.DATA.qs[bank.qs.length]);await Promise.resolve();assert.equal(w.requests.filter(p=>p==='/quest-data/kunuz-geo.js').length,1);w.ctx.KZV.show(w.ctx.DATA.qs[bank.qs.length]);await Promise.resolve();assert.equal(w.requests.filter(p=>p==='/quest-data/kunuz-geo.js').length,1);noErrors(w)});
  await test('V13 NEW20 conversion and shipped pack loading',new20);
  await test('V10 pack levels with early and late loading',levels);
  await test('V11 contrast, touch targets, focus and reserved layout',appearance);
  await test('V12 photo observer cleanup on question changes',observers);
  await test('V9 mutations are each rejected by the behavioral assertions',async()=>{
    const mutants=[
      ['SVG bypass','if(v.kind==="svg")return !!sanitizeSvg(v.svg);','if(v.kind==="svg")return true;',security],
      ['rotation range','integer(c.rot,0,315)','true',security],
      ['photo traversal','if(!/^quest-data\\/signs\\/[a-z0-9]+(?:-[a-z0-9]+)*\\.webp$/.test(v.src))return false;','if(false)return false;',security],
      ['unsafe explanation','node.textContent=q[6]','node.innerHTML=q[6]',security],
      ['pack seal','p.stamp!==stamp(p.qs)','false',envelopes],
      ['duplicate IDs','own(ids,q.id)||own(localIds,q.id)','false',envelopes],
      ['bank seal','oldStamp(n||baseN)','oldStamp(n)',envelopes],
      ['pack repeat memory','return pack(i)?has(i):oldHas(i)','return pack(i)?false:oldHas(i)',histories],
      ['disabled loader','if(!PACKS_ENABLED||typeof KUNUZ_PACKS','if(typeof KUNUZ_PACKS',off],
      ['room categories','if(typeof G!=="undefined"&&G&&G.roomCfg)return groups.map','if(false)return groups.map',rooms],
      ['photo observer leak','if(photoObserver){photoObserver.disconnect();photoObserver=null}','if(photoObserver){photoObserver=null}',observers]
    ];let caught=0;for(const [name,from,to,check] of mutants){assert.equal(mod.split(from).length,2,'mutation seam '+name);try{await check(mod.replace(from,to))}catch(e){caught++;continue}throw Error('survived: '+name)}
    assert.throws(()=>geography(read('quest-data/kunuz-geo.js')+'\n// Israel'));assert.throws(()=>appearance(read('quest-visual.css').replace('color:#123b55;background:#fff','color:#ffffff;background:#ffffff')));assert.throws(()=>appearance(read('quest-visual.css').replace('--kv-shadow-bg,#edf6fc','--kv-shadow-bg,#101010')));return 'caught='+caught+'/'+mutants.length+' plus geography, option contrast and shadow contrast mutations';
  });
  console.log('SUMMARY '+results.filter(Boolean).length+'/'+results.length+' pass');process.exitCode=results.every(Boolean)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
