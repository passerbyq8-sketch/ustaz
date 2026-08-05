// lib/source-page-gates.js
// PER-PAGE ADMISSION. An approved host is not an approved page.
//
// WHAT THIS CLOSES. The host allow-list in lib/retrieve.js answers "is this site vetted".
// It cannot answer "is this PAGE an answer" — and on the sites added in this change that
// gap is not theoretical, it is measured:
//
//   * mostafaaladwy.com publishes fatwa pages whose answer field is EMPTY (/fatwa/178116:
//     «السؤال … الإجابة» and then nothing). The visible answer is zero characters, yet the
//     raw document yields ~10,000 characters — almost all of it inline <script> — so the
//     generic 200-character floor in retrieve.js would have accepted it and cited a fatwa
//     that nobody answered.
//   * mostafaaladwy.com's /fatwa-category/ listings extract to ~18,000 characters of link
//     text, and would have been cited as a source in exactly the same way.
//   * saleh.af.org.sa's /ar/ftawa is 24 <audio> elements. There is no transcript anywhere.
//   * khutabaa.com's /forums/ tree is user discussion, and one thread page is 635 KB.
//   * salafcenter.org files reader submissions under «مشاركات القرّاء» at the SAME URL shape
//     as the centre's own research, so nothing in the URL distinguishes them — only the
//     site's own category badge does.
//   * eftaa.awqaf.gov.kw carries both the Fatwa Board's collective rulings and personal
//     answers, and presenting one as the other is the specific misattribution the brief
//     forbids.
//
// THE SHAPE OF EVERY RULE HERE. Refusal is the outcome of doubt. A page that cannot be shown
// to be an answer, by evidence read off the page itself, is dropped — never downgraded,
// never guessed at, never cited with a hedge. Dropping one usable page costs a card; citing
// one unusable page costs the reader's trust in every card.
//
// NO PER-SITE CSS SELECTORS ARE RELIED ON FOR ADMISSION. Site markup changes without notice
// and a stale selector fails OPEN, which is the wrong direction. The signals used are the
// ones a redesign does not move: the URL path the site publishes in its own sitemap and
// navigation, the site's own visible section/category text, and the ratio of link text to
// prose. The one exception is salafcenter's category badge, which is matched on the
// STANDARD WordPress `rel="category tag"` attribute rather than on a class name.

// ── small local helpers (deliberately not imported: this module must stay standalone) ──
const collapse = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const stripMarks = (s) => String(s == null ? '' : s).replace(/[‎‏‪-‮⁦-⁩﻿]/g, '');

// LENGTH-PRESERVING Arabic fold. Every substitution here is one code point for one code
// point, so an index found in the folded string is the same index in the original. That is
// what lets the extractors below slice the ORIGINAL text — the text a reader will see —
// while matching on a normalised copy.
function foldSameLength(s) {
  return String(s == null ? '' : s)
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}
const has = (hay, needle) => foldSameLength(hay).includes(foldSameLength(needle));
const hasAny = (hay, list) => list.some((n) => has(hay, n));

function decodedPath(u) {
  try {
    const url = new URL(u);
    try { return decodeURIComponent(url.pathname).toLowerCase(); }
    catch { return url.pathname.toLowerCase(); }
  } catch { return ''; }
}
function searchOf(u) {
  try { return new URL(u).search.toLowerCase(); } catch { return ''; }
}
function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
function onHost(u, domain) {
  const h = hostOf(u);
  return h === domain || h.endsWith('.' + domain);
}

// ── generic listing shapes ───────────────────────────────────────────────────
// Path segments that mean "this is a list of other pages" on essentially every CMS. Matched
// as whole segments so a slug that merely CONTAINS one of these words is unaffected.
const GENERIC_LISTING_SEGMENTS = new Set([
  'category', 'categories', 'tag', 'tags', 'author', 'archive', 'archives',
  'page', 'search', 'results', 'index', 'list', 'feed', 'sitemap',
]);
const GENERIC_LISTING_QUERY = /[?&](s|q|search|keyword|page|paged|orderby|orderdir)=/i;
// A taxonomy segment does not always spell itself "category": WordPress lets a custom post
// type name its archive, and mostafaaladwy.com's is /fatwa-category/. MEASURED there: the
// listing extracts to ~18,000 characters and would otherwise have been cited as a fatwa.
const TAXONOMY_SUFFIX = /-(?:category|categories|tag|tags|archive)$/;

function genericListing(u) {
  const segs = decodedPath(u).split('/').filter(Boolean);
  for (const seg of segs) {
    if (GENERIC_LISTING_SEGMENTS.has(seg)) return 'generic-listing-path:' + seg;
    if (TAXONOMY_SUFFIX.test(seg)) return 'taxonomy-archive:' + seg;
  }
  if (GENERIC_LISTING_QUERY.test(searchOf(u))) return 'generic-listing-query';
  return null;
}

// ── per-site rules ───────────────────────────────────────────────────────────
// blocked     : path prefixes that can never be an answer (audio/video catalogues, forums,
//               download shelves). Matched on the DECODED path so an Arabic segment matches.
// listing     : section roots. The ROOT and its pagination are listings; anything deeper is
//               a page and is admitted — /fatwa is a list, /fatwa/178087/... is an answer.
// listingTree : sections where EVERYTHING underneath is also a listing — a taxonomy whose
//               children are more lists, or a catalogue whose leaves are .mp3 files. Kept
//               separate from `listing` on purpose: treeing a section that DOES have detail
//               pages beneath it would silently delete the source's whole corpus, so each
//               entry below was chosen from the live URL shapes rather than by guesswork.
// pathMustMatch    : optional RegExp. The ALLOW-LIST form of the rules above: the decoded path
//               must match it or the page is refused. Everything else here enumerates what a
//               site is NOT; this enumerates what it IS. Used for the world sources added on
//               2026-08-05, where the article shape is one stable pattern and the far larger
//               remainder of the site (front pages, section indexes, live blogs, video, and —
//               on bbc.com — an entire English edition) is everything else. Enumerating the
//               refusals there would be a list nobody could finish; enumerating the one
//               admitted shape is a list that fails CLOSED when the site adds a section.
// pathMustNotMatch : optional RegExp applied after it, for the exceptions INSIDE the admitted
//               shape — Wikipedia's namespaces sit at /wiki/{Namespace}:{Title}, i.e. at the
//               same path depth as an article, so no prefix rule can separate them.
// minText     : the floor this site's extracted answer must clear.
// extract   : optional (doc, text) => { text, title? } | null — used where the site's own
//             markup defeats Readability. Returning null is a refusal.
// attribute : optional (ctx) => { author, attributionType } | null — null is a refusal.
const RULES = {
  // #2 — audio and PDF only. The fatwas ARE the mp3 files; there is no transcript page, so
  // nothing under the media tree may ever be a citation, and the section indexes are lists.
  // MEASURED: /ar/ftawa is 24 <audio> elements and /ar/khotab is 21; /ar/books is 10 PDFs.
  // These sections have no detail pages at all — every item links straight at its media file
  // — so the whole subtree is a catalogue.
  'saleh.af.org.sa': {
    blocked: ['/sites/default/files'],
    listingTree: ['/ar/ftawa', '/ar/khotab', '/ar/mohadrat', '/ar/news', '/ar/books', '/ar/droos'],
    minText: 400,
  },

  // #6 — tafsir and book explanations as text; the audio/video shelves are not text.
  // /interpretations/{id}/{slug} and /series/{id}/{slug} ARE content, so those roots are not
  // treed; only the taxonomy beneath /interpretations/category is.
  'khaledalsabt.com': {
    blocked: ['/specials', '/videos', '/audio-tafseer', '/profile'],
    listing: ['/series', '/lectures', '/words', '/books', '/interpretations', '/explanations'],
    listingTree: ['/interpretations/category', '/explanations/book'],
    minText: 400,
  },

  // #7 — the catalogue paths are the shaykh's own index pages, and everything under them is
  // another index; /topics/{slug} is the answer.
  'ibn-jebreen.com': {
    blocked: ['/soundlibrary', '/videolibrary', '/advsearch'],
    listingTree: ['/textlibrary', '/indexs', '/objective', '/topicscontent'],
    minText: 300,
  },

  // #10 — Readability returns 95 characters here (it locks onto the "عن الموقع" widget), so
  // the raw-text fallback would otherwise decide the citation. Extract the published
  // question and answer from the site's own visible labels, and refuse an empty answer.
  'mostafaaladwy.com': {
    listing: ['/fatwa'],
    // /books and its detail pages are a download shelf, not an answer, so the whole tree
    // goes. (It used to be caught incidentally by the bare-number pagination test; that test
    // is now correctly limited to `page/N`, so the intent has to be stated outright.)
    listingTree: ['/fatwa-category', '/videos-category', '/books'],
    minText: 20,
    extract(doc) {
      const body = visibleText(doc);
      if (!body) return null;
      const folded = foldSameLength(body);
      const qi = folded.indexOf('السوال');
      const ai = folded.indexOf('الاجابه');
      if (ai === -1) return null;                       // not a fatwa page shape at all
      let endIdx = folded.length;
      for (const stop of ['شارك الفتوي', 'عن الموقع', 'روابط سريعه', 'جميع الحقوق']) {
        const k = folded.indexOf(foldSameLength(stop), ai);
        if (k !== -1 && k < endIdx) endIdx = k;
      }
      const answer = collapse(body.slice(ai + 'الاجابة'.length, endIdx));
      // THE POINT OF THIS WHOLE FUNCTION. A published question with no published answer is
      // not a fatwa; it is a placeholder, and this site has them.
      if (answer.length < 20) return null;
      const question = qi !== -1 && qi < ai
        ? collapse(body.slice(qi + 'السؤال'.length, ai))
        : '';
      return { text: (question ? 'السؤال: ' + question + '\n' : '') + 'الإجابة: ' + answer };
    },
    attribute(ctx) {
      // The brief requires the shaykh's name to be established on the page, not assumed
      // from the domain.
      const hay = ctx.title + ' ' + ctx.text + ' ' + ctx.pageText;
      if (!hasAny(hay, ['مصطفى العدوي', 'مصطفي العدوي'])) return null;
      return { author: 'الشيخ مصطفى العدوي', attributionType: 'scholar' };
    },
  },

  // #11 — not a fatwa corpus (see the registry), and a page that reprints somebody else's
  // material must not be filed under his name. islamqa.info is already on the allow-list in
  // its own right, so re-citing it through this host would also duplicate a source.
  'almunajjid.com': {
    listing: ['/articles', '/books', '/speeches', '/lectures', '/courses', '/selection',
      '/scientific-series', '/tv-programs', '/radio-programs', '/halfminute'],
    minText: 400,
    attribute(ctx) {
      const hay = ctx.text + ' ' + ctx.title;
      // Republication, by the site's own words or by a link to the original ARTICLE.
      //
      // MEASURED, and the reason this is not simply "any islamqa link": every page on this
      // host carries a bare `https://islamqa.info` in its site chrome — the shaykh's own
      // sites link to one another — so a naive test rejected the entire domain, including a
      // khutbah he delivered himself. A courtesy link to a home page is not a reprint. A
      // link to a SPECIFIC page there is, and that is the difference the path tests.
      if (hasAny(hay, ['الإسلام سؤال وجواب', 'الاسلام سؤال وجواب'])) return null;
      if (ctx.links.some((h) => {
        if (!/islamqa\.info/i.test(String(h || ''))) return false;
        try { return new URL(String(h), ctx.finalUrl || ctx.url).pathname.replace(/\/+$/, '').length > 1; }
        catch { return false; }
      })) return null;
      if (hasAny(hay, ['المصدر:', 'نقلا عن', 'منقول من', 'مأخوذ من موقع'])) return null;
      return { author: 'الشيخ محمد صالح المنجد', attributionType: 'scholar' };
    },
  },

  // #18 — the separation the brief is emphatic about. A collective ruling and one mufti's
  // personal answer are different things and may never wear each other's name.
  'eftaa.awqaf.gov.kw': {
    minText: 300,
    attribute(ctx) {
      const hay = ctx.text + ' ' + ctx.title;
      const presented = hasAny(hay, [
        'عرض على هيئة الفتوى', 'عرض على لجنة الفتوى', 'عرض على اللجنة', 'عرض على الهيئة',
        'المعروض على هيئة الفتوى', 'عُرض على هيئة الفتوى', 'ورد إلى هيئة الفتوى',
        'عرض على لجنة الأمور العامة للفتوى',
      ]);
      const answered = hasAny(hay, [
        'أجابت الهيئة', 'أجابت اللجنة', 'قررت الهيئة', 'قررت اللجنة', 'رأت الهيئة',
        'رأت اللجنة', 'وترى الهيئة', 'وترى اللجنة', 'فتوى هيئة الفتوى', 'قرار اللجنة',
        'وقد أجابت الهيئة', 'وقد أجابت اللجنة',
      ]);
      const personal = hasAny(hay, ['أحمد الحجي الكردي', 'احمد الحجي الكردي', 'الحجي الكردي', 'أحمد الكردي']);
      const committee = presented && answered;

      // Both signatures on one page: we cannot say which of them this ruling is. The brief
      // names this case and names the outcome — refuse, do not guess.
      if (committee && personal) return null;
      if (committee) {
        return { author: 'هيئة الفتوى — إدارة الإفتاء، وزارة الأوقاف الكويتية', attributionType: 'Kuwait Fatwa Committee' };
      }
      if (personal) {
        return { author: 'الشيخ أحمد الحجي الكردي', attributionType: 'Personal answer — Ahmad Al-Kurdi' };
      }
      // No signature at all. Inside a FATWA section that is fatal: an official ruling that
      // does not say who issued it must not be presented as one. Outside it, the page is an
      // article or a research paper published by the department under its own name, which
      // is a perfectly ordinary attribution.
      const p = decodedPath(ctx.finalUrl || ctx.url);
      if (hasAny(p, ['فتاوى', 'فتوى', 'الفتاوي', 'fatwa'])) return null;
      return { author: 'إدارة الإفتاء — وزارة الأوقاف الكويتية', attributionType: 'department publication' };
    },
  },

  // #28 — khutbahs and articles only. The discussion forums are user content and are refused
  // by path; a khutbah with no named khatib or scientific team is refused for want of an
  // author, exactly as the brief requires.
  'khutabaa.com': {
    blocked: ['/ar/forums', '/en/forums', '/ar/khuteb', '/en/khuteb'],
    // The khutbahs themselves live at /ar/article/{slug}; /ar/khutub and its children are
    // all lists (featured / haramyn / projects / ?latest_posts=N), so the tree is correct.
    listingTree: ['/ar/khutub', '/en/khutub', '/ar/categories', '/ar/khutabaa',
      '/ar/scientific_files', '/ar/books-articles/books'],
    listing: ['/ar/scientific_discoveries', '/ar/projects', '/ar/faq', '/ar/books-articles/posts'],
    minText: 400,
    attribute(ctx) {
      const who = collapse(ctx.byline)
        || collapse(ctx.metaAuthor)
        || (hasAny(ctx.pageText, ['الفريق العلمي']) ? 'ملتقى الخطباء — الفريق العلمي' : '');
      if (!who) return null;                          // anonymous content is not citable here
      return { author: who, attributionType: 'khatib' };
    },
  },

  // مركز تفسير — original Quranic-studies articles and research.
  //
  // TWO SIGNALS, BOTH DECLARED BY THE SITE ITSELF, so neither is a guess about layout:
  //   * og:type. The centre stamps every node with what it IS — `article`, `research`,
  //     `interview`, `author`, and nothing at all on a listing. Only `article` and `research`
  //     are admitted here. `author` is an author's BIOGRAPHY page, which the brief names
  //     explicitly as a refusal («صفحات المؤلف الخالية من المقال»), and a listing has no type
  //     at all. `interview` is withheld deliberately: the brief admits «مقالة أو بحثًا أو
  //     ملفًا علميًا نصيًا», and an interview is none of those three by name. Adding
  //     'interview' to the set below is the whole change if that is ever wanted.
  //   * the author. The page carries a literal «الكاتب:» label followed by a link to the
  //     writer's own /authors/{id} page. That label is what is read — NOT "the first author
  //     link on the page", which on an article page is ambiguous because the sidebar lists
  //     the authors of related articles too.
  'tafsir.net': {
    // /articles is the section index and /articles/{id} is the article, so this is a root
    // rule, not a tree one. /researches (plural, the index) and /researchs/{id} (the study)
    // are different spellings on this site, which is why both can appear here safely.
    listing: ['/articles', '/researches', '/researchs', '/papers', '/orientalism',
      '/translations', '/definitions', '/lessons', '/multimedia', '/videos', '/publications',
      '/applications', '/opinion', '/about', '/contact', '/interviews', '/news-storys'],
    // Taxonomies, author profiles, and the paths the site's own robots.txt disallows.
    listingTree: ['/collection', '/category', '/authors', '/search', '/searchs', '/user',
      '/node', '/admin', '/comment', '/media'],
    // MEASURED, and the reason this floor is not the usual 400: the centre's real articles
    // extract to 39,647 and 27,142 characters, while /researchs/24780 — whose actual content
    // is a PDF download — extracts to 1,474, and most of THAT is the breadcrumb and the title
    // repeated. A page whose body is a file rather than text is exactly what the brief
    // refuses («الصور والملفات التي لا تحمل نصًا»), and on this site the length is what
    // separates the two cleanly.
    minText: 2500,
    attribute(ctx) {
      const type = ctx.meta('meta[property="og:type"]', 'content');
      if (type !== 'article' && type !== 'research') return null;
      const who = collapse(ctx.metaAuthor) || collapse(ctx.byline)
        || ctx.labelledLink(['الكاتب', 'المؤلف', 'إعداد', 'ترجمة'], '/authors/')
        || (hasAny(ctx.pageText, ['فريق موقع تفسير']) ? 'فريق موقع تفسير' : '');
      if (!who) return null;
      return { author: who, attributionType: 'researcher' };
    },
  },

  // الشيخ عبدالمحسن العباد — single article pages only.
  //
  // MEASURED by the prototype before this was written: /articles/{id} extracts clean via
  // Readability (3,446 and 443 characters, link density 0.15), while /lecture/hadith and
  // /books/book-titles are catalogues whose extracted "text" is the navigation and the
  // copyright line. So the catalogues are refused from the URL, and anything that still
  // reaches the generic path is caught by the raw-fallback link-density rule — which is
  // exactly the "متن لا يمكن عزله عن القائمة الجانبية" case.
  'al-abbaad.com': {
    listingTree: ['/lecture', '/books', '/sound', '/audio', '/video', '/search'],
    listing: ['/articles'],
    minText: 400,
    attribute(ctx) {
      // The page must establish that it IS his official site, rather than the domain being
      // taken on trust. If the site is ever redesigned past this, the source fails closed.
      if (!hasAny(ctx.pageText, ['عبد المحسن بن حمد العباد', 'عبدالمحسن بن حمد العباد',
        'عبد المحسن العباد', 'عبدالمحسن العباد'])) return null;
      return { author: 'الشيخ عبد المحسن بن حمد العباد', attributionType: 'scholar' };
    },
  },

  // ── THE WORLD SOURCES (lib/retrieve.js SITES_GENERAL) ──────────────────────
  //
  // These four are NEWS AND ENCYCLOPEDIA sites, and every rule below was measured on the live
  // site on 2026-08-05 through lib/retrieve.js's own fetchAndClean(). The measurement that
  // makes them necessary is the same on all four: THE FRONT PAGE AND THE SECTION INDEX
  // EXTRACT CLEANLY AND WOULD HAVE BEEN CITED —
  //
  //     aljazeera.net/news/            -> 2,573 clean chars
  //     bbc.com/arabic                 -> 2,111 clean chars
  //     bbc.com/news       (ENGLISH)   -> 7,718 clean chars
  //     skynewsarabia.com/             -> 6,647 clean chars
  //     ar.wikipedia.org/wiki/تصنيف:غزة -> 1,753 clean chars
  //
  // Every one of those sails past the generic 200-character floor in retrieve.js, and a card
  // pointing at a front page is a card whose content will have changed by the time the reader
  // clicks it. So each host declares the ONE path shape that is an article, and nothing else
  // on the domain can become a source. `minText` is 400 rather than the 200 floor because the
  // measured articles are 1,403 characters at the shortest, so 400 rejects a stub without ever
  // reaching a real story.
  //
  // NO `attribute` FUNCTION ON ANY OF THEM, and that is a deliberate difference from the
  // scholar sites above. There, the question "who is this by" decides whether a ruling may be
  // credited to a man. Here nothing may be credited to anybody: a news page backs a report of
  // what a news organisation published, the publisher IS the domain, and api/ask.js forbids
  // deriving any religious ruling from these pages at all.

  // The Arabic Wikipedia. Articles live at /wiki/{Title}; everything with a namespace prefix
  // (تصنيف: category, بوابة: portal, ملف: file, نقاش: talk, قالب: template, خاص: special,
  // مساعدة: help, ويكيبيديا: project) sits at the SAME depth and is a catalogue or meta-page,
  // so the colon is what separates them. /w/index.php and the API are refused by shape.
  'ar.wikipedia.org': {
    pathMustMatch: /^\/wiki\/[^/]+$/,
    pathMustNotMatch: /^\/wiki\/[^/:]*:/,
    minText: 400,
  },

  // الجزيرة نت — a story is /{section}/{YYYY}/{M}/{D}/{slug}. MEASURED across /news, /sport
  // and /economy: every story carries the date path, and every page without it is a section
  // index, a topic page or site furniture.
  'aljazeera.net': {
    pathMustMatch: /^\/[a-z0-9-]+\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/?$/,
    minText: 400,
  },

  // BBC — THE ARABIC SERVICE ONLY. bbc.com is one domain carrying dozens of language services,
  // and the host allow-list cannot express "the Arabic one", so it is expressed here. Articles
  // are /arabic/articles/{id}; /arabic itself is the front page and /news is the English
  // edition, and both are refused by this single pattern rather than by naming them.
  'bbc.com': {
    pathMustMatch: /^\/arabic\/articles\/[a-z0-9]+\/?$/i,
    minText: 400,
  },

  // سكاي نيوز عربية — a story is /{section}/{id}-{slug}, the id being the article number.
  // MEASURED on /middle-east: the section root extracts 7,007 characters of headline list.
  // Its robots.txt disallows /search, /keyword-search and /web/tag; all three are outside the
  // admitted shape anyway, so the pattern already refuses them.
  'skynewsarabia.com': {
    pathMustMatch: /^\/[a-z0-9-]+\/\d{5,}-[^/]+\/?$/,
    minText: 400,
  },

  // #29 — the centre's own research. Reader submissions share the URL shape of centre
  // articles, so the site's own category badge is the only thing that separates them.
  'salafcenter.org': {
    listing: ['/category', '/tag', '/author'],
    minText: 400,
    attribute(ctx) {
      if (hasAny(ctx.categories.join(' '), ['مشاركات القراء', 'مشاركات القرّاء'])) return null;
      const who = collapse(ctx.metaAuthor) || collapse(ctx.byline);
      if (!who) return null;
      return { author: who, attributionType: 'researcher' };
    },
  },
};

export function hasPageRules(hostOrUrl) {
  const h = hostOf(hostOrUrl) || String(hostOrUrl || '').toLowerCase().replace(/^www\./, '');
  return Object.keys(RULES).some((d) => h === d || h.endsWith('.' + d));
}
function rulesFor(u) {
  const h = hostOf(u);
  for (const d of Object.keys(RULES)) if (h === d || h.endsWith('.' + d)) return { domain: d, rules: RULES[d] };
  return null;
}

// ── the URL-only gate ────────────────────────────────────────────────────────
// Runs before anything is parsed, and is also what a test can call without a document.
// Returns a reason string, or null when the URL is admissible.
export function pathRefusal(url, finalUrl) {
  const target = finalUrl || url;
  const found = rulesFor(target);
  if (!found) return null;
  const p = decodedPath(target);
  if (!p) return 'unparseable-url';
  const { rules } = found;

  // THE SITE ROOT IS NEVER AN ANSWER. It is the one page every site has and the one page that
  // is always a digest of other pages, so it is refused for every host that has rules at all.
  // MEASURED: al-abbaad.com's home page extracts 950 characters carrying the shaykh's name,
  // which cleared both the length floor and the attribution rule — it would have been cited
  // as though it were an article.
  if (p === '/' || p === '') return 'site-root';

  // THE ALLOW-LIST FORM, CHECKED FIRST. When a host declares the one path shape that is an
  // article, anything else on that host is refused here — before the blocked/listing rules get
  // a chance to be silent about a shape nobody thought to enumerate. This is the direction that
  // fails closed: a section the site adds tomorrow is refused by default rather than admitted
  // by default.
  if (rules.pathMustMatch instanceof RegExp && !rules.pathMustMatch.test(p)) {
    return 'not-an-article-path';
  }
  // ...and the exceptions that live INSIDE the admitted shape (Wikipedia's namespaces).
  if (rules.pathMustNotMatch instanceof RegExp && rules.pathMustNotMatch.test(p)) {
    return 'refused-path-shape';
  }

  for (const b of rules.blocked || []) {
    if (p === b || p.startsWith(b + '/') || p.startsWith(b + '.')) return 'non-text-section:' + b;
  }
  // A listing prefix refuses the SECTION ROOT, not the pages beneath it: /fatwa-category is
  // a list, /fatwa/178087/... is an answer. A prefix with nothing after it, or with an
  // explicit pagination segment after it, is the list.
  for (const l of rules.listingTree || []) {
    if (p === l || p === l + '/' || p.startsWith(l + '/')) return 'section-index-tree:' + l;
  }
  for (const l of rules.listing || []) {
    if (p === l || p === l + '/') return 'section-index:' + l;
    if (p.startsWith(l + '/')) {
      const rest = p.slice(l.length + 1).replace(/\/+$/, '');
      // PAGINATION IS `page/N`, NOT A BARE NUMBER. An earlier version treated any all-digit
      // remainder as a page index, and that is wrong far more often than it is right: a bare
      // number after a section is overwhelmingly an ID. MEASURED — it refused
      // tafsir.net/articles/24811 and al-abbaad.com/articles/607420, two real articles, as
      // though they were page 24811 and page 607420 of a listing. Query-string pagination
      // (?page=, ?paged=) is caught by the generic rule below, and /articles/page/2 is caught
      // by the generic 'page' segment, so nothing is lost by tightening this.
      if (!rest || /^page\/\d+$/.test(rest)) return 'section-index:' + l;
    }
  }
  const g = genericListing(target);
  if (g) return g;
  return null;
}

// ── document helpers ─────────────────────────────────────────────────────────
// The text a human would see. linkedom's textContent includes <script> and <style> bodies,
// and on a modern WordPress build that is the MAJORITY of the characters — the measured
// mostafaaladwy fatwa page is 10,180 characters of textContent and 847 characters of
// visible text. Any length threshold applied to the unfiltered value is measuring the
// site's JavaScript.
export function visibleText(doc) {
  if (!doc || !doc.body) return '';
  let out = '';
  try {
    const clone = doc.body.cloneNode(true);
    for (const el of clone.querySelectorAll('script,style,noscript,template,svg')) el.remove();
    out = collapse(stripMarks(clone.textContent));
  } catch {
    out = collapse(stripMarks(doc.body.textContent));
  }
  return out;
}

// Share of the visible text that sits inside anchors. A section index is mostly link text; a
// khutbah is mostly prose. Measured on the live sites: mostafaaladwy /fatwa-category 0.57
// against /fatwa/{id} 0.03.
export function linkDensity(doc) {
  if (!doc || !doc.body) return 1;
  const total = visibleText(doc).length;
  if (!total) return 1;
  let linkChars = 0;
  try {
    for (const a of doc.querySelectorAll('a')) linkChars += collapse(a.textContent).length;
  } catch { return 0; }
  return Math.min(1, linkChars / total);
}
const MAX_LINK_DENSITY = 0.45;

function metaOf(doc, sel, attr) {
  try { const e = doc.querySelector(sel); return e ? collapse(e.getAttribute(attr) || '') : ''; }
  catch { return ''; }
}
function categoriesOf(doc) {
  const out = [];
  try {
    // The standard WordPress category link. Matched on the rel attribute, not on a theme
    // class, so a redesign does not silently disable the reader-submissions refusal.
    for (const a of doc.querySelectorAll('a[rel~="category"], a[rel="category tag"]')) {
      const t = collapse(a.textContent);
      if (t) out.push(t);
    }
  } catch { /* empty */ }
  return out;
}
function linksOf(doc) {
  const out = [];
  try { for (const a of doc.querySelectorAll('a[href]')) out.push(a.getAttribute('href') || ''); }
  catch { /* empty */ }
  return out;
}

// THE LINK THE SITE ITSELF LABELS. Returns the text of the first anchor whose href contains
// `hrefPart` and which sits inside a SHORT element carrying one of `labels`.
//
// This exists because reading a byline out of flat page text does not work: tafsir.net writes
// «<strong>الكاتب:</strong> <a href="/authors/24797">جمال الدين …</a>» and follows it
// immediately with a share toolbar, so a text-window regex captured
// «جمال الدين عبد العزيز الشريف 0 تحميل مشاركة مسح رمز QR» — the author's name with the
// buttons welded on. It is also why this is not "the first /authors/ link on the page": an
// article page also links the authors of every RELATED article in its sidebar.
//
// What it depends on is the site's own visible label sitting beside its own author link —
// not a class name, not an ordering, and not a layout. The element must be short, so a whole
// page section that happens to contain the word cannot masquerade as a byline.
const LABEL_MAX_CHARS = 200;
function labelledLinkText(doc, labels, hrefPart) {
  try {
    for (const a of doc.querySelectorAll('a[href*="' + hrefPart + '"]')) {
      const name = collapse(a.textContent);
      if (!name) continue;
      let el = a.parentElement;
      for (let hop = 0; el && hop < 3; hop++, el = el.parentElement) {
        const t = collapse(el.textContent);
        if (t.length <= LABEL_MAX_CHARS && hasAny(t, labels)) return name;
      }
    }
  } catch { /* empty */ }
  return '';
}

/**
 * THE PAGE GATE.
 *
 * @param {object} ctx
 *   url, finalUrl   the requested and post-redirect URLs
 *   doc             the parsed document
 *   title, text     what the generic pipeline extracted
 *   usedReadability whether `text` came from Readability or from the raw-body fallback
 *   byline          Readability's byline, when it found one
 * @returns {{ok:true, title:string, text:string, author:string, attributionType:string}
 *          |{ok:false, note:string}}
 */
export function gateSourcePage(ctx) {
  const url = String((ctx && ctx.url) || '');
  const finalUrl = String((ctx && ctx.finalUrl) || '') || url;
  const found = rulesFor(finalUrl) || rulesFor(url);
  // No rules for this host: unchanged behaviour, which is what keeps the fifteen
  // pre-existing sources byte-for-byte as they were.
  if (!found) return { ok: true, title: ctx.title, text: ctx.text, author: '', attributionType: '' };

  const { rules } = found;
  const refusal = pathRefusal(url, finalUrl);
  if (refusal) return { ok: false, note: 'BLOCKED (' + refusal + ')' };

  const doc = ctx.doc;
  const pageText = visibleText(doc);

  let title = collapse(ctx.title);
  let text = collapse(ctx.text);

  if (typeof rules.extract === 'function') {
    // A site extractor has already isolated the published answer from the chrome around it,
    // so the link-density heuristic below has nothing left to decide and is skipped. Its
    // job — "is this page a list rather than an answer?" — is answered more directly here:
    // a listing has no answer to extract, so it is refused by the extractor returning null.
    let got = null;
    try { got = rules.extract(doc, pageText); } catch { got = null; }
    if (!got || !collapse(got.text)) return { ok: false, note: 'BLOCKED (no-published-answer)' };
    text = collapse(got.text);
    if (got.title) title = collapse(got.title);
  } else {
    if (!ctx.usedReadability) {
      // Readability failed and there is no site extractor, so the only text we have is the
      // raw body — chrome and all. On a host we have taken responsibility for that is not
      // good enough to hang an attribution on, and an index page that slipped past the path
      // rules is caught here by SHAPE rather than by name.
      if (linkDensity(doc) >= MAX_LINK_DENSITY) {
        return { ok: false, note: 'BLOCKED (index-page-link-density)' };
      }
      text = pageText;
    }
  }

  const minText = rules.minText || 400;
  if (text.length < minText) {
    return { ok: false, note: 'BLOCKED (thin-page ' + text.length + '<' + minText + ')' };
  }

  let author = '';
  let attributionType = '';
  if (typeof rules.attribute === 'function') {
    let who = null;
    try {
      who = rules.attribute({
        url, finalUrl, title, text, pageText,
        byline: (ctx && ctx.byline) || '',
        metaAuthor: metaOf(doc, 'meta[name="author"]', 'content') || metaOf(doc, 'meta[property="article:author"]', 'content'),
        categories: categoriesOf(doc),
        links: linksOf(doc),
        // Read any <meta> the site declares about itself. tafsir.net stamps every node with
        // og:type, which is how an author's biography page is told apart from an article.
        meta: (sel, attr) => metaOf(doc, sel, attr),
        // The anchor a site labels as its own byline. See labelledLinkText above.
        labelledLink: (labels, hrefPart) => labelledLinkText(doc, labels, hrefPart),
      });
    } catch { who = null; }
    if (!who || !collapse(who.author)) {
      return { ok: false, note: 'BLOCKED (attribution-indeterminate)' };
    }
    author = collapse(who.author);
    attributionType = String(who.attributionType || '');
  }

  return { ok: true, title, text, author, attributionType };
}

// Exposed for the gate so the rule table itself can be asserted on, rather than only its
// behaviour. Returns a plain copy; nothing here is live state.
export function ruleDomains() { return Object.keys(RULES).slice(); }
export function ruleFor(domain) {
  const r = RULES[String(domain || '').toLowerCase().replace(/^www\./, '')];
  if (!r) return null;
  return {
    blocked: (r.blocked || []).slice(),
    listing: (r.listing || []).slice(),
    listingTree: (r.listingTree || []).slice(),
    pathMustMatch: r.pathMustMatch instanceof RegExp ? r.pathMustMatch.source : '',
    pathMustNotMatch: r.pathMustNotMatch instanceof RegExp ? r.pathMustNotMatch.source : '',
    minText: r.minText || 400,
    hasExtract: typeof r.extract === 'function',
    hasAttribute: typeof r.attribute === 'function',
  };
}
