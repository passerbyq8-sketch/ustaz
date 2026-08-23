# EZIK Lessons Browse Proxy 24C-B2 — Green-Correction Report

Date: 2026-08-23

Branch: `feat/lessons-browse-proxy-24c`

Order: `ORDER-24C-B2-PROXY-GREEN.md`, including the authorized `.gitattributes` amendment
Status: committed functional corrections; all gates green except the recorded assertion-free `questux` Chrome transport crash.

## Outcome

- Correction commit: `4c68dd127ae4dfc97b317420facbd8b542836bcf` (`4c68dd1`).
- Canonical suite evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T12-35-44-734Z-23540`.
- Canonical suite result: 92/93 gates passed. The sole red gate was `questux`; it crashed on `Page.enable ... ECONNRESET` after 7 passing checks and 0 failed assertions.
- `recon`: `PASS=185 WARN=1 FAIL=0`; `bankintegrity`: 76/76; `telemetrytext`: 21/21; `lessonsbrowse`: 81/81 with `MUTANTS_KILLED=2/2`.
- The runner prints a hard-coded `EXIT=0` inside its suite banner, but its actual process exit was 1 because `questux` exited 1. This report does not claim 93/93.
- No push and no merge were performed.

## Section 0 — entry gate

The required starting measurements were:

```text
git rev-parse --abbrev-ref HEAD   => feat/lessons-browse-proxy-24c
git rev-parse --short HEAD        => b82a61b
git status --porcelain            => 0 lines
git rev-parse origin/main         => a332cb3bfc43067f88f4878654a9a3846d07cb14
```

All four matched the order, so execution continued.

## Section 1 — vendor worktree normalization

| File | Before bytes | Before CR | After bytes | After CR |
|---|---:|---:|---:|---:|
| `vendor/react.umd.js` | 10,782 | 31 | 10,751 | 0 |
| `vendor/react-dom.umd.js` | 132,102 | 267 | 131,835 | 0 |

The first exact-file `git checkout -- vendor/react.umd.js vendor/react-dom.umd.js` did not alter the physical worktree sizes. The prescribed fallback was then used: only those two files were removed and `git checkout -- vendor/` restored their committed bytes. `git status --porcelain` remained empty. Neither vendor file has a tracked diff or a commit in this round.

## Authorized `.gitattributes` amendment

Measurements count physical LF-delimited lines, including blank lines.

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Bytes | 29,589 | 29,633 | +44 |
| Lines | 511 | 512 | +1 |
| CR bytes | 0 | 0 | 0 |

Exactly one line was added, for recon item 14:

```gitattributes
guards/lessons-browse-guard.cjs text eol=lf
```

No line was added for `guards/fixtures-lessons-browse.json`, `api/lessons-browse.js`, this report, or any other file: recon item 14 requires the registered gate script to be LF-pinned, and after that single line recon passed the entire 93-entry roster. The full diff is:

```diff
diff --git a/.gitattributes b/.gitattributes
index 478d613..0f5520c 100644
--- a/.gitattributes
+++ b/.gitattributes
@@ -509,3 +509,4 @@ EZIK-CC-LESSONS-CALL-REPORT-2026-08-23.md text eol=lf
 guards/fiqh-index-guard.cjs text eol=lf
 guards/fixtures-fiqh-index.json text eol=lf
 EZIK-CX-B-FIQH-INDEX-144-REPORT-2026-08-23.md text eol=lf
+guards/lessons-browse-guard.cjs text eol=lf
```

Nothing else in `.gitattributes` changed.

## Section 2 — complete active roster-count pin inventory

The initial broad `git grep -n -w 92` included data/history occurrences and one unrelated arithmetic fact (`23 topic classes × 4 audience bands = 92 reviewed cells` at implementation-report line 208). That fact is not a gate-roster pin and was deliberately retained. The active roster pins and truth consumers were:

| Location | Measured pre-fix state | Correction | Reason |
|---|---|---|---|
| `recon-audit.cjs:762` | `GATES_EXPECTED = 92` | `93`; comment names `lessonsbrowse` | Canonical recon count and new guard registration |
| `guards/stored-deen-sub-suite.cjs:664,666,667` (the takhrij suite) | `names.length === 92`; two `92-name contract` labels | All three changed to 93 | Preserve `ORIGINAL_GATE_SET_MATCH` and its two deletion-mutant assertions at the new exact count |
| `guards/honesty/g01-recon.cjs` | No literal `92`; reads `gates.json` length and extracts `GATES_EXPECTED` from recon | No edit | G-01 already derives both sides dynamically; changing it would be unnecessary logic churn |
| `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md:338,365` | `All 92 gates`; `TOTAL_GATES 92/92 PASS` | Both changed to 93; the associated pre-self recon fact was refreshed | This was the fourth measured active pin consumed by recon |

The focused pre-fix inventory was:

```text
EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md:338:All 92 gates, run by the canonical `npm run gates` runner from `gates.json`:
EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md:365:TOTAL_GATES        92/92 PASS
guards/stored-deen-sub-suite.cjs:664:    function exactGateSet(names) { return JSON.stringify(names) === JSON.stringify(EXPECTED_GATES) && names.length === 92; }
guards/stored-deen-sub-suite.cjs:666:    ok('MUTANT 11 KILLED: deleting namepresence breaks the exact 92-name contract', !exactGateSet(EXPECTED_GATES.filter((name) => name !== 'namepresence')));
guards/stored-deen-sub-suite.cjs:667:    ok('MUTANT 12 KILLED: deleting guardhonesty breaks the exact 92-name contract', !exactGateSet(EXPECTED_GATES.filter((name) => name !== 'guardhonesty')));
recon-audit.cjs:762:  const GATES_EXPECTED = 92;
```

No assertion was removed, no floor was lowered, no file was excepted, and no guard logic was weakened.

## Section 3 — telemetry text shape

The six browse-proxy log objects used an unreviewed field name, `code`. Each was changed to the telemetry allow-listed field name `reason`; the six fixed uppercase values were retained unchanged:

- `SEARCH_API_TOKEN_MISSING`
- `FETCH_FAILED`
- `UPSTREAM_UNAUTHORIZED`
- `UPSTREAM_STATUS`
- `BODY_TOO_LARGE`
- `BODY_UNREADABLE`

The browse guard was updated to assert the same `reason` shape. The principle did not change: logs contain only a fixed classification code, never exception text, `error.message`, request text, the token, or an exception binding.

Complete telemetry gate evidence:

```text
$ node guards/telemetry-text-guard.cjs
cwd:  C:\Users\passe\projects\ustaz-cx-chatux
exit: 0
ms:   195

--- stdout ---
  PASS  the delivery-path roster is non-empty
  PASS  api/ask.js yields console calls to sweep
  PASS  every console call on every delivery path terminates
  PASS  no delivery path prints a field derived from the reader question
  PASS  every printed field name has been reviewed onto the allow-list
  PASS  deleted and still deleted — `queries: out.spend`
  PASS  deleted and still deleted — `resolvedTopic: storedContext.resolvedTopic`
  PASS  deleted and still deleted — `query: storedOut.searchQuery`
  PASS  deleted and still deleted — `subject: claimSubject.subject`
  PASS  and the counts an autopsy reads were not deleted with them
  PASS  the cited-delivery payload carries no reader text out of the rows it summarises
  PASS  ...and it still reports one outcome per cited row
  PASS  mutant seam applied — 1 — a deleted field is put back
  PASS  MUTANT KILLED by exactly the rule that owns it — 1 — a deleted field is put back
  PASS  mutant seam applied — 2 — a new text field under another name
  PASS  MUTANT KILLED by exactly the rule that owns it — 2 — a new text field under another name
  PASS  mutant seam applied — 3 — a text field hidden inside an array, under an allowed name
  PASS  MUTANT KILLED by exactly the rule that owns it — 3 — a text field hidden inside an array, under an allowed name
  PASS  mutant seam applied — 4 — an unreviewed field built from an expression nobody denied
  PASS  MUTANT KILLED by exactly the rule that owns it — 4 — an unreviewed field built from an expression nobody denied
  PASS  control: the sweep is not simply failing everything
SUMMARY telemetry-text PASS=21 FAIL=0

--- stderr ---
```

## Section 4 — three literal `questux` runs

All three standalone runs had exit 1 and identical output. Each reached seven green checks, recorded zero assertion failures, retried the Chrome attach once, and then crashed in the transport layer.

### Run 1

```text
$ node quest-ux-guard.cjs quest.html
=== quest-ux-guard (S100) — quest.html ===

=== P2. THE HADITH CARD LABEL ===
  PASS  the shipped HadithCard exposes one inspectable label decision
  PASS  no surviving narrator or ruling gets the neutral label
  PASS  a surviving narrator gets the supported-hadith label
  PASS  a surviving ruling alone gets the supported-hadith label
  PASS  the badge renders only the decided label, never an interpolated narrator

=== A. THE BANK IS SEALED ===
  PASS  every quest-data file is byte-for-byte unchanged
  PASS  the quest-data directory holds exactly the files it held

=== B. THE ROUND (a real round, in a real browser) ===
  RETRY  browser attach attempt 1/2 failed: Page.enable aborted: read ECONNRESET
         retrying once — this line is the record that it happened.

GUARD CRASHED (not an assertion failure) after 7 check(s), 0 of which had already failed.
Error: Page.enable aborted: read ECONNRESET
    at C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:318:66
    at Socket.die (C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:239:54)
    at Socket.emit (node:events:509:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

### Run 2

```text
$ node quest-ux-guard.cjs quest.html
=== quest-ux-guard (S100) — quest.html ===

=== P2. THE HADITH CARD LABEL ===
  PASS  the shipped HadithCard exposes one inspectable label decision
  PASS  no surviving narrator or ruling gets the neutral label
  PASS  a surviving narrator gets the supported-hadith label
  PASS  a surviving ruling alone gets the supported-hadith label
  PASS  the badge renders only the decided label, never an interpolated narrator

=== A. THE BANK IS SEALED ===
  PASS  every quest-data file is byte-for-byte unchanged
  PASS  the quest-data directory holds exactly the files it held

=== B. THE ROUND (a real round, in a real browser) ===
  RETRY  browser attach attempt 1/2 failed: Page.enable aborted: read ECONNRESET
         retrying once — this line is the record that it happened.

GUARD CRASHED (not an assertion failure) after 7 check(s), 0 of which had already failed.
Error: Page.enable aborted: read ECONNRESET
    at C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:318:66
    at Socket.die (C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:239:54)
    at Socket.emit (node:events:509:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

### Run 3

```text
$ node quest-ux-guard.cjs quest.html
=== quest-ux-guard (S100) — quest.html ===

=== P2. THE HADITH CARD LABEL ===
  PASS  the shipped HadithCard exposes one inspectable label decision
  PASS  no surviving narrator or ruling gets the neutral label
  PASS  a surviving narrator gets the supported-hadith label
  PASS  a surviving ruling alone gets the supported-hadith label
  PASS  the badge renders only the decided label, never an interpolated narrator

=== A. THE BANK IS SEALED ===
  PASS  every quest-data file is byte-for-byte unchanged
  PASS  the quest-data directory holds exactly the files it held

=== B. THE ROUND (a real round, in a real browser) ===
  RETRY  browser attach attempt 1/2 failed: Page.enable aborted: read ECONNRESET
         retrying once — this line is the record that it happened.

GUARD CRASHED (not an assertion failure) after 7 check(s), 0 of which had already failed.
Error: Page.enable aborted: read ECONNRESET
    at C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:318:66
    at Socket.die (C:\Users\passe\projects\ustaz-cx-chatux\quest-ux-guard.cjs:239:54)
    at Socket.emit (node:events:509:28)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

Per the order, this assertion-free crash was recorded under “ما لم أقسه” and was not repaired.

## Sections 5–6 — boundaries and gate progression

The correction commit changed exactly these six paths:

- `.gitattributes` — the single authorized line only
- `recon-audit.cjs`
- `guards/stored-deen-sub-suite.cjs`
- `EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md`
- `api/lessons-browse.js`
- `guards/lessons-browse-guard.cjs`

`git diff b82a61b 4c68dd1 -- app.jsx app.js index.html` was empty. `app.jsx`, `app.js`, and `index.html` were not touched. The fixture, `gates.json`, `sw.js`, the bank guard, lessons-search guard/API, and theme guard were not changed in this correction.

The first post-commit suite evidence directory was `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T12-29-07-371Z-5668`. It measured 91/93: `questux` had the same assertion-free Chrome crash, while recon found a mixed-EOL physical worktree copy of `guards/stored-deen-sub-suite.cjs` plus the resulting stale report count. The tracked file was not changed; the exact working copy was restored from its committed blob, yielding uniform CRLF and a zero-line status. The second post-commit suite is the canonical evidence below.

### Gate command 1 — canonical full suite, literal stdout

```text
$ node tools/run-gates.cjs
=== gate suite — 93 gates from gates.json ===
HEAD:     4c68dd127ae4dfc97b317420facbd8b542836bcf
tree:     0 dirty path(s)
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T12-35-44-734Z-23540

worship              EXIT=0  (47ms)
quran                EXIT=0  (92ms)
layout               EXIT=0  (118ms)
babel                EXIT=0  (1085ms)
runtime              EXIT=0  (2089ms)
recon                EXIT=0  (6237ms)
display              EXIT=0  (481ms)
referral             EXIT=0  (468ms)
classifier           EXIT=0  (2694ms)
hafs                 EXIT=0  (3347ms)
call                 EXIT=0  (25907ms)
history              EXIT=0  (9963ms)
markdown             EXIT=0  (7332ms)
reveal               EXIT=0  (1962ms)
quranquest           EXIT=0  (2837ms)
prayerquest          EXIT=0  (136ms)
bankintegrity        EXIT=0  (318ms)
contentreview        EXIT=0  (162ms)
themecoverage        EXIT=0  (1171ms)
chatux               EXIT=0  (13123ms)
a11y                 EXIT=0  (2488ms)
questux              EXIT=1  (2016ms)
attribution          EXIT=0  (6130ms)
claim                EXIT=0  (307ms)
sourceregistry       EXIT=0  (452ms)
bravequery           EXIT=0  (468ms)
smartretrieval       EXIT=0  (445ms)
ledgercontract       EXIT=0  (3386ms)
ledgerretrieval      EXIT=0  (159ms)
ledgergates          EXIT=0  (326ms)
ledgerruntime        EXIT=0  (131ms)
ledgerfixtures       EXIT=0  (657ms)
ledgerseam           EXIT=0  (9612ms)
rfcpolicy            EXIT=0  (6669ms)
rfcruntime           EXIT=0  (207ms)
rfcwiring            EXIT=0  (3354ms)
rfcround3            EXIT=0  (3278ms)
rfcmode              EXIT=0  (78ms)
rfchistorical        EXIT=0  (136ms)
rfcconsistency       EXIT=0  (3422ms)
rfcworld             EXIT=0  (3416ms)
scholardrift         EXIT=0  (83ms)
shippedreality       EXIT=0  (3665ms)
pagematch            EXIT=0  (87ms)
takhrij              EXIT=0  (130803ms)
quotedphrase         EXIT=0  (154ms)
adaptedcorpus        EXIT=0  (5735ms)
deaddomains          EXIT=0  (140ms)
floorsfilters        EXIT=0  (149ms)
liveness             EXIT=0  (139ms)
aiconsent            EXIT=0  (15151ms)
srcattr              EXIT=0  (241ms)
referraltail         EXIT=0  (48ms)
namepresence         EXIT=0  (1802ms)
voicesafety          EXIT=0  (53901ms)
wird                 EXIT=0  (397ms)
worldparity          EXIT=0  (40ms)
rulingsource         EXIT=0  (281ms)
retrievalobs         EXIT=0  (87ms)
madinahafs           EXIT=0  (146ms)
i18nui               EXIT=0  (4780ms)
adhkartwins          EXIT=0  (41ms)
systemprompt         EXIT=0  (250ms)
lockpackage          EXIT=0  (1144ms)
sourcehonesty        EXIT=0  (983ms)
ledgertelemetry      EXIT=0  (986ms)
livesearch           EXIT=0  (13213ms)
answershape          EXIT=0  (128ms)
identity             EXIT=0  (446ms)
transfermode         EXIT=0  (4032ms)
anchormode           EXIT=0  (258ms)
searchbudgetp0       EXIT=0  (182ms)
fullfatwa            EXIT=0  (241ms)
retiredchat          EXIT=0  (86ms)
guardhonesty         EXIT=0  (1412ms)
promptconsistency    EXIT=0  (69ms)
truncatedtag         EXIT=0  (2240ms)
explicitfailure      EXIT=0  (304ms)
scholarseparation    EXIT=0  (166ms)
cardorcontext        EXIT=0  (2125ms)
reviewermatrix       EXIT=0  (388ms)
attributionoutput    EXIT=0  (170ms)
domaincontract       EXIT=0  (125ms)
noemptyanswer        EXIT=0  (2492ms)
ladderorder          EXIT=0  (113ms)
taghonesty           EXIT=0  (161ms)
standingnotice       EXIT=0  (1092ms)
telemetrytext        EXIT=0  (195ms)
vacuousassert        EXIT=0  (499ms)
bootinvariants       EXIT=0  (223ms)
lessonssearch        EXIT=0  (79ms)
fiqhindex            EXIT=0  (148ms)
lessonsbrowse        EXIT=0  (47ms)

=== SUITE: 92/93 EXIT=0 ===
recon:    SUMMARY   PASS=185   WARN=1   FAIL=0
tree after: 0 dirty path(s)
FAILING (1): questux=1
  questux  ->  C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T12-35-44-734Z-23540\gate-questux.log
evidence: C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-23T12-35-44-734Z-23540
```

Actual process exit: 1. The suite runner itself hard-codes `EXIT=0` in its displayed banner; `summary.json` records `passed: 92`, `failed: ["questux"]`, and the process exits nonzero for that failure.

### Gate command 2 — standalone recon, literal stdout

```text
$ node recon-audit.cjs
==================================================================
 Al-Murabbi  ::  recon-audit  (read-only, writes nothing)
 root: C:\Users\passe\projects\ustaz-cx-chatux
 time: 2026-08-23T12:47:20.208Z
==================================================================

=== 0) SOURCE ARRAY EXTRACTOR ===
  [PASS] array extraction balances nested arrays and ignores brackets in strings/comments
  [PASS] optional HEAD baseline distinguishes absent, match, and mismatch

=== 1) FILE INVENTORY ===
  [PASS] index.html  (117.8 KB, 1686 lines)
  [PASS] quest.html  (207.6 KB)
  [PASS] api/ask.js  (241.2 KB)
  [PASS] api/chat.js  (1.0 KB)
  [PASS] api/chat-fast.js  (1.1 KB)
  [PASS] api/tts.js  (7.0 KB)
  [PASS] api/tashkeel.js  (11.6 KB)
  [PASS] api/report.js  (4.7 KB)
  [PASS] lib/retrieve.js  (84.7 KB)
  [PASS] lib/encyclopedia.js  (5.4 KB)
  [PASS] lib/ratelimit.js  (20.3 KB)
  [PASS] lib/limit-message.js  (0.3 KB)
  [PASS] lib/data/adhkar.json  (173.2 KB)
  [PASS] quran-uthmani.json  (1378.9 KB)
  [PASS] quest-data/trivia-golden.json  (1584.9 KB)
  [PASS] quest-data/world.json  (9.9 KB)
  [PASS] quest-data/rewards.json  (8.1 KB)
  [PASS] lib/data/fiqh-search.json.gz  (5303.3 KB)
  [PASS] babel-gate.cjs  (4.8 KB)
  [PASS] runtime-gate.cjs  (7.7 KB)
  [PASS] worship-guard.cjs  (9.2 KB)
  [PASS] worship-golden.json  (30.7 KB)
  [PASS] referral-golden.json  (3.5 KB)
  [PASS] package.json  (1.1 KB)
  [PASS] .gitignore  (0.8 KB)
  [PASS] docs/khilaf-policy.md  (17.7 KB)
  [PASS] vercel.json  (0.8 KB)
  [PASS] package-lock.json  (34.8 KB)

=== 2) GIT INTEGRITY & TRACKING ===
  [INFO] HEAD = 4c68dd127ae4dfc97b317420facbd8b542836bcf
  [INFO] no expected HEAD supplied; baseline comparison skipped
  [PASS] working tree clean
  [PASS] tracked (ships to Vercel): quran-uthmani.json
  [PASS] tracked (ships to Vercel): lib/data/adhkar.json
  [PASS] tracked (ships to Vercel): lib/data/fiqh-search.json.gz
  [PASS] no temp/secret/build files are tracked

=== 3) .gitignore COVERAGE ===
  [PASS] ignored: .env
  [PASS] ignored: *.bak
  [PASS] ignored: apply-*.cjs
  [PASS] ignored: recon-*.cjs
  [PASS] ignored: fix-*.cjs
  [PASS] ignored: probe-*.mjs
  [PASS] ignored: probe-*.txt
  [PASS] ignored: payload-*.txt
  [PASS] ignored: *.cjs.txt
  [PASS] ignored: .vercel
  [PASS] ignored: node_modules

=== 4) SECRET LEAK SCAN (tracked files, values redacted) ===
  [PASS] reviewed non-secret fixture still matches exactly: guards/search-budget-p0-guard.cjs
  [PASS] no hardcoded secrets found in tracked files

=== 5) ENV VARS REFERENCED IN SERVER CODE ===
  [INFO] these MUST be set in Vercel (Project Settings > Environment Variables):
  [INFO]     ANTHROPIC_API_KEY
  [INFO]     ASK_GLOBAL_DAY
  [INFO]     BRAVE_API_KEY
  [INFO]     DEPTH_FREE_TRIAL
  [INFO]     ELEVENLABS_API_KEY
  [INFO]     KV_REST_API_TOKEN
  [INFO]     KV_REST_API_URL
  [INFO]     MODEL
  [INFO]     MODEL_PREMIUM
  [INFO]     MODEL_STANDARD
  [INFO]     TASHKEEL_MODEL

=== 6) DEPENDENCIES: declared vs used ===
  [INFO] package.json deps: @mozilla/readability, @upstash/ratelimit, @upstash/redis, linkedom, minisearch, @babel/core, @babel/parser, @babel/preset-react, react, react-dom
  [PASS] declared & used: @mozilla/readability
  [PASS] declared & used: @upstash/ratelimit
  [PASS] declared & used: @upstash/redis
  [PASS] declared & used: linkedom
  [INFO] node_modules present (needed locally for gates)

=== 7) CDN PIN INTEGRITY (index.html) ===
  [PASS] pinned: https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js
  [PASS] pinned: https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.11.0/mammoth.browser.min.js
  [PASS] no in-browser Babel: @babel/standalone is not loaded at all (item 32)
  [PASS] self-hosted and SRI-pinned: vendor/react
  [PASS] self-hosted and SRI-pinned: vendor/react-dom
  [PASS] the page loads the compiled bundle app.js
  [PASS] mammoth pinned to 1.11.0 (documented)
  [INFO] some SRI integrity= attributes present

=== 8) MARKERS & FROZEN-SURFACE PRESENCE (the shipped client) ===
  [INFO] PERSIST_CONVERSATION = true
  [INFO] SCHOLAR_ENABLED = true
  [INFO] CALL_STREAM_SPEECH = true
  [PASS] present: tts-num-words injection
  [PASS] present: deriveCaps
  [PASS] present: formatForTTS
  [PASS] present: parseRichMessage
  [PASS] present: createCallSpeechStream
  [PASS] present: playDhikrRecitation
  [PASS] present: tagPattern

=== 9) RAG SOURCE LISTS & GATES (lib/retrieve.js) ===
  [INFO] SITES_ADULT (19): islamweb.net, binbaz.org.sa, alukah.net, islamqa.info, sh-albarrak.com, almosleh.com, iifa-aifi.org, ferkous.app, dr-mutlaq.com, eftaa.awqaf.gov.kw, saleh.af.org.sa, khaledalsabt.com, ibn-jebreen.com, mostafaaladwy.com, almunajjid.com, khutabaa.com, salafcenter.org, tafsir.net, al-abbaad.com
  [PASS] SITES_ADULT count = 19 (measured 2026-08-14)
  [INFO] SITES_MINOR (7): islamqa.info, binbaz.org.sa, islamweb.net, alukah.net, iifa-aifi.org, ibn-jebreen.com, almosleh.com
  [PASS] SITES_MINOR count = 7 (measured 2026-08-14)
  [PASS] SITES_MINOR == the seven currently measured ready (khilaf policy unchanged)
  [PASS] present: isKhameesBlocked
  [PASS] present: isTafsirAppBookBlocked
  [PASS] present: retrieve
  [PASS] query assembly delegated to lib/brave-query.js (no local site: filter)
  [PASS] tafsir book-block slugs present: kashaf + alrazi
  [PASS] othmanalkhamees.com present (Khamis sect-gated source)
  [PASS] BRAVE_API_KEY referenced
  [PASS] shkhudheir.com is on no SITES_ list (parked domain, refused by the registry)

=== 10) DATA FILE VALIDITY ===
  [INFO] worship-golden.json valid JSON (object = 3 entries)
  [INFO] referral-golden.json valid JSON (object, .cases = 9 entries)
  [PASS] referral-golden.json entry count = 9
  [INFO] lib/data/adhkar.json valid JSON (object = 4 entries)
  [INFO] quran-uthmani.json valid JSON (object = 6236 entries)
  [INFO] quest-data/trivia-golden.json valid JSON (object = 5 entries)
  [INFO] quest-data/world.json valid JSON (object = 4 entries)
  [INFO] quest-data/rewards.json valid JSON (object = 11 entries)
  [PASS] fiqh-search.json.gz gunzips + parses (3045 records, uncompressed 20.0 MB)
  [PASS] fiqh record count ~3070 (matches)

=== 11) SERVERLESS HANDLER SANITY ===
  [PASS] api/ask.js: handler export present
  [INFO] api/ask.js reads client band/depth -> DEEP REVIEW: confirm the server does NOT trust these blindly (age-gate bypass risk)
  [PASS] api/chat.js: handler export present
  [PASS] api/chat-fast.js: handler export present
  [PASS] api/tts.js: handler export present
  [PASS] api/tashkeel.js: handler export present

=== 12) LINE ENDINGS & BOM ===
  [PASS] no mixed line endings in tracked text files
  [PASS] no UTF-8 BOM in checked files

=== 13) REPORT BODY CAP vs WORSHIP GOLDEN ===
  [WARN] LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)

=== 14) GATE ROSTER (single source: gates.json) ===
  [PASS] gates.json entry count = 93
  [PASS] gate ok (on disk, tracked, eol=lf pinned): worship-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quran-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): layout-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): babel-gate.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): runtime-gate.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): recon-audit.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): build-worship-display.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): referral-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): classifier-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): hafs-map-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): call-mode-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): chat-history-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): markdown-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quest-reveal-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quran-quest-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): prayer-quest-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quest-bank-integrity-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quest-content-review-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): theme-coverage-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): chat-ux-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): a11y-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): quest-ux-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): attribution-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): claim-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): source-registry-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): brave-query-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): smart-retrieval-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-contract-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-retrieval-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-gates-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-runtime-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-fixtures-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): ledger-seam-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-runtime-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-wiring-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-round3-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-mode-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-historical-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-consistency-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/rfc-v05r2-entity-world-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/scholar-registry-drift-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/shipped-reality-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/page-match-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/takhrij-lock-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/quoted-phrase-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/adapted-corpus-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/dead-domains-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/floors-and-filters-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/source-liveness-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): tools/ai-consent-probe.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/source-attribution-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/referral-tail-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/name-presence-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/voice-safety-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): tools/wird-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/world-parity-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/ruling-source-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/retrieval-observability-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): tools/madina-hafs-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/i18n-ui-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/adhkar-twins-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/system-prompt-parity-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/lock-package-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/source-honesty-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/ledger-telemetry-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/live-search-disclosure-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/answer-shape-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/identity-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/transfer-mode-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/anchor-mode-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/search-budget-p0-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/full-fatwa-contract-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/retired-chat-endpoints-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/guard-honesty-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/prompt-consistency-par-a-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/truncated-tag-fallback-par-a-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/explicit-failure-par-a-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/scholar-separation-par-a-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/card-or-no-context-par-a-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/output-reviewer-matrix-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/attribution-on-output-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/domain-contract-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/no-empty-answer-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/ladder-order-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/tag-honesty-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/standing-notice-band-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/telemetry-text-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/vacuous-assertion-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/boot-invariants-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/lessons-search-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/fiqh-index-guard.cjs
  [PASS] gate ok (on disk, tracked, eol=lf pinned): guards/lessons-browse-guard.cjs
  [PASS] every root .cjs is classified (gate or non-gate)

=== 15) CLIENT/SERVER BODY-CAP MIRROR ===
  [PASS] body-cap mirror intact: client SERVER_MAX_CHAT_BODY_BYTES == server MAX_CHAT_BODY_BYTES == 2097152 bytes

=== 15B) COMMIT IDS QUOTED IN DOCUMENTATION ===
  [PASS] every commit id quoted in documentation still resolves (3 ids)

=== 16) CURRENT IMPLEMENTATION-REPORT FACTS ===
  [PASS] implementation report matches gates.json, wird registration, and this recon summary

==================================================================
 SUMMARY   PASS=185   WARN=1   FAIL=0
 No structural FAILs. WARNs are eyeball items, not necessarily bugs.
==================================================================
```

Actual process exit: 0.

### Gate command 3 — worktree status, literal captured streams

```text
$ git status --porcelain
--- stdout ---

--- stderr ---
warning: unable to access 'C:\Users\passe/.config/git/ignore': Permission denied
warning: unable to access 'C:\Users\passe/.config/git/ignore': Permission denied
```

Actual process exit: 0; stdout contained zero lines. Environment-only global-ignore permission warnings seen on some invocations were stderr and were not dirty paths.

### `bankintegrity` — complete canonical gate log

```text
$ node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
cwd:  C:\Users\passe\projects\ustaz-cx-chatux
exit: 0
ms:   318

--- stdout ---

-- B1 count --
  PASS question count = 2179

-- B2 identity --
  PASS id list unchanged, in order

-- B3 categories --
  PASS every question is still in its own category
  PASS category histogram unchanged (27 categories)

-- B4 schema / B6 answer validity --
  PASS all 1785 non-protected questions are schema-clean

-- B5 duplicates --
  PASS no duplicate question in the 1785 (1 documented parallel pair allowed)

-- B7 the stem stands on its own --
  PASS every stem is answerable with the choices hidden (4 documented exceptions)

-- B8 sources --
  PASS all 1785 non-protected sources name a work AND a place inside it

-- B9 protected questions (the load-bearing check) --
  PASS protected question count = 394
  PASS all 394 protected questions are byte-for-byte unchanged

-- B10 sealed files (unconditional: no git, no skip) --
  sealed files hashed: 13/13
  PASS all 13 sealed files are byte-for-byte unchanged

-- B11 service worker: data files must revalidate (item 80) --
  PASS service worker opens cache "ezik-v21"
  PASS all 3 revalidating data files are served from cache AND revalidated in the background
  PASS all 3 revalidating data files serve the NEW bytes on the read after a change
  PASS all 3 revalidating data files survive a dead network with the stored copy intact
  PASS both sealed mushaf files are served from cache with ZERO revalidation fetch (item 90)
  PASS a failed precache entry does not reject install (item 93)
  PASS a failed precache entry raises the counter and records its name (item 93)
  PASS a precache with every entry storing records no failure (item 93 control)
  PASS the four policies item 80 does not govern are untouched (asset / api / quest-data / shell)

-- B12 service worker: storage quota management (item 91-A) --
  PASS a wide quota stores all 10 CORE entries (91-A costs the sane case nothing)
  PASS the worker estimates the quota before it writes (1 call(s))
  PASS the worker asks for persistence exactly once and records the grant
  PASS the estimate is recorded with the need it was measured against (2703130 bytes)
  PASS a quota too narrow for CORE still settles install (the worker activates)
  PASS a quota too narrow for CORE writes NOTHING (no cache.add is attempted)
  PASS the skip is recorded as a quota decision, readable by the page
  PASS the refusal carries its arithmetic: 65536 free < 2703130 needed
  PASS a skipped precache records no per-file failures (one decision, not seven)
  PASS a disk that fills mid-write still settles install
  PASS the eviction never touches the current store "ezik-v21"
  PASS a full disk evicts the stale store "ezik-v6" first
  PASS the entry is retried after the eviction (10 retry/retries)
  PASS after the eviction the retry stores all 10 CORE entries
  PASS an entry whose retry also fails is recorded once, named, and reasoned "quota"
  PASS a network failure evicts nothing (the eviction rule answers a full disk only)
  PASS a failed fetch is recorded with reason "network"
  PASS a browser with no navigator.storage still settles install
  PASS with no navigator.storage all 10 CORE entries are still stored
  PASS the absent API is recorded as "unavailable", not as a failure
  PASS a quota-skipped install is retried once activate has swept the old store
  PASS the post-activate retry is recorded on the same channel
  PASS SW_CORE is still the list sw.js precaches (10 entries, read from the worker)
  PASS CORE maps onto the files SW_CORE_FILES names ('/' -> index.html, the rest by path)
  PASS CORE_BYTES (1802087) equals the 1802087 bytes CORE weighs on disk, exactly
  PASS every size sw.js states in prose is true of the disk (17 claims)
  PASS no unregistered number of 500 or more survives in sw.js prose (4 declared uncheckable, each with its reason)

-- B13 service worker: the end-of-install report (item 93-b) --
  PASS a clean install hands every client a report saying nothing failed
  PASS ...and it carries what install DECIDED, not only what it counted
  PASS the number of clients told is recorded on the storage channel
  PASS the lookup includes uncontrolled clients (the first install has no controlled page)
  PASS a single failed entry reaches the page named and reasoned ("/adhkar.json", network)
  PASS every failed entry travels, not just the first (3 of 3 named)
  PASS ...and the report matches what the store actually holds
  PASS an install with no client at all still settles (the worker activates)
  PASS ...and all 10 CORE entries are still stored
  PASS ...and "nobody listening" is not recorded as a failure
  PASS an empty audience is recorded as 0, distinctly from "unavailable"
  PASS a browser with no clients.matchAll still settles install
  PASS ...and stores all 10 CORE entries
  PASS the absent channel is recorded as "unavailable", not as a failure
  PASS a client that throws on postMessage costs only itself the report
  PASS ...and the record counts deliveries, not attempts (2 of 3)
  PASS a quota-skipped install still reports, and reports the skip rather than seven failures

-- B15 service worker: the printed mushaf pages are capped (item 33) --
  PASS a printed page is stored in "ezik-mushaf-pages-v1", not in the shipment store
  PASS ...and a stored page is served from it with ZERO revalidation fetches
  PASS page 61 evicts page 1: the store holds 60 pages, least-recently-used first out
  PASS ...and the eviction is counted on the item 93 channel, with zero failures
  PASS a version bump sweeps the superseded store and LEAVES "ezik-mushaf-pages-v1" intact
  PASS a nearly-full disk still serves the page, stores nothing, raises nothing, and says so
  PASS a rejected page write is counted and named on the item 93 channel, and costs no reader

-- B16 offline package: the policy the page is answered with (A-4) --
  PASS the worker publishes its page ceiling (60) to the page
  PASS ...and the free-space floor it declines below (52428800 bytes)
  PASS the ceiling (60 pages) holds the LARGEST juz (30, 23 pages) whole
  PASS the per-page estimate (323956) is at least the largest of the 604 shipped pages (323956), so it cannot under-estimate a juz
  PASS the page store still carries its own unversioned name (ezik-mushaf-pages-v1)

PASS  76 checks passed, 0 failed.

--- stderr ---
[ezik sw] precache FAILED for /adhkar.json (quota): QuotaExceededError: quota exceeded (synthetic) (1 failed so far)
[ezik sw] install finished with 1 precache failure(s): /adhkar.json (quota)
[ezik sw] precache SKIPPED: needs 2703130 bytes, 65536 free
[ezik sw] precache FAILED for /adhkar.json (quota): QuotaExceededError: quota exceeded (synthetic) (1 failed so far)
[ezik sw] install finished with 1 precache failure(s): /adhkar.json (quota)
[ezik sw] precache FAILED for /adhkar.json (network): Failed to fetch (synthetic) (1 failed so far)
[ezik sw] install finished with 1 precache failure(s): /adhkar.json (network)
[ezik sw] precache SKIPPED: needs 2703130 bytes, 65536 free
[ezik sw] precache FAILED for /adhkar.json (network): Failed to fetch (synthetic) (1 failed so far)
[ezik sw] install finished with 1 precache failure(s): /adhkar.json (network)
[ezik sw] precache FAILED for /manifest.json (network): Failed to fetch (synthetic) (1 failed so far)
[ezik sw] precache FAILED for /icon-watermark.png (network): Failed to fetch (synthetic) (2 failed so far)
[ezik sw] precache FAILED for /adhkar.json (network): Failed to fetch (synthetic) (3 failed so far)
[ezik sw] install finished with 3 precache failure(s): /manifest.json (network), /icon-watermark.png (network), /adhkar.json (network)
[ezik sw] precache SKIPPED: needs 2703130 bytes, 65536 free
[ezik sw] mushaf page store FAILED for /assets/madina-hafs/page-009.webp (quota): QuotaExceededError: quota exceeded (synthetic)
```

### `lessonsbrowse` — complete canonical gate log

```text
$ node guards/lessons-browse-guard.cjs
cwd:  C:\Users\passe\projects\ustaz-cx-chatux
exit: 0
ms:   47

--- stdout ---
=== lessons-browse-guard -- offline contract proof ===

=== A. SOURCE CONTRACT ===
  PASS  the API source and reference source were both read
  PASS  exactly the three contracted levels are declared
  PASS  the scholars row whitelist is exact by set equality
  PASS  the series row whitelist is exact by set equality
  PASS  the lessons row whitelist is exact by set equality
  PASS  the scholars response whitelist is exact by set equality
  PASS  the series response whitelist is exact by set equality
  PASS  the lessons response whitelist is exact by set equality
  PASS  no forbidden text field occurs in any row whitelist
  PASS  the shaping region has both source anchors
  PASS  shaping uses no Object.keys, Object.entries, or Object.values
  PASS  shaping uses no object or array spread
  PASS  scholars fields are carried by explicit names
  PASS  series fields are carried by explicit names
  PASS  lesson fields are carried by explicit names
  PASS  the browse and search functions read the same environment-name set
  PASS  that shared set contains SEARCH_API_TOKEN and no second name
  PASS  both functions keep the measured local URL binding name SEARCH_URL
  PASS  the browse destination is the lessons service browse route
  PASS  the timeout is the measured 12000ms
  PASS  405 is attached to the non-POST branch
  PASS  400 is attached to the exact-level rejection
  PASS  503 is attached to the missing-token branch
  PASS  502 appears on upstream failure paths
  PASS  the source contains the expected coded log calls
  PASS  every log call carries a fixed reason code
  PASS  no log call reads an exception message or exception binding
  PASS  catch blocks bind no exception object that could be logged

=== B. OFFLINE FIXTURE SHAPING ===
  PASS  the fixture has an unmistakable forbidden marker
  PASS  the fixture carries no Arabic lesson text
  PASS  scholars output has exactly its top-level and row whitelists
  PASS  scholars output contains no forbidden marker
  PASS  scholars output has none of the named text fields
  PASS  scholars output drops unmeasured top-level fields
  PASS  series output has exactly its top-level and row whitelists
  PASS  series output contains no forbidden marker
  PASS  series output has none of the named text fields
  PASS  series output drops unmeasured top-level fields
  PASS  lessons output has exactly its top-level and row whitelists
  PASS  lessons output contains no forbidden marker
  PASS  lessons output has none of the named text fields
  PASS  lessons output drops unmeasured top-level fields
  PASS  the empty series bucket survives shaping as an empty value
  PASS  scholars do not acquire page or pages
  PASS  series pagination is carried without derivation
  PASS  lessons pagination is carried without derivation
  PASS  an unknown shaping level returns no contract at all

=== C. REQUESTS AND WIRE SHAPE ===
  PASS  all three levels return 200 through exactly one outbound call
  PASS  all three calls use POST /lessons/browse
  PASS  all three calls use the same Bearer SEARCH_API_TOKEN value
  PASS  all three calls ask for and accept JSON
  PASS  scholars sends exactly level and ignores page
  PASS  series sends exactly level, scholar_id, and normalized page
  PASS  lessons sends exactly level, scholar_id, series, and normalized page
  PASS  invalid page values normalize to 1
  PASS  positive integer page values survive, including numeric strings
  PASS  successful output is the same pure fixture shape proved above
  PASS  successful output carries a private no-store cache header

=== D. FIXED FAILURE CLASSES ===
  PASS  non-POST is 405 and never calls upstream
  PASS  the fourth level is 400 and never calls upstream
  PASS  bad JSON is 400 and never calls upstream
  PASS  missing scholar_id is 400 and never calls upstream
  PASS  missing series is 400 but empty series was accepted above
  PASS  missing token is 503 and never calls upstream
  PASS  all upstream failure classes are 502
  PASS  a rejected token earns one call and no unauthenticated retry
  PASS  the 405 body is one fixed public shape
  PASS  every 400 body is byte-for-byte the same fixed body
  PASS  the 503 body is one fixed public shape
  PASS  every 502 body is byte-for-byte the same fixed body
  PASS  the token reaches no response, response header, or log line
  PASS  the thrown exception text reaches no response or log line
  PASS  failure responses expose neither the environment name nor upstream host
  PASS  the missing-token log is a code, not an exception message
  PASS  every upstream log contains a fixed reason code and no planted exception text

=== E. MUTATION PROOF ===
  PASS  M1 snippet pass-through is a real source mutation
  PASS  M1 snippet pass-through is killed by the contract assertion
  PASS  M2 fourth accepted level is a real source mutation
  PASS  M2 fourth accepted level is killed by the contract assertion
  PASS  at least two mutants were created and every one was killed
  PASS  the API file on disk is unchanged after in-memory mutation

MUTANTS_KILLED=2/2
ASSERTIONS=81/81
=== PASS ===

--- stderr ---
```

## Commits and HEAD

| Short hash | Purpose |
|---|---|
| `5d026c0` | Record proxy measurements |
| `ed12562` | Add lessons browse proxy, fixture, guard, and roster entry |
| `b82a61b` | Record the initially blocked gate run |
| `4c68dd1` | Apply B2 roster, telemetry, and authorized EOL-pin corrections |

HEAD while all canonical evidence and this report payload were measured: `4c68dd127ae4dfc97b317420facbd8b542836bcf`.

The report commit cannot contain its own commit hash without changing that hash. Its final hash is therefore printed in the execution handoff after the report-only commit.

## ما لم أقسه

- The real-browser `questux` round was not measured: Chrome reset the DevTools connection at `Page.enable` on all three standalone attempts and again inside the canonical suite. Seven pre-browser assertions passed and none failed; per Section 4, no fix was attempted.
- A 93/93 canonical suite was not measured. The measured result is 92/93 solely because of that assertion-free browser crash; the actual suite process exit is 1.
- No live deployment or production `/api/lessons-browse` request was exercised. The proxy contract, wire shape, failure classes, log secrecy, fixture shaping, and two mutants were measured offline by 81/81 guard assertions.
- No upstream token validity, upstream availability, production environment-variable configuration, or Vercel routing was measured.
- The known recon warning about `LONGEST_CARD_CHARS = 3405` versus longest card 3401 was not changed because it is outside this order.
- Gates are not rerun after the report-only commit; the report contains evidence gathered on the clean code commit it documents.
- No push and no merge were performed.

## Seal definition

The report payload is every UTF-8 byte from byte 0 through the final LF immediately before the `--- REPORT SEAL ---` marker. The marker and seal fields are excluded. The values below are calculated only after this payload is complete.
--- REPORT SEAL ---

REPORT_PAYLOAD_BYTES=48826
REPORT_SHA8=d7f096af
