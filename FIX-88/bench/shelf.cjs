'use strict';
// ORDER §4-و -- WHAT IS NOT REPAIRED THIS TRIP, MEASURED SO THE DESIGN WORK AFTER
// IT IS ONE STEP AND NOT A SEARCH. For every tile on the shelf, at both sizes: the
// box, the ink inside it, the ratio between them, and how many drawn marks (svg or
// img) the tile actually contains. No icon is invented and no identity is touched.
const fs = require('fs');
const path = require('path');
const R = require('./rig.cjs');

const TREE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'out'));
const SHOTS = path.join(OUT, 'shots-shelf');
for (const d of [OUT, SHOTS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
const D = R.dictOf(path.join(TREE, 'app.jsx'));
const AR = D.ar;

(async () => {
  const { srv, port } = await R.serve(TREE);
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await R.chromium.launch(R.LAUNCH);
  const out = { at: new Date().toISOString(), tree: TREE, viewports: [] };
  try {
    for (const vp of [{ tag: 'm390', w: 390, h: 844 }, { tag: 't820', w: 820, h: 1180 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ar', serviceWorkers: 'block' });
      await R.installRoutes(ctx, 'rows', null, []);
      const page = await ctx.newPage();
      await R.enter(page, AR, D.lit, base);
      await R.toHome(page, AR);
      const tiles = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-ezik-home-module]'));
        // The tallest run of glyphs inside the tile: the label's own line box, which is
        // what "the ink" means -- not the tile's padding and not its whole content box.
        const inkOf = (el) => {
          let top = Infinity, bot = -Infinity, found = false;
          const walk = (node) => {
            if (node.nodeType === 3) {
              const t = String(node.nodeValue || '').trim();
              if (!t) return;
              const r = document.createRange();
              r.selectNodeContents(node);
              const b = r.getBoundingClientRect();
              if (b.height > 0) { top = Math.min(top, b.top); bot = Math.max(bot, b.bottom); found = true; }
              return;
            }
            for (const c of node.childNodes) walk(c);
          };
          walk(el);
          return found ? Math.round((bot - top) * 100) / 100 : 0;
        };
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          const ink = inkOf(el);
          const cs = getComputedStyle(el);
          return {
            id: el.getAttribute('data-ezik-home-module'),
            label: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
            boxW: Math.round(r.width), boxH: Math.round(r.height),
            inkH: ink,
            ratio: ink > 0 ? Math.round((r.height / ink) * 100) / 100 : null,
            marks: el.querySelectorAll('svg,img,picture,canvas').length,
            fontSize: cs.fontSize,
            className: String(el.className || '').slice(0, 60),
          };
        });
      });
      const shot = await R.shot(page, SHOTS, 'shelf-' + vp.tag);
      out.viewports.push({ tag: vp.tag, count: tiles.length, tiles, shot });
      R.say('--', vp.tag, 'tiles=' + tiles.length);
      for (const t of tiles) {
        R.say('   ', String(t.id).padEnd(11), 'box=' + t.boxW + 'x' + t.boxH,
          'ink=' + t.inkH, 'ratio=' + t.ratio, 'marks=' + t.marks, 'font=' + t.fontSize);
      }
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  const f = path.join(OUT, 'shelf.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  R.say('WROTE', f);
})().catch((e) => { R.say('FATAL', String(e && e.stack || e)); process.exit(1); });
