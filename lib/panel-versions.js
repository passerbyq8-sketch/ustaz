import version from '../config/app-version.json' with { type: 'json' };
import { evalScript } from './ledger/redis.js';
import { usageActiveKey, usageWindow } from './usage.js';
export const READ_DEVICE_VERSIONS = `
local out = {}
for i = 1, 7 do table.insert(out, redis.call('SMEMBERS', KEYS[i])) end
for i = 8, 15 do table.insert(out, redis.call('HGETALL', KEYS[i])) end
return out
`;
export async function readDeviceVersions(body = {}, now = new Date()) {
  const { day, dates } = usageWindow({ days: 7 }, now);
  const eighth = new Date(Date.UTC(+day.slice(0,4), +day.slice(4,6)-1, +day.slice(6,8)) - 7*86400000).toISOString().slice(0,10).replace(/-/g,'');
  const raw = await evalScript(READ_DEVICE_VERSIONS, [...dates.map(usageActiveKey), ...[...dates,eighth].map(d=>usageActiveKey(d)+':versions')], []);
  if (!Array.isArray(raw) || raw.length !== 15 || raw.some(r=>!Array.isArray(r))) throw Error('version-store');
  return { ok:true, kind:'version-devices', day, days:7, from:dates[6], approximate:true,
    currentVersion:version.app_version, coverage:'admitted-anonymous-devices; latest-observed-version; eight-day-retention; no-backfill',
    ...summarizeVersions(raw.slice(0,7),raw.slice(7),version.app_version) };
}
export function summarizeVersions(activeDays, versionDays, currentVersion) {
  const active=new Set(activeDays.flat()),latest=new Map(),counts=new Map();
  for(const pairs of versionDays) for(let i=0;i<pairs.length;i+=2){
    const id=pairs[i],v=pairs[i+1];
    if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id)||typeof v!=='string'||!/^v:[A-Za-z0-9._-]{1,40}$/.test(v))continue;
    if (!latest.has(id)) latest.set(id, v.slice(2));
  }
  let known=0;
  for(const id of active){const v=latest.get(id);if(v){known++;counts.set(v,(counts.get(v)||0)+1);}}
  const current=counts.get(currentVersion)||0, build=/^ezik-v(\d+)$/.exec(currentVersion);
  let old=0;
  for(const [v,n] of counts){const m=/^ezik-v(\d+)$/.exec(v);if(build&&m&&Number(m[1])<Number(build[1]))old+=n;}
  return {active:active.size,known,unknown:active.size-known,current,old,other:known-current-old,
    versions:[...counts].map(([v,n])=>({v,n})).sort((a,b)=>b.n-a.n||a.v.localeCompare(b.v))};
}
