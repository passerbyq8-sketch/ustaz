/* Additive room presentation. Existing account/sign-in and reconnect owners remain in charge. */
(function (global) {
  'use strict';
  const NativeSocket = global.WebSocket;
  const nativeFetch = global.fetch.bind(global);
  global.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    if (init?.method?.toUpperCase() === 'POST' && /\/api\/(?:rooms|war\/rooms)$/.test(String(url))) {
      try {
        const body = JSON.parse(init.body);
        const difficulty = global.KunuzJourney?.state.settings.difficulty;
        if (body.config && ['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) init = { ...init, body: JSON.stringify({ ...body, config: { ...body.config, difficulty } }) };
      } catch (_) {}
    }
    return nativeFetch(input, init);
  };
  let current = null, visualKey = '', visualNode = null, loading = null, controls = null, activeSocket = null, features = null;
  function paintControls() {
    if (controls) controls.remove(); controls = null;
    if (!features?.host || activeSocket?.readyState !== 1) return;
    controls = document.createElement('section'); controls.className = 'j-form-card'; controls.dataset.kfxControls = 'true';
    controls.setAttribute('aria-label', 'إدارة الغرفة');
    const title = document.createElement('h2'); title.textContent = 'إدارة الغرفة'; controls.append(title);
    const add = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'j-secondary'; b.textContent = label; b.onclick = action; controls.append(b); };
    for (const member of features.members || []) add('طرد — ' + (member.name || 'مشاهد'), () => {
      if (global.confirm('تطرد هذا اللاعب؟')) activeSocket.send(JSON.stringify({ t: 'kfxKick', target: member.id }));
    });
    if (features.deduct) for (const [slot, team] of (current?.teams || []).entries()) add('خصم نقاط — ' + (team.name || team.n || ''), () => {
      const input = global.prompt('كم نقطة تخصم؟'); if (input === null) return;
      const amount = Number(input.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
      if (Number.isSafeInteger(amount) && amount > 0 && amount <= 1000000) activeSocket.send(JSON.stringify({ t: 'kfxDeduct', slot, amount }));
    });
    const journey = document.querySelector('.journey-app');
    // Native Hanna/Harb hide Journey's main area while keeping its header visible.
    (document.body.classList.contains('journey-room') ? journey || document.body : journey?.querySelector('main') || document.getElementById('root')?.parentNode || document.body).append(controls);
  }
  function kicked() {
    try { sessionStorage.setItem('kunuz_kicked_notice', 'أخرجك صاحب الغرفة'); } catch (_) {}
    location.replace('/quest.html');
  }
  function script(src) { return new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = reject; document.head.append(el); }); }
  async function renderer() {
    if (global.KZV) return global.KZV;
    if (!loading) loading = (async () => {
      // Direct Hanna join routes have no local Journey bank. Initialize only the shared visual renderer.
      if (!global.DATA) global.DATA = { cats: [], qs: [] };
      await script('/quest-theme/history.js?v=20261113-kfx-1');
      await script('/quest-visual.js?v=20261113-kfx-1');
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/quest-visual.css?v=20261102-tr4'; document.head.append(css);
      return global.KZV;
    })();
    return loading;
  }
  function paintVisual() {
    const q = current?.question || current?.game?.fight?.q;
    const anchor = document.querySelector('[data-testid="question-prompt"]') || document.getElementById('qtext');
    if (!q?.visual || !anchor || anchor.closest('[hidden],.hidden')) { if (visualNode) visualNode.remove(); visualNode = null; visualKey = ''; return; }
    const key = JSON.stringify(q.visual);
    const revealed = ['reveal', 'result', 'end'].includes(current?.phase) || ['revealed', 'closed'].includes(q.stage);
    if (visualNode) visualNode.classList.toggle('kzv-revealed', revealed);
    if (visualKey === key && visualNode?.isConnected) return;
    visualKey = key;
    if (visualNode) visualNode.remove();
    visualNode = document.createElement('div'); visualNode.dataset.kfxVisual = 'true'; anchor.after(visualNode);
    const node = visualNode;
    renderer().then(v => { if (!node.isConnected) return; const row = [0, 0, 1, q.prompt || q.text || '', q.options || q.opts || [], 0, '', '', 'room-visual']; row.kzPack = { vis: q.visual }; v.show(row, undefined, undefined, node); node.classList.toggle('kzv-revealed', revealed); }).catch(() => { node.textContent = 'تعذّر عرض الصورة؛ أعد الاتصال.'; });
  }
  class RoomSocket extends NativeSocket {
    send(data) {
      try { const message = JSON.parse(data); if (message.t === 'hello') data = JSON.stringify({ ...message, kfx: 1 }); } catch (_) {}
      return super.send(data);
    }
    constructor(url, protocols) {
      super(url, protocols);
      if (!/\/ws\//.test(String(url))) return;
      this.addEventListener('message', event => {
        try {
          const message = JSON.parse(event.data);
          if (message.t === 'kfxKicked') { event.stopImmediatePropagation(); kicked(); return; }
          if (message.t === 'kfxState') { event.stopImmediatePropagation(); activeSocket = this; features = message; paintControls(); return; }
          if (message.t === 'kfxAck' || message.t === 'kfxError') { event.stopImmediatePropagation(); return; }
          if (message.snapshot) { current = message.snapshot; setTimeout(() => { paintVisual(); paintControls(); }, 0); }
        } catch (_) {}
      });
      this.addEventListener('close', event => { if (event.code === 4003) kicked(); if (activeSocket === this) { features = null; paintControls(); } });
    }
  }
  global.WebSocket = RoomSocket;
  function observe() { new MutationObserver(paintVisual).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
})(window);
