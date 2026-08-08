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
  // NOTHING IN THIS GATE MAY TOUCH THE NETWORK. A reach is a failure, not a slow pass.
  let reachedNetwork = 0;
  globalThis.fetch = async (u) => { reachedNetwork++; throw new Error('network reached: ' + u); };

  try {
    const ID = await esm('lib/identity/index.js');
    const WL = await esm('lib/identity/whitelist.js');
    const REG = await esm('lib/source-registry.js');

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
    console.log('\n=== G. THE ROSTER ===');
    {
      const gates = JSON.parse(read('gates.json'));
      ok('gates.json lists this guard',
        gates.some((g) => g && g.script === 'guards/identity-guard.cjs'));
      ok('.gitattributes pins it to LF',
        /guards\/identity-guard\.cjs text eol=lf/.test(read('.gitattributes')));
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks failed.'
    : 'OK: ' + checks + '/' + checks + ' checks passed.'));
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.error('GUARD THREW:', e); process.exit(2); });
