'use strict';
// D16: sign-out always forgets name/gender, never year/age/identity or unrelated device state.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8');
const ast=require('@babel/parser').parse(source,{sourceType:'script',plugins:['jsx']});
const declaration=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='ezikSyncSignOutWipe');assert(declaration);
const languageNode=ast.program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(n=>n.id.name==='EZ_LANG_KEY');
assert.equal(languageNode.init.type,'StringLiteral');const languageKey=languageNode.init.value;
const code=source.slice(declaration.start,declaration.end);
function verify(fn){
 for(const open of [false,true])for(const year of [2016,1996])for(const provided of [true,false,undefined]){
  const profile={name:'Saved name',gender:'female',birthYear:year,age:2026-year,pid:'fixture-person',createdAt:'2025-01-01',future:{keep:true}};
  if(provided!==undefined)profile.birthYearProvided=provided;
  const data={child_profile:JSON.stringify(profile),[languageKey]:'fr',unrelated:'keep'};const events=[];
  const scope={localStorage:{getItem:k=>data[k]||null,setItem:(k,v)=>{data[k]=v;},removeItem:k=>{delete data[k];}},ezikSyncIsOpen:()=>open,
   ezikSyncDimaClear:()=>{},EZIK_SYNC_MEM:[],ezikSyncApplying:false,
   ezikSyncJson:s=>{try{return JSON.parse(s);}catch(_){return null;}},ezikSyncKv:()=>[],ezikSyncCtr:()=>[],ezikSyncLocalPid:()=>profile.pid,
   ezikReadChatIndex:()=>[],ezikWriteChatIndex:()=>{},ezikReadA11yAll:()=>({}),ezikWriteFavs:()=>{},ezikReadFavs:()=>[],ezikSyncLibWipe:()=>{},
   PRAYER_PREFS_KEY:'prayer',EZIK_SYNC_PRAYER_FIELDS:[],EZIK_A11Y_KEY:'a11y',EZIK_SYNC_STATE_KEY:'sync',EZIK_CHAT_PREFIX:'chat:',
   window:{dispatchEvent:e=>events.push(e.type)},CustomEvent:function(type){this.type=type;}};
  const wipe=vm.runInNewContext(fn+'\nezikSyncSignOutWipe',scope);assert.equal(wipe(),open);
  assert.deepEqual(JSON.parse(data.child_profile),{...profile,name:'',gender:null});assert.equal(data[languageKey],'fr');assert.equal(data.unrelated,'keep');
  assert.deepEqual(events,['ezik:profile:signedout'],'the current app and settings receive the update');
 }
 const fail={localStorage:{getItem:()=>{throw Error('storage blocked');}},ezikSyncIsOpen:()=>false,window:{dispatchEvent:()=>{}},CustomEvent:function(){}};
 assert.doesNotThrow(()=>vm.runInNewContext(fn+'\nezikSyncSignOutWipe()',fail));
}
function verifyListeners(){
 const bus={};const profile={name:'Name',gender:'male',birthYear:2016,age:10,pid:'same'};
 const scope={window:{addEventListener:(k,f)=>(bus[k]||(bus[k]=[])).push(f),removeEventListener:()=>{}},useEffect:f=>f(),profileRef:{current:profile},voiceProfileRef:{current:profile},setProfile:p=>{scope.rendered=p;},pfDirty:{current:{name:true,gender:true}},setPfNameRaw:n=>{scope.name=n;},setPfGenderRaw:g=>{scope.gender=g;},setPfMsg:m=>{scope.message=m;}};
 for(const marker of ['D16 LIVE PROFILE START','D16 SETTINGS PROFILE START']){const a=source.indexOf('// '+marker),b=source.indexOf('// D16 PROFILE END',a);assert(a>=0&&b>a);vm.runInNewContext(source.slice(a,b),scope);}
 assert.equal(bus['ezik:profile:signedout'].length,2);bus['ezik:profile:signedout'].forEach(f=>f());
 assert.deepEqual(JSON.parse(JSON.stringify(scope.rendered)),{...profile,name:'',gender:null});assert.equal(scope.voiceProfileRef.current,scope.profileRef.current);assert.equal(scope.name,'');assert.equal(scope.gender,null);assert.equal(scope.message,'');assert.equal(Object.keys(scope.pfDirty.current).length,0);
}
const mutant=code.replace('function ezikSyncSignOutWipe() {','function ezikSyncSignOutWipe() {\n  if (!ezikSyncIsOpen()) return false;');
const languageMutant=code.replace('function ezikSyncSignOutWipe() {','function ezikSyncSignOutWipe() {\n  localStorage.removeItem('+JSON.stringify(languageKey)+');');
if(process.argv.includes('--mutant-language'))verify(languageMutant);
else if(process.argv.includes('--mutant'))verify(mutant);
else{verify(code);verifyListeners();assert.throws(()=>verify(mutant));assert.throws(()=>verify(languageMutant));console.log('PASS D16: sync on/off, child/adult years, unknown fields retained, live app/settings updated, storage failure safe; early-return and language-erasure mutations rejected.');}
