import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../.github/workflows/fatwa-drift-watch.yml', import.meta.url), 'utf8');
const pins = {
  'actions/checkout': '11d5960a326750d5838078e36cf38b85af677262',
  'actions/setup-node': '49933ea5288caeca8642d1e84afbd3f7d6820020',
};
for (const [action, sha] of Object.entries(pins)) test(action + ' uses the reviewed immutable commit', () => {
  const refs = [...source.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]);
  assert.ok(refs.includes(action + '@' + sha));
  assert.equal(refs.filter(ref => ref.startsWith(action + '@')).length, 1);
});
test('the scheduled watch keeps its read-only, bounded Node 22 contract', () => {
  assert.match(source, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(source, /(?:contents|id-token|actions|packages): write/);
  assert.match(source, /timeout-minutes: 5/);
  assert.match(source, /node-version: '22'/);
  assert.match(source, /cron: '17 5 \* \* \*'/);
  assert.match(source, /run: node tools\/fatwa-drift-watch.cjs --selftest/);
  const refs = [...source.matchAll(/uses:\s*(\S+)/g)].map(match => match[1]);
  assert.equal(refs.length, 2);
  assert.ok(refs.every(ref => /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/.test(ref)));
});
