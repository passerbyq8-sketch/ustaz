// lib/prophet-ascription.js — البند ٣٦ · الباب (ب) · الطور الثاني.
//
// A DESCRIPTION OF SOMEONE ELSE MUST NOT REACH THE READER AS NEWS ABOUT THE PROPHET ﷺ.
//
// WHAT THIS FILE IS FOR. guards/prophet-ascription-guard.cjs measured that defect in production on
// 2026-09-12 and proved the rule that catches it — and it was a DETECTOR AND NOTHING ELSE. The
// measurement of this round says so in numbers: ZERO references to that guard from the answer
// path, and the dependency running the wrong way round, guards importing lib/ and never the
// reverse. A rule that only ever runs in the battery cannot refuse one sentence to one reader.
// This file is that same rule standing where the answer is written.
//
// ── THE SEAL, AND WHY THIS IS A VERBATIM COPY AND NOT AN IMPORT ──────────────────────────────
//
// THE ORDER ASKED FOR ONE MODULE IMPORTED BY BOTH — the guard and the answer path — «فيبقى ملفُّ
// الحارسِ ساكنًا». IT CANNOT BE BOTH, and the reason is written here rather than worked around:
// the same order seals guards/prophet-ascription-guard.cjs byte for byte, and a guard that imports
// this module is a guard that was edited. The two halves of that instruction contradict each
// other, and the seal is the half that was marked 🔴.
//
// SO THE LOGIC IS CARRIED ACROSS VERBATIM, and the drift a copy invites is answered by
// MEASUREMENT rather than by discipline. guards/prophet-ascription-wiring-guard.cjs cuts the same
// region out of BOTH files, by the same two content anchors, and fails if a single byte differs.
// Nobody has to remember to keep them together; the battery will not let them part.
//
// THE REGION IS EXACT, and it is stated so the next reader can cut it themselves: it opens at the
// ARABIC_MARKS_RE declaration and closes at the brace ending `detectStolenAscription` — 5340
// bytes of the guard's own text, with nothing added, nothing moved and nothing "improved". A
// behaviour of this copy that differs from the guard's is a DEFECT in this file and never an
// upgrade, and that is the whole reason the comparison is by bytes and not by test results.
//
// ── WHAT IS DELIBERATELY NOT COPIED ─────────────────────────────────────────────────────────
//
// PROPHET_FRAME_RE. lib/output-reviewer.js:838 is the only place in this tree that says which
// spellings name him, and the guard's section E does not assert that — it MEASURES it, by walking
// the repository. So this module never writes a second spelling list: `frame` and `namesTheProphet`
// arrive as options, exactly as they already do inside the guard, and the caller borrows them from
// the reviewer. A second list here would be a second answer to «who is the Prophet ﷺ» on the day
// one of them is edited, and it would turn that guard's E1 red on sight.
//
// ── WHAT THE SEALED RULE CAN AND CANNOT SEE, RESTATED SO THE DOOR IS NOT OVERSOLD ───────────
//
// It uses ONLY evidence inside the answer: a run of words in the prose whose nearest ascription
// names the Prophet ﷺ, and the SAME run inside a TAGGED `<hadith>` matn in that same answer whose
// nearest ascription names somebody else. One answer, two owners, one sentence. The untagged
// travel of the very same matn — rounds one, three and five of the measurement — is INVISIBLE to
// it by design, and the guard's section D proves that blindness is a decision. The door built on
// it is therefore narrow on purpose: it is «حارسٌ يمنعُ الصنفَ المقيسَ وحدَه», not a widening of
// references on every answer.

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ══ SEALED REGION BEGINS — 5340 BYTES COPIED FROM THE GUARD. DO NOT EDIT ANYTHING BELOW THIS ══
// ══ LINE UNTIL THE «SEALED REGION ENDS» MARKER. EDIT THE GUARD, THEN RE-CUT.                 ══
// ══════════════════════════════════════════════════════════════════════════════════════════════

const ARABIC_MARKS_RE = /[ً-ٰٟۖ-ۭـ]/gu;
const HADITH_BLOCK_RE = /<hadith\b[^>]*>([\s\S]*?)<\/hadith>/giu;
const ANGLE_TAG_RE = /<[^>]*>/gu;
const ORNATE_SPAN_RE = /﴿[\s\S]*?﴾/gu;
const PROSE_QUOTE_RE = /«([^»]*)»/gu;
const WORD_RE = /[\p{L}\p{N}]+/gu;
const SENTENCE_BREAK_RE = /[.!?؟\n؛;:]/u;

const blank = (text, re) => String(text).replace(re, (m) => ' '.repeat(m.length));

// A token stream that remembers WHERE each word sat and WHICH sentence it sat in. The sentence id
// is what stops a shared run from being stitched across a full stop — «جملة» is the unit the order
// names, and a run that straddles two of them is not one sentence's text.
function tokenize(text) {
  const out = [];
  let seg = 0, last = 0, m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    const gap = text.slice(last, m.index);
    if (SENTENCE_BREAK_RE.test(gap)) seg++;
    out.push({ w: m[0], at: m.index, seg });
    last = m.index + m[0].length;
  }
  return out;
}

// Every ascription this guard can read off the text itself: a frame that names the Prophet ﷺ
// (borrowed), or an honorific that names somebody — and an honorific whose name IS one of his
// spellings is his, not another's.
function anchorsOf(text, frame, namesTheProphet) {
  const found = [];
  const global = new RegExp(frame.source, frame.flags.includes('g') ? frame.flags : frame.flags + 'g');
  let m;
  while ((m = global.exec(text)) !== null) {
    found.push({ at: m.index, kind: 'prophet', text: m[0] });
    if (m[0] === '') global.lastIndex++;
  }
  const honorific = /([\p{L}ـ]+(?:\s+بن\s+[\p{L}ـ]+)*)\s+(?:عليه\s+السلام|عليها\s+السلام|عليهما\s+السلام|رضي\s+الله\s+عنهما|رضي\s+الله\s+عنهم|رضي\s+الله\s+عنها|رضي\s+الله\s+عنه)/gu;
  while ((m = honorific.exec(text)) !== null) {
    found.push({ at: m.index, kind: namesTheProphet(m[1]) ? 'prophet' : 'other', text: m[0] });
  }
  found.sort((a, b) => a.at - b.at);
  return found;
}

const nearestBefore = (anchors, at) => {
  let hit = null;
  for (const a of anchors) { if (a.at < at) hit = a; else break; }
  return hit;
};

// The longest run of words that sits, unbroken and inside ONE sentence on each side, in both
// streams. This is the measurable form of «ويكون نص الجملة داخلًا في ذلك المتن المنقول».
function longestSharedRun(a, b) {
  let best = { len: 0, aAt: -1, bAt: -1, words: [] };
  const table = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = 0;
    for (let j = 1; j <= b.length; j++) {
      const here = table[j];
      if (a[i - 1].w === b[j - 1].w
        && (prevDiag === 0 || (a[i - 1].seg === a[i - 2].seg && b[j - 1].seg === b[j - 2].seg))) {
        table[j] = prevDiag + 1;
        if (table[j] > best.len) {
          best = {
            len: table[j],
            aAt: a[i - table[j]].at,
            bAt: b[j - table[j]].at,
            words: a.slice(i - table[j], i).map((t) => t.w),
          };
        }
      } else table[j] = 0;
      prevDiag = here;
    }
  }
  return best;
}

const MIN_RUN = 6;

/**
 * @param {string} answer  the model's answer, exactly as it left the model
 * @param {object} [opts]  mutation switches — every one of them OFF is the shipped rule
 * @returns {{findings: Array, matns: Array}}
 */
function detectStolenAscription(answer, opts) {
  const o = opts || {};
  const minRun = typeof o.minRun === 'number' ? o.minRun : MIN_RUN;
  let src = String(answer == null ? '' : answer).replace(ARABIC_MARKS_RE, '');
  for (const mark of o.marks || []) src = src.split(mark).join(' '.repeat(mark.length));

  const matns = [];
  HADITH_BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = HADITH_BLOCK_RE.exec(src)) !== null) matns.push({ kind: 'tagged', text: m[1] });

  let prose = blank(src, HADITH_BLOCK_RE);
  if (o.untaggedQuotesAreMatns) {
    PROSE_QUOTE_RE.lastIndex = 0;
    while ((m = PROSE_QUOTE_RE.exec(prose)) !== null) matns.push({ kind: 'quoted', text: m[1] });
    prose = blank(prose, PROSE_QUOTE_RE);
  }
  prose = blank(prose, ANGLE_TAG_RE);

  const scripture = (t) => (o.judgeScripture ? t : blank(t, ORNATE_SPAN_RE));
  prose = scripture(prose);

  const proseTokens = tokenize(prose);
  const proseAnchors = anchorsOf(prose, o.frame, o.namesTheProphet);

  const findings = [];
  matns.forEach((matn, index) => {
    const body = scripture(matn.text);
    const run = longestSharedRun(proseTokens, tokenize(body));
    if (run.len < minRun) return;
    const proseAnchor = nearestBefore(proseAnchors, run.aAt);
    const matnAnchor = nearestBefore(anchorsOf(body, o.frame, o.namesTheProphet), run.bAt);

    const proseSaysProphet = o.ignoreProseAnchor ? true : Boolean(proseAnchor && proseAnchor.kind === 'prophet');
    const matnSaysOther = o.invertMatnAnchor
      ? Boolean(matnAnchor && matnAnchor.kind === 'prophet')
      : Boolean(matnAnchor && matnAnchor.kind === 'other');
    if (!proseSaysProphet || !matnSaysOther) return;

    findings.push({
      run: run.words.join(' '),
      length: run.len,
      matn: index,
      matnKind: matn.kind,
      proseAnchor: proseAnchor ? proseAnchor.text : null,
      matnAnchor: matnAnchor ? matnAnchor.text : null,
    });
  });
  return { findings, matns };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ══ SEALED REGION ENDS. EVERYTHING BELOW IS THIS ROUND'S OWN CODE.                            ══
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ── WHY THERE IS ANYTHING BELOW THE SEAL AT ALL ─────────────────────────────────────────────
//
// THE SEALED RULE REPORTS WHAT WAS TAKEN AND NEVER WHERE FROM. A finding carries the run's words,
// its length, which matn it collided with and the two ascriptions — and no offset. That is enough
// for a battery, which only has to answer «did it fire». It is NOT enough for a door, which has to
// drop ONE SENTENCE and hand the reader the rest.
//
// AND AN OFFSET IS NOT ADDED TO THE FINDING, which is the point of this section. Widening the
// object the sealed function returns would change the shape the guard's own assertions read, and
// the order's word on that is «إن اختلفَ سلوكٌ واحدٌ عن الحارسِ فهو عطبٌ لا تحسين». So the position
// is RECOVERED here instead, by replaying the sealed pipeline with the sealed constants — never by
// a second copy of its rules. Every regex and every helper used below is the sealed one, borrowed
// by name from a few lines up.

/**
 * The one length-changing step in the sealed pipeline is the diacritic strip; `blank` preserves
 * length by construction, so a single map carries every later offset back to the original text.
 *
 * @param {string} text  the answer exactly as the sealed rule receives it
 * @returns {{src: string, map: number[]}}  `src` is the stripped text, `map[i]` the original index
 */
function strippedIndexMap(text) {
  const map = [];
  let src = '';
  for (let i = 0; i < text.length; i += 1) {
    ARABIC_MARKS_RE.lastIndex = 0;
    if (ARABIC_MARKS_RE.test(text[i])) continue;
    map.push(i);
    src += text[i];
  }
  map.push(text.length); // one past the end, so a span running to the end still has a ceiling
  return { src, map };
}

// The prose stream the sealed rule tokenizes, rebuilt in the SAME order it builds it: the tagged
// matns go first, the angle tags second, scripture last. `blank` keeps the length, so every offset
// below is an offset into `src` and needs only the map above to become an offset into the answer.
function proseViewOf(src) {
  let prose = blank(src, HADITH_BLOCK_RE);
  prose = blank(prose, ANGLE_TAG_RE);
  return blank(prose, ORNATE_SPAN_RE);
}

// The spans a sentence may never grow into. A run sits in the prose, and the sentence around it is
// found by walking outward — so the walk has to stop at a card rather than swallow it. These are
// exactly the regions `proseViewOf` blanked, which is why they are collected with the same regexes.
function protectedSpans(src) {
  const spans = [];
  for (const re of [HADITH_BLOCK_RE, ANGLE_TAG_RE, ORNATE_SPAN_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      spans.push([m.index, m.index + m[0].length]);
      if (m[0] === '') re.lastIndex += 1;
    }
  }
  return spans;
}

// Where in the prose token stream this run of words actually sits. The sealed rule built the run
// out of these very tokens, so an exact word-for-word match inside ONE sentence segment is the
// same run it found — and the segment test is the sealed tokenizer's own `seg`, not a re-reading
// of the punctuation.
function runTokenSpan(tokens, words) {
  if (!words.length) return null;
  for (let i = 0; i + words.length <= tokens.length; i += 1) {
    let hit = true;
    for (let k = 0; k < words.length; k += 1) {
      if (tokens[i + k].w !== words[k] || tokens[i + k].seg !== tokens[i].seg) { hit = false; break; }
    }
    if (hit) return { start: i, end: i + words.length - 1 };
  }
  return null;
}

// The sentence around the run, in `src` coordinates. SENTENCE_BREAK_RE is the sealed rule's own
// list — the same one its tokenizer counts segments with — so «الجملة» means here exactly what it
// means there, and a run that was refused for straddling a full stop cannot be dropped across one.
function sentenceSpanAround(prose, tokens, span, spans) {
  const runStart = tokens[span.start].at;
  const runEnd = tokens[span.end].at + tokens[span.end].w.length;
  let floor = 0;
  let ceil = prose.length;
  for (const [a, b] of spans) {
    if (b <= runStart && b > floor) floor = b;
    if (a >= runEnd && a < ceil) ceil = a;
  }
  let start = runStart;
  while (start > floor && !SENTENCE_BREAK_RE.test(prose[start - 1])) start -= 1;
  let end = runEnd;
  while (end < ceil && !SENTENCE_BREAK_RE.test(prose[end])) end += 1;
  if (end < ceil) end += 1; // the full stop leaves with the sentence it ends
  while (start < end && /\s/u.test(prose[start])) start += 1;
  return { start, end };
}

/**
 * Run the sealed rule and say WHERE each finding's sentence sits in the answer.
 *
 * Findings the locator cannot place are dropped from the result rather than guessed at: a door
 * that cuts at an offset it is unsure of is worse than a door that does not open.
 *
 * @param {string} answer  the model's answer, exactly as it would reach the reader
 * @param {{frame: RegExp, namesTheProphet: function}} opts  borrowed from lib/output-reviewer.js
 * @returns {Array<{finding: object, start: number, end: number, text: string}>} ascending, disjoint
 */
export function locateStolenAscriptions(answer, opts) {
  const original = String(answer == null ? '' : answer);
  const { findings } = detectStolenAscription(original, opts);
  if (!findings.length) return [];
  const { src, map } = strippedIndexMap(original);
  const prose = proseViewOf(src);
  const tokens = tokenize(prose);
  const spans = protectedSpans(src);
  const located = [];
  for (const finding of findings) {
    const span = runTokenSpan(tokens, String(finding.run || '').split(' ').filter(Boolean));
    if (!span) continue;
    const at = sentenceSpanAround(prose, tokens, span, spans);
    if (at.end <= at.start) continue;
    const start = map[at.start];
    const end = map[at.end];
    if (!(Number.isInteger(start) && Number.isInteger(end) && end > start)) continue;
    located.push({ finding, start, end, text: original.slice(start, end) });
  }
  located.sort((a, b) => a.start - b.start || a.end - b.end);
  // Two matns can collide with ONE sentence. It is dropped once.
  const disjoint = [];
  for (const one of located) {
    const last = disjoint[disjoint.length - 1];
    if (last && one.start < last.end) { last.end = Math.max(last.end, one.end); continue; }
    disjoint.push(one);
  }
  return disjoint;
}

/**
 * The answer with those sentences taken out, and NOTHING ELSE TOUCHED.
 *
 * The whitespace repair is deliberately local: only the gap the cut itself opened is closed, so a
 * turn where this drops nothing returns its input byte for byte, and a turn where it drops one
 * sentence differs from its input in exactly that sentence and the space it was sitting in.
 *
 * @param {string} answer  the same text that was handed to `locateStolenAscriptions`
 * @param {Array<{start:number,end:number}>} located  its result, or a subset of it
 * @returns {string}
 */
export function withoutStolenAscriptions(answer, located) {
  const original = String(answer == null ? '' : answer);
  if (!Array.isArray(located) || !located.length) return original;
  let out = '';
  let cursor = 0;
  for (const span of located) {
    if (span.start < cursor) continue;
    out += original.slice(cursor, span.start);
    cursor = span.end;
    // The cut leaves the space that stood BEFORE the sentence and the one that stood after it side
    // by side. One of them goes, and only when there is another to stand in its place.
    while (cursor < original.length && /[ \t]/u.test(original[cursor]) && /[ \t\n]$/u.test(out)) {
      cursor += 1;
    }
    if (/\n$/u.test(out) && original[cursor] === '\n') cursor += 1;
  }
  out += original.slice(cursor);
  return out;
}

export { detectStolenAscription, MIN_RUN };
