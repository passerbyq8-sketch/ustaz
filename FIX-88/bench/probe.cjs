'use strict';
// A one-shot look at the home shelf, to learn the accessible names before anything is measured.
const R = require('./rig.cjs');
const path = require('path');

(async () => {
  const tree = process.argv[2];
  const { srv, port } = await R.serve(tree);
  const base = 'http://127.0.0.1:' + port + '/';
  R.say('PORT', port, 'ROOT', tree);
  const d = R.dictOf(path.join(tree, 'app.jsx'));
  const browser = await R.chromium.launch(R.LAUNCH);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'ar',
    serviceWorkers: 'block', deviceScaleFactor: 1,
  });
  const seen = [];
  await R.installRoutes(ctx, 'rows', null, seen);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') R.say('CONSOLE-ERR', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => R.say('PAGE-ERR', String(e && e.message).slice(0, 200)));
  await R.enter(page, d.ar, d.lit, base);
  let s = await R.sig(page);
  R.say('after-enter textLen=', s.textLen, 'controls=', s.controls, 'url=', s.url);
  R.say('TEXT-HEAD:', JSON.stringify(s.text.slice(0, 300)));
  const home = await R.toHome(page, d.ar);
  R.say('toHome=', home);
  s = await R.sig(page);
  R.say('names:');
  for (const n of s.names) R.say('  [' + n.g + '] t=' + JSON.stringify(n.t) + ' a=' + JSON.stringify(n.a));
  R.say('routes seen:', JSON.stringify(seen.map((x) => x.name)));
  await browser.close();
  srv.close();
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
