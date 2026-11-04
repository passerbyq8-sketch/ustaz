import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

// The header sources here are literal paths and /(.*) patterns. Reject unfamiliar
// syntax so a future route expression cannot silently escape the coverage check.
function headersFor(pathname) {
  const headers = {};
  for (const rule of config.headers) {
    assert.match(rule.source, /^\/[A-Za-z0-9/._-]*(?:\(\.\*\))?$/);
    const prefix = rule.source.replace(/\(\.\*\)$/, '');
    const matches = rule.source.endsWith('(.*)') ? pathname.startsWith(prefix) : pathname === prefix;
    if (matches) for (const { key, value } of rule.headers) headers[key.toLowerCase()] = value;
  }
  return headers;
}

const mainRoutes = ['/', '/index.html', '/about.html', '/delete.html', '/quest.html',
  '/mushaf-lab/index.html', '/sw.js', '/app.js', '/api/auth-return', '/api/ask', '/api/v1/health'];

test('SEC-006 baseline protects main HTML, assets, APIs and rewritten proxy routes', () => {
  for (const route of mainRoutes) {
    const h = headersFor(route);
    assert.equal(h['content-security-policy'], "frame-ancestors 'self'", route);
    assert.equal(h['x-frame-options'], 'SAMEORIGIN', route);
    assert.equal(h['x-content-type-options'], 'nosniff', route);
    assert.equal(h['referrer-policy'], 'no-referrer', route);
    assert.equal(h['permissions-policy'], 'camera=(self), microphone=(self), geolocation=(self), payment=()', route);
  }
});

test('SEC-006 Quran embedding and voice/location remain allowed on the same origin', () => {
  const app = headersFor('/');
  const reader = headersFor('/mushaf-lab/index.html');
  assert.equal(reader['content-security-policy'], "frame-ancestors 'self'");
  assert.equal(reader['x-frame-options'], 'SAMEORIGIN');
  for (const feature of ['camera', 'microphone', 'geolocation']) {
    assert.ok(app['permissions-policy']?.includes(feature + '=(self)'), feature);
  }
});

test('SEC-006 existing Hanna frame and feature restrictions still override the baseline', () => {
  for (const route of ['/hanna-laha', '/hanna-laha/index.html', '/hanna-laha/room/fixture', '/hanna-laha/assets/fixture.js']) {
    const h = headersFor(route);
    assert.equal(h['content-security-policy'], "frame-ancestors 'none'", route);
    assert.equal(h['permissions-policy'], 'camera=(), microphone=(), geolocation=(), payment=()', route);
    assert.equal(h['x-content-type-options'], 'nosniff', route);
    assert.equal(h['referrer-policy'], 'no-referrer', route);
  }
});

test('SEC-006 header baseline preserves cache rules and rewrite destinations', () => {
  for (const route of ['/', '/index.html', '/quest.html', '/hanna-laha']) {
    assert.equal(headersFor(route)['cache-control'], 'no-cache', route);
  }
  assert.equal(headersFor('/hanna-laha/assets/fixture.js')['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(config.rewrites.find(r => r.source === '/api/v1/:path*')?.destination, '/api/fatwa-proxy?path=:path*');
  assert.equal(config.rewrites.find(r => r.source === '/hanna-laha')?.destination, '/hanna-laha/index.html');
});
