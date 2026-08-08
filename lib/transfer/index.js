// lib/transfer/index.js — THE ONE DECISION: MOVE THE PUBLISHED ANSWER, OR GENERATE ONE.
//
// ── THE ORDER OF THE CHECKS IS THE DESIGN ────────────────────────────────────
//   1. can this page even be read?     (lib/transfer/extract.js — per-domain, video excluded)
//   2. is it the same question?        (lib/transfer/match.js — similarity AND the flip veto)
//   3. if unsure, ask the one judge    (a single yes/no, and any doubt refuses)
//   4. only then, move the text        (lib/transfer/trim.js — structural, no model)
//
// Every step can only ever REFUSE. There is no branch here that turns a "no" into a "yes", which
// is what makes the whole path safe to add to a request that already works: the worst outcome is
// that the ordinary sourced answer runs, exactly as it did before this file existed.
//
// ── THE JUDGE IS INJECTED ────────────────────────────────────────────────────
// `judge` is a parameter, so guards drive every branch with a mock and no gate ever calls a model
// (درسُ rfcwiring). A caller that has no judge to offer gets NO transfer on the judge band rather
// than a transfer on trust.

import { compareQuestions, buildJudgePrompt, judgeAllowsTransfer, TRANSFER } from './match.js';
import { extractPair } from './extract.js';
import { prepareTransfer } from './trim.js';

export { TRANSFER } from './match.js';

/**
 * Decide whether a fetched page's published answer may be transferred for this reader.
 *
 * @param {string} readerQuestion
 * @param {{url:string, html:string}} page
 * @param {{judge?:Function, maxChars?:number}} deps
 *   judge(prompt) -> Promise<string>   the fast model's one-word reply. Counted by the caller.
 * @returns {Promise<{transfer:boolean, reason:string, score:number, flips:string[],
 *                    text?:string, question?:string, domain?:string, url?:string,
 *                    judged?:boolean, truncated?:boolean, openingStripped?:boolean}>}
 */
export async function considerTransfer(readerQuestion, page, deps = {}) {
  if (!readerQuestion || !page || !page.url || !page.html) {
    return { transfer: false, reason: 'no-page', score: 0, flips: [] };
  }
  const pair = extractPair(page.url, page.html);
  if (!pair) return { transfer: false, reason: 'page-not-readable', score: 0, flips: [] };
  return considerTransferPair(readerQuestion, { url: page.url, published: pair }, deps);
}

/**
 * The same decision, given a pair that has ALREADY been extracted.
 *
 * lib/retrieve.js extracts it while the HTML is still in hand and carries it on the candidate, so
 * the request path never re-parses a page it has already parsed once. This is the entry point
 * api/ask.js uses; considerTransfer above is the one a caller with raw HTML uses.
 */
export async function considerTransferPair(readerQuestion, page, deps = {}) {
  const { judge = null, maxChars = 2400 } = deps;
  const no = (reason, extra) => ({ transfer: false, reason, score: 0, flips: [], ...(extra || {}) });

  if (!readerQuestion || !page || !page.url) return no('no-page');
  const pair = page.published;
  if (!pair || !pair.question || !pair.answer) return no('page-not-readable');

  const cmp = compareQuestions(readerQuestion, pair.question);
  const base = {
    score: cmp.score, flips: cmp.flips, question: pair.question,
    domain: pair.domain || "", url: page.url,
  };

  if (cmp.verdict === TRANSFER.NO) {
    return { transfer: false, reason: cmp.reason, ...base };
  }

  let judged = false;
  if (cmp.verdict === TRANSFER.JUDGE) {
    // NO JUDGE, NO TRANSFER. A caller without one has not established the two questions are the
    // same; it has only failed to ask.
    if (typeof judge !== 'function') {
      return { transfer: false, reason: 'judge-band-with-no-judge', judged: false, ...base };
    }
    judged = true;
    let reply = '';
    try {
      reply = await judge(buildJudgePrompt(readerQuestion, pair.question));
    } catch (e) {
      // A JUDGE THAT THREW HAS NOT SAID NO. Fail closed, and say which way it failed.
      return { transfer: false, reason: 'judge-unavailable', judged, ...base };
    }
    if (!judgeAllowsTransfer(reply)) {
      return { transfer: false, reason: 'judge-refused', judged, ...base };
    }
  }

  const prepared = prepareTransfer(pair.answer, { maxChars });
  if (!prepared.text) return { transfer: false, reason: 'nothing-left-after-trim', judged, ...base };

  return {
    transfer: true,
    reason: judged ? 'judge-allowed' : cmp.reason,
    judged,
    text: prepared.text,
    truncated: prepared.truncated,
    openingStripped: prepared.openingStripped,
    ...base,
  };
}
