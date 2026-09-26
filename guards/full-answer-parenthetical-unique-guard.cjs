// D3A H2: a parenthetical may cite atoms of only one hadith under C4's narrator grouping.
// Offline fixtures follow the measured Jibril opener and two independent shared wordings.
// Red on 2fd562c. H1 may change the surrounding frame; this guard pins H2's citation boundary.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const arg = (key) => { const at = process.argv.indexOf(key); return at >= 0 ? process.argv[at + 1] : ''; };
const REPO = arg('--root') ? path.resolve(arg('--root')) : path.join(__dirname, '..');
const P = 'صلى الله عليه وسلم';
const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
const OFF = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'off' };
const CODE = 'TAKHRIJ_PARENTHETICAL_MANY_HADITHS';
const fixtures = [
  { id: 'H2-1', name: 'Jibril opener: Muslim 8 and Bukhari 3610 are different hadiths', many: true,
    matn: `بينما نحن عند رسول الله ${P} ذات يوم`, ids: ['FC-000648', 'FC-000645'],
    atoms: [
      `حدثني أبو خيثمة عن كهمس عن عبد الله بن بريدة عن يحيى بن يعمر ثم قال حدثني أبي عمر بن الخطاب قال: بينما نحن عند رسول الله ${P} ذات يوم إذ طلع علينا رجل شديد بياض الثياب`,
      `حدثنا أبو اليمان عن شعيب عن الزهري عن أبي سلمة أن أبا سعيد الخدري رضي الله عنه قال: بينما نحن عند رسول الله ${P} ذات يوم وهو يقسم قسما أتاه ذو الخويصرة`,
    ], offParen: 'متفق عليه' },
  { id: 'H2-2', name: 'shared saying, two narrators without the prayer: ambiguity is independent of B2 naming', many: true,
    matn: 'من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت', ids: ['FC-000645', 'FC-000648'],
    atoms: [
      `حدثنا قتيبة عن أبي صالح عن أبي هريرة قال: قال رسول الله ${P}: «من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت»`,
      `حدثنا عبد الله بن يوسف عن سعيد المقبري عن أبي شريح العدوي قال: سمعت رسول الله ${P} يقول: «من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت»`,
    ], offParen: 'متفق عليه' },
  { id: 'H2-3', name: 'shared short saying in Ahmad and Hakim: no combined citation or grade', many: true,
    matn: 'لا ضرر ولا ضرار', ids: ['FC-000630', 'FC-000735'],
    atoms: [
      `حدثنا عبد الرزاق عن عكرمة عن ابن عباس قال: قال رسول الله ${P}: «لا ضرر ولا ضرار»`,
      `أخبرنا أبو العباس عن أبي سعيد الخدري رضي الله عنه قال: قال رسول الله ${P}: «لا ضرر ولا ضرار»`,
    ], offParen: 'أحمد · لم يوقف على حكم' },
  { id: 'H2-4', name: 'one hadith in two books keeps its agreed-upon citation', many: false,
    matn: 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى', ids: ['FC-000645', 'FC-000648'],
    atoms: [
      `حدثنا الحميدي عن علقمة قال سمعت عمر بن الخطاب رضي الله عنه يقول سمعت رسول الله ${P} يقول: «إنما الأعمال بالنيات وإنما لكل امرئ ما نوى»`,
      `حدثنا عبد الله عن علقمة عن عمر بن الخطاب قال قال رسول الله ${P}: «إنما الأعمال بالنيات وإنما لكل امرئ ما نوى»`,
    ], offParen: 'متفق عليه' },
  { id: 'H2-5', name: 'one hadith, two forms of Ibn Umar, keeps its Bukhari citation', many: false,
    matn: 'كن في الدنيا كأنك غريب أو عابر سبيل', ids: ['FC-000645', 'FC-000658'],
    atoms: [
      `حدثنا علي عن مجاهد عن عبد الله بن عمر رضي الله عنهما أن رسول الله ${P} قال: «كن في الدنيا كأنك غريب أو عابر سبيل»`,
      `حدثنا محمود عن مجاهد عن ابن عمر قال قال رسول الله ${P}: «كن في الدنيا كأنك غريب أو عابر سبيل»`,
    ], offParen: 'البخاري' },
];
const draft = (f) => `قال رسول الله ${P}: «${f.matn}».`;
const lookup = (f) => async (matns, options) => matns.map((matn) => {
  const indexes = f.ids.map((_, i) => i).filter((i) => !options.bookIds || options.bookIds.includes(f.ids[i]));
  return { matn, subjectIds: indexes.map((i) => f.ids[i]), atoms: indexes.map((i) => f.atoms[i]) };
});
let checks = 0, failures = 0;
function ok(name, pass, detail) { checks++; if (!pass) failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '\n        ' + JSON.stringify(detail)}`); }
globalThis.fetch = async () => { throw new Error('H2 guard forbids network'); };
async function main() {
  const T = await import(pathToFileURL(path.join(REPO, 'lib/takhrij.js')).href);
  const observations = [];
  console.log('full-answer-parenthetical-unique guard — root ' + REPO);
  for (const f of fixtures) {
    const on = await T.applyTakhrij(draft(f), { env: ON, lookup: lookup(f) });
    const off = await T.applyTakhrij(draft(f), { env: OFF, lookup: lookup(f) });
    const e = on.entries[0] || {};
    const groups = T.narratorGroups(f.atoms.map((a) => T.matnNarrator(a, f.matn)).filter((n) => n.name && !n.kin).map((n) => n.name));
    ok(f.id + ' fixture matches existing C4 rule', (groups.length > 1) === f.many, groups);
    ok(f.id + ' ' + f.name, f.many ? e.separateCollectors?.length > 0 && e.declined === 'combined_parenthetical_only'
      && on.problems.includes(CODE) && !on.text.includes('(متفق عليه)') && !e.companion
      && e.separateCollectors.every(one => on.text.includes(`(${one})`))
      : e.parenthetical === f.offParen && on.text.includes(`(${f.offParen})`) && !on.problems.includes(CODE), { text: on.text, entry: e, problems: on.problems });
    ok(f.id + ' quoted wording survives byte for byte', on.text.includes(`«${f.matn}»`), on.text);
    const expectedOff = `قال رسول الله ${P}: «${f.matn}» (${f.offParen}).`;
    ok(f.id + ' FULL_ANSWER_V1 off keeps baseline text', off.text === expectedOff && !off.problems.includes(CODE), off.text);
    observations.push({ id: f.id, groups, on, off });
  }
  const j = fixtures[0];
  const card = await T.applyTakhrij(`<hadith narrator="راو" ruling="صحيح">${j.matn}</hadith>`, { env: ON, lookup: lookup(j) });
  ok('H2-6 D3C C2e ambiguous card keeps each separately confirmed collector', !/<hadith/u.test(card.text) && card.text.includes(`«${j.matn}»`)
    && card.text.includes('(البخاري) (مسلم)') && !card.text.includes('(متفق عليه)') && card.problems.includes(CODE), card);
  const prose = await T.applyTakhrij(`${draft(j)} أخرجه البخاري ومسلم.`, { env: ON, lookup: lookup(j) });
  ok('H2-7 ambiguous match supplies separate collector proofs', prose.problems.includes(CODE)
    && prose.entries[0].separateCollectors.length === 2 && prose.entries[0].proseProof.length === 2, prose);
  if (arg('--out')) fs.writeFileSync(arg('--out'), JSON.stringify({ root: REPO, checks, failures, observations, card, prose }, null, 2) + '\n');
  console.log(`\n=== full-answer-parenthetical-unique: ${checks - failures}/${checks} PASS ===`);
  process.exitCode = failures ? 1 : 0;
}
main().catch((e) => { console.error(e.stack || e); process.exitCode = 1; });
