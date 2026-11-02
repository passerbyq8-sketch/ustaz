import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createReranker } from '../../lib/rerank/index.js';
const [modelPath, output] = process.argv.slice(2);
if (!modelPath || !output) throw new Error('Pass local model path and proof output path');
globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN'); };
const req = createRequire(path.resolve('node_modules/.cache/qaf-gap/onnx-runtime/package.json'));
const loadRuntime = () => import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
const started = performance.now();
let result;
try {
  const rerank = createReranker({ provider: 'local-onnx', modelPath, loadRuntime, env: { RERANK_ONNX_DTYPE: process.env.RERANK_ONNX_DTYPE || 'q8' } });
  const scores = await rerank('How to perform ablution?', [{ id: 'smoke', title: 'Ablution', text: 'Wash the face and hands when performing ablution.' }]);
  result = { modelPath, loaded: true, scores, ms: performance.now() - started };
} catch (error) {
  result = { modelPath, loaded: false, error: String(error.message).slice(0, 500), ms: performance.now() - started };
}
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result));
process.exitCode = result.loaded ? 0 : 1;
