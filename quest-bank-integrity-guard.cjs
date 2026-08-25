/* quest-bank-integrity-guard.cjs -- STRUCTURAL GATE for quest-data/trivia-golden.json.
 *
 * WHY THIS GATE EXISTS
 *   Phase 4 swept the 1785 non-protected questions for structural rot: true/false
 *   statements stored as two-option mcq, stems that only parse while a list of
 *   options is on screen, stems whose text contains their own answer, duplicate
 *   questions, questions whose stem had been overwritten by an ingestion bug,
 *   sources that were category labels or "to be reviewed" markers, and keys that
 *   were twice as long as every distractor (which hands the answer to the player
 *   in mcq mode). This gate freezes that work and, above all, proves that the 394
 *   PROTECTED questions -- quran / juz-amma / juz-tabarak / prayer -- are still
 *   byte-for-byte what they were at commit 17bb52a.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs,
 * esc.cjs and quest-reveal-guard.cjs. Every Arabic character is a \uXXXX escape and
 * any Arabic echoed to the terminal is printed as codepoints. A guard that prints raw
 * Arabic to a Windows console LIES about what it found: bidi reorders the line, so the
 * eye reads a different string than the one that failed.
 *
 * WHAT IT PROVES
 *   B1 count        -- the bank still holds exactly `total` questions.
 *   B2 identity     -- the id list is unchanged, in order, with no additions or drops.
 *   B3 categories   -- every question sits in the category it sat in, and the per
 *                      category histogram is unchanged.
 *   B4 schema       -- per type: required fields present, answer in range and of the
 *                      right JS type, mcq has >= 3 choices, no empty or duplicate
 *                      choice, `why` and `src` non-empty.
 *   B5 no duplicate -- no two non-protected questions share a normalised stem, and no
 *                      two in the same category share an answer key with overlapping
 *                      stems (beyond a documented allow-list).
 *   B6 answer valid -- exactly one key, and the key is a non-empty option.
 *   B7 option-free  -- the stem carries an interrogative / imperative / completion
 *                      marker, contains no deictic pointer at an unseen list, and does
 *                      not contain its own answer as a whole phrase.
 *   B8 sources      -- `src` is present, is not a "to be reviewed" or hearsay marker,
 *                      is not a bare hostname, and points INSIDE the work it names:
 *                      a hadith number, an aya, the year of the events, a kitab/bab
 *                      or tarjama after a dash, or a quoted entry title. Naming
 *                      "al-Kamil fi al-Tarikh" (11 volumes) proves nothing on its own.
 *   B9 protected    -- sha256 of each of the 394 protected questions equals the hash
 *                      recorded from commit 17bb52a. This is the load-bearing check.
 *   B10 sealed 13   -- sha256 of the eight quest-data files, the three scripture /
 *                      adhkar / layout files, the manifest and the service worker.
 *                      Unconditional: no git, no branch, no skip.
 *   B11 sw policy   -- sw.js is EXECUTED in a vm with self/caches/fetch stubbed, and
 *                      a synthetic FetchEvent is dispatched at it. Every same-origin
 *                      data file must be served from the cache AND revalidated in the
 *                      background; the read after a change must return the new bytes;
 *                      a failed fetch must leave the stored copy intact and raise
 *                      nothing at the page. B10 proves sw.js has not MOVED; B11 proves
 *                      it still WORKS, which is the half item 80 was lost in.
 *   B12 sw quota    -- the same worker, executed again under FOUR measured storage
 *                      states: a wide quota, a quota too narrow to start, a disk that
 *                      fills mid-write, and a browser with no navigator.storage at all.
 *                      Asserted on what the worker DOES -- what it wrote, what it
 *                      deleted, what it recorded -- never on its text. Item 91-A.
 *                      It also re-derives CORE_BYTES from the CORE list sw.js itself
 *                      declares and refuses ANY deviation, in either direction, so the
 *                      quota pre-check cannot go on measuring against a number the files
 *                      outgrew or shrank away from. Item 112.
 *   B13 sw report   -- the same worker again, asked what it SENT at the end of install:
 *                      a clean install, one entry down, several entries down, and NOBODY
 *                      LISTENING -- plus a browser with no clients.matchAll, a client that
 *                      throws, and the quota skip. Item 93-b.
 *
 * USAGE
 *   node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json
 *   node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const BANK = 'quest-data/trivia-golden.json';
const PROTECTED_CATS = ['quran', 'juz-amma', 'juz-tabarak', 'prayer'];

// ---------------------------------------------------------------------------
// THE SEALED THIRTEEN. Every file here carries scripture, adhkar, the mushaf
// layout, the question bank, or the two files that decide what a phone installs
// and caches. None of them may move without the seal being re-cut deliberately.
//
// This list used to live in chat-ux-guard.cjs, inside the ELSE arm of a
// `git diff --name-only HEAD` probe. When git was absent -- a fresh export, a
// container, any CI image without .git -- the probe threw, the guard reported
// one honest failure about the blast radius, and the seal below it NEVER RAN.
// A reader saw a single red line about git and read it as harmless plumbing;
// the thirteen went unchecked. The most valuable guarantee in the repository
// cannot be a passenger on a `git` lookup, and it does not belong inside a
// user-experience guard at all. It runs here, unconditionally, and a mismatch
// prints the file, the expected digest and the actual one.
// ---------------------------------------------------------------------------
const SEALED = {
  'quest-data/trivia-golden.json': '4066160153f7648e7eeb145edae0ed43a2d24048d549ce076b37a6e144a425a9',
  'quest-data/reveal-golden.json': 'b3a89a4997b9b9ab6c91bd26a020e2e85a8d697ffec19bbd29937885d3819743',
  'quest-data/quran-quest-golden.json': 'd657ce9fcad754afd75ab96dbb3a8670d056cb3f103c37b689a4d51f31d9fefc',
  'quest-data/prayer-quest-golden.json': 'fdff7d29711735f0ce72e62c025a7596b9c2d3c6d0f254e9f198854d812b5807',
  'quest-data/bank-integrity-golden.json': '04877fb4faa2f21786a1b65f2be4f879bcccfd7af0f3621b4abefb31afef46ec',
  'quest-data/content-review-manifest.json': 'ae79702252e711f11804e2c0cf36166d085649035b032106fe3e8658c08ced85',
  'quest-data/rewards.json': '536caf3d048ca3e11361135b635a6284916ba286c4139ac5b8f8f176e6e84ba3',
  'quest-data/world.json': '6da5033bef577784238e7ab98d356dc8cf345958215d3232bad221922feb751b',
  'quran-uthmani.json': 'd4fd1a1507f70a4261789eaec8380750cd0f65f4d641f6df2ef6334b18c6877b',
  'adhkar.json': '19ef96b9ecc275376d46a667a86297261ea5991749ffe46dd35448196cb4c9c3',
  'mushaf-layout.json': 'ea9223ef7f18b5d933ce1c87cbebabc5d78f1ec0e8ac9714260f9dee6d571351',
  // D09: these two are sealed on LF BYTES. They were sealed on this machine's CRLF
  // working copy (manifest 549 b / sw 5044 b) while git stored LF (533 b / 4944 b), so
  // the seal held here and broke in every fresh clone and every CI run on Linux. Both
  // now carry `text eol=lf` in .gitattributes, so what is checked out is what is sealed.
  // Re-cut these only from a tree measured at CR = 0.
  'manifest.json': 'b542ce84b30e12d3cc517ee51ba628ac6a669714792063d8d606678305730434',
  // Re-cut history for this one file, newest first. Measured on this tree at CR = 0
  // every time, as the note above requires.
  //   2026-08-25   -- the store lift for the delete-page truth round. CACHE ezik-v31 ->
  //                    ezik-v32. MEASURED FIRST, because the bump is only justified if a
  //                    returning reader is actually being served the old bytes, and the file
  //                    that forces it IS in CORE: app.js, which the commit below rebuilt
  //                    1081237 -> 1082779 when resetAll gained the four erasures delete.html
  //                    had already promised. sw.js was driven in a vm with a stub CacheStorage
  //                    recording every match, put, add and delete, and a fetch that COUNTS its
  //                    calls: install add()s 10 CORE entries into the store and '/app.js' is
  //                    one of them, and a GET of it on a WORKING network is then answered out
  //                    of the store with ZERO network calls -- same-origin static assets match
  //                    no earlier branch and land in the generic cache-first arm (sw.js:741),
  //                    which returns the hit and never revalidates. So a returning reader keeps
  //                    the OLD bundle -- and with it the OLD resetAll, the one that did not keep
  //                    the page's promise -- for as long as the store keeps its name, not merely
  //                    while offline. With CACHE lifted, activate's sweep (sw.js:434) deletes
  //                    exactly ezik-v31 and spares ezik-mushaf-pages-v1, and install repopulates
  //                    with the new bundle. THE CONTROL WAS RUN TOO: without the lift, activate
  //                    deletes nothing and the old bundle is still served on a live network.
  //                    The bump is the thing that drops it. NOTHING ELSE MOVED -- CORE_BYTES
  //                    stays 1918444 (sw.js is not in CORE and no CORE file's size changed in
  //                    THIS commit; app.js was rebuilt in the commit below and CORE_BYTES was
  //                    re-cut there, with it; re-measured by tools/core-bytes.cjs: MATCH), and
  //                    no byte-table or SW_PROSE figure moved, since 'ezik-v31' and 'ezik-v32'
  //                    are both eight characters and sw.js did not change length: 44266 bytes
  //                    before and after, CR = 0, as the note above requires. MUSHAF_CACHE stays
  //                    ezik-mushaf-pages-v1, unversioned by design (item 33), and measured
  //                    above to survive the sweep. SW_CACHE below is re-cut in the SAME commit
  //                    as this digest -- it is the only mirror, re-checked by grep across the
  //                    tree -- and the digest AFTER both. app.js / app.jsx untouched here.
  //   2026-08-25   -- the delete-page truth round. app.jsx gained FOUR localStorage removals in
  //                    resetAll -- the AI-consent record, the saved qibla position, the prayer
  //                    preferences and the schedule derived from them -- because delete.html has
  //                    promised all four in both languages since it shipped and the code kept
  //                    only some of them. The PAGE was not touched: the promise was already the
  //                    right one, so the code moved to it. app.js was rebuilt from that source
  //                    1081237 -> 1082779 (+1542), and app.js IS in CORE, so three things moved
  //                    in this commit and in this order: `npm run build:app` regenerated the
  //                    bundle, `node tools/core-bytes.cjs --write` re-cut CORE_BYTES 1916902 ->
  //                    1918444, the app.js figure in the byte table above that constant and its
  //                    SW_PROSE mirror below both followed 1081237 -> 1082779, and THIS digest
  //                    was cut last, after all of them. sw.js did not change LENGTH -- 44266
  //                    bytes before and after, CR = 0 -- because both figures kept their digit
  //                    count; only their values moved. CACHE is NOT touched here: the store name
  //                    is a ship decision and it gets its own commit, ezik-v31 -> ezik-v32,
  //                    directly after this one. tools/delete-truth-measure.cjs is added in the
  //                    same commit and holds the four removals, the twenty that already
  //                    happened, and the three keys the page promises SURVIVE.
  //   2026-08-25   -- the store lift for the location round. CACHE ezik-v30 -> ezik-v31, and
  //                    unlike round 29 below the file that forced it IS in CORE: app.js, which
  //                    the location commit rebuilt 1076271 -> 1081237. So this bump is not about
  //                    a page the fetch handler happens to store -- it is about the shipped
  //                    bundle itself, and the reason is MEASURED rather than assumed. sw.js was
  //                    driven in a vm with a stub CacheStorage recording every match, put, add
  //                    and delete: install add()s '/app.js' into CACHE as one of the ten CORE
  //                    entries, and a GET of it on a WORKING network is then answered out of the
  //                    store with ZERO network calls, because same-origin static assets land in
  //                    the generic cache-first arm (sw.js:741) which returns the hit and never
  //                    revalidates. A returning reader therefore keeps the OLD bundle for as
  //                    long as the store keeps its name -- not merely while offline, which is
  //                    the weaker claim round 29 could make about a network-first page. With
  //                    CACHE lifted, activate's sweep (sw.js:434) deletes exactly ezik-v30 and
  //                    spares ezik-mushaf-pages-v1, and install repopulates with the new bundle.
  //                    The control was run too: without the lift, activate deletes nothing and
  //                    the old bundle is still served on a live network. NOTHING ELSE MOVED --
  //                    CORE_BYTES stays 1916902 (sw.js is not in CORE and no CORE file's size
  //                    changed in this commit; re-measured by tools/core-bytes.cjs: MATCH), and
  //                    no byte-table or SW_PROSE figure moved, since 'ezik-v30' and 'ezik-v31'
  //                    are both eight characters and sw.js did not change length. MUSHAF_CACHE
  //                    stays ezik-mushaf-pages-v1, unversioned by design (item 33). SW_CACHE
  //                    below is re-cut in the SAME commit as this digest, and the digest AFTER
  //                    both.
  //   2026-08-25   -- merge round 29: the privacy-truth correction. privacy.html and delete.html
  //                    were the only files merged, and NEITHER is in CORE -- so CORE_BYTES did
  //                    NOT move (1911936, re-measured by tools/core-bytes.cjs and MATCH) and no
  //                    byte table or SW_PROSE figure moved with it. CACHE moved ezik-v29 ->
  //                    ezik-v30 all the same, and the reason is MEASURED rather than assumed:
  //                    the fetch handler was driven in a vm with a stub CacheStorage, and both
  //                    pages are written into CACHE by the network-first arm on every successful
  //                    navigation even though neither is precached -- so a reader with a dead
  //                    network is served the OLD legal text out of the old store, and a
  //                    non-navigate GET of either path falls through to the generic cache-first
  //                    arm and is served the old text with a working network and no
  //                    revalidation. activate() sweeps every store but CACHE and MUSHAF_CACHE,
  //                    so the bump is what actually drops those copies. SW_CACHE below is
  //                    re-cut in the SAME commit as this digest, and the digest AFTER both.
  //   2026-08-24   -- merge round 28: the khatmah tracker and the 36-B prose correction. A
  //                    completion of the whole book is now credited ONLY by a control the reader
  //                    presses -- the eight-second dwell timer that credits the daily wird reaches
  //                    it from nowhere -- and the length of the book is read off mushaf-layout.json
  //                    rather than written down a second time. BOTH core numbers moved this round:
  //                    app.js 1035264 -> 1060060 (+24796) and index.html 122568 -> 122884 (+316),
  //                    and CORE_BYTES followed 1870613 -> 1895725 (+25112) = the two deltas summed,
  //                    re-cut from the disk by tools/core-bytes.cjs --write. CACHE moved v26 ->
  //                    ezik-v27: the shell and the bundle are both in CORE and both changed.
  //                    NOTE FOR THE NEXT ROUND, measured here: the index.html figure is stated
  //                    TWICE in sw.js prose -- once in the byte table and once in the note on why
  //                    '/index.html' is not a CORE entry. Both had to move. Moving only the table
  //                    leaves the old integer standing in the other sentence, where B14's
  //                    completeness scan meets it as an UNREGISTERED number and fails on it, so a
  //                    one-line repair turns into a second red for no reason.
  //   2026-08-24   -- merge round 27: item 42-C, the share card's own attribution. The card was
  //                    handed serializeReply's TEXT and a footer string, and the source paragraph
  //                    and the notice are the LAST two things that text carries -- so a fixed line
  //                    budget cut them off first and the card went out with a bare domain where
  //                    its source belonged. The tail is reserved BEFORE the body is measured now,
  //                    the height became a floor of 1350 with a ceiling of 2700 instead of a
  //                    size, and the two paragraphs are MOVED out of the body rather than drawn
  //                    twice. It all lives in app.jsx, and index.html was NOT touched this round,
  //                    so ONE core number moved: app.js 1026796 -> 1035264 (+8468), and
  //                    CORE_BYTES followed 1862145 -> 1870613 (+8468), re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved v25 -> v26: the bundle a
  //                    returning reader boots is precached in CORE and it changed. The index.html
  //                    figure in the byte table is UNCHANGED and was left alone -- only the app.js
  //                    one moved, with its SW_PROSE mirror, in THIS commit, and the seal below
  //                    AFTER both.
  //   2026-08-24   -- merge round 26: item 42, both halves. The share CARD had its bidi fixed
  //                    (its canvas resolved direction to LTR, so every sentence-final mark was
  //                    drawn at the START of an Arabic line) and its line budget derived from
  //                    the card's own geometry instead of a hand-picked 13; the EXPORT stopped
  //                    calling a CDN rasteriser and became window.print(). Both live in app.jsx,
  //                    and the export also took six lines of print stylesheet, so BOTH CORE
  //                    numbers moved: app.js 1019495 -> 1026796 (+7301), index.html 121979 ->
  //                    122568 (+589), and CORE_BYTES followed 1854255 -> 1862145 (+7890), re-cut
  //                    from the disk by tools/core-bytes.cjs --write. CACHE moved v24 -> v25:
  //                    the shell and the bundle are both in CORE and both changed.
  //                    AND THIS ROUND ALSO REPAIRED sw.js's OWN PROSE, which the round that
  //                    caused the drift was forbidden to touch: two present-tense notes said a
  //                    PDF bundle is fetched from cdnjs on the first export, and it is not
  //                    fetched at all any more. A third mention survives on purpose -- it sits
  //                    inside a quotation of what that note read before item 32, and correcting
  //                    a quotation would make the record false rather than true.
  //                    SW_CACHE, the TWO SW_PROSE mirrors and the byte table above sw.js
  //                    CORE_BYTES were re-cut in THIS commit, and the seal below AFTER all of
  //                    them.
  //   2026-08-24   -- merge round 25: two branches with no path in common between them. The
  //                    home screen took a widget register with one stored arrangement, an
  //                    arranging mode, and the prayer-times, adhkar and daily-verse widgets;
  //                    the web presence took a static about page, a sitemap, a robots file and
  //                    a canonical on every static page. The two halves land on OPPOSITE sides
  //                    of the shell, so both CORE numbers moved this round and not one:
  //                    app.js 990041 -> 1019495 (+29454) from the widget branch, index.html
  //                    120617 -> 121979 (+1362) from the web-presence branch, and CORE_BYTES
  //                    followed 1823439 -> 1854255 (+30816), re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved v23 -> v24: the shell
  //                    AND the bundle a returning reader boots are both in CORE and both
  //                    changed, so the store name must move or they are served the old bytes
  //                    of both. SW_CACHE, the TWO SW_PROSE mirrors and the byte table above
  //                    sw.js CORE_BYTES were re-cut in THIS commit, and the seal below AFTER
  //                    all of them.
  //   2026-08-23   -- the CC cleanup round, item B: the lessons section became the FOURTH way
  //                    out of an empty chat, appended to sectionSuggestions, and 5B-1 of the
  //                    lessons guard stopped COUNTING the two lessons routes and started
  //                    ACCOUNTING for them by name. The entry lives in app.jsx, so app.js grew
  //                    989660 -> 990041 (+381) under a shell that did not move, and CORE_BYTES
  //                    followed 1823058 -> 1823439, re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE is NOT touched: it moved ezik-v22 ->
  //                    v23 in the round above and nothing has shipped under v23 -- it is
  //                    absent from origin/main, measured this round -- so raising it twice
  //                    would burn a store name for a single ship. The SW_PROSE mirror and the
  //                    byte table above sw.js CORE_BYTES were re-cut in THIS commit, and the
  //                    seal below AFTER all of them.
  //   2026-08-23   -- the CC cleanup round: a comment above sectionSuggestions that denied the
  //                    lessons section, and ezLangRelabel deleting the prayer and library
  //                    descriptions on every language switch. Both live in app.jsx, so app.js
  //                    grew 989166 -> 989660 (+494) under a shell that did not move, and
  //                    CORE_BYTES followed 1822564 -> 1823058, re-cut from the disk by
  //                    tools/core-bytes.cjs --write. CACHE moved ezik-v22 -> v23 for the
  //                    reason every round below gives: the bundle a returning reader boots is
  //                    precached in CORE, so the store name must move or they keep the old
  //                    bytes. SW_CACHE, the SW_PROSE mirror and the byte table above sw.js
  //                    CORE_BYTES were re-cut in THIS commit, and the seal below AFTER all of
  //                    them.
  //   2026-08-23   -- item 24-C gave the lessons section a BROWSE tab beside its search: a
  //                    scholar, then a series, then the lessons under it. Browsing is a second
  //                    TAB, not a second screen, so index.html did not move -- but app.js grew
  //                    968689 -> 989166 (+20477) under it, and CORE_BYTES followed
  //                    1802087 -> 1822564, re-cut from the disk by tools/core-bytes.cjs --write.
  //                    CACHE moved v21 -> ezik-v22 for the reason the two rounds below give:
  //                    index.html is in CORE and the bundle under it changed, so a returning
  //                    reader must stop being served the old shell out of the old store.
  //                    SW_CACHE, the SW_PROSE mirror and the byte table above sw.js CORE_BYTES
  //                    were re-cut in THIS commit, and the seal below AFTER all of them.
  //   2026-08-23   -- items 24-A and 24-B put the lessons route in the interface: first the tail
  //                    card under a settled reply, then the section of its own. app.js grew
  //                    947845 -> 955775 -> 968689 across the two merge rounds, so CORE_BYTES and
  //                    the byte table above it were re-cut from the disk both times, by
  //                    tools/core-bytes.cjs --write. CACHE moved ezik-v19 -> v20 -> v21: index.html
  //                    is in CORE and the bundle under it changed, so a returning reader must stop
  //                    being served the old shell out of the old store. SW_CACHE and the SW_PROSE
  //                    mirror were re-cut in the SAME commit each time. This line is the one the
  //                    24-A merge round owed and did not write: its order allowed the four values
  //                    and the seal only, so the seal moved with no word here saying why.
  //   item 33      -- the 604 printed page scans left the generic cache-first arm for a store of
  //                    their OWN, 'ezik-mushaf-pages-v1', which carries no version and which
  //                    activate's sweep now exempts BY NAME -- so a ship no longer throws away
  //                    tens of megabytes of files that cannot change. The arm is capped at
  //                    SW_MUSHAF_CAP pages with least-recently-used eviction and an estimate
  //                    before every write. B15 below and SW_MUSHAF_CACHE were cut in the SAME
  //                    commit as this digest. CACHE is NOT touched: the store name is the merge
  //                    round's to bump, and this item adds a SECOND store rather than bumping it.
  //   item 115-ب  -- the two TRANSFER sizes in the worker prose (298686 for the shell, 338409 and
  //                    151653 for the mushaf pair) were numbers nothing in this tree could ever
  //                    check -- they depend on the CDN encoder -- and had already gone stale. They
  //                    are restated on disk. B14 below, cut in the SAME commit as this digest, now
  //                    re-measures every size the prose states and refuses any integer of 500 or
  //                    more that is registered nowhere. CACHE is NOT touched.
  //   item 89-b    -- icon-watermark.png was re-packed LOSSLESSLY (373806 -> 368386 bytes; the
  //                    decoded pixels are byte-identical, alpha included, on two independent
  //                    decoders). The CORE_BYTES the worker declares fell with it, 1662972 ->
  //                    1657552, written by `node tools/core-bytes.cjs --write`, and the comment
  //                    table above that constant carries the same measurement. All three were
  //                    re-cut in the SAME commit. CACHE is NOT touched: the store name is the
  //                    merge round’s to bump.
  //   item 93-b    -- install ends by PUSHING its precache brief to every connected client
  //                    instead of leaving the record behind a request nobody makes. B13 below
  //                    was cut in the SAME commit as this digest. CACHE is NOT touched: the
  //                    store name is a ship decision and the merge round owns the bump.
  //   item 22+104  -- CACHE 'ezik-v6' -> 'ezik-v7'. index.html is in CORE and item 22+104
  //                    changed it (the wird strip now leaves the DOM with the chrome), so a
  //                    returning reader must stop being served the old shell out of the old
  //                    store. SW_CACHE below is re-cut in the SAME commit as this digest.
  //   item 93      -- a failed precache entry is counted and named instead of swallowed. B11
  //                    gained the three item 93 checks in the SAME commit as this digest.
  //   item 90      -- the two sealed mushaf files left the stale-while-revalidate class and
  //                    returned to cache-first. B11 gained the ZERO-fetch half in the SAME commit.
  //   items 88 + 80 -- CACHE 'ezik-v1' -> 'ezik-v2' (so a returning reader stops being
  //                    served the old build out of the old store), and the same-origin
  //                    *.json class moved from cache-first to stale-while-revalidate.
  //                    SW_CACHE below and B11 were cut in the SAME commit as this digest.
  //   watermark     -- CORE gained '/icon-watermark.png' in the commit that pointed .ezwm at it.
  //   item 91-A     -- storage-quota management: an estimate before the first write, one
  //                    persist() request, a reason on every recorded failure, and an eviction
  //                    rule that drops OLD stores (never the current one) and retries once.
  //                    B12 below was cut in the SAME commit as this digest.
  //   location web   -- the qibla button gained a second source behind it (the native shell's
  //                    bridge, when the page is inside the shell), so app.jsx grew and the app.js
  //                    it builds followed 1076271 -> 1081237 (+4966). app.js is in CORE, so three
  //                    numbers moved with it and all three are re-cut in the SAME commit as this
  //                    digest: CORE_BYTES 1911936 -> 1916902 by `node tools/core-bytes.cjs
  //                    --write`, the byte table above that constant, and SW_PROSE below. The
  //                    worker's own behaviour did not change -- what changed inside sw.js is one
  //                    integer and the prose around it, and that prose was ALSO corrected: it
  //                    still described the pre-item-112 rule under which CORE_BYTES was allowed
  //                    to trail the disk and B12 failed downward only. CACHE is NOT touched: the
  //                    store name is a ship decision and the merge round owns the bump.
  'sw.js': '4dc758485da7a9b069070ad27bf93ea7fc805222590d5a442ba17920d81388b7',
};

// ---------------------------------------------------------------------------
// B11: THE SERVICE WORKER'S DATA-FILE POLICY, EXECUTED.
//
// B10 proves sw.js has not moved. It cannot prove sw.js still BEHAVES. Item 80
// was exactly that gap: the data files were served cache-first with no
// revalidation, so a changed adhkar.json stayed frozen on every phone that had
// ever opened the app until a human remembered to bump the cache name below.
// A seal would have happily blessed that forever.
//
// So B11 runs the worker. sw.js is evaluated in vm.runInContext with `self`,
// `caches` and `fetch` domesticated -- the same technique the vendor-loading
// guards in this repo already use -- and a synthetic FetchEvent is dispatched
// at it. No browser, no network, no server: the assertions below are about what
// the code DOES, and they are written against the worker's own selector rather
// than against a line number, an index into the file, or a quoted source line.
//
// SW_CACHE is re-cut with the seal above, in the same commit, by whoever ships
// a version bump. It is here so that a forgotten bump fails with a sentence
// instead of with "sw.js MOVED".
// ---------------------------------------------------------------------------
const SW_FILE = 'sw.js';
const SW_CACHE = 'ezik-v32';
const SW_ORIGIN = 'https://ezik.app';
// ITEM 93-B. The tag on the end-of-install brief the worker pushes to every client. Written here
// rather than read back out of sw.js, because "the worker sent whatever the worker calls it" is a
// tautology: a renamed tag would satisfy it while every listener in the app went deaf.
const SW_REPORT_TAG = 'precache-report';
// The data-file class item 80 governs, and one member of every class it must NOT
// have touched. Named by request, because the worker selects by request.
// ITEM 90 SPLIT THIS CLASS IN TWO, and each half is asserted for the OPPOSITE thing. The two
// mushaf files are sealed by digest above, so the worker excludes them from revalidation by name
// and serves them cache-first; the other three still revalidate. Asserting only the revalidating
// half would let the exclusion widen until it swallowed adhkar.json, which is precisely the
// freeze item 80 was raised to end. So: these three must issue exactly ONE background fetch, and
// those two must issue ZERO.
const SW_REVALIDATED = ['/adhkar.json', '/worship-display.json', '/manifest.json'];
// ITEM 91-A. What CORE must contain after a precache in the SANE state. Written out rather than
// read back from the worker, because "everything the worker chose to write was written" is a
// tautology: a CORE that quietly lost an entry would satisfy it. sw.js is sealed by digest
// above, so this list and that list are re-cut together or not at all.
// ITEM 32 ADDED THE LAST THREE. They are the files the first paint cannot happen without, and
// they are on this origin for the first time: /app.js is index.html's JSX compiled ahead of the
// commit, and the two /vendor bundles are the React the page used to fetch from unpkg. A CORE
// that stored the shell and not the app is what made "offline boot is not possible" true.
const SW_CORE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/icon-maskable-512.png', '/icon-watermark.png', '/adhkar.json',
  '/app.js', '/vendor/react.umd.js', '/vendor/react-dom.umd.js'];
// The files CORE names on disk, in the same order. B12 re-derives their byte sum and refuses a
// CORE_BYTES constant that has fallen below it.
const SW_CORE_FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'icon-watermark.png', 'adhkar.json',
  'app.js', 'vendor/react.umd.js', 'vendor/react-dom.umd.js'];
const SW_SEALED_DATA = ['/quran-uthmani.json', '/mushaf-layout.json'];
// ITEM 33. The store the 604 printed page scans live in, and the ceiling on it. Written out
// here rather than read back out of sw.js for the same reason SW_CORE and SW_REPORT_TAG are:
// "the worker capped it at whatever the worker calls the cap" is a tautology that a cap
// silently raised to 10000 would satisfy. sw.js is sealed by digest above, so this pair and
// that pair are re-cut together or not at all.
const SW_MUSHAF_CACHE = 'ezik-mushaf-pages-v1';
const SW_MUSHAF_CAP = 60;
// The URL is COMPUTED, exactly as index.html computes it: 604 literal paths would be a table
// nobody reads and a second place for the naming scheme to drift.
const swPageUrl = (n) => '/assets/madina-hafs/page-' + String(n).padStart(3, '0') + '.webp';
const SW_DATA_FILES = SW_REVALIDATED.concat(SW_SEALED_DATA);

// ITEM 91-A. The synthetic rejections the harness can hand a `cache.add`. A full disk and a
// dead network must be told apart by the worker itself, so they arrive with the identities a
// real browser gives them: QuotaExceededError carries its name, a failed fetch carries a
// TypeError whose text names the fetch.
function swAddError(kind) {
  const e = new Error(kind === 'network'
    ? 'Failed to fetch (synthetic)'
    : 'QuotaExceededError: quota exceeded (synthetic)');
  e.name = kind === 'network' ? 'TypeError' : 'QuotaExceededError';
  return e;
}

// A domesticated navigator.storage. `estimate:false` / `persist:false` remove that method
// entirely, which is how the old-browser state is expressed -- as an ABSENT function rather
// than as one that returns something odd.
function swNav(opts) {
  const calls = { estimate: 0, persist: 0 };
  const storage = {};
  if (opts.estimate !== false) {
    storage.estimate = () => {
      calls.estimate++;
      return Promise.resolve({ quota: opts.quota, usage: opts.usage });
    };
  }
  if (opts.persist !== false) {
    storage.persist = () => {
      calls.persist++;
      if (opts.persist === 'throws') return Promise.reject(new Error('not allowed'));
      return Promise.resolve(opts.persist !== 'denied');
    };
  }
  return { navigator: { storage: storage }, calls: calls };
}

function swRes(body, status) {
  return {
    status: status === undefined ? 200 : status,
    type: 'basic',
    _body: body,
    clone() { return swRes(this._body, this.status); },
    text() { return Promise.resolve(this._body); },
  };
}

// ITEM 93-B. A domesticated `self.clients`. The worker reaches the page through matchAll +
// postMessage, so both have to be levers a test can move: how many pages are listening (0 is a
// real state, and the commonest one on a first install), whether one of them throws on
// postMessage, and whether the browser exposes matchAll at all.
function swClients(opts) {
  const o = opts || {};
  const posted = [];
  const calls = [];
  const count = typeof o.count === 'number' ? o.count : 1;
  const clients = { claim: () => Promise.resolve() };
  if (o.matchAll !== false) {
    clients.matchAll = (arg) => {
      calls.push(arg || null);
      if (o.matchAll === 'rejects') return Promise.reject(new Error('no clients (synthetic)'));
      const list = [];
      for (let i = 0; i < count; i++) {
        const id = 'c' + i;
        list.push({
          id: id,
          postMessage: (m) => {
            if (o.throwsOn === id) throw new Error('client is gone (synthetic)');
            posted.push({ client: id, message: m });
          },
        });
      }
      return Promise.resolve(list);
    };
  }
  return { clients: clients, posted: posted, calls: calls };
}

// Load sw.js into a domesticated global scope and hand back the levers a test needs.
// ITEM 33 added the last two parameters. `failPut` makes a runtime cache.put reject, which is
// the only way to ask the worker what it does with a page write it cannot prevent failing --
// the question item 93 asked of PRECACHE entries and never asked of these. cache.keys() had to
// become real because the page store's least-recently-used order is seeded from it.
function swLoad(swPath, fetchImpl, failAdd, nav, clientsOpt, failPut) {
  const store = new Map();
  const listeners = {};
  const opened = [];
  // ITEM 91-A: what the worker DELETED and what it ATTEMPTED to add. Both are behaviour, and
  // both are invisible to a harness whose `add` neither stores nor records.
  const deleted = [];
  const addCalls = [];
  const clientHarness = swClients(clientsOpt);
  let fetchCalls = 0;
  const keyOf = (r) => (typeof r === 'string' ? SW_ORIGIN + r : r.url);
  const cacheOf = (n) => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
  const wrap = (n) => ({
    match: (r) => Promise.resolve(cacheOf(n).get(keyOf(r))),
    put: (r, res) => {
      const kind = failPut && failPut(keyOf(r));
      if (kind) return Promise.reject(swAddError(kind === true ? 'quota' : String(kind)));
      cacheOf(n).set(keyOf(r), res);
      return Promise.resolve();
    },
    // A real cache.keys() answers in INSERTION order, and the page store's eviction order is
    // seeded from exactly that. A Map preserves insertion order, so this is the real contract
    // and not an approximation of it.
    keys: () => Promise.resolve(Array.from(cacheOf(n).keys()).map((u) => ({ url: u }))),
    // Item 93: the harness can make a named precache entry reject, which is the only way to ask
    // the worker what it does with a failure it cannot prevent.
    // ITEM 91-A: `failAdd` is now handed the eviction log too, so a test can express "this
    // write fails UNTIL room has been made" -- the only shape in which a retry can be
    // distinguished from a write that was always going to succeed. A successful add now WRITES,
    // because "was CORE actually stored" is the acceptance condition of the whole item.
    add: (u) => {
      addCalls.push(u);
      const kind = failAdd && failAdd(u, { deleted: deleted.slice(), adds: addCalls.length });
      if (kind) return Promise.reject(swAddError(kind === true ? 'quota' : String(kind)));
      cacheOf(n).set(keyOf(u), swRes('ADDED ' + u));
      return Promise.resolve();
    },
    delete: (r) => Promise.resolve(cacheOf(n).delete(keyOf(r))),
  });
  const sandbox = {
    URL: URL, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, console: console,
    self: {
      addEventListener: (t, f) => { listeners[t] = f; },
      skipWaiting: () => {},
      clients: clientHarness.clients,
      location: { origin: SW_ORIGIN },
    },
    caches: {
      // A real caches.open() CREATES the cache, so caches.keys() lists it from that moment.
      // Returning a lazy handle instead hid the current store from every keys() call until the
      // first successful write -- and an eviction that deletes the current store is exactly what
      // that window made invisible. B12 M2 escaped on this and nothing else.
      open: (n) => { opened.push(n); cacheOf(n); return Promise.resolve(wrap(n)); },
      match: (r) => {
        for (const n of store.keys()) {
          const h = cacheOf(n).get(keyOf(r));
          if (h) return Promise.resolve(h);
        }
        return Promise.resolve(undefined);
      },
      keys: () => Promise.resolve(Array.from(store.keys())),
      delete: (n) => { deleted.push(n); return Promise.resolve(store.delete(n)); },
    },
    fetch: (r) => { fetchCalls++; return fetchImpl(r); },
    // ITEM 91-A. Left UNDEFINED unless a test supplies one: `typeof navigator === 'undefined'`
    // then holds inside the worker, which is the old-browser state exactly as a phone has it.
    navigator: nav,
  };
  vm.runInContext(fs.readFileSync(swPath, 'utf8'), vm.createContext(sandbox), { filename: swPath });
  return {
    hasFetchListener: () => typeof listeners.fetch === 'function',
    opened: opened,
    fetches: () => fetchCalls,
    seed: (name, url, body) => cacheOf(name).set(SW_ORIGIN + url, swRes(body)),
    peek: (name, url) => {
      const h = cacheOf(name).get(SW_ORIGIN + url);
      return h ? h._body : undefined;
    },
    self: sandbox.self,
    // ITEM 93-B levers: what the worker HANDED the pages, and what it asked for when it looked
    // them up. Both are behaviour; neither is visible in the cache or the storage record.
    posted: () => clientHarness.posted.slice(),
    matchAllCalls: () => clientHarness.calls.slice(),
    // ITEM 91-A levers.
    storage: () => sandbox.self.ezikStorage,
    deleted: () => deleted.slice(),
    adds: () => addCalls.slice(),
    stores: () => Array.from(store.keys()),
    has: (name, url) => cacheOf(name).has(SW_ORIGIN + url),
    seedStore: (name) => { cacheOf(name); },
    activate: () => {
      const waits = [];
      if (typeof listeners.activate !== 'function') return { waits: waits, missing: true };
      listeners.activate({ waitUntil: (p) => { waits.push(p); } });
      return { waits: waits, missing: false };
    },
    install: () => {
      const waits = [];
      if (typeof listeners.install !== 'function') return { waits: waits, missing: true };
      listeners.install({ waitUntil: (p) => { waits.push(p); } });
      return { waits: waits, missing: false };
    },
    // A-4: the pull channel, driven. The worker answers 'precache-status' on the port the
    // page hands it, and that reply is the ONLY place the page can learn the store's ceiling
    // and its floor -- so it is behaviour, and it is tested rather than assumed.
    message: (data) => {
      if (typeof listeners.message !== 'function') return { missing: true, reply: null };
      let reply = null;
      listeners.message({
        data: data,
        ports: [{ postMessage: (m) => { reply = m; } }],
        waitUntil: () => {},
      });
      return { missing: false, reply: reply };
    },
    dispatch: (url, mode) => {
      let responded = null;
      const waits = [];
      listeners.fetch({
        request: { url: SW_ORIGIN + url, method: 'GET', mode: mode || 'cors' },
        respondWith: (p) => { responded = p; },
        waitUntil: (p) => { waits.push(p); },
      });
      return { responded: responded, waits: waits };
    },
  };
}

const swSettle = (ps) => Promise.all(ps.map((p) => Promise.resolve(p).catch(() => undefined)));
// The reason on the one record a B12 state produced, or a sentence naming what it found instead.
// Never an empty string: a blank would satisfy every negative check that reads it.
const mineReason = (rec) => (rec.length === 1 && rec[0] && rec[0].reason !== undefined
  ? rec[0].reason
  : '(' + rec.length + ' record(s), no single reason)');
const swBody = async (p) => {
  if (!p) return undefined;
  const r = await Promise.resolve(p).catch(() => undefined);
  return r ? await r.text() : undefined;
};

// ---------------------------------------------------------------------------
// Arabic, as escapes only.
// ---------------------------------------------------------------------------
const AR = {
  // deictic pointers at a list the default reveal mode never renders
  MIMMA_YALI: '\u0645\u0645\u0627 \u064a\u0644\u064a',                  // mimma yali
  ATIYA: '\u0627\u0644\u0627\u062a\u064a\u0647',                        // al-atiya
  TALIYA: '\u0627\u0644\u062a\u0627\u0644\u064a\u0647',                 // al-taliya
  TALI: '\u0627\u0644\u062a\u0627\u0644\u064a',                         // al-tali
  ATI: '\u0627\u0644\u0627\u062a\u064a',                                // al-ati
  MIN_HADHIHI: '\u0645\u0646 \u0647\u0630\u0647',                       // min hadhihi
  MIN_HAULA: '\u0645\u0646 \u0647\u0621\u0644\u0627\u0621',             // min ha'ula'
  KHIYARAT: '\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a',         // al-khiyarat
  // source markers that are not sources
  YURAJA: '\u064a\u0631\u0627\u062c\u0639',                             // yuraja' -- "to be reviewed"
  MASHHUR: '\u0645\u0634\u0647\u0648\u0631',                            // mashhur -- "well known"
  // the two literal options a mis-typed true/false question used to carry
  TF_T: '\u0635\u062d', TF_F: '\u062e\u0637\u0623',                     // sahh / khata'
};
const DEICTIC = [AR.MIMMA_YALI, AR.ATIYA, AR.TALIYA, AR.TALI, AR.ATI, AR.MIN_HADHIHI, AR.MIN_HAULA, AR.KHIYARAT];
// interrogatives and imperatives that make a stem stand on its own
const INTERROGATIVES = ['\u0645\u0627', '\u0645\u0646', '\u0643\u0645', '\u0627\u064a\u0646',
  '\u0645\u062a\u064a', '\u0643\u064a\u0641', '\u0644\u0645\u0627\u0630\u0627', '\u0645\u0627\u0630\u0627',
  '\u0627\u064a', '\u0647\u0644', '\u0627\u0630\u0643\u0631', '\u0627\u0643\u0645\u0644',
  '\u0631\u062a\u0628', '\u0637\u0627\u0628\u0642', '\u0635\u0644', '\u0633\u0645'];

// ---------------------------------------------------------------------------
// Normalisation. Diacritics go; alef/ya/ta-marbuta/hamza forms collapse; but
// DIGITS SURVIVE -- Arabic-Indic, subscripts, superscripts and the minus sign all
// fold to ASCII. An earlier sweep that dropped them reported six duplicate choices
// that did not exist ("100" and "0" both normalising to the empty string).
// ---------------------------------------------------------------------------
const TASHKEEL = /[\u064b-\u0652\u0670\u0640\u06d6-\u06ed]/g;
const SUB = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
function norm(s) {
  if (s == null) return '';
  let t = String(s).replace(TASHKEEL, '');
  t = t.replace(/[\u2080-\u2089]/g, c => String(SUB.indexOf(c)));
  t = t.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, c => String(SUP.indexOf(c)));
  t = t.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x06f0));
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
  t = t.replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064a');
  t = t.replace(/[\u0624\u0626]/g, '\u0621');
  t = t.replace(/[^\u0621-\u064a0-9a-zA-Z\-%]+/g, ' ');
  return t.trim();
}
const wordsOf = s => norm(s).split(' ').filter(Boolean);
function hasPhrase(stem, phrase) {
  const w = wordsOf(stem), p = phrase.split(' ').filter(Boolean);
  for (let i = 0; i + p.length <= w.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (w[i + j] !== p[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
// print any string as codepoints -- never raw Arabic
const cp = s => '[' + [...String(s)].map(c => {
  const n = c.charCodeAt(0);
  return n < 128 ? c : 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
}).join(' ') + ']';

const stemOf = q => q.q != null ? q.q : (q.verse != null ? q.verse : '');
const optsOf = q => q.choices || q.bank || null;
const keyOf = q => { const o = optsOf(q); return o && typeof q.answer === 'number' ? norm(o[q.answer]) : null; };
function fingerprint(q) {
  return crypto.createHash('sha256').update(JSON.stringify(q, Object.keys(q).sort())).digest('hex').slice(0, 16);
}
// A citation locates something if it carries a number (hadith no., aya, year),
// or a sub-reference introduced by an em- or en-dash, or a \u00abquoted entry\u00bb.
const LOCATOR = /[0-9\u0660-\u0669]|[\u2014\u2013]\s*\S|\u00ab[^\u00bb]+\u00bb/;

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let i = 0; for (const v of A) if (B.has(v)) i++;
  return i / (A.size + B.size - i);
}

// ---------------------------------------------------------------------------
// Documented exceptions. Each one is a judgement call recorded in the source so a
// later reader can overturn it deliberately rather than by accident.
// ---------------------------------------------------------------------------
// Two questions ask for the same dhikr on two DIFFERENT occasions (before food /
// before wudu). Same key, overlapping stem, but genuinely two questions.
const ALLOWED_DUP = new Set(['adhkar|azkar-0001|gemini-adhkar-b2-001']);
// The stem legitimately contains the key.
const ALLOWED_SELF_REVEAL = {
  'phys-0016': 'angle of reflection EQUALS the angle of incidence named in the stem -- that identity IS the question',
  'chatgpt-chemistry-001': 'stem names solvent and solute; asking which is which is the concept being tested',
  'chatgpt4-geography-009': 'stem offers the A-or-B pair explicitly; it is an either/or question, not a list pointer',
  'gemini-hadith-b2-014': 'the hadith itself repeats the word ("da` ma yuribuk ila ma la yuribuk")',
};

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ---------------------------------------------------------------------------
function emit() {
  const d = load(BANK);
  const prot = {}, cats = {}, hist = {};
  for (const q of d.questions) {
    cats[q.id] = q.cat;
    hist[q.cat] = (hist[q.cat] || 0) + 1;
    if (PROTECTED_CATS.includes(q.cat)) prot[q.id] = fingerprint(q);
  }
  process.stdout.write(JSON.stringify({
    schema: 'bank-integrity-golden/v1',
    note: 'Phase-4 structural baseline. `protected` pins the 394 questions of the four protected '
      + 'categories to their commit-17bb52a bytes and must NEVER be regenerated to paper over a change '
      + 'to them. `ids` / `cats` / `total` pin identity. Everything else the guard recomputes live.',
    total: d.questions.length,
    protectedCats: PROTECTED_CATS,
    protectedCount: Object.keys(prot).length,
    categoryCounts: hist,
    ids: d.questions.map(q => q.id),
    cats,
    protected: prot,
  }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
async function compare(goldenPath) {
  const d = load(BANK), g = load(goldenPath);
  let pass = 0, fail = 0;
  const ok = m => { pass++; console.log('  PASS ' + m); };
  const no = (c, m) => { fail++; console.log('  FAIL [' + c + '] ' + m); };

  const isProt = q => PROTECTED_CATS.includes(q.cat);
  const rest = d.questions.filter(q => !isProt(q));

  // -- B1 count ------------------------------------------------------------
  console.log('\n-- B1 count --');
  if (d.questions.length === g.total) ok('question count = ' + g.total);
  else no('B1', 'question count = ' + d.questions.length + ' (golden says ' + g.total + ')');

  // -- B2 identity ---------------------------------------------------------
  console.log('\n-- B2 identity --');
  const live = d.questions.map(q => q.id);
  if (live.length === g.ids.length && live.every((v, i) => v === g.ids[i])) ok('id list unchanged, in order');
  else {
    const L = new Set(live), G = new Set(g.ids);
    const added = live.filter(x => !G.has(x)), gone = g.ids.filter(x => !L.has(x));
    if (added.length) no('B2', 'ids not in the golden: ' + added.slice(0, 8).join(', '));
    if (gone.length) no('B2', 'ids dropped from the bank: ' + gone.slice(0, 8).join(', '));
    if (!added.length && !gone.length) no('B2', 'id ORDER changed');
  }

  // -- B3 categories -------------------------------------------------------
  console.log('\n-- B3 categories --');
  let moved = 0;
  for (const q of d.questions) if (g.cats[q.id] && g.cats[q.id] !== q.cat) { moved++; no('B3', q.id + ' moved ' + g.cats[q.id] + ' -> ' + q.cat); }
  if (!moved) ok('every question is still in its own category');
  const hist = {};
  for (const q of d.questions) hist[q.cat] = (hist[q.cat] || 0) + 1;
  const drift = Object.keys(g.categoryCounts).filter(c => hist[c] !== g.categoryCounts[c]);
  if (!drift.length) ok('category histogram unchanged (' + Object.keys(hist).length + ' categories)');
  else for (const c of drift) no('B3', 'category ' + c + ' = ' + (hist[c] || 0) + ' (golden ' + g.categoryCounts[c] + ')');

  // -- B4 schema + B6 answer validity --------------------------------------
  console.log('\n-- B4 schema / B6 answer validity --');
  let bad = 0;
  for (const q of rest) {
    const o = optsOf(q), t = q.type;
    const stem = stemOf(q);
    if (!stem || !String(stem).trim()) { no('B4', q.id + ' has no stem'); bad++; }
    if (!q.why || !String(q.why).trim()) { no('B4', q.id + ' has no why'); bad++; }
    if (t === 'mcq') {
      if (!Array.isArray(q.choices)) { no('B4', q.id + ' mcq without choices'); bad++; }
      else {
        if (q.choices.length < 3) { no('B4', q.id + ' mcq with only ' + q.choices.length + ' choices (a 2-option mcq is a mis-typed tf)'); bad++; }
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) { no('B6', q.id + ' answer index ' + q.answer + ' out of range'); bad++; }
        if (q.choices[0] === AR.TF_T && q.choices[1] === AR.TF_F) { no('B4', q.id + ' is a true/false statement stored as mcq'); bad++; }
        const seen = new Set();
        for (const c of q.choices) {
          const n = norm(c);
          if (!n) { no('B4', q.id + ' has an empty choice'); bad++; }
          if (seen.has(n)) { no('B4', q.id + ' has a duplicate choice ' + cp(String(c).slice(0, 24))); bad++; }
          seen.add(n);
        }
      }
    } else if (t === 'tf') {
      if (typeof q.answer !== 'boolean') { no('B6', q.id + ' tf answer is not a boolean'); bad++; }
      if (q.choices) { no('B4', q.id + ' tf carries a dead choices array'); bad++; }
    } else if (t === 'complete') {
      if (!Array.isArray(q.bank)) { no('B4', q.id + ' complete without a bank'); bad++; }
      else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.bank.length) { no('B6', q.id + ' answer index out of range'); bad++; }
    } else if (t === 'order') {
      if (!Array.isArray(q.items) || !Array.isArray(q.answer) || q.items.length !== q.answer.length) { no('B4', q.id + ' order shape is broken'); bad++; }
    } else if (t === 'match') {
      if (!Array.isArray(q.left) || !Array.isArray(q.right) || !Array.isArray(q.a)
        || q.left.length !== q.right.length || q.left.length !== q.a.length) { no('B4', q.id + ' match shape is broken'); bad++; }
    } else { no('B4', q.id + ' unknown type ' + t); bad++; }
    if (o && typeof q.answer === 'number' && o[q.answer] != null && !norm(o[q.answer])) { no('B6', q.id + ' answer key is empty'); bad++; }
  }
  if (!bad) ok('all ' + rest.length + ' non-protected questions are schema-clean');

  // -- B5 duplicates -------------------------------------------------------
  console.log('\n-- B5 duplicates --');
  const byStem = new Map();
  for (const q of rest) {
    const k = norm(stemOf(q));
    if (!k) continue;
    if (!byStem.has(k)) byStem.set(k, []);
    byStem.get(k).push(q.id);
  }
  let dups = 0;
  for (const [, ids] of byStem) if (ids.length > 1) { dups++; no('B5', 'identical stems: ' + ids.join(' = ')); }
  const byCat = {};
  for (const q of rest) (byCat[q.cat] = byCat[q.cat] || []).push(q);
  for (const c of Object.keys(byCat)) {
    const grp = new Map();
    for (const q of byCat[c]) { const k = keyOf(q); if (!k) continue; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(q); }
    for (const [, qs] of grp) {
      if (qs.length < 2) continue;
      for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
        if (jaccard(wordsOf(stemOf(qs[i])), wordsOf(stemOf(qs[j]))) < 0.40) continue;
        if (ALLOWED_DUP.has(c + '|' + qs[i].id + '|' + qs[j].id)) continue;
        dups++; no('B5', 'same answer key and overlapping stems in ' + c + ': ' + qs[i].id + ' ~ ' + qs[j].id);
      }
    }
  }
  if (!dups) ok('no duplicate question in the 1785 (1 documented parallel pair allowed)');

  // -- B7 option independence ----------------------------------------------
  console.log('\n-- B7 the stem stands on its own --');
  let dep = 0;
  for (const q of rest) {
    const stem = stemOf(q);
    for (const dpat of DEICTIC) {
      if (hasPhrase(stem, dpat)) { dep++; no('B7', q.id + ' stem points at an unrendered list: ' + cp(dpat)); }
    }
    // a stem must ask something; tf statements and fill-in prompts are exempt
    if (q.type !== 'tf' && q.type !== 'complete') {
      const w = wordsOf(stem);
      const asks = /[\u061f?]/.test(stem) || /[:\uff1a]\s*$/.test(String(stem).trim())
        || /\.\.\.|\u2026|_{2,}/.test(stem) || INTERROGATIVES.some(t => w.includes(norm(t)));
      if (!asks) { dep++; no('B7', q.id + ' stem is not a question and carries no completion marker'); }
    }
    // the stem must not contain its own answer
    const k = keyOf(q);
    if (k && k.length >= 5 && (' ' + norm(stem) + ' ').includes(' ' + k + ' ') && !ALLOWED_SELF_REVEAL[q.id]) {
      dep++; no('B7', q.id + ' stem contains its own answer key');
    }
  }
  if (!dep) ok('every stem is answerable with the choices hidden (' + Object.keys(ALLOWED_SELF_REVEAL).length + ' documented exceptions)');

  // -- B8 sources ----------------------------------------------------------
  console.log('\n-- B8 sources --');
  let src = 0;
  for (const q of rest) {
    const s = String(q.src == null ? '' : q.src).trim();
    if (!s) { src++; no('B8', q.id + ' has no src'); continue; }
    if (hasPhrase(s, AR.YURAJA)) { src++; no('B8', q.id + ' src is a "to be reviewed" marker, not a source'); }
    else if (norm(s) === norm(AR.MASHHUR)) { src++; no('B8', q.id + ' src is a hearsay marker, not a source'); }
    if (/^https?:\/\/[^\/]+\/?$/i.test(s)) { src++; no('B8', q.id + ' src is a bare hostname, not the page that proves the fact'); }
    if (s.length < 4) { src++; no('B8', q.id + ' src is too short to locate anything'); }
    // A source must point INSIDE the work it names. Naming a fourteen-volume
    // chronicle is the same defect as citing a homepage: it proves nothing and
    // nobody can check it. A locator is a number (hadith no. / aya / year), a
    // sub-reference after a dash (kitab, bab, tarjama, entry), or a \u00abquoted
    // entry title\u00bb. All 1785 satisfied this when the rule was added.
    if (!LOCATOR.test(s)) { src++; no('B8', q.id + ' src names a work but no place inside it'); }
  }
  if (!src) ok('all ' + rest.length + ' non-protected sources name a work AND a place inside it');

  // -- B9 the 394 protected questions --------------------------------------
  console.log('\n-- B9 protected questions (the load-bearing check) --');
  const liveProt = d.questions.filter(isProt);
  if (liveProt.length === g.protectedCount) ok('protected question count = ' + g.protectedCount);
  else no('B9', 'protected count = ' + liveProt.length + ' (golden ' + g.protectedCount + ')');
  let touched = 0;
  for (const q of liveProt) {
    const want = g.protected[q.id];
    if (!want) { touched++; no('B9', q.id + ' is protected but absent from the golden'); continue; }
    if (fingerprint(q) !== want) { touched++; no('B9', q.id + ' WAS EDITED -- protected questions are frozen at commit 17bb52a'); }
  }
  for (const id of Object.keys(g.protected)) {
    if (!d.questions.some(q => q.id === id)) { touched++; no('B9', id + ' disappeared from the bank'); }
  }
  if (!touched) ok('all ' + g.protectedCount + ' protected questions are byte-for-byte unchanged');

  // -- B10 the sealed thirteen ---------------------------------------------
  // No `if git`, no `try`. Every file is opened and hashed on every run, and the
  // count of what was actually hashed is printed so a silent skip is impossible
  // to mistake for a pass.
  console.log('\n-- B10 sealed files (unconditional: no git, no skip) --');
  const sealNames = Object.keys(SEALED);
  let sealed = 0, sealBad = 0;
  for (const f of sealNames) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) {
      sealBad++; no('B10', f + ' is ABSENT -- sealed as ' + SEALED[f]);
      continue;
    }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    sealed++;
    if (h !== SEALED[f]) {
      sealBad++;
      no('B10', f + ' MOVED');
      console.log('         sealed ' + SEALED[f]);
      console.log('         actual ' + h);
    }
  }
  console.log('  sealed files hashed: ' + sealed + '/' + sealNames.length);
  if (sealed !== sealNames.length) no('B10', 'only ' + sealed + ' of ' + sealNames.length + ' sealed files were readable');
  if (!sealBad) ok('all ' + sealNames.length + ' sealed files are byte-for-byte unchanged');

  // -- B11 the service worker's data-file policy, EXECUTED -----------------
  console.log('\n-- B11 service worker: data files must revalidate (item 80) --');
  const swPath = path.join(__dirname, SW_FILE);
  if (!fs.existsSync(swPath)) {
    no('B11', SW_FILE + ' is ABSENT -- the data-file policy cannot be executed');
  } else {
    // The cache name. Discovered by running the worker, not by reading a line.
    const probe = swLoad(swPath, () => Promise.resolve(swRes('NET')));
    if (!probe.hasFetchListener()) {
      no('B11', SW_FILE + ' registered no fetch listener -- nothing to assert');
    } else {
      probe.dispatch(SW_DATA_FILES[0]);
      await new Promise((r) => setTimeout(r, 0));
      const name = probe.opened[0];
      if (name === SW_CACHE) ok('service worker opens cache "' + SW_CACHE + '"');
      else no('B11', 'service worker opens cache ' + JSON.stringify(name) + ' -- SW_CACHE says "'
        + SW_CACHE + '". Re-cut both together, or the ship is invisible to every returning reader.');

      // Every data file, one at a time. A class assertion that only ever ran on
      // adhkar.json would not have caught worship-display.json.
      let stale = 0, frozen = 0, fragile = 0;
      for (const f of SW_REVALIDATED) {
        // (1) a HIT is served from the cache AND a background fetch is issued.
        const h = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        h.seed(name, f, 'OLD');
        const before = h.fetches();
        const d1 = h.dispatch(f);
        if (!d1.responded) { stale++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b1 = await swBody(d1.responded);
        if (b1 !== 'OLD') { stale++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b1) + ')'); }
        if (h.fetches() - before !== 1) {
          stale++;
          no('B11', f + ' was served from the cache with NO revalidation fetch (' + (h.fetches() - before)
            + '). This is item 80: a changed file stays frozen on every device until the cache name is bumped.');
        }
        if (!d1.waits.length) {
          stale++;
          no('B11', f + ' handed its revalidation to nothing -- the worker may be killed before the write lands');
        }

        // (2) the read AFTER the file changed returns the new bytes.
        await swSettle(d1.waits);
        if (h.peek(name, f) !== 'NEW') { frozen++; no('B11', f + ' revalidation never wrote the new bytes into the cache'); }
        const b2 = await swBody(h.dispatch(f).responded);
        if (b2 !== 'NEW') { frozen++; no('B11', f + ' still serves the old bytes after revalidation (' + JSON.stringify(b2) + ')'); }

        // (3) a FAILED fetch keeps the stored copy and raises nothing at the page.
        const hx = swLoad(swPath, () => Promise.reject(new Error('offline')));
        hx.seed(name, f, 'OLD');
        const d3 = hx.dispatch(f);
        let raised = null;
        await Promise.resolve(d3.responded).catch((e) => { raised = e; });
        if (raised) { fragile++; no('B11', f + ' let a network failure reach the page: ' + raised.message); }
        if (await swBody(d3.responded) !== 'OLD') { fragile++; no('B11', f + ' did not serve the stored copy while offline'); }
        for (const w of d3.waits) {
          await Promise.resolve(w).catch((e) => { fragile++; no('B11', f + ' revalidation promise rejected: ' + e.message); });
        }
        if (hx.peek(name, f) !== 'OLD') {
          fragile++;
          no('B11', f + ' LOST its stored copy to a failed fetch -- a reader with no network loses the file entirely');
        }
      }
      if (!stale) ok('all ' + SW_REVALIDATED.length + ' revalidating data files are served from cache AND revalidated in the background');
      if (!frozen) ok('all ' + SW_REVALIDATED.length + ' revalidating data files serve the NEW bytes on the read after a change');
      if (!fragile) ok('all ' + SW_REVALIDATED.length + ' revalidating data files survive a dead network with the stored copy intact');

      // ITEM 90: the excluded pair. Served from the store, and NEVER revalidated. A background
      // fetch here is 2.4 MB of a reader's data spent on bytes a sha256 already guarantees.
      let leaked = 0;
      for (const f of SW_SEALED_DATA) {
        const s = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        s.seed(name, f, 'OLD');
        const before = s.fetches();
        const d = s.dispatch(f);
        if (!d.responded) { leaked++; no('B11', f + ' is not handled by the worker at all'); continue; }
        const b = await swBody(d.responded);
        if (b !== 'OLD') { leaked++; no('B11', f + ' did not serve the STORED copy (got ' + JSON.stringify(b) + ')'); }
        const spent = s.fetches() - before;
        if (spent !== 0) {
          leaked++;
          no('B11', f + ' is sealed and excluded from revalidation, but the worker still issued '
            + spent + ' background fetch(es). Item 90: that is a phone re-downloading bytes that\n'
            + '        cannot have changed without breaking the seal above.');
        }
      }
      if (!leaked) ok('both sealed mushaf files are served from cache with ZERO revalidation fetch (item 90)');

      // ITEM 93: a precache entry that fails is COUNTED and NAMED. One CORE entry is made to
      // reject; install must still settle, and the worker must afterwards be able to say which
      // entry it lost. Silence here is how a reader ends up offline in front of a blank screen.
      const VICTIM = '/adhkar.json';
      const noisy = swLoad(swPath, () => Promise.resolve(swRes('NEW')), (u) => u === VICTIM);
      const inst = noisy.install();
      if (inst.missing) no('B11', SW_FILE + ' registered no install listener -- nothing to precache');
      else {
        let installRejected = null;
        for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { installRejected = e; }); }
        if (installRejected) {
          no('B11', 'a failed precache entry REJECTED install (' + installRejected.message + '). The\n'
            + '        worker never activates, so a phone with a full disk keeps the OLD build forever.');
        } else ok('a failed precache entry does not reject install (item 93)');
        const rec = noisy.self.ezikPrecacheFailures;
        if (!rec || typeof rec.length !== 'number') {
          no('B11', 'a failed precache entry is recorded NOWHERE -- install completes one entry\n'
            + '        short with nothing counted and nothing logged. This is item 93.');
        } else if (rec.length !== 1) {
          no('B11', 'exactly one precache entry was made to fail; the worker counted ' + rec.length);
        } else if (String(rec[0] && rec[0].url) !== VICTIM) {
          no('B11', 'the failed entry was counted but not NAMED (got ' + JSON.stringify(rec[0])
            + ', expected ' + VICTIM + ')');
        } else ok('a failed precache entry raises the counter and records its name (item 93)');

        // The control. Without it, a recorder that reports a failure unconditionally would pass
        // every assertion above while measuring nothing.
        const clean = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
        const ci = clean.install();
        await swSettle(ci.waits);
        const cleanRec = clean.self.ezikPrecacheFailures || [];
        if (cleanRec.length !== 0) {
          no('B11', 'a precache in which every entry stored still recorded ' + cleanRec.length
            + ' failure(s) -- the counter is not measuring what it is named for');
        } else ok('a precache with every entry storing records no failure (item 93 control)');
      }

      // The policies item 80 must NOT have moved. Without these, "revalidate
      // everything" would pass B11 while doubling every asset request and
      // unfreezing the quest bank the testers depend on being fresh.
      let moved = 0;
      const asset = swLoad(swPath, () => Promise.resolve(swRes('NEW')));
      asset.seed(name, '/icon-192.png', 'OLDPNG');
      const da = asset.dispatch('/icon-192.png');
      if (await swBody(da.responded) !== 'OLDPNG' || asset.fetches() !== 0) {
        moved++; no('B11', 'a content-stable asset is no longer cache-first (fetches=' + asset.fetches() + ')');
      }
      if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch('/api/chat').responded) {
        moved++; no('B11', '/api/* is being intercepted -- a cached religious answer is a wrong answer');
      }
      if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch('/quest-data/trivia-golden.json').responded) {
        moved++; no('B11', 'the .json branch swallowed /quest-data/ -- testers would be frozen on an old bank');
      }
      const shell = swLoad(swPath, () => Promise.resolve(swRes('SHELL')));
      shell.seed(name, '/', 'OLDSHELL');
      if (await swBody(shell.dispatch('/', 'navigate').responded) !== 'SHELL') {
        moved++; no('B11', 'the app shell is no longer network-first');
      }
      if (!moved) ok('the four policies item 80 does not govern are untouched (asset / api / quest-data / shell)');
    }
  }

  // -- B12 the service worker's storage quota, EXECUTED (item 91-A) --------
  //
  // Four states, and the worker is asked what it DID in each: what it wrote, what it deleted,
  // what it recorded. Not one assertion below reads a line of sw.js. The states are the four
  // a reader actually meets -- room to spare, no room before the first byte, room that runs out
  // half way through, and a browser too old to have been asked.
  console.log('\n-- B12 service worker: storage quota management (item 91-A) --');
  if (!fs.existsSync(swPath)) {
    no('B12', SW_FILE + ' is ABSENT -- the quota policy cannot be executed');
  } else {
    const OLD_STORE = 'ezik-v6';
    const WIDE = { quota: 500 * 1024 * 1024, usage: 1024 * 1024 };
    // Free space measured in kilobytes against a CORE measured in megabytes. Narrow by
    // arithmetic, not by a number chosen to sit under a threshold this guard also owns.
    const NARROW = { quota: 2 * 1024 * 1024, usage: 2 * 1024 * 1024 - 64 * 1024 };
    const settle = async (r) => { await swSettle(r.waits); };

    // ---- STATE 1: a wide quota. CORE is stored WHOLE, and persistence is asked for once. ----
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (inst.missing) no('B12', SW_FILE + ' registered no install listener');
      else if (rejected) no('B12', 'a WIDE quota install rejected: ' + rejected.message);
      else {
        const name = h.opened[0];
        const missing = SW_CORE.filter((u) => !h.has(name, u));
        if (missing.length) {
          no('B12', 'with room to spare the worker stored only ' + (SW_CORE.length - missing.length)
            + ' of ' + SW_CORE.length + ' CORE entries; missing ' + missing.join(', ')
            + '.\n        Item 91-A must not cost the sane case a single file.');
        } else ok('a wide quota stores all ' + SW_CORE.length + ' CORE entries (91-A costs the sane case nothing)');
        const rec = h.self.ezikPrecacheFailures || [];
        if (rec.length) no('B12', 'a wide-quota install recorded ' + rec.length + ' failure(s)');
        if (!st) {
          no('B12', 'the worker exposes no storage record at all -- a page cannot tell a full\n'
            + '        disk from a dead network, which is the whole of item 91-A part 3.');
        } else {
          if (nav.calls.estimate < 1) {
            no('B12', 'navigator.storage.estimate() was NEVER called before the first write.\n'
              + '        The worker writes into a store it has not measured -- item 91-A part 1.');
          } else ok('the worker estimates the quota before it writes (' + nav.calls.estimate + ' call(s))');
          if (nav.calls.persist !== 1) {
            no('B12', 'navigator.storage.persist() was called ' + nav.calls.persist
              + ' time(s); item 91-A part 2 says exactly once.');
          } else if (st.persist !== 'granted') {
            no('B12', 'persist() resolved TRUE and the worker recorded ' + JSON.stringify(st.persist));
          } else ok('the worker asks for persistence exactly once and records the grant');
          if (st.precacheSkipped !== null) {
            no('B12', 'a wide quota still skipped the precache (' + JSON.stringify(st.precacheSkipped) + ')');
          }
          const est = st.estimate;
          if (!est || typeof est.need !== 'number' || typeof est.free !== 'number') {
            no('B12', 'the estimate was taken but not RECORDED (' + JSON.stringify(est) + ')');
          } else if (est.need <= 0) {
            no('B12', 'the worker needs ' + est.need + ' bytes for CORE -- a threshold of zero\n'
              + '        is a pre-check that can never refuse anything.');
          } else ok('the estimate is recorded with the need it was measured against (' + est.need + ' bytes)');
        }
      }
    }

    // ---- STATE 2: too narrow to start. NOTHING is written, and the reason is recorded. ----
    {
      const nav = swNav(NARROW);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B12', 'a NARROW quota REJECTED install (' + rejected.message + '). The worker never\n'
          + '        activates, so the phone keeps the old build forever -- item 93 in reverse.');
      } else ok('a quota too narrow for CORE still settles install (the worker activates)');
      const attempted = h.adds();
      if (attempted.length !== 0) {
        no('B12', 'the worker began writing anyway: ' + attempted.length + ' cache.add call(s) into a\n'
          + '        store measured too small to hold CORE. Item 91-A part 1 says the write does\n'
          + '        not START -- otherwise the failure list fills with one entry per file and the\n'
          + '        disk ends exactly as full as it began.');
      } else ok('a quota too narrow for CORE writes NOTHING (no cache.add is attempted)');
      if (!st || st.precacheSkipped !== 'quota') {
        no('B12', 'the skipped precache recorded ' + JSON.stringify(st && st.precacheSkipped)
          + ', not "quota". A silent skip is indistinguishable from a worker that did its job.');
      } else ok('the skip is recorded as a quota decision, readable by the page');
      const est = st && st.estimate;
      if (!est || typeof est.free !== 'number' || typeof est.need !== 'number' || !(est.free < est.need)) {
        no('B12', 'the refusal is not backed by a recorded measurement (' + JSON.stringify(est) + ')');
      } else ok('the refusal carries its arithmetic: ' + est.free + ' free < ' + est.need + ' needed');
      const rec = h.self.ezikPrecacheFailures || [];
      if (rec.length !== 0) {
        no('B12', 'the skipped precache still recorded ' + rec.length + ' per-entry failure(s) --\n'
          + '        the skip is supposed to REPLACE that list, not populate it');
      } else ok('a skipped precache records no per-file failures (one decision, not seven)');
    }

    // ---- STATE 3: the disk fills MID-WRITE. Old stores go, the current one never does. ----
    {
      const nav = swNav(WIDE);
      // Fails every add until an eviction has happened, then stops failing. A retry that was
      // never going to be needed proves nothing; this one only succeeds because room was made.
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u, ctx) => (ctx.deleted.length === 0 ? 'quota' : false), nav.navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      const gone = h.deleted();
      if (rejected) no('B12', 'a mid-write quota failure REJECTED install (' + rejected.message + ')');
      else ok('a disk that fills mid-write still settles install');
      if (gone.indexOf(SW_CACHE) !== -1) {
        no('B12', 'the worker deleted its OWN store "' + SW_CACHE + '" to make room for it.\n'
          + '        That trades the entries already written for the space to write them again,\n'
          + '        and takes the offline fallback down with them.');
      } else ok('the eviction never touches the current store "' + SW_CACHE + '"');
      if (gone.indexOf(OLD_STORE) === -1) {
        no('B12', 'a full disk did not evict the stale store "' + OLD_STORE + '" (deleted: '
          + JSON.stringify(gone) + '). Item 91-A part 4: old stores go FIRST, and nothing else\n'
          + '        on the device is the worker\'s to free.');
      } else ok('a full disk evicts the stale store "' + OLD_STORE + '" first');
      if (!st || !(st.evicted > 0)) no('B12', 'the eviction is not recorded (evicted=' + (st && st.evicted) + ')');
      if (!st || !(st.retried > 0)) {
        no('B12', 'nothing was retried after the eviction (retried=' + (st && st.retried) + ').\n'
          + '        Making room and then not using it leaves the reader exactly where they were.');
      } else ok('the entry is retried after the eviction (' + st.retried + ' retry/retries)');
      const name = h.opened[0];
      const stored = SW_CORE.filter((u) => h.has(name, u));
      if (stored.length !== SW_CORE.length) {
        no('B12', 'after evicting and retrying, only ' + stored.length + ' of ' + SW_CORE.length
          + ' CORE entries landed');
      } else ok('after the eviction the retry stores all ' + SW_CORE.length + ' CORE entries');
    }

    // ---- STATE 3b: the retry ALSO fails. Recorded ONCE, named, and with its reason. ----
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'quota' : false), nav.navigator);
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const rec = h.self.ezikPrecacheFailures || [];
      const mine = rec.filter((r) => r && r.url === '/adhkar.json');
      if (mine.length !== 1) {
        no('B12', 'an entry that failed twice (write, then retry) was recorded ' + mine.length
          + ' time(s); a page reading the count would see the same file twice.');
      } else if (mine[0].reason !== 'quota') {
        no('B12', 'a QuotaExceededError was filed under reason ' + JSON.stringify(mine[0].reason)
          + '. Item 91-A part 3: the reason is what tells a full disk from a dead tunnel.');
      } else ok('an entry whose retry also fails is recorded once, named, and reasoned "quota"');
    }

    // ---- STATE 3c: a NETWORK failure must not evict anything. ----
    // The eviction rule is a response to a full disk. Firing it at a dead network would cost a
    // reader the store they still have in exchange for bytes no deletion can produce.
    {
      const nav = swNav(WIDE);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'network' : false), nav.navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const gone = h.deleted();
      const rec = (h.self.ezikPrecacheFailures || []).filter((r) => r && r.url === '/adhkar.json');
      if (gone.length !== 0) {
        no('B12', 'a NETWORK failure evicted ' + JSON.stringify(gone) + '. Deleting a stale store\n'
          + '        cannot conjure bytes off a dead network; it only costs the reader what they had.');
      } else ok('a network failure evicts nothing (the eviction rule answers a full disk only)');
      if (mineReason(rec) !== 'network') {
        no('B12', 'a failed fetch was filed under reason ' + JSON.stringify(mineReason(rec))
          + ' instead of "network" -- the two reasons ask opposite things of the reader.');
      } else ok('a failed fetch is recorded with reason "network"');
    }

    // ---- STATE 4: no navigator.storage at all. The worker behaves as it did before 91-A. ----
    // An old browser must not be turned into a worker that caches nothing by a quota check it
    // cannot answer. This is the state that makes 'unknown' mean WRITE.
    {
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, undefined);
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B12', 'a browser with no navigator.storage made install REJECT (' + rejected.message
          + '). The quota check has to be optional or it is a new way to strand a phone.');
      } else ok('a browser with no navigator.storage still settles install');
      const name = h.opened[0];
      const missing = SW_CORE.filter((u) => !h.has(name, u));
      if (missing.length) {
        no('B12', 'with no navigator.storage the worker stored only ' + (SW_CORE.length - missing.length)
          + ' of ' + SW_CORE.length + ' CORE entries (missing ' + missing.join(', ') + ').\n'
          + '        An unmeasurable quota must mean WRITE, exactly as before item 91-A.');
      } else ok('with no navigator.storage all ' + SW_CORE.length + ' CORE entries are still stored');
      if (!st || st.estimate !== 'unavailable' || st.persist !== 'unavailable') {
        no('B12', 'the missing API was not recorded as unavailable (estimate='
          + JSON.stringify(st && st.estimate) + ', persist=' + JSON.stringify(st && st.persist) + ')');
      } else ok('the absent API is recorded as "unavailable", not as a failure');
    }

    // ---- STATE 2 -> activate: the sweep frees the space, and the retry uses it. ----
    // Without this the quota skip would be a NEW way to strand a reader: install writes nothing,
    // activate sweeps the old store, and the device is left holding neither.
    {
      let free = NARROW.quota - NARROW.usage;
      const navigator = { storage: {
        estimate: () => Promise.resolve({ quota: NARROW.quota, usage: NARROW.quota - free }),
        persist: () => Promise.resolve(true),
      } };
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, navigator);
      h.seedStore(OLD_STORE);
      const inst = h.install();
      await swSettle(inst.waits);
      // The sweep in activate is what frees the room, so the estimate it re-takes must see it.
      free = WIDE.quota - WIDE.usage;
      const act = h.activate();
      if (act.missing) no('B12', SW_FILE + ' registered no activate listener');
      else {
        await swSettle(act.waits);
        const st = h.storage();
        const name = h.opened[0];
        const stored = SW_CORE.filter((u) => h.has(name, u));
        if (h.deleted().indexOf(SW_CACHE) !== -1) {
          no('B12', 'activate deleted the CURRENT store "' + SW_CACHE + '"');
        }
        if (stored.length !== SW_CORE.length) {
          no('B12', 'a quota-skipped install was never retried after activate swept the old\n'
            + '        store: only ' + stored.length + ' of ' + SW_CORE.length + ' CORE entries are\n'
            + '        present, so the reader holds an empty new cache and no old one.');
        } else ok('a quota-skipped install is retried once activate has swept the old store');
        if (!st || st.activateRetry !== 'done') {
          no('B12', 'the post-activate retry is not recorded (activateRetry='
            + JSON.stringify(st && st.activateRetry) + ')');
        } else ok('the post-activate retry is recorded on the same channel');
      }
    }

    // ---- ITEM 112. CORE_BYTES IS DERIVED HERE, NOT REMEMBERED THERE. ------
    //
    // WHAT STOOD HERE. This block used to accept any CORE_BYTES that was GREATER THAN OR EQUAL
    // TO what CORE weighs -- `Number(m[1]) < onDisk` was the only failure. That caught the shell
    // growing and nothing else, and it was half a check in both directions:
    //   * a file SHRINKING left the constant silently overstating CORE, so CORE_NEED (1.5x)
    //     became stricter than the files justify and install could refuse to write on a phone
    //     that had the room. Nothing anywhere went red.
    //   * a constant cut by hand from the comment table beside it could be wrong from birth and
    //     still pass, as long as it erred high.
    // Merge round (b) of 2026-08-21 is the measured case: the branch declared 1634924, the merge
    // weighed 1644371, and the 9447-byte difference was index.html growing on the other side.
    // Neither branch was broken. A hand-copied measurement of seven files that two people edit
    // cannot survive, so it is no longer copied: tools/core-bytes.cjs writes it, and this asserts
    // it EXACTLY, in both directions, on every gate run.
    //
    // AND IT IS NOT THE TOOL'S OWN ARITHMETIC READ BACK. This parses CORE out of sw.js with its
    // own reader and maps it to disk with its own rule; a bug shared with the tool would have to
    // be written twice, in two files, in two shapes. The hand-written SW_CORE / SW_CORE_FILES
    // above are then asserted AGAINST that parse, so the copy the rest of B12 drives cannot drift
    // from the list the worker actually installs.
    {
      const src = fs.readFileSync(swPath, 'utf8');
      let parsed = null, parseError = null;
      try {
        const at = src.indexOf('const CORE = [');
        if (at === -1) throw new Error('sw.js declares no `const CORE = [` array');
        const open = src.indexOf('[', at);
        const close = src.indexOf('];', open);
        if (close === -1) throw new Error('the CORE array is never closed');
        // CORE carries prose between its entries; a scan that did not strip it would collect a
        // path quoted inside a sentence as though the worker precached it.
        const body = src.slice(open + 1, close).replace(/\/\/[^\n]*/g, '');
        parsed = [...body.matchAll(/'([^']*)'/g)].map((mm) => mm[1]);
        if (!parsed.length) throw new Error('the CORE array holds no entries');
      } catch (e) { parseError = e; }

      if (parseError) {
        no('B12', 'CORE could not be read out of ' + SW_FILE + ' (' + parseError.message + ').\n'
          + '        Without the worker\'s own list there is nothing to weigh, and the constant\n'
          + '        below becomes unfalsifiable rather than merely wrong.');
      } else {
        if (JSON.stringify(parsed) !== JSON.stringify(SW_CORE)) {
          no('B12', 'SW_CORE is ' + JSON.stringify(SW_CORE) + ' but the worker precaches\n'
            + '        ' + JSON.stringify(parsed) + '. Every B12 state above drives the FIRST list;\n'
            + '        while they differ, this gate is asserting about a CORE nobody installs.');
        } else ok('SW_CORE is still the list sw.js precaches (' + parsed.length + ' entries, read from the worker)');

        const derived = parsed.map((u) => (u === '/' ? 'index.html' : u.replace(/^\//, '')));
        if (JSON.stringify(derived) !== JSON.stringify(SW_CORE_FILES)) {
          no('B12', 'CORE maps to ' + JSON.stringify(derived) + ' on disk, but SW_CORE_FILES says\n'
            + '        ' + JSON.stringify(SW_CORE_FILES) + '. The byte sum below would then weigh\n'
            + '        files the worker does not store -- a pre-check measured against the wrong\n'
            + '        seven files fails nothing and protects nothing.');
        } else ok('CORE maps onto the files SW_CORE_FILES names (\'/\' -> index.html, the rest by path)');

        let onDisk = 0;
        const unreadable = [];
        for (const f of derived) {
          const p = path.join(__dirname, f);
          if (!fs.existsSync(p)) { unreadable.push(f); continue; }
          onDisk += fs.statSync(p).size;
        }
        const m = src.match(/CORE_BYTES\s*=\s*(\d+)/);
        if (unreadable.length) {
          no('B12', 'CORE names ' + unreadable.join(', ') + ', which is not on disk');
        } else if (!m) {
          no('B12', 'sw.js declares no CORE_BYTES constant -- the pre-check has no measured size\n'
            + '        to compare a quota against, so nothing pins it to the files it describes.');
        } else if (Number(m[1]) !== onDisk) {
          const drift = onDisk - Number(m[1]);
          no('B12', 'CORE_BYTES = ' + m[1] + ' but CORE weighs ' + onDisk + ' bytes on disk ('
            + (drift > 0 ? '+' : '') + drift + ').\n'
            + '        The quota pre-check is measured against a number that stopped being true.\n'
            + '        Repair it with `node tools/core-bytes.cjs --write` and re-cut the sw.js\n'
            + '        digest in the SAME commit -- never by hand from the comment table.');
        } else ok('CORE_BYTES (' + m[1] + ') equals the ' + onDisk + ' bytes CORE weighs on disk, exactly');
      }
    }
  }

  // -- B14 EVERY NUMBER sw.js's PROSE STATES IS TRUE OF THE DISK (item 115-ب) ---
  //
  // WHAT STOOD HERE: nothing. B12 above re-derives ONE number, CORE_BYTES. The worker also states
  // eleven other measurements in its comments -- the size of each CORE file, the two mushaf files,
  // the three revalidating data files -- and not one of them was read by anything.
  //
  // The 2026-08-21 inventory measured the damage. The CORE table in the comment said index.html
  // weighed 1059309 when it weighed 1068756, and the 9447-byte difference was the SAME drift that
  // had stopped the merge round. Whoever re-cut the constant fixed the NUMBER and left the TABLE
  // IT IS DERIVED FROM saying something else. A comment that lies is not a cosmetic defect here:
  // it is the input the next person re-cuts CORE_BYTES from.
  //
  // So the prose is a contract. Each claim below names the file it measures; the size is read off
  // the disk and compared exactly, in both directions. And COMPLETENESS is asserted too: any
  // integer of 500 or more appearing in a sw.js comment which is not in this table -- or in the
  // short list of things that are not measurements at all, each with its reason -- is a failure.
  // A new number cannot enter the worker's prose without being registered here, which is the only
  // way a table like this survives longer than one commit.
  {
    const swProseSrc = fs.readFileSync(path.join(__dirname, SW_FILE), 'utf8');
    const swComments = swProseSrc.split(/\r?\n/)
      .map((line) => { const c = line.indexOf('//'); return c === -1 ? '' : line.slice(c); })
      .join('\n');

    // ITEM 33 added a third claim shape. The 604 page scans are not one file and not a short
    // list of them -- naming all 604 here would be a table nobody can read -- so the claim names
    // the DIRECTORY and the number is derived by counting and summing whatever is in it.
    const MUSHAF_DIR = 'assets/madina-hafs';
    const MUSHAF_PAGE_FILE = /^page-\d{3}\.webp$/;
    const mushafPageSizes = () => {
      const dir = path.join(__dirname, MUSHAF_DIR);
      if (!fs.existsSync(dir)) return null;
      return fs.readdirSync(dir).filter((f) => MUSHAF_PAGE_FILE.test(f)).sort()
        .map((f) => fs.statSync(path.join(dir, f)).size);
    };

    //  { n, of }           n is the byte size of that file on disk
    //  { n, sum: [a, b] }  n is the byte sum of those files on disk
    //  { n, dir: 'count' | 'sum' | 'mean' }   n is that statistic over the mushaf page scans
    const SW_PROSE = [
      { n: 122884, of: 'index.html' },
      // ITEM 32. The three CORE entries the CDN removal added, each stated in the worker's own
      // byte table and each re-derived here from the file it names.
      { n: 1082779, of: 'app.js' },
      { n: 131835, of: 'vendor/react-dom.umd.js' },
      { n: 10751, of: 'vendor/react.umd.js' },
      { n: 368386, of: 'icon-watermark.png' },
      { n: 177392, of: 'adhkar.json' },
      { n: 12893, of: 'icon-512.png' },
      { n: 5938, of: 'icon-maskable-512.png' },
      { n: 5053, of: 'icon-192.png' },
      { n: 533, of: 'manifest.json' },
      { n: 1412005, of: 'quran-uthmani.json' },
      { n: 996528, of: 'mushaf-layout.json' },
      { n: 18132, of: 'worship-display.json' },
      { n: 2408533, sum: ['quran-uthmani.json', 'mushaf-layout.json'] },
      // ITEM 33. The three the page-cap prose states, each re-derived from the directory.
      { n: 604, dir: 'count' },
      { n: 66012516, dir: 'sum' },
      { n: 109292, dir: 'mean' },
    ];

    // Integers in the prose that are NOT a measurement of a file, each with the reason it cannot
    // be checked. This is item 115-ب's third column -- declared uncheckable, in writing, rather
    // than left standing as something a reader would take for a fact.
    const SW_PROSE_NOT_MEASUREMENTS = {
      512: 'a fragment of the filenames icon-512.png and icon-maskable-512.png, not a size',
      298686: 'a SUPERSEDED transfer size for the shell. A transfer size depends on the CDN encoder, '
        + 'its settings and its version, none of which are in this tree, so nothing here can ever '
        + 'check it. It survives in the prose only to record what was removed and why.',
      338409: 'a SUPERSEDED transfer size for quran-uthmani.json -- same reason.',
      151653: 'a SUPERSEDED transfer size for mushaf-layout.json -- same reason.',
    };

    let proseBad = 0;
    for (const claim of SW_PROSE) {
      const files = claim.dir ? [] : (claim.sum || [claim.of]);
      let label = claim.dir ? (MUSHAF_DIR + ' ' + claim.dir)
        : (claim.sum ? claim.sum.join(' + ') : claim.of);
      let total = 0;
      let missing = null;
      if (claim.dir) {
        const sizes = mushafPageSizes();
        if (!sizes || !sizes.length) missing = MUSHAF_DIR;
        else {
          const sum = sizes.reduce((a, b) => a + b, 0);
          total = claim.dir === 'count' ? sizes.length
            : claim.dir === 'sum' ? sum
              : Math.floor(sum / sizes.length);
        }
      }
      for (const name of files) {
        const p = path.join(__dirname, name);
        if (!fs.existsSync(p)) { missing = name; break; }
        total += fs.statSync(p).size;
      }
      if (missing) {
        proseBad++;
        no('B14', label + ' is named in sw.js prose and ' + missing + ' is not on disk');
        continue;
      }
      if (!new RegExp('\\b' + claim.n + '\\b').test(swComments)) {
        proseBad++;
        no('B14', 'sw.js prose no longer states ' + claim.n + ' for ' + label + '.\n'
          + '        Either the sentence was rewritten and this table was not, or the measurement\n'
          + '        was dropped from the worker while the table still claims it is there.');
        continue;
      }
      if (total !== claim.n) {
        proseBad++;
        no('B14', 'sw.js prose says ' + label + ' is ' + claim.n + ' bytes; the disk says ' + total
          + ' (' + (total > claim.n ? '+' : '') + (total - claim.n) + ').\n'
          + '        A comment that states a size is what the next person re-cuts CORE_BYTES from,\n'
          + '        so it is wrong in exactly the way the constant used to be.');
      }
    }
    if (!proseBad) {
      ok('every size sw.js states in prose is true of the disk (' + SW_PROSE.length + ' claims)');
    }

    // COMPLETENESS. A table of claims that does not know what it has missed goes quiet the first
    // time somebody writes a new number into the worker.
    const knownNumbers = new Set(SW_PROSE.map((c) => c.n));
    const excusedNumbers = new Set(Object.keys(SW_PROSE_NOT_MEASUREMENTS).map(Number));
    const unregistered = [];
    for (const mm of swComments.matchAll(/\b(\d{3,})\b/g)) {
      const v = Number(mm[1]);
      if (v < 500) continue;
      if (knownNumbers.has(v) || excusedNumbers.has(v)) continue;
      if (unregistered.indexOf(v) === -1) unregistered.push(v);
    }
    if (unregistered.length) {
      no('B14', 'sw.js prose states ' + unregistered.join(', ') + ' and nothing checks it.\n'
        + '        Register each one in SW_PROSE with the file it measures, or in\n'
        + '        SW_PROSE_NOT_MEASUREMENTS with the reason it cannot be checked. There is no\n'
        + '        third option: a number in this worker that nothing re-measures is the defect\n'
        + '        item 115-ب was raised to end.');
    } else {
      ok('no unregistered number of 500 or more survives in sw.js prose ('
        + excusedNumbers.size + ' declared uncheckable, each with its reason)');
    }
  }

  // -- B13 the service worker's END-OF-INSTALL REPORT, EXECUTED (item 93-b) --
  //
  // Item 93 made a failed precache entry countable and nameable; 91-A gave it a reason. Both
  // left the record behind a REQUEST, so a page learns its offline store is short an entry only
  // if it thinks to ask -- and the readers who never ask are exactly the ones who meet the gap
  // with no network. 93-b pushes the brief at the end of install instead.
  //
  // FOUR STATES, and the worker is asked what it SENT in each: a clean install, one entry down,
  // several entries down, and NOBODY LISTENING. The fourth is the one that decides whether this
  // is a feature or a new way to strand a phone: the first install of a new worker routinely
  // runs before any page is controlled, so an empty client list is the healthiest install there
  // is and must cost nothing at all.
  console.log('\n-- B13 service worker: the end-of-install report (item 93-b) --');
  if (!fs.existsSync(swPath)) {
    no('B13', SW_FILE + ' is ABSENT -- the report channel cannot be executed');
  } else {
    const WIDE13 = { quota: 500 * 1024 * 1024, usage: 1024 * 1024 };
    const NARROW13 = { quota: 2 * 1024 * 1024, usage: 2 * 1024 * 1024 - 64 * 1024 };
    const reportsOf = (h) => h.posted().map((p) => p.message).filter((m) => m && m.ezik === SW_REPORT_TAG);

    // ---- STATE 1: everything stored. The page is told so, unasked. ----------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 1 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'a clean install REJECTED once it had a report to send: ' + rejected.message);
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'a clean install sent ' + reports.length + ' report(s) to 1 listening client.\n'
          + '        Item 93-b is the PUSH: a record that still has to be asked for is item 93,\n'
          + '        and item 93 is the state a reader already meets with no network.');
      } else {
        const r = reports[0];
        if (r.failed !== 0 || (r.entries && r.entries.length !== 0)) {
          no('B13', 'a clean install reported ' + r.failed + ' failure(s) and '
            + JSON.stringify(r.entries) + '. A report that cries on a healthy install is a report\n'
            + '        the page learns to ignore before the first real one arrives.');
        } else ok('a clean install hands every client a report saying nothing failed');
        if (r.skipped !== null) {
          no('B13', 'a clean install reported skipped=' + JSON.stringify(r.skipped));
        } else ok('...and it carries what install DECIDED, not only what it counted');
        const st = h.storage();
        if (!st || st.announced !== 1) {
          no('B13', 'the announcement is not recorded (announced=' + JSON.stringify(st && st.announced)
            + '). A page that asks must be able to tell "nothing failed" from "you were never told".');
        } else ok('the number of clients told is recorded on the storage channel');
        const calls = h.matchAllCalls();
        if (!calls.length || !calls[0] || calls[0].includeUncontrolled !== true) {
          no('B13', 'clients were looked up as ' + JSON.stringify(calls[0]) + '. On a FIRST install\n'
            + '        nothing is controlled yet, so without includeUncontrolled the page that just\n'
            + '        registered this worker -- the one that wants the brief -- is never found.');
        } else ok('the lookup includes uncontrolled clients (the first install has no controlled page)');
      }
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) no('B13', 'the report cost the precache ' + missing.length + ' entr(y/ies)');
    }

    // ---- STATE 2: one entry fails. It is named, with its reason. ------------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (u === '/adhkar.json' ? 'network' : false), nav.navigator, { count: 1 });
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'an install with one failed entry sent ' + reports.length + ' report(s)');
      } else {
        const r = reports[0];
        if (r.failed !== 1 || !Array.isArray(r.entries) || r.entries.length !== 1) {
          no('B13', 'one entry failed and the report said failed=' + r.failed + ', entries='
            + JSON.stringify(r.entries));
        } else if (r.entries[0].url !== '/adhkar.json') {
          no('B13', 'the failed entry was counted but not NAMED (' + JSON.stringify(r.entries[0]) + ').\n'
            + '        A count with no name tells a page that something is missing and not what.');
        } else if (r.entries[0].reason !== 'network') {
          no('B13', 'a failed fetch reached the page as reason ' + JSON.stringify(r.entries[0].reason)
            + '. "Your disk is full" and "you are offline" ask opposite things of a reader.');
        } else ok('a single failed entry reaches the page named and reasoned ("/adhkar.json", network)');
      }
    }

    // ---- STATE 3: several entries fail. ALL of them travel. -----------------
    // A report that carried only the first would be indistinguishable from a report of one
    // failure, and the difference is whether the store is short a file or short a shelf.
    {
      const nav = swNav(WIDE13);
      const down = ['/adhkar.json', '/icon-watermark.png', '/manifest.json'];
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')),
        (u) => (down.indexOf(u) !== -1 ? 'network' : false), nav.navigator, { count: 1 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'three failed entries REJECTED install: ' + rejected.message);
      const reports = reportsOf(h);
      const r = reports[0];
      if (reports.length !== 1 || !r) {
        no('B13', 'an install with three failed entries sent ' + reports.length + ' report(s)');
      } else if (r.failed !== down.length) {
        no('B13', 'three entries failed and the report counted ' + r.failed);
      } else {
        const named = (r.entries || []).map((e) => e.url).sort();
        if (JSON.stringify(named) !== JSON.stringify(down.slice().sort())) {
          no('B13', 'three entries failed and the report named ' + JSON.stringify(named)
            + '. Truncating the list makes "one file missing" and "three files missing" the same\n'
            + '        message at the page.');
        } else ok('every failed entry travels, not just the first (3 of 3 named)');
        const stored = SW_CORE.filter((u) => h.has(h.opened[0], u));
        if (stored.length !== SW_CORE.length - down.length) {
          no('B13', 'the report disagrees with the store: ' + stored.length + ' of '
            + SW_CORE.length + ' entries present against ' + r.failed + ' reported failures');
        } else ok('...and the report matches what the store actually holds');
      }
    }

    // ---- STATE 4: NOBODY IS LISTENING. The install is untouched. ------------
    // This is the normal first install, not an error state. If it costs anything -- a rejection,
    // an unstored entry, a recorded failure -- then 93-b has bought observability by making the
    // healthy case worse, which is a straight loss.
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 0 });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) {
        no('B13', 'an install with NO client rejected (' + rejected.message + '). The first install\n'
          + '        of a new worker routinely runs before any page is controlled; refusing it\n'
          + '        because nobody was listening strands the phone on the previous worker.');
      } else ok('an install with no client at all still settles (the worker activates)');
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) {
        no('B13', 'with no client listening the worker stored only ' + (SW_CORE.length - missing.length)
          + ' of ' + SW_CORE.length + ' CORE entries. The report must cost the precache nothing.');
      } else ok('...and all ' + SW_CORE.length + ' CORE entries are still stored');
      if (h.posted().length !== 0) no('B13', 'a report was posted to a client list that was empty');
      const rec = h.self.ezikPrecacheFailures || [];
      if (rec.length !== 0) {
        no('B13', 'an empty client list was recorded as ' + rec.length + ' precache failure(s).\n'
          + '        Nobody listening is not a precache problem and must not read as one.');
      } else ok('...and "nobody listening" is not recorded as a failure');
      const st = h.storage();
      if (!st || st.announced !== 0) {
        no('B13', 'an empty audience was recorded as ' + JSON.stringify(st && st.announced)
          + ' rather than 0 -- a page reading this cannot tell "nobody was there" from "we never tried".');
      } else ok('an empty audience is recorded as 0, distinctly from "unavailable"');
    }

    // ---- STATE 4b: the browser exposes no clients.matchAll at all. ----------
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { matchAll: false });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      const st = h.storage();
      if (rejected) {
        no('B13', 'a browser with no clients.matchAll made install REJECT (' + rejected.message
          + '). The push channel has to be optional or it is a new way to strand a phone.');
      } else ok('a browser with no clients.matchAll still settles install');
      const missing = SW_CORE.filter((u) => !h.has(h.opened[0], u));
      if (missing.length) no('B13', 'a missing clients API cost the precache ' + missing.length + ' entr(y/ies)');
      else ok('...and stores all ' + SW_CORE.length + ' CORE entries');
      if (!st || st.announced !== 'unavailable') {
        no('B13', 'the absent channel was recorded as ' + JSON.stringify(st && st.announced)
          + ', not "unavailable" -- so a page cannot tell a silent worker from a mute browser.');
      } else ok('the absent channel is recorded as "unavailable", not as a failure');
    }

    // ---- STATE 4c: one client throws on postMessage. The others still get it. ----
    {
      const nav = swNav(WIDE13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator,
        { count: 3, throwsOn: 'c1' });
      const inst = h.install();
      let rejected = null;
      for (const w of inst.waits) { await Promise.resolve(w).catch((e) => { rejected = e; }); }
      if (rejected) no('B13', 'one dead client REJECTED install: ' + rejected.message);
      const got = h.posted().map((p) => p.client).sort();
      if (JSON.stringify(got) !== JSON.stringify(['c0', 'c2'])) {
        no('B13', 'with one client throwing, the report reached ' + JSON.stringify(got)
          + ' instead of ["c0","c2"]. A page that navigated away mid-install must not cost the\n'
          + '        pages still open their copy.');
      } else ok('a client that throws on postMessage costs only itself the report');
      const st = h.storage();
      if (!st || st.announced !== 2) {
        no('B13', 'the announcement count is ' + JSON.stringify(st && st.announced)
          + ' where 2 of 3 clients were actually reached -- the record must count deliveries,\n'
          + '        not attempts, or it reports a page as told when it was not.');
      } else ok('...and the record counts deliveries, not attempts (2 of 3)');
    }

    // ---- STATE 5: the QUOTA SKIP announces too. -----------------------------
    // The skip is the state a reader most needs told about -- nothing was written at all -- and
    // it produces zero per-entry failures, so a report gated on `failed > 0` would be silent in
    // exactly the case it exists for.
    {
      const nav = swNav(NARROW13);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator, { count: 1 });
      const inst = h.install();
      for (const w of inst.waits) { await Promise.resolve(w).catch(() => {}); }
      const reports = reportsOf(h);
      if (reports.length !== 1) {
        no('B13', 'a quota-skipped install sent ' + reports.length + ' report(s). Nothing was\n'
          + '        written at all, which is the one outcome a reader cannot afford not to hear.');
      } else if (reports[0].skipped !== 'quota') {
        no('B13', 'the skipped install reported skipped=' + JSON.stringify(reports[0].skipped));
      } else if (reports[0].failed !== 0) {
        no('B13', 'the skipped install reported ' + reports[0].failed + ' per-entry failure(s); the\n'
          + '        skip REPLACES that list, and a page shown seven failures would hunt seven files.');
      } else ok('a quota-skipped install still reports, and reports the skip rather than seven failures');
    }
  }

  // -- B15 the 604 printed mushaf pages: their OWN store, capped (item 33) ---
  //
  // MEASURED BEFORE: sw.js named assets/madina-hafs nowhere at all, so every one of the 604 page
  // scans fell through to the generic same-origin cache-first arm and was written into CACHE --
  // unbounded, un-evicted, never estimated, and swept by activate on every version bump.
  //
  // B10 seals sw.js, and a seal would have blessed that forever. So this section RUNS the worker,
  // the same way B11 does, and asks it what it DOES with a page request. Three things are
  // asserted because three separate defects were measured, and each of them is a state the
  // harness drives rather than a line of source anybody quotes.
  console.log('\n-- B15 service worker: the printed mushaf pages are capped (item 33) --');
  if (!fs.existsSync(swPath)) {
    no('B15', SW_FILE + ' is ABSENT -- the mushaf page policy cannot be executed');
  } else {
    // Room for everything, so nothing below is passing only because an estimate declined.
    const WIDE15 = { quota: 4096 * 1024 * 1024, usage: 1024 * 1024 };
    // Less free than MUSHAF_MIN_FREE, and deliberately not zero: the state this drives is
    // "there is room for the page and it must still not be taken", not "the disk is full".
    const TIGHT15 = { quota: 100 * 1024 * 1024, usage: 80 * 1024 * 1024 };

    // (1) A PAGE GOES TO THE DEDICATED STORE, NOT THE SHIPMENT STORE.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      const d = h.dispatch(swPageUrl(1));
      const body = await swBody(d.responded);
      await swSettle(d.waits);
      if (!d.responded) {
        no('B15', swPageUrl(1) + ' is not handled by the worker at all -- it still falls through\n'
          + '        to the generic cache-first arm, which is the whole defect item 33 measured.');
      } else if (body !== 'PAGE') {
        no('B15', 'the page was not served from the network on a cold store (got '
          + JSON.stringify(body) + ')');
      } else if (!h.has(SW_MUSHAF_CACHE, swPageUrl(1))) {
        no('B15', 'the page was NOT stored in ' + JSON.stringify(SW_MUSHAF_CACHE) + '. The stores\n'
          + '        the worker opened were ' + JSON.stringify(h.stores()) + '.');
      } else if (h.has(SW_CACHE, swPageUrl(1))) {
        no('B15', 'the page was ALSO written into ' + JSON.stringify(SW_CACHE) + '. A copy in the\n'
          + '        shipment store is swept on the next bump and is exactly the megabytes item 33\n'
          + '        exists to stop re-downloading.');
      } else {
        ok('a printed page is stored in "' + SW_MUSHAF_CACHE + '", not in the shipment store');
      }
      // Cache-first, and it must not revalidate: a scan of a printed page cannot change.
      const h2 = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      h2.seedStore(SW_MUSHAF_CACHE);
      h2.seed(SW_MUSHAF_CACHE, swPageUrl(1), 'STORED');
      const before2 = h2.fetches();
      const d2 = h2.dispatch(swPageUrl(1));
      const body2 = await swBody(d2.responded);
      await swSettle(d2.waits);
      if (body2 !== 'STORED') {
        no('B15', 'a stored page was not served from the store (got ' + JSON.stringify(body2) + ')');
      } else if (h2.fetches() !== before2) {
        no('B15', 'a stored page still issued ' + (h2.fetches() - before2) + ' network fetch(es).\n'
          + '        These files are sealed scans; revalidation can only ever spend a reader\'s\n'
          + '        data plan to re-download bytes that cannot have changed.');
      } else {
        ok('...and a stored page is served from it with ZERO revalidation fetches');
      }
    }

    // (2) PAGE 61 EVICTS PAGE 1. The ceiling holds and the OLDEST is what goes.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      for (let n = 1; n <= SW_MUSHAF_CAP + 1; n++) {
        const d = h.dispatch(swPageUrl(n));
        await swBody(d.responded);
        await swSettle(d.waits);
      }
      const held = [];
      for (let n = 1; n <= SW_MUSHAF_CAP + 1; n++) if (h.has(SW_MUSHAF_CACHE, swPageUrl(n))) held.push(n);
      if (held.length > SW_MUSHAF_CAP) {
        no('B15', 'after reading ' + (SW_MUSHAF_CAP + 1) + ' pages the store holds ' + held.length
          + '. The ceiling is ' + SW_MUSHAF_CAP + ' pages; a store that only grows is the state\n'
          + '        measured before item 33, where paging the whole book wrote 66012516 bytes.');
      } else if (held.length < SW_MUSHAF_CAP) {
        no('B15', 'the store holds only ' + held.length + ' of ' + SW_MUSHAF_CAP + ' pages.\n'
          + '        An eviction rule that evicts more than it must is a reader re-downloading\n'
          + '        pages they already had; the ceiling is a ceiling, not a target.');
      } else if (held.indexOf(1) !== -1) {
        no('B15', 'page 1 survived and the store is full -- so the ceiling dropped something\n'
          + '        other than the LEAST RECENTLY USED entry. Held: ' + JSON.stringify(held));
      } else if (held.indexOf(SW_MUSHAF_CAP + 1) === -1) {
        no('B15', 'page ' + (SW_MUSHAF_CAP + 1) + ' -- the one just read -- is not in the store.\n'
          + '        A full store that refuses the NEW page instead of evicting the oldest has\n'
          + '        frozen the reader out of exactly the page they are looking at.');
      } else {
        ok('page ' + (SW_MUSHAF_CAP + 1) + ' evicts page 1: the store holds ' + SW_MUSHAF_CAP
          + ' pages, least-recently-used first out');
      }
      // The record must say so. A silent eviction is indistinguishable from a silent failure.
      const st = h.storage();
      const ms = st && st.mushaf;
      if (!ms || ms.evicted < 1) {
        no('B15', 'the eviction was not recorded (mushaf=' + JSON.stringify(ms) + '). Item 93 and\n'
          + '        93-b opened a channel precisely so a store that quietly loses entries cannot.');
      } else if (ms.failed !== 0) {
        no('B15', 'the run recorded ' + ms.failed + ' storage failure(s) on a healthy disk: '
          + JSON.stringify(ms.reason));
      } else {
        ok('...and the eviction is counted on the item 93 channel, with zero failures');
      }
    }

    // (3) A VERSION BUMP MUST NOT TAKE THE PAGES. The whole point of the separate store.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('NET')), null, nav.navigator);
      // The state a bump leaves behind: the PREVIOUS shipment store, still full, beside the
      // page store. The worker's own CACHE is the new one.
      const STALE = 'ezik-v0-superseded';
      h.seed(STALE, '/', 'OLD SHELL');
      h.seed(SW_MUSHAF_CACHE, swPageUrl(7), 'PAGE 7');
      const act = h.activate();
      if (act.missing) {
        no('B15', SW_FILE + ' registered no activate listener -- the sweep cannot be executed');
      } else {
        await swSettle(act.waits);
        const gone = !h.has(STALE, '/') || h.stores().indexOf(STALE) === -1;
        if (!gone) {
          no('B15', 'activate did NOT delete the superseded shipment store ' + JSON.stringify(STALE)
            + '.\n        The sweep is why a bump reaches a returning reader at all; item 33 narrows\n'
            + '        it by one name and must not disarm it.');
        } else if (h.stores().indexOf(SW_MUSHAF_CACHE) === -1 || !h.has(SW_MUSHAF_CACHE, swPageUrl(7))) {
          no('B15', 'activate DELETED ' + JSON.stringify(SW_MUSHAF_CACHE) + ' along with the\n'
            + '        superseded store. That is the defect item 33 exists to close: every ship threw\n'
            + '        away every page the reader had downloaded, of files that cannot change.\n'
            + '        Deleted: ' + JSON.stringify(h.deleted()));
        } else {
          ok('a version bump sweeps the superseded store and LEAVES "' + SW_MUSHAF_CACHE + '" intact');
        }
      }
    }

    // (4) NEARLY FULL DISK: the reader still gets the page, and nothing is written.
    {
      const nav = swNav(TIGHT15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator);
      let raised = null;
      const d = h.dispatch(swPageUrl(3));
      const body = await swBody(d.responded).catch((e) => { raised = e; return undefined; });
      for (const w of d.waits) await Promise.resolve(w).catch((e) => { raised = e; });
      const st = h.storage();
      const ms = st && st.mushaf;
      if (raised) {
        no('B15', 'a nearly-full disk raised an error at the page: ' + raised.message
          + '.\n        The reader asked for a page of the Qur\'an, not for a storage report.');
      } else if (body !== 'PAGE') {
        no('B15', 'a nearly-full disk cost the reader the page itself (got ' + JSON.stringify(body)
          + '). The estimate governs the WRITE; the read is not its business.');
      } else if (h.has(SW_MUSHAF_CACHE, swPageUrl(3))) {
        no('B15', 'the page was stored anyway on a disk with less free space than the floor.\n'
          + '        An estimate that does not change what happens is not a check.');
      } else if (!ms || ms.skipped !== 1) {
        no('B15', 'the declined write was not recorded (mushaf=' + JSON.stringify(ms) + ').');
      } else if (nav.calls.estimate < 1) {
        no('B15', 'navigator.storage.estimate() was never called -- the decision was taken\n'
          + '        without ever asking the browser how much room there is.');
      } else {
        ok('a nearly-full disk still serves the page, stores nothing, raises nothing, and says so');
      }
    }

    // (5) NOTHING IS SWALLOWED. A rejected write is counted and given a reason.
    {
      const nav = swNav(WIDE15);
      const h = swLoad(swPath, () => Promise.resolve(swRes('PAGE')), null, nav.navigator,
        undefined, () => 'quota');
      let raised = null;
      const d = h.dispatch(swPageUrl(9));
      const body = await swBody(d.responded).catch((e) => { raised = e; return undefined; });
      for (const w of d.waits) await Promise.resolve(w).catch((e) => { raised = e; });
      const ms = h.storage() && h.storage().mushaf;
      if (raised) {
        no('B15', 'a rejected cache write reached the page as an error: ' + raised.message);
      } else if (body !== 'PAGE') {
        no('B15', 'a rejected cache write cost the reader the page (got ' + JSON.stringify(body) + ')');
      } else if (!ms || ms.failed !== 1) {
        no('B15', 'a rejected page write was SWALLOWED (mushaf=' + JSON.stringify(ms) + ').\n'
          + '        `catch(() => {})` on this path is the defect item 93 was raised to end, and a\n'
          + '        page store is the one place in this worker it had never been closed.');
      } else if (ms.reason !== 'quota') {
        no('B15', 'the rejected write was recorded with reason ' + JSON.stringify(ms.reason)
          + '. A full disk and a dead tunnel ask opposite things of the reader.');
      } else {
        ok('a rejected page write is counted and named on the item 93 channel, and costs no reader');
      }
    }
  }

  // -- B16 the offline package's contract with the page (round 25, A-4) ----
  //
  // The page offers "download this juz". It may only do that if it can state the eviction rule
  // and refuse to start when the disk cannot hold the juz -- and BOTH numbers have to come from
  // this worker, because a second copy of a ceiling is a ceiling that drifts. So the worker now
  // publishes its policy on the channel item 93-B opened, and this asks it to.
  //
  // THE CONFLICT CHECK THE ROUND DEMANDED IS FIXED HERE AS AN ASSERTION rather than left as a
  // measurement somebody took once: the ceiling is re-derived against the LARGEST juz in the
  // shipped layout on every run. If a future edit lowers the cap under a juz, the button would
  // start evicting the front of the juz while still downloading the back of it -- finishing at
  // 100% with an incomplete juz on the device, which is the exact shape of lie this item bans.
  console.log('\n-- B16 offline package: the policy the page is answered with (A-4) --');
  if (!fs.existsSync(SW_FILE)) no('B16', SW_FILE + ' is ABSENT -- the policy cannot be read');
  else {
    const w = swLoad(SW_FILE, () => Promise.resolve(swRes('x')), null,
      { storage: { estimate: () => Promise.resolve({ quota: 1e9, usage: 0 }) } }, null, null);
    const m = w.message({ ezik: 'precache-status' });
    if (m.missing) no('B16', 'the worker registered no message listener, so the page can ask it nothing');
    else if (!m.reply || !m.reply.storage) no('B16', 'the pull channel answered without a storage record');
    else {
      const pol = m.reply.storage.mushafPolicy;
      if (!pol || typeof pol.cap !== 'number' || typeof pol.minFree !== 'number') {
        no('B16', 'the worker publishes no mushaf policy, so the page can only guess the ceiling '
          + 'and the floor it must respect: ' + JSON.stringify(pol));
      } else {
        if (pol.cap === SW_MUSHAF_CAP) ok('the worker publishes its page ceiling (' + pol.cap + ') to the page');
        else no('B16', 'the published ceiling is ' + pol.cap + ' but the worker enforces ' + SW_MUSHAF_CAP);
        if (pol.minFree > 0) ok('...and the free-space floor it declines below (' + pol.minFree + ' bytes)');
        else no('B16', 'the published floor is not a positive number of bytes: ' + pol.minFree);

        // THE CAP AGAINST THE LARGEST JUZ, re-derived from the shipped layout every run.
        let biggest = 0, biggestJuz = 0;
        try {
          const layout = JSON.parse(fs.readFileSync('mushaf-layout.json', 'utf8'));
          const JUZ1 = { 1: '1:1', 2: '2:142', 3: '2:253', 4: '3:92', 5: '4:24', 6: '4:148',
            7: '5:82', 8: '6:111', 9: '7:88', 10: '8:41', 11: '9:93', 12: '11:6', 13: '12:53',
            14: '15:1', 15: '17:1', 16: '18:75', 17: '21:1', 18: '23:1', 19: '25:21', 20: '27:56',
            21: '29:46', 22: '33:31', 23: '36:28', 24: '39:32', 25: '41:47', 26: '46:1',
            27: '51:31', 28: '58:1', 29: '67:1', 30: '78:1' };
          const wordPage = {};
          for (const pg of layout.p) {
            for (const ln of pg.l) {
              if (ln.t !== 't' || !ln.w) continue;
              for (const loc of ln.w) if (!(loc in wordPage)) wordPage[loc] = pg.n;
            }
          }
          const total = layout.pages;
          const start = {};
          for (let j = 1; j <= 30; j++) start[j] = wordPage[JUZ1[j] + ':1'];
          for (let j = 1; j <= 30; j++) {
            const a = start[j];
            const b = j < 30 ? start[j + 1] - 1 : total;
            if (!a || !b) { biggest = 0; break; }
            const n = b - a + 1;
            if (n > biggest) { biggest = n; biggestJuz = j; }
          }
        } catch (e) { biggest = 0; }
        if (!biggest) {
          no('B16', 'the juz page ranges could not be derived from mushaf-layout.json, so the '
            + 'ceiling could not be checked against a juz at all');
        } else if (pol.cap < biggest) {
          no('B16', 'THE CEILING IS UNDER A JUZ: the store holds ' + pol.cap + ' pages but juz '
            + biggestJuz + ' is ' + biggest + ' pages. A download of it would evict its own '
            + 'front while fetching its back and finish claiming a juz that is not there.');
        } else {
          ok('the ceiling (' + pol.cap + ' pages) holds the LARGEST juz (' + biggestJuz + ', '
            + biggest + ' pages) whole');
        }
      }
      // THE ESTIMATE MUST NOT BE ABLE TO UNDER-ESTIMATE. The page refuses to start a download
      // it cannot fit, and it sizes the juz as pageCount x JUZ_DL_PAGE_BYTES. If that constant
      // ever slips below the LARGEST page actually shipped, the refusal stops being safe: a juz
      // of heavy pages would be waved through and then run the disk out mid-download.
      let perPage = 0;
      try {
        const m = fs.readFileSync('app.jsx', 'utf8').match(/const JUZ_DL_PAGE_BYTES = ([0-9]+);/);
        perPage = m ? Number(m[1]) : 0;
      } catch (e) { perPage = 0; }
      let maxPage = 0, pageFiles = 0;
      try {
        const dir = 'assets/madina-hafs';
        for (const f of fs.readdirSync(dir)) {
          if (!/^page-[0-9][0-9][0-9]\.webp$/.test(f)) continue;
          pageFiles++;
          const sz = fs.statSync(dir + '/' + f).size;
          if (sz > maxPage) maxPage = sz;
        }
      } catch (e) { maxPage = 0; }
      if (!perPage) no('B16', 'the page-size estimate JUZ_DL_PAGE_BYTES was not found in app.jsx');
      else if (!pageFiles) no('B16', 'no shipped page files were found to measure the estimate against');
      else if (perPage < maxPage) {
        no('B16', 'the per-page estimate is ' + perPage + ' but the largest shipped page is '
          + maxPage + ' -- the refusal can be waved through on a juz it cannot fit');
      } else {
        ok('the per-page estimate (' + perPage + ') is at least the largest of the ' + pageFiles
          + ' shipped pages (' + maxPage + '), so it cannot under-estimate a juz');
      }

      // The store's name is what makes the pages survive a ship. A-4 must not have touched it.
      if (fs.readFileSync(SW_FILE, 'utf8').indexOf("'" + SW_MUSHAF_CACHE + "'") !== -1) {
        ok('the page store still carries its own unversioned name (' + SW_MUSHAF_CACHE + ')');
      } else {
        no('B16', 'the mushaf store name moved; every page a reader already paid for is orphaned');
      }
    }
  }

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}

const mode = process.argv[2];
if (mode === '--emit') emit();
else if (mode === '--compare' && process.argv[3]) {
  // B11 executes the service worker, so compare() is async. A rejection here must
  // be a loud non-zero exit, never a silent unhandled-rejection warning above a 0.
  compare(process.argv[3]).catch((e) => {
    console.log('  FAIL [B11] the guard itself threw: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
else {
  console.error('usage: node quest-bank-integrity-guard.cjs --emit    > quest-data/bank-integrity-golden.json');
  console.error('       node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json');
  process.exit(2);
}
