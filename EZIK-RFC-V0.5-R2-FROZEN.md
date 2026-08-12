# EZIK RFC v0.5-R2 — FROZEN SPECIFICATION (as implemented)

**Status:** frozen and approved by the owner. Implemented locally on branch `guarded/rfc-v0.5-r2`.
**Baseline:** `2046114a98f5d248672bc209914ec4baeff8a3d6` (re-pinned by the owner; see §0).
**Not deployed. Not pushed. Ledger remains DEFAULT OFF.**

This document records the specification **as it was actually built**. Where the built behaviour
differs from the first draft of the RFC, the difference is stated here rather than smoothed over.
It does not restate or reinterpret the history of v0.4.

---

## 0. Baseline

The RFC as issued named `27112875…` as the expected HEAD. That commit exists in this repository
and is a direct ancestor of HEAD, nine commits behind: the intervening work is the `i18n`/`home`
series, which touches `index.html`, `quest.html`, `guards/i18n-ui-guard.cjs` and
`theme-coverage-guard.cjs` and **no file in this RFC's scope**. The owner re-pinned the baseline to
`2046114a98f5d248672bc209914ec4baeff8a3d6` and directed that the nine commits be preserved in full.
They are: this branch is a fast-forward descendant and none of those four files is modified.

---

## 1. What this RFC changes, in one paragraph

Two request paths — the shipped legacy route in `api/ask.js` and the ledger state machine in
`lib/ledger/` — now read age, topic and attribution decisions from **one versioned policy core**.
An entity is a **lookup, never a capture**. A question **about** a scholar is no longer read as a
request **for** his opinion. A contemporary scholar with no primary corpus no longer refuses the
whole question before searching; the search runs, the general ruling is answered and cited to its
own source, and **nothing** is attributed to him. Every negative sentence must point at a
**per-slot proof** that a search for that slot actually happened. And what a child may be told is
decided in **deterministic code applied to the finished draft**, not in a prompt.

---

## 2. Invariants that did not move

Confirmed unchanged and asserted by gates:

```
MAX_BRAVE_CALLS         = 4        MAX_MODEL_INPUT_TOKENS  = 15000
MAX_PAGES_FETCHED       = 5        MAX_MODEL_OUTPUT_TOKENS = 3000
MAX_MODEL_CALLS         = 7        GLOBAL_TIMEOUT_MS       = 25000
MAX_VERIFIED_CYCLES     = 2        MIN_MS_FOR_MODEL_CALL   = 2000
```

Internal query bounds `380 chars / 45 words`; provider bounds `400 / 50`. Characters and words are
enforced **independently** (`381/45` and `380/46` are each `SPLIT_OR_REJECT` on their own).

Gate 1 (Evidence Exists), Gate 2 (Evidence Entails Atomic Claim) and Gate 3 (Claim Entails
Sentence) are unchanged in structure. UTF-8 byte offsets, SHA256, `source_id`, `answer_unit_id`,
`span_id`, one-page-one-answer-unit per claim, no hybrid claims, no unsupported condition or
exception, no `view_id` mixing, no attribution from a snippet, no model memory as evidence, no
mid-question fallback from Ledger to Legacy, and the SSE contract (`content_block_delta`,
`message_stop`, one `res.end()`) all hold. **No new model call was added to the Ledger.**

---

## 3. Policy Core — `lib/policy/`

A single versioned source of truth, consumed by both paths.

| Module | Holds |
|---|---|
| `version.js` | `POLICY_VERSION`, `REGISTRY_VERSION`, `SYNONYM_TABLE_VERSION`, `NORMALIZATION_VERSION`, and `versionMaterial()` — the ordered block every cache key carries |
| `core.js` | `topic_class × audience_band` matrix (total), `CHILD_SAFETY_RUBRIC`, the reviewed `GENERAL_CHILD_BENIGN` list, the health split, the warm templates, the narrow grave-hazard conjunctions, the living-person policy, `driftProblems()` |
| `entities.js` | the registered roster (historical scholars, madhhabs, institutions), role/relation/target-type/era resolution, `preSearchRejection()`, `ambiguityOutcome()` |
| `age.js` | `ORDER` (the pipeline), `effectiveBand()`, `access()`, `floor()`, `repair()`, `isColdRefusal()`, the floor stamp |
| `attribution-grades.js` | grades A/B/C, `provenanceCap()`, `sentenceTemplate()`, `violatesTemplate()`, `canConfirmQuote()` |
| `slot-proof.js` | the proof record, the five reason codes, and the deterministic wording each earns |
| `synonyms.js` | the reviewed fiqh synonym table, protected pivot terms, one-expansion-only |

**Shared:** data, schemas, pure deterministic evaluators, a stateless router.
**Not shared:** answer engine, retrieval engine, drafting, ledger state, legacy RAG state.

Drift is checked executably: `driftProblems()` asserts the matrix is total over both vocabularies,
that no benign topic is anything but `ALLOW` for `young`, and that no hazard is anything but
`SAFETY_REDIRECT` for any band. Gate `rfcpolicy` additionally asserts both paths import the core
and agree on one `policy_version`.

---

## 4. IR and pipeline order

The order is pinned in `lib/policy/age.js` `ORDER` and asserted, not described:

```
INTAKE → LOCAL_ROUTE → NARROW_SAFETY_TRIAGE → IR_BUILD → AGE_ACCESS_POLICY
       → ENTITY_RESOLUTION → RETRIEVAL_POLICY → BUDGET_CHECK → SEARCH
```

`AGE_ACCESS_POLICY` may never precede `IR_BUILD`. `NARROW_SAFETY_TRIAGE` is the sole exception
allowed to decide anything earlier, and it is kept narrow enough to earn it: it fires only on a
**conjunction** (an action *and* a hazardous material, or an explicit self-harm phrase), so a
single alarming word cannot block a topic.

`audience_band = unknown` behaves as **adult**. A younger band is honoured **only** from a trusted
`audience_source`, never inferred from the text. On a material ambiguity the outcome is
`CLARIFY_OR_SCOPE`; there is no probabilistic attribution, at any insistence.

`claim_relation ∈ { ABOUT_ENTITY, BY_ENTITY, QUOTE_VERIFICATION, BY_MADHHAB, NONE }`.
`target_type ∈ { person, madhhab, institution }`. `role ∈ { subject, authority }`.
`resolution_status ∈ { resolved, ambiguous, unresolved }`.

**Deviation from the draft, recorded:** the draft listed `BY_ENTITY | ABOUT_ENTITY |
QUOTE_VERIFICATION` only. `BY_MADHHAB` was added because «ما حكم المسألة عند الحنابلة؟» is neither
a claim by a person nor a claim about one, and forcing it into either produced the person-shaped
refusal this RFC exists to remove.

---

## 5. Age policy — two layers

**RAG:** verified claims → deterministic `AGE_FLOOR` on allowed claim/detail classes → draft →
the existing batched Gate 3 → output.
**GENERAL_CHILD:** bounded educational system block → generated draft → deterministic
`CHILD_SAFETY_RUBRIC`/`AGE_FLOOR` → output, or `ALLOW_LIMITED`/warm redirect.

The system prompt is **not** the safety guarantee, and is asserted not to be: the floor reads the
finished draft. A floor failure is triaged: a draft that is merely **incomplete** (no patch test,
no parent in the loop) is completed from fixed sentences the server owns; a draft containing a
**forbidden** substance, action, dose or citation is discarded whole. No model call is added
either way — the benign child path spends the same single call the GEN route already spent, and
buffers it rather than streaming, because bytes already on a child's screen cannot be withdrawn.

Every `GENERAL_CHILD_BENIGN` reply carries an `ageFloorOutcome` stamp. A reply that cannot show
the floor ran is indistinguishable from one that skipped it.

The child path may not issue a sharia ruling, a diagnosis, or a dose.

---

## 6. Scholars and attribution

**Historical.** Grades: `A` primary/direct or qualified text with locator → «قال العالم في…»;
`B` exact quotation + book + locator + bounded text → «نُقل عنه في…»; `C` eligible source summary →
«ذكر المصدر كذا أن رأيه…». For `QUOTE_VERIFICATION`, `A`/`B` may confirm a wording and `C` may not.

**Contemporary.** `era = contemporary AND no capability = scholar_opinion_primary → provenance_cap
= NONE`. Grade `C` is refused for contemporaries in every direction; `C` is for the historical
record only. Search is **permitted** — the refusal that used to happen on the name is gone. No
claim is attributed to him, no sentence from a summarising source says «قال الشيخ», and the general
ruling stays attributed to **its own** source.

**ABOUT_ENTITY.** An eligible source may make a claim *about* a scholar; that claim never becomes a
claim *by* him, and `ABOUT_ENTITY` never takes the «قال العالم» template. The user's premise is not
evidence.

**Living persons.** Ezik issues no personal evaluative verdict on a living person — no takfīr,
tabdīʿ, tafsīq, or reading of intentions. Permitted: general principles; the person's own words
from a primary source; a qualified official body's decision attributed **to that body** where the
capability is enabled; and referral to scholars for applying a ruling to a named individual.
Enforced in claim, draft and Gate 3 — not in a prompt.

---

## 7. Search First and slot proof

> No epistemic rejection before an eligible retrieval attempt, when `search_necessity = required`
> and budget is available.

Each required slot carries its own record:

```json
{ "slot_id": "...", "search_attempted": true, "query_count": 2, "expansion_count": 1,
  "results_seen": 5, "eligible_pages": 1, "verified_claims": 0,
  "proof_origin": "live | cache", "outcome": "EVIDENCE_NOT_ENTAILED" }
```

The outcome is **derived** from the counters, never passed in. Reason codes and their deterministic
wording:

| Reason | Wording |
|---|---|
| `NOT_SEARCHED_BUDGET` | تعذر استكمال البحث ضمن الحدود التشغيلية… |
| `SEARCHED_NO_RESULTS` | لم نقف في المصادر المعتمدة المتاحة لعزك… |
| `RESULTS_INELIGIBLE` | وجدنا صفحاتٍ متصلةً بالموضوع، لكنها ليست من نوع المصادر… |
| `EVIDENCE_NOT_ENTAILED` | وجدنا مواد تتناول المسألة، لكن لم يثبت منها ما يكفي… |
| `AMBIGUOUS_ENTITY` | الاسم المذكور ينطبق على أكثر من عالم… |

Forbidden outright: «لا يوجد قول», «لم يقل العالم», a bare unqualified «لم نقف», and dressing
budget exhaustion up as absence of evidence.

---

## 8. Cache

The existing cache is extended, not duplicated. Empty results **are** stored, under
`NEGATIVE_TTL_SECONDS = 3600` (one hour, a ceiling not a target); real results keep the 24-hour TTL.

Key = `HMAC(secret, normalized_query + sites + source_policy_version + versionMaterial())`, where
`versionMaterial()` carries `policy_version`, `registry_version`, `synonym_table_version`,
`normalization_version` and the adapter version slot. A change in any of them is a **miss**, not a
stale hit. With no secret the cache is **disabled** — no plaintext key, no constant fallback. No
question text, page text, device id, IP, cookie or header appears in a key, a value or a log line.
A cache hit records `proof_origin: "cache"` and never claims a fresh search.

---

## 9. Daily search budget

`lib/ledger/daily-budget.js`, injectable and fake-store testable.

* **Where the counter lives:** the Upstash instance the app already uses, via the existing
  `lib/ledger/redis.js` client. No new dependency, no new resource, no new credential.
* **Key shape:** `lg:dsb:YYYY-MM-DD`. Derived from the clock only. No device id, IP, cookie, header
  or question. It is a **global service counter**, never a per-reader quota.
* **Expiry:** set on the first increment of the day, to the next UTC midnight plus a minute of
  slack, so a key cannot outlive its day or accumulate across days.
* **What counts as a search unit:** one outbound provider request. A cache hit is **not** a unit. A
  query returning nothing **is** a unit. Page fetches are not units — they are bounded separately.
* **Race condition:** `INCR` returns the caller's own position in one round trip, so each request
  learns whether *it* crossed the line. Read-then-write would let two requests reading 99 against a
  ceiling of 100 both proceed.
* **Kill switch independence:** `lib/ledger/flag.js` does not read `DAILY_SEARCH_BUDGET`, asserted
  by gate `rfcruntime`. A spend cap cannot turn the path on, and the kill switch cannot be
  neutralised by the budget.
* **Failure direction:** fail **closed** by default. A cache may fail open; a spend cap may not.
* **On exhaustion:** outcome `SERVICE_LIMITED`, never `NOT_FOUND`. `LOCAL_FROZEN` and
  `GENERAL_CHILD` continue.

**The shipped fallback is a finite cap of 5000.** With `DAILY_SEARCH_BUDGET` unset or malformed,
`configuredLimit()` returns that default; a valid value overrides it, and an explicit zero is a
hard stop. The result is always capped and never unlimited.

---

## 10. Sources

**No source was activated, added, removed or re-scoped.** `lib/source-registry.js` and
`lib/ledger/source-policy.js` are byte-identical to the baseline. `shamela.ws` is absent.
`shkhudheir.com` remains `disabled` and non-searchable. `binothaimeen.net` remains adapter-only and
non-searchable. The single-source default (and 3 for compound) is unchanged. Mention of a domain in
the RFC text conferred no approval on it.

---

## 11. Privacy

Never logged or stored: question text, page text, exact spans, drafts, a child's numeric age or
date of birth, device id, IP, cookie, header, founder credential. Telemetry is allow-listed and
carries `audience_band` only where age is relevant. Search proof carries HMACs, counters, reason
codes and short TTLs — no text.

---

## 11b. Rollout (added by the owner review)

Two independent switches, both **default OFF**, both failing OFF on every error:

| Switch | Governs | Env floor | Identity | Runtime |
|---|---|---|---|---|
| `lib/ledger/flag.js` | the ledger engine | `LEDGER_RAG` | founder HMAC | Upstash, 5s TTL |
| `lib/legacy-policy-flag.js` | the legacy repairs (safety triage, child-benign, health referral, ABOUT_ENTITY branch, classifier veto) | `RFC_V05_LEGACY_POLICY` | founder HMAC | Upstash, 5s TTL |

The ledger budget receives the finite default when `DAILY_SEARCH_BUDGET` is absent or malformed;
`decidePath()` has no unconfigured-budget branch. With the legacy switch off, the handler's
routing expression is byte-for-byte the shipped one and no new branch is
reachable. Neither switch reads the store for a reader who is not an internal tester. No value was
changed by this work.

## 12. What is explicitly still off

* Ledger search always has the finite default ceiling unless `DAILY_SEARCH_BUDGET` overrides it.
* The legacy policy repairs remain **DEFAULT OFF** behind `RFC_V05_LEGACY_POLICY`.
* No shadow, no canary, no preview, no deploy, no environment or Upstash change.
* Live Preview Ledger path, live LLM eval, live Brave contract, P50/P95 live latency, and live
  token/cost metrics all remain **VOID**.
