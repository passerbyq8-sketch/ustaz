// guards/identity-guard.cjs — WHO IS THE PERSON IN THE QUESTION, AND WHAT MAY BE SAID ABOUT HIM.
//
// ── THE MEASURED DEFECT (قرار ٣) ─────────────────────────────────────────────
// «ماقول عبدالله الرويشد في أحكام العقيقه» — the reader named a Kuwaiti SINGER, and the reply
// discussed «الشيخ عبدالله الرويشد». Every stage behaved correctly: the name was unregistered,
// the question was a ruling question, the ruling was sound. The PREMISE was false and no stage
// owned the question of whether it was true.
//
// ── WHAT THIS GATE PINS ──────────────────────────────────────────────────────
// A) The whitelist is DERIVED from lib/source-registry.js, not retyped, so it cannot drift from
//    the table the search path already depends on.
// B) The cascade's verdicts on the five measured fixtures.
// C) The rule that decides every ambiguous case: «الأصلُ في الأسماءِ الجهلُ حتى يثبتَ العلم» —
//    unknown is the DEFAULT, and «scholar» is never a fallback.
// D) The fact block's four branches, including the two things it must never print.
// E) قرار ٤: ar.wikipedia.org is fetchable through the existing safe path and is eligible to
//    back NOTHING.
//
// ── SEALED AGAINST THE NETWORK AND AGAINST THE MODEL (درسُ rfcwiring) ────────
// Every external effect in lib/identity/index.js is an injected parameter, so this gate drives
// the whole cascade with fixtures. `globalThis.fetch` is replaced with a throwing stub for the
// duration: if any code path reaches for the network, this gate fails rather than passing slowly.
// There is no model anywhere in the identity path, and section F proves it.
//
// Usage: node guards/identity-guard.cjs
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const eq = (name, actual, expected) =>
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + '\n        actual   ' + JSON.stringify(actual));
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── THE FIXTURES ─────────────────────────────────────────────────────────────
// Saved page text, not fetched. Each one is the shape ar.wikipedia.org actually serves: a lead
// sentence that DEFINES the person before it starts on the biography.
const PAGES = {
  'عبدالله الرويشد': 'عبد الله الرويشد مطرب وملحن كويتي من مواليد 1961. يعد من أبرز الأصوات الخليجية.',
  'طارق العلي': 'طارق العلي ممثل ومسرحي كويتي من مواليد 1967. اشتهر بأعماله الكوميدية.',
  'محمد حسان': 'محمد حسان داعية إسلامي مصري. له دروس ومحاضرات منتشرة.',
  // A disambiguation page: several people, no one description.
  'الهاشمي': 'الهاشمي قد يقصد به عدة أشخاص. صفحة توضيح تسرد المقالات التي تحمل هذا العنوان.',
};

(async function main() {
  console.log('=== identity-guard — a name is unknown until a source says otherwise ===');

  const realFetch = globalThis.fetch;
  let safeFetchModule = null;
  // NOTHING IN THIS GATE MAY TOUCH THE NETWORK. A reach is a failure, not a slow pass.
  let reachedNetwork = 0;
  globalThis.fetch = async (u) => { reachedNetwork++; throw new Error('network reached: ' + u); };

  try {
    const ID = await esm('lib/identity/index.js');
    const WL = await esm('lib/identity/whitelist.js');
    const REG = await esm('lib/source-registry.js');
    // Driven sections below replace fetch with fixtures and must not depend on the host
    // machine's DNS. Keep the real preflight code in the path, but resolve every admitted
    // fixture host to a known public address through the existing test seam.
    safeFetchModule = await esm('lib/ledger/safe-fetch.js');
    safeFetchModule.__setResolverForTest(async () => [{ address: '8.8.8.8', family: 4 }]);

    // The injected page fetcher. Returns a fixture or null — never a request.
    const fetchPage = async (url) => {
      for (const [name, text] of Object.entries(PAGES)) {
        if (url === ID.wikipediaUrlFor(name)) return { text, finalUrl: url };
      }
      return null;
    };
    const verdict = async (name, extra) => (await ID.identityFor(name, { fetchPage, ...(extra || {}) })).kind;

    // =========================================================================
    console.log('\n=== A. THE WHITELIST IS DERIVED FROM THE REGISTRY, NOT RETYPED ===');
    {
      // Every scholar the search path can reach must be one the identity path can recognise.
      // A name in one table and missing from the other is a shaykh the app searches for and
      // then calls unknown — the drift lib/source-registry.js records for ابن عثيمين.
      let missing = [];
      for (const row of REG.SCHOLAR_SITES) {
        for (const a of (row.aliases || [])) {
          const r = WL.whitelistLookup(a);
          if (!r) missing.push(a);
        }
      }
      ok('every SCHOLAR_SITES alias resolves on the whitelist', missing.length === 0, missing.join(' · '));
      // ...and the eight the decision names by hand, each one explicitly.
      for (const n of ['ابن باز', 'العثيمين', 'البراك', 'فركوس', 'المصلح', 'العدوي', 'الجاسر', 'ابن جبرين']) {
        const r = WL.whitelistLookup(n);
        ok('«' + n + '» is on the whitelist', !!r && r.kind === 'scholar', JSON.stringify(r));
      }
      // Both spellings of «عبد الله» are one key — the commonest Arabic name variation, and the
      // one normalizeArabic does not fold on its own.
      ok('«عبد الله بن جبرين» and «عبدالله بن جبرين» are one person',
        JSON.stringify(WL.whitelistLookup('عبد الله بن جبرين')) === JSON.stringify(WL.whitelistLookup('عبدالله بن جبرين')));
      // DERIVED, not copied: the source file must actually import the registry.
      ok('lib/identity/whitelist.js imports SCHOLAR_SITES rather than restating it',
        /import \{ SCHOLAR_SITES \} from '\.\.\/source-registry\.js'/.test(read('lib/identity/whitelist.js')));
    }

    // =========================================================================
    console.log('\n=== B. THE FIVE MEASURED FIXTURES ===');
    {
      // الرويشد WITH HIS DIACRITICS — the spelling the model writes, and the one that has to
      // reach the same verdict as the bare spelling.
      eq('«عبدالله الرُّويْشِد» (vocalised) is NOT a scholar',
        await verdict('عبدالله الرُّويْشِد'), ID.IDENTITY.PUBLIC_FIGURE);
      eq('...and bare, identically', await verdict('عبدالله الرويشد'), ID.IDENTITY.PUBLIC_FIGURE);
      eq('«طارق العلي» is NOT a scholar', await verdict('طارق العلي'), ID.IDENTITY.PUBLIC_FIGURE);
      eq('«سالم المري العتيبي» is UNKNOWN', await verdict('سالم المري العتيبي'), ID.IDENTITY.UNKNOWN);
      eq('«ابن باز» is answered by the whitelist alone', await verdict('ابن باز'), ID.IDENTITY.SCHOLAR);
      eq('...at zero cost — the whitelist, not a page',
        (await ID.identityFor('ابن باز', { fetchPage })).source, 'whitelist');
      // ابن حجر — TWO men, and the collision is internal to the whitelist.
      const hajr = await ID.identityFor('ابن حجر', { fetchPage });
      eq('«ابن حجر» is an internal collision', hajr.kind, ID.IDENTITY.AMBIGUOUS);
      ok('...naming both men rather than picking one',
        (hajr.candidates || []).length === 2
        && hajr.candidates.some((c) => /العسقلاني/.test(c.display))
        && hajr.candidates.some((c) => /الهيتمي/.test(c.display)),
        JSON.stringify((hajr.candidates || []).map((c) => c.display)));
    }

    // =========================================================================
    console.log('\n=== C. IGNORANCE IS THE DEFAULT, AND «SCHOLAR» IS NEVER THE FALLBACK ===');
    {
      // THE NEGATIVE WITNESS. A gate that only proved the singer is refused would pass while
      // every unknown name was quietly promoted to a shaykh.
      for (const n of ['سالم المري العتيبي', 'فلان الفلاني', 'اسم لا وجود له البتة']) {
        const k = await verdict(n);
        ok('«' + n + '» is never read as a scholar', k !== ID.IDENTITY.SCHOLAR, k);
      }
      // A described person who is NOT described as a scholar is a public figure, not a scholar.
      eq('a description with no scholarly word is not a scholar',
        ID.classifyDescriptor('لاعب كرة قدم مصري'), ID.IDENTITY.PUBLIC_FIGURE);
      // ...and a non-scholar word DECIDES, even when the SAME description also says «داعية».
      // THE FIXTURE MUST CARRY BOTH, or this assertion is vacuous: a description with no
      // scholarly word at all reaches PUBLIC_FIGURE by the fallback on the last line, and would
      // pass identically with the non-scholar rule deleted. (It did — measured by mutation.)
      // A mixed signal resolves DOWN, which is the same fail-closed direction as the rest.
      eq('«مطرب وداعية» resolves to the non-scholar reading, not the scholar one',
        ID.classifyDescriptor('مطرب كويتي وداعية معروف'), ID.IDENTITY.PUBLIC_FIGURE);
      ok('...and that fixture really does contain a scholarly word, or the check proves nothing',
        ID.classifyDescriptor('داعية معروف') === ID.IDENTITY.SCHOLAR);
      eq('a source that DOES say scholar is believed',
        ID.classifyDescriptor('داعية إسلامي مصري'), ID.IDENTITY.SCHOLAR);
      eq('an empty description places nobody', ID.classifyDescriptor(''), ID.IDENTITY.UNKNOWN);
      // A disambiguation page is IN SCOPE, not a miss.
      eq('a صفحة توضيح is a collision, not an absence',
        await verdict('الهاشمي'), ID.IDENTITY.AMBIGUOUS);
    }

    // =========================================================================
    console.log('\n=== D. THE FACT BLOCK SAYS THE RIGHT THING IN EACH BRANCH ===');
    {
      const block = async (n) => ID.identityFactBlock(await ID.identityFor(n, { fetchPage }));

      const singer = await block('عبدالله الرويشد');
      ok('PUBLIC FIGURE: the block forbids the title outright', /لا تصفْه بشيخٍ ولا عالِمٍ/.test(singer));
      ok('...and still orders the QUESTION answered', /أجِبْ عن المسألةِ نفسِها/.test(singer));
      ok('...and carries the source link', /ar\.wikipedia\.org/.test(singer));
      ok('...and forbids taking a ruling from him', /لا تنقلْ عنه قولًا/.test(singer));

      const nobody = await block('سالم المري العتيبي');
      ok('UNKNOWN: the strict opening is stated verbatim', nobody.includes(ID.NO_IDENTITY_OPENING));
      ok('...with the rule that produced it', /الأصلُ في الأسماءِ الجهلُ حتى يثبتَ العلم/.test(nobody));
      ok('...and the question is STILL answered', /أجِبْ عن المسألةِ نفسِها/.test(nobody));
      ok('...and no biography is invented', !/مطرب|ممثل|لاعب/.test(nobody));

      const both = await block('ابن حجر');
      // P2-E: the scholar branch may be printed ONLY with a sourced statement behind it.
      ok('AMBIGUOUS: the «وإن كنتَ تقصد…» branch is conditioned on a real source',
        /إلّا إن كان قولُه في المصادرِ المرفقةِ فعلًا/.test(both));
      ok('...with the honest alternative named', /لم أقفْ على قوله/.test(both));
      ok('...and picking one man is forbidden', /ولا تختَرْ أحدَهما من عندِك/.test(both));
      // ...and the clarifying question RETIRES from the names path (قرار ٣).
      ok('...and no clarifying question is asked of the reader',
        !/أيّهما تقصد|من تقصد بالضبط|وضِّحْ من تقصد/.test(both));

      const shaykh = await block('ابن باز');
      ok('SCHOLAR: the existing path is explicitly left alone',
        /ولا تُغيِّرْ شيئًا من أجلِ هذا التنبيه/.test(shaykh));
      ok('...and no correction is ordered', !/صحِّحِ المقدّمة/.test(shaykh));

      for (const [name, question] of [
        ['رسول', 'ما صحة ما قال رسول الله ﷺ؟'],
        ['النبي', 'هل ثبت ما قال النبي ﷺ؟'],
        ['رسول الله', 'ما صحة ما قال رسول الله ﷺ؟'],
        ['الله', 'قال الله تعالى: إن مع العسر يسرا.'],
      ]) {
        eq('F-007 direct sacred UNKNOWN veto: «' + name + '» injects no identity instruction',
          ID.identityFactBlock({ kind: ID.IDENTITY.UNKNOWN, display: name }, { question }), '');
      }
      for (const name of ['الإمام فلان', 'المفتي فلان', 'الحافظ فلان', 'شيخ الإسلام فلان']) {
        ok('F-007 direct human-title UNKNOWN remains bounded: «' + name + '»',
          ID.identityFactBlock({ kind: ID.IDENTITY.UNKNOWN, display: name },
            { question: 'ما رأي ' + name + '؟' }).includes(ID.NO_IDENTITY_OPENING));
      }
      ok('F-007 direct green: a genuinely unknown human keeps the bounded UNKNOWN instruction',
        ID.identityFactBlock({ kind: ID.IDENTITY.UNKNOWN, display: 'فلان الفلاني' },
          { question: 'ما رأي الشيخ فلان الفلاني؟' }).includes(ID.NO_IDENTITY_OPENING));
      ok('F-007 ordinary-scholar green: a sacred honorific does not suppress a resolved identity',
        ID.identityFactBlock({ kind: ID.IDENTITY.SCHOLAR, display: 'الإمام مالك', descriptor: 'من أهل العلم' },
          { question: 'ما قول الإمام مالك؟' }).includes('هويّةُ الاسمِ المذكور'));
    }

    // =========================================================================
    console.log('\n=== E. قرار ٤: ar.wikipedia.org IS FETCHABLE AND BACKS NOTHING ===');
    {
      const CANON = await esm('lib/ledger/canonical.js');
      const POL = await esm('lib/ledger/source-policy.js');
      const CAP = await esm('lib/ledger/capability.js');
      const U = 'https://ar.wikipedia.org/wiki/x';
      ok('the safe path admits it', CANON.admissible(U) === true);
      // THE SSRF DEFENCE IS UNCHANGED — same https rule, same allow-list, one domain only.
      ok('...over https ONLY', CANON.admissible('http://ar.wikipedia.org/wiki/x') === false);
      ok('...and no credentials in the URL', CANON.admissible('https://u:p@ar.wikipedia.org/wiki/x') === false);
      ok('...and THIS DOMAIN ALONE — en.wikipedia.org is still refused',
        CANON.admissible('https://en.wikipedia.org/wiki/x') === false);
      ok('...and the bare wikipedia.org with it',
        CANON.admissible('https://wikipedia.org/wiki/x') === false);
      // AND IT MAY BACK NOTHING. This is what keeps «fetchable» from becoming «citable».
      const eligible = CAP.CAPABILITIES.filter((c) => POL.capabilityEligible(U, c));
      ok('it is eligible for NOT ONE capability', eligible.length === 0, eligible.join(', '));
      const listed = CAP.CAPABILITIES.filter((c) => POL.domainsForCapability(c).includes('ar.wikipedia.org'));
      ok('...and is offered as a search target for none', listed.length === 0, listed.join(', '));
    }

    // =========================================================================
    console.log('\n=== F. NO MODEL, NO NETWORK, NO HIDDEN COST ===');
    {
      const src = read('lib/identity/index.js') + read('lib/identity/whitelist.js');
      ok('the identity path calls no model', !/anthropic|claude|max_tokens|messages\.create/i.test(src));
      ok('...and issues no fetch of its own', !/globalThis\.fetch|\bfetch\(/.test(src),
        'every external effect must be an injected parameter, or a guard cannot seal it');
      // Stage 3 is the only paid stage, and it must stay behind an explicit flag.
      const noSearch = await ID.identityFor('اسم لا وجود له البتة', {
        fetchPage, search: async () => { throw new Error('live search ran without permission'); },
      });
      eq('the live stage does NOT run unless allowed', noSearch.kind, ID.IDENTITY.UNKNOWN);
      // ...and it DOES run when it is.
      const withSearch = await ID.identityFor('اسم لا وجود له البتة', {
        fetchPage, allowLiveSearch: true,
        search: async () => [{ description: 'لاعب كرة قدم', url: 'https://example.org/x' }],
      });
      eq('...and does when it is', withSearch.kind, ID.IDENTITY.PUBLIC_FIGURE);
      eq('...crediting the stage that answered', withSearch.source, 'live-search');
      // The cache spares the second reader the cost of the first reader's look-up.
      let fetches = 0;
      const counting = async (u) => { fetches++; return fetchPage(u); };
      const store = new Map();
      const cache = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); } };
      await ID.identityFor('عبدالله الرويشد', { fetchPage: counting, cache });
      await ID.identityFor('عبد الله الرُّويْشِد', { fetchPage: counting, cache });
      eq('two spellings of one name cost ONE look-up', fetches, 1);
      ok('...and the cached entry says so', /cache$/.test(
        (await ID.identityFor('عبدالله الرويشد', { fetchPage: counting, cache })).source));
      ok('the cache lifetime is measured in days, as the decision asks',
        ID.IDENTITY_TTL_SECONDS === ID.IDENTITY_TTL_DAYS * 86400 && ID.IDENTITY_TTL_DAYS >= 1);
    }

    ok('NOTHING in this gate reached the network', reachedNetwork === 0, String(reachedNetwork) + ' attempt(s)');

    // =========================================================================
    console.log('\n=== H. THE ADAPTER, AND THE WIRING THAT MAKES ANY OF THIS REACH A READER ===');
    // Sections A–F prove the cascade decides correctly. This one proves it is CALLED — the whole
    // of it is dead code until api/ask.js asks it something, and a module with a green gate and
    // no caller is the most convincing kind of nothing.
    {
      const W = await esm('lib/identity/wikipedia.js');

      // ── the adapter ────────────────────────────────────────────────────────
      const ARTICLE = '<html><body><div class="mw-parser-output">'
        + '<table class="infobox"><tr><td>صندوق المعلومات</td></tr></table>'
        + '<p></p><p>عبد الله الرويشد مطرب وملحن كويتي من مواليد 1961.</p>'
        + '<p>بدأ مسيرته الفنية في الثمانينيات.</p></div></body></html>';
      const lead = W.extractLead(ARTICLE);
      ok('the lead paragraph is extracted', /مطرب وملحن كويتي/.test(lead), lead);
      ok('...and the infobox is NOT part of it', !/صندوق المعلومات/.test(lead),
        'a description taken from the sidebar is a page nobody read');
      ok('...and an empty <p> does not become the lead', lead.length > 20);
      ok('a صفحة توضيح stub survives extraction',
        /قد يقصد به/.test(W.extractLead('<html><body><div class="mw-parser-output">'
          + '<p>الهاشمي قد يقصد به عدة أشخاص.</p></div></body></html>')));

      // IT GOES THROUGH THE SAFE PATH. قرار ٤ put ar.wikipedia.org on the admissibility list OF
      // THE EXISTING SAFE PATH — a plain fetch here would undo the sentence «دفاعُ SSRF كما هو»
      // while leaving every other assertion in this gate green.
      const wsrc = read('lib/identity/wikipedia.js');
      ok('the adapter imports safeFetch', /import \{ safeFetch \} from '\.\.\/ledger\/safe-fetch\.js'/.test(wsrc));
      ok('...and never calls globalThis.fetch itself',
        !/globalThis\.fetch/.test(wsrc) && !/(?<![.\w])fetch\(/.test(wsrc.replace(/safeFetch\(/g, '')),
        'the SSRF defence is inherited by USING the safe path, not by being near it');
      // ...and it is a value-returning refusal, not a throw.
      const failing = W.makeWikipediaFetcher({ safeFetch: async () => ({ ok: false, reason: 'preflight:x' }) });
      eq('a refused fetch degrades to null rather than throwing',
        await failing('https://ar.wikipedia.org/wiki/x'), null);

      // ── the cache ──────────────────────────────────────────────────────────
      const C = await esm('lib/identity/cache.js');
      ok('a placed identity is remembered for days', C.FOUND_TTL_SECONDS >= 7 * 86400);
      ok('...and a miss for a SHORTER time', C.MISS_TTL_SECONDS < C.FOUND_TTL_SECONDS);
      ok('...but is still remembered, because a miss is the costliest outcome', C.MISS_TTL_SECONDS > 0);
      // NO SECRET, NO KEY — never a plaintext one. Same rule as lib/ledger/cache.js.
      const hadSecret = Object.prototype.hasOwnProperty.call(process.env, 'LEDGER_CACHE_SECRET');
      const prevSecret = process.env.LEDGER_CACHE_SECRET;
      const hadFounder = Object.prototype.hasOwnProperty.call(process.env, 'FOUNDER_SECRET');
      const prevFounder = process.env.FOUNDER_SECRET;
      delete process.env.LEDGER_CACHE_SECRET; delete process.env.FOUNDER_SECRET;
      eq('with no secret there is no key at all', C.cacheKeyFor('عبدالله الرويشد'), '');
      ok('...and the cache reports itself disabled', C.identityCacheEnabled() === false);
      process.env.LEDGER_CACHE_SECRET = 'identity-guard-local-secret';
      const k = C.cacheKeyFor('عبدالله الرويشد');
      ok('with a secret there is a key', !!k);
      ok('...and it leaks no fragment of the name',
        !k.includes('الرويشد') && !k.includes('عبدالله'), k);
      eq('...and two spellings of one name share it', C.cacheKeyFor('عبد الله الرُّويْشِد'), k);

      // F-016: this cache stores human identities only. A sacred/title-only capture may neither
      // address the store nor be accepted as a stored verdict, even under concurrent calls.
      eq('F-016 sacred capture has no cache key', C.cacheKeyFor('رسول'), '');
      for (const title of ['الإمام', 'الشيخ', 'الدكتور']) {
        eq('F-016 bare title has no cache key: ' + title, C.cacheKeyFor(title), '');
      }
      let forbiddenGets = 0, forbiddenPuts = 0, forbiddenFetches = 0;
      const forbiddenCache = {
        get: async () => { forbiddenGets++; return { kind: ID.IDENTITY.SCHOLAR, display: 'رسول', source: 'legacy' }; },
        put: async () => { forbiddenPuts++; return true; },
      };
      const forbidden = await Promise.all(Array.from({ length: 8 }, () => ID.identityFor('رسول', {
        cache: forbiddenCache,
        fetchPage: async () => { forbiddenFetches++; return null; },
      })));
      ok('F-016 concurrent sacred captures stay UNKNOWN without any cache read/write/fetch',
        forbidden.every((item) => item.kind === ID.IDENTITY.UNKNOWN)
          && forbiddenGets === 0 && forbiddenPuts === 0 && forbiddenFetches === 0,
        JSON.stringify({ forbiddenGets, forbiddenPuts, forbiddenFetches, forbidden }));

      const memory = new Map();
      let storedTtl = 0;
      const memoryBackend = {
        get: async (key) => memory.get(key) || null,
        setex: async (key, ttl, value) => { storedTtl = ttl; memory.set(key, value); return true; },
      };
      const memoryCache = C.identityCache(memoryBackend);
      const trusted = {
        kind: ID.IDENTITY.SCHOLAR, display: 'ابن باز', descriptor: 'عالم وفقيه',
        url: 'https://binbaz.org.sa/', source: 'whitelist',
      };
      ok('F-016 a trusted human identity is written', await memoryCache.put('ابن باز', trusted));
      eq('F-016 a trusted human identity is read back', await memoryCache.get('ابن باز'), trusted);
      ok('F-016 stored TTL is positive and bounded by the declared found TTL',
        storedTtl > 0 && storedTtl <= C.FOUND_TTL_SECONDS, String(storedTtl));
      eq('F-016 cross-name store leakage is rejected by the envelope binding',
        await C.identityCache({ get: async () => [...memory.values()][0], setex: async () => true }).get('ابن عثيمين'), null);
      eq('F-016 a pre-schema legacy value is stale and cannot be returned',
        await C.identityCache({ get: async () => trusted, setex: async () => true }).get('ابن باز'), null);
      const brokenCache = C.identityCache({
        get: async () => { throw new Error('store read failed'); },
        setex: async () => { throw new Error('store write failed'); },
      });
      eq('F-016 store read failure is a closed miss', await brokenCache.get('ابن باز'), null);
      eq('F-016 store write failure is a closed refusal', await brokenCache.put('ابن باز', trusted), false);

      const indexSource = read('lib/identity/index.js');
      const veto = 'if (!key || !isHumanIdentityCandidate(name)) return unknown;';
      ok('F-016 mutation precondition: human-only veto precedes injected effects', indexSource.includes(veto));
      const absoluteImports = (source, baseFile) => source.replace(
        /from '(\.\.?\/[^']+)'/g,
        (_match, rel) => "from 'file:///" + path.resolve(path.dirname(baseFile), rel).replace(/\\/g, '/') + "'",
      );
      const mutantDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-a7-f016-mut-'));
      try {
        const mutantFile = path.join(mutantDir, 'identity-human-veto-removed.mjs');
        fs.writeFileSync(mutantFile, absoluteImports(indexSource.replace(veto, 'if (!key) return unknown;'),
          path.join(REPO, 'lib/identity/index.js')), 'utf8');
        const Mutant = await import('file:///' + mutantFile.replace(/\\/g, '/'));
        let mutantReads = 0;
        const escaped = await Mutant.identityFor('رسول', { cache: {
          get: async () => { mutantReads++; return { ...trusted, display: 'رسول', source: 'legacy' }; },
          put: async () => true,
        } });
        ok('F-016 MUTANT KILLED: removing the human-only veto revives poisoned sacred identity',
          escaped.kind === ID.IDENTITY.SCHOLAR && mutantReads === 1, JSON.stringify({ escaped, mutantReads }));
      } finally {
        try { fs.rmSync(mutantDir, { recursive: true, force: true }); } catch { /* temp only */ }
      }
      if (hadSecret) process.env.LEDGER_CACHE_SECRET = prevSecret; else delete process.env.LEDGER_CACHE_SECRET;
      if (hadFounder) process.env.FOUNDER_SECRET = prevFounder; else delete process.env.FOUNDER_SECRET;

      // ── THE WIRING ─────────────────────────────────────────────────────────
      const ask = read('api/ask.js');
      ok('api/ask.js calls the cascade', /identityFor\(nameShape\.name, \{/.test(ask));
      ok('...through the safe-path fetcher', /fetchPage: makeWikipediaFetcher\(\)/.test(ask));
      ok('...with the cache attached', /cache: identityCache\(\)/.test(ask));
      ok('...and builds the fact block from the result', /identityFact = identityFactBlock\(identity/.test(ask));
      // THE INJECTED MESSAGE IS BUILT IN ONE PLACE, AND CALLED FROM EVERY DRAFTING PATH.
      //
      // شاهد W2 measured what the older shape cost. The block was a literal inside round2Messages,
      // and the comment above it called that «the one place every drafting exit passes through».
      // It was true of four exits and blind to a fifth: the GEN branch sends body.messages raw and
      // RETURNS before round2Messages is ever built. So a reader who named an unregistered person
      // in a general question paid for the whole cascade and the model was told nothing.
      //
      // Copying the literal onto the fifth exit would have rebuilt exactly that trap for the
      // sixth. So what is pinned here is the MECHANISM: one builder, N call sites.
      {
        const hStart = ask.indexOf('const withIdentityFact = (');
        const helper = hStart === -1 ? '' : ask.slice(hStart, hStart + 220);
        ok('there is a single named builder for the injected message', hStart !== -1);
        // ONE occurrence in the whole file. A second literal anywhere is the defect returning,
        // and it is the only form of this bug a text check can see before it ships.
        ok('...and the message is constructed in exactly ONE place in the handler',
          (ask.match(/role: 'user', content: identityFact/g) || []).length === 1,
          String((ask.match(/role: 'user', content: identityFact/g) || []).length) + ' occurrence(s)');
        // IT APPENDS. The block is an instruction about how to read what precedes it, so «last»
        // is a property of the builder rather than a rule each call site has to remember.
        ok('...and it APPENDS, so the block is last on every path that uses it',
          /\[\.\.\.msgs, \{ role: 'user', content: identityFact \}\]/.test(helper), helper.slice(0, 200));
        // ...and it is CONDITIONAL, so a turn with no name adds no empty message.
        ok('...and only when there is a fact at all', /identityFact\s*\?/.test(helper));

        // ── AND BOTH DRAFTING ROUTES GO THROUGH IT ──────────────────────────
        ok('the GEN branch injects through the builder',
          /messages: withIdentityFact\(body\.messages\)/.test(ask),
          'GEN is the route شاهد W2 found empty; a raw body.messages here is that defect returning');
        ok('round2Messages is built through the builder',
          /const round2Messages = withIdentityFact\(\[/.test(ask));

        // ── AND THE COUNT IS THE CHECK, NOT THE NAMED TWO (ج٣) ────────────────
        //
        // W2 was closed by naming the exits that were known to be empty. That is the same shape of
        // reasoning that caused it: the round2Messages comment named four exits and was blind to a
        // fifth. Two more were then MEASURED empty and recorded rather than fixed — the live-world
        // answer and the encyclopedic fallback, both drafting from `[...body.messages, grounding]`
        // AFTER identityFact exists and neither carrying it.
        //
        // So this counts instead of naming. Every `grounding` exit in the handler must go through
        // the builder; a new one added tomorrow fails here on the day it is written.
        {
          const grounded = ask.match(/messages: (?:withIdentityFact\()?\[\.\.\.body\.messages, \{ role: 'user', content: grounding \}\]/g) || [];
          const wired = grounded.filter((m) => m.includes('withIdentityFact'));
          ok('EVERY grounding exit drafts through the builder',
            grounded.length > 0 && wired.length === grounded.length,
            wired.length + ' of ' + grounded.length + ' — an unwired grounding exit is W2 returning');
          // ...and there are at least the two ج٣ closed, so the check cannot pass by finding none.
          ok('...and there are at least two of them, so the count is not vacuous',
            grounded.length >= 2, String(grounded.length));
        }
        // round2 still has retrieved material for the block to follow — the ordering the old
        // assertion checked textually, kept as a check that the material is still IN the array.
        const start = ask.indexOf('const round2Messages = withIdentityFact([');
        const end = start === -1 ? -1 : ask.indexOf(']);', start);
        const arr = start === -1 || end === -1 ? '' : ask.slice(start, end);
        ok('...with the tool results inside it, so the appended block still follows them',
          arr.includes('toolResults'), arr.slice(0, 200));
      }
      // ...and it does NOT open a second search budget.
      ok('stage 3 reuses the pages the world probe already paid for',
        /allowLiveSearch: namePresence\.searchCompleted === true[\s\S]{0,120}namePresence\.outcome === PRESENCE\.FOUND/.test(ask)
        && /search: async \(\) => \(\(namePresence\.page/.test(ask),
        'a second retrieval budget beside the answer\'s own is the one thing this look-up may not become');
      // A THROW HERE MAY NOT COST THE READER AN ANSWER.
      ok('a failure in the cascade degrades to drafting without the block',
        /drafting without the fact block/.test(ask));
      // The reader's own words are not written to the log.
      ok('the identity log line records the SHAPE, not the name',
        /hasDescriptor: !!identity\.descriptor/.test(ask) && !/console\.log\('\[identity\]', \{[^}]*name:/.test(ask));
    }

    // =========================================================================
    console.log('\n=== I. DRIVEN: THE BLOCK ACTUALLY REACHES THE MODEL ===');
    // Section H proves the call site exists in the source. This proves the sentence arrives.
    // «api/ask.js contains identityFactBlock» is a claim about text; «the vendor received a
    // block saying he is not a scholar» is a claim about behaviour, and only one of the two
    // survives somebody restructuring the handler.
    //
    // The honorific makes this a typed unresolved authority in the IR.  A raw lexical capture is
    // deliberately not enough: F-081 requires the typed veto to remain authoritative.
    {
      const saved = {};
      for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'RFC_V05_MODE', 'LEDGER_RAG',
        'VERCEL_ENV', 'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_PER_CALLER'])
        saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-identity-guard-fake';
      process.env.BRAVE_API_KEY = 'brave-identity-guard-fake';
      process.env.RFC_V05_MODE = 'off';
      process.env.LEDGER_RAG = 'off';
      process.env.FOUNDER_SECRET = 'identity-guard-driven-secret';
      process.env.VERCEL_ENV = 'preview';
      process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '100';
      process.env.SEARCH_BUDGET_PER_CALLER = '100';
      const throwingFetch = globalThis.fetch;
      try {
        const DC = await esm('lib/daycap.js');
        const CONSENT = await esm('lib/ai-consent.js');
        const LEDGER_STORE = await esm('lib/ledger/redis.js');
        let dailySearchUnits = 0;
        // F-038 makes every world-provider call reserve the canonical daily budget first. This
        // local Redis double models that Lua reservation; without it the test would be exercising
        // an infrastructure outage and could never reach the identity assertion it owns.
        LEDGER_STORE.__setRedisForTest({
          async eval(_script, _keys, args) {
            dailySearchUnits++;
            return [dailySearchUnits, dailySearchUnits, 1, 0];
          },
        });
        const DEVICE = 'identity-guard-device';
        const FOUNDER = DC.founderTokenFor(DEVICE);

        const WIKI = '<html><body><div class="mw-parser-output">'
          + '<p>عبد الله الرويشد مطرب وملحن كويتي من مواليد 1961.</p></div></body></html>';
        const FATWA = '<html><body><article><p>'
          + 'العقيقة سنة مؤكدة عن المولود، وهي شاة عن الأنثى وشاتان عن الذكر، تذبح في اليوم السابع '
          + 'بإجماع أهل العلم على استحبابها والتفصيل في ذلك مبسوط في كتب الفقه. '.repeat(8)
          + '</p></article></body></html>';

        const sent = [];
        globalThis.fetch = async (url, opts) => {
          const u = String(url);
          if (u.includes('api.anthropic.com')) {
            sent.push(JSON.parse(opts.body));
            // Round 1 asks for a search; round 2 drafts. Without the tool_use the handler
            // refuses unsourced and never builds round2Messages — so the case would prove
            // nothing rather than fail, which is the trap this comment exists to name.
            return {
              ok: true, status: 200,
              json: async () => (sent.length === 1
                ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_islamic_sources', input: { query: 'حكم العقيقة' } }] }
                : { content: [{ type: 'text', text: 'مسوّدة الجواب.' }] }),
              body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '',
            };
          }
          if (u.includes('api.search.brave.com')) {
            return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results: [
              { title: 'العقيقة', url: 'https://islamweb.net/ar/fatwa/1001/x', description: '' },
            ] } }) };
          }
          const html = u.includes('ar.wikipedia.org') ? WIKI : FATWA;
          return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => html, url: u };
        };

        const mkRes = () => {
          const r = { writes: [], statusCode: 0, headers: {} };
          r.status = (c) => { r.statusCode = c; return r; };
          r.setHeader = (k, v) => { r.headers[k] = v; return r; };
          r.getHeader = (k) => r.headers[k];
          r.flushHeaders = () => {}; r.json = () => r;
          r.write = () => true; r.end = () => r;
          r.on = () => r; r.once = () => r; r.emit = () => r;
          return r;
        };
        const req = {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
            'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER },
          body: { name: 'خالد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
            messages: [{ role: 'user', content: 'ماقول الشيخ عبدالله الرويشد في شرح حديث عن أحكام العقيقه' }] },
          socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/',
        };

        const handler = (await esm('api/ask.js')).default;
        try { await handler(req, mkRes()); } catch (e) { /* a refusal is not a silence */ }

        const all = JSON.stringify(sent);
        if (ok('the handler reached a drafting round', sent.length >= 2,
          'only ' + sent.length + ' vendor call(s) — fix the harness, do not delete the case')) {
          ok('the identity fact block reached the model', all.includes('هويّةُ الاسمِ المذكور'));
          ok('...saying he is NOT one of the people of knowledge', all.includes('ليس من أهلِ العلمِ'));
          ok('...forbidding the title outright', all.includes('فلا تصفْه بشيخٍ'));
          ok('...ordering the question answered anyway', all.includes('أجِبْ عن المسألةِ نفسِها'));
          ok('...and carrying the descriptor the SOURCE gave', all.includes('مطرب'));
        }
      } finally {
        globalThis.fetch = throwingFetch;
        for (const k of Object.keys(saved)) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
      }
    }

    // =========================================================================
    console.log('\n=== J. DRIVEN: THE GEN ROUTE CARRIES IT TOO (شاهد W2) ===');
    // Section I drives the DEEN route and proves round2Messages arrives armed. This one drives the
    // OTHER route, and it exists because that gap is precisely what nobody was asked about: the
    // gate proved the path it covered, and the path it did not cover was silently empty.
    //
    // THE FIXTURE IS «من هو عبدالله الرويشد؟» — an identity question about the same measured
    // singer, on a route with no retrieval. Three facts make it land on GEN and each is asserted
    // rather than assumed: the router says GEN, the presence probe finds no page carrying the name
    // (so the «من هو» exit above falls through), and the wikipedia stage still places him.
    {
      const saved = {};
      for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'RFC_V05_MODE', 'LEDGER_RAG',
        'VERCEL_ENV', 'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_PER_CALLER'])
        saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-identity-guard-fake';
      process.env.BRAVE_API_KEY = 'brave-identity-guard-fake';
      process.env.RFC_V05_MODE = 'off';
      process.env.LEDGER_RAG = 'off';
      process.env.FOUNDER_SECRET = 'identity-guard-driven-secret';
      process.env.VERCEL_ENV = 'preview';
      process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '100';
      process.env.SEARCH_BUDGET_PER_CALLER = '100';
      const throwingFetch = globalThis.fetch;
      const realLog = console.log;
      const routeLines = [];
      try {
        const DC = await esm('lib/daycap.js');
        const CONSENT = await esm('lib/ai-consent.js');
        const LEDGER_STORE = await esm('lib/ledger/redis.js');
        let dailySearchUnits = 0;
        LEDGER_STORE.__setRedisForTest({
          async eval() {
            dailySearchUnits++;
            return [dailySearchUnits, dailySearchUnits, 1, 0];
          },
        });
        const DEVICE = 'identity-guard-device-gen';
        const FOUNDER = DC.founderTokenFor(DEVICE);

        const WIKI = '<html><body><div class="mw-parser-output">'
          + '<p>عبد الله الرويشد مطرب وملحن كويتي من مواليد 1961.</p></div></body></html>';
        // A page that does NOT carry the name. That is deliberate: it drives namePresence.found
        // to false, so the «من هو فلان؟» exit falls through and the turn reaches GEN. A page that
        // DID carry it would answer above and this section would prove nothing about GEN.
        const BLANK = '<html><body><article><p>'
          + 'صفحة عامة لا تحمل الاسم المطلوب. '.repeat(20) + '</p></article></body></html>';

        // GEN streams, so the stub must be a reader — a json-only stub makes the branch throw
        // before it has sent anything, and an empty `sent` reads as «no injection» when the real
        // fault is the harness.
        const sseFrames = [
          'data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'جوابٌ عام.' } }) + '\n\n',
          'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n',
        ];

        const sent = [];
        globalThis.fetch = async (url, opts) => {
          const u = String(url);
          if (u.includes('api.anthropic.com')) {
            sent.push(JSON.parse(opts.body));
            let i = 0;
            return {
              ok: true, status: 200,
              json: async () => ({ content: [{ type: 'text', text: 'مسوّدة.' }] }),
              body: { getReader: () => ({ read: async () => (i < sseFrames.length
                ? { done: false, value: new TextEncoder().encode(sseFrames[i++]) }
                : { done: true }) }) },
              text: async () => '',
            };
          }
          if (u.includes('api.search.brave.com')) {
            return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results: [
              { title: 'خبر', url: 'https://www.aljazeera.net/news/1', description: '' },
            ] } }) };
          }
          const html = u.includes('ar.wikipedia.org') ? WIKI : BLANK;
          return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => html, url: u };
        };

        const mkRes = () => {
          const r = { writes: [], statusCode: 0, headers: {} };
          r.status = (c) => { r.statusCode = c; return r; };
          r.setHeader = (k, v) => { r.headers[k] = v; return r; };
          r.getHeader = (k) => r.headers[k];
          r.flushHeaders = () => {}; r.json = () => r;
          r.write = () => true; r.end = () => r;
          r.on = () => r; r.once = () => r; r.emit = () => r;
          return r;
        };
        const req = {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
            'x-murabbi-device': DEVICE, 'x-murabbi-founder': FOUNDER },
          body: { name: 'خالد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
            messages: [{ role: 'user', content: 'من هو عبدالله الرويشد؟' }] },
          socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/',
        };

        // The handler's own [route] line is the only honest witness to which branch ran.
        console.log = (...a) => {
          try { if (a[0] === '[route]') routeLines.push(JSON.stringify(a[1])); } catch { /* not ours */ }
        };
        const handler = (await esm('api/ask.js')).default;
        try { await handler(req, mkRes()); } catch (e) { /* a refusal is not a silence */ }
        console.log = realLog;

        const all = JSON.stringify(sent);
        ok('the handler routed this turn to GEN',
          routeLines.length === 1 && /"route":"GEN"/.test(routeLines[0]),
          routeLines.join(' | ') || 'no [route] line — the turn never reached the router');
        // GEN is ONE streamed call with no tools. Two or more means the turn fell into the DEEN
        // round instead, and every assertion below would be measuring the path section I covers.
        if (ok('...and spent exactly one vendor call, as the tool-less branch does', sent.length === 1,
          String(sent.length) + ' call(s) — a second call means this landed on DEEN, not GEN')) {
          ok('the identity fact block reached the model on GEN', all.includes('هويّةُ الاسمِ المذكور'));
          ok('...saying he is NOT one of the people of knowledge', all.includes('ليس من أهلِ العلمِ'));
          ok('...forbidding the title outright', all.includes('فلا تصفْه بشيخٍ'));
          ok('...ordering the question answered anyway', all.includes('أجِبْ عن المسألةِ نفسِها'));
          // The descriptor can only have come from the wikipedia fixture. Without it the cascade
          // reached UNKNOWN and the four assertions above would be passing on the wrong branch.
          ok('...and carrying the descriptor the SOURCE gave', all.includes('مطرب'));
          // ...and it is the LAST message, being an instruction about how to read what precedes it.
          const msgs = (sent[0] && sent[0].messages) || [];
          ok('...as the last message in the request', msgs.length >= 2
            && /هويّةُ الاسمِ المذكور/.test(String(msgs[msgs.length - 1].content)),
            JSON.stringify(msgs.map((m) => String(m.content).slice(0, 24))));
          // ...and the reader's own question is still there, unaltered.
          ok('...without displacing the reader\'s own message',
            msgs.some((m) => String(m.content).includes('من هو عبدالله الرويشد')));
        }
      } finally {
        console.log = realLog;
        globalThis.fetch = throwingFetch;
        try { (await esm('lib/ledger/redis.js')).__resetRedis(); } catch { /* test cleanup */ }
        for (const k of Object.keys(saved)) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
      }
    }

    // =========================================================================
    console.log('\n=== K. DRIVEN: THE IGNORANCE OPENING ASKS THE CASCADE FIRST (ج١) ===');
    //
    // ── THE MEASURED CONTRADICTION ────────────────────────────────────────────
    // «ماقول الشيخ عبدالله الرويشد في حكم الغناء» produced, in ONE reply:
    //     «لا أعرف هذا الاسم: «عبدالله الرويشد» لا يَرِد في المصادر التي أرجع إليها…»
    // and then a correct description of him as a Kuwaiti singer. Driven and measured before the
    // fix: [identity] said public_figure/wikipedia, the model was handed «مطرب» and told he is not
    // one of the people of knowledge — while the sentence above it said we had never heard of him.
    //
    // The cause was ORDER: the sentence was built from `namePresence` alone, ~30 lines ABOVE the
    // cascade. namePresence answers «does a RETRIEVED PAGE carry this name», which is a fact about
    // our search, not about who he is.
    //
    // BOTH DIRECTIONS ARE PINNED HERE, and that pairing is the point: a gate that only proved the
    // opening disappears would pass with the opening deleted outright, and deleting it would cost
    // the reader the one honest sentence for a name nobody can place.
    {
      const saved = {};
      for (const k of ['ANTHROPIC_API_KEY', 'BRAVE_API_KEY', 'FOUNDER_SECRET', 'RFC_V05_MODE', 'LEDGER_RAG',
        'VERCEL_ENV', 'SEARCH_BUDGET_GLOBAL_PREVIEW', 'SEARCH_BUDGET_PER_CALLER'])
        saved[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-identity-guard-fake';
      process.env.BRAVE_API_KEY = 'brave-identity-guard-fake';
      process.env.RFC_V05_MODE = 'off';
      process.env.LEDGER_RAG = 'off';
      // The day-cap store is unreachable here and fails CLOSED by design, so without a founder
      // token the handler refuses before the router and every assertion below would be vacuous.
      process.env.FOUNDER_SECRET = 'identity-guard-driven-secret';
      process.env.VERCEL_ENV = 'preview';
      process.env.SEARCH_BUDGET_GLOBAL_PREVIEW = '100';
      process.env.SEARCH_BUDGET_PER_CALLER = '100';
      const throwingFetch = globalThis.fetch;
      const realLog = console.log;
      try {
        const DC = await esm('lib/daycap.js');
        const CONSENT = await esm('lib/ai-consent.js');
        const LEDGER_STORE = await esm('lib/ledger/redis.js');
        let dailySearchUnits = 0;
        // F-038 makes the driven world lookup reserve the canonical budget. Keep this identity
        // fixture focused on cascade ordering by supplying the local atomic reservation double.
        LEDGER_STORE.__setRedisForTest({
          async eval(_script, _keys, args) {
            dailySearchUnits++;
            return [dailySearchUnits, dailySearchUnits, 1, 0];
          },
        });

        const WIKI = '<html><body><div class="mw-parser-output">'
          + '<p>عبد الله الرويشد مطرب وملحن كويتي من مواليد 1961.</p></div></body></html>';
        const FATWA = '<html><body><article><p>'
          + 'الغناء المصحوب بالمعازف محرم عند جمهور أهل العلم، والتفصيل في ذلك مبسوط في كتب الفقه. '.repeat(6)
          + '</p></article></body></html>';
        const DRAFT = 'الغناء المصحوب بالمعازف محرم عند جمهور أهل العلم، والتفصيل في كتب الفقه.';

        // wikiHtml === null drives a REAL 404 — a page whose body says "not found" is still a page,
        // and the cascade would read its text as a description. (Measured: it reached
        // PUBLIC_FIGURE off the words «Not found», which would have made this case vacuous.)
        const run = async (question, wikiHtml) => {
          const emitted = [];
          const idLines = [];
          globalThis.fetch = async (url, opts) => {
            const u = String(url);
            if (u.includes('api.anthropic.com')) {
              const b = JSON.parse(opts.body);
              const wantsTool = Array.isArray(b.tools) && b.tools.length;
              return {
                ok: true, status: 200,
                json: async () => (wantsTool
                  ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_islamic_sources', input: { query: 'حكم الغناء' } }] }
                  : { content: [{ type: 'text', text: DRAFT }] }),
                body: { getReader: () => ({ read: async () => ({ done: true }) }) }, text: async () => '',
              };
            }
            if (u.includes('api.search.brave.com')) {
              return { ok: true, status: 200, text: async () => '', json: async () => ({ web: { results: [
                { title: 'حكم الغناء', url: 'https://islamweb.net/ar/fatwa/1001/x', description: '' },
              ] } }) };
            }
            if (u.includes('ar.wikipedia.org')) {
              if (wikiHtml === null) return { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '', url: u };
              return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => wikiHtml, url: u };
            }
            return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => FATWA, url: u };
          };
          const r = { statusCode: 0, headers: {} };
          r.status = (c) => { r.statusCode = c; return r; };
          r.setHeader = (k, v) => { r.headers[k] = v; return r; };
          r.getHeader = (k) => r.headers[k];
          r.flushHeaders = () => {}; r.json = () => r;
          r.write = (c) => {
            for (const part of String(c).split('\n\n')) {
              const line = part.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;
              try {
                const e = JSON.parse(line.slice(6));
                if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') emitted.push(e.delta.text);
              } catch { /* not ours */ }
            }
            return true;
          };
          r.end = () => r; r.on = () => r; r.once = () => r; r.emit = () => r;
          const DEVICE = 'identity-guard-k-' + question.length;
          const req = {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-ezik-ai-consent': CONSENT.AI_CONSENT_VERSION,
              'x-murabbi-device': DEVICE, 'x-murabbi-founder': DC.founderTokenFor(DEVICE) },
            body: { name: 'خالد', age: 30, gender: 'male', mode: 'chat', band: 'adult',
              messages: [{ role: 'user', content: question }] },
            socket: { remoteAddress: '127.0.0.1' }, on: () => {}, url: '/',
          };
          console.log = (...a) => { if (a[0] === '[identity]') { try { idLines.push(JSON.stringify(a[1])); } catch { /* ignore */ } } };
          const handler = (await esm('api/ask.js')).default;
          try { await handler(req, r); } catch (e) { /* a refusal is not a silence */ }
          console.log = realLog;
          return { text: emitted.join(''), identity: idLines.join(' ') };
        };

        const OPENING = 'لم أتحقق من هذا الاسم ضمن النتائج التي فُحصت';
        const CORRECTION = 'ليس ممّن تُؤخَذ عنه الفتوى في مصادرنا';

        // ── (1) IDENTITY DECIDED: the opening must be ABSENT ──────────────────
        const decided = await run('ماقول الشيخ عبدالله الرويشد في شرح حديث عن حكم الغناء', WIKI);
        if (ok('the cascade placed him as a public figure', /"kind":"public_figure"/.test(decided.identity),
          decided.identity || 'no [identity] line — the probe never ran, so this case proves nothing')) {
          ok('DECIDED: the ignorance opening is ABSENT from what the reader gets',
            !decided.text.includes(OPENING), decided.text.slice(0, 160));
          // ...and it is REPLACED, not merely deleted: the reader still gets a true sentence.
          ok('...and the correction stands in its place', decided.text.includes(CORRECTION),
            decided.text.slice(0, 160));
          // ...and the ruling the reader actually asked about survived both.
          ok('...and the sourced answer still reaches him', /الغناء/.test(decided.text));
          ok('...carrying its card', /<source/.test(decided.text));
        }

        // ── (2) IDENTITY UNKNOWN: the opening must be PRESENT ─────────────────
        const unknown = await run('ماقول الشيخ سالم المري العتيبي في شرح حديث عن حكم الغناء', null);
        if (ok('the cascade reached UNKNOWN for a name nothing carries', /"kind":"unknown"/.test(unknown.identity),
          unknown.identity || 'no [identity] line')) {
          ok('UNKNOWN: the ignorance opening IS printed — it is the honest sentence here',
            unknown.text.includes(OPENING), unknown.text.slice(0, 160));
          ok('...and the correction is NOT, because nothing was placed',
            !unknown.text.includes(CORRECTION), unknown.text.slice(0, 160));
          ok('...and the ruling still reaches him too', /الغناء/.test(unknown.text));
        }

        // ── (3) THE ORDER THAT CAUSED IT, PINNED STRUCTURALLY ─────────────────
        // The sentence may not be built before the verdict it consults exists.
        const ask = read('api/ask.js');
        ok('presenceLead is built AFTER the identity cascade assigns its verdict',
          ask.indexOf('identityVerdict = identity.kind') < ask.indexOf('const presenceLead ='),
          'building it first is the defect, whatever the wording says');
        ok('...and it reads the verdict rather than the search result alone',
          /identityIsPublicFigure/.test(ask) && /identityIsPlaced/.test(ask));
      } finally {
        console.log = realLog;
        globalThis.fetch = throwingFetch;
        try { (await esm('lib/ledger/redis.js')).__resetRedis(); } catch { /* test cleanup */ }
        for (const k of Object.keys(saved)) {
          if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
      }
    }

    // =========================================================================
    console.log('\n=== L. DRIVEN: AFTER THE DECLARATION, THE RULING IS STILL ANSWERED (ج٢) ===');
    //
    // ── THE MEASURED FAILURE ──────────────────────────────────────────────────
    // «ما رأي الشيخ سالم المري العتيبي في صلاة الوتر». The strict declaration printed, a witr page
    // came back clean, GENERAL_RULING_SUBSTITUTED fired and told the model to answer the ruling
    // «إجابةً كاملةً مفيدةً كأيِّ سؤالٍ آخر» — and the reader got no ruling at all. Two causes,
    // both measured:
    //   1. screenDraft escalates to dropWhole the moment an offending sentence names the subject.
    //      Right when the attribution IS the answer; wrong once the server has already said, in
    //      its own voice, that nothing will be credited to this name — then the ruling is the only
    //      question still standing and dropping it answers nothing.
    //   2. the replacement then OFFERED A CHOICE («…فاختر ما تريد»), one option of which was the
    //      answer he had already asked for. That is the retired clarifying question in a new coat.
    {
      const CG = await esm('lib/policy/consistency-gate.js');

      // ── the sentence itself ────────────────────────────────────────────────
      ok('the replacement no longer offers the reader a menu',
        !/فاختر ما تريد/.test(CG.NO_ATTRIBUTION_AVAILABLE), CG.NO_ATTRIBUTION_AVAILABLE);
      ok('...nor offers to do what it could simply do',
        !/وأستطيع أن أعرض/.test(CG.NO_ATTRIBUTION_AVAILABLE));
      ok('...and still states the limit it exists to state',
        /لا أنسبُ قولًا/.test(CG.NO_ATTRIBUTION_AVAILABLE));
      // ...and it still says nothing about the man, which is the older rule it must not lose.
      ok('...while calling nobody «هذا العالِم»', !/هذا العالِم/.test(CG.NO_ATTRIBUTION_AVAILABLE));

      // ── the escalation, both ways ──────────────────────────────────────────
      // THE HANDLER'S OWN CONTEXT, not a friendlier one. `allowSourcedPosition` with a real
      // publisher list is what makes «فيرى أن الوتر واجب» an offence: a position credited to a man
      // must name the publisher that carries it. Measured — without these two the draft does not
      // offend at all and every assertion below would be vacuous.
      const CTX = {
        entity: 'سالم المري العتيبي', subjectEntity: 'سالم المري العتيبي',
        notDirectlyVerified: true, searchProven: true, identityVerified: false,
        allowSourcedPosition: true, transmissionPublishers: ['islamweb.net'],
        // ARMED BY BEING SUPPLIED, NOT BY ITS CONTENTS. An EMPTY licence is the measured live
        // case — `[licence] { pages: 1, persons: [] }` — and it means: none of the pages in hand
        // licenses naming any man. Omitting the key instead would disarm the rule entirely and
        // the fixture would stop offending.
        sourceLicence: [],
      };
      const DRAFT = 'يرى الشيخ سالم المري العتيبي أن الوتر واجب. '
        + 'وصلاة الوتر سنة مؤكدة عن النبي صلى الله عليه وسلم. '
        + 'وأقلها ركعة وأكثرها إحدى عشرة ركعة، ووقتها بعد العشاء إلى الفجر.';
      const undisclaimed = CG.screenDraft(DRAFT, CTX);
      const disclaimed = CG.screenDraft(DRAFT, { ...CTX, attributionDisclaimed: true });
      // The fixture must actually offend, or both halves below are vacuous.
      if (ok('the fixture draft really does offend on the sentence naming him',
        undisclaimed.droppedSentences.length > 0, JSON.stringify(undisclaimed.droppedSentences))) {
        ok('UNDISCLAIMED: naming the subject still drops the whole draft',
          undisclaimed.dropWhole === true,
          'this is the older rule and it must survive — the attribution IS the answer there');
        ok('DISCLAIMED: the whole draft is NOT dropped', disclaimed.dropWhole === false);
        ok('...the offending sentence is still trimmed',
          !/الوتر واجب/.test(disclaimed.text), disclaimed.text);
        ok('...and the ruling survives to reach the reader',
          /سنة مؤكدة/.test(disclaimed.text) && /أقلها ركعة/.test(disclaimed.text), disclaimed.text);
      }
      // AND AN EMPTY REMAINDER IS STILL REFUSED. The disclaimer relaxes ONE escalation, not the
      // floor: a draft that is nothing but the attribution has no ruling left to save.
      const onlyAttribution = CG.screenDraft('يرى الشيخ سالم المري العتيبي أن الوتر واجب.',
        { ...CTX, attributionDisclaimed: true });
      ok('...but a draft with nothing left after trimming is STILL dropped whole',
        onlyAttribution.dropWhole === true,
        'relaxing this into "send the remainder" would ship an empty answer');

      // ── and the handler passes the flag from the sentence it actually printed ──
      const ask = read('api/ask.js');
      ok('api/ask.js derives the disclaimer from presenceLead, not from the plan',
        /attributionDisclaimed: !!presenceLead/.test(ask),
        'deriving it from the plan would disclaim on turns where nothing was said to the reader');
    }

    // =========================================================================
    console.log('\n=== M. THE IDENTITY PAGE EARNS A CARD, AND ONLY A REAL ONE (ج٤) ===');
    //
    // MEASURED: «من هو خالد عبدالرحمن» answered correctly — a Saudi singer, no shaykh's biography
    // — and shipped with ZERO cards, while the spec for this case reads «فنان ببطاقة». The answer
    // was built from a page the app fetched and read, and the reader had no way to see it.
    {
      const ask = read('api/ask.js');
      ok('the GEN branch writes a card for the identity page',
        /buildSourceTag\(\{ url: identityUrl/.test(ask));
      ok('...as a structured server-owned card, separate from filtered model text',
        /registerOwnedCards\(idCard \? \[idCard\] : \[\]\);[\s\S]{0,160}?finalizerContext\.readerCards = \[idCard\]/.test(ask),
        'the identity card must enter the finalizer as structured server data');
      // ...and it is the RECORD's `.tag`, not the record — measured: `'\n' + idCard` shipped
      // «[object Object]» to the reader.
      ok('...and it writes the card\'s .tag, not the record', /idCard && idCard\.tag/.test(ask));
      // ── AND A WHITELIST HIT GETS NO CARD, BECAUSE THERE IS NO PAGE ──────────
      ok('a whitelist verdict carries no URL, so no card can be invented for it',
        /identity\.source === 'whitelist' \? '' :/.test(ask),
        'a card for a table lookup is a citation to nothing');
    }

    // =========================================================================
    console.log('\n=== G. THE ROSTER ===');
    {
      const gates = JSON.parse(read('gates.json'));
      ok('gates.json lists this guard',
        gates.some((g) => g && g.script === 'guards/identity-guard.cjs'));
      ok('.gitattributes pins it to LF',
        /guards\/identity-guard\.cjs text eol=lf/.test(read('.gitattributes')));
    }
  } finally {
    if (safeFetchModule) safeFetchModule.__resetResolver();
    globalThis.fetch = realFetch;
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
