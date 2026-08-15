# EZIK Guards Honesty Report

Status: COMPLETE for Owner B's offline scope. The branch is local and unpushed.

## Session lock

| Field | Measured value |
|---|---|
| Governing directive SHA-256 | `11C7842007AEB9356802AC5DB2EB33F86A433AD90A0351863FE038F642290796` |
| Specification SHA-256 | `A83B17220D56BBB81E7411B977D8752E5F9CAC19946C66C0D1BF5DABAE489465` |
| Specification bytes | `62447` |
| Baseline | `d2c5828707b51a450826a03283f185baaba60829` |
| Branch | `fix/parallel-b-guards-honesty-20260815` |
| Final implementation SHA before this closure report | `27e67fa36e20d9543468456144a7e38387208535` |
| Closure-report commit | Reported in the handoff; a commit cannot contain its own object ID |
| Network | Disabled for implementation and evidence acquisition |
| Push | Forbidden and not performed |

The worktree was created from the exact baseline after `origin/main` was verified at that object. A junction to the already-installed dependency tree in the primary checkout was used only to make the offline gates executable; it is ignored and untracked.

## Baseline RED evidence

- With no dependency tree visible in the new worktree, the first run was `26/73`; this was an environment failure, not a product result.
- With the existing offline dependencies visible, the untouched baseline was `67/73`. Four stat-only checkout mismatches disappeared after the index re-read the same bytes; they were not treated as product fixes.
- The remaining baseline evidence was recon `PASS=161 WARN=3 FAIL=1` because a checked report summary was stale, `questux` timing out at `Page.enable` inside the process sandbox, and `i18nui` extracting no Quest languages because it searched only for CRLF bytes.
- X-012 RED: two callable model-only chat relays existed even though the shipped client selected `/api/ask`; repository search found no enabled production consumer of either relay.
- X-021 RED: the hybrid guard authored `calls` and validation totals in a stub, then used those same authored values as telemetry proof. It observed no production-adapter request count.

## Reference remap

The specification referenced an earlier snapshot. These were the measured locations at the locked baseline; no semantic conclusion was inferred from a stale line number.

| Item | Specification location | Locked-baseline location | Shift |
|---|---:|---:|---:|
| G-01 extractor claim | `recon-audit.cjs:3` | `recon-audit.cjs:3` | 0 |
| G-01 authored fixture | `recon-audit.cjs:101` | `recon-audit.cjs:101` | 0 |
| G-06 deployed-env example | `ledger-runtime-guard.cjs:78` | `ledger-runtime-guard.cjs:74` | -4 |
| G-06 fake Redis | `ledger-runtime-guard.cjs:184` | `ledger-runtime-guard.cjs:184` | 0 |
| G-07 fake transport | `guards/rfc-v05r2-runtime-guard.cjs:258` | same | 0 |
| G-08 authored page response | `guards/rfc-v05r2-round3-guard.cjs:174` | same | 0 |
| G-09 founder-secret fixture | `guards/rfc-v05r2-mode-guard.cjs:113` | `:105` | -8 |
| G-10 fresh-production claim | `guards/shipped-reality-guard.cjs:13` | `:6` | -7 |
| G-11 historical measurement | `guards/dead-domains-guard.cjs:3` | same | 0 |
| G-12 editable liveness record | `guards/source-liveness-guard.cjs:12` | same | 0 |
| G-15 server-owned notice | `guards/live-search-disclosure-guard.cjs:212` | same | 0 |
| G-16 authored label page | `guards/transfer-mode-guard.cjs:41` | same | 0 |
| G-17 fabricated page | `guards/anchor-mode-guard.cjs:40` | same | 0 |

## Item ledger

Every numbered item has its own commit. Every honesty rewrite has two killed mutants.

| Item | Commit | GREEN evidence | Mutants |
|---|---|---|---|
| X-012 | `402b1234833e795d6a743a883bc1e3c41177293a` | retired-endpoint guard `14/14`; adjacent call/voice/live-search/shape/prompt gates green | `2/2` killed |
| G-01 | `b0cf2f9d5e364e9bbe2a7c6f94ef1b2701f4061d` | G-01 witness `17/17`; recon ultimately `163/3/0` | `2/2` killed |
| G-06, including X-009 | `7563e374fc906c5aff1e77a11a7e14a6ea61a3f7` | Ledger runtime `175/175`; honesty cumulative `32/32` | `2/2` killed |
| G-07 | `2b04262669d4c357a532097d2e2e2b4b09b63044` | RFC runtime `103/103`; search budget `33/33`; honesty cumulative `45/45` | `2/2` killed |
| G-08 | `cde89ffc952ede86aeef8f64b4f07d88efb683d4` | RFC round 3 `85/85`; honesty cumulative `79/79` | `2/2` killed |
| G-09 | `4a8b6f36c86e3ac2f63bfd5ddcdcc27f321f1afa` | RFC mode `127/127`; honesty cumulative `94/94` | `2/2` killed |
| G-10 | `57cf39e473c4061f314aba1ab2a5a26669601785` | shipped reality `68/68`; honesty cumulative `107/107` | `2/2` killed |
| G-11 | `58a257dd77319b5be7fb6836f884dd01dbff0849` | dead domains `55/55`; honesty cumulative `123/123` | `2/2` killed |
| G-12 | `824e3ba1d2dc5b7d8509aa26fbc59429bddf34da` | source liveness `16/16`; honesty cumulative `141/141` | `2/2` killed |
| G-15 | `61b4eef488e694e73b124ee10b31529d2829d9f8` | live-search disclosure `46/46`; honesty cumulative `152/152` | `2/2` killed |
| G-16 | `3fc08d22b44c3dd2d7aa0a3bfe726034ba500fae` | transfer mode `186/186`; honesty cumulative `195/195` | `2/2` killed |
| G-17 | `32ece09ea41169514c8e8f2a58dde4c9a3b41965` | anchor mode `66/66`; honesty `214/214` | `2/2` killed |
| X-021 | `94065e6eaf8d8bbe139cf3429531a4f5794fc0cf` | hybrid/fatwa `93/93`; full-fatwa contract `66/66` | `2/2` killed |

The baseline-only i18n guard defect was repaired separately in `27e67fa36e20d9543468456144a7e38387208535`: the guard now evaluates the real Quest dictionary under both LF and CRLF and kills a language-roster mutant and a raw-key-fallback mutant. It passes `256/256`. The protected Quest page was not edited.

## X-012 endpoint decision

Repository-wide consumer tracing found the relay names in source, deployment configuration, comments, and guards, but no enabled shipped caller. `index.html` defaults to `/api/ask`; its fast classifier remains disabled. The zero-consumer branch of the directive therefore applied.

Both old endpoints now preserve consent handling and CORS/method policy, return `410`, identify `/api/ask` as the replacement, and make zero provider calls. The affected guards now test the centralized live path or the tombstone contract instead of preserving model-only relay semantics.

## CLAIMS_AUDIT

| Item | Assertion, fixture, or reference | Before | After | Independent evidence | Status |
|---|---|---|---|---|---|
| X-012 | relay availability | callable model-only handlers | consent-aware `410` tombstones with `/api/ask` replacement | repository consumer scan plus executable handler guard | MECHANISM_FIXED |
| X-012 | call/voice/live-search/shape/prompt guards | treated retired relays as answer-producing surfaces | drive `/api/ask` where behavior is live and assert zero provider work at tombstones | direct handler execution and adjacent full gates | MECHANISM_FIXED |
| G-01 | recon array extraction and roster | authored miniature could certify a shallow parser | current parser is checked on sealed baseline Git blobs and an independently frozen roster | `git show` bytes, full-array seal, truncation and roster mutants | MECHANISM_FIXED |
| G-06 | Ledger environment and dispatch | local fake state was described too broadly; routing decision implied execution | fake Redis/preview state is labeled local; actual `ask.js` dispatch requires the later HADITH predicate and earlier closed exits are measured | sealed baseline sources and real `decidePath`/dispatch cases | MECHANISM_FIXED; deployment BLOCKED |
| X-009 | one-arrangement claim | implied exactly one arrangement runs Ledger | records `decidePath` as necessary but insufficient and distinguishes route eligibility from engine dispatch | production handler source plus STORED_FIQH and HADITH cases | MECHANISM_FIXED |
| G-07 | runtime/provider proof | injected transport risked reading as deployment proof | offline transport is explicit; production search is driven to reserve before transport and fail closed on refusal | production function with observed call order and refusal mutant | MECHANISM_FIXED; external acceptance BLOCKED |
| G-08 | planner, model, HTML, and provenance | authored response components were allowed to imply real provenance | authored components are labeled; real frozen pages are fully sealed, extracted, and bound to source identity | two independent real page blobs and URL/quote mutants | MECHANISM_FIXED; preview planner BLOCKED |
| G-09 | mode state | fake map and dated note risked a production-state claim | state is a local decision matrix; the dated live-store note is historical and unverified | production decision function and deployment/state mutants | MECHANISM_FIXED; deployment BLOCKED |
| G-10 | shipped reality | constructed handler scenario was called fresh production | scenario, transports, commit, and environment are explicitly local inputs | sealed manifest plus environment and Git-SHA drift mutants | MECHANISM_FIXED; reader evidence BLOCKED |
| G-11 | dead-domain evidence | historical network notes could read as current liveness transactions | notes are non-authentic context; only repository policy decisions are asserted | registry/policy/capability/retrieve agreement and decision mutants | MECHANISM_FIXED; current liveness BLOCKED |
| G-12 | liveness JSON | editable protected summary risked self-certifying current liveness | file is labeled an unsigned, unauthenticated summary and remains byte-identical | repository coverage plus authenticated-envelope date/status mutants | MECHANISM_FIXED; signed current probe BLOCKED |
| G-15 | live-search disclosure | narrow offline truth table was already honest | meaning preserved; all four final-byte combinations are driven and optional external replay is not claimed | production notice function and prefix/no-prefix mutants | MECHANISM_PRESERVED; replay NOT_ACQUIRED_OPTIONAL |
| G-16 | transfer pages | manifest exposed only short SHA-8 seals and authored examples | all 11 page entries carry full SHA-256; production extractor/matcher runs over the real blobs | full page/URL seals, real qualifier conflict, similarity and freshness mutants | MECHANISM_FIXED; current markup BLOCKED |
| G-17 | anchor provenance | fabricated page used a real-looking URL | authored parser diagnostic uses a fixture URI; exact-span checks use two full-sealed real request pages | production extractor/anchor verifier and URL/span mutants | MECHANISM_FIXED; current liveness/reviewer labels BLOCKED |
| X-021 | fatwa telemetry | authored `calls` and totals certified themselves | sealed offline responses drive `searchFatwas()` through its injected transport; observed search requests are compared to the return metric and coordinator fields | one observed adapter request, one observed coordinator request, false-count and propagation-bypass mutants | MECHANISM_FIXED; current service BLOCKED |
| Guard maintenance | Quest i18n extraction | CRLF-only slice evaluated an empty program on LF | JavaScript landmarks extract and execute the real protected block under LF and CRLF | real dictionary plus roster and fallback mutants | MECHANISM_FIXED |

No fixture in this audit is presented as a current network observation. Authored fixtures are labeled as authored, full seals bind frozen real pages where available, and external/current-state criteria remain non-green.

## External evidence that remains blocked

| Scope | Missing transaction or observation | Status |
|---|---|---|
| G-06 | deployed environment and real Redis observation | BLOCKED_OFFLINE |
| G-07 | deployment ID/SHA, Upstash transaction, provider request IDs, raw SSE | BLOCKED_OFFLINE |
| G-08 | real preview planner record and reviewer labels | BLOCKED_OFFLINE |
| G-09 | current deployed mode/store state | BLOCKED_OFFLINE |
| G-10 | deployed reader evidence for the claimed commit/environment | BLOCKED_OFFLINE |
| G-11 | current domain liveness transactions | BLOCKED_OFFLINE |
| G-12 | authenticated current probe envelope | BLOCKED_OFFLINE |
| G-15 | optional deployment replay | NOT_ACQUIRED_OPTIONAL |
| G-16 | current-host markup response and extractor result | BLOCKED_OFFLINE |
| G-17 | current liveness and semantic reviewer labels | BLOCKED_OFFLINE |
| X-021 | current fatwa-service response | BLOCKED_OFFLINE |

These blocks do not invalidate the narrower local mechanisms. They do prevent any claim that deployment, provider, Redis, current-host markup, or current liveness was observed in this offline round.

## Protected and ownership invariants

Each object ID is identical at the locked baseline and the final implementation SHA.

| Protected path | Baseline object | Final implementation object |
|---|---|---|
| `quest.html` | `79c7dc87fdb4cb3e9d209a08418f23dd61f27998` | `79c7dc87fdb4cb3e9d209a08418f23dd61f27998` |
| `quest-data/**` tree | `66a90cf34e3c86bb26c797b4b9dc5f1ca5360e7b` | `66a90cf34e3c86bb26c797b4b9dc5f1ca5360e7b` |
| `lib/data/fiqh-search.json.gz` | `1c159980771ee25d575ce1fcc0b624b1b58918b1` | `1c159980771ee25d575ce1fcc0b624b1b58918b1` |
| `data/source-liveness.json` | `f92f6583348d86ab1af9ae431e3d96bd4df07d92` | `f92f6583348d86ab1af9ae431e3d96bd4df07d92` |
| `lib/ledger/daily-budget.js` | `24ff435fff4299d051373fb5ae24a35046498725` | `24ff435fff4299d051373fb5ae24a35046498725` |
| `lib/ratelimit.js` | `3bca5e4e4057d7f0bc1083d91af029b6c0c6e623` | `3bca5e4e4057d7f0bc1083d91af029b6c0c6e623` |

The diff is empty for Owner-A files `lib/system-prompt.js`, `index.html`, `lib/takhrij-lock.js`, `lib/consistency-gate.js`, `api/ask.js`, `lib/hybrid-deen.js`, and `lib/stored-deen.js`. Registry edits are limited to the required gate registrations/count, recon roster/count, report summary, and LF attributes. No new waiver, skip, allow-failure, or continue-on-error line was added. The existing secret scanner was not weakened or edited.

## Closing measurements

| Check | Result |
|---|---|
| Complete gate runner | `75/75 EXIT=0` |
| Recon inside complete runner | `PASS=163 WARN=3 FAIL=0` |
| Guard-honesty meta gate | `214/214` |
| Full-fatwa contract | `66/66` |
| Hybrid/fatwa including X-021 | `93/93` |
| Retired endpoints | `14/14` |
| i18n UI | `256/256` |
| Quest UX in permitted headless-browser environment | `56/56` |
| Protected source/data changes | `0` |
| Pushes | `0` |

The complete-run evidence directory was `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-15T15-05-44-081Z-19488`. The three recon warnings are unchanged informational drift: `CALL_STREAM_SPEECH = true` while docs say false, `parseSegments` token not found, and `LONGEST_CARD_CHARS = 3405` exceeding the measured `3401` by four. Recon has no failure.

The candidate final diff from the locked baseline is: `50 files changed, 2470 insertions(+), 928 deletions(-)`.

No push was performed. Integration is left to the owner.
