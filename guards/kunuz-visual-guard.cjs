// Kunuz supplemental packs: real game scripts, shared renderer, hostile data,
// stable bank history, local loaders, and mutations. No browser stays open here.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {open,store,read,bank}=require('./kunuz-visual-world.cjs');
const {fixture,stamp,cell,kinds}=require('./fixtures/kunuz-visual.cjs');
const {readable}=require('./kunuz-sim/readable.cjs');
const QUALITY_PACK_HELD = {"map-quiz-0053":"d619e515eef1ef3fe8e127898759cf8a07cb6deada40dfce56141b38c14e40c4","map-quiz-0067":"c08a41172d4c41668e266a47ef9f1a1bc13328efbce69f572759ce2d43fd4ecf","map-quiz-0069":"e72bef53d31176ff324f9b413b6ac6a6eb5273094aab4acfe28f553326ca3dd1","map-quiz-0074":"e147c2c6b663734b554604c0830e62b06e376a25fd97f2b9cc7e98a83aad62ea","map-quiz-0116":"95233c0b4b1d3be9802e331fd5520ea0dfd554c5a8eddb6eec8094d7e7aeb87e","map-quiz-0117":"cc691b99db639f4a5533c5dd24bc090096f7adbd74cdafd7c0619d5f3b025439","map-quiz-0163":"9612aa6637f76a28b64bafbdfdbb7254f4f3dda19d7170ca671c93445b8b2ff2","map-quiz-0213":"d5234c31a575bf494a08da94bb3307823bcb3ed6affc41a1754f4aca451fe7e5","map-quiz-0231":"da527e891415563ef326e8d143e6beba0b62fabd9cb8100e44fd563b26e3173c","map-quiz-0242":"9e38fc362ae57bfaad4f666632644b5d9314363b190a7355dcf6d9e40a40632f","map-quiz-0246":"833ae04532c30570c8128ed9204ea0368dacd76943b7faa0ef0ff76b776c4ba5","map-quiz-0274":"585e90c16bf8e89583883eb7ef14d4d02d2f24bf434f3f89f13d2e4f95afeb90","map-quiz-0282":"543bf030129622e59bee255ebd03dc65c0b3ef4f5293d4ccd3b68497885aa2c0","map-quiz-0325":"4699dc3b906c7bd43d5c61b5ebfab26e385ae6532280608a71c0870f7c70aae1","map-quiz-0340":"b58f06a9fcce69fdcd92d36ddf4ac175966ca8d9b8b30dd030630a4293acd1c6","map-quiz-0341":"0e966fe410881bf5902107caf3cc982d5d5f1d040a0fe0b1d014fc50ac04cbbd","map-quiz-0366":"eb96c37c6380a05ad3d5a08e2bf5cb3d424d93c050d771a90c566e4dc8bc8110","map-quiz-0368":"81cf2fd62c059c5f250ca145d88561672d22ce9890871c8b18fbefa4f59a2c14","map-quiz-0525":"918ff3e631d4180743c989bc6a952a200320b5e9ff7bab1a78fd94736afd38a2","silhouette-0263":"2adae39ff608a8072b691ec2b0c4ce90c116cb4ff0c9e4acfa465a224138e79f","pattern-iq-0017":"8c4ec3bf2cea36282de05a68164b21f8616702fe94593fbd716412f68f2d3af8","pattern-iq-0045":"a70c5029248aa38c9ab42781b98bab3a252bdb5b8f9afc1378516a5a268c9e41","pattern-iq-0060":"af5a2ea11f15c94193b9feca23a868bf555107f08c12a1b44b706aa138c66ffe","pattern-iq-0068":"8dddc74e5bcec0463208dc69e6e7136e89812c638527d843aa75e5ba9a73818c","pattern-iq-0072":"737f5d648b41958a74649af2cd4e862e68f739b8b24e83d3076537f4d6688466","pattern-iq-0084":"7651e45e271ce9b13334e3435a5d615807b26d1d413e9092fc169f22ccc18d98","pattern-iq-0089":"606bbe019e7182da6c07e85ffbb43578224365cab28b58b2880c8836fb3b5bda","pattern-iq-0116":"92ff6d1af558e2ba080747014f18991b3d5d6f630bf141fb6705a41efea8d2bb","pattern-iq-0180":"7ca4a7fbc2d76e6c5f7134f9ab2f3e44ca34181dcf2024f3e787a13582973924","pattern-iq-0196":"01227dad6052b263ceb6918253190b3377591db5b1c3fabd61d0a6fb4f380817","pattern-iq-0220":"72be1be45b15a51eb1c8a5e88cc0f5c1a94131458ade5f7d2af589e99886e916","pattern-iq-0224":"cd797acede064a3cc5e0a4d09658b271856bcc684713c05de9c160f1c6155b08","pattern-iq-0257":"50d0a753f626cfb7fe91d253ae5b48f97d7e2eec76a4192ec850d1d2360eb7e6","pattern-iq-0270":"f50ad319b635b7dc382062a7cb303dcac5c79deed56defbeb7368d8e9e58fdc7","pattern-iq-0297":"994779deb54575feedcb0a549169bbcd7e18f99d9c544a836f65857a798d2668","pattern-iq-0339":"7f2d2888a64777770269c0d3f47e1705de8a7c82299fa706075f3bb512e84723","pattern-iq-0340":"41f597fe83c9533968e64e728008562ae00de10c648fa50adea3c777286bad27","pattern-iq-0351":"7d93ad219e0047859b37e5447ba6fa0ec8f248165a590939bb3219445101abdd","pattern-iq-0359":"382651157ceff62659a01f9dfcde221dff1a5805227c02c733c80d2e19c4292f","pattern-iq-0371":"fd56ff42f55da8e8cb0a848036d24321d64b7e1305611f25fcbba7e08981c44e","pattern-iq-0372":"3f15b072c3f7c6eada6a8273e702382675e909db647788e5c57f497c5eb942b6","pattern-iq-0376":"aba5a7abd38d19cd599677368661f27ab10e0956b23b6185038ca05a9233293a","pattern-iq-0394":"8614aa87408565982255c30fea9a076704586e5078b0202245514edde98657c4","pattern-iq-0396":"9713ba3bd03a09b30df4653366f28c57e70562b61f45e2f406ddfd08942c7038","pattern-iq-0430":"16bd926e8bd243303f2e2c839711f05371d2e143a230cffb8033a6ecaf6f6c65","pattern-iq-0433":"6fec9662918b41432fe141920b79367c26318fdd42860954cd9785a666440b27","pattern-iq-0440":"c65d8388a9f25085710106ef90838a871b439fe2b32a85ac4f67306824a73f7a","pattern-iq-0444":"cd8f6a67cbb02a6fe5e4e986965e26efb4490922a198f433bbfb509b1d7ce18d","pattern-iq-0453":"b5b027a13737621dfff6d4c92df189add073581a36fbc21da3809df01e161f42","pattern-iq-0459":"8dc39da0d44b48c89e3b5232342e101196582bb354194cd6f0a6438596741096","pattern-iq-0461":"aeb35c6d977b8004fc25ec912addbbde26558db5b8fad720e9f31e8915bdd2f7","pattern-iq-0464":"1048a422adf7d97fe77c536085f68e1d8ecd812fa54357205efd8108001f22c2","pattern-iq-0484":"ec2f04fe6f806eb8a7c093184eeaaaebff6dfa96c4e0bc2c16e6ae8023331485","pattern-iq-0488":"d83cf838944519c1f88ee5966313dc066d66fd43dc9e5f1e3199493a321c4d59","pattern-iq-0489":"26b0c5834d1709711640813efb90f236baf6798d83f4ba9369ae6a538f58b06d","pattern-iq-0496":"0b295515a68e1d7a4185298e126fdaf6d01f0ec42ad68d594b321da9b234ad76","pattern-iq-0501":"29c2099b0192c79873dbdf8cda55a97c4c911f64ef3145e8426cb0dd51867181","pattern-iq-0503":"c1e3c523f43f1f79021123cb2ff109dbd6b8c1d5f77e0490dcdc60468255211d","pattern-iq-0517":"7514a9f063b340fcd350d1cf60eb899e5f780ff803766121b86bfc393e0491f1","pattern-iq-0522":"e0b393350cf8b5eac63def10fc046bbbabaa1bc64bfbd238e457d64a681850e8","pattern-iq-0523":"4875864f12d738fc3d19eb57dafb1b9b6293de9de6d30096ae77621aba6b1ff3","pattern-iq-0531":"3e40c0bd33a18933d41bf20f08f2bebcb5a545f99d5fc79b155d0b12b644c4c8","pattern-iq-0553":"3a861c6cc461411e758673ccaec031f29eae54f56a39a1e431b3df9a7be34380","pattern-iq-0555":"8431198a55151b72893cca6179bff7ecd9b5631dae8870c5f5d31a7ba29dc814","pattern-iq-0578":"6f549619015793e3ccc73171df6d894e468ec92a3c933c2d3e10c7afcffb0da4","pattern-iq-0587":"7ea9b8396ae25dd75376cd487f5f853a682fd07d48048047c922d9c75685c9a4","pattern-iq-0588":"b235b23838736ea02c9bc78e2683375f4b93e978a46471257a27c6ea695e4568","pattern-iq-0590":"f52b488113f7c96891324a11af69a1774a30aed0ca82c33e0411b73344ae67a8","pattern-iq-0610":"2524cbe0c0bff6367f26c10f14a931ff2ba0c26bd6c2f2e2093622698ed7e5e0","pattern-iq-0623":"97586f4de973bd0344f3febdecbcfd2c19bd349cd09cb7b1aeb9cd562ab48f4b","pattern-iq-0639":"3941f1455d22e702063a9c5495d70e943461cc63158bf4e420301f33823d480a","pattern-iq-0660":"3e16302d5ce288a8532b40675a2e31229dd8fee21606a652b23bed53936c24e7","kuwait-places-0130":"9146f1928df754434b06df37d6bf864173d6c3279e7c61fecfad996ecd8f6633","gulf-cuisine-0205":"cf8872a91a764f75432d153047f90ec480dca3ad833f6545964d18862c0b1f21","books-authors-0503":"a7e15dd25ceacd9c023cafc33c3c5d83aa5f5a63e0eae52cc06f7f6aec779bd1","books-authors-0640":"d9fe7ebe8a5af663fbe6a5ef236efcd39a3687e01860835de7d78121f70a6fec","gulf-history-0080":"a22b2381b51dbe3ee5090b9a4726f43ff73dc0fab75ea8982db0cb3be49d46ff","gulf-history-0129":"1f0dc9a4a40cfaf88d10afc14e312bfe7eaf6fe512601809cf725ae213b2845c","gulf-history-0247":"3a25cba2bb36ac91c93676e7310ee8aa1bbae19c862e5f9dc8658661b61e4803","gulf-history-0320":"20c700fa3d81209ad583f107a2ee3de0f15511acc2b978ca6fec8c2b12afb6ea","fmt-missing-letter-0420":"0508b339c58d9e2ff3bfbaf85cc314bd4cb29db60ca7792f2bfe1ce0dc7f1485"};
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
  assert.deepEqual(manifest.map(p=>p.slug),cv.GROUPS.map(g=>g[0]).filter(s=>!['fmt-odd-one','landmark-draw','occasions-calendar'].includes(s)).concat(['historical-events','landmark-photos']));
  const packs=manifest.map(entry=>{assert.equal(entry.src,cv.packPath(entry.slug));const body=read(entry.src);const pack=cv.parsePack(body);assert.equal(pack.slug,entry.slug);return {pack,body}});
  const held=packs.flatMap(p=>p.pack.qs).filter(q=>q.status==='held');
  assert.equal(held.length,Object.keys(QUALITY_PACK_HELD).length,'named pack hold count');
  for(const q of held)assert.equal(crypto.createHash('sha256').update(JSON.stringify(q)).digest('hex'),QUALITY_PACK_HELD[q.id],q.id+': held content changed');
  for(const {pack} of packs)for(const q of pack.qs)if(q.status==='approved')assert.ok(!Object.hasOwn(QUALITY_PACK_HELD,q.id),q.id+': held row became live');
  const checked=await cv.validatePacks(packs);assert.equal(checked.questions,5636);assert.equal(checked.liveQuestions,5555);
  const bodies=Object.fromEntries(packs.map(p=>['/'+cv.packPath(p.pack.slug),p.body]));
  for(const page of games){
    const w=await open(page,{manifest,bodies});
    assert.equal(w.ctx.DATA.qs.length,bank.qs.length+5555,page+' real manifest load');
    assert.equal(w.requests.filter(p=>/kunuz-pack-/.test(p)).length,19);
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
      ['photo traversal','if(!/^(?:quest-data\\/signs\\/[a-z0-9]+(?:-[a-z0-9]+)*\\.webp|quest-img\\/landmarks\\/landmark-photos-\\d{4}\\.webp)$/.test(v.src))return false;','if(false)return false;',security],
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
