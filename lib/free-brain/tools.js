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
import { searchLibrary } from '../lib-service.js';

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
//
// ── 8192 WAS TRIED AND MEASURED WRONG. REVERTED TO 4096 ─────────────────────
// Raising the ceiling bought THINKING, not prose, because both draw from one pool and thinking is
// ADAPTIVE — it expands to fill whatever it is given. Measured on the same message at three
// ceilings: 4096 -> 21 thinking tokens, 8192 -> a round that spent 8192 of 8192 thinking and
// emitted no text at all, 16000 -> 3167. And the run that got the extra room took 299,556ms, which
// is 99.85% of the 300,000ms function ceiling in vercel.json. Coverage over two runs at 8192 was
// 9/20 and 3/20 (topics, diacritics folded), against 20/20 for claude-opus-4-8 at 4096. So the
// binder was never the size of the pool; it was that nothing divided it. The division is done by
// FREE_BRAIN_THINKING below, and ONLY once it was done did extra room become worth buying.
//
// ── 6144, AND WHY THAT NUMBER AND NOT A DOUBLING ────────────────────────────
// The 8192 condemnation was CONDITIONAL on unbounded thinking, and that condition is gone: with
// thinking disabled every additional token is prose, so the earlier failure mode cannot recur.
//
// MEASURED rather than doubled. Given a ceiling high enough not to bind (16000), the writing round
// spent 4,769 tokens and stopped on `end_turn` of its own accord — that is the real demand, not an
// estimate — producing 6,902 characters at a measured 1.45 Arabic characters per token, covering
// 20/20 with 10 cards in 103,294ms. Runs pinned at 4096 clipped mid-sentence at 5,707–6,043
// characters, so the shortfall was roughly 670 tokens.
//
// 6144 is 1.5x the shipped ceiling and sits 29% above the measured 4,769, which covers the spread
// actually observed across runs (prose ran 5,707–6,902 characters) without handing back the room
// that adaptive thinking previously ate. It is a per-CALL ceiling, not a per-turn budget: the tool
// rounds spend 337–644 tokens each and are nowhere near it, so this buys the write and nothing
// else.
//
// AND IT IS BOUNDED BY THE CLOCK, NOT ONLY BY ITSELF: FREE_BRAIN_TOOL_PHASE_MS below still caps the
// tool phase, so a larger write cannot buy back the 299,556ms near-timeout that condemned 8192.
export const FREE_BRAIN_MAX_TOKENS = 6144;

// ── HOW THE POOL IS DIVIDED, WHICH IS THE ACTUAL FIX ────────────────────────
// `thinking: {type:'enabled', budget_tokens:N}` IS NOT AVAILABLE ON THIS MODEL. The provider
// rejects it with HTTP 400: «"thinking.type.enabled" is not supported for this model. Use
// "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.» So a numeric
// thinking budget cannot be the mechanism, and the floor has to be bought another way.
//
// MEASURED at a fixed 4096 ceiling on the twenty-question message, coverage counted by topic:
//   no thinking field (today)  1829 thinking / 1709 prose  20/20   <- but see the real loop below
//   thinking adaptive             0 thinking / 1995 prose  20/20
//   adaptive + effort low         0 thinking / 1635 prose  19/20
//   adaptive + effort medium     19 thinking / 2340 prose  20/20
//   thinking disabled             0 thinking / 2241 prose  20/20   <- most prose of any variant
//
// A BARE PROBE DOES NOT REPRODUCE THE FAILURE, and that is the point worth writing down: with a
// short system prompt and no tools, every variant above finished on end_turn. The free path
// carries the full persona prompt, three tool declarations and every tool_result, and in THAT
// context adaptive thinking took the entire ceiling twice in a row and returned FREE_BRAIN_EMPTY.
// Thinking scales with how much there is to think about, so the only guarantee that survives a
// context this large is not a smaller share — it is a share of zero.
//
// DISABLED IS THEREFORE THE DEFAULT ON THIS PATH, and it gives prose a floor of the whole ceiling
// rather than a negotiated fraction of it. It is a flag, not a law: adaptive and the effort tiers
// are one environment write away for whoever wants to trade coverage for deliberation.
export const FREE_BRAIN_THINKING_DEFAULT = 'off';

// ── THE WALL CLOCK ───────────────────────────────────────────────────────────
// MEASURED, not calculated: one twenty-question run finished at 299,556ms against the 300,000ms
// maxDuration in vercel.json — 444ms of margin. At the ceiling the platform kills the function and
// the reader gets nothing, which is strictly worse than an incomplete answer, because the work is
// already paid for by then.
//
// So the tool phase gets a deadline and the writing round gets the remainder. 210,000ms is 70% of
// the ceiling, and the reserve it leaves (90,000ms) is comfortably above every writing round this
// round measured: the tools-removed calls ran 27–48s, and the slowest observed round of any kind
// was 67.8s. Crossing it does not abort the turn — it stops NEW tool rounds and goes straight to
// the write, so the reader gets the best answer available instead of a dead socket.
export const FREE_BRAIN_TOOL_PHASE_MS = 210000;

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
  {
    name: 'search_library',
    description: 'بحثٌ في مكتبةٍ من كتبِ أهلِ العلمِ المطبوعة — متونٍ وشروحٍ ومطوّلاتٍ فقهيّة. اطلبْها ابتداءً مع search_fatawa في كلِّ مسألةٍ فقهيّةٍ مركّبةٍ لا فتوى جاهزةً لها، وفي كلِّ ما يحتاجُ تعليلًا أو تأصيلًا أو تفصيلَ خلافٍ بينَ أهلِ العلم، ولا تنتظرْ عجزَ الأدواتِ الأخرى. وتُطلَبُ ابتداءً وقبلَ غيرِها إذا سُئِلتَ عن قولِ عالمٍ متقدّمٍ بعينِه (كابنِ تيميّةَ وابنِ قدامةَ والنوويّ)، أو عن مذهبِ مذهبٍ من المذاهبِ الأربعةِ في مسألة، فهذانِ جوابُهما في الكتبِ لا في الفتاوى المعاصرة. ولا تُطلَبُ فيما ليس مسألةً شرعيّة: لغزٌ أو حسابٌ أو خبرٌ أو سؤالٌ عامّ. وما يردُ منها كلامُ عالمٍ في كتابٍ لا فتوى مسنَدةً لسائل، فيُستفادُ منه فهمًا وتأصيلًا ولا يُبنى عليه حكمٌ وحدَه دونَ فتوى. ولا رابطَ لها يُفتَح: يُذكَرُ اسمُ الكتابِ ومؤلِّفُه.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'عبارةُ البحثِ بالعربيّةِ الفصحى بألفاظِ أهلِ العلمِ كما تردُ في الكتب.' },
      },
      required: ['query'],
    },
  },
]);

export const FREE_BRAIN_TOOL_NAMES = Object.freeze(FREE_BRAIN_TOOLS.map((tool) => tool.name));

// ── THE RESULT TABLE ─────────────────────────────────────────────────────────
// One growing list for the whole turn, so a `ref` is unique across every call of every tool and
// the model can cite something it found three rounds ago.
//
// ── AND EVERY ROW IS STAMPED WITH WHEN IT ARRIVED ───────────────────────────
// MEASURED, and it is the third of the merge round's three broken wires. The output reviewer
// refuses a CHANGING general claim — today's weather, today's news, a price — unless the evidence
// behind it carries a date (`dynamicEvidenceFor` in lib/output-reviewer.js). Nothing in
// lib/retrieve.js returns one: neither `retrieveWorld` nor `retrieveOpenWorld` produces a
// published-date field on any source, on any pass. So with no date on any row, EVERY live claim
// this path can make would have been replaced by «لم يصلني مصدرٌ مؤرّخ…» — the search would run,
// the page would be fetched, and the answer would still say nothing arrived.
//
// THE DATE IS THE RETRIEVAL DATE AND IS NAMED AS ONE. It is not a publication date and must never
// be presented as one: it is the day this turn actually fetched the page, which is exactly the
// fact a reader needs in order to judge a changing claim («this is what the source said today»).
// The reviewer's own contract anticipates it — `evidenceView` reads `retrievedAt`/`retrieved_at`
// as date fields alongside `publishedAt` — so this stamps the field it was built to read.
const ROW_RETRIEVED_AT = () => new Date().toISOString().slice(0, 10);

export function createEvidenceTable() {
  const rows = [];
  return {
    rows,
    /** @returns {object} the row, with its assigned ref */
    add(row) {
      const existing = rows.find((item) => item.url && item.url === row.url);
      if (existing) return existing;
      const stored = { ...row, ref: rows.length + 1, retrievedAt: ROW_RETRIEVED_AT() };
      rows.push(stored);
      return stored;
    },
    byRef(ref) { return rows.find((row) => row.ref === Number(ref)) || null; },
  };
}

// What the model reads back after a call. Identity first, then the material — because the identity
// is the part it must carry into the answer, and a model reads the top of a block most reliably.
//
// EXPORTED, AND ITS BODY IS UNTOUCHED. lib/free-brain/loop.js offers stored rows before the first
// provider call (S1/§١) and must render them in the SAME shape a requested call renders, down to
// the marker. A second renderer would be a second format for one contract, and the loop would be
// teaching the model a citation marker this file did not hand out.
export function renderRows(added) {
  if (!added.length) return 'لا نتائج.';
  return added.map((row) => [
    `[[${row.ref}]] ${row.title || '(بلا عنوان)'}`,
    row.publisher ? `المصدر: ${row.publisher}` : '',
    row.url ? `الرابط: ${row.url}` : '',
    row.text ? `النص: ${row.text}` : '',
  ].filter(Boolean).join('\n')).join('\n\n───\n\n');
}

// ── AA-53: THE LOCATOR IS RENDERED IN ONE PLACE, FROM ITS PARTS ─────────────
//
// `runLibrary` below composed «ج١ · ص١٤٧-١٥٠» inline and handed the reader nothing else. When
// lib/free-brain/loop.js merges three slices of ONE book into ONE card it has to name every place
// that book was found, and to do that it must be able to say «ص١٤٧-١٥٠ and ص٢٠٧-٢٠٨» — which means
// composing a locator a second time, from a span it computed itself.
//
// A SECOND COMPOSER WOULD BE A SECOND FORMAT for one reader-visible string, and the first drift
// between them would put two spellings of one place on one screen. So the composition is exported
// and `runLibrary` uses it too: there is exactly one renderer, and the merge calls the same one.
//
// IT STILL DERIVES NOTHING. An absent volume yields no volume, an absent page yields no page, and
// a span whose two pages are equal prints ONE page — the rule this file has always had, moved and
// not rewritten. The parts arrive already gated twice (lib/lib-service.js drops them unless the
// service called the page citable; `runLibrary` drops them again when the numbering is automatic),
// so this function never asks whether a page may be printed. It only prints what it was handed.
export function renderBookLocator(span) {
  const volume = span && span.volume ? `ج${span.volume}` : '';
  const start = span && span.pageStart ? String(span.pageStart) : '';
  const end = span && span.pageEnd ? String(span.pageEnd) : '';
  const page = start && end && start !== end ? `ص${start}-${end}` : (start ? `ص${start}` : '');
  return [volume, page].filter(Boolean).join(' · ');
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

/** The name the loop imports it under: unambiguous at a distance from this file. */
export const renderEvidenceRows = renderRows;

// -- search_library ----------------------------------------------------------
// The library is a NETWORK call behind a flag and a token, so unlike the encyclopedia it does not
// run for free on every turn. api/ask.js decides eligibility and hands the flag value and the token
// down through ctx; this module reads no environment of its own, exactly as lib/lib-service.js was
// built to be driven. searchLibrary refuses before it builds a request when the flag it was handed
// is not on, so a mistake here cannot light up a network call, and it never throws.
//
// A BOOK CARRIES NO URL. url stays empty on purpose: the row is attribution, not a link the reader
// can open. Volume and page travel ONLY when the record itself carries them, because an
// auto-numbered atom has no printed page and a page nobody can look up is never invented.
async function runLibrary(input, ctx) {
  const query = clean(input.query, 240);
  if (!query) return { text: 'لا نتيجة', added: [], calls: 0 };
  if (ctx.libFlagValue !== 'on' || !ctx.libToken) {
    return { text: 'المكتبة غير متاحة في هذا الطور', added: [], calls: 0 };
  }

  let out;
  try {
    out = await searchLibrary(query, {
      flagValue: ctx.libFlagValue,
      token: ctx.libToken,
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
    });
  } catch (error) {
    ctx.degraded.push(`library:${String(error?.message || error)}`);
    return { text: 'تعذّر الوصول إلى المكتبة', added: [], calls: 0 };
  }

  if (!out || out.ok !== true) {
    ctx.degraded.push(`library:${String(out && out.reason ? out.reason : 'unknown')}`);
    return { text: 'لا نتيجة من المكتبة', added: [], calls: 1 };
  }

  const added = (out.records || []).slice(0, MAX_RESULTS_PER_CALL).map((record) => {
    const prov = record.provenance || {};
    // ع-٤٩ — THE LOCATOR HAS TWO CONDITIONS, NOT ONE. lib/lib-service.js already drops volume and
    // pages unless the service said `page_citable`; the owner's rule adds the second half — an
    // AUTOMATICALLY numbered atom has no printed page, so it is given no page at all rather than a
    // plausible one. A number nobody can look up is a false citation, and silence is the safe
    // direction of the unknown here exactly as it is in lib/lib-source-card.js.
    const citable = prov.page_citable === true && prov.numbering !== 'auto';
    // AA-53 — THE SPAN IS THE PARTS AND `where` IS THE PRINTING OF THEM. Both travel: the string
    // because that is what a card shows, and the span because the merge in lib/free-brain/loop.js
    // has to ask «do these two slices sit on touching pages?» and a printed «ج١ · ص١٤٧-١٥٠» can
    // only be asked that by being taken apart again. Unpicking a composed string is exactly what
    // the note below `bookTitle` refuses to do, and for the same reason: the first malformed
    // locator would become a malformed decision.
    const span = {
      volume: citable && prov.volume ? String(prov.volume) : '',
      pageStart: citable && prov.page_start ? String(prov.page_start) : '',
      pageEnd: citable && prov.page_end ? String(prov.page_end) : '',
    };
    const where = renderBookLocator(span);
    return ctx.table.add({
      kind: 'lib_book',
      title: clean([prov.book_title || '', where].filter(Boolean).join(' · '), 200),
      url: '',
      publisher: clean(prov.author || '', 120),
      text: clean(record.text, SNIPPET_CHARS),
      recordId: record.id || '',
      // ع-٤٩ — THE CARD IS BUILT FROM THESE THREE AND NOT FROM THE WELDED TITLE ABOVE. A builder
      // that had to unpick «الكتاب · ج٩ · ص٧» back into its parts would be re-deriving what the
      // service already sent, and the first malformed title would become a malformed citation.
      // The parent corpus is deliberately absent: a reader is told the BOOK and its AUTHOR, never
      // the shelf the atom came off.
      bookTitle: clean(prov.book_title || '', 200),
      author: clean(prov.author || '', 120),
      locator: where,
      // AA-53 — and the same place in parts, so the merge can compare two of them numerically.
      // It is NOT a second locator: `locator` above is what any reader ever sees, and this is the
      // arithmetic behind it.
      locatorSpan: span,
      // ع-٤٩/د١ — AND WHETHER THIS PASSAGE IS THE WHOLE OF WHAT ARRIVED. The reader is about to
      // be shown this matn, so a cut has to travel with it: `clean` above caps at SNIPPET_CHARS
      // and says nothing, and the SERVICE may have cut before us and said so in `truncated`,
      // which lib/lib-service.js records and this row was dropping on the floor. Either cut is
      // the same fact to a reader — «what you are looking at is not all of it» — so they are one
      // flag, and it is the row that carries it because the row is what the card is built from.
      matnCut: record.truncated === true || clean(record.text, Infinity).length > SNIPPET_CHARS,
    });
  });
  return { text: renderRows(added), added, calls: 1 };
}

const RUNNERS = { search_fatawa: runFatawa, search_sources: runSources, search_live: runLive, search_library: runLibrary };

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
