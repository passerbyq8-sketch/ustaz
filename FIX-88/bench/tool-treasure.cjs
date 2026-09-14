'use strict';
// Drive the TOOL'S OWN back search against the treasure section, in the state the
// sweep actually reaches it in -- ten controls pressed first, so a round is running
// and the exit door asks its question. This is the case the last run got wrong.
process.env.EZIK_CHECK_TREE = 'C:/Users/passe/projects/ustaz-fix88';
process.env.EZIK_CHECK_TARGET = process.argv[2];
const T = 'C:/Users/passe/projects/ustaz-check88/check88/src/';
const E = require(T + 'engine.js');
const N = require(T + 'names.js');
const NAV = require(T + 'nav.js');
const SWEEP = require(T + 'sweep.js');

(async () => {
  E.say('TARGET', E.TARGET);
  const br = await E.launch();
  const S = await E.newSession(br, { viewport: E.VIEWPORTS[0], label: 'probe' });
  await NAV.enter(S.page, S.ev);
  await NAV.toHome(S.page, S.ev);
  const want = (process.argv[3] || 'treasure').split(',');
  const out = [];
  for (const id of want) {
    const sec = N.inv().sections.filter((x) => x.id === id)[0];
    if (!sec) { E.say('no such section', id); continue; }
    const n = out.length;
    await SWEEP.sweepSection(S.page, S.ev, sec, E.VIEWPORTS[0], out);
    const r = out[n];
    const b = (r.acts.back && r.acts.back.app) || {};
    E.say('--', id, 'opened=' + r.opened,
      'named=' + b.controlPresent, 'way=' + b.wayBackExists,
      'lands=' + JSON.stringify(b.wayBackLandsOn), 'by=' + JSON.stringify(b.wayBackNamed));
    E.say('   searched=', JSON.stringify(((r.acts.back && r.acts.back.searched) || []).map((x) => x.name + '->' + x.landed)));
    E.say('   titleOnScreen=' + (r.acts.open||{}).titleOnScreen, 'exact=' + (r.acts.open||{}).titleOnScreenExact);
    await NAV.toHome(S.page, S.ev);
  }
  await S.ctx.close();
  await br.close();
})().catch((e) => { E.say('FATAL', String(e && e.stack || e)); process.exit(1); });
