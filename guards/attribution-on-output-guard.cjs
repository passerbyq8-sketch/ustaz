// guards/attribution-on-output-guard.cjs — a name needs this-turn evidence from its own source.
//
// SECTION E (merge round, §٣) is the half that makes the rule usable instead of merely safe. The
// registry this guard tests is DERIVED from lib/fatwa-contract.js and lib/source-registry.js, so
// two things have to be proved that a hand-written list never had to prove:
//
//   1. IT HAS NOT DRIFTED. The table is inlined in lib/output-reviewer.js — that module is pure
//      by contract and its mutant harness copies the file alone into a temp directory, so it
//      cannot import its sources. Section E re-derives the table from those sources here and
//      compares it row for row. Move a scholar's domain in the contract and this goes red.
//   2. IT ACTUALLY KEEPS REAL ATTRIBUTIONS. `fixtures/fatwa-authority-eighteen.json` holds ONE
//      REAL PUBLISHED FATWA for each of the eighteen scholars, harvested from the live fatwa
//      service and shaped by the production path (`normalizeRecord` -> the loop's table row ->
//      `reviewerEvidence`). Each case claims the fatwa's own first clause in the scholar's name.
//      Expected: 18/18 kept, zero false stripping.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { fresh, runMutant, harness } = require('./output-reviewer-mutant-lib.cjs');
const ROOT = path.resolve(__dirname, '..');
const REVIEWER = path.join(ROOT, 'lib', 'output-reviewer.js');
const EIGHTEEN = path.join(ROOT, 'fixtures', 'fatwa-authority-eighteen.json');
const { ok, finish } = harness('attribution-on-output');

// ── THE DERIVATION, STATED ONCE ─────────────────────────────────────────────
// The same two rules the header of the registry in lib/output-reviewer.js describes. Written out
// rather than imported from a shared helper on purpose: a guard that shares its derivation with
// the thing it checks proves only that one copy equals itself.
const EXPECTED_HOST_EXTRA = { aljasser: ['youtube.com', 'youtu.be', 'dr-mutlaq.com'] };
const INSTITUTIONAL_KINDS = ['fatwa-portal', 'official-fatwa'];

// A mutant of lib/fatwa-contract.js runs from a temp directory, so its relative imports have to
// be rewritten to absolute URLs or the twin cannot load at all.
function absolutize(source) {
  const lib = path.join(ROOT, 'lib');
  return source.replace(/from\s+([\x27"])(\.\/[^\x27"]+)\1/gu, (_all, quote, specifier) =>
    `from ${quote}${pathToFileURL(path.resolve(lib, specifier)).href}${quote}`);
}

function fold(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/gu, '')
    .replace(/[إأآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه').replace(/ـ/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

async function deriveRegistry() {
  const contract = await fresh(path.join(ROOT, 'lib', 'fatwa-contract.js'), 'derive-contract');
  const registry = await fresh(path.join(ROOT, 'lib', 'source-registry.js'), 'derive-sources');
  const rows = [];
  for (const scholar of contract.FATWA_SCHOLARS) {
    const aliases = [...new Set([scholar.name, scholar.formalName, ...scholar.aliases].filter(Boolean))];
    const hosts = new Set([scholar.sourceDomain, ...(EXPECTED_HOST_EXTRA[scholar.id] || [])]);
    for (const site of registry.SCHOLAR_SITES) {
      const overlap = site.aliases.some((alias) => aliases.some((known) => {
        const a = fold(alias);
        const b = fold(known);
        return a && b && (a === b || a.includes(b) || b.includes(a));
      }));
      if (overlap) hosts.add(site.domain);
    }
    rows.push({
      canonical: scholar.name,
      aliases,
      hosts: [...hosts],
      ids: [...new Set([`${scholar.id}:`, `${scholar.canonicalId}:`])],
    });
  }
  for (const source of registry.SOURCES) {
    if (!INSTITUTIONAL_KINDS.includes(source.kind) || source.status !== 'active') continue;
    if (rows.some((row) => row.hosts.includes(source.domain) && fold(row.canonical) === fold(source.name))) continue;
    rows.push({
      canonical: source.name,
      aliases: [source.name],
      hosts: [source.domain],
      ids: [`${source.id}:`],
    });
  }
  return rows;
}

const plain = (rows) => JSON.stringify(rows.map((row) => ({
  canonical: row.canonical,
  aliases: [...row.aliases],
  hosts: [...row.hosts],
  ids: [...row.ids],
})));

const semanticClaim = 'الجمع للمسافر جائز عند الحاجة.';
const text = 'قال ابن باز إن ' + semanticClaim;
const supporting = {
  id: 'bb-1', title: 'حكم الجمع للمسافر', url: 'https://binbaz.org.sa/fatwas/1/x',
  scholar: 'ابن باز', snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
};
const wrongScholar = {
  id: 'wrong-1', title: 'حكم الجمع للمسافر', url: 'https://binbaz.org.sa/fatwas/2/x',
  scholar: 'ابن عثيمين', snippet: 'الجمع للمسافر جائز عند الحاجة إذا وجد سببه.',
};
const oppositeRuling = {
  ...supporting,
  id: 'bb-opposite',
  snippet: 'الجمع للمسافر غير جائز في هذه الصورة ولا يباح له فعله.',
};
const input = (evidence) => ({ text, evidence, domain: 'fiqh', mode: 'عادي' });
const preservesCompleteUnsupportedClaim = (module, out) => out.text
  === semanticClaim + ' ' + module.REVIEW_TAGS.ATTRIBUTION_REMOVED
  && out.annotations[0]?.action === 'removed-unsupported-attribution';
const rejectsWrongScholar = (module) => {
  const out = module.reviewAnswer(input([wrongScholar]));
  return !out.text.includes('ابن باز')
    && preservesCompleteUnsupportedClaim(module, out);
};

(async () => {
  try {
    const module = await fresh(REVIEWER, 'attribution-base');
    const good = module.reviewAnswer(input([supporting]));
    ok('matching name + official domain + supporting snippet passes byte-identically',
      good.text === text && good.annotations[0]?.action === 'kept-sourced-attribution', good.text);
    const nextCycle = module.reviewAnswer(input([]));
    ok('evidence from the preceding call grants no licence in the next cycle',
      !nextCycle.text.includes('ابن باز') && preservesCompleteUnsupportedClaim(module, nextCycle), nextCycle.text);
    ok('evidence for another scholar strips the attribution and keeps the claim',
      rejectsWrongScholar(module), module.reviewAnswer(input([wrongScholar])).text);
    const wrongDomain = { ...supporting, url: 'https://example.test/fatwa/1' };
    ok('matching name on the wrong domain is not a licence',
      rejectsWrongScholar({
        ...module,
        reviewAnswer: () => module.reviewAnswer(input([wrongDomain])),
      }), module.reviewAnswer(input([wrongDomain])).text);
    const irrelevant = { ...supporting, snippet: 'هذا نص في زكاة الحبوب والثمار.' };
    ok('the right scholar and host with an unrelated snippet is not a licence',
      preservesCompleteUnsupportedClaim(module, module.reviewAnswer(input([irrelevant]))));
    ok('the right scholar and host carrying the opposite ruling is not a licence',
      preservesCompleteUnsupportedClaim(module, module.reviewAnswer(input([oppositeRuling]))));
    const honorific = module.reviewAnswer(input([{ ...supporting, scholar: 'الشيخ ابن باز' }]));
    ok('an honorific in evidence does not break the exact authority match',
      honorific.text === text && honorific.annotations[0]?.action === 'kept-sourced-attribution');
    const joinedHonorific = module.reviewAnswer(input([{ ...supporting, scholar: 'والشيخ ابن باز' }]));
    ok('a joined Arabic conjunction before an honorific still resolves the exact authority',
      joinedHonorific.text === text && joinedHonorific.annotations[0]?.action === 'kept-sourced-attribution');
    for (const { framed, claim } of [
      { framed: 'يرى ابن باز جواز الجمع للمسافر.', claim: 'جواز الجمع للمسافر.' },
      { framed: 'رأي الشيخ ابن باز أن الجمع للمسافر جائز.', claim: 'الجمع للمسافر جائز.' },
      { framed: 'ابن باز يرى أن الجمع للمسافر جائز.', claim: 'الجمع للمسافر جائز.' },
      { framed: 'حكم ابن باز هو تحريم الدخان.', claim: 'هو تحريم الدخان.' },
      { framed: 'ابن باز يحرّم الدخان.', claim: 'يحرّم الدخان.' },
      { framed: 'قال ابنُ بازٍ بجواز الجمع للمسافر.', claim: 'جواز الجمع للمسافر.' },
      { framed: 'وفقًا لابن باز، الجمع للمسافر جائز.', claim: 'الجمع للمسافر جائز.' },
    ]) {
      const out = module.reviewAnswer({ text: framed, evidence: [], domain: 'fiqh', mode: 'عادي' });
      ok('unsupported attribution frame is removed without semantic damage: ' + framed,
        out.annotations[0]?.action === 'removed-unsupported-attribution'
          && !out.text.includes('ابن باز')
          && out.text === claim + ' ' + module.REVIEW_TAGS.ATTRIBUTION_REMOVED, out.text);
    }

    const mutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'wrong-scholar-counts-as-same',
      transform: (source) => source.replace(
        'sameAuthority(attribution.claimed, item.scholar)\n    && officialSourceFor(attribution.claimed, item)',
        'Boolean(item.scholar)\n    && officialSourceFor(attribution.claimed, item)'),
      survives: rejectsWrongScholar,
    });
    ok('mutant seam applied', mutant.changed, mutant.error);
    ok('mutant module loaded successfully', mutant.loaded, mutant.error);
    ok('MUTANT KILLED: another scholar on the claimed domain cannot license the name',
      mutant.loaded && mutant.survived === false, JSON.stringify(mutant));

    const supportMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'right-name-and-host-license-opposite-ruling',
      transform: (source) => source.replace('\n    && supportsSentence(sentence, item)) || null;', ') || null;'),
      survives: (mutantModule) => mutantModule.reviewAnswer(input([oppositeRuling]))
        .annotations[0]?.action === 'removed-unsupported-attribution',
    });
    ok('support mutant seam applied', supportMutant.changed, supportMutant.error);
    ok('support mutant module loaded successfully', supportMutant.loaded, supportMutant.error);
    ok('MUTANT KILLED: matching identity cannot license the opposite ruling',
      supportMutant.loaded && supportMutant.survived === false, JSON.stringify(supportMutant));

    // ── E. THE DERIVED REGISTRY (merge §٣) ────────────────────────────────
    const derived = await deriveRegistry();
    ok('the registry covers every measured fatwa scholar and every institutional publisher',
      derived.length === 21, 'derived=' + derived.length);
    ok('the inlined registry has not drifted from lib/fatwa-contract.js + lib/source-registry.js',
      plain(module.REVIEW_AUTHORITY_SOURCES) === plain(derived),
      'inlined=' + plain(module.REVIEW_AUTHORITY_SOURCES).slice(0, 400)
        + ' || derived=' + plain(derived).slice(0, 400));
    ok('no authority is licensed by a host this application never registered',
      module.REVIEW_AUTHORITY_SOURCES.every((row) => row.hosts.length > 0)
        && !JSON.stringify(module.REVIEW_AUTHORITY_SOURCES).includes('dar-alifta'),
      'a host survives that appears in no source of truth');

    // 18/18: one real published fatwa per scholar, its attribution kept.
    const eighteen = JSON.parse(fs.readFileSync(EIGHTEEN, 'utf8'));
    ok('the eighteen-scholar fixture schema is exact',
      eighteen.schema === 'ezik.fatwa-authority.eighteen.v1');
    ok('the fixture carries one real fatwa for each of the eighteen',
      Array.isArray(eighteen.cases) && eighteen.cases.length === 18
        && eighteen.cases.every((entry) => !entry.error), JSON.stringify(eighteen.cases?.length));
    const keeps = (mod) => eighteen.cases.every((entry) => {
      const out = mod.reviewAnswer({ text: entry.claim, evidence: [entry.evidence], domain: 'fiqh', mode: 'عادي' });
      return out.annotations[0]?.action === 'kept-sourced-attribution' && out.text.includes(entry.name);
    });
    for (const entry of eighteen.cases) {
      const out = module.reviewAnswer({ text: entry.claim, evidence: [entry.evidence], domain: 'fiqh', mode: 'عادي' });
      ok(`a real ${entry.name} fatwa on its own source keeps its attribution`,
        out.annotations[0]?.action === 'kept-sourced-attribution' && out.text.includes(entry.name),
        (out.annotations[0]?.action || '?') + ' | ' + out.text.slice(0, 120));
    }
    ok('18/18 — zero false stripping across the whole measured roster', keeps(module));

    // ...and the same eighteen with NO evidence are still handled, so the pass above is the
    // registry working and not the check being switched off. Removal is not counted as success by
    // itself: the claim must retain substantive words from the published ruling. If the seam is
    // unsafe, keeping the original sentence visibly marked is the correct alternative.
    const unsupportedKeepsMeaning = (entry) => {
      const out = module.reviewAnswer({ text: entry.claim, evidence: [], domain: 'fiqh', mode: 'عادي' });
      const action = out.annotations[0]?.action;
      const handled = action === 'removed-unsupported-attribution'
        || action === 'kept-unsupported-attribution-marked';
      const sourceTokens = fold(entry.evidence.snippet).split(' ').filter((token) => token.length > 2);
      const reviewed = ` ${fold(out.text)} `;
      const overlap = sourceTokens.filter((token) => reviewed.includes(` ${token} `)).length;
      return handled
        && out.text.includes(module.REVIEW_TAGS.ATTRIBUTION_REMOVED)
        && overlap >= Math.min(3, sourceTokens.length);
    };
    ok('the same eighteen claims without evidence remain marked and semantically intact',
      eighteen.cases.every(unsupportedKeepsMeaning));

    // M3 — the pre-derivation registry: only the five hand-written rows. Thirteen scholars lose
    // their names again, which is the defect §٣ was ordered to close.
    const registryMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'registry-shrunk-to-the-hand-written-five',
      transform: (source) => source.replace(
        /const AUTHORITY_SOURCES = Object\.freeze\(\[[\s\S]*?\n\]\);/u,
        `const AUTHORITY_SOURCES = Object.freeze([
  Object.freeze({ canonical: 'ابن باز', aliases: Object.freeze(['ابن باز']), hosts: Object.freeze(['binbaz.org.sa']), ids: Object.freeze(['binbaz:']) }),
  Object.freeze({ canonical: 'ابن عثيمين', aliases: Object.freeze(['ابن عثيمين']), hosts: Object.freeze(['binothaimeen.net']), ids: Object.freeze(['binothaimeen:']) }),
]);`),
      survives: keeps,
    });
    ok('registry mutant seam applied', registryMutant.changed, registryMutant.error);
    ok('registry mutant module loaded successfully', registryMutant.loaded, registryMutant.error);
    ok('MUTANT KILLED: a registry narrower than the measured roster cannot keep 18/18',
      registryMutant.loaded && registryMutant.survived === false, JSON.stringify(registryMutant));

    // M4 — raw substring matching in `authorityRule`, the exact form that resolved
    // «عبدالعزيز الراجحي» to «المفتي عبدالعزيز آل الشيخ» and stripped a real attribution.
    const wordMutant = await runMutant({
      sourceFile: REVIEWER,
      name: 'authority-rule-matches-raw-substrings',
      transform: (source) => source.replace(
        /    return candidate === wanted\r?\n\s*\|\| containsWholeWords\(candidate, wanted\)\r?\n\s*\|\| containsWholeWords\(wanted, candidate\);/u,
        '    return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);'),
      survives: keeps,
    });
    ok('word-boundary mutant seam applied', wordMutant.changed, wordMutant.error);
    ok('word-boundary mutant module loaded successfully', wordMutant.loaded, wordMutant.error);
    ok('MUTANT KILLED: raw substring matching cannot keep 18/18',
      wordMutant.loaded && wordMutant.survived === false, JSON.stringify(wordMutant));

    // ── F. THE CORRECTED NAMES (item 71) ──────────────────────────────────
    // Two rows published a name the corpus does not support, and a name in lib/fatwa-contract.js
    // is a KEY: resolveFatwaScholar() matches on `aliases` only. So the correction had to be a
    // UNION — the corrected name must resolve, and the superseded name must go on resolving,
    // because the fatwa service still returns it as `shortName` on every card it serves.
    const contract = await fresh(path.join(ROOT, 'lib', 'fatwa-contract.js'), 'names-71');
    const NAME_SUBJECTS = [
      ['النجدي الأثري', 'alathary', 'superseded'],
      ['محمد الحمود النجدي', 'alathary', 'corrected'],
      ['محمد النجدي', 'alathary', 'corrected'],
      ['الحمود النجدي', 'alathary', 'corrected'],
      ['سعد الماجد', 'salmajed', 'superseded'],
      ['سليمان الماجد', 'salmajed', 'corrected'],
      ['سليمان بن عبدالله الماجد', 'salmajed', 'corrected'],
      ['سليمان بن عبد الله الماجد', 'salmajed', 'corrected'],
    ];
    for (const [name, expected, kind] of NAME_SUBJECTS) {
      const hit = contract.resolveFatwaScholar(name);
      ok(`the ${kind} name «${name}» resolves to ${expected}`, !!hit && hit.id === expected,
        'got ' + (hit ? hit.id : 'null'));
    }
    // The identifiers are load-bearing in served uids (`salmajed:fatwa:salmajed:6184`) and in the
    // reviewer's `ids` prefixes. The aljasser ⟶ drmutlaq precedent is a silent empty dropdown.
    for (const [id, canonicalId] of [['alathary', 'al-najdi-al-athary'], ['salmajed', 'saad-al-majed']]) {
      const row = contract.FATWA_SCHOLARS.find((entry) => entry.id === id);
      ok(`${id} keeps its identifiers while its display name moves`,
        !!row && row.canonicalId === canonicalId, JSON.stringify(row && row.canonicalId));
    }

    // The corrected name, asserted over the SAME real published fatwa the fixture carries, is
    // licensed by the same host. Nothing is harvested here: only the claim sentence is restated.
    const CORRECTED = { alathary: 'محمد الحمود النجدي', salmajed: 'سليمان الماجد' };
    for (const entry of eighteen.cases) {
      const corrected = CORRECTED[entry.scholarId];
      if (!corrected) continue;
      const claim = entry.claim.replace(entry.name, corrected);
      ok(`«${corrected}» is not the name in the claim yet`, claim !== entry.claim, entry.claim);
      const out = module.reviewAnswer({ text: claim, evidence: [entry.evidence], domain: 'fiqh', mode: 'عادي' });
      ok(`a real ${entry.scholarId} fatwa keeps its attribution under the corrected name «${corrected}»`,
        out.annotations[0]?.action === 'kept-sourced-attribution' && out.text.includes(corrected),
        (out.annotations[0]?.action || '?') + ' | ' + out.text.slice(0, 120));
    }

    // M5 — the correction written as a RENAME instead of a union: the superseded name is dropped
    // from the contract. Every card the service still serves under it loses its attribution, which
    // is the silent regression the union exists to prevent.
    const CONTRACT_FILE = path.join(ROOT, 'lib', 'fatwa-contract.js');
    const renameMutant = await runMutant({
      sourceFile: CONTRACT_FILE,
      name: 'corrected-names-written-as-a-rename',
      transform: (source) => absolutize(source)
        .replace("'سليمان الماجد', 'سعد الماجد', 'الماجد'", "'سليمان الماجد'")
        .replace("'عبدالله النجدي الأثري', 'عبد الله النجدي الاثري', 'النجدي الأثري'", "'محمد الحمود النجدي'"),
      survives: async (mutant) => ['سعد الماجد', 'النجدي الأثري']
        .every((name) => mutant.resolveFatwaScholar(name) !== null),
    });
    ok('rename mutant seam applied', renameMutant.changed, renameMutant.error);
    ok('rename mutant module loaded successfully', renameMutant.loaded, renameMutant.error);
    ok('MUTANT KILLED: a rename instead of a union stops resolving the name the service still serves',
      renameMutant.loaded && renameMutant.survived === false, JSON.stringify(renameMutant));

  } catch (error) {
    ok('guard completed without exception', false, error?.stack || String(error));
  }
  process.exit(finish());
})();
