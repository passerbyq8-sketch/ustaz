// guards/safe-fetch-guard.cjs -- brain35 O-4 (2026-11-06; DIAG SEC-032): THE FETCHER CANNOT BE REBOUND, AND THE v6 TEST
// READS THE ADDRESS.
//
// MEASURED (DIAG harness H6). (1) The IPv6 predicate matched TEXT, so ten non-public addresses passed it by being
// written another way: 0:0:0:0:0:0:0:1, ::ffff:7f00:1, ::ffff:a00:1, 0:0:0:0:0:ffff:127.0.0.1, fec0::1, 2002:7f00:1::,
// 2002:a00:1::, 2002:c0a8:101::, 2001:0:1234::1, 100::1 -- every one of them reaches our own network. (2) preflight
// resolved the host and approved its addresses, and the fetch then resolved the name AGAIN and connected wherever its
// own resolver said: an authoritative server answering twice (public, then 169.254.169.254) reaches our metadata
// service with our own socket.
//
// WHAT THIS PINS, offline: an injected resolver, a stub transport, no network, no model.
//   1. the H6 table, all 28 rows: 25 non-public inputs blocked, 3 public allowed;
//   2. the v6 reader itself: sixteen bytes from every legal form, null from an illegal one, malformed -> blocked;
//   3. pinning: the hop connects to the address preflight checked, with the Host header and TLS name still the host's;
//   4. rebinding: a resolver that answers public and then private is refused before any socket;
//   5. a 302 to a registered host that resolves private is refused at hop 2, after one request;
//   6. five redirects -> too-many-redirects;
//   7. a pinned lookup refuses any name but the hop's own;
//   8. two mutants -- the v6 parse dropped, the pinning dropped -- each killed.
//
// Usage: node guards/safe-fetch-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/[^\x20-\x7e\n]/g, '~').slice(0, 400) : ''));
  return false;
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href + '?sf=' + Date.now());

// The H6 table, verbatim: the input, and whether a public destination is what it names.
const TABLE = [
  ['::1', 'blocked'], ['::', 'blocked'], ['0:0:0:0:0:0:0:1', 'blocked'],
  ['::ffff:127.0.0.1', 'blocked'], ['::ffff:7f00:1', 'blocked'], ['0:0:0:0:0:ffff:127.0.0.1', 'blocked'],
  ['::ffff:10.0.0.1', 'blocked'], ['::ffff:a00:1', 'blocked'], ['::10.0.0.1', 'blocked'],
  ['fc00::1', 'blocked'], ['fd12:3456::1', 'blocked'], ['fe80::1', 'blocked'], ['fe80::1%eth0', 'blocked'],
  ['fec0::1', 'blocked'], ['ff02::1', 'blocked'],
  ['64:ff9b::7f00:1', 'blocked'], ['64:ff9b::a00:1', 'blocked'],
  ['2002:7f00:1::', 'blocked'], ['2002:a00:1::', 'blocked'], ['2002:c0a8:101::', 'blocked'],
  ['2001:0:1234::1', 'blocked'], ['2001:db8::1', 'blocked'], ['100::1', 'blocked'],
  ['127.0.0.1', 'blocked'], ['169.254.169.254', 'blocked'],
  ['2001:4860:4860::8888', 'allowed'], ['2606:4700::1111', 'allowed'], ['93.184.216.34', 'allowed'],
];

// a response shaped the way safeFetch reads one
const page = (html, { status = 200, ct = 'text/html; charset=utf-8', location = '' } = {}) => ({
  status,
  headers: { get: (n) => (String(n).toLowerCase() === 'content-type' ? ct : String(n).toLowerCase() === 'location' ? (location || null) : null) },
  text: async () => html,
});

(async () => {
  console.log('=== safe-fetch-guard -- brain35 O-4: the checked address is the connected address ===');
  const SF = await esm('lib/ledger/safe-fetch.js');
  const POLICY = await esm('lib/ledger/source-policy.js');

  // 1. the H6 table
  {
    const gaps = TABLE.filter(([ip, want]) => (SF.blockedIpReason(ip) ? 'blocked' : 'allowed') !== want)
      .map(([ip]) => ip + ' -> ' + JSON.stringify(SF.blockedIpReason(ip)));
    ok('1a the H6 table: every one of its 25 non-public inputs is blocked and its 3 public ones allowed',
      gaps.length === 0 && TABLE.length === 28, gaps.join(' | '));
    ok('1b and each refusal names the range it belongs to, not a bare «blocked»',
      /^ipv4-mapped:loopback$/u.test(SF.blockedIpReason('::ffff:7f00:1'))
      && SF.blockedIpReason('2002:c0a8:101::') === '6to4:private-192.168/16'
      && SF.blockedIpReason('2001:0:1234::1').startsWith('teredo')
      && SF.blockedIpReason('fec0::1') === 'site-local-fec0::/10'
      && SF.blockedIpReason('100::1') === 'discard-100::/64',
      JSON.stringify(['::ffff:7f00:1', '2002:c0a8:101::', '2001:0:1234::1', 'fec0::1', '100::1'].map((ip) => SF.blockedIpReason(ip))));
  }
  // 2. the reader
  {
    const bytes = SF.ipv6Bytes('::ffff:127.0.0.1');
    ok('2a the reader gives sixteen bytes, and reads a trailing dotted quad as the last four',
      Array.isArray(bytes) && bytes.length === 16 && bytes.slice(12).join('.') === '127.0.0.1'
      && SF.ipv6Bytes('2001:db8::1').length === 16 && SF.ipv6Bytes('0:0:0:0:0:0:0:1').slice(-1)[0] === 1,
      JSON.stringify(bytes));
    ok('2b an illegal form is null, and a malformed address is BLOCKED, never allowed',
      SF.ipv6Bytes('::1::2') === null && SF.ipv6Bytes('12345::') === null && SF.ipv6Bytes('') === null
      && SF.blockedIpReason('not-an-address') === 'not-an-ip');
  }

  // the host this guard drives: a registered, enabled publisher, so the policy gate is not what refuses
  const host = (POLICY.POLICY_ROWS || []).filter((row) => row && row.health === 'enabled' && row.domain && !row.domain.includes('*')).map((row) => row.domain)[0]
    || 'iifa-aifi.org';
  const url = 'https://' + host + '/page.html';
  const withResolver = async (answers, fn) => {
    SF.__setResolverForTest(async () => answers);
    try { return await fn(); } finally { SF.__resetResolver(); }
  };

  // 3. the hop connects to the checked address
  {
    const seen = [];
    const got = await withResolver([{ address: '93.184.216.34', family: 4 }], () => SF.safeFetch(url, {
      httpsImpl: {
        request(options, onResponse) {
          seen.push({ hostname: options.hostname, servername: options.servername, host: options.headers && options.headers.Host, lookup: typeof options.lookup });
          // the pinned lookup is asked for the hop's own name, and answers the checked address
          const answers = [];
          options.lookup(options.hostname, { all: true }, (err, list) => answers.push(err ? 'ERR' : list));
          options.lookup('evil.invalid', {}, (err) => answers.push(err ? String(err.code) : 'ALLOWED'));
          seen[seen.length - 1].answers = answers;
          const res = { statusCode: 200, headers: { 'content-type': 'text/html' }, on(ev, cb) { if (ev === 'end') Promise.resolve().then(cb); return res; }, destroy() {} };
          Promise.resolve().then(() => onResponse(res));
          return { on() { return this; }, end() {}, destroy() {} };
        },
      },
    }));
    ok('3a the hop is made with the host\'s own name and TLS name, the Host header the host, and a lookup of its own',
      seen.length === 1 && seen[0].hostname === host && seen[0].servername === host && seen[0].host === host
      && seen[0].lookup === 'function', JSON.stringify(seen));
    ok('3b that lookup answers the address preflight checked...',
      seen.length === 1 && Array.isArray(seen[0].answers) && Array.isArray(seen[0].answers[0])
      && seen[0].answers[0][0] && seen[0].answers[0][0].address === '93.184.216.34', JSON.stringify(seen[0] && seen[0].answers));
    ok('7a ...and refuses any other name on that hop', seen.length === 1 && seen[0].answers[1] === 'EPINNEDHOST', JSON.stringify(seen[0] && seen[0].answers));
    ok('3c the answer is the shape the module reads (ok, status, the hop recorded)',
      got && got.ok === true && got.status === 200 && Array.isArray(got.hops) && got.hops[0] === url, JSON.stringify(got && { ok: got.ok, status: got.status, hops: got.hops, reason: got.reason }));
  }

  // 3d/3e the two ways this pin was nearly dead on arrival (found by review of the O-4 commit itself)
  {
    // lib/retrieve.js fetchAndClean passes `fetchImpl: options.fetchImpl || globalThis.fetch`, so on the production
    // world-retrieval path an argument is ALWAYS present: a pinnability test that asked whether one was passed left that
    // path -- the one SEC-032 is about -- unpinned. Pinnability is decided by identity instead.
    let sockets = 0;
    const httpsImpl = {
      request(options, onResponse) {
        sockets += 1;
        const res = { statusCode: 200, headers: { 'content-type': 'text/html' }, on(ev, cb) { if (ev === 'end') Promise.resolve().then(cb); return res; }, destroy() {} };
        Promise.resolve().then(() => onResponse(res));
        return { on() { return this; }, end() {}, destroy() {} };
      },
    };
    const got = await withResolver([{ address: '93.184.216.34', family: 4 }], () => SF.safeFetch(url, {
      // exactly the shape fetchAndClean sends
      fetchImpl: globalThis.fetch, httpsImpl,
    }));
    ok('3d a caller that hands us the runtime\'s own fetch (what fetchAndClean does) is still pinned',
      sockets === 1 && got && got.ok === true, JSON.stringify({ sockets, ok: got && got.ok, reason: got && got.reason }));
    ok('3e ...and that is the shape lib/retrieve.js really sends, so this row tests the production path',
      read('lib/retrieve.js').includes('fetchImpl: options.fetchImpl || globalThis.fetch,'));
    // MEASURED: call-mode-guard.cjs replaces globalThis.fetch BEFORE importing the handler, so an identity test against
    // what this module captured at load time pinned a socket behind that stub and reddened four of its rows.
    ok('3e2 the transport is recognised by its own source, not by identity against load time, so a guard that replaces the global before the import is still honoured',
      /const RUNTIME_FETCH_SOURCE = \/\^\(\?:async/u.test(read('lib/ledger/safe-fetch.js'))
      && read('lib/ledger/safe-fetch.js').includes('function fetch') && read('lib/ledger/safe-fetch.js').includes('Function.prototype.toString.call(doFetch)')
      && read('call-mode-guard.cjs').includes('global.fetch = async () =>'));
    // a stub is still a stub: a caller-supplied function that is NOT the runtime's fetch opens no pinned socket
    let stubCalls = 0;
    let stubSockets = 0;
    const stubbed = await withResolver([{ address: '93.184.216.34', family: 4 }], () => SF.safeFetch(url, {
      fetchImpl: async () => { stubCalls += 1; return page('<html>x</html>'); },
      httpsImpl: { request() { stubSockets += 1; return { on() { return this; }, end() {}, destroy() {} }; } },
    }));
    ok('3f a real stub is still used as the transport, and no pinned socket is opened behind it',
      stubCalls === 1 && stubSockets === 0 && stubbed && stubbed.ok === true, JSON.stringify({ stubCalls, stubSockets }));
    // the content-type gate does not soften for a pinned hop
    let noCtSockets = 0;
    const noCt = await withResolver([{ address: '93.184.216.34', family: 4 }], () => SF.safeFetch(url, {
      httpsImpl: {
        request(options, onResponse) {
          noCtSockets += 1;
          const res = { statusCode: 200, headers: {}, on(ev, cb) { if (ev === 'end') Promise.resolve().then(cb); return res; }, destroy() {} };
          Promise.resolve().then(() => onResponse(res));
          return { on() { return this; }, end() {}, destroy() {} };
        },
      },
    }));
    ok('3g a pinned hop with NO content-type is refused, not read as HTML (the test-double default is for doubles only)',
      noCtSockets === 1 && noCt && noCt.ok === false && String(noCt.reason).startsWith('content-type:'),
      JSON.stringify({ noCtSockets, ok: noCt && noCt.ok, reason: noCt && noCt.reason }));
  }

  // 4. rebinding: a resolver that answers one public and one private address
  {
    let sockets = 0;
    const got = await withResolver([{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }], () => SF.safeFetch(url, {
      httpsImpl: { request() { sockets += 1; return { on() { return this; }, end() {}, destroy() {} }; } },
    }));
    ok('4a a host that resolves to one public and one private address is refused, with no socket opened',
      got && got.ok === false && /non-public-address/u.test(String(got.reason)) && sockets === 0,
      JSON.stringify({ reason: got && got.reason, sockets }));
  }

  // 5. a 302 to a registered host that resolves private
  {
    const other = (POLICY.POLICY_ROWS || []).filter((row) => row && row.health === 'enabled' && row.domain && !row.domain.includes('*') && row.domain !== host).map((row) => row.domain)[0];
    if (!other) { ok('5a (skipped: the policy holds only one enabled host)', true); } else {
      const calls = [];
      const got = await withResolver(null, async () => {
        SF.__setResolverForTest(async (name) => (name === host
          ? [{ address: '93.184.216.34', family: 4 }]
          : [{ address: '10.0.0.7', family: 4 }]));
        return SF.safeFetch(url, {
          fetchImpl: async (u) => { calls.push(String(u)); return page('', { status: 302, location: 'https://' + other + '/next' }); },
        });
      });
      ok('5a a 302 to a registered host that resolves private is refused at the second hop, after one request',
        got && got.ok === false && /preflight:non-public-address/u.test(String(got.reason)) && calls.length === 1
        && got.fetchedUrl === 'https://' + other + '/next', JSON.stringify({ reason: got && got.reason, calls, fetchedUrl: got && got.fetchedUrl }));
    }
  }

  // 6. five redirects
  {
    let calls = 0;
    const got = await withResolver([{ address: '93.184.216.34', family: 4 }], () => SF.safeFetch(url, {
      fetchImpl: async (u) => { calls += 1; return page('', { status: 302, location: String(u) + '?r=' + calls }); },
    }));
    ok('6a a chain longer than MAX_REDIRECTS ends as too-many-redirects, and MAX_REDIRECTS is still four',
      got && got.ok === false && got.reason === 'too-many-redirects' && SF.MAX_REDIRECTS === 4 && calls === SF.MAX_REDIRECTS + 1,
      JSON.stringify({ reason: got && got.reason, calls }));
  }

  // 8. the mutants
  {
    const src = read('lib/ledger/safe-fetch.js');
    const twin = async (transform, tag) => {
      const mutated = transform(src);
      if (mutated === src) return { changed: false };
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-sf-' + tag + '-'));
      const file = path.join(tmp, 'safe-fetch.mjs');
      fs.writeFileSync(file, mutated.replace(/from\s+(['"])(\.[^'"]*)\1/gu,
        (_a, q, spec) => 'from ' + q + pathToFileURL(path.resolve(REPO, 'lib', 'ledger', spec)).href + q), 'utf8');
      try { return { changed: true, mod: await import(pathToFileURL(file).href + '?t=' + Date.now()) }; } catch (e) { return { changed: true, error: String(e && e.message) }; } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
      }
    };
    const m1 = await twin((x) => x.replace("  if (b[0] === 0x20 && b[1] === 0x02) {", "  if (false) { // mutant: 6to4 is not read"), 'v6');
    ok('8a MUTANT v6 seam applied and loaded', m1.changed && m1.mod, m1.error);
    ok('8a MUTANT KILLED: without the 6to4 branch, 2002:c0a8:101:: (192.168.1.1 in a v6 coat) is let through',
      !!m1.mod && m1.mod.blockedIpReason('2002:c0a8:101::') === null
      && SF.blockedIpReason('2002:c0a8:101::') === '6to4:private-192.168/16', m1.error);
    const m2 = await twin((x) => x.replace(
      "      const pinned = pinnable(doFetch) && Array.isArray(pre.addresses) && pre.addresses.length > 0 ? pre.addresses[0] : '';",
      "      const pinned = ''; // mutant: the hop resolves the name again"), 'pin');
    ok('8b MUTANT pinning seam applied and loaded', m2.changed && m2.mod, m2.error);
    if (m2.mod) {
      // OFFLINE, and it must stay offline: without the pin `doFetch` is globalThis.fetch, which on the original run of
      // this guard really did reach the publisher (one GET, HTTP 404). The global is stubbed here, so the mutant's call
      // is counted and no socket leaves the machine.
      let sockets = 0;
      let globals = 0;
      const realFetch = globalThis.fetch;
      globalThis.fetch = async () => { globals += 1; throw new Error('guard: no network'); };
      m2.mod.__setResolverForTest(async () => [{ address: '93.184.216.34', family: 4 }]);
      let got;
      try {
        got = await m2.mod.safeFetch(url, { httpsImpl: { request() { sockets += 1; return { on() { return this; }, end() {}, destroy() {} }; } } });
      } finally {
        globalThis.fetch = realFetch;
        m2.mod.__resetResolver();
      }
      ok('8b MUTANT KILLED: without the pin the hop opens no pinned socket and goes to the runtime\'s own fetch instead',
        sockets === 0 && globals === 1, JSON.stringify({ sockets, globals, ok: got && got.ok, reason: got && got.reason }));
    } else ok('8b MUTANT KILLED: without the pin the hop goes back to the runtime\'s own resolver', false, m2.error);
  }

  console.log('\n=== safe-fetch: ' + (checks - failures) + '/' + checks + (failures ? ' FAIL' : ' PASS') + ' ===');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('GUARD THREW: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
