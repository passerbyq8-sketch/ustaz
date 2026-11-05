'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'library.html'),'utf8');
function verify(body){
 const script=[...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var EZ110_FIX ='));
 assert(script,'library UI script');const ast=parser.parse(script);let flag,back;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.name==='EZ110_FIX')flag=n.init;if(n.type==='FunctionDeclaration'&&n.id.name==='ez110Back')back=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
 walk(ast.program);assert(flag&&back);
 for(const hostname of ['ezik.app','preview.example','localhost'])for(const marker of [null,'0','1','throws']){
  const sessionStorage={getItem:()=>{if(marker==='throws')throw Error('blocked storage');return marker;}};
  assert.equal(vm.runInNewContext('('+script.slice(flag.start,flag.end)+')',{location:{hostname,search:''},window:{sessionStorage}}),true,'public entry without a marker or query');
 }
 for(const length of [1,2]){const calls=[];const scope={history:{length,back:()=>calls.push('back'),pushState:()=>{throw Error('must not push');}},location:{replace:p=>calls.push(p)}};
  vm.runInNewContext(script.slice(back.start,back.end)+";ez110Back('#/book/fixture');",scope);assert.deepEqual(calls,length>1?['back']:['#/book/fixture']);}
 for(const needle of ["EZ110_LIBKEEP = { mode: st.mode, q: input.value, scope: st.scope, offset: st.offset, top: ctx.keep() }",'input.value = kept.q; st.scope = kept.scope;',"if (EZ110_FIX) { ez110Back('#/book/' + bookId); return; }","input.setAttribute('aria-label', p)","'aria-label': T('back')"])assert(script.includes(needle),'retained search/back/accessibility: '+needle);
}
verify(html);
for(const [from,to]of [['var EZ110_FIX = true;','var EZ110_FIX = false;'],['input.value = kept.q; st.scope = kept.scope;','st.scope = kept.scope;']]){const mutant=html.replace(from,to);assert.notEqual(mutant,html);assert.throws(()=>verify(mutant));}
verify(html);console.log('PASS R1: fresh public and in-app entry, blocked storage, back without push, retained search state and accessible names; two mutations rejected.');
