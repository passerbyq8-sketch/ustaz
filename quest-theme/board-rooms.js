/* Category-and-points rooms. Local play remains owned by Journey and BE. */
(function (global) {
  'use strict';
  function attach(h) {
    const M = h.state, Model = global.KunuzModel, esc = h.esc, ar = h.ar, button = h.button;
    const KEY = 'kunuz_points_board_room_v1', DEVICE = 'kunuz_points_board_device_v1';
    const api = global.KUNUZ_BOARD_API_ORIGIN || 'https://hanna-laha.hl-worker.workers.dev';
    const digits = h.digits, stamp = () => global.seenStamp() + ':' + global.DATA.qs.length;
    const S = { session: null, snapshot: null, socket: null, connected: false, stopped: true, error: '', note: '', retry: null, heartbeat: null, ticks: null, closeTimer: null, retryCount: 0, slot: 0, name: '', color: 0, answer: null, text: '', returnStage: 'room-entry', busy: false };
    const startWaiters = new Set();
    const invalidSessionMessage = 'تعذّرت استعادة دخولكم؛ انضموا من جديد.';
    const errors = { NOT_FOUND: 'ما لقينا غرفة بهذا الرقم.', ROOM_CLOSED: 'أُغلقت الغرفة.', BAD_TOKEN: invalidSessionMessage, BANK_MISMATCH: 'تحتاجون تحديث الصفحة لتطابق أسئلة الغرفة.', OUTDATED: 'حدّثوا الصفحة للانضمام إلى الغرفة.', CODE_TAKEN: 'هذا الرقم مستخدم؛ اختاروا رقمًا آخر.', TEAM_TAKEN: 'الفريق اختاره لاعب آخر؛ اختاروا فريقًا متاحًا.', ROOM_FULL: 'اكتمل عدد الفرق في الغرفة.', NOT_READY: 'تغيّرت الخطوة؛ انتظروا تحديث الغرفة.', STALE: 'تغيّرت الجولة؛ اختاروا من جديد.', TOO_MANY: 'انتظروا قليلًا ثم حاولوا مرة ثانية.', FORBIDDEN: 'هذا الإجراء لصاحب الدور أو صاحب الغرفة.', BAD_CONFIG: 'راجعوا الفئات والفرق والوقت ثم حاولوا.', BAD_MESSAGE: 'راجعوا الاختيار ثم حاولوا مرة ثانية.', SERVER: 'تعذّر الاتصال بالغرفة؛ حاولوا مرة ثانية.' };
    function identity() { try { let id = localStorage.getItem(DEVICE); if (!id) { id = 'board-' + crypto.randomUUID(); localStorage.setItem(DEVICE, id); } return id; } catch (_) { return S.device ||= 'board-' + crypto.randomUUID(); } }
    function save() { try { if (S.session) localStorage.setItem(KEY, JSON.stringify(S.session)); else localStorage.removeItem(KEY); } catch (_) {} }
    function stop() { S.stopped = true; clearTimeout(S.retry); clearTimeout(S.closeTimer); S.closeTimer = null; clearInterval(S.heartbeat); clearInterval(S.ticks); startWaiters.forEach(waiter => waiter.cancel()); if (S.socket) { S.socket.onclose = null; S.socket.close(); } S.socket = null; S.connected = false; }
    function waitForGame(targetGameNumber) {
      const roomId = S.snapshot?.roomId;
      let resolvePromise, rejectPromise;
      let timer;
      const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
      const waiter = {
        finish(error, snapshot) {
          if (!startWaiters.delete(waiter)) return;
          clearTimeout(timer);
          if (error) rejectPromise(error); else resolvePromise(snapshot);
        },
        cancel() { waiter.finish(new Error('board-start-cancelled')); },
      };
      timer = setTimeout(() => waiter.finish(new Error('board-start-timeout')), 45000);
      startWaiters.add(waiter);
      waiter.roomId = roomId;
      waiter.targetGameNumber = targetGameNumber;
      if (S.snapshot && S.snapshot.roomId === roomId
        && ['board', 'question'].includes(S.snapshot.phase)
        && Number(S.snapshot.gameNumber) === targetGameNumber) waiter.finish(null, S.snapshot);
      return { promise, cancel: waiter.cancel };
    }
    function notifyGameStart(snapshot) {
      if (!['board', 'question'].includes(snapshot.phase)) return;
      startWaiters.forEach(waiter => {
        if (waiter.roomId === snapshot.roomId && waiter.targetGameNumber === Number(snapshot.gameNumber)) waiter.finish(null, snapshot);
      });
    }
    function leave(retain = false) { stop(); if (retain && S.session && (S.session.hostToken || S.session.teamToken)) { S.session.active = false; save(); S.session = null; } else { S.session = null; save(); } S.snapshot = null; S.error = ''; S.busy = false; M.question = null; M.running = false; M.stage = 'room-entry'; M.step = 0; history.replaceState({ journey: true, stage: 'room-entry', step: 0 }, '', '/quest-board.html'); h.render(); }
    function permanent(code) {
      const wasOpen = !!S.snapshot, returnStage = S.returnStage; stop(); S.session = null; save(); S.snapshot = null; S.busy = false; M.question = null; M.running = false;
      if (wasOpen && code === 'ROOM_CLOSED') M.error = errors.ROOM_CLOSED;
      if (wasOpen && code === 'ROOM_CLOSED') { leave(); return; }
      S.error = errors[code] || errors.SERVER; M.stage = returnStage; M.step = returnStage === 'settings' ? 2 : 0;
      if (returnStage === 'room-join') M.joinError = S.error; else M.error = S.error;
      history.replaceState({ journey: true, stage: M.stage, step: M.step, room: M.settings.room }, '', '/quest-board.html'); h.render();
    }
    function send(message) { if (!S.connected || !S.socket || S.socket.readyState !== WebSocket.OPEN) { S.error = 'ننتظر عودة الاتصال بالغرفة.'; h.render(); return false; } S.error = ''; S.socket.send(JSON.stringify(message)); return true; }
    function requestHostClose() {
      if (!S.connected || !send({ t: 'close' })) return false;
      S.stopped = true; clearTimeout(S.retry); clearInterval(S.heartbeat); clearInterval(S.ticks);
      S.closeTimer = setTimeout(() => { S.closeTimer = null; leave(); }, 1500);
      return true;
    }
    function mark(snapshot) {
      if (!S.session) return;
      const cycle = snapshot.roomId + ':' + snapshot.gameNumber;
      M.history ||= Model.history();
      if (snapshot.gameNumber && S.session.cycle !== cycle) { snapshot.restartCats.forEach(cat => M.history.restart(cat, [])); S.session.cycle = cycle; }
      if (snapshot.question && S.session.marked !== snapshot.question.qn) { M.history.mark(snapshot.question.index); S.session.marked = snapshot.question.qn; }
      save();
    }
    function apply(snapshot) {
      if (snapshot.bankStamp !== stamp()) { permanent('BANK_MISMATCH'); return; }
      if (S.snapshot && snapshot.roomId === S.snapshot.roomId && snapshot.version < S.snapshot.version) return;
      const changedQuestion = snapshot.question?.qn !== S.snapshot?.question?.qn;
      S.snapshot = snapshot; S.error = ''; S.busy = false;
      notifyGameStart(snapshot);
      if (changedQuestion) { S.answer = null; S.text = ''; }
      S.session.roomId = snapshot.roomId; S.session.role = snapshot.self.role; save(); mark(snapshot);
      M.cats = snapshot.cats.slice(); M.teams = snapshot.teams.map((t, i) => ({ n: t.name, c: h.colors[t.color], symbol: i, score: t.score, shows: t.shows }));
      M.slots = snapshot.slots.map(slot => ({ ...slot })); M.g = { turn: snapshot.turn, teams: M.teams, slots: M.slots };
      Object.assign(M.settings, { options: snapshot.settings.options, time: snapshot.settings.timeMs / 1000, custom: false, reveals: snapshot.settings.reveals, difficulty: snapshot.settings.questionOrder, room: true });
      const q = snapshot.question;
      M.question = q ? { index: q.index, actor: q.actor, slotIndex: q.slot, duration: snapshot.settings.timeMs, deadline: performance.now() + Math.max(0, (q.deadline || snapshot.serverNow) - snapshot.serverNow), started: performance.now(), answerRevealed: q.revealed, selected: q.submissions.find(a => a.team === q.actor)?.pos ?? null, showTeams: new Set(q.shown ? [q.actor] : []), burned: new Set(), settled: false } : null;
      M.running = snapshot.phase === 'board' || snapshot.phase === 'question'; M.stage = 'board-room'; M.step = M.running ? 3 : 0;
      if (snapshot.self.role === 'candidate' && snapshot.phase === 'lobby' && !S.name) { const at = snapshot.teams.findIndex(t => !t.claimed); S.slot = at < 0 ? -1 : at; S.name = snapshot.teams[at]?.name || ''; S.color = snapshot.teams[at]?.color ?? snapshot.teams.length; }
      h.render();
    }
    function connect() {
      if (!S.session) return;
      S.stopped = false; S.connected = false; clearInterval(S.heartbeat); clearInterval(S.ticks);
      const session = S.session, socket = new WebSocket(api.replace(/^http/, 'ws') + '/ws/board/' + session.code + (session.hostToken || session.teamToken ? '' : '?j=1'));
      S.socket = socket;
      socket.onopen = () => {
        if (socket !== S.socket) return;
        S.connected = true; S.retryCount = 0;
        socket.send(JSON.stringify({ t: 'hello', v: 1, deviceId: identity(), bankStamp: stamp(), ...(session.roomId ? { roomId: session.roomId } : {}), ...(session.hostToken ? { hostToken: session.hostToken } : {}), ...(session.teamToken ? { teamToken: session.teamToken } : {}) }));
        S.heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000);
        S.ticks = setInterval(() => h.paintTime(), 200);
      };
      socket.onmessage = event => {
        if (socket !== S.socket || event.data === 'pong') return;
        let msg; try { msg = JSON.parse(event.data); } catch (_) { S.error = errors.SERVER; h.render(); return; }
        if (msg.t === 'snapshot') apply(msg.snapshot);
        else if (msg.t === 'joined') { S.session.teamToken = msg.teamToken; S.session.roomId = msg.roomId; S.session.role = 'team'; save(); }
        else if (msg.t === 'error') {
          if (['ROOM_CLOSED', 'NOT_FOUND', 'BAD_TOKEN', 'BANK_MISMATCH', 'OUTDATED'].includes(msg.code)) permanent(msg.code);
          else { S.error = errors[msg.code] || errors.SERVER; S.busy = false; h.render(); }
        }
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        if (socket !== S.socket || S.stopped) return;
        S.connected = false; clearInterval(S.heartbeat); clearInterval(S.ticks); h.render();
        S.retry = setTimeout(connect, Math.min(10000, 500 * 2 ** Math.min(5, S.retryCount++)));
      };
    }
    function enter(session, returnStage) {
      stop(); S.session = { ...session, active: true }; S.snapshot = null; S.returnStage = returnStage; S.error = ''; save(); M.question = null; M.running = false; M.stage = 'board-room'; M.step = 0;
      M.boardRoomUrl = '/quest-board.html?board=' + session.code;
      history.replaceState({ journey: true, stage: 'board-room', step: 3, rooms: true }, '', M.boardRoomUrl); h.render(); connect();
    }
    async function create() {
      if (S.busy) return;
      const roomCode = digits(M.settings.roomCode), seconds = h.time();
      if (roomCode && !/^\d{4,6}$/.test(roomCode)) { M.error = 'رقم الغرفة من ٤ إلى ٦ خانات.'; h.render(); return; }
      if (!Number.isInteger(seconds * 1000) || seconds < 0 || seconds > 3600 || !Number.isInteger(M.settings.reveals) || M.settings.reveals < 0 || M.settings.reveals > 99) { M.error = 'وقت الغرفة من صفر إلى ٣٦٠٠ ثانية، ورصيد الخيارات من صفر إلى ٩٩.'; h.render(); return; }
      M.history ||= Model.history(); M.history.read();
      const seen = global.DATA.qs.flatMap((q, index) => Model.live(index) && M.cats.includes(q[0]) && M.history.has(index) ? [{ id: String(q[8]), last: M.history.last(index) }] : []);
      const config = { cats: M.cats.slice(), teams: M.teams.map((t, i) => ({ name: t.n.trim() || 'الفريق ' + ar(i + 1), color: Math.max(0, h.colors.indexOf(t.c)) })), timeMs: seconds * 1000, options: M.settings.options, reveals: M.settings.reveals, questionOrder: M.settings.difficulty, bankStamp: stamp(), seen, ...(roomCode ? { roomCode } : {}) };
      S.busy = true; M.error = ''; h.render();
      try {
        const response = await fetch(api + '/api/board/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: identity(), config }), signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (!response.ok) throw new Error(errors[data.error] || errors.SERVER);
        enter({ code: data.code, roomId: data.roomId, hostToken: data.hostToken, role: 'host' }, 'settings');
      } catch (error) { S.busy = false; M.error = Object.values(errors).includes(error.message) ? error.message : errors.SERVER; h.render(); }
    }
    function resume() {
      const code = new URLSearchParams(location.search).get('board'); let saved;
      try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
      if (code && /^\d{4,6}$/.test(code)) { enter(saved?.code === code ? saved : { code, role: 'candidate' }, 'room-join'); return true; }
      if (saved && saved.active !== false && /^\d{4,6}$/.test(saved.code) && (saved.hostToken || saved.teamToken)) { enter(saved, 'room-entry'); return true; }
      return false;
    }
    function card() {
      return '<section class="j-form-card j-board-room-card"><h2>الغرفة</h2><label class="j-field" for="j-board-room-number">رقم الغرفة</label><input id="j-board-room-number" class="j-input" data-board-number inputmode="numeric" dir="ltr" maxlength="6" value="' + esc(M.settings.roomCode) + '" aria-describedby="j-board-room-number-help"><p id="j-board-room-number-help" class="j-note">اختاروا رقمًا من ٤ إلى ٦ خانات، أو اطلبوا رقمًا عشوائيًا.</p><div class="j-actions">' + button('رقم عشوائي', 'br-random', 'j-secondary') + '</div></section>';
    }
    const link = () => location.origin + '/quest-board.html?board=' + S.session.code;
    function roomHeading() {
      return '<section class="j-form-card j-board-room-card"><h2>غرفة تحدّي الفئات</h2><bdi class="j-board-room-code j-gold" dir="ltr">' + ar(S.session.code) + '</bdi><p class="j-note" role="status">' + (S.connected ? 'متصلون بالغرفة' : 'انقطع الاتصال؛ نحاول الرجوع إلى الغرفة…') + '</p><div class="j-actions">' + button('نسخ رابط الانضمام', 'br-copy', 'j-secondary') + button(S.snapshot?.self.role === 'host' ? S.connected ? 'إغلاق الغرفة' : 'الخروج مؤقتًا' : 'الخروج من الغرفة', 'br-leave', 'j-secondary') + '</div><input class="j-input" aria-label="رابط الانضمام" readonly dir="ltr" value="' + esc(link()) + '">' + (S.note ? '<p class="j-note" role="status">' + esc(S.note) + '</p>' : '') + '</section>';
    }
    function lobby(s) {
      let html = '<h1 class="j-heading">جهّزوا فريقكم</h1><div class="j-teambar">' + s.teams.map((t, i) => '<div class="j-team" data-team-color="' + i + '"><b>' + h.sym(i) + esc(t.name) + '</b><small>' + (t.claimed ? t.online ? 'الفريق متصل' : 'بانتظار عودة الفريق' : 'متاح للانضمام') + '</small></div>').join('') + '</div>';
      if (s.self.role === 'host') return html + '<div class="j-actions">' + button('ابدأ اللعب', 'br-start', 'j-btn', !S.connected ? 'disabled' : '') + '</div><p class="j-note">تقدرون تتحكمون بالفرق من هنا، أو ينضم كل فريق بجواله.</p>';
      if (s.self.role === 'team') return html + '<p class="j-lead">فريقكم جاهز؛ ننتظر صاحب الغرفة يبدأ اللعب.</p>';
      const seats = s.teams.flatMap((t, i) => t.claimed ? [] : [[i, t.name]]);
      if (!seats.length && s.teams.length >= 4) return html + '<p class="j-note">اكتملت الفرق؛ تقدرون تتابعون اللعبة.</p>';
      const choices = seats.concat(s.teams.length < 4 ? [[-1, 'فريق جديد']] : []);
      html += '<section class="j-form-card"><h2>انضموا إلى فريق</h2><div class="j-chips">' + choices.map(([i, name]) => button(esc(name), 'br-seat', 'j-chip', 'data-slot="' + i + '" aria-pressed="' + (S.slot === i) + '"')).join('') + '</div><label class="j-field" for="j-board-team-name">اسم الفريق</label><input id="j-board-team-name" class="j-input" data-board-name maxlength="80" value="' + esc(S.name) + '"><div class="j-actions">' + button('انضمام بالفريق', 'br-join-team', 'j-btn', !S.connected || S.busy ? 'disabled' : '') + '</div></section>';
      return html;
    }
    function phoneQuestion(s) {
      const q = s.question, row = global.DATA.qs[q.index], mine = q.submissions.find(a => a.team === s.self.slot);
      let content = '<span class="j-tag">' + esc(global.DATA.cats[row[0]][1]) + ' · ' + ar(s.slots[q.slot].pts) + ' نقطة</span><h2>' + esc(row[3]) + '</h2><div id="qvis" hidden></div>';
      if (q.shown) content += '<div class="j-answers">' + row[4].map((answer, i) => button('<span data-choice="' + i + '">' + esc(answer) + '</span>', 'br-answer-pick', 'j-answer' + (q.revealed && i === row[5] ? ' j-correct' : S.answer === i || mine?.pos === i ? ' j-picked' : ''), 'data-answer="' + i + '"' + (!s.canAnswer ? ' disabled' : ''))).join('') + '</div>';
      else if (s.canAnswer) content += '<label class="j-field" for="j-board-free-answer">جواب فريقكم</label><input id="j-board-free-answer" class="j-input" data-board-answer maxlength="160" value="' + esc(S.text) + '">';
      if (s.canAnswer) content += '<div class="j-actions">' + button('تثبيت الإجابة', 'br-answer-lock', 'j-btn', (q.shown ? S.answer === null : !S.text.trim()) ? 'disabled' : '') + (s.canShowOptions ? button('أظهر الخيارات', 'br-show-options', 'j-secondary') : '') + '</div>';
      if (mine) content += '<p class="j-note" role="status">ثبتّوا جوابكم؛ ننتظر التحكيم.</p>';
      if (q.revealed) content += '<div class="j-explanation" data-explanation></div><p class="j-note">التحكيم عند صاحب الغرفة.</p>';
      return h.teamBar() + '<section class="j-paper j-board-room-question">' + content + h.timerMarkup(M.question) + '</section>';
    }
    function view() {
      const s = S.snapshot;
      let html = roomHeading() + (S.error ? '<p class="j-error" role="alert">' + esc(S.error) + '</p>' : '');
      if (!s) return html + '<p class="j-lead" role="status">نجهّز الغرفة…</p>';
      if (s.phase === 'lobby') return html + lobby(s);
      if (s.phase === 'results') {
        const ranked = Model.rank(M.teams), winner = ranked.winners.map(i => esc(M.teams[i].n)).join(' و');
        return html + '<section class="j-results"><h1>' + (ranked.winners.length > 1 ? 'تعادل بين ' : 'الفائز ') + winner + '</h1>' + h.teamBar() + (s.self.role === 'host' ? '<div class="j-actions">' + button('العبوا مرة ثانية', 'br-rematch', 'j-btn', !S.connected ? 'disabled' : '') + '</div>' : '<p class="j-note">بانتظار صاحب الغرفة.</p>') + '</section>';
      }
      if (s.question && s.self.role !== 'host') return html + phoneQuestion(s);
      let board = h.boardView().replace('>الفرق والإعدادات</button>', '>الخروج من الغرفة</button>');
      if (!s.canPick || !S.connected) board = board.replace(/data-action="tile"/g, 'data-action="tile" disabled');
      if (s.question) {
        let question = h.boardQuestion();
        const responses = '<section class="j-form-card j-board-room-submissions" aria-label="إجابات الفرق"><h2>إجابات الفرق</h2>' + s.teams.map((team, i) => {
          const answer = s.question.submissions.find(a => a.team === i), row = global.DATA.qs[s.question.index];
          const text = !answer ? 'بانتظار جواب الفريق' : answer.pos === undefined ? esc(answer.text) : '<span data-choice="' + answer.pos + '">' + esc(row[4][answer.pos]) + '</span>';
          return '<p data-board-response="' + i + '"><b>' + esc(team.name) + '</b> · ' + text + '</p>';
        }).join('') + '</section>';
        question = question.replace('<p class="j-muted">تشاوروا… والقرار لكم</p>', responses);
        if (!s.canAnswer || !S.connected) question = question.replace(/data-action="answer"/g, 'data-action="answer" disabled');
        if (!s.canShowOptions || !S.connected) question = question.replace(/data-action="show-options"/g, 'data-action="show-options" disabled');
        if (!S.connected) question = question.replace(/data-action="(award|reveal-answer)"/g, 'data-action="$1" disabled');
        board += question;
      }
      return html + board;
    }
    function handle(action, el) {
      if (action === 'br-random') { const b = new Uint32Array(1); crypto.getRandomValues(b); M.settings.roomCode = String(b[0] % 10000).padStart(4, '0'); h.render(); return true; }
      if (!S.session || M.stage !== 'board-room') return false;
      const s = S.snapshot, q = s?.question;
      if (action === 'br-copy') { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link()).then(() => { S.note = 'نُسخ رابط الانضمام.'; h.render(); }).catch(() => { S.note = 'انسخوا رابط الانضمام من الحقل.'; h.render(); }); else { S.note = 'انسخوا رابط الانضمام من الحقل.'; h.render(); } }
      else if (action === 'back' && q && s.self.role === 'host') h.askDialog('ترجعون للوحة وتتركون السؤال بلا نقاط؟', () => send({ t: 'abandon', qn: q.qn }), () => {});
      else if (['br-leave', 'leave', 'back'].includes(action)) h.askDialog(s?.self.role === 'host' ? S.connected ? 'تغلقون الغرفة وتطلعون؟' : 'تطلعون مؤقتًا وتكملون من رقم الغرفة لاحقًا؟' : 'تطلعون من الغرفة؟', () => { const isHost = s?.self.role === 'host'; if (isHost && requestHostClose()) return; leave(true); }, () => {}, { yes: 'نعم، نطلع', no: 'لا، نبقى' });
      else if (action === 'br-seat' && s) { S.slot = +el.dataset.slot; S.name = s.teams[S.slot]?.name || ''; S.color = s.teams[S.slot]?.color ?? s.teams.length; h.render(); }
      else if (action === 'br-join-team') { if (!S.name.trim()) { S.error = 'اكتبوا اسم الفريق.'; h.render(); } else { S.busy = true; send({ t: 'join', name: S.name.trim(), color: S.color, ...(S.slot >= 0 ? { slot: S.slot } : {}) }); h.render(); } }
      else if (action === 'br-start' && s?.self.role === 'host') {
        if (typeof global.ezikIapStart === 'function') {
          const cycle = (Number(s.gameNumber) || 0) + 1;
          global.ezikIapStart(() => { if (!send({ t: 'start', rev: s.version })) throw new Error('board-start-unavailable'); }, S.session.code, 'board', {
            cycle: String(cycle), roomInstanceId: S.session.roomId || s.roomId, waitForStart: () => waitForGame(cycle),
          });
        }
        else { S.error = 'تعذّر فتح خيارات الجلسة. أعدوا تحميل الصفحة.'; h.render(); }
      }
      else if (action === 'br-rematch' && s?.self.role === 'host') {
        if (typeof global.ezikIapStart === 'function') {
          const cycle = (Number(s.gameNumber) || 0) + 1;
          global.ezikIapStart(() => { if (!send({ t: 'rematch', rev: s.version })) throw new Error('board-start-unavailable'); }, S.session.code, 'board', {
            cycle: String(cycle), roomInstanceId: S.session.roomId || s.roomId, waitForStart: () => waitForGame(cycle),
          });
        }
        else { S.error = 'تعذّر فتح خيارات الجلسة. أعدوا تحميل الصفحة.'; h.render(); }
      }
      else if (action === 'tile' && s?.canPick) send({ t: 'pick', slot: +el.dataset.slot, rev: s.version });
      else if (action === 'answer' && s?.canAnswer && q) send({ t: 'answer', qn: q.qn, pos: +el.dataset.answer });
      else if (action === 'br-answer-pick' && s?.canAnswer) { S.answer = +el.dataset.answer; h.render(); }
      else if (action === 'br-answer-lock' && q && s.canAnswer) send({ t: 'answer', qn: q.qn, ...(q.shown ? { pos: S.answer } : { text: S.text.trim() }) });
      else if (['show-options', 'br-show-options'].includes(action) && q && s.canShowOptions) send({ t: 'showOptions', qn: q.qn });
      else if (action === 'reveal-answer' && q && s.canReveal) send({ t: 'reveal', qn: q.qn });
      else if (action === 'award' && q && s.canAward) send({ t: 'award', qn: q.qn, team: +el.dataset.team });
      else if (!['mute', 'home', 'dialog-yes', 'dialog-no'].includes(action)) return true;
      else return false;
      return true;
    }
    function input(el) {
      if (el.hasAttribute('data-board-number')) { M.settings.roomCode = digits(el.value); el.value = M.settings.roomCode; return true; }
      if (el.hasAttribute('data-board-name')) { S.name = el.value; return true; }
      if (el.hasAttribute('data-board-answer')) { S.text = el.value; const b = h.app.querySelector('[data-action="br-answer-lock"]'); if (b) b.disabled = !S.text.trim() || !S.connected; return true; }
      return false;
    }
    global.addEventListener('pagehide', () => stop());
    global.addEventListener('pageshow', event => { if (event.persisted && S.session) connect(); });
    return Object.freeze({ create, card, view, handle, input, resume, join: code => { let saved; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (_) {} enter(saved?.code === code ? saved : { code, role: 'candidate' }, 'room-join'); }, leave, get busy() { return S.busy; }, get active() { return !!S.session; }, get diagnostics() { return { connected: S.connected, snapshot: S.snapshot, error: S.error }; } });
  }
  global.KunuzBoardRooms = Object.freeze({ attach });
})(window);
