// api/articles-admin.js
// POST /api/articles-admin   { session, action, ... }   ->   { ok, article } | { ok, id }
//
// EVERYTHING THAT WRITES AN ARTICLE, BEHIND ONE DOOR. Five actions -- create, update, publish,
// unpublish, delete -- and one authorisation, taken once, at the top, from one function.
//
// 🔴 resolveActor() IS THE ONLY IDENTITY. It is called once per request and its answer is used
// for the whole request. Nothing in the body names an account: no provider, no subject, no
// address, no accountKey -- they are not read, not accepted, and not tolerated-but-ignored. The
// one field that establishes who is acting is `session`, an opaque store key that names its own
// account and names it for exactly one person: whoever is holding it. Same shape, same reasoning,
// as api/auth-delete.js.
//
// 🔴 NULL IS THE ONLY DEFAULT. resolveActor() returns null for no session, an expired session, an
// account with no grant, a grant naming no known section, a malformed key, or a store that
// throws. Every one of those lands on the same 401 here. There is no branch on this page that
// produces an actor, and none that treats a missing one as an editor.
//
// 🔴 THE SECTION IS CHECKED ON EVERY ACTION, INCLUDING THE ONES THAT NAME AN ARTICLE RATHER THAN
// A SECTION. update, publish, unpublish and delete read the record FIRST and check the grant
// against the record's OWN section -- because an editor granted `articles` must not be able to
// reach a piece in `women` by knowing its id. An owner holds every section, by
// actorMaySection(), which is the one place that comparison is written.
//
// 🔴 A MISSING ARTICLE AND A FORBIDDEN ONE ARE THE SAME ANSWER -- 404 for both. Returning 403 for
// an article the actor may not touch would confirm that it exists, and a 404 for a real article
// costs a legitimate editor nothing: an editor who may not see it has no use for the difference.
//
// THE DEVICE HEADER IS NOT REQUIRED HERE, AND THAT IS A DELIBERATE DIVERGENCE FROM
// api/auth-delete.js. That route requires `x-murabbi-device` because it answers only the app's
// own capped fetch path, and the reader it protects always has one. This panel must work in a
// BROWSER as well as inside the native shell (owner decision D-4), the browser client for it does
// not exist yet, and requiring a header the future client has not been written to send would be a
// constraint chosen here on behalf of a page nobody has designed. The header is still ACCEPTED --
// it is named in Access-Control-Allow-Headers -- so a shell client that sends one is not refused.
// The session is the identity either way; the header never was.
//
// ZERO NEW STORE VARIABLES AND ZERO NEW ENVIRONMENT VARIABLES on this page.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { DEVICE_HEADER } from '../lib/daycap.js';
import { resolveActor, actorMaySection } from '../lib/articles/roles.js';
import {
  createArticle,
  updateArticle,
  publishArticle,
  unpublishArticle,
  deleteArticle,
  getArticleById,
} from '../lib/articles/store.js';

export const ACTIONS = Object.freeze(['create', 'update', 'publish', 'unpublish', 'delete']);

/**
 * A store refusal -> a status code. Named explicitly rather than derived from the string, so a
 * new code cannot fall into a default that happens to be 200-shaped. Anything not listed is a
 * 503: an unrecognised refusal is treated as the server's fault, never as the caller's.
 */
const CLIENT_ERRORS = Object.freeze([
  'articles-actor', 'articles-section', 'articles-title', 'articles-body', 'articles-id',
  'articles-patch-empty', 'articles-patch-field', 'articles-slug-unavailable',
]);

function refuse(res, code) {
  if (code === 'articles-not-found') return res.status(404).json({ ok: false, error: code });
  if (CLIENT_ERRORS.includes(code)) return res.status(400).json({ ok: false, error: code });
  return res.status(503).json({ ok: false, error: code });
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED -- see lib/ratelimit.js AUTH_FAIL_OPEN. A write we cannot count is one we do not
  // make; and unlike a reader's question, a write that waits a minute has lost nothing.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'articles-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const action = typeof body.action === 'string' ? body.action : '';
  if (!ACTIONS.includes(action)) return res.status(400).json({ ok: false, error: 'articles-action' });

  const actor = await resolveActor(req);
  if (!actor) return res.status(401).json({ ok: false, error: 'articles-forbidden' });

  res.setHeader('Cache-Control', 'private, no-store');

  if (action === 'create') {
    const section = typeof body.section === 'string' ? body.section : '';
    if (!actorMaySection(actor, section)) {
      // Not 404: nothing is being hidden here, the section names itself in the request.
      return res.status(403).json({ ok: false, error: 'articles-forbidden-section' });
    }
    const out = await createArticle(
      { section, title: body.title, body: body.body }, actor.accountKey);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, article: out.record });
  }

  // The four id-bearing actions. THE RECORD IS READ BEFORE ANYTHING IS DECIDED, because the
  // section that governs the grant is a property of the article and not of the request.
  const id = typeof body.id === 'string' ? body.id : '';
  const existing = await getArticleById(id);
  if (!existing || !actorMaySection(actor, existing.section)) {
    // Absent, unreadable, or outside this actor's sections -- ONE answer for all three.
    return res.status(404).json({ ok: false, error: 'articles-not-found' });
  }

  if (action === 'update') {
    const patch = (body.patch && typeof body.patch === 'object') ? body.patch : {};
    const out = await updateArticle(id, patch, actor.accountKey);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, article: out.record });
  }

  if (action === 'publish') {
    const out = await publishArticle(id, actor.accountKey);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, article: out.record });
  }

  if (action === 'unpublish') {
    const out = await unpublishArticle(id, actor.accountKey);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, article: out.record });
  }

  // delete -- the one action with no record to hand back, because there is none left to re-read.
  const out = await deleteArticle(id, actor.accountKey);
  if (!out.ok) return refuse(res, out.code);
  return res.status(200).json({ ok: true, id: out.id });
}
