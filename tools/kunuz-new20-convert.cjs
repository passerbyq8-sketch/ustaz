// Local NEW20 conversion. Inputs stay in quest-review; no bank edits or network.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {isDeepStrictEqual} = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.resolve(ROOT, '../quest-review/kunuz-new-2026-10-19');
const INPUT_SHA256 = 'f8a00ebf4c221db20244d1df6b9c44c1686bca869433a0deba30138d66af3124';
const BANK_SHA256 = '2e70f6e3c70d8430828c80e35675f1ad50bb1a127488a41742c107d8f6e55e6c';
const geoContext = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'quest-data/kunuz-geo-index.js'), 'utf8'), geoContext);
const GEO = geoContext.KUNUZ_GEO_INDEX;
const MAP_NAMES = {
  Congo: 'Republic of the Congo', 'S. Sudan': 'South Sudan', 'Solomon Is.': 'Solomon Islands',
  "Côte d'Ivoire": 'Ivory Coast', 'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  Tanzania: 'United Republic of Tanzania', 'Dominican Rep.': 'Dominican Republic',
  'Antigua and Barb.': 'Antigua and Barbuda', 'Eq. Guinea': 'Equatorial Guinea',
  'Bosnia and Herz.': 'Bosnia and Herzegovina', 'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'Central African Rep.': 'Central African Republic', 'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  Bahamas: 'The Bahamas', 'Timor-Leste': 'East Timor'
};
// Descriptions of the visible clues, without naming the correct option in ARIA.
const BASIS = {
  'emoji-quiz-0016': ['جبل ذو قمة بيضاء', 'بركان'],
  'emoji-quiz-0035': ['كرات مقلية', 'أعشاب']
};
// Order and labels follow the assembled report. "visual" is the engine's
// بصريات وألغاز hub; each source group keeps its own category and pack slug.
const GROUPS = [
  ['map-quiz', 'خرائط', 'visual'],
  ['emoji-quiz', 'إيموجي', 'visual'],
  ['landmark-draw', 'معالم مرسومة', 'visual'],
  ['silhouette', 'ظلال أشياء', 'visual'],
  ['pattern-iq', 'أنماط وأشكال', 'visual'],
  ['kuwait-places', 'معالم الكويت ومناطقها', 'gulf'],
  ['gulf-cuisine', 'المطبخ الكويتي والخليجي', 'gulf'],
  ['occasions-calendar', 'الأعياد والمواسم والتقويم', 'world'],
  ['ancient-civilizations', 'الحضارات والآثار القديمة', 'world'],
  ['calligraphy-arts', 'الخط العربي والفنون', 'language'],
  ['books-authors', 'الكتب والمؤلفون', 'language'],
  ['physics-chemistry', 'الفيزياء والكيمياء المبسطة', 'science'],
  ['etiquette', 'أدب السلوك والآداب العامة', 'world'],
  ['gulf-history', 'الخليج: تاريخ وشخصيات', 'gulf'],
  ['fmt-proverb-cloze', 'أكمل المثل', 'language'],
  ['fmt-missing-letter', 'الحرف الناقص', 'language'],
  ['fmt-scramble', 'الكلمة المبعثرة', 'language'],
  ['fmt-odd-one', 'الدخيل بين أربعة', 'language'],
  ['fmt-connection', 'ما يربط الكلمات', 'language'],
  ['fmt-sequence', 'تسلسل منطقي', 'science']
];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const packPath = slug => 'quest-data/kunuz-pack-' + slug + '.js';
function stamp(qs) {
  let h = 2166136261;
  for (const q of qs) {
    const id = q.id + '\n';
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  return qs.length + '-' + h.toString(16).padStart(8, '0');
}
function hasFlag(q, flag) {
  return (q.flags || []).some(value => value === flag || value.startsWith(flag + ':'));
}
function missingPhoto(q, root) {
  if (!q.vis || q.vis.kind !== 'photo') return false;
  const src = q.vis.src;
  if (typeof src !== 'string' || !/^quest-data\/signs\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(src)) return true;
  const file = path.join(root, src);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return true;
  const bytes = fs.readFileSync(file);
  // An empty file or a mislabeled download is not an available image.
  return bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP';
}
function sourceText(source) {
  if (typeof source === 'string') {
    assert.ok(source.trim(), 'Empty source');
    return source;
  }
  assert.ok(source && typeof source.title === 'string' && source.title.trim(), 'Missing source title');
  assert.ok(typeof source.url === 'string' && source.url.trim(), 'Missing source URL');
  return source.title + ' — ' + source.url;
}
function convertVisual(q) {
  const v = q.vis;
  if (v === undefined) return undefined;
  if (v.kind === 'map') {
    const hit = v.hit.map(name => MAP_NAMES[name] || name);
    const b = GEO.views[v.view];
    assert.ok(b, q.id + ': unknown map view');
    for (const name of hit) assert.ok(Object.hasOwn(GEO.names, name), q.id + ': unknown map target ' + name);
    const inView = hit.every(name => {
      const a = GEO.names[name];
      return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
    });
    return {...v, hit, view: inView ? v.view : 'world'};
  }
  if (v.kind === 'emoji' && BASIS[q.id]) return {...v, basis: BASIS[q.id]};
  // These empty paths draw nothing and are rejected by the engine's d grammar.
  if (v.kind === 'svg') return {...v, svg: v.svg.replace(/<path d=""\/>/g, '')};
  return v;
}
function convertQuestion(q) {
  assert.ok(q.status === 'proposed' || q.status === 'approved', q.id + ': unexpected source status');
  return {
    id: q.id, cat: q.cat, type: q.type, fmt: q.fmt, q: q.q,
    ...(q.vis === undefined ? {} : {vis: convertVisual(q)}),
    choices: q.choices, answer: q.answer, why: q.why,
    src: q.src.map(sourceText), level: q.level, status: 'approved', flags: q.flags || []
  };
}
function selectGroup(rows, root = ROOT) {
  const qs = [], held = {religious: [], overlap: [], missingAssets: []};
  for (const q of rows) {
    const religious = hasFlag(q, 'owner-religious-review');
    const overlap = hasFlag(q, 'overlap-bank-text');
    const entry = {group: q.cat, ...q};
    // Preserve membership in both hold lists if future input has both flags.
    if (religious) held.religious.push(entry);
    if (overlap) held.overlap.push(entry);
    if (religious || overlap) continue;
    if (missingPhoto(q, root)) { held.missingAssets.push(entry); continue; }
    qs.push(convertQuestion(q));
  }
  return {qs, held};
}
function parsePack(body) {
  const match = /^\s*KZV\.register\(\s*([\s\S]*)\s*\);\s*$/.exec(body);
  assert.ok(match, 'Pack is not a strict KZV.register(JSON) envelope');
  return JSON.parse(match[1]);
}
function readInputs(input) {
  const bytes = fs.readFileSync(path.join(input, 'ALL-NEW20.json'));
  assert.equal(sha256(bytes), INPUT_SHA256, 'ALL-NEW20 differs from the ordered assembly');
  const all = JSON.parse(bytes.toString('utf8'));
  assert.equal(all.length, 6023);
  assert.equal(new Set(all.map(q => q.id)).size, all.length, 'Duplicate source ID');
  const groups = GROUPS.map(([slug]) => {
    const file = path.join(input, slug, 'final.json');
    const bytes = fs.readFileSync(file), rows = JSON.parse(bytes.toString('utf8'));
    assert.ok(Array.isArray(rows), slug + ': final.json is not an array');
    assert.ok(isDeepStrictEqual(rows, all.filter(q => q.cat === slug)), slug + ': final.json differs from ALL-NEW20');
    return {slug, rows, sha256: sha256(bytes)};
  });
  assert.equal(groups.reduce((n, group) => n + group.rows.length, 0), all.length, 'Unrecognized group');
  return groups;
}
function build(groups, root = ROOT) {
  const packs = [], held = {religious: [], overlap: [], missingAssets: []}, table = [];
  for (const [slug, name, group] of GROUPS) {
    const input = groups.find(row => row.slug === slug);
    assert.ok(input, 'Missing group ' + slug);
    const selected = selectGroup(input.rows, root);
    for (const key of Object.keys(held)) held[key].push(...selected.held[key]);
    table.push({
      group: slug, input: input.rows.length, converted: selected.qs.length,
      heldReligious: selected.held.religious.length, heldOverlap: selected.held.overlap.length,
      heldMissingAssets: selected.held.missingAssets.length
    });
    if (!selected.qs.length) continue;
    const pack = {slug, stamp: stamp(selected.qs), cats: [{id: slug, name, kind: 'general', group}], qs: selected.qs};
    const body = 'KZV.register(' + JSON.stringify(pack, null, 2) + ');\n';
    assert.deepEqual(parsePack(body), pack, slug + ': serialization changed data');
    packs.push({pack, file: packPath(slug), body, sha256: sha256(body)});
  }
  return {packs, held, table};
}
async function validatePacks(packs, root = ROOT) {
  // Reuse the real game's environment and actual renderer, including its SVG
  // sanitizer. Registration silently skips bad rows, so compare every loaded ID.
  const {open, bank} = require('../guards/kunuz-visual-world.cjs');
  assert.equal(sha256(fs.readFileSync(path.join(root, 'quest-data/kunuz-bank-3147.js'))), BANK_SHA256, 'Live bank changed');
  const world = await open('quest-test.html', {enabled: true});
  const ids = new Set(bank.qs.map(q => q[8]));
  for (const {pack} of packs) {
    assert.equal(pack.stamp, stamp(pack.qs), pack.slug + ': stamp mismatch');
    assert.equal(pack.stamp, world.ctx.KZV.stamp(pack.qs), pack.slug + ': engine stamp mismatch');
    for (const q of pack.qs) {
      assert.ok(!ids.has(q.id), 'Duplicate or bank-colliding ID: ' + q.id);
      ids.add(q.id);
      assert.equal(q.choices.length, 4, q.id + ': choices');
      assert.ok(q.choices.every(s => typeof s === 'string' && s.trim()), q.id + ': empty choice');
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.id + ': answer');
      assert.ok(Number.isInteger(q.level) && q.level >= 1 && q.level <= 3, q.id + ': level');
      assert.ok(q.src.length && q.src.every(s => typeof s === 'string' && s.trim()), q.id + ': sources');
      assert.ok(!hasFlag(q, 'owner-religious-review') && !hasFlag(q, 'overlap-bank-text'), q.id + ': held flag escaped');
      assert.ok(!missingPhoto(q, root), q.id + ': missing local photo');
      assert.equal(world.ctx.KZV.validateVisual(q.vis, q), true, q.id + ': visual rejected by engine');
      // Apply the standing entity/source restriction to these new packs only.
      assert.ok(!/isra[eë]l|\bISR\b|[اأإآ]سرائيل|https?:\/\/[^/\s]+\.il\b/i.test(JSON.stringify(q)), q.id + ': restricted entity/source');
    }
    const before = world.ctx.DATA.qs.length;
    assert.equal(world.ctx.KZV.register(pack), true, pack.slug + ': registration rejected');
    const loaded = world.ctx.DATA.qs.slice(before);
    assert.deepEqual(Array.from(loaded, q => q[8]), pack.qs.map(q => q.id), pack.slug + ': engine skipped rows');
    for (let i = 0; i < loaded.length; i++) {
      assert.equal(loaded[i].kzPack.level, pack.qs[i].level, pack.qs[i].id + ': engine level drift');
    }
  }
  assert.equal(world.errors.length, 0, world.errors.map(e => e.stack).join('\n'));
  return {packs: packs.length, questions: packs.reduce((n, p) => n + p.pack.qs.length, 0), bankSha256: BANK_SHA256};
}
function outputs(result, groups, input) {
  const manifest = '/* Generated by tools/kunuz-new20-convert.cjs. Local owner review only.\n' +
    '   The single PACKS_ENABLED switch in quest-visual.js stays false by default. */\n' +
    'var KUNUZ_PACKS=' + JSON.stringify(result.packs.map(p => ({slug: p.pack.slug, src: p.file})), null, 2) + ';\n';
  const audit = {
    inputSha256: INPUT_SHA256, bankSha256: BANK_SHA256,
    inputs: groups.map(g => ({file: g.slug + '/final.json', sha256: g.sha256})),
    groups: result.table,
    visualAdjustments: result.packs.flatMap(p => p.pack.qs.flatMap(q => {
      const original = groups.find(g => g.slug === p.pack.slug).rows.find(row => row.id === q.id);
      return isDeepStrictEqual(original.vis, q.vis) ? [] : [{
        id: q.id, group: p.pack.slug,
        reason: q.vis.kind === 'map' ? 'canonical map name / supported view' :
          q.vis.kind === 'emoji' ? 'answer-free accessible description' : 'remove invisible empty SVG path',
        before: original.vis, after: q.vis
      }];
    })),
    totals: {
      input: groups.reduce((n, g) => n + g.rows.length, 0),
      converted: result.packs.reduce((n, p) => n + p.pack.qs.length, 0),
      heldReligious: result.held.religious.length, heldOverlap: result.held.overlap.length,
      heldMissingAssets: result.held.missingAssets.length
    },
    emptyGroups: result.table.filter(g => g.input === 0).map(g => g.group),
    packs: result.packs.map(p => ({file: p.file, stamp: p.pack.stamp, sha256: p.sha256}))
  };
  return [
    ...result.packs.map(p => ({file: path.join(ROOT, p.file), body: p.body})),
    {file: path.join(ROOT, 'quest-data/kunuz-packs-manifest.js'), body: manifest},
    {file: path.join(input, '_held/religious-held.json'), body: json(result.held.religious)},
    {file: path.join(input, '_held/overlap-held.json'), body: json(result.held.overlap)},
    {file: path.join(input, '_held/missing-assets.json'), body: json(result.held.missingAssets)},
    {file: path.join(input, '_held/conversion-audit.json'), body: json(audit)}
  ];
}
async function main(args = process.argv.slice(2)) {
  let input = DEFAULT_INPUT, check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--input' && args[i + 1]) input = path.resolve(args[++i]);
    else throw Error('Usage: node tools/kunuz-new20-convert.cjs [--input DIR] [--check]');
  }
  assert.ok(/^var PACKS_ENABLED=false;$/m.test(fs.readFileSync(path.join(ROOT, 'quest-visual.js'), 'utf8')), 'Packs must remain OFF by default');
  const groups = readInputs(input), result = build(groups);
  assert.equal(result.held.religious.length, 206, 'Religious hold count changed');
  assert.equal(result.held.overlap.length, 83, 'Overlap hold count changed');
  assert.equal(groups.find(g => g.slug === 'fmt-odd-one').rows.length, 0);
  assert.ok(!fs.existsSync(path.join(ROOT, packPath('fmt-odd-one'))), 'Empty group must not have a pack');
  const verified = await validatePacks(result.packs);
  const files = outputs(result, groups, input);
  for (const {file, body} of files) {
    if (check) assert.equal(fs.readFileSync(file, 'utf8'), body, 'Generated bytes differ: ' + file);
    else {
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, body, 'utf8');
    }
  }
  assert.equal(sha256(fs.readFileSync(path.join(ROOT, 'quest-data/kunuz-bank-3147.js'))), BANK_SHA256);
  console.log(JSON.stringify({mode: check ? 'check' : 'write', ...verified, heldReligious: result.held.religious.length,
    heldOverlap: result.held.overlap.length, heldMissingAssets: result.held.missingAssets.length, files: files.length}));
}
module.exports = {ROOT, GROUPS, INPUT_SHA256, BANK_SHA256, sha256, stamp, packPath, parsePack,
  sourceText, convertVisual, convertQuestion, selectGroup, readInputs, build, validatePacks, outputs, main};
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
