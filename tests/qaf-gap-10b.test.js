import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AI_CONSENT_VERSION, AI_CONSENT_HEADER, hasAIConsent } from '../lib/ai-consent.js';
import { RERANK_CONSENT_VERSION, rerankPreflight } from '../lib/rerank/runtime.js';

const app = fs.readFileSync(new URL('../app.jsx', import.meta.url), 'utf8');
const code = app.slice(app.indexOf("const EZ_AI_CONSENT_KEY ="), app.indexOf('// Which POSTs are AI sends.'));
function client(store) {
  const context = vm.createContext({ localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  vm.runInContext(code + '\nthis.state = () => ({valid:hasValidAIConsent(),answered:aiConsentAnswered(),headers:aiConsentHeaders()}); this.write = writeAIConsent;', context);
  return context;
}
test('the pre-Cohere record re-asks once; a current grant survives reload without clearing other local data', () => {
  const store = new Map([['child_profile', JSON.stringify({ pid: 'local-proof' })], ['saved-conversation', 'unchanged'],
    ['ezik_ai_consent_v1', JSON.stringify({ pid: 'local-proof', status: 'granted', version: '2026-08-06-1' })]]);
  const first = client(store);
  assert.equal(first.state().valid, false); assert.equal(first.state().answered, false);
  assert.deepEqual(Object.keys(first.state().headers), []);
  first.write('granted', 'user');
  const reloaded = client(store);
  assert.equal(reloaded.state().valid, true); assert.equal(reloaded.state().answered, true);
  assert.equal(reloaded.state().headers[AI_CONSENT_HEADER], AI_CONSENT_VERSION);
  assert.equal(JSON.parse(store.get('ezik_ai_consent_v1')).version, '2026-11-02-1');
  assert.equal(store.get('saved-conversation'), 'unchanged');
  reloaded.write('declined', 'user');
  assert.equal(client(store).state().answered, true); assert.equal(client(store).state().valid, false);
});
test('server and reranker use the same Cohere disclosure version and reject the preceding one', (t) => {
  const previous = process.env.COHERE_API_KEY, localStubKey = 'local-stub-key';
  process.env.COHERE_API_KEY = localStubKey;
  t.after(() => { if (previous === undefined) delete process.env.COHERE_API_KEY; else process.env.COHERE_API_KEY = previous; });
  assert.equal(AI_CONSENT_VERSION, RERANK_CONSENT_VERSION);
  assert.equal(hasAIConsent({ headers: { [AI_CONSENT_HEADER]: '2026-08-06-1' } }), false);
  assert.equal(hasAIConsent({ headers: { [AI_CONSENT_HEADER]: AI_CONSENT_VERSION } }), true);
  const env = { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' };
  assert.equal(rerankPreflight(env, '2026-08-06-1'), 1);
  assert.equal(rerankPreflight(env, AI_CONSENT_VERSION), null);
});
