'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('34.5 actual intake Lua overwrites one device version and expires its daily hash',()=>{
 const {runPanelLua}=require('./panel-lua-fixture.cjs');
 const source=fs.readFileSync('lib/usage.js','utf8').match(/export const WRITE_USAGE_SCRIPT = `([\s\S]*?)`;/)[1].replace(/\$\{USAGE_DAILY_EVENT_CAP\}/g,'50000');
 const records=new Map(),expiry=new Map();let n=0;
 const store=(cmd,k,v,value)=>{if(cmd==='GET')return 0;if(cmd==='INCR')return ++n;if(cmd==='HSET'){records.set(k+v,value);return 1;}if(cmd==='EXPIRE'){expiry.set(k,v);return 1;}return 1;};
 for(const v of ['v:ezik-v136','v:ezik-v137'])runPanelLua(source,['opens','hll','stats','active','intake'],['a'.repeat(32),34560000,691200,'h:1',v],store);
 assert.equal(records.size,1);assert.equal([...records.values()][0],'v:ezik-v137');assert.equal(expiry.get('active:versions'),691200);
 const mutant=source.replace("redis.call('HSET', KEYS[4] .. ':versions', ARGV[1], ARGV[i])",'');records.clear();
 runPanelLua(mutant,['opens','hll','stats','active','intake'],['a'.repeat(32),34560000,691200,'v:ezik-v137'],store);assert.equal(records.size,0);
});
test('34.5 latest version per active device, seven days, no five-version truncation or identifiers',async()=>{
 const {summarizeVersions}=await import('../lib/panel-versions.js');
 const a='a'.repeat(32),b='b'.repeat(32),c='c'.repeat(32);
 const out=summarizeVersions([[a,b],[a,c]],[[a,'v:ezik-v137',b,'v:ezik-v136'],[a,'v:ezik-v136',c,'v:ezik-v136']], 'ezik-v137');
 assert.deepEqual(out,{active:3,known:3,unknown:0,current:1,old:2,other:0,versions:[{v:'ezik-v136',n:2},{v:'ezik-v137',n:1}]});
 const ids=Array.from({length:8},(_,i)=>i.toString(16).padStart(32,'0'));
 assert.equal(summarizeVersions([ids],[ids.flatMap((id,i)=>[id,'v:'+i])],'7').versions.length,8);
 assert(!JSON.stringify(out).includes(a));
 assert.equal(summarizeVersions([[a]],[],'ezik-v137').unknown,1);
 const s=fs.readFileSync('lib/panel-versions.js','utf8');
 const mutant=s.replace('if (!latest.has(id)) latest.set(id, v.slice(2));','latest.set(id, v.slice(2));');
 const fn=vm.runInNewContext(mutant.slice(mutant.indexOf('export function summarizeVersions')).replace('export function','function')+';summarizeVersions');
 assert.notEqual(fn([[a]],[[a,'v:ezik-v137'],[a,'v:ezik-v136']],'ezik-v137').old,0);
});
