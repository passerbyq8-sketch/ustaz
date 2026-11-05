'use strict';
// Execute the actual consume script's limited Lua grammar. No operation-name stubs:
// its comparisons, receipt retention, debit and writes control the synthetic store.
const vm=require('node:vm');
function runIapLua(script,keys,args,store){
 const expr=s=>s.replace(/~= /g,'!== ').replace(/\bnil\b/g,'undefined').replace(/\bor\b/g,'||').replace(/\band\b/g,'&&').replace(/\bnot\s+/g,'!')
  .replace(/([,{])\s*(\w+)\s*=(?!=)/g,'$1 $2:').replace(/\bmath\./g,'Math.');
 const statement=s=>s.split(';').map(x=>expr(x.trim())).join('; ');
 const out=[];
 for(const raw of script.split('\n')){const s=raw.trim();if(!s||s.startsWith('--'))continue;let m;
  if((m=/^local (\w+) = (.+)$/.exec(s)))out.push('let '+m[1]+' = '+expr(m[2])+';');
  else if((m=/^for _, (\w+) in ipairs\((\w+)\) do$/.exec(s)))out.push('for(const '+m[1]+' of '+m[2]+') {');
  else if((m=/^if (.+?) then (.+) end$/.exec(s)))out.push('if('+expr(m[1])+'){'+statement(m[2])+';}');
  else if((m=/^if (.+?) then(?: (.+))?$/.exec(s)))out.push('if('+expr(m[1])+'){'+(m[2]?statement(m[2])+';':''));
  else if((m=/^elseif (.+?) then(?: (.+))?$/.exec(s)))out.push('}else if('+expr(m[1])+'){'+(m[2]?statement(m[2])+';':''));
  else if(s==='else')out.push('}else{');
  else if((m=/^else (.+) end$/.exec(s)))out.push('}else{'+statement(m[1])+';}');
  else if((m=/^else (.+)$/.exec(s)))out.push('}else{'+statement(m[1])+';');
  else if(s==='end')out.push('}');
  else if(/^(?:return |redis\.call\(|[\w.\[\]'"\s]+ = )/.test(s))out.push(statement(s)+';');
  else throw Error('Unsupported IAP Lua: '+s);
 }
 const one=values=>new Proxy(values,{get(t,k){return /^\d+$/.test(String(k))?t[Number(k)-1]:t[k];}});
 return vm.runInNewContext('(function(){'+out.join('\n')+'})()',{
  KEYS:one(keys),ARGV:one(args),redis:{call:(...a)=>store(...a)},cjson:{decode:JSON.parse,encode:JSON.stringify,null:null},
  tonumber:v=>Number.isFinite(Number(v))?Number(v):undefined,type:v=>v!==null&&typeof v==='object'?'table':typeof v,
 },{timeout:1000});
}
module.exports={runIapLua};
