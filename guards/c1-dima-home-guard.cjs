'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{parseHTML}=require('linkedom');
const source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const begin=source.indexOf('const EZ_I18N = {'),end=source.indexOf('\n};',begin)+3;
const dicts=vm.runInNewContext(source.slice(begin,end)+'\nEZ_I18N');
for(const file of fs.readdirSync(path.join(root,'lang')).filter(f=>f.endsWith('.json')))dicts[file.slice(0,-5)]=JSON.parse(fs.readFileSync(path.join(root,'lang',file),'utf8'));
const table=vm.runInNewContext(source.slice(source.indexOf('const EZ_LANGUAGE_TABLE = ['),source.indexOf('// E1 (item 74'))+'\nEZ_LANGUAGE_TABLE');
const keys=['dima.home.progress','dima.home.complete','dima.home.tomorrow','dima.slot.fajr30','dima.slot.duha','dima.slot.isha'];
for(const row of table)for(const key of keys){
 const value=dicts[row.code][key];assert.ok(typeof value==='string'&&value.trim()&&!value.includes('??'),row.code+' '+key+' is translated');
 const tokens=(value.match(/\{\w+\}/g)||[]).sort();
 assert.deepEqual(tokens,key==='dima.home.progress'||key==='dima.home.complete'?['{n}','{total}']:[],row.code+' '+key+' placeholders');
}
function actual(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}',a)+2;assert.ok(a>0&&b>a,'actual function '+name);return source.slice(a,b);}
const code=['ezT','ezNum','dimaDateKey','dimaDateFromKey','dimaDateAdd','dimaIndexForDate','dimaLogFor','DimaHomeCard'].map(actual).join('\n');
const compiled=require('@babel/core').transformSync(code,{presets:[[require('@babel/preset-react'),{runtime:'classic'}]],configFile:false,babelrc:false}).code;
const ctx=vm.createContext({React,Date,EZ_I18N:dicts,EZ_LANG_FALLBACK:'ar',EZ_DIGIT_BASE:{'arab-indic':0x660,'arab-ext':0x6f0,beng:0x9e6},
 EZ_LANG_DIR:Object.fromEntries(table.map(r=>[r.code,r.dir])),ezLangEntry:code=>table.find(r=>r.code===code),
 useState:init=>[typeof init==='function'?init():init,()=>{}],useEffect:()=>{},useEzLang:()=>{},
 EZH_NAV_MENU:'Menu',EZH_ICON_MENU:null,EZH_SALAM:'Greeting',EZH_HELLO:'Hello',EZH_HELLO_NO_NAME:'Hello',
 dimaCivilDate:()=>new Date(),DimaDropMark:()=>null,DimaPlant:()=>null});
vm.runInContext(compiled+'\nthis.renderHome=DimaHomeCard;',ctx);
const day=ctx.dimaDateKey(new Date());let checks=0;
for(const row of table)for(const count of [0,1,2,3])for(const slot of ['fajr30','duha','asr','isha'])for(const notify of [false,true]){
 ctx.EZ_LANG=row.code;
 ctx.dimaReadStore=()=>({startDate:day,log:{[day]:{l:count>0?1:0,q:count>1?1:0,j:count>2?1:0}},notify:{on:notify,slot}});
 const markup=renderToStaticMarkup(React.createElement(ctx.renderHome,{name:'TEST'}));
 const {document}=parseHTML(markup),get=s=>document.querySelector(s);
 const expected=ctx.ezT(count===3?'dima.home.complete':'dima.home.progress',{n:ctx.ezNum(count),total:ctx.ezNum(3)});
 assert.equal(get(count===3?'.dimaHomeDoneBadge span':'.dimaHomeProgressLabel').textContent,expected,row.code+' count '+count);
 assert.ok(get('.dimaHomeOpen').getAttribute('aria-label').includes(expected),'accessible progress matches visible progress');
 assert.equal(get('.dimaHomeBanner').getAttribute('dir'),row.dir);
 assert.ok(!/\{(?:n|total)\}/.test(markup));
 if(count===3){
  const reminder=get('.dimaHomeMeet').textContent,slotKey=slot==='asr'?'reminders.anchor.asr':'dima.slot.'+slot;
  assert.ok(reminder.startsWith(dicts[row.code]['dima.home.tomorrow']));
  assert.equal(reminder.includes(dicts[row.code][slotKey]),notify,'reminder follows saved preference');
 }
 checks++;
}
assert.equal((fs.readFileSync(path.join(root,'index.html'),'utf8').match(/(?<!\r)\n/g)||[]).length,0,'index.html remains pure CRLF');
console.log('PASS item 5-a: '+checks+' home render cases, 24 dictionaries, counters, reminders and directions');
