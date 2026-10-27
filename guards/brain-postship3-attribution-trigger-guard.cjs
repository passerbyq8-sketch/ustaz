'use strict';
const path = require('path');
const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name);
  return false;
}
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
const questions = [
  ['witness', A('645 627 20 645 648 642 641 20 627 644 634 64a 62e 20 639 645 631 20 628 646 20 639 628 62f 20 627 644 643 627 641 64a 20 645 646 20 627 644 63a 64a 628 629 61f')],
  ['sibling_1', A('645 627 20 631 623 64a 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 641 64a 20 627 644 63a 646 627 621 61f')],
  ['sibling_2_says', A('645 627 630 627 20 64a 642 648 644 20 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a 20 639 646 20 628 631 20 627 644 648 627 644 62f 64a 646 61f')],
  ['sibling_3', A('645 627 20 645 648 642 641 20 639 645 631 20 628 646 20 639 628 62f 20 627 644 643 627 641 64a 20 645 646 20 627 644 627 62e 62a 644 627 637 61f')],
  ['sibling_4', A('647 644 20 64a 631 649 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 62c 648 627 632 20 627 644 62a 635 648 64a 631 61f')],
  ['sibling_5', A('642 648 644 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 641 64a 20 635 644 627 629 20 627 644 62c 645 639 629 61f')],
];

(async () => {
  const R = await esm('lib/removed-sources.js');
  const S = await esm('lib/bw2-scholar.js');
  const sample = 'safe answer';
  for (const [id, question] of questions) {
    const attribution = R.removedPersonAttribution(question);
    const note = R.removedPersonAnswerNote(question);
    const unblocked = R.appendRemovedPersonAnswerNote(sample, question);
    const blocked = R.appendRemovedPersonAnswerNote(sample, question, { blocked: true });
    ok(id + ' recognizes the removed person', !!attribution && attribution.id === 'umar-abd-al-kafi');
    ok(id + ' provides the note and appends it once when unblocked', !!note
      && unblocked === sample + '\n\n' + note && unblocked.split(note).length === 2);
    ok(id + ' suppresses the note when the answer is blocked', blocked === sample);
  }
  ok('the measured say-form is an attribution trigger', S.TRIGGERS.has(A('64a 642 648 644')));
  const sayQuestion = questions.find(([id]) => id === 'sibling_2_says')[1];
  const extracted = R.normalizeRemovedName(S.scholarNameOf(sayQuestion));
  ok('the BW2 scholar parser extracts the name after the measured say-form',
    extracted.includes(A('639 645 631')) && extracted.includes(A('639 628 62f')) && extracted.includes(A('643 627 641 64a')));
  const identity = A('645 646 20 647 648 20') + A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
  ok('ordinary identity questions do not get an attribution note', R.removedPersonAttribution(identity) === null
    && R.removedPersonAnswerNote(identity) === '');
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
