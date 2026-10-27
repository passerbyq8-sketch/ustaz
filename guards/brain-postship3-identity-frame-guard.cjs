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

(async () => {
  const NP = await esm('lib/policy/name-presence.js');
  const ROUTE = await esm('lib/route-classify.js');
  for (const [id, question] of forms) {
    const subject = NP.identitySubject(question);
    const normalized = ROUTE.normalizeArabic(subject);
    const hasName = normalized.includes(A('639 645 631'))
      && normalized.includes(A('639 628 62f')) && normalized.includes(A('643 627 641 64a'));
    ok('Q' + id + ' captures Omar as an identity subject', !!subject && hasName);
  }
  const embedded = A('645 627 20 631 623 64a 643 20 641 64a 20') + forms[0][1];
  ok('identity frame embedded later in a question is not captured', NP.identitySubject(embedded) === '');
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
