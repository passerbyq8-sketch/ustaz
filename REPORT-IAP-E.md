# EZIK-IAP-E rollout report

## Measured findings

- At the start of this rollout, `iap-free3` was two commits ahead of `origin/main`, containing the IAP-C per-game free-session work and IAP-D browser/sign-in work. The working tree had only the C, D, and E plan files untracked.
- The enforcement rule lives in `lib/iap/store.js`. `IAP_ENFORCE` accepts exactly `off`, `test`, and `all`; missing or unrecognized values resolve to `off`. In `test`, comma-separated `IAP_TEST_ACCOUNTS` entries are trimmed before matching. The list is never returned or logged.
- `api/iap-consume.js` still authenticates the Ezik session and validates the session id, game id, and intent before deciding whether to consume. An unenforced account receives `{ ok: true, mode: "unenforced" }` without calling the consumption store. The signed-out response remains `401 iap-session-required`.
- `api/iap-balance.js` retains the existing balance fields and authenticated `appUserId`, and adds an `enforced` boolean.
- `GET /api/iap-status` is public and returns only `{ mode }`. Its response is cached for 30 seconds and contains no account ids or test-account list.
- The shared IAP bridge is used for Harb (`harb`), Board (`board`), and Hanna Laha (`hanna`) owner starts. It checks the global mode before prompting a signed-out owner. `off` starts the room immediately; `test` and `all` keep the IAP-D sign-in flow. A signed-in account with `enforced: false` also starts immediately without the choice or purchase screen. Ghawas (`ghaws`) and the test game (`test`) do not call the bridge and remain ungated.
- RevenueCat webhook processing remains independent of enforcement. The regression test applies a real purchase event while enforcement is off and verifies the account receives three credits.
- The Cloudflare room worker still has no server-side gate; the client remains the enforcement point for the gated room starts.

## Vercel settings

Set these in the Vercel project for the environment being rolled out. The owner manages these values; this work did not change Vercel settings.

| State | `IAP_ENFORCE` | `IAP_TEST_ACCOUNTS` |
| --- | --- | --- |
| Public rollout off | `off` | Leave unset or empty |
| Named test accounts only | `test` | Comma-separated Ezik account ids, for example `acct:v1:google:<subject>,acct:v1:apple:<subject>` |
| Everyone enforced | `all` | Unused; may be left as-is or cleared |

The test-list values must be the exact Ezik account ids (`appUserId`, shaped as `acct:v1:<provider>:<subject>`), not email addresses. Spaces around comma-separated values are accepted. Any missing or invalid `IAP_ENFORCE` value behaves as `off`.

To move from `test` to `all`, change the Production value of `IAP_ENFORCE` to `all` and redeploy the Production deployment. Vercel applies changed environment variables only to new deployments, so changing the value alone does not update a running deployment. The status response and browser cache can take up to 30 seconds to refresh after the deployment. See [Vercel's environment variable documentation](https://vercel.com/docs/environment-variables/managing-environment-variables).

## Verification

- `node --test tests/iap-rollout.test.js`: all six rollout tests pass, covering off/test/all/invalid settings, no consumption for an unenforced user, the unchanged signed-out response, balance enforcement flags, webhook credit while off, status id privacy, and owner-start behavior in the browser bridge.
- `npm run verify:build`: passed; the built and on-disk app are both 2,282,367 bytes with SHA-256 `173a08dfe95fe6e46bd55f347638a45bf8e35dd6ae8ce899bb7250444636a984`.
- `npm run gates`: 185 of 187 gates passed. `recon` fails because the implementation summary is stale (branch summary `278/8/1`); the same stale-summary failure reproduces on `origin/main` (`280/1/0`). `memorizer86` exceeded its 300-second timing bound in the full suite (420,528 ms), but its direct check passed on this branch (271/0 in 178,886 ms) and on `origin/main` (271/0 in 136,950 ms), identifying full-suite load as the cause. The temporary full `origin/main` suite lacked `node_modules`; its non-recon dependency failures are not used as a baseline comparison.
- No merge or push was performed. No store listing, RevenueCat, native shell, answer/brain pipeline, or Cloudflare worker changes were made.
