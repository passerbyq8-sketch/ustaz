'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),parser=require('@babel/parser');
const source=fs.readFileSync(path.join(__dirname,'../app.jsx'),'utf8'),ast=parser.parse(source,{sourceType:'script',plugins:['jsx']});
const names=['shellHeadingV2Enabled','shellHeadingCurrent','shellTrueNorth','shellHeadingOf','sendShellHeadingCommand'];
const code=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>source.slice(n.start,n.end)).join('\n');
function verify(body){let calls=0,decl=6,loc={lat:29.37,lng:47.98},enabled=true,now=1000;
 const scope={Date:class extends Date{static now(){return now;}},Number,Math,document:{visibilityState:'visible'},ezikNativeLocation:{getCapabilities:()=>enabled?{headingReference:true}:null},ezikHeadingStartedAt:0,ezikHeadingActive:false,SHELL_HEADING_RESULT:'ezik:heading:result',SHELL_HEADING_START:'start',SHELL_HEADING_STOP:'stop',readQiblaLoc:()=>loc,wmmYearOf:()=>2026.8,wmmDeclination:(lat,lng)=>{calls++;assert.equal(lat,loc.lat);assert.equal(lng,loc.lng);return decl;}};
 const f=vm.runInNewContext(body+'\n({shellHeadingOf,shellTrueNorth,shellHeadingCurrent,sendShellHeadingCommand})',scope),bridge={postMessage:()=>{}};
 let checks=0;const sample=(mag,truth=-1)=>({type:'ezik:heading:result',v:'2',status:'ready',accuracy:3,magHeading:mag,trueHeading:truth,headingDegrees:truth>=0?truth:mag,reference:truth>=0?'true':'magnetic',timestamp:now});
 for(const d of [-12,6])for(const mag of [0,359]){decl=d;calls=0;const s=sample(mag);assert.equal(f.shellHeadingOf(s),(mag+d+360)%360);assert.equal(calls,1);checks++;}
 calls=0;assert.equal(f.shellHeadingOf(sample(231,17)),17);assert.equal(calls,0);checks++;
 for(const change of [{reference:'true'},{headingDegrees:23},{accuracy:1.5},{status:'heading-error'}]){assert.equal(f.shellHeadingOf({...sample(12),...change}),null);checks++;}
 for(const badLoc of [null,{lat:91,lng:0},{lat:0,lng:NaN}]){loc=badLoc;assert.equal(f.shellHeadingOf(sample(10)),null);checks++;}
 loc={lat:52.52,lng:13.41};decl=-8;assert.equal(f.shellHeadingOf(sample(3)),355);decl=NaN;assert.equal(f.shellHeadingOf(sample(3)),null);checks+=2;
 enabled=false;assert.equal(f.shellHeadingOf(sample(231)),231,'unknown/old shell retains old behavior');enabled=true;assert.equal(f.shellHeadingOf({...sample(231),v:undefined}),231);checks+=2;
 f.sendShellHeadingCommand(bridge,'start');const first=sample(20);assert(f.shellHeadingCurrent(first));now=2000;f.sendShellHeadingCommand(bridge,'stop');assert(!f.shellHeadingCurrent(first));f.sendShellHeadingCommand(bridge,'start');assert(!f.shellHeadingCurrent(first));assert(f.shellHeadingCurrent(sample(21)));scope.document.visibilityState='hidden';assert(!f.shellHeadingCurrent(sample(21)));checks+=5;
 return checks;
}
const mutant=code.replace('norm(raw + declination)','norm(raw)');assert.notEqual(mutant,code);
if(process.argv.includes('--mutant'))verify(mutant);else{const n=verify(code);assert.throws(()=>verify(mutant),assert.AssertionError);assert(source.includes("if (typeof shellHeadingCurrent === 'function' && !shellHeadingCurrent(detail)) return;"));assert(source.includes("document.removeEventListener('visibilitychange', onNativeBackground)"));assert(source.includes('qiblaSmoothStep(cur, want, QIBLA_SMOOTH_ALPHA)'));console.log('PASS S4 heading: '+n+' real helper/callback-state scenarios; true/magnetic reference, signed declination once, wrap, changed location, no WMM, restart/stale/hidden and legacy.');}
