'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const fixturePath = path.join(root, 'guards/fixtures/brain-postship3-row7a-excerpts.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const fail = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) fail.push(message);
};
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
const { driveFreeTurn } = require(path.join(root, 'guards/replaced-law-lib.cjs'));

async function main() {
  const loop = await import(pathToFileURL(path.join(root, 'lib/free-brain/loop.js')).href);
  const reviewer = await import(pathToFileURL(path.join(root, 'lib/free-brain/review.js')).href);
  const opening = await import(pathToFileURL(path.join(root, 'lib/opening-conjunction.js')).href);
  const removed = await import(pathToFileURL(path.join(root, 'lib/removed-sources.js')).href);
  const books = await import(pathToFileURL(path.join(root, 'lib/named-books.js')).href);
  check(fixture.excerpts.length === 3, 'expected three measured excerpts');
  check(typeof opening.cleanDanglingOpeningConnective === 'function', 'opening cleanup helper is exported');
  check(typeof loop.withoutRemovedPersonAttributions === 'function', 'removed-person sentence filter is exported');
  check(typeof removed.sentenceNamesRemovedPerson === 'function', 'complete removed-name matcher is exported');

  for (const entry of fixture.excerpts) {
    const hash = crypto.createHash('sha256').update(entry.text, 'utf8').digest('hex');
    check(hash === entry.sha256, entry.label + ': fixture hash changed');
    check(loop.collectCited(entry.text).length === 0, entry.label + ': fixture gained a citation');

    const filtered = loop.withoutUnsourcedRulings(entry.text, []);
    check(filtered.removed === 0, entry.label + ': no-reference ruling filter removed a sentence');
    check(filtered.rulings === 0, entry.label + ': no-reference ruling filter classified an uncited ruling');
    check(filtered.notCovered === false, entry.label + ': no-reference ruling filter changed not-covered status');
    check(filtered.text === entry.text, entry.label + ': no-reference ruling filter changed the excerpt');

    if (typeof opening.cleanDanglingOpeningConnective === 'function') {
      const firstSpace = entry.text.indexOf(' ');
      const expected = firstSpace < 0 ? entry.text : entry.text.slice(firstSpace + 1);
      check(opening.cleanDanglingOpeningConnective(entry.text) === expected,
        entry.label + ': initial dangling connective was not removed as a whole word');
    }
    if (entry.label !== 'B3' && typeof loop.withoutRemovedPersonAttributions === 'function') {
      const ordinary = loop.withoutRemovedPersonAttributions(entry.text, A('645 627 20 62d 643 645 20 627 644 63a 64a 628 629'));
      check(ordinary.removed === 0 && ordinary.text === entry.text, entry.label + ': removed-person filter escaped its role');
    }

    const result = await reviewer.reviewAnswer({
      text: entry.text,
      evidence: [],
      domain: 'fiqh',
      mode: 'chat',
      khilafFromOpinions: null,
      opinionCount: 0,
      truncated: false,
    });
    check(result.text.startsWith(entry.text), entry.label + ': reviewer removed the input prefix');
    check(
      result.verdict?.sentences?.some((sentence) => sentence.action === 'tagged-fiqh-understanding'),
      entry.label + ': reviewer action changed',
    );
    if (entry.label !== 'B2') check(result.text === entry.text, entry.label + ': reviewer output changed');
    if (entry.label === 'B2') check(Array.from(result.text).length - Array.from(entry.text).length === 49, 'B2: measured reviewer suffix length changed');
  }

  if (typeof opening.cleanDanglingOpeningConnective === 'function') {
    const keep = 'KEEP';
    const removals = [
      ['bare lam-kan', A('644 643 646')],
      ['waw lam-kan', A('648 644 643 646')],
      ['bal', A('628 644')],
      ['waw bal', A('648 628 644')],
      ['illa an', A('625 644 627 20 623 646')],
      ['illa with shadda', A('625 644 651 627 20 623 646')],
      ['plain alef illa', A('627 644 627 20 627 646')],
      ['ghayr an', A('63a 64a 631 20 623 646')],
      ['ghayr an with diacritics', A('63a 64a 631 20 623 646 64e 651')],
      ['waw ma dhalik', A('648 645 639 20 630 644 643')],
      ['ma dhalik', A('645 639 20 630 644 643')],
      ['waw li-dhalik', A('648 644 630 644 643')],
      ['li-dhalik', A('644 630 644 643')],
      ['waw li-hadha', A('648 644 647 630 627')],
      ['li-hadha', A('644 647 630 627')],
      ['waw alayhi', A('648 639 644 64a 647')],
      ['fa alayhi', A('641 639 644 64a 647')],
    ];
    for (const [id, word] of removals) {
      check(opening.cleanDanglingOpeningConnective(word + ' ' + keep) === keep,
        'removal matrix: ' + id);
    }

    const replacements = [
      ['lam-kan with shadda', A('644 643 646 651'), A('625 646 651')],
      ['waw lam-kan with shadda', A('648 644 643 646 651'), A('625 646 651')],
      ['lam-kan huwa', A('644 643 646 647'), A('625 646 647')],
      ['waw lam-kan huwa', A('648 644 643 646 647'), A('625 646 647')],
      ['lam-kan hiya', A('644 643 646 647 627'), A('625 646 647 627')],
      ['waw lam-kan hiya', A('648 644 643 646 647 627'), A('625 646 647 627')],
      ['lam-kan hum', A('644 643 646 647 645'), A('625 646 647 645')],
      ['waw lam-kan hum', A('648 644 643 646 647 645'), A('625 646 647 645')],
    ];
    for (const [id, word, replacement] of replacements) {
      check(opening.cleanDanglingOpeningConnective(word + ' ' + keep) === replacement + ' ' + keep,
        'replacement matrix: ' + id);
    }
    check(opening.cleanDanglingOpeningConnective(A('648 641 639 644 627') + ' ' + keep) === A('648 641 639 644 627') + ' ' + keep,
      'unlisted waw-prefixed word is preserved');
    check(opening.cleanDanglingOpeningConnective(A('641 642 637') + ' ' + keep) === A('641 642 637') + ' ' + keep,
      'unlisted fa-prefixed word is preserved');
    check(opening.cleanDanglingOpeningConnective('prefix ' + A('644 643 646') + ' ' + keep)
      === 'prefix ' + A('644 643 646') + ' ' + keep, 'a noninitial connective is preserved');
  }

  {
    const input = A('627 644 63a 646 627 621 20 645 62d 631 645 629 20 639 646 62f 20 62c 645 647 648 631 20 627 644 639 644 645 627 621 2e')
      + ' ' + A('644 643 646 20 628 639 636 647 645 20 623 628 627 62d 647 20 628 634 631 648 637 20 5b 5b 31 5d 5d 2e');
    const expected = A('628 639 636 647 645 20 623 628 627 62d 647 20 628 634 631 648 637 20 5b 5b 31 5d 5d 2e');
    const out = loop.withoutUnsourcedRulings(input, [1]);
    check(out.removed === 1 && out.text === expected,
      'unsourced-ruling removal also removes the leading connective from the kept sentence');
  }

  {
    const title = (books.SHORT_NAMES || []).find((name) => name
      && books.attributedBooks(A('642 627 644') + ' ' + name + '.').length > 0);
    check(!!title, 'book fixture has a recognized attribution frame');
    if (title) {
      const next = A('644 643 646 20 645 633 62a 645 631 629 20 631 637 631 62d 627 646');
      const input = A('642 627 644') + ' ' + title + '. ' + next;
      const out = loop.withoutUnretrievedBooks(input, []);
      check(out.removed === 1 && out.text === next,
        'unretrieved-book removal also removes the leading connective from the kept sentence');
    }
  }

  {
    const rawName = A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
    const queryFrame = A('645 627 20 642 627 644');
    const prefixes = [0x648, 0x641, 0x644, 0x628];
    for (const cp of prefixes) {
      const question = queryFrame + ' ' + String.fromCodePoint(cp) + rawName;
      const attribution = removed.removedPersonAttribution(question);
      check(!!attribution && attribution.role === 'removed_person'
        && typeof removed.sentenceNamesRemovedPerson === 'function'
        && removed.sentenceNamesRemovedPerson(fixture.excerpts.find((entry) => entry.label === 'B3').text, attribution),
      'one-prefix removed-name match ' + cp.toString(16));
    }
    const attribution = removed.removedPersonAttribution(queryFrame + ' ' + rawName);
    const b3 = fixture.excerpts.find((entry) => entry.label === 'B3');
    if (typeof loop.withoutRemovedPersonAttributions === 'function' && attribution) {
      const out = loop.withoutRemovedPersonAttributions(b3.text, queryFrame + ' ' + rawName);
      check(out.removed === 1 && out.text === '',
        'B3 is removed completely in the removed_person role');
    } else {
      check(false, 'B3 removed-person check can run');
    }
    const ordinary = loop.withoutRemovedPersonAttributions
      ? loop.withoutRemovedPersonAttributions(b3.text, A('645 627 20 62d 643 645 20 627 644 63a 64a 628 629'))
      : { removed: -1, text: '' };
    check(ordinary.removed === 0 && ordinary.text === b3.text,
      'B3 remains unchanged outside the removed_person role');
  }

  const reviewDiff = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'lib/free-brain/review.js'], { cwd: root });
  check(reviewDiff.status === 0, 'review.js is untouched');
  const rawName = A('639 645 631 20 639 628 62f 20 627 644 643 627 641 64a');
  const namedQuestion = A('645 627 20 642 627 644') + ' ' + rawName;
  const ordinaryQuestion = A('645 627 20 62d 643 645 20 627 644 63a 64a 628 629');
  const namedAnswer = fixture.excerpts.find((entry) => entry.label === 'B3').text.replace(/\u060c$/u, '.') + ' KEEP.';
  const namedTurn = await driveFreeTurn({ answer: namedAnswer, question: namedQuestion, module: loop });
  const namedRuntimePass = typeof namedTurn.text === 'string'
    && !namedTurn.text.includes(rawName) && namedTurn.text.includes('KEEP');
  check(namedRuntimePass,
    'free-brain runtime removes the named sentence and keeps the following sentence'
      + ' (name=' + (typeof namedTurn.text === 'string' && namedTurn.text.includes(rawName))
      + ', keep=' + (typeof namedTurn.text === 'string' && namedTurn.text.includes('KEEP'))
      + ', streamed=' + namedTurn.streamedThisTurn
      + ', notCovered=' + namedTurn.notCovered
      + ', role=' + !!removed.removedPersonAttribution(namedQuestion)
      + ', keys=' + Object.keys(namedTurn).join(',') + ')');
  const ordinaryTurn = await driveFreeTurn({ answer: namedAnswer, question: ordinaryQuestion, module: loop });
  check(typeof ordinaryTurn.text === 'string' && ordinaryTurn.text.includes(rawName) && ordinaryTurn.text.includes('KEEP'),
    'ordinary free-brain question completes and keeps the answer');

  if (fail.length) {
    for (const message of fail) process.stderr.write('FAIL ' + message + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('PASS postship3 row7a checks=' + checks + '\n');
}

main().catch((error) => {
  process.stderr.write('FAIL guard crashed: ' + (error && error.message || 'unknown error') + '\n');
  process.exitCode = 1;
});
