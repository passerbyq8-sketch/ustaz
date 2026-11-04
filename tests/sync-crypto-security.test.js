import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadKeys, seal, open } from '../lib/sync/crypto.js';
const environment = { SYNC_ENC_KEY: crypto.randomBytes(32).toString('hex') };
const keys = loadKeys(environment);
const value = { text: '\u0645\u0631\u062d\u0628\u0627', counter: 3 };
const envelope = JSON.parse(seal(keys, 'fixture', 'space', 'kv:one', value));
const decrypt = e => open(keys, 'fixture', 'space', 'kv:one', e);

test('every truncated GCM tag is rejected', () => {
  for (let length = 0; length < 16; length++) {
    const tag = Buffer.from(envelope.t, 'base64').subarray(0, length).toString('base64');
    assert.throws(() => decrypt({ ...envelope, t: tag }), 'accepted tag length ' + length);
  }
});
test('invalid base64 and noncanonical envelope fields are rejected', () => {
  for (const field of ['i', 't', 'c']) {
    for (const bad of [null, 7, {}, '', envelope[field] + '\n', envelope[field] + '!', envelope[field].replace(/=+$/, '')]) {
      if (bad === envelope[field]) continue;
      assert.throws(() => decrypt({ ...envelope, [field]: bad }), 'accepted malformed ' + field);
    }
  }
  for (const length of [0, 8, 11, 13, 16]) assert.throws(() => decrypt({ ...envelope, i: Buffer.alloc(length).toString('base64') }));
});
test('valid legacy envelopes, AAD isolation, key rotation and tamper checks remain intact', () => {
  assert.deepEqual(decrypt(JSON.stringify(envelope)), value);
  const rotated = loadKeys({ SYNC_ENC_KEY: crypto.randomBytes(32).toString('hex'), SYNC_ENC_KEY_PREV: environment.SYNC_ENC_KEY });
  assert.deepEqual(open(rotated, 'fixture', 'space', 'kv:one', envelope), value);
  for (const args of [['other', 'space', 'kv:one'], ['fixture', 'other', 'kv:one'], ['fixture', 'space', 'kv:two']]) assert.throws(() => open(keys, ...args, envelope));
  const tampered = Buffer.from(envelope.c, 'base64'); tampered[0] ^= 1;
  assert.throws(() => decrypt({ ...envelope, c: tampered.toString('base64') }));
  assert.throws(() => decrypt({ ...envelope, s: 2 }));
  assert.throws(() => decrypt({ ...envelope, k: 'unknown' }));
});
