// guards/hanna-laha-in-ezik-guard.cjs -- the third Kunuz game (Hanna Laha) inside this repository.
//
// WHAT IT PROVES (offline, reads only):
//   H1 quest.html has exactly three game cards, linking to /quest-ghaws.html, /quest-harb.html and /hanna-laha/ .
//   H2 hanna-laha/build-info.json names a commit, a protocol version and a bank, and says it is the ezik build under /hanna-laha .
//   H3 the folder hanna-laha/ holds only the files of that build (the page, build-info.json, the notice, two small images and
//      hashed assets of the kinds a build writes).
//   H4 no root-absolute URL leaves /hanna-laha/ except "/" (Ezik's home), "/quest.html" (the Kunuz page) and the question-report
//      endpoint "/api/report"; the game's own API paths are joined to the Worker's origin by the build, which must be set.
//   H5 vercel.json carries the rewrite of the game's routes and its headers, and only under /hanna-laha .
//
// The folder is written by scripts/ezik-sync.mjs of the hanna-laha project and is never edited by hand.
// Usage: node guards/hanna-laha-in-ezik-guard.cjs [--self-test]
//   --self-test mutates what it reads, in memory, and fails unless every mutation is caught.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAME = 'hanna-laha';
const FRONT_FILES = new Set(['index.html', 'build-info.json', 'favicon.svg', 'og.png', 'NOTICE.txt']);
const ASSET_EXT = /\.(js|css|woff2?)$/;
const ROOT_ALLOWED = new Set(['/', '/quest.html', '/api/report']);
const GAME_API = new Set(['/api/rooms', '/api/categories', '/api/client-error', '/api/health']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function check(read, listFolder) {
  const problems = [];
  const no = (id, msg) => problems.push(id + ' ' + msg);

  // H1 -- the cards
  const quest = read('quest.html');
  const doors = [...quest.matchAll(/<a class="door" href="([^"]*)"/g)].map((m) => m[1]);
  const want = ['/quest-ghaws.html', '/quest-harb.html', '/hanna-laha/'];
  if (doors.length !== 3 || want.some((w, i) => doors[i] !== w)) {
    no('H1', 'quest.html must have exactly three game cards (' + want.join(', ') + '), found ' + doors.length + ': ' + doors.join(', '));
  }

  // H2 -- the build info
  let info = null;
  try { info = JSON.parse(read(GAME + '/build-info.json')); } catch (e) { no('H2', GAME + '/build-info.json is missing or not JSON'); }
  if (info !== null) {
    if (!/^[0-9a-f]{7}$/.test(String(info.gitSha))) no('H2', 'build-info names no commit');
    if (!Number.isInteger(info.protocolVersion)) no('H2', 'build-info names no protocol version');
    if (!/^[0-9a-f]{8}$/.test(String(info.bankSha8))) no('H2', 'build-info names no bank');
    if (info.target !== 'ezik' || info.basePath !== '/' + GAME) no('H2', 'build-info is not the ezik build under /' + GAME);
    if (!/^https:\/\/[a-z0-9.-]+$/.test(String(info.apiOrigin))) no('H4', 'the build has no API origin, so its /api paths could address this site');
  }

  // H3 -- only that build's files
  const files = listFolder();
  for (const f of files) {
    const top = f.split('/')[0];
    if (f.includes('/')) {
      if (top !== 'assets' || f.split('/').length !== 2 || !ASSET_EXT.test(f)) no('H3', 'unexpected file ' + f);
    } else if (!FRONT_FILES.has(f)) no('H3', 'unexpected file ' + f);
  }
  for (const need of ['index.html', 'build-info.json']) if (!files.includes(need)) no('H3', need + ' is missing');

  // H4 -- no root-absolute URL outside /hanna-laha/
  for (const f of files) {
    if (!/\.(html|js|css|json|svg)$/.test(f)) continue;
    const text = read(GAME + '/' + f);
    for (const m of text.matchAll(/\b(?:src|href|action)=["'](\/[^"']*)["']/g)) {
      if (!m[1].startsWith('/' + GAME + '/') && !ROOT_ALLOWED.has(m[1])) no('H4', f + ': root-absolute URL ' + m[1].slice(0, 60));
    }
    for (const m of text.matchAll(/url\(\s*["']?(\/[^"')\s]*)/g)) {
      if (!m[1].startsWith('/' + GAME + '/') && !m[1].startsWith('//')) no('H4', f + ': css url ' + m[1].slice(0, 60));
    }
    for (const m of text.matchAll(/["'`](\/(?:assets\/|favicon\.svg|og\.png|robots\.txt|build-info\.json)[^"'`]*)/g)) {
      no('H4', f + ': a string points at the site root ' + m[1].slice(0, 60));
    }
    for (const m of text.matchAll(/["'`](\/(?:quest[A-Za-z0-9._-]*|api\/[A-Za-z0-9/_-]*|[A-Za-z0-9_-]+\.html))["'`]/g)) {
      if (!ROOT_ALLOWED.has(m[1]) && !GAME_API.has(m[1])) no('H4', f + ': a root path that is not allowed ' + m[1]);
    }
  }

  // H5 -- vercel.json
  let cfg = null;
  try { cfg = JSON.parse(read('vercel.json')); } catch (e) { no('H5', 'vercel.json is not JSON'); }
  if (cfg !== null) {
    const rewrites = (cfg.rewrites || []).filter((r) => String(r.source).startsWith('/' + GAME));
    const sources = rewrites.map((r) => r.source);
    if (!sources.includes('/' + GAME) || !sources.some((s) => s.startsWith('/' + GAME + '/:path'))) no('H5', 'vercel.json has no rewrite for the game routes');
    if (rewrites.some((r) => r.destination !== '/' + GAME + '/index.html')) no('H5', 'a game rewrite does not end at its index.html');
    const hdr = (cfg.headers || []).filter((h) => String(h.source).startsWith('/' + GAME + '/'));
    if (!hdr.some((h) => h.source === '/' + GAME + '/(.*)')) no('H5', 'vercel.json has no headers for the game');
    if (!hdr.some((h) => h.source === '/' + GAME + '/assets/(.*)')) no('H5', 'vercel.json has no caching rule for the game assets');
  }
  return problems;
}

const realRead = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const realList = () => {
  const dir = path.join(ROOT, GAME);
  return fs.existsSync(dir) ? walk(dir).map((f) => path.relative(dir, f).split(path.sep).join('/')).sort() : [];
};

const problems = check(realRead, realList);
if (problems.length) {
  console.log('hanna-laha-in-ezik: FAIL');
  problems.forEach((p) => console.log('  ' + p));
  process.exit(1);
}
console.log('hanna-laha-in-ezik: PASS -- three cards in quest.html, build ' + JSON.parse(realRead(GAME + '/build-info.json')).gitSha + ', ' + realList().length + ' files, nothing leaves /' + GAME + '/ except the three allowed targets');

if (process.argv.includes('--self-test')) {
  const mutants = [
    ['quest.html loses its third card', (r) => (rel) => (rel === 'quest.html' ? r(rel).replace(/  <a class="door" href="\/hanna-laha\/">[\s\S]*?<\/a>\n/, '') : r(rel)), realList],
    ['quest.html gets a fourth card', (r) => (rel) => (rel === 'quest.html' ? r(rel).replace('</div>\n</body>', '  <a class="door" href="/x.html"><b>x</b></a>\n</div>\n</body>') : r(rel)), realList],
    ['build-info loses its commit', (r) => (rel) => (rel === GAME + '/build-info.json' ? r(rel).replace(/"gitSha": "[^"]*"/, '"gitSha": ""') : r(rel)), realList],
    ['a stray file appears', (r) => r, () => realList().concat(['stray.txt'])],
    ['a link leaves the folder', (r) => (rel) => (rel === GAME + '/index.html' ? r(rel).replace('<head>', '<head><link rel="x" href="/app.js">') : r(rel)), realList],
    ['vercel.json loses the game rewrite', (r) => (rel) => (rel === 'vercel.json' ? r(rel).replace('"/hanna-laha/index.html"', '"/index.html"') : r(rel)), realList],
  ];
  let missed = 0;
  for (const [name, wrap, list] of mutants) {
    const found = check(wrap(realRead), list);
    console.log((found.length ? '  PASS  MUTANT KILLED: ' : '  FAIL  MUTANT SURVIVED: ') + name);
    if (!found.length) missed += 1;
  }
  if (missed) process.exit(1);
}
