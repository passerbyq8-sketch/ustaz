// guards/attribution-truth-guard.cjs
// A NAME THE ANSWER CREDITS MUST EITHER BE SUPPORTED BY EVIDENCE IN HAND, OR NOT BE THERE.
//
// ── WHAT THIS GUARD IS FOR (المرحلة ١ · صدق النسبة) ──
//
// The reviewer has three verdicts for a credited name and they are not interchangeable:
//
//   kept-sourced-attribution            evidence in hand supports it        → the name stays
//   kept-unsupported-attribution-marked no evidence, and cutting would      → the name stays, marked
//                                       hand the reader a broken sentence
//   removed-unsupported-attribution     no evidence, and the remainder      → the name goes
//                                       reads as Arabic
//
// The middle verdict is DELIBERATE and lib/output-reviewer.js says so where it lives: «مخرَجٌ
// مكسورٌ ليس حراسة». It is not the target of this guard and nothing here asks for it to be
// converted into a removal.
//
// ── THE SYMPTOM THE OWNER SAW IN PRODUCTION, WHICH IS WHY SECTION B EXISTS ──
// An answer in «موجز» mode quoted a phrase between brackets and credited it to a named book,
// «المحرر في الفقه الحنبلي» — while that mode never calls the library at all. A book title
// invented at the reader's face is the whole defect ع-٥٥, and a guard that measured everything
// EXCEPT that is the mistake this file refuses to repeat: attrwiden swept kunyas and passed
// green while the book card was broken. Section B is therefore written in the words the owner
// actually saw, not in a fixture that resembles them.
//
// ── WHAT IT REFUSES TO LET HAPPEN NEXT ──
// Section C pins the other side. A credit that HAS evidence must survive untouched, an
// adverbial «عندَ الوضوءِ» is not a shaykh called «الوضوء» vowelled or bare, and a sentence with
// no attributing verb is not a credit at all. Section D pins the shape of the scope — seven
// patterns, a name that may not begin on a floating vowel, and a retrieval surface that did not
// grow by one domain.
//
// Usage: node guards/attribution-truth-guard.cjs
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

// ── THE VERDICT IS READ OFF THE PUBLIC REVIEWER, NOT OFF A NEW EXPORT ──
// `detectAttribution`, `removalBreaksSentence` and the pattern table are module-private and stay
// that way. `reviewAnswer` already publishes what this guard needs: the action name on the
// annotation, and the string the capture settled on as `claimedAuthority`. Nothing was added to
// lib/output-reviewer.js to let this guard see anything.
function verdict(REV, sentence, evidence) {
  const r = REV.reviewAnswer({ text: sentence, domain: 'fiqh', evidence: evidence || [] });
  const hit = r.annotations.find((a) => typeof a.action === 'string' && a.action.indexOf('attribution') >= 0)
    || r.annotations[0] || null;
  return {
    action: hit ? hit.action : null,
    claimed: hit && typeof hit.claimedAuthority === 'string' ? hit.claimedAuthority : null,
    text: String(r.text == null ? '' : r.text),
  };
}
const nameSurvives = (out, needle) => out.text.indexOf(needle) >= 0;

// The eight compositions measured in المرحلة ٠, written here in the two shapes the probe used:
// the cue may come before the name or after it, the linker may be a connector or a colon, and
// the verb may carry a joined conjunction or a haraka.
const REMOVED = 'removed-unsupported-attribution';
const MARKED = 'kept-unsupported-attribution-marked';
const TAGGED = 'tagged-fiqh-understanding';
const KEPT = 'kept-sourced-attribution';

const CASES = Object.freeze([
  Object.freeze({ id: 'A · verb first, colon', text: 'قال ابن قدامة: الأمر في هذا واسع', name: 'ابن قدامة' }),
  Object.freeze({ id: 'B · name first, joined fa, colon', text: 'ابن قدامة فقال: الأمر في هذا واسع', name: 'ابن قدامة' }),
  Object.freeze({ id: 'C · name first, joined fa, vowelled', text: 'ابنُ قدامةَ فقالَ: الأمر في هذا واسع', name: 'قدامةَ' }),
  Object.freeze({ id: 'G · name first, joined fa on ذكر', text: 'ابن قدامة فذكر: الأمر في هذا واسع', name: 'ابن قدامة' }),
]);

// D · E · F · H — the four that reach a connector. They are measured, not asserted to a fixed
// verdict here: المرحلة ٠ found them landing on the marked branch through the middle-of-sentence
// door, and المرحلة ١ did not touch that door. Section A records WHICH of the two honest
// verdicts each one takes, and fails only if a name survives with no verdict attached to it.
const CONNECTOR_CASES = Object.freeze([
  Object.freeze({ id: 'D · name first, ذكر أن', text: 'وقد ابن قدامة ذكر أن الأمر في هذا واسع، والخلاف فيه معتبر', name: 'ابن قدامة' }),
  Object.freeze({ id: 'E · name first, قال إن', text: 'وقد قرر ابنُ قدامةَ قال إن الأمر واسع، والخلاف فيه معتبر', name: 'قدامةَ' }),
  Object.freeze({ id: 'F · name first, أفتى بأن', text: 'وقد ابن قدامة أفتى بأن الأمر في هذا واسع، والخلاف معتبر', name: 'ابن قدامة' }),
  Object.freeze({ id: 'H · honorific, يرى أن', text: 'وقد قرر الشيخ ابن قدامة يرى أن الأمر واسع، والخلاف معتبر', name: 'ابن قدامة' }),
]);

const HONEST = Object.freeze([REMOVED, MARKED]);

(async function main() {
  console.log('=== attribution-truth-guard — a credited name is supported, or it is not printed ===');

  const REV = await esm('lib/output-reviewer.js');
  const REG = await esm('lib/source-registry.js');
  const SP = await esm('lib/ledger/source-policy.js');

  ok('the reviewer exposes the verdict this guard reads',
    typeof REV.reviewAnswer === 'function',
    'without reviewAnswer the verdict is unreachable from outside the module');

  // =========================================================================
  console.log('\n=== A. THE EIGHT COMPOSITIONS OF المرحلة ٠ ===');
  {
    for (const row of CASES) {
      const out = verdict(REV, row.text, []);
      eq(row.id + ' → the credit is removed', out.action, REMOVED);
      ok(row.id + ' → ...and the name is gone from the delivered text',
        !nameSurvives(out, row.name),
        'text still carries ' + JSON.stringify(row.name) + ': ' + JSON.stringify(out.text.slice(0, 120)));
    }

    // The four that reach a connector. Either honest verdict is accepted; TAGGED is not, because
    // TAGGED means the capture never happened and the name went out unexamined.
    for (const row of CONNECTOR_CASES) {
      const out = verdict(REV, row.text, []);
      ok(row.id + ' → the credit is examined, not waved through as understanding',
        HONEST.indexOf(out.action) >= 0,
        'action=' + JSON.stringify(out.action) + ' (expected one of ' + JSON.stringify(HONEST) + ')');
      ok(row.id + ' → ...and when the name survives, it survives MARKED and never bare',
        out.action === REMOVED || (out.action === MARKED && out.text.length > 0),
        'action=' + JSON.stringify(out.action));
    }
  }

  // =========================================================================
  console.log('\n=== B. THE SYMPTOM THE OWNER SAW — A BOOK TITLE WITH NOTHING BEHIND IT ===');
  {
    // THE MOST IMPORTANT LINES IN THIS FILE. «موجز» never calls the library, so no lib_book atom
    // can be in hand; a sentence that credits a named book with an empty evidence bag is a title
    // invented by the model. It must not reach the reader as a sourced quotation.
    const BOOK = 'المحرر في الفقه الحنبلي';
    const sentence = 'قال المحرر في الفقه الحنبلي: (الأمر في هذا واسع) وهذا هو المعتمد';
    const out = verdict(REV, sentence, []);
    ok('a book credited with an empty evidence bag is examined, not delivered as fact',
      HONEST.indexOf(out.action) >= 0,
      'action=' + JSON.stringify(out.action));
    ok('...and the credit does not reach the reader as an unmarked sourced quotation',
      out.action === REMOVED || out.action === MARKED,
      'action=' + JSON.stringify(out.action));
    ok('...and the verdict is not the one that means the capture never happened',
      out.action !== TAGGED,
      'the sentence fell through to ' + JSON.stringify(TAGGED) + ', which is the defect itself');
    ok('the book name is not printed as a supported source',
      out.action !== KEPT,
      'claimed=' + JSON.stringify(out.claimed) + ' was treated as sourced with no evidence at all');
    ok('the guard is reading the sentence the owner actually saw',
      sentence.indexOf(BOOK) >= 0, 'fixture drifted away from the reported symptom');
  }

  // =========================================================================
  console.log('\n=== C. AND IT DID NOT WIDEN INTO A LIE ===');
  {
    // A credit WITH evidence behind it survives. This is the line that stops the fix from
    // becoming «strip every name», which would be a different defect wearing the same fix.
    const supported = 'قال ابن باز إن الأمر في هذا واسع';
    const evidence = [{
      id: 'ev-truth-1',
      scholar: 'ابن باز',
      title: 'حكم المسألة',
      snippet: 'قال ابن باز إن الأمر في هذا واسع',
      url: 'https://binbaz.org.sa/fatwas/1',
    }];
    const withEv = verdict(REV, supported, evidence);
    ok('a credit with evidence in hand is NOT stripped',
      withEv.action !== REMOVED,
      'action=' + JSON.stringify(withEv.action) + ' — evidence was in hand and the name was cut anyway');

    // «عند» is two different words and only what follows decides which.
    const adverbial = verdict(REV, 'عند الوضوء يجب غسل الوجه', []);
    eq('«عند الوضوء يجب غسل الوجه» credits nobody', adverbial.claimed, null);

    const adverbialVowelled = verdict(REV, 'عندَ الوضوءِ يجبُ غسلُ الوجهِ', []);
    eq('...and so does the same sentence vowelled', adverbialVowelled.claimed, null);

    const noVerb = verdict(REV, 'الحكم في المسألة ظاهر', []);
    eq('«الحكم في المسألة ظاهر» has no attributing verb at all', noVerb.claimed, null);
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
    eq('every pattern carries a named capture group for the name',
      patterns.filter((p) => !p.includes('(?<name>')).length, 0);
    eq('no name may begin on a floating vowel — \\p{M} belongs in the tail of the class, never its head',
      patterns.filter((p) => p.includes('(?<name>[\\p{Script=Arabic}\\p{M}]')), []);

    // Recognising more shapes of credit must not have admitted a single new domain to retrieval.
    // Compare keys, not a count: a coordinated registry change is legitimate, a one-sided
    // consumer change is drift.
    eq('the searchable surface did not grow by one domain',
      SP.searchableDomains().slice().sort(),
      REG.activeSources().map((source) => source.domain).sort());
  }

  // =========================================================================
  console.log('\n=== E. THE REMAINDER MUST KEEP ITS HEAD \u2014 A-81/a ===');
  {
    // The judge (removalBreaksSentence) strips \u00ab\u0625\u0646\u00bb, \u00ab\u0623\u0646\u00bb and \u00ab\u0628\u0623\u0646\u00bb off the claim so its start-anchored
    // test lands on the first real word. The reader must not receive that copy: after a colon \u00ab\u0625\u0646\u00bb
    // is the conditional that heads the quoted ruling, and cutting it handed the owner \u00ab\u0635\u0627\u0645\u0647 \u0644\u0633\u0628\u0628\u2026\u00bb,
    // a verb with nothing before it. \u00ab\u0623\u0646\u00bb / \u00ab\u0628\u0623\u0646\u00bb are subordinators a sentence cannot stand on, and
    // they still leave. Four checks, each read off the delivered text.

    // 1. The exact sentence the owner measured (A2), verbatim.
    const A2 = '\u0648\u0627\u0644\u0634\u064a\u062e \u0645\u062d\u0645\u062f \u0628\u0646 \u0635\u0627\u0644\u062d \u0627\u0644\u0639\u062b\u064a\u0645\u064a\u0646 \u0631\u062d\u0645\u0647 \u0627\u0644\u0644\u0647 \u0641\u0635\u0644 \u0641\u0642\u0627\u0644: \u0625\u0646 \u0635\u0627\u0645\u0647 \u0644\u0633\u0628\u0628 \u2014 \u0643\u0635\u0648\u0645 \u0639\u0631\u0641\u0629 \u0623\u0648 \u0639\u0627\u0634\u0648\u0631\u0627\u0621 \u0623\u0648 \u064a\u0648\u0645 \u0645\u0646 \u0623\u064a\u0627\u0645 \u0627\u0644\u0628\u064a\u0636 \u0623\u0648 \u0642\u0636\u0627\u0621 \u0623\u0648 \u0643\u0641\u0627\u0631\u0629 \u0623\u0648 \u0635\u064a\u0627\u0645 \u062f\u0627\u0648\u062f \u0641\u0648\u0627\u0641\u0642 \u0627\u0644\u0633\u0628\u062a \u2014 \u0641\u0644\u0627 \u0628\u0623\u0633 \u0628\u0647 \u0648\u0644\u0627 \u0643\u0631\u0627\u0647\u0629\u061b \u0648\u0625\u0646 \u0623\u0641\u0631\u062f\u0647 \u062a\u0639\u0638\u064a\u0645\u0627 \u0644\u0647 \u0645\u0646 \u063a\u064a\u0631 \u0633\u0628\u0628 \u0641\u0647\u0630\u0627 \u0645\u0648\u0636\u0639 \u0627\u0644\u0646\u0647\u064a.';
    const A2_HEAD = '\u0625\u0646 \u0635\u0627\u0645\u0647 \u0644\u0633\u0628\u0628';
    const A2_NAME = '\u0627\u0644\u0639\u062b\u064a\u0645\u064a\u0646';
    const a2 = verdict(REV, A2, []);
    ok('E1 \u00b7 the A2 sentence \u2192 removed, the delivered text opens on \u00ab\u0625\u0646 \u0635\u0627\u0645\u0647\u00bb, and the name is gone',
      a2.action === REMOVED && a2.text.indexOf(A2_HEAD) === 0 && a2.text.indexOf(A2_NAME) < 0,
      'action=' + JSON.stringify(a2.action) + ' text=' + JSON.stringify(a2.text.slice(0, 60)));

    // 2. A B-shaped input \u2014 name first, joined fa, colon, unquoted prose \u2014 is removed and the prose
    //    after the colon reaches the reader whole. This is the byte-identity line for B/C/G.
    const B_PROSE = '\u0627\u0644\u0623\u0645\u0631 \u0641\u064a \u0647\u0630\u0627 \u0648\u0627\u0633\u0639 \u0648\u0644\u0627 \u062d\u0631\u062c \u0641\u064a\u0647';
    const b = verdict(REV, '\u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629 \u0641\u0642\u0627\u0644: ' + B_PROSE, []);
    ok('E2 \u00b7 B-shape (name first, joined fa, colon, prose) \u2192 removed, and the remaining prose is intact',
      b.action === REMOVED && b.text.indexOf(B_PROSE) === 0 && b.text.indexOf('\u0642\u062f\u0627\u0645\u0629') < 0,
      'action=' + JSON.stringify(b.action) + ' text=' + JSON.stringify(b.text.slice(0, 60)));

    // 3. \u00ab\u0623\u0646\u00bb and \u00ab\u0628\u0623\u0646\u00bb after the colon are still taken off the delivered text.
    const AN_PROSE = '\u0627\u0644\u0623\u0645\u0631 \u0641\u064a \u0647\u0630\u0627 \u0648\u0627\u0633\u0639';
    const an = verdict(REV, '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629: \u0623\u0646 ' + AN_PROSE, []);
    const bian = verdict(REV, '\u0623\u0641\u062a\u0649 \u0627\u0628\u0646 \u0642\u062f\u0627\u0645\u0629: \u0628\u0623\u0646 ' + AN_PROSE, []);
    ok('E3 \u00b7 \u00ab\u0623\u0646\u00bb and \u00ab\u0628\u0623\u0646\u00bb are still stripped from the delivered text',
      an.action === REMOVED && an.text.indexOf(AN_PROSE) === 0
        && bian.action === REMOVED && bian.text.indexOf(AN_PROSE) === 0,
      'an=' + JSON.stringify(an.text.slice(0, 40)) + ' bian=' + JSON.stringify(bian.text.slice(0, 40)));

    // 4. A hadith matn is never removed. Only the matn is pinned here: measured on 2026-09-02 the
    //    frame \u00ab\u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644:\u00bb is itself read as an unsupported credit and cut, which
    //    is recorded as an incidental defect and deliberately not asserted either way.
    const MATN = '\u00ab\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a\u00bb';
    const h = verdict(REV, '\u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: ' + MATN, []);
    ok('E4 \u00b7 \u00ab\u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644: \u00ab\u2026\u00bb\u00bb \u2192 the hadith matn is never removed',
      h.text.indexOf(MATN) >= 0,
      'action=' + JSON.stringify(h.action) + ' text=' + JSON.stringify(h.text.slice(0, 60)));
  }

  // =========================================================================
  console.log('\n=== F. THE PROPHET\u2019S FRAME IS NEVER AN UNSUPPORTED CREDIT \u2014 M1 night 2, task 1 ===');
  {
    // Measured 2026-09-02 (section E, check 4, recorded but not asserted): \u00ab\u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645
    // \u0642\u0627\u0644: \u00ab\u2026\u00bb\u00bb was read as a credit to a scholar named \u00ab\u0623\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645\u00bb, the
    // ascription was cut, and the matn went out stamped as the machine's understanding. The
    // invariant: a frame that names the Prophet, peace be upon him, is NEVER
    // removed-unsupported-attribution; the ascription and the matn both reach the reader.
    // One check per spelling, in both frame shapes (\u00ab\u0642\u0627\u0644 X:\u00bb and \u00ab\u0623\u0646 X \u0642\u0627\u0644:\u00bb). What
    // answer-level notice the sentence then carries belongs to the takhrij contract and is not
    // asserted here either way.
    const MATN_F = '\u00ab\u0625\u0646\u0645\u0627 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0628\u0627\u0644\u0646\u064a\u0627\u062a\u00bb';
    const SPELLINGS = [
      ['\u0627\u0644\u0646\u0628\u064a', '\u0627\u0644\u0646\u0628\u064a'],
      ['\u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647', '\u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647'],
      ['\u0627\u0644\u0631\u0633\u0648\u0644', '\u0627\u0644\u0631\u0633\u0648\u0644'],
      ['\u0645\u062d\u0645\u062f \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645', '\u0645\u062d\u0645\u062f \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645'],
      ['\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645', '\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645'],
      ['\u0639\u0644\u064a\u0647 \u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0627\u0644\u0633\u0644\u0627\u0645', '\u0639\u0644\u064a\u0647 \u0627\u0644\u0635\u0644\u0627\u0629 \u0648\u0627\u0644\u0633\u0644\u0627\u0645'],
      ['\u0635\u0644\u0639\u0645', '\u0635\u0644\u0639\u0645'],
    ];
    let n = 0;
    for (const [spelling, needle] of SPELLINGS) {
      n += 1;
      const verbFirst = verdict(REV, '\u0642\u0627\u0644 ' + spelling + ': ' + MATN_F, []);
      const nameFirst = verdict(REV, '\u0623\u0646 ' + spelling + ' \u0642\u0627\u0644: ' + MATN_F, []);
      const holds = (o) => o.action !== REMOVED && o.text.indexOf(needle) >= 0 && o.text.indexOf(MATN_F) >= 0;
      ok('F' + n + ' \u00b7 \u00ab' + spelling + '\u00bb \u2192 never removed; the ascription and the matn both reach the reader',
        holds(verbFirst) && holds(nameFirst),
        'verb-first action=' + JSON.stringify(verbFirst.action) + ' text=' + JSON.stringify(verbFirst.text.slice(0, 80))
          + '\n        name-first action=' + JSON.stringify(nameFirst.action) + ' text=' + JSON.stringify(nameFirst.text.slice(0, 80)));
    }
    // The exemption is the Prophet's frame and nothing wider: a scholar credited in the SAME
    // sentence is still judged, and with no evidence in hand his credit still goes.
    const mixed = verdict(REV, '\u0648\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632: \u0625\u0646 \u0627\u0644\u0646\u0628\u064a \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 \u0642\u0627\u0644 ' + MATN_F, []);
    ok('F8 \u00b7 a scholar credit beside the Prophet\u2019s frame is still judged (\u0627\u0628\u0646 \u0628\u0627\u0632 removed, the hadith kept)',
      mixed.action === REMOVED && mixed.text.indexOf('\u0627\u0628\u0646 \u0628\u0627\u0632') < 0
        && mixed.text.indexOf('\u0627\u0644\u0646\u0628\u064a') >= 0 && mixed.text.indexOf(MATN_F) >= 0,
      'action=' + JSON.stringify(mixed.action) + ' text=' + JSON.stringify(mixed.text.slice(0, 80)));
  }

  // =========================================================================
  console.log('\n=== G. THE FIFTH DOOR \u2014 A REMAINDER CANNOT OPEN ON A CAUSAL PARTICLE (M1 night 2, task 2) ===');
  {
    // The owner's own sighting, reproduced 2026-09-02: \u00ab\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629\u060c \u0644\u0623\u0646\u0647 \u2026\u00bb lost its
    // credit through the four doors (none fired) and the reader received \u00ab\u0644\u0623\u0646\u0647 \u0627\u0633\u062a\u0626\u0635\u0627\u0644 \u2026\u00bb \u2014 a
    // causal clause with nothing before it. The fifth door: a remainder that opens on a
    // particle that cannot begin a sentence breaks the sentence, so the credit is KEPT and the
    // sentence marked. A2's remainder opens on the conditional \u00ab\u0625\u0646\u00bb, which heads a complete
    // sentence and must never join that list.
    //
    // THE OWNER'S OWN SENTENCE NO LONGER REACHES THAT DOOR, and G1 below now expects the opposite
    // verdict on his ruling: the capture that used to swallow his ruling into the name was
    // narrowed (\u0639-\u0667\u0664/\u0623), so the remainder no longer breaks and the name is removed. The door
    // itself is unchanged and G1b asserts it still fires on a remainder that really does break.
    const OWNER = '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629\u060c \u0644\u0623\u0646\u0647 \u0627\u0633\u062a\u0626\u0635\u0627\u0644 \u0644\u0644\u062d\u064a\u0629 \u0648\u0645\u062e\u0627\u0644\u0641\u0629 \u0644\u0644\u0633\u0646\u0629';
    // \u2500\u2500 THE OWNER RULED: REMOVAL (M1 close, 2026-09-03) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // THIS ROW EXPECTED THE OPPOSITE UNTIL TODAY, AND THE CHANGE IS THE OWNER'S, NOT THIS
    // GUARD'S JUDGEMENT. It used to read: the remainder opens on a causal particle, so the credit
    // is KEPT and the sentence marked. The owner's ruling is that an attribution to a named
    // scholar with no evidence behind it does not stay in front of the reader even marked \u2014 the
    // same thing \u0639-\u0665\u0665/\u0623 did in 1ed1803. So: the name goes, the ruling stays.
    //
    //   \u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629\u060c \u0644\u0623\u0646\u0647 \u2026  \u21d2  \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629\u060c \u0644\u0623\u0646\u0647 \u2026 + the mark
    //
    // WHAT MADE IT POSSIBLE is not a change to the fifth door \u2014 that door is untouched and is
    // still asserted alive two rows below. It is \u0639-\u0667\u0664/\u0623: the capture used to swallow the ruling
    // («\u0627\u0628\u0646 \u0628\u0627\u0632 \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629» as the NAME), so removing it really did leave a headless
    // clause. With the name bounded to «\u0627\u0628\u0646 \u0628\u0627\u0632», the remainder opens on its own ruling verb
    // and nothing breaks. The door was never wrong; it was being asked about the wrong span.
    const owner = verdict(REV, OWNER, []);
    ok('G1 \u00b7 [OWNER RULING] the owner\u2019s sentence \u2192 REMOVED: the name goes, the ruling stays',
      owner.action === REMOVED && owner.text.indexOf('\u0627\u0628\u0646 \u0628\u0627\u0632') < 0
        && owner.text.indexOf('\u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629') === 0,
      'action=' + JSON.stringify(owner.action) + ' text=' + JSON.stringify(owner.text.slice(0, 80)));

    // \ud83d\udd12 THE FIFTH DOOR IS NOT WEAKENED BY THAT RULING, AND HERE IS THE PROOF. A remainder
    // that really does open on a causal particle still keeps its credit and is marked instead \u2014
    // a broken delivered sentence is not a guard. Two spellings, one causal and one adversative.
    const stillBreaks = ['\u0644\u0623\u0646\u0647', '\u0648\u0644\u0643\u0646'].map((particle) =>
      verdict(REV, '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632: ' + particle + ' \u0627\u0633\u062a\u0626\u0635\u0627\u0644 \u0644\u0644\u062d\u064a\u0629 \u0648\u0645\u062e\u0627\u0644\u0641\u0629 \u0644\u0644\u0633\u0646\u0629', []));
    ok('G1b \u00b7 [RED] a remainder that DOES break is still kept and marked \u2014 the fifth door is alive',
      stillBreaks.every((v) => v.action === MARKED && v.text.indexOf('\u0627\u0628\u0646 \u0628\u0627\u0632') >= 0),
      'actions=' + JSON.stringify(stillBreaks.map((v) => v.action)));

    const A2G = '\u0648\u0627\u0644\u0634\u064a\u062e \u0645\u062d\u0645\u062f \u0628\u0646 \u0635\u0627\u0644\u062d \u0627\u0644\u0639\u062b\u064a\u0645\u064a\u0646 \u0631\u062d\u0645\u0647 \u0627\u0644\u0644\u0647 \u0641\u0635\u0644 \u0641\u0642\u0627\u0644: \u0625\u0646 \u0635\u0627\u0645\u0647 \u0644\u0633\u0628\u0628 \u2014 \u0643\u0635\u0648\u0645 \u0639\u0631\u0641\u0629 \u0623\u0648 \u0639\u0627\u0634\u0648\u0631\u0627\u0621 \u0623\u0648 \u064a\u0648\u0645 \u0645\u0646 \u0623\u064a\u0627\u0645 \u0627\u0644\u0628\u064a\u0636 \u0623\u0648 \u0642\u0636\u0627\u0621 \u0623\u0648 \u0643\u0641\u0627\u0631\u0629 \u0623\u0648 \u0635\u064a\u0627\u0645 \u062f\u0627\u0648\u062f \u0641\u0648\u0627\u0641\u0642 \u0627\u0644\u0633\u0628\u062a \u2014 \u0641\u0644\u0627 \u0628\u0623\u0633 \u0628\u0647 \u0648\u0644\u0627 \u0643\u0631\u0627\u0647\u0629\u061b \u0648\u0625\u0646 \u0623\u0641\u0631\u062f\u0647 \u062a\u0639\u0638\u064a\u0645\u0627 \u0644\u0647 \u0645\u0646 \u063a\u064a\u0631 \u0633\u0628\u0628 \u0641\u0647\u0630\u0627 \u0645\u0648\u0636\u0639 \u0627\u0644\u0646\u0647\u064a.';
    const a2g = verdict(REV, A2G, []);
    ok('G2 \u00b7 A2 did not flip: still removed, the delivered text still opens on \u00ab\u0625\u0646 \u0635\u0627\u0645\u0647\u00bb',
      a2g.action === REMOVED && a2g.text.indexOf('\u0625\u0646 \u0635\u0627\u0645\u0647 \u0644\u0633\u0628\u0628') === 0,
      'action=' + JSON.stringify(a2g.action) + ' text=' + JSON.stringify(a2g.text.slice(0, 60)));

    // \u2500\u2500 M1+M2 night 3, task 1: THE SAME PARTICLES CARRIED BY A JOINED \u00ab\u0648\u00bb OR \u00ab\u0641\u00bb \u2500\u2500
    // Measured 2026-09-03: the door matched the bare forms only, so \u00ab\u0648\u0644\u0623\u0646\u0647\u00bb, \u00ab\u0641\u0644\u0623\u0646\u0647\u00bb and
    // \u00ab\u0648\u0644\u0643\u0646\u00bb still shipped headless \u2014 28 of the parity harness's rows were removals where the
    // bare twin was a mark. G3 and G4 pin every joined form against its bare twin; G2 above is
    // untouched, and G1 changed with G3 on the owner's ruling, not on this guard's judgement. G5 is the [RED] line: the conditional stays removable in all
    // three spellings, because each of the three heads a complete sentence (A-81/a, 5047d92).
    const JOIN_HEAD = '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629\u060c ';
    const JOIN_TAIL = ' \u0627\u0633\u062a\u0626\u0635\u0627\u0644 \u0644\u0644\u062d\u064a\u0629 \u0648\u0645\u062e\u0627\u0644\u0641\u0629 \u0644\u0644\u0633\u0646\u0629';
    const JOIN_BASE = [
      '\u0644\u0623\u0646', '\u0644\u0623\u0646\u0647', '\u0644\u0623\u0646\u0647\u0627', '\u0644\u0623\u0646\u0647\u0645', '\u0644\u0643\u0648\u0646', '\u0625\u0630', '\u062d\u064a\u062b',
      '\u0628\u0644', '\u062b\u0645', '\u0641\u0642\u062f', '\u0648\u0630\u0644\u0643', '\u0645\u0645\u0627', '\u0644\u0643\u0646', '\u0644\u0643\u0646\u0647',
    ];
    const joinV = (p) => verdict(REV, JOIN_HEAD + p + JOIN_TAIL, []);
    const joinBad = [];
    const joinDrift = [];
    for (const p of JOIN_BASE) {
      const bare = joinV(p);
      for (const j of ['\u0648' + p, '\u0641' + p]) {
        const v = joinV(j);
        // [OWNER RULING] the verdict expected here changed from MARKED to REMOVED with G1 above,
        // for the same reason and on the owner's word. What is asserted is unchanged in COUNT and
        // stricter in content: the verdict, the name gone, and the delivered text opening on the
        // ruling rather than on the particle.
        if (v.action !== REMOVED || v.text.indexOf(j) === 0
          || v.text.indexOf('\u0627\u0628\u0646 \u0628\u0627\u0632') >= 0 || v.text.indexOf('\u064a\u062d\u0631\u0645 \u062d\u0644\u0642 \u0627\u0644\u0644\u062d\u064a\u0629') !== 0) joinBad.push(j + '=' + v.action);
        if (v.action !== bare.action) joinDrift.push(j + '(' + v.action + ')!=' + p + '(' + bare.action + ')');
      }
    }
    ok('G3 \u00b7 [OWNER RULING] all 28 joined forms \u2192 REMOVED, name gone, text opens on the ruling',
      joinBad.length === 0, 'offenders: ' + JSON.stringify(joinBad));
    ok('G4 \u00b7 every joined form has the same verdict as its bare twin',
      joinDrift.length === 0, 'drift: ' + JSON.stringify(joinDrift));

    const innaSpellings = ['\u0625\u0646', '\u0648\u0625\u0646', '\u0641\u0625\u0646'];
    const innaBad = innaSpellings.filter((p) => joinV(p).action !== REMOVED);
    ok('G5 \u00b7 [RED] \u00ab\u0625\u0646\u00bb, \u00ab\u0648\u0625\u0646\u00bb and \u00ab\u0641\u0625\u0646\u00bb are NOT on the door \u2014 all three still removable',
      innaBad.length === 0, 'joined the door: ' + JSON.stringify(innaBad));
  }

  console.log('\n=== H. THE WITNESS TAIL \u2014 ONE TAG, ONCE, AND A LADDER OF THREE (M1+M2 night 3, task 4) ===');
  {
    // The P2 packet measured five defects in the tail and the owner ruled on all of them:
    // no cross-sentence de-duplication, no check against the incoming text, no ladder between
    // the two answer-level notices, an exact-string de-duplication a variant tashkeel walks
    // through, and no idempotency. Everything below is read off the DELIVERED text.
    //
    // [RED] The sentence-level mark is never removed by the ladder \u2014 H4 is that line. Rungs 2
    // and 3 are the only pair the ladder decides.
    const R1 = '\u3010\u0641\u0647\u0645\u064c \u0644\u0627 \u0646\u0635\u064c\u0651 \u0645\u0646\u0642\u0648\u0644\u3011';
    const R2 = '\u3010\u0641\u0647\u0645\u064c \u0644\u0627 \u0641\u062a\u0648\u0649\u3011';
    const R3 = '\u3010\u0645\u0639\u0631\u0641\u0629\u064c \u0645\u0633\u062a\u0642\u0631\u0629 \u063a\u064a\u0631 \u0645\u0646\u0642\u0648\u0644\u0629\u3011';
    const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
    const bare = (value) => String(value).replace(MARKS, '');
    const count = (text, needle) => bare(text).split(bare(needle)).length - 1;
    const review = (text, domain, extra) => REV.reviewAnswer({
      text, domain, evidence: [], ...(extra || {}),
    }).text;

    const CREDIT = '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0625\u0646 \u0627\u0644\u0648\u0636\u0648\u0621 \u064a\u0628\u062f\u0623 \u0628\u0627\u0644\u0646\u064a\u0629.';
    // A fiqh sentence that `sentenceDomain` scopes to fiqh in the `mixed` domain too — that is
    // what makes H3 a real contradiction rather than a general answer with one notice.
    const PLAIN = '\u0648\u0627\u0644\u0648\u0636\u0648\u0621 \u064a\u0628\u062f\u0623 \u0628\u0627\u0644\u0646\u064a\u0629.';
    const GENERAL = '\u0627\u0644\u0645\u0627\u0621 \u064a\u063a\u0644\u064a \u0639\u0646\u062f \u0645\u0626\u0629 \u062f\u0631\u062c\u0629 \u0645\u0626\u0648\u064a\u0629.';

    const dup2 = review([CREDIT, CREDIT].join(' '), 'fiqh');
    ok('H1 \u00b7 two sentences that each lose a credit ship ONE sentence mark, not two',
      count(dup2, R1) === 1, 'rung1=' + count(dup2, R1));

    const dup4 = review([CREDIT, CREDIT, CREDIT, CREDIT].join(' '), 'fiqh');
    ok('H2 \u00b7 four of them still ship ONE',
      count(dup4, R1) === 1, 'rung1=' + count(dup4, R1));

    const bothNotices = review([PLAIN, GENERAL].join(' '), 'mixed');
    ok('H3 \u00b7 the two answer-level notices no longer contradict: rung 2 ships, rung 3 yields',
      count(bothNotices, R2) === 1 && count(bothNotices, R3) === 0,
      'rung2=' + count(bothNotices, R2) + ' rung3=' + count(bothNotices, R3));

    const rung1and2 = review([CREDIT, PLAIN].join(' '), 'fiqh');
    ok('H4 \u00b7 [RED] the sentence mark is NEVER removed by the ladder \u2014 rung 1 and rung 2 together',
      count(rung1and2, R1) === 1 && count(rung1and2, R2) === 1,
      'rung1=' + count(rung1and2, R1) + ' rung2=' + count(rung1and2, R2));

    const rung3vs1 = review([CREDIT, GENERAL].join(' '), 'mixed');
    ok('H5 \u00b7 rung 3 yields to a sentence carrying rung 1 \u2014 it cannot assert nothing was quoted',
      count(rung3vs1, R1) === 1 && count(rung3vs1, R3) === 0,
      'rung1=' + count(rung3vs1, R1) + ' rung3=' + count(rung3vs1, R3));

    const echo2 = review([PLAIN, R2 + ' ' + '\u0645\u0627 \u062a\u0642\u062f\u0651\u0645 \u0641\u0647\u0645\u064c \u0645\u0628\u0646\u064a\u064c\u0651 \u0639\u0644\u0649 \u0645\u0627 \u0628\u064a\u0646 \u064a\u062f\u064a\u0651 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062f\u0648\u0631\u0629.'].join('\n'), 'fiqh');
    ok('H6 \u00b7 a rung-2 tag the model echoed suppresses the duplicate footer',
      count(echo2, R2) === 1, 'rung2=' + count(echo2, R2));

    const echo3 = review([GENERAL, R3 + ' ' + '\u0645\u0627 \u062a\u0642\u062f\u0651\u0645 \u0645\u0639\u0631\u0641\u0629\u064c \u0639\u0627\u0645\u0651\u0629\u064c \u0645\u0633\u062a\u0642\u0631\u0651\u0629.'].join('\n'), 'general');
    ok('H7 \u00b7 and so does an echoed rung-3 tag',
      count(echo3, R3) === 1, 'rung3=' + count(echo3, R3));

    const echo2var = review([PLAIN, '\u3010\u0641\u0647\u0645 \u0644\u0627 \u0641\u062a\u0648\u0649\u3011' + ' ' + '\u0645\u0627 \u062a\u0642\u062f\u0645 \u0641\u0647\u0645 \u0645\u0628\u0646\u064a \u0639\u0644\u0649 \u0645\u0627 \u0628\u064a\u0646 \u064a\u062f\u064a \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062f\u0648\u0631\u0629.'].join('\n'), 'fiqh');
    ok('H8 \u00b7 the echo check is diacritic-insensitive \u2014 a variant tashkeel footer is still seen',
      count(echo2var, R2) === 1, 'rung2=' + count(echo2var, R2));

    // The variant form INSIDE the sentence being marked. The exact-string reader could not see
    // it and stamped a second mark on the same sentence.
    const variantInline = review('\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0625\u0646 \u0627\u0644\u0648\u0636\u0648\u0621 \u3010\u0641\u0647\u0645 \u0644\u0627 \u0646\u0635 \u0645\u0646\u0642\u0648\u0644\u3011 \u064a\u0628\u062f\u0623 \u0628\u0627\u0644\u0646\u064a\u0629.', 'fiqh');
    ok('H9 \u00b7 a sentence already carrying a variant-spelled rung 1 receives no second mark',
      count(variantInline, R1) === 1, 'rung1=' + count(variantInline, R1));

    // \u00a7\u0665/\u0661 \u2014 the stream may not withdraw text the reader holds, so de-duplication happens
    // BEFORE emission: the ledger is consulted at each tag() call, and the footer assembler is
    // literally the same function. The two paths must therefore agree byte for byte.
    const streamed = (text, domain) => {
      const st = REV.createReviewStream({ domain, evidence: [] });
      st.push(text);
      return st.end();
    };
    const streamCases = [
      [[CREDIT, CREDIT].join(' '), 'fiqh'],
      [[CREDIT, CREDIT, CREDIT, CREDIT].join(' '), 'fiqh'],
      [[PLAIN, GENERAL].join(' '), 'mixed'],
      [[CREDIT, GENERAL].join(' '), 'mixed'],
      [[PLAIN, R2 + ' ' + '\u0645\u0627 \u062a\u0642\u062f\u0651\u0645 \u0641\u0647\u0645\u064c \u0645\u0628\u0646\u064a\u064c\u0651 \u0639\u0644\u0649 \u0645\u0627 \u0628\u064a\u0646 \u064a\u062f\u064a\u0651 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062f\u0648\u0631\u0629.'].join('\n'), 'fiqh'],
      // ع-٧٧ · the three duplicate-input shapes, so the stream drops the later copy exactly where
      // the batch path drops it. A stream that de-duplicated differently would either ship a
      // second tag the batch path removed, or withdraw one the reader already holds.
      ['\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 ' + R1 + ' \u0648\u0642\u062f \u0646\u0635 \u0639\u0644\u064a\u0647 \u063a\u064a\u0631 \u0648\u0627\u062d\u062f ' + R1, 'fiqh'],
      ['\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 ' + R1 + '. \u0648\u0647\u0630\u0627 \u0645\u0642\u0631\u0631 ' + R1, 'fiqh'],
      ['\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 \u0648\u0644\u0627 \u062e\u0644\u0627\u0641 \u0641\u064a\u0647. ' + R2 + ' \u0648\u0647\u0630\u0627 \u0643\u0630\u0644\u0643. ' + R2, 'fiqh'],
    ];
    const streamDrift = [];
    for (const [text, domain] of streamCases) {
      const res = streamed(text, domain);
      if (res.text !== review(text, domain)) streamDrift.push(domain + JSON.stringify(text.slice(0, 24)));
      if (Array.isArray(res.violations) && res.violations.length) streamDrift.push(JSON.stringify(res.violations));
    }
    ok('H10 \u00b7 the streaming path ships exactly what the batch path ships, and reports no violation',
      streamDrift.length === 0, 'drift: ' + JSON.stringify(streamDrift));

    // ع-٧٧ · THE PREFIX IS STABLE. The reader holds what has already been sent, so a de-duplication
    // that reached backwards would take a tag out of text already on the screen. Fed one chunk at
    // a time, every intermediate emission must be a PREFIX of the final text — nothing rewritten,
    // nothing withdrawn, only more added.
    const prefixDrift = [];
    for (const [text, domain] of [
      ['\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 ' + R1 + ' \u0648\u0642\u062f \u0646\u0635 \u0639\u0644\u064a\u0647 \u063a\u064a\u0631 \u0648\u0627\u062d\u062f ' + R1, 'fiqh'],
      ['\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 \u0648\u0644\u0627 \u062e\u0644\u0627\u0641 \u0641\u064a\u0647. ' + R2 + ' \u0648\u0647\u0630\u0627 \u0643\u0630\u0644\u0643. ' + R2, 'fiqh'],
      [[CREDIT, CREDIT, CREDIT].join(' '), 'fiqh'],
    ]) {
      const st = REV.createReviewStream({ domain, evidence: [] });
      let sent = '';
      const seenPrefixes = [];
      for (const chunk of String(text).match(/[\s\S]{1,17}/gu) || []) {
        const piece = st.push(chunk);
        if (typeof piece === 'string') sent += piece;
        else if (piece && typeof piece.text === 'string') sent += piece.text;
        seenPrefixes.push(sent);
      }
      const final = st.end();
      const whole = typeof final === 'string' ? final : final.text;
      for (const seen of seenPrefixes) {
        if (seen && whole.indexOf(seen) !== 0) {
          prefixDrift.push(domain + ' :: ' + JSON.stringify(seen.slice(0, 60)));
          break;
        }
      }
    }
    ok('H10b \u00b7 [RED] every intermediate emission is a PREFIX of the final text \u2014 nothing is withdrawn',
      prefixDrift.length === 0, 'drift: ' + JSON.stringify(prefixDrift));

    // (d) A review of an already-reviewed answer never ADDS a notice the first pass did not
    // write, and the text converges: pass 3 equals pass 2. It was not idempotent at all before \u2014
    // every pass added one more tag, without bound.
    const idemCases = [
      [CREDIT, 'fiqh'], [[CREDIT, CREDIT].join(' '), 'fiqh'], [[CREDIT, PLAIN].join(' '), 'fiqh'],
      [PLAIN, 'fiqh'], [GENERAL, 'general'], [[PLAIN, GENERAL].join(' '), 'mixed'],
    ];
    const grew = [];
    const notConverged = [];
    for (const [text, domain] of idemCases) {
      const p1 = review(text, domain);
      const p2 = review(p1, domain);
      const p3 = review(p2, domain);
      for (const [name, tagText] of [['r1', R1], ['r2', R2], ['r3', R3]]) {
        if (count(p2, tagText) > Math.max(1, count(p1, tagText))) {
          grew.push(domain + '/' + name + ': ' + count(p1, tagText) + '->' + count(p2, tagText));
        }
      }
      if (p3 !== p2) notConverged.push(domain + JSON.stringify(text.slice(0, 24)));
    }
    ok('H11 \u00b7 a second pass never ships a tag more than once \u2014 no notice is ever duplicated',
      grew.length === 0, 'grew: ' + JSON.stringify(grew));
    ok('H12 \u00b7 and the text converges: the third pass is byte-identical to the second',
      notConverged.length === 0, 'still moving: ' + JSON.stringify(notConverged));

    // ── ع-٧٧ · WHAT ARRIVES DUPLICATED MUST NOT LEAVE DUPLICATED ──────────────
    // ع-١٩ killed the repetition the reviewer PRODUCES; these two rows pin the other half, the
    // one that was measured at 2 in / 2 out. The first copy keeps the harakat it arrived with and
    // every later copy of the SAME TYPE goes — inline, and in the answer-level tail.
    // The tag strings come from the module, never hand-typed: tag-honesty pins every spelling in
    // this repository to the runtime code-point sequence, and a typed shadda lands in the other order.
    const MARK = REV.REVIEW_TAGS.ATTRIBUTION_REMOVED;
    const NOTICE = REV.REVIEW_TAGS.FIQH_UNSOURCED;
    const countOf = (haystack, needle) => haystack.split(needle).length - 1;
    const unvowelled = (value) => value.replace(/[\u064B-\u0652\u0670]/gu, '');

    const dupInline = verdict(REV, '\u0627\u0644\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0638\u0627\u0647\u0631 ' + MARK
      + ' \u0648\u0642\u062f \u0646\u0635 \u0639\u0644\u064a\u0647 \u063a\u064a\u0631 \u0648\u0627\u062d\u062f ' + MARK, []);
    ok('duplicate-input (inline) \u00b7 two sentence marks arrive, one is delivered',
      countOf(unvowelled(dupInline.text), unvowelled(MARK)) === 1,
      'count=' + countOf(unvowelled(dupInline.text), unvowelled(MARK)) + ' text=' + JSON.stringify(dupInline.text.slice(0, 90)));

    const dupTail = verdict(REV, '\u0627\u0644\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0638\u0627\u0647\u0631 \u0648\u0644\u0627 \u062e\u0644\u0627\u0641 \u0641\u064a\u0647. ' + NOTICE
      + ' \u0648\u0647\u0630\u0627 \u0643\u0630\u0644\u0643. ' + NOTICE, []);
    ok('duplicate-input (tail) \u00b7 two answer-level notices arrive, one is delivered',
      countOf(unvowelled(dupTail.text), unvowelled(NOTICE)) === 1,
      'count=' + countOf(unvowelled(dupTail.text), unvowelled(NOTICE)) + ' text=' + JSON.stringify(dupTail.text.slice(0, 90)));

    // THE FIRST COPY KEEPS ITS OWN SPELLING. A variant tashkeel is the SAME tag for the purpose of
    // counting, and the one that survives is the one that arrived first, byte for byte.
    const variant = MARK.replace(/[\u064B-\u0652\u0670]/gu, '');
    const mixed = verdict(REV, '\u0627\u0644\u062d\u0643\u0645 \u0638\u0627\u0647\u0631 ' + variant + ' \u0648\u0642\u062f \u0646\u0635 \u0639\u0644\u064a\u0647 \u063a\u064a\u0631 \u0648\u0627\u062d\u062f ' + MARK, []);
    ok('duplicate-input \u00b7 a variant tashkeel is the same tag, and the FIRST spelling survives',
      countOf(unvowelled(mixed.text), unvowelled(MARK)) === 1 && mixed.text.indexOf(variant) >= 0,
      'count=' + countOf(unvowelled(mixed.text), unvowelled(MARK)) + ' text=' + JSON.stringify(mixed.text.slice(0, 90)));

    // IDEMPOTENCY: reviewing the delivered text again must add nothing and remove nothing.
    const once = verdict(REV, '\u0627\u0644\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0638\u0627\u0647\u0631 ' + MARK + ' \u0648\u0642\u062f \u0646\u0635 \u0639\u0644\u064a\u0647 ' + MARK, []);
    const twice = verdict(REV, once.text, []);
    ok('duplicate-input \u00b7 idempotent \u2014 a second pass over the delivered text changes nothing',
      twice.text === once.text, JSON.stringify({ once: once.text.slice(0, 80), twice: twice.text.slice(0, 80) }));

    // 🔒 AND THE FLOOD THE REVIEWER ITSELF PRODUCES IS STILL VISIBLE. This de-duplication reads
    // what ARRIVED, before anything is written, so a writer that stamps the notice onto every
    // sentence is not absorbed here — that is what the mutant in tag-honesty catches, and it must
    // keep catching it. Asserted from the outside: a plain answer carrying NO incoming tag is
    // delivered with exactly the tags the reviewer decided on, no more and no fewer.
    const clean = verdict(REV, '\u0642\u0627\u0644 \u0627\u0628\u0646 \u0628\u0627\u0632 \u0625\u0646 \u0627\u0644\u0623\u0645\u0631 \u062c\u0627\u0626\u0632', []);
    ok('duplicate-input \u00b7 [RED] an answer with no incoming tag is untouched by the new reader',
      countOf(unvowelled(clean.text), unvowelled(MARK)) === 1,
      'count=' + countOf(unvowelled(clean.text), unvowelled(MARK)) + ' text=' + JSON.stringify(clean.text.slice(0, 90)));
  }
  console.log('\n=== I. THE PERSON ASKED ABOUT IS THE PERSON ANSWERED ABOUT (E75) ===');
  // Every check above asks «is this sourced?». None of them asks «is this the RIGHT MAN?», and
  // that gap is what the owner met on his phone: the question named one scholar and the answer
  // reported that it found no fatwa for a DIFFERENT scholar entirely. Nothing false was
  // attributed. The PERSON was swapped, and no rule in lib/output-reviewer.js was broken.
  //
  // The detector fires ONLY when the plan actually carried a requested authority — api/ask.js
  // gates that on the plan's post-veto `attributionMode`, so a question that merely mentions a
  // scholar in passing arrives here as `null`. THE LAST FOUR CHECKS ARE THE OVER-BLOCKING RED
  // LINE, and they are not decoration: a notice appended to a correct answer is a new defect.
  {
    const IBN_BAZ = { id: 'ibn-baz', name: '\u0627\u0628\u0646 \u0628\u0627\u0632', status: 'resolved', candidates: [] };
    const HAJAR = {
      id: '', name: '\u0627\u0628\u0646 \u062d\u062c\u0631', status: 'ambiguous',
      candidates: ['\u0627\u0628\u0646 \u062d\u062c\u0631 \u0627\u0644\u0639\u0633\u0642\u0644\u0627\u0646\u064a',
        '\u0627\u0628\u0646 \u062d\u062c\u0631 \u0627\u0644\u0647\u064a\u062a\u0645\u064a'],
    };
    const UNKNOWN = { id: '', name: '\u0641\u0644\u0627\u0646 \u0627\u0644\u0641\u0644\u0627\u0646\u064a', status: 'unresolved', candidates: [] };

    // A LICENCE FOR THE OTHER MAN, so his name survives the attribution rule and the delivered
    // text really does speak about him. Without it the reviewer strips him first and no swap ever
    // reaches a reader — a different outcome, already guarded by section A, and a fixture that
    // omitted this would be pinning the wrong thing while looking green.
    const evFor = (scholar, host, body) => [{
      id: 'e', scholar, title: '\u062d\u0643\u0645 \u0627\u0644\u0645\u0633\u0623\u0644\u0629',
      url: 'https://' + host + '/fatwas/1/x', date: '2020-01-01', text: body,
    }];
    const FAWZAN = '\u0635\u0627\u0644\u062d \u0627\u0644\u0641\u0648\u0632\u0627\u0646';
    const BAZ = '\u0627\u0628\u0646 \u0628\u0627\u0632';
    const UTH = '\u0627\u0628\u0646 \u0639\u062b\u064a\u0645\u064a\u0646';
    // «قال {name} إنّ الأمر جائز.»
    const said = (who) => '\u0642\u0627\u0644 ' + who + ' \u0625\u0646\u0651 \u0627\u0644\u0623\u0645\u0631 \u062c\u0627\u0626\u0632.';
    // «لم أعثر على فتوى للشيخ {name} في هذه المسألة.»
    const noneFor = (who) => '\u0644\u0645 \u0623\u0639\u062b\u0631 \u0639\u0644\u0649 \u0641\u062a\u0648\u0649 \u0644\u0644\u0634\u064a\u062e '
      + who + ' \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0623\u0644\u0629.';
    const body = (who) => '\u0642\u0627\u0644 ' + who
      + ' \u0625\u0646 \u0627\u0644\u0623\u0645\u0631 \u062c\u0627\u0626\u0632 \u0648\u0644\u0627 \u062d\u0631\u062c \u0641\u064a\u0647 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0623\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u0645\u0630\u0643\u0648\u0631.';

    const judge = (text, requestedIdentity, evidence) => {
      const r = REV.reviewAnswer({ text, domain: 'fiqh', evidence: evidence || [], requestedIdentity });
      return {
        respected: r.verdict.requestedIdentityRespected,
        reason: r.verdict.requestedIdentityReason,
        text: String(r.text == null ? '' : r.text),
      };
    };

    // ── THE FIELD IS ALWAYS PUBLISHED, so a caller can tell «respected» from «not checked» ──
    const untouched = judge(said(BAZ), undefined, []);
    ok('E75 \u00b7 the verdict always carries requestedIdentityRespected',
      untouched.respected === true && untouched.reason === '',
      JSON.stringify(untouched));

    // ── 1. MISMATCH: asked about X, the answer speaks about a resolved Y ──
    const swap = judge(said(FAWZAN), IBN_BAZ, evFor(FAWZAN, 'af.org.sa', body(FAWZAN)));
    ok('E75 \u00b7 asked about one man, answered about another \u2014 caught',
      swap.respected === false && swap.reason === 'mismatch-another-authority',
      JSON.stringify(swap));

    // ── 2. ABSENCE REPORTED ABOUT A DIFFERENT PERSON — the measured screenshot ──
    // It credits nobody with anything, so every attribution check above is silent on it. That is
    // exactly why this one is written in the owner's own shape rather than in a tidier fixture.
    const wrongAbsence = judge(noneFor(FAWZAN), IBN_BAZ, []);
    ok('E75 \u00b7 «no fatwa found for <someone else>» \u2014 caught',
      wrongAbsence.respected === false && wrongAbsence.reason === 'mismatch-another-authority',
      JSON.stringify(wrongAbsence));

    // ── 3. AMBIGUOUS STAYS AMBIGUOUS, AND BOTH MEN ARE NAMED IN THE NOTICE ──
    const oneOfTwo = judge(said(HAJAR.candidates[0]), HAJAR, []);
    ok('E75 \u00b7 an ambiguous name answered about ONE of the two \u2014 caught',
      oneOfTwo.respected === false && oneOfTwo.reason === 'ambiguous-not-both-named',
      JSON.stringify(oneOfTwo));
    ok('E75 \u00b7 ...and the notice NAMES both candidates, never picks one',
      oneOfTwo.text.indexOf(HAJAR.candidates[0]) >= 0 && oneOfTwo.text.indexOf(HAJAR.candidates[1]) >= 0,
      JSON.stringify(oneOfTwo.text.slice(-160)));

    // ── 4. UNRESOLVED IS NOT ANSWERED WITH THE NEAREST MATCH ──
    const nearest = judge(said(UTH), UNKNOWN, evFor(UTH, 'binothaimeen.net', body(UTH)));
    ok('E75 \u00b7 an unidentified man answered about with a nearest match \u2014 caught',
      nearest.respected === false && nearest.reason === 'unresolved-substituted',
      JSON.stringify(nearest));

    // ═══ THE OVER-BLOCKING RED LINE. A notice on a correct answer is a NEW DEFECT. ═══

    // 🔒 5. THE RIGHT MAN, ANSWERED ABOUT BY NAME.
    const right = judge(said(BAZ), IBN_BAZ, evFor(BAZ, 'binbaz.org.sa', body(BAZ)));
    ok('E75 \u00b7 [RED] a correct answer about the right man is NOT caught',
      right.respected === true && right.reason === '', JSON.stringify(right));

    // 🔒 6. ABSENCE ABOUT THE RIGHT MAN. Clause (d): «say it about HIM by name» is the honest
    // answer, not the defect, and it must never be marked as a swap.
    const rightAbsence = judge(noneFor(BAZ), IBN_BAZ, []);
    ok('E75 \u00b7 [RED] absence reported about the RIGHT man is NOT caught',
      rightAbsence.respected === true, JSON.stringify(rightAbsence));

    // 🔒 7. THE RIGHT MAN NAMED ALONGSIDE ANOTHER. An answer that says «قال ابن باز… وإليه ذهب
    // الفوزان» is a normal sourced answer, not a swap: the man asked about IS in it. A detector
    // keyed on «is any other scholar present» rather than «is HE absent» would fire here.
    const alongside = judge(
      said(BAZ).replace('.', '\u060c \u0648\u0625\u0644\u064a\u0647 \u0630\u0647\u0628 ' + FAWZAN + '.'),
      IBN_BAZ, evFor(BAZ, 'binbaz.org.sa', body(BAZ) + ' ' + said(FAWZAN)),
    );
    ok('E75 \u00b7 [RED] the right man named ALONGSIDE another is NOT caught',
      alongside.respected === true, JSON.stringify(alongside));

    // 🔒 8. BOTH AMBIGUOUS CANDIDATES NAMED, THE SECOND BEHIND A WAW. «وابن حجر الهيتمي» is one
    // word in Arabic, and a plain word boundary does not find him inside it — MEASURED, and it
    // turned the one answer the order demands (a clarification naming both) into a false catch.
    const bothNamed = judge(
      HAJAR.candidates[0] + ' \u0648' + HAJAR.candidates[1]
        + ' \u0643\u0644\u0627\u0647\u0645\u0627 \u062a\u0643\u0644\u0651\u0645 \u0641\u064a \u0627\u0644\u0645\u0633\u0623\u0644\u0629\u060c \u0641\u0623\u064a\u0651\u0647\u0645\u0627 \u062a\u0642\u0635\u062f\u061f',
      HAJAR, [],
    );
    ok('E75 \u00b7 [RED] a clarification naming BOTH men is NOT caught',
      bothNamed.respected === true, JSON.stringify(bothNamed));

    // 🔒 9. A PASSING MENTION. The plan reports no requested authority for «ذكر لي صديقي أن ابن
    // عثيمين…», so nothing is carried and nothing may fire — asserted here as the absent identity
    // the handler would hand over.
    const passing = judge(said(BAZ), null, evFor(BAZ, 'binbaz.org.sa', body(BAZ)));
    ok('E75 \u00b7 [RED] a question that carried no requested authority is NOT caught',
      passing.respected === true && passing.reason === '', JSON.stringify(passing));

    // 🔒 10. AND A HALF-BUILT IDENTITY IS NOBODY. A shape the reviewer does not recognise must
    // mean «not checked», never «checked and failed» — otherwise a plumbing slip upstream becomes
    // a notice on every answer.
    for (const junk of [{}, { name: '' }, { name: BAZ }, { name: BAZ, status: 'maybe' }, 'ابن باز', 7]) {
      const r = judge(noneFor(FAWZAN), junk, []);
      if (!ok('E75 \u00b7 [RED] a malformed identity is «not checked», not «failed» \u2014 '
        + JSON.stringify(junk), r.respected === true && r.reason === '', JSON.stringify(r))) break;
    }
  }

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('attribution-truth-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
