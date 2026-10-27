'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../hanna-laha/assets/iap-bridge-v1.js'), 'utf8');
const ast = parser.parse(source, { sourceType: 'script' });
const declarations = new Map();
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id) declarations.set(node.id.name, node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'tokens' || key === 'comments') continue;
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
  }
}
walk(ast);

function sourceOf(name) {
  const node = declarations.get(name);
  assert(node, `missing ${name}`);
  return source.slice(node.start, node.end);
}

function makeHomeEntry({ userAgent, platform = '', maxTouchPoints = 0, bridge = false, session = 'signed-in' }) {
  const updates = [];
  let modeLookups = 0;
  const window = { ReactNativeWebView: bridge ? { postMessage() {} } : null };
  const navigator = { userAgent, platform, maxTouchPoints };
  const authSession = () => session;
  const getEnforcementMode = async () => {
    modeLookups++;
    throw new Error('public mode unavailable');
  };
  const factory = new Function('window', 'navigator', 'authSession', 'getEnforcementMode',
    `${sourceOf('hasNativeIosPurchaseBridge')}\n${sourceOf('enterKunuzHome')}\nreturn enterKunuzHome;`);
  const enter = factory(window, navigator, authSession, getEnforcementMode);
  return {
    updates,
    get modeLookups() { return modeLookups; },
    run: () => enter((notice, applicable) => updates.push({ notice, applicable })),
  };
}

async function verify(label, setup, expectedApplicable, expectedModeLookups) {
  const scenario = makeHomeEntry(setup);
  await scenario.run();
  assert.deepStrictEqual(scenario.updates, [{ notice: null, applicable: expectedApplicable }], label);
  assert.strictEqual(scenario.modeLookups, expectedModeLookups, `${label}: rollout lookup count`);
}

(async () => {
  await verify('iOS native bridge and signed-in account', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true,
  }, true, 0);
  await verify('iOS without native bridge keeps existing fallback', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: false,
  }, false, 1);
  await verify('Android native bridge keeps existing fallback', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true,
  }, false, 1);
  await verify('web keeps existing fallback', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', bridge: false,
  }, false, 1);
  await verify('signed-out iOS native shell keeps existing fallback', {
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', bridge: true, session: null,
  }, false, 1);
  process.stdout.write('PASS iap-ios-purchase-visibility.test.js (5 scenarios)\n');
})().catch(error => {
  process.stderr.write(`FAIL iap-ios-purchase-visibility.test.js: ${error.message}\n`);
  process.exitCode = 1;
});
