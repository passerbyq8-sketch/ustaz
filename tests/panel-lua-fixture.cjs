'use strict';
// Execute the actual intake Lua statements, including mutations, against a local
// Redis-shaped store. Unknown statements fail instead of assuming success.
const vm=require('node:vm');
function runPanelLua(script,keys,args,store){
 const expr=s=>s.replace(/#(KEYS|ARGV)/g,'$1.length').replace(/~=/g,'!==').replace(/\bnil\b/g,'undefined').replace(/\bor\b/g,'||').replace(/\band\b/g,'&&').replace(/\bnot\s+/g,'!').replace(/\.\./g,'+');
 const out=[];
 for(const raw of script.split('\n')){const s=raw.trim();if(!s||s.startsWith('--'))continue;let m;
  if((m=/^local (\w+) = (.+)$/.exec(s)))out.push('let '+m[1]+' = '+expr(m[2])+';');
  else if((m=/^for (\w+) = (.+), (.+) do$/.exec(s)))out.push(`for(let ${m[1]}=${expr(m[2])};${m[1]}<=${expr(m[3])};${m[1]}++){`);
  else if((m=/^if (.+?) then (.+) end$/.exec(s)))out.push('if('+expr(m[1])+'){'+expr(m[2])+';}');
  else if((m=/^if (.+?) then$/.exec(s)))out.push('if('+expr(m[1])+'){');
  else if(s==='else')out.push('}else{');
  else if(s==='end')out.push('}');
  else if(/^(?:return |redis\.call\(|\w+ = )/.test(s))out.push(expr(s)+';');
  else throw Error('Unsupported intake Lua: '+s);
 }
 const one=a=>new Proxy(a,{get(t,k){return /^\d+$/.test(String(k))?t[Number(k)-1]:t[k];}});
 return vm.runInNewContext('(function(){'+out.join('\n')+'})()',{
  KEYS:one(keys),ARGV:one(args),redis:{call:store},string:{sub:(s,a,b)=>s.slice(a-1,b)},tonumber:v=>Number.isFinite(Number(v))?Number(v):undefined
 },{timeout:1000});
}
module.exports={runPanelLua};
