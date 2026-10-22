# IAP-D: sign-in before owner start and browser purchase fallback

## Measured before the change

- The app already stored a signed-in Ezik session in `localStorage` under `ezik_auth_session_v1`. The existing browser sign-in control is `EzikSignInRow` inside Settings. It starts the web auth flow through `ezikWebAuthStart`; `useEzikWebAuthReturn` exchanges the returned ticket and saves the session. I reused this path by opening Settings from a small URL flag, rather than adding another sign-in form.
- The gated owner paths are Harb room start in `quest-theme/journey.js`, Board room start and rematch in `quest-theme/board-rooms.js`, and Hanna online host start in the Hanna IAP bridge. Local play and joining a room do not call the owner-start bridge.
- The purchase bridge already treated a missing `window.ReactNativeWebView` or missing `postMessage` as unavailable. Native purchase identification waits up to 15 seconds for `iap.identify`; balance is read from the existing `../api/iap-balance` endpoint. The site had no shared App Store or Google Play constants for these products.

## What changed

- A signed-out owner now sees an Arabic sign-in prompt before the start choice. Its sign-in link opens `/?ezik_iap_signin=1` in a new tab. The app removes the flag, opens its existing Settings screen, and after the session is stored the owner tab detects the sign-in and resumes the start choice automatically.
- The start choice and purchase screen identify the active account by display name or masked email.
- When the purchase bridge is absent, “buy now” opens an Arabic panel explaining that purchases happen in the Ezik app on iPhone or Android, naming the current account, and linking to the App Store (`https://apps.apple.com/app/id6797100518`) and Google Play (`https://play.google.com/store/apps/details?id=app.almurabbi.tutor`). “تحديث الرصيد” re-reads the balance; returning to the page also refreshes it. When credit or an active subscription appears, the owner returns to the start choice. A bridge that does not answer `iap.identify` within its existing timeout uses the same panel. With a working bridge, the native purchase rows still open directly.
- The shared theme hid overlays on these game pages. I exempted the IAP backdrop from that hide rule and bumped the theme stylesheet URL on Harb, Board, and Hanna so deployed browsers fetch the fix.
- Added a 13-check Playwright regression for signed-out owner resumption, account display, the no-bridge panel and both store links, manual and focus refresh, direct purchase rows with a stubbed bridge, identify timeout fallback, and a joiner who sees no IAP prompt.
- Rebuilt `app.js` from `app.jsx`. Its measured size is 2,282,367 bytes (SHA-256 `173a08dfe95fe6e46bd55f347638a45bf8e35dd6ae8ce899bb7250444636a984`), up 362 bytes from 2,282,005. The service worker CORE size and its byte table now match that build. Its guard seal and size check were recut; the chat UX guard allows only this exact measured service-worker size update while continuing to reject other service-worker edits.

## What remains

- The Cloudflare room worker still has no server-side owner or IAP gate; this change only gates the client owner start flow, as ordered.
- Store listings, RevenueCat, native shell changes, merge, and publish remain out of scope. A real native-store purchase followed by a physical cross-device balance check remains manual QA.
- Kunuz entry, single-device/local games, and room joiners remain available without account sign-in.

## Owner test steps

### A. Browser without a purchase bridge

1. In a browser signed into a test Ezik account, open the deployed app’s `/quest-harb.html` or `/quest-board.html` page and create a room as its owner.
2. Press the owner’s start control and choose “buy now.” Confirm the Arabic panel names the signed-in account and shows both store buttons.
3. Confirm the App Store and Google Play buttons open the required URLs. Press “تحديث الرصيد” before purchase and confirm the panel remains open when no balance has changed.
4. Complete a purchase in the Ezik app with this same account, then return to the browser. The panel refreshes on focus/visibility; pressing “تحديث الرصيد” also refreshes it. Once the balance endpoint reports credit or an active subscription, the start choice appears.

### B. Signed-out owner

1. Use a private browser window with no Ezik session. Open `/quest-harb.html` or `/quest-board.html`, create a room as owner, and press start.
2. Confirm the sign-in prompt appears before the start choice. Click its sign-in link; the new tab opens the app at `/?ezik_iap_signin=1` and shows the existing Settings sign-in control.
3. Sign into the test Ezik account, then return to the room tab. It detects the stored session, reads the account balance, and opens the owner start choice automatically.

### C. Cross-device purchase

1. In the Ezik app, buy credits or a subscription while signed into the test account.
2. On another device, open the deployed web app and sign into that same Ezik account using step B. Host a Harb or Board room.
3. Choose “buy now.” Confirm the browser panel names the same account. Return to the tab or press “تحديث الرصيد”; the balance appears and the owner start choice returns.

Also verify that a room joiner does not see the sign-in or purchase flow, and that single-device/local play remains ungated.

## Verification

- `npm run verify:build` — passed; built and checked `app.js` both measured 2,282,367 bytes with the SHA-256 above.
- `node tools/iap-d-webbuy-browser.cjs` — passed, 13 checks. Evidence: `C:\Users\passe\AppData\Local\Temp\iap-d-webbuy-browser.json`.
- `node chat-ux-guard.cjs` — passed, 446/446. `node chat-history-guard.cjs index.html` — passed, 150/150. `node quest-bank-integrity-guard.cjs --compare quest-data/kunuz-bank-3147.js` — passed, 109 checks. The Kunuz board guard passed 11/11.
- Final `npm run gates` — 186/187. Only `recon` failed because its implementation-report summary is stale (`PASS=278 WARN=6 FAIL=1`). A clean `origin/main` worktree at `c2798bfa662fc0245719c04f82bb1ea50d43e84e` also fails `recon` for the same stale-summary condition (`PASS=280 WARN=1 FAIL=1`), so this remaining failure predates IAP-D. Final gate evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-22T15-56-14-193Z-29752`.
