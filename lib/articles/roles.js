// lib/articles/roles.js
// WHO MAY WRITE. One door, one answer, and it closes on every uncertainty.
//
// THE MEASUREMENT THIS MODULE ANSWERS. Before it, NO privilege concept keyed to a person existed
// anywhere in the tree -- every `role` in the repository was an ARIA attribute -- and signing in
// bought exactly one capability: deleting your own account. So there was no seam to extend and
// nothing to be consistent with; this file is the first statement in the codebase that one
// account may do something another may not, and it is written to be auditable in one reading.
//
// THE THREE ROLES, AND THEY ARE FROZEN:
//
//   owner    everything, including granting and revoking. EXISTS ONLY BY WAY OF THE ENVIRONMENT
//            ROW. Nothing written into the store can ever produce it -- see grantRole().
//   editor   create, edit, publish, unpublish and delete articles -- their own and other
//            people's -- in the sections they are granted, and nothing outside those sections.
//   none     the default for every account that has no grant. Which is every account today.
//
// THE THREE SOURCES OF A GRANT, AND THEY ARE NOT EQUAL:
//
//   THE ROOT GRANT is the environment row EZIK_OWNER_ACCOUNTS. Its value is a comma-separated
//   list of sha256 hashes of lower-cased, trimmed email addresses -- NEVER the addresses. The
//   hash is emailDigest() from lib/auth/account.js, THE SAME FUNCTION the verified-email index
//   `acctidx:v1:email:` is already keyed by; it is imported rather than re-typed, so the board
//   row and the store index can never come to mean two different things. The consequence is that
//   the row is a list of opaque hex strings which is safe if anyone ever reads it, and the owner
//   can authorise a new person by computing a hash without telling anyone the address.
//
//   THE EDITOR ROSTER is the environment row EZIK_EDITOR_ACCOUNTS, added on 2026-09-07, and it
//   is deliberately THE SAME MECHANISM ONE RUNG DOWN: the same shape, the same parser, the same
//   emailDigest(). IT EXISTS BECAUSE THE STORE GRANT BELOW IT COULD NOT BE REACHED. A store
//   grant is written against an account key, `acct:v1:<provider>:<sub>`, and NOTHING IN THIS
//   SYSTEM EVER SHOWS THAT STRING TO A HUMAN -- not to the owner, and not to the person whose
//   key it is. So the owner could not authorise anybody to write beside him: he could not learn
//   their key, and neither could they. A row of digests he can compute from an address he
//   already knows is the rung that was missing, and it asks nothing of them but that they sign
//   in with the address that was hashed.
//
//   GRANTED ROLES live at role:v1:<accountKey> and hold { role, sections, grantedBy, grantedAt }.
//   Only an owner may write one, and the only role that may be written is `editor`.
//
// THE PRECEDENCE, AND IT IS EXACTLY THIS: owner row, then editor row, then store grant, then
// `none`. OWNER WINS OVER EDITOR, so a digest that appears in both rows is an owner and loses
// nothing by also sitting below. AND THE ENVIRONMENT WINS OVER THE STORE, because the board is
// the owner's OWN HAND: a store row is written through api/roles-admin.js by whoever holds an
// owner session at the time, and if it could override the board then the answer to "who may
// write here" would stop being something the owner can read off his own console. The root of a
// privilege tree has to sit somewhere no branch of that tree can reach.
//
// AND A RESOLVED ROLE IS NEVER CACHED, NEVER MEMOISED AND NEVER WRITTEN BACK INTO THE STORE.
// Both rows are re-read on EVERY request -- see rowDigests(), which reads at call time -- and the
// store grant is re-read with them. THAT IS THE WHOLE POINT: removing a digest and redeploying
// must end the access, and A PRIVILEGE THAT OUTLIVES ITS GRANT IS THE FAILURE THIS FILE EXISTS
// TO PREVENT. If a cache is ever added here its lifetime must be ONE REQUEST; there is none
// today, and the honest way to keep that true is to add none.
//
// NEITHER ROW EXISTS YET AND THIS CODE CREATES NEITHER. Absent means the digest set is empty,
// which means ZERO OWNERS AND ZERO EDITORS, which means nobody can grant anything, nobody can
// write anything, and the panel refuses everyone. That is the intended behaviour of an unconfigured deployment and not a bug to be
// worked around: FAIL CLOSED. A malformed row -- whitespace, a truncated hash, an address typed
// in by mistake -- contributes no digests for the same reason, so a fat-fingered row grants
// nothing rather than granting something unintended.
//
// AND AN UNVERIFIED ADDRESS BUYS NOTHING. The root check requires `emailVerified === true` on the
// account record. lib/auth/account.js only writes the cross-provider email index on a PROVED
// address, for the takeover reason recorded there; the owner grant is a far larger prize than
// that index and is held to at least the same rule. A provider asserting an address it did not
// verify therefore cannot mint an owner.

import {
  emailDigest,
  touchSession,
} from '../auth/account.js';
import { readJson as readAuthJson } from '../auth/store.js';
import {
  SECTIONS,
  roleKey,
  readJson,
  writeJson,
  deleteKey,
  safeAccountKey,
} from './store.js';

export const ROLE_OWNER = 'owner';
export const ROLE_EDITOR = 'editor';
export const ROLE_NONE = 'none';
export const ROLES = Object.freeze([ROLE_OWNER, ROLE_EDITOR, ROLE_NONE]);

/** The only role a stored grant may carry. `owner` is not writable -- see grantRole(). */
export const GRANTABLE_ROLES = Object.freeze([ROLE_EDITOR]);

export const OWNER_ACCOUNTS_ENV = 'EZIK_OWNER_ACCOUNTS';

/** The second rung. Absent means ZERO editors; it is not created here. See the head of the file. */
export const EDITOR_ACCOUNTS_ENV = 'EZIK_EDITOR_ACCOUNTS';

/** The four keys a grant record may have, in order. */
export const GRANT_FIELDS = Object.freeze(['role', 'sections', 'grantedBy', 'grantedAt']);

/**
 * The digests in ONE board row, read at CALL TIME rather than at module load, so a deployment
 * that gains or LOSES a row does not need a rebuild to notice it -- and so this module can be
 * measured with a row present and with it absent inside a single process.
 *
 * ONE PARSER FOR BOTH ROWS, AND THAT IS DELIBERATE. The owner row and the editor row hold the
 * same kind of value, so they are read by the same seven lines and a rule that holds for one
 * cannot quietly stop holding for the other. A second parser that trimmed differently, or
 * case-folded differently, or accepted a length this one refuses, would make a grant the owner
 * believed he had made fail silently -- with nothing on any screen anywhere to say why.
 *
 * ONLY A WELL-FORMED SHA-256 HEX STRING COUNTS. Sixty-four hex characters, nothing else. Anything
 * that is not that is DROPPED SILENTLY AND ON PURPOSE: reporting it would mean printing part of a
 * row that may hold something the owner typed by mistake, and the honest failure mode of a bad
 * row is "this person holds nothing", which is exactly what dropping produces. A stray space, an
 * empty element between two commas, a truncated hash and an address typed in by accident are all
 * the same non-event.
 *
 * The token is lower-cased BEFORE it is tested, so a digest pasted in upper case is the same
 * digest rather than a silent non-grant. That normalises one person's own value; it widens
 * nothing, because emailDigest() emits lower case and no other string becomes valid by folding.
 *
 * AN EMPTY SET IS ZERO PEOPLE, NEVER EVERYBODY -- and isRootOwner() and isRootEditor() each say
 * so again, in their own words, on their own row.
 */
function rowDigests(env, name) {
  const source = (env && typeof env === 'object') ? env : process.env;
  const raw = typeof source[name] === 'string' ? source[name] : '';
  const out = new Set();
  for (const part of raw.split(',')) {
    const token = part.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(token)) out.add(token);
  }
  return out;
}

/** The digests that hold `owner`. An absent row is an empty set, and that is ZERO OWNERS. */
export function ownerDigests(env) { return rowDigests(env, OWNER_ACCOUNTS_ENV); }

/** The digests that hold `editor`. An absent row is an empty set, and that is ZERO EDITORS. */
export function editorDigests(env) { return rowDigests(env, EDITOR_ACCOUNTS_ENV); }

/**
 * The digest of an account's PROVED address, or null. ONE COPY OF THE VERIFIED RULE, SHARED BY
 * BOTH ROWS.
 *
 * AN UNVERIFIED ADDRESS IS A CLAIM, AND A CLAIM MUST NEVER BUY A PRIVILEGE. lib/auth/account.js
 * writes the cross-provider email index only on a PROVED address, for the takeover reason
 * recorded there; a role is a far larger prize than that index and is held to at least the same
 * rule. A provider asserting an address it did not verify therefore mints neither an owner nor
 * an editor.
 *
 * It is written ONCE rather than once per row, because a rule this size must not depend on
 * whoever adds the next row remembering to copy it. The two resolvers below differ in exactly
 * one thing -- which set they look in -- and share everything that decides what may be looked up
 * at all.
 *
 * Null for an absent record, a malformed one, a store that would not answer, an unproved address
 * and an empty one alike: five situations, one answer, and the answer is that there is no digest
 * here to match against anything.
 */
async function provedDigest(key) {
  const record = await readAuthJson(key);
  if (!record || typeof record !== 'object') return null;
  if (record.emailVerified !== true) return null;
  const email = typeof record.email === 'string' ? record.email : '';
  if (email.trim().length === 0) return null;
  return emailDigest(email);
}

/** True only for an account whose PROVED address hashes into the environment row. */
export async function isRootOwner(accountKeyString) {
  const key = safeAccountKey(accountKeyString);
  if (!key) return false;
  const digests = ownerDigests();
  // Zero configured owners. The account record is not even read: there is nothing to match.
  if (digests.size === 0) return false;
  const digest = await provedDigest(key);
  if (!digest) return false;
  return digests.has(digest);
}

/**
 * True only for an account whose PROVED address hashes into EZIK_EDITOR_ACCOUNTS.
 *
 * The same shape as isRootOwner(), and the ONLY difference is the set it consults -- which is the
 * whole design: an editor is let in by the same act, on the same evidence, through the same door,
 * one rung lower. WHAT an editor may then do is decided by actorMaySection() and by the routes,
 * never here; this function answers one question and answers it the same way for everybody.
 */
export async function isRootEditor(accountKeyString) {
  const key = safeAccountKey(accountKeyString);
  if (!key) return false;
  const editors = editorDigests();
  // Zero configured editors -- the ordinary state of a deployment whose owner has not added the
  // row, and the state of THIS one until he does. The account record is not even read.
  if (editors.size === 0) return false;
  const digest = await provedDigest(key);
  if (!digest) return false;
  return editors.has(digest);
}

/** The stored grant for an account, trimmed and validated, or null. */
export async function grantedRole(accountKeyString) {
  const key = safeAccountKey(accountKeyString);
  if (!key) return null;
  const record = await readJson(roleKey(key));
  if (!record || typeof record !== 'object') return null;
  if (!GRANTABLE_ROLES.includes(record.role)) return null;
  const sections = Array.isArray(record.sections)
    ? record.sections.filter((s) => SECTIONS.includes(s)) : [];
  // A grant naming no section this build knows about is no grant at all.
  if (sections.length === 0) return null;
  return {
    role: record.role,
    sections,
    grantedBy: typeof record.grantedBy === 'string' ? record.grantedBy : '',
    grantedAt: typeof record.grantedAt === 'string' ? record.grantedAt : '',
  };
}

/**
 * The role an account holds, from both sources, root first. ALWAYS returns an object -- `none`
 * with no sections is the answer for an account that has nothing, which is every account until
 * the owner adds the board row and grants somebody.
 */
export async function roleFor(accountKeyString) {
  const key = safeAccountKey(accountKeyString);
  if (!key) return { role: ROLE_NONE, sections: [] };
  if (await isRootOwner(key)) return { role: ROLE_OWNER, sections: SECTIONS.slice() };
  // THE SECOND RUNG, AND IT IS READ BEFORE THE STORE. See the head of this file: the board is the
  // owner's own hand, and a store row -- writable by anyone holding an owner session -- must not
  // be able to contradict it. A row editor holds BOTH sections, because the decision that put a
  // person on that row was a decision about the person and not about a shelf.
  if (await isRootEditor(key)) return { role: ROLE_EDITOR, sections: SECTIONS.slice() };
  const grant = await grantedRole(key);
  if (grant) return { role: grant.role, sections: grant.sections };
  return { role: ROLE_NONE, sections: [] };
}

/**
 * THE SINGLE ENTRY POINT. Every writing route calls this and nothing else, so there is ONE place
 * to audit and one place a mistake can be made.
 *
 * It reads the session the way api/auth-delete.js does -- `body.session`, an opaque store key,
 * handed to touchSession() rather than to a second copy of the "what is a live session" rule --
 * and then layers the role on top.
 *
 * NOTHING IN THE BODY NAMES AN ACCOUNT. No provider, no subject, no address and no accountKey are
 * read here, on the same reasoning api/auth-delete.js records: a route that accepted one would be
 * a door for acting AS somebody else, operated by whoever could guess a subject.
 *
 * NOTHING IS REMEMBERED BETWEEN TWO CALLS OF THIS FUNCTION. The session, the account record, both
 * board rows and the store grant are read again every time, and the resolved role is thrown away
 * with the request that asked for it. That is what makes a revocation -- a digest taken off a
 * row, or a store grant deleted -- take effect on the VERY NEXT REQUEST rather than whenever
 * something happens to expire. The resolution ORDER itself lives in roleFor(), in one place, so
 * this door and every other caller answer the same question the same way.
 *
 * FAIL CLOSED, EVERYWHERE. No session, an expired session, no account, no grant, a grant with no
 * usable section, a malformed account key, or a store that throws -- all of them return null. The
 * `none` role is never returned from here, because an actor object is a permission and `none` is
 * the absence of one. There is no branch on which this function can produce `editor` by default.
 *
 * Returns { accountKey, role, sections } or null.
 */
export async function resolveActor(request) {
  try {
    const body = (request && request.body && typeof request.body === 'object') ? request.body : {};
    const session = typeof body.session === 'string' ? body.session : '';
    if (session.length === 0) return null;

    const record = await touchSession(session);
    if (!record || typeof record.accountKey !== 'string') return null;
    const key = safeAccountKey(record.accountKey);
    if (!key) return null;

    const resolved = await roleFor(key);
    if (resolved.role === ROLE_NONE) return null;
    if (!Array.isArray(resolved.sections) || resolved.sections.length === 0) return null;
    return { accountKey: key, role: resolved.role, sections: resolved.sections };
  } catch (e) {
    // A throw anywhere above -- a store fault, a malformed record -- is no access. Never access.
    return null;
  }
}

/** True when this actor may write in this section. An owner holds every section. */
export function actorMaySection(actor, section) {
  if (!actor || typeof actor !== 'object') return false;
  if (!SECTIONS.includes(section)) return false;
  if (actor.role === ROLE_OWNER) return true;
  if (actor.role !== ROLE_EDITOR) return false;
  return Array.isArray(actor.sections) && actor.sections.includes(section);
}

/**
 * GRANT. Only an owner may call it, and the ONLY role it can write is `editor`.
 *
 * WHY `owner` IS NOT GRANTABLE. If an owner could write another owner into the store, then the
 * environment row would stop being the root of the privilege tree: one compromised owner session
 * could mint a second owner that survives the row being emptied, and the owner's own board would
 * no longer be the answer to "who can write here". Keeping the root in the environment means
 * REMOVING A DIGEST FROM THE ROW IS ABSOLUTE -- no store key can contradict it.
 *
 * THE TARGET MUST ALREADY HAVE AN ACCOUNT. A grant written against a key nobody holds is a row
 * that looks like a permission and is not one, and a mistyped key would sit there indefinitely
 * looking correct. Requiring the account to exist makes a typo an immediate, named refusal.
 */
export async function grantRole(targetAccountKey, sections, actor) {
  if (!actor || actor.role !== ROLE_OWNER) return { ok: false, code: 'roles-forbidden' };

  const key = safeAccountKey(targetAccountKey);
  if (!key) return { ok: false, code: 'roles-target' };

  const wanted = Array.isArray(sections) ? [...new Set(sections)] : [];
  if (wanted.length === 0 || wanted.some((s) => !SECTIONS.includes(s))) {
    return { ok: false, code: 'roles-sections' };
  }

  const account = await readAuthJson(key);
  if (!account || typeof account !== 'object') return { ok: false, code: 'roles-no-such-account' };

  // Named one at a time, so a caller sending an extra field gets none of it stored.
  const record = {
    role: ROLE_EDITOR,
    sections: wanted,
    grantedBy: actor.accountKey,
    grantedAt: new Date().toISOString(),
  };
  if (!(await writeJson(roleKey(key), record))) return { ok: false, code: 'roles-unwritable' };

  const fresh = await grantedRole(key);
  if (!fresh) return { ok: false, code: 'roles-unreadable' };
  return { ok: true, accountKey: key, record: fresh };
}

/**
 * REVOKE, and it takes effect on the very next request: resolveActor() reads the store every
 * time and holds nothing between calls, so there is no cached permission to expire.
 *
 * AN OWNER MAY NOT REVOKE A ROOT GRANT -- their own or anyone's -- BECAUSE IT DOES NOT LIVE IN
 * THE STORE. There is no key here to delete; the grant is a digest in the environment row, and
 * the only place it can be withdrawn is the board. Deleting role:v1:<key> for a root owner would
 * report a success that changed nothing, which is the kind of lie that gets discovered during an
 * incident. So it is refused by name instead.
 */
export async function revokeRole(targetAccountKey, actor) {
  if (!actor || actor.role !== ROLE_OWNER) return { ok: false, code: 'roles-forbidden' };

  const key = safeAccountKey(targetAccountKey);
  if (!key) return { ok: false, code: 'roles-target' };

  if (await isRootOwner(key)) return { ok: false, code: 'roles-root-grant' };

  // AND THE SAME HOLDS FOR A ROW EDITOR, for the same reason and with the same refusal. Deleting
  // role:v1:<key> for somebody whose access comes from EZIK_EDITOR_ACCOUNTS would remove a record
  // and report a success while the person kept every right they had -- the "revoked" editor would
  // still be writing. That is the lie this refusal exists to prevent, and it does not become a
  // smaller lie one rung down. A row grant is withdrawn on the board or it is not withdrawn.
  if (await isRootEditor(key)) return { ok: false, code: 'roles-root-grant' };

  if (!(await deleteKey(roleKey(key)))) return { ok: false, code: 'roles-unwritable' };
  return { ok: true, accountKey: key, removed: true };
}
