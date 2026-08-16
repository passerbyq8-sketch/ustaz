// guards/replaced-law-lib.cjs — shared mechanics for the §٤ flips.
//
// WHAT §٤ IS. Branch ب's pre-edit inventory named the fixtures that pin the law the output
// reviewer REPLACES, and left them alone because branch أ's answer layer had not adopted the
// contract yet. It has. Six guards therefore carry an assertion that is still true of the LEGACY
// path — which is frozen and stays frozen — and false of the path the reviewer now governs.
//
// THE TWO REPLACED LAWS, AS BRANCH ب STATED THEM:
//
//   L1  «غياب النص الباقي ⇒ رفض»  — nothing survives means refuse.
//       Replaced by: nothing survives means the LAST RUNG, an explicit non-empty sentence. A
//       ruling with no source in hand is DELIVERED under 【فهمٌ لا فتوى】; an attribution with no
//       source in hand keeps its claim under 【فهمٌ لا نصٌّ منقول】. The reader is never handed a
//       blank, and never handed a refusal that pretends the answer did not exist.
//
//   L2  «كل مسترجع يستحق بطاقة»   — every used record must carry a reader-visible card.
//       Replaced by: THE CARD FOLLOWS THE CITATION. A cited row with no page — the Kuwaiti fiqh
//       encyclopedia has none — is used and uncarded, and that is correct, because what makes the
//       sentence honest on this path is the reviewer, not the card.
//
// EACH FLIP IS EXECUTED, NOT SCANNED. Every section below drives the real loop or the real
// reviewer and reads the real output. A source-text scan cannot tell a law that was replaced from
// a law that was deleted, and this round is about the difference.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');

const fresh = (file, label) => import(pathToFileURL(file).href
  + '?' + encodeURIComponent(label) + '=' + Date.now() + '-' + Math.random());

// A file copied into os.tmpdir() cannot resolve './tools.js'. Relative specifiers are rewritten to
// absolute file URLs pointing back at the real tree, so only the mutated file moves.
function importsFromTree(source, originalFile) {
  return source.replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu, (_all, quote, specifier) => {
    const target = path.resolve(path.dirname(originalFile), specifier);
    return quote + pathToFileURL(target).href + quote;
  });
}

const PROVIDER = 'https://stub.invalid/v1/messages';
const textPayload = (text) => ({ stop_reason: 'end_turn', content: text ? [{ type: 'text', text }] : [] });
const searchPayload = (query) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'flip-1', name: 'search_sources', input: { query } }],
});

/**
 * Drive the REAL free-brain turn: the real loop, the real tool layer, the real reviewer.
 *
 * NO TEST SEAM IN PRODUCTION CODE. Evidence is not injected — when `search` is given, the scripted
 * model actually calls `search_sources`, which runs `searchStoredCorpus` over the Kuwaiti fiqh
 * encyclopedia in-process. Those rows are the real thing and they are the shape §٤/L2 needs: a
 * genuine, quotable, CITABLE record that has NO page and therefore can never carry a card. Only
 * the provider is stubbed, keyed on its own URL; every other host throws, so nothing here reaches
 * the network.
 *
 * @param {object} spec
 * @param {string} spec.answer  what the model writes, citation markers included
 * @param {string} [spec.search] a query to run first, so the answer has real rows to cite
 * @param {string} [spec.route]  the lexical route reported to the reviewer
 * @param {object} spec.module   the loop module to drive (the real one, or a mutant twin)
 */
async function driveFreeTurn({ answer, search = '', route = 'DEEN', module: loopModule }) {
  const realFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async (input) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://stub.invalid/')) throw new Error('offline: ' + url);
    const step = call++;
    const payload = search && step === 0 ? searchPayload(search) : textPayload(answer);
    return { ok: true, status: 200, json: async () => payload };
  };
  try {
    return await loopModule.runFreeBrainTurn({
      messages: [{ role: 'user', content: 'سؤال' }],
      system: 'أنت أستاذ.', model: 'stub', maxTokens: 1024,
      mode: 'عادي', lexicalRoute: route, providerUrl: PROVIDER, headers: {},
    });
  } finally {
    globalThis.fetch = realFetch;
  }
}

/**
 * The card rule of the free path, copied from api/ask.js: a card exists for a cited row only when
 * that row has a URL. Kept here so the §٤/L2 flip measures the rule the handler applies rather
 * than a paraphrase of it.
 */
const freePathCards = (cited) => cited.filter((row) => row.url);

/** Mutate one module, import the twin, and report whether `check` still holds for it. */
async function mutate({ file, name, transform, check }) {
  const original = fs.readFileSync(file, 'utf8');
  const changed = transform(original);
  if (changed === original) return { changed: false, loaded: false, survived: null, error: 'seam moved' };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-replaced-law-'));
  const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
  fs.writeFileSync(twin, importsFromTree(changed, file), 'utf8');
  try {
    const twinModule = await fresh(twin, name);
    return { changed: true, loaded: true, survived: Boolean(await check(twinModule)), error: null };
  } catch (error) {
    return { changed: true, loaded: false, survived: null, error: error?.stack || String(error) };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Report a flip and its mutant with three lines, so a red gate says which of the three failed:
 * the law did not flip · the mutant did not apply · the mutant survived.
 */
function reportFlip(ok, label, flipped, detail, mutant) {
  ok('FLIPPED — ' + label, flipped, detail);
  ok('  mutant restoring the old law applies', mutant.changed, mutant.error);
  ok('  mutant twin loads', mutant.loaded, mutant.error);
  ok('  MUTANT KILLED — the old law cannot come back', mutant.loaded && mutant.survived === false,
    JSON.stringify(mutant));
}

module.exports = {
  ROOT, LOOP, REVIEWER, fresh, importsFromTree, driveFreeTurn, freePathCards, mutate, reportFlip,
};
