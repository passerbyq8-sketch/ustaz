'use strict';
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const FIX = require(path.join(REPO, 'lib/data/removed-sources.json'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));

(async () => {
  const Q = await esm('lib/lib-quote.js');
  const prefix = A('627 646 642 644 20 644 64a 20 645 646 20 643 62a 627 628 20');
  const baseTitle = A('627 644 62f 627 631 20 627 644 622 62e 631 629');
  const cases = [
    ['witness title plus author', A('20 644 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a')],
    ['doctor honorific and attached author', A('20 644 644 62f 643 62a 648 631 20 639 645 631 20 639 628 62f 627 644 643 627 641 64a')],
    ['author with ibn spelling', A('20 644 639 645 631 20 628 646 20 639 628 62f 20 627 644 643 627 641 64a')],
    ['shaykh honorific with topic', A('20 644 644 634 64a 62e 20 639 645 631 20 639 628 62f 20 627 644 643 627 641 64a 20 645 627 20 62c 627 621 20 641 64a 20 639 630 627 628 20 627 644 642 628 631')],
  ];
  for (const [name, suffix] of cases) {
    const ask = Q.detectQuoteRequest(prefix + baseTitle + suffix);
    const plan = ask ? Q.planQuote(ask) : null;
    const answer = ask ? await Q.answerQuoteRequest(ask, {}) : null;
    const removed = !!(plan && plan.outcome === 'no_book' && answer
      && answer.outcome === 'no_book'
      && answer.text === Q.removedBookReply(plan.titleText, plan.authorText));
    ok(name + ' returns the fixed removed-book reply', removed,
      'detected=' + !!ask + ' plan=' + (plan && plan.outcome || 'none'));
  }
  const exactTitle = FIX.bookTitles['FC-004992'];
  const direct = Q.detectQuoteRequest(prefix + exactTitle);
  const directPlan = direct ? Q.planQuote(direct) : null;
  const directAnswer = direct ? await Q.answerQuoteRequest(direct, {}) : null;
  ok('exact removed title alone keeps the removed-book reply', !!(directPlan && directPlan.outcome === 'no_book'
    && directAnswer && directAnswer.text === Q.removedBookReply(directPlan.titleText, directPlan.authorText)));
  const bareAsk = Q.detectQuoteRequest(prefix + baseTitle);
  const barePlan = bareAsk ? Q.planQuote(bareAsk) : null;
  const bareAnswer = bareAsk ? await Q.answerQuoteRequest(bareAsk, {}) : null;
  ok('title prefix without a known author is not classified as removed', !(barePlan && bareAnswer
    && bareAnswer.text === Q.removedBookReply(barePlan.titleText, barePlan.authorText)));
  const control = A('627 646 642 644 20 644 64a 20 645 646 20 643 62a 627 628 20 632 627 62f 20 627 644 645 639 627 62f 20 644 627 628 646 20 627 644 642 64a 645');
  const controlAsk = Q.detectQuoteRequest(control);
  const controlPlan = controlAsk ? Q.planQuote(controlAsk) : null;
  ok('unrelated title remains on its normal topic path', !!controlPlan && controlPlan.outcome === 'need_topic',
    'plan=' + (controlPlan && controlPlan.outcome || 'none'));
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
