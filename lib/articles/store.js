// lib/articles/store.js
// THE FOUR KEY FAMILIES THE ARTICLES PATH OWNS -- built, read, written and consumed in one place.
//
// THE SAME UPSTASH INSTANCE, REACHED THE SAME WAY. The client accessor below is the explicit-
// credential shape lib/auth/store.js uses, for the reason recorded there: Vercel injects
// KV_REST_API_*, while @upstash/redis's auto-env expects UPSTASH_REDIS_REST_*, so a client built
// without arguments silently points at nothing. ZERO NEW STORE VARIABLES: this module reads
// KV_REST_API_URL and KV_REST_API_TOKEN and nothing else. A namespace in this store is TEXT IN A
// KEY -- not a table, not a resource, not a bill. Sixteen key families already share this one
// instance; these four join them the same way.
//
// WHY THE ACCESSOR IS REPEATED HERE RATHER THAN IMPORTED FROM lib/auth/store.js. That module
// exports readJson/writeJson/deleteKey but not its client, and this module needs SORTED SET
// operations the auth path has never had -- the per-section index is a zset. Exporting the auth
// client, or growing the auth store four sorted-set helpers it does not use, would edit a file
// that three gates lift verbatim and measure. So the accessor is repeated, deliberately, and the
// TEST SEAM is repeated with it so this module can be driven without the auth store being
// involved at all. The credentials, the failure semantics and the helper style are identical;
// what is not shared is the object.
//
// THE KEY SHAPES, AND WHY EACH IS SHAPED THAT WAY:
//
//   art:v1:<id>              the article record. `id` is minted here from randomBytes and is
//                            url-safe, so it can be a path segment without being escaped, and
//                            it carries no ':' so it cannot reach across into another key.
//   artidx:v1:<section>      ONE SORTED SET PER SECTION, member = article id, score = the
//                            creation instant in milliseconds. The score is createdAt and NOT
//                            publishedAt on purpose: publishing must not reorder a list, and an
//                            article that is unpublished and published again must not jump.
//   artslug:v1:<slug>        slug -> { id }. The reader's stable URL. Written NX -- see
//                            claimSlug() -- so two articles sharing a title cannot share a slug.
//   role:v1:<accountKey>     a granted role. The account key is itself `acct:v1:<provider>:<sub>`,
//                            so this key reads role:v1:acct:v1:google:<sub>. That is not a
//                            mistake: the key space is flat, the account key is the identity the
//                            grant is about, and pasting it in whole keeps ONE identity string
//                            in play instead of a second derived one that could drift from it.
//                            It is shape-checked before it is interpolated -- see safeAccountKey.
//
// NOT ONE OF THE FOUR CARRIES A TTL, AND THAT IS A DECISION RATHER THAN AN OMISSION. An article
// and a grant both end by an explicit act -- an unpublish, a delete, a revoke -- and never by a
// clock. A record that expired on its own would take an author's work, or a writer's permission,
// away at a moment nobody chose and with nothing to point at afterwards. This is the owner's
// decision D-3 ("an account record does not expire; it ends only when its owner deletes it")
// applied to the data that hangs off an account, and it answers the open question written at
// lib/auth/store.js:112-122 for THIS module's families: the answer is no expiry, chosen.
//
// A STORE THAT CANNOT BE READ IS NOT AN EMPTY STORE. Every helper here returns null / false on
// failure and the CALLERS fail closed on that -- the same discipline lib/auth/store.js follows,
// and the opposite of lib/ledger/redis.js where the same shape means "a cache is an optimisation".
//
// AND THIS MODULE DOES NOT DECIDE WHO MAY WRITE. Permission lives in lib/articles/roles.js and
// is resolved once, at the route, before any function here is called. What the mutators below DO
// enforce is that no mutation is unattributed: every one of them takes an actor key, shape-checks
// it, and refuses without it. That is not authorisation -- it is the refusal to record a change
// with nobody's name on it.

import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

export const ARTICLE_PREFIX = 'art:v1:';
export const ARTICLE_INDEX = 'artidx:v1:';
export const ARTICLE_SLUG_INDEX = 'artslug:v1:';
export const ROLE_PREFIX = 'role:v1:';

/**
 * THE TWO SECTIONS, FROZEN. A section is part of a key and part of a public URL, so the list is
 * closed: a value that is not one of these two is refused rather than creating a third namespace
 * by being typed. Widening it is a deliberate edit here, which is where a reader looks for it.
 */
export const SECTIONS = Object.freeze(['articles', 'women']);

/**
 * The nine keys a record may have, in order. Anything else is not written and not kept.
 *
 * THERE IS NO `v` FIELD, unlike lib/auth/account.js. The version lives in the KEY PREFIX --
 * 'art:v1:' -- which is where a shape change has to be expressed anyway if today's records are
 * not to be collided with. Carrying it twice would be two numbers that can disagree.
 *
 * AND THERE IS NO AUTHOR NAME AND NO AUTHOR ADDRESS. `authorKey` is the account key and nothing
 * else. A name duplicated into content that may later be served publicly is a copy that cannot
 * be corrected, cannot be withdrawn when the account is deleted, and outlives the record it came
 * from. A name is looked up when it is needed -- see lib/articles/public-view.js.
 */
export const ARTICLE_FIELDS = Object.freeze([
  'id', 'slug', 'section', 'title', 'body', 'status', 'authorKey',
  'createdAt', 'updatedAt', 'publishedAt',
]);

/** The two statuses. `published` is the ONLY one a public route may serve. */
export const STATUS_DRAFT = 'draft';
export const STATUS_PUBLISHED = 'published';

/** Bounds. A title and a body reach a key and a page; neither may be unbounded. */
export const MAX_TITLE_CHARS = 200;
export const MAX_BODY_CHARS = 200000;
export const MAX_SLUG_CHARS = 80;
export const DEFAULT_PAGE = 20;
export const MAX_PAGE = 50;
/** The most index entries one list call will read through while filtering drafts out. */
export const MAX_SCAN = 500;

let _redis = null;
let _forced = false;

function client() {
  if (_forced) return _redis;
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  _redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _redis;
}

/** Test seam, the shape lib/auth/store.js already uses. Pass null for an unreachable store. */
export function __setArticleStoreForTest(r) { _redis = r; _forced = true; }
export function __resetArticleStore() { _redis = null; _forced = false; }

export async function storeAvailable() { return client() !== null; }

// ---------------------------------------------------------------------------
// KEY BUILDERS AND THE SHAPE CHECKS THAT GUARD THEM.
//
// Every value that lands inside a key is validated, not trusted -- the discipline
// lib/auth/account.js safeSubject() and lib/daycap.js safeId() already apply, for the same
// reason: a value carrying ':' could otherwise forge another key.
// ---------------------------------------------------------------------------

export const articleKey = (id) => ARTICLE_PREFIX + id;
export const sectionIndexKey = (section) => ARTICLE_INDEX + section;
export const slugKey = (slug) => ARTICLE_SLUG_INDEX + slug;
export const roleKey = (accountKeyString) => ROLE_PREFIX + accountKeyString;

/** base64url, 16 characters, from randomBytes. url-safe and not guessable. */
export function newArticleId() { return crypto.randomBytes(12).toString('base64url'); }

export function safeArticleId(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}

/**
 * A slug may carry any script's letters and digits, the hyphen and the underscore, and nothing
 * else -- no ':', no whitespace, no control characters, no '/'. An Arabic title therefore keeps
 * its own letters rather than being flattened to an empty string; the browser percent-encodes
 * them in a URL and the round trip is exact.
 *
 * THE UNDERSCORE IS HERE FOR THE FALLBACK, NOT FOR TITLES. slugify() never produces one -- it
 * turns every run of non-letters into a hyphen -- but a title made entirely of punctuation
 * slugifies to nothing, and claimSlug() then falls back to the ARTICLE ID, which is base64url
 * and carries '_' about two times in five. Refusing the underscore here would have made that
 * fallback unclaimable and turned an unusual title into a refused article. '_' is unreserved in
 * RFC 3986, so it costs the URL nothing.
 */
export function safeSlug(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length === 0 || s.length > MAX_SLUG_CHARS) return null;
  return /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(s) ? s : null;
}

export function isSection(v) { return typeof v === 'string' && SECTIONS.includes(v); }

/**
 * `acct:v1:<provider>:<sub>` exactly as lib/auth/store.js accountKey() builds it. The subject
 * charset is safeSubject()'s, and the provider is lower-case letters -- the two the sign-in path
 * has. A key that does not match is refused rather than interpolated.
 */
export function safeAccountKey(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^acct:v1:[a-z]{1,32}:[A-Za-z0-9._@|-]{1,128}$/.test(s) ? s : null;
}

/**
 * Title -> slug base. Letters and digits of ANY script are kept; every run of anything else
 * becomes one hyphen. Returns '' when the title held nothing that survives, and the caller falls
 * back to the id -- an article without a typeable title still gets a stable URL.
 */
export function slugify(title) {
  const s = String(title === null || title === undefined ? '' : title).trim().toLowerCase();
  const out = s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+/, '').replace(/-+$/, '');
  return out.slice(0, MAX_SLUG_CHARS).replace(/-+$/, '');
}

function nowIso(at) { return new Date(typeof at === 'number' ? at : Date.now()).toISOString(); }

/** Keeps exactly the nine fields, in order, and drops anything a stored record grew elsewhere. */
function onlyKnownFields(record) {
  const out = {};
  for (const field of ARTICLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) out[field] = record[field];
  }
  return out;
}

// ---------------------------------------------------------------------------
// READ / WRITE. The same five shapes lib/auth/store.js exposes, plus the three sorted-set
// operations the per-section index needs. NONE of them passes a TTL -- see the head of the file.
// ---------------------------------------------------------------------------

/** Null when absent OR when the store cannot be reached. The caller fails closed on both. */
export async function readJson(k) {
  const c = client();
  if (!c) return null;
  try {
    const raw = await c.get(k);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    return JSON.parse(String(raw));
  } catch (e) { return null; }
}

/** Writes JSON with NO expiry. There is no ttl parameter here, so none can be passed by mistake. */
export async function writeJson(k, value) {
  const c = client();
  if (!c) return false;
  try { await c.set(k, JSON.stringify(value)); return true; } catch (e) { return false; }
}

/**
 * WRITE ONLY IF THE KEY IS NOT THERE -- the slug index, and only it.
 *
 * WHY IT MUST NOT OVERWRITE. Two articles written from the same title race for the same slug. A
 * plain SET would let the second silently take the first article's URL, and every link already
 * published to it would then open a different piece of writing. NX is one round trip with no
 * window in it, so two simultaneous creations cannot both believe they claimed the same slug.
 */
export async function writeIfAbsent(k, value) {
  const c = client();
  if (!c) return false;
  try {
    const reply = await c.set(k, JSON.stringify(value), { nx: true });
    return reply !== null && reply !== undefined && reply !== false;
  } catch (e) { return false; }
}

export async function deleteKey(k) {
  const c = client();
  if (!c) return false;
  try { await c.del(k); return true; } catch (e) { return false; }
}

export async function indexAdd(k, score, member) {
  const c = client();
  if (!c) return false;
  try { await c.zadd(k, { score, member }); return true; } catch (e) { return false; }
}

export async function indexRemove(k, member) {
  const c = client();
  if (!c) return false;
  try { await c.zrem(k, member); return true; } catch (e) { return false; }
}

/**
 * Newest first, by index range. Returns null -- NOT [] -- when the store cannot be reached, so a
 * caller can tell "this section is empty" from "we could not ask", and refuse on the second.
 */
export async function indexPage(k, start, stop) {
  const c = client();
  if (!c) return null;
  try {
    const rows = await c.zrange(k, start, stop, { rev: true });
    return Array.isArray(rows) ? rows.map((m) => String(m)) : [];
  } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// THE RECORD.
// ---------------------------------------------------------------------------

/** The stored record, trimmed to the nine fields, or null (absent, unreadable, or malformed). */
export async function getArticleById(id) {
  const safe = safeArticleId(id);
  if (!safe) return null;
  const record = await readJson(articleKey(safe));
  if (!record || typeof record !== 'object' || record.id !== safe) return null;
  return onlyKnownFields(record);
}

/** The record behind a slug, WHATEVER its status. For an editor. Never for a public route. */
export async function getArticleBySlug(slug) {
  const safe = safeSlug(slug);
  if (!safe) return null;
  const entry = await readJson(slugKey(safe));
  if (!entry || typeof entry.id !== 'string') return null;
  const record = await getArticleById(entry.id);
  // The slug entry must still be the one this record answers to. An entry left pointing at a
  // record whose slug has moved is not a match, and is not served.
  if (!record || record.slug !== safe) return null;
  return record;
}

/**
 * THE PUBLIC BY-SLUG READ, AND THE DRAFT FILTER LIVES HERE RATHER THAN AT THE ROUTE.
 *
 * api/articles-get.js calls this and never getArticleBySlug(), for the same reason listPublished
 * filters inside the store: a rule that decides whether unpublished writing reaches the internet
 * does not get to depend on every future route remembering it. `status` is the single source of
 * "is it public" -- publishedAt is a fact about the past and is NOT consulted here, so an
 * unpublished article that still carries the date it was once published stays unreachable.
 */
export async function getPublishedBySlug(slug) {
  const record = await getArticleBySlug(slug);
  if (!record || record.status !== STATUS_PUBLISHED) return null;
  return record;
}

/**
 * Claims the first free slug from `base`, `base-2`, `base-3`, ... NX at every attempt.
 * Returns the claimed slug or null (all taken, or a store that would not answer).
 */
async function claimSlug(base, id) {
  const root = safeSlug(base) ? base : id;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? root : (root.slice(0, MAX_SLUG_CHARS - 4) + '-' + n);
    const safe = safeSlug(candidate);
    if (!safe) continue;
    if (await writeIfAbsent(slugKey(safe), { id })) return safe;
  }
  return null;
}

/**
 * CREATE. Always a DRAFT -- nothing reaches a reader by being written; publishing is its own
 * act, its own function and its own audited call. Returns { ok, record } or { ok: false, code }.
 *
 * THE ORDER IS SLUG, RECORD, INDEX, AND EVERY STEP IS ROLLED BACK ON THE ONE AFTER IT. The slug
 * is claimed first because it is the only step that can lose a race; if the record write then
 * fails, an unclaimed-back slug would be a URL blocked forever by an article that does not exist.
 * If the index write fails, a record outside its section index is invisible to every list and
 * could never be found again. So a partial creation is undone rather than reported as a success
 * with a hole in it.
 */
export async function createArticle(input, authorKey) {
  const actor = safeAccountKey(authorKey);
  if (!actor) return { ok: false, code: 'articles-actor' };

  const src = (input && typeof input === 'object') ? input : {};
  if (!isSection(src.section)) return { ok: false, code: 'articles-section' };
  const title = typeof src.title === 'string' ? src.title.trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE_CHARS) return { ok: false, code: 'articles-title' };
  const body = typeof src.body === 'string' ? src.body : '';
  if (body.length > MAX_BODY_CHARS) return { ok: false, code: 'articles-body' };

  const id = newArticleId();
  const slug = await claimSlug(slugify(title), id);
  if (!slug) return { ok: false, code: 'articles-slug-unavailable' };

  const at = nowIso();
  // Named one at a time, the way lib/auth/account.js writes its seven: a caller that starts
  // sending an extra field cannot get any of it stored by arriving with it.
  const record = {
    id,
    slug,
    section: src.section,
    title,
    body,
    status: STATUS_DRAFT,
    authorKey: actor,
    createdAt: at,
    updatedAt: at,
    publishedAt: null,
  };

  if (!(await writeJson(articleKey(id), record))) {
    await deleteKey(slugKey(slug));
    return { ok: false, code: 'articles-unwritable' };
  }
  if (!(await indexAdd(sectionIndexKey(record.section), Date.parse(at), id))) {
    await deleteKey(articleKey(id));
    await deleteKey(slugKey(slug));
    return { ok: false, code: 'articles-index-unwritable' };
  }

  const fresh = await getArticleById(id);
  if (!fresh) return { ok: false, code: 'articles-unreadable' };
  return { ok: true, record: fresh };
}

/**
 * UPDATE -- title and body, and nothing else. A patch carrying any other key is REFUSED rather
 * than filtered, so a caller that believes it moved an article between sections is told it did
 * not. What each excluded field costs to change is stated where it is excluded:
 *
 *   slug        stays put ACROSS EDITS BY DESIGN. A published URL that changes when a typo in
 *               the title is fixed is a link that stops working.
 *   status      moves through publishArticle / unpublishArticle, which are auditable acts.
 *   section     would have to move the index entry as well; it is not offered in v1 rather than
 *               half-implemented here.
 *   authorKey   never moves. The record names who wrote it, not who last touched it.
 *   id, timestamps  are the store's to write.
 */
export const UPDATABLE_FIELDS = Object.freeze(['title', 'body']);

export async function updateArticle(id, patch, actorKey) {
  const actor = safeAccountKey(actorKey);
  if (!actor) return { ok: false, code: 'articles-actor' };
  const safe = safeArticleId(id);
  if (!safe) return { ok: false, code: 'articles-id' };

  const src = (patch && typeof patch === 'object') ? patch : {};
  const keys = Object.keys(src);
  if (keys.length === 0) return { ok: false, code: 'articles-patch-empty' };
  for (const k of keys) if (!UPDATABLE_FIELDS.includes(k)) return { ok: false, code: 'articles-patch-field' };

  const existing = await getArticleById(safe);
  if (!existing) return { ok: false, code: 'articles-not-found' };

  const record = onlyKnownFields(existing);
  if (Object.prototype.hasOwnProperty.call(src, 'title')) {
    const title = typeof src.title === 'string' ? src.title.trim() : '';
    if (title.length === 0 || title.length > MAX_TITLE_CHARS) return { ok: false, code: 'articles-title' };
    record.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(src, 'body')) {
    if (typeof src.body !== 'string' || src.body.length > MAX_BODY_CHARS) {
      return { ok: false, code: 'articles-body' };
    }
    record.body = src.body;
  }
  record.updatedAt = nowIso();

  if (!(await writeJson(articleKey(safe), record))) return { ok: false, code: 'articles-unwritable' };
  const fresh = await getArticleById(safe);
  if (!fresh) return { ok: false, code: 'articles-unreadable' };
  return { ok: true, record: fresh };
}

/**
 * PUBLISH. `publishedAt` is set the FIRST time an article becomes public and is kept thereafter:
 * it is the day this writing reached a reader, and an unpublish followed by a republish does not
 * make that a different day. What decides visibility is `status`, alone.
 */
export async function publishArticle(id, actorKey) {
  return setStatus(id, actorKey, STATUS_PUBLISHED);
}

/**
 * UNPUBLISH. `status` goes back to draft and the article leaves every public door in the same
 * instant. `publishedAt` is deliberately LEFT STANDING -- erasing it would destroy the record of
 * when the piece was public, which is exactly what someone asking about it later needs.
 */
export async function unpublishArticle(id, actorKey) {
  return setStatus(id, actorKey, STATUS_DRAFT);
}

async function setStatus(id, actorKey, status) {
  const actor = safeAccountKey(actorKey);
  if (!actor) return { ok: false, code: 'articles-actor' };
  const safe = safeArticleId(id);
  if (!safe) return { ok: false, code: 'articles-id' };

  const existing = await getArticleById(safe);
  if (!existing) return { ok: false, code: 'articles-not-found' };

  const record = onlyKnownFields(existing);
  record.status = status;
  record.updatedAt = nowIso();
  if (status === STATUS_PUBLISHED && !record.publishedAt) record.publishedAt = record.updatedAt;

  if (!(await writeJson(articleKey(safe), record))) return { ok: false, code: 'articles-unwritable' };
  const fresh = await getArticleById(safe);
  if (!fresh) return { ok: false, code: 'articles-unreadable' };
  return { ok: true, record: fresh };
}

/**
 * DELETE -- three erasures, and the order between them is the same discipline
 * lib/auth/account.js deleteAccount() follows.
 *
 * THE SLUG ENTRY GOES FIRST because it is the only pointer to the record that is not the
 * record's own key: an entry left standing after its record is gone is an arrow to nothing, and
 * it also blocks that URL against every future article. If this step fails the record is still
 * there, its slug can still be read off it, and a retry can still finish the job. Delete the
 * record first and a failure here strands the arrow with nothing left to say which slug to look
 * under. AND THE ENTRY IS ONLY REMOVED IF IT POINTS AT *THIS* ARTICLE -- an entry naming another
 * id is left exactly where it is, and that is a success rather than a skipped step.
 *
 * THE INDEX ENTRY GOES SECOND, so the article stops appearing in a list before the record it
 * would need is gone. THE RECORD GOES LAST.
 *
 * This is the one mutator with no record to return -- there is nothing left to re-read.
 * Returns { ok: true, id, removed: { slug, index, record } } or { ok: false, code }.
 */
export async function deleteArticle(id, actorKey) {
  const actor = safeAccountKey(actorKey);
  if (!actor) return { ok: false, code: 'articles-actor' };
  const safe = safeArticleId(id);
  if (!safe) return { ok: false, code: 'articles-id' };

  const record = await getArticleById(safe);
  if (!record) return { ok: false, code: 'articles-not-found' };

  let slugRemoved = false;
  const s = safeSlug(record.slug);
  if (s) {
    const entry = await readJson(slugKey(s));
    if (entry && typeof entry === 'object' && entry.id === safe) {
      if (!(await deleteKey(slugKey(s)))) return { ok: false, code: 'articles-delete-slug' };
      slugRemoved = true;
    }
  }
  if (!(await indexRemove(sectionIndexKey(record.section), safe))) {
    return { ok: false, code: 'articles-delete-index' };
  }
  if (!(await deleteKey(articleKey(safe)))) return { ok: false, code: 'articles-delete-record' };

  return { ok: true, id: safe, removed: { slug: slugRemoved, index: true, record: true } };
}

// ---------------------------------------------------------------------------
// THE TWO LISTS.
//
// The cursor is an OFFSET INTO THE SECTION INDEX, printed as a decimal string. It is opaque to a
// caller and is only ever handed back the way it came. An offset rather than a score because the
// index is dense and small, and because two articles created in the same millisecond would make
// a score cursor skip one of them.
// ---------------------------------------------------------------------------

function pageArgs(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  let limit = Number(o.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_PAGE;
  limit = Math.min(Math.floor(limit), MAX_PAGE);
  let cursor = Number(o.cursor);
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;
  return { limit, offset: Math.floor(cursor) };
}

/**
 * THE READER'S LIST, AND A DRAFT CAN NEVER COME OUT OF IT.
 *
 * The filter is HERE, in the store, and not at api/articles-list.js. A route can be rewritten,
 * copied, or joined by a second one; the rule that unpublished writing does not reach the
 * internet must not be re-implemented each time, because the first time it is forgotten is the
 * time it matters. `status !== 'published'` is the whole test, and it is applied to every record
 * this function is about to return, unconditionally -- there is no flag, no option and no branch
 * that skips it.
 *
 * Returns { ok: true, items, nextCursor } -- nextCursor is null when the section is exhausted.
 * A store that will not answer returns { ok: false, code }, never an empty page: "there is
 * nothing here" and "we could not ask" are not the same sentence.
 */
export async function listPublished(section, opts) {
  return listSection(section, opts, true);
}

/** THE EDITOR'S LIST -- drafts included. Never reachable from a public route. */
export async function listAllForEditor(section, opts) {
  return listSection(section, opts, false);
}

async function listSection(section, opts, publishedOnly) {
  if (!isSection(section)) return { ok: false, code: 'articles-section' };
  const { limit, offset } = pageArgs(opts);
  const key = sectionIndexKey(section);

  const items = [];
  let at = offset;
  let scanned = 0;
  while (items.length < limit && scanned < MAX_SCAN) {
    const window = Math.min(limit * 2, MAX_SCAN - scanned);
    const ids = await indexPage(key, at, at + window - 1);
    if (ids === null) return { ok: false, code: 'articles-unreadable' };
    if (ids.length === 0) return { ok: true, items, nextCursor: null };
    for (const id of ids) {
      at += 1;
      scanned += 1;
      const record = await getArticleById(id);
      // An index entry whose record is gone is skipped rather than reported. It is the residue of
      // a delete that failed after the index step, and it is not something a reader should see.
      if (!record) continue;
      if (publishedOnly && record.status !== STATUS_PUBLISHED) continue;
      items.push(record);
      if (items.length >= limit) break;
    }
    if (ids.length < window) return { ok: true, items, nextCursor: null };
  }
  return { ok: true, items, nextCursor: String(at) };
}
