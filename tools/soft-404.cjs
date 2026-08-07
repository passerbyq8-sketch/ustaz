// tools/soft-404.cjs — DID THE SERVER SAY "HERE IT IS" AND THEN HAND OVER ITS ERROR PAGE?
//
// ── THE MEASURED INCIDENT ────────────────────────────────────────────────────
// tools/source-liveness.cjs classified on the HTTP STATUS ALONE. al-badr.net's dead probe URL
// (/muqolat/5051) answers **HTTP 200** and serves the site's own «404» document, so the tool
// recorded the domain as `live-cites` — coverage that does not exist, in a file that drives a
// gate. The row was hand-corrected to `probe-stale` on 2026-08-07, and the correction carried
// its own warning: a `--write` re-run would overwrite it straight back. This module is what
// makes `--write` safe.
//
// ── WHAT THE RE-MEASUREMENT ACTUALLY FOUND, WHICH IS WORSE ───────────────────
// The recorded note assumed the 1085 extracted characters were the error page's share of the
// site-wide hadith band. Measured on 2026-08-07 across six LIVE al-badr.net articles and the
// dead URL, through the production pipeline: all seven produce **byte-identical** text, 1085
// chars, sha256 5149d37a3b53. The band is what Readability extracts from EVERY page on that
// host; the article body never survives. So the length carries NO information here, and any
// detector resting on length alone would have missed this case entirely.
//
// What separates the live pages from the dead one is the TITLE: «فضل يوم عاشوراء 09-01-1448»
// against «404». That is the signal, and it is a content signal, which is the point.
//
// ── THE THREE SIGNALS ────────────────────────────────────────────────────────
// Each is independent, and each is a thing a server does INSTEAD of answering 404 honestly:
//
//   redirect-to-root   a deep path answered by the home page. Very common, and unambiguous:
//                      nobody's article lives at «/».
//   not-found-title    the document names itself as an error. This is the one that catches the
//                      al-badr case, and the only one that could have.
//   empty-body         HTTP 200 with almost no extractable text AND almost no bytes. Deliberately
//                      a HARD floor far below any per-host minimum: this is not "the page is
//                      thin", which is a different verdict (live-no-citation) reached elsewhere.
//                      It is "there is no document here".
//
// THE SECOND HALF OF THAT LAST CONDITION WAS LEARNED THE HARD WAY, on the first full re-run.
// Judging emptiness by the EXTRACTED text alone moved two domains to `probe-stale`, and one of
// them was a lie: tafsir.app returns **150,461 raw characters** and extracts **0**, because it
// is a client-rendered app whose body arrives by script. The page is there; our extractor
// cannot read it. That is `live-no-citation` — a fact about the adapter — and calling it a
// stale URL would have sent somebody hunting for a replacement link that does not exist.
// shkhudheir.com's probe, by contrast, returns **114 raw characters**: there really is no
// document. Those two measurements are the calibration for RAW_SHELL_CHARS below.
//
// FALSE POSITIVES ARE THE COST TO WATCH, and the titles are checked rather than the body for
// exactly that reason: a real article ABOUT http status codes would trip a body scan, while a
// probe URL is always a known article whose title is a real title. The body is consulted only
// as a secondary confirmation and only on a page too short to be an article anyway.
'use strict';

// Anchored where possible. «404» as a bare title, «Error 404», and the Arabic pages that say
// the thing in words. Matched against the TITLE.
const NOT_FOUND_TITLE = [
  /^\s*(?:http\s*)?(?:error[\s:-]*)?4(?:04|10)\s*(?:[-–—|:]|$)/i,
  /\bpage\s+not\s+found\b/i,
  /\bnot\s+found\b/i,
  /غير\s*موجود/,
  /غير\s*متوفر/,
  /لم\s*يتم\s*العثور/,
  /الصفحة\s*المطلوبة/,
  /صفحة\s*خطأ/,
];

// Consulted only on a page short enough that it cannot be an article regardless.
const NOT_FOUND_BODY = [
  /الصفحة\s*(?:التي تبحث عنها\s*)?غير\s*موجود/,
  /لم\s*يتم\s*العثور\s*على/,
  /\bpage\s+not\s+found\b/i,
  /\bthe\s+requested\s+url\b/i,
];

// A document at all, or nothing? Far below any declared per-host floor on purpose — see above.
const EMPTY_BODY_CHARS = 120;
// ...and the server must not have sent a page-worth of bytes either. Between shkhudheir.com's
// 114 raw chars and tafsir.app's 150,461 there is no near call to make; this sits far from both.
const RAW_SHELL_CHARS = 20000;
// The body scan's ceiling. Above this a page is long enough that an incidental phrase is more
// likely than an error page.
const BODY_SCAN_MAX_CHARS = 400;

const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, ''); } catch (e) { return ''; } };

/**
 * @param {{requestedUrl:string, finalUrl?:string, title?:string, text?:string}} page
 * @returns {{soft:boolean, signal:string, detail:string}}
 *          `soft` true means: the host answered 2xx but this is not the requested document.
 *          The caller turns that into `probe-stale` — a fact about the URL, never about the
 *          domain, so that somebody fixes the link instead of condemning a healthy source.
 */
function detectSoftNotFound(page) {
  const p = page || {};
  const requested = String(p.requestedUrl || '');
  const final = String(p.finalUrl || requested);
  const title = String(p.title || '').trim();
  const text = String(p.text || '');

  // (1) A deep path answered by the site root.
  const reqPath = pathOf(requested);
  const finPath = pathOf(final);
  if (reqPath && reqPath !== '' && finPath === '') {
    return { soft: true, signal: 'redirect-to-root', detail: requested + ' -> ' + final };
  }

  // (2) The document names itself as an error. THE al-badr CASE.
  for (const re of NOT_FOUND_TITLE) {
    if (title && re.test(title)) {
      return { soft: true, signal: 'not-found-title', detail: 'title=' + JSON.stringify(title.slice(0, 60)) };
    }
  }

  // (3) HTTP 200 and no document — bytes as well as text. A big body that extracts to nothing
  // is a page we cannot READ, not a page that is not THERE, and the two need different fixes.
  const rawLen = Number(p.rawLen);
  const rawKnown = Number.isFinite(rawLen);
  if (text.length < EMPTY_BODY_CHARS && (!rawKnown || rawLen < RAW_SHELL_CHARS)) {
    return {
      soft: true,
      signal: 'empty-body',
      detail: text.length + ' chars extracted from ' + (rawKnown ? rawLen : '?') + ' raw',
    };
  }
  if (text.length <= BODY_SCAN_MAX_CHARS) {
    for (const re of NOT_FOUND_BODY) {
      if (re.test(text)) {
        return { soft: true, signal: 'not-found-body', detail: 'short page naming itself missing' };
      }
    }
  }

  return { soft: false, signal: '', detail: '' };
}

module.exports = {
  detectSoftNotFound,
  EMPTY_BODY_CHARS,
  RAW_SHELL_CHARS,
  BODY_SCAN_MAX_CHARS,
};
