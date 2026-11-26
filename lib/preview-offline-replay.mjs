// Runs only during a measurement build on the designated preview branch.
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { providerFetch } from './provider-call.js';
import { judgeBudgetMs, judgeBw2 } from './before-writing-v2.js';

const active = process.env.VERCEL_ENV === 'preview'
  && process.env.VERCEL_GIT_COMMIT_REF === 'side/brainc-20261126';
const packet = active && process.env.EZIK_BRAINC_R2_MEASUREMENT;
if (packet) {
  const jobs = JSON.parse(brotliDecompressSync(Buffer.from(packet, 'base64')));
  const providerUrl = 'https://api.anthropic.com/v1/messages';
  const headers = { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01' };
  const model = process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5';
  for (const job of jobs) {
    if (job.kind === 'excerpt') {
      const result = await judgeBw2({ question: job.question, rows: job.rows, providerUrl, headers });
      const row = result.kept.find(r => r.recordId === job.source);
      const passage = row?.caseExcerpt || '';
      // Read the full archived proof interval, without emitting passages or questions.
      let contains = false;
      for (let i = 0; i + job.anchorLength <= passage.length && !contains; i++) {
        contains = createHash('sha256').update(passage.slice(i, i + job.anchorLength)).digest('hex') === job.anchor;
      }
      console.log('R2MEASURE ' + JSON.stringify({ id: job.id, contains, kept: !!row, chars: passage.length,
        ms: result.ms, outcome: result.outcome }));
      continue;
    }
    const result = { id: job.id, budgetMs: judgeBudgetMs(), status: 0, rawChars: 0 };
    const rows = job.rows.map(row => ({ ...row, judgedText: row.text }));
    const witnessAsk = async ({ model, system, user, maxTokens, signal, retry }) => {
      const started = Date.now();
      result.maxTokens = maxTokens;
      try {
        const reply = await providerFetch(providerUrl, { method: 'POST', headers, signal,
          body: JSON.stringify({ model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }) }, { retry });
        result.status = reply.status;
        if (!reply.ok) { result.failure = reply.providerType; return ''; }
        const body = await reply.json();
        const raw = (body.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
        result.stop = body.stop_reason;
        result.input = body.usage?.input_tokens;
        result.output = body.usage?.output_tokens;
        result.rawChars = raw.length;
        result.firstBrace = raw.indexOf('{');
        result.lastBrace = raw.lastIndexOf('}');
        try { const parsed = JSON.parse(raw.slice(result.firstBrace, result.lastBrace + 1)); result.hasW = !!parsed?.w; }
        catch { result.hasW = false; }
        // Only structure is persisted. Never log the unparsed output or a provider error message.
        return raw;
      } catch { result.aborted = signal.aborted; return ''; }
      finally { result.ms = Date.now() - started; }
    };
    const keep = Object.fromEntries(rows.map((_, i) => [i + 1, 1]));
    const judged = await judgeBw2({ rows, question: job.question, providerUrl, headers, witnessModel: model,
      ask: async () => JSON.stringify({ d: keep }), witnessAsk, retry: true });
    result.count = judged.witnessCount;
    result.judgeMs = judged.ms;
    console.log('R2MEASURE ' + JSON.stringify(result));
  }
}
