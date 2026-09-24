/* quest-bank-integrity-guard.cjs -- THE KUNUZ BANK, THE SEALED FILES, AND THE SERVICE WORKER.
 *
 * WHY THIS GATE EXISTS
 *   It was born as the structural gate of the old treasure journey's bank,
 *   quest-data/trivia-golden.json (B1..B9: count, identity, categories, schema,
 *   duplicates, answers, option-free stems, sources, the 394 protected questions).
 *   ITEM 10 (2026-09-17) REPLACED THAT JOURNEY: quest.html is now the Kunuz hub, the
 *   two modes live in quest-ghaws.html and quest-harb.html, and both load ONE shared
 *   bank, quest-data/kunuz-bank-3147.js. The old bank and every golden that described
 *   it were removed (copies in _superseded/), so B1..B9 left with them -- a check of a
 *   file that no longer ships would be a check of nothing. The gate itself stays,
 *   because B10..B16 seal the scripture files and the service worker, and nothing else
 *   in the repository does.
 *
 * OFFLINE. No network. Reads only.
 *
 * DISCIPLINE: this file contains ZERO literal Arabic -- same law as quran-guard.cjs and
 * esc.cjs. A guard that prints raw Arabic to a Windows console LIES about what it found.
 *
 * WHAT IT PROVES
 *   K1 bank shape   -- the shared bank evaluates to DATA with exactly 3147 questions in
 *                      27 categories; every question has the nine-field shape, a category
 *                      in range, a non-empty stem, 3..4 distinct options, a key in range
 *                      and a unique id; no category is empty.
 *   K2 one copy     -- quest-data/ holds that one file and nothing else, and no page in
 *                      the repository root embeds a bank of its own.
 *   K3 the modes    -- quest-ghaws.html and quest-harb.html each load the shared bank
 *                      exactly once, and each carries a way back to /quest.html and a
 *                      way home to /.
 *   K4 the hub      -- quest.html carries the home link to /, a door to each mode, and
 *                      does NOT load the bank (the hub must stay light).
 *   K5 the entry    -- app.js still enters the treasure at /quest.html, so the app needed
 *                      no change for item 10.
 *   B10 sealed      -- sha256 of the shared bank, the three scripture / adhkar / layout
 *                      files, the manifest and the service worker. Unconditional: no git,
 *                      no branch, no skip.
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
 *   node quest-bank-integrity-guard.cjs --compare quest-data/kunuz-bank-3147.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

// ITEM 10. The one bank both Kunuz modes load, and the figures it was accepted at.
const BANK = 'quest-data/kunuz-bank-3147.js';
const BANK_TAG = '<script src="/' + BANK + '"></script>';
const BANK_QUESTIONS = 3147;
const BANK_CATEGORIES = 27;
const KUNUZ_MODES = ['quest-ghaws.html', 'quest-harb.html'];
const KUNUZ_HUB = 'quest.html';

// ---------------------------------------------------------------------------
// THE SEALED FILES -- thirteen until item 10, six since: the eight quest-data files of
// the old journey left with it and the one shared Kunuz bank took their place. Every
// file here carries scripture, adhkar, the mushaf layout, the question bank, or the
// two files that decide what a phone installs and caches. None of them may move without the seal being re-cut deliberately.
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
  // ITEM 10: the shared Kunuz bank, sealed at acceptance (3DC06F40, 1535845 bytes). One line
  // of JavaScript, no newline, so no line-ending conversion can move it; pinned -text anyway.
  'quest-data/kunuz-bank-3147.js': '3dc06f408027d250b2a3475a477ee2bc531b3c2bd7be0f8a200bcbe268b54cd6',
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
  //   2026-09-15-d -- SIDE ROUND, ITEM 66: THE DIAL IS THE PRESS THAT STARTS THE SENSOR.
  //                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the whole item is
  //                    app.jsx -- the compass screen's mount effect no longer starts the browser
  //                    orientation sensor (a passive effect is off the gesture, and Safari refuses
  //                    the orientation prompt outside one), and the circle itself now answers the
  //                    touch instead. No element was added and nothing was drawn: one handler
  //                    moved onto the dial that was already there. So the shell figure and its
  //                    mirror were already true and only the BUNDLE figures moved. app.js was
  //                    rebuilt from app.jsx by node tools/build-app.cjs, 1749779 -> 1749677
  //                    (-102), and CORE_BYTES was re-cut 2922869 -> 2922767 (-102) by node
  //                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    nothing but app.js changed size in CORE. The worker's own byte table at
  //                    :142 and the SW_PROSE row for app.js below both followed, and THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
  //                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
  //                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
  //                    says the merge round owns the bump.
  //   2026-09-15-c -- SIDE ROUND, ITEM 66: THE COMPASS KEEPS ONE ENTRY AND THE TOP BAR'S MARK
  //                    IS LIFTED. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the
  //                    whole item is app.jsx -- the home's top bar loses the compass button, the
  //                    prop that fed it and the view object's handler key, and the one entry left
  //                    is the mark in the head of the «الصلاة والقبلة» sheet. So the shell figure and
  //                    its mirror were already true and only the BUNDLE figures moved. app.js was
  //                    rebuilt from app.jsx by node tools/build-app.cjs, 1751037 -> 1749779
  //                    (-1258), and CORE_BYTES was re-cut 2924127 -> 2922869 (-1258) by node
  //                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    nothing but app.js changed size in CORE. The worker's own byte table at
  //                    :142 and the SW_PROSE row for app.js below both followed, and THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
  //                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
  //                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
  //                    says the merge round owns the bump.
  //   2026-09-15-b -- SIDE ROUND, ITEM 8: THE REMINDERS LEAVE THE SETTINGS FOR «وِردي اليوم»,
  //                    FOUR OF THEM ARE ANCHORED TO PRAYER TIMES, AND THE SIXTY-ITEM CEILING
  //                    BECOMES A GATE INSTEAD OF A COMMENT. INDEX.HTML DID NOT MOVE and NO FILE
  //                    JOINED OR LEFT CORE: the whole item is app.jsx -- one new device key, four
  //                    alert rows built from the page's own prayer calculator, a reminder carried
  //                    on each wird row, and a priority cut applied before the payload is built.
  //                    So the shell figure and its mirror were already true and only the BUNDLE
  //                    figures moved. app.js was rebuilt from app.jsx by node tools/build-app.cjs,
  //                    1720695 -> 1751037 (+30342), and CORE_BYTES was re-cut 2893785 -> 2924127
  //                    (+30342) by node tools/core-bytes.cjs --write, which is exactly the bundle
  //                    delta because nothing but app.js changed size in CORE. The worker's own
  //                    byte table at :142 and the SW_PROSE row for app.js below both followed,
  //                    and THIS digest is re-cut LAST, after every other sw.js edit was final.
  //                    SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
  //                    moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to try,
  //                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-15-a -- SIDE ROUND, ITEM 66: THE COMPASS SCREEN PAINTS AT ONCE AND SAYS NOTHING.
  //                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE: the whole item is
  //                    app.jsx -- the qibla panel gained one presentation flag that its full-screen
  //                    caller alone passes, the shell gained one slot beside its back button, and
  //                    the layer dispatch put the compass above the prayer sheet so the sheet's
  //                    header can open it. So the shell figure and its mirror were already true and
  //                    only the BUNDLE figures moved. app.js was rebuilt from app.jsx by node
  //                    tools/build-app.cjs, 1713640 -> 1720695 (+7055), and CORE_BYTES was re-cut
  //                    2886730 -> 2893785 (+7055) by node tools/core-bytes.cjs --write, which is
  //                    exactly the bundle delta because nothing but app.js changed size in CORE.
  //                    The worker's own byte table at :142 and the SW_PROSE row for app.js below
  //                    both followed, and THIS digest is re-cut LAST, after every other sw.js edit
  //                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch
  //                    of it moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to
  //                    try, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-13-i -- ITEM 92-ج: THE «عن عزك» MATN IS REPLACED AND المصادر BECOMES THE
//                    WHOLE LIST. INDEX.HTML DID NOT MOVE and NO FILE JOINED CORE: both matns
//                    still ship as SOURCE, which is why they were not made data files in the
//                    round that introduced them -- 4 paragraphs, 7 section headings and 54
//                    credit lines, none of them fetched, cached or read from a store. So the
//                    shell figure and its mirror were already true and only the BUNDLE figures
//                    moved. app.js was rebuilt from app.jsx by node tools/build-app.cjs,
//                    1647056 -> 1652685 (+5629), and CORE_BYTES was re-cut 2735387 -> 2741016
//                    (+5629) by node tools/core-bytes.cjs --write, which is exactly the bundle
//                    delta because nothing but app.js changed size in CORE. The worker's own
//                    byte table at :121 and the SW_PROSE row for app.js below both followed,
//                    and THIS digest is re-cut LAST, after every other sw.js edit was final.
//                    SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
//                    moved -- and CACHE IS NOT BUMPED: this is a branch for the owner to try,
//                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-13-h -- ITEM 92-ب: FOUR ROWS IN THE SIDE MENU, TWO FIXED-TEXT PANELS AND ONE
//                    FEEDBACK FORM. INDEX.HTML DID NOT MOVE this round -- the rows, the panels
//                    and the form are app.jsx, the new endpoint is api/feedback.js (a server
//                    route, not a shipped asset, so NOT in CORE and not in .gitattributes), and
//                    NO FILE JOINED CORE at all: the two matns ship as source, which is exactly
//                    why they were not made data files. So the shell figure and its mirror were
//                    already true and only the BUNDLE figures moved. app.js was rebuilt from
//                    app.jsx by node tools/build-app.cjs, 1629141 -> 1647056 (+17915), and
//                    CORE_BYTES was re-cut 2717472 -> 2735387 (+17915) by node
//                    tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    nothing but app.js changed size in CORE. The worker's own byte table at
//                    :121 and the SW_PROSE row for app.js below both followed, and THIS digest
//                    is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE
//                    UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS
//                    NOT BUMPED: this is a branch for the owner to try, not a ship, and sw.js
//                    says the merge round owns the bump.
  //   2026-09-13-g -- ITEM 4: THE FORTY'S FOOTNOTES JOIN CORE, AND app.js GREW TO DRAW THEM.
  //                    arbaeen.json carries the print edition's footnote markers inside its own
  //                    text -- 55 of them -- and nothing answered any of them. The footnote text
  //                    was joined to the marks from the source atoms by the new, deterministic
  //                    tools/arbaeen-footnotes-build.cjs and shipped as arbaeen-footnotes.json
  //                    (9322 bytes, AD25D24A), which is now named in CORE beside arbaeen.json
  //                    with its own prose line. IT IS IN CORE FOR A REASON THE OTHER DATA
  //                    ENTRIES DO NOT HAVE: the reader draws a mark only when this file answers
  //                    it, so a precached corpus whose notes were NOT precached would give an
  //                    offline reader the same hadith with every mark stripped out of it.
  //                    arbaeen.json ITSELF WAS NOT WRITTEN -- it was read, and its digest above
  //                    is the one 2026-09-13-e recorded. app.js was rebuilt from app.jsx by node
  //                    tools/build-app.cjs, 1619590 -> 1629141 (+9551), and CORE_BYTES was
  //                    re-cut 2698599 -> 2717472 (+18873, exactly 9322 + 9551) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table gained the new
  //                    file in its existing descending order and restated app.js; SW_CORE and
  //                    SW_CORE_FILES gained the entry in CORE's order, and SW_PROSE gained a row
  //                    for it and restated app.js, so B12 and B14 re-derive both numbers rather
  //                    than trusting them. THIS digest is re-cut LAST, after every other sw.js
  //                    edit was final. THE CACHING STRATEGY IS UNTOUCHED: the fetch handler, the
  //                    sealed-mushaf exclusion and the revalidation branch are exactly as they
  //                    were. CACHE is NOT bumped: the merge round owns the bump.
  //   2026-09-13-f -- ITEM 2: TWO CORPORA JOIN THE WORKER'S CORE LIST. arbaeen.json (67360
  //                    bytes, 36B6DF66) and daily-tafsir.json (23984 bytes, E26E09F1) were
  //                    fetched from the origin root on first open and cached only by the
  //                    runtime rule, so a first open with NO NETWORK drew two empty sections.
  //                    Both are now named in CORE beside the other data entries, each with a
  //                    prose line in the array's own voice. NEITHER CORPUS WAS WRITTEN -- both
  //                    were read for their size and nothing else, and their digests above are
  //                    the same ones 2026-09-13-e recorded. CORE_BYTES was re-cut 2607255 ->
  //                    2698599 (+91344, exactly 67360 + 23984) by node tools/core-bytes.cjs
  //                    --write. The worker's own byte table, now at :125, gained both figures
  //                    in its existing descending order; SW_CORE and SW_CORE_FILES gained both
  //                    entries in CORE's order, and SW_PROSE gained a row for each, so B12 and
  //                    B14 re-derive the two new numbers rather than trusting them. THIS digest
  //                    is re-cut LAST, after every other sw.js edit was final. THE CACHING
  //                    STRATEGY IS UNTOUCHED: the fetch handler, the sealed-mushaf exclusion
  //                    and the revalidation branch are all exactly as they were. CACHE is NOT
  //                    bumped: sw.js says the merge round owns the bump, and install rewrites
  //                    every CORE entry into the same store.
  //   2026-09-13-e -- THE FORTY, AMENDED: THE CORPUS'S LATIN COMMA IS DRAWN AS AN ARABIC ONE,
  //                    AND THE HEADING CAP MOVES 40 -> 56. Both changes live entirely inside
  //                    arbaeenTopic in app.jsx, which is a DISPLAY derivation: arbaeen.json is
  //                    not touched (67360 bytes, 36B6DF66, unchanged), the reader's attribution
  //                    line still prints the corpus's own heading verbatim, and index.html did
  //                    not move, which is why no shell figure did. Thirteen of the fifty headings
  //                    lose a space before the mark and gain U+060C in its place; the wider cap
  //                    takes the elided headings from eleven to three. app.js was rebuilt
  //                    1618438 -> 1619590 (+1152) by node tools/build-app.cjs, and CORE_BYTES
  //                    re-cut 2606103 -> 2607255 (+1152, exactly the bundle delta) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table at :121 and the
  //                    SW_PROSE row for app.js both followed, and THIS digest is re-cut LAST.
  //                    SW.JS IS OTHERWISE UNTOUCHED: one integer and one figure in prose. CACHE
  //                    is NOT bumped: install rewrites every CORE entry into the same store.
  //   2026-09-13-d -- ITEM 1-A / 1-B / 3, THE FORTY: PREVIOUS AND NEXT, THE LIST'S OWN PLACE,
  //                    AND A HEADING DERIVED FROM THE ENTRY. The reader now holds the INDEX of
  //                    the entry being read instead of the entry object, so it can step either
  //                    way; returning centres the card the reader was last inside; and the card's
  //                    heading is read out of the entry's own text rather than being the ordinal
  //                    the corpus stores. arbaeen.json IS NOT TOUCHED -- 67360 bytes, 36B6DF66,
  //                    before and after -- and neither is index.html, which is why no shell
  //                    figure moved. app.jsx is the only edited source. app.js was rebuilt
  //                    1607416 -> 1618438 (+11022) by node tools/build-app.cjs, and CORE_BYTES
  //                    re-cut 2595081 -> 2606103 (+11022, exactly the bundle delta, because the
  //                    shell did not grow) by node tools/core-bytes.cjs --write. The worker's own
  //                    byte table at :121 and the SW_PROSE row for app.js both followed, and THIS
  //                    digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED: what moved inside it
  //                    is one integer and one figure in prose. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  //   2026-09-13-c -- ITEM 94, THE BARCODE: THE FORMAT STRIP WAS WRITTEN BACKWARDS.
  //                    The symbol on the card was right in every part a reader looks at LAST --
  //                    finders, timing, alignment, data words, error correction, mask 4, quiet
  //                    zone -- and wrong in the fifteen modules a reader looks at FIRST. The
  //                    format word was indexed from its low bit, so all fifteen were laid down
  //                    in reverse (nine of the thirty modules dark where they should be light),
  //                    and the second copy was taken eight modules up the left column instead of
  //                    seven, which shifted it by one and overwrote the dark module besides. No
  //                    scanner reads that. ezikQrPutFormat in app.jsx is the ONLY changed
  //                    function; the encoder, the payload, the skin and index.html did not move.
  //                    app.js was rebuilt 1606644 -> 1607416 (+772) by node tools/build-app.cjs,
  //                    and CORE_BYTES re-cut 2594309 -> 2595081 (+772, exactly the bundle delta)
  //                    by node tools/core-bytes.cjs --write. The worker's own byte table at :121
  //                    and the SW_PROSE row for app.js both followed, and THIS digest is re-cut
  //                    LAST. CACHE is NOT bumped: install rewrites every CORE entry into the
  //                    same store.
  //   2026-09-13-b -- ITEM 94, ROUND TWO: THE CARD'S SKIN WAS REPLACED AGAIN, AND ONLY THE SKIN.
  //                    The owner read three skins and ruled on the band-and-rows one: white page,
  //                    ezik's light blue, no phrase at all under the bottom strip's ruler, the
  //                    barcode leading to ezik rather than to the source, and a shape GENERATED
  //                    per question out of a closed six-key grammar rather than one template
  //                    repeating. Everything is in app.jsx: the structure check narrowed to two
  //                    to four points, a fourteen-key vector diagram library, the grammar and its
  //                    resolver, the locked palette, the layout and the painter. The QR encoder,
  //                    the fallback to the old skin and the pinned output line are untouched.
  //                    index.html DID NOT MOVE. app.js was rebuilt 1584918 -> 1606644 (+21726) by
  //                    node tools/build-app.cjs, and CORE_BYTES re-cut 2572583 -> 2594309
  //                    (+21726, which is exactly the bundle delta) by node tools/core-bytes.cjs
  //                    --write. The worker's own byte table at :121 and the SW_PROSE row for
  //                    app.js below both state that size and both were restated. THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  //   2026-09-13   -- ITEM 94: THE SHARE CARD IS A SUMMARY NOW, AND THE SKIN THAT POURED THE WHOLE
  //                    REPLY OUT IS THE FALLBACK BEHIND IT. All of it is in app.jsx: a closed-
  //                    structure summary asked of the model at the press, a structure check that
  //                    falls back rather than repairs, a QR encoder (byte mode, versions 2..6,
  //                    levels M then L) drawn as fillRect squares on the card's own context, and
  //                    the new layout. index.html DID NOT MOVE. app.js was rebuilt 1550360 ->
  //                    1584918 (+34558) by node tools/build-app.cjs, and CORE_BYTES re-cut
  //                    2538025 -> 2572583 (+34558, which is exactly the bundle delta) by node
  //                    tools/core-bytes.cjs --write. The worker's own byte table at :121 and the
  //                    SW_PROSE row for app.js below both state that size and both were restated.
  //                    THIS digest is re-cut last. CACHE is NOT bumped: install rewrites every
  //                    CORE entry into the same store.
  //   2026-09-10   -- ITEM 85: THE BOOT REACHES ONE ORIGIN, AND IT IS THIS ONE. index.html linked a
  //                    render-blocking stylesheet on fonts.googleapis.com, and with that origin
  //                    unreachable the diagnostic catcher put a full-viewport black panel over a
  //                    working app. The 21 .woff2 files Google served for that URL are now in
  //                    fonts/ under the vendor's own names, declared by 31 @font-face rules with
  //                    the same weights, unicode-ranges and font-display: swap; the three
  //                    preconnects and the link are gone; and a resource that fails to load is
  //                    recorded in __ezikDiag without building the panel. THE SHELL GREW, a lot:
  //                    index.html 124729 -> 152137 (+27408), of which 24183 is the @font-face
  //                    block, 2327 the catcher's new branch and its reasoning, and 1610 the
  //                    register of the three origins that stay. app.js DID NOT MOVE -- app.jsx was
  //                    not touched and gate babel still passes on the committed bundle. sw.js lost
  //                    its two-hostname exception to the !sameOrigin return (fonts are same-origin
  //                    now and fall to the arm that was already there) and CORE gained the two
  //                    Noto Naskh Arabic cuts the first screen actually pulls, measured in a cold
  //                    headless boot: 94032 + 19696 = 113728. So CORE_BYTES was re-cut by node
  //                    tools/core-bytes.cjs --write 2266648 -> 2407784 (+141136 = +27408 shell
  //                    +113728 faces), and SW_CORE, SW_CORE_FILES and three SW_PROSE rows below
  //                    followed. The worker's own byte table at :121 and its CACHE note at :57
  //                    both state the shell size and both were restated. THIS digest is re-cut
  //                    LAST, on a tree measured at CR = 0. CACHE IS NOT BUMPED: this is a branch
  //                    for the owner to preview, not a ship.
  //   2026-09-10   -- ITEM 63: THE FOUR FATWA LEARNING BUTTONS THAT DO NOTHING ARE HIDDEN. The
  //                    owner ruled that simplify / example / explain / quiz are hidden rather than
  //                    built or deleted, so app.jsx gained one constant, EZIK_FATWA_ACTIONS_SHOWN,
  //                    and the render of the list now hangs off it. Setting it to true shows them
  //                    again, still disabled -- that one line IS the rollback. The list, the .map
  //                    body, the five fatwa.action.* keys in both language halves and every .ezf-*
  //                    rule are untouched; .ezf-action is shared with the SAVE button, which keeps
  //                    its size to the pixel (measured 147x44 at 360 and 162x44 at 390, on both
  //                    trees). INDEX.HTML DID NOT MOVE -- everything is in app.jsx and one guard --
  //                    so two of the three worker figures and one of the two mirrors below were
  //                    already true and only the BUNDLE figures moved. app.js was rebuilt
  //                    1421673 -> 1421956 (+283) by node tools/build-app.cjs, and CORE_BYTES was
  //                    re-cut 2266365 -> 2266648 (+283) by node tools/core-bytes.cjs --write, which
  //                    is exactly the bundle delta because the shell did not grow. The worker table
  //                    at :111 and the app.js mirror below followed, and THIS digest is re-cut LAST.
  //                    SW.JS IS OTHERWISE UNTOUCHED and CACHE IS NOT BUMPED: this is a branch for
  //                    the owner to preview, not a ship.
  //   2026-09-10   -- ITEM 92 PART B: THE IN-APP SHARE GIVES A SMART LINK. https://ezik.app IS the
  //                    app, not a way to install it, so the shells now hand over one address that
  //                    decides for whoever opens it -- https://ezik.app/download.html. The new root
  //                    page sends an iPhone or iPad to the App Store, an Android device to Google
  //                    Play, and everybody else sees both official badges as links; the deciding is
  //                    done by download.js, on that page, and the app's own shell detection still
  //                    never reads a user agent. The browser chooser part A built did not change.
  //                    INDEX.HTML DID NOT MOVE this round either -- everything is in app.jsx, one
  //                    guard and two new root files -- so two of the three worker figures and one of
  //                    the two mirrors below were already true and only the BUNDLE figures moved.
  //                    app.js was rebuilt 1420540 -> 1421673 (+1133) by node
  //                    tools/build-app.cjs, and CORE_BYTES was re-cut 2265232 -> 2266365 (+1133) by
  //                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
  //                    the shell did not grow. The worker table at :111 and the app.js mirror below
  //                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED: its
  //                    navigation branch is already network-FIRST, so the new page is served by the
  //                    server and not from the cached app, exactly as about.html is. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship.
  //   2026-09-10   -- ITEM 92: THE MENU GAINED A SHARE BUTTON, AND WHAT IT HANDS OVER DEPENDS ON
  //                    WHERE THE READER IS. Inside the mobile shells it shares https://ezik.app and
  //                    nothing else -- no chooser is built there, so no badge file and no store or
  //                    platform name can reach the page, which is App Store Review Guideline 2.3.10.
  //                    In a plain browser it opens a small chooser: Apple's own badge, Google's own
  //                    badge, then both links as text. Apple is first because Apple's badge guideline
  //                    requires it when another platform's badge is beside it. The two badges are the
  //                    VENDORS' OWN FILES, byte for byte from apple.com and google.com, and the new
  //                    gate `sharelinks` seals each by SHA-256. INDEX.HTML DID NOT MOVE this round --
  //                    everything is in app.jsx, two guards and four censuses -- so two of the three
  //                    worker figures and one of the two mirrors below were already true and only the
  //                    BUNDLE figures moved. app.js was rebuilt from that source 1408320 -> 1420540
  //                    (+12220) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2253012 ->
  //                    2265232 (+12220) by node tools/core-bytes.cjs --write, which is exactly the
  //                    bundle delta because the shell did not grow. The worker table at :111 and the
  //                    app.js mirror below followed, and THIS digest is re-cut LAST. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship, and sw.js says the
  //                    merge round owns the bump.
  //   2026-09-10   -- ITEM 75: SUMMARIZE AND EXPAND LEFT THE COMPOSER BAR FOR A ROW OF THEIR OWN.
  //                    Part B put them in the control row and the measurement sent them out again:
  //                    at 360 that row had 106px for three text pills that wanted 150, so all three
  //                    were ellipsized, the shipped mode pill included. The owner ruled they sit in
  //                    a small row above the field instead, shown after each reply, sharing that
  //                    slot with the ask-about-the-selection bar, which wins; and the control row
  //                    went back byte for byte to the row of aa497d5. INDEX.HTML DID NOT MOVE this
  //                    round -- everything is in app.jsx -- so two of the three worker figures and
  //                    one of the two mirrors below were already true and only the BUNDLE figures
  //                    moved. app.js was rebuilt from that source 1399197 -> 1408320 (+9123) by
  //                    node tools/build-app.cjs, and CORE_BYTES was re-cut 2243889 -> 2253012
  //                    (+9123) by node tools/core-bytes.cjs --write, which is exactly the bundle
  //                    delta because the shell did not grow. The worker table at :111 and the
  //                    app.js mirror below followed, and THIS digest is re-cut LAST. CACHE IS NOT
  //                    BUMPED: this is a branch for the owner to try, not a ship, and sw.js says
  //                    the merge round owns the bump.
  //   2026-09-09   -- ITEM 05 F: THE COMPOSER BECAME A FIELD ROW OVER ONE CONTROL ROW. The
  //                    field has the top row to itself and send moved down into the control
  //                    row at the VISUAL RIGHT, with mic and the voice entry beside it and the
  //                    mode pill and the [+] at the other end; the three icon buttons became
  //                    44x44 circles and the chip became a pill. INDEX.HTML DID NOT MOVE this
  //                    round -- the change is all in app.jsx -- so two of the three worker
  //                    figures and one of the two mirrors below were already true and only the
  //                    BUNDLE figures moved. app.js was rebuilt from that source 1397224 ->
  //                    1399197 (+1973) by node tools/build-app.cjs, and CORE_BYTES was re-cut
  //                    2241916 -> 2243889 (+1973) by node tools/core-bytes.cjs --write, which
  //                    is exactly the bundle delta because the shell did not grow. The worker
  //                    table at :111 and the app.js mirror below followed, and THIS digest is
  //                    re-cut LAST. CACHE IS NOT BUMPED: this is a branch for the owner to try,
  //                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 05 E1/E2: the home tiles became the section NAME in a square --
  //                    the icon, the sub-line and the chevron left the rendered tile and
  //                    .ezist-mod/.ezist-feature took aspect-ratio:1/1 with the centring, so
  //                    the shell grew 123062 -> 124729 (+1667); and «wirdi al-yawm» stopped
  //                    being a card on the home and became a SECTION entered from a row that
  //                    draws the title alone, with the +, the -, the added rows, the choice
  //                    lines and the empty sentence all inside it. app.js was rebuilt from
  //                    that source 1391446 -> 1397224 (+5778) by node tools/build-app.cjs,
  //                    and CORE_BYTES was re-cut 2234471 -> 2241916 (+7445) by node
  //                    tools/core-bytes.cjs --write -- the bundle's +5778 plus the shell's
  //                    +1667, which is exactly that delta. The THREE worker figures (the
  //                    shell at :57, the shell and the bundle at :111) and the TWO mirrors
  //                    below followed, and THIS digest is re-cut LAST. CACHE IS NOT BUMPED:
  //                    this is a branch for the owner to try, not a ship, and sw.js says the
  //                    merge round owns the bump.
  //   2026-09-09   -- ITEM 05 A/C/D: three sections per row at EVERY width (index.html only, so
  //                    the shell grew 122811 -> 123062); �wirdi al-yawm� became a live list with
  //                    a + and a - over four sections, under its own key ezik_wird_list_v1; and
  //                    �arrange your home� moved out of the home into Settings, where it now
  //                    reorders the ten shelf sections under ezik_home_order_v1 as well as the
  //                    three widgets it always reordered. app.js was rebuilt from that source
  //                    1367950 -> 1391446 (+23484) by node tools/build-app.cjs, and CORE_BYTES
  //                    was re-cut 2210724 -> 2234471 (+23747) by node tools/core-bytes.cjs
  //                    --write -- the bundle's +23484 plus the shell's +251, which is exactly
  //                    that delta. The worker byte table and the THREE SW_PROSE figures above
  //                    (the shell at :57, the shell and the bundle at :111) all followed, and
  //                    THIS digest is re-cut last. CACHE IS NOT BUMPED: this is a branch for the
  //                    owner to try, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 05, THE THREE-ACROSS SHELF AND THE CHAT RAIL'S HOME BUTTON. The shelf
  //                    goes three across from 1000px: index.html:614 is repeat(3,1fr) and the two
  //                    span rules that made six tracks read as three tiles are deleted, so every
  //                    tile holds exactly one track. .ezc-rail-inner gained a home button as its
  //                    LAST child, which under body{direction:rtl} is the visual left; it reuses
  //                    the declared key navigation.home and adds no CSS. The drawer's second door
  //                    to asmaa and a stale comment paragraph were deleted on the owner's ruling,
  //                    and the 1000px comment was re-cut to the ruling now in force. app.js was
  //                    rebuilt from that source 1368253 -> 1367950 (-303), index.html moved
  //                    122884 -> 122811 (-73) over the shelf edit and the comment, CORE_BYTES was
  //                    re-cut 2211100 -> 2210724 by tools/core-bytes.cjs --write, the index.html
  //                    and app.js figures in the byte table above CORE_BYTES and their SW_PROSE
  //                    mirrors below all followed, and THIS digest was cut last, after every one
  //                    of them. sw.js is 44695 bytes at CR = 0. CACHE is NOT touched -- the store
  //                    name is the merge round's.
  //   2026-09-09   -- ITEM 37 PIECE 2: the related-lessons search under a settled reply is now
  //                    built from the ANSWER's words instead of the reader's question. app.jsx
  //                    gained one pure builder (ezikLessonsQuery) and repointed one call site;
  //                    app.js was rebuilt from that source 1364887 -> 1368253 (+3366) by node
  //                    tools/build-app.cjs, and CORE_BYTES was re-cut 2207734 -> 2211100 by node
  //                    tools/core-bytes.cjs --write, which is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror above both followed, and THIS digest is
  //                    re-cut last. CACHE IS NOT BUMPED: this is a branch for the owner to try on
  //                    a preview, not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-09   -- ITEM 26 SHIP: أسماء الله الحسنى takes the HEAD of the home shelf, the rules
  //                    page gains the owner's eighth rule, and the store name is bumped. app.jsx
  //                    moved one descriptor to the top of ezHomeModules and re-cut six dictionary
  //                    values («القواعد السبع» -> «القواعد الثماني»); app.js was rebuilt from that
  //                    source 1364046 -> 1364887 (+841) by node tools/build-app.cjs, and CORE_BYTES
  //                    was re-cut 2206893 -> 2207734 by node tools/core-bytes.cjs --write, which is
  //                    exactly that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE IS bumped here, ezik-v32 ->
  //                    ezik-v33, and SW_CACHE below with it: a reader holding the old bundle would
  //                    otherwise keep a shelf with no section at its head.
  //   2026-09-08   -- ITEM 104/105, THE MUSHAF READING PAGE. The owner's ruling of 8 Sept 2026:
  //                    the reading page carries the memorisation mark and the way back to the
  //                    suras and NOTHING else. app.jsx lost the bottom dock outright -- both
  //                    renderer shapes, the two arrows, the jump control and the height
  //                    measurement the wird strip used to be positioned against -- and the wird
  //                    strip and the page mark MOVED, unrewritten, to the mushaf index. Item 105
  //                    added mushafPageReady(), which waits for the opening page's own asset
  //                    before `state` turns 'ok', so the reader is never shown a page frame with
  //                    nothing in it. No new asset, no new origin, no new key. app.js was
  //                    rebuilt from that source 1338609 -> 1336026 (-2583), CORE_BYTES was
  //                    re-cut 2181456 -> 2178873 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1338609 -> 1336026, and THIS digest was cut last, after
  //                    all of them. CACHE is NOT touched -- the store name is the merge round's.
  // ITEM 20 SHELF, COMMIT THREE -- WHO SEES THE WOMEN'S CORNER (2026-09-08,
  //                    feat/shelf-20260908). NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE
  //                    TABLE. D-10 is reversed: the form of address decides who is drawn that
  //                    section, \u00abmale\u00bb is not drawn it, and the switch that used to decide it is
  //                    deleted from Settings with its device key, its reader and its writer. The
  //                    key literal survives at exactly ONE line in app.jsx -- the removeItem in
  //                    \u00abdelete all my data\u00bb -- because an abandoned value is still one person's
  //                    record in one person's browser, and that page promises it goes; the roster
  //                    entry in tools/delete-truth-measure.cjs became a `lit` for the same reason.
  //                    app.js followed 1337339 -> 1338609 (+1270) and CORE_BYTES 2180186 ->
  //                    2181456 is exactly that delta. The worker byte table and the SW_PROSE
  //                    mirror below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // ITEM 20 SHELF, COMMIT TWO -- THE ORDER (2026-09-08, feat/shelf-20260908). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. The women's corner moved from the
  //                    second position on the home shelf to the last one, after every other
  //                    section; the articles section stays first and the seven between them do
  //                    not move. One row of a literal array changed position and the comment
  //                    above it was rewritten, which is the whole of the bundle's growth.
  //                    app.js followed 1336450 -> 1337339 (+889) and CORE_BYTES 2179297 ->
  //                    2180186 is exactly that delta. The worker byte table and the SW_PROSE
  //                    mirror below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // ITEM 20 SHELF, COMMIT ONE -- THE NAME (2026-09-08, feat/shelf-20260908). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. The articles section is called
  //                    «Ezik's articles» on the shelf, in its own screen head and in the writing
  //                    form's section chooser; the change is TWO dictionary values and nothing
  //                    else -- no key, no descriptor id, no section register and no stored value
  //                    moved, which is why the bundle grew by eight bytes. app.js followed
  //                    1336442 -> 1336450 (+8) and CORE_BYTES 2179289 -> 2179297 is exactly that
  //                    delta. The worker byte table and the SW_PROSE mirror below both followed,
  //                    and THIS digest is re-cut last. CACHE is NOT bumped: install rewrites
  //                    every CORE entry into the same store.
  // ITEM 8 -- THE BROWSER DOOR (2026-09-07, feat/night-run-20260907, phase 7). NO CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE. api/auth-return.js gained a second
  //                    destination for a flow that started in a tab, and the page gained the press,
  //                    the per-tab state and the return leg that walk it; app.js followed
  //                    1327772 -> 1336442 (+8670) and CORE_BYTES 2170619 -> 2179289 is
  //                    exactly that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE GRANT CHECK (2026-09-07, feat/night-run-20260907, phase 4). NO CHANGE IN THE WORKER
  //                    ITSELF BEYOND ITS BYTE TABLE. One control in Settings, drawn only where a
  //                    founder token is held, that presses the very door that refuses a writer and
  //                    says which of the four refusals it was; app.js followed 1321078 -> 1327772
  //                    (+6694) and CORE_BYTES 2163925 -> 2170619 is exactly that delta. The
  //                    worker byte table and the SW_PROSE mirror below both followed, and THIS
  //                    digest is re-cut last. CACHE is NOT bumped: install rewrites every CORE
  //                    entry into the same store.
  // ITEM 9 -- THE PROFILE BLOCK AND THE HIDE CONTROL (2026-09-07, feat/night-run-20260907,
  //                    phase 3). NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. A third
  //                    form of address that says "prefer not to say" out loud instead of being
  //                    reached by pressing a word twice, and one switch that hides the women
  //                    section from the shelf on this device and puts it back from the same
  //                    place; app.js followed 1315901 -> 1321078 (+5177) and CORE_BYTES
  //                    2158748 -> 2163925 is exactly that delta. The worker byte table and the
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last.
  //                    CACHE is NOT bumped: install rewrites every CORE entry into the same store.
  // ITEM 7 -- THE MARK ON A SECTION HOLDING SOMETHING NEW (2026-09-07,
  //                    feat/night-run-20260907, phase 2). NO CHANGE IN THE WORKER ITSELF BEYOND
  //                    ITS BYTE TABLE. A device-local record of what each section has already
  //                    shown this reader, a dot on the two shelf tiles that hold something newer
  //                    than it, and two list requests made AFTER the first paint; app.js followed
  //                    1307875 -> 1315901 (+8026) and CORE_BYTES 2150722 -> 2158748 is exactly
  //                    that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE TWO UNREGISTERED BACK LAYERS (2026-09-07, feat/night-run-20260907, phase 1).
  //                    NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. The prayer sheet
  //                    and the arrange panel each register a back layer now, and each visible
  //                    way out of them spends the entry that registration pushes; app.js
  //                    followed 1306083 -> 1307875 (+1792) and CORE_BYTES 2148930 -> 2150722
  //                    is exactly that delta. The worker byte table and the SW_PROSE mirror
  //                    below both followed, and THIS digest is re-cut last. CACHE is NOT
  //                    bumped: install rewrites every CORE entry into the same store.
  // THE ARTICLES SCREENS (2026-09-07, feat/item20-ui-loop-20260907, item 20 stage two).
  //                    NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE TABLE. The server half of
  //                    item 20 had been live since 2e33456 and no screen existed, so nobody could
  //                    see any of it; the two reader sections, the reading view and the writing
  //                    screen landed in app.jsx and app.js followed 1265332 -> 1306083 (+40751
  //                    across two commits: +40399 for the screens, +352 for a locked section
  //                    chooser that says it is locked), and CORE_BYTES 2108179 -> 2148930 is
  //                    exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // THE BOOK CARD OPENS ONTO ITS MATN (2026-09-01, feat/item7-library-freebrain-20260901,
  //                    piece 9 / degree 1). AGAIN NO CHANGE IN THE WORKER ITSELF BEYOND ITS BYTE
  //                    TABLE. The chip built by the round below named a book and a page and
  //                    could not show one word of what the answer rested on: the passage reached
  //                    the row (lib/free-brain/tools.js) and died at the tag, which read three
  //                    fields and not that one. It now rides on the SAME tag, base64 so that a
  //                    quotation full of guillemets cannot truncate the card, and a touch opens
  //                    it under the chip. app.js followed 1253566 -> 1259367 (+5801) and
  //                    CORE_BYTES 2096413 -> 2102214 is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // THE LIBRARY BOOK CARD (2026-09-01, feat/item7-library-freebrain-20260901). ONE CHANGE IN THE
  //                    WORKER ITSELF BEYOND ITS BYTE TABLE: none. `lib_book` atoms reached the
  //                    answer and no card was ever built for them — the tool existed in one file,
  //                    the client knew nothing of it — so the server now builds a `<book>` chip
  //                    from the rows the delivered text cited and the client draws it. app.jsx
  //                    grew and app.js followed 1249879 -> 1253566 (+3687), and CORE_BYTES
  //                    2092726 -> 2096413 is exactly that delta. The worker byte table and the
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last. CACHE
  //                    is NOT bumped: install rewrites every CORE entry into the same store.
  // APPLE 4.0.0 (2026-08-30, fix/apple-400-onboard-remove-20260830). ONE CHANGE IN app.jsx AND
  //                    NOT ONE IN THE WORKER ITSELF beyond its byte table: submission e931435e-
  //                    f171-4da4-b476-c33fd5dde452 was refused for asking a name and a year
  //                    after Sign in with Apple, so the step behind the entry card is gone and
  //                    the three fields it asked for moved into Settings. app.js followed
  //                    1242855 -> 1248701 (+5846), and CORE_BYTES 2085702 -> 2091548 is exactly
  //                    that delta. The worker byte table and the SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // THE WEB-SHELL SEAM (2026-08-28, feat/web-shell-seam-20260828). THREE CHANGES IN app.jsx AND
  //                    NOT ONE IN THE WORKER ITSELF beyond its byte table: a FIFTH shell channel
  //                    that hands this page a finished session (written through the existing
  //                    writeAuthSession, no new key), a shell-declared flag that takes both
  //                    provider doors off the entry screen while the guest door stays, and the
  //                    qibla panel re-arming the heading stream when the location permission it
  //                    needs is granted. app.js followed 1216884 -> 1232987 (+16103), and
  //                    CORE_BYTES 2059731 -> 2075834 is exactly that delta. The worker byte
  //                    table and the SW_PROSE mirror below both followed, and THIS digest is
  //                    re-cut last. CACHE is NOT bumped: install rewrites every CORE entry into
  //                    the same store.
  // LOGIN FIRST + THE GUEST DOOR (2026-08-27, feat/login-first-20260827). THE FIRST SCREEN A
  //                    DEVICE MEETS IS NOW THE ENTRY SCREEN: two provider doors and a guest door
  //                    beside them, with the wird/conversations warning drawn on it, and the name
  //                    and year moved BEHIND that answer and made optional. One new device key,
  //                    ezik_entry_v1, on the erase roster. No route, no screen and no cache name
  //                    moved -- Onboarding gained a step, it did not become two components.
  //                    app.jsx grew and app.js followed 1205975 -> 1216868 (+10893),
  //                    and CORE_BYTES 2048822 -> 2059715 is exactly that delta. The
  //                    worker byte table and SW_PROSE mirror below both followed, and THIS digest
  //                    is re-cut last. CACHE is NOT bumped: install rewrites every CORE entry
  //                    into the same store.
  // QIBLA CALIBRATION ARROW (2026-08-27, feat/qibla-heading-20260827). THE OWNER KEEPS THE
  //                    CALIBRATION STREAM MOVING, but its arrow now carries the judgment: it is
  //                    hollow and dashed, with a calibration-only marker, while ready/live keeps
  //                    the original solid path and no marker. No text, bearing, state branch,
  //                    key, cache name, or CORE entry moved. app.jsx grew and app.js followed
  //                    1205284 -> 1205975 (+691), and CORE_BYTES 2048131 -> 2048822 is exactly
  //                    that delta. The worker byte table and SW_PROSE mirror below both followed,
  //                    and THIS digest is re-cut last. CACHE is NOT bumped: install rewrites
  //                    every CORE entry into the same store.
  // QIBLA HEADING STREAM (2026-08-27, feat/qibla-heading-20260827). THE WEB ASKS WHILE THE PANEL
  //                    LIVES. The native bridge is detected by the existing detector, receives
  //                    one start and one stop, and supplies five statuses without the web
  //                    reclassifying accuracy. Without that bridge, the browser orientation path
  //                    is unchanged. app.jsx grew and app.js followed 1200987 -> 1205284 (+4297),
  //                    and CORE_BYTES 2043834 -> 2048131 is exactly that delta -- no CORE entry
  //                    was added or removed. The worker byte table and SW_PROSE mirror below both
  //                    followed, and THIS digest is re-cut last. CACHE is NOT bumped: install
  //                    rewrites every CORE entry into the same store.
  // PARENTAL GATE + CHILD AI CONSENT (2026-08-27, feat/parental-gate-20260827). THE CODE KEEPS
  //                    ITS PLACE AND GAINS TWO THINGS. D12 stands -- the parent code is judged on
  //                    the server and no device key holds it -- so the erratum that ordered it
  //                    onto the device was withdrawn and NOTHING here moved storage. What the
  //                    server record gained is an age (`setAt`, 365 days, judged in the endpoint
  //                    rather than by a store TTL so an expired code can be NAMED instead of
  //                    looking like a code that never existed) and a way out (`delete`, guarded
  //                    by the code itself under the same limiter as verify). On the client that
  //                    is ParentCodeCard on the parents' dashboard, behind an armed step, writing
  //                    nothing to the device. The AI-consent record gained the profile id it was
  //                    given for, so a second child on one tablet is asked in their own right --
  //                    same key, same delete roster entry, no new storage anywhere.
  //                    app.jsx grew and app.js followed 1193820 -> 1200987 (+7167), and
  //                    CORE_BYTES 2036667 -> 2043834 is exactly that delta -- no CORE entry was
  //                    added or removed this round. The byte table above the constant and its
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last
  //                    because it seals the bytes every step above it moved. CACHE is NOT bumped:
  //                    install rewrites every CORE entry into the same store.
  // ITEMS 43-b / 47-b (2026-08-27, feat/reminder-settings-20260826). THE REMINDER SETTINGS.
  //                    A group inside the Settings screen carrying four independent reminders --
  //                    the morning adhkar door, the evening adhkar door, the daily wird and the
  //                    daily content -- each with a switch, a time the reader picks, and (for the
  //                    two where a count is right) up to three times a day. All four default OFF.
  //                    The feed joins the prayers through ezikSchedItems and every item carries a
  //                    route naming its destination; the shell fires them and a browser tab does
  //                    not, which the screen says to the reader in its own line.
  //                    app.jsx grew and app.js followed 1171036 -> 1193820 (+22784), and
  //                    CORE_BYTES 2013883 -> 2036667 is exactly that delta -- no CORE entry was
  //                    added or removed this round. The byte table above the constant and its
  //                    SW_PROSE mirror below both followed, and THIS digest is re-cut last
  //                    because it seals the bytes every step above it moved. CACHE is NOT bumped:
  //                    install rewrites every CORE entry into the same store.
  //   adhkar ship   -- the two doors go to every reader. FOUR things move and the digest is cut
  //                    after all of them. (1) PRECACHE: adhkar-split-27.json joins CORE beside
  //                    adhkar.json, so the doors survive a cold offline boot instead of falling
  //                    back to the undivided group; its revalidation needed no line, because the
  //                    fetch handler already moves every same-origin *.json but the two sealed
  //                    mushaf files to stale-while-revalidate. (2) The twins guard is WIDENED to
  //                    compare the split pair as well -- same checks, same order, no new gate,
  //                    roster still 99. (3) A favourite saved as 27:<position> is resolved
  //                    through the data to a dhikr id and lights that dhikr in its new door --
  //                    READ ONLY, nothing migrated or renamed. (4) The switch default is RAISED:
  //                    no parameter means the doors, and ?adhkargroups=0 is the rollback that
  //                    costs no deploy. app.jsx grew and app.js followed 1167264 -> 1171036
  //                    (+3772). CORE_BYTES 2002929 -> 2013883 = that delta plus the 7182 the new
  //                    CORE entry weighs. The byte table above the constant gained a term for it
  //                    and its SW_PROSE mirror gained the figure, so B14 can check it. CACHE is
  //                    NOT bumped and does not need to be: install rewrites every CORE entry
  //                    into the same store, which is measured, not assumed.
  //   adhkar split  -- category 27 opens as TWO doors instead of one. The owner's own file,
  //                    adhkar-split-27.json, assigns the twenty-four adhkar of the morning and
  //                    evening group to a morning door of 23 and an evening door of 21, and
  //                    carries its own wording for the six that are said differently after
  //                    noon. adhkar.json is NOT edited -- it is byte-identical, and repeat,
  //                    audio and id still come from its rows by id. The client fetches the
  //                    split from a byte copy at the root, made with fs.copyFileSync; that
  //                    file is NOT in CORE, so it is not precached and every failure to load
  //                    it falls back to the unsplit screen. app.jsx grew and app.js followed
  //                    1160295 -> 1167264 (+6969). app.js is in CORE, so three numbers moved
  //                    with it and all three are re-cut in the SAME commit as this digest:
  //                    CORE_BYTES 1995960 -> 2002929 by tools/core-bytes.cjs --write, the
  //                    app.js figure in the byte table above that constant, and its SW_PROSE
  //                    mirror below. THIS digest was cut LAST, after both sw.js edits. The
  //                    worker itself did not change: one integer and one figure in prose.
  //                    CACHE is NOT touched -- this branch is a preview and ships nothing.
  //   adhkar groups -- the adhkar reader gained a group standing line, a remembered position, a
  //                    bead card that spends one repetition per tap, and a first door chosen by
  //                    the clock -- all behind ?adhkargroups=1 and all OFF by default. app.jsx
  //                    grew and the app.js it builds followed 1147830 -> 1160295 (+12465).
  //                    app.js is in CORE, so three numbers moved with it and all three are
  //                    re-cut in the SAME commit as this digest: CORE_BYTES 1983495 -> 1995960
  //                    by tools/core-bytes.cjs --write, the app.js figure in the byte table
  //                    above that constant, and its SW_PROSE mirror below. THIS digest was cut
  //                    LAST, after both sw.js edits. The worker own behaviour did not change:
  //                    what moved inside sw.js is one integer and one figure in prose. CACHE is
  //                    NOT touched -- the store name is a ship decision the merge round owns,
  //                    and this branch is a preview that ships nothing.
  //   2026-08-26   -- THE DOOR OUT: deleting the account from inside the app, which Apple
  //                    requires of anything that creates one and which the sign-in round
  //                    shipped without. api/auth-delete.js is new and is the ONLY caller of
  //                    lib/auth/account.js deleteAccount(), which performs THREE erasures in a
  //                    fixed order: the verified-email index FIRST -- and only when the entry
  //                    names this very account, because the index is written NX and may still
  //                    name a different, living one -- then the account record, then the
  //                    session through revokeSession(), which had been loaded since sign-in
  //                    landed with no caller. The index goes first so a failure there leaves
  //                    the record standing and the address still derivable for a retry. The
  //                    account is known from the SESSION ALONE: no provider, no subject and no
  //                    address is read from the body, so the route cannot be aimed at anyone
  //                    else's account. A dead session, an expired one, an unreadable store and
  //                    an account already gone all answer 401 with the SAME code, so nothing
  //                    here is an oracle for whether an account exists. ZERO new store keys and
  //                    ZERO new environment variables; `pc:` is neither read nor written.
  //                    app.jsx gained the two-press control inside EzikSignInRow, drawn only
  //                    where a live session already is, and twelve dictionary entries. app.js
  //                    was rebuilt from that source 1143467 -> 1147830 (+4363), CORE_BYTES was
  //                    re-cut 1979132 -> 1983495 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1143467 -> 1147830, and THIS digest was cut last, after
  //                    all of them. sw.js is 44266 bytes before and after: only two numbers in
  //                    it moved. CACHE is NOT touched -- the store name is the merge round's.
  //   2026-08-26   -- THE SIGN-IN BRIDGE: the web half of the shell's auth handshake. app.jsx
  //                    gained ONE place that builds a sign-in request and ONE that posts it --
  //                    four fields, `v` the STRING "1" and never the number, and a `url` that is
  //                    always OUR /api/auth-start on ezik.app because the shell refuses to open
  //                    anything else. The contract's five refusal reasons are sorted into THREE
  //                    treatments -- a dismissal is silence and no red line, a message the shell
  //                    judged malformed is a programming fault that is never retried on its own,
  //                    and a device that could not open the sheet waits for the reader's own
  //                    gesture -- and a SIXTH reason nobody has heard of takes the last of those.
  //                    There is NO DEADLINE on the path, deliberately and provably: closing the
  //                    sheet IS the answer, so a timer would fire while a reader was still typing
  //                    a password and release the button under them. A client state is minted per
  //                    press with crypto.getRandomValues, kept in memory and NEVER stored, and a
  //                    return that does not carry it back is refused before its ticket is read.
  //                    The row draws ZERO nodes outside the shell. ONE key is stored -- the
  //                    session -- and resetAll erases it, so delete.html's promise that exactly
  //                    one thing remains stays true without a letter of that page being edited.
  //                    app.js was rebuilt from that source 1126907 -> 1143467 (+16560), CORE_BYTES
  //                    was re-cut 1962572 -> 1979132 by tools/core-bytes.cjs --write, the app.js
  //                    figure in the byte table above CORE_BYTES and the SW_PROSE mirror below
  //                    both followed 1126907 -> 1143467, and THIS digest was cut last, after all
  //                    of them. sw.js is 44266 bytes before and after: only two numbers in it
  //                    moved. CACHE is NOT touched -- the store name is the merge round's.
  //   2026-08-25   -- THE SAVE PIPE: the web half of the shell's download handler. app.jsx gained
  //                    ONE place that builds a download request and ONE that posts it -- seven
  //                    fields, `v` the STRING "1" and never the number, `b64` standard-alphabet
  //                    with the data: prefix cut through the comma and no whitespace in it, and
  //                    `size` the RAW byte count re-derived from the very characters sent rather
  //                    than guessed. The four-mebibyte limit is mirrored on this side so an
  //                    oversized file is never carried across to be handed back. There is NO
  //                    DEADLINE on the path, deliberately and provably: the shell answers only
  //                    after the reader closes the platform share sheet, which can take minutes,
  //                    so a timer that failed the request would be a lie about a save still open.
  //                    Without the bridge both presses are byte-identical to what they were: the
  //                    same anchor, the same download name, the same blob, zero messages and zero
  //                    new lines drawn. Six dictionary keys in both languages carry the shell's
  //                    five reasons and a general sixth, so no contract word reaches a screen.
  //                    app.js was rebuilt from that source 1111212 -> 1126907 (+15695), and app.js
  //                    IS in CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write`
  //                    re-cut CORE_BYTES 1946877 -> 1962572, the app.js figure in the byte table
  //                    above that constant and its SW_PROSE mirror below both followed 1111212 ->
  //                    1126907, and THIS digest was cut last, after all of them. sw.js is 44266
  //                    bytes before and after, CR = 0: both figures kept their digit count and
  //                    only their values moved. CACHE is NOT touched: the store name stays
  //                    ezik-v32, because lifting it is a ship decision and not a work step.
  //                    tools/save-bridge-measure.cjs is the new proof -- 34 cases and six mutants,
  //                    every one of them killed. Three of those cases RENDER both seats through a
  //                    small React and count NODES, because "nothing changed in the browser" is a
  //                    claim about a tree and a claim about a tree is not proved by one about a press.
  //   2026-08-25   -- item 67, the second half: the READER'S SWITCH, and the path from the press
  //                    to the first scheduled reminder. app.jsx gained one storage key
  //                    (ezik_prayer_notify_v1), default OFF and off by construction rather than by
  //                    a value written at first run -- exactly one string means on and every other
  //                    reading of that slot, including a storage that throws, is off. ezikSchedItems
  //                    is gated on it, so a reader who has not asked builds nothing and the pipe
  //                    stays silent through all nine of its triggers. The switch is drawn inside the
  //                    prayer times panel and ONLY inside the shell: no bridge, no control, because a
  //                    stored preference no engine will read is a promise with nothing behind it. The
  //                    `enable` operation -- the one thing in the contract that can raise a system
  //                    prompt -- has a single call site, inside the press, outside every effect; a
  //                    refusal returns the switch to off in the store and on the screen with one
  //                    quiet line and no automatic retry; turning it off sends `cancel` once and
  //                    moves the pipe's fingerprint with it, so no later trigger posts an empty
  //                    rebuild dressed as a schedule. Seven dictionary keys in both languages.
  //                    app.js was rebuilt from that source 1100763 -> 1111212 (+10449), and app.js IS
  //                    in CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write` re-cut
  //                    CORE_BYTES 1936428 -> 1946877, the app.js figure in the byte table above that
  //                    constant and its SW_PROSE mirror below both followed 1100763 -> 1111212, and
  //                    THIS digest was cut last, after all of them. sw.js is 44266 bytes before and
  //                    after, CR = 0: both figures kept their digit count and only their values
  //                    moved. CACHE is NOT touched: the store name stays ezik-v32, because lifting
  //                    it is a ship decision and not a work step. tools/wird-guard.cjs (gate 107) is
  //                    NOT touched either -- the switch is named and worded to clear its ban rather
  //                    than the ban widened to clear the switch, and the component is declared
  //                    OUTSIDE the panel slice that gate scans for timers and permissions.
  //                    tools/schedule-payload-measure.cjs grew from 37 cases to 51: it now compiles
  //                    the lifted block through @babel/core and renders the switch against a small
  //                    React, so what is drawn is measured and not asserted. Five mutants were run
  //                    against it -- enable sent from an effect, a refusal leaving the switch on, an
  //                    off that cancels nothing, a gate removed, and the switch drawn without a
  //                    shell -- and all five went red; app.jsx came back byte for byte after each.
  //   2026-08-25   -- item 67, the call at its time: the ONE feed that had an anchor rides the
  //                    pipe the commit before this one built. app.jsx gained ezikAdhanItems():
  //                    the five prayers of the next seven local days, taken from prayerTimesFor()
  //                    -- the one calculator already in this file -- and converted from MINUTES
  //                    FROM LOCAL MIDNIGHT into absolute epoch milliseconds by rebuilding the
  //                    local WALL CLOCK of each day, so a day across a daylight change lands on
  //                    the clock the reader reads. It calls no builder that STORES: arming must
  //                    not create a store for a reader who never opened the prayer sheet, and
  //                    that is measured by counting writes through a fake, not asserted. One
  //                    dictionary key in both languages ('prayer.due'); the sunrise is filtered
  //                    out by name because it is not a prayer. app.js was rebuilt from that
  //                    source 1095406 -> 1100763 (+5357), and app.js IS in CORE, so the ritual
  //                    ran in this commit and in this order: `npm run build:app` regenerated the
  //                    bundle, `node tools/core-bytes.cjs --write` re-cut CORE_BYTES 1931071 ->
  //                    1936428, the app.js figure in the byte table above that constant and its
  //                    SW_PROSE mirror below both followed 1095406 -> 1100763, and THIS digest
  //                    was cut last, after all of them. sw.js is 44266 bytes before and after,
  //                    CR = 0. CACHE is NOT touched: the store name stays ezik-v32, because
  //                    lifting it is a ship decision and not a work step. tools/wird-guard.cjs
  //                    (gate 107) was NARROWED in the same commit -- its whole-file ban on the
  //                    latin type name became an exact allowance of one declaration plus two new
  //                    checks it never had, so its assertion count went UP 1122 -> 1124.
  //   2026-08-25   -- the schedule pipe, the web half. app.jsx gained the web end of the shell's
  //                    notification contract: one place that builds a schedule message with
  //                    ABSOLUTE epoch-millisecond timestamps, drops anything already past, sends
  //                    nothing at all when window.ReactNativeWebView is absent, and never sends
  //                    the same payload twice. NOTHING RIDES IT YET -- the feed returns an empty
  //                    list, so the pipe is silent in a shell as well as in a tab. app.js was
  //                    rebuilt from that source 1082779 -> 1095406 (+12627), and app.js IS in
  //                    CORE, so the ritual ran in this commit and in this order: `npm run
  //                    build:app` regenerated the bundle, `node tools/core-bytes.cjs --write`
  //                    re-cut CORE_BYTES 1918444 -> 1931071, the app.js figure in the byte table
  //                    above that constant and its SW_PROSE mirror below both followed 1082779
  //                    -> 1095406, and THIS digest was cut last, after all of them. sw.js is
  //                    44266 bytes before and after, CR = 0: every figure kept its digit count
  //                    and only its value moved. CACHE is NOT touched: the store name stays
  //                    ezik-v32, because lifting it is a ship decision and not a work step.
  //                    tools/schedule-payload-measure.cjs is added in the same commit and lifts
  //                    the pipe out of app.jsx with @babel/parser to hold it to all of the above.
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
  //   item 91-A     -- storage-quota management: an estimate before the first write, one
  //                    persist() request, a reason on every recorded failure, and an eviction
  //                    rule that drops OLD stores (never the current one) and retries once.
  //                    B12 below was cut in the SAME commit as this digest.
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
  //   item 93      -- THE TASBIH. CORE itself did not change -- no file was added to it and none
  //                    removed -- but app.js IS in CORE and the bundle grew with the section, the
  //                    log and the card row, so the worker's byte table and CORE_BYTES both moved
  //                    and this digest is re-cut after them. CORE_BYTES was re-cut by
  //                    node tools/core-bytes.cjs --write, never by hand.
  //   item 95      -- THE SHARIAH CALCULATOR. Nine client-side calculators on a new home card.
  //                    CORE itself did not change -- no file entered it and none left -- but
  //                    app.js IS in CORE and the bundle grew with the module, the dictionary
  //                    keys and the style block: 1454895 -> 1499541 (+44646) under an
  //                    index.html that did not move at all. So CORE_BYTES followed
  //                    2440723 -> 2485369, re-cut from the disk by
  //                    node tools/core-bytes.cjs --write and never by hand, and the byte
  //                    table above that constant carries the same measurement. Both sw.js
  //                    edits and the SW_PROSE mirror were made first; this digest was cut
  //                    LAST, after all of them, on a tree measured at CR = 0. CACHE is NOT
  //                    touched: the store name is a ship decision and the merge round owns
  //                    the bump, and nothing in this item is deployed.
  //   item 96      -- THE DAILY GOLD PRICE IN THE CALCULATOR. CORE itself did not change -- no
  //                    file entered it and none left -- but app.js IS in CORE, and the bundle
  //                    grew with the new item 96 module, the karat picker, the two lines under
  //                    the gold price field and fourteen dictionary keys: 1499541 -> 1512566
  //                    (+13025) under an index.html that did not move at all. So CORE_BYTES
  //                    followed 2485369 -> 2498394, re-cut from the disk by
  //                    node tools/core-bytes.cjs --write and never by hand, and the byte table
  //                    above that constant carries the same measurement. Both sw.js edits and
  //                    the figure in the table at :2061 were made first; this digest was cut
  //                    LAST, after all of them, on a tree measured at CR = 0. CACHE is NOT
  //                    touched: the store name is a ship decision, the merge round owns the
  //                    bump, and nothing in this item is deployed.
  //   item 96-b    -- THE TWO LINES ITEM 96 LEFT UNTRUE. The hint under the calculator picker
  //                    still told the reader that every price is theirs to type, and the item 95
  //                    block header still told the next reader that nothing here is fetched and
  //                    that the feature declares no storage key. Both are text, and nothing in
  //                    the worker changed on account of either -- but app.js is in CORE and the
  //                    bundle carries both: 1512566 -> 1513535 (+969) under an index.html that
  //                    did not move. So CORE_BYTES followed 2498394 -> 2499363, re-cut from the
  //                    disk by node tools/core-bytes.cjs --write and never by hand, and the byte
  //                    table above that constant and the figure in the table at :2073 carry the
  //                    same measurement. Both sw.js edits and that figure were made first; this
  //                    digest was cut LAST, after all of them, on a tree measured at CR = 0.
  //                    CACHE is NOT touched: the store name is a ship decision, the merge round
  //                    owns the bump, and nothing in this item is deployed.
  //   item 99      -- THE BYTE LEDGER FOLLOWS THE FILES IT SEALS. CORE itself did not change --
  //                    no file entered it and none left -- but index.html AND app.js are both in
  //                    CORE and both moved in this repair round. index.html carries the closing
  //                    screen's structured data below the body instead of in the head and two
  //                    store links fewer in its noscript: 152137 -> 153974 (+1837). app.js was
  //                    rebuilt by node tools/build-app.cjs from an app.jsx that draws the closing
  //                    block on the last card only: 1513535 -> 1518634 (+5099). So CORE_BYTES
  //                    followed 2499363 -> 2506299 = the two deltas summed, re-cut from the disk
  //                    by node tools/core-bytes.cjs --write and never by hand, and the byte table
  //                    above that constant and the two figures in the table at :2094 and :2102
  //                    carry the same measurement. sw.js is NOT in CORE, so the constant is not
  //                    a fixed point and one pass settles it. Both sw.js edits and those two
  //                    figures were made first; this digest was cut LAST, after all of them, on a
  //                    tree measured at CR = 0. CACHE is NOT touched: the store name is a ship
  //                    decision, the merge round owns the bump, and nothing in this item is
  //                    deployed.
  //   item 99 ship -- THE STORE NAME FOR THE SHIP. This is the merge round that sw.js:48 and the
  //                    note above SW_CACHE both defer the bump to, so the bump is made here:
  //                    CACHE ezik-v33 -> ezik-v34 in sw.js, and SW_CACHE below with it, in this
  //                    one commit. THE SHIP ROUND RAISED THE CACHE NAME SO THE NEW SHELL REACHES
  //                    READERS WHO ALREADY CARRY THE OLD ONE: a returning reader holds the old
  //                    bundle in the old store, and only a changed worker installs, sweeps every
  //                    store that is not the new name in activate, and hands them this item
  //                    instead of the build they already have. NOTHING ELSE IN THE WORKER MOVED.
  //                    NO CORE FILE CHANGED -- none entered CORE and none left it, and
  //                    index.html, app.js and every other CORE entry are byte for byte what this
  //                    branch already carried and what the gates passed on -- so NO BYTE FIGURE
  //                    MOVED: CORE_BYTES is still 2506299, re-measured against the disk by node
  //                    tools/core-bytes.cjs, and the byte table above that constant and the
  //                    SW_PROSE mirror below are untouched. The two store names are the same
  //                    eight characters, so sw.js is 46792 bytes before and after this edit. THIS
  //                    digest is re-cut LAST, after the sw.js edit, on a tree measured at CR = 0.
  //   2026-09-13   -- ITEM 94: THE SHARE CARD IS DRAWN ONLY FOR AN ATTRIBUTED REPLY, AND SHRINKS
//                    BEFORE IT CUTS. INDEX.HTML DID NOT MOVE this round -- everything is in
//                    app.jsx -- so the shell figure and its mirror were already true and only the
//                    BUNDLE figures moved. app.js was rebuilt 1529930 -> 1533210 (+3280) by node
//                    tools/build-app.cjs, and CORE_BYTES was re-cut 2517595 -> 2520875 (+3280) by
//                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    the shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13   -- ITEM 89: THE FORTY NAWAWI, WITH IBN RAJAB'S ADDITIONS, AS A SECTION.
//                    INDEX.HTML DID NOT MOVE this round either -- the section is app.jsx, one new
//                    root file (arbaeen.json, NOT in CORE), the guard inventory and the handoff --
//                    so the shell figure and its mirror were already true and only the BUNDLE
//                    figures moved. app.js was rebuilt 1533210 -> 1544535 (+11325) by node
//                    tools/build-app.cjs, and CORE_BYTES was re-cut 2520875 -> 2532200 (+11325) by
//                    node tools/core-bytes.cjs --write, which is exactly the bundle delta because
//                    the shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13   -- ITEM 27: THE DAILY VERSE CARD OPENS ITS TAFSIR. INDEX.HTML DID NOT MOVE this
//                    round either -- the screen is app.jsx, one new root file (daily-tafsir.json,
//                    NOT in CORE), the guard inventory and the handoff -- so the shell figure and
//                    its mirror were already true and only the BUNDLE figures moved. app.js was
//                    rebuilt 1544535 -> 1550360 (+5825) by node tools/build-app.cjs, and
//                    CORE_BYTES was re-cut 2532200 -> 2538025 (+5825) by node
//                    tools/core-bytes.cjs --write, which is exactly the bundle delta because the
//                    shell did not grow. The worker table at :121 and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE UNTOUCHED and
//                    CACHE IS NOT BUMPED: this is a branch for the owner to preview, not a ship.
  //   2026-09-13-ii -- ITEM 92-ج, THE ERASE: the owner's inbox gains delete-one, delete-selected
//                    and delete-the-whole-tab. INDEX.HTML DID NOT MOVE this round either -- the
//                    three controls are app.jsx and the sixth action is a SERVER FUNCTION
//                    (api/inbox.js, which is not an asset, is not in CORE and is not sealed
//                    here), and no root file was added -- so the shell figure and its mirror were
//                    already true and only the BUNDLE figures moved. app.js was rebuilt
//                    1683961 -> 1697965 (+14004) by node tools/build-app.cjs, and CORE_BYTES was
//                    re-cut 2772292 -> 2786296 (+14004) by node tools/core-bytes.cjs --write,
//                    which is exactly the bundle delta because the shell did not grow. The worker
//                    table at :121 and the app.js mirror below followed, and THIS digest is re-cut
//                    LAST. SW.JS IS OTHERWISE UNTOUCHED and CACHE IS NOT BUMPED: this is a branch
//                    for the owner to preview, not a ship, and sw.js says the merge round owns
//                    the bump.
  //   2026-09-13   -- ITEM 92-ج: THE OWNER'S INBOX. INDEX.HTML DID NOT MOVE this round either --
//                    the two panels are app.jsx, the route is a SERVER FUNCTION (api/inbox.js,
//                    which is not an asset, is not in CORE and is not sealed here), and no root
//                    file was added -- so the shell figure and its mirror were already true and
//                    only the BUNDLE figures moved. app.js was rebuilt 1652685 -> 1683961 (+31276)
//                    by node tools/build-app.cjs, and CORE_BYTES was re-cut 2741016 -> 2772292
//                    (+31276) by node tools/core-bytes.cjs --write, which is exactly the bundle
//                    delta because the shell did not grow. The worker table at :121 and the app.js
//                    mirror below followed, and THIS digest is re-cut LAST. SW.JS IS OTHERWISE
//                    UNTOUCHED and CACHE IS NOT BUMPED: this is a branch for the owner to preview,
//                    not a ship, and sw.js says the merge round owns the bump.
  //   2026-09-14   -- ITEM 87: THE DAY, FROM WAKING TO SLEEPING. INDEX.HTML DID NOT MOVE this
//                    round -- the section is app.jsx and ONE new root file -- so the shell figure
//                    and its mirror were already true. But that file JOINS CORE, which is the
//                    difference from the three rounds above it: sunan-day.json (84759 bytes, 138
//                    rows in eight phases) is precached beside arbaeen.json, so SW_CORE and
//                    SW_CORE_FILES gained an entry and SW_PROSE gained a row, and CORE_BYTES is
//                    NOT the bundle delta alone this time. app.js was rebuilt 1697965 -> 1711339
//                    (+13374) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2786296 -> 2884429 (+98133) by node tools/core-bytes.cjs --write, which is
//                    that bundle delta plus the 84759 the new CORE entry weighs. The worker's own
//                    byte table above the constant gained a term for it and the app.js mirror
//                    below followed, and THIS digest is re-cut LAST, after every other sw.js edit
//                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch
//                    of it moved -- and CACHE IS NOT BUMPED: install rewrites every CORE entry
//                    into the same store, and sw.js says the merge round owns the bump.
  //   2026-09-14-ii -- ORDER 87D: ITEM 87 MOVES FROM THE SIDE DRAWER ONTO THE HOME SHELF. The
//                    owner ruled that the day from waking to sleeping is a SECTION of Ezik and
//                    sits immediately after the adhkar, so the drawer row was removed and a
//                    twelfth tile took its place. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR
//                    LEFT CORE this round -- sunan-day.json is byte-identical to the round above
//                    and is still precached -- so SW_CORE, SW_CORE_FILES and every row of
//                    SW_PROSE but one were already true. app.js was rebuilt 1711339 -> 1713640
//                    (+2301) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2884429 -> 2886730 (+2301) by node tools/core-bytes.cjs --write, which is
//                    exactly the bundle delta because the shell did not grow and CORE gained
//                    nothing. The worker's own byte table above the constant and the app.js
//                    mirror below followed, and THIS digest is re-cut LAST, after every other
//                    sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store
//                    and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns
//                    the bump.
  //   2026-09-14-iii -- ITEM 88 DEFECT 5+6: THE THROTTLE GETS ITS OWN SENTENCE. /api/articles-list
//                    answered 429 to 48 of the check round's requests and every one reached the reader as the
//                    outage line, so ezikArticlesFetchList now carries the status out and the two sections draw
//                    a fourth state. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1713640 -> 1715759
//                    (+2119) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2886730 -> 2888849 (+2119),
//                    verified by node tools/core-bytes.cjs, which is exactly the bundle delta because the shell
//                    did not grow and CORE gained nothing. The worker's own byte table above the constant and
//                    the app.js mirror below followed, and THIS digest is re-cut LAST, after every other sw.js
//                    edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it
//                    moved -- and CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-14-iv -- ITEM 88 DEFECT 4: THE COMPLAINT DOOR SAYS WHAT BECAME OF THE MESSAGE
//                    BEFORE IT MOVES ANYWHERE. It sets the refusal line and no longer navigates on the same tick,
//                    so the sentence is actually painted; the hand-off to الإعدادات is now the reader's own press
//                    on the button beside it. Neither half touches a route, a store or a cached file. INDEX.HTML
//                    DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed
//                    size is the bundle. app.js was rebuilt 1715759 -> 1717162 (+1403) by node tools/build-app.cjs,
//                    and CORE_BYTES was re-cut 2888849 -> 2890252 (+1403), verified by node tools/core-bytes.cjs,
//                    which is exactly the bundle delta because the shell did not grow and CORE gained nothing. The
//                    worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED
//                    -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round
//                    owns the bump.
  //   2026-09-14-v -- ITEM 88 DEFECT 13: THE GREETING NO LONGER ENDS ON A VOCATIVE WITH NOBODY
//                    AFTER IT. A whole-sentence key joins home.hello and is drawn instead of it when the app has
//                    no name for the reader. Nothing else moves. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR
//                    LEFT CORE this round -- the only CORE entry that changed size is the bundle. app.js was
//                    rebuilt 1717162 -> 1717848 (+686) by node tools/build-app.cjs, and CORE_BYTES was re-cut
//                    2890252 -> 2890938 (+686), verified by node tools/core-bytes.cjs, which is exactly the bundle
//                    delta because the shell did not grow and CORE gained nothing. The worker's own byte table
//                    above the constant and the app.js mirror below followed, and THIS digest is re-cut LAST,
//                    after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store
//                    and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-14-vi -- ITEM 88 DEFECT 12: THE ADHKAR CHEST NAMES THE SECTION ABOVE THE GROUP.
//                    The group that opens and the order of the groups are UNCHANGED -- only a label was added over
//                    the title, read from the same module.adhkar key the shelf tile draws. INDEX.HTML DID NOT MOVE
//                    and NO FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed size is the
//                    bundle. app.js was rebuilt 1717848 -> 1718515 (+667) by node tools/build-app.cjs, and
//                    CORE_BYTES was re-cut 2890938 -> 2891605 (+667), verified by node tools/core-bytes.cjs, which
//                    is exactly the bundle delta because the shell did not grow and CORE gained nothing. The
//                    worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED
//                    -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round
//                    owns the bump.
  //   2026-09-14-vii -- ITEM 88 DEFECT 14: A REFRESH IN THE MIDDLE OF A SECTION COMES BACK TO IT.
//                    One sessionStorage key records the shelf id the reader pressed; the boot effect and four lazy
//                    initialisers read it back, «delete all my data» sweeps it, and the theme-coverage guard's N10
//                    asserts the same claim it always did against the destination's new spelling. The FIRST opening
//                    of the app still lands on the chat, because a new tab has no session record. No route, no store
//                    and no cached file is involved. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this
//                    round -- the only CORE entry that changed size is the bundle. app.js was rebuilt 1718515 ->
//                    1724747 (+6232) by node tools/build-app.cjs, and CORE_BYTES was re-cut 2891605 -> 2897837
//                    (+6232), verified by node tools/core-bytes.cjs, which is exactly the bundle delta because the
//                    shell did not grow and CORE gained nothing. The worker's own byte table above the constant and
//                    the app.js mirror below followed, and THIS digest is re-cut LAST, after every other sw.js edit
//                    was final. SW.JS IS OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and
//                    CACHE IS NOT BUMPED: the merge round owns the bump.
  //   2026-09-15-i -- ITEM 88 BATCH B, ITEM 1: A RELOAD INSIDE THE MUSHAF LANDS ON THE INDEX, NOT ON
//                    THE READING PAGE. The item-14 repair returned the reader to the page he was on, and that page
//                    carries no way to the shelf; entering المصحف from the shelf still opens where he left off, so
//                    item 87 is untouched. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1724747 -> 1727829 (+3082)
//                    by node tools/build-app.cjs, and CORE_BYTES was re-cut 2897837 -> 2900919 (+3082), verified by
//                    node tools/core-bytes.cjs, which is exactly the bundle delta because the shell did not grow and
//                    CORE gained nothing. The worker's own byte table above the constant and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS
//                    OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED:
//                    the merge round owns the bump.
  //   2026-09-15-ii -- ITEM 88 BATCH B, ITEM 2: THE ADHKAR OPEN ON THE WHOLE CATALOGUE. The clock's
//                    door is removed from the section's front entrance by the owner's words; no other entrance and no
//                    group order changes. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE this round -- the
//                    only CORE entry that changed size is the bundle. app.js was rebuilt 1727829 -> 1728316 (+487) by
//                    node tools/build-app.cjs, and CORE_BYTES was re-cut 2900919 -> 2901406 (+487), verified by node
//                    tools/core-bytes.cjs, which is exactly the bundle delta because the shell did not grow and CORE
//                    gained nothing. The worker's own byte table above the constant and the app.js mirror below
//                    followed, and THIS digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS
//                    OTHERWISE UNTOUCHED -- no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED:
//                    the merge round owns the bump.
  //   2026-09-15-iii -- ITEM 88 BATCH B, ITEM 3: A SAVED CONVERSATION OPENED FROM THE SIDE MENU NOW
//                    MOVES THE SCREEN TO THE CHAT. One line inside openSavedChat, where every door to a saved
//                    conversation passes; no call site and no history layer changes. INDEX.HTML DID NOT MOVE and NO
//                    FILE JOINED OR LEFT CORE this round -- the only CORE entry that changed size is the bundle.
//                    app.js was rebuilt by node tools/build-app.cjs, and CORE_BYTES was re-cut by the same delta,
//                    verified by node tools/core-bytes.cjs, because the shell did not grow and CORE gained nothing.
//                    The worker's own byte table above the constant and the app.js mirror below followed, and THIS
//                    digest is re-cut LAST, after every other sw.js edit was final. SW.JS IS OTHERWISE UNTOUCHED --
//                    no route, no store and no branch of it moved -- and CACHE IS NOT BUMPED: the merge round owns
//                    the bump.
  //   2026-09-15 merge -- ITEM 88, THE MERGE ROUND: THE STORE NAME IS BUMPED ezik-v34 -> ezik-v35.
//                    Every seal note in this trip deferred the bump to the merge round, and this is it, so a
//                    returning reader who holds the old bundle in the old store gets a changed worker that
//                    installs, sweeps every store that is not the new name, and hands him this trip. NOTHING
//                    ELSE IN SW.JS MOVED -- no route, no branch and no byte table -- and the file is the same
//                    48510 bytes because the new name is the same length as the old. SW_CACHE below follows
//                    it in this same commit, and THIS digest is re-cut LAST, after the name was final.
  //   2026-09-15-e -- SIDE ROUND, REBASE ONTO ITEM 88: THE STORE NAME GOES ONE STEP,
//                    ezik-v35 -> ezik-v36. The merge round bumped v34 -> v35 for its own trip and
//                    said so above; this branch then rebased onto it and REBUILT, so the worker
//                    this tree ships is not the worker v35 named -- app.js is 1766936 bytes here
//                    and CORE_BYTES is 2940026, neither of them the figure v35 was cut against.
//                    A returning reader holding the v35 store would otherwise keep a bundle this
//                    tree no longer builds, so the name moves one step and activate sweeps it.
//                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE. sw.js is 48510 bytes
//                    before and after the bump, because the new name is the same length as the old;
//                    what moved inside it is the name, the byte table's app.js figure and
//                    CORE_BYTES, the last two re-cut by node tools/core-bytes.cjs --write and not by
//                    hand. SW_CACHE above follows the name in this same commit, and THIS digest is
//                    re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-a -- SIDE ROUND, ITEM 102: THE ANSWER IS TYPED INSTEAD OF FLASHED AND THE PAGE
//                    STAYS ON THE QUESTION. INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT
//                    CORE: the whole item is app.jsx -- the reveal queue gained a ceiling, the
//                    completion waits for that queue instead of emptying it, and the ask pin is no
//                    longer disarmed by the turn going quiet. So the shell figure and its mirror
//                    were already true and only the BUNDLE figures moved. app.js was rebuilt from
//                    app.jsx by node tools/build-app.cjs, 1766936 -> 1776728 (+9792), and
//                    CORE_BYTES was re-cut 2940026 -> 2949818 (+9792) by node
//                    tools/core-bytes.cjs --write and not by hand. sw.js is 48510 bytes before and
//                    after, because both figures are the same seven digits wide.
//                    SW_CACHE IS DELIBERATELY NOT BUMPED HERE, and that is a decision and not an
//                    oversight: the CORE_BYTES prose above says the store name is a ship decision
//                    the merge round owns, and this branch is neither shipped nor pushed. The
//                    2026-09-15-e entry bumped it for the opposite reason -- that branch WAS the
//                    trip -- so whoever ships this one decides the name, and the report for item
//                    102 says so out loud rather than leaving it to be noticed.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-b -- ITEM 102 GOES TO THE MERGE ROUND: THE STORE NAME GOES ONE STEP,
//                    ezik-v36 -> ezik-v37. This ANSWERS the question 2026-09-16-a left open one
//                    commit ago. That entry re-sealed the size and deliberately did NOT bump the
//                    name, because the CORE_BYTES prose calls the name a ship decision the merge
//                    round owns and that branch was not yet shipping. It is now, so the round
//                    that owns the bump is this one and the name moves.
//                    WHY IT HAS TO MOVE. app.js is 1776728 bytes here against the 1766936 the
//                    v36 store was cut for, so a returning reader holding v36 would keep serving
//                    a bundle this tree no longer builds. activate sweeps every name that is not
//                    the current one, so one step is the whole repair.
//                    NOTHING ELSE IN SW.JS MOVED -- no route, no branch, no byte table and no
//                    constant -- and the file is the same 48510 bytes, because v37 is the same
//                    width as v36. TWO LIVE SITES CARRY THIS NAME and both moved in this commit:
//                    `const CACHE` in sw.js and `const SW_CACHE` here. The match was word-bounded
//                    and ezik-mushaf-pages-v1 was counted before and after and did not move --
//                    bumping THAT store would wipe tens of megabytes of page scans off readers'
//                    devices, and it is a different store with a different life.
//                    THIS digest is re-cut LAST, after the name was final.
  //   2026-09-16-c -- SIDE ROUND, ITEM 106: THE APP VERSION HAS ONE SOURCE. INDEX.HTML DID NOT
//                    MOVE and NO FILE JOINED OR LEFT CORE: tools/build-app.cjs now writes one
//                    line, var EZIK_APP_VERSION, from config/app-version.json at the top of the
//                    bundle, and app.jsx sends it with a feedback message. So only the BUNDLE
//                    figures moved. app.js was rebuilt by node tools/build-app.cjs, 1776728 ->
//                    1777203 (+475), and CORE_BYTES was re-cut 2949818 -> 2950293 (+475) by node
//                    tools/core-bytes.cjs --write and not by hand. sw.js is 48510 bytes before and
//                    after. SW_CACHE IS NOT BUMPED: the store name is the merge round's decision.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-d -- ITEM 106-B: THE STORE NAME MOVES ONE STEP AND IS READ FROM ONE SOURCE.
//                    CACHE in sw.js and app_version in config/app-version.json moved v37 -> v38
//                    together, and SW_CACHE here stopped being typed: it is read from that file, so
//                    B11 now holds sw.js to the version file. app.jsx gained the version on the
//                    owner inbox rows, so app.js was rebuilt by node tools/build-app.cjs, 1777203 ->
//                    1777634 (+431), and CORE_BYTES was re-cut 2950293 -> 2950724 (+431) by node
//                    tools/core-bytes.cjs --write. INDEX.HTML DID NOT MOVE and no file joined or left
//                    CORE. sw.js is 48510 bytes before and after (same-width name and figures).
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-16-e -- ITEM 106-D: THE VERSION RIDES THE REPORT PATH, CLEANED AND NEVER STAMPED.
//                    app.jsx's report sender now carries appv from the same built constant the
//                    feedback sender uses; api/report.js keeps it only if it has a build's shape
//                    and otherwise stores '' -- it imports nothing new. The store name did NOT
//                    move -- it stays at v38. app.js was rebuilt by node tools/build-app.cjs,
//                    1777634 -> 1777656 (+22), and CORE_BYTES was re-cut 2950724 -> 2950746 (+22)
//                    by node tools/core-bytes.cjs --write. INDEX.HTML DID NOT MOVE and no file joined
//                    or left CORE. sw.js is 48510 bytes before and after.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-17 -- ITEM 10: THE KUNUZ MODES REPLACE THE TREASURE JOURNEY. ONE LINE OF SW.JS
//                    MOVED: the network-only branch for the quest surface matched
//                    '/quest.html' OR '/quest-data/', and now matches the prefix '/quest', so
//                    quest-ghaws.html and quest-harb.html are never cached either. sw.js is
//                    48510 -> 48468 bytes. NO FILE JOINED OR LEFT CORE and nothing in CORE moved:
//                    app.js, app.jsx and index.html are byte-identical, so CORE_BYTES and the
//                    byte table stand. The store name did NOT move. B11 now dispatches all four
//                    Kunuz paths. THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-17-b -- ITEM 13-B: THE KUNUZ HOME BUTTON OPENS THE SECTIONS. app.jsx gained one
//                    resume id, home: 'home', in EZIK_RESUME_SCREENS, so a Kunuz page that writes
//                    it before leaving for / lands on the bare home screen instead of the chat.
//                    INDEX.HTML DID NOT MOVE and NO FILE JOINED OR LEFT CORE. app.js was rebuilt by
//                    npm run build:app, 1777656 -> 1777668 (+12), and CORE_BYTES was re-cut
//                    2950746 -> 2950758 (+12) by node tools/core-bytes.cjs --write; the byte table
//                    in sw.js and the SW_PROSE mirror of it in B14 follow. sw.js is 48468 bytes
//                    before and after. The store name did NOT move -- it is the merge round's call.
//                    THIS digest is re-cut LAST, after every other sw.js edit was final.
  //   2026-09-19   -- البند ٥٠ §٢: THE FOURTH CONFIDENCE MARK LEAVES THE HADITH CARD. app.jsx
//                    lost NEUTRAL_HADITH_LABEL and the two-way heading initialiser; the card
//                    heading is the constant SUNNAH_CARD_LABEL, «من السنة النبوية», for a card
//                    with attributes and for one without. INDEX.HTML DID NOT MOVE and NO FILE
//                    JOINED OR LEFT CORE. app.js was rebuilt by npm run build:app,
//                    1780467 -> 1782018 (+1551), and CORE_BYTES was re-cut 2953557 -> 2955108
//                    (+1551) by node tools/core-bytes.cjs --write; the byte table in sw.js:142
//                    and the SW_PROSE mirror of it in B14 follow, both 1780467 -> 1782018.
//                    sw.js is 48468 bytes before and after. The store name did NOT move -- it is
//                    the merge round's call. THIS digest is re-cut LAST, after every other sw.js
//                    edit was final.
  //   2026-09-24   -- QUOTE ORDER: A BOOK'S QUOTATION KEEPS ITS HARAKAT. app.jsx gained
//                    BOOK_QUOTE_REPLY_RE and one line in stripTashkeelOutsideQuran: a reply the
//                    server composed from a library atom (lib/lib-quote.js) keeps its blockquote
//                    byte for byte with the toggle off. INDEX.HTML DID NOT MOVE and NO FILE
//                    JOINED OR LEFT CORE. app.js was rebuilt by npm run build:app,
//                    1782018 -> 1782629 (+611), and CORE_BYTES was re-cut 2955108 -> 2955719
//                    (+611) by node tools/core-bytes.cjs --write; the byte table in sw.js:142
//                    and the SW_PROSE mirror of it in B14 follow, both 1782018 -> 1782629.
//                    sw.js is 48468 bytes before and after. The store name did NOT move -- it is
//                    the merge round's call. THIS digest is re-cut LAST, after every other sw.js
//                    edit was final.
  //   2026-09-25   -- PROGRAM ORDER 2026-09-24, TWO REBUILDS. M3-g (1aa6524): the related-lessons
//                    strip sends the reader's question beside its query, 1782629 -> 1783027 (+398).
//                    M5-b: the «المكتبة» layer, its menu row and the book card's door (LIB_NAV_V1),
//                    1783027 -> 1812316 (+29289). INDEX.HTML DID NOT MOVE and NO FILE JOINED OR
//                    LEFT CORE. app.js was rebuilt by npm run build:app each time, and CORE_BYTES
//                    was re-cut 2955719 -> 2956117 -> 2985406 by node tools/core-bytes.cjs --write;
//                    the byte table in sw.js:142 and the SW_PROSE mirror of it in B14 follow.
//                    sw.js is 48468 bytes before and after. The store name did NOT move -- it is
//                    the merge round's call. THIS digest is re-cut LAST, after every other sw.js
//                    edit was final.
  'sw.js': '57bfb7dc405fef522fb467cbe00b2415a350a5a02eaf78443abaa3ad716bc84f',
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
// ITEM 106-B -- THE STORE NAME IS READ, NOT RETYPED. config/app-version.json is the one source of the
// version; sw.js's CACHE is the only other hand-written copy, and B11 below is what holds the two
// together: the worker must open exactly the store this file names.
const SW_CACHE = (() => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'app-version.json'), 'utf8')).app_version;
  if (typeof v !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(v)) {
    throw new Error('config/app-version.json: app_version is not a usable store name: ' + JSON.stringify(v));
  }
  return v;
})();
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
// ITEM 85 ADDED THE LAST TWO. They are the two Noto Naskh Arabic cuts the FIRST SCREEN pulls,
// self-hosted since the boot stopped waiting on Google for its type. A CORE that stored the app
// and not the face it is drawn in leaves an offline returning reader in the UA's fallback serif.
const SW_CORE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/icon-maskable-512.png', '/icon-watermark.png', '/adhkar.json',
  '/adhkar-split-27.json', '/arbaeen.json', '/daily-tafsir.json',
  '/arbaeen-footnotes.json', '/sunan-day.json',
  '/app.js', '/vendor/react.umd.js', '/vendor/react-dom.umd.js',
  '/fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2',
  '/fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2'];
// The files CORE names on disk, in the same order. B12 re-derives their byte sum and refuses a
// CORE_BYTES constant that has fallen below it.
const SW_CORE_FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'icon-watermark.png', 'adhkar.json', 'adhkar-split-27.json',
  'arbaeen.json', 'daily-tafsir.json', 'arbaeen-footnotes.json', 'sunan-day.json',
  'app.js', 'vendor/react.umd.js', 'vendor/react-dom.umd.js',
  'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2',
  'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2'];
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
// ITEM 10: the Kunuz bank, read the way a browser reads it -- one classic script that
// declares a global DATA -- in a vm with nothing else in scope.
// ---------------------------------------------------------------------------
function loadKunuzBank(p) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
  return ctx.DATA;
}
const countOf = (hay, needle) => hay.split(needle).length - 1;

async function compare(bankPath) {
  let pass = 0, fail = 0;
  const ok = m => { pass++; console.log('  PASS ' + m); };
  const no = (c, m) => { fail++; console.log('  FAIL [' + c + '] ' + m); };

  // -- K1 the shared bank ------------------------------------------------
  console.log('\n-- K1 the shared Kunuz bank --');
  if (path.normalize(bankPath) !== path.normalize(BANK)) no('K1', 'the gate was pointed at ' + bankPath + ', not ' + BANK);
  let D = null;
  try { D = loadKunuzBank(path.join(__dirname, BANK)); } catch (e) { no('K1', BANK + ' does not evaluate: ' + (e && e.message)); }
  if (D && Array.isArray(D.qs) && Array.isArray(D.cats)) {
    if (D.qs.length === BANK_QUESTIONS) ok('question count = ' + BANK_QUESTIONS);
    else no('K1', 'question count = ' + D.qs.length + ' (accepted at ' + BANK_QUESTIONS + ')');
    if (D.cats.length === BANK_CATEGORIES) ok('category count = ' + BANK_CATEGORIES);
    else no('K1', 'category count = ' + D.cats.length + ' (accepted at ' + BANK_CATEGORIES + ')');
    let shape = 0;
    const ids = new Set(), perCat = D.cats.map(() => 0);
    D.qs.forEach((q, i) => {
      const at = 'question ' + i;
      if (!Array.isArray(q) || q.length !== 9) { shape++; no('K1', at + ' is not the nine-field shape'); return; }
      if (!Number.isInteger(q[0]) || q[0] < 0 || q[0] >= D.cats.length) { shape++; no('K1', at + ' category ' + q[0] + ' out of range'); }
      else perCat[q[0]]++;
      if (typeof q[3] !== 'string' || !q[3].trim()) { shape++; no('K1', at + ' has no stem'); }
      const o = q[4];
      if (!Array.isArray(o) || o.length < 3 || o.length > 4) { shape++; no('K1', at + ' does not offer 3..4 options'); }
      else {
        if (o.some((x) => typeof x !== 'string' || !x.trim())) { shape++; no('K1', at + ' has an empty option'); }
        if (new Set(o.map((x) => String(x).trim())).size !== o.length) { shape++; no('K1', at + ' repeats an option'); }
        if (!Number.isInteger(q[5]) || q[5] < 0 || q[5] >= o.length) { shape++; no('K1', at + ' key ' + q[5] + ' out of range'); }
      }
      if (typeof q[8] !== 'string' || !q[8]) { shape++; no('K1', at + ' has no id'); }
      else if (ids.has(q[8])) { shape++; no('K1', at + ' repeats id ' + q[8]); }
      else ids.add(q[8]);
    });
    const empty = perCat.map((n, i) => (n ? -1 : i)).filter((i) => i > -1);
    if (empty.length) { shape++; no('K1', 'categories with no question: ' + empty.join(', ')); }
    if (!shape) ok('all ' + D.qs.length + ' questions are well-formed, ids unique, no empty category');
  } else if (D) no('K1', BANK + ' evaluated, but DATA has no qs/cats arrays');

  // -- K2 one copy of the bank -----------------------------------------------
  console.log('\n-- K2 one copy --');
  const qd = fs.readdirSync(path.join(__dirname, 'quest-data')).sort();
  if (qd.length === 1 && qd[0] === path.basename(BANK)) ok('quest-data/ holds exactly one file: ' + qd[0]);
  else no('K2', 'quest-data/ holds [' + qd.join(', ') + '] -- expected only ' + path.basename(BANK));
  const embedders = fs.readdirSync(__dirname).filter((f) => /\.html$/.test(f))
    .filter((f) => fs.readFileSync(path.join(__dirname, f), 'utf8').indexOf('var DATA=') > -1);
  if (!embedders.length) ok('no root page embeds a bank of its own');
  else no('K2', 'pages embedding their own bank: ' + embedders.join(', '));

  // -- K3 the two modes ------------------------------------------------------
  console.log('\n-- K3 the two modes --');
  for (const f of KUNUZ_MODES) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) { no('K3', f + ' is ABSENT'); continue; }
    const h = fs.readFileSync(p, 'utf8');
    if (countOf(h, BANK_TAG) === 1) ok(f + ' loads the shared bank exactly once');
    else no('K3', f + ' loads the shared bank ' + countOf(h, BANK_TAG) + ' times');
    if (/<a\b[^>]*href="\/quest\.html"/.test(h)) ok(f + ' carries the way back to /quest.html');
    else no('K3', f + ' has no link back to /quest.html');
    if (/<a\b[^>]*href="\/"/.test(h)) ok(f + ' carries the way home to /');
    else no('K3', f + ' has no link home to /');
  }

  // -- K4 the hub ------------------------------------------------------------
  console.log('\n-- K4 the hub --');
  {
    const h = fs.existsSync(path.join(__dirname, KUNUZ_HUB)) ? fs.readFileSync(path.join(__dirname, KUNUZ_HUB), 'utf8') : '';
    if (!h) no('K4', KUNUZ_HUB + ' is ABSENT');
    else {
      if (/<a\b[^>]*href="\/"/.test(h)) ok('the hub carries the home link to /');
      else no('K4', 'the hub has no home link to /');
      for (const f of KUNUZ_MODES) {
        if (h.indexOf('href="/' + f + '"') > -1) ok('the hub opens ' + f);
        else no('K4', 'the hub has no door to ' + f);
      }
      if (h.indexOf(BANK) === -1) ok('the hub does not load the bank');
      else no('K4', 'the hub loads the bank -- a door page must stay light');
    }
  }

  // -- K5 the app's entry ----------------------------------------------------
  console.log('\n-- K5 the entry from the app --');
  {
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const n = countOf(app, "window.location.href='/quest.html'");
    if (n > 0) ok('app.js still enters the treasure at /quest.html (' + n + ' sites)');
    else no('K5', 'app.js no longer navigates to /quest.html -- the hub is unreachable from the app');
  }

  // -- B10 the sealed files --------------------------------------------------
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
      // ITEM 10: the whole Kunuz surface sits under one prefix and stays network-only.
      for (const qp of ['/quest.html', '/quest-ghaws.html', '/quest-harb.html', '/' + BANK]) {
        if (swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch(qp).responded
          || swLoad(swPath, () => Promise.resolve(swRes('x'))).dispatch(qp, 'navigate').responded) {
          moved++; no('B11', 'the worker intercepts ' + qp + ' -- a phone would be frozen on an old Kunuz page or bank');
        }
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
      { n: 153974, of: 'index.html' },
      // ITEM 85. The two CORE entries the self-hosted faces added, stated in the worker's byte
      // table beside the rest and re-derived here from the files they name. They are the arabic
      // and latin cuts of Noto Naskh Arabic, which is what the first screen is painted in.
      { n: 94032, of: 'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2' },
      { n: 19696, of: 'fonts/RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2GHV0.woff2' },
      // ITEM 32. The three CORE entries the CDN removal added, each stated in the worker's own
      // byte table and each re-derived here from the file it names.
      { n: 1812316, of: 'app.js' },
      { n: 131835, of: 'vendor/react-dom.umd.js' },
      { n: 10751, of: 'vendor/react.umd.js' },
      { n: 368386, of: 'icon-watermark.png' },
      { n: 177392, of: 'adhkar.json' },
      // The owner's split of category 27, precached beside adhkar.json since the ship round.
      { n: 7182, of: 'adhkar-split-27.json' },
      // ITEM 2. The two corpora that joined CORE on 2026-09-13 -- the forty and the daily verse's
      // tafsir -- each stated in the worker's byte table and re-derived here from the file it names.
      { n: 67360, of: 'arbaeen.json' },
      { n: 23984, of: 'daily-tafsir.json' },
      // ITEM 4. The forty's footnotes, precached beside the corpus they answer, stated in the
      // worker's byte table and re-derived here from the file it names.
      { n: 9322, of: 'arbaeen-footnotes.json' },
      // ITEM 87. The day from waking to sleeping, the sixth corpus in CORE, stated in the
      // worker's byte table and re-derived here from the file it names.
      { n: 84759, of: 'sunan-day.json' },
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
if (mode === '--compare' && process.argv[3]) {
  // B11 executes the service worker, so compare() is async. A rejection here must
  // be a loud non-zero exit, never a silent unhandled-rejection warning above a 0.
  compare(process.argv[3]).catch((e) => {
    console.log('  FAIL [B11] the guard itself threw: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
else {
  console.error('usage: node quest-bank-integrity-guard.cjs --compare quest-data/kunuz-bank-3147.js');
  process.exit(2);
}
