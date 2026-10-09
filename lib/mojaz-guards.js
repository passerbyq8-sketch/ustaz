// lib/mojaz-guards.js — THE BRIEF TIER'S SENTENCE GUARD (MOJAZ_GUARDS_V1).
//
// A pure function on WHOLE SENTENCES, run before the text is let go to the reader. It never edits
// inside a sentence: a sentence is kept as written or dropped whole. It imports nothing (the same
// contract lib/route-classify.js keeps), so a test can drive it with a string and nothing else.
//
// WHAT IT DROPS — four kinds, each named in the log line `[mojaz/guard] { kind, chars }`:
//   greeting    a greeting at the head of the answer when the asker's message is not one.
//   self        talk about the writer itself or its sources ("أجيبك عنه من معرفتي المعتادة",
//               "هذا ما تفيده المادة المتاحة") — patterns lifted from the first battery's answers,
//               never a general "sounds like meta" test.
//   question    a question put to the asker at the end of the answer ("هل تحب أن أشرح لك…؟").
//   not_found   a «لم أجد / لم أقف» sentence when the answer rests on at least one source.
//   tool_talk   (only when the caller passes toolTalk: MOJAZ_SCOPE=bw2) the writer narrating its own tool turn.
//
// WHAT IT NEVER TOUCHES: card and suggestion markup (<source>, <book>, <verse>, <suggestions> …), a
// sentence that carries one of those, a sentence that carries a citation mark when it is the
// "self" kind, a lead-in that carries its answer after a colon, and anything it cannot name with a
// pattern above. A guard that guesses is a guard that deletes content; the order's rule is that
// deleting a content sentence of a good answer is a defect, so every pattern is anchored to a
// shape the measured answers showed (guards/mojaz-guards-unit.cjs runs them over all of them).
//
// SPELLING. Text is folded first (no diacritics; hamza forms → ا, ى → ي, ة → ه, ئ → ي, ؤ → و) and
// every pattern below is written in that folded spelling.

const DIACRITICS_RE = /[ً-ٰٟـۖ-ۭ]/gu;

/** Letters folded so that a pattern is written once. */
export function normalizeAr(text) {
  return String(text == null ? '' : text)
    .replace(DIACRITICS_RE, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/\s+/gu, ' ')
    .trim();
}

const CARD_TAG_RE = /<(verse|surah|hadith|steps|suggestions|source|board|document|dhikr|worship|book)\b[\s\S]*?(?:<\/\1\s*>|\/>)/giu;
const CITATION_RE = /\[\[\s*\d+\s*\]\]/gu;
const CITATION_TEST_RE = /\[\[\s*\d+\s*\]\]/u;
const stripCitationMarks = (text) => String(text || '').replace(CITATION_RE, ' ');
// JavaScript has no word boundary for Arabic; "not followed by an Arabic letter" is the one used throughout.
const END = '(?![ء-ي])';

// ── the asker's own message ───────────────────────────────────────────────────
const GREETING_WORD_RE = new RegExp('^(?:و?عليكم السلام|السلام عليكم|سلام عليكم|السلام عليك|و?عليك السلام|اهلا وسهلا|اهلا|مرحبا بك|مرحبا|يا هلا|هلا|حياك الله|حياكم الله|صباح الخير|مساء الخير|السلام)' + END, 'u');
const GREETING_FILLER_RE = /^(?:و|و?عليكم|و?عليك|السلام|سلام|اهلا|وسهلا|مرحبا|هلا|حياك|حياكم|الله|صباح|مساء|الخير|رحمه|ورحمه|وبركاته|بك|بكم|يا|تفضل|تفضلي)$/u;

/** True when the whole message is a greeting (a greeting with a question after it is not one). */
export function isGreetingMessage(question) {
  const folded = normalizeAr(stripCitationMarks(question)).replace(/[.,،!؟?:؛;\-"«»()]/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!folded || !GREETING_WORD_RE.test(folded)) return false;
  // "السلام عليكم ورحمة الله وبركاته" is all greeting; one extra word of content is already a question.
  const rest = folded.split(' ').filter((w) => w && !GREETING_FILLER_RE.test(w));
  return rest.length <= 1;
}

// ── sentence kinds ────────────────────────────────────────────────────────────
const GREETING_SENTENCE_RE = new RegExp('^(?:و?عليكم السلام|السلام عليكم|سلام عليكم|السلام عليك|و?عليك السلام|اهلا|مرحبا|هلا|يا هلا|حياك الله|حياكم الله|صباح الخير|مساء الخير)' + END, 'u');
const GREETING_TAIL_RE = new RegExp('^(?:تفضل|تفضلي|اسال|انا اسمعك|كيف اساعدك|كيف يمكنني|في خدمتك)' + END, 'u');

const SELF_PATTERNS = [
  new RegExp('(?:من|بحسب|حسب) معرفتي', 'u'),
  new RegExp('اجيبك (?:عنه|عنها|عن)' + END, 'u'),
  /لا (?:استطيع|اقدر) ان انسب الي/u,
  /(?:النصوص|المصادر|الماده|المواد) (?:التي )?(?:امامي|بين يدي)/u,
  /هذا ما (?:تفيده|تفيد) (?:الماده|النصوص|المصادر)/u,
  /الجواب الذي وجدته في (?:الماده|المصادر|النصوص)/u,
  /^(?:ساجيبك|سوف اجيبك|دعني (?:اجيب|اشرح|اوضح)|ساشرح لك)/u,
];
// TOOL TALK (MOJAZ_SCOPE=bw2 only; ctx.toolTalk). A writer that was given material and tools narrates its own turn:
// "أكمل الآن بالجواب، ولم أستدعِ أداةً جديدة، فالنتائج التي بين يديّ تكفي للمسألة." (the 2026-10-09 hybrid order, question 11).
// The three shapes below are that sentence's own parts, folded; a short sentence only.
const TOOL_TALK_PATTERNS = [
  /(?:اكمل|ساكمل|سنكمل) (?:الان )?بالجواب/u,
  /لم (?:استدع|استخدم) (?:اي )?(?:اداه|ادوات)/u,
  /النتايج (?:التي )?بين يدي (?:تكفي|كافيه)/u,
  /النتائج (?:التي )?بين يدي (?:تكفي|كافيه)/u,
];
const TOOL_TALK_MAX_CHARS = 200;

// A long sentence that mentions its material is saying something; only a short one is the writer talking about itself.
const SELF_MAX_CHARS = 170;

const NOT_FOUND_RE = new RegExp('(?:^|\\s)[وف]?(?:لم|لا) (?:اجد|اقف|اعثر)' + END, 'u');
const NOT_FOUND_MAX_CHARS = 170;

const ASKER_QUESTION_RE = new RegExp('(?:^| )(?:تحب|تريد|ترغب|تود|يهمك|تفضل)' + END + '|ان (?:اشرح|اوضح|افصل|ازيد|اذكر|اعطيك|اقدم) لك|اخبرني|ما رايك', 'u');

// "…هكذا: <the ruling>": a lead-in that carries the answer after its colon is content, whatever the lead-in says about itself.
const leadsIntoContent = (folded) => {
  const at = folded.search(/[:：]/u);
  return at >= 0 && folded.slice(at + 1).split(' ').filter(Boolean).length >= 5;
};

// ── cutting a text into sentences ─────────────────────────────────────────────
const TERMINATORS = new Set(['.', '!', '?', '؟']);
const QUOTE_CLOSER = { '«': '»', '﴿': '﴾' };

/** Whole sentences of a prose run: `{ lead, body }`; the leads and bodies concatenated are the run. */
export function splitSentences(run) {
  const out = [];
  const s = String(run == null ? '' : run);
  let i = 0;
  while (i < s.length) {
    let lead = '';
    while (i < s.length && /\s/u.test(s[i])) { lead += s[i]; i += 1; }
    if (i >= s.length) { if (lead) out.push({ lead, body: '' }); break; }
    const start = i;
    const quotes = [];
    let end = -1;
    for (; i < s.length; i += 1) {
      const c = s[i];
      if (c === '\n') { end = i; break; }
      if (quotes.length) {
        if (c === quotes[quotes.length - 1]) quotes.pop();
        else if (QUOTE_CLOSER[c]) quotes.push(QUOTE_CLOSER[c]);
        continue;
      }
      if (QUOTE_CLOSER[c]) { quotes.push(QUOTE_CLOSER[c]); continue; }
      if (!TERMINATORS.has(c)) continue;
      let j = i + 1;
      while (j < s.length && TERMINATORS.has(s[j])) j += 1;
      if (j < s.length && !/\s/u.test(s[j])) { i = j - 1; continue; }
      // citation marks written after the stop belong to this sentence
      let k = j;
      for (;;) {
        let m = k;
        while (m < s.length && (s[m] === ' ' || s[m] === '\t')) m += 1;
        if (s.startsWith('[[', m)) {
          const close = s.indexOf(']]', m);
          if (close < 0) break;
          k = close + 2;
          continue;
        }
        break;
      }
      end = k;
      break;
    }
    if (end < 0) end = s.length;
    out.push({ lead, body: s.slice(start, end).replace(/[ \t ]+$/u, '') });
    i = end;
  }
  return out;
}

/** Splits a text into runs of card markup (`tag`) and runs of prose (`prose`). */
function segments(text) {
  const out = [];
  let last = 0;
  const re = new RegExp(CARD_TAG_RE.source, CARD_TAG_RE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'prose', text: text.slice(last, m.index) });
    out.push({ type: 'tag', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'prose', text: text.slice(last) });
  return out;
}

const hasMarkup = (body) => /<\/?[a-z][^>]*>/iu.test(body);
const wordsOf = (body) => normalizeAr(stripCitationMarks(body)).replace(/[.,،!؟?:؛;\-"«»()[\]]/gu, ' ').split(' ').filter(Boolean);

/**
 * The kind of one sentence, or null. `ctx`:
 *   atStart        no content has been let go yet (the greeting rule reads it)
 *   askerGreeted   the asker's message is itself a greeting (the greeting rule stands down)
 *   sourceCount    sources the answer rests on (the not-found rule needs at least one)
 *   last           this is the last prose sentence of the whole answer (the question rule reads it)
 *   offerAnywhere  the question rule fires wherever it stands (a streamed unit cannot know it is last)
 */
export function classifySentence(body, ctx = {}) {
  if (!body || hasMarkup(body)) return null;
  const folded = normalizeAr(stripCitationMarks(body));
  if (!folded) return null;
  if (ctx.toolTalk && folded.length <= TOOL_TALK_MAX_CHARS && TOOL_TALK_PATTERNS.some((re) => re.test(folded))) return 'tool_talk';
  if (ctx.atStart && !ctx.askerGreeted && GREETING_SENTENCE_RE.test(folded) && wordsOf(body).length <= 14) return 'greeting';
  if ((Number(ctx.sourceCount) || 0) >= 1 && folded.length <= NOT_FOUND_MAX_CHARS && NOT_FOUND_RE.test(folded)) return 'not_found';
  if (folded.length <= SELF_MAX_CHARS && !CITATION_TEST_RE.test(body) && !leadsIntoContent(folded)
    && SELF_PATTERNS.some((re) => re.test(folded))) return 'self';
  if (/[?؟]\s*(?:\[\[\s*\d+\s*\]\]\s*)*$/u.test(body.trim()) && (ctx.last || ctx.offerAnywhere)
    && ASKER_QUESTION_RE.test(folded)) return 'question';
  return null;
}

const hasContent = (pieces) => pieces.some((p) => !p.tag && p.body && wordsOf(p.body).length >= 3);

/**
 * Guard a whole answer.
 * @param {string} text
 * @param {{question?:string, sourceCount?:number, atStart?:boolean, toolTalk?:boolean}} [opts]
 * @returns {{text:string, removed:Array<{kind:string, chars:number}>, contentLeft:boolean}}
 */
export function guardMojaz(text, opts = {}) {
  const input = String(text == null ? '' : text);
  const askerGreeted = isGreetingMessage(opts.question);
  const sourceCount = Number.isFinite(Number(opts.sourceCount)) ? Number(opts.sourceCount) : (input.match(CARD_TAG_RE) || []).length;
  const pieces = [];
  for (const part of segments(input)) {
    if (part.type === 'tag') { pieces.push({ tag: true, lead: '', body: part.text }); continue; }
    for (const sentence of splitSentences(part.text)) pieces.push({ tag: false, lead: sentence.lead, body: sentence.body });
  }
  const prose = pieces.filter((p) => !p.tag && p.body);
  const lastProse = prose.length ? prose[prose.length - 1] : null;
  const removed = [];
  let started = opts.atStart === false;
  let greetingDropped = false;
  for (const piece of prose) {
    let kind = classifySentence(piece.body, { atStart: !started, askerGreeted, sourceCount, last: piece === lastProse, toolTalk: opts.toolTalk === true });
    // "تفضل يا مستخدم" straight after a dropped greeting is the same greeting, not content.
    if (!kind && greetingDropped && !started && wordsOf(piece.body).length <= 6
      && GREETING_TAIL_RE.test(normalizeAr(stripCitationMarks(piece.body)))) kind = 'greeting';
    if (kind) {
      removed.push({ kind, chars: piece.body.length });
      piece.drop = true;
      if (kind === 'greeting') greetingDropped = true;
      continue;
    }
    started = true;
  }
  // the last prose sentence may be a different one once the sentences after it were dropped
  if (removed.length) {
    const kept = prose.filter((p) => !p.drop);
    const newLast = kept.length ? kept[kept.length - 1] : null;
    if (newLast && newLast !== lastProse && classifySentence(newLast.body, { last: true, askerGreeted, sourceCount, toolTalk: opts.toolTalk === true }) === 'question') {
      removed.push({ kind: 'question', chars: newLast.body.length });
      newLast.drop = true;
    }
  }
  if (!removed.length) return { text: input, removed, contentLeft: hasContent(pieces) };
  let out = '';
  let pendingLead = '';
  for (const piece of pieces) {
    if (piece.drop) { pendingLead = out ? (pendingLead || piece.lead) : ''; continue; }
    const lead = piece.lead || (out ? pendingLead : '');
    out += (out ? lead : '') + piece.body;
    pendingLead = '';
  }
  out = out.replace(/\n{3,}/gu, '\n\n').replace(/^\s+/u, '');
  return { text: out, removed, contentLeft: hasContent(pieces.filter((p) => !p.drop)) };
}

// The sentence MOJAZ_PROMPT_V1's block (rule 7) tells the writer to write when it has no source for a ruling.
// The before-writing path has its own marker for the same fact; this is how it is told they are one.
// (folded spelling: the ta marbuta of المسألة is already ه by the time this reads it)
const MOJAZ_NOT_FOUND_RE = /^لم اجد في مصادر عزك نصا في هذه المساله بعينها$/u;
export function isMojazNotFoundSentence(body) {
  return MOJAZ_NOT_FOUND_RE.test(normalizeAr(stripCitationMarks(body)).replace(/[.،,s]+$/u, ''));
}

/**
 * The same four rules for text that arrives as units (the before-writing path releases a sentence at
 * a time). It keeps the one fact a stream knows: whether any content has gone out yet. A question is
 * dropped wherever it stands, because a unit cannot know it is the last — an offer put to the asker
 * is never content in a brief answer.
 */
export function createUnitGuard({ question = '', sourceCount = 0, toolTalk = false } = {}) {
  const askerGreeted = isGreetingMessage(question);
  let started = false;
  let greetingDropped = false;
  return {
    /**
     * @param {string} unitBody
     * @param {number} [sourceCountNow]  sources the answer has cited so far; a stream knows no more than that
     * @returns {{body:string, removed:Array<{kind:string,chars:number}>}} body is '' when every sentence went.
     */
    check(unitBody, sourceCountNow) {
      const sources = Number.isFinite(Number(sourceCountNow)) ? Number(sourceCountNow) : sourceCount;
      const input = String(unitBody == null ? '' : unitBody);
      const removed = [];
      let out = '';
      for (const part of segments(input)) {
        if (part.type === 'tag') { out += part.text; continue; }
        for (const sentence of splitSentences(part.text)) {
          if (!sentence.body) { out += sentence.lead; continue; }
          let kind = classifySentence(sentence.body, { atStart: !started, askerGreeted, sourceCount: sources, offerAnywhere: true, toolTalk: toolTalk === true });
          if (!kind && greetingDropped && !started && wordsOf(sentence.body).length <= 6
            && GREETING_TAIL_RE.test(normalizeAr(stripCitationMarks(sentence.body)))) kind = 'greeting';
          if (kind) {
            removed.push({ kind, chars: sentence.body.length });
            if (kind === 'greeting') greetingDropped = true;
            continue;
          }
          started = true;
          out += (out ? sentence.lead : '') + sentence.body;
        }
      }
      return { body: removed.length ? out : input, removed };
    },
  };
}
