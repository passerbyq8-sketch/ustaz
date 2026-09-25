'use strict';
(function () {
  // ------------------------------------------------------------------ constants
  const IMG = (n) => 'https://ezik.app/assets/madina-hafs/page-' + pad3(n) + '.webp';
  const SVG = (n) => 'https://mushaf.almurabbi.app/pages/' + pad3(n) + '.svg';
  const AUDIO = (rec, s, a) => 'https://everyayah.com/data/' + rec + '/' + pad3(s) + pad3(a) + '.mp3';
  const TAFSIR_BASES = ['https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/', 'https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/'];
  const TRANS_BASES = ['https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/', 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/'];
  const SVG_W = 382.68, SVG_H = 547.09, PRINT_H = 1229, Y_A = 2.5009, Y_B = -63.05;   // measured mapping, svg -> print
  const FALLBACK_RECITER = { id: 'Hudhaify_64kbps', name: 'علي الحذيفي' };
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
  let selKey = null;              // ayah with its menu open
  let rangeStart = null, rangeKeys = null;
  let flashKey = null, flashTimer = 0;

  // ------------------------------------------------------------------ boot
  boot();
  async function boot() {
    try {
      const [t, m, l, q] = await Promise.all(['data/tables.json', 'data/meta.json', 'data/mushaf-layout.json', 'data/quran-uthmani.json']
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
  const geoUrl = (p) => 'geometry/' + pad3(p) + '.json?v=' + encodeURIComponent((META && META.built) || '1');   // a rebuild gets fresh URLs past every cache
  function visiblePages(p) { if (!isSpread()) return [p]; const odd = p % 2 ? p : p - 1; return [odd, odd + 1].filter((x) => x >= 1 && x <= 604); }
  async function loadGeo(p) {
    if (p < 3) return null;
    if (geoCache.has(p)) return geoCache.get(p);
    const pr = fetch(geoUrl(p)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    geoCache.set(p, pr);
    const g = await pr; geoCache.set(p, g); return g;
  }
  function goPage(p, opts) {
    cur = clampPage(p); store.set('last', cur);
    const rec = store.get('recent', []).filter((x) => x !== cur); rec.unshift(cur); store.set('recent', rec.slice(0, 12));
    render(); if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
    [cur - 2, cur - 1, cur + 1, cur + 2].forEach((q) => { if (q >= 3 && q <= 604) loadGeo(q); });
  }
  async function render() {
    const pages = visiblePages(cur);
    const sp = $('spread'); sp.textContent = '';
    const heads = [];
    for (const p of pages) {
      const st = document.createElement('div');
      st.className = 'stage' + (S.mode === 'vector' ? ' vector' : '') + (p < 3 ? ' list-only' : ''); st.dataset.p = p;
      const im = document.createElement('img'); im.alt = 'صفحة ' + ar(p); im.decoding = 'async'; im.draggable = false;
      im.src = S.mode === 'vector' ? SVG(p) : IMG(p);
      im.addEventListener('load', () => fitStage(st)); im.addEventListener('error', () => { const ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = 'تعذّر تحميل صورة الصفحة'; st.appendChild(ph); });
      const layer = document.createElement('div'); layer.className = 'layer';
      const tl = document.createElement('div'); tl.className = 'tl';
      st.append(im, layer, tl); sp.appendChild(st);
      heads.push(p);
      if (p >= 3) loadGeo(p).then((g) => { if (g && st.isConnected) { buildTextLayer(st, g); drawMarks(st); } });
    }
    // header
    const ss = []; heads.forEach((p) => pageAyat[p].forEach((k) => { const s = +k.split(':')[0]; if (ss.indexOf(s) < 0) ss.push(s); }));
    $('surahTitle').textContent = ss.map((s) => 'سورة ' + surahName(s)).join('، ');
    $('subTitle').textContent = 'الجزء ' + ar(juzOf(heads[0])) + '، صفحة ' + heads.map(ar).join(' و');
    $('navPage').textContent = ar(cur);
    const qs = []; heads.forEach((p) => (quarterByPage[p] || []).forEach((i) => qs.push(quarterLabel(i))));
    $('notice').textContent = qs.length ? 'في هذه الصفحة بدايةُ ' + qs.join('، و') : '';
    $('prevBtn').disabled = heads[0] <= 1; $('nextBtn').disabled = heads[heads.length - 1] >= 604;
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
    const r = st.getBoundingClientRect(); const px = (cx - r.left) / r.width * 100, py = (cy - r.top) / r.height * 100;
    let best = null, bd = Infinity;
    for (const ln of g.lines) for (const it of ln.items) {
      const b = itemBox(g, it, ln); if (py < b.t || py > b.t + b.h) continue;
      const d = Math.abs(px - (b.l + b.w / 2)); if (d < bd) { bd = d; best = it.m || it.k.split(':').slice(0, 2).join(':'); }
    }
    return best;
  }
  function step(dir) {
    const inc = isSpread() ? 2 : 1; const base = isSpread() ? (cur % 2 ? cur : cur - 1) : cur;
    const n = base + dir * inc; if (n < 1 || n > 604) return; closeSheet(); goPage(n);
  }
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
    const pr = (async () => { for (const b of bases) { try { const r = await fetch(b + path); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) {} } return undefined; })();
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
    list.unshift({ id: uid(), t, k, tags: [], at: Date.now() }); store.set('bm', list); return true;
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
      '<h3>دونَ اتّصال</h3><p class="muted">ينزّلُ صفحاتِ السورةِ الحاليّةِ وتلاوتَها بصوتِ القارئِ المختار، فتفتحُ بعدَها دونَ إنترنت.</p><div class="row"><button type="button" class="chip" data-act="offline">تنزيلُ السورةِ الحاليّة</button></div><div class="muted" id="offProg"></div>' +
      '<div class="row" style="margin-top:14px"><button type="button" class="chip" data-act="hint">إظهارُ الإرشاد</button></div>' +
      '<p class="foot">صفحةُ مختبرٍ خارجَ عزك. صورُ الصفحات: مصحفُ المدينة النبويّة برواية حفص عن عاصم، مجمّعُ الملك فهد لطباعة المصحف الشريف. نصُّ الآياتِ هو النصُّ المعتمَدُ في عزك. التفاسير من مجموعة «tafsir_api» المفتوحة، والترجمات من «quran-api»، والتلاوات من «EveryAyah».' + (META.built ? ' بُنيت البيانات: ' + esc(META.built) + '.' : '') + '</p>', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const grp = b.parentElement && b.parentElement.dataset.group;
      if (grp) { S[grp] = b.dataset.set; saveSettings(); b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); if (grp === 'mode') render(); return; }
      const act = b.dataset.act;
      if (act === 'spread') { S.spread = !S.spread; saveSettings(); b.setAttribute('aria-pressed', S.spread); render(); }
      else if (act === 'markBm') { S.markBm = !S.markBm; saveSettings(); b.setAttribute('aria-pressed', S.markBm); redrawMarks(); }
      else if (act === 'pickTafsir') tafsirPicker(settingsSheet);
      else if (act === 'offline') downloadSurah();
      else if (act === 'hint') { closeSheet(); $('hint').hidden = false; }
    });
    $('nb').oninput = (e) => { S.nightB = +e.target.value; saveSettings(); };
    $('nc').oninput = (e) => { S.nightC = +e.target.value; saveSettings(); };
    $('tfs').oninput = (e) => { S.tfs = +e.target.value; saveSettings(); };
    $('rcSel').onchange = (e) => { S.reciter = e.target.value; saveSettings(); if (P.on) { playIndex(P.i); } };
  }
  async function downloadSurah() {
    if (!('caches' in window)) { toast('هذا المتصفّحُ لا يدعمُ التنزيلَ للاستخدامِ دونَ اتّصال'); return; }
    const s = +((pageAyat[cur][0] || '2:1').split(':')[0]);
    const p0 = T.pageForSura[s - 1]; let p1 = p0;
    while (p1 < 604 && pageAyat[p1 + 1].some((k) => +k.split(':')[0] === s)) p1++;
    const jobs = [];
    for (let p = p0; p <= p1; p++) { jobs.push(['lab-pages', S.mode === 'vector' ? SVG(p) : IMG(p), true]); if (p >= 3) jobs.push(['lab-static', geoUrl(p), false]); }
    for (let a = 1; a <= T.nAyah[s - 1]; a++) jobs.push(['lab-audio', AUDIO(S.reciter, s, a), true]);
    if (s !== 1 && s !== 9) jobs.push(['lab-audio', AUDIO(S.reciter, 1, 1), true]);
    let done = 0, fail = 0; const prog = $('offProg');
    for (const [cn, url, opaque] of jobs) {
      try { const c = await caches.open(cn); const hit = await c.match(url); if (!hit) { const r = await fetch(url, opaque ? { mode: 'no-cors' } : {}); if (r.type === 'opaque' || r.ok) await c.put(url, r); else fail++; } } catch (e) { fail++; }
      done++; if (prog) prog.textContent = 'نُزِّل ' + ar(done) + ' من ' + ar(jobs.length) + (fail ? '، وتعذّر ' + ar(fail) : '');
    }
    toast(fail ? 'انتهى التنزيلُ وتعذّر ' + ar(fail) + ' ملفًّا' : 'نُزِّلت سورةُ ' + surahName(s) + ' للاستخدامِ دونَ اتّصال');
  }

  // ------------------------------------------------------------------ recitation player
  const P = { on: false, list: [], i: 0, rep: 0, rrep: 0, phase: 'ayah', key: null, audio: new Audio(), pre: new Audio(), paused: false };
  P.audio.preload = 'auto'; P.pre.preload = 'auto';
  function playFrom(startKey, endKey) {
    const [s] = startKey.split(':').map(Number);
    const end = endKey || (s + ':' + T.nAyah[s - 1]);
    P.list = keysBetween(startKey, end); P.i = 0; P.rrep = 0; P.on = true; P.paused = false;
    $('player').hidden = false; playIndex(0);
  }
  function playIndex(i) {
    if (!P.list.length) return;
    if (i < 0) i = 0; if (i >= P.list.length) { stopPlay(); return; }
    P.i = i; P.rep = 0; const key = P.list[i]; const [s, a] = key.split(':').map(Number);
    P.phase = (a === 1 && s !== 1 && s !== 9) ? 'basm' : 'ayah';
    startTrack();
  }
  function trackUrl() { const [s, a] = P.list[P.i].split(':').map(Number); return P.phase === 'basm' ? AUDIO(S.reciter, 1, 1) : AUDIO(S.reciter, s, a); }
  function startTrack() {
    const key = P.list[P.i]; P.key = key;
    P.audio.src = trackUrl(); P.audio.playbackRate = S.speed; P.audio.defaultPlaybackRate = S.speed;
    const pr = P.audio.play(); if (pr && pr.catch) pr.catch(() => { if (P.on) { P.paused = true; updatePlayerUi(); } });
    if (S.follow !== false && ayahPage[key] && visiblePages(cur).indexOf(ayahPage[key]) < 0) goPage(ayahPage[key], { keepScroll: false });
    redrawMarks(); updatePlayerUi(); mediaSession();
    const nk = P.phase === 'basm' ? key : P.list[P.i + 1]; if (nk) { const [s2, a2] = nk.split(':').map(Number); P.pre.src = AUDIO(S.reciter, s2, a2); }
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
  function stopPlay() { P.on = false; P.key = null; try { P.audio.pause(); } catch (e) {} P.audio.removeAttribute('src'); $('player').hidden = true; redrawMarks(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; }
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
      if (document.body.classList.contains('selmode')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const st = e.target.closest('.stage'); if (!st) return;
      cancelPress();
      const pr = { x: e.clientX, y: e.clientY, st, fired: false };
      pr.timer = setTimeout(() => { if (press === pr) { pr.fired = true; openFromPress(st, pr.x, pr.y); } }, 450);
      press = pr;
    });
    sp.addEventListener('pointermove', (e) => { if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) cancelPress(); });
    sp.addEventListener('pointerup', (e) => {
      if (!press) return; const pr = press; press = null; clearTimeout(pr.timer);
      if (pr.fired || Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 12) return;
      openFromPress(pr.st, e.clientX, e.clientY);
    });
    sp.addEventListener('pointercancel', cancelPress);
    sp.addEventListener('contextmenu', (e) => { if (!document.body.classList.contains('selmode')) e.preventDefault(); });
    $('selDone').onclick = endSelMode;
    let sw = null; const main = $('main');
    main.addEventListener('touchstart', (e) => { if (e.touches.length === 1) sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; else sw = null; }, { passive: true });
    main.addEventListener('touchend', (e) => {
      if (!sw || !e.changedTouches.length) return; const t = e.changedTouches[0]; const dx = t.clientX - sw.x, dy = t.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
      const s1 = window.getSelection && window.getSelection(); if (s1 && !s1.isCollapsed) return;
      if (document.body.classList.contains('selmode')) return;
      if (window.visualViewport && window.visualViewport.scale > 1.05) return;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && dt < 600) step(dx > 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('copy', (e) => {
      const s1 = window.getSelection && window.getSelection(); if (!s1 || s1.isCollapsed) return;
      const a = s1.anchorNode && (s1.anchorNode.nodeType === 1 ? s1.anchorNode : s1.anchorNode.parentElement);
      if (!a || !a.closest || !a.closest('.tl')) return;
      const t = String(s1).replace(/\s+/g, ' ').trim(); if (t && e.clipboardData) { e.clipboardData.setData('text/plain', t); e.preventDefault(); }
    });
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const n = document.querySelectorAll('.stage').length; if (n !== visiblePages(cur).length) render(); else document.querySelectorAll('.stage').forEach(fitStage); }, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll('.stage').forEach(fitStage));
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
  window.__lab = { wordsOf, normalize, keysBetween, citeRange, visiblePages, quarterLabel, get state() { return { cur, P, S }; }, ayahSheet, savedSheet, searchSheet, runSearch, indexSheet, goSheet, settingsSheet, playFrom, stopPlay, toggleBookmark, findBookmark, rangeSheet, closeSheet, render, goPage, exportCsv };
})();
