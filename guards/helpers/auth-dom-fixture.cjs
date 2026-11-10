'use strict';

// Each mounted document owns its URL and temporary auth storage. Never delegate
// discovery to the host fetch: every auth response here is an explicit double.
function installAuthDomFixture(win, options = {}) {
  const put = options.put || ((key, value) => { win[key] = value; });
  let current = new URL(options.href || 'https://app.fixture.invalid/');
  const location = {};
  for (const key of ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']) {
    Object.defineProperty(location, key, { enumerable: true, get: () => current[key],
      ...(key === 'origin' ? {} : { set(value) { if (key === 'href') current = new URL(value, current); else current[key] = value; } }) });
  }
  location.assign = location.replace = value => { location.href = value; };
  location.toString = () => location.href;
  put('location', location);
  const data = new Map();
  const store = options.sessionStorage || {
    get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(String(key)) ?? null, setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: key => data.delete(String(key)), clear: () => data.clear(),
  };
  put('sessionStorage', store);
  const entries = [null]; let index = 0;
  const previous = options.useExistingHistory === false ? {
    get state() { return entries[index]; }, get length() { return entries.length; },
    pushState(state) { entries.splice(index + 1); entries.push(state); index++; },
    replaceState(state) { entries[index] = state; },
    back() { if (index > 0) { index--; win.dispatchEvent(new win.Event('popstate')); } },
  } : win.history || {}, history = {};
  Object.defineProperties(history, Object.getOwnPropertyDescriptors(previous));
  for (const method of ['pushState', 'replaceState']) history[method] = (state, title, url) => {
    if (url !== undefined && url !== null) {
      const next = new URL(url, current);
      if (next.origin !== current.origin) throw new Error('cross-origin fixture history');
      current = next;
    }
    if (previous[method]) return previous[method](state, title, url);
  };
  put('history', history);
  const fallback = win.fetch;
  put('fetch', (url, init) => {
    const target = new URL(String(url), current);
    if (target.origin === current.origin && target.pathname === '/api/auth-capabilities') {
      const body = { ok: true, proofVersion: options.proofVersion ?? 0 };
      return Promise.resolve({ ok: true, status: 200, url: target.href, redirected: false,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => body, text: async () => JSON.stringify(body) });
    }
    if (options.fetch) return options.fetch(url, init);
    if (fallback && options.useExistingFetch !== false) return fallback(url, init);
    return Promise.reject(new Error('offline fixture boundary'));
  });
  return { location, store };
}

module.exports = { installAuthDomFixture };
