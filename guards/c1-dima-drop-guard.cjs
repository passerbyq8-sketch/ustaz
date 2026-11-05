'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const chosen='M12 2.8C11.25 5.45 9.6 7.55 7.6 9.35C5.7 11.05 4.8 12.85 4.8 15.05C4.8 19.03 8.02 21.3 12 21.3C15.98 21.3 19.2 19.03 19.2 15.05C19.2 12.85 18.3 11.05 16.4 9.35C14.4 7.55 12.75 5.45 12 2.8Z';
function verify(app,css){
 assert.equal(app.split(chosen).length-1,2,'variant A on shared brand/completion mark and progress path');
 assert(!app.includes('M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5'),'old mark removed');
 for(const text of ['<DimaDropMark size={18} />','<DimaDropMark className="dimaDoneDropIcon" size={38} />','function DimaDropMark({ className, size = 24 })','strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"','[0, 1, 2].map((drop) => <svg key={drop} width="14" height="14"','drop < todayCount','{progressLabel}','{actionLabel}','{completeLabel}','aria-label={ariaLabel}','M3 0C3 0 6 5 6 7a3 3 0 0 1-6 0C0 5 3 0 3 0z','M50 43q-4 7 0 7t0-7m21 0q-4 7 0 7t0-7m20 0q-4 7 0 7t0-7m132 4q-4 7 0 7t0-7m19 0q-4 7 0 7t0-7'])assert(app.includes(text),'retained shape/size/label: '+text);
 for(const text of ['.dimaHomeBrandIcon{width:32px;height:32px;','.dimaHomeBrandIcon svg{display:block;width:18px;height:18px}', '.dimaDoneDropIcon{width:76px;height:76px;padding:18px;', '.dimaHomeProgressDrop{display:block;fill:none;stroke:var(--dima-home-outline);stroke-width:1.7}', '.dimaHomeProgressDrop.is-filled{fill:var(--dima-home-accent);stroke:var(--dima-home-accent)}','#1F5F7A','#8BC4DD','#8A9A94','#A4B2AC'])assert(css.includes(text),'retained color/geometry: '+text);
}
const app=read('app.jsx'),css=read('index.html');verify(app,css);
for(const position of [app.indexOf(chosen),app.lastIndexOf(chosen)]){const mutant=app.slice(0,position)+'M0 0'+app.slice(position+chosen.length);assert.throws(()=>verify(mutant,css));}
for(const [from,to]of [['size={18}','size={19}'],['{progressLabel}','null'],['M3 0C3 0 6 5','M4 0C3 0 6 5']]){assert(app.includes(from));assert.throws(()=>verify(app.replace(from,to),css));}
assert.throws(()=>verify(app,css.replaceAll('#8BC4DD','#000000')));verify(app,css);
console.log('PASS D43: variant A across home/progress/completion, preserved sizes/colors/labels/rain; six mutations rejected.');
