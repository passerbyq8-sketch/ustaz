'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const download = parseHTML(read('download.html')).document;
const about = parseHTML(read('about.html')).document;
const expected = [...download.querySelectorAll('a.badge')].map(a => ({
  href: a.getAttribute('href'), src: a.querySelector('img').getAttribute('src'),
  alt: a.querySelector('img').getAttribute('alt'),
}));
assert.equal(expected.length, 2, 'download must provide two reference badges');
const lists = [...about.querySelectorAll('ul.stores')];
assert.equal(lists.length, 2, 'Arabic and English must each have a store list');
for (const list of lists) {
  const actual = [...list.querySelectorAll('a.store')].map(a => {
    const img = a.querySelector('img');
    assert.ok(img, 'each store link must display a badge image');
    return { href: a.getAttribute('href'), src: img.getAttribute('src'), alt: img.getAttribute('alt') };
  });
  assert.deepEqual(actual, expected, 'badge order, URLs, images and accessible names match download.html');
}
for (const badge of expected) {
  assert.ok(badge.src.startsWith('/assets/store-badges/'), 'badge is a local asset');
  assert.ok(fs.statSync(path.join(root, badge.src)).size > 0, 'badge file exists');
  assert.ok(badge.alt.trim(), 'badge has an accessible name');
}
assert.ok(about.querySelectorAll('.storecredit').length === 2, 'both badge groups carry the Apple credit');
console.log('aboutstorebadges PASS: both language sections match the download page');
