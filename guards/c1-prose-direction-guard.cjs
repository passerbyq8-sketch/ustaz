'use strict';
// OTA-2 / O3-R5: exercise the actual Markdown renderer, including streaming tails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const React = require('react');
const source = fs.readFileSync(path.join(__dirname, '../app.jsx'), 'utf8');
const start = source.indexOf('const EZ_MD_INLINE = [');
const end = source.indexOf('// The component the bubble renders.', start);
assert(start >= 0 && end > start);
const renderer = source.slice(start, end);
const blocks = new Set(['div', 'p', 'pre', 'blockquote', 'li', 'th', 'td']);
function verify(code) {
  const render = vm.runInNewContext(code + '\nezMdBlocks', { React, s: {} });
  let checked = 0;
  const types = new Set();
  function walk(nodes) {
    React.Children.forEach(nodes, node => {
      if (!React.isValidElement(node)) return;
      if (blocks.has(node.type)) {
        assert.equal(node.props.dir, 'auto', node.type + ' chooses its own direction');
        assert.equal(node.props.style.unicodeBidi, 'plaintext', node.type + ' isolates prose paragraphs');
        assert(['start', 'end', 'center'].includes(node.props.style.textAlign));
        checked++;
        types.add(node.type);
      }
      walk(node.props.children);
    });
  }
  const fixtures = [
    'English prose: (a first clause). Next sentence!',
    '\u0646\u0635 \u0639\u0631\u0628\u064a: (English) \u0648\u062e\u0627\u062a\u0645\u0629.',
    '# English heading\n\n> \u0646\u0635 \u0639\u0631\u0628\u064a: (quote).',
    '- English: (one).\n- \u0646\u0635 \u0639\u0631\u0628\u064a: (two).',
    '1. English.\n2. \u0639\u0631\u0628\u064a.',
    '| English | \u0639\u0631\u0628\u064a |\n| :--- | ---: |\n| (A): one. | (B): two. |',
    '```text\nEnglish: (literal).\n\u0646\u0635 \u0639\u0631\u0628\u064a\n```'
  ];
  for (const fixture of fixtures) {
    for (let n = 1; n <= fixture.length; n++) walk(render(fixture.slice(0, n)));
    walk(render(fixture));
  }
  function text(nodes) {
    let out = '';
    React.Children.forEach(nodes, node => { out += React.isValidElement(node) ? text(node.props.children) : node == null ? '' : String(node); });
    return out;
  }
  for (const fixture of fixtures.slice(0, 2)) assert.equal(text(render(fixture)), fixture, 'prose punctuation and words are unchanged');
  for (const type of ['div', 'li', 'th', 'td', 'pre']) assert(types.has(type), 'actual ' + type + ' exercised');
  return checked;
}
const mutations = [
  ["dir: 'auto'", "dir: 'rtl'"],
  ["unicodeBidi: 'plaintext'", "unicodeBidi: 'normal'"],
  ['React.Children.map(node.props.children, bidi)', 'node.props.children']
];
const requested = process.argv.indexOf('--mutant');
if (requested >= 0) {
  const [from, to] = mutations[Number(process.argv[requested + 1]) || 0];
  assert(renderer.includes(from));
  verify(renderer.replace(from, to));
} else {
  const checked = verify(renderer);
  for (const [from, to] of mutations) {
    assert(renderer.includes(from));
    assert.throws(() => verify(renderer.replace(from, to)), assert.AssertionError);
  }
  console.log('PASS OTA-2: ' + checked + ' streamed/settled prose blocks; exact punctuation; 3 direction mutations rejected.');
}
