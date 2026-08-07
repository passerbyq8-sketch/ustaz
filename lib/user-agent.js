// lib/user-agent.js
// ONE NAME, SENT BY EVERY FETCHER THIS APP OWNS. Directive 6أ.
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
// There were FOUR different answers to "who is asking?", and two of them were untrue:
//
//   lib/retrieve.js        Mozilla/5.0 (Windows NT 10.0 … Chrome/125.0.0.0 Safari/537.36)
//   tools/source-live-smoke.cjs   the same desktop-Chrome string
//   lib/ledger/safe-fetch.js      Mozilla/5.0 (compatible; EzikBot/1.0; +https://ezik.app)
//   lib/binothaimeen.js           ezik-app/1 (+https://ezik.app; contact via site)
//
// The first two are a flat claim to be a person at a keyboard running Chrome on Windows. This
// app is a server, and it is not. A site's operator sets robots rules and rate limits on the
// basis of who they are told is calling, and a false name takes that decision away from them —
// which is the one thing the rest of this codebase is careful never to do.
//
// The third was the subtler failure and worth naming, because it read as the honest one: it
// still opened with `Mozilla/5.0`, a browser token, and a log line grepping for browsers finds
// it. Half a truth inside a parenthesis is not the truth an operator's filter reads.
//
// The fourth was honest but DIFFERENT, which costs an operator something real: three names from
// one app cannot be allowed, throttled or blocked as one thing.
//
// ── WHAT IT IS NOW ───────────────────────────────────────────────────────────
// One string, no browser token, a working URL, and it is the same in every path — the live
// retrieval path, the ledger path, the Ibn Uthaymeen adapter and the measurement tools. An
// operator who looks us up gets a page that says what we are; one who wants us gone can write
// one rule and have it hold everywhere.
//
// THIS CHANGES WHO WE SAY WE ARE AND NOTHING ELSE. robots.txt, crawl-delay, the SSRF address
// checks, the per-host breakers and the one-at-a-time pacing are all untouched, and a site that
// refuses server-side clients is still taken at its word — no retry, no second name, no attempt
// to look like something else. The name being true is what makes the refusal meaningful.
export const EZIK_USER_AGENT = 'EzikBot/1.0 (+https://ezik.app)';
