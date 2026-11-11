// tools/request-plan-score.mjs -- BRAIN-A (2026-11-11): SCORE A REQUEST PLAN AGAINST WHAT A STRONG READER WOULD WRITE.
//
// fixtures/request-plan-expected.json holds, for the 48 witness questions of the BRAIN-XRAY inspection and the four further
// questions of the 26 recorded on production, the plan a strong reader would write (`ideal`) and what any acceptable plan must
// satisfy (`must`). It was written BEFORE the reading's prompt and reviewed by a fresh-context helper; a prompt is measured
// against it, never fitted to it. This file is the one scorer: the gate `requestplan` runs it over the ideal plans (the fixture
// agrees with itself), and the brain session runs it over the plans captured on the preview.
//
//   node tools/request-plan-score.mjs <captured.json>
//       captured.json: { "<id>": <plan as lib/request-plan.js parsePlan returns it, or the raw model text>, ... }
//       prints one line per id (ASCII) and the totals; exit 1 when any plan fails.
//
// The checks read FOLDED text (lib/route-classify.js normalizeArabic), so a hamza or a vowel mark never fails a plan.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const lib = (rel) => import(pathToFileURL(join(here, '..', 'lib', rel)).href);

const list = (v) => (Array.isArray(v) ? v : []);
const has = (hay, needle, fold) => fold(hay).includes(fold(needle));
// one entry of an ALL list: a term, or an array of terms of which one is enough
const hasEntry = (hay, entry, fold) => (Array.isArray(entry) ? entry.some((term) => has(hay, term, fold)) : has(hay, entry, fold));
const entryText = (entry) => (Array.isArray(entry) ? entry.join(' | ') : String(entry));

/**
 * @param {object} plan  a normalised plan: { followup, full, parts: [{name, q, kind, needs, source, act, chapter}], c }
 * @param {object} must  the expectations of the fixture
 * @param {(s:string)=>string} fold  normalizeArabic
 * @returns {{ok:boolean, failures:string[]}}
 */
export function scorePlan(plan, must, fold) {
  const failures = [];
  const fail = (text) => failures.push(text);
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.parts)) return { ok: false, failures: ['no plan'] };
  const parts = plan.parts;
  const [min, max] = list(must.parts).length === 2 ? must.parts : [1, 5];
  if (parts.length < min || parts.length > max) fail(`parts ${parts.length} not in [${min}, ${max}]`);
  if (typeof must.followup === 'boolean' && (plan.followup === true) !== must.followup) fail(`followup ${plan.followup === true} (wanted ${must.followup})`);
  // a follow-up without the full question it continues is not read as one
  if (plan.followup === true && !String(plan.full || '').trim()) fail('followup with an empty full');
  // the full question is checked where there is one to check: the plan is a follow-up, or the fixture requires it to be
  if (plan.followup === true || must.followup === true) {
    for (const term of list(must.fullAll)) if (!hasEntry(plan.full || '', term, fold)) fail(`full lacks «${entryText(term)}»`);
    for (const term of list(must.fullNone)) if (has(plan.full || '', term, fold)) fail(`full carries «${term}»`);
    if (list(must.fullAny).length && !must.fullAny.some((term) => has(plan.full || '', term, fold))) fail('full has none of: ' + must.fullAny.join(' | '));
  }
  list(must.part).forEach((want, i) => {
    const part = parts[i];
    if (!part) return;
    const at = `part ${i + 1}`;
    if (list(want.kindAny).length && !want.kindAny.includes(part.kind)) fail(`${at} kind ${part.kind} not in ${want.kindAny.join('|')}`);
    for (const term of list(want.qAll)) if (!hasEntry(part.q, term, fold)) fail(`${at} q lacks «${entryText(term)}»`);
    for (const term of list(want.nameNone)) if (has(part.name || '', term, fold)) fail(`${at} name carries «${term}»`);
    if (list(want.qAny).length && !want.qAny.some((term) => has(part.q, term, fold))) fail(`${at} q has none of: ${want.qAny.join(' | ')}`);
    for (const term of list(want.qNone)) if (has(part.q, term, fold)) fail(`${at} q carries «${term}»`);
    for (const need of list(want.needsAll)) if (!list(part.needs).includes(need)) fail(`${at} needs lacks ${need}`);
    if (list(want.needsAny).length && !want.needsAny.some((need) => list(part.needs).includes(need))) fail(`${at} needs has none of: ${want.needsAny.join('|')}`);
    if (list(want.sourceAny).length && !want.sourceAny.some((src) => list(part.source).includes(src))) fail(`${at} source has none of: ${want.sourceAny.join('|')}`);
    if (typeof want.act === 'string' && String(part.act || '') !== want.act) fail(`${at} act «${part.act || ''}» (wanted «${want.act}»)`);
    if (list(want.chapterAny).length && !want.chapterAny.some((term) => has(part.chapter || '', term, fold))) fail(`${at} chapter «${part.chapter || ''}» has none of: ${want.chapterAny.join(' | ')}`);
    if (list(want.chapterNotEqual).length) {
      const bare = (s) => fold(s).replace(/^(?:باب|كتاب|ابواب)\s+/u, '').replace(/^ال(?=\S{2,})/u, '');
      if (want.chapterNotEqual.some((term) => bare(part.chapter || '') !== '' && bare(part.chapter || '') === bare(term))) fail(`${at} chapter is «${part.chapter}»`);
    }
  });
  for (const want of list(must.anyPart)) {
    const hit = parts.some((part) => (!list(want.needsAll).length || want.needsAll.every((need) => list(part.needs).includes(need)))
      && (!list(want.needsAny).length || want.needsAny.some((need) => list(part.needs).includes(need)))
      && (!list(want.kindAny).length || want.kindAny.includes(part.kind)));
    if (!hit) fail('no part has ' + JSON.stringify(want));
  }
  for (const name of list(must.noPartNamed)) {
    const bad = parts.find((part) => { const n = fold(part.name || ''); const w = fold(name); return n === w || n.startsWith(w + ' ') || n === 'ما ' + w; });
    if (bad) fail(`a part is named «${bad.name}»`);
  }
  const c = plan.c && typeof plan.c === 'object' ? plan.c : {};
  const wc = must.c && typeof must.c === 'object' ? must.c : {};
  if (wc.sahih === true && c.sahih !== true) fail('c.sahih is not true');
  if (wc.all === true && c.all !== true) fail('c.all is not true');
  for (const name of list(wc.coll)) if (!list(c.coll).includes(name)) fail(`c.coll lacks ${name}`);
  for (const name of list(wc.schools)) if (!list(c.schools).includes(name)) fail(`c.schools lacks ${name}`);
  if (list(wc.scholarAny).length && !wc.scholarAny.some((term) => has(c.scholar || '', term, fold))) fail(`c.scholar «${c.scholar || ''}»`);
  if (list(wc.bookAny).length && !wc.bookAny.some((term) => has(c.book || '', term, fold))) fail(`c.book «${c.book || ''}»`);
  if (list(wc.formAny).length && !wc.formAny.some((name) => list(c.form).includes(name))) fail(`c.form has none of: ${wc.formAny.join('|')}`);
  if (Number.isInteger(must.worldly)) {
    const n = parts.filter((part) => part.kind === 'worldly').length;
    if (n !== must.worldly) fail(`worldly parts ${n} (wanted ${must.worldly})`);
  }
  return { ok: failures.length === 0, failures };
}

/** The fixture: { schema, items: [{id, q, prev, baseline, ideal, must, why}], aliases }. */
export function readExpected() {
  return JSON.parse(readFileSync(join(here, '..', 'fixtures', 'request-plan-expected.json'), 'utf8'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { normalizeArabic } = await lib('route-classify.js');
  const { parsePlan, validatePlan } = await lib('request-plan.js');
  const expected = readExpected();
  const captured = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  let ok = 0; let bad = 0; let absent = 0;
  for (const item of expected.items) {
    const ids = [item.id, ...Object.entries(expected.aliases || {}).filter(([, to]) => to === item.id).map(([from]) => from)];
    for (const id of ids) {
      if (!(id in captured)) { absent += 1; continue; }
      const raw = captured[id];
      const parsed = typeof raw === 'string' ? parsePlan(raw) : raw;
      const valid = parsed ? validatePlan(parsed, { question: item.q, previous: item.prev }) : { ok: false, reason: 'unparsable' };
      const scored = valid.ok ? scorePlan(valid.plan, item.must, normalizeArabic) : { ok: false, failures: ['invalid plan: ' + valid.reason] };
      if (scored.ok) ok += 1; else bad += 1;
      console.log((scored.ok ? 'OK   ' : 'FAIL ') + id.padEnd(6) + (scored.ok ? '' : ' ' + scored.failures.join('; ').replace(/[^\x20-\x7e]/g, '.')));
    }
  }
  console.log(`scored ${ok + bad}: ok ${ok}, fail ${bad}; not captured ${absent}`);
  process.exit(bad ? 1 : 0);
}
