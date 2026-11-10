// guards/mediated-attribution-guard.cjs -- brain35 A-6 (2026-11-06; DIAG REFS-RULE): OPTION B, NARROW.
//
// THE RULE THE OWNER DECIDED (2026-11-06). A scholar QUOTED IN a secondary source is licensed only when the mediation is
// written down: the sentence carries the cue («نقل X عن Y», «ذكر X أن Y», «كما في <book>», «نقل عن Y»), the row's passage
// names Y within SAME_SENTENCE_CHARS (220) of the statement's first content words, and the released wording keeps the cue.
// A bare «قال Y» over such a page is released WITH the cue written in («نقل X عن Y أنه قال …»); anything else stays held
// exactly as today.
//
// WHAT THIS PINS, offline, no model, no network:
//   1. the cue reader: the four cue shapes, and two sentences that carry none;
//   2. Q33's al-Qari credit over its own Kashf al-Khafa row (the captured card payload): released, the name kept, the cue
//      written in, the mediator being the row's author -- al-Ajluni, not al-Qari;
//   3. the same credit already carrying the cue: released untouched;
//   4. Q32's «زاد أكثرهم»: names nobody, so no cue, no licence and no invented mediator;
//   5. the distance rule: the same bare credit over a page that names the man 13 characters from the statement is
//      released with the cue; over one that names him 317 characters away it is held as today (the name is removed);
//   6. a cued sentence whose row does not name the inner speaker at all: no licence;
//   7. the licence function itself (mediatedEvidenceFor) and the exported window;
//   8. three mutants, each killed: the licence term dropped from attributedEvidenceFor, the rewrite dropped, and the
//      window narrowed to 20 characters.
//
// Usage: node guards/mediated-attribution-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 400) : ''));
  return false;
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?mediated=' + Date.now());
/** A twin of lib/output-reviewer.js with its imports made absolute, after `transform`. */
async function twin(transform, tag) {
  const src = read('lib/output-reviewer.js');
  const mutated = transform(src);
  if (mutated === src) return { changed: false };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-mediated-' + tag + '-'));
  const file = path.join(tmp, 'output-reviewer.mjs');
  fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
    (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib', spec)).href + q), 'utf8');
  try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()), tmp }; } catch (e) { return { changed: true, error: String(e && e.message), tmp }; }
}
const clean = (t) => { try { if (t && t.tmp) fs.rmSync(t.tmp, { recursive: true, force: true }); } catch { /* temp only */ } };

(async () => {
  console.log('=== mediated-attribution-guard -- brain35 A-6: a quoted scholar is credited through the mediation that is written down ===');
  const REV = await esm('lib/output-reviewer.js');
  const FX = JSON.parse(read('fixtures/brain35-mediated-cases.json'));
  const bookRow = (id, author, bookTitle, passage) => ({ id, kind: 'lib_book', title: bookTitle, bookTitle, author, authorRole: 'author', url: '', snippet: passage });
  const verdictOf = (mod, text, evidence) => {
    const r = mod.reviewAnswer({ text, evidence, domain: 'fiqh', mode: 'brief' });
    const actions = r.annotations.map((a) => a.action);
    return { text: r.text, actions, mediated: actions.includes(mod.MEDIATED_ATTRIBUTION), held: actions.includes('removed-unsupported-attribution') || actions.includes('kept-unsupported-attribution-marked') };
  };

  // ── 1. the cue reader ──
  ok('1a «نقل X عن Y» is a cue naming both', JSON.stringify(REV.mediationCueIn('ونقل العجلوني عن القاري أنه قال كذا.')) === JSON.stringify({ mediator: 'العجلوني', inner: 'القاري' }));
  ok('1b «ذكر X أن Y» is a cue naming both', JSON.stringify(REV.mediationCueIn('وذكر ابن حجر أن النووي قال كذا.')) === JSON.stringify({ mediator: 'ابن حجر', inner: 'النووي' }));
  ok('1c «نقل عن Y» names the inner speaker alone (the row is the mediator)', JSON.stringify(REV.mediationCueIn('ونقل عن القاري أنه قال كذا.')) === JSON.stringify({ mediator: '', inner: 'القاري' }));
  ok('1d «كما في <book>» is a book cue', (REV.mediationCueIn('وهو كما في كشف الخفاء.') || {}).book === 'كشف');
  ok('1e a bare credit and a nameless addition carry no cue', REV.mediationCueIn(FX.distance.unit) === null && REV.mediationCueIn(FX.q32.unit) === null);
  ok('1f the window is the measured one (220)', REV.SAME_SENTENCE_CHARS === 220 && FX.sameSentenceChars === 220);

  // ── 2-3. Q33 over its own captured row ──
  const kashf = bookRow('ref-1', FX.q33.row.author, FX.q33.row.bookTitle, FX.q33.row.passage);
  ok('2a the captured Kashf al-Khafa row is al-Ajluni\'s and names al-Qari', FX.q33.row.author.includes('العجلوني') && FX.q33.row.passage.includes('القاري') && FX.q33.row.passage.length > 500);
  const q33v = verdictOf(REV, FX.q33.unit, [kashf]);
  ok('2b Q33\'s al-Qari credit over that row is released as a MEDIATED attribution', q33v.mediated && !q33v.held, JSON.stringify(q33v.actions));
  ok('2c ...the released wording carries the cue, names the mediator (al-Ajluni) and keeps al-Qari',
    q33v.text.startsWith('ونقل ') && q33v.text.includes('العجلوني') && q33v.text.includes('عن الملا علي القاري') && q33v.text.includes('أنه قال') && q33v.text.includes('عجيب'), q33v.text);
  // 2d THE LICENCE FUNCTION ITSELF. Measured on the four cue shapes: when a sentence carries the cue, detectAttribution
  // finds no credit in it at all (the cue words break every attribution pattern), so the sentence goes out as
  // understanding and the fifth licence is not what releases it. The licence is kept for the shape whose detected name IS
  // the inner speaker, and is pinned here by calling it, not by claiming an end-to-end effect it does not have today.
  ok('2d the licence returns the row for a cued credit whose inner speaker the page names beside the statement',
    !!REV.mediatedEvidenceFor(FX.q33.cuedUnit, { claimed: 'الملا علي القاري', end: 0 }, [kashf]));
  ok('2e ...and the licence term is wired into attributedEvidenceFor, last of the five',
    read('lib/output-reviewer.js').includes('|| mediatedEvidenceFor(sentence, attribution, evidence)'));
  const cued = verdictOf(REV, FX.q33.cuedUnit, [kashf]);
  ok('3 the same credit already carrying the cue is released untouched', cued.text === FX.q33.cuedUnit && !cued.held, JSON.stringify(cued.actions));

  // ── 4. Q32: nobody is named ──
  const q32v = verdictOf(REV, FX.q32.unit, [kashf]);
  ok('4 Q32\'s «زاد أكثرهم» names nobody: no mediated action, no invented mediator, the text as it was',
    !q32v.mediated && q32v.text === FX.q32.unit && !q32v.text.includes('نقل '), JSON.stringify(q32v));

  // ── 5. the distance rule ──
  const near = bookRow('near', FX.distance.author, FX.distance.bookTitle, FX.distance.near);
  const far = bookRow('far', FX.distance.author, FX.distance.bookTitle, FX.distance.far);
  const nearV = verdictOf(REV, FX.distance.unit, [near]);
  const farV = verdictOf(REV, FX.distance.unit, [far]);
  ok('5a a bare credit over a page naming the man beside the statement is released with the cue',
    nearV.mediated && nearV.text.includes('نقل ') && nearV.text.includes('ابن تيمية'), JSON.stringify(nearV));
  ok('5b the same credit over a page naming him 317 characters from the statement is held as today (the name goes)',
    !farV.mediated && farV.held && !farV.text.includes('ابن تيمية'), JSON.stringify(farV));

  // ── 6. a cued sentence whose row does not name the inner speaker ──
  // a page that SUPPORTS the sentence and names nobody: only the name-on-the-page test can refuse it
  const otherPage = bookRow('other', 'مؤلف آخر', 'كتاب آخر', 'الطلاق في الحيض لا يقع عند بعض أهل العلم، وهو قول مرجوح عند غيرهم، ولا ذكر فيه لأحد بعينه.');
  ok('6 a cue whose row does not name the inner speaker licenses nothing', REV.mediatedEvidenceFor('ونقل مؤلف آخر عن ابن تيمية أن الطلاق في الحيض لا يقع.', { claimed: 'ابن تيمية', end: 0 }, [otherPage]) === null);
  ok('7 the rewrite is refused where no row carries the man beside the statement', REV.mediatedAttributionRewrite(FX.distance.unit, { claimed: 'ابن تيمية', frame: 'وقال ابن تيمية', end: 15 }, [otherPage]) === null);

  // ── 8. the mutants ──
  const m1 = await twin((s) => s.replace('    return mediatedNear(item, attribution.claimed, statement) && supportsSentence(sentence, item);',
    '    return supportsSentence(sentence, item); // mutant: the page need not name the inner speaker'), 'proximity');
  ok('MUTANT proximity seam applied and loaded', m1.changed && m1.mod, m1.error);
  ok('MUTANT KILLED: without the proximity test a cue licenses a page that never names the man',
    m1.mod && m1.mod.mediatedEvidenceFor('ونقل مؤلف آخر عن ابن تيمية أن الطلاق في الحيض لا يقع.', { claimed: 'ابن تيمية', end: 0 }, [otherPage]) !== null,
    m1.error);
  clean(m1);
  const m2 = await twin((s) => s.replace('export function mediatedAttributionRewrite(sentence, attribution, evidence) {', 'export function mediatedAttributionRewrite() { return null; } // mutant: the cue is never written in\nfunction mediatedAttributionRewriteUnused(sentence, attribution, evidence) {'), 'rewrite');
  ok('MUTANT rewrite seam applied and loaded', m2.changed && m2.mod, m2.error);
  ok('MUTANT KILLED: without the rewrite Q33\'s credit is held again', m2.mod && verdictOf(m2.mod, FX.q33.unit, [kashf]).held === true, m2.mod ? JSON.stringify(verdictOf(m2.mod, FX.q33.unit, [kashf]).actions) : m2.error);
  clean(m2);
  const m3 = await twin((s) => s.replace('export const SAME_SENTENCE_CHARS = 220;', 'export const SAME_SENTENCE_CHARS = 20; // mutant: the window is one word wide'), 'window');
  ok('MUTANT window seam applied and loaded', m3.changed && m3.mod, m3.error);
  ok('MUTANT KILLED: with a 20-character window Q33\'s credit is held again', m3.mod && verdictOf(m3.mod, FX.q33.unit, [kashf]).held === true, m3.mod ? JSON.stringify(verdictOf(m3.mod, FX.q33.unit, [kashf]).actions) : m3.error);
  clean(m3);

  console.log('\n=== mediated-attribution: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
