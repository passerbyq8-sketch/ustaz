'use strict';
(function () {
  // ------------------------------------------------------------------ constants
  const IN_EZIK = /\/mushaf-lab\/(index\.html)?$/.test(location.pathname);   // served inside Ezik: text, layout and pages come from Ezik itself
  const IMG = (n) => (IN_EZIK ? '../assets/madina-hafs/page-' : 'https://ezik.app/assets/madina-hafs/page-') + pad3(n) + '.webp';
  const SVG = (n) => 'https://mushaf.almurabbi.app/pages/' + pad3(n) + '.svg';
  const AUDIO = (rec, s, a) => 'https://everyayah.com/data/' + rec + '/' + pad3(s) + pad3(a) + '.mp3';
  const TAFSIR_BASES = ['https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/', 'https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/'];
  const TRANS_BASES = ['https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/', 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/'];
  const SVG_W = 382.68, SVG_H = 547.09, PRINT_H = 1229, Y_A = 2.5009, Y_B = -63.05;   // measured mapping, svg -> print
  const FALLBACK_RECITER = { id: 'Hudhaify_64kbps', name: 'علي الحذيفي' };
  // Ezik register item 4 (offline): the ONE store every download lands in. Ezik's sw.js declares the same
  // string once and never sweeps it on a ship; its guard fails when the two differ.
  const DL_STORE = 'ezik-mushaf-downloads-v1';
  const DL_HEADER = 'x-ezik-download';   // tells Ezik's worker the downloads sheet stores this response itself
  const AR = '٠١٢٣٤٥٦٧٨٩';
  let EMBED = false; try { EMBED = window.top !== window.self; } catch (e) { EMBED = true; }   // inside Ezik's preview frame

  function pad3(n) { return String(n).padStart(3, '0'); }
  const ar = (n) => String(n).replace(/[0-9]/g, (d) => AR[+d]);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lab.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lab.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  // ------------------------------------------------------------------ state
  let T, META, LAY, Q, IML = null;
  let S;                          // settings
  let cur = 3;                    // current (anchor) page
  const geoCache = new Map();
  const pageAyat = [], pageTypes = [];
  const ayahPage = {};
  const quarterByPage = {};
  let slots = null;               // [next | current | previous] slot elements of the page track
  let selKey = null;              // ayah with its menu open
  let rangeStart = null, rangeKeys = null;
  let flashKey = null, flashTimer = 0;

  // ------------------------------------------------------------------ boot
  boot();
  async function boot() {
    try {
      const [t, m, l, q] = await Promise.all(['data/tables.json', 'data/meta.json', IN_EZIK ? '../mushaf-layout.json' : 'data/mushaf-layout.json', IN_EZIK ? '../quran-uthmani.json' : 'data/quran-uthmani.json']
        .map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })));
      T = t; META = m; LAY = l; Q = q;
    } catch (e) {
      $('loading').textContent = 'تعذّر تحميل بيانات المصحف. تحقّقْ من الاتصال ثمّ أعِدْ فتحَ الصفحة.';
      return;
    }
    buildIndexes();
    S = Object.assign({
      theme: 'auto', mode: 'print', spread: true, nightB: 0.92, nightC: 1, desk: 'green', tfs: 18,
      reciter: (META.reciters && META.reciters[0] ? META.reciters[0].id : FALLBACK_RECITER.id),
      tafsirs: ['ar-tafsir-muyassar', 'ar-tafseer-al-saddi', 'ar-tafsir-ibn-kathir'], trans: '', markBm: true,
      speed: 1, repAyah: 1, repRange: 1, follow: true
    }, store.get('settings', {}));
    const okT = new Set((META.tafsirs || []).map((x) => x.id));
    S.tafsirs = S.tafsirs.filter((x) => okT.has(x));
    applySettings();
    syncInsets();
    wire();
    const last = store.get('last', 3);
    cur = clampPage(last);
    route(true);
    $('loading').hidden = true;
    if (!store.get('hintSeen', false)) $('hint').hidden = false;
    if (!EMBED && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function buildIndexes() {
    for (const pg of LAY.p) {
      const keys = []; const types = [];
      for (const ln of pg.l) {
        types.push(ln);
        for (const k of (ln.w || [])) {
          const p = k.split(':'); const a = p[0] + ':' + p[1];
          if (keys[keys.length - 1] !== a && keys.indexOf(a) < 0) keys.push(a);
          if (!(a in ayahPage)) ayahPage[a] = pg.n;
        }
      }
      pageAyat[pg.n] = keys; pageTypes[pg.n] = types;
    }
    T.quarters.forEach((q, i) => { const p = ayahPage[q[0] + ':' + q[1]]; (quarterByPage[p] = quarterByPage[p] || []).push(i); });
  }
  const clampPage = (p) => Math.max(1, Math.min(604, parseInt(p, 10) || 1));
  const surahName = (s) => T.names[s - 1];
  const juzOf = (p) => { let j = 1; for (let i = 0; i < 30; i++) if (T.pageForJuz[i] <= p) j = i + 1; return j; };
  const refText = (key) => { const [s, a] = key.split(':'); return 'سورة ' + surahName(+s) + '، الآية ' + ar(a); };
  const shortRef = (key) => { const [s, a] = key.split(':'); return surahName(+s) + ' ' + ar(a); };
  const ayahText = (key) => Q[key] || '';
  const quarterLabel = (i) => { const h = Math.floor(i / 4) + 1; return ['الحزب ', 'ربع الحزب ', 'نصف الحزب ', 'ثلاثة أرباع الحزب '][i % 4] + ar(h); };
  function nextKey(key) { let [s, a] = key.split(':').map(Number); a++; if (a > T.nAyah[s - 1]) { s++; a = 1; } return s > 114 ? null : s + ':' + a; }
  function prevKey(key) { let [s, a] = key.split(':').map(Number); a--; if (a < 1) { s--; if (s < 1) return null; a = T.nAyah[s - 1]; } return s + ':' + a; }
  function cmpKey(x, y) { const [a1, b1] = x.split(':').map(Number), [a2, b2] = y.split(':').map(Number); return a1 - a2 || b1 - b2; }
  function keysBetween(a, b) { if (cmpKey(a, b) > 0) { const t = a; a = b; b = t; } const out = []; let k = a; while (k) { out.push(k); if (k === b) break; k = nextKey(k); } return out; }

  // ------------------------------------------------------------------ canonical words (same rules as Ezik's reader)
  const isLetter = (cp) => (cp >= 0x0621 && cp <= 0x063A) || (cp >= 0x0641 && cp <= 0x064A) || (cp >= 0x0671 && cp <= 0x06D3);
  const hasLetter = (t) => { for (const ch of t) if (isLetter(ch.codePointAt(0))) return true; return false; };
  const LIG = { '2:181': 3, '8:6': 4, '13:37': 8, '37:130': 3 };
  const wordCache = {};
  function wordsOf(key) {
    if (wordCache[key]) return wordCache[key];
    const out = []; let lead = '';
    for (const tok of ayahText(key).split(/\s+/)) {
      if (!tok) continue;
      if (hasLetter(tok)) { out.push(lead ? lead + ' ' + tok : tok); lead = ''; }
      else if (out.length) out[out.length - 1] += ' ' + tok;
      else lead = lead ? lead + ' ' + tok : tok;
    }
    if (key in LIG) { const i = LIG[key] - 1; out.splice(i, 2, out[i] + ' ' + out[i + 1]); }
    return (wordCache[key] = out);
  }

  // ------------------------------------------------------------------ settings
  function applySettings() {
    const de = document.documentElement;
    if (S.theme === 'auto') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', S.theme);
    if (S.desk === 'green') de.removeAttribute('data-desk'); else de.setAttribute('data-desk', S.desk);
    de.style.setProperty('--night-b', S.nightB); de.style.setProperty('--night-c', S.nightC); de.style.setProperty('--tafsir-fs', S.tfs + 'px');
  }
  function saveSettings() { store.set('settings', S); applySettings(); }
  const reciters = () => (META.reciters && META.reciters.length ? META.reciters : [FALLBACK_RECITER]);
  const reciterName = (id) => { const r = reciters().find((x) => x.id === id); return r ? r.name : id; };

  // ------------------------------------------------------------------ pages
  const isSpread = () => S.spread && window.innerWidth >= 900 && window.innerWidth > window.innerHeight;
  const FILL_Q = '(orientation: portrait) and (max-width: 700px)';   // same rule as Ezik's reader: a phone held upright fills the screen
  const pageAspect = (st) => st._aspect || (S.mode === 'vector' ? 382.68 / 547.09 : (+st.dataset.p < 3 ? 851 / 1368 : 747 / 1229));
  // Inside Ezik's frame this page is an iframe, where env(safe-area-inset-*) is always 0, so the bars sat
  // under Android's three navigation buttons. Ezik's own document (same origin) sees the real insets:
  // measure them there and hand them to the bars and the page area as --sat / --sab.
  function syncInsets() {
    if (!EMBED) return;
    let t = 0, b = 0;
    try {
      const pd = window.parent.document, el = pd.createElement('div');
      el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      pd.body.appendChild(el); const cs = window.parent.getComputedStyle(el);
      t = parseFloat(cs.paddingTop) || 0; b = parseFloat(cs.paddingBottom) || 0; el.remove();
    } catch (e) {}
    document.documentElement.style.setProperty('--sat', t + 'px'); document.documentElement.style.setProperty('--sab', b + 'px');
  }
  function sizeStages() {
    const box = $('main'); const W = (box && box.clientWidth) || window.innerWidth, H = (box && box.clientHeight) || window.innerHeight;
    const groups = slots ? slots.map((sl) => Array.from(sl.querySelectorAll('.stage'))) : [Array.from(document.querySelectorAll('.stage'))];
    for (const stages of groups) {
      if (!stages.length) continue;
      let fill = false; try { fill = stages.length === 1 && window.matchMedia(FILL_Q).matches; } catch (e) {}
      if (fill) stages.forEach((st) => { st.style.width = W + 'px'; st.style.height = H + 'px'; });
      else {
        const gap = stages.length > 1 ? 10 : 0; const sumA = stages.reduce((t, st) => t + pageAspect(st), 0);
        const h = Math.max(1, Math.floor(Math.min(H, (W - gap) / sumA)));
        stages.forEach((st) => { st.style.height = h + 'px'; st.style.width = Math.floor(h * pageAspect(st)) + 'px'; });
      }
      stages.forEach(fitStage);
    }
  }
  // the bars float over the page; one short tap hides or shows all of them
  let chromeAuto = false;
  const setImmersive = (on) => document.body.classList.toggle('immersive', !!on);
  const toggleChrome = () => setImmersive(!document.body.classList.contains('immersive'));
  const geoUrl = (p) => 'geometry/' + pad3(p) + '.json?v=' + encodeURIComponent((META && META.built) || '1');   // a rebuild gets fresh URLs past every cache
  function visiblePages(p) { if (!isSpread()) return [p]; const odd = p % 2 ? p : p - 1; return [odd, odd + 1].filter((x) => x >= 1 && x <= 604); }
  async function loadGeo(p) {
    if (p < 3) return null;
    if (geoCache.has(p)) return geoCache.get(p);
    const pr = fetch(geoUrl(p)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    geoCache.set(p, pr);
    const g = await pr; geoCache.set(p, g); return g;
  }
  const toEzik = (msg) => { if (!EMBED) return; try { window.parent.postMessage(msg, location.origin); } catch (e) {} };
  const surahOfPage = (p) => { const k = pageAyat[p] && pageAyat[p][0]; return k ? +k.split(':')[0] : 1; };
  function notePage() {
    store.set('last', cur); toEzik({ type: 'mushaf-lab:page', page: cur, s: surahOfPage(cur) });
    const rec = store.get('recent', []).filter((x) => x !== cur); rec.unshift(cur); store.set('recent', rec.slice(0, 12));
  }
  const prefetchAround = () => [cur - 4, cur - 3, cur - 2, cur - 1, cur + 1, cur + 2, cur + 3, cur + 4].forEach((q) => { if (q >= 3 && q <= 604) loadGeo(q); });
  function goPage(p) { cur = clampPage(p); notePage(); render(); prefetchAround(); }
  // Three slots side by side, [next | current | previous]: the next page lies to the LEFT, as in a printed mushaf.
  // The track follows the finger; on release it glides to the neighbour or back, then the slots rotate.
  function neighborAnchor(p, dir) { const inc = isSpread() ? 2 : 1; const base = isSpread() ? (p % 2 ? p : p - 1) : p; const n = base + dir * inc; return n >= 1 && n <= 604 ? n : 0; }
  function makeStage(p) {
    const st = document.createElement('div');
      st.className = 'stage' + (S.mode === 'vector' ? ' vector' : '') + (p < 3 ? ' list-only' : ''); st.dataset.p = p;
      const im = document.createElement('img'); im.alt = 'صفحة ' + ar(p); im.decoding = 'async'; im.draggable = false;
      im.src = S.mode === 'vector' ? SVG(p) : IMG(p);
      im.addEventListener('load', () => { if (im.naturalWidth && im.naturalHeight) st._aspect = im.naturalWidth / im.naturalHeight; sizeStages(); }); im.addEventListener('error', () => { const ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = 'تعذّر تحميل صورة الصفحة'; st.appendChild(ph); });
      const layer = document.createElement('div'); layer.className = 'layer';
      const tl = document.createElement('div'); tl.className = 'tl';
      st.append(im, layer, tl);
      if (p >= 3) loadGeo(p).then((g) => { if (g && st.isConnected) { buildTextLayer(st, g); drawMarks(st); } });
    return st;
  }
  function fillSlot(sl, anchor) { sl.textContent = ''; sl.dataset.anchor = anchor || ''; if (anchor) visiblePages(anchor).forEach((p) => sl.appendChild(makeStage(p))); }
  function setTrack(dx, animate) {
    const sp = $('spread');
    sp.style.transition = animate ? 'transform .28s cubic-bezier(.2,.7,.2,1)' : 'none';
    sp.style.transform = 'translate3d(calc(-100% / 3 + ' + Math.round(dx) + 'px), 0, 0)';
  }
  function render() {
    const sp = $('spread'); sp.textContent = '';
    slots = [0, 1, 2].map(() => { const d = document.createElement('div'); d.className = 'slot'; sp.appendChild(d); return d; });
    fillSlot(slots[1], cur); fillSlot(slots[0], neighborAnchor(cur, 1)); fillSlot(slots[2], neighborAnchor(cur, -1));
    setTrack(0, false); sizeStages(); updateHeader();
  }
  function updateHeader() {
    const heads = visiblePages(cur);
    const ss = []; heads.forEach((p) => pageAyat[p].forEach((k) => { const s = +k.split(':')[0]; if (ss.indexOf(s) < 0) ss.push(s); }));
    $('surahTitle').textContent = ss.map((s) => 'سورة ' + surahName(s)).join('، ');
    $('subTitle').textContent = 'الجزء ' + ar(juzOf(heads[0])) + '، صفحة ' + heads.map(ar).join(' و');
    $('navPage').textContent = ar(cur);
    const qs = []; heads.forEach((p) => (quarterByPage[p] || []).forEach((i) => qs.push(quarterLabel(i))));
    $('notice').textContent = qs.length ? 'في هذه الصفحة بدايةُ ' + qs.join('، و') : '';
    $('prevBtn').disabled = heads[0] <= 1; $('nextBtn').disabled = heads[heads.length - 1] >= 604;
  }
  let settling = false;
  function turn(dir, byHand) {
    if (settling) return;
    const target = neighborAnchor(cur, dir); if (!target) { setTrack(0, true); return; }
    settling = true; closeSheet();
    const W = ($('main') && $('main').clientWidth) || window.innerWidth; const sp = $('spread'); let done = false, fb = 0;
    const finish = () => {
      if (done) return; done = true; sp.removeEventListener('transitionend', finish); clearTimeout(fb);
      commitTurn(dir, target); settling = false;
      if (byHand && !chromeAuto) { chromeAuto = true; setImmersive(true); }
    };
    sp.addEventListener('transitionend', finish); fb = setTimeout(finish, 420);
    setTrack(dir * W, true);
  }
  function commitTurn(dir, target) {
    cur = target; notePage(); const sp = $('spread');
    if (dir > 0) { const r = slots[2]; sp.insertBefore(r, slots[0]); slots = [r, slots[0], slots[1]]; fillSlot(r, neighborAnchor(cur, 1)); }
    else { const r = slots[0]; sp.appendChild(r); slots = [slots[1], slots[2], r]; fillSlot(r, neighborAnchor(cur, -1)); }
    setTrack(0, false); sizeStages(); updateHeader(); redrawMarks(); prefetchAround();
  }
  function itemBox(g, it, ln) {
    if (S.mode !== 'vector') return { l: it.l, w: it.w, t: ln.top, h: ln.h };
    const x0 = (it.l / 100 * g.W - g.bx) / g.ax, x1 = ((it.l + it.w) / 100 * g.W - g.bx) / g.ax;
    const y0 = (ln.top / 100 * PRINT_H - Y_B) / Y_A, y1 = ((ln.top + ln.h) / 100 * PRINT_H - Y_B) / Y_A;
    return { l: x0 / SVG_W * 100, w: (x1 - x0) / SVG_W * 100, t: y0 / SVG_H * 100, h: (y1 - y0) / SVG_H * 100 };
  }
  function buildTextLayer(st, g) {
    const tl = st.querySelector('.tl'); tl.textContent = ''; st._g = g;
    const frag = document.createDocumentFragment();
    for (const ln of g.lines) {
      for (const it of ln.items) {
        const b = itemBox(g, it, ln); const sp = document.createElement('span');
        if (it.m) { sp.dataset.a = it.m; sp.textContent = '(' + ar(it.m.split(':')[1]) + ') '; }
        else { const p = it.k.split(':'); const a = p[0] + ':' + p[1]; sp.dataset.a = a; sp.textContent = (wordsOf(a)[+p[2] - 1] || '') + ' '; }
        sp.style.left = b.l + '%'; sp.style.top = b.t + '%'; sp.dataset.w = b.w; sp.dataset.h = b.h;
        frag.appendChild(sp);
      }
    }
    tl.appendChild(frag); fitStage(st);
  }
  function fitStage(st) {
    const W = st.clientWidth, H = st.clientHeight; if (!W || !H) return;
    const spans = st.querySelectorAll('.tl span'); const n = spans.length; const nat = new Array(n);
    for (let i = 0; i < n; i++) { const s = spans[i]; const h = H * parseFloat(s.dataset.h) / 100; s.style.transform = 'none'; s.style.fontSize = (h * 0.62) + 'px'; s.style.lineHeight = h + 'px'; s.style.height = h + 'px'; }
    for (let i = 0; i < n; i++) nat[i] = spans[i].getBoundingClientRect().width || 1;
    for (let i = 0; i < n; i++) spans[i].style.transform = 'scaleX(' + (W * parseFloat(spans[i].dataset.w) / 100 / nat[i]) + ')';
    drawMarks(st);
  }
  function segmentsFor(st, keys) {
    const g = st._g; if (!g) return [];
    const set = new Set(keys); const out = [];
    for (const ln of g.lines) {
      let lo = Infinity, hi = -Infinity, t = 0, h = 0;
      for (const it of ln.items) {
        const a = it.m || it.k.split(':').slice(0, 2).join(':');
        if (!set.has(a)) continue;
        const b = itemBox(g, it, ln); lo = Math.min(lo, b.l); hi = Math.max(hi, b.l + b.w); t = b.t; h = b.h;
      }
      if (hi > lo) out.push({ l: lo, w: hi - lo, t, h });
    }
    return out;
  }
  function drawMarks(st) {
    const layer = st.querySelector('.layer'); if (!layer) return; layer.textContent = '';
    const p = +st.dataset.p; if (p < 3 || !st._g) return;
    const add = (cls, keys) => { for (const s of segmentsFor(st, keys)) { const d = document.createElement('div'); d.className = cls; d.style.left = (s.l - 0.4) + '%'; d.style.width = (s.w + 0.8) + '%'; d.style.top = s.t + '%'; d.style.height = s.h + '%'; layer.appendChild(d); } };
    if (S.markBm) add('bm', bookmarks().filter((b) => b.t === 'a').map((b) => b.k).filter((k) => pageAyat[p].indexOf(k) >= 0));
    if (rangeKeys) add('rg', rangeKeys.filter((k) => pageAyat[p].indexOf(k) >= 0));
    if (P.on && P.key) add('pl', [P.key]);
    if (selKey) add('hl', [selKey]);
    if (flashKey) add('hl', [flashKey]);
  }
  const redrawMarks = () => document.querySelectorAll('.stage').forEach(drawMarks);
  function ayahAt(st, cx, cy) {
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit.dataset && hit.dataset.a && st.contains(hit)) return hit.dataset.a;
    const g = st._g; if (!g) return null;
    const r = st.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const px = (cx - r.left) / r.width * 100, py = (cy - r.top) / r.height * 100;
    let best = null, bd = Infinity;
    for (const ln of g.lines) for (const it of ln.items) {
      const b = itemBox(g, it, ln);
      const dx = px < b.l ? b.l - px : (px > b.l + b.w ? px - b.l - b.w : 0);
      const dy = py < b.t ? b.t - py : (py > b.t + b.h ? py - b.t - b.h : 0);
      const d = dx * dx + 4 * dy * dy;
      if (d < bd) { bd = d; best = it.m || it.k.split(':').slice(0, 2).join(':'); }
    }
    return bd <= 64 ? best : null;
  }
  function step(dir) { turn(dir, false); }
  function showAyah(key, openMenu) {
    const p = ayahPage[key]; if (!p) return;
    if (visiblePages(cur).indexOf(p) < 0) goPage(p);
    if (openMenu) setTimeout(() => ayahSheet(key), 80);
    else { flashKey = key; clearTimeout(flashTimer); redrawMarks(); flashTimer = setTimeout(() => { flashKey = null; redrawMarks(); }, 2400); }
  }

  // ------------------------------------------------------------------ selection mode (free finger selection, on request only)
  function startSelMode() { document.body.classList.add('selmode'); $('selbar').hidden = false; }
  function endSelMode() { document.body.classList.remove('selmode'); $('selbar').hidden = true; try { const s0 = window.getSelection(); if (s0) s0.removeAllRanges(); } catch (e) {} }

  // ------------------------------------------------------------------ clipboard, share, toast
  function legacyCopy(t) {
    try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select(); try { ta.setSelectionRange(0, t.length); } catch (e) {} const ok = document.execCommand('copy') === true; document.body.removeChild(ta); return ok; } catch (e) { return false; }
  }
  async function writeClip(t) { let ok = false; try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); ok = true; } } catch (e) { ok = false; } return ok || legacyCopy(t); }
  let toastTimer = 0;
  function toast(msg, actLabel, act) {
    $('toastMsg').textContent = msg; const b = $('toastAct');
    if (actLabel) { b.hidden = false; b.textContent = actLabel; b.onclick = () => { $('toast').classList.remove('on'); act(); }; } else { b.hidden = true; b.onclick = null; }
    $('toast').classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('on'), actLabel ? 5000 : 1900);
  }
  function citeRange(keys) {
    if (keys.length === 1) { const [s, a] = keys[0].split(':'); return '﴿' + ayahText(keys[0]) + '﴾ [' + surahName(+s) + ': ' + ar(a) + ']'; }
    const body = keys.map((k) => ayahText(k) + ' (' + ar(k.split(':')[1]) + ')').join(' ');
    const [s1, a1] = keys[0].split(':'), [s2, a2] = keys[keys.length - 1].split(':');
    const ref = s1 === s2 ? surahName(+s1) + ': ' + ar(a1) + '-' + ar(a2) : surahName(+s1) + ': ' + ar(a1) + ' - ' + surahName(+s2) + ': ' + ar(a2);
    return '﴿' + body + '﴾ [' + ref + ']';
  }
  const linkFor = (key) => location.href.split('#')[0] + '#a=' + key;
  async function copyKeys(keys) { toast((await writeClip(citeRange(keys))) ? (keys.length > 1 ? 'نُسخت الآيات' : 'نُسخت الآية') : 'تعذّر النسخ على هذا الجهاز'); }
  async function shareKeys(keys) {
    const text = citeRange(keys) + '\n' + linkFor(keys[0]);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    toast((await writeClip(text)) ? 'المشاركة غير متاحة هنا، فنُسخ النصّ مع الرابط' : 'تعذّرت المشاركة');
  }

  // ------------------------------------------------------------------ sheets
  let sheetCleanup = null;
  function openSheet(html, onClick, cleanup) {
    if (sheetCleanup) { const c = sheetCleanup; sheetCleanup = null; c(); }
    $('sheetBody').innerHTML = html; $('sheetBody').onclick = onClick || null; sheetCleanup = cleanup || null;
    $('scrim').classList.add('on'); $('sheet').classList.add('on'); $('sheet').scrollTop = 0;
  }
  function closeSheet() {
    $('scrim').classList.remove('on'); $('sheet').classList.remove('on');
    if (sheetCleanup) { const c = sheetCleanup; sheetCleanup = null; c(); }
    if (selKey) { selKey = null; redrawMarks(); }
  }
  const tabsHtml = (id, list, active) => '<div class="tabs" role="tablist" id="' + id + '">' + list.map(([k, n]) => '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (k === active) + '">' + n + '</button>').join('') + '</div><div id="' + id + 'Body"></div>';

  // ---- ayah menu
  function ayahSheet(key, tab) {
    selKey = key; redrawMarks();
    const bmOn = !!findBookmark('a', key), favOn = isFav('a', key);
    const html = '<h2>' + esc(refText(key)) + '</h2><p class="ayah">' + esc(ayahText(key)) + '</p>' +
      '<div class="chips">' +
        '<button type="button" class="primary" data-act="play">تشغيل من هنا</button>' +
        '<button type="button" data-act="copy">نسخ</button><button type="button" data-act="share">مشاركة</button>' +
        '<button type="button" data-act="bm" aria-pressed="' + bmOn + '">' + (bmOn ? 'إزالة العلامة' : 'علامة') + '</button>' +
        '<button type="button" data-act="fav" aria-pressed="' + favOn + '">' + (favOn ? 'في المفضّلة' : 'مفضّلة') + '</button>' +
        '<button type="button" data-act="range">تحديد نطاق</button>' +
        '<button type="button" data-act="selmode">تحديد النصّ</button>' +
      '</div>' + tabsHtml('at', [['tafsir', 'التفسير'], ['trans', 'الترجمة'], ['waqfat', 'وقفات'], ['note', 'ملاحظتي']], tab || 'tafsir');
    openSheet(html, (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { selectTab('at', b.dataset.tab); renderAyahTab(key, b.dataset.tab); return; }
      const act = b.dataset.act;
      if (act === 'play') { closeSheet(); playFrom(key); }
      else if (act === 'copy') copyKeys([key]);
      else if (act === 'share') shareKeys([key]);
      else if (act === 'bm') { const on = toggleBookmark('a', key); b.setAttribute('aria-pressed', on); b.textContent = on ? 'إزالة العلامة' : 'علامة'; toast(on ? 'حُفظت العلامة' : 'أُزيلت العلامة'); redrawMarks(); }
      else if (act === 'fav') { const on = toggleFav({ t: 'a', k: key }); b.setAttribute('aria-pressed', on); b.textContent = on ? 'في المفضّلة' : 'مفضّلة'; toast(on ? 'أُضيفت إلى المفضّلة' : 'أُزيلت من المفضّلة'); }
      else if (act === 'range') { rangeStart = key; closeSheet(); toast('اضغطْ الآن على آخرِ آيةٍ في النطاق'); }
      else if (act === 'selmode') { closeSheet(); startSelMode(); }
      else handleTabAction(key, b);
    });
    renderAyahTab(key, tab || 'tafsir');
  }
  function selectTab(id, tab) { document.querySelectorAll('#' + id + ' [data-tab]').forEach((x) => x.setAttribute('aria-selected', x.dataset.tab === tab)); }
  function renderAyahTab(key, tab) {
    const body = $('atBody'); if (!body) return;
    if (tab === 'tafsir') {
      const chosen = (META.tafsirs || []).filter((t) => t.kind !== 'waqfat' && S.tafsirs.indexOf(t.id) >= 0);
      body.innerHTML = '<div class="row sp"><button type="button" class="chip" data-act="pickTafsir">اختيار المفسّرين</button><span class="row"><button type="button" class="chip" data-act="fs-">أصغر</button><button type="button" class="chip" data-act="fs+">أكبر</button></span></div>' +
        '<div class="tafsir" id="tafsirBox">' + (chosen.length ? chosen.map((t) => '<div class="src">' + esc(t.name) + '</div><div id="tf_' + t.id + '"><p class="note">يُحمَّل…</p></div>').join('') : '<p class="empty">لم تخترْ مفسّرًا بعد.</p>') + '</div>';
      chosen.forEach((t) => fillText('tf_' + t.id, TAFSIR_BASES, t.id, key, true));
    } else if (tab === 'trans') {
      const list = META.translations || [];
      body.innerHTML = '<div class="field"><label for="trSel">اللغة</label><select id="trSel"><option value="">اختر ترجمة</option>' + list.map((t) => '<option value="' + t.id + '"' + (t.id === S.trans ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></div><div class="trans" id="trBox"></div>';
      const sel = $('trSel'); sel.onchange = () => { S.trans = sel.value; saveSettings(); showTrans(key); };
      showTrans(key);
    } else if (tab === 'waqfat') {
      const src = (META.tafsirs || []).find((t) => t.kind === 'waqfat');
      const mine = reflections().filter((r) => r.k === key);
      body.innerHTML = (src ? '<div class="tafsir"><div class="src">' + esc(src.name) + '</div><div id="tf_w"><p class="note">يُحمَّل…</p></div><div class="row"><button type="button" class="chip" data-act="favW" aria-pressed="' + isFav('w', key) + '">' + (isFav('w', key) ? 'وقفاتُ الآيةِ في المفضّلة' : 'حفظُ هذه الوقفاتِ في المفضّلة') + '</button></div></div>' : '') +
        '<h3>وقفاتي على هذه الآية</h3>' + (mine.length ? '<ul class="list">' + mine.map((r) => '<li><div class="ref"><span>' + esc(r.type) + '</span><span>' + new Date(r.at).toLocaleDateString('ar') + '</span></div><div class="plain">' + esc(r.text) + '</div><div class="row"><button type="button" class="chip" data-act="favR" data-id="' + r.id + '" aria-pressed="' + isFav('r', r.id) + '">مفضّلة</button><button type="button" class="chip" data-act="delR" data-id="' + r.id + '">حذف</button></div></li>').join('') + '</ul>' : '<p class="empty">لم تكتبْ وقفةً على هذه الآيةِ بعد.</p>') +
        '<div class="field"><label for="rType">نوعُ الوقفة</label><select id="rType"><option>تدبّر</option><option>تساؤل</option><option>وقفة</option><option>فائدة</option></select></div>' +
        '<textarea id="rText" placeholder="اكتبْ وقفتَك. تُحفَظ على هذا الجهاز."></textarea><div class="row" style="margin-top:8px"><button type="button" class="chip" data-act="addR">حفظ الوقفة</button></div>';
      if (src) fillText('tf_w', TAFSIR_BASES, src.id, key, true);
    } else if (tab === 'note') {
      const n = store.get('notes', {})[key] || '';
      body.innerHTML = '<textarea id="noteBox" placeholder="ملاحظتك على هذه الآية. تُحفَظ على هذا الجهاز.">' + esc(n) + '</textarea><div class="row" style="margin-top:8px"><button type="button" class="chip" data-act="saveNote">حفظ</button><button type="button" class="chip" data-act="delNote">حذف</button></div>';
    }
  }
  function handleTabAction(key, b) {
    const act = b.dataset.act;
    if (act === 'pickTafsir') tafsirPicker(() => ayahSheet(key, 'tafsir'));
    else if (act === 'fs-' || act === 'fs+') { S.tfs = Math.max(14, Math.min(30, S.tfs + (act === 'fs+' ? 2 : -2))); saveSettings(); }
    else if (act === 'saveNote') { const v = $('noteBox').value.trim(); const n = store.get('notes', {}); if (v) n[key] = v; else delete n[key]; toast(store.set('notes', n) ? (v ? 'حُفظت الملاحظة' : 'حُذفت الملاحظة') : 'تعذّر الحفظ'); }
    else if (act === 'delNote') { const n = store.get('notes', {}); delete n[key]; store.set('notes', n); $('noteBox').value = ''; toast('حُذفت الملاحظة'); }
    else if (act === 'addR') { const t = $('rText').value.trim(); if (!t) return; const list = reflections(); list.unshift({ id: uid(), k: key, type: $('rType').value, text: t, at: Date.now() }); store.set('refl', list); toast('حُفظت الوقفة'); renderAyahTab(key, 'waqfat'); }
    else if (act === 'delR') { const id = b.dataset.id; const list = reflections(); const i = list.findIndex((r) => r.id === id); if (i < 0) return; const [gone] = list.splice(i, 1); store.set('refl', list); renderAyahTab(key, 'waqfat'); toast('حُذفت الوقفة', 'تراجع', () => { const l2 = reflections(); l2.splice(i, 0, gone); store.set('refl', l2); renderAyahTab(key, 'waqfat'); }); }
    else if (act === 'favR') { const on = toggleFav({ t: 'r', k: b.dataset.id }); b.setAttribute('aria-pressed', on); }
    else if (act === 'favW') { const on = toggleFav({ t: 'w', k: key }); b.setAttribute('aria-pressed', on); b.textContent = on ? 'وقفاتُ الآيةِ في المفضّلة' : 'حفظُ هذه الوقفاتِ في المفضّلة'; }
  }

  // ---- remote texts: tafsir and translation, with the grouped-ayah walk-back
  const textCache = new Map();
  async function getJson(bases, path) {
    const ck = bases[0] + path; if (textCache.has(ck)) return textCache.get(ck);
    // every host failed (offline, or down): read the ayah from the whole file the downloads sheet stored, if any
    const pr = (async () => { for (const b of bases) { try { const r = await fetch(b + path); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {} } return fromStoredWhole(bases, path); })();
    textCache.set(ck, pr); const v = await pr; if (v === undefined) textCache.delete(ck); return v;
  }
  async function fillText(boxId, bases, slug, key, walkBack) {
    const [s, a] = key.split(':').map(Number);
    let from = a, d = await getJson(bases, slug + '/' + s + '/' + a + '.json');
    if (d === undefined) { const el = $(boxId); if (el) el.innerHTML = '<p class="note">تعذّر الاتصال بمصدر النصّ. حاولْ لاحقًا.</p>'; return; }
    if (walkBack && (!d || !String(d.text || '').trim())) {
      for (let b = a - 1; b >= Math.max(1, a - 15); b--) { const x = await getJson(bases, slug + '/' + s + '/' + b + '.json'); if (x && String(x.text || '').trim()) { d = x; from = b; break; } }
    }
    const el = $(boxId); if (!el) return;
    if (!d || !String(d.text || '').trim()) { el.innerHTML = '<p class="note">لا يوجد في هذا المصدر نصٌّ لهذه الآية.</p>'; return; }
    el.innerHTML = (from !== a ? '<p class="note">هذا الشرحُ يبدأ من الآية ' + ar(from) + ' ويشمل هذه الآية.</p>' : '') + '<p></p>';
    el.lastChild.textContent = String(d.text).replace(/\n{3,}/g, '\n\n');
  }
  function showTrans(key) {
    const box = $('trBox'); if (!box) return;
    if (!S.trans) { box.innerHTML = '<p class="empty">اخترْ لغةً لتظهرَ الترجمة.</p>'; return; }
    const t = (META.translations || []).find((x) => x.id === S.trans); box.dir = t && t.dir === 'rtl' ? 'rtl' : 'ltr';
    box.innerHTML = '<div id="tr_x"><p class="note">يُحمَّل…</p></div>';
    fillText('tr_x', TRANS_BASES, S.trans, key, false);
  }
  function tafsirPicker(done) {
    const list = (META.tafsirs || []).filter((t) => t.kind !== 'waqfat');
    openSheet('<h2>اختيار المفسّرين</h2><p class="muted">تظهرُ التفاسيرُ المختارةُ تحتَ كلِّ آيةٍ بهذا الترتيب.</p><div class="checks">' +
      list.map((t) => '<label><input type="checkbox" value="' + t.id + '"' + (S.tafsirs.indexOf(t.id) >= 0 ? ' checked' : '') + '>' + esc(t.name) + '</label>').join('') +
      '</div><div class="row" style="margin-top:12px"><button type="button" class="chip" data-act="done">تم</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b || b.dataset.act !== 'done') return;
      S.tafsirs = Array.from(document.querySelectorAll('.checks input:checked')).map((x) => x.value); saveSettings(); done();
    });
  }

  // ---- range
  function rangeSheet(keys) {
    rangeKeys = keys; redrawMarks();
    openSheet('<h2>' + esc('من ' + shortRef(keys[0]) + ' إلى ' + shortRef(keys[keys.length - 1])) + '</h2><p class="muted">' + ar(keys.length) + ' آية</p>' +
      '<div class="chips"><button type="button" class="primary" data-act="play">تشغيل النطاق</button><button type="button" data-act="copy">نسخ</button><button type="button" data-act="share">مشاركة</button><button type="button" data-act="bm">علامة على أوّله</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'play') { const k = keys.slice(); closeSheet(); playFrom(k[0], k[k.length - 1]); }
      else if (b.dataset.act === 'copy') copyKeys(keys);
      else if (b.dataset.act === 'share') shareKeys(keys);
      else if (b.dataset.act === 'bm') { if (!findBookmark('a', keys[0])) toggleBookmark('a', keys[0]); toast('حُفظت العلامة'); redrawMarks(); }
    }, () => { rangeKeys = null; redrawMarks(); });
  }
  function pageListSheet(p) {
    openSheet('<h2>آياتُ الصفحة ' + ar(p) + '</h2><ul class="list">' + pageAyat[p].map((k) => '<li><div class="ref"><span>' + esc(refText(k)) + '</span></div><div class="txt">' + esc(ayahText(k)) + '</div><div class="row"><button type="button" class="chip" data-open="' + k + '">القائمة</button><button type="button" class="chip" data-play="' + k + '">تشغيل</button><button type="button" class="chip" data-copy="' + k + '">نسخ</button></div></li>').join('') + '</ul>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.open) ayahSheet(b.dataset.open); else if (b.dataset.play) { closeSheet(); playFrom(b.dataset.play); } else if (b.dataset.copy) copyKeys([b.dataset.copy]);
    });
  }

  // ------------------------------------------------------------------ saved: bookmarks, tags, favourites, notes, reflections
  const bookmarks = () => store.get('bm', []);
  const tags = () => store.get('tags', []);
  const reflections = () => store.get('refl', []);
  const findBookmark = (t, k) => bookmarks().find((b) => b.t === t && String(b.k) === String(k));
  function toggleBookmark(t, k) {
    const list = bookmarks(); const i = list.findIndex((b) => b.t === t && String(b.k) === String(k));
    if (i >= 0) { list.splice(i, 1); store.set('bm', list); return false; }
    list.unshift({ id: uid(), t, k, tags: [], at: Date.now() }); store.set('bm', list);
    const pg = t === 'p' ? +k : ayahPage[k]; if (pg) toEzik({ type: 'mushaf-lab:bookmark', page: pg, s: surahOfPage(pg) });
    return true;
  }
  const favs = () => store.get('fav', []);
  const isFav = (t, k) => favs().some((f) => f.t === t && String(f.k) === String(k));
  function toggleFav(item) { const l = favs(); const i = l.findIndex((f) => f.t === item.t && String(f.k) === String(item.k)); if (i >= 0) { l.splice(i, 1); store.set('fav', l); return false; } item.at = Date.now(); l.unshift(item); store.set('fav', l); return true; }
  const bmPos = (b) => (b.t === 'p' ? [b.k, 0, 0] : [ayahPage[b.k], +b.k.split(':')[0], +b.k.split(':')[1]]);
  const bmTitle = (b) => (b.t === 'p' ? 'صفحة ' + ar(b.k) : refText(b.k) + '، صفحة ' + ar(ayahPage[b.k]));

  function savedSheet(tab) {
    openSheet('<h2>المحفوظات</h2>' + tabsHtml('sv', [['bm', 'العلامات'], ['fav', 'المفضّلة'], ['notes', 'الملاحظات'], ['refl', 'وقفاتي'], ['recent', 'الأخيرة'], ['backup', 'النسخ الاحتياطي']], tab || 'bm'), (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { selectTab('sv', b.dataset.tab); renderSaved(b.dataset.tab); return; }
      savedAction(b);
    });
    renderSaved(tab || 'bm');
  }
  let bmSort = 'date', bmGroup = false, bmFilter = '';
  function renderSaved(tab) {
    const body = $('svBody'); if (!body) return; body.dataset.tab = tab;
    if (tab === 'bm') {
      let list = bookmarks(); const tg = tags();
      if (bmFilter) list = list.filter((b) => b.tags.indexOf(bmFilter) >= 0);
      list.sort(bmSort === 'date' ? (x, y) => y.at - x.at : (x, y) => { const a = bmPos(x), c = bmPos(y); return a[0] - c[0] || a[1] - c[1] || a[2] - c[2]; });
      const row = (b) => '<li><button type="button" class="link" data-go="' + b.id + '"><div class="ref"><span>' + esc(bmTitle(b)) + '</span><span>' + new Date(b.at).toLocaleDateString('ar') + '</span></div></button><div>' + b.tags.map((id) => { const t = tg.find((x) => x.id === id); return t ? '<span class="tag">' + esc(t.n) + '</span>' : ''; }).join('') + '</div><div class="row"><button type="button" class="chip" data-bmtags="' + b.id + '">الوسوم</button><button type="button" class="chip" data-bmdel="' + b.id + '">حذف</button></div></li>';
      let items = '';
      if (bmGroup) {
        const groups = [[null, 'بلا وسم']].concat(tg.map((t) => [t.id, t.n]));
        items = groups.map(([id, n]) => { const g = list.filter((b) => (id ? b.tags.indexOf(id) >= 0 : !b.tags.length)); return g.length ? '<h3>' + esc(n) + '</h3><ul class="list">' + g.map(row).join('') + '</ul>' : ''; }).join('');
      } else items = list.length ? '<ul class="list">' + list.map(row).join('') + '</ul>' : '';
      body.innerHTML = '<div class="row"><button type="button" class="chip" data-act="bmPage">' + (findBookmark('p', cur) ? 'إزالة علامة الصفحة ' : 'علامة على الصفحة ') + ar(cur) + '</button></div>' +
        '<div class="row" style="margin-top:8px"><button type="button" class="chip" data-act="sort" aria-pressed="' + (bmSort === 'pos') + '">' + (bmSort === 'date' ? 'الترتيب: الأحدث' : 'الترتيب: حسب المصحف') + '</button><button type="button" class="chip" data-act="group" aria-pressed="' + bmGroup + '">التجميع بالوسوم</button><button type="button" class="chip" data-act="tagsMng">إدارة الوسوم</button></div>' +
        (tg.length ? '<div class="chips" style="margin-top:8px"><button type="button" data-filter="" aria-pressed="' + !bmFilter + '">الكل</button>' + tg.map((t) => '<button type="button" data-filter="' + t.id + '" aria-pressed="' + (bmFilter === t.id) + '">' + esc(t.n) + '</button>').join('') + '</div>' : '') +
        (items || '<p class="empty">لا علامات بعد. اضغطْ على آيةٍ ثمّ «علامة»، أو ضعْ علامةً على هذه الصفحة.</p>');
    } else if (tab === 'fav') {
      const l = favs();
      body.innerHTML = l.length ? '<ul class="list">' + l.map((f, i) => {
        if (f.t === 'a') return '<li><button type="button" class="link" data-goa="' + f.k + '"><div class="ref"><span>' + esc(refText(f.k)) + '</span></div><div class="txt">' + esc(ayahText(f.k)) + '</div></button><div class="row"><button type="button" class="chip" data-unfav="' + i + '">إزالة</button></div></li>';
        if (f.t === 'w') return '<li><button type="button" class="link" data-gow="' + f.k + '"><div class="ref"><span>وقفاتُ «تدبّر وعمل» على ' + esc(shortRef(f.k)) + '</span></div></button><div class="row"><button type="button" class="chip" data-unfav="' + i + '">إزالة</button></div></li>';
        const r = reflections().find((x) => x.id === f.k); if (!r) return '';
        return '<li><button type="button" class="link" data-gor="' + r.k + '"><div class="ref"><span>' + esc(r.type + ' على ' + shortRef(r.k)) + '</span></div><div class="plain">' + esc(r.text) + '</div></button><div class="row"><button type="button" class="chip" data-unfav="' + i + '">إزالة</button></div></li>';
      }).join('') + '</ul>' : '<p class="empty">لا شيءَ في المفضّلة بعد.</p>';
    } else if (tab === 'notes') {
      const n = store.get('notes', {}); const ks = Object.keys(n).sort(cmpKey);
      body.innerHTML = ks.length ? '<ul class="list">' + ks.map((k) => '<li><button type="button" class="link" data-goa="' + k + '"><div class="ref"><span>' + esc(refText(k)) + '</span></div><div class="plain">' + esc(n[k]) + '</div></button></li>').join('') + '</ul>' : '<p class="empty">لا ملاحظات بعد.</p>';
    } else if (tab === 'refl') {
      body.innerHTML = '<div class="field"><input type="search" id="rq" placeholder="ابحثْ في وقفاتك"></div><div id="rlist"></div>';
      const draw = () => { const q = normalize($('rq').value.trim()); const l = reflections().filter((r) => !q || normalize(r.text).indexOf(q) >= 0 || normalize(r.type).indexOf(q) >= 0);
        $('rlist').innerHTML = l.length ? '<ul class="list">' + l.map((r) => '<li><button type="button" class="link" data-gor="' + r.k + '"><div class="ref"><span>' + esc(r.type + ' على ' + shortRef(r.k)) + '</span><span>' + new Date(r.at).toLocaleDateString('ar') + '</span></div><div class="plain">' + esc(r.text) + '</div></button></li>').join('') + '</ul>' : '<p class="empty">لا وقفات.</p>'; };
      $('rq').oninput = draw; draw();
    } else if (tab === 'recent') {
      const r = store.get('recent', []);
      body.innerHTML = r.length ? '<div class="chips">' + r.map((p) => '<button type="button" data-page="' + p + '">صفحة ' + ar(p) + '</button>').join('') + '</div>' : '<p class="empty">لم تفتحْ صفحاتٍ بعد.</p>';
    } else if (tab === 'backup') {
      body.innerHTML = '<p class="muted">كلُّ المحفوظاتِ على هذا الجهازِ فقط. احفظْ نسخةً لتنقلَها إلى جهازٍ آخر.</p><div class="chips"><button type="button" data-act="export">حفظ نسخة احتياطية</button><button type="button" data-act="import">استعادة من نسخة</button><button type="button" data-act="csv">تصدير العلامات جدولًا</button></div><input type="file" id="impFile" accept="application/json,.json" hidden>';
      $('impFile').onchange = importBackup;
    }
  }
  function savedAction(b) {
    const d = b.dataset;
    if (d.go) { const bm = bookmarks().find((x) => x.id === d.go); if (!bm) return; closeSheet(); if (bm.t === 'p') goPage(bm.k); else showAyah(bm.k, false); return; }
    if (d.goa) { closeSheet(); showAyah(d.goa, true); return; }
    if (d.gow) { closeSheet(); showAyah(d.gow, false); setTimeout(() => ayahSheet(d.gow, 'waqfat'), 120); return; }
    if (d.gor) { closeSheet(); showAyah(d.gor, false); setTimeout(() => ayahSheet(d.gor, 'waqfat'), 120); return; }
    if (d.page) { closeSheet(); goPage(+d.page); return; }
    if (d.unfav !== undefined) { const l = favs(); l.splice(+d.unfav, 1); store.set('fav', l); renderSaved('fav'); return; }
    if (d.filter !== undefined) { bmFilter = d.filter; renderSaved('bm'); return; }
    if (d.bmdel) {
      const l = bookmarks(); const i = l.findIndex((x) => x.id === d.bmdel); if (i < 0) return; const [gone] = l.splice(i, 1); store.set('bm', l); renderSaved('bm'); redrawMarks();
      toast('حُذفت العلامة', 'تراجع', () => { const l2 = bookmarks(); l2.splice(i, 0, gone); store.set('bm', l2); if ($('svBody') && $('svBody').dataset.tab === 'bm') renderSaved('bm'); redrawMarks(); });
      return;
    }
    if (d.bmtags) { tagEditor(d.bmtags); return; }
    const act = d.act;
    if (act === 'bmPage') { const on = toggleBookmark('p', cur); toast(on ? 'حُفظت علامة الصفحة' : 'أُزيلت علامة الصفحة'); renderSaved('bm'); }
    else if (act === 'sort') { bmSort = bmSort === 'date' ? 'pos' : 'date'; renderSaved('bm'); }
    else if (act === 'group') { bmGroup = !bmGroup; renderSaved('bm'); }
    else if (act === 'tagsMng') tagManager();
    else if (act === 'export') exportBackup();
    else if (act === 'import') $('impFile').click();
    else if (act === 'csv') exportCsv();
  }
  function tagEditor(bmId) {
    const bm = bookmarks().find((x) => x.id === bmId); if (!bm) return;
    openSheet('<h2>وسوم: ' + esc(bmTitle(bm)) + '</h2><div class="checks">' + tags().map((t) => '<label><input type="checkbox" value="' + t.id + '"' + (bm.tags.indexOf(t.id) >= 0 ? ' checked' : '') + '>' + esc(t.n) + '</label>').join('') + '</div>' +
      '<div class="field"><label for="newTag">وسمٌ جديد</label><input type="text" id="newTag" placeholder="مثلًا: للحفظ"></div><div class="row"><button type="button" class="chip" data-act="save">حفظ</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b || b.dataset.act !== 'save') return;
      const tg = tags(); const name = $('newTag').value.trim(); const chosen = Array.from(document.querySelectorAll('.checks input:checked')).map((x) => x.value);
      if (name) { let t = tg.find((x) => x.n === name); if (!t) { t = { id: uid(), n: name }; tg.push(t); store.set('tags', tg); } chosen.push(t.id); }
      const l = bookmarks(); const x = l.find((y) => y.id === bmId); if (x) { x.tags = Array.from(new Set(chosen)); store.set('bm', l); }
      savedSheet('bm');
    });
  }
  function tagManager() {
    const tg = tags();
    openSheet('<h2>إدارة الوسوم</h2>' + (tg.length ? '<ul class="list">' + tg.map((t) => '<li><div class="row sp"><input type="text" value="' + esc(t.n) + '" data-tid="' + t.id + '" style="flex:1;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--raise);padding:0 10px"><button type="button" class="chip" data-del="' + t.id + '">حذف</button></div></li>').join('') + '</ul>' : '<p class="empty">لا وسوم بعد.</p>') +
      '<div class="field"><label for="addTag">وسمٌ جديد</label><input type="text" id="addTag"></div><div class="row"><button type="button" class="chip" data-act="save">حفظ</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.del) { const id = b.dataset.del; store.set('tags', tags().filter((t) => t.id !== id)); const l = bookmarks(); l.forEach((x) => { x.tags = x.tags.filter((y) => y !== id); }); store.set('bm', l); tagManager(); return; }
      if (b.dataset.act === 'save') { const l = tags(); document.querySelectorAll('[data-tid]').forEach((inp) => { const t = l.find((x) => x.id === inp.dataset.tid); if (t && inp.value.trim()) t.n = inp.value.trim(); }); const nn = $('addTag').value.trim(); if (nn && !l.some((x) => x.n === nn)) l.push({ id: uid(), n: nn }); store.set('tags', l); savedSheet('bm'); }
    });
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function exportBackup() {
    const data = { app: 'ezik-mushaf-lab', v: 1, at: new Date().toISOString(), bm: bookmarks(), tags: tags(), fav: favs(), notes: store.get('notes', {}), refl: reflections(), recent: store.get('recent', []), last: cur, settings: S };
    download('mushaf-lab-backup.json', JSON.stringify(data, null, 1), 'application/json'); toast('حُفظت النسخة الاحتياطية');
  }
  function importBackup(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result); if (!d || d.app !== 'ezik-mushaf-lab') throw new Error('bad');
        if (!confirm('ستحلُّ النسخةُ محلَّ المحفوظاتِ الحاليّةِ على هذا الجهاز. هل تتابع؟')) return;
        store.set('bm', d.bm || []); store.set('tags', d.tags || []); store.set('fav', d.fav || []); store.set('notes', d.notes || {}); store.set('refl', d.refl || []); store.set('recent', d.recent || []);
        if (d.settings) { S = Object.assign(S, d.settings); saveSettings(); }
        toast('استُعيدت النسخة'); redrawMarks(); savedSheet('bm');
      } catch (err) { toast('الملفُّ ليس نسخةً احتياطيّةً من هذه الصفحة'); }
    };
    rd.readAsText(f);
  }
  function exportCsv() {
    const tg = tags(); const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['النوع', 'السورة', 'الآية', 'الصفحة', 'الوسوم', 'التاريخ']].concat(bookmarks().map((b) => {
      const [p, s, a] = bmPos(b); return [b.t === 'p' ? 'صفحة' : 'آية', s ? surahName(s) : '', a || '', p, b.tags.map((id) => (tg.find((t) => t.id === id) || {}).n || '').filter(Boolean).join(' / '), new Date(b.at).toISOString().slice(0, 10)];
    }));
    download('mushaf-lab-bookmarks.csv', '\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv'); toast('صُدِّرت العلامات');
  }

  // ------------------------------------------------------------------ index and go-to
  function indexSheet(tab) {
    openSheet('<h2>الفهرس</h2>' + tabsHtml('ix', [['sura', 'السور'], ['juz', 'الأجزاء والأحزاب']], tab || 'sura'), (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { selectTab('ix', b.dataset.tab); drawIndex(b.dataset.tab); return; }
      if (b.dataset.page) { closeSheet(); goPage(+b.dataset.page); }
      else if (b.dataset.key) { closeSheet(); showAyah(b.dataset.key, false); }
      else if (b.dataset.juz) { const el = $('jz' + b.dataset.juz); if (el) el.hidden = !el.hidden; }
    });
    drawIndex(tab || 'sura');
  }
  function drawIndex(tab) {
    const body = $('ixBody');
    if (tab === 'sura') {
      body.innerHTML = '<ul class="list">' + T.names.map((n, i) => '<li><button type="button" class="link" data-page="' + T.pageForSura[i] + '"><div class="ref"><span><b style="color:var(--ink)">' + ar(i + 1) + '. سورة ' + esc(n) + '</b></span><span>صفحة ' + ar(T.pageForSura[i]) + '</span></div><div class="muted">' + (T.makki[i] ? 'مكّيّة' : 'مدنيّة') + '، ' + ar(T.nAyah[i]) + ' آية</div></button></li>').join('') + '</ul>';
    } else {
      let h = '<ul class="list">';
      for (let j = 0; j < 30; j++) {
        h += '<li><div class="row sp"><button type="button" class="link" style="width:auto" data-page="' + T.pageForJuz[j] + '"><b>الجزء ' + ar(j + 1) + '</b> <span class="muted">صفحة ' + ar(T.pageForJuz[j]) + '</span></button><button type="button" class="chip" data-juz="' + j + '">الأحزاب والأرباع</button></div><div id="jz' + j + '" hidden><ul class="list">';
        for (let i = j * 8; i < j * 8 + 8; i++) { const [s, a] = T.quarters[i]; const k = s + ':' + a; h += '<li><button type="button" class="link" data-key="' + k + '"><div class="ref"><span>' + esc(quarterLabel(i)) + '</span><span>' + esc(shortRef(k)) + '، صفحة ' + ar(ayahPage[k]) + '</span></div></button></li>'; }
        h += '</ul></div></li>';
      }
      body.innerHTML = h + '</ul>';
    }
  }
  function goSheet() {
    openSheet('<h2>الانتقال</h2><div class="grid2"><div class="field"><label for="goP">رقم الصفحة</label><input type="number" id="goP" min="1" max="604" inputmode="numeric" value="' + cur + '"></div><div class="field"><label>&nbsp;</label><button type="button" class="chip" data-act="goP">اذهبْ إلى الصفحة</button></div></div>' +
      '<div class="grid2"><div class="field"><label for="goS">السورة</label><select id="goS">' + T.names.map((n, i) => '<option value="' + (i + 1) + '">' + ar(i + 1) + '. ' + esc(n) + '</option>').join('') + '</select></div><div class="field"><label for="goA">الآية</label><input type="number" id="goA" min="1" value="1" inputmode="numeric"></div></div>' +
      '<div class="row"><button type="button" class="chip" data-act="goA">اذهبْ إلى الآية</button><button type="button" class="chip" data-act="last">آخرُ صفحةٍ قرأتَها</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'goP') { closeSheet(); goPage(+$('goP').value); }
      else if (b.dataset.act === 'goA') { const s = +$('goS').value; const a = Math.max(1, Math.min(T.nAyah[s - 1], +$('goA').value || 1)); closeSheet(); showAyah(s + ':' + a, false); }
      else if (b.dataset.act === 'last') { closeSheet(); goPage(store.get('last', 3)); }
    });
    const pg = pageAyat[cur][0]; if (pg) $('goS').value = pg.split(':')[0];
  }

  // ------------------------------------------------------------------ search (simplified spelling first, then the Uthmani text)
  const DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  function normalize(t) { return String(t || '').replace(DIAC, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim(); }
  let SEARCH = null;
  async function ensureSearch() {
    if (SEARCH) return SEARCH;
    if (!IML) { try { const r = await fetch('data/imlaei.json'); IML = r.ok ? await r.json() : {}; } catch (e) { IML = {}; } }
    const keys = Object.keys(Q).sort(cmpKey);
    SEARCH = keys.map((k) => ({ k, i: normalize(IML[k] || ''), u: normalize(Q[k]), iw: (IML[k] || '').split(' ').map(normalize) }));
    return SEARCH;
  }
  function searchSheet(initial) {
    openSheet('<h2>البحث في القرآن</h2><div class="field"><input type="search" id="sq" placeholder="اكتبْ كلمةً أو أكثر" autocomplete="off"></div><div class="muted" id="sc"></div><div id="sr"></div>', (e) => {
      const b = e.target.closest('button'); if (!b || !b.dataset.goa) return; closeSheet(); showAyah(b.dataset.goa, false);
    });
    const q = $('sq'); let tmr = 0;
    q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(runSearch, 180); };
    if (initial) { q.value = initial; runSearch(); }
    setTimeout(() => q.focus(), 250);
  }
  async function runSearch() {
    const raw = $('sq') ? $('sq').value.trim() : ''; const q = normalize(raw);
    if (q.length < 2) { $('sc').textContent = ''; $('sr').innerHTML = ''; return; }
    const idx = await ensureSearch(); if (!$('sq') || normalize($('sq').value.trim()) !== q) return;
    const toks = q.split(' ');
    const hits = idx.filter((x) => toks.every((t) => x.i.indexOf(t) >= 0 || x.u.indexOf(t) >= 0));
    $('sc').textContent = 'النتائج: ' + ar(hits.length) + (hits.length > 150 ? '، يظهر أوّلُ ١٥٠' : '');
    $('sr').innerHTML = '<ul class="list">' + hits.slice(0, 150).map((x) => {
      const ws = wordsOf(x.k); const html = ws.map((w, i) => { const iw = x.iw[i] || normalize(w); return toks.some((t) => iw.indexOf(t) >= 0 || normalize(w).indexOf(t) >= 0) ? '<mark>' + esc(w) + '</mark>' : esc(w); }).join(' ');
      return '<li><button type="button" class="link" data-goa="' + x.k + '"><div class="ref"><span>' + esc(refText(x.k)) + '</span><span>صفحة ' + ar(ayahPage[x.k]) + '</span></div><div class="txt">' + html + '</div></button></li>';
    }).join('') + '</ul>';
  }

  // ------------------------------------------------------------------ settings sheet
  function settingsSheet() {
    const opt = (v, cur2, label) => '<button type="button" data-set="' + v + '" aria-pressed="' + (v === cur2) + '">' + label + '</button>';
    openSheet('<h2>الإعدادات</h2>' +
      '<h3>المظهر</h3><div class="chips" data-group="theme">' + opt('auto', S.theme, 'تلقائي') + opt('light', S.theme, 'نهاري') + opt('dark', S.theme, 'ليلي') + '</div>' +
      '<div class="field"><label for="nb">سطوعُ الصفحةِ في الوضع الليلي</label><input type="range" id="nb" min="0.6" max="1.1" step="0.02" value="' + S.nightB + '"></div>' +
      '<div class="field"><label for="nc">تباينُ الصفحةِ في الوضع الليلي</label><input type="range" id="nc" min="0.7" max="1.3" step="0.02" value="' + S.nightC + '"></div>' +
      '<h3>لونُ الخلفية</h3><div class="chips" data-group="desk">' + opt('green', S.desk, 'أخضرُ هادئ') + opt('sand', S.desk, 'رمليّ') + opt('stone', S.desk, 'رماديّ') + '</div>' +
      '<h3>نوعُ صفحةِ المصحف</h3><div class="chips" data-group="mode">' + opt('print', S.mode, 'المطبوعة') + opt('vector', S.mode, 'المرسومة') + '</div>' +
      '<h3>العرض</h3><div class="chips"><button type="button" data-act="spread" aria-pressed="' + S.spread + '">صفحتانِ متجاورتانِ في الشاشاتِ العريضة</button><button type="button" data-act="markBm" aria-pressed="' + S.markBm + '">تلوينُ الآياتِ المعلَّمة</button></div>' +
      '<h3>التفسير</h3><div class="row"><button type="button" class="chip" data-act="pickTafsir">اختيار المفسّرين</button></div><div class="field"><label for="tfs">حجمُ خطِّ التفسيرِ والترجمة</label><input type="range" id="tfs" min="14" max="30" step="1" value="' + S.tfs + '"></div>' +
      '<h3>التلاوة</h3><div class="field"><label for="rcSel">القارئ</label><select id="rcSel">' + reciters().map((r) => '<option value="' + r.id + '"' + (r.id === S.reciter ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></div>' +
      '<h3>دونَ اتّصال</h3><p class="muted">نزّلْ صفحاتِ جزءٍ أو المصحفَ كلَّه، أو ترجمةً أو تفسيرًا أو تلاوةَ سورة، فتفتحُها بعدَها دونَ إنترنت.</p><div class="row"><button type="button" class="chip" data-act="downloads">التنزيلات</button></div>' +
      '<div class="row" style="margin-top:14px"><button type="button" class="chip" data-act="hint">إظهارُ الإرشاد</button></div>' +
      '<p class="foot">صفحةُ مختبرٍ خارجَ عزك. صورُ الصفحات: مصحفُ المدينة النبويّة برواية حفص عن عاصم، مجمّعُ الملك فهد لطباعة المصحف الشريف. نصُّ الآياتِ هو النصُّ المعتمَدُ في عزك. التفاسير من مجموعة «tafsir_api» المفتوحة، والترجمات من «quran-api»، والتلاوات من «EveryAyah».' + (META.built ? ' بُنيت البيانات: ' + esc(META.built) + '.' : '') + '</p>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const grp = b.parentElement && b.parentElement.dataset.group;
      if (grp) { S[grp] = b.dataset.set; saveSettings(); b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); if (grp === 'mode') render(); return; }
      const act = b.dataset.act;
      if (act === 'spread') { S.spread = !S.spread; saveSettings(); b.setAttribute('aria-pressed', S.spread); render(); }
      else if (act === 'markBm') { S.markBm = !S.markBm; saveSettings(); b.setAttribute('aria-pressed', S.markBm); redrawMarks(); }
      else if (act === 'pickTafsir') tafsirPicker(settingsSheet);
      else if (act === 'downloads') downloadsSheet();
      else if (act === 'hint') { closeSheet(); $('hint').hidden = false; }
    });
    $('nb').oninput = (e) => { S.nightB = +e.target.value; saveSettings(); };
    $('nc').oninput = (e) => { S.nightC = +e.target.value; saveSettings(); };
    $('tfs').oninput = (e) => { S.tfs = +e.target.value; saveSettings(); };
    $('rcSel').onchange = (e) => { S.reciter = e.target.value; saveSettings(); if (P.on) { playIndex(P.i); } };
  }
  // ------------------------------------------------------------------ downloads (Ezik register item 4: offline)
  // One sheet, five kinds of download, one store. Everything the reader downloads lands in DL_STORE and
  // nothing else writes there. Inside Ezik the service worker reads pages and geometry from it; the
  // texts and the recitation are read from it here (fillText and startTrack). The sheet never keeps a
  // list of its own: what it shows as downloaded is read from the store every time it opens.
  const abs = (u) => new URL(u, location.href).href;
  const TAFSIR_WHOLE = (slug, s) => slug + '/' + s + '.json';          // appended to a TAFSIR_BASES entry
  const TRANS_WHOLE = (id) => id + '.min.json';                        // appended to a TRANS_BASES entry
  // Whole-edition sizes in bytes, uncompressed, measured 2026-09-27. Shown labelled approximate: the
  // text hosts send no Content-Length, so nothing better can be measured before the download.
  const APPROX_BYTES = {
    'ar-tafsir-muyassar': 3151034, 'ar-tafsir-al-mukhtasar': 2258310, 'ar-tafseer-al-saddi': 6276861,
    'ar-tafsir-ibn-kathir': 89802658, 'ar-tafsir-al-tabari': 61392111, 'ar-tafsir-al-baghawi': 38629513,
    'adwa-al-bayan': 17326181, 'tafsir-ibn-al-qayyim': 29786429, 'fath-al-qadir-al-shawkani': 180032340,
    'tafsir-ibn-abi-hatim': 10849975, 'al-muyassar-fi-al-gharib': 1375403, 'tadabbur-wa-amal': 48119576,
    'eng-ummmuhammad': 1073728, 'urd-muhammadjunagar': 1631747, 'ind-kingfahdcomplex': 1347716,
    'ben-abubakrzakaria': 2402906, 'tur-diyanetisleri': 1190382, 'fra-muhammadhamidul': 1122651,
    'msa-abdullahmuhamma': 1663361, 'spa-juliocortes': 978132, 'rus-elmirkuliev': 1628777,
    'deu-frankbubenheima': 1156491, 'hin-suhelfarooqkhan': 2593512
  };
  const MB = (b) => ar((b / 1048576).toFixed(b < 10485760 ? 1 : 0)) + ' ميغابايت';
  let SIZES = null;                 // data/offline-sizes.json, generated from the tree
  async function sizes() {
    if (SIZES) return SIZES;
    try { const r = await fetch('data/offline-sizes.json'); if (r.ok) SIZES = await r.json(); } catch (e) {}
    return SIZES;
  }
  const juzRange = (j) => [T.pageForJuz[j - 1], j < 30 ? T.pageForJuz[j] - 1 : 604];
  const pageItem = (p) => ({ key: abs(IMG(p)), src: [abs(IMG(p))], init: { headers: { [DL_HEADER]: '1' } }, name: 'صفحة ' + ar(p), bytes: (SIZES && SIZES.pages[p - 1]) || 0 });
  const geoItem = (p) => ({ key: abs(geoUrl(p)), src: [abs(geoUrl(p))], init: { headers: { [DL_HEADER]: '1' } }, name: 'آيات الصفحة ' + ar(p), bytes: (SIZES && SIZES.geometry[p - 1]) || 0 });
  function pagesJob(p0, p1, title) {
    const items = [];
    for (let p = p0; p <= p1; p++) { items.push(pageItem(p)); if (p >= 3) items.push(geoItem(p)); }
    return { title, items, exact: true };
  }
  function tafsirJob(slug) {
    const t = (META.tafsirs || []).find((x) => x.id === slug); const items = [];
    for (let s = 1; s <= 114; s++) items.push({ key: TAFSIR_BASES[0] + TAFSIR_WHOLE(slug, s), src: TAFSIR_BASES.map((b) => b + TAFSIR_WHOLE(slug, s)), init: {}, name: 'سورة ' + surahName(s), bytes: (APPROX_BYTES[slug] || 0) / 114 });
    return { title: t ? t.name : slug, items, exact: false };
  }
  function transJob(id) {
    const t = (META.translations || []).find((x) => x.id === id);
    return { title: t ? t.name : id, items: [{ key: TRANS_BASES[0] + TRANS_WHOLE(id), src: TRANS_BASES.map((b) => b + TRANS_WHOLE(id)), init: {}, name: 'ملفّ الترجمة', bytes: APPROX_BYTES[id] || 0 }], exact: false };
  }
  function reciteJob(rec, s) {
    const items = []; const one = (ss, a, name) => { const u = AUDIO(rec, ss, a); items.push({ key: u, src: [u], init: { mode: 'cors' }, name, bytes: 0 }); };
    // the player's basmala is surah 1, ayah 1, played before ayah 1 of every surah but 1 and 9
    if (s !== 1 && s !== 9) one(1, 1, 'البسملة');
    for (let a = 1; a <= T.nAyah[s - 1]; a++) one(s, a, shortRef(s + ':' + a));
    return { title: 'تلاوة سورة ' + surahName(s) + ' بصوت ' + reciterName(rec), items, exact: false, head: true };
  }

  let persistAsked = false;        // navigator.storage.persist(), asked once, before the first download
  async function askPersist() {
    if (persistAsked) return; persistAsked = true;
    try { if (navigator.storage && navigator.storage.persist && !(navigator.storage.persisted && await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {}
  }
  async function freeSpace() {
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (typeof e.quota === 'number' && typeof e.usage === 'number') return e.quota - e.usage; } } catch (e) {}
    return null;
  }
  // HEAD each file still missing, a few at a time; the recitation host sends Content-Length and allows CORS.
  async function headSizes(items) {
    const q = items.slice(); let known = 0;
    await Promise.all([0, 1, 2, 3, 4, 5].map(async () => {
      while (q.length) { const it = q.shift(); try { const r = await fetch(it.src[0], { method: 'HEAD', mode: 'cors' }); const n = +r.headers.get('content-length'); if (r.ok && n > 0) { it.bytes = n; known++; } } catch (e) {} }
    }));
    const unknown = items.length - known;
    if (unknown && known) { const avg = items.reduce((t, x) => t + x.bytes, 0) / known; items.forEach((x) => { if (!x.bytes) x.bytes = avg; }); }
    return { known, unknown };
  }

  let DL = null;                   // the one running download: { job, done, fail: [], skipped, cancelled, ctl }
  let dlPending = null;            // a sized job waiting for "start"
  async function dlPrepare(kind) {
    const panel = $('dlPanel'); if (!panel) return;
    if (DL) { dlPaint(); return; }
    panel.innerHTML = '<p class="muted">يُحسَبُ الحجم…</p>';
    await sizes();
    let job;
    if (kind === 'juz') { const j = juzOf(cur); const [a, b] = juzRange(j); job = pagesJob(a, b, 'الجزء ' + ar(j)); }
    else if (kind === 'all') job = pagesJob(1, 604, 'المصحف كاملًا');
    else if (kind === 'trans') { const id = $('dlTr') && $('dlTr').value; if (!id) { panel.innerHTML = '<p class="empty">اخترْ ترجمةً أوّلًا.</p>'; return; } job = transJob(id); }
    else if (kind === 'tafsir') { const id = $('dlTf') && $('dlTf').value; if (!id) { panel.innerHTML = '<p class="empty">اخترْ تفسيرًا أوّلًا.</p>'; return; } job = tafsirJob(id); }
    else if (kind === 'recite') job = reciteJob(($('dlRc') && $('dlRc').value) || S.reciter, surahOfPage(cur));
    if (!job) return;
    if (job.exact && !SIZES) { panel.innerHTML = '<p class="note">تعذّرت قراءةُ جدولِ الأحجام. تحقّقْ من الاتصال ثمّ أعِدِ المحاولة.</p>'; return; }
    let c; try { c = await caches.open(DL_STORE); } catch (e) { panel.innerHTML = '<p class="note">هذا المتصفّحُ لا يسمحُ بالتخزينِ للاستخدامِ دونَ اتّصال.</p>'; return; }
    const missing = [];
    let have; try { have = new Set((await c.keys()).map((r) => r.url)); } catch (e) { have = new Set(); }   // one read, not one per file
    for (const it of job.items) { if (!have.has(it.key)) missing.push(it); }
    let approx = !job.exact, headNote = '';
    if (job.head && missing.length) {
      const h = await headSizes(missing);
      if (!h.known) { panel.innerHTML = '<h3>' + esc(job.title) + '</h3><p class="note">تعذّر قياسُ الحجم، فلم يبدأ التنزيل. تحقّقْ من الاتصال ثمّ أعِدِ المحاولة.</p>'; return; }
      if (h.unknown) headNote = ' (قِيسَ ' + ar(h.known) + ' من ' + ar(missing.length) + ' ملفًّا، والباقي مُقدَّر)'; approx = !!h.unknown;
    }
    const total = job.head ? null : job.items.reduce((t, x) => t + x.bytes, 0);
    const need = missing.reduce((t, x) => t + x.bytes, 0);
    const free = await freeSpace();
    const tilde = approx ? 'نحوُ ' : '';
    let h = '<h3>' + esc(job.title) + '</h3>' +
      (total !== null ? '<p>الحجمُ الكامل: ' + tilde + MB(total) + (approx ? ' (تقريبًا)' : '') + '</p>' : '') +
      '<p>المتبقّي للتنزيل: ' + ar(missing.length) + ' من ' + ar(job.items.length) + ' ملفًّا، ' + tilde + MB(need) + (approx ? ' (تقريبًا)' : '') + esc(headNote) + '</p>' +
      '<p>المساحةُ المتاحة على الجهاز: ' + (free === null ? 'لا يُعرَف على هذا المتصفّح' : MB(free)) + '</p>';
    if (!missing.length) { panel.innerHTML = h + '<p class="empty">هذا كلُّه منزَّلٌ على الجهاز.</p>'; return; }
    if (!(need > 0)) { panel.innerHTML = h + '<p class="note">لا يُعرَفُ حجمُ هذا المصدر، فلا يبدأ تنزيلُه.</p>'; return; }
    if (free !== null && free < need * 1.5) {
      panel.innerHTML = h + '<p class="note">لا تكفي المساحة: يلزمُ مثلُ الحجمِ ونصفُه، ' + MB(need * 1.5) + '، والمتاحُ ' + MB(free) + '. لم يبدأ التنزيل.</p>';
      return;
    }
    dlPending = { job, missing, need };
    panel.innerHTML = h + '<div class="row"><button type="button" class="chip" data-dlgo="1">ابدأ التنزيل</button><button type="button" class="chip" data-dlno="1">إلغاء</button></div>';
  }
  async function dlStart() {
    if (DL || !dlPending) return;
    const { job, missing } = dlPending; dlPending = null;
    await askPersist();
    DL = { job, total: missing.length, done: 0, skipped: 0, fail: [], cancelled: false, ctl: typeof AbortController === 'function' ? new AbortController() : null, finished: false };
    const run = DL; dlPaint();
    let c; try { c = await caches.open(DL_STORE); } catch (e) { run.fail.push({ name: 'المخزن', why: 'تعذّر فتحه' }); }
    const q = missing.slice();
    const worker = async () => {
      while (q.length && !run.cancelled && c) {
        const it = q.shift();
        try { if (await c.match(it.key)) { run.skipped++; run.done++; dlPaint(); continue; } } catch (e) {}
        let why = '';
        for (const u of it.src) {
          let r = null;
          try { r = await fetch(u, Object.assign({}, it.init, run.ctl ? { signal: run.ctl.signal } : {})); } catch (e) { why = run.cancelled ? '' : 'الشبكة'; continue; }
          if (!r.ok) { why = 'HTTP ' + r.status; continue; }
          try { await c.put(it.key, r); why = null; } catch (e) { why = (e && /quota/i.test(String(e.name) + String(e.message))) ? 'امتلأت المساحة' : 'تعذّر الحفظ'; }
          break;
        }
        if (why !== null && !run.cancelled) run.fail.push({ name: it.name, why });
        run.done++; dlPaint();
      }
    };
    await Promise.all([0, 1, 2, 3].map(worker));
    run.finished = true; DL = null;
    const msg = run.cancelled ? 'أُوقف التنزيل' : (run.fail.length ? 'انتهى التنزيلُ وتعذّر ' + ar(run.fail.length) + ' ملفًّا' : 'اكتمل تنزيلُ ' + run.job.title);
    toast(msg); dlPaint(run); dlHave();
  }
  function dlPaint(last) {
    const panel = $('dlPanel'); const r = last || DL; if (!panel || !r) return;
    const fails = r.fail.length ? '<p class="note">تعذّر ' + ar(r.fail.length) + ': ' + r.fail.slice(0, 12).map((f) => esc(f.name) + ' (' + esc(f.why) + ')').join('، ') + (r.fail.length > 12 ? '، وغيرُها' : '') + '</p>' : '';
    const head = '<h3>' + esc(r.job.title) + '</h3><progress max="' + r.total + '" value="' + r.done + '" style="width:100%"></progress>' +
      '<p class="muted">' + ar(r.done) + ' من ' + ar(r.total) + (r.skipped ? '، منها ' + ar(r.skipped) + ' كانت منزَّلة' : '') + '</p>';
    if (r.finished) panel.innerHTML = head + (r.cancelled ? '<p class="muted">أُوقف التنزيل. ما نُزِّل يبقى، ويُكمَلُ الباقي إذا ضغطتَ التنزيلَ مرّةً أخرى.</p>' : '<p>انتهى.</p>') + fails;
    else panel.innerHTML = head + fails + '<div class="row"><button type="button" class="chip" data-dlstop="1">إيقاف</button></div>';
  }
  function dlCancel() { if (!DL) return; DL.cancelled = true; if (DL.ctl) try { DL.ctl.abort(); } catch (e) {} }

  // What is in the store, grouped the way it was downloaded. Read from the store itself on every call.
  async function dlInventory() {
    const inv = { pages: new Set(), geo: new Set(), tafsir: {}, trans: {}, audio: {}, other: 0, keys: [] };
    let c; try { c = await caches.open(DL_STORE); } catch (e) { return null; }
    const reqs = await c.keys();
    for (const rq of reqs) {
      const u = rq.url; inv.keys.push(u); let m;
      const path = (() => { try { return new URL(u).pathname; } catch (e) { return ''; } })();
      if ((m = /\/assets\/madina-hafs\/page-(\d{3})\.webp$/.exec(path))) inv.pages.add(+m[1]);
      else if ((m = /\/mushaf-lab\/geometry\/(\d{3})\.json$/.exec(path))) inv.geo.add(+m[1]);
      else if ((m = /^(?:https:\/\/cdn\.jsdelivr\.net\/gh\/spa5k\/tafsir_api@main|https:\/\/raw\.githubusercontent\.com\/spa5k\/tafsir_api\/main)\/tafsir\/([^/]+)\/(\d+)\.json$/.exec(u))) (inv.tafsir[m[1]] = inv.tafsir[m[1]] || new Set()).add(+m[2]);
      else if ((m = /\/editions\/([^/]+)\.min\.json$/.exec(u))) inv.trans[m[1]] = true;
      else if ((m = /^https:\/\/everyayah\.com\/data\/([^/]+)\/(\d{3})(\d{3})\.mp3$/.exec(u))) { const a = (inv.audio[m[1]] = inv.audio[m[1]] || {}); (a[+m[2]] = a[+m[2]] || new Set()).add(+m[3]); }
      else inv.other++;
    }
    return inv;
  }
  async function dlHave() {
    const box = $('dlHave'); if (!box) return;
    const inv = await dlInventory();
    if (!inv) { box.innerHTML = '<p class="note">تعذّرت قراءةُ المخزن.</p>'; return; }
    if (!inv.keys.length) { box.innerHTML = '<p class="empty">لم تنزّلْ شيئًا بعد.</p>'; return; }
    const li = (label, attrs) => '<li><div class="row sp"><span>' + label + '</span><button type="button" class="chip" ' + attrs + '>حذف</button></div></li>';
    let h = '<ul class="list">';
    for (let j = 1; j <= 30; j++) {
      const [a, b] = juzRange(j); let np = 0, ng = 0;
      for (let p = a; p <= b; p++) { if (inv.pages.has(p)) np++; if (inv.geo.has(p)) ng++; }
      if (np || ng) h += li('الجزء ' + ar(j) + ': ' + ar(np) + ' من ' + ar(b - a + 1) + ' صفحة، و' + ar(ng) + ' من ' + ar(b - Math.max(a, 3) + 1) + ' ملفَّ آيات', 'data-dldel="juz" data-v="' + j + '"');
    }
    for (const id of Object.keys(inv.trans)) { const t = (META.translations || []).find((x) => x.id === id); h += li('الترجمة: ' + esc(t ? t.name : id), 'data-dldel="trans" data-v="' + esc(id) + '"'); }
    for (const id of Object.keys(inv.tafsir)) { const t = (META.tafsirs || []).find((x) => x.id === id); h += li(esc(t ? t.name : id) + ': ' + ar(inv.tafsir[id].size) + ' من ١١٤ سورة', 'data-dldel="tafsir" data-v="' + esc(id) + '"'); }
    for (const rec of Object.keys(inv.audio)) for (const s of Object.keys(inv.audio[rec]).map(Number).sort((x, y) => x - y)) {
      h += li('تلاوة ' + esc(reciterName(rec)) + '، سورة ' + esc(surahName(s)) + ': ' + ar(inv.audio[rec][s].size) + ' من ' + ar(T.nAyah[s - 1]) + ' آية' + (s === 1 ? ' (الآيةُ الأولى هي البسملةُ التي تسبقُ السور)' : ''), 'data-dldel="audio" data-v="' + esc(rec) + '|' + s + '"');
    }
    if (inv.other) h += li('ملفّاتٌ أخرى: ' + ar(inv.other), 'data-dldel="other"');
    h += '</ul><div class="row" style="margin-top:8px"><button type="button" class="chip" data-dldel="all">حذفُ كلِّ التنزيلات</button></div>';
    box.innerHTML = h;
  }
  async function dlDelete(kind, v) {
    if (DL) { toast('أوقفِ التنزيلَ الجاريَ أوّلًا'); return; }
    let c; try { c = await caches.open(DL_STORE); } catch (e) { return; }
    if (kind === 'all') { if (!confirm('ستُحذَفُ كلُّ التنزيلاتِ من هذا الجهاز. هل تتابع؟')) return; await caches.delete(DL_STORE); }
    else {
      const inv = await dlInventory(); if (!inv) return;
      const doomed = inv.keys.filter((u) => {
        const path = (() => { try { return new URL(u).pathname; } catch (e) { return ''; } })(); let m;
        if (kind === 'juz') { const [a, b] = juzRange(+v); m = /\/assets\/madina-hafs\/page-(\d{3})\.webp$/.exec(path) || /\/mushaf-lab\/geometry\/(\d{3})\.json$/.exec(path); return !!m && +m[1] >= a && +m[1] <= b; }
        if (kind === 'trans') return new RegExp('/editions/' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.min\\.json$').test(u);
        if (kind === 'tafsir') return u.indexOf('/tafsir/' + v + '/') > 0;
        if (kind === 'audio') { const [rec, s] = v.split('|'); return u.indexOf('https://everyayah.com/data/' + rec + '/' + pad3(s)) === 0; }
        if (kind === 'other') return !/\/assets\/madina-hafs\/|\/mushaf-lab\/geometry\/|\/tafsir\/|\/editions\/|everyayah\.com/.test(u);
        return false;
      });
      await Promise.all(doomed.map((u) => c.delete(u).catch(() => false)));
    }
    textWhole.clear(); toast('حُذف'); dlHave();
  }
  async function downloadsSheet() {
    if (!('caches' in window)) { toast('هذا المتصفّحُ لا يدعمُ التنزيلَ للاستخدامِ دونَ اتّصال'); return; }
    await sizes();
    const s = surahOfPage(cur); const j = juzOf(cur);
    const juzBytes = SIZES ? (() => { const [a, b] = juzRange(j); let t = 0; for (let p = a; p <= b; p++) t += SIZES.pages[p - 1] + SIZES.geometry[p - 1]; return t; })() : 0;
    const allBytes = SIZES ? SIZES.totals.pages + SIZES.totals.geometry : 0;
    const opt = (list) => '<option value="">اخترْ</option>' + list.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.name) + (APPROX_BYTES[t.id] ? '، نحوُ ' + MB(APPROX_BYTES[t.id]) : '') + '</option>').join('');
    openSheet('<h2>التنزيلات</h2><p class="muted">ما تنزّله هنا يبقى على هذا الجهاز، فتقرؤه وتسمعه دون إنترنت. لا يبدأ تنزيلٌ حتى تضغطَ «ابدأ التنزيل» بعد أن ترى حجمه.</p>' +
      (IN_EZIK ? '<h3>صفحات المصحف</h3><div class="chips"><button type="button" data-dl="juz">الجزء الحالي (الجزء ' + ar(j) + ')' + (juzBytes ? '، ' + MB(juzBytes) : '') + '</button><button type="button" data-dl="all">المصحف كاملًا' + (allBytes ? '، ' + MB(allBytes) : '') + '</button></div>' : '') +
      '<div class="field"><label for="dlTr">ترجمة</label><select id="dlTr">' + opt(META.translations || []) + '</select></div><div class="row"><button type="button" class="chip" data-dl="trans">تنزيل الترجمة</button></div>' +
      '<div class="field"><label for="dlTf">تفسير (١١٤ ملفًّا، ملفٌّ لكلِّ سورة)</label><select id="dlTf">' + opt(META.tafsirs || []) + '</select></div><div class="row"><button type="button" class="chip" data-dl="tafsir">تنزيل التفسير</button></div>' +
      '<div class="field"><label for="dlRc">تلاوة سورة ' + esc(surahName(s)) + ' كاملةً</label><select id="dlRc">' + reciters().map((r) => '<option value="' + r.id + '"' + (r.id === S.reciter ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></div><div class="row"><button type="button" class="chip" data-dl="recite">تنزيل التلاوة</button></div>' +
      '<div id="dlPanel"></div><h3>على هذا الجهاز</h3><div id="dlHave"><p class="muted">يُقرأ المخزن…</p></div>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dl) dlPrepare(b.dataset.dl);
      else if (b.dataset.dlgo) dlStart();
      else if (b.dataset.dlno) { dlPending = null; $('dlPanel').innerHTML = ''; }
      else if (b.dataset.dlstop) dlCancel();
      else if (b.dataset.dldel) dlDelete(b.dataset.dldel, b.dataset.v);
    });
    if (DL) dlPaint();
    dlHave();
  }

  // Stored whole files, read back when the per-ayah fetch fails. Shapes, measured 2026-09-27:
  //   tafsir/{slug}/{surah}.json   an array of { text, ayah, surah }
  //   editions/{id}.min.json       { quran: [ { chapter, verse, text } ] }
  const textWhole = new Map();
  async function storedJson(bases, rel) {
    if (textWhole.has(rel)) return textWhole.get(rel);
    const pr = (async () => { try { const c = await caches.open(DL_STORE); for (const b of bases) { const r = await c.match(b + rel); if (r) return await r.json(); } } catch (e) {} return undefined; })();
    textWhole.set(rel, pr); if (textWhole.size > 4) textWhole.delete(textWhole.keys().next().value);
    const v = await pr; if (v === undefined) textWhole.delete(rel); return v;
  }
  async function fromStoredWhole(bases, path) {
    const m = /^([^/]+)\/(\d+)\/(\d+)\.json$/.exec(path); if (!m || !('caches' in window)) return undefined;
    const id = m[1], s = +m[2], a = +m[3];
    if (bases === TAFSIR_BASES) { const d = await storedJson(bases, TAFSIR_WHOLE(id, s)); if (!Array.isArray(d)) return undefined; return d.find((x) => +x.ayah === a) || null; }
    if (bases === TRANS_BASES) { const d = await storedJson(bases, TRANS_WHOLE(id)); if (!d || !Array.isArray(d.quran)) return undefined; return d.quran.find((x) => +x.chapter === s && +x.verse === a) || null; }
    return undefined;
  }
  // ------------------------------------------------------------------ recitation player
  const P = { on: false, list: [], i: 0, rep: 0, rrep: 0, phase: 'ayah', key: null, audio: new Audio(), pre: new Audio(), paused: false, seq: 0, blob: null };
  P.audio.preload = 'auto'; P.pre.preload = 'auto';
  function playFrom(startKey, endKey) {
    const [s] = startKey.split(':').map(Number);
    const end = endKey || (s + ':' + T.nAyah[s - 1]);
    P.list = keysBetween(startKey, end); P.i = 0; P.rrep = 0; P.on = true; P.paused = false;
    $('player').hidden = false; setImmersive(false); playIndex(0);
  }
  function playIndex(i) {
    if (!P.list.length) return;
    if (i < 0) i = 0; if (i >= P.list.length) { stopPlay(); return; }
    P.i = i; P.rep = 0; const key = P.list[i]; const [s, a] = key.split(':').map(Number);
    P.phase = (a === 1 && s !== 1 && s !== 9) ? 'basm' : 'ayah';
    startTrack();
  }
  function trackUrl() { const [s, a] = P.list[P.i].split(':').map(Number); return P.phase === 'basm' ? AUDIO(S.reciter, 1, 1) : AUDIO(S.reciter, s, a); }
  // A stored ayah plays from a blob URL made from the stored response -- online too, it saves data -- and not
  // through Ezik's worker, so no range request is involved, which is what lets it play in the iOS webview.
  // Each blob URL is revoked when the next track replaces it, and on stop.
  async function storedAudio(url, body) {
    try { if (!('caches' in window)) return null; const c = await caches.open(DL_STORE); const r = await c.match(url); return r ? (body ? await r.blob() : true) : null; } catch (e) { return null; }
  }
  function releaseBlob() { if (P.blob) { try { URL.revokeObjectURL(P.blob); } catch (e) {} P.blob = null; } }
  function startTrack() {
    const key = P.list[P.i]; P.key = key; const seq = ++P.seq; const url = trackUrl();
    storedAudio(url, true).then((b) => {
      if (seq !== P.seq || !P.on) return;
      const old = P.blob; P.blob = b ? URL.createObjectURL(b) : null;
      P.audio.src = P.blob || url; P.audio.playbackRate = S.speed; P.audio.defaultPlaybackRate = S.speed;
      if (old) { try { URL.revokeObjectURL(old); } catch (e) {} }
      const pr = P.audio.play(); if (pr && pr.catch) pr.catch(() => { if (P.on) { P.paused = true; updatePlayerUi(); } });
      updatePlayerUi();
    });
    if (S.follow !== false && ayahPage[key] && visiblePages(cur).indexOf(ayahPage[key]) < 0) { const nx = neighborAnchor(cur, 1); if (nx && visiblePages(nx).indexOf(ayahPage[key]) >= 0) turn(1, false); else goPage(ayahPage[key]); }
    redrawMarks(); updatePlayerUi(); mediaSession();
    const nk = P.phase === 'basm' ? key : P.list[P.i + 1];
    if (nk) { const [s2, a2] = nk.split(':').map(Number); const nu = AUDIO(S.reciter, s2, a2); storedAudio(nu, false).then((has) => { if (seq === P.seq && !has) P.pre.src = nu; }); }   // a stored ayah needs no preload
  }
  P.audio.addEventListener('ended', () => {
    if (!P.on) return;
    if (P.phase === 'basm') { P.phase = 'ayah'; startTrack(); return; }
    P.rep++;
    const repA = S.repAyah === 0 ? Infinity : S.repAyah;
    if (P.rep < repA) { P.audio.currentTime = 0; const pr = P.audio.play(); if (pr && pr.catch) pr.catch(() => {}); return; }
    if (P.i + 1 < P.list.length) { playIndex(P.i + 1); return; }
    P.rrep++; const repR = S.repRange === 0 ? Infinity : S.repRange;
    if (P.rrep < repR) { playIndex(0); return; }
    stopPlay(); toast('انتهت التلاوة');
  });
  P.audio.addEventListener('error', () => { if (P.on && P.audio.src) { toast('تعذّر تشغيلُ التلاوة. تحقّقْ من الاتصال أو غيّرِ القارئ.'); stopPlay(); } });
  function stopPlay() { P.on = false; P.key = null; P.seq++; try { P.audio.pause(); } catch (e) {} P.audio.removeAttribute('src'); releaseBlob(); $('player').hidden = true; redrawMarks(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; }
  function togglePlay() { if (!P.on) return; if (P.audio.paused) { const pr = P.audio.play(); if (pr && pr.catch) pr.catch(() => {}); P.paused = false; } else { P.audio.pause(); P.paused = true; } updatePlayerUi(); }
  function updatePlayerUi() {
    if (!P.on) return; const key = P.list[P.i];
    $('plNow').textContent = (P.phase === 'basm' ? 'البسملة، ثمّ ' : '') + shortRef(key);
    const rA = S.repAyah === 0 ? 'بلا نهاية' : ar(S.repAyah), rR = S.repRange === 0 ? 'بلا نهاية' : ar(S.repRange);
    $('plInfo').textContent = reciterName(S.reciter) + '، السرعة ' + ar(S.speed) + '، تكرار الآية ' + rA + '، تكرار النطاق ' + rR;
    $('plToggle').textContent = P.audio.paused ? 'متابعة' : 'إيقاف مؤقت';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = P.audio.paused ? 'paused' : 'playing';
  }
  P.audio.addEventListener('play', updatePlayerUi); P.audio.addEventListener('pause', updatePlayerUi);
  function mediaSession() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const key = P.list[P.i];
    navigator.mediaSession.metadata = new MediaMetadata({ title: refText(key), artist: reciterName(S.reciter), album: 'مصحف عزك', artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
    set('play', togglePlay); set('pause', togglePlay); set('previoustrack', () => playIndex(P.i - 1)); set('nexttrack', () => playIndex(P.i + 1)); set('stop', stopPlay);
  }
  function audioSheet() {
    const cur0 = P.on ? P.list[0] : (pageAyat[cur][0] || '1:1'), cur1 = P.on ? P.list[P.list.length - 1] : (pageAyat[cur][pageAyat[cur].length - 1] || '1:7');
    const surahSel = (id, v) => '<select id="' + id + '">' + T.names.map((n, i) => '<option value="' + (i + 1) + '"' + (i + 1 === v ? ' selected' : '') + '>' + ar(i + 1) + '. ' + esc(n) + '</option>').join('') + '</select>';
    const reps = (id, v) => '<select id="' + id + '">' + [1, 2, 3, 4, 5, 7, 10, 15, 20, 25].map((n) => '<option value="' + n + '"' + (n === v ? ' selected' : '') + '>' + ar(n) + '</option>').join('') + '<option value="0"' + (v === 0 ? ' selected' : '') + '>بلا نهاية</option></select>';
    openSheet('<h2>إعداداتُ التلاوة</h2>' +
      '<div class="field"><label for="aRc">القارئ</label><select id="aRc">' + reciters().map((r) => '<option value="' + r.id + '"' + (r.id === S.reciter ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></div>' +
      '<h3>السرعة</h3><div class="chips" id="aSp">' + [0.5, 0.75, 1, 1.25, 1.5].map((v) => '<button type="button" data-sp="' + v + '" aria-pressed="' + (v === S.speed) + '">' + ar(v) + '</button>').join('') + '</div>' +
      '<div class="grid2"><div class="field"><label for="aRA">تكرارُ كلِّ آية</label>' + reps('aRA', S.repAyah) + '</div><div class="field"><label for="aRR">تكرارُ النطاقِ كاملًا</label>' + reps('aRR', S.repRange) + '</div></div>' +
      '<h3>النطاق</h3><div class="grid2"><div class="field"><label for="fS">من سورة</label>' + surahSel('fS', +cur0.split(':')[0]) + '</div><div class="field"><label for="fA">من آية</label><input type="number" id="fA" min="1" value="' + cur0.split(':')[1] + '"></div></div>' +
      '<div class="grid2"><div class="field"><label for="tS">إلى سورة</label>' + surahSel('tS', +cur1.split(':')[0]) + '</div><div class="field"><label for="tA">إلى آية</label><input type="number" id="tA" min="1" value="' + cur1.split(':')[1] + '"></div></div>' +
      '<div class="chips"><button type="button" class="primary" data-act="playRange">تشغيل النطاق</button><button type="button" data-act="follow" aria-pressed="' + (S.follow !== false) + '">الصفحةُ تتبعُ التلاوة</button></div>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sp) { S.speed = +b.dataset.sp; saveSettings(); P.audio.playbackRate = S.speed; $('aSp').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); updatePlayerUi(); return; }
      if (b.dataset.act === 'follow') { S.follow = S.follow === false; saveSettings(); b.setAttribute('aria-pressed', S.follow !== false); return; }
      if (b.dataset.act === 'playRange') {
        const fs = +$('fS').value, ts = +$('tS').value; const fa = Math.max(1, Math.min(T.nAyah[fs - 1], +$('fA').value || 1)), ta = Math.max(1, Math.min(T.nAyah[ts - 1], +$('tA').value || 1));
        closeSheet(); playFrom(fs + ':' + fa, ts + ':' + ta);
      }
    });
    $('aRc').onchange = (e) => { S.reciter = e.target.value; saveSettings(); if (P.on) playIndex(P.i); };
    $('aRA').onchange = (e) => { S.repAyah = +e.target.value; saveSettings(); updatePlayerUi(); };
    $('aRR').onchange = (e) => { S.repRange = +e.target.value; saveSettings(); updatePlayerUi(); };
  }

  // ------------------------------------------------------------------ input wiring
  function wire() {
    $('prevBtn').onclick = () => step(-1); $('nextBtn').onclick = () => step(1);
    $('navIndex').onclick = () => indexSheet(); $('navSearch').onclick = () => searchSheet(); $('navGo').onclick = goSheet; $('navSaved').onclick = () => savedSheet(); $('navMore').onclick = settingsSheet;
    $('plPrev').onclick = () => playIndex(P.i - 1); $('plNext').onclick = () => playIndex(P.i + 1); $('plToggle').onclick = togglePlay; $('plStop').onclick = stopPlay; $('plSet').onclick = audioSheet;
    if (EMBED) { $('exitBtn').hidden = false; document.querySelector('.top').classList.add('embedded'); $('exitBtn').onclick = () => { try { window.parent.postMessage({ type: 'mushaf-lab:exit' }, location.origin); } catch (e) {} }; }
    $('scrim').onclick = closeSheet; $('hintOk').onclick = () => { $('hint').hidden = true; store.set('hintSeen', true); };
    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'Escape') closeSheet(); else if (e.key === 'ArrowLeft') step(1); else if (e.key === 'ArrowRight') step(-1); else if (e.key === ' ' && P.on) { e.preventDefault(); togglePlay(); }
    });
    // Any press opens the ayah menu: a short tap on release, a long press after 450 ms while the finger is
    // still down. Native text selection is off on the page layer (style.css), so no system copy bubble
    // competes with the menu. Free selection lives behind the menu's own button (selection mode).
    const sp = $('spread'); let press = null;
    const openFromPress = (st, x, y) => {
      const p = +st.dataset.p;
      if (p < 3) { pageListSheet(p); return; }
      const key = ayahAt(st, x, y); if (!key) return;
      if (rangeStart) { const ks = keysBetween(rangeStart, key); rangeStart = null; rangeSheet(ks); return; }
      ayahSheet(key);
    };
    const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
    sp.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('selmode') || settling) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (window.visualViewport && window.visualViewport.scale > 1.05) return;
      cancelPress();
      const st = e.target.closest('.stage');
      const pr = { x: e.clientX, y: e.clientY, st, fired: false, drag: false, moved: false, lx: e.clientX, lt: Date.now(), vx: 0, id: e.pointerId };
      pr.timer = setTimeout(() => { if (press === pr && !pr.drag && !pr.moved && st) { pr.fired = true; openFromPress(st, pr.x, pr.y); } }, 450);
      press = pr;
    });
    sp.addEventListener('pointermove', (e) => {
      const pr = press; if (!pr || pr.fired) return;
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
      if (!pr.drag) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { pr.drag = true; clearTimeout(pr.timer); try { sp.setPointerCapture(pr.id); } catch (err) {} }
        else if (Math.hypot(dx, dy) > 12) { pr.moved = true; clearTimeout(pr.timer); }
      }
      if (pr.drag) {
        const now = Date.now(); if (now > pr.lt) { pr.vx = (e.clientX - pr.lx) / (now - pr.lt); pr.lx = e.clientX; pr.lt = now; }
        let d = dx; if ((d > 0 && !neighborAnchor(cur, 1)) || (d < 0 && !neighborAnchor(cur, -1))) d *= 0.25;
        setTrack(d, false);
      }
    });
    const endPress = (e, cancelled) => {
      const pr = press; if (!pr) return; press = null; clearTimeout(pr.timer);
      if (pr.drag) {
        const dx = cancelled ? 0 : e.clientX - pr.x; const W = ($('main') && $('main').clientWidth) || window.innerWidth;
        const dir = (dx > W * 0.2 || (pr.vx > 0.45 && dx > 20)) ? 1 : ((dx < -W * 0.2 || (pr.vx < -0.45 && dx < -20)) ? -1 : 0);
        if (dir && neighborAnchor(cur, dir)) turn(dir, true); else setTrack(0, true);
        return;
      }
      if (cancelled || pr.fired || pr.moved || Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 12) return;
      if (rangeStart && pr.st) { openFromPress(pr.st, e.clientX, e.clientY); return; }
      toggleChrome();
    };
    sp.addEventListener('pointerup', (e) => endPress(e, false));
    sp.addEventListener('pointercancel', (e) => endPress(e, true));
    sp.addEventListener('contextmenu', (e) => { if (!document.body.classList.contains('selmode')) e.preventDefault(); });
    $('selDone').onclick = endSelMode;
    document.addEventListener('copy', (e) => {
      const s1 = window.getSelection && window.getSelection(); if (!s1 || s1.isCollapsed) return;
      const a = s1.anchorNode && (s1.anchorNode.nodeType === 1 ? s1.anchorNode : s1.anchorNode.parentElement);
      if (!a || !a.closest || !a.closest('.tl')) return;
      const t = String(s1).replace(/\s+/g, ' ').trim(); if (t && e.clipboardData) { e.clipboardData.setData('text/plain', t); e.preventDefault(); }
    });
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const n = slots && slots[1] ? slots[1].querySelectorAll('.stage').length : 0; syncInsets(); if (n !== visiblePages(cur).length) render(); else sizeStages(); }, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeStages);
    window.addEventListener('hashchange', () => route(false));
  }
  function route(first) {
    const h = location.hash.replace(/^#/, ''); const prm = new URLSearchParams(h.indexOf('=') >= 0 ? h : '');
    if (prm.get('a') && Q[prm.get('a')]) { const k = prm.get('a'); cur = ayahPage[k]; goPage(cur); setTimeout(() => ayahSheet(k), 150); }
    else if (prm.get('p')) goPage(+prm.get('p'));
    else if (h === 'search') { goPage(cur); searchSheet(); }
    else if (h === 'saved') { goPage(cur); savedSheet(); }
    else if (h === 'last') goPage(store.get('last', 3));
    else if (prm.get('s') && T.pageForSura[+prm.get('s') - 1]) goPage(T.pageForSura[+prm.get('s') - 1]);
    else if (first) goPage(cur);
  }

  // test hooks (read-only use by the build's smoke test)
  window.__lab = { turn, get slots() { return slots; }, syncInsets, sizeStages, toggleChrome, wordsOf, normalize, keysBetween, citeRange, visiblePages, quarterLabel, get state() { return { cur, P, S }; }, ayahSheet, savedSheet, searchSheet, runSearch, indexSheet, goSheet, settingsSheet, playFrom, stopPlay, toggleBookmark, findBookmark, rangeSheet, closeSheet, render, goPage, exportCsv, downloadsSheet, dlInventory };
})();
