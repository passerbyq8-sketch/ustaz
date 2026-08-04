// lib/policy/age.js
// THE TWO AGE LAYERS, AND THE ORDER THEY RUN IN.
//
// ── WHY ORDER IS THE WHOLE DESIGN ────────────────────────────────────────────
// An age check that runs BEFORE the question is understood is a keyword filter wearing a policy's
// name. It sees «قتل» in «ما حكم قتل النمل؟» and blocks a fiqh question a seven-year-old is
// entitled to an answer to; it sees «ماسك للشفايف» and has no idea whether that is cosmetics or
// chemistry. So AGE_ACCESS_POLICY runs AFTER IR_BUILD, always, and ORDER below is asserted by the
// gate rather than described in a comment.
//
// ── THE TWO LAYERS ───────────────────────────────────────────────────────────
//   ACCESS  — before generation. May this be attempted at all, and under which source policy?
//             Decided from the shared matrix in ./core.js. It never reads the draft.
//   FLOOR   — after generation, before output. Deterministic. It reads the DRAFT and refuses
//             what no child should be handed regardless of how well it was phrased.
//
// The floor is not a second opinion from the model. A model asked to check its own output is the
// same model that produced it, and the failure mode is that it agrees with itself.
//
// ── AND THE FLOOR IS NOT A WALL ──────────────────────────────────────────────
// A refusal that costs a child the answer is a cost, not a saving: it teaches them the app is
// not for them and sends them somewhere with no floor at all. So the floor's verdicts name what
// is wrong so the caller can ask for a better answer, and «اسألي والدتك» ALONE is itself a
// failure — `isColdRefusal` treats a bare referral as a defect, not as safety.

import {
  matrix, CHILD_SAFETY_RUBRIC, GENERAL_CHILD_BENIGN, WARM_TEMPLATES,
  POLICY_VERSION,
} from './core.js';
import { fold } from './entities.js';

export { POLICY_VERSION };

// ── the pipeline order ───────────────────────────────────────────────────────
// Asserted, not documented. AGE_ACCESS_POLICY may not precede IR_BUILD.
export const ORDER = Object.freeze([
  'INTAKE',
  'LOCAL_ROUTE',
  'NARROW_SAFETY_TRIAGE',
  'IR_BUILD',
  'AGE_ACCESS_POLICY',
  'ENTITY_RESOLUTION',
  'RETRIEVAL_POLICY',
  'BUDGET_CHECK',
  'SEARCH',
]);

/** Is `a` required to run before `b`? Used by the gate and by the seam's self-check. */
export function runsBefore(a, b) {
  const i = ORDER.indexOf(a), j = ORDER.indexOf(b);
  return i !== -1 && j !== -1 && i < j;
}

// ── who are we talking to ────────────────────────────────────────────────────
/**
 * THE BAND THAT ACTUALLY GOVERNS, AND WHERE IT IS ALLOWED TO COME FROM.
 *
 * Two rules, and they point in opposite directions on purpose:
 *
 *   * `unknown` behaves as ADULT. Treating an unidentified reader as a child is not caution —
 *     it silently degrades every adult who has not filled in a profile, and it is how a grown
 *     man asking a legitimate fiqh question gets a children's answer.
 *
 *   * a YOUNGER band is honoured ONLY from a trusted source. Nothing may infer "this is a
 *     child" from the text: a client field, a writing style, a spelling mistake, or the word
 *     «ماما» in a question are all forgeable or wrong, and inferring downward is how an adult
 *     gets silently censored by a heuristic he cannot see or appeal.
 */
export function effectiveBand(audienceBand, audienceSource) {
  const trusted = audienceSource === 'account_profile' || audienceSource === 'verified_session';
  if (!trusted) return 'adult';
  if (audienceBand === 'young' || audienceBand === 'teen') return audienceBand;
  if (audienceBand === 'adult') return 'adult';
  return 'adult';
}

const RANK = Object.freeze({ young: 0, teen: 1, adult: 2 });

/**
 * THE BAND THAT GOVERNS, FROM TWO SOURCES OF VERY DIFFERENT WORTH.
 *
 * ── WHAT WAS WRONG BEFORE ───────────────────────────────────────────────────
 * `api/ask.js` computed `audienceSource = band ? 'account_profile' : 'unknown'`. That is a false
 * label. MEASURED: `band` is `deriveCaps(p.age).band` where `p` is `JSON.parse(localStorage
 * .getItem('child_profile'))` — read in the browser, put in the POST body, and editable by anyone
 * who opens devtools. There is NO server-authenticated age anywhere in this app: the only
 * server-verified identity is the founder HMAC in lib/daycap.js, and it carries no age. Calling
 * that an account profile told the rest of the system a verification had happened that had not.
 *
 * ── THE RULE THAT REPLACES IT ───────────────────────────────────────────────
 * A claim may RESTRICT and may not RELEASE.
 *
 *   * A server-verified band, if one ever exists, wins outright.
 *   * A client claim of `young`/`teen` is honoured, because being wrong in that direction costs a
 *     misidentified adult a simpler answer, while ignoring it costs a real child their protection.
 *   * A client claim of `adult` can never open anything a verified younger band had closed.
 *   * Nothing at all is `unknown`, which the owner's decision treats as adult.
 *   * The band is never inferred from what the reader typed. A childish sentence is not evidence
 *     of a child, and a filter that guessed would be censoring adults on their spelling.
 *
 * @returns {{band, audienceSource:'verified_session'|'client_claim'|'unknown', trusted:boolean,
 *            restrictedByClaim:boolean}}
 */
export function resolveAudience({ serverBand, clientBand } = {}) {
  const valid = (b) => b === 'young' || b === 'teen' || b === 'adult';
  const server = valid(serverBand) ? serverBand : null;
  const client = valid(clientBand) ? clientBand : null;

  if (server && client) {
    // The stricter of the two. A verified young is never released by a client adult, and a
    // client young may still tighten a verified adult.
    const band = RANK[client] < RANK[server] ? client : server;
    return Object.freeze({
      band,
      audienceSource: 'verified_session',
      trusted: true,
      restrictedByClaim: band === client && client !== server,
    });
  }
  if (server) {
    return Object.freeze({ band: server, audienceSource: 'verified_session', trusted: true, restrictedByClaim: false });
  }
  if (client) {
    // Honoured, and NOT called trusted. `adult` from a client is the same answer `unknown` gets,
    // so an unverified claim can never be the reason anything opened.
    return Object.freeze({
      band: client,
      audienceSource: 'client_claim',
      trusted: false,
      restrictedByClaim: client !== 'adult',
    });
  }
  return Object.freeze({ band: 'adult', audienceSource: 'unknown', trusted: false, restrictedByClaim: false });
}

// ── layer 1: access ──────────────────────────────────────────────────────────
/**
 * @param {{topicClass:string, audienceBand:string}} input
 * @returns {{outcome, sourcePolicy, beforeSearch, stripExplicit, requireAdultGuidance,
 *            policyVersion, topicClass, audienceBand}}
 */
export function access({ topicClass, audienceBand }) {
  const cell = matrix(topicClass, audienceBand);
  return Object.freeze({
    outcome: cell.outcome,
    sourcePolicy: cell.sourcePolicy,
    beforeSearch: !!cell.beforeSearch,
    stripExplicit: !!cell.stripExplicit,
    requireAdultGuidance: !!cell.requireAdultGuidance,
    unreviewed: !!cell.unreviewed,
    topicClass,
    audienceBand,
    policyVersion: POLICY_VERSION,
  });
}

// ── layer 2: the floor ───────────────────────────────────────────────────────

// Does this draft tell the reader to PUT something on, or take something in? That is the trigger
// for the allergy caution and the parent loop: a fact about the world needs neither, and demanding
// them everywhere would make the floor noise that callers learn to ignore.
const APPLY_VERBS = ['حطي', 'حط', 'ضعي', 'ضع', 'ادهني', 'ادهن', 'امسحي', 'امسح', 'اخلطي', 'اخلط',
  'استخدمي', 'استخدم', 'جربي', 'جرب', 'كلي', 'اشربي', 'اشرب'];

const EXPLANATORY = ['لان', 'عشان', 'لكن', 'يعني', 'مثل', 'بحيث', 'حتي', 'علشان', 'كي'];

// WHOLE WORDS, NOT SUBSTRINGS. MEASURED while building this floor: the forbidden substance «خل»
// (vinegar) matched inside «خلي ماما تشوف» — "let mum have a look" — so the one sentence that
// makes an answer SAFE was the sentence that failed it. Arabic glues the article and the
// pronouns on, so the boundary is "no Arabic letter either side", exactly as in ./entities.js.
// The Arabic block holds punctuation as well as letters, so the class is letters only: «؟» is
// U+061F and must not count as one.
const AR_LETTER = /[ء-يٮ-ۓۮ-ۿ]/;
// PROCLITICS ARE PART OF THE WORD IN ARABIC, AND THE BOUNDARY HAS TO KNOW IT. MEASURED: the
// draft «...وحطي شوي فازلين...» never matched the apply-verb «حطي», because the conjunction «و»
// is glued to its front and «و» is an Arabic letter — so the check that demands a patch test and
// a parent before putting something on a child's skin silently never fired. The same shape
// covers «بالليمون» and «فاخلطي». A proclitic counts as a boundary only when it is ITSELF at one,
// which is what keeps «خلي» from matching the forbidden «خل»: the blocker there is the TRAILING
// letter, and that test is unchanged.
const PROCLITIC = /[وفبكل]/;
function hasWord(hay, needle) {
  const n = fold(needle);
  if (!n) return false;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(n, from);
    if (at === -1) return false;
    from = at + n.length;
    const after = at + n.length < hay.length ? hay[at + n.length] : ' ';
    if (AR_LETTER.test(after)) continue;
    const before = at > 0 ? hay[at - 1] : ' ';
    if (!AR_LETTER.test(before)) return true;
    // One proclitic is allowed, provided the proclitic itself starts a word.
    if (PROCLITIC.test(before)) {
      const before2 = at > 1 ? hay[at - 2] : ' ';
      if (!AR_LETTER.test(before2)) return true;
    }
  }
}

const hasAny = (t, list) => list.some((w) => hasWord(t, w));

/**
 * IS THIS A COLD BRUSH-OFF?
 *
 * «اسألي والدتك» on its own is the failure the RFC names: it answers nothing, explains nothing,
 * and reads to a child as "go away". A referral is welcome — it is the SECOND half of a good
 * answer, never the whole of one. So a reply is cold when it is short and carries no explanation
 * to go with the referral.
 */
export function isColdRefusal(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return true;
  const t = fold(raw);
  // SHORTNESS IS NOT COLDNESS. A blanket length floor failed «اغسلي شفايفك بماء دافي وحطي شوي
  // فازلين عشان ترطبها» — 51 characters, and a perfectly good answer to a seven-year-old, whose
  // whole style guide asks for two to four short sentences. Only a near-empty reply is cold on
  // length alone.
  if (t.length < 25) return true;
  const referral = hasAny(t, CHILD_SAFETY_RUBRIC.requiresParentLoop.concat(['الطبيب', 'الدكتور']));
  const explains = hasAny(t, EXPLANATORY);
  // The real defect: a referral offered INSTEAD of an answer. «اسألي والدتك.» sends the child
  // away having told them nothing, and a referral with no explanation beside it is exactly that.
  return referral && !explains && t.length < 140;
}

/**
 * THE DETERMINISTIC FLOOR.
 *
 * @param {string} draft the generated answer
 * @param {{topicClass:string, audienceBand:string}} ctx
 * @returns {{ok:boolean, outcome:'PASS'|'FAIL', problems:string[], policyVersion:string}}
 */
export function floor(draft, ctx = {}) {
  const problems = [];
  const raw = String(draft == null ? '' : draft);
  const t = fold(raw);
  const band = ctx.audienceBand || 'unknown';
  const topic = ctx.topicClass || 'general_knowledge';
  const cell = matrix(topic, band);

  // The floor governs children. An adult reader is not handed a children's rubric — that is how
  // an app becomes unusable for the people paying for it.
  const isChild = band === 'young' || band === 'teen';

  // 1. NO THERAPEUTIC DOSE, EVER, ON ANY CHILD PATH — and never on the health path at all,
  //    whatever the band. A dose is a clinical instruction and this app does not issue one.
  const dosageScope = isChild || topic === 'health_dosage' || topic === 'health_symptoms' || topic === 'health_general';
  if (dosageScope) {
    for (const re of CHILD_SAFETY_RUBRIC.dosagePatterns) {
      if (re.test(t)) { problems.push('dosage:' + re.source.slice(0, 24)); break; }
    }
  }

  if (isChild) {
    // 2. Substances and actions that hurt skin.
    for (const s of CHILD_SAFETY_RUBRIC.forbiddenSubstances) {
      if (hasWord(t, s)) problems.push('substance:' + s);
    }
    for (const a of CHILD_SAFETY_RUBRIC.forbiddenActions) {
      if (hasWord(t, a)) problems.push('action:' + a);
    }
    // 3. No religious citation on a benign, non-religious answer. A source card here dresses a
    //    craft tip as a verdict.
    if (GENERAL_CHILD_BENIGN.includes(topic)) {
      for (const re of CHILD_SAFETY_RUBRIC.forbiddenMarkup) {
        if (re.test(raw)) { problems.push('markup:' + re.source); break; }
      }
    }
    // 4. Putting something on a body, or in it, needs the two safety beats.
    if (hasAny(t, APPLY_VERBS)) {
      if (!hasAny(t, CHILD_SAFETY_RUBRIC.requiresAllergyCaution)) problems.push('missing:allergy-caution');
      if (!hasAny(t, CHILD_SAFETY_RUBRIC.requiresParentLoop)) problems.push('missing:parent-loop');
    }
    // 5. A cold brush-off is a failure of the answer, not a safe outcome.
    if (isColdRefusal(raw)) problems.push('cold-refusal');

    // 6. ADULT-ONLY DETAIL, WHATEVER THE TOPIC ALLOWS. The matrix's `stripExplicit` only fires on
    //    topics classified as explicit in the first place, which misses the case that actually
    //    occurs: a perfectly sound fatwa page on purity, cited for a child's question about being
    //    clean for prayer, whose next paragraph describes intercourse. The claim is verified, the
    //    source is eligible, the ruling is correct — and the detail is not for this reader.
    for (const d of CHILD_SAFETY_RUBRIC.adultOnlyDetail) {
      if (hasWord(t, d)) { problems.push('adult-detail:' + d); break; }
    }
  }

  // 6. Explicit detail is stripped for the bands the matrix says so for.
  if (cell.stripExplicit && /(?:جماع|ممارسه الجنس|وصف تفصيلي)/u.test(t)) {
    problems.push('explicit-detail');
  }

  return Object.freeze({
    ok: problems.length === 0,
    outcome: problems.length === 0 ? 'PASS' : 'FAIL',
    problems: Object.freeze(problems),
    policyVersion: POLICY_VERSION,
  });
}

// ── repair, where repair is honest ───────────────────────────────────────────
//
// TWO KINDS OF FLOOR FAILURE, AND THEY DESERVE OPPOSITE TREATMENT.
//
//   MISSING — the draft is fine and INCOMPLETE. It told a child to put something on their skin
//             and never mentioned patch-testing or a parent. The safe beats are fixed sentences
//             this module owns, so appending them is deterministic, adds no model call, and
//             produces exactly the answer that should have been written.
//
//   FORBIDDEN — the draft told a child to rub lemon juice on their lips, or handed them a dose.
//             Nothing is appended to that. It is discarded whole, because an answer with a
//             warning bolted onto the end is still the answer that told them to do it.
//
// This is why a floor failure does not have to cost the child their answer, and why the one that
// should cost it still does.
export function repair(draft, ctx = {}) {
  const first = floor(draft, ctx);
  if (first.ok) return { text: String(draft), outcome: 'PASS', repaired: false, problems: [] };

  const forbidden = first.problems.filter((p) => !p.startsWith('missing:'));
  if (forbidden.length) {
    return { text: '', outcome: 'DISCARDED', repaired: false, problems: first.problems.slice() };
  }

  let text = String(draft).trim();
  if (first.problems.includes('missing:allergy-caution')) {
    text += ' وجرّبي شوي على ظهر يدك أول عشان تتأكدي ما عندك حساسية منه.';
  }
  if (first.problems.includes('missing:parent-loop')) {
    text += ' ' + WARM_TEMPLATES.NEW_SUBSTANCE;
  }
  const second = floor(text, ctx);
  return second.ok
    ? { text, outcome: 'PASS', repaired: true, problems: first.problems.slice() }
    : { text: '', outcome: 'DISCARDED', repaired: false, problems: second.problems.slice() };
}

// ── the floor stamp ──────────────────────────────────────────────────────────
//
// EVERY BENIGN CHILD ANSWER MUST CARRY PROOF THAT THE FLOOR RAN. Without a stamp, a path that
// silently skipped the floor is indistinguishable from one that passed it — and "we think it
// ran" is the property this whole RFC exists to replace with "here is the record".

const STAMPED_POLICIES = Object.freeze(['GENERAL_CHILD_BENIGN', 'GENERAL_HEALTH_INTERIM']);

export function requiresFloorStamp(sourcePolicy) {
  return STAMPED_POLICIES.includes(sourcePolicy);
}

export function floorStampMissing(record) {
  if (!record) return true;
  if (!requiresFloorStamp(record.sourcePolicy)) return false;
  return !record.ageFloorOutcome;
}

/** The warm line a redirect or a referral is answered with. Never a bare refusal. */
export function warmTemplateFor(sourcePolicy) {
  return WARM_TEMPLATES[sourcePolicy] || '';
}
