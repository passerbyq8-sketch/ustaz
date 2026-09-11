ITEM 96B - THE TWO LINES ITEM 96 LEFT UNTRUE
BUILD REPORT - 12 September 2026
=====================================================

Worktree: C:\EZIK-LIB\_wt\item96-goldprice-20260912
Branch:   feat/item96-gold-price-20260912   (base 03dbb05)
Not pushed, not merged, not deployed. No pull request. No vercel call. No branch switch.


1. WHAT WAS CHANGED
-------------------
Two pieces of text, and the four derived numbers that follow any change to app.js.

1.1 The reader-facing one. The VALUE of calc.offline, on both sides of EZ_I18N, replaced with
    the owner's approved sentence, copied character for character out of
    C:\EZIK-LIB\_orders\ITEM96B-STRINGS-2026-09-12.json. Verified byte for byte after the write:
    the shipped line equals "    'calc.offline': '" + strings.<lang> + "'," exactly, on both
    sides. The key name did not change, no key was added and none was removed, and the value is
    still one line in the same shape as calc.back and calc.pick.title.

1.2 The code-facing one. One ITEM 96 paragraph APPENDED to the item 95 block header, after the
    existing paragraph and before MONEY IS NEVER A FLOAT. No existing line there was deleted or
    rewritten. It states the four facts the order names and nothing else, in ASCII English, at
    the width and with the marker convention of the lines around it (no line over 100 columns).

1.3 One new case in the item 96 battery (section 5 below), and nothing else in that file.


2. FILES TOUCHED, AND THE DIFFSTAT
----------------------------------
    app.jsx                             the two calc.offline values, and the appended paragraph
    app.js                              BUILT, never hand edited: node tools/build-app.cjs
    sw.js                               the byte table line and CORE_BYTES
    quest-bank-integrity-guard.cjs      the app.js figure in SW_PROSE, the re-cut history note,
                                        and the sealed sw.js digest
    tools/item96-goldprice-measure.cjs  the one new case

    $ git --no-pager diff --stat 03dbb05 HEAD

     app.js                             | 12 ++++++++++--
     app.jsx                            | 12 ++++++++++--
     quest-bank-integrity-guard.cjs     | 17 +++++++++++++++--
     sw.js                              |  4 ++--
     tools/item96-goldprice-measure.cjs | 14 ++++++++++++++
     5 files changed, 51 insertions(+), 8 deletions(-)

    (That stat is measured against the fix commit. This report file is the second commit and is
    the only path added by it.)

    index.html was not opened. api/gold-price.js was not opened. gates.json was not opened and no
    gate was registered. No file was staged by a wildcard: every path above was named explicitly
    to git add.


3. THE TWO COMMITS
------------------
    55c9d0aceed67091ecc0ed7905a316220dd038b9   item 96b: the two lines item 96 left untrue
    <second>                                   item 96b: build report

    The second hash is the commit this file is in and so cannot be printed inside it. It is the
    tip of feat/item96-gold-price-20260912 and its message is exactly "item 96b: build report".


4. THE MEASUREMENTS
-------------------
4.1 The calc.offline line numbers in app.jsx

        before (03dbb05)      ar 676      en 1236
        after  (HEAD)         ar 676      en 1236

    Unchanged: the only insertion in app.jsx is the comment paragraph at lines 6495-6502, which
    is far below both dictionary halves. The keys were located by name, not by line number.

4.2 The dictionary key counts

        before (03dbb05)      ar 549      en 549
        after  (HEAD)         ar 549      en 549

    Counted the way the battery and guards/i18n-ui-guard.cjs count them, over the source halves
    of EZ_I18N: /^    '([^']+)':/gm.

4.3 The bundle and the four numbers that follow it

        app.js                    1512566  ->  1513535     (+969)
        CORE_BYTES (sw.js)        2498394  ->  2499363     (+969)
        sw.js byte table line     app.js 1512566  ->  app.js 1513535
        SW_PROSE in the guard     { n: 1512566, of: 'app.js' }  ->  { n: 1513535, of: 'app.js' }

        sealed sw.js digest
          before  cf573dae2e61c1714afca915e1b33d3a2df76f6d274e2439f230c919d306a13a
          after   219cd0694e43b7483a0554aa7fa36cd2c7b8409212f5c57725de1b28abe8cb12

    app.js was produced by node tools/build-app.cjs and by nothing else. CORE_BYTES was written
    by node tools/core-bytes.cjs --write and by nothing else; it reported
    "WROTE  CORE_BYTES  2498394 -> 2499363". index.html did not move (152137 before and after),
    so the whole of the +969 is the bundle. CACHE / SW_CACHE was not touched.

    The digest was cut LAST, after both sw.js edits and after the SW_PROSE figure, from a tree
    measured at CR = 0. Audited immediately before the cut:

        sw.js                               46792 bytes    CR = 0
        app.js                            1513535 bytes    CR = 0
        app.jsx                           1684778 bytes    CR = 0
        quest-bank-integrity-guard.cjs     189852 bytes    CR = 0
        tools/item96-goldprice-measure.cjs  37575 bytes    CR = 0

    The cutting script refuses to run at all if sw.js carries a single CR. No digest anywhere was
    typed by hand.


5. THE BATTERIES
----------------
    $ node tools/item95-calculator-measure.cjs        EXIT=0     === 115/115 - PASS ===
    $ node tools/item96-goldprice-measure.cjs         EXIT=0     === 146/146 - PASS ===

    Both measured on the built tree, with the item 96 battery at its committed 03dbb05 content -
    that is, before the new case was added, which is what step 5.4 of the order asks for.

    THE NEW CASE (step 5.5), and it is one case and not more:

        calc.offline no longer claims that every price is typed by the reader

    It is asserted by what the two values do NOT say. The sentence the item 95 hint used to carry
    is forbidden on both sides, together with the short phrase inside it that carries the claim:

        ar:  the tail of the old Arabic sentence - the clause that said "and the prices are
             from your own entry, and yours alone" - and, on its own, the single Arabic word
             inside it that carries "and yours alone"
        en:  'the prices are yours alone to type', and 'yours alone'

    (Both Arabic substrings are in the battery source, not in this report: this report is ASCII.)

    The Arabic was NOT retyped. It is lifted byte for byte out of the shipped sentence at
    03dbb05 by the script that wrote the case, because a retyped Arabic literal differs from the
    shipped one in its diacritics and would pass vacuously against anything. The script refused
    to write unless each forbidden substring was present in the old value AND absent from the new
    one.

    With the case in place:

    $ node tools/item96-goldprice-measure.cjs         EXIT=0     === 147/147 - PASS ===

    AND IT WAS PROVED TO BITE. Both calc.offline values were mutated back to the item 95 sentence
    in app.jsx, the battery was re-run, and it failed on exactly that case and on nothing else:

        MUTANT_EXIT=1        === 146/147 - FAIL ===
          * calc.offline no longer claims that every price is typed by the reader

    app.jsx was then restored from the byte copy taken before the mutation, and the battery was
    re-run green at 147/147. The committed app.jsx is the restored file.


6. THE SUITE
------------
    $ npm run gates

        === SUITE: 111/112 EXIT=0 ===
        recon:    SUMMARY   PASS=203   WARN=1   FAIL=0
        tree after: 0 dirty path(s)
        FAILING (1): liveness=1

    That is the expected text: 111/112, the single failure is liveness, and recon FAIL=0.
    liveness has failed since 7 August and was not touched. Every other gate exited 0, including
    babel, bankintegrity, i18nui, attrtruth, taghonesty and deletetruth.

    The suite was run on the committed tree, after the fix commit, and it reported the tree clean
    ("tree after: 0 dirty path(s)"). This report file was written afterwards, so it is not in
    that measurement.


7. THE RED LINES, RE-MEASURED
-----------------------------
7.1 No Shariah number moved. No expiation figure, no nisab, no rate, no source citation was
    opened. The only lines of app.jsx that changed are two dictionary VALUES and eight comment
    lines.

7.2 The money arithmetic was not touched. No parseFloat, no Number(), no float was added
    anywhere; the battery's own no-float scan over both halves still passes.

7.3 The three protected blobs, hashed before the first edit and again after the last one:

        2aef40e9f3b23bddc2315bbb165a5a60c87ffe06633d23fba864c6a73b29e063  guards/attribution-truth-guard.cjs
        75a78a3576b443b870d032e22105b8d33d8b96acf5d5057176fce7b20c559f6b  guards/tag-honesty-guard.cjs
        b975472c29a405472b22dbf2779e21476295eea701d15289fa2a6cd4b79b6977  api/ask.js

    Identical in both measurements. None of the three appears in the diffstat.

7.4 api/gold-price.js was not opened.

7.5 No battery case and no guard assertion was weakened, deleted or relaxed. Nothing was made to
    pass by editing an assertion. One case was ADDED, as step 5.5 requires. See section 8.

7.6 app.js was built, never hand edited.

7.7 No gate was registered. gates.json was not opened.

7.8 index.html was not touched.


8. WHAT I COULD NOT DO EXACTLY AS WRITTEN
-----------------------------------------
ONE DEVIATION, and it is in section 3.2 of the order. It is stated here rather than buried.

The order asks the appended paragraph to state that the calculator screen now has one storage
key, "ezik_gold_price_v1". Writing that literal into app.jsx trips an EXISTING case of the item
96 battery, at tools/item96-goldprice-measure.cjs:494:

    eq('...and the literal appears nowhere else in app.jsx',
      (appSrc.match(/ezik_gold_price_v1/g) || []).length, 1);

That count is taken over the WHOLE of app.jsx, comments included, so a second occurrence in
prose takes it to 2 and the battery goes to 146/147. Section 4.5 of the order forbids me to
relax that assertion, and step 5.4 requires the battery to exit 0.

So the paragraph names the key by its single declaration site instead:

    // calculator screen DOES now have one storage key -- the one that block declares as
    // EZC_GOLD_PRICE_KEY -- which is named in resetAll and stands on the MUST_GO_ALREADY roster.

EZC_GOLD_PRICE_KEY is declared exactly once in app.jsx, at line 6321, as
`const EZC_GOLD_PRICE_KEY = 'ezik_gold_price_v1';` - and the battery asserts that too, in the
case immediately above the one quoted. So the sentence names the key unambiguously and the fact
the order asks for is stated in full: the screen has one storage key, and it is in resetAll and
in MUST_GO_ALREADY. What is not in the comment is the literal string, and the reason is that the
battery forbids it.

I did not edit the assertion, and I did not widen the scope to "fix" it. If the owner would
rather have the literal in the prose, that is a decision about that battery case, not about this
paragraph, and it is theirs to make.

The four facts of 3.2 are otherwise all present, and nothing beyond them was added:
  - the daily gold price is fetched by a separate block above this one, not by this block   YES
  - this block still makes no request of its own: it receives the prices as a prop          YES
  - the gold price field can now arrive pre-filled, and the reader can still overwrite it   YES
  - the calculator screen now does have one storage key, and it is in resetAll and in
    MUST_GO_ALREADY                                                                          YES
    (named as EZC_GOLD_PRICE_KEY rather than as the literal, for the reason above)

NOTHING ELSE WAS BLOCKED. Every other step of the order was carried out as written.
