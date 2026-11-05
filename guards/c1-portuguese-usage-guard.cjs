'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const file=path.join(__dirname,'..','lang','pt.json');
function check(data){assert.equal(data['usage.week'],'\u00daltimos 7 dias');assert.equal(data['usage.month'],'\u00daltimos 30 dias');}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
check(data);
for(const key of ['usage.week','usage.month']){const mutant={...data,[key]:data[key].replace('\u00da','?')};assert.throws(()=>check(mutant),undefined,key+' damage must fail');}
console.log('D10 PASS: both Portuguese usage periods; two damaged-value mutations rejected.');
