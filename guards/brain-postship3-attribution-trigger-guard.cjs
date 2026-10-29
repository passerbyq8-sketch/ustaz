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
const occurrences = (text, needle) => needle ? String(text).split(needle).length - 1 : 0;
const framesOf = (target) => target.writes.join('').split('\n\n')
  .filter((frame) => frame.startsWith('data: '))
  .map((frame) => JSON.parse(frame.slice(6)));
const textOf = (target) => framesOf(target).filter((frame) => frame.type === 'content_block_delta')
  .map((frame) => String(frame.delta && frame.delta.text || '')).join('');
function makeTarget() {
  return {
    writes: [], ended: 0, headers: {},
    write(value) { this.writes.push(String(value)); return true; },
    end(callback) { this.ended += 1; if (typeof callback === 'function') callback(); return this; },
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    on() { return this; }, once() { return this; }, removeListener() { return this; },
  };
}
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

  // B4 P3-25: drive the shared identity detector and each executable caller family.
  // The registry is read at runtime so adding a person or form must extend the pure
  // reviewer's snapshot too; no source-text assertion can stand in for this matrix.
  const RV = await esm('lib/output-reviewer.js');
  const F = await esm('lib/finalize-reader-text.js');
  const SSE = await esm('lib/finalized-sse-writer.js');
  const BW = await esm('lib/before-writing-v2.js');
  const TOOLS = await esm('lib/free-brain/tools.js');
  const person = R.REMOVED_SOURCES.persons.find((row) => row.id === 'umar-abd-al-kafi');
  const canonical = person.canonical;
  const ibnBaz = A('627 628 646 20 628 627 632');
  const body = A('642 627 644 20') + ibnBaz + A('20 625 646 20 628 631 20 627 644 648 627 644 62f 64a 646 20 648 627 62c 628 2e');
  const encyc = A('627 644 645 635 62f 631 3a 20 627 644 645 648 633 648 639 629 20 627 644 641 642 647 64a 629 20 627 644 643 648 64a 62a 64a 629 2e');
  const question = A('628 645 627 630 627 20 623 641 62a 649 20 627 644 634 64a 62e 20') + canonical
    + A('20 641 64a 20 628 631 20 627 644 648 627 644 62f 64a 646 61f');
  const identityQuestion = A('645 646 20 647 648 20') + canonical + A('61f');
  const removedIdentity = R.removedPersonIdentity(identityQuestion);
  const longNote = R.removedPersonAnswerNote(question);
  const shortNote = R.removedPersonIdentityNote(removedIdentity);
  const asked = { name: canonical, status: 'unresolved', candidates: [] };
  const salim = { name: A('633 627 644 645 20 627 644 641 644 627 646 64a'), status: 'unresolved', candidates: [] };
  const unknown = RV.requestedIdentityRespected(body, salim);
  ok('B4 unknown Salim keeps the unresolved substitution notice', unknown.respected === false
    && unknown.reason === 'unresolved-substituted' && !!unknown.notice);
  const identityNotice = unknown.notice;
  for (const row of R.REMOVED_SOURCES.persons) {
    for (const [index, form] of row.forms.entries()) {
      for (const status of ['unresolved', 'resolved', 'ambiguous']) {
        const result = RV.requestedIdentityRespected(body, {
          name: form, status, candidates: [ibnBaz, A('627 628 646 20 639 62b 64a 645 64a 646')],
        });
        ok('B4 removed identity ' + row.id + ' form ' + index + ' ' + status + ' is respected for its named reason',
          result.respected === true && result.reason === 'removed-person-source-note' && result.notice === '');
      }
      const titled = RV.requestedIdentityRespected(body, { name: A('627 644 634 64a 62e 20') + form, status: 'unresolved' });
      ok('B4 a removed name with its honorific has no identity notice ' + row.id + ' form ' + index,
        titled.respected === true && titled.reason === 'removed-person-source-note' && titled.notice === '');
    }
  }
  const evidence = [{ id: 'b4-binbaz', url: 'https://binbaz.org.sa/fatwas/70001', title: 'B4 fixture', snippet: body }];
  const oracle = RV.reviewAnswer({ text: body, evidence, domain: 'fiqh', mode: 'brief', requestedIdentity: asked });
  ok('B4 whole-answer reviewer suppresses the removed identity notice', oracle.verdict.requestedIdentityRespected
    && oracle.verdict.requestedIdentityReason === 'removed-person-source-note' && !oracle.text.includes(identityNotice));
  const stream = RV.createReviewStream({ evidence, domain: 'fiqh', mode: 'brief', requestedIdentity: asked });
  stream.push(body.slice(0, 8)); stream.push(body.slice(8));
  const streamed = stream.end();
  ok('B4 streaming reviewer suppresses the removed identity notice', streamed.verdict.requestedIdentityRespected
    && streamed.verdict.requestedIdentityReason === 'removed-person-source-note' && !streamed.text.includes(identityNotice));

  const card = { tag: '<book id="FC-099999" title="B4 fixture"></book>', subjectId: 'FC-099999', bookTitle: 'B4 fixture' };
  function deliver(text, { withCard = true, suffix = encyc, suffixFor = '', requestedIdentity = asked } = {}) {
    const target = makeTarget();
    const facade = SSE.createFinalizedSseResponse(target, {
      finalize: (input) => F.finalizeReaderText(input),
      context: () => ({
        consistencyContext: null, requestedIdentity, allowWireOwnedCards: true,
        sourceCards: withCard ? [card] : [], readerCards: withCard ? [card] : [],
        readerCardPrefix: '\n\n', readerSuffix: suffix ? '\n\n' + suffix : '',
        readerSuffixFor: () => suffixFor ? '\n\n' + suffixFor : '',
      }),
      failureText: 'B4-FINALIZATION-FAILURE',
    });
    facade.write('data: ' + JSON.stringify({ type: 'content_block_delta', index: 0,
      delta: { type: 'text_delta', text } }) + '\n\n');
    facade.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
    facade.end();
    const shown = textOf(target);
    return { shown, prose: shown.split(card.tag).join('').trim(), target };
  }
  const witness = deliver(body + '\n\n' + longNote);
  ok('B4 witness through real finalizer and SSE has no contradictory identity notice',
    !witness.shown.includes(identityNotice) && witness.prose.includes(ibnBaz));
  ok('B4 witness encyclopedia precedes exactly one final long note',
    witness.prose.endsWith(longNote) && occurrences(witness.prose, longNote) === 1
      && witness.prose.indexOf(encyc) < witness.prose.indexOf(longNote));
  ok('B4 the owned book card follows the final note', witness.shown.indexOf(card.tag) > witness.shown.indexOf(longNote)
    && witness.target.ended === 1);
  const control = deliver(body, { withCard: false, requestedIdentity: salim });
  ok('B4 finalizer keeps unknown Salim unresolved notice', control.shown.includes(identityNotice));
  const short = deliver(body + '\n\n' + shortNote, { withCard: false, requestedIdentity: null });
  ok('B4 identity short note follows the encyclopedia exactly once', short.prose.endsWith(shortNote)
    && occurrences(short.prose, shortNote) === 1 && short.prose.indexOf(encyc) < short.prose.indexOf(shortNote));
  const noCardOpinion = deliver(R.appendRemovedPersonAnswerNote(body, question, { hasReaderCard: false }), { withCard: false });
  ok('B4 opinion without reader cards ends in the short note', noCardOpinion.prose.endsWith(shortNote)
    && occurrences(noCardOpinion.prose, shortNote) === 1 && !noCardOpinion.prose.includes(longNote));
  const serverTails = ['KHILAF-TAIL', 'TAKHRIJ-DISCLOSURE', 'PATIENT-REFERRAL', 'SUICIDE-COMFORT'];
  const repeated = deliver(body + '\n\n' + longNote + '\n\n' + shortNote + '\n\n' + longNote,
    { suffixFor: serverTails.join('\n\n') });
  ok('B4 duplicate short and long notes reduce to the one final long note with a reader card',
    repeated.prose.endsWith(longNote) && occurrences(repeated.prose, longNote) === 1
      && occurrences(repeated.prose, shortNote) === 0);
  ok('B4 the selected final note follows every derived server tail', serverTails.every((tail) =>
    repeated.prose.indexOf(tail) >= 0 && repeated.prose.indexOf(tail) < repeated.prose.indexOf(longNote)));
  const plain = deliver('Ordinary answer.', { withCard: false, suffix: '', requestedIdentity: null });
  ok('B4 note-free text stays byte-for-byte unchanged', plain.shown === 'Ordinary answer.');

  // The real BW2 turn has fake retrieval, judge and writer only. Its actual wire
  // passes through the real facade's BW2 identity finalizer: released bytes stay
  // append-only, and the note must follow the encyclopedia and disagreement tails.
  const ruling = A('627 644 645 633 623 644 629 20 641 64a 647 627 20 62e 644 627 641 60c 20 648 627 644 631 627 62c 62d 20 623 646 647 20 64a 62c 648 632 2e');
  const record = { id: 'F-b4-attribution', term: A('628 631 20 627 644 648 627 644 62f 64a 646'), part: 8, snippet: ruling };
  async function deliverBw2(withCard) {
    const target = makeTarget();
    const facade = SSE.createFinalizedSseResponse(target, {
      finalize: (input) => ({ ok: true, text: String(input.text || ''), problems: [], replaced: false, drops: [], degraded: [] }),
      context: () => ({ allowWireOwnedCards: true, sourceCards: [], readerCards: [], readerPrefix: '', readerSuffix: '' }),
      failureText: 'B4-BW2-FAILURE',
    });
    const wire = BW.createBw2Wire(facade);
    const pieces = [];
    const delta = wire.delta.bind(wire);
    wire.delta = (piece) => { const sent = delta(piece); if (sent && piece) pieces.push(String(piece)); return sent; };
    const deps = {
      runTool: async () => ({ text: '', added: [], calls: 0 }),
      searchStoredCorpus: async () => ({ records: [record] }),
      warmEncyclopedia: async () => true, encyclopediaReady: () => true,
      encyclopediaRow: TOOLS.encyclopediaRow,
      ask: async ({ user }) => {
        const count = (user.match(/^\[\d+\] /gmu) || []).length;
        return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index + 1), 1])) });
      },
      callWriter: async ({ onText }) => {
        const text = ruling.replace(/\.$/u, '') + ' [[1]].';
        onText(text.slice(0, 17)); onText(text.slice(17));
        return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [] };
      },
      runnerLookup: () => async () => [],
    };
    const out = await BW.runBw2Turn({
      question, messages: [{ role: 'user', content: question }], mode: 'brief', band: 'adult',
      system: 'SYSTEM', model: 'B4-stub', maxTokens: 1024, providerUrl: 'https://stub.invalid/v1/messages', headers: {},
      wire, requestedIdentity: asked, env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400' }, deps,
      cards: { max: 3, encyclopediaCards: withCard,
        buildBookTag: () => ({ tag: card.tag }), buildSourceTag: () => ({ tag: '<source url="https://example.invalid/b4"></source>' }) },
    });
    return { out, shown: textOf(target), pieces: pieces.join(''), ended: target.ended };
  }
  const bw2 = await deliverBw2(true);
  const khilaf = String(RV.REVIEW_KHILAF_TAIL || '').trim();
  ok('B4 BW2 actually releases its sourced answer and reader card', bw2.out.telemetry.cardsSent > 0
    && bw2.shown.includes(card.tag) && bw2.out.telemetry.unitsReleased > 0);
  ok('B4 BW2 encyclopedia and disagreement tails precede one final long note', bw2.shown.endsWith(longNote)
    && occurrences(bw2.shown, longNote) === 1 && bw2.shown.includes(encyc)
    && !!khilaf && bw2.shown.includes(khilaf) && bw2.shown.indexOf(encyc) < bw2.shown.indexOf(longNote)
    && bw2.shown.indexOf(khilaf) < bw2.shown.indexOf(longNote));
  ok('B4 BW2 final answer equals the released deltas byte-for-byte', bw2.shown === bw2.pieces
    && bw2.out.text === bw2.pieces && bw2.ended === 1);
  const bw2NoCard = await deliverBw2(false);
  ok('B4 BW2 opinion without a reader card ends in one short note after the encyclopedia',
    bw2NoCard.out.telemetry.cardsSent === 0 && bw2NoCard.shown.endsWith(shortNote)
      && occurrences(bw2NoCard.shown, shortNote) === 1 && !bw2NoCard.shown.includes(longNote)
      && bw2NoCard.shown.indexOf(encyc) >= 0 && bw2NoCard.shown.indexOf(encyc) < bw2NoCard.shown.indexOf(shortNote));
  ok('B4 BW2 no-card answer also preserves released bytes', bw2NoCard.shown === bw2NoCard.pieces
    && bw2NoCard.out.text === bw2NoCard.pieces && bw2NoCard.ended === 1);
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL guard crashed: ' + (e && e.message || 'unknown error')); process.exit(1); });
