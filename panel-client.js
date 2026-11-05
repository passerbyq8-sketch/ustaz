(function (root) {
  'use strict';
  if (!root || !root.EzikPanelPolicy) return;
  var P = root.EzikPanelPolicy, current = P.defaults(), busy = false, last = 0;
  try { current = P.validate(JSON.parse(root.localStorage.getItem(P.cacheKey))) || current; } catch (_) {}
  function accept(raw) {
    var next = P.validate(raw);
    if (!next || next.revision < current.revision) return false;
    try { root.localStorage.setItem(P.cacheKey, JSON.stringify(next)); } catch (_) {}
    current = next;
    protectStandalone();
    try { root.dispatchEvent(new root.CustomEvent(P.event)); } catch (_) {}
    return true;
  }
  function refresh() {
    if (busy || !root.fetch || Date.now() - last < 300000) return;
    last = Date.now(); busy = true;
    var controller = root.AbortController ? new root.AbortController() : null;
    var timer = controller ? root.setTimeout(function () { controller.abort(); }, 5000) : null;
    Promise.resolve().then(function () { return root.fetch('/api/panel-settings', { cache: 'no-store', credentials: 'omit', signal: controller ? controller.signal : undefined }); })
      .then(function (r) { if (!r.ok) throw Error('settings unavailable'); return r.json(); })
      .then(function (v) { accept(v); }).catch(function () {}).finally(function () { busy = false; if (timer) root.clearTimeout(timer); });
  }
  async function claimCampaign(age, canShow) {
    // Without serialized durable receipts, omit an optional announcement rather
    // than repeat it across tabs or after a failed storage write.
    if (!root.navigator || !root.navigator.locks || !root.navigator.locks.request) return null;
    return root.navigator.locks.request('ezik-panel-campaign', function () {
      try {
        if (!canShow() || !P.campaignEligible(current, age, Date.now())) return null;
        var seenKey = 'ezik_panel_seen_v1:' + current.campaign.id;
        if (root.localStorage.getItem(seenKey)) return null;
        root.localStorage.setItem(seenKey, '1');
        if (root.localStorage.getItem(seenKey) !== '1') return null;
        return current.campaign;
      } catch (_) { return null; }
    }).catch(function () { return null; });
  }
  root.EzikPanel = Object.freeze({ read: function () { return current; }, accept: accept, refresh: refresh, claimCampaign: claimCampaign });
  // The shared bundle already loads on standalone pages. This is a presentation
  // policy; existing server authorization and spend checks remain authoritative.
  var hidden = new Map(), overlay = null;
  function standaloneId() {
    var path = root.location && root.location.pathname || '';
    if (/^\/library(?:\.html|\/)/.test(path)) return 'library';
    if (/^\/(?:quest(?:\.html|\/)|hanna-laha\/)/.test(path)) return 'treasure';
    return '';
  }
  function protectStandalone() {
    var id = standaloneId(), doc = root.document;
    if (!id || !doc || !doc.body) return;
    var state = P.availability(current, id);
    if (state.state === 'visible') {
      hidden.forEach(function (was, el) { el.hidden = was.hidden; el.inert = was.inert; if (was.display) el.style.setProperty('display', was.display, was.priority); else el.style.removeProperty('display'); }); hidden.clear();
      if (overlay) { overlay.remove(); overlay = null; }
      return;
    }
    if (!overlay) {
      overlay = doc.createElement('section'); overlay.setAttribute('data-panel-unavailable', id); overlay.setAttribute('role', 'alert');
      var title = doc.createElement('h1'); title.textContent = 'Ezik'; overlay.appendChild(title);
      var reason = doc.createElement('p'); reason.setAttribute('dir','auto'); overlay.appendChild(reason);
      var back = doc.createElement('a'); back.href = '/'; back.textContent = '\u2190 Ezik'; overlay.appendChild(back);
      doc.body.appendChild(overlay);
    }
    var reasonText = state.reason || '\uD83D\uDD12';
    if (overlay.querySelector('p').textContent !== reasonText) overlay.querySelector('p').textContent = reasonText;
    Array.from(doc.body.children).forEach(function (el) { if (el !== overlay) {
      if (!hidden.has(el)) hidden.set(el, { hidden: el.hidden, inert: el.inert, display: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority ? el.style.getPropertyPriority('display') : '' });
      el.hidden = true; el.inert = true; el.style.setProperty('display', 'none', 'important');
    } });
  }
  if (root.addEventListener) {
    root.addEventListener('storage', function (e) { if (e.key === P.cacheKey && e.newValue) { try { accept(JSON.parse(e.newValue)); } catch (_) {} } });
    root.addEventListener('online', refresh);
    root.addEventListener('pageshow', refresh);
  }
  if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', function () { if (!root.document.hidden) refresh(); });
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('DOMContentLoaded', protectStandalone);
    if (root.MutationObserver) new root.MutationObserver(protectStandalone).observe(root.document, { childList: true, subtree: true });
    protectStandalone();
  }
  refresh();
})(typeof window === 'object' ? window : null);
