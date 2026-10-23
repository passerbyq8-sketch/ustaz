# EZIK-IAP-G v2 implementation report

## Measured findings

- The Kunuz home is rendered by `quest.html` and `quest-theme/journey.js`. The theme places the persistent `اشتر لعبة` action above the five game cards. The same purchase entry is present in the fallback page.
- The five home entries are `/quest-ghaws.html`, `/quest-harb.html`, `/quest-test.html`, `/quest-board.html`, and `/hanna-laha/`. Both home-card taps and direct page loads are checked before a game is shown.
- `ghaws` and `test` use the local, single-device start flow. `harb`, `board`, and `hanna` support host starts and local play. The room entry pages also accept join links and room codes. Join routes bypass the payer gate and do not call consume.
- The local session-start hook wraps the game’s real `begin()` operation. The host hooks wait for the game to become active: Harb waits for a non-lobby room snapshot, Board waits for the next active game in the same room, and Hanna waits for the active phase marker. Stable session IDs continue to use the IAP-F flow.
- The account session is read from `ezik_auth_session_v1`; API calls send it in `x-ezik-session`. Trial creation is server-side through `POST /api/iap-trial-start`; entitlement is read through `GET /api/iap-balance`.
- Purchases are opened from the home. No game screen offers a purchase row or a free-versus-buy choice. When a game is blocked, the purchase action opens the home purchase screen and records the requested route for return after purchase.

## Delivered behavior

`TRIAL_DAYS` is 7, measured by the server as seven 24-hour periods. A per-account `trialStartedAt` is created once and never moved by a later start call. The home displays the trial terms and status on first enforced entry; a direct first game entry shows the terms before offering to start the week. An expired notice is shown once per app session. The server is the source of truth for trial status.

`FREE_SESSIONS_PER_GAME` is 0. Legacy `freeUsedByGame` data and response fields remain available for old clients, and remaining free sessions are zero. Consume checks active trial first, then subscription, then credits. A trial session is free, and a consume within 30 minutes after trial expiry is accepted so a session begun during the trial is not charged. Credit consumption remains idempotent per stable session ID and happens only after the true start signal. A session is allowed to continue if a late consume is rejected.

### Rollout modes

| Mode | Entry behavior |
| --- | --- |
| `off` | No trial notice, sign-in prompt, or entry block. Existing game starts continue without IAP consumption. |
| `test` | Signed-out users see no IAP prompt or block. Only signed-in accounts listed in `IAP_TEST_ACCOUNTS` are enforced. Other accounts are unchanged. |
| `all` | A signed-out game tap asks the player to sign in first. The first enforced home entry or game tap starts the account’s disclosed seven-day trial. After expiry, every game requires an active subscription or credits. |

Join links and room-code routes stay available without sign-in in every mode. When an expired player reaches the Harb, Board, or Hanna block from inside a game, `انضم لغرفة برمز` opens a join-only route. Joining never consumes a credit.

### Product mapping

| Purchase kind | Product ID | Effect |
| --- | --- | --- |
| Game credits | `ezik_games_3` | Adds three game-session credits. |
| Month pass, new | `ezik_pass_month_1` | One month of access; non-renewing. |
| Year pass, new | `ezik_pass_year_1` | Twelve months of access; non-renewing. |
| Month pass, legacy | `ezik_month_1` | Retained with the same one-month effect. |
| Year pass, legacy | `ezik_year_1` | Retained with the same twelve-month effect. |

The web bridge selects the new month/year ID when the shell advertises it and falls back to the matching legacy ID otherwise. RevenueCat `CANCELLATION` events refund non-renewing passes; the documented event shapes are described in [RevenueCat’s webhook event reference](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).

The purchase options, quantity control, balance display, bridge purchase sequence, and IAP-F confirmation stay on the home purchase surface. Without the native purchase bridge, the home opens the existing “buy in the Ezik app” panel.

## Test-only account adjustment

`POST /api/iap-test-adjust` can adjust only the caller’s own account. It returns 403 unless IAP is in `test`, the caller has a live signed-in session, and that account is listed in `IAP_TEST_ACCOUNTS`. It accepts `trialDays` from 0 through 8, `clearTrial: true`, and/or `credits` from 0 through 20. It has no target-account field and records a `test_adjust` ledger event.

On `https://ezik.app`, sign in as a listed test account, open the browser console, and define:

```js
async function iapAdjust(body) {
  const account = JSON.parse(localStorage.getItem('ezik_auth_session_v1') || 'null');
  const response = await fetch('/api/iap-test-adjust', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ezik-session': account?.session || ''
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
```

Examples:

```js
await iapAdjust({ clearTrial: true, credits: 0 });
await iapAdjust({ trialDays: 8, credits: 0 });
await iapAdjust({ trialDays: 8, credits: 1 });
```

## Owner verification steps

Use a signed-in account listed in `IAP_TEST_ACCOUNTS` with `IAP_ENFORCE=test` for the enforced-account checks.

1. **First entry and disclosure:** Run `await iapAdjust({ clearTrial: true, credits: 0 })`, then open `https://ezik.app/quest.html`. Confirm the home notice states the seven-day duration, that the games are still being improved, what access requires after the week, and where prices are shown. Confirm the account now has one server-started trial that does not move on another home visit.
2. **Active trial:** Tap each of the five cards and verify entry succeeds without a purchase prompt or credit deduction. Start and cancel a local game setup; the trial remains active and the balance does not change.
3. **Expired access:** Run `await iapAdjust({ trialDays: 8, credits: 0 })`. Try each home card and each direct URL: `/quest-ghaws.html`, `/quest-harb.html`, `/quest-test.html`, `/quest-board.html`, and `/hanna-laha/`. Each must block entry and offer `اشتر لعبة`. Verify the main-page purchase screen is the destination.
4. **Free joining while blocked:** From the expired Harb, Board, and Hanna block, choose `انضم لغرفة برمز`. Verify the join-only screen accepts a room code without asking for sign-in or consuming a credit. Also open an incoming Board room link (`/quest-board.html?board=####`) and Hanna join link (`/hanna-laha/j/####`) while expired. For Harb, use its join route (`/quest-harb.html?iap_join=1`) and enter the host’s code. Confirm each join stays free.
5. **Purchase return:** In the native shell or a purchase-bridge stub with the product list available, tap a blocked game’s purchase action, complete a test purchase, and confirm return to the exact game route that was originally tapped. The current native shell is not changed by this order.
6. **Credit confirmation and true start:** Run `await iapAdjust({ trialDays: 8, credits: 1 })`. Enter a game setup and verify entry alone does not consume. On the credit confirmation, cancel and confirm the credit remains. Reset to one credit, confirm and start one local/single-device session; verify one deduction at `begin()`. Reset to one credit and host one room game; verify deduction only when its active-start signal fires, once for the stable session ID.
7. **Mode coverage:** With a signed-out browser, verify `test` does not prompt or block and `off` displays no trial notice or gate. With a signed-out browser in `all`, verify a game tap sends the player to sign-in before the access check; after sign-in, verify the terms appear before the trial starts.
8. **Purchase surfaces:** In a regular browser without the native bridge, tap `اشتر لعبة` on the home and verify the existing “buy in the Ezik app” panel appears. In a bridge-enabled shell, verify the three product rows, quantity control, balance, and IAP-F purchase confirmation. Verify the new month/year IDs are selected when offered and the legacy IDs are selected when the shell only advertises them.

For Apple review, capture the **Kunuz main-page purchase screen** with its purchase options visible. Do not use an in-game purchase screen; none remains.

## Verification results

- `node --test tests/iap-g-v2.test.js tests/iap-rollout.test.js`: **17/17 passed**.
- `npm run verify:build`: **passed**. `app.js` matches its source exactly at 2,282,367 bytes, SHA-256 `173a08dfe95fe6e46bd55f347638a45bf8e35dd6ae8ce899bb7250444636a984`.
- `npm run gates`: **187/188 passed**, clean before and after. The sole failure is RECON’s stale implementation-report summary (`current 280/1/0`). A clean worktree at `origin/main` commit `0285b690` independently reproduced the same stale-report failure (`current 281/1/0`), so it predates IAP-G. The gate evidence is at `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-23T02-39-38-687Z-5952`.

## Remaining and out of scope

- Configure Apple, Google, and RevenueCat product records and verify their live purchase/refund events. Apple’s new pass IDs are intended to be non-renewing products.
- The native shell and store-console configuration were not changed. The production `IAP_ENFORCE=all` rollout should follow store approval.
- Cloudflare room workers still have no server-side IAP gate. They were left unchanged for the separate room-system work.
- No deployment, merge, or push was performed. Browser and shell manual verification above remains for the owner to run against the configured test account and purchase bridge.
