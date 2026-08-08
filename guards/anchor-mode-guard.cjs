// guards/anchor-mode-guard.cjs — EVERY CLAIM ON A SPAN THAT IS REALLY ON THE PAGE.
//
// ── THE DEFECT (قرار ١ب) ─────────────────────────────────────────────────────
// A sourced answer today is prose the model wrote after reading the retrieved pages, with a card
// underneath. The card proves a page was FETCHED. Nothing proves the sentences came from it — so a
// reply could be fluent, correctly cited, and rest on a ruling that appears on none of the pages
// beneath it, while every gate in the app passed because each checks something else.
//
// ── AND WHY THIS GATE IS MOSTLY ABOUT THE FLAG ───────────────────────────────
// Anchor mode changes the shape of every sourced answer on the DEEN route. قرار ١ب puts it behind
// ANCHOR_MODE, default off, so the shipped composition is untouched until the owner decides
// otherwise. A gate that proved the anchor logic correct but let it ship live would have got the
// one thing wrong that the decision was actually about.
//
// ── ZERO LIVE CALLS, BY CONSTRUCTION ─────────────────────────────────────────
// The decision says «صفرُ نداءٍ حيٍّ في هذه المرحلة». Every model reply here is a fixture string
// and `globalThis.fetch` throws for the whole run.
//
// Usage: node guards/anchor-mode-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, actual, expected) =>
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// The page the units are checked against. One page, quoted exactly — the span test is containment
// after normalisation, so the fixture must be the real text and not a paraphrase of it.
const PAGE_TEXT = 'العقيقة سنة مؤكدة عن المولود، وهي شاة عن الأنثى وشاتان عن الذكر، '
  + 'تُذبح في اليوم السابع من الولادة، وهذا قول جمهور أهل العلم.';
const PAGES = [{ url: 'https://islamweb.net/ar/fatwa/1001/x', passage: PAGE_TEXT }];

(async function main() {
  console.log('=== anchor-mode-guard — a claim is printed only if its span is on the page ===');

  const realFetch = globalThis.fetch;
  let reached = 0;
  globalThis.fetch = async (u) => { reached++; throw new Error('network reached: ' + u); };

  try {
    const A = await esm('lib/anchor/units.js');
    const F = await esm('lib/anchor/flag.js');

    // =========================================================================
    console.log('\n=== A. THE FLAG IS OFF, AND EVERY WAY OF FAILING TO READ IT IS ALSO OFF ===');
    {
      const had = Object.prototype.hasOwnProperty.call(process.env, 'ANCHOR_MODE');
      const prev = process.env.ANCHOR_MODE;
      delete process.env.ANCHOR_MODE;
      eq('unset is off', F.anchorEnvMode(), 'off');
      ok('...and the predicate agrees', F.anchorModeEnabled() === false);
      // A VALUE SOMEBODY MEANT AS YES BUT WROTE ANOTHER WAY IS STILL OFF.
      for (const v of ['true', '1', 'yes', 'enabled', 'anchor', 'off', '']) {
        process.env.ANCHOR_MODE = v;
        eq('ANCHOR_MODE=' + JSON.stringify(v) + ' is off', F.anchorEnvMode(), 'off');
      }
      process.env.ANCHOR_MODE = 'on';
      eq('...and only the exact word turns it on', F.anchorEnvMode(), 'on');
      process.env.ANCHOR_MODE = 'ON';
      eq('...case-insensitively', F.anchorEnvMode(), 'on');
      // ...and surrounding whitespace is TRIMMED, deliberately: a trailing space in a dashboard
      // env var is a deployment artifact, not somebody meaning something different.
      process.env.ANCHOR_MODE = ' on ';
      eq('...and whitespace around it does not change the intent', F.anchorEnvMode(), 'on');
      if (had) process.env.ANCHOR_MODE = prev; else delete process.env.ANCHOR_MODE;
      // THE SHIPPED DEFAULT. This is the assertion the decision is actually about.
      ok('with nothing set, anchor mode is OFF for every reader', F.anchorModeEnabled() === false);
      // ...and it reads only the env: no store, no credential, no second way in.
      // COMMENTS STRIPPED FIRST. This file's own prose explains why there is no store read and
      // no founder credential, so a test over the raw text matches its own explanation and fails.
      const fsrc = read('lib/anchor/flag.js').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
      ok('the flag reads the env and nothing else',
        !/redis|store|founder|hasValidFounderToken|import /i.test(fsrc),
        'a second way to turn this on is a second way to turn it on by accident');
    }

    // =========================================================================
    console.log('\n=== B. A HONEST UNIT PASSES ===');
    {
      const span = 'وهي شاة عن الأنثى وشاتان عن الذكر';
      const reply = '<unit source="' + PAGES[0].url + '" span="' + span + '">'
        + 'العقيقة شاة عن الأنثى وشاتان عن الذكر.</unit>';
      const units = A.parseUnits(reply);
      eq('the unit parses', units.length, 1);
      const { kept, dropped } = A.verifyUnits(units, PAGES);
      eq('...and survives verification', kept.length, 1);
      eq('...dropping nothing', dropped.length, 0);
      // THE SPAN IS MATCHED AFTER NORMALISATION, because the model retypes it rather than copying
      // bytes — different diacritics, same sentence.
      const vocalised = 'وَهِيَ شَاةٌ عَنِ الأُنْثَى وَشَاتَانِ عَنِ الذَّكَرِ';
      ok('a re-vocalised span still matches its page', A.spanIsOnPage(vocalised, PAGE_TEXT));
      // ...but a PARAPHRASE does not. This is the line between normalisation and similarity.
      ok('a paraphrase of the page does NOT match',
        !A.spanIsOnPage('شاة واحدة للبنت وشاتان للولد', PAGE_TEXT));
      // A span too short to prove anything is refused outright.
      ok('a span shorter than the floor is refused', !A.spanIsOnPage('العقيقة', PAGE_TEXT));
      ok('...and the floor is stated, not implicit', A.MIN_SPAN_CHARS >= 16, String(A.MIN_SPAN_CHARS));
    }

    // =========================================================================
    console.log('\n=== C. A UNIT WITH NO ORIGIN DROPS, AND IS NOT PRINTED ===');
    {
      const reply = [
        '<unit source="' + PAGES[0].url + '" span="وهي شاة عن الأنثى وشاتان عن الذكر">صحيحة.</unit>',
        '<unit source="' + PAGES[0].url + '" span="مقطع لا وجود له في هذه الصفحة البتة">دعوى بلا أصل.</unit>',
        '<unit source="https://other.example/x" span="وهي شاة عن الأنثى وشاتان عن الذكر">من صفحة لم تُجلب.</unit>',
        '<unit source="' + PAGES[0].url + '">بلا مقطع أصلًا.</unit>',
      ].join(' ');
      const { kept, dropped } = A.verifyUnits(A.parseUnits(reply), PAGES);
      eq('only the honest unit survives', kept.length, 1);
      eq('...and three are dropped', dropped.length, 3);
      const why = dropped.map((d) => d.why).sort().join(',');
      eq('...each for its own named reason', why, 'no-span,span-not-on-page,url-not-retrieved');
      // A URL THE REQUEST NEVER FETCHED HAS NO TEXT TO CHECK AGAINST, so it is not checkable and
      // therefore not printable. The model can name any URL it likes.
      const composed = A.composeUnits(kept);
      ok('the dropped claims are ABSENT from the composition', !/دعوى بلا أصل|لم تُجلب|بلا مقطع/.test(composed), composed);
      ok('...and the surviving one is present', /صحيحة/.test(composed));
    }

    // =========================================================================
    console.log('\n=== D. THE SERVER COMPOSES — THERE IS NO LINKING SENTENCE TO INHERIT ===');
    {
      // The model wrote prose BETWEEN the units. That prose belongs to neither page and so is
      // verified against neither; it is exactly where an unsupported claim would hide.
      const span = 'وهي شاة عن الأنثى وشاتان عن الذكر';
      const reply = '<unit source="' + PAGES[0].url + '" span="' + span + '">الأولى.</unit>'
        + ' وبناءً على ما تقدَّم فإنّ الراجح خلاف ذلك، وهذا هو المعتمد عند المحققين. '
        + '<unit source="' + PAGES[0].url + '" span="تُذبح في اليوم السابع من الولادة">الثانية.</unit>';
      const units = A.parseUnits(reply);
      eq('both units parse', units.length, 2);
      const { kept } = A.verifyUnits(units, PAGES);
      const composed = A.composeUnits(kept);
      ok('the model\'s linking sentence is GONE', !/وبناءً على ما تقدَّم|المعتمد عند المحققين/.test(composed), composed);
      ok('...and it was dropped at PARSE, structurally — not filtered afterwards',
        !JSON.stringify(units).includes('المعتمد عند المحققين'),
        'text outside a <unit> tag must never become a claim in the first place');
      ok('both surviving claims are printed as separate points',
        /الأولى/.test(composed) && /الثانية/.test(composed) && composed.split('\n').length === 2, composed);
      // Each point carries its OWN card, not the reply's.
      const withCards = A.composeUnits(kept, { cardFor: (u) => '<source url="' + u + '">ص</source>' });
      eq('every point is attributed', (withCards.match(/<source /g) || []).length, 2);
    }

    // =========================================================================
    console.log('\n=== E. ZERO SURVIVING UNITS IS THE HONEST REFUSAL, NOT A CRASH ===');
    {
      const reply = '<unit source="' + PAGES[0].url + '" span="مقطع مختلق تمامًا لا يوجد">دعوى.</unit>';
      const { kept } = A.verifyUnits(A.parseUnits(reply), PAGES);
      eq('nothing survives', kept.length, 0);
      eq('...and the composition is empty', A.composeUnits(kept), '');
      // The handler turns that into the app's EXISTING «لم أقف» message rather than a new one.
      const ask = read('api/ask.js');
      ok('api/ask.js answers an empty anchor result with the existing refusal',
        /if \(!kept\.length\) \{[\s\S]{0,200}NO_VERIFIED_SOURCE_MESSAGE/.test(ask),
        'a new refusal sentence here would be a second thing to keep honest');
    }

    // =========================================================================
    console.log('\n=== F. TAKHRIJ HONESTY (قرار ٥) ===');
    {
      const supported = [{ url: 'x', passage: 'رواه البخاري في صحيحه وهو حديث صحيح عند أهل العلم' }];
      const a = A.honestTakhrij('البخاري', 'صحيح', supported);
      eq('a narrator the page carries survives', a.narrator, 'البخاري');
      eq('...and so does the grade', a.ruling, 'صحيح');
      const b = A.honestTakhrij('الترمذي', 'حسن', supported);
      eq('a narrator NO page carries is emptied', b.narrator, '');
      eq('...and so is the grade', b.ruling, '');
      ok('...and the drop is reported', b.dropped.length === 2, JSON.stringify(b.dropped));
      // WHOLE WORDS. «مسلم» inside «المسلمين» is how a hadith ends up credited to Muslim by a page
      // that merely mentions Muslims.
      eq('a name matched only as a substring does NOT count',
        A.honestTakhrij('مسلم', '', [{ url: 'x', passage: 'هذا حديث عن المسلمين جميعًا' }]).narrator, '');

      // THE TAG IS EMPTIED, THE MATN IS KEPT. index.html prints no «رَوَى …» line for an empty
      // narrator (P1-B), so this IS «the hadith with no takhrij line».
      const draft = '<hadith narrator="البخاري" ruling="صحيح">المتن الأول</hadith>'
        + ' و<hadith narrator="الترمذي" ruling="حسن">المتن الثاني</hadith>';
      const r = A.honestTakhrijInDraft(draft, supported);
      ok('the supported hadith keeps its takhrij', /narrator="البخاري"/.test(r.text));
      ok('the unsupported one is emptied', /narrator=""/.test(r.text) && /ruling=""/.test(r.text));
      ok('...but its MATN survives', /المتن الثاني/.test(r.text),
        'dropping the hadith because its credit was unverifiable is a different and worse thing');
      eq('...and nothing else moved', (r.text.match(/<hadith/g) || []).length, 2);
    }

    // =========================================================================
    console.log('\n=== G. THE WIRING, AND THAT IT IS FLAGGED ===');
    {
      const ask = read('api/ask.js');
      ok('api/ask.js imports the flag', /import \{ anchorModeEnabled \} from '\.\.\/lib\/anchor\/flag\.js';/.test(ask));
      ok('...and the unit contract', /parseUnits, verifyUnits, composeUnits/.test(ask));
      // THE BRANCH IS GUARDED. This is the assertion that keeps the shipped path shipped.
      ok('the anchor branch runs ONLY behind the flag', /if \(anchorModeEnabled\(\)\) \{/.test(ask));
      // ...and it sits BEFORE the streamed relay, because units cannot be checked after the
      // reader has read them.
      ok('...and buffers, ahead of the streamed round 2',
        ask.indexOf('if (anchorModeEnabled()) {') < ask.indexOf('// ── ROUND 2: streamed, WITHOUT tools'));
      ok('the model is taught the same shape the parser reads',
        /UNIT_INSTRUCTION/.test(ask) && /<unit source=/.test(read('lib/anchor/units.js')),
        'a taught shape that drifts from the parsed shape is a silent zero-unit reply');
      // The shipped composition is UNTOUCHED — the streamed relay is still there.
      ok('the streamed round 2 is still present and unchanged',
        /── ROUND 2: streamed, WITHOUT tools/.test(ask) && /stream: true/.test(ask));
    }

    ok('NOTHING in this gate reached the network', reached === 0, String(reached));

    // =========================================================================
    console.log('\n=== H. THE ROSTER ===');
    {
      const gates = JSON.parse(read('gates.json'));
      ok('gates.json lists this guard',
        gates.some((g) => g && g.script === 'guards/anchor-mode-guard.cjs'));
      ok('.gitattributes pins it to LF',
        /guards\/anchor-mode-guard\.cjs text eol=lf/.test(read('.gitattributes')));
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
