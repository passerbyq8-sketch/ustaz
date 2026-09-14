'use strict';
// ---------------------------------------------------------------------------
// THE BENCH. It serves ONE working tree over a local static server, opens it in
// headless msedge, and INTERCEPTS every /api/** call so the four outcomes the
// order names can be forced: 429 throttle, 503/dead connection, 200 with an
// empty list, and 200 with real rows. Nothing here talks to the live site and
// nothing here calls a paid route.
//
// ASCII on the terminal. Arabic goes into the JSON this writes.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/passe/projects/ustaz-check88/check88/node_modules/playwright');
const { dictOf, keysIn } = require('./dict.cjs');

const LAUNCH = { headless: true, channel: 'msedge' };
const asc = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, '.');
const say = (...a) => console.log(a.map(asc).join(' '));

// -- the static server --------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};
function serve(rootIn) {
  const root = require('path').resolve(rootIn);
  return new Promise((res) => {
    const srv = http.createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const f = path.join(root, p.replace(/^[/]+/, ''));
      if (!f.startsWith(root)) { rq.writeHead(403); return rq.end('no'); }
      fs.readFile(f, (e, buf) => {
        if (e) { rq.writeHead(404, { 'Content-Type': 'text/plain' }); return rq.end('404'); }
        rq.writeHead(200, {
          'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        rq.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

// -- the faked answers --------------------------------------------------------
// One table. Every route the four sections under repair reach is here, with the
// body shape its own client whitelist expects, so "rows" really draws rows.
const ROWS = {
  'articles-list': {
    ok: true,
    items: [
      { slug: 'rig-a', kind: 'article', title: 'RIG-ONE', publishedAt: '2026-09-01T00:00:00.000Z' },
      { slug: 'rig-b', kind: 'qa', title: 'RIG-TWO', publishedAt: '2026-09-02T00:00:00.000Z' },
    ],
  },
  'lessons-browse': {
    ok: true,
    rows: [{ scholar_id: 'RIG-SCHOLAR', count: 7 }],
    pages: 1, total: 7,
  },
  'scholars': { ok: true, scholars: [{ id: 'binbaz', shortName: 'RIG-SH' }] },
  'fatwas-browse': {
    ok: true,
    results: [{
      uid: 'rig-1', title: 'RIG-FATWA',
      scholar: { id: 'binbaz', shortName: 'RIG-SH' },
      content: { question: 'RIG-Q', answer: 'RIG-A' },
      audio: { available: false }, source: { url: 'https://example.invalid/rig' },
    }],
    pagination: { page: 1, total: 1, totalPages: 1, hasPrevious: false, hasNext: false },
  },
};
const EMPTY = {
  'articles-list': { ok: true, items: [] },
  'lessons-browse': { ok: true, rows: [], pages: 1, total: 0 },
  'scholars': { ok: true, scholars: [] },
  'fatwas-browse': { ok: true, results: [], pagination: { page: 1, total: 0, totalPages: 0, hasPrevious: false, hasNext: false } },
};
function routeName(url) {
  if (url.indexOf('/api/articles-list') >= 0) return 'articles-list';
  if (url.indexOf('/api/lessons-browse') >= 0) return 'lessons-browse';
  if (url.indexOf('/api/lessons-search') >= 0) return 'lessons-search';
  if (url.indexOf('/api/v1/scholars') >= 0) return 'scholars';
  if (url.indexOf('/api/v1/fatwas/browse') >= 0) return 'fatwas-browse';
  if (url.indexOf('/api/feedback') >= 0) return 'feedback';
  return 'other';
}

// mode: '429' | '503' | 'abort' | 'empty' | 'rows'
// `only` limits the mode to one route name; everything else answers 'rows'.
async function installRoutes(ctx, mode, only, seen) {
  await ctx.route('**/api/**', async (route) => {
    const url = route.request().url();
    const name = routeName(url);
    if (seen) seen.push({ name, url: url.slice(0, 160), t: Date.now() });
    const m = (!only || only.indexOf(name) >= 0) ? mode : 'rows';
    if (m === 'abort') return route.abort('connectionfailed');
    if (m === '429') {
      return route.fulfill({ status: 429, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'rate_limited' } }) });
    }
    if (m === '503') {
      return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) });
    }
    const table = (m === 'empty') ? EMPTY : ROWS;
    const body = table[name];
    if (!body) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// -- reading the screen -------------------------------------------------------
const SIG = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const ctrls = Array.from(document.querySelectorAll('button,[role="button"],a[href],input,select,textarea,summary')).filter(vis);
  const t = (document.body && document.body.innerText) || '';
  return {
    url: location.href,
    textLen: t.length,
    text: t,
    controls: ctrls.length,
    live: Array.from(document.querySelectorAll('[role="alert"],[role="status"]')).filter(vis)
      .map((e) => ({ role: e.getAttribute('role'), text: (e.innerText || '').trim().slice(0, 400) })),
    names: ctrls.slice(0, 90).map((el) => ({
      t: (el.innerText || el.value || '').trim().slice(0, 60),
      a: el.getAttribute('aria-label') || '',
      g: el.tagName.toLowerCase(),
      h: el.getAttribute('href') || '',
      tg: el.getAttribute('target') || '',
    })),
  };
};

async function sig(page) { return page.evaluate(SIG); }

let seq = 0;
async function shot(page, shots, name) {
  seq += 1;
  const f = String(seq).padStart(3, '0') + '-' + String(name).replace(/[^A-Za-z0-9_.-]/g, '-') + '.png';
  try { await page.screenshot({ path: path.join(shots, f), timeout: 20000 }); } catch (e) { return null; }
  return f;
}

async function settle(page, ms) {
  try { await page.waitForLoadState('networkidle', { timeout: ms || 6000 }); } catch (e) {}
  await page.waitForTimeout(600);
}

// -- the way in ---------------------------------------------------------------
async function enter(page, ar, lit, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 8000);
  await page.waitForTimeout(1200);
  const g = page.getByRole('button', { name: ar['entry.guest'], exact: true });
  if (await g.count()) { await g.first().click(); await settle(page, 8000); await page.waitForTimeout(1500); }
  const a = page.getByRole('button', { name: lit.EZ_AIC_AGREE, exact: true });
  if (await a.count()) { await a.first().click(); await settle(page, 8000); await page.waitForTimeout(1800); }
}

async function toHome(page, ar) {
  for (let i = 0; i < 5; i++) {
    const n = await page.getByRole('button', { name: ar['module.mushaf'], exact: true }).count();
    if (n) return true;
    const h = page.getByRole('button', { name: ar['navigation.home'] });
    if (await h.count()) { await h.first().click(); await page.waitForTimeout(1400); continue; }
    const b = page.getByRole('button', { name: ar['common.back'] });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(1200); continue; }
    return false;
  }
  return false;
}

module.exports = {
  chromium, LAUNCH, serve, installRoutes, sig, shot, settle, enter, toHome,
  dictOf, keysIn, asc, say, SIG, ROWS, EMPTY, routeName,
};
