'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pages = ['quest.html', 'quest-board.html', 'quest-test.html', 'quest-ghaws.html', 'quest-harb.html', 'hanna-laha/index.html'];
function references() {
  const refs = new Map();
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const base = new URL(page, 'https://assets.invalid/');
    for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']*\?[^"']*)["']/g)) {
      const url = new URL(match[1].replace(/&amp;/g, '&'), base), version = url.searchParams.get('v');
      if (url.origin !== base.origin || version === null) continue;
      assert.ok(version, page + ': empty asset version');
      const asset = decodeURIComponent(url.pathname.slice(1));
      assert.ok(!asset.split('/').includes('..'), 'Asset stays in the site');
      const key = asset + '?v=' + version;
      if (!refs.has(key)) refs.set(key, { asset, version, pages: [] });
      refs.get(key).pages.push(page);
    }
  }
  return refs;
}
function verify() {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'guards/asset-versions.json'), 'utf8'));
  assert.equal(registry.schema, 1);
  const refs = references();
  for (const [key, ref] of refs) {
    assert.ok(Object.hasOwn(registry.assets, key), 'Unregistered asset version: ' + key);
    const content = fs.readFileSync(path.join(root, ref.asset));
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    assert.equal(sha, registry.assets[key], key + ': content changed without a version bump');
  }
  assert.equal(fs.readFileSync(path.join(root, 'quest-theme/room-categories.js'), 'utf8'), require('../tools/hanna-room-categories.cjs').generate(), 'Room IDs must match the room sync source');
  console.log('PASS asset versions: ' + refs.size + ' URL versions across ' + pages.length + ' pages; room category projection matches.');
}
module.exports = { references, verify };
if (require.main === module) verify();
