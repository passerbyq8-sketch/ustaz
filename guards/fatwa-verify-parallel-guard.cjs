'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'lib', 'fatwa-service.js'), 'utf8');
let checks = 0;
let failures = 0;
function ok(name, condition, detail = '') {
  checks++;
  if (condition) console.log('PASS ' + name);
  else {
    failures++;
    console.log('FAIL ' + name + (detail ? ': ' + detail : ''));
  }
}

async function main() {
  const helperExists = SOURCE.includes('async function searchFatwasWithVerification');
  if (!helperExists) {
    ok('verification and search start concurrently; baseline witness: searchFatwas awaits verification before it starts search', false);
    console.log('RESULT 0/' + checks + ' failures=' + failures);
    process.exitCode = 1;
    return;
  }

  const url = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href + '?fatwa-parallel-' + Date.now());
  const [FSVC, CONTRACT] = await Promise.all([url('lib/fatwa-service.js'), url('lib/fatwa-contract.js')]);
  const askSource = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  const warmupStart = askSource.indexOf('startFatwaServiceWarmup({ fetchImpl: globalThis.fetch });');
  const capAccepted = askSource.indexOf('if (!cap.allowed)');
  const translationReturn = askSource.indexOf('if (typeof req.__langTranslateQuestion');
  const handlerStart = askSource.indexOf('export default async function handler(req, res)');
  const firstModelCall = askSource.indexOf('fetch(ANTHROPIC_URL', handlerStart);
  ok('the best-effort Fatwa warmup starts after request caps and translation, before model work',
    SOURCE.includes('export function startFatwaServiceWarmup(options = {})')
      && SOURCE.includes('void verifyFatwaService(options).catch(() => {})')
      && askSource.includes("import { startFatwaServiceWarmup } from '../lib/fatwa-service.js';")
      && askSource.includes('startFatwaServiceWarmup({ fetchImpl: globalThis.fetch });')
      && capAccepted >= 0 && translationReturn > capAccepted
      && warmupStart > translationReturn && warmupStart < firstModelCall);
  const prayer = String.fromCodePoint(0x627, 0x644, 0x635, 0x644, 0x627, 0x629);
  const raw = {
    uid: 'parallel-test',
    id: 'parallel-test',
    scholar: { id: 'binbaz' },
    title: prayer,
    source: { canonicalUrl: 'https://binbaz.org.sa/fatwas/1' },
    content: { type: 'question_answer', question: prayer, answer: 'A published answer about prayer.' },
  };
  const payload = {
    ok: true,
    schemaVersion: CONTRACT.FATWA_SCHEMA,
    results: [raw],
    pagination: { total: 1 },
  };
  let searchStartedAt = null;
  let verifyFinishedAt = null;
  let verifyCalls = 0;
  const fetchImpl = async (input, init = {}) => {
    const target = input instanceof URL ? input : new URL(String(input));
    if (init.method !== 'GET') throw new Error('non-GET request refused');
    if (target.pathname !== '/api/v1/fatwas/search') throw new Error('unexpected request path');
    searchStartedAt = Date.now();
    const body = JSON.stringify(payload);
    return {
      ok: true,
      status: 200,
      url: target.href,
      headers: { get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'application/json; charset=utf-8';
        if (key === 'content-length') return String(Buffer.byteLength(body, 'utf8'));
        return null;
      } },
      text: async () => body,
    };
  };
  const verify = () => {
    verifyCalls += 1;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        verifyFinishedAt = Date.now();
        reject(new Error('fixture verification unavailable'));
      }, 30);
    });
  };
  let result = null;
  let failure = '';
  try {
    result = await FSVC.__fatwaTest.searchFatwasWithVerification({
      currentQuestion: prayer,
      resolvedTopic: prayer,
    }, { fetchImpl }, verify);
  } catch (error) {
    failure = String(error && error.message || error);
  }
  ok('search begins before the verification attempt settles',
    searchStartedAt !== null && verifyFinishedAt !== null && searchStartedAt < verifyFinishedAt);
  ok('one failed verification is surfaced unchanged and admits no candidate rows',
    verifyCalls === 1 && result === null && failure === 'fixture verification unavailable');
  let invalidResult = null;
  let invalidFailure = '';
  try {
    invalidResult = await FSVC.__fatwaTest.searchFatwasWithVerification({
      currentQuestion: prayer,
      resolvedTopic: prayer,
    }, { fetchImpl }, async () => Object.freeze({ status: 'UNVERIFIED' }));
  } catch (error) {
    invalidFailure = String(error && error.message || error);
  }
  ok('a resolved non-OK verification also fails closed before any row is returned',
    invalidResult === null && invalidFailure === 'fatwa_snapshot_mismatch');
  const STORE = require('./fixtures-speed-wasl-fatwas.json');
  const sharedCalls = {};
  const sharedFetch = async (input) => {
    const target = input instanceof URL ? input : new URL(String(input));
    const check = /\/api\/v1\/(health|scholars)$/.exec(target.pathname);
    if (check) sharedCalls[check[1]] = (sharedCalls[check[1]] || 0) + 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const entry = STORE[String(input)];
    if (!entry) return { ok: false, status: 404, url: String(input), headers: { get: () => 'application/json' }, text: async () => '{}' };
    return {
      ok: true,
      status: entry.status,
      url: String(input),
      redirected: false,
      headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? entry.ct : null) },
      text: async () => entry.body,
    };
  };
  const shared = await Promise.all([
    FSVC.verifyFatwaService({ fetchImpl: sharedFetch }),
    FSVC.verifyFatwaService({ fetchImpl: sharedFetch }),
  ]);
  ok('two concurrent cold callers share one health and one scholar verification',
    shared.every((value) => value.status === 'OK') && sharedCalls.health === 1 && sharedCalls.scholars === 1,
    JSON.stringify(sharedCalls));
  console.log('RESULT ' + (checks - failures) + '/' + checks + ' failures=' + failures);
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.log('FATAL ' + String(error && error.message || error));
  process.exitCode = 1;
});
