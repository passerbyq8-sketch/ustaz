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
  const names = { hub: 'كنوز المعرفة', ghaws: 'الغوص', harb: 'حرب الجزر', test: 'اختبر معلوماتك', board: 'تحدّي الفئات', hanna: 'حنّا لها' };
  const limits = { ghaws: [1, 6], harb: [2, 4], test: [1, 4], board: [2, 4], hanna: [2, 12] };
  const colors = ['#2482a4', '#cb785e', '#7b66c7', '#25856c', '#aa791e', '#b34b81', '#397889', '#88633e', '#555aa0', '#718047', '#a54347', '#715b89'];
  const defaults = ['الموج', 'الشروق', 'الأفق', 'المدى', 'النور', 'الندى', 'الذهب', 'الفضة', 'السحاب', 'الواحة', 'المرسى', 'الشاطئ'];
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
  const catIcon = c => Icons.category(global.DATA.cats[c][0], c);
  const catName = c => global.DATA.cats[c][1];
  const teamNew = i => ({ n: defaults[i], c: colors[i], symbol: i, score: 0, shows: 2 });
  const M = {
    game, ready: false, step: game === 'hub' ? 0 : 1, stage: game === 'hub' ? 'hub' : 'loading', cats: [], teams: [],
    settings: { options: 'shown', reveals: 2, time: 30, customTime: 25, custom: false, difficulty: game === 'ghaws' ? 'depth' : game === 'harb' ? 'mixed' : 'points', cap: 10, shots: 1, flags: 2, customFlags: false, customFlagsValue: 12, win: 2, room: false, roomCode: '' },
    slots: [], pool: [], used: new Set(), question: null, g: null, error: '', dialog: null, running: false,
    fallback: [], excluded: [], questionHistory: false, skipPop: false, lastStage: '', warMessage: '', warEvent: null, diveNative: null,
    result: null, audioUnlocked: false, muted: false, timer: null, lastAction: -Infinity, offlineReady: false
  };
  if (game !== 'hub') M.teams = Array.from({ length: limits[game][0] }, (_, i) => teamNew(i));
  try { M.muted = localStorage.getItem('kunuz_journey_muted_v1') === '1'; } catch (_) {}
  const app = document.createElement('div'); app.className = 'journey-app'; app.dataset.game = game;
  document.body.classList.add('ezik-treasure-theme'); document.body.append(app);
  const themeMeta = document.querySelector('meta[name="theme-color"]'); if (themeMeta) themeMeta.content = '#082c38';
  const THEME_VERSION = '20261021-room1';
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
    } catch (_) {
      try {
        const registrations = await Promise.all(['/quest.html', '/hanna-laha/'].map(url => navigator.serviceWorker.getRegistration(url)));
        M.offlineReady = registrations.every(registration => registration?.active?.scriptURL.endsWith('/quest-sw.js'));
      } catch (_) { M.offlineReady = false; }
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
  function button(label, action, className = 'j-btn', attrs = '') { return '<button type="button" class="' + className + '" data-action="' + action + '" ' + attrs + '>' + label + '</button>'; }
  function chips(items, current, field) {
    return '<div class="j-chips">' + items.map(([value, label]) => button(esc(label), 'setting', 'j-chip', 'data-field="' + field + '" data-value="' + esc(value) + '" aria-pressed="' + (String(current) === String(value)) + '"')).join('') + '</div>';
  }
  function header() {
    const audioIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>' + (M.muted ? '<path d="m17 9 5 6m0-6-5 6"/>' : '<path d="M17 8q5 4 0 8M16 11q2 1 0 2"/>') + '</svg>';
    return '<header class="j-header">' + (game !== 'hub' ? button('›', 'back', 'j-icon-btn j-back', 'aria-label="رجوع"') : '') + (game === 'hub' ? '<div class="j-brand">عزك<small>كنوز المعرفة</small></div>' : '<h1>' + names[game] + '</h1>') + (M.running ? '<span class="j-counter" aria-label="تقدم اللعب">' + ar(played()) + ' من ' + ar(M.slots.length || M.pool.length) + '</span>' : '') + button(audioIcon, 'mute', 'j-icon-btn', 'aria-label="' + (M.muted ? 'تشغيل الصوت' : 'كتم الصوت') + '" aria-pressed="' + !M.muted + '"') + button(Icons.icon('home'), 'home', 'j-icon-btn', 'aria-label="الرئيسية"') + '</header>';
  }
  function stepper() {
    if (!M.step || M.stage === 'results') return '';
    return '<nav class="j-stepper" aria-label="خطوات اللعبة">' + ['الفئات', 'الفرق والإعدادات', 'اللعب'].map((text, i) => '<span' + (M.step === i + 1 ? ' aria-current="step"' : '') + '>' + ar(i + 1) + ' ' + text + '</span>').join('<span aria-hidden="true">·</span>') + '</nav>';
  }
  function home() {
    return '<div class="j-home-heading"><h1>وين مغامرتك اليوم؟</h1><p>العب، تعلّم… واكتشف كنزك القادم.</p></div>' +
      '<a class="j-featured" href="/quest-ghaws.html"><img src="/quest-theme/assets/ocean-clean.webp?v=20261021-room1" alt="مشهد البحر وصندوق الكنوز"><div class="j-info"><span class="j-tag">رحلة في الأعماق</span><h2>الغوص</h2><p>كل إجابة… تنزلك أعمق.</p><span class="j-btn">ابدأ الغوص ←</span></div></a>' +
      '<div class="j-games">' + [
        ['harb', '/quest-harb.html', 'مع الربع', 'افتحوا الجزر بمعرفتكم', 'map'],
        ['test', '/quest-test.html', 'فردي أو فرق', 'تحدٍّ جديد في كل سؤال', 'compass'],
        ['board', '/quest-board.html', 'تحدّي الفرق', 'اختاروا الفئة والنقاط', 'cards'],
        ['hanna', '/hanna-laha/', 'حماس الجمعة', 'تتوقّع… ولا قدّها؟', 'bolt']
      ].map(([kind, url, tag, line, icon]) => '<a class="j-game-card j-card-' + (kind === 'harb' ? 'island' : kind) + '" href="' + url + '">' + (kind === 'harb' ? '<img src="/quest-theme/assets/islands.webp?v=20261021-room1" alt="خريطة جزر الكنوز">' : Icons.icon(icon)) + '<span class="j-tag">' + tag + '</span><h2>' + names[kind] + '</h2><p>' + line + '</p></a>').join('') + '</div>';
  }
  function categories() {
    const all = Model.categories().filter(c => c.count >= Model.PER_CATEGORY);
    function section(list, title) {
      return '<h2 class="j-divider">' + title + '</h2><div class="j-category-picker">' + list.map(c => {
        const selected = M.cats.includes(c.index), disabled = !selected && M.cats.length >= 6;
        return button(catIcon(c.index) + '<b>' + esc(c.name) + '</b><small>' + (selected ? '✓ تم الاختيار' : disabled ? 'وصلتم للحد الأعلى' : 'اختيار الفئة') + '</small>', 'cat', 'j-cat-pick', 'data-cat="' + c.index + '" aria-pressed="' + selected + '"' + (disabled ? ' disabled' : ''));
      }).join('') + '</div>';
    }
    return '<h1 class="j-heading">اختاروا فئات مغامرتكم</h1><p class="j-lead">اختاروا من ثلاث إلى ست فئات. كل فئة بطاقتها الخاصة.</p>' +
      (M.error ? '<div class="j-error" role="alert">' + esc(M.error) + '</div>' : '') +
      section(all.filter(c => c.index < 53), 'من كنوز المعرفة') + section(all.filter(c => c.index >= 53), 'فئات إضافية') +
      '<p class="j-note" role="status">' + (M.cats.length >= 6 ? 'وصلتم للحد الأعلى؛ أزيلوا اختيارًا لتختاروا فئة أخرى.' : M.cats.length < 3 ? 'اختاروا ثلاث فئات على الأقل للمتابعة.' : 'فئاتكم جاهزة؛ تقدرون تتابعون.') + '</p>' +
      '<div class="j-actions">' + button('التالي', 'next-setup', 'j-btn', M.cats.length < 3 ? 'disabled' : '') + '</div>';
  }
  function settings() {
    const s = M.settings, min = limits[game][0], max = limits[game][1];
    const difficulty = game === 'ghaws' ? [['depth', 'تزيد مع العمق'], ['mixed', 'مختلطة']] : game === 'harb' ? [['mixed', 'مختلطة'], ['easy', 'سهلة'], ['medium', 'متوسطة'], ['hard', 'صعبة']] : [['points', 'حسب النقاط'], ['mixed', 'مختلطة']];
    return '<h1 class="j-heading">جهّزوا فريقكم</h1><p class="j-lead">الأسماء والألوان والرموز لكم… وبعدها تبدأ المغامرة.</p>' +
      '<section class="j-form-card"><h2>الفرق</h2>' + M.teams.map((t, i) => '<div class="j-team-row">' + button(sym(t.symbol), 'color', 'j-team-swatch', 'data-team="' + i + '" data-color="' + t.c + '" aria-label="تغيير لون ورمز ' + esc(t.n) + '"') + '<input class="j-input" data-team-name="' + i + '" aria-label="اسم الفريق ' + ar(i + 1) + '" value="' + esc(t.n) + '" maxlength="80">' + button('×', 'remove-team', 'j-icon-btn', 'data-team="' + i + '" aria-label="حذف الفريق"' + (M.teams.length <= min ? ' disabled' : '')) + '</div>').join('') +
      button('إضافة فريق', 'add-team', 'j-secondary', M.teams.length >= max ? 'disabled' : '') + (min === 1 ? '<p class="j-note">اللعب الفردي متاح.</p>' : '') + '</section>' +
      '<section class="j-form-card"><h2>الإعدادات</h2><label class="j-field">الخيارات</label>' + chips([['shown', 'ظاهرة'], ['hidden', 'مخفية']], s.options, 'options') +
      (s.options === 'hidden' ? '<label class="j-field" for="j-reveals">كم مرة تقدر كل فرقة تظهر الخيارات</label><input id="j-reveals" class="j-input" type="number" min="0" step="1" data-input="reveals" value="' + s.reveals + '">' : '') +
      '<label class="j-field">الوقت</label>' + chips([[15, ar(15)], [30, ar(30)], [45, ar(45)], [60, ar(60)], ['custom', 'مخصص'], [0, 'بلا وقت']], s.custom ? 'custom' : s.time, 'time') +
      (s.custom ? '<label class="j-field" for="j-time">الوقت بالثواني</label><input id="j-time" class="j-input" type="number" min="0" step="any" data-input="customTime" value="' + s.customTime + '">' : '') +
      '<label class="j-field">الصعوبة <span class="j-tag j-gold">تجريبي</span></label>' + chips(difficulty, s.difficulty, 'difficulty') + (game === 'board' || game === 'test' || game === 'hanna' ? '<p class="j-note">حسب النقاط: ٢٠٠ سهل · ٤٠٠ متوسط · ٦٠٠ صعب</p>' : '') +
      (game === 'ghaws' ? '<label class="j-field">حد العمق</label>' + chips([5, 7, 10, 15, 20, 30].map(n => [n, ar(n)]), s.cap, 'cap') : '') +
      (game === 'harb' ? '<label class="j-field">رصيد توزيع الرايات بحسب جزر الفريق</label>' + chips([[1, ar(1)], [2, ar(2)], [3, ar(3)], ['custom', 'مخصص']], s.customFlags ? 'custom' : s.flags, 'flags') + (s.customFlags ? '<label class="j-field" for="j-flags">رصيد الرايات لكل فريق</label><input id="j-flags" class="j-input" data-input="customFlagsValue" type="number" min="2" max="60" value="' + s.customFlagsValue + '">' : '') + '<p class="j-note">لكل جزيرة راية حارس، وتوزعون رصيدكم كيف ما تبون.</p><label class="j-field" for="j-shots">أسئلة الهجوم</label><input id="j-shots" class="j-input" data-input="shots" type="number" min="1" max="10" value="' + s.shots + '"><label class="j-field">شرط الفوز</label>' + chips([[2, 'بحران'], [9, 'الأرخبيل كله']], s.win, 'win') : '') +
      (game === 'harb' || game === 'hanna' ? '<label class="j-field">طريقة اللعب</label>' + chips([[false, 'جهاز واحد'], [true, 'غرفة وجوالات']], s.room, 'room') : '') +
      (game === 'hanna' && s.room ? '<label class="j-field" for="j-room-code">رمز الغرفة · اختياري</label><input id="j-room-code" class="j-input" data-input="roomCode" inputmode="numeric" maxlength="6" placeholder="تلقائي" value="' + esc(s.roomCode) + '">' : '') + '</section>' +
      (M.error ? '<div class="j-error" role="alert">' + esc(M.error) + '</div>' : '') + '<div class="j-actions">' + button('ابدأ اللعب', 'start') + '</div>' +
      (game === 'hanna' || game === 'harb' ? button('الانضمام إلى غرفة موجودة', 'join-room', 'j-room-link j-secondary') : '');
  }
  function teamBar(duel = false) {
    const turn = actor();
    return '<div class="j-teambar' + (duel ? ' j-duel' : '') + '">' + M.teams.map((t, i) => '<div class="j-team" data-team-color="' + i + '" aria-current="' + (i === turn) + '"><b>' + sym(t.symbol) + '<bdi>' + esc(t.n) + '</bdi></b><strong>' + score(teamScore(i)) + '</strong><small>' + (i === turn ? 'دوركم الآن' : 'استعدّوا للتحدّي') + '</small></div>').join('') + '</div>';
  }
  function teamScore(i) { return game === 'harb' && M.g ? global.WarEngine.count(M.g, i) : game === 'ghaws' ? M.teams[i].p || 0 : M.teams[i].score; }
  function actor() { return game === 'ghaws' ? global.S?.pi || 0 : M.g?.turn || 0; }
  function played() { return ['board', 'test', 'hanna'].includes(game) ? M.slots.filter(s => s.used).length : M.used.size; }
  function boardView() {
    return teamBar() + '<div class="j-board-title"><h2>اختاروا فئتكم… والنقاط</h2><p>دور «' + esc(M.teams[actor()].n) + '»</p></div><div class="j-board-grid">' + M.cats.map((c, p) => {
      const slots = M.slots.map((s, i) => ({ s, i })).filter(x => x.s.cat === c);
      const col = start => '<div class="j-point-col">' + slots.slice(start, start + 3).map(({ s, i }) => button(s.used ? (Array.isArray(s.by) ? s.by.map(t => sym(M.teams[t].symbol)).join('') || '—' : s.by >= 0 ? sym(M.teams[s.by].symbol) : '—') : ar(s.pts), 'tile', 'j-point' + (s.used ? ' j-used' : ''), 'data-slot="' + i + '" aria-label="' + esc(catName(c)) + '، ' + ar(s.pts) + (s.used ? '، لُعبت' : ' نقطة') + '"' + (s.used ? ' disabled' : ''))).join('') + '</div>';
      return '<section class="j-board-category" data-category-color="' + p + '">' + col(0) + '<div class="j-category-middle">' + catIcon(c) + '<h3>' + esc(catName(c)) + '</h3></div>' + col(3) + '</section>';
    }).join('') + '</div><div class="j-actions">' + button('الفرق والإعدادات', 'leave', 'j-secondary') + '</div>';
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
        (selected && !host && !q.settled && !q.answerRevealed && (game === 'test' || game === 'hanna') ? button('تأكيد', 'confirm-answer', 'j-confirm') : '') + '</div>';
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
  function quizQuestion() {
    const q = M.question;
    return teamBar() + '<div class="j-progress" aria-hidden="true">' + M.slots.map(s => '<i' + (s.used ? ' class="j-on"' : '') + '></i>').join('') + '</div><div class="j-medallion">' + catIcon(questionText(q)[0]) + '</div><section class="j-paper j-quiz-paper">' + meta(q) + '<h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + answers(q) + timerMarkup(q) +
      (q.settled ? '<div class="j-verdict' + (q.correct ? '' : ' j-no') + '">' + (q.correct ? '✓ صحيح! ' + score(M.slots[q.slotIndex].pts, true) : q.timedOut ? 'انتهى الوقت' : 'خطأ') + '</div>' + explanation(q) + '<div class="j-actions">' + button('التالي', 'question-next', 'j-btn j-teal') + '</div>' : '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) && !q.answerRevealed ? button('أظهر الجواب', 'reveal-answer', 'j-btn j-teal') : '') + (q.answerRevealed ? button('صح', 'judge-yes', 'j-btn j-teal') + button('خطأ', 'judge-no', 'j-secondary') : '') + '</div>') + '</section>';
  }
  function hannaQuestion() {
    const q = M.question, data = questionText(q), value = M.slots[q.slotIndex].pts;
    const teamButtons = '<div class="j-hanna-team-list">' + M.teams.map((t, i) => button(sym(t.symbol) + '<bdi>' + esc(t.n) + '</bdi><small>' + (q.submissions[i] ? '✓ ثبّت' : 'جاوبوا هني') + '</small>', 'hanna-team', 'j-secondary', 'data-team="' + i + '"' + (q.submissions[i] || q.beat ? ' disabled' : '') )).join('') + '</div>';
    const title = '<div class="j-hanna-title"><h2>حنّا لها</h2><p>المعرفة قوّة… والثقة تكسب.</p></div>';
    if (q.beat === 'confidence') return title + teamBar(true) + '<div class="j-hanna-reveal"><h2>منو قال «حنّا لها»؟</h2>' + M.teams.map((t, i) => '<p>' + esc(t.n) + ' · ' + (q.submissions[i]?.confidence === 'bold' ? 'حنّا لها!' : q.submissions[i] ? 'أتوقّع' : 'ما ثبّت') + '</p>').join('') + '<div class="j-actions">' + button('اكشف الجواب', 'hanna-reveal') + '</div></div>';
    if (q.beat === 'answer') return title + teamBar(true) + '<section class="j-hanna-reveal" data-motion="hanna"><span class="j-tag">الجواب الصحيح</span><h2>' + esc(data[4][data[5]]) + '</h2>' + M.teams.map((t, i) => {
      const a = q.submissions[i];
      return '<div class="j-form-card"><b>' + esc(t.n) + '</b><p>' + (!a ? 'لم يثبّت جوابًا' : a.correct === null ? 'الحكم لكم على جوابكم' : a.correct ? '✓ صحيح · ' + score(a.delta, true) : 'خطأ · ' + score(a.delta, true)) + '</p>' + (a && a.correct === null ? '<div class="j-actions">' + button('صح', 'hanna-judge', 'j-btn j-teal', 'data-team="' + i + '" data-right="true"') + button('خطأ', 'hanna-judge', 'j-secondary', 'data-team="' + i + '" data-right="false"') + '</div>' : '') + '</div>';
    }).join('') + explanation(q) + '<div class="j-actions">' + button('التالي', 'question-next', 'j-btn j-teal', Object.values(q.submissions).some(a => a.correct === null) ? 'disabled' : '') + '</div></section>';
    return title + teamBar(true) + '<div class="j-hanna-question">' + meta(q) + '<h2>' + esc(data[3]) + '</h2><div id="qvis" hidden></div></div>' + teamButtons + '<p class="j-note">كل الفرق لها حق الجواب؛ ثبّتوا بالسر قبل الكشف.</p><p class="j-tag">جواب «' + esc(M.teams[q.activeTeam].n) + '»</p><div class="j-confidence">' +
      ['safe', 'bold'].map(mode => button('<h3>' + (mode === 'bold' ? 'حنّا لها!' : 'أتوقّع') + '</h3><p>صح: ' + score(Model.hannaDelta(mode, true, value), true) + '<br>خطأ: ' + score(Model.hannaDelta(mode, false, value), true) + '</p>', 'confidence', 'j-confidence-card' + (mode === 'bold' ? ' j-bold' : ''), 'data-mode="' + mode + '" aria-pressed="' + (q.confidence === mode) + '"')).join('') + '</div><section class="j-paper">' + answers(q) + timerMarkup(q) + '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) ? button('ثبّتنا جوابنا بصوت عالٍ', 'hanna-manual', 'j-btn j-teal', q.confidence ? '' : 'disabled') : '') + '</div></section>';
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
    const slots = global.SLOTS;
    return '<svg class="j-island-map" viewBox="0 0 600 920" role="group" aria-label="أرخبيل الجزر"><defs><linearGradient id="journey-sand" x2="0" y2="1"><stop stop-color="#fff1bd"/><stop offset="1" stop-color="#d8b878"/></linearGradient><linearGradient id="journey-green" x2="0" y2="1"><stop stop-color="#a5e2a2"/><stop offset="1" stop-color="#4eb893"/></linearGradient><filter id="journey-marker-shadow"><feDropShadow dx="0" dy="6" stdDeviation="1" flood-color="#075365"/></filter></defs><g fill="none" stroke="#a4ede64a" stroke-width="2">' + Array.from({ length: 15 }, (_, i) => '<path d="M' + (i * 71 % 510) + ' ' + (50 + i * 59) + 'q30-12 60 0t60 0"/>').join('') + '</g><g fill="none" stroke="#fff3a979" stroke-width="4" stroke-dasharray="9 9">' + global.WarEngine.LINKS.map(([a, b]) => '<path' + (w.base === a && w.tgt === b || w.base === b && w.tgt === a ? ' class="j-route-active"' : '') + ' d="M' + slots[a].x + ' ' + slots[a].y + 'Q300 ' + (slots[a].y + slots[b].y) / 2 + ' ' + slots[b].x + ' ' + slots[b].y + '"/>').join('') + '</g>' +
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
    const controls = '<div class="j-actions">' + button('تراجع', 'war-undo', 'j-secondary', !w.placed.length && w.base === null ? 'disabled' : '') + button(w.phase === 'deploy' ? 'سلّموا الدور' : 'إنهاء الدور', 'war-next', 'j-btn j-teal', w.busy || w.phase === 'deploy' && w.pool > 0 ? 'disabled' : '') + '</div>';
    if (!q) return board + controls + '<div class="j-actions">' + button('إنهاء اللعبة', 'finish-war', 'j-secondary') + '</div>';
    return board + '<section class="j-paper j-island-sheet" data-motion="island">' + meta(q) + '<h2>' + esc(questionText(q)[3]) + '</h2><div id="qvis" hidden></div>' + answers(q) + timerMarkup(q) +
      (q.settled ? '<div class="j-verdict' + (q.correct ? '' : ' j-no') + '">' + (q.correct ? q.fast ? '✓ إصابة مزدوجة — سبقتوا الجمر' : '✓ إصابة صحيحة' : q.timedOut ? 'نفد الوقت' : 'خطأ') + '</div>' + explanation(q) + '<div class="j-actions">' + button('التالي', 'war-answer-next', 'j-btn j-teal') + '</div>' : '<div class="j-actions">' + optionsButton(q) + (!shownOptions(q) && !q.answerRevealed ? button('أظهر الجواب', 'reveal-answer', 'j-btn j-teal') : '') + (q.answerRevealed ? button('صح', 'judge-yes', 'j-btn j-teal') + button('خطأ', 'judge-no', 'j-secondary') : '') + '</div>') + '</section>';
  }
  function warResult() {
    const r = M.warResult;
    const message = { fall: '✓ الجزيرة لكم! ارتفعت رايتكم بعد الإجابة الصحيحة.', take: '✓ إصابة! انتقلت راية إلى جزيرتكم.', lose: 'رُدّ الهجوم؛ انتقلت راية إلى المدافع.', hold: 'صمدت الجزيرة؛ الملكية كما هي.' }[r.kind];
    return teamBar() + islandMap() + '<div class="j-hanna-reveal" data-motion="island"><h2>' + message + '</h2><div class="j-actions">' + button('التالي', 'war-result-next', 'j-btn j-teal') + '</div></div>';
  }
  function results() {
    const r = M.result, rows = r?.rows || [];
    return '<section class="j-results"><div class="j-result-icon">' + Icons.icon('medal') + '</div><span class="j-tag">ختام المغامرة</span><h2>' + esc(r?.title || 'انتهت اللعبة') + '</h2>' + (r?.note ? '<p class="j-muted">' + esc(r.note) + '</p>' : '') + '<table class="j-rank"><thead><tr><th>الفريق</th><th>' + (game === 'harb' ? 'الجزر' : game === 'ghaws' ? 'اللؤلؤ' : 'النقاط') + '</th>' + (game === 'harb' ? '<th>الرايات</th>' : '') + '</tr></thead><tbody>' + rows.map(row => '<tr data-team-color="' + row.index + '"><td>' + sym(M.teams[row.index].symbol) + '<bdi>' + esc(M.teams[row.index].n) + '</bdi></td><td>' + score(row.score) + '</td>' + (game === 'harb' ? '<td>' + score(row.flags) + '</td>' : '') + '</tr>').join('') + '</tbody></table><div class="j-actions">' + button('مغامرة جديدة', 'again') + '<a class="j-secondary" href="/quest.html">كنوز المعرفة</a></div></section>';
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
    const screens = { hub: home, categories, settings, board: boardView, 'board-question': boardView, 'test-question': quizQuestion, 'hanna-question': hannaQuestion, dive: diveView, war: warView, 'war-result': warResult, results,
      loading: () => '<div class="j-loading" role="status">نجهّز مغامرتكم…<div class="j-loader"></div></div>',
      handover: () => '<div class="j-results"><div class="j-result-icon">' + Icons.icon('wave') + '</div><h2>دور «' + esc(M.teams[global.S.pi].n) + '»</h2><p class="j-muted">خذوا نفسكم… ومغامرتكم تبدأ.</p><div class="j-actions">' + button('ابدأ الغوص', 'dive-begin', 'j-btn j-teal') + '</div></div>',
      'war-pass': () => teamBar() + '<div class="j-results"><h2>دور المدافع «' + esc(M.teams[M.pendingWarAsk.pi].n) + '»</h2><p class="j-muted">سلّموا الجهاز للمدافع قبل إظهار السؤال.</p><div class="j-actions">' + button('جاهزين للدفاع', 'war-defend', 'j-btn j-teal') + '</div></div>',
      error: () => '<div class="j-error" role="alert">' + esc(M.error || 'تعذّر تجهيز المغامرة') + '</div><div class="j-actions">' + button('حاولوا مرة ثانية', 'reload') + '</div>', room: () => '' };
    app.dataset.stage = M.stage;
    app.innerHTML = (M.stage === 'board-question' ? '' : header()) + stepper() + '<main class="j-content" id="journey-main">' + (screens[M.stage] || screens.error)() + '</main>' + (M.stage === 'board-question' ? boardQuestion() : '') + dialog();
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
      Motion.enterScreen(app.querySelector('main'));
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
  function clearTimer() { if (M.timer) clearInterval(M.timer); M.timer = null; }
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
    M.stage = stage; M.step = step;
    if (push) history.pushState({ journey: true, step }, '');
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
  function leaveRoomToSettings() {
    const route = game === 'hanna' ? '/hanna-laha/' : '/quest-harb.html';
    if (M.cats.length < 3) { location.href = route; return; }
    try { sessionStorage.setItem('kunuz_journey_room_setup_v1', JSON.stringify({ game, cats: M.cats, teams: M.teams, settings: M.settings })); } catch (_) {}
    location.href = route + '?setup=1';
  }
  function back() {
    if (M.stage === 'room') { askDialog('تطلعون من الغرفة وترجعون للإعدادات؟', leaveRoomToSettings, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); return; }
    if (M.question && ['board', 'test', 'hanna'].includes(game)) {
      if (M.question.settled) returnBoard();
      else askDialog(game === 'hanna' && M.question.answerRevealed ? 'تتركون التحكيم المتبقي وترجعون للوحة؟' : 'ترجعون للوحة وتتركون السؤال بلا نقاط؟', abandonQuestion);
    } else if (M.running) askDialog('تتركون اللعبة وترجعون للفرق والإعدادات؟', leaveToSettings);
    else if (M.step === 2) { M.error = ''; history.back(); }
    else if (M.stage === 'results') leaveToSettings();
    else location.href = '/quest.html';
  }
  function begin() {
    const s = M.settings;
    if (!Number.isFinite(time()) || time() < 0 || s.custom && time() === 0 || !Number.isInteger(s.reveals) || s.reveals < 0 || !Number.isInteger(s.shots) || s.shots < 1 || s.shots > 10 || s.customFlags && (!Number.isInteger(s.customFlagsValue) || s.customFlagsValue < 2 || s.customFlagsValue > 60)) { M.error = 'اكتبوا قيمة صحيحة للوقت والخيارات والإعدادات.'; render(); return; }
    if (s.room) { enterRoom(false); return; }
    M.history ||= Model.history();
    const all = Model.categories();
    const pool = Model.reserve(M.cats, M.history);
    if (pool.shortage.length) { M.error = 'فئة «' + catName(pool.shortage[0]) + '» غير متاحة حاليًا؛ ارجعوا واختاروا فئة أخرى.'; render(); return; }
    M.error = ''; M.pool = pool.indices; M.slots = pool.slots; M.fallback = pool.fallback; M.excluded = all.filter(c => c.count < Model.PER_CATEGORY);
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
    history.pushState({ journey: true, step: 3 }, ''); M.step = 3;
    if (game === 'ghaws') beginDiveGame(); else if (game === 'harb') beginWar(); else setStage('board', 3);
  }
  function openTile(index) {
    const slot = M.slots[index]; if (!slot || slot.used || M.question) return;
    M.history.read();
    if (M.history.has(slot.index)) {
      // Another Kunuz tab may have consumed this reservation since setup.
      const excluded = new Set([...M.used, ...M.slots.filter(other => other !== slot && !other.used).map(other => other.index)]);
      const { unseen, oldest } = Model.candidates(slot.cat, M.history, Math.random, excluded);
      unseen.sort((a, b) => Math.abs((Model.level(a) || slot.desired) - slot.desired) - Math.abs((Model.level(b) || slot.desired) - slot.desired));
      slot.index = unseen[0] ?? oldest[0]; slot.actual = Model.level(slot.index);
    }
    const turn = M.g.turn;
    if (game === 'test') { M.g.cur = slot.index; M.g.used[slot.index] = 1; M.g.curCat = slot.cat; }
    else { M.g.cur = { s: index, k: slot.index }; M.g.used[slot.index] = 1; }
    makeQuestion(slot.index, turn, index, time() * 1000);
    history.pushState({ journey: true, step: 3, question: true }, ''); M.questionHistory = true;
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
    if (game === 'test') global.TE.next(M.g);
    if (game === 'hanna') { M.g.cur = null; M.g.turn = (M.g.turn + 1) % M.teams.length; }
    M.question = null;
    if (M.questionHistory) { M.skipPop = true; M.questionHistory = false; history.back(); }
    if (M.slots.every(slot => slot.used)) finishBoard(); else setStage('board', 3);
  }
  function finishBoard() {
    M.running = false; clearTimer();
    const rank = game === 'board' ? global.BE.rank(M.g) : game === 'test' ? global.TE.rank(M.g) : Model.rank(M.teams);
    M.result = { title: rank.winners.length > 1 ? 'تعادل بين ' + rank.winners.map(i => '«' + M.teams[i].n + '»').join(' و') : 'الفائز «' + M.teams[rank.winners[0]].n + '»', rows: rank.order.map(i => ({ index: i, score: M.teams[i].score })) };
    setStage('results', 4); sound('success');
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
    if (M.settings.difficulty === 'depth') {
      const desired = Math.min(3, 1 + Math.floor(s.depth * 3 / Math.max(1, s.cap)));
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
    const paint = global.paint, lobby = global.drawLobby;
    const roomWhy = global.roomWhy;
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
    };
    global.drawLobby = function () {
      lobby();
      document.querySelectorAll('#lobbyTeams .pcard').forEach((row, i) => row.insertAdjacentHTML('afterbegin', '<span class="j-native-symbol">' + sym(i) + '</span>'));
    };
    global.roomLeaveWar = () => { if (!M.dialog) askDialog('تطلعون من الغرفة وترجعون للإعدادات؟', leaveRoomToSettings, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); };
  }
  async function enterRoom(join, preserveRoute = false) {
    // Rooms continue to use the shipped front-end and worker's current protocol.
    // Local pack IDs are deliberately never sent to a server with a different bank.
    if (!join && M.cats.some(c => c >= 53)) { M.error = 'الغرف تستعمل بنك خادمها الحالي. اختاروا فئات البنك للغرفة، أو العبوا بهذه الفئات على جهاز واحد.'; render(); return; }
    M.settings.roomCode = M.settings.roomCode.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
    if (!join && game === 'hanna' && M.settings.roomCode && !/^\d{4,6}$/.test(M.settings.roomCode)) { M.error = 'رمز الغرفة يكون من أربعة إلى ستة أرقام.'; render(); return; }
    if (!join && (game === 'hanna' && (!Number.isInteger(time()) || time() < 10 || time() > 600 || M.settings.reveals > 99) || game === 'harb' && (time() !== 0 && (time() < 3 || time() > 600 || !Number.isInteger(time() * 1000))))) { M.error = 'هذا الوقت أو رصيد الخيارات خارج ما يقبله خادم الغرف الحالي؛ اختاروا إعدادًا آخر أو العبوا على جهاز واحد.'; render(); return; }
    M.error = ''; cancelPlay(); M.stage = 'room'; M.step = 3; render();
    M.roomUrl = location.href;
    document.body.prepend(app);
    document.body.classList.add('journey-room');
    if (game === 'harb') {
      // Keep every native lobby, reconnect and phone action intact.
      installWarRoomLook();
      global.openRoomScreen();
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
      const module = document.createElement('script'); module.type = 'module'; module.src = '/hanna-laha/assets/index-DQ2E4Hb-.js';
      try { localStorage.setItem('hl-ezik.sound', 'false'); } catch (_) {}
      if (!join) {
        const roomColors = ['blue','orange','purple','green','gold','pink','teal','brown','navy','olive','red','maroon'];
        const setup = { teams: M.teams.map((t, i) => ({ name: t.n.trim() || defaults[i], color: roomColors[colors.indexOf(t.c)] || roomColors[i] })), perCat: 6, timeSec: time(), categories: M.cats.map(c => global.DATA.cats[c][0]), mode: M.settings.options === 'hidden' ? 'free' : 'options', reveals: M.settings.reveals, roomCode: null };
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
        // The shipped room view remains responsible for its snapshot. Suppress
        // only its source paragraph before paint, without changing that data.
        document.querySelectorAll('#root p.bank-text').forEach(node => {
          const label = node.querySelector(':scope > b');
          if (!label || !/^المصدر/.test(label.textContent.trim())) return;
          const text = [...node.childNodes].filter(child => child !== label).map(child => child.textContent).join('');
          node.hidden = !arabicSource(text);
        });
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
    const q = M.question;
    if (action === 'mute') { M.muted = !M.muted; try { localStorage.setItem('kunuz_journey_muted_v1', M.muted ? '1' : '0'); } catch (_) {} if (M.muted) stopSounds(); render(); }
    else if (action === 'home') { if (M.running || M.stage === 'room') askDialog('تطلعون للرئيسية وتتركون اللعبة؟', () => { cancelPlay(); homeExit(); }, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' }); else homeExit(); }
    else if (action === 'back') back();
    else if (action === 'cat') { const c = +el.dataset.cat, i = M.cats.indexOf(c); if (i >= 0) M.cats.splice(i, 1); else if (M.cats.length < 6) M.cats.push(c); M.error = ''; render(); }
    else if (action === 'next-setup') { if (M.cats.length >= 3 && M.cats.length <= 6) { M.error = ''; setStage('settings', 2, true); } }
    else if (action === 'add-team') { if (M.teams.length < limits[game][1]) { M.teams.push(teamNew(M.teams.length)); render(); } }
    else if (action === 'remove-team') { if (M.teams.length > limits[game][0]) { M.teams.splice(+el.dataset.team, 1); render(); } }
    else if (action === 'color') { const t = M.teams[+el.dataset.team], current = colors.indexOf(t.c); t.c = colors[(current + 1) % colors.length]; t.symbol = (t.symbol + 1) % 6; render(); }
    else if (action === 'setting') {
      const field = el.dataset.field, value = el.dataset.value;
      if (field === 'time') { M.settings.custom = value === 'custom'; if (!M.settings.custom) M.settings.time = +value; }
      else if (field === 'flags') { M.settings.customFlags = value === 'custom'; if (!M.settings.customFlags) M.settings.flags = +value; }
      else if (['cap', 'win'].includes(field)) M.settings[field] = +value;
      else M.settings[field] = value === 'true' ? true : value === 'false' ? false : value;
      M.error = ''; render();
    }
    else if (action === 'start') begin();
    else if (action === 'tile') openTile(+el.dataset.slot);
    else if (action === 'show-options' && q && !q.settled && !shownOptions(q)) { const team = M.teams[q.activeTeam ?? q.actor]; if (team.shows > 0) { team.shows--; q.showTeams.add(q.activeTeam ?? q.actor); render(); } }
    else if (action === 'answer' && q && !q.settled && !q.answerRevealed && !q.burned.has(+el.dataset.answer)) {
      const answer = +el.dataset.answer;
      if (game === 'ghaws' || game === 'harb') { q.selected = answer; settle(answer === questionText(q)[5]); }
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
    else if (action === 'join-room') enterRoom(true);
  }
  app.addEventListener('click', event => {
    const island = event.target.closest('[data-island]'), el = event.target.closest('[data-action]');
    M.audioUnlocked = true;
    if (!island && !el) return;
    if (el?.disabled) return;
    const now = performance.now();
    // Ignore the second tap in a burst, including when the first action replaced its DOM.
    const actionKey = island ? 'island:' + island.dataset.island : el.dataset.action + ':' + (el.dataset.cat ?? el.dataset.slot ?? el.dataset.team ?? el.dataset.answer ?? el.dataset.field ?? '') + ':' + (el.dataset.value ?? el.dataset.mode ?? '');
    const samePosition = Math.abs(event.clientX - (M.lastX ?? -999)) < 10 && Math.abs(event.clientY - (M.lastY ?? -999)) < 10;
    if (now - M.lastAction < 220 && (M.lastKey === actionKey || samePosition)) return;
    M.lastAction = now; M.lastKey = actionKey; M.lastX = event.clientX; M.lastY = event.clientY; sound('tap');
    if (island) tapIsland(+island.dataset.island); else onAction(el.dataset.action, el);
    if (Motion) { const rect = app.getBoundingClientRect(); Motion.tapRipple(app, { x: event.clientX - rect.left, y: event.clientY - rect.top }); }
  });
  app.addEventListener('keydown', event => {
    const island = event.target.closest('[data-island]');
    if (island && ['Enter', ' '].includes(event.key)) { event.preventDefault(); tapIsland(+island.dataset.island); }
  });
  app.addEventListener('input', event => {
    const el = event.target;
    if (el.hasAttribute('data-team-name')) M.teams[+el.dataset.teamName].n = el.value;
    if (el.dataset.input) M.settings[el.dataset.input] = el.dataset.input === 'roomCode' ? el.value : el.value === '' ? NaN : Number(el.value);
  });
  global.addEventListener('popstate', event => {
    if (M.stage === 'room') {
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
    const close = warExit && target.id === 'roomEnd' ? target.onclick : null;
    askDialog(close && global.RM.host ? 'تغلقون الغرفة وترجعون للإعدادات؟' : 'تطلعون من الغرفة وترجعون للإعدادات؟', () => { if (close) close.call(target); leaveRoomToSettings(); }, () => {}, { yes: close && global.RM.host ? 'نعم، نغلق' : 'نعم، نطلع', no: 'لا، نبقى' });
  }, true);
  document.addEventListener('click', event => {
    if (M.stage === 'room' && event.target.closest('#root button')) { M.audioUnlocked = true; sound('tap'); }
  });
  const motionPreference = global.matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change', () => { cancelVisuals(); if (!document.hidden) render(); });
  global.addEventListener('pagehide', event => { clearTimer(); stopSounds(); cancelVisuals(); if (!event.persisted) Motion?.dispose(); });
  global.addEventListener('pageshow', event => { if (event.persisted) { render(); if (M.question && !M.question.settled && !M.question.answerRevealed && !M.question.beat) startTimer(); } });
  global.KunuzJourney = Object.freeze({ get state() { return M; }, get diagnostics() { return { bankStamp: typeof global.seenStamp === 'function' ? global.seenStamp() : '', offlineReady: M.offlineReady, excluded: M.excluded, fallback: M.fallback, categories: game === 'hub' ? [] : Model.categories().map(c => ({ name: c.name, total: c.count })) }; } });
  async function loadHannaLocal() {
    // Direct room URLs stay outside the local bank/pack engine. Local Hanna uses
    // that engine only after the entry route has been classified below.
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/quest-visual.css'; document.head.append(css);
    for (const src of ['/quest-data/kunuz-bank-3147.js', '/quest-theme/history.js', '/quest-data/kunuz-geo-index.js', '/quest-data/kunuz-packs-manifest.js?v=20261021-room1', '/quest-visual.js', '/quest-levels.js']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = src;
        script.onload = resolve; script.onerror = () => reject(new Error('تعذّر تحميل ملفات المغامرة المحلية. حاولوا مرة ثانية.'));
        document.head.append(script);
      });
    }
  }
  async function boot() {
    // Mount before parser-blocking legacy bank/engine scripts. They stay hidden.
    render(); global.KunuzThemeBoot?.mounted();
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    if (global.KunuzThemeBoot?.status === 'fallback') return;
    document.querySelectorAll('#qvis').forEach(el => { el.id = 'legacy-qvis'; });
    if (game === 'hub') { render(); await prepareOffline(); M.ready = true; return; }
    if (game === 'hanna' && (/^\/hanna-laha\/(?:join|host|j\/\d{4,6})\/?$/.test(path) || /\/setup\/?$/.test(path) && new URLSearchParams(location.search).has('rooms'))) {
      M.ready = true; await enterRoom(true, true); return;
    }
    history.replaceState({ journey: true, step: 1 }, ''); render();
    try {
      if (game === 'hanna') await loadHannaLocal();
      if (!global.DATA || !global.KZV) throw new Error('ملفات المغامرة غير متاحة. افتحوا الصفحة متصلين مرة لتكتمل الملفات المحلية.');
      await global.KZV.ready;
      await warmLocalAssets();
      await prepareOffline();
      if (global.LEVELS_EXPERIMENT !== false) await new Promise(resolve => { let tries = 0; const timer = setInterval(() => { if (global.KUNUZ_LEVELS || ++tries >= 80) { clearInterval(timer); resolve(); } }, 25); });
      M.excluded = Model.categories().filter(c => c.count < Model.PER_CATEGORY); M.ready = true;
      if (new URLSearchParams(location.search).get('setup') === '1') {
        try {
          const draft = JSON.parse(sessionStorage.getItem('kunuz_journey_room_setup_v1')); sessionStorage.removeItem('kunuz_journey_room_setup_v1');
          if (draft?.game === game && Array.isArray(draft.cats) && draft.cats.length >= 3 && draft.cats.length <= 6 && draft.cats.every(c => Number.isInteger(c) && global.DATA.cats[c]) && Array.isArray(draft.teams) && draft.teams.length >= limits[game][0] && draft.teams.length <= limits[game][1]) {
            M.cats = draft.cats; M.teams = draft.teams.map((t, i) => ({ ...teamNew(i), n: String(t.n), c: colors.includes(t.c) ? t.c : colors[i], symbol: Number.isInteger(t.symbol) ? t.symbol % 6 : i }));
            for (const key of Object.keys(M.settings)) if (typeof draft.settings?.[key] === typeof M.settings[key]) M.settings[key] = draft.settings[key];
            history.replaceState({ journey: true, step: 1 }, '', location.pathname); setStage('settings', 2, true); return;
          }
        } catch (_) {}
      }
      setStage('categories', 1);
    } catch (error) { M.error = error.message; setStage('error', 1); }
  }
  boot();
})(window);
