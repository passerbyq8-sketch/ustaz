'use strict';
// D3: both shipped renderers; all declared numeral systems and exact answer text.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{parseHTML}=require('linkedom'),parser=require('@babel/parser');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),journey=read('quest-theme/journey.js'),legacy=read('quest-test.html'),app=read('app.jsx');
const decl=parser.parse(app,{sourceType:'script',plugins:['jsx']}).program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(d=>d.id.name==='EZ_LANGUAGE_TABLE');
const langs=vm.runInNewContext('('+app.slice(decl.init.start,decl.init.end)+')');
function helpers(src){const a=src.indexOf('// D3 QUESTION DISPLAY START'),b=src.indexOf('// D3 QUESTION DISPLAY END',a);assert(a>=0&&b>a,'question helpers exist');return src.slice(a,b);}
// A full script supplies exact function ranges without confusing braces in strings/templates.
const statements=parser.parse(journey,{sourceType:'script'}).program.body[0].expression.callee.body.body;
const jfn=name=>{const n=statements.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return journey.slice(n.start,n.end);};
const legacyScript=Array.from(legacy.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)).map(m=>m[1]).find(s=>s.includes('function paintQ()'));assert(legacyScript);
const lbody=parser.parse(legacyScript,{sourceType:'script'}).program.body;
const lfn=name=>{const n=lbody.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return legacyScript.slice(n.start,n.end);};
function verify(jhelpers){
 for(const lang of langs){
  const base=lang.digits==='arab-indic'?0x660:lang.digits==='arab-ext'?0x6f0:lang.digits==='beng'?0x9e6:0x30;
  const expected=n=>String(n).replace(/[0-9]/g,d=>String.fromCharCode(base+Number(d)));
  for(const [kind,code]of [['journey',jhelpers],['legacy',helpers(legacy)]]){
   const {document}=parseHTML('<html><body><div id="opts"></div><div id="act"></div><p id="prog"></p></body></html>');
   const values=['Choice one','Choice two','Choice three','Choice four','Choice five','Choice six'],data=[0,0,0,'Question?',values,2],q={index:0,slotIndex:6,showTeams:new Set(),selected:null,answerRevealed:false,burned:new Set()};
   const scope={document,window:{KunuzUIText:t=>t},localStorage:{getItem:()=>lang.code},M:{settings:{options:'shown'},question:q,slots:Array.from({length:12})},global:{DATA:{qs:[data]}},game:'test',played:()=>6,esc:s=>String(s),catName:()=>'',button:(text,act,cls,attrs)=>'<button '+attrs+'>'+text+'</button>',
    $:id=>document.getElementById(id),P:{revealed:true,picked:null},cur:()=>data,tooSoon:()=>false,confirmA:()=>{},el:(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}};
   vm.runInNewContext(code,scope);
   assert.equal(vm.runInNewContext('kzQuestionDigits(712)',scope),expected(712),lang.code+' '+kind+' numeral set');
   if(kind==='journey'){
    vm.runInNewContext(['shownOptions','questionText','answers','quizQuestion'].map(jfn).join('\n')+'\nglobalThis.rendered=quizQuestion();',scope);
    const dom=parseHTML(scope.rendered).document;const counter=dom.querySelector('.j-quiz-position');assert(counter.textContent.includes(expected(7)+' ')&&counter.textContent.endsWith(expected(12)));assert.equal(counter.getAttribute('translate'),'no');
    const labels=Array.from(dom.querySelectorAll('.j-letter'),el=>el.textContent);assert.deepEqual(labels,['ar','fa'].includes(lang.code)?['\u0623','\u0628','\u062c','\u062f','\u0647\u0640','\u0648']:['A','B','C','D','E','F']);
    assert.deepEqual(Array.from(dom.querySelectorAll('[data-choice]'),el=>el.textContent),values);
   }else{
    vm.runInNewContext(lfn('paintQ')+'\npaintQ();',scope);const labels=Array.from(document.querySelectorAll('.kz-choice-letter'),el=>el.textContent.trim());assert.deepEqual(labels,['ar','fa'].includes(lang.code)?[]:['A','B','C','D','E','F']);
    for(const line of legacyScript.split('\n').filter(l=>l.includes('$("prog").textContent='))) {scope.G={asked:6,total:12};vm.runInNewContext(line,scope);assert(document.getElementById('prog').textContent.endsWith(expected(12)));}
   }
   assert.deepEqual(data[4],values,'bank choices unchanged');
  }
 }
}
const code=helpers(journey),mutant=code.replace("var set = KZ_QUESTION_NUMERALS[kzQuestionLanguage()];","var set = 'arab';");
if(process.argv.includes('--mutant'))verify(mutant);
else{verify(code);assert.notEqual(mutant,code);assert.throws(()=>verify(mutant));const letters=code.replace("lang === 'ar' || lang === 'fa' ?",'true ?');assert.notEqual(letters,code);assert.throws(()=>verify(letters));console.log('PASS D3: both actual question/answer renderers in 24 languages; app numeral systems, A-F except unchanged Arabic/Persian; bank text preserved; forced-Arabic numeral/letter mutations rejected.');}
