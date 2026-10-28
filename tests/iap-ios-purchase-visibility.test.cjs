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
  assert(node, 'missing ' + name);
  return source.slice(node.start, node.end);
}

function makeHomeEntry({ userAgent, platform = '', maxTouchPoints = 0, bridge = false, iapHandler = false, session = 'signed-in', modeError = true, mode = 'all' }) {
  const updates = [];
  let modeLookups = 0;
  let probeCalls = 0;
  const window = { ReactNativeWebView: bridge ? { postMessage() {} } : null, addEventListener() {}, removeEventListener() {} };
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const navigator = { userAgent, platform, maxTouchPoints };
  const authSession = () => session;
  const getEnforcementMode = async () => {
    modeLookups++;
    if (modeError) throw new Error('public mode unavailable');
    return mode;
  };
  const requestShell = async (type, payload, timeout) => {
    probeCalls++;
    assert.strictEqual(type, 'iap.prices');
    assert.deepStrictEqual(payload.productIds, ['ezik_pass_week_1', 'ezik_pass_month_1', 'ezik_pass_year_1']);
    assert.strictEqual(timeout, 8000);
    if (!iapHandler) throw new Error('bridge-timeout');
    return { v: 1, type: 'iap.prices.result', id: 'probe', ok: false };
  };
  const factorySource = [
    sourceOf('isIosWebViewWithMessaging'),
    sourceOf('hasNativeIosPurchaseBridge'),
    sourceOf('enterKunuzHome'),
    'return enterKunuzHome;'
  ].join(String.fromCharCode(10));
  const factory = new Function('window', 'document', 'navigator', 'authSession', 'getEnforcementMode', 'requestShell', 'homeSignInCleanup', factorySource);
  const enter = factory(window, document, navigator, authSession, getEnforcementMode, requestShell, null);
  return {
    updates,
    get modeLookups() { return modeLookups; },
    get probeCalls() { return probeCalls; },
    run: () => enter((notice, applicable) => updates.push({ notice, applicable })),
  };
}

async function verify(label, setup, expectedApplicable, expectedModeLookups, expectedProbeCalls, expectedNotice = null) {
  const scenario = makeHomeEntry(setup);
  await scenario.run();
  assert.ok(scenario.updates.length > 0, label + ': home update');
  assert.equal(scenario.updates.at(-1).notice?.kind || null, expectedNotice, label + ': final notice');
  assert.equal(scenario.updates.at(-1).applicable, expectedApplicable, label + ': purchase entry');
  assert.strictEqual(scenario.modeLookups, expectedModeLookups, label + ': rollout lookup count');
  assert.strictEqual(scenario.probeCalls, expectedProbeCalls, label + ': bridge probe count');
}

(async () => {
  await verify('iOS IAP bridge handshake and signed-in account', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
  }, true, 0, 1);
  await verify('iOS generic WebView without IAP handler keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: false, modeError: false, mode: 'all',
  }, false, 1, 1);
  await verify('iOS without WebView bridge keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: false, modeError: false, mode: 'all',
  }, false, 1, 0);
  await verify('Android IAP handler keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true, iapHandler: true, modeError: false, mode: 'all',
  }, false, 1, 0);
  await verify('web keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', bridge: false, modeError: false, mode: 'all',
  }, false, 1, 0);
  await verify('signed-out iOS native shell keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, session: null, modeError: false, mode: 'all',
  }, false, 1, 0, 'sign-in');
  process.stdout.write('PASS iap-ios-purchase-visibility.test.cjs (6 scenarios)' + String.fromCharCode(10));
})().catch(error => {
  process.stderr.write('FAIL iap-ios-purchase-visibility.test.cjs: ' + error.message + String.fromCharCode(10));
  process.exitCode = 1;
});
