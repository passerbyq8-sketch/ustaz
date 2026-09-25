// guards/full-answer-companion-guard.cjs -- ب٢ (order B, FULL_ANSWER_V1): the owner's ruling of 25 September
// on naming the Companion. «يُسمّى الراوي الذي يلي النبيَّ ﷺ حينَ يذكرُه نصُّ الكتابِ المسترجَعِ نفسُه
// مقرونًا بـ«رضي الله عنه» أو «عنها» أو «عنهما» أو «عنهم»، ولا يُسمّى في غيرِ ذلك، ولا تسميةَ من حفظِ النموذج.»
//
// MEASURED on c00e8f5 (program-2026-09-24/09-order-b/b2/measure/B2-MEASURE.md): the takhrij pass named a
// Companion only when two ladder rows agreed, and named 0 of 146 saved matns; `companionFrom` read the last
// prayer-bearing name before the matn, not the man next to the Prophet ﷺ, so a mursal after a Companion's
// narration borrowed that Companion; and nothing touched a Companion the MODEL wrote.
//
// WHAT THIS PINS (the real applyTakhrij, with the library answered in-process):
//   G1        the owner's fixture: a mursal from a Tabiʿi without «رضي الله عنه» names no Companion;
//   G1b/G1c   ...nor when an earlier narration's Companion stands in the same atom (red before);
//   G2        one book, the man next to the Prophet ﷺ, with the prayer: named (red before);
//   G3        a prayer on a man who is NOT next to the Prophet ﷺ names nobody;
//   G4-G6     the model's own «عن X رضي الله عنه»: removed; the book's name, once; never two openers;
//   G7        a lead-in with no verb keeps its salutation and gets the parentheses alone;
//   G8-G10    the genitive; two different books' Companions name neither; kinship names nobody;
//   G11       the two frame-safe model shapes are cut; an addressee and a story are not touched;
//   G12       the switch off: today's text, byte for byte; G13 nothing before the matn's sentence moves;
//   G14       «قال أبو حاتم رضي الله عنه» (the author, Ibn Hibban) names nobody;
//   G15       a matn that opens on the Prophet ﷺ; G16 the book the parentheses name, not another book's;
//   G17       a lead-in that points back at the narrator («قال له») keeps the model's name, and says so;
//   M1-M3     three mutants of lib/takhrij.js are killed: no adjacency, the «قال» anchor, any book.
// Red on the tree before this item (64f458c): `node guards/full-answer-companion-guard.cjs --root <tree>`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const LIB = path.join(REPO, 'lib', 'takhrij.js');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}
globalThis.fetch = async () => { throw new Error('this guard makes no network call'); };

const P = 'صلى الله عليه وسلم';
const M = 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى';
const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
const OFF = { TAKHRIJ_V1: 'on' };
const plain = `قال رسول الله ${P}: «${M}».`;
const UMAR = `حدثنا الحميدي عن علقمة قال: سمعت عمر بن الخطاب رضي الله عنه يقول: سمعت رسول الله ${P} يقول: «${M}»`;
const MURSAL = `حدثني مالك عن يحيى بن سعيد عن سعيد بن المسيب قال: قال رسول الله ${P}: «${M}»`;
const MURSAL_AFTER = `حدثنا قتيبة عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «الدين النصيحة». وحدثنا مالك عن سعيد بن المسيب قال: قال رسول الله ${P}: «${M}»`;
const RAHIMAHU_AFTER = `عن أنس رضي الله عنه قال: قال رسول الله ${P}: «الدين النصيحة». وعن الحسن البصري رحمه الله قال: قال رسول الله ${P}: «${M}»`;
const NOT_ADJ = `حدثنا عكرمة عن ابن عباس رضي الله عنهما عن عمر قال: قال رسول الله ${P}: «${M}»`;
const NOT_ADJ2 = `حدثنا كريب عن ابن عباس رضي الله عنهما، عن ميمونة أن النبي ${P} قال: «${M}»`;
const KIN = `عن عروة بن المغيرة عن أبيه رضي الله عنه قال: قال رسول الله ${P}: «${M}»`;
const ABA = `حدثنا سعيد قال: سمعت أبا هريرة رضي الله عنه يقول: قال رسول الله ${P}: «${M}»`;
const ABI = `حدثنا الأعرج عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «${M}»`;
const IBN_HIBBAN = `رقم طبعة با وزير = (2128) قال أبو حاتم رضي الله عنه: قوله ${P}: «${M}» لفظة أمر تشتمل على كل شيء كان يستعمله ${P}`;
const DARAR = 'لا ضرر ولا ضرار';
const AHMAD = `حدثنا عبد الرزاق عن معمر عن جابر عن عكرمة عن ابن عباس قال: قال رسول الله ${P}: «${DARAR}»`;
const HAKIM = `حدثنا الدراوردي عن عمرو بن يحيى المازني عن أبيه عن أبي سعيد الخدري رضي الله عنه أن رسول الله ${P} قال: «${DARAR}، من ضار ضاره الله»`;

const lib = (ids, atoms, matn = M) => async (ms) => ms.map((m) => (m === matn ? { matn: m, subjectIds: ids, atoms } : { matn: m, subjectIds: [], atoms: [] }));
const prayers = (s) => (String(s).match(/رضي الله عن/gu) || []).length;

// Every row, against one module. `quiet` rows return a boolean map and print nothing (the mutants).
async function rows(T, report) {
  const run = (text, env, look) => T.applyTakhrij(text, { env, lookup: look });
  const r = {};
  const g1 = await run(plain, ON, lib(['FC-000600', 'FC-000656'], [MURSAL, MURSAL]));
  r.G1 = report('G1  the owner\'s fixture: a mursal from a Tabiʿi without the prayer names no Companion',
    prayers(g1.text) === 0 && ((g1.entries || [])[0] || {}).companion === '', g1.text);
  const g1b = await run(plain, ON, lib(['FC-000600', 'FC-000656'], [MURSAL_AFTER, MURSAL_AFTER]));
  const g1bOff = await run(plain, OFF, lib(['FC-000600', 'FC-000656'], [MURSAL_AFTER, MURSAL_AFTER]));
  r.G1b = report('G1b ...nor when an earlier narration\'s Companion stands in the same atom (the switch off still reads him)',
    prayers(g1b.text) === 0 && /أبي هريرة/u.test(g1bOff.text), g1b.text + ' || off: ' + g1bOff.text);
  const g1c = await run(plain, ON, lib(['FC-000600', 'FC-000656'], [RAHIMAHU_AFTER, RAHIMAHU_AFTER]));
  r.G1c = report('G1c a mursal «رحمه الله» after a Companion\'s narration: no Companion', prayers(g1c.text) === 0, g1c.text);
  const g2 = await run(plain, ON, lib(['FC-000645'], [UMAR]));
  const g2Off = await run(plain, OFF, lib(['FC-000645'], [UMAR]));
  r.G2 = report('G2  one book, next to the Prophet ﷺ, with the prayer: «عن عمر بن الخطاب رضي الله عنه: «…» (البخاري)»; off: UNCONFIRMED',
    g2.text === `عن عمر بن الخطاب رضي الله عنه: «${M}» (البخاري).`
    && prayers(g2Off.text) === 0 && (g2Off.problems || []).includes('TAKHRIJ_COMPANION_UNCONFIRMED'), g2.text + ' || off: ' + g2Off.text);
  const g3a = await run(plain, ON, lib(['FC-000645', 'FC-000648'], [NOT_ADJ, NOT_ADJ]));
  const g3b = await run(plain, ON, lib(['FC-000645', 'FC-000648'], [NOT_ADJ2, NOT_ADJ2]));
  r.G3 = report('G3  a prayer on a man not next to the Prophet ﷺ («… عن عمر» / «… عن ميمونة»): no name',
    prayers(g3a.text) === 0 && prayers(g3b.text) === 0, g3a.text + ' || ' + g3b.text);
  const model = `الأصل في ذلك: عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «${M}».`;
  const g4 = await run(model, ON, lib([], []));
  r.G4 = report('G4  the model\'s «عن أبي هريرة رضي الله عنه قال:», the library silent: removed; the frame and the matn kept',
    g4.text === `الأصل في ذلك: قال رسول الله ${P}: «${M}».` && (g4.problems || []).includes('TAKHRIJ_MODEL_COMPANION_REMOVED'), g4.text);
  const g5 = await run(model, ON, lib(['FC-000645'], [UMAR]));
  r.G5 = report('G5  the model says «أبي هريرة», the book «عمر»: only the book\'s, exactly once',
    g5.text === `الأصل في ذلك: عن عمر بن الخطاب رضي الله عنه: «${M}» (البخاري).`, g5.text);
  const g6 = await run(`عن عمر بن الخطاب رضي الله عنه قال: قال رسول الله ${P}: «${M}».`, ON, lib(['FC-000645', 'FC-000648'], [UMAR, UMAR]));
  r.G6 = report('G6  never «عن X رضي الله عنه قال: عن X رضي الله عنه:»',
    prayers(g6.text) === 1 && g6.text.startsWith('عن عمر بن الخطاب رضي الله عنه: «'), g6.text);
  const g7 = await run(`والأصل قول النبي ﷺ: «${M}».`, ON, lib(['FC-000645', 'FC-000648'], [UMAR, UMAR]));
  r.G7 = report('G7  «قول النبي ﷺ: «…»»: ﷺ kept, no opener, «(متفق عليه)», NO_LEADIN',
    g7.text === `والأصل قول النبي ﷺ: «${M}» (متفق عليه).` && (g7.problems || []).includes('TAKHRIJ_COMPANION_NO_LEADIN'), g7.text);
  const g8 = await run(plain, ON, lib(['FC-000645', 'FC-000648'], [ABA, ABI]));
  const g8b = await run(plain, ON, lib(['FC-000645'], [ABA]));
  r.G8 = report('G8  «أبا هريرة» + «أبي هريرة» are one man, «عن أبي هريرة»; one book «سمعت أبا هريرة» is never «عن أبا هريرة»',
    g8.text === `عن أبي هريرة رضي الله عنه: «${M}» (متفق عليه).` && !/عن أبا /u.test(g8b.text) && /عن أبي هريرة/u.test(g8b.text),
    g8.text + ' || ' + g8b.text);
  const g9 = await run(plain, ON, lib(['FC-000645', 'FC-000648'], [UMAR, ABI]));
  r.G9 = report('G9  «عمر» in one book, «أبي هريرة» in the other: no name, TAKHRIJ_COMPANION_CONFLICT',
    prayers(g9.text) === 0 && (g9.problems || []).includes('TAKHRIJ_COMPANION_CONFLICT'), JSON.stringify([g9.text, g9.problems]));
  const g10 = await run(plain, ON, lib(['FC-000645'], [KIN]));
  r.G10 = report('G10 «عن أبيه رضي الله عنه»: no name', prayers(g10.text) === 0, g10.text);
  const g11a = await run(`الأصل في ذلك ما جاء عن أبي هريرة رضي الله عنه أن رسول الله ${P} قال: «${M}».`, ON, lib([], []));
  const g11b = await run(`والدليل على ذلك حديث أم سلمة رضي الله عنها أن النبي ${P} قال: «${M}».`, ON, lib([], []));
  const addressee = `لقول النبي ${P} لعائشة رضي الله عنها لما حاضت: «${M}».`;
  const g11c = await run(addressee, ON, lib([], []));
  const story = `عن أنس رضي الله عنه قال: كنا مع النبي ${P} في سفر فقال النبي ${P}: «${M}».`;
  const g11d = await run(story, ON, lib([], []));
  r.G11 = report('G11 «ما جاء عن X … أن رسول الله ﷺ» and «حديث X … أن النبي ﷺ» are cut; an addressee and a story are not',
    g11a.text === `الأصل في ذلك ما جاء أن رسول الله ${P} قال: «${M}».` && g11b.text === `والدليل على ذلك أن النبي ${P} قال: «${M}».`
    && g11c.text === addressee && g11d.text === story, [g11a.text, g11b.text, g11c.text, g11d.text].join(' || '));
  const g12 = await run(model, OFF, lib([], []));
  r.G12 = report('G12 the switch off: the model\'s text comes back unchanged on a silent library', g12.text === model, g12.text);
  const lead = 'هذه مقدمة الجواب.\n';
  const g13 = await run(lead + `عن أبي هريرة رضي الله عنه قال: قال رسول الله ${P}: «${M}».`, ON, lib(['FC-000645'], [UMAR]));
  r.G13 = report('G13 what stands before the matn\'s sentence is byte-identical', g13.text.startsWith(lead), g13.text);
  const g14 = await run(plain, ON, lib(['FC-000704'], [IBN_HIBBAN]));
  r.G14 = report('G14 «قال أبو حاتم رضي الله عنه: قوله ﷺ «…»» (the author himself) names nobody', prayers(g14.text) === 0, g14.text);
  const FIL = 'جعل رسول الله صلى الله عليه وسلم ثلاثة أيام ولياليهن للمسافر ويوما وليلة للمقيم';
  const DARIMI = `أخبرنا محمد بن يوسف عن شريح بن هانئ عن علي بن أبي طالب رضي الله عنه قال: «${FIL}»`;
  const g15 = await run(`والمسح مؤقت، وفي الحديث: «${FIL}».`, ON, lib(['FC-000637'], [DARIMI], FIL));
  r.G15 = report('G15 «عن علي رضي الله عنه قال: «جعل رسول الله ﷺ …»»: named', g15.text.includes('عن علي بن أبي طالب رضي الله عنه: «جعل'), g15.text);
  const darar = `قال رسول الله ${P}: «${DARAR}».`;
  const g16 = await run(darar, ON, lib(['FC-000630', 'FC-000735'], [AHMAD, HAKIM], DARAR));
  const g16b = await run(darar, ON, lib(['FC-000735'], [HAKIM], DARAR));
  r.G16 = report('G16 «(أحمد · …)» with Abū Saʿīd only in al-Ḥākim\'s atom: no name; al-Ḥākim alone names him',
    prayers(g16.text) === 0 && /\(أحمد · /u.test(g16.text) && /^عن أبي سعيد الخدري رضي الله عنه: «/u.test(g16b.text), g16.text + ' || ' + g16b.text);
  const back = `والدليل على ذلك حديث أبي جري الهجيمي رضي الله عنه أن النبي ${P} قال له: «${M}».`;
  const g17 = await run(back, ON, lib([], []));
  r.G17 = report('G17 a lead-in that points back at the narrator («قال له») keeps the model\'s name, and says so',
    g17.text === back && (g17.problems || []).includes('TAKHRIJ_MODEL_COMPANION_KEPT'), JSON.stringify([g17.text, g17.problems]));
  return r;
}

// A twin of lib/takhrij.js with one seam replaced, its relative imports pointed back at the tree.
async function twin(name, seam, replacement) {
  const src = fs.readFileSync(LIB, 'utf8');
  if (!src.includes(seam)) return null;
  const libDir = path.dirname(LIB);
  const pointed = src.replace(seam, replacement).replace(/(['"])(\.\.?\/[^'"\r\n]+\.js)\1/gu,
    (_all, quote, spec) => quote + pathToFileURL(path.resolve(libDir, spec)).href + quote);
  const file = path.join(os.tmpdir(), `fa-companion-${name}-${process.pid}.mjs`);
  fs.writeFileSync(file, pointed, 'utf8');
  try { return await import(pathToFileURL(file).href); } finally { fs.rmSync(file, { force: true }); }
}

async function main() {
  console.log('full-answer-companion guard — root ' + REPO);
  let T = null;
  try { T = await import(pathToFileURL(LIB).href); } catch (e) { ok('G0  lib/takhrij.js loads', false, e.message); }
  if (!T) { console.log(`\n=== full-answer-companion: ${checks - failures}/${checks} PASS ===`); process.exit(1); }
  await rows(T, ok);
  // ── the mutants: each must fail at least the row that exists for it ─────────────────────────────
  const probe = (target) => async (label, seam, replacement) => {
    const M2 = await twin(label, seam, replacement);
    if (!M2) return { applied: false };
    const seen = {};
    await rows(M2, (id, cond) => { seen[id.split(' ')[0]] = cond; return cond; });
    return { applied: true, killed: seen[target] === false };
  };
  const m1 = await probe('G1b')('adjacency',
    'if (!b2Adjacent(prefix.slice(last.index + last[0].length), bare.slice(cut, cut + 120))) return { name: \'\', prayer: \'\' };',
    '// mutant: no adjacency test');
  ok('M1  mutant «no adjacency test» is killed (G1b)', m1.applied && m1.killed, JSON.stringify(m1));
  const m2 = await probe('G14')('anchor', "const B2_ANCHORS_REFUSED = new Set(['قال', 'قالت']);", 'const B2_ANCHORS_REFUSED = new Set([]);');
  ok('M2  mutant «the قال anchor allowed» is killed (G14)', m2.applied && m2.killed, JSON.stringify(m2));
  const m3 = await probe('G16')('outlet', ".filter((c) => shown.includes(String(c.book).split('|').slice(1).join('|')))", '/* mutant: any book */');
  ok('M3  mutant «any book, not the bracket\'s» is killed (G16)', m3.applied && m3.killed, JSON.stringify(m3));
  console.log(`\n=== full-answer-companion: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); process.exit(1); });
