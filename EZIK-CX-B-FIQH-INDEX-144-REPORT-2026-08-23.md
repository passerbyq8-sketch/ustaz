# EZIK Lane B Item 144 - Fiqh Index Noise Report

STATUS=COMMITTED_RED
REPORT_DATE=2026-08-23
ORDER=C:\EZIK-ORDERS\ORDER-EZIK-LANE-B-FIQH-INDEX-144.md

## 1. Branch and commits

START_SHA=d82f543d1f2a358a801c45aefa7487730cfeeab0
BRANCH=fix/fiqh-index-noise-20260823
COMMIT_1=9c556431495bbcf9b2747fcac67dcce1dda149a4 fix: remove fiqh index footnote noise
COMMIT_2=3486dd4f5ea3dd9e4fd0fad4e1d653fac698dc27 test: guard fiqh index against footnote noise
COMMIT_3_SHA=NOT_MEASURED
COMMIT_3_SUBJECT=docs: report fiqh index noise round
FINAL_HEAD=NOT_MEASURED

COMMIT_3_SHA and FINAL_HEAD cannot be embedded truthfully in the file committed by commit 3:
changing the file to add that SHA would create a different commit SHA. They are measured after
this sealed file is committed and are reported in the handoff.

PUSH_COMMANDS_RUN=0
DEPLOY_COMMANDS_RUN=0
NETWORK_COMMANDS_RUN=0

## 2. Hard stops proof

Ground check before any write:

~~~
git rev-parse HEAD
d82f543d1f2a358a801c45aefa7487730cfeeab0

git rev-parse --abbrev-ref HEAD
fix/fiqh-index-noise-20260823

git status --porcelain
<EMPTY; Git emitted only an out-of-scope global-ignore permission warning>
~~~

Frozen-surface command:

~~~
git diff --name-only d82f543d1f2a358a801c45aefa7487730cfeeab0 HEAD -- index.html api/ask.js api/lessons-search.js lib/lessons-source-card.js guards/lessons-search-guard.cjs guards/fixtures-lessons-search.json api/lib-search.js lib/lib-source-card.js lib/encyclopedia.js lib/free-brain/tools.js lib/fatwa-contract.js lib/output-reviewer.js fixtures/fatwa-authority-eighteen.json guards/attribution-on-output-guard.cjs
~~~

Output, zero bytes:

~~~
~~~

Full changed-path command:

~~~
git diff --name-only d82f543d1f2a358a801c45aefa7487730cfeeab0 HEAD
.gitattributes
EZIK-CX-B-FIQH-INDEX-144-REPORT-2026-08-23.md
EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md
gates.json
guards/fiqh-index-guard.cjs
guards/fixtures-fiqh-index.json
guards/hybrid-live-fatwa-guard.cjs
guards/stored-deen-sub-suite.cjs
lib/data/fiqh-search.json.gz
recon-audit.cjs
~~~

Every path is accounted for:

- .gitattributes: pins the new guard, fixture, and sealed report to LF.
- EZIK-CX-B-FIQH-INDEX-144-REPORT-2026-08-23.md: this audit report.
- EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md: 92-gate roster and recon facts.
- gates.json: registers fiqhindex as gate 92.
- guards/fiqh-index-guard.cjs: new offline regression guard.
- guards/fixtures-fiqh-index.json: frozen removed keys/text and 20 named real terms.
- guards/hybrid-live-fatwa-guard.cjs: measured corpus count and SHA-256 seal.
- guards/stored-deen-sub-suite.cjs: measured corpus seal and 92-name roster assertion.
- lib/data/fiqh-search.json.gz: data-only removal of the 25 frozen rows.
- recon-audit.cjs: GATES_EXPECTED 91 to 92.

No retrieval reader, frozen attribution file, interface file, deployment target, or branch was
changed. No push or deploy command was run.

## 3. Measure-first evidence

### 3.1 Original artifact and shape

OLD_GZ_BYTES=5389375
OLD_GZ_SHA256=6482d677ebf09cc5627a172ee77114587046edeb95529092cb644e42e00d13a2
OLD_RAW_BYTES=20979374
TOP_LEVEL_TYPE=array
TOP_LEVEL_LENGTH=3070
ONE_ENTRY_FIELDS=id,part,term,search,snippet
OLD_ENTRY_COUNT=3070
EXPECT_3070_MATCH=true

The prior split did not match the artifact:

PRIOR_REAL_TERMS=2959
PRIOR_NOISE=111
MEASURED_NOISE=25
CAND_DELTA_VS_111=-86

The structural test requires an empty snippet and one of six measured bare printed-reference
sentence forms: an earlier-biography volume/page reference, a biographical works fragment, a
bibliography-only reference list, or one of three sentence-style cross-reference fragments.
Arabic diacritics are removed only for classification. Removal itself used no classifier or
regex; it used the frozen ordered ID list below.

HINT_B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCDZoSDYtQ==

FALSE_POSITIVE_SCAN=0
FALSE_NEGATIVE_SCAN=0

The scans are the result of an adversarial review of all 25 matches and of all remaining
empty-snippet multiword, long, numeric, and punctuated entries. Printed-edition page comparison
was not available and is listed under NOT_MEASURED.

### 3.2 Exact serialization round trip

SERIALIZATION=Buffer.from(JSON.stringify(parsed),utf8)
GZIP=zlib.gzipSync(serialized)
ROUNDTRIP_JSON_IDENTICAL=true
ROUNDTRIP_GZ_IDENTICAL=false
ROUNDTRIP_GZ_BYTES=5431273
ROUNDTRIP_GZ_SHA256=75685b62deafd27d2c39f582cfe9db6e80baf90ff651c2c5b69a6e562bd1a8a2

The gzip mismatch is accepted by the order because zlib settings differ across builds. The
uncompressed JSON bytes, which are the contract, were identical.

### 3.3 fiqh-search reference map

The measured output of git grep -l -F "fiqh-search" was:

~~~
EZIK-GUARDS-HONESTY-REPORT-2026-08-15.md
build-mushaf-layout.cjs
call-mode-guard.cjs
guards/hybrid-live-fatwa-guard.cjs
guards/search-budget-p0-guard.cjs
guards/stored-deen-sub-suite.cjs
lib/encyclopedia.js
lib/free-brain/tools.js
recon-audit.cjs
vercel.json
~~~

Classifications:

- EZIK-GUARDS-HONESTY-REPORT-2026-08-15.md: documentation/history only.
- build-mushaf-layout.cjs: comment only.
- call-mode-guard.cjs: gate-time instrumentation of a runtime read.
- guards/hybrid-live-fatwa-guard.cjs: gate-time read and active SHA/count seal.
- guards/search-budget-p0-guard.cjs: gate-time config/path check only.
- guards/stored-deen-sub-suite.cjs: gate-time read and active SHA/count seal.
- lib/encyclopedia.js: runtime read.
- lib/free-brain/tools.js: comment only.
- recon-audit.cjs: audit-time read and parse.
- vercel.json: deployment includeFiles config only.

SEALED_HIT_COUNT=2
SEALED_HIT=guards/hybrid-live-fatwa-guard.cjs:16
SEALED_HIT=guards/stored-deen-sub-suite.cjs:13

Both active seals were updated in commit 1 with the data. The 40-hex value in
EZIK-GUARDS-HONESTY-REPORT-2026-08-15.md is historical documentation, not an active corpus seal.

### 3.4 Rebuild proof and required numbers

NEW_ENTRY_COUNT=3045
REMOVED_COUNT=25
KEPT_IDENTICAL=3045
KEPT_DIFFERING=0
FROZEN_KEYS_ABSENT=25/25
NEW_RAW_BYTES=20975412
NEW_GZ_BYTES=5430609
NEW_GZ_SHA256=c094d1267110224794a123858d062d1ab068aa3735d7422887154c6dc1111993
NEW_GZIP_MAGIC=1f8b
NEW_TOP_LEVEL_TYPE=array

CORE_BYTES_DECLARED_BEFORE=1781243
CORE_BYTES_MEASURED_BEFORE=1781541
CORE_BYTES_DECLARED_AFTER=1781243
CORE_BYTES_MEASURED_AFTER=1781541
CORE_BYTES_MEASURED_DELTA=0
CORE_PREEXISTING_DRIFT=+298

The +298 CORE drift existed before the first write and was unchanged after the data rebuild.

### 3.5 Guard and registration

GUARD_NAME=fiqhindex
GUARD_ASSERTIONS=A,B,C,D,E,F
GUARD_CHECKS=12/12
MUTANTS_KILLED=3/3
GUARD_NETWORK_ACCESS=0
GUARD_OUTSIDE_REPOSITORY_READS=0

Measured registration changes:

- gates.json: 91 entries to 92 entries; fiqhindex appended.
- recon-audit.cjs: GATES_EXPECTED 91 to 92.
- .gitattributes: all three new-path pins absent to present.
- guards/stored-deen-sub-suite.cjs: exact roster length 91 to 92.
- EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md: All 91 to All 92.
- EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md roster: fiqhindex absent to fiqhindex 0.
- EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md: TOTAL_GATES 91/91 to 92/92.
- EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md: RECON 182/1/0 to 183/1/0
  (the enforced pre-self-check value; the printed final summary is 184/1/0).

## 4. Full suite and committed-red stop

FULL_SUITE_COMMAND=npm.cmd run gates
FULL_SUITE_COMPLETED=true
SUITE_LINE=SUITE: 90/92 EXIT=0
GATES_PROCESS_EXIT=1
RECON_SUMMARY=SUMMARY PASS=184 WARN=1 FAIL=0
TREE_AFTER_SUITE=0 dirty path(s)
CHATUX=EXIT=0
CHATUX_RERUNS=0
FIQHINDEX=EXIT=0
MUTANTS_KILLED=3/3

The suite runner printed EXIT=0 inside its SUITE line while the npm process returned exit 1
because two gates failed. Both facts are preserved exactly.

FAIL_GATE=bankintegrity
FAIL_ASSERTION=B12 CORE_BYTES declared 1781243 but measured 1781541 (+298)
FAIL_ASSERTION=B14 vendor/react-dom.umd.js prose 131835 but disk 132102 (+267)
FAIL_ASSERTION=B14 vendor/react.umd.js prose 10751 but disk 10782 (+31)
FAIL_EVIDENCE=C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T07-22-08-131Z-23152\gate-bankintegrity.log

The B12 drift was independently measured before and after this round with delta zero. None of
sw.js, the vendor files, or the bank guard is in this round's changed-path list. The order says
not to repair or revert after a non-chatux failure, so no repair or rerun was performed.

FAIL_GATE=questux
FAIL_ASSERTION=NONE; guard crashed after 7 passes and 0 failed assertions
FAIL_ERROR=Page.enable aborted: read ECONNRESET
FAIL_EVIDENCE=C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T07-22-08-131Z-23152\gate-questux.log

No quest source, fixture, or guard changed. The crash happened at the browser transport attach
seam. Causation and reproducibility were not measured because the order authorizes five reruns
only for chatux, and chatux passed.

## 5. Removed list in full

REMOVED=F00248 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzOS4=
REMOVED=F00249 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMyOQ==
REMOVED=F00250 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzMi4=
REMOVED=F00251 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzMy4=
REMOVED=F00252 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzMy4=
REMOVED=F00253 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzNC4=
REMOVED=F00254 B64=2YXZhiDYotir2KfYsdmHOiDCq9iq2YHYs9mK2LEg2KfZhNmF2YjYt9ijwrsu
REMOVED=F00255 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDMzOC4=
REMOVED=F00256 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM1Mi4=
REMOVED=F00257 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM1NC4=
REMOVED=F00258 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM1Ni4=
REMOVED=F00259 B64=2KfZhNil2LXYp9io2KkgMlwxNjDYjCDYp9mE2KfYs9iq2YrYudin2KggMlw3MDbYjCDZiNi32KjZgtin2Kog2KfYqNmGINiz2LnYryA2XDM2KS4=
REMOVED=F00260 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM0OS4=
REMOVED=F00261 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAyINi1IDQyMy4=
REMOVED=F00262 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM0NC4=
REMOVED=F00263 B64=KNin2YTYpdi12KfYqNipIDJcMjQ02Iwg2YjYt9io2YLYp9iqINin2YTZg9io2LHZiSAzXDQ2MtiMINmI2KfZhNin2LPYqtmK2LnYp9ioIDJcNzc5KS4=
REMOVED=F00264 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM1OS4=
REMOVED=F00931 B64=2KrZgtiv2YXYqiDYsdis2YXYqtmHINmB2Yog2KwgMiDYtSA0MDIu
REMOVED=F00932 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCAxINi1IDM0MS4=
REMOVED=F01108 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCA0INi1IDMyMi4=
REMOVED=F01109 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrCA0INi1IDMyMy4=
REMOVED=F01976 B64=2YjZjtiu2Y7Yp9mE2Y7ZgdmOINmB2ZDZiiDYsNmO2YTZkNmD2Y4g2KfZhNiv2ZHZjtio2Y/ZiNiz2ZDZitmR2Y8g2YXZkNmG2Y4g2KfZhNmS2K3ZjtmG2Y7ZgdmQ2YrZkdmO2KnZkNiM
REMOVED=F02542 B64=2YjZjtmE2ZDZhNiq2ZHZjtmB2ZLYtdmQ2YrZhNmQOiDYsdmOOiDYp9mE2ZLZhdmP2YTZktit2Y7ZgtmPINin2YTYo9mS2Y/YtdmP2YjZhNmQ2YrZkdmPLg==
REMOVED=F02867 B64=2KrZgtiv2YXYqiDYqtix2KzZhdiq2Ycg2YHZiiDYrDEg2LUzNjAu
REMOVED=F02933 B64=2YLZjtin2YTZjiDYp9mE2ZLZgtmP2LHZkti32Y/YqNmQ2YrZkdmPOiDZh9mO2LDZkNmH2ZAg2KfZhNii2ZLZitmO2KnZjyAo2YrZjti52ZLZhtmQ2Yog2KfZhNii2ZLZitmO2KnZjg==

## 6. What was not measured

- SOURCE_EDITION_PAGE_COMPARISON=NOT_MEASURED. The 101 MB builder source and printed edition
  are not in this repository. Candidate legitimacy was judged from the complete indexed rows
  and their structural context.
- NETWORK_BEHAVIOR=NOT_MEASURED. Network use was forbidden and no network command was run.
- DEPLOYED_BEHAVIOR=NOT_MEASURED. Deploying was forbidden.
- QUESTUX_REPRODUCIBILITY=NOT_MEASURED. The only authorized flaky rerun rule names chatux,
  which passed on its first run.
- BANKINTEGRITY_RERUN=NOT_MEASURED. The order says to stop on any non-chatux gate failure.
- COMMIT_3_SHA_IN_PAYLOAD=NOT_MEASURED. A commit cannot contain its own final SHA without
  changing that SHA. The post-commit handoff records it.
- FINAL_HEAD_IN_PAYLOAD=NOT_MEASURED for the same self-reference reason.
- NO independent theological review was performed. The data judgment was limited to whether
  each row was a printed cross-reference fragment rather than a term entry.

## 7. Seal verification

REPORT_ENCODING=UTF-8
REPORT_BOM=false
REPORT_EOL=LF
SEAL_VERIFIED_FROM_DISK=true

PAYLOAD_BYTES=12195
PAYLOAD_SHA256=9ed654e33ecab4b8c8a37a7cb771bce00c7569f0b3b772f48f0d259e0cf81f89
