// kunuz-sim/world.cjs -- the world section of quest-review/export/_life/guard.js (AE06274A), verbatim.
// Never executed on its own: the two kunuz guards read this file as TEXT and slice it between the markers.
// ---------- world ----------
function makeWorld(src, DATA, screens, o) {
  o = o || {};
  const errors = [], T = { now: 1000, seq: 0, q: [] };
  const doc = { nodeType: 9, _l: {}, parentNode: null };
  const html = new El('html', doc); html.parentNode = doc;
  const body = new El('body', doc); html.appendChild(body);
  doc.documentElement = html; doc.body = body;
  const cache = new Map();
  const attached = e => { for (let n = e; n; n = n.parentNode) if (n === html) return true; return false; };
  const find = (n, id) => { for (const c of n.childNodes) if (c.nodeType === 1) { if (c.id === id) return c; const f = find(c, id); if (f) return f; } return null; };
  const miss = new Map();
  doc.getElementById = id => { const c = cache.get(id); if (c && c.id === id && attached(c)) return c; if (miss.get(id) === VER.v) return null; const f = find(html, id); if (f) cache.set(id, f); else miss.set(id, VER.v); return f; };
  doc.createElement = t => new El(t, doc);
  doc.createElementNS = (ns, t) => new El(t, doc);
  doc.createTextNode = t => new Txt(t);
  doc.querySelectorAll = s => html.querySelectorAll(s);
  doc.querySelector = s => doc.querySelectorAll(s)[0] || null;
  doc.addEventListener = (t, f) => { (doc._l[t] = doc._l[t] || []).push(f); };
  doc.removeEventListener = (t, f) => { if (doc._l[t]) doc._l[t] = doc._l[t].filter(x => x !== f); };
  doc.execCommand = () => true;
  doc.elementFromPoint = (x, y) => (W.hit ? W.hit(x, y) : null);
  doc._dispatch = (target, type, extra) => {
    let stopped = false;
    const ev = Object.assign({ type, target, bubbles: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { stopped = true; }, pointerId: 1, button: 0, clientX: 0, clientY: 0 }, extra);
    for (let n = target; n && !stopped; n = n.parentNode) {
      ev.currentTarget = n;
      try { if (typeof n['on' + type] === 'function') n['on' + type].call(n, ev); (n._l[type] || []).slice().forEach(f => f.call(n, ev)); }
      catch (e) { errors.push(e); }
    }
    for (const f of (win._l[type] || []).slice()) { if (stopped) break; try { f(ev); } catch (e) { errors.push(e); } }
    return ev;
  };
  parseInto(body, src.BODY);
  const win = { _l: {} };
  const M = Object.create(Math); M.random = R;
  const ctx = {
    document: doc, navigator: {}, console: { log() {}, warn() {}, error(...a) { errors.push(new Error('console.error ' + a.join(' '))); } },
    setTimeout: (f, ms, ...a) => { const id = ++T.seq; T.q.push({ id, at: T.now + Math.max(0, +ms || 0), f, a }); return id; },
    clearTimeout: id => { T.q = T.q.filter(x => x.id !== id); },
    setInterval: (f, ms) => { const id = ++T.seq; const x = { id, at: T.now + ms, a: [] }; x.f = () => { f(); x.at = T.now + Math.max(1, ms); T.q.push(x); }; T.q.push(x); return id; },
    clearInterval: id => { T.q = T.q.filter(x => x.id !== id); },
    requestAnimationFrame: f => { const id = ++T.seq; T.q.push({ id, at: (Math.floor(T.now / 16) + 1) * 16, raf: true, f }); return id; },
    cancelAnimationFrame: id => { T.q = T.q.filter(x => x.id !== id); },
    performance: { now: () => T.now },
    matchMedia: q => ({ matches: !!o.reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    scrollTo() {}, innerWidth: 360, innerHeight: 740,
    addEventListener: (t, f) => { (win._l[t] = win._l[t] || []).push(f); },
    removeEventListener: (t, f) => { if (win._l[t]) win._l[t] = win._l[t].filter(x => x !== f); },
    DATA, Math: M, JSON, String, Number, Array, Object, Date, parseInt, parseFloat, isNaN, isFinite, Error, Promise, Set, Map
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const W = {
    ctx, doc, errors, T, fails: [], hit: null,
    advance(ms) { const end = T.now + ms; for (;;) { let bi = -1; for (let i = 0; i < T.q.length; i++) { const x = T.q[i]; if (bi < 0 || x.at < T.q[bi].at || (x.at === T.q[bi].at && x.id < T.q[bi].id)) bi = i; } if (bi < 0 || T.q[bi].at > end) break; const x = T.q.splice(bi, 1)[0]; T.now = x.at; try { x.raf ? x.f(T.now) : x.f(...x.a); } catch (e) { errors.push(e); } } T.now = end; },
    $: id => doc.getElementById(id),
    shown(el) { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { if (n.classList.contains('hidden') || n.hasAttribute('hidden')) return false; } return !!el && attached(el); },
    screen() { return screens.find(id => W.shown(doc.getElementById(id))); },
    fail(m) { W.fails.push(m); },
    tap(el, label) { if (!el) return W.fail('missing ' + label), false; if (!W.shown(el)) return W.fail('hidden ' + label), false; if (el.disabled) return W.fail('disabled ' + label), false; el.click(); return true; },
    ptr(el, type, y, x) { return doc._dispatch(el, type, { clientY: y || 0, clientX: x || 0, pointerType: 'touch', isPrimary: true }); }
  };
  try { vm.runInContext(src.ENGINE, ctx, { filename: 'engine.js' }); } catch (e) { errors.push(e); }
  W.qn = 0;
  if (typeof ctx.pickQ === 'function') { const orig = ctx.pickQ; ctx.pickQ = function () { W.qn++; return orig.apply(this, arguments); }; }
  return W;
}

// ---------- synthetic bank (end marker; nothing follows) ----------
