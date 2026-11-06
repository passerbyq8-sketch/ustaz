'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../lib/panel-policy.cjs'),root=path.resolve(__dirname,'..');
const campaign={id:'synthetic-campaign',enabled:true,text:'Synthetic announcement',start:1000,end:2000};
test('34.2 only valid timed campaigns and non-child known ages are eligible',()=>{
 const doc={schema:1,revision:1,sections:{},campaign};assert(P.validate(doc));
 for(const age of [null,undefined,'',0,4,12,'bad',100])assert.equal(P.campaignEligible(doc,age,1500),false);
 for(const age of [13,17,18,99])assert.equal(P.campaignEligible(doc,age,1500),true);
 for(const now of [999,2000,2001])assert.equal(P.campaignEligible(doc,20,now),false);
 for(const c of [{...campaign,end:999},{...campaign,text:'<script>'},{...campaign,recipient:'private'}, {...campaign,id:'../bad'}])assert.equal(P.validate({...doc,campaign:c}),null);
});
test('34.2 per-device claim is persisted before display and serialized across callers',async()=>{
 const values=new Map(),doc={schema:1,revision:1,sections:{},campaign:{...campaign,start:0,end:Date.now()+60000}};
 values.set(P.cacheKey,JSON.stringify(doc));let chain=Promise.resolve();
 const window={EzikPanelPolicy:P,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},navigator:{locks:{request:(key,fn)=>{chain=chain.then(fn);return chain;}}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(root+'/panel-client.js','utf8'),{window,Date,Promise,Map});
 assert.equal(await window.EzikPanel.claimCampaign(10,()=>true),null);
 assert.equal(await window.EzikPanel.claimCampaign(20,()=>false),null);
 const claims=await Promise.all(Array.from({length:10},()=>window.EzikPanel.claimCampaign(20,()=>true)));
 assert.equal(claims.filter(Boolean).length,1);assert.equal(values.get('ezik_panel_seen_v1:'+campaign.id),'1');
 // A profile change cannot reset the device receipt.
 assert.equal(await window.EzikPanel.claimCampaign(18,()=>true),null);
 const source=fs.readFileSync(root+'/panel-client.js','utf8');
 assert(source.includes("root.localStorage.setItem(seenKey, '1')"));
 const mutant=source.replace("if (root.localStorage.getItem(seenKey)) return null;",'');
 vm.runInNewContext(mutant,{window,Date,Promise,Map});assert(await window.EzikPanel.claimCampaign(20,()=>true),'receipt-check mutation is observable');
});
test('34.2 popup render rechecks age and timing on every profile render',()=>{
 const s=fs.readFileSync(root+'/app.jsx','utf8');assert(s.includes('function EzPanelCampaign('));assert(s.includes('campaignEligible(document, profile?.age, Date.now())'));assert(s.includes('data-panel-campaign='));
});
