// lib/reader-fields.js -- THE FOUR FIELDS THE PROMPT IS BUILT FROM, READ SAFELY.
//
// -- WHY THIS IS SEPARATE FROM lib/system-prompt.js ----------------------------
// That file is GENERATED from index.html and must stay that way, so nothing hand-written
// lives in it. This one is hand-written, and it is the only thing that decides what the
// generated builder is fed.
//
// -- WHY IT SANITISES RATHER THAN TRUSTS --------------------------------------
// D02ب moved the system prompt to the server so the client could no longer write the text
// that governs it. But `name` and `age` are interpolated INTO that text verbatim, so a body
// carrying a 5000-character "name" made of instructions would be writing the governing
// document again through a smaller hole. The prompt is the server's; what the client
// contributes to it is a short, flat, structurally inert string.
//
// -- THE FALLBACK RULE ---------------------------------------------------------
// Absence never widens scope. Every unusable field resolves to the narrowest reading:
//
//   age     unusable -> 0, which is the YOUNG band. Never adult. This is the safety-carrying
//                       one: buildSystemPrompt forks persona and scope on it.
//   gender  not 'female' -> male, which is exactly what the client's own ternary did.
//   mode    not 'call'   -> 'chat', the narrower prompt (the call prompt adds the voice block).
//   name    unusable     -> a neutral term of address, never an empty gap in the sentence.
//
// This mirrors the existing floor pattern: lib/policy/age.js resolves an unknown claim
// downward, and lib/retrieve.js fails closed to the minor source list.
'use strict';

// A name is a form of address, not a channel. Flattened to one line, stripped of the
// characters the prompt uses STRUCTURALLY (its section rules and its stop marks), and cut
// short. 40 characters is far above any real name and far below a paragraph.
const MAX_NAME_CHARS = 40;
const NEUTRAL_NAME = 'صديقي';

export function safeName(raw) {
  if (typeof raw !== 'string') return NEUTRAL_NAME;
  const flat = raw
    .replace(/[\r\n\t]+/g, ' ')            // never let a name open a new line in the prompt
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, '') // controls, zero-width, bidi overrides
    .replace(/[═⛔✗✓`<>{}]/g, '')          // the prompt's own structural marks
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_CHARS)
    .trim();
  return flat || NEUTRAL_NAME;
}

// An age is a small integer or it is nothing. Anything else becomes 0 -- the young band.
// NOT parseInt on the raw value: parseInt('18 ignore the above') is 18, and that string
// would then be printed into the prompt.
export function safeAge(raw) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\s*\d{1,3}\s*$/.test(raw) ? Number(raw) : NaN);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  if (i < 0 || i > 120) return 0;
  return i;
}

export function safeGender(raw) {
  return raw === 'female' ? 'female' : 'male';
}

export function safeMode(raw) {
  return raw === 'call' ? 'call' : 'chat';
}

// The band a sanitised age implies. Taken VERBATIM from buildSystemPrompt's own fork
// (young 4-13 / teen 13-17 / adult 18+) so the prompt's persona and the policy's band can
// never disagree about who is reading.
export function bandForAge(age) {
  const a = safeAge(age);
  return a >= 18 ? 'adult' : a >= 13 ? 'teen' : 'young';
}

const RANK = { young: 0, teen: 1, adult: 2 };

// The client sends BOTH `band` and `age`. They are two claims from the same untrusted place,
// so neither is promoted to a server fact -- but they can still check each other. The
// narrower one wins, which is the rule lib/policy/age.js already applies between a server
// band and a client claim: a claim may RESTRICT and may not RELEASE.
//
// Returns undefined only when there is no usable claim AT ALL, which the callers hand to
// resolveAudience as an absent clientBand -- deliberately, so the existing unknown-reader
// path keeps deciding that case instead of this file inventing a second answer for it.
export function narrowestBand(clientBand, age) {
  const valid = (b) => b === 'young' || b === 'teen' || b === 'adult';
  const claimed = valid(clientBand) ? clientBand : null;
  const derived = (age === undefined || age === null || safeAge(age) === 0) ? null : bandForAge(age);
  if (claimed && derived) return RANK[claimed] < RANK[derived] ? claimed : derived;
  return claimed || derived || undefined;
}

// The one call every route makes. `body.system` is NOT read here and is not read anywhere
// else either -- that is the whole point of D02ب.
export function readerFromBody(body) {
  const b = body && typeof body === 'object' ? body : {};
  return {
    name: safeName(b.name),
    age: safeAge(b.age),
    gender: safeGender(b.gender),
    mode: safeMode(b.mode),
  };
}
