// guards/brain-line-b3-guard.cjs -- ITEM B3 (m0 row 8) -- 2026-10-15 brain-line
//
// THE QUESTION GATE IN THE LANGUAGES. Measured on 7ba44481 (side-brain-line-2026-10-15, items/74-m0.md
// row 8; side/anchors-m0.md): «تراویح کی رکعات» with the key language ur was read as fa; «نماز جمعه» with
// ur as ar; a message carrying an image or a PDF beside its text had its whole content replaced by the
// translation of "null"; an assistant reply was translated again as if the reader had written it; and a
// failed translation had already spent the reader's question of the day.
//
// Contract (the order, B3):
//   (1) non-text blocks pass as they are; only the text is translated.
//   (2) only `user` messages are translated; an assistant reply stays as it is.
//   (3) a failed question translation does not spend the day: the cap is refunded (decremented) for it.
//   (4) shared marks with no letter of their own (ی ک, or none at all with no Arabic-only sign) -> the
//       key language x-ezik-lang decides.
//
// Fixtures: «تراویح کی رکعات» and «نماز جمعه» -- EZIK-CC-SIDE-BRAIN-FIX-DIRECTIVE-2026-10-15.md:108
// (and side-brain-line-2026-10-15/items/74-m0.md:115). The English text and the image block are COMPOSED.
'use strict';
const fs = require('fs');
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

(async () => {
  const Q = await esm('lib/lang/question.js');
  const D = await esm('lib/lang/detect.js');
  const DC = await esm('lib/daycap.js');

  console.log('-- 1. an image beside the text: the image stays, the text is translated');
  {
    const IMG = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
    const messages = [{ role: 'user', content: [IMG, { type: 'text', text: 'What does this verse mean?' }] }];
    let sent = null;
    const translate = async ({ user }) => { sent = JSON.parse(user); return { ok: true, text: JSON.stringify(sent.map((s) => 'AR<' + s + '>')) }; };
    const r = await Q.translateQuestionInPlace(messages, { lang: 'en', translate, hedgeMs: 5 });
    const c = messages[0].content;
    ok('the translation succeeds', r.ok === true, JSON.stringify(r));
    ok('the translator was never handed "null"', Array.isArray(sent) && !sent.includes('null') && sent.includes('What does this verse mean?'), JSON.stringify(sent));
    ok('the image block is still there, byte for byte', Array.isArray(c) && c.some((b) => b && b.type === 'image' && b.source && b.source.data === IMG.source.data), JSON.stringify(c).slice(0, 200));
    ok('the text block now holds the translation', Array.isArray(c) && c.some((b) => b && b.type === 'text' && b.text === 'AR<What does this verse mean?>'), JSON.stringify(c).slice(0, 200));
  }

  console.log('-- 2. only user messages are translated');
  {
    const messages = [
      { role: 'user', content: 'What is the ruling on fasting while travelling?' },
      { role: 'assistant', content: 'The traveller may break his fast and make it up later, and fasting is valid if he does it.' },
      { role: 'user', content: 'And what about a short trip of one day?' },
    ];
    let sent = null;
    const translate = async ({ user }) => { sent = JSON.parse(user); return { ok: true, text: JSON.stringify(sent.map((s) => 'AR<' + s + '>')) }; };
    await Q.translateQuestionInPlace(messages, { lang: 'en', translate, hedgeMs: 5 });
    ok('the assistant reply was not sent to the translator', Array.isArray(sent) && !sent.some((s) => s.startsWith('The traveller')), JSON.stringify(sent));
    ok('the assistant reply stands as it was', messages[1].content.startsWith('The traveller'), messages[1].content.slice(0, 40));
    ok('both user messages were translated', messages[0].content.startsWith('AR<') && messages[2].content.startsWith('AR<'));
  }

  console.log('-- 3. a failed translation does not spend the day');
  {
    ok('lib/daycap.js exports refundDayCap', typeof DC.refundDayCap === 'function');
    const store = new Map();
    const fake = {
      mget: async (...ks) => ks.map((k) => (store.has(k) ? String(store.get(k)) : null)),
      pipeline() { const ops = []; const p = { incr: (k) => { ops.push(['incr', k]); return p; }, decr: (k) => { ops.push(['decr', k]); return p; }, expire: (k) => { ops.push(['expire', k]); return p; }, exec: async () => ops.map(([op, k]) => { if (op === 'incr') { store.set(k, (store.get(k) || 0) + 1); return store.get(k); } if (op === 'decr') { store.set(k, (store.get(k) || 0) - 1); return store.get(k); } return 1; }) }; return p; },
      incr: async (k) => { store.set(k, (store.get(k) || 0) + 1); return store.get(k); },
      decr: async (k) => { store.set(k, (store.get(k) || 0) - 1); return store.get(k); },
    };
    DC.__setRedisForTest(fake);
    const before = await DC.checkDayCap({ deviceId: 'dev-b3-guard-0001', cookieId: 'cookie-b3-guard-0001' });
    const counts1 = [...store.values()];
    if (typeof DC.refundDayCap === 'function') await DC.refundDayCap(before);
    const counts2 = [...store.values()];
    ok('the question was counted once', before.allowed === true && counts1.length >= 1 && counts1.every((n) => n === 1), JSON.stringify(counts1));
    ok('and the refund returns every counter to where it was', counts2.length >= 1 && counts2.every((n) => n === 0), JSON.stringify(counts2));
    const askSrc = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
    ok('api/ask.js refunds the cap when the question translation fails', /if \(typeof req\.__langTranslateQuestion === 'function' && !\(await req\.__langTranslateQuestion\(body\.messages\)\)\) \{\s*await refundDayCap\(cap\);\s*return;\s*\}/.test(askSrc));
    DC.__setRedisForTest(null);
  }

  console.log('-- 4. shared marks: the key language decides');
  ok('«تراویح کی رکعات» with key ur -> ur', D.detectQuestionLang('تراویح کی رکعات', 'ur') === 'ur', D.detectQuestionLang('تراویح کی رکعات', 'ur'));
  ok('«نماز جمعه» with key ur -> ur', D.detectQuestionLang('نماز جمعه', 'ur') === 'ur', D.detectQuestionLang('نماز جمعه', 'ur'));
  ok('«تراویح کی رکعات» with key fa stays fa', D.detectQuestionLang('تراویح کی رکعات', 'fa') === 'fa');
  ok('an Arabic question with key ur stays ar (ة / ال)', D.detectQuestionLang('ما حكم صلاة الجمعة للمسافر؟', 'ur') === 'ar');
  ok('an Urdu letter still decides ur whatever the key', D.detectQuestionLang('نماز کیسے پڑھیں', 'fa') === 'ur');

  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-b3: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
