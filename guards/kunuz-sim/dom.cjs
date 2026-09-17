'use strict';
const vm = require('vm');
// ---------- mini DOM ----------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const dec = s => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ENT[k]);
function makeStyle() { const p = {}; return { _p: p, setProperty(k, v) { p[k] = String(v); }, getPropertyValue(k) { return p[k] || ''; }, removeProperty(k) { delete p[k]; } }; }
class Txt { constructor(d) { this.nodeType = 3; this.data = d; this.parentNode = null; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } remove() { if (this.parentNode) this.parentNode.removeChild(this); } }
const SELC = new Map();
const VER = { v: 0 };
function parseSel(sel) {
  if (SELC.has(sel)) return SELC.get(sel);
  const r = parseSel0(sel); SELC.set(sel, r); return r;
}
function parseSel0(sel) {
  return sel.split(',').map(s => s.trim()).map(s => s.split(/\s+/).map(part => {
    const c = { tag: null, id: null, cls: [], attrs: [] };
    const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
    let m, used = 0;
    while ((m = re.exec(part))) {
      if (m.index !== used) throw new Error('selector unsupported: ' + sel);
      used = re.lastIndex;
      if (m[1]) c.tag = m[1].toLowerCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]);
      else c.attrs.push([m[4].toLowerCase(), m[5] !== undefined ? m[5] : m[6] !== undefined ? m[6] : m[7]]);
    }
    if (used !== part.length) throw new Error('selector unsupported: ' + sel);
    return c;
  }));
}
function matchC(e, c) {
  if (!e || e.nodeType !== 1) return false;
  if (c.tag && e.localName !== c.tag) return false;
  if (c.id && e.id !== c.id) return false;
  const cs = e.attrs.class || ''; if (e._cs !== cs) { e._cs = cs; e._cl = cs.split(/\s+/); } const cl = e._cl;
  for (const k of c.cls) if (!cl.includes(k)) return false;
  for (const [k, v] of c.attrs) { if (!(k in e.attrs)) return false; if (v !== undefined && e.attrs[k] !== v) return false; }
  return true;
}
function matches(e, sel) {
  return parseSel(sel).some(chain => {
    if (!matchC(e, chain[chain.length - 1])) return false;
    let n = e.parentNode;
    for (let i = chain.length - 2; i >= 0; i--) { while (n && n.nodeType === 1 && !matchC(n, chain[i])) n = n.parentNode; if (!n || n.nodeType !== 1) return false; n = n.parentNode; }
    return true;
  });
}
function walk(n, f) { const ch = n.childNodes; for (let i = 0; i < ch.length; i++) { const c = ch[i]; if (c.nodeType === 1) { f(c); walk(c, f); } } }
class El {
  constructor(tag, doc) { this.localName = tag.toLowerCase(); this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = doc; this.attrs = {}; this.childNodes = []; this.parentNode = null; this._l = {}; this.style = makeStyle(); }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get id() { return this.attrs.id || ''; } set id(v) { VER.v++; this.attrs.id = String(v); }
  get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
  get classList() {
    const el = this, list = () => el.className.split(/\s+/).filter(Boolean);
    return { add(...c) { const l = list(); c.forEach(x => { if (!l.includes(x)) l.push(x); }); el.className = l.join(' '); },
      remove(...c) { el.className = list().filter(x => !c.includes(x)).join(' '); },
      contains(c) { return list().includes(c); },
      toggle(c, f) { const h = list().includes(c), w = f === undefined ? !h : !!f; if (w && !h) this.add(c); if (!w && h) this.remove(c); return w; } };
  }
  get dataset() {
    const el = this, key = k => 'data-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    return new Proxy({}, { get(_, k) { return typeof k === 'string' ? el.attrs[key(k)] : undefined; }, set(_, k, v) { el.attrs[key(k)] = String(v); return true; },
      has(_, k) { return key(k) in el.attrs; }, deleteProperty(_, k) { delete el.attrs[key(k)]; return true; } });
  }
  setAttribute(k, v) { VER.v++; this.attrs[k.toLowerCase()] = String(v); }
  getAttribute(k) { k = k.toLowerCase(); return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k.toLowerCase() in this.attrs; }
  removeAttribute(k) { delete this.attrs[k.toLowerCase()]; }
  get disabled() { return 'disabled' in this.attrs; } set disabled(v) { if (v) this.attrs.disabled = ''; else delete this.attrs.disabled; }
  get hidden() { return 'hidden' in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  get value() { if (this._value !== undefined) return this._value; if (this.localName === 'textarea') return this.textContent; if (this.localName === 'select') { const o = this.querySelectorAll('option'); const s = o.find(x => x.selected) || o[0]; return s ? String(s.value) : ''; } return this.attrs.value || ''; }
  set value(v) { this._value = String(v); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { VER.v++; this.childNodes.forEach(n => n.parentNode = null); this.childNodes = []; if (v !== '' && v != null) this.appendChild(new Txt(String(v))); }
  get innerHTML() { return this.childNodes.map(ser).join(''); }
  set innerHTML(v) { VER.v++; this.childNodes.forEach(n => n.parentNode = null); this.childNodes = []; parseInto(this, String(v)); }
  appendChild(n) { VER.v++; if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  append(...ns) { ns.forEach(n => this.appendChild(typeof n === 'string' ? new Txt(n) : n)); }
  prepend(...ns) { ns.reverse().forEach(n => this.insertBefore(typeof n === 'string' ? new Txt(n) : n, this.firstChild)); }
  insertBefore(n, ref) { VER.v++; if (!ref) return this.appendChild(n); if (n.parentNode) n.parentNode.removeChild(n); const i = this.childNodes.indexOf(ref); if (i < 0) throw new Error('insertBefore: ref not child'); n.parentNode = this; this.childNodes.splice(i, 0, n); return n; }
  removeChild(n) { VER.v++; const i = this.childNodes.indexOf(n); if (i < 0) throw new Error('removeChild: not a child'); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  replaceChildren(...ns) { VER.v++; this.childNodes.forEach(n => n.parentNode = null); this.childNodes = []; this.append(...ns); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  querySelectorAll(sel) { const o = []; walk(this, e => { if (matches(e, sel)) o.push(e); }); return o; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  matches(sel) { return matches(this, sel); }
  closest(sel) { let e = this; while (e && e.nodeType === 1) { if (matches(e, sel)) return e; e = e.parentNode; } return null; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
  removeEventListener(t, f) { if (this._l[t]) this._l[t] = this._l[t].filter(x => x !== f); }
  click() { if (this.disabled) return; this.ownerDocument._dispatch(this, 'click', {}); }
  focus() {} blur() {}
  setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  get clientHeight() { return 0; } get clientWidth() { return 0; } get offsetHeight() { return 0; } get offsetWidth() { return 0; }
}
function ser(n) {
  if (n.nodeType === 3) return n.data.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const a = Object.entries(n.attrs).map(([k, v]) => ' ' + k + '="' + v.replace(/"/g, '&quot;') + '"').join('');
  return '<' + n.localName + a + '>' + (VOID.has(n.localName) ? '' : n.childNodes.map(ser).join('') + '</' + n.localName + '>');
}
function parseInto(parent, html) {
  const doc = parent.ownerDocument, stack = [parent]; let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { const e = html.indexOf('-->', i); i = e < 0 ? html.length : e + 3; continue; }
    if (html[i] === '<' && html[i + 1] === '!') { i = html.indexOf('>', i) + 1; continue; }
    if (html[i] === '<' && html[i + 1] === '/') {
      const e = html.indexOf('>', i), tag = html.slice(i + 2, e).trim().toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) if (stack[s].localName === tag) { stack.length = s; break; }
      i = e + 1; continue;
    }
    if (html[i] === '<' && /[a-zA-Z]/.test(html[i + 1] || '')) {
      let j = i + 1, q = null;
      for (; j < html.length; j++) { const ch = html[j]; if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break; }
      let inner = html.slice(i + 1, j); const selfClose = /\/\s*$/.test(inner); if (selfClose) inner = inner.replace(/\/\s*$/, '');
      const tag = inner.match(/^[a-zA-Z][\w-]*/)[0];
      const el = new El(tag, doc);
      const re = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; re.lastIndex = tag.length; let m;
      while ((m = re.exec(inner))) el.attrs[m[1].toLowerCase()] = dec(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '');
      top().appendChild(el); i = j + 1;
      if (RAW.has(el.localName)) { const e = html.toLowerCase().indexOf('</' + el.localName, i); const end = e < 0 ? html.length : e; if (end > i) el.appendChild(new Txt(html.slice(i, end))); i = e < 0 ? html.length : html.indexOf('>', e) + 1; continue; }
      if (!VOID.has(el.localName) && !selfClose) stack.push(el);
      continue;
    }
    let e = html.indexOf('<', i + 1); if (e < 0) e = html.length;
    const t = dec(html.slice(i, e)); if (t) top().appendChild(new Txt(t)); i = e;
  }
}
module.exports = { VER, El, Txt, parseInto, walk, matches, ser };
