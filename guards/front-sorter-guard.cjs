// guards/front-sorter-guard.cjs -- THE FRONT SORTER AND THE GENERAL FRAME
// (order EZIK-SORTER-ORDER-2026-10-01, "understand before you frame").
//
// WHAT THIS PROVES, WITH NO NETWORK AND NO REAL MODEL. The model of the sorter is a fake handed through
// startSorter's `ask`, or through the one fake globalThis.fetch under the REAL api/ask.js handler. Nothing
// here asks the real model for anything.
//
//   A  the explicit ruling cues: every one matches, as a whole word, with the prefixes {و، ف، ب، ال} only;
//      «حكمة» «محكمة» «الشركة» and the rest do not (no suffix is ever taken off)
//   B  when the model is asked: every condition of the order, positive and negative
//   C  what the model is shown, and how its answer is read; timeout, error, unreadable answer; the fixed
//      budget, the fast model, the instruction text (pinned by sha256)
//   D  the general frame: the one line of the system prompt and the two depth instructions, in the general
//      frame and not in the shari'a one; the persona line about songs stays; lib/system-prompt.js is untouched
//   E  the real handler, one fake fetch: WORLDLY -> GENERAL (no BW2, no fatwa prefetch, general frame);
//      RELIGIOUS / timeout / error / unreadable -> as today; the switch off -> today byte for byte; a ruling
//      cue and a minor and a live-search turn are never sorted; the new telemetry fields are closed
//   F  the placement in api/ask.js: started at the lexical runtime, awaited after the two early exits and
//      before the first consumer, cancelled by an early exit
//   G  the measured battery (T1-T10, Q1-Q11, siblings, summaries, follow-ups, the buttons of app.jsx, minors):
//      the lexical runtime, the cue, whether the model is asked, the frame -- and the 134-question battery
//   M  mutants of lib/front-sorter.js: each is applied (checked) and each is killed
//
// Usage: node guards/front-sorter-guard.cjs [--table OUT.json]   (OUT.json receives the battery with the
//        Arabic text; the console shows ids and states only and is ASCII)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { harness } = require('./output-reviewer-mutant-lib.cjs');

const { ok, finish } = harness('front-sorter');
const REPO = path.resolve(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-front-sorter.json'), 'utf8'));
const tableOut = process.argv.includes('--table') ? process.argv[process.argv.indexOf('--table') + 1] : null;
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');

// The instruction text of the model, pinned. The order gave it letter for letter.
const SYSTEM_SHA = 'a558cf7a682f3d342c4e6e0707a747e5c89184643e0032f20706c143b8271512';

async function main() {
  const FS = await esm('lib/front-sorter.js');
  const GF = await esm('lib/general-frame.js');
  const RC = await esm('lib/route-classify.js');
  const SD = await esm('lib/stored-deen.js');
  const AP = await esm('lib/ask-plan.js');
  const SP = await esm('lib/system-prompt.js');
  const SCOPE = await esm('lib/bw2-scope.js');
  const BW = await esm('lib/before-writing-v2.js');
  const FB = await esm('lib/free-brain/instructions.js');
  const ASKMOD = await esm('api/ask.js');
  const askSource = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  const sorterSource = fs.readFileSync(path.join(REPO, 'lib/front-sorter.js'), 'utf8');

  const WISDOM = FIX.mutantProbe;
  const msgs = (...texts) => texts.map((t, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: t }));

  // ------------------------------------------------------------------------------------------------ A
  for (const q of FIX.cuePositive) ok('A1 cue matches: ' + ascii(JSON.stringify(q)), FS.hasRulingCue(q) === true);
  for (const q of FIX.cueNegative) ok('A2 cue does not match: ' + ascii(JSON.stringify(q)), FS.hasRulingCue(q) === false);
  ok('A3 prefixes are the closed set and no suffix is ever taken off',
    FS.prefixForms('\u0627\u0644\u062d\u0643\u0645').has('\u062d\u0643\u0645')
    && FS.prefixForms('\u0648\u0628\u0627\u0644\u062d\u0643\u0645').has('\u062d\u0643\u0645')
    && !FS.prefixForms('\u062d\u0643\u0645\u0629').has('\u062d\u0643\u0645')
    && !FS.prefixForms('\u0644\u0644\u062d\u0643\u0645').has('\u062d\u0643\u0645'));

  // ------------------------------------------------------------------------------------------------ B
  const base = { enabled: true, band: 'adult', freeBrainEnabled: true, runtime: 'STORED_FIQH', liveSearch: false, excluded: '', text: FIX.map[0].q };
  const el = (over) => FS.sorterEligibility({ ...base, ...over });
  ok('B1 all conditions together: asked', el({}).ask === true);
  ok('B2 HADITH is asked as well', el({ runtime: 'HADITH' }).ask === true);
  ok('B3 switch off: not asked, state disabled', el({ enabled: false }).ask === false && el({ enabled: false }).sorter === 'disabled');
  for (const band of ['young', 'teen', '', 'unknown']) ok('B4 band ' + band + ': not asked', el({ band }).ask === false && el({ band }).sorter === 'not_asked');
  ok('B5 free brain off: not asked', el({ freeBrainEnabled: false }).ask === false);
  for (const runtime of ['GENERAL', 'LOCAL_QURAN', 'LOCAL_ADHKAR', 'LOCAL_WORSHIP', '']) ok('B6 runtime ' + (runtime || 'empty') + ': not asked', el({ runtime }).ask === false);
  ok('B7 live search: not asked', el({ liveSearch: true }).ask === false);
  ok('B7b live search is a boolean true and nothing else', el({ liveSearch: 'true' }).ask === true && el({ liveSearch: 1 }).ask === true);
  for (const excluded of ['canonical_store', 'estate_division']) ok('B8 scope ' + excluded + ': not asked', el({ excluded }).ask === false);
  ok('B8b another scope word does not stop it', el({ excluded: 'other' }).ask === true);
  ok('B8c a registered hadith the closed dispatcher answers: not asked (it makes no model call today)', el({ runtime: 'HADITH', closedDeen: true }).ask === false && el({ runtime: 'HADITH', closedDeen: false }).ask === true);
  ok('B8d a grave hazard is answered by the fixed redirect: not asked', el({ hazard: true }).ask === false && el({ hazard: false }).ask === true);
  ok('B9 a ruling cue: not asked, state ruling_cue', el({ text: FIX.cuePositive[0] }).ask === false && el({ text: FIX.cuePositive[0] }).sorter === 'ruling_cue');
  ok('B10 the switch off wins over a cue (state disabled)', el({ enabled: false, text: FIX.cuePositive[0] }).sorter === 'disabled');
  ok('B11 the verdict: worldly -> GENERAL; every other state leaves the runtime',
    FS.runtimeAfterSorter('STORED_FIQH', 'worldly') === 'GENERAL' && FS.runtimeAfterSorter('HADITH', 'worldly') === 'GENERAL'
    && ['religious', 'timeout', 'error', 'not_asked', 'ruling_cue', 'disabled'].every((s) => FS.runtimeAfterSorter('STORED_FIQH', s) === 'STORED_FIQH'));

  // ------------------------------------------------------------------------------------------------ C
  ok('C1 the budget is fixed in code at 1500 ms', FS.FRONT_SORTER_MS_DEFAULT === 1500);
  ok('C2 the model is the BW2 judge\'s model', FS.sorterModel({}) === BW.BW_FAST_MODEL_DEFAULT && FS.sorterModel({}) === BW.fastModel({})
    && FS.sorterModel({ BW_FAST_MODEL: 'x-model' }) === 'x-model' && BW.fastModel({ BW_FAST_MODEL: 'x-model' }) === 'x-model');
  ok('C3 no new environment variable but the switch', !/process\.env\.(?!FRONT_SORTER_V1|BW_FAST_MODEL)/.test(sorterSource) && !/FRONT_SORTER_MS/.test(sorterSource.replace(/FRONT_SORTER_MS_DEFAULT/g, '')));
  ok('C4 the instruction text is pinned (sha256)', sha(FS.FRONT_SORTER_SYSTEM) === SYSTEM_SHA, sha(FS.FRONT_SORTER_SYSTEM));
  ok('C4b the instruction text names the answer words and the sure-case rule', /exactly one word: RELIGIOUS or WORLDLY/.test(FS.FRONT_SORTER_SYSTEM) && /If you are not sure, reply RELIGIOUS\./.test(FS.FRONT_SORTER_SYSTEM));
  ok('C5 the switch: on unless off/false/0', ['off', 'false', '0', ' OFF '].every((v) => FS.frontSorterDecision({ FRONT_SORTER_V1: v }).enabled === false)
    && ['', 'on', 'true', '1', 'junk'].every((v) => FS.frontSorterDecision({ FRONT_SORTER_V1: v }).enabled === true) && FS.frontSorterDecision({}).enabled === true);
  // the answer is read
  const rd = FS.readSorterAnswer;
  ok('C6 WORLDLY in any case with punctuation is worldly', ['WORLDLY', 'worldly', 'Worldly.', ' WORLDLY\n', '"WORLDLY"', 'WORLDLY!'].every((v) => rd(v) === 'worldly'));
  ok('C7 RELIGIOUS is religious', ['RELIGIOUS', 'religious.', 'Religious\n'].every((v) => rd(v) === 'religious'));
  ok('C8 anything else is not worldly (error)', ['', 'maybe', 'WORLDLY RELIGIOUS', 'This is worldly', 'NOT WORLDLY', null, undefined, 5].every((v) => rd(v) === 'error'));
  // the input
  const sIn = FS.sorterInput;
  ok('C9 a single message: its first 2000 characters', sIn(msgs('abc')) === 'abc' && sIn(msgs('x'.repeat(2500))).length === 2000);
  const longFollow = sIn([{ role: 'user', content: FIX.followupPrevious[0].q }, { role: 'assistant', content: 'A' }, { role: 'user', content: FIX.followupLatest[0] }]);
  ok('C10 a short follow-up carries the previous user message in the order\'s shape',
    longFollow === 'Previous user message:\n' + FIX.followupPrevious[0].q + '\n\nLatest user message:\n' + FIX.followupLatest[0]);
  ok('C11 a full question after another turn is shown alone', sIn([{ role: 'user', content: FIX.map[3].q }, { role: 'assistant', content: 'A' }, { role: 'user', content: FIX.map[4].q }]) === FIX.map[4].q);
  ok('C12 the assistant turns are never shown', !sIn([{ role: 'user', content: 'QQ' }, { role: 'assistant', content: 'SECRET-ANSWER' }, { role: 'user', content: FIX.followupLatest[1] }]).includes('SECRET-ANSWER'));
  ok('C13 block-array content is read', sIn([{ role: 'user', content: [{ type: 'text', text: 'hello' }, { type: 'image' }] }]) === 'hello');
  // the call, with a fake model
  const call = async (replyOrFn, over = {}) => {
    const seen = [];
    const ask = typeof replyOrFn === 'function' ? replyOrFn : async () => replyOrFn;
    const run = FS.startSorter({ messages: msgs(FIX.map[0].q), ask: async (a) => { seen.push(a); return ask(a); }, env: {}, ...over });
    return { out: await run.promise, seen, run };
  };
  {
    const r = await call('WORLDLY');
    ok('C14 worldly', r.out.sorter === 'worldly' && typeof r.out.ms === 'number');
    ok('C15 the call: fast model, the pinned instruction, small max_tokens, the input',
      r.seen.length === 1 && r.seen[0].model === BW.BW_FAST_MODEL_DEFAULT && r.seen[0].system === FS.FRONT_SORTER_SYSTEM
      && r.seen[0].maxTokens <= 16 && r.seen[0].user === FIX.map[0].q);
  }
  ok('C16 religious', (await call('RELIGIOUS')).out.sorter === 'religious');
  ok('C17 an unreadable answer is error', (await call('I think so')).out.sorter === 'error');
  ok('C18 a rejecting model is error', (await call(async () => { throw new Error('boom'); })).out.sorter === 'error');
  ok('C19 a throwing model call is error', (await call(() => { throw new Error('sync boom'); })).out.sorter === 'error');
  {
    let aborted = false;
    const t0 = Date.now();
    const r = await call((a) => new Promise((_, rej) => { a.signal.addEventListener('abort', () => { aborted = true; rej(new Error('aborted')); }); }), { timeoutMs: 40 });
    ok('C20 a hanging model is a timeout at the budget, and the call is aborted', r.out.sorter === 'timeout' && aborted && Date.now() - t0 < 1000);
  }
  {
    let aborted = false;
    const run = FS.startSorter({ messages: msgs('q'), ask: (a) => new Promise((_, rej) => { a.signal.addEventListener('abort', () => { aborted = true; rej(new Error('aborted')); }); }), env: {}, timeoutMs: 5000 });
    await Promise.resolve(); await Promise.resolve();
    run.cancel();
    const out = await run.promise;
    ok('C21 cancel aborts the call in flight and the promise still resolves (never rejects)', aborted && out.sorter === 'error');
    let called = 0;
    const early = FS.startSorter({ messages: msgs('q'), ask: async () => { called += 1; return 'WORLDLY'; }, env: {}, timeoutMs: 5000 });
    early.cancel();
    const out2 = await early.promise;
    await Promise.resolve(); await Promise.resolve();
    ok('C21b a run cancelled before it started never calls the model', called === 0 && out2.sorter === 'error');
  }
  {
    // the default caller: the provider body
    const realFetch = globalThis.fetch;
    let body = null; let url = null; let hdrs = null;
    globalThis.fetch = async (u, init) => { url = u; hdrs = init.headers; body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'WORLDLY' }] }) }; };
    try {
      const out = await FS.startSorter({ messages: msgs('q'), providerUrl: 'https://example.invalid/v1/messages', headers: { 'x-test': '1' }, env: {} }).promise;
      ok('C22 the default caller posts model, temperature 0, small max_tokens, the pinned system, one user message',
        out.sorter === 'worldly' && url === 'https://example.invalid/v1/messages' && hdrs['x-test'] === '1'
        && body.model === BW.BW_FAST_MODEL_DEFAULT && body.temperature === 0 && body.max_tokens <= 16 && body.system === FS.FRONT_SORTER_SYSTEM
        && body.messages.length === 1 && body.messages[0].role === 'user' && !('stream' in body) && !('tools' in body));
      globalThis.fetch = async () => ({ ok: false, status: 529, json: async () => ({}) });
      const bad = await FS.startSorter({ messages: msgs('q'), providerUrl: 'https://example.invalid', headers: {}, env: {} }).promise;
      ok('C23 an HTTP failure is error', bad.sorter === 'error');
    } finally { globalThis.fetch = realFetch; }
  }

  // ------------------------------------------------------------------------------------------------ D
  const profiles = [[30, 'male', 'chat'], [30, 'female', 'chat'], [30, 'male', 'call'], [45, 'female', 'call']];
  for (const [age, gender, mode] of profiles) {
    const text = SP.buildSystemPrompt('x', age, gender, mode);
    const g = GF.generalizeSystemText(text);
    const countOf = (hay, needle) => hay.split(needle).length - 1;
    ok('D1 ' + age + '/' + gender + '/' + mode + ': the shari\'a frame has the line once; the general frame has the other once and not the first',
      countOf(text, GF.SHARIA_SOURCE_LINE) === 1 && g.replaced === true && countOf(g.text, GF.GENERAL_SOURCE_LINE) === 1 && countOf(g.text, GF.SHARIA_SOURCE_LINE) === 0);
    ok('D2 ' + age + '/' + gender + '/' + mode + ': nothing else differs',
      g.text.replace(GF.GENERAL_SOURCE_LINE, GF.SHARIA_SOURCE_LINE) === text);
  }
  ok('D3 a text without the line (or with it twice) is returned untouched, not replaced',
    GF.generalizeSystemText('no line').replaced === false && GF.generalizeSystemText('no line').text === 'no line'
    && GF.generalizeSystemText(GF.SHARIA_SOURCE_LINE + GF.SHARIA_SOURCE_LINE).replaced === false);
  ok('D4 the general line is the order\'s sentence', GF.GENERAL_SOURCE_LINE.startsWith('\u0644\u0627 \u062a\u0630\u0643\u0631\u0652') && GF.GENERAL_SOURCE_LINE.endsWith('\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628.'));
  ok('D5 depth in the general frame: deep and scholar are the order\'s sentences, brief is empty',
    GF.buildGeneralDepthInstruction('deep') === GF.GENERAL_DEPTH_DEEP && GF.buildGeneralDepthInstruction('scholar') === GF.GENERAL_DEPTH_SCHOLAR
    && GF.buildGeneralDepthInstruction('brief') === '' && GF.buildGeneralDepthInstruction('normal') === '' && GF.buildGeneralDepthInstruction(undefined) === '');
  const fiqhDeep = ASKMOD.buildDepthInstruction('deep');
  const fiqhScholar = ASKMOD.buildDepthInstruction('scholar');
  ok('D6 the shari\'a depth instructions are as they were and carry the fiqh the general ones leave out',
    /أدل/.test(fiqhDeep) && fiqhScholar.includes('\u0644\u0645 \u0623\u0642\u0641 \u0639\u0644\u064a\u0647 \u0641\u064a \u0627\u0644\u0645\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u062a\u0627\u062d\u0629')
    && ![GF.GENERAL_DEPTH_DEEP, GF.GENERAL_DEPTH_SCHOLAR].some((t) => /\u0644\u0645 \u0623\u0642\u0641|\u0627\u0644\u0645\u0635\u0627\u062f\u0631|\u0627\u0644\u0645\u0631\u0627\u062c\u0639|\u0623\u062f\u0644|\u0627\u0644\u0641\u0642\u0647|\u062d\u0643\u0645/.test(t)));
  const freeText = FB.buildFreeBrainInstruction({ band: 'adult' });
  ok('D7 the free brain\'s own instructions (UNLOCKS, PERSONA, the line about songs) are not part of the swap and stay', freeText.includes('\u0623\u063a\u0646\u064a\u0629') && freeText.includes('\u0627\u0644\u0645\u0639\u0631\u0641\u0629\u064f \u0627\u0644\u0639\u0627\u0645\u0651\u0629\u064f \u0645\u0641\u062a\u0648\u062d\u0629'));
  const spSource = fs.readFileSync(path.join(REPO, 'lib/system-prompt.js'), 'utf8');
  ok('D8 lib/system-prompt.js still carries the shari\'a line once and not the general one', spSource.split(GF.SHARIA_SOURCE_LINE).length === 2 && !spSource.includes(GF.GENERAL_SOURCE_LINE));
  const gfSource = fs.readFileSync(path.join(REPO, 'lib/general-frame.js'), 'utf8');
  {
    const sys = SP.buildSystemPrompt('x', 30, 'male', 'chat');
    const blocks = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }, { type: 'text', text: fiqhDeep }, { type: 'text', text: 'DATE-BLOCK' }];
    const gb = GF.generalizeSystemBlocks(blocks, fiqhDeep, 'deep');
    ok('D8b the blocks: first block swapped (cache mark kept), the fiqh depth block swapped for the general one, the date block kept as it was',
      gb.replaced === true && gb.blocks.length === 3 && gb.blocks[0].cache_control.type === 'ephemeral' && gb.blocks[0].text.includes(GF.GENERAL_SOURCE_LINE)
      && gb.blocks[1].text === GF.GENERAL_DEPTH_DEEP && gb.blocks[2].text === 'DATE-BLOCK' && blocks[0].text === sys && blocks[1].text === fiqhDeep);
    const brief = GF.generalizeSystemBlocks([blocks[0], { type: 'text', text: 'DATE-BLOCK' }], '', 'brief');
    ok('D8c brief (no depth block): two blocks stay two', brief.replaced === true && brief.blocks.length === 2 && brief.blocks[1].text === 'DATE-BLOCK');
    ok('D8d a system without the line is returned as it was', GF.generalizeSystemBlocks([{ type: 'text', text: 'no line' }], '', 'deep').replaced === false && GF.generalizeSystemBlocks('x', '', 'deep').replaced === false);
  }
  ok('D9 general-frame.js imports nothing', !/^\s*import\s/m.test(gfSource));
  ok('D10 front-sorter.js imports only route-classify.js', (sorterSource.match(/^import .* from '([^']+)'/gm) || []).length === 1 && /from '\.\/route-classify\.js'/.test(sorterSource));

  // ------------------------------------------------------------------------------------------------ F (source placement)
  {
    const at = (needle, from = 0) => askSource.indexOf(needle, from);
    const iLex = at('const currentRuntime = classifyReligiousRuntime(currentQuestionText, currentPlan, route);');
    const iRoute = at("const effectiveRoute = currentRuntime === 'GENERAL' ? 'GEN' : 'DEEN';");
    const iPlan = at('const sorterPlan = sorterEligibility({');
    const iQuote = at("if (libQuoteOn && band === 'adult'");
    const iQuoted = at('return libQuote.writeQuoteReply(res, quoted.text);');
    const iFollowCard = at('return writeQuoteReply(res, sourceFollowUp.composeSourceReply(cards));');
    const iStart = at('startSorter({');
    const iKeep = at('let keepAlive = setInterval(');
    const iFree = at('const emitFreeBrain = ');
    const iTry = at('\n  try {\n', iFree);
    const iLedger = at('const ledgerPath = await decidePath(req);', iTry);
    const iAwait = at('await sorterRun.promise');
    const iShadow = at('const currentRuntime = runtimeAfterSorter(');
    const iShadowRoute = at("const effectiveRoute = currentRuntime === 'GENERAL' ? 'GEN' : 'DEEN';", iShadow);
    const iTopic = at('const topicClass = classifyTopic(questionText, currentPlan, effectiveRoute);');
    const iStored = at('const storedContextLexical = resolveStoredContext(');
    ok('F1 the two lexical lines are exactly as they were (several guards pin them) and the sorter\'s plan is made right after them, before the early exits',
      iLex > 0 && iRoute > iLex && iPlan > iRoute && iPlan < iQuote && askSource.split('const currentRuntime = classifyReligiousRuntime(currentQuestionText, currentPlan, route);').length === 2);
    ok('F2 the call starts after both early exits (which make no model call) and before the stream is committed',
      iStart > iQuoted && iStart > iFollowCard && iStart < iKeep);
    ok('F3 it is awaited inside the try block, after the ledger decision it overlaps with, and before the first consumer',
      iTry > 0 && iLedger > iTry && iAwait > iLedger && iShadow > iAwait && iShadowRoute > iShadow && iTopic > iShadowRoute);
    {
      const between = askSource.slice(iTry, iShadow).split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
      ok('F4 no reader of the two names stands between the try block\'s start and the re-declaration (no temporal dead zone, no consumer before the verdict)',
        iTry > 0 && iShadow > iTry && !/\b(currentRuntime|effectiveRoute)\b/.test(between), (between.match(/\b(currentRuntime|effectiveRoute)\b/) || [''])[0]);
    }
    ok('F5 the route line is written on every path: once at each of the three early exits (the lexical value) and once at the verdict',
      (askSource.match(/\n\s+logRoute\(\);\n\s+return /g) || []).length === 3 && (askSource.match(/\n\s+logRoute\(\{ route: effectiveRoute, runtime: currentRuntime, sorter: sorterState/g) || []).length === 1);
    ok('F6 the early exits are word for word what they were', askSource.includes('return libQuote.writeQuoteReply(res, follow.text);') && askSource.includes('return libQuote.writeQuoteReply(res, quoted.text);') && askSource.includes('return writeQuoteReply(res, sourceFollowUp.composeSourceReply(cards));'));
    ok('F7 the stored context follows the verdict at its producer (WORLDLY -> GENERAL), no consumer touched', iStored > iShadow && /sorterState === 'worldly'\s*\?\s*\{ \.\.\.storedContextLexical, runtime: 'GENERAL', resolvedDomain: 'GENERAL' \}/.test(askSource));
    ok('F8 the general system is derived from the system already built, so the date block is built once; the free brain is handed it; BW2 is handed the shari\'a system as before',
      /generalizeSystemBlocks\(system, depthInstruction, effectiveDepth\)/.test(askSource) && (askSource.match(/buildTodayBlock\(/g) || []).length === 1
      && /system: mojazFbSystemFor\(appendDepthBlock\(generalSystem \|\| system, buildFreeBrainInstruction\(\{ band \}\)\)\)/.test(askSource)
      && /\n          system: mojazSystemFor\(system\),\n          model: bw2WriterModel \|\| model,\n          maxTokens,\n          usePremium,\n          effort: round2Effort,\n          providerUrl: ANTHROPIC_URL,/.test(askSource));
    ok('F9 the classifyImpermissibleRequest site is untouched', /const impermissible = effectiveRoute === 'GEN'/.test(askSource));
    ok('F10 the five new telemetry names are the whole of what the route line adds',
      /lexicalRuntime: currentRuntime, runtime: currentRuntime, sorter: sorterPlan\.sorter, sorterMs: 0, frame: frameFor\(currentRuntime\)/.test(askSource));
    ok('F11 the closed-deen stand-down is computed from the real dispatcher', /const closedDeenAnswers = currentRuntime === 'HADITH'\s*&& !!runClosedDeenTurn\(resolveStoredContext\(/.test(askSource));
  }

  // ------------------------------------------------------------------------------------------------ E (the real handler)
  const FC = await esm('lib/fatwa-contract.js');
  const LEDGER_REDIS = await esm('lib/ledger/redis.js');
  const DAYCAP = await esm('lib/daycap.js');
  const FLAG = await esm('lib/ledger/flag.js');
  const LEGACY = await esm('lib/legacy-policy-flag.js');
  const CONSENT = await esm('lib/ai-consent.js');
  const handler = ASKMOD.default;
  const ENV_KEYS = ['BEFORE_WRITING_V2', 'FREE_BRAIN_V1', 'STREAM_V1', 'TAKHRIJ_V1', 'SHAMELA_BRAIN', 'SEARCH_API_TOKEN',
    'LIB_QUOTE_V1', 'LIB_MUJAZ_V1', 'ENCYC_V1', 'DEPTH_FREE_TRIAL', 'RFC_V05_MODE', 'RFC_V05_LEGACY_POLICY', 'LEDGER_RAG',
    'VERCEL_ENV', 'VERCEL_URL', 'FOUNDER_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'LIVE_WORLD_V2', 'BW2_RETRIEVAL_MS', 'BW2_JUDGE_MS',
    'BW_FAST_MODEL', 'PROPHET_ASCRIPTION_BLOCK', 'BW2_CONTINUE', 'FRONT_SORTER_V1'];
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const realFetch = globalThis.fetch;
  const capCounts = new Map();
  const installDayCapStore = () => {
    capCounts.clear();
    DAYCAP.__setRedisForTest({
      async mget(...keys) { return keys.map((k) => (capCounts.has(k) ? capCounts.get(k) : null)); },
      async sismember() { return 0; },
      pipeline() {
        const ops = [];
        return {
          incr(k) { ops.push(() => { const n = (Number(capCounts.get(k)) || 0) + 1; capCounts.set(k, n); return n; }); },
          expire() { ops.push(() => 1); },
          async exec() { return ops.map((f) => f()); },
        };
      },
    });
  };
  const makeRes = () => ({
    writes: [], ended: 0, statusCode: 0, headers: {}, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    flushHeaders() { this.headersSent = true; },
    write(s) { this.headersSent = true; this.writes.push(String(s)); return true; },
    end() { this.ended += 1; this.headersSent = true; return this; },
    json(o) { this.jsonBody = o; this.ended += 1; return this; },
    once() { return this; }, on() { return this; }, removeListener() { return this; },
  });
  const jsonResponse = (url, o, status = 200) => ({
    ok: status >= 200 && status < 300, status, url: String(url),
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => o, text: async () => JSON.stringify(o),
  });
  const sysTextOf = (b) => (Array.isArray(b.system) ? b.system.map((x) => (x && x.text) || '').join('\n') : String(b.system || ''));
  const WRITER_TEXT = '\u0647\u0630\u0627 \u062c\u0648\u0627\u0628 \u0627\u062e\u062a\u0628\u0627\u0631.';
  let ipSeq = 0;
  // scenario: { sorter: 'WORLDLY'|'RELIGIOUS'|'hang'|'http'|'junk' }, env, band, age, depth, messages
  async function drive(messages, { sorter = 'RELIGIOUS', env = {}, band = 'adult', age = 35, body = {} } = {}) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.ANTHROPIC_API_KEY = 'guard-not-a-real-key';
    process.env.BRAVE_API_KEY = 'guard-not-a-real-key';
    process.env.LEDGER_RAG = 'off';
    process.env.FREE_BRAIN_V1 = 'on';
    Object.assign(process.env, env);
    LEDGER_REDIS.__setRedisForTest(null);
    FLAG.__resetFlagCacheForTest();
    LEGACY.__resetLegacyFlagCacheForTest();
    installDayCapStore();
    const model = [];
    const counts = { sorter: 0, fatwa: 0, judge: 0, other: 0 };
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith(FC.FATWA_BASE)) { counts.fatwa += 1; return jsonResponse(u, { ok: true, schemaVersion: FC.FATWA_SCHEMA, results: [], scholars: [], pagination: { total: 0 }, counts: { scholars: 0 } }); }
      if (u.includes('api.anthropic.com')) {
        const b = JSON.parse(init.body);
        if (b.system === FS.FRONT_SORTER_SYSTEM) {
          counts.sorter += 1;
          model.push(b);
          if (sorter === 'hang') return new Promise((_, rej) => { if (init.signal) init.signal.addEventListener('abort', () => rej(new Error('aborted'))); });
          if (sorter === 'http') return jsonResponse(u, { error: 'x' }, 529);
          const text = sorter === 'junk' ? 'It depends.' : sorter;
          return jsonResponse(u, { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        if (b.system === BW.BW2_JUDGE_SYSTEM) counts.judge += 1; else counts.other += 1;
        model.push(b);
        if (b.stream) {
          let done = false;
          return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => '',
            body: { getReader: () => ({ read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              const frames = 'data: ' + JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 9 } } }) + '\n\n'
                + 'data: ' + JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + '\n\n'
                + 'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: WRITER_TEXT } }) + '\n\n'
                + 'data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } }) + '\n\n'
                + 'data: {"type":"message_stop"}\n\n';
              return { done: false, value: new TextEncoder().encode(frames) };
            } }), cancel: async () => {} } };
        }
        if (!b.tools) {
          return jsonResponse(u, { content: [{ type: 'text', text: JSON.stringify({ d: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(i + 1), 1])) }) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
        }
        return jsonResponse(u, { content: [{ type: 'text', text: WRITER_TEXT }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      if (u.includes('api.search.brave.com')) return jsonResponse(u, { web: { results: [] } });
      return { ok: false, status: 404, url: u, headers: { get: () => 'text/html' }, text: async () => '', json: async () => ({}) };
    };
    const res = makeRes();
    ipSeq += 1;
    const req = {
      method: 'POST',
      headers: { 'x-murabbi-device': 'front-sorter-guard-' + String(ipSeq).padStart(4, '0'), 'x-real-ip': '10.23.0.' + ipSeq,
        [CONSENT.AI_CONSENT_HEADER]: CONSENT.AI_CONSENT_VERSION },
      body: { messages, band, age, ...body },
    };
    const logs = [];
    const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = (...a) => { logs.push(a); };
    console.warn = () => {}; console.error = () => {}; console.info = () => {};
    let crashed = null;
    try { await handler(req, res); } catch (e) { crashed = e; } finally { Object.assign(console, keep); }
    globalThis.fetch = realFetch;
    const logOf = (tag) => (logs.find((a) => a[0] === tag) || [])[1] || null;
    return { res, model, counts, logs, logOf, crashed };
  }
  const t1 = FIX.map[0].q;
  const deepBody = { depth: 'deep' };
  const ROUTE_SORTER = ['not_asked', 'ruling_cue', 'worldly', 'religious', 'timeout', 'error', 'disabled'];
  const RUNTIMES = ['GENERAL', 'STORED_FIQH', 'HADITH', 'LOCAL_QURAN', 'LOCAL_ADHKAR', 'LOCAL_WORSHIP'];
  const closedRoute = (r) => r && ROUTE_SORTER.includes(r.sorter) && RUNTIMES.includes(r.runtime) && RUNTIMES.includes(r.lexicalRuntime)
    && typeof r.sorterMs === 'number' && ['sharia', 'general'].includes(r.frame);
  try {
    // E1 religious
    {
      const d = await drive(msgs(t1), { sorter: 'RELIGIOUS' });
      const rt = d.logOf('[route]'); const fb = d.logOf('[free-brain]'); const bw = d.logOf('[bw2]');
      ok('E1 RELIGIOUS: the model is asked once; the lexical runtime stands; BW2 is taken as today; the shari\'a frame',
        !d.crashed && d.counts.sorter === 1 && rt.sorter === 'religious' && rt.runtime === 'STORED_FIQH' && rt.lexicalRuntime === 'STORED_FIQH' && rt.route === 'DEEN'
        && rt.frame === 'sharia' && fb.bw2 === true && fb.runtime === 'STORED_FIQH' && fb.frame === 'sharia' && bw && bw.runtime === 'STORED_FIQH' && bw.frame === 'sharia',
        ascii(JSON.stringify({ crashed: d.crashed && String(d.crashed.stack).slice(0, 300), rt, fb })));
      ok('E1b the fatwa store is asked (BW2 gathers), as today', d.counts.fatwa > 0, JSON.stringify(d.counts));
    }
    // E2 worldly
    {
      const d = await drive(msgs(t1), { sorter: 'WORLDLY', body: deepBody, env: { DEPTH_FREE_TRIAL: 'on' } });
      const rt = d.logOf('[route]'); const fb = d.logOf('[free-brain]');
      ok('E2 WORLDLY: runtime GENERAL, route GEN, general frame, no BW2',
        !d.crashed && d.counts.sorter === 1 && rt.sorter === 'worldly' && rt.runtime === 'GENERAL' && rt.lexicalRuntime === 'STORED_FIQH' && rt.route === 'GEN' && rt.frame === 'general'
        && fb.bw2 === false && fb.runtime === 'GENERAL' && fb.frame === 'general' && !d.logOf('[bw2]'),
        ascii(JSON.stringify({ crashed: d.crashed && String(d.crashed.stack).slice(0, 300), rt, fb })));
      ok('E2b no fatwa prefetch, no judge: the storedContext follows the verdict', d.counts.fatwa === 0 && d.counts.judge === 0, JSON.stringify(d.counts));
      const free = d.model.filter((b) => b.system !== FS.FRONT_SORTER_SYSTEM && Array.isArray(b.system));
      const text0 = free.length ? sysTextOf(free[0]) : '';
      ok('E2c the system the free brain got: the general line in place of the shari\'a one, the general deep instruction, not the fiqh one',
        free.length > 0 && free.every((b) => sysTextOf(b).includes(GF.GENERAL_SOURCE_LINE) && !sysTextOf(b).includes(GF.SHARIA_SOURCE_LINE)
          && sysTextOf(b).includes(GF.GENERAL_DEPTH_DEEP) && !sysTextOf(b).includes(fiqhDeep)),
        free.length + ' ' + text0.length);
      ok('E2d the free brain\'s own instructions are still there', free.length > 0 && free.every((b) => sysTextOf(b).includes(FB.buildFreeBrainInstruction({ band: 'adult' }))));
    }
    // E3 the shari'a frame is byte for byte what it was for a religious turn, deep
    {
      const d = await drive(msgs(t1), { sorter: 'RELIGIOUS', body: deepBody, env: { DEPTH_FREE_TRIAL: 'on' } });
      const bw2Bodies = d.model.filter((b) => b.system !== FS.FRONT_SORTER_SYSTEM && b.system !== BW.BW2_JUDGE_SYSTEM && Array.isArray(b.system));
      ok('E3 a religious turn keeps the shari\'a line and the fiqh deep instruction, and not the general ones',
        bw2Bodies.length > 0 && bw2Bodies.every((b) => sysTextOf(b).includes(GF.SHARIA_SOURCE_LINE) && !sysTextOf(b).includes(GF.GENERAL_SOURCE_LINE)
          && sysTextOf(b).includes(fiqhDeep) && !sysTextOf(b).includes(GF.GENERAL_DEPTH_DEEP)));
    }
    // E4 timeout / error / unreadable -> as today
    for (const [mode, expect] of [['hang', 'timeout'], ['http', 'error'], ['junk', 'error']]) {
      const t0 = Date.now();
      const d = await drive(msgs(t1), { sorter: mode });
      const rt = d.logOf('[route]'); const fb = d.logOf('[free-brain]');
      ok('E4 sorter ' + mode + ' -> ' + expect + ': the lexical runtime stands, BW2 taken, shari\'a frame',
        !d.crashed && rt && rt.sorter === expect && rt.runtime === 'STORED_FIQH' && fb.bw2 === true && fb.frame === 'sharia'
        && (mode !== 'hang' || (rt.sorterMs >= 1400 && rt.sorterMs < 4000 && Date.now() - t0 >= 1400)),
        ascii(JSON.stringify(rt)));
    }
    // E5 the switch off
    {
      const d = await drive(msgs(t1), { sorter: 'WORLDLY', env: { FRONT_SORTER_V1: 'off' } });
      const rt = d.logOf('[route]'); const fb = d.logOf('[free-brain]');
      ok('E5 FRONT_SORTER_V1=off: no call, state disabled, today\'s runtime, BW2, shari\'a frame',
        !d.crashed && d.counts.sorter === 0 && rt.sorter === 'disabled' && rt.runtime === 'STORED_FIQH' && rt.frame === 'sharia' && fb.bw2 === true && fb.frame === 'sharia');
      const g = await drive(msgs(FIX.map[3].q), { sorter: 'WORLDLY', env: { FRONT_SORTER_V1: 'off' } });
      const gFree = g.model.filter((b) => b.system !== FS.FRONT_SORTER_SYSTEM && Array.isArray(b.system));
      ok('E5b switch off, a lexically GENERAL turn: the shari\'a frame, exactly as today',
        !g.crashed && g.counts.sorter === 0 && g.logOf('[route]').runtime === 'GENERAL' && g.logOf('[route]').frame === 'sharia' && gFree.length > 0
        && gFree.every((b) => sysTextOf(b).includes(GF.SHARIA_SOURCE_LINE) && !sysTextOf(b).includes(GF.GENERAL_SOURCE_LINE)));
      const g2 = await drive(msgs(FIX.map[3].q), { sorter: 'WORLDLY' });
      const g2Free = g2.model.filter((b) => b.system !== FS.FRONT_SORTER_SYSTEM && Array.isArray(b.system));
      ok('E5c switch on, a lexically GENERAL turn: no call is needed, and the frame is general',
        !g2.crashed && g2.counts.sorter === 0 && g2.logOf('[route]').sorter === 'not_asked' && g2.logOf('[route]').frame === 'general' && g2Free.length > 0
        && g2Free.every((b) => sysTextOf(b).includes(GF.GENERAL_SOURCE_LINE) && !sysTextOf(b).includes(GF.SHARIA_SOURCE_LINE)));
    }
    // E6 a ruling cue is religious without a call
    {
      const d = await drive(msgs(FIX.map[5].q), { sorter: 'WORLDLY' });
      const rt = d.logOf('[route]'); const fb = d.logOf('[free-brain]');
      ok('E6 a ruling cue: no call, state ruling_cue, BW2 as today', !d.crashed && d.counts.sorter === 0 && rt.sorter === 'ruling_cue' && rt.runtime === 'STORED_FIQH' && fb.bw2 === true);
    }
    // E7 minors
    for (const [band, age] of [['young', 8], ['teen', 14]]) {
      const d = await drive(msgs(t1), { sorter: 'WORLDLY', band, age });
      const rt = d.logOf('[route]');
      ok('E7 a ' + band + ' reader is never sorted: no call, today\'s runtime, shari\'a frame', !d.crashed && d.counts.sorter === 0 && rt && rt.sorter === 'not_asked' && rt.runtime === rt.lexicalRuntime && rt.frame === 'sharia', ascii(JSON.stringify(rt)));
    }
    // E8 live search
    {
      const d = await drive(msgs(t1), { sorter: 'WORLDLY', body: { liveSearch: true } });
      ok('E8 a live-search turn is not sorted', !d.crashed && d.counts.sorter === 0 && d.logOf('[route]').sorter === 'not_asked' && d.logOf('[route]').runtime === 'STORED_FIQH');
    }
    // E10 a short follow-up after a worldly turn reaches the model with its previous message
    {
      const worldlyThread = [{ role: 'user', content: t1 }, { role: 'assistant', content: 'A' }, { role: 'user', content: FIX.followupLatest[0] }];
      const d = await drive(worldlyThread, { sorter: 'WORLDLY' });
      const sorterBody = d.model.find((b) => b.system === FS.FRONT_SORTER_SYSTEM);
      const rt = d.logOf('[route]');
      ok('E10 a short follow-up after a worldly turn: the model is shown both user messages and the verdict is applied',
        !d.crashed && rt && rt.lexicalRuntime === 'STORED_FIQH' && sorterBody && sorterBody.messages[0].content === FS.sorterInput(worldlyThread)
        && rt.sorter === 'worldly' && rt.runtime === 'GENERAL', ascii(JSON.stringify(rt)));
    }
    // E10b a registered hadith: the closed dispatcher answers with no model, the sorter adds none
    {
      const d = await drive(msgs(FIX.hadithClosed), { sorter: 'WORLDLY' });
      const rt = d.logOf('[route]');
      ok('E10b a registered hadith answered by the closed dispatcher: no sorter call, no model call at all',
        !d.crashed && rt && rt.lexicalRuntime === 'HADITH' && rt.sorter === 'not_asked' && d.counts.sorter === 0 && d.model.length === 0, ascii(JSON.stringify({ rt, counts: d.counts })));
    }
    // E11    // E11 telemetry is closed, and the question is in no log line
    {
      const d = await drive(msgs(t1), { sorter: 'WORLDLY' });
      const all = JSON.stringify(d.logs);
      ok('E11 the new fields are closed words and a number', closedRoute(d.logOf('[route]')));
      ok('E11b no log line carries the question or a piece of it', !all.includes('\u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646') && !all.includes('\u0627\u0644\u062a\u0648\u0642\u064a\u0639'));
    }
    // E12 an early exit (what is your source) leaves before the sorter is needed and logs the route once
    {
      const thread = [
        { role: 'user', content: t1 },
        { role: 'assistant', content: 'x <source site="binbaz.org.sa" url="https://binbaz.org.sa/fatwas/1">t</source>' },
        { role: 'user', content: '\u0645\u0627 \u0645\u0635\u062f\u0631\u0643\u061f' },
      ];
      const d = await drive(thread, { sorter: 'WORLDLY' });
      const routes = d.logs.filter((a) => a[0] === '[route]');
      ok('E12 "what is your source": answered without the sorter, one route line', !d.crashed && d.counts.sorter === 0 && routes.length === 1 && closedRoute(routes[0][1]), ascii(JSON.stringify(routes)));
    }
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }

  // ------------------------------------------------------------------------------------------------ G (the batteries)
  const decide = (messages, band) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = typeof lastUser.content === 'string' ? lastUser.content : '';
    const route = RC.classifyRoute(messages);
    const plan = AP.planAsk([{ role: 'user', content: text }], { policyEnabled: true });
    const lexical = SD.classifyReligiousRuntime(text, plan, route);
    const excluded = SCOPE.bw2ScopeExclusion(text);
    const e = FS.sorterEligibility({ enabled: true, band, freeBrainEnabled: true, runtime: lexical, liveSearch: false, excluded, text });
    let frame = 'sharia';
    let model = 'no';
    if (band !== 'adult') frame = 'sharia';
    else if (lexical === 'GENERAL') frame = 'general';
    else if (e.ask) { model = 'asked'; frame = 'by-verdict'; }
    return { lexical, cue: FS.hasRulingCue(text), excluded: excluded || '', state: e.sorter, asked: e.ask, frame, model };
  };
  const rows = [];
  const add = (set, id, q, messages, band = 'adult') => { const d = decide(messages || [{ role: 'user', content: q }], band); rows.push({ set, id, band, q, ...d }); return d; };
  for (const x of FIX.map) add('map', x.id, x.q);
  for (const x of FIX.siblings) add('siblings', x.id, x.q);
  for (const x of FIX.summaries) add('summaries', x.id, x.q);
  for (const p of FIX.followupPrevious) for (let i = 0; i < FIX.followupLatest.length; i++) {
    add('followups', p.id + '+L' + (i + 1), FIX.followupLatest[i], [{ role: 'user', content: p.q }, { role: 'assistant', content: 'A' }, { role: 'user', content: FIX.followupLatest[i] }]);
  }
  // the buttons, extracted from app.jsx itself
  const appJsx = fs.readFileSync(path.join(REPO, 'app.jsx')).toString('utf8');
  const unesc = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const buttons = [];
  for (const m of appJsx.matchAll(/\{ key: '(simplify|example|quiz|shorten|continue)',[^\n]*?prompt: '([^']+)'/g)) buttons.push({ id: 'B-' + m[1], q: unesc(m[2]) });
  for (const [name, id] of [['EZIK_BAR_SUMMARIZE_PROMPT', 'B-summarize'], ['EZIK_BAR_EXPAND_PROMPT', 'B-expand']]) {
    const m = new RegExp('const ' + name + " = '([^']+)'").exec(appJsx);
    if (m) buttons.push({ id, q: unesc(m[1]) });
  }
  ok('G1 the seven buttons of app.jsx are found (simplify, example, quiz, shorten, continue, summarize, expand)', buttons.length === 7, String(buttons.length));
  for (const p of FIX.followupPrevious.filter((x) => x.kind !== 'worldly' || x.id === 'P-worldly-deenword')) for (const b of buttons) {
    add('buttons-after-' + p.kind + (p.id === 'P-worldly-deenword' ? '-deenword' : ''), b.id, b.q, [{ role: 'user', content: p.q }, { role: 'assistant', content: 'A' }, { role: 'user', content: b.q }]);
  }
  const sumAsk = /const EZIK_SUM_ASK = \[([\s\S]*?)\]\.join\(/.exec(appJsx);
  ok('G2 the summary-card request template (EZIK_SUM_ASK) is found in app.jsx', !!sumAsk);
  if (sumAsk) add('summary-card', 'EZIK_SUM_ASK', sumAsk[1].slice(0, 400), null);
  // the same seats for a young reader and a teen (measurement only)
  for (const band of ['young', 'teen']) for (const id of ['T1', 'T4', 'Q4', 'T5', 'Q9']) {
    const x = FIX.map.find((y) => y.id === id);
    add('minor-' + band, id, x.q, null, band);
  }
  ok('G3 every minor seat: never asked, the shari\'a frame', rows.filter((r) => r.band !== 'adult').every((r) => r.asked === false && r.frame === 'sharia'));
  const byId = (set, id) => rows.find((r) => r.set === set && r.id === id);
  ok('G4 the map\'s defect: T1 (a name), T4 and Q3 (company), Q4, Q9 (account), Q11 (Eid) are STORED_FIQH lexically and are sent to the model',
    ['T1', 'T4', 'Q3', 'Q4', 'Q9', 'Q11'].every((id) => byId('map', id).lexical === 'STORED_FIQH' && byId('map', id).asked === true));
  ok('G5 the map\'s controls: T2, T3, T10, Q2, Q5-Q8 are GENERAL lexically (no call), general frame',
    ['T2', 'T3', 'T10', 'Q2', 'Q5', 'Q6', 'Q7', 'Q8'].every((id) => byId('map', id).lexical === 'GENERAL' && byId('map', id).asked === false && byId('map', id).frame === 'general'));
  ok('G6 T5 and T6: a ruling is religious without a model; a scholar\'s opinion stays lexical', byId('map', 'T5').state === 'ruling_cue' && byId('map', 'T5').asked === false && byId('map', 'T6').lexical === 'STORED_FIQH');
  ok('G7 the shari\'a cue siblings are never sent', FIX.siblings.filter((x) => x.kind === 'religious' && FS.hasRulingCue(x.q)).every((x) => byId('siblings', x.id).asked === false));

  // the 134-question battery of the earlier rounds, found in the archive (absent on a machine without it)
  const BATTERY = 'C:\\Users\\passe\\projects\\ustaz-archive\\sessions\\speed-2026-09-26\\04-preview\\EZIK-SPEED-JUZFIX-ARTIFACTS-2026-09-28\\retrieval-carry-run1.json';
  let battery = null;
  try { battery = JSON.parse(fs.readFileSync(BATTERY, 'utf8')).rows; } catch { battery = null; }
  let b134 = null;
  if (battery && battery.length === 134) {
    b134 = { total: 134, lexical: {}, cue: 0, asked: 0, excluded: 0, general: 0, askedIds: [] };
    for (const r of battery) {
      const d = decide([{ role: 'user', content: r.q }], 'adult');
      b134.lexical[d.lexical] = (b134.lexical[d.lexical] || 0) + 1;
      if (d.asked) { b134.asked += 1; b134.askedIds.push(r.set + ':' + r.id); }
      else if (d.state === 'ruling_cue') b134.cue += 1;
      else if (d.excluded) b134.excluded += 1;
      else if (d.lexical === 'GENERAL') b134.general += 1;
    }
    ok('G8 the 134 questions: every question is exactly one of: cue / asked / scope / lexically GENERAL',
      b134.cue + b134.asked + b134.excluded + b134.general === 134, JSON.stringify({ cue: b134.cue, asked: b134.asked, excluded: b134.excluded, general: b134.general }));
    say('BATTERY134 total=134 ruling_cue=' + b134.cue + ' model_decides=' + b134.asked + ' scope=' + b134.excluded + ' lexical_general=' + b134.general + ' lexical=' + JSON.stringify(b134.lexical));
  } else {
    say('BATTERY134 not found at the recorded archive path on this machine (not a failure)');
  }

  // ------------------------------------------------------------------------------------------------ M (mutants)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'front-sorter-mut-'));
  try {
    fs.copyFileSync(path.join(REPO, 'lib/route-classify.js'), path.join(tmp, 'route-classify.js'));
    const mutate = async (name, from, to) => {
      const n = sorterSource.split(from).length - 1;
      ok('M applied ' + name + ' (seam found once)', n === 1, String(n));
      const file = path.join(tmp, 'front-sorter-' + name + '.js');
      fs.writeFileSync(file, sorterSource.split(from).join(to));
      return import(pathToFileURL(file).href);
    };
    // M1: a suffix may be taken off a word, so that the wisdom word reads as the ruling word
    const m1b = await mutate('suffix', "const rest = form.slice(prefix.length);", "const rest = form.slice(prefix.length).replace(/\\u0647$/, '');");
    ok('M1 KILLED: taking a suffix off makes a cue match inside a longer word', m1b.hasRulingCue(WISDOM) === true && FS.hasRulingCue(WISDOM) === false);
    // M2: the live-search condition dropped
    const m2 = await mutate('livesearch', "if (liveSearch === true) return { ask: false, sorter: 'not_asked' };", '');
    ok('M2 KILLED: dropping the live-search condition sorts a live-search turn', m2.sorterEligibility({ ...base, liveSearch: true }).ask === true && el({ liveSearch: true }).ask === false);
    // M3: the band condition dropped
    const m3 = await mutate('band', "if (band !== 'adult') return { ask: false, sorter: 'not_asked' };", '');
    ok('M3 KILLED: dropping the band condition sorts a child', m3.sorterEligibility({ ...base, band: 'young' }).ask === true && el({ band: 'young' }).ask === false);
    // M4: the verdict inverted
    const m4 = await mutate('verdict', "return sorter === 'worldly' ? 'GENERAL' : lexicalRuntime;", "return sorter === 'religious' ? 'GENERAL' : lexicalRuntime;");
    ok('M4 KILLED: an inverted verdict makes RELIGIOUS general', m4.runtimeAfterSorter('STORED_FIQH', 'religious') === 'GENERAL' && FS.runtimeAfterSorter('STORED_FIQH', 'religious') === 'STORED_FIQH');
    // M5: a doubt reads as worldly
    const m5 = await mutate('doubt', "  return 'error';\n}\n\n// The non-streaming", "  return 'worldly';\n}\n\n// The non-streaming");
    ok('M5 KILLED: an unreadable answer read as worldly', m5.readSorterAnswer('maybe') === 'worldly' && FS.readSorterAnswer('maybe') === 'error');
    // M6: the switch is off by default
    const m6 = await mutate('switch', "return { enabled: !(raw === 'off' || raw === 'false' || raw === '0') };", "return { enabled: raw === 'on' };");
    ok('M6 KILLED: a switch that is off unless named on', m6.frontSorterDecision({}).enabled === false && FS.frontSorterDecision({}).enabled === true);
    // M7: the follow-up context is dropped
    const m7 = await mutate('followup', 'if (previous && isShortFollowUp(latest)) {', 'if (false) {');
    const thread = [{ role: 'user', content: t1 }, { role: 'assistant', content: 'A' }, { role: 'user', content: FIX.followupLatest[0] }];
    ok('M7 KILLED: without the previous message a short follow-up is shown alone', m7.sorterInput(thread) === FIX.followupLatest[0] && FS.sorterInput(thread) !== FIX.followupLatest[0]);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* nothing to clean */ }
  }

  // ------------------------------------------------------------------------------------------------ the table
  if (tableOut) {
    fs.writeFileSync(tableOut, JSON.stringify({ rows, battery134: b134 }, null, 1), 'utf8');
    say('table written: ' + rows.length + ' rows');
  }
  const counts = {};
  for (const r of rows) { const k = r.set; counts[k] = counts[k] || { n: 0, asked: 0, cue: 0, general: 0 }; counts[k].n += 1; if (r.asked) counts[k].asked += 1; if (r.state === 'ruling_cue') counts[k].cue += 1; if (r.frame === 'general') counts[k].general += 1; }
  say('BATTERY rows=' + rows.length + ' ' + JSON.stringify(counts));
  process.exitCode = finish();
}
function say(s) { console.log(ascii(s)); }

main().catch((e) => { console.log('  FAIL  guard crashed | ' + ascii(String(e && e.stack || e).slice(0, 800))); console.log('SUMMARY front-sorter PASS=0 FAIL=1'); process.exitCode = 1; });
