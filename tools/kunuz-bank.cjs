'use strict';
// The exact browser pack validator/renderer is the source of truth, including visual eligibility.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { DOMParser } = require('linkedom');
async function loadKunuzBank(root = path.join(__dirname, '..')) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  class SvgParser { parseFromString(s, type) { const d = new DOMParser().parseFromString(s, type); function walk(n, ns) { if (n.nodeType !== 1) return; ns = n.getAttribute('xmlns') || ns; Object.defineProperty(n, 'namespaceURI', { value: ns }); for (const c of n.childNodes) walk(c, ns); } walk(d.documentElement, null); return d; } }
  const noop = () => {}, ctx = { TextEncoder, DOMParser: SvgParser, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, seenStamp: () => '', seenRead: noop, seenHas: () => false, seenMark: noop, seenReset: noop, kzLive: () => true, kzcGroups: () => [], drawCats: noop, KZC_GROUPS: Array.from({ length: 8 }, () => ['', 0, []]), KZC: {}, fetch: async url => ({ ok: true, text: async () => read(url.replace(/^\//, '')) }) };
  ctx.window = ctx; vm.createContext(ctx);
  for (const file of ['quest-data/kunuz-bank-3147.js', 'quest-data/kunuz-levels-3147.js', 'quest-data/kunuz-geo-index.js', 'quest-data/kunuz-packs-manifest.js', 'quest-visual.js']) vm.runInContext(read(file), ctx);
  await ctx.KZV.ready;
  vm.runInContext(read('quest-theme/model.js'), ctx);
  const questions = ctx.DATA.qs.map((q, index) => ({ index, id: String(q[8]), cat: q[0], level: ctx.KunuzModel.level(index), row: q, visual: q.kzPack?.vis, live: ctx.KunuzModel.live(index) }));
  return { cats: ctx.KunuzModel.categories().filter(c => c.count > 0), questions: questions.filter(q => q.live), total: ctx.DATA.qs.length };
}
module.exports = { loadKunuzBank };
