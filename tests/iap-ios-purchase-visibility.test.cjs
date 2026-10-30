'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const sourcePath = process.env.IAP_BRIDGE_SOURCE || path.join(__dirname, '../hanna-laha/assets/iap-bridge-v1.js');
const source = fs.readFileSync(sourcePath, 'utf8');
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

function optionalSourceOf(name) {
  const node = declarations.get(name);
  return node ? source.slice(node.start, node.end) : '';
}

function fingerprintForTest(session) {
  let first = 2166136261;
  let second = 2246822519;
  for (let i = 0; i < session.length; i += 1) {
    const code = session.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
}

function verifiedEntryStorage(mode, session, appUserId, purchaseEntry) {
  const fingerprint = fingerprintForTest(session);
  return {
    ezik_iap_verified_mode_v1: JSON.stringify({ schema: 1, mode, verifiedAt: 1000 }),
    ezik_iap_entry_decision_v1: JSON.stringify({ schema: 1, sessions: {
      [fingerprint]: { appUserId, purchaseEntry, verifiedAt: 1000 },
    } }),
  };
}

function makeHomeEntry({ userAgent, platform = '', maxTouchPoints = 0, bridge = false, iapHandler = false, session = 'signed-in', modeError = true, mode = 'all', purchaseEntry = false, accountId = 'acct:test:owner', balanceError = false, storage = {} }) {
  const updates = [];
  let modeLookups = 0;
  let probeCalls = 0;
  let balanceLookups = 0;
  const values = new Map(Object.entries(storage));
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const window = { ReactNativeWebView: bridge ? { postMessage() {} } : null, addEventListener() {}, removeEventListener() {} };
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const navigator = { userAgent, platform, maxTouchPoints };
  const authSession = () => session;
  const getEnforcementMode = async () => {
    modeLookups++;
    if (modeError) throw new Error('public mode unavailable');
    return mode;
  };
  const getBalance = async () => {
    balanceLookups++;
    if (balanceError) return { ok: false, status: 503, data: {} };
    return { ok: true, data: { appUserId: accountId, purchaseEntry } };
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
    "const VERIFIED_MODE_KEY = 'ezik_iap_verified_mode_v1';",
    "const VERIFIED_ENTRY_DECISION_KEY = 'ezik_iap_entry_decision_v1';",
    optionalSourceOf('readVerifiedMode'),
    optionalSourceOf('sessionFingerprint'),
    optionalSourceOf('rememberEntryDecision'),
    optionalSourceOf('lastEntryDecisionForSession'),
    sourceOf('isIosWebViewWithMessaging'),
    sourceOf('hasNativeIosPurchaseBridge'),
    optionalSourceOf('hasNativePurchaseBridge') || 'async function hasNativePurchaseBridge() { return !!(window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function"); }',
    sourceOf('enterKunuzHome'),
    'return enterKunuzHome;'
  ].join(String.fromCharCode(10));
  const factory = new Function('window', 'document', 'navigator', 'localStorage', 'authSession', 'getEnforcementMode', 'getBalance', 'requestShell', 'homeSignInCleanup', factorySource);
  const enter = factory(window, document, navigator, localStorage, authSession, getEnforcementMode, getBalance, requestShell, null);
  return {
    updates,
    get modeLookups() { return modeLookups; },
    get probeCalls() { return probeCalls; },
    get balanceLookups() { return balanceLookups; },
    stored(key) { return values.get(key) || null; },
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
  if (process.env.IAP_GUARD_BASE_SOURCE === '1') {
    const session = 'base-guard-other-session';
    const deniedBase = makeHomeEntry({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
      session, modeError: false, mode: 'free', accountId: 'acct:test:other', purchaseEntry: false,
      storage: verifiedEntryStorage('free', session, 'acct:test:other', false),
    });
    await deniedBase.run();
    assert.equal(deniedBase.updates.at(-1).applicable, false, 'free-mode entry must honor the last server denial for this account');
    process.stdout.write('PASS iap-launch-free-entry-guard (base-source scenario)' + String.fromCharCode(10));
    return;
  }

  await verify('iOS IAP bridge handshake and signed-in account', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, modeError: false, mode: 'all',
  }, true, 1, 1);
  await verify('iOS generic WebView without IAP handler keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: false, modeError: false, mode: 'all',
  }, false, 1, 1);
  await verify('iOS without WebView bridge keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: false, modeError: false, mode: 'all',
  }, false, 1, 0);
  await verify('all mode shows the purchase entry on Android when its native IAP bridge answers prices', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true, iapHandler: true, modeError: false, mode: 'all',
  }, true, 1, 1);
  await verify('web keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', bridge: false, modeError: false, mode: 'all',
  }, false, 1, 0);
  await verify('signed-out iOS native shell keeps purchase entry hidden', {
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, session: null, modeError: false, mode: 'all',
  }, false, 1, 0, 'sign-in');

  await verify('free mode shows the listed owner entry on iOS with a native purchase bridge', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, modeError: false, mode: 'free', purchaseEntry: true,
  }, true, 1, 1);
  await verify('free mode hides the entry from another signed-in iOS account', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, modeError: false, mode: 'free', purchaseEntry: false,
  }, false, 1, 1);
  await verify('free mode shows the server-listed owner entry on Android with a native purchase bridge', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true, iapHandler: true, modeError: false, mode: 'free', purchaseEntry: true,
  }, true, 1, 1);
  await verify('free mode hides the entry from another signed-in Android account', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true, iapHandler: true, modeError: false, mode: 'free', purchaseEntry: false,
  }, false, 1, 1);
  const freeVisitor = makeHomeEntry({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', bridge: true, iapHandler: true, session: null, modeError: false, mode: 'free', purchaseEntry: true });
  await freeVisitor.run();
  assert.equal(freeVisitor.updates.at(-1).applicable, false, 'free visitor never sees entry');
  assert.equal(freeVisitor.updates.at(-1).notice, null, 'free visitor gets no purchase-only sign-in prompt');
  assert.equal(freeVisitor.probeCalls, 0, 'free visitor does not probe the store bridge');
  const freeWebOwner = makeHomeEntry({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', modeError: false, mode: 'free', purchaseEntry: true });
  await freeWebOwner.run();
  assert.equal(freeWebOwner.updates.at(-1).applicable, false, 'web owner has no native purchase entry');
  const freeIosWithoutBridge = makeHomeEntry({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', modeError: false, mode: 'free', purchaseEntry: true });
  await freeIosWithoutBridge.run();
  assert.equal(freeIosWithoutBridge.updates.at(-1).applicable, false, 'free owner without bridge has no entry');
  const todayIos = makeHomeEntry({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true, modeError: false, mode: 'test', purchaseEntry: false });
  await todayIos.run();
  assert.equal(todayIos.updates.at(-1).applicable, true, 'today test configuration retains Apple review entry for signed-in iOS');

  const freeOwnerSession = 'free-owner-session';
  const cachedFreeOwner = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    session: freeOwnerSession, modeError: false, mode: 'free', balanceError: true,
    storage: verifiedEntryStorage('free', freeOwnerSession, 'acct:test:owner', true),
  });
  await cachedFreeOwner.run();
  assert.equal(cachedFreeOwner.updates.at(-1).applicable, true, 'a failed balance lookup in free mode keeps the last server-allowed entry for the same account session');

  const freeOtherSession = 'free-other-session';
  const cachedFreeOther = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    session: freeOtherSession, modeError: false, mode: 'free', accountId: 'acct:test:other', purchaseEntry: false,
    storage: verifiedEntryStorage('free', freeOtherSession, 'acct:test:other', true),
  });
  await cachedFreeOther.run();
  assert.equal(cachedFreeOther.updates.at(-1).applicable, false, 'a fresh server denial replaces an older allow decision for the same account');

  const freeModeLookupFailure = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    session: freeOtherSession, modeError: true, accountId: 'acct:test:other', purchaseEntry: false,
    storage: verifiedEntryStorage('free', freeOtherSession, 'acct:test:other', false),
  });
  await freeModeLookupFailure.run();
  assert.equal(freeModeLookupFailure.updates.at(-1).applicable, false, 'a failed mode lookup uses the last free-mode denial for this account');

  const switchedAccount = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    session: 'new-session', modeError: true, balanceError: true,
    storage: verifiedEntryStorage('free', freeOwnerSession, 'acct:test:owner', true),
  });
  await switchedAccount.run();
  assert.equal(switchedAccount.updates.at(-1).applicable, false, 'a cached allow decision cannot transfer to another account session');

  const cachedTestFallback = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    modeError: true, storage: { ezik_iap_verified_mode_v1: JSON.stringify({ schema: 1, mode: 'test', verifiedAt: 1000 }) },
  });
  await cachedTestFallback.run();
  assert.equal(cachedTestFallback.updates.at(-1).applicable, true, 'cached test mode keeps the current Apple review fallback');

  const cachedAllFallback = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    modeError: true, storage: { ezik_iap_verified_mode_v1: JSON.stringify({ schema: 1, mode: 'all', verifiedAt: 1000 }) },
  });
  await cachedAllFallback.run();
  assert.equal(cachedAllFallback.updates.at(-1).applicable, true, 'cached all mode keeps the current iOS fallback');

  const storedDecision = makeHomeEntry({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', bridge: true, iapHandler: true,
    session: 'fresh-free-owner', modeError: false, mode: 'free', purchaseEntry: true,
  });
  await storedDecision.run();
  const savedDecision = JSON.parse(storedDecision.stored('ezik_iap_entry_decision_v1'));
  const savedOwnerDecision = savedDecision.sessions[fingerprintForTest('fresh-free-owner')];
  assert.equal(savedOwnerDecision.appUserId, 'acct:test:owner', 'saved entry decision is account-scoped by the server account id');
  assert.equal(savedOwnerDecision.purchaseEntry, true, 'saved entry decision preserves the server allow decision');
  process.stdout.write('PASS iap-ios-purchase-visibility.test.cjs (20 scenarios)' + String.fromCharCode(10));
})().catch(error => {
  process.stderr.write('FAIL iap-ios-purchase-visibility.test.cjs: ' + error.message + String.fromCharCode(10));
  process.exitCode = 1;
});
