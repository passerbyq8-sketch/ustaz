
import { brotliDecompressSync } from 'node:zlib';
import { providerFetch } from './provider-call.js';
import { createHash } from 'node:crypto';
import { fastModel, judgeBudgetMs, parseDecisions } from './before-writing-v2.js';

const fixture = process.env.EZIK_BRAINC_R4_MEASUREMENT;
if (fixture && process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'side/brainc-20261126') {
  const groups = JSON.parse(brotliDecompressSync(Buffer.from(fixture, 'base64')));
  if (groups.length !== 4 || !process.env.ANTHROPIC_API_KEY) throw Error('MEASUREMENT_SETUP');
  for (const g of groups) {
    if (g.hash !== createHash('sha256').update(JSON.stringify(g.body)).digest('hex') ||
        g.body.model !== fastModel() || g.body.max_tokens !== 64 + 12 * g.n) throw Error('MEASUREMENT_INPUT');
  }
  let limited = false;
  for (let repeat = 1; repeat <= 5 && !limited; repeat++) {
    for (const g of groups) {
      const started = Date.now();
      const signal = AbortSignal.timeout(judgeBudgetMs());
      const result = { hash: g.hash, repeat, model: g.body.model, msLimit: judgeBudgetMs(), status: 0, keep: null };
      try {
        const response = await providerFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY },
          body: JSON.stringify(g.body), signal,
        }, {retry:false});
        result.status = response.status;
        if (response.status === 429 || response.status === 402) limited = true;
        const reply = await response.json();
        if (response.ok) {
          result.stop = ['end_turn', 'max_tokens', 'stop_sequence','refusal'].includes(reply.stop_reason) ? reply.stop_reason : 'other';
          result.tokens = reply.usage?.output_tokens;
          const d = parseDecisions(reply.content.filter(x => x.type === 'text').map(x => x.text).join(''), g.n);
          if (d) Object.assign(result, { keep: d.keep, missing: d.missing, direct: d.direct });
        } else {
          limited = [402, 429].includes(response.status) || /billing|credit|usage.limit/u.test(String(reply.error?.type) + ' ' + String(reply.error?.message).toLowerCase());
        }
      } catch {
        result.timeout = signal.aborted;
      }
      result.ms = Date.now() - started;
      result.limited = limited;
      console.log('R4MEASURE ' + JSON.stringify(result));
      if (limited) break;
    }
  }
}
