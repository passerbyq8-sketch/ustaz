import { sessionState } from './auth/account.js';
import { authSnapshot, authCompareWrite, readJsonStrict, generationKey, LEGACY_GENERATION } from './auth/store.js';
import { safeAccountKey } from './articles/store.js';
import sections from '../config/usage-sections.json' with { type:'json' };
export const PANEL_VIEW = 'panel:view-stats';
export const viewerKey = key => 'panel:viewer:v1:' + key;
export async function resolvePanelViewer(req) {
  try {
    const state=await sessionState(typeof req.body?.session==='string'?req.body.session:'');
    if(state.state!=='live')return {state:state.state};
    const key=safeAccountKey(state.record.accountKey);if(!key)return {state:'denied'};
    const grant=await readJsonStrict(viewerKey(key));if(!grant.ok)return {state:'unknown'};
    const row=grant.value;
    if(!row||row.capability!==PANEL_VIEW||row.generation!==(state.record.generation??LEGACY_GENERATION))return {state:'denied'};
    return {state:'live',actor:{accountKey:key,role:'viewer'}};
  }catch{return {state:'unknown'};}
}
export async function setPanelViewer(target, enabled, actor) {
  if(actor?.role!=='owner')return {ok:false,error:'panel-forbidden'};
  const key=safeAccountKey(target);if(!key)return {ok:false,error:'panel-target'};
  const account=await authSnapshot(key),generation=await authSnapshot(generationKey(key)),prior=await authSnapshot(viewerKey(key));
  if(!account.ok||!generation.ok||!prior.ok)return {ok:false,error:'panel-store'};
  if(!account.value)return {ok:false,error:'panel-target'};
  const change=enabled?{next:{capability:PANEL_VIEW,generation:generation.value?.id??LEGACY_GENERATION,grantedBy:actor.accountKey,grantedAt:new Date().toISOString()}}:{remove:true};
  return await authCompareWrite([account,generation,{...prior,...change}])==='OK'?{ok:true}:{ok:false,error:'panel-store'};
}
const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
export function projectViewer(kind, raw={}) {
  if(kind==='usage-chat')return {ok:true,kind,read:count(raw.read),noFind:count(raw.noFind),noSource:count(raw.noSource),faults:count(raw.faults),firstMs:Number.isFinite(raw.firstMs)?raw.firstMs:null,slowMs:Number.isFinite(raw.slowMs)?raw.slowMs:null,top:[],coverage:'at-most-200-newest-answers-per-UTC-day'};
  if(kind==='usage'){
    const items=(Array.isArray(raw.items)?raw.items:[]).filter(r=>Object.hasOwn(sections,r.section)).map(r=>({section:r.section,label:sections[r.section],opens:count(r.opens),devices:count(r.devices)}));
    return {ok:true,kind,day:raw.day,days:raw.days,from:raw.from,approximate:true,items,games:items.filter(r=>['ghaws','harb','test','board','hanna'].includes(r.section)),board:null};
  }
  return {ok:false};
}
