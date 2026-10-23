# EZIK-IAP-G4 — compact home purchase button on the heading line

Branch `iap-g4`, cut from `origin/main` `e0c6e6c2`. Not merged or pushed.

## Measured before the change

- `quest-theme/journey.js` `home()` rendered the heading block (`.j-home-heading`: the h1 and the subtitle), then a separate full-width `<div class="j-actions j-home-purchase">` row holding `button('اشتر لعبة', 'iap-purchase', 'j-btn')`, then `homeNoticeMarkup()`.
- `header()` ends with the mute button and then the home button, so in RTL the home button is the leftmost item in the header.
- `.j-btn` is full width, 52px tall, with 20px text. `.j-home-heading` is styled at `theme.css` lines 41-43, and its h1 is 28px.
- The header and `.j-content` use the same side padding (`max(20px, safe-area)`, or 27px at 620px and wider), so a button at the content's left edge lines up under the home button.
- `tests/iap-g-v2.test.js` checks that the source contains `button('اشتر لعبة', 'iap-purchase'`.
- No guard, test or stylesheet referred to `.j-home-purchase`.

## What changed

- **Markup (`journey.js` `home()`):** the purchase button moved into `.j-home-heading`, between the h1 and the subtitle, as `button('اشتر لعبة', 'iap-purchase', 'j-btn j-home-buy')`. The call shape and the `iap-purchase` action are unchanged. The old `.j-home-purchase` row is gone. The trial notice still renders straight after the heading.
- **CSS (`theme.css`):**
  - `.j-home-heading` is now a wrapping flex row.
  - The h1 takes the remaining width on the right, and the subtitle (`flex-basis:100%`) drops to its own line below.
  - The new rule `.j-home-heading .j-btn.j-home-buy` applies only to this button. It keeps the yellow `.j-btn` look (no new colors or fonts) but sets `width:auto`, `min-height:40px`, padding `5px 14px`, 15px text, `white-space:nowrap` and a 13px radius. `margin-inline-end:-2px` cancels the heading's 2px side padding, so the button's left edge matches the home button's exactly.
  - At widths of 400px and below, the h1 drops from 28px to 24px.
  - No other `.j-btn` changed.
- **Versions:**
  - `theme.css` and `journey.js` now load at `?v=20261023-iapg4` on all six pages (`quest.html`, `quest-board.html`, `quest-test.html`, `quest-ghaws.html`, `quest-harb.html`, `hanna-laha/index.html`).
  - `quest-sw.js` `VERSION`, and `THEME_VERSION` and `screenVersion` in `journey.js`, also moved to `20261023-iapg4`. This follows the IAP-G commit.
  - Two new entries in `guards/asset-versions.json`.
  - The pinned script and stylesheet URLs in `guards/kunuz-board-guard.cjs` and `guards/kunuz-test-guard.cjs` were updated to match.
- **Not changed:** game screens, IAP logic, the notice text and the fallback page layout. `guards/kunuz-theme-guard.cjs` was also left alone. It is not a gate, and it already fails on `origin/main` because it pins the worker `VERSION` at `20261022-roomsfix2` while main has `20261023-iapg`.

## Screenshots

These are home screenshots with the signed-in trial notice visible. They were taken with headless Chrome (Playwright), serving this worktree from a local static server. A stubbed `ezikIapEnterHome` returned an active 6-day trial notice, a stub session was placed in `ezik_auth_session_v1`, and every `/api/*` call returned 404.

- `C:\Users\passe\projects\_iap-orders\IAP-G4-shots\after-home-360.png`
- `C:\Users\passe\projects\_iap-orders\IAP-G4-shots\after-home-390.png`
- `C:\Users\passe\projects\_iap-orders\IAP-G4-shots\after-home-1280.png`

Measured in the same run:

| Width | Button (w×h, font) | Button left / home button left | h1 font, lines | Page scrollWidth |
| --- | --- | --- | --- | --- |
| 360 | 83×40, 15px | 20 / 20 | 24px, 1 line | 360 (no overflow) |
| 390 | 83×40, 15px | 20 / 20 | 24px, 1 line | 390 (no overflow) |
| 1280 | 83×40, 15px | 287 / 287 | 28px, 1 line | 1280 (no overflow) |

At every width, the button and the h1 share a line, the subtitle sits below them, and the notice comes after the heading. The page has exactly one `iap-purchase` button and no `.j-home-purchase` row. Clicking the button called `ezikIapOpenPurchase` once, which is the existing action that opens the purchase screen. The run raised no page errors.

## Tests and gates

- `node --test tests/iap-g-v2.test.js tests/iap-rollout.test.js`: **17/17 passed**.
- `npm run verify:build`: **passed**. `app.js` is unchanged at 2,282,367 bytes, SHA-256 `173a08df…6a984`.
- Targeted guards: `asset-version-guard` PASS (14 URL versions across 6 pages), `kunuz-board-guard` 11/11, `kunuz-test-guard` 12/12, `hanna-laha-in-ezik-guard` PASS.
- `npm run gates` on commit `47a28929`: **188/188 passed**, RECON `PASS=282 WARN=0 FAIL=0`, 0 dirty paths afterwards. Evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-23T03-31-18-311Z-45876`. RECON's stale-summary failure, which the order expected, did not occur in this run, so I did not need to show that any failure was already on `origin/main`.
