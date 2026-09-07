// api/articles-admin.js
// POST /api/articles-admin   { session, action, ... }   ->   { ok, article } | { ok, id }
//
// EVERYTHING THAT WRITES AN ARTICLE, BEHIND ONE DOOR. Six actions -- create, update, publish,
// unpublish, delete, mine -- and one authorisation, taken once, at the top, from one function.
//
// 🔴 `mine` IS THE ONE ACTION THAT WRITES NOTHING, AND IT IS HERE RATHER THAN ON A PUBLIC ROUTE
// FOR EXACTLY THAT REASON: it is the only door in the system through which a DRAFT is allowed
// out, so it must be a door that already refuses everyone without a grant. It stands behind the
// same resolveActor() as the five that write, and it answers with the caller's OWN work and
// nobody else's -- `authorKey === actor.accountKey`, applied to every record, unconditionally.
// An owner does not see an editor's drafts through it. That is decision B-8 read literally: a
// draft is visible only to its writer, and "the owner may read anything" is not what it says.
//
// AND IT IS ALSO HOW A CLIENT LEARNS IT MAY WRITE AT ALL. There is no separate "what am I"
// route, and there should not be: a route whose only job is to report a rank is an oracle, and
// it would answer that question to anyone holding any session. `mine` answers it as a
// side-effect of doing something useful -- 401 for a reader with no grant, and a list plus the
// grant itself for a writer -- so the client can decide whether to draw a writing entry point
// without a second round trip and without a second authorisation path to keep in step.
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
// 🔴 AND THE SECTION IS ONLY HALF OF THE TEST. The other half is `status`, and it is checked in
// lib/articles/store.js -- actorMayWrite() -- rather than on this page. A DRAFT may be updated,
// published or deleted only by ITS AUTHOR, AN OWNER INCLUDED; a PUBLISHED piece stays open to
// whoever holds its section, because the owner is answerable for what stands under the app's
// name and must be able to correct it or withdraw it whoever wrote it. Both halves must hold.
// The author half lives in the store for the reason the draft filter does: a future route must
// not be able to leak by forgetting it, and the store already has the record in its hand. This
// page keeps the section half, because that needs a grant the store knows nothing about.
//
// 🔴 THAT MAKES `mine` AND THE FOUR WRITE ACTIONS ONE RULE RATHER THAN TWO. Before it, an owner
// could delete another writer's draft by id and could not be told by `mine` that it existed.
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
import { DEVICE_HEADER, FOUNDER_HEADER, hasUnrevokedFounderToken } from '../lib/daycap.js';
import { resolveActor, actorMaySection, selfFacts } from '../lib/articles/roles.js';
import {
  createArticle,
  updateArticle,
  publishArticle,
  unpublishArticle,
  deleteArticle,
  getArticleById,
  listAllForEditor,
} from '../lib/articles/store.js';

export const ACTIONS = Object.freeze(['create', 'update', 'publish', 'unpublish', 'delete', 'mine']);

/** The most of her own pieces one `mine` call reads back per section. */
export const MINE_PAGE = 50;

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
    // The founder header joins the two that were already allowed, for the ONE request that
    // carries it: the grant check below. Allowing a header is not granting anything -- the token
    // inside it is verified, and every other action on this route ignores it entirely.
    res.setHeader('Access-Control-Allow-Headers',
      'Content-Type, ' + DEVICE_HEADER + ', ' + FOUNDER_HEADER);
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
  if (!actor) {
    // THE REFUSAL IS BYTE FOR BYTE WHAT IT ALWAYS WAS FOR EVERYBODY BUT THE OWNER. A stranger, a
    // signed-in reader with no grant, an editor, a signed-out reader and somebody guessing session
    // strings all receive the same two fields they received before this branch existed -- the
    // `self` key is ADDED AFTER the object is built rather than written into the literal, so
    // nothing about the shape they get can be changed by a line below this one.
    //
    // 🔴 THE OWNER ALONE, AND THAT IS WHY IT IS THE FOUNDER TOKEN AND NOT THE SESSION.
    //
    // The diagnostic report written earlier on 2026-09-07 proposed returning these facts to any
    // caller holding a live session, on the reasoning that a live session IS the proof of being
    // that person and the facts are about nobody else. That reasoning still holds. What decided
    // against it is the constraint written over this phase: a stranger, an editor and a signed-out
    // reader must all still see exactly what they saw, BYTE FOR BYTE -- and "stranger" there
    // cannot be read as "everyone except the holder of a live session", because a signed-in
    // reader with no grant is precisely who this route calls a stranger. Under the session
    // reading, that person's answer changes. Under this one, nobody's does but the owner's.
    //
    // hasUnrevokedFounderToken() is the FULL check every site that grants a privilege calls --
    // well-formed, unexpired, bound to the device that presents it, and not on the revocation
    // list. It is not a second authorisation path invented here: it is the one the PIN control in
    // Settings already stands behind, and the owner already carries it on his own device.
    //
    // AND IT IS ASKED FIRST, so a caller with no token costs the store nothing: selfFacts() is
    // never reached, never reads an account, and never touches a session.
    const self = (await hasUnrevokedFounderToken(req)) ? await selfFacts(req) : null;
    const refusal = { ok: false, error: 'articles-forbidden' };
    if (self) refusal.self = self;
    return res.status(401).json(refusal);
  }

  res.setHeader('Cache-Control', 'private, no-store');

  if (action === 'create') {
    const section = typeof body.section === 'string' ? body.section : '';
    if (!actorMaySection(actor, section)) {
      // Not 404: nothing is being hidden here, the section names itself in the request.
      return res.status(403).json({ ok: false, error: 'articles-forbidden-section' });
    }
    const out = await createArticle(
      { section, kind: body.kind, title: body.title, body: body.body }, actor.accountKey);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, article: out.record });
  }

  if (action === 'mine') {
    // The sections asked for, intersected with the sections held. A named section this actor
    // does not hold is a 403 on the same terms as create: nothing is hidden, the request named it.
    const asked = typeof body.section === 'string' ? body.section : '';
    if (asked && !actorMaySection(actor, asked)) {
      return res.status(403).json({ ok: false, error: 'articles-forbidden-section' });
    }
    const sections = asked ? [asked] : actor.sections.slice();
    const items = [];
    for (const section of sections) {
      const out = await listAllForEditor(section, { limit: MINE_PAGE });
      // A store that would not answer is a 503 for the WHOLE call. A partial list presented as a
      // complete one is how a writer concludes her draft was lost.
      if (!out.ok) return refuse(res, out.code);
      for (const record of out.items) {
        if (record && record.authorKey === actor.accountKey) items.push(record);
      }
    }
    // Newest first ACROSS sections, by the same instant the per-section index is scored on.
    items.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return res.status(200).json({
      ok: true, role: actor.role, sections: actor.sections, items,
    });
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
