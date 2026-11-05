'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), crypto = require('crypto');
const root = path.join(__dirname, '..'), fixture = require('./c1-games-delivery-fixtures.json');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = body => crypto.createHash('sha256').update(body).digest('hex');
const documents = Object.fromEntries(fixture.files.map(file => [file, read(file)]));
const worker = read('quest-sw.js'), registry = JSON.parse(read('guards/asset-versions.json')).assets;
const pattern = /[^"'\s`<>]+\.js\?v=[a-zA-Z0-9_-]+/g;
function target(file, url) {
  const base = file.startsWith('hanna-laha/assets/') && url.startsWith('assets/') ? 'https://fixture.invalid/hanna-laha/' : 'https://fixture.invalid/' + file;
  return new URL(url, base).pathname.slice(1);
}
async function verify(docs, source, entries = registry) {
  assert.equal(source.match(/const VERSION = '([^']+)';/)[1], fixture.version, 'reserved precache version');
  for (const [key, value] of Object.entries(fixture.previousRegistry)) assert.equal(entries[key], value, 'old registry entry retained: ' + key);
  const refs = new Map(fixture.assets.map(asset => [asset, []]));
  for (const [file, text] of Object.entries(docs)) for (const match of text.matchAll(pattern)) {
    const asset = target(file, match[0]);
    if (!refs.has(asset)) continue;
    assert.equal(match[0].split('?v=')[1], fixture.version, file + ': fresh dependency URL for ' + asset);
    refs.get(asset).push({ file, url: match[0] });
  }
  const handlers = {}, disk = new Map(), requests = [];
  for (const asset of fixture.assets) for (const old of fixture.oldURLs[asset]) disk.set('/' + asset + '?v=' + old, 'STALE:' + asset);
  const scope = {
    URL, Request, Response, Headers, Set, Map, Promise, Uint8Array, crypto: crypto.webcrypto,
    importScripts() {}, self: { location: { origin: 'https://fixture.invalid' }, KUNUZ_PACKS: [], addEventListener: (name, fn) => handlers[name] = fn },
    fetch: async request => { const url = new URL(request.url || request); requests.push(url.href); const response = new Response(fs.readFileSync(path.join(root, url.pathname.slice(1)))); Object.defineProperty(response, 'url', { value: url.href }); return response; },
    readFixture: async key => disk.has(key) ? new Response(disk.get(key)) : null,
    writeFixture: async (key, response) => disk.set(key, await response.text())
  };
  const context = vm.createContext(scope);
  // Execute the real cache-first worker with the preceding database version.
  // Only the disk boundary is replaced; URL routing and cache keys are real.
  vm.runInContext(source.replace("const VERSION = '" + fixture.version + "';", "const VERSION = '" + fixture.previousVersion + "';") + '\nreadAsset=readFixture;writeAsset=writeFixture;', context);
  for (const asset of fixture.assets) {
    assert(refs.get(asset).length, 'reachable immutable asset: ' + asset);
    const current = read(asset), key = '/' + asset + '?v=' + fixture.version;
    assert.equal(entries[asset + '?v=' + fixture.version], hash(Buffer.from(current)), 'new immutable digest: ' + asset);
    assert(vm.runInContext('SHELL.includes(' + JSON.stringify('/' + asset) + ')', context), 'precache includes ' + asset);
    const count = requests.length;
    let reply;
    const event = { request: new Request('https://fixture.invalid' + key), respondWith: promise => reply = promise };
    handlers.fetch(event); assert(reply, 'actual worker routes asset'); assert.equal(await (await reply).text(), current);
    assert.equal(requests.length, count + 1, 'new URL fetches despite stale cache');
    handlers.fetch(event); assert.equal(await (await reply).text(), current); assert.equal(requests.length, count + 1, 'new bytes reusable offline');
    for (const old of fixture.oldURLs[asset]) assert.equal(disk.get('/' + asset + '?v=' + old), 'STALE:' + asset, 'old key never aliased');
  }
  return refs;
}
(async () => {
  const refs = await verify(documents, worker); let mutations = 0;
  for (const asset of fixture.assets) {
    const ref = refs.get(asset)[0], stale = ref.url.replace(fixture.version, fixture.oldURLs[asset][0]);
    await assert.rejects(() => verify({ ...documents, [ref.file]: documents[ref.file].replace(ref.url, stale) }, worker)); mutations++;
    await assert.rejects(() => verify(documents, worker.replace("'/" + asset + "',", ''))); mutations++;
    await assert.rejects(() => verify(documents, worker, { ...registry, [asset + '?v=' + fixture.version]: '0'.repeat(64) })); mutations++;
  }
  await assert.rejects(() => verify(documents, worker.replace(fixture.version, fixture.previousVersion))); mutations++;
  const previousKey = Object.keys(fixture.previousRegistry)[0];
  await assert.rejects(() => verify(documents, worker, { ...registry, [previousKey]: '0'.repeat(64) })); mutations++;
  await assert.rejects(() => verify(documents, worker.replace("url.searchParams.get('v') || VERSION", 'VERSION'))); mutations++;
  await verify(documents, worker);
  console.log('PASS c1gamesdelivery: ' + fixture.assets.length + ' immutable assets, actual cache-first delivery, prior registry retained; ' + mutations + ' regressions rejected.');
})().catch(error => { console.error(error); process.exitCode = 1; });
