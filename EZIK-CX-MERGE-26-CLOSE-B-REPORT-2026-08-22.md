# تقريرُ إغلاقِ جولةِ الدمجِ ٢٦ · النصفُ الثالث — ٢٠٢٦-٠٨-٢٢

**الوجهة:** `main` في `C:\Users\passe\projects\ustaz`  
**رأسُ القياس:** `6461ca3bc4605fa359f583e25f5790253a5fd787`  
**الدفع:** `PUSHES=0`  

هذا تقريرُ أرقامٍ ونصوصِ بوّاباتٍ بلا حكم.

---

## ١ · بوّاباتُ ما قبلَ العمل

| المفتاح | المقيس | الشرط | الحصيلة |
|---|---|---|---|
| `ORDER_MOVED` | `True` إلى `C:\EZIK-STAGE\orders\ORDER-MERGE-26-CLOSE-B.md` | `True` | مطابق |
| `CURRENT_BRANCH` | `main` | `main` | مطابق |
| `HEAD` | `b8e4dad96f7cde0fab9c5d2e24e462e387274b2d` | يُطبع كاملًا | مقيس |
| `B8E4DAD_IS_ANCESTOR_EXIT` | `0` | `0` | مطابق |
| `ORIGIN_MAIN` | `4c9531cb4687ed9f576fe047aa21b130f692b3ff` | القيمةُ المعيّنة | مطابق |
| `GUARD_947738_COUNT` | `1` | `1` | مطابق |
| `GUARD_947721_COUNT` | `0` | `0` | مطابق |
| `GUARD_PATCH_PRESENT` | `True` | `True` | مطابق |
| `DIRTY_PATHS` | `quest-bank-integrity-guard.cjs` وحدَه | الحارسُ وحدَه | مطابق |

لم يُعَد الدمج، ولم تُعَد الرقعة، ولم يُلمس `sw.js` ولا `app.jsx` ولا `app.js` ولا
`index.html`.

---

## ٢ · استدعاءُ الحارس من العدّة

قرأت العدّةُ تسجيل `bankintegrity` من `gates.json`، وينفّذ `tools/run-gates.cjs` المسجّلَ
بالبنية الآتية:

```text
95:  const r = cp.spawnSync(process.execPath, [script, ...args], {
```

والاستدعاءُ الناتج حرفًا:

```text
GUARD_ARGV_FROM_SUITE=node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
```

شاشةُ استعمال الحارس كما طُبعت:

```text
usage: node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json
       node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
GUARD_USAGE_EXIT=2
```

لم يُستعمل `--emit`. وملفُ الختم المقارن به قيس هكذا:

```text
GOLDEN_EXISTS=True
GOLDEN_BYTES=152444
GOLDEN_SHA256=04877fb4faa2f21786a1b65f2be4f879bcccfd7af0f3621b4abefb31afef46ec
```

---

## ٣ · مخرجُ الحارس بالاستدعاء الصحيح

الأمر:

```text
node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
```

المخرج:

```text
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
  PASS service worker opens cache "ezik-v17"
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
  PASS the estimate is recorded with the need it was measured against (2671704 bytes)
  PASS a quota too narrow for CORE still settles install (the worker activates)
  PASS a quota too narrow for CORE writes NOTHING (no cache.add is attempted)
  PASS the skip is recorded as a quota decision, readable by the page
  PASS the refusal carries its arithmetic: 65536 free < 2671704 needed
  PASS a skipped precache records no per-file failures (one decision, not seven)
  PASS a disk that fills mid-write still settles install
  PASS the eviction never touches the current store "ezik-v17"
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
  PASS CORE_BYTES (1781136) equals the 1781136 bytes CORE weighs on disk, exactly
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
BANKINTEGRITY_EXIT=0
```

رسائلُ الحالات الاصطناعية التي أصدرها العامل في الجريان كانت عن `quota` و`network` كما
تطلب فحوص B11–B15؛ لم تغيّر حصيلة `76/0`.

---

## ٤ · إيداعُ الحارس

أُضيف `quest-bank-integrity-guard.cjs` بالاسم وحدَه، وكان الملفُّ المرحّل الوحيد.

```text
COMMIT_SHA=6461ca3bc4605fa359f583e25f5790253a5fd787
DIRTY_LINES=0
```

ونتيجةُ `git --no-pager show --stat`:

```text
commit 6461ca3bc4605fa359f583e25f5790253a5fd787
    fix: refresh service worker prose registry

 quest-bank-integrity-guard.cjs | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

---

## ٥ · جرياناتُ `questux` الخمسة

شُغّلت الجرياناتُ الخمسة على الرأس نفسه، عاريةً كما عيّن الأمر:

| الجريان | `EXIT` | `CHECKS_RUN` | `ASSERTIONS_FAILED` | `CRASHED` | `CRASH_TEXT_FIRST_LINE` |
|---|---:|---:|---:|---|---|
| `RUN_1` | `0` | `61` | `0` | `False` | `NONE` |
| `RUN_2` | `0` | `61` | `0` | `False` | `NONE` |
| `RUN_3` | `0` | `61` | `0` | `False` | `NONE` |
| `RUN_4` | `0` | `61` | `0` | `False` | `NONE` |
| `RUN_5` | `0` | `61` | `0` | `False` | `NONE` |

```text
QUESTUX_RUNS=5
QUESTUX_CLEAN_PASSES=5
QUESTUX_CRASHES=0
QUESTUX_ASSERTION_FAILURES_TOTAL=0
```

---

## ٦ · السلسلةُ الكاملة

شُغّل `node tools/run-gates.cjs` على شجرةٍ نظيفة عند الرأس
`6461ca3bc4605fa359f583e25f5790253a5fd787`، وبقي الرأس والشجرة كما هما بعد الجريان:

```text
SUITE=90/90
RUN_GATES_EXIT=0
RECON=PASS=182 WARN=1 FAIL=0
HEAD_BEFORE=6461ca3bc4605fa359f583e25f5790253a5fd787
HEAD_AFTER=6461ca3bc4605fa359f583e25f5790253a5fd787
DIRTY_BEFORE=0
DIRTY_AFTER=0
TREE_DIRTIED_BY_RUN=False
```

الأرضياتُ والحارسان المقيسان من سجلات الجريان نفسه:

| البوابة | المقيس |
|---|---:|
| `themecoverage` | `1341/1341` |
| `wird` | `1122/0` |
| `i18nui` | `277/277` |
| `bankintegrity` | `76/0` |
| `questux` | `61/61` |

وجدولُ الخروج الكامل للبوابات التسعين:

| البوابة | `EXIT` |
|---|---:|
| `worship` | `0` |
| `quran` | `0` |
| `layout` | `0` |
| `babel` | `0` |
| `runtime` | `0` |
| `recon` | `0` |
| `display` | `0` |
| `referral` | `0` |
| `classifier` | `0` |
| `hafs` | `0` |
| `call` | `0` |
| `history` | `0` |
| `markdown` | `0` |
| `reveal` | `0` |
| `quranquest` | `0` |
| `prayerquest` | `0` |
| `bankintegrity` | `0` |
| `contentreview` | `0` |
| `themecoverage` | `0` |
| `chatux` | `0` |
| `a11y` | `0` |
| `questux` | `0` |
| `attribution` | `0` |
| `claim` | `0` |
| `sourceregistry` | `0` |
| `bravequery` | `0` |
| `smartretrieval` | `0` |
| `ledgercontract` | `0` |
| `ledgerretrieval` | `0` |
| `ledgergates` | `0` |
| `ledgerruntime` | `0` |
| `ledgerfixtures` | `0` |
| `ledgerseam` | `0` |
| `rfcpolicy` | `0` |
| `rfcruntime` | `0` |
| `rfcwiring` | `0` |
| `rfcround3` | `0` |
| `rfcmode` | `0` |
| `rfchistorical` | `0` |
| `rfcconsistency` | `0` |
| `rfcworld` | `0` |
| `scholardrift` | `0` |
| `shippedreality` | `0` |
| `pagematch` | `0` |
| `takhrij` | `0` |
| `quotedphrase` | `0` |
| `adaptedcorpus` | `0` |
| `deaddomains` | `0` |
| `floorsfilters` | `0` |
| `liveness` | `0` |
| `aiconsent` | `0` |
| `srcattr` | `0` |
| `referraltail` | `0` |
| `namepresence` | `0` |
| `voicesafety` | `0` |
| `wird` | `0` |
| `worldparity` | `0` |
| `rulingsource` | `0` |
| `retrievalobs` | `0` |
| `madinahafs` | `0` |
| `i18nui` | `0` |
| `adhkartwins` | `0` |
| `systemprompt` | `0` |
| `lockpackage` | `0` |
| `sourcehonesty` | `0` |
| `ledgertelemetry` | `0` |
| `livesearch` | `0` |
| `answershape` | `0` |
| `identity` | `0` |
| `transfermode` | `0` |
| `anchormode` | `0` |
| `searchbudgetp0` | `0` |
| `fullfatwa` | `0` |
| `retiredchat` | `0` |
| `guardhonesty` | `0` |
| `promptconsistency` | `0` |
| `truncatedtag` | `0` |
| `explicitfailure` | `0` |
| `scholarseparation` | `0` |
| `cardorcontext` | `0` |
| `reviewermatrix` | `0` |
| `attributionoutput` | `0` |
| `domaincontract` | `0` |
| `noemptyanswer` | `0` |
| `ladderorder` | `0` |
| `taghonesty` | `0` |
| `standingnotice` | `0` |
| `telemetrytext` | `0` |
| `vacuousassert` | `0` |
| `bootinvariants` | `0` |

موضعُ دليل الجريان:
`C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-08-22T07-35-03-228Z-12236`.

---

## ٧ · ما لم يُقَسْ بعلّتِه

1. لم يُقَس زمنٌ ولم يُستدلَّ بزمن؛ أرقامُ الزمن التي تطبعها عدّة البوابات آليًّا لم تدخل
   في شرطٍ أو نتيجةٍ هنا.
2. لم يُقَس نزولٌ حيٌّ أو نشرٌ؛ لم يقع دفع.
3. لم يُقَس انهيارُ وصلٍ في `questux` في هذه الجولة؛ الجرياناتُ الخمسة وجريانُ السلسلة كانت
   نظيفة، ولذلك كانت `CRASH_TEXT_FIRST_LINE=NONE` في الخمسة.

---

## ٨ · الخلاصةُ بالمفاتيح

```text
FINAL_HEAD=6461ca3bc4605fa359f583e25f5790253a5fd787
SUITE=90/90
BANKINTEGRITY_FAIL=0
QUESTUX_CLEAN_PASSES=5
PUSHES=0
PUSH_READY=YES
```

`FINAL_HEAD` أعلاه هو رأسُ الشفرة الذي قيسَت عليه الجرياناتُ والسلسلة. يُودع هذا التقريرُ
وحدَه فوق ذلك الرأس.

---
PAYLOAD_BYTES=14203 SHA256=71818ccac22d348c007e9f833c7665896c682b1382f7e76cf6523ee46c509387
