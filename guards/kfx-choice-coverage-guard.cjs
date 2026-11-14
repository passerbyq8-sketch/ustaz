const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=process.env.KFX_BASE||path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'quest-theme/journey.js'),'utf8');
const code=source.match(/  function quizCatalog\(\) \{[\s\S]*?\n  }/)[0];
const ctx={global:{DATA:{cats:[['fixture']],qs:[[0,0,1,'Q',['a','b','c'],0]]}},Model:{live:()=>true,categories:()=>[{index:0,count:1}]}};
vm.createContext(ctx);vm.runInContext(code+';result=quizCatalog();',ctx);assert.equal(ctx.result.length,1,'a category with three-choice questions remains playable');
assert.ok(!source.includes('fourChoiceSlots('),'Hanna must not silently discard three-choice questions');
console.log('PASS full-bank choice coverage');
