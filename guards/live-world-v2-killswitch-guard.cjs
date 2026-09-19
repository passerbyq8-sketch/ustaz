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
    for (const rel of ['lib/world-intent.js', 'lib/source-registry.js', 'api/ask.js']) {
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
    ok('...and enforceLiveNumberSourcing is called nowhere else in the handler',
      (ASK.match(/enforceLiveNumberSourcing\(/g) || []).length === 1);
    // The ORIGINAL line is untouched, which is what keeps guards/source-honesty-guard.cjs F4
    // meaningful — the new reason was added beside it, not inside it.
    ok('the original LIVE_QUANTITY line is still character-for-character what it was',
      /const LIVE_QUANTITY = worldIntent\.reason === 'WEATHER' \|\| worldIntent\.reason === 'MARKET_PRICE';/.test(ASK));
    // And the fall-through is still a fall-through: the trace must not have become a return.
    ok('the silent catch still falls through and only adds a LOG line',
      /catch \(e\) \{[\s\S]{0,1600}console\.error\('\[world-search\] WORLD_SEARCH_THREW'/.test(ASK)
      && !/WORLD_SEARCH_THREW'[\s\S]{0,400}return /.test(ASK));
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
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' — FAIL ===' : ' — PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
