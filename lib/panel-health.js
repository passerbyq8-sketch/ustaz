import { readUsageChat } from './usage.js';
const LIMIT_KEY='panel:daily-limit:v1';
const DAY=86400000;
export function evaluateAlerts(today={},before={},spendUsd=null,limitUsd=10){
  const out=[];
  if(today.read >= 20 && before.read >= 20){
    for(const [kind,floor,delta] of [['noFind',0.2,0.1],['faults',0.1,0.05]]){
      const rate=today[kind]/today.read,base=before[kind]/before.read;
      if(rate>=floor&&rate>=base+delta&&rate>=base*1.5)out.push(kind);
    }
  }
  if(Number.isFinite(spendUsd)&&spendUsd>=0&&Number.isFinite(limitUsd)&&limitUsd>0){
    if(spendUsd>=limitUsd*0.95)out.push('spend95');else if(spendUsd>=limitUsd*0.8)out.push('spend80');
  }
  return out;
}
export async function saveDailyLimit(store,value){
  if(!Number.isFinite(value)||value<0.01||value>10000||Math.abs(value*100-Math.round(value*100))>0.000001)return false;
  return await store.set(LIMIT_KEY,{usd:value})==='OK';
}
export async function acknowledgeAlert(store,id){
  if(typeof id!=='string'||!/^\d{8}:(noFind|faults|spend80|spend95)$/.test(id))return false;
  const key='panel:alert:v1:'+id,raw=await store.get(key);if(!raw)return false;
  const record=typeof raw==='string'?JSON.parse(raw):raw;
  return await store.set(key,{...record,acknowledged:true},{ex:30*86400})==='OK';
}
export async function readPanelHealth(store,{read=readUsageChat,now=new Date()}={}){
  const day=now.toISOString().slice(0,10).replace(/-/g,''),prior=new Date(now.getTime()-DAY).toISOString().slice(0,10).replace(/-/g,'');
  const raw=await store.get(LIMIT_KEY),setting=typeof raw==='string'?JSON.parse(raw):raw;
  const limitUsd=setting==null?10:setting.usd;
  if(!Number.isFinite(limitUsd)||limitUsd<=0)throw Error('panel-limit-store');
  const [today,before]=await Promise.all([read({day,days:1}),read({day:prior,days:7})]);
  if(!Number.isSafeInteger(today?.read)||!Number.isSafeInteger(before?.read))throw Error('panel-health-store');
  // No model/input/cache/rate fields exist in the answer log. Never estimate an invoice from output tokens.
  const costUsd=null,alerts=[];
  for(const kind of evaluateAlerts(today,before,costUsd,limitUsd)){
    const id=day+':'+kind,key='panel:alert:v1:'+id;
    await store.set(key,{id,kind,day,acknowledged:false,createdAt:now.toISOString()},{nx:true,ex:30*86400});
  }
  for(const kind of ['noFind','faults','spend80','spend95']){
    const raw=await store.get('panel:alert:v1:'+day+':'+kind);if(!raw)continue;
    const row=typeof raw==='string'?JSON.parse(raw):raw;
    alerts.push({id:row.id,kind,day,acknowledged:row.acknowledged===true});
  }
  return {ok:true,day,limitUsd,costUsd,costAvailable:false,spendWarningsAvailable:false,thresholds:[0.8,0.95],
    sample:{read:today.read,noFind:today.noFind,faults:today.faults,priorRead:before.read,perDayCap:200,indexCap:3000},
    coverage:'newest-at-most-200-answers-per-UTC-day; quality-proxies; not-full-traffic; cost-unavailable',alerts};
}
