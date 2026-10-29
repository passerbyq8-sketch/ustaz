const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const generator = fs.readFileSync(path.join(root, 'tools', 'gen-lib-catalog.mjs'), 'utf8');
const service = fs.readFileSync(path.join(root, 'lib', 'lib-service.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api', 'lib-search.js'), 'utf8');
const helperPath = path.join(root, 'lib', 'removed-sources.js');
const dataPath = path.join(root, 'lib', 'data', 'removed-sources.json');

assert.ok(fs.existsSync(helperPath), 'removed-source resolver is missing');
assert.ok(fs.existsSync(dataPath), 'removed-source registry is missing');
assert.match(generator, /removed-sources\.json/, 'catalogue generation still includes the four target books');
assert.match(service, /lib_book_removed/, 'library page reader still serves removed book FC-004992');
assert.match(service, /dropped/, 'library search must count removed and blocked atoms as dropped');
assert.match(api, /removed-sources/, 'direct library API must filter removed source rows');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
assert.ok(Array.isArray(data.persons) && data.persons.length > 0, 'full person forms are missing');
assert.deepEqual(data.books, ['FC-004992', 'FC-005049', 'FC-006129', 'FC-007063']);
assert.deepEqual(data.atoms, ['FC-003147:0140:001']);
assert.deepEqual(data.lessons, []);

(async () => {
  const helper = await import(pathToFileURL(helperPath).href);
  const { normalizeArabic } = await import(pathToFileURL(path.join(root, 'lib', 'route-classify.js')).href);
  const triggers = ['\u0631\u0623\u064a', '\u0642\u0648\u0644', '\u0643\u0644\u0627\u0645'];
  const person = data.persons[0];
  assert.equal(person.forms.length, 5, 'all five measured full-name forms must be present');
  for (const form of person.forms) {
    const hit = helper.removedPersonAttribution(form + ' ' + triggers[0]);
    assert.ok(hit, 'connected full name plus attribution trigger was not recognized');
    assert.equal(hit.role, 'removed_person');
  }
  assert.equal(helper.removedPersonAttribution('\u0645\u0646 \u0647\u0648 ' + person.forms[0]), null,
    'ordinary person identification must stay available');
  assert.equal(helper.removedPersonAttribution(person.forms[0]), null,
    'a full name by itself is not an attribution query');
  assert.equal(helper.removedPersonAttribution(''), null);
  assert.equal(normalizeArabic(person.forms[0]).split(' ').length, 3);
  assert.equal(helper.shouldDropLibraryHit({ subject_id: data.books[0] }), true);
  assert.equal(helper.shouldDropLibraryHit({ atom_id: data.atoms[0] }), true);
  assert.equal(helper.shouldDropLibraryHit({ subject_id: 'FC-006999' }), false);
  assert.equal(helper.shouldDropLibraryHit({ subject_id: 'FC-009999' }, new Set(['FC-009999'])), true);
  assert.ok(service.includes('REMOVED_BOOK_IDS'));
  assert.ok(api.includes('shouldDropLibraryHit'));
  assert.ok(api.includes('BLOCKED_BOOK_IDS'));
  const askSrc = fs.readFileSync(path.join(root, 'api', 'ask.js'), 'utf8');
  const bw2Src = fs.readFileSync(path.join(root, 'lib', 'before-writing-v2.js'), 'utf8');
  const loopSrc = fs.readFileSync(path.join(root, 'lib', 'free-brain', 'loop.js'), 'utf8');
  const quote = await import(pathToFileURL(path.join(root, 'lib', 'lib-quote.js')).href);
  const askPlan = await import(pathToFileURL(path.join(root, 'lib', 'ask-plan.js')).href);
  const bw2 = await import(pathToFileURL(path.join(root, 'lib', 'before-writing-v2.js')).href);
  assert.ok(askSrc.includes("role: 'removed_person'"));
  assert.ok(!askSrc.includes('searched: false'), 'the removed-source note must not claim a direct search');
  assert.ok(askSrc.includes('appendRemovedPersonAnswerNote') && bw2Src.includes('finishAnswered'), 'answered source and free-brain paths must append the note at their successful end');
  assert.ok(bw2Src.includes('stripRemovedPersonQuery') && !bw2Src.includes('&& !removedPerson'), 'BW2 must search the topic with the attribution frame removed');
  assert.ok(loopSrc.includes("const libOffered = libEligible === true && libFlagValue === 'on' && libToken !== '';") && !loopSrc.includes('library_tool_withheld'), 'free-brain must keep the library tool offered for this person');
  const opinionQuestion = '\u0645\u0627 ' + triggers[0] + ' ' + person.forms[0] + ' \u0641\u064a \u0627\u0644\u0635\u0628\u0631\u061f';
  const expectedNote = '\u062a\u0646\u0628\u064a\u0647: \u0644\u064a\u0633 \u0639\u0646\u062f\u064a \u0645\u0635\u0627\u062f\u0631 \u0645\u0646 \u0643\u062a\u0628 ' + person.canonical + '\u060c \u0641\u0645\u0627 \u062a\u0642\u062f\u064e\u0651\u0645 \u0645\u0623\u062e\u0648\u0630\u064c \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0645\u0630\u0643\u0648\u0631\u0629\u060c \u0648\u0644\u064a\u0633 \u0642\u0648\u0644\u064b\u0627 \u0645\u0646\u0633\u0648\u0628\u064b\u0627 \u0625\u0644\u064a\u0647.';
  assert.equal(helper.removedPersonAnswerNote(opinionQuestion), expectedNote, 'exact removed-source note must be returned');
  assert.equal(askPlan.unattributedNote(person.canonical), expectedNote, 'legacy sourced answers must use the same exact note');
  assert.equal(helper.appendRemovedPersonAnswerNote('answer', opinionQuestion), 'answer\n\n' + expectedNote);
  assert.equal(helper.appendRemovedPersonAnswerNote('answer\n\n' + expectedNote, opinionQuestion), 'answer\n\n' + expectedNote, 'note must be appended only once');
  assert.equal(helper.appendRemovedPersonAnswerNote('blocked', opinionQuestion, { blocked: true }), 'blocked');
  const identityQuestion = '\u0645\u0646 \u0647\u0648 ' + person.forms[0];
  assert.equal(helper.removedPersonAnswerNote(identityQuestion), '', 'ordinary identity questions do not get the note');
  assert.equal(helper.appendRemovedPersonAnswerNote('identity answer', identityQuestion), 'identity answer');
  assert.equal(helper.stripRemovedPersonQuery(opinionQuestion), '\u0627\u0644\u0635\u0628\u0631');
  assert.equal(bw2.libraryQuery(opinionQuestion), bw2.libraryQuery('\u0627\u0644\u0635\u0628\u0631'), 'BW2 query must equal the topic-only query');
  const missingTitle = '\u0627\u0644\u063a\u0648\u0627\u0635\u064a\u0646';
  const invitation = ' \u0625\u0646 \u0643\u0627\u0646 \u0644\u0644\u0643\u062a\u0627\u0628 \u0627\u0633\u0645 \u0622\u062e\u0631 \u064a\u0639\u0631\u0641 \u0628\u0647 \u0641\u0627\u0630\u0643\u0631\u0647 \u0644\u064a.';
  const firstSentence = (title, author = '') => '\u0644\u064a\u0633 \u0639\u0646\u062f\u064a \u0643\u062a\u0627\u0628 \u0628\u0627\u0633\u0645 \u00ab' + title + '\u00bb' + (author ? ' \u0644\u0640' + author : '') + '.';
  const request = (title, author = '') => ({ explicitBook: true, kind: 'quote', candidates: [
    { title, titleText: title, author, authorText: author, topic: '\u0627\u0644\u0635\u0628\u0631', strong: true },
  ] });
  assert.equal(quote.noBookReply(missingTitle), firstSentence(missingTitle) + invitation, 'general missing books retain both sentences');
  const generalMissing = await quote.answerQuoteRequest(request(missingTitle));
  assert.equal(generalMissing.text, firstSentence(missingTitle) + invitation, 'general missing-book route retains the invitation');
  const expectedTitles = {
    'FC-004992': '\u0627\u0644\u062f\u0627\u0631 \u0627\u0644\u0622\u062e\u0631\u0629 - \u0639\u0645\u0631 \u0639\u0628\u062f \u0627\u0644\u0643\u0627\u0641\u064a',
    'FC-005049': '\u0634\u0631\u062d \u0643\u062a\u0627\u0628 \u0627\u0644\u0641\u0648\u0627\u0626\u062f',
    'FC-006129': '\u0645\u0642\u062a\u0637\u0641\u0627\u062a \u0645\u0646 \u0627\u0644\u0633\u064a\u0631\u0629',
    'FC-007063': '\u062f\u0631\u0648\u0633 \u0627\u0644\u062f\u0643\u062a\u0648\u0631 \u0639\u0645\u0631 \u0639\u0628\u062f \u0627\u0644\u0643\u0627\u0641\u064a',
  };
  assert.deepEqual(data.bookTitles, expectedTitles, 'removed titles must match the four baseline catalogue titles');
  for (const [id, title] of Object.entries(expectedTitles)) {
    const result = await quote.answerQuoteRequest(request(title));
    assert.equal(result.outcome, 'no_book');
    const expectedReply = id === 'FC-004992'
      ? '\u0644\u064a\u0633 \u0639\u0646\u062f\u064a \u0643\u062a\u0627\u0628 \u0628\u0627\u0633\u0645 \u00ab\u0627\u0644\u062f\u0627\u0631 \u0627\u0644\u0622\u062e\u0631\u0629\u00bb \u0644\u0640\u0639\u0645\u0631 \u0639\u0628\u062f \u0627\u0644\u0643\u0627\u0641\u064a.'
      : firstSentence(title);
    assert.equal(result.text, expectedReply, 'removed title gets its required first sentence');
  }
  for (const form of person.forms) {
    const result = await quote.answerQuoteRequest(request(missingTitle, form));
    assert.equal(result.outcome, 'no_book');
    assert.equal(result.text, quote.noBookReply(missingTitle, person.canonical).split('. ')[0] + '.', 'each removed author form uses the canonical author name');
  }
  // A synthetic open work shares an exact removed title but belongs to another author.
  const sharedTitle = expectedTitles['FC-005049'];
  const sharedRow = ['FC-999998', sharedTitle, 'Other Author', 'classic', 0, 0];
  const quoteSource = fs.readFileSync(path.join(root, 'lib', 'lib-quote.js'), 'utf8')
    .replace("import { LIB_CATALOG } from './data/lib-catalog.js';", 'const LIB_CATALOG = ' + JSON.stringify([sharedRow]) + ';')
    .replace(/from '(\.[^']+)'/g, (_, rel) => 'from ' + JSON.stringify(pathToFileURL(path.resolve(root, 'lib', rel)).href));
  const collisionQuote = await import('data:text/javascript;base64,' + Buffer.from(quoteSource).toString('base64'));
  const collisionRequests = [];
  const collision = await collisionQuote.answerQuoteRequest(request(sharedTitle, 'Other Author'), {
    createEvidenceTable: () => ({}),
    fetchImpl: async () => ({ ok: true, status: 200, url: 'https://library.example/search',
      headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ hits: [
        { atom_id: 'fixture-atom', subject_id: sharedRow[0], book_title: sharedTitle, author: sharedRow[2],
          text: 'Open book quotation.', numbering: 'print', page_citable: true, page_start: 1, volume: 1 },
      ] }) }),
    runTool: async (name, input, ctx) => {
      collisionRequests.push({ name, bookIds: ctx.bookIds });
      await ctx.fetchImpl('https://library.example/search', {});
      return { calls: 1, added: [{ recordId: 'lib:fixture-atom' }] };
    },
  });
  assert.equal(collision.outcome, 'quoted', 'an open book sharing a removed title must still be quoted');
  assert.ok(collision.text.includes('> Open book quotation.'));
  assert.deepEqual(collisionRequests, [{ name: 'search_library', bookIds: [sharedRow[0]] }]);

  const [{ searchLibrary, readLibraryPage }, apiModule, catalogModule, toolsModule] = await Promise.all([
    import(pathToFileURL(path.join(root, 'lib', 'lib-service.js')).href),
    import(pathToFileURL(path.join(root, 'api', 'lib-search.js')).href),
    import(pathToFileURL(path.join(root, 'lib', 'data', 'lib-catalog.js')).href),
    import(pathToFileURL(path.join(root, 'lib', 'free-brain', 'tools.js')).href),
  ]);
  const requests = [];
  const toolContext = {
    question: opinionQuestion, libFlagValue: 'on', libToken: 'fixture-token', spend: [], degraded: [],
    fetchImpl: async (url, init) => {
      requests.push(JSON.parse(init.body));
      return { ok: true, status: 200, url: String(url), headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ hits: [] }) };
    },
  };
  const toolOut = await toolsModule.runTool('search_library', { query: opinionQuestion }, toolContext);
  assert.equal(toolOut.calls, 1, 'free-brain search_library must run through the service');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].q, helper.stripRemovedPersonQuery(opinionQuestion), 'free-brain must strip the attribution and search the topic');
  assert.equal(toolContext.spend[0].query, '\u0627\u0644\u0635\u0628\u0631');
  assert.equal(toolContext.spend[0].bypassed, undefined);
  const blocked = catalogModule.LIB_CATALOG.find((row) => row[5] === 1)[0];
  const hits = [
    { atom_id: data.atoms[0], subject_id: 'FC-003147', text: 'direct quote' },
    { atom_id: 'FC-009999:0001:001', subject_id: blocked, text: 'blocked source' },
    { atom_id: 'FC-006999:0937:002', subject_id: 'FC-006999', text: 'historical namesake' },
  ];
  let fetches = 0;
  const fetchImpl = async (url) => {
    fetches += 1;
    return { ok: true, url: String(url), headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ hits }) };
  };
  const result = await searchLibrary('witness', { flagValue: 'on', token: 'fixture-token', fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.hitsSeen, 3);
  assert.equal(result.dropped, 2);
  assert.deepEqual(result.records.map((row) => row.provenance.atom_id), ['FC-006999:0937:002']);
  const page = await readLibraryPage({ bookId: data.books[0], page: 1 }, { flagValue: 'on', fetchImpl });
  assert.deepEqual(page, { ok: false, reason: 'lib_book_removed' });
  assert.equal(fetches, 1, 'removed book page must be refused before fetch');
  const shaped = apiModule.shapeSearchResponse({ hits });
  assert.deepEqual(shaped.hits.map((row) => row.atom_id), ['FC-006999:0937:002']);
  console.log('removed-sources guard: PASS');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});

function pathToFileURL(file) {
  return require('node:url').pathToFileURL(file);
}
