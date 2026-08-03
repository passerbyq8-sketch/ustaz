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
const S = (row) => Object.freeze({ ...row, domain: normalizeDomain(row.domain), scopes: Object.freeze(row.scopes) });

export const SOURCES = Object.freeze([
  // ── the fifteen that predate this file. ALL_SCOPES, without exception. ──────
  S({ id: 'islamweb',      name: 'إسلام ويب',                         domain: 'islamweb.net',          kind: 'fatwa-portal',   scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'binbaz',        name: 'موقع الشيخ ابن باز',                 domain: 'binbaz.org.sa',         kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'alukah',        name: 'شبكة الألوكة',                       domain: 'alukah.net',            kind: 'articles',       scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'islamqa',       name: 'الإسلام سؤال وجواب',                 domain: 'islamqa.info',          kind: 'fatwa-portal',   scopes: ALL_SCOPES, bands: ['adult', 'minor'],         status: 'active' }),
  S({ id: 'albarrak',      name: 'موقع الشيخ عبدالرحمن البراك',        domain: 'sh-albarrak.com',       kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'almosleh',      name: 'موقع الشيخ خالد المصلح',             domain: 'almosleh.com',          kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'islamstory',    name: 'قصة الإسلام',                        domain: 'islamstory.com',        kind: 'history',        scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'albadr',        name: 'موقع الشيخ عبدالرزاق البدر',         domain: 'al-badr.net',           kind: 'scholar-lessons', scopes: ALL_SCOPES, bands: ['adult'],                 status: 'active' }),
  S({ id: 'alkhamees',     name: 'موقع الشيخ عثمان الخميس',            domain: 'othmanalkhamees.com',   kind: 'scholar-lessons', scopes: ALL_SCOPES, bands: ['adult'],                 status: 'active' }),
  S({ id: 'iifa',          name: 'مجمع الفقه الإسلامي الدولي',         domain: 'iifa-aifi.org',         kind: 'fiqh-academy',   scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'ferkous',       name: 'موقع الشيخ فركوس',                   domain: 'ferkous.com',           kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active' }),
  S({ id: 'tafsirapp',     name: 'تطبيق التفسير',                      domain: 'tafsir.app',            kind: 'tafsir-aggregator', scopes: ALL_SCOPES, bands: ['adult'],              status: 'active' }),
  S({ id: 'dorar',         name: 'الدرر السنية',                       domain: 'dorar.net',             kind: 'hadith-encyclopedia', scopes: ALL_SCOPES, bands: ['adult', 'minor'],    status: 'active' }),
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
  S({ id: 'ibn-jebreen',   name: 'موقع الشيخ عبدالله بن جبرين',        domain: 'ibn-jebreen.com',       kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active',
      note: 'صفحات الفهارس والمكتبة الصوتية/المرئية لا تصلح بطاقةَ مصدر.' }),

  // #10. Question-and-answer fatwas. MEASURED: the site publishes fatwa pages whose answer
  //      field is EMPTY (e.g. /fatwa/178116), while the raw page still yields thousands of
  //      characters of chrome — so the generic length gate would have accepted a fatwa
  //      nobody answered. The page gate extracts السؤال/الإجابة and refuses an empty answer.
  S({ id: 'mostafa-aladwy', name: 'موقع الشيخ مصطفى العدوي',           domain: 'mostafaaladwy.com',     kind: 'scholar-fatwa',  scopes: ALL_SCOPES, bands: ['adult'],                  status: 'active',
      note: 'يجب إثبات نص الإجابة؛ صفحات الفتاوى بلا جواب منشور تُرفض.' }),

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

export function activeSources() { return SOURCES.filter((s) => s.status === 'active'); }
export function blockedSources() { return SOURCES.filter((s) => s.status === 'blocked'); }
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
  const kept = list.filter((d) => sourceAllowsPurpose(d, purpose));
  // A filter that empties the list would turn a scope rule into an outage. It cannot happen
  // — every pre-existing source carries ALL_SCOPES — but if it ever did, the unfiltered list
  // is a better answer than no answer, and the page gates still apply to whatever comes back.
  return kept.length ? kept : list.slice();
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
const SCHOLAR_SITES = [
  { domain: 'binbaz.org.sa', aliases: ['ابن باز', 'بن باز', 'عبدالعزيز بن باز', 'عبد العزيز بن باز', 'ابن بازز'] },
  { domain: 'sh-albarrak.com', aliases: ['البراك', 'عبدالرحمن البراك', 'عبد الرحمن البراك'] },
  { domain: 'almosleh.com', aliases: ['المصلح', 'خالد المصلح'] },
  { domain: 'al-badr.net', aliases: ['عبدالرزاق البدر', 'عبد الرزاق البدر', 'البدر'] },
  { domain: 'othmanalkhamees.com', aliases: ['عثمان الخميس', 'الخميس'] },
  { domain: 'ferkous.com', aliases: ['فركوس', 'محمد علي فركوس'] },
  { domain: 'saleh.af.org.sa', aliases: ['صالح ال الشيخ', 'صالح آل الشيخ'] },
  { domain: 'ibn-jebreen.com', aliases: ['ابن جبرين', 'بن جبرين', 'عبدالله بن جبرين', 'عبد الله بن جبرين'] },
  { domain: 'mostafaaladwy.com', aliases: ['مصطفى العدوي', 'مصطفي العدوي', 'العدوي'] },
  { domain: 'almunajjid.com', aliases: ['المنجد', 'محمد صالح المنجد', 'محمد المنجد'] },
  { domain: 'al-abbaad.com', aliases: ['عبدالمحسن العباد', 'عبد المحسن العباد', 'العباد'] },
  { domain: 'khaledalsabt.com', aliases: ['خالد السبت', 'السبت'] },
  { domain: 'tafsir.net', aliases: [] },
];
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
