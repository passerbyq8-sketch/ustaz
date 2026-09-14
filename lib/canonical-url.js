// lib/canonical-url.js — the dedup key for «is this the SAME page?», on this side of the seam.
//
// ── THIS FILE IS A SECOND COPY, AND SAYING SO IS THE POINT ──────────────────
//
// IT IS A SECOND COPY of `canonicalKey` in `api/ask.js:622-631`. Character for character the same
// rule: host lower-cased and www-stripped, path with its percent escapes upper-cased and its
// trailing slashes removed, query string KEPT exactly as it arrived, and '' for a URL that does
// not parse. Nothing here is an improvement on the original and nothing here may drift from it.
//
// THE REASON FOR THE COPY IS NOT TECHNICAL. `api/ask.js` is a protected file under the owner's
// standing order — it is not to be touched, so the original cannot be exported from where it
// lives and cannot be imported from here. This file therefore imports NOTHING from `api/ask.js`
// and exports NOTHING to it; the two are twins by text, not by wiring.
//
// UNIFYING THE TWO IS A SEPARATE, LATER ITEM by the owner's decision. It is not attempted here.
//
// UNTIL THAT ITEM LANDS: ANY EDIT TO EITHER HALF MUST BE LOOKED AT IN THE OTHER. A fold that is
// widened in one file and not the other makes two answers disagree about how many sources they
// rested on — the selection the reader sees and the ledger that records it would both be right
// and would both be wrong.
//
// AND IT IS NOT THE LEDGER'S `canonicalKey`. `lib/ledger/canonical.js` exports a function of the
// same name that additionally strips declared tracking parameters and SORTS the query string, and
// it reaches into the source-policy registry to do it. That is the right rule for a fetch ledger
// and the wrong rule here: the twin in `api/ask.js` keeps the query verbatim because on these
// sites the query selects the content, and the card fold must fold exactly what the handler's
// own fold folds — no more.

export function canonicalCardUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase()).replace(/\/+$/, '');
    return host + (path || '/') + u.search;
  } catch {
    return '';
  }
}
