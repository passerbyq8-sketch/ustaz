// guards/sync-fake-store.cjs -- an in-memory stand-in for the Upstash client, for the sync guards.
//
// It implements exactly the commands lib/auth/store.js, lib/daycap.js and lib/sync/store.js call,
// with Upstash's own habit of handing back JSON-looking strings already parsed, and it runs the
// two Lua scripts the code sends (the sync compare-and-set and the auth take-once) in JavaScript,
// recognised by their text. `ops` records every command for the guards to count. Nothing touches
// a network or a disk.
'use strict';

function autoParse(v) {
  if (typeof v !== 'string') return v;
  try { const p = JSON.parse(v); return p; } catch (e) { return v; }
}

function makeStore(opts) {
  const o = opts || {};
  const data = new Map();          // key -> { t: 'str'|'hash'|'set', v }
  const ops = [];
  const dead = () => { if (o.down) throw new Error('fake store down'); };
  const h = (k) => { const e = data.get(k); if (!e) return null; if (e.t !== 'hash') throw new Error('WRONGTYPE'); return e.v; };
  const hput = (k) => { let e = data.get(k); if (!e) { e = { t: 'hash', v: new Map() }; data.set(k, e); } return e.v; };
  const S = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const api = {
    ops, data,
    async get(k) { dead(); ops.push(['get', k]); const e = data.get(k); return e && e.t === 'str' ? autoParse(e.v) : null; },
    async set(k, v, so) {
      dead(); ops.push(['set', k]);
      if (so && so.nx && data.has(k)) return null;
      data.set(k, { t: 'str', v: S(v) }); return 'OK';
    },
    async del(...ks) { dead(); let n = 0; for (const k of ks) { ops.push(['del', k]); if (data.delete(k)) n++; } return n; },
    async expire(k) { dead(); ops.push(['expire', k]); return data.has(k) ? 1 : 0; },
    async incr(k) {
      dead(); ops.push(['incr', k]);
      const e = data.get(k); const n = (e ? Number(e.v) : 0) + 1; data.set(k, { t: 'str', v: String(n) }); return n;
    },
    async mget(...ks) { dead(); ops.push(['mget', ks.join(',')]); return ks.map((k) => { const e = data.get(k); return e && e.t === 'str' ? autoParse(e.v) : null; }); },
    async hget(k, f) { dead(); ops.push(['hget', k]); const m = h(k); return m && m.has(f) ? autoParse(m.get(f)) : null; },
    async hgetall(k) {
      dead(); ops.push(['hgetall', k]); const m = h(k); if (!m || m.size === 0) return null;
      const out = {}; for (const [f, v] of m) out[f] = autoParse(v); return out;
    },
    async hset(k, obj) { dead(); ops.push(['hset', k]); const m = hput(k); for (const f of Object.keys(obj)) m.set(f, S(obj[f])); return 1; },
    async smembers(k) { dead(); ops.push(['smembers', k]); const e = data.get(k); return e && e.t === 'set' ? Array.from(e.v) : []; },
    async sadd(k, ...ms) { dead(); ops.push(['sadd', k]); let e = data.get(k); if (!e) { e = { t: 'set', v: new Set() }; data.set(k, e); } ms.forEach((m) => e.v.add(m)); return 1; },
    async sismember(k, m) { dead(); ops.push(['sismember', k]); const e = data.get(k); return e && e.t === 'set' && e.v.has(m) ? 1 : 0; },
    pipeline() {
      const q = [];
      const p = {
        incr(k) { q.push(() => api.incr(k)); return p; },
        expire(k, s) { q.push(() => api.expire(k, s)); return p; },
        async exec() { const out = []; for (const f of q) out.push(await f()); return out; },
      };
      return p;
    },
    async eval(script, keys, argv) {
      dead(); ops.push(['eval', keys[0]]);
      if (/HSTRLEN/.test(script)) {
        const [r, q, v, m] = keys; const [id, expected, envlp, quota] = argv;
        const vm = h(v); const cur = vm && vm.has(id) ? String(vm.get(id)) : '0';
        if (cur !== expected) return [-1, Number(cur)];
        const rm = h(r); const old = rm && rm.has(id) ? rm.get(id).length : 0;
        const delta = envlp.length - old;
        const mm = h(m); const total = mm && mm.has('bytes') ? Number(mm.get('bytes')) : 0;
        if (delta > 0 && total + delta > Number(quota)) return [-2, total];
        const M = hput(m); const seq = (M.has('seq') ? Number(M.get('seq')) : 0) + 1; M.set('seq', String(seq));
        hput(r).set(id, envlp); hput(q).set(id, String(seq)); const nv = Number(expected) + 1; hput(v).set(id, String(nv));
        M.set('bytes', String(total + delta));
        return [seq, nv];
      }
      if (/redis\.call\('GET', KEYS\[1\]\)/.test(script) && /DEL/.test(script)) {
        const e = data.get(keys[0]); if (!e) return null; data.delete(keys[0]); return autoParse(e.v);
      }
      throw new Error('fake store: unknown script');
    },
    /** Every stored byte, for the "no plain text in the store" check. */
    dump() {
      const parts = [];
      for (const [k, e] of data) {
        parts.push(k);
        if (e.t === 'str') parts.push(e.v);
        else if (e.t === 'hash') for (const [f, v] of e.v) { parts.push(f); parts.push(v); }
        else for (const m of e.v) parts.push(m);
      }
      return parts.join('\n');
    },
  };
  return api;
}

module.exports = { makeStore };
