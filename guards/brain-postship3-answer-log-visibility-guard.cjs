'use strict';
const path = require('path');
const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const req = () => ({ method: 'POST', body: { messages: [{ role: 'user', content: 'QUESTION_SECRET' }] } });
const res = () => ({ write() { return true; }, end() { return true; } });

(async () => {
  const AL = await esm('lib/answer-log.js');
  const badIndexStore = {
    async setex() { return true; },
    async lpushCapped() { return false; },
  };
  const indexResult = await AL.writeAnswerLog({ trace: 'trace-p3', day: '20261027' }, { store: badIndexStore });
  ok('an index refusal is reported as a failed answer-log write', indexResult === false);

  const line = typeof AL.answerLogFailureLine === 'function'
    ? AL.answerLogFailureLine({ trace: 'trace-p3', question: 'QUESTION_SECRET', answer: 'ANSWER_SECRET' }) : '';
  ok('failure line contains only its fixed tag and safe trace',
    line.length > 0 && line === '[answer-log] write_failed trace=trace-p3'
      && !line.includes('QUESTION_SECRET') && !line.includes('ANSWER_SECRET'));

  const originalWarn = console.warn;
  let failedWarnings = [];
  let failedReturn = null;
  try {
    console.warn = (value) => failedWarnings.push(String(value));
    failedReturn = await AL.withAnswerLog(req(), res(), async () => 'answer-ok', () => ({ lang: 'ar' }), {
      store: { async setex() { return false; }, async lpushCapped() { return true; } },
    });
  } finally { console.warn = originalWarn; }
  ok('a record-store refusal is logged and does not fail the answer',
    failedReturn === 'answer-ok' && failedWarnings.length === 1
      && /^\[answer-log\] write_failed trace=[0-9a-f]{16}$/.test(failedWarnings[0])
      && !failedWarnings[0].includes('QUESTION_SECRET') && !failedWarnings[0].includes('ANSWER_SECRET'));

  let indexWarnings = [];
  let indexReturn = null;
  try {
    console.warn = (value) => indexWarnings.push(String(value));
    indexReturn = await AL.withAnswerLog(req(), res(), async () => 'answer-ok', () => ({ lang: 'ar' }), {
      store: { async setex() { return true; }, async lpushCapped() { return false; } },
    });
  } finally { console.warn = originalWarn; }
  ok('an index refusal is logged and does not fail the answer',
    indexReturn === 'answer-ok' && indexWarnings.length === 1
      && /^\[answer-log\] write_failed trace=[0-9a-f]{16}$/.test(indexWarnings[0]));

  let successWarnings = [];
  let successReturn = null;
  try {
    console.warn = (value) => successWarnings.push(String(value));
    successReturn = await AL.withAnswerLog(req(), res(), async () => 'answer-ok', () => ({ lang: 'ar' }), {
      store: { async setex() { return true; }, async lpushCapped() { return true; } },
    });
  } finally { console.warn = originalWarn; }
  ok('a successful record and index do not emit a failure line',
    successReturn === 'answer-ok' && successWarnings.length === 0);

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
