// lib/ledger/draft.js
// THE DRAFTER SEES VERIFIED CLAIMS AND NOTHING ELSE.
//
// Not the pages, not the spans, not the search results, not its own earlier attempts, and not
// the reader's question in raw form. That is the whole design: a drafter that can see the page
// can quote the page, and a sentence quoting a page is a sentence nobody verified.
//
// EACH SENTENCE DECLARES WHICH CLAIM IT RESTS ON. That declaration is what Gate 3 checks, and
// it is why a sentence must map to ONE claim by default — a sentence resting on two claims is
// asserting a relationship between them, and a relationship is a new claim that no source made.
// Several claims are permitted in one sentence only when they belong to one view and the
// sentence merely enumerates them.
//
// A COMPARISON BETWEEN TWO POSITIONS IS NOT DRAFTED. It is assembled from a fixed template in
// lib/ledger/assemble.js, because the interesting part of a comparison is the connective — and
// a generated connective ("but", "however", "the stronger view") is an opinion with no source.

import { callModel, parseJsonReply } from './model.js';

export const DRAFTER_VERSION = 'draft-v1';

const SYSTEM = [
  'أنت صائغُ جوابٍ مقيَّد. أمامَك ادّعاءاتٌ موثَّقةٌ فقط، وليس أمامَك مصادرُ ولا نصوصُ صفحات.',
  'اكتبْ جوابًا عربيًّا موجزًا واضحًا مبنيًّا على هذه الادّعاءاتِ وحدَها.',
  'ممنوعٌ: أن تزيدَ حكمًا أو شرطًا أو استثناءً أو مدّةً أو عددًا أو دليلًا ليس في الادّعاءات.',
  'ممنوعٌ: أن تنسبَ قولًا إلى عالِمٍ أو جهةٍ لم يُنَصَّ عليها في الادّعاء.',
  'ممنوعٌ: أن تصفَ قولًا بأنّه الأحدثُ أو الأخيرُ أو الأرجحُ أو الأشهر.',
  'ممنوعٌ: أن تذكرَ رابطًا أو اسمَ موقعٍ أو وسمَ مصدر؛ التطبيقُ يُضيفُ بطاقةَ المصدرِ بنفسِه.',
  'ممنوعٌ: أن تذكرَ تفصيلًا صحيحًا لكنّه خارجَ ما سُئلَ عنه.',
  'كلُّ جملةٍ حكميّةٍ تُربَطُ بادّعاءٍ واحدٍ بمعرِّفِه. والجملةُ التمهيديّةُ التي لا تحملُ حكمًا تُترَكُ بلا ادّعاء.',
  'أجِبْ بـ JSON فقط.',
].join('\n');

export const DRAFT_SCHEMA_HINT =
  '{"sentences":[{"sentence_id":"s1","text":"...","claim_ids":["..."]}]}';

export function buildDraftPrompt(ledger, claims, issues) {
  const asked = issues.map((i) => [
    '- مسألة ' + i.issueId + ' (' + i.intent + ')'
      + (i.requestedAuthorityId ? ' — مطلوبٌ فيها رأيُ: ' + i.requestedAuthorityId : ''),
    '  المطلوبُ بيانُه: ' + i.requiredSlots.join('، '),
  ].join('\n')).join('\n');

  const body = claims.map((c) => {
    const comps = ledger.componentsOf(c.claimId)
      .map((k) => '    · [' + k.kind + '] ' + k.text).join('\n');
    return ['- (' + c.claimId + ') ' + c.text, comps].filter(Boolean).join('\n');
  }).join('\n');

  return [
    'ما سألَ عنه القارئُ، مسألةً مسألة:',
    asked,
    '',
    'الادّعاءاتُ الموثَّقةُ المسموحُ البناءُ عليها:',
    body,
    '',
    'اكتبِ الجوابَ جملةً جملة. لا تخرجْ عمّا سُئلَ عنه ولو كان صحيحًا.',
    'أعِدْ هذا الشكلَ حرفيًّا: ' + DRAFT_SCHEMA_HINT,
  ].join('\n');
}

/**
 * Read a draft into sentences. A sentence naming a claim that does not exist is DROPPED, not
 * repaired — the drafter has just demonstrated it is willing to name something it was not given.
 */
export function readDraftReply(text, ledger) {
  const obj = parseJsonReply(text);
  if (!obj || !Array.isArray(obj.sentences)) return { ok: false, reason: 'unparseable', sentences: [] };
  const sentences = [];
  obj.sentences.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const t = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!t) return;
    const ids = Array.isArray(raw.claim_ids)
      ? raw.claim_ids.filter((x) => typeof x === 'string' && ledger.claim(x))
      : [];
    // A sentence that names claims of which some do not exist is not partially trustworthy.
    const namedCount = Array.isArray(raw.claim_ids) ? raw.claim_ids.length : 0;
    if (namedCount !== ids.length) return;
    sentences.push({
      sentenceId: typeof raw.sentence_id === 'string' && /^[a-z0-9_]{1,24}$/i.test(raw.sentence_id)
        ? raw.sentence_id : 's' + (i + 1),
      index: i,
      text: t,
      claimIds: ids,
      carriesClaim: ids.length > 0,
      verified: null,
    });
  });
  return { ok: true, sentences };
}

export async function runDraft(ledger, claims, issues, { budget, fetchImpl, tier } = {}) {
  if (!claims.length) return { ok: false, reason: 'no-verified-claims', sentences: [] };
  const res = await callModel({
    system: SYSTEM, user: buildDraftPrompt(ledger, claims, issues),
    budget, purpose: 'drafting', tier, fetchImpl,
  });
  if (!res.ok) return { ok: false, reason: 'model:' + res.reason, sentences: [] };
  return readDraftReply(res.text, ledger);
}
