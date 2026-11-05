'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.join(__dirname,'..'),pages=['quest.html','quest-board.html','quest-test.html','quest-ghaws.html','quest-harb.html','hanna-laha/index.html'];
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),worker=read('quest-sw.js'),html=Object.fromEntries(pages.map(p=>[p,read(p)]));
const registry=JSON.parse(read('guards/asset-versions.json')).assets,asset='/quest-theme/journey.js',old='20261103-iapsignin1';
const current=read(asset.slice(1)),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
async function verify(documents,source){
 const version=source.match(/const VERSION = '([^']+)';/)[1];assert.notEqual(version,old,'new worker database/precache version');
 assert.equal(registry[asset.slice(1)+'?v='+old],'2eea4e325072236fc82578295da9528b89be7dfc0de217ccdb73d55351d66665','old immutable entry retained');
 assert.equal(registry[asset.slice(1)+'?v='+version],hash(current),'new immutable entry');
 for(const [p,body]of Object.entries(documents)){const refs=[...body.matchAll(/(?:src|href)="([^"]*journey\.js\?v=[^"]+)"/g)];assert.equal(refs.length,2,p+' preload and script');for(const r of refs)assert.equal(new URL(r[1],'https://fixture.invalid/'+p).searchParams.get('v'),version,p+' new URL');}
 const handlers={},disk=new Map([[asset+'?v='+old,'OLD_JOURNEY']]),requests=[];
 const scope={URL,Request,Response,Set,Map,Promise,Uint8Array,crypto:crypto.webcrypto,importScripts:()=>{},self:{location:{origin:'https://fixture.invalid'},KUNUZ_PACKS:[],addEventListener:(k,v)=>handlers[k]=v},
  fetch:async req=>{const u=typeof req==='string'?req:req.url;requests.push(u);const response=new Response(current);Object.defineProperty(response,'url',{value:u});return response;},
  readFixture:async key=>disk.has(key)?new Response(disk.get(key)):null,writeFixture:async(key,response)=>disk.set(key,await response.text())};
 const context=vm.createContext(scope);
 // The previous worker's cache-first routing sees the new HTML URL. Only its
 // storage boundary is faked; its actual fetch handler executes unchanged.
 vm.runInContext(source.replace("const VERSION = '"+version+"';","const VERSION = '"+old+"';")+'\nreadAsset=readFixture;writeAsset=writeFixture;',context);
 assert(vm.runInContext("SHELL.includes('/quest-theme/journey.js')",context),'journey remains in precache');
 let reply;handlers.fetch({request:new Request('https://fixture.invalid'+asset+'?v='+version),respondWith:p=>reply=p});
 assert(reply,'asset request handled');assert.equal(await (await reply).text(),current);assert.equal(requests.length,1,'new URL bypasses stale cache');
 assert.equal(disk.get(asset+'?v='+old),'OLD_JOURNEY','old key does not alias new bytes');
 handlers.fetch({request:new Request('https://fixture.invalid'+asset+'?v='+version),respondWith:p=>reply=p});assert.equal(await (await reply).text(),current);assert.equal(requests.length,1,'new bytes cached for later use');
}
(async()=>{await verify(html,worker);await assert.rejects(()=>verify({...html,'quest.html':html['quest.html'].replaceAll('20261105-c1d3-1',old)},worker));await assert.rejects(()=>verify(html,worker.replace("const VERSION = '20261105-c1d3-1';","const VERSION = '"+old+"';")));await assert.rejects(()=>verify(html,worker.replace("'/quest-theme/journey.js',",'')));await verify(html,worker);console.log('PASS R11: six pages, immutable hashes, versioned precache, old cache-first delivery; three regressions rejected.');})().catch(e=>{console.error(e);process.exitCode=1;});
