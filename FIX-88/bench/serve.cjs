'use strict';
// ---------------------------------------------------------------------------
// THE PLATFORM THE CHECK TOOL IS POINTED AT. It serves the repaired working tree
// AND answers the read-only /api routes the sections fetch when they open.
//
// WHY IT MUST ANSWER THEM AT ALL, AND WHY 404 IS THE WRONG DEFAULT. The tool's
// cut-network round judges a message TRUE or FALSE by comparing the section with
// the network up against the same section with it cut. A server that 404s every
// call makes those two states IDENTICAL -- the outage line appears in both -- so
// every fetching section would be published as printing a FALSE line, which is an
// artefact of the bench and not a fact about the application. Answering 200 with
// well-formed rows is what makes "connected" mean connected, exactly as the live
// site does, and it is the same faking the order authorises for this platform.
//
// NOTHING PAID IS ANSWERED. /api/ask is not in this table and is refused with 501
// rather than stubbed, so a round that tried to spend would fail loudly instead of
// being quietly fed an invented answer.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('C:/Users/passe/projects/ustaz-fix88');
const PORT = parseInt(process.argv[2] || '0', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

// The bodies each client whitelist expects, so "rows" really draws rows.
const ARTICLES = {
  ok: true,
  items: [
    { slug: 'bench-a', kind: 'article', title: 'BENCH-ONE', publishedAt: '2026-09-01T00:00:00.000Z' },
    { slug: 'bench-b', kind: 'qa', title: 'BENCH-TWO', publishedAt: '2026-09-02T00:00:00.000Z' },
  ],
};
const LESSONS_BROWSE = { ok: true, rows: [{ scholar_id: 'BENCH-SCHOLAR', count: 7 }], pages: 1, total: 7 };
const LESSONS_SEARCH = { ok: true, results: [] };
const SCHOLARS = { ok: true, scholars: [{ id: 'binbaz', shortName: 'BENCH-SH' }] };
const FATWAS = {
  ok: true,
  results: [{
    uid: 'bench-1', title: 'BENCH-FATWA',
    scholar: { id: 'binbaz', shortName: 'BENCH-SH' },
    content: { question: 'BENCH-Q', answer: 'BENCH-A' },
    audio: { available: false }, source: { url: 'https://example.invalid/bench' },
  }],
  pagination: { page: 1, total: 1, totalPages: 1, hasPrevious: false, hasNext: false },
};

function apiBody(p) {
  if (p.indexOf('/api/articles-list') === 0) return ARTICLES;
  if (p.indexOf('/api/lessons-browse') === 0) return LESSONS_BROWSE;
  if (p.indexOf('/api/lessons-search') === 0) return LESSONS_SEARCH;
  if (p.indexOf('/api/v1/scholars') === 0) return SCHOLARS;
  if (p.indexOf('/api/v1/fatwas/browse') === 0) return FATWAS;
  if (p.indexOf('/api/articles-admin') === 0) return { ok: false, error: 'not-a-writer' };
  if (p.indexOf('/api/feedback') === 0) return { ok: true };
  return null;
}

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) {
    if (/^\/api\/ask(\/|$)/.test(p)) {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'the bench does not answer the paid route' }));
    }
    const body = apiBody(p);
    // THE REQUEST BODY IS DRAINED FIRST, ALWAYS. Several of these routes are POSTs, and a
    // socket left half-read is a request the client sees hang rather than answer -- which
    // on this bench would read as a slow server and quietly poison every timing beside it.
    // resume() drains a GET's empty body just as well as a POST's, so there is one path.
    req.resume();
    req.on('end', () => {
      if (!body) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"ok":false}');
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(body));
    });
    return undefined;
  }
  const rel = (p === '/' || p === '') ? '/index.html' : p;
  const f = path.join(ROOT, rel.replace(/^[/]+/, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  return fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    return res.end(buf);
  });
});

srv.listen(PORT, '127.0.0.1', () => console.log('PORT=' + srv.address().port + ' ROOT=' + ROOT));
