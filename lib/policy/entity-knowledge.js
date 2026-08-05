// lib/policy/entity-knowledge.js
// WHO IS THIS PERSON, ACTUALLY?
//
// ── THE FAILURE ──────────────────────────────────────────────────────────────
// «ما رأي خالد عبدالرحمن في قصر الصلاة؟» — a singer. The lexical classifier sees the shape «ما رأي
// فلان في كذا» and calls it a request for a scholar's position, no registry knows the name, and the
// reader is asked to supply the shaykh's official website. The app went looking for a fatwa by a
// musician and then apologised for not finding one.
//
// ── WHY A REGISTRY CANNOT FIX THIS ───────────────────────────────────────────
// The registries answer "is this one of OUR scholars". They cannot answer "is this a scholar at
// all", because the set of people who are not scholars is everybody else alive and dead. Listing
// singers is not a plan. This is the one question in the pipeline where open world knowledge is the
// right instrument, and the model already has it.
//
// ── WHERE IT IS ALLOWED TO RUN ───────────────────────────────────────────────
// ONLY when the deterministic side has already said: a name was captured, and no registry knows it,
// and it is not a registered historical figure. So «ابن باز» and «ابن تيمية» never reach this file —
// they resolve — and neither pays for the call or risks its answer. A real scholar we simply have
// not registered lands here too, which is why `unknown` is a first-class verdict and why nothing is
// asserted about a person unless the model is confident AND supplies an identity.
//
// ── WHAT IT MAY NEVER DO ─────────────────────────────────────────────────────
// It classifies a NAME. It never rules, never decides the fiqh, never chooses a source, and its
// output can only ever NARROW what the app claims: `non_scholar` removes an attribution path, and
// nothing here can add one. A failure of any kind reads as `unknown`, which leaves the shipped
// behaviour exactly as it was.





import { subjectSwallowsName } from '../claim-gate.js';
import { resolveScholar } from '../source-registry.js';

/** Is this name one the contemporary registry already knows for certain? */
function isRegisteredScholar(name) {
  try { return resolveScholar(String(name || '')).status === 'resolved'; } catch { return false; }
}

export const TYPES = Object.freeze(['scholar', 'non_scholar', 'unknown']);

/**
 * The name this question hangs on, when — and only when — the deterministic side has run out of
 * ways to identify it. Returns '' when no world check is warranted, which is the common case.
 */
// TAKES THE PLAN, NOT THE QUESTION. planAsk() does not simply echo detectAttribution() — the entity
// IR vetoes it, the honorific frames feed it, and the rollout flag changes it — so re-deriving the
// mode here from the raw text produced a DIFFERENT answer from the one the handler acts on. Reading
// the decision the handler already made is the only way the two cannot disagree.
/**
 * THE SUBJECT OF A «من هو …؟» QUESTION, extracted structurally.
 *
 * WHY THIS EXISTS. lib/policy/core.js classifies on the PHRASE «من هو» and nothing else, so every
 * identity question — about a footballer, a physicist, a company — was typed `biography`, and
 * `biography` is a RELIGIOUS row in the access matrix. A reader asking who a singer is was routed
 * into the closed sharia path by two words, before anybody asked who the man was.
 *
 * No names are matched here, and none are listed anywhere: this reads the SHAPE of the sentence and
 * hands the subject to the world check, which is the only part that knows anything about people.
 */
export function identityQuestionSubject(question) {
  const q = String(question || '').trim();
  if (!q) return '';
  const m = q.match(/(?:^|\s)(?:مَن\s+هو|مَن\s+هي|من\s+هو|من\s+هي|منو|مين)\s+([^؟?!.,،\n]{2,60})/u);
  if (!m) return '';
  return m[1]
    .replace(/^(?:ال)?(?:شيخ|شيخة|علامة|إمام|امام|دكتور|أستاذ|استاذ|فنان|لاعب|مطرب)\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameNeedingWorldCheck(plan, question) {
  if (!plan) return '';
  // ── SHAPE ONE: «من هو فلان؟» ───────────────────────────────────────────────
  // Asked BEFORE the attribution shape below, because an identity question carries no attribution
  // at all — there is no «رأي» to capture — and it is the shape the lexical `biography` rule
  // mishandles. A registered person is skipped exactly as in the other shape.
  const subject = identityQuestionSubject(question);
  if (subject
    && !(plan.entities || []).some((e) => e.targetType === 'person' && e.resolutionStatus === 'resolved')
    && !(plan.entities || []).some((e) => e.targetType === 'madhhab')
    && plan.authorityEra !== 'historical'
    && plan.scholarStatus !== 'resolved'
    // An identity question carries no attribution, so `scholarStatus` is 'n/a' and the registry
    // has to be asked directly — otherwise «من هو ابن باز؟» spends a model call establishing
    // something we already know for certain.
    && !isRegisteredScholar(subject)) {
    return subject;
  }
  // THE LEXICAL CAPTURE, NOT THE FINAL MODE. On the internal path the entity IR already vetoes
  // «ما رأي خالد عبدالرحمن في كذا» down to `none`, which stops the app hunting for his fatwa — and
  // still leaves the reader thinking a singer has one, because nothing tells him otherwise. So the
  // trigger is what the lexical layer CAPTURED, which survives the veto and is present on both
  // sides of the rollout flag.
  const at = plan.attribution || {};
  if (at.mode !== 'namedScholarOpinion') return '';
  const name = String(at.scholarName || '').trim();
  if (!name) return '';
  // A CAPTURE THE PLANNER ALREADY DISOWNED IS NOT A NAME. «ما حكم قول يا معطي لا تبطي؟» yields the
  // "scholar" «يا معطي لا تبطي» — the subject of the question swallowed the capture whole, which is
  // exactly what subjectSwallowsName() exists to notice. Asking the world who that is spends a
  // model call on a phrase. The same function the planner uses is reused here, so the two cannot
  // disagree about which captures are real.
  try { if (subjectSwallowsName(plan.claimSubject, name)) return ''; } catch { /* not fatal */ }
  // A purpose-built adapter, or a registered contemporary with a corpus of his own.
  if (plan.hasDirectAdapter) return '';
  if (plan.scholarStatus === 'resolved') return '';
  // A registered historical figure: the roster resolved him, and the encyclopedic path is his.
  if (plan.authorityEra === 'historical') return '';
  // Any registered person the IR recognised, even where the veto emptied `namedEntity`.
  if ((plan.entities || []).some((e) => e.targetType === 'person' && e.resolutionStatus === 'resolved')) return '';
  // A SCHOOL IS NOT A PERSON, so asking the world who «الحنابلة» is would be asking the wrong
  // question about the wrong kind of thing. The lexical layer captures it as a name; the IR knows
  // better, and the IR wins.
  if (plan.targetType === 'madhhab') return '';
  if ((plan.entities || []).some((e) => e.targetType === 'madhhab')) return '';
  return name;
}

/**
 * THE PROMPT. One name, one JSON object, no discussion.
 *
 * It asks for an identity in Arabic because the drafting step reads it back to the reader, and a
 * label the reader cannot understand is worse than none. It offers `unknown` explicitly and says
 * when to use it, because a classifier with no way to decline invents an answer instead.
 */
export function worldCheckPrompt(name) {
  return [
    'مهمّتك تحديدُ هُويّةِ اسمٍ واحدٍ فقط، ولا شأنَ لك بالسؤالِ الشرعيِّ ولا بالحكم.',
    '',
    'الاسم: «' + String(name || '').trim() + '»',
    '',
    'أجب بكائنِ JSON واحدٍ فقط، بلا أيِّ نصٍّ قبله أو بعده، بهذا الشكل:',
    '{"type":"scholar|non_scholar|unknown","identity_ar":"…","confidence":"high|low"}',
    '',
    '- "scholar": عالمُ دينٍ أو مفتٍ أو فقيهٌ أو محدِّثٌ أو قاضٍ شرعيٌّ، ممّن تُؤخذ عنه الفتوى.',
    '- "non_scholar": شخصيّةٌ عامّةٌ غيرُ مختصّةٍ بالإفتاء: مغنٍّ، ممثِّل، لاعبُ كرة، سياسيّ، إعلاميّ،',
    '  رجلُ أعمال، عالمٌ في تخصّصٍ دنيويّ، أو اسمُ لعبةٍ أو تطبيقٍ أو شركة.',
    '- "unknown": إن لم تعرفْ هذا الاسمَ معرفةً واثقة، أو اشتبه عليك بين أكثرَ من شخص،',
    '  أو كان الاسمُ عامًّا لا يدلُّ على معيَّن. الشكُّ يوجبُ "unknown" ولا يجوز التخمين.',
    '',
    'واحترسْ: كلُّ اسمٍ دينيٍّ فجوابُه "scholar" لا "non_scholar" — الأنبياءُ والرسلُ والصحابةُ',
    'وأمّهاتُ المؤمنين والتابعون وأعلامُ الدينِ ورواةُ الحديث، وكذلك لفظُ الجلالةِ وأسماءُ الملائكة.',
    'هؤلاء ليسوا «شخصيّاتٍ عامّةً دنيويّة» ولو لم يكونوا مفتين، والسؤالُ عنهم سؤالٌ دينيٌّ.',
    '',
    '- "identity_ar": وصفٌ قصيرٌ جدًّا بالعربيّة لهويّته الحقيقيّة، مثل «مغنٍّ سعوديّ» أو «لاعبُ كرةِ قدمٍ مصريّ».',
    '  اتركْه فارغًا مع "unknown".',
    '- "confidence": "high" فقط إن كنتَ واثقًا من الشخصِ المعيَّن.',
  ].join('\n');
}

/** Parse the verdict. ANY failure — malformed, unexpected type, missing identity — is `unknown`. */
export function parseWorldVerdict(raw) {
  const fallback = { type: 'unknown', identityAr: '', confidence: 'low' };
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  let o;
  try { o = JSON.parse(m[0]); } catch { return fallback; }
  if (!o || typeof o !== 'object') return fallback;
  const type = TYPES.includes(o.type) ? o.type : 'unknown';
  const identityAr = typeof o.identity_ar === 'string' ? o.identity_ar.trim().slice(0, 80) : '';
  const confidence = o.confidence === 'high' ? 'high' : 'low';
  // A verdict that names nobody cannot be read out to a reader, so it is not actionable.
  if (type === 'non_scholar' && (!identityAr || confidence !== 'high')) return fallback;
  return { type, identityAr, confidence };
}

/**
 * MAY THE APP TELL THE READER WHO THIS IS?
 *
 * Only for a confident `non_scholar` carrying an identity. Everything else — `scholar`, `unknown`,
 * a low-confidence guess — leaves the shipped behaviour untouched, because saying "he is not a
 * scholar" about a shaykh we merely failed to register would be a worse error than the one this
 * whole module exists to fix.
 */
export function isActionableNonScholar(verdict) {
  return !!verdict && verdict.type === 'non_scholar'
    && verdict.confidence === 'high' && !!verdict.identityAr;
}

/**
 * Strip a person's name out of a search query.
 *
 * «ما رأي خالد عبدالرحمن في قصر الصلاة؟» must reach the provider as «قصر الصلاة»: the sources hold
 * the ruling, and nobody has published what a singer thinks of it. Leaving the name in spends a
 * search on a query that cannot match and then reads the empty result as "no evidence".
 */
export function stripEntityFromQuery(query, name) {
  const q = String(query || '');
  const n = String(name || '').trim();
  if (!n) return q.trim();
  let out = q;
  // The whole name first, then its individual words, so a partial capture cannot leave a fragment.
  for (const part of [n, ...n.split(/\s+/)].filter((p) => p && p.length > 2)) {
    out = out.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
  }
  return out
    // The frame the name hung in is now empty too: «ما رأي  في قصر الصلاة» → «قصر الصلاة».
    .replace(/(?:^|\s)(?:ما|وما|ايش|ماذا)\s+(?:هو|هي)?\s*(?:رأي|راي|قول|رايك|قال|يقول)\s*/gu, ' ')
    .replace(/(?:^|\s)(?:الشيخ|الشيخة|العلامة|الإمام|الامام|الدكتور|الفقيه|المفتي)\s*/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // Whatever the frame left at the front is not part of the topic: a bare «رأي», or the
    // preposition that used to govern the name. «في قصر الصلاة» is a fragment; «قصر الصلاة» is a
    // query. Repeated because removing one can expose the next.
    .replace(/^(?:(?:رأي|راي|قول|عن|في|حول|بخصوص|بشأن)\s+)+/u, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s،,؟?.-]+|[\s،,؟?]+$/g, '')
    .trim();
}

/**
 * The drafting note. The reader asked a real question and deserves both halves of the answer:
 * who the person actually is, said kindly and without mockery, and then the ruling he asked about
 * from the sources — never from the model's memory, and never credited to the person named.
 */
export function nonScholarDraftingNote(name, identityAr) {
  return [
    'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
    'سأل القارئُ عن رأيِ «' + name + '»، وهو ' + identityAr + ' وليس من أهلِ الإفتاء.',
    '- ابدأْ بجملةٍ واحدةٍ لطيفةٍ محترمةٍ تُبيِّنُ هُويّتَه الحقيقيّةَ وأنّ الفتوى لا تُؤخذ عنه، بلا سخريةٍ ولا تنقُّصٍ ولا موعظة.',
    '- ثمّ أجبْ عن المسألةِ الشرعيّةِ نفسِها إجابةً كاملةً مفيدةً من المصادرِ المسترجَعةِ أعلاه وحدَها.',
    '- لا تنسبْ إليه رأيًا ولا قولًا ولا موقفًا في المسألة البتّةَ، ولو بالنفي.',
    '- انسبِ الحكمَ إلى المصدرِ الذي ورد فيه.',
    '- لا تحكمْ عليه هو بشيءٍ: لا تعديلَ ولا تجريحَ ولا كلامَ في دينِه أو عملِه.',
  ].join('\n');
}
