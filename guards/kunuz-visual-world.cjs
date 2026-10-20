'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {DOMParser}=require('linkedom');
// Linkedom's XML parser reports the HTML namespace for every XML element.
// Restore the actual inherited xmlns for the SVG-only sanitizer tests. Chromium
// separately runs the same sanitizer with its native XML parser.
class SvgParser {parseFromString(s,type){const d=new DOMParser().parseFromString(s,type);function walk(n,ns){if(n.nodeType!==1)return;ns=n.getAttribute('xmlns')||ns;Object.defineProperty(n,'namespaceURI',{value:ns});for(const c of n.childNodes)walk(c,ns)}walk(d.documentElement,null);return d}}
const {VER,El,Txt,parseInto}=require('./kunuz-sim/dom.cjs');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const bank=new Function(read('quest-data/kunuz-bank-3147.js')+';return DATA')();
let world=read('guards/kunuz-sim/world.cjs');world=world.slice(world.indexOf('// ---------- world ----------'),world.indexOf('// ---------- synthetic bank'));
world=world.replace('DATA, Math: M,','DATA, localStorage:o.storage, Math: M,').replace('M.random = R','M.random = o.random');
const makeWorld=new Function('fs','vm','VER','El','Txt','parseInto',world+';return makeWorld')(fs,vm,VER,El,Txt,parseInto);
function rng(seed=42){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function store(){const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
async function open(page,{moduleText,pack,enabled=true,storage=store(),manifest,body,bodies,seed=42,baseline=false}={}){
  const text=read(page),sa=text.lastIndexOf('<script>'),sb=text.indexOf('</script>',sa),bs=text.indexOf('<body>')+6,be=text.indexOf('<script',bs);
  const data=JSON.parse(JSON.stringify(bank));
  const W=makeWorld({BODY:text.slice(bs,be),ENGINE:text.slice(sa+8,sb)},data,{
    'quest-ghaws.html':['home','how','cfg','turn','dive','end','board','verdict'],
    'quest-harb.html':['home','how','cfg','war','win','verdict','room','join','lobby'],
    'quest-test.html':['cfg','play','end'],'quest-board.html':['cfg','play','end']
  }[page],{reduce:true,storage,random:rng(seed)});
  W.storage=storage;W.requests=[];W.doc.head=new El('head',W.doc);W.doc.documentElement.appendChild(W.doc.head);
  W.ctx.DOMParser=SvgParser;W.ctx.TextEncoder=TextEncoder;
  const append=W.doc.head.appendChild.bind(W.doc.head);
  W.doc.head.appendChild=function(node){append(node);if(node.src){W.requests.push(node.src);Promise.resolve().then(()=>{
    const p=node.src.replace(/^\//,'');if(p==='quest-data/kunuz-geo.js'||p==='quest-data/kunuz-levels-3147.js'){vm.runInContext(read(p),W.ctx);if(node.onload)node.onload()}else if(node.onerror)node.onerror();
  }).catch(e=>W.errors.push(e))}return node};
  W.ctx.fetch=async url=>{W.requests.push(url);if(bodies)return {ok:Object.hasOwn(bodies,url),text:async()=>bodies[url]};return {ok:!!pack,text:async()=>body===undefined?'KZV.register('+JSON.stringify(pack)+');':body}};
  if(!baseline){
    vm.runInContext(read('quest-data/kunuz-geo-index.js'),W.ctx);
    W.ctx.KUNUZ_PACKS=manifest|| (pack?[{slug:pack.slug,src:'quest-data/kunuz-pack-'+pack.slug+'.js'}]:[]);
    let mod=moduleText===undefined?read('quest-visual.js'):moduleText;mod=mod.replace(/var PACKS_ENABLED=(?:true|false);/,'var PACKS_ENABLED='+enabled+';');
    vm.runInContext(mod,W.ctx);await W.ctx.KZV.ready;
  }
  vm.runInContext(read('quest-levels.js'),W.ctx);await Promise.resolve();await Promise.resolve();
  return W;
}
module.exports={ROOT,read,bank,open,store,rng};
