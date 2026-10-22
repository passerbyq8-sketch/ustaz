(function () {
  'use strict';

  var KEY = 'ezik_iap_pending_balance_v1';
  var HEADER = 'x-ezik-session';
  var STEPS = [0, 1000, 2000, 4000, 6000, 7000];

  function authSession() {
    try {
      var value = JSON.parse(localStorage.getItem('ezik_auth_session_v1') || 'null');
      return value && typeof value.session === 'string' ? value.session : '';
    } catch (e) { return ''; }
  }

  function snapshot(balance) {
    var used = balance && balance.freeUsedByGame && typeof balance.freeUsedByGame === 'object'
      ? balance.freeUsedByGame : {};
    return {
      credits: Number(balance && balance.credits) || 0,
      subscriptionExpiresAt: Number(balance && balance.subscriptionExpiresAt) || null,
      freeFirstUsed: !!(balance && balance.freeFirstUsed),
      freeUsedByGame: used,
    };
  }

  function changed(a, b) {
    return a.credits !== b.credits
      || a.subscriptionExpiresAt !== b.subscriptionExpiresAt
      || a.freeFirstUsed !== b.freeFirstUsed
      || JSON.stringify(a.freeUsedByGame) !== JSON.stringify(b.freeUsedByGame);
  }

  function readPending() {
    try {
      var value = JSON.parse(localStorage.getItem(KEY) || 'null');
      return value && typeof value.accountId === 'string' && value.baseline
        ? value : null;
    } catch (e) { return null; }
  }

  function writePending(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) {}
  }

  function clearPending(accountId, before) {
    var current = readPending();
    if (!current || current.accountId !== accountId) return;
    if (before && !changed(current.baseline, before)) {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  }

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  async function fetchBalance(session) {
    var response = await fetch('/api/iap-balance', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { [HEADER]: session },
    });
    if (!response.ok) return null;
    var data = await response.json().catch(function () { return null; });
    return data && typeof data.appUserId === 'string' ? data : null;
  }

  async function pollPending(session, before, accountId) {
    if (typeof session !== 'string' || !session || !before || typeof accountId !== 'string') return false;
    writePending({ accountId: accountId, baseline: snapshot(before), at: Date.now() });
    for (var i = 0; i < STEPS.length; i += 1) {
      if (STEPS[i]) await wait(STEPS[i]);
      try {
        var balance = await fetchBalance(session);
        if (balance && balance.appUserId === accountId && changed(snapshot(balance), snapshot(before))) {
          clearPending(accountId, snapshot(before));
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  window.ezikIapPollPending = pollPending;

  async function pollOnOpen() {
    var pending = readPending();
    var session = authSession();
    if (!pending || !session) return;
    await pollPending(session, pending.baseline, pending.accountId);
  }

  if (document.readyState === 'complete') pollOnOpen();
  else window.addEventListener('load', pollOnOpen, { once: true });
})();
