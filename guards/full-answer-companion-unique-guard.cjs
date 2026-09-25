// guards/full-answer-companion-unique-guard.cjs -- ج٤ (order C, FULL_ANSWER_V1): the owner's rule on a hadith
// whose opening others share. «لا يُسمّى صحابيٌّ إلّا إذا لم يطابقِ المقطعُ الذي اقتبسَه القارئُ في المكتبةِ إلّا
// حديثًا واحدًا — فإن طابقَ حديثين أو أكثرَ برواةٍ مختلفين لم يُسمَّ أحد. والقوسُ ومطابقتُه القائمةُ لا يُمَسّان.»
//
// MEASURED (report B §6.1 row 8; again on 88c5a75 against lib-preview, program-2026-09-24/10-order-c/c4/measure):
// the Jibril opening «بينما نحن عند رسول الله ﷺ ذات يوم» is carried by atoms of five different hadiths — ʿUmar's
// (Muslim), Abū Saʿīd's (al-Bukhārī 3610, with the prayer), Zayd b. Thābit's (Aḥmad), Abū Hurayra's… — and B2 named
// Abū Saʿīd, the one atom that prints the prayer next to the Prophet ﷺ.
//
// WHAT THIS PINS (the real applyTakhrij, the library answered in-process with atoms shaped on the measured ones):
//   U1  the witness: the Jibril opening names no Companion, and says why (TAKHRIJ_COMPANION_MANY_HADITHS);
//   U2  ...and its parentheses are exactly what they were: the match behind them is not touched;
//   U3  one hadith in two books, one man with the prayer in one and without it in the other: named, as before;
//   U4  one man written two ways («ابن عمر» / «عبد الله بن عمر رضي الله عنهما»): named, as before;
//   U5  one wording narrated by two Companions (Abū Hurayra, Abū Shurayḥ): nobody is named — the rule's letter;
//   U6  a kinship word («عن أبيه») names nobody and is not counted as a second man: named, as before;
//   U7  the switch off: the text is byte for byte what it was;
//   U8  B2's own man is always one of the men counted; U9 a dashed salutation and a page mark do not hide a
//       man; U10 a short name («عبد الله») never joins two men; U11 one man under three nisbas is one man;
//   U12 a kunya with the ism beside it is one man (U8-U12 answer the order-C review of this item).
// Red on the tree before this item (88c5a75): `node guards/full-answer-companion-unique-guard.cjs --root <tree>`.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 600) : ''));
  return false;
}
globalThis.fetch = async () => { throw new Error('this guard makes no network call'); };

const P = 'صلى الله عليه وسلم';
const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
const OFF = { TAKHRIJ_V1: 'on' };
const draft = (matn) => `قال رسول الله ${P}: «${matn}».`;
const lib = (matn, ids, atoms) => async (ms) => ms.map((m) => (m === matn ? { matn: m, subjectIds: ids, atoms } : { matn: m, subjectIds: [], atoms: [] }));
const prayers = (s) => (String(s).match(/رضي الله عن/gu) || []).length;

// The witness, and the shapes of its atoms on lib-preview (Muslim 8, al-Bukhārī 3610, Aḥmad 21606).
const J = 'بينما نحن عند رسول الله صلى الله عليه وسلم ذات يوم';
const J_MUSLIM = `حدثني أبو خيثمة زهير بن حرب، حدثنا وكيع، عن كهمس، عن عبد الله بن بريدة، عن يحيى بن يعمر، ثم قال: حدثني أبي عمر بن الخطاب قال: ${J}، إذ طلع علينا رجل شديد بياض الثياب`;
const J_BUKHARI = `حدثنا أبو اليمان، أخبرنا شعيب، عن الزهري، قال: أخبرني أبو سلمة بن عبد الرحمن، أن أبا سعيد الخدري رضي الله عنه، قال: ${J} وهو يقسم قسما، أتاه ذو الخويصرة`;
const J_AHMAD = `حدثنا حسن، حدثنا ابن لهيعة، حدثنا يزيد بن أبي حبيب، عن ابن شماسة، عن زيد بن ثابت، قال: ${J} حين قال: «طوبى للشام»`;
// One hadith: «إنما الأعمال بالنيات».
const M = 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى';
const M_BUKHARI = `حدثنا الحميدي عن علقمة قال: سمعت عمر بن الخطاب رضي الله عنه يقول: سمعت رسول الله ${P} يقول: «${M}»`;
const M_MUSLIM = `حدثنا عبد الله بن مسلمة عن علقمة بن وقاص عن عمر بن الخطاب قال: قال رسول الله ${P}: «${M}»`;
// One man, two spellings.
const G = 'كن في الدنيا كأنك غريب أو عابر سبيل';
const G_BUKHARI = `حدثنا علي بن عبد الله عن مجاهد عن عبد الله بن عمر رضي الله عنهما أن رسول الله ${P} قال: «${G}»`;
const G_TIRMIDHI = `حدثنا محمود بن غيلان عن مجاهد عن ابن عمر قال: قال رسول الله ${P}: «${G}»`;
// One wording, two Companions.
const Y = 'من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت';
const Y_ABU_HURAYRA = `حدثنا قتيبة عن أبي صالح عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «${Y}»`;
const Y_ABU_SHURAYH = `حدثنا عبد الله بن يوسف عن سعيد المقبري عن أبي شريح العدوي قال: سمعت رسول الله ${P} يقول: «${Y}»`;
// A kinship link.
const K = 'الدين النصيحة لله ولكتابه ولرسوله';
const K_ONE = `حدثنا قتيبة عن الأعرج عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «${K}»`;
const K_KIN = `حدثنا يزيد عن سهيل بن أبي صالح عن أبيه قال: قال رسول الله ${P}: «${K}»`;

async function main() {
  console.log('full-answer-companion-unique guard — root ' + REPO);
  let T = null;
  try { T = await import(pathToFileURL(path.join(REPO, 'lib/takhrij.js')).href); } catch (e) { ok('U0  lib/takhrij.js loads', false, e.message); }
  if (!T) { console.log(`\n=== full-answer-companion-unique: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  const run = (matn, env, ids, atoms) => T.applyTakhrij(draft(matn), { env, lookup: lib(matn, ids, atoms) });
  const entry = (r) => (r.entries || [])[0] || {};

  const u1 = await run(J, ON, ['FC-000648', 'FC-000645', 'FC-000630'], [J_MUSLIM, J_BUKHARI, J_AHMAD]);
  ok('U1  the Jibril opening, carried by three men\'s hadiths, names no Companion, and says why',
    prayers(u1.text) === 0 && entry(u1).companion === '' && (u1.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'),
    JSON.stringify([u1.text, u1.problems]));
  // D3A H1: narration frame corrected; this U2 still pins its pre-H2 bracket.
  // The parentheses are the pass's own: the same books, the same ruling, as the pass wrote them for the same
  // atoms before this item — read here off the parentheses in the text, which this item never writes.
  ok('U2  ...and its parentheses are untouched: «(متفق عليه)» off the same match',
    entry(u1).parenthetical === 'متفق عليه' && u1.text === `ورد في الرواية: «${J}» (متفق عليه).`,
    JSON.stringify([u1.text, entry(u1).parenthetical]));

  const u3 = await run(M, ON, ['FC-000645', 'FC-000648'], [M_BUKHARI, M_MUSLIM]);
  ok('U3  one hadith in two books, one man (the prayer in one book only): named, as before',
    u3.text === `عن عمر بن الخطاب رضي الله عنه: «${M}» (متفق عليه).`, u3.text);

  const u4 = await run(G, ON, ['FC-000645', 'FC-000658'], [G_BUKHARI, G_TIRMIDHI]);
  ok('U4  one man written two ways («عبد الله بن عمر» / «ابن عمر»): named, as before',
    entry(u4).companion === 'عبد الله بن عمر' && !(u4.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), u4.text);

  const u5 = await run(Y, ON, ['FC-000645', 'FC-000648'], [Y_ABU_HURAYRA, Y_ABU_SHURAYH]);
  ok('U5  one wording narrated by two Companions: nobody is named (the rule\'s letter)',
    prayers(u5.text) === 0 && entry(u5).companion === '' && (u5.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'),
    JSON.stringify([u5.text, u5.problems]));

  const u6 = await run(K, ON, ['FC-000645', 'FC-000648'], [K_ONE, K_KIN]);
  ok('U6  a kinship link («عن أبيه») names nobody and is not a second man: named, as before',
    entry(u6).companion === 'أبي هريرة' && !(u6.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), u6.text);

  // ── U8–U12 the order-C review of this item ─────────────────────────────────────────────────────
  // U8 B2's own man is one of the men counted: Abū Saʿīd's atom with an aside after his prayer (the shape of
  // al-Bukhārī 1197), which the reading without the prayer cannot see, beside ʿUmar's in Muslim.
  const J_ASIDE = `حدثنا حفص بن عمر، حدثنا شعبة، عن عبد الملك، عن قزعة، أن أبا سعيد الخدري رضي الله عنه، وكان غزا مع النبي ${P} ثنتي عشرة غزوة، قال: ${J} يقسم`;
  const u8 = await run(J, ON, ['FC-000648', 'FC-000645'], [J_MUSLIM, J_ASIDE]);
  ok('U8  B2\'s own man is counted: Abū Saʿīd (named by his book) beside ʿUmar is two men, and nobody is named',
    prayers(u8.text) === 0 && (u8.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), JSON.stringify([u8.text, u8.problems]));
  // U9 a print's typography does not hide a man: «- صلى الله عليه وسلم -» and «[ص: 88]».
  const J_DASH = `حدثنا حسن، حدثنا ابن لهيعة، عن ابن شماسة، عن زيد بن ثابت، [ص: 88] قال: قال رسول الله - صلى الله عليه وسلم -: «${M}»`;
  const u9 = await run(M, ON, ['FC-000645', 'FC-000630'], [M_BUKHARI, J_DASH]);
  ok('U9  a dashed salutation and a page mark do not hide Zayd b. Thābit: two men, nobody named',
    prayers(u9.text) === 0 && (u9.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), JSON.stringify([u9.text, u9.problems]));
  // U10 a short name never joins two men into one: «عبد الله» beside Ibn ʿUmar and Ibn ʿAbbās.
  const G_ABBAS = `حدثنا مسدد عن عكرمة عن ابن عباس قال: قال رسول الله ${P}: «${G}»`;
  const G_ABDALLAH = `حدثنا أبو معاوية عن مسروق عن عبد الله، قال: قال رسول الله ${P}: «${G}»`;
  const u10 = await run(G, ON, ['FC-000645', 'FC-000648', 'FC-000637'], [G_BUKHARI, G_ABBAS, G_ABDALLAH]);
  ok('U10 «عبد الله» beside «ابن عمر» and «ابن عباس» joins neither: two men, nobody named',
    entry(u10).companion === '' && (u10.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), JSON.stringify([u10.text, u10.problems]));
  // U11 one man under three nisbas is one man: Abū Shurayḥ العدوي / الخزاعي / الكعبي.
  const S = 'من كان يؤمن بالله واليوم الآخر فليكرم ضيفه جائزته';
  const S_BUKHARI = `حدثنا عبد الله بن يوسف عن سعيد المقبري عن أبي شريح العدوي رضي الله عنه قال: سمعت رسول الله ${P} يقول: «${S}»`;
  const S_MUSLIM = `حدثنا قتيبة عن سعيد بن أبي سعيد عن أبي شريح الخزاعي قال: قال رسول الله ${P}: «${S}»`;
  const S_HIBBAN = `أخبرنا عمر بن محمد عن سعيد عن أبي شريح الكعبي قال: قال رسول الله ${P}: «${S}»`;
  const u11 = await run(S, ON, ['FC-000645', 'FC-000648', 'FC-000703'], [S_BUKHARI, S_MUSLIM, S_HIBBAN]);
  ok('U11 one man under three nisbas («العدوي / الخزاعي / الكعبي») is one man: named, as before',
    /أبي شريح العدوي رضي الله عنه/u.test(u11.text) && !(u11.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), u11.text);
  // U12 a kunya with the ism beside it is one man: «عقبة بن عمرو أبي مسعود» / «أبي مسعود».
  const Q = 'إن مما أدرك الناس من كلام النبوة الأولى إذا لم تستح فاصنع ما شئت';
  const Q_BUKHARI = `حدثنا أحمد بن يونس عن ربعي بن حراش عن أبي مسعود رضي الله عنه قال: قال النبي ${P}: «${Q}»`;
  const Q_MAJAH = `حدثنا عمرو بن رافع عن ربعي بن حراش عن عقبة بن عمرو أبي مسعود، قال: قال رسول الله - صلى الله عليه وسلم -: «${Q}»`;
  const u12 = await run(Q, ON, ['FC-000645', 'FC-000653'], [Q_BUKHARI, Q_MAJAH]);
  ok('U12 a kunya with the ism beside it («عقبة بن عمرو أبي مسعود» / «أبي مسعود») is one man: named, as before',
    /عن أبي مسعود رضي الله عنه/u.test(u12.text) && !(u12.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS'), u12.text);

  const u7 = await run(J, OFF, ['FC-000648', 'FC-000645', 'FC-000630'], [J_MUSLIM, J_BUKHARI, J_AHMAD]);
  const u7b = await run(Y, OFF, ['FC-000645', 'FC-000648'], [Y_ABU_HURAYRA, Y_ABU_SHURAYH]);
  ok('U7  the switch off: nothing of this item runs (no new problem code; the two-book rule as it was)',
    !(u7.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS') && !(u7b.problems || []).includes('TAKHRIJ_COMPANION_MANY_HADITHS')
    && (u7.problems || []).includes('TAKHRIJ_COMPANION_UNCONFIRMED'),
    JSON.stringify([u7.text, u7.problems, u7b.text, u7b.problems]));

  console.log(`\n=== full-answer-companion-unique: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
