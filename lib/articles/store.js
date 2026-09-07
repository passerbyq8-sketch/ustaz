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
 * The eleven keys a record may have, in order. Anything else is not written and not kept.
 *
 * THERE IS NO `v` FIELD, unlike lib/auth/account.js. The version lives in the KEY PREFIX --
 * 'art:v1:' -- which is where a shape change has to be expressed anyway if today's records are
 * not to be collided with. Carrying it twice would be two numbers that can disagree.
 *
 * AND THERE IS NO AUTHOR NAME AND NO AUTHOR ADDRESS. `authorKey` is the account key and nothing
 * else. A name duplicated into content that may later be served publicly is a copy that cannot
 * be corrected, cannot be withdrawn when the account is deleted, and outlives the record it came
 * from. A name is looked up when it is needed -- see lib/articles/public-view.js.
 *
 * `kind` JOINED THE ROSTER ON 2026-09-07, FOR DECISION D-11, AND IT IS THE ONLY FIELD THAT DID.
 * The owner chose two article SHAPES: a question-and-answer card, and an article with a title and
 * a body. The two shapes carry the SAME TWO TEXT FIELDS -- for a Q&A, `title` holds the question
 * and `body` holds the answer -- so no `question` field and no `answer` field was added, and
 * none ever should be: two fields that hold the same thing under two names is a record that can
 * disagree with itself, and it would double every place that reads a title.
 *
 * WHAT COULD NOT BE AVOIDED IS THE ONE WORD THAT SAYS WHICH SHAPE THIS IS. It is a choice the
 * writer makes at writing time and it is not derivable from the text: a rule like "the title ends
 * in a question mark" would be an invention, and it would silently reclassify an article the day
 * somebody wrote a rhetorical heading. So the choice is STORED, as one closed-vocabulary word,
 * and it is the whole of the addition.
 */
export const ARTICLE_FIELDS = Object.freeze([
  'id', 'slug', 'section', 'kind', 'title', 'body', 'status', 'authorKey',
  'createdAt', 'updatedAt', 'publishedAt',
]);

/**
 * THE TWO SHAPES, FROZEN, on the same terms as SECTIONS above: a value that is not one of these
 * is not stored. `article` is the DEFAULT, and it is the default deliberately -- a record written
 * before this field existed, or by a client that does not know about it, reads as the plain shape
 * rather than as a question nobody asked.
 */
export const KIND_ARTICLE = 'article';
export const KIND_QA = 'qa';
export const KINDS = Object.freeze([KIND_ARTICLE, KIND_QA]);

/** A kind, or the default. Never a refusal: an unknown word is not a reason to lose the writing. */
export function safeKind(v) { return (typeof v === 'string' && KINDS.includes(v)) ? v : KIND_ARTICLE; }

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
 *
 * AND THE FIRST CHARACTER STAYS A LETTER OR A DIGIT, DELIBERATELY. Widening this class to admit
 * a leading '-' or '_' would widen THE READER'S DOOR as well: every slug arriving in a URL is
 * checked by this same function before it is read back, so shapes that no title and no fallback
 * can mint -- '-x', '__', '--2' -- would start being accepted at the public route. The fallback
 * is made to fit this class instead of the class being opened to it. See fallbackSlug().
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
 * DECORATION IS REMOVED, NOT SEPARATED -- combining marks and the tatweel, in one step.
 *
 * A harakah is Unicode category Mn, which is NOT \p{L}, so slugify()'s "anything that is not a
 * letter or a digit becomes a hyphen" rule used to cut a vowelled Arabic word into pieces IN THE
 * MIDDLE OF ITSELF: a two-word title came out as six fragments. Ezik is an Arabic religious-
 * education app and its two writers vowel their headings, so that is the common case here rather
 * than the exotic one. A mark is decoration ON a letter, never a boundary BETWEEN two, so it is
 * deleted before the letter test ever sees it.
 *
 * THE STRING IS TAKEN AS IT IS -- NO NFD, NO NFKD, DELIBERATELY. Decomposing first would strip
 * far more than diacritics: NFD turns U+0623 alef-with-hamza into U+0627 + U+0654, and U+0654 is
 * itself Mn, so decompose-then-strip would silently rewrite alef-hamza to a bare alef and merge
 * U+0622 / U+0623 / U+0625 / U+0624 / U+0626 down onto three letters. Those are LETTERS an
 * Arabic writer chose, not marks they added, and moving them would change the slug of ordinary
 * UNVOWELLED titles -- exactly what this fix promises not to do. Taking the string as given also
 * keeps a precomposed European letter whole: U+00E9 is Ll and not Mn, so a name written with an
 * acute keeps that letter in its slug instead of being flattened to the bare vowel.
 *
 * Mn AND NOT \p{M}. Mc -- a spacing combining mark, such as a Devanagari matra -- carries a vowel
 * that is part of the word rather than an accent over it, and deleting it would misspell the word
 * instead of tidying it.
 *
 * U+0640 TATWEEL IS STRIPPED TOO, FOR A DIFFERENT REASON FROM THE MARKS. It never shattered a
 * word -- it is category Lm, so \p{L} has always accepted it and it has never produced a hyphen,
 * which is why the harakat fix left it alone and pinned that. It is removed here because it is
 * DECORATION rather than spelling: a writer stretches a word to fill a line, and the reader sees
 * one word either way. Left in, U+0627 U+0644 U+0635 U+0640 U+0640 U+0640 U+0628 U+0631 and
 * U+0627 U+0644 U+0635 U+0628 U+0631 would mint two different URLs for one word, and each of
 * them would be a permanent address the moment it is published. This project's own fatwa
 * normaliser already drops the tatweel when matching text; a URL that has to survive being typed
 * back in has at least as much reason to.
 *
 * IT IS ONLY U+0640, AND NOT THE Lm CLASS. Other modifier letters -- a superscript, an IPA
 * modifier, a Japanese iteration mark -- carry meaning a writer chose, and \p{Lm} would take
 * them all. The one character with the argument for removal is the one named here.
 */
const DECORATION = /[\p{Mn}\u0640]+/gu;

/**
 * Title -> slug base. Letters and digits of ANY script are kept, combining marks and the tatweel
 * are dropped, and every run of anything else becomes one hyphen. Returns '' when the title held
 * nothing that survives -- which a title made entirely of tatweels now does -- and the caller
 * falls back to the id, so an article without a typeable title still gets a stable URL.
 */
export function slugify(title) {
  const s = String(title === null || title === undefined ? '' : title)
    .trim().toLowerCase().replace(DECORATION, '');
  const out = s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+/, '').replace(/-+$/, '');
  return out.slice(0, MAX_SLUG_CHARS).replace(/-+$/, '');
}

/* ===========================================================================
 * THE SANITISER -- DECISION D-12, AND IT IS A SECURITY BOUNDARY, NOT A STYLE RULE.
 * ===========================================================================
 * WHAT A BODY IS. A stored body is PLAIN TEXT in one small, closed, line-oriented notation:
 *
 *     a blank line                      separates one paragraph from the next
 *     '## ' at the head of a line       a sub-heading
 *     '### ' at the head of a line      a deeper sub-heading
 *     '- ' at the head of a line        an item in an unordered list
 *     '1. ' at the head of a line       an item in an ordered list (the reader numbers them)
 *     *text*                            emphasis
 *     **text**                          strong emphasis
 *
 * THAT IS THE WHOLE VOCABULARY. There is no eighth construction, and in particular THERE IS NO
 * MARKUP: a stored body contains no tag, no attribute and no '<' or '>' at all. Everything else a
 * writer -- or anything posing as one -- sends is either folded into one of those shapes or
 * removed, HERE, on the way in.
 *
 * WHY ON THE WAY IN, AND NOT ON THE WAY OUT. The route is not the boundary: it can be rewritten,
 * copied, or joined by a second one -- exactly what the draft filter's comment says of itself
 * further down this file. The client is not the boundary either: ANY client can POST to
 * api/articles-admin.js with a session, and the one this repository ships is merely the first. So
 * the rule lives where the writing is stored, applies to every write unconditionally, and there
 * is no flag, no option and no branch that skips it.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. An unsanitised body is a door through which anything can be
 * made to run inside every reader's application -- and this application's readers are children on
 * a device a parent handed them, with a live session, a founder token and a parental-code record
 * reachable from that same origin. A stored script would not be a defaced page; it would be an
 * attacker executing as the reader. That is why the stripping is total rather than clever: this
 * function does not try to keep a "safe subset of HTML", because a safe subset of HTML is a
 * parser, and a parser is a thing that can be wrong. It keeps NO HTML AT ALL.
 *
 * AND THE CLIENT MUST NOT UNDO IT. app.jsx renders a body by PARSING this notation into React
 * elements. There is no dangerouslySetInnerHTML anywhere on the articles path and there must
 * never be one: with one, this function would become the only thing between a stored string and
 * script execution, and a single mistake here would be total.
 *
 * WHAT IS STRIPPED, IN FULL:
 *   * script and style elements INCLUDING everything between their tags, terminated or not.
 *   * every other tag. A tag whose name is in the small block list below leaves a paragraph, a
 *     heading or a list item behind in the notation; every other tag leaves only its inner text.
 *   * every ATTRIBUTE, therefore every event handler (onclick, onerror, onload, ...) and every
 *     attribute-borne URL -- because attributes live inside tags and no tag survives.
 *   * every remaining '<' and '>' character. This is deliberate and it has a cost, stated here so
 *     that it is not discovered later: a writer cannot type a mathematical '<'. It is worth it,
 *     because what it buys is that no output of this function can be re-parsed as markup by
 *     anything downstream -- a mail template, an export, a future feed -- and not merely by the
 *     one renderer we happen to ship today.
 *   * the URI schemes javascript:, vbscript: and data:, wherever they appear as text, including
 *     when they are written with whitespace inside them.
 *   * links and images. A markdown [label](url) or ![alt](url) keeps its LABEL and loses its URL,
 *     so no scheme survives to need filtering. D-12 does not list links.
 *   * code fences, blockquote markers, horizontal rules, HTML comments, CDATA sections,
 *     processing instructions and doctypes -- none is in the allow list, so each is reduced to
 *     the text it contained, or to nothing when it contained none.
 *   * control characters other than newline and tab, and every zero-width and bidi-control
 *     character: an invisible right-to-left override can make a stored line read as its own
 *     reverse on screen, which is a way to lie in text with no markup in it at all.
 *   * runs of more than one blank line, and trailing whitespace on every line.
 * ------------------------------------------------------------------------ */

/** script/style and their contents, terminated or not. Applied before anything else. */
const KILL_ELEMENTS = /<\s*(script|style)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|$)/gi;
/**
 * A tag that ends a BLOCK: what follows it starts a new PARAGRAPH, so it becomes a blank line.
 * `li` is deliberately NOT in this list even though it is a block element: LI_OPEN below already
 * starts a new line for each item, and closing one here as well put a blank line between every
 * pair of items -- which the renderer then reads as a run of one-item lists instead of one list.
 */
const BLOCK_END = /<\s*\/\s*(?:p|div|section|article|h[1-6]|ul|ol|blockquote|pre|tr|table)\s*>/gi;
/** A line break. */
const BREAK_TAG = /<\s*br\s*\/?\s*>/gi;
/** A heading open tag -> the notation's heading marker. h1/h2 are '## ', h3 and deeper '### '. */
const HEADING_OPEN = /<\s*h([1-6])\b[^>]*>/gi;
/** A list item open tag -> the notation's list marker. */
const LI_OPEN = /<\s*li\b[^>]*>/gi;
/** Strong and emphasis, both directions, opening and closing alike. */
const STRONG_TAG = /<\s*\/?\s*(?:strong|b)\b[^>]*>/gi;
const EM_TAG = /<\s*\/?\s*(?:em|i)\b[^>]*>/gi;
/** Everything else that looks like a tag, and anything tag-shaped left dangling at the end. */
const ANY_TAG = /<[^>]*>/g;
const TRAILING_TAG = /<[^>]*$/;
/** The schemes that execute. Whitespace inside them is how they are smuggled past a plain test. */
const EXEC_SCHEME = /(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a)\s*:/gi;
/** A markdown link or image -> its label alone. */
const MD_LINK = /!?\[([^\]\n]*)\]\([^)\n]*\)/g;
/** Control characters that are not newline or tab, plus the zero-width and bidi controls. */
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** The line shapes, recognised after the markup is gone. */
const LINE_HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const LINE_BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const LINE_NUMBER = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/;
const LINE_RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LINE_FENCE = /^\s{0,3}(?:`{3,}|~{3,}).*$/;
const LINE_QUOTE = /^\s{0,3}>+\s?/;

/**
 * THE CANONICAL MARKERS. app.jsx's renderer recognises exactly these four and nothing else, so
 * they are exported rather than repeated there: a marker that existed in two files could be
 * changed in one of them, and the reader would then be shown a heading's own '## ' as text.
 */
export const BODY_HEADING = '## ';
export const BODY_SUBHEADING = '### ';
export const BODY_BULLET = '- ';
export const BODY_NUMBER = '1. ';

/**
 * Any string a client sent -> the closed notation above. Never throws, never returns null, and
 * can only shrink its input. A body that held nothing but markup comes back as ''.
 */
export function sanitizeBody(raw) {
  let t = String(raw === null || raw === undefined ? '' : raw);
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 1. The two elements whose CONTENT is as dangerous as their tags.
  t = t.replace(KILL_ELEMENTS, '');
  // 2. The tags that mean something in the notation, folded into it before the rest are dropped.
  t = t.replace(BREAK_TAG, '\n');
  t = t.replace(BLOCK_END, '\n\n');
  t = t.replace(HEADING_OPEN, (m, level) => '\n' + (Number(level) <= 2 ? BODY_HEADING : BODY_SUBHEADING));
  t = t.replace(LI_OPEN, '\n' + BODY_BULLET);
  t = t.replace(STRONG_TAG, '**');
  t = t.replace(EM_TAG, '*');
  // 3. EVERY other tag, then anything tag-shaped left dangling at the end, then every remaining
  //    angle bracket. After this line the string cannot be re-parsed as markup by anything.
  t = t.replace(ANY_TAG, '').replace(TRAILING_TAG, '').replace(/[<>]/g, '');
  // 4. Links keep their words and lose their addresses; then the schemes that execute, in case one
  //    was written as bare text rather than inside a link.
  t = t.replace(MD_LINK, '$1').replace(EXEC_SCHEME, '');
  // 5. Characters that are invisible, that reorder what is around them, or that no text needs.
  t = t.replace(CONTROLS, '');

  const out = [];
  for (let line of t.split('\n')) {
    line = line.replace(/\s+$/, '');
    if (LINE_FENCE.test(line)) continue;                    // a fence is not content
    if (LINE_RULE.test(line)) { out.push(''); continue; }    // a rule becomes a paragraph break
    line = line.replace(LINE_QUOTE, '');                     // a quotation keeps its words
    const heading = LINE_HEADING.exec(line);
    if (heading) {
      const text = heading[2].trim();
      if (text) out.push((heading[1].length <= 2 ? BODY_HEADING : BODY_SUBHEADING) + text);
      continue;
    }
    const bullet = LINE_BULLET.exec(line);
    if (bullet) { const x = bullet[1].trim(); if (x) out.push(BODY_BULLET + x); continue; }
    const numbered = LINE_NUMBER.exec(line);
    if (numbered) { const x = numbered[1].trim(); if (x) out.push(BODY_NUMBER + x); continue; }
    out.push(line.replace(/^\s+/, ''));
  }
  // One blank line between blocks, never two; and nothing hanging off either end.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

/**
 * A title is ONE LINE of plain text. The same stripping, and no notation at all: a heading marker
 * or a list marker inside a title would be read as literal text by the renderer anyway, so they
 * are collapsed here rather than stored to be ignored later.
 */
export function sanitizeTitle(raw) {
  let t = String(raw === null || raw === undefined ? '' : raw);
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(KILL_ELEMENTS, '');
  t = t.replace(ANY_TAG, '').replace(TRAILING_TAG, '').replace(/[<>]/g, '');
  t = t.replace(MD_LINK, '$1').replace(EXEC_SCHEME, '');
  t = t.replace(CONTROLS, '');
  return t.replace(/\s+/g, ' ').trim();
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
 * THE ID FALLBACK, MADE CLAIMABLE.
 *
 * newArticleId() is base64url, whose alphabet ends in '-' and '_', so about one id in thirty-two
 * BEGINS with one of them -- measured, 6333 of 200000 -- and safeSlug() takes neither as a first
 * character. Until 2026-09-07 such an id was refused as a slug root, all fifty attempts below
 * inherited the refusal, and createArticle() answered `articles-slug-unavailable` for a title
 * its writer could not have typed any differently. The reason for the refusal was the shape of
 * an id THIS FILE minted, which is never a reason to turn someone's writing away.
 *
 * So an id safeSlug() will not take as a root is prefixed with ONE ASCII LETTER. 'a' is a letter,
 * so the first-character class is satisfied; it is ASCII, so the URL stays typeable on any
 * keyboard; and it makes the slug SEVENTEEN characters where every bare id is sixteen, so a
 * prefixed fallback can never be confused with, or collide with, an unprefixed one. The other
 * ~96.8% of ids are handed back untouched, so no slug that is mintable today is minted
 * differently tomorrow -- an article's URL does not depend on which day it was written.
 */
const SLUG_FALLBACK_PREFIX = 'a';
function fallbackSlug(id) { return safeSlug(id) ? id : SLUG_FALLBACK_PREFIX + id; }

/**
 * Claims the first free slug from `base`, `base-2`, `base-3`, ... NX at every attempt.
 * Returns the claimed slug or null (all taken, or a store that would not answer).
 *
 * THE ROOT IS ALREADY VALID WHEN THE LOOP STARTS, and that is what makes the loop worth running.
 * Every candidate keeps the root's FIRST character -- '-2' is appended, nothing is prepended --
 * so a root whose first character safeSlug() refuses is a root all fifty attempts refuse, and
 * the loop spends itself on a verdict it already had. Both roots that can reach it are therefore
 * valid before it: a slugified title safeSlug() accepted, or fallbackSlug()'s id.
 */
async function claimSlug(base, id) {
  const root = safeSlug(base) ? base : fallbackSlug(id);
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
  // SANITISED FIRST, MEASURED SECOND, AND IN THAT ORDER FOR A REASON. What the bounds must be
  // measured against is what will be STORED, not what arrived: a title of two hundred characters
  // of markup is not a two-hundred-character title, and a body checked before stripping would
  // refuse writing that, once stripped, fits comfortably.
  const title = sanitizeTitle(src.title);
  if (title.length === 0 || title.length > MAX_TITLE_CHARS) return { ok: false, code: 'articles-title' };
  const body = sanitizeBody(src.body);
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
    // D-11. safeKind() cannot refuse: a client that sends a word this version does not know gets
    // the plain shape, not a rejected article. Losing a writer's work over a vocabulary mismatch
    // would be a worse answer than showing her writing under the wrong heading, which she can fix.
    kind: safeKind(src.kind),
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

// ---------------------------------------------------------------------------
// WHOSE PIECE THIS IS. ONE PREDICATE, THREE MUTATORS, AND THE HINGE IS `status`.
//
// A DRAFT IS UNFINISHED PRIVATE WRITING AND IT BELONGS TO WHOEVER IS WRITING IT. Nobody else
// reads it -- `mine` at api/articles-admin.js already answers with the acting account's own work
// and nobody else's -- and from here nobody else edits it, publishes it or deletes it either.
// NOT EVEN AN OWNER. Until this line existed the four id-bearing actions authorised on SECTION
// alone, so an owner could delete another writer's draft by id while `mine` refused to tell him
// it existed: the power to destroy a thing without the power to see it, which is coherent and is
// not a rule anybody chose.
//
// A PUBLISHED PIECE IS PUBLIC UNDER THE APP'S NAME, and the owner is answerable for it. So the
// section grant is the whole test there, exactly as it was: he may correct it, withdraw it or
// delete it, whoever wrote it.
//
// THE CHECK IS HERE AND NOT ON THE ROUTE for the reason the draft filter in listSection() is
// here: a route can be rewritten, copied, or joined by a second one, and the first time a rule
// is forgotten at a call site is the time it matters. The two halves sit where each can be
// known -- the ROUTE checks the section, because that needs a grant this module knows nothing
// about, and the STORE checks the author, because that needs only the record it just read.
//
// AND THE REFUSAL IS `articles-not-found`, WHICH IS THE 404 A STRANGER ALREADY GETS. A distinct
// "that is not your draft" would tell a section-holder that a draft exists and that somebody
// has one. The rule this page already keeps -- absent and forbidden are ONE answer -- is not
// weakened by a second way of being forbidden; it is extended to it.
//
// FAIL CLOSED ON THE STATUS. Only the exact word `published` opens the section-only path. A
// record with a missing status, a malformed one, or one a later version writes and this build
// does not know is treated as private writing, because the safe reading of "I cannot tell
// whether this is public" is that it is not.
// ---------------------------------------------------------------------------
export function actorMayWrite(record, actorKey) {
  const actor = safeAccountKey(actorKey);
  if (!actor) return false;
  if (!record || typeof record !== 'object') return false;
  if (record.status === STATUS_PUBLISHED) return true;
  return record.authorKey === actor;
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
// `kind` IS UPDATABLE, AND IT IS THE ONLY FIELD ADDED TO THIS LIST. A writer who chose the wrong
// shape would otherwise have to delete the piece and write it again -- which costs her the slug,
// and therefore the published URL, for what is a one-word mistake. It moves no index entry, it
// changes no key, and it changes nothing about who may see the record: the three reasons the four
// fields above are excluded do not apply to it.
export const UPDATABLE_FIELDS = Object.freeze(['title', 'body', 'kind']);

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
  // A DRAFT IS ITS AUTHOR'S, AND THE ANSWER IS THE SAME ONE AN ABSENT ARTICLE GETS.
  if (!actorMayWrite(existing, actor)) return { ok: false, code: 'articles-not-found' };

  const record = onlyKnownFields(existing);
  // A RECORD WRITTEN BEFORE `kind` EXISTED HAS NONE. It is filled in here, from safeKind(), so
  // that every record this function writes carries the full roster -- and it is filled in with
  // the default, never with a guess about what the writing looks like.
  record.kind = safeKind(record.kind);
  if (Object.prototype.hasOwnProperty.call(src, 'title')) {
    // THE SAME SANITISER AS THE CREATE PATH, AND NOT A SECOND COPY OF ITS RULES. An edit is a
    // write, so a body that could not have been created cannot be arrived at by editing either.
    const title = sanitizeTitle(src.title);
    if (title.length === 0 || title.length > MAX_TITLE_CHARS) return { ok: false, code: 'articles-title' };
    record.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(src, 'body')) {
    if (typeof src.body !== 'string') return { ok: false, code: 'articles-body' };
    const body = sanitizeBody(src.body);
    if (body.length > MAX_BODY_CHARS) return { ok: false, code: 'articles-body' };
    record.body = body;
  }
  if (Object.prototype.hasOwnProperty.call(src, 'kind')) record.kind = safeKind(src.kind);
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
  // THE HINGE IS CROSSED HERE, AND IT IS READ OFF THE RECORD AS IT STANDS -- never off the status
  // being written. PUBLISH therefore acts on a DRAFT and is author-only: an owner cannot put
  // somebody else's unfinished writing into the world under the app's name. UNPUBLISH acts on a
  // PUBLISHED piece and is section-only: whoever answers for what stands publicly can withdraw it.
  if (!actorMayWrite(existing, actor)) return { ok: false, code: 'articles-not-found' };

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
  // AND THE SAME ANSWER FOR A DRAFT THAT IS NOT THIS ACTOR'S. This is the erasure the incoherence
  // made possible -- destroying writing its holder was never allowed to read.
  if (!actorMayWrite(record, actor)) return { ok: false, code: 'articles-not-found' };

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
