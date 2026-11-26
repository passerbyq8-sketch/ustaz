import { brotliDecompressSync } from 'node:zlib';
import { readUnitSource } from './unit-source-reader.js';

if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'side/brainc-20261126' &&
    process.env.EZIK_BRAINC_R2_MEASUREMENT) {
  const { rows, cases } = JSON.parse(brotliDecompressSync(Buffer.from(process.env.EZIK_BRAINC_R2_MEASUREMENT, 'base64')));
  const models = [...new Set([process.env.BW_FAST_MODEL || 'claude-haiku-4-5',
    process.env.MODEL_STANDARD || process.env.MODEL || 'claude-sonnet-5', process.env.MODEL_PREMIUM || process.env.MODEL || 'claude-opus-5'])];
  const providerUrl = 'https://api.anthropic.com/v1/messages';
  const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY };
  const jobs = cases.flatMap((item, i) => models.map(model => ({ item, i, model })));
  let limit = false, index = 0;
  async function worker() {
    while (!limit && index < jobs.length) {
      const { item, i, model } = jobs[index++];
      const cited = item.rows.map(([ref, k]) => ({ ref, ...rows[k] }));
      const result = await readUnitSource({ unit: item.text, rows: cited, model, providerUrl, headers });
      if (result.status === 429 || result.status === 402 || /billing|credit|usage_limit/.test(result.type || '')) limit = true;
      console.log('R2MEASURE ' + JSON.stringify({ i, model, ...result, limited: limit }));
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
}
