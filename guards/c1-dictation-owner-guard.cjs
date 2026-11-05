'use strict';
// D27: real dictation entry, post-prompt continuation, restart and cloud-send functions.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8');
const ast=require('@babel/parser').parse(source,{sourceType:'script',plugins:['jsx']}),fns={};
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init&&n.init.type==='ArrowFunctionExpression')fns[n.id.name]=source.slice(n.init.start,n.init.end);for(const [k,v]of Object.entries(n))if(!['loc','start','end','extra'].includes(k)){if(Array.isArray(v))v.forEach(walk);else walk(v);}}walk(ast);
const required=['startListening','startCloudDictation','stopCloudDictation','ezStartRecognition'];required.forEach(n=>assert(fns[n],n));
function fixture({owner=true,consent=true,child=false,expireAt=''}={}){
 const counts={mic:0,starts:0,sends:0,stops:0,recorders:0,kills:0};let allowed=owner;
 const rec={state:'recording',mimeType:'audio/webm',start:()=>{counts.starts++;},stop(){counts.stops++;if(this.onstop)this.onstop();}};
 const stream={getTracks:()=>[{stop:()=>{counts.stops++;}}]};
 const scope={hasFounderToken:()=>allowed,hasValidAIConsent:()=>consent,childVoiceBlocked:()=>child,showChildVoiceNotice:()=>{},setVoiceError:()=>{},setIsListening:()=>{},setTimeout:()=>0,setAiConsent:()=>{},aiConsentStatus:()=>'',EZ_SPEECH_NO_CONSENT:'consent',
  DICTATE_CLOUD:false,isSpeaking:false,input:'draft',stopSpeaking:()=>{},baseTextRef:{current:''},transcriptRef:{current:''},shouldListenRef:{current:false},dictationOpenRef:{current:false},recognitionRef:{current:rec},
  navigator:{mediaDevices:{getUserMedia:async()=>{counts.mic++;if(expireAt==='mic')allowed=false;return stream;}}},
  dictRecRef:{current:rec},dictStreamRef:{current:stream},dictChunksRef:{current:[new Uint8Array(2000)]},
  MediaRecorder:function(){counts.recorders++;return rec;},pickRecMime:()=>({}),Blob,
  stopDictAll:()=>{counts.stops++;},blobToBase64:async()=>{if(expireAt==='encode')allowed=false;return 'fixture-audio';},
  deriveCaps:()=>({band:'adult'}),profileRef:{current:{age:30}},aiFetch:async()=>{counts.sends++;return {ok:true,json:async()=>({text:'fixture transcript'})};},setInput:()=>{},ezKillRecognizer:()=>{counts.kills++;}};
 scope.ezStartRecognition=vm.runInNewContext('('+fns.ezStartRecognition+')',scope);
 scope.startCloudDictation=vm.runInNewContext('('+fns.startCloudDictation+')',scope);
 return {scope,counts,rec,expire:()=>{allowed=false;}};
}
async function verify(fnSet){
 for(const name of ['startListening','startCloudDictation','stopCloudDictation']){
  const f=fixture({owner:false});await vm.runInNewContext('('+fnSet[name]+')',f.scope)();assert.equal(f.counts.mic,0,name+' non-owner never opens mic');assert.equal(f.counts.starts,0,name+' non-owner never starts recognizer');assert.equal(f.counts.sends,0,name+' non-owner never sends audio');
 }
 for(const options of [{consent:false},{child:true}]){const f=fixture(options);await vm.runInNewContext('('+fnSet.startListening+')',f.scope)();assert.equal(f.counts.mic,0);assert.equal(f.counts.starts,0);}
 for(const name of ['startListening','startCloudDictation']){
  const f=fixture();await vm.runInNewContext('('+fnSet[name]+')',f.scope)();assert.equal(f.counts.mic,1,name+' owner still records');assert.equal(f.counts.starts,1);
  const late=fixture({expireAt:'mic'});await vm.runInNewContext('('+fnSet[name]+')',late.scope)();assert.equal(late.counts.starts,0,name+' expiry during permission prompt refuses continuation');assert(late.counts.stops>0);
 }
 const send=fixture();await vm.runInNewContext('('+fnSet.stopCloudDictation+')',send.scope)();assert.equal(send.counts.sends,1);
 const late=fixture({expireAt:'encode'});await vm.runInNewContext('('+fnSet.stopCloudDictation+')',late.scope)();assert.equal(late.counts.sends,0,'expiry during audio encoding refuses send');
 const restart=fixture({owner:false});restart.rec.ezikFounderOnly=true;
 const begin=vm.runInNewContext('('+fnSet.ezStartRecognition+')',restart.scope);assert.equal(begin(restart.rec),false);assert.equal(restart.counts.starts,0);assert.equal(restart.counts.kills,1);
 const ordinary=fixture({owner:false});assert.equal(vm.runInNewContext('('+fnSet.ezStartRecognition+')',ordinary.scope)(ordinary.rec),true,'other consented recognizers keep their existing policy');
}
(async()=>{
 const mutated={...fns,startListening:fns.startListening.replace('if (!hasFounderToken()) return;', '')};
 if(process.argv.includes('--mutant'))await verify(mutated);
 else{await verify(fns);assert.notEqual(mutated.startListening,fns.startListening);await assert.rejects(()=>verify(mutated));assert(source.includes('recognition.ezikFounderOnly = true;'),'dictation restart is tagged');assert(source.includes('disabled={isLoading || !hasFounderToken()}'),'mic reflects owner gate');console.log('PASS D27: owner/guest, age and consent, permission/encoding expiry, automatic restart and cloud send; non-dictation policy preserved; entry mutation rejected.');}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
