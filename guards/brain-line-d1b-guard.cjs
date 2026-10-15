// guards/brain-line-d1b-guard.cjs -- ITEM D1-B (136) -- 2026-10-15 brain-line
//
// MARFU' AND MAWQUF. Measured on 7ba44481 (side-brain-line-2026-10-15/side/t136.md, witness/136.md 06.md:41): «يا أهل
// مكة: لا تقصروا الصلاة في أدنى من أربعة برد…» -- established as Ibn Abbas's words -- went out under «أن النبي صلى الله
// عليه وسلم قال» with a bracket.
//
// What this guard holds (the order, D1-B, first half): when every atom that carries the matn gives it to a Companion
// («عن/قال <him>» with no «رسول الله/النبي» before it), a matn the prose ascribes to the Prophet ﷺ is NOT sourced
// (declined mawquf_as_marfu), and the sentence is removed (the owner's ruling of 25 September). An atom that gives
// the matn to the Prophet ﷺ still sources it.
// NOT HELD HERE (report §8): the second half -- prose that credits the Companion getting «(… · موقوف على <الاسم>)»
// -- needs the pass to target a Companion-framed quote, which findTargets does not do.
//
// Fixtures: WP06:41 verbatim from witness/136.md (06.md:41), its saved bracket «(البيهقي · لم يوقف على حكم)» taken off
// first (that bracket is the server's from the run being measured); the atoms are COMPOSED (al-Bayhaqi, FC-000760).
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

// witness/136.md (06.md:41), the run's own bracket removed
const WP06_41 = 'واستدلوا بأن النبي صلى الله عليه وسلم قال: «يا أهل مكة: لا تقصروا الصلاة في أدنى من أربعة برد، من مكة إلى عسفان» (البيهقي · لم يوقف على حكم)، ولأن ابن عمر وابن عباس كانا يقصران ويفطران في أربعة برد فما فوقها، ولا يعرف لهما مخالف، وأسنده البيهقي بسند صحيح، ومثل هذا لا يكون إلا عن توقيف، وعلقه البخاري بصيغة الجزم.'
  .replace(' (البيهقي · لم يوقف على حكم)', '');
const MAWQUF_ATOM = 'أخبرنا أبو عبد الله الحافظ ثنا عطاء عن ابن عباس قال: يا أهل مكة لا تقصروا الصلاة في أدنى من أربعة برد من مكة إلى عسفان';
const MARFU_ATOM = 'أخبرنا أبو عبد الله الحافظ ثنا عطاء عن ابن عباس قال: قال رسول الله صلى الله عليه وسلم: يا أهل مكة لا تقصروا الصلاة في أدنى من أربعة برد من مكة إلى عسفان';
const lookupWith = (atom) => async (matns) => matns.map((matn) => ({ matn, subjectIds: ['FC-000760'], atoms: [atom] }));

(async () => {
  const TK = await esm('lib/takhrij.js');
  const PC = await esm('lib/prophetic-claims.js');
  ok('lib/takhrij.js exports mawqufNarrator', typeof TK.mawqufNarrator === 'function');
  if (typeof TK.mawqufNarrator === 'function') {
    ok('the mawquf atom gives the matn to Ibn Abbas', TK.mawqufNarrator(MAWQUF_ATOM, 'يا أهل مكة: لا تقصروا الصلاة في أدنى من أربعة برد') === TK.foldArabic('ابن عباس'));
    ok('the marfu\' atom gives it to nobody but the Prophet ﷺ', TK.mawqufNarrator(MARFU_ATOM, 'يا أهل مكة: لا تقصروا الصلاة في أدنى من أربعة برد') === '');
  }
  const run = async (atom) => {
    const pass = await TK.applyTakhrij(WP06_41, { env: { TAKHRIJ_V1: 'on' }, lookup: lookupWith(atom) });
    return { pass, text: PC.dropUnconfirmedProphetic(pass.text, pass.entries).text };
  };
  {
    const r = await run(MAWQUF_ATOM);
    const e = r.pass.entries[0] || {};
    ok('WP06:41 on the mawquf atom: not sourced, declined mawquf_as_marfu', e.sourced === false && e.declined === 'mawquf_as_marfu', JSON.stringify(e));
    ok('...and the sentence is removed (no «يا أهل مكة», no bracket)', !r.text.includes('يا أهل مكة') && !r.text.includes('(البيهقي'), JSON.stringify(r.text));
  }
  {
    const r = await run(MARFU_ATOM);
    const e = r.pass.entries[0] || {};
    ok('the same prose on a marfu\' atom: sourced, bracket written', e.sourced === true && r.text.includes('يا أهل مكة') && r.text.includes('(البيهقي'), JSON.stringify({ e, text: r.text }));
  }
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-d1b: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
