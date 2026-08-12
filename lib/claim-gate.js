// lib/claim-gate.js
// THE SPECIFIC-CLAIM GATE — for every religious answer, whether or not a scholar is named.
//
// IT EXISTS BECAUSE OF A SECOND REPRODUCED FAILURE, of a different shape from the first. The
// question «حكم قول يا معطي لا تبطي» was answered with a confident verdict on that exact
// expression — that it is fine, commendable, among the finest supplications — and the verdict was
// hung on an islamweb fatwa that never mentions the expression at all. One run cited 121485
// («مسألة حول الدعاء بأسماء الله الحسنى»), another cited 120875 («معنى: اللهم لا مانع لما أعطيت،
// ولا معطي لما منعت»). Both are real, allow-listed, correctly-fetched pages. Neither rules on the
// phrase. The reply also produced a hadith wording assembled from more than one narration, and
// glossed a Gulf dialect word («تبطي» = تُبطئ, "be slow") as though it meant "stop giving".
//
// THE RULE, in one line: A GENERAL SOURCE ESTABLISHES A GENERAL PRINCIPLE ONLY. A page proving
// that supplicating God by His names is legitimate does not license the sentence "«يا معطي لا
// تبطي» is a commendable formula". It licenses the general principle, said as a general
// principle, with the gap stated out loud.
//
// WHAT IS AND IS NOT CHECKED HERE. This module decides two things and nothing else:
//   * whether a question turns on a SPECIFIC expression or incident, rather than a general rule;
//   * whether a retrieved page ACTUALLY ADDRESSES that specific thing, by its text, not by its
//     domain and not by its title.
// It never decides what the ruling is, and it never repairs a reply. When a specific verdict is
// not supported, the whole reply is dropped for a sentence that makes no religious claim at all.
//
// IT DOES NOT REPLACE lib/attribution.js. That gate owns "who said it"; this one owns "does the
// page say it". A question can trip both, and the attributed path runs first.

import { norm as arNorm } from './attribution.js';
// ASK THE MUSHAF BEFORE CALLING A PHRASE UNKNOWN. See the block above detectSubject().
import { classifyFrozenPhrase } from './frozen-text.js';
import { classifyPurpose } from './source-purpose.js';

// ── The one refusal ──────────────────────────────────────────────────────────
// Says what was looked for, what was not found, and what can be offered instead. It asserts no
// ruling — not permission, not prohibition — because the failure here is an absence of evidence,
// and an absence of evidence is not evidence of either verdict.
export const CLAIM_REFUSAL =
  'لم أعثر في المصادر المتاحة على فتوى موثوقة تتناول هذه العبارة بعينها، لذلك لا أجزم بحكم خاص لها. '
  + 'أستطيع بيان الأصل العام الموثق، أو يُسأل عنها عالم موثوق.';

// Arabic punctuation sits inside the Arabic Unicode block, so it survives a naive keep-class and
// glues itself to the last word. MEASURED here too: «هل قول يا معطي لا تبطئ سنة؟» produced the
// subject «يا معطي لا تبطي سنه؟», with the verdict word still attached because «سنه؟» is not
// «سنه». Strip it before anything else looks at the text.
const AR_PUNCT = /[؀-؅،؛؞؟٪-٭۔۝«»]/g;
function norm(s) { return arNorm(String(s == null ? '' : s).replace(AR_PUNCT, ' ')); }

// ── 1. IS THIS QUESTION ABOUT A SPECIFIC THING? ──────────────────────────────
//
// The markers below are the ways Arabic introduces a named expression: حكم قول كذا, حكم عبارة
// كذا, حكم دعاء كذا, or the expression in quotation marks. A question with none of them —
// «هل يجوز أن أدعو الله بأسمائه الحسنى؟» — is a question about a RULE, and a general source is
// exactly the right evidence for it. Nothing here fires on those, by design: a gate that refused
// general questions would have replaced one defect with another.
const SUBJECT_MARKERS = [
  'حكم قول', 'ما حكم قول', 'حكم العباره', 'حكم عباره', 'حكم قولنا', 'حكم قولهم',
  'حكم دعاء', 'حكم الدعاء ب', 'حكم ذكر', 'حكم لفظ', 'حكم كلمه', 'حكم صيغه',
  'هل قول', 'هل عباره', 'هل يجوز قول', 'هل يجوز ان اقول', 'هل يصح قول', 'حكم ترديد',
];
// Words a question ends with that are the VERDICT being asked for, not part of the expression.
const TRAILING_VERDICT = new Set(['سنه', 'بدعه', 'حرام', 'جاىز', 'مستحب', 'مكروه', 'مشروع',
  'صحيح', 'خطا', 'شرك', 'محرم', 'واجب', 'ام لا', 'او لا', 'ولا', 'او', 'ام', 'هذا', 'ذلك',
  'الكلام', 'القول', 'العباره', 'الدعاء', 'شرعا', 'اسلاميا']);
// Anaphora: the question points at something said earlier in the conversation.
const ANAPHORA = ['هذه العباره', 'هذا القول', 'هذه الكلمه', 'هذا الدعاء', 'هذه الصيغه',
  'هذا الذكر', 'العباره السابقه', 'الكلام السابق', 'هذه الجمله'];

function stripTrailingVerdict(words) {
  const out = words.slice();
  while (out.length && TRAILING_VERDICT.has(out[out.length - 1])) out.pop();
  return out;
}

// A quoted span is the strongest possible signal that the reader means THESE words. Keep its
// word boundary as structured data as well: a later attribution found *inside* the quotation is
// content of the quoted words, not evidence about who governs the quotation.
function quotedSpans(text) {
  const out = [];
  const re = /[«"“”']([^«»"“”']{3,120})[»"“”']/g;
  let m;
  const raw = String(text || '');
  while ((m = re.exec(raw)) !== null) {
    out.push({
      text: m[1].trim(),
      // Raw character ownership stays here with the one quote parser. Consumers that use a
      // different normalizer convert this boundary into their own coordinate space.
      charStart: m.index,
      wordStart: norm(raw.slice(0, m.index)).split(' ').filter(Boolean).length,
    });
  }
  return out;
}
function quoted(text) { return quotedSpans(text).map((span) => span.text); }

// ── A QUOTED PHRASE IS NOT AUTOMATICALLY AN UNKNOWN PHRASE ───────────────────
//
// MEASURED: «ما تفسير «فإن مع العسر يسرًا»؟» was REFUSED by this gate. The quotation marks made it
// a "specific expression", the gate looked for a retrieved page ruling on that expression, found
// none, and told the reader so. The expression is Sūrat al-Sharḥ 94:5. The app ships the whole
// mushaf and never asked it.
//
// So before anything here concludes that a phrase is unattested, the phrase is matched — whole, or
// as a contiguous run — against quran-uthmani.json and adhkar.json. A hit means the reader quoted
// the Book or a known dhikr, which is a question for the tafsir or dhikr path and NOT a claim
// about an expression nobody has established.
//
// THIS DOES NOT WEAKEN THE GATE, and the distinction is the whole of it. «يا معطي لا تبطي» is in
// neither corpus, so it is still a specific expression and still may not receive a verdict without
// a page that addresses it — the assertion the original defect bought, unchanged. What changes is
// only that the Qur'an is no longer mistaken for a folk supplication.
//
// ── THE WORDING IS ATTESTED; A RULING ABOUT IT IS NOT ────────────────────────
//
// AND THIS IS WHY THE MATCH ALONE IS NOT ENOUGH TO RELEASE THE GATE. «ما حكم قول «اللهم صل على
// محمد» بعد الأذان؟» quotes a dhikr that IS in adhkar.json — and it is not asking what the words
// mean. It is asking whether saying them at that moment is prescribed, and that is exactly the
// kind of verdict this gate exists to stop the app inventing. Finding the words in a corpus proves
// the WORDING is established; it proves nothing about the RULING.
//
// So the corpus hit is recorded on every path — callers need it to route — but it only removes the
// «unattested expression» status when the reader is NOT asking for a ruling. A tafsir or meaning
// question about an āyah goes to the tafsir path, which is incident 4. A fatwa question keeps the
// gate, which is the defect this file was written for.
function frozenOf(phrase) {
  return classifyFrozenPhrase(phrase);
}
function releasedByCorpus(frozen, questionNormalized) {
  return !!frozen && classifyPurpose(questionNormalized) !== 'fatwa';
}

// Returns { specific, subject, source: 'quote'|'marker'|'anaphora', anaphoric, frozen? }
export function detectSubject(questionRaw) {
  const raw = String(questionRaw == null ? '' : questionRaw);
  const q = norm(raw);
  if (!q) return { specific: false, subject: '', source: null, anaphoric: false };

  // 1. quotation marks win outright
  const qs = quotedSpans(raw).filter((span) => norm(span.text).split(' ').length >= 2);
  if (qs.length) {
    // The mushaf first. A quoted āyah or a known dhikr is not an unattested expression — unless
    // the reader is asking for a ruling about it, in which case the ruling is still unattested.
    const quote = qs[0];
    const fz = frozenOf(quote.text);
    if (releasedByCorpus(fz, raw)) {
      return {
        specific: false, subject: '', source: 'quote', anaphoric: false,
        frozen: fz, phrase: quote.text, quoteCharStart: quote.charStart,
        quoteWordStart: quote.wordStart,
      };
    }
    const words = stripTrailingVerdict(norm(quote.text).split(' ').filter(Boolean));
    if (words.length >= 2) {
      return {
        specific: true, subject: words.join(' '), source: 'quote', anaphoric: false,
        quoteCharStart: quote.charStart, quoteWordStart: quote.wordStart,
        ...(fz ? { frozen: fz } : {}),
      };
    }
  }

  // 2. an introducing marker, with the expression after it
  for (const mk of SUBJECT_MARKERS) {
    const i = q.indexOf(mk);
    if (i === -1) continue;
    const after = q.slice(i + mk.length).trim();
    if (!after) continue;
    const words = stripTrailingVerdict(after.split(' ').filter(Boolean)).slice(0, 12);
    // ONE word is enough after an explicit "the ruling on saying —". «حكم قول آمين» names a
    // specific utterance as surely as a four-word one does, and the threshold matters beyond
    // tidiness: see subjectSwallowsName below, where a subject the question actually names is
    // what stops the attribution gate reading that utterance as the name of a scholar.
    const need = mk.indexOf('قول') !== -1 || mk.indexOf('لفظ') !== -1 || mk.indexOf('كلمه') !== -1 ? 1 : 2;
    if (words.length >= need) {
      // The same question, asked of an expression introduced by a marker rather than by quotes.
      const fz = frozenOf(words.join(' '));
      if (releasedByCorpus(fz, raw)) {
        return { specific: false, subject: '', source: 'marker', anaphoric: false, frozen: fz, phrase: words.join(' ') };
      }
      return { specific: true, subject: words.join(' '), source: 'marker', anaphoric: false, ...(fz ? { frozen: fz } : {}) };
    }
  }

  // 3. the reader is pointing at something from an earlier turn. Specific, but the subject has to
  //    come from the conversation — and if it cannot, that is a refusal, not a licence to answer
  //    generally about an expression nobody has identified.
  for (const a of ANAPHORA) {
    if (q.indexOf(a) !== -1) return { specific: true, subject: '', source: 'anaphora', anaphoric: true };
  }

  return { specific: false, subject: '', source: null, anaphoric: false };
}

// Resolve an anaphoric question against earlier user turns, newest first.
export function detectSubjectInThread(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const users = list.filter((m) => m && m.role === 'user').map((m) => (
    typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.filter((b) => b && b.type === 'text').map((b) => b.text).join(' ')
        : ''
  ));
  if (!users.length) return { specific: false, subject: '', source: null, anaphoric: false };
  const here = detectSubject(users[users.length - 1]);
  if (!here.specific || !here.anaphoric) return here;
  for (let i = users.length - 2; i >= 0; i--) {
    const prev = detectSubject(users[i]);
    if (prev.specific && prev.subject) return { ...here, subject: prev.subject, resolvedFrom: i };
  }
  return here;                              // still anaphoric and still unresolved ⇒ no subject
}

// THE EXPRESSION BEING ASKED ABOUT IS NOT THE PERSON WHO RULED ON IT.
//
// MEASURED, and it is a live false positive in the attribution gate as shipped: the pattern
// «قول فلان» is how Arabic introduces a scholar's opinion, so «حكم قول يا معطي لا تبطي» was read
// as a question about the views of a scholar named «يا معطي لا تبطي», and answered with the
// attribution refusal instead of being examined at all. The two gates need one rule to tell them
// apart, and this is it: if what the attribution gate captured as a name is the very expression
// this question is about, it is not a name.
export function subjectSwallowsName(subject, scholarName) {
  if (!subject || !subject.specific || !subject.subject) return false;
  const n = norm(scholarName);
  if (!n) return false;
  const s = ' ' + subject.subject + ' ';
  return s.indexOf(' ' + n + ' ') !== -1 || subject.subject === n;
}

// ── 2. DIALECT, HANDLED CONSERVATIVELY ───────────────────────────────────────
//
// «لا تبطي» is Gulf for «لا تُبطئ» — do not be slow. The production answer read it as "do not
// stop giving", which is a different word and a different request, and then ruled on its own
// misreading. The fix is NOT a lookup entry for this sentence; it is a small, general set of
// orthographic variants for any Arabic phrase, used to WIDEN THE SEARCH and to widen what counts
// as "the source is talking about this phrase".
//
// TWO RULES, and they are deliberately timid:
//   * a word ending in ي may also be spelled ئ  (تبطي → تبطئ) — the dropped hamza, which is the
//     commonest dialect spelling there is, and the one this defect turned on;
//   * the vocative يا may be absent.
// (Alif/yāʾ maqṣūra and hamza seats are already folded by the shared normaliser, so they need no
// rule of their own.) NOTHING here inserts a letter inside a word, so «تبطي» can never become
// «تبطلي». And a variant is never evidence: a page found through one still has to contain the
// phrase before a single specific thing may be said about it.
const MAX_VARIANTS = 8;
export function phraseVariants(subject) {
  const base = norm(subject);
  if (!base) return [];
  const set = new Set([base]);
  const words = base.split(' ');

  for (let i = 0; i < words.length && set.size < MAX_VARIANTS; i++) {
    const w = words[i];
    if (w.length < 3 || w.slice(-1) !== 'ي') continue;
    const copy = words.slice();
    copy[i] = w.slice(0, -1) + 'ئ';
    set.add(copy.join(' '));
  }
  // the same phrase without its vocative particle
  for (const v of Array.from(set)) {
    if (set.size >= MAX_VARIANTS) break;
    if (v.startsWith('يا ')) set.add(v.slice(3));
  }
  return Array.from(set).slice(0, MAX_VARIANTS);
}

// ── 3. DOES THIS PAGE ADDRESS THAT SUBJECT? ──────────────────────────────────
//
// Two ways to say yes, both about the page's TEXT. The host is irrelevant here — every page that
// reaches this point already came from an allow-listed host, and that is exactly the assurance
// that failed. So is the title: «معنى: اللهم لا مانع لما أعطيت، ولا معطي لما منعت» shares the word
// معطي with the reader's question and rules on something else entirely.
const WINDOW_WORDS = 15;
export function pageAddressesSubject(subject, pageText) {
  const hay = ' ' + norm(pageText) + ' ';
  if (!hay.trim() || !norm(subject)) return false;

  // (a) the phrase, or one of its conservative variants, appears as written
  for (const v of phraseVariants(subject)) {
    if (v && hay.indexOf(' ' + v + ' ') !== -1) return true;
    if (v && hay.indexOf(v) !== -1 && v.split(' ').length >= 2) return true;
  }

  // (b) every substantive word of the phrase appears inside one short window. This catches a page
  //     that quotes the expression with a word of its own in the middle, without catching a page
  //     that merely uses the same vocabulary two paragraphs apart.
  const want = norm(subject).split(' ').filter((w) => w.length >= 3);
  if (want.length < 2) return false;
  const hw = hay.trim().split(' ');
  for (let i = 0; i + 1 < hw.length; i++) {
    const win = hw.slice(i, i + WINDOW_WORDS);
    if (want.every((w) => win.some((x) => x.indexOf(w) !== -1))) return true;
  }
  return false;
}

// Which of the retrieved pages address it? Returns the subset, in retrieval order.
export function sourcesAddressingSubject(subject, sources) {
  const list = Array.isArray(sources) ? sources : [];
  if (!norm(subject)) return [];
  return list.filter((s) => s && pageAddressesSubject(subject, String(s.passage || '') + ' ' + String(s.title || '')));
}

// ── 4. WHAT COUNTS AS A SPECIFIC VERDICT IN THE REPLY ────────────────────────
//
// These are the words that turn a description into a ruling. Both directions are listed on
// purpose: the danger is not only telling a reader that something is recommended when no source
// says so, it is equally telling her it is an innovation when no source says that either. A gate
// that guarded one way round would be a gate with an opinion.
const VERDICT_WORDS = [
  'مستحب', 'يستحب', 'محمود', 'مشروع', 'سنه', 'من السنه', 'مندوب', 'افضل الدعاء', 'ارقي',
  'من ارقي', 'من افضل', 'لا باس به', 'جاىز', 'يجوز', 'مباح',
  'بدعه', 'محدث', 'حرام', 'محرم', 'لا يجوز', 'مكروه', 'ممنوع', 'منهي عنه', 'شرك', 'باطل',
];
export function verdictWordsIn(text) {
  const t = ' ' + norm(text) + ' ';
  return VERDICT_WORDS.filter((w) => t.indexOf(norm(w)) !== -1);
}

// WHICH verdicts are about THIS expression, rather than about the general rule behind it. This
// distinction is the whole of rule 5 in the brief: a general source establishes a general
// principle, and a reply is allowed — encouraged — to state that principle, provided it does not
// dress it up as a ruling on the expression the reader asked about.
//
// So the unit is the SENTENCE. A sentence counts as ruling on the expression when it carries a
// verdict word AND either quotes the expression (in any of its conservative spellings) or points
// at it («هذه العبارة», «هذا القول»). A sentence that does neither is talking about the general
// rule, and it passes. And a sentence that is explicitly DISCLAIMING a specific ruling — "I found
// nothing on this expression itself" — is the outcome this gate wants, so its verdict words are
// not held against it.
const DEICTIC = ['هذه العباره', 'هذا القول', 'هذه الكلمه', 'هذا الدعاء', 'هذه الصيغه', 'هذا الذكر',
  'هذه الجمله', 'قولها', 'قولك', 'ترديدها', 'هذا اللفظ'];
const DISCLAIMER = ['لم اجد', 'لا اجزم', 'لا احكم', 'بعينها', 'بعينه', 'الاصل العام', 'لا يتناول',
  'لم ينص', 'اسال عالما', 'يسال عنها', 'عالما موثوقا', 'لم اقف'];
export function specificVerdicts(reply, subject) {
  const subj = norm(subject && subject.subject);
  if (!subj) return [];
  const variants = phraseVariants(subj);
  const out = [];
  for (const raw of String(reply == null ? '' : reply).split(/[.؟!\n]+/)) {
    const s = ' ' + norm(raw) + ' ';
    if (!s.trim()) continue;
    if (DISCLAIMER.some((d) => s.indexOf(d) !== -1)) continue;
    const verdicts = VERDICT_WORDS.filter((w) => s.indexOf(norm(w)) !== -1);
    if (!verdicts.length) continue;
    const aboutIt = variants.some((v) => v && s.indexOf(v) !== -1) || DEICTIC.some((d) => s.indexOf(d) !== -1);
    if (aboutIt) out.push(...verdicts);
  }
  return Array.from(new Set(out));
}

// ── 5. HADITH ────────────────────────────────────────────────────────────────
//
// The lock the brief calls إلزامي, and it checks three things separately because they fail
// separately: the WORDING, the ATTRIBUTION (who narrated it), and the GRADING (whether it is
// sound). The production answer got all three wrong at once — a wording assembled out of more
// than one narration, credited to al-Tirmidhī, and declared authenticated by al-Albānī.
//
// A merged wording is exactly what a contiguous match refuses: no single page carries a sentence
// that was built by welding two narrations together, however true each half may be on its own.
const NARRATION_CUES = ['قال رسول الله', 'قال النبي', 'عن النبي', 'عن رسول الله', 'قال صلي الله عليه وسلم',
  'في الحديث', 'الحديث الذي', 'ورد في الحديث', 'روي عن'];
const ATTRIBUTION_CUES = ['رواه', 'اخرجه', 'متفق عليه', 'في الصحيحين', 'صحيح البخاري', 'صحيح مسلم'];
const GRADING_CUES = ['صحيح', 'حسن', 'ضعيف', 'موضوع', 'صححه', 'حسنه', 'ضعفه'];
// A narration credited to a named collector or grader — "رواه الترمذي", "صححه الألباني".
const NAMED_AUTHORITY = /(?:رواه|اخرجه|صححه|حسنه|ضعفه)\s+([؀-ۿ]+(?:\s+[؀-ۿ]+)?)/g;
// The shortest run of words we will treat as "this is a quoted narration" for matching purposes.
const MIN_HADITH_WORDS = 6;

// Pull out what the reply is presenting AS a hadith: any quoted span, plus any sentence carrying
// a narration cue. Deliberately over-collects; every candidate is then required to be found.
export function hadithClaims(reply) {
  const raw = String(reply == null ? '' : reply);
  const claims = [];
  for (const q of quoted(raw)) {
    if (norm(q).split(' ').length >= MIN_HADITH_WORDS) claims.push(q);
  }
  const nRaw = norm(raw);
  for (const cue of NARRATION_CUES) {
    let i = nRaw.indexOf(cue);
    while (i !== -1) {
      const rest = nRaw.slice(i + cue.length).split(/[.؟!]/)[0];
      if (rest && rest.split(' ').filter(Boolean).length >= MIN_HADITH_WORDS) claims.push(rest.trim());
      i = nRaw.indexOf(cue, i + cue.length);
    }
  }
  return Array.from(new Set(claims.map((c) => c.trim()))).filter(Boolean);
}

// Is a run of at least MIN_HADITH_WORDS words of `claim` present contiguously in some page?
export function hadithWordingFound(claim, sources) {
  const words = norm(claim).split(' ').filter(Boolean);
  if (words.length < MIN_HADITH_WORDS) return true;      // too short to be a narration claim
  const hays = (Array.isArray(sources) ? sources : [])
    .map((s) => ' ' + norm(String((s && s.passage) || '') + ' ' + String((s && s.title) || '')) + ' ');
  if (!hays.length) return false;
  for (let i = 0; i + MIN_HADITH_WORDS <= words.length; i++) {
    const run = words.slice(i, i + MIN_HADITH_WORDS).join(' ');
    if (hays.some((h) => h.indexOf(run) !== -1)) return true;
  }
  return false;
}

// Every collector or grader the reply names must be named on a page we actually retrieved, and
// every grading word it uses must appear there too. A true grading attached by memory to a
// wording nobody published is still a fabrication.
export function hadithProblems(reply, sources) {
  const problems = [];
  const nRep = norm(reply);
  const hay = (Array.isArray(sources) ? sources : [])
    .map((s) => norm(String((s && s.passage) || '') + ' ' + String((s && s.title) || ''))).join(' \n ');

  const presentsHadith = NARRATION_CUES.some((c) => nRep.indexOf(c) !== -1)
    || ATTRIBUTION_CUES.some((c) => nRep.indexOf(c) !== -1);
  if (!presentsHadith) return problems;

  for (const claim of hadithClaims(reply)) {
    if (!hadithWordingFound(claim, sources)) {
      problems.push('unsourced-hadith-wording:' + claim.slice(0, 40));
      break;                                   // one is enough; the reply is dropped whole
    }
  }
  let m;
  NAMED_AUTHORITY.lastIndex = 0;
  while ((m = NAMED_AUTHORITY.exec(nRep)) !== null) {
    const who = (m[1] || '').trim();
    if (who && hay.indexOf(who) === -1) { problems.push('unsourced-hadith-attribution:' + who); break; }
  }
  for (const g of GRADING_CUES) {
    // a grading only counts as a CLAIM when it is applied to a narration, i.e. next to one of the
    // attribution cues; "الدعاء صحيح" is not a takhrij.
    const re = new RegExp('(?:' + ATTRIBUTION_CUES.join('|') + '|حديث)\\s*[\\u0600-\\u06FF ]{0,24}' + g);
    if (re.test(nRep) && hay.indexOf(g) === -1) { problems.push('unsourced-hadith-grading:' + g); break; }
  }
  return problems;
}

// ── 6. THE GATE ──────────────────────────────────────────────────────────────
//
// Called on a DEEN reply BEFORE a byte of it is emitted. Returns { ok, problems, supporting }.
// `supporting` is the subset of retrieved pages that actually address the specific subject — the
// caller shows one of those as the card when there is one.
export function verifyClaims(reply, subject, sources) {
  const problems = [];
  const list = Array.isArray(sources) ? sources : [];
  const text = String(reply == null ? '' : reply);

  // Hadith is checked on EVERY reply that reaches this gate, specific subject or not.
  problems.push(...hadithProblems(text, list));

  if (!subject || !subject.specific) return { ok: problems.length === 0, problems, supporting: list };

  const supporting = subject.subject ? sourcesAddressingSubject(subject.subject, list) : [];
  // An anaphoric question nobody ever resolved has no subject, so no sentence can be matched
  // against it. That is not a licence: any verdict at all is unsupportable when we cannot even
  // say what is being ruled on.
  const verdicts = subject.subject ? specificVerdicts(text, subject) : verdictWordsIn(text);
  if (verdicts.length && !supporting.length) {
    // THE CENTRAL RULE. A verdict on this expression, and not one retrieved page that so much as
    // mentions it. The general source may support the general principle; it cannot support this.
    problems.push('specific-verdict-without-matching-source:' + verdicts.slice(0, 3).join(','));
  }
  return { ok: problems.length === 0, problems, supporting };
}

// ── 7. WHAT THE MODEL IS TOLD, BEFORE IT WRITES ──────────────────────────────
// The gate above is the guarantee; this is what makes the guarantee rarely necessary. It states
// plainly whether any retrieved page mentions the expression, and what may be said in each case.
export function buildClaimInstruction(subject, supporting) {
  if (!subject || !subject.specific) return '';
  const head = subject.subject
    ? 'السؤالُ يدورُ على عبارةٍ بعينِها: «' + subject.subject + '».'
    : 'السؤالُ يدورُ على عبارةٍ بعينِها لم تُحدَّدْ في هذه المحادثة.';
  if (supporting && supporting.length) {
    return [
      head,
      'ومن بينِ المصادرِ المسترجَعةِ ما يتناولُ هذه العبارةَ نفسَها، فابْنِ الحكمَ الخاصَّ عليه وحدَه،',
      'ولا تُضِفْ وصفًا شرعيًّا (استحبابًا أو سنّيّةً أو بدعةً أو تحريمًا) لم يَنُصَّ عليه.',
    ].join('\n');
  }
  return [
    head,
    'ولا يوجدُ في المصادرِ المسترجَعةِ ما يتناولُ هذه العبارةَ بعينِها.',
    'فلا تُصدِرْ حكمًا خاصًّا عليها البتّةَ: لا تقلْ إنّها مستحبّةٌ ولا محمودةٌ ولا من أفضلِ الدعاء،',
    'ولا تقلْ إنّها بدعةٌ ولا محرّمةٌ. المنعُ بلا دليلٍ كالإباحةِ بلا دليل.',
    'اذكرِ الأصلَ العامَّ الموثَّقَ من المصدرِ إن وُجِد، وصرِّحْ بأنّ المصدرَ يُقرِّرُ الأصلَ العامَّ',
    'ولا يحكمُ على هذه العبارةِ بعينِها، ثمّ انصَحْ بسؤالِ عالمٍ موثوقٍ عنها.',
    'ولا تشرحْ معنى ألفاظِ العبارةِ من عندِك، ولا تنسبْ إليها فضلًا.',
  ].join('\n');
}
