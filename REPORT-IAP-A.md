# EZIK IAP A — web and API implementation report

Date: 21 October 2026  
Branch: `iap-purchase`

## Measured baseline

- The repository is a Node and Babel web app with Vercel `api/` endpoints. It has no native iOS or Android project. The Hanna Laha game client is checked in as compiled web assets; its Cloudflare worker source is not in this repository.
- Before implementation, the branch was `iap-purchase`, tracking `origin/main`, with no tracked changes. The supplied `EZIK-IAP-A-WEB-API.md`, `EZIK-IAP-ORDER.md`, and older `REPORT-IAP.md` were untracked and were left in place.
- Sign-in creates the Ezik account key `acct:v1:<provider>:<sub>`. `api/auth-native.js` and `api/sync.js` use the existing Upstash REST store (`KV_REST_API_URL`, `KV_REST_API_TOKEN`); sync scopes data to a hash of the account key and the Vercel environment.
- The existing parent lock is `api/parent-code.js`, backed by `pc:v1:rec:<deviceId>` and the `mrb_device_v1` browser key. The web app has a `ParentGate`; its legacy digest is `parent_pin_hash`. A child profile with no saved code uses the existing 2–9 addition gate before code creation.
- No purchase, credit, free-first-session, or game-consumption implementation was present before this work.

## RevenueCat documentation check

- RevenueCat documents `NON_RENEWING_PURCHASE` for purchases that do not auto-renew. `INITIAL_PURCHASE` and `RENEWAL` cover subscription purchases and renewals. `CANCELLATION` can mean a cancellation or refund; a voluntary `UNSUBSCRIBE` is not an immediate refund. The webhook also documents `REFUND_REVERSED`.
- The webhook includes `app_user_id`, `product_id`, `store`, `transaction_id`, `event_timestamp_ms`, `price`, and (for cancellation) `cancel_reason`. A negative price or `CUSTOMER_SUPPORT` cancellation reason identifies a refund in the handler. Ordinary subscription opt-out does not shorten its paid period.
- RevenueCat’s public docs identify `transaction_id` as the store transaction identifier, but do not explicitly guarantee that repeated purchases of the same consumable always produce separate webhook events with distinct transaction IDs. The implementation deduplicates by store and transaction ID. The owner must confirm repeated same-SKU purchases in a store sandbox before release.
- One-time purchase refunds require the relevant platform server notifications to be configured for RevenueCat to receive every refund.

Sources: [RevenueCat webhook event types and fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [sample webhook events](https://www.revenuecat.com/docs/integrations/webhooks/sample-events), [non-subscription purchases](https://www.revenuecat.com/docs/platform-resources/non-subscriptions).

## Implemented

- Added authenticated `GET /api/iap-balance`, authenticated `POST /api/iap-consume`, and secret-protected `POST /api/iap-webhook` endpoints. The API uses the existing session and Upstash store.
- Added an atomic, per-account balance and append-only transaction ledger. `ezik_games_3` grants three game credits; month and year products extend unlimited play by calendar months from the later of now or the current expiry. Each account has one free first game session. Consumption is idempotent per client-generated room-session ID.
- Added the version 1 web-to-shell bridge contract, Arabic purchase and parent-gate UI, localized store prices and totals, 1–5 quantity validation, and strictly sequential one-unit purchase calls. The loop stops on the first cancel or error and reports how many completed.
- The Hanna Laha host start action checks balance before starting. The existing parent code status and verify endpoints are reused before showing payment choices. Joined participants do not call the purchase path.
- After a successful shell purchase response, the Hanna Laha page polls the authenticated balance for about 20 seconds. If it has not changed, a local pending marker resumes polling when Hanna Laha is opened again. The browser path reports that purchases require the app shell and handles the missing bridge without throwing.
- Immutable shipped Hanna Laha bundles were preserved. Versioned client bundles were added for the host integration and loaded by the game entry points.

## Environment variables

Set these names in the deployment environment; no values are included here:

- `KV_REST_API_URL` (existing Upstash store)
- `KV_REST_API_TOKEN` (existing Upstash store)
- `REVENUECAT_WEBHOOK_SECRET` (new; must match the RevenueCat webhook Authorization header)

## Remaining work and limitation

- Configure the product catalog, app user ID behavior, RevenueCat webhook, and platform server notifications. The native shell in the separate `murabbi-shell` repository must implement bridge version 1 and be integrated with this web build.
- Validate repeated purchases of `ezik_games_3` in App Store and Google Play sandboxes, including whether each repeat arrives with a distinct transaction ID. Also test refunds and refund reversals with real sandbox webhook payloads.
- The Hanna Laha Cloudflare worker is outside this repository and was not changed. The balance check is a web-client gate; a caller can bypass it and contact that worker directly. A future worker change must verify an authenticated owner reservation/credit decision before accepting a host start. This implementation alone does not enforce payment server-side at the room worker.

## Owner test steps

1. Set the three environment variable names above in a Vercel preview deployment. Configure RevenueCat with the three product IDs and a webhook targeting `/api/iap-webhook`; make the configured Authorization header exactly match `REVENUECAT_WEBHOOK_SECRET`. Enable the store server notifications RevenueCat requires for refund delivery.
2. Integrate the native shell’s version 1 bridge, install its sandbox build, and sign in to the Ezik account that will own the test room. A plain browser should show the Arabic unavailable message and should not open a store sheet.
3. Start a Hanna Laha room as owner. Verify the saved parent code is required before payment choices; on a device with no saved code, verify the existing addition gate appears. Sign in first if the account session is missing.
4. Check each row’s price against the localized store price. Confirm blank, zero, fractional, and above-five quantities are rejected; test quantities 1 and 5. Buy quantity 2 of `ezik_games_3` and verify two separate store sheets appear sequentially, one unit per bridge message.
5. In the RevenueCat dashboard, confirm each completed transaction reaches the webhook once and the balance changes once. Replay the same webhook transaction and verify no second credit is added. If a purchase takes more than about 20 seconds to reach the API, reopen Hanna Laha and confirm pending polling continues.
6. In a separate quantity-2 purchase, cancel or cause an error on the second store sheet. Confirm the first completed purchase remains credited and the UI reports one of two completed. Confirm other errors stop the loop without a silent retry.
7. Start an owner session with a new account to confirm the first session is free. Start another session with no active subscription or credits and confirm purchase choices are offered after the parent gate. Purchase a game pack and verify one owner start consumes one credit. Test month and year purchases and their expiry extensions.
8. Join the room from a participant account and confirm joining never shows a payment prompt. Then refund a sandbox purchase and confirm the matching ledger event reverses remaining credit or time; test `REFUND_REVERSED` if the store emits it.
9. Repeat the same consumable product purchase in each store sandbox and record whether RevenueCat sends distinct events and transaction IDs. This is a release check because the public documentation does not state that guarantee.

## Verification

- `npm.cmd run verify:build` passed. The generated `app.js` exactly matches the checked-in build output (2,282,005 bytes).
- `npm.cmd run gates` completed with **185/187 gates passing**. The Hanna Laha isolation gate passed; no additional failures were reported beyond these two unrelated failures:
  - `recon`: the repository implementation report is stale; the current RECON summary is `278/2/0`.
  - `bankintegrity`: existing size metadata is off by one byte (`CORE_BYTES` says 3,468,019; files on disk total 3,468,018). The `sw.js` prose also reports `index.html` as 155,556 bytes while the existing file is 155,555 bytes. The IAP work did not modify these unrelated files.
- `git diff --check` passed.
- Runtime: Node `v24.19.0`, npm `11.17.0`; the project requests Node 22.x and emitted an engine-version warning.
- Gate evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-21T18-47-05-089Z-20512`.
