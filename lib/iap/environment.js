import { envName } from '../sync/store.js';

/**
 * IAP_REVIEW_ACCOUNTS: comma-separated exact Ezik account keys, server-only and
 * empty when absent. Add dedicated store-review/test accounts before a review,
 * remove them afterwards. Never populate this from a request or provider event.
 * Listed accounts read/consume only the isolated review ledger. Removing an
 * account restores its ordinary ledger; review balances are never promoted.
 */
export function isReviewAccount(accountKey) {
  return typeof accountKey === 'string' && accountKey.startsWith('acct:v1:')
    && (process.env.IAP_REVIEW_ACCOUNTS || '').split(',').map(s => s.trim()).includes(accountKey);
}

export function entitlementNamespace(accountKey) {
  return isReviewAccount(accountKey) ? 'review' : 'live';
}

// Called only AFTER shared-secret verification. The authenticated provider's
// environment is evidence, not a namespace supplied by the caller.
export function purchaseNamespace(accountKey, environment) {
  if (environment === 'PRODUCTION') return envName() === 'production' ? 'live' : null;
  if (environment === 'SANDBOX') return isReviewAccount(accountKey) ? 'review' : null;
  return null;
}

export function ledgerNamespace(namespace) {
  if (namespace !== 'live' && namespace !== 'review') throw new Error('iap-namespace');
  return envName() + (namespace === 'review' ? ':review' : '');
}
