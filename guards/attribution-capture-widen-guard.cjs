// guards/attribution-capture-widen-guard.cjs
// A NAME THE MODEL CREDITS MUST BE SEEN WHETHER IT COMES BEFORE ITS VERB OR AFTER IT,
// AND WHETHER OR NOT IT IS VOWELLED.
//
// ── THE TWO DEFECTS THIS CLOSES, BOTH MEASURED ON f8701c4 ────────────────────
//
// (1) THE VERB LISTS DID NOT AGREE WITH EACH OTHER. lib/output-reviewer.js carries seven
//     attribution patterns. The six that read the CUE FIRST accept seven verbs
//     — قال · ذكر · أفتى · أجاب · يرى · تقول · قالت — and the one that reads the NAME first
//     accepted four of them. «ابن باز أجاب بأن الأمر جائز» therefore matched nothing at all:
//     no cue in front for the first six, and «أجاب» absent from the seventh's list. Measured
//     before the change: NOT captured, no annotation, the sentence carried its credit whole.
//
// (2) `\p{Script=Arabic}` DOES NOT MATCH A HARAKA. Arabic combining marks are
//     `Script=Inherited`, not `Script=Arabic`, so the name class stopped dead at the first
//     vowel sign. «قال ابنُ بازٍ إن الأمر جائز» never reached its connector through any
//     pattern. The mismatch was internal to the file rather than a matter of taste: the
//     boundary assertions in the very same seven patterns already spell `\p{M}` out
//     (`(?<![\p{Script=Arabic}\p{M}])`). Only the name class omitted it.
//
// ── WHY THE FIX IS IN THE CHARACTER CLASS AND NOT IN THE TEXT ────────────────
// lib/output-reviewer.js has a diacritic stripper (`ARABIC_DIACRITICS`) and it must not be
// used here. `detectAttribution` returns `match.index` and `match[0].length`, and its caller
// performs surgery on the ORIGINAL sentence with those offsets. Stripping marks before
// matching shifts every offset and the cut lands on the wrong character. So the class widens
// and the text is left alone.
//
// ── WHAT THIS GUARD REFUSES TO LET HAPPEN NEXT ──────────────────────────────
// Widening a capture door is the kind of change that is easy to overshoot: one more pattern,
// one more verb, `\p{M}` in the leading character so a name may begin with a floating vowel.
// Section D pins the shape — seven patterns, exactly, and the first character of a name is
// still a letter. Section B pins the other side: an adverbial «عندَ الوضوءِ» is not a credit
// to a man called «الوضوء», vowelled or bare, and adding `\p{M}` must not open it.
//
// Usage: node guards/attribution-capture-widen-guard.cjs
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
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

// ── THE CAPTURE IS REACHED THROUGH THE PUBLIC REVIEWER, NOT THROUGH A NEW EXPORT ──
// `ATTRIBUTION_PATTERNS` and `detectAttribution` are module-private and stay that way. The
// name the capture settled on is already public: `reviewAnswer` puts it on the annotation as
// `claimedAuthority`, and that is the same string `detectAttribution` returned. Nothing was
// added to lib/output-reviewer.js to let this guard see it.
function capturedName(REV, sentence) {
  const r = REV.reviewAnswer({ text: sentence, domain: 'fiqh', evidence: [] });
  const hit = r.annotations.find((a) => typeof a.claimedAuthority === 'string');
  return hit ? hit.claimedAuthority : null;
}

const FATHA = 'َ';
const vowelled = (name) => name.split(' ').filter(Boolean)
  .map((word) => (word.length ? word[0] + FATHA + word.slice(1) : word)).join(' ');

const SAID = 'قال';                                        // قال
const THAT_IT_IS_ALLOWED = ' إن الأمر جائز'; // إن الأمر جائز
const verbFirst = (name) => SAID + ' ' + name + THAT_IT_IS_ALLOWED;
const nameFirst = (name) => name + ' ' + SAID + THAT_IT_IS_ALLOWED;

// The name class as it must now read, and the one shape it must never take. Both are compared
// as literal source text, because this is a fingerprint of the file and not of its behaviour.
const NAME_CLASS = '(?<name>[\\p{Script=Arabic}][\\p{Script=Arabic}\\p{M}\\s]{1,55}?)';
const NAME_STARTS_ON_A_MARK = '(?<name>[\\p{Script=Arabic}\\p{M}]';

// ── ع-٧٤/أ · THE CUE-FIRST NAME IS BOUNDED IN WORDS AND STOPS ON A VERB ─────
// The first two patterns read the CUE first, so everything after the cue is a candidate name and
// the old class ran on for up to 55 characters across spaces. MEASURED on the owner's sentence:
// «قال ابن باز يحرم حلق اللحية، لأنه استئصال…» captured «ابن باز يحرم حلق اللحية» — the RULING
// swallowed into the name — and removing that left «لأنه…», a causal clause with nothing before
// it, so the fifth door kept the whole credit and marked it instead. The reader kept the name.
//
// So the cue-first class takes at most five further WORDS, lazily, and no word may be one of the
// stop verbs. It is pinned as literal source text, like NAME_CLASS, because it is a fingerprint
// of the file. The other five patterns keep NAME_CLASS: they are the ones whose right-hand side
// is already anchored on a ruling word or on the verb itself.
const CUE_STOP_VERBS = ['يحرم', 'يجوز', 'يجب', 'يكره', 'يستحب', 'يصح', 'يبطل',
  'قال', 'ذكر', 'أفتى', 'أجاب', 'يرى', 'تقول', 'قالت'];
const CUE_STOP = '(?:' + CUE_STOP_VERBS.join('|') + ')(?![\\p{Script=Arabic}\\p{M}])';
const CUE_FIRST_NAME_CLASS = '(?<name>[\\p{Script=Arabic}][\\p{Script=Arabic}\\p{M}]*'
  + '(?:\\s+(?!' + CUE_STOP + ')[\\p{Script=Arabic}][\\p{Script=Arabic}\\p{M}]*){0,5}?)';

// ── TWO MISMATCHES THAT PREDATE THIS PIECE, PINNED SO THEY CANNOT BE MISREAD AS ITS DOING ──
// Both were measured on f8701c4 BEFORE the name class was widened, and both survive it
// unchanged. Neither is a diacritic defect and neither is fixed here — widening the door
// further to make them green is exactly what section C exists to prevent. They are named,
// with the mechanism, so that the exclusion is a decision on the record; each is asserted to
// STILL be broken, so whoever repairs the real defect is told to delete its entry.
//
//   فركوس, name first: the seventh pattern opens `(?:[وف])?` for a leading conjunction, and
//   at the head of a sentence that alternative happily eats the ف of the man's own name. The
//   capture is «ركوس», which resolves to nobody. Vowelled it is correct, by accident: the
//   haraka after the ف cannot open a name, so the optional group gives the letter back.
//
//   الشيخ مطلق, verb first: the frame strips a leading «الشيخ» as a title, and this alias IS
//   «الشيخ مطلق». What is left, «مطلق», is one common word, and resolveScholar refuses one
//   common word on purpose. Vowelled it is correct, again by accident: «الَشيخ» is not the
//   bare literal the title group matches.
const KNOWN_PRE_EXISTING = Object.freeze([
  Object.freeze({
    domain: 'ferkous.app',
    alias: 'فركوس',
    shape: 'name-first',
    flavour: 'plain',
    captured: 'ركوس',
  }),
  Object.freeze({
    domain: 'dr-mutlaq.com',
    alias: 'الشيخ مطلق',
    shape: 'verb-first',
    flavour: 'plain',
    captured: 'مطلق',
  }),
  // M1+M2 night 3, task 3. «الدكتور مطلق» became an alias so defect 75’s last spelling
  // resolves. The capture is unchanged by that row and still wrong in exactly one of its four
  // combinations: the cue-first frame lists «الدكتور» among the honorifics it eats, so the
  // name that reaches resolveScholar is the bare «مطلق» — which is not an alias, on purpose.
  // Pinned, not excused: the vowelled twin passes, because a vowelled honorific is not the
  // literal the frame eats, and the name-first shape passes in both flavours.
  Object.freeze({
    domain: 'dr-mutlaq.com',
    alias: 'الدكتور مطلق',
    shape: 'verb-first',
    flavour: 'plain',
    captured: 'مطلق',
  }),
]);
const knownKey = (row) => [row.domain, row.alias, row.shape, row.flavour].join(' | ');

(async function main() {
  console.log('=== attribution-capture-widen-guard — the door opened, and only that far ===');

  const REV = await esm('lib/output-reviewer.js');
  const REG = await esm('lib/source-registry.js');
  const SP = await esm('lib/ledger/source-policy.js');

  ok('the reviewer exposes the name the capture settled on',
    typeof REV.reviewAnswer === 'function',
    'without reviewAnswer the capture is unreachable from outside the module');

  // =========================================================================
  console.log('\n=== A. THE DOOR REALLY OPENED — AND THE NAME COMES BACK WHOLE ===');
  {
    // «أجاب» in the trailing-verb list. Nothing else about this sentence is new.
    eq('«ابن باز أجاب بأن...» is captured as «ابن باز»',
      capturedName(REV, 'ابن باز أجاب بأن الأمر جائز'),
      'ابن باز');

    // ...and the widening stopped at the seven verbs the cue-first patterns already had.
    // «أجابت» is not one of them, and a committee answering is not a man being credited.
    eq('«اللجنة الدائمة أجابت» is still captured by nothing — the list grew to seven, not to eight',
      capturedName(REV, 'اللجنة الدائمة أجابت'),
      null);

    // The vowels. The name is returned WITH them: the offsets belong to the original sentence,
    // so a capture that came back stripped would be a capture cutting the wrong characters.
    eq('«قال ابنُ بازٍ إن...» is captured as «ابنُ بازٍ», vowels and all',
      capturedName(REV, 'قال ابنُ بازٍ إن الأمر جائز'),
      'ابنُ بازٍ');

    // Both defects in one sentence: the name leads, and it is vowelled.
    eq('«ابنُ عثيمينَ أفتى بأن...» is captured as «ابنُ عثيمينَ»',
      capturedName(REV, 'ابنُ عثيمينَ أفتى بأن ذلك جائز'),
      'ابنُ عثيمينَ');
  }

  // =========================================================================
  console.log('\n=== B. AND IT DID NOT OPEN FALSELY ===');
  {
    // «عند» is two different words and only what follows decides which. The adverbial one
    // credits nobody, and stripping it would cut a preposition off its object.
    eq('«عند الوضوء يجب غسل الوجه» credits nobody',
      capturedName(REV, 'عند الوضوء يجب غسل الوجه'),
      null);

    // THE MOST IMPORTANT LINE IN THIS FILE. The bare sentence above was refused by
    // framePointsAtAPerson. The vowelled one was, until this change, refused for a second and
    // accidental reason — the name class died on the first haraka. That accident is now gone,
    // so this line is the only thing standing between «عندَ الوضوءِ» and a shaykh named «الوضوء».
    eq('...and so does the same sentence vowelled, which \\p{M} could have opened by accident',
      capturedName(REV, 'عندَ الوضوءِ يجبُ غسلُ الوجهِ'),
      null);

    eq('«الحكم في المسألة ظاهر» has no attributing verb at all',
      capturedName(REV, 'الحكم في المسألة ظاهر'),
      null);
  }

  // =========================================================================
  console.log('\n=== C. NOTHING CHANGED FOR THE MEN THE REGISTRY ALREADY KNEW ===');
  {
    const rows = REG.SCHOLAR_SITES.filter((s) => s.aliases.length > 0);
    ok('there are scholar rows with aliases to sweep at all', rows.length >= 10, String(rows.length));

    const seen = new Set();
    const unexpected = [];
    let combos = 0;
    for (const row of rows) {
      for (const alias of row.aliases) {
        // The truth this sweep is measured against is the registry's own answer for the alias.
        const want = REG.resolveScholar(alias);
        for (const shape of ['verb-first', 'name-first']) {
          for (const flavour of ['plain', 'vowelled']) {
            combos++;
            const name = flavour === 'plain' ? alias : vowelled(alias);
            const sentence = shape === 'verb-first' ? verbFirst(name) : nameFirst(name);
            const got = capturedName(REV, sentence);
            const res = got === null ? { status: 'not-captured' } : REG.resolveScholar(got);
            const same = (res.domain || null) === (want.domain || null) && res.status === want.status;
            const key = knownKey({ domain: row.domain, alias, shape, flavour });
            const known = KNOWN_PRE_EXISTING.find((k) => knownKey(k) === key);
            if (same) {
              // A pinned exception that started passing is dead weight — say so loudly rather
              // than let the list rot into a silent excuse.
              if (known) {
                ok('pinned as pre-existing but now correct — delete its entry: ' + key, false,
                  'KNOWN_PRE_EXISTING must name only combinations that are still broken');
              }
              continue;
            }
            if (known) {
              seen.add(key);
              eq('pre-existing, unchanged by this piece: ' + key, got, known.captured);
              continue;
            }
            unexpected.push(key + '  captured=' + JSON.stringify(got)
              + '  want=' + want.status + '/' + (want.domain || '-')
              + '  got=' + res.status + '/' + (res.domain || '-'));
          }
        }
      }
    }
    console.log('        (' + combos + ' alias/shape/vowelling combinations swept)');
    eq('every alias still resolves exactly as the registry resolves it', unexpected, []);
    eq('...and every pinned pre-existing mismatch was actually met',
      KNOWN_PRE_EXISTING.map(knownKey).filter((k) => !seen.has(k)), []);

    // Recognising a vowelled name must not have admitted a single new domain to retrieval.
    // Compare keys, not a count: a coordinated registry change is legitimate, a one-sided
    // consumer change is drift.
    eq('the searchable surface is unchanged by the wider capture',
      SP.searchableDomains().slice().sort(),
      REG.activeSources().map((source) => source.domain).sort());
  }

  // =========================================================================
  console.log('\n=== D. THE SHAPE OF THE SCOPE ===');
  {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'output-reviewer.js'), 'utf8');
    const OPEN = 'const ATTRIBUTION_PATTERNS = Object.freeze([';
    const head = src.indexOf(OPEN);
    ok('the pattern table is where this guard expects it', head >= 0, OPEN + ' not found');
    const tail = src.indexOf('\n]);', head);
    const body = head >= 0 && tail > head ? src.slice(head + OPEN.length, tail) : '';
    const patterns = body.split('\n').map((line) => line.trim()).filter(Boolean);

    eq('there are exactly seven attribution patterns — the fix widened them, it did not add one',
      patterns.length, 7);
    eq('...and every entry is a single unicode regex literal',
      patterns.filter((p) => !(p.startsWith('/') && p.endsWith('/u,'))), []);
    // TWO CHECKS WHERE THERE WAS ONE, AND NEITHER IS WEAKER THAN THE CHECK IT SPLITS. The first
    // two patterns must carry the bounded lazy class; the other five must still carry the old one.
    // Asserting only "one of the two" would let a pattern drift between them unnoticed.
    eq('the two cue-first patterns carry the bounded lazy name class',
      patterns.slice(0, 2).filter((p) => !p.includes(CUE_FIRST_NAME_CLASS)).length, 0);
    eq('...and the other five still carry the widened class, unchanged',
      patterns.slice(2).filter((p) => !p.includes(NAME_CLASS)).length, 0);
    // (4) THE BOUND MUST STAY LAZY AND THE STOP LIST MUST STAY WHOLE. A greedy {0,5} eats the
    // ruling again the moment a name is short; a stop list missing a verb does the same for that
    // verb. Both are asserted on the source text, so neither can be relaxed silently.
    eq('the cue-first bound is lazy — «?» follows {0,5} in both patterns',
      patterns.slice(0, 2).filter((p) => !p.includes('{0,5}?')).length, 0);
    eq('...and no cue-first pattern carries a greedy bound',
      patterns.slice(0, 2).filter((p) => /\{0,5\}(?!\?)/u.test(p)).length, 0);
    eq('the stop list is exactly the fourteen verbs this guard names, in order',
      patterns.slice(0, 2).filter((p) => !p.includes(CUE_STOP)).length, 0);
    eq('...and every stop verb is checked as a whole word',
      CUE_STOP.includes('(?![\\p{Script=Arabic}\\p{M}])'), true);
    eq('the first six carry the frame group that lets the credit be cut without touching the claim',
      patterns.slice(0, 6).filter((p) => !p.includes('(?<frame>')).length, 0);
    // Recorded, not assumed: the seventh carries `frame` too, and its frame OPENS with the
    // name — that is what "name first" means in this table, and it is the pattern the verb
    // list was equalised on.
    ok('...and so does the seventh, whose frame opens on the name itself',
      patterns[6] ? patterns[6].includes('(?<frame>' + NAME_CLASS) : false,
      patterns[6] || '(no seventh pattern)');
    eq('no name may begin on a floating vowel — \\p{M} entered the tail of the class, never its head',
      patterns.filter((p) => p.includes(NAME_STARTS_ON_A_MARK)), []);

    // THE EQUALITY THAT WAS THE WHOLE FIRST DEFECT. The verbs the name-first pattern accepts
    // after the name are now, character for character, the verbs the cue-first patterns accept
    // before it. Read out of the file rather than typed here, so the two can never drift into
    // agreeing with this guard while disagreeing with each other.
    const FRAME_OPEN = '(?<frame>(?:';
    const FRAME_TAG = '(?<frame>';
    const lead = patterns[0] || '';
    const leadVerbs = lead.slice(lead.indexOf(FRAME_OPEN) + FRAME_OPEN.length,
      lead.indexOf(')', lead.indexOf(FRAME_OPEN) + FRAME_OPEN.length));
    // THE NAME-FIRST TAIL CARRIES TWO ALLOWANCES THE CUE-FIRST HEAD DOES NOT. A conjunction may
    // be written JOINED to the verb, and any letter of the verb may carry a haraka. Both are
    // spelled into the seventh pattern on purpose, and neither may change the LIST: read with
    // those two allowances normalised away, the verbs must still be the cue-first seven,
    // character for character. The conjunction group is SLICED OUT OF THE FIRST PATTERN rather
    // than written here, so this guard cannot drift into agreeing with itself.
    const MARKS = '\\p{M}*';
    const NAME_BOUND = '{1,55}?)\\s+';
    const conjAt = lead.indexOf(FRAME_TAG) - 9;
    const CONJ_GROUP = conjAt >= 0 ? lead.slice(conjAt, conjAt + 9) : '';
    ok('the leading-conjunction group is where this guard slices it from',
      CONJ_GROUP.startsWith('(?:[') && CONJ_GROUP.endsWith('])?'), JSON.stringify(CONJ_GROUP));
    const last = patterns[6] || '';
    const boundAt = last.indexOf(NAME_BOUND);
    const afterBound = boundAt < 0 ? '' : last.slice(boundAt + NAME_BOUND.length);
    const carriesConj = CONJ_GROUP.length === 9 && afterBound.startsWith(CONJ_GROUP);
    const verbOpen = (carriesConj ? CONJ_GROUP : '') + '(?:';
    const closeAt = afterBound.indexOf(')', verbOpen.length);
    const tailRaw = afterBound.startsWith(verbOpen) && closeAt > 0
      ? afterBound.slice(verbOpen.length, closeAt) : '';
    const tailVerbs = tailRaw.split(MARKS).join('');
    ok('the seventh pattern reaches a conjunction written joined to its verb', carriesConj,
      'expected the tail to open on ' + JSON.stringify(CONJ_GROUP));
    eq('...and every one of those verbs carries the haraka allowance',
      tailRaw.split('|').filter((v) => !v.endsWith(MARKS)), []);
    eq('the cue-first list is seven verbs long', leadVerbs.split('|').length, 7);
    eq('...and the name-first list is the same list, verbatim once both allowances are normalised',
      tailVerbs, leadVerbs);
  }

  // =========================================================================
  // ع-٧٥ · WHOLE QUESTIONS, NOT SENTENCES. Everything above measures what the REVIEWER
  // captures out of an answer. These rows measure the other end — what the REQUEST path
  // decides a reader asked — because that is where one registered man came out as four
  // different people. Three spellings of dr-mutlaq.com that the entity layer resolves
  // identically, and three contracts that must not move because of them.
  console.log('\n=== E. ع-٧٥ — ONE MAN, THREE SPELLINGS, ONE DOMAIN ===');
  {
    const PLAN = await esm('lib/ask-plan.js');
    const planFor = (question) => PLAN.planAsk([{ role: 'user', content: question }], {});

    // Every spelling here is an alias the registry already lists. What was broken was not the
    // roster, it was which string got to ask it.
    const SPELLINGS = [
      ['the full name', 'ما رأي مطلق الجاسر في هذه المسألة؟'],
      ['«الدكتور» + the given name', 'ما رأي الدكتور مطلق في هذه المسألة؟'],
      ['«د.» + the given name', 'ما رأي د. مطلق في هذه المسألة؟'],
    ];
    for (const [label, question] of SPELLINGS) {
      const plan = planFor(question);
      ok('ع-٧٥ ' + label + ' reaches dr-mutlaq.com',
        plan.officialDomain === 'dr-mutlaq.com' && plan.scholarStatus === 'resolved',
        JSON.stringify({ named: plan.namedEntity, status: plan.scholarStatus, domain: plan.officialDomain }));
      ok('ع-٧٥ ...and reports the canonical id with it — ' + label,
        plan.requestedAuthorityId === 'mutlaq-aljasir' && plan.attributionMode === 'namedScholarOpinion',
        JSON.stringify({ id: plan.requestedAuthorityId, mode: plan.attributionMode }));
      ok('ع-٧٥ ...and never asks WHICH shaykh once he is resolved — ' + label,
        plan.needsScholarIdentity === false, JSON.stringify(plan.needsScholarIdentity));
    }

    // THE ONE-WORD NAME IS STILL RESERVED. «مطلق» on its own is a common Arabic word, it is
    // deliberately not an alias, and it must stay unresolved. The fix reads the entity layer's
    // SURFACE, so if the surface were ever allowed to shrink to one word this row goes red.
    const bare = planFor('ما رأي مطلق في هذه المسألة؟');
    ok('ع-٧٥ the bare one-word «مطلق» is still reserved and resolves to nobody',
      bare.officialDomain === '' && bare.scholarStatus !== 'resolved'
        && bare.requestedAuthorityId === null,
      JSON.stringify({ status: bare.scholarStatus, domain: bare.officialDomain }));

    // ── THE THREE CONTRACTS THAT DO NOT MOVE ────────────────────────────────
    // Asking WHO a man is is not asking what he holds.
    const about = planFor('من هو مطلق الجاسر؟');
    ok('ع-٧٥ a question about the PERSON is still not a request for his position',
      about.attributionMode === 'none' && about.claimRelation === 'ABOUT_ENTITY'
        && about.officialDomain === '',
      JSON.stringify({ mode: about.attributionMode, relation: about.claimRelation }));

    // Asking for MATERIAL from a site is not asking for a position either.
    const material = planFor('أعطني مقالًا من موقع د. مطلق الجاسر');
    ok('ع-٧٥ a request for material from a site is unchanged',
      material.attributionMode !== 'namedScholarOpinion',
      JSON.stringify({ mode: material.attributionMode }));

    // Two registered men behind one name stay two.
    const ambiguous = planFor('ما رأي ابن حجر في هذه المسألة؟');
    ok('ع-٧٥ two men behind one name is still an ambiguity, not a pick',
      ambiguous.scholarStatus === 'ambiguous' && ambiguous.needsScholarIdentity === true
        && ambiguous.officialDomain === '' && ambiguous.scholarCandidates.length > 1,
      JSON.stringify({ status: ambiguous.scholarStatus, candidates: ambiguous.scholarCandidates }));

    // A man dead seven centuries has no official site, and must not be asked for one.
    const historical = planFor('ما رأي ابن تيمية فيمن ترك الصلاة تكاسلًا؟');
    ok('ع-٧٥ a historical authority is left on the era contract, not this one',
      historical.officialDomain === '' && historical.authorityEra === 'historical'
        && historical.requestedAuthorityId === 'ibn-taymiyyah',
      JSON.stringify({ era: historical.authorityEra, domain: historical.officialDomain }));

    // THE SURFACE AND THE ID COME FROM THE SAME ENTITY OR NEITHER IS TAKEN. The domain is
    // resolved from the surface and the id is reported beside it; if a refactor ever let one be
    // adopted without the other, these two would name two different men and this row goes red.
    for (const [label, question] of SPELLINGS) {
      const plan = planFor(question);
      const fromId = REG.resolveScholar(plan.namedEntity);
      ok('ع-٧٥ the reported id and the resolved domain are one man — ' + label,
        plan.requestedAuthorityId === 'mutlaq-aljasir' && fromId.status === 'resolved'
          && fromId.domain === plan.officialDomain,
        JSON.stringify({ id: plan.requestedAuthorityId, named: plan.namedEntity, domain: plan.officialDomain, viaSurface: fromId.domain }));
    }

    // ── THE TWO THINGS THE FIRST CUT OF THIS FIX BROKE ──────────────────────
    // Both were caught by gates smartretrieval and namepresence, and both are pinned here so the
    // narrowing that repaired them cannot be undone by widening the clause again.
    //
    // (1) A CAPTURE THAT ALREADY NAMES A MAN KEEPS DECIDING. The entity surface carries the
    //     honorific, so adopting it whenever one resolved person was present turned namedEntity
    //     into «الشيخ ابن عثيمين» — and the post-search note into «للشيخ الشيخ ابن عثيمين».
    const withTitle = planFor('ما رأي الشيخ ابن عثيمين في صلاة الوتر؟');
    ok('ع-٧٥ a name the capture already resolves keeps the string the capture settled on, title unrepeated',
      withTitle.namedEntity === 'ابن عثيمين' && withTitle.officialDomain === 'binothaimeen.net',
      JSON.stringify({ named: withTitle.namedEntity, domain: withTitle.officialDomain }));

    // (2) TWO REGISTERED MEN IN ONE QUESTION STAY TWO. The registry reads this as ambiguous; the
    //     entity layer splits it into one authority and one subject, and taking the authority
    //     would pick a man the reader never singled out.
    const twoMen = planFor('ما رأي خالد المصلح خالد السبت في الطلاق؟');
    ok('ع-٧٥ two registered men in one question is still an ambiguity, not a pick',
      twoMen.scholarStatus === 'ambiguous' && twoMen.officialDomain === ''
        && twoMen.needsScholarIdentity === true,
      JSON.stringify({ status: twoMen.scholarStatus, named: twoMen.namedEntity }));

    // (3) AND THE ENTITY MUST BE THE SAME MAN THE CAPTURE POINTED AT. Here the capture is a man
    //     no registry knows, and the one resolved authority is named in the OTHER clause. Reading
    //     that as his question answers somebody the reader did not ask about.
    const otherClause = planFor('قال ابن باز إن القصر سنة، فما رأي فلان الفلاني في قصر الصلاة؟');
    ok('ع-٧٥ a resolved man named in another clause never becomes the target',
      otherClause.namedEntity === 'فلان الفلاني' && otherClause.officialDomain === ''
        && otherClause.requestedAuthorityId === null,
      JSON.stringify({ named: otherClause.namedEntity, domain: otherClause.officialDomain, id: otherClause.requestedAuthorityId }));

    // A different registered contemporary must be untouched by all of the above.
    const other = planFor('ما رأي الشيخ عبدالمحسن العباد في الطلاق؟');
    ok('ع-٧٥ another registered contemporary is unchanged',
      other.officialDomain === 'al-abbaad.com' && other.requestedAuthorityId === 'al-abbaad',
      JSON.stringify({ domain: other.officialDomain, id: other.requestedAuthorityId }));
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('attribution-capture-widen-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
