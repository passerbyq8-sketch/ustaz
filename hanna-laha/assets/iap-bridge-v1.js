(function () {
  'use strict';

  var SESSION_KEY = 'ezik_auth_session_v1';
  var DEVICE_KEY = 'mrb_device_v1';
  var APP_STORE_URL = 'https://apps.apple.com/app/id6797100518';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.almurabbi.tutor';
  var PRODUCT_ROWS = [
    { kind: 'games', id: 'ezik_games_3', name: 'ثلاث جلسات لعب' },
    { kind: 'month', id: 'ezik_pass_month_1', fallbackId: 'ezik_month_1', name: 'شهر لعب غير محدود' },
    { kind: 'year', id: 'ezik_pass_year_1', fallbackId: 'ezik_year_1', name: 'سنة لعب غير محدودة' },
  ];
  var active = null;
  var startContext = null;
  var sessionIdMemory = Object.create(null);
  var pendingSignIn = false;
  var pendingSignInAction = null;
  var resumingSignIn = false;
  var panelRefreshCleanup = null;
  var homeSignInCleanup = null;
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
      if (options.closeButton !== false && event.target === backdrop && (!active || active.busy !== true)) closeModal();
    });
    document.body.append(backdrop);
    active = { backdrop: backdrop, card: card, paragraph: paragraph, content: content, closeButton: close, busy: false };
    if (close) close.focus();
    else { card.tabIndex = -1; card.focus(); }
    return active;
  }

  function closeModal() {
    if (panelRefreshCleanup) {
      panelRefreshCleanup();
      panelRefreshCleanup = null;
    }
    if (active && active.backdrop && active.backdrop.parentNode) active.backdrop.parentNode.removeChild(active.backdrop);
    active = null;
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

  function showSignIn(resumeAction) {
    pendingSignInAction = typeof resumeAction === 'function' ? resumeAction : null;
    var modal = openModal('تسجيل الدخول', 'يلزم تسجيل الدخول إلى حساب عزك قبل بدء الجلسة أو الشراء.');
    line(modal.content, 'سجّل الدخول إلى حساب عزك، ثم ارجع إلى هذه الغرفة للمتابعة.');
    var signIn = document.createElement('a');
    signIn.className = 'ezik-iap-button';
    signIn.href = '/?ezik_iap_signin=1';
    signIn.target = '_blank';
    signIn.rel = 'noopener noreferrer';
    signIn.textContent = 'تسجيل الدخول';
    modal.content.append(signIn);
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
  var cachedEnforcementAt = 0;
  var VERIFIED_MODE_KEY = 'ezik_iap_verified_mode_v1';

  async function getEnforcementMode() {
    // Cache only the public server mode, never account balances or entitlements.
    // Every online visit still uses the existing server check and memory TTL.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        var verified = JSON.parse(localStorage.getItem(VERIFIED_MODE_KEY) || 'null');
        if (verified && verified.schema === 1 && ['off', 'test', 'all'].includes(verified.mode) && Number.isFinite(verified.verifiedAt) && verified.verifiedAt > 0) return verified.mode;
      } catch (e) {}
      throw new Error('iap-status-unavailable');
    }
    if (cachedEnforcementMode && Date.now() - cachedEnforcementAt < 30000) {
      return cachedEnforcementMode;
    }
    var response = await fetch('../api/iap-status', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'default',
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !['off', 'test', 'all'].includes(data.mode)) {
      throw new Error('iap-status-unavailable');
    }
    cachedEnforcementMode = data.mode;
    cachedEnforcementAt = Date.now();
    try { localStorage.setItem(VERIFIED_MODE_KEY, JSON.stringify({ schema: 1, mode: data.mode, verifiedAt: cachedEnforcementAt })); } catch (e) {}
    return data.mode;
  }

  async function startWithoutIap(context) {
    if (!context || typeof context.start !== 'function') return false;
    try {
      await Promise.resolve(context.start());
      closeModal();
      return true;
    } catch (e) {
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
    return { ok: true, data: data };
  }

  function arabicDigits(value) {
    return String(value).replace(/[0-9]/g, function (digit) { return '٠١٢٣٤٥٦٧٨٩'[Number(digit)]; });
  }

  function balanceText(balance) {
    var text = 'رصيدك: ' + arabicDigits(Number(balance && balance.credits) || 0) + ' جلسة';
    var expiresAt = Number(balance && balance.subscriptionExpiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      var date = new Date(expiresAt).toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
      text += ' · اشتراك حتى ' + date;
    }
    return text;
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

  function showExpired(gameId, returnPath) {
    var modal = openModal('الدخول إلى اللعبة', 'انتهت تجربتك المجانية — الرجاء الشراء للدخول.', { closeButton: false });
    modal.content.append(button('اشتر لعبة', function () { navigateToMainPurchase(returnPath); }));
    if (gameId === 'harb' || gameId === 'board' || gameId === 'hanna') {
      modal.content.append(button('انضم لغرفة برمز', function () { navigateJoinByCode(gameId); }, true));
    }
  }

  function showTrialDisclosure(gameId, session, returnPath, onAllowed) {
    var copy = 'ألعاب كنوز المعرفة مجانية لك لمدة ٧ أيام. ما زلنا نحسّن الألعاب. بعد الأسبوع، يلزم شراء رصيد جلسات أو اشتراك لدخول أي لعبة. الأسعار تحت زر «اشتر لعبة».';
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
      } else showExpired(gameId, returnPath);
    }));
  }

  async function checkGameAccess(gameId, onAllowed, returnPath) {
    async function continueIfAllowed() {
      if (typeof onAllowed === 'function') await Promise.resolve(onAllowed());
      return true;
    }
    if (!['ghaws', 'harb', 'test', 'board', 'hanna'].includes(gameId)) return false;
    if (active) return false;
    var mode;
    try { mode = await getEnforcementMode(); } catch (e) { mode = 'all'; }
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
        showTrialDisclosure(gameId, session, returnPath, onAllowed);
        return false;
      }
    }
    if (hasEntitlement(response.data)) return continueIfAllowed();
    showExpired(gameId, returnPath);
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
        closeModal();
        return false;
      }
      if (startSignal) await startSignal;
    } catch (e) {
      if (waiting && typeof waiting.cancel === 'function') waiting.cancel();
      context.inFlight = false;
      showFailure('لم تبدأ الجولة بعد؛ لم يُخصم أي رصيد. حاول مرة أخرى.');
      return false;
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
    var session = authSession();
    if (!session) { showSignIn(initializePurchase); return; }
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
      showWebBuyPanel();
      return;
    }

    var modal = openModal('خيارات الشراء', 'الحساب: ' + accountLabel() + '. الأسعار المعروضة من المتجر، ويُفتح تأكيد الدفع لكل عملية شراء.');
    line(modal.content, 'جارٍ تحميل الحساب والأسعار…', 'ezik-iap-status');
    var currentBalance = await getBalance(session);
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
      var response = await requestShell('iap.prices', {}, 15000);
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
      var productId = Object.prototype.hasOwnProperty.call(prices, product.id)
        ? product.id : product.fallbackId || product.id;
      var selectedProduct = Object.assign({}, product, { id: productId });
      var price = prices[productId];
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
    startContext = {
      start: start,
      roomCode: roomCode || 'room',
      roomInstanceId: typeof options.roomInstanceId === 'string' ? options.roomInstanceId : '',
      gameId: typeof gameId === 'string' && gameId ? gameId : 'hanna',
      waitForStart: typeof options.waitForStart === 'function' ? options.waitForStart : null,
      cycle: options.cycle,
    };
    window.__ezikIapStartGame = start;
    window.__ezikIapRoomCode = roomCode;
    var mode;
    try { mode = await getEnforcementMode(); }
    catch (e) { mode = 'all'; }
    if (mode === 'off' || mode === 'test' && !authSession()) {
      stopSignInWatch();
      await startWithoutIap(startContext);
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
    if (balance.enforced !== true) { await startWithoutIap(startContext); return; }
    if (hasFreeEntitlement(balance)) { await startWithIntent(startContext, 'automatic'); return; }
    if (Number(balance.credits) > 0) {
      var modal = openModal('تأكيد بدء الجلسة', 'سيُخصم من رصيدك جلسة واحدة (رصيدك ' + arabicDigits(balance.credits) + ')');
      modal.content.append(button('ابدأ', function () { startWithIntent(startContext, 'automatic'); }));
      modal.content.append(button('إلغاء', closeModal, true));
      return;
    }
    showExpired(startContext.gameId, window.location.pathname + window.location.search + window.location.hash);
  }

  async function enterKunuzHome(onUpdate) {
    if (typeof onUpdate !== 'function') return;
    var mode;
    try { mode = await getEnforcementMode(); } catch (e) { return; }
    if (mode === 'off') { onUpdate(null); return; }
    var session = authSession();
    if (!session) {
      if (mode !== 'all') { onUpdate(null); return; }
      onUpdate({ kind: 'sign-in' });
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
      return;
    }
    var response;
    try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
    if (!response.ok) {
      if (response.status === 401) onUpdate({ kind: 'sign-in' });
      return;
    }
    if (response.data.enforced !== true) { onUpdate(null); return; }
    if (!response.data.trial) {
      onUpdate({ kind: 'trial', trial: { active: true, daysLeft: 7 }, starting: true });
      var started = await requestTrialStart(session);
      if (!started.ok || started.data.enforced !== true) { onUpdate(null); return; }
      try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
      if (!response.ok || response.data.enforced !== true) { onUpdate(null); return; }
    }
    onUpdate({ kind: 'trial', trial: response.data.trial, starting: false });
  }

  window.ezikIapEnterHome = function (onUpdate) {
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
      window.ezikIapPageGate = Promise.resolve(true);
      return;
    }
    lockEntryPage(true);
    var settled = false, initialAllowed = null;
    var returnPath = window.location.pathname + search + (window.location.hash || '');
    window.ezikIapPageGate = checkGameAccess(gameId, function () {
      if (settled && initialAllowed === false && window.location.reload) window.location.reload();
    }, returnPath).then(function (allowed) {
      settled = true;
      initialAllowed = allowed === true;
      if (allowed === true) lockEntryPage(false);
      return allowed === true;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEntryGuard, { once: true });
  else installEntryGuard();

  window.ezikIapStart = function (start, roomCode, gameId, options) {
    if (typeof start !== 'function') return;
    if (active) return;
    beginStart(start, roomCode, gameId, options).catch(function () {
      showFailure('تعذّر إكمال العملية الآن. حاول مرة أخرى.');
    });
  };
})();
