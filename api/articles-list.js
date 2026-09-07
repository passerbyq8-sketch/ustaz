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
// THE AUTH-FAMILY THROTTLE, WHICH FAILS CLOSED, IS THE RIGHT ONE HERE AND IT COSTS A READER
// NOTHING. lib/ratelimit.js AUTH_FAIL_OPEN is false, so a Redis outage refuses this route. That
// would be a bad trade for /api/ask, where refusing a child's question is worse than the traffic
// it stops -- but the articles THEMSELVES live in that same Redis. When it cannot be reached
// there is nothing to serve, so failing closed withholds nothing that failing open could have
// delivered; it merely says so with a status code instead of an empty list.
//
// ZERO NEW STORE VARIABLES AND ZERO NEW ENVIRONMENT VARIABLES on this page.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
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

  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'articles-rate-limited' });

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
