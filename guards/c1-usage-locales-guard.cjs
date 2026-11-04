'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const keys=['inbox.tabUsage','usage.section','usage.opens','usage.devices','usage.day','usage.week','usage.month','usage.note'];
const scripts={bn:/\p{Script=Bengali}/u,ru:/\p{Script=Cyrillic}/u,ku:/\p{Script=Arabic}/u,ta:/\p{Script=Tamil}/u,pt:/[A-Za-z]/};
for(const [lang,script] of Object.entries(scripts)){
 const file=fs.readFileSync(path.join(root,'lang',lang+'.json'));
 assert.ok(file.equals(Buffer.from(file.toString('utf8'),'utf8')),lang+' UTF-8 round trip');
 assert.ok(!file.toString('utf8').startsWith('\uFEFF'),lang+' no BOM');
 const d=JSON.parse(file);
 const repaired = lang === 'pt' ? ['inbox.tabUsage','usage.section','usage.note'] : keys;
 for(const key of repaired){assert.ok(typeof d[key]==='string'&&d[key].trim()&&!/[?\uFFFD]/.test(d[key]),lang+' '+key+' is intact');assert.ok(script.test(d[key]),lang+' '+key+' uses its script');}
 assert.ok(d['usage.note'].includes('UTC'),lang+' retains UTC');
}
assert.ok(!JSON.parse(fs.readFileSync(path.join(root,'config/enabled-languages.json'),'utf8')).enabled.includes('ku'),'Sorani remains closed pending review');
console.log('PASS item 5-a: usage labels in five dictionaries are intact; Kurdish remains closed');
