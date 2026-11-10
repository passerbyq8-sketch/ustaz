// Account progress shapes. Pure merges; no device preferences or notification state.
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
const stable = v => JSON.stringify(v, (k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const unique = values => [...new Map(values.map(v => [stable(v), v])).entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([,v]) => v);
export function mergeProfile(held, incoming) {
  const a = object(held?.val) ? held.val : {}, b = object(incoming?.val) ? incoming.val : {};
  const stamp = (v, rec, field) => object(v._fields) ? Number(v._fields[field]) || 0 : Number(rec?.u) || 0;
  const out = { _fields: {} };
  for (const field of ['name', 'gender', 'year']) {
    const at = stamp(a, held, field), bt = stamp(b, incoming, field);
    const key = field === 'year' ? 'birthYear' : field;
    const takeB = !Object.hasOwn(a, key) || (Object.hasOwn(b, key) && bt > at);
    const v = takeB ? b : a;
    out._fields[field] = Math.max(at, bt);
    if (field === 'year') {
      out.birthYear = Number.isInteger(v.birthYear) ? v.birthYear : null;
      out.birthYearProvided = out.birthYear !== null && v.birthYearProvided === true;
    } else out[field] = v[field] ?? (field === 'name' ? '' : null);
  }
  return out;
}
export function validCivilDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(v + 'T12:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === v;
}
// ORDER T4 (D13-C2): the exact identity of one frozen snapshot (its full stable JSON, hashed twice), so a device can name the one it replaced.
export function snapshotId(v) {
  const text = stable(v);
  let a = 0x811c9dc5, b = (0x9747b28c ^ text.length) >>> 0;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x5bd1e995) >>> 0; }
  return 'snap1:' + text.length + ':' + a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
export function mergeDima(a, b) {
  a = object(a) ? a : {}; b = object(b) ? b : {};
  const starts = [a.startDate, b.startDate].filter(validCivilDay).sort();
  const out = { schema: 2, startDate: starts[0] || null, log: {}, presented: {}, conflicts: {} };
  for (const day of new Set([...Object.keys(a.log || {}), ...Object.keys(b.log || {})])) {
    if (!validCivilDay(day)) continue;
    const x = a.log?.[day] || {}, y = b.log?.[day] || {};
    // ORDER T4 (D13-C1): Dima's contract stores each drop as 0|1; a mark synced as true (v146) still counts as done.
    const on = v => v === 1 || v === true;
    out.log[day] = { l: on(x.l) || on(y.l) ? 1 : 0, q: on(x.q) || on(y.q) ? 1 : 0, j: on(x.j) || on(y.j) ? 1 : 0, taps: Math.max(0, Number(x.taps) || 0, Number(y.taps) || 0) };
  }
  for (const day of new Set([...Object.keys(a.presented || {}), ...Object.keys(b.presented || {}), ...Object.keys(a.conflicts || {}), ...Object.keys(b.conflicts || {})])) {
    if (!validCivilDay(day)) continue;
    let values = unique([a.presented?.[day], b.presented?.[day], ...(Array.isArray(a.conflicts?.[day]) ? a.conflicts[day] : []), ...(Array.isArray(b.conflicts?.[day]) ? b.conflicts[day] : [])].filter(v => object(v) && v.civilDate === day));
    // ORDER T4 (D13-C2): a snapshot that names the exact snapshot it replaced (by snapshotId) retires that one, on its own day only.
    const replaced = new Set(values.map(v => v.replaces).filter(r => typeof r === 'string'));
    if (replaced.size) { const kept = values.filter(v => !replaced.has(snapshotId(v))); if (kept.length) values = kept; }
    if (values.length) out.presented[day] = values[0];
    // Preserve every conflicting frozen snapshot for review, including completed days.
    if (values.length > 1) out.conflicts[day] = values.slice(1);
  }
  return out;
}
export function unionIntervals(values) {
  const out = [];
  for (const v of values.filter(v => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger) && v[0] > 0 && v[1] >= v[0]).sort((a,b) => a[0]-b[0] || a[1]-b[1])) {
    const prev = out[out.length - 1];
    if (prev && v[0] <= prev[1]+1) prev[1] = Math.max(prev[1], v[1]); else out.push(v.slice());
  }
  return out;
}
export function mergeMemorizer(key, a, b, newer) {
  if (key === 'held') {
    const out = {};
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) if (/^\d{1,3}$/.test(k)) out[k] = unionIntervals([...(Array.isArray(a?.[k]) ? a[k] : []), ...(Array.isArray(b?.[k]) ? b[k] : [])]);
    return out;
  }
  if (key === 'tests' || key === 'ranges' || key === 'plans') {
    const map = new Map();
    for (const v of [...(Array.isArray(newer ? a : b) ? (newer ? a : b) : []), ...(Array.isArray(newer ? b : a) ? (newer ? b : a) : [])]) {
      if (!object(v)) continue;
      const id = String(v.id || stable(v));
      const previous = map.get(id);
      if (key === 'plans' && previous) {
        const log = { ...(previous.log || {}) };
        for (const [day, values] of Object.entries(v.log || {})) if (validCivilDay(day) && Array.isArray(values)) log[day] = values.map((n,i) => Math.max(Number(n)||0,Number(log[day]?.[i])||0));
        map.set(id, { ...v, pos: Math.max(previous.pos || 0, v.pos || 0), cycle: Math.max(previous.cycle || 0, v.cycle || 0), log });
        continue;
      }
      map.set(id, key === 'ranges' && previous ? { ...v, segs: unionIntervals([...(previous.segs || []), ...(v.segs || [])].filter(s => Array.isArray(s) && s.length === 4).map(s => [s[0]*1000+s[1],s[2]*1000+s[3]])).map(([a,b]) => [Math.floor(a/1000),a%1000,Math.floor(b/1000),b%1000]) } : v);
    }
    return [...map.entries()].sort(([a],[b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([,v]) => v);
  }
  if (key === 'run') {
    const values = v => !v ? [] : Array.isArray(v.runs) ? v.runs : (v.id || v.seed) ? [v] : [];
    const retired = [...new Set([...(a?.retired || []), ...(b?.retired || [])].map(String))].sort();
    const byId = new Map();
    for (const run of [...values(a), ...values(b)]) {
      if (!object(run)) continue;
      const id = String(run.id || run.seed || stable(run));
      if (retired.includes(id)) continue;
      const previous = byId.get(id);
      if (!previous || Number(run.at || 0) > Number(previous.at || 0) || (Number(run.at || 0) === Number(previous.at || 0) && stable(run) > stable(previous))) byId.set(id,run);
    }
    const runs = [...byId.values()].sort((x,y) => (Number(x.at) || 0) - (Number(y.at) || 0) || (stable(x) < stable(y) ? -1 : stable(x) > stable(y) ? 1 : 0));
    return { runs, retired, active: runs.length ? runs[runs.length - 1] : null };
  }
  if (key === 'prefs') return newer ? b : a;
  const merge = (x,y) => {
    if (x === undefined) return y;
    if (y === undefined) return x;
    if (typeof x === 'number' && typeof y === 'number') return Math.max(x,y);
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every(Number.isFinite) && y.every(Number.isFinite) ? x.map((n,i) => Math.max(n,y[i])) : unique([...x,...y]);
    if (object(x) && object(y)) { const out = {}; for (const k of new Set([...Object.keys(x),...Object.keys(y)])) own(out,k,merge(x[k],y[k])); return out; }
    return newer ? y : x;
  };
  return merge(a,b);
}

// Reversible stable identities: no hash collisions between paused runs.
export function memorizerRunPart(id) {
  const bytes = [];
  for (const c of String(id)) {
    const n = c.codePointAt(0);
    if (n < 128) bytes.push(n);
    else if (n < 2048) bytes.push(192 | n >> 6, 128 | n & 63);
    else if (n < 65536) bytes.push(224 | n >> 12, 128 | n >> 6 & 63, 128 | n & 63);
    else bytes.push(240 | n >> 18, 128 | n >> 12 & 63, 128 | n >> 6 & 63, 128 | n & 63);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = '', bits = 0, count = 0;
  for (const byte of bytes) {
    bits = bits << 8 | byte; count += 8;
    while (count >= 6) { count -= 6; out += alphabet[bits >>> count & 63]; }
  }
  if (count) out += alphabet[bits << (6-count) & 63];
  return out;
}
export function shardMemorizerRuns(value) {
  const merged = mergeMemorizer('run', null, value, true), parts = {};
  for (const run of merged.runs) parts[memorizerRunPart(run.id || run.seed || stable(run))] = { runs: [run], retired: [] };
  for (const id of merged.retired) parts[memorizerRunPart(id)] = { runs: [], retired: [id] };
  return parts;
}
