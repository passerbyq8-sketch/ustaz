'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const app=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8'),lab=fs.readFileSync(path.join(__dirname,'../mushaf-lab/app.js'),'utf8');
const ast=parser.parse(app,{sourceType:'script',plugins:['jsx']});
function fn(name){const n=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);}
function variable(name){for(const n of ast.program.body)if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.name===name)return app.slice(d.init.start,d.init.end);throw Error(name);}
const adapterCode=fn('createEzikNativeShareAdapter'),attemptCode=fn('ezikNativeShareAttempt');
assert(lab.replace(/^  /gm,'').includes(adapterCode),'Mushaf and main use identical native adapter contract');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(code=adapterCode,bridge=true){
 let now=10000,seq=0;const timers=new Map(),listeners=new Map(),posted=[],copies=[],failures=[],web=[];
 const win={document:{visibilityState:'visible'},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 if(bridge)win.ReactNativeWebView={postMessage:t=>posted.push(JSON.parse(t))};
 const scope={Date:{now:()=>now},Math,Map,Promise,Number,window:win,setTimeout:(f,ms)=>{const id=++seq;timers.set(id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),navigator:{share:async p=>web.push(p)},ezikWriteClipboard:async t=>{copies.push(t);return true;}};
 const context=vm.createContext(scope);vm.runInContext(code+'\n'+attemptCode,context);const adapter=vm.runInContext('createEzikNativeShareAdapter(window)',context);scope.ezikNativeShare=adapter;
 const attempt=vm.runInContext('ezikNativeShareAttempt',context),links=vm.runInContext('('+variable('ezikShareLinks')+')',context);
 const answer=(request,result)=>listeners.get('ezik:share:result')?.({detail:{type:'ezik:share:result',v:'1',id:request.id,...result}});
 const cap=async()=>{answer(posted[0],{ok:true,status:'capabilities',capabilities:{text:true,link:true,file:true,maxTextLength:65536,maxFileBytes:4194304,htmlToPdf:false,textCancellation:true,fileCancellation:false}});await adapter.ready;};
 const advance=async ms=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.f();}await flush();};
 return {adapter,attempt,links,cap,advance,posted,copies,failures,web,win,answer,listeners,timers,scope,context};
}
async function verify(code){
 let checks=0;
 for(const bridge of [false,true]){const f=fixture(code,bridge);assert.equal(f.adapter.canShare('text'),false);await f.links({text:'exact legacy'},()=>{});assert.equal(f.web.length,1);assert.equal(f.copies.length,0);if(bridge){assert.equal(f.posted[0].op,'capabilities');await f.advance(1001);assert.equal(await f.adapter.ready,null);}f.adapter.dispose();checks++;}
 for(const [status,ok,reason,copy,fail] of [['shared',true,null,0,0],['presented',true,null,0,0],['dismissed',true,null,0,0],['error',false,'busy',0,0],['error',false,'inactive',0,0],['error',false,'share-unavailable',1,0],['error',false,'share-failed',0,1],['error',false,'write-failed',0,1]]){
  const f=fixture(code);await f.cap();const payload='  Exact \u0622\u064a\u0629\n[source 1:2]\nhttps://ezik.app/  ';
  assert(f.attempt({kind:'text',text:payload},()=>f.copies.push(payload),()=>f.failures.push('failure')));assert.equal(f.posted[1].text,payload);assert.equal(f.posted[1].v,'1');assert.equal(f.posted[1].op,'share');
  f.answer({...f.posted[1],id:'unknown-id'},{status,ok,reason});await flush();assert.equal(f.copies.length+f.failures.length,0);
  f.answer(f.posted[1],{status,ok,reason});await flush();assert.equal(f.copies.length,copy,status+'/'+reason);assert.equal(f.failures.length,fail,status+'/'+reason);assert.equal(f.web.length,0);f.adapter.dispose();checks++;
 }
 {const f=fixture(code);await f.cap();const first=f.adapter.share({kind:'link',url:'https://ezik.app/download.html'});assert.equal((await f.adapter.share({kind:'text',text:'second'})).reason,'busy');assert.equal(f.posted.length,2);f.answer(f.posted[1],{ok:true,status:'dismissed'});await first;assert.equal((await f.adapter.share({kind:'text',text:'third'})).reason,'busy');await f.advance(750);const fourth=f.adapter.share({kind:'file',file:{filename:'x.txt',mime:'text/plain',size:3,b64:'YWJj'}});assert.notEqual(f.posted[2].id,f.posted[1].id);f.answer(f.posted[2],{ok:false,status:'error',reason:'write-failed'});assert.equal((await fourth).reason,'write-failed');f.adapter.dispose();checks++;}
 {const f=fixture(code);await f.cap();f.attempt({kind:'text',text:'pending'},()=>f.copies.push('bad'),()=>f.failures.push('failed'));await f.advance(120000);assert.equal(f.copies.length,0);assert.equal(f.failures.length,1);assert.equal(f.posted.length,2);f.answer(f.posted[1],{ok:true,status:'shared'});await flush();assert.equal(f.copies.length,0);f.adapter.dispose();assert.equal(f.listeners.size,0);checks++;}
 {const f=fixture(code);await f.cap();f.win.document.visibilityState='hidden';assert.equal((await f.adapter.share({kind:'text',text:'hidden'})).reason,'inactive');assert.equal(f.posted.length,1);f.win.document.visibilityState='visible';f.attempt({kind:'text',text:'leaving'},()=>f.copies.push('bad'),()=>f.failures.push('bad'));f.adapter.dispose();await flush();assert.equal(f.copies.length+f.failures.length,0);assert.equal(f.timers.size,0);checks++;}
 for(const caps of [null,{htmlToPdf:false},{htmlToPdf:true}])for(const android of [false,true]){const allowed=vm.runInNewContext(fn('ezikNativePdfAllowed')+'\nezikNativePdfAllowed()',{ezikNativeShare:{getCapabilities:()=>caps},ez110AndroidShell:()=>android});assert.equal(allowed,!(caps&&android&&!caps.htmlToPdf));checks++;}
 return checks;
}
const mutant=adapterCode.replace("d.v !== '1'", "d.v !== '1'").replace("capabilities?.[fields.kind] !== true",'false');
// Separate mutation targets cancellation handling in the actual caller adapter.
const badAttempt=attemptCode.replace("'shared', 'presented', 'dismissed'","'shared', 'presented'");assert.notEqual(badAttempt,attemptCode);
(async()=>{
 if(process.argv.includes('--mutant')){const f=fixture();await f.cap();vm.runInContext(badAttempt,f.context);vm.runInContext('ezikNativeShareAttempt',f.context)({kind:'text',text:'cancel'},()=>f.copies.push(1),()=>f.failures.push(1));f.answer(f.posted[1],{ok:true,status:'dismissed'});await flush();assert.equal(f.failures.length,0,'cancel must remain silent');return;}
 const n=await verify(adapterCode);
 // Executed regression for stale/malformed result correlation, not merely a string pin.
 const f=fixture();await f.cap();const pending=f.adapter.share({kind:'text',text:'valid'});f.answer(f.posted[1],{ok:false,status:'shared'});await flush();assert.equal(f.timers.size,1);f.adapter.dispose();await pending;
 for(const text of ['{ kind: \'text\', text: payload }','{ ...payload, kind: payload.url ? \'link\' : \'text\' }','{ kind: \'text\', text }','{ kind: \'text\', title: monthTitle, text }','{ kind: \'text\', title: ezT(\'panel.openMonth\'), text: body }'])assert(app.includes(text));
 assert(app.includes('if (!ezikNativePdfAllowed()) return null;'));assert(app.includes('{ezikNativePdfAllowed() && <button onClick={exportPdf}'));assert(app.includes('const canExport = deriveCaps(age).export;'));assert(app.includes("ez110FixLit() && ez110AndroidShell() ? null : actOf('pdf'"));assert(lab.includes('const text = citeRange(keys) +'));assert(lab.includes("window.parent.ezikNativeShareAttempt({ kind: 'text', text }, copied, failed)"));
 console.log('PASS S3: '+n+' real adapter/legacy/PDF scenarios; six caller bindings, exact text, file error, rapid/busy, malformed/late IDs, timeout, disposal and cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
