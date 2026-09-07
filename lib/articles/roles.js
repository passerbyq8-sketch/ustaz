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
// THE TWO SOURCES OF A GRANT, AND THEY ARE NOT EQUAL:
//
//   THE ROOT GRANT is the environment row EZIK_OWNER_ACCOUNTS. Its value is a comma-separated
//   list of sha256 hashes of lower-cased, trimmed email addresses -- NEVER the addresses. The
//   hash is emailDigest() from lib/auth/account.js, THE SAME FUNCTION the verified-email index
//   `acctidx:v1:email:` is already keyed by; it is imported rather than re-typed, so the board
//   row and the store index can never come to mean two different things. The consequence is that
//   the row is a list of opaque hex strings which is safe if anyone ever reads it, and the owner
//   can authorise a new person by computing a hash without telling anyone the address.
//
//   GRANTED ROLES live at role:v1:<accountKey> and hold { role, sections, grantedBy, grantedAt }.
//   Only an owner may write one, and the only role that may be written is `editor`.
//
// THE ROW DOES NOT EXIST YET AND THIS CODE DOES NOT CREATE IT. Absent means the digest set is
// empty, which means ZERO OWNERS, which means nobody can grant anything and the panel refuses
// everyone. That is the intended behaviour of an unconfigured deployment and not a bug to be
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

/** The four keys a grant record may have, in order. */
export const GRANT_FIELDS = Object.freeze(['role', 'sections', 'grantedBy', 'grantedAt']);

/**
 * The root digests, read at CALL TIME rather than at module load, so a deployment that gains the
 * row does not need a rebuild to notice it -- and so this module can be measured with the row
 * present and absent in one process.
 *
 * ONLY A WELL-FORMED SHA-256 HEX STRING COUNTS. Sixty-four lower-case hex characters, nothing
 * else. Anything that is not that is DROPPED SILENTLY AND ON PURPOSE: reporting it would mean
 * printing part of a row that may hold something the owner typed by mistake, and the honest
 * failure mode of a bad row is "this person is not an owner", which is what dropping produces.
 */
export function ownerDigests(env) {
  const source = (env && typeof env === 'object') ? env : process.env;
  const raw = typeof source[OWNER_ACCOUNTS_ENV] === 'string' ? source[OWNER_ACCOUNTS_ENV] : '';
  const out = new Set();
  for (const part of raw.split(',')) {
    const token = part.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(token)) out.add(token);
  }
  return out;
}

/** True only for an account whose PROVED address hashes into the environment row. */
export async function isRootOwner(accountKeyString) {
  const key = safeAccountKey(accountKeyString);
  if (!key) return false;
  const digests = ownerDigests();
  // Zero configured owners. The account record is not even read: there is nothing to match.
  if (digests.size === 0) return false;
  const record = await readAuthJson(key);
  // Absent, malformed, or a store that would not answer -- one answer for all three: not an owner.
  if (!record || typeof record !== 'object') return false;
  if (record.emailVerified !== true) return false;
  const email = typeof record.email === 'string' ? record.email : '';
  if (email.trim().length === 0) return false;
  return digests.has(emailDigest(email));
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

  if (!(await deleteKey(roleKey(key)))) return { ok: false, code: 'roles-unwritable' };
  return { ok: true, accountKey: key, removed: true };
}
