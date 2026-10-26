/* Treasure Journey: event-driven Kunuz screens. No film timeline controls game state. */
(function mountJourney(global) {
  'use strict';
  if (global.KunuzThemeBoot?.status === 'fallback') return;
  // Head scripts are ready before the large bank download. Mount as soon as
  // the parser creates the body, while leaving legacy markup/scripts in place.
  if (!document.body) {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect(); mountJourney(global);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return;
  }
  const Model = global.KunuzModel, Icons = global.KunuzIcons, Motion = global.EzikMotion;
  const path = location.pathname;
  const game = path.includes('quest-ghaws') ? 'ghaws' : path.includes('quest-harb') ? 'harb' : path.includes('quest-test') ? 'test' : path.includes('quest-board') ? 'board' : path.includes('hanna-laha') ? 'hanna' : 'hub';
  const hasRooms = game === 'hanna' || game === 'harb' || game === 'board';
  const roomCategoryIds = new Set(global.KunuzRoomCategoryIds || []);
  const usesRoomBank = () => (game === 'hanna' || game === 'harb') && M.settings.room;
  const roomCategorySupported = c => roomCategoryIds.has(global.DATA.cats[c]?.[0]);
  const entryHistory = hasRooms ? history.state : null;
  const names = { hub: 'كنوز المعرفة', ghaws: 'الغوص', harb: 'حرب الجزر', test: 'اختبر معلوماتك', board: 'تحدّي الفئات', hanna: 'حنّا لها' };
  const limits = { ghaws: [1, 6], harb: [2, 4], test: [1, 4], board: [2, 4], hanna: [2, 10] };
  const colors = ['#2482a4', '#cb785e', '#7b66c7', '#25856c', '#aa791e', '#b34b81', '#397889', '#88633e', '#555aa0', '#718047', '#a54347', '#715b89'];
  const defaults = ['الموج', 'الشروق', 'الأفق', 'المدى', 'النور', 'الندى', 'الذهب', 'الفضة', 'السحاب', 'الواحة', 'المرسى', 'الشاطئ'];
  // Shipped Hanna LIMITS accepts 4–6 ASCII digits; its automatic draw is 4 digits.
  const roomCodeLimits = { min: 4, max: 6, random: 4 };
  const roomDigits = value => String(value).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '');
  const catColors = ['#2a8e84', '#628c6b', '#437e9f', '#98714d', '#8c6f9d', '#b46c54'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  // Keep the sign before Arabic digits independently of surrounding RTL prose.
  const score = (n, delta = false) => '<bdi dir="ltr">' + (n < 0 ? '−' : delta && n > 0 ? '+' : '') + ar(Math.abs(n)) + '</bdi>';
  function arabicSource(value) {
    const decoder = document.createElement('textarea'); decoder.innerHTML = String(value || '');
    const text = decoder.value.trim(), letters = [...text].filter(c => /\p{L}/u.test(c));
    return letters.length && letters.every(c => /\p{Script_Extensions=Arabic}/u.test(c)) && !/:\/\/|www\.|\S+\.[\p{L}]{2,}|@/u.test(text) ? text : '';
  }
  function renderExplanation(node, q) {
    // Presentation copy only: retain every original source in DATA and room payloads.
    const display = Object.assign(q.slice(), { kzPack: q.kzPack }); display[7] = arabicSource(q[7]);
    if (!global.KZV?.explain(node, display)) node.innerHTML = q[6] + (display[7] ? '<span class="src">' + esc(display[7]) + '</span>' : '');
  }
  const sym = i => Icons.symbol(i);
  const categoryMeta = c => Model.catalog()[c] || { slug: '', name: '' };
  const catIcon = c => Icons.category(categoryMeta(c).slug, c);
  const catName = c => categoryMeta(c).name;
  const teamNew = i => ({ n: defaults[i], c: colors[i], symbol: i, score: 0, shows: 2 });
  const M = {
    game, ready: false, step: game === 'hub' ? 0 : 1, stage: game === 'hub' ? 'hub' : 'loading', cats: [], teams: [],
    settings: { options: 'shown', reveals: 2, time: 30, customTime: 25, custom: false, difficulty: game === 'board' || game === 'hanna' ? 'points' : 'mixed', cap: 10, shots: 1, flags: 2, customFlags: false, customFlagsValue: 12, win: 2, room: false, roomCode: '' },
    slots: [], pool: [], used: new Set(), question: null, g: null, error: '', dialog: null, running: false,
    fallback: [], excluded: [], questionHistory: false, skipPop: false, lastStage: '', warMessage: '', warEvent: null, diveNative: null,
    result: null, audioUnlocked: false, muted: false, timer: null, lastAction: -Infinity, offlineReady: false,
    pendingStartupAction: '',
    quizCount: 5, quizCustomCount: false, quizCountDraft: '', quizTimeDraft: '', quizAdvance: null, quizPausedAt: null, quizLastQuestion: null, roomDraft: '', roomCodeError: '', roomStartError: '',
    roomCodeEntry: false, joinDraft: '', joinError: '', roomFromEntry: false, homeNotice: null, roomClosedNotice: '', homePurchasesApplicable: false, joinOnly: false
  };
  let boardRooms = null, activeScreenMotion = null;
  if (game !== 'hub') M.teams = Array.from({ length: limits[game][0] }, (_, i) => teamNew(i));
  try { M.muted = localStorage.getItem('kunuz_journey_muted_v1') === '1'; } catch (_) {}
  const app = document.createElement('div'); app.className = 'journey-app'; app.dataset.game = game;
  document.body.classList.add('ezik-treasure-theme'); document.body.append(app);
  const themeMeta = document.querySelector('meta[name="theme-color"]'); if (themeMeta) themeMeta.content = '#082c38';
  const OFFLINE_VERSION = '20261026-kfix2';
  const THEME_VERSION = OFFLINE_VERSION;
  const IAP_HOST_RESUME_KEY = 'kunuz_iap_host_resume_v1';
  const IAP_EXPIRED_NOTICE_KEY = 'kunuz_iap_expired_notice_v1';
  const themeAsset = file => '/quest-theme/' + file + '?v=' + THEME_VERSION;
  const soundCache = new Map();
  const warmedImages = [];
  function cancelVisuals() {
    Motion?.cancelAll();
    if (M.bubbleFrame) cancelAnimationFrame(M.bubbleFrame); M.bubbleFrame = 0;
    if (M.pearlAnimation) M.pearlAnimation.cancel(); M.pearlAnimation = null;
  }
  function animateBubbles() {
    if (M.stage !== 'dive' || M.dialog || document.hidden || Motion?.reducedMotion) return;
    const nodes = [...app.querySelectorAll('[data-bubble]')], start = performance.now();
    function step(now) {
      if (M.stage !== 'dive' || M.dialog || document.hidden || !nodes[0]?.isConnected) { M.bubbleFrame = 0; return; }
      const t = (now - start) / 1000;
      nodes.forEach((node, i) => { node.style.bottom = 10 + (t * 20 + i * 43) % 220 + 'px'; node.style.opacity = .3 + Math.sin(i + t) * .15; });
      M.bubbleFrame = requestAnimationFrame(step);
    }
    M.bubbleFrame = requestAnimationFrame(step);
  }
  function hasKunuzController() { return !!navigator.serviceWorker.controller?.scriptURL.endsWith('/quest-sw.js'); }
  async function waitForKunuzController() {
    if (hasKunuzController()) return true;
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(hasKunuzController()); };
      const changed = () => { if (hasKunuzController()) finish(); };
      const timeout = setTimeout(finish, 5000);
      navigator.serviceWorker.addEventListener('controllerchange', changed);
    });
  }
  async function prepareOffline() {
    if (!('serviceWorker' in navigator)) return;
    try {
      if (location.pathname === '/hanna-laha') history.replaceState(history.state, '', '/hanna-laha/');
      M.offlineReady = true;
      // Prepare both Kunuz scopes during the first online visit, so an offline
      // navigation can open Hanna too. The Ezik root registration is untouched.
      for (const scope of ['/quest', '/hanna-laha/']) {
        const registration = await navigator.serviceWorker.register('/quest-sw.js', { scope, updateViaCache: 'none' });
        const worker = registration.installing || registration.waiting || registration.active;
        if (!worker) { M.offlineReady = false; continue; }
        if (worker.state !== 'activated') await new Promise(resolve => {
          worker.addEventListener('statechange', () => { if (worker.state === 'activated' || worker.state === 'redundant') resolve(); });
        });
        if (worker.state !== 'activated') M.offlineReady = false;
      }
      if (M.offlineReady) M.offlineReady = await waitForKunuzController();
      if ((hasRooms || game === 'test') && M.offlineReady) {
        // These two entry pages version their new screens independently. Cache
        // them after the first worker takes control, including a first visit.
        const screenVersion = OFFLINE_VERSION;
        const screenAssets = ['theme.css?v=' + screenVersion, 'journey.js?v=' + screenVersion, 'room-categories.js?v=' + screenVersion, 'assets/regular.ttf?v=20261020-flash4', 'assets/bold.ttf?v=20261020-flash4'];
        if (game === 'board') screenAssets.push('board-rooms.js?v=' + screenVersion);
        if (navigator.serviceWorker.controller) await Promise.all(screenAssets.map(async file => {
          const response = await fetch('/quest-theme/' + file);
          if (!response.ok) throw new Error('Screen cache unavailable');
          await response.arrayBuffer();
        }));
        else M.offlineReady = false;
      }
    } catch (_) {
      try {
        const registrations = await Promise.all(['/quest.html', '/hanna-laha/'].map(url => navigator.serviceWorker.getRegistration(url)));
        M.offlineReady = registrations.every(registration => registration?.active?.scriptURL.endsWith('/quest-sw.js'));
      } catch (_) { M.offlineReady = false; }
      if (M.offlineReady) M.offlineReady = await waitForKunuzController();
    }
  }
  async function warmLocalAssets() {
    const geometry = new Promise(resolve => {
      if (global.KUNUZ_GEO) return resolve();
      const script = document.createElement('script'); script.src = '/quest-data/kunuz-geo.js'; script.onload = resolve; script.onerror = resolve; document.head.append(script);
    });
    const sources = new Set([themeAsset('assets/ocean-clean.webp'), themeAsset('assets/islands.webp')]);
    if (global.DATA) global.DATA.qs.forEach(q => { if (q.kzPack?.vis?.kind === 'photo') sources.add('/' + q.kzPack.vis.src); });
    const images = [...sources].map(src => new Promise(resolve => { const img = new Image(); warmedImages.push(img); img.onload = resolve; img.onerror = resolve; img.src = src; }));
    for (const name of ['tap', 'success', 'swoosh', 'water-transition', 'bubble']) {
      const audio = new Audio('/quest-theme/audio/' + name + '.wav'); audio.preload = 'auto'; audio.volume = .18; audio.load(); soundCache.set(name, audio);
    }
    await Promise.all([geometry, ...images, document.fonts.load('400 16px KunuzPlex'), document.fonts.load('700 16px KunuzPlex')]);
  }
  function sound(name) {
    if (M.muted || !M.audioUnlocked || !['tap', 'success', 'swoosh', 'water-transition', 'bubble'].includes(name)) return;
    let audio = soundCache.get(name);
    if (!audio) { audio = new Audio('/quest-theme/audio/' + name + '.wav'); audio.volume = .18; soundCache.set(name, audio); }
    audio.currentTime = 0; audio.play().catch(() => {});
  }
  function stopSounds() { soundCache.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
  function button(label, action, className = 'j-btn', attrs = '') {
    if (game === 'hub' && action === 'iap-purchase' && !M.homePurchasesApplicable) return '';
    return '<button type="button" class="' + className + '" data-action="' + action + '" ' + attrs + '>' + label + '</button>';
  }
  function chips(items, current, field) {
    return '<div class="j-chips">' + items.map(([value, label]) => button(esc(label), 'setting', 'j-chip', 'data-field="' + field + '" data-value="' + esc(value) + '" aria-pressed="' + (String(current) === String(value)) + '"')).join('') + '</div>';
  }
  function header() {
    const audioIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>' + (M.muted ? '<path d="m17 9 5 6m0-6-5 6"/>' : '<path d="M17 8q5 4 0 8M16 11q2 1 0 2"/>') + '</svg>';
    return '<header class="j-header">' + (game !== 'hub' ? button('›', 'back', 'j-icon-btn j-back', 'aria-label="رجوع"') : '') + (game === 'hub' ? '<div class="j-brand">عزك<small>كنوز المعرفة</small></div>' : '<h1>' + names[game] + '</h1>') + (M.running && game !== 'test' && game !== 'hanna' ? '<span class="j-counter" aria-label="تقدم اللعب">' + ar(played()) + ' من ' + ar(M.slots.length || M.pool.length) + '</span>' : '') + button(audioIcon, 'mute', 'j-icon-btn', 'aria-label="' + (M.muted ? 'تشغيل الصوت' : 'كتم الصوت') + '" aria-pressed="' + !M.muted + '"') + button(Icons.icon('home'), 'home', 'j-icon-btn', 'aria-label="الرئيسية"') + '</header>';
  }
  function stepper() {
    if (!M.step || M.stage === 'results' || M.stage === 'room-code' || game === 'test' || game === 'hanna' && M.running) return '';
    return '<nav class="j-stepper" aria-label="خطوات اللعبة">' + ['الفئات', 'الفرق والإعدادات', 'اللعب'].map((text, i) => '<span' + (M.step === i + 1 ? ' aria-current="step"' : '') + '>' + ar(i + 1) + ' ' + text + '</span>').join('<span aria-hidden="true">·</span>') + '</nav>';
  }
  function homeNoticeMarkup() {
    const notice = M.homeNotice;
    if (!notice) return '';
    let copy = '';
    if (notice.kind === 'sign-in') copy = 'سجّل الدخول لتبدأ أسبوعك المجاني في الألعاب.';
    else if (notice.kind === 'expired') copy = 'انتهى أسبوعك المجاني للألعاب. الأسعار تحت زر «اشتر لعبة».';
    else if (notice.kind === 'pass-expired') copy = 'انتهى اشتراكك في ألعاب كنوز المعرفة. الأسعار تحت زر «اشتر لعبة».';
    else if (notice.kind === 'trial') {
      const days = Math.max(1, Number(notice.trial?.daysLeft) || 7);
      const remaining = days === 1 ? 'تنتهي تجربتك المجانية اليوم.' : 'متبقّي ' + ar(days) + ' أيام.';
      copy = 'ألعاب كنوز المعرفة مجانية لك لمدة ٧ أيام (' + remaining + ') ما زلنا نحسّن الألعاب. بعد الأسبوع، يلزم اشتراك أسبوع أو شهر أو سنة لدخول أي لعبة. الأسعار تحت زر «اشتر لعبة».';
    }
    if (!copy) return '';
    return '<aside class="j-form-card j-iap-notice" role="status"><p class="j-note">' + esc(copy) + '</p><div class="j-actions">' + button('إخفاء', 'dismiss-home-notice', 'j-secondary') + '</div></aside>';
  }
  function home() {
    return '<div class="j-home-heading"><h1>وين مغامرتك اليوم؟</h1>' + button('اشتر لعبة', 'iap-purchase', 'j-btn j-home-buy') + '<p>العب، تعلّم… واكتشف كنزك القادم.</p></div>' + (M.roomClosedNotice ? '<p class="j-error" role="alert">' + esc(M.roomClosedNotice) + '</p>' : '') + homeNoticeMarkup() +
      '<a class="j-featured" href="/quest-ghaws.html" data-game-entry="ghaws" data-game-path="/quest-ghaws.html"><img src="/quest-theme/assets/ocean-clean.webp?v=20261021-room1" alt="مشهد البحر وصندوق الكنوز"><div class="j-info"><span class="j-tag">رحلة في الأعماق</span><h2>الغوص</h2><p>كل إجابة… تنزلك أعمق.</p><span class="j-btn">ابدأ الغوص ←</span></div></a>' +
      '<div class="j-games">' + [
        ['harb', '/quest-harb.html', 'مع الربع', 'افتحوا الجزر بمعرفتكم', 'map'],
        ['test', '/quest-test.html', 'فردي أو فرق', 'تحدٍّ جديد في كل سؤال', 'compass'],
        ['board', '/quest-board.html', 'تحدّي الفرق', 'اختاروا الفئة والنقاط', 'cards'],
        ['hanna', '/hanna-laha/', 'حماس الجمعة', 'تتوقّع… ولا قدّها؟', 'bolt']
      ].map(([kind, url, tag, line, icon]) => '<a class="j-game-card j-card-' + (kind === 'harb' ? 'island' : kind) + '" href="' + url + '" data-game-entry="' + kind + '" data-game-path="' + url + '">' + (kind === 'harb' ? '<img src="/quest-theme/assets/islands.webp?v=20261021-room1" alt="خريطة جزر الكنوز">' : Icons.icon(icon)) + '<span class="j-tag">' + tag + '</span><h2>' + names[kind] + '</h2><p>' + line + '</p></a>').join('') + '</div>';
  }
  function setHomeNotice(notice, purchaseApplicable) {
    const becameApplicable = purchaseApplicable === true && !M.homePurchasesApplicable;
    if (typeof purchaseApplicable === 'boolean') M.homePurchasesApplicable = purchaseApplicable;
    const maybeAutoOpenPurchase = () => {
      if (becameApplicable && new URLSearchParams(location.search).get('iap_purchase') === '1') global.ezikIapOpenPurchase?.();
    };
    if (notice?.kind === 'trial' && notice.trial && notice.trial.active === false) {
      try {
        if (sessionStorage.getItem(IAP_EXPIRED_NOTICE_KEY) === '1') { M.homeNotice = null; render(); maybeAutoOpenPurchase(); return; }
        sessionStorage.setItem(IAP_EXPIRED_NOTICE_KEY, '1');
      } catch (_) {}
      notice = { kind: 'expired' };
    } else if (notice?.kind === 'pass-expired') {
      try {
        if (sessionStorage.getItem(IAP_EXPIRED_NOTICE_KEY) === '1') { M.homeNotice = null; render(); maybeAutoOpenPurchase(); return; }
        sessionStorage.setItem(IAP_EXPIRED_NOTICE_KEY, '1');
      } catch (_) {}
    }
    M.homeNotice = notice || null;
    render();
    maybeAutoOpenPurchase();
  }
  function saveHostResume() {
    try {
      sessionStorage.setItem(IAP_HOST_RESUME_KEY, JSON.stringify({
        version: 1, game, path: location.pathname, cats: M.cats, teams: M.teams, settings: M.settings,
      }));
    } catch (_) {}
  }
  function beginHostEntry() {
    saveHostResume();
    if (typeof global.ezikIapCheckHostAccess !== 'function') {
      M.error = 'تعذّر التحقق من رصيد الحساب. أعدوا تحميل الصفحة.'; render(); return;
    }
    const allowed = () => {
      try { sessionStorage.removeItem(IAP_HOST_RESUME_KEY); } catch (_) {}
      M.settings.room = true; M.error = '';
      if (game === 'hanna') openRoomCode(); else setStage('categories', 1, true);
    };
    Promise.resolve(global.ezikIapCheckHostAccess(game, allowed)).catch(() => {
      M.error = 'تعذّر التحقق من رصيد الحساب الآن. حاولوا مرة أخرى.'; render();
    });
  }
  function restoreHostResume() {
    let draft;
    try { draft = JSON.parse(sessionStorage.getItem(IAP_HOST_RESUME_KEY) || 'null'); } catch (_) {}
    if (!draft || draft.version !== 1 || draft.game !== game || draft.path !== location.pathname
      || !Array.isArray(draft.cats) || draft.cats.length < 3 || draft.cats.length > 6
      || !draft.cats.every(c => Number.isInteger(c) && global.DATA.cats[c])
      || !Array.isArray(draft.teams) || draft.teams.length < limits[game][0] || draft.teams.length > limits[game][1]
      || !draft.settings || typeof draft.settings !== 'object') return false;
    M.cats = draft.cats.slice();
    M.teams = draft.teams.map((t, i) => ({ ...teamNew(i), n: String(t.n || defaults[i]), c: colors.includes(t.c) ? t.c : colors[i], symbol: Number.isInteger(t.symbol) ? t.symbol % 6 : i }));
    for (const key of Object.keys(M.settings)) if (typeof draft.settings[key] === typeof M.settings[key]) M.settings[key] = draft.settings[key];
    return true;
  }
  function categories() {
    const roomBank = usesRoomBank();
    const all = Model.categories().filter(c => (c.count === null || c.count >= Model.PER_CATEGORY) && (!roomBank || roomCategorySupported(c.index)));
    function section(list, title) {
      return '<h2 class="j-divider">' + title + '</h2><div class="j-category-picker">' + list.map(c => {
        const selected = M.cats.includes(c.index), disabled = !selected && M.cats.length >= 6;
        return button(catIcon(c.index) + '<b>' + esc(c.name) + '</b><small>' + (selected ? '✓ تم الاختيار' : disabled ? 'وصلتم للحد الأعلى' : 'اختيار الفئة') + '</small>', 'cat', 'j-cat-pick', 'data-cat="' + c.index + '" aria-pressed="' + selected + '"' + (disabled ? ' disabled' : ''));
      }).join('') + '</div>';
    }
    return '<h1 class="j-heading">اختاروا فئات مغامرتكم</h1>' +
      (roomBank ? '<p class="j-note">بعض الفئات تُلعب على جهاز واحد فقط، فلا تظهر في الغرف.</p>' : '') + '<p class="j-lead">اختاروا من ثلاث إلى ست فئات. كل فئة بطاقتها الخاصة.</p>' +
      (M.error ? '<div class="j-error" role="alert">' + esc(M.error) + '</div>' : '') +
      section(all.filter(c => c.index < 53), 'من كنوز المعرفة') + (roomBank ? '' : section(all.filter(c => c.index >= 53), 'فئات إضافية')) +
      '<p class="j-note" role="status">' + (M.cats.length >= 6 ? 'وصلتم للحد الأعلى؛ أزيلوا اختيارًا لتختاروا فئة أخرى.' : M.cats.length < 3 ? 'اختاروا ثلاث فئات على الأقل للمتابعة.' : 'فئاتكم جاهزة؛ تقدرون تتابعون.') + '</p>' +
      '<div class="j-actions">' + button('التالي', 'next-setup', 'j-btn', M.cats.length < 3 ? 'disabled' : '') + '</div>';
  }
  function savedWarRoom() {
    if (game !== 'harb') return null;
    const saved = global.rmSaved?.(), credential = saved?.host ? saved.hostToken : saved?.teamToken;
    return saved && /^\d{6}$/.test(String(saved.code)) && typeof saved.roomId === 'string' && (typeof credential === 'string' && credential || !saved.host && saved.watch === true) ? saved : null;
  }
  function roomEntry() {
    const choices = M.joinOnly
      ? [['join-room', 'compass', 'الانضمام إلى غرفة', 'عندكم رقم غرفة جاهز']]
      : [
        ['create-room', 'home', 'إنشاء غرفة', 'تفتحون غرفة وكل واحد يدخل بجواله'],
        ['join-room', 'compass', 'الانضمام إلى غرفة', 'عندكم رقم غرفة جاهز'],
        ['single-device', 'cards', 'بدون غرفة', 'اللعب على جهاز واحد']
      ];
    return '<h1 class="j-heading">' + (M.joinOnly ? 'انضموا إلى غرفة' : 'كيف تلعبون؟') + '</h1><p class="j-lead">' + (M.joinOnly ? 'أدخلوا رقم الغرفة للانضمام مجانًا.' : 'اختاروا قبل الفئات') + '</p><div class="j-room-entry-choices">' +
      choices.map(([action, icon, title, description]) => button('<span class="j-room-entry-icon" aria-hidden="true">' + Icons.icon(icon) + '</span><span><b>' + title + '</b><small class="j-muted">' + description + '</small></span>', action, 'j-form-card j-secondary j-room-entry-choice')).join('') + '</div>' +
      (savedWarRoom() ? '<div class="j-actions">' + button('العودة إلى الغرفة المحفوظة', 'resume-room', 'j-secondary') + '</div>' : '') +
      (M.error ? '<p class="j-error" role="alert">' + esc(M.error) + '</p>' : '');
  }
  function roomJoinScreen() {
    return '<h1 class="j-heading">الانضمام إلى غرفة</h1><section class="j-form-card j-room-flow-editor"><label class="j-field" for="j-room-entry-code">رقم الغرفة</label>' +
      '<input id="j-room-entry-code" class="j-input" data-join-draft inputmode="numeric" autocomplete="off" dir="ltr" maxlength="6" value="' + esc(M.joinDraft) + '" aria-invalid="' + !!M.joinError + '" aria-describedby="j-room-entry-help' + (M.joinError ? ' j-room-entry-error' : '') + '">' +
      (M.joinError ? '<p id="j-room-entry-error" class="j-error" role="alert">' + M.joinError + '</p>' : '') +
      '<div class="j-actions">' + button('انضمام', 'join-submit') + '</div><p id="j-room-entry-help" class="j-note">بدون اختيار فئات، فئات الغرفة يحددها صاحبها.</p></section>';
  }
  function openJoin() {
    if (game === 'board') { M.joinError = ''; setStage('room-join', 0, true); return; }
    if (game === 'harb') { M.joinError = ''; setStage('room-join', 0, true); return; }
    if (game !== 'hanna') return;
    // JoinScreen reads the saved phone session, not a URL parameter. Open that
    // existing screen in its own document, preserving this entry for Back.
    history.replaceState({ ...history.state, entryDraft: { cats: M.cats, teams: M.teams, settings: M.settings } }, '');
    location.href = '/hanna-laha/join?rooms=1&entry=1';
  }
  function submitJoin() {
    if (game === 'board') {
      const code = roomDigits(M.joinDraft);
      if (!code) M.joinError = 'اكتب رقم الغرفة'; else if (!/^\d{4,6}$/.test(code)) M.joinError = 'رقم الغرفة من ٤ إلى ٦ خانات';
      else { M.joinError = ''; boardRooms.join(code); return; }
      render(); return;
    }
    const code = roomDigits(M.joinDraft);
    if (!code) M.joinError = 'اكتب رقم الغرفة';
    else if (!/^\d{6}$/.test(code)) M.joinError = 'رقم الغرفة ٦ خانات';
    else { M.joinDraft = code; enterRoom(true); return; }
    render();
  }
  function settings() {
    const s = M.settings, min = limits[game][0], max = limits[game][1];
    const roomMode = hasRooms && s.room;
    const difficulty = game === 'ghaws' ? [['easy', 'سهل'], ['medium', 'متوسط'], ['hard', 'صعب'], ['mixed', 'مختلط']] : game === 'harb' ? [['mixed', 'مختلطة'], ['easy', 'سهلة'], ['medium', 'متوسطة'], ['hard', 'صعبة']] : [['points', 'حسب النقاط'], ['mixed', 'مختلطة']];
    return '<h1 class="j-heading">جهّزوا فريقكم</h1><p class="j-lead">الأسماء والألوان والرموز لكم… وبعدها تبدأ المغامرة.</p>' +
      (hasRooms && (game !== 'board' || s.room) ? '<div class="j-room-entry-change">' + button('تغيير طريقة اللعب', 'change-play-mode', 'j-secondary') + '</div>' : '') +
      (roomMode ? game === 'board' ? boardRooms.card() : roomCard() : '') +
      '<section class="j-form-card"><h2>الفرق</h2>' + M.teams.map((t, i) => '<div class="j-team-row">' + button(sym(t.symbol), 'color', 'j-team-swatch', 'data-team="' + i + '" data-color="' + t.c + '" aria-label="تغيير لون ورمز ' + esc(t.n) + '"') + '<input class="j-input" data-team-name="' + i + '" aria-label="اسم الفريق ' + ar(i + 1) + '" value="' + esc(t.n) + '" maxlength="80">' + button('×', 'remove-team', 'j-icon-btn', 'data-team="' + i + '" aria-label="حذف الفريق"' + (M.teams.length <= min ? ' disabled' : '')) + '</div>').join('') +
      button('إضافة فريق', 'add-team', 'j-secondary', M.teams.length >= max ? 'disabled' : '') + (min === 1 ? '<p class="j-note">اللعب الفردي متاح.</p>' : '') + '</section>' +
      '<section class="j-form-card"><h2>الإعدادات</h2><label class="j-field">الخيارات</label>' + chips([['shown', 'ظاهرة'], ['hidden', 'مخفية']], s.options, 'options') +
      (s.options === 'hidden' ? '<label class="j-field" for="j-reveals">كم مرة تقدر كل فرقة تظهر الخيارات</label><input id="j-reveals" class="j-input" type="number" min="0" step="1" data-input="reveals" value="' + (Number.isFinite(s.reveals) ? s.reveals : '') + '">' : '') +
      '<label class="j-field">الوقت</label>' + chips([[15, ar(15)], [30, ar(30)], [45, ar(45)], [60, ar(60)], ['custom', 'مخصص'], [0, 'بلا وقت']], s.custom ? 'custom' : s.time, 'time') +
      (s.custom ? '<label class="j-field" for="j-time">الوقت بالثواني</label><input id="j-time" class="j-input" type="number" min="0" step="any" data-input="customTime" value="' + (Number.isFinite(s.customTime) ? s.customTime : '') + '">' : '') +
      '<label class="j-field">الصعوبة <span class="j-tag j-gold">تجريبي</span></label>' + chips(difficulty, s.difficulty, 'difficulty') + (game === 'board' || game === 'hanna' ? '<p class="j-note">حسب النقاط: ٢٠٠ سهل · ٤٠٠ متوسط · ٦٠٠ صعب</p>' : '') +
      (game === 'ghaws' ? '<label class="j-field">حد العمق</label>' + chips([5, 7, 10, 15, 20, 30].map(n => [n, ar(n)]), s.cap, 'cap') : '') +
      (game === 'harb' ? '<label class="j-field">رصيد توزيع الرايات بحسب جزر الفريق</label>' + chips([[1, ar(1)], [2, ar(2)], [3, ar(3)], ['custom', 'مخصص']], s.customFlags ? 'custom' : s.flags, 'flags') + (s.customFlags ? '<label class="j-field" for="j-flags">رصيد الرايات لكل فريق</label><input id="j-flags" class="j-input" data-input="customFlagsValue" type="number" min="2" max="60" value="' + (Number.isFinite(s.customFlagsValue) ? s.customFlagsValue : '') + '">' : '') + '<p class="j-note">لكل جزيرة راية حارس، وتوزعون رصيدكم كيف ما تبون.</p><label class="j-field" for="j-shots">أسئلة الهجوم</label><input id="j-shots" class="j-input" data-input="shots" type="number" min="1" max="10" value="' + (Number.isFinite(s.shots) ? s.shots : '') + '"><label class="j-field">شرط الفوز</label>' + chips([[2, 'بحران'], [9, 'الأرخبيل كله']], s.win, 'win') : '') +
      '</section>' +
      (M.error ? '<div class="j-error" role="alert">' + esc(M.error) + '</div>' : '') + '<div class="j-actions">' + button(game === 'board' && roomMode ? boardRooms.busy ? 'نفتح الغرفة…' : 'إنشاء الغرفة' : 'ابدأ اللعب', 'start', 'j-btn', game === 'board' && boardRooms.busy ? 'disabled' : '') + '</div>' +
      (roomMode && M.roomStartError ? '<p class="j-error j-room-flow-start-error" role="alert">' + M.roomStartError + '</p>' : '');
  }
  function roomCard() {
    return '<section class="j-form-card j-room-flow-card" aria-labelledby="j-room-flow-title"><h2 id="j-room-flow-title">الغرفة</h2>' +
      (game === 'harb' ? '<p class="j-note">الرقم تلقائي</p>' :
        (M.settings.roomCode ? '<bdi class="j-room-flow-code j-gold" dir="ltr">' + ar(M.settings.roomCode) + '</bdi>' : '<p class="j-note">لم تُنشأ بعد</p>') +
        '<div class="j-actions">' + button(M.settings.roomCode ? 'تغيير الرقم' : 'إنشاء غرفة', 'room-code-open', 'j-secondary') + '</div>') + '</section>';
  }
  function roomCodeScreen() {
    return '<section class="j-form-card j-room-flow-editor"><label class="j-field" for="j-room-flow-input">رقم الغرفة</label>' +
      '<input id="j-room-flow-input" class="j-input" data-room-draft inputmode="numeric" autocomplete="off" dir="ltr" maxlength="' + roomCodeLimits.max + '" value="' + esc(M.roomDraft) + '" aria-invalid="' + !!M.roomCodeError + '" aria-describedby="j-room-flow-help' + (M.roomCodeError ? ' j-room-flow-error' : '') + '">' +
      (M.roomCodeError ? '<p id="j-room-flow-error" class="j-error" role="alert">' + M.roomCodeError + '</p>' : '') +
      '<div class="j-actions">' + button('رقم عشوائي', 'room-code-random', 'j-secondary') + button('حفظ', 'room-code-save') + '</div>' +
      '<p id="j-room-flow-help" class="j-note">هذا الرقم يدخل به اللاعبون من جوالاتهم.</p></section>';
  }
  function openRoomCode() {
    if (game !== 'hanna' || !['settings', 'room-entry'].includes(M.stage) || !M.settings.room) return;
    M.roomCodeEntry = M.stage === 'room-entry';
    M.roomDraft = M.settings.roomCode; M.roomCodeError = ''; M.roomStartError = '';
    setStage('room-code', M.roomCodeEntry ? 0 : 2, true);
  }
  function saveRoomCode() {
    const code = roomDigits(M.roomDraft);
    if (!code) M.roomCodeError = 'اكتب رقمًا أو اختر رقمًا عشوائيًا';
    else if (code.length < roomCodeLimits.min || code.length > roomCodeLimits.max) M.roomCodeError = 'الرقم ' + ar(roomCodeLimits.min) + '–' + ar(roomCodeLimits.max) + ' خانات';
    else { M.settings.roomCode = code; M.roomStartError = ''; if (M.roomCodeEntry) setStage('categories', 1, true); else history.back(); return; }
    render();
  }
  function teamBar(duel = false) {
    const turn = actor();
    return '<div class="j-teambar' + (duel ? ' j-duel' : '') + '">' + M.teams.map((t, i) => '<div class="j-team" data-team-color="' + i + '" aria-current="' + (i === turn) + '"><b>' + sym(t.symbol) + '<bdi>' + esc(t.n) + '</bdi></b><strong>' + score(teamScore(i)) + '</strong><small>' + (i === turn ? 'دوركم الآن' : 'استعدّوا للتحدّي') + '</small></div>').join('') + '</div>';
  }
  function teamScore(i) { return game === 'harb' && M.g ? global.WarEngine.count(M.g, i) : game === 'ghaws' ? M.teams[i].p || 0 : M.teams[i].score; }
  function actor() { return game === 'ghaws' ? global.S?.pi || 0 : M.g?.turn || 0; }
  function played() { return ['board', 'test', 'hanna'].includes(game) ? M.slots.filter(s => s.used).length : M.used.size; }
  function boardView() {
    if (game === 'hanna') return hannaCategories();
    return teamBar() + '<div class="j-board-title"><h2>اختاروا فئتكم… والنقاط</h2><p>دور «' + esc(M.teams[actor()].n) + '»</p></div><div class="j-board-grid">' + M.cats.map((c, p) => {
      const slots = M.slots.map((s, i) => ({ s, i })).filter(x => x.s.cat === c);
      const col = start => '<div class="j-point-col">' + slots.slice(start, start + 3).map(({ s, i }) => button(s.used ? (Array.isArray(s.by) ? s.by.map(t => sym(M.teams[t].symbol)).join('') || '—' : s.by >= 0 ? sym(M.teams[s.by].symbol) : '—') : ar(s.pts), 'tile', 'j-point' + (s.used ? ' j-used' : ''), 'data-slot="' + i + '" aria-label="' + esc(catName(c)) + '، ' + ar(s.pts) + (s.used ? '، لُعبت' : ' نقطة') + '"' + (s.used ? ' disabled' : ''))).join('') + '</div>';
      return '<section class="j-board-category" data-category-color="' + p + '">' + col(0) + '<div class="j-category-middle">' + catIcon(c) + '<h3>' + esc(catName(c)) + '</h3></div>' + col(3) + '</section>';
    }).join('') + '</div><div class="j-actions">' + button('الفرق والإعدادات', 'leave', 'j-secondary') + '</div>';
  }
  function hannaCategories() {
    const pointOrder = [600, 600, 400, 400, 200, 200];
    return '<section class="j-hanna-list"><div class="j-board-title j-hanna-board-heading"><h2>لوحة حنّا لها</h2><p class="j-hanna-turn-badge" role="status">دور ' + esc(M.teams[actor()].n) + '</p></div><div class="j-hanna-board-scroll" role="region" aria-label="لوحة فئات حنّا لها" tabindex="0"><div class="j-hanna-board-grid">' + M.cats.map((c, p) => {
      const slots = M.slots.map((slot, i) => ({ slot, i })).filter(entry => entry.slot.cat === c);
      const ordered = [600, 400, 200].flatMap(points => slots.filter(entry => entry.slot.pts === points));
      const cells = pointOrder.map((points, i) => {
        const entry = ordered[i], slot = entry?.slot, slotIndex = entry?.i;
        if (!slot) return '';
        const label = esc(catName(c)) + ' ، ' + ar(points) + ' نقطة' + (slot.used ? ' ، مستخدم' : '');
        return button(slot.used ? '✓' : ar(points), 'tile', 'j-hanna-cell' + (slot.used ? ' j-used' : ''), 'data-slot="' + slotIndex + '" aria-label="' + label + '"' + (slot.used ? ' disabled' : ''));
      }).join('');
      return '<section class="j-hanna-column" data-cat="' + c + '" data-category-color="' + p + '"><header class="j-hanna-column-head">' + catIcon(c) + '<h3>' + esc(catName(c)) + '</h3></header><div class="j-hanna-column-cells">' + cells + '</div></section>';
    }).join('') + '</div></div>' + teamBar() + '<div class="j-actions">' + button('إنهاء الجولة', 'leave', 'j-secondary') + '</div></section>';
  }

  function shownOptions(q) { return M.settings.options === 'shown' || q.showTeams.has(q.activeTeam ?? q.actor) || q.answerRevealed; }
  function questionText(q) { return global.DATA.qs[q.index]; }
  function meta(q) { return '<span class="j-tag">' + esc(catName(questionText(q)[0])) + ' • ' + (q.slotIndex !== undefined ? ar(M.slots[q.slotIndex].pts) + ' نقطة' : 'دور ' + esc(M.teams[q.actor].n)) + '</span>' + (M.settings.options === 'hidden' ? ' <span class="j-tag">إظهار الخيارات: ' + ar(M.teams[q.activeTeam ?? q.actor].shows) + '</span>' : ''); }
  function answers(q, host = false) {
    const data = questionText(q);
    if (!shownOptions(q)) return '';
    return '<div class="j-answers">' + data[4].map((answer, i) => {
      const selected = q.selected === i, right = q.answerRevealed && data[5] === i;
      const className = 'j-answer' + (selected ? ' j-picked' : '') + (right ? ' j-correct' : q.answerRevealed && selected ? ' j-wrong' : '');
      return '<div class="j-answer-row">' + button('<span data-choice="' + i + '">' + esc(answer) + '</span><span class="j-letter">' + (right ? '✓' : ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][i]) + '</span>', 'answer', className, 'data-answer="' + i + '" aria-pressed="' + selected + '"' + (q.settled || q.answerRevealed || q.burned.has(i) || game === 'hanna' && !q.confidence ? ' disabled' : '')) +
        (selected && !host && !q.settled && !q.answerRevealed && game === 'hanna' ? button('تأكيد', 'confirm-answer', 'j-confirm') : '') + '</div>';
    }).join('') + '</div>';
  }
  function timerMarkup(q) { return '<div class="j-timer"><i data-timer-bar></i></div><div class="j-timer-text" data-timer-text>' + (q.duration ? ar(Math.ceil(q.duration / 1000)) + ' ثانية' : 'بلا وقت') + '</div>'; }
  function optionsButton(q) {
    if (shownOptions(q) || q.settled || q.answerRevealed) return '';
    const team = M.teams[q.activeTeam ?? q.actor];
    return button('أظهر الخيارات <small>باقي لكم ' + ar(team.shows) + '</small>', 'show-options', 'j-secondary', team.shows <= 0 ? 'disabled' : '');
  }
  function explanation(q) {
    if (!q.answerRevealed) return '';
    return '<div class="j-explanation" data-explanation></div>';
  }
  function boardQuestion() {
    const q = M.question;
    return '<div class="j-modal" role="dialog" aria-modal="true" aria-label="سؤال الفئة"><div class="j-modal-frame">' + header() + '<div class="j-paper" data-motion="board">' + meta(q) + '<h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + answers(q, true) + timerMarkup(q) + '<p class="j-muted">تشاوروا… والقرار لكم</p>' +
      (q.answerRevealed ? explanation(q) + '<div class="j-actions">' + M.teams.map((t, i) => button(sym(t.symbol) + esc(t.n), 'award', 'j-btn j-teal', 'data-team="' + i + '" data-team-color="' + i + '"')).join('') + button('ولا أحد', 'award', 'j-secondary', 'data-team="-1"') + '</div>' : '<div class="j-actions">' + optionsButton(q) + button('إظهار الإجابة', 'reveal-answer', 'j-btn j-teal') + '</div>') + '</div></div></div>';
  }
  function quizStart() {
    return '<section class="j-quiz-setup"><h1 class="j-heading">جهّزوا الاختبار</h1><p class="j-lead">اختاروا الوقت وعدد الأسئلة وطريقة الإجابة.</p>' +
      '<fieldset class="j-form-card j-quiz-setting"><legend class="j-field">الوقت لكل سؤال</legend>' + chips([0, 10, 15, 20, 30, 45, 60].map(n => [n, n ? ar(n) + ' ثانية' : 'بلا حد']).concat([['custom', 'وقت مخصص']]), M.settings.custom ? 'custom' : time(), 'time') + quizNumberField('time', 'اكتب بالثواني', M.quizTimeDraft) + '</fieldset>' +
      '<fieldset class="j-form-card j-quiz-setting"><legend class="j-field">عدد الأسئلة</legend><div class="j-chips">' + quizCounts().map(count => button(ar(count), 'quiz-count', 'j-chip', 'data-count="' + count + '" aria-pressed="' + (!M.quizCustomCount && M.quizCount === count) + '"')).join('') + '</div>' + quizNumberField('count', 'اكتب عددًا', M.quizCountDraft) + '</fieldset>' +
      '<fieldset class="j-form-card j-quiz-setting"><legend class="j-field">الصعوبة <span class="j-tag j-gold">تجريبي</span></legend>' + chips([['easy', 'سهل'], ['medium', 'متوسط'], ['hard', 'صعب'], ['mixed', 'مختلط']], M.settings.difficulty, 'difficulty') + '</fieldset>' +
      '<fieldset class="j-form-card j-quiz-setting"><legend class="j-field">طريقة الإجابة</legend>' + button('إظهار الاختيارات <span aria-hidden="true">' + (M.settings.options === 'shown' ? '✓' : '—') + '</span>', 'quiz-options', 'j-chip j-quiz-toggle', 'role="switch" aria-checked="' + (M.settings.options === 'shown') + '" aria-label="إظهار الاختيارات" aria-pressed="' + (M.settings.options === 'shown') + '"') + '</fieldset>' +
      (M.error ? '<div class="j-error" role="alert">' + esc(M.error) + '</div>' : '') + '<div class="j-actions">' + button('ابدأ', 'quiz-start', 'j-btn', !quizCounts().length ? 'disabled' : '') + '</div></section>';
  }
  function quizCatalog() {
    if (!Array.isArray(global.DATA?.qs)) return Model.categories().map(c => ({ ...c, count: null }));
    const counts = global.DATA.cats.map(() => 0);
    global.DATA.qs.forEach((q, i) => { if (Model.live(i) && q[4].length === 4) counts[q[0]]++; });
    return Model.categories().map(c => ({ ...c, count: counts[c.index] })).filter(c => c.count > 0);
  }
  function quizAvailable() { return quizCatalog().filter(c => M.cats.includes(c.index)).reduce((n, c) => n + c.count, 0); }
  function quizCountError() { return M.quizCustomCount && !/^0*[1-9]\d*$/.test(M.quizCountDraft) ? 'اكتب عددًا أو اختر واحدًا' : ''; }
  function quizTimeError() { return M.settings.custom && (!/^\d+$/.test(M.quizTimeDraft) || +M.quizTimeDraft < 1 || +M.quizTimeDraft > 3600) ? 'اكتب وقتًا من ١ إلى ٣٦٠٠ ثانية' : ''; }
  function quizCountNote() { return !M.ready ? '' : M.quizCustomCount && !quizCountError() && +M.quizCountDraft > quizAvailable() ? 'العدد المختار أكبر من المتاح؛ ستلعب بالأسئلة المتاحة.' : ''; }
  function quizNumberField(kind, label, value) {
    const error = kind === 'count' ? quizCountError() : quizTimeError();
    return '<div class="j-quiz-custom"><label class="j-field" for="j-quiz-' + kind + '">' + label + '</label><input id="j-quiz-' + kind + '" class="j-input" data-quiz-number="' + kind + '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" dir="ltr" value="' + esc(value) + '" aria-invalid="' + !!error + '" aria-describedby="j-quiz-' + kind + '-help"><p id="j-quiz-' + kind + '-help" class="' + (error ? 'j-error' : 'j-note') + '" role="status">' + (error || (kind === 'count' ? quizCountNote() : 'من ١ إلى ٣٦٠٠ ثانية')) + '</p></div>';
  }
  function updateQuizFields() {
    if (M.quizCustomCount && !quizCountError()) M.quizCount = Math.min(Number(M.quizCountDraft), quizAvailable());
    if (M.settings.custom) M.settings.customTime = M.quizTimeDraft === '' ? NaN : +M.quizTimeDraft;
    app.querySelectorAll('[data-action="quiz-count"]').forEach(el => el.setAttribute('aria-pressed', String(!M.quizCustomCount && +el.dataset.count === M.quizCount)));
    app.querySelectorAll('[data-field="time"]').forEach(el => el.setAttribute('aria-pressed', String(M.settings.custom ? el.dataset.value === 'custom' : +el.dataset.value === M.settings.time)));
    for (const kind of ['count', 'time']) {
      const error = kind === 'count' ? quizCountError() : quizTimeError(), input = app.querySelector('[data-quiz-number="' + kind + '"]'), help = app.querySelector('#j-quiz-' + kind + '-help');
      input?.setAttribute('aria-invalid', String(!!error));
      if (help) { help.className = error ? 'j-error' : 'j-note'; help.textContent = error || (kind === 'count' ? quizCountNote() : 'من ١ إلى ٣٦٠٠ ثانية'); }
    }
    saveQuizDraft();
  }
  function quizCounts() {
    if (!M.ready) return M.cats.length ? [5, 10, 15, 20] : [];
    const available = quizCatalog().filter(c => M.cats.includes(c.index)).reduce((n, c) => n + c.count, 0);
    return available < 5 ? available ? [available] : [] : [5, 10, 15, 20].filter(n => n <= available);
  }
  function quizCategories() {
    const all = quizCatalog();
    const section = (list, title) => '<h2 class="j-divider">' + title + '</h2><div class="j-category-picker">' + list.map(c => button(catIcon(c.index) + '<b>' + esc(c.name) + '</b><small>' + (M.cats.includes(c.index) ? '✓ تم الاختيار' : 'اختيار الفئة') + '</small>', 'cat', 'j-cat-pick', 'data-cat="' + c.index + '" aria-pressed="' + M.cats.includes(c.index) + '"')).join('') + '</div>';
    return '<h1 class="j-heading">اختاروا فئات مغامرتكم</h1><p class="j-lead">اختاروا فئة واحدة أو أكثر، أو كل الفئات.</p><div class="j-actions">' + button('كل الفئات', 'quiz-all', 'j-secondary', 'aria-pressed="' + (M.cats.length === all.length) + '"') + button('إلغاء الكل', 'quiz-clear', 'j-secondary') + '</div>' +
      section(all.filter(c => c.index < 53), 'من كنوز المعرفة') + section(all.filter(c => c.index >= 53), 'فئات إضافية') +
      '<div class="j-actions">' + button('التالي', 'next-setup', 'j-btn', 'aria-describedby="j-quiz-categories-help"' + (!M.cats.length ? ' disabled' : '')) + '</div><p id="j-quiz-categories-help" class="j-note j-quiz-category-help" role="status">' + (!M.cats.length ? 'اختاروا فئة واحدة على الأقل للمتابعة.' : 'فئاتكم جاهزة؛ تقدرون تتابعون.') + '</p>';
  }
  function quizQuestion() {
    const q = M.question, completed = played();
    const response = M.settings.options === 'shown' ? answers(q) : q.answerRevealed ? '<p class="j-quiz-self-answer"><span data-choice="' + questionText(q)[5] + '">' + esc(questionText(q)[4][questionText(q)[5]]) + '</span></p>' + (!q.settled ? '<div class="j-actions">' + button('عرفتها', 'judge-yes') + button('ما عرفتها', 'judge-no', 'j-secondary') + '</div>' : '') : '<div class="j-actions">' + button('أظهر الجواب', 'reveal-answer') + '</div>';
    return '<section class="j-quiz-screen"><p class="j-quiz-position">السؤال ' + ar(q.slotIndex + 1) + ' من ' + ar(M.slots.length) + '</p><div class="j-quiz-progress" role="progressbar" aria-label="الأسئلة المكتملة" aria-valuemin="0" aria-valuemax="' + M.slots.length + '" aria-valuenow="' + completed + '"><i style="width:' + completed / M.slots.length * 100 + '%"></i></div><div class="j-paper j-quiz-question"><span class="j-tag">' + esc(catName(questionText(q)[0])) + '</span><h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + response + (q.duration ? timerMarkup(q) : '') + '<p class="j-quiz-feedback" role="status">' + (q.settled ? q.correct ? '✓ صحيح!' : 'خطأ · الجواب الصحيح: ' + esc(questionText(q)[4][questionText(q)[5]]) : '') + '</p></div></section>';
  }
  function quizResults() {
    const correct = M.slots.filter(slot => slot.by >= 0).length;
    return '<section class="j-results j-quiz-results"><div class="j-result-icon">' + Icons.icon('medal') + '</div><h2>نتيجتك</h2><p class="j-quiz-score">' + ar(correct) + ' من ' + ar(M.slots.length) + '</p><div class="j-actions">' + button('العب مرة ثانية', 'quiz-again') + '<a class="j-secondary" href="/quest.html">رجوع</a></div></section>';
  }
  function hannaQuestion() {
    const q = M.question, data = questionText(q), value = M.slots[q.slotIndex].pts;
    const navigation = button('رجوع للقائمة', 'back', 'j-secondary j-hanna-back');
    let content;
    if (q.beat === 'confidence') content = '<div class="j-hanna-summary"><h3>منو قال «حنّا لها»؟</h3>' + M.teams.map((t, i) => '<p>' + esc(t.n) + ' · ' + (q.submissions[i]?.confidence === 'bold' ? 'حنّا لها!' : q.submissions[i] ? 'أتوقّع' : 'ما ثبّت') + '</p>').join('') + '<div class="j-actions">' + button('اكشف الجواب', 'hanna-reveal') + '</div></div>';
    else if (q.beat === 'answer') content = answers({ ...q, selected: q.submissions[q.actor]?.choice ?? null }) + '<div class="j-hanna-summary" role="status"><p>الجواب الصحيح: <b>' + esc(data[4][data[5]]) + '</b></p>' + M.teams.map((t, i) => {
      const a = q.submissions[i];
      return '<div class="j-verdict' + (a?.correct === false ? ' j-no' : '') + '"><b>' + esc(t.n) + '</b> · ' + (!a ? 'لم يثبّت جوابًا' : a.correct === null ? 'الحكم لكم على جوابكم' : a.correct ? '✓ صحيح · ' + score(a.delta, true) : 'خطأ · ' + score(a.delta, true)) + (a && a.correct === null ? '<div class="j-actions">' + button('صح', 'hanna-judge', 'j-btn j-teal', 'data-team="' + i + '" data-right="true"') + button('خطأ', 'hanna-judge', 'j-secondary', 'data-team="' + i + '" data-right="false"') + '</div>' : '') + '</div>';
    }).join('') + '</div>' + explanation(q) + '<div class="j-actions">' + button('التالي', 'question-next', 'j-btn j-teal', Object.values(q.submissions).some(a => a.correct === null) ? 'disabled' : '') + '</div>';
    else content = '<div class="j-hanna-responders">' + M.teams.map((t, i) => button(esc(t.n) + (q.submissions[i] ? ' ✓' : ''), 'hanna-team', 'j-secondary', 'data-team="' + i + '" aria-pressed="' + (q.activeTeam === i) + '"' + (q.submissions[i] ? ' disabled' : ''))).join('') + '</div><p class="j-hanna-prompt">جواب «' + esc(M.teams[q.activeTeam].n) + '» · ثبّتوا بالسر قبل الكشف.</p><div class="j-hanna-confidence" role="group" aria-label="الثقة بالجواب">' + ['safe', 'bold'].map(mode => button('<b>' + (mode === 'bold' ? 'حنّا لها' : 'أتوقّع') + '</b><small>صح: ' + score(Model.hannaDelta(mode, true, value), true) + ' · خطأ: ' + score(Model.hannaDelta(mode, false, value), true) + '</small>', 'confidence', 'j-secondary', 'data-mode="' + mode + '" aria-pressed="' + (q.confidence === mode) + '"')).join('') + '</div>' + answers(q) + timerMarkup(q) + '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) ? button('ثبّتنا جوابنا بصوت عالٍ', 'hanna-manual', 'j-btn j-teal', q.confidence ? '' : 'disabled') : '') + '</div>';
    return '<section class="j-hanna-screen">' + navigation + '<div class="j-paper j-hanna-sheet">' + meta(q) + '<h2>' + esc(data[3]) + '</h2><div id="qvis" hidden></div>' + content + '</div></section>';
  }
  function diveView() {
    const s = global.S, q = M.question;
    return '<div class="j-sea"><div class="j-depth-stats"><div><small>عمق المغامرة</small><b>' + ar(s.depth) + ' <small>قامة</small></b><span class="j-tag">' + esc(M.teams[s.pi || 0].n) + '</span></div><div class="j-haul"><small>حصيلة الرحلة</small><b class="j-gold" data-haul>' + score(s.pearls) + '</b><small>لؤلؤة</small></div></div><div class="j-depth-track" role="progressbar" aria-label="عمق المغامرة" aria-valuemin="0" aria-valuemax="' + s.cap + '" aria-valuenow="' + s.depth + '" style="--depth-progress:' + Math.max(0, Math.min(100, s.depth / Math.max(1, s.cap) * 100)) + '%"><i class="j-depth-start"></i><i class="j-depth-current"></i></div><div class="j-bubbles">' + Array.from({ length: 12 }, (_, i) => '<i data-bubble="' + i + '"></i>').join('') + '</div><div class="j-pearl" data-pearl></div></div>' +
      (q ? '<section class="j-paper j-dive-panel">' + meta(q) + '<h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + answers(q) + timerMarkup(q) +
        (q.settled ? '<div class="j-reward" data-motion="reward">' + (q.correct ? '✓ إجابة صحيحة! ' + score(q.reward, true) : s.lost ? q.timedOut ? 'نفد النفَس' : 'انقطعت الشبكة' : 'أنقذكم السيب') + '</div>' + explanation(q) : '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) && !q.answerRevealed ? button('أظهر الجواب', 'reveal-answer', 'j-btn j-teal') : '') + (q.answerRevealed ? button('صح', 'judge-yes', 'j-btn j-teal') + button('خطأ', 'judge-no', 'j-secondary') : '') + '</div>') + '</section>' : '<h2 class="j-heading">اختاروا صدفتكم</h2><div class="j-shells">' + (s.shells || []).map(c => button(catIcon(c) + '<span>' + esc(catName(c)) + '</span>', 'shell', '', 'data-cat="' + c + '"')).join('') + '</div>') +
      '<div class="j-tools">' + button('النور · استبعاد خيارات', 'dive-light', '', !s.tools.light || !q || q.settled || !shownOptions(q) ? 'disabled' : '') + button('النوخذة · تلميح', 'dive-hint', '', !s.tools.nokh || !q || q.settled || global.nokhBlind() ? 'disabled' : '') + '<span class="j-tag">' + (s.tools.seeb ? 'السيب جاهز للإنقاذ' : 'استُعمل السيب') + '</span></div>' +
      (q?.hint ? '<p class="j-war-message">النوخذة يقول: جوابكم يبدأ بحرف «' + esc(q.hint) + '».</p>' : '') +
      '<div class="j-actions">' + (q?.settled ? button(s.lost ? 'النتيجة' : 'واصل الغوص ↓', 'dive-next', 'j-btn j-teal') : '') + button('اخرج بحصيلتك', 'dive-bank', 'j-secondary', !s.pearls || s.lost || s.ending ? 'disabled' : '') + '</div>';
  }
  function islandMap() {
    const w = M.g;
    const slots = global.SLOTS.map((slot, i) => ({ ...slot, x: [95, 300, 505][i % 3], y: [50, 185, 320, 455][Math.floor(i / 3)] }));
    return '<svg class="j-island-map" viewBox="0 0 600 540" role="group" aria-label="أرخبيل الجزر"><defs><linearGradient id="journey-sand" x2="0" y2="1"><stop stop-color="#fff1bd"/><stop offset="1" stop-color="#d8b878"/></linearGradient><linearGradient id="journey-green" x2="0" y2="1"><stop stop-color="#a5e2a2"/><stop offset="1" stop-color="#4eb893"/></linearGradient><filter id="journey-marker-shadow"><feDropShadow dx="0" dy="6" stdDeviation="1" flood-color="#075365"/></filter></defs><g fill="none" stroke="#a4ede64a" stroke-width="2">' + Array.from({ length: 13 }, (_, i) => '<path d="M' + (i * 71 % 510) + ' ' + (35 + i * 39) + 'q30-12 60 0t60 0"/>').join('') + '</g><g fill="none" stroke="#fff3a979" stroke-width="4" stroke-dasharray="9 9">' + global.WarEngine.LINKS.map(([a, b]) => '<path' + (w.base === a && w.tgt === b || w.base === b && w.tgt === a ? ' class="j-route-active"' : '') + ' d="M' + slots[a].x + ' ' + slots[a].y + 'Q300 ' + (slots[a].y + slots[b].y) / 2 + ' ' + slots[b].x + ' ' + slots[b].y + '"/>').join('') + '</g>' +
      slots.map((p, i) => {
        const owner = w.own[i], t = M.teams[owner], name = catName(w.slotCat[i]);
        const words = name.split(' '); let lines = ['']; words.forEach(word => { const last = lines.length - 1; if ((lines[last] + ' ' + word).length > 16 && lines[last]) lines.push(word); else lines[last] += (lines[last] ? ' ' : '') + word; });
        const selected = w.base === i || w.tgt === i, dead = global.WarEngine.isDead(w, i);
        return '<g class="j-map-island" data-island="' + i + '" role="button" tabindex="0" aria-label="' + esc(name) + '، ' + esc(t.n) + '، ' + ar(w.ban[i]) + ' رايات' + (dead ? '، خامدة' : '') + '"><ellipse cx="' + p.x + '" cy="' + (p.y + 15) + '" rx="' + (p.r + 9) + '" ry="' + (p.r * .62) + '" fill="#0a526f66"/><path d="M' + (p.x - p.r) + ' ' + p.y + 'q-7-43 34-49t65 6q37 18 14 48t-65 29q-48 7-48-34Z" fill="url(#journey-sand)" stroke="#ffedc9" stroke-width="4"/><ellipse cx="' + p.x + '" cy="' + (p.y - 8) + '" rx="' + (p.r - 11) + '" ry="' + (p.r * .45) + '" fill="url(#journey-green)"/>' +
          (selected ? '<rect x="' + (p.x - 43) + '" y="' + (p.y - 48) + '" width="86" height="81" rx="25" fill="#fff8bd55"/>' : '') + '<rect class="j-island-marker" x="' + (p.x - 33) + '" y="' + (p.y - 40) + '" width="66" height="62" rx="21" fill="' + t.c + '" opacity="' + (dead ? '.4' : '1') + '"/>' +
          '<g transform="translate(' + (p.x - 14) + ' ' + (p.y - 30) + ') scale(.28)" fill="#fff" stroke="#fff">' + sym(t.symbol).replace(/<svg[^>]*>|<\/svg>/g, '') + '</g><text class="j-map-flag" x="' + p.x + '" y="' + (p.y + 13) + '">' + ar(w.ban[i]) + '</text>' + lines.map((line, li) => '<text class="j-map-label" x="' + p.x + '" y="' + (p.y + 57 + li * 23) + '">' + esc(line) + '</text>').join('') + '</g>';
      }).join('') + '</svg>';
  }
  function warView() {
    const w = M.g, q = M.question;
    let text = q ? 'دور «' + M.teams[q.actor].n + '» ' + (q.defend ? 'يدافع عن الجزيرة.' : 'يهاجم الجزيرة.') : M.warMessage;
    if (!text) text = w.phase === 'deploy' ? 'وزّعوا الرايات على جزركم، ثم سلّموا الدور.' : w.phase === 'move' ? 'انقلوا الرايات إلى جزيرتكم الجديدة، أو أنهوا الدور.' : w.base === null ? 'اختاروا جزيرة تنطلقون منها.' : 'اختاروا جزيرة متصلة للهجوم.';
    const board = teamBar() + '<div class="j-map-title">اختاروا جزيرتكم القادمة</div><p class="j-war-message" role="status">' + esc(text) + (w.phase === 'deploy' ? ' الرايات بيدكم: ' + ar(w.pool) : '') + '</p>' + islandMap();
    if (!q) return board + '<div class="j-actions j-war-actions">' + button('تراجع', 'war-undo', 'j-secondary', !w.placed.length && w.base === null ? 'disabled' : '') + button(w.phase === 'deploy' ? 'سلّموا الدور' : 'إنهاء الدور', 'war-next', 'j-btn j-teal', w.busy || w.phase === 'deploy' && w.pool > 0 ? 'disabled' : '') + button('إنهاء اللعبة', 'finish-war', 'j-secondary') + '</div>';
    return board + '<section class="j-paper j-island-sheet" data-motion="island">' + meta(q) + '<h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + answers(q) + timerMarkup(q) +
      (q.settled ? '<div class="j-verdict' + (q.correct ? '' : ' j-no') + '">' + (q.correct ? q.fast ? '✓ إصابة مزدوجة — سبقتوا الجمر' : '✓ إصابة صحيحة' : q.timedOut ? 'نفد الوقت' : 'خطأ') + '</div>' + explanation(q) + '<div class="j-actions">' + button('التالي', 'war-answer-next', 'j-btn j-teal') + '</div>' : '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) && !q.answerRevealed ? button('أظهر الجواب', 'reveal-answer', 'j-btn j-teal') : '') + (q.answerRevealed ? button('صح', 'judge-yes', 'j-btn j-teal') + button('خطأ', 'judge-no', 'j-secondary') : '') + '</div>') + '</section>';
  }
  function warResult() {
    const r = M.warResult;
    const message = { fall: '✓ الجزيرة لكم! ارتفعت رايتكم بعد الإجابة الصحيحة.', take: '✓ إصابة! انتقلت راية إلى جزيرتكم.', lose: 'رُدّ الهجوم؛ انتقلت راية إلى المدافع.', hold: 'صمدت الجزيرة؛ الملكية كما هي.' }[r.kind];
    return teamBar() + islandMap() + '<div class="j-hanna-reveal" data-motion="island"><h2>' + message + '</h2><div class="j-actions">' + button('التالي', 'war-result-next', 'j-btn j-teal') + '</div></div>';
  }
  function results() {
    if (game === 'test') return quizResults();
    const r = M.result, rows = r?.rows || [];
    return '<section class="j-results"><div class="j-result-icon">' + Icons.icon('medal') + '</div><span class="j-tag">ختام المغامرة</span><h2>' + esc(r?.title || 'انتهت اللعبة') + '</h2>' + (r?.note ? '<p class="j-muted">' + esc(r.note) + '</p>' : '') + '<table class="j-rank"><thead><tr><th>الفريق</th><th>' + (game === 'harb' ? 'الجزر' : game === 'ghaws' ? 'اللؤلؤ' : 'النقاط') + '</th>' + (game === 'harb' ? '<th>الرايات</th>' : '') + '</tr></thead><tbody>' + rows.map(row => '<tr data-team-color="' + row.index + '"><td>' + sym(M.teams[row.index].symbol) + '<bdi>' + esc(M.teams[row.index].n) + '</bdi></td><td>' + score(row.score) + '</td>' + (game === 'harb' ? '<td>' + score(row.flags) + '</td>' : '') + '</tr>').join('') + '</tbody></table><div class="j-actions">' + button(game === 'hanna' ? 'لعبة جديدة' : 'مغامرة جديدة', 'again') + '<a class="j-secondary" href="/quest.html">كنوز المعرفة</a></div></section>';
  }
  function dialog() {
    if (!M.dialog) return '';
    return '<div class="j-modal j-dialog" role="dialog" aria-modal="true" aria-label="' + esc(M.dialog.text) + '"><div class="j-paper"><h2>' + esc(M.dialog.text) + '</h2><div class="j-actions">' + button(esc(M.dialog.labels.yes), 'dialog-yes', 'j-btn j-teal') + button(esc(M.dialog.labels.no), 'dialog-no', 'j-secondary') + '</div></div></div>';
  }
  function render() {
    const focus = document.activeElement?.getAttribute('data-team-name');
    const scrollBeforeRender = window.scrollY;
    const changed = M.lastStage !== M.stage;
    const motionKey = M.stage + ':' + (M.question?.index ?? '') + ':' + (M.question?.beat || '') + (game === 'ghaws' && M.question?.settled ? ':reward' : '');
    const motionChanged = motionKey !== M.lastMotion;
    cancelVisuals();
    const screens = { hub: home, categories: game === 'test' ? quizCategories : categories, settings: game === 'test' ? quizStart : settings, 'room-entry': game === 'board' ? () => '<section class="j-board-room-entry">' + roomEntry() + '</section>' : roomEntry, 'room-join': roomJoinScreen, 'room-code': roomCodeScreen, 'board-room': () => boardRooms.view(), board: boardView, 'board-question': boardView, 'test-question': quizQuestion, 'hanna-question': hannaQuestion, dive: diveView, war: warView, 'war-result': warResult, results,
      loading: () => '<div class="j-loading" role="status">نجهّز مغامرتكم…<div class="j-loader"></div></div>',
      handover: () => '<div class="j-results"><div class="j-result-icon">' + Icons.icon('wave') + '</div><h2>دور «' + esc(M.teams[global.S.pi].n) + '»</h2><p class="j-muted">خذوا نفسكم… ومغامرتكم تبدأ.</p><div class="j-actions">' + button('ابدأ الغوص', 'dive-begin', 'j-btn j-teal') + '</div></div>',
      'war-pass': () => teamBar() + '<div class="j-results"><h2>دور المدافع «' + esc(M.teams[M.pendingWarAsk.pi].n) + '»</h2><p class="j-muted">سلّموا الجهاز للمدافع قبل إظهار السؤال.</p><div class="j-actions">' + button('جاهزين للدفاع', 'war-defend', 'j-btn j-teal') + '</div></div>',
      error: () => '<div class="j-error" role="alert">' + esc(M.error || 'تعذّر تجهيز المغامرة') + '</div><div class="j-actions">' + button('حاولوا مرة ثانية', 'reload') + '</div>', room: () => '' };
    app.dataset.stage = M.stage;
    app.innerHTML = (M.stage === 'board-question' ? '' : M.stage === 'room-code' ? '<header class="j-header">' + button('›', 'back', 'j-icon-btn j-back', 'aria-label="رجوع"') + '<h1>إنشاء غرفة</h1></header>' : header()) + stepper() + '<main class="j-content" id="journey-main">' + (screens[M.stage] || screens.error)() + '</main>' + (M.stage === 'board-question' ? boardQuestion() : '') + dialog();
    app.querySelectorAll('[data-color]').forEach(el => { el.style.backgroundColor = el.dataset.color; });
    app.querySelectorAll('[data-team-color]').forEach(el => { el.style.setProperty('--team-color', M.teams[+el.dataset.teamColor]?.c || colors[0]); });
    app.querySelectorAll('[data-category-color]').forEach(el => { el.style.setProperty('--c', catColors[+el.dataset.categoryColor % catColors.length]); });
    app.querySelectorAll('[data-bubble]').forEach(el => { const i = +el.dataset.bubble, n = 6 + i % 6 * 2; el.style.left = (i * 79 + 7) % 95 + '%'; el.style.bottom = 10 + i * 43 % 220 + 'px'; el.style.width = n + 'px'; el.style.height = n + 'px'; });
    if (M.question && app.querySelector('#qvis')) {
      const q = questionText(M.question);
      if (global.KZV) {
        global.KZV.show(q);
        app.querySelectorAll('[data-choice]').forEach(el => global.KZV.choice(el, q, +el.dataset.choice));
        if (M.question.answerRevealed) global.KZV.reveal(q);
      }
      app.querySelectorAll('[data-explanation]').forEach(el => renderExplanation(el, q));
    } else if (M.question && app.querySelector('[data-explanation]')) {
      const q = questionText(M.question); app.querySelectorAll('[data-explanation]').forEach(el => renderExplanation(el, q));
    } else if (global.KZV) global.KZV.show(null);
    if (changed && Motion) {
      activeScreenMotion?.cancel();
      activeScreenMotion = Motion.enterScreen(app.querySelector('main'));
      if (M.stage === 'hub') Motion.staggerCards(app.querySelectorAll('.j-game-card'));
      if (M.stage === 'categories') Motion.staggerCards(Array.from(app.querySelectorAll('.j-cat-pick')).slice(0, 8));
    }
    if (Motion && !M.dialog && motionChanged) app.querySelectorAll('[data-motion]').forEach(el => {
      const kind = el.dataset.motion;
      Motion.enterScreen(el, kind === 'board' ? { duration: .4, opacityDuration: .4, distance: 30, initialScale: .9 } : kind === 'island' ? { duration: .5, opacityDuration: .5, distance: 80, initialScale: 1 } : kind === 'hanna' ? { duration: .5, opacityDuration: .5, distance: 45, initialScale: .95 } : { duration: .5, opacityDuration: .5, distance: 18, initialScale: 1 });
    });
    if (Motion && !M.dialog && M.stage === 'hub') app.querySelectorAll('.j-game-card>svg').forEach((el, i) => Motion.float(el, { amplitude: 3, frequency: 1.5, phase: i, rotation: 3, rotationFrequency: 1 }));
    animateBubbles();
    M.lastStage = M.stage; M.lastMotion = motionKey;
    const questionKey = M.stage + ':' + (M.question?.index ?? '') + ':' + !!M.question?.settled + ':' + !!M.question?.answerRevealed;
    if (changed) window.scrollTo(0, 0);
    const sheet = app.querySelector('.j-island-sheet,.j-quiz-paper,.j-dive-panel');
    if (sheet) {
      const inset = Math.max(16, parseFloat(getComputedStyle(sheet).scrollMarginTop) || 0);
      const gap = sheet.classList.contains('j-island-sheet') ? inset : Math.max(inset, (innerHeight - sheet.offsetHeight) / 2);
      // Reapply space on every render so option/mute/dialog updates cannot
      // shrink the document and clamp the card below its requested position.
      const main = sheet.closest('main');
      main.style.paddingBottom = Math.max(parseFloat(getComputedStyle(main).paddingBottom) || 0, innerHeight - sheet.offsetHeight - gap) + 'px';
      const layoutKey = questionKey + ':' + sheet.offsetHeight + ':' + innerWidth + ':' + innerHeight;
      // offsetTop follows the stable layout, without the entrance transform.
      let top = 0; for (let node = sheet; node; node = node.offsetParent) top += node.offsetTop;
      window.scrollTo({ top: !M.dialog && layoutKey !== M.lastQuestionLayout ? Math.max(0, top - gap) : scrollBeforeRender, behavior: 'instant' });
      M.lastQuestionLayout = layoutKey;
    } else M.lastQuestionLayout = null;
    if (focus !== null && focus !== undefined) app.querySelector('[data-team-name="' + focus + '"]')?.focus();
    paintTime();
    if (game === 'hub' && global.KunuzThemeBoot?.status === 'mounted') global.KunuzThemeBoot.mounted();
  }
  function time() { return M.settings.custom ? M.settings.customTime : M.settings.time; }
  function clearTimer() {
    if (M.timer) clearInterval(M.timer); M.timer = null;
    if (M.quizAdvance) clearTimeout(M.quizAdvance); M.quizAdvance = null;
  }
  function scheduleQuizNext(q, delay = 900) {
    M.quizAdvance = setTimeout(() => {
      M.quizAdvance = null;
      if (M.question !== q || !q.settled || !M.running || M.stage !== 'test-question') return;
      if (M.dialog || document.hidden) { scheduleQuizNext(q, 100); return; }
      returnBoard();
    }, delay);
  }
  function startTimer() {
    clearTimer(); const q = M.question;
    if (!q?.duration) return;
    M.timer = setInterval(() => {
      if (M.dialog || document.hidden) return;
      if (!M.question || q.settled || q.answerRevealed || q.beat) { clearTimer(); return; }
      if (performance.now() >= q.deadline) {
        q.timedOut = true; clearTimer();
        if (game === 'board') { q.answerRevealed = true; render(); }
        else if (game === 'hanna') { if (q.selected !== null && q.confidence) hannaLock(false, false); hannaBeat(); }
        else settle(false);
        return;
      }
      if (game === 'harb' && shownOptions(q)) {
        const data = questionText(q), full = data[4].length, elapsed = performance.now() - q.started;
        const alive = full - q.burned.size, want = global.WarEngine.aliveAt(alive, full, elapsed, q.duration);
        const wrong = Model.shuffle(data[4].map((_, i) => i).filter(i => i !== data[5] && !q.burned.has(i)));
        if (alive > want) { wrong.slice(0, alive - want).forEach(i => q.burned.add(i)); render(); }
      }
      paintTime();
    }, 100);
  }
  function paintTime() {
    const q = M.question; if (!q) return;
    const left = Math.max(0, q.deadline - performance.now());
    const bar = app.querySelector('[data-timer-bar]'), label = app.querySelector('[data-timer-text]');
    if (bar) bar.style.width = q.duration ? Math.max(0, Math.min(100, left / q.duration * 100)) + '%' : '100%';
    if (label) label.textContent = q.duration ? ar(Math.ceil(left / 1000)) + ' ثانية' : 'بلا وقت';
  }
  function makeQuestion(index, actorIndex, slotIndex, duration) {
    const started = performance.now();
    M.question = { index, actor: actorIndex, activeTeam: actorIndex, slotIndex, selected: null, showTeams: new Set(), burned: new Set(), answerRevealed: false, settled: false, correct: null, started, duration, deadline: started + duration, confidence: null, submissions: {}, beat: '', scored: false, timedOut: false };
    M.used.add(index); M.history.mark(index); startTimer();
  }
  function setStage(stage, step = M.step, push = false) {
    if (usesRoomBank()) {
      M.cats = M.cats.filter(roomCategorySupported);
      if (stage === 'settings' && M.cats.length < 3) { stage = 'categories'; step = 1; }
    }
    M.stage = stage; M.step = step;
    if (push) history.pushState({ journey: true, step, ...(game === 'test' ? { quiz: true, stage } : {}), ...(hasRooms ? { stage, room: M.settings.room, roomCodeEntry: M.roomCodeEntry } : {}) }, '');
    render();
    if (M.audioUnlocked) sound(game === 'ghaws' && stage === 'dive' ? 'water-transition' : 'swoosh');
  }
  function askDialog(text, yes, no = () => {}, labels = { yes: 'نعم، نرجع', no: 'لا، نكمل' }) {
    M.dialog = { text, yes, no, labels, at: performance.now() }; render();
  }
  function closeDialog(confirmed) {
    const dialog = M.dialog; if (!dialog) return; M.dialog = null;
    if (M.question) { const pause = performance.now() - dialog.at; M.question.deadline += pause; M.question.started += pause; }
    if (confirmed) dialog.yes(); else { dialog.no(); render(); }
  }
  function cancelPlay() {
    clearTimer(); cancelVisuals(); stopSounds();
    if (game === 'ghaws') { global.stopB(); global.clearT(); global.S.lock = true; global.S.ending = true; }
    if (game === 'harb') { global.stop(); global.stopFx(); global.clearT(); }
    M.question = null; M.running = false; M.questionHistory = false;
  }
  function leaveToSettings() {
    const questionEntry = M.questionHistory;
    cancelPlay(); M.error = ''; setStage('settings', 2);
    if (history.state?.journey && history.state.step === 3) { M.skipPop = true; history.go(questionEntry ? -2 : -1); }
    else history.replaceState({ journey: true, step: 2 }, '');
  }
  function restartSetup() {
    const questionEntry = M.questionHistory, step = history.state?.step || 1;
    cancelPlay(); M.error = ''; setStage('categories', 1);
    if (history.state?.journey && step > 1) { M.skipPop = true; history.go(-(step - 1 + (questionEntry ? 1 : 0))); }
    else history.replaceState({ journey: true, step: 1 }, '');
  }
  function homeExit() { try { sessionStorage.setItem('ezik_resume_section_v1', 'home'); } catch (_) {} location.href = '/'; }
  function confirmedHomeExit() {
    cancelPlay();
    const close = game === 'hanna' && M.stage === 'room' ? global.KunuzHannaRoomExit?.() : null;
    if (close && typeof close.then === 'function') { Promise.resolve(close).then(homeExit, homeExit); return; }
    homeExit();
  }
  function leaveRoomToSettings() {
    if (game === 'harb') { const state = { ...history.state }; delete state.kunuzWarRoom; delete state.kunuzWarRoomEntry; history.replaceState(state, ''); }
    const route = game === 'hanna' ? '/hanna-laha/' : '/quest-harb.html';
    const target = M.cats.length < 3 ? route : route + '?setup=1';
    if (M.cats.length >= 3) {
      try { sessionStorage.setItem('kunuz_journey_room_setup_v1', JSON.stringify({ game, cats: M.cats, teams: M.teams, settings: M.settings, returnFromRoom: true, savedAt: Date.now() })); } catch (_) {}
    }
    // Discard native room routes and the setup entry replaced on room entry.
    // The next settings page builds its pair on the original categories entry.
    const entry = M.roomEntry;
    const rewind = entry ? Math.max(0, history.length - entry.length) + entry.parent : 0;
    if (rewind > 0) {
      M.roomLeavingUrl = target; M.stage = 'leaving';
      history.go(-rewind);
    } else location.replace(target);
  }
  function returnToRoomHubNotice(message) {
    M.roomClosedNotice = message || global.RMERR.ROOM_CLOSED; M.error = ''; M.dialog = null; M.resumingRoom = false;
    document.body.classList.remove('journey-room');
    history.replaceState({ journey: true, stage: 'hub', step: 0 }, '');
    setStage('hub', 0);
  }
  function back() {
    if (hasRooms && ['room-code', 'room-join', 'categories'].includes(M.stage) && history.state?.stage && !history.state.entryRoot) { history.back(); return; }
    if (M.roomFromEntry && /\/join\/?$/.test(location.pathname)) { history.back(); return; }
    if (M.stage === 'room-entry') { location.replace('/quest.html'); return; }
    if (game === 'test') {
      history.back(); return;
    }
    if (M.stage === 'room') { askDialog('تطلعون من الغرفة وترجعون للإعدادات؟', leaveRoomToSettings, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); return; }
    if (M.question && ['board', 'test', 'hanna'].includes(game)) {
      if (M.question.settled) returnBoard();
      else askDialog(game === 'hanna' && M.question.answerRevealed ? 'تتركون التحكيم المتبقي وترجعون للوحة؟' : 'ترجعون للوحة وتتركون السؤال بلا نقاط؟', abandonQuestion);
    } else if (M.running) askDialog('تتركون اللعبة وترجعون للفرق والإعدادات؟', leaveToSettings);
    else if (M.step === 2) { M.error = ''; history.back(); }
    else if (M.stage === 'results') leaveToSettings();
    else if (game === 'hanna') location.replace('/quest.html');
    else location.href = '/quest.html';
  }
  function resetQuiz() {
    cancelPlay(); M.error = ''; M.result = null; M.slots = []; M.pool = []; M.used = new Set();
    M.quizLastQuestion = null; M.quizPausedAt = null;
    const step = history.state?.step || 1;
    if (step > 1) history.go(1 - step);
    else setStage('categories', 1);
  }
  function beginQuiz() {
    if (M.stage !== 'settings' || !M.cats.length) return;
    updateQuizFields();
    if (quizCountError() || quizTimeError() || !M.quizCount || !M.quizCustomCount && !quizCounts().includes(M.quizCount)) return;
    M.teams = [teamNew(0)];
    M.settings.room = false;
    M.quizPausedAt = null; M.quizLastQuestion = null;
    beginWithIap();
  }
  function saveQuizDraft() {
    try { sessionStorage.setItem('kunuz_quiz_setup_v1', JSON.stringify({ cats: M.cats, count: M.quizCount, time: time(), options: M.settings.options, difficulty: M.settings.difficulty, customCount: M.quizCustomCount, countDraft: M.quizCountDraft, customTime: M.settings.custom, timeDraft: M.quizTimeDraft })); } catch (_) {}
  }
  function initQuizSetup() {
    try {
      const draft = JSON.parse(sessionStorage.getItem('kunuz_quiz_setup_v1'));
      if (draft) {
        const available = new Set(quizCatalog().map(c => c.index));
        M.cats = Array.isArray(draft.cats) ? [...new Set(draft.cats.filter(c => available.has(c)))] : [];
        if ([0, 10, 15, 20, 30, 45, 60].includes(draft.time)) M.settings.time = draft.time;
        if (['shown', 'hidden'].includes(draft.options)) M.settings.options = draft.options;
        if (['easy', 'medium', 'hard', 'mixed'].includes(draft.difficulty)) M.settings.difficulty = draft.difficulty;
        if (quizCounts().includes(draft.count)) M.quizCount = draft.count;
        M.quizCustomCount = draft.customCount === true; M.quizCountDraft = typeof draft.countDraft === 'string' ? roomDigits(draft.countDraft) : '';
        M.settings.custom = draft.customTime === true; M.quizTimeDraft = typeof draft.timeDraft === 'string' ? roomDigits(draft.timeDraft) : '';
        if (M.quizCustomCount && !quizCountError()) M.quizCount = Math.min(Number(M.quizCountDraft), quizAvailable());
        if (M.settings.custom) M.settings.customTime = M.quizTimeDraft === '' ? NaN : +M.quizTimeDraft;
      } else M.settings.time = 0;
    } catch (_) { M.settings.time = 0; }
    // Give a direct visit the same one-step exit to the hub as a hub link.
    if (!history.state?.quiz) {
      const url = location.pathname + location.search;
      let fromHub = false;
      try { const referrer = new URL(document.referrer); fromHub = referrer.origin === location.origin && referrer.pathname === '/quest.html'; } catch (_) {}
      if (!fromHub) {
        history.replaceState({ journey: true, quiz: true, stage: 'hub', step: 0 }, '', '/quest.html');
        history.pushState({ journey: true, quiz: true, stage: 'categories', step: 1 }, '', url);
      } else history.replaceState({ journey: true, quiz: true, stage: 'categories', step: 1 }, '');
    } else history.replaceState({ journey: true, quiz: true, stage: 'categories', step: 1 }, '');
    setStage('categories', 1);
  }
  function quizHistoryStage(stage, step) {
    if (stage === 'hub') { saveQuizDraft(); location.replace('/quest.html'); return; }
    if (!['categories', 'settings', 'test-question', 'results'].includes(stage)) return;
    if (stage === 'settings' && !M.quizCustomCount && !quizCounts().includes(M.quizCount)) { M.quizCount = quizCounts()[0]; saveQuizDraft(); }
    if (stage === 'settings' && M.quizCustomCount && !quizCountError()) M.quizCount = Math.min(Number(M.quizCountDraft), quizAvailable());
    if (M.stage === 'test-question' && stage !== 'test-question') { clearTimer(); M.quizPausedAt = performance.now(); }
    if (stage === 'test-question') {
      M.question ||= M.quizLastQuestion;
      if (!M.question) { history.replaceState({ journey: true, quiz: true, stage: 'settings', step: 2 }, ''); setStage('settings', 2); return; }
      if (M.quizPausedAt !== null) {
        const pause = performance.now() - M.quizPausedAt;
        M.question.started += pause; M.question.deadline += pause; M.quizPausedAt = null;
      }
    }
    setStage(stage, step);
    if (stage === 'test-question' && M.running) {
      if (M.question.settled) scheduleQuizNext(M.question);
      else if (!M.question.answerRevealed) startTimer();
    }
  }
  function reserveQuiz() {
    M.history.read();
    const unseen = [], oldest = [];
    for (const cat of M.cats) {
      const candidates = Model.candidates(cat, M.history);
      unseen.push(...candidates.unseen.filter(i => global.DATA.qs[i][4].length === 4));
      oldest.push(...candidates.oldest.filter(i => global.DATA.qs[i][4].length === 4));
    }
    oldest.sort((a, b) => M.history.last(a) - M.history.last(b) || a - b);
    const target = { easy: 1, medium: 2, hard: 3 }[M.settings.difficulty];
    let ranked;
    if (target) {
      const unseenExact = Model.shuffle(unseen.filter(i => Model.level(i) === target));
      const unseenOther = Model.shuffle(unseen.filter(i => Model.level(i) !== target)).sort((a, b) => Math.abs((Model.level(a) || target) - target) - Math.abs((Model.level(b) || target) - target));
      const oldExact = oldest.filter(i => Model.level(i) === target);
      const oldOther = oldest.filter(i => Model.level(i) !== target).sort((a, b) => Math.abs((Model.level(a) || target) - target) - Math.abs((Model.level(b) || target) - target) || M.history.last(a) - M.history.last(b) || a - b);
      ranked = unseenExact.concat(unseenOther, oldExact, oldOther);
    } else ranked = Model.shuffle(unseen).concat(oldest);
    const indices = ranked.slice(0, M.quizCount);
    const replayed = new Set(indices.filter(i => M.history.has(i)).map(i => global.DATA.qs[i][0]));
    for (const cat of replayed) M.history.restart(cat, indices.filter(i => global.DATA.qs[i][0] === cat));
    const slots = indices.map(index => { const actual = Model.level(index) || 1, desired = target || actual; return { index, cat: global.DATA.qs[index][0], pts: Model.POINTS[desired - 1], desired, actual, used: false, by: -1 }; });
    return { indices, slots, shortage: [], fallback: [] };
  }
  function fourChoiceSlots(slots) {
    const reserved = new Set(slots.filter(slot => global.DATA.qs[slot.index][4].length === 4).map(slot => slot.index));
    return slots.map(slot => {
      if (global.DATA.qs[slot.index][4].length === 4) return slot;
      const candidates = Model.candidates(slot.cat, M.history, Math.random, reserved);
      const unseen = candidates.unseen.filter(i => global.DATA.qs[i][4].length === 4);
      unseen.sort((a, b) => Math.abs((Model.level(a) || slot.desired) - slot.desired) - Math.abs((Model.level(b) || slot.desired) - slot.desired));
      const index = unseen[0] ?? candidates.oldest.find(i => global.DATA.qs[i][4].length === 4);
      if (index === undefined) return null;
      reserved.add(index); return { ...slot, index, actual: Model.level(index) };
    });
  }
  function begin() {
    const s = M.settings;
    if (game === 'hanna' && s.room && !s.roomCode) { M.error = ''; M.roomStartError = 'أنشئ الغرفة أولًا'; render(); return false; }
    if (!Number.isFinite(time()) || time() < 0 || s.custom && time() === 0 || !Number.isInteger(s.reveals) || s.reveals < 0 || !Number.isInteger(s.shots) || s.shots < 1 || s.shots > 10 || s.customFlags && (!Number.isInteger(s.customFlagsValue) || s.customFlagsValue < 2 || s.customFlagsValue > 60)) { M.error = 'اكتبوا قيمة صحيحة للوقت والخيارات والإعدادات.'; render(); return false; }
    if (game === 'harb' && s.room) {
      enterRoom(false);
      return;
    }
    if (game === 'board' && s.room) { boardRooms.create(); return; }
    if (s.room) { enterRoom(false); return; }
    M.history ||= Model.history();
    const all = Model.categories();
    const pool = game === 'test' ? reserveQuiz() : Model.reserve(M.cats, M.history);
    if (pool.shortage.length) { M.error = 'فئة «' + catName(pool.shortage[0]) + '» غير متاحة حاليًا؛ ارجعوا واختاروا فئة أخرى.'; render(); return false; }
    M.error = ''; M.pool = pool.indices; M.slots = pool.slots; M.fallback = pool.fallback; M.excluded = all.filter(c => c.count < Model.PER_CATEGORY);
    if (game === 'hanna') M.slots = M.cats.flatMap(cat => M.slots.filter(slot => slot.cat === cat).sort((a, b) => a.pts - b.pts));
    if (game === 'hanna' || game === 'test') {
      const slots = fourChoiceSlots(M.slots);
      if (slots.some(slot => !slot)) { M.error = 'إحدى الفئات لا تحتوي أسئلة بأربعة خيارات؛ اختاروا فئة أخرى.'; render(); return false; }
      M.slots = slots; M.pool = M.slots.map(slot => slot.index);
    }
    if ((game === 'hanna' || game === 'test') && !M.slots.length) { M.error = 'لا توجد أسئلة متاحة حاليًا.'; render(); return false; }
    M.used = new Set(); M.question = null; M.questionHistory = false; M.result = null;
    M.teams.forEach((t, i) => { t.n = t.n.trim() || defaults[i]; t.shows = s.reveals; t.score = 0; t.p = 0; t.d = 0; });
    const symbols = M.teams.map(t => t.symbol);
    if (s.difficulty === 'mixed') {
      for (const c of M.cats) { const slots = M.slots.filter(slot => slot.cat === c), indices = Model.shuffle(slots.map(slot => slot.index)); slots.forEach((slot, i) => { slot.index = indices[i]; slot.actual = Model.level(slot.index); }); }
    }
    M.running = true;
    if (game === 'test') {
      M.g = global.TE.newGame({ teams: M.teams, cats: M.cats, total: M.slots.length, timer: time(), opts: s.options, shows: s.reveals });
      M.teams = M.g.teams; M.teams.forEach((t, i) => { t.symbol = symbols[i]; }); global.G = M.g;
    } else if (game === 'board' || game === 'hanna') {
      M.g = Model.board(M.teams, M.cats, M.slots); M.teams = M.g.teams;
      M.teams.forEach((t, i) => { t.symbol = symbols[i]; t.shows = s.reveals; }); if (game === 'board') global.G = M.g;
    }
    history.pushState({ journey: true, step: 3, ...(game === 'test' ? { quiz: true, stage: 'test-question' } : {}) }, ''); M.step = 3;
    if (game === 'ghaws') beginDiveGame(); else if (game === 'harb') beginWar(); else if (game === 'test') openTile(0); else setStage('board', 3);
    return true;
  }
  function beginWithIap() {
    if (game === 'board' && (M.cats.length < 3 || M.cats.length > 6 || new Set(M.cats).size !== M.cats.length)) {
      M.error = 'اختاروا من ثلاث إلى ست فئات.'; setStage('categories', 1); return false;
    }
    if (hasRooms && M.settings.room) { begin(); return; }
    if (typeof global.ezikIapStart !== 'function') {
      M.error = 'تعذّر التحقق من رصيد الحساب. أعدوا تحميل الصفحة.'; render(); return;
    }
    const cycle = 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    global.ezikIapStart(() => begin(), cycle, game, { cycle: '1' });
  }
  function openTile(index) {
    const slot = M.slots[index]; if (!slot || slot.used || M.question) return;
    M.history.read();
    if (M.history.has(slot.index)) {
      // Another Kunuz tab may have consumed this reservation since setup.
      const excluded = new Set([...M.used, ...M.slots.filter(other => other !== slot && !other.used).map(other => other.index)]);
      let { unseen, oldest } = Model.candidates(slot.cat, M.history, Math.random, excluded);
      if (game === 'hanna' || game === 'test') { unseen = unseen.filter(i => global.DATA.qs[i][4].length === 4); oldest = oldest.filter(i => global.DATA.qs[i][4].length === 4); }
      unseen.sort((a, b) => Math.abs((Model.level(a) || slot.desired) - slot.desired) - Math.abs((Model.level(b) || slot.desired) - slot.desired));
      oldest.sort((a, b) => Math.abs((Model.level(a) || slot.desired) - slot.desired) - Math.abs((Model.level(b) || slot.desired) - slot.desired) || M.history.last(a) - M.history.last(b) || a - b);
      slot.index = unseen[0] ?? oldest[0];
      if (slot.index === undefined) {
        M.history.restart(slot.cat, []);
        const cycle = Model.candidates(slot.cat, M.history, Math.random, excluded);
        cycle.unseen.sort((a, b) => Math.abs((Model.level(a) || slot.desired) - slot.desired) - Math.abs((Model.level(b) || slot.desired) - slot.desired));
        slot.index = cycle.unseen[0] ?? cycle.oldest[0];
      }
      if (slot.index === undefined) { M.error = 'لا توجد أسئلة متاحة لهذه الفئة الآن؛ ارجعوا للإعداد واختاروا فئة أخرى.'; render(); return; }
      slot.actual = Model.level(slot.index);
    }
    const turn = M.g.turn;
    if (game === 'test') { M.g.cur = slot.index; M.g.used[slot.index] = 1; M.g.curCat = slot.cat; }
    else { M.g.cur = { s: index, k: slot.index }; M.g.used[slot.index] = 1; }
    makeQuestion(slot.index, turn, index, time() * 1000);
    if (game !== 'test') { history.pushState({ journey: true, step: 3, question: true }, ''); M.questionHistory = true; }
    setStage(game + '-question', 3);
  }
  function revealAnswer() {
    const q = M.question; if (!q || q.settled || q.answerRevealed) return;
    q.answerRevealed = true; clearTimer(); render();
  }
  function settle(correct) {
    const q = M.question; if (!q || q.settled) return;
    q.settled = true; q.correct = correct; q.answerRevealed = true; clearTimer();
    if (game === 'test') {
      if (!global.TE.settle(M.g, correct)) return;
      if (correct) M.teams[q.actor].score += M.slots[q.slotIndex].pts - 1;
      M.slots[q.slotIndex].used = true; M.slots[q.slotIndex].by = correct ? q.actor : -1;
    } else if (game === 'ghaws') {
      const before = global.S.pearls;
      if (q.timedOut) global.tmo(); else M.diveNative.answer(correct ? questionText(q)[5] : -1, null);
      q.reward = global.S.pearls - before;
    } else if (game === 'harb') {
      q.fast = shownOptions(q) && !q.manual && global.WarEngine.isFast(M.g, questionText(q)[4].length - q.burned.size, questionText(q)[4].length);
      M.warEvent = global.WarEngine.fightAnswer(M.g, correct, q.fast);
    }
    render();
    if (game === 'test') scheduleQuizNext(q);
    if (correct) {
      sound('success'); Motion?.celebrate(app);
      if (game === 'ghaws') {
        const haul = app.querySelector('[data-haul]'), pearl = app.querySelector('[data-pearl]');
        if (haul) Motion?.countUp(haul, global.S.pearls - q.reward, global.S.pearls, { duration: 1.2, arabicDigits: true });
        if (pearl && !Motion?.reducedMotion) { M.pearlAnimation = pearl.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-70px)' }], { duration: 1200, easing: 'cubic-bezier(.333333,1,.666667,1)', fill: 'forwards' }); M.pearlAnimation.finished.catch(() => {}); }
      }
    }
  }
  function award(team) {
    const q = M.question; if (!q || q.settled || !q.answerRevealed) return;
    q.settled = true; if (!global.BE.award(M.g, team)) return;
    if (team >= 0) sound('success'); returnBoard();
  }
  function abandonQuestion() {
    const q = M.question; if (!q) return;
    if (game === 'board') { q.answerRevealed = true; award(-1); }
    else if (game === 'test') { settle(false); returnBoard(); }
    else { M.slots[q.slotIndex].used = true; M.slots[q.slotIndex].by = q.answerRevealed ? Object.entries(q.submissions).filter(([, answer]) => answer.correct).map(([i]) => +i) : -1; returnBoard(); }
  }
  function returnBoard() {
    const q = M.question; if (!q) return;
    clearTimer();
    if (game === 'test') { M.quizLastQuestion = q; global.TE.next(M.g); }
    if (game === 'hanna') { M.g.cur = null; M.g.turn = (M.g.turn + 1) % M.teams.length; }
    M.question = null;
    if (M.questionHistory) { M.skipPop = true; M.questionHistory = false; history.back(); }
    if (M.slots.every(slot => slot.used)) finishBoard();
    else if (game === 'test') openTile(M.slots.findIndex(slot => !slot.used));
    else setStage('board', 3);
  }
  function finishBoard() {
    M.running = false; clearTimer();
    const rank = game === 'board' ? global.BE.rank(M.g) : game === 'test' ? global.TE.rank(M.g) : Model.rank(M.teams);
    M.result = { title: rank.winners.length > 1 ? 'تعادل بين ' + rank.winners.map(i => '«' + M.teams[i].n + '»').join(' و') : 'الفائز «' + M.teams[rank.winners[0]].n + '»', rows: rank.order.map(i => ({ index: i, score: M.teams[i].score })) };
    setStage('results', 4, game === 'test'); sound('success');
  }
  function hannaLock(manual, advance = true) {
    const q = M.question; if (!q || q.beat || !q.confidence || !manual && q.selected === null || q.submissions[q.activeTeam]) return;
    q.submissions[q.activeTeam] = { confidence: q.confidence, choice: q.selected, correct: manual ? null : q.selected === questionText(q)[5], manual, delta: 0 };
    q.selected = null; q.confidence = null;
    const next = M.teams.map((_, i) => i).find(i => !q.submissions[i]);
    if (next === undefined) hannaBeat(); else if (advance) { q.activeTeam = next; render(); }
  }
  function hannaBeat() { const q = M.question; if (!q || q.beat) return; clearTimer(); q.beat = 'confidence'; render(); }
  function hannaReveal() {
    const q = M.question; if (!q || q.beat !== 'confidence' || q.scored) return;
    q.beat = 'answer'; q.answerRevealed = true; q.scored = true;
    for (const [index, answer] of Object.entries(q.submissions)) if (answer.correct !== null) { answer.delta = Model.hannaDelta(answer.confidence, answer.correct, M.slots[q.slotIndex].pts); M.teams[+index].score += answer.delta; }
    settleHannaTile(); render(); if (Object.values(q.submissions).some(a => a.correct)) { sound('success'); Motion?.celebrate(app); }
  }
  function settleHannaTile() {
    const q = M.question, slot = M.slots[q.slotIndex];
    if (Object.values(q.submissions).some(a => a.correct === null)) return;
    slot.used = true; slot.by = Object.entries(q.submissions).filter(([, a]) => a.correct).map(([i]) => +i); q.settled = true;
  }
  function judgeHanna(team, correct) {
    const q = M.question, a = q?.submissions[team]; if (!a || a.correct !== null || q.beat !== 'answer') return;
    a.correct = correct; a.delta = Model.hannaDelta(a.confidence, correct, M.slots[q.slotIndex].pts); M.teams[team].score += a.delta;
    settleHannaTile(); render(); if (correct) sound('success');
  }
  function installDiveAdapter() {
    if (M.diveNative) return;
    const native = M.diveNative = { startDive: global.startDive, nextQ: global.nextQ, openShell: global.openShell, answer: global.answer, done: global.done, bank: global.bank };
    // The native rule functions run once per action. Their film-independent score changes
    // are preserved; presentation callbacks wait for the player's Continue button.
    global.later = function () {};
    global.startB = function () {};
    global.show = function (id) {
      ['home', 'how', 'cfg', 'turn', 'dive', 'end', 'board', 'verdict'].forEach(x => global.$(x)?.classList.toggle('hidden', x !== id));
      if (id === 'turn') M.stage = 'handover';
      if (id === 'dive') M.stage = 'dive';
      if (id === 'end' || id === 'board') finishDiveResults();
    };
    global.done = function (title, kept, spent) {
      if (M.diveFinished) return; M.diveFinished = true;
      native.done(title, kept, spent); M.question = null; clearTimer(); render();
    };
    global.nextQ = function () {
      const s = global.S;
      M.history.read();
      s.pool = M.pool.filter(i => !M.used.has(i) && !M.history.has(i));
      M.question = null; clearTimer();
      native.nextQ(); render();
    };
    global.shellCats = function () {
      const s = global.S;
      return s.cats.filter(cat => s.pool.some(i => global.DATA.qs[i][0] === cat && !s.used[i] && !M.used.has(i) && !M.history.has(i)));
    };
  }
  function beginDiveGame() {
    installDiveAdapter();
    const s = global.S;
    s.crew = M.teams.length > 1; s.players = M.teams; s.pi = 0; s.cats = M.cats.slice();
    s.cap = M.settings.cap; s.breath = time() * 1000; s.noOpts = M.settings.options === 'hidden';
    s.boat = 0; s.used = {}; s.tm = [];
    startDive();
  }
  function startDive() {
    M.question = null; M.diveFinished = false;
    M.diveNative.startDive(); setStage('dive', 3); sound('bubble');
  }
  function openDiveShell(cat) {
    const s = global.S; if (M.question || s.lock || !s.shells?.includes(cat)) return;
    const savedPool = s.pool;
    let available = savedPool.filter(i => global.DATA.qs[i][0] === cat && !M.used.has(i) && !M.history.has(i));
    if (!available.length) { global.nextQ(); return; }
    const desired = { easy: 1, medium: 2, hard: 3 }[M.settings.difficulty];
    if (desired) {
      available.sort((a, b) => Math.abs((Model.level(a) || desired) - desired) - Math.abs((Model.level(b) || desired) - desired));
      const nearest = Math.abs((Model.level(available[0]) || desired) - desired);
      available = available.filter(i => Math.abs((Model.level(i) || desired) - desired) === nearest);
    }
    s.pool = available; M.diveNative.openShell(cat); s.pool = savedPool;
    const index = global.DATA.qs.indexOf(s.cur);
    if (index < 0) return;
    makeQuestion(index, s.pi || 0, undefined, global.breathFor(s.depth)); render();
  }
  function diveContinue() {
    if (!M.question?.settled) return;
    if (global.S.lost) global.done(M.question.timedOut ? 'نفد النفَس' : 'انقطعت الشبكة', false);
    else global.nextQ();
  }
  function diveBank() {
    const s = global.S;
    if (!s.pearls || s.lost || s.ending || !M.running) return;
    clearTimer(); M.diveNative.bank(); global.done('طلعتوا بالحصيلة', true);
  }
  function finishDiveResults() {
    const s = global.S;
    if (!s.crew) M.teams[0].p = s.lost ? 0 : s.pearls;
    M.running = false; M.question = null; clearTimer();
    const rank = Model.rank(M.teams, t => t.p || 0);
    M.result = { title: M.teams.length === 1 ? global.$('endTitle').textContent : rank.winners.length > 1 ? 'تعادل في حصيلة الرحلة' : 'أكبر حصيلة لفريق «' + M.teams[rank.winners[0]].n + '»', rows: rank.order.map(i => ({ index: i, score: M.teams[i].p || 0 })) };
    M.stage = 'results'; M.step = 4;
  }
  function poolLeft() {
    const left = global.DATA.cats.map(() => 0);
    for (const index of M.pool) if (!M.used.has(index) && !M.history.has(index)) left[global.DATA.qs[index][0]]++;
    return left;
  }
  function beginWar() {
    const w = global.G;
    w.players = M.teams.map((t, i) => ({ n: t.n, c: i })); w.cats = M.cats.slice();
    w.fuse = time() * 1000; w.winRule = M.settings.win; w.shots = M.settings.shots; w.noOpts = M.settings.options === 'hidden';
    w.deployMul = M.settings.flags; w.deployFree = M.settings.customFlags ? M.settings.customFlagsValue : -1; w.roomCfg = false;
    w.slotCat = global.WarEngine.buildSlots(w.cats, poolLeft(), Math.random);
    global.WarEngine.newWar(w, Math.random, poolLeft()); M.g = w;
    M.warMessage = ''; setStage('war', 3);
  }
  function tapIsland(index) {
    if (!M.running || M.question || M.stage !== 'war') return;
    const event = global.WarEngine.tap(M.g, index);
    M.warMessage = '';
    if (event.t === 'msg') M.warMessage = { deadBase: 'جزيرة خامدة؛ اختاروا غيرها.', guardOnly: 'لا يُهاجَم من جزيرة فيها الحارس وحده.', baseFixed: 'قاعدة هذا الدور ثابتة.', deadTarget: 'الجزيرة خامدة؛ اختاروا غيرها.', noRoute: 'اختاروا جزيرة متصلة بمسار.' }[event.code] || '';
    if (event.t === 'attack') {
      M.g.busy = true; global.WarEngine.startFight(M.g); warStep(global.WarEngine.fightNext(M.g));
    } else render();
  }
  function warNext() {
    if (!M.g || M.question || M.g.busy) return;
    M.warMessage = ''; warStep(global.WarEngine.next(M.g, poolLeft()));
  }
  function warStep(event) {
    if (!event) return;
    M.warMessage = '';
    if (event.t === 'over') { finishWar(event.why, event.winner); return; }
    if (event.t === 'ask') {
      if (event.defend) { M.pendingWarAsk = event; setStage('war-pass', 3); }
      else askWarQuestion(event);
      return;
    }
    if (event.t === 'result') {
      clearTimer(); M.question = null; M.warResult = event;
      M.g.busy = false; setStage('war-result', 3);
      if (event.kind === 'fall') { sound('success'); Motion?.celebrate(app); }
      return;
    }
    if (event.t === 'turnEnd') { M.g.busy = false; warStep(global.WarEngine.endTurn(M.g, poolLeft())); return; }
    M.g.busy = false; M.question = null;
    if (event.t === 'move') M.warMessage = 'انتقلت الملكية؛ تقدرون تنقلون الرايات إلى الجزيرة الجديدة.';
    if (!M.pool.some(i => !M.used.has(i) && !M.history.has(i))) { finishWar('dormant'); return; }
    setStage('war', 3);
  }
  function askWarQuestion(event) {
    const w = M.g; w.busy = true;
    let candidates = Model.shuffle(M.pool.filter(i => !M.used.has(i) && !M.history.has(i) && global.DATA.qs[i][0] === event.ci));
    const desired = { easy: 1, medium: 2, hard: 3 }[M.settings.difficulty];
    if (desired) candidates.sort((a, b) => Math.abs((Model.level(a) || desired) - desired) - Math.abs((Model.level(b) || desired) - desired));
    if (!candidates.length) { w.left = poolLeft(); warStep(global.WarEngine.fightAnswer(w, null, false)); return; }
    const index = candidates[0]; w.used[index] = 1;
    makeQuestion(index, event.pi, undefined, w.fuse); w.left = poolLeft();
    M.question.defend = event.defend; M.warMessage = '';
    setStage('war', 3);
  }
  function finishWar(reason = 'quit', nativeWinner = null) {
    clearTimer(); M.question = null; M.g.busy = false; M.g.phase = 'over'; M.running = false;
    const rows = M.teams.map((t, index) => ({ index, score: global.WarEngine.count(M.g, index), flags: global.WarEngine.banners(M.g, index) })).sort((a, b) => b.score - a.score || b.flags - a.flags || a.index - b.index);
    const victory = reason === 'victory' && Number.isInteger(nativeWinner) ? rows.find(row => row.index === nativeWinner) : null;
    const winners = victory ? [victory] : rows.filter(row => row.score === rows[0].score && row.flags === rows[0].flags);
    M.result = { reason, winnerIndices: winners.map(row => row.index), title: winners.length > 1 ? 'تعادل بين ' + winners.map(row => '«' + M.teams[row.index].n + '»').join(' و') : 'الفائز «' + M.teams[winners[0].index].n + '»', note: victory ? 'تحقّق شرط النصر في الحرب.' : reason === 'dormant' ? 'انتهت مغامرة الجزر؛ الحسم بالجزر ثم الرايات.' : 'الحسم بالجزر ثم الرايات.', rows };
    setStage('results', 4);
  }
  function installWarRoomLook() {
    if (M.warRoomLook) return; M.warRoomLook = true;
    const paint = global.paint, lobby = global.drawLobby, show = global.show;
    const roomEnd = global.$('roomEnd'), roomEndHome = roomEnd.parentNode;
    function syncRoomEnd(view = global.RM.view) {
      const activeHost = global.RM.on && global.RM.host && ['war', 'win'].includes(view);
      const parent = activeHost ? global.$(view) : roomEndHome;
      if (roomEnd.parentNode !== parent) parent.append(roomEnd);
      if (activeHost) roomEnd.textContent = 'إغلاق الغرفة';
    }
    global.show = function (id) { show(id); syncRoomEnd(id); };
    const roomWhy = global.roomWhy, roomMessage = global.rmMsg;
    global.rmMsg = function (message) {
      roomMessage(message);
      if (['welcome', 'snapshot'].includes(message.t) && global.RM.on && global.RM.code) {
        history.replaceState({ ...history.state, kunuzWarRoom: global.RM.code, kunuzWarRoomEntry: M.roomEntry }, '');
        M.resumingRoom = false;
      } else if (message.t === 'error' && !global.RM.on && ['ROOM_CLOSED', 'NOT_FOUND', 'BAD_TOKEN', 'OUTDATED', 'TOO_MANY', 'ROOM_FULL', 'STARTED'].includes(message.code)) {
        returnToRoomHubNotice(global.RMERR[message.code] || global.RMERR.ROOM_CLOSED);
      } else if (M.resumingRoom && message.t === 'error' && !global.RM.on) {
        M.resumingRoom = false; M.error = global.RMERR[message.code] || 'تعذّر الرجوع إلى الغرفة.';
        document.body.classList.remove('journey-room');
        history.replaceState({ journey: true, stage: 'room-entry', step: 0 }, '');
        setStage('room-entry', 0);
      }
    };
    global.roomWhy = q => roomWhy({ ...q, src: arabicSource(q.src) });
    global.paint = function () {
      paint();
      for (let k = 0; k < global.SLOTS.length; k++) {
        const island = global.$('g' + k), owner = global.G.own[k];
        if (!island || !Number.isInteger(owner)) continue;
        let marker = island.querySelector('.j-room-map-symbol');
        if (!marker) { marker = document.createElementNS('http://www.w3.org/2000/svg', 'g'); marker.classList.add('j-room-map-symbol'); marker.setAttribute('pointer-events', 'none'); island.insertBefore(marker, island.querySelector('.hit')); }
        if (marker.dataset.owner === String(owner)) continue;
        marker.dataset.owner = owner;
        const color = global.RM.snap?.teams[owner]?.color;
        const fill = global.PAL[color]?.[0] || colors[owner];
        marker.innerHTML = '<rect x="-24" y="-21" width="48" height="42" rx="14" fill="' + fill + '" stroke="#fff0b7" stroke-width="2"/><g transform="translate(-15 -15) scale(.3)" fill="#fff" stroke="#fff">' + sym(owner).replace(/<svg[^>]*>|<\/svg>/g, '') + '</g>';
      }
      const turn = global.$('tbWho');
      if (turn && !turn.querySelector('.j-native-symbol')) turn.insertAdjacentHTML('afterbegin', '<span class="j-native-symbol">' + sym(global.G.turn || 0) + '</span>');
      syncRoomEnd();
    };
    global.drawLobby = function () {
      lobby();
      document.querySelectorAll('#lobbyTeams .pcard').forEach((row, i) => row.insertAdjacentHTML('afterbegin', '<span class="j-native-symbol">' + sym(i) + '</span>'));
      syncRoomEnd('lobby');
    };
    global.roomLeaveWar = () => { if (!M.dialog) askDialog('تطلعون من الغرفة وترجعون للإعدادات؟', leaveRoomToSettings, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); };
  }
  async function enterRoom(join, preserveRoute = false, resume = false) {
    // Rooms continue to use the shipped front-end and worker's current protocol.
    // Local pack IDs are deliberately never sent to a server with a different bank.
    if (!join && usesRoomBank() && M.cats.some(c => !roomCategorySupported(c))) { M.error = 'الغرف تستعمل بنك خادمها الحالي. اختاروا فئات البنك للغرفة، أو العبوا بهذه الفئات على جهاز واحد.'; render(); return; }
    M.settings.roomCode = M.settings.roomCode.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
    if (!join && game === 'hanna' && M.settings.roomCode && !/^\d{4,6}$/.test(M.settings.roomCode)) { M.error = 'رمز الغرفة يكون من أربعة إلى ستة أرقام.'; render(); return; }
    if (!join && (game === 'hanna' && (!Number.isInteger(time()) || time() < 10 || time() > 600 || M.settings.reveals > 99) || game === 'harb' && (time() !== 0 && (time() < 3 || time() > 600 || !Number.isInteger(time() * 1000))))) { M.error = 'هذا الوقت أو رصيد الخيارات خارج ما يقبله خادم الغرف الحالي؛ اختاروا إعدادًا آخر أو العبوا على جهاز واحد.'; render(); return; }
    // A reload adds new native room entries; retain the original return position.
    const savedEntry = resume && entryHistory?.kunuzWarRoomEntry;
    M.roomEntry = savedEntry && Number.isInteger(savedEntry.length) && savedEntry.length > 0 && savedEntry.length <= history.length && [0, 1].includes(savedEntry.parent)
      ? savedEntry : { length: history.length, parent: history.state?.journey && history.state.step === 2 ? 1 : 0 };
    M.error = ''; cancelPlay(); M.stage = 'room'; M.step = 3; render();
    M.roomUrl = location.href;
    document.body.prepend(app);
    document.body.classList.add('journey-room');
    if (game === 'harb') {
      // Keep every native lobby, reconnect and phone action intact.
      installWarRoomLook();
      global.openRoomScreen();
      if (resume) { M.resumingRoom = true; global.$('roomBack').click(); return; }
      if (join) {
        global.$('roomJoin').click();
        setNativeInput(global.$('joinCode'), M.joinDraft);
        global.$('joinTeamBtn').click();
      }
      if (!join) {
        global.roomCfg();
        global.G.cats = M.cats.slice(); global.G.players = M.teams.map((t, i) => ({ n: t.n, c: i }));
        global.G.fuse = time() * 1000; global.G.noOpts = M.settings.options === 'hidden';
        global.G.shots = M.settings.shots; global.G.deployMul = M.settings.flags; global.G.deployFree = M.settings.customFlags ? M.settings.customFlagsValue : -1; global.G.winRule = M.settings.win;
        global.drawPlayers(); global.drawCats(); global.drawFuses(); global.drawOpMode(); global.drawShots(); global.drawDeploy(); global.drawWins();
        // The shared Start tap already supplied these validated settings. Follow
        // the native create action without asking for a second setup/start step.
        global.$('startWar').click();
      }
    } else if (game === 'hanna') {
      // The original room bundle is loaded only on explicit room entry, so local play
      // remains completely offline. It owns its credentials, reconnect and protocol.
      const css = ['Page-oyXYdFLk.css', 'index-BYf54ooy.css'];
      for (const file of css) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/hanna-laha/assets/' + file; document.head.append(link); }
      const module = document.createElement('script'); module.type = 'module'; module.src = '/hanna-laha/assets/index-iap-v1.js?v=20261025-kfix3';
      try { localStorage.setItem('hl-ezik.sound', 'false'); } catch (_) {}
      if (!join) {
        const roomColors = ['blue','orange','purple','green','gold','pink','teal','brown','navy','olive','red','maroon'];
        const setup = { teams: M.teams.map((t, i) => ({ name: t.n.trim() || defaults[i], color: roomColors[colors.indexOf(t.c)] || roomColors[i] })), perCat: 6, timeSec: time(), categories: M.cats.map(c => global.DATA.cats[c][0]), mode: M.settings.options === 'hidden' ? 'free' : 'options', reveals: M.settings.reveals, roomCode: M.settings.roomCode };
        // These are the existing room UI's own setup preferences, not account data.
        try { localStorage.setItem('hl-ezik.setup', JSON.stringify(setup)); localStorage.setItem('hl-ezik.sound', 'false'); } catch (_) {}
      }
      const route = join ? 'join' : 'setup';
      if (!preserveRoute) history.replaceState({ journey: true, step: 3, rooms: true }, '', '/hanna-laha/' + route + '?rooms=1');
      M.roomUrl = location.href;
      document.head.append(module);
      let entered = false;
      const routeObserver = new MutationObserver(() => {
        if (M.stage !== 'room') { routeObserver.disconnect(); return; }
        // The native room React tree owns #root. Observe route changes without
        // rewriting nodes there; external children break React reconciliation.
        const current = location.pathname;
        if (/\/host\/?$|\/j\/\d{4,6}\/?$/.test(current)) entered = true;
        if (entered && (/^\/hanna-laha\/?$/.test(current) || /\/setup\/?$/.test(current))) { routeObserver.disconnect(); leaveRoomToSettings(); return; }
        M.roomUrl = location.href;
      });
      routeObserver.observe(document.getElementById('root'), { childList: true, characterData: true, subtree: true });
      if (!join) bridgeHannaSetup();
    }
  }
  function bridgeHannaSetup() {
    // Use the existing form's own event handlers; no worker or auth contract changes.
    let tries = 0;
    const timer = setInterval(() => {
      const root = document.getElementById('root');
      if (!root || ++tries > 120) { clearInterval(timer); return; }
      const start = root.querySelector('[data-testid="setup-start"]');
      if (!start) return;
      if (M.settings.roomCode) {
        const more = root.querySelector('[data-testid="more-toggle"]');
        if (more?.getAttribute('aria-expanded') === 'false') { more.click(); return; }
        const field = root.querySelector('[data-testid="room-code"]');
        const input = root.querySelector('[data-testid="room-code-input"]');
        if (!input) { field?.querySelectorAll('button')[1]?.click(); return; }
        const displayedCode = input.value.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        if (displayedCode !== M.settings.roomCode) { setNativeInput(input, M.settings.roomCode); return; }
      }
      if (start.disabled) return;
      // The user's Start tap already authorized room creation. Once the unchanged
      // setup has validated our saved settings, follow its normal room/lobby path.
      clearInterval(timer); start.click();
    }, 100);
  }
  function setNativeInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function onAction(action, el) {
    if (game === 'board' && boardRooms?.handle(action, el)) return;
    if (M.joinOnly && !['join-room', 'join-submit', 'back', 'home', 'mute'].includes(action)) return;
    const q = M.question;
    if (action === 'mute') { M.muted = !M.muted; try { localStorage.setItem('kunuz_journey_muted_v1', M.muted ? '1' : '0'); } catch (_) {} if (M.muted) stopSounds(); render(); }
    else if (action === 'iap-purchase' && game === 'hub') { global.ezikIapOpenPurchase?.(); }
    else if (action === 'dismiss-home-notice' && game === 'hub') { M.homeNotice = null; render(); }
    else if (action === 'home') { if (M.running || M.stage === 'room' || M.stage === 'board-room') askDialog('تطلعون للرئيسية وتتركون اللعبة؟', confirmedHomeExit, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); else homeExit(); }
    else if (action === 'back') back();
    else if (action === 'create-room' && M.stage === 'room-entry') { if (M.ready) beginHostEntry(); else M.pendingStartupAction = 'create-room'; }
    else if (action === 'resume-room' && M.stage === 'room-entry' && savedWarRoom()) { if (M.ready) enterRoom(true, false, true); else M.pendingStartupAction = 'resume-room'; }
    else if (action === 'single-device' && M.stage === 'room-entry') { M.settings.room = false; M.error = ''; setStage('categories', 1, true); }
    else if (action === 'change-play-mode' && M.stage === 'settings' && hasRooms) { M.error = ''; setStage('room-entry', 0, true); }
    else if (action === 'join-submit' && M.stage === 'room-join') submitJoin();
    else if (action === 'room-code-open') openRoomCode();
    else if (action === 'room-code-random' && M.stage === 'room-code') { M.roomDraft = String(Math.floor(Math.random() * 10 ** roomCodeLimits.random)).padStart(roomCodeLimits.random, '0'); M.roomCodeError = ''; render(); }
    else if (action === 'room-code-save' && M.stage === 'room-code') saveRoomCode();
    else if (action === 'quiz-count' && game === 'test' && M.stage === 'settings' && quizCounts().includes(+el.dataset.count)) { M.quizCustomCount = false; M.quizCount = +el.dataset.count; render(); }
    else if (action === 'quiz-options' && game === 'test' && M.stage === 'settings') { M.settings.options = M.settings.options === 'shown' ? 'hidden' : 'shown'; render(); }
    else if (action === 'quiz-all' && game === 'test' && M.stage === 'categories') { M.cats = quizCatalog().map(c => c.index); render(); }
    else if (action === 'quiz-clear' && game === 'test' && M.stage === 'categories') { M.cats = []; render(); }
    else if (action === 'quiz-start' && game === 'test') { if (M.ready) beginQuiz(); else M.pendingStartupAction = 'quiz-start'; }
    else if (action === 'quiz-again' && game === 'test') resetQuiz();
    else if (action === 'cat') { const c = +el.dataset.cat, i = M.cats.indexOf(c); if (i >= 0) M.cats.splice(i, 1); else if (game === 'test' || M.cats.length < 6) M.cats.push(c); M.error = ''; render(); }
    else if (action === 'next-setup') {
      if (game === 'test' ? M.cats.length > 0 : M.cats.length >= 3 && M.cats.length <= 6) {
        if (game === 'test' && !M.quizCustomCount && !quizCounts().includes(M.quizCount)) M.quizCount = quizCounts()[0];
        if (game === 'test' && M.quizCustomCount && !quizCountError()) M.quizCount = Math.min(Number(M.quizCountDraft), quizAvailable());
        M.error = ''; setStage('settings', 2, true);
      }
    }
    else if (action === 'add-team') { if (M.teams.length < limits[game][1]) { M.teams.push(teamNew(M.teams.length)); render(); } }
    else if (action === 'remove-team') { if (M.teams.length > limits[game][0]) { M.teams.splice(+el.dataset.team, 1); render(); } }
    else if (action === 'color') { const t = M.teams[+el.dataset.team], current = colors.indexOf(t.c); t.c = colors[(current + 1) % colors.length]; t.symbol = (t.symbol + 1) % 6; render(); }
    else if (action === 'setting') {
      const field = el.dataset.field, value = el.dataset.value;
      if (field === 'time') { M.settings.custom = value === 'custom'; if (!M.settings.custom) M.settings.time = +value; }
      else if (field === 'flags') { M.settings.customFlags = value === 'custom'; if (!M.settings.customFlags) M.settings.flags = +value; }
      else if (['cap', 'win'].includes(field)) M.settings[field] = +value;
      else M.settings[field] = value === 'true' ? true : value === 'false' ? false : value;
      M.error = ''; M.roomStartError = ''; render();
      if (field === 'room' && M.settings.room) window.scrollTo(0, 0);
    }
    else if (action === 'start') { if (M.ready) beginWithIap(); else M.pendingStartupAction = 'start'; }
    else if (action === 'tile') openTile(+el.dataset.slot);
    else if (action === 'show-options' && q && !q.settled && !shownOptions(q)) { const team = M.teams[q.activeTeam ?? q.actor]; if (team.shows > 0) { team.shows--; q.showTeams.add(q.activeTeam ?? q.actor); render(); } }
    else if (action === 'answer' && q && !q.settled && !q.answerRevealed && !q.burned.has(+el.dataset.answer)) {
      const answer = +el.dataset.answer;
      if (game === 'ghaws' || game === 'harb' || game === 'test') { q.selected = answer; settle(answer === questionText(q)[5]); }
      else if (game !== 'hanna' || q.confidence) { q.selected = answer; render(); }
    }
    else if (action === 'confirm-answer' && q && q.selected !== null && !q.settled) { if (game === 'hanna') hannaLock(false); else settle(q.selected === questionText(q)[5]); }
    else if (action === 'reveal-answer') revealAnswer();
    else if ((action === 'judge-yes' || action === 'judge-no') && q && q.answerRevealed && !q.settled) { q.manual = true; settle(action === 'judge-yes'); }
    else if (action === 'award') award(+el.dataset.team);
    else if (action === 'question-next' && q?.settled) returnBoard();
    else if (action === 'confidence' && q && !q.beat) { q.confidence = el.dataset.mode; render(); }
    else if (action === 'hanna-team' && q && !q.submissions[+el.dataset.team]) { q.activeTeam = +el.dataset.team; q.selected = null; q.confidence = null; render(); }
    else if (action === 'hanna-manual') hannaLock(true);
    else if (action === 'hanna-reveal') hannaReveal();
    else if (action === 'hanna-judge') judgeHanna(+el.dataset.team, el.dataset.right === 'true');
    else if (action === 'shell') openDiveShell(+el.dataset.cat);
    else if (action === 'dive-next') diveContinue();
    else if (action === 'dive-bank') diveBank();
    else if (action === 'dive-begin') startDive();
    else if (action === 'dive-light' && q && global.S.tools.light && shownOptions(q) && !q.settled) { const data = questionText(q); global.S.tools.light = false; Model.shuffle(data[4].map((_, i) => i).filter(i => i !== data[5])).slice(0, Math.min(2, data[4].length - 2)).forEach(i => q.burned.add(i)); render(); }
    else if (action === 'dive-hint' && q && global.S.tools.nokh && !global.nokhBlind() && !q.settled) { global.S.tools.nokh = false; q.hint = global.nokhChar(questionText(q)); render(); }
    else if (action === 'war-next') warNext();
    else if (action === 'war-undo' && !M.question) { global.WarEngine.undo(M.g); M.warMessage = ''; render(); }
    else if (action === 'war-answer-next' && q?.settled) { M.question = null; warStep(M.warEvent); }
    else if (action === 'war-result-next') { M.g.left = poolLeft(); warStep(global.WarEngine.afterResult(M.g, M.warResult)); }
    else if (action === 'war-defend') askWarQuestion(M.pendingWarAsk);
    else if (action === 'finish-war') askDialog('تنهون حرب الجزر؟', () => finishWar(), () => {}, { yes: 'نعم، ننهي', no: 'لا، نكمل' });
    else if (action === 'leave') askDialog('تتركون اللعبة وترجعون للفرق والإعدادات؟', leaveToSettings);
    else if (action === 'dialog-yes') closeDialog(true);
    else if (action === 'dialog-no') closeDialog(false);
    else if (action === 'again') restartSetup();
    else if (action === 'reload') location.reload();
    else if (action === 'join-room' && M.stage === 'room-entry') openJoin();
  }
  app.addEventListener('click', event => {
    const island = event.target.closest('[data-island]'), el = event.target.closest('[data-action]'), gameEntry = event.target.closest('[data-game-entry]');
    M.audioUnlocked = true;
    if (!island && !el && !gameEntry) return;
    if (gameEntry) event.preventDefault();
    if (el?.disabled) return;
    const now = performance.now();
    // Ignore the second tap in a burst, including when the first action replaced its DOM.
    const actionKey = island ? 'island:' + island.dataset.island : gameEntry ? 'game:' + gameEntry.dataset.gameEntry : el.dataset.action + ':' + (el.dataset.cat ?? el.dataset.slot ?? el.dataset.team ?? el.dataset.answer ?? el.dataset.field ?? '') + ':' + (el.dataset.value ?? el.dataset.mode ?? '');
    const samePosition = Math.abs(event.clientX - (M.lastX ?? -999)) < 10 && Math.abs(event.clientY - (M.lastY ?? -999)) < 10;
    if (now - M.lastAction < 220 && (M.lastKey === actionKey || samePosition)) return;
    M.lastAction = now; M.lastKey = actionKey; M.lastX = event.clientX; M.lastY = event.clientY; sound('tap');
    if (island) tapIsland(+island.dataset.island);
    else if (gameEntry) {
      const gameId = gameEntry.dataset.gameEntry, destination = gameEntry.dataset.gamePath;
      if (typeof global.ezikIapCheckGameAccess !== 'function') { M.error = 'تعذّر التحقق من رصيد الحساب. أعدوا تحميل الصفحة.'; render(); }
      else global.ezikIapCheckGameAccess(gameId, () => { location.href = destination; }, destination);
    } else onAction(el.dataset.action, el);
    if (game === 'test') saveQuizDraft();
    if (Motion) { const rect = app.getBoundingClientRect(); Motion.tapRipple(app, { x: event.clientX - rect.left, y: event.clientY - rect.top }); }
  });
  app.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.hasAttribute('data-join-draft')) { event.preventDefault(); submitJoin(); }
    const island = event.target.closest('[data-island]');
    if (island && ['Enter', ' '].includes(event.key)) { event.preventDefault(); tapIsland(+island.dataset.island); }
  });
  app.addEventListener('input', event => {
    const el = event.target;
    if (game === 'board' && boardRooms?.input(el)) return;
    if (game === 'test' && el.dataset.quizNumber) {
      el.value = roomDigits(el.value);
      if (el.dataset.quizNumber === 'count') { M.quizCustomCount = true; M.quizCountDraft = el.value; }
      else { M.settings.custom = true; M.quizTimeDraft = el.value; }
      updateQuizFields(); return;
    }
    if (el.hasAttribute('data-join-draft')) {
      M.joinDraft = roomDigits(el.value); el.value = M.joinDraft; M.joinError = '';
      el.setAttribute('aria-invalid', 'false'); el.setAttribute('aria-describedby', 'j-room-entry-help'); app.querySelector('#j-room-entry-error')?.remove(); return;
    }
    if (el.hasAttribute('data-room-draft')) {
      M.roomDraft = roomDigits(el.value); el.value = M.roomDraft; M.roomCodeError = '';
      el.setAttribute('aria-invalid', 'false'); el.setAttribute('aria-describedby', 'j-room-flow-help'); app.querySelector('#j-room-flow-error')?.remove();
      return;
    }
    if (el.hasAttribute('data-team-name')) M.teams[+el.dataset.teamName].n = el.value;
    if (el.dataset.input) M.settings[el.dataset.input] = el.dataset.input === 'roomCode' ? el.value : el.value === '' ? NaN : Number(el.value);
  });
  app.addEventListener('focusin', event => {
    if (game !== 'test' || !event.target.dataset.quizNumber) return;
    if (event.target.dataset.quizNumber === 'count') M.quizCustomCount = true; else M.settings.custom = true;
    updateQuizFields();
  });
  const keepFocusedInputVisible = () => {
    const active = document.activeElement, viewport = global.visualViewport;
    const editable = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    const keyboardOpen = !!(editable && viewport && global.innerHeight - viewport.height > 80);
    app.classList.toggle('kfix-keyboard-open', keyboardOpen);
    const main = app.querySelector('.j-content');
    if (keyboardOpen && main) {
      activeScreenMotion?.cancel(); activeScreenMotion = null;
      main.style.removeProperty('transform');
    }
    if (!keyboardOpen) {
      app.style.removeProperty('--kfix-vv-height');
      app.style.removeProperty('--kfix-vv-bottom');
      app.style.removeProperty('--kfix-main-top');
      if (main) { main.style.maxHeight = ''; main.style.overflowY = ''; main.style.overscrollBehavior = ''; }
      return;
    }
    if (!main) return;
    const top = Math.max(0, main.getBoundingClientRect().top - viewport.offsetTop);
    app.style.setProperty('--kfix-vv-height', viewport.height + 'px');
    app.style.setProperty('--kfix-vv-bottom', Math.max(0, global.innerHeight - viewport.offsetTop - viewport.height) + 'px');
    app.style.setProperty('--kfix-main-top', top + 'px');
    if (main) { main.style.maxHeight = Math.max(180, viewport.offsetTop + viewport.height - main.getBoundingClientRect().top - 12) + 'px'; main.style.overflowY = 'auto'; main.style.overscrollBehavior = 'contain'; }
    global.requestAnimationFrame(() => {
      const visibleTop = viewport.offsetTop + 8, viewportBottom = viewport.offsetTop + viewport.height;
      const fieldRect = active.getBoundingClientRect();
      const actions = Array.from(main.querySelectorAll('.j-actions button:not([disabled])')).filter(button => button.getClientRects().length);
      const action = actions[actions.length - 1];
      let visibleBottom = viewportBottom - 12;
      if (action) {
        const actionRect = action.getBoundingClientRect();
        visibleBottom = Math.min(visibleBottom, actionRect.top - 12);
      }
      let minScroll = fieldRect.bottom - visibleBottom, maxScroll = fieldRect.top - visibleTop;
      if (action) {
        const actionRect = action.getBoundingClientRect();
        minScroll = Math.max(minScroll, actionRect.bottom - visibleBottom);
        maxScroll = Math.min(maxScroll, actionRect.top - visibleTop);
      }
      if (minScroll > maxScroll) {
        minScroll = fieldRect.bottom - visibleBottom;
        maxScroll = fieldRect.top - visibleTop;
      }
      const delta = minScroll > 0 ? minScroll : maxScroll < 0 ? maxScroll : 0;
      if (delta) main.scrollTop += delta;
    });
  };
  document.addEventListener('focusin', () => global.setTimeout(keepFocusedInputVisible, 60), true);
  global.visualViewport?.addEventListener('resize', keepFocusedInputVisible);
  global.visualViewport?.addEventListener('scroll', keepFocusedInputVisible);
  global.addEventListener('orientationchange', keepFocusedInputVisible);
  global.addEventListener('popstate', event => {
    if (game === 'board' && boardRooms?.active && M.stage === 'board-room') {
      event.stopImmediatePropagation(); history.pushState({ journey: true, rooms: true, step: 3 }, '', M.boardRoomUrl); boardRooms.handle('back', app); return;
    }
    // A synthetic hub entry can share the quiz document's forward entries.
    // Reload that route before the hub renderer sees a quiz-only history step.
    if (game === 'hub' && event.state?.quiz && event.state.stage !== 'hub') {
      event.stopImmediatePropagation(); location.replace('/quest-test.html'); return;
    }
    if (M.roomLeavingUrl) {
      event.stopImmediatePropagation();
      const target = M.roomLeavingUrl; M.roomLeavingUrl = '';
      location.replace(target);
      return;
    }
    if (game === 'test') {
      event.stopImmediatePropagation();
      const target = event.state;
      if (!target?.quiz) { saveQuizDraft(); location.replace('/quest.html'); return; }
      if (M.stage === 'test-question' && M.running && target?.stage !== 'test-question' && target?.stage !== 'results') askDialog('تترك الأسئلة وترجع للإعداد؟', () => quizHistoryStage(target.stage, target.step), () => history.forward());
      else quizHistoryStage(target?.stage, target?.step);
      return;
    }
    if (M.stage === 'room') {
      if (M.roomFromEntry && /\/join\/?$/.test(location.pathname)) return;
      event.stopImmediatePropagation();
      // The legacy war listener was registered first and may already have shown
      // its old setup. Restore its still-live view before asking to leave it.
      if (game === 'harb' && global.RM.on) {
        const view = global.RM.view;
        for (const id of ['home', 'how', 'cfg', 'room', 'join', 'lobby', 'war', 'win', 'verdict']) global.$(id)?.classList.toggle('hidden', id !== view);
      }
      history.pushState({ journey: true, step: 3, rooms: true }, '', M.roomUrl || location.href);
      if (!M.dialog) back();
      return;
    }
    event.stopImmediatePropagation();
    if (M.skipPop) { M.skipPop = false; return; }
    if (hasRooms && M.stage === 'room-entry' && event.state?.stage === 'room-entry') { history.back(); return; }
    if (hasRooms && !M.running && ['room-entry', 'room-code', 'room-join', 'categories', 'settings'].includes(event.state?.stage)) {
      M.settings.room = event.state.room; M.roomCodeEntry = !!event.state.roomCodeEntry;
      M.error = ''; M.roomCodeError = ''; M.joinError = '';
      setStage(event.state.stage, event.state.step); return;
    }
    if (event.state?.roomCode && game === 'hanna' && M.settings.room) { M.roomDraft = M.settings.roomCode; M.roomCodeError = ''; setStage('room-code', 2); return; }
    const step = event.state?.step;
    if (M.questionHistory && M.question) {
      M.questionHistory = false;
      if (M.question.settled) returnBoard(); else askDialog(game === 'hanna' && M.question.answerRevealed ? 'تتركون التحكيم المتبقي وترجعون للوحة؟' : 'ترجعون للوحة وتتركون السؤال بلا نقاط؟', abandonQuestion, () => { history.pushState({ journey: true, step: 3, question: true }, ''); M.questionHistory = true; });
      return;
    }
    if (M.running && step !== 3) { askDialog('تتركون اللعبة وترجعون للفرق والإعدادات؟', leaveToSettings, () => { history.pushState({ journey: true, step: 3 }, ''); }); return; }
    if (step === 1) setStage('categories', 1); else if (step === 2) setStage('settings', 2); else if (step === 3 && M.g) setStage(['board', 'test', 'hanna'].includes(game) ? 'board' : game === 'harb' ? 'war' : 'dive', 3);
  }, true);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); stopSounds(); cancelVisuals(); }
    else { if (hiddenAt && M.question) { M.question.deadline += performance.now() - hiddenAt; M.question.started += performance.now() - hiddenAt; } hiddenAt = 0; if (M.stage === 'hub' || M.stage === 'dive') render(); }
  });
  document.addEventListener('click', event => {
    if (M.stage !== 'room') return;
    const target = event.target.closest('button');
    const hannaExit = game === 'hanna' && target?.matches('#root header[class*=_topBar_] > button:first-child');
    const warExit = game === 'harb' && target && ['tbExit', 'roomEnd'].includes(target.id);
    if (!hannaExit && !warExit) return;
    event.preventDefault(); event.stopImmediatePropagation(); M.audioUnlocked = true; sound('tap');
    if (hannaExit && M.roomFromEntry && /\/join\/?$/.test(location.pathname)) { history.back(); return; }
    const close = warExit && target.id === 'roomEnd' ? target.onclick : null;
    askDialog(close && global.RM.host ? 'تغلقون الغرفة وترجعون للإعدادات؟' : 'تطلعون من الغرفة وترجعون للإعدادات؟', () => { const hostClose = close && global.RM.host; if (close) { const result = close.call(target); if (hostClose && result && typeof result.then === 'function') { result.then(ack => { if (!ack) returnToRoomHubNotice(global.RMERR.ROOM_CLOSED); }, () => returnToRoomHubNotice(global.RMERR.ROOM_CLOSED)); return; } } leaveRoomToSettings(); }, () => {}, { yes: close && global.RM.host ? 'نعم، نغلق' : 'نعم، نطلع', no: 'لا، نبقى' });
  }, true);
  document.addEventListener('click', event => {
    if (M.stage === 'room' && event.target.closest('#root button')) { M.audioUnlocked = true; sound('tap'); }
  });
  const motionPreference = global.matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change', () => { cancelVisuals(); if (!document.hidden) render(); });
  global.addEventListener('pagehide', event => { clearTimer(); stopSounds(); cancelVisuals(); if (!event.persisted) Motion?.dispose(); });
  global.addEventListener('pageshow', event => { if (event.persisted) { render(); if (game === 'test' && M.stage !== 'test-question') return; if (game === 'test' && M.question?.settled && M.running) scheduleQuizNext(M.question); else if (M.question && !M.question.settled && !M.question.answerRevealed && !M.question.beat) startTimer(); } });
  global.KunuzJourney = Object.freeze({ get state() { return M; }, get boardRooms() { return boardRooms?.diagnostics || null; }, get diagnostics() { return { bankStamp: typeof global.seenStamp === 'function' ? global.seenStamp() : '', offlineReady: M.offlineReady, excluded: M.excluded, fallback: M.fallback, categories: game === 'hub' ? [] : Model.categories().map(c => ({ name: c.name, total: c.count })) }; } });
  function loadLocalScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src;
      script.onload = resolve; script.onerror = () => reject(new Error('A local Kunuz file could not be loaded. Reconnect once, then try again.'));
      document.head.append(script);
    });
  }
  async function loadKunuzLocal() {
    const version = '?v=' + OFFLINE_VERSION;
    const sources = ['/quest-data/kunuz-bank-3147.js', '/quest-data/kunuz-geo-index.js', '/quest-data/kunuz-packs-manifest.js', '/quest-visual.js', '/quest-levels.js'];
    if (game === 'hanna') sources.splice(1, 0, '/quest-theme/history.js');
    for (const src of sources) await loadLocalScript(src + version);
    global.dispatchEvent(new Event('kunuz-bank-ready'));
  }
  async function loadHannaLocal() {
    // Direct room URLs stay outside the local bank/pack engine. Local Hanna uses
    // that engine only after the entry route has been classified below.
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/quest-visual.css?v=' + OFFLINE_VERSION; document.head.append(css);
    await loadKunuzLocal();
  }
  async function boot() {
    // Mount before parser-blocking legacy bank/engine scripts. They stay hidden.
    render(); global.KunuzThemeBoot?.mounted();
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    if (global.KunuzThemeBoot?.status === 'fallback') return;
    const resumeWarOnReload = game === 'harb' && entryHistory?.kunuzWarRoom === String(savedWarRoom()?.code) && global.performance.getEntriesByType('navigation')[0]?.type === 'reload';
    document.querySelectorAll('#qvis').forEach(el => { el.id = 'legacy-qvis'; });
    if (game === 'hub') {
      render();
      if (typeof global.ezikIapEnterHome === 'function') global.ezikIapEnterHome(setHomeNotice).catch(() => {});
      await prepareOffline();
      loadLocalScript('/quest-i18n.js?v=' + OFFLINE_VERSION).catch(() => {});
      M.ready = true; return;
    }
    const params = new URLSearchParams(location.search);
    const joinRoute = game === 'hanna' && /^\/hanna-laha\/(?:join|j\/\d{4,6})\/?$/.test(path);
    const boardJoinRoute = game === 'board' && /^\d{4,6}$/.test(params.get('board') || '');
    M.joinOnly = hasRooms && params.get('iap_join') === '1';
    if (!joinRoute && !boardJoinRoute && !M.joinOnly) {
      const pageGate = global.ezikIapPageGate;
      if (!pageGate && typeof global.ezikIapCheckGameAccess !== 'function') return;
      const allowed = pageGate ? await pageGate : await new Promise(resolve => {
        global.ezikIapCheckGameAccess(game, () => resolve(true), path + location.search + location.hash);
      });
      if (!allowed) return;
    }
    if (game === 'hanna' && (/^\/hanna-laha\/(?:join|host|j\/\d{4,6})\/?$/.test(path) || /\/setup\/?$/.test(path) && params.has('rooms'))) {
      M.roomFromEntry = new URLSearchParams(location.search).get('entry') === '1';
      M.ready = true; await enterRoom(true, true); return;
    }
    if (game !== 'test') history.replaceState({ journey: true, step: 1 }, '');
    const setupRoute = new URLSearchParams(location.search).get('setup') === '1';
    const earlyEntry = !resumeWarOnReload && !boardJoinRoute && !setupRoute;
    if (earlyEntry && hasRooms && !M.joinOnly) {
      const draft = entryHistory?.entryDraft;
      if (draft && Array.isArray(draft.cats) && Array.isArray(draft.teams)) { M.cats = draft.cats; M.teams = draft.teams; Object.assign(M.settings, draft.settings); }
      setStage('room-entry', 0);
    } else if (earlyEntry && game === 'test') initQuizSetup();
    else if (earlyEntry && game !== 'test') setStage('categories', 1);
    else render();
    try {
      await prepareOffline();
      if (game === 'hanna') await loadHannaLocal();
      else await loadKunuzLocal();
      if (game === 'ghaws' || game === 'harb') loadLocalScript('/quest-i18n.js?v=' + OFFLINE_VERSION).catch(() => {});
      if (!global.DATA || !global.KZV) throw new Error('ملفات المغامرة غير متاحة. افتحوا الصفحة متصلين مرة لتكتمل الملفات المحلية.');
      await global.KZV.ready;
      warmLocalAssets().catch(() => {});
      if (global.LEVELS_EXPERIMENT !== false) await new Promise(resolve => { let tries = 0; const timer = setInterval(() => { if (global.KUNUZ_LEVELS || ++tries >= 80) { clearInterval(timer); resolve(); } }, 25); });
      const availableCategories = Model.categories();
      M.excluded = availableCategories.filter(c => c.count < Model.PER_CATEGORY);
      const usableCategories = new Set((game === 'test' ? quizCatalog() : availableCategories.filter(c => c.count >= Model.PER_CATEGORY)).map(c => c.index));
      M.cats = M.cats.filter(index => usableCategories.has(index));
      if (game === 'test' && !M.quizCustomCount && !quizCounts().includes(M.quizCount) && quizCounts().length) M.quizCount = quizCounts()[0];
      if (M.stage === 'settings' && M.cats.length < (game === 'test' ? 1 : 3)) { M.stage = 'categories'; M.step = 1; }
      M.ready = true;
      if (game === 'board') {
        boardRooms = global.KunuzBoardRooms.attach({ state: M, app, render, esc, ar, button, digits: roomDigits, colors, sym, time, paintTime, askDialog, boardView, boardQuestion, teamBar, timerMarkup });
        if (!M.joinOnly && M.stage === 'room-entry' && !M.pendingStartupAction && boardRooms.resume()) return;
      }
      if (resumeWarOnReload) { await enterRoom(true, false, true); return; }
      if (M.joinOnly && M.stage === 'room-entry') { history.replaceState({ journey: true, stage: 'room-entry', step: 0 }, '', location.pathname + '?iap_join=1'); setStage('room-entry', 0); return; }
      if (new URLSearchParams(location.search).get('setup') === '1') {
        try {
          const draft = JSON.parse(sessionStorage.getItem('kunuz_journey_room_setup_v1')); sessionStorage.removeItem('kunuz_journey_room_setup_v1');
          if (draft?.game === game && (!hasRooms || draft.returnFromRoom === true && Date.now() - draft.savedAt >= 0 && Date.now() - draft.savedAt < 300000) && Array.isArray(draft.cats) && draft.cats.length >= 3 && draft.cats.length <= 6 && draft.cats.every(c => Number.isInteger(c) && global.DATA.cats[c]) && Array.isArray(draft.teams) && draft.teams.length >= limits[game][0] && draft.teams.length <= limits[game][1]) {
            M.cats = draft.cats; M.teams = draft.teams.map((t, i) => ({ ...teamNew(i), n: String(t.n), c: colors.includes(t.c) ? t.c : colors[i], symbol: Number.isInteger(t.symbol) ? t.symbol % 6 : i }));
            for (const key of Object.keys(M.settings)) if (typeof draft.settings?.[key] === typeof M.settings[key]) M.settings[key] = draft.settings[key];
            history.replaceState({ journey: true, step: 1, ...(hasRooms ? { stage: 'categories', room: M.settings.room } : {}) }, '', location.pathname); setStage('settings', 2, true); return;
          }
        } catch (_) {}
      }
      if (M.pendingStartupAction) {
        const pending = M.pendingStartupAction; M.pendingStartupAction = '';
        if (pending === 'start' && M.stage === 'settings') { beginWithIap(); return; }
        if (pending === 'quiz-start' && M.stage === 'settings') { beginQuiz(); return; }
        if (pending === 'create-room' || pending === 'resume-room') { onAction(pending, null); return; }
      }
      if (hasRooms) {
        if (M.stage === 'room-entry' && restoreHostResume()) {
          history.replaceState({ journey: true, stage: 'room-entry', step: 0 }, '', location.pathname);
          setStage('room-entry', 0);
          beginHostEntry();
          return;
        }
        if (M.stage === 'loading') M.stage = 'room-entry';
        if (M.stage === 'room-entry') history.replaceState({ journey: true, step: 0, stage: 'room-entry', room: M.settings.room }, '');
      } else if (M.stage === 'loading') {
        if (game === 'test') { initQuizSetup(); return; }
        M.stage = 'categories'; M.step = 1;
      }
      render();
    } catch (error) { M.error = error.message; setStage('error', 1); }
  }
  boot();
})(window);
