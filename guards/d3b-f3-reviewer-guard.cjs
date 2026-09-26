'use strict';
// D3B F3 (BEFORE_WRITING_V1) — the sentence reviewer is no longer cut off silently.
// F3a sentences go to the reviewer in batches that fit its 2,000-token cap; F3b a cut reply keeps every
// complete verdict; F3c one retry for the sentences still without a verdict; F3d the unreviewed sentences
// are counted per answer (and keep today's behaviour: they pass). Replays the recorded capped replies of
// Q14, Q30 and Q40 (guards/fixtures/fix-d3b-witnesses.json) with a deterministic stub that answers each
// sentence with the verdict the model actually wrote for it, and cuts a batch's first reply on demand.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt < 0 ? path.join(__dirname, '..') : process.argv[rootAt + 1];
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d3b-witnesses.json'), 'utf8'));
const turn = (q) => W.turns.find((t) => t.q === q);
const rowsOf = (t) => t.rows.map((r) => ({ ...r, text: r.fullText }));
let checks = 0, failed = 0;
const ok = (name, pass, info) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || info === undefined ? '' : ' :: ' + info)); };
(async () => {
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const RC = await import(pathToFileURL(path.join(ROOT, 'lib/route-classify.js')));
  const fold = (s) => RC.normalizeArabic(String(s || '').replace(/\[\[\s*[0-9\s،,و]+?\s*\]\]/gu, ' ')).replace(/\s+/gu, ' ').trim();
  // Every COMPLETE verdict object the model wrote, by its id (the reply may be cut).
  const itemsOf = (raw) => {
    const out = new Map();
    let i = raw.indexOf('[', raw.indexOf('"claims"'));
    for (i += 1; i > 0 && i < raw.length; i += 1) {
      if (raw[i] === ']') break;
      if (raw[i] !== '{') continue;
      let depth = 0, str = false, esc = false, j = i;
      for (; j < raw.length; j += 1) {
        const ch = raw[j];
        if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
        if (ch === '"') str = true; else if (ch === '{') depth += 1; else if (ch === '}') { depth -= 1; if (depth === 0) break; }
      }
      if (j >= raw.length) break;
      try { const o = JSON.parse(raw.slice(i, j + 1)); out.set(Number(o.id), o); } catch { /* malformed */ }
      i = j;
    }
    return out;
  };
  const stub = (t, { cutFirst = false, log = [] } = {}) => {
    const items = itemsOf(t.raw);
    const idOf = new Map(t.recordedDoor.claims.map((c, i) => [fold(c.sentence), i + 1]));
    const asked = new Set();
    return async (system, user) => {
      const sents = [...(user.split('\nالجمل:\n')[1] || '').matchAll(/^\((\d+)\) (.*)$/gmu)];
      const keys = sents.map((m) => fold(m[2]));
      const fresh = keys.every((k) => !asked.has(k));
      keys.forEach((k) => asked.add(k));
      const claims = [];
      sents.forEach(([, n], k) => { const it = items.get(idOf.get(keys[k])); if (it) claims.push({ ...it, id: Number(n) }); });
      log.push({ sentences: sents.length, answered: claims.length, cut: cutFirst && fresh && sents.length >= 3 });
      if (cutFirst && fresh && sents.length >= 3) {
        const half = JSON.stringify({ claims: claims.slice(0, Math.ceil(claims.length / 2)) });
        return { text: half.slice(0, half.lastIndexOf('}')) + ',{"id":9,"verdict":"supp', stop: 'max_tokens' };
      }
      return { text: JSON.stringify({ claims, khilaf: { exists: false } }), stop: 'end_turn' };
    };
  };
  const run = (q, opts = {}, extra = {}) => { const t = turn(q); return RR.reviewRulings({ text: t.text, rows: rowsOf(t), ask: stub(t, opts), question: t.question, ...extra }); };

  // F3b — the recorded cut replies.
  for (const [q, n] of [[14, 11], [30, 17], [40, 18]]) {
    const t = turn(q);
    const got = RR.parseVerdicts(t.raw, t.recordedDoor.claims.length).filter(Boolean).length;
    ok(`F3b Q${q} recorded reply stopped at ${t.stop}: its ${n} finished verdicts are kept, not discarded`, t.stop === 'max_tokens' && got === n, String(got));
  }
  ok('F3b a whole reply is still read whole', typeof RR.wholeReply === 'function' && RR.wholeReply(turn(2).raw) && !RR.wholeReply(turn(40).raw));

  // F3a — batches under the cap.
  const log40 = [];
  const q40 = await run(40, { log: log40 });
  ok('F3a Q40: 19 sentences go in batches of at most RULING_REVIEW_BATCH', RR.RULING_REVIEW_BATCH === 6 && log40.every((l) => l.sentences <= 6) && q40.record.batches === 4, JSON.stringify(log40));
  // F3d — counted; the unreviewed keep today's behaviour.
  ok('F3d Q40 reviewed + unreviewed = sentences, in the record', q40.record.reviewed + q40.record.unreviewed === q40.record.claims && q40.record.unreviewed === 1, JSON.stringify(q40.record));
  const q30 = await run(30);
  ok('F3d Q30 the four sentences the model never reached are counted unreviewed and left in the answer', q30.record.unreviewed === 4
    && q30.record.unverified >= 4, JSON.stringify(q30.record));
  const q14 = await run(14);
  ok('F3d Q14 unreviewed 24 -> 13 on the recorded verdicts (a live batch would review the rest)', q14.record.unreviewed === 13, JSON.stringify(q14.record));

  // F3c — a simulated cut-off: the first reply of each batch is cut; one retry recovers the rest.
  const logCut = [];
  const cut40 = await run(40, { cutFirst: true, log: logCut });
  ok('F3c Q40 every cut batch is retried once, and the retry recovers what the cut lost', cut40.record.cutoffs >= 3 && cut40.record.retried >= 3
    && cut40.record.reviewed === q40.record.reviewed && cut40.text === q40.text, JSON.stringify({ cut: cut40.record, full: q40.record.reviewed }));
  const noTime = await run(40, { cutFirst: true }, { retryUntil: 0 });
  ok('F3c no retry once the clock has no room: the cut verdicts stay missing, counted', noTime.record.retried === 0 && noTime.record.unreviewed > q40.record.unreviewed, JSON.stringify(noTime.record));
  const t2 = turn(2);
  let calls = 0;
  const oneDown = await RR.reviewRulings({ text: t2.text, rows: rowsOf(t2), question: t2.question, ask: async (s, u) => { calls += 1; if (calls === 1) throw Object.assign(new Error('upstream 529'), { status: 529 }); return stub(t2)(s, u); } });
  ok('F3c one batch failing does not discard the other batch', oneDown.record.verifier === 'ok' && oneDown.record.reviewed > 0 && oneDown.record.unreviewed > 0, JSON.stringify(oneDown.record));
  console.log('D3B-F3 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
