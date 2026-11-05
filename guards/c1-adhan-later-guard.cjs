'use strict';
// OTA-13 / O3-R5: actual card handlers, same-opening dismissal and persisted deferral.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),React=require('react'),BB=require('../tools/babel-block.cjs');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'app.jsx'),'utf8'),block=BB.readBabelBlock({file:path.join(root,'index.html')});
const start=src.indexOf('{ez110.id && ez110AdhanCardLit()');
const jsx=src.slice(start+1,src.indexOf(') : null}',start)+8);
const helpers=src.slice(src.indexOf('function ez110AdhanAsked()'),src.indexOf('// DEVICE CHECK O1:'));
function verify(expression){
 const code=BB.transformBabelBlock({...block,raw:'globalThis.view = ('+expression+');'},{filename:'later.jsx',configFile:false,babelrc:false});
 const stored=new Map();
 function mount(){
  const scope={React,ez110:{id:'b'},ez110AdhanCardLit:()=>true,ez110AdhanShellOk:true,messages:[],streamingText:null,ezikSchedBridge:()=>true,ez110AdhanStay:false,
   readPrayerNotify:()=>false,Ez110AdhanWatch:()=>null,Ez110AdhanCard:()=>null,EZ110_ADHAN_ASKED_KEY:'asked',localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},tick:0};
  scope.setEz110AdhanStay=v=>{scope.ez110AdhanStay=v;};scope.setEz110FirstTick=f=>{scope.tick=f(scope.tick);};
  vm.runInNewContext(helpers,scope);
  const render=()=>{vm.runInNewContext(code,scope);return scope.view;};
  return {scope,render};
 }
 const f=mount();let view=f.render();assert(React.isValidElement(view));
 const [watch,card]=React.Children.toArray(view.props.children);
 card.props.onPressed();assert.equal(f.scope.ez110AdhanStay,true,'waits for explicit permission response');
 assert(React.isValidElement(f.render()),'pending or denied response remains actionable');
 card.props.onLater();assert.equal(f.scope.tick,1,'rerenders immediately');assert.equal(f.scope.ez110AdhanStay,false);
 assert.equal(f.render(),null,'Later hides in this opening');assert.equal(mount().render(),null,'Later survives reopen');
 watch.props.onGranted();assert.equal(f.render(),null,'late granted response cannot resurrect dismissed card');
 stored.clear();const g=mount();const [grant]=React.Children.toArray(g.render().props.children);grant.props.onGranted();assert.equal(g.render(),null,'grant hides card immediately');assert.equal(mount().render(),null);
}
const marker='onLater={() => { ez110MarkAdhanAsked(); setEz110AdhanStay(false); setEz110FirstTick((t) => t + 1); }}';assert(jsx.includes(marker));
const mutations=[marker.replace('ez110MarkAdhanAsked(); ','').replace('setEz110AdhanStay(false); ','setEz110AdhanStay(true); '),marker.replace('setEz110FirstTick((t) => t + 1);','')];
if(process.argv.includes('--mutant'))verify(jsx.replace(marker,mutations[0]));
else{verify(jsx);for(const m of mutations)assert.throws(()=>verify(jsx.replace(marker,m)));console.log('PASS OTA-13: actual Later/grant handlers hide now and after reopen; delayed grant remains dismissed; two mutations rejected.');}
