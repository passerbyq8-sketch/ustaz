/* TRANSLATE4 display layer. Reads static files under /lang/content/ and never talks to a server.
   Arabic and the other nineteen languages never load this file. A failed fetch keeps Arabic.
   Verses, hadith, du'a and dhikr stay on screen in Arabic with their translation below them. */
(function (global) {
  'use strict';
  var CONTENT_LANGS = { am: 1, om: 1, en: 1, fa: 1 };
  var SACRED = { quran: 1, hadith: 1, dua: 1, dhikr: 1 };
  var ARABIC_FORMATS = { 'missing-letter': 1, scramble: 1 };
  var options = { base: '/lang/content/', direction: function (lang) { return lang === 'fa' ? 'rtl' : 'ltr'; }, text: function () { return ''; } };
  var cache = Object.create(null), hashes = new Map(), warned = false;
  function norm(s) {
    return s.normalize('NFC')
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ​-‏﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function bytes(s) {
    if (global.TextEncoder) return new global.TextEncoder().encode(s);
    return Uint8Array.from(unescape(encodeURIComponent(s)), function (c) { return c.charCodeAt(0); });
  }
  function sha1(input) {
    var n = input.length, size = ((n + 9 + 63) >> 6) << 6, b = new Uint8Array(size), w = new Int32Array(80);
    b.set(input); b[n] = 128;
    var dv = new DataView(b.buffer); dv.setUint32(size - 8, Math.floor(n / 0x20000000)); dv.setUint32(size - 4, n << 3);
    var h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    function rol(x, k) { return (x << k) | (x >>> (32 - k)); }
    for (var off = 0; off < size; off += 64) {
      var i; for (i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4);
      for (i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      var a = h[0], c = h[2], d = h[3], e = h[4], bb = h[1];
      for (i = 0; i < 80; i++) {
        var f = i < 20 ? (bb & c) | (~bb & d) : i < 40 ? bb ^ c ^ d : i < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
        var k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        var t = (rol(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rol(bb, 30); bb = a; a = t;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
    }
    return h.map(function (v) { return ('00000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }
  function hid(s) {
    var known = hashes.get(s); if (known) return known;
    var value = 'h:' + sha1(bytes(norm(s))).slice(0, 12);
    if (hashes.size > 20000) hashes.clear();
    hashes.set(s, value); return value;
  }
  function warn() { if (!warned) { warned = true; if (global.console) global.console.warn('TR4 content unavailable; keeping Arabic.'); } }
  function configure(o) { Object.keys(o || {}).forEach(function (k) { options[k] = o[k]; }); }
  /* ok: data read. missing: the server answered 404, the language has no such file.
     failed: no answer or a broken file, so nothing may be concluded and Arabic stays. */
  function load(path) {
    if (!cache[path]) cache[path] = Promise.resolve().then(function () { return global.fetch(options.base + path); }).then(function (r) {
      if (r.status === 404) return { status: 'missing', data: null };
      if (!r.ok) throw Error('content');
      return r.json().then(function (d) { if (!d || d.schema !== 'ezik-tr4/1') throw Error('schema'); return { status: 'ok', data: d }; });
    }).catch(function () { warn(); delete cache[path]; return { status: 'failed', data: null }; });
    return cache[path];
  }
  function language() {
    var lang = 'ar';
    try { lang = global.localStorage.getItem(['ezik', 'ui', 'lang', 'v1'].join('_')) || 'ar'; } catch (_) {}
    return CONTENT_LANGS[lang] ? lang : '';
  }
  /* ---------- sections ---------- */
  var records = new WeakMap(), done = new WeakMap();
  function clearRecord(r) {
    if (r.node.isConnected && r.node.nodeValue === r.shown) r.node.nodeValue = r.ar;
    r.extra.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
  }
  function restore(root) {
    (records.get(root) || []).forEach(clearRecord);
    records.delete(root); done.delete(root);
    var notes = root.querySelectorAll ? root.querySelectorAll('[data-tr4-note]') : [];
    Array.from(notes).forEach(function (e) { e.parentNode.removeChild(e); });
  }
  function lookup(index, node, text) {
    var holder = node.parentNode && node.parentNode.closest ? node.parentNode.closest('[data-tr4-id]') : null;
    var id = holder && holder.getAttribute('data-tr4-id');
    return (id && index[id]) || index[hid(text)] || null;
  }
  /* A text node may hold several lines that the data keeps as separate units. */
  function lines(index, text) {
    if (text.indexOf('\n') < 0) return null;
    var parts = text.split('\n').filter(function (l) { return l.trim(); }), out = [];
    if (parts.length < 2) return null;
    for (var i = 0; i < parts.length; i++) {
      var hit = index[hid(parts[i])];
      if (!hit || !hit.tr) return null;
      out.push(hit);
    }
    return out;
  }
  function credit(item) {
    if (item.tag !== 'published' || !item.src || !item.src.name) return '';
    return item.src.name + (item.src.version && item.src.name.indexOf(item.src.version) < 0 ? ' · ' + item.src.version : '');
  }
  function place(root, data, index) {
    var list = (records.get(root) || []).filter(function (r) {
      if (r.node.isConnected && r.node.nodeValue === r.shown) return true;
      clearRecord(r); return false;
    });
    var seen = done.get(root) || new WeakSet(), doc = root.ownerDocument || document, lang = data.lang, nodes = [];
    function walk(n) {
      if (n.nodeType === 3) { if (/[؀-ۿ]/.test(n.nodeValue) && !seen.has(n)) nodes.push(n); return; }
      if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|svg)$/i.test(n.tagName) || n.isContentEditable || n.hasAttribute('data-tr4-owned')) return;
      Array.from(n.childNodes).forEach(walk);
    }
    walk(root);
    nodes.forEach(function (n) {
      var parent = n.parentNode, item = lookup(index, n, n.nodeValue), many = item ? null : lines(index, n.nodeValue);
      if (!item && !many) return;
      if (item && (item.tag === 'arabic-only' || typeof item.tr !== 'string' || !item.tr)) return;
      var r = { node: n, ar: n.nodeValue, shown: n.nodeValue, extra: [] };
      function add(tag, text, cls, after) {
        var el = doc.createElement(tag); el.className = cls; el.textContent = text; el.setAttribute('data-tr4-owned', ''); el.dir = options.direction(lang);
        (after || parent).insertBefore(el, (after ? null : n.nextSibling)); r.extra.push(el); return el;
      }
      var control = parent.closest ? parent.closest('button,a,[role="button"],label,summary') : null;
      if (item && SACRED[item.kind]) {
        var by = credit(item), note = item.footnotes;
        if (note) add('span', Array.isArray(note) ? note.join('\n') : String(note), 'tr4-foot').style.cssText = 'display:block;font-size:.8em;white-space:pre-line';
        if (by) {
          var source = add(control ? 'span' : 'a', by, 'tr4-source'); source.style.cssText = 'display:block;font-size:.75em;opacity:.75';
          if (source.tagName === 'A' && /^https:\/\//.test(item.src.url || '')) { source.href = item.src.url; source.rel = 'noopener noreferrer'; source.target = '_blank'; }
        }
        if (item.translit) add('span', item.translit, 'tr4-translit').style.cssText = 'display:block;font-style:italic;opacity:.85';
        add('span', item.tr, 'tr4-tr').style.cssText = 'display:block;white-space:pre-line';
      } else {
        var shown = many ? many.map(function (m) { return m.tr; }).join('\n') : item.tr;
        n.nodeValue = ''; r.shown = '';
        var span = add('span', shown, 'tr4-prose'); span.style.cssText = 'unicode-bidi:isolate;white-space:pre-line';
        var title = item && item.kind === 'title';
        if (!title && !control) {
          var button = add('button', options.text('tr4.showArabic') || 'الأصل العربي', 'tr4-toggle');
          button.type = 'button'; button.setAttribute('aria-pressed', 'false'); button.style.cssText = 'display:block;font-size:.72em;background:none;border:0;padding:2px 0;color:inherit;opacity:.7;text-decoration:underline;cursor:pointer';
          parent.insertBefore(button, span.nextSibling);
          button.addEventListener('click', function () {
            var arabic = button.getAttribute('aria-pressed') !== 'true';
            span.textContent = arabic ? r.ar : shown; span.dir = arabic ? 'rtl' : options.direction(lang); button.setAttribute('aria-pressed', String(arabic));
          });
        }
      }
      seen.add(n); list.push(r);
    });
    records.set(root, list); done.set(root, seen);
    return list.length;
  }
  function firstBlock(root, node) {
    var el = node.parentNode;
    while (el && el !== root && el.parentNode !== root && global.getComputedStyle && global.getComputedStyle(el).display === 'inline') el = el.parentNode;
    return el;
  }
  function machineNote(root, data, doc) {
    if (root.querySelector('[data-tr4-note]')) return;
    var first = (records.get(root) || [])[0], label = options.text('tr4.machine');
    if (!first || !label || !first.node.isConnected) return;
    var host = firstBlock(root, first.node); if (!host || !host.parentNode) return;
    var el = doc.createElement('div'); el.textContent = label; el.setAttribute('data-tr4-owned', ''); el.setAttribute('data-tr4-note', ''); el.dir = options.direction(data.lang);
    el.style.cssText = 'font-size:.72em;opacity:.7;padding:4px 0';
    host.parentNode.insertBefore(el, host);
  }
  /* The mounted root is observed only while a translated section is open. */
  function mount(root, lang, sections) {
    if (!CONTENT_LANGS[lang] || !root) return function () {};
    var names = Array.isArray(sections) ? sections : [sections], alive = true, observer = null, timer = 0, index = null, data = { lang: lang };
    function draw() {
      timer = 0; if (!alive || !index) return;
      if (observer) observer.disconnect();
      place(root, data, index); machineNote(root, data, root.ownerDocument || document);
      if (observer) observer.observe(root, { subtree: true, childList: true, characterData: true });
    }
    Promise.all(names.map(function (n) { return load(lang + '/sections/' + n + '.json'); })).then(function (rows) {
      if (!alive) return;
      index = Object.create(null);
      rows.forEach(function (row) {
        (row.data && Array.isArray(row.data.items) ? row.data.items : []).forEach(function (item) {
          if (!item || typeof item.ar !== 'string') return;
          index[hid(item.ar)] = index[hid(item.ar)] || item;
        });
      });
      if (global.MutationObserver) observer = new global.MutationObserver(function (list) {
        if (timer || !list.some(function (m) { var el = m.target.nodeType === 1 ? m.target : m.target.parentNode; return !el || !el.closest('[data-tr4-owned]'); })) return;
        timer = global.setTimeout(draw, 30);
      });
      draw();
    });
    return function () { alive = false; if (timer) global.clearTimeout(timer); if (observer) observer.disconnect(); restore(root); };
  }
  /* ---------- Kunuz: packs ---------- */
  function clean(name) { return String(name).replace(/[<>&"'`]/g, function (c) { return c === "'" ? '’' : ''; }); }
  /* Solo rule, owner decision t8. Packs never reach a room, so a hidden question is simply not registered. */
  function overlayPack(pack, lang, stamp) {
    return load(lang + '/packs/kunuz-pack-' + pack.slug + '.json').then(function (row) {
      if (row.status === 'failed') return pack;
      var tr = row.data;
      if (row.status === 'ok' && (tr.lang !== lang || tr.slug !== pack.slug || tr.stamp !== pack.stamp || !Array.isArray(tr.qs))) return pack;
      var byId = Object.create(null); ((tr && tr.qs) || []).forEach(function (q) { if (q && q.id) byId[q.id] = q; });
      var kept = [];
      pack.qs.forEach(function (q) {
        var t = byId[q.id];
        if (!t || t.tag === 'arabic-only' || ARABIC_FORMATS[q.fmt] || !Array.isArray(t.choices) || t.choices.length !== q.choices.length || typeof t.q !== 'string' || !t.q) return;
        if (!t.choices.every(function (v) { return typeof v === 'string' && v.trim(); }) || new Set(t.choices).size !== t.choices.length) return;
        kept.push(Object.assign({}, q, { q: t.q, choices: t.choices.slice(), why: typeof t.why === 'string' && t.why ? t.why : q.why, kzLang: lang }));
      });
      if (!kept.length) return null;
      var names = Object.create(null); ((tr && tr.cats) || []).forEach(function (c) { if (c && c.id && typeof c.name === 'string' && c.name.trim()) names[c.id] = clean(c.name); });
      return Object.assign({}, pack, { qs: kept, stamp: stamp(kept), cats: pack.cats.map(function (c) { return names[c.id] ? Object.assign({}, c, { name: names[c.id] }) : c; }) });
    });
  }
  /* ---------- Kunuz: core bank ---------- */
  /* The row keeps its place, id, answer and category. A hidden row stays in DATA because rooms read it. */
  function overlayCore(lang) {
    return load(lang + '/core.json').then(function (row) {
      if (row.status === 'failed' || !global.DATA || !Array.isArray(global.DATA.qs)) return 0;
      var items = (row.data && row.data.items) || {}, cats = (row.data && row.data.cats) || {}, count = 0;
      global.DATA.qs.forEach(function (q) {
        if (q[2] === 0) return;
        var t = Object.prototype.hasOwnProperty.call(items, q[8]) ? items[q[8]] : null;
        if (!t || !Array.isArray(t[1]) || t[1].length !== q[4].length) { q.kzHide = true; return; }
        q.kzAr = [q[3], q[4], q[6]]; q[3] = t[0]; q[4] = t[1].slice(); if (t[2]) q[6] = t[2]; count++;
      });
      global.DATA.cats.forEach(function (c) { if (typeof cats[c[0]] === 'string' && cats[c[0]]) c[1] = cats[c[0]]; });
      return count;
    });
  }
  /* ---------- rooms ---------- */
  /* Room text comes from the worker in Arabic. It is translated on this reader's screen only. */
  function roomOverlay(lang) {
    return load(lang + '/room-text.json').then(function (row) {
      if (row.status !== 'ok' || !row.data.keys) return false;
      var keys = row.data.keys, root = document.body, dir = options.direction(lang), pending = 0;
      function each(n) {
        if (n.nodeType === 3) {
          if (!/[؀-ۿ]/.test(n.nodeValue)) return;
          var hit = keys[hid(n.nodeValue)];
          if (typeof hit === 'string' && hit) { n.nodeValue = hit; if (n.parentNode && n.parentNode.setAttribute) n.parentNode.setAttribute('dir', dir); }
          return;
        }
        if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|svg)$/i.test(n.tagName)) return;
        Array.from(n.childNodes).forEach(each);
      }
      function sweep() { pending = 0; each(root); }
      new global.MutationObserver(function () { if (!pending) pending = global.setTimeout(sweep, 30); }).observe(root, { subtree: true, childList: true, characterData: true });
      sweep(); return true;
    });
  }
  global.TR4 = { norm: norm, hid: hid, configure: configure, language: language, mount: mount, restore: restore, overlayPack: overlayPack, overlayCore: overlayCore, roomOverlay: roomOverlay };
})(typeof window === 'undefined' ? globalThis : window);
