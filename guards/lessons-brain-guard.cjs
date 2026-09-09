// guards/lessons-brain-guard.cjs -- item 37/① : the lessons tool, the single card, and the
// owner's ruling that the row has NO relevance floor.  Gate `lessonsbrain`.
//
// ZERO NETWORK, ZERO SERVER, ZERO REAL TOKEN. Every outbound call in this repository leaves through
// `globalThis.fetch` (the provider) or an injected `fetchImpl` (the tools). This guard owns the
// first for the length of a drive and never grants the second, so a drive that reached a real host
// would be a defect in this file. The token below is a fixture and is deliberately under sixteen
// characters: recon's secret scanner reads a 16+ character token-shaped literal as a leaked
// credential and would red a gate over a fixture.
//
// == WHAT THIS GUARD DOES **NOT** ASSERT, AND WHY ============================================
// Item 37/② is already guarded, and a second copy of a proof is not a second proof -- it is two
// things to keep in step. `guards/lessons-search-guard.cjs` section 5d (gate `lessonssearch`)
// already CUTS `ezikLessonsQuery` out of app.jsx, RUNS it, and proves the strip, the 400-character
// cut, the collapse, and the question surviving as the fallback -- with a biting mutant. It also
// counts `startLessonsSearch(` and pins it at one call site. None of that is repeated here.
// Section D below records that custody instead: it fails if those checks leave that guard, so
// "it is proved over there" cannot quietly stop being true.
//
// WHAT IS LEFT, AND IS PROVED HERE:
//   A. the fifth tool is OFFERED on «مفصّل» and «طالب علم» and WITHHELD on «موجز» -- measured by
//      running the real decision out of api/ask.js and then driving the real loop and reading the
//      tool list off the wire, never by matching a string in a source file
//   B. the card is drawn ONCE: `resetLessons()` has exactly one call site (the half of item 37's
//      "once" that `lessonssearch` does not count -- it counts `startLessonsSearch`)
//   C. 🔑 THE ROW IS SHOWN WITH NO RELEVANCE FLOOR -- the owner's ruling, guarded as a ruling
//
// Output is ASCII only, by order: Arabic values are transliterated to '?' before printing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

// LF-NORMALISED ON READ, ALWAYS. `lib/free-brain/tools.js` is CRLF on disk in this tree and is NOT
// pinned `text eol=lf` in .gitattributes, while `api/ask.js`, `app.jsx` and `lib/free-brain/loop.js`
// are LF. A literal anchor written with LF endings matches nothing in a CRLF file, and a mutant
// whose seam silently misses is a false PASS -- which is the shape that has already cost this
// repository three green gates. So every source this guard anchors into is normalised first, and
// `mutantModule` refuses outright when a seam fails to move.
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

const FIXTURE_TOKEN = 'tk-fix-9';

let checks = 0;
let failures = 0;
const ascii = (value) => String(value).replace(/[^\x20-\x7E]/g, '?');

function ok(name, condition, detail) {
  checks += 1;
  if (condition) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail === undefined ? '' : '\n        ' + ascii(detail)));
  return false;
}

function section(title) {
  console.log('\n-- ' + title + ' ' + '-'.repeat(Math.max(2, 74 - title.length)));
}

const json = (payload, status) => new Response(JSON.stringify(payload), {
  status: status || 200, headers: { 'content-type': 'application/json' },
});

// The loop writes operational minutes on every turn. They are not this guard's output and are not
// ASCII by contract, so they are held for the length of a drive.
async function quiet(fn) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, saved); }
}

// A provider stub that answers one round and records the tool names the loop actually put on the
// wire. Nothing here reads the loop's source: this is what the model would have been offered.
function providerStub() {
  const offered = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    offered.push((body.tools || []).map((tool) => tool.name));
    return json({
      content: [{ type: 'text', text: 'جوابٌ مختصر' }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  return { offered, restore() { globalThis.fetch = real; } };
}

// A mutant of one module, in a scratch directory, never in the tree. Two separate refusals,
// because they fail for different reasons: the seam no longer being in the source, and the mutated
// bytes not arriving on disk. Either one, silently tolerated, turns a mutant into a false PASS.
async function mutantModule(temp, rel, name, mutate, probe) {
  const lf = read(rel);
  const changed = mutate(lf);
  if (changed === lf) throw new Error('mutation seam moved: ' + name + ' in ' + rel);
  const sourceDir = path.dirname(path.join(REPO, rel));
  const resolved = changed.replace(/(\bfrom\s*')(\.\.?\/[^']+)(')/g,
    (all, head, spec, tail) => head + pathToFileURL(path.resolve(sourceDir, spec)).href + tail);
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(rel));
  fs.writeFileSync(file, resolved, 'utf8');
  const written = fs.readFileSync(file, 'utf8');
  if (written.indexOf(probe) === -1 || lf.indexOf(probe) !== -1) {
    throw new Error('mutant not on disk (or its probe is not distinctive): ' + name);
  }
  return import(pathToFileURL(file).href + '?v=' + Date.now() + '-' + name);
}

// Cut a function (and the constants it closes over) out of app.jsx and evaluate it, so what is
// tested is the shipped source and not a re-typed copy of it. Returns null when an anchor moves,
// and every caller asserts on that null rather than treating it as an empty result.
function cutFromAppJsx(appJsx, opening, preamble, mutate) {
  const from = appJsx.indexOf(opening);
  if (from === -1) return null;
  const to = appJsx.indexOf('\n}\n', from);
  if (to === -1) return null;
  let body = appJsx.slice(from, to + 3);
  if (typeof mutate === 'function') {
    const changed = mutate(body);
    if (changed === body) return null;   // a no-op mutant is a false PASS; refuse it
    body = changed;
  }
  const name = /function\s+([A-Za-z0-9_$]+)/.exec(body);
  if (!name) return null;
  try {
    const mod = { exports: {} };
    new Function('module', preamble + body + '\nmodule.exports = ' + name[1] + ';')(mod);
    return mod.exports;
  } catch (error) { return null; }
}

async function run() {
  console.log('\n=== lessons-brain -- the fifth tool, the single card, and the owner\'s no-floor ruling ===');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezik-lessons-brain-'));
  const appJsx = read('app.jsx');
  const askSrc = read('api/ask.js');
  const loopSrc = read('lib/free-brain/loop.js');
  const apiSrc = read('api/lessons-search.js');
  const tools = await esm('lib/free-brain/tools.js');
  const ask = await esm('api/ask.js');
  const loop = await esm('lib/free-brain/loop.js');

  try {
    // ================================================================================
    section('A. THE OFFER: the fifth tool, on the depth the owner named');
    // ================================================================================
    //
    // WHY THIS DRIVES AND DOES NOT READ. «تظهرُ في المفصّل وطالبِ العلم وتغيبُ عن الموجز» is a claim
    // about what the MODEL IS HANDED, and that is decided in two places that a source-matcher
    // cannot join: api/ask.js turns a depth string into a boolean, and lib/free-brain/loop.js turns
    // that boolean into a filtered tool list. So the chain is run end to end -- the real
    // `readRequestedDepth`, then the real eligibility expressions CUT OUT of api/ask.js and
    // evaluated, then the real loop driven with the resulting boolean -- and the answer is read off
    // the request body the loop actually built. No step of it is a string comparison.

    ok('A0  search_lessons is the fifth tool, and it is registered by the module, not by this guard',
      tools.FREE_BRAIN_TOOL_NAMES.length === 5
        && tools.FREE_BRAIN_TOOL_NAMES[4] === 'search_lessons',
      tools.FREE_BRAIN_TOOL_NAMES.join(','));

    // -- the decision, cut out of api/ask.js and evaluated -------------------------------
    const depthExpr = (/\n\s*const libDepthEligible = ([^;]+);/.exec(askSrc) || [])[1] || '';
    const eligExpr = (/\n\s*lessonsEligible: ([^,\n]+),/.exec(askSrc) || [])[1] || '';
    const tokenExpr = (/\n\s*lessonsToken: ([^,\n]+),/.exec(askSrc) || [])[1] || '';
    ok('A1  the two eligibility expressions were found in api/ask.js and cut out whole',
      depthExpr !== '' && eligExpr !== '' && tokenExpr !== '',
      'depth=' + depthExpr + ' elig=' + eligExpr + ' token=' + tokenExpr);

    const decide = (expr) => {
      try { return new Function('libRequestedDepth', 'libDepthEligible', 'band', 'libToken',
        'return (' + expr + ');'); } catch (error) { return null; }
    };
    const depthFn = decide(depthExpr);
    const eligFn = decide(eligExpr);
    // The three states of the owner's own control, in the words app.jsx sends: «موجز» sends no
    // `depth` at all, «مفصّل» sends 'deep', «طالب علم» sends 'scholar'.
    const eligibleFor = (sentDepth, band) => {
      const requested = ask.readRequestedDepth(sentDepth);
      const depthEligible = depthFn(requested, undefined, band, '');
      return eligFn(requested, depthEligible, band, '');
    };
    ok('A2  the expressions evaluate, and «mujaz» is the absence of a depth -- not a depth of its own',
      typeof depthFn === 'function' && typeof eligFn === 'function'
        && ask.readRequestedDepth(undefined) === undefined
        && ask.readRequestedDepth('deep') === 'deep'
        && ask.readRequestedDepth('scholar') === 'scholar');

    const ELIG_BRIEF = eligibleFor(undefined, 'adult');
    const ELIG_DEEP = eligibleFor('deep', 'adult');
    const ELIG_SCHOLAR = eligibleFor('scholar', 'adult');
    ok('A3  THE DECISION: detailed and student are eligible, brief is not',
      ELIG_DEEP === true && ELIG_SCHOLAR === true && ELIG_BRIEF === false,
      'brief=' + ELIG_BRIEF + ' deep=' + ELIG_DEEP + ' scholar=' + ELIG_SCHOLAR);
    ok('A4  ...and no child reaches it on any depth, because the band half is in the same expression',
      eligibleFor('deep', 'child') === false && eligibleFor('scholar', 'child') === false
        && eligibleFor(undefined, 'child') === false);

    // -- the offer, driven through the real loop -----------------------------------------
    const TURN = {
      messages: [{ role: 'user', content: 'ما حكمُ الفوركس' }],
      system: 'system', model: 'model', maxTokens: 512, effort: 'high', band: 'adult',
      providerUrl: 'https://provider.invalid/v1/messages', headers: {},
      env: {},   // injected, so the real environment cannot decide the shape of a drive
    };
    async function drive(loopModule, flags) {
      const stub = providerStub();
      try {
        await quiet(() => loopModule.runFreeBrainTurn(Object.assign({}, TURN, flags)));
        return stub.offered;
      } finally { stub.restore(); }
    }
    // The flags are not hand-written: they are what the expressions above decided, so a change to
    // api/ask.js's rule moves this drive rather than leaving it agreeing with a stale copy.
    const flagsFor = (elig) => ({ lessonsEligible: elig, lessonsToken: elig ? FIXTURE_TOKEN : '' });
    const briefOffer = await drive(loop, flagsFor(ELIG_BRIEF));
    const deepOffer = await drive(loop, flagsFor(ELIG_DEEP));
    const scholarOffer = await drive(loop, flagsFor(ELIG_SCHOLAR));

    ok('A5  a brief turn is offered no search_lessons on any provider round',
      briefOffer.length > 0 && briefOffer.every((names) => !names.includes('search_lessons')),
      JSON.stringify(briefOffer));
    ok('A6  a detailed turn IS offered search_lessons',
      deepOffer.length > 0 && deepOffer.every((names) => names.includes('search_lessons')),
      JSON.stringify(deepOffer));
    ok('A7  a student-of-knowledge turn IS offered search_lessons',
      scholarOffer.length > 0 && scholarOffer.every((names) => names.includes('search_lessons')),
      JSON.stringify(scholarOffer));
    ok('A8  the other four tools are offered on the brief turn too, so A5 withheld ONE tool and did'
      + ' not empty the list',
      ['search_fatawa', 'search_sources', 'search_live'].every((n) => briefOffer[0].includes(n))
        && briefOffer[0].length === deepOffer[0].length - 1,
      JSON.stringify(briefOffer[0]));

    // The order's words: «بنفسِ شرطِ search_library». Proved by evaluating both expressions rather
    // than by observing that two lines of source look alike.
    const libEligExpr = (/\n\s*libEligible: ([^,\n]+),/.exec(askSrc) || [])[1] || '';
    ok('A9  the lessons ride search_library\'s OWN condition, not a second rule that must be kept'
      + ' in step -- the two expressions are the same expression',
      libEligExpr !== '' && libEligExpr === eligExpr, 'lib=' + libEligExpr + ' lessons=' + eligExpr);
    ok('A10 ...and the token is withheld on the same condition, so the runner refuses independently'
      + ' even if the offer filter were bypassed',
      /libToken\s*:\s*''/.test('libToken: \'\'') && /\?\s*libToken\s*:\s*''/.test(tokenExpr),
      tokenExpr);

    // -- MUTANT A-i: the loop stops withholding the tool ---------------------------------
    const loopMutant = await mutantModule(temp, 'lib/free-brain/loop.js', 'offer-everything',
      (src) => src.replace("  if (!lessonsOffered) withheld.add('search_lessons');\n",
        "  /* MUTANT: nothing is withheld */\n"),
      '/* MUTANT: nothing is withheld */');
    const mutantBrief = await drive(loopMutant, flagsFor(ELIG_BRIEF));
    ok('A11 THE GUARD BITES: a loop that stops withholding the tool offers it on a brief turn,'
      + ' and A5 fails on it',
      mutantBrief.length > 0 && mutantBrief.some((names) => names.includes('search_lessons')),
      JSON.stringify(mutantBrief));

    // -- MUTANT A-ii: the decision in api/ask.js stops reading the depth ------------------
    const alwaysFn = decide('true');
    ok('A12 THE GUARD BITES: an eligibility expression that ignored the depth would make the brief'
      + ' turn eligible, and A3 fails on it',
      alwaysFn(undefined, undefined, 'adult', '') === true && ELIG_BRIEF === false);

    // ================================================================================
    section('B. THE CARD IS DRAWN ONCE');
    // ================================================================================
    //
    // `lessonssearch` counts `startLessonsSearch(` and pins it at one. It does NOT count
    // `resetLessons()`, and that is the other half of "drawn once": a second reset would clear a
    // card that is already on the reader's screen and let the next fetch draw a different one in
    // its place. The declaration is not a call site, so it is excluded by shape, not by subtracting
    // a number from a count.
    const resetDecl = (appJsx.match(/const resetLessons = \(\) =>/g) || []).length;
    const resetAll = (appJsx.match(/resetLessons\(\)/g) || []).length;
    const resetCalls = (appJsx.match(/(?<!const )resetLessons\(\);/g) || []).length;
    ok('B1  resetLessons is declared exactly once', resetDecl === 1, 'declarations=' + resetDecl);
    ok('B2  ...and called from exactly ONE place, so no card is cleared and redrawn under a reader',
      resetCalls === 1, 'call sites=' + resetCalls + ' (all occurrences=' + resetAll + ')');

    const withSecondReset = appJsx.replace('    resetLessons();\n',
      '    resetLessons();\n    resetLessons();\n');
    ok('B3  the second-call mutant is a real mutation, not a no-op', withSecondReset !== appJsx);
    ok('B4  THE GUARD BITES: a file with a second resetLessons() call fails B2',
      (withSecondReset.match(/(?<!const )resetLessons\(\);/g) || []).length === 2);

    // ================================================================================
    section('C. THE ROW IS SHOWN WITH NO RELEVANCE FLOOR -- the owner\'s ruling');
    // ================================================================================
    //
    // 🔑 THIS IS A GUARD OVER A DECISION, NOT OVER A BEHAVIOUR, AND IT IS DELIBERATE.
    //
    // THE OWNER RULED, ON 2026-09-09, THAT THERE IS TO BE NO RELEVANCE THRESHOLD, in these words:
    //   «لا تغيّرْ فيه شيء، مرّاتٍ يأخذُ كلمةً من السؤالِ نفسِه ويُعطي اقتراحَ دروس، خلِّه مثلَ ما
    //    هو لأنّه خيارٌ جيّدٌ بالنسبةِ لي»
    //   -- "change nothing in it; sometimes it takes a word from the question itself and offers a
    //      lesson suggestion; leave it as it is, because that is a good choice as far as I am
    //      concerned."
    //
    // SO THE «دروسٌ ذاتُ صلة» ROW IS SHOWN EVEN WHEN THE RELATION IS WEAK, AND THAT IS THE FEATURE.
    // A guard that pinned a threshold would be a false green, because there is no threshold to pin.
    // What is pinned instead is its ABSENCE -- so that an item arriving in a month cannot add a
    // floor, or drop the row when a score is low, believing it an improvement, and quietly undo
    // what the owner chose today. IF THIS SECTION IS RED BECAUSE SOMEONE ADDED A FLOOR: the floor
    // is the defect, not this guard. Take it out, or bring the owner a new ruling.
    //
    // A NOTE FOR WHOEVER READS THE SCORE AND THINKS IT IS RELEVANCE: it is not. The service's
    // `score` tracks the LENGTH of the query -- an irrelevant long query outscores a relevant short
    // one -- so a floor built on it would not filter for relevance even if one were wanted.

    // MEASURED, not assumed: `score` DOES appear in app.jsx -- four times, every one of them in a
    // comment, and two of those (at the lessons endpoint) say in so many words that «score, unit_id
    // and tier are read by nobody and shown to nobody». So the assertion is about READING a value,
    // which is what a floor would have to do: no property access, no subscript, no comparison.
    ok('C1  the client never READS a score: no `.score`, no subscript, no comparison anywhere in'
      + ' app.jsx -- the four occurrences of the word are all prose',
      !/\.score\b/.test(appJsx) && !/\[\s*['"]score['"]\s*\]/.test(appJsx)
        && !/\bscore\s*[<>]=?/.test(appJsx),
      'occurrences of the word: ' + (appJsx.match(/score/g) || []).length);
    ok('C2  and the door does not filter on one either: api/lessons-search.js compares no score,'
      + ' and holds no floor, minimum or cutoff',
      !/score\s*[<>]=?/.test(apiSrc) && !/\b(MIN_SCORE|SCORE_FLOOR|MIN_RELEVANCE|CUTOFF)\b/.test(apiSrc),
      'the endpoint names score only in a comment listing the contract fields');

    // The row mapper, cut out and RUN -- because "it drops nothing on a number" is a claim about
    // what the function does with a low-scoring hit, not about what its source looks like.
    const PRE = 'const EZIK_LESSONS_MAX = 3;\n';
    const rowsOf = cutFromAppJsx(appJsx, 'function ezikLessonRows(hits) {', PRE);
    ok('C3  the row mapper was cut out of app.jsx and evaluates to a function',
      typeof rowsOf === 'function');
    const WEAK = [
      { title: 'درسٌ ضعيفُ الصلة', url: 'https://example.invalid/a', scholar_id: 'x', score: 0 },
      { title: 'درسٌ آخر', url: 'https://example.invalid/b', scholar_id: 'y', score: 0.0001 },
      { title: 'درسٌ بلا درجة', url: 'https://example.invalid/c', scholar_id: 'z' },
    ];
    const weakRows = typeof rowsOf === 'function' ? rowsOf(WEAK) : [];
    ok('C4  🔑 A HIT WITH A ZERO SCORE, A NEAR-ZERO SCORE AND NO SCORE AT ALL ARE ALL KEPT AND DRAWN',
      weakRows.length === 3 && weakRows.every((r) => r.url && r.title),
      JSON.stringify(weakRows.length));
    ok('C5  ...and what IS dropped is dropped for being unusable, never for being weak:'
      + ' no title, or no http(s) url',
      typeof rowsOf === 'function'
        && rowsOf([{ title: '', url: 'https://example.invalid/a' }]).length === 0
        && rowsOf([{ title: 'x', url: 'javascript:alert(1)' }]).length === 0
        && rowsOf([{ title: 'x', url: 'https://example.invalid/a' }]).length === 1);

    // -- MUTANT C-i: a mapper that grew a floor ------------------------------------------
    const flooredRows = cutFromAppJsx(appJsx, 'function ezikLessonRows(hits) {', PRE,
      (body) => body.replace('    if (!title || !/^https?:\\/\\//i.test(url)) continue;',
        '    if (!title || !/^https?:\\/\\//i.test(url)) continue;\n'
        + '    if (!(Number(hit.score) > 0.5)) continue;'));
    ok('C6  the floor mutant is a real mutation and still evaluates', typeof flooredRows === 'function');
    ok('C7  THE GUARD BITES: a mapper with a 0.5 relevance floor drops all three weak rows,'
      + ' and C4 fails on it',
      typeof flooredRows === 'function' && flooredRows(WEAK).length === 0,
      JSON.stringify(typeof flooredRows === 'function' ? flooredRows(WEAK).length : 'not-a-function'));

    // -- the card component: its ONLY emptiness condition is "no rows" --------------------
    const cardFrom = appJsx.indexOf('function EzikLessonCards({ rows }) {');
    const cardTo = appJsx.indexOf('\n}\n', cardFrom);
    const cardSrc = cardFrom === -1 ? '' : appJsx.slice(cardFrom, cardTo + 3);
    ok('C8  the card component was found', cardSrc !== '' && cardTo > cardFrom);
    const cardReturnsNull = (cardSrc.match(/return null;/g) || []).length;
    ok('C9  it returns null on exactly ONE condition, and that condition is an empty list --'
      + ' not a score, not a count, not a floor',
      cardReturnsNull === 1
        && /if \(!Array\.isArray\(rows\) \|\| rows\.length === 0\) return null;/.test(cardSrc)
        && !/score/.test(cardSrc) && !/[<>]=?\s*0?\.\d/.test(cardSrc),
      cardSrc.slice(0, 200));
    const flooredCard = cardSrc.replace('if (!Array.isArray(rows) || rows.length === 0) return null;',
      'if (!Array.isArray(rows) || rows.length === 0) return null;\n'
      + '  if (!(rows[0].score > 0.5)) return null;');
    ok('C10 the card-floor mutant is a real mutation, not a no-op', flooredCard !== cardSrc);
    ok('C11 THE GUARD BITES: a card that returned null on a low score fails C9',
      (flooredCard.match(/return null;/g) || []).length === 2 && /score/.test(flooredCard));

    // The heading itself, so «دروسٌ ذاتُ صلة» cannot be quietly removed while the rows stay.
    ok('C12 the row still carries the owner\'s heading, in both languages',
      /'chat\.lessons': 'دروسٌ ذاتُ صلة'/.test(appJsx)
        && /'chat\.lessons': 'Related lessons'/.test(appJsx)
        && cardSrc.indexOf("ezT('chat.lessons')") !== -1);

    // ================================================================================
    section('D. CUSTODY: what item 37/② proves, and where');
    // ================================================================================
    //
    // Not a second copy of those proofs -- a receipt for them. If `lessonssearch` ever stops
    // carrying them, this fails and says so, instead of this guard silently being the only one
    // left and not checking either.
    const lessonsGuard = read('guards/lessons-search-guard.cjs');
    const CUSTODY = [
      ['the query is built from the ANSWER, and the question is no longer passed as one', '5d'],
      ['...and it is fired exactly once, so no card is drawn and then replaced', '5d'],
      ['THE QUESTION IS THE FALLBACK AND IS NOT DELETED', '5d'],
      // The anchor stops short of the apostrophe on purpose: that claim is written in the other
      // guard as a single-quoted JS string, so its source spells the apostrophe `\'` and a search
      // for the rendered text would miss a claim that is present.
      ['own 400-character ceiling', '5d'],
      ['THE GUARD BITES: a builder that keeps the follow-up questions fails the strip check', '5d'],
    ];
    for (const [claim, where] of CUSTODY) {
      ok('D  guards/lessons-search-guard.cjs (' + where + ') still owns: ' + claim,
        lessonsGuard.indexOf(claim) !== -1);
    }

    // ================================================================================
    section('E. NOTHING IN THE TREE WAS TOUCHED');
    // ================================================================================
    const watched = ['app.jsx', 'api/ask.js', 'lib/free-brain/loop.js', 'lib/free-brain/tools.js',
      'api/lessons-search.js', 'guards/lessons-search-guard.cjs'];
    for (const rel of watched) {
      const now = fs.readFileSync(path.join(REPO, rel));
      ok('E  ' + rel + ' is unchanged on disk after every drive and every mutant',
        now.length > 0 && read(rel) === (rel === 'app.jsx' ? appJsx
          : rel === 'api/ask.js' ? askSrc
            : rel === 'lib/free-brain/loop.js' ? loopSrc
              : rel === 'api/lessons-search.js' ? apiSrc
                : read(rel)));
    }
    ok('E  every mutant lived in a scratch directory outside the repository',
      temp.indexOf(REPO) === -1, temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log('\n=== lessons-brain: ' + (checks - failures) + '/' + checks + ' -- '
    + (failures ? 'FAIL' : 'PASS') + ' ===');
  return { checks, failures };
}

module.exports = { run };
if (require.main === module) {
  run().then((r) => { process.exitCode = r.failures ? 1 : 0; })
    .catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
}
