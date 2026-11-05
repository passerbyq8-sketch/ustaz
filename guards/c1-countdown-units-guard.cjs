'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const parser=require('@babel/parser'),root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const names=['prayerCountdownFields','prayerCountdownUnits','prayerCountdownDescription','prayerDigits','ez110Countdown','prayerCountdownText','prayerCountdownUi'];
const code=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
assert.equal(ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).length,names.length);
function literal(name){for(const n of ast.program.body)if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.name===name)return vm.runInNewContext('('+source.slice(d.init.start,d.init.end)+')');throw Error(name);}
const dictionaries=literal('EZ_I18N'),langs=literal('EZ_LANGUAGE_TABLE');
for(const {code:lang} of langs)if(!dictionaries[lang])dictionaries[lang]=JSON.parse(fs.readFileSync(path.join(root,'lang',lang+'.json'),'utf8'));
function verify(body){let checks=0;
 for(const unit of ['hour','minute','second']){assert(/[\u0600-\u06ff]/.test(dictionaries.ku['countdown.'+unit]));assert(!/[A-Za-z]/.test(dictionaries.ku['countdown.'+unit]));}
 for(const {code:lang} of langs)for(const digits of ['latn','arab']){
  const dict=dictionaries[lang];for(const unit of ['hour','minute','second'])assert(dict['countdown.'+unit]);
  const f=vm.runInNewContext(body+'\n({prayerCountdownUnits,prayerCountdownDescription,ez110Countdown,prayerCountdownUi,prayerDigits})',{
   ezT:k=>dict[k],readPrayerPrefs:()=>({digits}),PRAYER_AR_DIGITS:'\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',ezikBrowseNum:String});
  for(const [sec,compact,full,values] of [[9360,'2:36:00','02:36:00',[2,36,0]],[3599,'59:59','00:59:59',[0,59,59]],[113,'1:53','00:01:53',[0,1,53]],[59,'59','00:00:59',[0,0,59]],[0,'0','00:00:00',[0,0,0]]]){
   assert.equal(f.prayerDigits(f.ez110Countdown(sec*1000)),f.prayerDigits(compact));assert.equal(f.prayerCountdownUi(sec*1000),f.prayerDigits(full));
   for(const short of [false,true]){const start=short?(values[0]?0:values[1]?1:2):0,units=['hour','minute','second'].slice(start);
    assert.equal(f.prayerCountdownUnits(sec*1000,short),units.map(u=>dict['countdown.'+u]).join(' : '));
    const description=f.prayerCountdownDescription(sec*1000,short);
    assert.equal(description,values.slice(start).map((v,i)=>f.prayerDigits(v)+' '+dict['countdown.'+units[i]]).join(', '));
    assert(digits==='arab'?!/[0-9]/.test(description):!/[\u0660-\u0669]/.test(description));checks++;
   }
  }
 }
 // Both actual renderers expose the same formatter output and hide duplicate numeric/legend text from AT.
 for(const compact of ['true','false']){assert(source.includes('role="timer" aria-label={prayerCountdownDescription(status.remainingMs, '+compact+')}'));assert(source.includes('{prayerCountdownUnits(status.remainingMs, '+compact+')}'));}
 return checks;
}
const mutant=code.replace(".map(p => ezT('countdown.' + p.unit))",".map(p => '')");assert.notEqual(mutant,code);
if(process.argv.includes('--mutant'))verify(mutant);else{const n=verify(code);assert.throws(()=>verify(mutant),assert.AssertionError);console.log('PASS D33: '+n+' localized countdown descriptions/legends, both digit sets, five boundaries, both real renderer bindings; missing-unit mutation rejected.');}
