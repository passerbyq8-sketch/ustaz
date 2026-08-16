// lib/free-brain/tools.js — THE THREE TOOLS THE MODEL MAY CALL, AND WHAT THEY ACTUALLY SEARCH.
//
// ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
// The shipped path has ONE tool, `search_islamic_sources`, and on the DEEN route it is FORCED:
// `tool_choice: {type:'tool'}`, every religious turn, whatever the question. The model never gets
// to decide that a question needs two different searches, or that the first wording failed, or
// that this particular sentence needs the news and not a fatwa. The retrieval terms are not its
// words either — they come from `planAsk().topic`, which is the reader's sentence with an
// attribution frame stripped off the front and then capped at 240–360 characters downstream.
//
// ── WHAT THE THREE ARE, MEASURED ─────────────────────────────────────────────
//   search_fatawa   lib/fatwa-service.js over lib/fatwa-contract.js's roster — 18 rows summing to
//                   73,130 published records (18,479 ابن باز · 17,875 سعد الماجد · 13,343 ابن
//                   عثيمين · … · 4 ابن جبرين). A record here is a PUBLISHED FATWA: an identified
//                   scholar answering a stated question at a citable URL.
//   search_sources  lib/retrieve.js over the band's approved sharia list, PLUS the Kuwaiti fiqh
//                   encyclopedia in lib/data/fiqh-search.json.gz — measured 3,070 records.
//   search_live     lib/retrieve.js's world passes (Brave), for news, weather, prices, anything
//                   that changed after training.
//
// ── THE ORDER IS ADVICE, NOT A GATE ──────────────────────────────────────────
// §٣ orders fatwa → sources → live for a fiqh question, and the model is TOLD that in
// ./instructions.js. It is not enforced here, because enforcing it is what produced the defect:
// a rule that fires before the question is understood. The model may call any tool at any time;
// what it may not do is answer a fiqh question without having searched, and that is the output
// checker's business (branch ب), not this file's.
//
// ── EVERY RESULT CARRIES ITS IDENTITY ────────────────────────────────────────
// title · url · who published it · and a stable `ref` the model cites by. The `ref` is the whole
// mechanism behind «البطاقة تتبع الاستشهاد لا الاسترجاع»: retrieval fills a table, and only the
// rows the finished answer actually cites become source cards. See ./loop.js's `collectCited`.
//
// ── WHAT IS DELIBERATELY NOT RELAXED ─────────────────────────────────────────
// `band` still selects the source allow-list (khilaf-policy §6), so a minor's search still runs
// against the minor list and `safesearch` is still strict for a minor on the open web. The free
// brain frees the model's DECISIONS; it does not widen a child's sources by a single domain.

import { searchFatwas } from '../fatwa-service.js';
import { searchStoredCorpus } from '../encyclopedia.js';
import { resolveFatwaScholar } from '../fatwa-contract.js';

// Bounds. Not money limits — §٣ parks the spend ceiling for this round — but shape limits: a
// model handed forty results reads none of them, and an unbounded loop is not a loop.
export const MAX_TOOL_ROUNDS = 6;
// ── RAISED 4 -> 10 BY OWNER ORDER, جولة «القياس بالحقيقيّ» (٢٠٢٦-٠٨-١٦) ──────
// MEASURED, not chosen. On the twenty-question message claude-opus-4-8 emitted TEN search_fatawa
// calls in a SINGLE round — one per distinct مسألة — and the ceiling of four executed the first
// four and refused six. The refusals were not silent (see the cap branch in ./loop.js), so the
// model opened its reply by telling the reader it had run out of searches: honest, and still an
// answer built on 40% of what it asked for. Twenty questions structurally need twenty lookups;
// ten is what the model actually requested, so ten is what it gets.
//
// IT CANNOT REACH THE SHIPPED PATH. Nothing outside lib/free-brain/ imports this module, and the
// free path is itself behind FREE_BRAIN_V1 (./flag.js), which is OFF in production.
export const MAX_CALLS_PER_TOOL = 10;
export const MAX_RESULTS_PER_CALL = 5;
const SNIPPET_CHARS = 1200;

// ── THE OUTPUT BUDGET THIS PATH SENDS FOR ITSELF ─────────────────────────────
// MEASURED, and it is the entire reason م-٨ returned nothing to the reader on 2026-08-16.
//
// EXTENDED THINKING IS ON BY DEFAULT AND NOTHING BOUNDED IT. ./loop.js sends no `thinking` field,
// so the provider default applies and thinking is drawn from the SAME max_tokens pool as the
// prose. Measured with two identical bodies differing only in that field: absent -> content blocks
// ["thinking","text"] with usage.output_tokens_details.thinking_tokens > 0; {type:'disabled'} ->
// ["text"] with 0. The shipped path disables thinking only on its 16- and 8-token classifier and
// judge calls (api/ask.js:399, :3046); this loop inherited nothing from them.
//
// WHAT THAT COST: on the twenty-question message claude-sonnet-5 spent 4096 of 4096 output tokens
// on thinking in round 1, and again in the tools-removed fallback, emitting NO text block and no
// tool_use block either time. textOf() reads only `text` blocks, so the answer came back empty and
// emitOnce fell through to FREE_BRAIN_EMPTY. Reproduced identically on two independent runs.
//
// THE VALUE IS DERIVED, NOT PICKED. Given a ceiling high enough not to bind, the same model
// answered the same twenty and stopped on its own at 4,870 output tokens — 3,167 of them thinking.
// A full twenty-heading answer measured 5,100 characters of prose (claude-opus-4-8, itself still
// truncated at 4096), which at the measured 1.25–1.48 Arabic characters per prose token is
// ~4,100–4,500 tokens. 3,167 + ~4,500 ≈ 7,700, and 8,192 is the next power of two above it.
//
// WHY NOT RAISE MAX_CHAT_TOKENS: that constant is shared with the old path and would move every
// answer in the application. This one is read only by ./loop.js.
export const FREE_BRAIN_MAX_TOKENS = 8192;

const clean = (value, cap) => String(value == null ? '' : value)
  .replace(/\s+/gu, ' ').trim().slice(0, cap);

// ── THE DECLARATIONS THE PROVIDER SEES ───────────────────────────────────────
// The descriptions are in Arabic because the model is answering in Arabic and reasoning about
// Arabic material; a tool described in English and used in Arabic is one translation away from
// being called for the wrong reason.
export const FREE_BRAIN_TOOLS = Object.freeze([
  {
    name: 'search_fatawa',
    description: 'ابحثْ في فتاوى العلماء المنشورة (١٨ عالمًا · أكثر من ٧٣٠٠٠ فتوى منشورة بأسمائها وروابطها: ابن باز، ابن عثيمين، سعد الماجد، عبدالرحمن البراك، صالح الفوزان، المنجد، الإفتاء الكويتية وغيرهم). هذه أقوى أداةٍ للسؤال الفقهيِّ والشرعيّ، لأنّ كلَّ نتيجةٍ فتوى منشورةٌ لعالمٍ معيَّنٍ برابطٍ يستطيع السائلُ فتحَه. ابدأْ بها في كلِّ مسألةٍ شرعيّة. وإن لم تُجبْك النتيجةُ الأولى فأعِدْ صياغةَ البحث بألفاظٍ أخرى (مثلًا: «تغطية الوجه» ثمّ «النقاب» ثمّ «ستر وجه المرأة»).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ألفاظُ البحث بالعربيّة. اكتبْها أنت بما يناسب المسألة، ولا تنسخْ سؤالَ السائلِ كما هو إن كان طويلًا.' },
        scholar: { type: 'string', description: 'اسمُ عالمٍ بعينِه إن كان السائلُ سأل عن رأيه هو تحديدًا. اتركْه فارغًا للبحث عند الجميع.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_sources',
    description: 'ابحثْ في المصادر الشرعيّة المعتمدة وفي الموسوعة الفقهيّة الكويتيّة (٣٠٧٠ مصطلحًا فقهيًّا محرَّرًا). استعمِلْها للتأصيل والتعريفات والأدلّة وأقوال المذاهب، وللمسائل التي لا تجدُ فيها فتوى منشورةً بعينِها. مناسبةٌ أيضًا للتفسير والحديث والسيرة.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ألفاظُ البحث بالعربيّة، تكتبُها أنت.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_live',
    description: 'ابحثْ في الإنترنت الآن للأمورِ المتغيّرة: خبرُ اليوم، الطقس، الأسعار، نتيجةُ مباراة، رقمٌ يتغيّر، أو أيُّ شيءٍ حدث بعد معرفتك. لا تستعمِلْها لاستنباطِ حكمٍ شرعيّ — المصادرُ العامّة لا يُؤخذُ منها حكم. وفي المسألةِ الشرعيّة لا تلجأْ إليها إلا بعد أن تُجرِّبَ أداتَي الفتاوى والمصادر.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ألفاظُ البحث. اكتبْها بالعربيّة إلا أن يكونَ الموضوعُ أجنبيًّا فيصلحُ فيه اللفظُ الأجنبيّ.' },
      },
      required: ['query'],
    },
  },
]);

export const FREE_BRAIN_TOOL_NAMES = Object.freeze(FREE_BRAIN_TOOLS.map((tool) => tool.name));

// ── THE RESULT TABLE ─────────────────────────────────────────────────────────
// One growing list for the whole turn, so a `ref` is unique across every call of every tool and
// the model can cite something it found three rounds ago.
export function createEvidenceTable() {
  const rows = [];
  return {
    rows,
    /** @returns {object} the row, with its assigned ref */
    add(row) {
      const existing = rows.find((item) => item.url && item.url === row.url);
      if (existing) return existing;
      const stored = { ...row, ref: rows.length + 1 };
      rows.push(stored);
      return stored;
    },
    byRef(ref) { return rows.find((row) => row.ref === Number(ref)) || null; },
  };
}

// What the model reads back after a call. Identity first, then the material — because the identity
// is the part it must carry into the answer, and a model reads the top of a block most reliably.
function renderRows(added) {
  if (!added.length) return 'لا نتائج.';
  return added.map((row) => [
    `[[${row.ref}]] ${row.title || '(بلا عنوان)'}`,
    row.publisher ? `المصدر: ${row.publisher}` : '',
    row.url ? `الرابط: ${row.url}` : '',
    row.text ? `النص: ${row.text}` : '',
  ].filter(Boolean).join('\n')).join('\n\n───\n\n');
}

// ── search_fatawa ────────────────────────────────────────────────────────────
async function runFatawa(input, ctx) {
  const query = clean(input.query, 240);
  if (!query) return { text: 'لا نتائج.', added: [], calls: 0 };
  const named = clean(input.scholar, 80);
  // The roster's own resolver, so a name the fatwa service does not hold cannot silently narrow
  // the search to nothing — an unresolved name simply searches everybody.
  const scholar = named ? resolveFatwaScholar(named, '') : null;

  let out;
  try {
    out = await searchFatwas({
      resolvedTopic: query,
      currentQuestion: query,
      resolvedScholar: scholar ? { id: scholar.canonicalId, display: scholar.name } : null,
    }, { signal: ctx.signal, fetchImpl: ctx.fetchImpl });
  } catch (error) {
    ctx.degraded.push(`fatwa:${String(error?.message || error)}`);
    return { text: 'تعذّر الوصولُ إلى قسم الفتاوى الآن.', added: [], calls: 0 };
  }

  const added = (out.records || []).slice(0, MAX_RESULTS_PER_CALL).map((record) => ctx.table.add({
    kind: 'fatwa',
    title: clean(record.title, 200),
    url: record.url || '',
    publisher: record.publisher || '',
    scholarId: record.scholarId || '',
    // The published question AND the published answer — this is a fatwa, and the question it
    // answers is half of what makes it the right fatwa or the wrong one.
    text: clean([record.question ? `السؤال المنشور: ${record.question}` : '', record.answer || ''].filter(Boolean).join(' — '), SNIPPET_CHARS),
    passage: record.passage || '',
    recordId: record.id || '',
  }));
  return { text: renderRows(added), added, calls: Number(out.calls || 0) };
}

// ── search_sources ───────────────────────────────────────────────────────────
async function runSources(input, ctx) {
  const query = clean(input.query, 240);
  if (!query) return { text: 'لا نتائج.', added: [], calls: 0 };

  // The encyclopedia is in-process and free, so it always runs; the web pass is the paid half.
  const added = [];
  try {
    const enc = await searchStoredCorpus(query, { limit: 3 });
    for (const record of (enc.records || []).slice(0, 3)) {
      added.push(ctx.table.add({
        kind: 'encyclopedia',
        title: `الموسوعة الفقهية الكويتية — ${record.term}`,
        url: '',
        publisher: 'الموسوعة الفقهية الكويتية',
        text: clean(record.snippet, SNIPPET_CHARS),
        recordId: record.id || '',
      }));
    }
  } catch (error) {
    ctx.degraded.push(`encyclopedia:${String(error?.message || error)}`);
  }

  let calls = 0;
  try {
    // Imported lazily for the reason api/ask.js states at its own head: this module pulls
    // linkedom/Readability, and a turn that never searches the web must not pay for loading them.
    const { retrieve } = await import('../retrieve.js');
    const pass = await retrieve(query, {
      band: ctx.band === 'adult' ? 'adult' : 'minor',
      dailyBudget: ctx.dailyBudget,
      signal: ctx.signal,
    });
    calls = 1;
    for (const source of (pass.sources || []).slice(0, MAX_RESULTS_PER_CALL)) {
      added.push(ctx.table.add({
        kind: 'source',
        title: clean(source.title, 200),
        url: source.url || '',
        publisher: clean(source.publisher || source.siteName || '', 120),
        text: clean(source.passage || source.text || '', SNIPPET_CHARS),
        passage: source.passage || '',
      }));
    }
    if (Array.isArray(pass.injectionMarkers) && pass.injectionMarkers.length) {
      ctx.injectionMarkers.push(...pass.injectionMarkers);
    }
  } catch (error) {
    ctx.degraded.push(`sources:${String(error?.message || error)}`);
  }
  return { text: renderRows(added), added, calls };
}

// ── search_live ──────────────────────────────────────────────────────────────
async function runLive(input, ctx) {
  const query = clean(input.query, 240);
  if (!query) return { text: 'لا نتائج.', added: [], calls: 0 };

  let calls = 0;
  const added = [];
  try {
    const { retrieveWorld, retrieveOpenWorld } = await import('../retrieve.js');
    // The vetted general list first — it returns cleaned page text. The open web is the fallback,
    // and it returns provider titles and snippets, which is a weaker thing and is labelled so in
    // ./instructions.js.
    let pass = await retrieveWorld(query, {
      band: ctx.band, dailyBudget: ctx.dailyBudget, signal: ctx.signal,
    });
    calls += 1;
    let open = false;
    if (!pass || !(pass.sources || []).length) {
      pass = await retrieveOpenWorld(query, { band: ctx.band, dailyBudget: ctx.dailyBudget });
      calls += 1;
      open = true;
    }
    for (const source of (pass?.sources || []).slice(0, MAX_RESULTS_PER_CALL)) {
      added.push(ctx.table.add({
        kind: open ? 'live_open' : 'live',
        title: clean(source.title, 200),
        url: source.url || '',
        publisher: clean(source.publisher || source.host || '', 120),
        text: clean(source.passage || source.snippet || source.text || '', SNIPPET_CHARS),
        passage: source.passage || '',
      }));
    }
    if (Array.isArray(pass?.injectionMarkers) && pass.injectionMarkers.length) {
      ctx.injectionMarkers.push(...pass.injectionMarkers);
    }
  } catch (error) {
    ctx.degraded.push(`live:${String(error?.message || error)}`);
  }
  return { text: renderRows(added), added, calls };
}

const RUNNERS = { search_fatawa: runFatawa, search_sources: runSources, search_live: runLive };

/**
 * Execute one tool_use block.
 *
 * NEVER THROWS. A retrieval failure is material the model must be told about — «تعذّر الوصول» is
 * an answerable fact — and a throw here would lose the whole turn over one unreachable host.
 */
export async function runTool(name, input, ctx) {
  const runner = RUNNERS[name];
  if (!runner) return { text: 'أداةٌ غير معروفة.', added: [], calls: 0 };
  const started = Date.now();
  const out = await runner(input && typeof input === 'object' ? input : {}, ctx);
  ctx.spend.push({
    tool: name,
    query: clean((input && input.query) || '', 200),
    results: out.added.length,
    providerCalls: out.calls,
    ms: Date.now() - started,
  });
  return out;
}
