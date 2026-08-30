// Server-side adapter for the existing fatwa UI contract.  The base is fixed and
// cannot be supplied by a reader. Returned records remain untrusted data until they
// pass schema, scholar, host and topical-relevance checks below.

import { normalizeArabic } from './route-classify.js';
import { hostMatches } from './source-registry.js';
import { buildFatwaRecord, recordUsableAsFatwa } from './full-fatwa.js';
import { canonicalToken, topicTerms } from './stored-deen.js';
import { TERM_FAMILIES } from './data/lexicon-ar.js';
import {
  FATWA_BASE,
  FATWA_EXPECTED_IBN_BAZ_TOTAL,
  FATWA_EXPECTED_SCHOLARS,
  FATWA_EXPECTED_TOTAL,
  FATWA_SCHEMA,
  FATWA_SCHOLARS,
  fatwaContractTotals,
  resolveFatwaScholar,
} from './fatwa-contract.js';

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 9000;
const VERIFY_TTL_MS = 5 * 60 * 1000;
const MAX_RESULTS = 12;
const MAX_EVIDENCE_TEXT = 6000;
let verificationCache = null;

function signalFor(parent, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(250, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function cleanText(value, max = MAX_EVIDENCE_TEXT) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ')
    .replace(/<\/?source\b[^>]*>/giu, ' ')
    .replace(/\s+/gu, ' ').trim().slice(0, max);
}

async function readJson(path, { fetchImpl = globalThis.fetch, signal, timeoutMs } = {}) {
  const url = new URL(path, FATWA_BASE);
  if (url.origin !== FATWA_BASE || !url.pathname.startsWith('/api/v1/')) throw new Error('fatwa_path_refused');
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', signal: signalFor(signal, timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!response || !response.ok) throw new Error(`fatwa_http_${response && response.status}`);
  const final = new URL(response.url || url.href);
  if (final.origin !== FATWA_BASE) throw new Error('fatwa_redirect_refused');
  const type = String(response.headers?.get?.('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) throw new Error('fatwa_content_type');
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > MAX_JSON_BYTES) throw new Error('fatwa_body_too_large');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new Error('fatwa_body_too_large');
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('fatwa_invalid_json'); }
  if (!payload || payload.ok !== true || payload.schemaVersion !== FATWA_SCHEMA) throw new Error('fatwa_bad_contract');
  return payload;
}

export async function verifyFatwaService(options = {}) {
  const now = Date.now();
  if (!options.force && verificationCache && verificationCache.expiresAt > now) return verificationCache.value;
  const [health, registry] = await Promise.all([
    readJson('/api/v1/health', options),
    readJson('/api/v1/scholars', options),
  ]);
  const scholars = Array.isArray(registry.scholars) ? registry.scholars : [];
  const expected = new Map(FATWA_SCHOLARS.map((entry) => [entry.id, entry]));
  const failures = [];
  for (const item of scholars) {
    const wanted = expected.get(String(item && item.id || ''));
    const count = Number(item && item.snapshot && item.snapshot.records);
    if (!wanted || count !== wanted.count) failures.push(String(item && item.id || 'unknown'));
  }
  for (const id of expected.keys()) {
    if (!scholars.some((item) => item && item.id === id)) failures.push(`missing:${id}`);
  }
  const totals = fatwaContractTotals();
  const reportedTotal = scholars.reduce((sum, item) => sum + Number(item?.snapshot?.records || 0), 0);
  const healthCount = Array.isArray(health?.scholars)
    ? health.scholars.length
    : Number(health?.counts?.scholars || 0);
  if (scholars.length !== FATWA_EXPECTED_SCHOLARS) failures.push('scholar_count');
  if (reportedTotal !== FATWA_EXPECTED_TOTAL) failures.push('fatwa_total');
  if (healthCount !== FATWA_EXPECTED_SCHOLARS) failures.push('health_scholar_count');
  if (totals.total !== FATWA_EXPECTED_TOTAL || totals.ibnBaz !== FATWA_EXPECTED_IBN_BAZ_TOTAL) failures.push('pinned_contract');
  const value = Object.freeze({
    status: failures.length ? 'DEGRADED' : 'OK',
    scholars: scholars.length,
    total: reportedTotal,
    ibnBaz: Number(scholars.find((item) => item.id === 'binbaz')?.snapshot?.records || 0),
    failures: Object.freeze(failures),
  });
  if (failures.length) throw Object.assign(new Error('fatwa_snapshot_mismatch'), { verification: value });
  verificationCache = { expiresAt: now + VERIFY_TTL_MS, value };
  return value;
}

function searchQueriesFor(context) {
  const raw = cleanText(context?.resolvedTopic || context?.currentQuestion || '', 240);
  const folded = normalizeArabic(raw);
  // The service currently indexes the Ibn-Uthaymeen record under the noun form, while the
  // reader's common wording uses the verb form. This is a query synonym, not a new endpoint.
  if (/(?:اسقطت|سقط)\s+.*(?:ثمانين|80)/u.test(folded)) return ['سقط الجنين قبل ثمانين يوما'];
  // §8: the face-veil branch that used to sit here — returning two hand-written queries for
  // that one topic — is gone. It was one of the three manual cases, and its behaviour is now
  // reached generally: hybrid-deen adds a disagreement-seeking query for ANY ruling question,
  // so النقاب gets its second look for the same reason التأمين and الموسيقى now do.
  return raw ? [raw] : [];
}

function searchQueryFor(context) {
  return searchQueriesFor(context)[0] || '';
}

function expectedHost(record, scholar) {
  let url;
  try { url = new URL(record?.source?.canonicalUrl || record?.source?.url || ''); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./u, '');
  if (scholar.id === 'aljasser') {
    if (!['youtube.com', 'youtu.be', 'dr-mutlaq.com'].some((domain) => hostMatches(host, domain))) return null;
  } else if (!hostMatches(host, scholar.sourceDomain)) return null;
  return url.href;
}

// ── THE TERM-FAMILY BRIDGE, AND WHY IT IS AN `OR` AND NOT A LOWER THRESHOLD ──
//
// MEASURED, case (ج) of the round's seven: the model asked search_fatawa for «تغطية الوجه», got
// nothing, rephrased to «النقاب» exactly as §٣ requires — and STILL got nothing, because the
// corpus files that subject under titles like «حكم تغطية المرأة وجهها». The rephrasing worked and
// the filter below threw the result away. Freeing the model to choose its own words buys nothing
// while the acceptance test cannot recognise the corpus's own synonym.
//
// The tempting repair is to relax `need` or widen `directlyFramed`. That is measured wrong for
// the same reason 882eb29 recorded when it declined to lower stripPrefixes' length threshold: a
// relaxed threshold changes the verdict on records that already match, and a filter that admits
// more of everything admits the incidental ruling this file spent CX-03 learning to rank down.
//
// So the bridge is a pure disjunction bolted beside the existing test, and it can only ever ADD:
//   * `matched`, `need`, `directlyFramed`, `proximity` and every score component are untouched;
//   * a record that was accepted before is accepted now, with the SAME score — the bonus below is
//     paid only to a record the old test refused, so the ranking of the old set cannot shuffle;
//   * the family evidence must sit in the TITLE or the published QUESTION. An answer that merely
//     mentions the veil in passing does not become a fatwa about it, which is the same instinct
//     `directlyFramed` encodes for the ordinary path.
const familyTokens = (value) => new Set(normalizeArabic(value || '').split(/\s+/u).filter(Boolean));

/** Which families does this text belong to? Whole tokens only — see lexicon-ar.js on «زوجها». */
function termFamiliesIn(value) {
  const tokens = familyTokens(value);
  const found = new Set();
  for (const family of TERM_FAMILIES) {
    const hasGarment = family.garment.some((surface) => tokens.has(surface));
    const hasAct = family.act.some((surface) => tokens.has(surface));
    const hasObject = family.object.some((surface) => tokens.has(surface));
    if (hasGarment || (hasAct && hasObject)) found.add(family.key);
  }
  return found;
}

function topicalScore(record, context) {
  const terms = topicTerms(context?.resolvedTopic || context?.currentQuestion || '', context?.resolvedScholar)
    .map((term) => term.key).filter((key, index, all) => key && all.indexOf(key) === index).slice(0, 5);
  if (!terms.length) return { accepted: false, score: 0, matched: [] };
  const title = normalizeArabic(record.title || '');
  const question = normalizeArabic(record.content?.question || '');
  const answer = normalizeArabic(record.content?.answer || record.content?.answerExcerpt || '');
  // Match canonical word tokens, never substrings.  In particular, «الجمعة»
  // is not evidence for «الجمع بين الصلاتين» merely because it contains the
  // three letters جمع.
  // THE RULING-FAMILY ALIAS, MIRRORED FROM lib/hybrid-deen.js's canonicalWords().
  //
  // canonicalToken() strips a leading waw as a conjunction, so «واجبة» folds to «اجبه» and does
  // NOT match the topic term «واجب». hybrid-deen has carried a narrow alias for this for some
  // time; this filter did not, and the asymmetry had a direction. For «هل النقاب واجب؟» a corpus
  // fatwa phrased «تغطية الوجه غير واجبة» scored one matching term instead of two and was
  // REFUSED before it ever reached the evidence pack, while one phrased «واجب» was admitted.
  // The relevance filter was therefore discarding one SIDE of the disagreement — the
  // non-obligation side — and doing it silently, upstream of every khilaf rule in §8. Since the
  // owner's amendment made the fatwa service tier 1, that bias sat on the primary path.
  //
  // This adds the alias and nothing else: exact tokens still, no substring matching, so «الجمعة»
  // still cannot stand in for «الجمع».
  const wordKeys = (value) => {
    const out = [];
    for (const raw of value.split(/\s+/u)) {
      // MEASURED 2026-08-30 -- the two normalisers that never met.
      // topicTerms (lib/stored-deen.js:236) strips a prefix TWICE: normalizedWords()
      // runs stripPrefixes, then canonicalToken() strips again, so its keys live in a
      // twice-stripped space. This side stripped once. A definite-article word whose
      // stem then begins with a prefix letter kept that letter here and lost it there,
      // so the two sides could never be equal and every such record was refused with
      // matched=0 -- the reader was told no fatwa exists while the record sat in the
      // corpus and the service had already returned it. A second pass puts both sides
      // in one space. Measured over 110 live records / 12 questions before landing:
      // LOST=0, SCORE_CHANGED_ON_ALREADY_ACCEPTED=0, GAINED=4. Threshold untouched.
      let key = canonicalToken(raw);
      if (key) key = canonicalToken(key);
      if (key) out.push(key);
      if (/^(?:واجب|واجبه|الواجب|وجوب|يجب)$/u.test(normalizeArabic(raw))) out.push('واجب');
    }
    return out;
  };
  const titleWords = wordKeys(title);
  const questionWords = wordKeys(question);
  const answerWords = wordKeys(answer);
  const has = (words, term) => words.includes(term);
  const matched = terms.filter((term) => has(titleWords, term)
    || has(questionWords, term) || has(answerWords, term));
  const need = terms.length === 1 ? 1 : Math.min(2, terms.length);
  const titleHits = terms.filter((term) => has(titleWords, term)).length;
  const questionHits = terms.filter((term) => has(questionWords, term)).length;
  const answerHits = terms.filter((term) => has(answerWords, term)).length;
  const proximity = (words) => {
    const positions = [];
    for (const term of terms) {
      const at = words.findIndex((word) => word === term);
      if (at >= 0) positions.push(at);
    }
    return positions.length >= need ? Math.max(...positions) - Math.min(...positions) + 1 : Infinity;
  };
  const titleWindow = proximity(titleWords);
  const questionWindow = proximity(questionWords);
  const directlyFramed = titleWindow <= 12 || questionWindow <= 32;
  // ── IS THE TOPIC THE SUBJECT, OR AN ELEMENT OF SOMEBODY ELSE'S ACT? (CX-03) ──
  //
  // MEASURED on the real base: «ما حكم شرب الدخان؟» and «حكم تأجير العقار لأصحاب محلات الدخان»
  // both scored EXACTLY 40 for the question «ما حكم الدخان؟». They are not equally good answers.
  // The first rules on smoking. The second rules on LETTING PREMISES — smoking appears in it as a
  // property of the tenant, and its ruling («لا يجوز») is a ruling about landlords. Presented as
  // the answer, it tells a reader who asked about smoking that something is forbidden, about a
  // transaction they never mentioned.
  //
  // What separates them is POSITION, not subject matter, so it needs no list of topics. An Arabic
  // ruling title names its subject first and qualifies it afterwards: «حكم ‹الفعل› ‹بمتعلّقه›».
  // Once the ruling frame itself is dropped, the topic term sits at offset 1 in the general title
  // and at offset 4 in the letting title, buried behind تأجير, العقار, أصحاب, محلات — three other
  // content nouns, each of which is a thing the ruling is actually about. Distance from the head
  // is exactly the measure of "how much of somebody else's transaction stands in between".
  //
  // It biases RANK only. Admission is unchanged, so nothing that used to be answerable stops
  // being answerable; the general ruling simply stops tying with the incidental one.
  const RULING_FRAME_WORDS = new Set(['ما', 'هل', 'حكم', 'الحكم', 'ايش', 'شنو', 'وش', 'هو', 'هي']);
  const headWords = titleWords.filter((word) => !RULING_FRAME_WORDS.has(word));
  const headOffset = Math.min(...terms
    .map((term) => headWords.indexOf(term))
    .filter((at) => at >= 0), Infinity);
  const subjectProximity = headOffset <= 1 ? 14 : headOffset <= 2 ? 7 : 0;
  // The verdict the shipped filter reaches, computed exactly as it always was.
  const framedAccept = matched.length >= need && directlyFramed;
  const baseScore = titleHits * 9 + questionHits * 5 + answerHits * 2 + matched.length
    + (titleWindow <= 8 ? 18 : titleWindow <= 12 ? 8 : 0)
    + (questionWindow <= 20 ? 5 : 0)
    + subjectProximity;
  // ── THE BRIDGE (see termFamiliesIn above) ────────────────────────────────
  // Computed only when the ordinary test already refused, so a record that passes on its own
  // terms never has its score touched and the existing ranking cannot move.
  let bridged = false;
  if (!framedAccept) {
    const asked = termFamiliesIn(context?.resolvedTopic || context?.currentQuestion || '');
    if (asked.size) {
      const inTitle = termFamiliesIn(record.title || '');
      const inQuestion = termFamiliesIn(record.content?.question || '');
      bridged = [...asked].some((key) => inTitle.has(key) || inQuestion.has(key));
    }
  }
  return {
    // Answer-only coincidence is not answerability. A result must frame this topic in
    // its own title or published question, with the core terms reasonably close —
    // or name it by one of the other names the corpus files it under.
    accepted: framedAccept || bridged,
    // ADMISSION ONLY. No bonus, no penalty, not one point moved: the bridge decides whether a
    // record is in the set, and the shipped formula alone decides where it sits in it. An earlier
    // draft paid bridged records +12 and it was measured wrong — bridged scores ran 15..46 against
    // framed scores that go as low as 23, so the bonus would have reordered the existing set to
    // buy nothing. A record the old test accepted therefore keeps its exact score and its exact
    // rank, which is the property that makes this change additive rather than merely additive-ish.
    score: baseScore,
    matched,
    headOffset,
    bridged,
  };
}

function normalizeRecord(record, context) {
  if (!record || typeof record !== 'object') return null;
  const scholar = FATWA_SCHOLARS.find((entry) => entry.id === String(record?.scholar?.id || ''));
  if (!scholar || !/^[-a-z0-9_]+$/u.test(scholar.id)) return null;
  const url = expectedHost(record, scholar);
  const title = cleanText(record.title, 180);
  const content = record?.content || {};
  const actualMode = String(content.type || 'question_answer');
  const contentMode = actualMode === 'auto_transcript_official_video'
    ? 'transcript_official_video'
    : 'written_fatwa';
  // view=full is a contract, not a hint. A written result that supplies only excerpt fields
  // is refused instead of being promoted to a complete fatwa. Automatic transcripts retain
  // their old excerpt fallback because they never enter the full-written-fatwa display path.
  const answer = contentMode === 'written_fatwa'
    ? String(content.answer || '')
    : cleanText(content.answer || content.answerExcerpt);
  const question = contentMode === 'written_fatwa'
    ? String(content.question || '')
    : cleanText(content.question || content.questionExcerpt, 1600);
  if (!url || !title || !question || !answer) return null;
  const relevance = topicalScore(record, context);
  if (!relevance.accepted) return null;
  const normalized = buildFatwaRecord({
    id: `fatwa:${String(record.uid || `${scholar.id}:${record.id}`)}`,
    kind: 'fatwa_service',
    title,
    url,
    publisher: scholar.name,
    authorityId: scholar.canonicalId,
    scholarId: scholar.id,
    directAttribution: true,
    contentMode,
    actualContentType: actualMode,
    sourceKind: 'corpus',
    question,
    answer,
    truncated: content.truncated === true || record.truncated === true,
    omittedChars: content.omittedChars ?? record.omittedChars ?? 0,
    passage: [question ? `السؤال المنشور: ${question}` : '', `النص المنشور: ${answer}`].filter(Boolean).join('\n'),
    score: relevance.score - (contentMode === 'transcript_official_video' ? 3 : 0),
    raw: record,
  });
  if (contentMode === 'written_fatwa' && !recordUsableAsFatwa(normalized)) return null;
  return normalized;
}

export async function searchFatwas(context, options = {}) {
  const verification = await verifyFatwaService(options);
  const named = resolveFatwaScholar(
    context?.resolvedScholar?.display || context?.currentQuestion || '',
    context?.resolvedScholar?.id || '',
  );
  const queries = searchQueriesFor(context);
  if (!queries.length) return { verification, query: '', queries: [], scholar: named, records: [], calls: 0, rejected: 0 };
  const payloads = await Promise.all(queries.map(async (query) => {
    const url = new URL('/api/v1/fatwas/search', FATWA_BASE);
    url.searchParams.set('q', query);
    url.searchParams.set('scholar', named ? named.id : 'all');
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', String(MAX_RESULTS));
    url.searchParams.set('view', 'full');
    return readJson(url.pathname + url.search, options);
  }));
  const raw = payloads.flatMap((payload) => Array.isArray(payload.results) ? payload.results : []);
  // Every variant is admitted against the one resolved topic, not against its own looser words.
  const relevanceContext = { ...context, resolvedTopic: context?.resolvedTopic || queries[0] };
  const normalized = raw.map((item) => normalizeRecord(item, relevanceContext)).filter(Boolean)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    verification,
    query: queries[0],
    queries,
    scholar: named,
    records: normalized.slice(0, 4),
    calls: queries.length,
    rejected: raw.length - normalized.length,
    totalMatches: payloads.reduce((sum, payload) => sum + Number(payload?.pagination?.total || 0), 0),
  };
}

export const __fatwaTest = Object.freeze({ cleanText, normalizeRecord, searchQueriesFor, searchQueryFor, topicalScore });
