# ITEM 96 -- DAILY GOLD PRICE INTO THE ZAKAT CALCULATOR

BUILD REPORT -- 12 September 2026

Worktree: `C:\EZIK-LIB\_wt\item96-goldprice-20260912`
Branch:   `feat/item96-gold-price-20260912`
Base:     `af1ef22795e5ecb6268946760807c0877ebbb36b`

Not pushed. Not merged. No pull request. No vercel. No deploy. No branch switch.
No other worktree was read or written.

---

## 1. WHAT WAS BUILT

The gold-price field of the item 95 Shariah calculator is prefilled once a day from the Kuwait
Ministry of Commerce and Industry. The field stays fully editable. One line under it names the
source and prints the ministry's own publication date, as the ministry printed it. On a day the
fetch does not succeed the field is empty and a failure line shows in place of the source line.
Silver is untouched and stays manual. Nothing else in the app changed.

Karat picker with 24, 22, 21 and 18; default 24; the choice is not stored, so every open starts
at 24. A price the reader typed is never overwritten. Pressing a karat is an explicit act and
does refill the field from that karat.

One round trip on the first open of a new calendar day of the device, and none on any later open
the same day. A failed day is recorded too -- the entry is written with an empty prices object --
so a ministry that is down does not turn "once a day" into "one call per open". A stored price
from a past day is never displayed, never prefilled and never carried forward.

---

## 2. EVERY FILE TOUCHED, CREATED OR DELETED

Nine files. Nothing was deleted. Nothing else in the tree was written.

| File | New? | What changed |
|---|---|---|
| `api/gold-price.js` | CREATED | The endpoint: fetch, parse, two 200 shapes. |
| `tools/fixtures/moci-gold-2026-09-12.html` | CREATED | The real ministry page, the slice carrying the whole table and the update line, as that server served it on 2026-09-12. |
| `tools/item96-goldprice-measure.cjs` | CREATED | The acceptance battery. 146 checks. Not a gate. |
| `app.jsx` | modified | New item 96 block above the item 95 one; 7 dictionary keys on each side; the karat picker, the prefill and the line inside the gold calculator; `EZC_GOLD_PRICE_KEY` in `resetAll`; the hook call and the new prop in the home owner. |
| `app.js` | modified | Rebuilt by `node tools/build-app.cjs`. Never hand edited. |
| `tools/delete-truth-measure.cjs` | modified | `{ c: 'EZC_GOLD_PRICE_KEY' }` added to `MUST_GO_ALREADY`, with its reasoning. |
| `sw.js` | modified | The app.js figure in the byte table, and `CORE_BYTES` by `node tools/core-bytes.cjs --write`. |
| `quest-bank-integrity-guard.cjs` | modified | The app.js figure in the CORE byte table, and the sealed sw.js digest, re-cut last. |
| `.gitattributes` | modified | One pin, `tools/fixtures/*.html -text`, so a clone with core.autocrlf=true cannot rewrite a foreign server's bytes. Not named in the order -- see section 10. |

`git --no-pager diff --stat af1ef22795e5ecb6268946760807c0877ebbb36b HEAD`, taken at the build
commit (before this report was written):

```
 .gitattributes                           |   8 +
 api/gold-price.js                        | 166 +++++++++
 app.js                                   | 115 +++++-
 app.jsx                                  | 249 ++++++++++++-
 quest-bank-integrity-guard.cjs           |  16 +-
 sw.js                                    |   4 +-
 tools/delete-truth-measure.cjs           |  13 +
 tools/fixtures/moci-gold-2026-09-12.html |  47 +++
 tools/item96-goldprice-measure.cjs       | 599 +++++++++++++++++++++++++++++++
 9 files changed, 1202 insertions(+), 15 deletions(-)
```

`index.html` was NOT touched, so order item 9.7 does not apply. Confirmed by
`git diff --stat HEAD -- index.html`, which is empty.

---

## 3. THE TWO COMMITS

| # | Hash | Message |
|---|---|---|
| 1 | `df50cd6` | item 96: daily gold price in the calculator |
| 2 | see below | item 96: build report |

The second hash is the commit that carries this file. It is written at the moment of that commit
and is the tip of `feat/item96-gold-price-20260912`.

---

## 4. THE DICTIONARY

Counts, both halves of `EZ_I18N`, counted in the SOURCE the way `guards/i18n-ui-guard.cjs`
counts them:

| | ar | en |
|---|---|---|
| before | 542 | 542 |
| after | 549 | 549 |

Seven keys, added to BOTH sides in the same commit. The values are the owner's own, copied
verbatim from `C:\EZIK-LIB\_orders\ITEM96-STRINGS-2026-09-12.json`. No Arabic was written by this
build.

```
calc.gold.source
calc.gold.failed
calc.gold.karat
calc.gold.karat24
calc.gold.karat22
calc.gold.karat21
calc.gold.karat18
```

The key names in the strings file were suggestions (`calcGoldSourceLine` and so on). They were
renamed to match the convention the calculator already uses in `EZ_I18N`, which is dotted and
lower-camel inside each segment: `calc.field.goldPrice`, `calc.khilaf.label`, `calc.work.weighed`.
`calc.gold.*` is that convention, and it groups the seven together the way `calc.khilaf.*` and
`calc.work.*` are grouped.

PLACEHOLDER CONVENTION. `ezT()` substitutes `{name}` from its vars argument and matches
`/\{([A-Za-z0-9_]+)\}/g`; a placeholder with no matching variable is left as authored rather than
becoming "undefined". That is the convention already in use (`{g}`, `{p}`, `{book}`, `{ref}`), and
`{date}` follows it. It is present on BOTH sides of `calc.gold.source`, which is what
`i18n-ui-guard` part A checks. The raw ministry date text goes in there and nothing else.

---

## 5. THE BYTES

| | before | after | delta |
|---|---|---|---|
| `app.js` | 1499541 | 1512566 | +13025 |
| `CORE_BYTES` in `sw.js` | 2485369 | 2498394 | +13025 |

The two deltas are equal because no file entered or left `CORE` and `index.html` did not move:
the only CORE entry that changed is `app.js`. `CORE_BYTES` was re-cut by
`node tools/core-bytes.cjs --write` and never by hand. The byte table above the constant in
`sw.js`, and the `{ n: ..., of: 'app.js' }` row in the CORE table in
`quest-bank-integrity-guard.cjs`, carry the same measurement.

SEALED sw.js DIGEST, cut LAST, after both `sw.js` edits, on a tree measured at CR = 0
(`sw.js` is 46792 bytes with 0 CR):

```
old  db75e78a1613cd2b7886def5b2fad2286ac4983f635a6f3b686571694df1f10d
new  cf573dae2e61c1714afca915e1b33d3a2df76f6d274e2439f230c919d306a13a
```

`CACHE` / `SW_CACHE` was not touched. The store name is a ship decision, the merge round owns the
bump, and nothing here is deployed.

---

## 6. THE BATTERIES

### FIXTURE=OK

`tools/fixtures/moci-gold-2026-09-12.html` -- 1584 bytes, 0 CR. It is the slice of
`https://www.moci.gov.kw/ar/nthm-lasaar/gold/` that carries the whole table and the update line,
fetched live on 2026-09-12 and saved byte for byte. It was NOT written by hand. The four dinar
figures it carries are the four the build order states: 43.179 / 39.617 / 37.819 / 32.416, and the
publication line it carries is the one the order measured on 11 September. The live page was read
again at the end of this build and returned exactly the same four figures and the same line, so
the fixture is a current observation and not only a historical one.

### Battery 95 -- `node tools/item95-calculator-measure.cjs`

```
=== 115/115 - PASS ===        EXIT=0
```

Not one case of it was weakened, deleted, renamed or relaxed. Three of its cases are the reason
the architecture below is what it is; all three still pass unchanged:

- `...and the feature's own source names no way of making one`
- `...and it declares no storage key of its own`
- `not one network call was made by any of the nine`

### Battery 96 -- `node tools/item96-goldprice-measure.cjs`

```
FIXTURE=OK
=== 146/146 - PASS ===        EXIT=0
```

Run three times; exit 0 every time.

CASE BY CASE. Every line below printed PASS. One case name contains an Arabic word in the battery
output (the negative check that the Arabic source line never says the Arabic for "today"); it is
the only place, and it is written out in English here so that this report stays ASCII.

**A. THE PARSER -- the real ministry page, read as text** (order 8.1) -- 19 checks

- the fixture is the real page: it carries the table and the update line
- the happy path parses
- karat 24 / 22 / 21 / 18 comes out as the printed digit string (4 checks)
- ...and it is a STRING, not a number (4 checks)
- the date comes out raw, exactly as the ministry printed it
- the ounce row is read past: four karats and no fifth key
- ...and the ounce figure appears nowhere in the result
- the dollar column is never read: no dollar figure reaches the result
- the fixture still carries the ministry figure 32.416 / 37.819 / 39.617 / 43.179 (4 checks)

**B. THE PARSER -- a page whose shape moved. Never a partial result** (order 8.2) -- 30 checks

Each mutation is applied to the REAL fixture in memory and is asserted to have changed it first,
so a mutation that silently matched nothing cannot report a false pass.

- the table is gone: mutation real / ok is false / reason is `table_missing` / NO prices object
- the update line is gone: mutation real / ok is false / reason is `date_missing` / NO prices object
- a single karat row is locatable in the real page
- one karat row is missing: mutation real / ok is false / reason is `karat_missing` / NO prices object
- a price cell is a dash: mutation real / ok is false / reason is `bad_price` / NO prices object
- a price cell uses a comma for the decimal mark: mutation real / ok is false / reason is `bad_price` / NO prices object
- a price cell carries a thousands separator: mutation real / ok is false / reason is `bad_price` / NO prices object
- breaking the ounce row changes the page -- ...and the four karats still parse, because the ounce is never read
- an empty body is a failure, not an empty success -- ...with the table named as the reason

**C. THE TRANSPORT** (order 8.3) -- 11 checks

- a timeout is ok:false -- ...and it is named a timeout rather than a generic failure
- a network error is ok:false -- ...and is named as one
- a non-200 from the ministry is ok:false -- ...and is named by its status rather than parsed anyway
- a redirect that was not followed to a 200 is also ok:false
- a 200 carrying the real page reaches the parser and succeeds -- ...with karat 24 intact through the whole transport
- the declared timeout is 8 seconds
- the URL is the one the order names

**D. THE CONTRACT -- two shapes, both 200, and the cache header** (order 5.4 / 5.5 / 5.6) -- 14 checks

- success answers HTTP 200
- ...and its body carries exactly the six fields the order names
- ...ok is true / source is moci.gov.kw / url is the page the number came from
- ...updated_text is the ministry line, raw
- ...prices carries the four karats as strings
- ...fetched_at is an ISO 8601 UTC instant
- the success cache header is the one the order specifies
- failure ALSO answers HTTP 200
- ...and its body carries ok and reason and nothing else
- ...ok is false -- ...and the reason is short ascii
- a failure is never cached
- a method that is not GET makes no outbound call and answers in the failure shape

**E. THE DAY -- one round trip per calendar day, and never one per open** (order 8.4 / 8.5) -- 15 checks

- a fresh device boots this app in Arabic -- ...and the harness switches it to English through the app's own setter
- the device day is a plain YYYY-MM-DD
- E1 an entry stored for TODAY makes no call at all
- E1 ...and the field is prefilled from the stored 24-karat price
- E1 ...and the line drawn is the source line
- E1 ...carrying the ministry date the entry was stored with
- E2 an entry stored for YESTERDAY costs exactly one call
- E2 ...and the entry now on the device is stamped today
- E3 a device with no entry at all costs exactly one call
- E3 ...and the entry written carries the day, the prices and the ministry text
- E3 ...with the four prices as the strings they arrived as
- E3 ...and the chosen karat is NOT stored
- E3 ...and opening it AGAIN the same day adds no second call
- E3 ...while the field is still prefilled on that second open

**F. THE PRICE PATH -- a digit string into an exact fraction, and no float** (order 8.6) -- 14 checks

- the prefilled string is the ministry's, character for character
- ...and the shipped parser turns that very string into an exact fraction (43179/1000)
- 100.000g at the ministry's 43.179: the value is 4317.900
- ...and the fortieth of it is 107.948, computed as a fraction
- ...which is what the shipped arithmetic makes of it, called directly
- pressing a karat refills the field from THAT karat
- ...and the picker offers exactly the four karats
- a price the reader typed stands
- ...and still stands after leaving the gold calculator and coming back
- ...but pressing a karat -- an explicit act -- does replace it
- the item 96 block is locatable in the shipped source, above the item 95 one
- the client block names no float conversion at all
- api/gold-price.js names no float conversion either
- ...and neither file does arithmetic on a price
- the calculator block itself still makes no request and declares no key

The float scan is over `parseFloat`, `Number(`, `parseInt`, `toFixed`, `Math.round` and
`valueOf()`, with comments stripped first, across BOTH halves of the price path.

**G. THE ROSTER AND THE DICTIONARY** (order 8.7 / 8.8) -- 26 checks

- the key is declared once, as a named constant
- ...and the literal appears nowhere else in app.jsx
- resetAll is locatable -- resetAll removes it
- MUST_GO_ALREADY is locatable -- ...and it names the key
- the two dictionary halves are still the same size
- ...and they are 549 each after this item added seven
- each of the seven keys exists on both sides (7 checks)
- each of the seven has a non-empty value in both languages (7 checks)
- the source line carries {date} in Arabic -- ...and in English
- the failure line carries no placeholder at all
- the source line never says "today" in English
- ...and never says the Arabic word for "today" in Arabic

**H. THE FAILURE STATE, AND THE SILENCE BEFORE IT** (order 8.9 / 6.5 / 6.6 / 6.7) -- 17 checks

- H1 the field is empty
- H1 ...the failure line is the one shown
- H1 ...and the source line is absent
- H1 ...and the karat picker is not drawn, because there is nothing to pick from
- H1 ...and YESTERDAY's price appears nowhere on the screen
- H1 ...and the field is still editable -- ...and typing into it works
- H2 a reply carrying one karat of four is a failure
- H2 ...and the field stays empty rather than half-right
- H2 ...and the day is still recorded, so the failure costs one call and not one per open
- H2 ...with an empty prices object on it
- H3 a call in flight draws NO line of any kind
- H3 ...not the failure line in particular
- H3 ...and the field is empty and waiting
- H3 ...and exactly one call is out
- H4 walking all nine calculators makes no request of any kind

H1 runs on a device that HAS yesterday's four prices stored, so "never the price of yesterday" is
measured against a device that could have shown one.

Other batteries run on the way, both exit 0:

- `node tools/delete-truth-measure.cjs` -- `=== 28/28 cases hold ===`
- `node quest-bank-integrity-guard.cjs --compare quest-data/bank-integrity-golden.json` -- `PASS  76 checks passed, 0 failed.`
- `node tools/build-app.cjs --check` -- `OK: app.js is exactly what this source builds`

---

## 7. THE GATE SUITE

`npm run gates`, run on the COMMITTED tree, after the build commit:

```
=== SUITE: 111/112 EXIT=0 ===
recon:    SUMMARY   PASS=203   WARN=1   FAIL=0
tree after: 0 dirty path(s)
FAILING (1): liveness=1
```

This is exactly the text the order says to expect: SUITE 111/112, FAILING (1) liveness=1,
recon FAIL=0. The suite's own exit code is 1 because `liveness` fails; `liveness` has been failing
since 7 August and was not touched. Its single failing check is
`FAIL  the claimed date is younger than 30 days` (15/16 inside that gate).

The one recon WARN is pre-existing and unrelated to this item:
`LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive in api/report.js)`.

A TRIAL RUN ON THE UNCOMMITTED TREE, recorded here because it is the shape a reader would panic
at: it reported `SUITE: 109/112`, `FAILING (3): recon=1, chatux=1, liveness=1`. Both extra reds
were "the working tree is dirty" reds -- `chatux` asserts no service-worker file is modified
against `git diff HEAD`, and recon's implementation-report check counts differently on a dirty
tree. Committing cleared both without a line of code changing.

---

## 8. THE THREE PROTECTED BLOBS (order 4.2)

Re-measured on the committed tree. `sha256` is of the file on disk; the git blob id is the
committed content, compared against the same path at the base commit.

| File | sha256 (working tree, now) | base blob | HEAD blob | identical? |
|---|---|---|---|---|
| `guards/attribution-truth-guard.cjs` | `2aef40e9f3b23bddc2315bbb165a5a60c87ffe06633d23fba864c6a73b29e063` | `37a02d02...` | `37a02d02...` | YES |
| `guards/tag-honesty-guard.cjs` | `75a78a3576b443b870d032e22105b8d33d8b96acf5d5057176fce7b20c559f6b` | `f5825459...` | `f5825459...` | YES |
| `api/ask.js` | `b975472c29a405472b22dbf2779e21476295eea701d15289fa2a6cd4b79b6977` | `cadc995b...` | `cadc995b...` | YES |

All three are byte identical to the base commit. Nothing under `lib/` on the answer path was
edited: the only `lib/` file this item names at all is `lib/user-agent.js`, and it is IMPORTED,
not modified (`git diff af1ef22 HEAD -- lib/` is empty).

No Shariah number moved: the two nisabs, the 1/40 rate, the expiations and their sources are
untouched, and battery 95 re-measures every one of them.

---

## 9. HOW IT IS PUT TOGETHER, AND THE ONE DECISION THAT SHAPED IT

The network, the storage key and the hook live in a NEW block placed ABOVE the item 95 block, and
the calculator receives four strings and a date as a PROP from the component that opens it.

That is not decoration. Order 4.8 forbids weakening any existing battery case, and order 9.5
requires battery 95 to keep exiting 0. Battery 95 asserts three things about the item 95 block:
that its source names no way of making a request, that it declares no storage key, and that
mounting all nine calculators makes zero network calls. A fetch or a `localStorage` line inside
that block would have failed all three. Moving them OUT of it is not a way around the assertion --
it is the assertion being right: the calculator really does still ask nobody anything, and the one
round trip really does belong to opening the screen rather than to computing anything. The owner
(`EzikHome`) calls `useEzikGoldPrice(calcOpen)` and hands the result down, exactly as it already
reads the wird and the hijri date for the screens below it.

Consequences, each measured in battery 96 section F:

- mounting `EzikCalcSection` with no `gold` prop is the idle state: no line, no picker, no
  prefill, no request. That is how battery 95 mounts it, unchanged.
- the item 95 block still contains no `fetch(`, no `localStorage` and no `ezik_*_v1` literal.

---

## 10. DECISIONS I MADE THAT THE ORDER DID NOT SPELL OUT

Five, all small, all named here rather than left to be found.

1. **A FAILED DAY IS RECORDED, with an empty prices object.** Order 6.1 says never a call on every
   open; order 6.2's stored shape is written `{ "day": ..., "prices": {}, "updated_text": "" }`,
   which is exactly the shape a failed day takes. So a failure writes the entry too. Without it, a
   day on which the ministry was down would have cost one call per open. The reader still sees the
   failure line and an empty field on such a day -- battery 96 H2 measures both halves.

2. **THE KARAT PICKER IS DRAWN ONLY WHEN THERE ARE PRICES TO PICK FROM.** On a failed day the four
   buttons would do nothing at all. The item 95 block already settles this question in the same
   feature: the expiation with no feeding option renders no feeding panel -- "not disabled, not
   hidden, not rendered". The picker follows that rule. The four karats, the default of 24 and the
   refill-on-press behaviour are all exactly as order section 3 locks them.

3. **A METHOD OTHER THAN GET ANSWERS IN THE FAILURE SHAPE, not with a 405.** Order 5.4 and 5.5
   state that this endpoint has exactly two response shapes and that both are HTTP 200. A POST
   therefore gets `{ ok: false, reason: "method" }` at 200 and makes no outbound call, rather than
   a third shape or an amplifier.

4. **A FAILURE CARRIES `Cache-Control: private, no-store`.** Order 5.6 specifies the cache header
   on success only. Serving a failure with the ten-minute success header would turn a one-second
   outage into a ten-minute one for everybody.

5. **ONE LINE ADDED TO `.gitattributes`: `tools/fixtures/*.html -text`.** The fixture is another
   server's bytes, kept so the parser is measured against the real page. A clone with
   core.autocrlf=true would rewrite its line endings. `data/transfer-fixtures/*.html` is pinned the
   same way for the same reason. This file is not named in the order, which is why it is here.

---

## 11. WHAT I FOUND BROKEN AND DID NOT TOUCH

1. `gate liveness` fails, one check: `the claimed date is younger than 30 days`. Failing since
   7 August, named by the order as not to be touched. Untouched.
2. `recon` WARN: `LONGEST_CARD_CHARS = 3405 > longest card 3401 -> cap oversized/stale (re-derive
   in api/report.js)`. Pre-existing, unrelated to this item, and a WARN rather than a FAIL.
   Untouched.
3. **`calc.offline` IS NOW INCOMPLETE, IN BOTH LANGUAGES, AND I COULD NOT REPAIR IT.** The hint
   under the calculator chooser ends, in English, "...and the prices are yours alone to type"; the
   Arabic says the same. After this item the gold price may arrive prefilled from the ministry, so
   that clause is no longer the whole truth. I did not change it: order section 7 says to copy the
   owner's Arabic and not to write my own, and the strings file carries no replacement for this
   key. It needs one Arabic sentence from the owner. `app.jsx:676` (ar) and `app.jsx:1236` (en).
4. **THE ITEM 95 BLOCK'S OWN PROSE IS NOW PARTLY STALE, for the same reason.** `app.jsx:6490`
   reads "every PRICE is typed in by the reader and is never looked up, never defaulted to a
   market rate and never attributed to anybody." As a statement about the item 95 CODE it is still
   exactly true -- that block looks nothing up, and battery 95 re-proves it. As a statement about
   what the reader now sees on the gold screen it is no longer complete. I did not rewrite it: it
   sits inside the block battery 95 scans, order 4.8 forbids disturbing that battery, and order
   section 1 says nothing else in the app changes. It is a comment, not an assertion, and it is
   named here so the next round corrects it deliberately rather than discovering it.

---

## 12. WHAT I COULD NOT DO

Nothing in the order was blocked.

- Network was available, so FIXTURE=OK and cases 8.1 and 8.2 are measured rather than pending.
- No red line was crossed and no existing assertion tripped, so the "STOP and report" clause of
  4.8 was never reached.
- No gate was registered; `gates.json` was not edited.
- `index.html` was not touched, so its CRLF check (9.7) did not apply.
- `node_modules` was not reinstalled. `git add .` was never used -- every file was named.
- The only gaps are the two stale sentences in section 11, items 3 and 4. Both need an owner's
  Arabic sentence, and neither could be repaired inside this order's own rules.
