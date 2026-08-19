#!/usr/bin/env node
/**
 * P6-V3 §١.٣ — DOES THE 160-RECORD CORPUS EVER ENTER THE TOOLS-REMOVED WRITE?
 *
 * The equivalence battery's claim is «flag off is byte-identical». Its REACH is a
 * separate fact, and it is measured here rather than argued: every record is replayed
 * as one provider object, and a TRIPWIRE object is queued behind it. A turn that never
 * reaches the tools-removed write never asks for a second object, so the tripwire is
 * never consumed. The count of consumed tripwires is the number of corpus records that
 * exercise the fallback path.
 *
 * Reported as a number so «the corpus does not cover it» is a measurement and not a
 * reading of the source.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');
const PROVIDER = 'https://provider.test/messages';

function absoluteImports(source) {
  const base = path.dirname(LOOP);
  return source.replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/gu, (whole, quote, spec) => {
    const href = pathToFileURL(path.resolve(base, spec)).href;
    return `from ${quote}${href}${quote}`;
  });
}

async function importSource(source, label) {
  const code = absoluteImports(source);
  const href = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${label}`;
  return import(href);
}

function jsonPayload(text, stop = 'end_turn') {
  return {
    id: 'reach-message', type: 'message', role: 'assistant',
    content: text == null ? [] : [{ type: 'text', text }],
    stop_reason: stop,
    usage: {
      input_tokens: 101, output_tokens: 37,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    },
  };
}

async function quiet(action) {
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await action(); } finally { Object.assign(console, saved); }
}

function options() {
  return {
    messages: [{ role: 'user', content: 'اختبار بنيوي محلي.' }],
    system: 'اختبار بنيوي محلي.',
    model: 'proof-model', maxTokens: 512, usePremium: false, effort: '',
    band: 'adult', mode: 'standard', lexicalRoute: 'GEN',
    providerUrl: PROVIDER, headers: {}, signal: undefined, dailyBudget: null,
    env: { STREAM_V1: 'off' },
  };
}

async function main() {
  const corpusPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!corpusPath) throw new Error('usage: corpus-reaches-fallback.cjs <corpus.json>');
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const live = await importSource(fs.readFileSync(LOOP, 'utf8'), 'reach-live');

  let tripwires = 0;
  let turns = 0;
  const original = global.fetch;
  await quiet(async () => {
    for (const record of corpus) {
      const queue = [
        { payload: jsonPayload(record.text) },
        { tripwire: true, payload: jsonPayload('نص لا ينبغي أن يُطلَب.') },
      ];
      global.fetch = async (input) => {
        if (String(input) !== PROVIDER) return new Response('offline', { status: 503 });
        const item = queue.shift();
        if (!item) throw new Error('plan exhausted');
        if (item.tripwire) tripwires += 1;
        return new Response(JSON.stringify(item.payload), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      };
      try {
        await live.runFreeBrainTurn(options());
        turns += 1;
      } catch { /* a record that cannot run is still not a record that reached the write */ }
    }
  });
  global.fetch = original;

  process.stdout.write(`CORPUS_RECORDS=${corpus.length} TURNS_RUN=${turns} `
    + `RECORDS_REACHING_TOOLS_REMOVED_WRITE=${tripwires}\n`);
  process.stdout.write(`CORPUS_COVERS_FALLBACK_PATH=${tripwires > 0 ? 'YES' : 'NO'}\n`);
}

main().catch((error) => {
  process.stderr.write(`CORPUS-REACH: ERROR ${(error && error.stack) || error}\n`);
  process.exit(2);
});
