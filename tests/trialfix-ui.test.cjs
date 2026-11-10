const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
test('trialfix-d2 middle position and tour snapshot survive detachment; explicit opens keep their pin',()=>{
 const start=source.indexOf('  const chatPositions = useRef(new Map());'),end=source.indexOf('\n  //',start);
 const refStart=source.indexOf('  const messagesAreaRef = React.useMemo('),refEnd=source.indexOf('  //',refStart);
 const block=source.slice(start,end), refBlock=source.slice(refStart,refEnd);let snapshot=null;
 const state={React:{useMemo:f=>f(),useLayoutEffect:f=>state.layout=f},useRef:current=>({current}),introTour:{savedScroll:()=>snapshot},chatIdRef:{current:'one'},chatId:'one',screen:'chat',jumpToEndRef:{current:false}};
 vm.createContext(state);vm.runInContext(refBlock+block+';this.attach=messagesAreaRef;this.messagesAreaRef=messagesAreaRef;',state);
 const old={scrollTop:450};state.attach(old);state.attach(null);
 const fresh={scrollTop:0};state.attach(fresh);state.layout();assert.equal(fresh.scrollTop,450);
 snapshot=321;fresh.scrollTop=999;state.attach(null);state.attach({scrollTop:0});state.layout();assert.equal(state.messagesAreaRef.current.scrollTop,321);
 snapshot=null;state.jumpToEndRef.current=true;state.messagesAreaRef.current.scrollTop=700;state.layout();assert.equal(state.messagesAreaRef.current.scrollTop,700);
 assert(!/setInput|fetch|callAI|setMessages/.test(block),'position lifecycle cannot send a paid request or change the draft/messages');
});
test('trialfix-d4 alert labels, help and unchanged threshold behavior including null cost and acknowledgement',async()=>{
 assert(source.includes("<p>{ezT('panel.dailyLimitHelp')}</p>"));assert(source.includes("'panel.spendAlert'"));
 const p=await import('../lib/panel-health.js');
 for(const [cost,want] of [[7.99,[]],[8,['spend80']],[9.49,['spend80']],[9.5,['spend95']],[10,['spend95']],[11,['spend95']],[null,[]]])assert.deepEqual(p.evaluateAlerts({}, {},cost,10),want);
 const data=new Map(),store={get:async k=>data.get(k)??null,set:async(k,v,o)=>{if(o?.nx&&data.has(k))return null;data.set(k,v);return 'OK';}};
 const read=async b=>b.days===7?{read:100,noFind:1,faults:1}:{read:100,noFind:40,faults:25};
 const a=await p.readPanelHealth(store,{read,now:new Date('2026-11-08T01:00:00Z')});
 await p.acknowledgeAlert(store,a.alerts[0].id);assert.equal((await p.readPanelHealth(store,{read,now:new Date('2026-11-08T02:00:00Z')})).alerts[0].acknowledged,true);
});
test('trialfix-d6 enabled hover rule and measured contrast; disabled/focus baseline unaffected',()=>{
 const css=fs.readFileSync(path.join(root,'quest-theme/theme.css'),'utf8');
 assert(css.includes('.ezik-treasure-theme.journey-room .btn.solid:hover:not(:disabled){background:#0e4f72;color:#fff8eb}'));
 const luminance=hex=>{const c=hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
 const contrast=(luminance('fff8eb')+0.05)/(luminance('0e4f72')+0.05);assert.equal(contrast.toFixed(2),'8.35');
 // This source-level check does not claim browser computed styles or touch emulation.
 assert(!css.slice(css.indexOf('/* ORDER T1 D6')).includes(':focus'));
});
test('trialfix-d8 old current future and missing versions retain server counts and separate labels',async()=>{
 const {summarizeVersions}=await import('../lib/panel-versions.js');const ids=['a','b','c','d'].map(x=>x.repeat(32));
 const x=summarizeVersions([ids],[[ids[0],'v:ezik-v145',ids[1],'v:ezik-v146',ids[2],'v:ezik-v147']],'ezik-v146');
 assert.equal(x.old,1);assert.equal(x.other,1);assert.equal(x.current,1);assert.equal(x.unknown,1);assert.equal(x.versions.reduce((n,r)=>n+r.n,0),x.known);assert.equal(x.known+x.unknown,x.active);
 const component=source.slice(source.indexOf('function EzPanelVersionDevices'),source.indexOf('function EzikUsageBoard'));
 for(const key of ['versionHeading','versionUnknown','versionOther','versionCurrent','versionFooter'])assert(component.includes('panel.'+key));
 assert(component.length > 0 && !component.includes('data.unknown + data.other'));
});
