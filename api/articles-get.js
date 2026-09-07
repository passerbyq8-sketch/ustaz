// api/articles-get.js
// GET /api/articles-get?slug=<slug>   ->   { ok, article }
//
// THE SECOND HALF OF THE READER'S DOOR: one article, by its stable URL, signed out.
//
// 🔴 IT DOES NOT CONSULT THE ROLE SEAM AT ALL -- lib/articles/roles.js is not imported here, for
// the reason api/articles-list.js records at length. Neither public route may have an answer that
// depends on who is asking.
//
// 🔴 A DRAFT CANNOT COME OUT OF HERE. This route calls getPublishedBySlug() and NEVER
// getArticleBySlug(): the status filter is inside lib/articles/store.js so that it survives this
// file being rewritten, and publicArticle() refuses a second time on the way out.
//
// 🔴 AN ABSENT ARTICLE AND A DRAFT ARE THE SAME ANSWER. Both are 404 with the same code. Telling
// them apart would turn this route into an oracle for "is there an unpublished piece at this
// slug" -- and it would answer that to anyone who could guess a title. The same discipline
// api/auth-delete.js applies to its four refusal cases.
//
// 🔴 NO ACCOUNT KEY LEAVES THIS ROUTE. publicArticle() is a whitelist of six named fields and
// `authorKey` is not one of them.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { DEVICE_HEADER } from '../lib/daycap.js';
import { getPublishedBySlug } from '../lib/articles/store.js';
import { publicArticle } from '../lib/articles/public-view.js';

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
  const slug = typeof query.slug === 'string' ? query.slug : '';
  if (slug.length === 0) return res.status(400).json({ ok: false, error: 'articles-slug' });

  const record = await getPublishedBySlug(slug);
  const view = publicArticle(record);
  // Absent, draft, malformed slug, or a store that would not answer: ONE refusal for all four.
  // A store fault reads as 404 here rather than 503, and that is the deliberate half of the
  // oracle rule -- a caller must not be able to distinguish "not published" from anything else.
  if (!view) return res.status(404).json({ ok: false, error: 'articles-not-found' });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ ok: true, article: view });
}
