'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.jsx'),'utf8');
const policy=require('../lib/panel-policy.cjs');
function verify(s){
 const a=s.indexOf('  const saveProfileFields = ('),b=s.indexOf('\n  };',a)+5;
 assert.ok(a>=0&&b>a,'profile writer anchors');
 const ctx={profileRef:{current:{pid:'fixture'}},voiceProfileRef:{},ezikLatinDigits:String,ONBOARDING_DEFAULT_AGE:19,setProfile(){},localStorage:{setItem(){}},Date};
 vm.createContext(ctx);vm.runInContext(s.slice(a,b)+'\nthis.save=saveProfileFields;',ctx);
 const adultYear=String(new Date().getFullYear()-25);
 const make=year=>{assert.equal(ctx.save('Reader',null,year),true);return {...ctx.profileRef.current};};
 const adult=make(adultYear),blank=make(''),young=make(String(new Date().getFullYear()-12)),teen=make(String(new Date().getFullYear()-13));
 assert.equal(adult.birthYearProvided,true,'typed adult provenance');assert.equal(blank.birthYearProvided,false,'blank provenance');assert.equal(blank.age,19,'adult default retained');
 ctx.save('Reader','male',adultYear,false);assert.equal(ctx.profileRef.current.birthYearProvided,false,'gender-only save cannot invent provenance');
 assert.ok(s.includes('String(p.birthYear), p.birthYearProvided === true)'),'gender writer preserves provenance');
 assert.ok(s.includes('const pfYearProvided = useRef(profile?.birthYearProvided === true)') && s.includes('pfYearProvided.current = true;') && s.includes('onSaveProfile(pfName, pfGender, pfYear, pfYearProvided.current)'), 'Settings only promotes an edited year');
 assert.ok(s.includes('birthYear, birthYearProvided: false, pid:'),'onboarding default is undisclosed');
 const start=s.indexOf('function EzPanelCampaign('),end=s.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);
 const code=require('@babel/core').transformSync(s.slice(start,end),{presets:[[require('@babel/preset-react'),{runtime:'classic'}]],configFile:false,babelrc:false}).code;
 const doc={schema:1,revision:1,sections:{},campaign:{id:'age-proof',enabled:true,text:'Fixture',start:1,end:Date.now()+600000}};
 for(const [label,profile,expected] of [['adult',adult,true],['blank',blank,false],['legacy',{age:25},false],['12',young,false],['13',teen,true]]){
  let effects=[],ages=[],claims=[];
  const c={Date,React:{createElement(){}},useState:()=>[null,v=>{if(typeof v==='function')v({id:'age-proof'});}],useRef:()=>({current:null}),useEzikBackLayer(){},useEffect:fn=>effects.push(fn),setInterval(){},setTimeout(){},clearInterval(){},clearTimeout(){}};
  c.window={document:{querySelector:()=>null},EzikPanelPolicy:{campaignEligible:(d,age,now)=>{ages.push(age);return policy.campaignEligible(d,age,now);}},EzikPanel:{claimCampaign:age=>{claims.push(age);return Promise.resolve(null);}}};
  vm.createContext(c);vm.runInContext(code,c);c.EzPanelCampaign({profile,document:doc});effects.forEach(fn=>fn());
  assert.ok(ages.length>0,label+' evaluates eligibility');assert.equal(policy.campaignEligible(doc,ages[0],Date.now()),expected,label+' campaign eligibility');
  for(const age of [...ages,...claims])assert.equal(age,profile.birthYearProvided===true?profile.age:undefined,label+' every campaign age has provenance');
  if(expected)assert.equal(claims.length,1,label+' claims eligible campaign');else assert.equal(claims.length,0,label+' cannot claim');
 }
}
verify(source);
for(const [name,from,to] of [
 ['adult','profile?.birthYearProvided === true ? profile?.age : undefined','profile?.birthYearProvided === true ? undefined : undefined'],
 ['blank','birthYearProvided: typed &&','birthYearProvided: true || typed &&'],
 ['legacy','profile?.birthYearProvided === true ? profile?.age : undefined','profile?.birthYearProvided !== false ? profile?.age : undefined'],
 ['12','profile?.birthYearProvided === true ? profile?.age : undefined','profile?.birthYearProvided === true ? (profile?.age === 12 ? 13 : profile?.age) : undefined'],
 ['13','profile?.birthYearProvided === true ? profile?.age : undefined','profile?.birthYearProvided === true ? (profile?.age === 13 ? 12 : profile?.age) : undefined'],
 ['gender','String(p.birthYear), p.birthYearProvided === true)','String(p.birthYear))'],
 ['settings','pfYearProvided.current = true;','pfYearProvided.current = false;'],
 ['onboarding','birthYear, birthYearProvided: false, pid:','birthYear, birthYearProvided: true, pid:']
]){assert.ok(source.includes(from),name+' mutation anchor');assert.throws(()=>verify(source.replace(from,to)),undefined,name+' mutation fails');}
console.log('PASS campaign age provenance: adult, blank, legacy, 12, 13; eight mutations killed');
