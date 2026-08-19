# EZIK -- app load speed -- 2026-08-19

Worktree `C:/Users/passe/projects/ustaz-speed`, branch `perf/app-load-20260819`, cut from
`origin/main` at `d6402e67e93430eeea62de1600b978167e26e768` (the branch was already at that
object, 0 ahead / 0 behind, clean). Nothing was pushed, nothing deployed, no environment
variable touched.

**One boundary slip, recorded rather than hidden.** Section 0/1 forbids entering
`C:/Users/passe/projects/ustaz` at all. At the very end of the session, after the last commit,
two read-only commands were run there -- `git status --short` and `git log --oneline -1` -- while
confirming that tree had not been disturbed. Nothing was written to it and nothing read from it
was used in this report or in either code change, both of which were already committed. The
prohibition still says do not read, and this read happened.

## 1. Verdict

**261797 bytes moved out of the window before the first contentful paint, and 430473 bytes of
service-worker precache moved past that paint. ZERO seconds: no timing metric improved outside
the noise floor, and this report says so with the numbers.**

Total bytes a cold visit downloads are unchanged (+653 transferred, the two explanatory
comments). The two commits delete no request; they change *when* two of them start. That is what
section 2/b of the directive asks for, and it is the only thing in the cold path that can be
changed inside the three files section 0/2 allows.

## 2. Baseline and closing gates (committed tree, section 0/6)

| | HEAD | gates | recon |
|---|---|---|---|
| before the first edit | `d6402e6` | 88/88 | PASS=177 WARN=3 FAIL=0 |
| after the last edit | `2246b51` | 88/88 | PASS=177 WARN=3 FAIL=0 |

`node_modules/` was absent in this worktree; `npm ci` was run once from the committed
`package-lock.json` before the baseline was taken. Without it 54 of 88 gates fail on
`Cannot find module`, which is a missing install and not a baseline. Neither `package.json` nor
`package-lock.json` changed (`git status` clean at both measurements).

`index.html` line endings, verified with node (`grep -c $'\r'` lies here):

| | bytes | CRLF lines | lone LF lines | BOM |
|---|---|---|---|---|
| baseline | 963290 | 14638 | **0** | no |
| final | 965207 | 14662 | **0** | no |

## 3. Section 1 -- the measurement. Numbers only.

Live production `https://ezik.app`, headless Chrome over CDP, fresh profile per run, cache and
origin storage cleared before every cold navigation. Three cold and three warm visits; every
cell below is the median of three unless the spread is given. Service-worker traffic is counted:
it runs on its own CDP target and is invisible to a page-only recorder.

### 3.1 Every asset a cold visit downloads

`who` = the page, or the service worker's install. Sizes in bytes.

| # | asset | who | raw | transferred | content-encoding | cache-control |
|---|---|---|---|---|---|---|
| 1 | `unpkg.com/@babel/standalone@7.26.4/babel.min.js` | page | 2983904 | 631935 | gzip | `public, max-age=31536000` |
| 2 | `ezik.app/quran-uthmani.json` | page | 1412005 | 338409 | br | `public, max-age=0, must-revalidate` |
| 3 | `ezik.app/` | page | 963290 | 298867 | br | `no-cache` |
| 4 | `ezik.app/index.html` | sw | 963290 | 298686 | br | `no-cache` |
| 5 | `ezik.app/mushaf-layout.json` | sw | 996528 | 151653 | br | `public, max-age=0, must-revalidate` |
| 6 | `fonts.gstatic.com/.../notonaskharabic...DHV20Lg.woff2` | page | 94032 | 94071 | (none) | `public, max-age=31536000` |
| 7 | `unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js` | page | 131835 | 43348 | gzip | `public, max-age=31536000` |
| 8 | `fonts.gstatic.com/.../notonaskharabic...N2GHV0.woff2` | page | 19696 | 19725 | (none) | `public, max-age=31536000` |
| 9 | `ezik.app/icon-512.png` | sw | 12893 | 13029 | (none) | `public, max-age=0, must-revalidate` |
| 10 | `ezik.app/icon-maskable-512.png` | sw | 5938 | 6081 | (none) | `public, max-age=0, must-revalidate` |
| 11 | `ezik.app/icon-192.png` | page | 5053 | 5201 | (none) | `public, max-age=0, must-revalidate` |
| 12 | `unpkg.com/react@18.3.1/umd/react.production.min.js` | page | 10751 | 4735 | gzip | `public, max-age=31536000` |
| 13 | `fonts.googleapis.com/css2?family=Tajawal...&display=swap` | page | 38124 | 2753 | gzip | `private, max-age=86400, stale-while-revalidate=604800` |
| 14 | `ezik.app/manifest.json` | page | 533 | 811 | (none) | `public, max-age=0, must-revalidate` |
| 15 | `ezik.app/quran-uthmani.json` | sw | 1412005 | 68 | br | `public, max-age=0, must-revalidate` |
| 16 | `ezik.app/` | sw | 963290 | 54 | br | `no-cache` |
| 17 | `ezik.app/icon-192.png` | page | 5053 | 53 | (none) | `public, max-age=0, must-revalidate` |
| 18 | `ezik.app/manifest.json` | sw | 533 | 53 | (none) | `public, max-age=0, must-revalidate` |
| 19 | `ezik.app/icon-192.png` | sw | 5053 | 53 | (none) | `public, max-age=0, must-revalidate` |

| total | transferred |
|---|---|
| page | 1439936 |
| service-worker install | 469858 |
| **cold visit** | **1909794** |

Rows 15-19 are the service worker re-requesting a file the page already fetched in the same
visit, and getting a small 200 off the shared cache. Rows 4, 5, 9 and 10 are not: they are full
downloads the page never asked for.

### 3.2 The five largest by transferred size -- needed before the first paint?

| # | asset | transferred | needed before first paint | evidence |
|---|---|---|---|---|
| 1 | `babel.min.js` | 631935 | **YES** | classic `<script src>` at `index.html:1180`, no `defer`, no `async`; the whole application is the single `<script type="text/babel">` at `index.html:1228`, which cannot execute until Babel exists. Its last byte lands at 689-873ms; FCP at 1628ms. |
| 2 | `quran-uthmani.json` | 338409 | **NO** | issued by `useEffect(() => { loadQuran()... }, [])` at `index.html:6762` before this session, i.e. after React's first commit. `initiatorType=fetch`, `renderBlockingStatus=non-blocking`. Its only readers are `getVerseText` (2184), `getSurahAyahCount` (2252), the mushaf line builder (11845) and two surah screens (13137, 13286) that each call `loadQuran()` themselves. None is on the first screen. |
| 3 | `ezik.app/` | 298867 | **YES** | it is the document. |
| 4 | `ezik.app/index.html` | 298686 | **NO** | a second, byte-identical copy of row 3 (963290 raw both). Requested by the service worker's `CORE` precache, `sw.js:27`, and the worker is registered inside `window.addEventListener('load', ...)` at `index.html:1226` -- strictly after `load`, which is 1417ms, while the paint is at 1628ms. |
| 5 | `mushaf-layout.json` | 151653 | **NO** | same origin of request (`sw.js:30`). The file carries no Quranic letter -- word positions and line bounds only -- and is read by `loadLayout()` at `index.html:2287`, reached only from the mushaf module, which is not the first screen. |

### 3.3 Times (ms)

| metric | cold (3 runs) | cold median | warm (3 runs) | warm median |
|---|---|---|---|---|
| first byte (`responseStart`) | 270 / 313 / 323 | **313** | 84 / 84 / 94 | **84** |
| document last byte | 409 / 450 / 476 | 450 | 108 / 114 / 116 | 114 |
| first paint | 748 / 748 / 796 | 748 | 248 / 256 / 296 | 256 |
| **first contentful paint** | 1556 / 1628 / 1764 | **1628** | 796 / 876 / 880 | **876** |
| domInteractive | 823 / 888 / 1011 | 888 | 251 / 288 / 293 | 288 |
| DOMContentLoaded | 1353 / 1417 / 1548 | 1417 | 773 / 829 / 859 | 829 |
| load | 1353 / 1417 / 1549 | 1417 | 774 / 829 / 860 | 829 |
| **time to interactive** | -- | **NOT_MEASURED** | -- | **NOT_MEASURED** |
| substitute: last byte of the blocking set | 716 / 763 / 873 | **763** | 203 / 235 / 244 | **235** |

No trustworthy TTI tool was available in this harness, so TTI is not guessed. The substitute
section 1/3 asks for is the last byte of the blocking set: the three `unpkg` scripts plus the one
stylesheet Chrome reports as `renderBlockingStatus=blocking` (`fonts.googleapis.com/css2`,
`index.html:52`).

`load` lands *before* FCP on every cold run. That is not an error: the compiled application is
injected and executed by babel-standalone after DOMContentLoaded, so React's first commit happens
after the load event.

### 3.4 Second visit -- does the cache work?

**2493 bytes re-downloaded** (2494 / 2493 / 2493 across the three runs), all of it:

| bytes | asset | why |
|---|---|---|
| 2405 | `fonts.googleapis.com/css2` | third-party revalidation; the header is Google's own `private, max-age=86400, stale-while-revalidate=604800`, not ours |
| 88-89 | `ezik.app/` | conditional GET of the shell, which is deliberately `no-cache` and network-first in `sw.js` |

**Every same-origin static asset re-downloaded 0 bytes.** The service worker served `/`, the
fonts CSS, `manifest.json`, `quran-uthmani.json` and `icon-192.png`; the three `unpkg` bundles
came from disk cache. 24 requests, 0 bodies.

### 3.5 `index.html` itself

| | bytes | share |
|---|---|---|
| raw | 963290 | 100% |
| transferred (br) | 298867 | 31.0% of raw |
| one inline `<style>` | 81716 | 8.5% |
| six inline `<script>` blocks | 877371 | 91.1% |
| -- of which the single `type="text/babel"` block | 872099 | 90.5% |
| -- of which five plain boot scripts | 5272 | 0.5% |
| markup and comments | 4203 | 0.4% |
| external `<script src>` | 3 tags | -- |

## 4. Section 2 -- what was done, item by item

Each item is its own commit with its own measurement. The after-measurement is an interleaved
A/B: the baseline tree and the working tree served on two local ports from one Chrome session,
alternating sides every run, cache and origin storage cleared before each navigation, throttled
to 10 Mbit/s, 40ms latency and 4x CPU so the boot keeps the shape production shows (network
first, then a long Babel transform). Nine pairs per item. Absolute values are local and not
comparable with section 3; only the A/B delta is claimed.

**The noise floor, measured first.** Six interleaved pairs of the baseline tree against *itself*
produced a median FCP delta of -108ms with the "improvement" winning 5 of 6 pairs. Any FCP claim
below roughly 400ms on this harness is a coin flip, and this report makes none.

### a. Cache headers -- NO CHANGE, and that is the finding

Section 2/a's own escape clause applies. Measured, a second visit re-downloads 2493 bytes and
**not one of them is ours** (section 3.4). Every same-origin asset returned 0 bytes from cache.
`vercel.json` was not touched.

One observation, deliberately not acted on because section 1 did not prove it a defect: every
same-origin static file gets Vercel's default `public, max-age=0, must-revalidate`, and only the
service worker's cache-first policy hides the conditional round trip that implies. A reader whose
worker is not yet installed pays one round trip per asset. Fixing that means guessing a freshness
policy for `quran-uthmani.json`, `mushaf-layout.json`, `adhkar.json`, `worship-display.json` and
the icons -- files with no fingerprint in their names -- on evidence this measurement does not
contain.

### b. Deferral -- two commits

**b1 -- `c5ea03d` "app-load 1: the mushaf prefetch waits for idle, not for the paint"**
`index.html:6762`. `useEffect(() => { loadQuran().catch(() => {}); }, [])` becomes the same call
handed to `requestIdleCallback(go, { timeout: 3000 })`, with `setTimeout(go, 1200)` where that
API is absent (Safari before 17.4). The prefetch is not removed, and the intent in the Arabic
comment above it -- so the first verse is already there -- is unchanged.

| metric | before | after | delta | pairs |
|---|---|---|---|---|
| bytes downloaded before FCP | 1218514 | 956550 | **-261964** | **8/9** |
| runs where `/quran-uthmani.json` finished before FCP | **9/9** | **1/9** | -- | -- |
| FCP | 6760 | 6656 | -104 | 3/9 (noise) |
| total transferred | 2302201 | 2303301 | +1100 | -- |

**b2 -- `2246b51` "app-load 2: the worker installs on idle, not inside the load handler"**
`index.html:1226`. Registration still happens on `load`; only the `register()` call is handed to
`requestIdleCallback(go, { timeout: 5000 })`, with `setTimeout(go, 2000)` as the fallback.
`sw.js` is untouched -- same four policies, same `CORE` list. Measured against the b1 tree,
because b1 freed the bandwidth that had been hiding this one: on the pre-b1 baseline the precache
never started before the paint; after b1 it started before the paint in 8 of 9 runs.

| metric | before | after | delta | pairs |
|---|---|---|---|---|
| precache bytes started before FCP | 430845 | 0 | **-430845** | 8/9 runs -> 2/9 runs |
| FCP | 8332 | 8068 | -264 | 5/9 (noise) |
| total transferred | 2303331 | 2304171 | +840 | -- |

The two residual runs are the 5000ms backstop firing before an 8-second throttled paint. Against
the 1628ms paint production actually serves, a 5-second backstop cannot land first.

After both commits the worker still registers, takes control, and holds all eight `CORE` entries:
`/`, `/index.html`, `/manifest.json`, `/quran-uthmani.json`, `/mushaf-layout.json`,
`/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`. Offline readiness arrives a beat
later on the very first visit and is identical on every visit after it.

### c. Hints -- NO CHANGE, and the measurement says why

Adding `<link rel="preconnect" href="https://unpkg.com">` was considered and rejected on
evidence. `fonts.googleapis.com` already has a preconnect at `index.html:46`; `unpkg.com` has
none. Across the three cold runs their connections opened at:

| run | fonts.googleapis.com (preconnected) | unpkg.com (not preconnected) |
|---|---|---|
| 1 | connectStart 418 | connectStart 419 |
| 2 | connectStart 354 | connectStart 355 |
| 3 | connectStart 331 | **connectStart 308** |

The hint buys nothing here: Chrome's preload scanner reaches the head hints and the body script
tags inside the same first response chunk, and in run 3 the un-hinted origin connected first.
Nothing was preloaded either -- section 2/c forbids hinting at what was just deferred, and the
only other candidates (the two Noto Naskh woff2 files) already carry `display=swap`, so they
never block a paint.

Left in place and reported rather than removed: `<link rel="preconnect" href="https://mushaf.almurabbi.app">`
at `index.html:51`. No request in any cold run used that origin, so its handshake is spent for
nothing on a visit that never opens the mushaf -- but removing it is a change with no measured
gain in the cold path and a possible cost when the mushaf does open, which section 3/1 forbids.

### d. Compression -- NO CHANGE

Every asset that arrives with no `content-encoding` is already a compressed container or too
small to matter:

| asset | raw | why not |
|---|---|---|
| two `notonaskharabic` woff2 | 94032, 19696 | WOFF2 is Brotli-compressed internally |
| `icon-512.png`, `icon-maskable-512.png`, `icon-192.png` | 12893, 5938, 5053 | PNG is DEFLATE-compressed internally |
| `manifest.json` | 533 | below any sane compression threshold |

Every text asset above 1KB already arrives `br` (ours) or `gzip` (unpkg).

## 5. What was NOT done, and why

**1. `babel.min.js` arrives gzip, not brotli. This is the single largest byte win in the whole
cold visit and it was not taken.** Measured: 2983904 raw, 631935 as unpkg serves it (gzip),
**411340** at brotli quality 11. **220595 bytes -- 35% of the largest asset and 11.6% of the
entire cold visit.** Taking it means self-hosting the file from `ezik.app` and repointing
`index.html:1180`. Three reasons it was not done here:

- `recon-audit.cjs:413` asserts `src.indexOf('@babel/standalone@7.26.4') !== -1` and drops to
  `warn()` at line 414 otherwise. Repointing the tag turns a recon PASS into a WARN, which is
  the regression section 3/3 forbids.
- It moves the supply-chain guarantee from unpkg plus an SRI hash to a 3MB blob committed in this
  repository. Section 0/4 forbids restructuring.
- None of section 2's four items covers it: the asset *is* compressed (2/d wants assets with no
  encoding at all) and it *is* needed before the first paint (2/b wants assets that are not).

**2. The service worker precaches a byte-identical second copy of the document -- 298686 bytes
on every cold visit, 15.6% of the whole download.** `sw.js:26-33`, the `CORE` array, lists both
`'/'` and `'/index.html'`, and Vercel serves the same 963290 bytes for each. `mushaf-layout.json`
at `sw.js:30` adds a further 151653 that no first screen needs. **`sw.js` is not one of the three
files section 0/2 allows, so it was not edited.** Removing `'/index.html'` from that array is, on
these numbers, the cheapest remaining byte win in the tree.

**3. The Google Fonts stylesheet is the only render-blocking resource and it gates the first
paint.** `index.html:52`; `renderBlockingStatus=blocking`; its last byte lands at 706-757ms and
first paint at 748-796ms. Making it non-blocking was rejected on measurement, not on caution: it
would move first paint but not FCP, because classic scripts already wait on pending stylesheets
and babel's own last byte (689-873ms) arrives at the same moment. The measured gain on the
critical path is 0-27ms, against a real risk of a visible font swap -- which section 3/2 makes a
revert.

**4. In-browser Babel is 90.5% of `index.html` and roughly 880ms of the 1628ms cold FCP.**
`load` at 1417ms to FCP at 1628ms is React's first commit; the 873-1417ms stretch is Babel
parsing and transforming 872099 bytes of JSX. Removing it is a build step. Section 0/4 forbids
one.

## 6. Behavioural check -- one line each

Driven in headless Chrome against both trees on two local ports, with a seeded child profile and
AI consent, comparing a structural and textual DOM signature of each surface (tag, class, role,
`aria-label`, visible text, computed visibility).

| screen | result |
|---|---|
| the conversation | opens; signature `5c73fd76`, 838 nodes, 80 characters of text -- identical before and after |
| the sections list | opens through the drawer; signature `c7396318`, 2186 nodes, 249 characters, all five modules present in order (`memorize`, `adhkar`, `mushaf`, `treasure`, `fatwa`) -- identical before and after |
| the mushaf | opens and renders real Quranic text; signature `d0100d51`, 26071 nodes, 4128 characters -- identical before and after, which is also the proof that the deferred `loadQuran()` still delivers |
| the fatwas | opens; signature `bb9891c2`, 661 nodes, 75 characters -- identical before and after |

Four identical signatures out of four, at both commits. No visual or structural difference.

## 7. Before / after, one metric, both sides

Nine interleaved pairs, original baseline `d6402e6` against final `2246b51`, same harness.

| metric | before | after | delta | pairs |
|---|---|---|---|---|
| bytes downloaded before FCP | 1222335 | 960538 | **-261797** | **8/9** |
| runs where `quran-uthmani.json` finished before FCP | **8/9** | **0/9** | -- | -- |
| precache bytes started before FCP | 430473 | 0 | **-430473** | 8/9 runs -> 2/9 runs |
| first byte | 3 | 3 | 0 | 1/3 |
| first paint | 296 | 284 | -12 | 5/9 |
| **first contentful paint** | **8092** | **8416** | **+324** | **4/9** |
| DOMContentLoaded | 7287 | 7555 | +268 | 4/9 |
| total transferred | 2302202 | 2303511 | +1309 | 0/9 |

**FCP did not improve.** The median moved 324ms the wrong way on a 4-of-9 sign test, which is
inside the noise floor this harness demonstrated at -108ms on 5 of 6 pairs of two identical
trees. A separate three-pair run of the same two trees reported FCP -420ms at 3 of 3; that
disagreement between two runs of the same comparison is the whole reason the nine-pair sign test
is the number quoted and the three-pair one is not. The honest statement is that neither commit
moved a clock.

Both commits are kept because both have a measured gain on the metric section 2/b names -- bytes
in flight before the first paint -- at 8 of 9 pairs, and neither costs anything but 653
transferred bytes of comment. Nothing else was kept.

## 8. Push and revert -- written, not executed

```
git -C C:/Users/passe/projects/ustaz-speed push -u origin perf/app-load-20260819
```

```
git -C C:/Users/passe/projects/ustaz-speed revert --no-edit 2246b51 c5ea03d
```

or, to drop the branch back to its cut point:

```
git -C C:/Users/passe/projects/ustaz-speed reset --hard d6402e67e93430eeea62de1600b978167e26e768
```

Neither was run. No deployment, no environment variable, no push.

---

The sealed body below is this file with the two seal lines, and the blank line before them,
removed.

REPORT_BODY_SHA256=AEB25B6964B3B993C4F4D64B85F004D0EB4A4A425F8432BF3818E5DA74F715CE
REPORT_BODY_BYTES=20441
