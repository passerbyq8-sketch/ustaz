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
  const instructions = await import(pathToFileURL(path.join(root, 'lib/free-brain/instructions.js')).href);
  const bw2 = await import(pathToFileURL(path.join(root, 'lib/before-writing-v2.js')).href);
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
    const ruling = A('627 644 63a 646 627 621 20 645 62d 631 645 20 639 646 62f 20 62c 645 647 648 631 20 627 644 639 644 645 627 621 2e');
    const input = 'KEEP. ' + ruling
      + ' ' + A('644 643 646 20 628 639 636 647 645 20 623 628 627 62d 647 20 628 634 631 648 637 20 5b 5b 31 5d 5d 2e');
    const expected = 'KEEP. ' + A('628 639 636 647 645 20 623 628 627 62d 647 20 628 634 631 648 637 20 5b 5b 31 5d 5d 2e');
    const out = loop.withoutUnsourcedRulings(input, [1]);
    check(out.removed === 1 && out.text === expected,
      'middle unsourced-ruling removal cleans the next sentence connective');
    check(!loop.statesRulingSentence(A('645 62d 631 645 629')) && loop.statesRulingSentence(A('645 62d 631 645')),
      'the ruling fixture uses a recognized ruling word, not the feminine descriptive form');
  }

  {
    const title = (books.SHORT_NAMES || []).find((name) => name
      && books.attributedBooks(A('642 627 644 20 641 64a') + ' ' + name + '.').length > 0);
    check(!!title, 'book fixture has a recognized attribution frame');
    if (title) {
      const next = A('644 643 646 20 645 633 62a 645 631 629 20 631 637 631 62d 627 646');
      const expectedNext = A('645 633 62a 645 631 629 20 631 637 631 62d 627 646');
      const input = 'KEEP. ' + A('642 627 644 20 641 64a') + ' ' + title + '. ' + next;
      const out = loop.withoutUnretrievedBooks(input, []);
      check(out.removed === 1 && out.text === 'KEEP. ' + expectedNext,
        'middle unretrieved-book removal cleans the next sentence connective');
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
    const b3Sentence = b3.text.replace(/\u060c$/u, '.');
    const trailing = A('644 643 646 647 645 20 639 627 645');
    const middle = loop.withoutRemovedPersonAttributions('KEEP. ' + b3Sentence + ' ' + trailing + '.', queryFrame + ' ' + rawName);
    check(middle.removed === 1 && middle.text === 'KEEP. ' + A('625 646 647 645 20 639 627 645') + '.',
      'middle removed-person attribution cleanup preserves the sentence and repairs its connective');
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

  // B4 P3-26: the writer is told before writing; the sentence filter remains the safety net.
  {
    const namedIssueQuestion = namedQuestion + ' ' + A('639 646 20 627 644 63a 64a 628 629 61f');
    const attribution = removed.removedPersonAttribution(namedIssueQuestion);
    const ruleMarker = A('627 644 633 627 626 644 20 633 623 644 20 639 646 20 631 623 64a');
    const clauses = [
      ruleMarker + ' ' + rawName,
      A('644 64a 633 20 639 646 62f 646 627 20 645 646 20 643 644 627 645 647 20 645 635 62f 631'),
      A('644 627 20 62a 630 643 631 20 627 633 645 647'),
      A('644 627 20 62a 646 633 628 20 625 644 64a 647 20 634 64a 626 627'),
      A('644 627 20 62a 634 631 20 625 644 64a 647 20 628 636 645 64a 631'),
      A('627 643 62a 628 20 62c 648 627 628 20 627 644 645 633 623 644 629 20 646 641 633 647 627 20 645 646 20 627 644 645 635 627 62f 631 20 645 628 627 634 631 629'),
      A('627 644 62a 646 628 64a 647 20 64a 636 64a 641 647 20 627 644 62e 627 62f 645'),
    ].map(removed.normalizeRemovedName);
    const hasWriterRule = (text) => clauses.every((clause) => removed.normalizeRemovedName(text).includes(clause));
    const hasRuleMarker = (text) => removed.normalizeRemovedName(text).includes(removed.normalizeRemovedName(ruleMarker));
    check(attribution && attribution.role === 'removed_person' && attribution.name === rawName,
      'B4 instruction fixture resolves the canonical removed_person');
    const namedInstruction = instructions.buildFreeBrainInstruction({ band: 'adult', fiqh: true, removedPerson: attribution });
    const ordinaryInstruction = instructions.buildFreeBrainInstruction({ band: 'adult', fiqh: true });
    const identityInstruction = instructions.buildFreeBrainInstruction({
      band: 'adult', fiqh: true, removedPerson: { ...attribution, role: 'removed_identity' },
    });
    check(hasWriterRule(namedInstruction),
      'B4 free-brain instruction names the canonical person and forbids names, attribution and pronouns');
    check(!hasRuleMarker(ordinaryInstruction) && !hasRuleMarker(identityInstruction),
      'B4 free-brain writer rule is absent for ordinary and removed_identity roles');

    // Capture the actual writer body from runBw2Turn; no exported rules helper or source scan.
    const captureBw2Writer = async (question) => {
      let writerBody = null;
      let writerCalls = 0;
      let sent = '';
      const source = {
        kind: 'fatwa', title: A('627 644 63a 64a 628 629'),
        url: 'https://fixture.invalid/fatwa/row7a', publisher: 'fixture',
        text: 'A supplied source paragraph.', passage: 'A supplied source paragraph.',
      };
      const wire = {
        status() { return true; },
        delta(piece) { sent += String(piece || ''); return true; },
        liveOffer() { return true; },
        replace(text) { sent = String(text); return true; },
        finish() { return true; },
        get sent() { return sent; },
        get opened() { return sent.length > 0; },
        get dead() { return false; },
      };
      await bw2.runBw2Turn({
        question, messages: [{ role: 'user', content: question }],
        band: 'adult', mode: 'brief', runtime: 'STORED_FIQH',
        system: 'SYSTEM', model: 'offline-writer', maxTokens: 1024,
        providerUrl: 'https://stub.invalid/bw2-writer', headers: {}, wire,
        env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' },
        deps: {
          runTool: async (name, input, ctx) => ({
            text: '', calls: 0,
            added: name === 'search_fatawa' ? [ctx.table.add({ ...source })] : [],
          }),
          warmEncyclopedia: async () => true,
          encyclopediaReady: () => true,
          searchStoredCorpus: async () => ({ records: [] }),
          ask: async ({ user }) => {
            const count = (user.match(/^\[\d+\] /gmu) || []).length;
            return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i + 1), 1])) });
          },
          callWriter: async ({ body, onText }) => {
            writerCalls += 1;
            writerBody = body;
            onText('KEEP [[1]].');
            return { stop_reason: 'end_turn', usage: { output_tokens: 5 }, content: [] };
          },
          fetchImpl: async () => { throw new Error('offline guard forbids transport'); },
        },
      });
      const last = writerBody && [...writerBody.messages].reverse().find((message) => message.role === 'user');
      const blocks = last && Array.isArray(last.content) ? last.content : [];
      // The first block is the reader's question; only subsequent blocks are server instructions/evidence.
      const writerContext = blocks.slice(1).filter((block) => block && block.type === 'text')
        .map((block) => block.text).join('\n');
      return { writerCalls, writerContext };
    };
    const namedBw2 = await captureBw2Writer(namedIssueQuestion);
    const ordinaryBw2 = await captureBw2Writer(ordinaryQuestion);
    check(namedBw2.writerCalls === 1 && hasWriterRule(namedBw2.writerContext),
      'B4 actual BW2 writer payload carries the canonical removed-person instruction');
    check(ordinaryBw2.writerCalls === 1 && !hasRuleMarker(ordinaryBw2.writerContext),
      'B4 actual ordinary BW2 writer payload has no removed-person instruction');
  }

  // The order's entire closed list: strip exactly one initial waw/fa after a removed sentence.
  {
    const words = [
      '648 645 627', '648 645 646', '648 647 648', '648 647 64a', '648 647 630 627',
      '648 647 630 647', '648 630 644 643', '648 62a 644 643', '648 642 62f',
      '648 644 642 62f', '648 625 646', '648 623 646', '648 625 630 627',
      '648 644 627', '648 644 645', '648 644 646', '648 641 64a', '648 639 644 649',
      '648 639 646', '648 625 644 649', '648 623 645 627', '648 625 646 645 627',
      '641 645 627', '641 645 646', '641 647 648', '641 647 64a', '641 647 630 627',
      '641 647 630 647', '641 630 644 643', '641 62a 644 643', '641 644 642 62f',
      '641 625 646', '641 625 630 627', '641 644 627', '641 644 646', '641 641 64a',
      '641 639 644 649', '641 639 646', '641 625 644 649', '641 623 645 627',
      '641 625 646 645 627',
    ].map(A);
    const namedSentence = A('642 627 644') + ' ' + rawName + ' ' + A('643 644 627 645') + '.';
    check(words.length === 41 && new Set(words).size === 41, 'B4 closed opening list has exactly 41 distinct forms');
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      const next = word + ' KEEP.';
      const expectedNext = word.slice(1) + ' KEEP.';
      const first = loop.withoutRemovedPersonAttributions(namedSentence + ' ' + next, namedQuestion);
      const middle = loop.withoutRemovedPersonAttributions('KEEP. ' + namedSentence + ' ' + next, namedQuestion);
      check(first.removed === 1 && first.text === expectedNext, 'B4 closed form ' + (i + 1) + ' after first-sentence removal');
      check(middle.removed === 1 && middle.text === 'KEEP. ' + expectedNext, 'B4 closed form ' + (i + 1) + ' after middle removal');
      const unchanged = loop.withoutRemovedPersonAttributions(next, namedQuestion);
      check(unchanged.removed === 0 && unchanged.text === next,
        'B4 closed form ' + (i + 1) + ' stays unchanged without deletion');
      check(opening.cleanDanglingOpeningConnective(next) === next,
        'B4 closed form ' + (i + 1) + ' default helper does not strip');
      check(opening.cleanDanglingOpeningConnective(' \t' + word + ', KEEP.', { afterRemoval: true })
        === ' \t' + word.slice(1) + ', KEEP.',
      'B4 closed form ' + (i + 1) + ' preserves whitespace and punctuation');
      check(opening.cleanDanglingOpeningConnective(word, { afterRemoval: true }) === word.slice(1),
        'B4 closed form ' + (i + 1) + ' matches a whole word at end');
      const longer = word + A('646') + ' KEEP.';
      const keptLonger = loop.withoutRemovedPersonAttributions(namedSentence + ' ' + longer, namedQuestion);
      check(keptLonger.removed === 1 && keptLonger.text === longer,
        'B4 closed form ' + (i + 1) + ' does not match the start of a longer word');
      check(opening.cleanDanglingOpeningConnective('KEEP ' + next, { afterRemoval: true }) === 'KEEP ' + next,
        'B4 closed form ' + (i + 1) + ' is untouched outside the first word');
    }
    const controls = [
      '641 647 645', '648 647 645', '641 642 62f', '641 644 645', '648 643 644',
      '648 627 644 62f 647', '648 636 648 621', '648 628 631', '641 636 644',
    ].map(A);
    for (let i = 0; i < controls.length; i += 1) {
      const sentence = controls[i] + ' KEEP.';
      const out = loop.withoutRemovedPersonAttributions(namedSentence + ' ' + sentence, namedQuestion);
      check(out.removed === 1 && out.text === sentence,
        'B4 excluded opening word ' + (i + 1) + ' survives deletion byte for byte');
      check(opening.cleanDanglingOpeningConnective(sentence, { afterRemoval: true }) === sentence,
        'B4 excluded opening word ' + (i + 1) + ' survives direct cleanup');
    }
    const requiredControls = [
      '641 642 62f 20 627 644 628 644 627 621 20 646 639 645 629 2e',
      '641 647 645 20 627 644 646 635 20 623 648 644 627 2e',
      '648 628 631 20 627 644 648 627 644 62f 64a 646 20 648 627 62c 628 2e',
    ].map(A);
    for (let i = 0; i < requiredControls.length; i += 1) {
      const sentence = requiredControls[i];
      const out = loop.withoutRemovedPersonAttributions(namedSentence + ' ' + sentence, namedQuestion);
      check(out.removed === 1 && out.text === sentence, 'B4 required complete control sentence ' + (i + 1) + ' is unchanged');
    }
    const wama = A('648 645 627 20 648 642 641 62a 20 639 644 64a 647') + ' KEEP.';
    const after = loop.withoutRemovedPersonAttributions(namedSentence + ' ' + wama, namedQuestion);
    check(after.removed === 1 && after.text === wama.slice(1),
      'B4 measured wama opening loses exactly its first waw after deletion');
    const mixed = loop.withoutRemovedPersonAttributions(wama + ' ' + namedSentence + ' ' + A('641 647 630 627') + ' KEEP.', namedQuestion);
    check(mixed.removed === 1 && mixed.text === wama + ' ' + A('647 630 627') + ' KEEP.',
      'B4 middle deletion keeps an unrelated initial listed word and repairs only its following sentence');
    const marked = A('648 64e 645 64e 627') + ' KEEP.';
    check(opening.cleanDanglingOpeningConnective(marked, { afterRemoval: true }) === A('645 64e 627') + ' KEEP.',
      'B4 stripping preserves marks on the remaining word');
  }

  // B5 row 7-a: quote-aware removal cases from the measured re-ask.
  {
    const q = A('0645 0627 0630 0627 0020 0642 0627 0644 0020 0639 0645 0631 0020 0628 0646 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0639 0646 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 061f');
    const cases = [
      ['A', loop.withoutRemovedPersonAttributions(A('0644 0645 0020 0623 062c 062f 0020 0644 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0643 0644 0627 0645 064b 0627 0020 0645 0646 0642 0648 0644 064b 0627 0020 0641 064a 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 002e 0020 0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0643 0627 0646 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 064a 0630 0643 0631 0020 0641 064a 0020 0647 0630 0627 0020 0642 0648 0644 0020 0627 0644 0646 0628 064a 0020 0635 0644 0649 0020 0627 0644 0644 0647 0020 0639 0644 064a 0647 0020 0648 0633 0644 0645 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0032 005d 005d 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), q), 2, A('0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['B', loop.withoutUnsourcedRulings(A('0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0648 0627 062c 0628 0629 0020 0648 0642 0637 064a 0639 062a 0647 0627 0020 062d 0631 0627 0645 060c 0020 0648 0641 064a 0020 0627 0644 062d 062f 064a 062b 0020 0627 0644 0642 062f 0633 064a 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), [1]), 1, A('0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['W', loop.withoutUnretrievedBooks(A('0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 0648 0630 0643 0631 0020 0627 0628 0646 0020 0627 0644 0642 064a 0645 0020 0641 064a 0020 0632 0627 062f 0020 0627 0644 0645 0639 0627 062f 0020 062d 062f 064a 062b 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 002e 000a 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), []), 1, A('0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['D1', loop.withoutRemovedPersonAttributions(A('0630 0643 0631 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0623 0646 0020 0635 0644 062a 0647 0627 0020 0648 0627 062c 0628 0629 002e 0020 0642 0627 0644 0020 0627 0644 0646 0628 064a 0020 0635 0644 0649 0020 0627 0644 0644 0647 0020 0639 0644 064a 0647 0020 0648 0633 0644 0645 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0032 005d 005d 002e 0020 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), q), 1, A('0642 0627 0644 0020 0627 0644 0646 0628 064a 0020 0635 0644 0649 0020 0627 0644 0644 0647 0020 0639 0644 064a 0647 0020 0648 0633 0644 0645 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0032 005d 005d 002e 0020 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['D2', loop.withoutRemovedPersonAttributions(A('0648 0641 064a 0020 0643 062a 0627 0628 0020 00ab 0642 0637 064a 0639 0629 0020 0627 0644 0631 062d 0645 003a 0020 0627 0644 0645 0638 0627 0647 0631 0020 002d 0020 0627 0644 0623 0633 0628 0627 0628 0020 002d 0020 0633 0628 0644 0020 0627 0644 0639 0644 0627 062c 00bb 0020 0628 064a 0627 0646 0020 0630 0644 0643 0020 005b 005b 0032 005d 005d 002e 0020 0648 0631 0623 0649 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0630 0644 0643 002e 0020 0648 0627 0644 0635 0644 0629 0020 062a 0643 0648 0646 0020 0628 0627 0644 0632 064a 0627 0631 0629 0020 005b 005b 0031 005d 005d 002e'), q), 1, A('0648 0641 064a 0020 0643 062a 0627 0628 0020 00ab 0642 0637 064a 0639 0629 0020 0627 0644 0631 062d 0645 003a 0020 0627 0644 0645 0638 0627 0647 0631 0020 002d 0020 0627 0644 0623 0633 0628 0627 0628 0020 002d 0020 0633 0628 0644 0020 0627 0644 0639 0644 0627 062c 00bb 0020 0628 064a 0627 0646 0020 0630 0644 0643 0020 005b 005b 0032 005d 005d 002e 0020 0648 0627 0644 0635 0644 0629 0020 062a 0643 0648 0646 0020 0628 0627 0644 0632 064a 0627 0631 0629 0020 005b 005b 0031 005d 005d 002e')],
      ['D3', loop.withoutRemovedPersonAttributions(A('0648 0631 0648 0649 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 003a 0020 00ab 0645 0646 0020 0633 0631 0647 0020 0623 0646 0020 064a 0628 0633 0637 0020 0644 0647 0020 0641 064a 0020 0631 0632 0642 0647 061f 0020 0641 0644 064a 0635 0644 0020 0631 062d 0645 0647 002e 000a 0648 0627 0644 0635 0644 0629 0020 062a 0643 0648 0646 0020 0628 0627 0644 0645 0627 0644 0020 0648 0627 0644 0632 064a 0627 0631 0629 0020 005b 005b 0031 005d 005d 002e 000a 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), q), 1, A('0648 0627 0644 0635 0644 0629 0020 062a 0643 0648 0646 0020 0628 0627 0644 0645 0627 0644 0020 0648 0627 0644 0632 064a 0627 0631 0629 0020 005b 005b 0031 005d 005d 002e 000a 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['D4', loop.withoutRemovedPersonAttributions(A('0642 0627 0644 0020 062a 0639 0627 0644 0649 003a 0020 003c 0076 0065 0072 0073 0065 0020 0073 003d 0022 0034 0022 0020 0061 003d 0022 0031 0022 002f 003e 002e 0020 0648 0642 0627 0644 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0643 0630 0627 002e 0020 0648 0627 0644 0635 0644 0629 0020 0648 0627 062c 0628 0629 0020 005b 005b 0031 005d 005d 002e'), q), 1, A('0642 0627 0644 0020 062a 0639 0627 0644 0649 003a 0020 003c 0076 0065 0072 0073 0065 0020 0073 003d 0022 0034 0022 0020 0061 003d 0022 0031 0022 002f 003e 002e 0020 0648 0627 0644 0635 0644 0629 0020 0648 0627 062c 0628 0629 0020 005b 005b 0031 005d 005d 002e')],
      ['D5', loop.withoutRemovedPersonAttributions(A('0644 0645 0020 0623 062c 062f 0020 0644 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0643 0644 0627 0645 064b 0627 0020 0645 0646 0642 0648 0644 064b 0627 0020 0641 064a 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 002e 0020 0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0643 0627 0646 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 064a 0630 0643 0631 0020 0641 064a 0020 0647 0630 0627 0020 0642 0648 0644 0020 0627 0644 0646 0628 064a 0020 0635 0644 0649 0020 0627 0644 0644 0647 0020 0639 0644 064a 0647 0020 0648 0633 0644 0645 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0032 005d 005d 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), A('0645 0627 0020 062d 0643 0645 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 061f')), 0, A('0644 0645 0020 0623 062c 062f 0020 0644 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 0643 0644 0627 0645 064b 0627 0020 0645 0646 0642 0648 0644 064b 0627 0020 0641 064a 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 002e 0020 0623 0645 0627 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0646 0641 0633 0647 0627 0020 0641 0623 0645 0631 0647 0627 0020 0639 0638 064a 0645 0020 0641 064a 0020 062f 064a 0646 0646 0627 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0643 0627 0646 0020 0639 0645 0631 0020 0639 0628 062f 0020 0627 0644 0643 0627 0641 064a 0020 064a 0630 0643 0631 0020 0641 064a 0020 0647 0630 0627 0020 0642 0648 0644 0020 0627 0644 0646 0628 064a 0020 0635 0644 0649 0020 0627 0644 0644 0647 0020 0639 0644 064a 0647 0020 0648 0633 0644 0645 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0032 005d 005d 002e 000a 000a 0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['D6', loop.withoutUnsourcedRulings(A('0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0648 0627 062c 0628 0629 0020 005b 005b 0031 005d 005d 060c 0020 0648 0641 064a 0020 0627 0644 062d 062f 064a 062b 0020 0627 0644 0642 062f 0633 064a 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), [1]), 0, A('0648 0635 0644 0629 0020 0627 0644 0631 062d 0645 0020 0648 0627 062c 0628 0629 0020 005b 005b 0031 005d 005d 060c 0020 0648 0641 064a 0020 0627 0644 062d 062f 064a 062b 0020 0627 0644 0642 062f 0633 064a 003a 0020 00ab 0625 0646 0020 0627 0644 0644 0647 0020 062e 0644 0642 0020 0627 0644 062e 0644 0642 060c 0020 062d 062a 0649 0020 0625 0630 0627 0020 0641 0631 063a 0020 0645 0646 0020 062e 0644 0642 0647 0020 0642 0627 0644 062a 0020 0627 0644 0631 062d 0645 003a 0020 0647 0630 0627 0020 0645 0642 0627 0645 0020 0627 0644 0639 0627 0626 0630 0020 0628 0643 0020 0645 0646 0020 0627 0644 0642 0637 064a 0639 0629 060c 0020 0642 0627 0644 003a 0020 0646 0639 0645 060c 0020 0623 0645 0627 0020 062a 0631 0636 064a 0646 0020 0623 0646 0020 0623 0635 0644 0020 0645 0646 0020 0648 0635 0644 0643 060c 0020 0648 0623 0642 0637 0639 0020 0645 0646 0020 0642 0637 0639 0643 061f 0020 0642 0627 0644 062a 003a 0020 0628 0644 0649 060c 0020 0642 0627 0644 003a 0020 0641 0630 0627 0643 0020 0644 0643 00bb 0020 005b 005b 0031 005d 005d 002e 000a 000a 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
      ['D7', loop.withoutUnsourcedRulings(A('064a 062c 0628 0020 0635 0644 0629 0020 0627 0644 0631 062d 0645 002e 0020 0648 0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e'), [1]), 1, A('0647 064a 0020 0645 0646 0020 0623 0639 0638 0645 0020 0627 0644 0642 0631 0628 0627 062a 0020 005b 005b 0031 005d 005d 002e')],
    ];
    for (const [label, out, expectedRemoved, expectedText] of cases) {
      check(out.removed === expectedRemoved && out.text === expectedText,
        'B5 quote-bound case ' + label + ' has wrong removed count or text');
    }
  }

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
