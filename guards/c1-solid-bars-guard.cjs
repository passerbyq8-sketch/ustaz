'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
function verify(html,js){const rule=/<style id="ezik-solid-bars">([\s\S]*?)<\/style>/.exec(html);assert(rule,'solid bar override');
 for(const name of ['ezia-nav','ezsh-nav','ezist-nav','ez110-nav'])assert(rule[1].includes('html[data-ez110] .'+name),'all bar selectors');
 assert(rule[1].includes('background: var(--vt-surface, #fff) !important;'));assert(rule[1].includes('-webkit-backdrop-filter: none !important;'));assert(rule[1].includes('backdrop-filter: none !important;'));assert(!rule[1].includes('@media'),'all devices');
 const cp=/\.ezcp-nav\{([^}]+)\}/.exec(js);assert(cp);assert(cp[1].includes('background:#0c181b;'));assert(cp[1].includes('backdrop-filter:none;'));assert(!cp[1].includes('blur('));
 const css=fs.readFileSync(path.join(root,'ez110/ez110.css'),'utf8');for(const identity of ['b','c','d','e'])for(const dark of [false,true]){const selector='html:root'+(dark?'[data-theme="dark"]':'')+'[data-ez110="'+identity+'"]',a=css.indexOf(selector+'{');assert(a>=0);const block=css.slice(a,css.indexOf('}',a));assert(/--vt-surface:#[0-9A-Fa-f]{6};/.test(block),'opaque identity token');}
 const start=html.indexOf('@media (max-height:700px){.dimaScene'),end=html.indexOf('</style>',start);assert.equal(crypto.createHash('sha256').update(html.slice(start,end)).digest('hex'),'b31481360a0c2379891c96a5c56df170b9f2c0bb99f02dae2a732c591e6669a3','D12 measured block unchanged');assert.equal((html.match(/(?<!\r)\n/g)||[]).length,0);
}
const mutant=index.replace('backdrop-filter: none !important;','backdrop-filter: blur(16px) !important;');assert.notEqual(mutant,index);
if(process.argv.includes('--mutant'))verify(mutant,app);else{verify(index,app);assert.throws(()=>verify(mutant,app),assert.AssertionError);assert.throws(()=>verify(index,app.replace('background:#0c181b;','background:rgba(12,24,27,.9);')),assert.AssertionError);console.log('PASS D15: four shell bars plus control-panel bar, eight opaque theme tokens, all-device override, D12 bytes and CRLF; blur/transparency mutations rejected.');}
