// Only UTC day, closed section slug and anonymous device membership enter this store.
import sections from '../config/usage-sections.json' with { type: 'json' };
import { evalScript, key } from './ledger/redis.js';

export const USAGE_SECTIONS = Object.freeze(sections);
export const USAGE_TTL_SECONDS = 400 * 24 * 60 * 60;
export const USAGE_ANON_RE = /^[a-f0-9]{32}$/;
// Device sets exist only to intersect days: one day and seven days back, then they expire.
export const USAGE_ACTIVE_TTL_SECONDS = 8 * 24 * 60 * 60;
// SEC-010: bounded daily telemetry storage even when anonymous IDs rotate.
// Admission is an analytics ceiling, not a count of people or an abuse identity.
export const USAGE_DAILY_EVENT_CAP = 50000;
export const usageIntakeKey = day => key('usage', 'intake', day);
export const USAGE_GAP_CAP_MS = 30 * 60 * 1000;
// The first UTC day with the board's own fields. Earlier days answer "still collecting", not zero.
export const USAGE_BOARD_SINCE = '20261101';
const USAGE_OPTIONAL = Object.freeze(['from', 'gap', 'boot', 'side', 'plat', 'appv', 'notif']);
const USAGE_PLATFORMS = Object.freeze(['a', 'i', 'w']);
const USAGE_APPV_RE = /^[A-Za-z0-9._-]{1,40}$/;
const USAGE_GAMES = Object.freeze(['ghaws', 'harb', 'test', 'board', 'hanna']);
// Stay buckets by upper edge in seconds. The last edge is the 30-minute cap.
const USAGE_STAY_EDGES = Object.freeze([10, 30, 60, 180, 300, 600, 1800]);

export function validUsageEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.section !== 'string' || !Object.hasOwn(USAGE_SECTIONS, body.section)
    || typeof body.anon !== 'string' || !USAGE_ANON_RE.test(body.anon)) return false;
  // A closed list: any other field drops the whole event, so nothing can ride along.
  if (!Object.keys(body).every((k) => k === 'section' || k === 'anon' || USAGE_OPTIONAL.includes(k))) return false;
  if (('from' in body) !== ('gap' in body)) return false;
  if ('from' in body && (typeof body.from !== 'string' || !Object.hasOwn(USAGE_SECTIONS, body.from)
    || !Number.isSafeInteger(body.gap) || body.gap < 0 || body.gap > USAGE_GAP_CAP_MS)) return false;
  if ('boot' in body && body.boot !== 1) return false;
  // Platform, build and notification state describe one app open and are only ever summed.
  if (body.boot !== 1 && ('plat' in body || 'appv' in body || 'notif' in body)) return false;
  if ('plat' in body && !USAGE_PLATFORMS.includes(body.plat)) return false;
  if ('appv' in body && (typeof body.appv !== 'string' || !USAGE_APPV_RE.test(body.appv))) return false;
  if ('notif' in body && body.notif !== 1) return false;
  // `side` marks a companion event (the qibla panel inside prayer): it counts for its section only.
  if ('side' in body && (body.side !== 1 || 'from' in body || 'boot' in body)) return false;
  return true;
}

export function usageKeys(day, section) {
  const prefix = key('usage', 'v1', day, section);
  return [prefix + ':opens', prefix + ':devices'];
}

export const usageStatsKey = (day) => key('usage', 'v2', day, 'stats');
export const usageActiveKey = (day) => key('usage', 'v2', day, 'active');

// One atomic write also gives every key its expiry; a dropped invocation leaves no immortal key.
// A script is counted as 1 + each inner call, so an expiry is set when a key is new, not on every
// event: that saving is what pays for the board's fields inside the 20% Upstash gate.
// ARGV: anon, 400-day TTL, 8-day TTL, then the stats fields to bump. A side event has no KEYS[3].
export const WRITE_USAGE_SCRIPT = `
-- INTAKE-BOUND START
local intake = KEYS[#KEYS]
local admitted = tonumber(redis.call('GET', intake) or '0')
if admitted == nil or admitted < 0 then return 0 end
if admitted >= ${USAGE_DAILY_EVENT_CAP} then
  local discarded = redis.call('INCR', intake .. ':discarded')
  if discarded == 1 then redis.call('EXPIRE', intake .. ':discarded', ARGV[3]) end
  return 0
end
local accepted = redis.call('INCR', intake)
if accepted == 1 then redis.call('EXPIRE', intake, ARGV[3]) end
-- INTAKE-BOUND END
local opens = redis.call('INCR', KEYS[1])
redis.call('PFADD', KEYS[2], ARGV[1])
if opens == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
end
if #KEYS == 5 then
  redis.call('SADD', KEYS[4], ARGV[1])
  local first = 0
  for i = 4, #ARGV do
    if redis.call('HINCRBY', KEYS[3], ARGV[i], 1) == 1 and i == 4 then first = 1 end
  end
  if first == 1 then
    redis.call('EXPIRE', KEYS[3], ARGV[2])
    redis.call('EXPIRE', KEYS[4], ARGV[3])
  end
end
return opens
`;

// The stats fields one event bumps. The first one's first hit sets the day's expiries.
export function usageFields(body, now = new Date()) {
  const kuwaitHour = (now.getUTCHours() + 3) % 24;
  const fields = ['h:' + kuwaitHour];
  if (body.boot === 1) {
    fields.push('b');
    if (body.plat) fields.push('o:' + body.plat);
    if (body.appv) fields.push('v:' + body.appv);
    if (body.notif === 1) fields.push('n');
  }
  if (body.from) {
    const seconds = body.gap / 1000;
    const bucket = USAGE_STAY_EDGES.findIndex((edge) => seconds <= edge);
    fields.push('d:' + body.from + ':' + bucket);
    if (body.from !== body.section) fields.push('p:' + body.from + '>' + body.section);
  }
  return fields;
}

export async function writeUsage(body, now = new Date()) {
  if (!validUsageEvent(body)) return false;
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const base = usageKeys(day, body.section);
  const result = await evalScript(WRITE_USAGE_SCRIPT,
    body.side === 1 ? [...base, usageIntakeKey(day)] : [...base, usageStatsKey(day), usageActiveKey(day), usageIntakeKey(day)],
    [body.anon, USAGE_TTL_SECONDS, USAGE_ACTIVE_TTL_SECONDS, ...(body.side === 1 ? [] : usageFields(body, now))]);
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

// Three bounded reads for the board. ARGV[i] is the size of group i; each group is one union.
export const READ_UNIONS_SCRIPT = `
local out, at = {}, 1
for i = 1, #ARGV do
  local size = tonumber(ARGV[i])
  table.insert(out, redis.call('PFCOUNT', unpack(KEYS, at, at + size - 1)))
  at = at + size
end
return out
`;
export const READ_HASHES_SCRIPT = `
local out = {}
for i = 1, #KEYS do table.insert(out, redis.call('HGETALL', KEYS[i])) end
return out
`;
// KEYS come in pairs: the cohort's day, then the day it may have returned on.
export const READ_RETURN_SCRIPT = `
local out = {}
for i = 1, #KEYS, 2 do
  table.insert(out, redis.call('SCARD', KEYS[i]))
  table.insert(out, #redis.call('SINTER', KEYS[i], KEYS[i + 1]))
end
return out
`;

const stamp = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
const dayMs = (day) => Date.parse(day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6, 8) + 'T00:00:00Z');
const span = (end, n) => Array.from({ length: n }, (_, i) => stamp(dayMs(end) - i * 86400000));
const pairs = (flat) => {
  const out = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]) || 0;
  return out;
};

function addUp(hashes) {
  const total = {};
  for (const h of hashes) for (const [k, n] of Object.entries(h)) total[k] = (total[k] || 0) + n;
  return total;
}

function returnRate(rows) {
  const seen = rows.filter((r) => r.cohort > 0);
  if (!seen.length) return null;
  return { cohort: seen.reduce((a, r) => a + r.cohort, 0), returned: seen.reduce((a, r) => a + r.returned, 0) };
}

// Mean and median in seconds, read from the buckets; so both are approximate, and said to be.
export function usageStay(counts) {
  const n = counts.reduce((a, c) => a + c, 0);
  if (!n) return null;
  let low = 0, sum = 0, passed = 0, median = null;
  USAGE_STAY_EDGES.forEach((edge, i) => {
    sum += counts[i] * ((low + edge) / 2);
    if (median === null && passed + counts[i] >= n / 2) median = low + ((n / 2 - passed) / counts[i]) * (edge - low);
    passed += counts[i];
    low = edge;
  });
  return { n, mean: Math.round(sum / n), median: Math.round(median) };
}

function stays(total) {
  const seen = {};
  for (const [k, n] of Object.entries(total)) {
    if (!k.startsWith('d:')) continue;
    const [, section, bucket] = k.split(':');
    if (!Object.hasOwn(USAGE_SECTIONS, section)) continue;
    (seen[section] ||= USAGE_STAY_EDGES.map(() => 0))[Number(bucket)] = n;
  }
  return Object.entries(seen).map(([section, counts]) => ({ label: USAGE_SECTIONS[section], ...usageStay(counts) }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
}

// The whole board from one window. Counts only: no device, no text, nothing to join to an account.
export async function readUsageBoard(body = {}, now = new Date()) {
  const { day, days, dates } = usageWindow(body, now);
  const today = stamp(now.getTime());
  const prior = span(stamp(dayMs(dates[dates.length - 1]) - 86400000), days);
  const trend = span(day, 30);
  const names = Object.keys(USAGE_SECTIONS);
  const devices = (list) => list.flatMap((d) => names.map((s) => usageKeys(d, s)[1]));
  const groups = [...trend.map((d) => [d]), dates, prior];
  const unions = await evalScript(READ_UNIONS_SCRIPT, groups.flatMap(devices), groups.map((g) => g.length * names.length));
  const hashes = await evalScript(READ_HASHES_SCRIPT, [...dates, ...prior].map(usageStatsKey), []);
  // A day still running says nothing yet about who returned on it, so the window steps back one.
  const settled = (list) => list.map((d) => (dates[0] === today ? stamp(dayMs(d) - 86400000) : d));
  const retDays = settled(dates);
  const retPrior = settled(prior);
  const cohortKeys = (list, back) => list.flatMap((d) => [usageActiveKey(stamp(dayMs(d) - back * 86400000)), usageActiveKey(d)]);
  const retKeys = [...cohortKeys(retDays, 1), ...cohortKeys(retPrior, 1), ...cohortKeys(retDays, 7), ...cohortKeys(retPrior, 7)];
  const returns = await evalScript(READ_RETURN_SCRIPT, retKeys, []);
  if (!Array.isArray(unions) || unions.length !== groups.length || !Array.isArray(hashes)
    || !Array.isArray(returns) || returns.length !== retKeys.length) throw new Error('usage-store');
  const current = addUp(hashes.slice(0, days).map(pairs));
  const earlier = addUp(hashes.slice(days).map(pairs));
  const rows = [];
  for (let i = 0; i < returns.length; i += 2) rows.push({ cohort: returns[i], returned: returns[i + 1] });
  const n = retDays.length;
  const paths = Object.entries(current).filter(([k]) => k.startsWith('p:')).map(([k, count]) => {
    const [from, to] = k.slice(2).split('>');
    return { from: USAGE_SECTIONS[from] || from, to: USAGE_SECTIONS[to] || to, n: count };
  }).sort((a, b) => b.n - a.n).slice(0, 10);
  return {
    since: USAGE_BOARD_SINCE,
    active: unions[trend.length], activeBefore: unions[trend.length + 1],
    opens: current.b || 0, opensBefore: earlier.b || 0,
    d1: returnRate(rows.slice(0, n)), d1Before: returnRate(rows.slice(n, n * 2)),
    d7: returnRate(rows.slice(n * 2, n * 3)), d7Before: returnRate(rows.slice(n * 3)),
    trend: trend.map((d, i) => ({ day: d, devices: unions[i] })).reverse(),
    paths,
    hours: Array.from({ length: 24 }, (_, h) => current['h:' + h] || 0),
    stays: stays(current),
    platforms: { a: current['o:a'] || 0, i: current['o:i'] || 0, w: current['o:w'] || 0 },
    versions: Object.entries(current).filter(([k]) => k.startsWith('v:')).map(([k, count]) => ({ v: k.slice(2), n: count }))
      .sort((a, b) => b.n - a.n).slice(0, 5),
    notif: { on: current.n || 0, of: (current['o:a'] || 0) + (current['o:i'] || 0) },
  };
}

// The answer log, read only and as counts. A day is capped here; `read` says how many were read.
export const USAGE_CHAT_DAY_CAP = 200;
const NO_FIND_FLAGS = Object.freeze(['refusal_fallback', 'unsourced_withheld']);

// One answer's outcome, for the panel's list. «لم أجد» wins: a refusal is also an answer that ended.
export function usageAnswerOutcome(r) {
  const flags = Array.isArray(r.flags) ? r.flags : [];
  if (flags.some((f) => NO_FIND_FLAGS.includes(f))) return 'nofind';
  return r.status !== 'ended' || flags.includes('incomplete') ? 'fault' : 'done';
}

function rank(list, share) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

export async function readUsageChat(body = {}, deps = {}) {
  const { dates } = usageWindow(body);
  // Loaded here so the write route does not carry the answer log.
  const read = deps.read || (await import('./answer-log.js')).readAnswerLog;
  const days = await Promise.all(dates.map((day) => read({ day, limit: USAGE_CHAT_DAY_CAP })));
  const records = days.flat();
  const classes = {};
  let noFind = 0, noSource = 0, faults = 0;
  const waits = [];
  for (const r of records) {
    const flags = Array.isArray(r.flags) ? r.flags : [];
    if (flags.some((f) => NO_FIND_FLAGS.includes(f))) noFind += 1;
    if (!(Number(r.cited) > 0)) noSource += 1;
    if (r.status !== 'ended' || flags.includes('incomplete')) faults += 1;
    if (Number.isFinite(r.first_byte_ms) && r.first_byte_ms !== null) waits.push(r.first_byte_ms);
    const label = r.route || r.path;
    if (label) classes[label] = (classes[label] || 0) + 1;
  }
  return {
    ok: true, kind: 'usage-chat', read: records.length, noFind, noSource, faults,
    firstMs: rank(waits, 0.5), slowMs: rank(waits, 0.9),
    top: Object.entries(classes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ k, n })),
  };
}

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
  const out = { ok: true, kind: 'usage', day, days, from: dates[dates.length - 1], approximate: true, items };
  out.games = USAGE_GAMES.map((id) => items.find((r) => r.section === id)).filter(Boolean);
  // The table stands on its own: a board that cannot be read costs the board, not the table.
  try { out.board = await readUsageBoard(body); } catch { out.board = null; }
  return out;
}
