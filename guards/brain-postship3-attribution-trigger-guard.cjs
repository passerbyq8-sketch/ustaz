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
  ['G_opinion_backbiting', A('645 627 20 631 623 64a 20 627 644 634 64a 62e 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 641 64a 20 627 644 63a 64a 628 629 61f')],
  ['H_opinion_singing', A('645 627 20 631 623 64a 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 641 64a 20 627 644 63a 646 627 621 61f')],
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
  const genericRuling = A('645 627 20 62d 643 645 20 627 644 63a 646 627 621 61f');
  ok('I an ordinary ruling question stays outside the removed-person role',
    R.removedPersonAttribution(genericRuling) === null && R.removedPersonAnswerNote(genericRuling) === '');
  const opinionQuestion = questions.find(([id]) => id === 'G_opinion_backbiting')[1];
  ok('J a reader-visible answer keeps the removed-person source note',
    R.appendRemovedPersonAnswerNote(sample, opinionQuestion).includes(R.removedPersonAnswerNote(opinionQuestion)));
  ok('J an empty answer does not manufacture the removed-person source note',
    R.appendRemovedPersonAnswerNote('', opinionQuestion) === '');
  const sayForm = A('64a 642 648 644');
  ok('shared BW2 scholar triggers remain at the c14 count', S.TRIGGERS.size === 11);
  ok('the measured say-form is not a shared BW2 scholar trigger', !S.TRIGGERS.has(sayForm));
  const sayQuestion = questions.find(([id]) => id === 'sibling_2_says')[1];
  const local = R.removedPersonAttribution(sayQuestion);
  ok('the measured say-form remains a local removed-person trigger',
    !!local && local.id === 'umar-abd-al-kafi' && local.role === 'removed_person');
  ok('the shared scholar parser does not widen for the measured say-form', S.scholarNameOf(sayQuestion) === '');
  const speechVerbs = [
    ['say_present', A('64a 642 648 644')],
    ['say_past', A('642 627 644')],
    ['see_present', A('64a 631 649')],
    ['see_past', A('631 623 649')],
    ['issue_present', A('64a 641 62a 64a')],
    ['issue_past', A('623 641 62a 649')],
    ['mention_present', A('64a 630 643 631')],
    ['mention_past', A('630 643 631')],
  ];
  ok('local removed-person speech matcher is exported', typeof R.isRemovedPersonSpeechVerb === 'function');
  for (const [id, verb] of speechVerbs) {
    ok(id + ' is recognized only by the removed-person matcher',
      typeof R.isRemovedPersonSpeechVerb === 'function' && R.isRemovedPersonSpeechVerb(verb));
  }
  const rawName = A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
  const queryFrame = A('645 627 20 642 627 644');
  for (const cp of [0x648, 0x641, 0x644, 0x628]) {
    const attribution = R.removedPersonAttribution(queryFrame + ' ' + String.fromCodePoint(cp) + rawName + A('61f'));
    ok('single name prefix ' + cp.toString(16) + ' is matched', !!attribution && attribution.role === 'removed_person');
  }
  const identity = A('645 646 20 647 648 20') + rawName;
  ok('ordinary identity questions do not get an attribution note', R.removedPersonAttribution(identity) === null
    && R.removedPersonAnswerNote(identity) === '');
  const untriggered = A('645 627 20 62d 643 645 20') + rawName;
  ok('a complete removed name alone does not activate attribution role', R.removedPersonAttribution(untriggered) === null);
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL guard crashed: ' + (e && e.message || 'unknown error')); process.exit(1); });
