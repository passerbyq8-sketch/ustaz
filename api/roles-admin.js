// api/roles-admin.js
// POST /api/roles-admin   { session, action, accountKey, sections }   ->   { ok, ... }
//
// GRANTING AND REVOKING THE RIGHT TO WRITE. Two actions, and only an owner reaches either.
//
// 🔴 OWNER, NOT MERELY AN ACTOR. resolveActor() returning an object is not enough on this page:
// an editor is a valid actor everywhere else and must not be one here. The role is compared to
// `owner` explicitly.
//
// 🔴 AND AN EDITOR IS REFUSED WITH THE STRANGER'S OWN REFUSAL -- THE SAME STATUS AND THE SAME
// BODY, BYTE FOR BYTE. DECISION D-5, TAKEN BY THE OWNER ON 2026-09-07: an editor writes, edits
// and publishes, and NEVER SEES THE ROLES SURFACE AT ALL.
//
// This page used to answer an editor with 403 and a stranger with 401, on the reasoning that an
// editor is known and telling them they are not permitted leaks nothing they do not already
// know. THAT REASONING WAS WRONG, and it is worth writing down why rather than quietly deleting
// it. A distinct status is not a courtesy, it is an ANSWER: 401 here and 403 there tells whoever
// asks that this address is a privilege surface, that there are ranks above the one they hold,
// and -- because the two replies differ -- lets them use their own session as an oracle for
// which rank they are. An editor who never learns that a roles door exists cannot be socially
// engineered into using it, cannot be phished at it, and cannot have their session spent at it.
// The person this was written for is a family member who was given the right to write, not a
// deputy administrator, and the smallest privilege surface she can be shown is none.
//
// THE TWO REFUSALS ARE ONE STATEMENT IN THE CODE below, not two that happen to match today. Two
// separate returns holding the same literals would be one careless edit away from drifting
// apart, and the drift would be invisible to everyone except the person probing for it.
//
// 🔴 AN OWNER MAY NOT REVOKE A ROOT GRANT, THEIR OWN OR ANYONE'S, BECAUSE IT DOES NOT LIVE IN THE
// STORE. It is a digest in the EZIK_OWNER_ACCOUNTS row and the only place it can be withdrawn is
// the board. lib/articles/roles.js refuses it by name rather than deleting a store key that was
// never there and reporting a success that changed nothing.
//
// 🔴 AND NO ROUTE CAN MINT AN OWNER. grantRole() writes `editor` and only `editor`; `owner` is
// not in GRANTABLE_ROLES and is not accepted from the body -- the body is not even read for a
// role. So emptying the environment row is absolute: no store key can contradict it.
//
// 🔴 THE ROW IS NEVER READ BACK OUT OF HERE. No response on this page carries a digest, the row's
// contents, or its length. A caller learns whether THEY are an owner by whether their request
// succeeded, and learns nothing about anybody else.
//
// ZERO NEW STORE VARIABLES on this page, and the two environment variables it depends on --
// EZIK_OWNER_ACCOUNTS and EZIK_EDITOR_ACCOUNTS -- are read inside lib/articles/roles.js and
// NEITHER is created by this code. Absent means zero owners and zero editors, which means this
// route refuses everyone. That is the intended behaviour of an unconfigured deployment.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { DEVICE_HEADER } from '../lib/daycap.js';
import { resolveActor, grantRole, revokeRole, ROLE_OWNER } from '../lib/articles/roles.js';

export const ROLE_ACTIONS = Object.freeze(['grant', 'revoke']);

const CLIENT_ERRORS = Object.freeze([
  'roles-target', 'roles-sections', 'roles-no-such-account', 'roles-root-grant',
]);

/**
 * `roles-forbidden` CANNOT REACH HERE FROM THIS HANDLER any more -- nothing that is not an owner
 * gets past the gate below -- and the branch stays anyway. grantRole() and revokeRole() each
 * check the role again for the sake of every future caller of theirs, and a mapping that quietly
 * dropped their refusal would turn a library-level refusal into a 503 the day somebody added a
 * second door onto them.
 */
function refuse(res, code) {
  if (code === 'roles-forbidden') return res.status(403).json({ ok: false, error: code });
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

  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'roles-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const action = typeof body.action === 'string' ? body.action : '';
  if (!ROLE_ACTIONS.includes(action)) return res.status(400).json({ ok: false, error: 'roles-action' });

  // ONE STATEMENT, TWO CALLERS, ONE REPLY. A stranger with no session, a stranger with a live
  // session and no role, and an editor all leave here through this single return -- so the
  // response they receive is identical by CONSTRUCTION and not by two literals that agree. See
  // the head of this file: an editor must not be able to tell that this door exists.
  const actor = await resolveActor(req);
  if (!actor || actor.role !== ROLE_OWNER) {
    return res.status(401).json({ ok: false, error: 'roles-unauthenticated' });
  }

  res.setHeader('Cache-Control', 'private, no-store');

  const target = typeof body.accountKey === 'string' ? body.accountKey : '';

  if (action === 'grant') {
    const sections = Array.isArray(body.sections) ? body.sections : [];
    // The role is NOT taken from the body. grantRole() writes `editor`, and that is the whole
    // vocabulary -- see the head of this file.
    const out = await grantRole(target, sections, actor);
    if (!out.ok) return refuse(res, out.code);
    return res.status(200).json({ ok: true, accountKey: out.accountKey, grant: out.record });
  }

  const out = await revokeRole(target, actor);
  if (!out.ok) return refuse(res, out.code);
  return res.status(200).json({ ok: true, accountKey: out.accountKey, removed: out.removed });
}
