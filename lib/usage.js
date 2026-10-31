// Only UTC day, closed section slug and anonymous device membership enter this store.
import sections from '../config/usage-sections.json' with { type: 'json' };
import { evalScript, key } from './ledger/redis.js';

export const USAGE_SECTIONS = Object.freeze(sections);
export const USAGE_TTL_SECONDS = 400 * 24 * 60 * 60;
export const USAGE_ANON_RE = /^[a-f0-9]{32}$/;

export function validUsageEvent(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === 2
    && typeof body.section === 'string'
    && Object.hasOwn(USAGE_SECTIONS, body.section)
    && typeof body.anon === 'string' && USAGE_ANON_RE.test(body.anon);
}

export function usageKeys(day, section) {
  const prefix = key('usage', 'v1', day, section);
  return [prefix + ':opens', prefix + ':devices'];
}

// One atomic write also gives BOTH keys their expiry; a dropped invocation leaves no immortal key.
export const WRITE_USAGE_SCRIPT = `
local opens = redis.call('INCR', KEYS[1])
redis.call('PFADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return opens
`;

export async function writeUsage(body, now = new Date()) {
  if (!validUsageEvent(body)) return false;
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const result = await evalScript(WRITE_USAGE_SCRIPT, usageKeys(day, body.section), [body.anon, USAGE_TTL_SECONDS]);
  return Number.isInteger(result) && result > 0;
}

// PFCOUNT over all daily HLLs counts the UNION, not the sum of returning devices.
// This one bounded read is at most 29 sections x 30 UTC days and returns counts only.
export const READ_USAGE_SCRIPT = `
local days = tonumber(ARGV[1])
local out = {}
for offset = 1, #KEYS, days * 2 do
  local opens = 0
  local devices = {}
  for day = 0, days - 1 do
    opens = opens + tonumber(redis.call('GET', KEYS[offset + day * 2]) or '0')
    table.insert(devices, KEYS[offset + day * 2 + 1])
  end
  table.insert(out, opens)
  table.insert(out, redis.call('PFCOUNT', unpack(devices)))
end
return out
`;

export function usageWindow(body = {}, now = new Date()) {
  const today = now.toISOString().slice(0, 10).replace(/-/g, '');
  const day = body.day === undefined ? today : body.day;
  if (typeof day !== 'string' || !/^\d{8}$/.test(day)) throw new Error('usage-day');
  const end = new Date(day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6, 8) + 'T00:00:00Z');
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10).replace(/-/g, '') !== day
    || day > today || now.getTime() - end.getTime() >= 400 * 86400000) throw new Error('usage-day');
  const days = body.days === undefined ? 1 : body.days;
  if (![1, 7, 30].includes(days)) throw new Error('usage-days');
  const dates = Array.from({ length: days }, (_, i) => new Date(end.getTime() - i * 86400000)
    .toISOString().slice(0, 10).replace(/-/g, ''));
  return { day, days, dates };
}

export async function readUsage(body = {}) {
  const { day, days, dates } = usageWindow(body);
  const names = Object.keys(USAGE_SECTIONS);
  const keys = names.flatMap((section) => dates.flatMap((date) => usageKeys(date, section)));
  const counts = await evalScript(READ_USAGE_SCRIPT, keys, [days]);
  if (!Array.isArray(counts) || counts.length !== names.length * 2
    || !counts.every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error('usage-store');
  const items = names.map((section, i) => ({
    section, label: USAGE_SECTIONS[section], opens: counts[i * 2], devices: counts[i * 2 + 1],
  })).sort((a, b) => b.opens - a.opens || a.section.localeCompare(b.section));
  return { ok: true, kind: 'usage', day, days, from: dates[dates.length - 1], approximate: true, items };
}
