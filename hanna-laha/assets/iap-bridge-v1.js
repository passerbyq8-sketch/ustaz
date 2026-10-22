(function () {
  'use strict';

  var SESSION_KEY = 'ezik_auth_session_v1';
  var DEVICE_KEY = 'mrb_device_v1';
  var LEGACY_PIN_KEY = 'parent_pin_hash';
  var PRODUCT_ROWS = [
    { id: 'ezik_games_3', name: 'ثلاث جلسات لعب' },
    { id: 'ezik_month_1', name: 'شهر لعب غير محدود' },
    { id: 'ezik_year_1', name: 'سنة لعب غير محدودة' },
  ];
  var active = null;
  var startContext = null;

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

  function legacyPinHash() {
    try {
      var value = localStorage.getItem(LEGACY_PIN_KEY) || '';
      return /^[0-9a-f]{64}$/.test(value) ? value : '';
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

  function openModal(title, copy) {
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
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ezik-iap-button ezik-iap-button-secondary';
    close.textContent = 'إغلاق';
    close.addEventListener('click', closeModal);
    header.append(heading, close);
    var paragraph = document.createElement('p');
    paragraph.className = 'ezik-iap-copy';
    paragraph.textContent = copy || '';
    var content = document.createElement('div');
    content.className = 'ezik-iap-content';
    card.append(header, paragraph, content);
    backdrop.append(card);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop && (!active || active.busy !== true)) closeModal();
    });
    document.body.append(backdrop);
    active = { backdrop: backdrop, card: card, paragraph: paragraph, content: content, closeButton: close, busy: false };
    close.focus();
    return active;
  }

  function closeModal() {
    if (active && active.backdrop && active.backdrop.parentNode) active.backdrop.parentNode.removeChild(active.backdrop);
    active = null;
  }

  function setModalBusy(value) {
    if (!active) return;
    active.busy = value === true;
    active.closeButton.disabled = active.busy;
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

  async function postParent(action, fields) {
    var id = deviceId();
    if (!id) throw new Error('parent-device-unavailable');
    return fetch('../api/parent-code', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action, deviceId: id }, fields || {})),
    });
  }

  function showSignIn() {
    var modal = openModal('تسجيل الدخول', 'يلزم تسجيل الدخول إلى حساب عزك قبل بدء الجلسة أو الشراء.');
    line(modal.content, 'افتح التطبيق وسجّل الدخول من الإعدادات، ثم عُد إلى الغرفة.');
    modal.content.append(button('فتح التطبيق', function () { window.location.assign('/'); }));
  }

  function showFailure(message) {
    var modal = openModal('تعذّر إكمال العملية', message || 'تعذّر الاتصال بالخادم الآن. حاول مرة أخرى.');
    modal.content.append(button('حسنًا', closeModal, true));
  }

  function showArithmeticGate(startPurchase) {
    var a = 2 + Math.floor(Math.random() * 8);
    var b = 2 + Math.floor(Math.random() * 8);
    var modal = openModal('تأكيد وليّ الأمر', 'أجب عن المسألة للمتابعة إلى شاشة الدفع.');
    var form = document.createElement('form');
    var label = document.createElement('label');
    label.className = 'ezik-iap-field';
    label.textContent = String(a) + ' + ' + String(b);
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.required = true;
    input.setAttribute('aria-label', 'الإجابة');
    label.append(input);
    var error = line(modal.content, '', 'ezik-iap-error');
    var submit = button('متابعة', function () {}, false);
    submit.type = 'submit';
    form.append(label, submit);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (Number(input.value) !== a + b) {
        error.textContent = 'الإجابة غير صحيحة. حاول مرة أخرى.';
        input.value = '';
        input.focus();
        return;
      }
      startPurchase();
    });
    modal.content.append(form);
    input.focus();
  }

  function showParentPinGate(startPurchase, needsLegacy) {
    var modal = openModal('تأكيد وليّ الأمر', 'أدخل رمز وليّ الأمر قبل عرض خيارات الدفع.');
    var form = document.createElement('form');
    var label = document.createElement('label');
    label.className = 'ezik-iap-field';
    label.textContent = 'رمز وليّ الأمر';
    var input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.required = true;
    label.append(input);
    var error = line(modal.content, '', 'ezik-iap-error');
    var submit = button('متابعة', function () {}, false);
    submit.type = 'submit';
    form.append(label, submit);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!/^[0-9]{4,64}$/.test(input.value)) {
        error.textContent = 'أدخل الرمز الذي يتكوّن من أربعة أرقام على الأقل.';
        return;
      }
      submit.disabled = true;
      try {
        var fields = { pin: input.value };
        var legacy = needsLegacy ? legacyPinHash() : '';
        if (legacy) fields.legacyHash = legacy;
        var response = await postParent('verify', fields);
        var data = await response.json().catch(function () { return {}; });
        if (response.ok && data.ok === true) {
          if (legacy) { try { localStorage.removeItem(LEGACY_PIN_KEY); } catch (e) {} }
          startPurchase();
          return;
        }
        error.textContent = data.message || 'رمز وليّ الأمر غير صحيح.';
      } catch (e) {
        error.textContent = 'تعذّر التحقق الآن. حاول مرة أخرى.';
      }
      submit.disabled = false;
      input.value = '';
      input.focus();
    });
    modal.content.append(form);
    input.focus();
  }

  async function guardianGate(startPurchase) {
    try {
      var response = await postParent('status');
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || typeof data.hasCode !== 'boolean') {
        showFailure(data.message || 'تعذّر التحقق من قفل وليّ الأمر.');
        return;
      }
      var legacy = !data.hasCode && !!legacyPinHash();
      if (data.hasCode || legacy) showParentPinGate(startPurchase, legacy);
      else showArithmeticGate(startPurchase);
    } catch (e) {
      showFailure('تعذّر التحقق من قفل وليّ الأمر.');
    }
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

  function freeBalance(balance, gameId) {
    var remaining = balance.freeRemainingByGame && Number(balance.freeRemainingByGame[gameId]);
    var total = balance.freeTotalPerGame && Number(balance.freeTotalPerGame[gameId]);
    if (Number.isSafeInteger(remaining) && remaining >= 0) return { remaining: remaining, total: Number.isSafeInteger(total) ? total : remaining };
    var used = balance.freeUsedByGame && Number(balance.freeUsedByGame[gameId]);
    if (Number.isSafeInteger(total) && total >= 0 && Number.isSafeInteger(used)) {
      return { remaining: Math.max(0, total - used), total: total };
    }
    return { remaining: 0, total: 0 };
  }

  function choiceButton(title, detail, onClick, secondary, disabled) {
    var node = document.createElement('button');
    node.type = 'button';
    node.className = 'ezik-iap-button ezik-iap-choice' + (secondary ? ' ezik-iap-button-secondary' : '');
    node.disabled = disabled === true;
    var heading = document.createElement('span');
    heading.className = 'ezik-iap-choice-title';
    heading.textContent = title;
    node.append(heading);
    if (detail) {
      var note = document.createElement('small');
      note.className = 'ezik-iap-choice-detail';
      note.textContent = detail;
      node.append(note);
    }
    node.addEventListener('click', onClick);
    return node;
  }

  async function openStartChoice(context) {
    var session = authSession();
    if (!session) { showSignIn(); return; }
    var modal = openModal('بدء جلسة اللعب', 'جارٍ تحميل رصيد الحساب…');
    var response;
    try { response = await getBalance(session); } catch (e) { response = { ok: false }; }
    if (active !== modal) return;
    if (!response.ok) {
      if (response.status === 401) { showSignIn(); return; }
      showFailure('تعذّر تحميل الرصيد الآن. حاولوا مرة أخرى.');
      return;
    }

    var balance = response.data;
    if (Number(balance.subscriptionExpiresAt) > Date.now()) {
      await startWithIntent(context, 'automatic');
      return;
    }

    modal.paragraph.textContent = 'اختاروا طريقة بدء الجلسة.';
    modal.content.replaceChildren();
    var choices = document.createElement('div');
    choices.className = 'ezik-iap-choice-grid';
    var free = freeBalance(balance, context.gameId);
    var remaining = free.remaining;
    var total = free.total;
    var hasCredits = Number(balance.credits) > 0;
    var primaryTitle = remaining > 0 ? 'لعب مجاني' : hasCredits ? 'ابدأ (يُخصم رصيد)' : 'لعب مجاني';
    var primaryDetail = remaining > 0 || !hasCredits
      ? 'متبقّي ' + arabicDigits(remaining) + ' من ' + arabicDigits(total)
      : '';
    choices.append(choiceButton(primaryTitle, primaryDetail, function () {
      startWithIntent(context, remaining > 0 ? 'free' : 'credit');
    }, false, remaining === 0 && !hasCredits));
    choices.append(choiceButton('اشتري الآن', '', initializePurchase, true, false));
    modal.content.append(choices);
  }

  async function startWithIntent(context, intent) {
    if (!context || typeof context.start !== 'function') return;
    var request = roomSessionId(context.roomCode, context.gameId);
    await consumeAndStart(context.start, context.roomCode, request, context.gameId, intent);
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
    if (!session) { showSignIn(); return; }
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
      var unavailable = openModal('الشراء داخل التطبيق', 'الشراء غير متاح في هذا المتصفح. افتح الغرفة من تطبيق عزك.');
      unavailable.content.append(button('إغلاق', closeModal, true));
      return;
    }

    var modal = openModal('خيارات الشراء', 'الأسعار المعروضة من المتجر، ويُفتح تأكيد الدفع لكل عملية شراء.');
    line(modal.content, 'جارٍ تحميل الحساب والأسعار…', 'ezik-iap-status');
    var currentBalance = await getBalance(session);
    if (active !== modal) return;
    if (!currentBalance.ok) {
      if (currentBalance.status === 401) { showSignIn(); return; }
      showFailure('تعذّر تحميل الرصيد الآن. حاول مرة أخرى.');
      return;
    }

    try {
      var identified = await requestShell('iap.identify', { appUserId: currentBalance.data.appUserId }, 15000);
      if (active !== modal) return;
      if (identified.ok !== true) throw new Error('identify-failed');
      var response = await requestShell('iap.prices', {}, 15000);
      if (active !== modal) return;
      if (response.ok !== true || !response.prices) throw new Error('prices-unavailable');
      showProducts(session, currentBalance.data, response.prices);
    } catch (e) {
      var message = e.message === 'bridge-unavailable'
        ? 'الشراء غير متاح في هذا المتصفح. افتح الغرفة من تطبيق عزك.'
        : 'تعذّر تحميل أسعار المتجر. حاول مرة أخرى.';
      showFailure(message);
    }
  }

  function showProducts(session, startingBalance, prices) {
    var modal = openModal('خيارات الشراء', 'اختر عدد مرات الشراء من المتجر. الحد الأقصى لكل منتج خمس مرات.');
    modal.content.replaceChildren();
    PRODUCT_ROWS.forEach(function (product) {
      var price = prices[product.id];
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
        buyProduct(product, quantity, session, startingBalance, status, buy, input);
      });
      row.append(head, label, total, status, buy);
      modal.content.append(row);
    });
    modal.content.append(button('العودة لاختيار اللعب', function () {
      if (startContext) openStartChoice(startContext);
      else closeModal();
    }, true));
  }

  function roomSessionId(roomCode, gameId) {
    var safeRoomCode = String(roomCode || 'room').replace(/[^A-Za-z0-9_-]/g, '');
    var key = gameId === 'hanna'
      ? 'ezik_iap_host_session_v1_' + safeRoomCode
      : 'ezik_iap_host_session_v1_' + String(gameId) + '_' + safeRoomCode;
    try {
      var saved = sessionStorage.getItem(key);
      if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) return { key: key, id: saved };
      var fresh = requestId();
      sessionStorage.setItem(key, fresh);
      return { key: key, id: fresh };
    } catch (e) { return { key: '', id: requestId() }; }
  }

  async function consumeAndStart(start, roomCode, request, gameId, intent) {
    var session = authSession();
    if (!session) { showSignIn(); return false; }
    var response;
    try {
      response = await fetch('../api/iap-consume', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-ezik-session': session },
        body: JSON.stringify({ sessionId: request.id, gameId: gameId, intent: intent }),
      });
    } catch (e) {
      showFailure('تعذّر التحقق من الرصيد. لم نبدأ الجلسة؛ حاول مرة أخرى.');
      return false;
    }
    var data = await response.json().catch(function () { return {}; });
    if (response.status === 401) { showSignIn(); return false; }
    if ((response.status === 402 && data.error === 'iap-no-credit')
      || (response.status === 409 && data.error === 'iap-free-unavailable')) {
      if (startContext) await openStartChoice(startContext);
      return null;
    }
    if (!response.ok || data.ok !== true) {
      showFailure('تعذّر التحقق من الرصيد الآن. حاول مرة أخرى.');
      return false;
    }
    try {
      await Promise.resolve(start());
      try { if (request.key) window.sessionStorage.removeItem(request.key); } catch (e) {}
      closeModal();
      return true;
    } catch (e) {
      showFailure('تعذّر بدء الجلسة. أعد المحاولة؛ لن يُخصم الرصيد مرتين للجلسة نفسها.');
      return false;
    }
  }

  async function buyProduct(product, quantity, session, startingBalance, status, buyButton, input) {
    var completed = 0;
    var balanceChanged = false;
    var stopReason = '';
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
      status.textContent = 'جارٍ فتح شاشة المتجر (' + String(i + 1) + ' من ' + String(quantity) + ')…';
      try {
        var result = await requestShell('iap.buy', { productId: product.id }, 5 * 60 * 1000);
        if (result.status === 'cancelled') { stopReason = 'cancelled'; break; }
        if (result.status !== 'purchased' || result.productId !== product.id) { stopReason = 'error'; break; }
        completed += 1;
        status.textContent = 'تمت عملية الشراء. جارٍ انتظار تحديث الرصيد…';
        var changed = typeof window.ezikIapPollPending === 'function'
          ? await window.ezikIapPollPending(session, balanceSnapshot(baseline), startingBalance.appUserId)
          : false;
        if (changed) {
          balanceChanged = true;
          var refreshed = await getBalance(session);
          if (refreshed.ok && refreshed.data.appUserId === startingBalance.appUserId) baseline = refreshed.data;
        }
      } catch (e) {
        stopReason = 'error';
        break;
      }
    }

    input.disabled = false;
    buyButton.disabled = false;
    setModalBusy(false);
    var message = 'اكتمل شراء ' + String(completed) + ' من ' + String(quantity) + '.';
    if (stopReason === 'cancelled') message += ' أُلغي الطلب المتبقي.';
    else if (stopReason === 'error') message += ' تعذّر إكمال الطلب المتبقي.';
    if (completed > 0 && !balanceChanged) message += ' تم استلام الدفعة وسيظهر الرصيد قريبًا.';
    status.className = stopReason === 'error' ? 'ezik-iap-error ezik-iap-status' : 'ezik-iap-note ezik-iap-status';
    status.textContent = message;

    if (balanceChanged && startContext) await openStartChoice(startContext);
  }

  async function beginStart(start, roomCode, gameId) {
    if (!authSession()) { showSignIn(); return; }
    startContext = { start: start, roomCode: roomCode || 'room', gameId: typeof gameId === 'string' && gameId ? gameId : 'hanna' };
    window.__ezikIapStartGame = start;
    window.__ezikIapRoomCode = roomCode;
    await openStartChoice(startContext);
  }

  window.ezikIapStart = function (start, roomCode, gameId) {
    if (typeof start !== 'function') return;
    if (active) return;
    beginStart(start, roomCode, gameId).catch(function () {
      showFailure('تعذّر إكمال العملية الآن. حاول مرة أخرى.');
    });
  };
})();
