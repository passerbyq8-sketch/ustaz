// ── [111-close-5] · A SENTENCE THAT LEANED ON A CUT ONE DOES NOT OPEN THE ANSWER'S NEXT BREATH ────────────
//
// MEASURED over the roots rounds (EZIK-111-ROOTS-REPORT-2026-09-23 §3, cause C-lock-orphan, 10 turns) and on
// the owner's own screen («ما درجة حديث المستشار مؤتمن», طالب علم): the seal and the grade rule drop whole
// sentences, and the sentence after one of them was delivered as it stood — opening on «لكنَّ ضعفَ هذا
// اللفظ…», «ولفظه:», «قال: «الكَلِمَةُ الطَّيِّبَةُ».», «ومنهم…», «ورد هذا الكلامُ حديثًا…», «فقد قال: "المسبل
// إزاره"» — a connective, a frame or a back-reference whose other half the reader never saw.
//
// THE OWNER'S ROW (order of 23 Sep, row 5): no answer opens a breath on «وقد…»، «ولفظه:»، «قال:»، «لكن…» after
// a cut, and no back-reference is left without its referent: either the sentence stands whole without what
// it leaned on, or the passage goes. THIS WRITES NO WORD. It reads the text the finalizer received and the
// text its cuts left, finds each sentence whose own predecessor was cut away, and then, by its opening only:
//   · a connective of contrast («لكن»، «ولكنّ»، «ومع ذلك»، «بينما»، «غير أنّ») loses that word and the comma
//     after it, and the sentence stands on its own claim;
//   · «وقد» loses its «و» — «قد سُئل عنه…» opens a sentence as the language allows;
//   · a speech frame with no speaker («قال:»، «ولفظه:»، «فقد قال…») or a back-reference opening
//     («ورد هذا…»، «ومنهم…»، «وله روايتان»، «وحكم هذه الرواية…») goes, sentence by sentence, as long as the
//     next one leans the same way — UNLESS it carries a ruling: a fiqh ruling is never paid for style
//     (the owner's order of priority, 21 Sep), and such a sentence is left exactly as it arrived.
// Nothing is asked of a sentence whose predecessor stands, so an untouched answer is byte-identical.

const DIACRITICS_RE = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
const fold = (s) => String(s == null ? '' : s).replace(DIACRITICS_RE, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
  .replace(/[«»"“”'‘’()\[\]{}<>:؛،,.؟?!\-–—*_#]/gu, ' ').replace(/\s+/gu, ' ').trim();

/** Sentence units with offsets: a line break always ends one; «.»/«؟»/«!» + space ends one outside «…». */
export function sentenceUnits(text) {
  const s = String(text == null ? '' : text);
  const out = [];
  let start = 0;
  let depth = 0;
  const push = (end) => { if (s.slice(start, end).trim()) out.push({ start, end }); start = end; };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '«') depth += 1;
    else if (c === '»') depth = Math.max(0, depth - 1);
    else if (c === '\n') { push(i); start = i + 1; depth = 0; }
    else if (depth === 0 && /[.؟!]/u.test(c) && (i + 1 >= s.length || /\s/u.test(s[i + 1]))) push(i + 1);
  }
  push(s.length);
  return out;
}

const RULING_WORDS = new Set(['يجب', 'تجب', 'واجب', 'واجبه', 'يجوز', 'تجوز', 'جايز', 'جائز', 'يحرم', 'تحرم', 'حرام', 'محرم',
  'يستحب', 'تستحب', 'مستحب', 'يسن', 'سنه', 'مسنون', 'مكروه', 'يكره', 'تكره', 'شرط', 'يشترط', 'باطل', 'يبطل', 'تبطل',
  'فرض', 'فريضه', 'ركن', 'يلزم', 'تلزم', 'يباح', 'مباح', 'حلال', 'يصح', 'تصح', 'يجزي', 'يجزئ', 'يفطر', 'الحكم', 'حكمه',
  'الجمهور', 'مذهب', 'الراجح', 'والراجح', 'تحريم', 'وجوب', 'جواز', 'استحباب', 'كراهه']);
// «يصحّ» about a hadith is its grade, not a ruling: read as a ruling only where the sentence speaks of no text.
const SPEAKS_OF_A_TEXT_RE = /(?:^| )(?:[وفب]?(?:ال)?حديث[اه]?|اللفظ|اسناده?|سنده)(?= |$)/u;
const carriesRuling = (unit) => {
  const words = fold(unit);
  const ofText = SPEAKS_OF_A_TEXT_RE.test(words);
  return words.split(' ').some((w) => { const b = w.replace(/^[وف](?=..)/u, ''); if (ofText && (b === 'يصح' || b === 'تصح')) return false; return RULING_WORDS.has(b) || RULING_WORDS.has(w); });
};

// Openers, on the folded words of the sentence's head.
const CONTRAST_RE = /^(?:و?لكن|ومع ذلك|مع ذلك|بينما|غير ان)(?= |$)/u;
const FRAME_RE = /^(?:[وف]?قال|[وف]?قالت|ولفظه|لفظه|وفي لفظ|فقد قال|وقد قال|ثم قال)(?= |$)/u;
const BACKREF_RE = /^(?:ورد هذا|وقد ورد هذا|وهذا الحديث|هذا الحديث|وهذا اللفظ|ومنهم|ومنها|وله روايتان|وله روايات|وحكم هذه|وحكم هذا|وهذه الروايه|كما سبق|كما رايت)(?= |$)/u;

/** The raw offset in `unit` just after its first `n` words (and a comma/colon glued after them). */
function afterWords(unit, n) {
  const re = /\S+/gu;
  let m = null;
  for (let k = 0; k < n; k += 1) { m = re.exec(unit); if (!m) return 0; }
  let at = m.index + m[0].length;
  const tail = unit.slice(at).match(/^\s*[،,]?\s*/u);
  return at + (tail ? tail[0].length : 0);
}

export function repairOrphanedOpeners(original, text) {
  const src = String(original == null ? '' : original);
  let out = String(text == null ? '' : text);
  if (!src.trim() || !out.trim() || src === out) return { text: out, repaired: [] };
  const srcUnits = sentenceUnits(src).map((u) => ({ ...u, raw: src.slice(u.start, u.end), key: fold(src.slice(u.start, u.end)) }));
  const outFolded = fold(out);
  const gone = srcUnits.map((u) => !!u.key && !outFolded.includes(u.key)
    && !outFolded.includes(u.key.split(' ').slice(0, 5).join(' ')));
  if (!gone.some(Boolean)) return { text: out, repaired: [] };
  const repaired = [];
  const edits = [];
  let predecessorGone = null; // decided per unit as we walk the delivered text
  for (const v of sentenceUnits(out)) {
    const raw = out.slice(v.start, v.end);
    const lead = raw.match(/^\s*/u)[0].length;
    const body = raw.slice(lead);
    const key = fold(body);
    if (!key) continue;
    // Where this unit came from: the first source unit whose folded text holds its head.
    const head = key.split(' ').slice(0, 4).join(' ');
    const origin = srcUnits.findIndex((u, k) => !gone[k] && u.key.includes(head));
    let leansOnCut;
    if (origin < 0) leansOnCut = predecessorGone === true;
    else {
      let k = origin - 1;
      while (k >= 0 && !srcUnits[k].key) k -= 1;
      leansOnCut = k >= 0 && gone[k];
      // the unit's own source sentence lost its head: the delivered text starts inside it
      if (!leansOnCut && !srcUnits[origin].key.startsWith(head)) leansOnCut = false;
    }
    if (predecessorGone === true && origin >= 0 && edits.length && edits[edits.length - 1].dropped) leansOnCut = true;
    predecessorGone = false;
    if (!leansOnCut) continue;
    if (CONTRAST_RE.test(key)) {
      const n = /^(?:ومع ذلك|مع ذلك|غير ان)(?= |$)/u.test(key) ? 2 : 1;
      edits.push({ start: v.start + lead, end: v.start + lead + afterWords(body, n), insert: '' });
      repaired.push({ kind: 'contrast', removed: body.slice(0, afterWords(body, n)).trim() });
      continue;
    }
    if (/^وقد(?= |$)/u.test(key)) {
      const at = body.indexOf('و');
      if (at === 0) { edits.push({ start: v.start + lead, end: v.start + lead + 1, insert: '' }); repaired.push({ kind: 'waqad', removed: 'و' }); }
      continue;
    }
    if ((FRAME_RE.test(key) || BACKREF_RE.test(key)) && !carriesRuling(body)) {
      let end = v.end;
      if (out[end] === '\n') end += 1;
      edits.push({ start: v.start, end, insert: '', dropped: true });
      repaired.push({ kind: FRAME_RE.test(key) ? 'frame' : 'back-reference', removed: body.trim() });
      predecessorGone = true;
    }
  }
  if (!edits.length) return { text: out, repaired: [] };
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.insert + out.slice(e.end);
  out = out.replace(/\n{3,}/gu, '\n\n').replace(/^\s+/u, '');
  return { text: out, repaired };
}
