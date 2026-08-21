# EZIK CX Merge Round 23 Report — 2026-08-22

MERGE_HEAD_FULL=c781dedb0aa3b13da586f88e369af8969ff6676c
BRANCH=merge/round-23-20260822
ORIGIN_MAIN=8e340c51b2c235af09f678ab6a70c5ead9620e92
SOURCE_A_HEAD=8c76fe46d627cbd27695488a434d69c0c59ee9d3
SOURCE_B_HEAD=c95ca85ee0b1ffae6f769d25360930969be834af
BASE_FULL=4d5ef0650f8b9913c8e7b8bd00c68854568b5de4
REPORT_ENCODING=UTF-8_NO_BOM

## Round commits

| Role | Full commit |
|---|---|
| Merge A (`--no-ff`) | `c0fa5229d32fd7626d3180680e70cdbd898f0af3` |
| Merge B (`--no-ff`) | `c91d612ec6e9d8c1fa3134ca32170bae0b77ca95` |
| Single reconciliation commit | `c781dedb0aa3b13da586f88e369af8969ff6676c` |

The Merge A parents are `8e340c51b2c235af09f678ab6a70c5ead9620e92` and
`8c76fe46d627cbd27695488a434d69c0c59ee9d3`. The Merge B parents are
`c0fa5229d32fd7626d3180680e70cdbd898f0af3` and
`c95ca85ee0b1ffae6f769d25360930969be834af`.

## Opening gate and ancestry

- `origin/main` after fetch was exactly `8e340c51b2c235af09f678ab6a70c5ead9620e92`; `8e340c5` is its ancestor.
- `BASE_ANCESTOR_ORIGIN_MAIN=True`.
- `BASE_ANCESTOR_A=True`; branch A has 6 commits from the base and matched its declared final head.
- `BASE_ANCESTOR_B=True`; branch B has 2 commits from the base and matched its declared final head.
- Before branching, the only status entry was `?? ORDER-MERGE-23.md`, the explicitly exempt untracked scaffold.
- Branch A was fetched by the required read-only local path from `C:\Users\passe\projects\ustaz-cc-ui`.

## Merge measurements

- `MERGE_A_CONFLICT_FILES=1`: `quest-bank-integrity-guard.cjs`.
- `HUNKS=1`.
- The conflict was only the `sw.js` seal. It was resolved temporarily to main's seal and `ezik-v12`, while all mushaf-page policy changes were retained.
- Merge A `show --stat`: 6 files, 1,362 insertions, 61 deletions.
- `EFFECT_LINE=6302`; `EARLY_RETURN_LINE=6306`; `EFFECT_BEFORE_RETURN=True`.
- `INDEX_BARE_LF=0` after the `index.html` resolution.
- `MERGE_B_CONFLICT_FILES=0`.
- `INTERSECTION_COUNT=0` between branch B and the branch-A/main owned-path union.
- Merge B `show --stat`: 7 files, 166 insertions, 10 deletions.
- Measured branch-B note: its seventh path is `fixtures/fatwa-authority-eighteen.json` rather than a path under `config/`; the declared seven-path count and zero intersection both hold.
- Reconciliation `show --stat`: 5 files, 14 insertions, 33 deletions.

## Measured path union

`UNION_PATH_COUNT=16`; measured against each round commit's first parent and confirmed by
`origin/main..MERGE_HEAD_FULL` (`1,542` insertions, `104` deletions):

- `assets/daily-verses.json`
- `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md`
- `fixtures/fatwa-authority-eighteen.json`
- `guards/attribution-on-output-guard.cjs`
- `guards/stored-deen-sub-suite.cjs`
- `guards/takhrij-lock-guard.cjs`
- `guards/vacuous-assertion-guard.cjs`
- `index.html`
- `lib/fatwa-contract.js`
- `lib/output-reviewer.js`
- `lib/stored-deen.js`
- `quest-bank-integrity-guard.cjs`
- `recon-audit.cjs`
- `sw.js`
- `theme-coverage-guard.cjs`
- `tools/wird-guard.cjs`

## Ordered reconciliation evidence

- `CORE_BYTES_BEFORE=1711855`; `CORE_BYTES_AFTER=1729120`; `CORE_BYTES_DELTA=+17265`.
- Disk reconstruction confirmed all 14 `sw.js` prose measurements and zero unregistered prose numbers of 500 or more.
- `ezik-v11` tree count is 0; `ezik-v12` tree count is 0; `ezik-v13` tree count is 2, once in `sw.js` and once in its guard.
- `SW_BYTES=41031`; `CR=0`; `BOM=0`.
- `INDEX_CRLF=17765`; `INDEX_BARE_LF=0`; `INDEX_BARE_CR=0`.
- Old `sw.js` seal: `ff888e9d51b87259c5842fc80ab38c6d4671211e8ae5f6ca571a097017955ed3`.
- New disk-derived `sw.js` seal: `0910a1c2757a0d28af901d12b87f61b48222d018e30875ae5e0340922df7140e`; `SW_SEAL_MATCH=True`.
- Immediate bank comparison: 71 checks passed, 0 failed, exit 0.
- The vacuous-assertion exclusions were removed permanently. The ordinary sweep covers all 148 `.cjs` files and found 124/124 candidate pairs protected; 33 checks passed, 0 failed.
- The implementation-report consistency result is now counted as a pass. `recon` therefore reports the required final `181/1/0` without reducing a floor or removing an assertion.

## Daily verse offline measurement

- `DAILY_VERSES_IN_CORE=False`.
- `DAILY_VERSES_RUNTIME_READS=0`.
- `DAILY_VERSE_EMBEDDED_IN_INDEX=True`.
- `DAILY_VERSE_OFFLINE_FROM_CACHED_SHELL=True`.
- `OPEN_ITEM_DAILY_VERSES=NO`: the JSON file is the generated build-time source of truth, while the card reads the embedded `DAILY_VERSES` array from the cached shell and performs no runtime network read. The separate asset's absence from `CORE` does not break this card offline.

## Required gate floors

| Gate | Measured result |
|---|---|
| Roster | `90/90 EXIT=0` |
| `themecoverage` | `1337/1337 EXIT=0` |
| `wird` | `PASS=989 FAIL=0 EXIT=0` |
| `bankintegrity` | `PASS=71 FAIL=0 EXIT=0` |
| `questux` | `61/61` five times outside the sandbox; all five `EXIT=0` |
| `i18nui` | `276/276 EXIT=0` |
| `recon` | `PASS=181 WARN=1 FAIL=0 EXIT=0` |
| `bootinvariants` | `PASS=30 FAIL=0 EXIT=0` |
| `attributionoutput` | `PASS=69 FAIL=0 EXIT=0` |

The single expected recon warning remains the measured pre-existing body-cap note:
`LONGEST_CARD_CHARS=3405` versus longest card `3401`.

## Canonical evidence run

- Command: `npm.cmd run gates`, with `questux` outside the sandbox as part of the run.
- Evidence directory: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-21T14-18-29-260Z-7992`.
- Identifying header: `HEAD: c781dedb0aa3b13da586f88e369af8969ff6676c`.
- `head_before` and `head_after` both equal `MERGE_HEAD_FULL`.
- `tree_dirtied_by_run=false`; the sole raw dirty entry before and after was the exempt `?? ORDER-MERGE-23.md`.
- Suite result: 90 passed, 0 failed.
- Four additional out-of-sandbox `questux` executions on the same HEAD supplied repetitions 2–5; each printed `OK: 61/61 checks passed` and exit 0.

## Round-specific assertions and disposition

- `EFFECT_BEFORE_RETURN=True`.
- `EZIK_V11_COUNT=0`; `EZIK_V12_COUNT=0`.
- `ezik-mushaf-pages-v1` is present in both the worker and guard and is explicitly excluded from the `activate` sweep by `k !== MUSHAF_CACHE`.
- `TREE_CLEAN_EFFECTIVE=YES`: only the explicitly exempt untracked order remains outside committed state.
- `PUSH_READY=YES` is a declaration, not permission.
- `PUSH_COUNT=0`.
- `DEPLOY_COUNT=0`.

---
REPORT_PAYLOAD_BYTES=6315
REPORT_SHA256=6b8334be4177cbee9667dd8a37a45607f01189dada20fafa9ec1c4caac98c45f
