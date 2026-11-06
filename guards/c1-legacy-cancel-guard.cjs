'use strict';
// Reuse the measured bridge fixture and production source extraction. The original
// 47-case authbridge gate remains intact; these are additional cancellation cases.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.resolve(__dirname,'../tools/auth-bridge-measure.cjs');
const source=fs.readFileSync(file,'utf8');
const marker='// RUN, THEN REPORT.';
const at=source.lastIndexOf('// ---------------------------------------------------------------------------',source.indexOf(marker));
const tests=String.raw`
function factory(from,to) {
 let raw=HARNESS_JSX.replace('EzikSignInRow: EzikSignInRow,','ezikAuthProofClient, EZIK_NATIVE_AUTH_SUBS, EzikSignInRow: EzikSignInRow,');
 if(from) { is(raw.includes(from),'mutation applies: '+from); raw=raw.replace(from,to); }
 return new Function('env',compile(raw));
}
async function lateRow(f) {
 const p=await press({},f); const cs=new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs'); p.m.unmount();
 p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,reply(CONTRACT,sentId(p),{ok:true,url:'ezik://auth/return?ticket='+FIXTURE.ticket+'&state='+cs}));
 await flush(); eq(p.storage.keys(),[],'session keys written after row unmount');
 eq(p.fetch.calls.length,0,'exchange after row unmount');
 eq(p.win.live(CONTRACT.SHELL_AUTH_RESULT),0,'document delivery detached');
}
async function pendingExchange(f) {
 const p=scene({seed:{[CONTRACT.AUTH_SESSION_KEY]:JSON.stringify({session:'original-live',email:'',provider:'google'})}});
 let release;const original=p.env.fetch;
 p.env.fetch=(url,init)=>new URL(url).pathname==='/api/auth-exchange'?new Promise(ok=>release=()=>ok({ok:true,status:200,json:async()=>({ok:true,session:FIXTURE.session,email:FIXTURE.email,provider:'google'})})):original(url,init);
 const mod=f(p.env),client=mod.ezikAuthProofClient(), task=client.signin('google');await flush();
 const cs=new URL(JSON.parse(p.sent[0]).url).searchParams.get('cs');
 p.win.dispatch(CONTRACT.SHELL_AUTH_RESULT,reply(CONTRACT,sentId(p),{ok:true,url:'ezik://auth/return?ticket='+FIXTURE.ticket+'&state='+cs}));await flush();
 is(typeof release==='function','exchange is pending');client.cancel();release();await flush();
 eq(JSON.parse(p.storage.getItem(CONTRACT.AUTH_SESSION_KEY)).session,'original-live','original session preserved during canceled exchange');
 eq((await task).code,'canceled','canceled exchange result');client.dispose();
}
async function nativeCancel(f) {
 for(const order of ['root-first','observer-first']) for(const outcome of ['success','failed']) {
 const p=scene({seed:{[CONTRACT.AUTH_SESSION_KEY]:JSON.stringify({session:'original-live',email:'',provider:'apple'})}});
 const mod=f(p.env),client=mod.ezikAuthProofClient(),task=client.signin('apple');await flush();client.cancel();await flush();
 eq(mod.EZIK_NATIVE_AUTH_SUBS.size,0,'native component consumer detached');
 const second=client.signin('apple');await flush();eq(p.sent.length,1,'one native request while physical sheet is pending');eq((await second).code,'busy','physical sheet keeps single-flight slot');
 const payload=outcome==='success'?{type:mod.SHELL_AUTH_SESSION,v:mod.SHELL_AUTH_V,ok:true,session:FIXTURE.session,email:'',provider:'apple'}:{type:mod.SHELL_AUTH_SESSION,v:mod.SHELL_AUTH_V,ok:false,outcome};
 if(order==='root-first')mod.ezikNativeAuthReceive(payload);
 p.win.dispatch(mod.SHELL_AUTH_SESSION,payload);await flush();
 if(order==='observer-first')mod.ezikNativeAuthReceive(payload);
 eq(JSON.parse(p.storage.getItem(CONTRACT.AUTH_SESSION_KEY)).session,'original-live','late native session cannot replace original');
 eq((await task).code,'canceled','canceled native result');eq(p.win.live(mod.SHELL_AUTH_SESSION),0,'drain observer removed');
 const next=client.signin('apple');await flush();eq(p.sent.length,2,'fresh explicit attempt after sheet ended');
 mod.ezikNativeAuthReceive({type:mod.SHELL_AUTH_SESSION,v:mod.SHELL_AUTH_V,ok:true,session:FIXTURE.session,email:'',provider:'apple'});await flush();
 eq((await next).ok,true,'fresh attempt works');client.dispose();
 }
}
const watchdog=setTimeout(()=>{console.error('FAIL legacy cancellation test deadline');process.exit(1);},10000);
(async()=>{
 const cases=[['C2 O8-NOTICED-LEGACY-RED acceptance',lateRow],['cancel during held exchange',pendingExchange],['native cancellation and physical single flight',nativeCancel]];
 let failed=0;
 for(const [name,test] of cases)try{await test(factory());console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}
 if(failed){process.exitCode=1;return;}
 let killed=0;
 for(const [name,from,to,test] of [
 ['retain canceled legacy delivery','if (active.stop) active.stop(true);','void 0;',lateRow],
 ['publish completed exchange after cancel','      if (settled) return;\n      if (!got)', '      if (!got)',pendingExchange],
 ['allow canceled native publication','!legacyNativeCanceled && !observedOn','!observedOn',nativeCancel],
 ['release physical sheet on cancel',"if (cancel && bridge && provider === 'apple' && native && !settled)",'if (false)',nativeCancel],
 ['retain native component subscriber','        if (stop) stop(); if (sub) EZIK_NATIVE_AUTH_SUBS.delete(sub);','        if (stop) stop();',nativeCancel],
 ]) {
   let error=null;try{await test(factory(from,to));}catch(e){error=e;}
   is(error && !error.message.startsWith('mutation applies:'),name+' must fail behavior');killed++;console.log('MUTANT KILLED '+name+': '+error.message);
 }
 eq(killed,5,'all legacy cancellation mutations killed');
 console.log('PASS 3 legacy cancellation groups');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
`;
const copy=new Module(file,module);copy.filename=file;copy.paths=Module._nodeModulePaths(path.dirname(file));copy._compile(source.slice(0,at)+tests,file);
