'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8'),ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const names=['ezikWidgetNumeralSet','ezikWidgetData'];
const code=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
async function verify(body){let checks=0;
 for(const lang of ['ar','en'])for(const [digits,want] of [['latn','western'],['arab','arabic-indic'],[undefined,undefined],['arabext',undefined],['western',undefined],[null,undefined],['throw',undefined]]){
  const days=Array.from({length:30},(_,i)=>({date:new Date(Date.UTC(2026,10,5+i)).toISOString().slice(0,10),times:{fajr:'05:01'},dateLabel:'day '+i,hijriLabel:'hijri '+i}));
  const fn=vm.runInNewContext(body+'\nezikWidgetData',{EZ_LANG:lang,readPrayerPrefs:()=>{if(digits==='throw')throw Error('blocked');return {digits};},loadAdhkar:async()=>null,loadAdhkarSplit:async()=>null,loadArbaeen:async()=>null,ezikWidgetPrayerDays:()=>days,ezikWidgetSections:()=>['prayer']});
  const d=JSON.parse(JSON.stringify(await fn(new Date('2026-11-05T01:00:00Z'))));
  assert.equal(d.version,1);assert.deepEqual(d.prayer.days,days);assert.equal(d.prayer.numeralSet,want);assert.equal(Object.hasOwn(d.prayer,'numeralSet'),want!==undefined);assert.equal(d.prayer.days[1].date,'2026-11-06');
  // An old v1 consumer picks only its known days property; the optional choice cannot alter legacy times/metadata.
  const legacy={days:d.prayer.days};assert.deepEqual(legacy,{days});checks++;
 }
 return checks;
}
const mutant=code.replace("const digits = readPrayerPrefs().digits", "const digits = 'arab'");assert.notEqual(mutant,code);
(async()=>{if(process.argv.includes('--mutant'))await verify(mutant);else{const n=await verify(code);await assert.rejects(()=>verify(mutant),assert.AssertionError);console.log('PASS O3-R1: '+n+' real payload cases; locale-independent enum, absent/invalid/error omission, next-day/30-day preservation and old-v1 shape.');}})().catch(e=>{console.error(e);process.exitCode=1;});
