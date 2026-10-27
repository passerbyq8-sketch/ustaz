'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? ' | ' + detail : ''));
  return false;
}
const forms = [
  [1, A('645 646 20 647 648 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [2, A('645 646 20 647 648 20 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a 61f')],
  [3, A('645 646 20 647 648 20 639 645 631 20 628 646 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [4, A('639 631 641 646 64a 20 628 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [5, A('639 631 651 641 646 64a 20 628 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a')],
  [6, A('639 631 641 646 64a 20 639 644 649 20 627 644 634 64a 62e 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [7, A('645 64a 646 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a 61f')],
  [8, A('645 646 20 64a 643 648 646 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
  [9, A('646 628 630 629 20 639 646 20 627 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [10, A('62a 631 62c 645 629 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
  [11, A('62a 639 631 641 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 61f')],
];
const negative = [
  [A('639 631 641 646 64a 20 628 623 62d 643 627 645 20 627 644 635 64a 627 645'), 'STORED_FIQH'],
  [A('639 631 651 641 646 64a 20 639 644 649 20 634 631 648 637 20 627 644 635 644 627 629'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 635 644 627 629 20 627 644 627 633 62a 62e 627 631 629'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 633 648 631 629 20 627 644 641 627 62a 62d 629'), 'STORED_FIQH'],
  [A('645 646 20 64a 643 648 646 20 623 648 644 649 20 628 627 644 625 645 627 645 629 61f'), 'GENERAL'],
  [A('62a 639 631 641 20 62d 643 645 20 635 644 627 629 20 627 644 648 62a 631 61f'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 641 636 644 20 627 644 635 62f 642 629'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 645 639 627 646 64a 20 627 644 642 631 622 646'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 63a 632 648 629 20 628 62f 631'), 'STORED_FIQH'],
  [A('645 646 20 64a 643 648 646 20 627 644 625 645 627 645 20 641 64a 20 635 644 627 629 20 627 644 62c 646 627 632 629 61f'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 632 643 627 629 20 627 644 641 637 631'), 'STORED_FIQH'],
  [A('646 628 630 629 20 639 646 20 64a 648 645 20 639 631 641 629'), 'STORED_FIQH'],
  [A('639 631 641 646 64a 20 628 633 646 646 20 627 644 648 636 648 621'), 'STORED_FIQH'],
  [A('62a 639 631 641 20 643 641 627 631 629 20 627 644 64a 645 64a 646 61f'), 'STORED_FIQH'],
  [A('62a 631 62c 645 629 20 643 644 645 629 20 627 644 633 644 627 645'), 'GENERAL'],
  [A('646 628 630 629 20 639 646 20 644 64a 644 629 20 627 644 642 62f 631'), 'STORED_FIQH'],
];
const CONTROL = A('645 62d 645 62f 20 645 62a 648 644 64a 20 627 644 634 639 631 627 648 64a');
const CANONICAL = A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
const EXPECTED_NOTE = A('62a 646 628 64a 647 3a 20 644 64a 633 20 639 646 62f 64a 20 645 635 627 62f 631 20 645 646 20 643 62a 628 20') + CANONICAL + A('2e');
(async () => {
  const NP = await esm('lib/policy/name-presence.js');
  const REM = await esm('lib/removed-sources.js');
  const FS = await esm('lib/front-sorter.js');
  const RT = await esm('lib/stored-deen.js');
  const PL = await esm('lib/ask-plan.js');
  const RC = await esm('lib/route-classify.js');
  const askSource = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  const runtime = (q) => {
    const messages = [{ role: 'user', content: q }];
    return RT.classifyReligiousRuntime(q, PL.planAsk(messages, { policyEnabled: true }), RC.classifyRoute(messages));
  };
  const person = (REM.REMOVED_SOURCES.persons || []).find((x) => x.id === 'umar-abd-al-kafi');
  ok('removed-source canonical identity is the expected person', !!person && person.canonical === CANONICAL);
  const measuredForms = new Set((person && Array.isArray(person.forms) ? person.forms : []).map(REM.normalizeRemovedName));
  ok('removedPersonIdentity helper is exported', typeof REM.removedPersonIdentity === 'function');
  ok('removed identity note helper is exported', typeof REM.removedPersonIdentityNote === 'function');
  ok('identity sorter frame helper is exported', typeof FS.frameAfterSorter === 'function');
  ok('api/ask.js supplies the removed-identity signal to sorterEligibility',
    askSource.includes('removedIdentity: !!removedIdentityQuestion'));
  ok('api/ask.js appends the identity note at the free-brain answer boundary',
    askSource.includes('appendRemovedPersonIdentityNote('));

  const sorterInput = (q, removedIdentity) => ({
    enabled: true, band: 'adult', freeBrainEnabled: true, runtime: runtime(q),
    liveSearch: false, excluded: '', text: q, removedIdentity,
  });
  for (const [id, q] of forms) {
    const subject = NP.identitySubject(q);
    const role = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(q) : null;
    ok('Q' + id + ' resolves the full removed identity without attribution',
      !!role && role.id === 'umar-abd-al-kafi' && role.name === CANONICAL && role.role === 'removed_identity',
      JSON.stringify(role));
    ok('Q' + id + ' keeps a complete measured removed-name form',
      !!subject && measuredForms.has(REM.normalizeRemovedName(subject)));
    const decision = FS.sorterEligibility(sorterInput(q, true));
    ok('Q' + id + ' bypasses the classifier with removed_identity',
      decision.ask === false && decision.sorter === 'removed_identity', JSON.stringify(decision));
    ok('Q' + id + ' finishes in GENERAL',
      FS.runtimeAfterSorter(runtime(q), 'removed_identity') === 'GENERAL');
    const controlQuestion = subject ? q.replace(subject, CONTROL) : q;
    const controlSubject = NP.identitySubject(controlQuestion);
    const controlRole = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(controlQuestion) : null;
    ok('C' + id + ' is not marked as removed and remains an identity',
      controlSubject === CONTROL && controlRole === null, JSON.stringify({ controlSubject, controlRole }));
    const controlShape = NP.probeShape(controlQuestion, null);
    ok('C' + id + ' stays in the ordinary identity probe',
      controlShape.kind === 'IDENTITY_SHAPE' && controlShape.name === CONTROL, JSON.stringify(controlShape));
    const controlDecision = FS.sorterEligibility(sorterInput(controlQuestion, false));
    ok('C' + id + ' still asks the classifier as today', controlDecision.ask === true, JSON.stringify(controlDecision));
  }
  const sampleRole = typeof REM.removedPersonIdentity === 'function' ? REM.removedPersonIdentity(forms[0][1]) : null;
  const note = typeof REM.removedPersonIdentityNote === 'function' ? REM.removedPersonIdentityNote(sampleRole) : '';
  ok('identity note uses the canonical name and exact sentence', note === EXPECTED_NOTE, note);
  if (typeof REM.appendRemovedPersonIdentityNote === 'function') {
    const body = 'definition';
    const withNote = body + '\n\n' + EXPECTED_NOTE;
    ok('identity note is appended once and only after a nonempty answer',
      REM.appendRemovedPersonIdentityNote(body, sampleRole) === withNote
      && REM.appendRemovedPersonIdentityNote(withNote, sampleRole) === withNote
      && REM.appendRemovedPersonIdentityNote('', sampleRole) === ''
      && REM.appendRemovedPersonIdentityNote(body, null) === body);
  } else {
    ok('identity note is appended once and only after a nonempty answer', false);
  }
  const off = FS.sorterEligibility({
    enabled: false, band: 'adult', freeBrainEnabled: true, runtime: 'GENERAL',
    text: forms[0][1], removedIdentity: true,
  });
  ok('removed identity is not sent to the classifier when its key is off',
    off.ask === false && off.sorter === 'removed_identity', JSON.stringify(off));
  const frame = typeof FS.frameAfterSorter === 'function'
    ? FS.frameAfterSorter('GENERAL', 'removed_identity', { enabled: false, band: 'adult', freeBrainEnabled: true })
    : '';
  ok('removed identity uses the general frame without a classifier verdict', frame === 'general', frame);
  const controlNote = typeof REM.removedPersonIdentityNote === 'function' ? REM.removedPersonIdentityNote(null) : '';
  ok('the removed-identity note is absent for a nonremoved person', controlNote === '');

  for (let i = 0; i < negative.length; i += 1) {
    const [q, expectedRuntime] = negative[i];
    const subject = NP.identitySubject(q);
    const shape = NP.probeShape(q, null);
    ok('N' + (i + 1) + ' is not an identity subject', subject === '', JSON.stringify({ subject }));
    ok('N' + (i + 1) + ' does not open a presence probe',
      shape.kind === 'NOT_PROBED' && shape.probe === false, JSON.stringify(shape));
    ok('N' + (i + 1) + ' preserves the lexical runtime',
      runtime(q) === expectedRuntime, runtime(q) + ' expected ' + expectedRuntime);
  }
  const embedded = A('645 627 20 631 623 64a 643 20 641 64a 20') + forms[0][1];
  ok('an identity frame embedded later in a question is not captured', NP.identitySubject(embedded) === '');
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
