/* Run with node --test tools/kunuz-theme-norepeat-test.cjs. Uses the real native
   base/pack history and Journey model, with isolated device-local storage. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const cycleKey = 'kunuz_journey_history_v1';
function device(storage = new Map(), denied = false) {
  const qs = Array.from({ length: 28 }, (_, i) => [Math.floor(i / 14), 0, 1, 'Question ' + i, ['A', 'B', 'C', 'D'], 0, '', '', 'base-' + i]);
  qs.push([0, 0, 0, 'Held', ['A', 'B', 'C', 'D'], 0, '', '', 'held']);
  const context = { Math, Object, Array, Set, Map, Promise,
    DATA: { cats: [['small', 'Small', 'general'], ['other', 'Other', 'general']], qs },
    KUNUZ_LEVELS: { levels: Object.fromEntries(qs.map((q, i) => [q[8], i % 3 + 1])) },
    localStorage: {
      getItem(key) { if (denied) throw Error('denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (denied) throw Error('denied'); storage.set(key, value); },
      removeItem(key) { if (denied) throw Error('denied'); storage.delete(key); }
    }
  };
  context.window = context; vm.createContext(context);
  for (const file of ['quest-theme/history.js', 'quest-visual.js', 'quest-theme/model.js']) vm.runInContext(read(file), context);
  const model = context.KunuzModel, history = model.history();
  function pack() {
    const questions = Array.from({ length: 14 }, (_, i) => ({
      id: 'fixture-pack-' + String(i + 1).padStart(4, '0'), cat: 'pack-small', type: 'mcq', status: 'approved', fmt: 'text',
      q: 'Pack question ' + i, choices: ['A', 'B', 'C', 'D'], answer: 0, why: '', src: [], level: i % 3 + 1
    }));
    assert.equal(context.KZV.register({ slug: 'fixture-pack', cats: [{ id: 'pack-small', name: 'Pack', kind: 'general' }], qs: questions, stamp: context.KZV.stamp(questions) }), true);
    return 2;
  }
  return { context, model, history, storage, pack,
    reserve: cats => model.reserve(cats, history, () => .37),
    show: indices => indices.forEach(i => history.mark(i)),
    rows: cat => context.DATA.qs.map((_, i) => i).filter(i => context.DATA.qs[i][0] === cat && model.live(i)),
    record: () => JSON.parse(storage.get(cycleKey))
  };
}
function play(d, cat) {
  const reservation = d.reserve([cat]);
  assert.equal(reservation.shortage.length, 0); assert.equal(reservation.indices.length, 6);
  assert.equal(new Set(reservation.indices).size, 6); assert.equal(new Set(reservation.slots.map(s => s.index)).size, 6);
  d.show([...reservation.indices].reverse());
  return reservation;
}
function exhaustion(d, cat) {
  const first = play(d, cat), second = play(d, cat);
  assert.ok(second.indices.every(i => !first.indices.includes(i)));
  const unseen = d.rows(cat).filter(i => !d.history.has(i)); assert.equal(unseen.length, 2);
  const oldest = d.rows(cat).filter(i => d.history.has(i)).sort((a, b) => d.history.last(a) - d.history.last(b)).slice(0, 4);
  const third = d.reserve([cat]);
  assert.equal(third.shortage.length, 0); assert.equal(third.indices.length, 6);
  assert.deepEqual(new Set(third.indices.slice(0, 2)), new Set(unseen));
  assert.deepEqual([...third.indices.slice(2)], oldest);
  assert.deepEqual([...third.restarts], [cat]);
  return { first, second, third };
}
test('a small category stays selectable: remaining unseen precede oldest-seen reservations', () => {
  const d = device(); exhaustion(d, 0);
  assert.ok(d.model.categories().filter(c => c.count >= 6).some(c => c.index === 0));
});
test('a real supplemental pack follows the same cycle and oldest-seen rule', () => {
  const d = device(), cat = d.pack(); exhaustion(d, cat);
  assert.ok(d.storage.has('kunuz_pack_seen_v1'));
});
test('no question repeats inside any of forty games, including repeated category inputs', () => {
  const d = device(); d.pack();
  for (let game = 0; game < 40; game++) {
    const p = d.reserve([0, 1, 2, 0]);
    assert.equal(p.shortage.length, 0); assert.equal(p.indices.length, 18);
    assert.equal(new Set(p.indices).size, 18); assert.equal(new Set(p.slots.map(s => s.index)).size, 18);
    d.show(p.indices);
  }
});
test('reserving or restarting never marks unopened questions seen', () => {
  const d = device(), { third } = exhaustion(d, 0);
  third.indices.forEach(i => assert.equal(d.history.has(i), false));
  assert.deepEqual(d.record().cycles.small.seen, []);
  d.history.mark(third.indices[0]);
  assert.equal(d.history.has(third.indices[0]), true);
  third.indices.slice(1).forEach(i => assert.equal(d.history.has(i), false));
  assert.deepEqual(d.record().cycles.small.seen, [d.context.DATA.qs[third.indices[0]][8]]);
  const next = d.reserve([0]); assert.ok(!next.indices.includes(third.indices[0]));
});
test('cycling one category leaves other categories, their recency and native records unchanged', () => {
  const d = device(); const other = exhaustion(d, 1); d.show(other.third.indices);
  const before = d.record(), nativeBefore = d.storage.get('kunuz_seen_v1');
  exhaustion(d, 0);
  const after = d.record();
  assert.deepEqual(after.cycles.other, before.cycles.other);
  d.rows(1).forEach(i => {
    const id = d.context.DATA.qs[i][8]; assert.equal(after.order[id], before.order[id]);
    assert.equal(d.history.has(i), other.third.indices.includes(i));
  });
  assert.ok(nativeBefore); assert.ok(d.storage.get('kunuz_seen_v1'));
});
test('the existing device-local identity keeps two players or devices independent', () => {
  const a = device(), b = device(); exhaustion(b, 1);
  const before = [...b.storage]; exhaustion(a, 0);
  assert.deepEqual([...b.storage], before);
  assert.equal(b.rows(0).filter(i => b.history.has(i)).length, 0);
  assert.equal(a.rows(1).filter(i => a.history.has(i)).length, 0);
});
test('recency and category cycles survive page changes and reloads on the same device', () => {
  const a = device(); const { third } = exhaustion(a, 0); a.show(third.indices);
  const b = device(a.storage); b.history.read();
  a.rows(0).forEach(i => { assert.equal(b.history.has(i), a.history.has(i)); assert.equal(b.history.last(i), a.history.last(i)); });
  const next = b.reserve([0]); next.indices.forEach(i => assert.equal(third.indices.includes(i), false));
});
test('a fully seen bank restarts only selected categories instead of wiping all history', () => {
  const d = device(); d.show(d.rows(0).concat(d.rows(1)));
  const otherOrder = d.rows(1).map(i => d.history.last(i));
  const p = d.reserve([0]); assert.equal(p.indices.length, 6); assert.deepEqual([...p.restarts], [0]);
  d.rows(1).forEach((i, n) => { assert.equal(d.history.has(i), true); assert.equal(d.history.last(i), otherOrder[n]); });
  assert.equal(d.record().cycles.other, undefined);
});
test('legacy history has deterministic oldest ties, preserves held rows and existing storage bytes', () => {
  const d = device(); d.rows(0).forEach(i => d.context.seenMark(i));
  const nativeBefore = d.storage.get('kunuz_seen_v1'), p = d.reserve([0]);
  assert.deepEqual([...p.indices], [0, 1, 2, 3, 4, 5]);
  assert.equal(d.storage.get('kunuz_seen_v1'), nativeBefore);
  assert.ok(p.indices.every(i => d.model.live(i))); assert.equal(p.shortage.length, 0);
});
test('two per level and nearest fallback remain intact within the selected reservation', () => {
  const d = device(), p = d.reserve([0]);
  for (const level of [1, 2, 3]) assert.equal(p.slots.filter(s => s.actual === level).length, 2);
  d.context.DATA.qs.forEach(q => { d.context.KUNUZ_LEVELS.levels[q[8]] = 1; });
  const fallback = d.reserve([0]); assert.equal(fallback.indices.length, 6); assert.equal(fallback.fallback[0].missing, 4);
});
test('a category with fewer than six playable rows is the only genuine reservation shortage', () => {
  const d = device(); d.context.DATA.qs.slice(0, 9).forEach(q => { q[2] = 0; });
  const p = d.reserve([0]); assert.deepEqual([...p.shortage], [0]); assert.equal(p.indices.length, 0);
  assert.equal(d.storage.get(cycleKey), undefined);
});
test('storage denial retains safe in-memory cycles and uniqueness', () => {
  const d = device(new Map(), true);
  for (let game = 0; game < 6; game++) play(d, 0);
  assert.equal(d.storage.size, 0);
});
