// lib/source-registry.js
// THE SOURCE REGISTRY — one row per approved domain, and the two things a domain alone
// cannot express: WHAT the site publishes, and WHAT it may therefore be cited for.
//
// WHY THIS FILE EXISTS, AND WHY IT IS NOT A SECOND ALLOW-LIST.
// -----------------------------------------------------------
// lib/retrieve.js owns the allow-list. It keeps ONE array per age band driving BOTH the
// Brave `site:` filter AND the post-fetch host enforcement, precisely so query and
// enforcement can never drift. Copying those arrays here would recreate the drift that
// design exists to prevent, so this file holds NO list of its own that retrieval reads.
// What it holds is the METADATA for each domain — scope, kind, publisher — plus the
// normaliser and the duplicate rules. source-registry-guard.cjs asserts set-equality
// between this table and retrieve.js's arrays, so a domain added to one and not the other
// is a failing gate rather than a silent hole.
//
// WHY A SCOPE COLUMN AT ALL. Adding a domain to the allow-list says "this site is
// trustworthy". It does NOT say "this site may answer any question". A khutbah archive is
// a fine source for an exhortation and a terrible one for a ruling on divorce; a tafsir
// site is the right place for the meaning of a verse and the wrong place for a personal
// fatwa. Before this file the app had no way to say that, so a source was either fully
// admitted or absent. `scopes` is that missing sentence, and filterSitesForPurpose() is
// where it takes effect.
//
// THE ONE INVARIANT THAT PROTECTS EVERYTHING THAT WAS ALREADY WORKING: every source that
// predates this file carries ALL_SCOPES. So for any purpose whatsoever, filtering removes
// none of them and the fifteen sources behave exactly as they did. Scope filtering can
// only ever narrow what a NEW source is used for. The gate proves this.

// ── Purposes ─────────────────────────────────────────────────────────────────
// The four kinds of question the retrieval layer distinguishes. lib/source-purpose.js
// decides which one a query is; this file decides which sources each one may reach.
export const PURPOSES = ['fatwa', 'tafsir', 'hadith', 'general'];
export const ALL_SCOPES = Object.freeze(['fatwa', 'tafsir', 'hadith', 'general']);

// ── Domain normalisation ─────────────────────────────────────────────────────
// The duplicate rules in the brief are all about the same site wearing a different string:
// a www. prefix, a scheme, a trailing slash, a capital letter, a port, a trailing dot.
// Every comparison in this file and in the gate runs on the output of this function, so
// "https://WWW.Ibn-Jebreen.com/" and "ibn-jebreen.com" are one domain and cannot occupy
// two rows.
//
// It normalises; it does NOT authorise. HTTPS-only is enforced where it belongs — on the
// fetched URL, in api/ask.js's buildSourceTag and in the live-URL checks — because a
// registry row is a name, not a request.
export function normalizeDomain(input) {
  let s = String(input == null ? '' : input).trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');   // scheme
  s = s.split(/[/?#]/)[0];                         // path, query, fragment
  if (s.includes('@')) s = s.slice(s.lastIndexOf('@') + 1);  // userinfo
  s = s.replace(/:\d+$/, '');                      // port
  s = s.replace(/\.+$/, '');                       // trailing root dot
  s = s.replace(/^www\./, '');                     // the www evasion
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(s)) return '';
  return s;
}

// Is `host` this domain, or a sub-domain of it? Mirrors retrieve.js's hostAllowed() so the
// registry and the hard host gate agree on what "on this site" means.
export function hostMatches(host, domain) {
  const h = normalizeDomain(host);
  const d = normalizeDomain(domain);
  if (!h || !d) return false;
  return h === d || h.endsWith('.' + d);
}

// ── The table ────────────────────────────────────────────────────────────────
// bands   : which age tier's list the domain sits on ('adult', 'minor', 'minor-fallback').
//           MIRRORS retrieve.js; the gate asserts the mirror.
// scopes  : what the source may be cited FOR. Absence of a purpose is a refusal, not a
//           preference — filterSitesForPurpose() drops the domain from the search entirely.
// status  : 'active' = on a production list. 'blocked' = deliberately NOT on any list, with
//           the reason recorded so the decision survives the person who made it.
//
// displayPolicy : 'full' = the reader may be shown the published question and answer in
//           their entirety; 'excerpt' = the reader is shown the carrying spans only, plus a
//           link back. DATA, NOT CODE — no per-site branch exists anywhere on the answer
//           path; every decision reads this column. The default is 'excerpt', so a source
//           added without anyone thinking about this is treated conservatively.
//
// THE TWO REASONS EVERY EXTERNAL LIVE PAGE IS 'excerpt':
//   (1) THE LIVE EXTRACTOR CANNOT ATTEST TO COMPLETENESS. The documented W4 binbaz failure
//       is the proof: that page yielded ZERO <p> elements and byLabels() returned null, so
//       the extractor produced a confident-looking record out of an extraction it had in
//       fact failed at. A pipeline that cannot know whether it got the whole page may not
//       claim «كما نُشرت» over what it did get. Only the fatwa corpus, whose records arrive
//       as structured question/answer fields, can carry that claim — and it does, through
//       sourceKind='corpus' rather than through any row here.
//   (2) REPUBLICATION RESTRAINT. Reproducing somebody else's page in full inside our own
//       answer is a thing to be careful about even where the extraction is sound. Carrying
//       spans plus a working link back is the form that credits the publisher.
const S = (row) => Object.freeze({
  ...row,
  domain: normalizeDomain(row.domain),
  scopes: Object.freeze(row.scopes),
  displayPolicy: row.displayPolicy === 'full' ? 'full' : 'excerpt',
});

export const SOURCES = Object.freeze([
  // ── the fifteen that predate this file. ALL_SCOPES, without exception. ──────
  S({ id: 'islamweb',      name: 'إسلام ويب',                         domain: 'islamweb.net',          kind: 'fatwa-portal',   scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'binbaz',        name: 'موقع الشيخ ابن باز',                 domain: 'binbaz.org.sa',         kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'alukah',        name: 'شبكة الألوكة',                       domain: 'alukah.net',            kind: 'articles',       scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'islamqa',       name: 'الإسلام سؤال وجواب',                 domain: 'islamqa.info',          kind: 'fatwa-portal',   scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'albarrak',      name: 'موقع الشيخ عبدالرحمن البراك',        domain: 'sh-albarrak.com',       kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'almosleh',      name: 'موقع الشيخ خالد المصلح',             domain: 'almosleh.com',          kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'islamstory',    name: 'قصة الإسلام',                        domain: 'islamstory.com',        kind: 'history',        scopes: [], bands: [], status: 'deferred',
      note: 'مؤجَّل بقياس 2026-08-14: أعاد الخادم HTTP 521، فلا صفحة قابلة للاقتباس.' }),
  S({ id: 'albadr',        name: 'موقع الشيخ عبدالرزاق البدر',         domain: 'al-badr.net',           kind: 'scholar-lessons', scopes: [], bands: [], status: 'deferred',
      note: 'مؤجَّل بقياس 2026-08-14: الصفحات أعادت نص واجهة ثابتًا متطابقًا بلا مادة قابلة للاقتباس؛ يحتاج محولًا خاصًّا.' }),
  S({ id: 'alkhamees',     name: 'موقع الشيخ عثمان الخميس',            domain: 'othmanalkhamees.com',   kind: 'scholar-lessons', scopes: [], bands: [], status: 'deferred',
      note: 'مؤجَّل للبحث الحي بقياس 2026-08-14: الاستخراج raw-fallback ولم يُبنَ محدد نص خاص بالموقع. يبقى محتواه المقاس في خدمة الفتاوى فقط.' }),
  S({ id: 'iifa',          name: 'مجمع الفقه الإسلامي الدولي',         domain: 'iifa-aifi.org',         kind: 'fiqh-academy',   scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  // ── THE MOVED DOMAIN ───────────────────────────────────────────────────────
  // MEASURED 2026-08-05: ferkous.com answers 302 -> http://www.ferkous.app/ on every path. The
  // site did not die; it MOVED, and the new name serves the same material and passes the same
  // gates — /home/?q=fatwa-660 extracts 2,144 clean characters titled «في حكم الصُّفرة والكُدرة
  // قبل زمن الحيض وبعده», on the apex and on www, over HTTPS.
  //
  // The row MOVES rather than doubling, and that is not tidiness. The redirect lands on HTTP, and
  // both api/ask.js's buildSourceTag and lib/ledger/canonical.js refuse a non-HTTPS final URL — so
  // a page reached through ferkous.com produces no card even when the fetch succeeds. Searching
  // the name that works is the only version of this that can ever cite anything.
  S({ id: 'ferkous',       name: 'موقع الشيخ فركوس',                   domain: 'ferkous.app',           kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active',
      note: 'النطاق الرسمي بعد انتقال الموقع من ferkous.com (قياس 2026-08-05: تحويل 302 ثم صفحة نظيفة 2144 حرفًا).' }),
  S({ id: 'ferkous-old',   name: 'موقع الشيخ فركوس (النطاق السابق)',    domain: 'ferkous.com',           kind: 'scholar-fatwa',  scopes: [],          bands: [],                         status: 'deferred',
      note: 'مؤجَّل بتاريخ 2026-08-05: النطاق لم يمت بل انتقل — كل مسار يعيد 302 إلى http://www.ferkous.app، والتحويل ينزل على HTTP فتُرفض البطاقة في buildSourceTag و canonical.js. المادّة نفسها تُطلب من ferkous.app.' }),

  // ── DEFERRED: CLIENT-RENDERED, ZERO EXTRACTABLE CHARACTERS ────────────────
  // MEASURED 2026-08-05 through lib/retrieve.js's own fetchAndClean(): HTTP 200 and ~150,000 bytes
  // on /tabari/94/5 and /saadi/94/5, with an EMPTY <body> — Readability extracts 0 characters and
  // the raw fallback extracts 0 too. Even /sitemap.xml returns the same client-rendered shell. The
  // only unrendered surfaces are undeclared internal *.php endpoints, which are neither a declared
  // interface nor a page a reader could open from a source card.
  //
  // Nothing here is broken and nothing is being worked around: the site simply publishes no
  // server-rendered text, so we cannot stand behind a citation to it. tafsir.net — a DIFFERENT
  // organisation, see its own row — carries tafsir.
  S({ id: 'tafsirapp',     name: 'تطبيق التفسير',                      domain: 'tafsir.app',            kind: 'tafsir-aggregator', scopes: [],       bands: [],                         status: 'deferred',
      note: 'مؤجَّل بتاريخ 2026-08-05: الصفحة مُصيَّرة بجافاسكربت — 200 و~150,000 بايت مع <body> فارغ وصفر حرف مستخرَج عبر Readability والاحتياطي معًا. لا مسار معلن بلا تصيير. يحمل التفسيرَ tafsir.net.' }),

  // ── DEFERRED: THE EDGE REFUSES SERVER-SIDE CLIENTS, INCLUDING ITS OWN API ──
  // MEASURED 2026-08-05: HTTP 403 on «/», on «/hadith/search?q=…», on «/feqhia/1», and — the point
  // that settles it — on the documented «/dorar_api.json?skey=…» as well. Every path returns the
  // same ~6,100-byte refusal. There is no officially declared endpoint that serves a server-side
  // client, so the only remaining routes would be impersonating a browser or working round the
  // block, and both are forbidden.
  //
  // WHAT REPLACES IT FOR HADITH. Nothing wholly does, and that is stated rather than glossed:
  // dorar.net was the only hadith-grading encyclopedia on the list. What remains for a hadith
  // question is islamweb.net and islamqa.info (both ALL_SCOPES, both quote takhrij inside their
  // fatwas) and al-abbaad.com (hadith + general). None of them is a grading database. The
  // practical consequence is that a grading now has to be found stated on a fetched page — which
  // is exactly what lib/takhrij-lock.js requires anyway, so an unsupported grade is stripped
  // rather than guessed.
  S({ id: 'dorar',         name: 'الدرر السنية',                       domain: 'dorar.net',             kind: 'hadith-encyclopedia', scopes: [],    bands: [],                         status: 'deferred',
      note: 'مؤجَّل بتاريخ 2026-08-05: HTTP 403 لكل عميل خادميّ على كل مسار جُرِّب، بما فيه واجهته المنشورة /dorar_api.json. لا منفذ رسمي معلن يخدم الخوادم. أُزيل من قائمة القاصر ومن قائمة الكبار.' }),
  S({ id: 'drmutlaq',      name: 'موقع د. مطلق الجاسر',                domain: 'dr-mutlaq.com',         kind: 'articles',       scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),

  // ── #18. NOT NEW. It has been the under-18 fallback tier since before this file, and
  //    the brief's "add it" is therefore a WIDENING, not an insertion: the same single row
  //    now also sits on the adult list. No second row, no second name, no second domain.
  //    awqaf.gov.kw as a whole is deliberately absent — only the eftaa sub-domain is approved.
  //    ALL_SCOPES on purpose: narrowing it would change what a CHILD can reach on the
  //    fallback tier, which this work is not permitted to do. The control the brief actually
  //    asks for here is attribution (committee vs. personal), and that lives in
  //    lib/source-page-gates.js where it can read the page.
  S({ id: 'eftaa-kw',      name: 'إدارة الإفتاء - وزارة الأوقاف الكويتية', domain: 'eftaa.awqaf.gov.kw', kind: 'official-fatwa', scopes: ALL_SCOPES, bands: ['adult', 'minor-fallback'], status: 'active',
      note: 'فتاوى هيئة/لجنة الفتوى تُفصل عن الأجوبة الشخصية للشيخ أحمد الحجي الكردي؛ الصفحة التي لا يُميَّز فيها ذلك تُرفض.' }),

  // ── the new rows ───────────────────────────────────────────────────────────
  // #2. MEASURED 2026-08-03 against the live site: /ar/ftawa and /ar/khotab are lists of
  //     .mp3 files and /ar/books is a list of PDFs — the shaykh's fatwas are AUDIO, and the
  //     site publishes no transcript page for them. Text exists only for the biography and
  //     the news items. So 'fatwa' is WITHHELD: the brief's own rule for this source ("لا
  //     تنسب إليه حكمًا إلا عند استرجاع صفحة نصية مطابقة من موقعه") cannot be satisfied by a
  //     recording, and an audio index is exactly what rule 7 forbids citing. The day a
  //     transcript archive appears, adding 'fatwa' here is the whole change.
  S({ id: 'saleh-alsheikh', name: 'موقع الشيخ صالح آل الشيخ',          domain: 'saleh.af.org.sa',       kind: 'scholar-audio',  scopes: ['general'], bands: ['adult'],                 status: 'active',
      note: 'الفتاوى والخطب صوتية بلا تفريغ؛ لا يُستشهد به في حكم. النص المتاح: السيرة والأخبار.' }),

  // #6. Tafsir, tadabbur and book explanations. Never a personal fatwa or a nāzilah —
  //     the brief is explicit, and the site itself publishes no fatwa section.
  S({ id: 'khaled-alsabt', name: 'موقع الشيخ خالد السبت',              domain: 'khaledalsabt.com',      kind: 'tafsir',         scopes: ['tafsir', 'general'], bands: ['adult'],       status: 'active',
      note: 'تفسير وتدبر وشروح إيمانية فقط؛ ممنوع كمصدر لفتوى شخصية أو حكم نازلة.' }),

  // #7. The shaykh's text library. Its /textlibrary, /indexs, /soundlibrary and
  //     /videolibrary paths are catalogues, not answers, and are refused in the page gates.
  S({ id: 'ibn-jebreen',   name: 'موقع الشيخ عبدالله بن جبرين',        domain: 'ibn-jebreen.com',       kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active',
      note: 'صفحات الفهارس والمكتبة الصوتية/المرئية لا تصلح بطاقةَ مصدر.' }),

  // #10. Question-and-answer fatwas. MEASURED: the site publishes fatwa pages whose answer
  //      field is EMPTY (e.g. /fatwa/178116), while the raw page still yields thousands of
  //      characters of chrome — so the generic length gate would have accepted a fatwa
  //      nobody answered. The page gate extracts السؤال/الإجابة and refuses an empty answer.
  //      قرار ١٠, MEASURED 2026-08-08: the site prints «السؤال» and «الإجابة» headings, but the
  //      answer under the second one is a YouTube <iframe> with an EMPTY text div. There is no
  //      written answer on the page at all. A naive extractor therefore returns the site FOOTER
  //      — exactly 360 characters, byte-identical on every fatwa («شارك الفتوى / عن الموقع /
  //      روابط سريعة») — and that constant length is the tell. The declared `minText: 20` (which
  //      is correct for the handful of genuinely short written fatwas) lets those 360 characters
  //      of chrome through, so the shaykh's navigation menu could become the evidence behind a
  //      ruling attributed to him. `answer_format` says the answer is not text, so the page is
  //      never asked to be evidence.
  S({ id: 'mostafa-aladwy', name: 'موقع الشيخ مصطفى العدوي',           domain: 'mostafaaladwy.com',     kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active',
      answer_format: 'video',
      note: 'الجواب مقطع مرئي لا نصّ؛ تُعطى بطاقةً ولا تدخل أدلّة النصّ.' }),

  // #11. Articles, books, lessons and khutbahs attributed to the shaykh. NOT a fatwa source:
  //      the brief says so in as many words, and islamqa.info — which is his — is already on
  //      the list and is the fatwa corpus. A page here that reprints someone else's material
  //      is refused rather than misattributed (see the page gates).
  S({ id: 'almunajjid',    name: 'موقع الشيخ محمد صالح المنجد',        domain: 'almunajjid.com',        kind: 'scholar-lessons', scopes: ['general'], bands: ['adult'],                status: 'active',
      note: 'ليس كل محتواه فتوى؛ لا يُستعمل مصدرَ فتوى، ولا يُكرَّر معه islamqa.info.' }),

  // #28. Khutbahs, exhortations and educational material. Never a fatwa, never a decisive
  //      fiqh choice. Its /forums/ tree is user discussion and is refused outright.
  S({ id: 'khutabaa',      name: 'ملتقى الخطباء',                      domain: 'khutabaa.com',          kind: 'khutbah',        scopes: ['general'], bands: ['adult'],                  status: 'active',
      note: 'خطب ومواعظ فقط؛ ممنوع إصدار فتوى أو نسبة اختيار فقهي حاسم، ولا تُقبل مشاركات الملتقيات.' }),

  // ── Tafsir Center. NOT a duplicate of tafsir.app, and the distinction is the whole reason
  //    this row exists as its own entry. tafsir.app is «الباحث القرآني» — an aggregator that
  //    reprints ~50 classical tafsir books at /{book}/{surah}/{ayah}. tafsir.net is «مركز
  //    تفسير للدراسات القرآنية», a research centre publishing ORIGINAL articles and studies by
  //    named researchers at /articles/{id} and /researchs/{id}. Different organisation,
  //    different domain, different material, and neither is reachable from the other. The gate
  //    asserts both rows exist independently so this can never be "tidied up" into one.
  //
  //    MEASURED 2026-08-03: Drupal 10, server-rendered, ~39,000 characters of clean article
  //    text at link density 0.04. Its robots.txt states in as many words that AI retrieval
  //    bots are welcome («تُسمح بالكامل — الموقع معرفي وقيمته في الظهور والاستشهاد»), and
  //    disallows /search, /admin and /user — all of which the page gate refuses anyway.
  //
  //    NO FATWA, NO HADITH GRADING. It is a Quranic-studies centre; a ruling on a personal
  //    matter and a hadith takhrij are both somebody else's job.
  S({ id: 'tafsir-center', name: 'مركز تفسير للدراسات القرآنية',      domain: 'tafsir.net',            kind: 'quran-research', scopes: ['tafsir', 'general'], bands: ['adult'],        status: 'active',
      note: 'مقالات وبحوث قرآنية أصلية بمؤلفين معلومين؛ ليس مصدرًا لفتوى ولا لتخريج حديث، ولا يُخلط بـ tafsir.app.' }),

  // ── The shaykh's own articles. Admitted for what the prototype actually proved: single
  //    article pages at /articles/{id} extract clean (measured 3,446 and 443 characters at
  //    link density 0.15), while /lecture/** and /books/** are catalogues whose "text" is the
  //    navigation. Sound recordings carry no transcript, so nothing under them can be cited.
  //
  //    hadith + general ONLY. He is a muhaddith and his site's substance is hadith and its
  //    explanation; a personal fatwa and a tafsir ruling are outside what these pages
  //    establish, and the brief withholds both for now.
  S({ id: 'al-abbaad',     name: 'الموقع الرسمي للشيخ عبدالمحسن العباد', domain: 'al-abbaad.com',       kind: 'scholar-articles', scopes: ['hadith', 'general'], bands: ['adult'],      status: 'active',
      note: 'صفحات المقالات المفردة فقط؛ الفهارس والدروس والصوتيات بلا تفريغ مرفوضة، ولا يُستعمل مصدرَ فتوى شخصية ولا تفسير.' }),

  // #29. Creedal and intellectual research, replies to shubuhāt, sects and religions. Not a
  //      source for a personal ruling in worship, family or nāzilah. Its «مشاركات القرّاء»
  //      category is reader-submitted and is refused by the page gate reading the site's own
  //      category badge.
  S({ id: 'salafcenter',   name: 'مركز سلف للبحوث والدراسات',          domain: 'salafcenter.org',       kind: 'research',       scopes: ['general'], bands: ['adult'],                  status: 'active',
      note: 'بحوث عقدية وفكرية؛ ممنوع كمصدر لفتوى شخصية في العبادات أو الأسرة أو النوازل، ويُستبعد قسم مشاركات القرّاء.' }),

  // ── #4. DECLARED AND DELIBERATELY NOT ADMITTED ─────────────────────────────
  // MEASURED 2026-08-03: shkhudheir.com is a PARKED DOMAIN. Every path — /, /ar, /fatwa/1 —
  // returns the same 114-byte stub whose whole body is
  //     <script>window.onload=function(){window.location.href="/lander"}</script>
  // and /lander is a GoDaddy parking page (window._trfd.push({ap:"parking"}), assets from
  // img1.wsimg.com/parking-lander/). Its sitemap.xml declares exactly one URL: /lander.
  // There is no fatwa, no question number, no shaykh, and no content of any kind.
  //
  // Admitting it would not be adding a weak source; it would be handing whoever holds the
  // domain the ability to have arbitrary text cited as Shaykh al-Khudayr's fatwa. The row is
  // kept, with the evidence, so the decision is visible and so re-admitting it the day the
  // site returns is a one-word change — and so the gate can PROVE it is on no list.
  S({ id: 'khudheir',      name: 'موقع الشيخ عبدالكريم الخضير',        domain: 'shkhudheir.com',        kind: 'scholar-fatwa',  scopes: [],          bands: [],                         status: 'blocked',
      note: 'نطاق متوقف/مركون (GoDaddy parking) بتاريخ 2026-08-03: كل المسارات تعيد صفحة تحويل إلى /lander ولا يوجد أي نص. لا يُضاف حتى يعود الموقع.' }),

  // ── THE WORLD SOURCES (2026-08-05) ─────────────────────────────────────────
  //
  // `status: 'world'` IS A THIRD STATUS, AND IT IS THE WHOLE DESIGN. Until now a row was
  // either 'active' — meaning "on a production RELIGIOUS list" — or 'blocked'. These four are
  // neither: they are on a production list, and it is not a religious one. Giving them
  // 'active' would have been a lie with consequences, because 'active' is what four different
  // consumers read as "may serve religious material":
  //
  //   * activeSources() feeds domainsForBand(), which source-registry-guard asserts is
  //     set-equal to lib/retrieve.js's three age-band arrays — so an 'active' news row would
  //     have to appear in a CHILD'S or an adult's Islamic allow-list to keep that gate green;
  //   * lib/ledger/source-policy.js's conformance rule is that the ledger engine's searchable
  //     set IS the registry's active set, so 'active' would have silently enrolled four news
  //     domains in the religious retrieval engine;
  //   * sourceAllowsPurpose() returns false for any row whose status is not 'active', which is
  //     precisely the answer wanted here;
  //   * resolveScholar() refuses to resolve a name to a non-'active' row, so no news domain
  //     can ever become the target of a "search his own site" pass.
  //
  // So the status alone forbids every religious use, and `scopes: []` says the same thing a
  // second time in the field designed for it. Two independent statements, on purpose, because
  // one of them is what a future edit is most likely to touch.
  //
  // WHAT THEY MAY BE CITED FOR is therefore nothing religious at all: a report of what a news
  // organisation or an encyclopedia published, and api/ask.js's world branch forbids deriving
  // any ruling from them in as many words.
  S({ id: 'ar-wikipedia',  name: 'ويكيبيديا العربية',                  domain: 'ar.wikipedia.org',      kind: 'encyclopedia',   scopes: [],          bands: ['world'],                  status: 'world',
      note: 'مصدر عام للمعرفة الموسوعية فقط؛ ممنوع أن يُبنى عليه حكم شرعي أو ديني. المقالات فقط (/wiki/{عنوان})؛ صفحات التصنيفات والبوابات والنقاش مرفوضة في lib/source-page-gates.js.' }),
  S({ id: 'aljazeera',     name: 'الجزيرة نت',                         domain: 'aljazeera.net',         kind: 'news',           scopes: [],          bands: ['world'],                  status: 'world',
      note: 'مصدر إخباري عام؛ ممنوع أن يُبنى عليه حكم شرعي أو فتوى. تُقبل صفحات الأخبار المؤرّخة وحدها (/{قسم}/{سنة}/{شهر}/{يوم}/{عنوان}).' }),
  // bbc.com is ONE domain carrying dozens of language services. The row is for the ARABIC
  // service; the restriction is enforced on the path, where it can be, and is measured: the
  // English bbc.com/news front page extracts 7,718 clean characters and is refused by URL.
  S({ id: 'bbc-arabic',    name: 'بي بي سي عربي',                      domain: 'bbc.com',               kind: 'news',           scopes: [],          bands: ['world'],                  status: 'world',
      note: 'الخدمة العربية وحدها: /arabic/articles/{id}. أيّ مسار آخر على bbc.com — بما فيه النسخة الإنجليزية — مرفوض من الرابط قبل الجلب. ممنوع أن يُبنى عليه حكم شرعي.' }),
  S({ id: 'skynewsarabia', name: 'سكاي نيوز عربية',                    domain: 'skynewsarabia.com',     kind: 'news',           scopes: [],          bands: ['world'],                  status: 'world',
      note: 'مصدر إخباري عام؛ ممنوع أن يُبنى عليه حكم شرعي. تُقبل صفحات الخبر وحدها (/{قسم}/{رقم}-{عنوان})، وصفحات الأقسام مرفوضة.' }),

  // ── NAMED IN THE BRIEF AND DELIBERATELY NOT ADMITTED ───────────────────────
  // MEASURED 2026-08-05 with this app's production header set: alarabiya.net answers a
  // server-side client with HTTP 403 and a Cloudflare interstitial titled «تم رفض الوصول» on
  // EVERY path tried — /, /arab-and-world/, /aswaq/, and /sitemap.xml. Response headers say
  // `server: cloudflare`; the body is a 179 KB access-denied page, not an article.
  //
  // This is the dorar.net failure mode, and this app already knows what it costs: the first
  // fetch trips the host circuit breaker, and until it does, every news question pays for a
  // site-scoped search and a guaranteed-dead fetch. A source that can never produce a card is
  // only a detour. The row is kept, with its evidence, so the refusal is visible, so the gate
  // can prove it is on no list, and so admitting it the day access is granted is one line.
  S({ id: 'alarabiya',     name: 'العربية نت',                         domain: 'alarabiya.net',         kind: 'news',           scopes: [],          bands: [],                         status: 'blocked',
      note: 'محجوب أمام العملاء الخادميّين بتاريخ 2026-08-05: كل المسارات تعيد HTTP 403 وصفحة Cloudflare بعنوان «تم رفض الوصول»، ولا يُستخرج منها نصُّ خبرٍ البتّة. لا يُضاف حتى يُسمح بالوصول.' }),
]);

// ── Lookups ──────────────────────────────────────────────────────────────────
const BY_DOMAIN = new Map(SOURCES.map((s) => [s.domain, s]));

export function findSource(hostOrUrl) {
  const h = normalizeDomain(hostOrUrl);
  if (!h) return null;
  const exact = BY_DOMAIN.get(h);
  if (exact) return exact;
  // a sub-domain of an approved domain resolves to that domain's row
  for (const s of SOURCES) if (hostMatches(h, s.domain)) return s;
  return null;
}

// ── HOW MUCH OF THIS RECORD MAY THE READER BE SHOWN? ─────────────────────────
// The ONE place the answer path asks that question. It reads the registry column above and
// the record's own sourceKind; it contains no site names and no topic names, so a new source
// changes behaviour by adding a row, never by adding a branch here.
//
//   sourceKind='corpus'  → 'full'    the fatwa service hands over structured question and
//                                    answer fields, so completeness is a fact it can assert.
//   sourceKind='live'    → registry  an approved external page: whatever its row declares,
//                                    which is 'excerpt' for every row today.
//   anything else        → 'excerpt' unknown provenance is the conservative case by default.
export const DISPLAY_POLICIES = Object.freeze(['full', 'excerpt']);

export function displayPolicyFor(sourceKind, hostOrUrl = '') {
  if (sourceKind === 'corpus') return 'full';
  if (sourceKind !== 'live') return 'excerpt';
  const row = findSource(hostOrUrl);
  return row && row.displayPolicy === 'full' ? 'full' : 'excerpt';
}

// ── IN WHAT FORM DOES THIS DOMAIN PUBLISH ITS ANSWER? (قرار ١٠) ──────────────
// Default 'text', declared only by the domains where it is NOT text. This is a statement about
// the SITE, not about any one page, which is why it belongs beside the domain rather than in a
// per-page gate: mostafaaladwy.com answers in video on every fatwa it publishes, so there is no
// page-shaped question to ask.
//
// The distinction it draws is between a page that HAS no written answer and a page whose written
// answer we failed to extract. lib/source-page-gates.js answers the second; only the registry can
// answer the first, and confusing them is how a site footer becomes a fatwa.
export function answerFormatFor(hostOrUrl) {
  const s = findSource(hostOrUrl);
  return (s && s.answer_format) || 'text';
}

/** Does this domain answer in video, so that its pages are a CARD and never evidence text? */
export function isVideoAnswerDomain(hostOrUrl) {
  return answerFormatFor(hostOrUrl) === 'video';
}

// 'active' means ACTIVE FOR RELIGIOUS RETRIEVAL, and every caller of this function reads it
// that way: the age-band mirror, the ledger's searchable set, the scope filter and the scholar
// resolver. World sources are deliberately NOT here — see worldSources() below.
export function activeSources() { return SOURCES.filter((s) => s.status === 'active'); }
export function blockedSources() { return SOURCES.filter((s) => s.status === 'blocked'); }
// The world list's rows. Kept in the SAME table, so findSource() resolves a fetched news host
// to a row that says in three ways what it may not do, and so duplicateProblems() polices the
// world domains against the religious ones — a domain cannot occupy both a religious row and a
// world row, because it cannot occupy two rows at all.
export function worldSources() { return SOURCES.filter((s) => s.status === 'world'); }
export function domainsForWorld() { return worldSources().map((s) => s.domain); }
export function domainsForBand(band) {
  return activeSources().filter((s) => s.bands.includes(band)).map((s) => s.domain);
}

// ── Scope ────────────────────────────────────────────────────────────────────
// An UNKNOWN domain is allowed through unchanged. That is deliberate and it is the
// fail-safe direction: this function's only job is to enforce a restriction somebody wrote
// down, and a domain with no row has no restriction to enforce. The host allow-list in
// retrieve.js — not this function — is what keeps unvetted domains out.
export function sourceAllowsPurpose(hostOrUrl, purpose) {
  const s = findSource(hostOrUrl);
  if (!s) return true;
  if (s.status !== 'active') return false;         // a blocked row may never serve anything
  if (!purpose || !PURPOSES.includes(purpose)) return true;
  return s.scopes.includes(purpose);
}

// Narrow a band's site list to those whose declared scope covers this purpose.
// Order is preserved, so the Brave query for an unrestricted purpose is byte-identical to
// what it was. Returns a NEW array; the caller's list object is never mutated.
export function filterSitesForPurpose(sites, purpose) {
  const list = Array.isArray(sites) ? sites : [];
  if (!purpose || !PURPOSES.includes(purpose)) return list.slice();
  // ── AN EMPTY LIST AFTER FILTERING STAYS EMPTY ──────────────────────────────
  //
  // This used to fall back to the UNFILTERED list, on the reasoning that a filter emptying the
  // list "cannot happen" and that some answer beats none. Both halves were wrong.
  //
  // MEASURED: filterSitesForPurpose(SITES_GENERAL, 'fatwa') returned all four news domains. Every
  // one of them carries `scopes: []` for exactly one reason — so that a news page can never be the
  // evidence behind a religious ruling — and the fallback handed back precisely the four the rule
  // had just refused. A safety valve that returns what the rule forbids is not a safety valve; it
  // is the rule with an exception nobody declared.
  //
  // And "some answer beats none" is the wrong trade here. An empty list produces no search and no
  // source, and the caller then refuses to answer — which is the honest outcome when no admitted
  // source may speak to this purpose. The alternative is a ruling backed by a page that was
  // admitted for something else.
  return list.filter((d) => sourceAllowsPurpose(d, purpose));
}

// ── Duplicate rules ──────────────────────────────────────────────────────────
// The brief's four failure modes, each returned as a string so the gate can print it:
//   * the same domain twice;
//   * one site under two different ids or two different names;
//   * a row whose domain still carries www. (the evasion the normaliser exists to fold);
//   * a row that is a sub-domain of another row, which would let one site occupy two slots.
export function duplicateProblems() {
  const problems = [];
  const byDomain = new Map();
  const byName = new Map();
  const byId = new Map();
  for (const s of SOURCES) {
    if (!s.domain) { problems.push('unparseable domain in row ' + s.id); continue; }
    if (byDomain.has(s.domain)) problems.push('duplicate domain: ' + s.domain + ' (' + byDomain.get(s.domain) + ' and ' + s.id + ')');
    else byDomain.set(s.domain, s.id);
    if (byId.has(s.id)) problems.push('duplicate id: ' + s.id);
    else byId.set(s.id, s.domain);
    const n = String(s.name || '').replace(/\s+/g, ' ').trim();
    if (byName.has(n)) problems.push('same source under two names/rows: "' + n + '" (' + byName.get(n) + ' and ' + s.domain + ')');
    else byName.set(n, s.domain);
  }
  for (const s of SOURCES) {
    for (const t of SOURCES) {
      if (s === t || !s.domain || !t.domain) continue;
      if (s.domain.endsWith('.' + t.domain)) {
        problems.push('nested domain: ' + s.domain + ' is already covered by ' + t.domain);
      }
    }
  }
  return problems;
}

// ── Whose site is this? ──────────────────────────────────────────────────────
// A named scholar has to be resolvable to the domain that publishes him, or "search his
// official site first" is a sentence with nowhere to go. The mapping lives HERE rather than
// in a second table because the rows already carry the site's identity — this only names the
// man the row is about, in the spellings a reader actually types.
//
// A row appearing here does NOT create an attributed adapter and does NOT widen any scope.
// It answers one question: if the reader asked about this shaykh, which approved domain is
// his? The page gates and the scope rules then apply exactly as they do to any other page.
// EXPORTED so a gate can compare it against lib/ledger/source-policy.js. The two tables answer
// halves of one question — "who owns this domain" and "which domain is this shaykh's" — and a
// name present in one and missing from the other is a scholar the app can search for and cannot
// recognise. That drift is invisible from either file alone, which is why it went unnoticed for
// ابن عثيمين and مطلق الجاسر.
export const SCHOLAR_SITES = [
  { domain: 'binbaz.org.sa', aliases: ['ابن باز', 'بن باز', 'عبدالعزيز بن باز', 'عبد العزيز بن باز', 'ابن بازز'] },
  { domain: 'sh-albarrak.com', aliases: ['البراك', 'عبدالرحمن البراك', 'عبد الرحمن البراك'] },
  { domain: 'almosleh.com', aliases: ['المصلح', 'خالد المصلح'] },
  { domain: 'al-badr.net', aliases: ['عبدالرزاق البدر', 'عبد الرزاق البدر', 'البدر'] },
  { domain: 'othmanalkhamees.com', aliases: ['عثمان الخميس', 'الخميس'] },
  // ferkous.APP, not .com. The reader who names the shaykh must be sent to the domain that
  // actually serves his fatwas; resolving to the deferred name would scope a search to a row that
  // may not be searched, and the scoped pass would come back empty for a site that is perfectly
  // alive under its new name.
  { domain: 'ferkous.app', aliases: ['فركوس', 'محمد علي فركوس'] },
  { domain: 'saleh.af.org.sa', aliases: ['صالح ال الشيخ', 'صالح آل الشيخ'] },
  { domain: 'ibn-jebreen.com', aliases: ['ابن جبرين', 'بن جبرين', 'عبدالله بن جبرين', 'عبد الله بن جبرين'] },
  { domain: 'mostafaaladwy.com', aliases: ['مصطفى العدوي', 'مصطفي العدوي', 'العدوي'] },
  { domain: 'almunajjid.com', aliases: ['المنجد', 'محمد صالح المنجد', 'محمد المنجد'] },
  { domain: 'al-abbaad.com', aliases: ['عبدالمحسن العباد', 'عبد المحسن العباد', 'العباد'] },
  { domain: 'khaledalsabt.com', aliases: ['خالد السبت', 'السبت'] },
  // ── THE TWO THAT WERE SEARCHABLE BUT NOT RECOGNISABLE ────────────────────
  //
  // Both owners are in lib/ledger/source-policy.js with a live scope, and neither had a row here.
  // The effect was measurable and one-sided: the app could FETCH their pages and could not
  // understand a reader who named them. «ما رأي الشيخ مطلق الجاسر…» resolved to nobody, which
  // before this batch meant the identity template — a request for the official website of a man
  // whose official website we were already indexing.
  //
  // ابن عثيمين is the odder case: his corpus is reached by a purpose-built adapter
  // (lib/binothaimeen.js), so binothaimeen.net is deliberately NOT a searchable source and has no
  // SOURCES row. That made him unresolvable here while being the one scholar with the richest
  // access of all. The `hasAdapter` allowance below is what reconciles those two facts.
  { domain: 'binothaimeen.net', aliases: [
    'ابن عثيمين', 'بن عثيمين', 'العثيمين', 'عثيمين', 'ابن العثيمين',
    'محمد بن صالح العثيمين', 'محمد العثيمين', 'الشيخ ابن عثيمين', 'الشيخ العثيمين',
  ] },
  // The six spellings lib/source-intent.js already routes on, so a reader who is understood by
  // the intent layer is understood by the registry too.
  { domain: 'dr-mutlaq.com', aliases: [
    'مطلق الجاسر', 'د مطلق', 'الشيخ مطلق', 'دكتور مطلق', 'مطلق جاسر', 'الجاسر',
  ] },
  { domain: 'tafsir.net', aliases: [] },
];

// A domain whose corpus is reached by a purpose-built adapter rather than by search. It has no
// SOURCES row on purpose — it must never enter a band's search list — but it IS a real corpus,
// so a reader who names its scholar has named somebody we can actually consult.
const ADAPTER_DOMAINS = new Set(['binothaimeen.net']);
const foldName = (s) => String(s == null ? '' : s)
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[آأإٱ]/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ').trim();

// Whole-word containment: is `alias` present in `name` as a run of complete words?
// «عبدالمحسن العباد» contains «العباد» as a word and matches; «العبادات» does not, because the
// run does not end at a word boundary.
function containsWords(nameWords, aliasWords) {
  if (!aliasWords.length || aliasWords.length > nameWords.length) return false;
  for (let i = 0; i + aliasWords.length <= nameWords.length; i++) {
    let hit = true;
    for (let k = 0; k < aliasWords.length; k++) {
      if (nameWords[i + k] !== aliasWords[k]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

// An alias that is ONE common word is not an identification. «عبدالله» is the given name of a
// dozen scholars and «الشيخ عبدالله» identifies none of them; resolving it would pick whoever
// happens to sit first in the table. Such an alias may only match when the reader's name is
// exactly it AND nothing else matches — and the uniqueness rule below is what decides that.
const MIN_ALIAS_WORDS_FOR_PARTIAL = 2;

/**
 * Resolve a scholar's name to the approved domain that publishes him.
 *
 * SUBSTRING MATCHING IS GONE, AND THAT WAS NOT A STYLE CHOICE. The first version accepted
 * `n.includes(f) || f.includes(n)`, which resolves on any shared fragment in either
 * direction: a reader's «عبدالله» matched «عبدالله بن جبرين», and a bare «العباد» would match
 * as happily inside an unrelated word. Worse, it returned the FIRST row that matched, so an
 * ambiguous name silently became one specific scholar — the exact shape of fabrication this
 * area exists to prevent, arriving through the door marked "convenience".
 *
 * Now: every alias is compared as WHOLE WORDS, every candidate is collected before anything
 * is returned, and a domain comes back ONLY when exactly one scholar matches.
 *
 * @returns {{status:'resolved', domain:string, source:object}
 *          |{status:'ambiguous', candidates:string[]}
 *          |{status:'unresolved'}}
 */
export function resolveScholar(nameRaw) {
  const n = foldName(nameRaw);
  if (!n || n.length < 3) return { status: 'unresolved' };
  const nameWords = n.split(' ').filter(Boolean);

  const hits = new Set();
  for (const row of SCHOLAR_SITES) {
    for (const a of row.aliases) {
      const f = foldName(a);
      if (!f) continue;
      const aliasWords = f.split(' ').filter(Boolean);
      // (a) the reader wrote the alias exactly, or
      // (b) the alias appears in the reader's name as whole words — but a one-word alias is
      //     too weak to identify anybody unless it IS the whole name.
      const exact = n === f;
      const partial = aliasWords.length >= MIN_ALIAS_WORDS_FOR_PARTIAL
        && containsWords(nameWords, aliasWords);
      // A one-word alias still resolves when the reader typed exactly that one word AND it is
      // unique across the table — «فركوس» identifies a man; «عبدالله» does not, and the
      // uniqueness test below is what tells them apart without a special case for either.
      if (exact || partial) { hits.add(row.domain); break; }
    }
  }

  if (hits.size === 0) return { status: 'unresolved' };
  if (hits.size > 1) return { status: 'ambiguous', candidates: Array.from(hits) };

  const domain = Array.from(hits)[0];
  const src = findSource(domain);
  // AN ADAPTER-BACKED DOMAIN IS AN ANSWER, AND IT IS STILL NOT A SEARCH TARGET. The rule below
  // exists so a blocked or unlisted row can never be searched — and it stays exactly that strict,
  // because a domain admitted here is admitted to `onlySites`, which lib/retrieve.js checks
  // against the band's list before spending anything. binothaimeen.net is on no band's list and
  // never will be; it is reached through lib/binothaimeen.js. So recognising the man costs nothing
  // and refusing to recognise him cost him the identity template.
  if (ADAPTER_DOMAINS.has(domain)) return { status: 'resolved', domain, source: src || null, viaAdapter: true };
  // A blocked or unlisted row is not an answer: it must never become a search target.
  if (!src || src.status !== 'active') return { status: 'unresolved' };
  return { status: 'resolved', domain, source: src };
}

// Convenience wrapper for callers that only want the domain. Returns null for BOTH
// 'unresolved' and 'ambiguous' — deliberately, so a caller that ignores the distinction
// cannot accidentally treat a guess as an identification.
export function findScholarDomain(nameRaw) {
  const r = resolveScholar(nameRaw);
  return r.status === 'resolved' ? { domain: r.domain, source: r.source } : null;
}

// ── Ordering for a purpose ───────────────────────────────────────────────────
// ORDER, NEVER SELECTION. lib/brave-query.js splits the allow-list into groups small enough
// for the provider to accept, and this decides WHICH sources land in group 1 — so a tafsir
// question meets the tafsir sites on the first request and the second is usually never made.
//
// It returns a PERMUTATION of its input: same length, same members. Nothing is dropped here,
// because dropping is scope filtering's job and it has already happened by this point.
// brave-query-guard.cjs asserts the permutation property directly.
const KIND_FOR_PURPOSE = {
  fatwa: ['fatwa-portal', 'official-fatwa', 'scholar-fatwa', 'fiqh-academy'],
  tafsir: ['tafsir', 'tafsir-aggregator', 'quran-research'],
  hadith: ['hadith-encyclopedia', 'scholar-articles', 'scholar-lessons'],
  general: ['articles', 'research', 'history', 'khutbah'],
};
export function rankForPurpose(domains, purpose) {
  const list = (Array.isArray(domains) ? domains : []).filter(Boolean);
  if (!purpose || !PURPOSES.includes(purpose)) return list.slice();
  const preferred = KIND_FOR_PURPOSE[purpose] || [];
  const tier = (d) => {
    const s = findSource(d);
    if (!s) return 2;                                  // unknown: middle, never last
    if (preferred.includes(s.kind)) return 0;          // this purpose IS what the site does
    return 1;
  };
  // A stable sort keeps the shipped order inside each tier, so the list a reader's question
  // meets first is still the vetted order it has always been, merely re-grouped.
  return list
    .map((d, i) => ({ d, i, t: tier(d) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.d);
}

// Would adding `candidate` duplicate something already in the table? The gate uses this to
// prove that a proposed source is genuinely new, and api-side callers can use it before
// widening a list. Returns the existing row, or null.
export function existingSourceFor(candidate) {
  const d = normalizeDomain(candidate);
  if (!d) return null;
  return findSource(d);
}
