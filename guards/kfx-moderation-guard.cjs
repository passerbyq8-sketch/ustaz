'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { parseHTML } = require('linkedom');
const root = process.env.KFX_BASE || path.join(__dirname, '..');
const { document } = parseHTML('<html><head></head><body><div id="root"></div></body></html>');
class Socket {
  constructor() { this.listeners = {}; this.readyState = 1; this.sent = []; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  send(data) { this.sent.push(JSON.parse(data)); }
  receive(data) { for (const fn of this.listeners.message || []) fn({data:JSON.stringify(data),stopImmediatePropagation(){}}); }
}
let redirected = '', notice = '', confirmed = '', posted;
const win = { document, WebSocket:Socket, fetch:async(u,i)=>{posted=JSON.parse(i.body);}, setTimeout:fn=>fn(), MutationObserver:class {observe(){}},
  confirm:s=>{confirmed=s;return true;},prompt:()=> '٥٠',sessionStorage:{setItem:(k,v)=>{notice=v;}},location:{replace:p=>{redirected=p;}},
  KunuzJourney:{state:{settings:{difficulty:'hard'}}} };
win.window=win; vm.runInNewContext(fs.readFileSync(path.join(root,'quest-theme/room-features.js'),'utf8'),win);
const ws=new win.WebSocket('ws://localhost/ws/rooms/1234'); ws.send(JSON.stringify({t:'hello'})); assert.equal(ws.sent[0].kfx,1);
assert.equal(document.querySelector('[data-kfx-controls]'),null,'old servers expose no new controls');
ws.receive({t:'snapshot',snapshot:{teams:[{name:'First'}]}});
ws.receive({t:'kfxState',host:false,members:[],deduct:false}); assert.equal(document.querySelector('[data-kfx-controls]'),null);
const journey=document.createElement('div');journey.className='journey-app';journey.innerHTML='<main class="j-content"></main>';document.body.append(journey);document.body.classList.add('journey-room');
ws.receive({t:'kfxState',host:true,members:[{id:'opaque',name:'Guest'}],deduct:true});
assert.equal(document.querySelector('[data-kfx-controls]').parentNode,journey,'native room controls must sit outside hidden Journey main');
const buttons=[...document.querySelectorAll('[data-kfx-controls] button')]; assert.equal(buttons.length,2);
buttons[0].onclick();assert.equal(confirmed,'تطرد هذا اللاعب؟');assert.deepEqual(ws.sent.at(-1),{t:'kfxKick',target:'opaque'});
buttons[1].onclick();assert.deepEqual(ws.sent.at(-1),{t:'kfxDeduct',slot:0,amount:50});
ws.receive({t:'kfxKicked'});assert.equal(notice,'أخرجك صاحب الغرفة');assert.equal(redirected,'/quest.html');
win.fetch('/api/war/rooms',{method:'POST',body:JSON.stringify({config:{}})}).then(()=>{assert.equal(posted.config.difficulty,'hard');console.log('PASS KFX host controls, Arabic confirmation, deduction, kicked route, capability fallback and host difficulty');});
