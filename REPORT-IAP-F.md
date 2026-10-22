# IAP-F: consume timing and purchase confirmation

Branch: `iap-f` at `f715dcc9` before these changes. This report covers the browser IAP bridge and its game screens only. No room worker, RevenueCat, native store code, or answer pipeline was changed.

## Measured before the change

| Game | Click and request order | Session ID before the fix |
| --- | --- | --- |
| Harb | The owner pressed the settings screen’s start button. The bridge opened the free/credit choice; selecting an option POSTed `/api/iap-consume`, then called `enterRoom(false)` to create or enter the lobby. | Random UUID (with a time/random fallback), stored under `ezik_iap_host_session_v1_harb_<roomCode>`; when no code was set, the bridge used `room`. The key was removed after the callback resolved. |
| Board | The owner pressed `br-start` or `br-rematch`. Selecting an option POSTed `/api/iap-consume` before sending the WebSocket `start` or `rematch` message. | Random UUID stored under `ezik_iap_host_session_v1_board_<roomCode>`, then removed after the callback resolved. |
| Hanna Laha | The host pressed GO in the lobby. Selecting an option POSTed `/api/iap-consume` before calling the host client’s `start()`. | Random UUID stored under `ezik_iap_host_session_v1_<roomCode>`, then removed after the callback resolved. |

The leave-and-return double consume was not an automatic network retry. The first request happened before an active round existed. Once the start callback returned, the bridge deleted that session ID. Opening the start flow again therefore generated a new ID, which the server correctly treated as a new consume. The old bridge did not wait for an active-room signal.

After a native `iap.buy.result` of `purchased`, the old purchase status was brief and was replaced by a generic completed count. When the balance endpoint changed, the panel closed and returned to the start choice, hiding the receipt. When it did not change within the existing polling window, the panel said the balance would appear soon but stopped polling.

## Changes made

- Consumption now follows the selected start action and waits for the first active-round signal before POSTing `/api/iap-consume`:
  - Harb waits for a non-lobby room snapshot after the host taps the lobby’s start button.
  - Board waits for a `board` or `question` snapshot for the same server `roomId` and the expected next `gameNumber`. A rematch increments that cycle.
  - Hanna Laha waits for the active room screen’s rendered phase marker.
- Session IDs are generated once and retained in `sessionStorage` (with an in-memory fallback), keyed by game, room instance where available, and round cycle. Harb and Board use their server room instance IDs; Hanna uses its host room code. The ID is no longer deleted after start. Retries of that room cycle reuse it; a new room instance or Board rematch gets a new ID.
- If the active-round signal does not arrive within 45 seconds, the bridge cancels its waiter, makes no consume request, and says no balance was deducted. Explicit free intent remains free; a server rejection does not silently switch to credits.
- Start-choice and purchase panels show the current credit balance and, when active, the subscription expiration date. Each successful purchase unit displays its receipt; multi-unit purchases show progress. If crediting is delayed, the panel explains that and continues polling every five seconds, updating the balance in place. The credit action reads `ابدأ (يُخصم من رصيدك)`.
- Asset query versions and the asset registry were updated for the changed scripts. The Board gate now expects those current asset URLs.

## Signals and remaining limits

These are client-visible signals, not a transaction with the room service. Harb uses its incoming non-lobby snapshot; Board uses the active phase and incremented game number; Hanna uses the active phase marker rendered from the room snapshot. No worker code was changed. This verifies when the browser sends the consume request, but does not prove atomicity between room start and billing or confirm a live store transaction. Hanna’s host component exposes the room code but no separate server room-instance ID, so its stable session key uses that code and the per-cycle nonce.

The automated browser test mocks `/api/iap-consume`, balance, and native purchase replies. Run the owner device checks below against the test environment before treating live TestFlight purchase behavior as verified. Existing test-account usage was not reversed.

## Verification

- `npm run verify:build` — passed. `app.js`: 2,282,367 bytes, SHA-256 `173a08dfe95fe6e46bd55f347638a45bf8e35dd6ae8ce899bb7250444636a984`.
- `node tools/iap-f-consume-timing-browser.cjs` — passed 18 checks. Evidence: `C:\Users\passe\AppData\Local\Temp\iap-f-consume-timing-browser.json`.
- `node guards/asset-version-guard.cjs` — passed, 14 URL versions across six pages.
- `node guards/kunuz-board-guard.cjs` — passed, 11/11.
- A first `npm run gates` while the worktree was still dirty reported 183/188. The three unrelated clean-tree-sensitive checks (`recon`, `i18nui`, and `searchbudgetp0`) all passed on a detached, clean `origin/main` worktree at `f715dcc9` (recon 282/0/0, I18n 389/389, search budget 35/35). The two asset-related failures were the Board guard’s pinned URLs and missing asset registry entries; both were updated. The first clean committed run then reported 187/188 because `kunuztest` still pinned the old `quest-test.html` journey URL. That guard expectation was updated in commit `142170f6`; the final clean run passed all gates.

## Owner test steps

Use an isolated test account with `IAP_ENFORCE=test`, and build the web assets from this branch. Do not use a balance that needs to be preserved.

1. For Harb, create a room, add two teams, and stay in the lobby. Opening the start choice must not change the balance. Close or leave before starting and confirm no consume request. Start the war and confirm one use only after the active map appears. Reconnect to that same room and confirm it does not consume again.
2. For Board, create a host room and check the same no-consume behavior in its lobby. Start the board and confirm one consume when the active board/question snapshot arrives. Reconnect to that room, then finish a game and use rematch; the rematch should consume once as a new cycle.
3. For Hanna Laha, open the host lobby and press GO. The choice itself must not consume. After starting, confirm one consume once the active room phase appears. Re-enter the same host room and confirm no extra consume.
4. With free sessions still available and credits present, choose free. If the server rejects that free consume, confirm credits remain unchanged and no credit consume is sent.
5. In the native test store, purchase two units of `ezik_games_3`. Confirm each unit shows `تم الشراء ✓ — أُضيف ٣ جلسات`, the screen shows `تمت ١ من ٢` then `تمت ٢ من ٢`, and the balance updates on that same screen. Delay balance delivery once and confirm the pending message remains visible until polling updates the balance.

## Final gate run

`npm run gates` passed 188/188 at implementation commit `142170f6170b0772cfbdb04d77ba5a6b8ae43954`, with recon 282/0/0 and zero dirty paths before or after. Duration was 25m 58s. Evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-22T23-21-02-001Z-38136`. This report update is documentation-only.
