// guards/live-world-v2-killswitch-guard.cjs
// ONE SWITCH, AND WITH IT OFF THE APP IS THE APP THAT WAS MEASURED WORKING.
//
// ── WHAT THIS GATE IS FOR ────────────────────────────────────────────────────
// The 2026-09-19 live-world round changed the classifier, the world source list, the system
// prompt and the printed answer. The owner's condition for shipping any of it was a single
// environment variable that returns the app to the behaviour it had the day before — «المخرجَ
// مع الإطفاءِ مطابقٌ بايتًا ببايتٍ لسلوكِ ما قبلَ الجولة».
//
// A kill switch nobody tests is a promise. This gate is the test, and it has four parts:
//
//   A. THE SWITCH ITSELF — absence is off, nonsense is off, and only a declared spelling is on.
//   B. ONE READER — `LIVE_WORLD_V2` appears in exactly one shipped file. A flag read in two
//      places is two flags, and a kill switch that can half-fire is worse than none.
//   C. OFF IS THE OLD BEHAVIOUR, BYTE FOR BYTE — a 46-question battery whose expected verdicts
//      were MEASURED ON THE PRE-ROUND COMMIT `35a0e84` and are pinned below as the exact strings
//      that commit produced; plus the world source list; plus the shape of every call site.
//   D. ON IS A DIFFERENT BEHAVIOUR — because a switch that changes nothing would pass C too.
//
// AND E: THE GATE IS RUN AGAINST ITSELF. Section C is re-run with the flag forced on, and it
// must FAIL. Without that, a typo that made check C always true would look exactly like a
// kill switch that works.
//
// Usage: node guards/live-world-v2-killswitch-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want),
  'got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));

// The flag is read per call, so one process can drive both states. Everything that reads it is
// driven through these two helpers so no check can forget to put the environment back.
function withFlag(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'LIVE_WORLD_V2');
  const old = process.env.LIVE_WORLD_V2;
  if (value === undefined) delete process.env.LIVE_WORLD_V2;
  else process.env.LIVE_WORLD_V2 = value;
  try { return fn(); } finally {
    if (had) process.env.LIVE_WORLD_V2 = old; else delete process.env.LIVE_WORLD_V2;
  }
}

// ── THE PRE-ROUND BASELINE ───────────────────────────────────────────────────
// MEASURED by running classifyWorldIntent() from commit 35a0e84 — the tree as it stood before
// one line of this round was written — over the battery below, and recording
// `world + '|' + reason + '|' + matched` verbatim. These are not expectations somebody typed;
// they are the previous behaviour's own output. With the switch off the current tree must
// reproduce every one of them exactly, and a single differing character is a failing gate.
const PRE_ROUND = [
  ["كم يساوي الدولار مقابل الدينار الكويتي اليوم؟", "false|NONE|"],
  ["كم سعر جرام الذهب اليوم في الكويت؟", "true|MARKET_PRICE|سعر + ذهب"],
  ["ما آخر الأخبار الاقتصاديّة؟", "true|NEWS_PHRASE|اخر الاخبار"],
  ["كم تاريخ اليوم؟", "false|NONE|"],
  ["ما حكم بيع العينة؟", "false|REFUSED_RELIGIOUS|"],
  ["اشرح لي قانون أوم", "false|NONE|"],
  ["كم تساوي ١٥٪ من ٢٤٠؟", "false|NONE|"],
  ["ما آخر الأخبار السياسيّة؟", "true|NEWS_PHRASE|اخر الاخبار"],
  ["كم يساوي اليورو مقابل الريال السعودي؟", "false|NONE|"],
  ["كم سعر برميل النفط؟", "true|MARKET_PRICE|سعر + نفط"],
  ["من فاز في مباراة أمس؟", "true|NEWS_TERM|مباراه"],
  ["أي يوم في الأسبوع اليوم؟", "false|NONE|"],
  ["ما حكم التورّق المصرفيّ؟", "false|REFUSED_RELIGIOUS|"],
  ["اشرح لي قانون نيوتن الثاني", "false|NONE|"],
  ["كم تساوي ٢٥٪ من ٨٠٠؟", "false|NONE|"],
  ["وين أشتري خمر في الكويت؟", "false|NONE|"],
  ["ما حكم العمل في بنك ربويّ؟", "false|REFUSED_RELIGIOUS|"],
  ["ما حكم الأغاني؟ وأبغى آخر فتوى فيها هذا الأسبوع", "false|REFUSED_RELIGIOUS|"],
  ["كم الجنيه الإسترليني بالدرهم الإماراتي؟", "false|NONE|"],
  ["حوّل لي مئة دولار كم تصير بالدينار؟", "false|NONE|"],
  ["كم سعر صرف الدولار مقابل الدينار؟", "true|MARKET_PRICE|سعر + دولار"],
  ["كم سعر الدينار مقابل الدولار؟", "true|MARKET_PRICE|سعر + دولار"],
  ["شنو تاريخ اليوم؟", "false|NONE|"],
  ["الساعة كم الحين؟", "false|NONE|"],
  ["أي يوم هذا؟", "false|NONE|"],
  ["كم الساعة في الكويت؟", "false|NONE|"],
  ["كم درجة الحرارة اليوم في الكويت؟", "true|WEATHER|درجه الحراره"],
  ["شنو الطقس اليوم؟", "true|WEATHER|طقس"],
  ["هل تمطر بكرة؟", "true|WEATHER|تمطر"],
  ["كم سعر الذهب اليوم؟", "true|NEWS_PHRASE|سعر الذهب"],
  ["ما آخر أخبار غزة؟", "true|NEWS_TERM|اخبار"],
  ["ما الجديد في الرياضة؟", "true|NEWS_PHRASE|ما الجديد"],
  ["ما نتائج مباريات أمس؟", "true|NEWS_TERM|مباريات"],
  ["ابحث في الانترنت عن أسعار السيارات", "true|EXPLICIT_SEARCH|ابحث في الانترنت"],
  ["ما رأي وزير النفط في خفض الإنتاج؟", "true|ATTRIBUTED_POSITION|named-position"],
  ["ماذا حدث في 2026 في الكويت؟", "true|RECENT_YEAR|year"],
  ["ما عاصمة الكويت؟", "false|NONE|"],
  ["من هو ابن تيمية؟", "false|NONE|"],
  ["اشرح لي معنى التوكل", "false|REFUSED_RELIGIOUS|"],
  ["كم ركعة في صلاة الفجر؟", "false|REFUSED_RELIGIOUS|"],
  ["عندي مئة دينار كم أشتري بها؟", "false|NONE|"],
  ["ما هو اليوم العالمي للغة العربية؟", "false|NONE|"],
  ["كم شهر في السنة الميلادية؟", "false|NONE|"],
  ["أي شهر أفضل للسفر إلى تركيا؟", "false|NONE|"],
  ["ما حكم صيام يوم عرفة؟", "false|REFUSED_RELIGIOUS|"],
  ["صف لي يوم القيامة", "false|REFUSED_RELIGIOUS|"],
];

// The rows the round is ALLOWED to move, and the only ones. Anything else moving is a defect
// whichever direction it moves in.
const EXPECTED_MOVES = {
  "كم يساوي الدولار مقابل الدينار الكويتي اليوم؟": "true|FX_RATE|دولار + دينار",
  "كم يساوي اليورو مقابل الريال السعودي؟": "true|FX_RATE|يورو + ريال",
  "كم الجنيه الإسترليني بالدرهم الإماراتي؟": "true|FX_RATE|جنيه + درهم",
  "حوّل لي مئة دولار كم تصير بالدينار؟": "true|FX_RATE|دولار + دينار",
  "كم تاريخ اليوم؟": "false|CLOCK_DATE|تاريخ اليوم",
  "شنو تاريخ اليوم؟": "false|CLOCK_DATE|تاريخ اليوم",
  "أي يوم في الأسبوع اليوم؟": "false|CLOCK_DATE|اي يوم في الاسبوع",
  "أي يوم هذا؟": "false|CLOCK_DATE|اي يوم هذا",
  "الساعة كم الحين؟": "false|CLOCK_DATE|الساعه كم",
  "كم الساعة في الكويت؟": "false|CLOCK_DATE|كم الساعه",
};

(async function main() {
  console.log('=== live-world-v2-killswitch-guard — one switch, and off is the old app ===');

  const FLAG = await esm('lib/live-world-v2.js');
  const WI = await esm('lib/world-intent.js');
  const REG = await esm('lib/source-registry.js');

  const verdict = (q) => {
    const r = WI.classifyWorldIntent(q);
    return r.world + '|' + r.reason + '|' + r.matched;
  };

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== A. the switch itself ===');
  // ══════════════════════════════════════════════════════════════════════════
  ok('lib/live-world-v2.js exports liveWorldV2Enabled', typeof FLAG.liveWorldV2Enabled === 'function');
  ok('...and names the variable once, as a value', FLAG.LIVE_WORLD_V2_FLAG === 'LIVE_WORLD_V2');

  // ABSENCE IS OFF. This is the case a lost environment actually produces, and it is the one
  // that must not turn a round on.
  ok('an ABSENT variable is off', withFlag(undefined, () => FLAG.liveWorldV2Enabled() === false));
  for (const off of ['', ' ', '0', 'off', 'no', 'false', 'disabled', 'ON!', 'onn', 'y']) {
    ok('«' + off + '» is off', withFlag(off, () => FLAG.liveWorldV2Enabled() === false));
  }
  for (const on of ['1', 'on', 'ON', ' On ', 'true', 'TRUE', 'yes', 'enabled']) {
    ok('«' + on + '» is on', withFlag(on, () => FLAG.liveWorldV2Enabled() === true));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== B. exactly one reader, in the whole shipped tree ===');
  // ══════════════════════════════════════════════════════════════════════════
  {
    // IT IS THE *READ* THAT MUST BE UNIQUE, NOT THE NAME. Half a dozen modules mention the flag
    // in a comment, and they should — a reader of lib/source-registry.js is entitled to know why
    // worldSources() has a condition in it. What may not be duplicated is `process.env.<name>`:
    // that is the line that can disagree with another copy about what "off" means.
    const roots = ['lib', 'api', 'tools'];
    const readers = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
        const rel = dir + '/' + entry.name;
        if (entry.isDirectory()) { walk(rel); continue; }
        if (!/\.(js|cjs|mjs|jsx)$/.test(entry.name)) continue;
        const src = read(rel);
        if (/process\.env\.LIVE_WORLD_V2|process\.env\[['"]LIVE_WORLD_V2['"]\]/.test(src)) readers.push(rel);
      }
    };
    roots.forEach(walk);
    eq('`process.env.LIVE_WORLD_V2` is read in exactly one shipped file', readers, ['lib/live-world-v2.js']);
    const owner = read('lib/live-world-v2.js');
    ok('...and that file reads it exactly once',
      (owner.match(/process\.env\.LIVE_WORLD_V2/g) || []).length === 1);
    // Every other module that acts on the flag must go through the exported function, so there
    // is one definition of "on" and not two spellings of it.
    //
    // THE SECOND ORDER (2026-09-20) ADDED TWO MORE READERS AND ONE NON-READER. The ledger's source
    // policy and the free brain's instruction block both test the flag themselves and are listed
    // here. lib/free-brain/tools.js deliberately is NOT: it reaches the switch through
    // `asksLiveNumber`, which lib/world-intent.js owns and gates, so the tool layer has no flag
    // test of its own to keep in step. Section C asserts that wiring by name.
    for (const rel of ['lib/world-intent.js', 'lib/source-registry.js', 'api/ask.js',
      'lib/ledger/source-policy.js', 'lib/free-brain/instructions.js']) {
      ok(rel + ' reaches the flag through liveWorldV2Enabled()',
        /import \{ liveWorldV2Enabled \} from '[^']*live-world-v2\.js';/.test(read(rel))
        && read(rel).includes('liveWorldV2Enabled('));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== C. OFF is the pre-round behaviour, byte for byte ===');
  // ══════════════════════════════════════════════════════════════════════════
  const offDrift = withFlag(undefined, () => PRE_ROUND.filter(([q, want]) => verdict(q) !== want));
  eq('every one of the ' + PRE_ROUND.length + ' pre-round verdicts (measured on 35a0e84) is reproduced',
    offDrift.map(([q]) => q), []);

  eq('the world source list is the four it has always been',
    withFlag(undefined, () => REG.domainsForWorld()),
    ['ar.wikipedia.org', 'aljazeera.net', 'bbc.com', 'skynewsarabia.com']);

  {
    const RET = await esm('lib/retrieve.js');
    ok('...and lib/retrieve.js derives SITES_GENERAL from it rather than restating it',
      /export const SITES_GENERAL = domainsForWorld\(\);/.test(read('lib/retrieve.js'))
        && Array.isArray(RET.SITES_GENERAL));
  }

  // ── THE SECOND ORDER'S OWN "OFF" (2026-09-20) ──────────────────────────────
  // Three behaviours were added on 20 September and every one of them must be absent here.
  {
    const SPOL = await esm('lib/ledger/source-policy.js');
    const CANON = await esm('lib/ledger/canonical.js');
    // ع-١ — the three news rows. With the switch off the fetcher must refuse them exactly as it
    // has refused them since the world list shipped: no policy row, `not-an-admissible-url`.
    const newsOff = withFlag(undefined, () => ['aljazeera.net', 'bbc.com', 'skynewsarabia.com']
      .filter((d) => SPOL.policyFor(d) !== null || CANON.admissible('https://' + d + '/x') !== false));
    eq('the three world news hosts are still un-admissible to the fetcher', newsOff, []);
    eq('...and the searchable set is untouched by their rows',
      withFlag(undefined, () => SPOL.searchableDomains().length),
      withFlag('on', () => SPOL.searchableDomains().length));
    eq('...and the table still conforms to the shipped registry',
      withFlag(undefined, () => SPOL.conformanceProblems()), []);

    // ٢/٢ — the live-quantity rule answers NO to everything while the switch is off, including
    // the two classes that are live quantities in their own right.
    const liveOff = withFlag(undefined, () => [
      'كم سعر جرام الذهب اليوم في الكويت؟',
      'شنو الطقس اليوم؟',
      'كم يساوي الدولار مقابل الدينار الكويتي اليوم؟',
    ].filter((q) => WI.asksLiveNumber(q) !== false));
    eq('asksLiveNumber() is false for every question with the switch off', liveOff, []);

    // ٢/١ — the instruction block the free brain is given carries no new line.
    const INSTR = await esm('lib/free-brain/instructions.js');
    const offText = withFlag(undefined, () => INSTR.buildFreeBrainInstruction({ band: 'adult' }));
    ok('the free-brain instruction says nothing about an exchange rate',
      !offText.includes('search_live كما تطلبُ'), offText.slice(0, 120));
  }

  // THE CALL SITES. Behaviour checks cannot reach the handler, so the handler is read: every
  // thing this round added must be inside a `liveWorldV2Enabled()` test, and the test must be
  // the one from the owning module.
  {
    const ASK = read('api/ask.js');
    ok('api/ask.js imports the switch from the module that owns it',
      /import \{ liveWorldV2Enabled \} from '\.\.\/lib\/live-world-v2\.js';/.test(ASK));
    ok('the date block is appended only under the switch',
      /appendDepthBlock\(systemWithDepth, liveWorldV2Enabled\(\) \? buildTodayBlock\(\) : ''\)/.test(ASK));
    ok('...and buildTodayBlock is called nowhere else in the handler',
      (ASK.match(/buildTodayBlock\(/g) || []).length === 1);
    ok('the FX live-quantity is gated',
      /const LIVE_QUANTITY_FX = liveWorldV2Enabled\(\) && worldIntent\.reason === 'FX_RATE';/.test(ASK));
    ok('the encyclopedia refusal is gated',
      /liveNumber: liveWorldV2Enabled\(\) && \(LIVE_QUANTITY \|\| LIVE_QUANTITY_FX\)/.test(ASK));
    ok('the print contract is gated',
      /if \(liveWorldV2Enabled\(\)\) \{[\s\S]{0,900}enforceLiveNumberSourcing\(wOut, \{ sources: worldPass\.sources \}\)/.test(ASK));
    // ── THE SECOND SEAT, AND WHY THIS COUNT IS NOW TWO (2026-09-20) ────────
    // It said ONE until the free brain was wired, and the reason it said one was never «once is
    // enough» — it was that a call outside a `liveWorldV2Enabled()` test is a behaviour the
    // switch cannot take back. So the count moves with the owner's order and the CLAIM does not:
    // every seat is named, and every named seat is gated.
    ok('...and enforceLiveNumberSourcing is called in exactly the TWO gated seats',
      (ASK.match(/enforceLiveNumberSourcing\(/g) || []).length === 2);
    ok('the free-brain seat is gated, and on the QUESTION rather than on the answer',
      /if \(liveWorldV2Enabled\(\) && asksLiveNumber\(questionText\)\) \{/.test(ASK));
    ok('...and it reads the live rows the turn actually retrieved',
      /enforceLiveNumberSourcing\(readerText, \{ sources: liveSources \}\)/.test(ASK));
    ok('...and it stands down once bytes have gone on the wire, and says so',
      /if \(out\.streamedThisTurn === true\) \{[\s\S]{0,300}live_number:inside_emitted_bytes/.test(ASK),
      'a deletion after the reader holds the text can only fail the prefix test');
    ok('...and an emptied free-brain answer takes the server-owned line, with no cards',
      /finalizerContext\.readerCards = \[\];[\s\S]{0,200}liveSearchNotice\(\{ worldWanted: true, answeredFromLive: false \}\)/.test(ASK));

    // ٢/٢ — the tool layer decides `liveNumber` through the owning module and not by a list.
    const TOOLS = read('lib/free-brain/tools.js');
    ok('search_live decides the live-number question through lib/world-intent.js',
      /import \{ asksLiveNumber, classifyWorldIntent \} from '\.\.\/world-intent\.js';/.test(TOOLS)
      && /const liveNumber = asksLiveNumber\(query\);/.test(TOOLS));
    ok('...and passes it to the open search, which is where the encyclopedia is refused',
      /retrieveOpenWorld\(query, \{\s*band: ctx\.band, dailyBudget: ctx\.dailyBudget, liveNumber,/.test(TOOLS));
    ok('...and reads no environment of its own',
      !/process\.env/.test(TOOLS), 'the tool layer is driven by api/ask.js and by ctx');
    // ٢/٤ — the trace, and what it may not carry.
    ok('search_live leaves one trace line per call',
      /console\.warn\('\[free-brain\/live\]', \{[\s\S]{0,300}sources: added\.length/.test(TOOLS));
    ok('...and the trace carries no error MESSAGE and no matched WORD from the question',
      !/\[free-brain\/live\][\s\S]{0,400}(?:message:|matched:)/.test(TOOLS));

    // ٢/١ — the instruction line is appended under the switch, never written into the old lines.
    const INSTR = read('lib/free-brain/instructions.js');
    ok('the free-brain governing block is assembled behind the switch',
      /function governing\(\) \{[\s\S]{0,200}liveWorldV2Enabled\(\) \? \[\.\.\.GOVERNING_LINES, FX_GOVERNING_LINE\]/.test(INSTR));
    ok('...and the three pre-round lines are untouched',
      /'- السؤالُ العامّ: أجِبْ مباشرةً، وابحثْ عند الحاجة وحدَها \(خبرٌ، طقسٌ، سعرٌ، رقمٌ متغيّر، أو شيءٌ حدث بعد معرفتك\)\.',/.test(INSTR));

    // ع-١ — the three news rows are declared unconditionally and admitted conditionally.
    const POL = read('lib/ledger/source-policy.js');
    ok('the three news rows are declared in the table whatever the switch says',
      /domain: 'aljazeera\.net'/.test(POL) && /domain: 'bbc\.com'/.test(POL)
      && /domain: 'skynewsarabia\.com'/.test(POL),
      'a row that disappears with an environment variable is a row nobody can review');
    ok('...and policyFor() is the ONE place that withholds them',
      /const LIVE_WORLD_V2_ROWS = new Set\(\['aljazeera\.net', 'bbc\.com', 'skynewsarabia\.com'\]\);/.test(POL)
      && /if \(row && LIVE_WORLD_V2_ROWS\.has\(row\.domain\) && !liveWorldV2Enabled\(\)\) return null;/.test(POL));
    ok('...and they grant nothing but carriage',
      /domain: 'aljazeera\.net'[\s\S]{0,200}searchable: false, caps: \{\}/.test(POL)
      && /domain: 'bbc\.com'[\s\S]{0,200}searchable: false, caps: \{\}/.test(POL)
      && /domain: 'skynewsarabia\.com'[\s\S]{0,200}searchable: false, caps: \{\}/.test(POL));
    // The ORIGINAL line is untouched, which is what keeps guards/source-honesty-guard.cjs F4
    // meaningful — the new reason was added beside it, not inside it.
    ok('the original LIVE_QUANTITY line is still character-for-character what it was',
      /const LIVE_QUANTITY = worldIntent\.reason === 'WEATHER' \|\| worldIntent\.reason === 'MARKET_PRICE';/.test(ASK));
    // ── THE FALL-THROUGH IS STILL A FALL-THROUGH ─────────────────────────
    //
    // READ BY BRACE-MATCHING THE CATCH BLOCK, NOT BY A CHARACTER WINDOW. The first version of
    // this check was `/catch \(e\) \{[\s\S]{0,1600}…WORLD_SEARCH_THREW/` and it went red the
    // moment the trace grew a comment explaining why it stopped printing `e.message`: the gap
    // became 1696 characters and the window was 1600. A guard whose verdict depends on how much
    // PROSE sits inside a block is a guard that reds for the wrong reason and gets widened until
    // it proves nothing. The block's own braces are where it ends, so that is what is read.
    const catchStart = ASK.indexOf('} catch (e) {', ASK.indexOf('const LIVE_QUANTITY ='));
    let catchBlock = '';
    if (catchStart !== -1) {
      let depth = 0;
      const open = ASK.indexOf('{', catchStart);
      for (let k = open; k < ASK.length; k++) {
        if (ASK[k] === '{') depth++;
        else if (ASK[k] === '}') { depth--; if (depth === 0) { catchBlock = ASK.slice(open, k + 1); break; } }
      }
    }
    ok('the world search still has a catch that swallows the throw', catchBlock.length > 0);
    ok('...and it carries the trace that separates a crash from a miss',
      catchBlock.includes("console.error('[world-search] WORLD_SEARCH_THREW'"));
    ok('...and it does NOT return — gating on the intent rather than the material would cost a child their age floor',
      catchBlock.length > 0 && !/\breturn\b/.test(catchBlock),
      catchBlock.slice(0, 200));
    ok('...and the trace carries no error MESSAGE, which can contain the question verbatim',
      !/message:/.test(catchBlock),
      'lib/retrieve.js puts the reader question in the open-search URL; a transport error quotes it');
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== D. ON is a different app, and differs in EXACTLY the declared places ===');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const moved = {};
    withFlag('on', () => {
      for (const [q, want] of PRE_ROUND) {
        const got = verdict(q);
        if (got !== want) moved[q] = got;
      }
    });
    // Compared as SORTED PAIRS. Two objects with the same entries in a different insertion
    // order are the same answer, and an assertion that says otherwise fails for a reason that
    // has nothing to do with the app.
    const pairs = (o) => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    eq('the switch moves exactly the declared rows, and no others', pairs(moved), pairs(EXPECTED_MOVES));
    ok('...and it moves some — a switch that changes nothing passes section C too',
      Object.keys(moved).length > 0);

    eq('the price source joins the world list, fifth',
      withFlag('on', () => REG.domainsForWorld()),
      ['ar.wikipedia.org', 'aljazeera.net', 'bbc.com', 'skynewsarabia.com', 'cbk.gov.kw']);
    ok('...and it is declared in the registry whatever the switch says',
      REG.SOURCES.some((s) => s.domain === 'cbk.gov.kw' && s.status === 'world-v2'),
      'a row that disappears with an environment variable is a row nobody can review');
    ok('...and it may serve NO religious purpose, switch or no switch',
      REG.PURPOSES.every((p) => REG.sourceAllowsPurpose('cbk.gov.kw', p) === false));

    // ── THE SECOND ORDER'S OWN "ON" (2026-09-20) ────────────────────────────
    const SPOL = await esm('lib/ledger/source-policy.js');
    const CANON = await esm('lib/ledger/canonical.js');
    const newsOn = withFlag('on', () => ['aljazeera.net', 'bbc.com', 'skynewsarabia.com']
      .filter((d) => {
        const row = SPOL.policyFor(d);
        return !(row && row.health === 'enabled' && row.searchable === false
          && CANON.admissible('https://' + d + '/x') === true);
      }));
    eq('the three news hosts become FETCHABLE, and nothing more', newsOn, []);
    const CAPS = await esm('lib/ledger/capability.js');
    eq('...and NO capability follows the carriage — a news page backs no ruling',
      withFlag('on', () => {
        const granted = [];
        for (const d of ['aljazeera.net', 'bbc.com', 'skynewsarabia.com']) {
          for (const c of CAPS.CAPABILITIES) {
            if (SPOL.capabilityEligible(d, c)) granted.push(d + ':' + c);
          }
        }
        return granted;
      }), []);
    eq('...and they are still not a place the engine may search',
      withFlag('on', () => SPOL.searchableDomains()
        .filter((d) => ['aljazeera.net', 'bbc.com', 'skynewsarabia.com'].includes(d))), []);

    // ٢/٢ — the live-quantity rule, ON, over the three classes it names and one it does not.
    const liveOn = withFlag('on', () => ({
      price: WI.asksLiveNumber('كم سعر جرام الذهب اليوم في الكويت؟'),
      weather: WI.asksLiveNumber('شنو الطقس اليوم؟'),
      fx: WI.asksLiveNumber('كم يساوي الدولار مقابل الدينار الكويتي اليوم؟'),
      news: WI.asksLiveNumber('ما آخر أخبار غزة؟'),
      clock: WI.asksLiveNumber('كم تاريخ اليوم؟'),
      religious: WI.asksLiveNumber('كم نصاب زكاة الذهب بالجرام؟'),
      science: WI.asksLiveNumber('كم تبعد الشمس عن الأرض؟'),
    }));
    eq('asksLiveNumber() fires on the three moving-number classes and on nothing else',
      liveOn,
      { price: true, weather: true, fx: true, news: false, clock: false, religious: false, science: false });

    // ── ٢/٢ DRIVEN, NOT GREPPED — search_live WITH THE PROVIDER STUBBED ─────
    //
    // The three checks above read source. This one runs the tool: the provider is a stub, the
    // day's budget is a stub that always grants, and what is measured is WHICH RESULTS SURVIVE.
    // An encyclopedia row and a news row go in; with the switch on and a moving-number question
    // the encyclopedia is dropped and the news row is kept, and with the switch off both are
    // kept — which is today's app, exactly.
    {
      const TOOLS_M = await esm('lib/free-brain/tools.js');
      const realFetch = globalThis.fetch;
      const hadKey = Object.prototype.hasOwnProperty.call(process.env, 'BRAVE_API_KEY');
      const oldKey = process.env.BRAVE_API_KEY;
      process.env.BRAVE_API_KEY = 'stub-key-never-sent';
      // The site-filtered pass returns nothing, so the turn falls to the open search — which is
      // the pass `liveNumber` narrows, and the only one this check is about.
      globalThis.fetch = async (url) => ({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          web: {
            results: /site(?:%3A|:)/.test(String(url)) ? [] : [
              { title: 'مقالة موسوعية', url: 'https://ar.wikipedia.org/wiki/x', description: 'نص' },
              { title: 'تقرير', url: 'https://www.aljazeera.net/ebusiness/2026/9/20/x', description: 'نص' },
            ],
          },
        }),
      });
      const drive = async (query) => {
        const ctx = {
          table: TOOLS_M.createEvidenceTable(),
          band: 'adult',
          dailyBudget: { reserve: async () => ({ ok: true }) },
          spend: [], degraded: [], injectionMarkers: [], liveCalls: [],
        };
        const out = await TOOLS_M.runTool('search_live', { query }, ctx);
        return { hosts: ctx.liveCalls.flatMap((c) => c.sources.map((s) => s.host)), ctx };
      };
      try {
        const FX = 'سعر صرف الين الياباني مقابل الكرونة السويدية';
        const on = await (async () => {
          process.env.LIVE_WORLD_V2 = 'on';
          return drive(FX);
        })();
        eq('ON: a moving-number search keeps the news page and drops the encyclopedia',
          on.hosts, ['aljazeera.net']);
        ok('...and the turn records that a live NUMBER was asked for',
          on.ctx.liveCalls.length === 1 && on.ctx.liveCalls[0].liveNumber === true);
        const news = await (async () => {
          process.env.LIVE_WORLD_V2 = 'on';
          return drive('آخر أخبار غزة اليوم');
        })();
        eq('ON: a NEWS search keeps the encyclopedia — it is refused for figures, not for facts',
          news.hosts, ['ar.wikipedia.org', 'aljazeera.net']);
        const off = await (async () => {
          delete process.env.LIVE_WORLD_V2;
          return drive(FX);
        })();
        eq('OFF: the same moving-number search keeps both, exactly as it does today',
          off.hosts, ['ar.wikipedia.org', 'aljazeera.net']);
        ok('...and records no live-number request at all',
          off.ctx.liveCalls.length === 1 && off.ctx.liveCalls[0].liveNumber === false);
      } finally {
        globalThis.fetch = realFetch;
        if (hadKey) process.env.BRAVE_API_KEY = oldKey; else delete process.env.BRAVE_API_KEY;
        delete process.env.LIVE_WORLD_V2;
      }
    }

    // ٢/١ — the instruction gains exactly ONE line, and it is the exchange line.
    const INSTR = await esm('lib/free-brain/instructions.js');
    const off = withFlag(undefined, () => INSTR.buildFreeBrainInstruction({ band: 'adult' })).split('\n');
    const on = withFlag('on', () => INSTR.buildFreeBrainInstruction({ band: 'adult' })).split('\n');
    const added = on.filter((line) => !off.includes(line));
    ok('the free-brain instruction gains exactly one line, and it names search_live',
      added.length === 1 && added[0].includes('search_live'), JSON.stringify(added));
    eq('...and removes none', off.filter((line) => !on.includes(line)), []);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== E. the gate can fail (section C, re-run with the switch forced on) ===');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const drift = withFlag('on', () => PRE_ROUND.filter(([q, want]) => verdict(q) !== want));
    ok('with the switch ON, the pre-round battery does NOT reproduce — so section C is real',
      drift.length === Object.keys(EXPECTED_MOVES).length && drift.length > 0,
      'drifted=' + drift.length);
    const list = withFlag('on', () => REG.domainsForWorld());
    ok('...and the world-list check is real too', list.length === 5);
    // The same question asked of the 2026-09-20 half: section C's «still un-admissible» is only
    // worth something if the switch can make it false.
    const SPOL = await esm('lib/ledger/source-policy.js');
    ok('...and the fetcher-admission check is real: ON, all three hosts have a row',
      withFlag('on', () => ['aljazeera.net', 'bbc.com', 'skynewsarabia.com']
        .every((d) => SPOL.policyFor(d) !== null)));
    ok('...and asksLiveNumber is real: ON, the FX question is a live number',
      withFlag('on', () => WI.asksLiveNumber('كم يساوي الدولار مقابل الدينار الكويتي اليوم؟') === true));
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
