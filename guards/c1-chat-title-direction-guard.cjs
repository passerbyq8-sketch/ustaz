'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),BB=require('../tools/babel-block.cjs');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.jsx'),'utf8'),block=BB.readBabelBlock({file:path.join(root,'index.html')});
const specs=[['header',/<span className="ezc-brand-text"[^>]*>\{ezcTitle\}<\/span>/],['history',/<span[^>]*s\.drawerChatTitle[^>]*>\{c\.title\}<\/span>/],['search',/<span[^>]*s\.drawerResultTitle[^>]*>\{r\.title\}<\/span>/]];
const titles=['A long English title (42): the beginning must remain visible','\u0639\u0646\u0648\u0627\u0646 \u0639\u0631\u0628\u064a (42)','42 - English / \u0639\u0631\u0628\u064a'];
function check(text){for(const title of titles){const style={overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};const scope={React:{createElement:(type,props,children)=>({type,props,children})},s:{drawerChatTitle:style,drawerResultTitle:style},ezcTitle:title,c:{title},r:{title}};
 vm.runInNewContext(BB.transformBabelBlock({...block,raw:'globalThis.el = ('+text+');'},{filename:'chat-title.jsx',configFile:false,babelrc:false}),scope);
 assert.equal(scope.el.type,'span');assert.equal(scope.el.props.dir,'auto');assert.equal(scope.el.props.style.unicodeBidi,'isolate');assert.equal(scope.el.children,title,'stored title is unchanged');if(!text.includes('ezc-brand-text'))assert.equal(scope.el.props.style.textOverflow,'ellipsis');}}
for(const [name,re] of specs){const m=source.match(re);assert(m,name+' actual span');check(m[0]);for(const [what,mutant] of [['direction',m[0].replace('dir="auto"','dir="rtl"')],['isolation',m[0].replace("unicodeBidi: 'isolate'","unicodeBidi: 'normal'")]]){assert.notEqual(mutant,m[0],name+' '+what+' mutation applied');assert.throws(()=>check(mutant));}}
console.log('OTA-1 / O3-R4 PASS: actual header, history and search spans preserve text, auto direction and isolation; six mutations rejected.');
