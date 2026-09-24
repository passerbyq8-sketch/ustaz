// guards/full-answer-b-guard.cjs -- م٣-ب (FULL_ANSWER_V1): the bracket after the closing mark when
// the matn stands inside a governing sentence, and the seal and the seat keep it there.
//
// THE OWNER'S ITEM (program order 2026-09-24, م٣-ب, «القوسُ الملتصقُ بضدِّه»): deferred to the
// sentence's end, the library's bracket landed against the model's verdict about the same matn:
// «وخلاصة الأمر أن حديث «لا تصوموا يوم السبت…» باطلٌ لا يصح، ولا يُبنى عليه حكمٌ شرعي (الضياء في
// المختارة · صحيح).» His order: the bracket goes right after the closing mark. MEASURED before it was
// built (03-answer/measure/B-bracket.md): 9 of 177 delivered brackets were deferred, all 9 governed;
// and the seal's [b25] salvage and the seat's grade rule look for the library's bracket only at the
// sentence's end, so without a second change the moved bracket is dropped from a condemned sentence.
//
// WHAT THIS PINS:
//   P1  the slot: a governed matn takes its bracket at its closing mark, and the record says so;
//       the switch off, the slot is the one the old rule gave (deferred to the stop);
//   P2  applyTakhrij on the owner's §٣ sentence: «…» (bracket) then the sentence, read whole;
//   P3  a matn with no stop before the next one still declines (TAKHRIJ_NO_SLOT): only the
//       position moved, not the set of matns that get a bracket;
//   P4  the seal: a condemned sentence keeps the library's bracket standing right after its matn;
//       the switch off, today's result;
//   P5  the seat's grade rule: the same, for «(أحمد · لم يوقف على حكم)»;
//   P6  the finalizer carries the switch from its input into both, and nothing leaks to the next call;
//   P7  a bracket not in the ladder's shape still goes with its sentence.
// Red on the tree before this item (d5ffc4a): `node guards/full-answer-b-guard.cjs --root <tree>`.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const rootArg = process.argv.indexOf('--root');
const REPO = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.join(__dirname, '..');
const esm = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).slice(0, 500) : ''));
  return false;
}

async function main() {
  console.log('full-answer-b guard — root ' + REPO);
  const T = await esm('lib/takhrij.js');
  const L = await esm('lib/takhrij-ladder.js');
  const K = await esm('lib/takhrij-lock.js');
  const F = await esm('lib/finalize-reader-text.js');
  const OFF = { TAKHRIJ_V1: 'on' };
  const ON = { TAKHRIJ_V1: 'on', FULL_ANSWER_V1: 'on' };
  const rulingAtomFor = (matn, ruling) => '3913 - «' + matn + '» . (' + ruling + ') [حم] عن أنس.';
  const lookupOf = (table) => async (matns) => matns.map((matn) => table[matn] || { matn, subjectIds: [], atoms: [] });

  // ── P1 the slot ───────────────────────────────────────────────────────────
  const CARRIED = 'اختلاف أمتي رحمة';
  const embedded = 'وقد اشتهر ما يروى عن النبي صلى الله عليه وسلم، لكن هذا لا يعني أن اللفظ '
    + `المشهور «${CARRIED}» حديث ثابت عنه.`;
  const start = embedded.indexOf('«');
  const target = { start, end: embedded.indexOf('»') + 1 };
  const onSlot = T.parentheticalSlot(embedded, target, -1, { afterQuote: true });
  const offSlot = T.parentheticalSlot(embedded, target, -1);
  ok('P1  a governed matn takes its bracket at its closing mark; the switch off, the old deferral',
    !!onSlot && onSlot.at === target.end && onSlot.deferred === false && onSlot.governed === true
    && !!offSlot && offSlot.deferred === true && offSlot.at === embedded.length - 1,
    JSON.stringify({ onSlot, offSlot, end: target.end }));

  // ── P2 applyTakhrij on the owner's §٣ sentence ───────────────────────────
  const lookup = lookupOf({ [CARRIED]: { matn: CARRIED, subjectIds: ['FC-000791'], atoms: [rulingAtomFor(CARRIED, 'ضعيف')] } });
  const moved = await T.applyTakhrij(embedded, { env: ON, lookup });
  const kept = await T.applyTakhrij(embedded, { env: OFF, lookup });
  ok('P2  the bracket stands right after «…», the sentence reads on, and the record says governed',
    moved.text.includes(`«${CARRIED}» (${L.NOT_RAISED}) حديث ثابت عنه.`)
    && moved.entries.length === 1 && moved.entries[0].governed === true && moved.entries[0].deferred === false
    && kept.text.endsWith(`حديث ثابت عنه (${L.NOT_RAISED}).`) && kept.entries[0].deferred === true
    && kept.entries[0].governed === false,
    JSON.stringify({ moved: moved.text, kept: kept.text, entries: moved.entries.map((e) => ({ d: e.deferred, g: e.governed })) }));

  // ── P3 no stop, still no slot ─────────────────────────────────────────────
  const MATN = 'إنما الأعمال بالنيات';
  const atomFor = (matn) => `حدثنا سفيان عن عمر رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «${matn}»`;
  const noRoom = `وسبب ذلك ما ورد عن النبي صلى الله عليه وسلم أن «${MATN}» أصل`;
  const declined = await T.applyTakhrij(noRoom, {
    env: ON, lookup: lookupOf({ [MATN]: { matn: MATN, subjectIds: ['FC-000645'], atoms: [atomFor(MATN)] } }),
  });
  ok('P3  with no stop before the end, nothing is written under the switch either',
    declined.text === noRoom && declined.problems.includes(T.TAKHRIJ_NO_SLOT), JSON.stringify(declined));

  // ── P4 the seal ───────────────────────────────────────────────────────────
  const M25 = 'حديث «من عرف نفسه فقد عرف ربه»';
  const W25 = M25 + ' (لا يثبت مرفوعا) حديث صحيح، صححه الألباني.';
  const sealOn = K.lockTakhrij(W25, [], { bracketAfterQuote: true }).text;
  const sealOff = K.lockTakhrij(W25, []).text;
  ok('P4  the seal keeps the library\'s bracket standing right after its matn; the switch off, today\'s result',
    sealOn === M25 + ' (لا يثبت مرفوعا).' && sealOff === M25 + '.', JSON.stringify({ sealOn, sealOff }));

  // ── P5 the seat's grade rule ──────────────────────────────────────────────
  const S25M = 'حديث «الصيام والقرآن يشفعان للعبد يوم القيامة»';
  const S25 = S25M + ' (أحمد · لم يوقف على حكم) حديث صحيح.';
  const gradeOn = K.dropUnsourcedGrades(S25, { bracketAfterQuote: true }).text;
  const gradeOff = K.dropUnsourcedGrades(S25).text;
  ok('P5  the grade rule keeps «(أحمد · لم يوقف على حكم)» with its matn; the switch off, today\'s result',
    gradeOn === S25M + ' (أحمد · لم يوقف على حكم).' && gradeOff !== gradeOn, JSON.stringify({ gradeOn, gradeOff }));

  // ── P6 the finalizer carries the switch, and nothing leaks ────────────────
  const finOn = F.finalizeReaderText({ text: W25, sources: [], bracketAfterQuote: true });
  const finOff = F.finalizeReaderText({ text: W25, sources: [] });
  const after = K.lockTakhrij(W25, []).text;
  ok('P6  the seat carries the switch into its lock, and the next call without it is today\'s',
    String(finOn.text).includes('(لا يثبت مرفوعا)') && !String(finOff.text).includes('(لا يثبت مرفوعا)')
    && after === M25 + '.', JSON.stringify({ on: finOn.text, off: finOff.text, after }));

  // ── P7 a bracket not in the ladder's shape ────────────────────────────────
  const MODEL = M25 + ' (رواه الحاكم في المستدرك) حديث صحيح، صححه الألباني.';
  const modelOn = K.lockTakhrij(MODEL, [], { bracketAfterQuote: true }).text;
  ok('P7  a bracket not in the ladder\'s shape still goes with its sentence',
    modelOn === M25 + '.', JSON.stringify(modelOn));

  console.log(`\n=== full-answer-b: ${checks - failures}/${checks} PASS ===`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.log('  FAIL  guard crashed: ' + (e && e.stack || e)); console.log('\n=== full-answer-b: crashed ==='); process.exit(1); });
