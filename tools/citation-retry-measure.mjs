// tools/citation-retry-measure.mjs — §٢'s before/after, on question 19, offline and reproducible.
//
// WHY THIS EXISTS BESIDE THE LIVE PROBE, AND WHAT EACH HALF CAN SHOW.
//
//   LIVE (ezik.app) can show the BEFORE only. Production runs the code that was deployed, and this
//   round ships nothing: zero push, zero deploy. So the live passes establish whether question 19
//   still arrives with no attribution while evidence sits unused — the trigger — and what a pass
//   costs in wall time. They cannot show the extra round, because the extra round is not there.
//
//   THIS FILE shows the BEFORE and the AFTER on the same input, by driving the SHIPPED loop twice:
//   once against a copy with the ceiling set to zero, which is exactly the behaviour of 17 August,
//   and once against the module as committed. Same question, same stubbed rounds, one variable.
//
// THE QUESTION IS THE OWNER'S, BYTE FOR BYTE. 156 characters, sha256[0:16] = 0ec384b82893345e —
// the same string EZIK-FIX-A3-CC-WITNESSES-2026-08-17.md records, so this measures the case that
// was measured, not a paraphrase of it.
//
// THE FIRST ANSWER IS THE PRODUCTION ANSWER, BYTE FOR BYTE. It is the reply question 19 pass 1
// actually returned on 17 August (sha256[0:16] = 40e367abb1ee0e2a in that same witness file), with
// its `<hadith>` and `<suggestions>` blocks intact and no citation marker anywhere in it. That is
// the input the retry has to work on, so it is the input used.
//
// AND THE RETRY'S OWN CONTENT IS THE MODEL'S, WHICH NO OFFLINE HARNESS CAN PREDICT. So BOTH
// outcomes are measured and reported side by side:
//   (i)  the retry cites — the synthesised branch, and it is labelled synthesised: the production
//        answer with `[[1]]` appended to its ruling sentence, which is the minimum a compliant
//        rewrite would do.
//   (ii) the retry still cites nothing — the production answer returned unchanged, which is §٢/٤.
// The COST is identical in both, and that is the number the order asks for.
//
// OFFLINE BY CONSTRUCTION. The provider is a stub keyed on its own host and every other host
// throws, so nothing here reaches the network. The evidence table is filled by `search_sources`,
// whose encyclopedia half is in-process; its web half needs BRAVE_API_KEY, finds nothing without
// one, and is reported as the reason `retrieved` here is smaller than production's four.
//
// Usage:  node tools/citation-retry-measure.mjs
// Exit:   0 always. This is a measurement, not a gate.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOOP = join(REPO, 'lib', 'free-brain', 'loop.js');
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const line = (s) => process.stdout.write(s + '\n');

const Q19 = 'شخص توضأ، وبعدين لبس "دلاغ" على رجله اليمين، وقبل لا يغسل رجله اليسار أحدث (انتقض وضوءه). فكمل ولبس دلاغ اليسار. هل يجوز له أن يمسح عليهما في الوضوء القادم؟';

// The reply question 19 returned on ezik.app, 17 August, pass 1. Not one character is edited.
const PRODUCTION_ANSWER = [
  'الشرطُ الأساسيُّ لجوازِ المسحِ على الحائلِ (الخفِّ أو نحوِه كـ"الدَّلاغ") أن يُلبَسَ على طهارةٍ كاملة، أي بعد غسلِ الرجلين معًا.',
  'وما وصفتَه في السؤال يخالفُ هذا الشرط: فقد لبس دَلاغَ الرجلِ اليمنى وهو لم يكمل طهارتَه بعدُ (لأنّ الرجلَ اليسرى لم تُغسَل)، ثم أحدثَ قبل أن يُتمّ الوضوء.',
  'وحين أحدثَ وهو في هذه الحال، بطلَت طهارتُه الأولى بالكامل.',
  'فلمّا أكمل الأمر ولبس دَلاغَ اليسرى بعد ذلك، لم يكن قد لبس الحائلينِ معًا على طهارةٍ صحيحةٍ مكتملة؛ إذ لُبِسَ اليمنى قبل تمام الطهارة، ولُبِسَت اليسرى بعد أن انتقض ما كان عليه من طهارة.',
  'وهذا يعني أنّه لم يتحقق الشرط الذي بُنيَ عليه جواز المسح.',
  'الحكمُ في هذه الحال: لا يجوز له أن يمسح على هذين الدَّلاغَين في الوضوء القادم، لأنّهما لم يُلبَسا على طهارةٍ كاملةٍ صحيحة.',
  'ولو أراد أن يمسح عليهما لاحقًا، فعليه أن يخلعهما، ثم يتوضأ وضوءًا كاملًا يغسل فيه رجليه معًا، ثم يلبسهما من جديد بعد تمام الطهارة، وحينئذٍ يصحّ له المسح عليهما.',
  '<hadith narrator="مسلم">أَمَرَنَا رَسُولُ اللَّهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ أَنْ نَمْسَحَ عَلَى الْخِفَافِ إِذَا نَحْنُ أَدْخَلْنَاهُمَا طَاهِرَتَيْنِ</hadith>',
  'هذا الحديثُ هو أصل الشرط: أن تُدخَل الرجلانِ الخفَّ وهما طاهرتان، أي بعد تمام الطهارة لا في أثنائها.',
  '<suggestions>',
  '- ما حكم المسح على الجوربين؟',
  '- كم مدة المسح على الخفين؟',
  '- ماذا لو نزع الخف بعد المسح؟',
  '</suggestions>',
].join('\n');

// SYNTHESISED, and said so. The minimum a compliant rewrite does: the same ruling, one marker.
const RETRY_CITED = PRODUCTION_ANSWER.replace(
  'لأنّهما لم يُلبَسا على طهارةٍ كاملةٍ صحيحة.',
  'لأنّهما لم يُلبَسا على طهارةٍ كاملةٍ صحيحة [[1]].');

const PROVIDER = 'https://stub.invalid/v1/messages';
const BASE = {
  messages: [{ role: 'user', content: Q19 }],
  system: 'أنت أستاذ.',
  model: 'stub',
  maxTokens: 2048,
  band: 'adult',
  mode: '',
  lexicalRoute: 'DEEN',
  providerUrl: PROVIDER,
  headers: {},
};
const textPayload = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
const searchRound = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't0', name: 'search_sources', input: { query: 'المسح على الخفين شرط لبسهما على طهارة' } }] };

/** A copy of the loop in os.tmpdir(), with its relative imports repointed back at the real tree. */
async function loopCopy(label, transform = (s) => s) {
  const original = readFileSync(LOOP, 'utf8');
  const changed = transform(original);
  if (changed === original && transform !== undefined && label !== 'shipped') {
    throw new Error(`the seam for "${label}" moved — the measurement would silently compare the same code twice`);
  }
  const rewired = changed.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) =>
    quote + pathToFileURL(resolve(dirname(LOOP), specifier)).href + quote);
  const temp = mkdtempSync(join(tmpdir(), 'ezik-citation-retry-'));
  const file = join(temp, label + '.mjs');
  writeFileSync(file, rewired, 'utf8');
  const module = await import(pathToFileURL(file).href + '?m=' + label);
  return { module, cleanup: () => rmSync(temp, { recursive: true, force: true }) };
}

async function drive(module, retryPayload) {
  const realFetch = globalThis.fetch;
  const bodies = [];
  let n = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
    bodies.push(JSON.parse(String(init?.body || '{}')));
    const step = n === 0 ? searchRound : n === 1 ? textPayload(PRODUCTION_ANSWER) : textPayload(retryPayload);
    n += 1;
    return { ok: true, status: 200, json: async () => step };
  };
  const startedAt = Date.now();
  try {
    const turn = await module.runFreeBrainTurn({ ...BASE });
    return { turn, bodies, wallMs: Date.now() - startedAt };
  } finally { globalThis.fetch = realFetch; }
}

const row = (label, run) => {
  const t = run.turn;
  return {
    label,
    retrieved: (t.evidence || []).length,
    cited: (t.cited || []).map((r) => r.ref),
    citedCount: (t.cited || []).length,
    // The card list is api/ask.js's, built from `cited` through the shipped rule, capped at three.
    cards: t.__cards,
    modelCalls: t.modelCalls,
    providerCalls: run.bodies.length,
    citationRetries: t.citationRetries ?? 0,
    retryDegraded: (t.degraded || []).filter((d) => d.startsWith('citation_retry')),
    searchCallsInRetry: run.bodies.length >= 3 && 'tools' in run.bodies[2] ? 'TOOLS OFFERED' : 'none — no tools key',
    wallMs: run.wallMs,
    answerSha: sha(String(t.text || '')),
    answerChars: String(t.text || '').length,
  };
};

const tagOf = (r) => (r.url ? { tag: `<source url="${r.url}">${r.title || ''}</source>` } : null);

line('=== §٢ before/after — question 19, offline on the shipped loop ===');
line(`question: ${Q19.length} chars, sha256[0:16] = ${sha(Q19)}  (A-3 recorded 156 / 0ec384b82893345e)`);
line(`first answer: ${PRODUCTION_ANSWER.length} chars, ${(PRODUCTION_ANSWER.match(/\[\[/gu) || []).length} citation markers`);
line('');

const before = await loopCopy('before-ceiling-zero',
  (s) => s.replace('const MAX_CITATION_RETRIES = 1;', 'const MAX_CITATION_RETRIES = 0;'));
const shipped = await loopCopy('shipped');
try {
  const runs = [
    ['BEFORE — 17 August behaviour (ceiling 0)', before.module, RETRY_CITED],
    ['AFTER  — retry cites (synthesised rewrite)', shipped.module, RETRY_CITED],
    ['AFTER  — retry still cites nothing (§٢/٤)', shipped.module, PRODUCTION_ANSWER],
  ];
  const rows = [];
  for (const [label, module, retryPayload] of runs) {
    const run = await drive(module, retryPayload);
    run.turn.__cards = shipped.module.pickReaderCards(run.turn.cited, 3, tagOf).length;
    rows.push(row(label, run));
  }
  for (const r of rows) {
    line(`--- ${r.label}`);
    line(`    retrieved            : ${r.retrieved}`);
    line(`    cited                : ${JSON.stringify(r.cited)}   (${r.citedCount})`);
    line(`    cards                : ${r.cards}`);
    line(`    model calls          : ${r.modelCalls}`);
    line(`    provider calls made  : ${r.providerCalls}`);
    line(`    citationRetries      : ${r.citationRetries}`);
    line(`    degraded (this item) : ${JSON.stringify(r.retryDegraded)}`);
    line(`    search calls in retry: ${r.searchCallsInRetry}`);
    line(`    raw wall time        : ${r.wallMs}ms  (stubbed provider — the shape, not the latency)`);
    line(`    answer               : ${r.answerChars} chars, sha ${r.answerSha}`);
    line('');
  }
  const [b, aCited, aEmpty] = rows;
  line('--- the deltas the order asks for');
  line(`    cited   ${JSON.stringify(b.cited)} -> ${JSON.stringify(aCited.cited)}   (retry cites)`);
  line(`    cited   ${JSON.stringify(b.cited)} -> ${JSON.stringify(aEmpty.cited)}   (retry still empty — §٢/٤)`);
  line(`    cards   ${b.cards} -> ${aCited.cards}  /  ${b.cards} -> ${aEmpty.cards}`);
  line(`    model calls  ${b.modelCalls} -> ${aCited.modelCalls}  (+${aCited.modelCalls - b.modelCalls}) in BOTH outcomes`);
  line(`    paid search calls added: 0 — the retry call carries no tools key at all`);
  line(`    the first answer survives the empty retry byte for byte: `
    + `${aEmpty.answerSha === b.answerSha ? 'YES' : 'NO — ' + aEmpty.answerSha + ' vs ' + b.answerSha}`);
  line('');
  line('    NOTE ON `retrieved`. Production measured 4 rows; this harness measures '
    + `${b.retrieved}, because \`search_sources\`'s web half needs BRAVE_API_KEY and finds nothing`);
  line('    without one. The trigger is `retrieved > 0`, so the mechanism is unaffected; the count is not.');
  line('');

  // ── AND WHY `cards` DID NOT MOVE WITH `cited` — WHICH IS §٤'s MECHANISM ─────
  // The citation step and the card step are two different steps, and this harness happens to
  // separate them cleanly: offline the ONLY evidence available is the Kuwaiti encyclopedia, whose
  // rows carry no page at all. So a citation that lands perfectly still buys no card, and nothing
  // anywhere says so — `pickReaderCards` short-circuits on `row.url` BEFORE `buildSourceTag`, so
  // even the `[card] drop empty-url` line never prints. That is the second of §٤'s two candidates,
  // measured here rather than inferred.
  const citedRun = await drive(shipped.module, RETRY_CITED);
  const evidence = citedRun.turn.evidence || [];
  line('--- the card step, separated from the citation step (this is §٤\'s mechanism)');
  line(`    rows in the table: ${evidence.length}`);
  for (const r of evidence) {
    line(`      ref ${r.ref}  kind=${r.kind}  url=${r.url ? r.url : '(none)'}  publisher=${r.publisher}`);
  }
  const withUrl = evidence.filter((r) => r.url).length;
  line(`    rows carrying a page: ${withUrl} of ${evidence.length}`);
  line(`    cards from the turn's own cited rows            : `
    + `${shipped.module.pickReaderCards(citedRun.turn.cited, 3, tagOf).length}`);
  // The SAME cited count, one row given a page. The only variable is the link.
  const linked = (citedRun.turn.cited || []).map((r, i) => ({
    ...r, url: i === 0 ? 'https://binbaz.org.sa/fatwas/1538' : r.url,
  }));
  line(`    cards from the same rows with ONE page attached : `
    + `${shipped.module.pickReaderCards(linked, 3, tagOf).length}`);
  line('    => the citation step works and the card step drops it. Two mechanisms, one symptom.');
  line('    (§٤ names that second step and is measured on its own: tools/card-drop-measure.mjs)');
} finally {
  before.cleanup();
  shipped.cleanup();
}
