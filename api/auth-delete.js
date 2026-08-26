// api/auth-delete.js
// POST /api/auth-delete   { session }   ->   { ok }
//
// THE DOOR OUT, AND IT IS REQUIRED. An application that creates an account must be able to
// delete it FROM INSIDE ITSELF -- Apple's rule, and the reason this route exists at all. The
// sign-in path shipped without one; this is that half.
//
// THE SESSION IS THE IDENTITY, AND IT IS THE ONLY IDENTITY.
// 🔴 NOTHING IN THE BODY NAMES AN ACCOUNT. No `provider`, no `sub`, no address -- not read, not
// accepted, not ignored-but-tolerated: they are simply never looked for. A route that took any
// of the three and deleted what they named would be a door for deleting OTHER PEOPLE'S accounts,
// operated by anyone who could guess a subject or type an address. The one field this route
// reads is `session`, an opaque 32-byte store key that names its own account and names it for
// exactly one reader: the one holding it. That is the same shape api/auth-exchange.js already
// reads `ticket` in, on the same family of routes, for the same reason.
//
// 🔴 THE DEVICE HEADER IS REQUIRED, AND WHAT IT PROVES TODAY IS STATED HONESTLY. `x-murabbi-device`
// is read and shape-checked exactly as api/auth-exchange.js:59 reads it, and a request without a
// well-formed one is refused. It is NOT a per-account binding: the session record holds
// { accountKey, createdAt, expiresAt } and no device, so there is nothing here to compare a
// device AGAINST. What the requirement buys is that this route answers only the app's own capped
// fetch path, which always carries the header. Requiring it costs no reader anything: the
// session lives in localStorage, so a reader whose storage is blocked -- the one case where
// getDeviceId() returns null -- has no session to delete in the first place. Binding the session
// itself to a device would mean a field on a record whose shape is pinned elsewhere, and that is
// an owner's decision rather than this route's to take.
//
// 🔴 IT REFUSES IDENTICALLY IN EVERY CASE THAT IS NOT A DELETE. A session that never existed, one
// that expired, one this store cannot read, and an account already gone all return the SAME
// 401 with the SAME code. Telling them apart would turn this route into an oracle for "does an
// account exist behind this key" -- and it would answer that question to whoever was holding a
// key they should not have.
//
// 🔴 IT NEVER CLAIMS AN ERASURE IT DID NOT PERFORM. Every one of the three deletes is checked,
// and a store that refuses any of them produces a named 503 rather than { ok: true }. "We could
// not reach the store" and "your account is gone" are not the same sentence and are never
// printed as though they were.
//
// 🔴 THE AI-CONSENT GATE IS DELIBERATELY NOT APPLIED HERE, for a reason stronger than the one
// api/auth-exchange.js gives: a reader must never have to agree to anything in order to be
// forgotten. Nothing here reaches an AI vendor -- this is a store read and three store deletes.
//
// WHAT THIS ROUTE DOES NOT TOUCH, AND WILL NOT:
//   - the conversations and keys held on the device. Those are the separate "delete my data"
//     button, which is a local erasure and needs no server at all.
//   - `pc:` -- the digest of the parental lock code. delete.html names it, in both languages, as
//     the thing that REMAINS, and it is the parent's lock rather than the reader's account.
//   - the counters, the reports and the operational log.
//
// ZERO NEW STORE KEYS AND ZERO NEW ENVIRONMENT VARIABLES: this route reads three key families
// that already exist and writes none. FOUNDER_SECRET is not reused here; see lib/auth/account.js.

import { applyCorsOrigin, checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { safeId, DEVICE_HEADER } from '../lib/daycap.js';
import { touchSession, deleteAccount } from '../lib/auth/account.js';

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + DEVICE_HEADER);
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  // Fails CLOSED -- see lib/ratelimit.js. A delete we cannot count is one we do not make.
  const rl = await checkAuthLimit(clientAddress(req, 'unknown'));
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'auth-rate-limited' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const session = typeof body.session === 'string' ? body.session : '';
  if (!session) return res.status(400).json({ ok: false, error: 'auth-session-missing' });

  const device = safeId((req.headers || {})[DEVICE_HEADER]);
  if (!device) return res.status(400).json({ ok: false, error: 'auth-device-missing' });

  // THE ACCOUNT IS RESOLVED FROM THE SESSION AND FROM NOTHING ELSE. touchSession() is the seam
  // that already knows what a live session is -- present, readable, and not past its expiry --
  // and it is used here rather than a second copy of that rule written out on this page. It
  // slides the ninety days as it reads, which is three lines of work about to be undone by the
  // revoke below; a duplicated definition of "alive" would have been the more expensive mistake.
  const record = await touchSession(session);
  if (!record || typeof record.accountKey !== 'string') {
    // Absent, expired, or a store we could not read. ONE answer for all three -- see the head.
    return res.status(401).json({ ok: false, error: 'auth-session-invalid' });
  }

  const done = await deleteAccount(record.accountKey, session);
  if (!done.ok) {
    // An account this session names but the store cannot hand back joins the three above, with
    // the same status and the same code: it is the one remaining way to ask "is there an account
    // here", and it is answered the same way as the rest. Nothing is revoked on this branch --
    // a live session pointing at an account that is already gone is not a state this system can
    // reach, because the only thing that deletes an account is this route, and it revokes the
    // session in the same breath. A transient store fault must not sign a reader out of an
    // account that is still standing.
    if (done.code === 'auth-account-unreadable') {
      return res.status(401).json({ ok: false, error: 'auth-session-invalid' });
    }
    // Everything else is a store that refused a delete. Named, and never dressed as a success.
    return res.status(503).json({ ok: false, error: done.code });
  }

  // ONE FIELD. Which of the three keys were removed is not reported: whether an index entry
  // existed is a fact about whether this address was proved and shared with another provider,
  // and that is not something a response body needs to carry.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ ok: true });
}
