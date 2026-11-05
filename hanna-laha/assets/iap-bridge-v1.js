/* ONLINE_GENERATION_BEGIN: worker account contract v2, public discovery only. */
(function (global) {
  'use strict';
  const ACCOUNT = 'ACCOUNT', LEGACY = 'LEGACY', UNKNOWN = 'UNKNOWN';
  const ROOM_KEY = 'kunuz_worker_rooms_v1';
  const live = new Set();
  function trustedOrigin(value) {
    try {
      const url = new URL(value), page = new URL(global.location.href);
      const local = ['localhost', '127.0.0.1', '[::1]'];
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
      if (url.origin === 'https://hanna-laha.hl-worker.workers.dev') return url.origin;
      if (local.includes(page.hostname) && local.includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return url.origin;
    } catch (_) {}
    return null;
  }
  async function discover(origin, current, signal) {
    if (!trustedOrigin(origin) || !current()) return UNKNOWN;
    const controller = new AbortController(), started = performance.now();
    let reader, timer, abort;
    const deadline = new Promise(resolve => {
      abort = () => { controller.abort(); if (reader) reader.cancel().catch(() => {}); resolve(UNKNOWN); };
      timer = setTimeout(abort, 5000);
      if (signal) { signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); }
    });
    const request = (async () => {
      try {
        const bytes = new Uint8Array(16);
        global.crypto.getRandomValues(bytes);
        const probe = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        const url = origin + '/api/account-capabilities?probe=' + probe;
        const response = await global.fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
        if (controller.signal.aborted || !current() || performance.now() - started >= 5000 || response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || response.url !== url) return UNKNOWN;
        if (!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '') || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) return UNKNOWN;
        // These headers are optional across CORS. Reject a known cache hit if exposed.
        if (Number(response.headers.get('age')) > 0 || /\bhit\b/i.test((response.headers.get('x-cache') || '') + ' ' + (response.headers.get('cf-cache-status') || ''))) return UNKNOWN;
        if (Number(response.headers.get('content-length')) > 4096 || !response.body || !response.body.getReader) return UNKNOWN;
        reader = response.body.getReader();
        const chunks = []; let size = 0;
        for (;;) {
          const part = await reader.read();
          if (controller.signal.aborted || !current() || performance.now() - started >= 5000) return UNKNOWN;
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 4096) { reader.cancel().catch(() => {}); return UNKNOWN; }
          chunks.push(part.value);
        }
        const body = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
        if (!data || typeof data !== 'object' || Array.isArray(data)) return UNKNOWN;
        const keys = Object.keys(data).sort().join(',');
        if (response.status === 200 && keys === 'accountProtocol,ok,probe' && data.ok === true && data.accountProtocol === 'ezik-games-account-v1' && data.probe === probe) return ACCOUNT;
        if (response.status === 404 && keys === 'error' && data.error === 'NOT_FOUND') return LEGACY;
      } catch (_) {}
      return UNKNOWN;
    })();
    try { return await Promise.race([request, deadline]); }
    finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort); controller.abort(); if (reader) reader.cancel().catch(() => {}); }
  }
  function accountSession() {
    try {
      const record = JSON.parse(global.localStorage.getItem('ezik_auth_session_v1') || 'null');
      return record && typeof record.session === 'string' && record.session.length >= 16 && record.session.length <= 128 ? record.session : '';
    } catch (_) { return ''; }
  }
  function create(options) {
    const origin = trustedOrigin(options.origin), game = options.game;
    if (!origin || !['hanna', 'harb', 'board'].includes(game)) throw new Error('online-origin-unavailable');
    let epoch = 0, pendingProbe = null, room = null, snapshot = null, snapshotReady = false;
    let pendingStart = null, acknowledged = null, blocked = '', recovery = {}, opening = null, helloSent = false;
    function readRooms() {
      try { const rows = JSON.parse(global.localStorage.getItem(ROOM_KEY) || '[]'); return Array.isArray(rows) ? rows : []; } catch (_) { return []; }
    }
    function known(code, roomId) {
      return readRooms().find(row => row.origin === origin && row.game === game && row.code === code && (!roomId || row.roomId === roomId));
    }
    function remember() {
      if (!room || ![ACCOUNT, LEGACY].includes(room.generation)) return;
      const row = { origin, game, code: room.code, roomId: room.roomId || '', generation: room.generation };
      const rows = readRooms().filter(r => !(r.origin === origin && r.game === game && r.code === room.code));
      rows.push(row);
      try { global.localStorage.setItem(ROOM_KEY, JSON.stringify(rows.slice(-48))); } catch (_) {}
    }
    function invalidate() { epoch++; if (pendingProbe) pendingProbe.abort(); pendingProbe = null; opening = null; }
    function fail(reason) {
      blocked = reason;
      if (typeof global.ezikOnlineRecovery === 'function') global.ezikOnlineRecovery({ reason, retry: recovery.retry, newRoom: recovery.newRoom });
      const error = new Error('online-' + reason); error.code = 'SERVER'; throw error;
    }
    async function fresh(kind, checkRoom = true) {
      invalidate(); const mine = epoch, boundRoom = room, abort = new AbortController(); pendingProbe = abort;
      const current = () => epoch === mine && room === boundRoom && !abort.signal.aborted;
      const generation = await discover(origin, current, abort.signal);
      if (!current()) throw new Error('online-superseded');
      pendingProbe = null;
      if (generation === UNKNOWN) return fail('unavailable');
      if (checkRoom && room) {
        if (!room.generation) {
          if (room.existing && generation !== LEGACY) return fail('generation-changed');
          room.generation = generation; remember();
        }
        if (room.generation !== generation) return fail('generation-changed');
      }
      blocked = '';
      return { generation, mine, room: boundRoom, kind };
    }
    function current(ticket) { return ticket && ticket.mine === epoch && ticket.room === room; }
    function withSession(message, generation) {
      const value = { ...message }; delete value.session;
      if (generation === ACCOUNT) { const session = accountSession(); if (session) value.session = session; }
      return value;
    }
    const api = {
      get origin() { return origin; },
      get generation() { return room?.generation || UNKNOWN; },
      get blocked() { return blocked; },
      setRecovery(value) { recovery = value || {}; },
      bind(value) {
        invalidate(); helloSent = false; snapshotReady = false; snapshot = null; pendingStart = null; acknowledged = null;
        const old = known(value.code, value.roomId);
        room = { code: value.code, roomId: value.roomId || '', existing: !!value.existing, generation: old && [ACCOUNT, LEGACY].includes(old.generation) ? old.generation : '' };
      },
      async createRoom(url, init, fetcher) {
        if (new URL(url).origin !== origin) return fail('unavailable');
        const ticket = await fresh('create', false);
        const body = JSON.parse(init.body);
        if (body.previous) {
          const old = known(body.previous.code, body.previous.roomId);
          if ((old?.generation || LEGACY) !== ticket.generation) return fail('generation-changed');
        }
        const headers = new Headers(init.headers); headers.delete('x-ezik-session');
        if (ticket.generation === ACCOUNT) { const session = accountSession(); if (session) headers.set('x-ezik-session', session); }
        const response = await (fetcher || global.fetch.bind(global))(url, { ...init, headers, redirect: 'error' });
        if (!current(ticket)) throw new Error('online-superseded');
        if (response.ok) {
          const data = await response.clone().json();
          if (!current(ticket)) throw new Error('online-superseded');
          room = { code: data.code, roomId: data.roomId, generation: ticket.generation, existing: true }; remember();
        } else if (response.status === 401 || response.status === 403) api.permissionError('FORBIDDEN');
        return response;
      },
      async open() { helloSent = false; snapshotReady = false; const ticket = await fresh('open'); opening = ticket; return ticket; },
      hello(ticket, message, send) {
        if (opening !== ticket || !current(ticket)) return fail('unavailable');
        opening = null; helloSent = true;
        return send(withSession(message, ticket.generation));
      },
      async modeForStart() { return (await fresh('start-policy')).generation; },
      async send(message, send) {
        if (!['start', 'rematch'].includes(message.t)) return send(message);
        if (!room || !snapshotReady || pendingStart) return fail('snapshot-required');
        const ticket = await fresh(message.t);
        if (!current(ticket) || !snapshotReady || pendingStart) return fail('snapshot-required');
        pendingStart = { kind: message.t, generation: ticket.generation, before: snapshot, room };
        acknowledged = null;
        const result = send(withSession(message, ticket.generation));
        if (result === false) { pendingStart = null; snapshotReady = false; return fail('snapshot-required'); }
        return true;
      },
      observe(value) {
        if (!value || !room || !helloSent) return;
        if (room.roomId && value.roomId && room.roomId !== value.roomId) return;
        if (!room.roomId && value.roomId) { room.roomId = value.roomId; remember(); }
        const reconnected = !snapshotReady;
        snapshot = value; snapshotReady = true;
        if (pendingStart) {
          const phase = value.phase || value.stage;
          const before = pendingStart.before;
          const advanced = value.version > (before?.version ?? -1) || value.rev > (before?.rev ?? -1);
          const started = pendingStart.kind === 'start' ? phase !== 'lobby' : phase !== (before?.phase || before?.stage) || Number(value.gameNumber) > Number(before?.gameNumber);
          if ((advanced || reconnected) && started) { acknowledged = pendingStart; pendingStart = null; }
          else if (reconnected) pendingStart = null;
        }
      },
      async legacyConsumption() {
        if (!acknowledged || acknowledged.generation !== LEGACY || acknowledged.room !== room || room?.generation !== LEGACY) return fail('reconcile');
        const ack = acknowledged, ticket = await fresh('post-start');
        if (!current(ticket) || ticket.generation !== LEGACY || acknowledged !== ack) return fail('reconcile');
        return true;
      },
      permissionError(code) {
        if (code === 'FORBIDDEN' && typeof global.ezikOnlineRefreshAccount === 'function') global.ezikOnlineRefreshAccount();
        if (code === 'FORBIDDEN' || code === 'SERVER') { snapshotReady = false; try { fail('snapshot-required'); } catch (_) {} }
      },
      suspend() { invalidate(); if (pendingStart) { snapshotReady = false; helloSent = false; } },
      disconnect() { invalidate(); helloSent = false; snapshotReady = false; },
      dispose() { invalidate(); live.delete(api); }
    };
    live.add(api); return Object.freeze(api);
  }
  global.addEventListener('pagehide', () => live.forEach(client => client.suspend()));
  global.document.addEventListener('visibilitychange', () => { if (global.document.visibilityState === 'hidden') live.forEach(client => client.suspend()); });
  global.KunuzOnline = Object.freeze({ create, discover, trustedOrigin });
})(window);
/* ONLINE_GENERATION_END */

(function () {
  'use strict';

  var SESSION_KEY = 'ezik_auth_session_v1';
  var DEVICE_KEY = 'mrb_device_v1';
  var APP_STORE_URL = 'https://apps.apple.com/app/id6797100518';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.almurabbi.tutor';
  var PRODUCT_ROWS = [
    { kind: 'week', id: 'ezik_pass_week_1', name: 'أسبوع لعب غير محدود' },
    { kind: 'month', id: 'ezik_pass_month_1', name: 'شهر لعب غير محدود' },
    { kind: 'year', id: 'ezik_pass_year_1', name: 'سنة لعب غير محدودة' },
  ];
  var active = null;
  var startContext = null;
  var sessionIdMemory = Object.create(null);
  var pendingSignIn = false;
  var pendingSignInAction = null;
  var resumingSignIn = false;
  var panelRefreshCleanup = null;
  var homeSignInCleanup = null;
  var homeNoticeUpdater = null;
  var homeNoticeSession = '';
  var homeEntryPromise = null;
  var RETURN_KEY = 'kunuz_iap_return_v1';

  function authSession() {
    try {
      var value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value && typeof value.session === 'string' ? value.session : '';
    } catch (e) { return ''; }
  }

  function deviceId() {
    try {
      var value = localStorage.getItem(DEVICE_KEY) || '';
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
        value = window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
        localStorage.setItem(DEVICE_KEY, value);
      }
      return value;
    } catch (e) { return ''; }
  }

  function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }

  function requestShell(type, extra, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var bridge = window.ReactNativeWebView;
      if (!bridge || typeof bridge.postMessage !== 'function') {
        reject(new Error('bridge-unavailable'));
        return;
      }
      var id = requestId();
      var expected = type + '.result';
      var timer = 0;
      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('ezik-iap', onReply);
      }
      function onReply(event) {
        var data = event && event.detail;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || data.v !== 1 || data.id !== id || data.type !== expected) return;
        cleanup();
        resolve(data);
      }
      window.addEventListener('ezik-iap', onReply);
      timer = setTimeout(function () {
        cleanup();
        reject(new Error('bridge-timeout'));
      }, timeoutMs || 15000);
      try {
        bridge.postMessage(JSON.stringify(Object.assign({ v: 1, type: type, id: id }, extra || {})));
      } catch (e) {
        cleanup();
        reject(new Error('bridge-send-failed'));
      }
    });
  }

  function openModal(title, copy, options) {
    options = options || {};
    closeModal();
    var backdrop = document.createElement('div');
    backdrop.className = 'ezik-iap-backdrop';
    backdrop.setAttribute('role', 'presentation');
    var card = document.createElement('section');
    card.className = 'ezik-iap-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('dir', 'rtl');
    var header = document.createElement('header');
    header.className = 'ezik-iap-header';
    var heading = document.createElement('h2');
    heading.textContent = title;
    var close = null;
    if (options.closeButton !== false) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'ezik-iap-button ezik-iap-button-secondary';
      close.textContent = 'إغلاق';
      close.addEventListener('click', closeModal);
      header.append(heading, close);
    } else header.append(heading);
    var paragraph = document.createElement('p');
    paragraph.className = 'ezik-iap-copy';
    paragraph.textContent = copy || '';
    var content = document.createElement('div');
    content.className = 'ezik-iap-content';
    card.append(header, paragraph, content);
    backdrop.append(card);
    backdrop.addEventListener('click', function (event) {
      if (active && active.closeButton && event.target === backdrop && active.busy !== true) closeModal();
    });
    document.body.append(backdrop);
    active = { backdrop: backdrop, card: card, paragraph: paragraph, content: content, closeButton: close, busy: false };
    if (close) close.focus();
    else { card.tabIndex = -1; card.focus(); }
    return active;
  }

  function closeModal() {
    var closedModal = active;
    if (panelRefreshCleanup) {
      panelRefreshCleanup();
      panelRefreshCleanup = null;
    }
    if (active && active.backdrop && active.backdrop.parentNode) active.backdrop.parentNode.removeChild(active.backdrop);
    active = null;
    if (closedModal && closedModal.purchaseCompleted === true) {
      refreshHomeAfterPurchase(closedModal.purchaseSession);
    }
  }

  function setModalBusy(value) {
    if (!active) return;
    active.busy = value === true;
    if (active.closeButton) active.closeButton.disabled = active.busy;
    active.content.querySelectorAll('button').forEach(function (node) { node.disabled = active.busy; });
  }

  function line(parent, text, className) {
    var node = document.createElement('p');
    node.className = className || '';
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function button(text, onClick, secondary) {
    var node = document.createElement('button');
    node.type = 'button';
    node.className = 'ezik-iap-button' + (secondary ? ' ezik-iap-button-secondary' : '');
    node.textContent = text;
    node.addEventListener('click', onClick);
    return node;
  }

  function showSignIn(resumeAction, options) {
    options = options || {};
    pendingSignInAction = typeof resumeAction === 'function' ? resumeAction : null;
    var modal = openModal('تسجيل الدخول', 'يلزم تسجيل الدخول إلى حساب عزك قبل بدء الجلسة أو الشراء.');
    line(modal.content, 'سجّل الدخول إلى حساب عزك، ثم ارجع إلى هذه الغرفة للمتابعة.');
    if (options.signinRule === true) {
      modal.card.querySelector('h2').textContent = 'تسجيل الدخول';
      modal.paragraph.textContent = 'ألعاب كنوز المعرفة مجانية للجميع، ويلزم تسجيل الدخول إلى حساب عزك قبل اللعب.';
      var followUp = modal.content.querySelector('p');
      if (followUp) followUp.textContent = 'سجّل الدخول، ثم ارجع إلى هذه الصفحة للمتابعة.';
      if (options.lockedPage === true) {
        if (modal.closeButton && modal.closeButton.parentNode) modal.closeButton.parentNode.removeChild(modal.closeButton);
        modal.closeButton = null;
        modal.card.tabIndex = -1;
        modal.card.focus();
      }
    }
    var signIn = document.createElement('a');
    signIn.className = 'ezik-iap-button';
    signIn.href = '/?ezik_iap_signin=1';
    signIn.target = '_blank';
    signIn.rel = 'noopener noreferrer';
    signIn.textContent = 'تسجيل الدخول';
    modal.content.append(signIn);
    if (options.signinRule === true && options.lockedPage === true) {
      modal.content.append(button('العودة إلى كنوز المعرفة', function () {
        closeModal(); window.location.href = '/quest.html';
      }, true));
    }
    watchForSignIn();
  }

  function showFailure(message) {
    var modal = openModal('تعذّر إكمال العملية', message || 'تعذّر الاتصال بالخادم الآن. حاول مرة أخرى.');
    modal.content.append(button('حسنًا', closeModal, true));
  }

  function balanceSnapshot(balance) {
    return {
      credits: Number(balance.credits) || 0,
      subscriptionExpiresAt: Number(balance.subscriptionExpiresAt) || null,
      freeFirstUsed: !!balance.freeFirstUsed,
      freeUsedByGame: balance.freeUsedByGame && typeof balance.freeUsedByGame === 'object'
        ? balance.freeUsedByGame : {},
    };
  }

  function authRecord() {
    try {
      var value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value && typeof value.session === 'string' && value.session ? value : null;
    } catch (e) { return null; }
  }

  function accountLabel() {
    var account = authRecord();
    if (!account) return 'حساب عزك';
    if (typeof account.name === 'string' && account.name.trim()) return account.name.trim();
    var email = typeof account.email === 'string' ? account.email.trim() : '';
    var at = email.lastIndexOf('@');
    if (at > 0 && at < email.length - 1) return email.charAt(0) + '•••' + email.slice(at);
    return 'حساب عزك';
  }

  var cachedEnforcementMode = '';
  var cachedSignInRule = 'none';
  var cachedEnforcementAt = 0;
  var VERIFIED_MODE_KEY = 'ezik_iap_verified_mode_v1';
  var VERIFIED_ENTRY_DECISION_KEY = 'ezik_iap_entry_decision_v1';

  function readVerifiedMode() {
    try {
      var verified = JSON.parse(localStorage.getItem(VERIFIED_MODE_KEY) || 'null');
      if (verified && verified.schema === 1 && ['off', 'test', 'all', 'free'].includes(verified.mode)
        && Number.isFinite(verified.verifiedAt) && verified.verifiedAt > 0) {
        return {
          schema: 1,
          mode: verified.mode,
          signin: verified.mode === 'free' && ['all', 'host'].includes(verified.signin) ? verified.signin : 'none',
          verifiedAt: verified.verifiedAt,
        };
      }
    } catch (e) {}
    return null;
  }

  function sessionFingerprint(session) {
    if (typeof session !== 'string' || !session) return '';
    var first = 2166136261;
    var second = 2246822519;
    for (var i = 0; i < session.length; i++) {
      var code = session.charCodeAt(i);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 3266489917);
    }
    return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
  }

  function rememberEntryDecision(session, balance) {
    if (!session || !balance || typeof balance.appUserId !== 'string' || !balance.appUserId
      || typeof balance.purchaseEntry !== 'boolean') return;
    var fingerprint = sessionFingerprint(session);
    if (!fingerprint) return;
    try {
      var stored = JSON.parse(localStorage.getItem(VERIFIED_ENTRY_DECISION_KEY) || 'null');
      var sessions = stored && stored.schema === 1 && stored.sessions && typeof stored.sessions === 'object'
        ? stored.sessions : {};
      sessions[fingerprint] = {
        appUserId: balance.appUserId,
        purchaseEntry: balance.purchaseEntry,
        verifiedAt: Date.now(),
      };
      var fingerprints = Object.keys(sessions).sort(function (left, right) {
        return (Number(sessions[left] && sessions[left].verifiedAt) || 0)
          - (Number(sessions[right] && sessions[right].verifiedAt) || 0);
      });
      while (fingerprints.length > 32) delete sessions[fingerprints.shift()];
      localStorage.setItem(VERIFIED_ENTRY_DECISION_KEY, JSON.stringify({ schema: 1, sessions: sessions }));
    } catch (e) {}
  }

  function lastEntryDecisionForSession(session) {
    var fingerprint = sessionFingerprint(session);
    if (!fingerprint) return null;
    try {
      var stored = JSON.parse(localStorage.getItem(VERIFIED_ENTRY_DECISION_KEY) || 'null');
      var decision = stored && stored.schema === 1 && stored.sessions && typeof stored.sessions === 'object'
        ? stored.sessions[fingerprint] : null;
      if (decision
        && typeof decision.appUserId === 'string' && decision.appUserId
        && typeof decision.purchaseEntry === 'boolean' && Number.isFinite(decision.verifiedAt)
        && decision.verifiedAt > 0) return decision.purchaseEntry;
    } catch (e) {}
    return null;
  }

  async function getEnforcementState() {
    // Keep the last public mode and account-scoped entry decision for offline home rendering.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      var verified = readVerifiedMode();
      if (verified) return verified;
      throw new Error('iap-status-unavailable');
    }
    if (cachedEnforcementMode && Date.now() - cachedEnforcementAt < 30000) {
      return { mode: cachedEnforcementMode, signin: cachedSignInRule };
    }
    var response = await fetch('../api/iap-status', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'default',
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !['off', 'test', 'all', 'free'].includes(data.mode)) {
      throw new Error('iap-status-unavailable');
    }
    cachedSignInRule = data.mode === 'free' && ['all', 'host'].includes(data.signin) ? data.signin : 'none';
    cachedEnforcementMode = data.mode;
    cachedEnforcementAt = Date.now();
    try { localStorage.setItem(VERIFIED_MODE_KEY, JSON.stringify({ schema: 1, mode: data.mode, signin: cachedSignInRule, verifiedAt: cachedEnforcementAt })); } catch (e) {}
    return { mode: data.mode, signin: cachedSignInRule };
  }

  async function getEnforcementMode() {
    return (await getEnforcementState()).mode;
  }

  async function startWithoutIap(context) {
    if (!context || typeof context.start !== 'function') return false;
    try {
      var sent = await Promise.resolve(context.start());
      if (context.online && sent === false) return false;
      closeModal();
      return true;
    } catch (e) {
      if (context.online) return false;
      showFailure('تعذّر إكمال العملية الآن. حاول مرة أخرى.');
      return false;
    }
  }

  async function getBalance(session) {
    var response = await fetch('../api/iap-balance', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'x-ezik-session': session },
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) return { ok: false, status: response.status, data: data };
    if (typeof data.appUserId !== 'string') return { ok: false, status: 503, data: {} };
    rememberEntryDecision(session, data);
    return { ok: true, data: data };
  }

  async function refreshHomeAfterPurchase(session) {
    if (!session || session !== authSession() || window.location.pathname !== '/quest.html'
      || session !== homeNoticeSession || typeof homeNoticeUpdater !== 'function') return;
    var response;
    try { response = await getBalance(session); } catch (e) { return; }
    if (!response.ok) return;
    var expiresAt = Number(response.data.subscriptionExpiresAt);
    if (response.data.subscriptionActive === true || Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      homeNoticeUpdater(null, true);
    }
  }

  function arabicDigits(value) {
    return String(value).replace(/[0-9]/g, function (digit) { return '٠١٢٣٤٥٦٧٨٩'[Number(digit)]; });
  }

  function balanceText(balance) {
    var parts = [];
    var expiresAt = Number(balance && balance.subscriptionExpiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      var date = new Date(expiresAt).toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
      parts.push('اشتراكك حتى ' + date);
    } else parts.push('لا يوجد اشتراك');
    var credits = Number(balance && balance.credits) || 0;
    if (credits > 0) parts.push('رصيدك: ' + arabicDigits(credits) + ' جلسة');
    return parts.join(' · ');
  }

  function balanceLine(parent, balance) {
    var node = line(parent, balance ? balanceText(balance) : 'جارٍ تحميل الرصيد…', 'ezik-iap-balance');
    return node;
  }

  function updateBalanceLine(node, balance) {
    if (node && balance) node.textContent = balanceText(balance);
  }

  function storeButton(text, href) {
    var node = document.createElement('a');
    node.className = 'ezik-iap-button ezik-iap-store-button';
    node.href = href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.textContent = text;
    return node;
  }

  function stopSignInWatch() {
    window.removeEventListener('storage', resumeAfterSignIn);
    window.removeEventListener('focus', resumeAfterSignIn);
    document.removeEventListener('visibilitychange', resumeAfterSignIn);
  }

  function watchForSignIn() {
    pendingSignIn = true;
    window.addEventListener('storage', resumeAfterSignIn);
    window.addEventListener('focus', resumeAfterSignIn);
    document.addEventListener('visibilitychange', resumeAfterSignIn);
  }

  async function resumeAfterSignIn(event) {
    if (event && event.type === 'storage' && event.key !== SESSION_KEY) return;
    if (document.visibilityState === 'hidden' || !pendingSignIn || resumingSignIn
      || !authSession()) return;
    pendingSignIn = false;
    resumingSignIn = true;
    stopSignInWatch();
    var resume = pendingSignInAction;
    pendingSignInAction = null;
    closeModal();
    try { if (resume) await resume(); }
    finally { resumingSignIn = false; }
  }

  async function requestTrialStart(session) {
    var started;
    try {
      started = await fetch('../api/iap-trial-start', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'x-ezik-session': session },
      });
    } catch (e) { return { ok: false, status: 503, data: {} }; }
    var data = await started.json().catch(function () { return {}; });
    return { ok: started.ok && data.ok === true, status: started.status, data: data };
  }

  async function entitlementBalance(session) {
    var response;
    try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
    if (!response.ok || response.data.enforced !== true || response.data.trial) return response;
    var started = await requestTrialStart(session);
    if (!started.ok) return { ok: false, status: started.status, data: started.data };
    try { return await getBalance(session); } catch (e) { return { ok: false, status: 503, data: {} }; }
  }

  function hasEntitlement(balance) {
    return balance && (balance.trial && balance.trial.active === true
      || balance.subscriptionActive === true || Number(balance.credits) > 0);
  }

  function hasFreeEntitlement(balance) {
    return balance && (balance.trial && balance.trial.active === true
      || balance.subscriptionActive === true);
  }

  function allowedReturnPath(value) {
    return typeof value === 'string'
      && /^\/(?:quest-(?:ghaws|harb|test|board)\.html|hanna-laha(?:\/[^?#]*)?)(?:[?#].*)?$/u.test(value);
  }

  function navigateToMainPurchase(returnPath) {
    var path = allowedReturnPath(returnPath) ? returnPath
      : window.location.pathname + window.location.search + window.location.hash;
    if (allowedReturnPath(path)) {
      try { sessionStorage.setItem(RETURN_KEY, path); } catch (e) {}
    }
    window.location.href = '/quest.html?iap_purchase=1';
  }

  function finishPurchaseReturn() {
    if (window.location.pathname !== '/quest.html'
      || new URLSearchParams(window.location.search).get('iap_purchase') !== '1') return false;
    var path = '';
    try { path = sessionStorage.getItem(RETURN_KEY) || ''; } catch (e) {}
    if (!allowedReturnPath(path)) return false;
    try { sessionStorage.removeItem(RETURN_KEY); } catch (e) {}
    window.location.href = path;
    return true;
  }

  function navigateJoinByCode(gameId) {
    if (gameId === 'hanna') window.location.href = '/hanna-laha/join?rooms=1&entry=1';
    else if (gameId === 'harb') window.location.href = '/quest-harb.html?iap_join=1';
    else if (gameId === 'board') window.location.href = '/quest-board.html?iap_join=1';
  }

  function showExpired(gameId, returnPath, balance) {
    var expiresAt = Number(balance && balance.subscriptionExpiresAt);
    var copy = Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()
      ? 'انتهى اشتراكك — الرجاء الشراء للدخول'
      : 'انتهت تجربتك المجانية — الرجاء الشراء للدخول';
    var modal = openModal('الدخول إلى اللعبة', copy, { closeButton: false });
    modal.content.append(button('اشتر لعبة', function () { navigateToMainPurchase(returnPath); }));
    if (gameId === 'harb' || gameId === 'board' || gameId === 'hanna') {
      modal.content.append(button('انضم لغرفة برمز', function () { navigateJoinByCode(gameId); }, true));
    }
  }

  function showTrialDisclosure(gameId, session, returnPath, onAllowed) {
    var copy = 'ألعاب كنوز المعرفة مجانية لك لمدة ٧ أيام. ما زلنا نحسّن الألعاب. بعد الأسبوع، يلزم اشتراك أسبوع أو شهر أو سنة لدخول أي لعبة. الأسعار تحت زر «اشتر لعبة».';
    var modal = openModal('أسبوعك المجاني', copy, { closeButton: false });
    modal.content.append(button('العودة إلى كنوز المعرفة', function () {
      closeModal(); window.location.href = '/quest.html';
    }, true));
    modal.content.append(button('ابدأ أسبوعك المجاني', async function () {
      setModalBusy(true);
      var started = await requestTrialStart(session);
      if (!started.ok) {
        showFailure('تعذّر بدء أسبوعك المجاني الآن. حاول مرة أخرى.');
        return;
      }
      var response;
      try { response = await getBalance(session); } catch (e) { response = { ok: false, status: 503 }; }
      closeModal();
      if (!response.ok) {
        showFailure('تعذّر التحقق من رصيد الحساب الآن. حاول مرة أخرى.');
        return;
      }
      if (response.data.enforced !== true || hasEntitlement(response.data)) {
        if (typeof onAllowed === 'function') await Promise.resolve(onAllowed());
      } else showExpired(gameId, returnPath, response.data);
    }));
  }

  async function checkGameAccess(gameId, onAllowed, returnPath, accessOptions) {
    accessOptions = accessOptions && typeof accessOptions === 'object' ? accessOptions : {};
    async function continueIfAllowed() {
      if (typeof onAllowed === 'function') await Promise.resolve(onAllowed());
      return true;
    }
    if (!['ghaws', 'harb', 'test', 'board', 'hanna'].includes(gameId)) return false;
    if (active) return false;
    var enforcement;
    try { enforcement = await getEnforcementState(); } catch (e) { enforcement = { mode: 'all', signin: 'none' }; }
    var mode = enforcement.mode;
    if (accessOptions.joiner === true && (mode !== 'free' || enforcement.signin !== 'all')) return continueIfAllowed();
    var freeSignInRequired = mode === 'free' && (accessOptions.joiner === true
      ? enforcement.signin === 'all'
      : ['all', 'host'].includes(enforcement.signin));
    if (mode === 'free' && !freeSignInRequired) return continueIfAllowed();
    if (freeSignInRequired) {
      var freeSession = authSession();
      var freeReturnPath = returnPath || window.location.pathname + window.location.search + window.location.hash;
      var freeResume = function () { return checkGameAccess(gameId, onAllowed, freeReturnPath, accessOptions); };
      var signInOptions = { signinRule: true, lockedPage: accessOptions.lockedPage === true };
      if (!freeSession) {
        if (accessOptions.lockedPage === true) accessOptions.waitingForSignIn = true;
        showSignIn(freeResume, signInOptions);
        return false;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return continueIfAllowed();
      var freeBalance;
      try { freeBalance = await getBalance(freeSession); } catch (e) { freeBalance = { ok: false, status: 503, data: {} }; }
      if (!freeBalance.ok && freeBalance.status === 401) {
        if (accessOptions.lockedPage === true) accessOptions.waitingForSignIn = true;
        showSignIn(freeResume, signInOptions);
        return false;
      }
      return continueIfAllowed();
    }
    if (mode === 'off' || mode === 'test' && !authSession()) return continueIfAllowed();
    var session = authSession();
    if (!session) { showSignIn(function () { return checkGameAccess(gameId, onAllowed, returnPath); }); return false; }
    var response;
    try { response = await getBalance(session); } catch (e) { response = { ok: false, status: 503, data: {} }; }
    if (!response.ok) {
      if (response.status === 401) { showSignIn(function () { return checkGameAccess(gameId, onAllowed, returnPath); }); return false; }
      showFailure('تعذّر التحقق من رصيد الحساب الآن. حاول مرة أخرى.');
      return false;
    }
    if (response.data.enforced !== true) return continueIfAllowed();
    if (hasFreeEntitlement(response.data) || Number(response.data.credits) > 0) return continueIfAllowed();
    if (!response.data.trial) {
      if (window.location.pathname === '/quest.html' && homeEntryPromise) {
        try { await homeEntryPromise; } catch (e) {}
        try { response = await getBalance(session); } catch (e) { response = { ok: false, status: 503, data: {} }; }
        if (!response.ok) {
          if (response.status === 401) { showSignIn(function () { return checkGameAccess(gameId, onAllowed, returnPath); }); return false; }
          showFailure('تعذّر التحقق من رصيد الحساب الآن. حاول مرة أخرى.');
          return false;
        }
        if (response.data.enforced !== true) return continueIfAllowed();
      }
      if (!response.data.trial) {
        var expiresAt = Number(response.data.subscriptionExpiresAt);
        if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
          if (Number(response.data.credits) > 0) return continueIfAllowed();
          showExpired(gameId, returnPath, response.data);
          return false;
        }
        showTrialDisclosure(gameId, session, returnPath, onAllowed);
        return false;
      }
    }
    if (hasEntitlement(response.data)) return continueIfAllowed();
    showExpired(gameId, returnPath, response.data);
    return false;
  }

  async function checkHostAccess(gameId, onAllowed) {
    return checkGameAccess(gameId, onAllowed, window.location.pathname + window.location.search + window.location.hash);
  }

  async function startWithIntent(context, intent) {
    if (!context || typeof context.start !== 'function') return;
    if (context.inFlight === true) return;
    context.inFlight = true;
    var request = roomSessionId(context.roomInstanceId || context.roomCode, context.gameId, context.cycle);
    var waiting = null;
    var startSignal = null;
    try {
      if (typeof context.waitForStart === 'function') {
        waiting = context.waitForStart();
        startSignal = Promise.resolve(waiting.promise || waiting);
        startSignal.catch(function () {});
      }
      if (await Promise.resolve(context.start()) === false) {
        if (waiting && typeof waiting.cancel === 'function') waiting.cancel();
        context.inFlight = false;
        if (!context.online) closeModal();
        return false;
      }
      if (startSignal) await startSignal;
    } catch (e) {
      if (waiting && typeof waiting.cancel === 'function') waiting.cancel();
      context.inFlight = false;
      if (context.online) { context.online.permissionError('SERVER'); return false; }
      showFailure('لم تبدأ الجولة بعد؛ لم يُخصم أي رصيد. حاول مرة أخرى.');
      return false;
    }
    if (context.online) {
      try { if (!startSignal || !await context.online.legacyConsumption()) return false; }
      catch (_) { context.inFlight = false; return false; }
    }
    var result = await consumeAndStart(request, context.gameId, intent);
    if (result !== true) context.inFlight = false;
  }

  function priceTotal(price, quantity) {
    if (!price || typeof price.price !== 'number' || !Number.isFinite(price.price)
      || typeof price.currencyCode !== 'string') return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currencyCode }).format(Number(price.price) * quantity);
    } catch (e) { return ''; }
  }

  async function initializePurchase() {
    var mode = '';
    try { mode = await getEnforcementMode(); } catch (e) {}
    var lastMode = mode ? null : readVerifiedMode();
    var freeMode = mode === 'free' || !!(lastMode && lastMode.mode === 'free');
    var session = authSession();
    if (!session) {
      if (freeMode) return;
      showSignIn(initializePurchase);
      return;
    }
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
      if (freeMode) return;
      showWebBuyPanel();
      return;
    }

    var freeEntryBalance = null;
    if (freeMode) {
      var entryResponse;
      try { entryResponse = await getBalance(session); } catch (e) { entryResponse = { ok: false }; }
      if (!entryResponse.ok || entryResponse.data.purchaseEntry !== true) return;
      rememberEntryDecision(session, entryResponse.data);
      freeEntryBalance = entryResponse;
    }

    var modal = openModal('خيارات الشراء', 'الحساب: ' + accountLabel() + '. الأسعار المعروضة من المتجر، ويُفتح تأكيد الدفع لكل عملية شراء.');
    line(modal.content, 'جارٍ تحميل الحساب والأسعار…', 'ezik-iap-status');
    var currentBalance = freeEntryBalance || await getBalance(session);
    if (active !== modal) return;
    if (!currentBalance.ok) {
      if (currentBalance.status === 401) { showSignIn(initializePurchase); return; }
      showFailure('تعذّر تحميل الرصيد الآن. حاول مرة أخرى.');
      return;
    }

    var identifying = true;
    try {
      var identified = await requestShell('iap.identify', { appUserId: currentBalance.data.appUserId }, 15000);
      if (active !== modal) return;
      if (identified.ok !== true) throw new Error('identify-failed');
      identifying = false;
      var response = await requestShell('iap.prices', { productIds: ['ezik_pass_week_1', 'ezik_pass_month_1', 'ezik_pass_year_1'] }, 15000);
      if (active !== modal) return;
      if (response.ok !== true || !response.prices) throw new Error('prices-unavailable');
      showProducts(session, currentBalance.data, response.prices);
    } catch (e) {
      if (e.message === 'bridge-timeout' && identifying) {
        showWebBuyPanel();
        return;
      }
      var message = e.message === 'bridge-unavailable'
        ? 'الشراء غير متاح في هذا المتصفح. افتح الغرفة من تطبيق عزك.'
        : 'تعذّر تحميل أسعار المتجر. حاول مرة أخرى.';
      showFailure(message);
    }
  }

  async function showWebBuyPanel() {
    var modal = openModal('الشراء من تطبيق عزك', 'المشتريات متاحة من تطبيق عزك على آيفون أو أندرويد.');
    line(modal.content, 'اشترِ من تطبيق عزك بنفس حسابك (' + accountLabel() + ') ثم ارجع هنا وسيظهر رصيدك.');
    var session = authSession();
    var balanceDisplay = balanceLine(modal.content, null);
    var starting = null;
    try {
      var initial = await getBalance(session);
      if (active !== modal) return;
      if (initial.ok) { starting = initial.data; updateBalanceLine(balanceDisplay, initial.data); }
    } catch (e) {}
    var stores = document.createElement('div');
    stores.className = 'ezik-iap-store-links';
    stores.append(storeButton('App Store', APP_STORE_URL), storeButton('Google Play', PLAY_STORE_URL));
    var status = document.createElement('p');
    status.className = 'ezik-iap-status ezik-iap-note';
    var refresh = button('تحديث الرصيد', function () { refreshBalance(true); });
    modal.content.append(stores, refresh, status);
    var refreshing = false;

    async function refreshBalance(fromButton) {
      if (active !== modal || refreshing) return;
      var session = authSession();
      if (!session) { showSignIn(showWebBuyPanel); return; }
      refreshing = true;
      refresh.disabled = true;
      status.className = 'ezik-iap-status ezik-iap-note';
      status.textContent = 'جارٍ تحديث الرصيد…';
      var response;
      try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
      if (active !== modal) return;
      refreshing = false;
      refresh.disabled = false;
      if (!response.ok) {
        if (response.status === 401) { showSignIn(showWebBuyPanel); return; }
        status.className = 'ezik-iap-status ezik-iap-error';
        status.textContent = 'تعذّر تحديث الرصيد الآن. حاول مرة أخرى.';
        return;
      }
      var balance = response.data;
      updateBalanceLine(balanceDisplay, balance);
      var changed = starting && JSON.stringify(balanceSnapshot(balance)) !== JSON.stringify(balanceSnapshot(starting));
      if (changed) {
        starting = balance;
        status.textContent = 'تم تحديث الرصيد.';
        finishPurchaseReturn();
      } else if (fromButton) status.textContent = 'لم يظهر رصيد جديد بعد. يمكنك التحديث مرة أخرى بعد الشراء.';
      else if (!status.textContent) status.textContent = 'يمكنك تحديث الرصيد بعد إتمام الشراء في التطبيق.';
    }

    var onFocus = function () { refreshBalance(false); };
    var onVisibility = function () {
      if (document.visibilityState === 'visible') refreshBalance(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    var poller = setInterval(function () { refreshBalance(false); }, 5000);
    panelRefreshCleanup = function () {
      clearInterval(poller);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  function showProducts(session, startingBalance, prices) {
    var modal = openModal('خيارات الشراء', 'الحساب: ' + accountLabel() + '. اختر عدد مرات الشراء من المتجر. الحد الأقصى لكل منتج خمس مرات.');
    modal.content.replaceChildren();
    var balanceDisplay = balanceLine(modal.content, startingBalance);
    PRODUCT_ROWS.forEach(function (product) {
      if (!prices || !Object.prototype.hasOwnProperty.call(prices, product.id)) return;
      var price = prices[product.id];
      if (!price || typeof price.priceString !== 'string' || !price.priceString.trim()) return;
      var selectedProduct = product;
      var row = document.createElement('section');
      row.className = 'ezik-iap-row';
      var head = document.createElement('div');
      head.className = 'ezik-iap-row-head';
      var name = document.createElement('h3');
      name.textContent = product.name;
      var unit = document.createElement('p');
      unit.className = 'ezik-iap-price';
      unit.textContent = price && typeof price.priceString === 'string' ? price.priceString + ' لكل عملية' : 'السعر غير متاح';
      head.append(name, unit);

      var label = document.createElement('label');
      label.className = 'ezik-iap-field';
      label.textContent = 'عدد مرات الشراء';
      var input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '5';
      input.step = '1';
      input.inputMode = 'numeric';
      input.value = '';
      label.append(input);

      var total = document.createElement('p');
      total.className = 'ezik-iap-total';
      total.textContent = 'المجموع: —';
      input.addEventListener('input', function () {
        var n = input.value === '' ? 0 : Number(input.value);
        total.textContent = Number.isInteger(n) && n >= 1 && n <= 5 && priceTotal(price, n)
          ? 'المجموع: ' + priceTotal(price, n) : 'المجموع: —';
      });

      var status = line(row, '', 'ezik-iap-status');
      var buy = button('شراء', function () {
        var quantity = input.value === '' ? NaN : Number(input.value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
          status.className = 'ezik-iap-error';
          status.textContent = 'أدخل عددًا صحيحًا من واحد إلى خمسة.';
          return;
        }
        if (!price || typeof price.priceString !== 'string' || typeof price.price !== 'number'
          || !Number.isFinite(price.price) || !price.currencyCode) {
          status.className = 'ezik-iap-error';
          status.textContent = 'السعر غير متاح من المتجر الآن.';
          return;
        }
        buy.disabled = true;
        input.disabled = true;
        setModalBusy(true);
        buyProduct(selectedProduct, quantity, session, startingBalance, status, buy, input, balanceDisplay, modal);
      });
      row.append(head, label, total, status, buy);
      modal.content.append(row);
    });
    modal.content.append(button('إغلاق', closeModal, true));
  }

  function roomSessionId(roomCode, gameId, cycle) {
    var safeRoomCode = String(roomCode || 'room').replace(/[^A-Za-z0-9_-]/g, '');
    var safeGameId = String(gameId || 'hanna').replace(/[^A-Za-z0-9_-]/g, '');
    var safeCycle = String(cycle || 'default').replace(/[^A-Za-z0-9_-]/g, '');
    var key = 'ezik_iap_host_session_v2_' + safeGameId + '_' + safeRoomCode + '_' + safeCycle;
    try {
      var saved = sessionStorage.getItem(key);
      if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) {
        sessionIdMemory[key] = saved;
        return { key: key, id: saved };
      }
      var fresh = sessionIdMemory[key] || requestId();
      sessionIdMemory[key] = fresh;
      sessionStorage.setItem(key, fresh);
      return { key: key, id: fresh };
    } catch (e) {
      var fallback = sessionIdMemory[key] || requestId();
      sessionIdMemory[key] = fallback;
      return { key: '', id: fallback };
    }
  }

  async function consumeAndStart(request, gameId, intent) {
    var session = authSession();
    if (!session) {
      console.warn('[IAP] consume skipped after game start: signed-out session');
      closeModal();
      return true;
    }
    var response;
    try {
      response = await fetch('../api/iap-consume', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-ezik-session': session },
        body: JSON.stringify({ sessionId: request.id, gameId: gameId, intent: intent }),
      });
    } catch (e) {
      console.warn('[IAP] consume failed after game start; game continues without charge');
      closeModal();
      return true;
    }
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.ok !== true) {
      console.warn('[IAP] consume rejected after game start; game continues without charge', response.status, data.error || 'iap-consume-failed');
      closeModal();
      return true;
    }
    closeModal();
    return true;
  }

  async function buyProduct(product, quantity, session, startingBalance, status, buyButton, input, balanceDisplay, modal) {
    var completed = 0;
    var pendingBalance = false;
    var stopReason = '';
    var receipts = [];
    var currentBalance;
    try { currentBalance = await getBalance(session); } catch (e) { currentBalance = { ok: false }; }
    if (!currentBalance.ok || currentBalance.data.appUserId !== startingBalance.appUserId) {
      input.disabled = false;
      buyButton.disabled = false;
      setModalBusy(false);
      status.className = 'ezik-iap-error ezik-iap-status';
      status.textContent = 'تعذّر تحديث الرصيد الآن. حاول مرة أخرى.';
      return;
    }
    var baseline = currentBalance.data;
    for (var i = 0; i < quantity; i += 1) {
      status.className = 'ezik-iap-note ezik-iap-status';
      status.textContent = (receipts.length ? receipts.join('\n') + '\n' : '')
        + 'جارٍ فتح شاشة المتجر (' + arabicDigits(i + 1) + ' من ' + arabicDigits(quantity) + ')…';
      try {
        var result = await requestShell('iap.buy', { productId: product.id }, 5 * 60 * 1000);
        if (result.status === 'cancelled') { stopReason = 'cancelled'; break; }
        if (result.status !== 'purchased' || result.productId !== product.id) { stopReason = 'error'; break; }
        completed += 1;
        modal.purchaseCompleted = true;
        modal.purchaseSession = session;
        receipts.push(product.id === 'ezik_games_3'
          ? 'تم الشراء ✓ — أُضيف ' + arabicDigits(3) + ' جلسات'
          : 'تم الشراء ✓ — فُعّل الاشتراك');
        status.textContent = receipts.join('\n') + '\nتمت ' + arabicDigits(completed) + ' من ' + arabicDigits(quantity) + ' — جارٍ تحديث الرصيد…';
        var changed = typeof window.ezikIapPollPending === 'function'
          ? await window.ezikIapPollPending(session, balanceSnapshot(baseline), startingBalance.appUserId)
          : false;
        pendingBalance = !changed;
        if (changed) {
          var refreshed = await getBalance(session);
          if (refreshed.ok && refreshed.data.appUserId === startingBalance.appUserId) {
            baseline = refreshed.data;
            updateBalanceLine(balanceDisplay, refreshed.data);
          }
        }
      } catch (e) {
        stopReason = 'error';
        break;
      }
    }

    input.disabled = false;
    buyButton.disabled = false;
    setModalBusy(false);
    var message = receipts.join('\n');
    if (completed > 1) message += '\nتمت ' + arabicDigits(completed) + ' من ' + arabicDigits(quantity) + '.';
    if (stopReason === 'cancelled') message += (message ? '\n' : '') + 'أُلغي الطلب المتبقي.';
    else if (stopReason === 'error') message += (message ? '\n' : '') + 'تعذّر إكمال الطلب المتبقي.';
    if (completed > 0 && pendingBalance) message += (message ? '\n' : '') + 'تم استلام الدفع، سيظهر الرصيد خلال لحظات.';
    status.className = stopReason === 'error' ? 'ezik-iap-error ezik-iap-status' : 'ezik-iap-note ezik-iap-status';
    status.textContent = message;

    if (completed > 0 && pendingBalance && active === modal) {
      var polling = false;
      var poller = setInterval(async function () {
        if (active !== modal || polling) return;
        polling = true;
        try {
          var refreshed = await getBalance(session);
          if (active !== modal || !refreshed.ok || refreshed.data.appUserId !== startingBalance.appUserId) return;
          updateBalanceLine(balanceDisplay, refreshed.data);
          if (JSON.stringify(balanceSnapshot(refreshed.data)) !== JSON.stringify(balanceSnapshot(baseline))) {
            baseline = refreshed.data;
            status.textContent = receipts.join('\n') + '\nتم تحديث الرصيد.';
            clearInterval(poller);
            finishPurchaseReturn();
          }
        } catch (e) {} finally { polling = false; }
      }, 5000);
      var previousCleanup = panelRefreshCleanup;
      panelRefreshCleanup = function () {
        clearInterval(poller);
        if (previousCleanup) previousCleanup();
      };
    } else if (completed > 0) finishPurchaseReturn();
  }

  async function beginStart(start, roomCode, gameId, options) {
    options = options && typeof options === 'object' ? options : {};
    var context = startContext = {
      start: start,
      roomCode: roomCode || 'room',
      roomInstanceId: typeof options.roomInstanceId === 'string' ? options.roomInstanceId : '',
      gameId: typeof gameId === 'string' && gameId ? gameId : 'hanna',
      waitForStart: typeof options.waitForStart === 'function' ? options.waitForStart : null,
      cycle: options.cycle,
      online: options.online || null,
    };
    if (context.online) {
      try {
        if (await context.online.modeForStart() === 'ACCOUNT') { await startWithoutIap(context); return; }
      } catch (_) { return; }
    }
    window.__ezikIapStartGame = start;
    window.__ezikIapRoomCode = roomCode;
    var enforcement;
    try { enforcement = await getEnforcementState(); }
    catch (e) { enforcement = { mode: 'all', signin: 'none' }; }
    var mode = enforcement.mode;
    if (mode === 'free') {
      if (!['all', 'host'].includes(enforcement.signin)) {
        stopSignInWatch();
        await startWithoutIap(context);
        return;
      }
      var freeSession = authSession();
      var resumeFreeStart = function () { return beginStart(start, roomCode, gameId, options); };
      if (!freeSession) { showSignIn(resumeFreeStart, { signinRule: true }); return; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await startWithoutIap(context);
        return;
      }
      var freeBalance;
      try { freeBalance = await getBalance(freeSession); } catch (e) { freeBalance = { ok: false, status: 503, data: {} }; }
      if (!freeBalance.ok && freeBalance.status === 401) {
        showSignIn(resumeFreeStart, { signinRule: true });
        return;
      }
      await startWithoutIap(context);
      return;
    }
    if (mode === 'off' || mode === 'test' && !authSession()) {
      stopSignInWatch();
      await startWithoutIap(context);
      return;
    }
    var session = authSession();
    if (!session) {
      showSignIn(function () { return beginStart(start, roomCode, gameId, options); });
      return;
    }
    var response = await entitlementBalance(session);
    if (!response.ok) {
      if (response.status === 401) { showSignIn(function () { return beginStart(start, roomCode, gameId, options); }); return; }
      showFailure('تعذّر التحقق من رصيد الحساب الآن. حاول مرة أخرى.');
      return;
    }
    var balance = response.data;
    if (balance.enforced !== true) { await startWithoutIap(context); return; }
    if (hasFreeEntitlement(balance)) { await startWithIntent(context, 'automatic'); return; }
    if (Number(balance.credits) > 0) {
      var modal = openModal('تأكيد بدء الجلسة', 'سيُخصم من رصيدك جلسة واحدة (رصيدك ' + arabicDigits(balance.credits) + ')');
      modal.content.append(button('ابدأ', function () { startWithIntent(context, 'automatic'); }));
      modal.content.append(button('إلغاء', closeModal, true));
      return;
    }
    showExpired(context.gameId, window.location.pathname + window.location.search + window.location.hash, balance);
  }

  function isIosWebViewWithMessaging() {
    var bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== 'function') return false;
    var ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    var isIosUa = /iPhone|iPad|iPod/i.test(ua);
    var isIpadOs = typeof navigator !== 'undefined'
      && navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints) > 1;
    return isIosUa || isIpadOs;
  }

  async function hasNativeIosPurchaseBridge() {
    if (!isIosWebViewWithMessaging()) return false;
    try {
      await requestShell('iap.prices', { productIds: ['ezik_pass_week_1', 'ezik_pass_month_1', 'ezik_pass_year_1'] }, 8000);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function hasNativePurchaseBridge() {
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return false;
    try {
      await requestShell('iap.prices', { productIds: ['ezik_pass_week_1', 'ezik_pass_month_1', 'ezik_pass_year_1'] }, 8000);
      return true;
    } catch (e) {
      return false;
    }
  }

  function waitForHomeSignIn(onUpdate, notice) {
    onUpdate(notice, false);
    if (homeSignInCleanup) homeSignInCleanup();
    var done = false;
    var resume = function () {
      if (done || !authSession()) return;
      done = true;
      if (homeSignInCleanup) homeSignInCleanup();
      window.ezikIapEnterHome(onUpdate).catch(function () {});
    };
    var onStorage = function (event) { if (!event || event.key === SESSION_KEY) resume(); };
    var onFocus = function () { resume(); };
    var onVisibility = function () { if (document.visibilityState === 'visible') resume(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    homeSignInCleanup = function () {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      homeSignInCleanup = null;
    };
  }

  async function enterKunuzHome(onUpdate) {
    if (typeof onUpdate !== 'function') return;
    var enforcement = null;
    try { enforcement = await getEnforcementState(); } catch (e) {}
    if (!enforcement) enforcement = typeof readVerifiedMode === 'function' ? readVerifiedMode() : null;
    var mode = enforcement ? enforcement.mode : '';
    if (mode === 'free') {
      var freeSession = authSession();
      if (!freeSession) {
        if (enforcement && ['all', 'host'].includes(enforcement.signin)) waitForHomeSignIn(onUpdate, { kind: 'signin-required' });
        else onUpdate(null, false);
        return;
      }
      onUpdate(null, false);
      if (!await hasNativePurchaseBridge()) return;
      var freeBalance;
      try { freeBalance = await getBalance(freeSession); } catch (e) { freeBalance = { ok: false }; }
      if (freeBalance.ok && freeBalance.data && typeof freeBalance.data.purchaseEntry === 'boolean') {
        rememberEntryDecision(freeSession, freeBalance.data);
        onUpdate(null, freeBalance.data.purchaseEntry === true);
      } else {
        onUpdate(null, lastEntryDecisionForSession(freeSession) === true);
      }
      return;
    }
    if (authSession() && (mode === 'all'
      ? await hasNativePurchaseBridge()
      : await hasNativeIosPurchaseBridge())) {
      onUpdate(null, true);
      return;
    }
    if (!mode) { onUpdate(null, false); return; }
    if (!['off', 'test', 'all'].includes(mode)) { onUpdate(null, false); return; }
    if (mode === 'off') { onUpdate(null, false); return; }
    var session = authSession();
    if (!session) {
      if (mode !== 'all') { onUpdate(null, false); return; }
      waitForHomeSignIn(onUpdate, { kind: 'sign-in' });
      return;
    }
    var purchasesApplicable = false;
    onUpdate(null, false);
    var response;
    try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
    if (!response.ok) {
      if (response.status === 401) onUpdate({ kind: 'sign-in' }, purchasesApplicable);
      else if (!purchasesApplicable) onUpdate(null, false);
      return;
    }
    if (response.data.enforced !== true) { onUpdate(null, purchasesApplicable); return; }
    var expiresAt = Number(response.data.subscriptionExpiresAt);
    var activePass = response.data.subscriptionActive === true
      || Number.isFinite(expiresAt) && expiresAt > Date.now();
    if (activePass) { onUpdate(null, false); return; }
    var expiredPass = Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now();
    if (!response.data.trial && expiredPass) {
      onUpdate({ kind: 'pass-expired' }, false);
      return;
    }
    if (!response.data.trial) {
      onUpdate({ kind: 'trial', trial: { active: true, daysLeft: 7 }, starting: true }, false);
      var started = await requestTrialStart(session);
      if (!started.ok || started.data.enforced !== true) { onUpdate(null, purchasesApplicable); return; }
      try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
      if (!response.ok || response.data.enforced !== true) { onUpdate(null, purchasesApplicable); return; }
    }
    expiresAt = Number(response.data.subscriptionExpiresAt);
    activePass = response.data.subscriptionActive === true
      || Number.isFinite(expiresAt) && expiresAt > Date.now();
    if (activePass) { onUpdate(null, false); return; }
    expiredPass = Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now();
    if (expiredPass && response.data.trial && response.data.trial.active === false) {
      onUpdate({ kind: 'pass-expired' }, false);
      return;
    }
    onUpdate({ kind: 'trial', trial: response.data.trial, starting: false }, purchasesApplicable);
  }

  window.ezikIapEnterHome = function (onUpdate) {
    homeNoticeUpdater = typeof onUpdate === 'function' ? onUpdate : null;
    homeNoticeSession = authSession();
    homeEntryPromise = enterKunuzHome(onUpdate);
    return homeEntryPromise;
  };
  window.ezikIapOpenPurchase = function () {
    if (active) return;
    initializePurchase().catch(function () { showFailure('تعذّر فتح خيارات الشراء الآن. حاول مرة أخرى.'); });
  };
  window.ezikIapCheckGameAccess = checkGameAccess;
  window.ezikIapCheckHostAccess = checkHostAccess;

  function pageGameId(pathname) {
    if (pathname === '/quest-ghaws.html') return 'ghaws';
    if (pathname === '/quest-harb.html') return 'harb';
    if (pathname === '/quest-test.html') return 'test';
    if (pathname === '/quest-board.html') return 'board';
    if (pathname === '/hanna-laha' || pathname.indexOf('/hanna-laha/') === 0) return 'hanna';
    return '';
  }

  function lockEntryPage(locked) {
    if (!document.body) return;
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node.classList && node.classList.contains('ezik-iap-backdrop')) return;
      if (locked) {
        if (!Object.prototype.hasOwnProperty.call(node, '__ezikIapPreviousInert')) {
          node.__ezikIapPreviousInert = node.inert === true;
        }
        node.inert = true;
      } else if (Object.prototype.hasOwnProperty.call(node, '__ezikIapPreviousInert')) {
        node.inert = node.__ezikIapPreviousInert;
        delete node.__ezikIapPreviousInert;
      }
    });
  }

  function installEntryGuard() {
    if (!window.location || !window.location.pathname) return;
    var home = window.location.pathname === '/quest.html';
    var gameId = pageGameId(window.location.pathname);
    if (home) {
      var destinations = {
        '/quest-ghaws.html': 'ghaws', '/quest-harb.html': 'harb',
        '/quest-test.html': 'test', '/quest-board.html': 'board', '/hanna-laha/': 'hanna',
      };
      document.addEventListener('click', function (event) {
        var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        var href = anchor && anchor.getAttribute('href');
        var targetGame = href && destinations[href];
        if (!targetGame) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        checkGameAccess(targetGame, function () { window.location.href = href; }, href);
      }, true);
      return;
    }
    if (!gameId) return;
    var search = window.location.search || '';
    var isHannaJoin = gameId === 'hanna' && /^\/hanna-laha\/(?:join|j\/\d{4,6})\/?$/.test(window.location.pathname);
    var isBoardJoin = gameId === 'board' && /(?:^|[?&])board=\d{4,6}(?:&|$)/.test(search);
    var joinOnly = ['harb', 'board', 'hanna'].includes(gameId) && /(?:^|[?&])iap_join=1(?:&|$)/.test(search);
    if (isHannaJoin || isBoardJoin || joinOnly) {
      lockEntryPage(true);
      var joinReturnPath = window.location.pathname + search + (window.location.hash || '');
      window.ezikIapPageGate = checkGameAccess(gameId, function () { lockEntryPage(false); }, joinReturnPath, {
        joiner: true,
        lockedPage: true,
      }).then(function (allowed) {
        if (allowed === true) lockEntryPage(false);
        return allowed === true;
      });
      return;
    }
    lockEntryPage(true);
    var returnPath = window.location.pathname + search + (window.location.hash || '');
    var accessOptions = { lockedPage: true };
    var settled = false, initialAllowed = null;
    var pageGateDeferred = false, pageGatePassed = false, resolvePageGate = null;
    var allowPage = function () {
      lockEntryPage(false);
      if (pageGateDeferred) {
        pageGatePassed = true;
        if (resolvePageGate) resolvePageGate(true);
      } else if (settled && initialAllowed === false && window.location.reload) {
        window.location.reload();
      }
    };
    window.ezikIapPageGate = checkGameAccess(gameId, allowPage, returnPath, accessOptions).then(function (allowed) {
      settled = true;
      initialAllowed = allowed === true;
      if (allowed === true) { lockEntryPage(false); return true; }
      if (!accessOptions.waitingForSignIn) return false;
      pageGateDeferred = true;
      return new Promise(function (resolve) {
        resolvePageGate = resolve;
        if (pageGatePassed) resolve(true);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEntryGuard, { once: true });
  else installEntryGuard();

  window.ezikOnlineRefreshAccount = function () {
    cachedEnforcementAt = 0;
    var session = authSession();
    if (session) getBalance(session).catch(function () {});
  };
  window.ezikOnlineRecovery = function (options) {
    var mismatch = options.reason === 'generation-changed';
    var modal = openModal('استعادة الغرفة', mismatch
      ? 'تغيّر خادم اللعبة. حُفظت حالة غرفتك. يمكنك إعادة الاتصال أو فتح غرفة جديدة.'
      : 'تعذّر تأكيد حالة الغرفة. حُفظت حالتك؛ أعد الاتصال للتحقق قبل بدء جولة.');
    if (typeof options.retry === 'function') modal.content.append(button('إعادة الاتصال', function () { closeModal(); options.retry(); }));
    if (mismatch && typeof options.newRoom === 'function') modal.content.append(button('غرفة جديدة', function () { closeModal(); options.newRoom(); }, true));
    modal.content.append(button('البقاء هنا', closeModal, true));
  };
  window.ezikIapStart = function (start, roomCode, gameId, options) {
    if (typeof start !== 'function') return;
    if (active) return;
    beginStart(start, roomCode, gameId, options).catch(function () {
      showFailure('تعذّر إكمال العملية الآن. حاول مرة أخرى.');
    });
  };
})();
