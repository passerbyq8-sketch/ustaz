import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { turn, ROW } from '../tools/qaf-gap/turn-harness.mjs';
import { createBw2Wire } from '../lib/before-writing-v2.js';

test('the returned source titles reach the real status frame', async () => {
  const frames = [];
  const wire = createBw2Wire({ write: (s) => { frames.push(JSON.parse(s.slice(6))); return true; },
    armEarlyRelease: () => true, end: () => true });
  await turn({ extra: { wire }, text: '' });
  const frame = frames.find((f) => f.type === 'ezik_status' && f.stage === 'fatwa');
  assert.deepEqual(frame.titles, [ROW.title]);
  console.log('QAF_GAP4_SOURCE ' + JSON.stringify(frame));
});

test('the actual client status helper displays three titles and the remainder', () => {
  const app = fs.readFileSync(new URL('../app.jsx', import.meta.url), 'utf8');
  const code = app.slice(app.indexOf('const EZIK_READING_STAGES ='), app.indexOf('\nfunction EzikLiveOffer'));
  const ctx = vm.createContext({ ezT: (key, p) => key === 'x.661' ? 'يقرأ في: ' + p.titles : key,
    toArabicDigits: String });
  vm.runInContext(code + '\nthis.status = ezikReadingStatus;', ctx);
  assert.equal(ctx.status({ stage: 'library', titles: ['فتاوى ابن باز', 'المغني', 'الأم', 'المجموع', 'الأم'] }),
    'يقرأ في: فتاوى ابن باز · المغني · الأم +1');
  assert.equal(ctx.status({ stage: 'general' }), 'x.256');
});
