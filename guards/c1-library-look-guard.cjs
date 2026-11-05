'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'library.html'),'utf8');
function verify(body){
 const css=body.match(/<style>([\s\S]*?)<\/style>/)[1];
 for(const token of ['--vt-page:#FFFFFF','--vt-surface2:#EAF3FF','--vt-ink:#172033','--vt-accent:#2455E8','--vt-line:#E7EDF7','--vt-radius-sig:18px','--vt-page:#111827','--vt-surface2:#23334F','--vt-accent:#9BBEFF'])assert(css.includes(token),'menu token '+token);
 assert.equal((css.match(/--vt-shadow:none;/g)||[]).length,3,'flat light/dark/sepia');
 const rule=selector=>{const at=css.indexOf(selector+'{');assert(at>=0);return css.slice(at,css.indexOf('}',at)+1);};
 assert(rule('.hero').includes('background:var(--vt-page)'),'quiet hero');assert(rule('.hero').includes('padding:24px 20px 20px'),'hero spacing');
 assert(rule('.cat').includes('background:var(--vt-surface2)'),'pale menu tiles');assert(rule('.cat').includes('box-shadow:none'),'flat tiles');
 assert(rule('.ibtn').includes('background:var(--vt-surface2)'),'menu controls');assert(rule('.search').includes('border:1px solid var(--vt-line)'),'search boundary');
 const tail=body.slice(body.indexOf('</style>'));assert.equal(crypto.createHash('sha256').update(tail).digest('hex'),'8e06c7f6897db01a8ac10857d67157fcca5d203bd2e0ef7316f4d2132e3d27a6','all navigation, search, R1 entry and accessible markup/scripts preserved');
}
verify(html);
for(const [from,to] of [['#EAF3FF','#EEF6F7'],['--vt-radius-sig:18px','--vt-radius-sig:120px 120px 18px 18px'],['--vt-shadow:none;','--vt-shadow:0 18px 45px #000;'],['box-shadow:none','box-shadow:0 1px 0 var(--vt-line)'],['var EZ110_FIX = true;','var EZ110_FIX = false;']]){const mutant=html.replace(from,to);assert.notEqual(mutant,html);assert.throws(()=>verify(mutant));}
verify(html);console.log('PASS D44: October menu surfaces, controls, flat hero/tiles, unchanged behavior/accessibility; five mutations rejected.');
