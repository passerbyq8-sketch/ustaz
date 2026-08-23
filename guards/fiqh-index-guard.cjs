// guards/fiqh-index-guard.cjs -- keep printed-edition footnotes out of the fiqh term index.
//
// This guard is intentionally data-only. It reads the repository fixture and compressed index,
// performs no network access, and imports no retrieval code. The reader remains unchanged.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const CORPUS = path.join(ROOT, 'lib', 'data', 'fiqh-search.json.gz');
const FIXTURE_PATH = path.join(__dirname, 'fixtures-fiqh-index.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

let checks = 0;
let failures = 0;

function ascii(value) {
  return String(value).replace(/[^\x20-\x7e]/g, '?');
}

function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log('  PASS  ' + name);
    return true;
  }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + ascii(detail) : ''));
  return false;
}

function normalizeArabic(value) {
  return String(value).normalize('NFKD').replace(/[\u064b-\u065f\u0670\u0640]/gu, '');
}

// These are structural sentence forms measured in the removed rows. They describe bare
// biography, bibliography and printed cross-reference fragments, not fiqh headwords.
const NOISE_PATTERNS = Object.freeze([
  /^\u062a\u0642\u062f\u0645\u062a \u062a?\u0631\u062c\u0645\u062a\u0647 \u0641\u064a \u062c ?\d+ \u0635 ?\d+\.?$/u,
  /^\u0645\u0646 \u0627\u062b\u0627\u0631\u0647: .+\.$/u,
  /^\(?[^()]*\d+\\\d+(?:\u060c [^()]*\d+\\\d+)+\)?\.$/u,
  /^\u0648\u062e\u0627\u0644\u0641 \u0641\u064a \u0630\u0644\u0643 .+\u060c$/u,
  /^\u0648\u0644\u0644\u062a\u0641\u0635\u064a\u0644: \u0631: .+\.$/u,
  /^\u0642\u0627\u0644 .+: \u0647\u0630\u0647 \u0627\u0644\u0627\u064a\u0629 \(\u064a\u0639\u0646\u064a \u0627\u0644\u0627\u064a\u0629$/u
]);

function isNoise(entry) {
  return Boolean(entry)
    && entry.snippet === ''
    && typeof entry.term === 'string'
    && NOISE_PATTERNS.some((pattern) => pattern.test(normalizeArabic(entry.term)));
}

function countPasses(entries) {
  return Array.isArray(entries) && entries.length === FIXTURE.expected_entry_count;
}

function removedKeysPass(entries) {
  if (!Array.isArray(entries)) return false;
  const present = new Set(entries.map((entry) => entry && entry.id));
  return FIXTURE.removed_keys.every((key) => !present.has(key));
}

function noiseShapePass(entries) {
  return Array.isArray(entries) && entries.every((entry) => !isNoise(entry));
}

function finish() {
  console.log('\nMUTANTS_KILLED=' + killedMutants + '/' + totalMutants);
  console.log('=== ' + (checks - failures) + '/' + checks
    + (failures ? ' -- FAIL ===' : ' -- PASS ==='));
  process.exit(failures ? 1 : 0);
}

console.log('=== fiqh-index-guard -- terms only, no printed-edition footnotes ===');

const removedUnique = new Set(FIXTURE.removed_keys);
const removedTextKeys = Object.keys(FIXTURE.removed_text_b64);
check('fixture has the 25 frozen unique removed keys',
  FIXTURE.removed_keys.length === 25 && removedUnique.size === 25);
check('fixture raw-text keys equal the frozen removed-key list',
  removedTextKeys.length === FIXTURE.removed_keys.length
    && removedTextKeys.every((key, index) => key === FIXTURE.removed_keys[index]));
check('every frozen raw text is recognized as a noise shape',
  FIXTURE.removed_keys.every((key) => isNoise({
    term: Buffer.from(FIXTURE.removed_text_b64[key], 'base64').toString('utf8'),
    snippet: ''
  })));

let corpusBytes = null;
let uncompressed = null;
let entries = null;
let parseError = null;
try {
  corpusBytes = fs.readFileSync(CORPUS);
  uncompressed = zlib.gunzipSync(corpusBytes);
  entries = JSON.parse(uncompressed.toString('utf8'));
} catch (error) {
  parseError = error;
}

// A) The compressed artifact must decompress and parse.
check('A) fiqh index decompresses and parses',
  parseError === null && Buffer.isBuffer(uncompressed) && entries !== null,
  parseError && parseError.message);

// B) The count is exact, not a range.
check('B) entry count equals the measured NEW_ENTRY_COUNT exactly',
  countPasses(entries),
  'expected ' + FIXTURE.expected_entry_count + ', got '
    + (Array.isArray(entries) ? entries.length : 'NON_ARRAY'));

// C) Every frozen removed key remains absent.
const presentRemoved = Array.isArray(entries)
  ? FIXTURE.removed_keys.filter((key) => entries.some((entry) => entry && entry.id === key))
  : FIXTURE.removed_keys.slice();
check('C) none of the frozen removed keys is present',
  removedKeysPass(entries),
  presentRemoved.join(','));

// D) A new key cannot smuggle the same printed-reference shape back in.
const remainingNoise = Array.isArray(entries)
  ? entries.filter(isNoise).map((entry) => entry.id)
  : ['NON_ARRAY'];
check('D) no remaining entry matches the measured noise shape',
  noiseShapePass(entries),
  remainingNoise.join(','));

// E) Twenty explicitly named, substantive term rows anchor the retained corpus.
const samples = FIXTURE.sample_terms;
const byId = new Map(Array.isArray(entries) ? entries.map((entry) => [entry.id, entry]) : []);
const badSamples = samples.filter((sample) => {
  const entry = byId.get(sample.id);
  return !entry
    || entry.term !== sample.term
    || entry.term.trim() === ''
    || typeof entry.search !== 'string'
    || entry.search.trim() === ''
    || typeof entry.snippet !== 'string'
    || entry.snippet.trim() === '';
});
check('E) at least 20 explicitly named real terms are present and non-empty',
  samples.length >= 20
    && new Set(samples.map((sample) => sample.id)).size === samples.length
    && badSamples.length === 0,
  badSamples.map((sample) => sample.id).join(','));

// F) The bytes and parsed value retain the measured top-level form.
const gzipMagic = Buffer.isBuffer(corpusBytes)
  && corpusBytes.length >= 2
  && corpusBytes[0] === 0x1f
  && corpusBytes[1] === 0x8b;
check('F) file has gzip magic and parses to the measured array shape',
  gzipMagic && FIXTURE.top_level_shape === 'array' && Array.isArray(entries),
  'magic=' + (Buffer.isBuffer(corpusBytes) ? corpusBytes.subarray(0, 2).toString('hex') : 'NONE'));

if (Array.isArray(entries)) {
  console.log('ENTRY_COUNT=' + entries.length);
  console.log('GZ_BYTES=' + corpusBytes.length);
  console.log('TOP_LEVEL_SHAPE=array');
}

// Mutation proof for B, C and D. Each mutant changes only the tested property while the other
// two property predicates continue to pass.
let killedMutants = 0;
const totalMutants = 3;
if (Array.isArray(entries) && entries.length > 0) {
  const mutantB = entries.concat([{ ...entries[0] }]);
  const killedB = !countPasses(mutantB)
    && removedKeysPass(mutantB)
    && noiseShapePass(mutantB)
    && countPasses(entries);
  if (check('MUTANT B KILLED: one extra row breaks the exact count', killedB)) killedMutants += 1;

  const mutantC = entries.map((entry, index) => (
    index === 0 ? { ...entry, id: FIXTURE.removed_keys[0] } : entry
  ));
  const killedC = countPasses(mutantC)
    && !removedKeysPass(mutantC)
    && noiseShapePass(mutantC)
    && removedKeysPass(entries);
  if (check('MUTANT C KILLED: a frozen key cannot return', killedC)) killedMutants += 1;

  const noiseTerm = Buffer.from(
    FIXTURE.removed_text_b64[FIXTURE.removed_keys[0]], 'base64'
  ).toString('utf8');
  const mutantD = entries.map((entry, index) => (
    index === 0 ? { ...entry, term: noiseTerm, search: noiseTerm, snippet: '' } : entry
  ));
  const killedD = countPasses(mutantD)
    && removedKeysPass(mutantD)
    && !noiseShapePass(mutantD)
    && noiseShapePass(entries);
  if (check('MUTANT D KILLED: a new-key noise row is detected', killedD)) killedMutants += 1;
} else {
  check('MUTANT B KILLED: one extra row breaks the exact count', false, 'real corpus unavailable');
  check('MUTANT C KILLED: a frozen key cannot return', false, 'real corpus unavailable');
  check('MUTANT D KILLED: a new-key noise row is detected', false, 'real corpus unavailable');
}

finish();
