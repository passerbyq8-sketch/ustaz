#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;

function ok(label, value, detail = '') {
  checks++;
  if (value) {
    console.log('  PASS  ' + label);
    return true;
  }
  failures++;
  console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
  return false;
}

function eq(label, actual, expected) {
  return ok(label, JSON.stringify(actual) === JSON.stringify(expected),
    'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function responseDouble() {
  const res = { statusCode: 200, headers: {}, payload: null, ended: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.setHeader = (name, value) => { res.headers[String(name).toLowerCase()] = value; };
  res.getHeader = (name) => res.headers[String(name).toLowerCase()];
  res.json = (payload) => { res.payload = payload; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

function request(method = 'POST', consent = true) {
  return {
    method,
    headers: consent ? { 'x-ezik-ai-consent': '2026-08-06-1' } : {},
    body: {
      max_tokens: 4096,
      stream: true,
      mode: 'call',
      messages: [{ role: 'user', content: 'religious question sentinel' }],
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function drive(handler, method = 'POST', consent = true) {
  const res = responseDouble();
  await handler(request(method, consent), res);
  return res;
}

function retirementProblems(res, fetchCalls) {
  const out = [];
  if (res.statusCode !== 410) out.push('status');
  if (res.payload?.replacement !== '/api/ask') out.push('replacement');
  if (fetchCalls !== 0) out.push('network');
  return out;
}

function clientConsumerProblems(html) {
  const out = [];
  if (!/const FAST_CHANNEL_ENABLED = false;/.test(html)) out.push('fast-channel-enabled');
  if (!/endpoint = ['"]\/api\/ask['"]/.test(html)) out.push('default-not-ask');
  if (/endpoint\s*=\s*['"]\/api\/chat['"]/.test(html)) out.push('chat-selected');
  const branch = /if \(FAST_CHANNEL_ENABLED && mode === ['"]call['"][\s\S]{0,1600}?endpoint = ['"]\/api\/chat-fast['"];/.test(html);
  if (!branch) out.push('fast-reference-not-dead-gated');
  return out;
}

function sourceAsHandler(source) {
  const executable = source
    .replace(/^import[^\n]+\n/gm, '')
    .replace(/export const RETIRED_CHAT_REPLACEMENT/, 'const RETIRED_CHAT_REPLACEMENT')
    .replace(/export default function handler/, 'function handler')
    + '\nhandler;';
  return vm.runInNewContext(executable, {
    applyCorsOrigin() {},
    AI_CONSENT_ALLOW_HEADERS: 'x-ezik-ai-consent',
    guardAIConsent() { return true; },
  });
}

function walk(dir, prefix = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) found.push(...walk(path.join(dir, entry.name), rel));
    else found.push(rel);
  }
  return found;
}

(async () => {
  console.log('=== retired-chat-endpoints-guard -- dead relays stay closed ===');

  const endpointFiles = ['api/chat.js', 'api/chat-fast.js'];
  const sources = endpointFiles.map(read);
  const modules = await Promise.all(endpointFiles.map((rel) =>
    import(pathToFileURL(path.join(ROOT, rel)).href + '?retired=' + Date.now())));

  let fetchCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls++; throw new Error('retired route used transport'); };
  try {
    for (let i = 0; i < endpointFiles.length; i++) {
      const rel = endpointFiles[i];
      const before = fetchCalls;
      const retired = await drive(modules[i].default);
      eq(rel + ' returns the explicit retired response', retirementProblems(retired, fetchCalls - before), []);

      const denied = await drive(modules[i].default, 'POST', false);
      eq(rel + ' preserves the shared consent refusal before its tombstone', denied.statusCode, 403);

      const options = await drive(modules[i].default, 'OPTIONS', false);
      eq(rel + ' preserves CORS preflight', options.statusCode, 200);

      ok(rel + ' contains no model, retrieval, prompt, or streaming implementation',
        !/anthropic|fetch\s*\(|buildSystemPrompt|getReader\s*\(|search_islamic_sources/i.test(sources[i]));
      ok(rel + ' keeps the shared consent guard',
        /guardAIConsent[^\n]*from ['"]\.\.\/lib\/ai-consent\.js['"]/.test(sources[i]));
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  const html = read('index.html');
  eq('the shipped client has no live chat/chat-fast selection', clientConsumerProblems(html), []);

  const literalCallers = walk(ROOT).filter((rel) =>
    !/^(?:api|guards|tools|docs)\//.test(rel)
      && /\.(?:js|cjs|mjs|html)$/.test(rel)
      && /(?:fetch|aiFetch)\s*\(\s*['"]\/api\/chat(?:-fast)?['"]/.test(read(rel)));
  eq('every repository client reference is explained by the disabled index classifier', literalCallers, ['index.html']);

  const reopenedSource = sources[0].replace('return res.status(410).json({', 'return res.status(200).json({');
  const reopened = sourceAsHandler(reopenedSource);
  const reopenedRes = await drive(reopened);
  ok('MUTANT 1 KILLED: returning success reopens /api/chat and is red',
    retirementProblems(reopenedRes, 0).includes('status'));

  const enabledClient = html.replace('const FAST_CHANNEL_ENABLED = false;', 'const FAST_CHANNEL_ENABLED = true;');
  ok('MUTANT 2 KILLED: enabling the dormant fast client is red',
    clientConsumerProblems(enabledClient).includes('fast-channel-enabled'));

  console.log('\n=== ' + (checks - failures) + '/' + checks
    + (failures ? '  FAIL ===' : '  PASS ==='));
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('retired-chat-endpoints-guard CRASHED: ' + (error && error.stack || error));
  process.exit(1);
});
