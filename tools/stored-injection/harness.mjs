// tools/stored-injection/harness.mjs — THE WIRE STUBS, AND NOTHING THAT JUDGES.
//
// Kept apart from gate.mjs on purpose. The gate states conditions; this file only makes it
// possible to run a turn without a network, and every stub here answers the SHAPE the real
// service answers — the fatwa contract's own schema version, its own eighteen scholars, its own
// record fields — because a stub that answers a shape the code does not check proves nothing
// about the code that checks it.

import { createHash } from 'node:crypto';
import {
  FATWA_BASE, FATWA_SCHEMA, FATWA_SCHOLARS,
} from '../../lib/fatwa-contract.js';

export const PROVIDER_URL = 'https://provider.invalid/v1/messages';

export const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

/** The scholars payload the verifier demands: every id, with its pinned record count. */
function scholarsPayload() {
  return {
    ok: true,
    schemaVersion: FATWA_SCHEMA,
    scholars: FATWA_SCHOLARS.map((entry) => ({ id: entry.id, snapshot: { records: entry.count } })),
  };
}

/**
 * One record in the shape lib/fatwa-service.js's normalizeRecord accepts.
 * `host` defaults to the roster's own domain for that scholar, because a record on any other
 * host is refused before relevance is even asked — which is a different gate than the one under
 * test here.
 */
export function serviceRecord({ scholarId, id, title, question, answer, path }) {
  const scholar = FATWA_SCHOLARS.find((entry) => entry.id === scholarId);
  if (!scholar) throw new Error(`unknown scholar in fixture: ${scholarId}`);
  return {
    uid: `${scholarId}:${id}`,
    id,
    scholar: { id: scholarId, name: scholar.name },
    title,
    source: { canonicalUrl: `https://${scholar.sourceDomain}${path || `/fatwas/${id}`}` },
    content: { type: 'question_answer', question, answer },
  };
}

/**
 * Install a fetch that answers the fatwa service and the provider, and records every provider
 * request body verbatim.
 *
 * @param {object} opts
 * @param {Array}  opts.records   what /api/v1/fatwas/search returns, before any admission gate
 * @param {Array}  opts.script    one provider payload per model call, last one repeats
 * @returns {{restore:Function, providerBodies:Array<string>, fetchImpl:Function}}
 */
export function installWire({ records = [], script = [] }) {
  const providerBodies = [];
  const original = globalThis.fetch;

  const json = (payload) => ({
    ok: true,
    status: 200,
    url: '',
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  });

  const impl = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : String(input?.href || input?.url || input);
    if (href.startsWith(FATWA_BASE)) {
      const url = new URL(href);
      const payload = url.pathname === '/api/v1/health'
        ? { ok: true, schemaVersion: FATWA_SCHEMA, scholars: FATWA_SCHOLARS.map((e) => ({ id: e.id })) }
        : url.pathname === '/api/v1/scholars'
          ? scholarsPayload()
          : { ok: true, schemaVersion: FATWA_SCHEMA, results: records, pagination: { total: records.length } };
      const out = json(payload);
      out.url = href;
      return out;
    }
    if (href.startsWith(PROVIDER_URL)) {
      providerBodies.push(String(init.body));
      const at = Math.min(providerBodies.length - 1, script.length - 1);
      const payload = script[at] || { content: [], stop_reason: 'end_turn' };
      const out = json(payload);
      out.url = href;
      return out;
    }
    throw new Error(`unstubbed fetch: ${href}`);
  };

  globalThis.fetch = impl;
  return {
    providerBodies,
    fetchImpl: impl,
    restore() { globalThis.fetch = original; },
  };
}

/**
 * A provider payload in which the model ASKS for the fatwa corpus itself.
 *
 * This is what makes the parity condition possible: the same row, the same sentence and the same
 * citation, reached once because the model requested it and once because S1 offered it.
 */
export function askFor(query) {
  return {
    content: [{ type: 'tool_use', id: 'toolu_test_1', name: 'search_fatawa', input: { query } }],
    stop_reason: 'tool_use',
    usage: { output_tokens: 32 },
  };
}

/** A provider payload carrying one text block and a clean finish. */
export function say(text) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { output_tokens: 64 },
  };
}

/** The options every case shares, so a difference between two runs is never the harness. */
export function baseOptions({ question, storedRuntime, lexicalRoute, mode, fetchImpl }) {
  return {
    messages: [{ role: 'user', content: question }],
    system: 'SYSTEM PROMPT UNDER TEST',
    model: 'model-under-test',
    maxTokens: 2048,
    usePremium: false,
    effort: '',
    band: 'adult',
    mode,
    lexicalRoute,
    storedRuntime,
    providerUrl: PROVIDER_URL,
    headers: { 'content-type': 'application/json' },
    signal: undefined,
    dailyBudget: null,
    fetchImpl,
  };
}
