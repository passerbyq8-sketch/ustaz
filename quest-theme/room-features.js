/* Additive room presentation. Existing account/sign-in and reconnect owners remain in charge. */
(function (global) {
  'use strict';
  const NativeSocket = global.WebSocket;
  let current = null, visualKey = '', visualNode = null, loading = null;
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
    const q = current?.question || current?.game?.q;
    const anchor = document.querySelector('[data-testid="question-prompt"]') || document.getElementById('qtext');
    if (!q?.visual || !anchor || anchor.closest('[hidden],.hidden')) { if (visualNode) visualNode.remove(); visualNode = null; visualKey = ''; return; }
    const key = JSON.stringify(q.visual);
    if (visualKey === key && visualNode?.isConnected) return;
    visualKey = key;
    if (visualNode) visualNode.remove();
    visualNode = document.createElement('div'); visualNode.dataset.kfxVisual = 'true'; anchor.after(visualNode);
    const node = visualNode;
    renderer().then(v => { if (!node.isConnected) return; const row = [0, 0, 1, q.prompt || q.text || '', q.options || q.opts || [], 0, '', '', 'room-visual']; row.kzPack = { vis: q.visual }; v.show(row, undefined, undefined, node); }).catch(() => { node.textContent = 'تعذّر عرض الصورة؛ أعد الاتصال.'; });
  }
  class RoomSocket extends NativeSocket {
    constructor(url, protocols) {
      super(url, protocols);
      if (!/\/ws\//.test(String(url))) return;
      this.addEventListener('message', event => {
        try { const message = JSON.parse(event.data); if (message.snapshot) { current = message.snapshot; setTimeout(paintVisual, 0); } } catch (_) {}
      });
    }
  }
  global.WebSocket = RoomSocket;
  function observe() { new MutationObserver(paintVisual).observe(document.body, { childList: true, subtree: true }); }
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
})(window);
