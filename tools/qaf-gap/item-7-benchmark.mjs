// Offline candidate preparation and explicit-provider measurement. No production wiring.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { normalizeArabic } from '../../lib/route-classify.js';
import { libraryQuery } from '../../lib/before-writing-v2.js';
import { createReranker } from '../../lib/rerank/index.js';

export function lexicalScore(question, row) {
  const terms = [...new Set(normalizeArabic(libraryQuery(question)).split(' ').filter((t) => t.length >= 3))];
  const title = normalizeArabic(row.title), body = row.foldedSearch || normalizeArabic(row.search || row.text);
  return terms.reduce((score, term) => score + (title.includes(term) ? 5 : 0) + (body.includes(term) ? 1 : 0), 0);
}
export function precisionAt10(rows, ranking = rows.map((r) => ({ id: r.id }))) {
  const top = ranking.slice(0, 10).map((r) => rows.find((row) => row.id === r.id));
  if (top.some((r) => !r || !['R', 'P', 'X'].includes(r.label))) return null;
  return top.filter((r) => r.label === 'R').length / 10;
}
const median = (values) => { const v = values.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null; };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const session = process.argv[2];
  if (!session) throw new Error('Pass saved live-session path');
  const network = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    if (String(url) !== 'https://api.anthropic.com/v1/messages') throw new Error('NETWORK_FORBIDDEN');
    return network(url, init);
  };
  const cache = 'node_modules/.cache/qaf-gap';
  const indexBytes = fs.readFileSync('lib/data/fiqh-search.json.gz');
  const index = JSON.parse(gunzipSync(indexBytes));
  const saved = JSON.parse(fs.readFileSync(cache + '/item-1a-proof.json', 'utf8')).saved;
  const labelsPath = new URL('./item-7-labels.json', import.meta.url);
  const labels = fs.existsSync(labelsPath) ? JSON.parse(fs.readFileSync(labelsPath, 'utf8')) : {};
  const questions = saved.map(({ id, question }) => {
    const ezik = JSON.parse(fs.readFileSync(path.join(session, 'retrieval', id + '-ezik.json'), 'utf8')).cards;
    const qaf = JSON.parse(fs.readFileSync(path.join(session, 'retrieval', id + '-qaf.json'), 'utf8')).results;
    const archived = [
      ...ezik.map((r) => ({ id: 'ezik:' + r.id, title: r.title, text: r.text || r.title, label: r.label, reason: r.reason, source: 'saved-ezik' })),
      ...qaf.map((r) => ({ id: 'qaf:' + id + ':' + r.id, title: r.book_name, text: [r.text, r.footnotes].filter(Boolean).join('\n'),
        label: r.label, reason: r.reason, source: 'saved-qaf' })),
    ].filter((r, i, all) => all.findIndex((a) => a.id === r.id) === i);
    const local = index.filter((r) => r.snippet?.trim()).map((r) => ({ id: 'encyc:' + r.id, title: r.term, text: r.snippet, foldedSearch: r.search, source: 'local-encyclopedia',
      label: labels[id]?.[r.id]?.label || null, reason: labels[id]?.[r.id]?.reason || null }))
      .map((r) => ({ ...r, lexicalScore: lexicalScore(question, r) })).filter((r) => r.lexicalScore > 0)
      .sort((a, b) => b.lexicalScore - a.lexicalScore || a.id.localeCompare(b.id)).slice(0, Math.max(0, 50 - archived.length))
      .map(({ foldedSearch, ...r }) => r);
    const candidates = [...archived, ...local].map((r) => ({ ...r, lexicalScore: r.lexicalScore ?? lexicalScore(question, r) }))
      .sort((a, b) => b.lexicalScore - a.lexicalScore || a.id.localeCompare(b.id)).slice(0, 50);
    return { id, question, candidates, lexicalPrecisionAt10: precisionAt10(candidates) };
  });
  const candidatesFile = cache + '/item-7-candidates.json';
  fs.writeFileSync(candidatesFile, JSON.stringify({ indexRecords: index.length, indexSha256: createHash('sha256').update(indexBytes).digest('hex'),
    unavailableSources: { expandedFatwa: 'NOT_PROVABLE_LOCALLY', expandedLibrary: 'NOT_PROVABLE_LOCALLY' }, questions }, null, 2) + '\n', 'utf8');
  if (process.argv.includes('--prepare')) {
    console.log(JSON.stringify(questions.map((q) => ({ id: q.id, question: q.question,
      local: q.candidates.filter((r) => r.source === 'local-encyclopedia').map((r) => ({ id: r.id, title: r.title, score: r.lexicalScore })) })), null, 2));
  } else {
    const req = createRequire(path.resolve(cache + '/onnx-runtime/package.json'));
    const providers = [
      ['local-onnx', createReranker({ provider: 'local-onnx', modelPath: process.env.RERANK_ONNX_MODEL,
        loadRuntime: () => import(pathToFileURL(req.resolve('@huggingface/transformers')).href) })],
      ['anthropic-pointwise', createReranker({ provider: 'anthropic-pointwise' })],
    ];
    const results = [];
    for (const [provider, run] of providers) {
      const rows = [];
      for (const q of questions) {
        const started = performance.now();
        try {
          const ranking = await run(q.question, q.candidates, { topK: q.candidates.length });
          rows.push({ id: q.id, ms: performance.now() - started, precisionAt10: precisionAt10(q.candidates, ranking), ranking });
        } catch (error) { rows.push({ id: q.id, failureMs: performance.now() - started, ms: null, error: String(error.message).slice(0, 300), precisionAt10: null, ranking: null }); }
        console.log('RERANK_MEASURE ' + JSON.stringify({ provider, ...rows.at(-1), ranking: undefined }));
      }
      results.push({ provider, rows, medianPrecisionAt10: median(rows.map((r) => r.precisionAt10)), medianMs: median(rows.map((r) => r.ms)) });
    }
    const unlabeled = questions.flatMap((q) => q.candidates.filter((r) => !['R', 'P', 'X'].includes(r.label)).map((r) => q.id + ':' + r.id));
    const knownX = ['ezik:b3#4', 'ezik:b3#5', 'ezik:c1#3'];
    // A threshold is selected only after successful complete scores and owner-reviewable labels.
    const ready = !unlabeled.length && results.every((r) => r.rows.every((q) => q.ranking));
    const thresholds = results.map((result) => {
      if (unlabeled.length || result.rows.some((q) => !q.ranking)) return { provider: result.provider, threshold: null };
      const scored = result.rows.flatMap((q) => q.ranking.map((r) => ({ ...r, label: questions.find((a) => a.id === q.id).candidates.find((a) => a.id === r.id).label })));
      const negatives = scored.filter((r) => r.label === 'X');
      const threshold = negatives.length ? Math.max(...negatives.map((r) => r.score)) : null;
      const above = threshold === null ? [] : scored.filter((r) => r.score > threshold);
      return { provider: result.provider, threshold, rule: 'Strictly greater than highest scored X in this measurement pool',
        xAbove: above.filter((r) => r.label === 'X').length, cardsAbove: above.length,
        relevantAbove: above.filter((r) => r.label === 'R').length,
        knownX: knownX.map((id) => ({ id, score: scored.find((r) => r.id === id)?.score ?? null, suppressed: scored.some((r) => r.id === id && r.score <= threshold) })) };
    });
    const improved = results.every((r) => r.medianPrecisionAt10 > median(questions.map((q) => q.lexicalPrecisionAt10)));
    const passed = ready && improved && thresholds.every((t) => t.relevantAbove > 0 && t.knownX?.every((x) => x.suppressed));
    const proof = { passed, readyForThresholdAnalysis: ready, thresholds, knownX, unlabeled,
      lexicalMedianPrecisionAt10: median(questions.map((q) => q.lexicalPrecisionAt10)),
      lexical: questions.map((q) => ({ id: q.id, n: q.candidates.length, precisionAt10: q.lexicalPrecisionAt10 })),
      results, limitation: 'Expanded fatwa/library server indexes unavailable locally; local encyclopedia plus saved labeled retrieval passages only. R/P/X are provisional agent labels. No production provider, threshold or wiring selected.' };
    fs.writeFileSync(cache + '/item-7-proof.json', JSON.stringify(proof, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(proof, null, 2));
    process.exitCode = proof.passed ? 0 : 1;
  }
}
