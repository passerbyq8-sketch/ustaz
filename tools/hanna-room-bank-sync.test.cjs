'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {parseBank, liveBank, isHeld, roomId} = require('./hanna-room-bank-sync.cjs');
const category = ['test', 'Test', 'secular'];
const row = [0, 0, 1, 'A question?', ['Yes', 'No'], 0, '', '', 'test-1'];
const held = [0, 0, 0, '', [], -1, '', '', 'test-2'];
test('held tombstones are excluded without changing live content or category order', () => {
  const bank = {cats: [category], qs: [row, held]};
  const before = JSON.stringify(bank);
  assert.deepEqual(liveBank(bank), {cats: [category], qs: [row]});
  assert.equal(JSON.stringify(bank), before);
  assert.equal(isHeld(held), true);
  assert.equal(isHeld(row), false);
});

test('quality-held rows retain their content and stay out of rooms', () => {
  const retainedHeld = Object.assign([...row], {2: 0, 8: 'test-held-retained'});
  const bank = {cats: [category], qs: [row, held, retainedHeld]};
  const before = JSON.stringify(bank);
  assert.equal(isHeld(retainedHeld), true);
  assert.deepEqual(liveBank(bank), {cats: [category], qs: [row]});
  assert.equal(JSON.stringify(bank), before);
});
test('a malformed live row is rejected instead of being silently dropped', () => {
  for (const change of [{3: ''}, {5: 2}, {4: ['Yes', '']}, {0: 99}]) {
    const bad = Object.assign([...row], change);
    assert.throws(() => liveBank({cats: [category], qs: [bad]}));
  }
  assert.throws(() => liveBank({cats: [category], qs: [row, [...row]]}));
});
test('room ids retain the existing category/type/prompt hash rule', () => {
  const crypto = require('node:crypto');
  const expected = 'test-' + crypto.createHash('sha256').update('test\0mcq\0A question?').digest('hex').slice(0, 8);
  assert.equal(roomId('test', '  A question? '), expected);
  assert.equal(roomId('test', 'A question?'), expected);
});
test('bank parsing accepts data only, and the real base bank preserves every live row', () => {
  assert.throws(() => parseBank('var DATA=(()=>{throw Error("executed")})();'));
  const bank = parseBank(fs.readFileSync(path.join(__dirname, '../quest-data/kunuz-bank-3147.js')));
  const live = liveBank(bank);
  assert.equal(live.qs.length + bank.qs.filter(isHeld).length, bank.qs.length);
  assert.deepEqual(live.cats, bank.cats);
  assert.ok(!live.qs.some(isHeld));
  assert.ok(live.qs.every(row => row[2] !== 0));
});
