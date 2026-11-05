'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8'),ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const names=['createEzikNativeHapticAdapter','ezikShortPulse','ezikHapticGestureActive','tasbihBuzz'];const code=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
function verify(body){let checks=0;
 for(const cap of [true,false,null])for(const browser of ['success','false','throw','absent']){
  let now=1000,serial=0;const timers=new Map(),sent=[],listeners=new Map(),browserPulses=[];
  const doc={visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}};
  const win={document:doc,ReactNativeWebView:{postMessage:t=>sent.push(JSON.parse(t))},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
  const nav={userActivation:{isActive:true}};if(browser!=='absent')nav.vibrate=n=>{browserPulses.push(n);if(browser==='throw')throw Error('off');return browser==='success';};
  const context=vm.createContext({window:win,document:doc,navigator:nav,Date:{now:()=>now},Math,Set,setTimeout:(f,ms)=>{timers.set(++serial,f);return serial;},clearTimeout:n=>timers.delete(n),TASBIH_VIBRATE_MS:120});vm.runInContext(body,context);
  const adapter=vm.runInContext('createEzikNativeHapticAdapter(window)',context);context.ezikNativeHaptic=adapter;
  assert.equal(sent.length,1);assert.equal(sent[0].op,'capabilities');assert.equal(browserPulses.length,0);
  if(cap!==null)listeners.get('ezik:haptic:result')({detail:{type:'ezik:haptic:result',v:'1',id:sent[0].id,ok:true,status:'capabilities',capabilities:{shortPulse:cap,durationMs:cap?10:null,hardwareVerified:false}}});
  assert.equal(adapter.canPulse(),cap===true);assert.equal(vm.runInContext('ezikShortPulse(false,120,true)',context),false);assert.equal(browserPulses.length,0);assert.equal(sent.length,1);
  vm.runInContext('ezikShortPulse(true,120,true)',context);assert.equal(sent.filter(x=>x.op==='pulse').length,cap===true&&browser!=='success'?1:0);
  const before=sent.length;adapter.pulse(true,true);assert.equal(sent.length,before+(cap===true&&browser==='success'?1:0));const after=sent.length;adapter.pulse(true,true);assert.equal(sent.length,after,'rapid tap throttled');
  now+=101;assert.equal(adapter.pulse(true,false),false);doc.visibilityState='hidden';assert.equal(adapter.pulse(true,true),false);assert.equal(vm.runInContext('ezikShortPulse(true,120,true)',context),false);doc.visibilityState='visible';
  now+=101;const old=sent.at(-1).id;if(cap===true){adapter.pulse(true,true);assert.notEqual(sent.at(-1).id,old);assert.equal(sent.at(-1).enabled,true);assert.equal(sent.at(-1).userInitiated,true);}
  adapter.dispose();assert.equal(adapter.pulse(true,true),false);assert.equal(listeners.size,0);assert.equal(timers.size,0);checks++;
 }
 return checks;
}
const mutant=code.replace('enabled !== true || userInitiated !== true ||','enabled !== true ||');assert.notEqual(mutant,code);
if(process.argv.includes('--mutant'))verify(mutant);else{const n=verify(code);assert.throws(()=>verify(mutant),assert.AssertionError);assert(source.includes('if (run.cfg.tVibe) tasbihBuzz()'));assert(source.includes('if (!okNow && r.cfg.tVibe) tasbihBuzz()'));assert(source.includes('if (readsRef.current.n > 1) ezikShortPulse(true, 30, ezikHapticGestureActive())'));console.log('PASS S4 haptic: '+n+' actual bridge/browser combinations; preference first, one source, no probe pulse, 100ms throttle, gesture/visibility, unavailable/iOS/old-shell and disposal.');}
