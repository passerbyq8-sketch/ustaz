'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{parseHTML}=require('linkedom');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.jsx'),'utf8'),loader=fs.readFileSync(path.join(root,'lang/content/tr4-loader.js'),'utf8'),ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const fn=name=>{const n=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);},clean=x=>JSON.parse(JSON.stringify(x));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),legacy=read('dima/dima-v1.json'),langs=['am','om','en','fa','fr','ur','id','ha','sw','zh','de','hi','ps','uz'],extra=langs.slice(4);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function translationFixture(lang,code=loader,offline=false){const {window,document}=parseHTML('<html><body><main id="root"><section></section></main></body></html>');const urls=[];
 window.fetch=async u=>{urls.push(u);if(offline)throw Error('offline');try{return {ok:true,status:200,json:async()=>read(u)}}catch(e){return{ok:false,status:404}}};
 window.localStorage={getItem:()=>lang};window.TextEncoder=TextEncoder;window.console={...console,warn:()=>{}};
 const scope=vm.createContext({window,document,TextEncoder,Uint8Array,Int32Array,DataView,Map,WeakMap,WeakSet,Promise,Array,Object,String,RegExp,Math,Error,unescape,encodeURIComponent});
 vm.runInContext(code,scope);const layer=window.TR4;layer.configure({direction:c=>/^(fa|ur|ps)$/.test(c)?'rtl':'ltr',text:()=>''});
 return{window,document,layer,urls,root:document.getElementById('root'),host:document.querySelector('section')};}
const directionCSS=fs.readFileSync(path.join(root,'index.html'),'utf8');
function verifyDirection(css){
 const ltr=css.match(/\.dimaRoot\[dir="ltr"\][^{]*\{direction:([^}]+)\}/);assert(ltr,'Dima LTR layout rule');assert.equal(ltr[1],'ltr');
 for(const selector of ['.dimaRoot[dir="ltr"]','.dimaRoot[dir="ltr"] .dimaHeader','.dimaRoot[dir="ltr"] .dimaHeaderTitle'])assert(ltr[0].split('{')[0].split(',').includes(selector));
 assert(css.includes('.dimaRoot[dir="ltr"] .dimaHeaderTitle{text-align:start}'));
}
const directionMutant=directionCSS.replace('.dimaRoot[dir="ltr"],.dimaRoot[dir="ltr"] .dimaHeader,.dimaRoot[dir="ltr"] .dimaHeaderTitle{direction:ltr}','.dimaRoot[dir="ltr"],.dimaRoot[dir="ltr"] .dimaHeader,.dimaRoot[dir="ltr"] .dimaHeaderTitle{direction:rtl}');
assert.notEqual(directionMutant,directionCSS);
async function verify(code=loader){let n=0;verifyDirection(process.argv.includes('--direction-mutant')?directionMutant:directionCSS);assert.throws(()=>verifyDirection(directionMutant));
 const dictNode=ast.program.body.find(x=>x.type==='VariableDeclaration'&&x.declarations.some(d=>d.id.name==='EZ_I18N'));
 const dicts=vm.runInNewContext(source.slice(dictNode.start,dictNode.end)+';EZ_I18N');for(const file of fs.readdirSync(path.join(root,'lang')).filter(x=>x.endsWith('.json')))dicts[file.slice(0,-5)]=read('lang/'+file);
 assert.equal(Object.keys(dicts).length,24);for(const [lang,dict]of Object.entries(dicts))for(const key of ['repeatLabel','repeatHelp','seasonLabel','saveWarning']){const text=dict['dima.'+key];assert(typeof text==='string'&&text.trim()&&!text.includes('??'),lang+' '+key);if(lang==='ku'){assert(/[\u0600-\u06ff]/.test(text));assert(!/[A-Za-z]/.test(text));}}
 for(const lang of langs){const f=translationFixture(lang,code),bundle=read('lang/content/'+lang+'/sections/dima.json');
  const l11=bundle.items.find(x=>x.id==='l11')||bundle.items.find(x=>f.layer.hid(x.ar)===f.layer.hid(legacy.lisan[10].text));assert(l11,lang+' l11');const div=f.document.createElement('div');div.setAttribute('data-tr4-id','l11');div.textContent=l11.ar;f.host.appendChild(div);
  const mixed=bundle.items.find(x=>x.src?.publishedQuotes);let mixedNode=null;if(mixed){mixedNode=f.document.createElement('p');mixedNode.textContent=mixed.ar;f.host.appendChild(mixedNode);}
  const story=bundle.items.find(x=>x.kind==='text'&&x.ar===legacy.days[6].qalb.note);assert(story,lang+' legacy story fixture');const storyNode=f.document.createElement('p');storyNode.setAttribute('data-tr4-preserve-ar','');storyNode.textContent=story.ar;f.host.appendChild(storyNode);
  const fresh=f.document.createElement('div');fresh.setAttribute('data-tr4-owned','');fresh.textContent=l11.ar;f.host.appendChild(fresh);
  const stop=f.layer.mount(f.root,lang,['dima']);await flush();
  assert.equal(div.firstChild.nodeValue,l11.ar,lang+' sacred Arabic kept');assert.equal(div.querySelector('.tr4-tr')?.textContent,l11.tr,lang+' entire published translation/context');assert.equal(div.querySelector('.tr4-translit')?.textContent,l11.translit,lang+' pronunciation');
  if(l11.tag==='published'){const src=div.querySelector('.tr4-source');assert(src,lang+' published source');for(const key of ['name','version','context','snapshot'])if(l11.src[key])assert(src.textContent.includes(l11.src[key]),lang+' '+key);assert.equal(src.href,l11.src.url);}assert.equal(div.querySelector('.tr4-tr').dir,/^(fa|ur|ps)$/.test(lang)?'rtl':'ltr');
  assert.equal(storyNode.firstChild.nodeValue,story.ar,'source-backed story remains Arabic');assert.equal(storyNode.querySelector('.tr4-tr').textContent,story.tr);assert.equal(fresh.childNodes.length,1,'new Arabic-only subtree unchanged');
  if(mixed){const nodes=Array.from(mixedNode.querySelectorAll('.tr4-source'));assert(nodes.some(x=>x.textContent.includes(mixed.src.publishedQuotes.name)&&x.textContent.includes(mixed.src.publishedQuotes.context)),'mixed source shown on its own block');}
  const note=bundle.items.find(x=>typeof x.footnotes==='string'&&x.footnotes);if(note){stop();f.host.replaceChildren();const p=f.document.createElement('p');p.textContent=note.ar;f.host.appendChild(p);const stopNote=f.layer.mount(f.root,lang,['dima']);await flush();assert.equal(p.querySelector('.tr4-foot').textContent,note.footnotes,'string footnotes intact');stopNote();}else stop();
  const text=legacy.notifications.daily[0],item=bundle.items.find(x=>f.layer.hid(x.ar)===f.layer.hid(text));assert(item?.tr);assert.equal(f.layer.dimaText(lang,'legacy-alias',text),item.tr,'actual payload dictionary');
  if(extra.includes(lang)){assert(f.urls.every(x=>x==='/lang/content/'+lang+'/sections/dima.json'),'Dima-only availability');const before=f.urls.length;f.layer.mount(f.root,lang,['asmaa']);assert.equal(f.urls.length,before,'other sections remain unavailable');assert.equal(f.layer.language(),'','Kunuz allowlist unchanged');}
  n++;
 }
 const offline=translationFixture('fr',code,true);await offline.layer.preloadDima('fr');assert.equal(offline.layer.dimaText('fr','l11',legacy.lisan[10].text),legacy.lisan[10].text);n++;
 const scopes={Date,Math,Number,Object,JSON,Set,Map,Promise,Intl,window:{},EZ_LANG:'fr',DIMA_CONTENT_LANGS:langs,DIMA_SLOTS:['fajr30','duha','asr','isha'],__dimaTranslationReady:new Set(['fr']),__dimaData:legacy,__dimaCatalog:{},ADHAN_WINDOW_DAYS:7,
  dimaReadStore:()=>({startDate:'2026-01-01',notify:{on:true,slot:'asr'},log:{}}),ezT:k=>k==='dima.repeatHelp'?'Available days repeat; progress is kept.':'Dima',
  readQiblaLoc:()=>({}),prayerZoneOf:()=>({}),prayerTodayParts:()=>({y:2026,m:11,d:5}),dimaPrayerAt:d=>d.getTime()+3600000};
 const tf=translationFixture('fr',code);await tf.layer.preloadDima('fr');scopes.window.TR4=tf.layer;
 scopes.dimaResolveForDate=()=>({legacy:true,snapshot:{notification:{id:'legacy',text:legacy.notifications.daily[0]}}});
 const ctx=vm.createContext(scopes);vm.runInContext(['dimaDateKey','dimaDateFromKey','dimaIndexForDate','dimaLogFor','dimaTranslatedText','ezikDimaAlertItems'].map(fn).join('\n'),ctx);
 const build=()=>vm.runInContext('ezikDimaAlertItems(new Date("2026-11-05T00:00:00Z"))',ctx);assert.equal(build().length,7);assert.equal(build()[0].body,tf.layer.dimaText('fr','',legacy.notifications.daily[0]));n++;
 scopes.dimaResolveForDate=()=>({legacy:false,snapshot:{notification:{id:'new',text:'NEW_ARABIC_BODY'}}});assert.equal(build()[0].body,'NEW_ARABIC_BODY');n++;
 scopes.dimaResolveForDate=()=>({legacy:true,snapshot:{notification:{id:'dima.repeat.notification',text:'OLD'}}});assert.equal(build()[0].body,scopes.ezT('dima.repeatHelp'));n++;
 scopes.dimaReadStore=()=>({startDate:'2026-01-01',notify:{on:false,slot:'asr'},log:{}});assert.equal(build().length,0);scopes.__dimaTranslationReady.clear();assert.equal(build().length,0);n++;
 // Actual section rendering with a frozen batch-2 record: readable Arabic guidance, no Quran framing.
 const rec={dayId:'dima.regular.031',packId:'dima-regular-002',version:1,legacy:false,repeat:true,season:null,snapshot:{lisan:legacy.lisan[6],...read('dima/pack-regular-002.json').days[0]}};
 const store={startDate:'2026-01-01',log:{},notify:{on:false,slot:'asr'},notifySeen:true,presented:{}};let call=0;
 const uiScope={React,window:{},document:{documentElement:{lang:'fr'}},Date,EZ_LANG:'fr',EZ_LANG_DIR:{fr:'ltr'},__dimaCatalog:{},__dimaData:legacy,__dimaStoreError:'storage',DIMA_SLOTS:['fajr30','duha','asr','isha'],
  useEzLang:()=> 'fr',useDimaRevision:()=>0,useState:init=>{call++;return[call===4?1:typeof init==='function'?init():init,()=>{}];},useEffect:()=>{},useRef:()=>({current:true}),useEzikBackLayer:()=>{},
  dimaReadStore:()=>store,dimaCivilDate:()=>new Date(2026,10,5,12),dimaResolveForDate:()=>rec,dimaFreezePresented:x=>x,dimaWriteStore:x=>x,ezikSchedArm:()=>{},ezT:k=>k,ezNum:String,
  DimaScene:()=>null,DimaDropMark:()=>null};
 const uiCtx=vm.createContext(uiScope),codeUI=['dimaDateKey','dimaDateFromKey','dimaDateAdd','dimaIndexForDate','dimaLogFor','dimaDayTitle','EzikDimaSection'].map(fn).join('\n');
 vm.runInContext(require('@babel/core').transformSync(codeUI,{presets:[[require('@babel/preset-react'),{runtime:'classic'}]],configFile:false,babelrc:false}).code,uiCtx);
 const html=renderToStaticMarkup(React.createElement(uiCtx.EzikDimaSection,{})),doc=parseHTML(html).document;
 assert(doc.querySelector('[data-dima-day="dima.regular.031"]'));assert(doc.querySelector('.dimaRepeat'));assert(doc.querySelector('.dimaNotice'));assert(!doc.querySelector('.dimaVerse.is-quran'));assert(doc.querySelector('.dimaVerse').parentElement.hasAttribute('data-tr4-owned'));assert.equal(doc.querySelector('.dimaRoot').dir,'ltr');assert(doc.querySelector('.dimaNote').hasAttribute('data-tr4-preserve-ar'));n++;
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const url of ['/dima/pack-manifest-v1.json',...read('dima/pack-manifest-v1.json').regular.filter(x=>x.path).map(x=>x.path),...read('dima/pack-manifest-v1.json').seasonal.map(x=>x.path)])assert(sw.includes("'"+url+"'"),'explicit offline warm '+url);
 assert(source.includes("localStorage.removeItem('ezik_dima_v2')"));assert(source.includes('useDimaSchedule();'));assert(source.includes('dimaDateKey(dimaCivilDate())'));assert(!fn('EzikDimaSection').includes('Math.min(30'));assert(fn('EzikDimaSection').includes('dimaFreezePresented(store, resolved)'));
 return n;
}
const mutant=loader.replace("var src = full ? sourceInfo(item) : item.tag === 'published' && item.src;","var src = item.tag === 'published' && item.src;");assert.notEqual(mutant,loader);
(async()=>{if(process.argv.includes('--mutant')){await verify(mutant);return;}const n=await verify();await assert.rejects(()=>verify(mutant),assert.AssertionError);console.log('PASS B10 wiring: '+n+' DOM/payload/UI fixtures; 14 Dima languages, scoped requests, Arabic/footnotes/pronunciation/full sources, offline fallback, actual notification payloads, repeat and Arabic-only packs.');})().catch(e=>{console.error(e);process.exitCode=1;});
