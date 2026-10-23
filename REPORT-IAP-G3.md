# EZIK-IAP-G3 — Clear a caller's test pass

## Measured before the change

- The worktree was clean on branch `iap-g3` at `e0c6e6c2dc0fc179eb84f111c1529f055d505c38`, matching `origin/main` and the test-pass instructions.
- The starting environment had no `node_modules`. `npm ci` restored the lockfile dependencies. The installed runtime is Node `v24.19.0` and npm `11.17.0`; `package.json` declares Node `22.x`, so npm reported an engine warning.
- Before the code change, RECON failed on the clean starting commit with `implementation report drift: RECON summary is stale (current 281/1/0)`, the pre-existing failure documented in `REPORT-IAP-G.md`.

## Change

`POST /api/iap-test-adjust` now accepts `clearPass: true`. It clears the signed-in caller's `subscriptionExpiresAt` to `null` in the same atomic store update as any requested trial or credit changes. The endpoint returns the new `subscriptionExpiresAt`, so `null` confirms the pass is inactive; `GET /api/iap-balance` also reports no active pass.

The existing restrictions remain in force: global mode must be `test`, the session must be live, and the caller must be listed in `IAP_TEST_ACCOUNTS`. The field must be the boolean `true`; unknown fields and target-account fields are rejected. The `test_adjust` ledger event records `clearPass` and the resulting `subscriptionExpiresAt` alongside the existing trial and credit data.

## Tests and checks

- `node --test tests/iap-g-v2.test.js tests/iap-rollout.test.js`: **18/18 passed**. Coverage includes success for a listed caller, no mutation and 403 for an unlisted caller, a signed-out caller, and modes `off` and `all`, plus one combined adjustment recorded as one ledger event.
- `npm run verify:build`: **passed**. `app.js` matches its source at 2,282,367 bytes, SHA-256 `173a08dfe95fe6e46bd55f347638a45bf8e35dd6ae8ce899bb7250444636a984`.
- `git diff --check`: **passed**.
- `npm run gates`: **187/188 passed**. RECON was the only failing gate. It reported the same pre-existing failure, `implementation report drift: RECON summary is stale (current 280/0/0)`. The final RECON counters differ from the clean baseline because dependencies were installed and the source/test changes were present; the implementation-report drift check itself remained the sole failure. All other gates passed, and the runner introduced no worktree changes.
- Gate evidence: `C:\Users\passe\AppData\Local\Temp\ezik-gates\runs\2026-10-23T03-58-23-448Z-28460`.
- After committing the four files, `node recon-audit.cjs` on the clean tree passed with `SUMMARY PASS=282 WARN=0 FAIL=0`. The implementation report was not edited; the full-suite RECON result above was from the pre-commit worktree.

## Browser console call

On `https://ezik.app`, sign in as an account listed in `IAP_TEST_ACCOUNTS`, open the browser console, and define this helper:

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

Clear only the pass while preserving the other balance fields:

```js
await iapAdjust({ clearPass: true });
```

Combined setup for a blocked-game check with zero credits and an expired trial:

```js
await iapAdjust({ clearPass: true, trialDays: 8, credits: 0 });
```

No merge, push, or deployment was performed.
