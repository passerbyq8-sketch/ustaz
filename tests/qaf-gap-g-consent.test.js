import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { guardAIConsent, AI_CONSENT_HEADER, AI_CONSENT_VERSION } from '../lib/ai-consent.js';
import { turn } from '../tools/qaf-gap/turn-harness.mjs';

test('loopback server passes the prior grant to BW2 and answers with fallback 1, without Cohere', async (t) => {
  let providerCalls = 0, answered = 0;
  const baseline = await turn();
  const server = http.createServer(async (req, res) => {
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    if (!guardAIConsent(req, res)) return;
    const result = await turn({ env: { RERANK_V1: 'on', COHERE_NO_TRAINING_CONFIRMED: 'true' },
      extra: { aiConsentVersion: req.headers[AI_CONSENT_HEADER] },
      extraDeps: { rerankFetch: () => { providerCalls++; throw Error('provider forbidden'); } } });
    answered++;
    res.json({ answer: result.sent, telemetry: result.out.telemetry });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const url = 'http://127.0.0.1:' + server.address().port;
  const previous = await fetch(url, { method: 'POST', headers: { [AI_CONSENT_HEADER]: '2026-08-06-1' } });
  assert.equal(previous.status, 200);
  const body = await previous.json();
  assert.ok(body.answer.length > 0); assert.equal(body.answer, baseline.sent);
  assert.equal(body.telemetry.rerank_fallback_code, 1); assert.equal(body.telemetry.rerank_used, 0);
  for (const value of [null, 'declined', '2026-01-01-1', 'malformed', JSON.stringify({ status: 'granted', version: AI_CONSENT_VERSION })]) {
    const response = await fetch(url, { method: 'POST', headers: value === null ? {} : { [AI_CONSENT_HEADER]: value } });
    assert.equal(response.status, 403); assert.equal((await response.json()).error, 'ai-consent-required');
  }
  assert.equal(answered, 1); assert.equal(providerCalls, 0);
});
