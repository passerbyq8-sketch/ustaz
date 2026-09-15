// api/articles-list.js
// GET /api/articles-list?section=articles[&limit=&cursor=]   ->   { ok, section, items, nextCursor }
//
// THE READER'S DOOR, AND IT WORKS SIGNED OUT. No session is read, no session is accepted, and no
// session would change the answer. That is deliberate and it is the point of the route: an
// article the owner publishes must reach everyone, including a reader who has never signed in and
// never will.
//
// 🔴 IT DOES NOT CONSULT THE ROLE SEAM AT ALL. lib/articles/roles.js is not imported on this page.
// A public route that called resolveActor() -- even to ignore the answer, even "just in case" --
// would be a route whose output could one day depend on who is asking, and the first time that
// happened it would be by accident. The reader's door and the writer's door share a store and
// share nothing else.
//
// 🔴 A DRAFT CANNOT COME OUT OF HERE, AND NOT BECAUSE THIS FILE CHECKS. listPublished() applies
// the status filter inside lib/articles/store.js, to every record, unconditionally; and
// publicArticles() refuses a second time on the way out. Neither of the two is this route's own
// `if`, because the rule must survive this route being rewritten.
//
// 🔴 NO ACCOUNT KEY LEAVES THIS ROUTE. The response is built by publicArticles(), a whitelist of
// six named fields, and `authorKey` is not one of them. See lib/articles/public-view.js.
//
// THE READ-FAMILY THROTTLE IS THE RIGHT ONE HERE, AND IT IS NOT THE ONE THAT GUARDS PASSWORDS.
// This route used to drink from the auth family -- the one that guards the five sign-in
// routes. That meant a reader with no account spent the same
// per-IP budget as someone trying passwords against the five sign-in routes, and the budget
// could never be tuned for reading: every request of headroom given to a reader was headroom
// given to a guesser. lib/ratelimit.js now carries a separate READ_* family with its own key
// prefixes, so the ceilings that apply here are a question about reading alone.
//
// AND IT FAILS OPEN, WHICH BUYS LESS THAN IT SOUNDS LIKE -- SAY THE SMALLER TRUE THING.
// READ_FAIL_OPEN is true, so a counter this route cannot reach no longer refuses a reader over
// a fault that is not his. But the articles THEMSELVES live in the same Upstash instance as the
// counters: lib/articles/store.js and lib/ratelimit.js are both built from KV_REST_API_URL and
// KV_REST_API_TOKEN. When the whole store is unreachable, failing open therefore only changes
// WHICH refusal the reader gets -- the 503 below, where it used to be a 429. The gain is the
// narrower fault, the counter stumbling while a plain read still answers, and there the reader
// now gets his page instead of a refusal he did not earn.
//
// ZERO NEW STORE VARIABLES AND ZERO NEW ENVIRONMENT VARIABLES on this page.

import { applyCorsOrigin, checkReadLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { DEVICE_HEADER } from '../lib/daycap.js';
import { listPublished, SECTIONS } from '../lib/articles/store.js';
import { publicArticles } from '../lib/articles/public-view.js';

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  const rl = await checkReadLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) {
    // A REFUSAL THAT SAYS WHEN. Retry-After is delta-seconds, so the limiter's `reset` (a unix
    // timestamp in ms, carried through by checkReadLimit) becomes a wait rather than a clock
    // reading the caller would have to interpret. Never zero or negative: a window that has just
    // turned over still reads as one second, which is a truthful "very soon" rather than a "now"
    // that invites an instant retry into the same refusal. The status, the body and the order of
    // this ladder are unchanged -- this adds a header and nothing else.
    if (typeof rl.reset === 'number' && Number.isFinite(rl.reset)) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))));
    }
    return res.status(429).json({ ok: false, error: 'articles-rate-limited' });
  }

  const query = (req.query && typeof req.query === 'object') ? req.query : {};
  const section = typeof query.section === 'string' ? query.section : '';
  // The section is named, never guessed at. No default: a route that silently picked one would
  // make a typo in the client look like an empty section rather than a mistake.
  if (!SECTIONS.includes(section)) return res.status(400).json({ ok: false, error: 'articles-section' });

  const out = await listPublished(section, { limit: query.limit, cursor: query.cursor });
  if (!out.ok) {
    // 'articles-section' cannot reach here -- it was checked above -- so what is left is a store
    // that would not answer, and that is a 503 rather than an empty page.
    return res.status(503).json({ ok: false, error: out.code });
  }

  // no-store rather than a cache window: an unpublish must take a piece of writing off the
  // internet in the same instant, and a shared cache holding it for even a minute would mean the
  // one control the owner has over what is public is advisory.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ok: true,
    section,
    items: publicArticles(out.items),
    nextCursor: out.nextCursor,
  });
}
