# IAP-C: three free sessions per game

## Measured before the change

- `lib/iap/store.js` stored one `freeFirstUsed` boolean in the account balance in Redis. `api/iap-consume.js` consumed the one free session, then a credit, or returned `iap-no-credit`; `api/iap-balance.js` exposed the boolean with the balance. Only Hanna Laha called the consume endpoint.
- Hanna Laha's host start button called `ezikIapStart` in `HostRoomScreen-iap-v1.js`. The bridge tried the consume endpoint first. When no credit remained, it called `guardianGate`: checked `/api/parent-code` status, then showed the parent PIN gate or arithmetic gate before `initializePurchase` opened the native purchase screen (`iap.identify`, `iap.prices`, and the existing product rows).

## Game start paths measured

| Game ID | Owner start path before this change | Before: consume call | Result now |
| --- | --- | --- | --- |
| `ghaws` | Local Dive on one device; there is no room owner. | No | Remains ungated. |
| `harb` | `journey.js` starts a local game or, in room mode, has the host enter the room and start the war. | No | The online host start is gated. Local play and joiners are ungated. |
| `test` | Single-device quiz; there is no room owner. | No | Remains ungated. |
| `board` | Local board play or an online room; the room host starts or rematches through `board-rooms.js`. | No | Online host start and rematch are gated. Local play and joiners are ungated. |
| `hanna` | Local play or an online room; the host starts from the Hanna Laha host screen. | Yes | Online host start remains gated and now uses the per-game choice. Local play and joiners are ungated. |

## What changed

- `lib/iap/store.js` is the single source for `FREE_SESSIONS_PER_GAME = 3` and the supported IDs. Each balance now has `freeUsedByGame`. A legacy `freeFirstUsed: true` balance is interpreted as `hanna: 1`; no other game counter is migrated. The migration is persisted on the next consume or purchase/refund balance mutation.
- The balance endpoint returns `freeTotalPerGame`, `freeUsedByGame`, and `freeRemainingByGame`, while retaining `freeFirstUsed` as a Hanna-derived compatibility field.
- Consume requests require `gameId`; session IDs remain idempotent, and reuse of an ID for a different game is rejected. Subscription, free-session, credit, and no-credit precedence is preserved. An explicit free choice cannot silently fall through to a credit if the last free session was used in the meantime. Free consumptions append a ledger event with `gameId` and `sessionId`.
- Online owners see Arabic start choices for Harb, Board, and Hanna. The free choice shows that game's remaining count. Once it reaches zero, the choice stays visible, dimmed, and disabled when there is no credit or active subscription. When credits are available after the free quota is used, the start choice says that a credit will be deducted. An active subscription starts directly without a choice. Joiners and local-only flows do not see this screen.
- “Buy now” opens the existing native purchase screen directly; this path no longer calls the parent PIN or arithmetic gate. After a completed purchase is observed in the balance, the owner returns to the same start choice with the refreshed balance. The gate component remains available for other features.

## Remaining scope

The Hanna Laha Cloudflare room worker still has no server-side IAP/owner gate. Harb and Board room workers are also outside this change. The account consume API enforces the free-session and credit rules, while host-only start choices are enforced in the client flow. Store listings, RevenueCat, native-shell changes, publishing, and merge/push were not part of this work. A live native-store purchase and physical-device owner/joiner walkthrough remain manual QA steps.

## Owner verification steps

1. Use a dedicated test account in the native app with no active subscription. Open `quest-harb.html`, create an online room, and start as host. Repeat with `quest-board.html` (including a rematch) and Hanna Laha. Each host should see the Arabic start choice; a joined player should not.
2. Choose free play once in one game. Reopen that game's start choice and confirm its remaining count decreased by one. Open another game's owner start and confirm that game's count did not change. A fresh account begins with three free sessions for each game.
3. To check the dimmed/disabled state without playing three sessions, use a disposable account with no active subscription. Sign into the test site, open DevTools on an app page, and run this in the browser console to consume only the Board free quota:

   ```js
   (async function () {
     const saved = JSON.parse(localStorage.getItem('ezik_auth_session_v1') || 'null');
     if (!saved || typeof saved.session !== 'string') throw new Error('Sign in on the test account first');
     for (let i = 0; i < 3; i += 1) {
       const response = await fetch('/api/iap-consume', {
         method: 'POST',
         credentials: 'same-origin',
         headers: { 'Content-Type': 'application/json', 'x-ezik-session': saved.session },
         body: JSON.stringify({
           sessionId: 'iap-free3-board-' + crypto.randomUUID(),
           gameId: 'board',
           intent: 'free'
         })
       });
       const result = await response.json();
       console.log(response.status, result.mode, result.balance && result.balance.freeUsedByGame.board);
       if (!response.ok || result.mode !== 'free') throw new Error(JSON.stringify(result));
     }
   })();
   ```

   The calls create three ledger events and set only `board` to three used. Then start a Board online room as host: free play should remain visible but be dimmed and disabled, and “buy now” should be enabled. Use only a disposable account because this changes its persistent balance.
4. With the test account's free quota exhausted and credits available, confirm the start action says a credit will be deducted. With an active subscription, confirm the session starts directly without the choice screen. Tap “buy now” in the native app and confirm the existing purchase screen appears without a parent PIN or arithmetic question; after a successful purchase and balance refresh, it should return to the same start choice.
5. Confirm `ghaws` and `test` still start on one device without an IAP screen, and local modes of Harb, Board, and Hanna remain ungated.

## Verification run

- `npm run verify:build` — passed; generated `app.js` matched exactly (2,282,005 bytes, SHA-256 `9e198cd7299abe5ba792e46d131c00cddda4c15fa9f319528a33faf4e5ee13e3`).
- `npm run gates` — 186/187 passed. Hanna Laha and Board gates pass after their related fixes. The only failure is the recon guard's stale implementation-report summary (`SUMMARY PASS=278 WARN=6 FAIL=1`). Running `node recon-audit.cjs` from a clean detached `origin/main` worktree at `c2798bfa` reproduced the same stale-report failure, so it predates this change.
- Final gate evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-22T12-13-40-955Z-28992`.
