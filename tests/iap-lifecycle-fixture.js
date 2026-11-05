import assert from 'node:assert/strict';
import { afterEach } from 'node:test';

const cleanups = new Set();
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups.clear();
});

export function trackIapLifecycle(window, document) {
  window.document = document;
  const registrations = [];
  for (const target of [window, document]) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, listener, options) => {
      registrations.push({ target, type, listener, options, remove });
      add(type, listener, options);
    };
    target.removeEventListener = (type, listener, options) => {
      const index = registrations.findIndex(row => row.target === target && row.type === type && row.listener === listener);
      if (index !== -1) registrations.splice(index, 1);
      remove(type, listener, options);
    };
  }
  const cleanup = () => {
    window.dispatchEvent({ type: 'pagehide' });
    document.visibilityState = 'hidden';
    document.dispatchEvent(new document.defaultView.Event('visibilitychange'));
    for (const row of registrations.splice(0)) row.remove(row.type, row.listener, row.options);
    assert.equal(registrations.length, 0);
    cleanups.delete(cleanup);
  };
  cleanups.add(cleanup);
  return cleanup;
}
