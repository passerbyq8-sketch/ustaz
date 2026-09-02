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

  console.log('\n' + (failures === 0
    ? 'OK: ' + checks + '/' + checks + ' checks passed.'
    : 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('attribution-truth-guard CRASHED:', (e && e.stack) || e);
  process.exit(1);
});
