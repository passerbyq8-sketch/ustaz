# EZIK ITEM 95 — THE SHARIAH CALCULATOR — BUILD REPORT

**Date:** 2026-09-11
**Branch:** `feat/item95-shariah-calculator-20260911`
**Base:** `e703c52` (main) → **one commit: `c168e64`** — "item 95: the Shariah calculator — nine of them, exact arithmetic, zero brain"
**Order:** `EZIK-ITEM95-BUILD-ORDER-20260911-214048.md`

**Not pushed, not merged, not deployed.** One commit on the branch. The working tree is clean apart from this report file.

---

## 1. FILES TOUCHED, WITH BYTE SIZES

| file | before (`e703c52`) | after (`c168e64`) | delta |
|---|---|---|---|
| `app.jsx` | 1622438 | 1669766 | +47328 |
| `app.js` | 1454895 | 1499541 | +44646 |
| `sw.js` | 46792 | 46792 | ±0 |
| `quest-bank-integrity-guard.cjs` | 186476 | 187527 | +1051 |
| `tools/item95-calculator-measure.cjs` | *(absent)* | 29320 | new file |

Nothing else changed. `git diff --name-only e703c52 HEAD` returns exactly those five paths.

**`index.html` was not touched**, so the CRLF rule of order §6 never came into play — measured anyway: it still carries 2040 CR and is byte-identical to the base. The three protected fingerprints (`guards/attribution-truth-guard.cjs`, `guards/tag-honesty-guard.cjs`, `api/ask.js`) are byte-identical to the base; `git diff` over them is empty. The fatwa service was not touched or published.

### Why `sw.js` and `quest-bank-integrity-guard.cjs` are in that list

Neither is part of the feature. `app.js` is a CORE file the service worker precaches, and its byte size is pinned in three places that go red the moment the bundle changes size. Order §6 requires nothing else to go red, so all three were re-cut — in the sequence the seal's own history entries demand:

1. `node tools/build-app.cjs` → `app.js` 1454895 → 1499541 (never hand-edited)
2. the `SW_PROSE` entry `{ n: …, of: 'app.js' }` in `quest-bank-integrity-guard.cjs`
3. the byte table in the `sw.js` comment above `CORE_BYTES` (now `app.js 1499541`)
4. `node tools/core-bytes.cjs --write` → `CORE_BYTES` 2440723 → **2485369** (by the tool, never by hand)
5. the `'sw.js'` digest in `SEALED`, cut **last**, on a tree measured at **CR = 0** → `db75e78a…f10d`, with a dated history entry above it recording all of the above

`sw.js` came out the same length because both replaced numbers have the same digit count. **`CACHE` was deliberately not bumped** — `sw.js` states that the store name is a ship decision the merge round owns, and this item ships nothing.

---

## 2. THE GATE SUITE — BEFORE AND AFTER

| | count | failing |
|---|---|---|
| **before** (`e703c52`, `tree: 0 dirty path(s)`) | `SUITE: 111/112 EXIT=0` | `liveness=1` |
| **after** (`c168e64`, `tree: 0 dirty path(s)`) | `SUITE: 111/112 EXIT=0` | `liveness=1` |

Same count, same single pre-existing failure, nothing else red. Both are `node tools/run-gates.cjs` over all 112 entries of `gates.json`, from a committed tree. The "after" run is the one immediately preceding this report.

Gates worth naming individually, all `EXIT=0` in the final run: `babel` (the committed `app.js` is byte-for-byte what `app.jsx` builds), `recon`, `bankintegrity` (the re-cut seal and byte pins), `themecoverage`, `i18nui`, `lessonssearch`, `attribution`, `a11y`, `chatux`, `deletetruth`.

### One red I caused, and closed

The first post-change suite run came back **110/112 — `liveness=1, i18nui=1`**. The cause was entirely my own measurement harness: it seeded `localStorage` with the interface-language key **by name**, and `guards/i18n-ui-guard.cjs` part E asserts in *both* directions that exactly four files in this tree name that key (`app.js`, `index.html`, `quest.html`, and the guard itself). Mine was the fifth, and the gate said so — correctly.

Fixed the right way rather than by widening the guard's roster: the harness now starts with an **empty** store, lets the app boot in Arabic as a fresh device does, and switches to English through the app's **own** `ezLangSet()`. The key is named nowhere in the file. `i18nui` is back to `336/336` and the roster check still bites.

### A note on this worktree

`node_modules` was absent here, and every guard needing `@babel/core` or `linkedom` failed on `MODULE_NOT_FOUND` — 67 of 112, which looks catastrophic and is not. `package-lock.json` is byte-identical across all six worktrees, so the tree was populated by copying `_wt/main-baseline/node_modules`. `node_modules/` is gitignored and the working tree stayed clean. **The 111/112 baseline above is from after that**, so it is a real baseline and not an artefact.

### ⚠️ One thing to know before you re-run the suite

`tools/run-gates.cjs` exits 1 if the run introduced new untracked paths, and `recon`'s tree-clean check does the same. **This report file is an untracked path at the repository root.** Running the suite with it present will give you `SUITE: 111/112` and then `GATES_EXIT=1`, naming this file — a true statement about the tree, not a regression in any gate. Commit or move the report and it is `EXIT=0` again. (The suite runs quoted above were all made with the tree clean, before this file existed.)

---

## 3. THE TWO NAMED GUARDS — BEFORE AND AFTER

| guard (gate) | before | after |
|---|---|---|
| `theme-coverage-guard.cjs` (`themecoverage`) | `OK: 1445/1445 checks passed.` exit 0 | `OK: 1445/1445 checks passed.` exit 0 |
| `guards/lessons-search-guard.cjs` (`lessonssearch`) | `=== 281/281 - PASS ===` exit 0 | `=== 281/281 - PASS ===` exit 0 |

Same counts both sides — green before, green after.

> The order gives the first as `guards/theme-coverage-guard.cjs`. It is at the **repository root**, `theme-coverage-guard.cjs`, which is how `gates.json` registers it. Same file, same gate.

**How contrast was kept green.** `theme-coverage-guard.cjs` G8 sweeps *every* key of the `s` style object carrying both a background and a colour, in two identities × two modes, against its WCAG threshold. So no new pairing was invented. Every new style key carrying both copies a pairing already measured in that sheet:

| new key | pairing | copied from |
|---|---|---|
| `ezCalcInput` | `surface` / `ink` | `ezTasbihTargetInput`, `ezTasbihRow` |
| `ezCalcPick`, `ezCalcMode` | `surface` / `muted` | `ezTasbihLock` |
| `ezCalcPickOn`, `ezCalcModeOn` | `ice` / `blue` | `ezTasbihLockOn`, `ezTasbihRowOn` |

Counted: of the **27** new `ezCalc*` keys, **5** carry both a background and a colour — the five above, each copying a measured pairing — **13** carry a colour and no background of their own, and **9** carry neither and are layout only. Only the first five are in G8's sweep at all.

`ezHomeModules` was not touched. The feature adds **no new `screen` value** — it is a layer over the home, in the same three shapes as the wird and tasbih sections (`useState`, `useEzikBackLayer(open, close)`, an `ezikHistBack()` toggle in its handler) — so the screen inventory and `EZIK-THEME-33-HANDOFF.md` needed no edit.

---

## 4. `EZ_I18N` KEY COUNTS

| | ar | en |
|---|---|---|
| before | 457 | 457 |
| after | **542** | **542** |

**85 keys per half**, added to both languages in the same commit. Counted with the guard's own source regex (`/^    '([^']+)':/gm`) over each half — the one `i18nui` part A uses. Independently verified: no duplicate key in either half, no key present on one side only, every `{placeholder}` present on both sides, no empty or non-string value. `i18nui` passes `336/336`.

Every label, result, source line, disagreement note, feeding-mode name, calculator name, field label and button text comes from `ezT()`. The only literals a reader sees that are not dictionary values are the em-dash joining two translated strings, the parentheses around the currency unit, and the default currency `KWD` — a value in an editable field, not a label, and the same word in both languages.

---

## 5. THE ACCEPTANCE BATTERY — SECTION 8, EXECUTED

Implemented as `tools/item95-calculator-measure.cjs`. **Not a gate** (order §6: this item most likely needs none, and it does not). Run it with:

```
node tools/item95-calculator-measure.cjs
```

**Result: `=== 115/115 - PASS ===`, exit 0.**

It does not test a copy of the code. The shipped block is cut out of `app.jsx` by `tools/babel-block.cjs` — the helper every coupled guard here uses — transformed with the runtime the page itself pins, evaluated in a linkedom window, and then the calculator is **mounted** and driven by real clicks and real input events. Every value below is read off the DOM those events produced.

### ZAKAT

| case | expected by the order | measured | battery line |
|---|---|---|---|
| A1 cash 1000.000, silver 0.300 | nisab 178.500, REACHES, zakat 25.000 | ✅ both | `A1 cash 1000.000 @ silver 0.300: nisab is 178.500` · `A1 ...REACHES, so zakat is 25.000` |
| A1 cash 100.000, silver 0.300 | nisab 178.500, BELOW, "not due" | ✅ "not due" drawn, **no** zakat figure drawn at all, nisab still 178.500 | `A1 cash 100.000 @ silver 0.300: BELOW nisab, so "not due"` |
| A2 gold 100.000g @ 20.000 | nisab 85g, value 2000.000, zakat 50.000 | ✅ | `A2 ...value 2000.000 and zakat 50.000` |
| **A2 gold 85.000g @ 15.612** | **exactly at nisab → 33.176** | ✅ **33.176** | `A2 THE FLOAT TRAP RENDERED: 85.000g @ 15.612/g reaches nisab exactly and pays 33.176` |
| A3 silver 700.000g @ 0.300 | nisab 595g, value 210.000, zakat 5.250 | ✅ | `A3 ...and the shared silver price carried across: value 210.000, zakat 5.250` |
| A4 trade 2000.000, silver 0.300 | nisab 178.500, REACHES, zakat 50.000, + trade disagreement | ✅ all three | `A4 ...REACHES, so zakat is 50.000` · `A4 ...and the trade-valuation disagreement is present under the result` |

### KAFFARAT — feeding, financial mode, price per mudd 0.750

| case | expected | measured | battery line |
|---|---|---|---|
| B1 yamin 10 × 1 × 0.750 | 7.500 | ✅ | `B1 feeding, financial mode: 10 poor x 1 mudd x 0.750 = 7.500` |
| B2 dhihar 60 × 1 × 0.750 | 45.000 | ✅ | `B2 feeding, financial mode: 60 poor x 1 mudd x 0.750 = 45.000` |
| **B3 qatl khata'** | **no feeding sub-calculator at all** | ✅ | `B3 🔴 NO feeding sub-calculator is rendered AT ALL` |
| B4 jima 60 × 1 × 0.750 | 45.000 + jima-order disagreement | ✅ both | `B4 feeding, financial mode: 60 poor x 1 mudd x 0.750 = 45.000` · `B4 ...and the order disagreement is directly under it` |
| B5 fidyah 10 × 1 × 0.750 | 7.500 + fidyah disagreement | ✅ both | `B5 financial mode: 10 days x 1 mudd x 0.750 = 7.500` · `B5 ...and the basis-and-amount disagreement is directly under the result` |

The B3 negative case is measured **three** ways, not one: no `[data-ezik-calc-feed]` element exists, no mudd-price field exists for the reader to fill in, and no feeding disagreement line appears — because there is no feeding output for one to ride on.

The financial feeding mode is asserted to be a plain multiplication and **not** the zakat rate: `B1 ...and the working names 10 x 1 x 0.750, not a 1/40 of anything` checks both that `10` appears in the working line and that a fortieth of 7.500 (0.187 / 0.188) appears nowhere in the output.

### 🔴 THE FLOAT TRAP — 33.176, AND EXACTLY WHERE THE FILS GOES

**Exact value produced: `33.176`.** Asserted three times — against the arithmetic core directly, against the mounted screen, and once more in Arabic-Indic digits (`٣٣.١٧٦`).

The trap is **demonstrated on this machine, not described**. Three battery lines, all PASS:

```
PASS  THE FLOAT TRAP: 85.000g x 15.612/g, quarter-tenth = 33.176 exactly
PASS  ...and a naive `weight * price * 0.025` in float really does yield 33.175 here
PASS  ...and the loss is in the fortieth, not in the product
```

The second line **runs** the naive expression and asserts its `toFixed(3)` really is `33.175`, so the case is proved to still discriminate rather than assumed to. The third is the one worth reading:

```
85.000 * 15.612       prints 1327.02 AND compares === to the literal 1327.02
                      (the double is in fact 1327.0199999999999818)
that, times 0.025     prints 33.1755          (the double is 33.175499999999999545)
.toFixed(3) of that   is "33.175"
```

**Both printed steps look correct and the answer is still wrong.** The loss is invisible until the rounding, because the fortieth lands just *below* the halfway point instead of on it, so half-up has nothing to round up. The exact fraction lands *on* 33.1755 and rounds to 33.176.

> Worth flagging as a correction I made to my own work: I first wrote a comment in `app.jsx` asserting the product was `1327.0199999999998` and the fortieth `33.175499999999996`. Both were wrong in their digits, and I had not measured either — I had reasoned about where a float loses precision and guessed wrong about which step. The shipped comment now states what `node -e` actually reports, including that the product compares *equal* to `1327.02`. This repository treats a comment that lies as a real defect, and that was one.

### How the arithmetic is exact

- every monetary value is `{ n: BigInt, d: BigInt }` — an exact fraction. `ezcParse` builds it straight from the digits the reader typed and **`Number()` appears nowhere on the path**
- multiplication multiplies numerators and denominators; the nisab comparison is a **cross-multiplication**, so no division happens before a comparison. Asserted exact *at* the boundary and at one millionth *below* it
- the rate is the fraction `1/40` — asserted as `String(n)+"/"+String(d) === "1/40"` — and the battery scans the feature's own source for `0.025`, `* 0.025` and `/ 40.0`: none occurs
- **one** rounding, at render only: `floor((2·10³·n + d) / (2·d))`, which is `floor(10³·n/d + 1/2)` computed in integers with no division before the floor. Half-up asserted at, above and below the halfway point
- 85 g and 595 g are **derived** (20 mithqal × 4.25 g; 200 dirham × 2.975 g), not typed, so the working line the screen prints is the arithmetic the screen actually did
- the parser refuses a sign, a letter, two dots and an over-long entry, and returns `null` for an empty field — drawn as "enter the numbers", never as a zero the reader did not type

**Cross-checked against a second implementation.** The battery calls the shipped functions, which means a bug shared between the code and the battery's expectations would hide. So all 13 monetary values of section 8 were recomputed once more in a throwaway script written independently of the app's own helpers — a different parse, a different multiply, the same half-up formula — and all 13 agree, **33.176 included**. That does not make the arithmetic right by itself; it does mean the number is not an artefact of one implementation.

### The five disagreement spots, and no sixth

Asserted in the code *and* on the screen:

- `EZC_KHILAF` is the only register of them, holds exactly 5 keys, and they are exactly `feed, fidyah, jima, trade, waqs`
- `EzikCalcKhilaf` is the only component that draws one, and an unregistered name renders **nothing**
- the battery then walks all nine calculators and asserts, per calculator, that the set of notes drawn is **exactly** the set allowed there: `a1/a2/a3 → {waqs}`, `a4 → {waqs, trade}`, `b1/b2 → {feed}`, `b3 → {}`, `b4 → {jima, feed}`, `b5 → {fidyah, feed}`
- and across all nine the union is exactly the five — `across all nine, no disagreement outside the five named spots appears`

`waqs` rides with all four zakat results and `feed` with every feeding output; each is still **one** disagreement, shown wherever its own result appears.

### Structure and zero-brain

- every one of the nine draws at least one book-and-page source line, asserted per calculator; and one line's **text** is read, not just its attribute, to confirm it names the book *and* a page — so a line that had lost its book name would fail
- the hawl standing note is asserted to appear **once** for the whole zakat group, not under each result
- **zero network, read two ways.** A *recording* `fetch` / `XMLHttpRequest` / `WebSocket` is installed and asserted still empty after all nine calculators have been driven; and the feature's own source is scanned — **with comments stripped first**, because the block's prose says "no XHR, no WebSocket" and "there is no `api/ask.js` call", and a raw scan finds the very words in the sentence promising their absence — for `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `import(`, `api/ask`, `runEngine`, `askEzik`, `sendMessage(`. **None occurs in code.**
- **no storage key**, asserted by scanning the feature block for `localStorage` and for the `ezik_*_v<n>` key shape: neither appears. So nothing was added to `resetAll` or `MUST_GO_ALREADY`, and `deletetruth` is green. The screen is stateless by design and opens empty every time.
- the home row is asserted to name three cards in order `wird, tasbih, calc`, and to still derive its column count from that array's own length. `ezHomeDuoCards` was not rewritten; the wird and tasbih cards are untouched.

### Section D — the same numbers, in Arabic

A quantity is drawn in the numerals of the interface language, so a Western-digit assertion under Arabic would be measuring the numeral system rather than the arithmetic. The battery therefore runs in English, then switches through the app's own setter and re-asserts: nisab `١٧٨.٥٠٠`, zakat `٢٥.٠٠٠`, no Western digit left in the figures, the float trap still `٣٣.١٧٦` — and that a **citation** keeps the numerals its own dictionary wrote it in, because a volume and a page are a reference, not a quantity.

---

## 6. WHAT IS ON THE SCREEN

One card on the home row (`«حاسبة الشريعة»`, third of three) opens one section: a chooser of nine, and the chosen calculator's panel below it.

- **Zakat (4):** cash, gold, silver, trade goods. One silver-price field serves A1's nisab yardstick, A3's price per gram and A4's yardstick — **asked once**, because it is the same number in all three and asking twice would let a reader give two answers to one question. One hawl standing note for the group.
- **Kaffarat (5):** yamin (a *choice* of three, drawn as a `<ul>`, then the fast), dhihar (an *ordered* `<ol>` of three), accidental killing (an ordered pair, **no feeding**), jima in Ramadan (the majority order with the disagreement directly under it), fidyat al-siyam (a mudd per day, whole days only).
- **The feeding sub-calculator** is written once and used in four places, with two modes: by measure (a measure, no money at all) and by financial estimate (the reader's own price per mudd).
- Currency is a **word the reader types**, defaulting to `KWD`. Nothing is converted, because nothing here knows what anything is worth in anything.

---

## 7. SCOPE — NOTHING DROPPED

- §1 zero-brain ✅ (read from the code *and* measured at runtime — §5)
- §2 landed on the existing row; `ezHomeDuoCards` extended, not rewritten; `ezHomeModules` untouched; `Ezik…Section` naming followed ✅
- §3 all nine calculators, every sourced figure, every working line in the exact shape given, and the shared feeding sub-calculator ✅
- §3-Disagreements exactly five spots, nowhere else, proved per calculator ✅
- §4 integer/fraction arithmetic, rate as `1/40`, one round-half-up at render, the 33.176 case as a test ✅
- §5 85 keys in both halves, 542/542, equal ✅
- §6 both named guards green before and after; no new surface pairing; no storage key; no new gate; `index.html` untouched; `app.js` rebuilt through `tools/build-app.cjs`; full suite re-run immediately before this report ✅
- §7 explicit filenames in every `git add`; no push, merge or deploy; fatwa service untouched; the three protected fingerprints untouched ✅
- §8 the full battery, 115/115 ✅

**Nothing in the order is missing, and no figure was invented or fetched.** Every Shariah number in the code comes from §3 of the order. `C:\EZIK-LIB\index\ezik-shamela-*.db` and the `lib/` search paths were never opened; no figure was found to be missing.

All **19** citation strings were read back out of the dictionary and checked one by one against the order's own text — `calc.ref.rate` `vol 23 p265` · `hawl` `vol 23 p242, vol 8 p161` · `mithqal` `vol 23 p263, vol 21 p29` · `mithqalG` `vol 20 p249, vol 21 p29` · `dirham` `vol 23 p264, p264-265, vol 32 p170` · `dirhamG` `vol 20 p249` · `trade` `vol 23 p272, p276, vol 32 p344` · `b1` `vol 35 p105, vol 5 p116` · `b2` `vol 29 p208-209, vol 5 p116` · `b3` `vol 35 p105, vol 10 p129` · `b4` `vol 28 p78` · `b4order` `vol 28 p78-79, p79-80` · `b5` `vol 32 p67` · `mudd` `vol 26 p305, vol 38 p296` · `feed` `vol 35 p101, p101-102` · `khilafWaqs` `vol 23 p265-266` · `khilafTrade` `vol 23 p272-273` · `khilafJima` `vol 35 p104-105, vol 10 p128` · `khilafFidyah` `vol 32 p66, p67, vol 28 p79-80`. Every one matches. The ar half carries the same references in Arabic-Indic numerals.

### Three things the order did not ask for, done because §6 required it

1. **`node_modules` populated in this worktree** (copied from `_wt/main-baseline`; identical lock). Without it, 67 of 112 gates fail on a missing module and no baseline is measurable. Gitignored; the tree stayed clean.
2. **The `app.js` byte-pin ritual** — `SW_PROSE`, the `sw.js` byte table, `CORE_BYTES`, and the `sw.js` seal, with a dated history entry (§1). The order does not mention it, but §6's "nothing else goes red" requires it. `CACHE` deliberately left alone.
3. **Three comment corrections** in my own work: the float paragraph above; a sentence that said "not four disagreements and not five" and counted nothing in particular; and a header claiming `rateWork` was "written once for all four" when A2 and A3 name the rate at the end of their own weighed working line instead.

### One judgement call worth your decision

`tools/item95-calculator-measure.cjs` is a **measurement on demand, not a gate**, per §6's guidance that this item most likely needs none. The consequence is that nothing runs it automatically: a later round could break this feature's arithmetic and `npm run gates` would stay green. If you would rather it bite on every run, registering it costs the five points §6 names (`gates.json`, `recon-audit.cjs`, the gate roster, the report, and `guards/stored-deen-sub-suite.cjs`) — it is a small, separate commit on your word.

---

## 8. RE-CHECKING THIS IN THREE COMMANDS

```
node tools/item95-calculator-measure.cjs     # 115/115 - PASS        the whole battery
node theme-coverage-guard.cjs                # OK: 1445/1445         contrast + screen inventory
node tools/run-gates.cjs                     # SUITE: 111/112, FAILING (1): liveness=1
```

The third will report `GATES_EXIT=1` while this report file sits untracked at the repository root — see the warning in §2.
